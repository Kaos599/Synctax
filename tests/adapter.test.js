const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { JsonFileAdapter } = require('../dist/adapters/jsonFileAdapter');

test('json adapter apply and restore from backup', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'synctax-test-'));
  const targetPath = path.join(root, 'target.json');
  const backupRoot = path.join(root, 'backups');

  const adapter = new JsonFileAdapter('generic-json', [
    'agents',
    'skills',
    'mcps',
    'permissions',
    'commands',
    'profiles',
    'presets',
    'workspaceOverrides',
  ]);

  const stateA = {
    agents: { a: { id: 'a', systemPrompt: 'first' } },
    skills: {},
    mcps: {},
    permissions: {},
    commands: {},
    profiles: {},
    presets: {},
    workspaceOverrides: {},
  };

  const stateB = {
    ...stateA,
    agents: { a: { id: 'a', systemPrompt: 'second' } },
  };

  await adapter.apply(targetPath, stateA);
  const backupFile = await adapter.backup(targetPath, backupRoot);
  await adapter.apply(targetPath, stateB);
  await adapter.restore(targetPath, backupFile);

  const restored = await adapter.discover(targetPath);
  assert.equal(restored.agents.a.systemPrompt, 'first');
});
