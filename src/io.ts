import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { defaultRegistry } from './defaults';
import { validateRegistry } from './schema';
import { Registry } from './types';

export const defaultRegistryPath = () =>
  path.join(homedir(), '.synctax', 'registry.json');

export const defaultWorkspacePath = (cwd: string) =>
  path.join(cwd, '.agent-sync', 'workspace.json');

export async function ensureParent(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await ensureParent(filePath);
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function readJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf8');
  return JSON.parse(content) as T;
}

export async function loadRegistry(filePath: string): Promise<Registry> {
  const registry = await readJson<Registry>(filePath);
  const errors = validateRegistry(registry);
  if (errors.length > 0) {
    throw new Error(`Invalid registry:\n- ${errors.join('\n- ')}`);
  }
  return registry;
}

export async function initRegistry(filePath: string): Promise<void> {
  await writeJson(filePath, defaultRegistry());
}
