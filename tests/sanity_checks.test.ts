import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initCommand, memorySyncCommand, moveCommand, doctorCommand } from "../src/commands.js";
import { ConfigManager } from "../src/config.js";
import { GithubCopilotAdapter } from "../src/adapters/github-copilot.js";
import { GithubCopilotCliAdapter } from "../src/adapters/github-copilot-cli.js";
import { ClaudeAdapter } from "../src/adapters/claude.js";
import { adapters } from "../src/adapters/index.js";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createConfig, createPermissions, createResources, expectDefined } from "./test-helpers.js";

describe("TDD Sanity Checks for Copilot Flags", () => {
  let mockHome: string;
  let manager: ConfigManager;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-sanity-test-"));
    process.env.SYNCTAX_HOME = mockHome;
    manager = new ConfigManager();
  });

  afterEach(async () => {
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
    vi.restoreAllMocks();
  });

  it("sanity: initCommand sets up base config correctly", async () => {
    // Suppress console output
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await initCommand({ force: true, detect: false, source: "mock" });

    const config = await manager.read();
    expect(config.version).toBe(1);
    expect(config.source).toBe("mock");
    expect(config.resources).toBeDefined();

    consoleSpy.mockRestore();
  });

  it("sanity: moveCommand locates and updates scopes safely", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await manager.write(createConfig({
      version: 1,
      source: "mock",
      clients: {},
      resources: createResources({
        mcps: { "test-mcp": { command: "test", scope: "local" } },
        agents: {},
        skills: {},
        permissions: createPermissions(),
      }),
    }));

    await moveCommand("mcp", "test-mcp", { toGlobal: true });

    const config = await manager.read();
    expect(expectDefined(config.resources.mcps["test-mcp"], "Expected test-mcp to exist").scope).toBe("global");
    consoleSpy.mockRestore();
  });

  it("sanity: memorySyncCommand correctly iterates across enabled clients", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(mockHome);
    const cwd = process.cwd();

    await manager.write(createConfig({
      version: 1,
      source: "claude",
      clients: { "cursor": { enabled: true } },
      resources: createResources({ mcps: {}, agents: {}, skills: {}, permissions: createPermissions() }),
    }));

    // Mock a local CLAUDE.md file
    const sourceAdapter = new ClaudeAdapter();
    await fs.writeFile(path.join(cwd, "CLAUDE.md"), "Sanity Context");

    await memorySyncCommand({ source: "claude", dryRun: false });

    // Validate the cursor rules were written
    const cursorRules = await fs.readFile(path.join(cwd, ".cursorrules"), "utf-8");
    expect(cursorRules).toBe("Sanity Context");

    // Clean up current dir
    await fs.rm(path.join(cwd, "CLAUDE.md"));
    await fs.rm(path.join(cwd, ".cursorrules"));
    consoleSpy.mockRestore();
    cwdSpy.mockRestore();
  });

  it("sanity: GithubCopilotAdapter initializes properly", async () => {
    const adapter = new GithubCopilotAdapter();
    expect(adapter.id).toBe("github-copilot");
    expect(adapter.name).toBe("Github Copilot");
  });

  it("sanity: GithubCopilotCliAdapter initializes properly", async () => {
    const adapter = new GithubCopilotCliAdapter();
    expect(adapter.id).toBe("github-copilot-cli");
    expect(adapter.name).toBe("Github Copilot CLI");
  });

  it("sanity: ClaudeAdapter read parses v2 config format", async () => {
    const originalCwd = process.cwd();
    process.chdir(mockHome);
    try {
      const adapter = new ClaudeAdapter();
      const settingsPath = path.join(mockHome, ".claude", "settings.json");
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });

      await fs.writeFile(settingsPath, JSON.stringify({
        model: "claude-opus-4-20250514",
        permissions: {
          allow: ["Read(/safe/path)"],
          deny: [],
          ask: [],
        }
      }));

      const data = await adapter.read();
      expect(data.models?.defaultModel).toBe("claude-opus-4-20250514");
      expect(data.permissions?.allow).toContain("Read(/safe/path)");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("memorySyncCommand sets exitCode when source file is missing", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(mockHome);
    const originalExitCode = process.exitCode;

    await manager.write(createConfig({
      version: 1,
      source: "claude",
      clients: { "cursor": { enabled: true } },
      resources: createResources({ mcps: {}, agents: {}, skills: {}, permissions: createPermissions() }),
    }));

    // Do NOT create CLAUDE.md — source is missing
    await memorySyncCommand({ source: "claude" });

    expect(process.exitCode).toBe(1);
    const logs = consoleSpy.mock.calls.map(c => String(c[0])).join("\n");
    expect(logs).toContain("not found");

    process.exitCode = originalExitCode;
    consoleSpy.mockRestore();
    cwdSpy.mockRestore();
  });

  it("memorySyncCommand prints summary on success", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(mockHome);

    await manager.write(createConfig({
      version: 1,
      source: "claude",
      clients: { "cursor": { enabled: true } },
      resources: createResources({ mcps: {}, agents: {}, skills: {}, permissions: createPermissions() }),
    }));

    // Create source file
    const fs = await import("fs/promises");
    const path = await import("path");
    await fs.writeFile(path.join(mockHome, "CLAUDE.md"), "Test content");

    await memorySyncCommand({ source: "claude" });

    const logs = consoleSpy.mock.calls.map(c => String(c[0])).join("\n");
    expect(logs).toContain("Memory sync complete");

    // Clean up files created during sync
    try { await fs.rm(path.join(mockHome, "CLAUDE.md")); } catch {}
    try { await fs.rm(path.join(mockHome, ".cursorrules")); } catch {}
    consoleSpy.mockRestore();
    cwdSpy.mockRestore();
  });

  it("sanity: doctorCommand executes full cycle without crashing", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await manager.write(createConfig({
      version: 1,
      source: "claude",
      clients: { "claude": { enabled: true } },
      resources: createResources({ mcps: {}, agents: {}, skills: {}, permissions: createPermissions() }),
    }));

    // Provide the config so doctor passes
    await fs.mkdir(path.join(mockHome, ".claude"));
    await fs.writeFile(path.join(mockHome, ".claude", "settings.json"), "{}");

    const result = await doctorCommand({});
    expect(result).toBe(true);
    consoleSpy.mockRestore();
  });
});

describe("resolveCliEntryPath audit fix", () => {
  it("resolves to a path that exists on disk", async () => {
    const { resolveCliEntryPath } = await import("../src/install-path.js");
    const resolved = await resolveCliEntryPath();
    // Should not throw — the resolved path should exist
    await fs.access(resolved);
  });

  it("resolved path ends with synctax.js or synctax.ts", async () => {
    const { resolveCliEntryPath } = await import("../src/install-path.js");
    const resolved = await resolveCliEntryPath();
    expect(resolved).toMatch(/synctax\.(js|ts)$/);
  });
});
