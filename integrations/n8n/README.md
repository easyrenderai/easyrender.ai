# n8n-nodes-easyrender

Connect easyrender product photos and 3D model workflows to n8n. This is the
source package for a community node submission; it is not yet published or verified.

## Requirements and credentials

Use Node.js 22 or later for development. In [easyrender Connectors](https://easyrender.ai/connectors),
create an `er_` API key with `read` and `write` scopes. In n8n, create an
**Easyrender API** credential and paste only the key. The credential test reads
`GET /api/credits`; it does not submit a render. Read-only workflows need only `read`.
The key is sent as `Authorization: Bearer …` to `https://easyrender.ai/api`.

**Deployment prerequisite:** deploy this PR's REST `image_url` support before using
Create Render. See the [API contract](../../docs/api.md). No base URL override is exposed.

## Operations

| Node / operation                 | Behavior                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| easyrender / Create Render       | Creates a private free preview from a public HTTPS image URL. Requires a stable idempotency key.                         |
| easyrender / Get Render          | Reads a render and advances its current job status.                                                                      |
| easyrender / List Renders        | Returns one envelope with `renders`, `balance`, `nextCursor`; retain filters and pass that cursor to fetch another page. |
| easyrender / Get Credits         | Returns the live account quote and balance without hard-coded prices.                                                    |
| easyrender Trigger / Model Ready | Polls one configured render ID. Emits only `status=ready` and `hasModel=true`.                                           |

Creation does not start a paid 3D build. Review the preview and authorize the build
separately in easyrender. No spend or share scope is needed by these nodes.
Images must be public HTTPS JPEG, PNG or WebP, at most 4 MiB. The easyrender server
fetches the photo through its protected image loader; n8n never sends the API key to the image host.

Map a stable source event ID into **Idempotency Key** (1–128 printable ASCII characters,
no spaces). Reuse the same key and exact image/input after a lost response. Do not
retry with a fresh key or silently change the image at the same URL.

## Example workflows

1. A product webhook provides `image_url`, `event_id` and `name`.
2. Add easyrender → Create Render; map those fields to Image URL, Idempotency Key and Name.
3. Save the returned `id` with the source product.
4. Use Get Render after a Wait node to check the preview. Review and start the build in easyrender.
5. In a separate active workflow, configure easyrender Trigger with that render ID,
   a polling interval of a minute or longer, and a downstream delivery step.

The trigger watches a **single configured ID**, not all account renders. n8n workflow
static data suppresses repeats after a successful active execution. Manual tests return
an already-ready model without consuming the event. For a different render, use a new
trigger instance. Failed jobs raise an error. Workflows may be retried by the host,
so downstream delivery should also use the render ID for deduplication.

For dynamic pipelines, use scheduled Get Render steps for IDs saved by Create Render,
with a ready/failed condition and a bounded wait. The trigger cannot take an upstream
item because it is the workflow's starting node. An account-wide completion feed is
not promised: the API lists by creation time, not completion time.

Private model downloads require owner authentication at `/api/renders/{id}/model`;
passing that URL to a third party does not grant access. These nodes do not publish models.

## Errors

401: reconnect; 403: check scopes; 404: check ID and ownership; 409: reuse the original
idempotency key with the original input; 429: wait at least `Retry-After` before a retry.
The HTTP helper surfaces API failures. No automatic retries are implemented in this package.
Inspect an uncertain job by ID before retrying a mutation; preserve `request_id` for support.

## Local development and validation

```sh
cd integrations/n8n
npm ci
npm run lint
npm test
npm pack --dry-run
npm run dev
```

The official `@n8n/node-cli` handles build, icon copying, local development and linting.
`npm test` builds and exercises the actual node methods with a fake n8n transport; it
never contacts production. For a hosted/editor smoke test, use the example above with
an authorized test key. Source follows the [n8n starter](https://github.com/n8n-io/n8n-nodes-starter).
The package has no runtime dependencies, environment access or filesystem access in its nodes.

After publication, self-hosted users can install `n8n-nodes-easyrender` via Settings →
Community Nodes. Cloud discovery requires n8n verification; do not claim that status
until approved. See [listing and release instructions](../../docs/integrations/LISTING.md).

## Compatibility and support

Built against `n8n-workflow` 2.16.0 with node API version 1. The wildcard peer follows
n8n's starter convention; it is not evidence of testing every older n8n release.
Support: [GitHub issues](https://github.com/easyrenderai/easyrender.ai/issues).
Licensed under [MIT](LICENSE.md).
