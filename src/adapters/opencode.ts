import fs from "fs/promises";
import path from "path";
import type {
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
import { firstExistingPath, firstExistingScopedPath, homeDir, opencodeConfigCandidates } from "../platform-paths.js";
import type { ConfigScope } from "../platform-paths.js";
import { splitByScope } from "../scopes.js";
import { parseFrontmatter, serializeFrontmatter } from "../frontmatter.js";
import { assertSafeResourceName } from "../resource-name.js";

function scopeWeight(scope: ConfigScope): number {
  if (scope === "global") return 0;
  if (scope === "user") return 1;
  return 2;
}

function stripScope<T extends { scope?: ResourceScope }>(item: T): Omit<T, "scope"> {
  const { scope: _scope, ...rest } = item;
  return rest;
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

// ---------------------------------------------------------------------------
// MCP translation helpers
// ---------------------------------------------------------------------------

function mergeMcpServers(parsed: Record<string, any>, into: Record<string, McpServer>, scope: ConfigScope): void {
  const mcp = parsed.mcp || {};
  for (const [key, val] of Object.entries<any>(mcp)) {
    if (!val || typeof val !== "object") continue;
    // OpenCode stores command as an ARRAY: [command, ...args]
    const cmdArray: string[] = Array.isArray(val.command) ? val.command : [];
    if (cmdArray.length === 0) continue;
    into[key] = {
      command: cmdArray[0] || "",
      args: cmdArray.slice(1),
      env: val.environment || {},
      transport: val.type === "local" ? "stdio" : val.type === "remote" ? "sse" : undefined,
      scope,
    };
  }
}

// ---------------------------------------------------------------------------
// Agent translation helpers (JSON-based, key = "agent" singular)
// ---------------------------------------------------------------------------

function mergeAgents(parsed: Record<string, any>, into: Record<string, Agent>, scope: ConfigScope): void {
  const agents = parsed.agent || {};
  for (const [key, val] of Object.entries<any>(agents)) {
    if (!val || typeof val !== "object") continue;
    into[key] = {
      name: val.name || key,
      description: val.description,
      prompt: val.prompt || "",
      model: val.model,
      scope,
    };
  }
}

// ---------------------------------------------------------------------------
// Skill reading helpers (directory-based SKILL.md files)
// ---------------------------------------------------------------------------

/**
 * Skill directories for OpenCode:
 *   project: .opencode/skills/
 *   user:    ~/.config/opencode/skills/
 */
function skillDirCandidates(h: string): { dir: string; scope: ConfigScope }[] {
  return [
    { dir: path.join(process.cwd(), ".opencode", "skills"), scope: "project" },
    { dir: path.join(h, ".config", "opencode", "skills"), scope: "user" },
  ];
}

async function readSkillsFromDir(
  dir: string,
  scope: ConfigScope,
  target: Record<string, Skill>,
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
          scope,
        };
      }
    }
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

    // Read MCPs and agents from JSON config candidates (sorted by scope weight, higher wins)
    const candidates = this.candidates().sort((a, b) => scopeWeight(a.scope) - scopeWeight(b.scope));
    for (const candidate of candidates) {
      try {
        const data = await fs.readFile(candidate.path, "utf-8");
        const parsed = JSON.parse(data) as Record<string, any>;
        mergeMcpServers(parsed, result.mcps, candidate.scope);
        mergeAgents(parsed, result.agents, candidate.scope);
      } catch {
        /* missing or invalid */
      }
    }

    // Read skills from SKILL.md directories (sorted by scope weight, higher wins)
    const skillCandidates = skillDirCandidates(homeDir()).sort((a, b) => scopeWeight(a.scope) - scopeWeight(b.scope));
    for (const { dir, scope } of skillCandidates) {
      await readSkillsFromDir(dir, scope, result.skills);
    }

    return result;
  }

  async write(resources: { mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>, permissions?: Permissions, models?: Models, prompts?: Prompts, credentials?: Credentials }): Promise<void> {
    const { project: projectMcps, user: userMcps, global: globalMcps } = splitByScope(resources.mcps);
    const { project: projectAgents, user: userAgents, global: globalAgents } = splitByScope(resources.agents);
    const { project: projectSkills, user: userSkills, global: globalSkills } = splitByScope(resources.skills);

    const scopedUserMcps = { ...userMcps, ...globalMcps };
    const scopedUserAgents = { ...userAgents, ...globalAgents };
    const scopedUserSkills = { ...userSkills, ...globalSkills };

    // Write JSON config (MCPs + agents) to appropriate scope paths
    if (Object.keys(projectMcps).length > 0 || Object.keys(projectAgents).length > 0) {
      const projectPath = await this.resolvedConfigPath("project");
      await this.writeToPath(projectPath, projectMcps, projectAgents);
    }

    if (Object.keys(scopedUserMcps).length > 0 || Object.keys(scopedUserAgents).length > 0) {
      const userPath = await this.resolvedConfigPath("user");
      await this.writeToPath(userPath, scopedUserMcps, scopedUserAgents);
    }

    // Write skills as directory-based SKILL.md files
    if (Object.keys(projectSkills).length > 0) {
      const skillsDir = path.join(process.cwd(), ".opencode", "skills");
      await this.writeSkillsToDir(skillsDir, projectSkills);
    }

    if (Object.keys(scopedUserSkills).length > 0) {
      const skillsDir = path.join(homeDir(), ".config", "opencode", "skills");
      await this.writeSkillsToDir(skillsDir, scopedUserSkills);
    }
  }

  private async writeToPath(
    configPath: string,
    mcps: Record<string, McpServer>,
    agents: Record<string, Agent>,
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
        const stripped = stripScope(value);
        existing.mcp[key] = {
          type: stripped.transport === "sse" || stripped.transport === "http" ? "remote" : "local",
          command: [stripped.command, ...(stripped.args || [])],
          environment: stripped.env || {},
          enabled: true,
        };
      }
    }

    if (Object.keys(agents).length > 0) {
      existing.agent = existing.agent || {};
      for (const [key, value] of Object.entries(agents)) {
        const agent = stripScope(value);
        existing.agent[key] = {
          name: agent.name,
          description: agent.description,
          prompt: agent.prompt,
          model: agent.model,
        };
      }
    }

    await fs.writeFile(configPath, JSON.stringify(existing, null, 2), "utf-8");
  }

  private async writeSkillsToDir(
    baseDir: string,
    skills: Record<string, Skill>,
  ): Promise<void> {
    for (const [key, skill] of Object.entries(skills)) {
      assertSafeResourceName(key, "skill");
      const skillDir = path.join(baseDir, key);
      await fs.mkdir(skillDir, { recursive: true }).catch(() => {});

      const fm: Record<string, unknown> = { name: skill.name };
      if (skill.description) fm.description = skill.description;
      if (skill.trigger) fm.trigger = skill.trigger;

      const content = serializeFrontmatter(fm, skill.content);
      await fs.writeFile(path.join(skillDir, "SKILL.md"), content + "\n", "utf-8");
    }
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
