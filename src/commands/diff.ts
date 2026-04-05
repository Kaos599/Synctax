import * as ui from "../ui/index.js";
import { adapters } from "../adapters/index.js";
import { getConfigManager } from "./_shared.js";
import { getVersion } from "../version.js";
import type { ClientDiff } from "../diff-utils.js";
import { compareDomain, renderClientDiff } from "../diff-utils.js";

export async function diffCommand(clientId?: string, options?: { json?: boolean }) {
  const timer = ui.startTimer();
  const configManager = getConfigManager();
  const config = await configManager.read();

  const targetClientIds = clientId
    ? [clientId]
    : Object.keys(config.clients)
        .filter((id) => config.clients[id]?.enabled)
        .sort((a, b) => a.localeCompare(b));

  if (!options?.json) {
    console.log(ui.format.brandHeader(getVersion(), config.activeProfile));
    ui.header("Comparing master config with client configs...");
  }

  const clientDiffs: ClientDiff[] = [];
  const readErrors: Array<{ id: string; message: string }> = [];

  for (const id of targetClientIds) {
    const adapter = adapters[id];
    if (!adapter) {
      readErrors.push({ id, message: `Unknown client: ${id}` });
      continue;
    }

    try {
      const data = await adapter.read();
      clientDiffs.push({
        id,
        name: adapter.name,
        domains: {
          mcps: compareDomain(config.resources.mcps || {}, data.mcps || {}),
          agents: compareDomain(config.resources.agents || {}, data.agents || {}),
          skills: compareDomain(config.resources.skills || {}, data.skills || {}),
        },
      });
    } catch (error: any) {
      readErrors.push({ id, message: error?.message || String(error) });
    }
  }

  clientDiffs.sort((a, b) => a.id.localeCompare(b.id));

  if (options?.json) {
    console.log(
      JSON.stringify(
        {
          activeProfile: config.activeProfile,
          clients: clientDiffs,
          errors: readErrors,
        },
        null,
        2,
      ),
    );
    if (readErrors.length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (targetClientIds.length === 0) {
    ui.warn("No enabled clients to diff.");
    console.log(ui.format.summary(timer.elapsed(), "0 clients compared"));
    return;
  }

  for (const diff of clientDiffs) {
    renderClientDiff(diff);
  }

  if (readErrors.length > 0) {
    for (const issue of readErrors) {
      ui.error(`${issue.id}: ${issue.message}`);
    }
    process.exitCode = 1;
  }

  console.log(ui.format.summary(timer.elapsed(), `${clientDiffs.length} client${clientDiffs.length === 1 ? "" : "s"} compared`));
}
