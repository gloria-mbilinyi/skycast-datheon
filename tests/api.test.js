import test from 'node:test';
import assert from 'node:assert/strict';
import { requestJSON, createLatestRequest, ApiError } from '../js/api.js';
const url = 'https://api.open-meteo.com/v1/forecast';
const response = (body, status = 200, headers) => new Response(JSON.stringify(body), { status, headers });
test('processes successful API JSON without credentials', async () => {
  const data = await requestJSON(url, { fetchImpl: async (target, options) => { assert.equal(target, url); assert.equal(options.credentials, 'omit'); assert.ok(options.signal); return response({ current: { temperature_2m: 25 } }); } });
  assert.equal(data.current.temperature_2m, 25);
});
test('handles network errors, HTTP errors, error bodies and malformed JSON', async () => {
  for (const [kind, fetchImpl] of [
    ['network', async () => { throw new TypeError('Offline'); }],
    ['http', async () => response({}, 503)],
    ['service', async () => response({ error: true, reason: '<unsafe provider text>' })],
    ['data', async () => new Response('not json')],
    ['data', async () => response([])],
  ]) await assert.rejects(requestJSON(url, { fetchImpl }), error => error instanceof ApiError && error.kind === kind);
});
test('exposes rate limiting and Retry-After without retrying automatically', async () => {
  await assert.rejects(requestJSON(url, { fetchImpl: async () => response({}, 429, { 'Retry-After': '30' }) }), error => error.kind === 'rate-limit' && error.retryAt > Date.now());
});
test('cancels in-flight requests and times out stalled requests', async () => {
  const stalled = async (_, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
  const controller = new AbortController();
  const pending = requestJSON(url, { signal: controller.signal, fetchImpl: stalled }); controller.abort();
  await assert.rejects(pending, error => error.kind === 'cancelled');
  await assert.rejects(requestJSON(url, { fetchImpl: stalled, timeoutMs: 5 }), error => error.kind === 'timeout');
});
test('latest-request guard prevents old results from replacing a newer search', () => {
  const gate = createLatestRequest(); const first = gate.begin(); const second = gate.begin();
  assert.equal(first.signal.aborted, true); assert.equal(first.isCurrent(), false); assert.equal(second.isCurrent(), true);
  gate.cancel(); assert.equal(second.isCurrent(), false);
});
