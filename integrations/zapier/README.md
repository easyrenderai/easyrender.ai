# easyrender for Zapier

A local Zapier Platform CLI app for the easyrender REST API. Nothing in this directory
has been registered, pushed or published to Zapier.

## Development

Use Node.js 22, Zapier's production runtime. Install separately from the Bun workspace:

```sh
cd integrations/zapier
npm ci
npm test
npm run validate
npm run build
```

CLI/core are pinned to 19.3.0. This version uses **`zapier-platform`**, not the removed
`zapier` binary. `npm run validate` performs local schema validation with
`--without-style`; full server-side publishing checks require an existing developer
account and registered integration. Tests use `createAppTester` and nock, block all
unmocked network traffic, and cover authentication, requests, pagination and errors.
Build creates ignored ZIPs locally and does not upload them.

## Connect an account

Generate an `er_` key in [easyrender Connectors](https://easyrender.ai/connectors).
Use `read` and `write` scopes for all included actions, or only `read` for lookups and
polling. Store the key only in the authentication password field. Choose a non-secret
account label to distinguish connections. Testing a connection reads `/api/credits`.

**Before live use:** deploy this PR's REST `image_url` support. The app uses the fixed
production origin, `https://easyrender.ai/api`; see the [API contract](../../docs/api.md).

## Actions and trigger

- **Create Render:** map a public HTTPS JPEG/PNG/WebP URL and a stable source event ID
  into Idempotency Key. Optional name and prompt. Creates a private free preview;
  review it and authorize the 3D build separately in easyrender.
- **Get Render:** read a known ID and its current status.
- **List Renders:** one page, optional status and cursor, with `renders` line items and
  `nextCursor`. Map that cursor into the next call; keep the status filter unchanged.
- **Get Credits:** current balance and quote, with no price constants.
- **Model Ready:** polling trigger for **one configured render ID**. Returns a stable
  render ID only when `status=ready` and `hasModel=true`; Zapier deduplicates that ID.
  Failed jobs raise an error; previews are not models.

The selected-ID trigger is configured when setting up the Zap; it cannot receive IDs
from earlier Zap steps. Use a separate watcher for a known job. For dynamic pipelines,
save IDs from Create Render and use scheduled Get Render actions plus a status filter.
There is no account-wide webhook or completion-ordered feed. Test/activation can seed
Zapier's deduplication cache, so enable the watcher while its model is still pending.

Example: a catalog event → Create Render → store `id` on the product. After separately
authorizing its build, configure Model Ready → your delivery app. Private model files
at `/api/renders/{id}/model` still require the owner's authentication; URL output does
not automatically make them public or accessible to the next app.

## Recovery

Preserve the creation idempotency key and original photo/input on retries. 401 requests
reconnection; 429 becomes a throttled error honoring `Retry-After`. Other API errors
include the server's code and request ID. There are no connector-level retry loops.
Do not resubmit uncertain work under a different key. Image download restrictions are
enforced by easyrender, without forwarding the key to the photo host.

Future private push, reviewer setup, beta and public launch steps are documented in
[LISTING.md](../../docs/integrations/LISTING.md). A passing local validator is not a
public listing approval or evidence of a successful live Zap.
