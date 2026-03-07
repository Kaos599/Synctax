import { readFile } from 'node:fs/promises';
import { Registry, RegistryEntities, WorkspaceOverrides } from './types';

const entities: Array<keyof RegistryEntities> = [
  'agents',
  'skills',
  'mcps',
  'permissions',
  'commands',
  'profiles',
  'presets',
  'workspaceOverrides',
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeMaps(
  base: RegistryEntities,
  next: Partial<RegistryEntities>,
): RegistryEntities {
  const merged = clone(base);
  for (const entity of entities) {
    const map = next[entity];
    if (!map) {
      continue;
    }
    for (const [id, value] of Object.entries(map)) {
      if (entity === 'permissions') {
        const current = (merged.permissions[id] ?? {}) as { locked?: boolean };
        if (current.locked) {
          continue;
        }
      }
      (merged[entity] as Record<string, unknown>)[id] = clone(value);
    }
  }
  return merged;
}

function applyProfileFilter(
  state: RegistryEntities,
  include: Registry['profiles'][string]['include'],
): RegistryEntities {
  if (!include) {
    return state;
  }

  const filtered = clone(state);
  for (const [entity, ids] of Object.entries(include)) {
    if (!ids || ids.length === 0) {
      continue;
    }
    const keep = new Set(ids);
    const map = filtered[entity as keyof RegistryEntities] as Record<string, unknown>;
    for (const id of Object.keys(map)) {
      if (!keep.has(id)) {
        delete map[id];
      }
    }
  }
  return filtered;
}

export async function loadWorkspaceOverrides(
  workspacePath?: string,
): Promise<WorkspaceOverrides | undefined> {
  if (!workspacePath) {
    return undefined;
  }
  try {
    const raw = await readFile(workspacePath, 'utf8');
    return JSON.parse(raw) as WorkspaceOverrides;
  } catch {
    return undefined;
  }
}

export async function resolveDesiredState(
  registry: Registry,
  profile?: string,
  workspacePath?: string,
): Promise<RegistryEntities> {
  let state: RegistryEntities = {
    agents: clone(registry.agents),
    skills: clone(registry.skills),
    mcps: clone(registry.mcps),
    permissions: clone(registry.permissions),
    commands: clone(registry.commands),
    profiles: clone(registry.profiles),
    presets: clone(registry.presets),
    workspaceOverrides: clone(registry.workspaceOverrides),
  };

  if (profile) {
    const profileDef = registry.profiles[profile];
    if (!profileDef) {
      throw new Error(`Profile not found: ${profile}`);
    }
    if (profileDef.extends) {
      for (const inherited of profileDef.extends) {
        const inheritedProfile = registry.profiles[inherited];
        if (inheritedProfile?.overrides) {
          state = mergeMaps(state, inheritedProfile.overrides);
        }
      }
    }
    if (profileDef.overrides) {
      state = mergeMaps(state, profileDef.overrides);
    }
    state = applyProfileFilter(state, profileDef.include);
  }

  const workspace = await loadWorkspaceOverrides(workspacePath);
  if (workspace?.overrides) {
    state = mergeMaps(state, workspace.overrides);
  }

  return state;
}
