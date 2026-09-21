const test = require('node:test');
const assert = require('node:assert/strict');
const { createGasWeatherEvidenceStore } = require('../src/GasWeatherEvidenceStore');

test('GAS WeatherEvidenceストアはヘッダー名で根拠を一行ずつ追加し、生応答本文を保存しない', () => {
  const appended = [];
  const headers = ['summary', 'weatherEvidenceId', 'locationKey', 'source', 'sourceType', 'targetDate', 'fetchedAt', 'rawExpiresAt', 'attribution', 'disclaimerVersion'];
  const sheet = {
    getLastColumn: () => headers.length,
    getLastRow: () => 1,
    getRange: (row, _column, _rows, columns) => ({
      getValues: () => row === 1 ? [headers] : [],
      setValues: (values) => appended.push({ row, columns, values }),
    }),
  };
  const store = createGasWeatherEvidenceStore({ sheet, ids: { nextWeatherEvidenceId: () => 'weather-1' } });
  store.saveEvidence({ locationKey: '1', source: 'WeatherAPI.com', sourceType: 'forecast', targetDate: '2026-09-21', summary: '雨', fetchedAt: '2026-09-21T05:00:00+09:00', rawExpiresAt: '2026-09-22T05:00:00+09:00', attribution: 'Weather data by WeatherAPI.com', disclaimerVersion: 'forecast_may_change_v1' });
  assert.deepEqual(appended, [{ row: 2, columns: headers.length, values: [[
    '雨', 'weather-1', '1', 'WeatherAPI.com', 'forecast', '2026-09-21', '2026-09-21T05:00:00+09:00', '2026-09-22T05:00:00+09:00', 'Weather data by WeatherAPI.com', 'forecast_may_change_v1',
  ]] }]);
});
