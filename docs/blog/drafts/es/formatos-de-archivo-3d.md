---

group: 3d-file-formats
title: "Qué formato 3D elegir para web, RA o edición"
description: "Compara GLB, USDZ, OBJ y FBX según el destino de tu modelo y los datos que necesitas conservar."
date: 2026-11-22
updated: 2026-11-22
keyword: "formatos de archivo 3d"
cta: "Prueba la vista previa de ángulos con una foto de producto."
---

Elige el formato a partir de la aplicación que abrirá el modelo. Para un visor web, empieza por GLB. Para Quick Look de Apple, prueba USDZ. Si otra persona va a editar la pieza, acordad qué formato admite su herramienta y qué materiales, texturas o animaciones necesita conservar.

<!-- ILLUSTRATION PENDING: /blog/illustrations/3d-file-formats/hero.webp; Preparar la portada editorial descrita en el brief. -->

## ¿Qué archivo conviene para cada uso?

| Destino                           | Punto de partida                     | Qué comprobar                        |
| --------------------------------- | ------------------------------------ | ------------------------------------ |
| Visor web de producto             | GLB                                  | Texturas y extensiones admitidas     |
| Quick Look de Apple               | USDZ                                 | Apertura en dispositivo compatible   |
| Intercambio de geometría estática | OBJ, MTL y mapas si hacen falta      | Rutas relativas, normales y unidades |
| Intercambio de escena o animación | FBX si ambas herramientas lo admiten | Esqueleto, clips y materiales        |

## ¿Cómo preparas una entrega que alguien pueda verificar?

Pregunta qué importador y versión usará la otra persona. Envía un activo con la orientación esperada, una referencia visual y sus archivos auxiliares. Si tiene animación, identifica un clip y sus fotogramas.

Reabre el resultado en la aplicación de destino desde una carpeta limpia. Gira el objeto bajo luz neutra y compara el material. La apertura del archivo es solo la primera comprobación.

## ¿Qué deberías revisar antes de publicar?

| Síntoma                     | Qué revisar                                  |
| --------------------------- | -------------------------------------------- |
| Superficie gris             | Texturas ausentes o materiales incompatibles |
| Objeto tumbado              | Convenciones de ejes                         |
| Solo abre en un dispositivo | Visor y extensiones requeridas               |

<!-- IMAGE PENDING: Fotografiar o capturar el ejemplo descrito en el brief. -->

**Fuente** [Khronos · glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [OpenUSD · USDZ specification](https://openusd.org/release/spec_usdz.html), [Apple · Quick Look](https://developer.apple.com/quick-look-gallery/), [Blender · Wavefront OBJ](https://docs.blender.org/manual/en/latest/files/import_export/obj.html), [Blender · FBX](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_fbx.html).

[Guía relacionada](/es/guias/como-hacer-un-modelo-3d)

## FAQ

### ¿Un GLB siempre lleva las texturas dentro?

El contenedor permite empaquetarlas, pero también puede referenciar recursos externos. Si necesitas un archivo portable, verifica la exportación en una carpeta que contenga únicamente ese GLB.

### ¿OBJ admite animación?

Para una entrega habitual, trátalo como geometría estática. Acordad otro formato para esqueletos y animaciones y comprobad esas funciones en el importador de destino.

### ¿Debo guardar el proyecto original?

Guarda la escena como fuente editable. Entrega una copia en el formato que pida el destino y una referencia visual para comprobar la próxima exportación.
