import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GithubCopilotCliAdapter } from "../src/adapters/github-copilot-cli.js";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { expectHas } from "./test-helpers.js";

describe("GithubCopilotCliAdapter v2", () => {
  let mockHome: string;
  let originalCwd: string;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-copilot-cli-v2-"));
    process.env.SYNCTAX_HOME = mockHome;
    originalCwd = process.cwd();
    process.chdir(mockHome);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  // ── Detection ──────────────────────────────────────────────

  describe("detect()", () => {
    it("detects when ~/.copilot/config.json exists", async () => {
      const adapter = new GithubCopilotCliAdapter();
      const configPath = path.join(mockHome, ".copilot", "config.json");
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify({}));
      expect(await adapter.detect()).toBe(true);
    });

    it("detects when .github/copilot/settings.json exists", async () => {
      const adapter = new GithubCopilotCliAdapter();
      const configPath = path.join(mockHome, ".github", "copilot", "settings.json");
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify({}));
      expect(await adapter.detect()).toBe(true);
    });

    it("detects when ~/.copilot/mcp-config.json exists", async () => {
      const adapter = new GithubCopilotCliAdapter();
      const mcpPath = path.join(mockHome, ".copilot", "mcp-config.json");
      await fs.mkdir(path.dirname(mcpPath), { recursive: true });
      await fs.writeFile(mcpPath, JSON.stringify({ mcpServers: {} }));
      expect(await adapter.detect()).toBe(true);
    });

    it("detects when ~/.copilot/agents/ directory exists", async () => {
      const adapter = new GithubCopilotCliAdapter();
      const agentsDir = path.join(mockHome, ".copilot", "agents");
      await fs.mkdir(agentsDir, { recursive: true });
      expect(await adapter.detect()).toBe(true);
    });

    it("detects when .github/agents/ directory exists", async () => {
      const adapter = new GithubCopilotCliAdapter();
      const agentsDir = path.join(mockHome, ".github", "agents");
      await fs.mkdir(agentsDir, { recursive: true });
      expect(await adapter.detect()).toBe(true);
    });

    it("returns false when nothing exists", async () => {
      const adapter = new GithubCopilotCliAdapter();
      expect(await adapter.detect()).toBe(false);
    });
  });

  // ── MCP Read/Write ─────────────────────────────────────────

  describe("MCP servers", () => {
    it("reads MCPs from ~/.copilot/mcp-config.json", async () => {
      const adapter = new GithubCopilotCliAdapter();
      const mcpPath = path.join(mockHome, ".copilot", "mcp-config.json");
      await fs.mkdir(path.dirname(mcpPath), { recursive: true });
      await fs.writeFile(mcpPath, JSON.stringify({
        mcpServers: {
          "copilot-mcp": { command: "node", args: ["serve.js"], env: { TOKEN: "abc" } }
        }
      }));

      const { mcps } = await adapter.read();
      expectHas(mcps, "copilot-mcp");
      expect(mcps["copilot-mcp"]).toBeDefined();
      expect(mcps["copilot-mcp"].command).toBe("node");
      expect(mcps["copilot-mcp"].args).toEqual(["serve.js"]);
      expect(mcps["copilot-mcp"].env).toEqual({ TOKEN: "abc" });
      expect(mcps["copilot-mcp"].scope).toBe("user");
    });

    it("writes MCPs to ~/.copilot/mcp-config.json", async () => {
      const adapter = new GithubCopilotCliAdapter();
      await adapter.write({
        mcps: {
          "my-mcp": { command: "bun", args: ["run", "mcp"] }
        },
        agents: {},
        skills: {},
      });

      const mcpPath = path.join(mockHome, ".copilot", "mcp-config.json");
      const data = JSON.parse(await fs.readFile(mcpPath, "utf-8"));
      expect(data.mcpServers["my-mcp"].command).toBe("bun");
      expect(data.mcpServers["my-mcp"].args).toEqual(["run", "mcp"]);
    });

    it("merges MCPs into existing mcp-config.json", async () => {
      const adapter = new GithubCopilotCliAdapter();
      const mcpPath = path.join(mockHome, ".copilot", "mcp-config.json");
      await fs.mkdir(path.dirname(mcpPath), { recursive: true });
      await fs.writeFile(mcpPath, JSON.stringify({
        mcpServers: { existing: { command: "old" } }
      }));

      await adapter.write({
        mcps: { "new-mcp": { command: "new-cmd" } },
        agents: {},
        skills: {},
      });

      const data = JSON.parse(await fs.readFile(mcpPath, "utf-8"));
      expect(data.mcpServers["existing"].command).toBe("old");
      expect(data.mcpServers["new-mcp"].command).toBe("new-cmd");
    });

    it("strips scope field from written MCPs", async () => {
      const adapter = new GithubCopilotCliAdapter();
      await adapter.write({
        mcps: { "scoped": { command: "node", scope: "user" } },
        agents: {},
        skills: {},
      });

      const mcpPath = path.join(mockHome, ".copilot", "mcp-config.json");
      const data = JSON.parse(await fs.readFile(mcpPath, "utf-8"));
      expect(data.mcpServers["scoped"].scope).toBeUndefined();
    });

    it("returns empty MCPs when no mcp-config.json exists", async () => {
      const adapter = new GithubCopilotCliAdapter();
      const { mcps } = await adapter.read();
      expect(Object.keys(mcps)).toHaveLength(0);
    });
  });

  // ── Agent Read/Write ───────────────────────────────────────

  describe("agents (file-based)", () => {
    it("reads agents from ~/.copilot/agents/ as user scope", async () => {
      const adapter = new GithubCopilotCliAdapter();
      const agentsDir = path.join(mockHome, ".copilot", "agents");
      await fs.mkdir(agentsDir, { recursive: true });
      await fs.writeFile(path.join(agentsDir, "helper.md"), [
        "---",
        "name: Helper Agent",
        "description: Helps with tasks",
        "model: gpt-4o",
        "---",
        "",
        "You are a helpful assistant.",
      ].join("\n"));

      const { agents } = await adapter.read();
      expectHas(agents, "helper");
      expect(agents["helper"]).toBeDefined();
      expect(agents["helper"].name).toBe("Helper Agent");
      expect(agents["helper"].description).toBe("Helps with tasks");
      expect(agents["helper"].model).toBe("gpt-4o");
      expect(agents["helper"].prompt).toBe("You are a helpful assistant.");
      expect(agents["helper"].scope).toBe("user");
    });

    it("reads agents from .github/agents/ as project scope", async () => {
      const adapter = new GithubCopilotCliAdapter();
      const agentsDir = path.join(mockHome, ".github", "agents");
      await fs.mkdir(agentsDir, { recursive: true });
      await fs.writeFile(path.join(agentsDir, "reviewer.md"), [
        "---",
        "name: Code Reviewer",
        "---",
        "",
        "You review pull requests.",
      ].join("\n"));

      const { agents } = await adapter.read();
      expectHas(agents, "reviewer");
      expect(agents["reviewer"]).toBeDefined();
      expect(agents["reviewer"].name).toBe("Code Reviewer");
      expect(agents["reviewer"].prompt).toBe("You review pull requests.");
      expect(agents["reviewer"].scope).toBe("project");
    });

    it("project agents override user agents with same key", async () => {
      const adapter = new GithubCopilotCliAdapter();

      // User agent
      const userAgentsDir = path.join(mockHome, ".copilot", "agents");
      await fs.mkdir(userAgentsDir, { recursive: true });
      await fs.writeFile(path.join(userAgentsDir, "shared.md"), "User version of shared.");

      // Project agent (same key)
      const projectAgentsDir = path.join(mockHome, ".github", "agents");
      await fs.mkdir(projectAgentsDir, { recursive: true });
      await fs.writeFile(path.join(projectAgentsDir, "shared.md"), "Project version of shared.");

      const { agents } = await adapter.read();
      expectHas(agents, "shared");
      expect(agents["shared"].prompt).toBe("Project version of shared.");
      expect(agents["shared"].scope).toBe("project");
    });

    it("ignores non-.md files in agent directories", async () => {
      const adapter = new GithubCopilotCliAdapter();
      const agentsDir = path.join(mockHome, ".copilot", "agents");
      await fs.mkdir(agentsDir, { recursive: true });
      await fs.writeFile(path.join(agentsDir, "valid.md"), "Valid agent.");
      await fs.writeFile(path.join(agentsDir, "ignored.txt"), "Should be ignored.");
      await fs.writeFile(path.join(agentsDir, "config.json"), "{}");

      const { agents } = await adapter.read();
      expect(Object.keys(agents)).toEqual(["valid"]);
    });

    it("writes project-scoped agents to .github/agents/", async () => {
      const adapter = new GithubCopilotCliAdapter();
      await adapter.write({
        mcps: {},
        agents: {
          "proj-agent": {
            name: "Project Agent",
            description: "For the project",
            prompt: "Help with this project.",
            scope: "project",
          }
        },
        skills: {},
      });

      const agentPath = path.join(mockHome, ".github", "agents", "proj-agent.md");
      const raw = await fs.readFile(agentPath, "utf-8");
      expect(raw).toContain("name: Project Agent");
      expect(raw).toContain("description: For the project");
      expect(raw).toContain("Help with this project.");
    });

    it("writes user-scoped agents to ~/.copilot/agents/", async () => {
      const adapter = new GithubCopilotCliAdapter();
      await adapter.write({
        mcps: {},
        agents: {
          "user-agent": {
            name: "User Agent",
            prompt: "You are a general assistant.",
            scope: "user",
          }
        },
        skills: {},
      });

      const agentPath = path.join(mockHome, ".copilot", "agents", "user-agent.md");
      const raw = await fs.readFile(agentPath, "utf-8");
      expect(raw).toContain("name: User Agent");
      expect(raw).toContain("You are a general assistant.");
    });

    it("writes global-scoped agents to ~/.copilot/agents/", async () => {
      const adapter = new GithubCopilotCliAdapter();
      await adapter.write({
        mcps: {},
        agents: {
          "global-agent": {
            name: "Global Agent",
            prompt: "Available everywhere.",
            scope: "global",
          }
        },
        skills: {},
      });

      const agentPath = path.join(mockHome, ".copilot", "agents", "global-agent.md");
      const raw = await fs.readFile(agentPath, "utf-8");
      expect(raw).toContain("name: Global Agent");
    });
  });

  // ── Skill Read/Write ───────────────────────────────────────

  describe("skills (file-based)", () => {
    it("reads skills from ~/.copilot/skills/ as user scope", async () => {
      const adapter = new GithubCopilotCliAdapter();
      const skillDir = path.join(mockHome, ".copilot", "skills", "deploy");
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(path.join(skillDir, "SKILL.md"), [
        "---",
        "name: Deploy",
        "description: Deploy to production",
        "trigger: /deploy",
        "---",
        "",
        "Run the deployment pipeline.",
      ].join("\n"));

      const { skills } = await adapter.read();
      expectHas(skills, "deploy");
      expect(skills["deploy"]).toBeDefined();
      expect(skills["deploy"].name).toBe("Deploy");
      expect(skills["deploy"].description).toBe("Deploy to production");
      expect(skills["deploy"].trigger).toBe("/deploy");
      expect(skills["deploy"].content).toBe("Run the deployment pipeline.");
      expect(skills["deploy"].scope).toBe("user");
    });

    it("reads skills from .github/skills/ as project scope", async () => {
      const adapter = new GithubCopilotCliAdapter();
      const skillDir = path.join(mockHome, ".github", "skills", "test");
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(path.join(skillDir, "SKILL.md"), [
        "---",
        "name: Test",
        "---",
        "",
        "Run the test suite.",
      ].join("\n"));

      const { skills } = await adapter.read();
      expectHas(skills, "test");
      expect(skills["test"]).toBeDefined();
      expect(skills["test"].name).toBe("Test");
      expect(skills["test"].content).toBe("Run the test suite.");
      expect(skills["test"].scope).toBe("project");
    });

    it("project skills override user skills with same name", async () => {
      const adapter = new GithubCopilotCliAdapter();

      // User skill
      const userSkillDir = path.join(mockHome, ".copilot", "skills", "build");
      await fs.mkdir(userSkillDir, { recursive: true });
      await fs.writeFile(path.join(userSkillDir, "SKILL.md"), [
        "---",
        "name: Build (User)",
        "---",
        "",
        "User build.",
      ].join("\n"));

      // Project skill
      const projectSkillDir = path.join(mockHome, ".github", "skills", "build");
      await fs.mkdir(projectSkillDir, { recursive: true });
      await fs.writeFile(path.join(projectSkillDir, "SKILL.md"), [
        "---",
        "name: Build (Project)",
        "---",
        "",
        "Project build.",
      ].join("\n"));

      const { skills } = await adapter.read();
      expectHas(skills, "build");
      expect(skills["build"].name).toBe("Build (Project)");
      expect(skills["build"].scope).toBe("project");
    });

    it("writes project-scoped skills to .github/skills/", async () => {
      const adapter = new GithubCopilotCliAdapter();
      await adapter.write({
        mcps: {},
        agents: {},
        skills: {
          "proj-skill": {
            name: "Project Skill",
            description: "Project level",
            trigger: "/proj",
            content: "Do project things.",
            scope: "project",
          }
        },
      });

      const skillPath = path.join(mockHome, ".github", "skills", "proj-skill", "SKILL.md");
      const raw = await fs.readFile(skillPath, "utf-8");
      expect(raw).toContain("name: Project Skill");
      expect(raw).toContain("description: Project level");
      expect(raw).toContain("trigger: /proj");
      expect(raw).toContain("Do project things.");
    });

    it("writes user-scoped skills to ~/.copilot/skills/", async () => {
      const adapter = new GithubCopilotCliAdapter();
      await adapter.write({
        mcps: {},
        agents: {},
        skills: {
          "user-skill": {
            name: "User Skill",
            content: "User-level skill content.",
            scope: "user",
          }
        },
      });

      const skillPath = path.join(mockHome, ".copilot", "skills", "user-skill", "SKILL.md");
      const raw = await fs.readFile(skillPath, "utf-8");
      expect(raw).toContain("name: User Skill");
      expect(raw).toContain("User-level skill content.");
    });

    it("does not read aliases from legacy config format", async () => {
      const adapter = new GithubCopilotCliAdapter();
      // Old config.json with aliases key should be ignored for skills
      const configPath = path.join(mockHome, ".copilot", "config.json");
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify({
        aliases: { "old-alias": "echo hello" }
      }));

      const { skills } = await adapter.read();
      expect(skills["old-alias"]).toBeUndefined();
    });
  });

  // ── Permissions ────────────────────────────────────────────

  describe("permissions", () => {
    it("reads permissions from ~/.copilot/config.json", async () => {
      const adapter = new GithubCopilotCliAdapter();
      const configPath = path.join(mockHome, ".copilot", "config.json");
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify({
        allowed_urls: ["https://api.example.com"],
        denied_urls: ["https://evil.com"],
        trusted_folders: ["/home/user/projects"],
      }));

      const result = await adapter.read();
      expect(result.permissions).toBeDefined();
      expect(result.permissions!.allowedUrls).toEqual(["https://api.example.com"]);
      expect(result.permissions!.deniedUrls).toEqual(["https://evil.com"]);
      expect(result.permissions!.trustedFolders).toEqual(["/home/user/projects"]);
    });

    it("project config permissions override user config", async () => {
      const adapter = new GithubCopilotCliAdapter();

      // User config
      const userConfig = path.join(mockHome, ".copilot", "config.json");
      await fs.mkdir(path.dirname(userConfig), { recursive: true });
      await fs.writeFile(userConfig, JSON.stringify({
        allowed_urls: ["https://user-api.com"],
        trusted_folders: ["/user/path"],
      }));

      // Project config
      const projectConfig = path.join(mockHome, ".github", "copilot", "settings.json");
      await fs.mkdir(path.dirname(projectConfig), { recursive: true });
      await fs.writeFile(projectConfig, JSON.stringify({
        allowed_urls: ["https://project-api.com"],
      }));

      const result = await adapter.read();
      expect(result.permissions).toBeDefined();
      // Project overrides user for allowed_urls
      expect(result.permissions!.allowedUrls).toEqual(["https://project-api.com"]);
      // trusted_folders was only in user, but user sets it first, project doesn't override it
      expect(result.permissions!.trustedFolders).toEqual(["/user/path"]);
    });

    it("returns no permissions when neither config has permission fields", async () => {
      const adapter = new GithubCopilotCliAdapter();
      const configPath = path.join(mockHome, ".copilot", "config.json");
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify({ someOtherSetting: true }));

      const result = await adapter.read();
      expect(result.permissions).toBeUndefined();
    });

    it("writes permissions to ~/.copilot/config.json", async () => {
      const adapter = new GithubCopilotCliAdapter();
      await adapter.write({
        mcps: {},
        agents: {},
        skills: {},
        permissions: {
          allowedPaths: [], deniedPaths: [],
          allowedCommands: [], deniedCommands: [],
          networkAllow: false,
          allow: [], deny: [], ask: [],
          allowedUrls: ["https://allowed.com"],
          deniedUrls: ["https://denied.com"],
          trustedFolders: ["/trusted"],
        },
      });

      const configPath = path.join(mockHome, ".copilot", "config.json");
      const data = JSON.parse(await fs.readFile(configPath, "utf-8"));
      expect(data.allowed_urls).toEqual(["https://allowed.com"]);
      expect(data.denied_urls).toEqual(["https://denied.com"]);
      expect(data.trusted_folders).toEqual(["/trusted"]);
    });

    it("does not write permissions when url-related fields are empty", async () => {
      const adapter = new GithubCopilotCliAdapter();
      await adapter.write({
        mcps: {},
        agents: {},
        skills: {},
        permissions: {
          allowedPaths: ["/some/path"], deniedPaths: [],
          allowedCommands: [], deniedCommands: [],
          networkAllow: false,
          allow: [], deny: [], ask: [],
          allowedUrls: [], deniedUrls: [], trustedFolders: [],
        },
      });

      const configPath = path.join(mockHome, ".copilot", "config.json");
      // Config file should not have been created since no URL perms
      await expect(fs.access(configPath)).rejects.toThrow();
    });
  });

  // ── Memory File ────────────────────────────────────────────

  describe("memory file", () => {
    it("returns .github/copilot-instructions.md as memory file name", () => {
      const adapter = new GithubCopilotCliAdapter();
      expect(adapter.getMemoryFileName()).toBe(".github/copilot-instructions.md");
    });

    it("reads memory from .github/copilot-instructions.md", async () => {
      const adapter = new GithubCopilotCliAdapter();
      const memDir = path.join(mockHome, ".github");
      await fs.mkdir(memDir, { recursive: true });
      await fs.writeFile(path.join(memDir, "copilot-instructions.md"), "Copilot memory content.");
      const content = await adapter.readMemory(mockHome);
      expect(content).toBe("Copilot memory content.");
    });

    it("writes memory to .github/copilot-instructions.md", async () => {
      const adapter = new GithubCopilotCliAdapter();
      await adapter.writeMemory(mockHome, "New copilot instructions.");
      const content = await fs.readFile(path.join(mockHome, ".github", "copilot-instructions.md"), "utf-8");
      expect(content).toBe("New copilot instructions.");
    });

    it("returns null when memory file does not exist", async () => {
      const adapter = new GithubCopilotCliAdapter();
      const content = await adapter.readMemory(mockHome);
      expect(content).toBeNull();
    });
  });

  // ── Round-trip ─────────────────────────────────────────────

  describe("round-trip", () => {
    it("round-trips MCPs through write then read", async () => {
      const adapter = new GithubCopilotCliAdapter();
      await adapter.write({
        mcps: {
          "rt-mcp": { command: "python", args: ["-m", "mcp"], env: { KEY: "val" } }
        },
        agents: {},
        skills: {},
      });

      const { mcps } = await adapter.read();
      expectHas(mcps, "rt-mcp");
      expect(mcps["rt-mcp"].command).toBe("python");
      expect(mcps["rt-mcp"].args).toEqual(["-m", "mcp"]);
      expect(mcps["rt-mcp"].env).toEqual({ KEY: "val" });
    });

    it("round-trips agents through write then read", async () => {
      const adapter = new GithubCopilotCliAdapter();
      await adapter.write({
        mcps: {},
        agents: {
          "rt-agent": {
            name: "Round Trip Agent",
            description: "Tests round-trip",
            prompt: "You help test things.",
            model: "gpt-4o",
            scope: "user",
          }
        },
        skills: {},
      });

      const { agents } = await adapter.read();
      expectHas(agents, "rt-agent");
      expect(agents["rt-agent"]).toBeDefined();
      expect(agents["rt-agent"].name).toBe("Round Trip Agent");
      expect(agents["rt-agent"].description).toBe("Tests round-trip");
      expect(agents["rt-agent"].prompt).toBe("You help test things.");
      expect(agents["rt-agent"].model).toBe("gpt-4o");
    });

    it("round-trips skills through write then read", async () => {
      const adapter = new GithubCopilotCliAdapter();
      await adapter.write({
        mcps: {},
        agents: {},
        skills: {
          "rt-skill": {
            name: "Round Trip Skill",
            description: "RT test",
            trigger: "/rt",
            content: "Execute the round trip.",
            scope: "user",
          }
        },
      });

      const { skills } = await adapter.read();
      expectHas(skills, "rt-skill");
      expect(skills["rt-skill"]).toBeDefined();
      expect(skills["rt-skill"].name).toBe("Round Trip Skill");
      expect(skills["rt-skill"].description).toBe("RT test");
      expect(skills["rt-skill"].trigger).toBe("/rt");
      expect(skills["rt-skill"].content).toBe("Execute the round trip.");
    });
  });
});
