# One photo → private GLB

These executable server-side examples use Python 3.10+ standard library or Node.js 24+
(native TypeScript support). No SDK or packages are needed. They call the real easyrender API;
**an approved build spends real credits**. The key needs `read`, `write` and `spend`; these examples
never publish and do not need `share`.

Set `EASYRENDER_API_KEY` securely in your shell or process environment. Do not put it in code,
command arguments, screenshots, checkpoint files or browser bundles. Download
[`render.py`](render.py) or [`render.ts`](render.ts), and keep local checkpoints outside Git.

## 1. Create and inspect one preview

```sh
python3 examples/rest/render.py \
  --image ./product.jpg \
  --idempotency-key product-front-preview-001 \
  --state /tmp/product-job.json

# Equivalent TypeScript command:
node examples/rest/render.ts \
  --image ./product.jpg \
  --idempotency-key product-front-preview-001 \
  --state /tmp/product-job.json
```

Choose **one** implementation. Each command uploads one JPEG, PNG or WebP (maximum 4 MiB),
creates a private preview and prints its ID, pending debit and current balance. Inspect the preview
in your signed-in account before approving a build. Previews have service limits; the examples
never iterate through replacement photos or bypass a limit.

Use one stable creation key for the same photo/input. The checkpoint persists the upload ID,
photo hash and creation key before the preview request. A rerun resumes its saved render ID;
if the creation response was lost it can repeat the same idempotent creation request. No request
is automatically replayed after a failed mutation. Upload references expire after one hour: if
creation recovery then returns 404, recover the render through `GET /api/renders` or the account
library. Do not change the creation key just because a response was lost.

## 2. Explicitly approve a ceiling and download

Set `APPROVED_MAX_CREDITS` to the **integer credit ceiling the user authorized** after inspecting
the preview and its live quote. It is a spending limit, not a hard-coded price.

```sh
python3 examples/rest/render.py \
  --state /tmp/product-job.json \
  --approve-build --max-credits "$APPROVED_MAX_CREDITS" \
  --output ./product.glb \
  --receipt ./product-receipt.json

# Or use node examples/rest/render.ts with the same arguments.
```

The client compares the render's remaining debit with both the approved ceiling and the wallet
balance, then sends `{maxCredits}` to the build endpoint. The server checks that limit again in
the debit transaction; the API key's own lifetime budget and scopes may still refuse the charge.
This requires a deployment containing the REST `maxCredits` contract described in
[docs/api.md](../../docs/api.md). Do not assume an older server enforces an unknown JSON field.

Before submitting a build the checkpoint records that it was attempted. A lost response, 503 or
request timeout never causes an automatic paid retry. Rerunning polls that same ID; if it remains
`preview_ready`, the example stops and requires the uncertain attempt to be resolved. It does not
clear its marker or create a new render. A terminal failed job also stops. An existing ready or
running render can be resumed without creating anything:

```sh
node examples/rest/render.ts \
  --render-id YOUR_EXISTING_RENDER_ID \
  --state /tmp/existing-job.json --output ./existing.glb
```

Outputs are created exclusively; an existing GLB is never overwritten. Checkpoints are written
atomically and a `.lock` prevents concurrent use of the same file. If a process is killed, verify
it is no longer running before removing a stale lock. Keep using the saved ID and inspect the
job before authorizing any new mutation.

## Timeouts, downloads and receipts

Defaults: 30 seconds per request, 600 seconds for the current invocation, 5 seconds between polls.
Override with `--request-timeout-seconds`, `--timeout-seconds`, `--poll-seconds`. Only GET responses
429/502/503/504 receive bounded retries (at most three requests), honoring numeric `Retry-After`
within the invocation deadline. Date-form delays stop safely for manual retry. Authentication,
invalid input, malformed responses and insufficient budgets stop immediately.

The GLB download is built from the trusted API origin and validated render ID. Response-provided
URLs are ignored, all redirects are refused, and the authorization header is never forwarded to
another host. Successful downloads must have the GLB content type, header/version and declared
length, and stay below 128 MiB. These are transport sanity checks, not full geometry validation.
An alternate `--base-url` must be a trusted HTTPS API origin without credentials, path or query.
Local testing additionally requires `--allow-local-http` and a loopback origin. Never point a real
key at an untrusted API host.

The optional receipt contains only the render ID, ready state, GLB size, observed render credits,
quoted pending credits, approved ceiling and elapsed seconds for **this invocation**. `isResumed`
and `timingScope: "this_invocation"` prevent treating a resumed download as a full-generation
benchmark. A receipt is not a payment-ledger audit, proof of a refund or evidence of an unedited
marketing demo. No receipt includes an API key, source-image URL or local source path.

## Smoke tests — no production calls or spending

```sh
python3 examples/rest/test_smoke.py
```

The shared test starts a local fake HTTP server and runs **both actual CLI programs**. It covers
creation/build/download, preview-only default, ID recovery, live budget validation, malformed
states, authentication errors, transient GET backoff, uncertain mutation recovery, timeouts and
redirect rejection. Test photos and minimal GLB bytes are synthetic fixtures, not sample renders.
