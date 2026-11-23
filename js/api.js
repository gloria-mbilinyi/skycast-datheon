export const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

export class ApiError extends Error {
  constructor(kind, message, { status = null, retryAt = null } = {}) {
    super(message); this.name = 'ApiError'; this.kind = kind; this.status = status; this.retryAt = retryAt;
  }
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
