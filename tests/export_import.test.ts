import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exportCommand, importCommand, getConfigManager } from "../src/commands.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

function setTTY(stream: NodeJS.WriteStream, value: boolean): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(stream, "isTTY");
  Object.defineProperty(stream, "isTTY", { configurable: true, value });

  return () => {
    if (descriptor) {
      Object.defineProperty(stream, "isTTY", descriptor);
      return;
    }
    delete (stream as { isTTY?: boolean }).isTTY;
  };
}

describe("Export/Import Commands", () => {
  let tmpDir: string;
  let originalCwd: () => string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-exp-"));
    process.env.SYNCTAX_HOME = tmpDir;

    // We must mock cwd
    originalCwd = process.cwd;
    process.cwd = () => tmpDir;
    
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
    process.cwd = originalCwd;
    await fs.rm(tmpDir, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
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

  describe("export credential stripping", () => {
    it("exportCommand strips credentials from exported file", async () => {
      // 1. Write a config WITH credentials
      const configManager = getConfigManager();
      let config = await configManager.read();
      config.resources.credentials = { envRefs: { SECRET_KEY: "sk-test-123" } };
      await configManager.write(config);

      // 2. Export to temp file
      const exportPath = path.join(tmpDir, "export-test.json");
      await exportCommand(exportPath);

      // 3. Read exported file
      const exported = JSON.parse(await fs.readFile(exportPath, "utf-8"));

      // 4. Assert credentials are ABSENT
      expect(exported.resources?.credentials).toBeUndefined();

      // 5. Assert other resources still present
      expect(exported.resources).toBeDefined();
      expect(exported.version).toBeDefined();
    });

    it("exportCommand preserves non-sensitive config fields", async () => {
      // Ensure mcps, agents, skills etc are still in the export
      const configManager = getConfigManager();
      let config = await configManager.read();
      config.resources.mcps = { "test-mcp": { command: "test", args: [] } as any };
      config.resources.credentials = { envRefs: { KEY: "secret" } };
      await configManager.write(config);

      const exportPath = path.join(tmpDir, "export-test2.json");
      await exportCommand(exportPath);

      const exported = JSON.parse(await fs.readFile(exportPath, "utf-8"));
      expect(exported.resources.mcps["test-mcp"]).toBeDefined();
      expect(exported.resources?.credentials).toBeUndefined();
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

    it("fails fast in non-TTY when import requires interactive confirmation", async () => {
      const mockConfig = {
        version: 1,
        activeProfile: "default",
        profiles: { default: {} },
        clients: { cursor: { enabled: true }, claude: { enabled: true } },
        resources: {
          mcps: { test: { command: "test2" } },
          agents: {},
          skills: {},
          permissions: { allowedPaths: [], deniedPaths: [], allowedCommands: [], deniedCommands: [], networkAllow: false },
        },
      };

      const importPath = "import.json";
      await fs.writeFile(path.join(tmpDir, importPath), JSON.stringify(mockConfig));

      const restoreStdout = setTTY(process.stdout, false);
      const restoreStderr = setTTY(process.stderr, false);
      const previousExitCode = process.exitCode;

      try {
        process.exitCode = undefined;
        await importCommand(importPath);
        expect(process.exitCode).toBe(1);

        const unchanged = JSON.parse(await fs.readFile(path.join(tmpDir, ".synctax", "config.json"), "utf-8"));
        expect(unchanged.clients.claude).toBeUndefined();
      } finally {
        process.exitCode = previousExitCode;
        restoreStdout();
        restoreStderr();
      }
    });
  });
});
