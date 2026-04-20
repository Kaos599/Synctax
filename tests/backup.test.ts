import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { ConfigManager } from "../src/config.js";

async function zipEntryNames(zipPath: string): Promise<string[]> {
  const { unzipSync } = await import("fflate");
  const data = await fs.readFile(zipPath);
  const zipped = unzipSync(new Uint8Array(data));
  return Object.keys(zipped).sort((a, b) => a.localeCompare(b));
}

describe("backupCommand", () => {
  let mockHome: string;
  let projectDir: string;
  let manager: ConfigManager;
  let originalCwd: () => string;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-backup-test-"));
    projectDir = path.join(mockHome, "project");
    await fs.mkdir(projectDir, { recursive: true });
    process.env.SYNCTAX_HOME = mockHome;

    originalCwd = process.cwd;
    process.cwd = () => projectDir;

    manager = new ConfigManager();
    await manager.write({
      version: 1,
      source: "claude",
      activeProfile: "default",
      clients: {
        claude: { enabled: true },
        cursor: { enabled: true },
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

    await fs.mkdir(path.join(mockHome, ".claude"), { recursive: true });
    await fs.writeFile(path.join(mockHome, ".claude", "settings.json"), JSON.stringify({ model: "x" }), "utf-8");

    await fs.mkdir(path.join(mockHome, ".cursor"), { recursive: true });
    await fs.writeFile(path.join(mockHome, ".cursor", "mcp.json"), JSON.stringify({ mcpServers: {} }), "utf-8");

    await fs.writeFile(path.join(projectDir, "CLAUDE.md"), "claude memory\n", "utf-8");
    await fs.writeFile(path.join(projectDir, ".cursorrules"), "cursor memory\n", "utf-8");

    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    process.cwd = originalCwd;
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
    vi.restoreAllMocks();
  });

  it("creates one bundled zip by default with client folders", async () => {
    const { backupCommand } = await import("../src/commands.js") as any;

    const output = path.join(projectDir, "bundle.zip");
    await backupCommand({ output });

    const entries = await zipEntryNames(output);
    expect(entries.some((e) => e.startsWith("clients/claude/"))).toBe(true);
    expect(entries.some((e) => e.startsWith("clients/cursor/"))).toBe(true);
    expect(entries.includes("manifest.json")).toBe(true);
  });

  it.skipIf(process.platform === "win32")("writes bundled archives with 0o600 permissions", async () => {
    const { backupCommand } = await import("../src/commands.js") as any;
    const output = path.join(projectDir, "secure-bundle.zip");

    const previousUmask = process.umask(0o022);
    try {
      await backupCommand({ output });
    } finally {
      process.umask(previousUmask);
    }

    const stat = await fs.stat(output);
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it("supports selecting a single client", async () => {
    const { backupCommand } = await import("../src/commands.js") as any;

    const output = path.join(projectDir, "only-claude.zip");
    await backupCommand({ output, client: ["claude"] });

    const entries = await zipEntryNames(output);
    expect(entries.some((e) => e.startsWith("clients/claude/"))).toBe(true);
    expect(entries.some((e) => e.startsWith("clients/cursor/"))).toBe(false);
  });

  it("supports selecting multiple clients via repeated client option", async () => {
    const { backupCommand } = await import("../src/commands.js") as any;

    const output = path.join(projectDir, "multi.zip");
    await backupCommand({ output, client: ["claude", "cursor"] });

    const entries = await zipEntryNames(output);
    expect(entries.some((e) => e.startsWith("clients/claude/"))).toBe(true);
    expect(entries.some((e) => e.startsWith("clients/cursor/"))).toBe(true);
  });

  it("reports partial or skipped client when no paths are discovered", async () => {
    await manager.write({
      version: 1,
      source: "claude",
      activeProfile: "default",
      clients: {
        zed: { enabled: true },
      },
      profiles: { default: {} },
      resources: {
        mcps: {},
        agents: {},
        skills: {},
        permissions: { allowedPaths: [] },
      },
    } as any);

    const { backupCommand } = await import("../src/commands.js") as any;
    const output = path.join(projectDir, "zed-only.zip");

    const result = await backupCommand({ output });
    const zedResult = result?.clientResults?.find((r: any) => r.clientId === "zed");

    expect(zedResult).toBeDefined();
    expect(["partial", "skipped", "failed"]).toContain(zedResult.status);
  });

  it("avoids overwriting per-client archives on repeated backups", async () => {
    const { backupCommand } = await import("../src/commands.js") as any;

    const outputDir = path.join(projectDir, "per-client");
    const first = await backupCommand({ layout: "per-client", output: outputDir, client: ["claude"] });
    const second = await backupCommand({ layout: "per-client", output: outputDir, client: ["claude"] });

    const firstPath = first?.artifacts?.[0]?.path;
    const secondPath = second?.artifacts?.[0]?.path;
    expect(firstPath).toBeDefined();
    expect(secondPath).toBeDefined();
    expect(firstPath).not.toBe(secondPath);
  });

  it("includes artifact checksums in backup result metadata", async () => {
    const { backupCommand } = await import("../src/commands.js") as any;

    const output = path.join(projectDir, "checksum-bundle.zip");
    const result = await backupCommand({ output, rollup: true });
    const allArtifacts = result?.artifacts || [];

    expect(allArtifacts.length).toBeGreaterThan(0);
    for (const artifact of allArtifacts) {
      expect(typeof artifact.sha256).toBe("string");
      expect((artifact.sha256 as string).length).toBe(64);
    }
  });
});
