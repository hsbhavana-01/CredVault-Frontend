const test = require('node:test');
const assert = require('node:assert/strict');

test('API modules load without syntax errors', () => {
  const app = require('./app');
  assert.equal(typeof app, 'function');
});
