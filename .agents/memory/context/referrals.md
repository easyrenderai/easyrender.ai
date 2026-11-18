---
name: referrals
description: How the referral program works (share link, cookie, when credits are paid, abuse checks)
type: project
---

Each verified account gets a share code on first visit to /account (`referralCode` on `User`).
Link: `/sign-up?ref=CODE`. The edge proxy stores a valid-looking `?ref` in the `er_ref` cookie
(30 days); `recordReferral` reads that cookie in the Better Auth user-create hook, never the form.
The sign up form shows a disabled code field and an "applied" badge only when
`/api/referrals/applied` says the code is real. Code: `packages/core/src/referrals.ts`.

Credits are paid by `rewardReferral` when the new account's email is verified (Google accounts
at creation, email accounts in `afterEmailVerification`). One `Referral` row per new account
(`referredUserId` unique), a status flip plus ledger keys make it idempotent. Self-referral is
rejected by mailbox (Gmail dots, +tags). A referrer is paid for a capped number of accounts; the
new account still gets its bonus past the cap.

**Why:** the amounts and the cap are Vincent's call and change; they live in
`packages/harness/src/pricing.ts` (`REFERRAL_*`), tied to the price of one 3D build at his choice.
**How to apply:** change the constants, not docs or copy (copy reads them). Never grant referral
credits outside `rewardReferral`.
