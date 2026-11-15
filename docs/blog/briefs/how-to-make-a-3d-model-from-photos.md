# Brief: how-to-make-a-3d-model-from-photos

- Guide: [`apps/web/content/blog/en/how-to-make-a-3d-model-from-photos.md`](../../../apps/web/content/blog/en/how-to-make-a-3d-model-from-photos.md)
- Group / slug: `how-to-make-a-3d-model-from-photos`
- Publish date: 2026-11-11
- Target keyword: `how to turn a photo into a 3d model`, 80 / KD 0 (`contenido/materiales/canales/04-seo/keyword-map-200.csv`, KW-363; TP 5,200 in `KEYWORD-MAP.md`). Slug phrase `how to make a 3d model from photos`: 20 / KD 2 (`contenido/AHREFS-W1.md`, not in the map).
- Retrospective brief, written on 2026-11-11 from the published guide. The guide predated the pipeline.

## Intent and goals

Intent: learn and do. The reader has one photo (often a supplier's) of a single object and wants a usable 3D model from it. The image-to-3D head terms (`image to 3d model`, `photo to 3d model`) belong to the home, not this guide (`AHREFS-W1.md`, section 1).

Goals, as the guide measures them ("How do you know the model is ready to publish?", five yes/no checks):

1. The model matches the product: counts of legs, doors, drawers and handles match the real piece.
2. The back and underside look right to someone who owns one.
3. The texture holds up at full screen, not only as a thumbnail.
4. The file opens in a browser viewer, on one iPhone and on one Android phone.
5. The file fits its destination: Shopify up to 500 MB; Scene Viewer recommends 10 MB and 100,000 triangles. Read the triangle count in Blender (Statistics overlay).

## Methods

Choosing the route (case list in the guide):

- Supplier photo only: image-to-3D.
- Piece in the stockroom, textured surface, an hour free: photogrammetry (Polycam: at least 20 photos, about 70% overlap, 100+ for detail; RealityScan: processing after 20 images, up to 300, circles and arches at several heights).
- Large plain piece, Pro iPhone to hand: LiDAR.
- Glass, mirror, polished chrome: none works well.

Image-to-3D, as the guide teaches it:

1. Pick the photo: whole object, sharp, soft even light, plain background, nothing covering it; three-quarter angle for furniture; camera at about the middle height of the piece; one object, not a styled room. Shortest side at least 800 px (rejected under 400). Zoom to 100% on a leg edge to judge sharpness.
2. Remove what is not the object: crop a lifestyle shot tight with a margin; no wider than 4:1; check cut-out edges for a pale halo at full size; avoid hard shadows (overcast light).
3. Check the preview from every angle: count legs, doors and drawers in every cell; compare opposite cells (front-right vs back-left); use the top-down cell for oval shades or uneven tops. If wrong, change the photo or add a note ("four doors", "open back", "brass handles") rather than retrying the same input.
4. Build and download: GLB and USDZ. Open in Blender (File, Import, glTF 2.0) or the Babylon.js Sandbox; turn on Statistics; spin it slowly.

## Errors

The guide has 8 entries (symptom → cause → fix):

1. Upload rejected as too small → shortest side under 400 px (thumbnail, screenshot) → use the original file.
2. Upload rejected as too narrow → more than 4× wider than tall → crop to the object with a margin.
3. Two chair legs merge → back legs hidden behind front ones in a front shot → three-quarter photo.
4. Four doors come back as three → low-contrast seams → raking light, or note "four doors".
5. Back is a copy of the front → hidden sides inferred from symmetry → note "open back"/"plain back", or a photo showing a back corner.
6. Rattan or cane becomes a printed pattern → one photo cannot see through gaps → accept for a small viewer, or photogrammetry.
7. Fabric yellower or darker than the photo → viewer light differs, or Metallic unset (glTF default fully metallic) → check under neutral light, set Metallic to 0 in Blender.
8. Faceted surfaces under side light → no vertex normals, viewers compute flat ones (glTF spec) → Shade Smooth, export again.

## First-hand data

All verified against the repo on 2026-11-11.

| Number in the guide                                                                                                                                        | Source file                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Upload rejected under 400 px shortest side, warning under 800                                                                                              | `packages/harness/src/guardrails.ts` (`LIMITS.minPhotoSide`, `goodPhotoSide`)                                                      |
| Rejected when more than 4× wider than tall                                                                                                                 | `guardrails.ts` (`maxAspect: 4`)                                                                                                   |
| Rejected when flat in tone ("probably blank")                                                                                                              | `guardrails.ts` (`minPhotoSpread`, code `photo_blank`)                                                                             |
| Blur check on a small copy                                                                                                                                 | `guardrails.ts` (`sharpness()` on a 256 px greyscale copy; it warns, it does not reject)                                           |
| Angle sheet: one square image (1K draft, 2K final), 3×3 grid, eight cells in 45° steps plus top-down                                                       | `packages/harness/src/models.ts` (`SHEET_MODEL`, `aspect_ratio: '1:1'`), `packages/harness/src/sheet.ts` (`VIEWS`, `SHEET_PROMPT`) |
| Sheet rejected under 768 px, object missing in more than 2 cells, more than 3 of 8 views near copies                                                       | `guardrails.ts` (`minSheetSide`, `maxEmptyCells`, `maxDuplicateViews`)                                                             |
| Distinct views differ by 3%+, repeated by under 1%                                                                                                         | Comment on `duplicateViewDistance` in `guardrails.ts`                                                                              |
| The build reads the photo plus the nine sheet views                                                                                                        | `packages/core/src/renders.ts` (`build`: source upload, then `cutCells` of the sheet)                                              |
| Upload: JPEG, PNG or WebP, under 4 MB                                                                                                                      | `packages/core/src/renders.ts` (`MAX_UPLOAD_BYTES`, `IMAGE_TYPES`)                                                                 |
| Free preview: two a day without credits, watermarked until paid                                                                                            | `packages/core/src/config.ts` (`freePreviewsPerDay`), `packages/harness/src/watermark.ts`                                          |
| Hidden sides inferred conservatively, no invented logos or text; furniture rules (exact count of legs, arms, cushions, drawers; grain direction and seams) | `packages/harness/src/skills.ts`                                                                                                   |
| Build asks for a 2048 px texture                                                                                                                           | `models.ts` (`texture_size: 2048`)                                                                                                 |
| Showcase models 14,590 (clay vase) to 69,910 (bedside table) triangles                                                                                     | `apps/web/public/showcase/*.glb`, read from the accessors                                                                          |
| Armchair GLB: 25,879 triangles, 538 KB                                                                                                                     | `apps/web/public/showcase/armchair.glb` (551,068 bytes)                                                                            |
| USDZ converted from the GLB in the browser                                                                                                                 | `apps/web/components/model-view.tsx` (`exportUsdz`)                                                                                |
| Preview free; model costs `{{renderCredits}}` credits                                                                                                      | `packages/harness/src/pricing.ts` via tokens                                                                                       |

## Sources

Links as published in the guide; not re-read on 2026-11-11 unless marked.

| URL                                                                                       | Fact it supports                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://learn.poly.cam/hc/en-us/articles/27425185907348-How-to-Use-Object-Mode            | Polycam asks for at least 20 photos, about 70% overlap, 100+ for detailed objects. (`INFORME-SEO-POSTS-W1-2026-11-10.md` records this page returned 403 to the agents and was checked through a search engine.) |
| https://dev.epicgames.com/documentation/realityscan-mobile/realityscan-step-by-step-guide | RealityScan starts processing after 20 images, takes up to 300, asks for circles and arches at several heights.                                                                                                 |
| https://developers.google.com/ar/develop/scene-viewer                                     | Scene Viewer recommends at most 100,000 triangles, 10 materials and 10 MB. Opened 2026-11-11: "The recommended limit is 100,000 triangles", "10 materials", "Model size: 10 MB".                                |
| https://sandbox.babylonjs.com/                                                            | A free browser viewer that opens GLB.                                                                                                                                                                           |
| https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html                                 | Without vertex normals, viewers must calculate flat ones.                                                                                                                                                       |
| https://help.shopify.com/en/manual/products/product-media/product-media-types             | Shopify takes 3D models up to 500 MB. Opened 2026-11-11: "File size: Up to 500 MB."                                                                                                                             |

## SERP gaps

From `contenido/AHREFS-W1.md` (10-nov-2026, query "how to make a 3d model from photos", US): top organic returned were neural4d.com (tool page), a YouTube video and a sloyd.ai blog post; positions 1 and 4 missing (likely AI Overview/video). The report reads the SERP as tools and how-tos for image-to-3D and asks the guide to cover one photo vs many, the files you get, limits (no real scale) and printing (no).

Gaps the guide itself targeted when the retrospective brief was written (the SERP was re-read on 11-nov-2026; see the section below): the two-stage angle-sheet route and how to read the sheet cell by cell; concrete upload limits from a real harness; a symptom/cause/fix table tied to photo choice; a yes/no publish checklist with file budgets.

## Live SERP read (11-nov-2026)

Read on 11-nov-2026 (Europe/Madrid) with WebSearch and the pages below. No Ahrefs units were used. This replaces the note above that the SERP had not been re-read for the retrospective brief.

### What currently surfaces

Vendor and tool how-tos dominate the query "how to make a 3d model from photos" / "how to turn a photo into a 3D model": Meshy's 2026 image-to-3D guide and docs, a photogrammetry-versus-AI explainer (ki-heimlabor.de), Meshy's photogrammetry-software round-up, and Adobe Substance's pictures-to-3D page. The shape of the SERP is still tools plus method explainers, as the 10-nov Ahrefs note described, not a shop-owner checklist.

### Facts worth keeping in the brief

- One-photo AI tools (Meshy and similar) ask for a clear, well-lit subject on a plain background, then export GLB / OBJ / STL. Photogrammetry still wants dozens of overlapping shots all the way round the object (guides cite roughly 40–100, or Meshy's photogrammetry round-up's desktop/mobile tools such as Meshroom and RealityScan).
- The two-route split (many photos that saw every surface vs one photo whose unseen sides come from that picture) is still the gap our guide owns, together with the two-stage angle-sheet check and the "change the photo if the silhouette is wrong" loop.
- Several competitor pages mention STL or printing as a normal next step. Ours must keep the printing exclusion: models from a photo carry no measured size and are for screens and AR, not STL.

### Do not copy from the SERP

Do not import competitor claims that a one-photo model is "accurate on every side" or ready to print. Do not add unverified tool prices.

### Gaps that still hold

The two-stage angle-sheet route, reading the sheet cell by cell, concrete upload limits from the harness, a symptom/cause/fix table tied to photo choice, and a yes/no publish checklist with file budgets are still rare on the pages opened today.

### Sources opened this read

- https://www.meshy.ai/tutorials/image-to-3d-model-complete-guide
- https://docs.meshy.ai/en/webapp/image-to-3d
- https://ki-heimlabor.de/en/guides/3d-modell-aus-fotos/
- https://www.meshy.ai/blog/free-photogrammetry-software
- https://www.adobe.com/products/substance3d/discover/pictures-to-3d-models.html

## Creatives

| Creative                                          | Path                                                                              | What it teaches                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero (Style A2), 1280×720 WebP (read with `sips`) | `apps/web/public/blog/illustrations/how-to-make-a-3d-model-from-photos/hero.webp` | Concept of the intro: one object, part real, part predicted mesh. Alt: "Illustration of a galvanised metal watering can, one half in its real metal and the other half in matte grey clay covered by a white wireframe mesh, on a dark background". Caption: "Illustration, not an easyrender result: a watering can drawn half as galvanised metal, half as a clay-and-wireframe mesh." |
| Diagram                                           | `diagram:photo-vs-photogrammetry` (`components/blog/diagrams/photo-to-3d.tsx`)    | Photogrammetry (20 to 100+ photos, sees every surface) vs image-to-3D (one photo, predicts hidden sides).                                                                                                                                                                                                                                                                                |
| Diagram                                           | `diagram:image-to-3d-pipeline` (`photo-to-3d.tsx`)                                | The five steps of the two-stage route; credits spent only at the build step.                                                                                                                                                                                                                                                                                                             |
| Real input photo                                  | `/showcase/armchair.jpg` (2048×2048)                                              | What a good input looks like: whole chair, three-quarter, plain background.                                                                                                                                                                                                                                                                                                              |
| Real angle sheet                                  | `/showcase/armchair-angles.jpg` (1200×1200)                                       | How to read a 3×3 sheet; back and top are predictions.                                                                                                                                                                                                                                                                                                                                   |
| GLB viewer                                        | `/showcase/armchair.glb`, poster `/blog/models/armchair.webp` (960×960)           | The built model: 25,879 triangles, 538 KB; turn it and check the back.                                                                                                                                                                                                                                                                                                                   |
| Table                                             | Errors table (8 rows)                                                             | Symptom → cause → fix.                                                                                                                                                                                                                                                                                                                                                                   |
| Checklists                                        | Photo checklist (6 items), publish checklist (5 items)                            | Yes/no checks before upload and before publishing.                                                                                                                                                                                                                                                                                                                                       |

Hero prompt (Style A2). The prompt actually used is not recorded: `INFORME-HEROES-A2-2026-11-11.md` lists only the source file (`~/easyrender/blog-style-A2/how-to-make-a-3d-model-from-photos.jpg`) and the object ("watering can"); the prompts in `~/easyrender/blog-style-A/MAPPING.md` belong to the earlier monochrome Style A set. This prompt is written to match the published image:

> Dark technical 3D render, 16:9, 1280×720. One object: a galvanised metal watering can with a round body, a high arched handle, a side handle and a long spout with a perforated rose, three-quarter view, slightly left of centre. The spout, rose and near side are in real galvanised steel with fine surface mottling; the body's right half and the handles are matte grey clay covered by a fine white wireframe mesh of square quads, as if that side were predicted. White rim light tracing the silhouette, charcoal-to-black radial gradient background, dark glossy floor with a soft contact shadow and faint reflection. The only accent is the cool grey sheen of the galvanised metal. No text, no UI, no numbers, no logos or brands, no rulers, measurements or scale marks, no people, no armchair. Save as WebP, 1280×720.

Note: the real material is grey, so the image has no distinct accent colour and the split reads mainly through the wireframe (also noted in `INFORME-HEROES-A2-2026-11-11.md`).

## Outline and FAQ

H2s as published:

1. How to make a 3D model from photos: one photo or many? Photogrammetry vs LiDAR vs image-to-3D, with photo counts and a case-by-case choice.
2. How does image to 3D work? Direct vs two-stage tools; easyrender's 3×3 angle sheet and its furniture rules.
3. Step 1: Pick the right photo. Framing, angle, resolution floor, sharpness test, 6-item checklist.
4. Step 2: Remove what is not the object. Cropping, 4:1 limit, cut-out halos, shadows.
5. Step 3: Check the preview from every angle. Reading the sheet, automatic sheet checks, the note.
6. Step 4: Build the model and download the files. GLB/USDZ, one mesh and material, triangle budget, opening the file.
7. What goes wrong, and how do you fix it? 8-row table.
8. How do you know the model is ready to publish? 5 yes/no checks.
9. What a model made from one photo cannot do. No size, soft fine detail, reflective surfaces, one object.

FAQ (verbatim):

- How many photos do you need for a 3D model?
- What resolution should the photo be?
- Is image-to-3D the same as photogrammetry?
- Is it free to turn a photo into a 3D model?
- Can you 3D print a model made from a photo?

## Depth gate

Retrospective: this guide predated the pipeline; verdict against the current 03-depth-gate rubric based on the published text, without rewriting the post.

```
Verdict: GAPS
Date and session: 2026-11-11, retrospective brief session
1 Methods ✓ Four numbered steps with real settings (400/800 px, 4:1, three-quarter angle, notes), plus a route choice per case.
2 Goals ✓ Five yes/no publish checks, each measurable (counts, viewer test on two phones, Shopify 500 MB, Scene Viewer 10 MB / 100,000 triangles).
3 Errors ✓ Eight symptom → cause → fix rows.
4 Own point of view ✓ Harness limits and sheet checks from guardrails.ts, 2048 texture from models.ts, showcase triangle counts; advice to fix the photo or the note rather than retry.
5 Sourced data ✓ Every outside figure (Polycam, RealityScan, Scene Viewer, Shopify, glTF spec) is linked inline; Scene Viewer and Shopify checked on 2026-11-11.
6 No padding ✗ The limits section repeats earlier points: "Glass, mirrors and polished chrome confuse every method, photogrammetry included" restates the route bullet "Glass, mirror or polished chrome: none of them works well", and "Open rattan tends to become a printed pattern on a solid surface" restates error row 6.
7 Originality ✗ Not checked against live SERP. AHREFS-W1.md lists the top results but their content was not read. Candidates: reading the angle sheet cell by cell; real upload and sheet limits.
8 Comparisons ✓ Route choice states the deciding facts per case (object in hand, surface, size, Pro iPhone) with a verdict each.
9 Tone ✓ Second person, short paragraphs, no listed AI phrasing (content.test.ts passes).
10 Claims ✓ No real-size claim; AR "coming soon" with dimensions kept in the listing; printing and STL ruled out.
11 Creatives ✓ Hero directly under the first paragraph; two diagrams, real photo, real sheet and GLB each teach a step.
12 Own output ✗ Borderline. The caption on easyrender's own armchair GLB ends "then look at the fabric under neutral light before you publish", next to error row 7 ("Fabric looks yellower or darker than in the photo ... the material leaves Metallic unset"). Read together they suggest a colour issue in our model.
Items to fix (not applied):
- 6: cut the repeated glass and rattan sentences from the limits section, or merge the section into the route choice.
- 7: read the top 5 for the keyword and name two points they lack.
- 12: make the armchair GLB caption neutral (drop "look at the fabric under neutral light"), and keep row 7 generic.
```

## Fact-check, 2026-11-11

Removed the claim that an A/B run picked the two-stage route and gave a usable model on every test object: the repo holds only a code comment about a run made with the earlier Nano Banana Pro sheet, no results, and `content/evals/latest.json` has no runs. RealityScan "processing" changed to "analysing" (the page says the app analyses after 20 images and processes when you tap Process). The Polycam page could not be read on this date; its figures stay as recorded in `INFORME-SEO-POSTS-W1-2026-11-10.md`. The sample angle sheet (`armchair-angles.jpg`, 1200 px) predates the 1K sheet model.
