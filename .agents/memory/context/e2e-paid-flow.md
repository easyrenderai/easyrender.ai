---
name: e2e-paid-flow
description: How the Paid flow (e2e) Playwright job runs and the next dev traps that made it flaky
type: reference
---

`bun run --cwd apps/web e2e` runs Playwright against `next dev` with a scratch Postgres, no Stripe
key and a local Replicate mock (`apps/web/e2e/paid-flow/replicate-mock.ts`, enabled by
`REPLICATE_API_BASE_URL`, refused in production).

- Keep `DATA_DIR` and Playwright output outside `apps/web`: files written there trigger HMR reload
  loops (`ERR_ABORTED`, "Execution context destroyed").
- `next dev` paints before it hydrates, so a click can be lost. Retry with
  `expect(async () => {...}).toPass()` until an observable state holds (for example
  `aria-pressed`), then take the one-shot action.
- A cold route compile can exceed 5 seconds: `global-setup.ts` warms routes, including every
  localized sign-up page. Add a route there when a spec opens a new one.
- `waitForURL` matches at once if the page already has that URL: wait for the redirected response
  instead.
- Playwright args go after `playwright test`, not after `bun run e2e`.

**Why:** these cost several CI rounds when the job was added.
**How to apply:** read this before touching `apps/web/e2e` or the e2e job. See
[scratch Postgres](scratch-postgres.md) for the database.
