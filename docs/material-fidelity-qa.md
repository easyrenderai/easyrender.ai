# Material fidelity in generated models

The production path is `createDraft` → angle sheet → optional final sheet → Replicate 3D build →
`advance` in `packages/core/src/renders.ts`. Previously, the downloaded GLB went straight to storage;
material profiles influenced the sheet prompt but did not correct the generated GLB.

`finishMaterialFidelity` now applies a local material pass, verifies geometry, renders a small QA
image and stores the model. `Render.quality.fidelity` carries the review flag, measurements and
artifact keys. JSON, self-contained HTML and a PNG comparison are stored with the existing storage
adapter. There is no new schema, environment variable, service, paid inference or credit operation.
Flags do not change `isPublic` or prevent `ready`. Material/geometry failures preserve the original;
QA/source/artifact failures become review flags. The regression test walks `advance` to `ready`
with an unavailable source, and failed against the previous implementation's missing report.

## Detection and output

- Use explicit GLB material labels first, then the existing product name / owner note. Whole-word
  English/Spanish hints identify steel, stainless, iron, chrome, aluminium, brass, copper and bronze.
  Explicit plastic, fabric, wood, rubber, ceramic and coated/painted surfaces remain dielectric.
- A metal hint also needs at least 16 matching pixels inside the source-photo object mask. Neutral
  low-chroma texels select silver metals; warm channel ratios select brass/copper. In a mixed atlas,
  only matching texels get metalness 1. Dark texels below 75/255 stay dielectric, protecting black
  grips and the glossy black swivel base. `metallicFactor = 1` multiplies this binary blue-channel
  mask; a factor of 1 alone does **not** make the entire object metallic.
- Existing authored metal masks are retained when identity is unknown. Missing masks with unknown
  identity default to dielectric and flag review. A grey or shiny photo by itself is not reliable
  proof of metal: no speculative classifier or additional model call is made.
- Every supported material gets a roughness map. Flat substrate regions receive deterministic fine
  variation (±0.03); existing variation and native map resolution are retained. Metal and dielectric
  subsets are checked independently. An implausibly polished/rough brushed finish is centred around
  0.38 while retaining its variation. If a brushed surface has no normal map, add small satin
  micro-streaks (six 8-bit levels peak-to-peak, scale 0.35), masked to metal. Existing normal maps,
  base-colour textures and tints stay intact. Samplers and texture transforms follow the source map.
- Geometry never passes through an exporter. New PNG images are appended to BIN; existing buffer
  offsets and bytes remain intact. The SHA-256 guard includes accessors, sparse/interleaved data,
  positions, normals, all UV sets, indices, compressed meshopt/Draco payloads, mesh topology,
  nodes/transforms, scenes, skins and animations. A mismatch discards the material edit.

Limits: this is hint-assisted colour segmentation, not semantic segmentation or photo-to-UV
registration. Unlabelled metals may be missed; neutral fabric/stone near metal, dark iron,
reflections, glass, coatings and several differently coloured metals in one atlas are ambiguous.
Explicit per-material labels are more reliable than a product-wide hint. Different UV layouts
between colour and roughness disable colour-based reassignment and flag review. A mesh without
UVs cannot gain a spatial map without changing geometry: it is left intact and flagged. Unsupported
external buffers/textures or oversized assets also preserve the original. These limits are visible
review signals, not claims of perfect automatic material identification.

## Headless rendering and comparison

The harness uses a bounded **CPU software rasterizer**, not a browser. glTF Transform decodes
meshopt/Draco; sharp decodes embedded PNG/JPEG/WebP. No external model resources are fetched.
The 192×192 orthographic render uses a depth buffer, world transforms, interpolated normals,
base colour, metallic/roughness factors/maps and a neutral white studio-light approximation.
It is a diagnostic preview, **not a reference PBR path tracer**: no environment reflections,
normal-map shading, anisotropy, shadows, transmission, skinning or animation. Transparency is
approximated and flagged. Never interpret its ΔE as a calibrated physical measurement of a finish.

Without a supplied camera, fit six azimuths (30, 90, 150, 210, 270, 330 degrees), elevation 15°, to
source silhouette IoU. Colour is **not** used to choose a camera. Photo and render are independently
centred and scaled to their object bounds, retaining aspect ratio. The studio sweep reuses the
angles documented in `showcase-material-match.md`; the armchair has no recorded matching angle,
so it uses the search. Camera orientation can still be wrong, especially for symmetric objects.

The source mask removes border-connected pixels close to the corner background colour (RGB
Euclidean distance <24); alpha is respected. Busy backgrounds, shadows and pale objects can
confuse it. A 3×3 grid compares mean D65 Lab in the masked object portion of each region using
CIEDE2000 (`kL=kC=kH=1`), requiring 32 pixels per image per region. The overall ΔE is weighted by
matched region population. This detects broad colour drift; it does **not** score fine texture
sharpness, recover camera calibration or separate baked illumination from albedo.

Resource limits: input GLB 64 MiB, decoded buffers 128 MiB, 200,000 triangles, 64 materials,
4 megapixels per material map, 4 seconds per raster pass, 12 seconds between camera-search passes,
and 10 seconds between material processing iterations. Unsupported inputs return advisory
unavailability rather than an approval or a generation failure. There is no headless-browser
installation in CI. Decoder package assets must remain available in the server build.

## Review thresholds and calibration

| Signal                                                        | Flag condition                                                                                                                            | Reason                                                                                                           |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Weighted colour ΔE00                                          | >12                                                                                                                                       | Above corrected espresso (5.31), lamp (9.00), barrel (5.71); tolerates lighting/camera error                     |
| Any populated grid region ΔE00                                | >20                                                                                                                                       | Finds local failures hidden by a good overall average; small/boundary regions require visual review              |
| Roughness standard deviation, full native map or metal subset | <0.004                                                                                                                                    | Approximately one 8-bit step; rejects constant maps without rejecting corrected espresso's subtle satin σ=0.0067 |
| Mean metal response among texels above 0.5                    | <0.95, >64 texels                                                                                                                         | Exposed metal should be close to 1; permits boundary interpolation                                               |
| Brushed-metal mean roughness                                  | outside 0.25–0.65, >64 metal texels                                                                                                       | Broad heuristic around the corrected espresso/lamp values 0.369/0.378; not a universal material specification    |
| Photo metal coverage                                          | >3% photo candidates but <1% metal atlas in every material                                                                                | Review allocation; atlas area is not visible surface area, so small hardware can legitimately trigger this       |
| Other sanity                                                  | absent roughness map; >5% metal in an explicitly dielectric material; <50% of expected metal candidate coverage when candidates exceed 5% | Catch defaults and contradictory hints                                                                           |
| Camera/mask                                                   | IoU <0.55; source object coverage <5% or >95%                                                                                             | Warn that the comparison itself may be unreliable                                                                |

Calibration against pre-correction `e615ff6`: espresso ΔE 6.07 alone passes, but weak metal response
and brushed roughness warn; lamp ΔE 7.84 alone passes, but a local colour region and brushed
roughness warn. Both corrected assets pass all thresholds. This is why colour alone is insufficient.
The armchair's metal response remains 0.929 and flags; swivel metal coverage remains exactly zero.
These are initial review thresholds, not a trained or statistically validated quality classifier.

## Existing pieces measured on 2026-11-14

The following is a **read-only** sweep of all 13 studio pieces at `2d8c111`. No public asset was
rewritten. Metal % is the fraction of native atlas texels with effective metalness >0.5; σ is the
full-map roughness standard deviation. It is not a photographed surface-area percentage.

| Piece         | Flag | Mean / max ΔE00 | Metal % | Roughness σ | Reasons                                           |
| ------------- | ---- | --------------- | ------- | ----------- | ------------------------------------------------- |
| armchair      | Yes  | 12.27 / 25.11   | 16.97   | 0.12824     | mean delta e, region delta e, weak metal response |
| barrel        | No   | 5.71 / 11.19    | 0.00    | 0.01259     | None                                              |
| bedside-table | Yes  | 7.35 / 12.41    | 0.00    | 0.00006     | flat roughness                                    |
| cactus        | Yes  | 9.26 / 21.15    | 0.00    | 0.15735     | region delta e                                    |
| clay-vase     | Yes  | 9.97 / 15.02    | 0.00    | 0.00003     | flat roughness                                    |
| coffee-table  | Yes  | 8.90 / 13.41    | 0.00    | 0.00009     | flat roughness                                    |
| crate         | Yes  | 7.66 / 11.03    | 0.65    | 0.04784     | photo metal coverage review                       |
| espresso      | No   | 5.31 / 9.20     | 66.08   | 0.16939     | None                                              |
| lamp          | No   | 9.00 / 11.09    | 100.00  | 0.02501     | None                                              |
| sneaker       | Yes  | 3.40 / 21.26    | 0.00    | 0.01740     | region delta e                                    |
| sofa          | Yes  | 5.12 / 50.47    | 0.00    | 0.00000     | region delta e, flat roughness                    |
| swivel-chair  | Yes  | 11.92 / 20.82   | 0.00    | 0.08535     | region delta e                                    |
| vase          | Yes  | 7.85 / 10.08    | 0.00    | 0.00000     | flat roughness                                    |

### Separate public gallery copies

All six `/showcase/*.glb` assets were also measured with their own `/showcase/*.jpg` source photos.
These are not byte-identical to the studio files; all six flag.

| Piece         | Flag | Mean / max ΔE00 | Metal % | Roughness σ | Reasons                                                                                            |
| ------------- | ---- | --------------- | ------- | ----------- | -------------------------------------------------------------------------------------------------- |
| armchair      | Yes  | 16.67 / 37.77   | 14.96   | 0.12623     | mean delta e, region delta e, weak metal response                                                  |
| bedside-table | Yes  | 9.18 / 13.43    | 0.00    | 0.00006     | flat roughness                                                                                     |
| clay-vase     | Yes  | 13.05 / 16.99   | 100.00  | 0.00000     | mean delta e, flat metal roughness, flat roughness, missing roughness map, dielectric marked metal |
| coffee-table  | Yes  | 8.91 / 13.37    | 0.00    | 0.00009     | flat roughness                                                                                     |
| swivel-chair  | Yes  | 10.64 / 25.37   | 0.00    | 0.10697     | region delta e                                                                                     |
| vase          | Yes  | 7.84 / 10.05    | 0.00    | 0.00000     | flat roughness                                                                                     |

The crate warning is deliberately conservative: 4.42% source candidates versus 0.65% metal atlas,
with an actual metal response of 1. It is **not** proof of missing iron. Cactus, sneaker, sofa and
swivel flags include grid-boundary/masking sensitivity; inspect the side-by-side rather than
rejecting them. The gallery clay vase has no roughness map and uses glTF's metallic default.

## Run and review

```sh
bun scripts/material-fidelity-qa.ts --showcase
bun scripts/material-fidelity-qa.ts --gallery --out .data/pipeline-fidelity-evidence/gallery
bun scripts/material-fidelity-qa.ts --model model.glb --photo photo.jpg --hint 'brushed steel' --azimuth 30
# Writes corrected copies and reports to evidence only; never overwrites the input:
bun scripts/material-fidelity-qa.ts --showcase --repair --out .data/pipeline-fidelity-evidence/repaired
bun scripts/check-glb-geometry.ts before.glb after.glb
```

Each output directory contains `report.json`, `report.html` and `comparison.png`; `summary.json`
collects a batch. `--repair` also writes `repaired.glb` and `material-pass.json`. Open HTML locally:
left is the masked source, right the rendered model. Pipeline storage keys live in
`Render.quality.fidelity`; the database report is authoritative if an artifact write fails.
No automatic visibility changes, rejection, retry, regeneration or spending follows a flag.

Local evidence lives in `.data/pipeline-fidelity-evidence/` and is gitignored, including full JSON,
HTML/PNG, before-fix regression logs, pre-correction metal reports, repaired copies and check logs.
Unit tests run in ordinary CI: reference colour pairs, metal/dielectric decisions, texture output,
geometry mutations including compressed buffers, rendering, masks and advisory pipeline completion.
Full showcase runs remain an explicit local/manual command.

References: [glTF metallic-roughness specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#materials),
[Sharma/Wu/Dalal CIEDE2000 notes and reference pairs](https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/),
[glTF Transform NodeIO](https://gltf-transform.dev/modules/core/classes/NodeIO).
