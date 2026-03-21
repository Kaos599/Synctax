import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exportCommand, importCommand } from "../src/commands.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("Export/Import Commands", () => {
  let tmpDir: string;
  let originalCwd: string;
  let originalSynctaxHome: string | undefined;
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-exp-"));
    originalSynctaxHome = process.env.SYNCTAX_HOME;
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;

    process.env.SYNCTAX_HOME = tmpDir;
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;

    // Use real cwd change to avoid leaking mocked process.cwd across suites
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    
    await fs.mkdir(path.join(tmpDir, ".synctax"), { recursive: true });
    
    // Write a dummy master config
    const mockConfig = {
      version: 1,
      activeProfile: "default",
      profiles: { default: {} },
      clients: { cursor: { enabled: true } },
      resources: {
        mcps: { test: { command: "test" } },
        agents: {},
        skills: {},
        permissions: { allowedPaths: [], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false },
      },
    };
    await fs.writeFile(path.join(tmpDir, ".synctax", "config.json"), JSON.stringify(mockConfig));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tmpDir, { recursive: true, force: true });
    if (originalSynctaxHome === undefined) delete process.env.SYNCTAX_HOME;
    else process.env.SYNCTAX_HOME = originalSynctaxHome;
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = originalUserProfile;
    vi.restoreAllMocks();
  });

  describe("exportCommand", () => {
    it("should export the master config to the specified file", async () => {
      const exportPath = "export.json";
      await exportCommand(exportPath);

      const resolvedPath = path.resolve(tmpDir, exportPath);
      const exportedData = await fs.readFile(resolvedPath, "utf-8");
      const parsed = JSON.parse(exportedData);
      expect(parsed.resources.mcps.test.command).toBe("test");
    });
  });

  describe("importCommand", () => {
    it("should import valid config and overwrite existing one", async () => {
      const mockConfig = {
        version: 1,
        activeProfile: "default",
        profiles: { default: {} },
        clients: { cursor: { enabled: true } },
        resources: {
          mcps: { test: { command: "test2" } },
          agents: {},
          skills: {},
          permissions: { allowedPaths: [], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false },
        },
      };

      const importPath = "import.json";
      await fs.writeFile(path.join(tmpDir, importPath), JSON.stringify(mockConfig));

      await importCommand(importPath);

      const newMaster = JSON.parse(await fs.readFile(path.join(tmpDir, ".synctax", "config.json"), "utf-8"));
      expect(newMaster.resources.mcps.test.command).toBe("test2");
    });
  });
});
