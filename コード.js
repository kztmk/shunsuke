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

function integrationController() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = (properties.getProperty('SHUNSUKE_SPREADSHEET_ID') || '').trim();
  if (!spreadsheetId) throw new Error('SHUNSUKE_SPREADSHEET_ID_REQUIRED');
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  ensureSheetContract({ getSheet: (name) => spreadsheet.getSheetByName(name), createSheet: (name) => { const sheet = spreadsheet.insertSheet(name); return { setHeader: (header) => sheet.getRange(1, 1, 1, header.length).setValues([header]) }; } });
  return createIntegrationSyncController({ now: () => Date.now(), newSecret: () => Utilities.getUuid(), properties: { get: (key) => properties.getProperty(key), set: (key, value) => properties.setProperty(key, value), delete: (key) => properties.deleteProperty(key) }, store: createGasIntegrationAccountStore(spreadsheet) });
}
function createIntegrationSetupCode(source) { const suffix = source === '虎威' ? 'TORAI' : source === '翔' ? 'AKIRA' : null; if (!suffix) return { ok: false, code: 'SOURCE_INVALID' }; const code = Utilities.getUuid(); const properties = PropertiesService.getScriptProperties(); properties.setProperty(`INTEGRATION_SETUP_CODE_${suffix}`, code); properties.setProperty(`INTEGRATION_SETUP_CODE_EXPIRES_AT_${suffix}`, String(Date.now() + 600000)); return { ok: true, setupCode: code }; }
function doPost(event) { try { const request = JSON.parse(event.postData.contents); const controller = integrationController(); const result = request.action === 'initialize' ? controller.initialize(request) : controller.synchronize(request); return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON); } catch (_error) { return ContentService.createTextOutput(JSON.stringify({ ok: false, code: 'REQUEST_FAILED' })).setMimeType(ContentService.MimeType.JSON); } }
