/**
 * fixtures/test-data.ts
 *
 * Central source of truth for all test data used across the suite.
 *
 * ASSUMPTIONS:
 * - Stripe test mode is active on staging at all times.
 * - All card numbers, encounter IDs, and member IDs below are synthetic.
 *   No real PHI or real card data ever appears in this file.
 * - Real values are injected via environment variables at runtime (see .env.example).
 *
 * SCALABILITY NOTE:
 * - In a larger suite, test data would be generated dynamically via a
 *   test data factory that calls internal seeding APIs before each test run.
 *   Static fixtures are used here for clarity and portability in this assessment.
 */

export const StripeCards = {
  /**
   * Stripe test cards — these are public Stripe test numbers.
   * They only work when Stripe is in test mode.
   * https://stripe.com/docs/testing
   */
  VALID_VISA:       { number: '4111111111111111', expiry: '11/28', cvc: '234', zip: '12345' },
  DECLINE:          { number: '4000000000000002', expiry: '11/28', cvc: '234', zip: '12345' },
  EXPIRED:          { number: '4111111111111111', expiry: '01/20', cvc: '234', zip: '12345' },
  INSUFFICIENT:     { number: '4000000000009995', expiry: '11/28', cvc: '234', zip: '12345' },
} as const;

export const Plans = {
  MRI_SCAN:         { name: 'MRI Scan',                                  price: 999  },
  MRI_WITH_SPINE:   { name: 'MRI Scan with Spine',                       price: 1699 },
  MRI_SKELETAL:     { name: 'MRI Scan with Skeletal and Neurological',   price: 3999 },
  HEART_CT:         { name: 'Heart CT Scan',                             price: 349  },
} as const;

export const MemberA = {
  /**
   * Member A — the "attacker" in cross-member privacy tests.
   * Credentials injected via env vars in CI. Hardcoded fallbacks for
   * local development against a personal staging account only.
   */
  email:      process.env.MEMBER_A_EMAIL    ?? 'member-a-test@example.com',
  password:   process.env.MEMBER_A_PASSWORD ?? 'TestPassword123!',
  memberId:   process.env.MEMBER_A_ID       ?? 'member-a-uuid-placeholder',
  authToken:  process.env.MEMBER_A_TOKEN    ?? '',
} as const;

export const MemberB = {
  /**
   * Member B — the "victim" whose data must not be accessible to Member A.
   * In a real suite, Member B's data is seeded fresh before each test run
   * via an internal test data API so there are no stale-data dependencies.
   */
  email:       process.env.MEMBER_B_EMAIL       ?? 'member-b-test@example.com',
  password:    process.env.MEMBER_B_PASSWORD    ?? 'TestPassword456!',
  memberId:    process.env.MEMBER_B_ID          ?? 'member-b-uuid-placeholder',
  bookingId:   process.env.MEMBER_B_BOOKING_ID  ?? 'booking-b-uuid-placeholder',
  encounterId: process.env.MEMBER_B_ENCOUNTER_ID ?? 'encounter-b-uuid-placeholder',
  authToken:   process.env.MEMBER_B_TOKEN       ?? '',
} as const;

export const Urls = {
  SELECT_PLAN:        '/sign-up/select-plan',
  SCHEDULE_SCAN:      '/sign-up/schedule-scan',
  RESERVE_APPOINTMENT:'/sign-up/reserve-appointment',
  SCAN_CONFIRM:       '/sign-up/scan-confirm',
  MEDICAL_QUESTIONNAIRE: '/medical-questionnaire',
  DASHBOARD:          '/dashboard',
} as const;

export const ApiRoutes = {
  BOOKINGS:       (memberId: string) => `/api/members/${memberId}/bookings`,
  BOOKING_BY_ID:  (bookingId: string) => `/api/bookings/${bookingId}`,
  ENCOUNTER:      (encounterId: string) => `/api/encounters/${encounterId}/questionnaire`,
  CHARGE:         '/api/payments/charge',
} as const;
