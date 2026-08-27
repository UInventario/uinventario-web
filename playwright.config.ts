import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:4200',
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
  webServer: [
    {
      command: 'node dist/main.js',
      cwd: resolve(__dirname, '../uinventario-api'),
      url: 'http://127.0.0.1:3000/health/ready',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npx ng serve --host localhost --port 4200',
      cwd: __dirname,
      url: 'http://localhost:4200/registro',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
