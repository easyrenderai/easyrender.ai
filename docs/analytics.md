# Analytics and attribution

## November 18 tracking corrections

- The automatic consent prompt is restricted to the configured strict region (EEA, UK,
  Switzerland and listed territories), including unresolved country codes. Standard-region
  visitors do not see it. Failed/pending region resolution and GPC suppress the prompt and GA.
  Advertising still requires an explicit choice in every region; cookie-page controls remain
  available. This does not change the existing cookieless PostHog policy.
- Admin channel classification treats PostHog's `$direct` marker as direct and no longer
  classifies `accounts.google.com` as organic search. Explicit campaign UTMs retain priority.
- The durable business-event recovery worker now repairs missing `signup` receipts from
  committed accounts created within seven days, with a five-minute grace period and at most
  50 accounts per run. It preserves `User.createdAt`, existing first-touch fields, and the
  deterministic signup event ID. Unknown signup method is `otro`; preview history, pricing
  assignments and aliases are not fabricated. Existing receipts are never replaced.
- GA4 unwanted referrals must exactly match `accounts.google.com` and `checkout.stripe.com`.
  The active Ads purchase goal is the GA4 import; the obsolete website-only conversion is
  removed. These account settings are configured separately from application deployment.

Recent-event reconciliation and GA4 reports have different processing windows and consent
coverage. An accepted delivery is not proof of Google Ads attribution; validate that separately
against a genuine consented ad-origin purchase. Do not fabricate a click or purchase for QA.

First-touch attribution is independent of browser analytics consent. `Render` is the existing
preview AND model table; its ID serves as both `preview_id` and `model_id`. `Render` and `User`
receive ten nullable text columns, including an ISO UTC `first_seen_at`. No existing columns,
constraints or indexes change. The change is additive, so the deploy applies it without
`DB_ACCEPT_DATA_LOSS`.

The browser holds only normalized campaign/referrer values in module memory. Internal navigation
preserves them; reloads, new tabs and non-OAuth full navigations reset them. Neither attribution
nor PostHog uses cookies, localStorage or sessionStorage. A preview stores the supplied first
touch; signup copies the earliest owned anonymous preview or uses the form's memory snapshot.
An atomic all-columns-null predicate prevents overwriting an initialized user's first touch.
`first_seen_at` is server receipt time, not a client-controlled timestamp.

Google OAuth uses Better Auth 1.7's `addOAuthServerContext` / `getOAuthState` and database-backed
state. Only normalized data enters its existing `Verification` record, which expires and is
consumed on callback. Its existing signed CSRF cookie carries the opaque state nonce, not UTMs.
No attribution cookie is introduced. Anonymous preview ownership uses the existing ownership
cookie to authorize the handoff; the cookie does not contain attribution or identify analytics
visitors. The mock OAuth integration verifies the actual state, signed ID token and callback.

## Configuration

Set these in Vercel and rebuild; public variables are embedded at build time:

| Variable                        | Value source                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_POSTHOG_KEY`       | PostHog **EU** project settings → project API key (public write-only key, not a personal API key) |
| `NEXT_PUBLIC_POSTHOG_HOST`      | Default `https://eu.i.posthog.com`                                                                |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 property → Data streams → Web → Measurement ID (`G-…`)                                        |
| `POSTHOG_HOST`                  | Optional server-only override for a local capture recorder; leave unset in Vercel                 |
| `ANALYTICS_LOCAL_TEST`          | `1` only for a local `next start`; never set in Vercel                                            |

The internal `/admin/analytics` dashboard uses the same EU project and the following
server-only configuration (also declared in `.env.example` and `turbo.json`):

| Variable                   | Purpose                                                               |
| -------------------------- | --------------------------------------------------------------------- |
| `ADMIN_EMAILS`             | Comma-separated verified admin emails; empty denies everyone.         |
| `POSTHOG_PROJECT_ID`       | Numeric ID of the same EU project used by the public write key.       |
| `POSTHOG_PERSONAL_API_KEY` | Personal API key with only `query:read` for that project.             |
| `POSTHOG_API_HOST`         | Query API origin, default `https://eu.posthog.com`.                   |
| `ANALYTICS_EXCLUDE_EMAILS` | Optional team/test emails or `@domain` suffixes to exclude.           |
| `ANALYTICS_TZ`             | Reporting timezone, default `Europe/Madrid`.                          |
| `STRIPE_ANALYTICS_KEY`     | Optional restricted read-only key; falls back to `STRIPE_SECRET_KEY`. |

These host names serve distinct APIs: `NEXT_PUBLIC_POSTHOG_HOST` is ingestion,
`POSTHOG_HOST` overrides server ingestion for local QA, and `POSTHOG_API_HOST` is the
private query endpoint. They are not aliases. Never put the personal key in a public variable.
Missing query credentials show a not-configured state while database metrics remain available.
Anonymous admin requests redirect before initializing auth or querying the database; auth
failures also deny access. Admin routes stay noindex and excluded from sitemaps.
See [admin analytics](admin-analytics.md) for metric definitions and limits.

Missing keys disable PostHog. When `NEXT_PUBLIC_GA_MEASUREMENT_ID` is absent, Vercel production
builds use the public easyrender GA4 destination `G-H54Y1NW81X` (property `564217522`).
The existing variable overrides that default; an explicitly empty value disables GA4 after
a rebuild. Local and preview builds have no default destination. `VERCEL_ENV` is provided by
Vercel and included in the Turbo build environment/cache key. The exact canonical hostname
guard and consent checks still apply, so previews and localhost never send GA events.
Disabled GA4 also removes its reason to show a banner. The Google Ads base
tag from #96 remains independent of these keys and uses denied consent.
Sentry remains configured independently and unchanged.

In PostHog enable **cookieless mode** and **discard IP addresses** in project settings; set the
billing limit to zero if that is the intended account policy. In GA4 choose data retention,
disable Google signals and advertising personalization, and disable enhanced-measurement
history/pageview automation (the app sends sanitized SPA pageviews itself). Reuse the existing
Ads base tag; do not install another Google bootstrap.
No accounts, remote environments or account settings are changed by this implementation.

The editable policy is `packages/core/src/attribution.ts`: browser GA4 starts as `consent` in
strict regions and `allow_unless_optout` elsewhere, and GPC blocks it in either region. Browser
PostHog is `always` (Vincent's decision, 2026-11-12): it starts on load in every region, ahead
of the privacy lookup and the banner, and stays cookieless, memory-only, with no person
profiles. Rejecting the banner or sending GPC does not stop it. Server attribution/events are always enabled when configured. The #96 Ads base tag remains
loaded on the canonical hostname with advertising consent denied.
Unknown tools default to consent/off. Change the GA4 policy on its own row.

The privacy endpoint is dynamic, `Cache-Control: private, no-store`, and never varies the HTML
by analytics region. Missing/unreliable country codes are strict. Failure or a two-second
timeout starts no GA4, including for a previously accepting visitor; PostHog is unaffected. The Ads
base bootstrap still runs with denied consent.

Only preview or local/test environments honor `?__geo=DE`, `x-test-country: US`, and
`?__privacy_fail=1`. An explicit local flag enables these on a production-mode local server only
when it is not running on Vercel. `VERCEL_ENV=production` overrides every test flag. The browser
forwards test country headers for signup/uploads; the server ignores them in production.
Whether Vercel overwrites a client-supplied **real** `x-vercel-ip-country` header has not been
verified against Vercel. The app follows the documented platform-header contract.

## Shared Google bootstrap (#96)

`layout.tsx` keeps `easyrender-google-tag` with `beforeInteractive`. The unchanged
`lib/google-tag.ts` is the sole application-owned loader and sole Consent Mode v2 `default`
call: all four consent categories are denied before any external script. Its exact hostname
guard remains `easyrender.ai`; localhost, preview hosts and lookalikes load no Google tag.
The analytics client preserves the bootstrap's `dataLayer` and `gtag` and sends only consent
`update` commands. Strict EU/UK/CH/unknown regions stay denied until acceptance; US analytics
is granted unless rejected or GPC is present. Advertising storage, user data and personalization
always stay denied; `ads_data_redaction=true` and `url_passthrough=false` remain in force.
GA4 is configured once per document, only when the resolved measurement ID is nonempty and analytics is allowed.
GA URLs use the bootstrap's origin + pathname sanitization (no query or fragment, including
UTMs); PostHog still keeps allowlisted UTMs. Analytics events use `send_to` with the GA ID so
that they do not become Ads conversions through the shared queue.

**Loader exception verified with the real vendor runtime:** the existing
`gtm.js?id=AW-18570382360` processes `gtag('config', 'G-…', …)` by dynamically fetching one
`gtag/js?id=G-…&cx=c…` destination implementation. GA4 needs that destination code to collect;
the Ads-only runtime does not contain it. We do not inject a fallback or a second bootstrap.
Google's runtime deduplicates that destination fetch; the browser regression checks exactly one
Ads bootstrap and one GA destination fetch across repeated SPA pageviews, withdrawal and
reacceptance, with exactly one consent default. Thus there is one **application-owned loader**,
but two vendor script elements after GA is allowed. A literal one-script total is not claimed
for these separate destinations. Combining destinations would require Google account changes,
which this work does not perform. This follows Google's
[existing-tag configuration API](https://developers.google.com/tag-platform/gtagjs/configure).

The Ads base may make cookieless Ads requests under denied consent, independently of GA4.
Tests intercept these too; the earlier “no Google requests before choice/unset keys” assertions
now assert no PostHog/GA collection, no GA config or cookies, and the denied base tag instead.
`lib/google-tag.test.ts` is unchanged. No second `consent default` or `gtag('js')` is added.

## Events and payment truth

Core transitions emit `preview_start`, `preview_ready` / `preview_failed`, `render_start`,
`render_ready` / `render_failed`, `signup`, and `purchase`. Conditional database transitions
allow only one terminal winner under polling/webhook races. The closed failure code is
`generation_failed`; error messages, photos and prompts never enter analytics properties.
A disabled free-sheet pipeline (`SHEET_ENABLED=false`) has no angle-sheet start/finish events
until an explicit paid sheet generation starts. It still stores attribution on the draft row.

PostHog delivery is best effort, scheduled with Next `after()`. The server SDK loads only when
configured. Requests have a 1.5-second timeout and a 2-second shutdown deadline, with no retry
inside a user request. Attribution remains authoritative if analytics fails; there is no durable
analytics outbox. No delivery guarantee or live weekly reconciliation is implied by local tests.

Events have deterministic UUIDs per event and entity, and allowlisted common/properties only.
Server identifiers are the internal user ID or `pv_<preview-id>`; signup aliases the preview.
Geography on completion/payment events uses the stored creation context, not the webhook
provider's IP/location. No IP address is sent. PostHog browser `before_send` removes non-UTM
query parameters, fragments, page titles and click IDs; its public SDK project token is retained
because ingestion requires it. Browser imports happen after paint, outside the critical path.

A purchase is emitted only on a confirmed signed Stripe webhook, after granting credits and
claiming the pending→paid transition. Replays do not emit another event. Subscription invoices
are also recorded as purchases. Subscription `pack_id` and credits follow `planFromInvoice`
(the regular invoice line price, ignoring old-plan prorations, then main's metadata fallback);
amount comes from `invoice.amount_paid`, including zero, then the plan's current catalog price.
The purchase upsert uses a nonempty no-op update for a database-native atomic upsert during
concurrent deliveries. The existing ledger key and pending→paid claim still deduplicate credits
and the server event. Both synchronous and asynchronous checkout success are handled.
There is no refund webhook in this repository, so `purchase_refunded` is not invented.

GA mirrors `sign_up`, `preview_ready`, `render_ready`, `begin_checkout`, and confirmed `purchase`.
The return endpoint scopes purchases to the session owner; a `status=success` query alone cannot
produce a conversion. Subscription returns resolve their Stripe invoice read-only, then require
a paid database record. The browser deduplicates purchase transaction IDs within the page session.
GA receives no application user ID. Existing pricing/accounting is USD; the export and browser
return values use that currency. Multi-currency accounting would require storing currency on
Purchase before enabling multi-currency prices.

## Export (read only)

With an explicitly selected database URL in the environment:

```sh
bun packages/db/scripts/export-attribution.ts /absolute/output/directory team-user-id-1,team-user-id-2
```

The optional third argument marks team IDs as `is_test`; there is no email-based heuristic.
The script runs a repeatable-read, read-only transaction and writes `previews.csv`, `users.csv`,
`purchases.csv`, `renders.csv` with the exact §8 headers. It selects no email, name, photo, auth
credential or IP hash. Pending previews and payments are excluded. A ready preview that later
has a failed model remains a ready preview in the export. Model spends come from the ledger.
There is no refund handler today, so current completed purchases have `refunded=false`.
No export was run against a remote database during implementation.

## Local proof and failure reproduction

Use a throwaway local Postgres with the schema pushed. Never use a Vercel preview database:
previews share production storage and skip schema synchronization.

```sh
bun install --frozen-lockfile
# Set DATABASE_URL and TEST_DATABASE_URL to your local scratch database only.
bun run db:generate
bun run --cwd packages/db db:push
bun run --cwd packages/core test
bun run --cwd apps/web test
```

The core `analytics.integration.test.ts` uses real Postgres and actual core functions. Provider
and storage adapters are mocked. The case named **forced preview and model provider failures**
sets `provider.hasFailure=true`: upload/start fails without spending anything at Replicate.
The test verifies one failure per stage and the model credit refund. This is the supported
local failure mechanism; there is no public paid-provider failure switch. Signed webhook tests
use synthetic Stripe credentials and make no Stripe API calls. Live Stripe here is live-only;
never use a live checkout as a supposedly free test.

For browser proof, from the repository root fetch the public vendor runtimes once:

```sh
mkdir -p .data/analytics-merge2
curl -fsSL 'https://www.googletagmanager.com/gtm.js?id=AW-18570382360' -o .data/analytics-merge2/google-ads.js
curl -fsSL 'https://www.googletagmanager.com/gtag/js?id=G-TEST000000' -o .data/analytics-merge2/gtag.js
EVIDENCE_DIR="$PWD/.data/analytics-merge2" node apps/web/e2e/mock-server.mjs
```

Build/start on port 3100 with the local DB, an explicitly local test auth secret,
`BETTER_AUTH_URL=https://easyrender.ai`, `APP_URL=https://easyrender.ai`,
`NEXT_PUBLIC_POSTHOG_KEY=phc_localtest`, `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST000000`,
`POSTHOG_HOST=http://127.0.0.1:3901`, `ANALYTICS_LOCAL_TEST=1`. Then:

```sh
cd apps/web
EVIDENCE_DIR="$PWD/../../.data/analytics-merge2" node node_modules/@playwright/test/cli.js test --config e2e/playwright.config.ts analytics.spec.ts
```

`local-browser.ts` intercepts the canonical browser origin and proxies app requests only to
`127.0.0.1:3100` (or a loopback `ANALYTICS_BASE_URL`). No production app request is made; this
exercises the exact hostname guard without changing it. Vendor requests are intercepted and
fulfilled locally, including Ads endpoints; any other external request is aborted. The real
Ads and GA runtimes and npm PostHog SDK run. Automation detection is suppressed only in the
test browser. `GTAG_FIXTURE` and `GOOGLE_ADS_FIXTURE` can override the downloaded fixture paths.
Evidence defaults inside this worktree's ignored `.data/analytics-evidence`; `EVIDENCE_DIR`
overrides it. Stop the local server, recorder and throwaway Postgres and remove its `/tmp`
directory when finished.

Vitest's include list excludes Playwright, and database tests skip without `TEST_DATABASE_URL`.
Turbo's default test environment does not forward the scratch URL: run the per-package commands
above to exercise integration suites, in addition to `bun run test` for the normal CI gate.

Repeat a **separate build** with all three public analytics variables unset, start it, then run:

```sh
ANALYTICS_UNSET=1 node node_modules/@playwright/test/cli.js test --config e2e/playwright.config.ts unset.spec.ts
```

The unset build retains the denied Ads base on the canonical host but has no GA4 config,
PostHog loader or consent banner. Localhost and preview hostname suppression also have unit
regressions.

`e2e/performance.mjs` records five fresh-context samples: LCP and sum of long-task time above
50 ms over five seconds (a Playwright blocking-time approximation, not a Lighthouse audit).
Set `PERF_URL` and `PERF_LABEL`; use the same host, viewport and intercepted vendor fixtures.

## Existing cookies and legal gaps

`apps/web/proxy.ts` writes `er_anon` on first visit (HttpOnly, SameSite=Lax, Secure on HTTPS,
one year). `lib/actor.ts` reads it into the actor. Core render access and daily allowance checks
use `anonId`; the signup handoff uses that ownership proof. Without it an anonymous visitor
cannot reliably access or claim an earlier preview, and an anonymous request without another
actor identifier can fail the allowance check. It is never an analytics distinct ID.

This change **does not change that cookie's timing, lifetime or behavior**. Therefore the spec's
no-cookie-before-preview conditions V-09/V-31 are not claimed as passing. Existing language
preference and authentication storage also remain unchanged. `/cookies` is available in all six
locales and linked from every footer, the banner and auth forms. `/privacy` and `/terms` are not
published in this checkout. No legal entity, tax ID, address or privacy policy has been invented;
Jorge's approved legal text and the `er_anon` decision remain separate work.
