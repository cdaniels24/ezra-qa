import { type Page, type Locator } from '@playwright/test';

/**
 * pages/ConfirmationPage.ts — Page Object for /sign-up/scan-confirm
 *
 * This page appears after successful payment and shows the booking summary.
 * It is the terminal success state of the entire booking flow.
 */
export class ConfirmationPage {
  readonly page: Page;

  readonly heading:           Locator;
  readonly scanType:          Locator;
  readonly location:          Locator;
  readonly appointmentDate:   Locator;
  readonly beginQuestionnaireBtn: Locator;
  readonly openInMapsLink:    Locator;
  readonly addToCalendarLink: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading               = page.getByText(/almost done/i);
    this.scanType              = page.getByTestId('scan-type');
    this.location              = page.getByTestId('appointment-location');
    this.appointmentDate       = page.getByTestId('appointment-date');
    this.beginQuestionnaireBtn = page.getByRole('button', { name: /begin medical questionnaire/i });
    this.openInMapsLink        = page.getByRole('link', { name: /open in google maps/i });
    this.addToCalendarLink     = page.getByRole('link', { name: /add to calendar/i });
  }

  /**
   * Verify the confirmation page has loaded and shows expected booking details.
   * Returns a structured summary for use in test assertions.
   */
  async getBookingSummary(): Promise<{
    scanType: string;
    location: string;
    date: string;
  }> {
    return {
      scanType: await this.scanType.innerText(),
      location: await this.location.innerText(),
      date:     await this.appointmentDate.innerText(),
    };
  }

  /**
   * Check the current URL is the confirmation page.
   */
  isOnConfirmationPage(): boolean {
    return this.page.url().includes('/scan-confirm');
  }
}
