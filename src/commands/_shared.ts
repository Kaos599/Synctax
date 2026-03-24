import { ConfigManager } from "../config.js";

// Instantiate per function to avoid caching SYNCTAX_HOME in tests
export function getConfigManager() {
  return new ConfigManager();
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

// Update syncCommand to respect the active profile includes/excludes
export async function applyProfileFilter(resources: any, profile: any) {
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
