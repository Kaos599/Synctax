import path from 'node:path';
import { homedir } from 'node:os';
import { Adapter, EntityKind } from '../types';
import { JsonFileAdapter } from './jsonFileAdapter';

const fullSupport: EntityKind[] = [
  'agents',
  'skills',
  'mcps',
  'permissions',
  'commands',
  'profiles',
  'presets',
  'workspaceOverrides',
];

const claudeSupport: EntityKind[] = [
  'agents',
  'skills',
  'mcps',
  'permissions',
  'commands',
  'profiles',
];

const opencodeSupport: EntityKind[] = ['agents', 'skills', 'mcps', 'permissions', 'commands'];

export function getAdapter(name: string): Adapter {
  if (name === 'claude-code') {
    return new JsonFileAdapter('claude-code', claudeSupport);
  }
  if (name === 'opencode') {
    return new JsonFileAdapter('opencode', opencodeSupport);
  }
  if (name === 'generic-json') {
    return new JsonFileAdapter('generic-json', fullSupport);
  }
  throw new Error(`Unsupported adapter: ${name}`);
}

export function defaultTargetPath(adapterName: string, cwd: string): string {
  if (adapterName === 'claude-code') {
    return path.join(homedir(), '.claude', 'synctax-state.json');
  }
  if (adapterName === 'opencode') {
    return path.join(homedir(), '.opencode', 'synctax-state.json');
  }
  return path.join(cwd, '.synctax', 'generic-state.json');
}
