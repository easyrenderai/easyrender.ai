---

group: "3d-file-formats"
title: "Qué formato 3D elegir para web, RA o edición"
description: "Elige un formato 3D para visor web, realidad aumentada o edición y comprueba qué texturas y animaciones se conservan."
date: 2026-11-22
updated: 2026-11-22
author: Jorge Rodríguez
authorType: person
keyword: "formatos de archivo 3d"
cta: "Prueba la vista previa de ángulos con una foto de producto."
---

Elige GLB para un visor web de producto y USDZ para Quick Look de Apple. Para entregar una escena, confirma qué formatos admiten ambas herramientas y qué geometría, texturas y animaciones deben conservarse. Reabre una exportación en la aplicación de destino y compárala con una referencia.

![Ilustración de piezas cilíndricas apiladas, mitad sólida y mitad en malla](/blog/illustrations/3d-file-formats/hero.webp "Ilustración editorial hecha en Blender.")

## ¿Qué archivo conviene para cada uso?

| Destino                                                                | Punto de partida                     | Qué comprobar                        |
| ---------------------------------------------------------------------- | ------------------------------------ | ------------------------------------ |
| Visor web de producto                                                  | GLB                                  | Texturas y extensiones admitidas     |
| [Quick Look de Apple](https://developer.apple.com/quick-look-gallery/) | USDZ                                 | Apertura en dispositivo compatible   |
| Intercambio de geometría estática                                      | OBJ, MTL y mapas si hacen falta      | Rutas relativas, normales y unidades |
| Intercambio de escena o animación                                      | FBX si ambas herramientas lo admiten | Esqueleto, clips y materiales        |

Comprobamos qué datos llegaban al reabrir las exportaciones en Blender. El glTF sin su WebP conservó la geometría y perdió la textura. Sin el BIN, la importación falló. El FBX de una mesita conservó su imagen al reabrirlo y el archivo de materiales de aquel OBJ quedó sin mapa.

## ¿Cómo preparas una entrega que alguien pueda verificar?

Pregunta qué importador y versión usará la otra persona. Envía un modelo con la orientación esperada, una referencia visual y sus archivos auxiliares. Si tiene animación, identifica la secuencia y sus fotogramas.

Reabre el resultado en la aplicación de destino desde una carpeta limpia. Gira el objeto bajo luz neutra y compara el material. La apertura del archivo es solo la primera comprobación.

## ¿Qué deberías revisar antes de publicar?

| Síntoma                       | Qué revisar                                                          |
| ----------------------------- | -------------------------------------------------------------------- |
| Superficie gris               | Texturas ausentes o materiales incompatibles                         |
| Objeto tumbado                | Convenciones de ejes                                                 |
| Solo abre en un dispositivo   | Visor y extensiones requeridas                                       |
| El glTF no abre tras enviarlo | Adjunta el BIN y comprueba su ruta relativa                          |
| Falta una secuencia           | Comprueba el formato y qué animaciones se incluyeron al exportar     |
| El material pierde relieve    | Comprueba qué mapas admiten el exportador y la aplicación de destino |

![GLB del jarrón reabierto en Blender](/blog/figures/3d-file-formats/blender-reopen.jpg "Reabrimos una exportación del jarrón de EasyRender en una escena limpia de Blender y renderizamos esta vista de comprobación.")

## ¿Qué pasó al quitar un archivo?

| Prueba                           | Resultado en Blender                       |
| -------------------------------- | ------------------------------------------ |
| GLB reabierto por separado       | Cargaron la geometría y la textura         |
| glTF con sus recursos BIN y WebP | Cargaron la geometría y la textura         |
| glTF sin la textura WebP         | Cargó la geometría, con la textura ausente |
| glTF sin el búfer BIN            | Falló la importación                       |

Estos resultados corresponden a los archivos de la prueba. Abre la carpeta de entrega en un equipo que aún no tenga esos recursos en caché, igual que hará quien reciba el modelo.

**Fuente** [Khronos · glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [OpenUSD · USDZ specification](https://openusd.org/release/spec_usdz.html), [Apple · Quick Look](https://developer.apple.com/quick-look-gallery/), [Blender · Wavefront OBJ](https://docs.blender.org/manual/en/latest/files/import_export/obj.html), [Blender · FBX](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_fbx.html).

[Guía relacionada](/es/guias/como-hacer-un-modelo-3d)

## Preguntas frecuentes

### ¿Un GLB siempre lleva las texturas dentro?

Un GLB puede incluir las texturas o referenciar archivos externos, según la [especificación glTF](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-image). Comprueba qué ha creado tu exportador. Si necesitas entregar un único archivo, reábrelo desde una carpeta limpia y sin conexión. Cuando haya dependencias externas, adjúntalas conservando sus rutas relativas para que el visor pueda resolverlas.

### ¿OBJ admite animación?

OBJ sirve para entregar geometría estática. Si la otra persona necesita un esqueleto y secuencias de animación, acordad un formato compatible, como glTF o FBX. Exporta una secuencia conocida y comprobad que se reproduce en la herramienta de destino con los fotogramas y el movimiento esperados.

### ¿Debo guardar el proyecto original?

Guarda la escena original, sus texturas externas y los ajustes de exportación. Para la entrega, usa el formato que pida la otra herramienta y añade una referencia visual. Cuando necesites cambiar el modelo, edita el proyecto y repite la misma exportación y comprobación.
