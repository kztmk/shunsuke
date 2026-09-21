const test = require('node:test');
const assert = require('node:assert/strict');
const { initializeGasWeatherEvidenceSheet } = require('../src/GasWeatherEvidenceSheetInitializer');

const HEADERS = [
  'weatherEvidenceId', 'locationKey', 'source', 'sourceType', 'targetDate',
  'summary', 'fetchedAt', 'rawExpiresAt', 'attribution', 'disclaimerVersion',
];

function makeSheet(initialHeader) {
  let header = initialHeader.slice();
  const writes = [];
  return {
    getHeader: () => header,
    writes,
    getRange: () => ({
      getValues: () => [header],
      setValues: (values) => {
        header = values[0];
        writes.push(values);
      },
    }),
  };
}

test('WeatherEvidenceタブを作成し、1行目に契約済みの見出しを設定する', () => {
  const sheet = makeSheet(Array(HEADERS.length).fill(''));
  const workbook = {
    getSheetByName: () => null,
    insertSheet: (name) => {
      assert.equal(name, 'WeatherEvidence');
      return sheet;
    },
  };

  const result = initializeGasWeatherEvidenceSheet(workbook);

  assert.deepEqual(result, { ok: true, code: 'INITIALIZED', created: true });
  assert.deepEqual(sheet.getHeader(), HEADERS);
});

test('正しい見出しのWeatherEvidenceタブは上書きしない', () => {
  const sheet = makeSheet(HEADERS);
  const workbook = { getSheetByName: () => sheet };

  const result = initializeGasWeatherEvidenceSheet(workbook);

  assert.deepEqual(result, { ok: true, code: 'ALREADY_INITIALIZED', created: false });
  assert.deepEqual(sheet.writes, []);
});

test('既存の異なる見出しは上書きせず、競合として返す', () => {
  const sheet = makeSheet(['existing header', ...Array(HEADERS.length - 1).fill('')]);
  const workbook = { getSheetByName: () => sheet };

  const result = initializeGasWeatherEvidenceSheet(workbook);

  assert.deepEqual(result, { ok: false, code: 'WEATHER_EVIDENCE_HEADERS_CONFLICT', created: false });
  assert.deepEqual(sheet.writes, []);
});
