import * as ui from "../ui/index.js";
import { checkbox } from "@inquirer/prompts";
import { adapters } from "../adapters/index.js";
import { getConfigManager, mergePermissions } from "./_shared.js";

export async function pullCommand(options: { from: string, merge?: boolean, overwrite?: boolean, domain?: string, interactive?: boolean }) {
  const configManager = getConfigManager();
  ui.header(`Pulling config from ${options.from}...`);

  const adapter = adapters[options.from];
  if (!adapter) {
    ui.error(`Adapter not found for client: ${options.from}`);
    return;
  }

  const config = await configManager.read();

  try {
    const data = await adapter.read();
    let toMerge = data;

    if (options.interactive) {
      const choices = [
        ...Object.keys(data.mcps || {}).map(k => ({ name: `[MCP] ${k}`, value: { domain: 'mcp', key: k }, checked: true })),
        ...Object.keys(data.agents || {}).map(k => ({ name: `[Agent] ${k}`, value: { domain: 'agent', key: k }, checked: true })),
        ...Object.keys(data.skills || {}).map(k => ({ name: `[Skill] ${k}`, value: { domain: 'skill', key: k }, checked: true }))
      ];

      if (choices.length > 0) {
        const selected = await checkbox({
          message: `Select resources to pull from ${adapter.name}:`,
          choices
        });

        toMerge = { mcps: {}, agents: {}, skills: {}, permissions: data.permissions, models: data.models, prompts: data.prompts };
        for (const item of selected) {
          if (item.domain === 'mcp') toMerge.mcps[item.key] = data.mcps[item.key];
          if (item.domain === 'agent') toMerge.agents[item.key] = data.agents[item.key];
          if (item.domain === 'skill') toMerge.skills[item.key] = data.skills[item.key];
        }
      } else {
        console.log(ui.format.warn(`No resources found in ${adapter.name} to pull.`, { prefix: "" }));
        return;
      }
    }

    if (options.overwrite) {
      if (!options.domain || options.domain === 'mcp') { config.resources.mcps = toMerge.mcps; }
      if (!options.domain || options.domain === 'agents') { config.resources.agents = toMerge.agents; }
      if (!options.domain || options.domain === 'skills') { config.resources.skills = toMerge.skills; }
      if (!options.domain || options.domain === 'permissions') { config.resources.permissions = toMerge.permissions; }
      if (!options.domain || options.domain === 'models') { config.resources.models = toMerge.models; }
      if (!options.domain || options.domain === 'prompts') { config.resources.prompts = toMerge.prompts; }
    } else {
      if (!options.domain || options.domain === 'mcp') { config.resources.mcps = { ...config.resources.mcps, ...toMerge.mcps }; }
      if (!options.domain || options.domain === 'agents') { config.resources.agents = { ...config.resources.agents, ...toMerge.agents }; }
      if (!options.domain || options.domain === 'skills') { config.resources.skills = { ...config.resources.skills, ...toMerge.skills }; }
      if (!options.domain || options.domain === 'permissions') { config.resources.permissions = mergePermissions(config.resources.permissions, toMerge.permissions); }
      if (!options.domain || options.domain === 'models') { config.resources.models = { ...config.resources.models, ...toMerge.models }; }
      if (!options.domain || options.domain === 'prompts') { config.resources.prompts = { ...config.resources.prompts, ...toMerge.prompts }; }
    }

    config.source = options.from;

    await configManager.write(config);
    ui.success(`Successfully pulled resources from ${adapter.name}`);
  } catch (e: any) {
    ui.error(`Failed to pull config: ${e.message}`);
  }
}
