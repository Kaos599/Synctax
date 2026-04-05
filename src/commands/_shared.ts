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

  // v2: Merge Claude-style unified permissions (deny wins over allow)
  const allow = new Set([...(p1.allow || []), ...(p2.allow || [])]);
  const deny = new Set([...(p1.deny || []), ...(p2.deny || [])]);
  const ask = new Set([...(p1.ask || []), ...(p2.ask || [])]);
  for (const rule of deny) {
    allow.delete(rule);
    ask.delete(rule);
  }

  // v2: Merge URL permissions (deny wins)
  const allowedUrls = new Set([...(p1.allowedUrls || []), ...(p2.allowedUrls || [])]);
  const deniedUrls = new Set([...(p1.deniedUrls || []), ...(p2.deniedUrls || [])]);
  for (const url of deniedUrls) {
    allowedUrls.delete(url);
  }

  return {
    allowedPaths: Array.from(allowedPaths),
    deniedPaths: Array.from(deniedPaths),
    allowedCommands: Array.from(allowedCommands),
    deniedCommands: Array.from(deniedCommands),
    networkAllow: (p1.networkAllow && p2.networkAllow) || false,
    allow: Array.from(allow),
    deny: Array.from(deny),
    ask: Array.from(ask),
    allowedUrls: Array.from(allowedUrls),
    deniedUrls: Array.from(deniedUrls),
    // trustedFolders: intersection semantics (conservative).
    // Both sides must trust a folder for it to survive merge.
    // If either side has no trustedFolders field at all (undefined), skip intersection for that side.
    trustedFolders: p1.trustedFolders === undefined ? (p2.trustedFolders || [])
      : p2.trustedFolders === undefined ? (p1.trustedFolders || [])
      : (p1.trustedFolders || []).filter((f: string) => (p2.trustedFolders || []).includes(f)),
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

export function resolveProfile(profiles: Record<string, any> | undefined, name: string) {
  if (!profiles || !profiles[name]) {
    throw new Error(`Active profile "${name}" not found.`);
  }

  const walk = (current: string, chain: string[]): any => {
    if (chain.includes(current)) {
      throw new Error(`Circular profile extends detected: ${[...chain, current].join(" -> ")}`);
    }

    const profile = profiles[current];
    if (!profile) {
      const parent = chain[chain.length - 1] || name;
      throw new Error(
        `Profile "${parent}" extends missing profile "${current}". Chain: ${[...chain, current].join(" -> ")}`,
      );
    }

    const nextChain = [...chain, current];
    const base = profile.extends ? walk(profile.extends, nextChain) : {};

    return {
      include: profile.include ?? base.include,
      exclude: profile.exclude ?? base.exclude,
      extends: profile.extends,
    };
  };

  return walk(name, []);
}
