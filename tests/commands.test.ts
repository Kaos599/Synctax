import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { pullCommand, moveCommand } from "../src/commands.js";
import { ConfigManager } from "../src/config.js";
import { adapters } from "../src/adapters/index.js";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createConfig, createPermissions, createResources, expectDefined } from "./test-helpers.js";

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
    await manager.write(createConfig({
      version: 1,
      source: "claude",
      clients: {},
      resources: createResources({
        mcps: {},
        agents: {},
        skills: {},
        permissions: createPermissions(),
        models: {},
        prompts: {},
        credentials: { envRefs: {} },
      })
    }));

    adapters["mockclient"] = {
      id: "mockclient",
      name: "Mock Client",
      detect: async () => true,
      read: async () => ({ permissions: createPermissions(), skills: {},
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
    vi.restoreAllMocks();
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
    delete adapters["mockclient"];
  });

  it("pullCommand merges properly", async () => {
    await pullCommand({ from: "mockclient", merge: true });

    // We need to read it using the singleton instance or a new one relying on the same path
    const config = await manager.read();
    expect(config.source).toBe("mockclient");
    const pulledMcp = expectDefined(config.resources.mcps["mock-mcp"], "Expected mock-mcp to exist");
    const pulledAgent = expectDefined(config.resources.agents["mock-agent"], "Expected mock-agent to exist");
    expect(pulledMcp.command).toBe("mock");
    expect(pulledAgent.prompt).toBe("Mocking");
  });

  it("pullCommand sets non-zero exitCode when adapter read fails", async () => {
    const previousExitCode = process.exitCode;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    adapters["mockclient"] = {
      ...adapters["mockclient"],
      read: async () => {
        throw new Error("simulated read failure");
      },
    } as any;

    try {
      process.exitCode = undefined;
      await pullCommand({ from: "mockclient", merge: true });
      expect(process.exitCode).toBe(1);
      const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain("Failed to pull config");
    } finally {
      process.exitCode = previousExitCode;
    }
  });

  it("moveCommand updates resource scope", async () => {
    await manager.write(createConfig({
      version: 1,
      resources: {
        mcps: {
          "moveable-mcp": { command: "test", scope: "local" }
        },
        agents: {},
        skills: {},
        permissions: createPermissions(),
      },
      clients: {}
    }));

    await moveCommand("mcp", "moveable-mcp", { toGlobal: true });

    const config = await manager.read();
    const moved = expectDefined(config.resources.mcps["moveable-mcp"], "Expected moveable-mcp to exist");
    expect(moved.scope).toBe("global");
  });


  it("addCommand and removeCommand modify resources", async () => {
    const { addCommand, removeCommand } = await import("../src/commands.js");

    await addCommand("mcp", "new-mcp", { command: "node", args: ["index.js"] });
    let config = await manager.read();
    const newMcp = expectDefined(config.resources.mcps["new-mcp"], "Expected new-mcp to exist");
    expect(newMcp.command).toBe("node");

    await removeCommand("mcp", "new-mcp", {});
    config = await manager.read();
    expect(config.resources.mcps["new-mcp"]).toBeUndefined();
  });

  it("add mcp --from imports wrapper payload by exact name match", async () => {
    const { addCommand } = await import("../src/commands.js");

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          mcps: {
            other: { command: "ignored" },
            "named-mcp": { command: "bun", args: ["run", "named"] },
          },
        }),
    } as any);

    await addCommand("mcp", "named-mcp", { from: "https://example.com/wrapped.json" });

    const config = await manager.read();
    expect(config.resources.mcps["named-mcp"]).toMatchObject({ command: "bun", args: ["run", "named"] });
    fetchSpy.mockRestore();
  });

  it("add mcp --from falls back when wrapper has exactly one valid entry", async () => {
    const { addCommand } = await import("../src/commands.js");

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          mcps: {
            only: { command: "node", args: ["single.js"] },
          },
        }),
    } as any);

    await addCommand("mcp", "missing-name", { from: "https://example.com/single.json" });

    const config = await manager.read();
    expect(config.resources.mcps["missing-name"]).toMatchObject({ command: "node", args: ["single.js"] });
    fetchSpy.mockRestore();
  });

  it("add mcp --from rejects multi-entry wrapper when name does not match", async () => {
    const { addCommand } = await import("../src/commands.js");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          mcps: {
            first: { command: "node", args: ["first.js"] },
            second: { command: "node", args: ["second.js"] },
          },
        }),
    } as any);

    await addCommand("mcp", "missing-name", { from: "https://example.com/multi.json" });

    const config = await manager.read();
    expect(config.resources.mcps["missing-name"]).toBeUndefined();
    expect(logSpy.mock.calls.some(call => String(call[0]).includes("missing-name"))).toBe(true);

    logSpy.mockRestore();
    fetchSpy.mockRestore();
  });

  it("add mcp --from rejects invalid json and invalid schema", async () => {
    const { addCommand } = await import("../src/commands.js");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error("invalid json")),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ not: "an mcp" }),
      } as any);

    await addCommand("mcp", "bad-json", { from: "https://example.com/bad-json" });
    await addCommand("mcp", "bad-schema", { from: "https://example.com/bad-schema" });

    const config = await manager.read();
    expect(config.resources.mcps["bad-json"]).toBeUndefined();
    expect(config.resources.mcps["bad-schema"]).toBeUndefined();
    fetchSpy.mockRestore();
  });

  it("restoreCommand uses newest backup", async () => {
    const { restoreCommand } = await import("../src/commands.js");

    await manager.write(createConfig({
      version: 1,
      source: "claude",
      clients: {},
      resources: createResources({
        mcps: { old: { command: "old" } },
      }),
    }));
    await manager.backup();

    // overwrite with bad data
    await manager.write(createConfig({
      version: 1,
      source: "claude",
      clients: {},
      resources: createResources({
        mcps: { bad: { command: "bad" } },
      }),
    }));

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
    await manager.write(createConfig({
      version: 1,
      source: "mockclient",
      clients: { "missingclient": { enabled: true } },
      resources: createResources({
        mcps: { old: { command: "old" } },
      }),
    }));

    // Should return false due to missing client
    const result = await doctorCommand({});
    expect(result).toBe(false);

    // Valid scenario
    await manager.write(createConfig({
      version: 1,
      source: "mockclient",
      clients: { "mockclient": { enabled: true } },
      resources: createResources(),
    }));

    expect(await doctorCommand({})).toBe(true);
  });

  it("doctor --deep validates MCP commands and required env vars", async () => {
    const { doctorCommand } = await import("../src/commands.js");

    delete process.env.SYNCTAX_TEST_REQUIRED_ENV;

    await manager.write(createConfig({
      version: 1,
      source: "mockclient",
      clients: { mockclient: { enabled: true } },
      resources: {
        mcps: {
          "broken-mcp": {
            command: "synctax-definitely-missing-command",
            env: {
              API_KEY: "$SYNCTAX_TEST_REQUIRED_ENV",
            },
          },
        },
        agents: {},
        skills: {},
        permissions: createPermissions(),
      },
    }));

    expect(await doctorCommand({})).toBe(true);
    expect(await doctorCommand({ deep: true })).toBe(false);
  });

  it("sync resolves MCP env placeholders from profile env file", async () => {
    const { syncCommand } = await import("../src/commands.js");

    const writes: any[] = [];
    adapters["mockclient"] = {
      id: "mockclient",
      name: "Mock Client",
      detect: async () => true,
      read: async () => ({ mcps: {}, agents: {}, skills: {} }),
      write: async (resources: any) => {
        writes.push(resources);
      },
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => "mock memory",
      writeMemory: async () => {},
    };

    await manager.write(createConfig({
      version: 1,
      source: "mockclient",
      activeProfile: "work",
      clients: { mockclient: { enabled: true } },
      profiles: { default: {}, work: {} },
      resources: {
        mcps: {
          "env-mcp": {
            command: "node",
            env: {
              API_KEY: "$SYNC_ENV_API_KEY",
              LITERAL: "ok",
            },
          },
        },
        agents: {},
        skills: {},
        permissions: createPermissions(),
      },
    }));

    await fs.mkdir(path.join(mockHome, ".synctax", "envs"), { recursive: true });
    await fs.writeFile(
      path.join(mockHome, ".synctax", "envs", "work.env"),
      "SYNC_ENV_API_KEY=from-profile\n",
      "utf-8",
    );

    await syncCommand({ dryRun: false });

    expect(writes).toHaveLength(1);
    expect(writes[0].mcps["env-mcp"].env).toEqual({
      API_KEY: "from-profile",
      LITERAL: "ok",
    });
  });

  it("sync dry-run does not create missing profile env file", async () => {
    const { syncCommand } = await import("../src/commands.js");

    adapters["mockclient"] = {
      id: "mockclient",
      name: "Mock Client",
      detect: async () => true,
      read: async () => ({ mcps: {}, agents: {}, skills: {} }),
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => "mock memory",
      writeMemory: async () => {},
    };

    await manager.write(createConfig({
      version: 1,
      source: "mockclient",
      activeProfile: "missing-profile-env",
      clients: { mockclient: { enabled: true } },
      profiles: { default: {}, "missing-profile-env": {} },
      resources: {
        mcps: {
          "env-mcp": {
            command: "node",
            env: {
              API_KEY: "$SYNC_ENV_API_KEY",
            },
          },
        },
        agents: {},
        skills: {},
        permissions: createPermissions(),
      },
    }));

    const envPath = path.join(mockHome, ".synctax", "envs", "missing-profile-env.env");
    await expect(syncCommand({ dryRun: true })).resolves.toBeUndefined();
    await expect(fs.access(envPath)).rejects.toBeDefined();
  });

  it("profilePullCommand fails gracefully on invalid payload", async () => {
    const { profilePullCommand } = await import("../src/commands.js");

    const fetchSpyInvalid = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: "broken" }),
    } as any);

    await profilePullCommand("https://dummy.url");
    const config = await manager.read();
    expect(config.profiles["broken"]).toBeUndefined();
    fetchSpyInvalid.mockRestore();
  });

  it("profilePullCommand merges supported profile domains", async () => {
    const { profilePullCommand } = await import("../src/commands.js");

    const fetchSpyMerge = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        name: "team-profile",
        profile: { include: ["team-mcp"], exclude: [] },
        resources: {
          mcps: { "team-mcp": { command: "echo" } },
          agents: { "team-agent": { name: "Team", prompt: "Do team things" } },
          skills: { "team-skill": { name: "Team Skill", content: "Use team tools" } },
          permissions: {
            allowedPaths: ["/safe"],
            deniedPaths: ["/safe"],
            allowedCommands: ["ls"],
            deniedCommands: ["ls"],
            networkAllow: true,
            allow: [],
            deny: [],
            ask: [],
            allowedUrls: [],
            deniedUrls: [],
            trustedFolders: [],
          },
          models: { defaultModel: "gpt-5" },
          prompts: { globalSystemPrompt: "Be helpful" },
          credentials: { envRefs: { SHOULD_NOT: "MERGE" } },
        },
      }),
    } as any);

    await profilePullCommand("https://dummy.url");
    const config = await manager.read();

    const teamProfile = expectDefined(config.profiles["team-profile"], "Expected team-profile to exist");
    const teamMcp = expectDefined(config.resources.mcps["team-mcp"], "Expected team-mcp to exist");
    const teamAgent = expectDefined(config.resources.agents["team-agent"], "Expected team-agent to exist");
    const teamSkill = expectDefined(config.resources.skills["team-skill"], "Expected team-skill to exist");
    expect(teamProfile.include).toContain("team-mcp");
    expect(teamMcp.command).toBe("echo");
    expect(teamAgent.prompt).toBe("Do team things");
    expect(teamSkill.name).toBe("Team Skill");
    expect(config.resources.permissions.allowedPaths).not.toContain("/safe");
    expect(config.resources.permissions.deniedPaths).toContain("/safe");
    const mergedModels = expectDefined(config.resources.models, "Expected models to exist");
    const mergedPrompts = expectDefined(config.resources.prompts, "Expected prompts to exist");
    const mergedCredentials = expectDefined(config.resources.credentials, "Expected credentials to exist");
    expect(mergedModels.defaultModel).toBe("gpt-5");
    expect(mergedPrompts.globalSystemPrompt).toBe("Be helpful");
    expect(mergedCredentials.envRefs.SHOULD_NOT).toBeUndefined();
    fetchSpyMerge.mockRestore();
  });

  it("profile publish/pull round-trip keeps supported resources and excludes credentials", async () => {
    const { profilePullCommand, profilePublishCommand } = await import("../src/commands.js");

    await manager.write(createConfig({
      version: 1,
      source: "claude",
      clients: {},
      profiles: {
        "team-profile": { include: ["team-mcp"], exclude: ["skip-this"] },
      },
      activeProfile: "default",
      resources: {
        mcps: { "team-mcp": { command: "echo", args: ["ok"] } },
        agents: { "team-agent": { name: "Team", prompt: "Do team things", model: "gpt-5" } },
        skills: { "team-skill": { name: "Team Skill", content: "Use team tools" } },
        permissions: {
          allowedPaths: ["/workspace"],
          deniedPaths: ["/private"],
          allowedCommands: ["ls"],
          deniedCommands: ["rm"],
          networkAllow: false,
          allow: [],
          deny: [],
          ask: [],
          allowedUrls: [],
          deniedUrls: [],
          trustedFolders: [],
        },
        models: { defaultModel: "gpt-5" },
        prompts: { globalSystemPrompt: "Be concise" },
        credentials: { envRefs: { SECRET: "VALUE" } },
      },
    }));

    const published = await profilePublishCommand("team-profile");
    expect(published).toBeDefined();
    expect(published.resources.credentials).toBeUndefined();

    const fetchSpyRoundTrip = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ...published,
        name: "imported-team-profile",
      }),
    } as any);

    await profilePullCommand("https://dummy.url");
    const config = await manager.read();

    expect(expectDefined(config.profiles["imported-team-profile"], "Expected imported profile")).toEqual(published.profile);
    expect(expectDefined(config.resources.mcps["team-mcp"], "Expected team-mcp")).toEqual(published.resources.mcps["team-mcp"]);
    expect(expectDefined(config.resources.agents["team-agent"], "Expected team-agent")).toEqual(published.resources.agents["team-agent"]);
    expect(expectDefined(config.resources.skills["team-skill"], "Expected team-skill")).toEqual(published.resources.skills["team-skill"]);
    expect(config.resources.permissions.deniedCommands).toContain("rm");
    expect(config.resources.models).toEqual(published.resources.models);
    expect(config.resources.prompts).toEqual(published.resources.prompts);
    expect(expectDefined(config.resources.credentials, "Expected credentials").envRefs.SECRET).toBe("VALUE");
    fetchSpyRoundTrip.mockRestore();
  });
});
