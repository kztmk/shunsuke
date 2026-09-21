function createGasWeatherEvidenceStore(dependencies) {
  function headers() {
    const sheet = dependencies.sheet;
    return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  }

  return {
    saveEvidence(evidence) {
      const columnNames = headers();
      const required = ['weatherEvidenceId', 'locationKey', 'source', 'sourceType', 'targetDate', 'summary', 'fetchedAt', 'rawExpiresAt', 'attribution', 'disclaimerVersion'];
      if (required.some((name) => !columnNames.includes(name))) throw new Error('WEATHER_EVIDENCE_HEADERS_INVALID');
      const row = { weatherEvidenceId: dependencies.ids.nextWeatherEvidenceId(), ...evidence };
      dependencies.sheet.getRange(dependencies.sheet.getLastRow() + 1, 1, 1, columnNames.length)
        .setValues([columnNames.map((name) => row[name] === undefined ? '' : row[name])]);
    },
  };
}

if (typeof module !== 'undefined') module.exports = { createGasWeatherEvidenceStore };
