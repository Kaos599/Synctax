import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import os from "os";
import path from "path";
import fs from "fs/promises";
import { atomicWriteFile } from "../src/fs-utils.js";

describe("atomicWriteFile security", () => {
  let tmpDir: string;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-test-"));
    originalEnv = process.env.SYNCTAX_HOME;
    process.env.SYNCTAX_HOME = tmpDir;
  });

  afterEach(async () => {
    process.env.SYNCTAX_HOME = originalEnv;
    await fs.rm(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("should not use Math.random for generating temporary file names", async () => {
    const mathRandomSpy = vi.spyOn(Math, "random");
    const targetPath = path.join(tmpDir, "test.txt");

    await atomicWriteFile(targetPath, "test content");

    expect(mathRandomSpy).not.toHaveBeenCalled();
  });
});
