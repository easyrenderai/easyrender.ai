---
name: scratch-postgres
description: How to get a scratch Postgres and a dev server in a sandbox to run integration tests and walk UI flows
type: reference
---

`bun run test:db` is the normal route (see `AGENTS.md`). By hand: Postgres 16 server binaries are
needed; as root run `initdb` through `su postgres -c`, start with `pg_ctl -o '-p 5433 -k /tmp'`
and `create database er_test`.

- `prisma db push` can stall on a fresh database (unique-index warning). Build the schema with
  `bunx prisma migrate diff --from-empty --to-schema <schema> --script | psql`.
- To prove a change is additive, build the database from `main`'s schema first, then run
  `bun run db:check` in `packages/db`.
- UI walk: `bunx next dev -p 3100` in `apps/web` with `DATABASE_URL`, `BETTER_AUTH_SECRET` (any
  string), `BETTER_AUTH_URL` and `APP_URL`. Sign up with `POST /api/auth/sign-up/email`. Use
  `domcontentloaded`, not `networkidle` (the app polls). No storage is configured, so photos and 3D
  models do not load.

**Why:** lets a sandbox verify schema and UI work without a laptop.
**How to apply:** reuse this instead of reporting "no browser or database here".
