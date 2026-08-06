# Enrollment, payment, and student-data architecture

Status: accepted direction; rollout is versioned and incremental.

## Product model

- A **course** is reusable learning content and its subject categories.
- A **training cohort** is the commercial offering a person can join. It owns delivery mode (`online` or `offline`), dates, capacity, tuition, payment deadline, contract policy, and the linked course.
- An **application/order** records the learner and the account that submitted the request.
- A **payment request** belongs to that application/order and stores the immutable amount and payment-proof review history.
- A **cohort enrollment** is the accepted physical learner's place in the offering.
- A **content entitlement** grants access to the linked course and any configured bonus courses.

The canonical relationship is:

`course -> training cohort -> application/order -> payment -> cohort enrollment -> content entitlement`

## Identity rule

The authenticated account is the applicant, but it is not always the learner. For a learner under 18, the applicant and contract signer can be a parent or legal guardian. Learner identity, applicant account, guardian identity, and signer evidence must remain separate fields/records.

No feature may infer that the account holder is the physical student.

## Checkout variants

- `contract_policy = none`: collect learner/contact details, accept payment proof, and complete one admin approval transaction.
- `contract_policy = required`: collect learner/guardian details, capture the versioned contract acceptance, accept payment proof, and complete the same single admin approval transaction.

Both variants must converge on the same payment, cohort-enrollment, and content-entitlement records. Admin approval must be atomic: partial approval must not grant only some of the promised access.

## Versioned rollout

- Checkout version 1 preserves existing production cohorts and their proven workflow.
- Checkout version 2 is the unified offering flow described above.
- A cohort's checkout version is immutable.
- Version 2 must remain draft-only until its public application, payment submission, admin decision, notification, enrollment, and entitlement path is complete and tested end to end.
- Version 2 must use a durable learner/student entity before it becomes public. Existing account-based application and enrollment columns are legacy compatibility fields, not the future student registry.
- Cancellation must revoke or explicitly preserve enrollments and content entitlements as one reviewed transaction; a cancelled offering must never leave ambiguous active access.

## One-way course checkout ownership

Course-level routing changes only at a deliberate commercial boundary:

- Creating or linking a draft V2 offering does **not** disable the legacy direct-course payment flow. Admins can prepare and discard drafts safely.
- The first successful transition of a V2 offering to `open` atomically claims its linked course for course-offering checkout.
- That claim is permanent audit evidence. Closing or archiving the claiming offering, or later having no open offerings, does not restore legacy checkout.
- Existing legacy payment records remain reviewable as history, but a new legacy payment request cannot be created after the claim commits.
- The opening transaction and legacy-payment creation both lock the same course row. This makes concurrent requests deterministic: the transaction that obtains the lock first completes before the other re-evaluates the ownership boundary.

For administrators, **Open enrollment** is therefore also the irreversible checkout cutover for the linked course. Draft preparation remains reversible; reopening legacy checkout after cutover requires a separately designed and audited migration, not a status change or row deletion.

## Future student administration

The current Excel/Google Sheets process will later be replaced by an admin student-management module. That module must read from the canonical learner, application, payment, cohort-enrollment, contract, and entitlement chain rather than creating a separate spreadsheet-shaped source of truth.

Until that module is delivered, spreadsheet export/import can be added only as an adapter at the system boundary. Spreadsheet row numbers, column labels, and manually entered status text must not become database identifiers or workflow state.

Future admin views should support, at minimum:

- one learner with multiple applications and cohort enrollments;
- a guardian linked to more than one learner;
- payment and contract history per application;
- current and historical course access;
- safe correction/audit workflows without deleting legal or financial history.
