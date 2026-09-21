const test = require('node:test');
const assert = require('node:assert/strict');
const { createGasWeatherRawCacheStore } = require('../src/GasWeatherRawCacheStore');

test('GAS天気キャッシュは現在値を60分、予報を最大6時間で自動失効させる', () => {
  const writes = [];
  const store = createGasWeatherRawCacheStore({
    cache: { put: (...arguments_) => writes.push(arguments_) },
    now: () => '2026-09-21T10:00:00+09:00',
  });

  store.save({ locationKey: '1', source: 'WeatherAPI.com', sourceType: 'current', fetchedAt: '2026-09-21T10:00:00+09:00', rawExpiresAt: '2026-09-21T11:00:00+09:00', response: { current: { condition: { text: '晴れ' } } } });
  store.save({ locationKey: '1', source: 'WeatherAPI.com', sourceType: 'forecast', fetchedAt: '2026-09-21T10:00:00+09:00', rawExpiresAt: '2026-09-22T10:00:00+09:00', response: { forecast: { forecastday: [] } } });
  store.save({ locationKey: '1', source: 'WeatherAPI.com', sourceType: 'history', fetchedAt: '2026-09-21T10:00:00+09:00', rawExpiresAt: '' });

  assert.deepEqual(writes.map(([, , seconds]) => seconds), [3600, 21600]);
  assert.equal(writes.every(([, value]) => value.includes('current') || value.includes('forecast')),
    true);
  assert.equal(writes.every(([, value]) => !value.includes('WEATHER_API_KEY')), true);
  assert.equal(store.deleteExpiredBefore('2026-09-22T00:00:00+09:00'), 0);
});
