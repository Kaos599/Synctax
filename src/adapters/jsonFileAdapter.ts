import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { diffEntities } from '../diff';
import { Adapter, AdapterCapabilities, RegistryEntities } from '../types';

function emptyState(): RegistryEntities {
  return {
    agents: {},
    skills: {},
    mcps: {},
    permissions: {},
    commands: {},
    profiles: {},
    presets: {},
    workspaceOverrides: {},
  };
}

function tsStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function readState(targetPath: string): Promise<RegistryEntities> {
  try {
    const raw = await readFile(targetPath, 'utf8');
    return JSON.parse(raw) as RegistryEntities;
  } catch {
    return emptyState();
  }
}

export class JsonFileAdapter implements Adapter {
  constructor(public name: string, private readonly supports: AdapterCapabilities['supports']) {}

  async discover(targetPath: string): Promise<RegistryEntities> {
    return readState(targetPath);
  }

  async validate(targetPath: string): Promise<string[]> {
    try {
      await readFile(targetPath, 'utf8');
      return [];
    } catch {
      return [`${this.name} target is missing: ${targetPath}`];
    }
  }

  async diff(targetPath: string, desired: RegistryEntities) {
    const current = await this.discover(targetPath);
    const changes = diffEntities(current, desired);
    const unsupportedChanges = changes
      .filter((entry) => !this.supports.includes(entry.entity))
      .map((entry) => ({
        ...entry,
        action: 'warn' as const,
        message: `lossy translation for ${entry.entity} on adapter ${this.name}`,
      }));
    return [...changes, ...unsupportedChanges];
  }

  async apply(targetPath: string, desired: RegistryEntities): Promise<void> {
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, `${JSON.stringify(desired, null, 2)}\n`, 'utf8');
  }

  async backup(targetPath: string, backupRoot: string): Promise<string> {
    await mkdir(backupRoot, { recursive: true });
    const backupPath = path.join(backupRoot, `${this.name}-${tsStamp()}.json`);
    try {
      await copyFile(targetPath, backupPath);
    } catch {
      await writeFile(backupPath, `${JSON.stringify(emptyState(), null, 2)}\n`, 'utf8');
    }
    return backupPath;
  }

  async restore(targetPath: string, backupFile: string): Promise<void> {
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(backupFile, targetPath);
  }

  capabilities(): AdapterCapabilities {
    return {
      name: this.name,
      supports: this.supports,
      scopes: ['global', 'workspace', 'profile'],
      lossyTranslations: [
        'Adapters preserve unsupported entities with warning-only semantics in MVP mode.',
      ],
    };
  }
}
