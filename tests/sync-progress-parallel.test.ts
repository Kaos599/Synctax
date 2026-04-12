import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { ConfigManager } from "../src/config.js";
import { syncCommand } from "../src/commands/sync.js";
import { adapters } from "../src/adapters/index.js";

type AdapterShape = {
  id: string;
  name: string;
  detect: () => Promise<boolean>;
  read: () => Promise<{ mcps: Record<string, unknown>; agents: Record<string, unknown>; skills: Record<string, unknown> }>;
  write: (resources: unknown) => Promise<void>;
  getMemoryFileName: () => string;
  readMemory: (projectDir: string) => Promise<string | null>;
  writeMemory: (projectDir: string, content: string) => Promise<void>;
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureLogs(run: () => Promise<void>): Promise<string> {
  const originalLog = console.log;
  const lines: string[] = [];

  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };

  try {
    await run();
  } finally {
    console.log = originalLog;
  }

  return lines.join("\n");
}

describe("sync progress and bounded parallelism", () => {
  let mockHome: string;
  let manager: ConfigManager;
  const originalAdapters = new Map<string, any>();

  function setAdapter(id: string, adapter: AdapterShape): void {
    if (!originalAdapters.has(id)) {
      originalAdapters.set(id, adapters[id]);
    }
    adapters[id] = adapter as any;
  }

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-sync-progress-test-"));
    process.env.SYNCTAX_HOME = mockHome;
    await fs.mkdir(path.join(mockHome, ".synctax"), { recursive: true });
    manager = new ConfigManager();
  });

  afterEach(async () => {
    for (const [id, adapter] of originalAdapters.entries()) {
      if (adapter === undefined) {
        delete adapters[id];
      } else {
        adapters[id] = adapter;
      }
    }
    originalAdapters.clear();

    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
    process.exitCode = undefined;
  });

  it("prints staged progress counters for analyze and write phases", async () => {
    await manager.write({
      version: 1,
      activeProfile: "default",
      clients: {
        clienta: { enabled: true },
        clientb: { enabled: true },
      },
      profiles: {
        default: {},
      },
      resources: {
        mcps: {
          "new-mcp": { command: "echo" },
        },
        agents: {},
        skills: {},
      },
    } as any);

    for (const id of ["clienta", "clientb"]) {
      setAdapter(id, {
        id,
        name: id.toUpperCase(),
        detect: async () => true,
        read: async () => ({ mcps: {}, agents: {}, skills: {} }),
        write: async () => {},
        getMemoryFileName: () => `${id}.md`,
        readMemory: async () => null,
        writeMemory: async () => {},
      });
    }

    const output = await captureLogs(async () => {
      await syncCommand({ dryRun: false, yes: true });
    });

    expect(output).toContain("Stage 3/6 Analyze clients");
    expect(output).toContain("Stage 5/6 Write clients");
    expect(output).toContain("done/total");
  });

  it("prints ETA hints, per-client timing, and phase timing summary", async () => {
    await manager.write({
      version: 1,
      activeProfile: "default",
      clients: {
        clienta: { enabled: true },
        clientb: { enabled: true },
      },
      profiles: {
        default: {},
      },
      resources: {
        mcps: {
          "new-mcp": { command: "echo" },
        },
        agents: {},
        skills: {},
      },
    } as any);

    for (const id of ["clienta", "clientb"]) {
      setAdapter(id, {
        id,
        name: id.toUpperCase(),
        detect: async () => true,
        read: async () => {
          await sleep(20);
          return { mcps: {}, agents: {}, skills: {} };
        },
        write: async () => {
          await sleep(20);
        },
        getMemoryFileName: () => `${id}.md`,
        readMemory: async () => null,
        writeMemory: async () => {},
      });
    }

    const output = await captureLogs(async () => {
      await syncCommand({ dryRun: false, yes: true });
    });

    expect(output).toContain("remaining");
    expect(output).toContain("Analyze CLIENTA completed in");
    expect(output).toContain("Write CLIENTA completed in");
    expect(output).toContain("Phase timings:");
    expect(output).toContain("Client results: success=2 failed=0");
  });

  it("reads each target client exactly once per sync", async () => {
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
          "new-mcp": { command: "echo" },
        },
        agents: {},
        skills: {},
      },
    } as any);

    const readCount: Record<string, number> = {
      clienta: 0,
      clientb: 0,
      clientc: 0,
    };

    for (const id of Object.keys(readCount)) {
      setAdapter(id, {
        id,
        name: id.toUpperCase(),
        detect: async () => true,
        read: async () => {
          readCount[id] = (readCount[id] ?? 0) + 1;
          return { mcps: {}, agents: {}, skills: {} };
        },
        write: async () => {},
        getMemoryFileName: () => `${id}.md`,
        readMemory: async () => null,
        writeMemory: async () => {},
      });
    }

    await captureLogs(async () => {
      await syncCommand({ dryRun: false, yes: true });
    });

    expect(readCount.clienta).toBe(1);
    expect(readCount.clientb).toBe(1);
    expect(readCount.clientc).toBe(1);
  });

  it("runs target analysis with bounded parallel concurrency", async () => {
    const clientIds = ["c1", "c2", "c3", "c4", "c5", "c6"];
    await manager.write({
      version: 1,
      activeProfile: "default",
      clients: Object.fromEntries(clientIds.map((id) => [id, { enabled: true }])),
      profiles: {
        default: {},
      },
      resources: {
        mcps: {
          "new-mcp": { command: "echo" },
        },
        agents: {},
        skills: {},
      },
    } as any);

    let inFlightReads = 0;
    let maxInFlightReads = 0;

    for (const id of clientIds) {
      setAdapter(id, {
        id,
        name: id.toUpperCase(),
        detect: async () => true,
        read: async () => {
          inFlightReads += 1;
          maxInFlightReads = Math.max(maxInFlightReads, inFlightReads);
          await sleep(40);
          inFlightReads -= 1;
          return { mcps: {}, agents: {}, skills: {} };
        },
        write: async () => {},
        getMemoryFileName: () => `${id}.md`,
        readMemory: async () => null,
        writeMemory: async () => {},
      });
    }

    await captureLogs(async () => {
      await syncCommand({ dryRun: false, yes: true });
    });

    expect(maxInFlightReads).toBeGreaterThan(1);
    expect(maxInFlightReads).toBeLessThanOrEqual(4);
  });

  it("runs target writes with bounded parallel concurrency", async () => {
    const clientIds = ["w1", "w2", "w3", "w4", "w5"];
    await manager.write({
      version: 1,
      activeProfile: "default",
      clients: Object.fromEntries(clientIds.map((id) => [id, { enabled: true }])),
      profiles: {
        default: {},
      },
      resources: {
        mcps: {
          "new-mcp": { command: "echo" },
        },
        agents: {},
        skills: {},
      },
    } as any);

    let inFlightWrites = 0;
    let maxInFlightWrites = 0;

    for (const id of clientIds) {
      setAdapter(id, {
        id,
        name: id.toUpperCase(),
        detect: async () => true,
        read: async () => ({ mcps: {}, agents: {}, skills: {} }),
        write: async () => {
          inFlightWrites += 1;
          maxInFlightWrites = Math.max(maxInFlightWrites, inFlightWrites);
          await sleep(40);
          inFlightWrites -= 1;
        },
        getMemoryFileName: () => `${id}.md`,
        readMemory: async () => null,
        writeMemory: async () => {},
      });
    }

    await captureLogs(async () => {
      await syncCommand({ dryRun: false, yes: true });
    });

    expect(maxInFlightWrites).toBeGreaterThan(1);
    expect(maxInFlightWrites).toBeLessThanOrEqual(3);
  });
});
