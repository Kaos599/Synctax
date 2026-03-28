import * as ui from "../ui/index.js";
import { adapters } from "../adapters/index.js";
import { getConfigManager } from "./_shared.js";

export async function listCommand() {
  const configManager = getConfigManager();
  const config = await configManager.read();
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
}

export async function statusCommand() {
  const configManager = getConfigManager();
  const config = await configManager.read();
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
  const enabledClients = Object.entries(config.clients)
    .filter(([_, clientConf]) => clientConf.enabled)
    .map(([id, _]) => ({ id, adapter: adapters[id] }))
    .filter(c => c.adapter);

  let clientsChecked = enabledClients.length;

  // Parallelize reading client configs
  await Promise.all(enabledClients.map(async ({ adapter }) => {
    try {
      const data = await adapter!.read();
      let inSync = true;
      let driftDetails = [];

      for (const [name, server] of Object.entries(mcps)) {
        if (!data.mcps[name]) { driftDetails.push(`Missing MCP: ${name}`); inSync = false; }
        else if (JSON.stringify(server) !== JSON.stringify(data.mcps[name])) { driftDetails.push(`Drift in MCP: ${name}`); inSync = false; }
      }
      for (const [name, agent] of Object.entries(agents)) {
        if (!data.agents[name]) { driftDetails.push(`Missing Agent: ${name}`); inSync = false; }
        else if (JSON.stringify(agent) !== JSON.stringify(data.agents[name])) { driftDetails.push(`Drift in Agent: ${name}`); inSync = false; }
      }
      for (const [name, skill] of Object.entries(skills)) {
        if (!data.skills[name]) { driftDetails.push(`Missing Skill: ${name}`); inSync = false; }
        else if (JSON.stringify(skill) !== JSON.stringify(data.skills[name])) { driftDetails.push(`Drift in Skill: ${name}`); inSync = false; }
      }

      if (inSync) {
        ui.success(`${adapter!.name}: In Sync`, { indent: 2 });
      } else {
        ui.warn(`${adapter!.name}: Out of Sync (${driftDetails.length} issues)`, { indent: 2 });
        driftDetails.forEach(d => ui.dim(`      - ${d}`));
      }
    } catch (e: any) {
      ui.error(`${adapter!.name}: Error reading config (${e.message})`, { indent: 2 });
    }
  }));

  if (clientsChecked === 0) {
    ui.dim("    No clients enabled.");
  }
}

export async function doctorCommand(options: any): Promise<boolean> {
  const configManager = getConfigManager();
  ui.header("Diagnosing agentsync setup...");
  let healthy = true;

  try {
    const config = await configManager.read();

    const enabledClients = Object.entries(config.clients)
      .filter(([_, clientConf]) => clientConf.enabled);

    await Promise.all(enabledClients.map(async ([id, _]) => {
      const adapter = adapters[id];
      if (!adapter) {
        ui.error(`Adapter missing for enabled client: ${id}`);
        healthy = false;
        return;
      }

      const detected = await adapter.detect();
      if (!detected) {
        ui.warn(`Enabled client ${adapter.name} config not found on disk.`);
        healthy = false;
      } else {
        ui.success(`Client ${adapter.name} config found.`);
      }
    }));

  } catch (e: any) {
    ui.error(`Config schema error: ${e.message}`);
    healthy = false;
  }

  if (healthy) console.log("\n" + ui.format.success("All checks passed!"));
  else console.log("\n" + ui.format.warn("Issues found.", { prefix: "" }));

  return healthy;
}

export async function infoCommand() {
  const configManager = getConfigManager();
  ui.header("\nGathering system intelligence...\n");

  const config = await configManager.read();

  const table = ui.createTable({
    headers: ["Client", "Installed", "MCPs", "Agents", "Skills"],
  });

  const adapterEntries = Object.entries(adapters);
  const rows = await Promise.all(adapterEntries.map(async ([id, adapter]) => {
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

    return [
      isActive ? ui.semantic.highlight(adapter.name) : ui.semantic.muted(adapter.name),
      installed ? ui.semantic.success("Yes") : ui.semantic.error("No"),
      `${mcpCount} MCP${mcpCount !== 1 ? "s" : ""}`,
      `${agentCount} Agent${agentCount !== 1 ? "s" : ""}`,
      `${skillCount} Skill${skillCount !== 1 ? "s" : ""}`
    ];
  }));

  for (const row of rows) {
    table.push(row);
  }

  console.log(table.toString());
  console.log("\n");
}
