# Critical: never do

Each of these has broken, or can break, production.

1. **Never push to `main`.** PR only. Merge does not deploy; the Release workflow does (`RELEASING.md`).
2. **Never commit a secret.** `.env*` is ignored except `.env.example`. Stripe keys, webhook
   secrets, Replicate tokens, AWS credentials, Better Auth secrets stay in Vercel.
3. **Never run `prisma db push --accept-data-loss` against production by hand.** Use
   `DB_ACCEPT_DATA_LOSS=1` on one Vercel production build, then remove it.
4. **Never move or rename `apps/web` without changing the Vercel project root directory in the
   same change.** The Release workflow and the Vercel project both build from that path; a mismatch fails every deploy.
5. **Never change `/api/mcp`, `/api/webhooks/*`, `/api/oauth/*` or `/.well-known/*` paths without
   a redirect or an updated Stripe, Replicate and MCP client configuration.** Customers hold
   keys and connectors that point at them.
6. **Never test checkout against production Stripe expecting a free run.** The account is live
   only; a test checkout is a real charge.
7. **Never grant, spend or refund credits outside `packages/core/src/credits.ts`.**
8. **Never put React Native code in the root workspace.** `apps/mobile` has its own lockfile
   because React Native pins one react version.
9. **Never make a render depend on GitHub or the private harness repo being reachable.** Fall back
   to bundled defaults.
