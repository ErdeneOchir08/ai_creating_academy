# Automatic course QPay release — 2026-10-11

## Admin workflow

1. Create a course. Leave **Бие даан суралцах — QPay автоматаар** selected.
2. Set its price and upload videos.
3. Publish. The QPay-enabled self-paced checkout is created automatically.
4. To change the selling price, edit the course. Existing invoices keep their price.
5. To stop new sales, archive the course. Existing students retain access.

For teacher-led/offline-only content choose **Зөвхөн багштай / танхимын ангиар**.
Configure and open the associated class using its existing contract workflow.
Do not enable direct sales for content intended to require a class contract.

## Verified

- 241 unit tests; TypeScript, ESLint and optimized production build passed.
- Authenticated-admin SQL release gate passed with all fixtures rolled back.
- AI контент бүтээгч: direct, self-paced, no contract, QPay on, 69,000 MNT.
- No published active direct paid course missing its open QPay offer.
- Before/after fingerprints match for applications, QPay/manual V2 payments,
  legacy payments/enrollments and access entitlements.
- No persistent verification course, learner or invoice was left behind.
- Student course page links to the new checkout; a new real bank payment has
  NOT been performed during this release.

## Security and operations

New trigger functions are private/security-invoker and use existing RLS.
No credentials, callback verification, paid-state validation or entitlement rules
were weakened. The security advisor's findings are unchanged from before release:
existing public read RPCs / authenticated admin RPCs flagged as security-definer,
two deliberately service-only RLS tables, and leaked-password protection disabled.
See [Supabase advisor guidance](https://supabase.com/docs/guides/database/database-linter)
and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Do not delete ownership claims or financial records to roll back this rollout.
Archive a course to pause sales; existing invoices still need reconciliation.
The additive database changes remain compatible with the previous frontend.
