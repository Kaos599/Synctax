import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
      resources: { mcps: {}, agents: {}, skills: {}, permissions: { allowedPaths: [] }, models: {}, prompts: {}, credentials: { envRefs: {} } }
    });

    adapters["mockclient"] = {
      id: "mockclient",
      name: "Mock Client",
      detect: async () => true,
      read: async () => ({ permissions: { allowedPaths: [] },  skills: {},
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


  it("addCommand and removeCommand modify resources", async () => {
    const { addCommand, removeCommand } = await import("../src/commands.js");

    await addCommand("mcp", "new-mcp", { command: "node", args: ["index.js"] });
    let config = await manager.read();
    expect(config.resources.mcps["new-mcp"].command).toBe("node");

    await removeCommand("mcp", "new-mcp", {});
    config = await manager.read();
    expect(config.resources.mcps["new-mcp"]).toBeUndefined();
  });

  it("restoreCommand uses newest backup", async () => {
    const { restoreCommand } = await import("../src/commands.js");

    await manager.write({
      version: 1, source: "claude", clients: {}, resources: { mcps: { "old": { command: "old" } }, agents: {}, skills: {}, permissions: { allowedPaths: [], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false } }
    } as any);
    await manager.backup();

    // overwrite with bad data
    await manager.write({
      version: 1, source: "claude", clients: {}, resources: { mcps: { "bad": { command: "bad" } }, agents: {}, skills: {}, permissions: { allowedPaths: [], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false } }
    } as any);

    await restoreCommand({});

    const config = await manager.read();
    expect(config.resources.mcps["old"]).toBeDefined();
    expect(config.resources.mcps["bad"]).toBeUndefined();
  });

  it("initCommand saves the theme properly", async () => {
    const { initCommand } = await import("../src/commands.js");
    await initCommand({ theme: "cyber", force: true, detect: false, yes: true });
    
    const config = await manager.read();
    expect(config.theme).toBe("cyber");
  });

  it("initCommand defaults to rebel theme if not provided", async () => {
    const { initCommand } = await import("../src/commands.js");
    await initCommand({ force: true, detect: false, yes: true });
    
    const config = await manager.read();
    expect(config.theme).toBe("rebel");
  });

  it("doctorCommand diagnoses setup issues", async () => {
    const { doctorCommand } = await import("../src/commands.js");

    // Create an invalid scenario
    await manager.write({
      version: 1, source: "mockclient", clients: { "missingclient": { enabled: true } }, resources: { mcps: { "old": { command: "old" } }, agents: {}, skills: {}, permissions: { allowedPaths: [], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false } }
    } as any);

    // Should return false due to missing client
    const result = await doctorCommand({});
    expect(result).toBe(false);

    // Valid scenario
    await manager.write({
      version: 1, source: "mockclient", clients: { "mockclient": { enabled: true } }, resources: { mcps: {}, agents: {}, skills: {}, permissions: { allowedPaths: [], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false } }
    } as any);

    expect(await doctorCommand({})).toBe(true);
  });

  it("profilePullCommand downloads profile and profilePublishCommand strips secrets", async () => {
    const { profilePullCommand, profilePublishCommand } = await import("../src/commands.js");

    // Mock fetch for pull
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
         name: "team-profile",
         profile: { include: ["team-mcp"], exclude: [] },
         resources: { mcps: { "team-mcp": { command: "echo" } } }
      })
    } as any);

    await profilePullCommand("https://dummy.url");
    const config = await manager.read();
    expect(config.profiles["team-profile"].include).toContain("team-mcp");
    expect(config.resources.mcps["team-mcp"].command).toBe("echo");

    // Add credentials and verify publish strips them
    await manager.write({
      ...config,
      resources: {
        ...config.resources,
        credentials: { envRefs: { "SECRET": "VALUE" } }
      }
    });

    const published = await profilePublishCommand("team-profile");
    expect(published).toBeDefined();
    // Assuming the implementation returns the stripped JSON object
    expect(published.resources.credentials).toBeUndefined();
  });
});
