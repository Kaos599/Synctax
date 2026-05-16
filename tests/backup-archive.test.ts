import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { writeBackupBundle, writePerClientBackups } from "../src/backup/archive.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-backup-archive-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("writeBackupBundle", () => {
  it("creates a valid bundle with multiple files", async () => {
    const file1 = path.join(tmpDir, "config1.json");
    const file2 = path.join(tmpDir, "config2.json");
    await fs.writeFile(file1, '{"a":1}');
    await fs.writeFile(file2, '{"b":2}');

    const outputPath = path.join(tmpDir, "bundle.zip");
    const result = await writeBackupBundle({
      outputPath,
      createdAt: "2026-01-01T00:00:00Z",
      clients: [
        {
          id: "test-client",
          name: "Test Client",
          warnings: [],
          files: [
            { scope: "global", kind: "config", path: file1 },
            { scope: "global", kind: "config", path: file2 },
          ],
        },
      ],
    });

    expect(result.layout).toBe("bundle");
    expect(result.clientResults).toHaveLength(1);
    expect(result.clientResults[0]!.fileCount).toBe(2);
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]!.path).toBe(outputPath);
  });

  it("handles unreadable files gracefully", async () => {
    const existingFile = path.join(tmpDir, "readable.json");
    await fs.writeFile(existingFile, '{"ok":true}');
    const missingFile = path.join(tmpDir, "does-not-exist.json");

    const outputPath = path.join(tmpDir, "partial.zip");
    const result = await writeBackupBundle({
      outputPath,
      createdAt: "2026-01-01T00:00:00Z",
      clients: [
        {
          id: "test-client",
          name: "Test Client",
          warnings: [],
          files: [
            { scope: "global", kind: "config", path: existingFile },
            { scope: "global", kind: "config", path: missingFile },
          ],
        },
      ],
    });

    expect(result.clientResults[0]!.status).toBe("partial");
    expect(result.clientResults[0]!.fileCount).toBe(1);
    expect(result.clientResults[0]!.warnings).toHaveLength(1);
  });
});

describe("writePerClientBackups", () => {
  it("creates separate bundles per client", async () => {
    const file1 = path.join(tmpDir, "client1-config.json");
    const file2 = path.join(tmpDir, "client2-config.json");
    await fs.writeFile(file1, '{"a":1}');
    await fs.writeFile(file2, '{"b":2}');

    const outputDir = path.join(tmpDir, "per-client");
    await fs.mkdir(outputDir, { recursive: true });

    const result = await writePerClientBackups({
      outputDir,
      createdAt: "2026-01-01T00:00:00Z",
      clients: [
        {
          id: "client-a",
          name: "Client A",
          warnings: [],
          files: [{ scope: "global", kind: "config", path: file1 }],
        },
        {
          id: "client-b",
          name: "Client B",
          warnings: [],
          files: [{ scope: "global", kind: "config", path: file2 }],
        },
      ],
    });

    expect(result.layout).toBe("per-client");
    expect(result.clientResults).toHaveLength(2);
    expect(result.artifacts).toHaveLength(2);
  });
});

describe("bounded concurrency — file reads execute in parallel", () => {
  it("writeBackupBundle completes 5 files faster than sequential (concurrency check)", async () => {
    const delayMs = 50;
    const fileCount = 5;
    const files: Array<{ scope: "global"; kind: "config"; path: string }> = [];

    for (let i = 0; i < fileCount; i++) {
      const p = path.join(tmpDir, `file-${i}.json`);
      await fs.writeFile(p, `{"i":${i}}`);
      files.push({ scope: "global", kind: "config", path: p });
    }

    let concurrentReads = 0;
    let maxConcurrentReads = 0;
    const originalReadFile = fs.readFile;

    vi.spyOn(fs, "readFile").mockImplementation(async (...args: Parameters<typeof fs.readFile>) => {
      concurrentReads++;
      maxConcurrentReads = Math.max(maxConcurrentReads, concurrentReads);
      await new Promise((r) => setTimeout(r, delayMs));
      concurrentReads--;
      return originalReadFile(...args);
    });

    const outputPath = path.join(tmpDir, "concurrent.zip");
    const result = await writeBackupBundle({
      outputPath,
      createdAt: "2026-01-01T00:00:00Z",
      clients: [
        { id: "test-client", name: "Test Client", warnings: [], files },
      ],
    });

    expect(result.clientResults[0]!.fileCount).toBe(fileCount);
    expect(maxConcurrentReads).toBeGreaterThan(1);
  });

  it("writePerClientBackups reads files concurrently across clients", async () => {
    const delayMs = 50;
    const outputDir = path.join(tmpDir, "per-client-concurrent");
    await fs.mkdir(outputDir, { recursive: true });

    const filesA: Array<{ scope: "global"; kind: "config"; path: string }> = [];
    const filesB: Array<{ scope: "global"; kind: "config"; path: string }> = [];

    for (let i = 0; i < 3; i++) {
      const pA = path.join(tmpDir, `a-${i}.json`);
      const pB = path.join(tmpDir, `b-${i}.json`);
      await fs.writeFile(pA, `{"a":${i}}`);
      await fs.writeFile(pB, `{"b":${i}}`);
      filesA.push({ scope: "global", kind: "config", path: pA });
      filesB.push({ scope: "global", kind: "config", path: pB });
    }

    let concurrentReads = 0;
    let maxConcurrentReads = 0;
    const originalReadFile = fs.readFile;

    vi.spyOn(fs, "readFile").mockImplementation(async (...args: Parameters<typeof fs.readFile>) => {
      concurrentReads++;
      maxConcurrentReads = Math.max(maxConcurrentReads, concurrentReads);
      await new Promise((r) => setTimeout(r, delayMs));
      concurrentReads--;
      return originalReadFile(...args);
    });

    const result = await writePerClientBackups({
      outputDir,
      createdAt: "2026-01-01T00:00:00Z",
      clients: [
        { id: "client-a", name: "Client A", warnings: [], files: filesA },
        { id: "client-b", name: "Client B", warnings: [], files: filesB },
      ],
    });

    expect(result.clientResults).toHaveLength(2);
    expect(result.clientResults[0]!.fileCount).toBe(3);
    expect(result.clientResults[1]!.fileCount).toBe(3);
    expect(maxConcurrentReads).toBeGreaterThan(1);
  });
});
