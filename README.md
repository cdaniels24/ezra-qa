# Ezra Health — QA Assessment

**Candidate:** Clarence Daniels | **Role:** Senior QA Engineer | **Date:** March 2026

---

## Table of Contents

1. [Part 1 — Test Case Design](#part-1--test-case-design)
2. [Part 2 — HTTP Requests](#part-2--http-requests)
3. [Part 3 — Endpoint Security Strategy](#part-3--endpoint-security-strategy)
4. [Part 4 — Automation Suite](#part-4--automation-suite)

---

## Part 1 — Test Case Design

### Overview & Approach

This assessment presents a risk-based QA evaluation of the Ezra Health booking and payment flow. The 3-step flow — **Select your plan → Schedule your scan → Reserve your appointment** — involves sensitive health data collection, medical scan selection, location-based scheduling, and Stripe-powered payment.

Risk prioritization focuses on: correctness of critical paths, data privacy, payment integrity, and security boundaries.

**Approach:** Test cases are organized by functional area and assigned a priority of Critical, High, Medium, or Low based on user impact, data sensitivity, financial risk, and likelihood of failure. Security and privacy scenarios are surfaced as a dedicated section.

---

### Application Flow Summary

| Step | Page / URL | Key Inputs | Key Risks |
|---|---|---|---|
| **1. Select Plan** | `/sign-up/select-plan` | DOB, biological sex, scan type | PHI collection, age gating, plan-location mismatch |
| **2. Schedule Scan** | `/sign-up/schedule-scan` | Location, date, time, scheduling notes | Unavailable plan-location combos, double booking, free-text injection |
| **3. Reserve Appointment** | `/sign-up/reserve-appointment` | Card/Affirm/Bank, promo code, order summary | Payment failures, duplicate charges, PCI data exposure, promo misuse |

---

### Risk-Based Prioritization

| Level | Criteria | Examples |
|---|---|---|
| **Critical** | Data loss, financial errors, PHI exposure, broken core path | Payment charges wrong amount; DOB not stored; user charged without confirmed appointment |
| **High** | Significant UX breakage, security boundary violation, key validation failure | Plan selected without required fields; duplicate booking accepted; promo code applies without limit |
| **Medium** | Edge cases with moderate impact, UI inconsistencies, state management issues | Browser back skips steps; free-text field accepts script injection; plan-location mismatch messaging unclear |
| **Low** | Cosmetic issues, minor accessibility gaps, nice-to-have enhancements | Button label typos; focus order issues; tooltip text accuracy |

---

### Step 1 — Select Your Plan

> URL: `/sign-up/select-plan` | Key data collected: DOB, biological sex (PHI), scan type selection

| ID | Test Case Title | Priority | Steps / Input | Expected Result | Tag |
|---|---|---|---|---|---|
| **TC-01** | Happy path: complete plan selection with valid DOB and sex, select MRI Scan | **Critical** | Enter valid DOB (e.g. 01-15-1985), select biological sex, click MRI Scan card, click Continue | MRI Scan card highlights with selection state; Continue button activates; user advances to Step 2 | Functional |
| **TC-02** | Continue blocked when DOB is empty | **Critical** | Leave DOB blank, select biological sex, click Continue | Inline validation error displayed on DOB field; user does not advance | Validation |
| **TC-03** | Continue blocked when biological sex is not selected | **Critical** | Enter valid DOB, leave sex dropdown at default, click Continue | Validation error on sex field; user does not advance | Validation |
| **TC-04** | Continue blocked when no scan plan is selected | **Critical** | Enter valid DOB, select sex, click Continue without selecting any plan | Error message prompts user to select a scan; user does not advance | Validation |
| **TC-05** | Invalid DOB format rejected | **High** | Enter malformed DOB (e.g. 1985/01/15, 13-01-1985, abc), click Continue | Format validation error shown; progress blocked | Validation |
| **TC-06** | Future DOB rejected | **High** | Enter a DOB in the future (e.g. 01-01-2035) | Validation error: date of birth cannot be in the future | Validation |
| **TC-07** | Minor age — DOB under 18 years ago | **High** | Enter DOB resulting in age < 18 (e.g. today minus 10 years) | Age gating message displayed or appropriate restriction applied; user cannot proceed without guardian consent flow or is blocked | Security |
| **TC-08** | All four scan plans are selectable and mutually exclusive | **High** | Select MRI Scan, then select Heart CT Scan | Previous selection deselects; only one plan active at a time | Functional |
| **TC-09** | Plan pricing displayed accurately for each scan | **High** | Load page and verify displayed price for all 4 scans | MRI=$999, MRI+Spine=$1699, MRI+Skeletal/Neuro=$3999, Heart CT=$349 match expected | Functional |
| **TC-10** | DOB data not exposed in URL or browser storage | **Critical** | Complete Step 1, inspect URL, localStorage, sessionStorage, and network requests | DOB and sex not visible in URL params; only sent via secure POST body or tokenized | Privacy/Security |

---

### Step 2 — Schedule Your Scan

> URL: `/sign-up/schedule-scan` | Key features: location picker, state filter, 'find nearest', date/time selection, scheduling notes

| ID | Test Case Title | Priority | Steps / Input | Expected Result | Tag |
|---|---|---|---|---|---|
| **TC-12** | Happy path: select location, date, and time slot, continue to payment | **Critical** | Select AMRIC (recommended), pick an available date, select one time slot, click Continue | Step 2 completes; selected location, date, and time appear in Step 3 order summary | Functional |
| **TC-13** | Location marked 'Available instead — MRI Scan with Spine' cannot be selected for MRI Scan | **Critical** | With MRI Scan selected in Step 1, attempt to click a location showing 'Available instead' badge | Location either non-selectable, shows clarifying tooltip, or prompts plan change; booking cannot proceed with incompatible plan-location pair | Functional |
| **TC-14** | State filter restricts visible locations correctly | **High** | Select a specific state from dropdown; verify only locations in that state appear | Location list updates to show only in-state centers; no out-of-state locations displayed | Functional |
| **TC-15** | 'Find closest centers to me' uses geolocation appropriately | **High** | Click 'Find closest centers to me'; allow browser location; observe results | Centers reordered by proximity; 'Recommended' tag moves to nearest center; no location data stored beyond session | Functional/Privacy |
| **TC-16** | Continue blocked if no location selected | **Critical** | Skip location selection, select date/time, click Continue | Validation error prompts user to select a location; does not advance | Validation |
| **TC-17** | Continue blocked if no date/time selected | **Critical** | Select a location, do not select any date or time, click Continue | Validation message shown; progress blocked | Validation |
| **TC-18** | Scheduling notes field sanitizes script injection | **High** | Enter `<script>alert('xss')</script>` in scheduling notes | Input stored/displayed as plain text; no script execution; XSS prevented | Security |
| **TC-19** | Past dates are not selectable in calendar | **High** | Attempt to click a date in the past on the calendar picker | Past dates are greyed out and non-clickable | Validation |
| **TC-20** | Geolocation data not persisted beyond session | **High** | Use 'Find closest centers to me', complete booking; inspect cookies and localStorage | No precise geolocation coordinates stored in browser storage or transmitted beyond the location query | Privacy |

---

### Step 3 — Reserve Your Appointment (Payment)

> URL: `/sign-up/reserve-appointment` | Payment: Stripe (Card, Affirm, Bank) | Promo codes supported

| ID | Test Case Title | Priority | Steps / Input | Expected Result | Tag |
|---|---|---|---|---|---|
| **TC-21** | Happy path: complete payment with valid Stripe test card | **Critical** | Enter Stripe test card 4111 1111 1111 1111 / 11-28 / 234 / ZIP 12345, click Continue | Payment processed; booking confirmed; confirmation screen shown with appointment details | Functional |
| **TC-22** | Order summary reflects correct plan and price from Steps 1-2 | **Critical** | Complete Steps 1-2 with MRI Scan at $999, verify Step 3 sidebar | Sidebar shows: MRI Scan, correct location, selected dates, total = $999 | Functional |
| **TC-23** | Declined card shows user-friendly error and does not charge | **Critical** | Enter Stripe decline test card (4000 0000 0000 0002), click Continue | Error message 'Your card was declined' shown; no charge applied; user can retry | Functional/Payment |
| **TC-24** | Expired card rejected | **High** | Enter a card with past expiry date (e.g. 01/20) | Stripe inline validation rejects card before submission; error shown | Validation |
| **TC-25** | Invalid CVC rejected | **High** | Enter valid card number and expiry, enter 2-digit CVC (should be 3-4 digits) | Stripe validation error on CVC field; form not submitted | Validation |
| **TC-26** | Valid promo code reduces total correctly | **Critical** | Enter a known valid promo code, click Apply Code | Discount applied; total updates correctly; promo line item visible in order summary | Functional |
| **TC-27** | Invalid promo code shows error and does not reduce total | **High** | Enter random string as promo code, click Apply Code | Error message 'Invalid promo code'; total unchanged | Functional |
| **TC-28** | Promo code cannot be applied after payment is submitted | **High** | Submit payment, attempt to apply promo code via URL manipulation or API replay | Promo application rejected server-side after payment confirmation; no post-hoc discount | Security |
| **TC-29** | Affirm payment option selectable and redirects correctly | **High** | Select Affirm radio button, click Continue | Redirects to Affirm financing flow with correct amount; returns to Ezra on completion or cancellation | Functional |
| **TC-30** | Card number not stored in DOM or local storage after payment | **Critical** | Complete payment; inspect DOM, localStorage, sessionStorage, network requests | Full card number absent from all browser-accessible storage; only Stripe token present | Privacy/Security |
| **TC-31** | Duplicate submission prevented (double-click or fast re-submit) | **Critical** | Click Continue twice quickly on payment page | Only one charge processed; system idempotent; no duplicate booking created | Functional/Security |
| **TC-32** | Payment page requires prior steps to be complete (direct URL access) | **High** | Navigate directly to `/sign-up/reserve-appointment` without completing Steps 1-2 | User redirected to Step 1 or shown error; payment page not accessible without valid session state | Security |
| **TC-33** | Order total cannot be manipulated via client-side tampering | **Critical** | Use browser DevTools to modify the displayed total; submit payment | Server-side price validation rejects tampered amount; charge reflects server-calculated total | Security |

---

### Privacy & Security Scenarios

#### Protected Health Information (PHI)

> DOB and biological sex collected in Step 1 constitute PHI under HIPAA. These must be handled with care throughout the flow.

| ID | Test Case Title | Priority | Steps / Input | Expected Result | Tag |
|---|---|---|---|---|---|
| **SEC-01** | PHI fields not exposed in URL parameters at any step | **Critical** | Complete all 3 steps; monitor browser URL bar and network tab for DOB, sex in query strings | No PHI visible in any URL; data transmitted only in POST body over HTTPS | Privacy |
| **SEC-02** | PHI not logged in browser console or client-side analytics | **Critical** | Open DevTools console during all 3 steps; check for PHI in console output or network calls to analytics | No DOB, sex, or medical scan type passed to third-party analytics as raw values | Privacy |
| **SEC-03** | Session does not expose another user's booking data | **Critical** | Log in as User A, complete partial booking; log in as User B in same browser (different tab); verify no data leakage | User B sees no data from User A's session; session tokens properly scoped | Privacy/Security |
| **SEC-04** | HTTPS enforced for all pages in booking flow | **High** | Attempt to load any booking URL over HTTP | All HTTP requests redirect to HTTPS; no sensitive data transmissible over plain HTTP | Security |

#### Payment Security (PCI-DSS)

> Card data is handled by Stripe (PCI-DSS Level 1 provider). The application must not touch raw card data.

| ID | Test Case Title | Priority | Steps / Input | Expected Result | Tag |
|---|---|---|---|---|---|
| **SEC-06** | Card fields rendered in Stripe iframes, not native inputs | **Critical** | Inspect DOM on payment page; verify card number, expiry, CVC input fields | Payment inputs are embedded Stripe iframe elements (stripe.com origin); Ezra's JS cannot read card values | Security |
| **SEC-07** | No card data in Stripe payment intent request from Ezra's backend | **Critical** | Monitor network requests during payment; inspect Ezra API calls (not Stripe.js calls) | Ezra's API receives only a Stripe paymentMethod token or paymentIntent ID; no raw card numbers | Security |
| **SEC-08** | Payment amount validated server-side, not client-side only | **Critical** | Using DevTools, intercept and modify payment amount in request before submission | Server rejects tampered amount; correct amount charged based on server-side plan pricing | Security |
| **SEC-09** | Promo code rate-limited to prevent brute-force enumeration | **High** | Rapidly submit 20+ different promo codes via API calls | Rate limiting or CAPTCHA triggered after threshold; 429 response returned | Security |
| **SEC-10** | Refund/cancellation does not allow re-use of charged promo code | **High** | Complete booking with promo code, request cancellation, attempt re-booking with same code | Server-side validation prevents reuse if business rules prohibit it; no double discount applied | Security |

#### Input Security & Injection

| ID | Test Case Title | Priority | Steps / Input | Expected Result | Tag |
|---|---|---|---|---|---|
| **SEC-11** | Scheduling notes field resistant to stored XSS | **High** | Submit `<img src=x onerror=alert(1)>` in scheduling notes; view booking in admin/confirmation | HTML tags stripped or encoded; no script execution in any rendering context | Security |
| **SEC-12** | Scheduling notes field resistant to SQL injection | **High** | Submit `' OR '1'='1` and other common SQL payloads in notes field | Input handled safely; no database errors returned; booking proceeds normally or input blocked | Security |

---

### Observed Issues During Exploration

| ID | Issue | Severity | Description & Recommendation | Area |
|---|---|---|---|---|
| **OBS-01** | LaunchDarkly SDK connection failures | **Medium** | Multiple console errors: 'Attempted to stop listening to hub, but was not connected' and failed stream connections to `clientstream.launchdarkly.com`. In production, LaunchDarkly controls feature flags — failures may silently disable features or cause inconsistent behavior. Recommend investigating SDK initialization order and adding fallback flag values. | Config |
| **OBS-02** | GSI_LOGGER FedCM AbortError | **Medium** | Console shows '[GSI_LOGGER]: FedCM get() rejects with AbortError: signal is aborted without reason'. This relates to Google Sign-In federated identity. If sign-in via Google is an available auth method, this error may cause silent auth failures for some users. Recommend investigating browser compatibility and FedCM fallback handling. | Auth |
| **OBS-03** | Test/QA center data visible in staging | **Low** | Locations include 'QA Automation Center' and test addresses. These should be confirmed as staging-only and must not appear in production location lists. | Data |
| **OBS-04** | 13+ console issues on plan selection page | **Low** | DevTools shows 13 issues flagged on the select-plan page. Each should be reviewed — errors and warnings in a medical booking flow warrant investigation to rule out functional impact. | General |

---

### Part 1 Summary

| Category | Count | Notes |
|---|---|---|
| **Total Test Cases** | **33** (TC-01 to TC-33) | Critical and High across all 3 steps |
| **Security/Privacy Scenarios** | **11** (SEC-01 to SEC-12) | PHI, PCI-DSS, injection, session isolation |
| **Observed Issues** | **4** (OBS-01 to OBS-04) | Staging environment, not blocking |
| **Critical Priority** | **15** | Must pass before any release |
| **High Priority** | **18** | Core regression suite |

---

## Part 2 — HTTP Requests

### Setup & Assumptions

Since Ezra's internal API contract is not publicly documented, endpoint paths follow RESTful conventions consistent with what is observable from the application's network traffic. All requests are written against the staging environment.

| Variable | Value |
|---|---|
| **Staging Base URL** | `https://myezra-staging.ezra.com` |
| **API Base URL** | `https://api-staging.ezra.com` (inferred from network traffic) |
| **Auth Token** | `Bearer {{AUTH_TOKEN}}` — obtained by logging in via `POST /api/auth/login` |
| **Stripe Test Card** | `4111 1111 1111 1111` / Exp: 11/28 / CVC: 234 |
| **Stripe Decline Card** | `4000 0000 0000 0002` |
| **Content-Type** | `application/json` for all POST/PUT requests |

---

### Authentication Request

All requests below require a valid Bearer token. Obtain it with:

```http
POST /api/auth/login HTTP/1.1
Host: api-staging.ezra.com
Content-Type: application/json

{
  "email": "member@example.com",
  "password": "{{PASSWORD}}"
}
```

**Response:** `{ "token": "eyJ...", "memberId": "...", "expiresIn": 3600 }`

Include token in all subsequent requests: `Authorization: Bearer {{token}}`

---

### #1 — TC-01: Successful end-to-end booking with valid Stripe test card

> The Stripe `paymentMethodId` is obtained from Stripe.js on the client — Ezra's server never receives raw card data.

```http
POST /api/bookings/confirm HTTP/1.1
Host: api-staging.ezra.com
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json

{
  "scanType": "mri_scan",
  "locationId": "amric_new_york",
  "appointmentSlots": ["2026-03-05T20:01:00Z"],
  "paymentMethodId": "pm_card_visa",
  "amount": 99900,
  "currency": "usd"
}
```

| | |
|---|---|
| **Expected Status** | `200 OK` |
| **Response Body** | `{ "bookingId": "...", "status": "confirmed", "appointmentDate": "2026-03-05T20:01:00Z" }` |
| **Verify** | Booking confirmation screen displayed; scan type, location, and date present in response |

---

### #2 — TC-02: Duplicate charge prevented on double-click or rapid re-submit

> Send two identical POST requests rapidly using the same idempotency key. The server must process only one charge.

**Request 1 — First Submission:**
```http
POST /api/bookings/confirm HTTP/1.1
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json
Idempotency-Key: test-idem-key-tc02-001

{
  "scanType": "mri_scan",
  "paymentMethodId": "pm_card_visa",
  "amount": 99900
}
```

**Request 2 — Immediate Duplicate (same idempotency key):**
```http
POST /api/bookings/confirm HTTP/1.1
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json
Idempotency-Key: test-idem-key-tc02-001

{
  "scanType": "mri_scan",
  "paymentMethodId": "pm_card_visa",
  "amount": 99900
}
```

| | |
|---|---|
| **Request 1 Status** | `200 OK` — booking created and payment processed once |
| **Request 2 Status** | `200 OK` — returns same `bookingId` as Request 1; no second charge |
| **Verify** | Stripe dashboard shows exactly one charge of $999; database contains one booking record |

---

### #3 — TC-03: Order total cannot be manipulated via client-side tampering

> ⚠️ Security test. The `amount` field is tampered to $1 (100 cents) instead of $999 (99900 cents). The server must reject this.

```http
POST /api/bookings/confirm HTTP/1.1
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json

{
  "scanType": "mri_scan",
  "locationId": "amric_new_york",
  "paymentMethodId": "pm_card_visa",
  "amount": 100
}
```

| | |
|---|---|
| **Expected Status** | `400 Bad Request` or `402 Payment Required` |
| **Response Body** | `{ "error": "Invalid payment amount", "expectedAmount": 99900 }` |
| **Verify** | No charge processed; Stripe shows $0 charged; server uses its own price calculation |

---

### #4 — TC-04: PHI and card data not exposed after payment

```http
GET /api/bookings/{{BOOKING_ID}} HTTP/1.1
Authorization: Bearer {{AUTH_TOKEN}}
```

| | |
|---|---|
| **Expected Status** | `200 OK` |
| **Must NOT contain** | `cardNumber`, `cvv`, `cvc`, `rawCard` — none of these fields present |
| **Must NOT contain** | `dateOfBirth` or `biologicalSex` as plaintext in response payload |
| **Verify** | Only Stripe `paymentMethodId` token present; all PHI fields absent from client-accessible response |

---

### #5 — TC-05: Declined card shows error and does not charge user

> Stripe's test card `4000 0000 0000 0002` always declines. The `paymentMethodId` for this in test mode is `pm_card_chargeDeclined`.

```http
POST /api/bookings/confirm HTTP/1.1
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json

{
  "scanType": "mri_scan",
  "locationId": "amric_new_york",
  "paymentMethodId": "pm_card_chargeDeclined",
  "amount": 99900
}
```

| | |
|---|---|
| **Expected Status** | `402 Payment Required` |
| **Response Body** | `{ "error": "card_declined", "message": "Your card was declined." }` |
| **Verify** | No booking record created; Stripe shows no successful charge; user can retry with new card |

---

### #6 — TC-06: PHI fields not transmitted in URL parameters

> Step 1 collects DOB and biological sex. These must be sent in the POST body over HTTPS — never as URL query parameters.

```http
POST /api/bookings/initiate HTTP/1.1
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json

{
  "dateOfBirth": "1978-02-02",
  "biologicalSex": "female",
  "scanType": "mri_scan"
}
```

| | |
|---|---|
| **Expected Status** | `200 OK` |
| **URL Inspection** | No `dateOfBirth` or `biologicalSex` visible in any URL at any point in the flow |
| **Network Tab** | PHI transmitted only in POST request body; not in GET params, headers, or redirects |
| **Verify** | Response returns `bookingSessionId`; no PHI echoed back in response |

---

### #7 — TC-07: Incompatible plan-location combination blocked

> ⚠️ MRI Scan is not available at locations showing 'Available instead — MRI Scan with Spine'. The API must reject this combination server-side.

```http
POST /api/bookings/schedule HTTP/1.1
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json

{
  "bookingSessionId": "{{SESSION_ID}}",
  "scanType": "mri_scan",
  "locationId": "park_ave_ny",
  "appointmentSlots": ["2026-03-05T20:01:00Z"]
}
```

| | |
|---|---|
| **Expected Status** | `422 Unprocessable Entity` |
| **Response Body** | `{ "error": "plan_location_incompatible", "message": "MRI Scan is not available at this location. Available plan: MRI Scan with Spine." }` |
| **Verify** | No booking slot reserved; user presented with correct plan alternative |

---

### #8 — TC-08: Card fields rendered inside Stripe iframes, not native inputs

```http
GET /sign-up/reserve-appointment HTTP/1.1
Host: myezra-staging.ezra.com
Authorization: Bearer {{AUTH_TOKEN}}
Cookie: session={{SESSION_COOKIE}}
```

| | |
|---|---|
| **Expected Status** | `200 OK` |
| **DOM Inspection** | Card input fields are `<iframe>` elements with `src` pointing to `js.stripe.com` — not native `<input>` elements |
| **Verify** | No card number, expiry, or CVC input accessible to Ezra's JavaScript; all card capture handled by Stripe's iframe origin |

---

### #9 — TC-09: Booking flow blocked when required fields are missing

> Three sub-requests test each missing required field independently.

**Request A — Missing DOB:**
```http
POST /api/bookings/initiate HTTP/1.1
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json

{ "biologicalSex": "female", "scanType": "mri_scan" }
```

**Request B — Missing Biological Sex:**
```http
POST /api/bookings/initiate HTTP/1.1
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json

{ "dateOfBirth": "1978-02-02", "scanType": "mri_scan" }
```

**Request C — Missing Scan Type:**
```http
POST /api/bookings/initiate HTTP/1.1
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json

{ "dateOfBirth": "1978-02-02", "biologicalSex": "female" }
```

| | |
|---|---|
| **All Three Status** | `400 Bad Request` |
| **Response A** | `{ "error": "validation_error", "field": "dateOfBirth", "message": "Date of birth is required." }` |
| **Response B** | `{ "error": "validation_error", "field": "biologicalSex", "message": "Biological sex is required." }` |
| **Response C** | `{ "error": "validation_error", "field": "scanType", "message": "A scan type must be selected." }` |

---

### #10 — TC-10: Valid promo code applies correct discount

```http
POST /api/bookings/apply-promo HTTP/1.1
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json

{
  "bookingSessionId": "{{SESSION_ID}}",
  "promoCode": "EZRA100",
  "scanType": "mri_scan",
  "originalAmount": 99900
}
```

| | |
|---|---|
| **Expected Status** | `200 OK` |
| **Response Body** | `{ "discountAmount": 10000, "newTotal": 89900, "promoCode": "EZRA100", "valid": true }` |
| **Verify** | Discount reflected in UI order summary; final charge at payment step matches `newTotal` |

---

### #11 — TC-11: Affirm modal displays accurate financing calculations

```http
GET /api/financing/affirm/estimate?amount=99900&currency=usd HTTP/1.1
Authorization: Bearer {{AUTH_TOKEN}}
```

| Plan | Expected Response |
|---|---|
| **6-month** | `{ "term": 6, "monthlyPayment": 16650, "apr": 0.00, "totalPayment": 99900 }` |
| **12-month** | `{ "term": 12, "monthlyPayment": 9017, "apr": 14.99, "totalPayment": 108204 }` |
| **18-month** | `{ "term": 18, "monthlyPayment": 6232, "apr": 14.99, "totalPayment": 112176 }` |
| **Verify** | Monthly amounts and totals match figures shown in Affirm modal on UI |

---

### #12 — TC-12: Booking cannot skip directly to payment page

> ⚠️ Attempt to access the payment page directly without a valid completed booking session.

```http
GET /sign-up/reserve-appointment HTTP/1.1
Host: myezra-staging.ezra.com
Authorization: Bearer {{AUTH_TOKEN}}
```

| | |
|---|---|
| **Expected Status** | `302 Found` — redirect to `/sign-up/select-plan` |
| **Alternative** | `403 Forbidden` with `{ "error": "incomplete_booking_session" }` |
| **Verify** | Payment page does not load without a valid prior session state |

---

### #13 — TC-13: Past dates rejected by server

```http
POST /api/bookings/schedule HTTP/1.1
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json

{
  "bookingSessionId": "{{SESSION_ID}}",
  "scanType": "mri_scan",
  "locationId": "amric_new_york",
  "appointmentSlots": ["2024-01-15T10:00:00Z"]
}
```

| | |
|---|---|
| **Expected Status** | `400 Bad Request` |
| **Response Body** | `{ "error": "invalid_appointment_date", "message": "Appointment date must be in the future." }` |
| **Verify** | No slot reserved; server-side date validation independent of UI calendar restrictions |

---

### #14 — TC-14: Expired card rejected before payment submission

> Stripe test token `pm_card_expired` represents a card with an expired date.

```http
POST /api/bookings/confirm HTTP/1.1
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json

{
  "scanType": "mri_scan",
  "locationId": "amric_new_york",
  "paymentMethodId": "pm_card_expired",
  "amount": 99900
}
```

| | |
|---|---|
| **Expected Status** | `402 Payment Required` |
| **Response Body** | `{ "error": "expired_card", "message": "Your card has expired. Please use a different payment method." }` |
| **Verify** | No charge processed; no booking created; user prompted to re-enter card details |

---

### #15 — TC-15: Scheduling notes field sanitizes XSS and injection input

> ⚠️ Security test — server must sanitize malicious input and store as plain text.

```http
POST /api/bookings/schedule HTTP/1.1
Authorization: Bearer {{AUTH_TOKEN}}
Content-Type: application/json

{
  "bookingSessionId": "{{SESSION_ID}}",
  "locationId": "amric_new_york",
  "appointmentSlots": ["2026-03-05T20:01:00Z"],
  "schedulingNotes": "<script>alert('xss')</script>' OR '1'='1"
}
```

| | |
|---|---|
| **Expected Status** | `200 OK` — booking proceeds; input is sanitized not blocked |
| **Stored Value** | Notes stored as plain text — tags not executed |
| **Verify** | No script execution in any rendering context; no SQL error returned; no 500 response |

---

### #16 — TC-16: Correct plan pricing for all four scan types

```http
GET /api/plans HTTP/1.1
Authorization: Bearer {{AUTH_TOKEN}}
```

| Plan | Expected Price |
|---|---|
| **MRI Scan** | `{ "planId": "mri_scan", "price": 99900, "currency": "usd" }` |
| **MRI Scan with Spine** | `{ "planId": "mri_scan_spine", "price": 169900 }` |
| **MRI Skeletal & Neurological** | `{ "planId": "mri_skeletal_neuro", "price": 399900 }` |
| **Heart CT Scan** | `{ "planId": "heart_ct", "price": 34900 }` |
| **Verify** | All four plans returned with correct prices matching UI display |

---

## Part 3 — Endpoint Security Strategy

### Framing the Problem

At a scale of 100+ endpoints handling PHI, payment data, and identity documents, security quality cannot be managed manually test case by test case. My approach is built around three principles:

| # | Principle | What It Means in Practice |
|---|---|---|
| 1 | **Risk-tiered coverage** | Not all 100+ endpoints are equally sensitive. PHI-bearing, payment, and identity endpoints get the deepest security scrutiny. Marketing and static content endpoints get baseline checks only. |
| 2 | **Shift security left** | Security checks are embedded into the development pipeline — not bolted on at the end. Every PR that touches an endpoint triggers automated security tests before it reaches staging. |
| 3 | **Defense in depth** | No single layer is trusted to catch everything. Automated API tests, DAST scanning, manual pen testing, and runtime monitoring all run in parallel — each catching what the others miss. |

---

### Step 1: Classify and Tier All 100+ Endpoints by Risk

| Tier | Endpoint Types | Examples at Ezra | Testing Depth |
|---|---|---|---|
| **Tier 1 — Critical** | PHI read/write, payment processing, identity verification, authentication | `POST /encounters/{id}/questionnaire`, `POST /payments/charge`, `GET /members/{id}/scan-results`, government ID upload | Full manual + automated + DAST + pen test |
| **Tier 2 — High** | Booking management, scheduling, session handling, promo codes | `POST /bookings`, `GET /appointments/{id}`, `POST /auth/token`, `POST /promo/validate` | Automated contract tests + targeted security scenarios |
| **Tier 3 — Standard** | Content, static data, non-sensitive reads | `GET /plans`, `GET /locations`, `GET /scan-types` | Automated contract tests + authentication checks only |

---

### Step 2: Build a Reusable Security Test Suite

Rather than writing one-off tests per endpoint, a parameterized security test library runs the same security checks across all endpoints in a given tier.

**Core security checks applied to every Tier 1 and Tier 2 endpoint:**

| Security Check | What It Tests | Tool |
|---|---|---|
| **Broken Object Level Authorization (BOLA)** | Can Member A access Member B's data by substituting their resource ID? | Playwright API / Postman |
| **Authentication enforcement** | Does the endpoint return 401 for requests with no token, expired token, or malformed JWT? | Playwright API / Postman |
| **Authorization scope enforcement** | Does the endpoint return 403 when a valid token from the wrong member is used? | Playwright API / Postman |
| **Sensitive data in URL / logs** | Is PHI, `encounterId`, or card data ever present in URL query parameters or response headers? | Playwright network intercept |
| **HTTPS enforcement** | Does the endpoint reject or redirect plain HTTP requests? | cURL / Postman |
| **Rate limiting** | Does the endpoint reject excessive requests that could indicate credential stuffing or enumeration? | k6 / Postman |
| **Input validation — injection resistance** | Does the endpoint handle SQL injection, XSS payloads, and oversized inputs without crashing or leaking data? | OWASP ZAP DAST / Postman |
| **Insecure Direct Object Reference (IDOR)** | Can a member access another member's resources by incrementing or guessing IDs? | Postman / custom fuzz scripts |

---

### Step 3: Integrate Into CI/CD Pipeline

| Pipeline Stage | What Runs | Gate |
|---|---|---|
| **On every PR to main** | Tier 1 + Tier 2 authorization and authentication tests via Playwright API context. Fast — targets only changed endpoints. | PR blocked from merge if any auth or BOLA test fails |
| **Nightly full regression** | Full security suite across all 100+ endpoints including DAST scan via OWASP ZAP. | Slack/PagerDuty alert on any new failure. Defect auto-created in Jira. |
| **Pre-release gate** | Manual penetration test on Tier 1 endpoints by internal QA or contracted security firm. Required before every major release. | Release blocked until pen test sign-off. |

---

### Step 4: Maintain a Living Endpoint Security Inventory

A living endpoint inventory tracks: endpoint path, tier classification, data sensitivity, last security test date, and known open risks. This gives QA, engineering, and security a shared source of truth and ensures no endpoint falls through the cracks as the product grows.

---

### Tradeoffs

| Tradeoff | Benefit | Cost |
|---|---|---|
| **Tiered coverage — deep tests on Tier 1 only** | Focuses the highest effort where the risk is greatest. Keeps test suite maintainable as the codebase grows. | Tier 3 endpoints get lighter coverage. A vulnerability in a 'standard' endpoint that unexpectedly handles sensitive data would be missed until the next tier review. |
| **Automated DAST scanning (OWASP ZAP)** | Scales across all 100+ endpoints automatically. Catches injection, misconfiguration, and information leakage issues faster than manual testing. | DAST generates false positives that require manual triage time. It also cannot test business logic flaws — it cannot detect BOLA unless it has context about which member owns which resource. |
| **CI/CD pipeline integration — PR gate** | Catches regressions before they reach staging. Forces developers to fix security issues at the lowest-cost point in the cycle. | Adds build time to every PR. If the test suite is poorly tuned, flaky tests will erode developer trust and the gate will be bypassed or removed. |
| **Parameterized reusable test library** | Write once, run against many endpoints. Dramatically reduces the test maintenance burden as endpoints are added or changed. | Requires upfront investment to build well. A poorly designed library is harder to maintain than individual test cases. |
| **Manual penetration testing on Tier 1** | Catches complex multi-step attack chains that automated tools cannot reason about — e.g. chained BOLA + session fixation. | Expensive and slow. Cannot run on every release. There is always a window between pen tests where a new vulnerability could be introduced and not caught until the next cycle. |

---

### Potential Risks

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| **1** | Endpoint tier classification becomes stale — a new endpoint handles PHI but is classified as Tier 3 | High | Make tier classification a required field in the PR template. Block merge if the endpoint field is empty. QA reviews all new endpoint PRs as a standing practice. |
| **2** | Automated tests give a false sense of security — the suite passes green but a complex BOLA chain exists that the tests do not cover | Medium | Complement automation with quarterly manual security review of all Tier 1 endpoints. Maintain a threat model document per endpoint. |
| **3** | Test data containing real PHI is used in security tests — e.g., a real member's `encounterId` is hardcoded in a test script | Medium | Enforce synthetic test data only in all test fixtures. Run a pre-commit hook that scans test files for real UUIDs or PII patterns and blocks the commit. |
| **4** | Security test suite is tightly coupled to the current API contract — a response structure change breaks all security assertions | Medium | Use contract testing (e.g. Pact) to separate functional contract validation from security assertion logic. Security tests should only assert on status codes and the absence of PHI — not on specific response shapes. |
| **5** | Rate limiting tests cause unintended load on staging | Low | Isolate rate limiting and load-based security tests to a dedicated test environment or a scheduled off-hours nightly job, separate from the PR gate suite. |

---

### Applied to Ezra Specifically

Based on exploratory testing of the staging environment:

| Observation | Security Implication | Priority Action |
|---|---|---|
| **`encounterId` exposed as raw JSON in URL query parameter across the entire Medical Questionnaire flow** | If server-side validation is missing, any member can substitute another member's `encounterId` and access or overwrite their questionnaire responses and PHI | Tier 1 BOLA test — verify `encounterId` is validated against authenticated session on every questionnaire endpoint. Add to PR gate immediately. |
| **Government ID upload endpoint failing silently in staging** | Upload endpoint is either broken or access-restricted in a way that bypasses the intended flow. Storage access controls cannot be verified until the upload works correctly. | Defect fix required before security testing of this endpoint. Once fixed, verify uploaded files require a scoped auth token to retrieve and are not accessible via public URL. |
| **Medical Questionnaire offers 'Another person' submission path** | Data submitted on behalf of another person must be scoped to the booking member's encounter only — not written to a third-party member record | Dedicated integration test verifying data routing on the 'Another person' path. Confirm no cross-member record writes occur. |
| **LaunchDarkly SDK failures observed in console on multiple pages** | Feature flag failures could silently disable security-related features. Security testing must account for feature flag state. | Document which security-relevant features are gated behind LaunchDarkly flags. Ensure security tests run with flags explicitly set — not relying on default flag state. |

---

## Part 4 — Automation Suite

### Which Test Cases Were Automated — and Why

Three test cases from Part 1 were selected for automation. Selection was based on: **financial risk**, **security impact**, and **automation suitability** — can automation do this better than a manual tester?

**TC-01 — Successful end-to-end booking with valid Stripe test card**
The happy path is the foundation of every other test in the suite. If this fails, the product cannot deliver its core function. Automating it gives the team instant regression detection on every deployment — a living integration check across all three booking steps and the Stripe payment layer simultaneously. Manual testers cannot reliably run this check on every PR.

**TC-02 — Duplicate charge prevented on double-click / rapid re-submit**
Duplicate charges are one of the most common and damaging payment bugs in web applications — easy to trigger accidentally (slow network, nervous double-click) and immediately harmful ($349–$3,999 charged twice). Automation provides two advantages a manual tester cannot: (1) precise timing control to simulate a real double-click, and (2) network-layer interception to count the actual Stripe charge API calls regardless of what the UI shows.

**TC-03 + INT-PRIV-01 — Server-side price validation & Cross-member data isolation (BOLA)**
These are API-layer security tests. A manual tester modifying the DOM or calling an API once is a single data point. An automated suite running these checks on every PR is a continuous security gate. BOLA (Broken Object Level Authorization) is the #1 API vulnerability in the OWASP API Security Top 10. For a medical platform handling PHI, a BOLA failure is a HIPAA violation — it must be caught before production on every release cycle, not just on quarterly pen tests.

---

### Architecture — Page Object Model

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

### Setup

**Prerequisites:** Node.js 20+, npm 9+, Git

```bash
git clone https://github.com/cdaniels24/ezra-qa.git
cd ezra-qa
npm install
npx playwright install --with-deps
```

**Environment Variables**

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

**Running Tests**

```bash
npm test              # All tests
npm run test:ui       # UI tests only (Chromium, headless)
npm run test:api      # API security tests only (no browser, fastest)
npm run test:headed   # UI tests in headed mode (see the browser)
npm run report        # Open HTML report after a run
```

---

### CI/CD Pipeline

```
Pull Request  →  API smoke gate (fast, ~2 min)      →  blocks merge on failure
Push to main  →  Full regression (UI + API, ~15 min)
Nightly 2am   →  Full regression + Slack alert on failure
```

The pipeline is defined in `.github/workflows/playwright.yml`. All credentials are stored as GitHub Repository Secrets — never in code.

---

### INT-PRIV-01 — Privacy Integration Test Case

**Test Case:** Member cannot access, submit, or view another member's Medical Questionnaire data

| | |
|---|---|
| **Type** | Integration Test — Authorization × API Layer × Cross-Member Data Isolation |
| **Priority** | Critical |
| **Regulatory Scope** | HIPAA Privacy Rule (45 CFR § 164.502) — PHI access restricted to the member it belongs to |
| **Entry Point** | `/sign-up/scan-confirm` → Begin Medical Questionnaire → `/medical-questionnaire` |
| **Unique Risk Factor** | `encounterId` exposed in URL; 'Another person' submission path; government ID upload storage |

**Why This Is Critical**

The URL contains `encounterId` as a raw query parameter: `extraData={"encounterId":"f80e6989-d09d-4dd5-a47f-c67bd2588e60"}`. If the server does not validate that this `encounterId` belongs to the authenticated user, Member A could substitute Member B's `encounterId` and access or submit data against Member B's medical encounter — a HIPAA Privacy Rule violation.

**Test Steps**

| # | Test Step / Action | Expected Result |
|---|---|---|
| **1** | Log in as Member A. Navigate to the Medical Questionnaire using Member B's `encounterId` substituted into the URL. | Server validates `encounterId` against the authenticated session. Member A receives `403 Forbidden` — the questionnaire does not load with Member B's encounter data. |
| **2** | Using Member A's valid auth token, make a direct `GET` API call to the questionnaire endpoint for Member B's `encounterId`. | `403 Forbidden` returned. No questionnaire fields, responses, or PHI from Member B present in the response body. |
| **3** | Using Member A's valid auth token, make a direct `POST` API call attempting to submit questionnaire answers against Member B's `encounterId`. | `403 Forbidden` returned. Member B's questionnaire data is not modified. Server-side ownership check blocks the write. |
| **4** | On Member A's own questionnaire, navigate to 'Are you filling out the questionnaire for another person?' and attempt to associate responses with Member B's account or `encounterId`. | Data submitted via the 'Another person' path is associated only with Member A's booking encounter — not written to any other member's record. |
| **5** | After Member B successfully uploads their government ID, capture the file storage URL from the network tab. Using Member A's session (or no session), attempt to access that file URL directly. | The file URL returns `403` or requires a valid, scoped auth token. The image is not publicly accessible. |
| **6** | Log in as Member B and access their own questionnaire via the correct URL with their own `encounterId`. | `200 OK` — Member B's questionnaire loads successfully, confirming the data exists and the endpoint functions correctly for the rightful owner. |
| **7** | Check server-side audit logs for all unauthorized access attempts made in steps 1–4. | Each unauthorized attempt is logged with Member A's user ID, timestamp, the requested `encounterId`, and the action attempted (GET or POST). |

**Pass / Fail Criteria**

✅ **PASS:** Member A receives `403 Forbidden` on every attempt to access Member B's questionnaire data via direct API call. No PHI from Member B appears in any response body, header, or error message. The 'Another person' path correctly scopes submitted data to the booking member. Member B can access their own questionnaire data. The `encounterId` in the URL is validated server-side. Government ID upload is stored in isolated, access-controlled storage.

❌ **FAIL:** Any of the following: (1) A `200` response returns any PHI belonging to Member B, (2) The `encounterId` in the URL is accepted without verifying it belongs to the authenticated user, (3) The 'Another person' path saves data under a real member ID not consented to the questionnaire, (4) The government ID image is accessible via a guessable or publicly accessible URL, (5) Error responses reveal whether a record exists or contain any PHI, (6) No audit log entry created for unauthorized access attempts.

---

### BUG-MQ-01 — Government ID Upload Silent Failure

| | |
|---|---|
| **Defect ID** | BUG-MQ-01 |
| **Title** | Government ID upload silently fails — 'Unable to upload the files' console error |
| **Severity** | **High** |
| **Where Observed** | `/medical-questionnaire` — 01. General Information — Government ID upload screen |
| **Steps to Reproduce** | Navigate to the government ID upload screen. Select or drag-drop a file. Observe the console error: 'Unable to upload the files' |
| **Actual Result** | File upload fails silently. Console shows error but no user-facing error message is displayed. Continue button activates despite the upload failing. |
| **Expected Result** | File uploads successfully and is confirmed with a visible success state. If upload fails, a clear error message is shown to the user and Continue is blocked until a valid file is submitted. |
| **Privacy Impact** | If the system allows the member to proceed without a valid government ID upload, the identity verification step is bypassed — a compliance and fraud risk. |
| **Recommendation** | Validate server-side that a government ID file is successfully uploaded before allowing the questionnaire to proceed. Surface a user-facing error message on upload failure. Investigate the root cause (likely a CORS, S3 policy, or auth token issue on the staging upload endpoint). |

---

### Assumptions

| Assumption | Impact if Wrong |
|---|---|
| Stripe is in test mode on staging at all times | TC-01 and TC-02 would attempt to process real charges |
| `pk_test_` Stripe key is active — test card `4111 1111 1111 1111` works | Happy path tests fail at payment step |
| Member A and Member B staging accounts exist with completed bookings | All security tests fail with 401 or missing fixture data |
| The payment API accepts a JSON body with an `amount` field | TC-03 price tampering test needs endpoint contract update |
| `encounterId` in the Medical Questionnaire URL maps to a server-side ownership check | INT-PRIV-01 assumption — if not enforced, this is a live BOLA vulnerability |
| API endpoints follow RESTful patterns | API route fixtures in `test-data.ts` need updating to match real routes |

---

### Tradeoffs

**POM adds upfront cost — pays off at scale**
Page objects require more initial code than inline selectors. For a suite of 5 tests, it feels like overhead. For a suite of 100+ tests across 3 booking steps and a medical questionnaire, it is the only maintainable approach.

**E2E tests are slower and flakier than isolated API tests**
TC-01 and TC-02 are full browser tests spanning 3 pages. They will take 30–60 seconds each and carry more flakiness risk than the API tests. Mitigated by: single retry on CI, `waitForURL` instead of fixed waits, and separating fast API tests into the PR gate.

**API tests require knowledge of internal endpoint structure**
TC-03 and INT-PRIV-01 call internal Ezra API endpoints directly. If the route structure changes, these tests need updating. Mitigated by centralizing all routes in `fixtures/test-data.ts` — one file to update, all tests stay green.

**Auth state seeding via global-setup assumes a stable login flow**
If the Ezra login flow changes (new MFA step, CAPTCHA, OAuth provider switch), `global-setup.ts` breaks and all tests lose their pre-authenticated state. Mitigated by keeping global setup isolated and independently maintainable.

**BOLA tests assume 403 — not 404 — for unauthorized access**
Some systems return 404 to obscure whether a resource exists at all. If Ezra returns 404, the BOLA protection may still be correct — but the test assertion needs to be updated to accept both.

---

### Key Design Decisions

**Two Playwright projects (ui vs api)** — UI tests run in a real Chromium browser and are slower. API tests use `request.newContext()` with no browser and are fast. Separating them means the PR gate runs only the fast API tests (~2 min) while the full regression runs both (~15 min). This keeps developer feedback loops short without sacrificing coverage.

**Auth state via `storageState`** — Logging in through the UI on every test adds 5–10 seconds per test and is a common source of flakiness. `global-setup.ts` authenticates both members once, saves their browser storage state to disk, and individual tests inject that state instantly. One login per test run instead of one login per test.

**Stripe iframe handling via `frameLocator()`** — Stripe renders card inputs in cross-origin iframes for PCI-DSS compliance. Playwright's `frameLocator()` is the correct way to interact with these. Using native `page.fill()` on card fields would bypass Stripe's security model entirely — which is both wrong and would fail in a real Stripe integration.

**No assertions in page objects** — Page objects describe *how* to interact with a page. Tests describe *what* to verify. Mixing assertions into page objects makes tests harder to read and page objects harder to reuse. Every `expect()` call lives in a `.spec.ts` file, never in a page class.

---

### What I Would Implement Next

**Immediate (next sprint)**
- Parameterize BOLA tests across all Tier 1 endpoints — currently written for 3 endpoints. A data-driven approach would run the same checks against all PHI-bearing endpoints automatically
- Stripe webhook assertion — confirm the correct amount was actually charged by calling the Stripe test API after payment, not just asserting the confirmation page loaded
- `data-testid` request to engineering — adding `data-testid` attributes to key elements in the booking and payment flow would make selectors far more stable

**Medium term**
- OWASP ZAP DAST integration — add automated dynamic application security scanning to the nightly run, targeting all 100+ endpoints
- Test data factory — replace static fixture UUIDs with a pre-test seeding API call that creates fresh Member A and Member B accounts before each run
- Visual regression — add Percy or Playwright visual comparison to catch unintended UI changes on the confirmation page and payment form

**Long term**
- Contract testing with Pact — decouple API security assertions from the response structure so a JSON schema change doesn't break security tests that only care about status codes and the absence of PHI
- Performance baseline — add Lighthouse CI to the nightly run to catch payment page performance regressions
- Multi-browser coverage — extend UI project to Firefox and Safari for cross-browser booking flow validation

---

*Clarence Daniels | Senior QA Engineer Assessment | March 2026*
