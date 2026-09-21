const test = require('node:test');
const assert = require('node:assert/strict');
const { createShunsukeApplication } = require('../src/ShunsukeApplication');
const { createPhase4CandidateService } = require('../src/Phase4CandidateService');

test('generateForSlot は公開インターフェースから候補生成を呼び、失敗を分類する', () => {
  const app = createShunsukeApplication({
    phase4: { generateForSlot: (slotId, targetDateJst) => ({ ok: true, code: 'CANDIDATES_BUILT', slotId, targetDateJst }) },
  });

  assert.deepEqual(app.generateForSlot('slot-1', '2026-09-21'),
    { ok: true, code: 'CANDIDATES_BUILT', slotId: 'slot-1', targetDateJst: '2026-09-21' });
});

test('generateForSlot は生成器の例外を公開せず分類する', () => {
  const app = createShunsukeApplication({ phase4: { generateForSlot: () => { throw new Error('detail'); } } });

  assert.deepEqual(app.generateForSlot('slot-1', '2026-09-21'),
    { ok: false, code: 'CANDIDATE_GENERATION_FAILED' });
});

test('Phase4サービス自身がgenerateForSlotで読み込んだ入力を候補生成へ接続する', () => {
  const service = createPhase4CandidateService({
    generationInput: { load: () => ({
      generationId: 'g', socialAccountId: 'a', fetchedAt: '2026-09-21T10:00:00+09:00', audience: {}, weather: [],
      prohibitedCategories: [], prohibitedAttributeTerms: [], keywordCount: 1, productsPerKeyword: 1,
      quality: { minReviewAverage: 4, minReviewCount: 10 }, adultGenreIds: ['999999'], adultExcludedWords: ['成人向け'],
    }) },
    ranking: { fetch: () => [] }, keywords: { generate: () => [{ keyword: '傘', category: '雨具', reason: '雨に対応' }] },
    products: { search: () => [] }, decisions: { isExcluded: () => false },
  });

  assert.deepEqual(service.generateForSlot('slot-1', '2026-09-21'), { ok: true, code: 'CANDIDATES_BUILT', candidates: [] });
});
