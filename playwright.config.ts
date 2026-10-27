import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node server/index.mjs',
      url: 'http://127.0.0.1:8787/api/health',
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npm run dev:web -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
})
