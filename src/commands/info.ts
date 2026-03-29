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
  let clientsChecked = 0;

  // ⚡ Bolt: Parallelize independent I/O (adapter.read()) to reduce total sync check time.
  // Impact: O(N) sequential reads -> O(1) concurrent reads time, significantly speeding up CLI execution.
  const syncPromises = Object.entries(config.clients).map(async ([id, clientConf]: [string, any]) => {
    if (!clientConf.enabled) return null;
    const adapter = adapters[id];
    if (!adapter) return null;

    try {
      const data = await adapter.read();
      return { adapter, data, error: null };
    } catch (e: any) {
      return { adapter, data: null, error: e };
    }
  });

  const syncResults = await Promise.all(syncPromises);

  for (const result of syncResults) {
    if (!result) continue;
    clientsChecked++;
    const { adapter, data, error } = result;

    if (error) {
      ui.error(`${adapter.name}: Error reading config (${error.message})`, { indent: 2 });
      continue;
    }

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
      ui.success(`${adapter.name}: In Sync`, { indent: 2 });
    } else {
      ui.warn(`${adapter.name}: Out of Sync (${driftDetails.length} issues)`, { indent: 2 });
      driftDetails.forEach(d => ui.dim(`      - ${d}`));
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

    // ⚡ Bolt: Parallelize independent I/O (adapter.detect()) to reduce total doctor check time.
    // Impact: Concurrent execution reduces blocking time from multiple disk reads.
    const doctorPromises = Object.entries(config.clients).map(async ([id, clientConf]: [string, any]) => {
      if (!clientConf.enabled) return null;
      const adapter = adapters[id];
      if (!adapter) {
        return { id, adapter: null, detected: false };
      }
      const detected = await adapter.detect();
      return { id, adapter, detected };
    });

    const doctorResults = await Promise.all(doctorPromises);

    for (const result of doctorResults) {
      if (!result) continue;
      const { id, adapter, detected } = result;

      if (!adapter) {
        ui.error(`Adapter missing for enabled client: ${id}`);
        healthy = false;
        continue;
      }

      if (!detected) {
        ui.warn(`Enabled client ${adapter.name} config not found on disk.`);
        healthy = false;
      } else {
        ui.success(`Client ${adapter.name} config found.`);
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

  // ⚡ Bolt: Parallelize independent I/O (adapter.detect() and adapter.read()) to speed up info gathering.
  // Impact: Drastically improves the speed of listing all installed adapters and configurations.
  const infoPromises = Object.entries(adapters).map(async ([id, adapter]) => {
    const installed = await adapter.detect();
    let data = null;
    if (installed) {
      try {
        data = await adapter.read();
      } catch (e) {
        // If config is broken, we just show 0
      }
    }
    return { id, adapter, installed, data };
  });

  const infoResults = await Promise.all(infoPromises);

  for (const { id, adapter, installed, data } of infoResults) {
    let mcpCount = 0;
    let agentCount = 0;
    let skillCount = 0;

    if (data) {
      mcpCount = Object.keys(data.mcps || {}).length;
      agentCount = Object.keys(data.agents || {}).length;
      skillCount = Object.keys(data.skills || {}).length;
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
}
