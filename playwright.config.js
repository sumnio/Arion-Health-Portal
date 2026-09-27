import { defineConfig, devices } from '@playwright/test';
import {
  DEFAULT_E2E_API_URL,
  DEFAULT_E2E_BASE_URL,
  loadE2eEnvironment,
} from './server/scripts/e2eEnvironment.js';

loadE2eEnvironment();

const baseURL = process.env.E2E_BASE_URL || DEFAULT_E2E_BASE_URL;
const apiURL = process.env.E2E_API_URL || DEFAULT_E2E_API_URL;
const reuseExistingServer = process.env.E2E_REUSE_EXISTING_SERVERS === 'true';
const frontendPort = new URL(baseURL).port || '5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['line'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  globalSetup: './e2e/globalSetup.js',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run start:e2e --prefix server',
      url: `${apiURL}/api/health`,
      reuseExistingServer,
      timeout: 120_000,
      env: {
        ...process.env,
        E2E_BASE_URL: baseURL,
        E2E_API_URL: apiURL,
      },
    },
    {
      command: `npm run dev -- --port ${frontendPort} --strictPort`,
      url: baseURL,
      reuseExistingServer,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_API_BASE_URL: apiURL,
      },
    },
  ],
});
