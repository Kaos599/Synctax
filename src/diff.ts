import { createHash } from 'node:crypto';
import { DiffEntry, EntityKind, RegistryEntities } from './types';

const entities: EntityKind[] = [
  'agents',
  'skills',
  'mcps',
  'permissions',
  'commands',
  'profiles',
  'presets',
  'workspaceOverrides',
];

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((x) => stable(x)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
}

function digest(value: unknown): string {
  return createHash('sha256').update(stable(value)).digest('hex');
}

export function diffEntities(
  current: RegistryEntities,
  desired: RegistryEntities,
): DiffEntry[] {
  const changes: DiffEntry[] = [];

  for (const entity of entities) {
    const currentMap = current[entity] as Record<string, unknown>;
    const desiredMap = desired[entity] as Record<string, unknown>;

    const ids = new Set([...Object.keys(currentMap), ...Object.keys(desiredMap)]);
    for (const id of ids) {
      const before = currentMap[id];
      const after = desiredMap[id];
      if (before === undefined && after !== undefined) {
        changes.push({ entity, id, action: 'add', after });
      } else if (before !== undefined && after === undefined) {
        changes.push({ entity, id, action: 'remove', before });
      } else if (before !== undefined && after !== undefined && digest(before) !== digest(after)) {
        changes.push({ entity, id, action: 'change', before, after });
      }
    }
  }

  return changes.sort((a, b) =>
    `${a.entity}/${a.id}`.localeCompare(`${b.entity}/${b.id}`),
  );
}

const SENSITIVE_KEY = /(secret|token|password|api[_-]?key|auth)/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = '<redacted>';
    } else {
      out[key] = redact(item);
    }
  }
  return out;
}

export function formatDiff(diff: DiffEntry[]): string {
  if (diff.length === 0) {
    return 'No changes.';
  }
  return diff
    .map((entry) => {
      const head = `${entry.action.toUpperCase()} ${entry.entity}.${entry.id}`;
      if (entry.action === 'warn') {
        return `${head} ${entry.message ?? ''}`.trim();
      }
      if (entry.action === 'add') {
        return `${head}\n+ ${JSON.stringify(redact(entry.after), null, 2)}`;
      }
      if (entry.action === 'remove') {
        return `${head}\n- ${JSON.stringify(redact(entry.before), null, 2)}`;
      }
      return `${head}\n- ${JSON.stringify(redact(entry.before), null, 2)}\n+ ${JSON.stringify(
        redact(entry.after),
        null,
        2,
      )}`;
    })
    .join('\n\n');
}
