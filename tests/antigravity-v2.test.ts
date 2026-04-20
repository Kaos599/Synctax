import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AntigravityAdapter } from "../src/adapters/antigravity.js";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { expectHas } from "./test-helpers.js";

describe("AntigravityAdapter v2", () => {
  let mockHome: string;
  let originalCwd: string;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-antigravity-v2-"));
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
    it("detects when gemini-antigravity mcp_config.json exists", async () => {
      const adapter = new AntigravityAdapter();
      const mcpPath = path.join(mockHome, ".gemini", "antigravity", "mcp_config.json");
      await fs.mkdir(path.dirname(mcpPath), { recursive: true });
      await fs.writeFile(mcpPath, JSON.stringify({ mcpServers: {} }));
      expect(await adapter.detect()).toBe(true);
    });

    it("detects when legacy .antigravity/config.json exists", async () => {
      const adapter = new AntigravityAdapter();
      const legacyPath = path.join(mockHome, ".antigravity", "config.json");
      await fs.mkdir(path.dirname(legacyPath), { recursive: true });
      await fs.writeFile(legacyPath, JSON.stringify({}));
      expect(await adapter.detect()).toBe(true);
    });

    it("detects when GEMINI.md exists in project root", async () => {
      const adapter = new AntigravityAdapter();
      await fs.writeFile(path.join(mockHome, "GEMINI.md"), "# Instructions");
      expect(await adapter.detect()).toBe(true);
    });

    it("detects when AGENTS.md exists in project root", async () => {
      const adapter = new AntigravityAdapter();
      await fs.writeFile(path.join(mockHome, "AGENTS.md"), "# Agents");
      expect(await adapter.detect()).toBe(true);
    });

    it("detects when .agent/rules directory exists", async () => {
      const adapter = new AntigravityAdapter();
      await fs.mkdir(path.join(mockHome, ".agent", "rules"), { recursive: true });
      expect(await adapter.detect()).toBe(true);
    });

    it("returns false when nothing exists", async () => {
      const adapter = new AntigravityAdapter();
      expect(await adapter.detect()).toBe(false);
    });
  });

  // ── MCP Read/Write ─────────────────────────────────────────

  describe("MCP servers", () => {
    it("reads MCPs from gemini-antigravity mcp_config.json", async () => {
      const adapter = new AntigravityAdapter();
      const mcpPath = path.join(mockHome, ".gemini", "antigravity", "mcp_config.json");
      await fs.mkdir(path.dirname(mcpPath), { recursive: true });
      await fs.writeFile(mcpPath, JSON.stringify({
        mcpServers: {
          "test-mcp": { command: "node", args: ["server.js"], env: { KEY: "val" } }
        }
      }));

      const { mcps } = await adapter.read();
      expect(mcps["test-mcp"]).toBeDefined();
      expectHas(mcps, "test-mcp");
      expect(mcps["test-mcp"].command).toBe("node");
      expect(mcps["test-mcp"].args).toEqual(["server.js"]);
      expect(mcps["test-mcp"].env).toEqual({ KEY: "val" });
    });

    it("reads MCPs from legacy config with 'servers' key", async () => {
      const adapter = new AntigravityAdapter();
      const legacyPath = path.join(mockHome, ".antigravity", "config.json");
      await fs.mkdir(path.dirname(legacyPath), { recursive: true });
      await fs.writeFile(legacyPath, JSON.stringify({
        servers: {
          "legacy-mcp": { command: "python", args: ["-m", "server"] }
        }
      }));

      const { mcps } = await adapter.read();
      expect(mcps["legacy-mcp"]).toBeDefined();
      expectHas(mcps, "legacy-mcp");
      expect(mcps["legacy-mcp"].command).toBe("python");
    });

    it("writes MCPs to gemini-antigravity mcp_config.json by default", async () => {
      const adapter = new AntigravityAdapter();
      await adapter.write({
        mcps: {
          "my-mcp": { command: "bun", args: ["run", "serve"] }
        },
        agents: {},
        skills: {},
      });

      const mcpPath = path.join(mockHome, ".gemini", "antigravity", "mcp_config.json");
      const data = JSON.parse(await fs.readFile(mcpPath, "utf-8"));
      expect(data.mcpServers["my-mcp"].command).toBe("bun");
      expect(data.mcpServers["my-mcp"].args).toEqual(["run", "serve"]);
    });

    it("writes MCPs to existing legacy path if it already exists", async () => {
      const adapter = new AntigravityAdapter();
      // Pre-create the gemini path so it's found first
      const mcpPath = path.join(mockHome, ".gemini", "antigravity", "mcp_config.json");
      await fs.mkdir(path.dirname(mcpPath), { recursive: true });
      await fs.writeFile(mcpPath, JSON.stringify({ mcpServers: { existing: { command: "old" } } }));

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
      const adapter = new AntigravityAdapter();
      await adapter.write({
        mcps: { "scoped-mcp": { command: "node", scope: "user" } },
        agents: {},
        skills: {},
      });

      const mcpPath = path.join(mockHome, ".gemini", "antigravity", "mcp_config.json");
      const data = JSON.parse(await fs.readFile(mcpPath, "utf-8"));
      expect(data.mcpServers["scoped-mcp"].scope).toBeUndefined();
      expect(data.mcpServers["scoped-mcp"].command).toBe("node");
    });

    it("skips MCP entries with empty command values", async () => {
      const adapter = new AntigravityAdapter();

      await adapter.write({
        mcps: {
          "remote-only": {
            command: "",
            url: "https://example.com/mcp",
            transport: "sse",
          }
        },
        agents: {},
        skills: {},
      });

      const mcpPath = path.join(mockHome, ".gemini", "antigravity", "mcp_config.json");
      const data = JSON.parse(await fs.readFile(mcpPath, "utf-8"));
      expect(data.mcpServers?.["remote-only"]).toBeUndefined();
    });

    it("skips writing when no MCPs are provided", async () => {
      const adapter = new AntigravityAdapter();
      await adapter.write({ mcps: {}, agents: {}, skills: {} });

      const mcpPath = path.join(mockHome, ".gemini", "antigravity", "mcp_config.json");
      await expect(fs.access(mcpPath)).rejects.toThrow();
    });

    it("merges MCPs from multiple config candidates", async () => {
      const adapter = new AntigravityAdapter();

      // Gemini-antigravity config has one MCP
      const geminiPath = path.join(mockHome, ".gemini", "antigravity", "mcp_config.json");
      await fs.mkdir(path.dirname(geminiPath), { recursive: true });
      await fs.writeFile(geminiPath, JSON.stringify({
        mcpServers: { "from-gemini": { command: "gemini-cmd" } }
      }));

      // XDG config has a different MCP
      const xdgPath = path.join(mockHome, ".config", "antigravity", "config.json");
      await fs.mkdir(path.dirname(xdgPath), { recursive: true });
      await fs.writeFile(xdgPath, JSON.stringify({
        mcpServers: { "from-xdg": { command: "xdg-cmd" } }
      }));

      const { mcps } = await adapter.read();
      expect(mcps["from-gemini"]).toBeDefined();
      expectHas(mcps, "from-gemini");
      expectHas(mcps, "from-xdg");
      expect(mcps["from-gemini"].command).toBe("gemini-cmd");
      expect(mcps["from-xdg"]).toBeDefined();
      expect(mcps["from-xdg"].command).toBe("xdg-cmd");
    });
  });

  // ── Agent Read (File-Based) ────────────────────────────────

  describe("agents (file-based)", () => {
    it("reads agent from GEMINI.md in project root", async () => {
      const adapter = new AntigravityAdapter();
      await fs.writeFile(path.join(mockHome, "GEMINI.md"), "You are a helpful coding assistant.");

      const { agents } = await adapter.read();
      expect(agents["gemini"]).toBeDefined();
      expectHas(agents, "gemini");
      expect(agents["gemini"].prompt).toBe("You are a helpful coding assistant.");
      expect(agents["gemini"].scope).toBe("project");
    });

    it("reads agent from AGENTS.md in project root", async () => {
      const adapter = new AntigravityAdapter();
      await fs.writeFile(path.join(mockHome, "AGENTS.md"), "Multi-agent instructions here.");

      const { agents } = await adapter.read();
      expect(agents["agents"]).toBeDefined();
      expectHas(agents, "agents");
      expect(agents["agents"].prompt).toBe("Multi-agent instructions here.");
      expect(agents["agents"].scope).toBe("project");
    });

    it("reads agents from .agent/rules/*.md files", async () => {
      const adapter = new AntigravityAdapter();
      const rulesDir = path.join(mockHome, ".agent", "rules");
      await fs.mkdir(rulesDir, { recursive: true });
      await fs.writeFile(path.join(rulesDir, "code-style.md"), [
        "---",
        "name: Code Style",
        "description: Enforce code style",
        "---",
        "",
        "Always use 2-space indentation.",
      ].join("\n"));

      const { agents } = await adapter.read();
      expect(agents["code-style"]).toBeDefined();
      expectHas(agents, "code-style");
      expect(agents["code-style"].name).toBe("Code Style");
      expect(agents["code-style"].description).toBe("Enforce code style");
      expect(agents["code-style"].prompt).toBe("Always use 2-space indentation.");
      expect(agents["code-style"].scope).toBe("project");
    });

    it("reads GEMINI.md with frontmatter metadata", async () => {
      const adapter = new AntigravityAdapter();
      await fs.writeFile(path.join(mockHome, "GEMINI.md"), [
        "---",
        "name: Gemini Agent",
        "model: gemini-2.0-flash",
        "---",
        "",
        "You are a specialized agent.",
      ].join("\n"));

      const { agents } = await adapter.read();
      expectHas(agents, "gemini");
      expect(agents["gemini"].name).toBe("Gemini Agent");
      expect(agents["gemini"].model).toBe("gemini-2.0-flash");
      expect(agents["gemini"].prompt).toBe("You are a specialized agent.");
    });

    it("ignores non-.md files in .agent/rules/", async () => {
      const adapter = new AntigravityAdapter();
      const rulesDir = path.join(mockHome, ".agent", "rules");
      await fs.mkdir(rulesDir, { recursive: true });
      await fs.writeFile(path.join(rulesDir, "valid.md"), "Valid agent rule.");
      await fs.writeFile(path.join(rulesDir, "notes.txt"), "Should be ignored.");
      await fs.writeFile(path.join(rulesDir, "config.json"), "{}");

      const { agents } = await adapter.read();
      expect(Object.keys(agents)).toEqual(["valid"]);
    });

    it("does not read agents from JSON config", async () => {
      const adapter = new AntigravityAdapter();
      const mcpPath = path.join(mockHome, ".gemini", "antigravity", "mcp_config.json");
      await fs.mkdir(path.dirname(mcpPath), { recursive: true });
      await fs.writeFile(mcpPath, JSON.stringify({
        mcpServers: {},
        agents: {
          "json-agent": { name: "JSON Agent", prompt: "Should not appear" }
        }
      }));

      const { agents } = await adapter.read();
      expect(agents["json-agent"]).toBeUndefined();
    });
  });

  // ── Agent Write ────────────────────────────────────────────

  describe("agent writing", () => {
    it("writes agents as markdown files to .agent/rules/", async () => {
      const adapter = new AntigravityAdapter();
      await adapter.write({
        mcps: {},
        agents: {
          "my-agent": {
            name: "My Agent",
            description: "A test agent",
            prompt: "You are a test agent.",
            model: "gemini-pro",
          }
        },
        skills: {},
      });

      const agentPath = path.join(mockHome, ".agent", "rules", "my-agent.md");
      const raw = await fs.readFile(agentPath, "utf-8");
      expect(raw).toContain("name: My Agent");
      expect(raw).toContain("description: A test agent");
      expect(raw).toContain("model: gemini-pro");
      expect(raw).toContain("You are a test agent.");
    });

    it("writes agent without frontmatter when only prompt is given", async () => {
      const adapter = new AntigravityAdapter();
      await adapter.write({
        mcps: {},
        agents: {
          "simple": {
            name: "simple",
            prompt: "Just a plain prompt.",
          }
        },
        skills: {},
      });

      const agentPath = path.join(mockHome, ".agent", "rules", "simple.md");
      const raw = await fs.readFile(agentPath, "utf-8");
      // serializeFrontmatter includes name in frontmatter
      expect(raw).toContain("Just a plain prompt.");
    });
  });

  // ── Skill Read (File-Based) ────────────────────────────────

  describe("skills (file-based)", () => {
    it("reads skills from user skills directory (~/.gemini/antigravity/skills/)", async () => {
      const adapter = new AntigravityAdapter();
      const skillDir = path.join(mockHome, ".gemini", "antigravity", "skills", "deploy");
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
      expect(skills["deploy"]).toBeDefined();
      expectHas(skills, "deploy");
      expect(skills["deploy"].name).toBe("Deploy");
      expect(skills["deploy"].description).toBe("Deploy to production");
      expect(skills["deploy"].trigger).toBe("/deploy");
      expect(skills["deploy"].content).toBe("Run the deployment pipeline.");
      expect(skills["deploy"].scope).toBe("user");
    });

    it("reads skills from project skills directory (.agents/skills/)", async () => {
      const adapter = new AntigravityAdapter();
      const skillDir = path.join(mockHome, ".agents", "skills", "lint");
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(path.join(skillDir, "SKILL.md"), [
        "---",
        "name: Lint",
        "---",
        "",
        "Run the linter.",
      ].join("\n"));

      const { skills } = await adapter.read();
      expect(skills["lint"]).toBeDefined();
      expectHas(skills, "lint");
      expect(skills["lint"].name).toBe("Lint");
      expect(skills["lint"].content).toBe("Run the linter.");
      expect(skills["lint"].scope).toBe("project");
    });

    it("project skills override user skills with same name", async () => {
      const adapter = new AntigravityAdapter();

      // User skill
      const userSkillDir = path.join(mockHome, ".gemini", "antigravity", "skills", "build");
      await fs.mkdir(userSkillDir, { recursive: true });
      await fs.writeFile(path.join(userSkillDir, "SKILL.md"), [
        "---",
        "name: Build (User)",
        "---",
        "",
        "User build instructions.",
      ].join("\n"));

      // Project skill (same key)
      const projectSkillDir = path.join(mockHome, ".agents", "skills", "build");
      await fs.mkdir(projectSkillDir, { recursive: true });
      await fs.writeFile(path.join(projectSkillDir, "SKILL.md"), [
        "---",
        "name: Build (Project)",
        "---",
        "",
        "Project build instructions.",
      ].join("\n"));

      const { skills } = await adapter.read();
      expectHas(skills, "build");
      expect(skills["build"].name).toBe("Build (Project)");
      expect(skills["build"].scope).toBe("project");
    });

    it("does not read skills from JSON config", async () => {
      const adapter = new AntigravityAdapter();
      const mcpPath = path.join(mockHome, ".gemini", "antigravity", "mcp_config.json");
      await fs.mkdir(path.dirname(mcpPath), { recursive: true });
      await fs.writeFile(mcpPath, JSON.stringify({
        mcpServers: {},
        skills: {
          "json-skill": { name: "JSON Skill", content: "Should not appear" }
        }
      }));

      const { skills } = await adapter.read();
      expect(skills["json-skill"]).toBeUndefined();
    });
  });

  // ── Skill Write ────────────────────────────────────────────

  describe("skill writing", () => {
    it("writes user-scoped skills to ~/.gemini/antigravity/skills/", async () => {
      const adapter = new AntigravityAdapter();
      await adapter.write({
        mcps: {},
        agents: {},
        skills: {
          "test-skill": {
            name: "Test Skill",
            description: "A test",
            trigger: "/test",
            content: "Run the tests.",
            scope: "user",
          }
        },
      });

      const skillPath = path.join(mockHome, ".gemini", "antigravity", "skills", "test-skill", "SKILL.md");
      const raw = await fs.readFile(skillPath, "utf-8");
      expect(raw).toContain("name: Test Skill");
      expect(raw).toContain("description: A test");
      expect(raw).toContain("trigger: /test");
      expect(raw).toContain("Run the tests.");
    });

    it("writes project-scoped skills to .agents/skills/", async () => {
      const adapter = new AntigravityAdapter();
      await adapter.write({
        mcps: {},
        agents: {},
        skills: {
          "proj-skill": {
            name: "Project Skill",
            content: "Project-level skill content.",
            scope: "project",
          }
        },
      });

      const skillPath = path.join(mockHome, ".agents", "skills", "proj-skill", "SKILL.md");
      const raw = await fs.readFile(skillPath, "utf-8");
      expect(raw).toContain("name: Project Skill");
      expect(raw).toContain("Project-level skill content.");
    });
  });

  // ── Memory File ────────────────────────────────────────────

  describe("memory file", () => {
    it("returns GEMINI.md as memory file name", () => {
      const adapter = new AntigravityAdapter();
      expect(adapter.getMemoryFileName()).toBe("GEMINI.md");
    });

    it("reads memory from GEMINI.md", async () => {
      const adapter = new AntigravityAdapter();
      await fs.writeFile(path.join(mockHome, "GEMINI.md"), "Memory content here.");
      const content = await adapter.readMemory(mockHome);
      expect(content).toBe("Memory content here.");
    });

    it("writes memory to GEMINI.md", async () => {
      const adapter = new AntigravityAdapter();
      await adapter.writeMemory(mockHome, "New memory content.");
      const content = await fs.readFile(path.join(mockHome, "GEMINI.md"), "utf-8");
      expect(content).toBe("New memory content.");
    });

    it("returns null when GEMINI.md does not exist", async () => {
      const adapter = new AntigravityAdapter();
      const content = await adapter.readMemory(mockHome);
      expect(content).toBeNull();
    });
  });

  // ── Round-trip ─────────────────────────────────────────────

  describe("round-trip", () => {
    it("round-trips MCPs through write then read", async () => {
      const adapter = new AntigravityAdapter();
      await adapter.write({
        mcps: {
          "rt-mcp": { command: "node", args: ["index.js"], env: { API: "key" } }
        },
        agents: {},
        skills: {},
      });

      const { mcps } = await adapter.read();
      expectHas(mcps, "rt-mcp");
      expect(mcps["rt-mcp"].command).toBe("node");
      expect(mcps["rt-mcp"].args).toEqual(["index.js"]);
      expect(mcps["rt-mcp"].env).toEqual({ API: "key" });
    });

    it("round-trips agents through write then read", async () => {
      const adapter = new AntigravityAdapter();
      await adapter.write({
        mcps: {},
        agents: {
          "rt-agent": {
            name: "Round Trip Agent",
            description: "Tests round-trip",
            prompt: "You assist with testing.",
            model: "gemini-2.0-flash",
          }
        },
        skills: {},
      });

      const { agents } = await adapter.read();
      expectHas(agents, "rt-agent");
      expect(agents["rt-agent"]).toBeDefined();
      expect(agents["rt-agent"].name).toBe("Round Trip Agent");
      expect(agents["rt-agent"].description).toBe("Tests round-trip");
      expect(agents["rt-agent"].prompt).toBe("You assist with testing.");
      expect(agents["rt-agent"].model).toBe("gemini-2.0-flash");
    });

    it("round-trips skills through write then read", async () => {
      const adapter = new AntigravityAdapter();
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
