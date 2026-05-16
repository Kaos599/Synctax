import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";

import { atomicWriteFile, atomicWriteSecure, commandExistsOnPath } from "../src/fs-utils.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-fs-utils-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("atomicWriteFile", () => {
  it("writes content to the target file", async () => {
    const target = path.join(tmpDir, "test.json");
    await atomicWriteFile(target, '{"ok":true}');
    const content = await fs.readFile(target, "utf-8");
    expect(content).toBe('{"ok":true}');
  });

  it("does not leave a temp file behind on success", async () => {
    const target = path.join(tmpDir, "test.json");
    await atomicWriteFile(target, "hello");
    const files = await fs.readdir(tmpDir);
    expect(files).toEqual(["test.json"]);
  });

  it("creates parent directories if missing", async () => {
    const target = path.join(tmpDir, "nested", "deep", "config.json");
    await atomicWriteFile(target, "nested");
    const content = await fs.readFile(target, "utf-8");
    expect(content).toBe("nested");
  });

  it("overwrites an existing file atomically", async () => {
    const target = path.join(tmpDir, "test.json");
    await fs.writeFile(target, "old", "utf-8");
    await atomicWriteFile(target, "new");
    const content = await fs.readFile(target, "utf-8");
    expect(content).toBe("new");
  });
});

describe("atomicWriteSecure", () => {
  // Windows does not enforce Unix file permission modes
  it.skipIf(process.platform === "win32")("writes with mode 0o600", async () => {
    const target = path.join(tmpDir, "secret.env");
    await atomicWriteSecure(target, "SECRET=value");
    const stat = await fs.stat(target);
    expect(stat.mode & 0o777).toBe(0o600);
  });
});

describe("atomic write security — no predictable temp names", () => {
  it("atomicWriteFile does NOT call Math.random for temp suffix", async () => {
    const randomSpy = vi.spyOn(Math, "random");
    const target = path.join(tmpDir, "secure-test.json");
    await atomicWriteFile(target, '{"secure":true}');
    expect(randomSpy).not.toHaveBeenCalled();
    randomSpy.mockRestore();
  });

  it("atomicWriteSecure does NOT call Math.random for temp suffix", async () => {
    const randomSpy = vi.spyOn(Math, "random");
    const target = path.join(tmpDir, "secure-test.env");
    await atomicWriteSecure(target, "SECRET=value");
    expect(randomSpy).not.toHaveBeenCalled();
    randomSpy.mockRestore();
  });
});

describe("commandExistsOnPath", () => {
  let savedPath: string | undefined;
  let savedPatheExt: string | undefined;

  beforeEach(() => {
    savedPath = process.env.PATH;
    savedPatheExt = process.env.PATHEXT;
  });

  afterEach(() => {
    if (savedPath !== undefined) {
      process.env.PATH = savedPath;
    } else {
      delete process.env.PATH;
    }
    if (savedPatheExt !== undefined) {
      process.env.PATHEXT = savedPatheExt;
    } else {
      delete process.env.PATHEXT;
    }
  });

  it("returns false for empty string", async () => {
    expect(await commandExistsOnPath("")).toBe(false);
  });

  it("returns false for whitespace-only string", async () => {
    expect(await commandExistsOnPath("   ")).toBe(false);
  });

  it("returns true for absolute path to executable file", async () => {
    const exePath = path.join(tmpDir, "my-cmd");
    await fs.writeFile(exePath, "#!/bin/sh\necho hi", { mode: 0o755 });
    expect(await commandExistsOnPath(exePath)).toBe(true);
  });

  it.skipIf(process.platform === "win32")("returns false for absolute path to non-executable file", async () => {
    const filePath = path.join(tmpDir, "not-executable");
    await fs.writeFile(filePath, "read-only", { mode: 0o444 });
    expect(await commandExistsOnPath(filePath)).toBe(false);
  });

  it("returns false for absolute path to nonexistent file", async () => {
    expect(await commandExistsOnPath(path.join(tmpDir, "does-not-exist"))).toBe(false);
  });

  it("finds command on PATH (POSIX)", async () => {
    const binDir = path.join(tmpDir, "bin");
    await fs.mkdir(binDir);
    await fs.writeFile(path.join(binDir, "test-cmd"), "#!/bin/sh\necho hi", { mode: 0o755 });
    process.env.PATH = binDir;
    expect(await commandExistsOnPath("test-cmd")).toBe(true);
  });

  it("returns false when command not on PATH", async () => {
    process.env.PATH = tmpDir;
    expect(await commandExistsOnPath("nonexistent-command-xyz")).toBe(false);
  });

  it("returns false when PATH is empty", async () => {
    process.env.PATH = "";
    expect(await commandExistsOnPath("anything")).toBe(false);
  });
});
