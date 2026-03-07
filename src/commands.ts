import chalk from "chalk";
import { ConfigManager } from "./config.js";
import { adapters } from "./adapters/index.js";
import { Config } from "./types.js";

// Instantiate per function to avoid caching SYNCTAX_HOME in tests
function getConfigManager() {
  return new ConfigManager();
}

export async function initCommand(options: { detect?: boolean; source?: string; force?: boolean }) {
  const configManager = getConfigManager();
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
    resources: { mcps: {}, agents: {} },
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
  const configManager = getConfigManager();
  const config = await configManager.read();
  const mcps = config.resources.mcps || {};
  const agents = config.resources.agents || {};

  if (Object.keys(mcps).length > 0) {
    console.log(chalk.blue("\nRegistered MCP Servers:"));
    for (const [name, server] of Object.entries(mcps)) {
      console.log(`- ${chalk.cyan(name)}: ${server.command} ${server.args?.join(" ") || ""}`);
    }
  } else {
    console.log(chalk.yellow("\nNo MCP servers found."));
  }

  if (Object.keys(agents).length > 0) {
    console.log(chalk.blue("\nRegistered Agents:"));
    for (const [name, agent] of Object.entries(agents)) {
      console.log(`- ${chalk.cyan(name)}: ${agent.description || agent.prompt.slice(0, 30) + '...'}`);
    }
  } else {
    console.log(chalk.yellow("\nNo Agents found."));
  }
}

export async function statusCommand() {
  const configManager = getConfigManager();
  const config = await configManager.read();
  const mcps = config.resources.mcps || {};
  const agents = config.resources.agents || {};

  console.log(chalk.blue("Sync Status:"));

  for (const [id, clientConf] of Object.entries(config.clients)) {
    if (!clientConf.enabled) continue;

    const adapter = adapters[id];
    if (!adapter) {
      console.log(chalk.red(`Adapter not found for client: ${id}`));
      continue;
    }

    try {
      const data = await adapter.read();
      console.log(`\nClient: ${chalk.cyan(adapter.name)}`);

      let inSync = true;
      for (const [name, server] of Object.entries(mcps)) {
        const clientServer = data.mcps[name];
        if (!clientServer) {
          console.log(chalk.yellow(`  ⚠ Missing MCP: ${name}`));
          inSync = false;
        } else if (JSON.stringify(server) !== JSON.stringify(clientServer)) {
           console.log(chalk.yellow(`  ⚠ Drift detected in MCP: ${name}`));
           inSync = false;
        }
      }

      for (const [name, agent] of Object.entries(agents)) {
        const clientAgent = data.agents[name];
        if (!clientAgent) {
          console.log(chalk.yellow(`  ⚠ Missing Agent: ${name}`));
          inSync = false;
        } else if (JSON.stringify(agent) !== JSON.stringify(clientAgent)) {
           console.log(chalk.yellow(`  ⚠ Drift detected in Agent: ${name}`));
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
  const configManager = getConfigManager();
  console.log(chalk.blue("Starting sync..."));

  const config = await configManager.read();
  const resources = await applyProfileFilter(config.resources, config.profiles[config.activeProfile]);

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
        await adapter.write(resources);
        console.log(chalk.green(`✓ Synced ${adapter.name}`));
      } catch (e: any) {
        console.log(chalk.red(`✗ Failed to sync ${adapter.name}: ${e.message}`));
      }
    }
  }

  console.log(chalk.blue("Sync complete!"));
}

export async function memorySyncCommand(options: { source?: string, dryRun?: boolean }) {
  const configManager = getConfigManager();
  console.log(chalk.blue("Starting memory files sync..."));

  const config = await configManager.read();
  const cwd = process.cwd();

  let sourceId = options.source || config.source;
  let sourceAdapter = sourceId ? adapters[sourceId] : undefined;

  if (!sourceAdapter) {
    sourceAdapter = adapters["claude"];
    console.log(chalk.yellow(`No valid source of truth found. Defaulting to ${sourceAdapter.name}.`));
  }

  const sourceFileName = sourceAdapter.getMemoryFileName();
  const sourceContent = await sourceAdapter.readMemory(cwd);

  if (!sourceContent) {
    console.log(chalk.red(`Could not read source memory file: ${sourceFileName} in ${cwd}`));
    return;
  }

  for (const [id, clientConf] of Object.entries(config.clients)) {
    if (!clientConf.enabled || id === sourceId) continue;

    const adapter = adapters[id];
    if (!adapter) continue;

    const targetFileName = adapter.getMemoryFileName();
    if (options.dryRun) {
      console.log(chalk.yellow(`[Dry Run] Would sync ${sourceFileName} -> ${targetFileName}`));
    } else {
      try {
        await adapter.writeMemory(cwd, sourceContent);
        console.log(chalk.green(`✓ Synced to ${targetFileName}`));
      } catch (e: any) {
         console.log(chalk.red(`✗ Failed to sync to ${targetFileName}: ${e.message}`));
      }
    }
  }
}

export async function pullCommand(options: { from: string, merge?: boolean, overwrite?: boolean, domain?: string }) {
  const configManager = getConfigManager();
  console.log(chalk.blue(`Pulling config from ${options.from}...`));

  const adapter = adapters[options.from];
  if (!adapter) {
    console.log(chalk.red(`Adapter not found for client: ${options.from}`));
    return;
  }

  const config = await configManager.read();

  try {
    const data = await adapter.read();

    if (options.overwrite) {
      if (!options.domain || options.domain === 'mcp') {
        config.resources.mcps = data.mcps;
      }
      if (!options.domain || options.domain === 'agents') {
        config.resources.agents = data.agents;
      }
    } else {
      // Default is merge
      if (!options.domain || options.domain === 'mcp') {
        config.resources.mcps = { ...config.resources.mcps, ...data.mcps };
      }
      if (!options.domain || options.domain === 'agents') {
        config.resources.agents = { ...config.resources.agents, ...data.agents };
      }
    }

    config.source = options.from;

    await configManager.write(config);
    console.log(chalk.green(`✓ Successfully pulled resources from ${adapter.name}`));
  } catch (e: any) {
    console.log(chalk.red(`✗ Failed to pull config: ${e.message}`));
  }
}

export async function moveCommand(domain: string, name: string, options: { toGlobal?: boolean, toLocal?: boolean, toClient?: string, push?: boolean }) {
  const configManager = getConfigManager();
  console.log(chalk.blue(`Moving ${domain} resource: ${name}...`));

  const config = await configManager.read();

  let resourceGroup: any;
  if (domain === "mcp") resourceGroup = config.resources.mcps;
  else if (domain === "agent") resourceGroup = config.resources.agents;
  else {
    console.log(chalk.red(`Unsupported domain: ${domain}`));
    return;
  }

  const resource = resourceGroup[name];
  if (!resource) {
    console.log(chalk.red(`Resource ${name} not found in master config.`));
    return;
  }

  if (options.toGlobal) resource.scope = "global";
  if (options.toLocal) resource.scope = "local";

  await configManager.write(config);
  console.log(chalk.green(`✓ Successfully updated scope for ${name}`));

  if (options.push) {
    await syncCommand({});
  }
}

export async function profileCreateCommand(name: string, options: { include?: string, exclude?: string }) {
  const configManager = getConfigManager();
  console.log(chalk.blue(`Creating profile: ${name}...`));

  const config = await configManager.read();

  if (config.profiles[name]) {
    console.log(chalk.yellow(`Profile ${name} already exists.`));
    return;
  }

  config.profiles[name] = {
    include: options.include ? options.include.split(",").map(s => s.trim()) : undefined,
    exclude: options.exclude ? options.exclude.split(",").map(s => s.trim()) : undefined
  };

  await configManager.write(config);
  console.log(chalk.green(`✓ Profile ${name} created successfully.`));
}

export async function profileUseCommand(name: string, options: { dryRun?: boolean, noSync?: boolean }) {
  const configManager = getConfigManager();
  console.log(chalk.blue(`Switching to profile: ${name}...`));

  const config = await configManager.read();

  if (!config.profiles[name]) {
    console.log(chalk.red(`Profile ${name} does not exist.`));
    return;
  }

  if (options.dryRun) {
    console.log(chalk.yellow(`[Dry Run] Would switch active profile to ${name}`));
    return;
  }

  config.activeProfile = name;
  await configManager.write(config);
  console.log(chalk.green(`✓ Active profile is now ${name}.`));

  if (!options.noSync) {
    await syncCommand({});
  }
}

// Update syncCommand to respect the active profile includes/excludes
export async function applyProfileFilter(resources: any, profile: any) {
  if (!profile || (!profile.include && !profile.exclude)) return resources;

  const filtered = { mcps: { ...resources.mcps }, agents: { ...resources.agents } };

  // Helper to filter a specific group
  const filterGroup = (group: any) => {
    for (const key of Object.keys(group)) {
      if (profile.include && !profile.include.includes(key)) {
        delete group[key];
        continue;
      }
      if (profile.exclude && profile.exclude.includes(key)) {
        delete group[key];
      }
    }
  };

  filterGroup(filtered.mcps);
  filterGroup(filtered.agents);

  return filtered;
}
