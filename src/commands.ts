import chalk from "chalk";
import { checkbox, confirm, select } from "@inquirer/prompts";
import { ConfigManager } from "./config.js";
import { adapters } from "./adapters/index.js";
import type { Agent, ClientAdapter, Config, McpServer, Permissions, ResourceScope, Skill } from "./types.js";
import { printBanner } from "./banner.js";
import { maybePromptAndInstallPath } from "./install-path.js";

// Instantiate per function to avoid caching SYNCTAX_HOME in tests
function getConfigManager() {
  return new ConfigManager();
}

type ClientCapabilities = {
  mcps: boolean;
  agents: boolean;
  skills: boolean;
};

const DEFAULT_CAPABILITIES: ClientCapabilities = { mcps: true, agents: true, skills: true };
const CAPABILITIES: Record<string, ClientCapabilities> = {
  claude: { mcps: true, agents: true, skills: true },
  cursor: { mcps: true, agents: true, skills: true },
  opencode: { mcps: true, agents: true, skills: true },
  antigravity: { mcps: true, agents: true, skills: true },
  cline: { mcps: true, agents: false, skills: false },
  zed: { mcps: true, agents: false, skills: false },
  "github-copilot": { mcps: true, agents: false, skills: false },
  "github-copilot-cli": { mcps: false, agents: false, skills: true },
  "gemini-cli": { mcps: false, agents: false, skills: false },
};

const DEFAULT_PERMISSIONS: Permissions = {
  allowedPaths: [],
  deniedPaths: [],
  allowedCommands: [],
  deniedCommands: [],
  networkAllow: false,
};

type PullProfilePayload = {
  name?: string;
  profile?: Config["profiles"][string];
  resources?: Partial<Config["resources"]>;
};

function normalizeStringArray(value?: string[]): string[] {
  return [...(value || [])].sort();
}

function normalizeEnv(value?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  const source = value || {};
  for (const [key, envValue] of Object.entries(source).sort(([a], [b]) => a.localeCompare(b))) {
    out[key] = envValue;
  }
  return out;
}

function normalizeMcpForStatus(item: McpServer) {
  return {
    command: item.command,
    args: item.args || [],
    env: normalizeEnv(item.env),
    transport: item.transport,
  };
}

function normalizeAgentForStatus(item: Agent) {
  return {
    name: item.name,
    description: item.description || "",
    prompt: item.prompt,
    model: item.model || "",
    tools: normalizeStringArray(item.tools),
  };
}

function normalizeSkillForStatus(item: Skill) {
  return {
    name: item.name,
    description: item.description || "",
    trigger: item.trigger || "",
    content: item.content,
  };
}

function semanticEqualMcp(expected: McpServer, actual: McpServer): boolean {
  return JSON.stringify(normalizeMcpForStatus(expected)) === JSON.stringify(normalizeMcpForStatus(actual));
}

function semanticEqualAgent(expected: Agent, actual: Agent): boolean {
  return JSON.stringify(normalizeAgentForStatus(expected)) === JSON.stringify(normalizeAgentForStatus(actual));
}

function semanticEqualSkill(expected: Skill, actual: Skill): boolean {
  return JSON.stringify(normalizeSkillForStatus(expected)) === JSON.stringify(normalizeSkillForStatus(actual));
}

function withForcedScope<T extends { scope?: ResourceScope }>(
  records: Record<string, T> | undefined,
  scope: "global" | "user" | "project"
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [name, item] of Object.entries(records || {})) {
    out[name] = {
      ...item,
      scope,
    };
  }
  return out;
}

function applyScopePolicy(
  resources: Config["resources"],
  policy: "preserve" | "global" | "user" | "project"
): Config["resources"] {
  if (policy === "preserve") return resources;
  return {
    ...resources,
    mcps: withForcedScope(resources.mcps, policy),
    agents: withForcedScope(resources.agents, policy),
    skills: withForcedScope(resources.skills, policy),
  };
}

function resolveScopeOption(options: any): "global" | "user" | "project" {
  if (options?.project || options?.local) return "project";
  if (options?.user) return "user";
  return "global";
}

export async function initCommand(options: {
  detect?: boolean;
  source?: string;
  force?: boolean;
  theme?: string;
  yes?: boolean;
  noPathPrompt?: boolean;
  skipBanner?: boolean;
}) {
  if (!options.skipBanner) {
    printBanner(options.theme || "rebel");
  }
  const configManager = getConfigManager();
  console.log(chalk.blue("Initializing synctax..."));

  let currentConfig: Config | null = null;
  try {
    currentConfig = await configManager.read();
  } catch (e) {
    // Config may not exist or is invalid
  }

  if (currentConfig && Object.keys(currentConfig.clients).length > 0 && !options.force) {
    console.log(chalk.yellow("Configuration already exists. Use --force to overwrite."));
    return;
  }

  const newConfig: Config = {
    version: 1,
    source: options.source,
    theme: options.theme || "rebel",
    activeProfile: "default",
    profiles: { default: {} },
    clients: {},
    resources: { mcps: {}, agents: {}, skills: {}, permissions: DEFAULT_PERMISSIONS },
  };

  if (options.detect !== false) {
    console.log(chalk.gray("Detecting clients..."));
    console.log(chalk.gray("(Looking for client config files on disk, not running processes.)"));
    for (const [id, adapter] of Object.entries(adapters)) {
      const detected = await adapter.detect();
      if (detected) {
        console.log(chalk.green(`✓ Found ${adapter.name}`));
        newConfig.clients[id] = { enabled: true };
      }
    }
  }

  if (!newConfig.source) {
    const firstClient = Object.keys(newConfig.clients)[0];
    if (firstClient) {
      newConfig.source = firstClient;
      const selectedSource = adapters[firstClient];
      if (selectedSource) {
        console.log(chalk.gray(`Setting ${selectedSource.name} as the default source.`));
      }
    }
  }

  await configManager.write(newConfig);
  console.log(chalk.green("Initialization complete!"));

  await maybePromptAndInstallPath({
    assumeYes: options.yes,
    noPathPrompt: options.noPathPrompt,
  });
}

export async function listCommand() {
  const configManager = getConfigManager();
  const config = await configManager.read();
  const mcps = config.resources.mcps;
  const agents = config.resources.agents;

  if (Object.keys(mcps).length > 0) {
    console.log(chalk.blue("\nRegistered MCP Servers:"));
    for (const [name, server] of Object.entries(mcps)) {
      console.log(`- ${chalk.cyan(name)}: ${server.command} ${server.args?.join(" ") || ""}`);
    }
  } else {
    console.log(chalk.yellow("\nNo MCP servers found."));
  }

  if (Object.keys(agents).length > 0) {
    console.log(chalk.blue("\nRegistered Agents:"));
    for (const [name, agent] of Object.entries(agents)) {
      console.log(`- ${chalk.cyan(name)}: ${agent.description || agent.prompt.slice(0, 30) + '...'}`);
    }
  } else {
    console.log(chalk.yellow("\nNo Agents found."));
  }
}


export async function syncCommand(options: { dryRun?: boolean, interactive?: boolean }) {
  const configManager = getConfigManager();
  console.log(chalk.blue("Starting sync..."));

  const config = await configManager.read();
  let resources: Config["resources"] = await applyProfileFilter(config.resources, config.profiles[config.activeProfile]);
  let scopePolicy: "preserve" | "global" | "user" | "project" | "per-client" = "preserve";
  const perClientScope: Record<string, "preserve" | "global" | "user" | "project"> = {};

  if (options.interactive) {
    const choices = [
      ...Object.keys(resources.mcps || {}).map(k => ({ name: `[MCP] ${k}`, value: { domain: 'mcp', key: k }, checked: true })),
      ...Object.keys(resources.agents || {}).map(k => ({ name: `[Agent] ${k}`, value: { domain: 'agent', key: k }, checked: true })),
      ...Object.keys(resources.skills || {}).map(k => ({ name: `[Skill] ${k}`, value: { domain: 'skill', key: k }, checked: true }))
    ];

    if (choices.length > 0) {
      const selected = await checkbox({
        message: 'Select resources to sync:',
        choices
      });

      const filteredResources: Config["resources"] = {
        mcps: {},
        agents: {},
        skills: {},
        permissions: resources.permissions,
        models: resources.models,
        prompts: resources.prompts,
        credentials: resources.credentials,
      };
      for (const item of selected) {
        if (item.domain === 'mcp') {
          const entry = resources.mcps[item.key];
          if (entry) {
            filteredResources.mcps[item.key] = entry;
          }
        }
        if (item.domain === 'agent') {
          const entry = resources.agents[item.key];
          if (entry) {
            filteredResources.agents[item.key] = entry;
          }
        }
        if (item.domain === 'skill') {
          const entry = resources.skills[item.key];
          if (entry) {
            filteredResources.skills[item.key] = entry;
          }
        }
      }
      resources = filteredResources;
    }

    const enabledClients = Object.entries(config.clients)
      .filter(([, clientConf]) => clientConf.enabled)
      .map(([id]) => id)
      .filter((id) => adapters[id]);

    if (enabledClients.length > 0) {
      scopePolicy = await select({
        message: "Scope behavior for this sync:",
        choices: [
          { name: "Preserve saved scopes", value: "preserve" },
          { name: "Force global scope", value: "global" },
          { name: "Force user scope", value: "user" },
          { name: "Force project scope", value: "project" },
          { name: "Per-client scope overrides", value: "per-client" },
        ],
      });

      if (scopePolicy === "per-client") {
        for (const id of enabledClients) {
          const targetAdapter = adapters[id];
          if (!targetAdapter) continue;

          perClientScope[id] = await select({
            message: `Scope for ${targetAdapter.name}:`,
            choices: [
              { name: "Preserve saved scopes", value: "preserve" },
              { name: "Global", value: "global" },
              { name: "User", value: "user" },
              { name: "Project", value: "project" },
            ],
          });
        }
      }
    }
  }

  if (!options.dryRun) {
    await configManager.backup();
  }

  for (const [id, clientConf] of Object.entries(config.clients)) {
    if (!clientConf.enabled) continue;

    const adapter = adapters[id];
    if (!adapter) continue;

    if (options.dryRun) {
      console.log(chalk.yellow(`[Dry Run] Would write to ${adapter.name}`));
    } else {
      try {
        const targetScope = scopePolicy === "per-client" ? (perClientScope[id] || "preserve") : scopePolicy;
        const scopedResources = applyScopePolicy(resources, targetScope);
        await adapter.write(scopedResources);
        console.log(chalk.green(`✓ Synced ${adapter.name}`));
      } catch (e: any) {
        console.log(chalk.red(`✗ Failed to sync ${adapter.name}: ${e.message}`));
      }
    }
  }

  console.log(chalk.blue("Sync complete!"));
}

export async function memorySyncCommand(options: { source?: string, dryRun?: boolean }) {
  const configManager = getConfigManager();
  console.log(chalk.blue("Starting memory files sync..."));

  const config = await configManager.read();
  const cwd = process.cwd();

  let sourceId = options.source || config.source;
  let sourceAdapter: ClientAdapter | undefined = sourceId ? adapters[sourceId] : undefined;

  if (!sourceAdapter) {
    sourceAdapter = adapters["claude"];
    if (sourceAdapter) {
      console.log(chalk.yellow(`No valid source of truth found. Defaulting to ${sourceAdapter.name}.`));
    } else {
      console.log(chalk.red("No source adapter is available for memory sync."));
      return;
    }
  }

  if (!sourceId) {
    sourceId = "claude";
  }

  const sourceFileName = sourceAdapter.getMemoryFileName();
  const sourceContent = await sourceAdapter.readMemory(cwd);

  if (!sourceContent) {
    console.log(chalk.red(`Could not read source memory file: ${sourceFileName} in ${cwd}`));
    return;
  }

  for (const [id, clientConf] of Object.entries(config.clients)) {
    if (!clientConf.enabled || id === sourceId) continue;

    const adapter = adapters[id];
    if (!adapter) continue;

    const targetFileName = adapter.getMemoryFileName();
    if (options.dryRun) {
      console.log(chalk.yellow(`[Dry Run] Would sync ${sourceFileName} -> ${targetFileName}`));
    } else {
      try {
        await adapter.writeMemory(cwd, sourceContent);
        console.log(chalk.green(`✓ Synced to ${targetFileName}`));
      } catch (e: any) {
         console.log(chalk.red(`✗ Failed to sync to ${targetFileName}: ${e.message}`));
      }
    }
  }
}

export async function pullCommand(options: { from: string, merge?: boolean, overwrite?: boolean, domain?: string, interactive?: boolean }) {
  const configManager = getConfigManager();
  console.log(chalk.blue(`Pulling config from ${options.from}...`));

  const adapter = adapters[options.from];
  if (!adapter) {
    console.log(chalk.red(`Adapter not found for client: ${options.from}`));
    return;
  }

  const config = await configManager.read();

  try {
    const data = await adapter.read();
    let toMerge: Config["resources"] = {
      mcps: { ...data.mcps },
      agents: { ...data.agents },
      skills: { ...data.skills },
      permissions: data.permissions || DEFAULT_PERMISSIONS,
      models: data.models,
      prompts: data.prompts,
      credentials: data.credentials,
    };

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
          permissions: data.permissions || DEFAULT_PERMISSIONS,
          models: data.models,
          prompts: data.prompts,
          credentials: data.credentials,
        };
        for (const item of selected) {
          if (item.domain === 'mcp') {
            const entry = data.mcps[item.key];
            if (entry) {
              toMerge.mcps[item.key] = entry;
            }
          }
          if (item.domain === 'agent') {
            const entry = data.agents[item.key];
            if (entry) {
              toMerge.agents[item.key] = entry;
            }
          }
          if (item.domain === 'skill') {
            const entry = data.skills[item.key];
            if (entry) {
              toMerge.skills[item.key] = entry;
            }
          }
        }
      } else {
        console.log(chalk.yellow(`No resources found in ${adapter.name} to pull.`));
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
      if (!options.domain || options.domain === 'models') { config.resources.models = { ...(config.resources.models || {}), ...(toMerge.models || {}) }; }
      if (!options.domain || options.domain === 'prompts') { config.resources.prompts = { ...(config.resources.prompts || {}), ...(toMerge.prompts || {}) }; }
    }

    config.source = options.from;

    await configManager.write(config);
    console.log(chalk.green(`✓ Successfully pulled resources from ${adapter.name}`));
  } catch (e: any) {
    console.log(chalk.red(`✗ Failed to pull config: ${e.message}`));
  }
}

export async function moveCommand(domain: string, name: string, options: { toGlobal?: boolean, toUser?: boolean, toProject?: boolean, toLocal?: boolean, toClient?: string, push?: boolean }) {
  const configManager = getConfigManager();
  console.log(chalk.blue(`Moving ${domain} resource: ${name}...`));

  const config = await configManager.read();

  let resourceGroup: any;
  if (domain === "mcp") resourceGroup = config.resources.mcps;
  else if (domain === "agent") resourceGroup = config.resources.agents;
  else {
    console.log(chalk.red(`Unsupported domain: ${domain}`));
    return;
  }

  const resource = resourceGroup[name];
  if (!resource) {
    console.log(chalk.red(`Resource ${name} not found in master config.`));
    return;
  }

  if (options.toGlobal) resource.scope = "global";
  if ((options as any).toUser) resource.scope = "user";
  if ((options as any).toProject) resource.scope = "project";
  if (options.toLocal) resource.scope = "project";

  await configManager.write(config);
  console.log(chalk.green(`✓ Successfully updated scope for ${name}`));

  if (options.push) {
    await syncCommand({});
  }
}

export async function profileCreateCommand(name: string, options: { include?: string, exclude?: string }) {
  const configManager = getConfigManager();
  console.log(chalk.blue(`Creating profile: ${name}...`));

  const config = await configManager.read();

  if (config.profiles[name]) {
    console.log(chalk.yellow(`Profile ${name} already exists.`));
    return;
  }

  config.profiles[name] = {
    include: options.include ? options.include.split(",").map(s => s.trim()) : undefined,
    exclude: options.exclude ? options.exclude.split(",").map(s => s.trim()) : undefined
  };

  await configManager.write(config);
  console.log(chalk.green(`✓ Profile ${name} created successfully.`));
}

export async function profileUseCommand(name: string, options: { dryRun?: boolean, noSync?: boolean }) {
  const configManager = getConfigManager();
  console.log(chalk.blue(`Switching to profile: ${name}...`));

  const config = await configManager.read();

  if (!config.profiles[name]) {
    console.log(chalk.red(`Profile ${name} does not exist.`));
    return;
  }

  if (options.dryRun) {
    console.log(chalk.yellow(`[Dry Run] Would switch active profile to ${name}`));
    return;
  }

  config.activeProfile = name;
  await configManager.write(config);
  console.log(chalk.green(`✓ Active profile is now ${name}.`));

  if (!options.noSync) {
    await syncCommand({});
  }
}

// Update syncCommand to respect the active profile includes/excludes
export function applyProfileFilter(resources: Config["resources"], profile: Config["profiles"][string] | undefined): Config["resources"] {
  if (!profile || (!profile.include && !profile.exclude)) return resources;

  const filtered = { ...resources, mcps: { ...resources.mcps }, agents: { ...resources.agents }, skills: { ...resources.skills } };

  // Helper to filter a specific group
  const filterGroup = (group: any) => {
    for (const key of Object.keys(group)) {
      if (profile.include && !profile.include.includes(key)) {
        delete group[key];
        continue;
      }
      if (profile.exclude && profile.exclude.includes(key)) {
        delete group[key];
      }
    }
  };

  filterGroup(filtered.mcps);
  filterGroup(filtered.agents);
  filterGroup(filtered.skills);

  return filtered;
}

export async function statusCommand() {
  const configManager = getConfigManager();
  const config = await configManager.read();
  const resources = await applyProfileFilter(config.resources, config.profiles[config.activeProfile]);
  const mcps = resources.mcps;
  const agents = resources.agents;
  const skills = resources.skills;
  const credentials = config.resources.credentials?.envRefs || {};

  console.log(chalk.blue("System Configuration Status:"));

  // 1. Overall stats
  console.log(chalk.cyan("\n  Overview:"));
  console.log(`    MCPs: ${Object.keys(mcps).length}`);
  console.log(`    Agents: ${Object.keys(agents).length}`);
  console.log(`    Skills: ${Object.keys(skills).length}`);

  // 2. Health check (Credentials/Env vars)
  console.log(chalk.cyan("\n  Health Checks:"));
  let healthIssues = 0;
  for (const [key, envRef] of Object.entries(credentials)) {
    const envName = envRef.replace('$', '');
    if (!process.env[envName]) {
      console.log(chalk.yellow(`    ⚠ Missing Environment Variable: ${envName} (referenced by ${key})`));
      healthIssues++;
    }
  }

  for (const [name, server] of Object.entries(mcps)) {
    if (server.env) {
      for (const [, envVal] of Object.entries(server.env)) {
        if (envVal.startsWith('$')) {
          const envName = envVal.replace('$', '');
          if (!process.env[envName]) {
            console.log(chalk.yellow(`    ⚠ MCP "${name}" requires missing env var: ${envName}`));
            healthIssues++;
          }
        }
      }
    }
  }

  if (healthIssues === 0) {
    console.log(chalk.green("    ✓ All required environment variables and credentials appear to be set."));
  }

  // 3. Sync status
  console.log(chalk.cyan("\n  Client Sync Status:"));
  let clientsChecked = 0;
  for (const [id, clientConf] of Object.entries(config.clients)) {
    if (!clientConf.enabled) continue;
    const adapter = adapters[id];
    if (!adapter) continue;
    clientsChecked++;

    try {
      const data = await adapter.read();
      let inSync = true;
      const driftDetails: string[] = [];
      const capabilities = CAPABILITIES[id] || DEFAULT_CAPABILITIES;

      if (capabilities.mcps) {
        for (const [name, server] of Object.entries(mcps)) {
          const remote = data.mcps[name];
          if (!remote) { driftDetails.push(`Missing MCP: ${name}`); inSync = false; }
          else if (!semanticEqualMcp(server, remote)) { driftDetails.push(`Drift in MCP: ${name}`); inSync = false; }
        }
      }
      if (capabilities.agents) {
        for (const [name, agent] of Object.entries(agents)) {
          const remote = data.agents[name];
          if (!remote) { driftDetails.push(`Missing Agent: ${name}`); inSync = false; }
          else if (!semanticEqualAgent(agent, remote)) { driftDetails.push(`Drift in Agent: ${name}`); inSync = false; }
        }
      }
      if (capabilities.skills) {
        for (const [name, skill] of Object.entries(skills)) {
          const remote = data.skills[name];
          if (!remote) { driftDetails.push(`Missing Skill: ${name}`); inSync = false; }
          else if (!semanticEqualSkill(skill, remote)) { driftDetails.push(`Drift in Skill: ${name}`); inSync = false; }
        }
      }

      if (inSync) {
        console.log(chalk.green(`    ✓ ${adapter.name}: In Sync`));
      } else {
        console.log(chalk.yellow(`    ⚠ ${adapter.name}: Out of Sync (${driftDetails.length} issues)`));
        driftDetails.forEach(d => console.log(chalk.gray(`      - ${d}`)));
      }
    } catch (e: any) {
      console.log(chalk.red(`    ✗ ${adapter.name}: Error reading config (${e.message})`));
    }
  }

  if (clientsChecked === 0) {
    console.log(chalk.gray("    No clients enabled."));
  }
}

// Merge Conservative Logic: Always take the more restrictive rule
export function mergePermissions(p1: any, p2: any) {
  p1 = p1 || {};
  p2 = p2 || {};
  const allowedPaths = new Set([...(p1.allowedPaths || []), ...(p2.allowedPaths || [])]);
  const deniedPaths = new Set([...(p1.deniedPaths || []), ...(p2.deniedPaths || [])]);

  // If a path is in both allowed and denied, remove from allowed (Deny wins)
  for (const path of deniedPaths) {
    allowedPaths.delete(path);
  }

  const allowedCommands = new Set([...(p1.allowedCommands || []), ...(p2.allowedCommands || [])]);
  const deniedCommands = new Set([...(p1.deniedCommands || []), ...(p2.deniedCommands || [])]);

  // Deny wins
  for (const cmd of deniedCommands) {
    allowedCommands.delete(cmd);
  }

  return {
    allowedPaths: Array.from(allowedPaths),
    deniedPaths: Array.from(deniedPaths),
    allowedCommands: Array.from(allowedCommands),
    deniedCommands: Array.from(deniedCommands),
    networkAllow: (p1.networkAllow && p2.networkAllow) || false
  };
}

export async function addCommand(domain: string, name: string, options: any) {
  const configManager = getConfigManager();
  console.log(chalk.blue(`Adding ${domain}: ${name}...`));

  const config = await configManager.read();

  const selectedScope = resolveScopeOption(options);

  if (domain === "mcp") {
    config.resources.mcps[name] = {
      command: options.command,
      args: options.args,
      env: options.env,
      transport: options.transport,
      scope: selectedScope,
    };
  } else if (domain === "agent") {
    config.resources.agents[name] = {
      name: options.name || name,
      prompt: options.prompt || "",
      model: options.model,
      tools: options.tools ? options.tools.split(",") : undefined,
      scope: selectedScope,
    };
  } else if (domain === "skill") {
    config.resources.skills[name] = {
      name: options.name || name,
      description: options.description,
      trigger: options.trigger,
      content: options.content || "",
      scope: selectedScope,
    };
  } else {
    console.log(chalk.red(`Unsupported domain for add: ${domain}`));
    return;
  }

  await configManager.write(config);
  console.log(chalk.green(`✓ Added ${domain} ${name}`));

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
      console.log(chalk.yellow("No resources found to remove."));
      return;
    }

    const selected = await checkbox({
      message: 'Select resources to remove:',
      choices
    });

    if (selected.length === 0) {
      console.log(chalk.yellow("No resources selected."));
      return;
    }

    for (const item of selected) {
      if (item.domain === 'mcp') delete config.resources.mcps[item.key];
      if (item.domain === 'agent') delete config.resources.agents[item.key];
      if (item.domain === 'skill') delete config.resources.skills[item.key];
      console.log(chalk.green(`✓ Removed ${item.domain}: ${item.key}`));
    }
  } else {
    if (!domain || !name) {
      console.log(chalk.red("Must specify domain and name, or use --interactive"));
      return;
    }
    console.log(chalk.blue(`Removing ${domain}: ${name}...`));

    let group: any;
    if (domain === "mcp") group = config.resources.mcps;
    else if (domain === "agent") group = config.resources.agents;
    else if (domain === "skill") group = config.resources.skills;
    else {
      console.log(chalk.red(`Unsupported domain: ${domain}`));
      return;
    }

    if (options.dryRun) {
      console.log(chalk.yellow(`[Dry Run] Would remove ${name}`));
      return;
    }

    delete group[name];
    console.log(chalk.green(`✓ Removed ${name}`));
  }

  await configManager.write(config);

  if (options.fromAll) {
    await syncCommand({});
  }
}

export async function restoreCommand(options: { from?: string }) {
  const configManager = getConfigManager();
  console.log(chalk.blue("Restoring configuration..."));

  // The ConfigManager backup logic writes to .bak files in the config dir
  // Let's implement restore logic directly here or via a new configManager method.
  const fs = await import("fs/promises");
  const path = await import("path");
  const os = await import("os");

  const homeDir = process.env.SYNCTAX_HOME || os.homedir();
  const configDir = path.join(homeDir, ".synctax");

  try {
    const files = await fs.readdir(configDir);
    const backups = files.filter(f => f.startsWith("config.json.") && f.endsWith(".bak")).sort().reverse();

    if (backups.length === 0) {
      console.log(chalk.yellow("No backups found."));
      return;
    }

    const defaultBackup = backups[0];
    if (!defaultBackup) return;
    let targetBackup: string = defaultBackup;
    if (options.from) {
      const requestedFrom = options.from;
      const match = backups.find(b => b.includes(requestedFrom));
      if (match) targetBackup = match;
      else {
        console.log(chalk.red(`Backup matching ${options.from} not found.`));
        return;
      }
    }

    await fs.copyFile(path.join(configDir, targetBackup), path.join(configDir, "config.json"));
    console.log(chalk.green(`✓ Restored from backup: ${targetBackup}`));
  } catch (e: any) {
    console.log(chalk.red(`✗ Restore failed: ${e.message}`));
  }
}

export async function doctorCommand(options: any): Promise<boolean> {
  const configManager = getConfigManager();
  console.log(chalk.blue("Diagnosing synctax setup..."));
  let healthy = true;

  try {
    const config = await configManager.read();

    // Check missing clients
    for (const [id, clientConf] of Object.entries(config.clients)) {
      if (!clientConf.enabled) continue;
      const adapter = adapters[id];
      if (!adapter) {
        console.log(chalk.red(`✗ Adapter missing for enabled client: ${id}`));
        healthy = false;
        continue;
      }

      const detected = await adapter.detect();
      if (!detected) {
        console.log(chalk.yellow(`⚠ Enabled client ${adapter.name} config not found on disk.`));
        healthy = false;
      } else {
        console.log(chalk.green(`✓ Client ${adapter.name} config found.`));
      }
    }

  } catch (e: any) {
    console.log(chalk.red(`✗ Config schema error: ${e.message}`));
    healthy = false;
  }

  if (healthy) console.log(chalk.green("\nAll checks passed!"));
  else console.log(chalk.yellow("\nIssues found."));

  return healthy;
}

export async function profilePullCommand(url: string, options?: any) {
  const configManager = getConfigManager();
  console.log(chalk.blue(`Pulling profile from ${url}...`));

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = (await response.json()) as PullProfilePayload;
    const name = options?.name || payload.name || "downloaded-profile";

    const config = await configManager.read();

    config.profiles[name] = payload.profile || {};

    // Merge resources
    if (payload.resources) {
      if (payload.resources.mcps) config.resources.mcps = { ...config.resources.mcps, ...payload.resources.mcps };
      if (payload.resources.agents) config.resources.agents = { ...config.resources.agents, ...payload.resources.agents };
      if (payload.resources.skills) config.resources.skills = { ...config.resources.skills, ...payload.resources.skills };
      if (payload.resources.permissions) config.resources.permissions = mergePermissions(config.resources.permissions, payload.resources.permissions);
      if (payload.resources.models) config.resources.models = { ...(config.resources.models || {}), ...payload.resources.models };
      if (payload.resources.prompts) config.resources.prompts = { ...(config.resources.prompts || {}), ...payload.resources.prompts };
    }

    await configManager.write(config);
    console.log(chalk.green(`✓ Imported profile ${name}`));

    if (options?.apply) {
      await profileUseCommand(name, {});
    }
  } catch (e: any) {
    console.log(chalk.red(`✗ Failed to pull profile: ${e.message}`));
  }
}

export async function profilePublishCommand(name: string, options?: any): Promise<any> {
  const configManager = getConfigManager();
  const config = await configManager.read();

  if (!config.profiles[name]) {
    console.log(chalk.red(`Profile ${name} not found.`));
    return null;
  }

  // Strip credentials and generate export
  const exportPayload = {
    name,
    profile: config.profiles[name],
    resources: {
      mcps: config.resources.mcps,
      agents: config.resources.agents,
      skills: config.resources.skills,
      permissions: config.resources.permissions,
      models: config.resources.models,
      prompts: config.resources.prompts,
      // Credentials explicitly excluded
    }
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);

  if (options?.output) {
    const fs = await import("fs/promises");
    await fs.writeFile(options.output, jsonStr, "utf-8");
    console.log(chalk.green(`✓ Profile ${name} exported to ${options.output}`));
  } else {
    console.log(chalk.blue(`Profile Export JSON:`));
    console.log(jsonStr);
  }

  return exportPayload;
}

export async function infoCommand() {
  const configManager = getConfigManager();
  console.log(chalk.blue("\nGathering system intelligence...\n"));

  const config = await configManager.read();
  const Table = (await import("cli-table3")).default;

  const table = new Table({
    head: [
      chalk.hex("#E4FF30")("Client"),
      chalk.hex("#4DFFBE")("Installed"),
      chalk.hex("#63C8FF")("MCPs"),
      chalk.hex("#FF2DD1")("Agents"),
      chalk.hex("#FF0B55")("Skills")
    ],
    style: {
      head: [],
      border: ["gray"]
    }
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
      isActive ? chalk.whiteBright.bold(adapter.name) : chalk.gray(adapter.name),
      installed ? chalk.green("Yes") : chalk.red("No"),
      `${mcpCount} MCP${mcpCount !== 1 ? "s" : ""}`,
      `${agentCount} Agent${agentCount !== 1 ? "s" : ""}`,
      `${skillCount} Skill${skillCount !== 1 ? "s" : ""}`
    ]);
  }

  console.log(table.toString());
  console.log("\n");
}

export async function watchCommand(options: any) {
  const configManager = getConfigManager();
  const fs = await import("fs/promises");
  const path = await import("path");
  const os = await import("os");
  const chokidar = await import("chokidar");

  const homeDir = process.env.SYNCTAX_HOME || os.homedir();
  const configPath = path.join(homeDir, ".synctax", "config.json");

  console.log(chalk.magenta("\n👁️  Initializing synctax Watch Daemon..."));
  console.log(chalk.gray(`Watching: ${configPath}`));

  let syncTimeout: any;

  const watcher = chokidar.watch(configPath, {
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    }
  }).on("change", async () => {
    console.log(chalk.yellow(`\n[${new Date().toLocaleTimeString()}] Master config modified.`));

    // Debounce the sync so rapidly saving multiple times doesn't spam
    if (syncTimeout) clearTimeout(syncTimeout);

    syncTimeout = setTimeout(async () => {
      try {
        console.log(chalk.blue("Triggering background sync..."));
        await syncCommand({ dryRun: false });
      } catch (e: any) {
        console.log(chalk.red(`Watch sync failed: ${e.message}`));
      }
    }, 500);
  });

  console.log(chalk.green("Daemon is active. Press Ctrl+C to exit.\n"));
  return watcher;
}

export async function exportCommand(filePath: string) {
  const configManager = getConfigManager();
  const config = await configManager.read();

  const resolvedPath = require("path").resolve(process.cwd(), filePath);
  await (await import("fs/promises")).writeFile(resolvedPath, JSON.stringify(config, null, 2), "utf-8");
  console.log(chalk.green(`✓ Exported master configuration to ${resolvedPath}`));
}

export async function importCommand(filePath: string) {
  const configManager = getConfigManager();

  const resolvedPath = require("path").resolve(process.cwd(), filePath);
  let rawData: string;
  try {
    rawData = await (await import("fs/promises")).readFile(resolvedPath, "utf-8");
  } catch (e: any) {
    console.log(chalk.red(`✗ Could not read file ${resolvedPath}: ${e.message}`));
    return;
  }

  let importedConfig: any;
  try {
    importedConfig = JSON.parse(rawData);
  } catch (e: any) {
    console.log(chalk.red(`✗ Invalid JSON in ${resolvedPath}: ${e.message}`));
    return;
  }

  // Current existing config
  const currentConfig = await configManager.read();
  const currentClients = Object.entries(currentConfig.clients)
    .filter(([, conf]) => conf.enabled)
    .map(([client]) => client);

  // Clients mentioned in imported config
  const importedClients = Object.keys(importedConfig.clients || {}).filter(c => importedConfig.clients[c].enabled);

  // Find clients that are in imported config but not locally enabled
  const missingClients = importedClients.filter(c => !currentClients.includes(c));

  if (missingClients.length > 0) {
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    await new Promise<void>((resolve) => {
      rl.question(chalk.yellow(`The imported config contains clients not currently enabled (${missingClients.join(', ')}). Continue without them? (y/N) `), (answer: string) => {
        rl.close();
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          // Remove missing clients from the imported config
          for (const c of missingClients) {
            delete importedConfig.clients[c];
          }
          resolve();
        } else {
          console.log(chalk.red("Import cancelled."));
          process.exit(1);
        }
      });
    });
  }

  try {
    // Validate schema
    const { ConfigSchema } = await import("./types.js");
    const validConfig = ConfigSchema.parse(importedConfig);

    await configManager.backup();
    await configManager.write(validConfig);

    console.log(chalk.green(`✓ Successfully imported master configuration from ${resolvedPath}`));
  } catch (e: any) {
    console.log(chalk.red(`✗ Imported config is invalid: ${e.message}`));
  }
}
