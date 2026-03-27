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
  const enabledClientsStatus = Object.entries(config.clients).filter(([id, clientConf]) => clientConf.enabled && adapters[id]);
  const clientsChecked = enabledClientsStatus.length;

  if (clientsChecked === 0) {
    ui.dim("    No clients enabled.");
  } else {
    // ⚡ Bolt: Parallelize client status checks using Promise.all
    // Why: Avoids sequential I/O delays when reading configs from multiple active clients
    // Impact: Faster status reporting by concurrently verifying client drift
    const statusResults = await Promise.all(enabledClientsStatus.map(async ([id]) => {
      const adapter = adapters[id];
      try {
        const data = await adapter.read();
        let inSync = true;
        let driftDetails: string[] = [];

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

        return { adapterName: adapter.name, inSync, driftDetails, error: null };
      } catch (e: any) {
        return { adapterName: adapter.name, inSync: false, driftDetails: [], error: e.message };
      }
    }));

    for (const res of statusResults) {
      if (res.error) {
        ui.error(`${res.adapterName}: Error reading config (${res.error})`, { indent: 2 });
      } else if (res.inSync) {
        ui.success(`${res.adapterName}: In Sync`, { indent: 2 });
      } else {
        ui.warn(`${res.adapterName}: Out of Sync (${res.driftDetails.length} issues)`, { indent: 2 });
        res.driftDetails.forEach((d: string) => ui.dim(`      - ${d}`));
      }
    }
  }
}

export async function doctorCommand(options: any): Promise<boolean> {
  const configManager = getConfigManager();
  ui.header("Diagnosing agentsync setup...");
  let healthy = true;

  try {
    const config = await configManager.read();

    // Check missing clients
    const enabledClientsDoc = Object.entries(config.clients).filter(([id, clientConf]) => clientConf.enabled);

    // ⚡ Bolt: Parallelize client detection using Promise.all
    // Why: File system checks for client installations are independent and can be done concurrently
    // Impact: Reduces diagnostic time significantly for setups with multiple active clients
    const detectionResults = await Promise.all(enabledClientsDoc.map(async ([id]) => {
      const adapter = adapters[id];
      if (!adapter) {
        return { id, adapterName: null, detected: false, missingAdapter: true };
      }
      const detected = await adapter.detect();
      return { id, adapterName: adapter.name, detected, missingAdapter: false };
    }));

    for (const res of detectionResults) {
      if (res.missingAdapter) {
        ui.error(`Adapter missing for enabled client: ${res.id}`);
        healthy = false;
      } else if (!res.detected) {
        ui.warn(`Enabled client ${res.adapterName} config not found on disk.`);
        healthy = false;
      } else {
        ui.success(`Client ${res.adapterName} config found.`);
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

  // ⚡ Bolt: Parallelize adapter detection and reads using Promise.all
  // Why: Reduces CLI execution time by performing independent I/O operations concurrently instead of sequentially
  // Impact: Measurable speedup in the info command, drastically improving terminal responsiveness
  const rows = await Promise.all(
    Object.entries(adapters).map(async ([id, adapter]) => {
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
    })
  );

  for (const row of rows) {
    table.push(row);
  }

  console.log(table.toString());
  console.log("\n");
}
