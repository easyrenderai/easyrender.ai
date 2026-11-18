---

group: compress-glb
title: "How to compress a GLB and preserve useful detail"
description: "Find what makes your GLB large, reduce geometry or textures and compare the result in the same viewer."
date: 2026-11-28
updated: 2026-11-28
keyword: "compress glb"
cta: "Try an angle preview from a product photo."
---

Start by locating the bytes inside the GLB. Reduce texture size if images dominate or simplify geometry if the mesh dominates. Export a copy and compare the two in the same viewer. Accept the smaller file only after checking the angles, edges and surface details your audience will see.

<!-- ILLUSTRATION PENDING: /blog/illustrations/compress-glb/hero.webp; Prepare the editorial cover described in the brief. -->

## What did simplifying one model change?

We imported our coffee table in Blender 5.2.3 and exported it twice with the same GLB settings. Applying a Decimate ratio of 0.5 reduced 16,228 triangles to 8,114. The two exports changed from 1,687,180 to 863,068 bytes, about 49% less.

These are the sizes of the two Blender exports. The site’s original GLB uses a separately prepared encoding, so it is a different baseline.

![Baseline export](../evidence/coffee-baseline-quarter.jpg)
![Same camera after decimation](../evidence/coffee-decimated-quarter.jpg)

## How do you choose the next optimisation?

For a mesh-heavy model, try one geometry adjustment and check corners and intersections. For a texture-heavy model, try a smaller map and inspect fine markings. Test compressed texture extensions in the destination viewer before committing a catalogue.

## What should you check before publishing?

| Symptom                | Next action                                         |
| ---------------------- | --------------------------------------------------- |
| Labels blur            | Restore texture resolution before changing geometry |
| Edges change near legs | Reduce the strength of decimation                   |
| New file fails to open | Check required extensions and validator output      |

<!-- IMAGE PENDING: Photograph or capture the example described in the brief. -->

**Source** [Khronos · glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [Khronos · KHR_texture_basisu](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_texture_basisu), [Blender · Decimate modifier](https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/decimate.html), [Khronos · glTF Validator](https://github.com/KhronosGroup/glTF-Validator).

[Related guide](/learn/glb-file)

## FAQ

### How small should a GLB be?

Set a target by testing the actual page and device. Record transferred bytes, time until the viewer becomes usable and which details must remain clear.

### Does fewer triangles always mean fewer bytes?

It can help if geometry dominates. Compare full exports with the same settings because textures, buffer encoding and attributes also contribute.

### Should I overwrite the source?

Keep the source and a record of export settings. Test a separate delivery file so you can restore detail without repeating the original modelling work.
