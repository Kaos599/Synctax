import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  profileCreateCommand,
  profileUseCommand,
  profileListCommand,
  profileDiffCommand,
  profilePullCommand,
  pullCommand,
  syncCommand,
} from "../src/commands.js";
import { ConfigManager } from "../src/config.js";
import { adapters } from "../src/adapters/index.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

async function readEnvFile(mockHome: string, profileName: string): Promise<string> {
  const envPath = path.join(mockHome, ".synctax", "envs", `${profileName}.env`);
  return fs.readFile(envPath, "utf-8");
}

describe("Profiles Domain", () => {
  let mockHome: string;
  let manager: ConfigManager;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-profiles-test-"));
    process.env.SYNCTAX_HOME = mockHome;
    await fs.mkdir(path.join(mockHome, ".synctax"), { recursive: true });

    manager = new ConfigManager();
    await manager.write({
      version: 1,
      activeProfile: "default",
      clients: {},
      profiles: {
        default: {}
      },
      resources: { mcps: {}, agents: {}, skills: {}, permissions: { allowedPaths: [] }, models: {}, prompts: {}, credentials: { envRefs: {} } }
    } as any);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  it("profileCreateCommand creates a new profile", async () => {
    await profileCreateCommand("work", { include: "mcp1,mcp2", exclude: "mcp3" });

    const config = await manager.read();
    expect(config.profiles["work"]).toBeDefined();
    expect(config.profiles["work"]?.include).toEqual(["mcp1", "mcp2"]);
    expect(config.profiles["work"]?.exclude).toEqual(["mcp3"]);
  });

  it("profileCreateCommand creates matching profile env file", async () => {
    await profileCreateCommand("work", {});

    await expect(readEnvFile(mockHome, "work")).resolves.toBe("");
  });

  it("profileUseCommand switches active profile", async () => {
    await manager.write({
      version: 1,
      activeProfile: "default",
      clients: {},
      profiles: {
        default: {},
        personal: {}
      },
      resources: { mcps: {}, agents: {}, skills: {}, permissions: { allowedPaths: [] }, models: {}, prompts: {}, credentials: { envRefs: {} } }
    } as any);

    await profileUseCommand("personal", { noSync: true });
    const config = await manager.read();
    expect(config.activeProfile).toBe("personal");
  });

  it("profileUseCommand ensures profile env file exists", async () => {
    await manager.write({
      version: 1,
      activeProfile: "default",
      clients: {},
      profiles: {
        default: {},
        personal: {},
      },
      resources: { mcps: {}, agents: {}, skills: {}, permissions: { allowedPaths: [] }, models: {}, prompts: {}, credentials: { envRefs: {} } }
    } as any);

    await profileUseCommand("personal", { noSync: true });

    await expect(readEnvFile(mockHome, "personal")).resolves.toBe("");
  });

  it("profile list shows active marker and counts", async () => {
    await manager.write({
      version: 1,
      activeProfile: "work",
      clients: {},
      profiles: {
        default: {},
        work: { include: ["work-mcp", "work-agent"], exclude: ["home-skill"] },
      },
      resources: { mcps: {}, agents: {}, skills: {}, permissions: { allowedPaths: [] }, models: {}, prompts: {}, credentials: { envRefs: {} } }
    } as any);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await profileListCommand();

    const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("work (active)");
    expect(output).toContain("2 includes, 1 exclude");
    expect(output).toContain("2 profiles listed");
  });

  it("profile diff shows included and excluded resources based on resolved profile effect", async () => {
    await manager.write({
      version: 1,
      activeProfile: "default",
      clients: {},
      profiles: {
        default: {},
        base: { include: ["alpha", "agent-alpha", "skill-base"] },
        child: { extends: "base", include: ["beta", "agent-beta"] },
      },
      resources: {
        mcps: {
          alpha: { command: "alpha" },
          beta: { command: "beta" },
          gamma: { command: "gamma" },
        },
        agents: {
          "agent-alpha": { name: "Agent Alpha", prompt: "alpha" },
          "agent-beta": { name: "Agent Beta", prompt: "beta" },
        },
        skills: {
          "skill-base": { name: "Skill Base", content: "base" },
        },
        permissions: { allowedPaths: [] },
        models: {},
        prompts: {},
        credentials: { envRefs: {} },
      }
    } as any);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await profileDiffCommand("child");

    const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Profile diff: child");
    expect(output).toContain("Included (1): beta");
    expect(output).toContain("Excluded (2): alpha, gamma");
    expect(output).toContain("Included (1): agent-beta");
    expect(output).toContain("Excluded (1): agent-alpha");
    expect(output).toContain("Included (0): (none)");
    expect(output).toContain("Excluded (1): skill-base");
  });

  it("profileDiffCommand for missing profile is graceful and does not throw", async () => {
    const previousExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      process.exitCode = undefined;
      await expect(profileDiffCommand("missing")).resolves.toBeUndefined();
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = previousExitCode;
      errorSpy.mockRestore();
    }
  });

  it("profileDiffCommand handles resolver failures gracefully and sets non-zero exitCode", async () => {
    const previousExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      process.exitCode = undefined;
      await manager.write({
        version: 1,
        activeProfile: "default",
        clients: {},
        profiles: {
          default: {},
          broken: { extends: "missing-base" },
        },
        resources: {
          mcps: { demo: { command: "demo" } },
          agents: {},
          skills: {},
          permissions: { allowedPaths: [] },
          models: {},
          prompts: {},
          credentials: { envRefs: {} },
        },
      } as any);

      await expect(profileDiffCommand("broken")).resolves.toBeUndefined();
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = previousExitCode;
      errorSpy.mockRestore();
    }
  });

  it("profileListCommand JSON output matches contract", async () => {
    await manager.write({
      version: 1,
      activeProfile: "work",
      clients: {},
      profiles: {
        default: {},
        work: { include: ["alpha"], exclude: ["beta"] },
      },
      resources: { mcps: {}, agents: {}, skills: {}, permissions: { allowedPaths: [] }, models: {}, prompts: {}, credentials: { envRefs: {} } },
    } as any);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await profileListCommand({ json: true });

      const payload = JSON.parse(String(logSpy.mock.calls[logSpy.mock.calls.length - 1]?.[0]));
      expect(payload).toEqual({
        activeProfile: "work",
        count: 2,
        profiles: [
          { name: "default", active: false, include: [], exclude: [] },
          { name: "work", active: true, include: ["alpha"], exclude: ["beta"] },
        ],
      });
    } finally {
      logSpy.mockRestore();
    }
  });

  it("profileDiffCommand JSON output matches contract", async () => {
    await manager.write({
      version: 1,
      activeProfile: "default",
      clients: {},
      profiles: {
        default: {},
        child: { include: ["beta", "agent-beta"] },
      },
      resources: {
        mcps: {
          alpha: { command: "alpha" },
          beta: { command: "beta" },
        },
        agents: {
          "agent-alpha": { name: "Agent Alpha", prompt: "alpha" },
          "agent-beta": { name: "Agent Beta", prompt: "beta" },
        },
        skills: {
          "skill-base": { name: "Skill Base", content: "base" },
        },
        permissions: { allowedPaths: [] },
        models: {},
        prompts: {},
        credentials: { envRefs: {} },
      }
    } as any);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await profileDiffCommand("child", { json: true });

      const payload = JSON.parse(String(logSpy.mock.calls[logSpy.mock.calls.length - 1]?.[0]));
      expect(payload).toEqual({
        profile: "child",
        resolvedProfile: { include: ["beta", "agent-beta"] },
        domains: [
          { key: "mcps", label: "MCPs", included: ["beta"], excluded: ["alpha"] },
          { key: "agents", label: "Agents", included: ["agent-beta"], excluded: ["agent-alpha"] },
          { key: "skills", label: "Skills", included: [], excluded: ["skill-base"] },
        ],
      });
    } finally {
      logSpy.mockRestore();
    }
  });


  it("syncCommand respects profile filters", async () => {
    await manager.write({
      version: 1,
      activeProfile: "work",
      clients: { mockclient: { enabled: true } },
      profiles: {
        work: { include: ["work-mcp", "work-agent"] }
      },
      resources: {
        mcps: {
          "work-mcp": { command: "work-mcp" },
          "home-mcp": { command: "home-mcp" }
        },
        agents: {
          "work-agent": { name: "Work", prompt: "Work" },
          "home-agent": { name: "Home", prompt: "Home" }
        }
      }
    } as any);

    const { applyProfileFilter } = await import("../src/commands.js");
    const config = await manager.read();

    const filtered = await applyProfileFilter(config.resources, config.profiles[config.activeProfile]);

    expect(filtered.mcps["work-mcp"]).toBeDefined();
    expect(filtered.mcps["home-mcp"]).toBeUndefined();
    expect(filtered.agents["work-agent"]).toBeDefined();
    expect(filtered.agents["home-agent"]).toBeUndefined();
  });

  it("syncCommand resolves active profile extends chain", async () => {
    let writtenResources: any;
    const existingAdapter = adapters["mockclient"];
    adapters["mockclient"] = {
      id: "mockclient",
      name: "Mock Client",
      detect: async () => true,
      read: async () => ({ mcps: {}, agents: {}, skills: {} }),
      write: async (resources: any) => {
        writtenResources = resources;
      },
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    };

    try {
      await manager.write({
        version: 1,
        activeProfile: "child",
        clients: { mockclient: { enabled: true } },
        profiles: {
          base: { include: ["base-mcp"] },
          child: { extends: "base" },
        },
        resources: {
          mcps: {
            "base-mcp": { command: "base" },
            "other-mcp": { command: "other" },
          },
          agents: {},
          skills: {},
        },
      } as any);

      await syncCommand({ dryRun: false });

      expect(writtenResources.mcps["base-mcp"]).toBeDefined();
      expect(writtenResources.mcps["other-mcp"]).toBeUndefined();
    } finally {
      if (existingAdapter) {
        adapters["mockclient"] = existingAdapter;
      } else {
        delete adapters["mockclient"];
      }
    }
  });

  it("syncCommand handles profile resolver errors gracefully", async () => {
    const existingAdapter = adapters["mockclient"];
    const write = vi.fn(async () => {});
    adapters["mockclient"] = {
      id: "mockclient",
      name: "Mock Client",
      detect: async () => true,
      read: async () => ({ mcps: {}, agents: {}, skills: {} }),
      write,
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    };

    const previousExitCode = process.exitCode;

    try {
      process.exitCode = undefined;
      await manager.write({
        version: 1,
        activeProfile: "missing",
        clients: { mockclient: { enabled: true } },
        profiles: {
          default: {},
        },
        resources: {
          mcps: { demo: { command: "demo" } },
          agents: {},
          skills: {},
        },
      } as any);

      await syncCommand({ dryRun: false });

      expect(process.exitCode).toBe(1);
      expect(write).not.toHaveBeenCalled();
    } finally {
      process.exitCode = previousExitCode;
      if (existingAdapter) {
        adapters["mockclient"] = existingAdapter;
      } else {
        delete adapters["mockclient"];
      }
    }
  });
});

describe("P1 safety audit fixes", () => {
  let mockHome: string;
  let manager: ConfigManager;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-p1-safety-"));
    process.env.SYNCTAX_HOME = mockHome;
    manager = new ConfigManager();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  it("pullCommand creates backup before writing", async () => {
    adapters["p1-pull-src"] = {
      id: "p1-pull-src",
      name: "PullSource",
      detect: async () => true,
      read: async () => ({ mcps: { "pulled-mcp": { command: "echo" } }, agents: {}, skills: {}, permissions: undefined }),
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    } as any;

    await manager.write({
      version: 1,
      source: "p1-pull-src",
      theme: "synctax",
      activeProfile: "default",
      clients: { "p1-pull-src": { enabled: true } },
      profiles: { default: {} },
      resources: { mcps: {}, agents: {}, skills: {}, permissions: { allowedPaths: [], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false, allow: [], deny: [], ask: [], allowedUrls: [], deniedUrls: [], trustedFolders: [] } },
    });

    try {
      await pullCommand({ from: "p1-pull-src" });
      const files = await fs.readdir(path.join(mockHome, ".synctax"));
      const bakFiles = files.filter((f) => f.endsWith(".bak"));
      expect(bakFiles.length).toBeGreaterThan(0);
    } finally {
      delete adapters["p1-pull-src"];
    }
  });

  it("pullCommand acquires and releases lock", async () => {
    adapters["p1-lock-src"] = {
      id: "p1-lock-src",
      name: "LockSource",
      detect: async () => true,
      read: async () => ({ mcps: {}, agents: {}, skills: {}, permissions: undefined }),
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    } as any;

    await manager.write({
      version: 1,
      source: "p1-lock-src",
      theme: "synctax",
      activeProfile: "default",
      clients: { "p1-lock-src": { enabled: true } },
      profiles: { default: {} },
      resources: { mcps: {}, agents: {}, skills: {}, permissions: { allowedPaths: [], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false, allow: [], deny: [], ask: [], allowedUrls: [], deniedUrls: [], trustedFolders: [] } },
    });

    try {
      await pullCommand({ from: "p1-lock-src" });
      // Lock should be released after command completes
      const lockPath = path.join(mockHome, ".synctax", "sync.lock");
      await expect(fs.access(lockPath)).rejects.toThrow();
    } finally {
      delete adapters["p1-lock-src"];
    }
  });

  it("profilePullCommand rejects non-HTTPS URLs", async () => {
    await manager.write({
      version: 1,
      theme: "synctax",
      activeProfile: "default",
      clients: {},
      profiles: { default: {} },
      resources: { mcps: {}, agents: {}, skills: {}, permissions: { allowedPaths: [], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false, allow: [], deny: [], ask: [], allowedUrls: [], deniedUrls: [], trustedFolders: [] } },
    });

    // HTTP to non-localhost should be rejected
    await profilePullCommand("http://evil.com/profile.json");
    // Check that an error was printed (exitCode set or error logged)
    expect(process.exitCode).toBe(1);
  });

  it("profilePullCommand allows localhost HTTP without protocol error", async () => {
    await manager.write({
      version: 1,
      theme: "synctax",
      activeProfile: "default",
      clients: {},
      profiles: { default: {} },
      resources: { mcps: {}, agents: {}, skills: {}, permissions: { allowedPaths: [], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false, allow: [], deny: [], ask: [], allowedUrls: [], deniedUrls: [], trustedFolders: [] } },
    });

    // HTTP to localhost — should fail with connection error, NOT protocol error
    await profilePullCommand("http://localhost:19999/profile.json");
    // The error should be about connection, not about HTTPS requirement
    const calls = vi.mocked(console.log).mock.calls.map((c) => String(c[0])).join("\n");
    expect(calls).not.toContain("requires HTTPS");
  });
});
