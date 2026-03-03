import { type Page, type Locator } from '@playwright/test';

/**
 * pages/SelectPlanPage.ts — Page Object for Step 1: Select your plan
 *
 * DESIGN DECISIONS:
 * - All selectors are centralised here. When Ezra updates the UI, only
 *   this file needs to change — not every test that touches this page.
 * - Methods return `this` where chaining makes tests more readable.
 * - No assertions live in page objects. Assertions belong in tests.
 *   Page objects describe *how* to interact; tests describe *what* to verify.
 *
 * SCALABILITY:
 * - If plan cards gain data-testid attributes in the future, swap the
 *   text-based locators below for attribute selectors. The test code
 *   is unchanged because it calls the method, not the selector.
 */
export class SelectPlanPage {
  readonly page: Page;

  // ── Locators ────────────────────────────────────────────────────────────
  readonly dobInput:    Locator;
  readonly sexDropdown: Locator;
  readonly continueBtn: Locator;
  readonly cancelBtn:   Locator;

  constructor(page: Page) {
    this.page = page;

    this.dobInput    = page.getByLabel('Date of birth');
    this.sexDropdown = page.getByLabel('What was your sex at birth?');
    this.continueBtn = page.getByRole('button', { name: 'Continue' });
    this.cancelBtn   = page.getByRole('button', { name: 'Cancel' });
  }

  // ── Navigation ───────────────────────────────────────────────────────────
  async goto() {
    await this.page.goto('/sign-up/select-plan');
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /**
   * Fill in the member's date of birth.
   * Format: MM-DD-YYYY as shown on the staging form.
   */
  async enterDob(dob: string) {
    await this.dobInput.fill(dob);
  }

  /**
   * Select biological sex from the dropdown.
   */
  async selectSex(sex: 'Male' | 'Female' | 'Other') {
    await this.sexDropdown.selectOption(sex);
  }

  /**
   * Select a plan card by its visible name.
   *
   * ASSUMPTION: Plan cards are clickable elements containing the plan name
   * as visible text. If Ezra adds radio inputs or checkboxes inside cards,
   * this selector needs to be updated to click the input, not the card text.
   */
  async selectPlan(planName: string) {
    await this.page
      .getByRole('heading', { name: planName })
      .locator('../..')          // walk up to the card container
      .click();
  }

  /**
   * Complete Step 1 in a single call — used in happy path tests.
   */
  async completeStep1({
    dob,
    sex,
    planName,
  }: {
    dob: string;
    sex: 'Male' | 'Female' | 'Other';
    planName: string;
  }) {
    await this.enterDob(dob);
    await this.selectSex(sex);
    await this.selectPlan(planName);
    await this.continueBtn.click();
  }
}
