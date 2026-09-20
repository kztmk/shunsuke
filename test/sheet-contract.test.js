const test = require('node:test');
const assert = require('node:assert/strict');

const { ensureSheetContract, SHEET_CONTRACT } = require('../src/SheetContract');

test('ensureSheetContract は既存タブを削除せず SocialAccounts のヘッダーを作る', () => {
  const sheets = new Map([['LegacyData', ['keep']]]);
  const workbook = {
    getSheet: (name) => sheets.get(name) || null,
    createSheet: (name) => {
      const sheet = { header: null, setHeader: (header) => { sheet.header = header; } };
      sheets.set(name, sheet);
      return sheet;
    },
  };

  ensureSheetContract(workbook);

  assert.deepEqual(sheets.get('LegacyData'), ['keep']);
  assert.deepEqual(sheets.get('SocialAccounts').header, SHEET_CONTRACT.SocialAccounts);
});
