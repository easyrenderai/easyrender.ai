---

group: how-to-make-a-3d-model
title: "Cómo hacer un modelo 3D: cinco métodos"
description: Cinco formas de hacer un modelo 3D, de Blender a una sola foto. Qué necesita cada una, cuánto cuesta aprenderla, dónde falla y cómo elegir.
date: 2026-11-15
keyword: como hacer un modelo 3d
author: Jorge Rodríguez
authorType: person
cta: Si tienes una foto nítida de una silla, una lámpara o un aparador, puedes verla desde todos los ángulos antes de decidir si merece la pena generar un modelo.
---

Puedes hacer un modelo 3D de cinco maneras: construirlo en un programa como Blender, escanearlo con fotogrametría o con el LiDAR del móvil, generarlo con IA a partir de una foto, o encargárselo a un artista 3D. Cuál encaja depende de si el objeto existe, de si lo tienes a mano y del tiempo del que dispones.

<!-- IMAGE PENDING: creativo original obligatorio (tono §5c). Propuesta: esquema de los cinco métodos (programa, fotogrametría, LiDAR, IA desde una foto, artista) con lo que pide cada uno. Si se usa una imagen generada, pie «Ilustración, no es un resultado de easyrender». -->

> **Empieza por lo que tienes.** Una foto permite generar con IA; un objeto que puedes rodear permite escanear. Si necesitas medidas y geometría exactas, utiliza modelado con referencias medidas.

## ¿Qué método te conviene?

Si el objeto aún no existe, modélalo en un programa o encárgaselo a un artista. Si existe y lo tienes delante, escanéalo. Si solo tienes una foto, usa imagen a 3D.

A grandes rasgos, cuanto más trabajo, más fidelidad. Un artista que trabaja a partir de medidas da el modelo más exacto. Un modelo generado a partir de una foto permite partir de esa imagen, pero su parte de atrás es una estimación.

| Lo que tienes                                    | Método a considerar          | Qué debes comprobar                              |
| ------------------------------------------------ | ---------------------------- | ------------------------------------------------ |
| **Una foto del proveedor**                       | Imagen a 3D                  | Trasera, base y piezas que la foto no muestra    |
| **El objeto y acceso a todos sus lados**         | Fotogrametría                | Cobertura y superficies brillantes o sin textura |
| **Una pieza grande y un dispositivo compatible** | LiDAR                        | Detalles finos y escala antes de usar el archivo |
| **Medidas y una forma que debe ser exacta**      | Modelado manual o un artista | Cotas, materiales y formato de entrega           |

## Método 1: modelarlo tú en un programa

Blender es gratis, de código abierto, y exporta GLB, FBX, OBJ y USD. SketchUp resulta más cómodo para muebles y edificios, porque dibujas líneas y empujas las caras hasta convertirlas en volúmenes. Tinkercad, que funciona en el navegador, es el punto de partida más sencillo para aprender las formas básicas.

Necesitarás práctica para que una silla modelada por ti se vea bien. Lo más difícil para quien empieza son las proporciones y las texturas. El mapeado UV, que despliega una superficie en plano para pintarle una imagen encima, es donde más gente se queda atascada.

Para una pieza sencilla, como una mesa auxiliar, el flujo queda así:

1. Reúne referencias: una foto de frente, una de perfil y las medidas reales.
2. Encaja los volúmenes principales con cajas y cilindros: tablero, patas, faldón.
3. Suaviza un poco los cantos, para que las esquinas capten la luz como la madera de verdad.
4. Añade materiales: una textura de madera en el tablero, un acabado metálico en los tiradores, si los hay.
5. Revísalo desde todos los lados, incluido por debajo, y expórtalo como GLB.

## Método 2: fotogrametría

La fotogrametría construye un modelo a partir de muchas fotos superpuestas. Das vueltas al objeto en dos o tres anillos a distinta altura, solapando cada toma con la anterior unos dos tercios, con luz suave y uniforme.

RealityScan y Polycam lo hacen en el móvil; Meshroom y la versión de escritorio de RealityScan (antes RealityCapture), en el ordenador. Captura bien el detalle real de la superficie. Se resiste a las superficies blancas lisas, al cristal y al metal pulido, porque necesita textura visible para encajar una foto con la siguiente.

Las diferencias entre programas, con precios y límites de fotos, están en [software de fotogrametría o IA con una foto](/es/comparativas/software-de-fotogrametria).

## Método 3: escaneo LiDAR con el móvil

Los iPhone Pro y los iPad Pro tienen un sensor LiDAR que mide la profundidad de forma directa. Aplicaciones como Polycam y Scaniverse lo usan para construir un modelo mientras das la vuelta al objeto.

El LiDAR es rápido y se defiende bien con formas grandes y sencillas, como un sofá. Registra menos detalle que la fotogrametría, así que las patas torneadas y los asientos de rejilla salen deformes.

## Método 4: generarlo con IA

Las herramientas de IA hacen un modelo a partir de una foto, lo que se llama imagen a 3D, o a partir de una descripción escrita, texto a 3D. La imagen a 3D conserva el aspecto de un producto real. El texto a 3D inventa uno, lo cual vale para un concepto y no para algo que vendes.

El método es el mismo en todas las herramientas: una foto nítida del objeto entero sobre un fondo liso, y una revisión de los lados ocultos antes de quedarte el resultado. Cada paso está en [cómo generar un modelo 3D a partir de fotos](/es/guias/como-crear-un-modelo-3d-a-partir-de-fotos).

easyrender es una de estas herramientas. Muestra una previsualización gratis de todos los ángulos, y un modelo terminado cuesta {{renderCredits}} créditos ({{renderPrice}}), según la [página de precios](/es/precios). Modela objetos sueltos, como muebles, decoración y fachadas, no habitaciones enteras, y los logos pequeños pierden definición.

[Sube una foto](/es)

Meshy y Tripo también convierten imágenes en modelos 3D y añaden texto a 3D, cada una con sus propios precios; las comparamos en [Meshy](/es/comparativas/meshy) y [Tripo](/es/comparativas/tripo). Prueba la misma foto en dos herramientas antes de elegir una para un catálogo.

## Método 5: encargárselo a un artista 3D

Un artista modela el objeto a partir de tus fotos y tus medidas. Es la elección correcta cuando el modelo tiene que ser exacto, por ejemplo un sofá que se vende en tres anchos, o cuando necesitas un modelo muy cuidado para una campaña.

Pásale un encargo bien detallado: fotos de todos los lados, cotas, primeros planos de cada material, y el formato y el peso máximo que admite la plataforma de destino. Para una ficha de producto, pide GLB y USDZ. En Fiverr y Upwork hay modeladores de producto, y conviene pedir una muestra antes de un catálogo entero.

## ¿Cómo se revisa un modelo terminado?

Sea cual sea el método, abre el modelo en un visor y mira por debajo y por detrás, que es donde se esconden los errores. Amplía las texturas a pantalla completa, porque un tejido que se ve bien en miniatura puede estar borroso de cerca.

Luego ábrelo en un móvil con datos, no con wifi, para ver si el archivo pesa demasiado.

Para las fichas de producto casi siempre hacen falta dos archivos: GLB para la web y Android, USDZ para la realidad aumentada en dispositivos de Apple. [Qué es un archivo GLB](/es/guias/archivo-glb) explica cómo abrirlo, revisarlo y comprimirlo.

## Un ejemplo práctico: una lámpara de pie, de tres maneras

Toma una lámpara de pie con pantalla de lino y pie de latón. En Blender, quien empieza puede encajar los volúmenes del pie y la pantalla. Hacer que el lino parezca lino lleva bastante más.

La fotogrametría se resiste al latón pulido, que refleja la habitación y confunde el encaje de las fotos. Quien se dedica al escaneo reduce el brillo de las partes relucientes con un spray mate temporal, algo que no harías con una pieza de almacén.

La imagen a 3D, a partir de una foto de catálogo limpia, acierta la forma general y el color de la pantalla. El pie fino es la parte a revisar, porque las piezas delgadas pueden salir torcidas o más gruesas de lo que son. Para esta lámpara, un modelo de IA o un artista son las vías realistas.

## ¿Cuáles son los límites de cada método?

Los modelos hechos a partir de una foto no traen un tamaño medido. Los escaneos omiten lo que la cámara no pudo ver, como la parte de abajo de un sofá que apoya plano en el suelo. Los que construyes tú piden tiempo de aprendizaje, y los de un artista, tiempo de encargo.

Aquí nos centramos en piezas sueltas. Los modelos de easyrender no cubren habitaciones amuebladas enteras. Para vender muebles y decoración, [modelos 3D para ecommerce](/es/guias/modelos-3d-para-ecommerce) compara las vías para un catálogo, y [cómo vender muebles vintage online](/es/guias/vender-muebles-vintage) cubre las piezas únicas.

## Preguntas frecuentes

### ¿Cuál es la forma más sencilla de hacer un modelo 3D?

Si tienes una foto del objeto, la imagen a 3D, porque no pide saber modelar. Si tienes el objeto mismo, una aplicación de escaneo en el móvil. Para algo que aún no existe, empieza con Tinkercad en el navegador o con SketchUp, y pasa a Blender cuando las formas básicas se te den bien.

### ¿Se puede hacer un modelo 3D sin pagar?

Sí: Blender y Meshroom son gratis y de código abierto, y algunas aplicaciones ofrecen una previsualización gratis antes de cobrar por las exportaciones. El software gratis cuesta tiempo: Blender requiere práctica para que un modelo de mueble se vea bien, así que cuenta también las horas.

### ¿Cuánto se tarda en hacer un modelo 3D?

Varía más por el método que por el objeto: la imagen a 3D y los escaneos con el móvil te quitan menos tiempo, y la fotogrametría exige una sesión de fotos y el procesado posterior. Modelar una silla en Blender requiere tiempo de trabajo y aprendizaje. Los artistas fijan sus propios plazos.

### ¿Hace falta saber modelar para hacer un modelo 3D?

No: el escaneo y la imagen a 3D producen un modelo sin que tengas que modelarlo a mano. Sigue haciendo falta buen ojo, porque revisar la parte de atrás, las texturas y las piezas finas es lo que separa un modelo aprovechable de uno raro. Aprender Blender compensa si a menudo necesitas modelos exactos y editables.

### ¿En qué formato debería estar un modelo 3D?

GLB para la web, Android y la mayoría de las herramientas 3D, y USDZ para la realidad aumentada en iPhone y iPad. Para las fichas de producto, quédate con los dos. Si una plataforma u otro programa pide otra cosa, convierte el GLB en Blender en lugar de volver a hacer el modelo.
