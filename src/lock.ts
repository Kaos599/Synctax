import fs from "fs/promises";
import path from "path";
import os from "os";

const STALE_THRESHOLD_MS = 60_000;

interface LockInfo {
  pid: number;
  timestamp: string;
  command: string;
}

function getLockPath(): string {
  const homeDir = process.env.SYNCTAX_HOME || os.homedir();
  return path.join(homeDir, ".synctax", "sync.lock");
}

async function isStale(lockPath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(lockPath, "utf-8");
    const info: LockInfo = JSON.parse(content);
    const lockTime = new Date(info.timestamp).getTime();
    if (Number.isNaN(lockTime)) return true;
    return Date.now() - lockTime > STALE_THRESHOLD_MS;
  } catch {
    return true;
  }
}

/**
 * Acquire an exclusive file lock. Prevents concurrent sync/write operations.
 * Returns a release function. Throws if lock is held by another process.
 */
export async function acquireLock(
  command = "unknown",
): Promise<{ release: () => Promise<void> }> {
  const lockPath = getLockPath();
  const dir = path.dirname(lockPath);
  await fs.mkdir(dir, { recursive: true }).catch(() => {});

  const lockInfo: LockInfo = {
    pid: process.pid,
    timestamp: new Date().toISOString(),
    command,
  };

  const tryWrite = async () => {
    await fs.writeFile(lockPath, JSON.stringify(lockInfo), {
      flag: "wx",
      encoding: "utf-8",
    });
  };

  try {
    await tryWrite();
  } catch (err: any) {
    if (err.code === "EEXIST") {
      if (await isStale(lockPath)) {
        await fs.unlink(lockPath).catch(() => {});
        try {
          await tryWrite();
        } catch {
          throw new Error(
            `Another synctax process is running. If this is incorrect, delete ${lockPath}`,
          );
        }
      } else {
        let holder = "unknown";
        try {
          const content = await fs.readFile(lockPath, "utf-8");
          const info: LockInfo = JSON.parse(content);
          holder = `PID ${info.pid} (${info.command})`;
        } catch { /* ignore */ }
        throw new Error(
          `Another synctax process is running (${holder}). Wait for it to finish or delete ${lockPath}`,
        );
      }
    } else {
      throw err;
    }
  }

  return {
    release: async () => {
      await fs.unlink(lockPath).catch(() => {});
    },
  };
}
