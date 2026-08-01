# Mind Academy deployment guide

Use this guide only after the local payment and lesson flow has passed its launch test.

## 1. Prepare the repository

Keep the repository private. Before pushing, confirm `.env.local` is not staged; it contains secrets and must remain local.

## 2. Create the Vercel project

1. Import the private GitHub repository in Vercel.
2. Keep the framework preset as **Next.js**.
3. Add these environment variables to **Production**:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or a modern `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
   - `NEXT_PUBLIC_SITE_URL` set to the final `https://` domain
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
   - For private Cloudflare Stream lessons: `CLOUDFLARE_STREAM_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`, and `CLOUDFLARE_STREAM_CUSTOMER_CODE`

Do not add a Supabase service-role key or an AI-provider key for this launch. Keep SMTP, Telegram, and Cloudflare Stream values server-only; never give them a `NEXT_PUBLIC_` prefix. Preview deployments should use a separate test project or avoid real payment testing, because they should not send production notifications.

## 3. Configure Supabase Auth

In **Authentication -> URL Configuration**:

1. Set **Site URL** to the deployed production URL.
2. Add the production URL with `/**` to **Redirect URLs**. This allows confirmation emails to return through `/auth/confirm` and establish the user's session safely.
3. Add a Vercel preview URL pattern only if preview deployments will use sign-in.
4. For local testing, add both `http://localhost:3000/auth/confirm` and `http://localhost:3000/auth/reset-password` to **Redirect URLs**.

## 4. Final production check

Before announcing the site, repeat the launch test with two accounts: one admin and one student. Verify a student can register, submit a payment receipt, receive an approval or rejection email, open the course, watch a lesson, and mark it complete. Verify that the student cannot open another student's receipt or access a course before approval.

## 5. Post-launch safety

The current Supabase Free plan reports **Leaked Password Protection** as unavailable. Keep the existing eight-character password minimum; enable leaked-password protection later if the project moves to a plan that supports it.
