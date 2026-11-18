---

group: "blender-mcp-product-workflow"
title: "From product photo to a Blender scene with MCP"
description: "Bring a product GLB into a Blender scene and use Claude with a compatible MCP tool for bounded scene edits."
date: 2026-12-13
updated: 2026-12-13
keyword: "blender mcp"
cta: "Try an angle preview from a product photo."
---

Start by creating and reviewing the product model before importing it into Blender. Use a Blender MCP connector to give Claude a focused task. Check scene changes in Blender and save a copy to keep product geometry separate from camera, lighting, and scene setup.

![Editorial rendering: adjustable desk lamp, half solid and half wireframe](../covers/blender-mcp-product-workflow.webp "Editorial illustration made in Blender.")

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

[How to make a 3D model](/learn/how-to-make-a-3d-model)

## FAQ

### Which MCP generates the model?

In this workflow, easyrender creates the product model from the photo, and the Blender connector helps edit the scene after import. Some connectors can also call a separate generation provider. Check the connector’s listed tools and credentials before asking Claude to produce an asset.

### Can I try it with an existing GLB?

Yes. Import a known GLB into a test scene using Blender’s glTF importer. Check how the materials look and confirm the object orientation and dimensions in the viewport. Then ask Claude to list the scene objects so you can verify it targets the correct model.

### Should the first run edit a master scene?

Use a copy of the project and start with one named model. Give Claude a single operation, such as framing the product with the active camera. Inspect the mesh, materials and camera after the change, then save the result under a new filename.
