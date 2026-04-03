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

  const enabledClients = Object.entries(config.clients).filter(([id, conf]) => conf.enabled && adapters[id]);
  const clientsChecked = enabledClients.length;

  // Run adapter I/O in parallel to drastically improve performance when checking multiple clients
  const syncResults = await Promise.all(enabledClients.map(async ([id]) => {
    const adapter = adapters[id];
    try {
      const data = await adapter.read();
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

      return { adapter, success: true, inSync, driftDetails };
    } catch (e: any) {
      return { adapter, success: false, error: e.message };
    }
  }));

  for (const res of syncResults) {
    if (!res.success) {
      ui.error(`${res.adapter.name}: Error reading config (${res.error})`, { indent: 2 });
    } else if (res.inSync) {
      ui.success(`${res.adapter.name}: In Sync`, { indent: 2 });
    } else {
      ui.warn(`${res.adapter.name}: Out of Sync (${res.driftDetails!.length} issues)`, { indent: 2 });
      res.driftDetails!.forEach(d => ui.dim(`      - ${d}`));
    }
  }

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

    const enabledClients = Object.entries(config.clients).filter(([id, conf]) => conf.enabled);

    // Parallelize adapter.detect() calls to improve performance
    const checkResults = await Promise.all(enabledClients.map(async ([id]) => {
      const adapter = adapters[id];
      if (!adapter) {
        return { id, adapter: null, detected: false, error: `Adapter missing for enabled client: ${id}` };
      }

      const detected = await adapter.detect();
      return { id, adapter, detected };
    }));

    for (const res of checkResults) {
      if (res.error) {
        ui.error(res.error);
        healthy = false;
      } else if (!res.detected) {
        ui.warn(`Enabled client ${res.adapter!.name} config not found on disk.`);
        healthy = false;
      } else {
        ui.success(`Client ${res.adapter!.name} config found.`);
      }
    }

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
  // Execute adapter.detect() and adapter.read() for all adapters in parallel to optimize startup time
  const infoResults = await Promise.all(adapterEntries.map(async ([id, adapter]) => {
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

    return { adapter, installed, mcpCount, agentCount, skillCount, isActive };
  }));

  for (const res of infoResults) {
    table.push([
      res.isActive ? ui.semantic.highlight(res.adapter.name) : ui.semantic.muted(res.adapter.name),
      res.installed ? ui.semantic.success("Yes") : ui.semantic.error("No"),
      `${res.mcpCount} MCP${res.mcpCount !== 1 ? "s" : ""}`,
      `${res.agentCount} Agent${res.agentCount !== 1 ? "s" : ""}`,
      `${res.skillCount} Skill${res.skillCount !== 1 ? "s" : ""}`
    ]);
  }

  console.log(table.toString());
  console.log("\n");
}
