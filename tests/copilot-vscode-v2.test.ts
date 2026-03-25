import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GithubCopilotAdapter } from "../src/adapters/github-copilot.js";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { expectHas } from "./test-helpers.js";

describe("GithubCopilotAdapter v2", () => {
  let mockHome: string;
  let originalCwd: string;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-copilot-vscode-v2-"));
    process.env.SYNCTAX_HOME = mockHome;
    originalCwd = process.cwd();
    process.chdir(mockHome);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  describe("remote MCP support", () => {
    it("reads remote MCPs from settings.json (url-based)", async () => {
      const adapter = new GithubCopilotAdapter();
      await fs.mkdir(path.join(mockHome, ".vscode"), { recursive: true });
      await fs.writeFile(
        path.join(mockHome, ".vscode", "settings.json"),
        JSON.stringify({
          "mcp.servers": {
            "remote-api": {
              url: "https://api.example.com/mcp",
              type: "http",
              requestInit: { headers: { Authorization: "Bearer token123" } },
            },
          },
        })
      );

      const { mcps } = await adapter.read();
      expectHas(mcps, "remote-api");
      expect(mcps["remote-api"]).toBeDefined();
      expect(mcps["remote-api"].url).toBe("https://api.example.com/mcp");
      expect(mcps["remote-api"].transport).toBe("http");
      expect(mcps["remote-api"].headers?.Authorization).toBe("Bearer token123");
      expect(mcps["remote-api"].command).toBe("");
    });

    it("reads remote MCPs from mcp.json (url-based)", async () => {
      const adapter = new GithubCopilotAdapter();
      await fs.mkdir(path.join(mockHome, ".vscode"), { recursive: true });
      await fs.writeFile(
        path.join(mockHome, ".vscode", "mcp.json"),
        JSON.stringify({
          servers: {
            "remote-sse": {
              url: "https://sse.example.com/events",
              type: "sse",
            },
          },
        })
      );

      const { mcps } = await adapter.read();
      expectHas(mcps, "remote-sse");
      expect(mcps["remote-sse"]).toBeDefined();
      expect(mcps["remote-sse"].url).toBe("https://sse.example.com/events");
      expect(mcps["remote-sse"].transport).toBe("sse");
    });

    it("reads remote MCPs with direct headers field (no requestInit wrapper)", async () => {
      const adapter = new GithubCopilotAdapter();
      await fs.mkdir(path.join(mockHome, ".vscode"), { recursive: true });
      await fs.writeFile(
        path.join(mockHome, ".vscode", "settings.json"),
        JSON.stringify({
          "mcp.servers": {
            "direct-headers": {
              url: "https://api.example.com",
              type: "http",
              headers: { "X-API-Key": "key123" },
            },
          },
        })
      );

      const { mcps } = await adapter.read();
      expectHas(mcps, "direct-headers");
      expect(mcps["direct-headers"].headers?.["X-API-Key"]).toBe("key123");
    });

    it("defaults transport to http when url is present and type is missing", async () => {
      const adapter = new GithubCopilotAdapter();
      await fs.mkdir(path.join(mockHome, ".vscode"), { recursive: true });
      await fs.writeFile(
        path.join(mockHome, ".vscode", "mcp.json"),
        JSON.stringify({
          servers: {
            "no-type": { url: "https://example.com/mcp" },
          },
        })
      );

      const { mcps } = await adapter.read();
      expectHas(mcps, "no-type");
      expect(mcps["no-type"].transport).toBe("http");
    });

    it("writes remote MCPs to mcp.json with requestInit wrapper", async () => {
      const adapter = new GithubCopilotAdapter();
      await adapter.write({
        mcps: {
          "remote-mcp": {
            command: "",
            url: "https://api.example.com/mcp",
            transport: "http",
            headers: { Authorization: "Bearer abc" },
          },
        },
        agents: {},
        skills: {},
      });

      // Written to the write target — should be settings.json or mcp.json
      // Since no existing file, defaults to .vscode/settings.json
      const settingsPath = path.join(mockHome, ".vscode", "settings.json");
      const data = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
      const server = data["mcp.servers"]?.["remote-mcp"];
      expect(server).toBeDefined();
      expect(server.url).toBe("https://api.example.com/mcp");
      expect(server.type).toBe("http");
      expect(server.requestInit.headers.Authorization).toBe("Bearer abc");
      // Should NOT have stdio fields
      expect(server.command).toBeUndefined();
    });

    it("writes remote MCPs without requestInit when no headers", async () => {
      const adapter = new GithubCopilotAdapter();
      await adapter.write({
        mcps: {
          "simple-remote": {
            command: "",
            url: "https://api.example.com/mcp",
            transport: "sse",
          },
        },
        agents: {},
        skills: {},
      });

      const settingsPath = path.join(mockHome, ".vscode", "settings.json");
      const data = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
      const server = data["mcp.servers"]?.["simple-remote"];
      expect(server.url).toBe("https://api.example.com/mcp");
      expect(server.type).toBe("sse");
      expect(server.requestInit).toBeUndefined();
    });

    it("writes stdio MCPs alongside remote MCPs", async () => {
      const adapter = new GithubCopilotAdapter();
      await adapter.write({
        mcps: {
          "stdio-mcp": { command: "npx", args: ["-y", "server"] },
          "remote-mcp": { command: "", url: "https://api.example.com/mcp", transport: "http" },
        },
        agents: {},
        skills: {},
      });

      const settingsPath = path.join(mockHome, ".vscode", "settings.json");
      const data = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
      const servers = data["mcp.servers"];
      expect(servers["stdio-mcp"].command).toBe("npx");
      expect(servers["stdio-mcp"].type).toBe("stdio");
      expect(servers["remote-mcp"].url).toBe("https://api.example.com/mcp");
    });

    it("round-trips remote MCPs through write to mcp.json then read", async () => {
      const adapter = new GithubCopilotAdapter();
      // Create both settings.json (for non-project write target) and mcp.json (for project write)
      await fs.mkdir(path.join(mockHome, ".vscode"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".vscode", "settings.json"), "{}");
      await fs.writeFile(path.join(mockHome, ".vscode", "mcp.json"), "{}");

      await adapter.write({
        mcps: {
          "roundtrip": {
            command: "",
            url: "https://roundtrip.example.com",
            transport: "http",
            headers: { "X-Key": "val" },
            scope: "project",
          },
        },
        agents: {},
        skills: {},
      });

      const { mcps } = await adapter.read();
      expectHas(mcps, "roundtrip");
      expect(mcps.roundtrip).toBeDefined();
      expect(mcps.roundtrip.url).toBe("https://roundtrip.example.com");
      expect(mcps.roundtrip.transport).toBe("http");
      expect(mcps.roundtrip.headers?.["X-Key"]).toBe("val");
    });
  });

  describe("agent file support", () => {
    it("reads agents from .github/agents/*.md", async () => {
      const adapter = new GithubCopilotAdapter();
      const agentsDir = path.join(mockHome, ".github", "agents");
      await fs.mkdir(agentsDir, { recursive: true });

      await fs.writeFile(
        path.join(agentsDir, "reviewer.md"),
        `---
name: Code Reviewer
description: Reviews pull requests
model: gpt-4
tools:
  - Read
  - Grep
user-invocable: true
mcp-servers:
  - github
---

You are a code review agent.`
      );

      const { agents } = await adapter.read();
      expectHas(agents, "reviewer");
      expect(agents.reviewer).toBeDefined();
      expect(agents.reviewer.name).toBe("Code Reviewer");
      expect(agents.reviewer.description).toBe("Reviews pull requests");
      expect(agents.reviewer.model).toBe("gpt-4");
      expect(agents.reviewer.tools).toEqual(["Read", "Grep"]);
      expect(agents.reviewer.userInvocable).toBe(true);
      expect(agents.reviewer.mcpServers).toEqual(["github"]);
      expect(agents.reviewer.prompt).toBe("You are a code review agent.");
      expect(agents.reviewer.scope).toBe("project");
    });

    it("reads agents without frontmatter (plain markdown)", async () => {
      const adapter = new GithubCopilotAdapter();
      const agentsDir = path.join(mockHome, ".github", "agents");
      await fs.mkdir(agentsDir, { recursive: true });

      await fs.writeFile(
        path.join(agentsDir, "simple.md"),
        "You are a simple agent."
      );

      const { agents } = await adapter.read();
      expectHas(agents, "simple");
      expect(agents.simple).toBeDefined();
      expect(agents.simple.name).toBe("simple");
      expect(agents.simple.prompt).toBe("You are a simple agent.");
    });

    it("reads multiple agents from directory", async () => {
      const adapter = new GithubCopilotAdapter();
      const agentsDir = path.join(mockHome, ".github", "agents");
      await fs.mkdir(agentsDir, { recursive: true });

      await fs.writeFile(path.join(agentsDir, "alpha.md"), "---\nname: Alpha\n---\nAlpha agent.");
      await fs.writeFile(path.join(agentsDir, "beta.md"), "---\nname: Beta\n---\nBeta agent.");

      const { agents } = await adapter.read();
      expect(Object.keys(agents)).toHaveLength(2);
      expectHas(agents, "alpha");
      expectHas(agents, "beta");
      expect(agents.alpha.name).toBe("Alpha");
      expect(agents.beta.name).toBe("Beta");
    });

    it("ignores non-md files in agents directory", async () => {
      const adapter = new GithubCopilotAdapter();
      const agentsDir = path.join(mockHome, ".github", "agents");
      await fs.mkdir(agentsDir, { recursive: true });

      await fs.writeFile(path.join(agentsDir, "agent.md"), "---\nname: Agent\n---\nAn agent.");
      await fs.writeFile(path.join(agentsDir, "notes.txt"), "Not an agent.");
      await fs.writeFile(path.join(agentsDir, "config.json"), "{}");

      const { agents } = await adapter.read();
      expect(Object.keys(agents)).toHaveLength(1);
      expect(agents.agent).toBeDefined();
    });

    it("returns empty agents when .github/agents/ does not exist", async () => {
      const adapter = new GithubCopilotAdapter();
      const { agents } = await adapter.read();
      expect(Object.keys(agents)).toHaveLength(0);
    });
  });

  describe("skill file support", () => {
    it("reads skills from .github/skills/<name>/SKILL.md", async () => {
      const adapter = new GithubCopilotAdapter();
      const skillDir = path.join(mockHome, ".github", "skills", "deploy");
      await fs.mkdir(skillDir, { recursive: true });

      await fs.writeFile(
        path.join(skillDir, "SKILL.md"),
        `---
name: Deploy
description: Deploy to production
user-invocable: true
allowed-tools:
  - Bash
  - Read
---

Run the deployment pipeline.`
      );

      const { skills } = await adapter.read();
      expectHas(skills, "deploy");
      expect(skills.deploy).toBeDefined();
      expect(skills.deploy.name).toBe("Deploy");
      expect(skills.deploy.description).toBe("Deploy to production");
      expect(skills.deploy.userInvocable).toBe(true);
      expect(skills.deploy.allowedTools).toEqual(["Bash", "Read"]);
      expect(skills.deploy.content).toBe("Run the deployment pipeline.");
      expect(skills.deploy.scope).toBe("project");
    });

    it("reads multiple skills from directory", async () => {
      const adapter = new GithubCopilotAdapter();

      const skill1 = path.join(mockHome, ".github", "skills", "lint");
      const skill2 = path.join(mockHome, ".github", "skills", "test");
      await fs.mkdir(skill1, { recursive: true });
      await fs.mkdir(skill2, { recursive: true });

      await fs.writeFile(path.join(skill1, "SKILL.md"), "---\nname: Lint\n---\nLint the code.");
      await fs.writeFile(path.join(skill2, "SKILL.md"), "---\nname: Test\n---\nRun tests.");

      const { skills } = await adapter.read();
      expect(Object.keys(skills)).toHaveLength(2);
      expectHas(skills, "lint");
      expectHas(skills, "test");
      expect(skills.lint.content).toBe("Lint the code.");
      expect(skills.test.content).toBe("Run tests.");
    });

    it("reads extended frontmatter fields from SKILL.md", async () => {
      const adapter = new GithubCopilotAdapter();
      const skillDir = path.join(mockHome, ".github", "skills", "complex");
      await fs.mkdir(skillDir, { recursive: true });

      await fs.writeFile(
        path.join(skillDir, "SKILL.md"),
        `---
name: Complex
description: A complex skill
trigger: /complex
argument-hint: <path>
disable-model-invocation: true
model: gpt-4
effort: high
---

Do something complex.`
      );

      const { skills } = await adapter.read();
      expectHas(skills, "complex");
      const skill = skills.complex;
      expect(skill.argumentHint).toBe("<path>");
      expect(skill.disableModelInvocation).toBe(true);
      expect(skill.model).toBe("gpt-4");
      expect(skill.effort).toBe("high");
    });

    it("ignores directories without SKILL.md", async () => {
      const adapter = new GithubCopilotAdapter();
      const skillDir = path.join(mockHome, ".github", "skills", "empty");
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(path.join(skillDir, "README.md"), "Not a skill.");

      const { skills } = await adapter.read();
      expect(skills.empty).toBeUndefined();
    });

    it("ignores non-directory entries in skills dir", async () => {
      const adapter = new GithubCopilotAdapter();
      const skillsDir = path.join(mockHome, ".github", "skills");
      await fs.mkdir(skillsDir, { recursive: true });
      await fs.writeFile(path.join(skillsDir, "stray.txt"), "not a skill");

      const validSkillDir = path.join(skillsDir, "valid");
      await fs.mkdir(validSkillDir, { recursive: true });
      await fs.writeFile(path.join(validSkillDir, "SKILL.md"), "---\nname: Valid\n---\nValid skill.");

      const { skills } = await adapter.read();
      expectHas(skills, "valid");
      expect(skills.valid).toBeDefined();
      expect(skills["stray.txt"]).toBeUndefined();
    });

    it("returns empty skills when .github/skills/ does not exist", async () => {
      const adapter = new GithubCopilotAdapter();
      const { skills } = await adapter.read();
      expect(Object.keys(skills)).toHaveLength(0);
    });
  });

  describe("stdio MCP read/write (existing behavior preserved)", () => {
    it("reads stdio MCPs from settings.json", async () => {
      const adapter = new GithubCopilotAdapter();
      await fs.mkdir(path.join(mockHome, ".vscode"), { recursive: true });
      await fs.writeFile(
        path.join(mockHome, ".vscode", "settings.json"),
        JSON.stringify({
          "mcp.servers": {
            "my-mcp": { command: "npx", args: ["-y", "server"], env: { FOO: "bar" } },
          },
        })
      );

      const { mcps } = await adapter.read();
      expectHas(mcps, "my-mcp");
      expect(mcps["my-mcp"]).toBeDefined();
      expect(mcps["my-mcp"].command).toBe("npx");
      expect(mcps["my-mcp"].args).toEqual(["-y", "server"]);
      expect(mcps["my-mcp"].env?.FOO).toBe("bar");
    });

    it("reads stdio MCPs from mcp.json", async () => {
      const adapter = new GithubCopilotAdapter();
      await fs.mkdir(path.join(mockHome, ".vscode"), { recursive: true });
      await fs.writeFile(
        path.join(mockHome, ".vscode", "mcp.json"),
        JSON.stringify({
          servers: {
            "mcp-server": { command: "node", args: ["index.js"] },
          },
        })
      );

      const { mcps } = await adapter.read();
      expectHas(mcps, "mcp-server");
      expect(mcps["mcp-server"]).toBeDefined();
      expect(mcps["mcp-server"].command).toBe("node");
    });

    it("writes stdio MCPs to settings.json with correct format", async () => {
      const adapter = new GithubCopilotAdapter();
      await adapter.write({
        mcps: { "test-mcp": { command: "python", args: ["-m", "server"] } },
        agents: {},
        skills: {},
      });

      const data = JSON.parse(
        await fs.readFile(path.join(mockHome, ".vscode", "settings.json"), "utf-8")
      );
      const server = data["mcp.servers"]["test-mcp"];
      expect(server.command).toBe("python");
      expect(server.type).toBe("stdio");
    });
  });

  describe("memory", () => {
    it("reads and writes .github/copilot-instructions.md", async () => {
      const adapter = new GithubCopilotAdapter();
      expect(adapter.getMemoryFileName()).toBe(".github/copilot-instructions.md");

      await adapter.writeMemory(mockHome, "Be helpful.");
      const content = await adapter.readMemory(mockHome);
      expect(content).toBe("Be helpful.");
    });
  });

  describe("detect", () => {
    it("detects when .vscode/settings.json exists", async () => {
      const adapter = new GithubCopilotAdapter();
      await fs.mkdir(path.join(mockHome, ".vscode"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".vscode", "settings.json"), "{}");
      expect(await adapter.detect()).toBe(true);
    });

    it("detects when .vscode/mcp.json exists", async () => {
      const adapter = new GithubCopilotAdapter();
      await fs.mkdir(path.join(mockHome, ".vscode"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".vscode", "mcp.json"), '{"servers":{}}');
      expect(await adapter.detect()).toBe(true);
    });

    it("returns false when no config exists", async () => {
      const adapter = new GithubCopilotAdapter();
      expect(await adapter.detect()).toBe(false);
    });
  });
});
