---

name: upscalers
description: Which upscaler the paid Upscale action runs, how it was picked, and what was measured
type: reference
---

The paid Upscale action runs `recraft-ai/recraft-crisp-upscale` on Replicate (`ENLARGE_MODEL` in
`packages/harness/src/models.ts`). Product views use the same model for their upscale step (to reach
the 2000 px packshot), switched from Real-ESRGAN on 2026-11-14 at Vincent's choice: a set went from
52 to 65 credits and a polish from 12 to 14. Not A/B tested on live Replicate yet; a failed upscale
still falls back to the drawn picture.

Bake-off 2026-11-14 (workflow `upscale-bakeoff.yml`, 6 real pictures: a dim staged room, a portrait
room, sofa, brass lamp, sneaker, painted barrel; plus 3 half-size ground-truth cases; judged by
eye on matching crops, plus mean colour drift against the input):

- **Crisp** (picked): about 4x, output capped at 4096 px, 1 to 4 s, about $0.006 per picture
  (Replicate: "around 166 images for $1"). Kept boucle, wood grain and brushed metal without
  inventing texture. Accepted a 2000x1500 input. Slightly soft next to Topaz.
- **Topaz** (`topazlabs/image-upscale`): crispest and most colour-faithful (drift 1.0/255 against
  2.2 for Crisp), 2x only in the test, 5 to 12 s, about $0.08 per picture ("around 12 units for
  $1"; one unit is not defined on the page, so the per-picture price is unverified). Candidate for
  a later "enhanced" tier at about 28 credits.
- **Real-ESRGAN**: cheapest ($0.002), but it fails on an input over 2.1 MP (a 2000x1500 picture
  returned an error), adds noise to fabric and tints dark fabric blue (visible on the sofa).
- **Bria increase-resolution**: faithful, about $0.04, 2x. No advantage over Crisp for the price.
- **fal SeedVR2, Aura SR, Clarity**: SeedVR2 and Clarity repaint fabric (the boucle turns into
  a woven or velvet pattern); Aura SR over-textures (colour drift 5.0/255). Rejected for
  interiors. fal also hosts Recraft Crisp; its output matched Replicate's in size and look, not compared pixel by pixel.
- Not testable: `philz1337x/clarity-upscaler`, `google/upscaler`, `zsxkib/seedvr2` answered 404 or 422
  on Replicate with our token.

PSNR against the original (half-size cases) was no help: it rewards smoothing, so every model lost
to plain Lanczos on most images. The "detail" ratio in `upscale-bakeoff.ts` is on a 256 px grid and
is not meaningful; look at the crops.

**Why:** Vincent asked for an upscaler for the interior designer and architect suite (#159). Designers
want the picture sharper, not changed.
**How to apply:** change the model in `ENLARGE_MODEL` and its cost in `ENLARGE_COST_USD` together;
the action, product views and every price follow from those two.
