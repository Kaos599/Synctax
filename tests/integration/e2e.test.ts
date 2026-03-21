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
