const RANKING_GENDER = { 女性: 1, 男性: 0 };
const RANKING_AGE = { '10代': 10, '20代': 20, '30代': 30, '40代': 40, '50代以上': 50 };

function qualifiesForCandidate(item, quality, adultGenreIds, adultExcludedWords) {
  const searchableText = `${item && item.itemName ? item.itemName : ''} ${item && item.genreName ? item.genreName : ''}`;
  return item && item.itemCode && item.availability === true && item.isAdult !== true
    && !adultGenreIds.includes(String(item.genreId || ''))
    && !adultExcludedWords.some((word) => searchableText.includes(word))
    && typeof item.imageUrl === 'string' && item.imageUrl.length > 0
    && typeof item.affiliateUrl === 'string' && item.affiliateUrl.startsWith('https://')
    && Number(item.reviewAverage) >= quality.minReviewAverage
    && Number(item.reviewCount) >= quality.minReviewCount
    && typeof item.productCheckedAt === 'string' && item.productCheckedAt.length > 0;
}

function createPhase4CandidateService(dependencies) {
  return {
    collectRanking(audience) {
      const request = { period: 'realtime' };
      const age = RANKING_AGE[audience.ageBand];
      const sex = RANKING_GENDER[audience.gender];
      if (age !== undefined) request.age = age;
      if (sex !== undefined) request.sex = sex;
      if (age === undefined && sex === undefined && audience.genreId) request.genreId = audience.genreId;

      try {
        return { ok: true, code: 'RANKING_COLLECTED', items: dependencies.ranking.fetch(request) };
      } catch (_error) {
        return { ok: false, code: 'RANKING_REQUEST_FAILED' };
      }
    },
    generateKeywords(input) {
      try {
        const keywords = dependencies.keywords.generate({
          weather: input.weather,
          ranking: input.ranking,
          audience: input.audience,
          prohibitedCategories: input.prohibitedCategories,
        });
        const maxKeywords = input.keywordCount === undefined ? 3 : input.keywordCount;
        const prohibitedAttributeTerms = input.prohibitedAttributeTerms || [];
        if (!Array.isArray(keywords) || keywords.length === 0 || keywords.length > maxKeywords
          || keywords.some((value) => !value || !value.keyword || !value.category || !value.reason)
          || keywords.some((value) => input.prohibitedCategories.includes(value.category))
          || keywords.some((value) => prohibitedAttributeTerms.some((term) => `${value.keyword} ${value.reason}`.includes(term)))
          || new Set(keywords.map((value) => value.category)).size !== keywords.length) {
          return { ok: false, code: 'KEYWORDS_INVALID' };
        }
        return { ok: true, code: 'KEYWORDS_GENERATED', keywords };
      } catch (_error) {
        return { ok: false, code: 'KEYWORDS_GENERATION_FAILED' };
      }
    },
    buildCandidates(input) {
      try {
        if (!Array.isArray(input.adultGenreIds) || input.adultGenreIds.length === 0
          || !Array.isArray(input.adultExcludedWords) || input.adultExcludedWords.length === 0) {
          return { ok: false, code: 'ADULT_FILTER_CONFIG_REQUIRED' };
        }
        const candidates = [];
        const itemCodes = new Set();
        const shops = new Set();
        input.keywords.forEach((keyword) => {
          const productsPerKeyword = input.productsPerKeyword === undefined ? 3 : input.productsPerKeyword;
          const adultGenreIds = input.adultGenreIds;
          const adultExcludedWords = input.adultExcludedWords;
          const eligible = dependencies.products.search(keyword.keyword)
            .filter((item) => qualifiesForCandidate(item, input.quality, adultGenreIds, adultExcludedWords))
            .filter((item) => !itemCodes.has(item.itemCode))
            .filter((item) => !dependencies.decisions.isExcluded(input.socialAccountId, item.itemCode));
          eligible.sort((left, right) => Number(shops.has(left.shopCode)) - Number(shops.has(right.shopCode)));
          eligible.forEach((item) => {
            const maxCandidates = Math.min(input.maxCandidates || 9, 9);
            if (candidates.length >= maxCandidates || itemCodes.has(item.itemCode)
              || candidates.filter((candidate) => candidate.keyword === keyword.keyword).length >= productsPerKeyword) return;
            const candidate = { ...item, keyword: keyword.keyword, keywordReason: keyword.reason };
            candidates.push(candidate);
            itemCodes.add(item.itemCode);
            shops.add(item.shopCode);
            if (dependencies.evidence && dependencies.evidence.saveProductCandidate) dependencies.evidence.saveProductCandidate(candidate);
          });
        });
        return { ok: true, code: 'CANDIDATES_BUILT', candidates };
      } catch (_error) {
        return { ok: false, code: 'PRODUCT_SEARCH_FAILED' };
      }
    },
    generate(input) {
      const ranking = this.collectRanking(input.audience);
      if (!ranking.ok) return ranking;
      if (dependencies.evidence && dependencies.evidence.saveRanking) {
        ranking.items.forEach((item) => dependencies.evidence.saveRanking({
          generationId: input.generationId, rank: item.rank, itemCode: item.itemCode, itemName: item.itemName,
          ageBand: input.audience.ageBand, gender: input.audience.gender, period: 'realtime', fetchedAt: input.fetchedAt,
        }));
      }
      const generatedKeywords = this.generateKeywords({
        weather: input.weather, ranking: ranking.items, audience: input.audience,
        prohibitedCategories: input.prohibitedCategories, keywordCount: input.keywordCount,
        prohibitedAttributeTerms: input.prohibitedAttributeTerms,
      });
      if (!generatedKeywords.ok) return generatedKeywords;
      if (dependencies.evidence && dependencies.evidence.saveKeyword) {
        generatedKeywords.keywords.forEach((keyword) => dependencies.evidence.saveKeyword({
          generationId: input.generationId, keyword: keyword.keyword, reason: keyword.reason,
          status: 'generated', createdAt: input.fetchedAt,
        }));
      }
      return this.buildCandidates({
        socialAccountId: input.socialAccountId, keywords: generatedKeywords.keywords, quality: input.quality,
        productsPerKeyword: input.productsPerKeyword, maxCandidates: input.maxCandidates,
        adultGenreIds: input.adultGenreIds, adultExcludedWords: input.adultExcludedWords,
      });
    },
    generateForSlot(slotId, targetDateJst) {
      try {
        const input = dependencies.generationInput.load(slotId, targetDateJst);
        if (!input) return { ok: false, code: 'GENERATION_INPUT_NOT_FOUND' };
        return this.generate(input);
      } catch (_error) {
        return { ok: false, code: 'CANDIDATE_GENERATION_FAILED' };
      }
    },
  };
}

if (typeof module !== 'undefined') module.exports = { createPhase4CandidateService };
