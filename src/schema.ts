import { Registry } from './types';

const requiredTopLevel = [
  'version',
  'agents',
  'skills',
  'mcps',
  'permissions',
  'commands',
  'profiles',
  'presets',
  'workspaceOverrides',
] as const;

const asRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function validateRegistry(registry: unknown): string[] {
  const errors: string[] = [];

  if (!asRecord(registry)) {
    return ['registry must be an object'];
  }

  for (const key of requiredTopLevel) {
    if (!(key in registry)) {
      errors.push(`missing top-level key: ${key}`);
    }
  }

  if (registry.version !== 1) {
    errors.push('registry.version must be 1');
  }

  for (const collection of requiredTopLevel.slice(1)) {
    const value = registry[collection];
    if (!asRecord(value)) {
      errors.push(`${collection} must be an object map`);
    }
  }

  const reg = registry as unknown as Registry;

  for (const [id, agent] of Object.entries(reg.agents || {})) {
    if (agent.id !== id) {
      errors.push(`agents.${id}.id must match map key`);
    }
    if (!agent.systemPrompt) {
      errors.push(`agents.${id}.systemPrompt is required`);
    }
  }

  for (const [id, skill] of Object.entries(reg.skills || {})) {
    if (skill.id !== id) {
      errors.push(`skills.${id}.id must match map key`);
    }
    if (!skill.promptTemplate) {
      errors.push(`skills.${id}.promptTemplate is required`);
    }
  }

  for (const [id, mcp] of Object.entries(reg.mcps || {})) {
    if (mcp.id !== id) {
      errors.push(`mcps.${id}.id must match map key`);
    }
    if (!mcp.command && !mcp.url) {
      errors.push(`mcps.${id} requires either command or url`);
    }
  }

  for (const [id, permission] of Object.entries(reg.permissions || {})) {
    if (permission.id !== id) {
      errors.push(`permissions.${id}.id must match map key`);
    }
  }

  for (const [id, command] of Object.entries(reg.commands || {})) {
    if (command.id !== id) {
      errors.push(`commands.${id}.id must match map key`);
    }
  }

  for (const [id, profile] of Object.entries(reg.profiles || {})) {
    if (profile.id !== id) {
      errors.push(`profiles.${id}.id must match map key`);
    }
  }

  for (const [id, preset] of Object.entries(reg.presets || {})) {
    if (preset.id !== id) {
      errors.push(`presets.${id}.id must match map key`);
    }
  }

  return errors;
}
