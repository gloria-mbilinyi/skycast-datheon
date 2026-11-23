import { validateCityQuery, normalizeLocation } from './search.js';
export const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

export class ApiError extends Error {
  constructor(kind, message, { status = null, retryAt = null } = {}) {
    super(message); this.name = 'ApiError'; this.kind = kind; this.status = status; this.retryAt = retryAt;
  }
}
export function errorDetails(error) {
  const titles = { network: 'A little connection trouble.', timeout: 'The forecast is taking a little longer.', 'rate-limit': 'Let’s give the weather service a moment.', data: 'Some forecast details didn’t arrive.', service: 'This request couldn’t be completed.', http: 'The weather service is unavailable.' };
  const known = error instanceof ApiError;
  const retryAt = known && error.kind === 'rate-limit' ? Number.isFinite(error.retryAt) && error.retryAt > Date.now() ? error.retryAt : Date.now() + 30000 : 0;
  return { title: titles[error.kind] || 'We couldn’t load that forecast.', message: known ? error.message : 'Something interrupted the request. Please try again.', retryAt };
}

export async function requestJSON(url, { signal, timeoutMs = 12000, fetchImpl = globalThis.fetch } = {}) {
  if (signal?.aborted) throw new ApiError('cancelled', 'Request canceled.');
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' } });
    if (signal?.aborted) throw new ApiError('cancelled', 'Request canceled.');
    if (!response.ok) {
      const retry = response.headers?.get('Retry-After');
      const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : null;
      const retryAt = seconds !== null ? Date.now() + seconds * 1000 : retry && Number.isFinite(Date.parse(retry)) ? Date.parse(retry) : null;
      if (response.status === 429) throw new ApiError('rate-limit', 'The weather service is busy. Please wait a little before trying again.', { status: 429, retryAt });
      throw new ApiError('http', `The weather service could not complete the request (HTTP ${response.status}). Please try again.`, { status: response.status });
    }
    let data;
    try { data = await response.json(); }
    catch (error) { if (controller.signal.aborted) throw error; throw new ApiError('data', 'The weather service returned an unreadable response. Please try again.'); }
    if (signal?.aborted) throw new ApiError('cancelled', 'Request canceled.');
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ApiError('data', 'The weather service returned an unexpected response.');
    if (data.error === true) throw new ApiError('service', 'The weather service could not process this request. Please try another location.');
    return data;
  } catch (error) {
    if (signal?.aborted) throw new ApiError('cancelled', 'Request canceled.');
    if (timedOut) throw new ApiError('timeout', 'The weather request timed out. Check your connection and try again.');
    if (error instanceof ApiError) throw error;
    throw new ApiError('network', 'We couldn’t reach the weather service. Check your internet connection and try again.');
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', cancel); }
}

export function createLatestRequest() {
  let generation = 0; let controller;
  return {
    begin() {
      controller?.abort(); controller = new AbortController();
      const ownGeneration = ++generation; const signal = controller.signal;
      return { signal, isCurrent: () => generation === ownGeneration && !signal.aborted };
    },
    cancel() { generation++; controller?.abort(); },
  };
}

export async function searchLocations(query, options) {
  const url = new URL(GEOCODING_URL);
  url.search = new URLSearchParams({ name: validateCityQuery(query), count: '8', language: 'en', format: 'json' });
  const data = await requestJSON(url.href, options);
  if (data.results === undefined) return [];
  if (!Array.isArray(data.results)) throw new ApiError('data', 'The location service returned an unexpected result. Please try again.');
  const seen = new Set();
  const locations = data.results.map(normalizeLocation).filter(location => {
    if (!location) return false;
    const key = `${location.id}:${location.latitude}:${location.longitude}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  if (data.results.length && !locations.length) throw new ApiError('data', 'The location service returned incomplete location details. Please try again.');
  return locations.slice(0, 8);
}

export function buildForecastURL(location) {
  if (!normalizeLocation(location)) throw new ApiError('location', 'Choose a valid city before requesting weather.');
  const url = new URL(FORECAST_URL);
  url.search = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,is_day', daily: 'temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset', timezone: 'auto', timeformat: 'unixtime', temperature_unit: 'celsius', wind_speed_unit: 'kmh', forecast_days: '5' });
  return url.href;
}
export function fetchWeather(location, options) { return requestJSON(buildForecastURL(location), options); }
