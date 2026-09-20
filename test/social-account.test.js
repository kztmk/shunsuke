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
