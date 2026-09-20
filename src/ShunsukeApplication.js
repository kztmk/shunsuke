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
