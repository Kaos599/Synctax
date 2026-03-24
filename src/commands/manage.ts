import * as ui from "../ui/index.js";
import { checkbox } from "@inquirer/prompts";
import { getConfigManager } from "./_shared.js";
import { syncCommand } from "./sync.js";

export async function addCommand(domain: string, name: string, options: any) {
  const configManager = getConfigManager();
  ui.header(`Adding ${domain}: ${name}...`);

  const config = await configManager.read();

  if (domain === "mcp") {
    config.resources.mcps[name] = {
      command: options.command,
      args: options.args,
      env: options.env,
      transport: options.transport,
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

  if (options.push) {
    await syncCommand({});
  }
}

export async function removeCommand(domain: string | undefined, name: string | undefined, options: any) {
  const configManager = getConfigManager();
  const config = await configManager.read();

  if (options.interactive || (!domain && !name)) {
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
      if (item.domain === 'mcp') delete config.resources.mcps[item.key];
      if (item.domain === 'agent') delete config.resources.agents[item.key];
      if (item.domain === 'skill') delete config.resources.skills[item.key];
      ui.success(`Removed ${item.domain}: ${item.key}`);
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

  if (options.fromAll) {
    await syncCommand({});
  }
}

export async function moveCommand(domain: string, name: string, options: { toGlobal?: boolean, toLocal?: boolean, toClient?: string, push?: boolean }) {
  const configManager = getConfigManager();
  ui.header(`Moving ${domain} resource: ${name}...`);

  const config = await configManager.read();

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
    return;
  }

  if (options.toGlobal) resource.scope = "global";
  if (options.toLocal) resource.scope = "local";

  await configManager.write(config);
  ui.success(`Successfully updated scope for ${name}`);

  if (options.push) {
    await syncCommand({});
  }
}
