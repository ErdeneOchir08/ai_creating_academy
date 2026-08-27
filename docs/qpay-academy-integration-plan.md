# Mind Academy — QPay Merchant V2 integration plan

Status: implemented and locally verified on 2026-08-27; production activation is intentionally pending the database migration and Vercel server-secret configuration.

This plan applies the reusable [QPay Merchant V2 integration guide](./qpay-merchant-v2-integration-guide.md) to the current academy repository.

## 1. Recommended product decision

Make **QPay Dynamic QR / deeplink the primary payment method for Version 2 course offerings**. Keep the existing bank-transfer receipt upload as a temporary fallback during rollout.

Do not add new QPay automation to the legacy direct-course checkout first. The repository already treats Version 2 offering checkout as the long-term canonical flow:

```text
course → offering → application → payment → enrollment → entitlements
```

After QPay has operated reliably on Version 2 offerings, migrate remaining commercial courses to Version 2 and then retire the legacy direct-course payment path separately.

## 2. Confirmed merchant configuration

- Legal merchant: Mind Agency LLC
- QPay product: Merchant V2 / Dynamic QR
- Current invoice code: `MINDACADEMY_INVOICE`
- Academy source identifier: `ai-creator-academy`
- Academy invoice prefix: `ACA`
- Production API: `https://merchant.qpay.mn`

The settlement bank account is controlled by QPay's configuration for the invoice/merchant profile. The application must not accept a bank account from the browser or try to route settlement itself.

Before production launch, obtain written confirmation from QPay for:

1. the exact callback method and payload for this account;
2. the production callback domain;
3. whether `MINDACADEMY_INVOICE` is tied to the intended academy settlement account;
4. sandbox credentials and a sandbox invoice code, if available;
5. whether eBarimt is enabled or will be a later phase.

## 3. Current architecture to preserve

The academy already has:

- immutable Version 2 applications with tuition and payment-deadline snapshots;
- unique payment references such as `MA-00000042`;
- optional contract acceptance before payment;
- payment-proof review history;
- capacity checks;
- atomic enrollment and primary/bonus course entitlement creation;
- notification outbox records;
- admin payment review screens;
- a manual receipt-upload fallback.

QPay must reuse these rules. It must not create a parallel enrollment system or grant a course directly from a browser callback.

## 4. Target payment model

Add a canonical `course_offering_payments` table. One row represents one payment attempt, whether it is QPay or a manual bank transfer.

Suggested fields:

```text
id                         uuid primary key
application_id             uuid → course_offering_applications
offering_id                uuid → training_cohorts
applicant_user_id          uuid → profiles
attempt_number             integer
provider                   manual_transfer | qpay
source_site                ai-creator-academy
amount_mnt                 immutable integer snapshot
currency                   MNT
status                     created | pending | paid | rejected | expired | cancelled | refunded
sender_invoice_no          unique, nullable for manual transfer
qpay_invoice_id            unique, nullable
qpay_payment_id            unique, nullable
qpay_short_url             nullable
qpay_qr_text               nullable
callback_token_hash        nullable
provider_status            nullable
provider_paid_at           nullable
expires_at                 nullable
created_at
updated_at
```

Security and constraints:

- enable RLS;
- revoke all client writes;
- allow an authenticated user to read only payments belonging to their own application;
- allow mutations only through narrowly scoped RPCs/server code;
- unique `(application_id, attempt_number)`;
- at most one active `created/pending` attempt per application;
- at most one `paid` attempt per application;
- QPay identifiers must be unique when present;
- provider-specific check constraints must prevent incomplete QPay rows.

### Existing manual-payment compatibility

Add `payment_id` to `course_offering_payment_proofs` and backfill each existing proof with a `manual_transfer` payment row. Keep proof rows as receipt-review evidence.

Add canonical `payment_id` to `course_offering_enrollments`. Backfill it from the linked proof/payment. Preserve the old `payment_proof_id` during rollout for historical compatibility, then make it optional for QPay enrollments.

Do not fabricate receipt images or fake admin users for QPay payments.

## 5. Unique invoice and source tracking

Use the application's existing immutable `payment_reference` plus a QPay attempt number:

```text
sender_invoice_no = ACA-<payment_reference>-Q<attempt>
example: ACA-MA-00000042-Q1
```

Persist these values before calling QPay:

```text
source_site = ai-creator-academy
application_id
payment_id
payment_reference
sender_invoice_no
offering_id
course_id_snapshot
amount_mnt
```

Admin reporting can then filter every payment by site, offering, course, applicant, payment reference, QPay invoice ID, QPay payment ID, status, or date.

No personal data should appear in `sender_invoice_no`.

## 6. Server-side QPay module

Create a small server-only module, for example:

```text
src/lib/qpay/config.ts
src/lib/qpay/client.ts
src/lib/qpay/schemas.ts
src/lib/qpay/token-cache.ts
```

Requirements:

- import `server-only`;
- use the default Node.js runtime;
- read credentials only from server environment variables;
- validate all QPay responses with Zod;
- redact credentials, access tokens, QR payloads, and sensitive provider responses from logs;
- use request timeouts and structured errors;
- cache access/refresh tokens until their documented expiry rather than requesting a token for every invoice;
- coordinate token reuse across Vercel instances using a server-only database cache and a same-instance request lock;
- never import the module into a Client Component.

Environment variables:

```dotenv
QPAY_BASE_URL=https://merchant.qpay.mn
QPAY_CLIENT_ID=
QPAY_CLIENT_SECRET=
QPAY_INVOICE_CODE=MINDACADEMY_INVOICE
QPAY_SOURCE_SITE=ai-creator-academy
QPAY_ENABLED=false
```

Actual values belong in Vercel encrypted environment variables, never `.env.example` or Git. Only the variable names and safe defaults belong in `.env.example`.

## 7. Application endpoints

### Create invoice

Use an authenticated Server Action initiated from the Version 2 payment panel.

Responsibilities:

1. authenticate the applicant;
2. load the application and lock/check its current state;
3. verify ownership, offering lifecycle, payment deadline, contract acceptance, capacity prerequisites, and absence of a paid payment;
4. calculate the amount from the immutable database snapshot—not from the browser;
5. reuse an existing valid unpaid invoice or create a new payment attempt;
6. generate a random callback token and store only its hash;
7. create the QPay invoice with exact amount, partial payment disabled, exceeding payment disabled, and an expiry within the application's payment deadline;
8. save QPay invoice identifiers before returning safe QR/deeplink data.

The callback URL should identify the internal attempt with an opaque ID and random token, for example:

```text
https://academy-domain.example/api/payments/qpay/callback?attempt=<uuid>&token=<random>
```

The callback token locates and protects the internal attempt; it is not payment proof.

### QPay callback

Create a public Route Handler:

```text
src/app/api/payments/qpay/callback/route.ts
```

Support only the callback HTTP method and fields confirmed by QPay. The handler must:

1. validate the attempt ID and constant-time compare the callback-token hash;
2. load the stored QPay invoice/payment attempt;
3. treat callback fields only as a notification trigger;
4. call QPay `POST /v2/payment/check` using the stored `qpay_invoice_id`;
5. require a successful paid status, exactly one acceptable payment, `MNT`, and the exact snapshotted amount;
6. record the QPay payment ID and paid timestamp;
7. call the shared atomic enrollment finalizer;
8. return success for duplicate callbacks without granting access twice.

If QPay sends `payment_id`, optionally confirm it through `GET /v2/payment/{payment_id}` and require it to match the payment-check result.

### Status endpoint

Add an authenticated status read for the browser. The browser may refresh/poll the academy's own database briefly; it must not poll QPay directly.

Provide a rate-limited “Check payment” recovery action for a user whose bank succeeded but callback was missed. It performs the same server-to-server QPay verification and idempotent finalization. It is a recovery path, not continuous polling.

## 8. Shared atomic finalizer

Refactor the existing Version 2 admin approval function so manual and QPay payments converge on one private atomic finalizer.

The finalizer must lock and verify:

- payment and application state;
- exact tuition snapshot;
- contract evidence when required;
- primary and bonus course snapshot completeness;
- course readiness;
- offering lifecycle and capacity;
- no existing active enrollment or paid payment.

In the same database transaction it must:

1. mark the canonical payment paid/approved;
2. mark the application approved with decision source `qpay` or `admin`;
3. create the offering enrollment;
4. create primary and bonus entitlements;
5. enqueue the existing approval notification;
6. return the existing result structure.

The operation must be idempotent. Replayed callbacks, retried functions, or concurrent requests must return the already-created enrollment instead of creating duplicates.

The service-only RPC used by the callback must be revoked from `PUBLIC`, `anon`, and `authenticated`, and granted only to the server secret/service role. User-facing RLS must not expose other applicants' payments.

## 9. Student checkout experience

In the existing Version 2 `PaymentPanel`:

1. Show **QPay-аар төлөх** as the primary action.
2. On desktop, show the dynamic QR, exact amount, payment reference, and expiry countdown.
3. On mobile, show QPay/bank deeplink choices returned by QPay.
4. After invoice creation, show `Төлбөр хүлээж байна` and refresh only the academy payment status.
5. After verified payment, show success and link to the dashboard/course.
6. If expired, offer to create a new invoice without reusing `sender_invoice_no`.
7. Keep **Банкны шилжүүлэг / баримт илгээх** in a collapsed fallback section during rollout.
8. Never show success merely because a bank app opened or the customer returned to the page.

The current `payment_configuration.is_test_mode` should become a broader checkout mode/configuration that can independently enable:

- QPay;
- manual-transfer fallback;
- sandbox/production display warning;
- emergency QPay disable switch.

## 10. Admin operations and reconciliation

Extend the admin payment page to show:

- payment method (`QPay` or manual transfer);
- source site;
- internal payment reference;
- QPay invoice/payment IDs;
- amount and provider status;
- created, paid, and enrolled timestamps;
- mismatch/failure reason;
- a link to the application and resulting enrollment.

QPay payments normally require no manual approval after verification. Put exceptions—amount mismatch, ambiguous provider result, expired application, capacity conflict, or callback failure—into a reconciliation queue. Do not silently grant access when an invariant fails.

Refunds and cancellations must be a separate audited workflow. Do not automatically revoke course access solely because a callback is retried or an invoice is cancelled. Design entitlement revocation and financial refund policy together before enabling refunds.

## 11. Rollout sequence

### Phase 0 — External confirmation

- Confirm callback contract, settlement mapping, sandbox, and eBarimt scope with QPay.

### Phase 1 — Database foundation

- Add canonical payments, backfill manual proofs, add enrollment payment reference, RLS/grants, constraints, and shared finalizer.
- Keep all existing UI behavior unchanged.

### Phase 2 — Server integration

- Add server-only QPay client, token cache, invoice creation, callback, status, and recovery verification.
- Keep `QPAY_ENABLED=false` by default.

### Phase 3 — Checkout and admin UI

- Add QR/deeplinks/status UI and admin reconciliation fields.
- Keep manual receipt upload available.

### Phase 4 — Sandbox/staging verification

- Test token reuse, invoice creation, callback, exact amount, replay, expiry, failed payment, contract requirement, capacity race, notification, and bonus access.

### Phase 5 — Controlled production pilot

- Configure Vercel production secrets.
- Enable QPay for one Version 2 offering only.
- Make one approved small live payment.
- Reconcile QPay, database payment, enrollment, entitlements, notification, and settlement account.

### Phase 6 — Broader rollout

- Enable remaining Version 2 offerings.
- Monitor exceptions and callback failures.
- Remove manual fallback only after an agreed stability period.
- Migrate legacy direct-course checkout separately.

## 12. Verification checklist

Automated tests must cover:

- server-only configuration and missing-secret errors;
- QPay request/response schema parsing;
- no price or identity data trusted from the browser;
- unique invoice number under retries/concurrency;
- existing valid invoice reuse;
- callback token validation;
- forged callback does not enroll;
- amount/currency/status mismatch does not enroll;
- duplicate callback is idempotent;
- missed-callback recovery finalizes once;
- contract-required application cannot pay early;
- expired payment deadline cannot create a new invoice;
- offering capacity race has one deterministic winner;
- primary and bonus entitlements are granted together;
- manual receipt workflow still works;
- users cannot read another user's payment;
- admin reconciliation queries and indexes are efficient.

Before production:

```text
npm test
npm run typecheck
npm run lint
npm run build
```

Run migration verification and Supabase security/performance advisors before applying production schema changes.

## 13. Deliberate non-goals for the first release

- No QPay integration for legacy direct-course checkout.
- No eBarimt automation until QPay enables and confirms it.
- No automatic refunds or entitlement revocation.
- No routing to arbitrary bank accounts from application code.
- No sharing production credentials between browser clients.
- No continuous QPay status polling.
