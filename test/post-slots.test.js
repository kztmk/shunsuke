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
