const test = require('node:test');
const assert = require('node:assert/strict');

const { createShunsukeApplication } = require('../src/ShunsukeApplication');

test('savePostSlots は一アカウント7枠を保存せず SLOT_LIMIT_EXCEEDED を返す', () => {
  const app = createShunsukeApplication({
    postSlots: {
      replaceForAccount: () => assert.fail('上限超過の投稿枠を保存してはならない'),
    },
  });

  const result = app.savePostSlots('social-1', [
    { postTimeJst: '06:00' }, { postTimeJst: '07:00' }, { postTimeJst: '08:00' },
    { postTimeJst: '09:00' }, { postTimeJst: '10:00' }, { postTimeJst: '11:00' },
    { postTimeJst: '12:00' },
  ]);

  assert.deepEqual(result, { ok: false, code: 'SLOT_LIMIT_EXCEEDED' });
});

test('savePostSlots は同時刻の投稿枠を重複保存せず DUPLICATE_POST_TIME を返す', () => {
  const app = createShunsukeApplication({
    postSlots: {
      replaceForAccount: () => assert.fail('重複時刻の投稿枠を保存してはならない'),
    },
  });

  const result = app.savePostSlots('social-1', [
    { postTimeJst: '06:00' },
    { postTimeJst: '06:00' },
  ]);

  assert.deepEqual(result, { ok: false, code: 'DUPLICATE_POST_TIME' });
});

test('savePostSlots は不正な投稿時刻を保存せず POST_TIME_INVALID を返す', () => {
  const app = createShunsukeApplication({
    postSlots: {
      replaceForAccount: () => assert.fail('不正な投稿時刻を保存してはならない'),
    },
  });

  const result = app.savePostSlots('social-1', [{ postTimeJst: '24:30' }]);

  assert.deepEqual(result, { ok: false, code: 'POST_TIME_INVALID' });
});

test('savePostSlots は60分前以外の生成オフセットを保存せず GENERATION_OFFSET_INVALID を返す', () => {
  const app = createShunsukeApplication({
    postSlots: {
      replaceForAccount: () => assert.fail('不正な生成オフセットを保存してはならない'),
    },
  });

  const result = app.savePostSlots('social-1', [{ postTimeJst: '12:00', generationOffsetMinutes: 30 }]);

  assert.deepEqual(result, { ok: false, code: 'GENERATION_OFFSET_INVALID' });
});

test('savePostSlots は有効な投稿枠へアカウントID・既定値・更新時刻を付けて保存する', () => {
  let saved = null;
  const app = createShunsukeApplication({
    postSlots: {
      replaceForAccount: (_socialAccountId, slots) => { saved = slots; },
    },
    clock: { nowJst: () => '2026-09-20T10:00:00+09:00' },
  });

  const result = app.savePostSlots('social-1', [{ slotId: 'slot-1', postTimeJst: '12:00' }]);

  assert.deepEqual(result, { ok: true, code: 'SAVED' });
  assert.deepEqual(saved, [{
    slotId: 'slot-1',
    socialAccountId: 'social-1',
    postTimeJst: '12:00',
    generationOffsetMinutes: 60,
    status: 'ACTIVE',
    updatedAt: '2026-09-20T10:00:00+09:00',
  }]);
});
