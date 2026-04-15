import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CursorAdapter } from "../src/adapters/cursor.js";
import { ClaudeAdapter } from "../src/adapters/claude.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("Security: Path Traversal", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-security-"));
    process.env.SYNCTAX_HOME = tempDir;
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  describe("CursorAdapter", () => {
    it("throws on path traversal in skill key", async () => {
      const adapter = new CursorAdapter();
      await expect(
        adapter.write({
          mcps: {},
          agents: {},
          skills: {
            "../../../../etc/passwd_mock": { name: "Evil Skill", content: "evil" },
          },
        })
      ).rejects.toThrow(/invalid skill key/i);
    });

    it("throws on null-byte in skill key", async () => {
      const adapter = new CursorAdapter();
      await expect(
        adapter.write({
          mcps: {},
          agents: {},
          skills: {
            "skill\0name": { name: "Null Byte Skill", content: "evil" },
          },
        })
      ).rejects.toThrow(/invalid skill key/i);
    });

    it("accepts valid skill keys", async () => {
      const adapter = new CursorAdapter();
      await expect(
        adapter.write({
          mcps: {},
          agents: {},
          skills: {
            "my-skill": { name: "My Skill", content: "safe content" },
            "another_skill_123": { name: "Another Skill", content: "also safe" },
          },
        })
      ).resolves.toBeUndefined();
    });
  });

  describe("ClaudeAdapter", () => {
    it("throws on path traversal in agent key", async () => {
      const adapter = new ClaudeAdapter();
      await expect(
        adapter.write({
          mcps: {},
          agents: {
            "../../../../etc/cron.d/evil": { name: "Evil Agent", prompt: "do evil things" },
          },
          skills: {},
        })
      ).rejects.toThrow(/invalid agent key/i);
    });

    it("throws on path traversal in skill key", async () => {
      const adapter = new ClaudeAdapter();
      await expect(
        adapter.write({
          mcps: {},
          agents: {},
          skills: {
            "../../../.bashrc": { name: "Evil Skill", content: "evil content" },
          },
        })
      ).rejects.toThrow(/invalid skill key/i);
    });

    it("throws on double-dot component in agent key", async () => {
      const adapter = new ClaudeAdapter();
      await expect(
        adapter.write({
          mcps: {},
          agents: {
            "agents..evil": { name: "Dotdot Agent", prompt: "break out" },
          },
          skills: {},
        })
      ).rejects.toThrow(/invalid agent key/i);
    });

    it("accepts valid agent and skill keys", async () => {
      const adapter = new ClaudeAdapter();
      await expect(
        adapter.write({
          mcps: {},
          agents: {
            "code-reviewer": { name: "Code Reviewer", prompt: "Review code carefully." },
          },
          skills: {
            "summarize": { name: "Summarize", content: "Summarize the input." },
          },
        })
      ).resolves.toBeUndefined();
    });
  });
});
