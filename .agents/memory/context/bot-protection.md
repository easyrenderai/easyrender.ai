---

name: bot-protection
description: Bot protection policy and state: agents are welcome, BotID Basic on three routes, firewall stage 1 not applied, Expo app caveat
type: project
---

Agents and MCP clients (Grok, Claude, OpenAI) are a target customer, so bot rules never touch
marketing pages, `/robots.txt`, `/llms.txt`, sitemaps, `/.well-known`, `/api/mcp` or `/api/oauth`.
`robots.txt` allows `/api/mcp` for the AI crawlers; the rest of `/api/` stays disallowed.

**Shipped (v0.5.3):** BotID Basic on `POST /api/auth/sign-up/email`, `POST /api/auth/sign-in/email`
and `POST /api/renders` (the free preview). Routes live in `apps/web/lib/botid-routes.ts`, the check
in `apps/web/lib/bot-check.ts`. The level is pinned to Basic on client and server because Deep
Analysis is billed per call. API-key and OAuth callers on `/api/renders` are not checked. If the
check itself errors, the request goes through and the error is reported. A blocked request gets
`403` with code `BOT_DETECTED`, translated in all six languages.

**Not done:** Vercel firewall stage 1 (issue #380): Bot Protection in log mode with verified bots
allowed, plus per-IP rate limits on auth, uploads and `/api/renders`. Nothing was changed in Vercel.
After 48 hours of logs with no verified bot, monitor or MCP client logged, switch to challenge.

**Why:** the AWS Route 53 health check (tens of thousands of requests a day) and Sentry uptime hit
`/`, and a challenge there would page the owner. A bare `curl` is not proof that BotID works: without
an `Origin` header Better Auth answers `403 MISSING_OR_NULL_ORIGIN` first. Send `Origin` and a JSON
body to see `BOT_DETECTED`.
**How to apply:** add no rule on `/` or the public files. The Expo app signs in with cookies and no
browser proof, so BotID blocks it; it needs an API key or another client proof before real users.
Intermittent `403` with `x-vercel-mitigated: deny` from some networks is Vercel's platform layer,
not our rules; only Vercel support can lift it (issue #388, needs the blocked IP and `x-vercel-id`,
kept out of public text).
