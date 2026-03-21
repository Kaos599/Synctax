import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ClaudeAdapter } from "../src/adapters/claude.js";
import { CursorAdapter } from "../src/adapters/cursor.js";
import { OpenCodeAdapter } from "../src/adapters/opencode.js";
import { AntigravityAdapter } from "../src/adapters/antigravity.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("Memory Domain (Context Files)", () => {
  let mockProject: string;

  beforeEach(async () => {
    mockProject = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-project-"));
  });

  afterEach(async () => {
    await fs.rm(mockProject, { recursive: true, force: true });
  });

  it("ClaudeAdapter maps to CLAUDE.md", async () => {
    const adapter = new ClaudeAdapter();
    expect(adapter.getMemoryFileName()).toBe("CLAUDE.md");

    await adapter.writeMemory(mockProject, "# Project Rules\nUse tabs.");
    const content = await adapter.readMemory(mockProject);
    expect(content).toBe("# Project Rules\nUse tabs.");
  });

  it("CursorAdapter maps to .cursorrules", async () => {
    const adapter = new CursorAdapter();
    expect(adapter.getMemoryFileName()).toBe(".cursorrules");

    await adapter.writeMemory(mockProject, "Always type safe.");
    const content = await adapter.readMemory(mockProject);
    expect(content).toBe("Always type safe.");
  });

  it("OpenCodeAdapter maps to AGENTS.md", async () => {
    const adapter = new OpenCodeAdapter();
    expect(adapter.getMemoryFileName()).toBe("AGENTS.md");
  });

  it("AntigravityAdapter maps to .antigravityrules", async () => {
    const adapter = new AntigravityAdapter();
    expect(adapter.getMemoryFileName()).toBe(".antigravityrules");
  });
});
