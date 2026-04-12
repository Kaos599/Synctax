import fs from "fs/promises";
import path from "path";
import type { ClientAdapter } from "../types.js";
import {
  antigravityConfigCandidates,
  homeDir,
  opencodeConfigCandidates,
  vscodeUserMcpJsonCandidates,
  vscodeUserSettingsCandidates,
  zedSettingsCandidates,
} from "../platform-paths.js";
import type { BackupDiscoveredFile, BackupPathCandidate, ClientDiscoveryResult } from "./types.js";

function normalizePathForSort(input: string): string {
  const normalized = path.resolve(input).split(path.sep).join("/");
  if (process.platform === "win32") return normalized.toLowerCase();
  return normalized;
}

const scopeRank: Record<"global" | "user" | "project" | "local", number> = {
  global: 0,
  user: 1,
  project: 2,
  local: 3,
};

function sortCandidates(a: BackupPathCandidate, b: BackupPathCandidate): number {
  const rankDiff = scopeRank[a.scope] - scopeRank[b.scope];
  if (rankDiff !== 0) return rankDiff;
  return normalizePathForSort(a.path).localeCompare(normalizePathForSort(b.path));
}

function uniqueCandidates(candidates: BackupPathCandidate[]): BackupPathCandidate[] {
  const seen = new Set<string>();
  const out: BackupPathCandidate[] = [];
  for (const c of candidates) {
    const key = `${c.clientId}::${normalizePathForSort(c.path)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out.sort(sortCandidates);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walkDirFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const stack = [dir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    let entries: string[] = [];
    try {
      entries = await fs.readdir(current);
    } catch {
      continue;
    }

    entries.sort((a, b) => a.localeCompare(b));
    for (const entry of entries) {
      const fullPath = path.join(current, entry);
      let stat;
      try {
        stat = await fs.lstat(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        stack.push(fullPath);
      } else if (stat.isSymbolicLink()) {
        try {
          const linked = await fs.stat(fullPath);
          if (linked.isDirectory()) {
            stack.push(fullPath);
          } else if (linked.isFile()) {
            files.push(fullPath);
          }
        } catch {
          continue;
        }
      } else if (stat.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files.sort((a, b) => normalizePathForSort(a).localeCompare(normalizePathForSort(b)));
}

function pushFile(candidates: BackupPathCandidate[], candidate: BackupPathCandidate): void {
  candidates.push(candidate);
}

function pushDir(candidates: BackupPathCandidate[], clientId: string, scope: BackupPathCandidate["scope"], dirPath: string, kind: BackupPathCandidate["kind"], label: string): void {
  candidates.push({
    clientId,
    scope,
    path: dirPath,
    kind,
    label,
  });
}

function buildCandidatesForAdapter(adapter: ClientAdapter, clientId: string, projectDir: string): BackupPathCandidate[] {
  const candidates: BackupPathCandidate[] = [];
  const h = homeDir();

  if (clientId === "claude") {
    pushFile(candidates, { clientId, scope: "user", path: path.join(h, ".claude", "settings.json"), kind: "settings", label: "claude user settings" });
    pushFile(candidates, { clientId, scope: "user", path: path.join(h, ".claude.json"), kind: "mcp", label: "claude user mcp" });
    pushFile(candidates, { clientId, scope: "project", path: path.join(projectDir, ".mcp.json"), kind: "mcp", label: "claude project mcp" });
    pushFile(candidates, { clientId, scope: "project", path: path.join(projectDir, ".claude", "settings.json"), kind: "settings", label: "claude project settings" });
    pushFile(candidates, { clientId, scope: "local", path: path.join(projectDir, ".claude", "settings.local.json"), kind: "settings", label: "claude local settings" });
    pushDir(candidates, clientId, "user", path.join(h, ".claude", "agents"), "agents-dir", "claude user agents dir");
    pushDir(candidates, clientId, "project", path.join(projectDir, ".claude", "agents"), "agents-dir", "claude project agents dir");
    pushDir(candidates, clientId, "user", path.join(h, ".claude", "skills"), "skills-dir", "claude user skills dir");
    pushDir(candidates, clientId, "project", path.join(projectDir, ".claude", "skills"), "skills-dir", "claude project skills dir");
  } else if (clientId === "cursor") {
    pushFile(candidates, { clientId, scope: "global", path: path.join(h, ".cursor", "mcp.json"), kind: "mcp", label: "cursor global mcp" });
    pushFile(candidates, { clientId, scope: "project", path: path.join(projectDir, ".cursor", "mcp.json"), kind: "mcp", label: "cursor project mcp" });
    pushFile(candidates, { clientId, scope: "global", path: path.join(h, ".cursor", "modes.json"), kind: "settings", label: "cursor modes" });
    pushDir(candidates, clientId, "global", path.join(h, ".cursor", "commands"), "commands-dir", "cursor commands dir");
    pushDir(candidates, clientId, "global", path.join(h, ".cursor", "skills"), "skills-dir", "cursor user skills dir");
    pushDir(candidates, clientId, "project", path.join(projectDir, ".cursor", "skills"), "skills-dir", "cursor project skills dir");
  } else if (clientId === "opencode") {
    for (const candidate of opencodeConfigCandidates(h)) {
      pushFile(candidates, { clientId, scope: candidate.scope, path: candidate.path, kind: "config", label: candidate.label });
    }
    pushDir(candidates, clientId, "project", path.join(projectDir, ".opencode", "skills"), "skills-dir", "opencode project skills dir");
    pushDir(candidates, clientId, "project", path.join(projectDir, ".claude", "skills"), "skills-dir", "opencode project claude skills dir");
    pushDir(candidates, clientId, "project", path.join(projectDir, ".agents", "skills"), "skills-dir", "opencode project agents skills dir");
    pushDir(candidates, clientId, "user", path.join(h, ".config", "opencode", "skills"), "skills-dir", "opencode user skills dir");
    pushDir(candidates, clientId, "user", path.join(h, ".claude", "skills"), "skills-dir", "opencode user claude skills dir");
    pushDir(candidates, clientId, "user", path.join(h, ".agents", "skills"), "skills-dir", "opencode user agents skills dir");
  } else if (clientId === "cline") {
    pushFile(candidates, { clientId, scope: "global", path: path.join(h, ".cline", "mcp_settings.json"), kind: "mcp", label: "cline global mcp settings" });
    pushFile(candidates, { clientId, scope: "user", path: path.join(h, ".cline", "data", "settings", "cline_mcp_settings.json"), kind: "mcp", label: "cline package mcp settings" });
    pushFile(candidates, { clientId, scope: "global", path: path.join(h, ".cline", "config.json"), kind: "config", label: "cline global config" });
    pushFile(candidates, { clientId, scope: "project", path: path.join(projectDir, ".cline", "cline_mcp_settings.json"), kind: "mcp", label: "cline project mcp settings" });
    pushFile(candidates, { clientId, scope: "project", path: path.join(projectDir, ".cline", "config.json"), kind: "config", label: "cline project config" });
  } else if (clientId === "antigravity") {
    for (const candidate of antigravityConfigCandidates(h)) {
      pushFile(candidates, { clientId, scope: candidate.scope, path: candidate.path, kind: "config", label: candidate.label });
    }
    pushFile(candidates, { clientId, scope: "project", path: path.join(projectDir, "GEMINI.md"), kind: "agent-file", label: "antigravity project GEMINI" });
    pushFile(candidates, { clientId, scope: "project", path: path.join(projectDir, "AGENTS.md"), kind: "agent-file", label: "antigravity project AGENTS" });
    pushDir(candidates, clientId, "project", path.join(projectDir, ".agent", "rules"), "rules-dir", "antigravity rules dir");
    pushDir(candidates, clientId, "user", path.join(h, ".gemini", "antigravity", "skills"), "skills-dir", "antigravity user skills dir");
    pushDir(candidates, clientId, "project", path.join(projectDir, ".agents", "skills"), "skills-dir", "antigravity project skills dir");
  } else if (clientId === "zed") {
    for (const candidate of zedSettingsCandidates(h)) {
      pushFile(candidates, { clientId, scope: "user", path: candidate, kind: "settings", label: "zed settings" });
    }
  } else if (clientId === "github-copilot") {
    for (const candidate of vscodeUserSettingsCandidates(h, projectDir)) {
      pushFile(candidates, { clientId, scope: candidate.scope, path: candidate.path, kind: "settings", label: candidate.label });
    }
    for (const candidate of vscodeUserMcpJsonCandidates(h, projectDir)) {
      pushFile(candidates, { clientId, scope: candidate.scope, path: candidate.path, kind: "mcp", label: candidate.label });
    }
    pushDir(candidates, clientId, "project", path.join(projectDir, ".github", "agents"), "agents-dir", "copilot project agents dir");
    pushDir(candidates, clientId, "project", path.join(projectDir, ".github", "skills"), "skills-dir", "copilot project skills dir");
  } else if (clientId === "github-copilot-cli") {
    pushFile(candidates, { clientId, scope: "user", path: path.join(h, ".copilot", "config.json"), kind: "config", label: "copilot-cli user config" });
    pushFile(candidates, { clientId, scope: "project", path: path.join(projectDir, ".github", "copilot", "settings.json"), kind: "config", label: "copilot-cli project settings" });
    pushFile(candidates, { clientId, scope: "user", path: path.join(h, ".copilot", "mcp-config.json"), kind: "mcp", label: "copilot-cli mcp config" });
    pushDir(candidates, clientId, "user", path.join(h, ".copilot", "agents"), "agents-dir", "copilot-cli user agents dir");
    pushDir(candidates, clientId, "project", path.join(projectDir, ".github", "agents"), "agents-dir", "copilot-cli project agents dir");
    pushDir(candidates, clientId, "user", path.join(h, ".copilot", "skills"), "skills-dir", "copilot-cli user skills dir");
    pushDir(candidates, clientId, "project", path.join(projectDir, ".github", "skills"), "skills-dir", "copilot-cli project skills dir");
  } else if (clientId === "gemini-cli") {
    pushFile(candidates, { clientId, scope: "project", path: path.join(projectDir, ".gemini", "settings.json"), kind: "settings", label: "gemini project settings" });
    pushFile(candidates, { clientId, scope: "user", path: path.join(h, ".gemini", "settings.json"), kind: "settings", label: "gemini user settings" });
    pushFile(candidates, { clientId, scope: "user", path: path.join(h, ".config", "gemini", "config.json"), kind: "config", label: "gemini legacy xdg config" });
    pushFile(candidates, { clientId, scope: "user", path: path.join(h, ".gemini", "config.json"), kind: "config", label: "gemini legacy root config" });
  }

  const memoryFilePath = path.join(projectDir, adapter.getMemoryFileName());
  pushFile(candidates, { clientId, scope: "project", path: memoryFilePath, kind: "memory-file", label: `${clientId} memory file` });

  return uniqueCandidates(candidates);
}

export async function discoverBackupFilesForAdapter(
  adapter: ClientAdapter,
  clientId: string,
  projectDir: string
): Promise<ClientDiscoveryResult> {
  const candidates = buildCandidatesForAdapter(adapter, clientId, projectDir);
  const files: BackupDiscoveredFile[] = [];
  const warnings: string[] = [];

  for (const candidate of candidates) {
    if (!(await pathExists(candidate.path))) {
      warnings.push(`Missing path (${candidate.scope}): ${candidate.path}`);
      continue;
    }

    let stat;
    try {
      stat = await fs.lstat(candidate.path);
    } catch {
      warnings.push(`Unreadable path (${candidate.scope}): ${candidate.path}`);
      continue;
    }

    let isDirectory = stat.isDirectory();
    let isFile = stat.isFile();
    if (stat.isSymbolicLink()) {
      try {
        const linked = await fs.stat(candidate.path);
        isDirectory = linked.isDirectory();
        isFile = linked.isFile();
      } catch {
        warnings.push(`Broken symlink (${candidate.scope}): ${candidate.path}`);
        continue;
      }
    }

    if (isDirectory) {
      const nested = await walkDirFiles(candidate.path);
      if (nested.length === 0) {
        warnings.push(`Empty directory (${candidate.scope}): ${candidate.path}`);
      }
      for (const filePath of nested) {
        files.push({
          clientId,
          scope: candidate.scope,
          path: filePath,
          kind: candidate.kind,
          sourceLabel: candidate.label,
        });
      }
      continue;
    }

    if (!isFile) {
      warnings.push(`Unsupported filesystem entry (${candidate.scope}): ${candidate.path}`);
      continue;
    }

    files.push({
      clientId,
      scope: candidate.scope,
      path: candidate.path,
      kind: candidate.kind,
      sourceLabel: candidate.label,
    });
  }

  files.sort((a, b) => {
    const rankDiff = scopeRank[a.scope] - scopeRank[b.scope];
    if (rankDiff !== 0) return rankDiff;
    return normalizePathForSort(a.path).localeCompare(normalizePathForSort(b.path));
  });

  return {
    clientId,
    files,
    warnings,
  };
}
