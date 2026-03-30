import * as ui from "../ui/index.js";
import { checkbox } from "@inquirer/prompts";
import { getConfigManager } from "./_shared.js";
import { syncCommand } from "./sync.js";
import { getVersion } from "../version.js";
import { requireInteractiveTTY } from "./_terminal.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type ImportedMcpResolution = {
  mcp: Record<string, unknown> | null;
  reason?: "invalid_payload" | "missing_named_key";
};

function resolveImportedMcp(payload: unknown, name: string): ImportedMcpResolution {
  if (isRecord(payload) && typeof payload.command === "string") {
    return { mcp: payload };
  }

  if (!isRecord(payload) || !isRecord(payload.mcps)) {
    return { mcp: null, reason: "invalid_payload" };
  }

  const mcps = payload.mcps as Record<string, unknown>;
  const named = mcps[name];
  if (isRecord(named) && typeof named.command === "string") {
    return { mcp: named };
  }

  const validCandidates: Record<string, unknown>[] = [];
  for (const candidate of Object.values(mcps)) {
    if (isRecord(candidate) && typeof candidate.command === "string") {
      validCandidates.push(candidate);
    }
  }

  if (validCandidates.length === 1) {
    const [singleCandidate] = validCandidates;
    return { mcp: singleCandidate ?? null, reason: singleCandidate ? undefined : "invalid_payload" };
  }

  if (validCandidates.length > 1) {
    return { mcp: null, reason: "missing_named_key" };
  }

  return { mcp: null, reason: "invalid_payload" };
}

export async function addCommand(domain: string, name: string, options: any) {
  const timer = ui.startTimer();
  const configManager = getConfigManager();
  const config = await configManager.read();

  console.log(ui.format.brandHeader(getVersion(), config.activeProfile));
  ui.header(`Adding ${domain}: ${name}...`);

  if (domain === "mcp") {
    let importedMcp: Record<string, unknown> | null = null;
    let importedMcpReason: ImportedMcpResolution["reason"];

    if (options.from) {
      try {
        const response = await fetch(options.from);
        if (!response.ok) {
          ui.error(`Failed to fetch MCP from URL (${response.status} ${response.statusText}).`);
          return;
        }

        const payload = await response.json();
        const resolved = resolveImportedMcp(payload, name);
        importedMcp = resolved.mcp;
        importedMcpReason = resolved.reason;
      } catch {
        ui.error(`Failed to import MCP from ${options.from}. Expected valid JSON payload.`);
        return;
      }

      if (!importedMcp) {
        if (importedMcpReason === "missing_named_key") {
          ui.error(`MCP key "${name}" not found in wrapper payload containing multiple MCP entries.`);
          return;
        }
        ui.error("Invalid MCP payload. Expected an MCP object or a payload with a mcps map containing a valid MCP.");
        return;
      }
    }

    config.resources.mcps[name] = {
      ...importedMcp,
      command: options.command ?? importedMcp?.command,
      args: options.args ?? importedMcp?.args,
      env: options.env ?? importedMcp?.env,
      transport: options.transport ?? importedMcp?.transport,
      scope: options.global ? "global" : (options.local ? "local" : "global")
    };
  } else if (domain === "agent") {
    config.resources.agents[name] = {
      name: options.name || name,
      prompt: options.prompt || "",
      model: options.model,
      tools: options.tools ? options.tools.split(",") : undefined,
      scope: options.global ? "global" : "local"
    };
  } else if (domain === "skill") {
    config.resources.skills[name] = {
      name: options.name || name,
      description: options.description,
      trigger: options.trigger,
      content: options.content || "",
      scope: options.global ? "global" : "local"
    };
  } else {
    ui.error(`Unsupported domain for add: ${domain}`);
    return;
  }

  await configManager.write(config);
  ui.success(`Added ${domain} ${name}`);

  console.log(ui.format.summary(timer.elapsed(), `added ${domain} "${name}"`));

  if (options.push) {
    await syncCommand({});
  }
}

export async function removeCommand(domain: string | undefined, name: string | undefined, options: any) {
  const timer = ui.startTimer();
  const configManager = getConfigManager();
  const config = await configManager.read();

  console.log(ui.format.brandHeader(getVersion(), config.activeProfile));

  if (options.interactive || (!domain && !name)) {
    if (!requireInteractiveTTY("remove --interactive")) {
      return;
    }

    const choices = [
      ...Object.keys(config.resources.mcps || {}).map(k => ({ name: `[MCP] ${k}`, value: { domain: 'mcp', key: k } })),
      ...Object.keys(config.resources.agents || {}).map(k => ({ name: `[Agent] ${k}`, value: { domain: 'agent', key: k } })),
      ...Object.keys(config.resources.skills || {}).map(k => ({ name: `[Skill] ${k}`, value: { domain: 'skill', key: k } }))
    ];

    if (choices.length === 0) {
      console.log(ui.format.warn("No resources found to remove.", { prefix: "" }));
      return;
    }

    const selected = await checkbox({
      message: 'Select resources to remove:',
      choices
    });

    if (selected.length === 0) {
      console.log(ui.format.warn("No resources selected.", { prefix: "" }));
      return;
    }

    for (const item of selected) {
      if (options.dryRun) {
        ui.dryRun(`Would remove ${item.domain}: ${item.key}`);
        continue;
      }
      if (item.domain === 'mcp') delete config.resources.mcps[item.key];
      if (item.domain === 'agent') delete config.resources.agents[item.key];
      if (item.domain === 'skill') delete config.resources.skills[item.key];
      ui.success(`Removed ${item.domain}: ${item.key}`);
    }

    if (options.dryRun) {
      return;
    }
  } else {
    if (!domain || !name) {
      ui.error("Must specify domain and name, or use --interactive");
      return;
    }
    ui.header(`Removing ${domain}: ${name}...`);

    let group: any;
    if (domain === "mcp") group = config.resources.mcps;
    else if (domain === "agent") group = config.resources.agents;
    else if (domain === "skill") group = config.resources.skills;
    else {
      ui.error(`Unsupported domain: ${domain}`);
      return;
    }

    if (options.dryRun) {
      ui.dryRun(`Would remove ${name}`);
      return;
    }

    delete group[name];
    ui.success(`Removed ${name}`);
  }

  await configManager.write(config);

  console.log(ui.format.summary(timer.elapsed(), "resource(s) removed"));

  if (options.fromAll) {
    await syncCommand({});
  }
}

export async function moveCommand(domain: string, name: string, options: { toGlobal?: boolean, toLocal?: boolean, toClient?: string, push?: boolean }) {
  const timer = ui.startTimer();
  const configManager = getConfigManager();
  const config = await configManager.read();

  console.log(ui.format.brandHeader(getVersion(), config.activeProfile));
  ui.header(`Moving ${domain} resource: ${name}...`);

  let resourceGroup: any;
  if (domain === "mcp") resourceGroup = config.resources.mcps;
  else if (domain === "agent") resourceGroup = config.resources.agents;
  else {
    ui.error(`Unsupported domain: ${domain}`);
    return;
  }

  const resource = resourceGroup[name];
  if (!resource) {
    ui.error(`Resource ${name} not found in master config.`);
    process.exitCode = 1;
    return;
  }

  const destinationCount = Number(Boolean(options.toGlobal)) + Number(Boolean(options.toLocal));
  if (destinationCount !== 1) {
    ui.error("Specify exactly one destination: --to-global or --to-local.");
    process.exitCode = 1;
    return;
  }

  if (options.toGlobal) resource.scope = "global";
  if (options.toLocal) resource.scope = "local";

  await configManager.write(config);
  ui.success(`Successfully updated scope for ${name}`);

  console.log(ui.format.summary(timer.elapsed(), `scope changed for "${name}"`));

  if (options.push) {
    await syncCommand({});
  }
}
