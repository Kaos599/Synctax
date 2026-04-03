import fs from "fs/promises";
import path from "path";
import type { ClientAdapter, McpServer, Agent, Skill, Permissions, Models, Prompts, Credentials, ResourceScope } from "../types.js";
import { firstExistingPath, homeDir, zedSettingsCandidates } from "../platform-paths.js";
import { atomicWriteFile } from "../fs-utils.js";
import { toArray } from "../coerce.js";

function stripScope<T extends { scope?: ResourceScope }>(item: T): Omit<T, "scope"> {
  const { scope: _scope, ...rest } = item;
  return rest;
}

export class ZedAdapter implements ClientAdapter {
  id = "zed";
  name = "Zed";

  private configCandidates(): string[] {
    return zedSettingsCandidates(homeDir());
  }

  private async resolvedConfigPath(): Promise<string> {
    const c = this.configCandidates();
    const fallback = c[0];
    if (fallback === undefined) throw new Error("ZedAdapter: no config path candidates");
    return (await firstExistingPath(c)) ?? fallback;
  }

  async detect(): Promise<boolean> {
    return (await firstExistingPath(this.configCandidates())) !== null;
  }

  async read(): Promise<{
    mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>,
    permissions?: Permissions, models?: Models, prompts?: Prompts, credentials?: Credentials
  }> {
    const result = {
      mcps: {} as Record<string, McpServer>,
      agents: {} as Record<string, Agent>,
      skills: {} as Record<string, Skill>
    };

    try {
      const configPath = await this.resolvedConfigPath();
      const data = await fs.readFile(configPath, "utf-8");
      const parsed = JSON.parse(data);
      const mcpServers = parsed.context_servers || {};
      for (const [key, val] of Object.entries<any>(mcpServers)) {
        result.mcps[key] = { command: val.command, args: toArray(val.args), env: val.env };
      }
    } catch (e: any) {}

    return result;
  }

  async write(resources: { mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>, permissions?: Permissions, models?: Models, prompts?: Prompts, credentials?: Credentials }): Promise<void> {
    const configPath = await this.resolvedConfigPath();
    const dir = path.dirname(configPath);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});

    let existing: any = {};
    try { existing = JSON.parse(await fs.readFile(configPath, "utf-8")); } catch (e) {}

    existing.context_servers = existing.context_servers || {};
    for (const [key, value] of Object.entries(resources.mcps || {})) {
      existing.context_servers[key] = stripScope(value);
    }
    await atomicWriteFile(configPath, JSON.stringify(existing, null, 2));
  }

  getMemoryFileName(): string { return ".rules"; }
  async readMemory(projectDir: string): Promise<string | null> {
    try { return await fs.readFile(path.join(projectDir, this.getMemoryFileName()), "utf-8"); } catch { return null; }
  }
  async writeMemory(projectDir: string, content: string): Promise<void> {
    await atomicWriteFile(path.join(projectDir, this.getMemoryFileName()), content);
  }
}
