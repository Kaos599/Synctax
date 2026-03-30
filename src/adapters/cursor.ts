import fs from "fs/promises";
import path from "path";
import os from "os";
import type { ClientAdapter, McpServer, Agent, Skill, ResourceScope } from "../types.js";
import { parseFrontmatter } from "../frontmatter.js";
import { assertSafeResourceName } from "../resource-name.js";
import { splitByScope } from "../scopes.js";

import type { Permissions, Models, Prompts, Credentials } from "../types.js";

function stripScope<T extends { scope?: ResourceScope }>(item: T): Omit<T, "scope"> {
  const { scope: _scope, ...rest } = item;
  return rest;
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

export class CursorAdapter implements ClientAdapter {
  id = "cursor";
  name = "Cursor";

  private get homeDir() {
    return process.env.SYNCTAX_HOME || os.homedir();
  }

  private get baseDir() {
    return path.join(this.homeDir, ".cursor");
  }

  private get configPath() { return path.join(this.baseDir, "mcp.json"); }
  private get projectConfigPath() { return path.join(process.cwd(), ".cursor", "mcp.json"); }
  private get modesPath() { return path.join(this.baseDir, "modes.json"); }
  private get commandsDir() { return path.join(this.baseDir, "commands"); }
  private get globalSkillsDir() { return path.join(this.homeDir, ".cursor", "skills"); }
  private get projectSkillsDir() { return path.join(process.cwd(), ".cursor", "skills"); }

  async detect(): Promise<boolean> {
    try { await fs.access(this.configPath); return true; } catch { return false; }
  }

  async read(): Promise<{ mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>, permissions?: Permissions, models?: Models, prompts?: Prompts, credentials?: Credentials }> {
    const result = {
      mcps: {} as Record<string, McpServer>,
      agents: {} as Record<string, Agent>,
      skills: {} as Record<string, Skill>
    };

    // Read MCPs from global ~/.cursor/mcp.json
    await this.readMcpsFromFile(this.configPath, "global", result.mcps);
    // Read MCPs from project .cursor/mcp.json (project overrides global)
    await this.readMcpsFromFile(this.projectConfigPath, "project", result.mcps);

    // Read agents (modes)
    try {
      const data = await fs.readFile(this.modesPath, "utf-8");
      const parsed = JSON.parse(data);
      const modes = parsed.modes || {};
      for (const [key, val] of Object.entries<any>(modes)) {
        result.agents[key] = { name: val.name || key, description: val.description, prompt: val.systemPrompt || "", model: val.model };
      }
    } catch (e: any) {}

    // Read skills from commands/ (plain markdown, no frontmatter)
    await this.readCommandsAsSkills(this.commandsDir, result.skills);

    // Read skills from SKILL.md directories (global then project overrides)
    await this.readSkillMdFromDir(this.globalSkillsDir, "global", result.skills);
    await this.readSkillMdFromDir(this.projectSkillsDir, "project", result.skills);

    return result;
  }

  async write(resources: { mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>, permissions?: Permissions, models?: Models, prompts?: Prompts, credentials?: Credentials }): Promise<void> {
    const { project: projectMcps, local: localMcps, user: userMcps, global: globalMcps } = splitByScope(resources.mcps);
    const projectTargetMcps = { ...projectMcps, ...localMcps };
    const userTargetMcps = { ...globalMcps, ...userMcps };

    if (Object.keys(projectTargetMcps).length > 0) {
      const projectDir = path.dirname(this.projectConfigPath);
      await fs.mkdir(projectDir, { recursive: true }).catch(() => {});

      let existingProject: any = {};
      try { existingProject = JSON.parse(await fs.readFile(this.projectConfigPath, "utf-8")); } catch {}

      existingProject.mcpServers = existingProject.mcpServers || {};
      for (const [key, value] of Object.entries(projectTargetMcps)) {
        existingProject.mcpServers[key] = stripScope(value);
      }
      await fs.writeFile(this.projectConfigPath, JSON.stringify(existingProject, null, 2), "utf-8");
    }

    if (Object.keys(userTargetMcps).length > 0) {
      const dir = path.dirname(this.configPath);
      await fs.mkdir(dir, { recursive: true }).catch(() => {});

      let existing: any = {};
      try { existing = JSON.parse(await fs.readFile(this.configPath, "utf-8")); } catch {}

      existing.mcpServers = existing.mcpServers || {};
      for (const [key, value] of Object.entries(userTargetMcps)) {
        existing.mcpServers[key] = stripScope(value);
      }
      await fs.writeFile(this.configPath, JSON.stringify(existing, null, 2), "utf-8");
    }

    if (Object.keys(resources.agents || {}).length > 0) {
      await fs.mkdir(this.baseDir, { recursive: true }).catch(() => {});
      let existingModes: any = { modes: {} };
      try { existingModes = JSON.parse(await fs.readFile(this.modesPath, "utf-8")); } catch (e) {}

      for (const [key, agent] of Object.entries(resources.agents || {})) {
        const clean = stripScope(agent);
        existingModes.modes[key] = { name: clean.name, description: clean.description, systemPrompt: clean.prompt, model: clean.model };
      }
      await fs.writeFile(this.modesPath, JSON.stringify(existingModes, null, 2), "utf-8");
    }

    // Write skills as plain markdown commands (no frontmatter)
    if (Object.keys(resources.skills || {}).length > 0) {
      await fs.mkdir(this.commandsDir, { recursive: true }).catch(() => {});
      for (const [key, skill] of Object.entries(resources.skills || {})) {
        assertSafeResourceName(key, "skill");
        await fs.writeFile(path.join(this.commandsDir, `${key}.md`), skill.content + "\n", "utf-8");
      }
    }
  }

  getMemoryFileName(): string { return ".cursorrules"; }
  async readMemory(projectDir: string): Promise<string | null> {
    try { return await fs.readFile(path.join(projectDir, this.getMemoryFileName()), "utf-8"); } catch { return null; }
  }
  async writeMemory(projectDir: string, content: string): Promise<void> {
    await fs.writeFile(path.join(projectDir, this.getMemoryFileName()), content, "utf-8");
  }

  // --- Private helpers ---

  private async readMcpsFromFile(
    filePath: string,
    scope: "global" | "project",
    target: Record<string, McpServer>
  ): Promise<void> {
    try {
      const data = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(data);
      const mcpServers = parsed.mcpServers || {};
      for (const [key, val] of Object.entries<any>(mcpServers)) {
        target[key] = { command: val.command, args: val.args, env: val.env, scope };
      }
    } catch (e: any) {}
  }

  private async readCommandsAsSkills(
    dir: string,
    target: Record<string, Skill>
  ): Promise<void> {
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (!file.endsWith(".md")) continue;
        const name = file.replace(".md", "");
        const content = await fs.readFile(path.join(dir, file), "utf-8");
        const trigger = `/${name}`;
        target[name] = { name, content: content.trim(), trigger };
      }
    } catch (e: any) {}
  }

  private async readSkillMdFromDir(
    dir: string,
    scope: ResourceScope,
    target: Record<string, Skill>
  ): Promise<void> {
    let entries: string[];
    try { entries = await fs.readdir(dir); } catch { return; }

    for (const entry of entries) {
      const entryPath = path.join(dir, entry);
      let stat;
      try { stat = await fs.stat(entryPath); } catch { continue; }

      if (stat.isDirectory()) {
        const skillMdPath = path.join(entryPath, "SKILL.md");
        if (await fileExists(skillMdPath)) {
          const raw = await fs.readFile(skillMdPath, "utf-8");
          const { data, content } = parseFrontmatter<Record<string, any>>(raw);
          target[entry] = {
            name: data.name || entry,
            description: data.description,
            content,
            trigger: data.trigger,
            argumentHint: data["argument-hint"],
            disableModelInvocation: data["disable-model-invocation"],
            userInvocable: data["user-invocable"],
            allowedTools: data["allowed-tools"],
            model: data.model,
            effort: data.effort,
            context: data.context,
            agent: data.agent,
            hooks: data.hooks,
            scope,
          };
        }
      }
    }
  }
}
// Add permissions logic to other adapters to not break typescript tests
