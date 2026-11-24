---

group: "augmented-reality-furniture"
title: "Realidad aumentada para muebles: qué comprobar"
description: "Prueba un mueble en realidad aumentada desde iPhone y Android. Comprueba el QR, la orientación, el apoyo en el suelo y la vuelta a la tienda."
date: 2026-12-01
updated: 2026-12-01
author: Jorge Rodríguez
authorType: person
keyword: "realidad aumentada para muebles"
cta: "Empieza con una foto del mueble y revisa la vista previa de ángulos antes de crear el modelo."
---

Usa la realidad aumentada para que el comprador pueda ver el mueble en una habitación. Empieza por un solo producto y comprueba cómo se abre el modelo, cómo se coloca en el suelo y cómo se vuelve a la ficha. Mantén visibles las fotos originales y las medidas verificadas del fabricante.

![Sillón con la superficie sólida en una mitad y la malla visible en la otra](/blog/illustrations/augmented-reality-furniture/hero.webp "Ilustración editorial hecha en Blender.")

> **Entra por donde entrará el comprador.** Abre la ficha sin sesión y sigue el mismo botón o código QR que verá un cliente.

## Qué comprobar antes de abrir la cámara

Abre la página del modelo en un ordenador y comprueba que la foto o el visor, el nombre y el QR corresponden a la ficha. Escanea el código con un móvil y verifica qué producto se abre. Si hay variantes, elige otro color o acabado en la tienda y repite.

![Visor de escritorio con el modelo de una mesa de madera y un código QR](/blog/figures/augmented-reality-furniture/desktop-es.webp "Ejemplo público de EasyRender en navegador de escritorio. El QR lleva el mismo modelo a un móvil.")

Comprobamos la misma mesa de EasyRender en escritorio y en un navegador con tamaño de móvil. El GLB cargó en ambas vistas y el QR de escritorio apuntaba a la misma página del modelo. Para probar la cámara y el apoyo en el suelo hace falta un teléfono físico.

![La misma mesa de madera en un visor 3D con tamaño de móvil](/blog/figures/augmented-reality-furniture/phone-es.webp "Modelo público de EasyRender en un navegador con tamaño de móvil antes de abrir la sesión de realidad aumentada.")

| Desde dónde llega el cliente       | Resultado esperado                                   | Qué mirar si falla                                              |
| ---------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| Ficha abierta en ordenador         | Vista del producto y enlace para abrirla en el móvil | Confirma el identificador del producto en el enlace y el QR     |
| Navegador de un móvil compatible   | Botón claro para abrir el visor del dispositivo      | Revisa el navegador y que el archivo abra sin sesión            |
| Dispositivo sin realidad aumentada | Fotos, especificaciones y acceso al carrito          | Mantén esos elementos visibles y una forma de volver a la ficha |

## Qué formatos y dispositivos debes probar

En iPhone o iPad, abre la ficha con Safari y sigue el botón de realidad aumentada hasta [Quick Look de Apple](https://developer.apple.com/quick-look-gallery/), que utiliza USDZ. La [documentación de Scene Viewer de Google](https://developers.google.com/ar/develop/scene-viewer) explica los requisitos, los modos alternativos y los formatos GLB y glTF en Android.

| Dispositivo y visor               | Primera comprobación                                             |
| --------------------------------- | ---------------------------------------------------------------- |
| iPhone con Safari y Quick Look    | Abre el USDZ y conserva el acabado y la orientación previstos    |
| Android con Scene Viewer          | Carga el archivo alojado y abre el modo previsto                 |
| Ordenador o navegador sin soporte | Las fotos, las medidas y los controles de compra siguen visibles |

Si usas [model-viewer](https://modelviewer.dev/examples/augmentedreality/), prueba el modo que has configurado. Puedes facilitar un USDZ aparte o usar un visor que lo genere al pasar a la aplicación del dispositivo. Para más detalles, consulta la [guía de archivos USDZ](/es/guias/archivo-usdz).

## Qué mirar una vez abierta la cámara

1. Busca un suelo despejado y con buena luz. Espera a que el teléfono lo detecte, coloca la pieza y compara su parte delantera y trasera con la foto de referencia.
2. Muévete alrededor del modelo y comprueba si aparece inclinado, si alguna pata queda en el aire o si el acabado cambia. Si ves un problema, guarda una captura y anota el móvil, el navegador y la variante.
3. Cierra la realidad aumentada. Comprueba que puedes volver a la ficha correcta, elegir la variante y seguir comprando.

| Si ves esto                      | Revisa esto antes de repetir                                        |
| -------------------------------- | ------------------------------------------------------------------- |
| El mueble aparece de lado        | La orientación al exportar y la dirección en el visor web           |
| La base queda separada del suelo | La geometría de la base y su posición inicial                       |
| Aparece un acabado distinto      | La asociación de variantes y los materiales del GLB y el USDZ       |
| La cámara no detecta el suelo    | La luz de la habitación, la compatibilidad del móvil y el navegador |

Si estás preparando el archivo, consulta [cómo crear un modelo 3D](/es/guias/como-hacer-un-modelo-3d). Deja las medidas verificadas de cada variante en la ficha para que el comprador pueda consultarlas por separado.

## Preguntas frecuentes

### ¿Tengo que publicar fotos y medidas si ya tengo realidad aumentada?

Conserva las fotos y las medidas del fabricante para cada variante. El comprador puede usar la realidad aumentada para ver el aspecto del mueble en una habitación y consultar los datos del catálogo por separado. Incluye ancho, fondo y alto con su unidad junto a las especificaciones del producto.

### ¿Puedo comprobar la realidad aumentada desde el ordenador?

En un ordenador puedes revisar el modelo web, el nombre y la imagen del QR. Para comprobar el recorrido completo, escanéalo con un móvil, abre el visor del dispositivo, coloca el mueble en el suelo y vuelve a la tienda. Repite en los dispositivos iPhone y Android que quieras admitir.

### ¿Qué ve el comprador si su móvil no puede abrir la realidad aumentada?

Mantén visibles las fotos originales, las medidas y las opciones del producto. Si el visor 3D funciona en el navegador, déjalo accesible. Comprueba que el comprador puede volver a la ficha, elegir la variante correcta y añadirla al carrito aunque el teléfono no llegue a abrir la cámara.
