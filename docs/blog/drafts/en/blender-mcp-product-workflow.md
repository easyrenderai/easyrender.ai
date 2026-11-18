---

group: blender-mcp-product-workflow
title: "From product photo to a Blender scene with MCP"
description: "Bring a product GLB into a Blender scene and use Claude with a compatible MCP tool for bounded scene edits."
date: 2026-12-13
updated: 2026-12-13
keyword: "blender mcp"
cta: "Try an angle preview from a product photo."
---

Create and review the product model first, then use Blender to place it in a scene. Give Claude a narrowly scoped task through a compatible Blender MCP connector. Check the changes in Blender and save a copy. This keeps product geometry separate from the camera, lighting and scene instructions.

<!-- ILLUSTRATION PENDING: /blog/illustrations/blender-mcp-product-workflow/hero.webp; Prepare the editorial cover described in the brief. -->

## How do you set up a small test?

Open a copy of the scene and import a known GLB. Check its name, materials and orientation. Follow the chosen connector’s setup and confirm Claude can list the scene objects before you ask it to change anything.

## What should the first instruction say?

Ask it to keep the mesh and materials intact, place the named product on the existing platform and frame it from three quarters. Review the object, camera and lighting in Blender, then save a new project version.

## What should you check before publishing?

| Step    | Evidence to keep                     |
| ------- | ------------------------------------ |
| Inspect | Named object and known reference     |
| Edit    | Camera or placement change in a copy |
| Approve | Viewport and render check            |

<!-- IMAGE PENDING: Photograph or capture the example described in the brief. -->

**Source** [BlenderMCP · project documentation](https://github.com/ahujasid/mcp-for-blender), [Anthropic · Claude Code MCP](https://code.claude.com/docs/en/mcp), [Blender · glTF 2.0 import and export](https://docs.blender.org/manual/en/5.1/addons/import_export/scene_gltf2.html).

[Related guide](/mcp)

## FAQ

### Which MCP generates the model?

Choose a photo-to-3D service for the asset. A Blender connector can help edit scene objects. Check the tools available in each before assigning the task.

### Can I try it with an existing GLB?

Yes. Import an asset you can verify to isolate the scene workflow from model generation.

### Should the first run edit a master scene?

Start in a copy with a single named asset. Compare the changes and keep the original project available.
