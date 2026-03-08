import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { infoCommand } from "../src/commands.js";
import { ConfigManager } from "../src/config.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("Terminal UI Upgrades (Tabular Output)", () => {
  let mockHome: string;
  let manager: ConfigManager;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-ui-test-"));
    process.env.SYNCTAX_HOME = mockHome;
    await fs.mkdir(path.join(mockHome, ".synctax"), { recursive: true });
    manager = new ConfigManager();
  });

  afterEach(async () => {
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
    vi.clearAllMocks();
  });

  it("infoCommand generates a table containing adapter metrics", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await manager.write({
      version: 1, source: "claude",
      clients: { "claude": { enabled: true } },
      resources: { mcps: {}, agents: {}, skills: {}, permissions: { allowedPaths: [], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false } }
    } as any);

    // Mock claude having files so it detects
    await fs.mkdir(path.join(mockHome, ".claude"));
    await fs.writeFile(path.join(mockHome, ".claude", "settings.json"), JSON.stringify({
      mcpServers: { test: { command: "test" } }
    }));

    await infoCommand();

    // Check if console.log was called with string containing a table border character
    const logCalls = consoleSpy.mock.calls.map(c => c[0]).join("\n");
    expect(logCalls).toContain("Claude");
    expect(logCalls).toMatch(/1\s+MCPs?/);
    expect(logCalls).toMatch(/0\s+Agents?/);
    expect(logCalls).toMatch(/0\s+Skills?/);

    consoleSpy.mockRestore();
  });
});
