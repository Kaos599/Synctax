import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { pullCommand, moveCommand } from "../src/commands.js";
import { ConfigManager } from "../src/config.js";
import { adapters } from "../src/adapters/index.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("CLI Commands", () => {
  let mockHome: string;
  let manager: ConfigManager;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-cmd-test-"));
    process.env.SYNCTAX_HOME = mockHome;
    // Since configManager inside commands.ts is instantiated on import, it caches
    // the value of SYNCTAX_HOME at that time. We must ensure the dir exists at the mock home!
    await fs.mkdir(path.join(mockHome, ".synctax"), { recursive: true });

    manager = new ConfigManager();
    // Pre-create the empty config in the exact place the singleton expects it to be
    await manager.write({
      version: 1,
      source: "claude",
      clients: {},
      resources: { mcps: {}, agents: {} }
    });

    adapters["mockclient"] = {
      id: "mockclient",
      name: "Mock Client",
      detect: async () => true,
      read: async () => ({
        mcps: {
          "mock-mcp": { command: "mock" }
        },
        agents: {
          "mock-agent": { name: "Mock", prompt: "Mocking", model: "mock-model" }
        }
      }),
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => "mock memory",
      writeMemory: async () => {}
    };
  });

  afterEach(async () => {
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
    delete adapters["mockclient"];
  });

  it("pullCommand merges properly", async () => {
    await pullCommand({ from: "mockclient", merge: true });

    // We need to read it using the singleton instance or a new one relying on the same path
    const config = await manager.read();
    expect(config.source).toBe("mockclient");
    expect(config.resources.mcps["mock-mcp"].command).toBe("mock");
    expect(config.resources.agents["mock-agent"].prompt).toBe("Mocking");
  });

  it("moveCommand updates resource scope", async () => {
    await manager.write({
      version: 1,
      resources: {
        mcps: {
          "moveable-mcp": { command: "test", scope: "local" }
        },
        agents: {}
      },
      clients: {}
    });

    await moveCommand("mcp", "moveable-mcp", { toGlobal: true });

    const config = await manager.read();
    expect(config.resources.mcps["moveable-mcp"].scope).toBe("global");
  });
});
