const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRegistry } = require('../dist/schema');
const { defaultRegistry } = require('../dist/defaults');

test('validateRegistry accepts default registry', () => {
  const errors = validateRegistry(defaultRegistry());
  assert.deepEqual(errors, []);
});

test('validateRegistry fails on invalid MCP', () => {
  const registry = defaultRegistry();
  registry.mcps.invalid = { id: 'invalid' };
  const errors = validateRegistry(registry);
  assert.ok(errors.some((e) => e.includes('mcps.invalid requires either command or url')));
});
