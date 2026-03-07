import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ClaudeAdapter } from "../src/adapters/claude.js";
import { CursorAdapter } from "../src/adapters/cursor.js";
import { OpenCodeAdapter } from "../src/adapters/opencode.js";
import { AntigravityAdapter } from "../src/adapters/antigravity.js";
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
      const adapter = new OpenCodeAdapter();
      expect(await adapter.detect()).toBe(false);

      await fs.mkdir(path.join(mockHome, ".config", "opencode"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".config", "opencode", "config.json"), "{}");

      expect(await adapter.detect()).toBe(true);
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
  });

  describe("AntigravityAdapter", () => {
    it("detects correctly", async () => {
      const adapter = new AntigravityAdapter();
      expect(await adapter.detect()).toBe(false);

      await fs.mkdir(path.join(mockHome, ".config", "antigravity"), { recursive: true });
      await fs.writeFile(path.join(mockHome, ".config", "antigravity", "config.json"), "{}");

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
  });
});
