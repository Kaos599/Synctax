import fs from "fs/promises";
import path from "path";
import os from "os";
import { ClientAdapter, McpServer, Agent, Skill, Permissions, Models, Prompts, Credentials } from "../types.js";

export class GeminiCliAdapter implements ClientAdapter {
  id = "gemini-cli";
  name = "Gemini CLI";

  private get configPath() {
    return path.join(process.env.SYNCTAX_HOME || os.homedir(), ".config", "gemini", "config.json");
  }

  async detect(): Promise<boolean> {
    try { await fs.access(this.configPath); return true; } catch { return false; }
  }

  async read(): Promise<{ mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>, models?: Models, prompts?: Prompts }> {
    const result = { mcps: {} as Record<string, McpServer>, agents: {} as Record<string, Agent>, skills: {} as Record<string, Skill>, models: {} as Models, prompts: {} as Prompts };
    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed.model) result.models!.defaultModel = parsed.model;
      if (parsed.systemInstruction) result.prompts!.globalSystemPrompt = parsed.systemInstruction;
    } catch (e: any) {}
    return result;
  }

  async write(resources: { mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>, models?: Models, prompts?: Prompts }): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});

    let existing: any = {};
    try { existing = JSON.parse(await fs.readFile(this.configPath, "utf-8")); } catch (e) {}

    if (resources.models?.defaultModel) existing.model = resources.models.defaultModel;
    if (resources.prompts?.globalSystemPrompt) existing.systemInstruction = resources.prompts.globalSystemPrompt;

    await fs.writeFile(this.configPath, JSON.stringify(existing, null, 2), "utf-8");
  }

  getMemoryFileName(): string { return ".geminirules"; }
  async readMemory(projectDir: string): Promise<string | null> {
    try { return await fs.readFile(path.join(projectDir, this.getMemoryFileName()), "utf-8"); } catch { return null; }
  }
  async writeMemory(projectDir: string, content: string): Promise<void> {
    await fs.writeFile(path.join(projectDir, this.getMemoryFileName()), content, "utf-8");
  }
}
