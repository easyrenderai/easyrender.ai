# easyrender

[easyrender](https://easyrender.ai) turns one photo of a product into a 3D model. Upload a photo,
check a free angle preview, and spend credits only if you want the finished textured model, which
downloads as GLB and USDZ. It models one object at a time, not whole rooms, and the geometry is
approximate (no guaranteed real-world dimensions).

You can use it three ways: the [web app](https://easyrender.ai), the [REST API](#rest-api), or
the [MCP server](#mcp-server) so an AI agent can run the whole workflow for you.

## MCP server

Remote server over Streamable HTTP: `https://easyrender.ai/api/mcp`

Authenticate with OAuth sign-in (claude.ai, Codex and any OAuth-capable client) or with an API
key created on the [Connectors page](https://easyrender.ai/connectors). Every connection can be
revoked there. Connecting and reading your balance cost no credits; paid tools spend credits from
the same wallet as the web app.

```sh
# Claude Code (OAuth: run /mcp inside Claude Code and sign in)
claude mcp add --transport http easyrender https://easyrender.ai/api/mcp

# Claude Code with an API key
claude mcp add --transport http easyrender https://easyrender.ai/api/mcp \
  --header "Authorization: Bearer er_your_key"

# Codex
codex mcp add easyrender --url https://easyrender.ai/api/mcp
codex mcp login easyrender
```

Setup for claude.ai, Cursor, VS Code and Claude Desktop is on the
[MCP page](https://easyrender.ai/mcp#connect).

The core workflow uses four tools. The server exposes 16 in total (below); ask the client for `tools/list`
for the current schemas.

| Tool                                                                                                                 | What it does                                                            |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `create_render`                                                                                                      | Start a free preview from one photo (URL, upload id or base64)          |
| `get_render`                                                                                                         | Read status, links and the credits still needed                         |
| `get_credits`                                                                                                        | Read your balance and the current cost of each operation                |
| `render_3d`                                                                                                          | Build the approved preview into a GLB, with a `max_credits` ceiling     |
| `list_renders`                                                                                                       | Find and resume your renders                                            |
| `set_render_visibility`                                                                                              | Publish or unpublish a finished render (renders are private by default) |
| `start_render_sheet`, `redraw_render_sheet`                                                                          | Generate or redraw the angle sheet                                      |
| `create_product_views`, `get_product_views`, `list_product_views`, `polish_product_view`, `build_from_product_views` | Product photo sets and 3D from a set                                    |
| `upscale_image`, `get_upscale`, `list_upscales`                                                                      | Enlarge a product view or sheet                                         |

Paid tools accept a `max_credits` ceiling, and `render_3d` refuses to run above it. A failed 3D build refunds its
credits. See [current pricing](https://easyrender.ai/pricing).

Also listed in the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.easyrenderai/easyrender)
as `io.github.easyrenderai/easyrender` (see [`server.json`](server.json)).

## Agent skill

[`easyrender-image-to-3d`](skills/easyrender-image-to-3d/SKILL.md) teaches an agent the whole
flow: pick a photo, review the free preview, quote the cost, build with an approved budget, poll,
and deliver the GLB without double spending.

```sh
npx skills add easyrenderai/easyrender.ai --skill easyrender-image-to-3d
```

Installing the skill does not connect your account; connect the MCP server first. More options in
[`skills/README.md`](skills/README.md). A standalone mirror lives in
[`easyrenderai/easyrender-image-to-3d`](https://github.com/easyrenderai/easyrender-image-to-3d),
and the skill is listed on
[skills.sh](https://www.skills.sh/easyrenderai/easyrender-image-to-3d/easyrender-image-to-3d) and
[ClawHub](https://clawhub.ai/jorgerl02/skills/easyrender-image-to-3d). The skill is MIT-licensed
([`LICENSE`](skills/easyrender-image-to-3d/LICENSE)).

## REST API

The same account, keys and credits work over REST. Contract and examples:
[`docs/api.md`](docs/api.md), [`examples/rest`](examples/rest) (Python and TypeScript), and the
OpenAPI schema at <https://easyrender.ai/api/openapi.json>.

## Plugins

Store plugins live in [`plugins`](plugins): Shopify, WooCommerce and PrestaShop.

## Repository layout

| Path               | Contents                                                         |
| ------------------ | ---------------------------------------------------------------- |
| `apps/web`         | Next.js app: marketing, dashboard, REST API, MCP endpoint, OAuth |
| `apps/mobile`      | Expo app                                                         |
| `apps/desktop`     | Electron shell around the hosted web app                         |
| `packages/core`    | Credits, billing, API keys, OAuth, renders and storage           |
| `packages/db`      | Prisma schema and client                                         |
| `packages/harness` | Rendering pipeline, models, pricing and guardrails               |
| `packages/mcp`     | MCP server tools                                                 |
| `skills`           | Agent skill package                                              |
| `infra/aws`        | CloudFormation for the S3 bucket and CloudFront                  |

## Development

```sh
bun install
bun run dev         # apps/web on http://localhost:3000
bun run preflight   # what CI runs: biome, UI guards, typecheck, tests
```

Contributor and agent rules are in [`AGENTS.md`](AGENTS.md); the design system is in
[`DESIGN.md`](DESIGN.md).

## Contact

[easyrender.ai](https://easyrender.ai) · info@easyrender.ai
