import type { ConfigScope } from "../platform-paths.js";

export type BackupLayout = "bundle" | "per-client";

export type BackupKind =
  | "config"
  | "settings"
  | "mcp"
  | "agents-dir"
  | "agent-file"
  | "skills-dir"
  | "skill-file"
  | "commands-dir"
  | "command-file"
  | "memory-file"
  | "rules-dir"
  | "other";

export type BackupStatus = "success" | "partial" | "failed" | "skipped";

export interface BackupPathCandidate {
  clientId: string;
  scope: ConfigScope;
  path: string;
  kind: BackupKind;
  label: string;
}

export interface BackupDiscoveredFile {
  clientId: string;
  scope: ConfigScope;
  path: string;
  kind: BackupKind;
  sourceLabel: string;
}

export interface ClientDiscoveryResult {
  clientId: string;
  files: BackupDiscoveredFile[];
  warnings: string[];
}

export interface ClientManifestFileEntry {
  scope: ConfigScope;
  kind: BackupKind;
  sourceAbsPath: string;
  archivePath: string;
  size: number;
  sha256: string;
}

export interface ClientBackupManifest {
  manifestVersion: number;
  kind: "synctax-client-backup";
  client: { id: string; name: string };
  createdAt: string;
  status: BackupStatus;
  files: ClientManifestFileEntry[];
  totals: {
    fileCount: number;
    byteCount: number;
  };
  warnings: string[];
}

export interface ClientBackupResult {
  clientId: string;
  clientName: string;
  status: BackupStatus;
  warnings: string[];
  fileCount: number;
  byteCount: number;
  archivePath?: string;
  manifest: ClientBackupManifest;
}

export interface BackupArtifact {
  kind: "bundle" | "client" | "rollup";
  path: string;
  sha256?: string;
}

export interface BackupRunResult {
  layout: BackupLayout;
  selectedClientIds: string[];
  artifacts: BackupArtifact[];
  clientResults: ClientBackupResult[];
  createdAt: string;
}
