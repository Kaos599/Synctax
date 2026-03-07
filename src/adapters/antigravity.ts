import fs from "fs/promises";
import path from "path";
import os from "os";
import { ClientAdapter, McpServer, Agent, Skill } from "../types.js";

import { Permissions, Models, Prompts, Credentials } from "../types.js";
export class AntigravityAdapter implements ClientAdapter {
  id = "antigravity";
  name = "Antigravity";

  private get configPath() {
    const homeDir = process.env.SYNCTAX_HOME || os.homedir();
    return path.join(homeDir, ".config", "antigravity", "config.json");
  }

  async detect(): Promise<boolean> {
    try { await fs.access(this.configPath); return true; } catch { return false; }
  }

  async read(): Promise<{ mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>, permissions?: Permissions, models?: Models, prompts?: Prompts, credentials?: Credentials }> {
    const result = {
      mcps: {} as Record<string, McpServer>,
      agents: {} as Record<string, Agent>,
      skills: {} as Record<string, Skill>
    };

    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(data);

      const mcpServers = parsed.mcpServers || {};
      for (const [key, val] of Object.entries<any>(mcpServers)) {
        result.mcps[key] = { command: val.command, args: val.args, env: val.env };
      }

      const agents = parsed.agents || {};
      for (const [key, val] of Object.entries<any>(agents)) {
        result.agents[key] = { name: val.name || key, description: val.description, prompt: val.prompt || "", model: val.model };
      }

      const skills = parsed.skills || {};
      for (const [key, val] of Object.entries<any>(skills)) {
        result.skills[key] = { name: val.name || key, description: val.description, content: val.content || "", trigger: val.trigger };
      }
    } catch (e: any) {}

    return result;
  }

  async write(resources: { mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>, permissions?: Permissions, models?: Models, prompts?: Prompts, credentials?: Credentials }): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});

    let existing: any = {};
    try { existing = JSON.parse(await fs.readFile(this.configPath, "utf-8")); } catch (e) {}

    existing.mcpServers = resources.mcps || {};

    if (Object.keys(resources.agents || {}).length > 0) {
      existing.agents = existing.agents || {};
      for (const [key, agent] of Object.entries(resources.agents || {})) {
        existing.agents[key] = { name: agent.name, description: agent.description, prompt: agent.prompt, model: agent.model };
      }
    }

    if (Object.keys(resources.skills || {}).length > 0) {
      existing.skills = existing.skills || {};
      for (const [key, skill] of Object.entries(resources.skills || {})) {
        existing.skills[key] = { name: skill.name, description: skill.description, content: skill.content, trigger: skill.trigger };
      }
    }

    await fs.writeFile(this.configPath, JSON.stringify(existing, null, 2), "utf-8");
  }

  getMemoryFileName(): string { return ".antigravityrules"; }
  async readMemory(projectDir: string): Promise<string | null> {
    try { return await fs.readFile(path.join(projectDir, this.getMemoryFileName()), "utf-8"); } catch { return null; }
  }
  async writeMemory(projectDir: string, content: string): Promise<void> {
    await fs.writeFile(path.join(projectDir, this.getMemoryFileName()), content, "utf-8");
  }
}
