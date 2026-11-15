---

group: 3d-models-for-ecommerce
title: "Modelos 3D para ecommerce: cómo conseguirlos"
description: Qué aporta un modelo 3D de producto, qué archivos necesita una tienda (GLB y USDZ), cuatro formas de conseguirlo y los límites que conviene saber antes.
date: 2026-11-15
keyword: modelo 3d para ecommerce
author: Jorge Rodríguez
authorType: person
cta: Elige una pieza con profundidad, un sillón o un aparador, y revisa todos los ángulos antes de decidir si el 3D merece la pena en tu tienda.
---

Un modelo 3D para ecommerce es un archivo, normalmente GLB o USDZ, que el comprador gira en la pantalla y, en el móvil, puede ver en su casa con realidad aumentada.

Las tiendas los consiguen de cuatro maneras: con un artista 3D, a partir de los archivos CAD del fabricante, escaneando el producto o con IA a partir de una sola foto.

<!-- IMAGE PENDING: ilustración EN del mocasín y su caja (mitad cuero, mitad malla 3D). Pie: «Ilustración, no es un resultado de easyrender». -->

## ¿Qué aporta un modelo 3D a una ficha de producto?

Una foto enseña el encuadre que elegiste tú. Un modelo 3D deja elegir al comprador: la parte de atrás de una librería, la parte de abajo de una mesa de centro, la forma del cojín de una butaca.

<!-- IMAGE PENDING: par EN foto de catálogo (vista trasera) + visor con el modelo. Pies: «La foto de catálogo: una sola vista, desde atrás, elegida por el fotógrafo» / «El modelo que easyrender generó a partir de esa foto: el comprador elige la vista. El frente es una deducción, porque la foto solo enseña la parte de atrás». -->

En iPhone y iPad, un archivo USDZ se abre en [AR Quick Look](https://developer.apple.com/augmented-reality/quick-look/) y coloca el objeto en la habitación a través de la cámara. En Android, [Scene Viewer](https://developers.google.com/ar/develop/scene-viewer) de Google hace lo mismo con un GLB.

La realidad aumentada enseña cómo queda una pieza en una habitación. Su tamaño sale del archivo, no de una medición: Scene Viewer lee una unidad del archivo como un metro, y un modelo generado a partir de una foto se abre con el tamaño que diga su archivo. Por eso las medidas van en el texto de la ficha.

## ¿Cómo sabes si el 3D merece la pena?

Decide qué quieres que cambie antes de pagar por un modelo. En una tienda de muebles puedes fijarte en las preguntas sobre la parte de atrás y la profundidad, o comprobar el uso del visor en las fichas que tienen modelo. Los motivos de devolución también conviene leerlos.

No publicamos cifras de conversión ni de devoluciones con 3D, porque no hemos medido ninguna que podamos defender. Toma cualquier cifra que leas como una afirmación que debes probar en tu propio catálogo, con un método como este.

Elige entre cinco y diez productos que vayan a tener modelo y un grupo parecido que no. No toques precios, fotos ni textos en ninguno de los dos durante cuatro a seis semanas. Después compara los añadidos al carrito por visita de producto entre los dos grupos, y lee los motivos de devolución.

En tu propia web, [model-viewer](https://github.com/google/model-viewer/blob/master/packages/model-viewer/src/features/ar.ts) lanza eventos que puedes mandar a tu analítica. Un evento camera-change con origen user-interaction significa que el comprador giró el modelo. Un evento ar-status indica que una sesión de RA empieza o falla, y quick-look-button-tapped salta cuando un iPhone pasa a Quick Look.

## ¿Qué archivos necesita una tienda para el 3D?

GLB para la web y Android, y USDZ para la realidad aumentada en dispositivos de Apple. Casi todas las plataformas que admiten 3D aceptan uno de los dos o ambos.

<!-- IMAGE PENDING: diagrama EN «One product model» (GLB → ficha y RA en Android; USDZ → RA en iPhone y iPad) traducido. Pie: «Un modelo, dos archivos y tres sitios donde lo ve el comprador. Shopify acepta los dos archivos como contenido multimedia del producto». -->

### Modelos 3D en Shopify

[Shopify acepta modelos 3D como contenido multimedia del producto](https://help.shopify.com/es/manual/products/product-media/product-media-types), en GLB o USDZ y hasta 500 MB, en el mismo sitio donde subes las fotos. Si el archivo pasa de 15 MB, Shopify optimiza la geometría y las texturas al subirlo. Además convierte cada modelo para que exista una versión GLB y otra USDZ.

### WooCommerce y webs a medida

Las tiendas WooCommerce añaden el 3D con extensiones, como [Arty 3D Viewer](https://woocommerce.com/products/arty-3d-viewer/) del marketplace de WooCommerce. En una web que montas tú, el componente de código abierto [model-viewer](https://modelviewer.dev/) de Google muestra un GLB, y con ar-modes="webxr scene-viewer quick-look" cada móvil abre su propio visor de RA.

### ¿Cuánto debe pesar un modelo de producto?

Shopify admite archivos grandes, pero el móvil del comprador no los quiere. Scene Viewer publica el límite más claro que conocemos, así que comparamos nuestros archivos con él.

| Límite     | Lo que recomienda Scene Viewer                                 | Los seis modelos de nuestro escaparate |
| ---------- | -------------------------------------------------------------- | -------------------------------------- |
| Triángulos | Hasta 100.000, idealmente de 30.000 a 50.000                   | De 14.590 a 69.910                     |
| Textura    | Como máximo 2048 × 2048                                        | Una textura de 1024 × 1024 cada uno    |
| Materiales | Hasta 10                                                       | Uno cada uno                           |
| Peso       | 10 MB; los modelos más grandes pueden dar una mala experiencia | De 308.448 a 1.287.432 bytes           |

Scene Viewer también enumera las extensiones de glTF que admite. Un archivo que dependa de una que no esté en la lista, como las texturas WebP, puede no abrirse. Para la RA en Android, lo más seguro es un GLB con texturas PNG o JPEG. Ábrelo en un Android de verdad antes de enlazarlo desde una ficha.

## ¿Cómo se consiguen los modelos 3D de producto?

Hay cuatro vías. Las juzgamos con cuatro criterios: si necesitas tener el producto delante, cuánto tiempo tuyo exige, lo fieles que salen los lados ocultos y dónde falla.

### Contratar a un artista 3D

Un artista construye el modelo a partir de tus fotos, planos y medidas. No necesitas tener el producto delante, es la vía que más tiempo pide entre el encargo y la espera, y permite ajustar el resultado a las referencias facilitadas. Los presupuestos en Fiverr o Upwork varían según la complejidad de la pieza.

Veredicto: es la vía correcta cuando el modelo tiene que ser exacto, como un sofá que se vende en tres anchos, o para un producto estrella de una campaña.

### Usar los archivos CAD del fabricante

Si vendes diseños propios, es posible que la fábrica ya tenga archivos CAD o de SketchUp. Son exactos en la forma, pero casi nunca están listos para la web: suelen necesitar texturas reales y muchos menos triángulos para cargar bien en un móvil.

Veredicto: lo primero que conviene pedir si los diseños son tuyos. Cuenta con el trabajo de limpieza, porque un archivo de fábrica puede tener mucho más detalle que los 100.000 triángulos de Scene Viewer.

### Escanear el producto

Las aplicaciones de fotogrametría, como Polycam y [RealityScan](https://dev.epicgames.com/documentation/realityscan-mobile/realityscan-step-by-step-guide), construyen un modelo a partir de muchas fotos solapadas. RealityScan empieza a procesar a partir de 20 imágenes y admite hasta 300. Necesitas tener la pieza y sitio para rodearla entera.

Veredicto: la mejor vía para piezas con textura que tienes en el almacén, como una silla de ratán o un aparador de roble. Falla con el cristal, los espejos y el metal pulido.

### Generarlo con IA a partir de una foto

Las herramientas de imagen a 3D, como Meshy, Tripo y easyrender, parten de una sola imagen. Es la única vía cuando tienes la foto del proveedor y no tienes acceso a la pieza. La foto solo enseña un lado, así que revisas la parte de atrás en la previsualización antes de quedarte el modelo.

<!-- IMAGE PENDING: hoja de ángulos EN del jarrón de gres, sin retocar. Pie: «Una hoja de ángulos que easyrender dibujó a partir de una foto de un jarrón de gres, sin retocar. Los objetos redondos y mates como este son el caso fácil». -->

Veredicto: la vía para un catálogo hecho con fotos de proveedor. Los logos finos, los tejidos calados y un lado que la foto nunca enseñó son lo más difícil de leer en una sola imagen. Cada vía, con lo que necesita y dónde falla, está en [cómo hacer un modelo 3D](/es/guias/como-hacer-un-modelo-3d).

Si dudas entre encargarlo o partir de una foto, lee [contratar a un modelador 3D o usar IA](/es/comparativas/modelador-3d-o-ia). Dos de las herramientas se comparan de cerca en [Meshy](/es/comparativas/meshy) y [Tripo](/es/comparativas/tripo).

## Modelos 3D para tiendas de muebles: por dónde empezar

Ordena tus productos antes de hacer un solo modelo. Puntúa cada uno con cuatro preguntas: ¿importan la parte de atrás o la profundidad?, ¿el precio es tan alto que el comprador duda?, ¿te piden más ángulos?, ¿las devoluciones mencionan el aspecto?

Empieza por los cinco que más puntúen. Suele tocar un sillón, un aparador o una lámpara de pie con una pantalla de forma marcada. Los artículos planos, como una lámina enmarcada o una alfombra, ganan poco con el 3D.

Después prueba antes de comprometerte. Pasa un mismo producto por dos vías, por ejemplo un escaneo con el móvil y un modelo de imagen a 3D de la misma lámpara de mesa, y compáralos en un teléfono. Eso te dice más que cualquier lista de funciones.

Para un catálogo grande, mira las opciones por lotes y el precio por modelo. easyrender te deja subir un conjunto de fotos de catálogo a una biblioteca, revisar la previsualización gratis de cada una y generar solo las que te convenzan.

## ¿Cómo se añade el 3D a una tienda, paso a paso?

Este es el orden que seguiríamos con un primer lote:

1. Elige cinco productos con las cuatro preguntas de arriba.
2. Haz cada modelo por la vía que le encaje.
3. Revisa cada modelo: número de patas y puertas, la parte de atrás y la textura a pantalla completa.
4. Ajusta cada archivo al límite: texturas de 2048 píxeles o menos, y geometría comprimida si tu visor lo admite.
5. Súbelo con las herramientas de tu plataforma, como el contenido multimedia de producto de Shopify.
6. Abre cada ficha en un iPhone y en un Android con datos móviles, y prueba la RA en los dos.
7. Mide durante cuatro a seis semanas como se explica arriba y decide el siguiente lote.

## Un ejemplo: un aparador de nogal

Pongamos que una tienda tiene tres fotos del proveedor de un aparador de nogal: frente, tres cuartos y un primer plano de los tiradores de latón. La de tres cuartos es la que hay que usar para imagen a 3D, porque enseña la profundidad y un costado.

<!-- IMAGE PENDING: dibujo EN de las tres fotos del proveedor traducido. Pie: «De las tres fotos, solo la de tres cuartos enseña el costado, así que la herramienta tiene menos profundidad que deducir. Es un dibujo para este ejemplo, no un anuncio real». -->

Lo normal es que las puertas, las patas y la veta se lean bien. Compara los tiradores de latón con el primer plano, porque los herrajes pequeños son lo primero que pierde detalle con cualquier método, y mira de cerca la parte de atrás, que la herramienta no ha visto nunca.

Luego sube el GLB con las herramientas de tu plataforma y abre la ficha en un iPhone y en un Android antes de publicarla. En Shopify, el USDZ para iPhone se genera solo a partir de la misma subida.

## ¿Qué falla cuando una tienda añade 3D?

Casi todos los problemas aparecen solo en un móvil de verdad, y por eso existe el paso 6. Estos son los que hay que buscar, con su arreglo.

| Síntoma                                  | Causa                                                                        | Arreglo                                                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No sale el botón de RA en un Android     | Scene Viewer solo carga archivos por HTTPS, o el móvil no es compatible      | Sirve el GLB por HTTPS y prueba en un segundo móvil                                                                                                           |
| No hay RA en un iPhone desde tu web      | Falta el USDZ, o se sirve con un tipo de contenido incorrecto                | Añade el USDZ y sírvelo como model/vnd.usdz+zip, el tipo que [busca Safari](https://webkit.org/blog/8421/viewing-augmented-reality-assets-in-safari-for-ios/) |
| La pieza se abre enorme o diminuta en RA | La RA usa el tamaño guardado en el archivo, que nunca se midió               | Pon las medidas en el texto; el comprador puede pellizcar la pantalla para cambiar el tamaño                                                                  |
| La pieza flota sobre el suelo            | La base del modelo queda por encima de su origen                             | Lleva el origen a la base en Blender antes de exportar                                                                                                        |
| La ficha va lenta con datos móviles      | Texturas de 4096 píxeles o geometría sin comprimir                           | Texturas de 2048 o 1024, y compresión Draco o Meshopt si el visor la admite                                                                                   |
| El modelo se ve oscuro o sucio en RA     | Sombras horneadas en la textura, algo que Scene Viewer desaconseja           | Usa una textura sin sombras horneadas y pon Metálico a 0 si el material no lo define                                                                          |
| El GLB no se abre en Scene Viewer        | Usa una extensión de glTF que Scene Viewer no recoge, como las texturas WebP | Exporta una versión sencilla con texturas PNG o JPEG                                                                                                          |

## ¿Cuáles son los límites del 3D en ecommerce?

Un modelo generado a partir de una foto enseña forma y materiales, no medidas. Deja las dimensiones en el texto de la ficha y usa la RA como referencia visual del aspecto de la pieza.

Los productos transparentes y reflectantes, como un jarrón de cristal o una lámpara cromada, cuestan con todos los métodos. Los textos y los logotipos pequeños pierden definición.

El 3D no sustituye a las fotos. Las plataformas siguen usando imágenes fijas en los resultados de búsqueda, los anuncios y las cuadrículas de categoría, así que lo básico de la [fotografía de producto para ecommerce](/es/guias/fotografia-de-producto-para-ecommerce) sigue haciendo falta.

## Preguntas frecuentes

### ¿Necesito modelos 3D en mi tienda online?

No en todos los productos. El 3D ayuda sobre todo donde el comprador quiere ver la profundidad y la parte de atrás: sillas, sofás, aparadores, lámparas. En artículos planos o muy sencillos bastan unas buenas fotos. Empieza por unas pocas piezas en las que te pidan más ángulos y decide a partir de ahí.

### ¿Qué formato de archivo 3D necesita una tienda online?

Dos, casi siempre: GLB para la web y la RA en Android, y USDZ, el formato que iPhone y iPad abren en AR Quick Look. Shopify acepta los dos y convierte cada modelo para que existan ambas versiones. Si tu herramienta solo te da uno, Reality Converter en un Mac, o Blender, te sacan el otro.

### ¿Cuánto debe pesar un modelo 3D de producto?

Lo bastante poco para un móvil con datos. Scene Viewer de Google recomienda como máximo 10 MB, 100.000 triángulos y texturas de 2048 píxeles, con 30.000 a 50.000 triángulos como ideal. Shopify acepta archivos de hasta 500 MB y optimiza los que pasan de 15 MB, pero un archivo ligero sigue cargando antes para el comprador.

### ¿Cuánto cuesta un modelo 3D para ecommerce?

Depende de la vía. Los artistas presupuestan por modelo según la complejidad, las aplicaciones de escaneo suelen cobrar una suscripción y las de IA cobran por modelo o por mes. En easyrender la previsualización es gratis y un modelo terminado cuesta {{renderCredits}} créditos ({{renderPrice}}). Los créditos se compran sueltos o con el plan Pro: {{proCredits}} al mes por {{proPrice}}.

### ¿Qué puede comprobar el comprador al ver un producto en RA?

Puede verlo en RA en la mayoría de los móviles recientes: iPhone y iPad usan AR Quick Look con USDZ, y Android usa Scene Viewer con GLB. La RA permite observar su aspecto en una habitación. Para conocer las dimensiones de la pieza, consulta la información del texto de la ficha.
