const test = require('node:test');
const assert = require('node:assert/strict');

const { createShunsukeApplication } = require('../src/ShunsukeApplication');

test('saveApiKey はキー本体を ScriptProperties だけに保存する', () => {
  const stored = [];
  const configured = [];
  const sheetRows = [];
  const app = createShunsukeApplication({
    scriptProperties: {
      set: (key, value) => stored.push({ key, value }),
    },
    appSettings: {
      markKeyConfigured: (provider) => {
        configured.push(provider);
        sheetRows.push({ key: `${provider}ApiKey`, value: 'configured' });
      },
    },
  });

  const result = app.saveApiKey('gemini', 'test-key-value');

  assert.deepEqual(result, { ok: true, code: 'SAVED' });
  assert.deepEqual(stored, [{ key: 'GEMINI_API_KEY', value: 'test-key-value' }]);
  assert.deepEqual(configured, ['gemini']);
  assert.equal(JSON.stringify(sheetRows).includes('test-key-value'), false);
});

test('getConnectionStatus はキー本体を返さず設定状態だけを返す', () => {
  const app = createShunsukeApplication({
    scriptProperties: {
      isConfigured: (key) => key === 'GEMINI_API_KEY',
    },
  });

  const result = app.getConnectionStatus();

  assert.deepEqual(result, { gemini: 'configured', weatherApi: 'not_configured' });
  assert.equal(JSON.stringify(result).includes('test-key-value'), false);
});

test('saveApiKey はWeatherAPIキーもScriptPropertiesだけに保存する', () => {
  const stored = [];
  const app = createShunsukeApplication({
    scriptProperties: { set: (key, value) => stored.push({ key, value }) },
    appSettings: { markKeyConfigured: () => {} },
  });
  assert.deepEqual(app.saveApiKey('weatherApi', 'weather-test-key'), { ok: true, code: 'SAVED' });
  assert.deepEqual(stored, [{ key: 'WEATHER_API_KEY', value: 'weather-test-key' }]);
});

test('testExternalConnections はGemini接続失敗を内部応答なしで分類する', () => {
  const app = createShunsukeApplication({
    connections: {
      testGemini: () => { throw new Error('raw provider response'); },
    },
  });

  const result = app.testExternalConnections();

  assert.deepEqual(result, { gemini: { ok: false, code: 'CONNECTION_FAILED' } });
  assert.equal(JSON.stringify(result).includes('raw provider response'), false);
});

test('testExternalConnections はWeatherAPI接続失敗をキー本体なしで分類する', () => {
  const app = createShunsukeApplication({
    connections: { testWeatherApi: () => { throw new Error('weather-test-key rejected'); } },
  });
  const result = app.testExternalConnections();
  assert.deepEqual(result, { weatherApi: { ok: false, code: 'CONNECTION_FAILED' } });
  assert.equal(JSON.stringify(result).includes('weather-test-key'), false);
});
