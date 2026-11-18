---

group: 3d-file-formats
title: "3D file formats for web, AR and editing"
description: "Choose GLB, USDZ, OBJ or FBX based on where the model goes and what has to survive the handoff."
date: 2026-11-22
updated: 2026-11-22
keyword: "3d file formats"
cta: "Try an angle preview from a product photo."
---

Choose the file format by opening the target app first. For a web product viewer, start with GLB. For Apple Quick Look, test a USDZ. When the next person needs to edit the asset, agree on a format their tool imports and list the features they need to keep.

<!-- ILLUSTRATION PENDING: /blog/illustrations/3d-file-formats/hero.webp; Prepare the editorial cover described in the brief. -->

## What should you deliver for each job?

| Job                        | Starting format                   | Verify on delivery                   |
| -------------------------- | --------------------------------- | ------------------------------------ |
| Product viewer on the web  | GLB                               | Textures, extensions and first frame |
| Apple Quick Look           | USDZ                              | Opens on a compatible device         |
| Static geometry handoff    | OBJ plus MTL and maps when needed | Relative paths, normals and units    |
| Scene or animation handoff | FBX if supported by both tools    | Rig, clips and material mapping      |

## How do you make a handoff checkable?

Ask which importer and version will be used. Send one actual asset with its expected orientation, visual reference and any external resources. For a rig, include the name and frame range of a known clip.

Open the result in the receiving app without access to your working folder. Rotate and inspect it in neutral lighting. A file that opens can still differ in materials or motion.

## What should you check before publishing?

| Symptom                          | What to check                                         |
| -------------------------------- | ----------------------------------------------------- |
| Grey surfaces                    | Missing texture paths or unsupported material mapping |
| Object on its side               | Axis conventions in exporter and importer             |
| Preview works on one device only | Target viewer and its required extensions             |

<!-- IMAGE PENDING: Photograph or capture the example described in the brief. -->

**Source** [Khronos · glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [OpenUSD · USDZ specification](https://openusd.org/release/spec_usdz.html), [Apple · Quick Look](https://developer.apple.com/quick-look-gallery/), [Blender · Wavefront OBJ](https://docs.blender.org/manual/en/latest/files/import_export/obj.html), [Blender · FBX](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_fbx.html).

[Related guide](/learn/glb-file)

## FAQ

### Does GLB always include textures?

GLB can package resources in the binary. Inspect the actual output when portability matters. The format also allows references, so the extension by itself does not prove that every image is embedded.

### Can OBJ carry animation?

For a typical handoff, treat OBJ as static geometry. Agree separately on a format for rigs and clips, and test that the recipient’s importer reads those features.

### Do I need the original project file?

Keep the project as your editable source. Deliver the format required by the destination along with a visual reference, so you can regenerate it later without rebuilding the scene.
