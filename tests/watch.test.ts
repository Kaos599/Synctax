import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createWatchSyncScheduler, watchCommand } from "../src/commands.js";
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
    vi.useRealTimers();
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

    const watcher = await watchCommand({});
    if (watcher && typeof watcher.close === "function") await watcher.close();

    // Verify it printed the initialization messages
    const logs = consoleSpy.mock.calls.map(c => c[0]).join("\n");
    expect(logs).toContain("Initializing synctax Watch Daemon");
    expect(logs).toMatch(/\.synctax[\\/]config\.json/);

    consoleSpy.mockRestore();
  });

  it("debounces rapid change notifications into one sync run", async () => {
    vi.useFakeTimers();
    const runSync = vi.fn(async () => {});
    const scheduler = createWatchSyncScheduler(runSync, 500);

    scheduler.schedule();
    scheduler.schedule();
    scheduler.schedule();

    vi.advanceTimersByTime(499);
    expect(runSync).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await Promise.resolve();
    expect(runSync).toHaveBeenCalledTimes(1);

    scheduler.dispose();
  });

  it("queues a single rerun when a change arrives during in-flight sync", async () => {
    vi.useFakeTimers();

    let releaseFirstRun: (() => void) | undefined;
    const firstRunDone = new Promise<void>((resolve) => {
      releaseFirstRun = resolve;
    });

    const runSync = vi.fn(async () => {
      if (runSync.mock.calls.length === 1) {
        await firstRunDone;
      }
    });

    const scheduler = createWatchSyncScheduler(runSync, 500);

    scheduler.schedule();
    vi.advanceTimersByTime(500);
    await Promise.resolve();
    expect(runSync).toHaveBeenCalledTimes(1);

    scheduler.schedule();
    scheduler.schedule();
    vi.advanceTimersByTime(500);
    await Promise.resolve();
    expect(runSync).toHaveBeenCalledTimes(1);

    releaseFirstRun?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(runSync).toHaveBeenCalledTimes(2);

    scheduler.dispose();
  });
});
