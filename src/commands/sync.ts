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
import { mapWithConcurrency } from "../utils/async-pool.js";
import { resolveClientId } from "../client-id.js";

const TOTAL_SYNC_STAGES = 6;
const ANALYZE_CONCURRENCY = 4;
const WRITE_CONCURRENCY = 3;
const ROLLBACK_CONCURRENCY = 3;

type EnabledClient = { id: string; adapter: any };
type ClientSnapshot = {
  mcps: Record<string, unknown>;
  agents: Record<string, unknown>;
  skills: Record<string, unknown>;
  permissions?: unknown;
  models?: unknown;
  prompts?: unknown;
  credentials?: unknown;
};

type AnalyzeResult = {
  id: string;
  adapter: any;
  snapshot?: ClientSnapshot;
  diff?: ClientDiff;
  error?: string;
  elapsedMs?: number;
};

type WriteResult = {
  id: string;
  name: string;
  ok: boolean;
  detail: string;
  elapsedMs?: number;
};

function stageLabel(stage: number, title: string): string {
  return `Stage ${stage}/${TOTAL_SYNC_STAGES} ${title}`;
}

function formatMs(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function toSnapshot(data: any): ClientSnapshot {
  return {
    mcps: data?.mcps || {},
    agents: data?.agents || {},
    skills: data?.skills || {},
    permissions: data?.permissions,
    models: data?.models,
    prompts: data?.prompts,
    credentials: data?.credentials,
  };
}

function createPhaseReporter(stage: number, title: string, total: number) {
  let done = 0;
  let running = 0;
  let failed = 0;
  const interactive = ui.isInteractive();
  const phaseStartMs = performance.now();

  const text = () => {
    const elapsedMs = performance.now() - phaseStartMs;
    const remaining = Math.max(0, total - done);
    const etaText = done > 0
      ? `${formatMs((elapsedMs / done) * remaining)} remaining`
      : "estimating remaining";
    return `${stageLabel(stage, title)} (${done}/${total} done/total, ${running} running, ${failed} failed, ${etaText})`;
  };
  const spin = ui.spinner(text());

  const update = () => {
    if (interactive) {
      spin.text(text());
      return;
    }
    ui.info(text(), { indent: 1 });
  };

  return {
    startTask() {
      running += 1;
      update();
    },
    finishTask(ok: boolean) {
      running = Math.max(0, running - 1);
      done += 1;
      if (!ok) failed += 1;
      update();
    },
    complete(elapsed: string) {
      const completionText = `${text()} in ${elapsed}`;
      if (interactive) {
        if (failed > 0) {
          spin.warn(completionText);
        } else {
          spin.succeed(completionText);
        }
        return;
      }
      ui.info(completionText, { indent: 1 });
    },
  };
}

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

  const pullStageTimer = ui.startTimer();
  ui.header(stageLabel(1, "Pull source"));

  // Client-first pull: if source is configured, pull from it first.
  const sourceResolution = resolveClientId(config.source);
  const sourceId = sourceResolution?.canonicalId ?? config.source;
  if (sourceResolution?.ambiguousIds && config.source && !adapters[config.source]) {
    ui.warn(`Configured source alias "${config.source}" is ambiguous. Use one of: ${sourceResolution.ambiguousIds.join(", ")}`);
  }
  const sourceAdapter = sourceId ? adapters[sourceId] : undefined;

  if (sourceAdapter) {
    const spin = ui.spinner(`Pulling from ${sourceAdapter.name}...`);
    try {
      const beforeSourceMerge = JSON.stringify({
        mcps: config.resources.mcps || {},
        agents: config.resources.agents || {},
        skills: config.resources.skills || {},
        permissions: config.resources.permissions,
        models: config.resources.models,
        prompts: config.resources.prompts,
      });
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
      if (sourceData.models) {
        config.resources.models = { ...config.resources.models, ...sourceData.models };
      }
      if (sourceData.prompts) {
        config.resources.prompts = { ...config.resources.prompts, ...sourceData.prompts };
      }
      const afterSourceMerge = JSON.stringify({
        mcps: config.resources.mcps || {},
        agents: config.resources.agents || {},
        skills: config.resources.skills || {},
        permissions: config.resources.permissions,
        models: config.resources.models,
        prompts: config.resources.prompts,
      });
      if (beforeSourceMerge !== afterSourceMerge && !options.dryRun) {
        const beforeObj = JSON.parse(beforeSourceMerge);
        const afterObj = JSON.parse(afterSourceMerge);
        const changedDomains: string[] = [];
        for (const domain of ["mcps", "agents", "skills", "permissions", "models", "prompts"] as const) {
          if (JSON.stringify(beforeObj[domain]) !== JSON.stringify(afterObj[domain])) {
            changedDomains.push(domain);
          }
        }
        if (changedDomains.length > 0) {
          ui.warn(`Source pull modified master config: ${changedDomains.join(", ")}`);
        }
        await configManager.write(config);
      }
      spin.succeed(
        beforeSourceMerge === afterSourceMerge
          ? `Pulled from ${sourceAdapter.name} (no changes)`
          : `Pulled from ${sourceAdapter.name}`,
      );
    } catch (e: any) {
      spin.fail(`Pull from ${sourceAdapter.name} failed: ${e.message}`);
      ui.warn("Continuing with current master config.");
    }
  } else {
    ui.dim("No source client configured; using current master config.");
  }
  ui.dim(`${stageLabel(1, "Pull source")} completed in ${pullStageTimer.elapsed()}`, { indent: 1 });

  const resolveStageTimer = ui.startTimer();
  ui.header(stageLabel(2, "Resolve profile/env"));

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
  ui.dim(`${stageLabel(2, "Resolve profile/env")} completed in ${resolveStageTimer.elapsed()}`, { indent: 1 });

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

  // Build enabled clients list (excluding source — it's the authority).
  const enabledClients: EnabledClient[] = [];
  const seenTargetIds = new Set<string>();
  for (const [id, clientConf] of Object.entries(config.clients)) {
    if (!clientConf.enabled) continue;
    const idResolution = resolveClientId(id);
    if (idResolution?.ambiguousIds && !adapters[id]) {
      ui.warn(`Skipping ambiguous client alias "${id}". Use one of: ${idResolution.ambiguousIds.join(", ")}`);
      continue;
    }
    const resolvedId = idResolution?.canonicalId ?? id;
    if (resolvedId === sourceId) continue;
    if (seenTargetIds.has(resolvedId)) continue;
    const adapter = adapters[resolvedId] ?? adapters[id];
    if (!adapter) continue;
    seenTargetIds.add(resolvedId);
    enabledClients.push({ id: resolvedId, adapter });
  }

  const analyzeStageTimer = ui.startTimer();
  ui.header(stageLabel(3, "Analyze clients"));

  const analyzeResults: AnalyzeResult[] = [];
  if (enabledClients.length > 0) {
    const analyzeReporter = createPhaseReporter(3, "Analyze clients", enabledClients.length);
    const analyzed = await mapWithConcurrency(
      enabledClients,
      Math.min(ANALYZE_CONCURRENCY, enabledClients.length),
      async ({ id, adapter }) => {
        const taskTimer = ui.startTimer();
        analyzeReporter.startTask();
        try {
          const data = await adapter.read();
          const snapshot = toSnapshot(data);
          const diff: ClientDiff = {
            id,
            name: adapter.name,
            domains: {
              mcps: compareDomain(resources.mcps || {}, snapshot.mcps || {}),
              agents: compareDomain(resources.agents || {}, snapshot.agents || {}),
              skills: compareDomain(resources.skills || {}, snapshot.skills || {}),
            },
          };
          analyzeReporter.finishTask(true);
          return {
            id,
            adapter,
            snapshot,
            diff,
            elapsedMs: taskTimer.elapsedMs(),
          } satisfies AnalyzeResult;
        } catch (e: any) {
          analyzeReporter.finishTask(false);
          return {
            id,
            adapter,
            error: e?.message || "unknown error",
            elapsedMs: taskTimer.elapsedMs(),
          } satisfies AnalyzeResult;
        }
      },
    );
    analyzeReporter.complete(analyzeStageTimer.elapsed());
    analyzeResults.push(...analyzed);
  } else {
    ui.dim("No enabled target clients to analyze.", { indent: 1 });
    ui.dim(`${stageLabel(3, "Analyze clients")} completed in ${analyzeStageTimer.elapsed()}`, { indent: 1 });
  }

  const snapshots = new Map<string, ClientSnapshot>();
  const clientDiffs: ClientDiff[] = [];
  for (const result of analyzeResults) {
    if (typeof result.elapsedMs === "number") {
      if (result.error) {
        ui.dim(`Analyze ${result.adapter.name} failed in ${formatMs(result.elapsedMs)}`, { indent: 1 });
      } else {
        ui.dim(`Analyze ${result.adapter.name} completed in ${formatMs(result.elapsedMs)}`, { indent: 1 });
      }
    }
    if (result.snapshot) {
      snapshots.set(result.id, result.snapshot);
    }
    if (result.diff) {
      clientDiffs.push(result.diff);
    }
    if (result.error) {
      ui.warn(`Analyze failed for ${result.adapter.name}: ${result.error}. This client will be skipped during write.`);
    }
  }

  const analyzeFailedIds = new Set(analyzeResults.filter((r) => !!r.error).map((r) => r.id));

  if (!options.dryRun && enabledClients.length > 0) {
    const hasChanges = clientDiffs.some(hasDiffChanges);
    const hasAnalyzeFailures = analyzeResults.some((result) => !!result.error);

    if (hasChanges) {
      ui.header("Sync plan:");
      for (const diff of clientDiffs) {
        if (hasDiffChanges(diff)) {
          renderClientDiff(diff);
        }
      }
      console.log("");

      if (!options.yes) {
        const isTTY = process.stdin.isTTY && !process.env.VITEST;
        if (isTTY) {
          ui.dim("Waiting for confirmation. Use --yes to auto-approve in scripts.", { indent: 1 });
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
    } else if (!hasAnalyzeFailures) {
      ui.dim("All clients are already in sync.");
      console.log(ui.format.summary(timer.elapsed(), "0 changes needed"));
      return;
    }
  }

  if (!options.dryRun) {
    const backupStageTimer = ui.startTimer();
    ui.header(stageLabel(4, "Backup"));
    await configManager.backup();
    ui.dim(`${stageLabel(4, "Backup")} completed in ${backupStageTimer.elapsed()}`, { indent: 1 });
  }

  ui.header(stageLabel(5, "Write clients"));
  const writeStageTimer = ui.startTimer();

  const results: WriteResult[] = [];
  const mcpCount = Object.keys(resources.mcps || {}).length;
  const agentCount = Object.keys(resources.agents || {}).length;
  const skillCount = Object.keys(resources.skills || {}).length;

  const writeClients = enabledClients.filter((c) => !analyzeFailedIds.has(c.id));
  for (const skipped of enabledClients.filter((c) => analyzeFailedIds.has(c.id))) {
    ui.warn(`Skipping write for ${skipped.adapter.name}: analyze failed (no safe snapshot).`);
  }

  if (writeClients.length > 0) {
    const writeReporter = createPhaseReporter(5, "Write clients", writeClients.length);
    const writes = await mapWithConcurrency(
      writeClients,
      Math.min(WRITE_CONCURRENCY, enabledClients.length),
      async ({ id, adapter }) => {
        const taskTimer = ui.startTimer();
        writeReporter.startTask();
        if (options.dryRun) {
          writeReporter.finishTask(true);
          return {
            id,
            name: adapter.name,
            ok: true,
            detail: "dry run",
            elapsedMs: taskTimer.elapsedMs(),
          } satisfies WriteResult;
        }

        try {
          await adapter.write(resources);
          const parts: string[] = [];
          if (mcpCount > 0) parts.push(`${mcpCount} MCP${mcpCount !== 1 ? "s" : ""}`);
          if (agentCount > 0) parts.push(`${agentCount} agent${agentCount !== 1 ? "s" : ""}`);
          if (skillCount > 0) parts.push(`${skillCount} skill${skillCount !== 1 ? "s" : ""}`);
          const detail = parts.length > 0 ? `${parts.join("  ")}  synced` : "synced";
          writeReporter.finishTask(true);
          return {
            id,
            name: adapter.name,
            ok: true,
            detail,
            elapsedMs: taskTimer.elapsedMs(),
          } satisfies WriteResult;
        } catch (e: any) {
          writeReporter.finishTask(false);
          return {
            id,
            name: adapter.name,
            ok: false,
            detail: e?.message || "unknown error",
            elapsedMs: taskTimer.elapsedMs(),
          } satisfies WriteResult;
        }
      },
    );
    writeReporter.complete(writeStageTimer.elapsed());
    results.push(...writes);
  } else {
    ui.dim("No enabled target clients to write.", { indent: 1 });
    ui.dim(`${stageLabel(5, "Write clients")} completed in ${writeStageTimer.elapsed()}`, { indent: 1 });
  }

  for (const result of results) {
    if (options.dryRun) {
      ui.dryRun(`Would write to ${result.name}`);
      continue;
    }
    if (result.ok) {
      ui.success(`${result.name.padEnd(20)} ${result.detail}`);
      if (typeof result.elapsedMs === "number") {
        ui.dim(`Write ${result.name} completed in ${formatMs(result.elapsedMs)}`, { indent: 1 });
      }
    } else {
      ui.error(`${result.name.padEnd(20)} failed: ${result.detail}`);
      if (typeof result.elapsedMs === "number") {
        ui.dim(`Write ${result.name} failed in ${formatMs(result.elapsedMs)}`, { indent: 1 });
      }
    }
  }

  let writeFailed = results.some((result) => !result.ok);
  if (writeFailed && !options.dryRun) {
    const successfulClients = enabledClients.filter((client) => {
      const result = results.find((entry) => entry.id === client.id);
      return !!result?.ok;
    });

    if (successfulClients.length > 0) {
      const failedCount = results.reduce((count, result) => (result.ok ? count : count + 1), 0);
      ui.warn(`Write failed on ${failedCount} client${failedCount !== 1 ? "s" : ""}. Starting rollback for ${successfulClients.length} client${successfulClients.length !== 1 ? "s" : ""}...`);
    }

    let rollbackSucceeded = 0;
    let rollbackFailed = 0;

    const rollbackClients = [...successfulClients].reverse();
    const rollbackResults = await mapWithConcurrency(
      rollbackClients,
      Math.min(ROLLBACK_CONCURRENCY, Math.max(1, rollbackClients.length)),
      async (client) => {
        const taskTimer = ui.startTimer();
        const snapshot = snapshots.get(client.id);
        if (!snapshot) {
          return {
            name: client.adapter.name,
            ok: false,
            message: "snapshot unavailable",
            elapsedMs: taskTimer.elapsedMs(),
          };
        }

        try {
          await client.adapter.write(snapshot);
          return {
            name: client.adapter.name,
            ok: true,
            message: "",
            elapsedMs: taskTimer.elapsedMs(),
          };
        } catch (rollbackError: any) {
          return {
            name: client.adapter.name,
            ok: false,
            message: rollbackError?.message || "unknown error",
            elapsedMs: taskTimer.elapsedMs(),
          };
        }
      },
    );

    for (const rollbackResult of rollbackResults) {
      if (rollbackResult.ok) {
        rollbackSucceeded += 1;
        if (typeof rollbackResult.elapsedMs === "number") {
          ui.dim(`Rollback ${rollbackResult.name} completed in ${formatMs(rollbackResult.elapsedMs)}`, { indent: 1 });
        }
      } else {
        rollbackFailed += 1;
        const timing = typeof rollbackResult.elapsedMs === "number"
          ? ` in ${formatMs(rollbackResult.elapsedMs)}`
          : "";
        ui.error(`Rollback failed for ${rollbackResult.name}: ${rollbackResult.message}${timing}`);
      }
    }

    if (successfulClients.length > 0) {
      ui.warn(`Rollback complete: ${rollbackSucceeded} succeeded, ${rollbackFailed} failed`);
    }
  }

  if (writeFailed) {
    process.exitCode = 1;
  }

  const { successCount, failCount } = results.reduce(
    (acc, r) => {
      if (r.ok) acc.successCount++;
      else acc.failCount++;
      return acc;
    },
    { successCount: 0, failCount: 0 }
  );

  const summaryParts: string[] = [`${successCount} client${successCount !== 1 ? "s" : ""} synced`];
  if (failCount > 0) summaryParts.push(`${failCount} failed`);
  const phaseTimings = [
    `pull=${pullStageTimer.elapsed()}`,
    `resolve=${resolveStageTimer.elapsed()}`,
    `analyze=${analyzeStageTimer.elapsed()}`,
    `write=${writeStageTimer.elapsed()}`,
  ];

  ui.header(stageLabel(6, "Finalize"));
  if (writeFailed) {
    ui.header("Sync failed");
  } else {
    ui.header("Sync complete!");
  }
  ui.info(`Phase timings: ${phaseTimings.join(", ")}`, { indent: 1 });
  ui.info(`Client results: success=${successCount} failed=${failCount}`, { indent: 1 });
  console.log(ui.format.summary(timer.elapsed(), summaryParts.join(", ")));
}

export async function memorySyncCommand(options: { source?: string, dryRun?: boolean }) {
  const timer = ui.startTimer();
  const configManager = getConfigManager();

  const config = await configManager.read();
  console.log(ui.format.brandHeader(getVersion(), config.activeProfile));
  ui.header("Starting memory files sync...");

  const cwd = process.cwd();

  const sourceResolution = resolveClientId(options.source || config.source);
  let sourceId = sourceResolution?.canonicalId ?? options.source ?? config.source;
  if (sourceResolution?.ambiguousIds && (options.source || config.source) && !adapters[options.source || config.source || ""]) {
    ui.error(`Ambiguous source alias "${options.source || config.source}". Use one of: ${sourceResolution.ambiguousIds.join(", ")}`);
    process.exitCode = 1;
    return;
  }
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

  const seenTargetIds = new Set<string>();
  for (const [id, clientConf] of Object.entries(config.clients)) {
    if (!clientConf.enabled) continue;
    const idResolution = resolveClientId(id);
    if (idResolution?.ambiguousIds && !adapters[id]) continue;
    const resolvedId = idResolution?.canonicalId ?? id;
    if (resolvedId === sourceId) continue;
    if (seenTargetIds.has(resolvedId)) continue;
    seenTargetIds.add(resolvedId);

    const adapter = adapters[resolvedId] ?? adapters[id];
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

  console.log(chalk.magenta("\n[watch] Initializing synctax Watch Daemon..."));
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
