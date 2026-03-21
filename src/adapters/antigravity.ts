import fs from "fs/promises";
import path from "path";
import { ClientAdapter, McpServer, Agent, Skill, Permissions, Models, Prompts, Credentials, ResourceScope } from "../types.js";
import {
  antigravityConfigCandidates,
  antigravityInstallDirsDetected,
  firstExistingPath,
  homeDir,
  firstExistingScopedPath,
  ConfigScope,
} from "../platform-paths.js";
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

  const servers = parsed.servers || {};
  for (const [key, val] of Object.entries<any>(servers)) {
    if (val && typeof val === "object" && typeof val.command === "string") {
      into[key] = { command: val.command, args: val.args, env: val.env, scope };
    }
  }
}

function mergeAgents(parsed: Record<string, any>, into: Record<string, Agent>, scope: ConfigScope) {
  const agents = parsed.agents || {};
  for (const [key, val] of Object.entries<any>(agents)) {
    if (val && typeof val === "object") {
      into[key] = {
        name: val.name || key,
        description: val.description,
        prompt: val.prompt || "",
        model: val.model,
        scope,
      };
    }
  }
}

function mergeSkills(parsed: Record<string, any>, into: Record<string, Skill>, scope: ConfigScope) {
  const skills = parsed.skills || {};
  for (const [key, val] of Object.entries<any>(skills)) {
    if (val && typeof val === "object") {
      into[key] = {
        name: val.name || key,
        description: val.description,
        content: val.content || "",
        trigger: val.trigger,
        scope,
      };
    }
  }
}

export class AntigravityAdapter implements ClientAdapter {
  id = "antigravity";
  name = "Antigravity";

  private configCandidates() {
    return antigravityConfigCandidates(homeDir());
  }

  private async resolvedConfigPath(): Promise<string> {
    const candidates = this.configCandidates().filter((entry) => entry.scope !== "global");
    const byOrder = [...candidates, ...this.configCandidates().filter((entry) => entry.scope === "global")];
    const existing = await firstExistingScopedPath(byOrder);
    if (existing) return existing.path;
    return this.configCandidates()[0]?.path ?? path.join(homeDir(), ".antigravity", "config.json");
  }

  async detect(): Promise<boolean> {
    if ((await firstExistingPath(this.configCandidates().map((entry) => entry.path))) !== null) return true;
    return antigravityInstallDirsDetected(homeDir());
  }

  async read(): Promise<{ mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>, permissions?: Permissions, models?: Models, prompts?: Prompts, credentials?: Credentials }> {
    const result = {
      mcps: {} as Record<string, McpServer>,
      agents: {} as Record<string, Agent>,
      skills: {} as Record<string, Skill>
    };

    const candidates = this.configCandidates().sort((a, b) => scopeWeight(a.scope) - scopeWeight(b.scope));
    for (const candidate of candidates) {
      const configPath = candidate.path;
      try {
        const data = await fs.readFile(configPath, "utf-8");
        const parsed = JSON.parse(data);
        mergeMcpServers(parsed, result.mcps, candidate.scope);
        mergeAgents(parsed, result.agents, candidate.scope);
        mergeSkills(parsed, result.skills, candidate.scope);
      } catch {
        /* invalid json */
      }
    }

    return result;
  }

  async write(resources: { mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>, permissions?: Permissions, models?: Models, prompts?: Prompts, credentials?: Credentials }): Promise<void> {
    const { user: userMcps, global: globalMcps, project: projectMcps } = splitByScope(resources.mcps);
    const { user: userAgents, global: globalAgents, project: projectAgents } = splitByScope(resources.agents);
    const { user: userSkills, global: globalSkills, project: projectSkills } = splitByScope(resources.skills);

    const toWriteMcps = { ...globalMcps, ...userMcps, ...projectMcps };
    const toWriteAgents = { ...globalAgents, ...userAgents, ...projectAgents };
    const toWriteSkills = { ...globalSkills, ...userSkills, ...projectSkills };

    if (
      Object.keys(toWriteMcps).length === 0 &&
      Object.keys(toWriteAgents).length === 0 &&
      Object.keys(toWriteSkills).length === 0
    ) {
      return;
    }

    const configPath = await this.resolvedConfigPath();
    const dir = path.dirname(configPath);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});

    let existing: any = {};
    try { existing = JSON.parse(await fs.readFile(configPath, "utf-8")); } catch (e) {}
    if (Object.keys(toWriteMcps).length > 0) {
      existing.mcpServers = existing.mcpServers || {};
      for (const [key, value] of Object.entries(toWriteMcps)) {
        existing.mcpServers[key] = stripScope(value);
      }
    }

    if (Object.keys(toWriteAgents).length > 0) {
      existing.agents = existing.agents || {};
      for (const [key, value] of Object.entries(toWriteAgents)) {
        const agent = stripScope(value);
        existing.agents[key] = { ...agent };
      }
    }

    if (Object.keys(toWriteSkills).length > 0) {
      existing.skills = existing.skills || {};
      for (const [key, value] of Object.entries(toWriteSkills)) {
        existing.skills[key] = stripScope(value);
      }
    }

    await fs.writeFile(configPath, JSON.stringify(existing, null, 2), "utf-8");
  }

  getMemoryFileName(): string { return ".antigravityrules"; }
  async readMemory(projectDir: string): Promise<string | null> {
    try { return await fs.readFile(path.join(projectDir, this.getMemoryFileName()), "utf-8"); } catch { return null; }
  }
  async writeMemory(projectDir: string, content: string): Promise<void> {
    await fs.writeFile(path.join(projectDir, this.getMemoryFileName()), content, "utf-8");
  }
}
