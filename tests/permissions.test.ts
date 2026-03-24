import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConfigManager } from "../src/config.js";
import { ClaudeAdapter } from "../src/adapters/claude.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("Permissions Domain & Merge-Conservative Logic", () => {
  let mockHome: string;
  let manager: ConfigManager;
  let originalCwd: string;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-permissions-test-"));
    process.env.SYNCTAX_HOME = mockHome;
    originalCwd = process.cwd();
    process.chdir(mockHome);
    await fs.mkdir(path.join(mockHome, ".synctax"), { recursive: true });
    manager = new ConfigManager();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  it("ClaudeAdapter reads and writes permissions in Tool(specifier) format", async () => {
    const adapter = new ClaudeAdapter();
    const settingsPath = path.join(mockHome, ".claude", "settings.json");
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });

    // Claude Code v2 format: permissions.allow/deny/ask
    await fs.writeFile(settingsPath, JSON.stringify({
      permissions: {
        allow: ["Read(/home/user/src)", "Bash(echo)"],
        deny: ["Read(/etc)", "Bash(curl *)"],
        ask: ["Bash(git push *)"],
      }
    }));

    const data = await adapter.read();
    expect(data.permissions?.allow).toContain("Read(/home/user/src)");
    expect(data.permissions?.deny).toContain("Read(/etc)");
    expect(data.permissions?.ask).toContain("Bash(git push *)");

    // Write back with merged permissions
    await adapter.write({
      mcps: {}, agents: {}, skills: {},
      permissions: {
        allowedPaths: [], deniedPaths: [],
        allowedCommands: [], deniedCommands: [],
        networkAllow: false,
        allow: ["Read(/home/user/src)", "Bash(echo)"],
        deny: ["Read(/etc)", "Read(/tmp/unsafe)", "Bash(curl *)"],
        ask: [],
        allowedUrls: [], deniedUrls: [], trustedFolders: [],
      }
    });

    const newData = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
    expect(newData.permissions.allow).toContain("Read(/home/user/src)");
    expect(newData.permissions.deny).toContain("Read(/etc)");
    expect(newData.permissions.deny).toContain("Read(/tmp/unsafe)");
    // Old fields should NOT be present
    expect(newData.allow_paths).toBeUndefined();
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

  it("v2: deny wins over allow and ask in unified permissions", async () => {
    const { mergePermissions } = await import("../src/commands.js");

    const p1 = {
      allow: ["Bash(npm run *)", "Read(~/docs/**)"],
      deny: ["Bash(curl *)"],
      ask: ["Bash(git push *)"],
    };

    const p2 = {
      allow: ["Bash(npm test)"],
      deny: ["Bash(npm run *)", "Bash(git push *)"], // Denies what p1 allows/asks
      ask: [],
    };

    const merged = mergePermissions(p1, p2);
    expect(merged.allow).not.toContain("Bash(npm run *)");
    expect(merged.deny).toContain("Bash(npm run *)");
    expect(merged.ask).not.toContain("Bash(git push *)");
    expect(merged.deny).toContain("Bash(git push *)");
    expect(merged.allow).toContain("Read(~/docs/**)");
    expect(merged.allow).toContain("Bash(npm test)");
  });

  it("v2: URL deny wins over allow", async () => {
    const { mergePermissions } = await import("../src/commands.js");

    const p1 = { allowedUrls: ["https://api.example.com", "http://evil.com"], deniedUrls: [] };
    const p2 = { allowedUrls: [], deniedUrls: ["http://evil.com"] };

    const merged = mergePermissions(p1, p2);
    expect(merged.allowedUrls).toContain("https://api.example.com");
    expect(merged.allowedUrls).not.toContain("http://evil.com");
    expect(merged.deniedUrls).toContain("http://evil.com");
  });

  it("v2: trustedFolders uses intersection (conservative)", async () => {
    const { mergePermissions } = await import("../src/commands.js");

    const p1 = { trustedFolders: ["/Users/me/projects", "/tmp/build"] };
    const p2 = { trustedFolders: ["/Users/me/projects"] }; // Does NOT trust /tmp/build

    const merged = mergePermissions(p1, p2);
    expect(merged.trustedFolders).toContain("/Users/me/projects");
    expect(merged.trustedFolders).not.toContain("/tmp/build");
  });

  it("v2: merging with empty/undefined permissions preserves existing", async () => {
    const { mergePermissions } = await import("../src/commands.js");

    const p1 = {
      allowedPaths: ["/home"],
      allow: ["Bash(npm run *)"],
      networkAllow: true,
      trustedFolders: ["/Users/me"],
    };

    const merged = mergePermissions(p1, {});
    expect(merged.allowedPaths).toContain("/home");
    expect(merged.allow).toContain("Bash(npm run *)");
    // networkAllow: (true && undefined) || false = false — conservative
    expect(merged.networkAllow).toBe(false);
    // trustedFolders: p2 has no trustedFolders, so p1's are kept (no intersection needed)
    expect(merged.trustedFolders).toContain("/Users/me");
  });
});
