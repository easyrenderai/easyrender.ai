---

name: sentry-privacy
description: Why Sentry runs with static trace lifecycle and where the token filter lives
type: feedback
---

All three Sentry configs (`sentry.server.config.ts`, `sentry.edge.config.ts`,
`instrumentation-client.ts`) take their privacy options from `apps/web/lib/sentry-privacy.ts`.
Do not hand-write `beforeSend` hooks in a config.

**Why:** `@sentry/nextjs` 11 defaults to `traceLifecycle: 'stream'`, where `beforeSendTransaction`
and `ignoreTransactions` are never called. Invite, verify-email, reset-password, confirm and
unsubscribe links then reached Sentry unredacted in traced requests. `traceLifecycle: 'static'`
brings the transaction event, and so the filter in `mailing-privacy.ts`, back.

**How to apply:** keep `traceLifecycle: 'static'` while the filter is a `beforeSendTransaction`.
Moving to streaming means rewriting it as `ignoreSpans` plus `beforeSendSpan`. A SDK upgrade is safe
only if `lib/sentry-privacy.test.ts` (runs the real SDK through each config) still passes.
