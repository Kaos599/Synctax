import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ClaudeAdapter } from "../src/adapters/claude.js";
import { CursorAdapter } from "../src/adapters/cursor.js";
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

  it("Claude adapter detects correctly", async () => {
    const adapter = new ClaudeAdapter();
    expect(await adapter.detect()).toBe(false);

    await fs.mkdir(path.join(mockHome, ".claude"), { recursive: true });
    await fs.writeFile(path.join(mockHome, ".claude", "settings.json"), "{}");

    expect(await adapter.detect()).toBe(true);
  });

  it("Cursor adapter writes correctly", async () => {
    const adapter = new CursorAdapter();
    await adapter.write({
      "test-mcp": {
        command: "npx",
        args: ["--yes", "test"],
      },
    });

    const configContent = await fs.readFile(path.join(mockHome, ".cursor", "mcp.json"), "utf-8");
    const json = JSON.parse(configContent);
    expect(json.mcpServers["test-mcp"].command).toBe("npx");
  });

  it("Claude adapter reads and writes correctly", async () => {
    const adapter = new ClaudeAdapter();

    await fs.mkdir(path.join(mockHome, ".claude"), { recursive: true });
    await fs.writeFile(path.join(mockHome, ".claude", "settings.json"), JSON.stringify({
      mcpServers: {
        "existing-mcp": {
           command: "test"
        }
      }
    }));

    let mcps = await adapter.read();
    expect(mcps["existing-mcp"].command).toBe("test");

    mcps["new-mcp"] = {
        command: "bun",
        args: ["run", "index.ts"]
    };

    await adapter.write(mcps);

    mcps = await adapter.read();
    expect(mcps["new-mcp"].command).toBe("bun");
  });
});
