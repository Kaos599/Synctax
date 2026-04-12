import fs from "fs/promises";
import os from "os";
import path from "path";

export type ConfigScope = "global" | "user" | "project" | "local";
export type ScopeLabel = string;
export interface ScopedCandidate {
  path: string;
  scope: ConfigScope;
  label: ScopeLabel;
}

export function normalizeScope(scope: string | undefined): ConfigScope {
  if (scope === "local") return "local";
  if (scope === "project") return "project";
  if (scope === "user") return "user";
  return "global";
}

export function scopeOf(candidate: ScopedCandidate): ConfigScope {
  return candidate.scope;
}

function isSameCandidate(a: string, b: string): boolean {
  return process.platform === "win32"
    ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()
    : path.resolve(a) === path.resolve(b);
}

function dedupeCandidates(candidates: ScopedCandidate[]): ScopedCandidate[] {
  const out: ScopedCandidate[] = [];
  for (const item of candidates) {
    if (!out.some((existing) => isSameCandidate(existing.path, item.path))) {
      out.push(item);
    }
  }
  return out;
}

export async function firstExistingPath(paths: string[]): Promise<string | null> {
  for (const p of paths) {
    try {
      await fs.access(p);
      return p;
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function firstExistingScopedPath(candidates: ScopedCandidate[]): Promise<ScopedCandidate | null> {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate.path);
      return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

export function homeDir(): string {
  return process.env.SYNCTAX_HOME || os.homedir();
}

function addVscodeBaseCandidates(candidates: ScopedCandidate[], h: string): void {
  const syn = process.env.SYNCTAX_HOME;
  const ad = process.env.APPDATA;
  const useWinAppData = process.platform === "win32" && !!ad;

  if (useWinAppData) {
    candidates.push(
      { path: path.join(ad, "Code", "User", "settings.json"), scope: "user", label: "user vscode settings" },
      { path: path.join(ad, "Code - Insiders", "User", "settings.json"), scope: "user", label: "user vscode insiders settings" },
    );
  } else if (process.platform === "darwin") {
    candidates.push(
      { path: path.join(h, "Library", "Application Support", "Code", "User", "settings.json"), scope: "user", label: "darwin user vscode settings" },
      { path: path.join(h, "Library", "Application Support", "Code - Insiders", "User", "settings.json"), scope: "user", label: "darwin user vscode insiders settings" },
    );
  } else if (process.platform !== "win32") {
    candidates.push(
      { path: path.join(h, ".config", "Code", "User", "settings.json"), scope: "user", label: "linux user vscode settings" },
      { path: path.join(h, ".config", "Code - Insiders", "User", "settings.json"), scope: "user", label: "linux user vscode insiders settings" },
    );
  }

  candidates.push({ path: path.join(h, ".vscode", "settings.json"), scope: "global", label: "legacy global vscode settings" });
}

/** VS Code / Copilot MCP file (separate from settings.json since 2025+). */
export function vscodeUserSettingsCandidates(h = homeDir(), projectRoot = process.cwd()): ScopedCandidate[] {
  const list: ScopedCandidate[] = [];
  const cwdCandidate = path.join(projectRoot, ".vscode", "settings.json");
  list.push({ path: cwdCandidate, scope: "project", label: "workspace vscode settings" });
  addVscodeBaseCandidates(list, h);
  return dedupeCandidates(list);
}

/** VS Code / Copilot MCP file (separate from settings.json since 2025+). */
export function vscodeUserMcpJsonCandidates(h = homeDir(), projectRoot = process.cwd()): ScopedCandidate[] {
  const list: ScopedCandidate[] = [];
  const cwdCandidate = path.join(projectRoot, ".vscode", "mcp.json");
  list.push({ path: cwdCandidate, scope: "project", label: "workspace vscode mcp.json" });

  const syn = process.env.SYNCTAX_HOME;
  const ad = process.env.APPDATA;
  const useWinAppData = process.platform === "win32" && !!ad;

  if (useWinAppData) {
    list.push(
      { path: path.join(ad, "Code", "User", "mcp.json"), scope: "user", label: "user vscode mcp.json" },
      { path: path.join(ad, "Code - Insiders", "User", "mcp.json"), scope: "user", label: "user vscode insiders mcp.json" },
    );
  } else if (process.platform === "darwin") {
    list.push(
      { path: path.join(h, "Library", "Application Support", "Code", "User", "mcp.json"), scope: "user", label: "darwin user vscode mcp.json" },
      { path: path.join(h, "Library", "Application Support", "Code - Insiders", "User", "mcp.json"), scope: "user", label: "darwin user vscode insiders mcp.json" },
    );
  } else if (process.platform !== "win32") {
    list.push(
      { path: path.join(h, ".config", "Code", "User", "mcp.json"), scope: "user", label: "linux user vscode mcp.json" },
      { path: path.join(h, ".config", "Code - Insiders", "User", "mcp.json"), scope: "user", label: "linux user vscode insiders mcp.json" },
    );
  }

  list.push({ path: path.join(h, ".vscode", "mcp.json"), scope: "global", label: "legacy global vscode mcp.json" });
  return list;
}

// Keep legacy helper name and behavior for any call sites expecting simple string arrays.
export function vscodeSettingsCandidates(h = homeDir(), projectRoot = process.cwd()): string[] {
  return vscodeUserSettingsCandidates(h, projectRoot).map((c) => c.path);
}

export function vscodeCopilotDetectCandidates(h = homeDir()): string[] {
  return [...vscodeUserSettingsCandidates(h).map(c => c.path), ...vscodeUserMcpJsonCandidates(h).map(c => c.path)];
}

export async function pathDirectoryExists(dir: string): Promise<boolean> {
  try {
    const s = await fs.stat(dir);
    return s.isDirectory();
  } catch {
    return false;
  }
}

function envDirUnderSynctaxHome(envPath: string | undefined): boolean {
  const syn = process.env.SYNCTAX_HOME;
  if (!syn || !envPath) return true;
  return path.resolve(envPath).startsWith(path.resolve(syn));
}

/** XDG-style ~/.config/{app}/{file} plus common Windows AppData/LocalAppData locations. */
export function xdgStyleConfigCandidates(appFolder: string, fileName: string, h = homeDir()): ScopedCandidate[] {
  const out: ScopedCandidate[] = [];
  const projectRoot = process.cwd();
  const projectCandidate = path.join(projectRoot, `.${appFolder}`, fileName);
  out.push({ path: projectCandidate, scope: "project", label: `${appFolder} project config` });
  out.push({ path: path.join(h, ".config", appFolder, fileName), scope: "user", label: `${appFolder} xdg config` });
  if (process.platform === "win32") {
    const la = process.env.LOCALAPPDATA;
    const ad = process.env.APPDATA;
    if (la && envDirUnderSynctaxHome(la)) out.push({ path: path.join(la, appFolder, fileName), scope: "user", label: `${appFolder} localappdata config` });
    if (ad && envDirUnderSynctaxHome(ad)) out.push({ path: path.join(ad, appFolder, fileName), scope: "user", label: `${appFolder} appdata config` });
  }
  return dedupeCandidates(out);
}

export function opencodeConfigCandidates(h = homeDir()): ScopedCandidate[] {
  const out: ScopedCandidate[] = [];
  const cwd = process.cwd();
  const projectPrimary = path.join(cwd, "opencode.json");
  const projectPrimaryJsonc = path.join(cwd, "opencode.jsonc");
  const projectFallback = path.join(cwd, ".opencode", "config.json");
  const projectFallbackNamed = path.join(cwd, ".opencode", "opencode.json");
  const projectFallbackNamedJsonc = path.join(cwd, ".opencode", "opencode.jsonc");
  out.push(
    { path: projectPrimary, scope: "project", label: "project opencode.json" },
    { path: projectPrimaryJsonc, scope: "project", label: "project opencode.jsonc" },
    { path: projectFallback, scope: "project", label: "project .opencode config" },
    { path: projectFallbackNamed, scope: "project", label: "project .opencode opencode.json" },
    { path: projectFallbackNamedJsonc, scope: "project", label: "project .opencode opencode.jsonc" },
  );
  out.push(
    { path: path.join(h, ".config", "opencode", "config.json"), scope: "user", label: "user opencode config" },
    { path: path.join(h, ".config", "opencode", "opencode.json"), scope: "user", label: "user opencode primary json" },
    { path: path.join(h, ".opencode", "config.json"), scope: "user", label: "user hidden opencode config" },
    { path: path.join(h, ".config", "opencode", "opencode.jsonc"), scope: "user", label: "user opencode primary jsonc" },
  );

  const customConfigPath = process.env.OPENCODE_CONFIG?.trim();
  if (customConfigPath) {
    out.push({
      path: path.isAbsolute(customConfigPath) ? customConfigPath : path.resolve(cwd, customConfigPath),
      scope: "user",
      label: "opencode env override config",
    });
  }

  const la = process.env.LOCALAPPDATA;
  const ad = process.env.APPDATA;
  const syn = process.env.SYNCTAX_HOME;
  if (la && (!syn || envDirUnderSynctaxHome(la))) {
    out.push({ path: path.join(la, "opencode", "config.json"), scope: "user", label: "localappdata opencode config" });
  }
  if (ad && (!syn || envDirUnderSynctaxHome(ad))) {
    out.push({ path: path.join(ad, "opencode", "config.json"), scope: "user", label: "appdata opencode config" });
  }
  return dedupeCandidates(out);
}

export function antigravityConfigCandidates(h = homeDir()): ScopedCandidate[] {
  const out: ScopedCandidate[] = [
    { path: path.join(h, ".gemini", "antigravity", "mcp_config.json"), scope: "user", label: "gemini-antigravity" },
    { path: path.join(h, ".antigravity", "config.json"), scope: "global", label: "legacy antigravity config" },
    { path: path.join(h, ".antigravity_tools", "gui_config.json"), scope: "user", label: "antigravity tools config" },
  ];
  out.push(...xdgStyleConfigCandidates("antigravity", "config.json", h));
  if (process.platform === "win32") {
    const la = process.env.LOCALAPPDATA;
    const ad = process.env.APPDATA;
    const pushWin = (base: string | undefined, underSynctaxOnly: boolean) => {
      if (!base) return;
      if (underSynctaxOnly && !envDirUnderSynctaxHome(base)) return;
      out.push(
        { path: path.join(base, "Antigravity", "config.json"), scope: "user", label: "antigravity user config" },
        { path: path.join(base, "Antigravity", "User", "settings.json"), scope: "user", label: "antigravity user settings" },
      );
    };
    if (process.env.SYNCTAX_HOME) {
      pushWin(la, true);
      pushWin(ad, true);
    } else {
      pushWin(la, false);
      pushWin(ad, false);
    }
  }
  return dedupeCandidates(out);
}

export async function antigravityInstallDirsDetected(h = homeDir()): Promise<boolean> {
  const dirs: string[] = [path.join(h, ".antigravity_tools"), path.join(h, ".antigravity")];
  if (process.platform === "win32") {
    const pushDir = (base: string | undefined) => {
      if (!base) return;
      if (process.env.SYNCTAX_HOME && !envDirUnderSynctaxHome(base)) return;
      dirs.push(path.join(base, "Antigravity"));
    };
    if (process.env.SYNCTAX_HOME) {
      pushDir(process.env.LOCALAPPDATA);
      pushDir(process.env.APPDATA);
    } else {
      if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, "Antigravity"));
      if (process.env.APPDATA) dirs.push(path.join(process.env.APPDATA, "Antigravity"));
    }
  }
  const seen = new Set<string>();
  for (const d of dirs) {
    const norm = path.normalize(d);
    if (seen.has(norm)) continue;
    seen.add(norm);
    if (await pathDirectoryExists(norm)) return true;
  }
  return false;
}

export function zedSettingsCandidates(h = homeDir()): string[] {
  const out: string[] = [path.join(h, ".config", "zed", "settings.json")];
  if (process.platform === "win32") {
    const la = process.env.LOCALAPPDATA;
    const ad = process.env.APPDATA;
    if (la && envDirUnderSynctaxHome(la)) out.push(path.join(la, "Zed", "settings.json"));
    if (ad && envDirUnderSynctaxHome(ad)) out.push(path.join(ad, "Zed", "settings.json"));
  }
  return out;
}
