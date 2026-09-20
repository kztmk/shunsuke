const test = require('node:test');
const assert = require('node:assert/strict');

const { createShunsukeApplication } = require('../src/ShunsukeApplication');

test('saveApiKey はキー本体を ScriptProperties だけに保存する', () => {
  const stored = [];
  const configured = [];
  const app = createShunsukeApplication({
    scriptProperties: {
      set: (key, value) => stored.push({ key, value }),
    },
    appSettings: {
      markKeyConfigured: (provider) => configured.push(provider),
    },
  });

  const result = app.saveApiKey('gemini', 'test-key-value');

  assert.deepEqual(result, { ok: true, code: 'SAVED' });
  assert.deepEqual(stored, [{ key: 'GEMINI_API_KEY', value: 'test-key-value' }]);
  assert.deepEqual(configured, ['gemini']);
});
