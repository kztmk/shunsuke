const WEATHER_EVIDENCE_HEADERS = [
  'weatherEvidenceId', 'locationKey', 'source', 'sourceType', 'targetDate',
  'summary', 'fetchedAt', 'rawExpiresAt', 'attribution', 'disclaimerVersion',
];

function initializeGasWeatherEvidenceSheet(spreadsheet) {
  if (!spreadsheet) throw new Error('ACTIVE_SPREADSHEET_REQUIRED');

  let sheet = spreadsheet.getSheetByName('WeatherEvidence');
  const created = !sheet;
  if (created) sheet = spreadsheet.insertSheet('WeatherEvidence');

  const range = sheet.getRange(1, 1, 1, WEATHER_EVIDENCE_HEADERS.length);
  const existingHeaders = range.getValues()[0];
  const isEmpty = existingHeaders.every((value) => value === '');
  if (isEmpty) {
    range.setValues([WEATHER_EVIDENCE_HEADERS]);
    return { ok: true, code: 'INITIALIZED', created };
  }

  const matchesContract = WEATHER_EVIDENCE_HEADERS.every((header, index) => existingHeaders[index] === header);
  if (matchesContract) return { ok: true, code: 'ALREADY_INITIALIZED', created: false };

  return { ok: false, code: 'WEATHER_EVIDENCE_HEADERS_CONFLICT', created: false };
}

if (typeof module !== 'undefined') {
  module.exports = { initializeGasWeatherEvidenceSheet, WEATHER_EVIDENCE_HEADERS };
}
