import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";
import * as ui from "../ui/index.js";
import { adapters } from "../adapters/index.js";
import { getVersion } from "../version.js";
import { getConfigManager } from "./_shared.js";

async function isExecutableFile(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function commandExistsOnPath(command: string): Promise<boolean> {
  if (!command) return false;

  if (command.includes(path.sep) || path.isAbsolute(command)) {
    return isExecutableFile(command);
  }

  const pathValue = process.env.PATH || "";
  const pathParts = pathValue.split(path.delimiter).filter(Boolean);
  const isWindows = process.platform === "win32";
  const extensions = isWindows
    ? (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";")
    : [""];
  const hasKnownWindowsExtension =
    isWindows &&
    extensions.some((ext) => {
      const normalizedExt = ext.startsWith(".") ? ext : `.${ext}`;
      return Boolean(normalizedExt) && command.toLowerCase().endsWith(normalizedExt.toLowerCase());
    });

  for (const dir of pathParts) {
    if (isWindows) {
      const commandAsIs = path.join(dir, command);
      if (await isExecutableFile(commandAsIs)) {
        return true;
      }

      if (hasKnownWindowsExtension) {
        continue;
      }

      for (const ext of extensions) {
        const normalizedExt = ext.startsWith(".") ? ext : `.${ext}`;
        if (!normalizedExt) {
          continue;
        }

        const candidate = path.join(dir, `${command}${normalizedExt}`);
        if (await isExecutableFile(candidate)) {
          return true;
        }
      }
      continue;
    }

    const candidate = path.join(dir, command);
    if (await isExecutableFile(candidate)) {
      return true;
    }
  }

  return false;
}

export async function validateCommand(options?: { strict?: boolean }): Promise<boolean> {
  const timer = ui.startTimer();
  const configManager = getConfigManager();

  let healthy = true;
  let activeProfile = "default";

  try {
    const existing = await configManager.read();
    activeProfile = existing.activeProfile || "default";
  } catch {
    // Ignore - config read errors are reported in the validation block below.
  }

  console.log(ui.format.brandHeader(getVersion(), activeProfile));
  ui.header("Validating synctax configuration...");

  let config: any;
  try {
    config = await configManager.read();
    ui.success("Config is readable and schema-valid.", { indent: 2 });
  } catch (error: any) {
    ui.error(`Config is unreadable or invalid: ${error?.message || String(error)}`);
    console.log(ui.format.summary(timer.elapsed(), "validation complete"));
    return false;
  }

  if (!config.profiles?.[config.activeProfile]) {
    ui.error(`Active profile \"${config.activeProfile}\" does not exist.`);
    healthy = false;
  } else {
    ui.success(`Active profile \"${config.activeProfile}\" exists.`, { indent: 2 });
  }

  for (const [id, clientConfig] of Object.entries<any>(config.clients || {})) {
    if (!clientConfig?.enabled) continue;

    const adapter = adapters[id];
    if (!adapter) {
      ui.error(`Enabled client \"${id}\" has no adapter implementation.`);
      healthy = false;
      continue;
    }

    const spin = ui.spinner(`Detecting ${adapter.name}...`);
    try {
      const detected = await adapter.detect();
      if (!detected) {
        spin.fail(`${adapter.name} not detected.`);
        healthy = false;
      } else {
        spin.succeed(`${adapter.name} detected.`);
      }
    } catch (error: any) {
      spin.fail(`${adapter.name} detection failed: ${error?.message || String(error)}`);
      healthy = false;
    }
  }

  for (const [name, server] of Object.entries<any>(config.resources?.mcps || {})) {
    const exists = await commandExistsOnPath(server.command);
    if (!exists) {
      ui.error(`MCP \"${name}\" command not found on PATH: ${server.command}`);
      healthy = false;
    }

    for (const [envKey, envValue] of Object.entries<string>(server.env || {})) {
      if (!envValue?.startsWith("$")) continue;
      const envName = envValue.replace(/^\$/, "");
      if (!process.env[envName]) {
        ui.error(`MCP \"${name}\" env \"${envKey}\" references missing ${envName}.`);
        healthy = false;
      }
    }
  }

  if (options?.strict) {
    // Reserved for additional strict-only validations in future tasks.
  }

  if (healthy) {
    console.log("\n" + ui.format.success("Validation passed."));
  } else {
    console.log("\n" + ui.format.warn("Validation failed.", { prefix: "" }));
  }
  console.log(ui.format.summary(timer.elapsed(), "validation complete"));

  return healthy;
}
