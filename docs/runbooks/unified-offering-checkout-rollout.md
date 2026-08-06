# Unified offering checkout rollout

Status: prepared, not yet applied to production.

This runbook activates the version-2 offering checkout without interrupting the
existing course-payment and cohort-payment workflows.

## Release invariants

- Keep checkout version 1 readable and usable throughout the rollout.
- Do not open a version-2 offering before the compatible application is live.
- Apply database changes in migration order; never apply the activation
  migration first.
- Treat learner, contract, payment, enrollment, and entitlement records as
  financial/legal history. Do not delete them to recover from an operational
  mistake.
- A payment approval must create the learner enrollment and every promised
  course entitlement atomically.

## Phase 1 — pre-release verification

Run from the project root:

```text
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
git diff --check
```

All commands must pass before continuing. Review the complete diff and confirm
that no local secret file is staged.

## Phase 2 — install the dormant database foundation

Apply these migrations to Supabase in order:

1. `20260806113427_add_course_offering_foundation.sql`
2. `20260806150000_add_v2_offering_checkout.sql`

Do not apply `20260806160000_enable_v2_offering_checkout.sql` yet. The
foundation deliberately prevents a version-2 offering from becoming `open`.
This makes the schema safe to install before the application release.

After applying the dormant foundation:

- inspect Supabase security and performance advisors;
- confirm existing version-1 courses, cohorts, applications, and payments are
  still readable;
- confirm no version-2 offering can be opened yet.

## Phase 3 — deploy the compatible application

Deploy the verified Git commit to Vercel production. The deployment must use the
existing production environment variables; this feature introduces no new
secret.

Before activation, smoke-test only existing production behavior:

1. Public homepage and published course catalog load.
2. Admin course, program, user, and all existing payment pages load.
3. A paid learner can open an existing lesson.
4. Existing preview lessons remain public and paid lessons remain protected.
5. Existing direct-course and legacy cohort records remain visible to admins.

If a regression appears, redeploy the previous Vercel build. Leave the additive
database foundation installed and investigate before continuing.

## Phase 4 — activate version 2

Apply:

`20260806160000_enable_v2_offering_checkout.sql`

This replaces only the temporary rollout blocker. The database will still
refuse to open a version-2 offering unless it has:

- `online` or `offline` delivery;
- an active parent program;
- a published linked course with at least one ready video lesson;
- a positive tuition amount and payment deadline;
- no contract for `contract_policy = none`; or
- a published contract version from an active template for
  `contract_policy = required`.

### Administrator cutover semantics

Merely creating a V2 draft or linking a course has no effect on the existing
direct-course checkout. The first successful **Open enrollment** action for a
V2 offering writes an immutable ownership record in the same database
transaction. From that commit onward, the linked course permanently uses the
offering checkout, including while every offering is closed or historical.

Before opening the first V2 offering for a course, the administrator must:

1. finish and review the offering configuration;
2. confirm the public offering, contract/no-contract, and payment screens are
   ready for that course;
3. understand that closing the offering will pause new applications but will
   not restore legacy direct payment;
4. open the offering once, then verify the course routes to its offering list
   and that a new legacy payment request is rejected.

Do not delete or edit the ownership record. Reversing a cutover is not an
ordinary admin operation and requires a separately reviewed data migration.

## Phase 5 — one controlled production pilot

Create one version-2 test offering and keep its registration window narrow.
Test with dedicated learner/admin accounts and a clearly marked test receipt.

### No-contract branch

1. Select the offering from the public course page.
2. Log in or register and return to the same offering.
3. Enter learner/contact details.
4. Continue directly to payment and submit an image receipt.
5. Confirm the admin sees the request in the unified-offering payment tab.
6. Approve it once.
7. Confirm the learner receives the decision email, sees the course in the
   dashboard, and can open a protected lesson.

### Contract-required branch

1. Repeat with a contract-required offering.
2. Verify an adult learner signs for themselves.
3. Verify an under-18 learner displays parent/legal-guardian fields.
4. Verify adaptive email confirmation is requested only when policy requires
   it.
5. Confirm accepted contract evidence becomes immutable before payment.
6. Submit and approve the payment, then repeat the access checks above.

### Correction branch

1. Reject a pending receipt with a clear reason.
2. Confirm the learner receives the reason by email and on the dashboard.
3. Submit a replacement receipt.
4. Approve the replacement and confirm only one active enrollment is created.

## Operational monitoring

During the pilot, watch:

- Vercel server errors and function latency;
- Supabase Postgres, Auth, API, and Storage logs;
- pending payment proof age;
- failed notification-outbox rows;
- active enrollment count versus offering capacity;
- duplicate or abandoned draft applications.

If checkout must be paused, close the affected offering. Do not revoke existing
approved enrollments or remove evidence as an emergency shortcut.

## Deferred product decisions

Before a broad launch, Mind Academy must explicitly choose:

1. Whether a seat is reserved while payment is pending, or only when an admin
   approves payment. The current design consumes capacity at approval time.
2. How duplicate learner identities should be reconciled when one guardian
   submits multiple applications. The schema supports future reconciliation,
   but it must not guess identity from names alone.

These decisions belong to the future student-management module and must be
implemented as audited workflows, not spreadsheet-shaped database state.
