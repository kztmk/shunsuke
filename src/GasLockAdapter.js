function createGasLockAdapter() {
  return {
    withLock: function (key, operation) {
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);
      try {
        return operation();
      } finally {
        lock.releaseLock();
      }
    },
  };
}

if (typeof module !== 'undefined') module.exports = { createGasLockAdapter };
