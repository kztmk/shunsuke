function transferApprovedDraft(draft, destination) {
  if (!draft || draft.approvalStatus !== 'approved') {
    return { ok: false, code: 'NOT_APPROVED' };
  }

  destination.append({
    draftId: draft.draftId,
    body: draft.finalBody,
  });
  return { ok: true, code: 'TRANSFERRED' };
}

function createShunsukeApplication(dependencies) {
  return {
    saveApiKey(provider, value) {
      if (provider !== 'gemini' || typeof value !== 'string' || value.length === 0) {
        return { ok: false, code: 'API_KEY_INVALID' };
      }

      dependencies.scriptProperties.set('GEMINI_API_KEY', value);
      dependencies.appSettings.markKeyConfigured(provider);
      return { ok: true, code: 'SAVED' };
    },
    getConnectionStatus() {
      return {
        gemini: dependencies.scriptProperties.isConfigured('GEMINI_API_KEY') ? 'configured' : 'not_configured',
      };
    },
    testExternalConnections() {
      try {
        dependencies.connections.testGemini();
        return { gemini: { ok: true, code: 'CONNECTED' } };
      } catch (_error) {
        return { gemini: { ok: false, code: 'CONNECTION_FAILED' } };
      }
    },
    savePostSlots(socialAccountId, slots) {
      if (!Array.isArray(slots) || slots.length > 6) {
        return { ok: false, code: 'SLOT_LIMIT_EXCEEDED' };
      }
      if (new Set(slots.map((slot) => slot.postTimeJst)).size !== slots.length) {
        return { ok: false, code: 'DUPLICATE_POST_TIME' };
      }
      if (slots.some((slot) => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot.postTimeJst))) {
        return { ok: false, code: 'POST_TIME_INVALID' };
      }

      const offsetSlots = slots.map((slot) => ({
        ...slot,
        generationOffsetMinutes: slot.generationOffsetMinutes === undefined ? 60 : slot.generationOffsetMinutes,
      }));
      if (offsetSlots.some((slot) => slot.generationOffsetMinutes !== 60)) {
        return { ok: false, code: 'GENERATION_OFFSET_INVALID' };
      }
      const normalizedSlots = offsetSlots.map((slot) => ({
        ...slot,
        socialAccountId,
        status: slot.status === undefined ? 'ACTIVE' : slot.status,
        updatedAt: dependencies.clock.nowJst(),
      }));

      dependencies.postSlots.replaceForAccount(socialAccountId, normalizedSlots);
      return { ok: true, code: 'SAVED' };
    },
    saveSocialAccount(input) {
      if (!input || input.country !== '日本') {
        return { ok: false, code: 'COUNTRY_FIXED_TO_JAPAN' };
      }
      if (!input.prefecture || !input.municipality) {
        return { ok: false, code: 'LOCATION_REQUIRED' };
      }
      if (!['X', 'Threads', 'Bluesky'].includes(input.platform)) {
        return { ok: false, code: 'PLATFORM_UNSUPPORTED' };
      }
      if (!['女性', '男性', '指定なし'].includes(input.gender)) {
        return { ok: false, code: 'GENDER_INVALID' };
      }
      if (!['10代', '20代', '30代', '40代', '50代以上', '指定なし'].includes(input.ageBand)) {
        return { ok: false, code: 'AGE_BAND_INVALID' };
      }
      if (input.destinationSpreadsheetId && input.destinationAccountId
        && dependencies.socialAccounts.list().some((value) => value.socialAccountId !== input.socialAccountId
          && value.platform === input.platform
          && value.destinationSpreadsheetId === input.destinationSpreadsheetId
          && value.destinationAccountId === input.destinationAccountId)) {
        return { ok: false, code: 'DUPLICATE_DESTINATION_ACCOUNT' };
      }
      const keywordCount = input.keywordCount === undefined ? 3 : input.keywordCount;
      if (!Number.isInteger(keywordCount) || keywordCount < 1 || keywordCount > 6) {
        return { ok: false, code: 'KEYWORD_COUNT_OUT_OF_RANGE' };
      }
      const productsPerKeyword = input.productsPerKeyword === undefined ? 3 : input.productsPerKeyword;
      if (!Number.isInteger(productsPerKeyword) || productsPerKeyword < 1 || productsPerKeyword > 6) {
        return { ok: false, code: 'PRODUCTS_PER_KEYWORD_OUT_OF_RANGE' };
      }

      dependencies.socialAccounts.save({
        ...input, keywordCount, productsPerKeyword, updatedAt: dependencies.clock.nowJst(),
      });
      return { ok: true, code: 'SAVED' };
    },
    approveDraft(draftId) {
      const draft = dependencies.drafts.get(draftId);
      if (draft && draft.approvalStatus === 'transferred') {
        return { ok: false, code: 'ALREADY_TRANSFERRED' };
      }
      if (draft && draft.approvalStatus === 'rejected') {
        return { ok: false, code: 'REJECTED' };
      }
      if (draft && draft.approvalStatus === 'exported') {
        return { ok: false, code: 'ALREADY_EXPORTED' };
      }
      if (draft && draft.approvalStatus === 'failed') {
        return { ok: false, code: 'FAILED' };
      }
      if (!draft || draft.expiresAt <= dependencies.clock.nowJst()) {
        return { ok: false, code: 'EXPIRED' };
      }
      if (dependencies.drafts.listBySlot(draft.slotId)
        .some((value) => value.draftId !== draft.draftId && value.approvalStatus === 'approved')) {
        return { ok: false, code: 'SLOT_ALREADY_APPROVED' };
      }

      dependencies.drafts.save({ ...draft, approvalStatus: 'approved' });
      return { ok: true, code: 'APPROVED' };
    },
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createShunsukeApplication, transferApprovedDraft };
}
