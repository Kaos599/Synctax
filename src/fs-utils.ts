import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";

export async function isExecutableFile(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function commandExistsOnPath(command: string): Promise<boolean> {
  if (!command) return false;

  const trimmed = command.trim();
  if (trimmed.includes(path.sep) || path.isAbsolute(trimmed)) {
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

  const candidates = pathParts.flatMap((dir) => {
    if (isWindows) {
      if (hasKnownWindowsExtension) {
        return [path.join(dir, trimmed)];
      }
      return [
        path.join(dir, trimmed),
        ...extensions.map((ext) => {
          const normalizedExt = ext.startsWith(".") ? ext : `.${ext}`;
          return normalizedExt ? path.join(dir, `${trimmed}${normalizedExt}`) : null;
        }),
      ].filter(Boolean) as string[];
    }
    return [path.join(dir, trimmed)];
  });

  try {
    await Promise.any(
      candidates.map(async (candidate) => {
        const isExec = await isExecutableFile(candidate);
        if (isExec) {
          return true;
        }
        throw new Error("Not executable");
      })
    );
    return true;
  } catch {
    return false;
  }
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

  const tmpSuffix = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
