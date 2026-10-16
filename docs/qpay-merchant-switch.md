# QPay merchant transition

## Status

Prepared dual-merchant implementation. Activation requires production credentials,
database migration, deployment, and verification. This document is not proof of activation.

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
