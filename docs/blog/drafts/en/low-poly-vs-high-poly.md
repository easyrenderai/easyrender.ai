---

group: "low-poly-vs-high-poly"
title: "Low poly vs high poly for 3D product viewers"
description: "Choose mesh detail from the camera distance, silhouette and target device rather than one triangle limit."
date: 2026-12-16
updated: 2026-12-16
keyword: "low poly vs high poly"
cta: "Try an angle preview from a product photo."
---

Use low poly for 3D product viewers if the product has simple shapes and clear silhouettes. Export both low and high poly versions and compare them at full gallery size and maximum zoom. Common mistake: ignoring hardware gaps or surface grain at close zoom—always test texture detail.

![Editorial rendering: cup with a handle, half solid and half wireframe](../covers/low-poly-vs-high-poly.webp "Editorial illustration made in Blender.")

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

[How to make a 3D model](/learn/how-to-make-a-3d-model)

## FAQ

### Is there a standard low-poly limit?

Set a low-poly limit based on your target page, camera, and device specs. Test loading and rotation speed across supported devices. Check frame rate and texture load time for smooth interaction. Verify performance on the lowest-end device in your target audience.

### What should I simplify first?

Simplify flat surfaces and hidden areas first to reduce polygon count without losing key details. Use the Decimate modifier to reduce geometry in one area at a time. Check the outer silhouette and shadow edges to ensure the product’s outline and gaps remain accurate.

### Does a normal map save silhouette detail?

Use a normal map for shallow surface detail. It does not save silhouette detail. Keep base geometry where shape changes the outline or creates a visible opening. Check that the low-poly model’s silhouette remains sharp and visible in the 3D viewer.
