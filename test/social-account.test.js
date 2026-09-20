const test = require('node:test');
const assert = require('node:assert/strict');

const { createShunsukeApplication } = require('../src/ShunsukeApplication');

test('saveSocialAccount は日本以外の国を保存せず COUNTRY_FIXED_TO_JAPAN を返す', () => {
  const app = createShunsukeApplication({
    socialAccounts: {
      save: () => assert.fail('日本以外の国を保存してはならない'),
    },
    clock: { nowJst: () => '2026-09-20T10:00:00+09:00' },
  });

  const result = app.saveSocialAccount({
    platform: 'X',
    label: '海外向け',
    country: 'Canada',
    prefecture: '東京都',
    municipality: '渋谷区',
  });

  assert.deepEqual(result, { ok: false, code: 'COUNTRY_FIXED_TO_JAPAN' });
});

test('saveSocialAccount は市区町村なしで保存せず LOCATION_REQUIRED を返す', () => {
  const app = createShunsukeApplication({
    socialAccounts: {
      save: () => assert.fail('市区町村なしの設定を保存してはならない'),
    },
    clock: { nowJst: () => '2026-09-20T10:00:00+09:00' },
  });

  const result = app.saveSocialAccount({
    platform: 'X',
    label: '東京向け',
    country: '日本',
    prefecture: '東京都',
    municipality: '',
  });

  assert.deepEqual(result, { ok: false, code: 'LOCATION_REQUIRED' });
});

test('saveSocialAccount は未対応媒体を保存せず PLATFORM_UNSUPPORTED を返す', () => {
  const app = createShunsukeApplication({
    socialAccounts: {
      save: () => assert.fail('未対応媒体を保存してはならない'),
    },
    clock: { nowJst: () => '2026-09-20T10:00:00+09:00' },
  });

  const result = app.saveSocialAccount({
    platform: 'Instagram',
    label: '東京向け',
    country: '日本',
    prefecture: '東京都',
    municipality: '渋谷区',
  });

  assert.deepEqual(result, { ok: false, code: 'PLATFORM_UNSUPPORTED' });
});

test('saveSocialAccount は未定義の性別を保存せず GENDER_INVALID を返す', () => {
  const app = createShunsukeApplication({
    socialAccounts: {
      save: () => assert.fail('未定義の性別を保存してはならない'),
    },
    clock: { nowJst: () => '2026-09-20T10:00:00+09:00' },
  });

  const result = app.saveSocialAccount({
    platform: 'X',
    label: '東京向け',
    country: '日本',
    prefecture: '東京都',
    municipality: '渋谷区',
    gender: 'ノンバイナリー',
  });

  assert.deepEqual(result, { ok: false, code: 'GENDER_INVALID' });
});

test('saveSocialAccount は未定義の年代を保存せず AGE_BAND_INVALID を返す', () => {
  const app = createShunsukeApplication({
    socialAccounts: {
      save: () => assert.fail('未定義の年代を保存してはならない'),
    },
    clock: { nowJst: () => '2026-09-20T10:00:00+09:00' },
  });

  const result = app.saveSocialAccount({
    platform: 'X',
    label: '東京向け',
    country: '日本',
    prefecture: '東京都',
    municipality: '渋谷区',
    gender: '指定なし',
    ageBand: '35-39',
  });

  assert.deepEqual(result, { ok: false, code: 'AGE_BAND_INVALID' });
});

test('saveSocialAccount は同じ連携先アカウントを二重登録せず DUPLICATE_DESTINATION_ACCOUNT を返す', () => {
  const app = createShunsukeApplication({
    socialAccounts: {
      list: () => [{
        socialAccountId: 'social-existing',
        platform: 'X',
        destinationSpreadsheetId: 'spreadsheet-1',
        destinationAccountId: 'account-1',
      }],
      save: () => assert.fail('同じ連携先アカウントを保存してはならない'),
    },
    clock: { nowJst: () => '2026-09-20T10:00:00+09:00' },
  });

  const result = app.saveSocialAccount({
    socialAccountId: 'social-new',
    platform: 'X',
    label: '東京向け',
    country: '日本',
    prefecture: '東京都',
    municipality: '渋谷区',
    gender: '指定なし',
    ageBand: '指定なし',
    destinationSpreadsheetId: 'spreadsheet-1',
    destinationAccountId: 'account-1',
  });

  assert.deepEqual(result, { ok: false, code: 'DUPLICATE_DESTINATION_ACCOUNT' });
});

test('saveSocialAccount は検索語数が6件を超える場合に保存せず KEYWORD_COUNT_OUT_OF_RANGE を返す', () => {
  const app = createShunsukeApplication({
    socialAccounts: {
      save: () => assert.fail('検索語数が上限超過の設定を保存してはならない'),
    },
    clock: { nowJst: () => '2026-09-20T10:00:00+09:00' },
  });

  const result = app.saveSocialAccount({
    platform: 'X',
    label: '東京向け',
    country: '日本',
    prefecture: '東京都',
    municipality: '渋谷区',
    gender: '指定なし',
    ageBand: '指定なし',
    keywordCount: 7,
    productsPerKeyword: 3,
  });

  assert.deepEqual(result, { ok: false, code: 'KEYWORD_COUNT_OUT_OF_RANGE' });
});
