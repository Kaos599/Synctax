import fs from "fs/promises";
import path from "path";
import os from "os";
import readline from "node:readline/promises";
import { stdin as stdinStream, stdout as stdoutStream } from "node:process";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import chalk from "chalk";

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(srcDir, "..");
const cliScript = path.join(repoRoot, "bin", "synctax.ts");

const MARKER = "# synctax PATH";

function psSingleQuotedPath(p: string): string {
  return p.replace(/'/g, "''");
}

/** Single-line script avoids multiline -Command quirks on Windows. */
function addWindowsUserPathEntry(dir: string): { ok: boolean; stderr: string } {
  const dirWin = path.normalize(dir);
  const q = psSingleQuotedPath(dirWin);
  const ps = `$dir='${q}';$raw=[Environment]::GetEnvironmentVariable('Path','User');if($null-eq$raw){$raw=''};$parts=@($raw-split';'|Where-Object{$_});if($parts-notcontains$dir){[Environment]::SetEnvironmentVariable('Path',($parts+$dir)-join';','User')}`;
  const r = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], {
    encoding: "utf-8",
  });
  return { ok: r.status === 0, stderr: (r.stderr ?? "").trim() };
}

function windowsUserPathContains(dir: string): boolean {
  const dirWin = path.normalize(dir);
  const q = psSingleQuotedPath(dirWin);
  const ps = `$dir='${q}';$raw=[Environment]::GetEnvironmentVariable('Path','User');if($null-eq$raw){$raw=''};$parts=@($raw-split';'|Where-Object{$_});if($parts-contains$dir){'1'}else{'0'}`;
  const r = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], {
    encoding: "utf-8",
  });
  return r.status === 0 && (r.stdout ?? "").trim() === "1";
}

function unixShellRcOrder(home: string): string[] {
  const shell = (process.env.SHELL ?? "").toLowerCase();
  const z = [path.join(home, ".zshrc"), path.join(home, ".zprofile")];
  const b = [
    path.join(home, ".bash_profile"),
    path.join(home, ".bashrc"),
    path.join(home, ".profile"),
  ];
  if (shell.includes("fish")) {
    return [path.join(home, ".config", "fish", "config.fish")];
  }
  if (shell.includes("zsh")) {
    return [...z, ...b];
  }
  if (shell.includes("bash")) {
    return [...b, ...z];
  }
  return [...z, ...b];
}

function defaultRcToCreate(home: string): string {
  const shell = (process.env.SHELL ?? "").toLowerCase();
  if (shell.includes("fish")) return path.join(home, ".config", "fish", "config.fish");
  if (shell.includes("zsh")) return path.join(home, ".zshrc");
  if (shell.includes("bash")) return path.join(home, ".bashrc");
  if (process.platform === "darwin") return path.join(home, ".zshrc");
  return path.join(home, ".profile");
}

async function readFileMaybe(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, "utf-8");
  } catch {
    return null;
  }
}

async function appendPathBlock(rc: string, body: string): Promise<void> {
  const existing = (await readFileMaybe(rc)) ?? "";
  if (existing.includes(MARKER) || existing.includes(".synctax/bin")) return;
  const prefix = existing.length && !existing.endsWith("\n") ? "\n" : "";
  const block = `${prefix}\n${MARKER}\n${body}\n`;
  await fs.appendFile(rc, block, "utf-8");
}

async function tryUnixShellProfiles(home: string, binDir: string): Promise<boolean> {
  const exportSh = `export PATH="${binDir}:$PATH"`;
  const fishBlock = "fish_add_path $HOME/.synctax/bin";

  for (const rc of unixShellRcOrder(home)) {
    const isFish = rc.endsWith("config.fish");
    const exists = await readFileMaybe(rc);
    if (exists === null) continue;
    if (exists.includes(MARKER) || exists.includes(".synctax/bin")) {
      console.log(chalk.green(`PATH already configured in ${rc}`));
      return true;
    }
    await appendPathBlock(rc, isFish ? fishBlock : exportSh);
    console.log(chalk.green(`Updated ${rc} (PATH)`));
    return true;
  }
  return false;
}

async function createUnixShellProfile(home: string, binDir: string): Promise<void> {
  const target = defaultRcToCreate(home);
  const isFish = target.endsWith("config.fish");
  const exportSh = `export PATH="${binDir}:$PATH"`;
  const fishBlock = "fish_add_path $HOME/.synctax/bin";
  const body = `${MARKER}\n${isFish ? fishBlock : exportSh}\n`;

  if (isFish) {
    await fs.mkdir(path.dirname(target), { recursive: true });
  }

  const prior = await readFileMaybe(target);
  if (prior !== null) {
    if (prior.includes(MARKER) || prior.includes(".synctax/bin")) {
      console.log(chalk.green(`PATH already configured in ${target}`));
      return;
    }
    const prefix = prior.length && !prior.endsWith("\n") ? "\n" : "";
    await fs.appendFile(target, `${prefix}\n${body}`, "utf-8");
    console.log(chalk.green(`Appended PATH to ${target}`));
    return;
  }

  await fs.mkdir(path.dirname(target), { recursive: true }).catch(() => {});
  await fs.writeFile(target, body, "utf-8");
  console.log(chalk.green(`Created ${target} with PATH update`));
}

/** Linux systemd user session (GUI / login); complements shell profiles. */
async function tryLinuxEnvironmentD(binDir: string): Promise<boolean> {
  if (process.platform !== "linux") return false;
  const home = os.homedir();
  const dir = path.join(home, ".config", "environment.d");
  const file = path.join(dir, "60-synctax.conf");
  const line = `PATH=${binDir}:\${PATH}`;
  try {
    const existing = await readFileMaybe(file);
    if (existing?.includes(".synctax/bin")) {
      console.log(chalk.green(`Already present: ${file}`));
      return true;
    }
    await fs.mkdir(dir, { recursive: true });
    const content = `${MARKER}\n${line}\n`;
    await fs.writeFile(file, content, "utf-8");
    console.log(chalk.green(`Wrote ${file} (systemd user environment; may require re-login)`));
    return true;
  } catch (e) {
    console.log(chalk.yellow(`Could not write environment.d (optional): ${String(e)}`));
    return false;
  }
}

export async function installPathCommand(): Promise<void> {
  const bunExe = process.execPath;
  const home = os.homedir();
  const binDir = path.join(home, ".synctax", "bin");

  try {
    await fs.access(cliScript);
  } catch {
    console.log(chalk.red(`Could not find CLI entry: ${cliScript}`));
    return;
  }

  await fs.mkdir(binDir, { recursive: true });

  if (process.platform === "win32") {
    const cmdPath = path.join(binDir, "synctax.cmd");
    const bunQ = bunExe.replace(/"/g, '""');
    const cliQ = cliScript.replace(/"/g, '""');
    const body = `@echo off\r\n"${bunQ}" "${cliQ}" %*\r\n`;
    await fs.writeFile(cmdPath, body, "utf-8");

    const { ok, stderr } = addWindowsUserPathEntry(binDir);
    const verified = windowsUserPathContains(binDir);
    if (ok && verified) {
      console.log(chalk.green(`Added to user PATH: ${binDir}`));
    } else if (ok && !verified) {
      if (stderr) console.log(chalk.yellow(stderr));
      console.log(
        chalk.yellow(
          `PATH update reported success, but verification did not see ${binDir}. Add that folder under Environment Variables → Path (User) if synctax is still not found.`
        )
      );
    } else {
      if (stderr) console.log(chalk.yellow(stderr));
      console.log(
        chalk.yellow(
          "Could not update user PATH automatically. Add this folder: Settings → System → About → Advanced system settings → Environment Variables → Path (User):"
        )
      );
      console.log(chalk.cyan(binDir));
    }
    console.log(chalk.green(`Launcher written: ${cmdPath}`));
    console.log("");
    console.log(chalk.bold("Run the CLI as ") + chalk.cyan("synctax") + chalk.bold(" (with a ") + chalk.cyan("c") + chalk.bold("), not “syntax”."));
    console.log(
      chalk.gray(
        "• Cursor / VS Code: integrated terminals often keep an old PATH until you reload the app (Command Palette → “Developer: Reload Window”) or fully quit and reopen.\n" +
          "• Any PowerShell: reload PATH in this session (no restart needed):\n" +
          "  $env:Path = [System.Environment]::GetEnvironmentVariable('Path','User') + ';' + [System.Environment]::GetEnvironmentVariable('Path','Machine')\n" +
          "  synctax --help\n" +
          "• Or open Windows Terminal / cmd outside the editor and try again."
      )
    );
    return;
  }

  const shPath = path.join(binDir, "synctax");
  const script = `#!/bin/sh\nexec "${bunExe}" "${cliScript}" "$@"\n`;
  await fs.writeFile(shPath, script, "utf-8");
  await fs.chmod(shPath, 0o755);
  console.log(chalk.green(`Launcher written: ${shPath}`));

  const updated = await tryUnixShellProfiles(home, binDir);
  if (!updated) {
    await createUnixShellProfile(home, binDir);
  }

  await tryLinuxEnvironmentD(binDir);

  console.log(chalk.gray("Open a new terminal (or run: source ~/.zshrc / ~/.bashrc), then: synctax --help"));
}

export type PathPromptOptions = {
  assumeYes?: boolean;
  noPathPrompt?: boolean;
};

/** After `init`, offer to install ~/.synctax/bin and update user PATH (TTY prompt unless --yes / CI / tests). */
export async function maybePromptAndInstallPath(opts: PathPromptOptions = {}): Promise<void> {
  if (opts.noPathPrompt) return;
  if (process.env.VITEST) return;

  let install = false;
  if (opts.assumeYes) {
    install = true;
  } else if (process.env.CI) {
    return;
  } else if (!stdinStream.isTTY) {
    console.log(
      chalk.gray(
        "Skipping PATH setup (non-interactive). Run `synctax init` in a normal terminal to be asked, or use `synctax init --yes`."
      )
    );
    return;
  } else {
    const rl = readline.createInterface({ input: stdinStream, output: stdoutStream });
    try {
      const line = await rl.question(
        chalk.cyan(
          "Add ~/.synctax/bin to your PATH so the `synctax` command works from any folder? [Y/n] "
        )
      );
      const t = line.trim().toLowerCase();
      install = t === "" || t === "y" || t === "yes";
    } finally {
      rl.close();
    }
  }

  if (!install) return;

  console.log("");
  await installPathCommand();
}
