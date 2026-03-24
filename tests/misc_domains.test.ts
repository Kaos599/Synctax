import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConfigManager } from "../src/config.js";
import { ClaudeAdapter } from "../src/adapters/claude.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("Models, Prompts, & Credentials Domains", () => {
  let mockHome: string;
  let manager: ConfigManager;
  let originalCwd: string;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-misc-test-"));
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

  it("ClaudeAdapter maps model field (v2 format)", async () => {
    const adapter = new ClaudeAdapter();
    const settingsPath = path.join(mockHome, ".claude", "settings.json");
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });

    await fs.writeFile(settingsPath, JSON.stringify({
      model: "claude-opus-4-20250514",
    }));

    const data = await adapter.read();
    expect(data.models?.defaultModel).toBe("claude-opus-4-20250514");

    await adapter.write({
      mcps: {}, agents: {}, skills: {},
      models: { defaultModel: "claude-sonnet-4-20250514" },
    });

    const newData = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
    expect(newData.model).toBe("claude-sonnet-4-20250514");
    // Old fields should NOT be present
    expect(newData.preferredModel).toBeUndefined();
    expect(newData.customInstructions).toBeUndefined();
  });

  it("ConfigManager supports credentials without exposing secrets", async () => {
    await manager.write({
      version: 1,
      source: "claude",
      clients: {},
      resources: {
        mcps: {},
        agents: {},
        skills: {},
        permissions: { allowedPaths: [], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false },
        credentials: {
          envRefs: { "GITHUB_TOKEN": "$GITHUB_TOKEN" }
        }
      }
    } as any);

    const config = await manager.read();
    expect(config.resources.credentials?.envRefs["GITHUB_TOKEN"]).toBe("$GITHUB_TOKEN");
  });
});
