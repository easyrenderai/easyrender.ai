---

name: render-viewing-copy
description: Viewers and AR load a lighter copy of the GLB (viewGlbKey, /model?view=1); downloads and API clients get the original
type: project
---

A generated GLB is made for downloading: PNG textures at bake size, and on the High tier millions of
triangles (15 to 35 MB). Viewers (render page, AR page, gallery, library) load `/api/renders/:id/model?view=1`,
which serves `Render.viewGlbKey`: textures to JPEG (colour 2048, the rest 1024), unused textures
dropped, triangles capped. Code: `packages/harness/src/glb-view.ts`, `packages/core/src/render-view-model.ts`.

**Why:** the render page waited on a 15 MB model fetched through a serverless function. The copy is
about a tenth of that and looks the same.

**How to apply:**
- `/model` with no query, and `?download=1`, stay the original: API clients, MCP `model_glb`, downloads
  and the browser USDZ export read the stored file. Never point those at `?view=1`.
- Material edits are applied by material index to either file, so the copy must keep every material
  in place (the optimizer returns null otherwise).
- `viewGlbKey` equals `glbKey` when the file could not be made lighter; null means "not made yet":
  the first `?view=1` request converts and stores it (older renders), without moving `updatedAt`.
- A rebuild must set `viewGlbKey` together with `glbKey` (`renders-advance.ts` does).
- The paid angle sheet is the master PNG. The page draws `/preview?w=1536` (WebP); the download link
  has no `w` and gets the master.
