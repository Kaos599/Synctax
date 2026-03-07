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
    await adapter.write({
      mcps: { "copilot-mcp": { command: "python" } },
      agents: {}, skills: {}
    });

    const parsed = JSON.parse(await fs.readFile(path.join(mockHome, ".vscode", "settings.json"), "utf-8"));
    expect(parsed["mcp.servers"]["copilot-mcp"].command).toBe("python");
  });
});
