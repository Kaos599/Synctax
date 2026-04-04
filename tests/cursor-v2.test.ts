import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CursorAdapter } from "../src/adapters/cursor.js";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { expectHas } from "./test-helpers.js";

describe("CursorAdapter v2", () => {
  let mockHome: string;
  let originalCwd: string;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-cursor-v2-"));
    process.env.SYNCTAX_HOME = mockHome;
    originalCwd = process.cwd();
    process.chdir(mockHome);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  describe("MCP reading", () => {
    it("reads MCPs from global ~/.cursor/mcp.json", async () => {
      const adapter = new CursorAdapter();
      // Use a separate project dir so cwd != home (avoids path collision)
      const projectDir = path.join(mockHome, "my-project");
      await fs.mkdir(projectDir, { recursive: true });
      process.chdir(projectDir);

      await fs.mkdir(path.join(mockHome, ".cursor"), { recursive: true });
      await fs.writeFile(
        path.join(mockHome, ".cursor", "mcp.json"),
        JSON.stringify({
          mcpServers: {
            postgres: { command: "npx", args: ["-y", "pg-server"], env: { DB: "test" } },
          },
        })
      );

      const { mcps } = await adapter.read();
      expectHas(mcps, "postgres");
      expect(mcps.postgres).toBeDefined();
      expect(mcps.postgres.command).toBe("npx");
      expect(mcps.postgres.args).toEqual(["-y", "pg-server"]);
      expect(mcps.postgres.env?.DB).toBe("test");
      expect(mcps.postgres.scope).toBe("global");
    });

    it("reads MCPs from project .cursor/mcp.json", async () => {
      const adapter = new CursorAdapter();
      const projectDir = path.join(mockHome, "my-project");
      await fs.mkdir(path.join(projectDir, ".cursor"), { recursive: true });
      await fs.writeFile(
        path.join(projectDir, ".cursor", "mcp.json"),
        JSON.stringify({
          mcpServers: {
            local: { command: "bun", args: ["run", "mcp.ts"] },
          },
        })
      );

      process.chdir(projectDir);
      const { mcps } = await adapter.read();
      expectHas(mcps, "local");
      expect(mcps.local).toBeDefined();
      expect(mcps.local.command).toBe("bun");
      expect(mcps.local.scope).toBe("project");
    });

    it("project MCPs override global MCPs with same key", async () => {
      const adapter = new CursorAdapter();
      // Global MCP
      await fs.mkdir(path.join(mockHome, ".cursor"), { recursive: true });
      await fs.writeFile(
        path.join(mockHome, ".cursor", "mcp.json"),
        JSON.stringify({
          mcpServers: {
            shared: { command: "global-cmd" },
            globalOnly: { command: "global-only" },
          },
        })
      );

      // Project MCP
      await fs.mkdir(path.join(mockHome, ".cursor"), { recursive: true });
      await fs.writeFile(
        path.join(mockHome, ".cursor", "mcp.json"),
        JSON.stringify({
          mcpServers: {
            shared: { command: "global-cmd" },
            globalOnly: { command: "global-only" },
          },
        })
      );

      // Create a project dir and its .cursor/mcp.json
      const projectDir = path.join(mockHome, "proj");
      await fs.mkdir(path.join(projectDir, ".cursor"), { recursive: true });
      await fs.writeFile(
        path.join(projectDir, ".cursor", "mcp.json"),
        JSON.stringify({
          mcpServers: {
            shared: { command: "project-cmd" },
            projOnly: { command: "proj-only" },
          },
        })
      );

      process.chdir(projectDir);
      const { mcps } = await adapter.read();
      expectHas(mcps, "shared");
      expectHas(mcps, "globalOnly");
      expectHas(mcps, "projOnly");
      expect(mcps.shared.command).toBe("project-cmd");
      expect(mcps.shared.scope).toBe("project");
      expect(mcps.globalOnly.command).toBe("global-only");
      expect(mcps.globalOnly.scope).toBe("global");
      expect(mcps.projOnly.command).toBe("proj-only");
      expect(mcps.projOnly.scope).toBe("project");
    });

    it("returns empty MCPs when no config files exist", async () => {
      const adapter = new CursorAdapter();
      const { mcps } = await adapter.read();
      expect(Object.keys(mcps)).toHaveLength(0);
    });
  });

  describe("skills from commands/ (plain markdown)", () => {
    it("reads commands as plain markdown (no frontmatter parsing)", async () => {
      const adapter = new CursorAdapter();
      const cmdDir = path.join(mockHome, ".cursor", "commands");
      await fs.mkdir(cmdDir, { recursive: true });

      await fs.writeFile(path.join(cmdDir, "review.md"), "Review this code carefully.\nCheck for bugs.");

      const { skills } = await adapter.read();
      expectHas(skills, "review");
      expect(skills.review).toBeDefined();
      expect(skills.review.name).toBe("review");
      expect(skills.review.content).toBe("Review this code carefully.\nCheck for bugs.");
      expect(skills.review.trigger).toBe("/review");
    });

    it("writes skills as plain markdown without frontmatter", async () => {
      const adapter = new CursorAdapter();
      await adapter.write({
        mcps: {},
        agents: {},
        skills: {
          review: {
            name: "review",
            description: "Code review",
            content: "Review this code",
            trigger: "/review",
          },
        },
      });

      const content = await fs.readFile(
        path.join(mockHome, ".cursor", "commands", "review.md"),
        "utf-8"
      );
      // Should NOT contain frontmatter delimiters
      expect(content).not.toContain("---");
      expect(content).not.toContain("name:");
      expect(content).not.toContain("description:");
      expect(content.trim()).toBe("Review this code");
    });

    it("round-trips skills through write then read", async () => {
      const adapter = new CursorAdapter();
      await adapter.write({
        mcps: {},
        agents: {},
        skills: {
          test: { name: "test", content: "Run all tests.", trigger: "/test" },
        },
      });

      const { skills } = await adapter.read();
      expectHas(skills, "test");
      expect(skills.test.content).toBe("Run all tests.");
      expect(skills.test.trigger).toBe("/test");
    });
  });

  describe("SKILL.md support", () => {
    it("reads SKILL.md files from global ~/.cursor/skills/", async () => {
      const adapter = new CursorAdapter();
      // Use a separate project dir so cwd != home (avoids path collision)
      const projectDir = path.join(mockHome, "my-project");
      await fs.mkdir(projectDir, { recursive: true });
      process.chdir(projectDir);

      const skillDir = path.join(mockHome, ".cursor", "skills", "deploy");
      await fs.mkdir(skillDir, { recursive: true });

      await fs.writeFile(
        path.join(skillDir, "SKILL.md"),
        `---
name: Deploy
description: Deploy to production
user-invocable: true
---

Run the deployment pipeline.`
      );

      const { skills } = await adapter.read();
      expectHas(skills, "deploy");
      expect(skills.deploy).toBeDefined();
      expect(skills.deploy.name).toBe("Deploy");
      expect(skills.deploy.description).toBe("Deploy to production");
      expect(skills.deploy.userInvocable).toBe(true);
      expect(skills.deploy.content).toBe("Run the deployment pipeline.");
      expect(skills.deploy.scope).toBe("global");
    });

    it("reads SKILL.md files from project .cursor/skills/", async () => {
      const adapter = new CursorAdapter();
      const projectDir = path.join(mockHome, "my-project");
      const skillDir = path.join(projectDir, ".cursor", "skills", "lint");
      await fs.mkdir(skillDir, { recursive: true });

      await fs.writeFile(
        path.join(skillDir, "SKILL.md"),
        `---
name: Lint
description: Run linter
---

Run eslint on the project.`
      );

      process.chdir(projectDir);
      const { skills } = await adapter.read();
      expectHas(skills, "lint");
      expect(skills.lint).toBeDefined();
      expect(skills.lint.name).toBe("Lint");
      expect(skills.lint.scope).toBe("project");
    });

    it("project SKILL.md overrides global SKILL.md with same name", async () => {
      const adapter = new CursorAdapter();

      // Global skill
      const globalSkillDir = path.join(mockHome, ".cursor", "skills", "deploy");
      await fs.mkdir(globalSkillDir, { recursive: true });
      await fs.writeFile(
        path.join(globalSkillDir, "SKILL.md"),
        "---\nname: Deploy Global\n---\nGlobal deploy."
      );

      // Project skill with same directory name
      const projectDir = path.join(mockHome, "my-project");
      const projectSkillDir = path.join(projectDir, ".cursor", "skills", "deploy");
      await fs.mkdir(projectSkillDir, { recursive: true });
      await fs.writeFile(
        path.join(projectSkillDir, "SKILL.md"),
        "---\nname: Deploy Project\n---\nProject deploy."
      );

      process.chdir(projectDir);
      const { skills } = await adapter.read();
      expectHas(skills, "deploy");
      expect(skills.deploy.name).toBe("Deploy Project");
      expect(skills.deploy.content).toBe("Project deploy.");
      expect(skills.deploy.scope).toBe("project");
    });

    it("reads extended frontmatter fields from SKILL.md", async () => {
      const adapter = new CursorAdapter();
      const skillDir = path.join(mockHome, ".cursor", "skills", "complex");
      await fs.mkdir(skillDir, { recursive: true });

      await fs.writeFile(
        path.join(skillDir, "SKILL.md"),
        `---
name: Complex Skill
description: A complex skill
trigger: /complex
argument-hint: <file-path>
disable-model-invocation: true
user-invocable: false
allowed-tools:
  - Read
  - Grep
model: gpt-4
effort: high
---

Do complex things.`
      );

      const { skills } = await adapter.read();
      expectHas(skills, "complex");
      const skill = skills.complex;
      expect(skill.name).toBe("Complex Skill");
      expect(skill.description).toBe("A complex skill");
      expect(skill.trigger).toBe("/complex");
      expect(skill.argumentHint).toBe("<file-path>");
      expect(skill.disableModelInvocation).toBe(true);
      expect(skill.userInvocable).toBe(false);
      expect(skill.allowedTools).toEqual(["Read", "Grep"]);
      expect(skill.model).toBe("gpt-4");
      expect(skill.effort).toBe("high");
    });

    it("ignores non-directory entries in skills dir", async () => {
      const adapter = new CursorAdapter();
      const skillsDir = path.join(mockHome, ".cursor", "skills");
      await fs.mkdir(skillsDir, { recursive: true });

      // A stray file (not a directory) should be ignored
      await fs.writeFile(path.join(skillsDir, "stray.txt"), "not a skill");

      // A valid directory skill
      const skillDir = path.join(skillsDir, "valid");
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(path.join(skillDir, "SKILL.md"), "---\nname: Valid\n---\nValid skill.");

      const { skills } = await adapter.read();
      expect(skills.valid).toBeDefined();
      expect(skills["stray.txt"]).toBeUndefined();
      expect(skills["stray"]).toBeUndefined();
    });

    it("ignores directories without SKILL.md", async () => {
      const adapter = new CursorAdapter();
      const skillsDir = path.join(mockHome, ".cursor", "skills");
      const emptySkillDir = path.join(skillsDir, "empty");
      await fs.mkdir(emptySkillDir, { recursive: true });
      await fs.writeFile(path.join(emptySkillDir, "README.md"), "Not a skill.");

      const { skills } = await adapter.read();
      expect(skills.empty).toBeUndefined();
    });
  });

  describe("agents (modes)", () => {
    it("reads and writes agents as modes", async () => {
      const adapter = new CursorAdapter();
      await adapter.write({
        mcps: {},
        agents: {
          coder: { name: "Coder", description: "Coding mode", prompt: "You are a coder.", model: "gpt-4" },
        },
        skills: {},
      });

      const modesData = JSON.parse(
        await fs.readFile(path.join(mockHome, ".cursor", "modes.json"), "utf-8")
      );
      expect(modesData.modes.coder.name).toBe("Coder");
      expect(modesData.modes.coder.systemPrompt).toBe("You are a coder.");
      expect(modesData.modes.coder.model).toBe("gpt-4");

      const { agents } = await adapter.read();
      expectHas(agents, "coder");
      expect(agents.coder.name).toBe("Coder");
      expect(agents.coder.prompt).toBe("You are a coder.");
    });
  });

  describe("write preserves existing config", () => {
    it("preserves non-managed fields in mcp.json", async () => {
      const adapter = new CursorAdapter();
      await fs.mkdir(path.join(mockHome, ".cursor"), { recursive: true });
      await fs.writeFile(
        path.join(mockHome, ".cursor", "mcp.json"),
        JSON.stringify({ customField: "keep me", mcpServers: {} })
      );

      await adapter.write({ mcps: { test: { command: "node" } }, agents: {}, skills: {} });

      const data = JSON.parse(
        await fs.readFile(path.join(mockHome, ".cursor", "mcp.json"), "utf-8")
      );
      expect(data.customField).toBe("keep me");
      expect(data.mcpServers.test.command).toBe("node");
    });
  });

  describe("detect", () => {
    it("detects via ~/.cursor/mcp.json", async () => {
      const adapter = new CursorAdapter();
      expect(await adapter.detect()).toBe(false);

      await fs.mkdir(path.join(mockHome, ".cursor"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".cursor", "mcp.json"), "{}");
      expect(await adapter.detect()).toBe(true);
    });
  });

  describe("memory", () => {
    it("reads and writes .cursorrules", async () => {
      const adapter = new CursorAdapter();
      expect(adapter.getMemoryFileName()).toBe(".cursorrules");

      await adapter.writeMemory(mockHome, "Be helpful.");
      const content = await adapter.readMemory(mockHome);
      expect(content).toBe("Be helpful.");
    });
  });
});
