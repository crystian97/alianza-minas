import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', timeout: 45_000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', browserName: 'chromium', channel: 'chrome', headless: true },
  webServer: { command: 'pnpm dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 90_000 },
});
