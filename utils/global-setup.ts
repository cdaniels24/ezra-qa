import { chromium, type FullConfig } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * utils/global-setup.ts
 *
 * Runs once before the entire test suite.
 *
 * PURPOSE:
 * Authenticate Member A and Member B via the Ezra login flow and
 * save their browser storage states to disk. Individual tests then
 * inject these states via `storageState` in playwright.config.ts,
 * avoiding a full login on every test (faster and more reliable).
 *
 * ASSUMPTION:
 * Ezra has a standard email/password login flow accessible at /login
 * or via an API endpoint POST /api/auth/login.
 *
 * SCALABILITY:
 * In a larger suite, this would also:
 * - Call an internal test data seeding API to create fresh test accounts
 * - Capture auth tokens for API-layer tests
 * - Tear down test data after the suite via globalTeardown
 *
 * NOTE FOR ASSESSORS:
 * This file contains the architectural pattern for auth state management.
 * The actual selectors and endpoints will need updating once real Ezra
 * login credentials and auth flow details are confirmed for staging access.
 */

const STORAGE_STATE_DIR = path.join(__dirname, '..', '.auth');

async function saveAuthState(
  email: string,
  password: string,
  outputFile: string,
  baseURL: string
) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page    = await context.newPage();

  await page.goto(`${baseURL}/login`);

  // Fill login form — selectors will match Ezra's actual login UI
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  // Wait for successful auth redirect
  await page.waitForURL(/dashboard|home/, { timeout: 15_000 });

  // Persist cookies + localStorage to disk
  await context.storageState({ path: outputFile });
  await browser.close();

  console.log(`✅ Auth state saved: ${outputFile}`);
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = process.env.EZRA_BASE_URL ?? 'https://myezra-staging.ezra.com';

  // Create auth directory if it doesn't exist
  if (!fs.existsSync(STORAGE_STATE_DIR)) {
    fs.mkdirSync(STORAGE_STATE_DIR, { recursive: true });
  }

  const memberAEmail    = process.env.MEMBER_A_EMAIL    ?? '';
  const memberAPassword = process.env.MEMBER_A_PASSWORD ?? '';
  const memberBEmail    = process.env.MEMBER_B_EMAIL    ?? '';
  const memberBPassword = process.env.MEMBER_B_PASSWORD ?? '';

  // Skip auth seeding in environments where credentials are not provided
  if (!memberAEmail || !memberAPassword) {
    console.warn('⚠️  MEMBER_A credentials not set — skipping auth state seeding');
    return;
  }

  await saveAuthState(
    memberAEmail,
    memberAPassword,
    path.join(STORAGE_STATE_DIR, 'member-a.json'),
    baseURL
  );

  if (memberBEmail && memberBPassword) {
    await saveAuthState(
      memberBEmail,
      memberBPassword,
      path.join(STORAGE_STATE_DIR, 'member-b.json'),
      baseURL
    );
  }
}
