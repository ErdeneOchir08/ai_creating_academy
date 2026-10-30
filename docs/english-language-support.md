# English language support

Mind Academy supports Mongolian (`mn`, the default) and English (`en`) without an external translation API.

- The language selector is available in the desktop and mobile navbar. It saves a validated, HTTP-only cookie for one year, keeps the current route, and refreshes server-rendered content.
- `src/lib/i18n/en.json` contains English translations keyed by the existing Mongolian UI text. `getTranslations()` is used in server components; `useTranslations()` is used in client components under `LanguageProvider`.
- The HTML `lang` attribute and public-page metadata follow the saved language. English is a per-visitor preference; this implementation does not create separate English URLs for search indexing.
- Coverage includes the public site, authentication and recovery screens, course navigation, student dashboard, enrollment forms, and payment interface. The private administration interface has not been translated.
- Admin-authored course descriptions, lesson titles, videos, custom contract fields, signed contracts, payment instructions, and student messages remain in their original language. Unrecognized messages fall back to the original text. No content is sent to Google.
- Class schedules and payment deadlines use the selected language and retain the academy's Asia/Ulaanbaatar timezone.

To add UI text, add an English entry to the dictionary and render the Mongolian source through the translation helper. For sentences containing values, use named placeholders so each language can place the values naturally.

The tests cover language validation, preference cookies, translated rendering, preserved authored content, enrollment links, and timezone formatting. `vitest.config.mts` resolves the project's `@/` imports for component tests.

The saved `temp.html` snapshot is excluded from Tailwind scanning because its HTML-escaped class names generate invalid CSS URLs during a webpack build.
