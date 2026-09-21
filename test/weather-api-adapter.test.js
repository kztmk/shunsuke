const test = require('node:test');
const assert = require('node:assert/strict');
const { createWeatherApiAdapter } = require('../src/WeatherApiAdapter');

test('WeatherAPIアダプターは選択市区町村の前日と当日から翌々日を出典・取得時刻付きで返す', () => {
  const raw = [];
  const adapter = createWeatherApiAdapter({
    client: {
      search: () => [{ id: 1, name: '渋谷区', region: '東京都' }],
      current: () => ({ condition: { text: '小雨' } }),
      history: () => ({ day: { condition: { text: '晴れ' } } }),
      forecast: () => [{ date: '2026-09-21', day: { condition: { text: '雨' } } }, { date: '2026-09-22', day: { condition: { text: 'くもり' } } }, { date: '2026-09-23', day: { condition: { text: '晴れ' } } }],
    },
    rawStore: { save: (value) => raw.push(value) },
  });
  const result = adapter.collect({ prefecture: '東京都', municipality: '渋谷区', todayJst: '2026-09-21', fetchedAt: '2026-09-21T05:00:00+09:00' });
  assert.deepEqual(result, { ok: true, code: 'COLLECTED', locationKey: '1', evidence: [
    { targetDate: '2026-09-20', summary: '晴れ', sourceType: 'history', rawExpiresAt: '', source: 'WeatherAPI.com', fetchedAt: '2026-09-21T05:00:00+09:00', attribution: 'Weather data by WeatherAPI.com', disclaimerVersion: 'forecast_may_change_v1' },
    { targetDate: '2026-09-21', summary: '雨', sourceType: 'forecast', rawExpiresAt: '2026-09-22T05:00:00+09:00', source: 'WeatherAPI.com', fetchedAt: '2026-09-21T05:00:00+09:00', attribution: 'Weather data by WeatherAPI.com', disclaimerVersion: 'forecast_may_change_v1' },
    { targetDate: '2026-09-22', summary: 'くもり', sourceType: 'forecast', rawExpiresAt: '2026-09-22T05:00:00+09:00', source: 'WeatherAPI.com', fetchedAt: '2026-09-21T05:00:00+09:00', attribution: 'Weather data by WeatherAPI.com', disclaimerVersion: 'forecast_may_change_v1' },
    { targetDate: '2026-09-23', summary: '晴れ', sourceType: 'forecast', rawExpiresAt: '2026-09-22T05:00:00+09:00', source: 'WeatherAPI.com', fetchedAt: '2026-09-21T05:00:00+09:00', attribution: 'Weather data by WeatherAPI.com', disclaimerVersion: 'forecast_may_change_v1' },
  ] });
  assert.equal(JSON.stringify(raw).includes('weather-test-key'), false);
});

test('WeatherAPIアダプターは日付欠落・重複・不正日時を成功扱いしない', () => {
  const adapter = createWeatherApiAdapter({
    client: { search: () => [{ id: 1 }], current: () => ({}), history: () => ({ day: { condition: { text: '晴れ' } } }), forecast: () => [
      { date: '2026-09-21', day: { condition: { text: '雨' } } }, { date: '2026-09-21', day: { condition: { text: '雨' } } }, { date: '2026-09-23', day: { condition: { text: '晴れ' } } },
    ] },
    rawStore: { save: () => {} },
  });
  assert.deepEqual(adapter.collect({ prefecture: '東京都', municipality: '渋谷区', todayJst: '2026-09-21', fetchedAt: '2026-09-21T05:00:00+09:00' }), { ok: false, code: 'FORECAST_INCOMPLETE' });
  assert.deepEqual(adapter.collect({ prefecture: '東京都', municipality: '渋谷区', todayJst: '2026-02-31', fetchedAt: '2026-09-21T05:00:00+09:00' }), { ok: false, code: 'WEATHER_INPUT_INVALID' });
});

test('WeatherAPIアダプターは曖昧地域と契約・429・5xx・タイムアウトを分類する', () => {
  const ambiguous = createWeatherApiAdapter({ client: { search: () => [{ id: 1 }, { id: 2 }] }, rawStore: { save: () => {} } });
  assert.deepEqual(ambiguous.collect({ prefecture: '東京都', municipality: '渋谷区', todayJst: '2026-09-21', fetchedAt: '2026-09-21T05:00:00+09:00' }), { ok: false, code: 'LOCATION_AMBIGUOUS' });
  [
    [{ status: 403, providerCode: 2009 }, 'PLAN_INSUFFICIENT'],
    [{ status: 429 }, 'RATE_LIMITED'], [{ status: 503 }, 'SERVICE_UNAVAILABLE'], [{ code: 'TIMEOUT' }, 'TIMEOUT'],
  ].forEach(([error, code]) => {
    const adapter = createWeatherApiAdapter({ client: { search: () => { throw error; } }, rawStore: { save: () => {} } });
    assert.deepEqual(adapter.collect({ prefecture: '東京都', municipality: '渋谷区', todayJst: '2026-09-21', fetchedAt: '2026-09-21T05:00:00+09:00' }), { ok: false, code });
  });
});

test('WeatherAPIアダプターは保存期限を過ぎた生応答だけを削除する', () => {
  let deletedAt = null;
  const adapter = createWeatherApiAdapter({ client: {}, rawStore: { deleteExpiredBefore: (nowJst) => { deletedAt = nowJst; return 2; } } });
  assert.deepEqual(adapter.purgeExpiredRaw('2026-09-22T05:00:00+09:00'), { ok: true, code: 'PURGED', count: 2 });
  assert.equal(deletedAt, '2026-09-22T05:00:00+09:00');
});
