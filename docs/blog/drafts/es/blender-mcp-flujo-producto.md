---

group: blender-mcp-product-workflow
title: "De una foto a una escena con Claude y Blender MCP"
description: "Integra un GLB de producto en Blender y usa Claude con MCP para editar una copia de la escena."
date: 2026-12-13
updated: 2026-12-13
keyword: "blender mcp"
cta: "Prueba la vista previa de ángulos con una foto de producto."
---

Genera y revisa primero el modelo del producto. Después intégralo en Blender y pide a Claude una tarea acotada mediante un conector MCP compatible. Comprueba el resultado en Blender y guarda una copia. Así puedes revisar por separado la geometría del producto y los cambios de cámara, luz o escena.

<!-- ILLUSTRATION PENDING: /blog/illustrations/blender-mcp-product-workflow/hero.webp; Preparar la portada editorial descrita en el brief. -->

## ¿Cómo preparas una prueba pequeña?

Abre una copia de la escena e importa un GLB conocido. Comprueba nombre, materiales y orientación. Sigue la configuración del conector que elijas y verifica que Claude puede enumerar los objetos antes de pedir cambios.

## ¿Qué incluyes en la primera instrucción?

Pide que conserve malla y materiales, coloque el producto con su nombre en la plataforma existente y lo encuadre en tres cuartos. Examina objeto, cámara y luz en Blender. Guarda una nueva versión.

## ¿Qué deberías revisar antes de publicar?

| Paso       | Evidencia                       |
| ---------- | ------------------------------- |
| Inspección | Objeto con nombre y referencia  |
| Edición    | Movimiento o cámara en la copia |
| Aprobación | Comprobación en visor y render  |

<!-- IMAGE PENDING: Fotografiar o capturar el ejemplo descrito en el brief. -->

**Fuente** [BlenderMCP · project documentation](https://github.com/ahujasid/mcp-for-blender), [Anthropic · Claude Code MCP](https://code.claude.com/docs/en/mcp), [Blender · glTF 2.0 import and export](https://docs.blender.org/manual/en/5.1/addons/import_export/scene_gltf2.html).

[Guía relacionada](/es/mcp)

## FAQ

### ¿Qué MCP genera el modelo?

Elige un servicio de imagen a 3D para el activo. El conector de Blender puede actuar sobre la escena. Revisa qué herramientas tiene cada uno.

### ¿Puedo probarlo con un GLB que ya tengo?

Sí. Utiliza un archivo que puedas verificar para aislar la colocación en escena del paso de generación.

### ¿Empiezo con el proyecto final?

Trabaja en una copia con un solo objeto identificado. Compara los cambios y conserva disponible la escena original.
