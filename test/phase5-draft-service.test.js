const test = require('node:test');
const assert = require('node:assert/strict');
const { createPhase5DraftService } = require('../src/Phase5DraftService');

test('媒体別原稿は一商品だけを使い、PR・商品URL・天気出典を決定的に挿入する', () => {
  const service = createPhase5DraftService({ generator: { generate: () => '雨の日に便利な傘です。' } });
  const result = service.generateDraft({
    candidate: { candidateId: 'c1', itemName: '折りたたみ傘', affiliateUrl: 'https://example.test/a', productCheckedAt: '2026-09-21T10:00:00+09:00' },
    platform: 'X', weatherAttribution: '天気情報: WeatherAPI.com／予報は変わる場合があります',
    rules: { X: { maxLength: 280 } },
  });

  assert.deepEqual(result, { ok: true, code: 'DRAFT_GENERATED', draft: {
    candidateId: 'c1', platform: 'X', approvalStatus: 'generated',
    body: '【PR】\n雨の日に便利な傘です。\nhttps://example.test/a\n天気情報: WeatherAPI.com／予報は変わる場合があります',
    requiredParts: { pr: '【PR】', affiliateUrl: 'https://example.test/a', weatherAttribution: '天気情報: WeatherAPI.com／予報は変わる場合があります' },
    productCheckedAt: '2026-09-21T10:00:00+09:00', evidence: {},
  } });
});

test('原稿の選択・編集・検証は状態を守り、転送済み原稿は編集しない', () => {
  const parts = { pr: '【PR】', affiliateUrl: 'https://example.test/a', weatherAttribution: '天気情報: WeatherAPI.com' };
  const drafts = new Map([['d1', { draftId: 'd1', approvalStatus: 'generated', platform: 'Bluesky', finalBody: '', productCheckedAt: '2026-09-21T10:00:00+09:00', requiredParts: parts }]]);
  const service = createPhase5DraftService({ drafts: { get: (id) => drafts.get(id), save: (draft) => drafts.set(draft.draftId, draft) } });

  assert.deepEqual(service.select('d1'), { ok: true, code: 'SELECTED' });
  assert.deepEqual(service.edit('d1', `編集済み本文 ${parts.pr} ${parts.affiliateUrl} ${parts.weatherAttribution}`), { ok: true, code: 'EDITED' });
  assert.deepEqual(service.validate('d1', { maxLength: 300 }), { ok: true, code: 'VALID' });
  drafts.set('d1', { ...drafts.get('d1'), approvalStatus: 'transferred' });
  assert.deepEqual(service.edit('d1', '変更'), { ok: false, code: 'TRANSFERRED_IMMUTABLE' });
});

test('却下と期限切れの再指定は人の操作でだけ状態を変更する', () => {
  const drafts = new Map([['d2', { draftId: 'd2', approvalStatus: 'generated' }], ['d3', { draftId: 'd3', approvalStatus: 'expired' }]]);
  const service = createPhase5DraftService({ drafts: { get: (id) => drafts.get(id), save: (draft) => drafts.set(draft.draftId, draft) } });

  assert.deepEqual(service.reject('d2'), { ok: true, code: 'REJECTED' });
  assert.deepEqual(service.rescheduleExpired('d3', '2026-09-22T12:00:00+09:00'), { ok: true, code: 'RESCHEDULED' });
  assert.equal(drafts.get('d3').approvalStatus, 'editing');
  assert.equal(drafts.get('d3').finalBody, '');
  assert.equal(drafts.get('d3').requiredParts, undefined);
});

test('候補IDから原稿を選択する', () => {
  const draft = { draftId: 'd4', candidateId: 'c4', approvalStatus: 'generated' };
  const service = createPhase5DraftService({ drafts: { findByCandidateId: (id) => id === 'c4' ? draft : null, save: (value) => Object.assign(draft, value) } });
  assert.deepEqual(service.selectCandidate('c4'), { ok: true, code: 'SELECTED' });
  assert.equal(draft.approvalStatus, 'selected');
});

test('候補IDから原稿を却下する', () => {
  const draft = { draftId: 'd5', candidateId: 'c5', approvalStatus: 'generated' };
  const service = createPhase5DraftService({ drafts: { findByCandidateId: () => draft, save: (value) => Object.assign(draft, value) } });
  assert.deepEqual(service.rejectCandidate('c5'), { ok: true, code: 'REJECTED' });
  assert.equal(draft.approvalStatus, 'rejected');
});

test('媒体別に生成し、候補をまとめて原稿化して根拠表示データを保持する', () => {
  const prompts = [];
  const service = createPhase5DraftService({ generator: { generate: (input) => { prompts.push(input); return '本文です'; } } });
  const result = service.generateDrafts({
    platform: 'Threads', rules: { Threads: { maxLength: 500 } }, weatherAttribution: '天気情報: WeatherAPI.com',
    candidates: [
      { candidateId: 'c1', affiliateUrl: 'https://example.test/1', productCheckedAt: '2026-09-21T10:00:00+09:00', evidence: { ranking: { rank: 1 }, keyword: '傘', weather: { targetDate: '2026-09-21' } } },
      { candidateId: 'c2', affiliateUrl: 'https://example.test/2', productCheckedAt: '2026-09-21T10:00:00+09:00', evidence: { ranking: { rank: 2 }, keyword: 'ボトル', weather: { targetDate: '2026-09-21' } } },
    ],
  });

  assert.equal(prompts.every((prompt) => prompt.style === '生活場面と選定理由を少し詳しくする'), true);
  assert.equal(result.ok, true);
  assert.equal(result.drafts.length, 2);
  assert.deepEqual(result.drafts[0].evidence, { ranking: { rank: 1 }, keyword: '傘', weather: { targetDate: '2026-09-21' } });
});
