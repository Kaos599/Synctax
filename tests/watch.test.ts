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

  it("watchCommand successfully attempts to watch the config file", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Create base config
    await manager.write({ version: 1, clients: {}, resources: { mcps: {}, agents: {}, skills: {} } } as any);

    // We cannot fully execute the event loop for chokidar easily in this mock without freezing the suite.
    // Instead we will mock chokidar natively inside the module using vi.mock on top level, but due to Vitest module caching bugs,
    // we'll just execute it and intercept the console logs to prove it mounted cleanly.

    // Create a temporary mock inside the node_modules logic isn't clean, let's just trigger it and verify outputs.
    // We will let it spawn a real watcher on the mock file and then clean it up.

    // Mocking just for this test
    const chokidar = await import("chokidar");
    const watchSpy = vi.spyOn(chokidar, "watch");

    // Start watch
    await watchCommand({});

    expect(watchSpy).toHaveBeenCalled();
    const callArgs = watchSpy.mock.calls[0];
    expect(callArgs[0]).toContain(".synctax/config.json");

    consoleSpy.mockRestore();
    watchSpy.mockRestore();
  });
});
