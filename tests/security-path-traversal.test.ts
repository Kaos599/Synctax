import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CursorAdapter } from "../src/adapters/cursor.js";
import { ClaudeAdapter } from "../src/adapters/claude.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("Security: Path Traversal", () => {
  let tempDir: string;
  let homeDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-sec-"));
    homeDir = path.join(tempDir, "home");
    await fs.mkdir(homeDir, { recursive: true });
    process.env.SYNCTAX_HOME = homeDir;
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  it("CursorAdapter should sanitize agent/skill keys to prevent path traversal", async () => {
    const adapter = new CursorAdapter();
    const traversalKey = "../../../../etc/passwd_mock";

    // We expect it to write to a sanitized path, not the traversed one.
    // Or we expect it to throw an error, depending on implementation.

    await adapter.write({
      mcps: {},
      agents: {},
      skills: {
        [traversalKey]: {
          name: "Evil Skill",
          content: "evil content"
        }
      }
    });

    // Check if the file was written to the directory using traversal
    const commandsDir = path.join(homeDir, ".cursor", "commands");

    const files = await fs.readdir(commandsDir);
    // Assert that the file is safely named by stripping the traversal components.
    expect(files).toContain("passwd_mock.md");
    expect(files).not.toContain("../../../../etc/passwd_mock.md");
  });
});
