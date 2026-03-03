import { test, expect, request } from '@playwright/test';
import { MemberA, MemberB, ApiRoutes, Plans } from '../../fixtures/test-data';

/**
 * TC-03 & INT-PRIV-01 — API Security Tests
 *
 * WHY THESE TESTS WERE CHOSEN FOR AUTOMATION:
 *
 * TC-03 (Price tampering):
 * Any application that trusts the client to determine the payment amount
 * is fundamentally insecure. A user can modify the DOM total to $1 and
 * attempt to pay that instead of $999. This test verifies that pricing
 * authority lives on the server by sending a deliberately wrong amount
 * directly to the payment API and asserting it is rejected.
 * This cannot be tested reliably at the UI layer — a manual tester
 * modifying the DOM is one step; an automated API test that sends a
 * crafted request body is the definitive check.
 *
 * INT-PRIV-01 (Cross-member data access / BOLA):
 * Broken Object Level Authorization is the #1 API security vulnerability
 * (OWASP API Security Top 10). For a medical platform handling PHI,
 * a BOLA failure is a HIPAA violation. This test uses Member A's valid
 * auth token to attempt access to Member B's resources — simulating
 * exactly what a real attacker would do after obtaining a valid session.
 * Automating this ensures BOLA protection is verified on every deployment,
 * not just on a quarterly pen test cycle.
 *
 * ASSUMPTIONS:
 * - Member A and Member B have valid auth tokens available via env vars
 *   (seeded by global-setup.ts before the test run)
 * - The API returns 403 (not 404) for unauthorized access to another
 *   member's resources — 404 could still be used for enumeration
 * - The payment API accepts a JSON body with an 'amount' field that
 *   the server should validate against its own stored price
 *
 * TRADEOFFS:
 * - API tests require knowledge of internal endpoint structure.
 *   If Ezra's API routes change, these tests need updating. Mitigated
 *   by centralizing all routes in fixtures/test-data.ts.
 * - We cannot assert the exact internal pricing logic — only that the
 *   server rejects a tampered amount. The implementation detail (how the
 *   server validates) is outside QA scope.
 *
 * FUTURE IMPROVEMENTS:
 * - Parameterize the BOLA tests to run against all Tier 1 endpoints
 *   automatically via a data-driven approach
 * - Add a Stripe webhook listener assertion to confirm the correct amount
 *   was actually charged to the payment method in test mode
 * - Integrate with OWASP ZAP DAST for automated injection testing
 *   across all 100+ endpoints on the nightly run
 */

test.describe('TC-03 — Server-side price validation (price tampering resistance)', () => {

  test('payment API rejects a tampered amount below the plan price', async () => {
    /**
     * Simulates a client-side price manipulation attack.
     * A legitimate MRI Scan costs $999. This test sends $1 to the
     * payment endpoint using Member A's valid auth token and a valid
     * booking context — exactly what a malicious user would do.
     */
    const ctx = await request.newContext({
      baseURL: process.env.EZRA_BASE_URL ?? 'https://myezra-staging.ezra.com',
      extraHTTPHeaders: {
        'Authorization': `Bearer ${MemberA.authToken}`,
        'Content-Type':  'application/json',
      },
    });

    const response = await ctx.post(ApiRoutes.CHARGE, {
      data: {
        // Tampered amount — $1 instead of the correct $999
        amount:    100,           // Stripe amounts in cents: $1.00
        currency:  'usd',
        planName:  Plans.MRI_SCAN.name,
        memberId:  MemberA.memberId,
        // A real attack would include a valid bookingId from an existing session
        bookingId: 'booking-member-a-valid-id',
      },
    });

    // Server must reject the tampered amount — not process a $1 charge
    expect(response.status()).not.toBe(200);
    expect([400, 403, 422]).toContain(response.status());

    const body = await response.json();

    // Assert no charge confirmation token is returned
    expect(body).not.toHaveProperty('chargeId');
    expect(body).not.toHaveProperty('paymentIntentId');

    // The error should mention amount or price validation — not a generic 500
    if (body.message) {
      expect(body.message).not.toMatch(/internal server error/i);
    }

    await ctx.dispose();
  });


  test('payment API rejects an amount of zero', async () => {
    const ctx = await request.newContext({
      baseURL: process.env.EZRA_BASE_URL ?? 'https://myezra-staging.ezra.com',
      extraHTTPHeaders: {
        'Authorization': `Bearer ${MemberA.authToken}`,
        'Content-Type':  'application/json',
      },
    });

    const response = await ctx.post(ApiRoutes.CHARGE, {
      data: {
        amount:   0,
        currency: 'usd',
        planName: Plans.MRI_SCAN.name,
        memberId: MemberA.memberId,
      },
    });

    expect([400, 403, 422]).toContain(response.status());
    await ctx.dispose();
  });


  test('payment API rejects a negative amount', async () => {
    const ctx = await request.newContext({
      baseURL: process.env.EZRA_BASE_URL ?? 'https://myezra-staging.ezra.com',
      extraHTTPHeaders: {
        'Authorization': `Bearer ${MemberA.authToken}`,
        'Content-Type':  'application/json',
      },
    });

    const response = await ctx.post(ApiRoutes.CHARGE, {
      data: {
        amount:   -9900, // -$99
        currency: 'usd',
        planName: Plans.MRI_SCAN.name,
        memberId: MemberA.memberId,
      },
    });

    expect([400, 403, 422]).toContain(response.status());
    await ctx.dispose();
  });

});


test.describe('INT-PRIV-01 — Cross-member data isolation (BOLA prevention)', () => {

  /**
   * Helper: create an API context authenticated as Member A.
   * Member A is the "attacker" attempting to access Member B's data.
   */
  async function memberAContext() {
    return request.newContext({
      baseURL: process.env.EZRA_BASE_URL ?? 'https://myezra-staging.ezra.com',
      extraHTTPHeaders: {
        'Authorization': `Bearer ${MemberA.authToken}`,
        'Content-Type':  'application/json',
      },
    });
  }

  test('Member A cannot read Member B\'s booking list via API', async () => {
    /**
     * BOLA Test: Member A uses their own valid token but requests
     * Member B's bookings by substituting Member B's member ID in the URL.
     * This is the textbook BOLA attack pattern.
     */
    const ctx = await memberAContext();

    const response = await ctx.get(ApiRoutes.BOOKINGS(MemberB.memberId));

    // Must return 403 Forbidden — not 200 (data leak) or 404 (resource exists confirmation)
    expect(response.status()).toBe(403);

    // Response body must not contain any PHI belonging to Member B
    const text = await response.text();
    expect(text).not.toContain(MemberB.memberId);
    expect(text).not.toContain(MemberB.email);
    expect(text).not.toContain('scanType');
    expect(text).not.toContain('appointmentDate');

    await ctx.dispose();
  });


  test('Member A cannot read Member B\'s specific booking by ID', async () => {
    const ctx = await memberAContext();

    const response = await ctx.get(ApiRoutes.BOOKING_BY_ID(MemberB.bookingId));

    expect(response.status()).toBe(403);

    const text = await response.text();
    // Assert no PHI from Member B appears in the response
    expect(text).not.toContain(MemberB.memberId);
    expect(text).not.toContain('amount');
    expect(text).not.toContain('scanType');

    await ctx.dispose();
  });


  test('Member A cannot read Member B\'s medical questionnaire via encounterId', async () => {
    /**
     * CRITICAL TEST for Ezra specifically.
     * The encounterId is exposed in the URL on the Medical Questionnaire page.
     * This test verifies the server validates encounterId ownership against
     * the authenticated session — preventing the attack vector observed
     * during exploratory testing.
     */
    const ctx = await memberAContext();

    const response = await ctx.get(ApiRoutes.ENCOUNTER(MemberB.encounterId));

    expect(response.status()).toBe(403);

    const text = await response.text();
    // Ensure no medical questionnaire PHI is returned
    expect(text).not.toContain('weight');
    expect(text).not.toContain('ethnicity');
    expect(text).not.toContain('address');
    expect(text).not.toContain('medicalHistory');

    await ctx.dispose();
  });


  test('Member A cannot write to Member B\'s questionnaire via POST', async () => {
    /**
     * Tests the write path — Member A attempts to submit questionnaire
     * answers against Member B's encounterId.
     * A successful write would mean Member B's PHI could be overwritten.
     */
    const ctx = await memberAContext();

    const response = await ctx.post(ApiRoutes.ENCOUNTER(MemberB.encounterId), {
      data: {
        section:   'general-information',
        scanFor:   'myself',
        weight:    180,
        ethnicity: 'White or Caucasian',
      },
    });

    // Must reject the write attempt entirely
    expect(response.status()).toBe(403);

    await ctx.dispose();
  });


  test('unauthenticated request to any member endpoint returns 401', async () => {
    /**
     * Baseline: no token should always return 401.
     * If this fails, the endpoint is publicly accessible — a critical vulnerability.
     */
    const ctx = await request.newContext({
      baseURL: process.env.EZRA_BASE_URL ?? 'https://myezra-staging.ezra.com',
      // No Authorization header — unauthenticated request
    });

    const responses = await Promise.all([
      ctx.get(ApiRoutes.BOOKINGS(MemberA.memberId)),
      ctx.get(ApiRoutes.BOOKING_BY_ID(MemberA.memberId)),
      ctx.get(ApiRoutes.ENCOUNTER(MemberA.memberId)),
    ]);

    for (const response of responses) {
      expect(response.status()).toBe(401);
    }

    await ctx.dispose();
  });


  test('Member B can access their own data correctly — control test', async () => {
    /**
     * Control test: confirms Member B's data EXISTS and is accessible
     * to the rightful owner. This ensures the 403s above are not caused
     * by the data being missing or the endpoint being broken for everyone.
     *
     * A QA suite that only tests rejection without confirming legitimate
     * access is incomplete — it cannot distinguish "secured correctly"
     * from "broken for everyone".
     */
    const ctx = await request.newContext({
      baseURL: process.env.EZRA_BASE_URL ?? 'https://myezra-staging.ezra.com',
      extraHTTPHeaders: {
        'Authorization': `Bearer ${MemberB.authToken}`,
        'Content-Type':  'application/json',
      },
    });

    const response = await ctx.get(ApiRoutes.BOOKINGS(MemberB.memberId));

    // Member B's own request should succeed
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body) || typeof body === 'object').toBe(true);

    await ctx.dispose();
  });

});
