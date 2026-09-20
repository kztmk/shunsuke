const SHEET_CONTRACT = {
  AppSettings: ['key', 'value', 'updatedAt'],
  SocialAccounts: ['socialAccountId', 'platform', 'label', 'country', 'prefecture', 'municipality', 'gender', 'ageBand', 'keywordCount', 'productsPerKeyword', 'minReviewAverage', 'minReviewCount', 'transferredCooldownDays', 'rejectedCooldownDays', 'tone', 'requiredPhrases', 'prohibitedPhrases', 'destinationSpreadsheetId', 'destinationAccountId', 'status', 'updatedAt'],
  PostSlots: ['slotId', 'socialAccountId', 'postTimeJst', 'generationOffsetMinutes', 'status', 'updatedAt'],
  GenerationRuns: ['generationId', 'slotId', 'socialAccountId', 'targetDateJst', 'scheduledGenerationAt', 'scheduledPostAt', 'startedAt', 'completedAt', 'status', 'weatherStatus', 'rankingStatus', 'searchStatus', 'aiStatus', 'candidateCount', 'errorCode'],
  WeatherEvidence: ['weatherEvidenceId', 'locationKey', 'source', 'sourceType', 'targetDate', 'summary', 'fetchedAt', 'rawExpiresAt', 'attribution', 'disclaimerVersion'],
  RankingEvidence: ['rankingEvidenceId', 'generationId', 'rank', 'itemCode', 'itemName', 'ageBand', 'gender', 'period', 'fetchedAt'],
  SearchKeywords: ['keywordId', 'generationId', 'keyword', 'reason', 'status', 'createdAt'],
  ProductCandidates: ['candidateId', 'generationId', 'keywordId', 'itemCode', 'itemName', 'shopCode', 'shopName', 'itemPrice', 'availability', 'postageFlag', 'pointRate', 'reviewAverage', 'reviewCount', 'affiliateUrl', 'imageUrl', 'targetReason', 'weatherReason', 'rankingReason', 'fetchedAt', 'status'],
  Drafts: ['draftId', 'candidateId', 'slotId', 'socialAccountId', 'platform', 'generatedBody', 'editedBody', 'finalBody', 'disclosure', 'weatherAttribution', 'productCheckedAt', 'generatedAt', 'approvedAt', 'expiresAt', 'approvalStatus', 'validationStatus'],
  ProductDecisions: ['decisionId', 'socialAccountId', 'itemCode', 'decision', 'decidedAt', 'excludeUntil', 'draftId'],
  Transfers: ['transferId', 'draftId', 'platform', 'destinationSpreadsheetIdMasked', 'destinationAccountId', 'method', 'attemptedAt', 'completedAt', 'status', 'errorCode', 'schemaVersion'],
  Errors: ['errorId', 'generationId', 'transferId', 'stage', 'errorCode', 'userMessage', 'retryable', 'createdAt', 'resolvedAt'],
};

function ensureSheetContract(workbook) {
  Object.entries(SHEET_CONTRACT).forEach(([name, header]) => {
    if (!workbook.getSheet(name)) {
      const sheet = workbook.createSheet(name);
      sheet.setHeader(header);
    }
  });
}

if (typeof module !== 'undefined') {
  module.exports = { ensureSheetContract, SHEET_CONTRACT };
}
