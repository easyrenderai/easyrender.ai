---

group: "compress-glb"
title: "Cómo comprimir un GLB y conservar el detalle"
description: "Localiza qué pesa dentro del GLB, reduce geometría o texturas y compara las dos versiones en el mismo visor."
date: 2026-11-28
updated: 2026-11-28
author: Jorge Rodríguez
authorType: person
keyword: "comprimir glb"
cta: "Prueba la vista previa de ángulos con una foto de producto."
---

Para comprimir un GLB y conservar el detalle, reduce el tamaño de las texturas si son predominantes o simplifica la malla si la geometría es clave. Exporta una copia y compara ambos archivos en el mismo visor. Acepta el más ligero tras verificar que los bordes y detalles sean visibles.

![Ilustración de teclado compacto, mitad sólida y mitad en malla](/blog/illustrations/compress-glb/hero.webp "Ilustración editorial hecha en Blender.")

## ¿Qué cambió al simplificar un modelo?

Importamos nuestra mesa de centro en Blender 5.2.3 e hicimos dos exportaciones GLB con los mismos ajustes. Con Decimate al 0,5 pasó de 16.228 a 8.114 triángulos. Las dos exportaciones pasaron de 1.687.180 a 863.068 bytes, alrededor de un 49 % menos.

Las cifras corresponden a las dos exportaciones de Blender. El archivo original de la web usa otra codificación y tiene un peso diferente.

![Exportación de referencia](/blog/figures/compress-glb/coffee-baseline-quarter.jpg "Exportación de referencia de 16.228 triángulos, abierta en Blender.")
![Misma cámara tras simplificar](/blog/figures/compress-glb/coffee-decimated-quarter.jpg "Exportación simplificada de 8.114 triángulos, con la misma cámara y luces.")

## ¿Qué ajuste conviene probar después?

Si domina la malla, cambia un parámetro de geometría y examina esquinas y uniones. Si dominan las texturas, reduce un mapa y revisa las marcas finas. Antes de aplicar compresión de texturas a todo un catálogo, comprueba su compatibilidad en el visor de destino.

## Repite la simplificación en Blender

1. Abre el GLB y guarda una copia editable del proyecto.
2. Selecciona el objeto, añade el modificador Decimate y elige Collapse. En la comparación usamos un factor de 0,5.
3. Gira el resultado y revisa el borde y los apoyos. Aplica el modificador en la copia de entrega antes de exportar.
4. Exporta otro GLB con los mismos ajustes que el de referencia. Reabre ambos en el visor de destino y compara peso y geometría.

## ¿Qué deberías revisar antes de publicar?

| Síntoma                    | Siguiente paso                            |
| -------------------------- | ----------------------------------------- |
| Se emborrona una etiqueta  | Recupera resolución de textura            |
| Cambian los cantos o patas | Reduce la intensidad de la simplificación |
| El nuevo archivo falla     | Revisa las extensiones y el validador     |

## Decide qué optimizar después

| Qué ocupa más                     | Primer cambio                                              | Cómo comprobarlo                                          |
| --------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------- |
| Datos de imagen                   | Reduce la resolución o usa una codificación compatible     | Compara el grano y el material en el visor                |
| Búferes de malla                  | Simplifica una copia del modelo                            | Revisa el contorno, los huecos y los apoyos finos         |
| Varios objetos repiten materiales | Unifica los materiales idénticos en una copia              | Compara el resultado y el peso de descarga                |
| El visor rechaza el archivo       | Comprueba qué extensiones admite antes de cambiar la malla | Reabre el modelo en la página y el dispositivo de destino |

**Fuente** [Khronos · glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [Khronos · KHR_texture_basisu](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_texture_basisu), [Blender · Decimate modifier](https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/decimate.html), [Khronos · glTF Validator](https://github.com/KhronosGroup/glTF-Validator).

[Guía relacionada](/es/guias/como-hacer-un-modelo-3d)

## Preguntas frecuentes

### ¿Cuánto debe pesar un GLB?

Consulta el límite de subida de la plataforma y elige un presupuesto de descarga para la página real. Compara el tiempo hasta poder girar el modelo y la visibilidad de los detalles.

Nuestro archivo simplificado quedó por debajo de un megabyte. Haz la misma prueba con tu pieza.

### ¿Menos triángulos significa menos bytes?

Menos triángulos no siempre significa menos bytes, ya que la compresión del GLB depende también de la textura, los atributos y la codificación. Revisa el número de triángulos y el tamaño del archivo antes y después. ¿Los datos del modelo se conservan con el mismo detalle?

### ¿Sobrescribo el original?

No sobrescribas el original. Guarda el archivo inicial y un registro de los ajustes.

Comprueba el archivo de entrega separado para recuperar el detalle sin rehacer el trabajo. Anota también el programa, el ajuste de exportación y el visor con los que hiciste la comparación.
