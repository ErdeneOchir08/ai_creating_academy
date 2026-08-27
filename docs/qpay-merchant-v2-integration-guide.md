# Mind Agency LLC — QPay Merchant V2 integration guide

Use this guide when adding QPay payments to any web application owned and operated by **Mind Agency LLC**. It is written for developers and AI coding assistants.

## 1. Confirmed QPay product

Mind Agency LLC has **QPay Merchant V2 / Dynamic QR** API access.

- Merchant legal entity: `MIND AGENCY LLC`
- Invoice code currently supplied by QPay: `MINDACADEMY_INVOICE`
- Production API base URL: `https://merchant.qpay.mn`
- Sandbox API base URL: `https://merchant-sandbox.qpay.mn`
- Authentication endpoint: `POST /v2/auth/token`

This product creates a unique invoice for each order and returns a dynamic QR code and bank-app deep links. It is for online checkout. It is not a static/printed QR integration and it is not a client-side payment SDK.

> **Scope check:** Before using the supplied invoice code for a new brand or website, confirm with QPay that it is authorized under the Mind Agency LLC merchant agreement. One backend can technically serve multiple Mind Agency LLC websites, but QPay decides invoice-code and callback-domain policy.

## 2. Non-negotiable security rules

1. Keep QPay credentials server-side only. Never put them in browser JavaScript, mobile-app bundles, Git commits, screenshots, logs, or error messages.
2. Store credentials in the host's encrypted environment-variable settings. For Vercel, set them in the Vercel project environment variables.
3. Never mark an order as paid because the browser says “payment complete.” Only a verified QPay payment result may unlock a product, membership, booking, or course.
4. Create a unique internal order ID and a unique QPay `sender_invoice_no` for every invoice. Never reuse either value.
5. Store payment state in a durable database. Serverless function memory is not durable.
6. Treat the QPay callback as a trigger, then verify it server-to-server with QPay before changing access.
7. Do not continuously poll QPay for payment state. QPay recommends callback-driven confirmation followed by `POST /v2/payment/check`.

## 3. Required environment variables

Use these names consistently. Actual secret values must not be written into source code or this document.

```dotenv
QPAY_BASE_URL=https://merchant.qpay.mn
QPAY_CLIENT_ID=<QPay client name from QPay email>
QPAY_CLIENT_SECRET=<QPay secret/password from QPay email>
QPAY_INVOICE_CODE=MINDACADEMY_INVOICE
NEXT_PUBLIC_SITE_URL=https://your-production-domain.example
```

For local development, use sandbox credentials and `https://merchant-sandbox.qpay.mn` when QPay has issued them. Do not use production credentials for routine development tests.

## 4. Architecture

```text
Browser
  │ POST /api/payments/qpay/create (product/order intent)
  ▼
Application server / Vercel Function
  ├─ validates authenticated user and server-side price
  ├─ creates an internal PENDING order in the database
  ├─ obtains/reuses QPay access token
  ├─ POST /v2/invoice
  └─ returns only safe invoice data: invoice ID, QR image/text, deep links
  ▼
Customer pays in bank app
  ▼
QPay POST /api/payments/qpay/callback
  ├─ locates internal order by QPay invoice ID
  ├─ POST /v2/payment/check with the invoice ID
  ├─ verifies paid status, currency, amount, and merchant order mapping
  ├─ atomically marks the order PAID
  └─ grants the specific entitlement exactly once
  ▼
Browser refreshes order status / receives application update
```

## 5. QPay API flow

### A. Obtain an access token

```http
POST https://merchant.qpay.mn/v2/auth/token
Authorization: Basic base64(QPAY_CLIENT_ID:QPAY_CLIENT_SECRET)
```

The response includes an access token. Use it as `Authorization: Bearer <access_token>` for protected endpoints. Cache and refresh tokens appropriately; do not request a new one for every browser action.

### B. Create an invoice

```http
POST https://merchant.qpay.mn/v2/invoice
Authorization: Bearer <access_token>
Content-Type: application/json
```

Build the request using QPay’s current Merchant V2 endpoint schema. The usual essential data includes:

```json
{
  "invoice_code": "MINDACADEMY_INVOICE",
  "sender_invoice_no": "your-unique-order-number",
  "invoice_receiver_code": "terminal",
  "invoice_description": "Clear description of the product or service",
  "amount": 50000,
  "callback_url": "https://your-domain.example/api/payments/qpay/callback"
}
```

The QPay response provides an `invoice_id` and payment presentation data such as QR image/text, short URL, and bank-app links. Store the `invoice_id` with the internal order. Return the QR/deeplinks to the browser, never the token or credentials.

### C. Receive callback and verify

The callback URL must be a public HTTPS endpoint in production. A `localhost` callback cannot receive QPay’s request.

When a callback arrives:

1. Parse and validate the callback request according to QPay’s current schema.
2. Determine the related QPay invoice ID and look up the internal pending order.
3. Call `POST /v2/payment/check` with that invoice ID.
4. Verify the response is a successful paid payment for the exact expected amount and currency.
5. In one database transaction, transition the order from `PENDING` to `PAID` and grant the entitlement.
6. If the order is already paid, return success without granting twice (idempotency).

Never trust query parameters, a client redirect, or the callback body alone as payment proof.

## 6. Vercel / Next.js implementation pattern

For a Vercel-hosted Next.js app, use Node.js route handlers:

```text
src/app/api/payments/qpay/create/route.ts
src/app/api/payments/qpay/callback/route.ts
src/app/api/payments/qpay/status/[orderId]/route.ts
```

- `create`: authenticated POST endpoint; calculates price from the database/product ID, creates the pending order, creates the QPay invoice.
- `callback`: public POST endpoint; verifies payment server-to-server and performs the idempotent order update.
- `status`: authenticated GET endpoint; returns the caller’s own order status. It must not expose arbitrary orders.

Set `QPAY_CLIENT_ID`, `QPAY_CLIENT_SECRET`, `QPAY_INVOICE_CODE`, and `NEXT_PUBLIC_SITE_URL` in Vercel’s environment-variable settings. Use a Node.js serverless function, not a browser-only integration. The public callback may be, for example:

```text
https://mongol-zurkhai.vercel.app/api/payments/qpay/callback
```

Prefer the application’s permanent custom domain when it is available. Confirm callback-domain requirements with QPay before launch.

## 7. Data model minimum

Create an orders/payments table with fields equivalent to:

```text
id                    internal UUID
user_id               purchaser/account reference
source_site           e.g. "mongol-zurkhai"
product_id            server-owned product reference
amount_mnt            integer MNT amount
currency              "MNT"
status                PENDING | PAID | EXPIRED | CANCELLED | REFUNDED
qpay_invoice_id       unique, nullable until invoice creation succeeds
sender_invoice_no     unique
qpay_payment_id       unique, nullable until verified paid
created_at
paid_at
```

Add database uniqueness constraints for `sender_invoice_no`, `qpay_invoice_id`, and (where present) `qpay_payment_id`. Make the transition to `PAID` transactional and idempotent.

## 8. Multi-website payment-routing policy

When Mind Agency LLC uses the same QPay Merchant V2 account for multiple authorized websites, use **one central payment record** and make the payment origin explicit. Do not try to infer the source website later from an amount or description.

### Required identifiers

Every payment must have these identifiers stored before the QPay invoice is created:

| Field | Purpose | Example |
| --- | --- | --- |
| `source_site` | Stable site/brand identifier used for filtering and routing | `mongol-zurkhai` |
| `internal_order_id` | Application-owned unique order UUID | `9e77…` |
| `sender_invoice_no` | Unique QPay-facing invoice/order reference | `MZ-20260827-9E77…` |
| `qpay_invoice_id` | QPay’s returned invoice identifier | saved after creation |
| `product_id` | Exact entitlement/product being purchased | `premium-reading` |
| `callback_route` | Central callback endpoint or approved site callback | `/api/payments/qpay/callback` |

### Invoice number format

Use a readable, unique prefix per website. The QPay `sender_invoice_no` must be globally unique for the merchant account—not only unique within one website.

```text
<SITE_PREFIX>-<YYYYMMDD>-<UNIQUE_ORDER_ID>

Examples
ACA-20260827-6F1A…    # AI Creator Academy
MZ-20260827-9E77…     # Mongol Zurkhai
```

Do not use a customer email address, phone number, or other personal data in invoice numbers.

### Recommended callback design

Use one central public callback endpoint for all sites whenever practical:

```text
https://payments.mindagency.mn/api/qpay/callback
```

or a single application endpoint such as:

```text
https://mongol-zurkhai.vercel.app/api/payments/qpay/callback
```

The callback handler must look up the order by `qpay_invoice_id`, verify the payment with QPay, then use the stored `source_site` and `product_id` to route the approved result to the correct entitlement logic. It must not use an arbitrary `site` value sent by the browser or callback request to decide where to grant access.

Multiple separate callback URLs can also work if QPay approves them. Each callback must still perform the same server-to-server verification and use the database mapping.

### Reporting and reconciliation

Build admin filtering on stored fields, not on invoice text alone:

```text
Filter payments by source_site = "mongol-zurkhai"
Filter payments by date, status, product_id, qpay_invoice_id, or internal_order_id
```

This lets Mind Agency LLC reconcile one QPay merchant account while seeing exactly which website, product, and order generated every payment.

## 9. Test plan

1. Ask QPay for sandbox credentials, sandbox invoice code, and any callback/domain setup.
2. Verify token acquisition without creating an invoice.
3. Create a sandbox invoice with a unique order number and display its QR/deep link.
4. Use a public HTTPS test callback—not localhost—to confirm the callback reaches the app.
5. Confirm `payment/check` validates the payment and only the matching product is granted.
6. Replay the callback and confirm the entitlement is not granted twice.
7. Test failed/expired/cancelled payments and user cancellation.
8. Only then configure production credentials and do one small, approved live transaction.

## 10. Handling failures and refunds

- If invoice creation fails after creating a pending order, mark it failed or safely retry without reusing `sender_invoice_no`.
- If callback verification fails, leave the order pending and log enough non-secret information for support.
- Do not automatically refund solely due to a callback problem. First reconcile the verified QPay payment record.
- Follow QPay’s documented payment cancellation/refund flow and business policy for refunds.
- Do not issue eBarimt unless it is enabled and configured with QPay for the merchant.

## 11. Instructions for an AI implementing this

1. Inspect the project architecture, authentication, database, product/access model, and existing payment code before changing files.
2. Implement server-side endpoints only; do not send QPay credentials to the browser.
3. Use the exact current QPay Merchant V2 request/response schemas from the official documentation. Do not invent callback fields or assume a response shape.
4. Add validation, idempotency, database constraints, and tests for the payment state transition.
5. Add environment-variable names to `.env.example` only—never actual values.
6. Use a public HTTPS callback for end-to-end testing. Do not claim local callback confirmation is a complete integration.
7. Keep each website’s product and access logic separate, while optionally sharing a central Mind Agency LLC QPay payment service.
8. Before deployment, have the merchant confirm invoice-code scope and callback-domain requirements with QPay.
9. Apply the multi-website payment-routing policy: generate globally unique invoice numbers and persist `source_site` before requesting the QPay invoice.

## Official references

- QPay Merchant V2: <https://developer.qpay.mn/mn/docs/merchant?version=2.0.0>
- QPay documentation index: <https://developer.qpay.mn/mn/docs>
- QPay merchant solutions: <https://qr.qpay.mn/merchant>
- Vercel Functions: <https://vercel.com/docs/functions>
