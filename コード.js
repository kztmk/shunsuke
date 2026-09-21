function weatherNowJst() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', "yyyy-MM-dd'T'HH:mm:ss") + '+09:00';
}

function createGasWeatherRuntime() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const initialization = initializeGasWeatherEvidenceSheet(spreadsheet);
  if (!initialization.ok) throw new Error(initialization.code);
  const rawStore = createGasWeatherRawCacheStore({
    cache: CacheService.getScriptCache(),
    now: weatherNowJst,
  });
  const client = createGasWeatherApiClient({
    scriptProperties: { get: (key) => PropertiesService.getScriptProperties().getProperty(key) },
    urlFetch: { fetch: (url, options) => UrlFetchApp.fetch(url, options) },
    rawStore,
  });
  const evidenceStore = createGasWeatherEvidenceStore({
    sheet: spreadsheet.getSheetByName('WeatherEvidence'),
    ids: { nextWeatherEvidenceId: () => Utilities.getUuid() },
  });
  return {
    weather: createWeatherApiAdapter({ client, rawStore }),
    evidenceStore,
  };
}

function testWeatherApiConnection(prefecture, municipality) {
  try {
    const nowJst = weatherNowJst();
    const result = createGasWeatherRuntime().weather.collect({
      prefecture,
      municipality,
      todayJst: nowJst.slice(0, 10),
      fetchedAt: nowJst,
    });
    return result.ok ? { weatherApi: { ok: true, code: 'CONNECTED' } } : { weatherApi: { ok: false, code: result.code } };
  } catch (_error) {
    return { weatherApi: { ok: false, code: 'CONNECTION_SETUP_FAILED' } };
  }
}

function testWeatherApiConnectionForShibuya() {
  return testWeatherApiConnection('東京都', '渋谷区');
}

function initializeWeatherEvidenceSheet() {
  try {
    const result = initializeGasWeatherEvidenceSheet(SpreadsheetApp.getActiveSpreadsheet());
    console.log(JSON.stringify(result));
    return result;
  } catch (_error) {
    const result = { ok: false, code: 'WEATHER_EVIDENCE_INITIALIZATION_FAILED' };
    console.log(JSON.stringify(result));
    return result;
  }
}

function purgeExpiredWeatherRaw() {
  try {
    const result = createGasWeatherRuntime().weather.purgeExpiredRaw(weatherNowJst());
    console.log(JSON.stringify(result));
    return result;
  } catch (_error) {
    const result = { ok: false, code: 'WEATHER_RETENTION_FAILED' };
    console.log(JSON.stringify(result));
    return result;
  }
}

function collectWeatherEvidence(prefecture, municipality) {
  try {
    const nowJst = weatherNowJst();
    const runtime = createGasWeatherRuntime();
    const result = runtime.weather.collect({
      prefecture,
      municipality,
      todayJst: nowJst.slice(0, 10),
      fetchedAt: nowJst,
    });
    if (!result.ok) return result;
    result.evidence.forEach((evidence) => runtime.evidenceStore.saveEvidence({ ...evidence, locationKey: result.locationKey }));
    return { ok: true, code: 'COLLECTED', evidenceCount: result.evidence.length };
  } catch (_error) {
    return { ok: false, code: 'WEATHER_EVIDENCE_SAVE_FAILED' };
  }
}
