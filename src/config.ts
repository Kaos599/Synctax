import fs from "fs/promises";
import path from "path";
import os from "os";
import { ConfigSchema } from "./types.js";
import type { Config } from "./types.js";

export class ConfigManager {
  private configPath: string;

  constructor() {
    const homeDir = process.env.SYNCTAX_HOME || os.homedir();
    this.configPath = path.join(homeDir, ".synctax", "config.json");
  }

  async ensureConfigDir(): Promise<void> {
    const dir = path.dirname(this.configPath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async read(): Promise<Config> {
    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(data);
      return ConfigSchema.parse(parsed);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return ConfigSchema.parse({});
      }
      throw new Error(`Failed to read or parse config: ${error.message}`);
    }
  }

  async write(config: Config): Promise<void> {
    await this.ensureConfigDir();
    const validated = ConfigSchema.parse(config);
    await fs.writeFile(this.configPath, JSON.stringify(validated, null, 2), "utf-8");
  }

  async backup(): Promise<void> {
     try {
       await fs.access(this.configPath);
       const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
       const backupPath = `${this.configPath}.${timestamp}.bak`;
       await fs.copyFile(this.configPath, backupPath);
      await this.pruneBackups();
     } catch(e) {
       // Ignore if config file doesn't exist
     }
  }

  async pruneBackups(maxBackups: number = 10): Promise<string[]> {
    const dir = path.dirname(this.configPath);
    const baseName = path.basename(this.configPath);

    let files: string[];
    try {
      files = await fs.readdir(dir);
    } catch {
      return [];
    }

    const backups = files
      .filter(f => f.startsWith(`${baseName}.`) && f.endsWith(".bak"))
      .sort()
      .reverse();

    const toDelete = backups.slice(maxBackups);
    const deleted: string[] = [];

    for (const file of toDelete) {
      try {
        await fs.unlink(path.join(dir, file));
        deleted.push(file);
      } catch {
        // Ignore individual delete failures
      }
    }

    return deleted;
  }

  async getTheme(): Promise<string> {
    const config = await this.read();
    return config.theme || "rebel";
  }
}
