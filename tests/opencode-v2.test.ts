import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { OpenCodeAdapter } from "../src/adapters/opencode.js";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { expectHas } from "./test-helpers.js";

describe("OpenCode Adapter v2", () => {
  let mockHome: string;
  let originalCwd: string;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-opencode-v2-"));
    process.env.SYNCTAX_HOME = mockHome;
    originalCwd = process.cwd();
    process.chdir(mockHome);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  // -----------------------------------------------------------------------
  // MCP: Read
  // -----------------------------------------------------------------------

  describe("MCP read", () => {
    it("reads MCPs with array command format", async () => {
      const adapter = new OpenCodeAdapter();
      await fs.mkdir(path.join(mockHome, ".config", "opencode"), { recursive: true });
      await fs.writeFile(
        path.join(mockHome, ".config", "opencode", "config.json"),
        JSON.stringify({
          mcp: {
            postgres: {
              type: "local",
              command: ["npx", "-y", "@modelcontextprotocol/server-postgres"],
              environment: { DB_URL: "postgres://localhost" },
              enabled: true,
            },
          },
        }),
      );

      const { mcps } = await adapter.read();
      expectHas(mcps, "postgres");
      expect(mcps.postgres).toBeDefined();
      expect(mcps.postgres.command).toBe("npx");
      expect(mcps.postgres.args).toEqual(["-y", "@modelcontextprotocol/server-postgres"]);
      expect(mcps.postgres.env).toEqual({ DB_URL: "postgres://localhost" });
      expect(mcps.postgres.transport).toBe("stdio");
      expect(mcps.postgres.scope).toBe("user");
    });

    it("reads remote MCP type as sse transport", async () => {
      const adapter = new OpenCodeAdapter();
      await fs.mkdir(path.join(mockHome, ".config", "opencode"), { recursive: true });
      await fs.writeFile(
        path.join(mockHome, ".config", "opencode", "config.json"),
        JSON.stringify({
          mcp: {
            remote: {
              type: "remote",
              command: ["curl", "https://example.com/mcp"],
              environment: {},
              enabled: true,
            },
          },
        }),
      );

      const { mcps } = await adapter.read();
      expectHas(mcps, "remote");
      expect(mcps.remote.transport).toBe("sse");
    });

    it("reads single-element command array correctly", async () => {
      const adapter = new OpenCodeAdapter();
      await fs.mkdir(path.join(mockHome, ".config", "opencode"), { recursive: true });
      await fs.writeFile(
        path.join(mockHome, ".config", "opencode", "config.json"),
        JSON.stringify({
          mcp: {
            simple: {
              type: "local",
              command: ["my-server"],
              environment: {},
            },
          },
        }),
      );

      const { mcps } = await adapter.read();
      expectHas(mcps, "simple");
      expect(mcps.simple.command).toBe("my-server");
      expect(mcps.simple.args).toEqual([]);
    });

    it("skips MCPs with non-array command", async () => {
      const adapter = new OpenCodeAdapter();
      await fs.mkdir(path.join(mockHome, ".config", "opencode"), { recursive: true });
      await fs.writeFile(
        path.join(mockHome, ".config", "opencode", "config.json"),
        JSON.stringify({
          mcp: {
            broken: {
              type: "local",
              command: "not-an-array",
              environment: {},
            },
          },
        }),
      );

      const { mcps } = await adapter.read();
      expect(mcps.broken).toBeUndefined();
    });

    it("skips MCPs with empty array command", async () => {
      const adapter = new OpenCodeAdapter();
      await fs.mkdir(path.join(mockHome, ".config", "opencode"), { recursive: true });
      await fs.writeFile(
        path.join(mockHome, ".config", "opencode", "config.json"),
        JSON.stringify({
          mcp: {
            empty: {
              type: "local",
              command: [],
              environment: {},
            },
          },
        }),
      );

      const { mcps } = await adapter.read();
      expect(mcps.empty).toBeUndefined();
    });

    it("reads environment (not env) from OpenCode format", async () => {
      const adapter = new OpenCodeAdapter();
      await fs.mkdir(path.join(mockHome, ".config", "opencode"), { recursive: true });
      await fs.writeFile(
        path.join(mockHome, ".config", "opencode", "config.json"),
        JSON.stringify({
          mcp: {
            srv: {
              type: "local",
              command: ["my-srv"],
              environment: { API_KEY: "secret123" },
            },
          },
        }),
      );

      const { mcps } = await adapter.read();
      expectHas(mcps, "srv");
      expect(mcps.srv.env).toEqual({ API_KEY: "secret123" });
    });
  });

  // -----------------------------------------------------------------------
  // MCP: Write
  // -----------------------------------------------------------------------

  describe("MCP write", () => {
    it("writes MCPs with array command + environment + type", async () => {
      const adapter = new OpenCodeAdapter();
      await adapter.write({
        mcps: {
          postgres: {
            command: "npx",
            args: ["-y", "pg-server"],
            env: { DB: "test" },
            transport: "stdio",
          },
        },
        agents: {},
        skills: {},
      });

      const configPath = path.join(mockHome, ".config", "opencode", "config.json");
      const config = JSON.parse(await fs.readFile(configPath, "utf-8"));
      expect(config.mcp.postgres).toEqual({
        type: "local",
        command: ["npx", "-y", "pg-server"],
        environment: { DB: "test" },
        enabled: true,
      });
    });

    it("writes remote transport as type: remote", async () => {
      const adapter = new OpenCodeAdapter();
      await adapter.write({
        mcps: {
          remote: {
            command: "curl",
            args: ["https://example.com"],
            env: {},
            transport: "sse",
          },
        },
        agents: {},
        skills: {},
      });

      const configPath = path.join(mockHome, ".config", "opencode", "config.json");
      const config = JSON.parse(await fs.readFile(configPath, "utf-8"));
      expect(config.mcp.remote.type).toBe("remote");
    });

    it("writes MCP with no args as single-element command array", async () => {
      const adapter = new OpenCodeAdapter();
      await adapter.write({
        mcps: {
          simple: {
            command: "my-server",
          },
        },
        agents: {},
        skills: {},
      });

      const configPath = path.join(mockHome, ".config", "opencode", "config.json");
      const config = JSON.parse(await fs.readFile(configPath, "utf-8"));
      expect(config.mcp.simple.command).toEqual(["my-server"]);
      expect(config.mcp.simple.environment).toEqual({});
    });

    it("routes project-scoped MCPs to project config", async () => {
      const adapter = new OpenCodeAdapter();
      await adapter.write({
        mcps: {
          proj: { command: "proj-cmd", args: ["a"], scope: "project" },
          usr: { command: "usr-cmd", args: ["b"], scope: "user" },
        },
        agents: {},
        skills: {},
      });

      const projectConfig = JSON.parse(await fs.readFile(path.join(mockHome, "opencode.json"), "utf-8"));
      const userConfig = JSON.parse(await fs.readFile(path.join(mockHome, ".config", "opencode", "config.json"), "utf-8"));

      expect(projectConfig.mcp.proj.command).toEqual(["proj-cmd", "a"]);
      expect(projectConfig.mcp.usr).toBeUndefined();
      expect(userConfig.mcp.usr.command).toEqual(["usr-cmd", "b"]);
      expect(userConfig.mcp.proj).toBeUndefined();
    });

    it("preserves non-managed fields in existing config", async () => {
      const adapter = new OpenCodeAdapter();
      const configDir = path.join(mockHome, ".config", "opencode");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "config.json"),
        JSON.stringify({ customField: "keep me", mcp: {} }),
      );

      await adapter.write({
        mcps: { srv: { command: "srv" } },
        agents: {},
        skills: {},
      });

      const config = JSON.parse(await fs.readFile(path.join(configDir, "config.json"), "utf-8"));
      expect(config.customField).toBe("keep me");
      expect(config.mcp.srv).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Agent: Read (singular key "agent", field "prompt")
  // -----------------------------------------------------------------------

  describe("Agent read", () => {
    it("reads agents with singular key and prompt field", async () => {
      const adapter = new OpenCodeAdapter();
      await fs.mkdir(path.join(mockHome, ".config", "opencode"), { recursive: true });
      await fs.writeFile(
        path.join(mockHome, ".config", "opencode", "config.json"),
        JSON.stringify({
          agent: {
            planner: {
              name: "Planner",
              description: "Plans tasks",
              prompt: "You are a planner.",
              model: "gpt-4",
            },
          },
        }),
      );

      const { agents } = await adapter.read();
      expectHas(agents, "planner");
      expect(agents.planner).toBeDefined();
      expect(agents.planner.name).toBe("Planner");
      expect(agents.planner.description).toBe("Plans tasks");
      expect(agents.planner.prompt).toBe("You are a planner.");
      expect(agents.planner.model).toBe("gpt-4");
      expect(agents.planner.scope).toBe("user");
    });

    it("does NOT read agents from plural 'agents' key", async () => {
      const adapter = new OpenCodeAdapter();
      await fs.mkdir(path.join(mockHome, ".config", "opencode"), { recursive: true });
      await fs.writeFile(
        path.join(mockHome, ".config", "opencode", "config.json"),
        JSON.stringify({
          agents: {
            old: { name: "Old", system_message: "old format" },
          },
        }),
      );

      const { agents } = await adapter.read();
      expect(agents.old).toBeUndefined();
    });

    it("uses key as fallback name when name field missing", async () => {
      const adapter = new OpenCodeAdapter();
      await fs.mkdir(path.join(mockHome, ".config", "opencode"), { recursive: true });
      await fs.writeFile(
        path.join(mockHome, ".config", "opencode", "config.json"),
        JSON.stringify({
          agent: {
            coder: { prompt: "Code stuff." },
          },
        }),
      );

      const { agents } = await adapter.read();
      expectHas(agents, "coder");
      expect(agents.coder.name).toBe("coder");
      expect(agents.coder.prompt).toBe("Code stuff.");
    });
  });

  // -----------------------------------------------------------------------
  // Agent: Write (singular key "agent", field "prompt")
  // -----------------------------------------------------------------------

  describe("Agent write", () => {
    it("writes agents with singular key and prompt field", async () => {
      const adapter = new OpenCodeAdapter();
      await adapter.write({
        mcps: {},
        agents: {
          planner: {
            name: "Planner",
            description: "Plans tasks",
            prompt: "You are a planner.",
            model: "gpt-4",
          },
        },
        skills: {},
      });

      const configPath = path.join(mockHome, ".config", "opencode", "config.json");
      const config = JSON.parse(await fs.readFile(configPath, "utf-8"));

      expect(config.agent).toBeDefined();
      expect(config.agents).toBeUndefined();
      expect(config.agent.planner.name).toBe("Planner");
      expect(config.agent.planner.prompt).toBe("You are a planner.");
      expect(config.agent.planner.model).toBe("gpt-4");
      // Should NOT have system_message
      expect(config.agent.planner.system_message).toBeUndefined();
    });

    it("routes project-scoped agents to project config", async () => {
      const adapter = new OpenCodeAdapter();
      await adapter.write({
        mcps: {},
        agents: {
          projAgent: { name: "ProjAgent", prompt: "Project agent", scope: "project" },
          userAgent: { name: "UserAgent", prompt: "User agent", scope: "user" },
        },
        skills: {},
      });

      const projectConfig = JSON.parse(await fs.readFile(path.join(mockHome, "opencode.json"), "utf-8"));
      const userConfig = JSON.parse(await fs.readFile(path.join(mockHome, ".config", "opencode", "config.json"), "utf-8"));

      expect(projectConfig.agent.projAgent.prompt).toBe("Project agent");
      expect(projectConfig.agent.userAgent).toBeUndefined();
      expect(userConfig.agent.userAgent.prompt).toBe("User agent");
      expect(userConfig.agent.projAgent).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Skill: Read (directory-based SKILL.md)
  // -----------------------------------------------------------------------

  describe("Skill read", () => {
    it("reads directory-based SKILL.md files from user skills dir", async () => {
      const adapter = new OpenCodeAdapter();
      const skillDir = path.join(mockHome, ".config", "opencode", "skills", "my-skill");
      await fs.mkdir(skillDir, { recursive: true });

      await fs.writeFile(
        path.join(skillDir, "SKILL.md"),
        `---
name: My Skill
description: A test skill
trigger: /myskill
---

Do the thing.`,
      );

      const { skills } = await adapter.read();
      expectHas(skills, "my-skill");
      expect(skills["my-skill"]).toBeDefined();
      expect(skills["my-skill"].name).toBe("My Skill");
      expect(skills["my-skill"].description).toBe("A test skill");
      expect(skills["my-skill"].trigger).toBe("/myskill");
      expect(skills["my-skill"].content).toBe("Do the thing.");
      expect(skills["my-skill"].scope).toBe("user");
    });

    it("reads directory-based SKILL.md files from project skills dir", async () => {
      const adapter = new OpenCodeAdapter();
      const skillDir = path.join(mockHome, ".opencode", "skills", "proj-skill");
      await fs.mkdir(skillDir, { recursive: true });

      await fs.writeFile(
        path.join(skillDir, "SKILL.md"),
        `---
name: Project Skill
---

Project skill content.`,
      );

      const { skills } = await adapter.read();
      expectHas(skills, "proj-skill");
      expect(skills["proj-skill"]).toBeDefined();
      expect(skills["proj-skill"].name).toBe("Project Skill");
      expect(skills["proj-skill"].content).toBe("Project skill content.");
      expect(skills["proj-skill"].scope).toBe("project");
    });

    it("project skills override user skills with same name", async () => {
      const adapter = new OpenCodeAdapter();

      // User skill
      const userSkillDir = path.join(mockHome, ".config", "opencode", "skills", "shared");
      await fs.mkdir(userSkillDir, { recursive: true });
      await fs.writeFile(
        path.join(userSkillDir, "SKILL.md"),
        `---\nname: User Version\n---\nUser content.`,
      );

      // Project skill (same name)
      const projSkillDir = path.join(mockHome, ".opencode", "skills", "shared");
      await fs.mkdir(projSkillDir, { recursive: true });
      await fs.writeFile(
        path.join(projSkillDir, "SKILL.md"),
        `---\nname: Project Version\n---\nProject content.`,
      );

      const { skills } = await adapter.read();
      expectHas(skills, "shared");
      expect(skills.shared.name).toBe("Project Version");
      expect(skills.shared.content).toBe("Project content.");
      expect(skills.shared.scope).toBe("project");
    });

    it("ignores non-directory entries in skills dir", async () => {
      const adapter = new OpenCodeAdapter();
      const skillsDir = path.join(mockHome, ".config", "opencode", "skills");
      await fs.mkdir(skillsDir, { recursive: true });

      // Put a random file (not a directory) in skills/
      await fs.writeFile(path.join(skillsDir, "stray-file.md"), "not a skill");

      const { skills } = await adapter.read();
      expect(Object.keys(skills).length).toBe(0);
    });

    it("ignores skill directories without SKILL.md", async () => {
      const adapter = new OpenCodeAdapter();
      const skillDir = path.join(mockHome, ".config", "opencode", "skills", "empty-skill");
      await fs.mkdir(skillDir, { recursive: true });
      // No SKILL.md inside

      const { skills } = await adapter.read();
      expect(skills["empty-skill"]).toBeUndefined();
    });

    it("handles skill with no frontmatter", async () => {
      const adapter = new OpenCodeAdapter();
      const skillDir = path.join(mockHome, ".config", "opencode", "skills", "bare");
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(path.join(skillDir, "SKILL.md"), "Just plain content.");

      const { skills } = await adapter.read();
      expectHas(skills, "bare");
      expect(skills.bare).toBeDefined();
      expect(skills.bare.name).toBe("bare"); // falls back to key
      expect(skills.bare.content).toBe("Just plain content.");
    });

    it("reads skills from Claude and Agents compatibility paths", async () => {
      const adapter = new OpenCodeAdapter();

      const claudeSkillDir = path.join(mockHome, ".claude", "skills", "claude-skill");
      await fs.mkdir(claudeSkillDir, { recursive: true });
      await fs.writeFile(
        path.join(claudeSkillDir, "SKILL.md"),
        `---
name: Claude Skill
---

Claude compatibility content.`,
      );

      const agentsSkillDir = path.join(mockHome, ".agents", "skills", "agents-skill");
      await fs.mkdir(agentsSkillDir, { recursive: true });
      await fs.writeFile(
        path.join(agentsSkillDir, "SKILL.md"),
        `---
name: Agents Skill
---

Agents compatibility content.`,
      );

      const { skills } = await adapter.read();
      expectHas(skills, "claude-skill");
      expectHas(skills, "agents-skill");
      expect(skills["claude-skill"].content).toBe("Claude compatibility content.");
      expect(skills["agents-skill"].content).toBe("Agents compatibility content.");
    });
  });

  // -----------------------------------------------------------------------
  // Skill: Write (directory-based SKILL.md)
  // -----------------------------------------------------------------------

  describe("Skill write", () => {
    it("writes skills as directory-based SKILL.md files", async () => {
      const adapter = new OpenCodeAdapter();
      await adapter.write({
        mcps: {},
        agents: {},
        skills: {
          "my-skill": {
            name: "My Skill",
            content: "Do the thing.",
            description: "A test skill",
            trigger: "/myskill",
          },
        },
      });

      const skillPath = path.join(mockHome, ".config", "opencode", "skills", "my-skill", "SKILL.md");
      const content = await fs.readFile(skillPath, "utf-8");
      expect(content).toContain("name: My Skill");
      expect(content).toContain("description: A test skill");
      expect(content).toContain("trigger: /myskill");
      expect(content).toContain("Do the thing.");
    });

    it("writes project-scoped skills to project skills dir", async () => {
      const adapter = new OpenCodeAdapter();
      await adapter.write({
        mcps: {},
        agents: {},
        skills: {
          "proj-skill": {
            name: "Proj Skill",
            content: "Project content.",
            scope: "project",
          },
        },
      });

      const skillPath = path.join(mockHome, ".opencode", "skills", "proj-skill", "SKILL.md");
      const content = await fs.readFile(skillPath, "utf-8");
      expect(content).toContain("name: Proj Skill");
      expect(content).toContain("Project content.");
    });

    it("does not write skills to JSON config", async () => {
      const adapter = new OpenCodeAdapter();
      await adapter.write({
        mcps: {},
        agents: {},
        skills: {
          fmt: { name: "fmt", content: "Format code", trigger: "/fmt" },
        },
      });

      // There should be no JSON config created (only skills, no mcps/agents)
      const userConfigPath = path.join(mockHome, ".config", "opencode", "config.json");
      let hasJsonConfig = false;
      try {
        await fs.access(userConfigPath);
        hasJsonConfig = true;
      } catch { /* expected */ }

      if (hasJsonConfig) {
        const config = JSON.parse(await fs.readFile(userConfigPath, "utf-8"));
        expect(config.skills).toBeUndefined();
      }

      // But the SKILL.md should exist
      const skillPath = path.join(mockHome, ".config", "opencode", "skills", "fmt", "SKILL.md");
      const content = await fs.readFile(skillPath, "utf-8");
      expect(content).toContain("Format code");
    });
  });

  // -----------------------------------------------------------------------
  // Scope precedence
  // -----------------------------------------------------------------------

  describe("Scope precedence", () => {
    it("project scope MCPs override user scope", async () => {
      const adapter = new OpenCodeAdapter();

      // User config
      await fs.mkdir(path.join(mockHome, ".config", "opencode"), { recursive: true });
      await fs.writeFile(
        path.join(mockHome, ".config", "opencode", "config.json"),
        JSON.stringify({
          mcp: {
            shared: {
              type: "local",
              command: ["user-cmd"],
              environment: {},
            },
          },
        }),
      );

      // Project config
      await fs.writeFile(
        path.join(mockHome, "opencode.json"),
        JSON.stringify({
          mcp: {
            shared: {
              type: "local",
              command: ["project-cmd"],
              environment: {},
            },
          },
        }),
      );

      const { mcps } = await adapter.read();
      expectHas(mcps, "shared");
      expect(mcps.shared.command).toBe("project-cmd");
      expect(mcps.shared.scope).toBe("project");
    });
  });

  // -----------------------------------------------------------------------
  // Round-trip: write -> read
  // -----------------------------------------------------------------------

  describe("Round-trip", () => {
    it("MCP round-trip: write then read produces equivalent data", async () => {
      const adapter = new OpenCodeAdapter();
      const originalMcps = {
        postgres: {
          command: "npx",
          args: ["-y", "pg-server"],
          env: { DB: "test" },
          transport: "stdio" as const,
        },
      };

      await adapter.write({ mcps: originalMcps, agents: {}, skills: {} });
      const { mcps } = await adapter.read();
      expectHas(mcps, "postgres");

      expect(mcps.postgres.command).toBe("npx");
      expect(mcps.postgres.args).toEqual(["-y", "pg-server"]);
      expect(mcps.postgres.env).toEqual({ DB: "test" });
      expect(mcps.postgres.transport).toBe("stdio");
    });

    it("Agent round-trip: write then read produces equivalent data", async () => {
      const adapter = new OpenCodeAdapter();
      const originalAgents = {
        planner: {
          name: "Planner",
          description: "Plans tasks",
          prompt: "You are a planner.",
          model: "gpt-4",
        },
      };

      await adapter.write({ mcps: {}, agents: originalAgents, skills: {} });
      const { agents } = await adapter.read();
      expectHas(agents, "planner");

      expect(agents.planner.name).toBe("Planner");
      expect(agents.planner.description).toBe("Plans tasks");
      expect(agents.planner.prompt).toBe("You are a planner.");
      expect(agents.planner.model).toBe("gpt-4");
    });

    it("Skill round-trip: write then read produces equivalent data", async () => {
      const adapter = new OpenCodeAdapter();
      const originalSkills = {
        fmt: {
          name: "Format",
          content: "Format the code.",
          description: "Formatting skill",
          trigger: "/fmt",
        },
      };

      await adapter.write({ mcps: {}, agents: {}, skills: originalSkills });
      const { skills } = await adapter.read();
      expectHas(skills, "fmt");

      expect(skills.fmt.name).toBe("Format");
      expect(skills.fmt.content).toBe("Format the code.");
      expect(skills.fmt.description).toBe("Formatting skill");
      expect(skills.fmt.trigger).toBe("/fmt");
    });

    it("Full round-trip: MCPs + agents + skills together", async () => {
      const adapter = new OpenCodeAdapter();

      await adapter.write({
        mcps: {
          srv: { command: "node", args: ["srv.js"], env: { PORT: "3000" }, transport: "stdio" },
        },
        agents: {
          coder: { name: "Coder", prompt: "You code.", model: "gpt-4" },
        },
        skills: {
          review: { name: "Review", content: "Review the code.", trigger: "/review" },
        },
      });

      const result = await adapter.read();
      expectHas(result.mcps, "srv");
      expectHas(result.agents, "coder");
      expectHas(result.skills, "review");

      expect(result.mcps.srv.command).toBe("node");
      expect(result.mcps.srv.args).toEqual(["srv.js"]);
      expect(result.mcps.srv.env).toEqual({ PORT: "3000" });

      expect(result.agents.coder.name).toBe("Coder");
      expect(result.agents.coder.prompt).toBe("You code.");

      expect(result.skills.review.name).toBe("Review");
      expect(result.skills.review.content).toBe("Review the code.");
      expect(result.skills.review.trigger).toBe("/review");
    });
  });

  // -----------------------------------------------------------------------
  // Detection
  // -----------------------------------------------------------------------

  describe("Detection", () => {
    it("detects when config exists", async () => {
      const adapter = new OpenCodeAdapter();
      expect(await adapter.detect()).toBe(false);

      await fs.mkdir(path.join(mockHome, ".config", "opencode"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".config", "opencode", "config.json"), "{}");
      expect(await adapter.detect()).toBe(true);
    });

    it("detects project opencode.json", async () => {
      const adapter = new OpenCodeAdapter();
      await fs.writeFile(path.join(mockHome, "opencode.json"), "{}");
      expect(await adapter.detect()).toBe(true);
    });

    it("detects skills-only installs via compatibility skill roots", async () => {
      const adapter = new OpenCodeAdapter();
      expect(await adapter.detect()).toBe(false);

      const skillDir = path.join(mockHome, ".agents", "skills", "global-skill");
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, "SKILL.md"),
        `---
name: Global Skill
---

Global skill content.`,
      );

      expect(await adapter.detect()).toBe(true);
    });

    it("detects and reads from OPENCODE_CONFIG override path", async () => {
      const adapter = new OpenCodeAdapter();
      const previousOpencodeConfig = process.env.OPENCODE_CONFIG;
      const customConfigPath = path.join(mockHome, "custom", "opencode-custom.json");

      await fs.mkdir(path.dirname(customConfigPath), { recursive: true });
      await fs.writeFile(
        customConfigPath,
        JSON.stringify({
          mcp: {
            customServer: {
              type: "local",
              command: ["node", "custom-server.js"],
              environment: {},
            },
          },
        }),
      );
      process.env.OPENCODE_CONFIG = customConfigPath;

      try {
        expect(await adapter.detect()).toBe(true);
        const { mcps } = await adapter.read();
        expectHas(mcps, "customServer");
        expect(mcps.customServer.command).toBe("node");
        expect(mcps.customServer.args).toEqual(["custom-server.js"]);
      } finally {
        if (previousOpencodeConfig === undefined) {
          delete process.env.OPENCODE_CONFIG;
        } else {
          process.env.OPENCODE_CONFIG = previousOpencodeConfig;
        }
      }
    });
  });

  // -----------------------------------------------------------------------
  // Memory
  // -----------------------------------------------------------------------

  describe("Memory", () => {
    it("returns AGENTS.md as memory file name", () => {
      const adapter = new OpenCodeAdapter();
      expect(adapter.getMemoryFileName()).toBe("AGENTS.md");
    });

    it("reads and writes memory files", async () => {
      const adapter = new OpenCodeAdapter();
      expect(await adapter.readMemory(mockHome)).toBeNull();

      await adapter.writeMemory(mockHome, "Memory content");
      expect(await adapter.readMemory(mockHome)).toBe("Memory content");
    });
  });
});
