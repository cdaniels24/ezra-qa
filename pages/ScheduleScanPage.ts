import { type Page, type Locator } from '@playwright/test';

/**
 * pages/ScheduleScanPage.ts — Page Object for Step 2: Schedule your scan
 *
 * ASSUMPTIONS:
 * - Location selection renders a list of clickable location cards.
 * - The calendar renders month/day buttons accessible by aria-label.
 * - Time slots render as buttons after a date is selected.
 *
 * FUTURE IMPROVEMENTS:
 * - Add geolocation mocking support for the "find nearest" feature.
 *   Currently excluded from automation due to browser permission
 *   mocking unreliability in headless CI environments.
 */
export class ScheduleScanPage {
  readonly page: Page;

  readonly continueBtn:      Locator;
  readonly backBtn:          Locator;
  readonly schedulingNotes:  Locator;
  readonly stateFilter:      Locator;

  constructor(page: Page) {
    this.page = page;

    this.continueBtn     = page.getByRole('button', { name: 'Continue' });
    this.backBtn         = page.getByRole('button', { name: 'Back' });
    this.schedulingNotes = page.getByPlaceholder(/notes/i);
    this.stateFilter     = page.getByRole('combobox', { name: /state/i });
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /**
   * Select a location by its visible name.
   *
   * ASSUMPTION: Locations render as cards with the location name as a heading.
   * In staging, "QA Automation Center" and "Mireille Mobile/Offline centre"
   * are test-only locations and should be explicitly excluded from production tests.
   */
  async selectLocation(locationName: string) {
    await this.page
      .getByRole('heading', { name: locationName })
      .locator('../..')
      .click();
  }

  /**
   * Select the first available date on the calendar.
   * Returns the selected date label for assertion in the calling test.
   *
   * ASSUMPTION: Available dates have aria-disabled="false".
   * Past dates are assumed to be greyed out and aria-disabled="true".
   */
  async selectFirstAvailableDate(): Promise<string> {
    const availableDay = this.page
      .locator('[role="gridcell"]:not([aria-disabled="true"])')
      .first();
    const label = await availableDay.getAttribute('aria-label') ?? '';
    await availableDay.click();
    return label;
  }

  /**
   * Select the first available time slot after a date is chosen.
   */
  async selectFirstAvailableTimeSlot() {
    const slot = this.page
      .getByRole('button', { name: /am|pm/i })
      .first();
    await slot.click();
  }

  /**
   * Enter text into the scheduling notes field.
   * Used in injection resistance tests.
   */
  async enterSchedulingNotes(notes: string) {
    if (await this.schedulingNotes.isVisible()) {
      await this.schedulingNotes.fill(notes);
    }
  }

  /**
   * Complete Step 2 in a single call for use in happy path flows.
   */
  async completeStep2(locationName: string) {
    await this.selectLocation(locationName);
    await this.selectFirstAvailableDate();
    await this.selectFirstAvailableTimeSlot();
    await this.continueBtn.click();
  }
}
