# Cross-device password recovery

Deploy the application BEFORE saving `password-recovery-email.html` as the Supabase
Authentication > Emails > Reset password body in project `mditkayyzvpddmurcsjy`.
Keep the existing subject. This template is intentionally production-domain-specific.

The email's token hash is in a fragment (not server logs). Landing on the page does
not redeem it. The Continue button calls `verifyOtp` with a fixed `recovery` type;
only a returned session enables the password form. Verification does not need the
requesting browser's PKCE cookie. Supabase still enforces expiration and single use.
Old PKCE emails remain subject to their original browser requirement.

Acceptance: request a NEW email, open on a different device/browser, Continue,
enter a new password privately, then sign in with it. Reopening the consumed email
must show an error and a fresh-link action. Merely viewing the email or landing
page must not consume the token. Never record real tokens/passwords in tests/logs.

Automated unit tests use fake verification responses; they do not prove live email
delivery, token redemption, or password updates. A real user must complete the
private password-entry step to finish end-to-end verification.

Rollback: restore the old body below before rolling back the app. Newly issued
fragment links require the new app, so prefer a forward fix while those expire.

```html
<h2>Сайн байна уу!</h2>
<p>Таны Mind Academy бүртгэлийн нууц үгийг сэргээх хүсэлт ирлээ.</p>
<p>Доорх товчийг дарж шинэ нууц үг үүсгэнэ үү.</p>
<p><a href="{{ .ConfirmationURL }}">Нууц үг солих</a></p>
<p>Хэрэв та энэ хүсэлтийг гаргаагүй бол энэ и-мэйлийг үл тоомсорлоно уу.</p>
<p>— Mind Academy</p>
```
