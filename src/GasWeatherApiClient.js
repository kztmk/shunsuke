const WEATHER_API_BASE_URL = 'https://api.weatherapi.com/v1/';

function addHours(jstTimestamp, hours) {
  const instant = new Date(jstTimestamp);
  instant.setUTCHours(instant.getUTCHours() + hours);
  const japanTime = new Date(instant.getTime() + (9 * 60 * 60 * 1000));
  return `${japanTime.toISOString().slice(0, 19)}+09:00`;
}

function createGasWeatherApiClient(dependencies) {
  function request(path, parameters, rawCacheEntry) {
    const apiKey = dependencies.scriptProperties.get('WEATHER_API_KEY');
    if (!apiKey) throw { status: 401, providerCode: 1002 };
    const query = Object.entries({ key: apiKey, ...parameters })
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
    let response;
    try {
      response = dependencies.urlFetch.fetch(`${WEATHER_API_BASE_URL}${path}?${query}`, { muteHttpExceptions: true });
    } catch (_error) {
      throw { code: 'TIMEOUT' };
    }
    const status = response.getResponseCode();
    let payload;
    try { payload = JSON.parse(response.getContentText()); } catch (_error) { throw { status }; }
    if (status < 200 || status >= 300) throw { status, providerCode: payload.error && payload.error.code };
    if (rawCacheEntry && dependencies.rawStore) dependencies.rawStore.save({ ...rawCacheEntry, response: payload });
    return payload;
  }

  return {
    search(query) { return request('search.json', { q: query }); },
    current(locationKey, fetchedAt) {
      return request('current.json', { q: `id:${locationKey}` }, {
        locationKey, source: 'WeatherAPI.com', sourceType: 'current', fetchedAt,
        rawExpiresAt: fetchedAt ? addHours(fetchedAt, 1) : '',
      }).current;
    },
    history(locationKey, date) { return request('history.json', { q: `id:${locationKey}`, dt: date }).forecast.forecastday[0]; },
    forecast(locationKey, days, fetchedAt) {
      return request('forecast.json', { q: `id:${locationKey}`, days }, {
        locationKey, source: 'WeatherAPI.com', sourceType: 'forecast', fetchedAt,
        rawExpiresAt: fetchedAt ? addHours(fetchedAt, 24) : '',
      }).forecast.forecastday;
    },
  };
}

if (typeof module !== 'undefined') module.exports = { createGasWeatherApiClient };
