import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4321',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'node scripts/preview-for-tests.mjs',
    url: 'http://127.0.0.1:4321/japan-it-ai-daily/ja/archive/',
    reuseExistingServer: false,
  },
});
