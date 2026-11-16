# Post-generation motion guides

Offline Remotion artwork for the ready-model owner panel: a downloaded GLB moves into a web viewer, a Shopify product or a Blender scene. The wood coffee table is the repository's textured showcase model; its embedded materials are preserved. An elevated camera reveals the top grain. The surrounding interfaces are simplified illustrations, not recordings or working integrations. Clips are silent and use separate captions from the six web message files; the full written steps remain available in the app.

This isolated authoring package is not part of the web build or its runtime bundle. From this directory:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run render
```

Requires root workspace dependencies for the existing Geist font. Outputs go to `apps/web/public/motion/`: three 18-second H.264 videos, posters and localized WebVTT captions. `bun run render web --still` renders one poster for iteration. The script bundles only the coffee table and font in a temporary public directory.

Timing at 30 fps: 0–150 download; 150–360 import/prepare; 360–540 use/result. Every movement is frame-driven so the output can be reproduced. Update source, media and captions together. In the product, videos play once on first visibility, pause when out of view and respect reduced-motion preferences; native controls allow manual playback and replay.
