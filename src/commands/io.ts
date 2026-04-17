import fs from "fs/promises";
import path from "path";
import readline from "readline";
import * as ui from "../ui/index.js";
import { getConfigManager } from "./_shared.js";
import { getVersion } from "../version.js";
import { ConfigSchema } from "../types.js";
import { requireInteractiveTTY } from "./_terminal.js";
import { acquireLock } from "../lock.js";

function timestampLike(input: string): string {
  return input.replace(/[:.]/g, "-");
}

async function writeFileAtomic(targetPath: string, content: string): Promise<void> {
  const tempPath = `${targetPath}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  // Write restored configs with restricted owner-only permissions to prevent local exposure of sensitive data
  await fs.writeFile(tempPath, content, { encoding: "utf-8", mode: 0o600 });
  await fs.rename(tempPath, targetPath);
}

function resolveBackupName(backups: string[], requested: string): string | null {
  if (backups.includes(requested)) return requested;

  const normalized = timestampLike(requested);
  if (normalized === requested) return null;

  const derived = `config.json.${normalized}.bak`;
  return backups.includes(derived) ? derived : null;
}

export async function restoreCommand(options: { from?: string }) {
  const timer = ui.startTimer();

  // Try reading config for brand header
  let activeProfile = "default";
  try {
    const cm = getConfigManager();
    const existingConfig = await cm.read();
    activeProfile = existingConfig.activeProfile || "default";
  } catch (e) {
    // Config may not exist
  }

  console.log(ui.format.brandHeader(getVersion(), activeProfile));
  ui.header("Restoring configuration...");

  const os = await import("os");

  const homeDir = process.env.SYNCTAX_HOME || os.homedir();
  const configDir = path.join(homeDir, ".synctax");

  try {
    const files = await fs.readdir(configDir);
    const backups = files.filter(f => f.startsWith("config.json.") && f.endsWith(".bak")).sort().reverse();

    if (backups.length === 0) {
      console.log(ui.format.warn("No backups found.", { prefix: "" }));
      return;
    }

    let targetBackup = backups[0]!;
    if (options.from) {
      const match = resolveBackupName(backups, options.from);
      if (match) {
        targetBackup = match;
      } else {
        ui.error(`Backup matching ${options.from} not found.`);
        process.exitCode = 1;
        return;
      }
    }

    const targetBackupPath = path.join(configDir, targetBackup);
    const configPath = path.join(configDir, "config.json");

    const backupRaw = await fs.readFile(targetBackupPath, "utf-8");
    const parsed = JSON.parse(backupRaw);
    ConfigSchema.parse(parsed);

    try {
      await fs.access(configPath);
      const restoreSnapshot = `config.json.pre-restore.${new Date().toISOString().replace(/[:.]/g, "-")}.bak`;
      await fs.copyFile(configPath, path.join(configDir, restoreSnapshot));
    } catch {
      // No current config to snapshot.
    }

    await writeFileAtomic(configPath, JSON.stringify(parsed, null, 2));
    ui.success(`Restored from backup: ${targetBackup}`);

    console.log(ui.format.summary(timer.elapsed(), `restored from ${targetBackup}`));
  } catch (e: any) {
    ui.error(`Restore failed: ${e.message}`);
    process.exitCode = 1;
  }
}

export async function exportCommand(filePath: string) {
  const timer = ui.startTimer();
  const configManager = getConfigManager();
  const config = await configManager.read();

  console.log(ui.format.brandHeader(getVersion(), config.activeProfile));

  const resolvedPath = path.resolve(process.cwd(), filePath);
  const exportable = JSON.parse(JSON.stringify(config));
  if (exportable.resources) {
    delete exportable.resources.credentials;
  }
  await fs.writeFile(resolvedPath, JSON.stringify(exportable, null, 2), "utf-8");
  ui.success(`Exported master configuration to ${resolvedPath}`);

  console.log(ui.format.summary(timer.elapsed(), `exported to ${resolvedPath}`));
}

export async function importCommand(filePath: string) {
  const timer = ui.startTimer();
  const configManager = getConfigManager();

  // Try reading existing config for brand header
  let activeProfile = "default";
  try {
    const existingConfig = await configManager.read();
    activeProfile = existingConfig.activeProfile || "default";
  } catch (e) {
    // Config may not exist yet
  }

  console.log(ui.format.brandHeader(getVersion(), activeProfile));

  const lock = await acquireLock("import");
  try {

  const resolvedPath = path.resolve(process.cwd(), filePath);
  let rawData: string;
  try {
    rawData = await fs.readFile(resolvedPath, "utf-8");
  } catch (e: any) {
    ui.error(`Could not read file ${resolvedPath}: ${e.message}`);
    return;
  }

  let importedConfig: any;
  try {
    importedConfig = JSON.parse(rawData);
  } catch (e: any) {
    ui.error(`Invalid JSON in ${resolvedPath}: ${e.message}`);
    return;
  }

  // Current existing config
  const currentConfig = await configManager.read();
  const currentClients = Object.keys(currentConfig.clients).filter(c => currentConfig.clients[c]?.enabled);

  // Clients mentioned in imported config
  const importedClients = Object.keys(importedConfig.clients || {}).filter(c => importedConfig.clients[c].enabled);

  // Find clients that are in imported config but not locally enabled
  const missingClients = importedClients.filter(c => !currentClients.includes(c));

  if (missingClients.length > 0) {
    if (!requireInteractiveTTY("import with missing clients confirmation")) {
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const confirmed = await new Promise<boolean>((resolve) => {
      rl.question(ui.format.warn(`The imported config contains clients not currently enabled (${missingClients.join(', ')}). Continue without them? (y/N) `, { prefix: "" }), (answer: string) => {
        rl.close();
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          for (const c of missingClients) {
            delete importedConfig.clients[c];
          }
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });

    if (!confirmed) {
      ui.warn("Import cancelled.");
      process.exitCode = 1;
      return;
    }
  }

  try {
    // Validate schema
    const { ConfigSchema } = await import("../types.js");
    const validConfig = ConfigSchema.parse(importedConfig);

    await configManager.backup();
    await configManager.write(validConfig);

    ui.success(`Successfully imported master configuration from ${resolvedPath}`);

    console.log(ui.format.summary(timer.elapsed(), `imported from ${resolvedPath}`));
  } catch (e: any) {
    ui.error(`Imported config is invalid: ${e.message}`);
    process.exitCode = 1;
  }
  } finally {
    await lock.release();
  }
}
