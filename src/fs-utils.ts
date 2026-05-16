import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

async function isExecutableFile(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check whether a command exists on PATH.
 * Handles absolute paths, Windows PATHEXT, and POSIX executable bits.
 */
export async function commandExistsOnPath(command: string): Promise<boolean> {
  const trimmed = command.trim();
  if (!trimmed) return false;

  if (/[\\/]/.test(trimmed) || path.isAbsolute(trimmed)) {
    return isExecutableFile(trimmed);
  }

  const pathValue = process.env.PATH || "";
  const pathParts = pathValue.split(path.delimiter).filter(Boolean);
  const isWindows = process.platform === "win32";
  const extensions = isWindows
    ? (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";")
    : [""];
  const hasKnownWindowsExtension =
    isWindows &&
    extensions.some((ext) => {
      const normalizedExt = ext.startsWith(".") ? ext : `.${ext}`;
      return Boolean(normalizedExt) && trimmed.toLowerCase().endsWith(normalizedExt.toLowerCase());
    });

  for (const dir of pathParts) {
    if (isWindows) {
      const commandAsIs = path.join(dir, trimmed);
      if (await isExecutableFile(commandAsIs)) {
        return true;
      }

      if (hasKnownWindowsExtension) {
        continue;
      }

      for (const ext of extensions) {
        const normalizedExt = ext.startsWith(".") ? ext : `.${ext}`;
        if (!normalizedExt) continue;

        const candidate = path.join(dir, `${trimmed}${normalizedExt}`);
        if (await isExecutableFile(candidate)) {
          return true;
        }
      }
      continue;
    }

    const candidate = path.join(dir, trimmed);
    if (await isExecutableFile(candidate)) {
      return true;
    }
  }

  return false;
}

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

  const tmpSuffix = `${process.pid}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
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
