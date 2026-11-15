---

group: compare-photogrammetry-software
title: Software de fotogrametría o IA con una foto
description: Fotogrametría frente a IA con una foto: RealityScan, Metashape, Meshroom, Polycam y Zephyr, cuántas fotos piden, precios y cuándo encaja cada uno.
date: 2026-11-15
keyword: software de fotogrametria
author: Jorge Rodríguez
authorType: person
cta: Si solo tienes una foto de catálogo de la pieza, mírala gratis desde todos los ángulos antes de decidir si hace falta escanearla.
---

El software de fotogrametría construye un modelo 3D a partir de muchas fotos solapadas de un objeto que tienes delante. RealityScan, Agisoft Metashape, Meshroom, Polycam y 3DF Zephyr son los habituales. Si solo tienes una foto, como la de catálogo de un proveedor, la fotogrametría no puede ni empezar, y la vía es una herramienta de imagen a 3D.

<!-- IMAGE PENDING: ilustración EN del busto de mármol con las pirámides de cámara alrededor. Pie: «Ilustración, no es un resultado de easyrender». -->

## ¿De verdad necesitas un programa de fotogrametría?

Hazte primero una pregunta: ¿puedes rodear el objeto? La fotogrametría solo mide lo que vio la cámara, así que necesita la pieza en tus manos, una tarde libre y un espacio despejado. La guía de RealityScan de Epic lo dice sin rodeos: lo que no se ve en varias imágenes no saldrá en el modelo.

Si la pieza está en el almacén de un proveedor, o tienes un catálogo entero de fotos de producto, quizá solo dispongas de una foto por producto. Para ese caso existe la IA a partir de una foto.

La vía paso a paso, desde elegir la foto hasta revisar los archivos, está en [cómo generar un modelo 3D a partir de fotos](/es/guias/como-crear-un-modelo-3d-a-partir-de-fotos).

## ¿Cómo funciona el software de fotogrametría?

El programa encuentra los mismos puntos en fotos solapadas, calcula dónde estaba cada cámara, construye una malla y la pinta con la textura obtenida de las fotos. Todos siguen las mismas reglas de captura, porque todos emparejan puntos entre imágenes:

1. Elige un objeto que no se mueva. La [guía de Object Capture de Apple](https://developer.apple.com/documentation/realitykit/capturing-photographs-for-realitykit-object-capture) desaconseja las piezas blandas o flexibles que cambian de forma al moverlas, y los objetos muy finos, reflectantes, transparentes o de un solo color liso.
2. Ilumina con luz suave. Apple señala como problemas el flash de la cámara, el sol directo y las bombillas desnudas; el manual de Meshroom dice que no se use flash. Un día nublado funciona.
3. Mantén los ajustes de cámara. Mantén fijos el zoom, la apertura, la velocidad y el ISO. En un iPhone, mantén pulsada la imagen hasta que aparezca «Bloqueo AE/AF».
4. Dispara con mucho solape. Apple pide un 70 % de solape o más entre tomas vecinas y avisa de que por debajo del 50 % puede fallar. El manual de Meshroom pide al menos un 60 % de solape lateral y un 80 % frontal.
5. Rodea el objeto a varias alturas. RealityScan pide círculos y arcos a distintas alturas, con el objeto ocupando al menos la mitad de cada imagen.
6. Fotografía la base. Apple sugiere una base giratoria y apoyar el objeto sobre distintas caras, para que el modelo no tenga huecos por debajo.
7. Enmascara el fondo y procesa. La aplicación móvil de RealityScan empieza a analizar a partir de 20 imágenes y se detiene en 300.

Toma una mesa auxiliar de teca: tres anillos de fotos con luz suave y luego otra serie de la parte de abajo, con la mesa tumbada. La veta le da al programa mucho que emparejar, y por eso la madera se escanea bien.

## ¿Qué programa de fotogrametría elegir?

Los programas se diferencian menos en el método que en dónde funcionan y en su licencia. Los precios son los publicados en noviembre de 2026.

| Programa               | Dónde funciona                                       | Precio y licencia                                                                                                 | Límites de fotos y notas                                                      |
| ---------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| RealityScan (Epic)     | Aplicación de escritorio y aplicación móvil gratuita | Gratis con menos de 1 millón de dólares de ingresos en los últimos 12 meses; 1.250 $ por puesto y año por encima  | La app móvil analiza a partir de 20 imágenes, con un límite de 300            |
| Agisoft Metashape      | Windows, macOS y Linux                               | Standard 179 $, Professional 3.499 $, licencia perpetua; prueba gratis de 30 días                                 | Standard incluye la generación y el texturizado del modelo                    |
| Meshroom (AliceVision) | Windows y Linux                                      | Código abierto, MPL-2.0                                                                                           | Acelerado por GPU; el manual pide un 60 % de solape lateral y un 80 % frontal |
| Polycam                | Aplicación para iPhone y Android                     | Gratis con 10 capturas de fotogrametría; Basic, 150 $ al año o 30 $ al mes                                        | 150 imágenes por captura en Free, 300 en Basic                                |
| 3DF Zephyr             | Escritorio                                           | Gratis hasta 50 fotos; Lite, 199 € + IVA, perpetua; versión completa, 250 € + IVA al mes o 4.200 € + IVA perpetua | Free exporta mallas con textura solo en JPG                                   |

Fuentes: [licencia de RealityScan](https://www.realityscan.com/en-US/license), [web de RealityScan](https://www.realityscan.com/en-US), [guía de RealityScan móvil](https://dev.epicgames.com/documentation/realityscan-mobile/realityscan-step-by-step-guide), [tienda](https://www.agisoft.com/buy/online-store/) e [instaladores](https://www.agisoft.com/downloads/installer/) de Metashape, [AliceVision](https://alicevision.org/) y el [manual de captura de Meshroom](https://meshroom-manual.readthedocs.io/en/latest/capturing/capturing.html), [precios de Polycam](https://poly.cam/pricing) y [3DF Zephyr](https://www.3dflow.net/3df-zephyr-photogrammetry-software/). Todas consultadas el 11 de noviembre de 2026.

Para elegir entre ellos: Meshroom no cuesta nada y le va bien a quien no le importe aprender un programa de escritorio por nodos, en un Windows o un Linux con GPU.

RealityScan es gratis para casi todas las tiendas pequeñas y cubre móvil y escritorio. Metashape tiene instaladores para Windows, macOS y Linux, y 30 días de prueba con tus propias piezas.

Polycam es una opción accesible para empezar si quieres escanear con el móvil, y sus planes de pago exportan glTF, OBJ, FBX, DAE y USDZ. Zephyr Free es una buena forma de probar con un objeto pequeño, siempre que te baste con 50 fotos.

## ¿En qué se diferencia la IA con una sola foto?

La imagen a 3D parte de una sola foto y deduce los lados que la cámara no vio. No empareja puntos entre fotos, así que no necesita solape, anillos ni base giratoria. Necesita una foto nítida, con luz uniforme, del objeto entero sobre un fondo liso.

easyrender trabaja así, en dos fases, y combina varios modelos de IA. Primero dibuja gratis una hoja de ángulos: nueve vistas del objeto, ocho a su alrededor en pasos de 45 grados y una desde arriba. Tú revisas esa hoja, y solo gastas créditos cuando te convence.

Después, la generación lee esas nueve vistas y crea un modelo con textura, que descargas en GLB y USDZ. Un modelo cuesta {{renderCredits}} créditos ({{renderPrice}}), y la [página de precios](/es/precios) recoge los paquetes. [Sube una foto](/es) para ver gratis la hoja de ángulos.

## ¿Qué quieres conseguir y cómo lo mides?

Fija el objetivo antes de elegir la herramienta. Cada uno lleva una comprobación que puedes hacer tú:

- Un registro fiel de una superficie, como un cuero gastado o la veta del roble. Amplía la textura a pantalla completa junto a la pieza real. La fotogrametría copia la superficie de las fotos, y aquí es donde compensa el tiempo de montaje.
- Un objeto completo, sin huecos. Gira el modelo y para en la base, en la parte trasera de las patas y en cualquier hueco profundo. Cada agujero es una parte que las fotos no cubrieron.
- Un modelo de cada producto de un catálogo. Cronometra una pieza desde el montaje hasta el archivo terminado y multiplícalo por el catálogo antes de decidir el método.
- Un modelo de un producto que no puedes tocar. La fotogrametría no puede empezar. Juzga el resultado de imagen a 3D contando patas, puertas y tiradores en cada vista.
- Un coste por modelo conocido. Con una licencia, divide el precio entre los modelos que harás en ese periodo. Con créditos, mira el precio por modelo en la página de precios.

## ¿Qué suele fallar en la fotogrametría y cómo se arregla?

Casi todos los escaneos fallidos vienen de la captura, no del programa. Esta es la lista con la que revisar un mal resultado, del síntoma al arreglo.

| Síntoma                                             | Causa                                                              | Arreglo                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Huecos en un tablero blanco liso                    | Un solo color liso no le da al programa nada que emparejar         | Dispara con luz rasante, o usa otro método para esa pieza                |
| El proceso falla o el modelo sale hecho un desastre | Menos del 50 % de solape entre tomas vecinas                       | Repite con un 70 % o más, con pasos más cortos entre fotos               |
| Falta la base o sale pegada al suelo                | La parte de abajo nunca se fotografió                              | Haz otra serie con la pieza tumbada, o usa una base giratoria            |
| Los tiradores cromados o un espejo salen deformes   | Los reflejos cambian de una foto a otra                            | Evita las piezas reflectantes, o acepta esas partes y modélalas aparte   |
| Zonas borrosas y textura desalineada                | El zoom, la exposición o el enfoque cambiaron a mitad de la sesión | Bloquea AE/AF, usa una sola distancia focal y descarta las fotos movidas |
| Manchas oscuras horneadas en la textura             | Sombras duras del flash o del sol directo                          | Difumina la luz, o dispara en un día nublado                             |
| Trozos de la habitación pegados al objeto           | Un fondo recargado en el encuadre                                  | Usa un fondo liso y enmascara el fondo en cada imagen                    |
| La versión gratuita deja de importar fotos          | 3DF Zephyr Free limita cada proyecto a 50 fotos                    | Quédate con las 50 mejores, o pasa a una versión sin límite              |

## Qué usaríamos, caso por caso

Así elegiríamos nosotros, incluyendo nuestro propio producto entre las opciones.

Una pieza de tu almacén con una superficie con textura, como un arcón de roble tallado, y una hora libre: fotogrametría. Registra la superficie tal como es, y probar RealityScan o Meshroom no cuesta nada.

La foto del proveedor de un aparador que nunca has visto en persona: IA con una foto. No hay nada que escanear, y puedes juzgar la hoja de ángulos gratis antes de gastar.

Un catálogo entero de fotos de producto y ningún estudio: IA con una foto, por lotes desde tu biblioteca o con un agente. Un escaneo por producto significa una sesión por producto.

Un jarrón de cristal o una lámpara de acero pulido: ningún método se lleva bien con las superficies que reflejan como un espejo. La documentación de fotogrametría dice que se eviten, así que para esa pieza cuenta con un artista 3D.

## Preguntas frecuentes

### ¿Cuál es el mejor software de fotogrametría gratis?

Meshroom es de código abierto (MPL-2.0) y funciona en Windows y Linux. RealityScan es gratis con menos de un millón de dólares de ingresos en los últimos 12 meses. El plan gratuito de Polycam incluye 10 capturas, y 3DF Zephyr Free admite hasta 50 fotos. Depende de tu ordenador y de si disparas con el móvil.

### ¿Cuántas fotos necesita la fotogrametría?

No hay una cifra mínima común a todos los programas: también importa el solape entre imágenes. Apple pide un 70 % entre tomas vecinas, y Meshroom, un 60 % lateral y un 80 % frontal. La app móvil de RealityScan analiza a partir de 20 imágenes y admite hasta 300. Los objetos con huecos necesitan más, porque cada hueco debe salir en varias fotos.

### ¿La fotogrametría es mejor que la imagen a 3D con IA?

Resuelven problemas distintos. La fotogrametría reconstruye el objeto a partir de muchas fotos reales, así que necesita tenerlo delante. La imagen a 3D trabaja con una foto de una pieza que quizá nunca toques. Si puedes escanearla y la superficie importa, escanéala. Si solo tienes una foto, la imagen a 3D es la única que puede empezar.

### ¿Se pueden escanear cristal, espejos o cromo con fotogrametría?

No de forma fiable. Apple pide evitar los objetos muy reflectantes, transparentes o translúcidos, y el manual de Meshroom, los reflejos y las transparencias. Apple sugiere pintar la superficie para darle textura, algo que no harías con género que vendes. Para esas piezas, lo más seguro es un artista 3D que trabaje con fotos.
