import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { ConfigManager } from "../../src/config.js";
import { CursorAdapter } from "../../src/adapters/cursor.js";
import { OpenCodeAdapter } from "../../src/adapters/opencode.js";

describe("E2E Configuration Sync across Clients", () => {
  let tmpDir: string;
  let originalCwd: string;
  let originalSynctaxHome: string | undefined;
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-e2e-"));
    originalSynctaxHome = process.env.SYNCTAX_HOME;
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;

    process.env.SYNCTAX_HOME = tmpDir;
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;

    // Change cwd so project-scoped adapters operate in sandbox
    originalCwd = process.cwd();
    process.chdir(tmpDir);

  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tmpDir, { recursive: true, force: true });
    if (originalSynctaxHome === undefined) delete process.env.SYNCTAX_HOME;
    else process.env.SYNCTAX_HOME = originalSynctaxHome;
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = originalUserProfile;
    vi.restoreAllMocks();
  });

  it("should pull from Cursor and sync to OpenCode successfully", async () => {
    const cursorDir = path.join(tmpDir, ".cursor");
    await fs.mkdir(cursorDir, { recursive: true });
    await fs.writeFile(
      path.join(cursorDir, "mcp.json"),
      JSON.stringify({
        mcpServers: {
          "cursor-db": {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-postgres"],
            env: { DB_URL: "postgres://localhost" },
          },
        },
      })
    );
    await fs.writeFile(
      path.join(cursorDir, "modes.json"),
      JSON.stringify({
        modes: {
          "Cursor Assistant": {
            name: "Cursor Assistant",
            description: "A friendly assistant",
            systemPrompt: "You are helpful.",
          },
        },
      })
    );

    // We mock console.log so we don't spam test output, but we allow errors to pass
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('✗')) {
        console.error(...args);
      }
    });

    // 2. Initialize synctax master config through ConfigManager to match schema defaults
    const manager = new ConfigManager();
    const cursorAdapter = new CursorAdapter();
    const opencodeAdapter = new OpenCodeAdapter();
    await manager.write({
      version: 1,
      source: "cursor",
      clients: {
        cursor: { enabled: true },
        opencode: { enabled: true },
      },
      resources: {
        mcps: {},
        agents: {},
        skills: {},
      },
      profiles: { default: {} },
      activeProfile: "default",
      theme: "rebel",
    } as any);

    // 3. Pull from Cursor (direct adapter read + merge to avoid global adapter registry race)
    const pulled = await cursorAdapter.read();
    const merged = await manager.read();
    merged.resources.mcps = { ...merged.resources.mcps, ...pulled.mcps };
    merged.resources.agents = { ...merged.resources.agents, ...pulled.agents };
    merged.resources.skills = { ...merged.resources.skills, ...pulled.skills };
    await manager.write(merged);

    // Verify master config pulled the resources
    const masterConfig = await manager.read();
    expect(masterConfig.resources.mcps["cursor-db"]).toBeDefined();
    expect(masterConfig.resources.mcps["cursor-db"].command).toBe("npx");
    expect(masterConfig.resources.agents["Cursor Assistant"]).toBeDefined();

    // 4. Sync out to OpenCode (direct adapter write to avoid command-level globals)
    const current = await manager.read();
    await opencodeAdapter.write(current.resources);

    // 5. Verify OpenCode received the configuration
    // OpenCode adapter falls back to .config/opencode/config.json if no specific project or user exists
    let opencodeConf: any;
    try {
      opencodeConf = JSON.parse(await fs.readFile(path.join(tmpDir, ".config", "opencode", "config.json"), "utf-8"));
    } catch {
      opencodeConf = JSON.parse(await fs.readFile(path.join(tmpDir, "opencode.json"), "utf-8"));
    }
    
    expect(opencodeConf).toBeDefined();
    expect(opencodeConf.mcp["cursor-db"]).toBeDefined();
    expect(opencodeConf.mcp["cursor-db"].command).toBe("npx");
    
    expect(opencodeConf.agents["Cursor Assistant"]).toBeDefined();
    expect(opencodeConf.agents["Cursor Assistant"].system_message).toBe("You are helpful.");

    consoleLogSpy.mockRestore();
  });
});
