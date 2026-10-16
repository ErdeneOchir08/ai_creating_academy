# QPay merchant transition

## Status

Activated on 2026-10-16 with `QPAY_ACTIVE_MERCHANT=zurkhai` in Production.
Code commit: `44d90c9b51e34afa816370559f9f04487bf2da09`.
Production deployment: `dpl_4scXccxpcW6SGjUiasUEg7MG2mxe` (READY, mindacademy.mn).
Both merchants authenticated through the admin-only connection check; server-side
cache metadata confirmed valid tokens without revealing them. All 280 automated
tests, targeted lint, and production build passed before release.

At activation, four paid payments (207,500 MNT total) and two pending payments
(138,000 MNT total) remained unchanged and assigned to `legacy`.
No new-merchant invoice or real payment has yet been tested end-to-end. Verify
the receiving account and complete an authorized small purchase before treating
new-merchant settlement and course unlock as fully verified.

The temporary admin connection-check UI and its server action were removed after
authentication was verified. Merchant routing, credentials, payment history,
token isolation, and regression tests remain in place. Customer-facing invoice
descriptions use Mind Academy; bank-controlled recipient names still require
confirmation with QPay/the receiving bank.

## Configuration

Do not replace or remove the existing QPAY_CLIENT_ID, QPAY_CLIENT_SECRET,
QPAY_INVOICE_CODE, or the shared QPAY_BASE_URL and QPAY_SOURCE_SITE values.
These original credentials belong to merchant key `legacy` permanently.

Add these server-only Vercel Production variables:

| Key | Value |
| --- | --- |
| QPAY_ZURKHAI_CLIENT_ID | MONGOL_ZURKHAI |
| QPAY_ZURKHAI_CLIENT_SECRET | Enter privately in Vercel as a Secret |
| QPAY_ZURKHAI_INVOICE_CODE | MONGOL_ZURKHAI_INVOICE |
| QPAY_ACTIVE_MERCHANT | Keep `legacy` until the staged validation passes; then `zurkhai` |

No production credentials in previews, source code, reports, or screenshots.

## Routing and rollout

1. Apply `20261016001721_qpay_merchant_routing.sql` before deploying new code.
   It labels all existing payment attempts `legacy`, preserves financial records,
   and creates a service-role-only token cache keyed by merchant.
2. Deploy dual-merchant code initially with active merchant `legacy`.
3. Verify the two old pending attempts retain their merchant, invoice IDs and amounts.
   As checked before rollout: MA-00000011 and MA-00000012, each 69,000 MNT.
   Re-read status immediately before release; customers may pay meanwhile.
4. Authenticate the new merchant without creating an invoice; do not print tokens.
5. Set active merchant to `zurkhai` and redeploy. Monitor the first newly created
   invoice and have the owner verify the receiving account before paying.
6. Test a separately authorized small purchase, reconciliation, and course access.
   Do not modify a real student's price or manually mark a payment paid.

New attempts persist their merchant before calling QPay. Reused invoices keep
their original merchant. Callback/manual verification uses the stored merchant,
not the active merchant. Missing configuration fails closed without fallback.

## Rollback

After any new-merchant invoice exists, do NOT roll back to single-merchant code.
Keep dual-merchant code and both credential sets; switch QPAY_ACTIVE_MERCHANT to
`legacy` and redeploy to route only future attempts back. Existing invoices of
both merchants must still reconcile using their stored owner.

The website due date is not provider expiry: invoice creation currently uses
`enable_expiry: false`. Retain old credentials until all outstanding provider
invoices have been verified/cancelled through an explicitly approved process.
Rotating a merchant credential requires clearing only that merchant's token cache.
