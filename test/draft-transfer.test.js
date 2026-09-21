const test = require('node:test');
const assert = require('node:assert/strict');

const { createShunsukeApplication, transferApprovedDraft } = require('../src/ShunsukeApplication');

const immediateLocks = { withLock: (_key, operation) => operation() };

function createApp(dependencies) {
  return createShunsukeApplication({
    locks: immediateLocks,
    ids: { nextTransferId: () => 'transfer-1' },
    ...dependencies,
  });
}

function readyDraft(overrides = {}) {
  return {
    draftId: 'draft-1', slotId: 'slot-1', approvalStatus: 'editing',
    finalBody: '雨の日の移動に使いやすい防水バッグです。',
    productCheckedAt: '2026-09-20T09:55:00+09:00', validationStatus: 'valid',
    platform: 'X', destinationAccountId: 'torai-account-1',
    postSchedule: '2026-09-20T12:00:00+09:00',
    expiresAt: '2026-09-20T13:00:00+09:00',
    ...overrides,
  };
}

function toraiRow() {
  return {
    id: 'transfer-1', createdAt: '2026-09-20T10:00:00+09:00',
    postTo: 'torai-account-1', contents: '雨の日の移動に使いやすい防水バッグです。',
    mediaUrls: [], postSchedule: '2026-09-20T12:00:00+09:00',
    inReplyToInternal: '', postId: '', inReplyToOnX: '', quoteId: '', repostTargetId: '',
    status: 'queued', errorMessage: '',
  };
}

test('未承認の原稿は転送せず NOT_APPROVED を返す', () => {
  const destination = { rows: [], append: (row) => destination.rows.push(row) };
  const result = transferApprovedDraft(readyDraft(), destination);
  assert.deepEqual(result, { ok: false, code: 'NOT_APPROVED' });
  assert.deepEqual(destination.rows, []);
});

test('承認処理は投稿枠ロック内で一枠一件だけを承認する', () => {
  let draft = readyDraft();
  const keys = [];
  const app = createApp({
    locks: { withLock: (key, operation) => { keys.push(key); return operation(); } },
    drafts: { get: () => draft, listBySlot: () => [draft], save: (value) => { draft = value; } },
    clock: { nowJst: () => '2026-09-20T10:00:00+09:00' },
  });
  assert.deepEqual(app.approveDraft(draft.draftId), { ok: true, code: 'APPROVED' });
  assert.deepEqual(keys, ['slot:slot-1']);
  assert.equal(draft.approvalStatus, 'approved');
  assert.equal(draft.approvedAt, '2026-09-20T10:00:00+09:00');
});

test('編集・検品・検証が済んでいない原稿は承認しない', () => {
  let draft = readyDraft({ finalBody: '', productCheckedAt: '', validationStatus: 'pending' });
  const app = createApp({
    drafts: { get: () => draft, listBySlot: () => [draft], save: () => assert.fail('承認保存してはならない') },
    clock: { nowJst: () => '2026-09-20T10:00:00+09:00' },
  });
  assert.deepEqual(app.approveDraft(draft.draftId), { ok: false, code: 'DRAFT_NOT_READY' });
  assert.equal(draft.approvalStatus, 'editing');
});

test('同じ投稿枠に承認済み原稿があると二件目を承認しない', () => {
  const draft = readyDraft({ draftId: 'draft-next', slotId: 'slot-morning' });
  const app = createApp({
    drafts: {
      get: () => draft,
      listBySlot: () => [{ draftId: 'draft-approved', slotId: 'slot-morning', approvalStatus: 'approved' }],
      save: () => assert.fail('二件目の原稿を承認保存してはならない'),
    },
    clock: { nowJst: () => '2026-09-20T10:00:00+09:00' },
  });
  assert.deepEqual(app.approveDraft(draft.draftId), { ok: false, code: 'SLOT_ALREADY_APPROVED' });
});

test('期限切れ原稿は expired を保存して承認しない', () => {
  let draft = readyDraft({ expiresAt: '2026-09-20T10:00:00+09:00' });
  const app = createApp({
    drafts: { get: () => draft, save: (value) => { draft = value; } },
    clock: { nowJst: () => '2026-09-20T10:00:01+09:00' },
  });
  assert.deepEqual(app.approveDraft(draft.draftId), { ok: false, code: 'EXPIRED' });
  assert.equal(draft.approvalStatus, 'expired');
});

test('虎威 Posts へヘッダー契約の一行を転送し、成功後だけ transferred にする', () => {
  let draft = readyDraft({ approvalStatus: 'approved', approvedAt: '2026-09-20T10:00:00+09:00' });
  const rows = [];
  const app = createApp({
    drafts: { get: () => draft, save: (value) => { draft = value; } },
    destinations: { appendIfAbsent: (id, row) => { assert.equal(id, 'transfer-1'); rows.push(row); return true; } },
    clock: { nowJst: () => '2026-09-20T10:05:00+09:00' },
  });
  assert.deepEqual(app.transferApprovedDraft(draft.draftId), { ok: true, code: 'TRANSFERRED' });
  assert.deepEqual(rows, [toraiRow()]);
  assert.equal(draft.approvalStatus, 'transferred');
  assert.equal(draft.transferId, 'transfer-1');
});

test('未対応媒体の原稿は転送しない', () => {
  const draft = readyDraft({ approvalStatus: 'approved', platform: 'Instagram' });
  const app = createApp({
    drafts: { get: () => draft, save: () => assert.fail('未対応媒体を保存してはならない') },
    destinations: { appendIfAbsent: () => assert.fail('未対応媒体を転送してはならない') },
    clock: { nowJst: () => '2026-09-20T10:05:00+09:00' },
  });
  assert.deepEqual(app.transferApprovedDraft(draft.draftId), { ok: false, code: 'DESTINATION_PLATFORM_INVALID' });
});

test('翔 Posts へ platform と accountId を含むヘッダー契約の一行を転送する', () => {
  let draft = readyDraft({ approvalStatus: 'approved', approvedAt: '2026-09-20T10:00:00+09:00', platform: 'Threads', destinationAccountId: 'akira-account-1' });
  const rows = [];
  const app = createApp({
    drafts: { get: () => draft, save: (value) => { draft = value; } },
    destinations: { appendIfAbsent: (_id, row) => { rows.push(row); return true; } },
    clock: { nowJst: () => '2026-09-20T10:05:00+09:00' },
  });
  assert.deepEqual(app.transferApprovedDraft(draft.draftId), { ok: true, code: 'TRANSFERRED' });
  assert.deepEqual(rows, [{
    id: 'transfer-1', createdAt: '2026-09-20T10:00:00+09:00', platform: 'threads', accountId: 'akira-account-1',
    contents: '雨の日の移動に使いやすい防水バッグです。', mediaUrls: [], postSchedule: '2026-09-20T12:00:00+09:00',
    crossPostGroupId: '', inReplyTo: '', status: 'queued', postId: '', errorMessage: '',
  }]);
});

test('転送処理は原稿ロック内で transferId の宛先側重複を検査し、重複時は transferred へ収束する', () => {
  let draft = readyDraft({ approvalStatus: 'approved', approvedAt: '2026-09-20T10:00:00+09:00', transferId: 'transfer-existing' });
  const keys = [];
  const app = createApp({
    locks: { withLock: (key, operation) => { keys.push(key); return operation(); } },
    drafts: { get: () => draft, save: (value) => { draft = value; } },
    destinations: { appendIfAbsent: (id) => { assert.equal(id, 'transfer-existing'); return false; } },
    clock: { nowJst: () => '2026-09-20T10:05:00+09:00' },
  });
  assert.deepEqual(app.transferApprovedDraft(draft.draftId), { ok: true, code: 'TRANSFERRED' });
  assert.deepEqual(keys, ['draft:draft-1']);
  assert.equal(draft.approvalStatus, 'transferred');
});

test('transferId を保存できない場合は宛先へ追加しない', () => {
  const draft = readyDraft({ approvalStatus: 'approved', approvedAt: '2026-09-20T10:00:00+09:00' });
  const app = createApp({
    drafts: { get: () => draft, save: () => { throw new Error('source unavailable'); } },
    destinations: { appendIfAbsent: () => assert.fail('transferId 保存前に宛先へ追加してはならない') },
    clock: { nowJst: () => '2026-09-20T10:05:00+09:00' },
  });
  assert.deepEqual(app.transferApprovedDraft(draft.draftId), { ok: false, code: 'SOURCE_SAVE_FAILED' });
});

test('転送後の保存に失敗しても同じ transferId で再試行して一行に収束する', () => {
  let draft = readyDraft({ approvalStatus: 'approved', approvedAt: '2026-09-20T10:00:00+09:00' });
  let saves = 0;
  let appends = 0;
  const app = createApp({
    drafts: {
      get: () => draft,
      save: (value) => {
        saves += 1;
        if (saves === 2) throw new Error('final source save unavailable');
        draft = value;
      },
    },
    destinations: { appendIfAbsent: () => { appends += 1; return appends === 1; } },
    clock: { nowJst: () => '2026-09-20T10:05:00+09:00' },
  });
  assert.deepEqual(app.transferApprovedDraft(draft.draftId), { ok: false, code: 'SOURCE_STATE_UPDATE_FAILED' });
  assert.equal(draft.transferId, 'transfer-1');
  assert.deepEqual(app.transferApprovedDraft(draft.draftId), { ok: true, code: 'TRANSFERRED' });
  assert.equal(appends, 2);
  assert.equal(draft.approvalStatus, 'transferred');
});

test('宛先の追加に失敗した原稿は approved を保持し分類済み結果を返す', () => {
  let draft = readyDraft({ approvalStatus: 'approved', approvedAt: '2026-09-20T10:00:00+09:00' });
  const app = createApp({
    drafts: { get: () => draft, save: (value) => { draft = value; } },
    destinations: { appendIfAbsent: () => { throw new Error('destination unavailable'); } },
    clock: { nowJst: () => '2026-09-20T10:05:00+09:00' },
  });
  assert.deepEqual(app.transferApprovedDraft(draft.draftId), { ok: false, code: 'DESTINATION_APPEND_FAILED' });
  assert.equal(draft.approvalStatus, 'approved');
});

test('Posts 必須ヘッダーが不足する宛先は自動転送しない', () => {
  let draft = readyDraft({ approvalStatus: 'approved', approvedAt: '2026-09-20T10:00:00+09:00' });
  const app = createApp({
    drafts: { get: () => draft, save: (value) => { draft = value; } },
    destinations: { appendIfAbsent: () => { throw new Error('POSTS_HEADERS_INVALID'); } },
    clock: { nowJst: () => '2026-09-20T10:05:00+09:00' },
  });
  assert.deepEqual(app.transferApprovedDraft(draft.draftId), { ok: false, code: 'DESTINATION_CONTRACT_INVALID' });
  assert.equal(draft.approvalStatus, 'approved');
});

test('終了状態の原稿は再承認せず、期限切れ・転送済み原稿は転送しない', () => {
  const terminalStates = [
    ['transferred', 'ALREADY_TRANSFERRED'], ['rejected', 'REJECTED'],
    ['exported', 'ALREADY_EXPORTED'], ['failed', 'FAILED'],
  ];
  terminalStates.forEach(([approvalStatus, code]) => {
    const draft = readyDraft({ approvalStatus });
    const app = createApp({
      drafts: { get: () => draft, save: () => assert.fail('終了状態を保存してはならない') },
      clock: { nowJst: () => '2026-09-20T10:00:00+09:00' },
    });
    assert.deepEqual(app.approveDraft(draft.draftId), { ok: false, code });
  });

  ['transferred', 'approved'].forEach((approvalStatus) => {
    const draft = readyDraft({
      approvalStatus,
      expiresAt: approvalStatus === 'approved' ? '2026-09-20T09:00:00+09:00' : undefined,
    });
    const app = createApp({
      drafts: { get: () => draft },
      destinations: { appendIfAbsent: () => assert.fail('転送してはならない') },
      clock: { nowJst: () => '2026-09-20T10:00:00+09:00' },
    });
    assert.deepEqual(app.transferApprovedDraft(draft.draftId), {
      ok: false, code: approvalStatus === 'transferred' ? 'ALREADY_TRANSFERRED' : 'EXPIRED',
    });
  });
});

test('固定フィクスチャで一商品・一候補・一承認・一転送行を再現する', () => {
  const fixture = {
    socialAccount: { socialAccountId: 'social-1', platform: 'X' },
    weather: { summary: 'くもり後雨' },
    ranking: [{ itemCode: 'shop:item-1', itemName: '防水バッグ', rank: 1 }],
  };
  let draft = readyDraft({
    candidateId: 'candidate-1', socialAccountId: fixture.socialAccount.socialAccountId,
    itemCode: fixture.ranking[0].itemCode, approvalStatus: 'editing',
  });
  const rows = [];
  const app = createApp({
    drafts: { get: () => draft, listBySlot: () => [draft], save: (value) => { draft = value; } },
    destinations: { appendIfAbsent: (_id, row) => { rows.push(row); return true; } },
    clock: { nowJst: () => '2026-09-20T10:00:00+09:00' },
  });
  assert.equal(fixture.weather.summary, 'くもり後雨');
  assert.deepEqual(app.approveDraft(draft.draftId), { ok: true, code: 'APPROVED' });
  assert.deepEqual(app.transferApprovedDraft(draft.draftId), { ok: true, code: 'TRANSFERRED' });
  assert.deepEqual(rows, [toraiRow()]);
  assert.equal(draft.approvalStatus, 'transferred');
});
