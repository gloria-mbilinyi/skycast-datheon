import { normalizeLocation, locationKey } from './search.js';
import { normalizeWeather } from './weather.js';

export const STORAGE_KEYS = Object.freeze({ recent: 'skycast.recents.v1', preferences: 'skycast.preferences.v1', cache: 'skycast.cache.v1' });
export const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
export function isCacheUsable(entry, now = Date.now()) { return !!entry && Number.isFinite(entry.fetchedAt) && entry.fetchedAt <= now + 300000 && now - entry.fetchedAt <= CACHE_MAX_AGE; }
export function nextRecents(current, location) { return [location, ...current.filter(item => locationKey(item) !== locationKey(location))].slice(0, 5); }

export function createWeatherStorage({ storage, onError = () => {} } = {}) {
  const protectedKeys = new Set();
  const getStorage = () => storage ?? globalThis.localStorage;
  function read(key, fallback, validate) {
    try {
      const raw = getStorage().getItem(key);
      if (raw === null) return fallback;
      const data = JSON.parse(raw);
      if (data?.version !== 1 || !validate(data)) throw new Error('Invalid saved data');
      return data;
    } catch {
      protectedKeys.add(key);
      onError('Some saved weather preferences could not be read. Existing data is kept untouched; searching still works.');
      return fallback;
    }
  }
  function write(key, data) {
    if (protectedKeys.has(key)) return false;
    try { getStorage().setItem(key, JSON.stringify(data)); return true; }
    catch { onError('This browser could not save weather preferences. You can keep exploring, but recent cities, units, or saved forecasts may not survive a reload.'); return false; }
  }
  return {
    loadRecents() {
      const data = read(STORAGE_KEYS.recent, null, data => Array.isArray(data.locations) && data.locations.length <= 5 && data.locations.every(value => normalizeLocation(value)));
      return data ? data.locations.map(normalizeLocation) : [];
    },
    saveRecents(locations) { return write(STORAGE_KEYS.recent, { version: 1, locations: locations.map(normalizeLocation).filter(Boolean).slice(0, 5) }); },
    loadUnit() { return read(STORAGE_KEYS.preferences, null, data => ['celsius', 'fahrenheit'].includes(data.unit))?.unit || 'celsius'; },
    saveUnit(unit) { return ['celsius', 'fahrenheit'].includes(unit) && write(STORAGE_KEYS.preferences, { version: 1, unit }); },
    loadCache(now = Date.now()) {
      const entry = read(STORAGE_KEYS.cache, null, data => {
        if (!normalizeLocation(data.location) || !Number.isFinite(data.fetchedAt) || data.fetchedAt <= 0) return false;
        normalizeWeather(data.response); return true;
      });
      return isCacheUsable(entry, now) ? { ...entry, location: normalizeLocation(entry.location) } : null;
    },
    saveCache(entry) { return write(STORAGE_KEYS.cache, { version: 1, location: normalizeLocation(entry.location), response: entry.response, fetchedAt: entry.fetchedAt }); },
  };
}
