# Google measurement: delivery and release checks

The Google tag remains the only browser loader. Its initial consent is denied, with query and
fragment redaction. The choices are **Analytics only**, **Analytics + ad measurement**, and
**Reject optional**, with equal visual treatment. Existing analytics acceptance remains
analytics-only. Advertising is never inferred from country, analytics acceptance or a checkout
request body. Google Signals and advertising personalization remain disabled in every state.
The existing regional GA4 policy and independent cookieless PostHog policy are unchanged.

After explicit advertising consent, with GA4 permitted and GPC absent, the browser grants
`ad_storage` and `ad_user_data`. Only validated `gclid`, `dclid`, `gbraid` and `wbraid` values can
be added to Google's otherwise-redacted page location. No email, token, arbitrary query field
or fragment accompanies them. Those click IDs never enter PostHog or operational attribution
records. The app's `er_ad_touch` session record expires after a fixed 30 minutes, without extending
on navigation; an expiry timer deletes it while the page stays open and stale records are
removed on a later load. Captured IDs are removed from the address to prevent a reload renewing
the app's retention. Google may also maintain its own conversion-linking cookies and `_gcl_ls`
storage under the granted consent; that Google-managed storage is distinct from the app's
30-minute record. See [Google's conversion-linker documentation](https://support.google.com/tagmanager/answer/7549390).

Reject, GPC and advertising withdrawal clear app click attribution and accessible `_gcl_*`
cookies / `_gcl_ls` storage. Full rejection also clears GA cookies and `er_campaign`. Changing
from ad measurement to Analytics only immediately stops optional sends and conservatively
revokes pending authenticated server checkout contexts, then allows analytics to resume. Already
sent events cannot be withdrawn by this control. A logged-out browser cannot revoke contexts
belonging to a previous signed-in account.

This is an implementation of consented measurement, not proof of real Ads attribution. The
permitted real-click and paid-purchase verification below remain release gates.

## What is a conversion?

- `sign_up`: a short-lived, owner-scoped receipt written by the real account-creation hook.
  `/api/analytics/signup` consumes it atomically after analytics is allowed. A login or an
  OAuth query parameter is not a signup. Receipts expire after 24 hours. Claim-before-send
  prefers missing an interrupted delivery over inventing or repeating a registration.
- `preview_ready` / `render_ready`: browser observations of a transition, not an initial
  snapshot of an existing result. These remain secondary diagnostics: browser observation
  can miss background completion and cannot provide globally exactly-once lifecycle counts.
  PostHog server transitions and the database remain authoritative for product usage.
- `begin_checkout`: amount, currency and assigned pricing variant from the server-selected
  checkout, not a USD price guessed by the component. The core URL-only API is preserved.
- `purchase`: an owner-scoped paid Purchase. Browser fallback uses `transaction_id` and the
  stored charged amount/currency. It never treats a success query parameter as payment proof.

## Optional server purchase delivery

All of the following are required in the Vercel **production** environment:

| Variable                    | Value / purpose                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `GA_MEASUREMENT_ID`         | Same G-… ID as the website stream; easyrender uses G-H54Y1NW81X.                   |
| `GA_MEASUREMENT_API_SECRET` | Measurement Protocol secret created for that exact web stream. Server only.        |
| `CRON_SECRET`               | A random secret used by Vercel to authorize scheduled retry requests. Server only. |

Deploy after configuring variables. With no Measurement Protocol secret or outside Vercel
production, server delivery is disabled and browser fallback continues. Do not set
`VERCEL_ENV=production` locally against real destinations.

The browser asks gtag for `client_id` and `session_id` only while GA4 is allowed. A bounded
one-second timeout cannot indefinitely hold up checkout. The checkout route independently
checks regional consent/GPC and the measurement-ID match before storing `GoogleCheckout`.
Its `adMeasurementAllowed` field is derived from the explicit consent cookie; the browser body
cannot grant that permission. Existing rows default to false. Server purchase payloads grant
`ad_user_data` only for a permitted, non-revoked stored context, and always deny personalization.
No Google measurement identifiers are added to Stripe metadata. Context is eligible for a
payment within 72 hours of checkout creation. Automatic subscription renewals are not
assigned the initial checkout's advertising session.

Signed Stripe webhooks connect paid purchases to that context and upsert one
`GooglePurchaseDelivery` per purchase. Both invoice-before-checkout and checkout-before-
invoice ordering converge on the same record. Replay repairs a missed enqueue; credit grants
retain their existing idempotency keys. The two new tables are additive; deployment performs
the normal Prisma sync, never a laptop production schema push.

Delivery runs after the webhook and through the existing five-minute `/api/cron/renders`
schedule. `/api/cron/analytics` remains a daily 04:00 UTC fallback and an authenticated manual
recovery endpoint. Both destinations recover independently: an analytics outage cannot fail
render maintenance. Each destination processes at most five batches of ten rows, stops starting
batches after 25 seconds, uses a five-second transport timeout and one-minute token-fenced
leases. Backoff starts at one minute and caps at one hour; the five-minute schedule determines
the earliest automatic retry. Transport failures stay pending; Google events older than 72
hours expire. The real deployment must support and run the existing five-minute schedule.

`Purchase.paidAt` is set once from the signed Stripe event time (the invoice's paid transition
when available), so replay cannot shift the conversion date. Google uses this timestamp;
legacy rows without it retain their explicit legacy fallback. Successful HTTP transport is
**not** proof of valid GA4 ingestion or Ads attribution. Google's session-attribution window
is distinct from its event-backdating/export limits. Use validation/reporting and a permitted
actual advertising interaction to verify the latter.

The authenticated maintenance response exposes aggregate queue counts, oldest pending age,
expired/dead counts and sanitized failures, never identifiers or payloads. Monitor sustained
pending age and failures; an HTTP 200 alone does not prove all destinations succeeded. After
30 days beyond checkout expiry, up to 100 measurement identities per run are cleared; minimal
transaction delivery receipts remain so an old return page cannot fabricate another fallback.

## PostHog business delivery

Server business capture now awaits a safe durable enqueue before returning, and defers only
the external delivery. `PosthogDelivery` stores the stable event UUID, original occurrence
time, internal subject/account identity and sanitized payload (maximum 16 KiB). Replay keeps
the original payload/time. Network failure leaves a pending row; a replacement worker's lease
cannot be acknowledged by a stale worker. Internal identifiers remain subject to the existing
server-event policy; emails, prompts and source URLs are not introduced into this queue.

The same five-minute maintenance reconciles missing successful model, preview and paid-purchase
events from immutable business facts, at most 50 of each per run over the previous seven days.
Indexed anti-joins skip events already queued. Recovery never grants credits or starts providers.
New previews record `previewCompletedAt`; completed models use `completedAt`, paid purchases
use `paidAt`. First-purchase ordering uses paid time (immutable creation time only for legacy
ordering); money always comes from the stored purchase currency/amount. Undated legacy purchases
are not assigned a new PostHog occurrence time; signed replay may supply their original paid time.
Existing rows without known timestamps stay unknown; redraws do not invent a
historical preview date. Recovery keeps stored first-touch attribution and omits transient
properties whose original value cannot be reconstructed. Signup/start/failure events remain
recoverable once enqueued; they do not have an immutable-fact reconciliation path.

PostHog events expire after seven days or the attempt limit; delivered/dead payloads are
removed after 30 days in batches of 100. Delivery is at least once with stable UUID deduplication,
not an end-to-end exactly-once claim. The reconciliation counters count examined candidates,
while the queue health reports actual pending/dead rows. A DB-wide outage still requires
operational recovery; safe analytics errors never undo a successful payment/render.

The return-page fallback suppresses purchases managed by the outbox. Any uncertain transport
retry uses the same `transaction_id`; a backend delivery claim also prevents concurrent
workers from sending the same row normally. This is at-least-once delivery, not a claim of
perfect end-to-end exactly-once processing.

Reject/GPC requests revocation of pending checkout contexts for the current signed-in user.
This cannot undo events already sent. A logged-out browser cannot revoke contexts belonging
to a previous authenticated account through that endpoint; production QA must include the
normal signed-in withdrawal flow. No event is sent for checkouts without eligible consent
and browser identifiers. Do not compare covered GA purchases with all Stripe orders without
accounting for these exclusions.

## Production status (2026-11-13)

- Vercel Production has `GA_MEASUREMENT_ID` (G-H54Y1NW81X), `GA_MEASUREMENT_API_SECRET` (sensitive,
  created for web stream 16335202450 of property 564217522) and `CRON_SECRET` (sensitive). They take
  effect with the next production build.
- The exact `purchase` payload built by `googlePurchasePayload` was sent to GA4's debug endpoint
  (`/debug/mp/collect`) for `G-H54Y1NW81X` and returned no validation messages. That endpoint
  records nothing and does not check the secret, so a real purchase is still the only proof of the
  secret and of Ads attribution.
- `/api/cron/analytics` answers 401 without `Authorization: Bearer $CRON_SECRET`. Schedule is daily
  at 04:00 UTC.
- `/admin/analytics` access is the exact-match `ADMIN_EMAILS` list in Vercel Production (two admins:
  Jorge and Vincent). Vercel reads it at build time, so a change needs a new CI build.
- Still to do: an approved real purchase (check transaction ID, amount, currency in GA4), consent
  withdrawal on a signed-in session, Ads attribution, and the PostHog read-back in `/admin/analytics`.
  Campaigns stay paused until these pass.

## Operational release gate

1. Set the three server variables and deploy. Keep campaigns paused.
2. Validate a consented payload against the **matching** GA4 stream without counting a fake
   purchase. A real charge needs separate authorization; local tests use signed mock webhooks.
3. Exercise signup versus existing login, reject/GPC, private URL parameters, stale renders,
   USD/EUR checkout, delayed webhook, duplicate webhook, both subscription webhook orders,
   and a transport failure/retry. Check that local/preview cannot send server events.
4. Verify the imported GA4 purchase action in Google Ads. Only one purchase action should be
   primary; the original unused manual website action should be secondary.
5. Verify a real, authorized purchase end to end and an eligible advertising interaction
   separately. No pageview or synthetic zero-value purchase substitutes for this check.
6. Monitor the authenticated maintenance response, pending ages, `lastError`, attempts and
   expired/dead rows. Confirm the five-minute production schedule actually runs and that
   missing terminal events reconcile with their original timestamps. Signup/start/failure
   gaps before enqueue still require separate recovery evidence.

The PostHog policy is unchanged: cookieless browser analytics and operational server events
remain active independently of optional Google consent. All six locale descriptions explain this.
