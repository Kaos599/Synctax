import { adapters } from "../adapters/index.js";
import { ConfigManager } from "../config.js";
import { getVersion } from "../version.js";
import type { TuiFrameData } from "./ink-types.js";

function getDefaultSource(adapterIds: string[]): string {
  if (adapterIds.includes("claude")) {
    return "claude";
  }

  return adapterIds[0] ?? "unknown";
}

export async function loadTuiFrameData(): Promise<TuiFrameData> {
  const manager = new ConfigManager();
  const config = await manager.read();
  const adapterIds = Object.keys(adapters);
  const warnings: string[] = [];

  const fallbackSource = getDefaultSource(adapterIds);
  const normalizedSource = config.source?.trim();
  let source = normalizedSource || fallbackSource;

  if (normalizedSource && !Object.hasOwn(adapters, normalizedSource)) {
    warnings.push(`Configured source '${normalizedSource}' is not a valid adapter.`);
    source = fallbackSource;
  }

  const enabledClients = Object.entries(config.clients).filter(
    ([id, client]) => Object.hasOwn(adapters, id) && client?.enabled,
  ).length;
  if (enabledClients === 0) {
    warnings.push("No enabled clients configured.");
  }

  return {
    version: getVersion(),
    profile: config.activeProfile || "default",
    source,
    theme: config.theme ?? "synctax",
    health: warnings.length > 0 ? "WARN" : "OK",
    enabledClients,
    totalClients: adapterIds.length,
    resourceCounts: {
      mcps: Object.keys(config.resources.mcps).length,
      agents: Object.keys(config.resources.agents).length,
      skills: Object.keys(config.resources.skills).length,
    },
    driftClients: 0,
    lastSync: "unknown",
    warnings,
    profileNames: Object.keys(config.profiles),
    resourceNames: {
      mcps: Object.keys(config.resources.mcps),
      agents: Object.keys(config.resources.agents),
      skills: Object.keys(config.resources.skills),
    },
  };
}
