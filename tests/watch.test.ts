import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { watchCommand } from "../src/commands.js";
import { ConfigManager } from "../src/config.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("Watch Daemon Mode", () => {
  let mockHome: string;
  let manager: ConfigManager;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-watch-test-"));
    process.env.SYNCTAX_HOME = mockHome;
    await fs.mkdir(path.join(mockHome, ".synctax"), { recursive: true });
    manager = new ConfigManager();
  });

  afterEach(async () => {
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
    vi.clearAllMocks();
  });

  it("watchCommand gracefully initializes without crashing", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Create base config
    await manager.write({ version: 1, clients: {}, resources: { mcps: {}, agents: {}, skills: {} } } as any);

    // Because Chokidar v5 ESM mocking breaks vi.spyOn in Vitest due to immutable namespace objects,
    // we simply invoke watchCommand and ensure it doesn't throw a TypeError executing the real chokidar.

    await watchCommand({});

    // Verify it printed the initialization messages
    const logs = consoleSpy.mock.calls.map(c => c[0]).join("\n");
    expect(logs).toContain("Initializing synctax Watch Daemon");
    expect(logs).toContain(".synctax/config.json");

    consoleSpy.mockRestore();
  });
});
