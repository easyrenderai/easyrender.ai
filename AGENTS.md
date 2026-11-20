# AGENTS.md: easyrender.ai

Single rule file for every agent (Claude Code, Codex, Cursor). `CLAUDE.md` only imports it, so
edit rules here and nowhere else.

## Project

easyrender.ai turns product photos into 3D models and AR. Photo in, free preview, angle sheet,
GLB out. It is sold through an MCP server (agents call it) and a web app and mobile app (people
use it). Credits are the only unit: 1 credit = $0.01, priced at provider cost plus a 70% margin.

- Prod: https://easyrender.ai, Vercel team `shipshitdev`, project root `apps/web`, Neon Postgres.
- Rendering runs on Replicate for the MVP. Genfeed is the long-term rendering engine.
- Everything about money, auth, storage and webhooks touches production users. Treat it that way.

## Layout

```
apps/web        Next.js 16 App Router: marketing, dashboard, REST API, MCP (/api/mcp), OAuth
apps/mobile     Expo app. Own bun.lock, NOT in the root workspace (React Native pins react 19.3.0)
apps/desktop    Electron shell that loads the hosted web app. Own bun.lock, NOT in the root workspace
packages/core   credits, billing, API keys, OAuth, renders, storage (framework-free)
packages/db     Prisma schema and client (Postgres)
packages/harness  Replicate pipeline, models, pricing, guardrails, skills loader
packages/mcp    MCP server tools: create_render, get_render, render_3d, get_credits
packages/tsconfig  shared tsconfig
services/model-export  Blender converter: GLB to OBJ, FBX and BLEND, one run per export on AWS Lambda.
                Python with its own Dockerfile, NOT in the bun workspace
infra/aws       CloudFormation for the S3 buckets and CloudFront
```

Respect the boundaries: shared logic in `packages/*`, framework code in `apps/*`. `packages/core`
and `packages/harness` import no Next.js. Route handlers stay thin and call into `packages/core`.

## Read first

- `DESIGN.md`: the design system. Read it before any UI change.
- `.agents/memory/MEMORY.md`: the memory map. Read the entries relevant to your task.
- `.agents/memory/system/CRITICAL-NEVER-DO.md`: production-breaking mistakes.

Research before editing: never change code you have not read, and look at two or three similar
places before writing something new.

## Trunk workflow

`main` is the single trunk. Short-lived branch, PR into `main`. Never push to `main`.

- Branch as `feat/xxx`, `fix/xxx` or `chore/xxx`. Conventional commits (`feat:`, `fix:`,
  `refactor:`, `chore:`, `docs:`).
- Merging to `main` deploys nothing. Prod ships through the **Release** workflow (bump the root
  `package.json` version, merge, dispatch with the matching `vX.Y.Z` tag): see `RELEASING.md`.
  Vercel's Git integration is off: no PR or branch previews, every deployment comes from Release.
- Merge a green PR yourself. Do not wait for a go-ahead on a change that passed CI.
- `bun.lock` conflicts: `rm bun.lock && bun install`. `apps/mobile/bun.lock` is separate.
- Open the PR with the template in `.github/pull_request_template.md`.
- **Scan staged files for secrets before every commit** (`.env*`, tokens, private keys, Stripe,
  Replicate and AWS credentials). If you find one, stop. Never commit it.
- Search open PRs before you start: `gh pr list --state open --search "<symptom>"`. On a
  collision keep the older PR.

## Commands

```bash
bun install                       # root workspace (apps/web + packages/*)
bun run dev                       # apps/web on :3000
bun run typecheck                 # all workspaces
bun run test                      # vitest in core and harness
bun run lint                      # biome check .
bun run format                    # biome check --write .
bun run check:ui-guards           # no raw HTML controls in apps/web
bun run check:use-effects         # useEffect ratchet; --prune after removing effects, --report to list
bun run preflight                 # what CI runs: biome, ui guards, effect ratchet, typecheck, tests
bun run --cwd apps/web e2e        # browser tests: paid flow + specs, on `next dev`, mock Replicate; needs a
                                  # scratch Postgres in DATABASE_URL with the schema (db:push) and Chromium
bun run db:generate               # prisma generate
cd apps/mobile && bun install && bunx expo export --platform android   # mobile bundle check
cd apps/desktop && bun install && bun run typecheck && bun run test    # desktop; `bun run dev` opens the window
cd services/model-export && python -m pytest                           # converter; needs Python 3.13 and requirements-dev.txt
```

Run `bun run preflight` before you push. The `credits.integration.test.ts` suite needs a scratch
Postgres in `TEST_DATABASE_URL` and skips without it.

## Rules

### Types, imports, naming

1. No `any`, no `@ts-ignore`. Shared shapes live in `packages/core`.
2. No `console.log` in app code; log through a real error path.
3. Booleans take an `is` or `has` prefix.
4. Use the `@/` alias inside `apps/web`, `@easyrender/*` across packages. No deep relative
   imports across packages.
5. Components are `function` declarations. Server components by default; add `'use client'`
   only when you need state or effects.
6. Do not hand-edit generated output (`generated/`, `.next/`).

### React effects

- Do not add `useEffect` (or `useLayoutEffect`). `bun run check:use-effects` counts them per file
  against `scripts/use-effect-baseline.json`: a new file or a higher count fails, and a lower
  count fails until you run `bun run check:use-effects --prune` and commit the smaller baseline.
  The baseline only shrinks (CI also compares it with `main`). In order of preference: derive
  the value in render, do the work in the event handler that caused it, reset state with a `key`,
  or use the existing data hook. Keep an effect only to subscribe to a system outside React
  (DOM and browser APIs, timers, sockets, a third-party widget) and mark it with
  `// use-effect-audit: ignore <reason>` in the comment lines directly above it (the reason is required).
- An async effect (it awaits, uses `.then` or `fetch`) must create an `AbortController` and pass
  its `signal`, and abort in the cleanup. One that never mentions `AbortController`,
  `AbortSignal` or `signal` is counted as `async_effect_without_abort`.

### UI

7. **shadcn everywhere.** Controls come from `apps/web/components/ui`. Raw `<button>`, `<input>`,
   `<textarea>`, `<select>`, `<dialog>`, `<table>` and `<hr>` fail `bun run check:ui-guards`. The
   guard's allowlist only shrinks.
8. Semantic tokens only (`bg-background`, `text-muted-foreground`). No hex values, no palette
   colours, no new `dark:` variants in product code. See `DESIGN.md`.
9. Copy lives in `apps/web/messages/en.json` and `es.json`. Add every new string to both.
10. Never hard-code a price or credit amount. Use `@easyrender/harness` pricing.

### Data, money, security

11. Credits move only through `packages/core/src/credits.ts`, inside a transaction, with a ledger
    row. A failed job refunds.
12. Every render query is scoped to its owner (`userId`) or the anonymous id. Public reads go
    through the public flag only.
13. Stripe webhooks verify the signature. The Replicate webhook payload is untrusted: `advance()`
    re-reads the prediction from Replicate itself, so keep it that way.
14. Schema changes: `packages/db/prisma/schema.prisma`. Prod syncs with `prisma db push` during
    the Vercel build (`packages/db/scripts/deploy.mjs`). That script reads the SQL Prisma would
    run: a purely additive change (new tables, nullable or defaulted columns, indexes, a new
    unique index) is applied on its own, even though Prisma warns about it. Anything else (a drop,
    a type change, a rename, a required column with no default) fails the `Schema change` CI job
    and stops the deploy; review it, and set `DB_ACCEPT_DATA_LOSS=1` for one production build
    only, then remove it. Check a change locally with `bun run --cwd packages/db db:check`. Never
    run it against prod from a laptop.
15. New env var: add it to `.env.example` and `turbo.json` (`build.env`) in the same PR, and say
    in the PR that it has to be set in Vercel. Never commit a value.
16. Tests: assert what the user or caller sees (returned or stored values), not call order. A
    bug fix ships with a test that failed before it.

### Harness and skills

17. Prompts, model settings and guardrail limits can be overridden from the private harness repo
    (`packages/harness`: `loadHarness()`), with bundled defaults as the fallback. Renders must
    never depend on GitHub being reachable. Costs and model names stay in code.

## Finish condition

A code-changing PR states its finish condition and shows evidence: repro before and pass after
for a bug, a walked flow or a read-back value for a feature. Do not claim success without lint,
typecheck, tests or a task-specific check. If a check was not run (for example no browser in the
cloud sandbox), say so.

## Tracking

GitHub issues are the backlog and [Project #1](https://github.com/orgs/easyrenderai/projects/1) is the
board, run the same way as genfeed.ai. Do not create local task markdown files. Search before
opening an issue: `gh issue list --state all --search "<keywords>"`. Full rules:
`.agents/memory/context/project-board.md`.

- Kind of work is the native issue type (Bug, Feature, Task), set by the issue form. Never a label.
- Priority is the native org Issue Field `Priority` (P0 to P3), shown on the board. Never a label.
  Every board item has one, epics included.
- Status is the project field: Backlog, In Progress, Human Review, Done, Deferred.
- Parent and child use native sub-issues. An epic moves to In Progress when its first child starts.
- File with the forms in `.github/ISSUE_TEMPLATE`. Acceptance criteria are EARS (`WHEN ... THE
  SYSTEM SHALL ...`). No YAML frontmatter in issue bodies.
- A PR links its issue: `Closes #n` only when it completes the issue, `Refs #n` otherwise.

## Memory

Durable project rules go in `.agents/memory/` as one file per fact, with frontmatter (`name`,
`description`, `type: feedback | project | reference`) and `**Why:**` / `**How to apply:**`
lines. Add a line to `MEMORY.md`. Never write a secret, key, or customer detail to memory: this
repo is shared with partners.
