import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";

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

export async function isExecutableFile(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function commandExistsOnPath(command: string): Promise<boolean> {
  const trimmed = command.trim();
  if (!trimmed) return false;

  const hasPathSeparator = trimmed.includes(path.sep) || trimmed.includes("/") || trimmed.includes("\\");
  if (hasPathSeparator || path.isAbsolute(trimmed)) {
    return isExecutableFile(trimmed);
  }

  const pathEnv = process.env.PATH ?? "";
  const pathSegments = pathEnv.split(path.delimiter).filter(Boolean);

  if (process.platform === "win32") {
    const pathext = (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
      .split(";")
      .filter(Boolean)
      .map((ext) => ext.toLowerCase());

    // If command already has an extension, we also check it directly
    const candidateHasExt = /\.[^\\/]+$/.test(trimmed);
    const candidates = candidateHasExt ? [trimmed] : [];

    // Check command as-is first (especially if user passed something.exe)
    if (!candidateHasExt) {
      candidates.push(trimmed);
    }

    // Append standard Windows extensions
    for (const ext of pathext) {
      const normalizedExt = ext.startsWith(".") ? ext : `.${ext}`;
      if (normalizedExt && !trimmed.toLowerCase().endsWith(normalizedExt)) {
        candidates.push(`${trimmed}${normalizedExt}`);
      }
    }

    // Collect all full paths across all PATH segments
    const allPaths: string[] = [];
    for (const segment of pathSegments) {
      for (const candidate of candidates) {
        allPaths.push(path.join(segment, candidate));
      }
    }

    // Check them all concurrently
    const results = await Promise.all(
      allPaths.map(async (fullPath) => {
        try {
          await fs.access(fullPath, fsConstants.F_OK);
          return true;
        } catch {
          return false;
        }
      })
    );
    return results.some((r) => r);
  }

  // Non-Windows (Unix)
  const allPaths = pathSegments.map((segment) => path.join(segment, trimmed));

  const results = await Promise.all(
    allPaths.map(async (fullPath) => isExecutableFile(fullPath))
  );

  return results.some((r) => r);
}
