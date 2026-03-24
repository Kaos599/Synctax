import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ClaudeAdapter } from "../src/adapters/claude.js";
import { CursorAdapter } from "../src/adapters/cursor.js";
import { OpenCodeAdapter } from "../src/adapters/opencode.js";
import { AntigravityAdapter } from "../src/adapters/antigravity.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("Agents Domain", () => {
  let mockHome: string;
  let originalCwd: string;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-agents-test-"));
    process.env.SYNCTAX_HOME = mockHome;
    originalCwd = process.cwd();
    process.chdir(mockHome);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  it("ClaudeAdapter reads and writes Agents (.md files)", async () => {
    const adapter = new ClaudeAdapter();
    const agentsDir = path.join(mockHome, ".claude", "agents");
    await fs.mkdir(agentsDir, { recursive: true });

    // Pre-seed an agent
    const content = `---\nname: Coder\ndescription: A coding agent\nmodel: claude-3-opus-20240229\n---\nYou are a coding expert.\n`;
    await fs.writeFile(path.join(agentsDir, "Coder.md"), content);

    const data = await adapter.read();
    expect(data.agents["Coder"]).toBeDefined();
    expect(data.agents["Coder"].prompt).toBe("You are a coding expert.");
    expect(data.agents["Coder"].model).toBe("claude-3-opus-20240229");

    // Write a new agent
    await adapter.write({
      mcps: {},
      agents: {
        "Tester": {
          name: "Tester",
          prompt: "You write tests.",
          model: "claude-3-5-sonnet-20241022",
        }
      }
    });

    const newAgentContent = await fs.readFile(path.join(agentsDir, "Tester.md"), "utf-8");
    expect(newAgentContent).toContain("name: Tester");
    expect(newAgentContent).toContain("model: claude-3-5-sonnet-20241022");
    expect(newAgentContent).toContain("You write tests.");
  });

  it("CursorAdapter reads and writes Custom Modes (.cursor/modes.json)", async () => {
    const adapter = new CursorAdapter();
    await fs.mkdir(path.join(mockHome, ".cursor"), { recursive: true });

    await adapter.write({
      mcps: {},
      agents: {
        "Reviewer": {
          name: "Reviewer",
          prompt: "Review this code",
        }
      }
    });

    const modesFile = await fs.readFile(path.join(mockHome, ".cursor", "modes.json"), "utf-8");
    const json = JSON.parse(modesFile);
    expect(json.modes["Reviewer"].systemPrompt).toBe("Review this code");

    const data = await adapter.read();
    expect(data.agents["Reviewer"].prompt).toBe("Review this code");
  });

  it("OpenCodeAdapter reads and writes inline agents in config.json", async () => {
    const adapter = new OpenCodeAdapter();
    await adapter.write({
      mcps: {},
      agents: {
        "Planner": { name: "Planner", prompt: "Plan my tasks" }
      }
    });

    const configStr = await fs.readFile(path.join(mockHome, ".config", "opencode", "config.json"), "utf-8");
    const config = JSON.parse(configStr);
    expect(config.agents["Planner"].system_message).toBe("Plan my tasks");

    const data = await adapter.read();
    expect(data.agents["Planner"].prompt).toBe("Plan my tasks");
  });


  it("ClaudeAdapter ignores non-agent extensions but captures various .agent/.claude extensions", async () => {
    const adapter = new ClaudeAdapter();
    const agentsDir = path.join(mockHome, ".claude", "agents");
    await fs.mkdir(agentsDir, { recursive: true });

    // Pre-seed an agent
    const content = `---\nname: ValidAgent\n---\nYou are a coding expert.\n`;
    await fs.writeFile(path.join(agentsDir, "ValidAgent.md"), content);
    await fs.writeFile(path.join(agentsDir, "AnotherAgent.agent"), content);
    await fs.writeFile(path.join(agentsDir, "ClaudeAgent.claude"), content);
    await fs.writeFile(path.join(agentsDir, "BadAgent.txt"), content);

    const data = await adapter.read();
    expect(data.agents["ValidAgent"]).toBeDefined();
    expect(data.agents["AnotherAgent"]).toBeDefined();
    expect(data.agents["ClaudeAgent"]).toBeDefined();
    expect(data.agents["BadAgent"]).toBeUndefined();
  });
});
