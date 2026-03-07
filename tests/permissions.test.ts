import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConfigManager } from "../src/config.js";
import { ClaudeAdapter } from "../src/adapters/claude.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("Permissions Domain & Merge-Conservative Logic", () => {
  let mockHome: string;
  let manager: ConfigManager;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-permissions-test-"));
    process.env.SYNCTAX_HOME = mockHome;
    await fs.mkdir(path.join(mockHome, ".synctax"), { recursive: true });
    manager = new ConfigManager();
  });

  afterEach(async () => {
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  it("ClaudeAdapter maps allowed_paths and deny_paths conservatively", async () => {
    const adapter = new ClaudeAdapter();
    const settingsPath = path.join(mockHome, ".claude", "settings.json");
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });

    // Simulate user editing Claude Code directly
    await fs.writeFile(settingsPath, JSON.stringify({
      allow_paths: ["/home/user/src", "/tmp/unsafe"],
      deny_paths: ["/etc"],
      bash_allow: ["echo"]
    }));

    const data = await adapter.read();
    expect(data.permissions?.allowedPaths).toContain("/home/user/src");
    expect(data.permissions?.deniedPaths).toContain("/etc");

    // Write conservatively (simulate sync from master that denies /tmp/unsafe)
    await adapter.write({
      mcps: {}, agents: {}, skills: {},
      permissions: {
        allowedPaths: ["/home/user/src"],
        deniedPaths: ["/etc", "/tmp/unsafe"], // Master denies what was previously allowed
        allowedCommands: ["echo"],
        deniedCommands: ["rm"],
        networkAllow: false
      }
    });

    const newData = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
    expect(newData.allow_paths).toEqual(["/home/user/src"]);
    expect(newData.deny_paths).toEqual(["/etc", "/tmp/unsafe"]);
    expect(newData.bash_allow).toEqual(["echo"]);
  });

  it("Merge Logic (Conservative) - Deny always wins", async () => {
    // This tests the logic we will place inside syncCommand or pullCommand
    const { mergePermissions } = await import("../src/commands.js");

    const masterPerms = {
      allowedPaths: ["/home/src", "/usr/local"],
      deniedPaths: ["/etc"],
      allowedCommands: ["ls", "echo"],
      deniedCommands: [],
      networkAllow: true
    };

    const clientPerms = {
      allowedPaths: ["/home/src"], // Missing /usr/local
      deniedPaths: ["/etc", "/usr/local"], // Denies /usr/local explicitly
      allowedCommands: ["ls"],
      deniedCommands: ["echo"], // Explicitly denies echo
      networkAllow: false // Restrictive network
    };

    const merged = mergePermissions(masterPerms, clientPerms);

    // /usr/local should move from allowed to denied
    expect(merged.allowedPaths).not.toContain("/usr/local");
    expect(merged.deniedPaths).toContain("/usr/local");

    // echo should move from allowed to denied
    expect(merged.allowedCommands).not.toContain("echo");
    expect(merged.deniedCommands).toContain("echo");

    // Network should be false (conservative)
    expect(merged.networkAllow).toBe(false);
  });
});
