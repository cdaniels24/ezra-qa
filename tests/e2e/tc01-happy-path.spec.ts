import { test, expect } from '@playwright/test';
import { SelectPlanPage }          from '../../pages/SelectPlanPage';
import { ScheduleScanPage }        from '../../pages/ScheduleScanPage';
import { ReserveAppointmentPage }  from '../../pages/ReserveAppointmentPage';
import { ConfirmationPage }        from '../../pages/ConfirmationPage';
import { Plans, StripeCards, Urls } from '../../fixtures/test-data';

/**
 * TC-01 — Successful end-to-end booking with valid Stripe test card
 *
 * WHY THIS TEST WAS CHOSEN FOR AUTOMATION:
 * The happy path is the single most important test in the entire suite.
 * If this test fails, every other scenario is irrelevant — the product
 * cannot fulfil its core purpose. Automating it provides:
 *   1. Instant regression detection on every deployment
 *   2. A living integration check across all three steps and the payment layer
 *   3. Confidence that Stripe test mode is active and the full booking loop works
 *
 * This test also serves as the "smoke test" for CI — if TC-01 fails,
 * the PR is blocked and the team is alerted before any further testing proceeds.
 *
 * ASSUMPTIONS:
 * - Member A is pre-authenticated (storageState injected by global setup)
 * - A real staging location exists that accepts MRI Scan bookings
 * - Stripe is in test mode (pk_test_... key active on staging)
 * - The confirmation page URL contains '/scan-confirm'
 *
 * TRADEOFFS:
 * - This test is end-to-end across 3 pages — it will be slower (~30–60s)
 *   than a unit or API test. Accepted tradeoff for the coverage value.
 * - Flakiness risk is higher than isolated tests due to reliance on
 *   calendar availability and Stripe iframe timing. Mitigated by:
 *   (a) using waitForURL instead of fixed waits
 *   (b) retrying once on CI (configured in playwright.config.ts)
 *
 * FUTURE IMPROVEMENTS:
 * - Intercept the Stripe payment POST to assert the correct amount
 *   was sent server-side (closes the loop on TC-03 as well)
 * - Assert confirmation email was triggered via Mailosaur / email testing API
 * - Assert booking record appears in the member's dashboard after confirmation
 */

test.describe('TC-01 — Happy Path: End-to-end booking and payment', () => {

  test('completes a full MRI Scan booking with a valid Stripe test card', async ({ page }) => {

    // ── Page object setup ──────────────────────────────────────────────────
    const selectPlan   = new SelectPlanPage(page);
    const scheduleScan = new ScheduleScanPage(page);
    const reserve      = new ReserveAppointmentPage(page);
    const confirmation = new ConfirmationPage(page);

    // ── Step 1: Select your plan ───────────────────────────────────────────
    await selectPlan.goto();

    // Verify the page loaded correctly before interacting
    await expect(page).toHaveURL(/select-plan/);
    await expect(page.getByRole('heading', { name: 'Select your Scan' })).toBeVisible();

    await selectPlan.completeStep1({
      dob:      '02-02-1978',
      sex:      'Female',
      planName: Plans.MRI_SCAN.name,
    });

    // ── Step 2: Schedule your scan ─────────────────────────────────────────
    await expect(page).toHaveURL(/schedule-scan/, { timeout: 10_000 });

    // Pick a non-test location — avoid QA Automation Center in staging
    await scheduleScan.completeStep2('Upper East Side');

    // ── Step 3: Reserve your appointment (payment) ─────────────────────────
    await expect(page).toHaveURL(/reserve-appointment/, { timeout: 10_000 });

    // Assert the order summary shows the correct plan and price before paying
    await expect(page.getByText(Plans.MRI_SCAN.name)).toBeVisible();
    await expect(page.getByText(`$${Plans.MRI_SCAN.price}`)).toBeVisible();

    await reserve.completePayment(StripeCards.VALID_VISA);

    // ── Confirmation ───────────────────────────────────────────────────────
    // Wait for navigation to the confirmation page — this is the success state
    await expect(page).toHaveURL(/scan-confirm/, { timeout: 30_000 });

    // Verify the confirmation page shows the correct scan and appointment details
    await expect(confirmation.heading).toBeVisible();
    await expect(confirmation.beginQuestionnaireBtn).toBeVisible();

    // Assert the booked scan type appears on the confirmation card
    await expect(page.getByText(/MRI Scan/i)).toBeVisible();

    // Assert the appointment date is present (format: "Mar XX, XXXX")
    await expect(page.getByText(/\w+ \d{1,2}, \d{4}/)).toBeVisible();
  });


  test('confirmation page displays correct scan type, location, and date', async ({ page }) => {
    /**
     * Companion test to the happy path — verifies the confirmation page
     * content specifically. Kept separate so it can run independently
     * if the main booking test is skipped in a targeted run.
     *
     * ASSUMPTION: This test reuses the auth state from global setup.
     * In a real suite, it would use a pre-created booking fixture via API
     * to avoid running the full 3-step flow again.
     */
    const selectPlan   = new SelectPlanPage(page);
    const scheduleScan = new ScheduleScanPage(page);
    const reserve      = new ReserveAppointmentPage(page);

    await selectPlan.goto();
    await selectPlan.completeStep1({
      dob:      '02-02-1978',
      sex:      'Female',
      planName: Plans.MRI_SCAN.name,
    });

    await expect(page).toHaveURL(/schedule-scan/, { timeout: 10_000 });
    await scheduleScan.completeStep2('Upper East Side');

    await expect(page).toHaveURL(/reserve-appointment/, { timeout: 10_000 });
    await reserve.completePayment(StripeCards.VALID_VISA);

    await expect(page).toHaveURL(/scan-confirm/, { timeout: 30_000 });

    // Assert all three key booking details are visible on the confirmation card
    await expect(page.getByText(/MRI Scan/i)).toBeVisible();
    await expect(page.getByText(/Upper East Side/i)).toBeVisible();
    await expect(page.getByText(/\w+ \d{1,2}, \d{4} • \d{1,2}:\d{2} (AM|PM)/)).toBeVisible();
  });

});
