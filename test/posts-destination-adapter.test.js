const test = require('node:test');
const assert = require('node:assert/strict');

const { createPostsDestinationAdapter, REQUIRED_HEADERS } = require('../src/PostsDestinationAdapter');

test('Posts 宛先は id ヘッダーで重複を確認し、ヘッダー順に一行だけ追加する', () => {
  const appended = [];
  const sheet = {
    getLastRow: () => 2,
    getLastColumn: () => REQUIRED_HEADERS.X.length,
    getRange: (row, _column, _rows, columns) => ({
      getValues: () => row === 1 ? [REQUIRED_HEADERS.X] : [['existing-id']],
      setValues: (values) => appended.push({ row, columns, values }),
    }),
  };
  const destination = createPostsDestinationAdapter(sheet, 'X');
  assert.equal(destination.appendIfAbsent('existing-id', { id: 'existing-id' }), false);
  assert.equal(destination.appendIfAbsent('new-id', { id: 'new-id', contents: '=formula', status: 'queued', mediaUrls: [] }), true);
  assert.deepEqual(appended, [{ row: 3, columns: REQUIRED_HEADERS.X.length, values: [[
    'new-id', '', '', "'=formula", '[]', '', '', '', '', '', '', 'queued', '',
  ]] }]);
});

test('Posts 宛先は虎威または翔の必須ヘッダーが欠けると追加しない', () => {
  const sheet = {
    getLastColumn: () => 1,
    getRange: () => ({ getValues: () => [['id']] }),
  };
  assert.throws(() => createPostsDestinationAdapter(sheet, 'X').appendIfAbsent('id-1', { id: 'id-1' }), /POSTS_HEADERS_INVALID/);
});
