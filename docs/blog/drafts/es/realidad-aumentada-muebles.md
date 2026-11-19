---

group: "augmented-reality-furniture"
title: "Cómo revisar un mueble en realidad aumentada"
description: "Comprueba la colocación, la apariencia y el regreso a la ficha desde la realidad aumentada en móvil."
date: 2026-12-01
updated: 2026-12-01
keyword: "realidad aumentada muebles"
cta: "Prueba la vista previa de ángulos con una foto de producto."
---

Abre el modelo de un mueble en realidad aumentada desde un móvil compatible antes de enlazarlo en la ficha. Comprueba el botón de entrada, la orientación, el apoyo en el suelo y el regreso al navegador. Conserva las medidas verificadas en las especificaciones y usa la sesión para revisar la presentación visual.

![Ilustración de silla con brazos, mitad sólida y mitad en malla](../covers/augmented-reality-furniture.webp "Ilustración editorial hecha en Blender.")

## ¿Qué recorrido pruebas?

Abre la ficha en el móvil de destino y pulsa el mismo control que usará el comprador. En dispositivos Apple compatibles, verifica la apertura mediante Quick Look. Para otros recorridos, consulta los modos de RA y requisitos del visor.

## ¿Qué anotas al colocar el modelo?

Busca suelo despejado y buena luz. Coloca el modelo, rodéalo y observa si mira hacia donde esperabas y se apoya en el suelo. Vuelve a la ficha y comprueba que mantiene la variante correcta.

## ¿Qué deberías revisar antes de publicar?

| Problema                | Diagnóstico                                |
| ----------------------- | ------------------------------------------ |
| La pieza aparece girada | Orientación exportada y colocación inicial |
| Falta el botón de RA    | Dispositivo, navegador y modo del visor    |
| Se abre otro mueble     | URL del modelo para la variante activa     |

<!-- IMAGE PENDING: Fotografiar o capturar el ejemplo descrito en el brief. -->

**Fuente** [Apple · Quick Look](https://developer.apple.com/quick-look-gallery/), [model-viewer · documentation](https://modelviewer.dev/docs/), [Apple · Preparing 3D Content for RealityKit](https://developer.apple.com/documentation/arkit/previewing-a-model-with-ar-quick-look).

[Guía relacionada](/es/guias/archivo-usdz)

[Cómo crear un modelo 3D](/es/guias/como-hacer-un-modelo-3d)

## Preguntas frecuentes

### ¿Siguen haciendo falta las medidas?

Sí. Muestra las medidas verificadas del fabricante y comprueba que corresponden a la variante seleccionada. La realidad aumentada aporta contexto visual. Coloca el ancho, el alto y el fondo junto a la variante o en la tabla de especificaciones para que se puedan consultar sin abrir la vista en RA.

### ¿Qué ve un teléfono incompatible?

Un teléfono incompatible ve solo el logo del producto y no carga la vista en realidad aumentada. Asegúrate de que el dispositivo tenga al menos 800x600 píxeles y soporte AR, y verifica que el navegador permita la carga de contenido 3D.

### ¿Puedo probarlo solo desde ordenador?

El ordenador sirve para revisar el archivo. Para validar el recorrido de RA necesitas recorrerlo desde un móvil compatible. Asegúrate de que tu teléfono tenga al menos 800x600 píxeles y soporte de realidad aumentada para ver correctamente el modelo 3D.
