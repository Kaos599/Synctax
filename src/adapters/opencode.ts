import fs from "fs/promises";
import path from "path";
import {
  ClientAdapter,
  McpServer,
  Agent,
  Skill,
  Permissions,
  Models,
  Prompts,
  Credentials,
  ResourceScope,
} from "../types.js";
import { firstExistingPath, firstExistingScopedPath, homeDir, opencodeConfigCandidates, ConfigScope } from "../platform-paths.js";
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

function mergeMcpServers(parsed: Record<string, any>, into: Record<string, McpServer>, scope: ConfigScope): void {
  const mcp = parsed.mcp || {};
  for (const [key, val] of Object.entries<any>(mcp)) {
    if (!val || typeof val !== "object" || typeof val.command !== "string") continue;
    into[key] = { command: val.command, args: val.args, env: val.env, scope };
  }
}

function mergeAgents(parsed: Record<string, any>, into: Record<string, Agent>, scope: ConfigScope): void {
  const agents = parsed.agents || {};
  for (const [key, val] of Object.entries<any>(agents)) {
    if (!val || typeof val !== "object") continue;
    into[key] = {
      name: val.name || key,
      description: val.description,
      prompt: val.system_message || "",
      model: val.model,
      scope,
    };
  }
}

function mergeSkills(parsed: Record<string, any>, into: Record<string, Skill>, scope: ConfigScope): void {
  const skills = parsed.skills || {};
  for (const [key, val] of Object.entries<any>(skills)) {
    if (!val || typeof val !== "object") continue;
    into[key] = {
      name: val.name || key,
      description: val.description,
      content: val.content || "",
      trigger: val.trigger,
      scope,
    };
  }
}

export class OpenCodeAdapter implements ClientAdapter {
  id = "opencode";
  name = "OpenCode";

  private candidates() {
    return opencodeConfigCandidates(homeDir());
  }

  async detect(): Promise<boolean> {
    const paths = this.candidates().map((candidate) => candidate.path);
    return (await firstExistingPath(paths)) !== null;
  }

  private async resolvedConfigPath(scope: ConfigScope): Promise<string> {
    const candidates = this.candidates().filter((candidate) => candidate.scope === scope);
    const first = await firstExistingScopedPath(candidates);
    if (first) return first.path;
    return candidates[0]?.path ?? this.candidates()[0]?.path ?? path.join(process.cwd(), ".config", "opencode", "config.json");
  }

  async read(): Promise<{ mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>, permissions?: Permissions, models?: Models, prompts?: Prompts, credentials?: Credentials }> {
    const result = {
      mcps: {} as Record<string, McpServer>,
      agents: {} as Record<string, Agent>,
      skills: {} as Record<string, Skill>,
    };

    const candidates = this.candidates().sort((a, b) => scopeWeight(a.scope) - scopeWeight(b.scope));
    for (const candidate of candidates) {
      try {
        const data = await fs.readFile(candidate.path, "utf-8");
        const parsed = JSON.parse(data) as Record<string, any>;
        mergeMcpServers(parsed, result.mcps, candidate.scope);
        mergeAgents(parsed, result.agents, candidate.scope);
        mergeSkills(parsed, result.skills, candidate.scope);
      } catch {
        /* missing or invalid */
      }
    }

    return result;
  }

  async write(resources: { mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>, permissions?: Permissions, models?: Models, prompts?: Prompts, credentials?: Credentials }): Promise<void> {
    const { project: projectMcps, user: userMcps, global: globalMcps } = splitByScope(resources.mcps);
    const { project: projectAgents, user: userAgents, global: globalAgents } = splitByScope(resources.agents);
    const { project: projectSkills, user: userSkills, global: globalSkills } = splitByScope(resources.skills);

    const scopedUsers = { ...userMcps, ...globalMcps };
    const scopedUserAgents = { ...userAgents, ...globalAgents };
    const scopedUserSkills = { ...userSkills, ...globalSkills };

    if (Object.keys(projectMcps).length > 0 || Object.keys(projectAgents).length > 0 || Object.keys(projectSkills).length > 0) {
      const projectPath = await this.resolvedConfigPath("project");
      await this.writeToPath(projectPath, projectMcps, projectAgents, projectSkills);
    }

    if (Object.keys(scopedUsers).length > 0 || Object.keys(scopedUserAgents).length > 0 || Object.keys(scopedUserSkills).length > 0) {
      const userPath = await this.resolvedConfigPath("user");
      await this.writeToPath(userPath, scopedUsers, scopedUserAgents, scopedUserSkills);
    }
  }

  private async writeToPath(
    configPath: string,
    mcps: Record<string, McpServer>,
    agents: Record<string, Agent>,
    skills: Record<string, Skill>
  ): Promise<void> {
    const dir = path.dirname(configPath);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});

    let existing: any = {};
    try {
      existing = JSON.parse(await fs.readFile(configPath, "utf-8"));
    } catch {
      /* new file */
    }

    if (Object.keys(mcps).length > 0) {
      existing.mcp = existing.mcp || {};
      for (const [key, value] of Object.entries(mcps)) {
        existing.mcp[key] = stripScope(value);
      }
    }

    if (Object.keys(agents).length > 0) {
      existing.agents = existing.agents || {};
      for (const [key, value] of Object.entries(agents)) {
        const agent = stripScope(value);
        existing.agents[key] = { ...agent, system_message: agent.prompt };
      }
    }

    if (Object.keys(skills).length > 0) {
      existing.skills = existing.skills || {};
      for (const [key, value] of Object.entries(skills)) {
        existing.skills[key] = stripScope(value);
      }
    }

    await fs.writeFile(configPath, JSON.stringify(existing, null, 2), "utf-8");
  }

  getMemoryFileName(): string { return "AGENTS.md"; }
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
