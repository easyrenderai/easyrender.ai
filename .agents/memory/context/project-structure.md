# Project structure

- `apps/web`: Next.js 16, App Router, Tailwind 4, shadcn (new-york, zinc), next-intl (en, es, de, fr, it, pt),
  Better Auth, Stripe. Route groups: `(marketing)` for every public page (site header and
  footer via `components/site-chrome.tsx`), `(app)` for sign-in and sign-up, `(dashboard)` for the
  signed-in pages (own rail and sidebar shell, `components/app-shell`, no marketing header). The
  root layout holds fonts and the query client and reads nothing from the request; each route group
  puts an `IntlBoundary` in its layout for translations. Marketing pages are cached at the edge:
  see [cached marketing pages](cached-marketing-pages.md). Paths are unchanged. API routes under `app/api`: `renders`, `mcp`, `oauth`, `keys`, `checkout`,
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
- `packages/mcp`: the MCP server and its 16 tools. Read `packages/mcp/src` (`index.ts`,
  `extended-tools.ts`) for the list; do not copy it here.
- `packages/db`: Prisma schema, client, `db:deploy` script used by the Vercel build.
- `infra/aws`: CloudFormation for storage (public assets, private signed exports) and the CDN
  certificate. See `infra/aws/README.md`.
- `services/model-export`: the Blender converter for OBJ, FBX and BLEND downloads. Python, its own
  Dockerfile, outside the bun workspace; one run per export on AWS Lambda, no server. See its
  README for the request contract and why colour edits are baked into OBJ and FBX textures.
- `integrations`: Make, n8n and Zapier connectors.
- `plugins`: Shopify, WooCommerce and PrestaShop store plugins, plus `plugins/e2e` plugin tests.
- `examples`: REST API examples (TypeScript and Python), typechecked in CI.
- `tools`: content tooling (`render-guides`).
- `skills`: agent skill packs published to agents.
- `docs`: API reference (`docs/api.md`), runbooks, benchmarks, analytics notes.
- `scripts`: repo checks (`preflight`, `check-ui-guards`, `check-secrets`, `check-use-effect`,
  `check-docs`) and one-off tools.
