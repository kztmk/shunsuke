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

if (typeof module !== 'undefined') {
  module.exports = { transferApprovedDraft };
}
