import fs from "fs/promises";
import path from "path";
import type { ClientAdapter, McpServer, Agent, Skill, Permissions, Models, Prompts, Credentials, ResourceScope } from "../types.js";
import type { ConfigScope } from "../platform-paths.js";
import {
  antigravityConfigCandidates,
  antigravityInstallDirsDetected,
  firstExistingPath,
  homeDir,
  firstExistingScopedPath,
} from "../platform-paths.js";
import { splitByScope } from "../scopes.js";
import { parseFrontmatter, serializeFrontmatter } from "../frontmatter.js";
import { assertSafeResourceName } from "../resource-name.js";
import { atomicWriteFile } from "../fs-utils.js";
import { toArray } from "../coerce.js";

function scopeWeight(scope: ConfigScope): number {
  if (scope === "global") return 0;
  if (scope === "user") return 1;
  return 2;
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

function mcpToAntigravityFormat(value: McpServer): Record<string, unknown> | null {
  const command = typeof value.command === "string" ? value.command.trim() : "";
  if (!command) return null;

  const out: Record<string, unknown> = { command };
  if (value.args && value.args.length > 0) out.args = value.args;
  if (value.env && Object.keys(value.env).length > 0) out.env = value.env;
  return out;
}

async function readJsonSafe(p: string): Promise<any> {
  try { return JSON.parse(await fs.readFile(p, "utf-8")); } catch { return {}; }
}

function mergeMcpServers(parsed: Record<string, any>, into: Record<string, McpServer>, scope: ConfigScope) {
  const mcpServers = parsed.mcpServers || {};
  for (const [key, val] of Object.entries<any>(mcpServers)) {
    if (val && typeof val === "object" && typeof val.command === "string") {
      into[key] = { command: val.command, args: toArray(val.args), env: val.env, scope };
    }
  }

  const servers = parsed.servers || {};
  for (const [key, val] of Object.entries<any>(servers)) {
    if (val && typeof val === "object" && typeof val.command === "string") {
      into[key] = { command: val.command, args: toArray(val.args), env: val.env, scope };
    }
  }
}

export class AntigravityAdapter implements ClientAdapter {
  id = "antigravity";
  name = "Antigravity";

  private get home() { return homeDir(); }

  // --- Skill directories ---
  private get userSkillsDir() { return path.join(this.home, ".gemini", "antigravity", "skills"); }
  private get projectSkillsDir() { return path.join(process.cwd(), ".agents", "skills"); }

  // --- Agent file locations (instruction files, not JSON) ---
  private get projectAgentFiles(): string[] {
    return [
      path.join(process.cwd(), "GEMINI.md"),
      path.join(process.cwd(), "AGENTS.md"),
    ];
  }
  private get projectAgentRulesDir(): string {
    return path.join(process.cwd(), ".agent", "rules");
  }

  private configCandidates() {
    return antigravityConfigCandidates(homeDir());
  }

  private async resolvedMcpConfigPath(): Promise<string> {
    // Prefer the gemini-antigravity path for writing MCPs
    const candidates = this.configCandidates();
    const existing = await firstExistingScopedPath(candidates);
    if (existing) return existing.path;
    // Default to the first candidate (gemini-antigravity mcp_config.json)
    return candidates[0]?.path ?? path.join(this.home, ".gemini", "antigravity", "mcp_config.json");
  }

  async detect(): Promise<boolean> {
    // Check for MCP config files
    if ((await firstExistingPath(this.configCandidates().map((entry) => entry.path))) !== null) return true;
    // Check for agent instruction files in project
    for (const agentFile of this.projectAgentFiles) {
      if (await fileExists(agentFile)) return true;
    }
    // Check for .agent/rules directory
    if (await fileExists(this.projectAgentRulesDir)) return true;
    // Check for skill directories
    if (await fileExists(this.userSkillsDir)) return true;
    if (await fileExists(this.projectSkillsDir)) return true;
    // Legacy install dir check
    return await antigravityInstallDirsDetected(homeDir());
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
    } = {
      mcps: {},
      agents: {},
      skills: {},
    };

    // --- Read MCPs from config candidates (sorted by scope weight: global first) ---
    const candidates = this.configCandidates().sort((a, b) => scopeWeight(a.scope) - scopeWeight(b.scope));
    for (const candidate of candidates) {
      try {
        const data = await fs.readFile(candidate.path, "utf-8");
        const parsed = JSON.parse(data);
        mergeMcpServers(parsed, result.mcps, candidate.scope);
      } catch {
        /* invalid json or missing file */
      }
    }

    // --- Read agents from instruction files (project scope) ---
    // GEMINI.md
    await this.readAgentFile(
      path.join(process.cwd(), "GEMINI.md"),
      "gemini",
      "project",
      result.agents
    );
    // AGENTS.md
    await this.readAgentFile(
      path.join(process.cwd(), "AGENTS.md"),
      "agents",
      "project",
      result.agents
    );
    // .agent/rules/*.md
    await this.readAgentsFromDir(this.projectAgentRulesDir, "project", result.agents);

    // --- Read skills from SKILL.md files ---
    await this.readSkillsFromDir(this.userSkillsDir, "user", result.skills);
    await this.readSkillsFromDir(this.projectSkillsDir, "project", result.skills);

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
    // --- Write MCPs to config JSON ---
    const { user: userMcps, global: globalMcps, project: projectMcps } = splitByScope(resources.mcps);
    const toWriteMcps = { ...globalMcps, ...userMcps, ...projectMcps };

    if (Object.keys(toWriteMcps).length > 0) {
      const configPath = await this.resolvedMcpConfigPath();
      const dir = path.dirname(configPath);
      await fs.mkdir(dir, { recursive: true }).catch(() => {});

      const existing = await readJsonSafe(configPath);
      existing.mcpServers = existing.mcpServers || {};
      for (const [key, value] of Object.entries(toWriteMcps)) {
        const formatted = mcpToAntigravityFormat(value);
        if (!formatted) continue;
        existing.mcpServers[key] = formatted;
      }
      await atomicWriteFile(configPath, JSON.stringify(existing, null, 2));
    }

    // --- Write agents as instruction markdown files ---
    if (Object.keys(resources.agents || {}).length > 0) {
      const rulesDir = this.projectAgentRulesDir;
      await fs.mkdir(rulesDir, { recursive: true }).catch(() => {});

      for (const [key, agent] of Object.entries(resources.agents || {})) {
        assertSafeResourceName(key, "agent");
        const fm: Record<string, unknown> = { name: agent.name };
        if (agent.description) fm.description = agent.description;
        if (agent.model) fm.model = agent.model;
        if (agent.tools) fm.tools = agent.tools;

        const content = serializeFrontmatter(fm, agent.prompt);
        await atomicWriteFile(path.join(rulesDir, `${key}.md`), content + "\n");
      }
    }

    // --- Write skills as SKILL.md files ---
    if (Object.keys(resources.skills || {}).length > 0) {
      for (const [key, skill] of Object.entries(resources.skills || {})) {
        assertSafeResourceName(key, "skill");
        const scope = skill.scope || "user";
        const baseDir = (scope === "project" || scope === "local")
          ? this.projectSkillsDir
          : this.userSkillsDir;
        const skillDir = path.join(baseDir, key);
        await fs.mkdir(skillDir, { recursive: true }).catch(() => {});

        const fm: Record<string, unknown> = { name: skill.name };
        if (skill.description) fm.description = skill.description;
        if (skill.trigger) fm.trigger = skill.trigger;

        const content = serializeFrontmatter(fm, skill.content);
        await atomicWriteFile(path.join(skillDir, "SKILL.md"), content + "\n");
      }
    }
  }

  // --- Memory ---
  getMemoryFileName(): string { return "GEMINI.md"; }

  async readMemory(projectDir: string): Promise<string | null> {
    try { return await fs.readFile(path.join(projectDir, this.getMemoryFileName()), "utf-8"); } catch { return null; }
  }

  async writeMemory(projectDir: string, content: string): Promise<void> {
    await atomicWriteFile(path.join(projectDir, this.getMemoryFileName()), content);
  }

  // --- Private helpers ---

  private async readAgentFile(
    filePath: string,
    key: string,
    scope: ResourceScope,
    target: Record<string, Agent>
  ): Promise<void> {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const { data, content } = parseFrontmatter<Record<string, any>>(raw);
      target[key] = {
        name: data.name || key,
        description: data.description,
        prompt: content,
        model: data.model,
        tools: toArray(data.tools),
        scope,
      };
    } catch {
      /* file not found or unreadable */
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
            scope,
          };
        }
      }
    }
  }
}
