# Internal admin analytics

The internal dashboard starts at `/admin/analytics`. Its sections are Overview, Revenue,
Attribution, Funnel & cohorts, Product, ICP, and Data sources / health. Aggregation and source
adapters live in `packages/core/src/admin-analytics`; the Next.js layer supplies authentication,
caching, server rendering, and client charts. It does not change the Prisma schema, grant
credits, modify billing, or write to Stripe.

## Access and configuration

The proxy rejects missing session cookies without initializing auth or the database. Session
lookup failures also redirect to sign-in. It checks the Better Auth session and allowlist before response streaming, so an
unauthorized signed-in request receives a literal HTTP 404. The admin layout, every exported
data entry point, and the Refresh server action independently check the session before
entering a cache. `ADMIN_EMAILS` is a comma-separated allowlist,
trimmed and lowercased; unset or empty grants nobody access. An anonymous request redirects
to `/sign-in?next=...` with an admin return path; a signed-in user outside the list receives
404. Email/password sign-up does not verify addresses, so the guard also requires
`emailVerified = true`: otherwise anyone could register an allowlisted address that has no
account yet. In practice admins sign in with Google, which marks the email verified; an
unverified allowlisted account is redirected to `/sign-in/admin`, which explains verification and
offers a two-step recovery using the same Google address or a link to Account.
An existing unverified account must first explicitly connect Google while signed in, then
sign in with Google to verify the address. The page reads whether Google is already linked
and offers the appropriate step. Implicit linking of unverified accounts remains blocked.
The Google redirect callback requires the original live session and a matching, verified
provider email before linking; recovery sign-in applies the same checks before account writes,
so choosing another Google account cannot create a second user. Direct Google ID-token linking
is rejected in favor of the state/PKCE/nonce-protected redirect flow. This page independently checks
the session and allowlist. Google success returns to the original admin path and report filters;
OAuth failure offers a retry. Admin data, actions and APIs still require a verified email, and
non-admin sessions still receive 404 on pages. Google sign-in is only offered when configured.

`/admin` bypasses locale rewriting. Its layout declares `noindex,nofollow`; the proxy supplies
`X-Robots-Tag: noindex, nofollow` and `Cache-Control: private, no-store`. Robots disallows the
admin prefix for both general and named AI crawlers. The sitemap and LLM documents use
explicit public route/content lists, which contain no admin route. Public navigation has no
admin link. Recharts is imported only by admin components.

The admin route forces English. English and Spanish admin messages are supplied; the
German, French, Italian, and Portuguese catalogs contain English copies of this namespace
solely to preserve full message-key parity, not to claim translated admin interfaces.

All configuration is server-side. Set values in the deployment environment, never in source
control or a `NEXT_PUBLIC_` variable.

| Variable                                | Where to get it / behavior                                                                                                                                                                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_EMAILS`                          | Jorge chooses exact authorized email addresses. Empty denies everyone.                                                                                                                                                                                     |
| `ANALYTICS_EXCLUDE_EMAILS`              | Optional team/test email addresses and `@domain` suffixes, comma-separated. The admin allowlist is also excluded from metrics by default.                                                                                                                  |
| `ANALYTICS_TZ`                          | Optional IANA timezone; defaults to `Europe/Madrid`, including DST. Invalid values fall back to Madrid.                                                                                                                                                    |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Existing application database configuration. Local proof must use only its isolated local Postgres, never production.                                                                                                                                      |
| `POSTHOG_PROJECT_ID`                    | Numeric project ID from PostHog EU project settings.                                                                                                                                                                                                       |
| `POSTHOG_PERSONAL_API_KEY`              | Account settings → personal API keys; grant only `query:read` for the intended project. This is not the public ingestion token.                                                                                                                            |
| `POSTHOG_API_HOST`                      | Optional query API origin, default `https://eu.posthog.com`; the local fixture uses its local mock origin.                                                                                                                                                 |
| `STRIPE_ANALYTICS_KEY`                  | Preferred optional override: create a restricted read-only Stripe key. Allow reads for charges, payment intents, balance transactions, refunds, invoices, subscriptions, and customers, including expanded related objects. No write permission is needed. |
| `STRIPE_SECRET_KEY`                     | Existing billing key, used for analytics only when the analytics override is absent. Prefer the restricted override rather than reusing this broader key.                                                                                                  |

PostHog ingestion uses `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`;
`POSTHOG_HOST` overrides server ingestion for local QA only. These are separate from the
query API host and credentials above; see [analytics configuration](analytics.md#configuration).

The analytics Stripe client is separate from checkout so its restricted key cannot change
checkout behavior. It shares the existing SDK and key convention, with an eight-second
timeout and no automatic network retries. It lists charges, refunds, paid invoices, and
subscriptions; payment intents, customers, and balance transactions are used as related
objects/identifiers. Missing or failed external sources produce explicit unavailable states.

## Time, scope, and quality

Ranges are half-open `[start, end)`. Relative endpoints are rounded down to five minutes;
24h, 7d, 30d, 90d, and 12m use elapsed days (12m = 365 days). All starts at the earliest
user signup. A custom inclusive end date becomes the following local midnight, capped at
the current rounded endpoint. Custom ranges over ten years or invalid dates revert to 30d.
The previous period has the same elapsed duration immediately before the selected period.
Day and month buckets use local dates; weeks start Monday. Auto granularity is daily through
90 days, weekly through 180 days, then monthly. An explicit URL granularity overrides auto.
The Overview heading says per day/week/month to match the actual buckets. Range, granularity, and the include-team
toggle are URL parameters; table search, sorting, pagination, and multiselect filters are
local UI state.

Measured means a stored count or source amount. Proxy means a derived estimate, mutable
timestamp, inferred price, or incompatible populations. Unavailable is displayed as `—`,
not zero. Ratios with a zero denominator are unavailable. Delta is
`(current - previous) / abs(previous)`; an increase from zero has no finite percentage.
Costs, refunds, fees, failure rate, and generation duration use lower-is-better coloring.
Current subscription snapshots have no historical comparison and do not invent one.

The include-team toggle affects identified Postgres accounts and resolvable Stripe records.
Anonymous previews cannot reliably be excluded by email. Cookieless PostHog traffic/events
cannot be joined reliably to the exclusion list and remain unfiltered. With exclusions on,
Stripe records that cannot resolve to an included user via metadata or customer ID are
omitted; enabling team inclusion also admits these unresolved records. These scope
differences matter when reading conversion and reconciliation.

## Funnel mapping to stored data

| Step                 | Actual representation                                            | Timing and limits                                                                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visit                | PostHog `landing_view`; `$pageview` is a separate pageview count | Visits are landing events, not verified sessions or people.                                                                                                                                              |
| Signup               | `user.createdAt`                                                 | Counts new user rows in the period. No signup credit bonus exists.                                                                                                                                       |
| Anonymous preview    | `Render.userId IS NULL` and non-null `anonId`                    | Counts render rows created in the period, including failed/in-progress previews.                                                                                                                         |
| Angle sheet          | Non-null `Render.sheetKey`                                       | `preview_ready` alone is insufficient: when automatic sheets are disabled the initial upload can already have that status without a sheet. First sheet time is approximated by the render's `createdAt`. |
| 3D model             | `Render.status = 'ready'` and non-null `glbKey`                  | First model time is approximated by `updatedAt`; a USDZ download is not another generated model.                                                                                                         |
| PAYG purchase        | `Purchase.status = 'paid'`                                       | Uses `createdAt`, `packId`, `credits`, `amountCents`. Current checkout uses variable-credit `payg`, not a fixed pack catalog.                                                                            |
| Subscription payment | Paid `Purchase`, or legacy unlinked subscription grant           | `invoice.paid` stores the actual paid amount in a Purchase row. Only legacy grants without `purchaseId` infer the current catalog price; linked grants are never counted twice.                          |
| Current subscriber   | `user.subscriptionStatus` in `active`, `trialing`, `past_due`    | Uses `subscriptionPlan`; unknown legacy active plans follow billing's `pro` fallback. Stripe, when usable, supplies its current subscription records instead.                                            |

Lifecycle: an upload creates a `drafting` or `preview_ready` Render; a successful sheet
sets `sheetKey`; a paid build changes it to `rendering`; success sets `ready` and `glbKey`;
failure sets `failed` and refunds charged credits. The same row is reused. `startBuild`
and `startSheet` attach an authenticated `userId` while retaining `anonId`. Consequently
`anonId + userId` proves a claimed preview, **not** signup-time conversion. A trustworthy
anonymous-preview → signup rate requires a signup-time linkage event.

New successful 3D generations record an immutable `completedAt`. Older successes can have
no completion timestamp. There is no immutable sheet-ready timestamp. `updatedAt` also
changes for later edits, and a paid build can replace a sheet. Historical reports therefore
describe the current state of rows associated with the chosen period, not a replay of past
state. PostHog server events provide the future immutable-event cross-check.

### Organic landing cohorts

The Attribution section includes a separate organic-search landing table. Its population is
accounts that signed up inside the selected range and whose stored first touch classifies as
organic search. Each landing reports that same population's observed sheet ownership, dated
first/second model completions, and first/second positive payments before the range ends.
Model IDs and payment IDs are deduplicated; older signups and paid-search accounts cannot
inflate these counts. No new schema, consent behavior, client events or financial writes are
introduced.

Sheet ownership is a current-state proxy, not a historical preview-completion event. Undated
legacy model successes are reported separately and never given an invented completion date.
Payment timing and coverage inherit the selected financial source (including DB fallback
limitations). Counts are outcomes, not a required ordered funnel; a purchase can precede a
model. The table does not divide unrelated pageviews by signups. Recent cohorts have less
follow-up, and missing first-touch data cannot be reconstructed from this table.

## KPI definitions

Unless stated otherwise, activity counts renders by creation time and financial events by
their own event time. Activation and funnel counts instead use users who signed up in the
period and converted before its end. These populations must not be interchanged.

| Overview / Revenue metric | Definition, source, quality                                                                                                                                                                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visits / unique visitors  | `landing_view` count / sum of daily `$pageview` distinct-ID estimates from PostHog; proxy. Daily hashes do not identify unique people across days.                                                                                                                                                 |
| Signups                   | New user rows; measured.                                                                                                                                                                                                                                                                           |
| Sheet / model activation  | Signup-cohort users with a first sheet / ready GLB before the range end; activation percentage divides by signups. Stored ownership is measured, completion timing is proxy.                                                                                                                       |
| Paying customers          | Distinct identified users with a payment in the period. New payers have their earliest observed payment in the period; total payers have one before range end. Refunds do not erase payer status.                                                                                                  |
| Gross revenue             | Stripe successful captured charges by charge date, or paid DB purchases plus inferred legacy unlinked subscription invoices; measured with Stripe, proxy in fallback.                                                                                                                              |
| Cash refunds              | Successful Stripe refunds by refund date, including refunds for earlier charges. DB does not record reliable cash refunds; unavailable in fallback.                                                                                                                                                |
| Net revenue               | Gross minus period cash refunds. DB fallback assumes no observable refunds, so its net is a proxy, not verified net cash.                                                                                                                                                                          |
| Stripe fees               | Expanded balance-transaction fees when every selected charge has a fee in the charge currency; otherwise unavailable. Fees are separate from net and the margin estimate.                                                                                                                          |
| ARPU                      | Net / distinct identified users who created a render in the period. Render activity is an active-user proxy, not session activity.                                                                                                                                                                 |
| ARPPU                     | Net / distinct identified period payers.                                                                                                                                                                                                                                                           |
| Provider cost             | Sum of `Render.costUsd` for period-created renders, in USD; recorded cost, not an independent provider invoice audit.                                                                                                                                                                              |
| Gross margin estimate     | `(net USD revenue - provider cost USD) / net USD revenue`; proxy, excludes Stripe fees and other operating costs. No currency conversion is attempted.                                                                                                                                             |
| MRR / subscribers         | Current subscription snapshot by plan and currency. Stripe normalizes recurring intervals and quantities; trials count but have zero MRR. DB uses active/trialing/past_due user counts × current harness plan price, including trials, so it is a proxy. Neither source reconstructs historic MRR. |
| Credits sold              | Positive ledger deltas for `purchase` and `subscription`.                                                                                                                                                                                                                                          |
| Credits consumed          | Absolute sum of all negative ledger deltas; gross consumption before credit returns.                                                                                                                                                                                                               |
| Credits returned          | Sum of `render_failed` ledger deltas. These are credit refunds, not cash refunds.                                                                                                                                                                                                                  |
| Credits granted free      | Other positive ledger deltas, excluding `purchase`, `subscription`, and `render_failed`. Includes local development grants if their accounts are included.                                                                                                                                         |

Ledger reasons currently used by the application are `render`, `angle_sheet` (spending),
`render_failed` (credit return), `purchase`, `subscription`, `dev_purchase`, and
`dev_subscription` (grants). Development grants never become revenue. All plan amounts are
read from `SUBSCRIPTION_PLANS` in `@easyrender/harness`; historical list-price changes and
discounts cannot be reconstructed from ledger grants alone.

Revenue tables group orders and gross by date/product/currency, product, country, and new
versus returning customers. Product units are credited units in DB fallback; Stripe charge
records do not carry credit quantities, so their units are unavailable (`null` / `—`), not
zero. Missing Stripe fee data likewise remains unavailable. Average order is gross / orders. Country uses charge
billing country, then Stripe customer country, then deployed user `geo_country`, then
`unknown`. Top LTV is the top 100 users by **gross** observed lifetime payments through range
end, split by currency; it is not net lifetime profit. Refunds list Stripe refund events only.
Currency codes accompany amounts. Tables split currencies; charts and cohort/account
revenue use the first displayed currency, with a multiple-currency note. DB purchases preserve their charged currency; legacy unlinked credit grants remain a USD proxy.

## Overview time-series dictionary

The first Overview element after the header/navigation/controls is a fixed-height chart, above
every KPI card. Each local-calendar bucket in `ANALYTICS_TZ` gets one point; DB-backed gaps are
zero. Partial first/last buckets are included, and week buckets start Monday.

| Series                    | Definition                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visits                    | PostHog `landing_view` count, identical to Visits KPI, summed from local daily results. Unconfigured, failed or incomplete PostHog makes **every visit value null**, with no line and an inline legend note. A healthy source fills absent buckets with zero. Cookieless visits cannot exclude team traffic.                                                                                |
| Paying customers          | Distinct identified users with at least one successful payment in each bucket, across currencies. Repeated payments by the same user count once per bucket. Uses successful captured Stripe charges when usable, otherwise paid purchases (PAYG and subscriptions) plus legacy unlinked subscription grants with a recognized harness plan. Uses the same team scope as the revenue report. |
| Uses (sheets + 3D models) | Renders with a nonempty sheet key plus ready renders with a nonempty GLB key, both grouped by `Render.createdAt`, exactly like the Product section. A render may contribute both outcomes. Tooltip gives the split. Creation time and current outcome are proxies, not immutable completion events. Identified team activity follows the exclusion toggle; anonymous activity remains.      |
| Gross revenue             | Sum of gross payments per bucket in the first displayed currency, with the same Stripe-or-DB source selection as the existing revenue series. Before refunds and fees; tooltip explicitly says gross. Multiple currencies retain the existing first-currency note and separate revenue tables.                                                                                              |

New signups (new user rows in the bucket, same team scope) is available as a fifth series,
hidden by default. All four mandatory series start enabled. Toggle buttons expose pressed
state and permit focusing on individual series. Counts share the left **square-root** axis:
this keeps small customer counts readable alongside visits while preserving zero and showing
actual count tick labels. The description declares the scale; revenue uses a linear currency
axis on the right. Tooltips retain all four values even when lines are toggled off. The older
revenue/signup overlay remains below the KPIs for its previous-period comparison and disappears
when comparison is disabled. Loading, empty and error states reserve the same chart height.

## Attribution and weekly reading

Merged PR #88 (`a04a429`) adds ten nullable text columns to both
`user` and `Render`: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`,
`referrer`, `landing_path`, `first_seen_at`, `geo_country`, `consent_region_at_create`.
Runtime `information_schema.columns` detection requires all ten on each table. Reads of
these fields use tagged parameterized SQL; existing fields use the typed Prisma client.
Until both tables are ready, Attribution says:
**Attribution columns not deployed yet**. Other sections work.
This dashboard does not backfill or rewrite attribution.

Tables group first-touch user attribution by channel, source, medium, campaign, content,
referrer host, landing path, and country. `utm_term`, first-seen, and consent fields are
compatible schema inputs, not separate report dimensions. Each row shows period signups,
signup-cohort activation, all period payers and gross revenue attributed to that first
touch, visits when available, visit→signup, signup→payer, and revenue/signup. Thus revenue
may come from earlier signup cohorts. Signup→payer counts only the row's new signups that
paid in the period. PostHog visits match dimension values, not individual people, so these
joined conversion rates are proxies. Preview country counts use Render attribution.

Paid search is google/bing + `cpc`; paid social is meta/facebook/instagram/tiktok/linkedin +
`paid-social`. Closed tracking media keep gallery sharing, direct outreach (`directo`),
organic social, directories/MCP listings, AI assistants, communities, lifecycle email,
referrals, industry, and AI video distinct. `dir-*`, `ref-*`, `sec-*`, and `foro-*` sources
also map to their corresponding groups. Known search referrers without UTM are organic
search; known social referrers are organic social. AI host matching includes ChatGPT
(including its appended `utm_source=chatgpt.com`), Perplexity, Gemini/Bard, Copilot, Claude,
You, Phind, DeepSeek, Grok/X AI, Meta AI, Mistral, Poe, and Kagi. Other referrers map to
Referral; an absent referrer and absent UTM source/medium maps to Direct.

Signals are diagnostic: at least `SIGNAL_MIN_SIGNUPS` (20) and zero signup payers marks
no-payers; at least 20 and an above-average signup-payer rate marks above-average. They do
not implement experiment approval rules. UTM coverage is signups with both source and
campaign / all period signups; it is not an ads-only coverage rate. Campaigns, countries,
landing paths, cohort conversion, and reconciliation support the weekly reading. Ad spend,
CPC, platform clicks, experiment registry validation, minimum budgets/duration, and manual
outreach/video evidence remain in the external campaign tracker. Consent/blocker differences
make cross-market PostHog traffic comparisons unreliable.

## Funnel, product, and ICP

The funnel is visits → period signups → signup-cohort sheets → signup-cohort models →
signup-cohort payers. Each conversion is current step / preceding step; drop-off is one
minus conversion. Steps do not enforce chronological progression: a customer may purchase
before generating a model, so the display is a diagnostic funnel, not a path analysis.
Time-to-sheet/model/purchase is the median nonnegative time from signup to the earliest
observed qualifying record; render timestamps make generation conversion times proxies.

Weekly signup cohorts have one row per sheet/model/purchase outcome. Week 0–8 cells are
cumulative converted users / cohort users through the end of that local calendar cohort
week. Unfinished weeks are blank. Revenue is gross through the selected end, in the first
displayed currency, repeated across the three outcome rows rather than additive.

| Product / ICP metric                            | Definition and limits                                                                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sheets / models                                 | Period-created renders with a sheet / ready GLB. A model can count in both.                                                                                                                 |
| Status series                                   | Current ready/preview_ready, failed, or drafting/rendering states grouped by creation bucket.                                                                                               |
| Success / failure                               | Ready or preview_ready / terminal rows; failed / terminal rows. Terminal means ready, preview_ready, failed.                                                                                |
| Generation median / p90                         | Percentiles of `updatedAt - createdAt` for terminal period-created renders, in minutes, compared with the equivalent previous-period population; mutable lifecycle proxy.                   |
| Time to first model                             | Signup-to-first-ready-model median for period signup users, requiring the first-model proxy time before the period end. The previous value uses the previous cohort and its own end; proxy. |
| Source split                                    | Render rows, ready models, and recorded cost grouped by `Render.source` (web/mcp/api).                                                                                                      |
| Failure reasons                                 | Fixed timeout, validation, capacity, provider categories derived from upstream error text. Raw messages are never sent to the browser.                                                      |
| API keys created / used                         | Keys created in period / keys whose latest `lastUsedAt` is in period. Last-used is not an immutable API-usage log. No key hash or token is selected.                                        |
| Top accounts                                    | Top 100 period render users: email, renders, ready models, gross spent credits, gross first-currency revenue, latest render update. Admin-only.                                             |
| Actual catalog size                             | All-snapshot ready models per user: 1, 2–5, 6–20, 21–100, above 100. Does not count zero-model users or self-reported catalog items.                                                        |
| Public share                                    | Period-created ready models with `isPublic` / all period-created ready models.                                                                                                              |
| Cost per model                                  | All recorded period render cost / period ready models, including costs of previews/failures; proxy in USD.                                                                                  |
| Email domain type                               | Period signup emails compared with a fixed common free-mailbox list; other domains are company proxies, not verified businesses.                                                            |
| Company domains                                 | Top 25 non-free domain counts; this card shows no full emails.                                                                                                                              |
| ICP country / source / plan mix                 | User first-touch country, period render source, and current subscription snapshot. Missing country remains unknown.                                                                         |
| Business type, store platform, reported catalog | Not measurable: schema has no profile fields. Cards say a signup profile question is planned.                                                                                               |

## Source health, caching, and scale limits

Health reports configured state, last fetch time, row count, safe error messages, missing
variable names, truncation, and attribution availability per table. Reconciliation compares
PostHog server `signup`, `preview_start`, `preview_ready`, `render_ready`, and `purchase`
counts with DB proxies. The adapter also reads `preview_failed`, `render_start`,
`render_failed`; not all have an immutable DB equivalent. Purchase
reconciliation counts paid Purchase rows plus positive legacy subscription grants without a
`purchaseId`. #88 emits no `purchase_refunded` event, so the query does not invent one. A difference can reflect
team filtering, missing historical events, retries, or mutable timestamps; it is not proof
of data loss. No secret or raw API response is returned to a client.

HogQL uses whitelisted dimensions and validated UTC ISO boundaries and IANA timezone.
Each query is limited to 1,000 rows; reaching the limit marks the source incomplete and
withholds traffic totals. Requests time out after eight seconds. Stripe pagination is
bounded at ten 100-row pages per collection; a truncated/error response triggers DB fallback.
Stripe history is requested from `1970-01-01` through the selected end to identify first purchases; large
histories therefore reach the cap even for short report periods. Historical MRR still
cannot be inferred from current subscription status.

The current Postgres implementation deliberately uses a bounded in-memory snapshot rather
than SQL aggregation: at most 50,000 rows each from users, renders, purchases, ledger, keys,
and attribution tables, plus one sentinel row to detect overflow. Any overflow refuses the
entire report rather than publishing partial totals. The report identifies this separately
as `analyticsRowLimit` and marks Postgres truncated, rather than reporting a generic source
failure. It is a small-installation tradeoff;
larger installations need time-scoped SQL aggregates and dedicated first-event/cohort
queries. Selecting a shorter range does not evade the snapshot cap. PostgreSQL operations
are reads only.

Next `unstable_cache` caches each section/range/granularity/team scope for five minutes;
Stripe and PostHog entries use ten minutes. Configuration is part of the cache identity.
The attribution check and earliest signup are cached for five minutes. Refresh invalidates
the shared admin tag immediately after checking authorization. Private response caching
and server data caching are distinct: the browser response remains private/no-store.

Overview has independent Suspense boundaries for the leading time-series chart, database-only KPI cards, the external-source
report, and traffic. Signup, activation, preview, credit, and cost cards can therefore stream
while optional API requests are pending. Other sections use report-level Suspense; they do
not yet stream every source/card independently.

Every table sorts, searches, paginates at 12 rows, and exports exactly its visible page with
displayed headings/formatting. CSV quotes and line breaks are escaped; spreadsheet formula
prefixes are neutralized. It is a review export, not the full raw export specified for the
external measurement archive.

Local proof and release gates are recorded separately in the reviewer handoff report and
evidence directory. This document describes implementation and limitations; it does not
assert that screenshots, production build, performance checks, or final gates have passed.
