const test = require('node:test');
const assert = require('node:assert/strict');
const { diffEntities, formatDiff } = require('../dist/diff');

test('diffEntities reports add/remove/change entries', () => {
  const current = {
    agents: { base: { id: 'base', systemPrompt: 'a' } },
    skills: {},
    mcps: {},
    permissions: {},
    commands: {},
    profiles: {},
    presets: {},
    workspaceOverrides: {},
  };
  const desired = {
    agents: {
      base: { id: 'base', systemPrompt: 'b' },
      newOne: { id: 'newOne', systemPrompt: 'c' },
    },
    skills: {},
    mcps: {},
    permissions: {},
    commands: {},
    profiles: {},
    presets: {},
    workspaceOverrides: {},
  };

  const diff = diffEntities(current, desired);
  assert.equal(diff.filter((x) => x.action === 'change').length, 1);
  assert.equal(diff.filter((x) => x.action === 'add').length, 1);
  assert.ok(formatDiff(diff).includes('CHANGE agents.base'));
});
