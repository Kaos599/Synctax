import fs from "fs/promises";
import path from "path";
import os from "os";
import { ClientAdapter, McpServer } from "../types.js";

export class ClaudeAdapter implements ClientAdapter {
  id = "claude";
  name = "Claude Code";

  private get configPath() {
    const homeDir = process.env.SYNCTAX_HOME || os.homedir();
    // Claude Code settings typically live in ~/.claude/settings.json or similar based on OS.
    // However, the PRD mentions ~/.claude/settings.json specifically.
    return path.join(homeDir, ".claude", "settings.json");
  }

  async detect(): Promise<boolean> {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  async read(): Promise<Record<string, McpServer>> {
    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(data);
      const mcpServers = parsed.mcpServers || {};

      const normalized: Record<string, McpServer> = {};
      for (const [key, val] of Object.entries<any>(mcpServers)) {
        normalized[key] = {
          command: val.command,
          args: val.args,
          env: val.env,
        };
      }
      return normalized;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return {};
      }
      throw new Error(`Failed to read Claude config: ${error.message}`);
    }
  }

  async write(mcps: Record<string, McpServer>): Promise<void> {
    const dir = path.dirname(this.configPath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }

    let existing: any = {};
    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      existing = JSON.parse(data);
    } catch (e) {
      // file might not exist, which is fine
    }

    existing.mcpServers = mcps;
    await fs.writeFile(this.configPath, JSON.stringify(existing, null, 2), "utf-8");
  }
}
