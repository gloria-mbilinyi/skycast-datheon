import { defineConfig } from '@playwright/test';
const external = !!process.env.SKYCAST_BASE_URL;
const baseURL = (process.env.SKYCAST_BASE_URL || 'http://127.0.0.1:4273').replace(/\/?$/, '/');
export default defineConfig({
  testDir: './tests/browser', workers: 1, fullyParallel: false, timeout: 45000,
  expect: { timeout: 7000 }, reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'chrome' : undefined), viewport: { width: 1440, height: 1000 }, colorScheme: 'light', reducedMotion: 'reduce', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: external ? undefined : { command: 'node scripts/serve.mjs', url: baseURL, reuseExistingServer: !process.env.CI, timeout: 15000 },
});
