import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { ConfigManager } from "../src/config.js";
import { linkCommand, unlinkCommand } from "../src/commands/link.js";

// Symlink creation requires Developer Mode or elevated privileges on Windows
describe.skipIf(process.platform === "win32")("link/unlink commands", () => {
  let mockHome: string;
  let projectDir: string;
  let previousCwd: string;
  let manager: ConfigManager;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-link-home-"));
    projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-link-project-"));
    previousCwd = process.cwd();
    process.chdir(projectDir);
    process.env.SYNCTAX_HOME = mockHome;
    manager = new ConfigManager();

    await manager.write({
      version: 1,
      source: "claude",
      activeProfile: "default",
      clients: {
        claude: { enabled: true },
        cursor: { enabled: true },
        opencode: { enabled: true },
        "github-copilot": { enabled: true },
        "github-copilot-cli": { enabled: true },
      },
      profiles: { default: {} },
      resources: {
        mcps: {},
        agents: {},
        skills: {},
        permissions: { allowedPaths: [] },
        models: {},
        prompts: {},
        credentials: { envRefs: {} },
      },
    } as any);
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await fs.rm(projectDir, { recursive: true, force: true });
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
  });

  it("link creates canonical instructions file and symlinks client memory files", async () => {
    await fs.writeFile(path.join(projectDir, "CLAUDE.md"), "# Shared rules\nUse strict types.\n", "utf-8");

    await linkCommand();
    await linkCommand();

    const canonicalPath = path.join(projectDir, ".synctax", "instructions.md");
    const canonicalContent = await fs.readFile(canonicalPath, "utf-8");
    expect(canonicalContent).toContain("Shared rules");

    const targets = [
      "CLAUDE.md",
      ".cursorrules",
      "AGENTS.md",
      ".github/copilot-instructions.md",
    ];

    for (const target of targets) {
      const targetPath = path.join(projectDir, target);
      const stat = await fs.lstat(targetPath);
      expect(stat.isSymbolicLink()).toBe(true);

      const linkTarget = await fs.readlink(targetPath);
      const resolved = path.resolve(path.dirname(targetPath), linkTarget);
      expect(resolved).toBe(canonicalPath);
    }
  });

  it("unlink restores regular files with preserved content", async () => {
    await fs.writeFile(path.join(projectDir, "CLAUDE.md"), "Original\n", "utf-8");
    await linkCommand();

    const canonicalPath = path.join(projectDir, ".synctax", "instructions.md");
    await fs.writeFile(canonicalPath, "Updated shared content\n", "utf-8");

    const unrelatedPath = path.join(projectDir, "README.md");
    await fs.writeFile(unrelatedPath, "Unrelated file\n", "utf-8");

    await unlinkCommand();
    await unlinkCommand();

    const targets = [
      "CLAUDE.md",
      ".cursorrules",
      "AGENTS.md",
      ".github/copilot-instructions.md",
    ];

    for (const target of targets) {
      const targetPath = path.join(projectDir, target);
      const stat = await fs.lstat(targetPath);
      expect(stat.isSymbolicLink()).toBe(false);
      const content = await fs.readFile(targetPath, "utf-8");
      expect(content).toBe("Updated shared content\n");
    }

    expect(await fs.readFile(unrelatedPath, "utf-8")).toBe("Unrelated file\n");
  });
});
