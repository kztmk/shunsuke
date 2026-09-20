const test = require('node:test');
const assert = require('node:assert/strict');

const { transferApprovedDraft } = require('../src/ShunsukeApplication');

test('未承認の原稿は転送せず NOT_APPROVED を返す', () => {
  const destination = { rows: [], append: (row) => destination.rows.push(row) };

  const result = transferApprovedDraft({
    draftId: 'draft-1',
    approvalStatus: 'editing',
    finalBody: '雨の日の通勤に使える商品です。',
  }, destination);

  assert.deepEqual(result, { ok: false, code: 'NOT_APPROVED' });
  assert.deepEqual(destination.rows, []);
});
