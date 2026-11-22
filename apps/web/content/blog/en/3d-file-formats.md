---

group: "3d-file-formats"
title: "3D file formats for web, AR and editing"
description: "Choose a 3D file format for a web viewer, augmented reality or editing, and check which textures and animations survive the handoff."
date: 2026-11-22
updated: 2026-11-22
author: Jorge Rodríguez
authorType: person
keyword: "3d file formats"
cta: "Try an angle preview from a product photo."
---

Choose GLB for a web product viewer and USDZ for Apple Quick Look. For scene exchange, select a format both tools can read and list the geometry, textures and motion that must survive. Reopen one export in the recipient’s app and compare its orientation, material and animation against a reference.

![Editorial rendering: stacked cylindrical parts, half solid and half wireframe](/blog/illustrations/3d-file-formats/hero.webp "Editorial illustration made in Blender.")

## What should you deliver for each job?

| Job                                                                 | Starting format                   | Verify on delivery                   |
| ------------------------------------------------------------------- | --------------------------------- | ------------------------------------ |
| Product viewer on the web                                           | GLB                               | Textures, extensions and first frame |
| [Apple Quick Look](https://developer.apple.com/quick-look-gallery/) | USDZ                              | Opens on a compatible device         |
| Static geometry handoff                                             | OBJ plus MTL and maps when needed | Relative paths, normals and units    |
| Scene or animation handoff                                          | FBX if supported by both tools    | Rig, clips and material mapping      |

We re-imported the files with Blender. The bedside table FBX still opened with its image texture, while the OBJ from that test had a material file that referenced no image. The table below records what happened when we removed each separate glTF resource.

## How do you make a handoff checkable?

Ask which importer and version will be used. Send one actual asset with its expected orientation, visual reference and any external resources. For a rig, include the name and frame range of a known clip.

Open the result in the receiving app without access to your working folder. Rotate and inspect it in neutral lighting. A file that opens can still differ in materials or motion.

## What should you check before publishing?

| Symptom                            | What to check                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| Grey surfaces                      | Missing texture paths or unsupported material mapping                           |
| Object on its side                 | Axis conventions in exporter and importer                                       |
| Preview works on one device only   | Target viewer and required extensions                                           |
| Nothing opens after sending a glTF | Send the BIN and check its relative path                                        |
| A motion clip is missing           | Confirm the sender used a format with animation support and exported the clip   |
| Material is flat after exchange    | Inspect which property maps the original exporter and the receiving app support |

![An exported vase GLB reopened in Blender](/blog/figures/3d-file-formats/blender-reopen.jpg "We reopened a GLB exported from the EasyRender vase on a clean Blender scene and rendered this inspection view.")

## What changed when we removed a file?

| Test                                 | Result in Blender                        |
| ------------------------------------ | ---------------------------------------- |
| GLB reopened by itself               | Geometry and texture loaded              |
| glTF with its BIN and WebP resources | Geometry and texture loaded              |
| glTF without the WebP texture        | Geometry loaded. The texture was missing |
| glTF without the BIN buffer          | Import failed                            |

These results describe the files in this test. Use the full delivery folder to confirm that the recipient can open your model on a machine that has never cached the resources.

**Source** [Khronos · glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [OpenUSD · USDZ specification](https://openusd.org/release/spec_usdz.html), [Apple · Quick Look](https://developer.apple.com/quick-look-gallery/), [Blender · Wavefront OBJ](https://docs.blender.org/manual/en/latest/files/import_export/obj.html), [Blender · FBX](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_fbx.html).

[Related guide](/learn/glb-file)

[How to make a 3D model](/learn/how-to-make-a-3d-model)

## FAQ

### Does GLB always include textures?

Check the export for integrated or external textures, as described by the [glTF specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-image). If you require a single file, reopen the GLB in a clean folder with the network disconnected. Supply any remaining dependencies with their relative paths intact.

### Can OBJ carry animation?

Use OBJ to deliver static geometry. If the recipient needs a skeleton and clips, choose a supported animation format, such as glTF or FBX. Export a known clip and check that the receiver can play it, with the correct frame range and the expected motion.

### Do I need the original project file?

Keep the original project, its external textures and the export settings. Send the receiving app the format it uses and add a reference image of the expected result. If the model needs revisions later, make them in the source and repeat the same export and inspection.
