# Mind Academy online course launch control

Use this checklist for every new paid online course. Ordinary administration must happen through the admin interface; do not edit production rows manually.

## Create the course

1. Create or update the reusable course under **Admin → Courses**.
2. Upload at least one video and wait until its playback status is ready.
3. Publish the course only after its learner-facing title, description, thumbnail, lessons, and preview settings are correct.

## Create the commercial offering

1. Open **Admin → Programs** and select or create the program.
2. Create an online offering draft.
3. Select the course, contract policy, published contract version when required, price, payment deadline, registration dates, schedule, and course dates.
4. Keep **QPay** enabled. Keep **bank transfer** enabled only when the academy wants manual receipt review as a fallback.
5. Preview the complete learner flow before opening registration.

## Change an offering safely

- Price, dates, displayed class size, schedule, payment deadline, and payment text can be updated for future applicants. Enter a clear change reason.
- Existing applications, contracts, payment amounts, QPay invoices, enrollments, and course access keep their original snapshots.
- To change the linked course, contract policy/version, or delivery identity after opening, use **Create new draft version**. Review and open that draft instead of editing production data.
- Use the impact counters before publishing a change. Pay special attention to active checkouts and pending payments.
- Disabling a payment method blocks only new attempts. Existing QPay invoices remain visible and reconcilable.

## Open registration

Before selecting **Open enrollment**, confirm:

- the course is published and has a ready video;
- the offering is online;
- the production price is correct;
- registration and course dates are correct;
- the correct contract version is selected, or no contract is intentionally selected;
- QPay is shown as active in production;
- the preview contains no test wording;
- the offering is not a 500 MNT test offering.

## Production smoke test

1. Use a dedicated learner account.
2. Submit learner details and accept the contract when required.
3. Generate one low-value QPay invoice only when the offering is intentionally configured for a live test.
4. Confirm payment in the banking app.
5. Confirm the checkout reports successful QPay payment.
6. Confirm the course appears under **My courses**.
7. Confirm the payment appears under **Admin → Payments**.
8. Confirm the offering impact counters show the application, paid payment, and active enrollment.

## Emergency controls

- To stop new applications, close registration.
- To stop only new QPay invoices, disable QPay for the offering and provide a reason.
- To stop only new manual receipts, disable bank transfer and provide a reason.
- Do not delete paid records, signed contracts, enrollments, or entitlements.
- Do not change QPay credentials or settlement-bank configuration from application code.
