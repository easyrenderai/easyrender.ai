---

name: cached-marketing-pages
description: Why marketing pages are built once per pricing key and what must never be read in their layouts
type: project
---

# Cached marketing pages

Marketing pages are static (ISR, hourly) and served from the edge cache. Nothing per visitor may be
read in the root layout, the marketing layouts or the page tree above `(account)`: no `cookies()`,
`headers()`, session or `connection()`. `lib/static-marketing.test.ts` fails if one appears.

- **Pricing** is part of the page: `proxy.ts` picks a pricing key (`usd|eur` x `control|test`, see
  `packages/core/src/pricing-context.ts`) from the country header, the experiment flag and the
  anonymous id, and rewrites `/pricing` to `/p/{key}/pricing`. Priced pages live under
  `app/(marketing)/p/[key]`; a direct `/p/...` request redirects to the public path.
- **Who is looking** (signed in, balance, subscriber top-up quote, the arm) comes from `/api/viewer`
  in the browser (`components/use-viewer.ts`, `by-viewer.tsx`). It also writes the app language cookie.
- **Language** of a marketing page is its URL: each layout calls `setRequestLocale`. A not-found file
  is drawn beside every page, so `IntlBoundary isFallback` must not set the request language.
- The proxy adds no cookie and no `no-store` to a cacheable marketing response; either would make
  Vercel skip the cache. Check `x-vercel-cache: HIT` on a staged release after touching it.

**Why:** the audit (2026-11-20, package 10) found every marketing page rendered per request.
**How to apply:** add a per-visitor value to `/api/viewer`, never to a layout or a cacheable page.
