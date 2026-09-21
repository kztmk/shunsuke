const test = require('node:test');
const assert = require('node:assert/strict');
const { createGasWeatherApiClient } = require('../src/GasWeatherApiClient');

test('GAS WeatherAPIクライアントはScriptPropertiesのキーでHTTPS検索・現在値・履歴・予報を取得する', () => {
  const requests = [];
  const client = createGasWeatherApiClient({
    scriptProperties: { get: (key) => key === 'WEATHER_API_KEY' ? 'test-only-key' : null },
    urlFetch: { fetch: (url, options) => {
      requests.push({ url, options });
      const payload = url.includes('/search.json') ? [{ id: 1, name: '渋谷区' }] : {
        current: { condition: { text: '晴れ' } }, forecast: { forecastday: [{ date: '2026-09-21', day: { condition: { text: '雨' } } }] },
      };
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(payload) };
    } },
  });

  assert.deepEqual(client.search('東京都 渋谷区'), [{ id: 1, name: '渋谷区' }]);
  assert.deepEqual(client.current('1'), { condition: { text: '晴れ' } });
  assert.deepEqual(client.history('1', '2026-09-20'), { date: '2026-09-21', day: { condition: { text: '雨' } } });
  assert.deepEqual(client.forecast('1', 3), [{ date: '2026-09-21', day: { condition: { text: '雨' } } }]);
  assert.equal(requests.length, 4);
  assert.equal(requests.every((request) => request.url.startsWith('https://api.weatherapi.com/v1/')), true);
  assert.equal(requests.every((request) => request.options.muteHttpExceptions === true), true);
  assert.equal(JSON.stringify(requests.map((request) => ({ path: request.url.split('?')[0], options: request.options }))).includes('test-only-key'), false);
});

test('GAS WeatherAPIクライアントはキー未設定とHTTPエラーを秘密情報なしで分類する', () => {
  const missingKey = createGasWeatherApiClient({ scriptProperties: { get: () => '' }, urlFetch: { fetch: () => assert.fail('キー未設定で通信してはならない') } });
  assert.throws(() => missingKey.search('東京都 渋谷区'), (error) => error.providerCode === 1002 && error.status === 401);

  const client = createGasWeatherApiClient({
    scriptProperties: { get: () => 'test-only-key' },
    urlFetch: { fetch: () => ({ getResponseCode: () => 429, getContentText: () => JSON.stringify({ error: { code: 2007 } }) }) },
  });
  assert.throws(() => client.search('東京都 渋谷区'), (error) => error.status === 429 && error.providerCode === 2007 && !Object.hasOwn(error, 'url'));
});

test('GAS WeatherAPIクライアントは現在値と予報の生応答だけを期限付きストアへ渡す', () => {
  const saved = [];
  const client = createGasWeatherApiClient({
    scriptProperties: { get: () => 'test-only-key' },
    rawStore: { save: (entry) => saved.push(entry) },
    urlFetch: { fetch: (url) => ({
      getResponseCode: () => 200,
      getContentText: () => url.includes('current')
        ? JSON.stringify({ current: { condition: { text: '晴れ' } } })
        : JSON.stringify({ forecast: { forecastday: [] } }),
    }) },
  });

  client.current('1', '2026-09-21T10:00:00+09:00');
  client.forecast('1', 3, '2026-09-21T10:00:00+09:00');

  assert.deepEqual(saved.map(({ sourceType, rawExpiresAt, response }) => ({ sourceType, rawExpiresAt, response })), [
    { sourceType: 'current', rawExpiresAt: '2026-09-21T11:00:00+09:00', response: { current: { condition: { text: '晴れ' } } } },
    { sourceType: 'forecast', rawExpiresAt: '2026-09-22T10:00:00+09:00', response: { forecast: { forecastday: [] } } },
  ]);
});
