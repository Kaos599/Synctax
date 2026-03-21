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

describe("Adapters", () => {
  let mockHome: string;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-adapter-test-"));
    process.env.SYNCTAX_HOME = mockHome;
  });

  afterEach(async () => {
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  describe("ClaudeAdapter", () => {
    it("parses multiple file extensions for agents and skills", async () => {
      const adapter = new ClaudeAdapter();
      await fs.mkdir(path.join(mockHome, ".claude", "agents"), { recursive: true });
      await fs.mkdir(path.join(mockHome, ".claude", "skills"), { recursive: true });

      // Create dummy agent files with different extensions
      await fs.writeFile(path.join(mockHome, ".claude", "agents", "agent1.md"), "---\nname: Agent 1\n---\nPrompt 1");
      await fs.writeFile(path.join(mockHome, ".claude", "agents", "agent2.agent"), "---\nname: Agent 2\n---\nPrompt 2");
      await fs.writeFile(path.join(mockHome, ".claude", "agents", "agent3.agents"), "---\nname: Agent 3\n---\nPrompt 3");
      await fs.writeFile(path.join(mockHome, ".claude", "agents", "agent4.claude"), "---\nname: Agent 4\n---\nPrompt 4");

      // Create dummy skill files with different extensions
      await fs.writeFile(path.join(mockHome, ".claude", "skills", "skill1.md"), "---\nname: Skill 1\n---\nContent 1");
      await fs.writeFile(path.join(mockHome, ".claude", "skills", "skill2.agent"), "---\nname: Skill 2\n---\nContent 2");
      await fs.writeFile(path.join(mockHome, ".claude", "skills", "skill3.agents"), "---\nname: Skill 3\n---\nContent 3");
      await fs.writeFile(path.join(mockHome, ".claude", "skills", "skill4.claude"), "---\nname: Skill 4\n---\nContent 4");

      // Write settings.json to prevent reading error
      await fs.writeFile(path.join(mockHome, ".claude", "settings.json"), JSON.stringify({}));

      const { agents, skills } = await adapter.read();

      expect(Object.keys(agents).length).toBe(4);
      expect(agents["agent1"].prompt).toBe("Prompt 1");
      expect(agents["agent2"].prompt).toBe("Prompt 2");
      expect(agents["agent3"].prompt).toBe("Prompt 3");
      expect(agents["agent4"].prompt).toBe("Prompt 4");

      expect(Object.keys(skills).length).toBe(4);
      expect(skills["skill1"].content).toBe("Content 1");
      expect(skills["skill2"].content).toBe("Content 2");
      expect(skills["skill3"].content).toBe("Content 3");
      expect(skills["skill4"].content).toBe("Content 4");
    });

    it("detects correctly", async () => {
      const adapter = new ClaudeAdapter();
      expect(await adapter.detect()).toBe(false);

      await fs.mkdir(path.join(mockHome, ".claude"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".claude", "settings.json"), "{}");

      expect(await adapter.detect()).toBe(true);
    });

    it("reads and writes correctly", async () => {
      const adapter = new ClaudeAdapter();

      await fs.mkdir(path.join(mockHome, ".claude"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".claude", "settings.json"), JSON.stringify({
        mcpServers: {
          "existing-mcp": {
             command: "test"
          }
        }
      }));

      let {mcps} = await adapter.read();
      expect(mcps["existing-mcp"].command).toBe("test");

      mcps["new-mcp"] = {
          command: "bun",
          args: ["run", "index.ts"]
      };

      await adapter.write({ mcps, agents: {} });

      ({mcps} = await adapter.read());
      expect(mcps["new-mcp"].command).toBe("bun");
    });
  });

  describe("CursorAdapter", () => {
    it("writes correctly", async () => {
      const adapter = new CursorAdapter();
      await adapter.write({
        mcps: {
          "test-mcp": {
            command: "npx",
            args: ["--yes", "test"],
          }
        },
        agents: {}
      });

      const configContent = await fs.readFile(path.join(mockHome, ".cursor", "mcp.json"), "utf-8");
      const json = JSON.parse(configContent);
      expect(json.mcpServers["test-mcp"].command).toBe("npx");
    });
  });

  describe("OpenCodeAdapter", () => {
    it("detects correctly", async () => {
      const originalCwd = process.cwd;
      process.cwd = () => mockHome;

      const adapter = new OpenCodeAdapter();
      expect(await adapter.detect()).toBe(false);

      await fs.mkdir(path.join(mockHome, ".config", "opencode"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".config", "opencode", "config.json"), "{}");

      expect(await adapter.detect()).toBe(true);
      
      process.cwd = originalCwd;
    });

    it("reads and writes correctly", async () => {
      const adapter = new OpenCodeAdapter();
      await fs.mkdir(path.join(mockHome, ".config", "opencode"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".config", "opencode", "config.json"), JSON.stringify({
        mcp: {
          "oc-mcp": { command: "python", args: ["-m", "server"] }
        }
      }));

      let {mcps} = await adapter.read();
      expect(mcps["oc-mcp"].command).toBe("python");

      mcps["oc-new"] = { command: "node", args: ["index.js"] };
      await adapter.write({ mcps, agents: {} });

      const content = JSON.parse(await fs.readFile(path.join(mockHome, ".config", "opencode", "config.json"), "utf-8"));
      expect(content.mcp["oc-new"].command).toBe("node");
    });

    it("respects project precedence when multiple scope candidates exist", async () => {
      const adapter = new OpenCodeAdapter();
      const cwd = process.cwd();
      process.chdir(mockHome);
      try {
        await fs.writeFile(path.join(mockHome, "opencode.json"), JSON.stringify({
          mcp: {
            shared: { command: "project-mcp" },
          }
        }));
        await fs.mkdir(path.join(mockHome, ".config", "opencode"), { recursive: true });
        await fs.writeFile(path.join(mockHome, ".config", "opencode", "config.json"), JSON.stringify({
          mcp: {
            shared: { command: "global-mcp" },
          }
        }));

        const { mcps } = await adapter.read();
        expect(mcps["shared"].command).toBe("project-mcp");
        expect(mcps["shared"].scope).toBe("project");

        await adapter.write({
          mcps: {
            shared: { command: "updated-project", scope: "project" } as any,
            stable: { command: "stable-global", scope: "global" } as any,
          },
          agents: {},
          skills: {},
        });

        const projectContent = JSON.parse(await fs.readFile(path.join(mockHome, "opencode.json"), "utf-8"));
        const userContent = JSON.parse(await fs.readFile(path.join(mockHome, ".config", "opencode", "config.json"), "utf-8"));
        expect(projectContent.mcp["shared"].command).toBe("updated-project");
        expect(userContent.mcp["stable"].command).toBe("stable-global");
      } finally {
        process.chdir(cwd);
      }
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
      const adapter = new AntigravityAdapter();
      expect(await adapter.detect()).toBe(false);

      await fs.mkdir(path.join(mockHome, ".config", "antigravity"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".config", "antigravity", "config.json"), "{}");

      expect(await adapter.detect()).toBe(true);
    });

    it("detects Antigravity install dir without synctax-shaped config.json", async () => {
      const adapter = new AntigravityAdapter();
      await fs.mkdir(path.join(mockHome, ".antigravity_tools"), { recursive: true });
      expect(await adapter.detect()).toBe(true);
    });

    it("reads and writes correctly", async () => {
      const adapter = new AntigravityAdapter();
      await fs.mkdir(path.join(mockHome, ".config", "antigravity"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".config", "antigravity", "config.json"), JSON.stringify({
        mcpServers: {
          "ag-mcp": { command: "ruby", args: ["server.rb"] }
        }
      }));

      let {mcps} = await adapter.read();
      expect(mcps["ag-mcp"].command).toBe("ruby");

      mcps["ag-new"] = { command: "go", args: ["run", "main.go"] };
      await adapter.write({ mcps, agents: {} });

      const content = JSON.parse(await fs.readFile(path.join(mockHome, ".config", "antigravity", "config.json"), "utf-8"));
      expect(content.mcpServers["ag-new"].command).toBe("go");
    });

    it("respects user-over-global MCP precedence", async () => {
      const adapter = new AntigravityAdapter();
      await fs.mkdir(path.join(mockHome, ".antigravity"), { recursive: true });
      await fs.mkdir(path.join(mockHome, ".config", "antigravity"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".antigravity", "config.json"), JSON.stringify({
        mcpServers: {
          "shared": { command: "global-cmd" }
        }
      }));
      await fs.writeFile(path.join(mockHome, ".config", "antigravity", "config.json"), JSON.stringify({
        mcpServers: {
          "shared": { command: "user-cmd" }
        }
      }));

      const { mcps } = await adapter.read();
      expect(mcps["shared"].command).toBe("user-cmd");
      expect(mcps["shared"].scope).toBe("user");
    });
  });

  describe("GeminiCliAdapter", () => {
    it("reads project config above user config", async () => {
      const adapter = new GeminiCliAdapter();
      const projectDir = path.join(mockHome, "repo");
      const cwd = process.cwd();
      await fs.mkdir(path.join(projectDir, ".gemini"), { recursive: true });
      await fs.mkdir(path.join(mockHome, ".gemini"), { recursive: true });
      const projectPath = path.join(projectDir, ".gemini", "settings.json");
      const userPath = path.join(mockHome, ".gemini", "settings.json");
      await fs.writeFile(projectPath, JSON.stringify({ model: "project-model", systemInstruction: "project prompt" }));
      await fs.writeFile(userPath, JSON.stringify({ model: "user-model", systemInstruction: "user prompt" }));

      process.chdir(projectDir);
      try {
        const readData = await adapter.read();
        expect(readData.models?.defaultModel).toBe("project-model");
        expect(readData.prompts?.globalSystemPrompt).toBe("project prompt");
      } finally {
        process.chdir(cwd);
      }
    });
  });

  describe("GithubCopilotCliAdapter", () => {
    it("reads scoped aliases and writes project/user files separately", async () => {
      const adapter = new GithubCopilotCliAdapter();
      const cwd = process.cwd();
      process.chdir(mockHome);
      try {
        const projectPath = path.join(mockHome, ".github", "copilot", "config.json");
        const userPath = path.join(mockHome, ".config", "github-copilot-cli", "config.json");
        await fs.mkdir(path.dirname(projectPath), { recursive: true });
        await fs.mkdir(path.dirname(userPath), { recursive: true });

        await fs.writeFile(projectPath, JSON.stringify({ aliases: { shared: "project-initial", onlyProject: "only-project" } }));
        await fs.writeFile(userPath, JSON.stringify({ aliases: { shared: "user-initial", onlyUser: "only-user" } }));

        const readResources = await adapter.read();
        expect(readResources.skills["shared"].content).toBe("project-initial");
        expect(readResources.skills["onlyProject"].content).toBe("only-project");
        expect(readResources.skills["onlyUser"].content).toBe("only-user");

        await adapter.write({
          mcps: {},
          agents: {},
          skills: {
            shared: { name: "shared", content: "project-write", scope: "project" } as any,
            userOnly: { name: "userOnly", content: "user-write", scope: "user" } as any,
          },
        });

        const updatedProject = JSON.parse(await fs.readFile(projectPath, "utf-8"));
        const updatedUser = JSON.parse(await fs.readFile(userPath, "utf-8"));
        expect(updatedProject.aliases["shared"]).toBe("project-write");
        expect(updatedProject.aliases["onlyProject"]).toBe("only-project");
        expect(updatedUser.aliases["userOnly"]).toBe("user-write");
        expect(updatedUser.aliases["onlyUser"]).toBe("only-user");
      } finally {
        process.chdir(cwd);
      }
    });
  });
});
