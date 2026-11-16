# Project Memory Map

Read the entries relevant to your task before editing. Add detail as new files in this folder and
a line here. Keep this map short.

## Invariants

- Never commit secrets. Never paste one in chat, a PR or a memory file.
- Credits and Stripe code paths follow [credits and pricing](context/credits-and-pricing.md).
- Production-breaking mistakes: [CRITICAL-NEVER-DO](system/CRITICAL-NEVER-DO.md).

## Task entry points

- **Where things live:** [project structure](context/project-structure.md).
- **Money, credits, pricing, Stripe:** [credits and pricing](context/credits-and-pricing.md).
- **Deploys, env vars, database:** [deploys and environments](context/deploys-and-environments.md).
- **UI work:** `DESIGN.md` at the repo root.
- **Material realism (what stone, wood, metal can do):** [marble and stone](context/materials-marble-stone.md),
  [wood](context/materials-wood.md), [metal tube](context/materials-metal-tube.md),
  [PBR values](context/materials-pbr-reference.md). Code: `packages/harness/src/materials.ts`.
- **Material edits (owner swaps shine and tint, part pipeline next):** [material edits](context/material-edits.md).
- **Staged room scenes, lived-in look:** [staging rules](context/staging-lived-in-rooms.md).
- **Upscaling (the paid Upscale action, which model and why):** [upscalers](context/upscalers.md).
- **Issues, board, priority, status columns:** [project board](context/project-board.md).
