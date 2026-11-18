# Pruebas de exportación y malla

Pruebas locales del 18 de noviembre de 2026 con Blender 5.2.3 LTS y modelos públicos de EasyRender. [Datos de exportación](blender-measurements.json).

- **Empaquetado.** Importar `vase.glb` de la carpeta pública `showcase`. Exportarlo como glTF Binary y glTF Separate. Contar todos los archivos de cada entrega, incluida la imagen WebP y el búfer BIN. Abrir los dos y comparar con la misma cámara y luz.
- **Malla.** Importar `coffee-table.glb` y exportarlo a GLB. Aplicar Decimate en modo Collapse con proporción 0,5 al mismo objeto y repetir la exportación. Contar triángulos antes y después. Los dos GLB de la medición vienen del mismo exportador y ajustes. Las capturas presentan los exportados en Blender con la misma cámara y luz dentro de cada par.
- **Intercambio.** Importar `bedside-table.glb`. Exportar Wavefront OBJ y FBX. En FBX, usar Copy y activar la opción de incluir texturas. Las cifras del OBJ describen los archivos OBJ y MTL obtenidos. El tamaño de la imagen externa, si la necesita el importador, se debe medir por separado.

Las cifras describen los archivos de la prueba. No son presupuestos universales de peso, rendimientos de visor ni pruebas de compatibilidad en Shopify, WooCommerce, SketchUp o un teléfono.
