# First model pilot

Status: implemented, **inactive until a verified administrator starts it** at
`/admin/experiments`. No environment variable or PostHog flag is needed. Production schema
creation is additive and runs through the normal Vercel deployment, never a laptop db push.

## Hypothesis and scope

For new anonymous web visitors who reach their own angle preview, offering one downloadable
3D model after verifying an account will increase 30-day paying conversion per assigned
visitor. The homepage, preview quality, prices, generation pipeline and subsequent credit
pricing are common to both arms. The offer is first shown **after** the preview, so this test
does not measure homepage-to-upload conversion or a "free model" acquisition headline.

- A (`control`): existing free angle preview, then paid 3D.
- B (`free_model`): one ordinary full-quality build and GLB download, no card, after verification.
- New signed-in visitors, existing customers, API/MCP clients and public-model viewers are not
  newly enrolled. Participants keep their original assignment after signup and across devices.
- Eligibility requires the existing anonymous cookie and server network hash. At most one new
  enrollment per network hash per day, applied equally to both arms. Shared networks are thus
  underrepresented. This limits abuse; it does not prove unique human identity.

## Assignment, offer integrity and cost

`FirstModelCampaign` stores one immutable pilot (`first-model-2026-11`). The administrator
chooses 100, 250 or 500 **people offered** a free model, not models per account. Each person
gets at most one grant. The total sample is twice that cap. Random pairs reserve one place
for each arm, in random order, under a PostgreSQL transaction lock. An unfinished pair can
differ by one. Assignment is persisted, never rerandomized on refresh, and no arm is extended
after the other runs out. Enrollment closes at the cap or 14 days, whichever comes first.
Pausing only stops new assignments; existing offers remain redeemable. Resuming keeps the
original cap and deadline. A follow-up experiment requires a new protocol, not resetting rows.

An assignment is recorded when the owned preview requests its offer. This is an intent-to-treat
denominator, including people who do not register and responses that fail to reach the browser.
It is not a verified count of on-screen impressions. No new cookie, fingerprint or client
variant override is added. The existing `er_anon` cookie also keeps the reserved benefit stable;
the cookie explanation describes this functional use. No email address is sent to analytics.

Provider estimates come from the harness: free preview plus the paid build path. At the
current bundled constants these are $0.034 + $0.191 = $0.225 per treatment participant completing
the path. A 100-offer pilot therefore allows about $22.50 for that group; the control group's
previews add about $3.40 if all 100 use one. The incremental incentive cost is about $19.10.
These are **not hard spend limits**: retries, failed provider work, extra previews and
infrastructure can add costs. The actual cap limits reservations and one-time credit grants.

## Money and verification

The signup hook binds the anonymous enrollment once to the new account; an owned preview can
retry that binding if the hook failed. Existing accounts cannot acquire an anonymous offer by
signing in. Verified status is re-read from PostgreSQL at redemption, not trusted from the
browser or cached auth session. Activating enrollment requires configured verification email.

The browser explicitly requests `useFreeModel: true` with `maxCredits: 0`. `startBuild` checks
ownership, eligibility and state, then grants exactly the owed build credits through
`credits.ts` and debits them in the **same transaction** as the ordinary pipeline transition.
The campaign lock and unique ledger key prevent two grants from concurrent clicks. An expired,
used or otherwise unavailable claim returns an error; it never silently spends the wallet.
API keys cannot redeem the offer. No new billing provider, subscription or checkout is involved.

A failed build uses the existing refund ledger, leaving the credits available for another
attempt. It does not issue another trial grant. The incentive is one credit allowance sufficient
for one ordinary build; paid corrections/upscales remain separate. Deleting an account keeps
its anonymous reservation marked as already bound, preventing reuse of that reservation.

## Measurement and decision

Primary metric: **paid users / all assigned visitors at 30 days**, intent to treat. Secondary:
signup, first completed model, second completed model, and 7-day paying conversion. Completion
uses `completedAt`; payments use authoritative `Purchase.status=paid` and `paidAt`. Only visitors
with a complete 7- or 30-day observation window enter that window's numerator and denominator.
A second model is a usage signal; it does not itself establish repeat purchase or LTV.

The admin report and authenticated JSON export retain both arms, zero converters, pending
cohorts, and splits by the separate pricing experiment's assigned catalogue. Keep that price
experiment stable while this pilot runs; assess interaction before pooling prices. Do not call
the signup or first-model lift a business win if purchases or economics deteriorate.

The economics section is diagnostic lifetime-to-date by arm, with unequal follow-up. Revenue
is kept in its actual currency. Recorded render costs are USD estimates and can miss failed
provider charges; they are not invoice reconciliation. Revenue less recorded costs is shown
only if there are no non-USD purchases, excludes fees/infra, and is not LTV or net profit.

This is a **bounded feasibility/abuse pilot**, not a powered superiority test: baseline paid
conversion, economically meaningful effect and variance are not yet known. Use its complete
cohorts to estimate those inputs, then size and pre-register the next test (two-sided 5% alpha,
80% power as a starting convention) before running it. No significance claim, automatic winner,
optional stopping for apparent lift, or forecast LTV is implemented. Pause for technical errors,
abuse or unexpected costs and record the interruption before interpreting results.

## Operation and verification

1. Deploy the additive schema and code. The absence of a campaign leaves everyone on the
   existing flow; merely opening the admin report does not start it.
2. Walk the local fixtures and run the real-Postgres tests. Confirm verification emails and
   ordinary downloads work. Do not use live Stripe as a test environment.
3. Start the user-selected cap in `/admin/experiments` after reviewing the concrete cost text.
4. Check both arms and the report. Export the JSON for dated analysis. At close, wait a full
   30 days after the last enrollment before interpreting the primary endpoint.
5. Pause new enrollment with the same admin control if needed. Keep the tables and redemption
   logic until all reserved offers are honored; a code rollback would hide unredeemed promises.

Automated coverage includes concurrent cap enforcement, stable assignment, owner/transport
exclusions, account binding, verification, transactional rollback, parallel free builds,
provider-failure refunds, immutable configuration, mature cohorts and admin/CSRF checks.
Provider calls are simulated in these tests; the database and ledger are real local Postgres.
