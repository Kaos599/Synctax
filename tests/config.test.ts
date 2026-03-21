import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConfigManager } from "../src/config.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

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
    await manager.write({
      version: 1,
      source: "claude",
      clients: {
        "claude": { enabled: true },
      },
      resources: { mcps: {} },
    });

    const config = await manager.read();
    expect(config.source).toBe("claude");
    expect(config.clients["claude"]?.enabled).toBe(true);
  });

  it("getTheme returns the saved theme or defaults to rebel", async () => {
    const manager = new ConfigManager();
    expect(await manager.getTheme()).toBe("rebel");

    await manager.write({
      version: 1,
      theme: "cyber",
      clients: {},
      resources: { mcps: {} },
    });

    expect(await manager.getTheme()).toBe("cyber");
  });
});
