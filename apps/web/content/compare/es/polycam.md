---

group: compare-polycam
title: "4 alternativas a Polycam: captura y descargas"
description: "¿Solo tienes una foto, no tienes LiDAR o no puedes exportar? Compara 4 alternativas a Polycam por captura, descargas gratis y uso comercial."
keyword: alternativas a Polycam
date: 2026-11-16
updated: 2026-11-16
author: Jorge Rodríguez
authorType: person
cta: ¿Solo tienes una foto del producto? Revisa gratis sus ángulos generados y decide después si necesitas crear el modelo 3D de pago.
---

La alternativa a Polycam depende de lo que tengas: **una foto de producto, el objeto delante o un espacio que escanear**. Empieza por easyrender para el primer caso, KIRI Engine o RealityScan Mobile para capturar objetos y Scaniverse para espacios. Comprueba el archivo descargable y sus derechos de uso antes de elegir.

## Qué alternativa resuelve tu problema

| Herramienta            | Cuándo elegirla                                  | Acceso gratuito                              | Qué comprobar                                              |
| ---------------------- | ------------------------------------------------ | -------------------------------------------- | ---------------------------------------------------------- |
| **easyrender**         | Solo tienes una foto del producto                | Vista de ángulos; modelo por {{renderPrice}} | Revisa las caras generadas; GLB y USDZ                     |
| **KIRI Engine**        | Puedes fotografiar el objeto por todos los lados | Escaneos y exportaciones Basic               | Los modos avanzados requieren Pro                          |
| **RealityScan Mobile** | Quieres captura guiada con el móvil              | Aplicación móvil gratuita                    | OBJ en iOS; GLB en Android                                 |
| **Scaniverse**         | Capturas espacios o trabajas con un equipo       | Classic local; cupo Free en la nube          | Classic y la plataforma nueva tienen condiciones distintas |
| **Polycam**            | Su captura y forma de compartir ya te sirven     | Capturas limitadas y exportación GLTF        | Más formatos requieren ampliar el plan                     |

Condiciones consultadas el 16 de noviembre de 2026: [Polycam](https://poly.cam/pricing), [KIRI](https://www.kiriengine.app/pricing), [RealityScan Mobile](https://www.realityscan.com/mobile), [Scaniverse](https://www.nianticspatial.com/pricing) y [easyrender](/es/precios). Son flujos distintos, no una clasificación de calidad medida.

> **Una foto y un escaneo responden a necesidades distintas.** El escaneo reconstruye superficies que capturas. La generación desde una imagen predice las partes que la foto no enseña.

## Empieza por lo que puedes capturar

**Solo una foto del proveedor:** no puedes rodear el producto para obtener más vistas. Prueba un flujo de foto a 3D si necesitas una representación visual. Revisa la trasera, la base y las piezas separadas con las referencias que tengas.

**El objeto está delante:** captura fotografías reales con solapamiento. Aportan información de los laterales y la trasera, aunque los materiales brillantes, transparentes o sin textura pueden producir huecos. Consulta la [comparativa de fotogrametría](/es/comparativas/software-de-fotogrametria) para elegir procesamiento en ordenador y preparar la captura.

**Una habitación o un espacio:** prioriza cobertura, coordenadas, colaboración y tipo de salida. Una escena con Gaussian splats puede verse convincente sin proporcionar la malla editable que necesita tu aplicación.

## Cuatro alternativas y sus límites

### easyrender: una foto y revisión antes de generar

**Encaja si necesitas visualizar un producto desde una fotografía existente.** Sube la foto, revisa los ángulos generados y decide si construir un modelo con textura. Cuesta {{renderCredits}} créditos ({{renderPrice}}); la vista previa es gratis. Consulta el [flujo de foto a 3D](/es/guias/como-crear-un-modelo-3d-a-partir-de-fotos).

Estas imágenes muestran nuestro ejemplo existente de un jarrón. La segunda contiene vistas generadas, no fotografías adicionales ni un resultado de Polycam. Sirven para explicar qué revisar, no para comparar la calidad de las herramientas.

![Fotografía de producto de un jarrón utilizada como entrada del ejemplo](/showcase/vase.jpg "Entrada: una fotografía del producto. Contrasta el borde, las asas y la base con las vistas generadas.")
![Hoja de ángulos generados del mismo jarrón](/showcase/vase-angles.jpg "Vistas generadas: revisa silueta, aberturas y base. Las partes ocultas son predicciones; es una muestra existente de easyrender, no una prueba de Polycam.")

**Su límite:** una fotografía no establece la geometría oculta ni las medidas reales. Si necesitas esos datos, utiliza captura física o modelado con referencias medidas. Descarga el GLB o USDZ y compruébalo en el visor de destino antes de producir un catálogo.

### KIRI Engine: capturar objetos y exportar con Basic

**Encaja si tienes el objeto y buscas escaneos descargables gratis.** El [plan Basic](https://www.kiriengine.app/pricing) incluye captura por fotos, hasta 150 imágenes por escaneo y formatos como OBJ, FBX, STL y GLB. Su [guía Basic frente a Pro](https://www.kiriengine.app/blog/kiri-engine-basic-vs-pro) permite expresamente el uso comercial de los modelos exportados con Basic.

**Su límite:** los modos avanzados, como reconstrucción de objetos sin textura y Gaussian splatting, requieren Pro. No des por hecho que la captura gratuita resolverá un producto brillante o transparente. Prueba un material representativo y abre las texturas exportadas.

### RealityScan Mobile: captura guiada con el teléfono

**Encaja si quieres ver la cobertura mientras rodeas el objeto.** La [aplicación móvil](https://www.realityscan.com/mobile) ofrece indicaciones de cobertura, captura automática y exportación al dispositivo. La [documentación de archivos](https://dev.epicgames.com/documentation/realityscan-mobile/RealityScan-Project-Files) de Epic especifica OBJ en iOS y GLB en Android.

**Su límite:** prepara el formato que produce tu teléfono y conserva los archivos de textura. La versión de ordenador tiene [otra licencia](https://www.realityscan.com/license); sus umbrales de facturación y precios por puesto no son los de esta comparativa móvil. Revisa el acuerdo de la aplicación para el uso que darás al resultado.

### Scaniverse: distinguir Classic de la plataforma nueva

**Encaja para objetos en Classic o para reconstrucción de espacios y colaboración en la nueva plataforma.** Las [preguntas frecuentes de Niantic](https://www.nianticspatial.com/faq/scaniverse) separan la experiencia individual Classic del nuevo flujo de nube y equipos.

**Su límite:** la nueva [tabla de precios](https://www.nianticspatial.com/pricing) sitúa los derechos comerciales en Pro, no en Free ni Plus. Free tiene un cupo mensual y Classic mantiene el procesamiento local gratuito. Comprueba la versión y el plan antes de comprometer una entrega a un cliente. Los formatos también dependen del resultado y del plan.

## Cuánto cuesta realmente cambiar de herramienta

| Coste que revisar    | Por qué importa                                       | Comprobación útil                                     |
| -------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| Tiempo de captura    | Más ángulos requieren acceso al objeto                | Captura una pieza representativa, incluida la trasera |
| Acceso a la descarga | El visor puede no incluir el archivo que necesitas    | Exporta el formato exacto antes de suscribirte        |
| Correcciones         | Huecos, piezas flotantes y costuras añaden trabajo    | Examina la malla por debajo, no solo de frente        |
| Derechos de uso      | El acceso gratis no siempre incluye trabajo comercial | Lee las condiciones del modo y plan elegidos          |

[Polycam Free](https://poly.cam/pricing) incluye capturas limitadas de espacios, objetos e IA y exportación GLTF. Basic publica US$30 al mes o US$150 facturados al año. Polycam también ofrece un [generador de modelos con IA](https://poly.cam/tools/3d-model-generator): no es una herramienta limitada a LiDAR. Quizá te baste otro modo o plan en lugar de cambiar de producto.

> **Elige por el archivo que puedes utilizar.** Captura o genera una pieza difícil, descárgala, ábrela en tu herramienta de destino y revisa material y geometría. Después compara el coste y el tiempo total.

## Cómo hemos comparado las opciones

Esta comparativa de flujos se basa en las fuentes oficiales enlazadas, revisadas el 16 de noviembre de 2026. No hicimos una prueba controlada de Polycam, KIRI, RealityScan o Scaniverse: no clasificamos su velocidad, precisión geométrica ni calidad de textura. Las imágenes del jarrón muestran únicamente nuestro flujo existente desde una foto.

Para generadores desde fotos o texto, consulta las [alternativas a Meshy](/es/comparativas/meshy) y las [alternativas a Tripo](/es/comparativas/tripo). Para geometría de fabricación, parte de referencias medidas y un flujo de CAD o escaneo adecuado.

## Preguntas frecuentes

### ¿Qué alternativa gratuita a Polycam permite descargar?

KIRI Basic incluye escaneos por fotos y exportaciones gratis; su documentación permite proyectos comerciales. RealityScan Mobile también es gratuita y guarda modelos en el dispositivo. En Scaniverse distingue Classic de la plataforma nueva: sus planes y derechos no son iguales. Confirma el archivo y la licencia que necesitas.

### ¿Puedo crear un modelo sin LiDAR?

Sí. La reconstrucción por fotografías puede utilizar imágenes con solapamiento en lugar de LiDAR. Necesitas acceso al objeto y suficiente cobertura. Si solo tienes una foto, easyrender predice las vistas que faltan; es un flujo diferente, con límites distintos.

### ¿Qué opción funciona con una sola foto de producto?

easyrender está diseñado para ese flujo: vista de ángulos gratis y modelo de pago opcional. Polycam también anuncia un generador con IA. Una foto y sus vistas generadas no demuestran la forma de las zonas ocultas. Contrasta el resultado con tu producto antes de usarlo.

### ¿Un Gaussian splat es lo mismo que un modelo GLB?

No. Un Gaussian splat representa la apariencia de forma distinta a una malla de polígonos. Una herramienta puede ofrecer ambas salidas, pero exportar un splat no garantiza una malla que puedas utilizar en tu editor o visor de producto. Comprueba el tipo de salida además de la extensión.
