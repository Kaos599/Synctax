import fs from "fs/promises";
import path from "path";
import { ClientAdapter, McpServer, Agent, Skill, Permissions, Models, Prompts, Credentials, ResourceScope } from "../types.js";
import {
  firstExistingPath,
  firstExistingScopedPath,
  homeDir,
  xdgStyleConfigCandidates,
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

function configCandidates() {
  const h = homeDir();
  return [
    ...xdgStyleConfigCandidates("github-copilot-cli", "config.json", h),
    ...xdgStyleConfigCandidates("copilot", "config.json", h),
    { path: path.join(process.cwd(), ".github", "copilot", "config.json"), scope: "project" as const, label: "project copilot-cli config" },
  ];
}

export class GithubCopilotCliAdapter implements ClientAdapter {
  id = "github-copilot-cli";
  name = "Github Copilot CLI";

  private async detectConfigPath(scope: "project" | "user" | "global"): Promise<string | undefined> {
    const candidates = configCandidates().filter((entry) => entry.scope === scope);
    const first = await firstExistingScopedPath(candidates);
    return first?.path ?? candidates[0]?.path;
  }

  async detect(): Promise<boolean> {
    return (await firstExistingPath(configCandidates().map((entry) => entry.path))) !== null;
  }

  async read(): Promise<{ mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill> }> {
    const result = { mcps: {} as Record<string, McpServer>, agents: {} as Record<string, Agent>, skills: {} as Record<string, Skill> };

    for (const candidate of configCandidates().sort((a, b) => scopeWeight(a.scope) - scopeWeight(b.scope))) {
      try {
        const data = await fs.readFile(candidate.path, "utf-8");
        const parsed = JSON.parse(data);
        const skills = parsed.aliases || {};
        for (const [key, val] of Object.entries<any>(skills)) {
          result.skills[key] = { name: key, content: val, scope: candidate.scope };
        }
      } catch {
        /* invalid */
      }
    }

    return result;
  }

  async write(resources: { mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill> }): Promise<void> {
    const { project, user, global } = splitByScope(resources.skills);

    const projectPath = await this.detectConfigPath("project");
    if (projectPath && Object.keys(project).length > 0) {
      const existingProject = await this.readAliases(projectPath);
      const mergedProject = { ...existingProject };
      for (const [key, value] of Object.entries(project)) {
        mergedProject[key] = stripScope(value).content ?? "";
      }
      await this.writeAliases(projectPath, mergedProject);
    }

    const userPath = await this.detectConfigPath("user");
    const globalPath = await this.detectConfigPath("global");
    const target = userPath ?? globalPath;
    if (target && (Object.keys(user).length > 0 || Object.keys(global).length > 0)) {
      const existing = await this.readAliases(target);
      const merged = { ...existing };
      for (const [key, value] of Object.entries({ ...global, ...user })) {
        merged[key] = stripScope(value).content ?? "";
      }
      await this.writeAliases(target, merged);
    }
  }

  private async readAliases(configPath: string): Promise<Record<string, string>> {
    try {
      const data = await fs.readFile(configPath, "utf-8");
      const parsed = JSON.parse(data);
      const aliases = parsed.aliases || {};
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries<any>(aliases)) {
        if (typeof value === "string") out[key] = value;
      }
      return out;
    } catch {
      return {};
    }
  }

  private async writeAliases(configPath: string, aliases: Record<string, string>): Promise<void> {
    const dir = path.dirname(configPath);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});
    let existing: any = {};
    try {
      existing = JSON.parse(await fs.readFile(configPath, "utf-8"));
    } catch {
      /* new file */
    }
    existing.aliases = aliases;
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
