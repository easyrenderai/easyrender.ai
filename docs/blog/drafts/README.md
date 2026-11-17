# Agentic workflow series · editorial drafts

Prepared on 17 November 2026 at Jorge's request. These are complete article drafts, not live
posts or a scheduled publishing queue. They are deliberately outside `apps/web/content/blog`:
the blog loader does not read this directory, so the dates below do not trigger publication.

## Current queue and proposed order

At preparation time, `origin/main` contained 33 guide files across six languages, representing
the original seven topics. None had a date after 17 November 2026. The 32 comparison files also
had no future publication dates. Spanish has six of the seven original guides; the GLB guide's
Spanish counterpart is absent. Translation coverage is therefore not complete.

| Proposed date (00:00 UTC) | Distinct search intent                                        | Spanish draft                                                       | English draft                                               |
| ------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| 18 November               | Assemble a professional product page with copy, images and 3D | [Fichas de producto con n8n](es/fichas-producto-n8n-imagenes-3d.md) | [Product pages with n8n](en/n8n-product-pages-images-3d.md) |
| 19 November               | Connect and operate the image-to-3D REST workflow             | [Integrar 3D en n8n](es/integrar-3d-flujo-n8n.md)                   | [Image-to-3D workflow](en/n8n-image-to-3d-workflow.md)      |
| 20 November               | Give an AI agent selected 3D tools through MCP                | [Agente IA con MCP](es/agente-ia-n8n-modelos-3d-mcp.md)             | [AI agent with MCP](en/n8n-ai-agent-3d-mcp.md)              |
| 21 November               | Process a catalog with recovery, review and bounded spending  | [Catálogo 3D por lotes](es/automatizar-catalogo-3d-n8n.md)          | [Batch 3D catalog](en/n8n-batch-3d-catalog.md)              |

Dates are an editorial proposal, conditional on readiness and deployment. Move them forward if
the release would otherwise make several overdue drafts appear together. Final content uses the
same `group` across EN/ES, native slugs, one intent per article, a direct opening, decision tables,
concrete configuration steps, troubleshooting and four FAQ items.

No new keyword volumes are claimed. The exact queries have **ND** volume/KD in the briefs because
they were not measured in this research pass. Public search results and the n8n template library
establish related workflow intent; they do not establish traffic estimates or guaranteed rankings.
The prior keyword map already includes a generic MCP guide, so this series uses an n8n-specific
implementation angle rather than duplicating that planned general article.

## Evidence and validation boundary

- Read production OpenAPI 1.0.0 (24 paths) and public MCP discovery (16 tools), plus repository
  handlers, on 17 November 2026. Read-only calls did not generate anything or spend credits.
- Consulted current official n8n, Shopify, Khronos and MCP documentation; citations are inline.
  Context7 was attempted but returned a monthly-quota error.
- The recipes use built-in HTTP Request nodes or a compatible MCP client. They do not claim
  the easyrender community node is published, verified or available on every n8n plan.
- No authenticated n8n end-to-end execution or merchant publication was performed. These are
  configuration recipes, not downloadable, tested workflow JSON files or customer case studies.
- Independent editorial review is recorded in the four [research briefs](../briefs/).
  Hero/screenshot and wider per-query SERP review remain publication-gate work.

## Visual assets

Eight original flow diagrams are ready in [assets](assets), one EN and one ES version per topic.
They explain the architecture and are labeled as diagrams, not screenshots or executed results.
They do not replace the required hero illustrations or real screenshots.

Each brief contains a specific Higgsfield hero prompt and the real screenshot to capture. The
user deferred Higgsfield login, so no AI image generation was performed through another provider.
Images must be registered in `BLOG_IMAGES` and relative diagram links converted to registered
public paths before moving drafts into live content.

## Publishing requirements

The [editorial pipeline](../PIPELINE.md) requires completed visuals, technical checks and Jorge's
explicit approval before merging blog content. Spanish drafts need Jorge's language review; no
DE/FR/IT/PT versions of this series have been prepared or implied to be reviewed.

Once these requirements are met, move EN/ES drafts into the live content directory with their
agreed dates, register the unique media, run the actual blog content/guide tests and inspect mobile
and desktop rendering. The four drafts link to one another and the existing core guides; future
guide links are suppressed by the site's date gate until the target guide becomes live.

Add the first published guide to the MCP/API resource selection to make the series discoverable
from integration traffic. Do this when its publication date and assets are final, not by adding
links to absent routes.

Production is release-based. A merge does not deploy. The most recent stage-only release checked
during preparation failed its smoke check with HTTP 302:
[Release v0.1.1 rehearsal](https://github.com/easyrenderai/easyrender.ai/actions/runs/43988876381).
Do not describe these drafts or the preceding SEO PR as published until a successful release and
live read-back confirm them.
