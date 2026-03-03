import { type Page, type Locator, type FrameLocator } from '@playwright/test';

/**
 * pages/ReserveAppointmentPage.ts — Page Object for Step 3: Reserve your appointment
 *
 * DESIGN DECISIONS — STRIPE IFRAME HANDLING:
 * Stripe renders card inputs inside iframes from stripe.com origin.
 * Playwright can interact with cross-origin iframes via frameLocator().
 * This is the correct approach — never use native inputs for card data.
 *
 * The frame selectors below target Stripe's standard iframe structure.
 * These selectors may need updating if Stripe changes their iframe
 * architecture (e.g. moving from classic to Payment Element).
 *
 * ASSUMPTION:
 * - Staging Stripe is in test mode at all times.
 * - The Stripe publishable key on staging is a test key (pk_test_...).
 * - Real card data is never used in any test environment.
 *
 * SCALABILITY:
 * - If Ezra migrates to Stripe Payment Element, the frame locators
 *   change but the page object API stays the same. Tests are unaffected.
 */
export class ReserveAppointmentPage {
  readonly page: Page;

  // ── Standard page locators ───────────────────────────────────────────────
  readonly continueBtn:      Locator;
  readonly promoInput:       Locator;
  readonly applyPromoBtn:    Locator;
  readonly orderTotal:       Locator;
  readonly errorMessage:     Locator;

  // ── Stripe iframe frame locators ─────────────────────────────────────────
  readonly cardFrame:        FrameLocator;
  readonly expiryFrame:      FrameLocator;
  readonly cvcFrame:         FrameLocator;

  constructor(page: Page) {
    this.page = page;

    this.continueBtn   = page.getByRole('button', { name: /continue|pay|reserve/i });
    this.promoInput    = page.getByPlaceholder(/promo|coupon/i);
    this.applyPromoBtn = page.getByRole('button', { name: /apply/i });
    this.orderTotal    = page.getByTestId('order-total');
    this.errorMessage  = page.getByRole('alert');

    /*
     * Stripe Classic Elements frame structure.
     * Each field (card number, expiry, CVC) renders in its own iframe.
     *
     * ASSUMPTION: Stripe Element iframes are identifiable by their
     * name attributes (card-number, card-expiry, card-cvc).
     * Update selectors if Stripe Payment Element is adopted.
     */
    this.cardFrame   = page.frameLocator('iframe[name*="card-number"]');
    this.expiryFrame = page.frameLocator('iframe[name*="card-expiry"]');
    this.cvcFrame    = page.frameLocator('iframe[name*="card-cvc"]');
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /**
   * Fill in the Stripe card fields using iframe frame locators.
   * Each field is inside its own Stripe-served iframe.
   */
  async enterCardDetails({
    number,
    expiry,
    cvc,
    zip,
  }: {
    number: string;
    expiry: string;
    cvc: string;
    zip?: string;
  }) {
    await this.cardFrame
      .getByRole('textbox', { name: /card number/i })
      .fill(number);

    await this.expiryFrame
      .getByRole('textbox', { name: /expir/i })
      .fill(expiry);

    await this.cvcFrame
      .getByRole('textbox', { name: /cvc|security code/i })
      .fill(cvc);

    if (zip) {
      // ZIP may be in its own frame or in the main page depending on Stripe config
      const zipField = this.page.getByLabel(/zip|postal/i);
      if (await zipField.isVisible()) {
        await zipField.fill(zip);
      }
    }
  }

  /**
   * Apply a promo code. Returns the updated total text for assertion.
   */
  async applyPromoCode(code: string): Promise<string> {
    await this.promoInput.fill(code);
    await this.applyPromoBtn.click();
    await this.page.waitForResponse(resp =>
      resp.url().includes('/promo') && resp.status() === 200
    );
    return await this.orderTotal.innerText();
  }

  /**
   * Get the current order total as a number.
   * Strips currency symbols and commas for numeric comparison.
   */
  async getOrderTotalAmount(): Promise<number> {
    const text = await this.orderTotal.innerText();
    return parseFloat(text.replace(/[^0-9.]/g, ''));
  }

  /**
   * Submit payment. Returns immediately — tests should await
   * the expected outcome (confirmation URL or error message) themselves.
   */
  async submitPayment() {
    await this.continueBtn.click();
  }

  /**
   * Complete payment in one call — used by happy path test.
   */
  async completePayment(card: {
    number: string;
    expiry: string;
    cvc: string;
    zip: string;
  }) {
    await this.enterCardDetails(card);
    await this.submitPayment();
  }
}
