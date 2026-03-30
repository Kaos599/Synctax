import { checkbox } from "@inquirer/prompts";
import * as ui from "../ui/index.js";
import { adapters } from "../adapters/index.js";
import { getConfigManager } from "./_shared.js";
import { getVersion } from "../version.js";
import { discoverBackupFilesForAdapter } from "../backup/discovery.js";
import { writeBackupsByLayout, writeRollupManifest } from "../backup/archive.js";
import type { BackupLayout } from "../backup/types.js";
import { requireInteractiveTTY } from "./_terminal.js";

type BackupCommandOptions = {
  client?: string[] | string;
  interactive?: boolean;
  layout?: BackupLayout;
  output?: string;
  rollup?: boolean;
};

function toClientList(value?: string[] | string): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function timestampForFile(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function defaultBundlePath(): string {
  return `${process.cwd()}/synctax-backup-${timestampForFile()}.zip`;
}

function defaultPerClientDir(): string {
  return `${process.cwd()}/synctax-backup-${timestampForFile()}`;
}

export async function backupCommand(options: BackupCommandOptions = {}) {
  const timer = ui.startTimer();
  const configManager = getConfigManager();
  const config = await configManager.read();

  console.log(ui.format.brandHeader(getVersion(), config.activeProfile));
  ui.header("Creating native client backups...");

  const enabledIds = Object.keys(config.clients || {})
    .filter((id) => config.clients[id]?.enabled && adapters[id])
    .sort((a, b) => a.localeCompare(b));

  if (enabledIds.length === 0) {
    ui.warn("No enabled clients available for backup.");
    return {
      layout: options.layout || "bundle",
      selectedClientIds: [],
      clientResults: [],
      artifacts: [],
      createdAt: new Date().toISOString(),
    };
  }

  let selectedIds = toClientList(options.client);

  if (options.interactive) {
    if (!requireInteractiveTTY("backup --interactive")) {
      return {
        layout: options.layout || "bundle",
        selectedClientIds: [],
        clientResults: [],
        artifacts: [],
        createdAt: new Date().toISOString(),
      };
    }

    selectedIds = await checkbox({
      message: "Select clients to back up:",
      choices: enabledIds.map((id) => ({
        name: adapters[id]?.name || id,
        value: id,
        checked: true,
      })),
    });
  }

  if (selectedIds.length === 0) {
    selectedIds = enabledIds;
  }

  const uniqueSelected = [...new Set(selectedIds)].filter((id) => enabledIds.includes(id));
  const layout: BackupLayout = options.layout === "per-client" ? "per-client" : "bundle";
  const outputPath = options.output || (layout === "bundle" ? defaultBundlePath() : defaultPerClientDir());

  const clientInputs: Array<{
    id: string;
    name: string;
    warnings: string[];
    files: Array<{ scope: "global" | "user" | "project" | "local"; kind: any; path: string }>;
  }> = [];

  for (const id of uniqueSelected) {
    const adapter = adapters[id];
    if (!adapter) continue;
    const discovery = await discoverBackupFilesForAdapter(adapter, id, process.cwd());
    clientInputs.push({
      id,
      name: adapter.name,
      warnings: [...discovery.warnings],
      files: discovery.files.map((f) => ({ scope: f.scope, kind: f.kind, path: f.path })),
    });
  }

  const createdAt = new Date().toISOString();
  const result = await writeBackupsByLayout({
    layout,
    outputPath,
    createdAt,
    clients: clientInputs,
  });

  if (options.rollup) {
    const rollupPath = layout === "bundle"
      ? `${outputPath}.rollup.json`
      : `${outputPath}/rollup.json`;
    await writeRollupManifest(rollupPath, result);
  }

  for (const client of result.clientResults) {
    if (client.status === "success") {
      ui.success(`${client.clientId}: ${client.fileCount} files backed up`);
    } else if (client.status === "partial") {
      ui.warn(`${client.clientId}: partial backup (${client.warnings.length} warning${client.warnings.length === 1 ? "" : "s"})`);
    } else {
      ui.warn(`${client.clientId}: ${client.status}`);
    }
  }

  if (layout === "bundle") {
    const bundleArtifact = result.artifacts.find((artifact) => artifact.kind === "bundle");
    ui.success(`Bundle created: ${bundleArtifact?.path || outputPath}`);
  } else {
    ui.success(`Per-client backups created in: ${outputPath}`);
  }

  const partialOrFailed = result.clientResults.some((r) => r.status === "partial" || r.status === "failed");
  if (partialOrFailed) {
    process.exitCode = 1;
  }

  console.log(ui.format.summary(timer.elapsed(), `${result.clientResults.length} client${result.clientResults.length === 1 ? "" : "s"} processed`));
  return result;
}
