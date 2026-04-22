import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { ConfigManager } from "../src/config.js";
import { diffCommand } from "../src/commands.js";
import { adapters } from "../src/adapters/index.js";

function stripAnsi(input: string): string {
  return input.replace(/\u001b\[[0-9;]*m/g, "");
}

describe("diffCommand", () => {
  let mockHome: string;
  let manager: ConfigManager;
  const originalAdapters = new Map<string, (typeof adapters)[string] | undefined>();

  function setAdapter(id: string, adapter: (typeof adapters)[string]) {
    if (!originalAdapters.has(id)) {
      originalAdapters.set(id, adapters[id]);
    }
    adapters[id] = adapter;
  }

  async function captureOutput(run: () => Promise<void>): Promise<string> {
    const lines: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      lines.push(stripAnsi(args.map((arg) => String(arg)).join(" ")));
    });

    try {
      await run();
    } finally {
      logSpy.mockRestore();
    }

    return lines.join("\n");
  }

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-diff-test-"));
    process.env.SYNCTAX_HOME = mockHome;
    manager = new ConfigManager();
  });

  afterEach(async () => {
    for (const [id, original] of originalAdapters.entries()) {
      if (original) adapters[id] = original;
      else delete adapters[id];
    }
    originalAdapters.clear();
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  it("diff shows add/remove/modify for all enabled clients", async () => {
    setAdapter("diff-a", {
      id: "diff-a",
      name: "Diff A",
      detect: async () => true,
      read: async () => ({
        mcps: {
          changed: { command: "node", args: ["old.js"] },
          clientOnly: { command: "echo", args: ["hi"] },
        },
        agents: {
          agentChanged: { name: "Agent Changed", prompt: "old" },
          agentClientOnly: { name: "Agent Client", prompt: "only" },
        },
        skills: {},
      }),
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    });

    setAdapter("diff-b", {
      id: "diff-b",
      name: "Diff B",
      detect: async () => true,
      read: async () => ({
        mcps: {
          changed: { command: "node", args: ["new.js"] },
          serverOnly: { command: "bun", args: ["serve"] },
        },
        agents: {
          agentChanged: { name: "Agent Changed", prompt: "new" },
        },
        skills: {
          skillOnly: { name: "Skill Only", content: "content" },
        },
      }),
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    });

    await manager.write({
      version: 1,
      source: "diff-a",
      activeProfile: "default",
      clients: {
        "diff-a": { enabled: true },
        "diff-b": { enabled: true },
      },
      profiles: { default: {} },
      resources: {
        mcps: {
          changed: { command: "node", args: ["new.js"] },
          serverOnly: { command: "bun", args: ["serve"] },
        },
        agents: {
          agentChanged: { name: "Agent Changed", prompt: "new" },
          agentServerOnly: { name: "Agent Server", prompt: "only" },
        },
        skills: {
          skillOnly: { name: "Skill Only", content: "content" },
        },
      },
    } as any);

    const output = await captureOutput(async () => {
      await diffCommand();
    });

    expect(output).toContain("Diff A (diff-a)");
    expect(output).toContain("MCPs: +1 -1 ~1");
    expect(output).toContain("Agents: +1 -1 ~1");
    expect(output).toContain("Diff B (diff-b)");
    expect(output).toContain("Skills: +0 -0 ~0");
  });

  it("diff supports single client", async () => {
    const readA = vi.fn(async () => ({ mcps: {}, agents: {}, skills: {} }));
    const readB = vi.fn(async () => ({ mcps: {}, agents: {}, skills: {} }));

    setAdapter("diff-a", {
      id: "diff-a",
      name: "Diff A",
      detect: async () => true,
      read: readA,
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    });

    setAdapter("diff-b", {
      id: "diff-b",
      name: "Diff B",
      detect: async () => true,
      read: readB,
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    });

    await manager.write({
      version: 1,
      source: "diff-a",
      activeProfile: "default",
      clients: {
        "diff-a": { enabled: true },
        "diff-b": { enabled: true },
      },
      profiles: { default: {} },
      resources: {
        mcps: {},
        agents: {},
        skills: {},
      },
    } as any);

    const output = await captureOutput(async () => {
      await diffCommand("diff-b");
    });

    expect(readA).not.toHaveBeenCalled();
    expect(readB).toHaveBeenCalledTimes(1);
    expect(output).toContain("Diff B (diff-b)");
    expect(output).not.toContain("Diff A (diff-a)");
  });

  it("diff runs client reads in parallel", async () => {
    const readA = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { mcps: {}, agents: {}, skills: {} };
    });
    const readB = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { mcps: {}, agents: {}, skills: {} };
    });

    setAdapter("diff-a", {
      id: "diff-a",
      name: "Diff A",
      detect: async () => true,
      read: readA,
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    });

    setAdapter("diff-b", {
      id: "diff-b",
      name: "Diff B",
      detect: async () => true,
      read: readB,
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    });

    await manager.write({
      version: 1,
      source: "diff-a",
      activeProfile: "default",
      clients: {
        "diff-a": { enabled: true },
        "diff-b": { enabled: true },
      },
      profiles: { default: {} },
      resources: {
        mcps: {},
        agents: {},
        skills: {},
      },
    } as any);

    const start = Date.now();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await diffCommand(undefined, { json: true });
    logSpy.mockRestore();
    const duration = Date.now() - start;

    expect(readA).toHaveBeenCalledTimes(1);
    expect(readB).toHaveBeenCalledTimes(1);
    // If sequential, duration would be ~100ms. If parallel, ~50ms.
    expect(duration).toBeLessThan(80);
  });

  it("diff supports --json", async () => {
    setAdapter("diff-json", {
      id: "diff-json",
      name: "Diff JSON",
      detect: async () => true,
      read: async () => ({
        mcps: {
          onlyClient: { command: "echo", args: ["x"] },
        },
        agents: {
          sharedAgent: { name: "Shared", prompt: "old" },
        },
        skills: {},
      }),
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    });

    await manager.write({
      version: 1,
      source: "diff-json",
      activeProfile: "default",
      clients: {
        "diff-json": { enabled: true },
      },
      profiles: { default: {} },
      resources: {
        mcps: {
          onlyServer: { command: "bun", args: ["run"] },
        },
        agents: {
          sharedAgent: { name: "Shared", prompt: "new" },
        },
        skills: {},
      },
    } as any);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await diffCommand(undefined, { json: true });
    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0] ?? "{}"));
    expect(payload.clients).toHaveLength(1);
    expect(payload.clients[0].id).toBe("diff-json");
    expect(payload.clients[0].domains.mcps.add).toEqual(["onlyServer"]);
    expect(payload.clients[0].domains.mcps.remove).toEqual(["onlyClient"]);
    expect(payload.clients[0].domains.agents.modify).toEqual(["sharedAgent"]);
    logSpy.mockRestore();
  });
});
