import fs from "fs/promises";
import path from "path";
import type { ClientAdapter, McpServer, Agent, Skill } from "../types.js";
import {
  firstExistingPath,
  firstExistingScopedPath,
  homeDir,
  vscodeCopilotDetectCandidates,
  vscodeUserMcpJsonCandidates,
  vscodeUserSettingsCandidates,
} from "../platform-paths.js";
import { splitByScope } from "../scopes.js";

type CandidateScope = "global" | "user" | "project";

function scopeWeight(scope: CandidateScope): number {
  if (scope === "global") return 0;
  if (scope === "user") return 1;
  return 2;
}

function mergeMcpsFromSettingsJson(parsed: Record<string, unknown>, into: Record<string, McpServer>, scope: CandidateScope) {
  const mcpServers = (parsed["mcp.servers"] as Record<string, any>) || {};
  for (const [key, val] of Object.entries(mcpServers)) {
    if (!val || typeof val !== "object" || typeof val.command !== "string") continue;
    into[key] = { command: val.command, args: val.args, env: val.env, scope };
  }
}

function mergeMcpsFromMcpJson(parsed: Record<string, unknown>, into: Record<string, McpServer>, scope: CandidateScope) {
  const servers = (parsed.servers as Record<string, any>) || {};
  for (const [key, val] of Object.entries(servers)) {
    if (val && typeof val === "object" && typeof val.command === "string") {
      into[key] = { command: val.command, args: val.args, env: val.env, scope };
    }
  }
}

function mcpsToVscodeMcpJsonServers(mcps: Record<string, McpServer>): Record<string, unknown> {
  const servers: Record<string, unknown> = {};
  for (const [key, m] of Object.entries(mcps || {})) {
    servers[key] = {
      type: "stdio",
      command: m.command,
      args: m.args || [],
      ...(m.env && Object.keys(m.env).length > 0 ? { env: m.env } : {}),
    };
  }
  return servers;
}

export class GithubCopilotAdapter implements ClientAdapter {
  id = "github-copilot";
  name = "Github Copilot";

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
    ].sort((a, b) => scopeWeight(a.scope) - scopeWeight(b.scope));

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(await fs.readFile(candidate.path, "utf-8")) as Record<string, unknown>;
        if (candidate.path.endsWith("settings.json")) {
          mergeMcpsFromSettingsJson(parsed, result.mcps, candidate.scope);
        } else {
          mergeMcpsFromMcpJson(parsed, result.mcps, candidate.scope);
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

    if (kind === "settings") {
      existing["mcp.servers"] = mcps;
    } else {
      existing.servers = mcpsToVscodeMcpJsonServers(mcps);
    }

    await fs.writeFile(configPath, JSON.stringify(existing, null, 2), "utf-8");
  }

  getMemoryFileName(): string { return ".github/copilot-instructions.md"; }
  async readMemory(projectDir: string): Promise<string | null> {
    try { return await fs.readFile(path.join(projectDir, this.getMemoryFileName()), "utf-8"); } catch { return null; }
  }
  async writeMemory(projectDir: string, content: string): Promise<void> {
    const filePath = path.join(projectDir, this.getMemoryFileName());
    await fs.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {});
    await fs.writeFile(filePath, content, "utf-8");
  }
}
