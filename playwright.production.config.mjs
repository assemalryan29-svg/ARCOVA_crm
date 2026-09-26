import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './scripts/e2e',
  timeout: 60_000,
  retries: 2,
  reporter: [['line']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://arcova-crm.vercel.app',
    headless: true,
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } }
  ]
});
