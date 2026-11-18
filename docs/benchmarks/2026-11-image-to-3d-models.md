# Image-to-3D model benchmark, November 2026

Is TRELLIS the best model for the 3D step? Three models were built from three showcase photos
(armchair, swivel chair, coffee table) and the GLBs were judged by eye.

**Result:** keep TRELLIS (v1) in production. TRELLIS.2 draws clearly better shape and colour, but it
costs 4x to 14x more, takes 3 to 10 minutes and returns GLBs of 31 to 36 MB, so it does not fit a
32-credit render or AR. Hunyuan 3.1 never ran: Replicate returned a capacity error on all four tries.

## How it was run

- Script `packages/harness/scripts/model3d-bakeoff.ts`, workflow `.github/workflows/sheet-bakeoff.yml`
  with `kind=models3d` (manual, `confirm=spend`).
- Workflow run [44261394920](https://github.com/easyrenderai/easyrender.ai/actions/runs/44261394920)
  (all three models, three photos) and run
  [44266135862](https://github.com/easyrenderai/easyrender.ai/actions/runs/44266135862) (Hunyuan
  retry on the armchair). Artifact `sheet-bakeoff` holds the GLBs (GitHub keeps it 90 days); a copy
  is in the project files under `benchmarks/image-to-3d-2026-11-18/`.
- **Like for like:** every model got the photo alone. Production TRELLIS also gets the nine cells of
  the angle sheet, so production quality is better than the TRELLIS row below. This run compares
  the models, not the production recipe.
- Cost: GPU seconds x $0.0014 (A100) for both TRELLIS versions; Hunyuan is $0.50 a run at the
  Replicate list price. Seconds are wall clock from start to finish.
- Raw rows: `data/image-to-3d-2026-11-18.json` and `data/image-to-3d-2026-11-18-hunyuan-retry.json`.

## Results

| photo        | model                   | result                               | seconds  | cost         | GLB size |
| ------------ | ----------------------- | ------------------------------------ | -------- | ------------ | -------- |
| armchair     | TRELLIS v1 (production) | valid GLB                            | 37       | $0.051       | 5.0 MB   |
| armchair     | TRELLIS.2               | valid GLB                            | 160      | $0.223       | 36.2 MB  |
| armchair     | Hunyuan 3.1             | failed, ResourceInsufficient (twice) | 144, 168 | not a result | -        |
| swivel chair | TRELLIS v1              | valid GLB                            | 43       | $0.061       | 5.9 MB   |
| swivel chair | TRELLIS.2               | valid GLB                            | 604      | $0.845       | 35.5 MB  |
| swivel chair | Hunyuan 3.1             | failed, ResourceInsufficient         | 164      | not a result | -        |
| coffee table | TRELLIS v1              | valid GLB                            | 33       | $0.047       | 4.6 MB   |
| coffee table | TRELLIS.2               | valid GLB                            | 457      | $0.640       | 31.2 MB  |
| coffee table | Hunyuan 3.1             | failed, ResourceInsufficient         | 145      | not a result | -        |

The script shows $0.50 for each failed Hunyuan run because it applies the list price. Whether Replicate
billed those failures is not verified: check the Replicate billing page.

## What the GLBs look like

Images in `images/2026-11-18-image-to-3d/`, top row TRELLIS v1, bottom row TRELLIS.2, three angles each;
`source-photos.jpg` has the photos.

- **Colour:** TRELLIS.2 matches the photos (ochre armchair, light grey fabric, light oak). TRELLIS v1 on
  a single photo comes out dark and muddy on all three.
- **Shape:** TRELLIS.2 models the armchair's tube frame, back cushion and straps and the table legs
  more truthfully. The v1 armchair has a thicker, blobbier frame and a darker cushion.
- **Surface:** TRELLIS.2 shows fabric and wood grain; v1 is smooth.
- **Cost of that quality:** about $0.22 to $0.85 against $0.05 to $0.06, 31 to 36 MB against 5 MB. A
  36 MB GLB is too heavy for a phone AR viewer without a decimation step we do not have.

## TRELLIS.2 with other settings

The default run used 1,000,000 faces, which explains the 31 to 36 MB files. A second run changed the
settings (`fishwowater/trellis2`: `pipeline_type`, `decimation_target`, `texture_size`; workflow runs
[44281838302](https://github.com/easyrenderai/easyrender.ai/actions/runs/44281838302) and
[44281843703](https://github.com/easyrenderai/easyrender.ai/actions/runs/44281843703)). Raw rows:
`data/image-to-3d-2026-11-18-trellis2-settings.json`.

| Settings                                           | Photo        | Result                     | Seconds | Cost   | GLB size |
| -------------------------------------------------- | ------------ | -------------------------- | ------- | ------ | -------- |
| t2-mid: 1024 cascade, 200,000 faces, 2048 texture  | swivel chair | valid GLB                  | 143     | $0.200 | 7.9 MB   |
| t2-mid                                             | armchair     | timed out after 40 minutes | -       | -      | -        |
| t2-low: 512, 100,000 faces, 1024 texture           | armchair     | timed out after 40 minutes | -       | -      | -        |
| t2-low                                             | swivel chair | timed out after 40 minutes | -       | -      | -        |
| t2-high: 1536 cascade, 500,000 faces, 4096 texture | armchair     | timed out after 40 minutes | -       | -      | -        |

- **File size:** 200,000 faces gave a 7.9 MB file against 35.5 MB at the default, and the swivel chair
  looks the same (`images/2026-11-18-image-to-3d/swivel-chair-t2-mid-vs-default.jpg`, top row 200,000
  faces, bottom row default). One photo, so this is a lean.
- **Cost:** $0.20 for that run against $0.845 for the default run on the same photo. The difference is
  mostly time on the GPU, and part of that is a cold start of 4 to 8 minutes billed to the run, so the
  cost varies a lot between runs.
- **Reliability:** four of five runs never finished. This copy of TRELLIS.2 on Replicate is too slow or
  short of capacity to sell. The scripts did not cancel timed-out predictions at the time (fixed
  since), so the four prediction ids may still be running on Replicate and should be cancelled in its
  dashboard.

## Decision and what is not known

- Production stays on TRELLIS v1 with the sheet cells. A render sells for 32 credits ($0.32) at a
  cost of $0.095. TRELLIS.2 at $0.22 to $0.85 would be 75 to 282 credits by the 70% margin rule.
- Not measured: TRELLIS.2 given the sheet cells (its input may not take them), Hunyuan 3.1 at all,
  and whether TRELLIS.2 needs 604 s on a quiet GPU or that was queueing. A premium "high quality" tier
  built on TRELLIS.2 is the next experiment, with GLB decimation. Re-run Hunyuan when Replicate has
  capacity; it is one command (see the README).
