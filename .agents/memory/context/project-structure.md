# Project structure

- `apps/web`: Next.js 16, App Router, Tailwind 4, shadcn (new-york, zinc), next-intl (en, es),
  Better Auth, Stripe. Route groups: `(marketing)` for every public page (site header and
  footer via `components/site-chrome.tsx`), `(app)` for sign-in and sign-up, `(dashboard)` for the
  signed-in pages (own rail and sidebar shell, `components/app-shell`, no marketing header). One
  root layout holds fonts, translations and analytics; paths are unchanged. API routes under `app/api`: `renders`, `mcp`, `oauth`, `keys`, `checkout`,
  `billing`, `webhooks/{stripe,replicate}`, `auth`. Studio (marketing) components under
  `components/studio`.
- `apps/mobile`: Expo SDK 58, expo-router. Talks to the same `/api/renders*` and Better Auth
  endpoints as the web app. See `apps/mobile/README.md`.
- `apps/desktop`: Electron shell (own bun.lock, outside the root workspace so Vercel never downloads
  Electron). Loads the hosted web app, no UI of its own. See `apps/desktop/README.md`.
- `packages/core`: business logic. `credits.ts`, `billing.ts`, `renders.ts`, `api-keys.ts`,
  `oauth.ts`, `storage.ts` (S3 behind CloudFront, local disk when `S3_BUCKET` is empty).
- `packages/harness`: Replicate client, model settings, pricing, guardrails (photo, sheet and GLB
  checks), watermark, skills, remote config loader.
- `packages/mcp`: the MCP server. Tools: `create_render`, `get_render`, `render_3d`, `get_credits`.
- `packages/db`: Prisma schema, client, `db:deploy` script used by the Vercel build.
- `infra/aws`: CloudFormation for storage (public assets, private signed exports) and the CDN
  certificate. See `infra/aws/README.md`.
- `services/model-export`: the Blender converter for OBJ, FBX and BLEND downloads. Python, its own
  Dockerfile, outside the bun workspace; one run per export on AWS Lambda, no server. See its
  README for the request contract and why colour edits are baked into OBJ and FBX textures.
