---

name: real-size
description: A render's real size (Render.sizeCm) scales the served GLB so AR shows the piece true; entered by the owner or synced from the store
type: project
---

- `Render.sizeCm` is `{widthCm?, depthCm?, heightCm?}`. The stored GLB is never rewritten: `servedModel`
  (`packages/core/src/render-materials.ts`) applies `applyRealSize` (`packages/harness/src/glb.ts`) on every
  serve, like material edits, to the original and to the `?view=1` copy. AR, GLB and USDZ downloads and the
  OBJ/FBX/BLEND exports get the scaled file. MCP `model_glb` and the plain `/model` of a render with no
  size are the stored file.
- Scale is uniform: from the height when there is one (glTF is Y up), else from the larger floor side
  against the model's larger floor side. Width and depth are not paired with the model's axes, because
  the model's front can face either way.
- Without a size, models are normalised to about 1 m on the long side, so AR shows an arbitrary size.
- Entry: Size tab on the render page (`SizePanel`, `PUT /api/renders/:id/size`). Store sync: catalog items
  carry `sizeCm` (WooCommerce and PrestaShop send it; Shopify has no native dimensions, so none yet). A
  store's size is copied to the render when the render is created; later changes in the store are not.

**Why:** Quick Look and Scene Viewer have no lock or reset, and resizing in AR is the only fix when the
real size is unknown. Vincent wanted resizing kept in AR (2026-11-23), so `ar-scale` stays auto.
**How to apply:** do not set `ar-scale="fixed"` unless every model has a real size.
