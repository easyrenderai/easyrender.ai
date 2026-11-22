---

group: "compress-glb"
title: "How to compress a GLB and preserve useful detail"
description: "Find what makes your GLB large, reduce geometry or textures and compare the result in the same viewer."
date: 2026-11-28
updated: 2026-11-28
author: Jorge Rodríguez
authorType: person
keyword: "compress glb"
cta: "Try an angle preview from a product photo."
---

To compress a GLB and preserve useful detail, reduce texture size if images dominate or simplify geometry if the mesh dominates. Export a copy and compare the two in the same viewer. Accept the smaller file only after checking angles, edges, and surface details your audience will see.

![Editorial rendering: compact keyboard, half solid and half wireframe](/blog/illustrations/compress-glb/hero.webp "Editorial illustration made in Blender.")

## What did simplifying one model change?

We imported our coffee table in Blender 5.2.3 and exported it twice with the same GLB settings. Applying a Decimate ratio of 0.5 reduced 16,228 triangles to 8,114. The two exports changed from 1,687,180 to 863,068 bytes, about 49% less.

These are the sizes of the two Blender exports. The site’s original GLB uses a separately prepared encoding, so it is a different baseline.

![Baseline export](/blog/figures/compress-glb/coffee-baseline-quarter.jpg "Baseline export: 16,228 triangles, reopened in Blender.")
![Same camera after decimation](/blog/figures/compress-glb/coffee-decimated-quarter.jpg "Decimated export: 8,114 triangles, rendered with the same camera and lights.")

## Repeat the simplification in Blender

1. Open the GLB and save an editable copy of the project.
2. Select the object, add a Decimate modifier and choose Collapse. In our comparison we used a ratio of 0.5.
3. Rotate the result and inspect the rim and supports. Apply the modifier on the delivery copy before exporting.
4. Export a new GLB using the same settings as the baseline. Reopen both files in the target viewer and compare transfer size and geometry.

## How do you choose the next optimisation?

For a mesh-heavy model, try one geometry adjustment and check corners and intersections. For a texture-heavy model, try a smaller map and inspect fine markings. Test compressed texture extensions in the destination viewer before committing a catalogue.

## What should you check before publishing?

| Symptom                | Next action                                         |
| ---------------------- | --------------------------------------------------- |
| Labels blur            | Restore texture resolution before changing geometry |
| Edges change near legs | Reduce the strength of decimation                   |
| New file fails to open | Check required extensions and validator output      |

## Decide what to optimise next

| What dominates                   | First change                                                         | How to check                                       |
| -------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------- |
| Image data                       | Reduce the texture dimensions or choose a supported texture encoding | Check the grain and material in the target viewer  |
| Mesh buffers                     | Decimate a new copy and compare it to the source                     | Inspect silhouettes, holes and thin supports       |
| Several objects repeat materials | Merge identical materials in a delivery copy                         | Compare the visual result and actual transfer size |
| A web viewer rejects the asset   | Check extension support before changing geometry                     | Reopen on the target page and device               |

**Source** [Khronos · glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [Khronos · KHR_texture_basisu](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_texture_basisu), [Blender · Decimate modifier](https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/decimate.html), [Khronos · glTF Validator](https://github.com/KhronosGroup/glTF-Validator).

[Related guide](/learn/glb-file)

[How to make a 3D model](/learn/how-to-make-a-3d-model)

## FAQ

### How small should a GLB be?

Use the destination’s upload limit and choose a download budget for the real page and device. Compare time to interaction and the visibility of the details that matter. Our measured smaller export was under one megabyte, but other products and textures need their own test.

### Does fewer triangles always mean fewer bytes?

Triangle count tells you how much geometry is present, while textures and buffer encoding also affect file size. If images account for most bytes, work on them first. Compare the complete before and after downloads under the same export settings and inspect them in the same viewer.

### Should I overwrite the source?

Keep the source and a record of export settings. Test a separate delivery file so you can restore detail without repeating the original modelling work. Test the compressed GLB in the actual destination viewer to confirm textures and details appear clear and intact.
