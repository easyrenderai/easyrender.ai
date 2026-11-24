---

group: "blender-export-glb"
title: "Cómo exportar un GLB desde Blender con texturas"
description: "Exporta un GLB con texturas desde Blender, ábrelo en una escena nueva y detecta problemas de color, mapas de normales, UV u objetos."
date: 2026-12-04
updated: 2026-12-04
author: Jorge Rodríguez
authorType: person
keyword: "exportar glb blender"
cta: "Sube una foto y comprueba gratis cómo se ve tu producto desde varios ángulos."
---

Para exportar un GLB con texturas desde Blender, conecta los mapas de imagen a un material compatible y ve a **Archivo → Exportar → glTF 2.0**. Elige **glTF Binario (.glb)** y vuelve a importar el archivo en una escena nueva antes de enviarlo. Si el modelo se abre pero sale liso o blanco, revisa primero la conexión del **Color base**.

![Altavoz con el acabado visible en una mitad y la malla en la otra](/blog/illustrations/blender-export-glb/hero.webp "Ilustración editorial hecha en Blender.")

## ¿Cómo se preparan los materiales?

Abre el espacio de trabajo **Sombreado**, selecciona el objeto y comprueba en el editor de **Nodos de sombreado** que el nodo **BSDF Principista** llega a la salida del material. Repite la comprobación en cada material que forme parte de la entrega. [Manual del exportador glTF de Blender](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html).

| Mapa                   | Dónde se conecta                                                    | Qué revisar                                                |
| ---------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| Color base             | Textura de imagen a **Color base**                                  | La imagen de color es la correcta y tiene coordenadas UV   |
| Normales               | Textura de imagen a través de **Mapa de normales** hasta **Normal** | La imagen usa **Datos** y el mapa está en espacio tangente |
| Metalizado y rugosidad | Canal azul y canal verde de un mapa combinado, respectivamente      | Los datos usan **Datos** y cada canal llega a su entrada   |

Si el acabado depende de ruido procedural o de nodos que el exportador no interpreta, hornea el resultado en mapas de imagen y conéctalos a las entradas compatibles. Haz una primera prueba con un material antes de rehacer todos los del modelo. [Horneado de texturas en Blender](https://docs.blender.org/manual/en/5.2/render/cycles/baking.html).

## ¿Cómo se exporta y se comprueba el archivo?

1. **Selecciona las piezas que quieres entregar.** Incluye todas las mallas necesarias y comprueba los detalles principales con la previsualización de materiales. Conserva el archivo `.blend` editable.
2. **Elige el formato binario.** En **Archivo → Exportar → glTF 2.0**, selecciona **glTF Binario (.glb)**. Activa **Objetos seleccionados** si has seleccionado todo lo que debe incluirse y deja activada la exportación de materiales.
3. **Abre el GLB por separado.** Mueve solo el archivo exportado a una carpeta vacía. En una escena nueva, usa **Archivo → Importar → glTF 2.0** y comprueba los dos lados, las costuras, los logotipos y las partes transparentes en la previsualización de materiales.
4. **Pruébalo en su destino.** Pasa el archivo por el [validador glTF de Khronos](https://github.khronos.org/glTF-Validator/) y ábrelo en el visor donde se verá. El validador comprueba la estructura. Para revisar el aspecto, mira cómo responden los materiales a la luz del visor.

La [especificación de GLB](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#glb-file-format-specification) explica cómo se empaquetan los recursos. Para comprobarlo en una tienda, empieza por un solo producto en borrador. [Añadir modelos 3D a Shopify](/es/guias/modelos-3d-shopify).

## ¿Por qué se abre el modelo pero no se ve la textura de color?

En Blender 5.2.3 LTS exportamos dos veces una silla de EasyRender. En la segunda exportación desconectamos solo la imagen del color base en una copia del material.

Los dos archivos se abrieron por separado con 24.268 polígonos. El segundo seguía incluyendo una imagen, pero el material había perdido la referencia a la textura de color base.

![Dos renders en Blender de la misma silla, con la textura de color original a la izquierda y la copia de prueba a la derecha](/blog/figures/blender-export-glb/base-color-test.webp "Dos GLB reimportados en Blender con la misma cámara y luz. A la izquierda está la textura de color conectada. A la derecha, la copia de prueba con la imagen del Color base desconectada antes de exportar.")

| Archivo reabierto en su propia carpeta     | Imágenes integradas | Textura de color base conectada |
| ------------------------------------------ | ------------------- | ------------------------------- |
| Material original                          | 2                   | Sí                              |
| Copia con la entrada de color desconectada | 1                   | No                              |

**Contar las imágenes integradas no basta.** Revisa el material del archivo reabierto y comprueba que los detalles que esperas ver siguen ahí. Si necesitas leer las referencias del material por código, consulta la [especificación de materiales glTF](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#metallic-roughness-material).

## ¿Qué ajustes reviso si el archivo ha cambiado de aspecto?

| Síntoma                               | Qué revisar                                                 | Qué cambiar                                                                                                                                                                                     |
| ------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Una pieza sale blanca o lisa          | La imagen de color o el material asignado                   | Vuelve a conectar el Color base y revisa el material de la malla                                                                                                                                |
| El relieve parece invertido           | Convención del mapa normal o conexiones                     | Comprueba el espacio tangente. Si el mapa usa la convención DirectX, invierte el canal verde (Y) para pasarlo a la convención OpenGL                                                            |
| El material brilla demasiado          | Canales de rugosidad y metalizado o espacio de color        | Comprueba verde para rugosidad, azul para metalizado y el espacio de color Datos                                                                                                                |
| El logo se desplaza o se repite       | Mapa UV elegido y transformación del nodo Mapeo             | Comprueba las coordenadas UV y prueba la transformación en el visor de destino                                                                                                                  |
| Falta una pieza                       | Selección de mallas al exportar                             | Añade la malla a la selección y vuelve a exportar                                                                                                                                               |
| El recorte de una etiqueta sale opaco | Conexión alfa y compatibilidad del visor con transparencias | Para un recorte nítido, pasa el alfa de la imagen por el nodo **Operar** con la operación **Redondear** y conecta la salida al Alfa del shader. Comprueba que el modo alfa exportado sea `MASK` |

Cambia un ajuste por prueba. Si el fallo se repite en varios archivos, elige el modelo más sencillo en el que ocurra. [Mapas de normales en Blender](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html#normal-map). [Modos alfa de Blender](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html#alpha-modes). [Diferencias entre GLB y glTF](/es/guias/glb-vs-gltf). [Cómo hacer un modelo 3D](/es/guias/como-hacer-un-modelo-3d).

## Preguntas frecuentes

### ¿El GLB incluye todas las texturas de mi escena de Blender?

La exportación binaria integra las imágenes a las que hacen referencia los materiales exportados. Blender puede omitir un mapa si no interpreta los nodos o si el mapa no llega a una entrada compatible. Abre el GLB y comprueba que en los materiales siguen viéndose los detalles que necesita tu visor.

### ¿Conviene activar la compresión antes de comprobar el primer archivo?

Empieza con una exportación que admita el visor de destino y revisa geometría y materiales. Prueba la compresión en una segunda copia y comprueba la compatibilidad del visor con la extensión que utiliza. Compara el peso y el aspecto de los dos archivos desde el dispositivo que usará el cliente.

### ¿Puedo conservar el GLB como archivo de trabajo?

Guarda el archivo `.blend` y las texturas originales para poder hacer cambios. El GLB es el archivo de entrega y guarda los materiales en la representación de glTF. Conserva los ajustes de exportación junto con el original y repite la comprobación cuando cambies la malla o sus materiales.
