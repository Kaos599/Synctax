import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

/**
 * Write a file atomically: write to a temp file in the same directory,
 * then rename() into place. rename() is atomic on POSIX when source
 * and target are on the same filesystem.
 */
export async function atomicWriteFile(
  targetPath: string,
  content: string,
  mode?: number,
): Promise<void> {
  const dir = path.dirname(targetPath);
  await fs.mkdir(dir, { recursive: true }).catch(() => {});

  const tmpSuffix = `${process.pid}-${Date.now()}-${randomBytes(8).toString('hex')}`;
  const tempPath = `${targetPath}.synctax-tmp-${tmpSuffix}`;
  await fs.writeFile(tempPath, content, {
    encoding: "utf-8",
    mode: mode ?? 0o644,
  });
  await fs.rename(tempPath, targetPath);
}

/**
 * Write sensitive files with owner-only permissions (0o600).
 */
export async function atomicWriteSecure(
  targetPath: string,
  content: string,
): Promise<void> {
  await atomicWriteFile(targetPath, content, 0o600);
}
