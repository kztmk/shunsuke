const test = require('node:test');
const assert = require('node:assert/strict');

const { createShunsukeApplication } = require('../src/ShunsukeApplication');

test('runDueGenerations は06時、12時、19時の各枠を一時間前に一度だけ生成対象にする', () => {
  const starts = [];
  const app = createShunsukeApplication({
    locks: { withLock: (_key, operation) => operation() },
    postSlots: {
      listActive: () => [
        { slotId: 'slot-06', socialAccountId: 'social-1', postTimeJst: '06:00', generationOffsetMinutes: 60 },
        { slotId: 'slot-12', socialAccountId: 'social-1', postTimeJst: '12:00', generationOffsetMinutes: 60 },
        { slotId: 'slot-19', socialAccountId: 'social-1', postTimeJst: '19:00', generationOffsetMinutes: 60 },
      ],
    },
    generationRuns: {
      findBySlotAndTargetDate: () => null,
      start: (run) => starts.push(run),
    },
    drafts: { listUnapprovedDueAtOrBefore: () => [] },
    ids: { nextGenerationId: () => `generation-${starts.length + 1}` },
  });

  assert.deepEqual(app.runDueGenerations('2026-09-21T05:00:00+09:00'), {
    ok: true, code: 'PROCESSED', startedGenerationIds: ['generation-1'], expiredDraftIds: [],
  });
  assert.deepEqual(app.runDueGenerations('2026-09-21T11:00:00+09:00'), {
    ok: true, code: 'PROCESSED', startedGenerationIds: ['generation-2'], expiredDraftIds: [],
  });
  assert.deepEqual(app.runDueGenerations('2026-09-21T18:00:00+09:00'), {
    ok: true, code: 'PROCESSED', startedGenerationIds: ['generation-3'], expiredDraftIds: [],
  });
  assert.deepEqual(starts.map((run) => [run.slotId, run.scheduledGenerationAt, run.scheduledPostAt]), [
    ['slot-06', '2026-09-21T05:00:00+09:00', '2026-09-21T06:00:00+09:00'],
    ['slot-12', '2026-09-21T11:00:00+09:00', '2026-09-21T12:00:00+09:00'],
    ['slot-19', '2026-09-21T18:00:00+09:00', '2026-09-21T19:00:00+09:00'],
  ]);
});

test('runDueGenerations は同じ投稿枠・投稿日を二重生成せず、投稿時刻の未承認原稿だけを期限切れにする', () => {
  const saved = [];
  const app = createShunsukeApplication({
    locks: { withLock: (_key, operation) => operation() },
    postSlots: { listActive: () => [{ slotId: 'slot-12', socialAccountId: 'social-1', postTimeJst: '12:00', generationOffsetMinutes: 60 }] },
    generationRuns: {
      findBySlotAndTargetDate: () => ({ generationId: 'generation-existing' }),
      start: () => assert.fail('既存生成回を二重作成してはならない'),
    },
    drafts: {
      listUnapprovedDueAtOrBefore: () => [
        { draftId: 'draft-generated', approvalStatus: 'generated' },
        { draftId: 'draft-editing', approvalStatus: 'editing' },
        { draftId: 'draft-approved', approvalStatus: 'approved' },
      ],
      save: (draft) => saved.push(draft),
    },
    ids: { nextGenerationId: () => assert.fail('既存生成回にIDを発行してはならない') },
  });

  assert.deepEqual(app.runDueGenerations('2026-09-21T12:00:00+09:00'), {
    ok: true, code: 'PROCESSED', startedGenerationIds: [], expiredDraftIds: ['draft-generated', 'draft-editing'],
  });
  assert.deepEqual(saved, [
    { draftId: 'draft-generated', approvalStatus: 'expired' },
    { draftId: 'draft-editing', approvalStatus: 'expired' },
  ]);
});

test('runDueGenerations は日付またぎの00時30分枠を前日23時30分に生成対象にする', () => {
  const starts = [];
  const app = createShunsukeApplication({
    locks: { withLock: (_key, operation) => operation() },
    postSlots: { listActive: () => [{ slotId: 'slot-0030', socialAccountId: 'social-1', postTimeJst: '00:30', generationOffsetMinutes: 60 }] },
    generationRuns: { findBySlotAndTargetDate: () => null, start: (run) => starts.push(run) },
    drafts: { listUnapprovedDueAtOrBefore: () => [] },
    ids: { nextGenerationId: () => 'generation-midnight' },
  });

  assert.deepEqual(app.runDueGenerations('2026-09-20T23:30:00+09:00'), {
    ok: true, code: 'PROCESSED', startedGenerationIds: ['generation-midnight'], expiredDraftIds: [],
  });
  assert.deepEqual(starts.map((run) => [run.targetDateJst, run.scheduledGenerationAt, run.scheduledPostAt]), [[
    '2026-09-21', '2026-09-20T23:30:00+09:00', '2026-09-21T00:30:00+09:00',
  ]]);
});

test('runDueGenerations はJST形式でない現在時刻と依存処理の例外を分類する', () => {
  const invalidApp = createShunsukeApplication({});
  assert.deepEqual(invalidApp.runDueGenerations('2026-09-20T15:00:00Z'), { ok: false, code: 'NOW_INVALID' });
  assert.deepEqual(invalidApp.runDueGenerations('2026-02-31T05:00:00+09:00'), { ok: false, code: 'NOW_INVALID' });

  const failingApp = createShunsukeApplication({
    locks: { withLock: (_key, operation) => operation() },
    postSlots: { listActive: () => { throw new Error('raw sheet error'); } },
    drafts: { listUnapprovedDueAtOrBefore: () => [] },
  });
  assert.deepEqual(failingApp.runDueGenerations('2026-09-21T05:00:00+09:00'), { ok: false, code: 'DUE_GENERATION_FAILED' });
});
