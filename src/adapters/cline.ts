import fs from "fs/promises";
import path from "path";
import os from "os";
import { ClientAdapter, McpServer, Agent, Skill, Permissions, Models, Prompts, Credentials } from "../types.js";

export class ClineAdapter implements ClientAdapter {
  id = "cline";
  name = "Cline";

  private get baseDir() {
    return path.join(process.env.SYNCTAX_HOME || os.homedir(), ".cline");
  }

  private get mcpPath() { return path.join(this.baseDir, "mcp_settings.json"); }
  private get configPath() { return path.join(this.baseDir, "config.json"); }
  private get agentsDir() { return path.join(this.baseDir, "agents"); }

  async detect(): Promise<boolean> {
    try { await fs.access(this.configPath); return true; } catch {
      try { await fs.access(this.mcpPath); return true; } catch { return false; }
    }
  }

  async read(): Promise<{
    mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>,
    permissions?: Permissions, models?: Models, prompts?: Prompts, credentials?: Credentials
  }> {
    const result = {
      mcps: {} as Record<string, McpServer>,
      agents: {} as Record<string, Agent>,
      skills: {} as Record<string, Skill>,
      permissions: { allowedPaths: [], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false } as Permissions,
      models: {} as Models,
      prompts: {} as Prompts
    };

    try {
      const data = await fs.readFile(this.mcpPath, "utf-8");
      const parsed = JSON.parse(data);
      const mcpServers = parsed.mcpServers || {};
      for (const [key, val] of Object.entries<any>(mcpServers)) {
        result.mcps[key] = { command: val.command, args: val.args, env: val.env };
      }
    } catch (e: any) {}

    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(data);
      result.permissions!.networkAllow = parsed.autoApproveNetwork === true;
      if (parsed.autoApproveCommands) result.permissions!.allowedCommands = parsed.autoApproveCommands;
      result.models!.defaultModel = parsed.model;
    } catch (e: any) {}

    // In a real scenario we'd parse .cline/agents/
    return result;
  }

  async write(resources: { mcps: Record<string, McpServer>, agents: Record<string, Agent>, skills: Record<string, Skill>, permissions?: Permissions, models?: Models, prompts?: Prompts, credentials?: Credentials }): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true }).catch(() => {});

    // Write MCPs
    let mcpExisting: any = {};
    try { mcpExisting = JSON.parse(await fs.readFile(this.mcpPath, "utf-8")); } catch (e) {}
    mcpExisting.mcpServers = resources.mcps || {};
    await fs.writeFile(this.mcpPath, JSON.stringify(mcpExisting, null, 2), "utf-8");

    // Write Config
    let confExisting: any = {};
    try { confExisting = JSON.parse(await fs.readFile(this.configPath, "utf-8")); } catch (e) {}
    if (resources.permissions) {
      confExisting.autoApproveNetwork = resources.permissions.networkAllow;
      if (resources.permissions.allowedCommands && resources.permissions.allowedCommands.length > 0) {
        confExisting.autoApproveCommands = resources.permissions.allowedCommands;
      }
    }
    if (resources.models?.defaultModel) {
      confExisting.model = resources.models.defaultModel;
    }
    await fs.writeFile(this.configPath, JSON.stringify(confExisting, null, 2), "utf-8");
  }

  getMemoryFileName(): string { return ".clinerules"; }
  async readMemory(projectDir: string): Promise<string | null> {
    try { return await fs.readFile(path.join(projectDir, this.getMemoryFileName()), "utf-8"); } catch { return null; }
  }
  async writeMemory(projectDir: string, content: string): Promise<void> {
    await fs.writeFile(path.join(projectDir, this.getMemoryFileName()), content, "utf-8");
  }
}
