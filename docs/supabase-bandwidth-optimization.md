# Supabase bandwidth investigation and optimization

## Evidence (November 2, 2026)

Project: `AI Creator Academy Production` (`mditkayyzvpddmurcsjy`). Read-only Storage metadata and API gateway logs identify the public cover for **AI контент бүтээгч** as the dominant Storage download on the inspected spike days:

`course-media/bb89bba3-3170-4f32-baa8-001daa0a5657.png`

The original is 1,944,128 bytes, 1672 × 941 pixels, with `Cache-Control: max-age=3600`.

| UTC window | Cached full responses (200) | Cached revalidations (304) | Cached partial responses (206) |
| --- | ---: | ---: | ---: |
| October 26–27 | 682 | 63 | 28 |
| October 27–28 | 767 | 112 | 44 |
| October 29–30 | 796 | 44 | 27 |

It was the only Storage download path returned in these windows. October 29 logs report 1,547,525,888 bytes of content length for cached 200 responses and 13,276,514 bytes for cached 206 responses. Full-image estimates on the other days are 1.326 GB and 1.491 GB. These describe inspected requests, not the entire billing cycle or an exact Supabase invoice. Revalidations have no image body; partial responses must not be counted as full files.

Of October 29's 798 full responses (including two origin misses), 777 had `mindacademy.mn` as their referring domain; 21 had no referrer. Referrers alone do not establish whether a request came from a person or crawler.

For comparison, the November 1–2 UTC window returned only four full cached downloads (7,776,512 bytes) and one 32-byte partial response for the same image. Traffic had already declined; the historical spikes explain the accumulated usage and remain the pattern to prevent.

## Changes

- A visually checked, already-public copy is stored at `/course-covers/ai-content-creator-ba840ecc4f990edc.webp`: 1280 × 720, **70,826 bytes**, **96.36% smaller**. Its filename includes the content hash and it receives a one-year immutable browser cache policy.
- The exact original public path on the configured Supabase project maps to this website asset. Normal site views of this cover no longer download it from Supabase. A new upload UUID automatically uses the normal remote-cover path, preserving admin edits.
- Catalog, course sales, student courses, and progress screens use responsive lazy images through Next's optimizer. Only the configured project's public `course-media` bucket is permitted, with a seven-day minimum cache and redirects disabled. Signed files and payment receipts are excluded.
- New course-cover uploads are validated, bounded to 1280 pixels per side, converted to WebP, capped at 512 KiB, and stored with one-year cache control and a fresh UUID. Large compressed inputs and unsupported/invalid images are rejected. Receipt processing is unchanged.
- Original Storage objects and all course records are preserved. Direct requests to old public URLs can still consume Supabase bandwidth; the website stops generating these requests for the identified cover.

## Limits and follow-up

Already-incurred bandwidth cannot be reduced retroactively. The screenshot's billing cycle ends November 22, 2026. Free-tier suitability depends on future organization-wide traffic, including other projects; this optimization is not a guarantee against future quota restrictions.

After release, review Storage download counts and the organization's cached/uncached egress before the cycle resets. Confirm the old cover path's requests decline. If they remain high, inspect external referrals separately rather than deleting course content or changing payment access rules.

## Verification

- 297 tests pass, including public/private optimizer boundaries, static mirror selection, real Next/Image output, and upload decoding/compression checks. Lint and the production webpack build pass.
- Local production-browser measurement: the catalog cover loaded as a responsive 384-pixel website image with **10,564 bytes** of encoded body data, versus the 1,944,128-byte original. This is about **99.46% less image data** for that measured desktop variant; sizes vary by viewport and browser.
- The immutable original WebP endpoint responds with 70,826 bytes and a one-year cache policy. A separate public course cover successfully passes through the seven-day remote optimizer.
- Visual review confirms the original artwork and card layout are preserved. Private receipts and course records were not modified.

Reference: [Supabase egress quotas](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [Storage optimization guidance](https://supabase.com/docs/guides/storage/production/scaling).
