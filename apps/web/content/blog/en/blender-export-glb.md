---

group: "blender-export-glb"
title: "How to export GLB from Blender with textures"
description: "Export a textured GLB from Blender, reopen it on its own and diagnose missing color, normal maps, UVs or objects."
date: 2026-12-04
updated: 2026-12-04
author: Jorge Rodríguez
authorType: person
keyword: "blender export glb"
cta: "Try a free angle preview from a product photo."
---

To export a GLB with textures from Blender, connect your image maps to a compatible material, then choose **File → Export → glTF 2.0** and set the format to **glTF Binary (.glb)**. Reimport the resulting file into a new Blender scene before you send it. If the model opens but looks plain, start with the connection to **Base Color**.

![Speaker with a rendered surface on one side and wireframe on the other](/blog/illustrations/blender-export-glb/hero.webp "Editorial illustration made in Blender.")

## Which material settings survive the export?

Switch to the **Shading** workspace and select the object. In the Shader Editor, make sure the **Principled BSDF** feeds the material output. Check the images and sockets below for each material the customer should see. [Blender glTF exporter manual](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html).

| Map                    | Where it connects                                         | What to verify                                                     |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------------------ |
| Base color             | Image Texture to **Base Color**                           | The correct color image is connected and has UV coordinates        |
| Normal                 | Image Texture through a **Normal Map** node to **Normal** | The image uses **Non-Color** and the map is tangent-space          |
| Metallic and roughness | Blue and green channels respectively of a packed map      | Data uses **Non-Color** and the channels reach the correct sockets |

When a material depends on procedural noise or an unsupported node graph, bake the required appearance into image maps and wire those images into a supported setup. Check one small export before spending time on every material. [Blender texture baking](https://docs.blender.org/manual/en/5.2/render/cycles/baking.html).

## How do you export and verify the GLB?

1. **Select the deliverable.** Include every mesh you want to ship and inspect the main details in Material Preview. Save a copy of the `.blend` file with the editable scene.
2. **Choose the binary export.** Use **File → Export → glTF 2.0** and select **glTF Binary (.glb)**. Enable **Selected Objects** if you have deliberately selected everything that should ship. Leave material export enabled.
3. **Reopen only the GLB.** Place the export by itself in an empty folder. Start a new Blender scene and use **File → Import → glTF 2.0**. Check both sides, seams, logos and any transparent parts in Material Preview.
4. **Test where it will be used.** Run a format check with the [Khronos glTF Validator](https://github.khronos.org/glTF-Validator/). Then open the same file in your intended viewer. The validator checks the asset structure. Compare the actual appearance under the viewer's lighting as well.

Read the [GLB container specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#glb-file-format-specification) for embedded resources. For a store test, start with one draft product and its actual viewer. [Add 3D models to Shopify](/learn/shopify-3d-models).

## Why does the GLB open without its color texture?

In Blender 5.2.3 LTS, we re-exported an existing EasyRender chair twice. We disconnected just the Base Color image in a copy of the material for the second export.

Both files reimported on their own with 24,268 polygons. The second file still embedded one image, but its material had no base-color texture reference.

![Two Blender renders of the same chair, with the original color texture on the left and its test copy on the right](/blog/figures/blender-export-glb/base-color-test.webp "Blender renders of two GLB reimports under the same camera and light. Left uses the connected color texture. Right uses a test copy whose Base Color image connection was removed before export.")

| Reopened from its own folder           | Images embedded | Base color texture attached |
| -------------------------------------- | --------------- | --------------------------- |
| Original material                      | 2               | Yes                         |
| Copy with the color input disconnected | 1               | No                          |

**An embedded image count alone does not confirm that the right map is wired.** Check the material in the reopened file and inspect the photo details you expect to see. Use the [glTF material specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#metallic-roughness-material) if you are inspecting references programmatically.

## What should you fix when the export looks different?

| Symptom                                      | What to check                                                 | Change to test                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| A part is white or flat                      | The color image or material assignment is missing             | Reconnect Base Color and check the mesh's material slot                                                                         |
| Details look embossed in the wrong direction | Normal-map convention or node setup                           | Check that the map uses tangent space. For a DirectX normal map, invert the green (Y) channel                                   |
| The material looks too shiny                 | Roughness and metallic channels or color space                | Verify green for roughness, blue for metallic and Non-Color data                                                                |
| A logo moves or repeats                      | UV map selection and a Mapping node transform                 | Confirm the active UV coordinates and test the transform in the target viewer                                                   |
| A piece is absent                            | Mesh selection in the exported scene                          | Add the missing mesh to the selection and re-export                                                                             |
| The cropped edge of a label looks solid      | Alpha connection and the target viewer's transparency support | For a hard cutout, route the image Alpha through **Math → Round** to the shader Alpha. Verify the exported alpha mode is `MASK` |

Check the map and reset one variable at a time. For missing elements across multiple files, start with the simplest asset that reproduces the issue. [Blender normal maps](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html#normal-map). [Blender alpha modes](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html#alpha-modes). [What is a GLB file?](/learn/glb-file). [How to make a 3D model](/learn/how-to-make-a-3d-model).

## FAQ

### Does GLB include every texture used in my Blender scene?

The binary export packages the images referenced by the exported materials. Blender can omit a map when the exporter cannot read its node setup or the map does not feed a supported input. Reopen the GLB and inspect the materials for the details your final viewer needs.

### Should I enable compression before checking the first export?

Start with an export that your destination viewer supports and verify the materials and geometry. Try compression on a second copy and check that the viewer supports the extension it uses. Compare both file weight and visible quality on the device the customer will use.

### Can I use the GLB as my editable master file?

Keep the `.blend` file and its source textures for revisions. The GLB is a delivery file and stores material information in the glTF representation. Keep the export settings with the source, then re-export and recheck the result when you change the mesh or its materials.
