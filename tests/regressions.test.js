import test from 'node:test';
import assert from 'node:assert/strict';
import { requestJSON, searchLocations, createLatestRequest, buildForecastURL } from '../js/api.js';
import { normalizeWeather } from '../js/weather.js';
import { normalizeForecast } from '../js/forecast.js';
import { windCompass, formatAt, formatCalendarDate } from '../js/utils.js';
import { normalizeLocation } from '../js/search.js';
import { createWeatherStorage, nextRecents, STORAGE_KEYS } from '../js/storage.js';
import { berlin, tokyo, weatherFixture } from './fixtures/weather.js';

test('out-of-order searches cannot replace a newer city even if transport ignores abort', async () => {
  const gate = createLatestRequest(); const first = gate.begin(); let resolveOld; let displayed;
  const old = searchLocations('Berlin', { signal: first.signal, fetchImpl: () => new Promise(resolve => { resolveOld = resolve; }) }).then(value => { if (first.isCurrent()) displayed = value; }).catch(error => assert.equal(error.kind, 'cancelled'));
  const second = gate.begin(); const current = await searchLocations('Tokyo', { signal: second.signal, fetchImpl: async () => new Response(JSON.stringify({ results: [tokyo] })) });
  if (second.isCurrent()) displayed = current;
  resolveOld(new Response(JSON.stringify({ results: [berlin] }))); await old;
  assert.equal(displayed[0].name, 'Tokyo');
});
test('already-aborted requests never start a network operation', async () => {
  const controller = new AbortController(); controller.abort(); let called = false;
  await assert.rejects(requestJSON('https://example.invalid', { signal: controller.signal, fetchImpl: async () => { called = true; } }), error => error.kind === 'cancelled');
  assert.equal(called, false);
});
test('cancellation while parsing a body prevents publishing that response', async () => {
  const controller = new AbortController(); let finish;
  const pending = requestJSON('https://example.invalid', { signal: controller.signal, fetchImpl: async () => ({ ok: true, json: () => new Promise(resolve => { finish = resolve; }) }) });
  await new Promise(setImmediate); controller.abort(); finish({ results: [berlin] });
  await assert.rejects(pending, error => error.kind === 'cancelled');
});
test('a complete weather response yields all requested current and five daily fields', () => {
  const weather = normalizeWeather(weatherFixture());
  assert.deepEqual(weather.current, { time: Date.UTC(2026,10,23,12)/1000, temperature: 12, feelsLike: 11, humidity: 64, wind: 14.4, windDirection: 225, pressure: 1015.2, code: 2, isDay: true });
  assert.equal(weather.days.length, 5); assert.equal(weather.days[0].date, '2026-11-23');
});
test('unexpected units are rejected rather than silently converting the wrong values', () => {
  const current = weatherFixture(); current.current_units.temperature_2m = '°F'; assert.throws(() => normalizeWeather(current));
  const daily = weatherFixture(); daily.daily_units.temperature_2m_max = '°F'; assert.throws(() => normalizeForecast(daily));
});
test('daily labels remain stable across DST while event clocks use the IANA timezone', () => {
  const midnight = Date.UTC(2026,9,31,4)/1000;
  const response = { timezone: 'America/New_York', utc_offset_seconds: -14400, daily: { time: [midnight,midnight+86400,midnight+172800], sunrise: [null,null,Date.UTC(2026,10,2,12)/1000] } };
  const days = normalizeForecast(response);
  assert.equal(days[2].date, '2026-11-02'); assert.equal(formatAt(days[2].sunrise, response.timezone), '7:00 AM');
});
test('wind compass and invalid date formatting cover boundaries without exceptions', () => {
  assert.equal(windCompass(0), 'N'); assert.equal(windCompass(360), 'N'); assert.equal(windCompass(225), 'SW');
  assert.equal(windCompass(null), null); assert.equal(windCompass(-1), null);
  assert.equal(formatAt(Infinity, 'not/a-zone'), 'Unavailable'); assert.equal(formatCalendarDate('2026-13-01'), 'Unavailable');
});
test('invalid coordinates never produce a forecast request', () => {
  for (const location of [{...berlin,latitude:NaN},{...berlin,longitude:181},{...berlin,latitude:'52.52'}]) { assert.equal(normalizeLocation(location), null); assert.throws(() => buildForecastURL(location)); }
});
test('recent history keeps five distinct cities in most-recent-first order', () => {
  let list = []; for (let i=0;i<8;i++) list = nextRecents(list, { ...normalizeLocation(berlin), latitude: i });
  assert.equal(list.length, 5); assert.deepEqual(list.map(city => city.latitude), [7,6,5,4,3]);
});
test('unsupported saved versions and invalid caches are preserved without crashing', () => {
  const data = new Map([[STORAGE_KEYS.cache, '{"version":99}'], [STORAGE_KEYS.preferences, '{"version":1,"unit":"kelvin"}']]);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key,value) => data.set(key,value) };
  const service = createWeatherStorage({ storage });
  assert.equal(service.loadCache(), null); assert.equal(service.loadUnit(), 'celsius'); assert.equal(service.saveUnit('fahrenheit'), false);
  assert.equal(data.get(STORAGE_KEYS.cache), '{"version":99}');
});
