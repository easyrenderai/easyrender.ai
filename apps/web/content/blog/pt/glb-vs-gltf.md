---

group: "glb-vs-gltf"
title: "GLB ou glTF para entregar um modelo 3D?"
description: "Compare o mesmo modelo em GLB e em glTF com ficheiros separados. Verifique o tamanho total, as texturas e a abertura no visualizador."
date: 2026-11-25
updated: 2026-11-25
author: Jorge Rodríguez
authorType: person
keyword: "GLB ou glTF"
cta: "Experimente gratuitamente a pré-visualização de vários ângulos a partir de uma fotografia de produto."
---

**Escolha o GLB se precisar de entregar um só ficheiro.** A exportação glTF com ficheiros separados permite gerir o JSON, os dados binários e as imagens de textura individualmente. No teste, o Blender abriu a geometria mesmo sem a imagem de textura. Sem o ficheiro BIN, a importação falhou.

![Jarra arredondada com a superfície de um lado e a malha do outro](/blog/illustrations/glb-vs-gltf/hero.webp "Ilustração editorial feita em Blender.")

## Qual foi o tamanho das duas exportações da mesma jarra?

Exportámos a mesma jarra nos dois formatos em Blender 5.2.3. O GLB tinha **1 732 772 bytes**. A exportação com ficheiros separados incluía um JSON de 2 124 bytes, um BIN de 1 702 680 bytes e uma imagem WebP de 28 466 bytes.

Com estas definições, o tamanho total foi quase idêntico. No glTF com ficheiros separados, some todos os ficheiros para comparar com o GLB. As definições de exportação e a codificação das texturas podem alterar o resultado.

![Imagem da jarra depois de importar os ficheiros glTF separados em Blender](/blog/figures/glb-vs-gltf/vase-gltf-render.jpg "Exportação glTF com ficheiros separados reaberta em Blender. O BIN e o WebP estão na mesma pasta que o JSON.")

Retirámos um ficheiro de cada vez das cópias da exportação. Sem o WebP, o Blender abriu a geometria, mas o registo da imagem ficou sem dados de píxeis. Sem o BIN, a importação foi interrompida.

Repita ambos os testes com cópias em pastas diferentes. Antes da entrega, abra a exportação completa no computador onde será usada.

## Como verificar os ficheiros antes de os entregar?

Para entregar um só ficheiro, copie apenas o GLB para uma pasta vazia e abra-o sem ligação à rede. Para o glTF com ficheiros separados, mova a pasta de exportação completa. Se faltar uma textura, compare o URI no JSON com o nome e o caminho do ficheiro no destino.

## Que formato faz sentido para cada destino?

| Destino                            | Ficheiros a entregar                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| E-mail ou catálogo online          | GLB autónomo, testado numa pasta vazia                                                          |
| Diagnóstico de um material         | glTF com ficheiros separados, incluindo a imagem e o BIN                                        |
| Servidor web com cache por recurso | Ficheiros separados, depois de confirmar se o visualizador consegue carregar todos os ficheiros |

## O que acontece quando falta um ficheiro?

| Cópia aberta        | Resultado no Blender                                       |
| ------------------- | ---------------------------------------------------------- |
| Apenas o GLB        | Geometria e textura carregadas                             |
| glTF com BIN e WebP | Geometria e textura carregadas                             |
| glTF sem WebP       | A geometria abriu sem a textura                            |
| glTF sem BIN        | A importação parou e o Blender indicou o ficheiro em falta |

## Que ficheiros devem ficar juntos?

| Ficheiro                 | Para que serve                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Ficheiro glTF com o JSON | Abra-o para carregar a cena                                                                                      |
| Ficheiro BIN             | Mantenha-o no caminho indicado no JSON                                                                           |
| Imagens                  | Mantenha os caminhos e respeite as maiúsculas e minúsculas nos nomes. Abra o ficheiro glTF no sistema de destino |

Consulte a [especificação glTF](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) para ver a estrutura dos formatos. Verifique os ficheiros com o [validador glTF da Khronos](https://github.com/KhronosGroup/glTF-Validator). As opções de exportação estão no [manual do Blender](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html).

[Como criar um modelo 3D](/pt/guias/como-criar-um-modelo-3d)

## Perguntas frequentes

### Um dos formatos é sempre mais leve?

O tamanho depende dos dados exportados e da codificação das texturas. Exporte o mesmo modelo nos dois formatos com definições comparáveis. Para o glTF com ficheiros separados, some o tamanho do JSON, do BIN e das imagens antes de comparar. No nosso teste, os três ficheiros somaram 1 733 270 bytes.

### Um GLB pode referenciar recursos externos?

Sim. Se precisar de um ficheiro autónomo, copie só o GLB para uma pasta vazia e abra-o no visualizador de destino, sem ligação à rede. Confirme que a geometria e as texturas aparecem depois de retirar os restantes ficheiros da pasta de exportação.

### Porque é que o mesmo modelo tem um aspeto diferente em dois visualizadores?

A iluminação, o mapeamento de tons e o suporte para materiais ou extensões podem variar. Compare os dois ficheiros no mesmo visualizador e com as mesmas definições. Se a textura desaparecer ao mover a exportação com ficheiros separados, verifique o URI e o caminho da imagem.
