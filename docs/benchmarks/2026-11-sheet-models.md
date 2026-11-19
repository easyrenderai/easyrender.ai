# Angle sheet and build benchmark, November 2026

Which model should draw the 3x3 angle sheet that the 3D build starts from, and does the build need a
bigger second sheet? Both questions were answered with the same six showcase photos
(`apps/web/public/showcase`) and the production sheet prompt, guardrails and TRELLIS settings.

**Result:** a 1K sheet from Nano Banana 2.1 builds as well as a 2K sheet from Nano Banana 2 and costs
a third as much. The free preview now draws it, and a paid build runs TRELLIS on that same sheet.
A render costs us about $0.095 instead of about $0.195, and `RENDER_CREDITS` went from 64 to 32.

## How it was run

- Script: `packages/harness/scripts/sheet-bakeoff.ts`, workflow `.github/workflows/sheet-bakeoff.yml`
  (manual, needs `confirm=spend`, secret `REPLICATE_API_TOKEN`).
- The sheet is checked with the production guardrails (`checkSheet`), then built with TRELLIS
  (`firtoz/trellis`, texture 2048, the production inputs). Build cost is `predict_time` x $0.0014 per
  second (A100), so it is measured, not the Replicate list price.
- Shape and material were judged by eye on the strips in `images/2026-11-17-sheets/`. The checks only
  catch broken sheets. A round vase fails the "repeated views" check on every model even when the sheet
  looks right, so those misses are not a quality signal.
- Raw rows: `data/sheet-bakeoff-2026-11-17.json` and `data/sheet-bakeoff-2026-11-13.json`.

## Run of 2026-11-17: Nano Banana (workflow run 44185260066)

| candidate | sheets passing checks | sheet $ (Replicate list) | avg sheet seconds | builds ok | avg build $ |
| --------- | --------------------- | ------------------------ | ----------------- | --------- | ----------- |
| lite-1k   | 4/6                   | $0.0340                  | 6                 | 4         | $0.088      |
| nb2-2k    | 5/6                   | $0.1010                  | 17                | 5         | $0.094      |
| nb21-1k   | 4/6                   | $0.0336                  | 54                | 4         | $0.099      |
| nb21-2k   | 4/6                   | $0.0504                  | 31                | 4         | $0.092      |

17 builds measured $0.071 to $0.126 each, average $0.093. The build cost does not depend on which model
drew the sheet.

By eye (armchair and swivel chair, GLBs rendered in `images/2026-11-17-sheets/glb-*.jpg`, top row Lite
1K, middle NB2 2K, bottom NB2.1 1K): NB2.1 1K and NB2 2K are alike and clean; the Lite armchair has a
lumpier cushion. Two photos is a lean, not proof. NB2.1 1K was slower in this run (about 54 s per sheet
against 6 s for Lite), which makes the free preview slower.

## Run of 2026-11-17: GPT Image 2.6 (workflow run 44185266465)

Quality `medium`, 1:1, 4 photos. Replicate bills it per token, so the per-sheet price was not measured.

| candidate      | sheets passing checks | sheet $ (Replicate list) | avg sheet seconds | builds ok | avg build $ |
| -------------- | --------------------- | ------------------------ | ----------------- | --------- | ----------- |
| gpt26-flare    | 4/4                   | per token, not measured  | 9                 | 4         | $0.103      |
| gpt26-sunburst | 4/4                   | per token, not measured  | 24                | 4         | $0.103      |

All sheets passed, including the clay vase every Nano Banana missed. 3D from these sheets was not
compared by eye, and the price is unknown, so it is not in production.

## Run of 2026-11-13 (earlier, workflow run 43478844970)

Nano Banana Pro 2K, NB2 2K and 1K, Lite 1K. The OpenAI rows failed on an invalidated key and Replicate
500s, so they are left out here (they are in the raw file).

| candidate | sheets passing checks | sheet $ (Replicate list) | avg sheet seconds | builds ok | avg build $ |
| --------- | --------------------- | ------------------------ | ----------------- | --------- | ----------- |
| lite-1k   | 5/6                   | $0.0340                  | 6                 | 5         | $0.097      |
| nb2-1k    | 5/6                   | $0.0670                  | 28                | 5         | $0.102      |
| nb2-2k    | 4/6                   | $0.1010                  | 25                | 4         | $0.101      |
| pro-2k    | 3/6                   | $0.1500                  | 25                | 3         | $0.098      |

Pro passed 3 of 6 and cost $0.15 a sheet, so it was dropped. Note: a bake-off of 2026-11-17 first
failed on every call after a minute because `createReplicate` enforces a 45 s budget per client; the
script now makes a client per call (PR #285). Production is not affected: it makes a client per call.

## What changed in production

|                          | before                                            | after                                                       |
| ------------------------ | ------------------------------------------------- | ----------------------------------------------------------- |
| Free preview             | Nano Banana 2 Lite 1K, $0.034                     | Nano Banana 2.1 1K, $0.0336 (Lite is the fallback on a 5xx) |
| Paid build               | redraw a 2K sheet with NB2 ($0.101), then TRELLIS | TRELLIS on the preview sheet                                |
| Our cost per paid render | about $0.191 (code) / $0.20 (measured)            | about $0.095                                                |
| `RENDER_CREDITS`         | 64                                                | 32                                                          |
| Product views 2K sheet   | NB2 2K, $0.101                                    | NB2.1 2K, $0.0504                                           |

Not measured: 3D quality of NB2.1 1K against NB2 2K beyond two photos, and the 2.1 sheet on a very large
catalog. Re-run the workflow after a model or harness change.
