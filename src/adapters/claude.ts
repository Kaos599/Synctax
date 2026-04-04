import fs from "fs/promises";
import path from "path";
import type { ClientAdapter, McpServer, Agent, Skill, Permissions, Models, Prompts, Credentials, ResourceScope } from "../types.js";
import { parseFrontmatter, serializeFrontmatter } from "../frontmatter.js";
import { homeDir } from "../platform-paths.js";
import { assertSafeResourceName } from "../resource-name.js";
import { atomicWriteFile } from "../fs-utils.js";
import { toArray, toBool, toNum } from "../coerce.js";

function stripScope<T extends { scope?: ResourceScope }>(item: T): Omit<T, "scope"> {
  const { scope: _scope, ...rest } = item;
  return rest;
}

// Default empty permissions — satisfies the full Permissions type
function emptyPermissions(): Permissions {
  return {
    allowedPaths: [], deniedPaths: [],
    allowedCommands: [], deniedCommands: [],
    networkAllow: false,
    allow: [], deny: [], ask: [],
    allowedUrls: [], deniedUrls: [], trustedFolders: [],
  };
}

/**
 * Translate Claude Code's `permissions.allow/deny/ask` (Tool(specifier) syntax)
 * to Synctax's canonical Permissions model.
 */
function fromClaudePermissions(settings: any): Permissions {
  const perms = settings?.permissions || {};
  return {
    ...emptyPermissions(),
    allow: toArray(perms.allow) || [],
    deny: toArray(perms.deny) || [],
    ask: toArray(perms.ask) || [],
  };
}

/**
 * Translate Synctax canonical Permissions to Claude Code format.
 */
function toClaudePermissions(perms: Permissions): Record<string, unknown> {
  const allow = [...(perms.allow || [])];
  const deny = [...(perms.deny || [])];
  const ask = [...(perms.ask || [])];
  // Translate legacy fields into Claude's unified format
  for (const p of perms.allowedPaths || []) allow.push(`Read(${p})`);
  for (const p of perms.deniedPaths || []) deny.push(`Read(${p})`);
  for (const cmd of perms.allowedCommands || []) allow.push(`Bash(${cmd})`);
  for (const cmd of perms.deniedCommands || []) deny.push(`Bash(${cmd})`);
  return { permissions: { allow, deny, ask } };
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

async function readJsonSafe(p: string): Promise<any> {
  try { return JSON.parse(await fs.readFile(p, "utf-8")); } catch { return {}; }
}

export class ClaudeAdapter implements ClientAdapter {
  id = "claude";
  name = "Claude Code";

  private get home() { return homeDir(); }

  // --- MCP file locations ---
  private get projectMcpPath() { return path.join(process.cwd(), ".mcp.json"); }
  private get userMcpPath() { return path.join(this.home, ".claude.json"); }

  // --- Settings file locations ---
  private get userSettingsPath() { return path.join(this.home, ".claude", "settings.json"); }
  private get projectSettingsPath() { return path.join(process.cwd(), ".claude", "settings.json"); }
  private get localSettingsPath() { return path.join(process.cwd(), ".claude", "settings.local.json"); }

  // --- Agent/Skill directories ---
  private get userAgentsDir() { return path.join(this.home, ".claude", "agents"); }
  private get projectAgentsDir() { return path.join(process.cwd(), ".claude", "agents"); }
  private get userSkillsDir() { return path.join(this.home, ".claude", "skills"); }
  private get projectSkillsDir() { return path.join(process.cwd(), ".claude", "skills"); }

  async detect(): Promise<boolean> {
    // Detect if ANY Claude Code config exists
    return (
      await fileExists(this.userSettingsPath) ||
      await fileExists(this.userMcpPath) ||
      await fileExists(this.projectMcpPath) ||
      await fileExists(this.userAgentsDir) ||
      await fileExists(this.userSkillsDir)
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
      permissions: Permissions;
      models?: Models;
      prompts?: Prompts;
    } = {
      mcps: {},
      agents: {},
      skills: {},
      permissions: emptyPermissions(),
    };

    // --- Read MCPs from all sources (user < project < local precedence) ---
    await this.readMcpsFromFile(this.userMcpPath, "user", result.mcps);
    await this.readMcpsFromFile(this.projectMcpPath, "project", result.mcps);

    // --- Read settings (permissions, model, MCPs) from settings.json ---
    // Merge: user < project < local (higher precedence overwrites)
    const userSettings = await readJsonSafe(this.userSettingsPath);
    const projectSettings = await readJsonSafe(this.projectSettingsPath);
    const localSettings = await readJsonSafe(this.localSettingsPath);

    // MCPs from settings.json (user-level) — many users store MCPs here
    await this.readMcpsFromSettings(this.userSettingsPath, "user", result.mcps);
    // MCPs from settings.json (project-level) — overrides user
    await this.readMcpsFromSettings(this.projectSettingsPath, "project", result.mcps);
    // MCPs from settings.local.json — highest precedence
    await this.readMcpsFromSettings(this.localSettingsPath, "local", result.mcps);

    // Permissions come from the highest-precedence settings file that has them
    const settingsChain = [userSettings, projectSettings, localSettings];
    for (const s of settingsChain) {
      if (s.permissions) {
        result.permissions = fromClaudePermissions(s);
      }
    }

    // Model from settings
    const effectiveModel = localSettings.model || projectSettings.model || userSettings.model;
    if (effectiveModel) {
      result.models = { defaultModel: effectiveModel };
    }

    // --- Read agents from agents directories ---
    await this.readAgentsFromDir(this.userAgentsDir, "user", result.agents);
    await this.readAgentsFromDir(this.projectAgentsDir, "project", result.agents); // project overrides user

    // --- Read skills from skills directories (directory-based: skills/<name>/SKILL.md) ---
    await this.readSkillsFromDir(this.userSkillsDir, "user", result.skills);
    await this.readSkillsFromDir(this.projectSkillsDir, "project", result.skills); // project overrides user

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
    // --- Write MCPs to .mcp.json (project-scoped) and ~/.claude.json (user/global) ---
    const projectMcps: Record<string, any> = {};
    const userMcps: Record<string, any> = {};

    for (const [key, mcp] of Object.entries(resources.mcps || {})) {
      const scope = mcp.scope || "user"; // default to user for Claude
      const stripped = stripScope(mcp);
      if (scope === "project" || scope === "local") {
        projectMcps[key] = stripped;
      } else {
        userMcps[key] = stripped;
      }
    }

    // Write project MCPs to .mcp.json
    if (Object.keys(projectMcps).length > 0) {
      const existing = await readJsonSafe(this.projectMcpPath);
      existing.mcpServers = { ...(existing.mcpServers || {}), ...projectMcps };
      await atomicWriteFile(this.projectMcpPath, JSON.stringify(existing, null, 2));
    }

    // Write user MCPs to ~/.claude.json
    const userMcpFile = await readJsonSafe(this.userMcpPath);
    userMcpFile.mcpServers = userMcps;
    await fs.mkdir(path.dirname(this.userMcpPath), { recursive: true }).catch(() => {});
    await atomicWriteFile(this.userMcpPath, JSON.stringify(userMcpFile, null, 2));

    // --- Write permissions + model to settings.json ---
    const settingsDir = path.dirname(this.userSettingsPath);
    await fs.mkdir(settingsDir, { recursive: true }).catch(() => {});
    const existingSettings = await readJsonSafe(this.userSettingsPath);

    if (resources.permissions) {
      const claudePerms = toClaudePermissions(resources.permissions);
      existingSettings.permissions = claudePerms.permissions;
    }
    if (resources.models?.defaultModel) {
      existingSettings.model = resources.models.defaultModel;
    }

    await atomicWriteFile(this.userSettingsPath, JSON.stringify(existingSettings, null, 2));

    // --- Write agents as frontmatter .md files ---
    if (Object.keys(resources.agents || {}).length > 0) {
      await fs.mkdir(this.userAgentsDir, { recursive: true }).catch(() => {});
      for (const [key, agent] of Object.entries(resources.agents || {})) {
        assertSafeResourceName(key, "agent");
        const fm: Record<string, unknown> = { name: agent.name };
        if (agent.description) fm.description = agent.description;
        if (agent.model) fm.model = agent.model;
        if (agent.tools) fm.tools = agent.tools;
        if (agent.disallowedTools) fm.disallowedTools = agent.disallowedTools;
        if (agent.permissionMode) fm.permissionMode = agent.permissionMode;
        if (agent.maxTurns) fm.maxTurns = agent.maxTurns;
        if (agent.mcpServers) fm.mcpServers = agent.mcpServers;
        if (agent.hooks) fm.hooks = agent.hooks;
        if (agent.memory) fm.memory = agent.memory;
        if (agent.background != null) fm.background = agent.background;
        if (agent.effort) fm.effort = agent.effort;
        if (agent.isolation != null) fm.isolation = agent.isolation;
        if (agent.userInvocable != null) fm.userInvocable = agent.userInvocable;

        const content = serializeFrontmatter(fm, agent.prompt);
        await atomicWriteFile(path.join(this.userAgentsDir, `${key}.md`), content + "\n");
      }
    }

    // --- Write skills as directory-based SKILL.md files ---
    if (Object.keys(resources.skills || {}).length > 0) {
      for (const [key, skill] of Object.entries(resources.skills || {})) {
        assertSafeResourceName(key, "skill");
        const skillDir = path.join(this.userSkillsDir, key);
        await fs.mkdir(skillDir, { recursive: true }).catch(() => {});

        const fm: Record<string, unknown> = { name: skill.name };
        if (skill.description) fm.description = skill.description;
        if (skill.trigger) fm.trigger = skill.trigger;
        if (skill.argumentHint) fm["argument-hint"] = skill.argumentHint;
        if (skill.disableModelInvocation != null) fm["disable-model-invocation"] = skill.disableModelInvocation;
        if (skill.userInvocable != null) fm["user-invocable"] = skill.userInvocable;
        if (skill.allowedTools) fm["allowed-tools"] = skill.allowedTools;
        if (skill.model) fm.model = skill.model;
        if (skill.effort) fm.effort = skill.effort;
        if (skill.context) fm.context = skill.context;
        if (skill.agent) fm.agent = skill.agent;
        if (skill.hooks) fm.hooks = skill.hooks;

        const content = serializeFrontmatter(fm, skill.content);
        await atomicWriteFile(path.join(skillDir, "SKILL.md"), content + "\n");
      }
    }
  }

  // --- Memory ---
  getMemoryFileName(): string { return "CLAUDE.md"; }

  async readMemory(projectDir: string): Promise<string | null> {
    try { return await fs.readFile(path.join(projectDir, this.getMemoryFileName()), "utf-8"); } catch { return null; }
  }

  async writeMemory(projectDir: string, content: string): Promise<void> {
    await atomicWriteFile(path.join(projectDir, this.getMemoryFileName()), content);
  }

  // --- Private helpers ---

  private async readMcpsFromFile(
    filePath: string,
    scope: ResourceScope,
    target: Record<string, McpServer>
  ): Promise<void> {
    const data = await readJsonSafe(filePath);
    const mcpServers = data.mcpServers || {};
    for (const [key, val] of Object.entries<any>(mcpServers)) {
      target[key] = {
        command: val.command || "",
        args: toArray(val.args),
        env: val.env,
        transport: val.transport || (val.url ? (val.type || "http") : val.type),
        url: val.url,
        headers: val.headers,
        cwd: val.cwd,
        scope,
      };
    }
  }

  private async readMcpsFromSettings(
    filePath: string,
    scope: ResourceScope,
    target: Record<string, McpServer>
  ): Promise<void> {
    const settings = await readJsonSafe(filePath);
    const mcpServers = settings.mcpServers || {};
    for (const [key, val] of Object.entries<any>(mcpServers)) {
      target[key] = {
        command: val.command || "",
        args: toArray(val.args),
        env: val.env,
        transport: val.transport || (val.url ? (val.type || "http") : val.type),
        url: val.url,
        headers: val.headers,
        cwd: val.cwd,
        scope,
      };
    }
  }

  private async readAgentsFromDir(
    dir: string,
    scope: ResourceScope,
    target: Record<string, Agent>
  ): Promise<void> {
    let files: string[];
    try { files = await fs.readdir(dir); } catch { return; }

    for (const file of files) {
      if (!file.match(/\.(md|agent|agents|claude)$/)) continue;
      const key = file.replace(/\.(md|agent|agents|claude)$/, "");
      const raw = await fs.readFile(path.join(dir, file), "utf-8");

      const { data, content } = parseFrontmatter<Record<string, any>>(raw);

      target[key] = {
        name: data.name || key,
        description: data.description,
        prompt: content,
        model: data.model,
        tools: toArray(data.tools),
        disallowedTools: toArray(data.disallowedTools),
        permissionMode: data.permissionMode,
        maxTurns: toNum(data.maxTurns),
        mcpServers: Array.isArray(data.mcpServers) ? data.mcpServers : (typeof data.mcpServers === "object" && data.mcpServers ? data.mcpServers : undefined),
        hooks: data.hooks,
        memory: toArray(data.memory),
        background: toBool(data.background),
        effort: data.effort,
        isolation: toBool(data.isolation),
        userInvocable: toBool(data.userInvocable),
        scope,
      };
    }
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
        // Directory-based skill: skills/<name>/SKILL.md
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
            disableModelInvocation: toBool(data["disable-model-invocation"]),
            userInvocable: toBool(data["user-invocable"]),
            allowedTools: toArray(data["allowed-tools"]),
            model: data.model,
            effort: data.effort,
            context: toArray(data.context),
            agent: data.agent,
            hooks: data.hooks,
            scope,
          };
        }
      } else if (entry.match(/\.(md|agent|agents|claude)$/)) {
        // Legacy flat file skill (backward compat)
        const key = entry.replace(/\.(md|agent|agents|claude)$/, "");
        const raw = await fs.readFile(entryPath, "utf-8");
        const { data, content } = parseFrontmatter<Record<string, any>>(raw);
        target[key] = {
          name: data.name || key,
          description: data.description,
          content,
          trigger: data.trigger,
          scope,
        };
      }
    }
  }
}
