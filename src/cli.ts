#!/usr/bin/env node
import path from 'node:path';
import { mkdir, readdir } from 'node:fs/promises';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { getAdapter, defaultTargetPath } from './adapters';
import { renderBanner } from './banner';
import { formatDiff } from './diff';
import {
  defaultRegistryPath,
  defaultWorkspacePath,
  initRegistry,
  loadRegistry,
  writeJson,
} from './io';
import { validateRegistry } from './schema';
import { resolveDesiredState } from './resolve';

interface CliFlags {
  [key: string]: string | boolean;
}

function parseArgv(argv: string[]): { command: string; flags: CliFlags } {
  const command = argv[2] ?? 'help';
  const flags: CliFlags = {};
  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    i += 1;
  }
  return { command, flags };
}

function asString(flags: CliFlags, key: string, fallback?: string): string | undefined {
  const value = flags[key];
  if (typeof value === 'string') return value;
  return fallback;
}

function asBool(flags: CliFlags, key: string): boolean {
  return flags[key] === true;
}

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(`${message} [y/N] `);
    return ['y', 'yes'].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
}

function printHelp() {
  console.log(`synctax commands:
  init
  scan
  import
  diff
  apply
  pull
  list
  promote
  demote
  map
  auth
  doctor
  backup
  restore
  validate
  use
  explain

Core flags: --profile --to --from --scope --workspace --all --dry-run --strict --merge --adopt --json --yes --verbose`);
}

async function main() {
  const { command, flags } = parseArgv(process.argv);

  if (!asBool(flags, 'no-banner')) {
    console.log(renderBanner());
  }

  const cwd = process.cwd();
  const registryPath = path.resolve(asString(flags, 'registry', defaultRegistryPath())!);
  const workspacePath = path.resolve(
    asString(flags, 'workspace', defaultWorkspacePath(cwd))!,
  );
  const profile = asString(flags, 'profile');
  const adapterName = asString(flags, 'to', 'generic-json')!;
  const targetPath = path.resolve(asString(flags, 'target', defaultTargetPath(adapterName, cwd))!);
  const backupRoot = path.resolve(asString(flags, 'backup-dir', path.join(cwd, '.synctax', 'backups'))!);

  if (command === 'help' || command === '--help') {
    printHelp();
    return;
  }

  if (command === 'init') {
    await initRegistry(registryPath);
    await mkdir(path.dirname(workspacePath), { recursive: true });
    await writeJson(workspacePath, { overrides: {} });
    console.log(`Initialized registry at ${registryPath}`);
    console.log(`Initialized workspace overrides at ${workspacePath}`);
    return;
  }

  if (command === 'validate') {
    const registry = await loadRegistry(registryPath);
    const errors = validateRegistry(registry);
    if (errors.length > 0) {
      console.error(errors.join('\n'));
      process.exitCode = 1;
      return;
    }
    console.log('Registry is valid.');
    return;
  }

  if (command === 'list') {
    const registry = await loadRegistry(registryPath);
    const entity = asString(flags, 'entity');
    const state = await resolveDesiredState(registry, profile, workspacePath);

    if (entity && entity in state) {
      console.log(Object.keys(state[entity as keyof typeof state]).join('\n'));
      return;
    }

    for (const [key, map] of Object.entries(state)) {
      console.log(`${key}: ${Object.keys(map).length}`);
    }
    return;
  }

  if (command === 'doctor') {
    const registry = await loadRegistry(registryPath);
    const adapter = getAdapter(adapterName);
    const desired = await resolveDesiredState(registry, profile, workspacePath);
    const warnings = await adapter.validate(targetPath);
    const unsupported = Object.keys(desired)
      .filter((entity) => !adapter.capabilities().supports.includes(entity as never))
      .filter((entity) => Object.keys(desired[entity as keyof typeof desired]).length > 0);

    if (warnings.length === 0 && unsupported.length === 0) {
      console.log('Doctor: healthy');
      return;
    }
    if (warnings.length > 0) {
      console.log(warnings.join('\n'));
    }
    if (unsupported.length > 0) {
      console.log(
        `Lossy translation warnings: ${unsupported.join(', ')} are not fully supported by ${adapterName}`,
      );
    }
    return;
  }

  if (command === 'backup') {
    const adapter = getAdapter(adapterName);
    const backupPath = await adapter.backup(targetPath, backupRoot);
    console.log(`Backup written: ${backupPath}`);
    return;
  }

  if (command === 'restore') {
    const adapter = getAdapter(adapterName);
    const requested = asString(flags, 'from');
    let backupFile = requested ? path.resolve(requested) : '';

    if (!backupFile) {
      const files = (await readdir(backupRoot)).sort();
      if (files.length === 0) {
        throw new Error(`No backups found in ${backupRoot}`);
      }
      backupFile = path.join(backupRoot, files[files.length - 1]);
    }

    await adapter.restore(targetPath, backupFile);
    console.log(`Restored ${targetPath} from ${backupFile}`);
    return;
  }

  if (command === 'diff' || command === 'apply') {
    const registry = await loadRegistry(registryPath);
    const desired = await resolveDesiredState(registry, profile, workspacePath);
    const adapter = getAdapter(adapterName);
    const diff = await adapter.diff(targetPath, desired);

    console.log(formatDiff(diff));

    if (command === 'diff') {
      return;
    }

    if (asBool(flags, 'dry-run')) {
      console.log('Dry-run mode: no changes applied.');
      return;
    }

    await adapter.backup(targetPath, backupRoot);
    const hasDestructive = diff.some((entry) => entry.action === 'remove' || entry.action === 'change');
    if (hasDestructive && !asBool(flags, 'yes')) {
      const ok = await confirm('Destructive changes detected. Continue?');
      if (!ok) {
        console.log('Apply cancelled.');
        return;
      }
    }

    await adapter.apply(targetPath, desired);
    console.log(`Applied desired state to ${adapterName} target: ${targetPath}`);
    return;
  }

  if (
    ['scan', 'import', 'pull', 'promote', 'demote', 'map', 'auth', 'use', 'explain'].includes(command)
  ) {
    console.log(`${command} is planned and reserved in the MVP command surface.`);
    return;
  }

  printHelp();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
