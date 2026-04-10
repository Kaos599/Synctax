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

  const results = await Promise.all(
    targetClientIds.map(async (id) => {
      const adapter = adapters[id];
      if (!adapter) {
        return { id, success: false as const, message: `Unknown client: ${id}` };
      }

      try {
        const data = await adapter.read();
        return { id, adapter, success: true as const, data };
      } catch (error: any) {
        return { id, success: false as const, message: error?.message || String(error) };
      }
    })
  );

  for (const result of results) {
    if (result.success) {
      clientDiffs.push({
        id: result.id,
        name: result.adapter.name,
        domains: {
          mcps: compareDomain(config.resources.mcps || {}, result.data.mcps || {}),
          agents: compareDomain(config.resources.agents || {}, result.data.agents || {}),
          skills: compareDomain(config.resources.skills || {}, result.data.skills || {}),
        },
      });
    } else {
      readErrors.push({ id: result.id, message: result.message });
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
