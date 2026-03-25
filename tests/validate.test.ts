import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { ConfigManager } from "../src/config.js";
import { adapters } from "../src/adapters/index.js";
import { validateCommand } from "../src/commands.js";

describe("validateCommand", () => {
  let mockHome: string;
  let manager: ConfigManager;
  let originalPath: string | undefined;

  beforeEach(async () => {
    mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-validate-test-"));
    process.env.SYNCTAX_HOME = mockHome;
    manager = new ConfigManager();
    originalPath = process.env.PATH;
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    await fs.rm(mockHome, { recursive: true, force: true });
    delete process.env.SYNCTAX_HOME;
    process.env.PATH = originalPath;
    delete process.env.MOCK_TOKEN;
    delete adapters["mockclient"];
    vi.restoreAllMocks();
  });

  it("validate checks schema, client detect, env refs, commands on PATH, active profile", async () => {
    const binDir = path.join(mockHome, "bin");
    await fs.mkdir(binDir, { recursive: true });
    const cmdPath = path.join(binDir, "mock-cmd");
    await fs.writeFile(cmdPath, "#!/bin/sh\nexit 0\n", "utf-8");
    await fs.chmod(cmdPath, 0o755);
    process.env.PATH = `${binDir}${path.delimiter}${originalPath || ""}`;
    process.env.MOCK_TOKEN = "present";

    adapters["mockclient"] = {
      id: "mockclient",
      name: "Mock Client",
      detect: async () => true,
      read: async () => ({ mcps: {}, agents: {}, skills: {} }),
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    };

    await manager.write({
      version: 1,
      source: "mockclient",
      activeProfile: "default",
      clients: { mockclient: { enabled: true } },
      profiles: { default: {} },
      resources: {
        mcps: {
          demo: {
            command: "mock-cmd",
            env: {
              TOKEN: "$MOCK_TOKEN",
            },
          },
        },
        agents: {},
        skills: {},
        permissions: { allowedPaths: [] },
        models: {},
        prompts: {},
        credentials: { envRefs: {} },
      },
    } as any);

    const healthy = await validateCommand();
    expect(healthy).toBe(true);
  });

  it("validate returns non-zero semantics for hard errors", async () => {
    adapters["mockclient"] = {
      id: "mockclient",
      name: "Mock Client",
      detect: async () => false,
      read: async () => ({ mcps: {}, agents: {}, skills: {} }),
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    };

    await manager.write({
      version: 1,
      source: "mockclient",
      activeProfile: "missing-profile",
      clients: { mockclient: { enabled: true } },
      profiles: { default: {} },
      resources: {
        mcps: {
          broken: {
            command: "definitely-not-on-path-xyz",
            env: {
              TOKEN: "$MISSING_TOKEN",
            },
          },
        },
        agents: {},
        skills: {},
        permissions: { allowedPaths: [] },
        models: {},
        prompts: {},
        credentials: { envRefs: {} },
      },
    } as any);

    const healthy = await validateCommand();
    expect(healthy).toBe(false);
  });

  it("detects Windows commands that already include PATHEXT extension", async () => {
    const windowsBin = path.join(mockHome, "windows-bin");
    process.env.PATH = windowsBin;
    process.env.PATHEXT = ".EXE;.CMD;.BAT;.COM";

    const platformSpy = vi
      .spyOn(process, "platform", "get")
      .mockReturnValue("win32");
    const accessSpy = vi
      .spyOn(fs, "access")
      .mockImplementation(async (targetPath: any) => {
        if (String(targetPath) === path.join(windowsBin, "npm.cmd")) {
          return;
        }
        throw new Error("ENOENT");
      });

    adapters["mockclient"] = {
      id: "mockclient",
      name: "Mock Client",
      detect: async () => true,
      read: async () => ({ mcps: {}, agents: {}, skills: {} }),
      write: async () => {},
      getMemoryFileName: () => "MOCK.md",
      readMemory: async () => null,
      writeMemory: async () => {},
    };

    await manager.write({
      version: 1,
      source: "mockclient",
      activeProfile: "default",
      clients: { mockclient: { enabled: true } },
      profiles: { default: {} },
      resources: {
        mcps: {
          demo: {
            command: "npm.cmd",
          },
        },
        agents: {},
        skills: {},
        permissions: { allowedPaths: [] },
        models: {},
        prompts: {},
        credentials: { envRefs: {} },
      },
    } as any);

    const healthy = await validateCommand();

    expect(healthy).toBe(true);
    expect(accessSpy).toHaveBeenCalledWith(path.join(windowsBin, "npm.cmd"), expect.any(Number));
    expect(
      accessSpy.mock.calls.some(([candidate]) => String(candidate).toLowerCase().endsWith("npm.cmd.cmd")),
    ).toBe(false);

    platformSpy.mockRestore();
  });
});
