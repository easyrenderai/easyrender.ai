# n8n-nodes-easyrender

Connect easyrender product photos and 3D model workflows to n8n. This package is
published on npm as `n8n-nodes-easyrender`. n8n community verification is pending.

## Requirements and credentials

Use Node.js 22 or later for development. In [easyrender Connectors](https://easyrender.ai/connectors),
create an `er_` API key with `read` and `write` scopes. In n8n, create an
**Easyrender API** credential and paste only the key. The credential test reads
`GET /api/credits`; it does not submit a render. Read-only workflows need only `read`.
The key is sent as `Authorization: Bearer …` to `https://easyrender.ai/api`.

Create Render requires REST `image_url` support. See the [API contract](../../docs/api.md).
No base URL override is exposed.

## Operations

| Node / operation                 | Behavior                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| easyrender / Create Render       | Creates a private preview from a public HTTPS image URL. Requires a stable idempotency key.                              |
| easyrender / Get Render          | Reads status, downloads available images into Binary, and adds viewer/model links.                                       |
| easyrender / List Renders        | Returns one envelope with `renders`, `balance`, `nextCursor`; retain filters and pass that cursor to fetch another page. |
| easyrender / Get Credits         | Returns current account usage information.                                                                               |
| easyrender Trigger / Model Ready | Polls one configured render ID. Emits only `status=ready` and `hasModel=true`.                                           |

Creation starts a preview. Review the preview and angle sheet, then start the 3D build
separately in easyrender. No spend or share scope is needed by these nodes.
Images must be public HTTPS JPEG, PNG or WebP, at most 4 MiB. The easyrender server
fetches the photo through its protected image loader; n8n never sends the API key to the image host.

Map a stable source event ID into **Idempotency Key** (1–128 printable ASCII characters,
no spaces). Reuse the same key and exact image/input after a lost response. Do not
retry with a fresh key or silently change the image at the same URL.

## See the result in n8n

1. **Create Render** starts a preview and returns an `id`. It does not start the 3D build.
2. After a Wait step, use **Get Render** with that ID and **Download Images** enabled
   (the default). Open the node's **Output → Binary** tab, then **View** on `preview`
   or `sheet` to inspect the image. PNG, JPEG and WebP keep their response MIME type
   and matching filename extension.
3. Open `viewerUrl`, sign in as the owner for a private render, and create/review the
   angle sheet before starting **Build 3D** in easyrender.
4. Run Get Render again, or use **Model Ready** in a separate workflow with the fixed
   render ID. When ready, inspect the images in Binary and use the model links in JSON.

Both Get Render and Model Ready preserve all existing JSON fields and add:

| Field       | Meaning                                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `viewerUrl` | `https://easyrender.ai/r/<id>`; public renders are viewable publicly, private renders require owner access. This does not publish a render.                         |
| `glbUrl`    | Model download endpoint when `status=ready` and `hasModel=true`; otherwise `null`. Private downloads require the same bearer API key (or an owner browser session). |
| `usdzUrl`   | `null`: USDZ is converted in the browser, with no server download URL. Open the viewer and choose USDZ to export it.                                                |
| `summary`   | A readable status and next step, such as `Ready - 3D model available`.                                                                                              |

The API's `/preview` endpoint returns the photo before a sheet exists, and the angle
sheet once available. `binary.preview` contains that current preview; when `hasSheet`
is true, `binary.sheet` also exposes the sheet with its own filename. Both refer to
the same downloaded asset, fetched once. Private image requests use your Easyrender API
credential; credentials are never put in output links or forwarded through redirects.
Missing images (absent flags, HTTP 404 or 410) leave JSON intact without binary data.
Other download errors are surfaced so authentication and service failures remain visible.
Disable **Download Images** to return only JSON and links.

Import [the example workflow JSON](examples/see-result-in-n8n.json), select your Easyrender
API credential in both Easy Render nodes, and replace the example image URL and
idempotency key. It creates a preview, waits, and reads the result with images enabled.
The wait is not a completion guarantee: if still processing, run Get Render again with
that ID. Review and start the 3D build in the viewer, then run Get Render for model links.
For production automation, use a bounded wait/poll loop with ready/failed checks.

To download a private GLB within n8n, add an **HTTP Request** node: GET `{{$json.glbUrl}}`,
Authentication → Predefined Credential Type → Easyrender API, Response Format → File.
Images are already present in the Easy Render output; a GLB remains a file, not an
interactive 3D viewport inside n8n.

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
npm run build
npm test
npm pack --dry-run
npm run dev
```

The official `@n8n/node-cli` handles build, icon copying, local development and linting.
`npm test` builds and exercises the actual node methods with a fake n8n transport; it
never contacts production. For a hosted/editor smoke test, use the example above with
an authorized test key. Source follows the [n8n starter](https://github.com/n8n-io/n8n-nodes-starter).
The package has no runtime dependencies, environment access or filesystem access in its nodes.

Self-hosted users can install `n8n-nodes-easyrender` via Settings →
Community Nodes. Cloud discovery requires n8n verification; do not claim that status
until approved. See [listing and release instructions](../../docs/integrations/LISTING.md).

## Compatibility and support

Built against `n8n-workflow` 2.16.0 with node API version 1. The wildcard peer follows
n8n's starter convention; it is not evidence of testing every older n8n release.
Support: [GitHub issues](https://github.com/easyrenderai/easyrender.ai/issues).
Licensed under [MIT](LICENSE.md).
