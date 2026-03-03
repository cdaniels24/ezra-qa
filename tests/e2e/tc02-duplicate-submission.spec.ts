import { test, expect } from '@playwright/test';
import { SelectPlanPage }          from '../../pages/SelectPlanPage';
import { ScheduleScanPage }        from '../../pages/ScheduleScanPage';
import { ReserveAppointmentPage }  from '../../pages/ReserveAppointmentPage';
import { Plans, StripeCards }       from '../../fixtures/test-data';

/**
 * TC-02 — Duplicate charge prevented on double-click or rapid re-submit
 *
 * WHY THIS TEST WAS CHOSEN FOR AUTOMATION:
 * Duplicate charges are one of the most common and damaging payment bugs
 * in web applications — easy to trigger accidentally (slow network, nervous
 * double-click) and immediately harmful to the user ($349–$3,999 charged twice).
 * Automating this test ensures idempotency is verified on every release with
 * precise timing control that a manual tester cannot reliably reproduce.
 *
 * This test works at two layers:
 *   1. UI layer — verifies the Continue button is disabled after first click
 *   2. Network layer — counts the actual Stripe charge API calls to confirm
 *      only one payment request was sent regardless of rapid UI interaction
 *
 * ASSUMPTIONS:
 * - The Stripe charge API call includes a recognisable URL pattern (/charge, /payment_intents)
 * - After the first click, the Continue button should become disabled or show a loading state
 * - The server uses idempotency keys on the Stripe API call (best practice — this test
 *   verifies the outcome, not the implementation detail)
 *
 * TRADEOFFS:
 * - Intercepting the Stripe network call requires knowing the exact URL pattern.
 *   If Ezra changes their payment API route, this test needs updating. Mitigated
 *   by using a broad URL match (/payment_intents|/charge) rather than an exact path.
 * - Double-clicking in a browser test is timing-sensitive. We use Promise.all with
 *   two rapid clicks rather than page.dblclick() for more realistic simulation.
 *
 * FUTURE IMPROVEMENTS:
 * - Add a server-side assertion by calling the Stripe test API to verify only
 *   one PaymentIntent was created for this member in this session
 * - Test the same scenario over a simulated slow network using page.route() to
 *   add artificial latency to the Stripe response
 */

test.describe('TC-02 — Duplicate charge prevention', () => {

  /**
   * Helper: navigate to the payment page with a plan already selected.
   * Extracted to avoid repeating 3-step navigation in every test below.
   */
  async function navigateToPaymentPage(page: any) {
    const selectPlan   = new SelectPlanPage(page);
    const scheduleScan = new ScheduleScanPage(page);

    await selectPlan.goto();
    await selectPlan.completeStep1({
      dob:      '02-02-1978',
      sex:      'Female',
      planName: Plans.MRI_SCAN.name,
    });

    await page.waitForURL(/schedule-scan/);
    await scheduleScan.completeStep2('Upper East Side');
    await page.waitForURL(/reserve-appointment/);
  }


  test('Continue button becomes disabled immediately after first click', async ({ page }) => {
    /**
     * WHAT THIS TESTS:
     * After the user clicks Continue to submit payment, the button should
     * immediately enter a disabled/loading state so a second click has no effect.
     * This is the UI-layer defence against accidental duplicate submission.
     */
    await navigateToPaymentPage(page);

    const reserve = new ReserveAppointmentPage(page);
    await reserve.enterCardDetails(StripeCards.VALID_VISA);

    // Click once and immediately check button state
    await reserve.continueBtn.click();

    // The button should be disabled or show a loading state within 500ms
    await expect(reserve.continueBtn).toBeDisabled({ timeout: 500 });
  });


  test('only one Stripe charge request is sent on rapid double-click', async ({ page }) => {
    /**
     * WHAT THIS TESTS:
     * Even if the button is NOT disabled fast enough, the network layer
     * should only send one charge request. We intercept all outbound
     * requests to Stripe's charge endpoints and count them.
     *
     * A count of 1 = PASS. A count of 2+ = FAIL (duplicate charge).
     */
    await navigateToPaymentPage(page);

    const reserve = new ReserveAppointmentPage(page);
    await reserve.enterCardDetails(StripeCards.VALID_VISA);

    // Track every request to the payment endpoint
    const chargeRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      // Match Stripe's PaymentIntent or legacy charge endpoint patterns
      if (url.includes('payment_intents') || url.includes('/charge')) {
        chargeRequests.push(url);
      }
    });

    // Simulate a rapid double-click by clicking twice with minimal delay
    await reserve.continueBtn.click();
    await reserve.continueBtn.click({ force: true }); // force bypasses disabled check

    // Allow time for any queued requests to fire
    await page.waitForTimeout(2000);

    // Assert: only ONE charge request should have been sent
    expect(chargeRequests.length).toBe(1);
    console.log(`ℹ️  Charge requests intercepted: ${chargeRequests.length}`);
  });


  test('no duplicate booking record is created on rapid re-submit', async ({ page }) => {
    /**
     * WHAT THIS TESTS:
     * Verifies the end state — after rapid submission, the user lands on
     * a single confirmation page (not two), and no error state is shown
     * that would suggest a double-charge or conflicting booking was created.
     *
     * ASSUMPTION: A duplicate booking would show an error page or a
     * "booking conflict" message. A single successful booking shows /scan-confirm.
     */
    await navigateToPaymentPage(page);

    const reserve = new ReserveAppointmentPage(page);
    await reserve.enterCardDetails(StripeCards.VALID_VISA);

    // Rapid clicks
    await Promise.all([
      reserve.continueBtn.click(),
      reserve.continueBtn.click({ force: true }),
    ]);

    // Should land on confirmation — not an error or duplicate state
    await expect(page).toHaveURL(/scan-confirm/, { timeout: 30_000 });

    // Should not show any error message
    const errorVisible = await page.getByRole('alert').isVisible();
    expect(errorVisible).toBe(false);
  });

});
