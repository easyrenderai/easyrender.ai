---

group: "low-poly-vs-high-poly"
title: "Low poly o high poly en un visor de producto"
description: "Elige el detalle de malla según distancia, silueta y dispositivo con una prueba visual repetible."
date: 2026-12-16
updated: 2026-12-16
keyword: "low poly vs high poly"
cta: "Prueba la vista previa de ángulos con una foto de producto."
---

Elige el detalle de malla a partir de lo que necesita ver el comprador. Conserva geometría en contornos, curvas y huecos que importan al girar el producto. Usa textura para el detalle fino de superficie cuando funcione. Compara dos versiones al tamaño de la galería y con el zoom más cercano.

![Ilustración de taza con asa, mitad sólida y mitad en malla](../covers/low-poly-vs-high-poly.webp "Ilustración editorial hecha en Blender.")

## ¿Qué detalle debe seguir siendo geometría?

Conserva los cantos de las patas, los huecos de los tiradores y el borde de un recipiente cuando cambien la silueta o la perspectiva. Usa mapas para la veta fina cuando no afecte al contorno. Revisa sombras y reflejos.

![Tablero y soporte de referencia](../evidence/coffee-baseline-side.jpg)
![Mismo lateral tras reducir triángulos](../evidence/coffee-decimated-side.jpg)

## ¿Cómo eliges un objetivo de polígonos?

Nuestra mesa de centro pública tiene 16.228 triángulos y nuestra mesita tiene 69.910. Ambas usan un material. Son piezas distintas. Para decidir, compara dos exportaciones del mismo objeto con el mismo encuadre, material y dispositivo.

## ¿Qué deberías revisar antes de publicar?

| Dónde importa     | Prueba                           |
| ----------------- | -------------------------------- |
| Silueta exterior  | Comparar frontal y perfil        |
| Herrajes y huecos | Conservar las aberturas visibles |
| Veta fina         | Revisar las texturas al ampliar  |

<!-- IMAGE PENDING: Fotografiar o capturar el ejemplo descrito en el brief. -->

**Fuente** [Blender · Decimate modifier](https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/decimate.html), [Khronos · glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [model-viewer · documentation](https://modelviewer.dev/docs/).

[Guía relacionada](/es/guias/como-hacer-un-modelo-3d)

## Preguntas frecuentes

### ¿Existe un límite low poly estándar?

No existe un límite low poly estándar, pero debes ajustarlo según la página, cámara y dispositivos. Asegúrate de que el visor de producto muestre correctamente la carga y giro. Revisa siempre el tipo de contenido y el entorno de uso.

### ¿Qué simplifico primero?

Empieza por superficies planas con geometría extra o zonas que queden fuera de vista. Cambia una zona cada vez y revisa el archivo exportado. Empieza por las superficies planas con geometría extra y revisa siempre el archivo exportado antes de continuar con otras zonas.

### ¿Un mapa de normales conserva el contorno?

Un mapa de normales conserva el contorno si la forma cambia el contorno o crea un hueco visible. Usa este método para dar apariencia de detalle poco profundo. Revisa que el contorno no se rompa al aplicar el mapa y asegúrate de que el visor no distorsione la geometría.
