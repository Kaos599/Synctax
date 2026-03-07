import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ClaudeAdapter } from "../src/adapters/claude.js";
import { CursorAdapter } from "../src/adapters/cursor.js";
import { OpenCodeAdapter } from "../src/adapters/opencode.js";
import { AntigravityAdapter } from "../src/adapters/antigravity.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("Skills Domain", () => {
  let mockHome: string;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-skills-test-"));
    process.env.SYNCTAX_HOME = mockHome;
  });

  afterEach(async () => {
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  it("ClaudeAdapter reads and writes Skills (.claude/skills/SKILL.md files)", async () => {
    const adapter = new ClaudeAdapter();
    const skillsDir = path.join(mockHome, ".claude", "skills");
    await fs.mkdir(skillsDir, { recursive: true });

    const content = `---\nname: Refactor\ndescription: Refactoring helper\ntrigger: /refactor\n---\nRefactor the selected code.\n`;
    await fs.writeFile(path.join(skillsDir, "Refactor.md"), content);

    const data = await adapter.read();
    expect(data.skills["Refactor"]).toBeDefined();
    expect(data.skills["Refactor"].content).toBe("Refactor the selected code.");
    expect(data.skills["Refactor"].trigger).toBe("/refactor");

    await adapter.write({
      mcps: {},
      agents: {},
      skills: {
        "Test": {
          name: "Test",
          content: "Write a test.",
          trigger: "/test"
        }
      }
    });

    const newSkillContent = await fs.readFile(path.join(skillsDir, "Test.md"), "utf-8");
    expect(newSkillContent).toContain("name: Test");
    expect(newSkillContent).toContain("trigger: /test");
    expect(newSkillContent).toContain("Write a test.");
  });

  it("CursorAdapter reads and writes Custom Slash Commands (.cursor/commands/*.md)", async () => {
    const adapter = new CursorAdapter();
    const cmdDir = path.join(mockHome, ".cursor", "commands");
    await fs.mkdir(cmdDir, { recursive: true });

    await adapter.write({
      mcps: {},
      agents: {},
      skills: {
        "review": {
          name: "review",
          content: "Review this code",
          trigger: "/review"
        }
      }
    });

    const cmdFile = await fs.readFile(path.join(cmdDir, "review.md"), "utf-8");
    expect(cmdFile).toContain("Review this code");

    const data = await adapter.read();
    expect(data.skills["review"].content).toBe("Review this code");
  });

  it("OpenCodeAdapter reads and writes inline skills in config.json", async () => {
    const adapter = new OpenCodeAdapter();
    await adapter.write({
      mcps: {},
      agents: {},
      skills: {
        "format": { name: "format", content: "Format my code", trigger: "/fmt" }
      }
    });

    const configStr = await fs.readFile(path.join(mockHome, ".config", "opencode", "config.json"), "utf-8");
    const config = JSON.parse(configStr);
    expect(config.skills["format"].content).toBe("Format my code");

    const data = await adapter.read();
    expect(data.skills["format"].content).toBe("Format my code");
  });
});
