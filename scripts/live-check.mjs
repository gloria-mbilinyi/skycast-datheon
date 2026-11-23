import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = path.resolve(process.env.SKYCAST_EVIDENCE_DIR || path.join(root, process.argv.includes('--screenshots') ? 'assets/screenshots' : 'test-results/live'));
const baseURL = (process.env.SKYCAST_BASE_URL || 'http://127.0.0.1:4273').replace(/\/?$/, '/');
const city = process.env.SKYCAST_CITY || 'Dar es Salaam';
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'chrome' : undefined) });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(message.text()); });
  const document = await page.goto(baseURL); assert.equal(document.status(), 200);
  const geocoding = page.waitForResponse(response => response.url().startsWith('https://geocoding-api.open-meteo.com/v1/search'), { timeout: 20000 });
  await page.locator('#city-search').fill(city); await page.locator('#search-submit').click();
  const geoResponse = await geocoding; assert.equal(geoResponse.status(), 200);
  const geo = await geoResponse.json(); assert.ok(geo.results?.length > 0);
  await page.getByRole('option').first().waitFor({ timeout: 15000 });
  const forecast = page.waitForResponse(response => response.url().startsWith('https://api.open-meteo.com/v1/forecast'), { timeout: 20000 });
  await page.getByRole('option').first().click();
  const response = await forecast; assert.equal(response.status(), 200);
  const data = await response.json(); assert.ok(Number.isFinite(data.current?.temperature_2m));
  await page.locator('#weather-content').waitFor({ state: 'visible', timeout: 15000 });
  const displayedTemperature = await page.locator('#current-temperature').textContent();
  assert.equal(displayedTemperature, `${Math.round(data.current.temperature_2m)}°C`);
  assert.equal(await page.locator('.forecast-card').count(), 5); assert.equal(data.daily.time.length, 5);
  assert.equal(await page.locator('#location-timezone').textContent(), data.timezone);
  assert.equal(await page.locator('#stale-notice').isVisible(), false);
  const widths = [];
  for (const [width, filename] of [[1440,'desktop.png'],[768,'tablet.png'],[390,'mobile.png'],[320,'narrow.png']]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const geometry = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    if (geometry.scroll > geometry.width) {
      console.log(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(node => node.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && node.getBoundingClientRect().width > 0).slice(0,15).map(node => ({ tag:node.tagName,id:node.id,class:node.className?.baseVal ?? node.className,right:node.getBoundingClientRect().right,text:node.textContent.slice(0,70) })))));
      await page.screenshot({ path: path.join(destination, `overflow-${width}.png`), fullPage: true });
    }
    assert.ok(geometry.scroll <= geometry.width, `Horizontal overflow at ${width}px`);
    widths.push(width); await page.screenshot({ path: path.join(destination, filename), fullPage: true });
  }
  assert.deepEqual(runtimeErrors, []);
  const evidence = { url: baseURL, checkedAt: new Date().toISOString(), browser: browser.version(), requestedCity: city, selectedCity: await page.locator('#location-name').textContent(), geocodingStatus: geoResponse.status(), forecastStatus: response.status(), timezone: data.timezone, forecastDays: data.daily.time.length, modelValidTimeUnix: data.current.time, apiTemperatureCelsius: data.current.temperature_2m, displayedTemperature, widths, runtimeErrors, mocked: false };
  await writeFile(path.join(destination, 'live-evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally { await browser.close(); }
