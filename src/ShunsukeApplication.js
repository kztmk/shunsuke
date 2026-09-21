function transferApprovedDraft(draft, destination) {
  if (!draft || draft.approvalStatus !== 'approved') {
    return { ok: false, code: 'NOT_APPROVED' };
  }

  destination.append({ draftId: draft.draftId, body: draft.finalBody });
  return { ok: true, code: 'TRANSFERRED' };
}

function createPostsRow(draft, transferId) {
  const common = {
    id: transferId,
    createdAt: draft.approvedAt,
    contents: draft.finalBody,
    mediaUrls: [],
    postSchedule: draft.postSchedule || '',
    status: 'queued',
    errorMessage: '',
  };

  if (draft.platform === 'X') {
    return {
      ...common,
      postTo: draft.destinationAccountId || '',
      inReplyToInternal: '',
      postId: '',
      inReplyToOnX: '',
      quoteId: '',
      repostTargetId: '',
    };
  }

  return {
    ...common,
    platform: String(draft.platform || '').toLowerCase(),
    accountId: draft.destinationAccountId || '',
    crossPostGroupId: '',
    inReplyTo: '',
    postId: '',
  };
}

function dateWithOffset(dateJst, postTimeJst, offsetMinutes) {
  const [hour, minute] = postTimeJst.split(':').map(Number);
  const instant = new Date(`${dateJst}T00:00:00+09:00`);
  instant.setUTCMinutes(instant.getUTCMinutes() + (hour * 60) + minute - offsetMinutes);
  const japanDate = new Date(instant.getTime() + (9 * 60 * 60 * 1000));
  const yyyyMmDd = japanDate.toISOString().slice(0, 10);
  const hhMm = japanDate.toISOString().slice(11, 16);
  return `${yyyyMmDd}T${hhMm}:00+09:00`;
}

function addJstDays(dateJst, days) {
  const instant = new Date(`${dateJst}T00:00:00+09:00`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return new Date(instant.getTime() + (9 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}

function isValidJstTimestamp(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(value)) return false;
  const instant = Date.parse(value);
  if (!Number.isFinite(instant)) return false;
  return new Date(instant + (9 * 60 * 60 * 1000)).toISOString().slice(0, 19) === value.slice(0, 19);
}

function createShunsukeApplication(dependencies) {
  return {
    generateForSlot(slotId, targetDateJst) {
      try {
        return dependencies.phase4.generateForSlot(slotId, targetDateJst);
      } catch (_error) {
        return { ok: false, code: 'CANDIDATE_GENERATION_FAILED' };
      }
    },
    runDueGenerations(nowJst) {
      const now = Date.parse(nowJst);
      if (!isValidJstTimestamp(nowJst) || !Number.isFinite(now)) {
        return { ok: false, code: 'NOW_INVALID' };
      }
      try {
        return dependencies.locks.withLock('due-generations', () => {
          const targetDateJst = nowJst.slice(0, 10);
          const startedGenerationIds = [];
          dependencies.postSlots.listActive().forEach((slot) => {
            [targetDateJst, addJstDays(targetDateJst, 1)].forEach((slotTargetDateJst) => {
              const scheduledPostAt = dateWithOffset(slotTargetDateJst, slot.postTimeJst, 0);
              const scheduledGenerationAt = dateWithOffset(slotTargetDateJst, slot.postTimeJst, slot.generationOffsetMinutes);
              if (Date.parse(scheduledGenerationAt) <= now && now < Date.parse(scheduledPostAt)
                && !dependencies.generationRuns.findBySlotAndTargetDate(slot.slotId, slotTargetDateJst)) {
                const generationId = dependencies.ids.nextGenerationId();
                dependencies.generationRuns.start({
                  generationId,
                  slotId: slot.slotId,
                  socialAccountId: slot.socialAccountId,
                  targetDateJst: slotTargetDateJst,
                  scheduledGenerationAt,
                  scheduledPostAt,
                  startedAt: nowJst,
                  completedAt: '',
                  status: 'running',
                  weatherStatus: 'pending',
                  rankingStatus: 'pending',
                  searchStatus: 'pending',
                  aiStatus: 'pending',
                  candidateCount: 0,
                  errorCode: '',
                });
                startedGenerationIds.push(generationId);
              }
            });
          });
          const expiredDraftIds = [];
          dependencies.drafts.listUnapprovedDueAtOrBefore(nowJst).forEach((draft) => {
            if (['generated', 'selected', 'editing'].includes(draft.approvalStatus)) {
              dependencies.drafts.save({ ...draft, approvalStatus: 'expired' });
              expiredDraftIds.push(draft.draftId);
            }
          });
          return { ok: true, code: 'PROCESSED', startedGenerationIds, expiredDraftIds };
        });
      } catch (_error) {
        return { ok: false, code: 'DUE_GENERATION_FAILED' };
      }
    },
    transferApprovedDraft(draftId) {
      return dependencies.locks.withLock(`draft:${draftId}`, () => {
        const draft = dependencies.drafts.get(draftId);
        if (draft && draft.approvalStatus === 'transferred') {
          return { ok: false, code: 'ALREADY_TRANSFERRED' };
        }
        if (!draft || draft.approvalStatus !== 'approved') {
          return { ok: false, code: 'NOT_APPROVED' };
        }
        const expiresAt = Date.parse(draft.expiresAt);
        const now = dependencies.clock.nowJst();
        if (!Number.isFinite(expiresAt) || !Number.isFinite(Date.parse(now)) || expiresAt <= Date.parse(now)) {
          return { ok: false, code: 'EXPIRED' };
        }
        if (!['X', 'Threads', 'Bluesky'].includes(draft.platform)) {
          return { ok: false, code: 'DESTINATION_PLATFORM_INVALID' };
        }

        const transferId = draft.transferId || dependencies.ids.nextTransferId();
        if (!draft.transferId) {
          try {
            dependencies.drafts.save({ ...draft, transferId });
          } catch (_error) {
            return { ok: false, code: 'SOURCE_SAVE_FAILED' };
          }
        }
        try {
          dependencies.destinations.appendIfAbsent(transferId, createPostsRow(draft, transferId));
        } catch (error) {
          if (error && error.message === 'POSTS_HEADERS_INVALID') {
            return { ok: false, code: 'DESTINATION_CONTRACT_INVALID' };
          }
          return { ok: false, code: 'DESTINATION_APPEND_FAILED' };
        }
        try {
          dependencies.drafts.save({ ...draft, transferId, approvalStatus: 'transferred' });
          return { ok: true, code: 'TRANSFERRED' };
        } catch (_error) {
          return { ok: false, code: 'SOURCE_STATE_UPDATE_FAILED' };
        }
      });
    },
    saveApiKey(provider, value) {
      const keyNames = { gemini: 'GEMINI_API_KEY', weatherApi: 'WEATHER_API_KEY' };
      if (!keyNames[provider] || typeof value !== 'string' || value.length === 0) {
        return { ok: false, code: 'API_KEY_INVALID' };
      }

      dependencies.scriptProperties.set(keyNames[provider], value);
      dependencies.appSettings.markKeyConfigured(provider);
      return { ok: true, code: 'SAVED' };
    },
    getConnectionStatus() {
      return {
        gemini: dependencies.scriptProperties.isConfigured('GEMINI_API_KEY') ? 'configured' : 'not_configured',
        weatherApi: dependencies.scriptProperties.isConfigured('WEATHER_API_KEY') ? 'configured' : 'not_configured',
      };
    },
    testExternalConnections() {
      const results = {};
      if (typeof dependencies.connections.testGemini === 'function') {
        try { dependencies.connections.testGemini(); results.gemini = { ok: true, code: 'CONNECTED' }; } catch (_error) { results.gemini = { ok: false, code: 'CONNECTION_FAILED' }; }
      }
      if (typeof dependencies.connections.testWeatherApi === 'function') {
        try { dependencies.connections.testWeatherApi(); results.weatherApi = { ok: true, code: 'CONNECTED' }; } catch (_error) { results.weatherApi = { ok: false, code: 'CONNECTION_FAILED' }; }
      }
      return results;
    },
    savePostSlots(socialAccountId, slots) {
      if (!Array.isArray(slots) || slots.length > 6) {
        return { ok: false, code: 'SLOT_LIMIT_EXCEEDED' };
      }
      if (slots.some((slot) => !slot || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot.postTimeJst))) {
        return { ok: false, code: 'POST_TIME_INVALID' };
      }
      if (new Set(slots.map((slot) => slot.postTimeJst)).size !== slots.length) {
        return { ok: false, code: 'DUPLICATE_POST_TIME' };
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
      if (!input || input.country !== '日本') return { ok: false, code: 'COUNTRY_FIXED_TO_JAPAN' };
      if (!input.prefecture || !input.municipality) return { ok: false, code: 'LOCATION_REQUIRED' };
      if (!['X', 'Threads', 'Bluesky'].includes(input.platform)) return { ok: false, code: 'PLATFORM_UNSUPPORTED' };
      if (!['女性', '男性', '指定なし'].includes(input.gender)) return { ok: false, code: 'GENDER_INVALID' };
      if (!['10代', '20代', '30代', '40代', '50代以上', '指定なし'].includes(input.ageBand)) return { ok: false, code: 'AGE_BAND_INVALID' };
      if (input.destinationSpreadsheetId && input.destinationAccountId
        && dependencies.socialAccounts.list().some((value) => value.socialAccountId !== input.socialAccountId
          && value.platform === input.platform
          && value.destinationSpreadsheetId === input.destinationSpreadsheetId
          && value.destinationAccountId === input.destinationAccountId)) {
        return { ok: false, code: 'DUPLICATE_DESTINATION_ACCOUNT' };
      }
      const keywordCount = input.keywordCount === undefined ? 3 : input.keywordCount;
      if (!Number.isInteger(keywordCount) || keywordCount < 1 || keywordCount > 6) return { ok: false, code: 'KEYWORD_COUNT_OUT_OF_RANGE' };
      const productsPerKeyword = input.productsPerKeyword === undefined ? 3 : input.productsPerKeyword;
      if (!Number.isInteger(productsPerKeyword) || productsPerKeyword < 1 || productsPerKeyword > 6) return { ok: false, code: 'PRODUCTS_PER_KEYWORD_OUT_OF_RANGE' };
      const minReviewAverage = input.minReviewAverage === undefined ? 4 : input.minReviewAverage;
      if (!Number.isFinite(minReviewAverage) || minReviewAverage < 0 || minReviewAverage > 5) return { ok: false, code: 'REVIEW_AVERAGE_INVALID' };
      const minReviewCount = input.minReviewCount === undefined ? 10 : input.minReviewCount;
      if (!Number.isInteger(minReviewCount) || minReviewCount < 0) return { ok: false, code: 'REVIEW_COUNT_INVALID' };
      const transferredCooldownDays = input.transferredCooldownDays === undefined ? 7 : input.transferredCooldownDays;
      const rejectedCooldownDays = input.rejectedCooldownDays === undefined ? 3 : input.rejectedCooldownDays;
      if (!Number.isInteger(transferredCooldownDays) || transferredCooldownDays < 0
        || !Number.isInteger(rejectedCooldownDays) || rejectedCooldownDays < 0) return { ok: false, code: 'COOLDOWN_INVALID' };
      const tone = input.tone === undefined ? '' : input.tone;
      const requiredPhrases = input.requiredPhrases === undefined ? [] : input.requiredPhrases;
      const prohibitedPhrases = input.prohibitedPhrases === undefined ? [] : input.prohibitedPhrases;
      if (typeof tone !== 'string' || !Array.isArray(requiredPhrases) || !Array.isArray(prohibitedPhrases)
        || !requiredPhrases.every((phrase) => typeof phrase === 'string')
        || !prohibitedPhrases.every((phrase) => typeof phrase === 'string')) return { ok: false, code: 'WRITING_CONDITION_INVALID' };

      dependencies.socialAccounts.save({
        ...input, keywordCount, productsPerKeyword, minReviewAverage, minReviewCount,
        transferredCooldownDays, rejectedCooldownDays, tone, requiredPhrases, prohibitedPhrases,
        updatedAt: dependencies.clock.nowJst(),
      });
      return { ok: true, code: 'SAVED' };
    },
    approveDraft(draftId) {
      const initial = dependencies.drafts.get(draftId);
      return dependencies.locks.withLock(`slot:${initial && initial.slotId}`, () => {
        const draft = dependencies.drafts.get(draftId);
        if (draft && draft.approvalStatus === 'transferred') return { ok: false, code: 'ALREADY_TRANSFERRED' };
        if (draft && draft.approvalStatus === 'rejected') return { ok: false, code: 'REJECTED' };
        if (draft && draft.approvalStatus === 'exported') return { ok: false, code: 'ALREADY_EXPORTED' };
        if (draft && draft.approvalStatus === 'failed') return { ok: false, code: 'FAILED' };

        const nowJst = dependencies.clock.nowJst();
        const expiresAt = draft && Date.parse(draft.expiresAt);
        if (!draft || !Number.isFinite(expiresAt) || !Number.isFinite(Date.parse(nowJst))) return { ok: false, code: 'EXPIRED' };
        if (expiresAt <= Date.parse(nowJst)) {
          dependencies.drafts.save({ ...draft, approvalStatus: 'expired' });
          return { ok: false, code: 'EXPIRED' };
        }
        if (draft.approvalStatus !== 'editing' || !draft.finalBody || !draft.productCheckedAt || draft.validationStatus !== 'valid') {
          return { ok: false, code: 'DRAFT_NOT_READY' };
        }
        if (dependencies.drafts.listBySlot(draft.slotId)
          .some((value) => value.draftId !== draft.draftId && value.approvalStatus === 'approved')) {
          return { ok: false, code: 'SLOT_ALREADY_APPROVED' };
        }

        dependencies.drafts.save({ ...draft, approvalStatus: 'approved', approvedAt: nowJst });
        return { ok: true, code: 'APPROVED' };
      });
    },
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createShunsukeApplication, transferApprovedDraft, createPostsRow };
}
