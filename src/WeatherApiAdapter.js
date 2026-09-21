const WEATHER_SOURCE = 'WeatherAPI.com';
const WEATHER_ATTRIBUTION = 'Weather data by WeatherAPI.com';
const DISCLAIMER_VERSION = 'forecast_may_change_v1';

function previousDate(dateJst) {
  const instant = new Date(`${dateJst}T00:00:00+09:00`);
  instant.setUTCDate(instant.getUTCDate() - 1);
  return new Date(instant.getTime() + (9 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}

function addHours(jstTimestamp, hours) {
  const instant = new Date(jstTimestamp);
  instant.setUTCHours(instant.getUTCHours() + hours);
  const japanTime = new Date(instant.getTime() + (9 * 60 * 60 * 1000));
  return `${japanTime.toISOString().slice(0, 19)}+09:00`;
}

function addDays(dateJst, days) {
  const instant = new Date(`${dateJst}T00:00:00+09:00`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return new Date(instant.getTime() + (9 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}

function isValidInput(input) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.todayJst) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(input.fetchedAt)) return false;
  const day = new Date(`${input.todayJst}T00:00:00+09:00`);
  return Number.isFinite(day.getTime()) && new Date(day.getTime() + (9 * 60 * 60 * 1000)).toISOString().slice(0, 10) === input.todayJst;
}

function classifyError(error) {
  if (error && error.code === 'TIMEOUT') return 'TIMEOUT';
  if (error && error.status === 429) return 'RATE_LIMITED';
  if (error && error.status >= 500) return 'SERVICE_UNAVAILABLE';
  if (error && error.providerCode === 2009) return 'PLAN_INSUFFICIENT';
  return 'WEATHER_REQUEST_FAILED';
}

function createWeatherApiAdapter(dependencies) {
  return {
    collect(input) {
      try {
        if (!isValidInput(input)) return { ok: false, code: 'WEATHER_INPUT_INVALID' };
        const locations = dependencies.client.search(`${input.prefecture} ${input.municipality}`);
        if (!Array.isArray(locations) || locations.length !== 1) return { ok: false, code: 'LOCATION_AMBIGUOUS' };
        const location = locations[0];
        const locationKey = String(location.id);
        const historyDate = previousDate(input.todayJst);
        const history = dependencies.client.history(locationKey, historyDate);
        const forecast = dependencies.client.forecast(locationKey, 3);
        const current = dependencies.client.current(locationKey);
        const expectedDates = [input.todayJst, addDays(input.todayJst, 1), addDays(input.todayJst, 2)];
        if (!history || !history.day || !current || !Array.isArray(forecast) || forecast.length < 3) return { ok: false, code: 'PLAN_INSUFFICIENT' };
        if (forecast.slice(0, 3).map((day) => day.date).join(',') !== expectedDates.join(',')) return { ok: false, code: 'FORECAST_INCOMPLETE' };
        const forecastExpiry = addHours(input.fetchedAt, 24);
        const evidenceMetadata = { source: WEATHER_SOURCE, fetchedAt: input.fetchedAt, attribution: WEATHER_ATTRIBUTION, disclaimerVersion: DISCLAIMER_VERSION };
        const evidence = [
          { targetDate: historyDate, summary: history.day.condition.text, sourceType: 'history', rawExpiresAt: '', ...evidenceMetadata },
          ...forecast.slice(0, 3).map((day) => ({ targetDate: day.date, summary: day.day.condition.text, sourceType: 'forecast', rawExpiresAt: forecastExpiry, ...evidenceMetadata })),
        ];
        dependencies.rawStore.save({ locationKey, source: WEATHER_SOURCE, sourceType: 'current', fetchedAt: input.fetchedAt, rawExpiresAt: addHours(input.fetchedAt, 60) });
        dependencies.rawStore.save({ locationKey, source: WEATHER_SOURCE, sourceType: 'history', fetchedAt: input.fetchedAt, rawExpiresAt: '' });
        dependencies.rawStore.save({ locationKey, source: WEATHER_SOURCE, sourceType: 'forecast', fetchedAt: input.fetchedAt, rawExpiresAt: forecastExpiry });
        return { ok: true, code: 'COLLECTED', locationKey, evidence };
      } catch (error) {
        return { ok: false, code: classifyError(error) };
      }
    },
    purgeExpiredRaw(nowJst) {
      try {
        return { ok: true, code: 'PURGED', count: dependencies.rawStore.deleteExpiredBefore(nowJst) };
      } catch (_error) {
        return { ok: false, code: 'RETENTION_FAILED' };
      }
    },
  };
}

if (typeof module !== 'undefined') module.exports = { createWeatherApiAdapter };
