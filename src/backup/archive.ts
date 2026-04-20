import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { strToU8, zipSync } from "fflate";
import type {
  BackupLayout,
  BackupRunResult,
  ClientBackupManifest,
  ClientBackupResult,
  ClientManifestFileEntry,
} from "./types.js";

function toArchiveSafePath(absPath: string): string {
  const normalized = path.resolve(absPath).split(path.sep).join("/");
  return normalized.replace(/^[A-Za-z]:/, "");
}

function sha256(input: Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

async function writeFileAtomic(targetPath: string, data: Uint8Array | Buffer | string): Promise<void> {
  const tempPath = `${targetPath}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await fs.writeFile(tempPath, data, { mode: 0o600 });
  await fs.rename(tempPath, targetPath);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function splitExtension(filePath: string): { dir: string; base: string; ext: string } {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  return { dir, base, ext };
}

async function nextAvailablePath(preferredPath: string): Promise<string> {
  if (!(await pathExists(preferredPath))) {
    return preferredPath;
  }

  const { dir, base, ext } = splitExtension(preferredPath);
  let index = 1;
  while (true) {
    const candidate = path.join(dir, `${base}-${index}${ext}`);
    if (!(await pathExists(candidate))) {
      return candidate;
    }
    index += 1;
  }
}

function buildClientManifest(
  createdAt: string,
  client: { id: string; name: string },
  status: ClientBackupResult["status"],
  files: ClientManifestFileEntry[],
  warnings: string[]
): ClientBackupManifest {
  const byteCount = files.reduce((sum, f) => sum + f.size, 0);
  return {
    manifestVersion: 1,
    kind: "synctax-client-backup",
    client,
    createdAt,
    status,
    files,
    totals: {
      fileCount: files.length,
      byteCount,
    },
    warnings,
  };
}

export async function writeBackupBundle(params: {
  outputPath: string;
  createdAt: string;
  clients: Array<{
    id: string;
    name: string;
    warnings: string[];
    files: Array<{ scope: ClientManifestFileEntry["scope"]; kind: ClientManifestFileEntry["kind"]; path: string }>;
  }>;
}): Promise<BackupRunResult> {
  const entries: Record<string, Uint8Array> = {};
  const clientResults: ClientBackupResult[] = [];

  for (const client of params.clients) {
    const manifestFiles: ClientManifestFileEntry[] = [];

    for (const file of client.files) {
      let raw: Uint8Array;
      try {
        raw = new Uint8Array(await fs.readFile(file.path));
      } catch {
        client.warnings.push(`Unreadable file skipped: ${file.path}`);
        continue;
      }

      const archivePath = `clients/${client.id}/files/${file.scope}${toArchiveSafePath(file.path)}`;
      entries[archivePath] = raw;

      manifestFiles.push({
        scope: file.scope,
        kind: file.kind,
        sourceAbsPath: path.resolve(file.path),
        archivePath,
        size: raw.byteLength,
        sha256: sha256(raw),
      });
    }

    const status = manifestFiles.length === 0
      ? (client.warnings.length > 0 ? "partial" : "skipped")
      : (client.warnings.length > 0 ? "partial" : "success");

    const manifest = buildClientManifest(
      params.createdAt,
      { id: client.id, name: client.name },
      status,
      manifestFiles,
      client.warnings,
    );

    const clientManifestPath = `clients/${client.id}/manifest.json`;
    entries[clientManifestPath] = strToU8(JSON.stringify(manifest, null, 2));

    clientResults.push({
      clientId: client.id,
      clientName: client.name,
      status,
      warnings: client.warnings,
      fileCount: manifest.totals.fileCount,
      byteCount: manifest.totals.byteCount,
      manifest,
    });
  }

  const rootManifest = {
    manifestVersion: 1,
    kind: "synctax-backup-bundle",
    createdAt: params.createdAt,
    selectedClients: params.clients.map((c) => c.id),
    results: clientResults.map((r) => ({
      clientId: r.clientId,
      status: r.status,
      fileCount: r.fileCount,
      byteCount: r.byteCount,
      warnings: r.warnings,
    })),
    totals: {
      clients: clientResults.length,
      success: clientResults.filter((r) => r.status === "success").length,
      partial: clientResults.filter((r) => r.status === "partial").length,
      skipped: clientResults.filter((r) => r.status === "skipped").length,
      failed: clientResults.filter((r) => r.status === "failed").length,
    },
  };

  entries["manifest.json"] = strToU8(JSON.stringify(rootManifest, null, 2));

  const zipped = zipSync(entries, { level: 6 });
  await fs.mkdir(path.dirname(params.outputPath), { recursive: true });
  const outputPath = await nextAvailablePath(params.outputPath);
  await writeFileAtomic(outputPath, Buffer.from(zipped));

  for (const result of clientResults) {
    result.archivePath = outputPath;
  }

  const bundleSha = sha256(zipped);

  return {
    layout: "bundle",
    selectedClientIds: params.clients.map((c) => c.id),
    createdAt: params.createdAt,
    artifacts: [{ kind: "bundle", path: outputPath, sha256: bundleSha }],
    clientResults,
  };
}

export async function writePerClientBackups(params: {
  outputDir: string;
  createdAt: string;
  clients: Array<{
    id: string;
    name: string;
    warnings: string[];
    files: Array<{ scope: ClientManifestFileEntry["scope"]; kind: ClientManifestFileEntry["kind"]; path: string }>;
  }>;
}): Promise<BackupRunResult> {
  const artifacts: BackupRunResult["artifacts"] = [];
  const clientResults: ClientBackupResult[] = [];

  for (const client of params.clients) {
    const entries: Record<string, Uint8Array> = {};
    const manifestFiles: ClientManifestFileEntry[] = [];

    for (const file of client.files) {
      let raw: Uint8Array;
      try {
        raw = new Uint8Array(await fs.readFile(file.path));
      } catch {
        client.warnings.push(`Unreadable file skipped: ${file.path}`);
        continue;
      }

      const archivePath = `files/${file.scope}${toArchiveSafePath(file.path)}`;
      entries[archivePath] = raw;

      manifestFiles.push({
        scope: file.scope,
        kind: file.kind,
        sourceAbsPath: path.resolve(file.path),
        archivePath,
        size: raw.byteLength,
        sha256: sha256(raw),
      });
    }

    const status = manifestFiles.length === 0
      ? (client.warnings.length > 0 ? "partial" : "skipped")
      : (client.warnings.length > 0 ? "partial" : "success");

    const manifest = buildClientManifest(
      params.createdAt,
      { id: client.id, name: client.name },
      status,
      manifestFiles,
      client.warnings,
    );

    entries["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));

    const outputPath = await nextAvailablePath(path.join(params.outputDir, `${client.id}-backup.zip`));
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const zipped = zipSync(entries, { level: 6 });
    await writeFileAtomic(outputPath, Buffer.from(zipped));

    artifacts.push({ kind: "client", path: outputPath, sha256: sha256(zipped) });
    clientResults.push({
      clientId: client.id,
      clientName: client.name,
      status,
      warnings: client.warnings,
      fileCount: manifest.totals.fileCount,
      byteCount: manifest.totals.byteCount,
      archivePath: outputPath,
      manifest,
    });
  }

  return {
    layout: "per-client",
    selectedClientIds: params.clients.map((c) => c.id),
    createdAt: params.createdAt,
    artifacts,
    clientResults,
  };
}

export async function writeRollupManifest(
  outputPath: string,
  runResult: BackupRunResult,
): Promise<void> {
  const payload = {
    manifestVersion: 1,
    kind: "synctax-backup-rollup",
    createdAt: runResult.createdAt,
    layout: runResult.layout,
    selectedClientIds: runResult.selectedClientIds,
    artifacts: runResult.artifacts,
    results: runResult.clientResults.map((r) => ({
      clientId: r.clientId,
      status: r.status,
      fileCount: r.fileCount,
      byteCount: r.byteCount,
      archivePath: r.archivePath,
      warnings: r.warnings,
    })),
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const finalPath = await nextAvailablePath(outputPath);
  const serialized = JSON.stringify(payload, null, 2);
  await writeFileAtomic(finalPath, serialized);

  const rollupSha = sha256(strToU8(serialized));
  runResult.artifacts.push({ kind: "rollup", path: finalPath, sha256: rollupSha });
}

export async function writeBackupsByLayout(params: {
  layout: BackupLayout;
  outputPath: string;
  createdAt: string;
  clients: Array<{
    id: string;
    name: string;
    warnings: string[];
    files: Array<{ scope: ClientManifestFileEntry["scope"]; kind: ClientManifestFileEntry["kind"]; path: string }>;
  }>;
}): Promise<BackupRunResult> {
  if (params.layout === "per-client") {
    return writePerClientBackups({
      outputDir: params.outputPath,
      createdAt: params.createdAt,
      clients: params.clients,
    });
  }

  return writeBackupBundle({
    outputPath: params.outputPath,
    createdAt: params.createdAt,
    clients: params.clients,
  });
}
