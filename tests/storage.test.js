import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeatherStorage, nextRecents, isCacheUsable, CACHE_MAX_AGE, STORAGE_KEYS } from '../js/storage.js';
const city = { id: '1', name: 'Berlin', latitude: 52.5, longitude: 13.4, country: 'Germany' };
const memory = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
test('recent cities and unit preferences persist without duplicate coordinates', () => {
  const storage = memory(); const first = createWeatherStorage({ storage });
  const cities = nextRecents(nextRecents([], city), { ...city, name: 'Berlin updated' });
  assert.equal(cities.length, 1); first.saveRecents(cities); first.saveUnit('fahrenheit');
  const second = createWeatherStorage({ storage }); assert.equal(second.loadRecents()[0].name, 'Berlin updated'); assert.equal(second.loadUnit(), 'fahrenheit');
});
test('corrupt storage is kept intact and blocked/full storage never prevents weather use', () => {
  const storage = memory(); storage.setItem(STORAGE_KEYS.recent, '{broken');
  const warnings = []; const service = createWeatherStorage({ storage, onError: message => warnings.push(message) });
  assert.deepEqual(service.loadRecents(), []); assert.equal(service.saveRecents([city]), false); assert.equal(storage.getItem(STORAGE_KEYS.recent), '{broken'); assert.ok(warnings.length);
  const denied = createWeatherStorage({ storage: { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Full'); } } });
  assert.deepEqual(denied.loadRecents(), []); assert.equal(denied.saveUnit('fahrenheit'), false);
});
test('last successful API response is cached with a retrieval time and expires safely', () => {
  const service = createWeatherStorage({ storage: memory() }); const now = Date.now();
  service.saveCache({ location: city, response: { timezone: 'Europe/Berlin', current: { temperature_2m: 10 } }, fetchedAt: now });
  assert.equal(service.loadCache(now).location.name, 'Berlin');
  assert.equal(service.loadCache(now + CACHE_MAX_AGE + 1), null);
  assert.equal(isCacheUsable({ fetchedAt: now + 600000 }, now), false);
});
