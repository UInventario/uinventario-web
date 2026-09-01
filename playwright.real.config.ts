import { defineConfig, devices } from '@playwright/test';

const webPort = process.env['E2E_WEB_PORT'] ?? '4310';
const baseURL = `http://127.0.0.1:${webPort}/v2/`;

export default defineConfig({
  testDir: './e2e-real',
  outputDir: './test-results-real',
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: 'line',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: `npm run start:v2:real -- --port ${webPort}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      E2E_API_URL: process.env['E2E_API_URL'] ?? '',
    },
  },
});
