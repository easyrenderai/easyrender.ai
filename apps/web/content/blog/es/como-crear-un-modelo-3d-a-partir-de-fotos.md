---

group: how-to-make-a-3d-model-from-photos
title: Cómo generar un modelo 3D a partir de fotos
description: Qué foto usar, cómo revisar los lados que la cámara no vio, qué archivos obtienes y qué no puede hacer un modelo hecho a partir de una sola foto.
date: 2026-11-15
keyword: generar modelo 3d a partir de fotos
author: Jorge Rodríguez
authorType: person
cta: Elige una foto nítida de tu catálogo, una silla o un aparador de tres cuartos, y revísala desde todos los ángulos antes de gastar un crédito.
---

Para generar un modelo 3D a partir de fotos te basta una foto nítida, con luz uniforme, de un solo objeto, y una herramienta de imagen a 3D que deduzca los lados que la cámara no vio.

La otra vía es la fotogrametría, que necesita al menos 20 fotos solapadas hechas alrededor de la pieza. En los dos casos, la foto decide casi todo el resultado.

<!-- IMAGE PENDING: reutilizar la ilustración EN de la regadera (mitad metal galvanizado, mitad malla de arcilla y alambre). Pie: «Ilustración, no es un resultado de easyrender: una regadera, mitad metal galvanizado y mitad malla 3D». -->

## ¿Una foto o muchas?

El número de fotos depende de una sola pregunta: ¿tienes el objeto delante? La fotogrametría y el escaneo LiDAR lo necesitan ahí. La imagen a 3D solo necesita una imagen, y por eso es la vía para la foto que te pasa el proveedor de un aparador que nunca has tocado.

La fotogrametría une fotos solapadas en un modelo. [Polycam](https://learn.poly.cam/hc/en-us/articles/27425185907348-How-to-Use-Object-Mode) pide al menos 20, con un 70 % de solape, y 100 o más si la pieza tiene mucho detalle. [RealityScan](https://dev.epicgames.com/documentation/realityscan-mobile/realityscan-step-by-step-guide) empieza a procesar a partir de 20 imágenes, admite hasta 300 y pide círculos y arcos a varias alturas.

El LiDAR de un iPhone Pro o un iPad Pro mide la profundidad mientras rodeas la pieza. Va rápido con formas grandes y lisas, y pierde los detalles finos, como los barrotes torneados de una silla.

<!-- IMAGE PENDING: diagrama EN «Photogrammetry vs Image-to-3D» traducido. Alt: «La fotogrametría mide lo que vio la cámara; la imagen a 3D parte de una foto y deduce los lados que no se ven». -->

Así elegiríamos nosotros, caso por caso:

- Solo tienes la foto del proveedor y la pieza está en un almacén en otro país: imagen a 3D, porque puedes partir de la imagen disponible.
- La pieza está en tu almacén, tiene una superficie con textura, como roble o lino, y tienes una hora libre: fotogrametría. Registra la superficie real en lugar de deducirla.
- Es una pieza grande y lisa, como un sofá de tres plazas, y tienes un iPhone Pro a mano: LiDAR. Es rápido, y aquí la forma importa más que el tejido.
- Es de cristal, espejo o cromo pulido: ninguna funciona bien, porque todas confunden los reflejos con la superficie.

Las ventajas e inconvenientes de cada vía están en [software de fotogrametría o IA con una foto](/es/comparativas/software-de-fotogrametria).

## ¿Cómo funciona la imagen a 3D?

Las herramientas siguen uno de dos caminos. Unas pasan directamente de la foto al modelo. Otras dibujan primero el objeto desde varios ángulos y luego construyen el modelo a partir de esas vistas, lo que les da más información sobre los lados ocultos.

easyrender sigue el segundo camino y combina varios modelos de IA: uno dibuja las vistas y otro construye la malla. Lo elegimos tras una prueba A/B con fichas reales. Aquella prueba usó un modelo de imagen más grande para la hoja de ángulos; hoy la dibuja uno más barato que aún no hemos probado de la misma forma.

La primera fase es la hoja de ángulos: una imagen cuadrada dividida en una cuadrícula de 3 × 3. Ocho casillas rodean el objeto en pasos de 45 grados, y la novena lo mira desde arriba. Todas van sobre blanco, con luz suave y el objeto entero centrado.

La segunda fase lee tu foto y esas nueve vistas y construye una malla con textura, es decir, la superficie 3D del objeto con su imagen de color encima.

<!-- IMAGE PENDING: diagrama EN de las 5 fases (foto, hoja de ángulos, revisión, modelo, GLB y USDZ) traducido. Pie: «En easyrender la hoja de ángulos es una previsualización gratis; los créditos solo se gastan en el paso 4, si decides generar el modelo». -->

La deducción acierta con la forma general y el color, y falla en lo que una foto no puede enseñar, como lo que hay detrás de un tejido calado. También tira de simetría. Nuestras instrucciones por defecto le piden deducir el lado oculto con prudencia, a partir de la construcción visible, y no inventar nunca logos, textos ni adornos.

En muebles añadimos reglas propias, sacadas de nuestras pruebas: mantener el número exacto de patas, brazos, cojines y cajones, y respetar la dirección de la veta y de las costuras. Las demás vías para hacer un modelo están en [cómo hacer un modelo 3D](/es/guias/como-hacer-un-modelo-3d).

## Paso 1: elige la foto adecuada

La mejor foto muestra el objeto entero, nítido, con luz suave y uniforme, sobre un fondo liso. Nada debe taparlo: ni un cojín sobre el brazo ni una planta delante de una pata.

En muebles, el ángulo de tres cuartos funciona mejor que una vista frontal. De frente, la foto de una butaca esconde lo hondo que es el asiento. De tres cuartos se ven el frente y un lateral a la vez, así que la herramienta tiene menos que deducir.

<!-- IMAGE PENDING: foto de entrada EN (butaca entera, tres cuartos, fondo liso). Alt: «Una buena foto de partida: la butaca entera, de tres cuartos y con fondo liso». -->

El archivo tiene que ser JPEG, PNG o WebP y pesar menos de 4 MB.

También hay un mínimo de resolución: rechazamos las fotos cuyo lado más corto baje de 400 píxeles y avisamos por debajo de 800. También rechazamos las que son más de cuatro veces más anchas que altas, y las de tono tan plano que probablemente están en blanco.

Por encima de ese mínimo, la nitidez importa más que los píxeles, así que pasamos un control de desenfoque a cada foto. Haz tú la misma prueba a ojo: amplía al 100 % el borde de una pata. Si ahí no ves la veta o el trenzado, el modelo tampoco lo tendrá.

Antes de subirla, repasa esta lista:

- La pieza entra entera en el encuadre, con margen por todos los lados y sin cortar las patas.
- La cámara estaba más o menos a media altura de la pieza, no mirando hacia abajo desde la altura de quien está de pie.
- Los bordes se ven nítidos al 100 %, no solo en la pantalla del móvil.
- La luz es uniforme, sin una sombra dura que cruce el objeto.
- El fondo es liso: una pared, un fondo de papel o un suelo limpio.
- Hay un solo objeto en la foto, no un salón decorado.

## Paso 2: quita lo que no es el objeto

Un fondo recargado es la forma más fácil de que el modelo salga mal. La herramienta puede leer el dibujo de una alfombra como parte de la base de una mesa, o fundir una lámpara de pie con la cortina que tiene detrás.

Si tu única foto es de ambiente, recórtala ajustada a la pieza, con un poco de margen por cada lado. Un aparador largo puede quedar panorámico, hasta cuatro veces más ancho que alto. A partir de ahí, nuestro control te pedirá una foto que muestre el producto entero.

Los recortes ayudan, con una pega. Un quitafondos puede dejar un halo claro en los bordes, y la herramienta puede tomarlo por parte del objeto. Revisa el borde al 100 % antes de subir la foto.

Las sombras también cuentan como fondo. Una sombra dura bajo una mesa de centro puede convertirse en una losa oscura pegada a las patas, así que merece la pena esperar a un día nublado.

## Paso 3: revisa la previsualización desde todos los ángulos

Las buenas herramientas de imagen a 3D enseñan el objeto desde varios lados antes de construir el modelo final. Mira con atención la parte de atrás y los laterales, porque es justo lo que la foto no enseñaba.

Lee la hoja como una hoja de contactos. Cuenta patas, puertas y cajones en todas las casillas, no solo en la frontal. Luego compara casillas opuestas, como la delantera derecha con la trasera izquierda: si los brazos de una silla cambian de forma entre una y otra, el modelo saldrá torcido.

La vista cenital revela lo que las demás no muestran. Una pantalla redonda que se vuelve ovalada desde arriba, o un tablero más ancho por un extremo, se ven ahí primero.

<!-- IMAGE PENDING: hoja de ángulos real EN sin retocar. Pie: «La hoja de ángulos gratis que easyrender dibujó a partir de esa foto, sin retocar. La parte de atrás y la vista cenital son deducciones». -->

Algunos fallos se descartan antes de que los veas. Nuestros controles rechazan una hoja de menos de 768 píxeles, una en la que el objeto falta en más de dos casillas y una en la que más de tres de las ocho vistas en círculo son casi copias.

Ese último control salió de las pruebas. En copias pequeñas en escala de grises, dos vistas realmente distintas de un objeto difieren un 3 % o más, y una vista repetida, menos de un 1 %. Una hoja que pega la foto en todas las casillas no le da al modelo nada que reconstruir.

La comprobación del número de piezas requiere una revisión humana. Cuenta puertas, cajones y patas en cada casilla frente a la pieza real antes de generar el modelo. Si la previsualización está mal, cambia la foto o añádele una nota en lugar de repetir con lo mismo.

easyrender acepta una nota corta con cada foto para lo que la foto esconde: «cuatro puertas», «trasera abierta», «tiradores de latón». La previsualización es gratis, dos al día sin créditos, y solo gastas créditos si generas el modelo. Lleva una marca de agua «easyrender.ai preview» que la hoja de arriba no lleva. [Sube una foto](/es)

## Paso 4: genera el modelo y descarga los archivos

Cuando la forma te convenza, la herramienta construye un modelo 3D con textura. Casi todas exportan GLB, el formato habitual para la web y Android. Muchas también te dan USDZ, el que iPhone y iPad abren en AR Quick Look.

Nuestra generación pide una textura de 2048 píxeles y devuelve una sola malla con un solo material, coloreado con una imagen de color base. Es el caso más sencillo para cualquier visor, y queda muy por debajo de los 10 materiales que Scene Viewer recomienda como máximo.

Los seis modelos de nuestro escaparate van de 14.590 triángulos en un jarrón de barro a 69.910 en una mesita de noche con cajones. Los seis quedan por debajo de los 100.000 triángulos que [Scene Viewer de Google](https://developers.google.com/ar/develop/scene-viewer) recomienda como máximo.

<!-- IMAGE PENDING: visor 3D con el GLB EN de la butaca (25.879 triángulos, 608 KB). Pie: «El modelo que easyrender generó a partir de esa foto y su hoja de ángulos. Gíralo para revisar la parte de atrás y mira el tejido con luz neutra antes de publicarlo». -->

Un GLB se abre en Blender (Archivo, Importar, glTF 2.0) y en visores gratuitos del navegador, como el [Babylon.js Sandbox](https://sandbox.babylonjs.com/). En Blender, activa Estadísticas en las superposiciones del visor para ver los triángulos. Ábrelo una vez antes de usarlo en ningún sitio y gíralo despacio.

easyrender te da los dos archivos con cada modelo terminado. El USDZ se convierte a partir del GLB en tu navegador al descargarlo, así que los dos siempre coinciden. La realidad aumentada llegará pronto, y los visores de RA colocan el modelo con el tamaño guardado en el archivo, así que deja las medidas reales en el anuncio.

Qué hay dentro de cada archivo lo explican [qué es un archivo GLB](/es/guias/archivo-glb) y [qué es un archivo USDZ](/es/guias/archivo-usdz).

## ¿Qué suele fallar y cómo se arregla?

Casi todos los modelos malos vienen de la foto. Esta es la lista que repasamos, del síntoma al arreglo.

| Síntoma                                             | Causa                                                                                                                                                                 | Arreglo                                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| La foto se rechaza por pequeña                      | El lado más corto baja de 400 píxeles; suele ser una miniatura o una captura                                                                                          | Usa el archivo original de la cámara o del proveedor, si pesa menos de 4 MB                          |
| La foto se rechaza por estrecha                     | Es más de cuatro veces más ancha que alta, como un recorte de banner                                                                                                  | Recorta al objeto, con margen por cada lado                                                          |
| Dos patas de la silla se funden en una              | De frente, las patas traseras quedan detrás de las delanteras                                                                                                         | Usa una foto de tres cuartos en la que se vean las cuatro patas separadas                            |
| Cuatro puertas salen como tres                      | Las juntas entre puertas tienen poco contraste                                                                                                                        | Dispara con luz rasante sobre el frente, o escribe «cuatro puertas» en la nota                       |
| La parte de atrás es igual que el frente            | La foto solo enseñaba el frente y la trasera lo copia                                                                                                                 | Escribe «trasera abierta» o «trasera lisa» en la nota, o usa una foto que enseñe una esquina trasera |
| El ratán o la rejilla se vuelven un estampado       | Una foto no ve a través de los huecos                                                                                                                                 | Acéptalo para un visor pequeño, o escanea la pieza con fotogrametría                                 |
| El tejido sale más amarillo u oscuro que en la foto | La luz del visor no es la de la foto, o el material no define Metálico y se aplica el valor por defecto de glTF, totalmente metálico                                  | Revísalo con luz neutra y pon Metálico a 0 en Blender antes de publicar                              |
| Las superficies se ven facetadas con luz lateral    | El archivo no trae normales de vértice y el visor calcula unas planas, como exige la [especificación glTF](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) | En Blender, usa Sombreado suave y vuelve a exportar                                                  |

## ¿Cómo sabes que el modelo está listo para publicar?

Fija el listón antes de mirar, o todos los modelos te parecerán bien. Estas son nuestras comprobaciones, y cada una se responde con un sí o un no:

1. Las cantidades coinciden con el producto: patas, puertas, cajones, tiradores.
2. La parte de atrás y la de abajo se parecen a la pieza real para alguien que la tenga en casa.
3. La textura aguanta a pantalla completa, no solo en miniatura.
4. El archivo se abre en un visor del navegador, en un iPhone y en un móvil Android.
5. El archivo cumple los límites de la plataforma. [Shopify](https://help.shopify.com/es/manual/products/product-media/product-media-types) admite modelos 3D de hasta 500 MB, y Scene Viewer recomienda 10 MB y 100.000 triángulos.

Si falla la 1 o la 2, vuelve al paso 1 con otra foto o con una nota. Si solo falla la 5, basta con comprimirlo, y la guía del GLB explica cómo.

## Qué no puede hacer un modelo hecho con una sola foto

No permite comprobar las dimensiones del objeto. Si el comprador necesita las medidas, escríbelas en el anuncio.

Los detalles finos pierden definición. Un logo pequeño en el respaldo, unos tiradores finos de latón o un texto impreso en una caja rara vez sobreviven. El ratán calado suele quedar como un estampado sobre una superficie maciza, porque una foto no enseña lo que hay detrás de cada hueco.

El cristal, los espejos y el cromo pulido confunden a todos los métodos, fotogrametría incluida, porque la superficie refleja lo que tiene alrededor. Y estas herramientas modelan un objeto cada vez, no una habitación amueblada.

## Preguntas frecuentes

### ¿Cuántas fotos hacen falta para un modelo 3D?

Una, para la imagen a 3D con IA, que deduce los lados que no ve. La fotogrametría mide cada lado, así que necesita al menos 20 fotos solapadas, y a menudo 100 o más en una pieza con detalle. Más fotos dan superficies más fieles, pero solo si tienes el objeto delante y sitio para rodearlo.

### ¿Qué resolución debe tener la foto?

Al menos 800 píxeles en el lado más corto, y más si los tienes. easyrender rechaza las fotos de menos de 400, avisa por debajo de 800 y revisa el desenfoque. A partir de ahí manda la nitidez: amplía un borde al 100 % y, si no se ve la veta o el trenzado, el modelo tampoco lo enseñará.

### ¿La imagen a 3D es lo mismo que la fotogrametría?

No. La fotogrametría mide el objeto a partir de muchas fotos reales, así que cada superficie que enseña la vio la cámara. La imagen a 3D parte de una foto y deduce lo que no se ve. La primera pide tener la pieza delante; la segunda funciona con la foto de catálogo de algo que nunca has tocado.

### ¿Es gratis convertir una foto en un modelo 3D?

Conviene distinguir la previsualización del archivo final. La mayoría de las herramientas tiene un plan gratuito o una previsualización gratis y luego cobra por modelo o por suscripción. En easyrender la previsualización es gratis, dos al día sin créditos, y un modelo terminado cuesta {{renderCredits}} créditos ({{renderPrice}}), a {{creditPrice}} el crédito.

### ¿Se puede imprimir en 3D un modelo hecho a partir de una foto?

Tómalo como un modelo para pantallas, no para imprimir. La foto no enseñaba todos los lados y el modelo no trae un tamaño medido, así que la pieza impresa no coincidiría con la real. easyrender exporta GLB y USDZ para la web y la RA, no archivos de impresión. Para ese uso necesitas un modelo preparado específicamente para impresión.
