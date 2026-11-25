function createIntegrationSyncController(dependencies) {
  const suffix = (source) => source === '虎威' ? 'TORAI' : source === '翔' ? 'AKIRA' : null;
  const allowed = (account, source) => account && account.source === source && account.accountId && account.label && ['X', 'Threads', 'Bluesky'].includes(account.platform) && ['active', 'disabled'].includes(account.status) && !['apiKey', 'apiSecret', 'accessToken', 'accessTokenSecret', 'password', 'token', 'secret'].some((key) => Object.hasOwn(account, key));
  return {
    initialize(request) {
      const key = suffix(request && request.source);
      if (!key || !request.ownerUid || request.setupCode !== dependencies.properties.get(`INTEGRATION_SETUP_CODE_${key}`) || Number(dependencies.properties.get(`INTEGRATION_SETUP_CODE_EXPIRES_AT_${key}`)) < dependencies.now()) return { ok: false, code: 'SETUP_CODE_INVALID' };
      const secret = dependencies.newSecret();
      dependencies.properties.set(`INTEGRATION_SYNC_SECRET_${key}`, secret); dependencies.properties.set(`INTEGRATION_SYNC_OWNER_UID_${key}`, request.ownerUid); dependencies.properties.delete(`INTEGRATION_SETUP_CODE_${key}`); dependencies.properties.delete(`INTEGRATION_SETUP_CODE_EXPIRES_AT_${key}`);
      return { ok: true, syncSecret: secret };
    },
    synchronize(request) {
      const key = suffix(request && request.source);
      if (!key || !Array.isArray(request.accounts) || request.accounts.some((account) => !allowed(account, request.source))) return { ok: false, code: 'ACCOUNT_DATA_INVALID' };
      if (dependencies.properties.get(`INTEGRATION_SYNC_OWNER_UID_${key}`) !== request.ownerUid || dependencies.properties.get(`INTEGRATION_SYNC_SECRET_${key}`) !== request.secret) return { ok: false, code: 'UNAUTHORIZED' };
      dependencies.store.replaceSource(request.source, request.accounts.map(({ source, accountId, platform, label, status }) => ({ source, accountId, platform, label, status })));
      return { ok: true, count: request.accounts.length };
    },
  };
}
if (typeof module !== 'undefined') module.exports = { createIntegrationSyncController };
