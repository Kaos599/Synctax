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
  let originalCwd: string;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-skills-test-"));
    process.env.SYNCTAX_HOME = mockHome;
    originalCwd = process.cwd();
    process.chdir(mockHome);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  it("ClaudeAdapter reads and writes Skills (directory-based skills/<name>/SKILL.md)", async () => {
    const adapter = new ClaudeAdapter();
    // Create a directory-based skill
    const skillDir = path.join(mockHome, ".claude", "skills", "Refactor");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, "SKILL.md"), `---\nname: Refactor\ndescription: Refactoring helper\ntrigger: /refactor\n---\nRefactor the selected code.\n`);

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

    // Skills are written as directory-based SKILL.md
    const newSkillContent = await fs.readFile(path.join(mockHome, ".claude", "skills", "Test", "SKILL.md"), "utf-8");
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


  it("ClaudeAdapter reads directory-based and legacy flat-file skills", async () => {
    const adapter = new ClaudeAdapter();
    const skillsDir = path.join(mockHome, ".claude", "skills");

    // Directory-based skill (modern)
    await fs.mkdir(path.join(skillsDir, "modern-skill"), { recursive: true });
    await fs.writeFile(path.join(skillsDir, "modern-skill", "SKILL.md"), `---\nname: Modern\n---\nModern content.\n`);

    // Legacy flat file skills (backward compat)
    await fs.writeFile(path.join(skillsDir, "A.md"), `---\nname: SkillA\n---\nDo A.\n`);
    await fs.writeFile(path.join(skillsDir, "B.agent"), `---\nname: SkillB\n---\nDo B.\n`);
    await fs.writeFile(path.join(skillsDir, "C.claude"), `---\nname: SkillC\n---\nDo C.\n`);
    await fs.writeFile(path.join(skillsDir, "D.txt"), `---\nname: SkillD\n---\nIgnored.\n`);

    const data = await adapter.read();
    expect(data.skills["modern-skill"]).toBeDefined();
    expect(data.skills["modern-skill"].name).toBe("Modern");
    expect(data.skills["A"]).toBeDefined();
    expect(data.skills["B"]).toBeDefined();
    expect(data.skills["C"]).toBeDefined();
    expect(data.skills["D"]).toBeUndefined(); // .txt ignored
  });
});
