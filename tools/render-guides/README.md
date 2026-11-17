# Post-generation motion guides

Offline Remotion artwork for the ready-model owner panel: a downloaded GLB moves into a web viewer, a Shopify product or a Blender scene. The wood coffee table is the repository's textured showcase model; its embedded materials are preserved. An elevated camera reveals the top grain. The surrounding interfaces are simplified illustrations, not recordings or working integrations. Clips are silent and use separate captions from the six web message files; the full written steps remain available in the app.

This isolated authoring package is not part of the web build or its runtime bundle. From this directory:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run render
bun run check:alignment # requires ffmpeg on PATH; checks the delivered video pixels
```

Requires root workspace dependencies for the existing Geist font. Outputs go to `apps/web/public/motion/`: three 18-second H.264 videos, posters and localized WebVTT captions. `bun run render web --still` renders one poster for iteration. The script bundles only the coffee table and font in a temporary public directory.

Timing at 30 fps: 0–150 download; 150–360 import/prepare; 360–540 use/result. Every movement is frame-driven so the output can be reproduced. Update source, media and captions together. In the product, videos play once on first visibility, pause when out of view and respect reduced-motion preferences; native controls allow manual playback and replay.

Layout uses shared frame and viewport bounds. Download controls share one horizontal axis; file and cursor share a drag path; final-scene columns are vertically centred within their viewing area. The pixel check catches the original 62px download-button displacement.

## Homepage sequence

`node render.mjs hero` renders a 14-second, 1000×800 motion sequence from the existing public table photo, angle sheet and GLB in `showcase/README.md`. It is an illustrative sequence, not a new generation or a timing benchmark. Photo → sheet review → rotating model; all three stay on the frame centre. The original GLB and textures remain untouched on disk. The offline scene corrects the source's metallic default to nonmetallic wood and adjusts roughness/lighting for presentation. Neutral tone mapping and predominantly diffuse white lighting keep the wood closer to the source photo, without the previous washed-out highlights. The site uses the existing lightweight HTML video player, static localized step labels and a descriptive accessible label; no Remotion runtime is shipped.

Run `bun run check:hero-color` after rendering. It compares interior tabletop pixels in both the poster and video against a wood patch in the source photo (20/255 maximum mean channel difference, allowing viewpoint and lighting variation). The previous poster fails at 26.1/255. It also checks poster/video agreement within 3/255; the environment is installed before the first frame is captured so both use the same lighting. This is a regression guard for this composition, not a claim of exact photographic color matching; inspect several rotation frames as well. Keep the sampling regions in sync if the camera or layout changes.
