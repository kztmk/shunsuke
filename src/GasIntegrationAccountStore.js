function createGasIntegrationAccountStore(spreadsheet) {
  const header = ['source', 'accountId', 'platform', 'label', 'status'];
  const list = () => { const sheet = spreadsheet.getSheetByName('IntegrationAccounts'); if (!sheet || sheet.getLastRow() < 2) return []; return sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues().map(([source, accountId, platform, label, status]) => ({ source, accountId, platform, label, status })); };
  return { replaceSource(source, accounts) { const sheet = spreadsheet.getSheetByName('IntegrationAccounts'); const rows = list().filter((account) => account.source !== source).concat(accounts).map((account) => header.map((key) => account[key])); sheet.clearContents(); sheet.getRange(1, 1, 1, 5).setValues([header]); if (rows.length) sheet.getRange(2, 1, rows.length, 5).setValues(rows); } };
}
if (typeof module !== 'undefined') module.exports = { createGasIntegrationAccountStore };
