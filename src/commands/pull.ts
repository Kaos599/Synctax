import * as ui from "../ui/index.js";
import { checkbox } from "@inquirer/prompts";
import { adapters } from "../adapters/index.js";
import { getConfigManager, mergePermissions } from "./_shared.js";
import { getVersion } from "../version.js";
import type { Agent, ClientAdapter, McpServer, Skill } from "../types.js";
import { requireInteractiveTTY } from "./_terminal.js";

type PulledData = Awaited<ReturnType<ClientAdapter["read"]>>;

const PULL_DOMAINS = new Set(["mcp", "mcps", "agent", "agents", "skill", "skills", "permissions", "models", "prompts"]);

function normalizePullDomain(domain?: string): "mcp" | "agents" | "skills" | "permissions" | "models" | "prompts" | undefined {
  if (!domain) return undefined;
  const normalized = domain.trim().toLowerCase();
  if (!PULL_DOMAINS.has(normalized)) return undefined;
  if (normalized === "agent") return "agents";
  if (normalized === "skill") return "skills";
  return normalized as "mcp" | "agents" | "skills" | "permissions" | "models" | "prompts";
}

export async function pullCommand(options: { from: string, merge?: boolean, overwrite?: boolean, domain?: string, interactive?: boolean }) {
  const timer = ui.startTimer();
  const configManager = getConfigManager();

  const adapter = adapters[options.from];
  if (!adapter) {
    ui.error(`Adapter not found for client: ${options.from}`);
    process.exitCode = 1;
    return;
  }

  if (options.merge && options.overwrite) {
    ui.error("Cannot use --merge and --overwrite together.");
    process.exitCode = 1;
    return;
  }

  if (options.interactive && !requireInteractiveTTY("pull --interactive")) {
    return;
  }

  const domain = normalizePullDomain(options.domain);
  if (options.domain && !domain) {
    ui.error(`Invalid --domain value: ${options.domain}`);
    process.exitCode = 1;
    return;
  }

  const config = await configManager.read();
  console.log(ui.format.brandHeader(getVersion(), config.activeProfile));
  ui.header(`Pulling config from ${options.from}...`);

  try {
    const spin = ui.spinner(`Reading from ${adapter.name}...`);
    let data: PulledData;
    try {
      data = await adapter.read();
      const mcpCount = Object.keys(data.mcps || {}).length;
      const agentCount = Object.keys(data.agents || {}).length;
      const skillCount = Object.keys(data.skills || {}).length;
      spin.succeed(`Read ${mcpCount} MCPs, ${agentCount} agents, ${skillCount} skills from ${adapter.name}`);
    } catch (readErr: any) {
      spin.fail(`Failed to read from ${adapter.name}: ${readErr.message}`);
      throw readErr;
    }

    let toMerge: PulledData = data;

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

        toMerge = {
          mcps: {},
          agents: {},
          skills: {},
          permissions: data.permissions,
          models: data.models,
          prompts: data.prompts,
          credentials: data.credentials,
        };
        for (const item of selected) {
          if (item.domain === 'mcp') {
            const mcp = data.mcps[item.key];
            if (mcp) toMerge.mcps[item.key] = mcp as McpServer;
          }
          if (item.domain === 'agent') {
            const agent = data.agents[item.key];
            if (agent) toMerge.agents[item.key] = agent as Agent;
          }
          if (item.domain === 'skill') {
            const skill = data.skills[item.key];
            if (skill) toMerge.skills[item.key] = skill as Skill;
          }
        }
      } else {
        console.log(ui.format.warn(`No resources found in ${adapter.name} to pull.`, { prefix: "" }));
        return;
      }
    }

    const shouldOverwrite = Boolean(options.overwrite);

    if (shouldOverwrite) {
      if (!domain || domain === "mcp") { config.resources.mcps = toMerge.mcps; }
      if (!domain || domain === "agents") { config.resources.agents = toMerge.agents; }
      if (!domain || domain === "skills") { config.resources.skills = toMerge.skills; }
      if (!domain || domain === "permissions" ) {
        if (toMerge.permissions) config.resources.permissions = toMerge.permissions;
      }
      if (!domain || domain === "models") { config.resources.models = toMerge.models; }
      if (!domain || domain === "prompts") { config.resources.prompts = toMerge.prompts; }
    } else {
      if (!domain || domain === "mcp") { config.resources.mcps = { ...config.resources.mcps, ...toMerge.mcps }; }
      if (!domain || domain === "agents") { config.resources.agents = { ...config.resources.agents, ...toMerge.agents }; }
      if (!domain || domain === "skills") { config.resources.skills = { ...config.resources.skills, ...toMerge.skills }; }
      if (!domain || domain === "permissions") { config.resources.permissions = mergePermissions(config.resources.permissions, toMerge.permissions); }
      if (!domain || domain === "models") { config.resources.models = { ...config.resources.models, ...toMerge.models }; }
      if (!domain || domain === "prompts") { config.resources.prompts = { ...config.resources.prompts, ...toMerge.prompts }; }
    }

    config.source = options.from;

    await configManager.write(config);
    ui.success(`Successfully pulled resources from ${adapter.name}`);

    console.log(ui.format.summary(timer.elapsed(), `pulled from ${adapter.name}`));
  } catch (e: any) {
    ui.error(`Failed to pull config: ${e.message}`);
    process.exitCode = 1;
  }
}
