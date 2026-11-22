---

group: "shopify-3d-models"
title: "Cómo añadir modelos 3D a productos de Shopify"
description: "Sube un modelo 3D a Shopify y comprueba el tema, el visor de producto y la experiencia móvil."
date: 2026-11-20
updated: 2026-11-20
author: Jorge Rodríguez
authorType: person
keyword: "modelos 3d shopify"
cta: "Prueba la vista previa de ángulos con una foto de producto."
---

Añade un archivo GLB o USDZ a la galería de un producto en Shopify y abre la vista previa con el tema que usas en la tienda. Compruébala en móvil y escritorio. Conserva una foto principal que explique el producto mientras se carga el modelo.

![Ilustración de caja de cartón abierta, mitad sólida y mitad en malla](/blog/illustrations/shopify-3d-models/hero.webp "Ilustración editorial hecha en Blender.")

## ¿Qué debes comprobar antes de subir el archivo?

Elige un producto con fotos claras. Abre el modelo en un visor independiente y comprueba orientación, superficies y textura. Anota el peso del archivo y elige una miniatura que ayude a reconocer la vista interactiva.

Consulta los formatos y límites vigentes de Shopify. El tema debe admitir medios 3D o adaptarse para mostrarlos. Compruébalo en un producto en borrador o un tema de pruebas.

## ¿Cómo subes el modelo de un producto?

Abre el producto en el administrador y añade el archivo en Contenido multimedia. [Pasos de subida de Shopify](https://help.shopify.com/en/manual/products/product-media/add-media). Espera a que termine de procesarse y guarda. En la vista previa de la tienda, selecciona el modelo y gíralo para ver la trasera y la base.

## ¿Qué haces si el visor no aparece?

Si se abre en el administrador y falta en la ficha, revisa la sección de medios del tema. Haz la prueba en móvil y con una sesión nueva. Si habilitas RA, ábrela en un dispositivo compatible y comprueba el regreso a la tienda.

## ¿Qué deberías revisar antes de publicar?

| Síntoma                                             | Dónde revisar                                                     |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| La carga se rechaza                                 | Formato y límites de archivo                                      |
| Se abre en el administrador pero falta en la tienda | Compatibilidad del tema con medios 3D                             |
| Funciona el visor, pero falla la RA                 | Comprueba el dispositivo, el navegador y el archivo procesado     |
| Sale el modelo antes que la foto principal          | Revisa el orden en Contenido multimedia                           |
| El material cambia al abrir el modelo               | Compara el archivo original con el procesado bajo una luz similar |
| El modelo tarda en el móvil                         | Anota el peso de descarga y cuándo se puede girar                 |

![Archivo GLB de un sillón giratorio de EasyRender abierto en Blender](/blog/figures/shopify-3d-models/chair-inspection.webp "Reabrimos el GLB en Blender antes de la subida. Comprueba por separado el procesamiento y la galería en la vista previa del tema de tu tienda.")

## Comprueba los archivos admitidos

Los [requisitos de contenido multimedia de Shopify](https://help.shopify.com/en/manual/products/product-media/product-media-types) fijan un máximo de 500 MB para GLB y USDZ y documentan la optimización automática de archivos que superen 15 MB. Anota el peso del original y compara el resultado después del procesamiento. La [especificación glTF](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) describe qué puede contener un GLB.

| Qué compruebas                          | Dónde lo compruebas                          |
| --------------------------------------- | -------------------------------------------- |
| Orientación y texturas del GLB original | Visor independiente antes de subirlo         |
| Si el procesamiento ha terminado        | Contenido multimedia de la ficha en borrador |
| Miniatura y posición en la galería      | Vista previa del tema de la tienda           |

## Haz la prueba como un comprador

| Sesión                         | Resultado esperado                                                   |
| ------------------------------ | -------------------------------------------------------------------- |
| Escritorio, sin iniciar sesión | Aparece la foto principal y el modelo se puede girar                 |
| Móvil, sesión nueva            | El modelo abre al seleccionarlo y se puede volver a las fotos        |
| Dispositivo Apple compatible   | Quick Look se abre donde esté habilitado y permite volver a la ficha |

**Fuente** [Shopify · product media](https://help.shopify.com/en/manual/products/product-media), [Shopify · media types](https://help.shopify.com/en/manual/products/product-media/product-media-types), [Shopify · managing product media](https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections/manage-media), [Apple · Quick Look](https://developer.apple.com/quick-look-gallery/).

[Guía relacionada](/es/guias/modelos-3d-para-ecommerce)

[Cómo crear un modelo 3D](/es/guias/como-hacer-un-modelo-3d)

## Preguntas frecuentes

### ¿Funciona en cualquier tema de Shopify?

Comprueba el tema y la versión que usa tu tienda. Shopify publica documentación de compatibilidad. En un tema personalizado, prueba la plantilla concreta de producto y revisa su sección de medios. Desde la vista previa del tema, comprueba en el móvil si puedes pasar de la foto al modelo y volver a la galería.

### ¿Cuál de los archivos debo subir?

Sube GLB o USDZ. Shopify admite modelos de hasta 500 MB, aunque conviene optimizar el peso para la galería. Abre el original en otro visor y comprueba después que el modelo procesado carga en la ficha real, tanto en móvil como en escritorio.

### ¿Debo sustituir la foto principal?

No sustituyas la foto principal. Coloca el modelo 3D cerca de las imágenes que mejor muestran la pieza y verifica que la galería indique que se puede girar. Asegúrate de que el modelo esté en formato compatible y que el tamaño sea adecuado para la vista en la tienda.
