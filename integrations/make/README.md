# easyrender Make custom app

Copyable Make app-builder panels for a private app and subsequent review submission.
`app.json` is an assembly manifest, **not** a scenario blueprint or an importable Make
API export. Each other JSON file maps directly to a named builder panel. No account,
connection, scenario or app has been created on Make.

## Assemble the app

1. With an authorized Make account, open **Custom apps → Create a new app**. Use
   `easyrender` as the app name/label, version 1, English, and the theme in `app.json`.
   Use the brand icon from `../n8n/nodes/Easyrender/easyrender.svg`.
2. Paste `base.json` into **Base**. Leave **Common data** empty.
3. Create a **Basic connection** named `easyrender`. Paste
   `connection/parameters.json` into **Parameters** and `connection/communication.json`
   into **Communication**. Leave Common data empty. The connection tests `/api/credits`.
4. For each entry in `app.json.modules`, create the specified module type, name, label
   and description, and select the `easyrender` connection. Paste that directory's
   `communication.json`, `interface.json`, and `samples.json` into their matching tabs.
   Paste `parameters.json` into **Mappable parameters**. For `modelReady`, paste
   `static-parameters.json` into **Static parameters**. Other Static parameters are `[]`.
5. The selected-ID polling trigger needs no historical Epoch lookup. Leave **Epoch**
   empty/default; choose **All** when starting its test so the selected model can emit
   on completion. Do not choose a date-based start for this ID trigger. For another
   render, create a new trigger/scenario to avoid reusing the previous ID checkpoint.
6. Save the app and use it privately in test scenarios. Use an `er_` API key from
   [easyrender Connectors](https://easyrender.ai/connectors); read/write scopes cover the
   dedicated modules. The universal module may require further scopes for chosen endpoints.
7. Deploy this PR's REST `image_url` support before testing Create a Render. No deployment
   or publication is performed by this package.

## Modules and semantics

| Module              | Behavior                                                                            |
| ------------------- | ----------------------------------------------------------------------------------- |
| Create a Render     | Public HTTPS JPEG/PNG/WebP → private free preview; stable Idempotency Key required. |
| Get a Render        | Current render/status by ID, including active-job polling.                          |
| List Renders        | Status filter; follows `nextCursor` with page size 100 up to the user limit.        |
| Get Credits         | Reads the live balance and quote.                                                   |
| Watch a Ready Model | Polls one configured ID, returning it only when ready with a model.                 |
| Make an API Call    | Fixed easyrender origin, validated relative path, query string and JSON body.       |

Create a Render does not start a paid 3D build. Review and authorize that separately
in easyrender. The trigger is the starting module, so its ID is configured in advance,
not mapped from an upstream creation step. For dynamically created jobs use a scheduled
scenario reading saved IDs through Get a Render and a ready/failed filter. Model Ready
is not an account-wide feed; no customer webhook subscription endpoint exists.

Preview creation is private and idempotent. Reuse the exact image/input and key after
a lost response. Never rotate the idempotency key merely to retry. No API key is sent
to the image URL; the server's protected fetcher loads it. Downloads from
`/api/renders/{id}/model` require owner authentication unless explicitly made public elsewhere.

List Renders emits one bundle per render and stops at the requested limit or end of
pages. Make also imposes platform pagination/time limits. This module does not persist
a cursor across scenario runs; it is not a lossless account completion trigger.

The universal module permits explicit API mutations, including paid endpoints. Read
[docs/api.md](../../docs/api.md), obtain authorization, and pass an approved `maxCredits`
ceiling for paid work. Do not enable automatic replay for uncertain paid submissions.
Use only the dedicated Create a Render module for preview creation with its idempotency key.

## Errors and review scenarios

Base and Connection both redact Authorization and handle invalid keys and rate limits.
On 429, wait at least the server's `Retry-After` before retrying. Other errors preserve
`code` and `request_id`. A failed render is an error in the trigger, not a ready event.

Before requesting review, run and retain recent logs for:

- Create a Render → Get a Render → Get Credits, using a test product photo.
- List Renders with enough owned test renders to cross a page boundary.
- Watch a Ready Model while a separately authorized model finishes, then again to
  check no duplicate bundle; also test a failed render and an invalid ID.
- Make an API Call with `GET /credits` and an empty body/query string.
- A revoked test key and a failed request, verifying errors and secret redaction.

```sh
cd integrations/make
npm test
```

The local check validates panel JSON, IML delimiters, fields, auth redaction, pagination
and completion predicates. It does **not** execute Make's proprietary IML runtime or
replace live app-builder scenario validation. No JavaScript custom IML functions are needed.
For the remaining publishing steps, see [LISTING.md](../../docs/integrations/LISTING.md).
