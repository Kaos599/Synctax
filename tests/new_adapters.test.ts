import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ClineAdapter } from "../src/adapters/cline.js";
import { ZedAdapter } from "../src/adapters/zed.js";
import { GithubCopilotAdapter } from "../src/adapters/github-copilot.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("New Adapters (Cline, Zed, Github Copilot)", () => {
  let mockHome: string;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-new-adapters-test-"));
    process.env.SYNCTAX_HOME = mockHome;
  });

  afterEach(async () => {
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  it("ClineAdapter handles mcp_settings.json", async () => {
    const adapter = new ClineAdapter();
    await adapter.write({
      mcps: { "cline-mcp": { command: "node" } },
      agents: {}, skills: {}
    });

    const parsed = JSON.parse(await fs.readFile(path.join(mockHome, ".cline", "mcp_settings.json"), "utf-8"));
    expect(parsed.mcpServers["cline-mcp"].command).toBe("node");
  });

  it("ClineAdapter resolves user over global MCP precedence", async () => {
    const adapter = new ClineAdapter();
    const globalPath = path.join(mockHome, ".cline", "mcp_settings.json");
    const userPath = path.join(mockHome, ".cline", "data", "settings", "cline_mcp_settings.json");
    await fs.mkdir(path.dirname(globalPath), { recursive: true });
    await fs.mkdir(path.dirname(userPath), { recursive: true });
    await fs.writeFile(globalPath, JSON.stringify({ mcpServers: { shared: { command: "global-cmd" } } }));
    await fs.writeFile(userPath, JSON.stringify({ mcpServers: { shared: { command: "user-cmd" } } }));

    const { mcps } = await adapter.read();
    expect(mcps["shared"].command).toBe("user-cmd");
    expect(mcps["shared"].scope).toBe("user");
  });

  it("ZedAdapter handles context_servers", async () => {
    const adapter = new ZedAdapter();
    await adapter.write({
      mcps: { "zed-mcp": { command: "bun" } },
      agents: {}, skills: {}
    });

    const parsed = JSON.parse(await fs.readFile(path.join(mockHome, ".config", "zed", "settings.json"), "utf-8"));
    expect(parsed.context_servers["zed-mcp"].command).toBe("bun");
  });

  it("GithubCopilotAdapter handles mcp.servers in vscode settings", async () => {
    const adapter = new GithubCopilotAdapter();
    const cwd = process.cwd();
    process.chdir(mockHome);
    await adapter.write({
      mcps: { "copilot-mcp": { command: "python" } },
      agents: {}, skills: {}
    });
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(mockHome, ".vscode", "settings.json"), "utf-8"));
      expect(parsed["mcp.servers"]["copilot-mcp"].command).toBe("python");
    } finally {
      process.chdir(cwd);
    }
  });

  it("GithubCopilotAdapter detects when only .vscode/mcp.json exists", async () => {
    const adapter = new GithubCopilotAdapter();
    const mcpPath = path.join(mockHome, ".vscode", "mcp.json");
    await fs.mkdir(path.dirname(mcpPath), { recursive: true });
    await fs.writeFile(mcpPath, '{"servers":{}}');
    expect(await adapter.detect()).toBe(true);
  });

  it("GithubCopilotAdapter detects Code User settings under APPDATA on Windows", async () => {
    if (process.platform !== "win32") return;
    const prev = process.env.APPDATA;
    try {
      const adapter = new GithubCopilotAdapter();
      const roaming = path.join(mockHome, "AppData", "Roaming");
      process.env.APPDATA = roaming;
      const userSettings = path.join(roaming, "Code", "User", "settings.json");
      await fs.mkdir(path.dirname(userSettings), { recursive: true });
      await fs.writeFile(userSettings, "{}");
      expect(await adapter.detect()).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.APPDATA;
      else process.env.APPDATA = prev;
    }
  });

  it("GithubCopilotAdapter detects Code User mcp.json under APPDATA on Windows", async () => {
    if (process.platform !== "win32") return;
    const prev = process.env.APPDATA;
    try {
      const adapter = new GithubCopilotAdapter();
      const roaming = path.join(mockHome, "AppData", "Roaming");
      process.env.APPDATA = roaming;
      const mcpPath = path.join(roaming, "Code", "User", "mcp.json");
      await fs.mkdir(path.dirname(mcpPath), { recursive: true });
      await fs.writeFile(mcpPath, '{"servers":{}}');
      expect(await adapter.detect()).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.APPDATA;
      else process.env.APPDATA = prev;
    }
  });
});
