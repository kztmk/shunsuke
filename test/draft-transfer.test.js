const test = require('node:test');
const assert = require('node:assert/strict');

const { createShunsukeApplication, transferApprovedDraft } = require('../src/ShunsukeApplication');

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

test('期限切れ原稿は approveDraft で承認せず EXPIRED を返す', () => {
  const draft = {
    draftId: 'draft-expired',
    approvalStatus: 'editing',
    expiresAt: '2026-09-20T10:00:00+09:00',
  };
  const app = createShunsukeApplication({
    drafts: {
      get: (draftId) => draftId === draft.draftId ? draft : null,
      save: () => assert.fail('期限切れ原稿を保存してはならない'),
    },
    clock: { nowJst: () => '2026-09-20T10:00:01+09:00' },
  });

  assert.deepEqual(app.approveDraft('draft-expired'), { ok: false, code: 'EXPIRED' });
  assert.equal(draft.approvalStatus, 'editing');
});

test('転送済み原稿は approveDraft で再承認せず ALREADY_TRANSFERRED を返す', () => {
  const draft = {
    draftId: 'draft-transferred',
    approvalStatus: 'transferred',
    expiresAt: '2026-09-20T12:00:00+09:00',
  };
  const app = createShunsukeApplication({
    drafts: {
      get: () => draft,
      save: () => assert.fail('転送済み原稿を保存してはならない'),
    },
    clock: { nowJst: () => '2026-09-20T10:00:00+09:00' },
  });

  assert.deepEqual(app.approveDraft('draft-transferred'), { ok: false, code: 'ALREADY_TRANSFERRED' });
  assert.equal(draft.approvalStatus, 'transferred');
});

test('同じ投稿枠に承認済み原稿があると approveDraft で二件目を承認しない', () => {
  const draft = {
    draftId: 'draft-next',
    slotId: 'slot-morning',
    approvalStatus: 'editing',
    expiresAt: '2026-09-20T12:00:00+09:00',
  };
  const app = createShunsukeApplication({
    drafts: {
      get: () => draft,
      listBySlot: () => [{ draftId: 'draft-approved', slotId: 'slot-morning', approvalStatus: 'approved' }],
      save: () => assert.fail('二件目の原稿を承認保存してはならない'),
    },
    clock: { nowJst: () => '2026-09-20T10:00:00+09:00' },
  });

  assert.deepEqual(app.approveDraft('draft-next'), { ok: false, code: 'SLOT_ALREADY_APPROVED' });
  assert.equal(draft.approvalStatus, 'editing');
});
