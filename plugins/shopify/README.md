# easyrender 3D & AR for Shopify

A merchant installs the app, connects an easyrender account, and clicks one button to generate a 3D
model of every product in the catalogue. Finished models show a "View in your room" button and a QR
code on the product page; scanning the code or tapping the button opens the model in AR on the
shopper's phone.

## How it is built

- **Embedded page and server: `apps/web`, not a separate app.** The app URL is
  `https://easyrender.ai/shopify` (`apps/web/app/shopify`, `apps/web/components/shopify-app.tsx`). It uses
  shadcn components like the rest of the site and App Bridge for the session token. There is no second
  server to host.
- **Auth:** Shopify managed installation with token exchange. The page sends its App Bridge session
  token (a JWT signed with the app secret); the server verifies it, swaps it once for an offline Admin API
  token and stores that token AES-256-GCM encrypted (`ShopifyShop` table). No redirect OAuth flow.
- **Paying:** the merchant links the shop to an easyrender account in a new tab (the iframe cannot sign
  in). That account's credits pay for the models. The price is shown on the button before the click, and
  the click carries it, so a run that would cost more is refused.
- **The work:** the shared catalogue queue (`packages/core/src/catalog.ts`) with platform `shopify` and
  the shop's domain as the store: free draft, then the paid 3D build, refund on failure.
- **Showing it:** when a model is ready the server writes the product metafield
  `easyrender.render_id`. The theme app extension (`extensions/easyrender-ar`) reads it in Liquid and
  renders the button and QR. The merchant adds the "View in your room" block to the product template in
  the theme editor.
- **Webhooks** (`/api/shopify/webhooks`, signed with the app secret): `app/uninstalled` and `shop/redact`
  forget the shop and its product list; `customers/data_request` and `customers/redact` return 200 because
  no shopper data is stored.

## Setting it up

The app lives in the Shopify Dev Dashboard (dev.shopify.com, organization Easy Render), not the old
Partner dashboard.

1. Dev Dashboard > Apps > Create app. Use the URL, scopes and webhooks API version from
   `shopify.app.toml`, then release the first version. An app needs a released version before it can
   be installed.
2. App Settings holds the client ID and client secret. Put the client ID in `shopify.app.toml`
   (`client_id`, it is public). Set `SHOPIFY_API_KEY` (client ID) and `SHOPIFY_API_SECRET` (client
   secret) in the Vercel project. They are already in `.env.example` and `turbo.json`. Never commit the
   secret.
3. From this folder run `shopify app deploy`. That registers the URLs, scopes, webhooks and the theme
   extension as a new app version. In CI, create a service account with the App development
   permission and pass its token as `SHOPIFY_SERVICE_ACCOUNT_TOKEN` with `--allow-updates`.
4. Install on a development store (Dev Dashboard > the app > Install app), open the app, connect an
   easyrender account, generate, then add the "View in your room" block to the product template in
   the theme editor.

The API version is pinned in `packages/core/src/shopify.ts` and `shopify.app.toml` (`2026-07`).

## Verified and not verified

Tested in `packages/core` (unit and against a scratch Postgres, with Shopify's API faked): session
token verification (signature, audience, expiry, issuer, shop domain, `alg: none`), webhook HMAC, link
state, encrypted token storage, token exchange once per shop, the product listing, the price of a
whole-catalogue run, the stale-price refusal, queueing, writing the metafield once, and uninstall
cleanup. Live smoke test of the routes in `next dev`: security headers on `/shopify`, App Bridge tags in
the head, 401 for bad tokens, webhook signature accepted and refused.

**Not verified against a real Shopify store:** the GraphQL queries against Shopify's live schema, the
token exchange call, App Bridge inside the Shopify admin iframe, the Liquid block in a theme (Shopify's
theme-check was not run), and AR on a phone. Run steps 1 to 4 on a development store before anything is
shared.

## Not in this version

- **Shopify Billing API.** Charges go through easyrender credits. A public App Store listing requires
  Shopify's own billing (tracked in #14), so until then distribute as a custom or unlisted app.
- Uploading the GLB/USDZ into product media (#9) so Shopify's own viewer and the Shop app show it.
- Auto-drafting new and changed products via webhooks (#13), a batch approval grid (#12), a bulk
  operation for very large catalogues (#11): products are read page by page, up to 5,000.
