import chalk from "chalk";
import * as ui from "../ui/index.js";
import { checkbox } from "@inquirer/prompts";
import { adapters } from "../adapters/index.js";
import { getConfigManager, applyProfileFilter } from "./_shared.js";

export async function syncCommand(options: { dryRun?: boolean, interactive?: boolean }) {
  const configManager = getConfigManager();
  ui.header("Starting sync...");

  const config = await configManager.read();
  let resources = await applyProfileFilter(config.resources, config.profiles[config.activeProfile]);

  if (options.interactive) {
    const choices = [
      ...Object.keys(resources.mcps || {}).map(k => ({ name: `[MCP] ${k}`, value: { domain: 'mcp', key: k }, checked: true })),
      ...Object.keys(resources.agents || {}).map(k => ({ name: `[Agent] ${k}`, value: { domain: 'agent', key: k }, checked: true })),
      ...Object.keys(resources.skills || {}).map(k => ({ name: `[Skill] ${k}`, value: { domain: 'skill', key: k }, checked: true }))
    ];

    if (choices.length > 0) {
      const selected = await checkbox({
        message: 'Select resources to sync:',
        choices
      });

      const filteredResources = { mcps: {}, agents: {}, skills: {}, permissions: resources.permissions, models: resources.models, prompts: resources.prompts };
      for (const item of selected) {
        if (item.domain === 'mcp') filteredResources.mcps[item.key] = resources.mcps[item.key];
        if (item.domain === 'agent') filteredResources.agents[item.key] = resources.agents[item.key];
        if (item.domain === 'skill') filteredResources.skills[item.key] = resources.skills[item.key];
      }
      resources = filteredResources as any;
    }
  }

  if (!options.dryRun) {
    await configManager.backup();
  }

  const enabledClients = Object.entries(config.clients).filter(([id, conf]) => conf.enabled && adapters[id]);

  // Execute adapter.write() concurrently across multiple clients to drastically improve sync performance
  const syncResults = await Promise.all(enabledClients.map(async ([id]) => {
    const adapter = adapters[id];
    if (options.dryRun) {
      return { adapter, success: true, dryRun: true };
    }
    try {
      await adapter.write(resources);
      return { adapter, success: true, dryRun: false };
    } catch (e: any) {
      return { adapter, success: false, error: e.message, dryRun: false };
    }
  }));

  for (const res of syncResults) {
    if (res.dryRun) {
      ui.dryRun(`Would write to ${res.adapter.name}`);
    } else if (res.success) {
      ui.success(`Synced ${res.adapter.name}`);
    } else {
      ui.error(`Failed to sync ${res.adapter.name}: ${res.error}`);
    }
  }

  ui.header("Sync complete!");
}

export async function memorySyncCommand(options: { source?: string, dryRun?: boolean }) {
  const configManager = getConfigManager();
  ui.header("Starting memory files sync...");

  const config = await configManager.read();
  const cwd = process.cwd();

  let sourceId = options.source || config.source;
  let sourceAdapter = sourceId ? adapters[sourceId] : undefined;

  if (!sourceAdapter) {
    sourceAdapter = adapters["claude"];
    console.log(ui.format.warn(`No valid source of truth found. Defaulting to ${sourceAdapter.name}.`, { prefix: "" }));
  }

  const sourceFileName = sourceAdapter.getMemoryFileName();
  const sourceContent = await sourceAdapter.readMemory(cwd);

  if (!sourceContent) {
    ui.error(`Source memory file not found: ${sourceFileName} in ${cwd}`);
    process.exitCode = 1;
    return;
  }

  let succeeded = 0;
  let failed = 0;

  const enabledClients = Object.entries(config.clients).filter(([id, conf]) => conf.enabled && id !== sourceId && adapters[id]);

  // Execute adapter.writeMemory() concurrently across multiple clients to drastically improve sync performance
  const syncResults = await Promise.all(enabledClients.map(async ([id]) => {
    const adapter = adapters[id];
    const targetFileName = adapter.getMemoryFileName();

    if (options.dryRun) {
      return { adapter, targetFileName, success: true, dryRun: true };
    }

    try {
      await adapter.writeMemory(cwd, sourceContent);
      return { adapter, targetFileName, success: true, dryRun: false };
    } catch (e: any) {
      return { adapter, targetFileName, success: false, error: e.message, dryRun: false };
    }
  }));

  for (const res of syncResults) {
    if (res.dryRun) {
      ui.dryRun(`Would sync ${sourceFileName} -> ${res.targetFileName}`);
      succeeded++;
    } else if (res.success) {
      ui.success(`Synced to ${res.targetFileName}`);
      succeeded++;
    } else {
      ui.error(`Failed to sync to ${res.targetFileName}: ${res.error}`);
      failed++;
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
    console.log("\n" + ui.format.warn(`Memory sync: ${succeeded} succeeded, ${failed} failed`));
  } else if (succeeded > 0) {
    console.log("\n" + ui.format.success(`Memory sync complete: ${succeeded} target(s) updated`));
  } else {
    ui.warn("No enabled target clients to sync to");
  }
}

export async function watchCommand(options: any) {
  const configManager = getConfigManager();
  const fs = await import("fs/promises");
  const path = await import("path");
  const os = await import("os");
  const chokidar = await import("chokidar");

  const homeDir = process.env.SYNCTAX_HOME || os.homedir();
  const configPath = path.join(homeDir, ".synctax", "config.json");

  console.log(chalk.magenta("\n👁️  Initializing synctax Watch Daemon..."));
  ui.dim(`Watching: ${configPath}`);

  let syncTimeout: any;

  const watcher = chokidar.watch(configPath, {
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    }
  }).on("change", async () => {
    console.log(ui.format.warn(`[${new Date().toLocaleTimeString()}] Master config modified.`, { prefix: "" }));

    // Debounce the sync so rapidly saving multiple times doesn't spam
    if (syncTimeout) clearTimeout(syncTimeout);

    syncTimeout = setTimeout(async () => {
      try {
        ui.header("Triggering background sync...");
        await syncCommand({ dryRun: false });
      } catch (e: any) {
        ui.error(`Watch sync failed: ${e.message}`);
      }
    }, 500);
  });

  ui.success("Daemon is active. Press Ctrl+C to exit.\n");
  return watcher;
}
