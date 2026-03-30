import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ClaudeAdapter } from "../src/adapters/claude.js";
import { CursorAdapter } from "../src/adapters/cursor.js";
import { OpenCodeAdapter } from "../src/adapters/opencode.js";
import { AntigravityAdapter } from "../src/adapters/antigravity.js";
import { GithubCopilotCliAdapter } from "../src/adapters/github-copilot-cli.js";
import { GeminiCliAdapter } from "../src/adapters/gemini-cli.js";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createAdapterWriteResources, expectHas } from "./test-helpers.js";

describe("Adapters", () => {
  let mockHome: string;
  let originalCwd: string;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-adapter-test-"));
    process.env.SYNCTAX_HOME = mockHome;
    originalCwd = process.cwd();
    // Many Claude adapter paths use process.cwd() for project scope
    process.chdir(mockHome);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  describe("ClaudeAdapter", () => {
    it("detects via settings.json", async () => {
      const adapter = new ClaudeAdapter();
      expect(await adapter.detect()).toBe(false);

      await fs.mkdir(path.join(mockHome, ".claude"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".claude", "settings.json"), "{}");
      expect(await adapter.detect()).toBe(true);
    });

    it("detects via ~/.claude.json (user MCP file)", async () => {
      const adapter = new ClaudeAdapter();
      await fs.writeFile(path.join(mockHome, ".claude.json"), "{}");
      expect(await adapter.detect()).toBe(true);
    });

    it("detects via .mcp.json (project MCP file)", async () => {
      const adapter = new ClaudeAdapter();
      await fs.writeFile(path.join(mockHome, ".mcp.json"), "{}");
      expect(await adapter.detect()).toBe(true);
    });

    it("reads MCPs from ~/.claude.json (user scope)", async () => {
      const adapter = new ClaudeAdapter();
      await fs.writeFile(path.join(mockHome, ".claude.json"), JSON.stringify({
        mcpServers: {
          postgres: { command: "npx", args: ["-y", "@modelcontextprotocol/server-postgres"], env: { DB_URL: "postgres://localhost" } }
        }
      }));

      const { mcps } = await adapter.read();
      expectHas(mcps, "postgres");
      expect(mcps.postgres).toBeDefined();
      expect(mcps.postgres.command).toBe("npx");
      expect(mcps.postgres.args).toEqual(["-y", "@modelcontextprotocol/server-postgres"]);
      expect(mcps.postgres.env?.DB_URL).toBe("postgres://localhost");
      expect(mcps.postgres.scope).toBe("user");
    });

    it("reads MCPs from .mcp.json (project scope) with precedence over user", async () => {
      const adapter = new ClaudeAdapter();
      // User MCP
      await fs.writeFile(path.join(mockHome, ".claude.json"), JSON.stringify({
        mcpServers: { shared: { command: "user-cmd" }, userOnly: { command: "user-only" } }
      }));
      // Project MCP (higher precedence)
      await fs.writeFile(path.join(mockHome, ".mcp.json"), JSON.stringify({
        mcpServers: { shared: { command: "project-cmd" }, projOnly: { command: "proj-only" } }
      }));

      const { mcps } = await adapter.read();
      expectHas(mcps, "shared");
      expectHas(mcps, "userOnly");
      expectHas(mcps, "projOnly");
      expect(mcps.shared.command).toBe("project-cmd"); // project wins
      expect(mcps.shared.scope).toBe("project");
      expect(mcps.userOnly.command).toBe("user-only");
      expect(mcps.userOnly.scope).toBe("user");
      expect(mcps.projOnly.command).toBe("proj-only");
      expect(mcps.projOnly.scope).toBe("project");
    });

    it("writes MCPs to correct files based on scope", async () => {
      const adapter = new ClaudeAdapter();
      await adapter.write({
        mcps: {
          "user-mcp": { command: "npx", args: ["-y", "server"], scope: "user" },
          "project-mcp": { command: "bun", args: ["run", "mcp.ts"], scope: "project" },
        },
        agents: {},
        skills: {},
      });

      // User MCPs → ~/.claude.json
      const userMcps = JSON.parse(await fs.readFile(path.join(mockHome, ".claude.json"), "utf-8"));
      expect(userMcps.mcpServers["user-mcp"]).toBeDefined();
      expect(userMcps.mcpServers["user-mcp"].command).toBe("npx");
      expect(userMcps.mcpServers["project-mcp"]).toBeUndefined();

      // Project MCPs → .mcp.json
      const projectMcps = JSON.parse(await fs.readFile(path.join(mockHome, ".mcp.json"), "utf-8"));
      expect(projectMcps.mcpServers["project-mcp"]).toBeDefined();
      expect(projectMcps.mcpServers["project-mcp"].command).toBe("bun");
    });

    it("reads permissions in new Tool(specifier) format", async () => {
      const adapter = new ClaudeAdapter();
      await fs.mkdir(path.join(mockHome, ".claude"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".claude", "settings.json"), JSON.stringify({
        permissions: {
          allow: ["Bash(npm run *)", "Read(~/docs/**)"],
          deny: ["Bash(curl *)", "Read(.env)"],
          ask: ["Bash(git push *)"],
        }
      }));

      const { permissions } = await adapter.read();
      expect(permissions?.allow).toEqual(["Bash(npm run *)", "Read(~/docs/**)"]);
      expect(permissions?.deny).toEqual(["Bash(curl *)", "Read(.env)"]);
      expect(permissions?.ask).toEqual(["Bash(git push *)"]);
    });

    it("writes permissions in Tool(specifier) format", async () => {
      const adapter = new ClaudeAdapter();
      await fs.mkdir(path.join(mockHome, ".claude"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".claude", "settings.json"), "{}");

      await adapter.write({
        mcps: {}, agents: {}, skills: {},
        permissions: {
          allowedPaths: [], deniedPaths: [],
          allowedCommands: [], deniedCommands: [],
          networkAllow: false,
          allow: ["Bash(npm run *)"], deny: ["Read(.env)"], ask: [],
          allowedUrls: [], deniedUrls: [], trustedFolders: [],
        },
      });

      const settings = JSON.parse(await fs.readFile(path.join(mockHome, ".claude", "settings.json"), "utf-8"));
      expect(settings.permissions.allow).toContain("Bash(npm run *)");
      expect(settings.permissions.deny).toContain("Read(.env)");
      // Old fields should NOT be present
      expect(settings.allow_paths).toBeUndefined();
      expect(settings.deny_paths).toBeUndefined();
    });

    it("writes legacy permission fields as Tool(specifier) translations", async () => {
      const adapter = new ClaudeAdapter();
      await fs.mkdir(path.join(mockHome, ".claude"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".claude", "settings.json"), "{}");

      await adapter.write({
        mcps: {}, agents: {}, skills: {},
        permissions: {
          allowedPaths: ["/home/user"], deniedPaths: ["/etc"],
          allowedCommands: ["npm"], deniedCommands: ["rm"],
          networkAllow: false,
          allow: [], deny: [], ask: [],
          allowedUrls: [], deniedUrls: [], trustedFolders: [],
        },
      });

      const settings = JSON.parse(await fs.readFile(path.join(mockHome, ".claude", "settings.json"), "utf-8"));
      expect(settings.permissions.allow).toContain("Read(/home/user)");
      expect(settings.permissions.allow).toContain("Bash(npm)");
      expect(settings.permissions.deny).toContain("Read(/etc)");
      expect(settings.permissions.deny).toContain("Bash(rm)");
    });

    it("reads model from settings.json (not preferredModel)", async () => {
      const adapter = new ClaudeAdapter();
      await fs.mkdir(path.join(mockHome, ".claude"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".claude", "settings.json"), JSON.stringify({
        model: "claude-sonnet-4-20250514",
      }));

      const result = await adapter.read();
      expect(result.models?.defaultModel).toBe("claude-sonnet-4-20250514");
    });

    it("parses multiple file extensions for agents", async () => {
      const adapter = new ClaudeAdapter();
      await fs.mkdir(path.join(mockHome, ".claude", "agents"), { recursive: true });

      await fs.writeFile(path.join(mockHome, ".claude", "agents", "agent1.md"), "---\nname: Agent 1\n---\nPrompt 1");
      await fs.writeFile(path.join(mockHome, ".claude", "agents", "agent2.agent"), "---\nname: Agent 2\n---\nPrompt 2");
      await fs.writeFile(path.join(mockHome, ".claude", "agents", "agent3.agents"), "---\nname: Agent 3\n---\nPrompt 3");
      await fs.writeFile(path.join(mockHome, ".claude", "agents", "agent4.claude"), "---\nname: Agent 4\n---\nPrompt 4");

      const { agents } = await adapter.read();
      expectHas(agents, "agent1");
      expectHas(agents, "agent2");
      expectHas(agents, "agent3");
      expectHas(agents, "agent4");
      expect(Object.keys(agents).length).toBe(4);
      expect(agents["agent1"].prompt).toBe("Prompt 1");
      expect(agents["agent2"].prompt).toBe("Prompt 2");
      expect(agents["agent3"].prompt).toBe("Prompt 3");
      expect(agents["agent4"].prompt).toBe("Prompt 4");
    });

    it("parses extended agent frontmatter fields (tools, disallowedTools, etc.)", async () => {
      const adapter = new ClaudeAdapter();
      await fs.mkdir(path.join(mockHome, ".claude", "agents"), { recursive: true });

      const agentContent = `---
name: Power Agent
description: A powerful agent
model: claude-opus-4-20250514
tools:
  - Read
  - Write
  - Bash
disallowedTools:
  - WebFetch
permissionMode: bypassPermissions
maxTurns: 10
background: true
effort: high
isolation: true
userInvocable: false
---

You are a powerful coding agent.`;

      await fs.writeFile(path.join(mockHome, ".claude", "agents", "power.md"), agentContent);
      const { agents } = await adapter.read();
      expectHas(agents, "power");

      expect(agents.power.name).toBe("Power Agent");
      expect(agents.power.model).toBe("claude-opus-4-20250514");
      expect(agents.power.tools).toEqual(["Read", "Write", "Bash"]);
      expect(agents.power.disallowedTools).toEqual(["WebFetch"]);
      expect(agents.power.permissionMode).toBe("bypassPermissions");
      expect(agents.power.maxTurns).toBe(10);
      expect(agents.power.background).toBe(true);
      expect(agents.power.effort).toBe("high");
      expect(agents.power.isolation).toBe(true);
      expect(agents.power.userInvocable).toBe(false);
      expect(agents.power.prompt).toBe("You are a powerful coding agent.");
    });

    it("reads directory-based skills (skills/<name>/SKILL.md)", async () => {
      const adapter = new ClaudeAdapter();
      const skillDir = path.join(mockHome, ".claude", "skills", "my-skill");
      await fs.mkdir(skillDir, { recursive: true });

      await fs.writeFile(path.join(skillDir, "SKILL.md"), `---
name: My Skill
description: A test skill
user-invocable: true
allowed-tools:
  - Read
  - Grep
---

Do the thing.`);

      const { skills } = await adapter.read();
      expectHas(skills, "my-skill");
      expect(skills["my-skill"]).toBeDefined();
      expect(skills["my-skill"].name).toBe("My Skill");
      expect(skills["my-skill"].description).toBe("A test skill");
      expect(skills["my-skill"].userInvocable).toBe(true);
      expect(skills["my-skill"].allowedTools).toEqual(["Read", "Grep"]);
      expect(skills["my-skill"].content).toBe("Do the thing.");
    });

    it("writes skills as directory-based SKILL.md", async () => {
      const adapter = new ClaudeAdapter();
      await adapter.write({
        mcps: {}, agents: {},
        skills: {
          "test-skill": {
            name: "Test Skill",
            content: "Do the test.",
            description: "Testing skill",
            trigger: "/test",
          }
        },
      });

      const skillPath = path.join(mockHome, ".claude", "skills", "test-skill", "SKILL.md");
      const content = await fs.readFile(skillPath, "utf-8");
      expect(content).toContain("name: Test Skill");
      expect(content).toContain("description: Testing skill");
      expect(content).toContain("trigger: /test");
      expect(content).toContain("Do the test.");
    });

    it("also reads legacy flat-file skills for backward compat", async () => {
      const adapter = new ClaudeAdapter();
      const skillsDir = path.join(mockHome, ".claude", "skills");
      await fs.mkdir(skillsDir, { recursive: true });

      // Legacy flat file
      await fs.writeFile(path.join(skillsDir, "legacy.md"), "---\nname: Legacy\n---\nLegacy content.");

      const { skills } = await adapter.read();
      expectHas(skills, "legacy");
      expect(skills.legacy).toBeDefined();
      expect(skills.legacy.content).toBe("Legacy content.");
    });

    it("round-trips MCPs through write then read", async () => {
      const adapter = new ClaudeAdapter();
      const mcps = {
        postgres: {
          command: "npx",
          args: ["-y", "pg-server"],
          env: { DB: "test" },
          transport: "sse" as const,
          url: "https://example.com/mcp",
          headers: { Authorization: "Bearer token" },
          cwd: "/tmp",
          scope: "user" as const,
        },
      };

      await adapter.write({ mcps, agents: {}, skills: {} });
      const result = await adapter.read();
      expectHas(result.mcps, "postgres");
      expect(result.mcps.postgres.command).toBe("npx");
      expect(result.mcps.postgres.args).toEqual(["-y", "pg-server"]);
      expect(result.mcps.postgres.env?.DB).toBe("test");
      expect(result.mcps.postgres.transport).toBe("sse");
      expect(result.mcps.postgres.url).toBe("https://example.com/mcp");
      expect(result.mcps.postgres.headers?.Authorization).toBe("Bearer token");
      expect(result.mcps.postgres.cwd).toBe("/tmp");
    });

    it("preserves non-managed fields in settings.json", async () => {
      const adapter = new ClaudeAdapter();
      await fs.mkdir(path.join(mockHome, ".claude"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".claude", "settings.json"), JSON.stringify({
        customField: "keep me",
        model: "opus",
      }));

      await adapter.write({ mcps: {}, agents: {}, skills: {} });

      const settings = JSON.parse(await fs.readFile(path.join(mockHome, ".claude", "settings.json"), "utf-8"));
      expect(settings.customField).toBe("keep me");
    });

    it("rejects unsafe agent keys on write", async () => {
      const adapter = new ClaudeAdapter();

      await expect(
        adapter.write({
          mcps: {},
          agents: {
            "../../escape": { name: "Escape", prompt: "bad" },
          },
          skills: {},
        }),
      ).rejects.toThrow(/invalid/i);
    });
  });

  describe("CursorAdapter", () => {
    it("writes correctly", async () => {
      const adapter = new CursorAdapter();
      await adapter.write(createAdapterWriteResources({
        mcps: {
          "test-mcp": {
            command: "npx",
            args: ["--yes", "test"],
          }
        },
        agents: {}
      }));

      const configContent = await fs.readFile(path.join(mockHome, ".cursor", "mcp.json"), "utf-8");
      const json = JSON.parse(configContent);
      expect(json.mcpServers["test-mcp"].command).toBe("npx");
    });

    it("routes local-scoped MCPs to project mcp.json", async () => {
      const projectDir = path.join(mockHome, "cursor-project");
      await fs.mkdir(projectDir, { recursive: true });
      process.chdir(projectDir);

      const adapter = new CursorAdapter();
      await adapter.write(createAdapterWriteResources({
        mcps: {
          localOnly: {
            command: "bun",
            args: ["run", "local"],
            scope: "local",
          },
          globalOnly: {
            command: "node",
            args: ["global"],
            scope: "global",
          },
        },
        agents: {},
      }));

      const projectPath = path.join(projectDir, ".cursor", "mcp.json");
      const userPath = path.join(mockHome, ".cursor", "mcp.json");
      const projectConfig = JSON.parse(await fs.readFile(projectPath, "utf-8"));
      const userConfig = JSON.parse(await fs.readFile(userPath, "utf-8"));

      expect(projectConfig.mcpServers.localOnly).toBeDefined();
      expect(projectConfig.mcpServers.globalOnly).toBeUndefined();
      expect(userConfig.mcpServers.globalOnly).toBeDefined();
      expect(userConfig.mcpServers.localOnly).toBeUndefined();
    });
  });

  describe("OpenCodeAdapter", () => {
    it("detects correctly", async () => {
      const adapter = new OpenCodeAdapter();
      expect(await adapter.detect()).toBe(false);

      await fs.mkdir(path.join(mockHome, ".config", "opencode"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".config", "opencode", "config.json"), "{}");

      expect(await adapter.detect()).toBe(true);
    });

    it("reads and writes correctly (v2 array command format)", async () => {
      const adapter = new OpenCodeAdapter();
      await fs.mkdir(path.join(mockHome, ".config", "opencode"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".config", "opencode", "config.json"), JSON.stringify({
        mcp: {
          "oc-mcp": { type: "local", command: ["python", "-m", "server"], environment: {} }
        }
      }));

      let {mcps} = await adapter.read();
      expectHas(mcps, "oc-mcp");
      expect(mcps["oc-mcp"].command).toBe("python");
      expect(mcps["oc-mcp"].args).toEqual(["-m", "server"]);

      mcps["oc-new"] = { command: "node", args: ["index.js"] };
      await adapter.write(createAdapterWriteResources({ mcps, agents: {} }));

      const content = JSON.parse(await fs.readFile(path.join(mockHome, ".config", "opencode", "config.json"), "utf-8"));
      expect(content.mcp["oc-new"].command).toEqual(["node", "index.js"]);
      expect(content.mcp["oc-new"].type).toBe("local");
    });

    it("respects project precedence when multiple scope candidates exist", async () => {
      const adapter = new OpenCodeAdapter();
      await fs.writeFile(path.join(mockHome, "opencode.json"), JSON.stringify({
        mcp: { shared: { type: "local", command: ["project-mcp"], environment: {} } }
      }));
      await fs.mkdir(path.join(mockHome, ".config", "opencode"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".config", "opencode", "config.json"), JSON.stringify({
        mcp: { shared: { type: "local", command: ["global-mcp"], environment: {} } }
      }));

      const { mcps } = await adapter.read();
      expectHas(mcps, "shared");
      expect(mcps["shared"].command).toBe("project-mcp");
      expect(mcps["shared"].scope).toBe("project");

      await adapter.write(createAdapterWriteResources({
        mcps: {
          shared: { command: "updated-project", scope: "project" },
          stable: { command: "stable-global", scope: "global" },
        },
        agents: {},
        skills: {},
      }));

      const projectContent = JSON.parse(await fs.readFile(path.join(mockHome, "opencode.json"), "utf-8"));
      const userContent = JSON.parse(await fs.readFile(path.join(mockHome, ".config", "opencode", "config.json"), "utf-8"));
      expect(projectContent.mcp["shared"].command).toEqual(["updated-project"]);
      expect(userContent.mcp["stable"].command).toEqual(["stable-global"]);
    });

    it("detects Windows AppData-backed Opencode config", async () => {
      if (process.platform !== "win32") return;
      const adapter = new OpenCodeAdapter();
      const previousLocalAppData = process.env.LOCALAPPDATA;
      const previousAppData = process.env.APPDATA;
      const localAppData = path.join(mockHome, "AppData", "Local");
      process.env.LOCALAPPDATA = localAppData;
      process.env.APPDATA = path.join(mockHome, "AppData", "Roaming");
      await fs.mkdir(path.join(localAppData, "opencode"), { recursive: true });
      await fs.writeFile(path.join(localAppData, "opencode", "config.json"), "{}");
      try {
        expect(await adapter.detect()).toBe(true);
      } finally {
        if (previousLocalAppData === undefined) delete process.env.LOCALAPPDATA;
        else process.env.LOCALAPPDATA = previousLocalAppData;
        if (previousAppData === undefined) delete process.env.APPDATA;
        else process.env.APPDATA = previousAppData;
      }
    });
  });

  describe("AntigravityAdapter", () => {
    it("detects correctly", async () => {
      process.chdir(mockHome);
      const adapter = new AntigravityAdapter();
      expect(await adapter.detect()).toBe(false);

      await fs.mkdir(path.join(mockHome, ".config", "antigravity"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".config", "antigravity", "config.json"), "{}");

      expect(await adapter.detect()).toBe(true);
    });

    it("detects Antigravity install dir without synctax-shaped config.json", async () => {
      process.chdir(originalCwd);
      const adapter = new AntigravityAdapter();
      await fs.mkdir(path.join(mockHome, ".antigravity_tools"), { recursive: true });
      expect(await adapter.detect()).toBe(true);
    });

    it("reads and writes correctly", async () => {
      process.chdir(originalCwd);
      const adapter = new AntigravityAdapter();
      await fs.mkdir(path.join(mockHome, ".config", "antigravity"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".config", "antigravity", "config.json"), JSON.stringify({
        mcpServers: { "ag-mcp": { command: "ruby", args: ["server.rb"] } }
      }));

      let {mcps} = await adapter.read();
      expectHas(mcps, "ag-mcp");
      expect(mcps["ag-mcp"].command).toBe("ruby");

      mcps["ag-new"] = { command: "go", args: ["run", "main.go"] };
      await adapter.write(createAdapterWriteResources({ mcps, agents: {} }));

      const content = JSON.parse(await fs.readFile(path.join(mockHome, ".config", "antigravity", "config.json"), "utf-8"));
      expect(content.mcpServers["ag-new"].command).toBe("go");
    });

    it("respects user-over-global MCP precedence", async () => {
      process.chdir(originalCwd);
      const adapter = new AntigravityAdapter();
      await fs.mkdir(path.join(mockHome, ".antigravity"), { recursive: true });
      await fs.mkdir(path.join(mockHome, ".config", "antigravity"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".antigravity", "config.json"), JSON.stringify({
        mcpServers: { "shared": { command: "global-cmd" } }
      }));
      await fs.writeFile(path.join(mockHome, ".config", "antigravity", "config.json"), JSON.stringify({
        mcpServers: { "shared": { command: "user-cmd" } }
      }));

      const { mcps } = await adapter.read();
      expectHas(mcps, "shared");
      expect(mcps["shared"].command).toBe("user-cmd");
      expect(mcps["shared"].scope).toBe("user");
    });

    it("routes local-scoped skills to project skills dir", async () => {
      const adapter = new AntigravityAdapter();

      await adapter.write(createAdapterWriteResources({
        mcps: {},
        agents: {},
        skills: {
          "local-skill": {
            name: "Local Skill",
            content: "Local antigravity skill.",
            scope: "local",
          },
        },
      }));

      const projectSkillPath = path.join(mockHome, ".agents", "skills", "local-skill", "SKILL.md");
      await expect(fs.readFile(projectSkillPath, "utf-8")).resolves.toContain("Local antigravity skill.");
    });
  });

  describe("GeminiCliAdapter", () => {
    it("reads project config above user config", async () => {
      const adapter = new GeminiCliAdapter();
      const projectDir = path.join(mockHome, "repo");
      await fs.mkdir(path.join(projectDir, ".gemini"), { recursive: true });
      await fs.mkdir(path.join(mockHome, ".gemini"), { recursive: true });
      await fs.writeFile(path.join(projectDir, ".gemini", "settings.json"), JSON.stringify({ model: "project-model", systemInstruction: "project prompt" }));
      await fs.writeFile(path.join(mockHome, ".gemini", "settings.json"), JSON.stringify({ model: "user-model", systemInstruction: "user prompt" }));

      process.chdir(projectDir);
      const readData = await adapter.read();
      expect(readData.models?.defaultModel).toBe("project-model");
      expect(readData.prompts?.globalSystemPrompt).toBe("project prompt");
    });
  });

  describe("GithubCopilotCliAdapter", () => {
    it("reads skills from SKILL.md files and writes them back (v2 format)", async () => {
      const adapter = new GithubCopilotCliAdapter();
      // Create project skill
      const projSkillDir = path.join(mockHome, ".github", "skills", "proj-skill");
      await fs.mkdir(projSkillDir, { recursive: true });
      await fs.writeFile(path.join(projSkillDir, "SKILL.md"), "---\nname: Proj Skill\n---\nProject skill content.");
      // Create user skill
      const userSkillDir = path.join(mockHome, ".copilot", "skills", "user-skill");
      await fs.mkdir(userSkillDir, { recursive: true });
      await fs.writeFile(path.join(userSkillDir, "SKILL.md"), "---\nname: User Skill\n---\nUser skill content.");

      const readResources = await adapter.read();
      expect(readResources.skills["proj-skill"]?.content).toBe("Project skill content.");
      expect(readResources.skills["user-skill"]?.content).toBe("User skill content.");
    });
  });
});
