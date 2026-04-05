import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";

import { atomicWriteFile, atomicWriteSecure } from "../src/fs-utils.js";

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
