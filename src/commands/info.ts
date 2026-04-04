import * as ui from "../ui/index.js";
import { adapters } from "../adapters/index.js";
import { getConfigManager } from "./_shared.js";
import { getVersion } from "../version.js";
import { access } from "fs/promises";
import { constants } from "fs";
import path from "path";

const ALL_DRIFT_DOMAINS = ["mcps", "agents", "skills"] as const;
type DriftDomain = (typeof ALL_DRIFT_DOMAINS)[number];
type AdapterId = keyof typeof adapters;

function hasOwnKey<T extends object>(obj: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

const DRIFT_DOMAIN_OVERRIDES: Partial<Record<AdapterId, readonly DriftDomain[]>> = {
  zed: ["mcps"],
  cline: ["mcps"],
  "github-copilot": ["mcps"],
  "github-copilot-cli": ["skills"],
  "gemini-cli": [],
};

function normalizeComparable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeComparable(item));
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};

    for (const key of Object.keys(obj).sort()) {
      if (key === "scope") continue;
      normalized[key] = normalizeComparable(obj[key]);
    }

    return normalized;
  }

  return value;
}

function isEqualResource(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeComparable(a)) === JSON.stringify(normalizeComparable(b));
}

function collectDriftDetails(
  label: string,
  masterResources: Record<string, unknown>,
  clientResources: Record<string, unknown>
): string[] {
  const details: string[] = [];

  for (const [name, masterValue] of Object.entries(masterResources)) {
    const clientValue = clientResources[name];
    if (clientValue === undefined) {
      details.push(`Missing ${label}: ${name}`);
      continue;
    }
    if (!isEqualResource(masterValue, clientValue)) {
      details.push(`Drift in ${label}: ${name}`);
    }
  }

  for (const name of Object.keys(clientResources)) {
    if (masterResources[name] === undefined) {
      details.push(`Extra ${label}: ${name}`);
    }
  }

  return details;
}

function getRequiredEnvVarName(value: string): string | null {
  if (!value.startsWith("$")) return null;
  const raw = value.slice(1).trim();
  if (!raw) return null;
  if (raw.startsWith("{") && raw.endsWith("}")) {
    const wrapped = raw.slice(1, -1).trim();
    return wrapped || null;
  }
  return raw;
}

async function commandExistsOnPath(commandName: string): Promise<boolean> {
  const trimmed = commandName.trim();
  if (!trimmed) return false;

  const hasPathSeparator = trimmed.includes("/") || trimmed.includes("\\");
  if (hasPathSeparator) {
    try {
      await access(trimmed, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  const pathEnv = process.env.PATH ?? "";
  const pathSegments = pathEnv.split(path.delimiter).filter(Boolean);

  if (process.platform === "win32") {
    const pathext = (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
      .split(";")
      .map((ext) => ext.toLowerCase());
    const candidateHasExt = /\.[^\\/]+$/.test(trimmed);
    const candidates = candidateHasExt ? [trimmed] : pathext.map((ext) => `${trimmed}${ext}`);

    for (const segment of pathSegments) {
      for (const candidate of candidates) {
        const fullPath = path.join(segment, candidate);
        try {
          await access(fullPath, constants.F_OK);
          return true;
        } catch {
          // Continue scanning PATH
        }
      }
    }
    return false;
  }

  for (const segment of pathSegments) {
    const fullPath = path.join(segment, trimmed);
    try {
      await access(fullPath, constants.X_OK);
      return true;
    } catch {
      // Continue scanning PATH
    }
  }

  return false;
}

export async function listCommand() {
  const timer = ui.startTimer();
  const configManager = getConfigManager();
  const config = await configManager.read();

  console.log(ui.format.brandHeader(getVersion(), config.activeProfile));

  const mcps = config.resources.mcps || {};
  const agents = config.resources.agents || {};

  if (Object.keys(mcps).length > 0) {
    console.log(ui.format.header("\nRegistered MCP Servers:"));
    for (const [name, server] of Object.entries(mcps)) {
      console.log(`- ${ui.semantic.label(name)}: ${server.command} ${server.args?.join(" ") || ""}`);
    }
  } else {
    console.log(ui.format.warn("\nNo MCP servers found.", { prefix: "" }));
  }

  if (Object.keys(agents).length > 0) {
    console.log(ui.format.header("\nRegistered Agents:"));
    for (const [name, agent] of Object.entries(agents)) {
      console.log(`- ${ui.semantic.label(name)}: ${agent.description || agent.prompt.slice(0, 30) + '...'}`);
    }
  } else {
    console.log(ui.format.warn("\nNo Agents found.", { prefix: "" }));
  }

  console.log(ui.format.dim("\nHint: use 'synctax status' for the unified dashboard."));
  console.log(ui.format.summary(timer.elapsed(), "list complete"));
}

export async function statusCommand() {
  const timer = ui.startTimer();
  const configManager = getConfigManager();
  const config = await configManager.read();

  console.log(ui.format.brandHeader(getVersion(), config.activeProfile));

  const mcps = config.resources.mcps || {};
  const agents = config.resources.agents || {};
  const skills = config.resources.skills || {};
  const credentials = config.resources.credentials?.envRefs || {};

  ui.header("System Configuration Status:");

  // 1. Overall stats
  console.log(ui.format.info("\n  Overview:"));
  console.log(`    MCPs: ${Object.keys(mcps).length}`);
  console.log(`    Agents: ${Object.keys(agents).length}`);
  console.log(`    Skills: ${Object.keys(skills).length}`);

  // 2. Health check (Credentials/Env vars)
  console.log(ui.format.info("\n  Health Checks:"));
  let healthIssues = 0;
  for (const [key, envRef] of Object.entries(credentials)) {
    const envName = envRef.replace('$', '');
    if (!process.env[envName]) {
      ui.warn(`Missing Environment Variable: ${envName} (referenced by ${key})`, { indent: 2 });
      healthIssues++;
    }
  }

  for (const [name, server] of Object.entries(mcps)) {
     if (server.env) {
       for (const [envKey, envVal] of Object.entries(server.env)) {
         if (envVal.startsWith('$')) {
           const envName = envVal.replace('$', '');
           if (!process.env[envName]) {
              ui.warn(`MCP "${name}" requires missing env var: ${envName}`, { indent: 2 });
              healthIssues++;
           }
         }
       }
     }
  }

  if (healthIssues === 0) {
    ui.success("All required environment variables and credentials appear to be set.", { indent: 2 });
  }

  // 3. Sync status
  console.log(ui.format.info("\n  Client Sync Status:"));
  let clientsChecked = 0;
  for (const [id, clientConf] of Object.entries(config.clients)) {
    if (!clientConf.enabled) continue;
    const adapter = adapters[id];
    if (!adapter) continue;
    clientsChecked++;

    const spin = ui.spinner(`Checking ${adapter.name}...`);
    try {
      const data = await adapter.read();
      const supportedDomains =
        (hasOwnKey(DRIFT_DOMAIN_OVERRIDES, id) ? DRIFT_DOMAIN_OVERRIDES[id] : undefined) ?? ALL_DRIFT_DOMAINS;
      const driftDetails: string[] = [];

      if (supportedDomains.includes("mcps")) {
        driftDetails.push(...collectDriftDetails("MCP", mcps, data.mcps || {}));
      }
      if (supportedDomains.includes("agents")) {
        driftDetails.push(...collectDriftDetails("Agent", agents, data.agents || {}));
      }
      if (supportedDomains.includes("skills")) {
        driftDetails.push(...collectDriftDetails("Skill", skills, data.skills || {}));
      }

      const inSync = driftDetails.length === 0;

      if (inSync) {
        spin.succeed(`${adapter.name}: In Sync`);
      } else {
        spin.warn(`${adapter.name}: Out of Sync (${driftDetails.length} issues)`);
        driftDetails.forEach(d => ui.dim(`      - ${d}`));
      }
    } catch (e: any) {
      spin.fail(`${adapter.name}: Error reading config (${e.message})`);
    }
  }

  if (clientsChecked === 0) {
    ui.dim("    No clients enabled.");
  }

  console.log(ui.format.summary(timer.elapsed(), "status check complete"));
}

export async function doctorCommand(options: any): Promise<boolean> {
  const timer = ui.startTimer();
  const configManager = getConfigManager();

  let activeProfile = "default";
  try {
    const existingConfig = await configManager.read();
    activeProfile = existingConfig.activeProfile || "default";
  } catch (e) {
    // Config may not exist yet
  }

  console.log(ui.format.brandHeader(getVersion(), activeProfile));
  ui.header("Diagnosing agentsync setup...");
  let healthy = true;

  try {
    const config = await configManager.read();

    // Check missing clients
    for (const [id, clientConf] of Object.entries(config.clients)) {
      if (!clientConf.enabled) continue;
      const adapter = adapters[id];
      if (!adapter) {
        ui.error(`Adapter missing for enabled client: ${id}`);
        healthy = false;
        continue;
      }

      const spin = ui.spinner(`Checking ${adapter.name}...`);
      const detected = await adapter.detect();
      if (!detected) {
        spin.warn(`Enabled client ${adapter.name} config not found on disk.`);
        healthy = false;
      } else {
        spin.succeed(`Client ${adapter.name} config found.`);
      }
      }

      if (options?.deep) {
        const mcpResources = config.resources.mcps || {};
        for (const [name, server] of Object.entries(mcpResources)) {
          const commandExists = await commandExistsOnPath(server.command);
          if (!commandExists) {
            ui.error(`MCP "${name}" command not found on PATH: ${server.command}`);
            healthy = false;
          }

          if (server.env) {
            for (const envValue of Object.values(server.env)) {
              const envName = getRequiredEnvVarName(envValue);
              if (!envName) continue;
              if (!process.env[envName]) {
                ui.error(`MCP "${name}" requires missing env var: ${envName}`);
                healthy = false;
              }
            }
          }
        }
      }

  } catch (e: any) {
    ui.error(`Config schema error: ${e.message}`);
    healthy = false;
  }

  if (healthy) console.log("\n" + ui.format.success("All checks passed!"));
  else console.log("\n" + ui.format.warn("Issues found.", { prefix: "" }));

  if (!healthy) {
    process.exitCode = 1;
  }

  console.log(ui.format.summary(timer.elapsed(), "doctor check complete"));

  return healthy;
}

export async function infoCommand() {
  const timer = ui.startTimer();
  const configManager = getConfigManager();
  const config = await configManager.read();

  console.log(ui.format.brandHeader(getVersion(), config.activeProfile));
  ui.header("\nGathering system intelligence...\n");

  const table = ui.createTable({
    headers: ["Client", "Installed", "MCPs", "Agents", "Skills"],
  });

  for (const [id, adapter] of Object.entries(adapters)) {
    const installed = await adapter.detect();
    let mcpCount = 0;
    let agentCount = 0;
    let skillCount = 0;

    if (installed) {
      try {
        const data = await adapter.read();
        mcpCount = Object.keys(data.mcps || {}).length;
        agentCount = Object.keys(data.agents || {}).length;
        skillCount = Object.keys(data.skills || {}).length;
      } catch (e) {
        // If config is broken, we just show 0
      }
    }

    const isActive = config.clients[id]?.enabled;

    table.push([
      isActive ? ui.semantic.highlight(adapter.name) : ui.semantic.muted(adapter.name),
      installed ? ui.semantic.success("Yes") : ui.semantic.error("No"),
      `${mcpCount} MCP${mcpCount !== 1 ? "s" : ""}`,
      `${agentCount} Agent${agentCount !== 1 ? "s" : ""}`,
      `${skillCount} Skill${skillCount !== 1 ? "s" : ""}`
    ]);
  }

  console.log(table.toString());
  console.log("\n");

  console.log(ui.format.dim("Hint: use 'synctax status' for the unified dashboard."));
  console.log(ui.format.summary(timer.elapsed(), "info complete"));
}
