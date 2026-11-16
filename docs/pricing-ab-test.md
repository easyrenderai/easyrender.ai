# Pricing A/B test — November 2026

Status (2026-11-14): **wired, waiting for the PostHog flag.** The four `*_TEST` Stripe prices exist in the live account (each with EUR `currency_options`), and the production Vercel variables are set: the four `STRIPE_PRICE_*_TEST` IDs, `POSTHOG_PROJECT_ID`, `POSTHOG_API_HOST`, `POSTHOG_PERSONAL_API_KEY` and `PRICING_AB_ENABLED=1`. Until the `pricing-test-2026-11` flag exists and is enabled in PostHog, every visitor stays on control. Next: create the flag (50/50, 100% rollout), check checkout for both arms, then switch it on.

## Three public options and existing subscribers

Public pricing, the home teaser, Credits, MCP and structured offers sell **Pay as you go, Pro,
and Enterprise**. Free previews remain available through “Try it free” without a card. Pro keeps
its name in EN/ES/DE/FR/IT/PT and its existing Stripe price: control $49 (EUR €46) for 5,500
credits/month, $0.008909 per credit (€0.008364). Creator's old control rate is $19/2,000 =
$0.0095, so retaining Pro preserves the better value. If the existing experiment is enabled,
Pro remains $79 (EUR €74) for 4,500 credits, $0.017556 (€0.016444) per credit.

`PUBLIC_PLAN_IDS` controls new sales; `PLAN_IDS` still includes Creator and Scale for invoices,
portal changes, account status and historical reporting. New checkout requests for Creator or
Scale are rejected. Existing subscriptions and already-created Stripe sessions still receive
credits through their original price IDs and variant. No subscription is migrated or repriced.
Keep all old price environment mappings, including `*_TEST`, for renewals. Existing free
accounts retain previews and their balance; there never was a recurring Free Stripe product.
Scale is now a legacy billing plan; new high-volume buyers contact Enterprise.

No manually provisioned Stripe product or price, new environment variable or schema is required. Before merging, review
the existing billing portal configuration: keep payment management and cancellation available,
and remove Creator/Scale from **new plan-switch destinations** if switching is enabled. Do not
archive their prices or cancel existing subscriptions. No live settings were changed by this PR.

### Monthly subscriber top-ups

Active and trialing subscribers buy extra credits at **their existing plan's exact per-credit
rate**. The server reads the user's linked subscription from Stripe on both quote and checkout,
including when the DB's last status webhook is stale. The actual subscription item price ID
selects Creator, Pro or Scale and control/test; stale metadata and the current pricing flag cannot
change that contract. Unknown/unavailable or unlinked live contracts fail closed. Local simulated
checkout uses the DB plan/status only. `past_due`, `canceled`, `incomplete`, `incomplete_expired`,
`unpaid` and `paused` do not qualify. An active subscription scheduled for cancellation qualifies
until its status changes; `past_due` still retains portal access and duplicate-plan protection.

| Plan             | Control USD / credit | Control EUR / credit | Test USD / credit | Test EUR / credit |
| ---------------- | -------------------: | -------------------: | ----------------: | ----------------: |
| PAYG             |            $0.010000 |            €0.010000 |         $0.020000 |         €0.020000 |
| Creator (legacy) |            $0.009500 |            €0.009000 |         $0.018125 |         €0.016875 |
| Pro              |            $0.008909 |            €0.008364 |         $0.017556 |         €0.016444 |
| Scale (legacy)   |            $0.008278 |            €0.007722 |         $0.016583 |         €0.015417 |

Table rates are approximate. The shared harness calculates
`round(credits × plan.priceCents / plan.monthlyCredits)` using the appropriate fixed USD/EUR
catalogue, rounding once, half up, for the whole purchase. For 1,000 control credits, Pro pays
$8.91/€8.36, Creator $9.50/€9.00, Scale $8.28/€7.72; PAYG still pays $10/€10.
The 500–100,000 credit bounds and non-expiring balances are unchanged.

`PaygPicker` → `POST /api/checkout` → `createCheckoutDetails` creates `mode: payment`.
Eligible subscribers use server-computed inline `price_data`, `unit_amount` equal to the rounded
pack total, and `quantity: 1`. Stripe creates inline price/product data during checkout; there
are **no new manually configured products, price IDs, env vars or schema changes**. Existing
`STRIPE_PRICE_CREATOR/PRO/SCALE` and `*_TEST` mappings identify contracts; keep all of them.
Non-subscribers keep the existing `STRIPE_PRICE_PAYG`/`STRIPE_PRICE_PAYG_TEST` and credit quantity.
Adaptive Pricing remains off. Subscribers retain their subscription currency (USD/EUR), including
when traveling or when the EUR visitor kill switch changes; PAYG retains the existing buyer and
Stripe-customer currency logic.

Credits/account and the six localized pricing pages share the same server quote and display
rounded preset pack prices plus the plan-rate hint. The UI sends its displayed amount/currency
only as a stale-page guard: mismatches return 409 and request refresh. Client-supplied rates,
plan claims or amounts never set the charge. Subscription state is re-read at checkout; an
already-created session retains its quoted price even if the subscription changes afterward.

The server snapshots credits, rounded amount and currency in `Purchase`; discounted purchases
use `topup_<plan>[:test]` for correct USD list-revenue reporting. Session metadata also records
the credits and plan for support. Signature-verified completed/async-success webhooks require
paid status, and discounted top-ups additionally require the stored amount/currency/owner to
match. They grant the **stored credits**, never the amount paid or metadata quantity, through
`credits.ts`'s transaction/ledger and `stripe:<session id>` idempotency key. Replay, delayed
payment, cancellation and elapsed time do not add credits twice or expire them.

No live Stripe settings or charges are needed for this follow-up. Keep the existing webhook
and plan mappings. The previously requested billing-portal review still applies before merge.

## Price catalogue

`packages/harness/src/pricing.ts` owns both catalogues. Render deductions remain **64 credits**; free previews and their daily limits are unchanged. Previously purchased credits still buy exactly the same renders. No balance conversion, credit expiry, or Prisma schema change is involved.

| Offer              | Control                  | Test                     |
| ------------------ | ------------------------ | ------------------------ |
| New PAYG credit    | $0.01                    | $0.02                    |
| Model at PAYG rate | $0.64                    | $1.28                    |
| Minimum purchase   | 500 credits / $5         | 500 credits / $10        |
| Maximum purchase   | 100,000 credits / $1,000 | 100,000 credits / $2,000 |
| Creator (legacy)   | $19 / 2,000 credits      | $29 / 1,600 credits      |
| Pro / month        | $49 / 5,500 credits      | $79 / 4,500 credits      |
| Scale (legacy)     | $149 / 18,000 credits    | $199 / 12,000 credits    |
| Enterprise         | Book a call              | Book a call              |

The target was approximately $1.20/model. Two whole cents per credit yields $1.28, keeps Stripe quantities and the $10 minimum exact, and preserves all existing credits' purchasing power. Raising render deductions would devalue existing balances. Test plan effective model rates are $1.16, approximately $1.124, and $1.061; their monthly allocations buy 25, 70, and 187 whole models respectively, with leftovers rolling over. The control cost-plus-70%-margin calculation still determines render credits. The test deliberately experiments with the selling price of new credits, rather than provider costs.

## Assignment and consent

The server reads the flag definition from PostHog's management API, then uses PostHog's SHA-1 percentage/variant hash locally. No visitor identifier is sent to PostHog to evaluate pricing. Only one property-free release condition is supported; targeting properties, multiple conditions, group targeting, forced variants, malformed variants, and unavailable flags fail closed to control.

The existing HttpOnly `er_anon` first-party preview cookie supplies the visitor seed. On the account's first experiment request (including email or Google signup), an atomic upsert binds that seed to the account. With no visitor cookie, the account ID supplies the seed. The binding lives in the existing `Verification` key/value store under `pricing-test-2026-11:identity:<userId>`, using its primary key for concurrency safety, with a one-year expiry. This is a separate namespace from authentication tokens and OAuth state. There is no schema migration. A later device uses the stored seed. Clearing cookies before signing in creates a new anonymous visitor, as expected.

Keep the variant weights/order and rollout fixed during measurement; deterministic assignment does not mean weights can change without moving people. Keep the experiment shorter than the binding TTL. To remove this experiment later, delete only its namespaced identity records after the reporting retention period.

Price assignment works with analytics declined, strict-region consent pending, GPC enabled, or browser analytics blocked. The existing PostHog cookieless/memory initialization and GA4 Consent Mode remain in place. No extra SDK, analytics cookie, localStorage, or identify call is added.

A SHA-256 `pricing_subject` property joins consented browser exposure/checkout events to authoritative signup/purchase events without exposing the original visitor/account ID. It is a persistent pseudonymous analytics join key, emitted by browser analytics only when the existing consent policy permits tracking. Server business events retain the existing server analytics policy. Do not treat non-consenting traffic as measured visitors. Cookie-policy copy describes the functional pricing use of `er_anon` and the consented join key.

## Vercel environment

Existing variables needed:

- `NEXT_PUBLIC_POSTHOG_KEY`: project **347125**'s public project key.
- `NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com`: EU event ingestion.
- `POSTHOG_PERSONAL_API_KEY`: server-only key with `feature_flag:read` for project 347125. Never expose it with `NEXT_PUBLIC_`.
- `POSTHOG_PROJECT_ID=347125`.
- `POSTHOG_API_HOST=https://eu.posthog.com`: EU management API, distinct from ingestion.
- Existing Stripe secret/webhook secret and control `STRIPE_PRICE_PAYG`, `STRIPE_PRICE_CREATOR`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_SCALE`.
- Existing `NEXT_PUBLIC_GA_MEASUREMENT_ID` for GA conversion reporting.

New variables (documented in `.env.example`, covered by `turbo.json`):

- `PRICING_AB_ENABLED=0` initially; only `1` enables flag evaluation in that deployment.
- `STRIPE_PRICE_PAYG_TEST`: active USD **2-cent** one-time, per-unit price; quantity is credits.
- `STRIPE_PRICE_CREATOR_TEST`: active USD **2900-cent** monthly price.
- `STRIPE_PRICE_PRO_TEST`: active USD **7900-cent** monthly price.
- `STRIPE_PRICE_SCALE_TEST`: active USD **19900-cent** monthly price.

Monthly prices must be licensed, per-unit, interval `month`, interval count `1`, and have no quantity transform. Create separate immutable Stripe price IDs; don't edit the control IDs. Checkout retrieves and validates the configured price against the assigned catalogue and refuses a mismatch. Adaptive Pricing is disabled so checkout stays in USD. No client amount, credit allocation, or requested variant determines the charge. The browser's `x-pricing-variant` is only a stale-page check: a disagreement returns 409 and asks for a refresh.

Keep both sets of Stripe IDs configured after stopping the experiment: invoices, portal changes, and renewals use the actual price ID, never the current feature flag. Test purchases snapshot `:test` in the existing `Purchase.packId`; control/legacy purchase IDs keep their current format. Checkout and subscription metadata contain `pricing_flag` and `pricing_variant`. Credit grants still go through the transactional ledger and webhook replay protection.

Configure Stripe's billing portal deliberately: either keep subscription switching disabled during the experiment (cancellation/payment details still available), or allow only the intended catalogue and recognize that a portal switch is a crossover. The webhook reads the new invoice price even when subscription metadata still describes the old plan.

Do not set these variables on preview deployments against live Stripe. No live charge was used for verification. This repository has a live-only Stripe account; use the local simulated checkout and signed fixtures first.

## Create and start in PostHog

1. Open [EU project 347125](https://eu.posthog.com/project/347125). Create an experiment with feature flag key **`pricing-test-2026-11`**. Use multivariate variants **`control` (50%)** and **`test` (50%)**, in that order.
2. Configure one release condition: **all users, 100% rollout**, with no properties, cohorts, groups, variant overrides, or holdout. Leave the flag **disabled**. Percentage rollout is supported, but 100% makes the two measured arms balanced.
3. Use **`pricing_viewed`** as the custom exposure event. All experiment events include `pricing_variant` and `$feature/pricing-test-2026-11`; the browser SDK does not independently evaluate the flag. Do not use automatic `$feature_flag_called` exposure: no such event is emitted for consent-free evaluation.
4. Configure the variables and four prices above after production is healthy. Deploy with `PRICING_AB_ENABLED=1` while the PostHog flag remains off. Validate control checkout price configuration. Prices are still control.
5. Check both variants with the local fixture or a separate isolated PostHog test project/Stripe sandbox. Record experiment start/end, attribution window (suggestion: 7 days), minimum sample, and decision rule before starting.
6. Enable the PostHog flag. New requests use it within **30 seconds** per running instance. Freeze weights/order/rollout and catalogue for the run.

Reference: [PostHog flag creation](https://posthog.com/docs/feature-flags/creating-feature-flags), [flag management API and read scope](https://posthog.com/docs/api/feature-flags), [Stripe Checkout API](https://docs.stripe.com/api/checkout/sessions/create).

## EUR pricing

All eight Stripe prices (control and test) carry fixed EUR `currency_options` on the same price IDs: control €0.01/credit, €18, €46, €139; test €0.02/credit, €27, €74, €185. Visitors in euro-area countries (Vercel's `x-vercel-ip-country`) see and pay EUR; everyone else sees and pays USD. The pricing pages and checkout both resolve the currency through `buyerCurrency`, so what is shown is what is charged. A returning buyer keeps the currency of their last paid order, and a Stripe customer locked to a currency keeps it. Adaptive Pricing stays off and every checkout session names its currency. Static surfaces with no visitor (`llms*.txt`, JSON-LD offers, blog) keep the USD catalogue. `EUR_CHECKOUT_DISABLED=1` puts everyone back on USD.

`Purchase.currency` stores the charged currency. `purchase` and `purchase_completed` carry `currency` and `list_revenue_usd` (the pack's USD list price); in the HogQL above, drop the `currency = 'USD'` filter and sum `list_revenue_usd` to compare EUR and USD orders in one number.

## Stop / kill switch

Disable or delete the PostHog flag. Within at most 30 seconds plus a 1.5-second fetch timeout, newly evaluated pricing becomes control. Missing configuration, missing flag, invalid flag, or failed configuration fetch also produces control; expired cached test configuration is never reused on failure. `PRICING_AB_ENABLED=0` plus redeploy is the deployment-level fallback. Removing the public PostHog key also disables assignment.

Already open pages can retain displayed test prices until refresh; checkout detects the disagreement and returns 409 rather than silently charging another price. Already-created Stripe sessions and existing subscriptions keep their contracted price and credit allocation, even after shutdown. Expire open sessions manually in Stripe if stopping must also prevent their completion. Never reprice paid purchases or existing credit balances.

## Tracking and decisions

| Event                | Source                                                  | Useful properties                                                       |
| -------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| `pricing_viewed`     | Browser, pricing section enters viewport; consent-gated | `pricing_variant`, `pricing_subject`, `$feature/pricing-test-2026-11`   |
| `checkout_started`   | Browser, server accepted checkout; consent-gated        | Above, `value`, `currency`, `items`                                     |
| `signup`             | Existing authoritative signup hook                      | Above, `method`, first-touch fields                                     |
| `purchase_completed` | Paid Stripe webhook, once per purchase                  | Above, `order_id`, `revenue`, `amount`, `currency`, `is_first_purchase` |
| `purchase`           | Existing server event retained for admin reports        | Same purchase properties; **don't sum both event names**                |

GA4's existing `begin_checkout`, `purchase`, and `sign_up` conversions carry `pricing_variant`. Purchase values/variant come from the owner-scoped, DB-confirmed result, not URL query parameters. Register `pricing_variant` as an event-scoped custom dimension in GA4. No hashed join key is sent to GA4.

Compare:

- **Paid conversion:** distinct exposed subjects with at least one paid order within 7 days / distinct exposed subjects.
- **Revenue per visitor:** USD revenue from those orders / distinct exposed subjects.
- **Average order value:** revenue / distinct paid `order_id`.
- Secondary: signup conversion, checkout completion, new subscription mix, refunds, and render usage/provider cost. Separate first purchases from renewals and report crossover separately.

Use `pricing_subject` for joins, **not PostHog's default distinct ID**: cookieless browser IDs and authenticated backend IDs differ. Native experiment funnel results that assume they match are not authoritative; use a HogQL/SQL insight or warehouse metric joined on this property. In particular, don't divide all server revenue (including unobserved visitors) by consented visitor counts. Analyze only subjects with a measured `pricing_viewed`, and exclude subjects exposed to both arms. This measures consent-observed traffic, not all visitors.

Example HogQL insight (replace both date literals and use the same 7-day maturation window for both arms):

```sql
WITH exposures AS (
  SELECT properties.pricing_subject AS subject,
         any(properties.pricing_variant) AS variant,
         min(timestamp) AS exposed_at
  FROM events
  WHERE event = 'pricing_viewed'
    AND timestamp >= toDateTime('2026-11-20 00:00:00')
    AND timestamp < toDateTime('2026-12-04 00:00:00')
    AND properties.pricing_subject IS NOT NULL
  GROUP BY subject
  HAVING uniqExact(properties.pricing_variant) = 1
), orders AS (
  SELECT properties.pricing_subject AS subject,
         properties.order_id AS order_id,
         any(properties.pricing_variant) AS variant,
         min(timestamp) AS paid_at,
         max(toFloat(properties.revenue)) AS revenue
  FROM events
  WHERE event = 'purchase_completed' AND properties.currency = 'USD'
  GROUP BY subject, order_id
)
SELECT e.variant,
       uniqExact(e.subject) AS visitors,
       uniqExactIf(e.subject, notEmpty(coalesce(o.order_id, ''))) / visitors AS paid_conversion,
       sum(coalesce(o.revenue, 0)) / visitors AS revenue_per_visitor,
       sum(coalesce(o.revenue, 0)) / nullIf(uniqExactIf(o.order_id, notEmpty(coalesce(o.order_id, ''))), 0) AS average_order
FROM exposures e
LEFT JOIN orders o ON e.subject = o.subject AND e.variant = o.variant
  AND o.paid_at >= e.exposed_at AND o.paid_at < e.exposed_at + INTERVAL 7 DAY
WHERE e.exposed_at < now() - INTERVAL 7 DAY
GROUP BY e.variant
```

Review query syntax in the project's HogQL editor before saving; this PR does not create remote dashboards. A cookieless visitor who later deletes their functional cookie or uses a different device before signup cannot be joined reliably. Exclude staff/bots and compare consent/locale/channel mix before making a pricing decision.

## Verification and overlap

- `bun run preflight`: lint, UI guards, typecheck, unit tests.
- `TEST_DATABASE_URL=<scratch-local-postgres> bun run --cwd packages/core test`: real ledger, signed webhook replay, test renewals after shutdown, revenue and owner-scoped confirmations.
- `apps/web/e2e/pricing.spec.ts`: opt-in local browser flow for both arms, consent declined, all six home pricing/FAQ/structured-data surfaces, 375px light/dark, signup identity continuity, stale/invalid checkout rejection, simulated plan credit grant. Run with `PRICING_AB_E2E=1` and a local flag API fixture serving the configuration above; `PRICING_E2E_URL` defaults to `http://localhost:3147`.

Reproduce the browser check using three terminals (create/sync a **scratch** local database first):

```sh
node apps/web/e2e/pricing-flag-server.mjs
```

```sh
DATABASE_URL=postgresql://localhost/easyrender_pricing \
BETTER_AUTH_URL=http://localhost:3147 APP_URL=http://localhost:3147 \
BETTER_AUTH_SECRET=local-pricing-test-secret-at-least-32-characters \
STRIPE_SECRET_KEY= PRICING_AB_ENABLED=1 \
POSTHOG_PERSONAL_API_KEY=local-fixture POSTHOG_PROJECT_ID=347125 \
POSTHOG_API_HOST=http://127.0.0.1:3148 \
NEXT_PUBLIC_POSTHOG_KEY=phc_localtest NEXT_PUBLIC_POSTHOG_HOST=http://127.0.0.1:3148 \
bun run --cwd apps/web dev --port 3147
```

```sh
cd apps/web
PRICING_AB_E2E=1 node node_modules/@playwright/test/cli.js test --config e2e/playwright.config.ts pricing.spec.ts
```

Screenshots: [control light](images/pricing-ab/control-light-375.png), [control dark](images/pricing-ab/control-dark-375.png), [test light](images/pricing-ab/test-light-375.png), [test dark](images/pricing-ab/test-dark-375.png).

No blog posts change. Public static `llms*.txt` continues to describe the control catalogue because it has no visitor identity; rendered home offers/FAQ, pricing pages, model pricing, and MCP `get_credits` use the assigned catalogue.

PR #106 (`posthog/wizard-01a1d0606dab`) overlaps `apps/web/lib/analytics/browser.ts`, `components/buy-button.tsx`, and signup/analytics wiring. Keep the existing consent-gated initialization and this helper's single `checkout_started` event; do not add the wizard's duplicate event or independent client flag evaluation. Keep the server's authoritative `signup`, `purchase`, and `purchase_completed` behavior. Re-run consent and conversion checks when reconciling #106.

Main sync remains at `82832c8` (#108) through `c1eee8a`; the credits page preserves main's signed-in heading behavior and the experiment's variant-derived pricing.

Coordination with #106 was rechecked at `a13e8754fab9043a4f268f94e9f0dbed8898306e`, still open. Its wizard moves `posthog.init` into `instrumentation-client.ts`, adds a direct checkout capture, and adds browser identify/signup calls. Retain #107's consent-gated `setBrowserTools` initialization (including protection against concurrent initialization), its single accepted-checkout event, server assignment, and authoritative signup/purchase hooks when reconciling those changes. The initialization guard and its unit test are independent of pricing requests. #106 has not been checked out, changed, pushed, or merged.
