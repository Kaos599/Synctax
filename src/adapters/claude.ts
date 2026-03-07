import fs from "fs/promises";
import path from "path";
import os from "os";
import { ClientAdapter, McpServer, Agent } from "../types.js";

export class ClaudeAdapter implements ClientAdapter {
  id = "claude";
  name = "Claude Code";

  private get baseDir() {
    const homeDir = process.env.SYNCTAX_HOME || os.homedir();
    return path.join(homeDir, ".claude");
  }

  private get configPath() {
    return path.join(this.baseDir, "settings.json");
  }

  private get agentsDir() {
    return path.join(this.baseDir, "agents");
  }

  async detect(): Promise<boolean> {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  async read(): Promise<{ mcps: Record<string, McpServer>, agents: Record<string, Agent> }> {
    const result = {
      mcps: {} as Record<string, McpServer>,
      agents: {} as Record<string, Agent>
    };

    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(data);
      const mcpServers = parsed.mcpServers || {};

      for (const [key, val] of Object.entries<any>(mcpServers)) {
        result.mcps[key] = {
          command: val.command,
          args: val.args,
          env: val.env,
        };
      }
    } catch (error: any) {
      if (error.code !== "ENOENT") throw new Error(`Failed to read Claude config: ${error.message}`);
    }

    try {
      const files = await fs.readdir(this.agentsDir);
      for (const file of files) {
        if (!file.endsWith(".md")) continue;
        const name = file.replace(".md", "");
        const content = await fs.readFile(path.join(this.agentsDir, file), "utf-8");

        // Simple frontmatter parser
        let prompt = content;
        let model = undefined;
        let description = undefined;
        let displayName = name;

        if (content.startsWith("---")) {
          const parts = content.split("---");
          if (parts.length >= 3) {
            const fm = parts[1];
            prompt = parts.slice(2).join("---").trim();

            const lines = fm.split("\n");
            for (const line of lines) {
              const [k, ...rest] = line.split(":");
              if (!k) continue;
              const v = rest.join(":").trim();
              if (k.trim() === "model") model = v;
              if (k.trim() === "name") displayName = v;
              if (k.trim() === "description") description = v;
            }
          }
        }

        result.agents[name] = {
           name: displayName,
           description,
           prompt,
           model
        };
      }
    } catch (error: any) {
      if (error.code !== "ENOENT") throw new Error(`Failed to read Claude agents: ${error.message}`);
    }

    return result;
  }

  async write(resources: { mcps: Record<string, McpServer>, agents: Record<string, Agent> }): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});

    let existing: any = {};
    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      existing = JSON.parse(data);
    } catch (e) {
      // file might not exist
    }

    existing.mcpServers = resources.mcps;
    await fs.writeFile(this.configPath, JSON.stringify(existing, null, 2), "utf-8");

    // Write agents
    if (Object.keys(resources.agents).length > 0) {
      await fs.mkdir(this.agentsDir, { recursive: true }).catch(() => {});
      for (const [key, agent] of Object.entries(resources.agents)) {
        let content = `---\nname: ${agent.name}\n`;
        if (agent.description) content += `description: ${agent.description}\n`;
        if (agent.model) content += `model: ${agent.model}\n`;
        content += `---\n${agent.prompt}\n`;
        await fs.writeFile(path.join(this.agentsDir, `${key}.md`), content, "utf-8");
      }
    }
  }


  getMemoryFileName(): string {
    return "CLAUDE.md";
  }

  async readMemory(projectDir: string): Promise<string | null> {
    try {
      return await fs.readFile(path.join(projectDir, this.getMemoryFileName()), "utf-8");
    } catch {
      return null;
    }
  }

  async writeMemory(projectDir: string, content: string): Promise<void> {
    await fs.writeFile(path.join(projectDir, this.getMemoryFileName()), content, "utf-8");
  }
}
