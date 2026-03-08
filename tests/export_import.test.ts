import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportCommand, importCommand } from "../src/commands.js";

vi.mock("fs/promises", () => {
  const mockWriteFile = vi.fn();
  const mockReadFile = vi.fn();
  return {
    writeFile: mockWriteFile,
    readFile: mockReadFile,
    default: {
      writeFile: mockWriteFile,
      readFile: mockReadFile,
      access: vi.fn(),
      mkdir: vi.fn(),
      copyFile: vi.fn()
    }
  };
});

vi.mock("chalk", () => ({
  default: {
    green: vi.fn((m) => m),
    red: vi.fn((m) => m),
    yellow: vi.fn((m) => m),
    blue: vi.fn((m) => m),
    cyan: vi.fn((m) => m),
  },
}));

const mockRead = vi.fn();
const mockWrite = vi.fn();
const mockBackup = vi.fn();

vi.mock("../src/config.js", () => {
  return {
    ConfigManager: class {
      read = mockRead;
      write = mockWrite;
      backup = mockBackup;
    }
  };
});

describe("Export/Import Commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("exportCommand", () => {
    it("should export the master config to the specified file", async () => {
      const mockConfig = {
        version: 1,
        clients: { cursor: { enabled: true } },
        resources: {
          mcps: { test: { command: "test" } },
          agents: {},
          skills: {},
        },
      };

      mockRead.mockResolvedValue(mockConfig as any);

      const exportPath = "/tmp/export.json";
      await exportCommand(exportPath);

      expect(mockRead).toHaveBeenCalled();
      const resolvedPath = require("path").resolve(process.cwd(), exportPath);

      const fs = await import("fs/promises");
      expect(fs.writeFile).toHaveBeenCalledWith(
        resolvedPath,
        JSON.stringify(mockConfig, null, 2),
        "utf-8"
      );
    });
  });

  describe("importCommand", () => {
    it("should import valid config and overwrite existing one", async () => {
      const mockConfig = {
        version: 1,
        clients: { cursor: { enabled: true } },
        resources: {
          mcps: { test: { command: "test" } },
          agents: {},
          skills: {},
        },
      };

      const fs = await import("fs/promises");
      (fs.readFile as any).mockResolvedValue(JSON.stringify(mockConfig));
      mockRead.mockResolvedValue({ clients: { cursor: { enabled: true } } } as any);

      const importPath = "/tmp/import.json";
      await importCommand(importPath);

      expect(mockBackup).toHaveBeenCalled();
      expect(mockWrite).toHaveBeenCalled();
    });
  });
});
