---

group: "woocommerce-3d-models"
title: "Cómo añadir un visor 3D a WooCommerce"
description: "Añade un visor 3D a WooCommerce con un GLB propio o crea el modelo desde una foto. Prueba la primera ficha antes de extenderlo al catálogo."
date: 2026-11-29
updated: 2026-11-29
author: Jorge Rodríguez
authorType: person
keyword: "visor 3d woocommerce"
cta: "Prueba gratis la vista previa de una foto antes de crear un modelo 3D para tu tienda."
---

Añade el visor 3D a un producto de WooCommerce en una tienda de pruebas. Si ya tienes un GLB, usa una extensión o un visor compatible, y si partes de fotos, crea primero el modelo. Conserva la galería de fotos y comprueba el visor, la variante seleccionada y el carrito con tu tema.

![Molinillo de café, mitad con superficie sólida y mitad con la malla a la vista](/blog/illustrations/woocommerce-3d-models/hero.webp "Ilustración editorial hecha en Blender.")

> **Prueba qué puede hacer el cliente al cerrar el visor.** Debe poder elegir la variante y añadirla al carrito sin tener que buscar el botón de compra.

## Qué integración elegir según el material que tengas

| Punto de partida                                              | Integración                    | Qué revisar primero                                                     |
| ------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| Ya tienes un GLB y quieres gestionar el visor desde WordPress | Una extensión de WooCommerce   | Qué archivos admite y dónde aparece el visor                            |
| Ya tienes un GLB y controlas la plantilla                     | Un visor web como model-viewer | Las URL públicas, la carga y la disposición en móvil                    |
| Tienes fotos y necesitas crear modelos para el catálogo       | El conector de EasyRender      | Qué productos incluye el presupuesto y adónde lleva el botón de 3D y RA |

[Arty 3D Viewer](https://woocommerce.com/document/arty-3dmodelviewer/) es un ejemplo documentado de extensión que admite GLB y permite configurar la posición y la altura del visor. Requiere una cuenta y una suscripción de Arty. Revisa las características de la extensión que elijas, sobre todo si las variantes tienen modelos distintos.

## Si ya tienes un archivo GLB

1. Escoge un producto que ya exista en el entorno de pruebas. Conserva la [imagen principal y la galería de WooCommerce](https://woocommerce.com/document/adding-product-images-and-galleries/), con una foto de cada variante que importe.
2. Sube el GLB y asígnalo al producto en la extensión. Si controlas la plantilla, los [ejemplos de model-viewer](https://modelviewer.dev/examples/loading/) muestran cómo cargar el modelo y su imagen inicial. Aloja los archivos en URL HTTPS que abran sin sesión y configura el acceso entre orígenes si el GLB está en otro dominio.
3. Abre la ficha sin sesión. Gira el modelo, cambia de variante y añade la que has elegido al carrito. Repite la prueba en una pantalla estrecha y en los navegadores que vayas a admitir.

| Resultado esperado                                | Cómo comprobarlo                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| La foto se ve antes de cargar el modelo           | Conserva la galería y configura una imagen inicial en el visor         |
| Al cambiar de variante se abre el modelo correcto | Compara la referencia o el identificador de la variante con el archivo |
| El cliente puede seguir comprando                 | Cierra el visor e intenta añadir el producto al carrito                |

Si te falta revisar el archivo, consulta la guía sobre [cómo crear un modelo 3D](/es/guias/como-hacer-un-modelo-3d) antes de adjuntarlo al producto.

## Si necesitas generar modelos desde fotos

El [conector de EasyRender para WooCommerce](/es/ecommerce?platform=woocommerce) genera modelos desde las fotos del catálogo. Cuando un producto está listo, aparece un botón y un QR para abrir su página de 3D y realidad aumentada. Para girar el modelo dentro de la galería de WooCommerce, usa una extensión de visor o intégralo en la plantilla.

1. En una tienda de pruebas, prepara el ZIP siguiendo las instrucciones del conector de EasyRender e instálalo con los [pasos de instalación de WordPress](https://wordpress.org/documentation/article/manage-plugins/).
2. Abre **WooCommerce → 3D y RA** e introduce una clave de la API de EasyRender. Deja en ese catálogo de pruebas los productos publicados con foto HTTPS que quieras usar. El conector agrupa los productos aptos.
3. Revisa el número de productos y los créditos antes de confirmar la generación. Cuando el producto esté listo, abre la ficha en la tienda y comprueba el botón y el destino del QR.

![Ficha de prueba de WooCommerce con foto, carrito, botón de realidad aumentada y código QR](/blog/figures/woocommerce-3d-models/storefront-test.webp "Recorte de la prueba en navegador del tema Storefront. La API de catálogo usó respuestas simuladas y el QR apunta al entorno de pruebas.")

En [nuestra prueba en navegador](https://github.com/easyrenderai/easyrender.ai/actions/runs/44724493484) usamos una instalación real de WooCommerce con Storefront y Twenty Twenty-Five. Comprobamos el presupuesto, los tres productos de prueba aptos, la carga de la imagen del QR y el destino del botón. La API devolvió datos simulados y queda por probar la realidad aumentada con un teléfono físico.

## Qué comprobar antes de activarlo en la tienda

| Si ocurre esto                            | Revisa esto                                                          |
| ----------------------------------------- | -------------------------------------------------------------------- |
| El modelo devuelve un 403                 | Abre la URL en incógnito y revisa los permisos del alojamiento       |
| Desaparece la galería de fotos            | Revisa en qué bloque se inserta el visor y recupera la galería       |
| La ficha salta al cargar                  | Reserva una proporción fija para la imagen inicial y el visor        |
| El botón de RA no abre el visor del móvil | Comprueba el navegador, el dispositivo y la compatibilidad del visor |

Prueba la realidad aumentada en un iPhone y un Android que quieras admitir. La [documentación de realidad aumentada de model-viewer](https://modelviewer.dev/examples/augmentedreality/) explica qué formato usa cada mecanismo de apertura. Conserva también las fotos y las medidas de catálogo para todos los compradores.

## Preguntas frecuentes

### ¿Necesito un plugin para añadir un visor 3D a WooCommerce?

Usa un plugin si quieres gestionar los modelos desde WordPress sin editar la plantilla. Si controlas el tema, también puedes integrar un visor y mantener las URL, las imágenes iniciales y la asociación con cada variante. En ambos casos, mantén accesibles la galería original y el carrito.

### ¿Puedo usar el mismo GLB en iPhone y Android?

El GLB sirve para un visor web y para mecanismos de realidad aumentada compatibles en Android. En iPhone, Quick Look abre un USDZ y algunos visores lo generan al abrirlo. Comprueba cómo lo gestiona tu integración y deja las fotos disponibles para los dispositivos sin realidad aumentada.

### ¿Qué compruebo antes de añadir más productos?

Abre la ficha sin sesión y verifica que el modelo corresponde a la variante seleccionada. Comprueba la página en móvil y añade el producto al carrito. Si vas a generar modelos para un lote, revisa cuántos productos se incluirán y el presupuesto en créditos antes de aceptar.
