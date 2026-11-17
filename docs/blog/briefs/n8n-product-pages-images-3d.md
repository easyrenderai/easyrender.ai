# n8n-product-pages-images-3d

## Intent and goals

- Proposed publication: 2026-11-18, subject to editorial approval, creatives and a successful production release. This is not a scheduled live post.
- English: `n8n product pages images 3d`. Spanish: `fichas de producto con n8n`. SV/KD: **ND, not measured for these exact queries**. Selected for product fit and publicly observable workflow intent, not a claimed keyword volume.
- Goal: Build one reviewed listing package from verified product facts, generated views and a downloadable GLB.
- Measure: completed reviewed outputs per source SKU, manual interventions, duplicate jobs and credits per accepted deliverable. No claimed uplift or execution time.

## Methods

- Workflow: SKU facts → copy draft + paid product views → visual review → authorized 3D build → CMS draft.
- Use the current public OpenAPI contract and save IDs before polling. Prefer HTTP Request to avoid assuming community-node marketplace approval.
- Input: one HTTPS JPEG/PNG/WebP or authenticated file upload, maximum 4 MiB. Source version and stable idempotency key are separate from generated job IDs.
- Compare per-SKU reviewed processing with catalog submission only where approval/privacy differs.
- Read quote and balance, bind approval to the job and ceiling, then call the paid action. Bounded GET polling never becomes a blind paid retry.

## Errors

At least six topic-specific symptom/cause/fix rows in the draft: duplicate submission, invalid source image, missing approval, private URL used as public media, polling deadline, incomplete result, plus relevant batch/MCP issues.

## First-hand data

- Read-only production `GET /api/openapi.json`, 17 November 2026: version 1.0.0, 24 paths. Checked schemas and required scopes for renders, product views and catalog.
- Read-only production MCP `tools/list`, same date: 16 tools including create_render, get_render, render_3d, get_credits, create_product_views and build_from_product_views. No tool execution, paid generation or customer data used.
- `docs/api.md`, route handlers and `integrations/n8n/README.md`: preview/build separation, 4 MiB inputs, create idempotency, ready + hasModel, private downloads. Native community node source does not start paid builds; marketplace availability is not asserted.
- No authenticated end-to-end n8n run has been performed. Examples are configuration recipes, not results from a completed store workflow.

## Sources

Reviewed 17 November 2026. Facts are paraphrased; links are authoritative references, not endorsements.

- https://easyrender.ai/api/openapi.json — deployed paths, schemas and scopes.
- https://github.com/easyrenderai/easyrender.ai/blob/main/docs/api.md — lifecycle, key ceilings, idempotency and private downloads.
- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/ — credential, response and file configuration.
- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/ — timed wait and authenticated resumption.
- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.splitinbatches/ — loop output and batch size.
- https://docs.n8n.io/integrations/builtin/handle-rate-limits.md — 429 and pacing; Retry-After is not automatically honored.
- https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolmcp/ — credentials and selected tools.
- https://docs.n8n.io/build/integrate-ai/ai-examples/human-in-the-loop-for-tools.md — tool approval and denial.
- https://modelcontextprotocol.io/specification/2025-06-18/basic/transports — Streamable HTTP and legacy transport distinction.
- https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections/manage-media — upload, process and attach media as separate steps.
- https://www.khronos.org/gltf/ — glTF/GLB is a model delivery format.

## SERP gaps

Focused search review, not an exhaustive top-ten ranking audit or authenticated volume study. Relevant primary marketplace examples reviewed:

- https://n8n.io/workflows/11695-generate-product-descriptions-from-images-and-publish-to-shopify-using-ai/ — image-to-copy/listing recipe.
- https://n8n.io/workflows/12452-generate-3d-models-from-images-using-hunyuan3d-v2-and-google-sheets/ — image row, 3D submission, polling and result cell.
- https://n8n.io/workflows/3894-convert-images-to-3d-models-with-fal-ai-trellis-and-store-in-google-drive/ — image-to-3D with storage.

Our distinct coverage: Separate copy claims from image inference; keep images and model tied to the same accepted views; deliver binary files instead of private endpoint URLs.

## Creatives

1. Hero path reserved: `/blog/illustrations/n8n-product-pages-images-3d/hero.webp`, 1280×720 or larger. Higgsfield generation intentionally pending the user's login. Prompt: A ceramic desk lamp splits into an image card, a wireframe object and a neutral product card. No words or logos. Dark editorial technical style, generous negative space, one restrained material accent, readable at small size. An illustration, never a screenshot or a claimed product result.
2. Original EN/ES flow diagram in `docs/blog/drafts/assets/n8n-product-pages-images-3d-{locale}.svg`, clearly captioned as an architecture diagram. Register it only when promoting the draft to live content.
3. Unique real screenshot planned: product-view review and completed files, with credentials and customer information absent. Do not fabricate it.
4. Decision/configuration table, output schema table, six-row troubleshooting table and measurable acceptance checks; each specific to this post.

## Outline and FAQ

The complete EN and ES drafts are stored in `docs/blog/drafts/`, outside the live loader because required media is pending. Sections follow the flow above; FAQ separates cost, authentication and completion questions.

## Depth gate

Verdict: **BACK TO STAGE 2** (publication gate not passed).
Date and reviewer: 2026-11-17; independent Codex editorial reviewer `/root/editorial_review`, which did not author the drafts. Role separation follows the pipeline; this is not a Claude session or a human/native sign-off.

**Text readiness:** Textually ready as a product-page workflow guide after the second review. The added copy prompt, five-field output contract, lamp examples and validation/merge checks resolve the actionability gap. Publication readiness remains separate below.

| #   | Criterion         | Assessment                                                                                                                                                                                                                                                                           |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Methods           | ✓ Second review: concrete input fields, copy prompt, five-field output contract and lamp examples are now present, with rejection of invalid output and SKU preservation. The visual API sequence remains consistent with the deployed schemas.                                      |
| 2   | Goals             | ✓ Observable outcomes and acceptance checks are named; no conversion or speed claim is invented.                                                                                                                                                                                     |
| 3   | Errors            | ✓ Seven specific symptom/cause/recovery rows; uncertain paid outcomes are separated from safe GET retries.                                                                                                                                                                           |
| 4   | Own point of view | ✓ Uses current repository/API constraints and applies them to concrete workflow decisions. Does not present fixtures, discovery or schema reads as an executed store workflow.                                                                                                       |
| 5   | Sourced data      | ✓ Technical claims checked against `docs/api.md`, route/core code and the saved production OpenAPI/MCP snapshots. Independently opened HTTP Request, human-review and Shopify media docs and confirmed response shape, approval/denial and upload/readiness/attachment respectively. |
| 6   | No padding        | ✓ Answer first, workflow-specific tables and short practical sections; minor editorial note below where relevant.                                                                                                                                                                    |
| 7   | Originality       | ✗ The brief explicitly reports a focused template review, not the required top-five SERP audit for this exact query. Distinct coverage exists (approval-bound spending plus job/file recovery), but a complete ranking-based comparison is not evidenced.                            |
| 8   | Comparisons       | ✓ Route choices state a use case and boundary; there is no unsupported winner or competitor result claim.                                                                                                                                                                            |
| 9   | Tone              | ✓ Direct developer-facing prose. Title ≤60, description ≤155, introduction 40–60 words, four FAQ answers of 40–60 words; no prose paragraph over 60 words in this review. Current user preference authorizes selective bold.                                                         |
| 10  | Claims            | ✓ No dimensional-accuracy, sales uplift or free downloadable-model claim. Paid steps and deliberate publication are explicit.                                                                                                                                                        |
| 11  | Creatives         | ✗ “ILLUSTRATION PENDING” and “IMAGE PENDING” are placeholders. No approved Higgsfield hero or unique real screenshot is present. Do not treat tables alone as the required real media.                                                                                               |
| 12  | Own output        | ✓ No quality defect of an easyrender model/export is asserted. Interface availability and authentication are described accurately so readers do not follow nonexistent routes.                                                                                                       |

### Items to fix before publication

- Text actionability fix completed and re-reviewed: copy-branch input/prompt/output example. No remaining textual correctness blocker identified.
- Complete the focused exact-query SERP comparison or have the editorial owner explicitly accept the limited research scope. Keyword SV/KD remain ND, not zero.
- Produce the hero after the user resumes Higgsfield access; capture real explanatory screenshots without secrets/customer data, register assets and run the live content checks.
- Walk one authenticated n8n flow for each materially different path before presenting it as tested. No paid run was executed in this review; do not add a measured outcome without evidence.
- Obtain the relevant language review and Jorge/Ale's publication approval. Draft dates are proposed slots, not active scheduled posts.

### Technical checks made by this reviewer

- Read-only review of the four English drafts, matching briefs, API contract, product-view creation/reuse, build request parsing and catalog submission code.
- Confirmed production schema snapshots contain the documented endpoints/tool inputs; no secrets or authenticated customer responses were used.
- Confirmed titles/descriptions, first-paragraph and FAQ word counts, and paragraph lengths with a local read-only script.
- No runtime code edited, no generation or purchase triggered, no GitHub comment or publication performed.

Second review (2026-11-17): re-read the changed English sections. All four guides are textually ready within their stated configuration/architecture scope; none is publication-ready while the remaining media, research-scope and validation gates are open.
