import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";

import { acquireLock } from "../src/lock.js";

let mockHome: string;

beforeEach(async () => {
  mockHome = await fs.mkdtemp(path.join(os.tmpdir(), "synctax-lock-"));
  process.env.SYNCTAX_HOME = mockHome;
  await fs.mkdir(path.join(mockHome, ".synctax"), { recursive: true });
});

afterEach(async () => {
  await fs.rm(mockHome, { recursive: true, force: true });
  delete process.env.SYNCTAX_HOME;
});

describe("acquireLock", () => {
  it("creates a lock file on acquire", async () => {
    const lock = await acquireLock("test");
    const lockPath = path.join(mockHome, ".synctax", "sync.lock");
    const exists = await fs.access(lockPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
    await lock.release();
  });

  it("removes the lock file on release", async () => {
    const lock = await acquireLock("test");
    await lock.release();
    const lockPath = path.join(mockHome, ".synctax", "sync.lock");
    const exists = await fs.access(lockPath).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });

  it("throws when lock is already held", async () => {
    const lock1 = await acquireLock("first");
    await expect(acquireLock("second")).rejects.toThrow(/Another synctax process/);
    await lock1.release();
  });

  it("reclaims a stale lock older than 60s", async () => {
    const lockPath = path.join(mockHome, ".synctax", "sync.lock");
    const staleInfo = {
      pid: 99999,
      timestamp: new Date(Date.now() - 120_000).toISOString(),
      command: "stale",
    };
    await fs.writeFile(lockPath, JSON.stringify(staleInfo), "utf-8");

    const lock = await acquireLock("reclaim");
    const content = JSON.parse(await fs.readFile(lockPath, "utf-8"));
    expect(content.command).toBe("reclaim");
    await lock.release();
  });
});
