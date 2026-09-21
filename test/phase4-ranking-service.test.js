const test = require('node:test');
const assert = require('node:assert/strict');
const { createPhase4CandidateService } = require('../src/Phase4CandidateService');

test('年代と性別を指定したランキング要求は realtime・age・sex だけを送る', () => {
  let request;
  const service = createPhase4CandidateService({
    ranking: { fetch: (value) => { request = value; return []; } },
  });

  const result = service.collectRanking({ gender: '女性', ageBand: '20代', genreId: '100283' });

  assert.deepEqual(request, { period: 'realtime', age: 20, sex: 1 });
  assert.deepEqual(result, { ok: true, code: 'RANKING_COLLECTED', items: [] });
});

test('年代・性別が指定なしのランキング要求は属性もジャンルも送らない', () => {
  let request;
  const service = createPhase4CandidateService({
    ranking: { fetch: (value) => { request = value; return [{ itemCode: 'shop:item-1' }]; } },
  });

  const result = service.collectRanking({ gender: '指定なし', ageBand: '指定なし' });

  assert.deepEqual(request, { period: 'realtime' });
  assert.deepEqual(result, { ok: true, code: 'RANKING_COLLECTED', items: [{ itemCode: 'shop:item-1' }] });
});

test('ランキング取得の失敗は分類済み結果だけを返す', () => {
  const service = createPhase4CandidateService({ ranking: { fetch: () => { throw new Error('provider detail'); } } });

  assert.deepEqual(service.collectRanking({ gender: '女性', ageBand: '30代' }),
    { ok: false, code: 'RANKING_REQUEST_FAILED' });
});

test('検索語は公開根拠だけを渡し、異なるカテゴリの理由付き3件までを返す', () => {
  let prompt;
  const service = createPhase4CandidateService({
    ranking: { fetch: () => [] },
    keywords: { generate: (value) => {
      prompt = value;
      return [
        { keyword: '折りたたみ傘', category: '雨具', reason: '雨とランキングに関連' },
        { keyword: '保温ボトル', category: '飲料', reason: '気温とランキングに関連' },
        { keyword: '防水バッグ', category: 'バッグ', reason: '雨と想定読者に関連' },
      ];
    } },
  });

  const result = service.generateKeywords({
    weather: [{ summary: '雨', targetDate: '2026-09-21' }],
    ranking: [{ itemName: '傘', rank: 1 }],
    audience: { gender: '女性', ageBand: '20代' },
    prohibitedCategories: ['成人向け'],
  });

  assert.deepEqual(prompt, {
    weather: [{ summary: '雨', targetDate: '2026-09-21' }],
    ranking: [{ itemName: '傘', rank: 1 }],
    audience: { gender: '女性', ageBand: '20代' },
    prohibitedCategories: ['成人向け'],
  });
  assert.deepEqual(result, { ok: true, code: 'KEYWORDS_GENERATED', keywords: [
    { keyword: '折りたたみ傘', category: '雨具', reason: '雨とランキングに関連' },
    { keyword: '保温ボトル', category: '飲料', reason: '気温とランキングに関連' },
    { keyword: '防水バッグ', category: 'バッグ', reason: '雨と想定読者に関連' },
  ] });
});

test('商品候補は品質条件・itemCode重複・成人向け・アカウント別除外を適用し、店舗偏りを避ける', () => {
  const saved = [];
  const service = createPhase4CandidateService({
    products: { search: () => [
      { itemCode: 'same', itemName: '傘A', shopCode: 'shop-a', availability: true, imageUrl: 'https://img/a', affiliateUrl: 'https://a', reviewAverage: 4.5, reviewCount: 20, productCheckedAt: '2026-09-21T10:00:00+09:00' },
      { itemCode: 'same', itemName: '傘A 別店', shopCode: 'shop-b', availability: true, imageUrl: 'https://img/b', affiliateUrl: 'https://b', reviewAverage: 4.8, reviewCount: 30, productCheckedAt: '2026-09-21T10:00:00+09:00' },
      { itemCode: 'adult', itemName: '成人商品', shopCode: 'shop-b', isAdult: true, availability: true, imageUrl: 'https://img/c', affiliateUrl: 'https://c', reviewAverage: 5, reviewCount: 50, productCheckedAt: '2026-09-21T10:00:00+09:00' },
      { itemCode: 'excluded', itemName: '除外商品', shopCode: 'shop-a', availability: true, imageUrl: 'https://img/d', affiliateUrl: 'https://d', reviewAverage: 4.5, reviewCount: 20, productCheckedAt: '2026-09-21T10:00:00+09:00' },
      { itemCode: 'bottle', itemName: 'ボトル', shopCode: 'shop-b', availability: true, imageUrl: 'https://img/e', affiliateUrl: 'https://e', reviewAverage: 4.2, reviewCount: 12, productCheckedAt: '2026-09-21T10:00:00+09:00' },
      { itemCode: 'low-review', itemName: '低評価', shopCode: 'shop-c', availability: true, imageUrl: 'https://img/f', affiliateUrl: 'https://f', reviewAverage: 3.9, reviewCount: 99, productCheckedAt: '2026-09-21T10:00:00+09:00' },
    ] },
    decisions: { isExcluded: (_accountId, itemCode) => itemCode === 'excluded' },
    evidence: { saveProductCandidate: (candidate) => saved.push(candidate) },
  });

  const result = service.buildCandidates({
    socialAccountId: 'account-1',
    keywords: [{ keyword: '雨具', category: '雨具', reason: '雨に対応' }],
    quality: { minReviewAverage: 4, minReviewCount: 10 }, adultGenreIds: ['999999'], adultExcludedWords: ['成人向け'],
  });

  assert.deepEqual(result.candidates.map((candidate) => candidate.itemCode), ['same', 'bottle']);
  assert.equal(result.candidates.every((candidate) => candidate.keywordReason === '雨に対応'), true);
  assert.equal(saved.length, 2);
  assert.deepEqual(result, { ok: true, code: 'CANDIDATES_BUILT', candidates: result.candidates });
});

test('候補生成はランキング・検索語・商品候補の根拠を保存し、最大9候補を返す', () => {
  const saved = { ranking: [], keywords: [], candidates: [] };
  const service = createPhase4CandidateService({
    ranking: { fetch: () => [{ rank: 1, itemCode: 'rank-1', itemName: '傘' }] },
    keywords: { generate: () => [{ keyword: '傘', category: '雨具', reason: '雨に対応' }] },
    products: { search: () => [{ itemCode: 'umbrella-1', itemName: '傘', shopCode: 'shop-a', availability: true, imageUrl: 'https://img/a', affiliateUrl: 'https://a', reviewAverage: 4.5, reviewCount: 20, productCheckedAt: '2026-09-21T10:00:00+09:00' }] },
    decisions: { isExcluded: () => false },
    evidence: {
      saveRanking: (value) => saved.ranking.push(value),
      saveKeyword: (value) => saved.keywords.push(value),
      saveProductCandidate: (value) => saved.candidates.push(value),
    },
  });

  const result = service.generate({
    generationId: 'generation-1', socialAccountId: 'account-1', fetchedAt: '2026-09-21T10:00:00+09:00',
    audience: { gender: '女性', ageBand: '20代' }, weather: [{ summary: '雨' }], prohibitedCategories: ['成人向け'],
    quality: { minReviewAverage: 4, minReviewCount: 10 }, adultGenreIds: ['999999'], adultExcludedWords: ['成人向け'],
  });

  assert.equal(result.ok, true);
  assert.equal(result.candidates.length, 1);
  assert.deepEqual(saved.ranking, [{ generationId: 'generation-1', rank: 1, itemCode: 'rank-1', itemName: '傘', ageBand: '20代', gender: '女性', period: 'realtime', fetchedAt: '2026-09-21T10:00:00+09:00' }]);
  assert.deepEqual(saved.keywords, [{ generationId: 'generation-1', keyword: '傘', reason: '雨に対応', status: 'generated', createdAt: '2026-09-21T10:00:00+09:00' }]);
});

test('アカウント設定の候補数と決定的な成人向け・属性決めつけ除外を適用する', () => {
  const service = createPhase4CandidateService({
    keywords: { generate: () => [
      { keyword: '大人向けバッグ', category: 'バッグ', reason: '女性なら必須' },
      { keyword: '防水バッグ', category: 'バッグ2', reason: '雨に対応' },
      { keyword: '保温ボトル', category: '飲料', reason: '気温に対応' },
    ] },
    products: { search: () => [
      { itemCode: 'adult-genre', genreId: '900000', itemName: 'バッグ', shopCode: 'a', availability: true, imageUrl: 'https://img/a', affiliateUrl: 'https://a', reviewAverage: 5, reviewCount: 10, productCheckedAt: 'x' },
      { itemCode: 'adult-word', itemName: '大人向け商品', shopCode: 'b', availability: true, imageUrl: 'https://img/b', affiliateUrl: 'https://b', reviewAverage: 5, reviewCount: 10, productCheckedAt: 'x' },
      { itemCode: 'safe-1', itemName: '防水バッグ', shopCode: 'c', availability: true, imageUrl: 'https://img/c', affiliateUrl: 'https://c', reviewAverage: 5, reviewCount: 10, productCheckedAt: 'x' },
      { itemCode: 'safe-2', itemName: '保温ボトル', shopCode: 'd', availability: true, imageUrl: 'https://img/d', affiliateUrl: 'https://d', reviewAverage: 5, reviewCount: 10, productCheckedAt: 'x' },
    ] },
    decisions: { isExcluded: () => false },
  });

  assert.deepEqual(service.generateKeywords({ weather: [], ranking: [], audience: {}, prohibitedCategories: [], keywordCount: 2, prohibitedAttributeTerms: ['女性なら'] }),
    { ok: false, code: 'KEYWORDS_INVALID' });
  const candidates = service.buildCandidates({ socialAccountId: 'a', keywords: [{ keyword: '商品', reason: '理由' }], quality: { minReviewAverage: 4, minReviewCount: 10 }, productsPerKeyword: 2, adultGenreIds: ['900000'], adultExcludedWords: ['大人向け'] });
  assert.deepEqual(candidates.candidates.map((value) => value.itemCode), ['safe-1', 'safe-2']);
});
