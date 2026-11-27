---

group: "glb-vs-usdz"
title: "GLB ou USDZ para a web e a RA em dispositivos Apple"
description: "Escolha o GLB para o navegador ou o USDZ para o Quick Look da Apple e verifique ambas as visualizações com o mesmo produto."
date: 2026-12-10
updated: 2026-12-10
keyword: "GLB vs USDZ"
cta: "Reveja os ângulos do seu produto numa pré-visualização gratuita."
---

Utiliza o formato GLB como ponto de partida para um modelo interativo no navegador e o USDZ quando é necessário o Apple Quick Look. Fornece ambos, se a mesma apresentação incluir essas duas experiências. Testa os ficheiros de forma independente nos dispositivos de destino e compara a orientação, os materiais e o caminho de volta para a apresentação.

![Ilustração de vaso facetado, metade sólida e metade em malha](../covers/glb-vs-usdz.webp "Ilustração editorial criada no Blender.")

## Qual ficheiro é necessário para cada componente da página?

| Destino                        | Ficheiro típico | Verificação                                     |
| ------------------------------ | --------------- | ----------------------------------------------- |
| Visualizador de produto na web | GLB             | Carrega e gira com texturas                     |
| Apple Quick Look               | USDZ            | Abre num dispositivo com suporte                |
| Dispositivo sem suporte        | Foto ou poster  | As informações do produto permanecem acessíveis |

## Como verificar a associação?

Indica os dois ficheiros correspondentes ao mesmo SKU e revisão. Abre o GLB no visualizador da web e utiliza a ação da apresentação para abrir o USDZ num dispositivo Apple. Compara a acabamento sob luz neutra e confirma a volta para a mesma variante.

## O que deve ser verificado antes da publicação?

| Problema                                          | Verificação                                |
| ------------------------------------------------- | ------------------------------------------ |
| Visualizador da web funciona e o Quick Look falha | URL de entrega do USDZ e dispositivo       |
| A cor parece diferente                            | Iluminação do material e ambiente          |
| A variante incorreta surge                        | Ambas as referências de ativo no SKU ativo |

<!-- IMAGE PENDING: Photograph or capture the example described in the brief. -->

**Fonte** [Khronos · especificação glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [OpenUSD · especificação USDZ](https://openusd.org/release/spec_usdz.html), [Apple · Quick Look](https://developer.apple.com/quick-look-gallery/), [model-viewer · documentação](https://modelviewer.dev/docs/).

[Guia relacionado](/pt/guias/ficheiro-usdz)

[Como criar um modelo 3D](/pt/guias/como-criar-um-modelo-3d)

## Perguntas frequentes

### É possível utilizar ambos os formatos numa página?

Pode utilizar ambos os formatos GLB e USDZ numa página ao fornecer cada formato para a sua respectiva destino e verificar controlos visíveis. Mantenha uma imagem estática para utilizadores que não possam utilizar o visualizador. Verifique os tamanhos dos ficheiros e os tempos de carregamento em ambos os ambientes web e de realidade aumentada da Apple.

### O GLB é um formato válido para todos os visualizadores de realidade aumentada?

O GLB é válido para visualizadores web de realidade aumentada, mas não para todos os dispositivos Apple. Abra o GLB no visualizador da web e verifique se carrega com texturas e rotação. O erro comum é usar GLB em dispositivos sem suporte, resultando em falha de carregamento.

### Devo comparar apenas os tamanhos dos ficheiros?

Deve comparar os tamanhos e as características visuais dos ficheiros. Indica o GLB para o visualizador da web e o USDZ para o Apple Quick Look. Verifica a aparência sob luz neutra e a consistência da variante para evitar erros de correspondência.
