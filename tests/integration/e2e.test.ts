import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { pullCommand, syncCommand } from "../../src/commands.js";

describe("E2E Configuration Sync across Clients", () => {
  let tmpDir: string;
  let originalCwd: () => string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-e2e-"));
    process.env.SYNCTAX_HOME = tmpDir;

    // We must mock cwd so OpenCode adapter writes inside our sandbox
    originalCwd = process.cwd;
    process.cwd = () => tmpDir;
  });

  afterEach(async () => {
    process.cwd = originalCwd;
    await fs.rm(tmpDir, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
    vi.restoreAllMocks();
  });

  it("should pull from Cursor and sync to OpenCode successfully", async () => {
    // 1. Mock a Cursor environment
    const cursorDir = path.join(tmpDir, ".cursor");
    await fs.mkdir(cursorDir, { recursive: true });
    await fs.writeFile(
      path.join(cursorDir, "mcp.json"),
      JSON.stringify({
        mcpServers: {
          "cursor-db": {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-postgres"],
            env: { DB_URL: "postgres://localhost" }
          }
        }
      })
    );
    await fs.writeFile(
      path.join(cursorDir, "modes.json"),
      JSON.stringify({
        modes: {
          "Cursor Assistant": {
            name: "Cursor Assistant",
            description: "A friendly assistant",
            systemPrompt: "You are helpful."
          }
        }
      })
    );
    
    // We mock console.log so we don't spam test output, but we allow errors to pass
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('✗')) {
        console.error(...args);
      }
    });

    // 2. Initialize synctax master config implicitly or explicitly
    const configDir = path.join(tmpDir, ".synctax");
    await fs.mkdir(configDir, { recursive: true });
    const masterConfigPath = path.join(configDir, "config.json");
    await fs.writeFile(
      masterConfigPath,
      JSON.stringify({
        version: 1,
        source: "cursor",
        clients: {
          cursor: { enabled: true },
          opencode: { enabled: true }
        },
        resources: {
          mcps: {},
          agents: {},
          skills: {},
          permissions: { allow_paths: [] }
        },
        profiles: { default: {} },
        activeProfile: "default",
        credentials: {}
      })
    );

    // Pre-create OpenCode user config path so the adapter can write to it
    await fs.mkdir(path.join(tmpDir, ".config", "opencode"), { recursive: true });
    await fs.writeFile(path.join(tmpDir, ".config", "opencode", "config.json"), "{}");

    // 3. Pull from Cursor
    await pullCommand({ from: "cursor", merge: true });

    // Verify master config pulled the resources
    const masterConfig = JSON.parse(await fs.readFile(masterConfigPath, "utf-8"));
    expect(masterConfig.resources.mcps["cursor-db"]).toBeDefined();
    expect(masterConfig.resources.mcps["cursor-db"].command).toBe("npx");
    expect(masterConfig.resources.agents["Cursor Assistant"]).toBeDefined();

    // 4. Sync out to OpenCode
    await syncCommand({});

    // 5. Verify OpenCode received the configuration
    // OpenCode adapter writes user-scoped MCPs to ~/.config/opencode/config.json
    // or opencode.json depending on candidates
    const parsedConfigs: any[] = [];
    const candidates = [
      path.join(tmpDir, ".config", "opencode", "config.json"),
      path.join(tmpDir, "opencode.json"),
      path.join(tmpDir, ".opencode", "config.json"),
    ];
    for (const c of candidates) {
      try {
        parsedConfigs.push(JSON.parse(await fs.readFile(c, "utf-8")));
      } catch { /* try next */ }
    }
    expect(parsedConfigs.length).toBeGreaterThan(0);

    const merged = parsedConfigs.reduce((acc, cfg) => {
      if (cfg.mcp && typeof cfg.mcp === "object") {
        acc.mcp = { ...acc.mcp, ...cfg.mcp };
      }
      if (cfg.agent && typeof cfg.agent === "object") {
        acc.agent = { ...acc.agent, ...cfg.agent };
      }
      return acc;
    }, { mcp: {} as Record<string, any>, agent: {} as Record<string, any> });

    // After sync, MCPs should be in the OpenCode config
    expect(merged.mcp["cursor-db"]).toBeDefined();
    expect(merged.mcp["cursor-db"].command).toEqual(["npx", "-y", "@modelcontextprotocol/server-postgres"]);

    expect(merged.agent["Cursor Assistant"]?.prompt).toBe("You are helpful.");

    consoleLogSpy.mockRestore();
  });
});
