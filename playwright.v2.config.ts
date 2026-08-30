import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-v2',
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:4300/v2/',
    trace: 'retain-on-failure',
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
    command: 'npm run start:v2 -- --host localhost',
    url: 'http://localhost:4300/v2/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
