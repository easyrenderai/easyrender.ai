---

name: render-models
description: Why the preview sheet and the 3D build use the models they do, and where the bake-off results live
type: project
---

# Render models

Decisions, not values. The models and prices are in `packages/harness/src/models.ts` and
`pricing.ts`; read those for what runs now.

- The free preview's sheet comes from Nano Banana 2.1 at 1K, with Nano Banana 2 Lite as the fallback
  on a provider error. Product views draw a 2K sheet with the same model.
- The paid build runs TRELLIS on the preview sheet. There is no 2K redraw.
- The private harness repo cannot change the sheet model or resolution (`parseHarness` ignores
  `sheet`). A `sheet` key in `harness.json` does nothing.
- The watermark is added when the preview is served. The stored sheet (`sheetKey`) is the clean
  master that the build reads.
- Bake-off results, scripts and how to re-run: `docs/benchmarks/README.md`.

**Why:** the 2K redraw bought no visible quality and roughly doubled what a paid render cost us.
Nano Banana Pro cost far more per sheet and failed the checks more often. TRELLIS.2 looked better
than TRELLIS but returned very large files and cost several times more at its default settings;
whether its settings fix that is being tested.
**How to apply:** change a model only after a bake-off (`sheet-bakeoff.yml`, which costs real
credits). Keep `costUsd` in `models.ts` in step with `pricing.ts`; credits follow from the pricing
rule.

**TRELLIS v1 colour and detail (2026-11-18):** extra settings (`mesh_simplify`, sampler steps) did not
add visible detail, so v1 stays as is and detail goes to the TRELLIS.2 tier. Its textures run dark
and the per-texel correction often skips, so `matchColorToPhoto` runs as a fallback.
**Why:** colour drift is a model habit that a cheap texture scale fixes; detail is a model limit.
**How to apply:** do not spend on v1 setting sweeps again; judge new detail work on TRELLIS.2.
