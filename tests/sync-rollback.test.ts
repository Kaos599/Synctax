import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { syncCommand } from "../src/commands.js";
import { ConfigManager } from "../src/config.js";
import { adapters } from "../src/adapters/index.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("sync rollback", () => {
  let mockHome: string;
  let manager: ConfigManager;
  const originalAdapters = new Map<string, any>();

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-sync-rollback-test-"));
    process.env.SYNCTAX_HOME = mockHome;
    await fs.mkdir(path.join(mockHome, ".synctax"), { recursive: true });

    manager = new ConfigManager();
    await manager.write({
      version: 1,
      activeProfile: "default",
      clients: {
        clienta: { enabled: true },
        clientb: { enabled: true },
        clientc: { enabled: true },
      },
      profiles: {
        default: {},
      },
      resources: {
        mcps: {
          "new-mcp": { command: "new-command" },
        },
        agents: {},
        skills: {},
        permissions: { allowedPaths: [] },
        models: {},
        prompts: {},
        credentials: { envRefs: {} },
      },
    } as any);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    for (const [id, value] of originalAdapters.entries()) {
      if (value === undefined) {
        delete adapters[id];
      } else {
        adapters[id] = value;
      }
    }
    originalAdapters.clear();
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  function setAdapter(id: string, adapter: any) {
    if (!originalAdapters.has(id)) {
      originalAdapters.set(id, adapters[id]);
    }
    adapters[id] = adapter;
  }

  it("rolls back previously synced clients when a later write fails", async () => {
    const previousExitCode = process.exitCode;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const snapshotA = { mcps: { "old-a": { command: "old-a" } }, agents: {}, skills: {} };
    const snapshotB = { mcps: { "old-b": { command: "old-b" } }, agents: {}, skills: {} };

    const writeA = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    const writeB = vi.fn().mockRejectedValue(new Error("clientb write failure"));
    const writeC = vi.fn().mockResolvedValue(undefined);

    setAdapter("clienta", {
      id: "clienta",
      name: "Client A",
      detect: async () => true,
      read: async () => snapshotA,
      write: writeA,
      getMemoryFileName: () => "A.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    });
    setAdapter("clientb", {
      id: "clientb",
      name: "Client B",
      detect: async () => true,
      read: async () => snapshotB,
      write: writeB,
      getMemoryFileName: () => "B.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    });
    setAdapter("clientc", {
      id: "clientc",
      name: "Client C",
      detect: async () => true,
      read: async () => ({ mcps: {}, agents: {}, skills: {} }),
      write: writeC,
      getMemoryFileName: () => "C.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    });

    try {
      process.exitCode = undefined;
      await syncCommand({ dryRun: false });

      expect(writeA).toHaveBeenCalledTimes(2);
      expect(writeA.mock.calls[0]?.[0]?.mcps?.["new-mcp"]?.command).toBe("new-command");
      expect(writeA.mock.calls[1]?.[0]).toEqual(snapshotA);
      expect(writeB).toHaveBeenCalledTimes(1);
      expect(writeC).toHaveBeenCalledTimes(2);
      expect(process.exitCode).toBe(1);

      const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain("Rollback complete: 2 succeeded, 0 failed");
      expect(output).toContain("Rollback Client A completed in");
      expect(output).toContain("Sync failed");
      expect(output).not.toContain("Sync complete!");
    } finally {
      process.exitCode = previousExitCode;
    }
  });

  it("reports rollback failures without retry loop", async () => {
    const previousExitCode = process.exitCode;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const writeA = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("rollback failed on clienta"));
    const writeB = vi.fn().mockRejectedValue(new Error("clientb write failure"));
    const writeC = vi.fn().mockResolvedValue(undefined);

    setAdapter("clienta", {
      id: "clienta",
      name: "Client A",
      detect: async () => true,
      read: async () => ({ mcps: { "old-a": { command: "old-a" } }, agents: {}, skills: {} }),
      write: writeA,
      getMemoryFileName: () => "A.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    });
    setAdapter("clientb", {
      id: "clientb",
      name: "Client B",
      detect: async () => true,
      read: async () => ({ mcps: { "old-b": { command: "old-b" } }, agents: {}, skills: {} }),
      write: writeB,
      getMemoryFileName: () => "B.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    });
    setAdapter("clientc", {
      id: "clientc",
      name: "Client C",
      detect: async () => true,
      read: async () => ({ mcps: {}, agents: {}, skills: {} }),
      write: writeC,
      getMemoryFileName: () => "C.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    });

    try {
      process.exitCode = undefined;
      await syncCommand({ dryRun: false });

      expect(writeA).toHaveBeenCalledTimes(2);
      expect(writeB).toHaveBeenCalledTimes(1);
      expect(writeC).toHaveBeenCalledTimes(2);
      expect(process.exitCode).toBe(1);

      const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain("Rollback failed for Client A: rollback failed on clienta");
      expect(output).toContain("Rollback complete: 1 succeeded, 1 failed");
    } finally {
      process.exitCode = previousExitCode;
    }
  });
});
