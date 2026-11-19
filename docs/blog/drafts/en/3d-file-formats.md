---

group: "3d-file-formats"
title: "3D file formats for web, AR and editing"
description: "Choose GLB, USDZ, OBJ or FBX based on where the model goes and what has to survive the handoff."
date: 2026-11-22
updated: 2026-11-22
keyword: "3d file formats"
cta: "Try an angle preview from a product photo."
---

Use GLB for web product viewers and USDZ for Apple Quick Look. Send a GLB or USDZ with textures, orientation, and neutral lighting for inspection. Common mistake: assuming a file opens means it matches visuals or materials—always verify with the receiving app.

![Editorial rendering: stacked cylindrical parts, half solid and half wireframe](../covers/3d-file-formats.webp "Editorial illustration made in Blender.")

## What should you deliver for each job?

| Job                        | Starting format                   | Verify on delivery                   |
| -------------------------- | --------------------------------- | ------------------------------------ |
| Product viewer on the web  | GLB                               | Textures, extensions and first frame |
| Apple Quick Look           | USDZ                              | Opens on a compatible device         |
| Static geometry handoff    | OBJ plus MTL and maps when needed | Relative paths, normals and units    |
| Scene or animation handoff | FBX if supported by both tools    | Rig, clips and material mapping      |

We checked which data arrived when reopening exported files in Blender. A glTF project without its external WebP still opened with geometry, but its texture was missing. Removing the BIN stopped import. The FBX of a bedside table retained the texture when reopened, whereas that export’s OBJ material file referenced no map.

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

[How to make a 3D model](/learn/how-to-make-a-3d-model)

## FAQ

### Does GLB always include textures?

GLB may include textures, but not always—check the file’s resource list and embedded assets to confirm. Review the metadata for texture URLs and file paths to ensure they are valid and accessible. Verify texture URLs and file paths in the GLB metadata before use.

### Can OBJ carry animation?

For a typical handoff, treat OBJ as static geometry. Agree separately on a format for rigs and clips, and test that the recipient’s importer reads those features. Check the GLB metadata for valid texture URLs and file paths before sharing the file with the recipient.

### Do I need the original project file?

Keep the project as your editable source. Deliver the format required by the destination along with a visual reference, so you can regenerate it later without rebuilding the scene. Check the GLB metadata for valid texture URLs and file paths before using the file.
