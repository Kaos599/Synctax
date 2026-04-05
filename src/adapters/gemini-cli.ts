import fs from "fs/promises";
import path from "path";
import type { ClientAdapter, McpServer, Agent, Skill, Permissions, Models, Prompts, Credentials } from "../types.js";
import { firstExistingPath, homeDir, firstExistingScopedPath } from "../platform-paths.js";
import type { ConfigScope } from "../platform-paths.js";
import { atomicWriteFile } from "../fs-utils.js";

function scopeWeight(scope: ConfigScope): number {
  if (scope === "global") return 0;
  if (scope === "user") return 1;
  return 2;
}

function configCandidates(h = homeDir()) {
  const projectRoot = process.cwd();
  return [
    { path: path.join(projectRoot, ".gemini", "settings.json"), scope: "project" as const, label: "project gemini settings" },
    { path: path.join(h, ".gemini", "settings.json"), scope: "user" as const, label: "user gemini settings" },
    { path: path.join(h, ".config", "gemini", "config.json"), scope: "user" as const, label: "legacy gemini config" },
    { path: path.join(h, ".gemini", "config.json"), scope: "user" as const, label: "legacy gemini config root" },
  ];
}

function writeGeminiTo(configPath: string, resources: { models?: Models; prompts?: Prompts }) {
  return fs.readFile(configPath, "utf-8")
    .then((data) => JSON.parse(data) as Record<string, any>)
    .catch(() => ({} as Record<string, any>))
    .then(async (existing) => {
      if (resources.models?.defaultModel) existing.model = resources.models.defaultModel;
      if (resources.prompts?.globalSystemPrompt) existing.systemInstruction = resources.prompts.globalSystemPrompt;
      const dir = path.dirname(configPath);
      await fs.mkdir(dir, { recursive: true }).catch(() => {});
      await atomicWriteFile(configPath, JSON.stringify(existing, null, 2));
    });
}

export class GeminiCliAdapter implements ClientAdapter {
  id = "gemini-cli";
  name = "Gemini CLI";

  private candidates() {
    return configCandidates(homeDir());
  }

  private async resolvedConfigPath(): Promise<string> {
    const c = this.candidates();
    const found = await firstExistingScopedPath(c);
    return found?.path ?? c[0]?.path ?? path.join(process.cwd(), ".gemini", "settings.json");
  }

  async detect(): Promise<boolean> {
    const paths = this.candidates().map((entry) => entry.path);
    return (await firstExistingPath(paths)) !== null;
  }

  async read(): Promise<{ mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>, models?: Models, prompts?: Prompts }> {
    const result = { mcps: {} as Record<string, McpServer>, agents: {} as Record<string, Agent>, skills: {} as Record<string, Skill>, models: {} as Models, prompts: {} as Prompts };
    for (const candidate of this.candidates().sort((a, b) => scopeWeight(a.scope) - scopeWeight(b.scope))) {
      try {
        const data = await fs.readFile(candidate.path, "utf-8");
        const parsed = JSON.parse(data);
        if (parsed.model) {
          result.models!.defaultModel = parsed.model;
        }
        if (parsed.systemInstruction) {
          result.prompts!.globalSystemPrompt = parsed.systemInstruction;
        }
      } catch {
        /* missing or invalid */
      }
    }
    return result;
  }

  async write(resources: { mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>, models?: Models, prompts?: Prompts }): Promise<void> {
    const configPath = await this.resolvedConfigPath();
    await writeGeminiTo(configPath, resources);
  }

  getMemoryFileName(): string { return ".geminirules"; }
  async readMemory(projectDir: string): Promise<string | null> {
    try { return await fs.readFile(path.join(projectDir, this.getMemoryFileName()), "utf-8"); } catch { return null; }
  }
  async writeMemory(projectDir: string, content: string): Promise<void> {
    await atomicWriteFile(path.join(projectDir, this.getMemoryFileName()), content);
  }
}
