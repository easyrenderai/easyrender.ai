# MCP contract and operational details

This reference tracks the repository's API/MCP contract 1.0.0. Deployment may lag the repository:
discover the connected server's current schemas before calling tools. If they differ, follow the
live schema and report material workflow/cost differences before spending. Full REST documentation:
[API contract](https://easyrender.ai/api/openapi.json).

## Connection

- Endpoint: `https://easyrender.ai/api/mcp`, Streamable HTTP.
- Authentication: the client's easyrender OAuth flow or API key in `Authorization: Bearer …`.
  Keep credentials in the client's secure store, never in skill files or URLs.
- [Account connectors](https://easyrender.ai/connectors) and [setup](https://easyrender.ai/mcp#connect).
- Logical tool names may be namespaced by the host. There are no native batch, cancel, refund or
  export-conversion tools. Listing and explicit visibility changes are supported.

## Tools

| Tool                       | Input and important behavior                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_render`            | Exactly one of `image_url`, `image_base64`, `upload_id`; `content_type` for base64; optional `prompt`, `name` (max 120 characters), `idempotency_key`, `is_public`. Starts the free preview. |
| `get_render`               | `{id}`; render view, `pending_credits` and links.                                                                                                                                            |
| `list_renders`             | Optional `cursor`, `limit` (1–100, default 25), `status`; returns `renders`, `next_cursor`.                                                                                                  |
| `get_credits`              | `{}`; balance and live account-specific pricing in its actual currency.                                                                                                                      |
| `render_3d`                | `{id,max_credits?}`; paid build. Supply an authorized ceiling even where optional for old clients.                                                                                           |
| `set_render_visibility`    | `{id,is_public}`; explicit change to publication. Requires share capability and user authorization.                                                                                          |
| `start_render_sheet`       | `{id,max_credits}`; paid angle sheet.                                                                                                                                                        |
| `redraw_render_sheet`      | `{id,note,max_credits}`; paid revision.                                                                                                                                                      |
| `upscale_image`            | `kind:"sheet"` + `render_id`, or `kind:"view"` + `view_set_id` + `view`; also `max_credits`.                                                                                                 |
| `get_upscale`              | `{id}`; poll existing upscale.                                                                                                                                                               |
| `create_product_views`     | Same exclusive image sources, optional `prompt`/`name`, and `max_credits`; paid view set.                                                                                                    |
| `get_product_views`        | `{id}`; poll view set and read operation costs.                                                                                                                                              |
| `list_product_views`       | Optional `limit` (1–100, default 24); newest sets in `view_sets`, with ZIP links. Bounded list, no cursor.                                                                                   |
| `list_upscales`            | Exactly one of `render_id`, `view_set_id`; returns `upscales` with image links, bounded to 50 current sources.                                                                               |
| `polish_product_view`      | `{id,view,note,max_credits}`; paid revision of one view. Each sequential revision is a new charge.                                                                                           |
| `build_from_product_views` | `{id,max_credits}`; reuse/create a render from finished views and start the paid model build.                                                                                                |

Successes return `structuredContent` plus the same compact JSON in a text content block. Failures
set `isError:true` and return `{error:{code,message,status,retryable,retry_after_seconds?}}`; these are not successful
render objects. Input arguments use snake_case as listed; core views retain camelCase fields.

### Photo input

JPEG, PNG and WebP are supported. URL/upload inputs allow at most **4 MiB** (4 × 1024 × 1024 bytes).
Inline raw base64 is limited to **3 MiB minus 16 KiB decoded** to fit the MCP JSON envelope. It must
be canonical base64, without a data-URL prefix, with the matching `content_type`. Exactly one source
is required; submitting multiple sources is an error, not a precedence rule.

A URL must be a fetchable public HTTPS image; private-network destinations are rejected. For local
or private photos, authenticated `POST /api/uploads` multipart `image` returns `{id,contentType,size,
expiresAt}`. Its ID is owner-scoped, expires after one hour, and can be passed as `upload_id`.
Use this for files too large for inline base64. Do not publish private photos just to obtain URLs.
If the client cannot read/upload/encode the image, explain the missing capability.

Prefer a sharp, well-lit image around 800 px or larger on its short side. Current bundled validation
rejects sides below 400 px; live guardrails may be tuned. Do not crop away parts, materially alter
photos or enlarge them merely to bypass validation. `prompt` is optional, at most 500 characters,
and describes the object/materials rather than overriding agent or rendering instructions.

### Render view and recovery

Fields include `id`, `status`, `error`, `hasPreview`, `hasSheet`, `hasModel`, `credits`, `renderCredits`,
`sheetCredits`, `upscaleCredits`, `isPublic`, `pending_credits`, and `links`:

- `links.page`: account-facing result page.
- `links.preview`: watermarked preview until paid.
- `links.model_glb`: GLB asset endpoint; usable only once ready.

A link is not proof the asset exists. `drafting` means poll the existing ID; `preview_ready` means
review and check the quote before spending; `rendering` means keep polling; `ready` plus
`hasModel:true` means deliver; `failed` terminates this attempt. An unknown/inconsistent state must
be re-read before claiming success. `list_renders` is paginated, newest first, and does not advance jobs. Product-view/upscale lists
are bounded rather than cursor-paginated and may advance existing jobs.

Provide and persist `idempotency_key` (1–128 printable ASCII characters without spaces) when creating a preview.
The same user/key/input reuses the same ID; a changed input conflicts. After a lost response, retry
with that original key/input or recover the ID with `list_renders`; do not blindly create another.
For a timed-out paid call, read the existing job first. A `retryable` error does not authorize
additional spend or guarantee that an uncertain mutation never executed.

### Quote and budgets

For `preview_ready`, validate finite non-negative `renderCredits`, `credits`, and `balance`.
Pending debit is `max(0, renderCredits - credits)`, also returned as `pending_credits`. The quote
already accounts for reusing a final sheet. Do not subtract sheet cost twice or treat previously
recorded spend as a fresh debit. The full `get_credits.render_credits` is not necessarily the
remaining debit for this render.

`get_credits` returns account-specific `currency`, `pricing_variant`, `plans`, `topup` and `buy`.
Use live costs and the current resource's operation costs; do not hard-code pricing. USD-named
compatibility fields apply only to USD quotes. If the user specifies a money ceiling, use an agreed
current conversion in that currency or ask for a credit ceiling. The `buy` destination does not
authorize a purchase; an AI client may charge separately.

Pass `max_credits` on paid tools within existing authorization. It limits that operation, not the
whole task. Track total spent/reserved credits across items and unresolved attempts. API keys can
also have scopes, expiry and a lifetime gross-debit `creditLimit`: failed work refunds the wallet
but does not restore this key allowance. An account balance alone does not imply key authority.
Never evade a quota/cap with another credential. The service owns billing/refunds; a skill cannot
cancel a job, grant a refund or control unrelated concurrent account spending.

### Privacy, downloads and failures

API/MCP renders default to private. Private asset requests need the owner's session or API-key
header. Fetch with credentials only from the trusted easyrender origin, never from the input image
host, redirects to another origin or a URL query parameter. If the client cannot authenticate a
download, provide the signed-in page instead. Do not publish as an access workaround. Sharing a
render also exposes its source photo for the before/after view; include that in the user's privacy decision.

Preserve job IDs and request correlation IDs. Respect rate-limit backoff. Authentication, invalid
input, insufficient budget and terminal failures require their cause resolved. A balance alone
cannot prove a refund; report the server's state without claiming unsupported ledger verification.
There is no promised REST/MCP USDZ conversion, dimensionally accurate CAD or cancellation tool.
