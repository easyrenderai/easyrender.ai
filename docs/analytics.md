# Analytics and attribution

## Checkout attribution and confirmed purchases

Checkout sends a bounded attribution allowlist through `/api/checkout` into Stripe Session
metadata (`at_*` keys). Landing paths exclude queries/fragments, referrers are domains, and
campaign values exclude URLs and email addresses. The server checks its own region, consent
cookie and GPC header before retaining browser identifiers or advertising click IDs. Locale and
pricing variant remain server-selected. Subscription metadata carries billing fields only;
renewals never inherit the initial browser session.

PostHog's `always` cookieless mode returns `$posthog_cookieless` and no browser session ID.
That sentinel cannot join webhook events to a visitor. The browser therefore uses two named
SDK instances: cookieless for the existing anonymous policy, and anonymous memory-only tracking
when the existing regional analytics permission allows identifiers. Only the permitted instance
can send. Neither stores SDK identifiers, creates person profiles, or identifies accounts. Session
replay is limited to an explicit analytics grant as described below. Withdrawal stops recording
and clears the consented in-memory identity. Events collected before a grant
remain cookieless; they cannot be retroactively joined to the consented checkout.

First touch uses the existing `er_campaign` sessionStorage record only when analytics storage is
allowed, including the standard-region default without a saved choice. The original landing and
campaign survive full navigations for thirty minutes without refreshing their expiry or replacing
them with an internal campaign. Rejected/required-but-not-given/GPC states use memory only.
Advertising IDs use the existing independently gated, expiring `er_ad_touch` record. No new
persistent storage or environment variable is introduced.

Paid webhooks preserve both `purchase` and `purchase_completed`. Each has one deterministic
PosthogDelivery row per Purchase; receipt payloads and paid timestamps are immutable on replay.
They include the checkout's `$session_id` and distinct ID when allowed, otherwise the existing
user-ID fallback, plus revenue, currency, plan, credits, Stripe session ID, locale, pricing variant,
first touch and Stripe billing country (`$geoip_country_code`, not the webhook IP). Validated
`gclid`/`gbraid`/`wbraid` values are retained only for purchases whose checkout allowed advertising;
other analytics events retain their existing click-ID redaction.

The owner-scoped confirmation endpoint returns the paid PostHog receipt only with current
analytics permission and strips click IDs without current advertising permission. The return page
captures `purchase_completed` using the receipt's UUID, distinct ID and original payment timestamp,
restoring the checkout session in `before_send` (the SDK otherwise overwrites `$session_id`).
These are the same deduplication fields as the webhook. A sessionStorage receipt also suppresses
poll/reload sends, with memory-only fallback when storage is unavailable. Build purchase dashboards
from **one** of the two compatible event names, never the sum of both.

GA4 uses the Stripe Checkout session ID as `transaction_id` for one-off and initial subscription
payments. `server_managed` suppresses browser GA4 measurement whenever a delivery or eligible
server checkout exists, including the paid-to-enqueue gap. Browser fallback purchases require
advertising permission; existing server GA4 analytics-only measurement and Google revocation
remain unchanged. Confirmed purchases also send the independent Google Ads website action
**7920733389**, "Compra Easy Render (etiqueta web)", through
`AW-18570382360/OC5ICM2Z88AdEJiYhpdF`. It requires current advertising permission and sends the
verified paid amount in EUR and Stripe Checkout session ID as `transaction_id`. It still sends
when GA4 is server-managed; a separate sessionStorage receipt deduplicates polling and reloads
(memory-only fallback if storage is unavailable). The GA4 import **7901516561** remains secondary
to avoid counting the same purchase twice in bidding goals. The new website action is also
secondary for now; account goal settings are managed separately, not by this code. No enhanced
conversions or email/user_data payload is added.

Recovery can retrieve Stripe metadata after a missed enqueue. First subscription invoices can
arrive before their Checkout Session links the invoice: attribution then waits for the checkout
webhook or recovery, rather than permanently recording an unattributed receipt. Stripe lookups
have bounded timeouts and do not undo a credit grant on analytics failure. Existing historical
receipts are not rewritten and past sessions without metadata cannot acquire browser attribution.

Relevant SDK contracts: [cookieless tracking](https://posthog.com/docs/privacy/data-collection),
[server session IDs](https://posthog.com/docs/data/sessions), and
[event deduplication](https://posthog.com/docs/data/events). Ingestion deduplication is eventual;
local tests verify payloads and receipt behavior, not production report attribution.

## Consent-gated session replay

Session replay is enabled only on `er_consented` after an explicit, current analytics acceptance,
with identity permission resolved and GPC absent. Advertising permission is not required. The
standard-region analytics default alone does **not** enable replay. `er_cookieless` always keeps
`disable_session_recording: true` and never calls `startSessionRecording`.

On the consented instance, `disable_session_recording` is false only when replay is permitted.
`startSessionRecording()` also resumes it after re-acceptance or returning to an allowed route;
it does not override remote sampling or project enablement. Withdrawal, disabling analytics,
leaving the analytics component, or entering an excluded route calls `stopSessionRecording()`.
The send guard drops queued `$snapshot` events when permission is absent. It changes state before
stopping because the installed SDK can flush during teardown. We deliberately do not call the
SDK's persistent opt-in/opt-out APIs, which can write their own consent record.

`isMailingTokenLocation` excludes token links, including invites nested in `next`. Admin, account,
checkout/billing, email, authentication and OAuth routes are also excluded (including locale
prefixes). SDK history pageviews and React route changes recheck the URL; unmount cleanup stops
the recorder on private pages. Snapshot sends recheck the current route and consent too.

Local recorder configuration masks every input, DOM text (`maskTextSelector: '*'`) and string
attribute. It blocks forms, file inputs, editable areas, mailto links, explicitly private/sensitive
elements and media/iframes. This intentionally reduces replay visual fidelity to protect account
details, email addresses and customer uploads. Console, request bodies/headers, canvas and JSON-LD
capture are disabled. The recorder URL hook removes query strings/fragments, rejects excluded
locations and drops network request payloads. Do not loosen these settings remotely or assume
ordinary event sanitization masks rrweb snapshots.

Verified against installed `posthog-js` **1.447.12** in `node_modules`: `sessionid.js` creates a
session manager for memory persistence, but not for `cookieless_mode: 'always'`.
`startSessionRecording()` sets `disable_session_recording: false`; `session-recording.js` waits
for remote replay enablement before loading the recorder. Memory persistence does not write
session/window IDs or park replay buffers in sessionStorage, so full document navigation starts
a new recording session. SDK and lifecycle tests validate these contracts without contacting
PostHog; they do not prove production ingestion or a playable production recording.

CSP review: `apps/web/next.config.ts` currently defines only `frame-ancestors` policies for OAuth
and Shopify. There is no `default-src`, `script-src`, `connect-src` or `worker-src` restriction in
the repo, so no CSP change is needed. If a restrictive policy is added later, validate the EU
PostHog ingestion/assets and recorder worker requirements (including `blob:` where used).

**Privacy copy review required before release:** the existing `Analytics.posthog`, `Analytics.withdraw`
and `Legal.privacy.sections.cookies.body` in all six `apps/web/messages/*.json` describe
PostHog collection/withdrawal without disclosing consented session replay. They need factual
review covering replay, masking, route exclusions and stopping on withdrawal. No public copy or
legal claims are changed in this PR; this note is not a legal policy draft. The project setting
for PostHog project 347125 was reported enabled by the requester, not changed by this PR.

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
  The historical GA4-only purchase setup is superseded by the website action documented above.
  Keep the GA4 import secondary; account settings are configured separately from deployment.

Recent-event reconciliation and GA4 reports have different processing windows and consent
coverage. An accepted delivery is not proof of Google Ads attribution; validate that separately
against a genuine consented ad-origin purchase. Do not fabricate a click or purchase for QA.

First-touch attribution is independent of browser analytics consent. `Render` is the existing
preview AND model table; its ID serves as both `preview_id` and `model_id`. `Render` and `User`
receive ten nullable text columns, including an ISO UTC `first_seen_at`. No existing columns,
constraints or indexes change. The change is additive, so the deploy applies it without
`DB_ACCEPT_DATA_LOSS`.

The browser holds normalized campaign/referrer values in module memory, with consent-gated
sessionStorage retention described above. A preview stores the supplied first touch; signup copies
the earliest owned anonymous preview or uses the form's memory snapshot.
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

`layout.tsx` keeps `easyrender-google-tag` with `beforeInteractive`.
`lib/google-tag.ts` is the sole application-owned loader and sole Consent Mode v2 `default`
call: all four consent categories are denied before any external script. Its exact hostname
guard remains `easyrender.ai`; localhost, preview hosts and lookalikes load no Google tag.
The analytics client preserves the bootstrap's `dataLayer` and `gtag` and sends only consent
`update` commands. Strict EU/UK/CH/unknown regions stay denied until acceptance; US analytics
is granted unless rejected or GPC is present. Advertising storage and user data follow the
separate advertising permission; personalization always stays denied and `url_passthrough=false` remains in force.
GA4 is configured once per document, only when the resolved measurement ID is nonempty and analytics is allowed.
GA4 `page_location` (config, pageviews and the global `set`) keeps allowlisted `utm_*`
parameters. Browser events retain the first-touch campaign across navigation. Valid Google click
IDs are included only while advertising measurement is allowed; emails, tokens, unrelated query
parameters and fragments are removed. The denied-consent bootstrap keeps UTMs but no click IDs.
Analytics events use `send_to` with the GA ID so that they do not become Ads conversions through
the shared queue.

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

PostHog events are persisted in the durable PosthogDelivery outbox before scheduling delivery
with Next `after()`. Delivery leases, retry limits and retention are defined in
`packages/core/src/posthog-outbox.ts`; recovery repairs missing receipts from committed business
facts. Local tests do not imply a production delivery or attribution guarantee.

Events have deterministic UUIDs per event and entity, and allowlisted common/properties only.
Server identifiers are the internal user ID or `pv_<preview-id>`; purchases use a permitted
browser distinct ID when available. Signup aliases the preview. Render geography uses stored
creation context, and checkout purchases prefer Stripe billing country, never the webhook IP. No IP address is sent. PostHog browser `before_send` removes non-UTM
query parameters, fragments, page titles and click IDs, including on browser purchase events;
its public SDK project token is retained
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
a paid database record. The browser deduplicates purchase transaction IDs across reloads within
the tab session. GA receives no application user ID. Amount and currency come from the paid
Purchase snapshot; analytics does not change checkout prices or convert the charged currency.

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

The opt-in browser proof for consent and the Google/PostHog runtimes (`analytics.spec.ts` and `unset.spec.ts`, with their mock server and `performance.mjs`) was removed on 2026-11-20: it needed two dedicated builds and vendor scripts downloaded into `.data`, so it never ran in CI. It remains in git history before that change. Consent behaviour keeps its unit regressions.

Vitest's include list excludes Playwright, and database tests skip without `TEST_DATABASE_URL`.
Turbo's default test environment does not forward the scratch URL: run the per-package commands
above to exercise integration suites, in addition to `bun run test` for the normal CI gate.

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

## First-touch pageviews and automation

PostHog's `before_send` attaches the five first-touch `utm_*` properties to every browser event,
including a `$pageview` emitted during SDK initialization before `landing_view`. Later history
changes retain the original campaign. The existing cookieless, memory-only and no-person-profile
settings are unchanged. Raw click IDs stay out of browser PostHog payloads and their URLs.

The Google bootstrap and browser analytics initialization share the home redirect's bot detector.
They skip empty user agents, known crawlers, HeadlessChrome, Playwright, Puppeteer, Selenium,
PhantomJS and `navigator.webdriver === true`. Ordinary Linux Chrome and Firefox, and Safari,
remain eligible under the existing consent policy. This is a known-automation filter, not a way
to identify crawlers that present themselves as ordinary browsers. Historical data is unchanged.

Language-home, canonical-host, pricing-path and legacy guide redirects preserve attribution query
strings. Guide aliases resolve in the proxy before the cached page's path-only redirect.
