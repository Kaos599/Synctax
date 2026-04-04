import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConfigManager } from "../src/config.js";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createConfig, createResources } from "./test-helpers.js";

describe("ConfigManager", () => {
  let mockHome: string;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-test-"));
    process.env.SYNCTAX_HOME = mockHome;
  });

  afterEach(async () => {
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  it("reads empty config when missing", async () => {
    const manager = new ConfigManager();
    const config = await manager.read();
    expect(config.version).toBe(1);
    expect(config.clients).toEqual({});
  });

  it("writes and reads config properly", async () => {
    const manager = new ConfigManager();
    await manager.write(createConfig({
      version: 1,
      source: "claude",
      clients: {
        "claude": { enabled: true },
      },
      resources: createResources({ mcps: {} }),
    }));

    const config = await manager.read();
    expect(config.source).toBe("claude");
    expect(config.clients["claude"]?.enabled).toBe(true);
  });

  it("getTheme returns the saved theme or defaults to rebel", async () => {
    const manager = new ConfigManager();
    expect(await manager.getTheme()).toBe("rebel");

    await manager.write(createConfig({
      version: 1,
      theme: "cyber",
      clients: {},
      resources: createResources({ mcps: {} }),
    }));

    expect(await manager.getTheme()).toBe("cyber");
  });

  it("pruneBackups keeps only the newest N backups", async () => {
    const manager = new ConfigManager();
    const configDir = path.join(mockHome, ".synctax");
    await fs.mkdir(configDir, { recursive: true });
    await manager.write(createConfig({ version: 1, clients: {}, resources: createResources({ mcps: {} }) }));

    for (let i = 0; i < 15; i++) {
      const ts = `2026-01-${String(i + 1).padStart(2, "0")}T00-00-00-000Z`;
      await fs.writeFile(path.join(configDir, `config.json.${ts}.bak`), "{}");
    }

    const deleted = await manager.pruneBackups(10);
    expect(deleted.length).toBe(5);

    const remaining = (await fs.readdir(configDir)).filter(f => f.endsWith(".bak"));
    expect(remaining.length).toBe(10);
  });

  it("pruneBackups does nothing when under limit", async () => {
    const manager = new ConfigManager();
    const configDir = path.join(mockHome, ".synctax");
    await fs.mkdir(configDir, { recursive: true });
    await manager.write(createConfig({ version: 1, clients: {}, resources: createResources({ mcps: {} }) }));

    for (let i = 0; i < 3; i++) {
      const ts = `2026-01-0${i + 1}T00-00-00-000Z`;
      await fs.writeFile(path.join(configDir, `config.json.${ts}.bak`), "{}");
    }

    const deleted = await manager.pruneBackups(10);
    expect(deleted.length).toBe(0);

    const remaining = (await fs.readdir(configDir)).filter(f => f.endsWith(".bak"));
    expect(remaining.length).toBe(3);
  });

  it("pruneBackups handles empty directory gracefully", async () => {
    const manager = new ConfigManager();
    const deleted = await manager.pruneBackups(10);
    expect(deleted).toEqual([]);
  });

  it("backup automatically prunes old backups", async () => {
    const manager = new ConfigManager();
    const configDir = path.join(mockHome, ".synctax");
    await fs.mkdir(configDir, { recursive: true });
    await manager.write(createConfig({ version: 1, clients: {}, resources: createResources({ mcps: {} }) }));

    for (let i = 0; i < 12; i++) {
      const ts = `2026-01-${String(i + 1).padStart(2, "0")}T00-00-00-000Z`;
      await fs.writeFile(path.join(configDir, `config.json.${ts}.bak`), "{}");
    }

    await manager.backup();

    const remaining = (await fs.readdir(configDir)).filter(f => f.endsWith(".bak"));
    expect(remaining.length).toBe(10);
  });

  it("pruneBackups does not delete non-backup files", async () => {
    const manager = new ConfigManager();
    const configDir = path.join(mockHome, ".synctax");
    await fs.mkdir(configDir, { recursive: true });
    await manager.write(createConfig({ version: 1, clients: {}, resources: createResources({ mcps: {} }) }));

    await fs.writeFile(path.join(configDir, "config.json.2026-01-01T00-00-00-000Z.bak"), "{}");
    await fs.writeFile(path.join(configDir, "other-file.txt"), "keep me");

    await manager.pruneBackups(0);

    const files = await fs.readdir(configDir);
    expect(files).toContain("other-file.txt");
    expect(files.filter(f => f.endsWith(".bak")).length).toBe(0);
  });
});
