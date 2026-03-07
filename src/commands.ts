import chalk from "chalk";
import { ConfigManager } from "./config.js";
import { adapters } from "./adapters/index.js";
import { Config } from "./types.js";

const configManager = new ConfigManager();

export async function initCommand(options: { detect?: boolean; source?: string; force?: boolean }) {
  console.log(chalk.blue("Initializing synctax..."));

  let currentConfig: Config | null = null;
  try {
    currentConfig = await configManager.read();
  } catch (e) {
    // Config may not exist or is invalid
  }

  if (currentConfig && Object.keys(currentConfig.clients).length > 0 && !options.force) {
    console.log(chalk.yellow("Configuration already exists. Use --force to overwrite."));
    return;
  }

  const newConfig: Config = {
    version: 1,
    source: options.source,
    clients: {},
    resources: { mcps: {} },
  };

  if (options.detect !== false) {
    console.log(chalk.gray("Detecting clients..."));
    for (const [id, adapter] of Object.entries(adapters)) {
      const detected = await adapter.detect();
      if (detected) {
        console.log(chalk.green(`✓ Found ${adapter.name}`));
        newConfig.clients[id] = { enabled: true };
      }
    }
  }

  if (!newConfig.source) {
    // If no source is specified, use the first enabled client as default
    const firstClient = Object.keys(newConfig.clients)[0];
    if (firstClient) {
      newConfig.source = firstClient;
      console.log(chalk.gray(`Setting ${adapters[firstClient].name} as the default source.`));
    }
  }

  await configManager.write(newConfig);
  console.log(chalk.green("Initialization complete!"));
}

export async function listCommand() {
  const config = await configManager.read();
  const mcps = config.resources.mcps || {};

  const mcpNames = Object.keys(mcps);
  if (mcpNames.length === 0) {
    console.log(chalk.yellow("No MCP servers found in master configuration."));
    return;
  }

  console.log(chalk.blue("Registered MCP Servers:"));
  for (const [name, server] of Object.entries(mcps)) {
    console.log(`- ${chalk.cyan(name)}: ${server.command} ${server.args?.join(" ") || ""}`);
  }
}

export async function statusCommand() {
  const config = await configManager.read();
  const mcps = config.resources.mcps || {};

  console.log(chalk.blue("Sync Status:"));

  for (const [id, clientConf] of Object.entries(config.clients)) {
    if (!clientConf.enabled) continue;

    const adapter = adapters[id];
    if (!adapter) {
      console.log(chalk.red(`Adapter not found for client: ${id}`));
      continue;
    }

    try {
      const clientMcps = await adapter.read();
      console.log(`\nClient: ${chalk.cyan(adapter.name)}`);

      let inSync = true;
      for (const [name, server] of Object.entries(mcps)) {
        const clientServer = clientMcps[name];
        if (!clientServer) {
          console.log(chalk.yellow(`  ⚠ Missing: ${name}`));
          inSync = false;
        } else if (JSON.stringify(server) !== JSON.stringify(clientServer)) {
           console.log(chalk.yellow(`  ⚠ Drift detected: ${name}`));
           inSync = false;
        }
      }

      for (const name of Object.keys(clientMcps)) {
         if (!mcps[name]) {
           console.log(chalk.yellow(`  ⚠ Untracked: ${name} (Present in client but not in master config)`));
           inSync = false;
         }
      }

      if (inSync) {
        console.log(chalk.green("  ✓ All in sync"));
      }

    } catch (e: any) {
      console.log(chalk.red(`  ✗ Error reading config: ${e.message}`));
    }
  }
}

export async function syncCommand(options: { dryRun?: boolean }) {
  console.log(chalk.blue("Starting sync..."));

  const config = await configManager.read();
  const mcps = config.resources.mcps || {};

  if (!options.dryRun) {
    await configManager.backup();
  }

  for (const [id, clientConf] of Object.entries(config.clients)) {
    if (!clientConf.enabled) continue;

    const adapter = adapters[id];
    if (!adapter) continue;

    if (options.dryRun) {
      console.log(chalk.yellow(`[Dry Run] Would write to ${adapter.name}`));
    } else {
      try {
        await adapter.write(mcps);
        console.log(chalk.green(`✓ Synced ${adapter.name}`));
      } catch (e: any) {
        console.log(chalk.red(`✗ Failed to sync ${adapter.name}: ${e.message}`));
      }
    }
  }

  console.log(chalk.blue("Sync complete!"));
}
