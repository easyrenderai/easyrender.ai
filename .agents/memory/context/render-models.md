---

name: render-models
description: Which models draw the angle sheet and build the 3D model, what a render costs us, and where the bake-off results live
type: project
---

# Render models

- Free preview sheet: Nano Banana 2.1 at 1K (`SHEET_MODEL`, $0.0336). Fallback on a provider 5xx is
  Nano Banana 2 Lite (`FALLBACK_SHEET_SETTINGS`). Product views draw a 2K sheet with NB2.1
  (`FINAL_SHEET_MODEL`, $0.0504).
- Paid build: TRELLIS (`firtoz/trellis`) from the photo plus the preview sheet's nine cells. No 2K
  redraw. Measured build cost is about $0.093 a render (17 builds, $0.071 to $0.126), billed by
  `predict_time` x $0.0014/s, and does not depend on which model drew the sheet. `RENDER_CREDITS` is 32.
- Why NB2.1 1K: it builds as well as NB2 2K by eye and costs a third as much. Nano Banana Pro 2K cost
  $0.15 a sheet and passed 3 of 6, so it was dropped.
- The private harness repo cannot change the sheet model or resolution (`parseHarness` ignores
  `sheet`). A `sheet` key in `harness.json` is inert; do not rely on it.
- Watermark is added when the preview is served; the stored sheet (`sheetKey`) is the clean master
  that the build reads.
- Bake-off results, scripts and how to re-run: `docs/benchmarks/README.md`.

**Why:** a paid render cost about $0.195 (two sheets plus the build) and the 2K redraw bought no
visible quality.
**How to apply:** change a model only after a bake-off (`sheet-bakeoff.yml`, costs real credits) and
keep `costUsd` in `models.ts` in step with `pricing.ts`; credits then follow from the pricing rule.
