function createPhase5DraftService(dependencies) {
  const styles = {
    X: '結論を早くし、短く、商品と利用場面を明確にする',
    Threads: '生活場面と選定理由を少し詳しくする',
    Bluesky: '簡潔で自然な会話調にする',
  };
  return {
    generateDraft(input) {
      try {
        if (!styles[input.platform]) return { ok: false, code: 'PLATFORM_UNSUPPORTED' };
        const generated = dependencies.generator.generate({ platform: input.platform, style: styles[input.platform], candidate: input.candidate });
        if (typeof generated !== 'string' || /https?:\/\//.test(generated)) return { ok: false, code: 'DRAFT_GENERATION_INVALID' };
        const body = ['【PR】', generated, input.candidate.affiliateUrl, input.weatherAttribution].join('\n');
        if (!input.rules[input.platform] || body.length > input.rules[input.platform].maxLength) return { ok: false, code: 'DRAFT_LENGTH_INVALID' };
        return { ok: true, code: 'DRAFT_GENERATED', draft: {
          candidateId: input.candidate.candidateId, platform: input.platform, approvalStatus: 'generated', body,
          requiredParts: { pr: '【PR】', affiliateUrl: input.candidate.affiliateUrl, weatherAttribution: input.weatherAttribution },
          productCheckedAt: input.candidate.productCheckedAt,
          evidence: input.candidate.evidence || {},
        } };
      } catch (_error) {
        return { ok: false, code: 'DRAFT_GENERATION_FAILED' };
      }
    },
    generateDrafts(input) {
      const drafts = [];
      for (const candidate of input.candidates) {
        const result = this.generateDraft({ ...input, candidate });
        if (!result.ok) return result;
        drafts.push(result.draft);
      }
      return { ok: true, code: 'DRAFTS_GENERATED', drafts };
    },
    select(draftId) {
      const draft = dependencies.drafts.get(draftId);
      if (!draft || draft.approvalStatus !== 'generated') return { ok: false, code: 'DRAFT_NOT_SELECTABLE' };
      dependencies.drafts.save({ ...draft, approvalStatus: 'selected' });
      return { ok: true, code: 'SELECTED' };
    },
    selectCandidate(candidateId) {
      const draft = dependencies.drafts.findByCandidateId(candidateId);
      if (!draft || draft.approvalStatus !== 'generated') return { ok: false, code: 'DRAFT_NOT_SELECTABLE' };
      dependencies.drafts.save({ ...draft, approvalStatus: 'selected' });
      return { ok: true, code: 'SELECTED' };
    },
    edit(draftId, body) {
      const draft = dependencies.drafts.get(draftId);
      if (!draft) return { ok: false, code: 'DRAFT_NOT_FOUND' };
      if (draft.approvalStatus === 'transferred') return { ok: false, code: 'TRANSFERRED_IMMUTABLE' };
      if (!['selected', 'editing'].includes(draft.approvalStatus) || !body) return { ok: false, code: 'DRAFT_NOT_EDITABLE' };
      dependencies.drafts.save({ ...draft, finalBody: body, approvalStatus: 'editing', validationStatus: 'pending' });
      return { ok: true, code: 'EDITED' };
    },
    validate(draftId, rule) {
      const draft = dependencies.drafts.get(draftId);
      if (!draft || draft.approvalStatus !== 'editing' || !draft.finalBody || draft.finalBody.length > rule.maxLength
        || !draft.productCheckedAt || !draft.requiredParts
        || !Object.values(draft.requiredParts).every((part) => draft.finalBody.includes(part))) return { ok: false, code: 'DRAFT_INVALID' };
      dependencies.drafts.save({ ...draft, validationStatus: 'valid' });
      return { ok: true, code: 'VALID' };
    },
    reject(draftId) {
      const draft = dependencies.drafts.get(draftId);
      if (!draft || !['generated', 'selected', 'editing'].includes(draft.approvalStatus)) return { ok: false, code: 'DRAFT_NOT_REJECTABLE' };
      dependencies.drafts.save({ ...draft, approvalStatus: 'rejected' });
      return { ok: true, code: 'REJECTED' };
    },
    rejectCandidate(candidateId) {
      const draft = dependencies.drafts.findByCandidateId(candidateId);
      if (!draft || !['generated', 'selected', 'editing'].includes(draft.approvalStatus)) return { ok: false, code: 'DRAFT_NOT_REJECTABLE' };
      dependencies.drafts.save({ ...draft, approvalStatus: 'rejected' });
      return { ok: true, code: 'REJECTED' };
    },
    rescheduleExpired(draftId, newPostSchedule) {
      const draft = dependencies.drafts.get(draftId);
      if (!draft || draft.approvalStatus !== 'expired' || !newPostSchedule) return { ok: false, code: 'DRAFT_NOT_RESCHEDULABLE' };
      dependencies.drafts.save({ ...draft, postSchedule: newPostSchedule, finalBody: '', requiredParts: undefined, productCheckedAt: '', weatherAttribution: '', approvalStatus: 'editing', validationStatus: 'pending' });
      return { ok: true, code: 'RESCHEDULED' };
    },
  };
}

if (typeof module !== 'undefined') module.exports = { createPhase5DraftService };
