# easyrender API and MCP contract

Contract version **1.0.0**. Base URL: `https://easyrender.ai`. Machine-readable REST schema:
[`GET /api/openapi.json`](https://easyrender.ai/api/openapi.json). Existing `/api/...` paths remain
unchanged; the contract version does not introduce a `/v1` prefix. This document describes the
implementation in this repository. A deployment must include the corresponding changes before
clients can use new routes or tools. Clients should tolerate additional response fields.

## Authentication, privacy and capabilities

Send `Authorization: Bearer <key>` from a trusted server or the MCP client's secure credential
store. Create/revoke keys in the account's Connectors page. `/api/keys` is session-only management;
an API key cannot mint another key. Never expose keys in public frontend bundles, URLs, screenshots
or logs. REST also supports the web application's own session workflow; bearer clients should
use the authenticated contracts below. Cross-origin bearer requests are supported; this does not
make a key safe to embed in public JavaScript or grant cross-origin session-cookie access.

Keys can have these scopes. Each endpoint's exact requirements appear as `x-required-scopes`
in OpenAPI; requirements are cumulative where more than one is listed.

| Scope | Permitted operations |
| --- | --- |
| `read` | Read owned resources, quotes and downloads; poll an already authorized job |
| `write` | Upload images, create previews/drafts, edit materials, remove catalog references |
| `spend` | Start paid builds, sheets/redraws, product views, polish and upscales |
| `share` | Change visibility, explicitly create a public render, share catalog models for embeds |

A paid operation such as creating product views requires `spend`; it does not additionally require
`write` just because it creates a record. Catalog submission requires `write`, `spend` and `share`.
Setting `isPublic=true` during render creation additionally requires `share`.

API and MCP renders default to **private**. Private images and GLB downloads require their owner's
authentication. A result URL is not a credential. Public or explicitly link-shared catalog models
have separate sharing behavior; publishing must be deliberate. Sharing a render also makes its
source photo accessible for the before/after view. Do not share when the original photo must remain private.

A key may have `expiresAt` and a `creditLimit`. The limit is a **lifetime gross-debit ceiling** for
that key, not a daily allowance or a second wallet. `spentCredits` increases on successful debits;
refunds restore the user's wallet but do **not** restore the key's ceiling. A key can be unable to
spend while the account still has a positive balance. Existing keys default to all scopes, no
expiry and no ceiling. Expired/revoked keys fail authentication on the next request. OAuth grants
are bound to this easyrender service, including its authenticated asset URLs; they are not bearer
credentials for another host.

## Quotes and spending

`GET /api/credits` and MCP `get_credits` return the same account-specific quote: `balance`,
`currency`, `pricing_variant`, `render_credits`, `sheet_credits`, `product_views_credits`, `view_polish_credits`,
`upscale_credits`, `build_from_views_credits`, `plans`, `topup`, and `buy`. Read live credit costs
and account currency; do not hard-code a credit-to-money conversion. `topup.price_cents` is an
amount in `topup.currency`; plan prices use the quote's currency. USD-specific compatibility
fields are present only for USD quotes. The `buy` link is a purchase destination, not purchase
authorization. An AI client may also charge independently.

A render response includes `renderCredits`, `sheetCredits`, `upscaleCredits` and `credits` already
recorded on that render. Pending build debit is `max(0, renderCredits - credits)`; MCP also returns
`pending_credits`. A reused final sheet can reduce the pending build debit. Product-view sets expose
`polishCredits`, `upscaleCredits` and `buildCredits`. Refresh the resource and quote before a paid
action, and honor the user's total budget across concurrent and uncertain attempts.

Failed work is refunded through the service's ledger. A current balance or a friendly error text
alone is not proof of a specific refund. Preserve the job and request IDs for support. There is no
public cancel/refund API. Polling timeout is not a job failure, and an unknown provider outcome
must not trigger a duplicate paid submission.

## Upload and preview

`POST /api/uploads` accepts authenticated multipart `image`: JPEG, PNG or WebP, at most **4 MiB**.
It returns HTTP 201 with `{id, contentType, size, expiresAt}`. The private upload ID is owner-scoped
and expires after **one hour**. It can be used by REST or MCP; another account cannot consume it.
Image quality checks still apply. A successful upload has not created a preview or paid render.

`POST /api/renders` accepts either multipart `image` or `upload_id` (exactly one), or JSON
`{upload_id, prompt?, name?, isPublic?}`. `prompt` is at most 500 characters. API callers default to
`isPublic:false`. HTTP 201 returns a render with its stable `id`; creation starts a usage-limited
free preview. Use `Idempotency-Key` for network-safe creation: 1–128 printable ASCII characters without spaces,
unique per intended photo/input. The same user's same key and input return the same render;
changed input returns HTTP 409 `idempotency_conflict`. Reuse the original key on a retry, including
when no ID was received. Do not generate a new key merely because the response was lost.

```sh
# Set EASYRENDER_API_KEY securely in your environment. The example creates a preview only.
curl --fail-with-body https://easyrender.ai/api/renders \
  -H "Authorization: Bearer $EASYRENDER_API_KEY" \
  -H 'Idempotency-Key: chair-front-preview-001' \
  -F 'image=@chair.jpg;type=image/jpeg' \
  -F 'prompt=Oak chair with a woven seat' \
  -F 'isPublic=false'
```

```js
// Server-side JavaScript. Upload first; persist the creation key and returned render ID.
const headers = { Authorization: `Bearer ${process.env.EASYRENDER_API_KEY}` };
const form = new FormData();
form.set('image', new Blob([photoBytes], { type: 'image/jpeg' }), 'chair.jpg');
const uploadResponse = await fetch('https://easyrender.ai/api/uploads', { method: 'POST', headers, body: form });
if (!uploadResponse.ok) throw new Error(await uploadResponse.text());
const upload = await uploadResponse.json();
const response = await fetch('https://easyrender.ai/api/renders', {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': 'chair-front-preview-001' },
  body: JSON.stringify({ upload_id: upload.id, isPublic: false }),
});
if (!response.ok) throw new Error(await response.text());
const render = await response.json(); // Save render.id before polling or spending.
```

```python
# Python standard library: poll an ID without submitting another job.
import json, os, urllib.request
request = urllib.request.Request(
    'https://easyrender.ai/api/renders/' + render_id,
    headers={'Authorization': 'Bearer ' + os.environ['EASYRENDER_API_KEY']},
)
with urllib.request.urlopen(request, timeout=30) as response:
    render = json.load(response)
# Treat ready + hasModel as completion; handle HTTP errors before any paid retry.
```

## Render lifecycle, discovery and downloads

| State | Meaning and client behavior |
| --- | --- |
| `drafting` | Preview pending. Poll the existing ID with bounded backoff. |
| `preview_ready` | Preview can be reviewed. The paid build still requires authorized spend. |
| `rendering` | Build pending. Poll; do not create a replacement. |
| `ready` with `hasModel:true` | Deliver the existing GLB/page. |
| `failed` | Terminal attempt; report the error. A new attempt needs retry scope and budget. |

`GET /api/renders?limit=25&cursor=...&status=ready` returns
`{renders, balance, nextCursor}`. Limit is 1–100 (default 25); status is optional. Follow the opaque
`nextCursor` until null, preserving the same filters. Order is newest `createdAt`, then ID.
Malformed cursor/limit/status returns 400. Listing does not advance jobs; poll a particular ID to
observe an active job. Use the list to recover an ID after a lost response when necessary.

`GET /api/renders/{id}` returns the current view. `POST .../{id}/render` starts the paid 3D build;
`POST .../{id}/sheet` starts the paid sheet and `POST .../{id}/sheet/redraw` accepts `{note}` for a
paid revision. `PATCH .../{id}` accepts `{isPublic}`. `GET .../{id}/model` serves textured GLB
(`model/gltf-binary`); optional `?download=1` requests a download. `/preview`, `/source` and `/qr` serve the corresponding assets. The preview endpoint serves the
angle sheet (or fallback source), watermarked until paid; `/sheet` is a POST action, not a download. Asset links can exist before assets are ready.
There is **no REST USDZ/STL export or conversion contract**.

`GET .../{id}/materials` reads generated material definitions and saved edits.
`PUT .../{id}/materials` accepts `{edits:[{index,baseColor?,roughness?,metalness?}]}`.
Color is RGB; color components, roughness and metalness are 0–1. The list replaces all edits;
`{edits:[]}` resets the generated look. Inspect existing material indices before writing.

## Product views, upscales and store catalogs

| Endpoint | Behavior |
| --- | --- |
| `POST /api/product-views` | Paid image-to-view-set creation; returns 201 and a view-set ID. |
| `GET /api/product-views` | Recent owned sets and balance. This collection is not cursor-paginated. |
| `GET /api/product-views/{id}` | Poll a view set; includes per-view readiness and operation costs. |
| `POST .../{id}/views/{view}/polish` | Paid revision of one view, with `{note}`. |
| `GET .../{id}/views/{view}` or `.../{id}/zip` | Download a finished image or ZIP. |
| `POST /api/product-views/{id}/render` | Create/reuse a render draft from final views; returns `{renderId}`. Does not itself pay for/build the model. |
| `POST /api/upscales` | `{kind:"sheet",renderId}` or `{kind:"view",viewSetId,view}`; returns 202. Reuses an existing upscale of that same picture. |
| `GET /api/upscales?renderId=...` or `?viewSetId=...` | List owned enlargements. |
| `GET /api/upscales/{id}` and `.../{id}/image` | Poll and download. |
| `GET /api/catalog/quote?items=N` | Live estimate, balance, missing credits and per-request batch limit. |
| `POST /api/catalog` | `{platform,store,maxCredits,items:[{externalId,title,imageUrl,note?}]}`; approve and queue up to 100 store products. |
| `GET /api/catalog?platform=...&store=...` | Items, summary and balance; advances the already authorized queue. |
| `DELETE /api/catalog?platform=...&store=...` | Forget store references; keeps existing renders. |

Catalog platforms: `shopify`, `woocommerce`, `prestashop`, `other`. Images must be public HTTPS.
`maxCredits` is the approved total for that submission; insufficient approval is rejected. Model
links are shared for product embeds, so catalog submission explicitly requires `share`. Poll states
include `queued`, `drafting`, `building`, `ready`, `needs_credits`, `needs_info`, `failed`. Stop and
resolve actionable states rather than repeatedly submitting. Catalog is a REST store-integration
workflow, not a general MCP batch tool.

## Errors, throttling and retries

REST errors use `{error, code, request_id, retryable}`. Preserve the `X-Request-Id` response header
and error `request_id`; never include keys in reports. 401 means invalid/expired/revoked authentication;
403 means authorization/scope/key-budget failure; 402 means insufficient wallet balance;
400/413/415/422 indicate invalid/oversized/unsupported input; 404 avoids exposing another owner's
private resource; 409 can indicate an idempotency conflict or incompatible state. Check the actual
`code`, since HTTP status alone does not identify the cause.

429 returns `Retry-After` for rate/concurrency limits. Honor it, add jitter, and bound retries.
Do not evade quotas with different keys/accounts. A boolean `retryable` indicates a known retryable
condition, not permission to spend twice. For a timed-out mutation, read the resource first. Only
preview creation has the documented `Idempotency-Key` contract; do not assume arbitrary paid POSTs
support it. A 500 or network error does not prove the mutation failed. Never automatically replay
an uncertain paid/provider submission. For safe GETs, retry transient failures with bounded backoff.

## MCP tools

Connect to `https://easyrender.ai/api/mcp` using Streamable HTTP and OAuth or a bearer key. Discover
`tools/list` on the connected server: input and output schemas are authoritative for that deployment.
Tool successes include `structuredContent` and the same JSON in a text content block. Failures set
`isError:true` and use `{error:{code,message,status,retryable,retry_after_seconds?}}`; do not mistake them for render data.

| Tool | Input / behavior |
| --- | --- |
| `create_render` | Exactly one of `image_url`, `image_base64`, `upload_id`; `content_type` for base64; optional `prompt`, `name` (max 120 characters), `idempotency_key`, `is_public`. Free preview. |
| `get_render` | `{id}`; render view, `pending_credits`, links. |
| `list_renders` | Optional `cursor`, `limit`, `status`; returns `renders` and `next_cursor`. |
| `get_credits` | Current account quote and balance. |
| `render_3d` | `{id,max_credits?}`; paid build. Supply the approved ceiling even where optional for older clients. |
| `set_render_visibility` | `{id,is_public}`; explicit publication control. |
| `start_render_sheet` | `{id,max_credits}`; paid sheet. |
| `redraw_render_sheet` | `{id,note,max_credits}`; paid redraw. |
| `upscale_image` | `{kind,render_id?}` or `{kind,view_set_id?,view?}`, plus `max_credits`. |
| `get_upscale` | `{id}`; poll upscale. |
| `create_product_views` | Same exclusive image source, optional `prompt`/`name`, plus `max_credits`. |
| `get_product_views` | `{id}`; view-set state and operation costs. |
| `list_product_views` | Optional `limit` (1–100, default 24); newest sets in `view_sets`, with ZIP links. Bounded list, no cursor. |
| `list_upscales` | Exactly one of `render_id`, `view_set_id`; returns `upscales` with image links, bounded to 50 current sources. |
| `polish_product_view` | `{id,view,note,max_credits}`; paid revision of one view. Each sequential revision is a new charge. |
| `build_from_product_views` | `{id,max_credits}`; create/reuse the render and start the approved paid build. |

MCP input uses snake_case where shown; core view fields remain camelCase. `max_credits` is a ceiling
for that operation and does not replace the user's overall task budget or the key's lifetime cap.
The REST `POST product-views/{id}/render` only prepares a draft; MCP `build_from_product_views` also
starts its paid build.

MCP URLs must be public HTTPS images; fetches reject private-network destinations. Raw base64 has no
data-URL prefix and is limited to **3 MiB minus 16 KiB decoded** to fit the request envelope; URL and
upload-ID inputs retain the **4 MiB** image limit. Prefer `/api/uploads` for larger local files.
Never send both sources, expose a private photo on another host merely for a URL, or send an
easyrender credential to the image host. No native batch, cancellation, refund or export-conversion
MCP tools are promised. The reusable [image-to-3D skill](../skills/easyrender-image-to-3d/SKILL.md)
covers user authorization, inspection and recovery without duplicate spend.
