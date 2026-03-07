import fs from "fs/promises";
import path from "path";
import os from "os";
import { ClientAdapter, McpServer, Agent, Skill, Permissions, Models, Prompts, Credentials } from "../types.js";

export class GithubCopilotCliAdapter implements ClientAdapter {
  id = "github-copilot-cli";
  name = "Github Copilot CLI";

  private get configPath() {
    return path.join(process.env.SYNCTAX_HOME || os.homedir(), ".config", "github-copilot-cli", "config.json");
  }

  async detect(): Promise<boolean> {
    try { await fs.access(this.configPath); return true; } catch { return false; }
  }

  async read(): Promise<{ mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill> }> {
    const result = { mcps: {} as Record<string, McpServer>, agents: {} as Record<string, Agent>, skills: {} as Record<string, Skill> };
    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(data);
      const skills = parsed.aliases || {};
      for (const [key, val] of Object.entries<any>(skills)) {
        result.skills[key] = { name: key, content: val };
      }
    } catch (e: any) {}
    return result;
  }

  async write(resources: { mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill> }): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});

    let existing: any = {};
    try { existing = JSON.parse(await fs.readFile(this.configPath, "utf-8")); } catch (e) {}

    existing.aliases = {};
    if (resources.skills) {
      for (const [key, skill] of Object.entries(resources.skills)) {
        existing.aliases[key] = skill.content;
      }
    }
    await fs.writeFile(this.configPath, JSON.stringify(existing, null, 2), "utf-8");
  }

  getMemoryFileName(): string { return ".github/copilot-instructions.md"; } // Reusing copilot instructions
  async readMemory(projectDir: string): Promise<string | null> {
    try { return await fs.readFile(path.join(projectDir, this.getMemoryFileName()), "utf-8"); } catch { return null; }
  }
  async writeMemory(projectDir: string, content: string): Promise<void> {
    const filePath = path.join(projectDir, this.getMemoryFileName());
    await fs.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {});
    await fs.writeFile(filePath, content, "utf-8");
  }
}
