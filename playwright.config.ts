import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

/**
 * Ezra Health QA — Playwright Configuration
 *
 * Architecture decisions:
 * - Two projects: UI (Chromium) and API (no browser needed)
 * - Retries on CI only — local runs fail fast for developer feedback
 * - baseURL driven by environment variable so the same suite runs against
 *   staging, UAT, or production without code changes
 * - Screenshots and traces captured on failure only to keep CI artifacts lean
 */
export default defineConfig({
  testDir: './tests',

  /* Global timeout per test — 30s UI, overridden per-test where needed */
  timeout: 30_000,

  /* Retry flaky tests once on CI, never locally */
  retries: process.env.CI ? 1 : 0,

  /* Parallel workers — 1 on CI to avoid shared staging state conflicts */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter: list locally, GitHub-annotating reporter on CI */
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'on-failure' }]],

  use: {
    /* Base URL — override with EZRA_BASE_URL env var */
    baseURL: process.env.EZRA_BASE_URL ?? 'https://myezra-staging.ezra.com',

    /* Capture evidence only on failure */
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',

    /* Always HTTPS — fail if downgrade occurs */
    ignoreHTTPSErrors: false,
  },

  projects: [
    /**
     * UI Project — full browser tests using Chromium
     * Covers TC-01 (happy path) and TC-02 (duplicate submission)
     */
    {
      name: 'ui-chromium',
      testMatch: '**/e2e/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        /* Auth state injected via storageState — avoids logging in on every test */
        storageState: process.env.EZRA_STORAGE_STATE ?? undefined,
      },
    },

    /**
     * API Project — Playwright APIRequestContext, no browser
     * Covers TC-03 (price tampering / server-side amount validation)
     * and INT-PRIV-01 (cross-member data access)
     */
    {
      name: 'api',
      testMatch: '**/api/**/*.spec.ts',
      use: {
        /* API tests hit the same base URL — auth via Authorization header */
        baseURL: process.env.EZRA_BASE_URL ?? 'https://myezra-staging.ezra.com',
      },
    },
  ],

  /* Global setup — seeds auth tokens before test run */
  globalSetup: './utils/global-setup.ts',
});
