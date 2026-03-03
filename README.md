# Ezra Health — QA Automation Suite

**Candidate:** Bern Jones | **Assessment:** Senior QA Engineer | **March 2026**

---

## Which Test Cases Were Automated — and Why

Three test cases from Part 1 were selected for automation. Selection was based on three criteria: **financial risk**, **security impact**, and **automation suitability** (can automation do this better than a manual tester?).

### TC-01 — Successful end-to-end booking with valid Stripe test card
**Why automated:** The happy path is the foundation of every other test in the suite. If this fails, the product cannot deliver its core function. Automating it gives the team instant regression detection on every deployment. It also serves as a living integration check across all three booking steps and the Stripe payment layer simultaneously. Manual testers cannot reliably run this check on every PR — automation can.

### TC-02 — Duplicate charge prevented on double-click / rapid re-submit
**Why automated:** Duplicate charges are one of the most common and damaging payment bugs in web applications — easy to trigger accidentally (slow network, nervous double-click) and immediately harmful ($349–$3,999 charged twice). Automation provides two advantages a manual tester cannot: (1) precise timing control to simulate a real double-click, and (2) network-layer interception to count the actual Stripe charge API calls regardless of what the UI shows.

### TC-03 + INT-PRIV-01 — Server-side price validation & Cross-member data isolation (BOLA)
**Why automated:** These are API-layer security tests. A manual tester modifying the DOM or calling an API once is a single data point. An automated suite that runs these checks on every PR is a continuous security gate. BOLA (Broken Object Level Authorization) is the #1 API vulnerability in the OWASP API Security Top 10. For a medical platform handling PHI, a BOLA failure is a HIPAA violation — it must be caught before production on every release cycle, not just on quarterly pen tests.

---

## Architecture — Page Object Model

```
ezra-qa/
├── pages/                        # Page Object classes (one per page/step)
│   ├── SelectPlanPage.ts         # Step 1 — Select your plan
│   ├── ScheduleScanPage.ts       # Step 2 — Schedule your scan
│   ├── ReserveAppointmentPage.ts # Step 3 — Payment (Stripe iframe handling)
│   └── ConfirmationPage.ts       # Confirmation screen post-payment
│
├── tests/
│   ├── e2e/                      # Full browser UI tests (Chromium)
│   │   ├── tc01-happy-path.spec.ts
│   │   └── tc02-duplicate-submission.spec.ts
│   └── api/                      # API-layer tests (no browser)
│       └── tc03-security.spec.ts # Price tampering + BOLA privacy tests
│
├── fixtures/
│   └── test-data.ts              # All test data — Stripe cards, members, routes
│
├── utils/
│   └── global-setup.ts           # Auth token seeding before test run
│
├── .github/workflows/
│   └── playwright.yml            # CI pipeline — PR gate + nightly regression
│
├── playwright.config.ts          # Two projects: ui-chromium, api
├── tsconfig.json
├── .env.example                  # Environment variable template
└── README.md
```

**Why Page Object Model?**
Every selector lives in one place. When Ezra updates the UI — a button label changes, a form field gets a new `data-testid` — only the page object file changes. The test logic is completely unaffected. Without POM, a single UI change could break dozens of tests that all contain the same hardcoded selector.

---

## Setup

### Prerequisites
- Node.js 20+
- npm 9+
- Git

### Installation

```bash
git clone https://github.com/bernjones/ezra-qa.git
cd ezra-qa
npm install
npx playwright install --with-deps
```

### Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your staging credentials:

```env
EZRA_BASE_URL=https://myezra-staging.ezra.com
MEMBER_A_EMAIL=your-member-a@example.com
MEMBER_A_PASSWORD=YourPassword
MEMBER_A_ID=member-a-uuid
MEMBER_A_TOKEN=eyJhbGci...
MEMBER_B_EMAIL=your-member-b@example.com
MEMBER_B_PASSWORD=YourPassword
MEMBER_B_ID=member-b-uuid
MEMBER_B_TOKEN=eyJhbGci...
MEMBER_B_BOOKING_ID=booking-uuid
MEMBER_B_ENCOUNTER_ID=encounter-uuid
```

> **Note:** Never commit `.env`. It is in `.gitignore`. All credentials in CI are stored as GitHub Secrets.

### Running Tests

```bash
# All tests
npm test

# UI tests only (Chromium, headless)
npm run test:ui

# API security tests only (no browser, fastest)
npm run test:api

# UI tests in headed mode (see the browser)
npm run test:headed

# Open HTML report after a run
npm run report
```

---

## CI/CD Pipeline

```
Pull Request → API smoke gate (fast, ~2 min) → blocks merge on failure
Push to main → Full regression (UI + API, ~15 min)
Nightly 2am → Full regression + Slack alert on failure
```

The pipeline is defined in `.github/workflows/playwright.yml`.

All credentials are stored as GitHub Repository Secrets — never in code.

---

## Assumptions

| Assumption | Impact if Wrong |
|---|---|
| Stripe is in test mode on staging at all times | TC-01 and TC-02 would attempt to process real charges |
| `pk_test_` Stripe key is active — test card `4111 1111 1111 1111` works | Happy path tests fail at payment step |
| Member A and Member B staging accounts exist with completed bookings | All security tests fail with 401 or missing fixture data |
| The payment API accepts a JSON body with an `amount` field | TC-03 price tampering test needs endpoint contract update |
| `encounterId` in the Medical Questionnaire URL maps to a server-side ownership check | INT-PRIV-01 assumption — if not enforced, this is a live BOLA vulnerability |
| API endpoints follow RESTful patterns (`/api/members/{id}/bookings`) | API route fixtures in `test-data.ts` need updating to match real routes |

---

## Tradeoffs

### POM adds upfront cost — pays off at scale
Page objects require more initial code than inline selectors. For a suite of 5 tests, it feels like overhead. For a suite of 100+ tests across 3 booking steps and a medical questionnaire, it is the only maintainable approach. Every Ezra UI change touches one file, not dozens.

### E2E tests are slower and flakier than isolated unit/API tests
TC-01 and TC-02 are full browser tests spanning 3 pages. They will take 30–60 seconds each and carry more flakiness risk than the API tests. This is an accepted tradeoff — the coverage value (booking + payment + Stripe integration in a single run) outweighs the speed cost. Mitigated by: single retry on CI, `waitForURL` instead of fixed waits, and separating fast API tests into the PR gate.

### API tests require knowledge of internal endpoint structure
TC-03 and INT-PRIV-01 call internal Ezra API endpoints directly. If the route structure changes, these tests need updating. Mitigated by centralizing all routes in `fixtures/test-data.ts` — one file to update, all tests stay green.

### Auth state seeding via global-setup assumes a stable login flow
If the Ezra login flow changes (new MFA step, CAPTCHA, OAuth provider switch), `global-setup.ts` breaks and all tests lose their pre-authenticated state. Mitigated by: keeping global setup isolated and independently maintainable, and adding a fallback that skips auth seeding gracefully if credentials are missing.

### BOLA tests assume 403 — not 404 — for unauthorized access
The tests assert `status === 403` for cross-member resource access. Some systems return 404 to obscure whether a resource exists at all. If Ezra returns 404, the BOLA protection may still be correct — but the test assertion needs to be updated to accept both. This is documented as a known assumption.

---

## What I Would Implement Next

### Immediate (next sprint)
- **Parameterize BOLA tests across all Tier 1 endpoints** — currently written for 3 endpoints. A data-driven approach would run the same checks against all PHI-bearing endpoints automatically
- **Stripe webhook assertion** — confirm the correct amount was actually charged by calling the Stripe test API after payment, not just asserting the confirmation page loaded
- **`data-testid` request to engineering** — many selectors currently use text/aria-label matching. Adding `data-testid` attributes to key elements in the booking and payment flow would make selectors far more stable

### Medium term
- **OWASP ZAP DAST integration** — add automated dynamic application security scanning to the nightly run, targeting all 100+ endpoints for injection, misconfiguration, and information leakage
- **Test data factory** — replace static fixture UUIDs with a pre-test seeding API call that creates fresh Member A and Member B accounts before each run, eliminating stale-data dependencies
- **Mailosaur email assertion** — verify the booking confirmation email is sent with correct content after TC-01 completes
- **Visual regression** — add Percy or Playwright visual comparison to catch unintended UI changes on the confirmation page and payment form

### Long term
- **Contract testing with Pact** — decouple API security assertions from the response structure so a JSON schema change doesn't break security tests that only care about status codes and the absence of PHI
- **Performance baseline** — add Lighthouse CI to the nightly run to catch payment page performance regressions that could increase checkout abandonment
- **Multi-browser coverage** — extend UI project to Firefox and Safari for cross-browser booking flow validation

---

## Key Design Decisions

**Two Playwright projects (ui vs api)** — UI tests run in a real Chromium browser and are slower. API tests use `request.newContext()` with no browser and are fast. Separating them means the PR gate runs only the fast API tests (~2 min) while the full regression runs both (~15 min). This keeps developer feedback loops short without sacrificing coverage.

**Auth state via `storageState`** — Logging in through the UI on every test adds 5–10 seconds per test and is a common source of flakiness. `global-setup.ts` authenticates both members once, saves their browser storage state to disk, and individual tests inject that state instantly. One login per test run instead of one login per test.

**Stripe iframe handling via `frameLocator()`** — Stripe renders card inputs in cross-origin iframes for PCI-DSS compliance. Playwright's `frameLocator()` is the correct way to interact with these. Using native `page.fill()` on card fields would bypass Stripe's security model entirely — which is both wrong and would fail in a real Stripe integration.

**No assertions in page objects** — Page objects describe *how* to interact with a page. Tests describe *what* to verify. Mixing assertions into page objects makes tests harder to read and page objects harder to reuse. Every `expect()` call lives in a `.spec.ts` file, never in a page class.

---

*For questions about this submission, contact: bernjones@example.com*
