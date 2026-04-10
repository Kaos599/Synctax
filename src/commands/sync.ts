import chalk from "chalk";
import * as ui from "../ui/index.js";
import { checkbox, confirm } from "@inquirer/prompts";
import { adapters } from "../adapters/index.js";
import { getConfigManager, applyProfileFilter, resolveProfile, mergePermissions } from "./_shared.js";
import { getVersion } from "../version.js";
import { EnvVault } from "../env-vault.js";
import { requireInteractiveTTY } from "./_terminal.js";
import { compareDomain, renderClientDiff, hasDiffChanges } from "../diff-utils.js";
import type { ClientDiff } from "../diff-utils.js";
import { acquireLock } from "../lock.js";

export async function syncCommand(options: { dryRun?: boolean, interactive?: boolean, yes?: boolean, strictEnv?: boolean }) {
  const timer = ui.startTimer();
  const configManager = getConfigManager();

  // Acquire lock to prevent concurrent syncs
  let lock: { release: () => Promise<void> } | undefined;
  if (!options.dryRun) {
    try {
      lock = await acquireLock("sync");
    } catch (e: any) {
      ui.error(e.message);
      process.exitCode = 1;
      return;
    }
  }

  try {
    await syncCommandInner(options, configManager, timer);
  } finally {
    await lock?.release();
  }
}

async function syncCommandInner(
  options: { dryRun?: boolean, interactive?: boolean, yes?: boolean, strictEnv?: boolean },
  configManager: ReturnType<typeof getConfigManager>,
  timer: ReturnType<typeof ui.startTimer>,
) {
  const config = await configManager.read();
  console.log(ui.format.brandHeader(getVersion(), config.activeProfile));
  ui.header("Starting sync...");

  // --- Client-first pull: if source is configured, pull from it first ---
  const sourceId = config.source;
  const sourceAdapter = sourceId ? adapters[sourceId] : undefined;

  if (sourceAdapter) {
    const spin = ui.spinner(`Pulling from ${sourceAdapter.name}...`);
    try {
      const sourceData = await sourceAdapter.read();
      // Additive merge into master config
      for (const [key, value] of Object.entries(sourceData.mcps || {})) {
        config.resources.mcps[key] = value as any;
      }
      for (const [key, value] of Object.entries(sourceData.agents || {})) {
        config.resources.agents[key] = value as any;
      }
      for (const [key, value] of Object.entries(sourceData.skills || {})) {
        config.resources.skills[key] = value as any;
      }
      if (sourceData.permissions) {
        config.resources.permissions = mergePermissions(config.resources.permissions, sourceData.permissions);
      }
      await configManager.write(config);
      spin.succeed(`Pulled from ${sourceAdapter.name}`);
    } catch (e: any) {
      spin.fail(`Pull from ${sourceAdapter.name} failed: ${e.message}`);
      ui.warn("Continuing with current master config.");
    }
  }

  let resources: any;
  try {
    const resolvedProfile = resolveProfile(config.profiles, config.activeProfile);
    resources = await applyProfileFilter(config.resources, resolvedProfile);
  } catch (e: any) {
    ui.error(`Profile resolution failed: ${e.message}`);
    process.exitCode = 1;
    return;
  }

  const envVault = new EnvVault();
  const loadedProfileEnv = await envVault.loadProfileEnv(config.activeProfile, { ensure: !options.dryRun });
  if (loadedProfileEnv.created) {
    ui.warn(`Env Vault (${config.activeProfile}): created missing profile env file at ${loadedProfileEnv.path}`);
  }
  for (const warning of loadedProfileEnv.warnings) {
    ui.warn(`Env Vault (${config.activeProfile}): ${warning}`);
  }

  const resolvedMcps: Record<string, any> = {};
  for (const [mcpName, mcp] of Object.entries(resources.mcps || {})) {
    const mcpServer = mcp as Record<string, unknown>;

    if (!mcpServer.env) {
      resolvedMcps[mcpName] = mcpServer;
      continue;
    }

    const resolvedEnv = envVault.resolveMcpEnv(mcpServer.env as Record<string, string>, loadedProfileEnv.vars);
    for (const warning of resolvedEnv.warnings) {
      ui.warn(`Env Vault (${mcpName}): ${warning}`);
    }

    resolvedMcps[mcpName] = {
      ...mcpServer,
      env: resolvedEnv.env,
    };
  }
  resources = {
    ...resources,
    mcps: resolvedMcps,
  };

  if (options.interactive) {
    if (!requireInteractiveTTY("sync --interactive")) {
      return;
    }

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

      const filteredResources: any = { mcps: {}, agents: {}, skills: {}, permissions: resources.permissions, models: resources.models, prompts: resources.prompts };
      for (const item of selected) {
        if (item.domain === 'mcp') filteredResources.mcps[item.key] = resources.mcps[item.key];
        if (item.domain === 'agent') filteredResources.agents[item.key] = resources.agents[item.key];
        if (item.domain === 'skill') filteredResources.skills[item.key] = resources.skills[item.key];
      }
      resources = filteredResources as any;
    }
  }

  // Build enabled clients list (excluding source — it's the authority)
  const enabledClients: Array<{ id: string; adapter: any }> = [];
  for (const [id, clientConf] of Object.entries(config.clients)) {
    if (!clientConf.enabled) continue;
    if (id === sourceId) continue; // Source client is never written to
    const adapter = adapters[id];
    if (!adapter) continue;
    enabledClients.push({ id, adapter });
  }

  // --- Diff preview: show what will change before writing ---
  if (!options.dryRun && enabledClients.length > 0) {
    const diffResults = await Promise.all(
      enabledClients.map(async ({ id, adapter }) => {
        try {
          const data = await adapter.read();
          return { id, adapter, success: true as const, data };
        } catch {
          return { id, success: false as const };
        }
      })
    );

    const clientDiffs: ClientDiff[] = [];
    for (const result of diffResults) {
      if (result.success) {
        clientDiffs.push({
          id: result.id,
          name: result.adapter.name,
          domains: {
            mcps: compareDomain(resources.mcps || {}, result.data.mcps || {}),
            agents: compareDomain(resources.agents || {}, result.data.agents || {}),
            skills: compareDomain(resources.skills || {}, result.data.skills || {}),
          },
        });
      }
    }

    const hasChanges = clientDiffs.some(hasDiffChanges);

    if (hasChanges) {
      ui.header("Sync plan:");
      for (const diff of clientDiffs) {
        if (hasDiffChanges(diff)) {
          renderClientDiff(diff);
        }
      }
      console.log("");

      // Ask for confirmation unless --yes was passed
      if (!options.yes) {
        const isTTY = process.stdin.isTTY && !process.env.VITEST;
        if (isTTY) {
          const proceed = await confirm({
            message: "Apply these changes?",
            default: false,
          });
          if (!proceed) {
            ui.dim("Sync cancelled.");
            console.log(ui.format.summary(timer.elapsed(), "cancelled"));
            return;
          }
        }
      }
    } else {
      ui.dim("All clients are already in sync.");
      console.log(ui.format.summary(timer.elapsed(), "0 changes needed"));
      return;
    }
  }

  if (!options.dryRun) {
    await configManager.backup();
  }

  // Collect results for aligned output
  const results: Array<{ name: string; ok: boolean; detail: string }> = [];
  const mcpCount = Object.keys(resources.mcps || {}).length;
  const agentCount = Object.keys(resources.agents || {}).length;
  const skillCount = Object.keys(resources.skills || {}).length;

  const snapshots = new Map<string, any>();
  if (!options.dryRun) {
    const snapshotResults = await Promise.all(
      enabledClients.map(async ({ id, adapter }) => {
        try {
          const snapshot = await adapter.read();
          return { id, adapter, success: true as const, snapshot };
        } catch (err: any) {
          return { id, adapter, success: false as const, error: err };
        }
      })
    );

    for (const result of snapshotResults) {
      if (result.success) {
        snapshots.set(result.id, {
          mcps: result.snapshot?.mcps || {},
          agents: result.snapshot?.agents || {},
          skills: result.snapshot?.skills || {},
          permissions: result.snapshot?.permissions,
          models: result.snapshot?.models,
          prompts: result.snapshot?.prompts,
          credentials: result.snapshot?.credentials,
        });
      } else {
        ui.warn(`Snapshot failed for ${result.adapter.name}: ${result.error?.message || "unknown error"}. Rollback for this client will be unavailable.`);
      }
    }
  }

  const syncedClients: Array<{ id: string; name: string; adapter: any }> = [];
  let writeFailed = false;

  for (const { id, adapter } of enabledClients) {

    if (options.dryRun) {
      ui.dryRun(`Would write to ${adapter.name}`);
      results.push({ name: adapter.name, ok: true, detail: "dry run" });
    } else {
      const spin = ui.spinner(`Syncing to ${adapter.name}...`);
      try {
        await adapter.write(resources);
        syncedClients.push({ id, name: adapter.name, adapter });
        const parts: string[] = [];
        if (mcpCount > 0) parts.push(`${mcpCount} MCP${mcpCount !== 1 ? "s" : ""}`);
        if (agentCount > 0) parts.push(`${agentCount} agent${agentCount !== 1 ? "s" : ""}`);
        if (skillCount > 0) parts.push(`${skillCount} skill${skillCount !== 1 ? "s" : ""}`);
        const detail = parts.length > 0 ? parts.join("  ") + "  synced" : "synced";
        spin.succeed(`${adapter.name.padEnd(20)} ${detail}`);
        results.push({ name: adapter.name, ok: true, detail });
      } catch (e: any) {
        spin.fail(`${adapter.name.padEnd(20)} failed: ${e.message}`);
        results.push({ name: adapter.name, ok: false, detail: e.message });
        writeFailed = true;

        if (syncedClients.length > 0) {
          ui.warn(`Write failed on ${adapter.name}. Starting rollback for ${syncedClients.length} client${syncedClients.length !== 1 ? "s" : ""}...`);
        }

        let rollbackSucceeded = 0;
        let rollbackFailed = 0;

        for (const client of [...syncedClients].reverse()) {
          const snapshot = snapshots.get(client.id);
          if (!snapshot) {
            rollbackFailed++;
            ui.error(`Rollback failed for ${client.name}: snapshot unavailable`);
            continue;
          }

          try {
            await client.adapter.write(snapshot);
            rollbackSucceeded++;
          } catch (rollbackError: any) {
            rollbackFailed++;
            ui.error(`Rollback failed for ${client.name}: ${rollbackError.message}`);
          }
        }

        if (syncedClients.length > 0) {
          ui.warn(`Rollback complete: ${rollbackSucceeded} succeeded, ${rollbackFailed} failed`);
        }
        break;
      }
    }
  }

  if (writeFailed) {
    process.exitCode = 1;
  }

  const successCount = results.filter(r => r.ok).length;
  const failCount = results.filter(r => !r.ok).length;
  const summaryParts: string[] = [`${successCount} client${successCount !== 1 ? "s" : ""} synced`];
  if (failCount > 0) summaryParts.push(`${failCount} failed`);

  if (writeFailed) {
    ui.header("Sync failed");
  } else {
    ui.header("Sync complete!");
  }
  console.log(ui.format.summary(timer.elapsed(), summaryParts.join(", ")));
}

export async function memorySyncCommand(options: { source?: string, dryRun?: boolean }) {
  const timer = ui.startTimer();
  const configManager = getConfigManager();

  const config = await configManager.read();
  console.log(ui.format.brandHeader(getVersion(), config.activeProfile));
  ui.header("Starting memory files sync...");

  const cwd = process.cwd();

  let sourceId = options.source || config.source;
  let sourceAdapter = sourceId ? adapters[sourceId] : undefined;

  if (!sourceAdapter) {
    ui.error(`Source client "${sourceId || "(none)"}" not found. Run "synctax init" to set a valid source.`);
    process.exitCode = 1;
    return;
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

  for (const [id, clientConf] of Object.entries(config.clients)) {
    if (!clientConf.enabled || id === sourceId) continue;

    const adapter = adapters[id];
    if (!adapter) continue;

    const targetFileName = adapter.getMemoryFileName();
    if (options.dryRun) {
      ui.dryRun(`Would sync ${sourceFileName} -> ${targetFileName}`);
      succeeded++;
    } else {
      try {
        await adapter.writeMemory(cwd, sourceContent);
        ui.success(`Synced to ${targetFileName}`);
        succeeded++;
      } catch (e: any) {
        ui.error(`Failed to sync to ${targetFileName}: ${e.message}`);
        failed++;
      }
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

  console.log(ui.format.summary(timer.elapsed(), `${succeeded} target${succeeded !== 1 ? "s" : ""} updated`));
}

export async function watchCommand(options: any) {
  const configManager = getConfigManager();
  const fs = await import("fs/promises");
  const path = await import("path");
  const os = await import("os");
  const chokidar = await import("chokidar");

  const homeDir = process.env.SYNCTAX_HOME || os.homedir();
  const configPath = path.join(homeDir, ".synctax", "config.json");

  console.log(chalk.magenta("\n\uD83D\uDC41\uFE0F  Initializing synctax Watch Daemon..."));
  ui.dim(`Watching: ${configPath}`);

  const scheduler = createWatchSyncScheduler(async () => {
    ui.header("Triggering background sync...");
    await syncCommand({ dryRun: false, yes: true });
  }, 500);

  const watcher = chokidar.watch(configPath, {
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    }
  }).on("change", async () => {
    console.log(ui.format.warn(`[${new Date().toLocaleTimeString()}] Master config modified.`, { prefix: "" }));
    scheduler.schedule();
  });

  ui.success("Daemon is active. Press Ctrl+C to exit.\n");

  const close = watcher.close.bind(watcher);
  watcher.close = async () => {
    scheduler.dispose();
    return close();
  };

  return watcher;
}

export function createWatchSyncScheduler(
  runSync: () => Promise<void>,
  debounceMs: number,
): {
  schedule: () => void;
  dispose: () => void;
} {
  let syncTimeout: ReturnType<typeof setTimeout> | undefined;
  let inFlight = false;
  let queued = false;
  let disposed = false;

  const run = async () => {
    if (disposed) return;

    if (inFlight) {
      queued = true;
      return;
    }

    inFlight = true;
    try {
      await runSync();
    } catch (e: any) {
      ui.error(`Watch sync failed: ${e?.message || String(e)}`);
    } finally {
      inFlight = false;
      if (queued && !disposed) {
        queued = false;
        await run();
      }
    }
  };

  return {
    schedule() {
      if (disposed) return;
      if (syncTimeout) {
        clearTimeout(syncTimeout);
      }
      syncTimeout = setTimeout(() => {
        void run();
      }, debounceMs);
    },
    dispose() {
      disposed = true;
      if (syncTimeout) {
        clearTimeout(syncTimeout);
      }
      syncTimeout = undefined;
      queued = false;
    },
  };
}
