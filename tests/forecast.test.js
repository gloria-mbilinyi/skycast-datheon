import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeForecast } from '../js/forecast.js';
import { formatCalendarDate } from '../js/utils.js';
const midnight = Date.parse('2026-11-22T21:00:00Z') / 1000;
test('five-day data uses the API local date boundaries rather than the viewer timezone', () => {
  const daily = { time: Array.from({ length: 5 }, (_, i) => midnight + i * 86400), temperature_2m_max: [30,31,32,33,34], temperature_2m_min: [20,21,22,23,24], weather_code: [0,1,2,3,61], sunrise: [midnight + 21600], sunset: [midnight + 64800] };
  const days = normalizeForecast({ timezone: 'Africa/Dar_es_Salaam', utc_offset_seconds: 10800, daily });
  assert.equal(days.length, 5); assert.equal(days[0].date, '2026-11-23'); assert.equal(days[4].date, '2026-11-27'); assert.equal(days[0].code, 0);
  assert.equal(formatCalendarDate('2026-11-23', { weekday: 'long' }), 'Monday');
});
test('missing, malformed and inconsistent daily fields never become invented zero values', () => {
  const days = normalizeForecast({ timezone: 'UTC', daily: { time: [midnight, midnight, null], temperature_2m_max: [null], temperature_2m_min: [0], sunrise: [0] } });
  assert.equal(days.length, 1); assert.equal(days[0].high, null); assert.equal(days[0].low, 0); assert.equal(days[0].sunrise, null);
  assert.deepEqual(normalizeForecast({ daily: {} }), []);
  assert.equal(formatCalendarDate('2026-02-30'), 'Unavailable');
  assert.equal(normalizeForecast({ daily: { time: [midnight], temperature_2m_max: [10], temperature_2m_min: [20] } })[0].high, null);
});
