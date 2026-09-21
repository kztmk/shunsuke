const MAX_GAS_CACHE_SECONDS = 6 * 60 * 60;

function createGasWeatherRawCacheStore(dependencies) {
  return {
    save(entry) {
      if (!entry.rawExpiresAt || entry.response === undefined) return;
      const remainingSeconds = Math.floor((new Date(entry.rawExpiresAt).getTime() - new Date(dependencies.now()).getTime()) / 1000);
      if (remainingSeconds <= 0) return;
      const expirationSeconds = Math.min(remainingSeconds, MAX_GAS_CACHE_SECONDS);
      const key = `weather:${entry.sourceType}:${entry.locationKey}`;
      dependencies.cache.put(key, JSON.stringify(entry), expirationSeconds);
    },
    deleteExpiredBefore(_nowJst) {
      // CacheService deletes entries automatically at their configured expiry.
      return 0;
    },
  };
}

if (typeof module !== 'undefined') module.exports = { createGasWeatherRawCacheStore };
