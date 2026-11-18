---

group: compress-glb
title: "Cómo comprimir un GLB y conservar el detalle"
description: "Localiza qué pesa dentro del GLB, reduce geometría o texturas y compara las dos versiones en el mismo visor."
date: 2026-11-28
updated: 2026-11-28
keyword: "comprimir glb"
cta: "Prueba la vista previa de ángulos con una foto de producto."
---

Empieza por identificar qué ocupa espacio dentro del GLB. Reduce el tamaño de las texturas si dominan las imágenes o simplifica la malla si domina la geometría. Exporta una copia y compara ambos archivos en el mismo visor. Acepta el más ligero tras comprobar los bordes y detalles que verá el usuario.

<!-- ILLUSTRATION PENDING: /blog/illustrations/compress-glb/hero.webp; Preparar la portada editorial descrita en el brief. -->

## ¿Qué cambió al simplificar un modelo?

Importamos nuestra mesa de centro en Blender 5.2.3 e hicimos dos exportaciones GLB con los mismos ajustes. Con Decimate al 0,5 pasó de 16.228 a 8.114 triángulos. Las dos exportaciones pasaron de 1.687.180 a 863.068 bytes, alrededor de un 49 % menos.

Las cifras corresponden a las dos exportaciones de Blender. El archivo original de la web usa otra codificación y tiene un peso diferente.

![Exportación de referencia](../evidence/coffee-baseline-quarter.jpg)
![Misma cámara tras simplificar](../evidence/coffee-decimated-quarter.jpg)

## ¿Qué ajuste conviene probar después?

Si domina la malla, cambia un parámetro de geometría y examina esquinas y uniones. Si dominan las texturas, reduce un mapa y revisa las marcas finas. Antes de aplicar compresión de texturas a todo un catálogo, comprueba su compatibilidad en el visor de destino.

## ¿Qué deberías revisar antes de publicar?

| Síntoma                    | Siguiente paso                            |
| -------------------------- | ----------------------------------------- |
| Se emborrona una etiqueta  | Recupera resolución de textura            |
| Cambian los cantos o patas | Reduce la intensidad de la simplificación |
| El nuevo archivo falla     | Revisa las extensiones y el validador     |

<!-- IMAGE PENDING: Fotografiar o capturar el ejemplo descrito en el brief. -->

**Fuente** [Khronos · glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [Khronos · KHR_texture_basisu](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_texture_basisu), [Blender · Decimate modifier](https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/decimate.html), [Khronos · glTF Validator](https://github.com/KhronosGroup/glTF-Validator).

[Guía relacionada](/es/guias/como-hacer-un-modelo-3d)

## FAQ

### ¿Cuánto debe pesar un GLB?

Marca un objetivo con la página y el dispositivo de destino. Registra los bytes transferidos, el tiempo hasta poder girar el modelo y los detalles que deben seguir viéndose.

### ¿Menos triángulos significa menos bytes?

Puede ayudar si domina la geometría. Compara exportaciones completas con los mismos ajustes, porque también influyen las texturas, los atributos y la codificación.

### ¿Sobrescribo el original?

Conserva el original y un registro de los ajustes. Comprueba un archivo de entrega separado para poder recuperar detalle sin rehacer el trabajo.
