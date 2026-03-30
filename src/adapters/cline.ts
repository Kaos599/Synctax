import fs from "fs/promises";
import path from "path";
import type { ClientAdapter, McpServer, Agent, Skill, Permissions, Models, Prompts, Credentials, ResourceScope } from "../types.js";
import { homeDir, xdgStyleConfigCandidates, firstExistingScopedPath, firstExistingPath } from "../platform-paths.js";
import type { ConfigScope } from "../platform-paths.js";
import { splitByScope } from "../scopes.js";

function scopeWeight(scope: ConfigScope): number {
  if (scope === "global") return 0;
  if (scope === "user") return 1;
  return 2;
}

function stripScope<T extends { scope?: ResourceScope }>(item: T): Omit<T, "scope"> {
  const { scope: _scope, ...rest } = item;
  return rest;
}

function mergeMcpServers(parsed: Record<string, any>, into: Record<string, McpServer>, scope: ConfigScope) {
  const mcpServers = parsed.mcpServers || {};
  for (const [key, val] of Object.entries<any>(mcpServers)) {
    if (val && typeof val === "object" && typeof val.command === "string") {
      into[key] = { command: val.command, args: val.args, env: val.env, scope };
    }
  }
}

function mergeConfig(parsed: any, permissions: Permissions, models: Models) {
  if (!parsed || typeof parsed !== "object") return;
  if (typeof parsed.autoApproveNetwork === "boolean") permissions.networkAllow = parsed.autoApproveNetwork;
  if (Array.isArray(parsed.autoApproveCommands)) {
    permissions.allowedCommands = parsed.autoApproveCommands;
  }
  if (typeof parsed.model === "string") models.defaultModel = parsed.model;
}

function defaultPermissions(): Permissions {
  return {
    allowedPaths: [],
    deniedPaths: [],
    allowedCommands: [],
    deniedCommands: [],
    networkAllow: false,
    allow: [],
    deny: [],
    ask: [],
    allowedUrls: [],
    deniedUrls: [],
    trustedFolders: [],
  };
}

export class ClineAdapter implements ClientAdapter {
  id = "cline";
  name = "Cline";

  private get baseDir() {
    return path.join(homeDir(), ".cline");
  }

  private mcpPathCandidates() {
    return [
      { path: path.join(this.baseDir, "mcp_settings.json"), scope: "global" as const, label: "legacy cline mcp config" },
      { path: path.join(this.baseDir, "data", "settings", "cline_mcp_settings.json"), scope: "user" as const, label: "cline package mcp settings" },
      ...xdgStyleConfigCandidates("cline", "cline_mcp_settings.json", homeDir()),
    ];
  }

  private configCandidates() {
    return [
      { path: path.join(this.baseDir, "config.json"), scope: "global" as const, label: "legacy cline config" },
      ...xdgStyleConfigCandidates("cline", "config.json", homeDir()),
    ];
  }

  async detect(): Promise<boolean> {
    const candidates = [...this.configCandidates(), ...this.mcpPathCandidates()];
    const paths = [...new Set(candidates.map((candidate) => candidate.path))];
    return (await firstExistingPath(paths)) !== null;
  }

  async read(): Promise<{
    mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>,
    permissions?: Permissions, models?: Models, prompts?: Prompts, credentials?: Credentials
  }> {
    const result = {
      mcps: {} as Record<string, McpServer>,
      agents: {} as Record<string, Agent>,
      skills: {} as Record<string, Skill>,
      permissions: defaultPermissions(),
      models: {} as Models,
      prompts: {} as Prompts
    };

    for (const candidate of this.mcpPathCandidates().sort((a, b) => scopeWeight(a.scope) - scopeWeight(b.scope))) {
      try {
        const data = await fs.readFile(candidate.path, "utf-8");
        const parsed = JSON.parse(data);
        mergeMcpServers(parsed, result.mcps, candidate.scope);
      } catch {
        /* missing or invalid */
      }
    }

    for (const candidate of this.configCandidates().sort((a, b) => scopeWeight(a.scope) - scopeWeight(b.scope))) {
      try {
        const data = await fs.readFile(candidate.path, "utf-8");
        const parsed = JSON.parse(data);
        mergeConfig(parsed, result.permissions, result.models);
      } catch {
        /* missing or invalid */
      }
    }

    return result;
  }

  async write(resources: { mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>, permissions?: Permissions, models?: Models, prompts?: Prompts, credentials?: Credentials }): Promise<void> {
    const { project: projectMcps, user: userMcps, global: globalMcps } = splitByScope(resources.mcps);
    const mergedMcps = { ...globalMcps, ...userMcps, ...projectMcps };

    const mcpPath = await this.resolveWritePath(this.mcpPathCandidates(), "user");
    if (Object.keys(mergedMcps).length > 0) {
      await this.writeMcpSettings(mcpPath, mergedMcps);
    }

    if (resources.permissions || resources.models) {
      const configPath = await this.resolveWritePath(this.configCandidates(), "user");
      await this.writeConfig(configPath, resources.permissions, resources.models);
    }
  }

  private async resolveWritePath(candidates: { path: string; scope: ConfigScope; label: string }[], scope: ConfigScope): Promise<string> {
    const prioritized = [
      ...candidates.filter((entry) => entry.scope === scope),
      ...candidates.filter((entry) => entry.scope !== scope),
    ];
    const found = await firstExistingScopedPath(prioritized);
    const fallback = candidates[0]?.path;
    if (found?.path) return found.path;
    if (fallback) return fallback;
    throw new Error("No config path candidates available for Cline adapter");
  }

  private async writeMcpSettings(configPath: string, mcps: Record<string, McpServer>): Promise<void> {
    const dir = path.dirname(configPath);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});

    let existing: any = {};
    try {
      existing = JSON.parse(await fs.readFile(configPath, "utf-8"));
    } catch {
      /* no existing */
    }

    existing.mcpServers = {};
    for (const [key, value] of Object.entries(mcps)) {
      existing.mcpServers[key] = stripScope(value);
    }

    await fs.writeFile(configPath, JSON.stringify(existing, null, 2), "utf-8");
  }

  private async writeConfig(configPath: string, permissions?: Permissions, models?: Models): Promise<void> {
    const dir = path.dirname(configPath);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});

    let existing: any = {};
    try {
      existing = JSON.parse(await fs.readFile(configPath, "utf-8"));
    } catch {
      /* no existing */
    }

    if (permissions) {
      existing.autoApproveNetwork = permissions.networkAllow;
      if (permissions.allowedCommands && permissions.allowedCommands.length > 0) {
        existing.autoApproveCommands = permissions.allowedCommands;
      }
    }
    if (models?.defaultModel) {
      existing.model = models.defaultModel;
    }

    await fs.writeFile(configPath, JSON.stringify(existing, null, 2), "utf-8");
  }

  getMemoryFileName(): string { return ".clinerules"; }
  async readMemory(projectDir: string): Promise<string | null> {
    try {
      return await fs.readFile(path.join(projectDir, this.getMemoryFileName()), "utf-8");
    } catch {
      return null;
    }
  }
  async writeMemory(projectDir: string, content: string): Promise<void> {
    await fs.writeFile(path.join(projectDir, this.getMemoryFileName()), content, "utf-8");
  }
}
