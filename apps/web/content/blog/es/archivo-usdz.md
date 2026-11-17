---

group: usdz-file
title: "Qué es un archivo USDZ: AR Quick Look"
description: Un archivo USDZ es el formato 3D que iPhone y iPad abren en RA. Qué contiene, cómo abrirlo y crearlo, y por qué a veces sale más grande o más pequeño.
date: 2026-11-15
keyword: archivo usdz
author: Jorge Rodríguez
authorType: person
cta: Elige una foto nítida de una sola pieza, una mesita de roble o una lámpara de pie, y revisa todos los ángulos antes de gastar un crédito.
---

Un archivo USDZ es un modelo 3D en el formato Universal Scene Description de Pixar, dentro de un zip sin comprimir. Apple lo usa para AR Quick Look: un iPhone o un iPad puede abrirlo desde Safari, Archivos, Mail o Mensajes y colocarlo en la habitación a través de la cámara. Android no abre USDZ de forma nativa.

<!-- IMAGE PENDING: creativo original obligatorio (tono §5c). Propuesta: captura real de AR Quick Look en un iPhone con un USDZ de easyrender (vista Objeto y vista RA), sin cotas ni medidas superpuestas. Si aún no hay RA en producto, usar un esquema del contenido del USDZ (escena USD + texturas en un zip sin comprimir). -->

> **Elige el formato según el dispositivo.** Usa USDZ para Quick Look de Apple y conserva una versión GLB para la web y Android. Prueba el archivo exportado en el teléfono de destino.

## ¿Qué hay dentro de un archivo USDZ?

USD es el formato de escena que Pixar creó para la producción de cine. Un USDZ envuelve una escena USD y sus imágenes de textura en un solo archivo, guardado sin compresión para que el dispositivo pueda leerlo directamente, sin extraerlo.

Apple introdujo USDZ con iOS 12, en 2018, junto con AR Quick Look. Desde entonces es el formato que esperan los dispositivos de Apple para la realidad aumentada desde una página web o un mensaje.

## ¿Cómo se abre un archivo USDZ?

Depende del dispositivo:

- iPhone y iPad: pulsa el archivo en Safari, Archivos, Mail o Mensajes. Quick Look lo abre con una vista de objeto y una vista de realidad aumentada.
- Mac: selecciónalo en el Finder y pulsa la barra espaciadora para una vista previa de Quick Look, o ábrelo en Vista Previa.
- Windows y Android: no hay un visor de serie. Las versiones recientes de Blender pueden importar archivos USD, USDZ incluido.

Si necesitas el mismo modelo en Android o en un navegador, usa su versión GLB. [Qué es un archivo GLB](/es/guias/archivo-glb) cubre esa parte.

| Dónde se verá el modelo          | Formato de partida                | Prueba antes de publicar                     |
| -------------------------------- | --------------------------------- | -------------------------------------------- |
| **iPhone o iPad con Quick Look** | USDZ                              | Apertura, materiales, orientación y escala   |
| **Web y Android**                | GLB                               | Visor compatible, texturas y tiempo de carga |
| **Edición en un programa 3D**    | El formato que admita el programa | Importación y conservación de los materiales |

## ¿Cómo funciona AR Quick Look en una página web?

La página enlaza el USDZ con `rel="ar"` alrededor de una imagen de previsualización, y Safari añade a esa imagen una pequeña insignia de RA. Al pulsarla, el modelo se abre en la habitación, sin instalar ninguna aplicación.

El componente de código abierto model-viewer de Google resuelve los dos sistemas con un solo fragmento de código: muestra un GLB en la página y entrega a los iPhone el USDZ para Quick Look.

AR Quick Look coloca el modelo con el tamaño guardado en el archivo. Si ese tamaño no se midió nunca, el objeto puede verse más grande o más pequeño que el real, y el comprador puede hacer el gesto de pellizco para cambiarle el tamaño.

## ¿Cómo se crea un archivo USDZ?

Reality Converter de Apple, una aplicación gratis para Mac, convierte archivos glTF, OBJ y FBX a USDZ y te deja revisar los materiales antes de exportar. Blender exporta USD, y las versiones recientes escriben USDZ de forma directa.

Si partes de una foto, algunas herramientas de imagen a 3D exportan el USDZ junto al GLB, y te ahorras la conversión. Los pasos están en [cómo generar un modelo 3D a partir de fotos](/es/guias/como-crear-un-modelo-3d-a-partir-de-fotos).

easyrender te entrega los dos archivos en cada modelo terminado. La realidad aumentada llegará pronto: podrás abrir la pieza en el móvil y verla en tu casa. El modelo muestra la forma y los materiales; las dimensiones de la pieza deben consultarse por separado.

## Un ejemplo práctico: una mesita de roble en un iPhone

Envíate por Mensajes el USDZ de una mesita de roble y púlsalo. Quick Look abre primero la vista de objeto, donde puedes girarla con un dedo. Pasa a realidad aumentada, apunta la cámara al suelo y la mesa aparece en el punto que pulses.

Da la vuelta a su alrededor y mira dónde se apoyan las patas en el suelo. Un modelo cuya base queda un poco despegada parecerá flotar. Luego comprueba la veta bajo tu propia lámpara, que es más cálida que la luz de estudio de la foto original.

## ¿GLB o USDZ?

Conviene tener los dos si el modelo va a una ficha de producto. El GLB cubre la web y Android, y el USDZ cubre la realidad aumentada en dispositivos de Apple. La [guía para hacer un modelo 3D](/es/guias/como-hacer-un-modelo-3d) explica de dónde salen ambos archivos, sea cual sea el método.

## Preguntas frecuentes

### ¿Se puede abrir un archivo USDZ en Android?

No de forma nativa, porque la realidad aumentada de Android usa Scene Viewer de Google, que lee archivos GLB y no USDZ. Para mostrar el mismo modelo en Android, usa una versión GLB. Si solo tienes el archivo de Apple, Blender puede importar el USDZ y exportar un GLB, aunque conviene revisar los materiales después.

### ¿Se puede convertir un USDZ a GLB?

Sí. Importa el USDZ en una versión reciente de Blender y expórtalo como glTF 2.0 en formato GLB. Revisa el resultado en un visor, porque USD y glTF describen las superficies de forma distinta y algunos ajustes de material, como una capa transparente sobre una madera lacada, pueden no pasar exactamente igual.

### ¿Por qué un modelo USDZ se ve del tamaño equivocado en realidad aumentada?

AR Quick Look usa el tamaño guardado en el archivo. Si el modelo no se hizo con medidas, como ocurre con los generados a partir de una foto o con un escaneo sin referencia, puede verse más grande o más pequeño que la pieza. Sirve para ver su aspecto. Consulta las dimensiones de la pieza por separado.

### ¿USDZ y USD son lo mismo?

USDZ es un paquete de USD. Una escena USD puede ser un archivo de texto (.usda), un archivo binario (.usdc) o varios archivos que se referencian entre sí. USDZ agrupa en un zip, sin compresión, una escena y sus texturas en un solo archivo, y por eso es fácil de enviar y de abrir en un iPhone.
