import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { berlin, otherBerlin, tokyo, weatherFixture } from '../fixtures/weather.js';

const serviceStates = new WeakMap();
const json = (route, body, status = 200, extra = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...extra }, body: JSON.stringify(body) });
async function mockServices(page) {
  const state = { geoCalls: [], weatherCalls: [], geoStatus: 200, weatherStatus: 200, geoNetworkError: false, geoBody: null, weatherBody: null, geoDelay: null, weatherDelay: null };
  await page.route('https://geocoding-api.open-meteo.com/**', async route => {
    const query = new URL(route.request().url()).searchParams.get('name'); state.geoCalls.push(query);
    if (state.geoDelay) await state.geoDelay(query);
    try {
      if (state.geoNetworkError) return await route.abort('internetdisconnected');
      const results = query.toLowerCase().includes('tokyo') ? [tokyo] : query === 'Nothingville' ? [] : [berlin, otherBerlin];
      await json(route, state.geoBody || { results }, state.geoStatus, state.geoStatus === 429 ? { 'Retry-After': '30' } : {});
    } catch { /* A newer search is allowed to abort a held mock request. */ }
  });
  await page.route('https://api.open-meteo.com/**', async route => {
    const params = new URL(route.request().url()).searchParams; state.weatherCalls.push(Object.fromEntries(params));
    if (state.weatherDelay) await state.weatherDelay(params);
    const latitude = Number(params.get('latitude'));
    const body = state.weatherBody || (latitude === tokyo.latitude ? weatherFixture({ timezone: 'Asia/Tokyo', offset: 32400, temperature: 30, code: 0 }) : latitude === otherBerlin.latitude ? weatherFixture({ timezone: 'America/New_York', offset: -18000, temperature: 4 }) : weatherFixture());
    try { await json(route, body, state.weatherStatus, state.weatherStatus === 429 ? { 'Retry-After': '30' } : {}); } catch { /* Canceled by a newer city selection. */ }
  });
  serviceStates.set(page, state); return state;
}
async function search(page, query = 'Berlin') { await page.locator('#city-search').fill(query); await page.locator('#search-submit').click(); await expect(page.getByRole('option').first()).toBeVisible(); }
async function selectCity(page, query = 'Berlin', index = 0) { await search(page, query); await page.getByRole('option').nth(index).click(); await expect(page.locator('#weather-content')).toBeVisible(); }
async function noOverflow(page) { const size = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth })); expect(size.scroll).toBeLessThanOrEqual(size.width); }
const accessibility = page => new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();

test.beforeEach(async ({ page }) => { await mockServices(page); await page.goto('./'); });

test('initial state has no invented telemetry and explains model-based data', async ({ page }) => {
  await expect(page.locator('#welcome')).toBeVisible(); await expect(page.locator('#weather-content')).toBeHidden();
  await expect(page.locator('#data-source')).toContainText('model-based estimates');
  expect(serviceStates.get(page).weatherCalls).toHaveLength(0);
  expect((await accessibility(page)).violations).toEqual([]);
});
test('invalid and too-short city input produces helpful field errors', async ({ page }) => {
  await page.locator('#search-submit').click(); await expect(page.locator('#search-error')).toContainText('at least 2');
  await page.locator('#city-search').fill('X'); await page.locator('#search-submit').click();
  await expect(page.locator('#city-search')).toHaveAttribute('aria-invalid','true');
  expect(serviceStates.get(page).geoCalls).toHaveLength(0);
});
test('disambiguates cities and requests coordinates for the chosen region', async ({ page }) => {
  await search(page); await expect(page.getByRole('option')).toHaveCount(2);
  await expect(page.getByRole('option').nth(1)).toContainText('New Hampshire');
  expect((await accessibility(page)).violations).toEqual([]);
  await page.getByRole('option').nth(1).click();
  await expect(page.locator('#location-timezone')).toHaveText('America/New_York');
  expect(serviceStates.get(page).weatherCalls[0].latitude).toBe(String(otherBerlin.latitude));
});
test('renders current weather metrics five days and solar times from response fields', async ({ page }) => {
  await selectCity(page);
  await expect(page.locator('#current-temperature')).toHaveText('12°C');
  await expect(page.locator('#current-condition')).toHaveText('Partly cloudy');
  await expect(page.locator('#metric-humidity')).toHaveText('64%');
  await expect(page.locator('#metric-wind')).toHaveText('14.4km/h');
  await expect(page.locator('#metric-pressure')).toHaveText('1,015hPa');
  await expect(page.locator('.forecast-card')).toHaveCount(5);
  await expect(page.locator('#sunrise-time')).toHaveText('7:00 AM');
  await expect(page.locator('#last-updated')).toContainText('Europe/Berlin');
  await expect(page.locator('#chart-card')).toBeVisible();
});
test('unit switching updates every temperature without making another API request', async ({ page }) => {
  await selectCity(page); const state = serviceStates.get(page);
  await page.locator('[data-unit="fahrenheit"]').click();
  await expect(page.locator('#current-temperature')).toHaveText('54°F');
  await expect(page.locator('#metric-feels')).toHaveText('52°F');
  await expect(page.locator('.forecast-temps').first()).toContainText('57°F');
  await expect(page.locator('#current-range')).toContainText('57°F');
  await expect(page.locator('#chart-card figcaption')).toContainText('°F');
  expect(state.weatherCalls).toHaveLength(1);
  await page.reload(); await expect(page.locator('[data-unit="fahrenheit"]')).toHaveAttribute('aria-pressed','true');
});
test('keyboard suggestions select with arrows and Enter and dismiss with Escape', async ({ page }) => {
  await page.locator('#city-search').fill('Berlin');
  await expect(page.getByRole('option')).toHaveCount(2);
  await page.locator('#city-search').press('ArrowDown');
  await expect(page.locator('#city-search')).toHaveAttribute('aria-activedescendant','city-option-0');
  await page.locator('#city-search').press('Enter'); await expect(page.locator('#weather-content')).toBeVisible();
  await expect(page.locator('#location-name')).toBeFocused();
  await page.keyboard.press('/'); await expect(page.locator('#city-search')).toBeFocused();
  await search(page,'Tokyo'); await page.locator('#city-search').press('Escape');
  await expect(page.locator('#search-panel')).toBeHidden();
});
test('unknown cities show a useful empty result without changing current weather', async ({ page }) => {
  await page.locator('#city-search').fill('Nothingville'); await page.locator('#search-submit').click();
  await expect(page.locator('#search-status')).toContainText('No cities found');
  await expect(page.getByRole('option')).toHaveCount(0); await expect(page.locator('#weather-content')).toBeHidden();
});
test('network failure in geocoding can be retried', async ({ page }) => {
  const state = serviceStates.get(page); state.geoNetworkError = true;
  await page.locator('#city-search').fill('Berlin'); await page.locator('#search-submit').click();
  await expect(page.locator('#search-status')).toContainText('connection');
  state.geoNetworkError = false; await page.locator('#search-retry').click(); await expect(page.getByRole('option')).toHaveCount(2);
});
test('forecast API errors expose retry and never substitute sample values', async ({ page }) => {
  const state = serviceStates.get(page); state.weatherStatus = 503;
  await search(page); await page.getByRole('option').first().click();
  await expect(page.locator('#weather-error')).toBeVisible(); await expect(page.locator('#weather-content')).toBeHidden();
  state.weatherStatus = 200; await page.locator('#weather-retry').click(); await expect(page.locator('.forecast-card')).toHaveCount(5);
});
test('rate limits show a cooldown without an automatic retry storm', async ({ page }) => {
  const state = serviceStates.get(page); state.geoStatus = 429;
  await page.locator('#city-search').fill('Berlin'); await page.locator('#search-submit').click();
  await expect(page.locator('#search-status')).toContainText('moment');
  await expect(page.locator('#search-retry')).toBeDisabled(); await expect(page.locator('#search-submit')).toBeDisabled();
  expect(state.geoCalls).toHaveLength(1);
});
test('recent cities persist and cached responses are always explicitly stale on reload', async ({ page }) => {
  await selectCity(page); await page.reload();
  await expect(page.locator('#recent-list button')).toHaveCount(1); await expect(page.locator('#stale-notice')).toBeVisible();
  await expect(page.locator('#current-heading')).toHaveText('SAVED MODEL ESTIMATE');
  await page.locator('#recent-list button').click(); await expect(page.locator('#stale-notice')).toBeHidden();
  await expect(page.locator('#current-heading')).toHaveText('CURRENT MODEL ESTIMATE');
});
test('failed refresh can use only a matching city cache and labels it stale', async ({ page }) => {
  await selectCity(page); const state = serviceStates.get(page); state.weatherStatus = 503;
  await page.locator('#refresh-weather').click(); await expect(page.locator('#stale-notice')).toBeVisible(); await expect(page.locator('#weather-content')).toBeVisible();
  await expect(page.locator('#weather-error')).toBeVisible();
  await search(page,'Tokyo'); await page.getByRole('option').first().click();
  await expect(page.locator('#location-name')).toHaveText('Tokyo'); await expect(page.locator('#weather-error')).toBeVisible();
  await expect(page.locator('#weather-content')).toBeHidden(); await expect(page.locator('#stale-notice')).toBeHidden();
});
test('denied storage leaves live search functional with a storage notice', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window,'localStorage',{ get() { throw new DOMException('Denied','SecurityError'); } }));
  await page.reload(); await selectCity(page); await expect(page.locator('#storage-notice')).toBeVisible(); await expect(page.locator('#current-temperature')).toHaveText('12°C');
});
test('missing API fields remain unavailable and chart does not invent zeros', async ({ page }) => {
  const state = serviceStates.get(page); const response = weatherFixture(); response.current = { time: response.current.time }; response.daily = { time: response.daily.time }; state.weatherBody = response;
  await selectCity(page); await expect(page.locator('#current-temperature')).toHaveText('Unavailable');
  for (const id of ['metric-feels','metric-humidity','metric-wind','metric-pressure','sunrise-time']) await expect(page.locator(`#${id}`)).toHaveText('Unavailable');
  await expect(page.locator('#chart-card')).toBeHidden(); await expect(page.locator('.forecast-card')).toHaveCount(5);
});
test('provider location names render as text and cannot execute markup', async ({ page }) => {
  const state = serviceStates.get(page); const name = '<img src=x onerror="window.skycastInjected=true">'; state.geoBody = { results: [{ ...berlin, name }] };
  await selectCity(page); await expect(page.locator('#location-name')).toHaveText(name); await expect(page.locator('#location-name img')).toHaveCount(0);
  expect(await page.evaluate(() => window.skycastInjected)).toBeUndefined();
});
test('long location text and unavailable measurements fit a narrow mobile screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1000 });
  const state = serviceStates.get(page); state.geoBody = { results: [{ ...berlin, name: 'W'.repeat(160), country: 'Y'.repeat(120) }] };
  const response = weatherFixture(); response.current = {}; response.daily = { time: response.daily.time }; state.weatherBody = response;
  await selectCity(page); await noOverflow(page);
  await expect(page.locator('#current-temperature')).toHaveText('Unavailable');
});
test('a slower older geocoding response cannot replace newer suggestions', async ({ page }) => {
  const state = serviceStates.get(page); let release;
  const wait = new Promise(resolve => { release = resolve; }); state.geoDelay = query => query === 'Berlin' ? wait : Promise.resolve();
  await page.locator('#city-search').fill('Berlin'); await page.locator('#search-submit').click();
  await expect.poll(() => state.geoCalls.length).toBe(1);
  await search(page,'Tokyo'); await expect(page.getByRole('option').first()).toContainText('Tokyo'); release();
  await expect(page.getByRole('option').first()).toContainText('Tokyo');
});
test('a slower older forecast cannot overwrite the newly selected city', async ({ page }) => {
  const state = serviceStates.get(page); let release;
  const wait = new Promise(resolve => { release = resolve; }); state.weatherDelay = params => Number(params.get('latitude')) === berlin.latitude ? wait : Promise.resolve();
  await search(page); await page.getByRole('option').first().click(); await expect.poll(() => state.weatherCalls.length).toBe(1);
  await selectCity(page,'Tokyo'); release();
  await expect(page.locator('#location-name')).toHaveText('Tokyo'); await expect(page.locator('#current-temperature')).toHaveText('30°C');
});
test('loaded application assets and successful API flow have no runtime errors', async ({ page }) => {
  const errors = []; page.on('pageerror',error=>errors.push(error.message)); page.on('console',message=>{ if(message.type()==='error') errors.push(message.text()); }); page.on('response',response=>{ if(response.status()>=400) errors.push(response.url()); });
  await page.reload(); await selectCity(page); expect(errors).toEqual([]);
});
for (const width of [1440,768,390,320]) {
  test(`responsive accessible weather themes at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 }); await selectCity(page);
    await page.locator('[data-unit="fahrenheit"]').click();
    const state = serviceStates.get(page);
    const findings = [];
    for (const [theme,code,isDay] of [['clear',0,1],['cloud',3,1],['rain',61,1],['snow',73,1],['night',0,0]]) {
      state.weatherBody = weatherFixture({ code, isDay, temperature: theme === 'snow' ? -5 : 45 });
      await page.locator('#refresh-weather').click(); await expect(page.locator('body')).toHaveAttribute('data-weather',theme);
      await noOverflow(page);
      const violations = (await accessibility(page)).violations;
      if (violations.length) findings.push({ theme, violations: violations.map(rule => ({ id: rule.id, nodes: rule.nodes.map(node => ({ target: node.target, issue: node.failureSummary })) })) });
      await page.screenshot({ path: testInfo.outputPath(`${width}-${theme}.png`), fullPage: true });
    }
    expect(findings).toEqual([]);
  });
}
