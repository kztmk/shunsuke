const test = require('node:test');
const assert = require('node:assert/strict');
const { createGasLockAdapter } = require('../src/GasLockAdapter');

test('GASロックは処理後に必ず解放する', () => {
  const events = [];
  global.LockService = { getScriptLock: () => ({ waitLock: () => events.push('wait'), releaseLock: () => events.push('release') }) };
  try {
    assert.equal(createGasLockAdapter().withLock('draft-1', () => { events.push('run'); return 'ok'; }), 'ok');
    assert.deepEqual(events, ['wait', 'run', 'release']);
  } finally { delete global.LockService; }
});
