---

group: low-poly-vs-high-poly
title: "Low poly vs high poly for 3D product viewers"
description: "Choose mesh detail from the camera distance, silhouette and target device rather than one triangle limit."
date: 2026-12-16
updated: 2026-12-16
keyword: "low poly vs high poly"
cta: "Try an angle preview from a product photo."
---

Choose mesh detail by what the shopper needs to see. Keep geometry on the outline, curves and holes that matter as the product turns. Use textures for fine surface detail where possible. Compare two versions at the actual gallery size and at the closest zoom the viewer allows.

<!-- ILLUSTRATION PENDING: /blog/illustrations/low-poly-vs-high-poly/hero.webp; Prepare the editorial cover described in the brief. -->

## Which detail should remain geometry?

Keep chair-leg edges, handle openings and the lip of a vessel if they affect silhouette or parallax. Paint or bake fine surface grain where it does not change the contour. Review shadow edges and reflections as well as the mesh.

![Baseline tabletop and support](../evidence/coffee-baseline-side.jpg)
![Same side view after reducing triangles](../evidence/coffee-decimated-side.jpg)

## How do you choose a target?

Our public coffee table has 16,228 triangles and our bedside table has 69,910. Both have one material. These are two different objects, so neither number is a universal budget. For a decision, compare two exports of the same object, with the same framing, material and device.

## What should you check before publishing?

| Where it matters      | Keep or test                       |
| --------------------- | ---------------------------------- |
| Outer silhouette      | Check outline at front and profile |
| Hardware and openings | Retain real gaps and intersections |
| Surface grain         | Test texture detail at close zoom  |

<!-- IMAGE PENDING: Photograph or capture the example described in the brief. -->

**Source** [Blender · Decimate modifier](https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/decimate.html), [Khronos · glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [model-viewer · documentation](https://modelviewer.dev/docs/).

[Related guide](/learn/glb-file)

## FAQ

### Is there a standard low-poly limit?

Set a target for the page, camera and devices you serve. Record loading and rotation behaviour and keep enough detail for the tasks your viewer supports.

### What should I simplify first?

Start with areas hidden from view or flat surfaces with extra geometry. Reduce one area at a time and compare the result.

### Does a normal map save silhouette detail?

Use it for the appearance of shallow surface detail. Keep geometry where the shape changes the outline or creates a visible opening.
