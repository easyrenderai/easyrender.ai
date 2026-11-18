# Benchmarks

Real runs against real models, saved so the next model decision starts from numbers. Each page lists
the date, the script, the workflow run, cost, timing and what passed.

| Page                                                           | Question                                                                         | Result                                                        |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [2026-11-sheet-models.md](2026-11-sheet-models.md)             | Which model draws the angle sheet, and is a 2K redraw before the build worth it? | NB2.1 at 1K; no redraw. Render cost about $0.095, 32 credits. |
| [2026-11-image-to-3d-models.md](2026-11-image-to-3d-models.md) | Is TRELLIS the best model for the 3D step?                                       | See the page.                                                 |

## Where things live

- `data/`: raw rows of each run as JSON (cost, seconds, guardrail result per photo and model).
- `images/`: strips of the sheets and renders of the GLBs, as JPEG.
- The GLBs are too large for git. Each page links the workflow run whose artifact `sheet-bakeoff`
  holds them (GitHub keeps artifacts 90 days), and a copy is kept in the project files under
  `benchmarks/`.

## How to run one

Both run from the manual workflow `.github/workflows/sheet-bakeoff.yml` ("Sheet bake-off"). It spends
real Replicate credits, so it needs `confirm=spend` as input and the repository secret
`REPLICATE_API_TOKEN`.

```bash
# angle sheets (and the TRELLIS build of each) over the showcase photos
gh workflow run sheet-bakeoff.yml -f kind=sheets -f confirm=spend -f candidates=nb21-1k,nb2-2k,lite-1k -f build=true
# image to 3D models
gh workflow run sheet-bakeoff.yml -f kind=models3d -f confirm=spend -f candidates=trellis1,hunyuan31,trellis2 -f photos=armchair,swivel-chair,coffee-table
```

Scripts: `packages/harness/scripts/sheet-bakeoff.ts` and `packages/harness/scripts/model3d-bakeoff.ts`.
Check the workflow inputs (`.github/workflows/sheet-bakeoff.yml`) for the current names before running.
