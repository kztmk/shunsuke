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

      dependencies.socialAccounts.save({ ...input, keywordCount, updatedAt: dependencies.clock.nowJst() });
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
