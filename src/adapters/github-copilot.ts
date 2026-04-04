import fs from "fs/promises";
import path from "path";
import type { ClientAdapter, McpServer, Agent, Skill, ResourceScope } from "../types.js";
import { parseFrontmatter } from "../frontmatter.js";
import {
  firstExistingPath,
  firstExistingScopedPath,
  homeDir,
  scopeOf,
  vscodeCopilotDetectCandidates,
  vscodeUserMcpJsonCandidates,
  vscodeUserSettingsCandidates,
} from "../platform-paths.js";
import { splitByScope } from "../scopes.js";
import { atomicWriteFile } from "../fs-utils.js";
import { toArray, toBool } from "../coerce.js";

type CandidateScope = "global" | "user" | "project";

function toCandidateScope(scope: string): CandidateScope {
  if (scope === "project") return "project";
  if (scope === "user") return "user";
  return "global";
}

function scopeWeight(scope: CandidateScope): number {
  if (scope === "global") return 0;
  if (scope === "user") return 1;
  return 2;
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

function mergeMcpsFromSettingsJson(parsed: Record<string, unknown>, into: Record<string, McpServer>, scope: CandidateScope) {
  const mcpServers = (parsed["mcp.servers"] as Record<string, any>) || {};
  for (const [key, val] of Object.entries(mcpServers)) {
    if (!val || typeof val !== "object") continue;
    // Support remote MCPs (url-based) alongside stdio MCPs
    if (val.url) {
      into[key] = {
        command: val.command || "",
        args: toArray(val.args),
        env: val.env,
        url: val.url,
        transport: val.type || "http",
        headers: val.requestInit?.headers || val.headers,
        scope,
      };
    } else if (typeof val.command === "string") {
      into[key] = { command: val.command, args: toArray(val.args), env: val.env, scope };
    }
  }
}

function mergeMcpsFromMcpJson(parsed: Record<string, unknown>, into: Record<string, McpServer>, scope: CandidateScope) {
  const servers = (parsed.servers as Record<string, any>) || {};
  for (const [key, val] of Object.entries(servers)) {
    if (!val || typeof val !== "object") continue;
    // Support remote MCPs (url-based) alongside stdio MCPs
    if (val.url) {
      into[key] = {
        command: val.command || "",
        args: toArray(val.args),
        env: val.env,
        url: val.url,
        transport: val.type || "http",
        headers: val.requestInit?.headers || val.headers,
        scope,
      };
    } else if (typeof val.command === "string") {
      into[key] = { command: val.command, args: toArray(val.args), env: val.env, scope };
    }
  }
}

function mcpToVscodeFormat(m: McpServer): Record<string, unknown> {
  if (m.url) {
    // Remote MCP server
    const entry: Record<string, unknown> = {
      url: m.url,
      type: m.transport || "http",
    };
    if (m.headers && Object.keys(m.headers).length > 0) {
      entry.requestInit = { headers: m.headers };
    }
    return entry;
  }
  // Stdio MCP server
  return {
    type: "stdio",
    command: m.command,
    args: m.args || [],
    ...(m.env && Object.keys(m.env).length > 0 ? { env: m.env } : {}),
  };
}

function mcpsToVscodeFormat(mcps: Record<string, McpServer>): Record<string, unknown> {
  const servers: Record<string, unknown> = {};
  for (const [key, m] of Object.entries(mcps || {})) {
    servers[key] = mcpToVscodeFormat(m);
  }
  return servers;
}

export class GithubCopilotAdapter implements ClientAdapter {
  id = "github-copilot";
  name = "Github Copilot";

  // Agent/Skill directories (project-scoped)
  private get projectAgentsDir() { return path.join(process.cwd(), ".github", "agents"); }
  private get projectSkillsDir() { return path.join(process.cwd(), ".github", "skills"); }

  async detect(): Promise<boolean> {
    return (await firstExistingPath(vscodeCopilotDetectCandidates(homeDir()))) !== null;
  }

  private async resolvedWriteTarget(): Promise<{ file: string; kind: "settings" | "mcpjson" }> {
    const h = homeDir();
    const settings = vscodeUserSettingsCandidates(h).map((entry) => entry.path);
    const mcp = vscodeUserMcpJsonCandidates(h).map((entry) => entry.path);
    const existingSettings = await firstExistingPath(settings);
    if (existingSettings) return { file: existingSettings, kind: "settings" };
    const existingMcp = await firstExistingPath(mcp);
    if (existingMcp) return { file: existingMcp, kind: "mcpjson" };
    return { file: settings[0] ?? mcp[0] ?? path.join(process.cwd(), ".vscode", "settings.json"), kind: "settings" };
  }

  private async projectWriteTarget(): Promise<string> {
    const h = homeDir();
    const candidates = vscodeUserMcpJsonCandidates(h).filter((candidate) => candidate.scope === "project");
    const first = await firstExistingScopedPath(candidates);
    return first?.path ?? path.join(process.cwd(), ".vscode", "mcp.json");
  }

  async read(): Promise<{ mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill> }> {
    const result = { mcps: {} as Record<string, McpServer>, agents: {} as Record<string, Agent>, skills: {} as Record<string, Skill> };
    const h = homeDir();
    const candidates = [
      ...vscodeUserSettingsCandidates(h),
      ...vscodeUserMcpJsonCandidates(h),
    ].sort((a, b) => scopeWeight(toCandidateScope(scopeOf(a))) - scopeWeight(toCandidateScope(scopeOf(b))));

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(await fs.readFile(candidate.path, "utf-8")) as Record<string, unknown>;
        const scope = toCandidateScope(scopeOf(candidate));
        if (candidate.path.endsWith("settings.json")) {
          mergeMcpsFromSettingsJson(parsed, result.mcps, scope);
        } else {
          mergeMcpsFromMcpJson(parsed, result.mcps, scope);
        }
      } catch {
        /* missing or invalid */
      }
    }

    for (const [name, mcp] of Object.entries(result.mcps)) {
      if (!mcp.scope) {
        result.mcps[name] = { ...mcp, scope: "global" };
      }
    }

    // Read agents from .github/agents/*.md
    await this.readAgentsFromDir(this.projectAgentsDir, "project", result.agents);

    // Read skills from .github/skills/<name>/SKILL.md
    await this.readSkillsFromDir(this.projectSkillsDir, "project", result.skills);

    return result;
  }

  async write(resources: { mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill> }): Promise<void> {
    const { project, user, global } = splitByScope(resources.mcps);
    const nonProject = { ...user, ...global };

    if (Object.keys(project).length > 0) {
      const configPath = await this.projectWriteTarget();
      await this.writeMcpCollection(configPath, "mcpjson", project);
    }

    const { file: userTarget, kind } = await this.resolvedWriteTarget();
    await this.writeMcpCollection(userTarget, kind, nonProject);
  }

  private async writeMcpCollection(
    configPath: string,
    kind: "settings" | "mcpjson",
    mcps: Record<string, McpServer>
  ): Promise<void> {
    const dir = path.dirname(configPath);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});

    let existing: Record<string, unknown> = {};
    try {
      existing = JSON.parse(await fs.readFile(configPath, "utf-8")) as Record<string, unknown>;
    } catch {
      /* new file */
    }

    const formatted = mcpsToVscodeFormat(mcps);
    if (kind === "settings") {
      existing["mcp.servers"] = formatted;
    } else {
      existing.servers = formatted;
    }

    await atomicWriteFile(configPath, JSON.stringify(existing, null, 2));
  }

  getMemoryFileName(): string { return ".github/copilot-instructions.md"; }
  async readMemory(projectDir: string): Promise<string | null> {
    try { return await fs.readFile(path.join(projectDir, this.getMemoryFileName()), "utf-8"); } catch { return null; }
  }
  async writeMemory(projectDir: string, content: string): Promise<void> {
    const filePath = path.join(projectDir, this.getMemoryFileName());
    await fs.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {});
    await atomicWriteFile(filePath, content);
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
        tools: toArray(data.tools),
        mcpServers: Array.isArray(data["mcp-servers"]) ? data["mcp-servers"] : (typeof data["mcp-servers"] === "object" && data["mcp-servers"] ? data["mcp-servers"] : undefined),
        userInvocable: toBool(data["user-invocable"]),
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
            allowedTools: toArray(data["allowed-tools"]),
            model: data.model,
            effort: data.effort,
            context: toArray(data.context),
            agent: data.agent,
            hooks: data.hooks,
            scope,
          };
        }
      }
    }
  }
}
