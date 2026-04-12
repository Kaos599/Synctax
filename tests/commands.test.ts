import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { pullCommand, moveCommand, syncCommand, statusCommand, doctorCommand } from "../src/commands.js";
import { ConfigManager } from "../src/config.js";
import { adapters } from "../src/adapters/index.js";
import { checkbox } from "@inquirer/prompts";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createConfig, createPermissions, createResources, expectDefined } from "./test-helpers.js";

vi.mock("@inquirer/prompts", () => ({
  checkbox: vi.fn(),
}));

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

  it("pullCommand normalizes real-world client aliases", async () => {
    const previousOpencode = adapters["opencode"];
    const opencodeRead = vi.fn(async () => ({
      mcps: { "alias-mcp": { command: "node" } },
      agents: {},
      skills: {},
      permissions: createPermissions(),
    }));

    adapters["opencode"] = {
      id: "opencode",
      name: "OpenCode",
      detect: async () => true,
      read: opencodeRead,
      write: async () => {},
      getMemoryFileName: () => "AGENTS.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    } as any;

    try {
      await pullCommand({ from: "open code", merge: true });

      const config = await manager.read();
      expect(config.source).toBe("opencode");
      expect(opencodeRead).toHaveBeenCalledTimes(1);
      expect(config.resources.mcps["alias-mcp"]).toBeDefined();
    } finally {
      adapters["opencode"] = previousOpencode;
    }
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

  it("pullCommand rejects conflicting --merge and --overwrite options", async () => {
    const previousExitCode = process.exitCode;

    try {
      process.exitCode = undefined;
      await pullCommand({ from: "mockclient", merge: true, overwrite: true });

      const config = await manager.read();
      expect(process.exitCode).toBe(1);
      expect(config.source).toBe("claude");
      expect(config.resources.mcps["mock-mcp"]).toBeUndefined();
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

  it("moveCommand rejects conflicting destination options", async () => {
    await manager.write(createConfig({
      version: 1,
      resources: {
        mcps: {
          "moveable-mcp": { command: "test", scope: "local" },
        },
        agents: {},
        skills: {},
        permissions: createPermissions(),
      },
      clients: {},
    }));

    const previousExitCode = process.exitCode;
    try {
      process.exitCode = undefined;
      await moveCommand("mcp", "moveable-mcp", { toGlobal: true, toLocal: true });

      const config = await manager.read();
      const moved = expectDefined(config.resources.mcps["moveable-mcp"], "Expected moveable-mcp to exist");
      expect(process.exitCode).toBe(1);
      expect(moved.scope).toBe("local");
    } finally {
      process.exitCode = previousExitCode;
    }
  });

  it("moveCommand requires one destination option", async () => {
    await manager.write(createConfig({
      version: 1,
      resources: {
        mcps: {
          "moveable-mcp": { command: "test", scope: "local" },
        },
        agents: {},
        skills: {},
        permissions: createPermissions(),
      },
      clients: {},
    }));

    const previousExitCode = process.exitCode;
    try {
      process.exitCode = undefined;
      await moveCommand("mcp", "moveable-mcp", {});

      const config = await manager.read();
      const moved = expectDefined(config.resources.mcps["moveable-mcp"], "Expected moveable-mcp to exist");
      expect(process.exitCode).toBe(1);
      expect(moved.scope).toBe("local");
    } finally {
      process.exitCode = previousExitCode;
    }
  });

  it("removeCommand interactive dry-run does not mutate resources", async () => {
    const { removeCommand } = await import("../src/commands.js");

    await manager.write(createConfig({
      version: 1,
      source: "claude",
      clients: {},
      resources: createResources({
        mcps: { "dry-mcp": { command: "echo" } },
        agents: {},
        skills: {},
        permissions: createPermissions(),
      }),
    }));

    const restoreStdout = (() => {
      const descriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
      Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
      return () => {
        if (descriptor) Object.defineProperty(process.stdout, "isTTY", descriptor);
      };
    })();

    const restoreStderr = (() => {
      const descriptor = Object.getOwnPropertyDescriptor(process.stderr, "isTTY");
      Object.defineProperty(process.stderr, "isTTY", { configurable: true, value: true });
      return () => {
        if (descriptor) Object.defineProperty(process.stderr, "isTTY", descriptor);
      };
    })();

    vi.mocked(checkbox).mockResolvedValue([
      { domain: "mcp", key: "dry-mcp" } as any,
    ]);

    try {
      await removeCommand(undefined, undefined, { interactive: true, dryRun: true });
      const config = await manager.read();
      expect(config.resources.mcps["dry-mcp"]).toBeDefined();
    } finally {
      vi.mocked(checkbox).mockReset();
      restoreStdout();
      restoreStderr();
    }
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

  it("restoreCommand requires exact --from backup identifier", async () => {
    const { restoreCommand } = await import("../src/commands.js");

    await manager.write(createConfig({
      version: 1,
      source: "claude",
      clients: {},
      resources: createResources({
        mcps: { first: { command: "first" } },
      }),
    }));
    await manager.backup();

    await manager.write(createConfig({
      version: 1,
      source: "claude",
      clients: {},
      resources: createResources({
        mcps: { second: { command: "second" } },
      }),
    }));
    await manager.backup();

    await manager.write(createConfig({
      version: 1,
      source: "claude",
      clients: {},
      resources: createResources({
        mcps: { current: { command: "current" } },
      }),
    }));

    const previousExitCode = process.exitCode;
    try {
      process.exitCode = undefined;
      await restoreCommand({ from: "config.json" });
      const config = await manager.read();
      expect(config.resources.mcps.current).toBeDefined();
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = previousExitCode;
    }
  });

  it("restoreCommand does not overwrite config with invalid backup", async () => {
    const { restoreCommand } = await import("../src/commands.js");
    const fs = await import("fs/promises");
    const path = await import("path");

    await manager.write(createConfig({
      version: 1,
      source: "claude",
      clients: {},
      resources: createResources({
        mcps: { good: { command: "good" } },
      }),
    }));

    const backupPath = path.join(mockHome, ".synctax", "config.json.0000-invalid.bak");
    await fs.writeFile(backupPath, "{\"resources\":{\"mcps\":{\"oops\":{}}}}", "utf-8");

    const previousExitCode = process.exitCode;
    try {
      process.exitCode = undefined;
      await restoreCommand({ from: "config.json.0000-invalid.bak" });

      const config = await manager.read();
      expect(config.resources.mcps.good).toBeDefined();
      expect(config.resources.mcps.oops).toBeUndefined();
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = previousExitCode;
    }
  });

  it("initCommand saves the theme properly", async () => {
    const { initCommand } = await import("../src/commands.js");
    await initCommand({ theme: "cyber", force: true, detect: false, yes: true });
    
    const config = await manager.read();
    expect(config.theme).toBe("cyber");
  });

  it("initCommand defaults to synctax theme if not provided", async () => {
    const { initCommand } = await import("../src/commands.js");
    await initCommand({ force: true, detect: false, yes: true });
    
    const config = await manager.read();
    expect(config.theme).toBe("synctax");
  });

  it("initCommand normalizes source aliases to canonical client ids", async () => {
    const { initCommand } = await import("../src/commands.js");
    await initCommand({ source: "open-code", force: true, detect: false, yes: true });

    const config = await manager.read();
    expect(config.source).toBe("opencode");
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
    // Source client (pull from, never written to)
    adapters["mocksource"] = {
      id: "mocksource",
      name: "Mock Source",
      detect: async () => true,
      read: async () => ({ mcps: {}, agents: {}, skills: {} }),
      write: async () => {},
      getMemoryFileName: () => "SOURCE.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    } as any;
    // Target client (written to during sync)
    adapters["mocktarget"] = {
      id: "mocktarget",
      name: "Mock Target",
      detect: async () => true,
      read: async () => ({ mcps: {}, agents: {}, skills: {} }),
      write: async (resources: any) => {
        writes.push(resources);
      },
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => "mock memory",
      writeMemory: async () => {},
    } as any;

    await manager.write(createConfig({
      version: 1,
      source: "mocksource",
      activeProfile: "work",
      clients: { mocksource: { enabled: true }, mocktarget: { enabled: true } },
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

    await syncCommand({ dryRun: false, yes: true });

    expect(writes).toHaveLength(1);
    expect(writes[0].mcps["env-mcp"].env).toEqual({
      API_KEY: "from-profile",
      LITERAL: "ok",
    });

    delete adapters["mocksource"];
    delete adapters["mocktarget"];
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

  it("sync does not rewrite master config when source pull has no effective changes", async () => {
    const { syncCommand } = await import("../src/commands.js");

    adapters["noopsource"] = {
      id: "noopsource",
      name: "No-op Source",
      detect: async () => true,
      read: async () => ({ mcps: {}, agents: {}, skills: {} }),
      write: async () => {},
      getMemoryFileName: () => "NOOP.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    } as any;

    await manager.write(createConfig({
      version: 1,
      source: "noopsource",
      theme: "synctax",
      clients: { noopsource: { enabled: true } },
      resources: {
        mcps: {},
        agents: {},
        skills: {},
        permissions: createPermissions(),
      },
    }));

    const writeSpy = vi.spyOn(ConfigManager.prototype, "write");

    try {
      await syncCommand({ dryRun: false, yes: true });
      expect(writeSpy).not.toHaveBeenCalled();

      const config = await manager.read();
      expect(config.theme).toBe("synctax");
    } finally {
      delete adapters["noopsource"];
    }
  });

  it("sync resolves aliased source and aliased enabled-client ids", async () => {
    const { syncCommand } = await import("../src/commands.js");
    const previousOpencode = adapters["opencode"];

    const sourceRead = vi.fn(async () => ({ mcps: {}, agents: {}, skills: {} }));
    const targetWrite = vi.fn(async () => {});

    adapters["opencode"] = {
      id: "opencode",
      name: "OpenCode",
      detect: async () => true,
      read: sourceRead,
      write: async () => {},
      getMemoryFileName: () => "AGENTS.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    } as any;

    adapters["mocktarget"] = {
      id: "mocktarget",
      name: "Mock Target",
      detect: async () => true,
      read: async () => ({ mcps: {}, agents: {}, skills: {} }),
      write: targetWrite,
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    } as any;

    await manager.write(createConfig({
      version: 1,
      source: "open code",
      clients: {
        "open code": { enabled: true },
        mocktarget: { enabled: true },
      },
      resources: {
        mcps: { "sync-mcp": { command: "echo" } },
        agents: {},
        skills: {},
        permissions: createPermissions(),
      },
    }));

    try {
      await syncCommand({ dryRun: false, yes: true });
      expect(sourceRead).toHaveBeenCalledTimes(1);
      expect(targetWrite).toHaveBeenCalledTimes(1);
    } finally {
      adapters["opencode"] = previousOpencode;
      delete adapters["mocktarget"];
    }
  });

  it("profilePullCommand fails gracefully on invalid payload", async () => {
    const { profilePullCommand } = await import("../src/commands.js");

    const brokenPayload = { name: "broken" };
    const fetchSpyInvalid = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      text: () => Promise.resolve(JSON.stringify(brokenPayload)),
    } as any);

    await profilePullCommand("https://dummy.url");
    const config = await manager.read();
    expect(config.profiles["broken"]).toBeUndefined();
    fetchSpyInvalid.mockRestore();
  });

  it("profilePullCommand merges supported profile domains", async () => {
    const { profilePullCommand } = await import("../src/commands.js");

    const mergePayload = {
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
    };
    const fetchSpyMerge = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      text: () => Promise.resolve(JSON.stringify(mergePayload)),
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

  it("profilePullCommand rejects unsafe resource keys", async () => {
    const { profilePullCommand } = await import("../src/commands.js");
    const previousExitCode = process.exitCode;

    const unsafePayload = {
      name: "unsafe-profile",
      profile: { include: [] },
      resources: {
        mcps: {
          "../../escape": { command: "echo", args: ["oops"] },
        },
      },
    };
    const fetchSpyUnsafe = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      text: () => Promise.resolve(JSON.stringify(unsafePayload)),
    } as any);

    try {
      process.exitCode = undefined;
      await profilePullCommand("https://dummy.url");

      const config = await manager.read();
      expect(config.resources.mcps["../../escape"]).toBeUndefined();
      expect(config.profiles["unsafe-profile"]).toBeUndefined();
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = previousExitCode;
      fetchSpyUnsafe.mockRestore();
    }
  });

  it("profile publish/pull round-trip keeps supported resources and excludes credentials", async () => {
    const { profilePullCommand, profilePublishCommand } = await import("../src/commands.js");

    await manager.write(createConfig({
      version: 1,
      source: "claude",
      clients: {},
      profiles: {
        "team-profile": { include: ["team-mcp", "team-agent", "team-skill", "permissions", "models", "prompts"], exclude: ["skip-this"] },
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

    const roundTripPayload = { ...published, name: "imported-team-profile" };
    const fetchSpyRoundTrip = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      text: () => Promise.resolve(JSON.stringify(roundTripPayload)),
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

describe("P0 audit fixes", () => {
  let mockHome: string;
  let manager: ConfigManager;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-p0-audit-"));
    process.env.SYNCTAX_HOME = mockHome;
    await fs.mkdir(path.join(mockHome, ".synctax"), { recursive: true });
    manager = new ConfigManager();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  it("doctorCommand output says synctax not agentsync", async () => {
    const { doctorCommand } = await import("../src/commands.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await manager.write(createConfig({
      version: 1,
      clients: { mockclient: { enabled: true } },
      resources: createResources(),
    }));

    // Register a mock adapter so the doctor check can find it
    adapters["mockclient"] = {
      id: "mockclient",
      name: "Mock Client",
      detect: async () => true,
      read: async () => ({ mcps: {}, agents: {}, skills: {}, permissions: createPermissions() }),
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    } as any;

    try {
      await doctorCommand({});
      const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain("synctax");
      expect(output.toLowerCase()).not.toContain("agentsync");
    } finally {
      delete adapters["mockclient"];
    }
  });

  it("doctorCommand does not report all-passed with zero enabled clients", async () => {
    const { doctorCommand } = await import("../src/commands.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await manager.write(createConfig({
      version: 1,
      clients: {},
      resources: createResources(),
    }));

    const result = await doctorCommand({});

    expect(result).toBe(false);
    const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).not.toContain("All checks passed");
  });

  it("sync --dry-run does not write master config when source has new resources", async () => {
    const { syncCommand } = await import("../src/commands.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Register mock source adapter that returns extra MCPs
    adapters["drysource"] = {
      id: "drysource",
      name: "Dry Source",
      detect: async () => true,
      read: async () => ({
        mcps: { "new-from-source": { command: "node", args: ["server.js"] } },
        agents: {},
        skills: {},
        permissions: createPermissions(),
      }),
      write: async () => {},
      getMemoryFileName: () => "DRY.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    } as any;

    // Write initial config with drysource as the source
    await manager.write(createConfig({
      version: 1,
      source: "drysource",
      clients: { drysource: { enabled: true } },
      resources: createResources({
        mcps: { "existing-mcp": { command: "echo" } },
      }),
    }));

    // Snapshot config file content BEFORE
    const configPath = path.join(mockHome, ".synctax", "config.json");
    const before = await fs.readFile(configPath, "utf-8");

    // Run sync with --dry-run
    await syncCommand({ dryRun: true });

    // Read config file content AFTER
    const after = await fs.readFile(configPath, "utf-8");

    // Assert content is UNCHANGED
    expect(after).toBe(before);

    // Clean up mock adapter
    delete adapters["drysource"];
  });
});

describe("P1 sync safety fixes", () => {
  let mockHome: string;
  let manager: any;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-p1-sync-"));
    process.env.SYNCTAX_HOME = mockHome;
    const { ConfigManager } = await import("../src/config.js");
    manager = new ConfigManager();
  });

  afterEach(async () => {
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  it("sync skips writing to clients whose analyze failed", async () => {
    const { syncCommand } = await import("../src/commands.js");
    const { adapters } = await import("../src/adapters/index.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const failWrite = vi.fn();
    const okWrite = vi.fn();

    adapters["p1-fail"] = {
      id: "p1-fail",
      name: "FailClient",
      detect: async () => true,
      read: async () => { throw new Error("simulated analyze failure"); },
      write: failWrite,
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    } as any;

    adapters["p1-ok"] = {
      id: "p1-ok",
      name: "OkClient",
      detect: async () => true,
      read: async () => ({ mcps: {}, agents: {}, skills: {}, permissions: undefined }),
      write: okWrite,
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    } as any;

    await manager.write(createConfig({
      version: 1,
      clients: { "p1-fail": { enabled: true }, "p1-ok": { enabled: true } },
      resources: createResources({
        mcps: { "test-mcp": { command: "echo" } },
      }),
    }));

    try {
      await syncCommand({ dryRun: false, yes: true });
      expect(failWrite).not.toHaveBeenCalled();
      expect(okWrite).toHaveBeenCalled();
    } finally {
      delete adapters["p1-fail"];
      delete adapters["p1-ok"];
      logSpy.mockRestore();
    }
  });

  it("sync reports source-pull changes in output", async () => {
    const { syncCommand } = await import("../src/commands.js");
    const { adapters } = await import("../src/adapters/index.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    adapters["p1-source"] = {
      id: "p1-source",
      name: "SourceClient",
      detect: async () => true,
      read: async () => ({
        mcps: { "new-from-source": { command: "injected" } },
        agents: {},
        skills: {},
        permissions: undefined,
      }),
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    } as any;

    await manager.write(createConfig({
      version: 1,
      source: "p1-source",
      clients: { "p1-source": { enabled: true } },
      resources: createResources({}),
    }));

    try {
      await syncCommand({ dryRun: false, yes: true });
      const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(output).toContain("Source pull modified master config");
      expect(output).toContain("mcps");
    } finally {
      delete adapters["p1-source"];
      logSpy.mockRestore();
    }
  });
});

describe("XPLAT bug fixes", () => {
  let mockHome: string;
  let manager: any;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-xplat-"));
    process.env.SYNCTAX_HOME = mockHome;
    const { ConfigManager } = await import("../src/config.js");
    manager = new ConfigManager();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  it("sync with source that has models/prompts merges them into master", async () => {
    const { syncCommand } = await import("../src/commands.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    adapters["model-source"] = {
      id: "model-source",
      name: "Model Source",
      detect: async () => true,
      read: async () => ({
        mcps: {},
        agents: {},
        skills: {},
        permissions: undefined,
        models: { defaultModel: "gpt-5-turbo" },
        prompts: { globalSystemPrompt: "You are a helpful assistant." },
      }),
      write: async () => {},
      getMemoryFileName: () => "SOURCE.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    } as any;

    adapters["model-target"] = {
      id: "model-target",
      name: "Model Target",
      detect: async () => true,
      read: async () => ({ mcps: {}, agents: {}, skills: {} }),
      write: async () => {},
      getMemoryFileName: () => "TARGET.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    } as any;

    await manager.write(createConfig({
      version: 1,
      source: "model-source",
      clients: {
        "model-source": { enabled: true },
        "model-target": { enabled: true },
      },
      resources: createResources({
        mcps: {},
        agents: {},
        skills: {},
        permissions: createPermissions(),
      }),
    }));

    try {
      await syncCommand({ dryRun: false, yes: true });
      const config = await manager.read();
      expect(config.resources.models?.defaultModel).toBe("gpt-5-turbo");
      expect(config.resources.prompts?.globalSystemPrompt).toBe("You are a helpful assistant.");
    } finally {
      delete adapters["model-source"];
      delete adapters["model-target"];
      logSpy.mockRestore();
    }
  });
});

describe("P2 pull dry-run", () => {
  let mockHome: string;
  let manager: ConfigManager;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-p2-pull-dryrun-"));
    process.env.SYNCTAX_HOME = mockHome;
    await fs.mkdir(path.join(mockHome, ".synctax"), { recursive: true });
    manager = new ConfigManager();
    await manager.write(createConfig({
      version: 1,
      source: "claude",
      clients: {},
      resources: createResources({
        mcps: { "existing-mcp": { command: "echo" } },
        agents: {},
        skills: {},
        permissions: createPermissions(),
      }),
    }));

    adapters["dryrun-mock"] = {
      id: "dryrun-mock",
      name: "DryRun Mock",
      detect: async () => true,
      read: async () => ({
        mcps: { "new-mcp": { command: "node" } },
        agents: { "new-agent": { name: "A", prompt: "p" } },
        skills: {},
        permissions: createPermissions(),
      }),
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    } as any;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
    delete adapters["dryrun-mock"];
  });

  it("pull --dry-run does not write master config", async () => {
    const configPath = path.join(mockHome, ".synctax", "config.json");
    const before = await fs.readFile(configPath, "utf-8");

    await pullCommand({ from: "dryrun-mock", dryRun: true });

    const after = await fs.readFile(configPath, "utf-8");
    expect(after).toBe(before);

    const config = await manager.read();
    expect(config.resources.mcps["new-mcp"]).toBeUndefined();
    expect(config.resources.mcps["existing-mcp"]).toBeDefined();
  });

  it("pull --dry-run prints summary with resource counts", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await pullCommand({ from: "dryrun-mock", dryRun: true });

    const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Dry-run");
    expect(output).toContain("MCPs");
    expect(output).toContain("Agents");
    logSpy.mockRestore();
  });
});

describe("SEC-09 JSON output", () => {
  let mockHome: string;
  let manager: ConfigManager;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-sec09-json-"));
    process.env.SYNCTAX_HOME = mockHome;
    await fs.mkdir(path.join(mockHome, ".synctax"), { recursive: true });
    manager = new ConfigManager();
    await manager.write(createConfig({
      version: 1,
      source: "claude",
      clients: { "json-mock": { enabled: true } },
      resources: createResources({
        mcps: { "test-mcp": { command: "echo" } },
        agents: {},
        skills: {},
        permissions: createPermissions(),
      }),
    }));

    adapters["json-mock"] = {
      id: "json-mock",
      name: "JSON Mock",
      detect: async () => true,
      read: async () => ({ mcps: {}, agents: {}, skills: {}, permissions: createPermissions() }),
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    } as any;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
    delete adapters["json-mock"];
  });

  it("doctorCommand --json outputs valid JSON with healthy field", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await doctorCommand({ json: true });

    const jsonCalls = logSpy.mock.calls.filter((c) => {
      try { JSON.parse(String(c[0])); return true; } catch { return false; }
    });
    expect(jsonCalls.length).toBeGreaterThanOrEqual(1);
    const parsed = JSON.parse(String(jsonCalls[0]![0]));
    expect(parsed).toHaveProperty("healthy");
    expect(parsed).toHaveProperty("clients");
    expect(parsed).toHaveProperty("warnings");
    expect(typeof parsed.healthy).toBe("boolean");

    logSpy.mockRestore();
  });

  it("statusCommand --json outputs valid JSON with resource counts", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await statusCommand({ json: true });

    const jsonCalls = logSpy.mock.calls.filter((c) => {
      try { JSON.parse(String(c[0])); return true; } catch { return false; }
    });
    expect(jsonCalls.length).toBeGreaterThanOrEqual(1);
    const parsed = JSON.parse(String(jsonCalls[0]![0]));
    expect(parsed).toHaveProperty("mcpCount");
    expect(parsed).toHaveProperty("agentCount");
    expect(parsed).toHaveProperty("skillCount");
    expect(parsed).toHaveProperty("clients");
    expect(parsed).toHaveProperty("warnings");

    logSpy.mockRestore();
  });
});

describe("SYNC-04 source merge includes models and prompts", () => {
  let mockHome: string;
  let manager: ConfigManager;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-sync04-"));
    process.env.SYNCTAX_HOME = mockHome;
    await fs.mkdir(path.join(mockHome, ".synctax"), { recursive: true });
    manager = new ConfigManager();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
    delete adapters["sync04-source"];
    delete adapters["sync04-target"];
  });

  it("sync source merge includes models and prompts", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    adapters["sync04-source"] = {
      id: "sync04-source",
      name: "SYNC04 Source",
      detect: async () => true,
      read: async () => ({
        mcps: {},
        agents: {},
        skills: {},
        permissions: undefined,
        models: { defaultModel: "claude-opus" },
        prompts: { globalSystemPrompt: "Be precise." },
      }),
      write: async () => {},
      getMemoryFileName: () => "S.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    } as any;

    adapters["sync04-target"] = {
      id: "sync04-target",
      name: "SYNC04 Target",
      detect: async () => true,
      read: async () => ({ mcps: {}, agents: {}, skills: {} }),
      write: async () => {},
      getMemoryFileName: () => "T.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    } as any;

    await manager.write(createConfig({
      version: 1,
      source: "sync04-source",
      clients: {
        "sync04-source": { enabled: true },
        "sync04-target": { enabled: true },
      },
      resources: createResources({
        mcps: {},
        agents: {},
        skills: {},
        permissions: createPermissions(),
      }),
    }));

    await syncCommand({ dryRun: false, yes: true });

    const config = await manager.read();
    expect(config.resources.models?.defaultModel).toBe("claude-opus");
    expect(config.resources.prompts?.globalSystemPrompt).toBe("Be precise.");
    logSpy.mockRestore();
  });
});
