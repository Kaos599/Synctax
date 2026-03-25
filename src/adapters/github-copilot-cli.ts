import fs from "fs/promises";
import path from "path";
import type { ClientAdapter, McpServer, Agent, Skill, Permissions, Models, Prompts, Credentials, ResourceScope } from "../types.js";
import { homeDir } from "../platform-paths.js";
import { splitByScope } from "../scopes.js";
import { parseFrontmatter, serializeFrontmatter } from "../frontmatter.js";

function stripScope<T extends { scope?: ResourceScope }>(item: T): Omit<T, "scope"> {
  const { scope: _scope, ...rest } = item;
  return rest;
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

async function readJsonSafe(p: string): Promise<any> {
  try { return JSON.parse(await fs.readFile(p, "utf-8")); } catch { return {}; }
}

function emptyPermissions(): Permissions {
  return {
    allowedPaths: [], deniedPaths: [],
    allowedCommands: [], deniedCommands: [],
    networkAllow: false,
    allow: [], deny: [], ask: [],
    allowedUrls: [], deniedUrls: [], trustedFolders: [],
  };
}

export class GithubCopilotCliAdapter implements ClientAdapter {
  id = "github-copilot-cli";
  name = "Github Copilot CLI";

  private get home() { return homeDir(); }

  // --- Config paths ---
  private get userConfigPath() { return path.join(this.home, ".copilot", "config.json"); }
  private get projectConfigPath() { return path.join(process.cwd(), ".github", "copilot", "settings.json"); }

  // --- MCP path ---
  private get mcpConfigPath() { return path.join(this.home, ".copilot", "mcp-config.json"); }

  // --- Agent directories ---
  private get userAgentsDir() { return path.join(this.home, ".copilot", "agents"); }
  private get projectAgentsDir() { return path.join(process.cwd(), ".github", "agents"); }

  // --- Skill directories ---
  private get userSkillsDir() { return path.join(this.home, ".copilot", "skills"); }
  private get projectSkillsDir() { return path.join(process.cwd(), ".github", "skills"); }

  async detect(): Promise<boolean> {
    return (
      await fileExists(this.userConfigPath) ||
      await fileExists(this.projectConfigPath) ||
      await fileExists(this.mcpConfigPath) ||
      await fileExists(this.userAgentsDir) ||
      await fileExists(this.projectAgentsDir)
    );
  }

  async read(): Promise<{
    mcps: Record<string, McpServer>;
    agents: Record<string, Agent>;
    skills: Record<string, Skill>;
    permissions?: Permissions;
    models?: Models;
    prompts?: Prompts;
    credentials?: Credentials;
  }> {
    const result: {
      mcps: Record<string, McpServer>;
      agents: Record<string, Agent>;
      skills: Record<string, Skill>;
      permissions?: Permissions;
    } = {
      mcps: {},
      agents: {},
      skills: {},
    };

    // --- Read MCPs from ~/.copilot/mcp-config.json ---
    const mcpData = await readJsonSafe(this.mcpConfigPath);
    const mcpServers = mcpData.mcpServers || {};
    for (const [key, val] of Object.entries<any>(mcpServers)) {
      if (val && typeof val === "object" && typeof val.command === "string") {
        result.mcps[key] = {
          command: val.command,
          args: val.args,
          env: val.env,
          scope: "user",
        };
      }
    }

    // --- Read agents from agent directories ---
    await this.readAgentsFromDir(this.userAgentsDir, "user", result.agents);
    await this.readAgentsFromDir(this.projectAgentsDir, "project", result.agents);

    // --- Read skills from skill directories ---
    await this.readSkillsFromDir(this.userSkillsDir, "user", result.skills);
    await this.readSkillsFromDir(this.projectSkillsDir, "project", result.skills);

    // --- Read permissions from config.json ---
    const userConfig = await readJsonSafe(this.userConfigPath);
    const projectConfig = await readJsonSafe(this.projectConfigPath);

    // Merge permissions (project overrides user)
    const hasPerms = (c: any) =>
      c.allowed_urls || c.denied_urls || c.trusted_folders;

    if (hasPerms(userConfig) || hasPerms(projectConfig)) {
      const perms = emptyPermissions();
      // User-level first
      if (userConfig.allowed_urls) perms.allowedUrls = userConfig.allowed_urls;
      if (userConfig.denied_urls) perms.deniedUrls = userConfig.denied_urls;
      if (userConfig.trusted_folders) perms.trustedFolders = userConfig.trusted_folders;
      // Project-level overrides
      if (projectConfig.allowed_urls) perms.allowedUrls = projectConfig.allowed_urls;
      if (projectConfig.denied_urls) perms.deniedUrls = projectConfig.denied_urls;
      if (projectConfig.trusted_folders) perms.trustedFolders = projectConfig.trusted_folders;
      result.permissions = perms;
    }

    return result;
  }

  async write(resources: {
    mcps: Record<string, McpServer>;
    agents: Record<string, Agent>;
    skills: Record<string, Skill>;
    permissions?: Permissions;
    models?: Models;
    prompts?: Prompts;
    credentials?: Credentials;
  }): Promise<void> {
    // --- Write MCPs to ~/.copilot/mcp-config.json ---
    const allMcps = resources.mcps || {};
    if (Object.keys(allMcps).length > 0) {
      await fs.mkdir(path.dirname(this.mcpConfigPath), { recursive: true }).catch(() => {});
      const existing = await readJsonSafe(this.mcpConfigPath);
      existing.mcpServers = existing.mcpServers || {};
      for (const [key, value] of Object.entries(allMcps)) {
        existing.mcpServers[key] = stripScope(value);
      }
      await fs.writeFile(this.mcpConfigPath, JSON.stringify(existing, null, 2), "utf-8");
    }

    // --- Write agents as frontmatter markdown files ---
    if (Object.keys(resources.agents || {}).length > 0) {
      const { project: projectAgents, user: userAgents, global: globalAgents } = splitByScope(resources.agents);

      // Write project-scoped agents to .github/agents/
      if (Object.keys(projectAgents).length > 0) {
        await fs.mkdir(this.projectAgentsDir, { recursive: true }).catch(() => {});
        for (const [key, agent] of Object.entries(projectAgents)) {
          await this.writeAgentFile(path.join(this.projectAgentsDir, `${key}.md`), agent);
        }
      }

      // Write user/global-scoped agents to ~/.copilot/agents/
      const homeAgents = { ...globalAgents, ...userAgents };
      if (Object.keys(homeAgents).length > 0) {
        await fs.mkdir(this.userAgentsDir, { recursive: true }).catch(() => {});
        for (const [key, agent] of Object.entries(homeAgents)) {
          await this.writeAgentFile(path.join(this.userAgentsDir, `${key}.md`), agent);
        }
      }
    }

    // --- Write skills as SKILL.md files ---
    if (Object.keys(resources.skills || {}).length > 0) {
      const { project: projectSkills, user: userSkills, global: globalSkills } = splitByScope(resources.skills);

      // Write project-scoped skills to .github/skills/
      if (Object.keys(projectSkills).length > 0) {
        for (const [key, skill] of Object.entries(projectSkills)) {
          const skillDir = path.join(this.projectSkillsDir, key);
          await fs.mkdir(skillDir, { recursive: true }).catch(() => {});
          await this.writeSkillFile(path.join(skillDir, "SKILL.md"), skill);
        }
      }

      // Write user/global-scoped skills to ~/.copilot/skills/
      const homeSkills = { ...globalSkills, ...userSkills };
      if (Object.keys(homeSkills).length > 0) {
        for (const [key, skill] of Object.entries(homeSkills)) {
          const skillDir = path.join(this.userSkillsDir, key);
          await fs.mkdir(skillDir, { recursive: true }).catch(() => {});
          await this.writeSkillFile(path.join(skillDir, "SKILL.md"), skill);
        }
      }
    }

    // --- Write permissions to config.json ---
    if (resources.permissions) {
      const perms = resources.permissions;
      const hasUrlPerms = (perms.allowedUrls?.length ?? 0) > 0 ||
                          (perms.deniedUrls?.length ?? 0) > 0 ||
                          (perms.trustedFolders?.length ?? 0) > 0;
      if (hasUrlPerms) {
        await fs.mkdir(path.dirname(this.userConfigPath), { recursive: true }).catch(() => {});
        const existing = await readJsonSafe(this.userConfigPath);
        if (perms.allowedUrls?.length) existing.allowed_urls = perms.allowedUrls;
        if (perms.deniedUrls?.length) existing.denied_urls = perms.deniedUrls;
        if (perms.trustedFolders?.length) existing.trusted_folders = perms.trustedFolders;
        await fs.writeFile(this.userConfigPath, JSON.stringify(existing, null, 2), "utf-8");
      }
    }
  }

  // --- Memory ---
  getMemoryFileName(): string { return ".github/copilot-instructions.md"; }

  async readMemory(projectDir: string): Promise<string | null> {
    try { return await fs.readFile(path.join(projectDir, this.getMemoryFileName()), "utf-8"); } catch { return null; }
  }

  async writeMemory(projectDir: string, content: string): Promise<void> {
    const filePath = path.join(projectDir, this.getMemoryFileName());
    await fs.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {});
    await fs.writeFile(filePath, content, "utf-8");
  }

  // --- Private helpers ---

  private async readAgentsFromDir(
    dir: string,
    scope: ResourceScope,
    target: Record<string, Agent>
  ): Promise<void> {
    let files: string[];
    try { files = await fs.readdir(dir); } catch { return; }

    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const key = file.replace(/\.md$/, "");
      const raw = await fs.readFile(path.join(dir, file), "utf-8");
      const { data, content } = parseFrontmatter<Record<string, any>>(raw);
      target[key] = {
        name: data.name || key,
        description: data.description,
        prompt: content,
        model: data.model,
        tools: data.tools,
        scope,
      };
    }
  }

  private async writeAgentFile(filePath: string, agent: Agent): Promise<void> {
    const fm: Record<string, unknown> = { name: agent.name };
    if (agent.description) fm.description = agent.description;
    if (agent.model) fm.model = agent.model;
    if (agent.tools) fm.tools = agent.tools;
    const content = serializeFrontmatter(fm, agent.prompt);
    await fs.writeFile(filePath, content + "\n", "utf-8");
  }

  private async readSkillsFromDir(
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
            scope,
          };
        }
      }
    }
  }

  private async writeSkillFile(filePath: string, skill: Skill): Promise<void> {
    const fm: Record<string, unknown> = { name: skill.name };
    if (skill.description) fm.description = skill.description;
    if (skill.trigger) fm.trigger = skill.trigger;
    const content = serializeFrontmatter(fm, skill.content);
    await fs.writeFile(filePath, content + "\n", "utf-8");
  }
}
