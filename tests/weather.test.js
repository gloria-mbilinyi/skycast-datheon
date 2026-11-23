import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWeather } from '../js/weather.js';
import { buildForecastURL } from '../js/api.js';
import { formatAt, dateKeyInZone } from '../js/utils.js';
test('normalizes current model data without converting missing or zero values into fiction', () => {
  const weather = normalizeWeather({ timezone: 'Africa/Dar_es_Salaam', current: { time: 1795392000, temperature_2m: 0, relative_humidity_2m: 0, is_day: 0, weather_code: 0, pressure_msl: null } });
  assert.equal(weather.current.temperature, 0); assert.equal(weather.current.humidity, 0); assert.equal(weather.current.isDay, false); assert.equal(weather.current.pressure, null);
  assert.equal(weather.current.feelsLike, null);
});
test('invalid timezone and fields are handled safely without inventing measurements', () => {
  const weather = normalizeWeather({ timezone: 'not/a-zone', current: { temperature_2m: '25', relative_humidity_2m: 101, is_day: 9 } });
  assert.equal(weather.timezone, 'UTC'); assert.equal(weather.timezoneKnown, false); assert.equal(weather.current.temperature, null); assert.equal(weather.current.humidity, null); assert.equal(weather.current.isDay, null);
  assert.throws(() => normalizeWeather({}));
});
test('forecast requests use documented parameters, Celsius and location timezone', () => {
  const url = new URL(buildForecastURL({ name: 'Dar es Salaam', latitude: -6.82, longitude: 39.26 }));
  assert.equal(url.searchParams.get('timezone'), 'auto'); assert.equal(url.searchParams.get('forecast_days'), '5'); assert.equal(url.searchParams.get('timeformat'), 'unixtime'); assert.equal(url.searchParams.get('temperature_unit'), 'celsius');
});
test('timestamps format in the location timezone rather than the viewer timezone', () => {
  const seconds = Date.parse('2026-11-23T23:30:00Z') / 1000;
  assert.equal(dateKeyInZone(seconds, 'Asia/Tokyo'), '2026-11-24');
  assert.equal(dateKeyInZone(seconds, 'America/New_York'), '2026-11-23');
  assert.equal(formatAt(null, 'UTC'), 'Unavailable');
});
