import * as ui from "../ui/index.js";
import { getConfigManager } from "./_shared.js";

export async function restoreCommand(options: { from?: string }) {
  ui.header("Restoring configuration...");

  // The ConfigManager backup logic writes to .bak files in the config dir
  // Let's implement restore logic directly here or via a new configManager method.
  const fs = await import("fs/promises");
  const path = await import("path");
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
      const match = backups.find(b => b.includes(options.from!));
      if (match) targetBackup = match;
      else {
        ui.error(`Backup matching ${options.from} not found.`);
        return;
      }
    }

    await fs.copyFile(path.join(configDir, targetBackup), path.join(configDir, "config.json"));
    ui.success(`Restored from backup: ${targetBackup}`);
  } catch (e: any) {
    ui.error(`Restore failed: ${e.message}`);
  }
}

export async function exportCommand(filePath: string) {
  const configManager = getConfigManager();
  const config = await configManager.read();

  const resolvedPath = require("path").resolve(process.cwd(), filePath);
  await (await import("fs/promises")).writeFile(resolvedPath, JSON.stringify(config, null, 2), "utf-8");
  ui.success(`Exported master configuration to ${resolvedPath}`);
}

export async function importCommand(filePath: string) {
  const configManager = getConfigManager();

  const resolvedPath = require("path").resolve(process.cwd(), filePath);
  let rawData: string;
  try {
    rawData = await (await import("fs/promises")).readFile(resolvedPath, "utf-8");
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
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    await new Promise<void>((resolve) => {
      rl.question(ui.format.warn(`The imported config contains clients not currently enabled (${missingClients.join(', ')}). Continue without them? (y/N) `, { prefix: "" }), (answer: string) => {
        rl.close();
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          // Remove missing clients from the imported config
          for (const c of missingClients) {
            delete importedConfig.clients[c];
          }
          resolve();
        } else {
          ui.error("Import cancelled.");
          process.exit(1);
        }
      });
    });
  }

  try {
    // Validate schema
    const { ConfigSchema } = await import("../types.js");
    const validConfig = ConfigSchema.parse(importedConfig);

    await configManager.backup();
    await configManager.write(validConfig);

    ui.success(`Successfully imported master configuration from ${resolvedPath}`);
  } catch (e: any) {
    ui.error(`Imported config is invalid: ${e.message}`);
  }
}
