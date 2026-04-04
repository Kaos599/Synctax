import fs from "fs/promises";
import path from "path";
import * as ui from "../ui/index.js";
import { adapters } from "../adapters/index.js";
import { getConfigManager } from "./_shared.js";
import { getVersion } from "../version.js";

const CANONICAL_RELATIVE_PATH = ".synctax/instructions.md";

function getUniqueMemoryTargets(config: any): string[] {
  const targets = new Set<string>();

  for (const [id, clientConf] of Object.entries(config.clients || {})) {
    if (!(clientConf as any)?.enabled) continue;
    const adapter = adapters[id];
    if (!adapter) continue;
    targets.add(adapter.getMemoryFileName());
  }

  return [...targets].sort((a, b) => a.localeCompare(b));
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.lstat(filePath);
    return true;
  } catch (error: any) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function ensureCanonicalFile(canonicalPath: string, sourcePath?: string): Promise<void> {
  if (await pathExists(canonicalPath)) return;

  let content = "";
  if (sourcePath && await pathExists(sourcePath)) {
    content = await fs.readFile(sourcePath, "utf-8");
  }

  await fs.mkdir(path.dirname(canonicalPath), { recursive: true });
  await fs.writeFile(canonicalPath, content, "utf-8");
}

export async function linkCommand() {
  const timer = ui.startTimer();
  const configManager = getConfigManager();
  const config = await configManager.read();
  const cwd = process.cwd();
  const canonicalPath = path.join(cwd, CANONICAL_RELATIVE_PATH);

  console.log(ui.format.brandHeader(getVersion(), config.activeProfile));
  ui.header("Creating instruction symlinks...");

  const sourceAdapter = config.source ? adapters[config.source] : undefined;
  const sourcePath = sourceAdapter ? path.join(cwd, sourceAdapter.getMemoryFileName()) : undefined;
  await ensureCanonicalFile(canonicalPath, sourcePath);

  const canonicalContent = await fs.readFile(canonicalPath, "utf-8");
  const memoryTargets = getUniqueMemoryTargets(config);
  let linked = 0;
  let skipped = 0;

  for (const memoryFile of memoryTargets) {
    const targetPath = path.join(cwd, memoryFile);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    if (await pathExists(targetPath)) {
      const stat = await fs.lstat(targetPath);

      if (stat.isSymbolicLink()) {
        const linkTarget = await fs.readlink(targetPath);
        const resolvedTarget = path.resolve(path.dirname(targetPath), linkTarget);
        if (resolvedTarget === canonicalPath) {
          linked++;
          continue;
        }

        ui.warn(`Skipping ${memoryFile}: symlink points elsewhere`);
        skipped++;
        continue;
      }

      const backupPath = `${targetPath}.bak`;
      if (!(await pathExists(backupPath))) {
        await fs.rename(targetPath, backupPath);
      } else {
        const existingContent = await fs.readFile(targetPath, "utf-8");
        if (existingContent !== canonicalContent) {
          ui.warn(`Skipping ${memoryFile}: existing file differs and backup already exists`);
          skipped++;
          continue;
        }
        await fs.rm(targetPath, { force: true });
      }
    }

    const relativeCanonical = path.relative(path.dirname(targetPath), canonicalPath);
    await fs.symlink(relativeCanonical, targetPath);
    linked++;
  }

  console.log(ui.format.summary(timer.elapsed(), `${linked} linked, ${skipped} skipped`));
}

export async function unlinkCommand() {
  const timer = ui.startTimer();
  const configManager = getConfigManager();
  const config = await configManager.read();
  const cwd = process.cwd();
  const canonicalPath = path.join(cwd, CANONICAL_RELATIVE_PATH);

  console.log(ui.format.brandHeader(getVersion(), config.activeProfile));
  ui.header("Unlinking instruction symlinks...");

  if (!(await pathExists(canonicalPath))) {
    ui.warn(`Canonical file not found: ${CANONICAL_RELATIVE_PATH}`);
    console.log(ui.format.summary(timer.elapsed(), "0 unlinked"));
    return;
  }

  const canonicalContent = await fs.readFile(canonicalPath, "utf-8");
  const memoryTargets = getUniqueMemoryTargets(config);
  let unlinked = 0;
  let skipped = 0;

  for (const memoryFile of memoryTargets) {
    const targetPath = path.join(cwd, memoryFile);
    if (!(await pathExists(targetPath))) continue;

    const stat = await fs.lstat(targetPath);
    if (!stat.isSymbolicLink()) continue;

    const linkTarget = await fs.readlink(targetPath);
    const resolvedTarget = path.resolve(path.dirname(targetPath), linkTarget);
    if (resolvedTarget !== canonicalPath) {
      skipped++;
      ui.warn(`Skipping ${memoryFile}: symlink points elsewhere`);
      continue;
    }

    await fs.unlink(targetPath);
    await fs.writeFile(targetPath, canonicalContent, "utf-8");
    unlinked++;
  }

  console.log(ui.format.summary(timer.elapsed(), `${unlinked} unlinked, ${skipped} skipped`));
}
