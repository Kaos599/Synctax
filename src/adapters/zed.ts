import fs from "fs/promises";
import path from "path";
import os from "os";
import { ClientAdapter, McpServer, Agent, Skill, Permissions, Models, Prompts, Credentials } from "../types.js";

export class ZedAdapter implements ClientAdapter {
  id = "zed";
  name = "Zed";

  private get configPath() {
    return path.join(process.env.SYNCTAX_HOME || os.homedir(), ".config", "zed", "settings.json");
  }

  async detect(): Promise<boolean> {
    try { await fs.access(this.configPath); return true; } catch { return false; }
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
      const data = await fs.readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(data);
      const mcpServers = parsed.context_servers || {};
      for (const [key, val] of Object.entries<any>(mcpServers)) {
        result.mcps[key] = { command: val.command, args: val.args, env: val.env };
      }
    } catch (e: any) {}

    return result;
  }

  async write(resources: { mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>, permissions?: Permissions, models?: Models, prompts?: Prompts, credentials?: Credentials }): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});

    let existing: any = {};
    try { existing = JSON.parse(await fs.readFile(this.configPath, "utf-8")); } catch (e) {}

    existing.context_servers = resources.mcps || {};
    await fs.writeFile(this.configPath, JSON.stringify(existing, null, 2), "utf-8");
  }

  getMemoryFileName(): string { return ".rules"; }
  async readMemory(projectDir: string): Promise<string | null> {
    try { return await fs.readFile(path.join(projectDir, this.getMemoryFileName()), "utf-8"); } catch { return null; }
  }
  async writeMemory(projectDir: string, content: string): Promise<void> {
    await fs.writeFile(path.join(projectDir, this.getMemoryFileName()), content, "utf-8");
  }
}
