import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { ConfigManager } from "../src/config.js";
import { statusCommand } from "../src/commands.js";
import { adapters } from "../src/adapters/index.js";

function stripAnsi(input: string): string {
  return input.replace(/\u001b\[[0-9;]*m/g, "");
}

describe("statusCommand drift regression", () => {
  let mockHome: string;
  let manager: ConfigManager;
  const originalAdapters = new Map<string, (typeof adapters)[string] | undefined>();

  function setAdapter(id: string, adapter: (typeof adapters)[string]) {
    if (!originalAdapters.has(id)) {
      originalAdapters.set(id, adapters[id]);
    }
    adapters[id] = adapter;
  }

  async function captureStatusOutput(): Promise<string> {
    const lines: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      lines.push(stripAnsi(args.map((arg) => String(arg)).join(" ")));
    });

    try {
      await statusCommand();
    } finally {
      logSpy.mockRestore();
    }

    return lines.join("\n");
  }

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-status-test-"));
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

  it.each([
    {
      id: "zed",
      name: "Zed",
      resources: {
        agents: { "agent-only": { name: "Agent Only", prompt: "hello" } },
        skills: { "skill-only": { name: "Skill Only", content: "world" } },
      },
    },
    {
      id: "cline",
      name: "Cline",
      resources: {
        agents: { "agent-only": { name: "Agent Only", prompt: "hello" } },
        skills: { "skill-only": { name: "Skill Only", content: "world" } },
      },
    },
    {
      id: "github-copilot",
      name: "GitHub Copilot",
      resources: {
        agents: { "agent-only": { name: "Agent Only", prompt: "hello" } },
        skills: { "skill-only": { name: "Skill Only", content: "world" } },
      },
    },
    {
      id: "github-copilot-cli",
      name: "GitHub Copilot CLI",
      resources: {
        mcps: { "mcp-only": { command: "node", args: ["server.js"] } },
        agents: { "agent-only": { name: "Agent Only", prompt: "hello" } },
      },
    },
    {
      id: "gemini-cli",
      name: "Gemini CLI",
      resources: {
        mcps: { "mcp-only": { command: "node", args: ["server.js"] } },
        agents: { "agent-only": { name: "Agent Only", prompt: "hello" } },
        skills: { "skill-only": { name: "Skill Only", content: "world" } },
      },
    },
  ])("does not report unsupported domains as drift for $id", async ({ id, name, resources }) => {
    setAdapter(id, {
      id,
      name,
      detect: async () => true,
      read: async () => ({
        mcps: {},
        agents: {},
        skills: {},
      }),
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    });

    await manager.write({
      version: 1,
      source: id,
      clients: { [id]: { enabled: true } },
      resources: {
        mcps: resources.mcps ?? {},
        agents: resources.agents ?? {},
        skills: resources.skills ?? {},
      },
    } as any);

    const output = await captureStatusOutput();
    expect(output).toContain(`${name}: In Sync`);
    expect(output).not.toContain(`${name}: Out of Sync`);
  });

  it("treats semantically equal resources as in-sync", async () => {
    setAdapter("mockclient", {
      id: "mockclient",
      name: "Mock Client",
      detect: async () => true,
      read: async () => ({
        mcps: {
          ordered: {
            command: "node",
            args: ["server.js"],
            env: { B: "2", A: "1" },
          },
        },
        agents: {},
        skills: {},
      }),
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    });

    await manager.write({
      version: 1,
      source: "mockclient",
      clients: { mockclient: { enabled: true } },
      resources: {
        mcps: {
          ordered: {
            command: "node",
            args: ["server.js"],
            env: { A: "1", B: "2" },
          },
        },
        agents: {},
        skills: {},
      },
    } as any);

    const output = await captureStatusOutput();
    expect(output).toContain("Mock Client: In Sync");
    expect(output).not.toContain("Drift in MCP: ordered");
  });

  it("detects extra resources in client", async () => {
    setAdapter("mockclient", {
      id: "mockclient",
      name: "Mock Client",
      detect: async () => true,
      read: async () => ({
        mcps: {
          extra: { command: "echo", args: ["hello"] },
        },
        agents: {},
        skills: {},
      }),
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    });

    await manager.write({
      version: 1,
      source: "mockclient",
      clients: { mockclient: { enabled: true } },
      resources: {
        mcps: {},
        agents: {},
        skills: {},
      },
    } as any);

    const output = await captureStatusOutput();
    expect(output).toContain("Mock Client: Out of Sync");
  });

  it("normalizes aliased enabled client ids in status checks", async () => {
    setAdapter("opencode", {
      id: "opencode",
      name: "OpenCode",
      detect: async () => true,
      read: async () => ({
        mcps: {},
        agents: {},
        skills: {},
      }),
      write: async () => {},
      getMemoryFileName: () => "AGENTS.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    } as any);

    await manager.write({
      version: 1,
      source: "open code",
      clients: { "open code": { enabled: true } },
      resources: {
        mcps: {},
        agents: {},
        skills: {},
      },
    } as any);

    const output = await captureStatusOutput();
    expect(output).toContain("OpenCode: In Sync");
    expect(output).not.toContain("No clients enabled.");
  });
});
