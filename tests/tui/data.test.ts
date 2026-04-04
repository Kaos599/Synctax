import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigManager } from "../../src/config.js";
import { adapters } from "../../src/adapters/index.js";
import { loadTuiFrameData } from "../../src/tui/data.js";
import { getVersion } from "../../src/version.js";

describe("tui data loader", () => {
  let mockHome: string;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-tui-data-test-"));
    process.env.SYNCTAX_HOME = mockHome;
  });

  afterEach(async () => {
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  it("loads hydrated dashboard counts for explicit profile and source", async () => {
    const manager = new ConfigManager();
    await manager.write({
      version: 1,
      theme: "rebel",
      activeProfile: "team",
      source: "cursor",
      clients: {
        claude: { enabled: true },
        cursor: { enabled: false },
        opencode: { enabled: true },
      },
      profiles: {
        default: {},
      },
      resources: {
        mcps: {
          alpha: { command: "node", args: ["alpha.js"] },
          beta: { command: "node", args: ["beta.js"] },
        },
        agents: {
          helper: { name: "Helper", prompt: "Assist." },
        },
        skills: {
          lint: { name: "lint", content: "run lint" },
          test: { name: "test", content: "run tests" },
          build: { name: "build", content: "run build" },
        },
        permissions: {
          allowedPaths: [],
          deniedPaths: [],
          allowedCommands: [],
          deniedCommands: [],
          networkAllow: false,
          allow: [],
          deny: [],
          ask: [],
          allowedUrls: [],
          deniedUrls: [],
          trustedFolders: [],
        },
      },
    });

    const data = await loadTuiFrameData();

    expect(data.version).toBe(getVersion());
    expect(data.profile).toBe("team");
    expect(data.source).toBe("cursor");
    expect(data.enabledClients).toBe(2);
    expect(data.totalClients).toBe(Object.keys(adapters).length);
    expect(data.resourceCounts).toEqual({ mcps: 2, agents: 1, skills: 3 });
    expect(data.health).toBe("OK");
    expect(data.warnings).toEqual([]);
    expect(data.driftClients).toBe(0);
    expect(data.lastSync).toBe("unknown");
  });

  it("adds warnings for invalid source and no enabled clients", async () => {
    const manager = new ConfigManager();
    await manager.write({
      version: 1,
      theme: "rebel",
      activeProfile: "default",
      source: "not-a-client",
      clients: {
        cursor: { enabled: false },
      },
      profiles: {
        default: {},
      },
      resources: {
        mcps: {},
        agents: {},
        skills: {},
        permissions: {
          allowedPaths: [],
          deniedPaths: [],
          allowedCommands: [],
          deniedCommands: [],
          networkAllow: false,
          allow: [],
          deny: [],
          ask: [],
          allowedUrls: [],
          deniedUrls: [],
          trustedFolders: [],
        },
      },
    });

    const data = await loadTuiFrameData();

    expect(data.version).toBe(getVersion());
    expect(data.source).toBe("not-a-client");
    expect(data.enabledClients).toBe(0);
    expect(data.health).toBe("WARN");
    expect(data.warnings).toContain("Configured source 'not-a-client' is not a valid adapter.");
    expect(data.warnings).toContain("No enabled clients configured.");
  });

  it("uses defaults when profile and source are unset", async () => {
    const configPath = path.join(mockHome, ".synctax", "config.json");
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(
      configPath,
      JSON.stringify({
      version: 1,
      theme: "rebel",
      clients: {
        claude: { enabled: true },
      },
      profiles: {
        default: {},
      },
      resources: {
        mcps: {},
        agents: {},
        skills: {},
        permissions: {
          allowedPaths: [],
          deniedPaths: [],
          allowedCommands: [],
          deniedCommands: [],
          networkAllow: false,
          allow: [],
          deny: [],
          ask: [],
          allowedUrls: [],
          deniedUrls: [],
          trustedFolders: [],
        },
      },
      }),
      "utf-8",
    );

    const data = await loadTuiFrameData();

    expect(data.profile).toBe("default");
    expect(data.source).toBe("claude");
    expect(data.health).toBe("OK");
    expect(data.warnings).toEqual([]);
  });

  it("accepts trimmed configured source without falling back", async () => {
    const manager = new ConfigManager();
    await manager.write({
      version: 1,
      theme: "rebel",
      activeProfile: "default",
      source: " cursor ",
      clients: {
        cursor: { enabled: true },
      },
      profiles: {
        default: {},
      },
      resources: {
        mcps: {},
        agents: {},
        skills: {},
        permissions: {
          allowedPaths: [],
          deniedPaths: [],
          allowedCommands: [],
          deniedCommands: [],
          networkAllow: false,
          allow: [],
          deny: [],
          ask: [],
          allowedUrls: [],
          deniedUrls: [],
          trustedFolders: [],
        },
      },
    });

    const data = await loadTuiFrameData();

    expect(data.source).toBe("cursor");
    expect(data.health).toBe("OK");
    expect(data.warnings).toEqual([]);
  });

  it("treats source 'toString' as invalid and preserves it with warning", async () => {
    const manager = new ConfigManager();
    await manager.write({
      version: 1,
      theme: "rebel",
      activeProfile: "default",
      source: "toString",
      clients: {
        claude: { enabled: true },
      },
      profiles: {
        default: {},
      },
      resources: {
        mcps: {},
        agents: {},
        skills: {},
        permissions: {
          allowedPaths: [],
          deniedPaths: [],
          allowedCommands: [],
          deniedCommands: [],
          networkAllow: false,
          allow: [],
          deny: [],
          ask: [],
          allowedUrls: [],
          deniedUrls: [],
          trustedFolders: [],
        },
      },
    });

    const data = await loadTuiFrameData();

    expect(data.source).toBe("toString");
    expect(data.health).toBe("WARN");
    expect(data.warnings).toContain("Configured source 'toString' is not a valid adapter.");
  });

  it("does not count unknown enabled clients", async () => {
    const manager = new ConfigManager();
    await manager.write({
      version: 1,
      theme: "rebel",
      activeProfile: "default",
      source: "claude",
      clients: {
        claude: { enabled: true },
        "not-a-client": { enabled: true },
      },
      profiles: {
        default: {},
      },
      resources: {
        mcps: {},
        agents: {},
        skills: {},
        permissions: {
          allowedPaths: [],
          deniedPaths: [],
          allowedCommands: [],
          deniedCommands: [],
          networkAllow: false,
          allow: [],
          deny: [],
          ask: [],
          allowedUrls: [],
          deniedUrls: [],
          trustedFolders: [],
        },
      },
    });

    const data = await loadTuiFrameData();

    expect(data.enabledClients).toBe(1);
  });
});
