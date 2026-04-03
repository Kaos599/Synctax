import fs from "fs/promises";
import path from "path";
import os from "os";
import { ClientAdapter, McpServer, Agent, Skill, ResourceScope } from "../types.js";

import { Permissions, Models, Prompts, Credentials } from "../types.js";

function stripScope<T extends { scope?: ResourceScope }>(item: T): Omit<T, "scope"> {
  const { scope: _scope, ...rest } = item;
  return rest;
}
export class CursorAdapter implements ClientAdapter {
  id = "cursor";
  name = "Cursor";

  private get baseDir() {
    const homeDir = process.env.SYNCTAX_HOME || os.homedir();
    return path.join(homeDir, ".cursor");
  }

  private get configPath() { return path.join(this.baseDir, "mcp.json"); }
  private get modesPath() { return path.join(this.baseDir, "modes.json"); }
  private get commandsDir() { return path.join(this.baseDir, "commands"); }

  async detect(): Promise<boolean> {
    try { await fs.access(this.configPath); return true; } catch { return false; }
  }

  async read(): Promise<{ mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>, permissions?: Permissions, models?: Models, prompts?: Prompts, credentials?: Credentials }> {
    const result = {
      mcps: {} as Record<string, McpServer>,
      agents: {} as Record<string, Agent>,
      skills: {} as Record<string, Skill>
    };

    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(data);
      const mcpServers = parsed.mcpServers || {};
      for (const [key, val] of Object.entries<any>(mcpServers)) {
        result.mcps[key] = { command: val.command, args: val.args, env: val.env };
      }
    } catch (e: any) {}

    try {
      const data = await fs.readFile(this.modesPath, "utf-8");
      const parsed = JSON.parse(data);
      const modes = parsed.modes || {};
      for (const [key, val] of Object.entries<any>(modes)) {
        result.agents[key] = { name: val.name || key, description: val.description, prompt: val.systemPrompt || "", model: val.model };
      }
    } catch (e: any) {}

    try {
      const files = await fs.readdir(this.commandsDir);
      for (const file of files) {
        if (!file.endsWith(".md")) continue;
        const name = file.replace(".md", "");
        const rawContent = await fs.readFile(path.join(this.commandsDir, file), "utf-8");

        let content = rawContent;
        let description = undefined;
        let trigger = `/${name}`;

        // Very basic parsing since cursor commands don't usually have frontmatter, they are just markdown.
        // But let's assume if it does, we strip it.
        if (rawContent.startsWith("---")) {
          const parts = rawContent.split("---");
          if (parts.length >= 3) {
            content = parts.slice(2).join("---").trim();
            const lines = parts[1].split("\n");
            for (const line of lines) {
              const [k, ...rest] = line.split(":");
              if (!k) continue;
              const v = rest.join(":").trim();
              if (k.trim() === "description") description = v;
              if (k.trim() === "trigger") trigger = v;
            }
          }
        }

        result.skills[name] = { name, description, content, trigger };
      }
    } catch (e: any) {}

    return result;
  }

  async write(resources: { mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>, permissions?: Permissions, models?: Models, prompts?: Prompts, credentials?: Credentials }): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});

    let existing: any = {};
    try { existing = JSON.parse(await fs.readFile(this.configPath, "utf-8")); } catch (e) {}

    existing.mcpServers = {};
    for (const [key, value] of Object.entries(resources.mcps || {})) {
      existing.mcpServers[key] = stripScope(value);
    }
    await fs.writeFile(this.configPath, JSON.stringify(existing, null, 2), "utf-8");

    if (Object.keys(resources.agents || {}).length > 0) {
      let existingModes: any = { modes: {} };
      try { existingModes = JSON.parse(await fs.readFile(this.modesPath, "utf-8")); } catch (e) {}

      for (const [key, agent] of Object.entries(resources.agents || {})) {
        const clean = stripScope(agent);
        existingModes.modes[key] = { name: clean.name, description: clean.description, systemPrompt: clean.prompt, model: clean.model };
      }
      await fs.writeFile(this.modesPath, JSON.stringify(existingModes, null, 2), "utf-8");
    }

    if (Object.keys(resources.skills || {}).length > 0) {
      await fs.mkdir(this.commandsDir, { recursive: true }).catch(() => {});
      for (const [key, skill] of Object.entries(resources.skills || {})) {
        let content = `---\nname: ${skill.name}\n`;
        if (skill.description) content += `description: ${skill.description}\n`;
        if (skill.trigger) content += `trigger: ${skill.trigger}\n`;
        content += `---\n${skill.content}\n`;
        // Security: Prevent path traversal by sanitizing the key
        const safeKey = path.basename(key);
        await fs.writeFile(path.join(this.commandsDir, `${safeKey}.md`), content, "utf-8");
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
}
// Add permissions logic to other adapters to not break typescript tests
