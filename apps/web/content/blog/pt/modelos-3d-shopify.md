---

group: "shopify-3d-models"
title: "Como adicionar modelos 3D a produtos na Shopify"
description: "Carregue um ficheiro GLB ou USDZ na Shopify e verifique a galeria do tema da sua loja num computador e num telemóvel."
date: 2026-11-20
updated: 2026-11-24
author: Jorge Rodríguez
authorType: person
keyword: "modelos 3D Shopify"
cta: "Carregue uma fotografia do produto e veja gratuitamente a pré-visualização de vários ângulos."
---

Para adicionar um modelo 3D a um produto na Shopify, carregue um ficheiro GLB ou USDZ na galeria da ficha. Abra a pré-visualização com o tema da sua loja e experimente o visualizador num computador e num telemóvel. Mantenha uma fotografia nítida no primeiro lugar, para que o produto continue visível enquanto o modelo carrega.

![Caixa de envio aberta com a malha visível numa das metades](/blog/illustrations/shopify-3d-models/hero.webp "Ilustração editorial criada no Blender.")

## Que ficheiro deve preparar?

Comece por um produto para o qual já tem fotografias de qualidade. Abra o modelo num visualizador 3D e rode-o para ver a parte de trás e a base. Confirme a orientação, as texturas e o acabamento, e registe o tamanho do ficheiro.

Os [requisitos da Shopify para ficheiros multimédia de produtos](https://help.shopify.com/en/manual/products/product-media/product-media-types) indicam os formatos GLB e USDZ até 500 MB por ficheiro. A Shopify otimiza automaticamente os modelos superiores a 15 MB. A [especificação glTF](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) descreve a estrutura de um ficheiro GLB.

![GLB de um cadeirão giratório da EasyRender aberto no Blender](/blog/figures/shopify-3d-models/chair-inspection.webp "Abrimos o GLB original no Blender. Verifique separadamente o processamento na Shopify e o aspeto da galeria na pré-visualização da sua loja.")

| O que verificar                               | Onde verificar                                    |
| --------------------------------------------- | ------------------------------------------------- |
| Orientação, texturas e acabamento             | No visualizador antes do carregamento             |
| Tamanho do ficheiro e estado do processamento | Nas propriedades do ficheiro e na área multimédia |
| Miniatura e ordem da galeria                  | Na pré-visualização da ficha no tema da loja      |

## Como carregar o modelo na ficha?

1. Na área de administração da Shopify, abra **Produtos** e escolha uma ficha em rascunho para o primeiro teste.
2. Adicione o ficheiro na secção de multimédia da ficha. O [guia de carregamento da Shopify](https://help.shopify.com/en/manual/products/product-media/add-media) apresenta os passos no navegador e na aplicação.
3. Depois do processamento, guarde as alterações e abra a pré-visualização do produto. Deixe a fotografia principal no primeiro lugar e confirme que consegue selecionar e rodar o modelo.

| O que acontece                                                  | O que deve verificar primeiro                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| A Shopify rejeita o ficheiro                                    | O formato e o tamanho do ficheiro                                                                |
| O modelo está na administração mas falta o visualizador na loja | O suporte para conteúdos 3D na ficha do tema                                                     |
| O modelo abre, mas a realidade aumentada não funciona           | Verifique o dispositivo, o navegador e o ficheiro de realidade aumentada que a Shopify processou |
| O modelo aparece antes da fotografia principal                  | Verifique a ordem dos elementos na secção de multimédia do produto                               |
| O modelo demora a carregar                                      | O tamanho do ficheiro e o tempo de carregamento num telemóvel                                    |
| O acabamento parece diferente                                   | Compare o original com o ficheiro processado sob iluminação semelhante                           |

## Como testar o que o cliente vê?

Na administração da Shopify, abra a [pré-visualização do rascunho](https://help.shopify.com/en/manual/products/add-update-products#preview-a-product). Se tiver uma ligação de pré-visualização para visitantes, abra-a também numa janela privada.

Se o visualizador não aparecer, verifique a versão do tema e o componente que apresenta a galeria na ficha. Experimente selecionar o modelo e regressar à fotografia principal.

| Dispositivo                  | Resultado esperado                                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Computador                   | A fotografia principal aparece e é possível abrir e rodar o modelo                                                                |
| Telemóvel                    | O visualizador funciona e as fotografias continuam acessíveis                                                                     |
| Dispositivo Apple compatível | Se oferecer realidade aumentada, o [Quick Look](https://developer.apple.com/quick-look-gallery/) abre e permite regressar à ficha |

Se ainda não tem o ficheiro, siga o [guia para criar um modelo 3D](/pt/guias/como-criar-um-modelo-3d). O [guia sobre modelos 3D para lojas online](/pt/guias/modelos-3d-para-ecommerce) explica como usar o ficheiro na loja.

## FAQ

### Todos os temas da Shopify mostram modelos 3D?

Consulte a documentação da Shopify para confirmar se o seu tema suporta ficheiros 3D e verifique a versão instalada. Uma ficha de produto personalizada pode precisar de alterações. Teste um rascunho num telemóvel e confirme que consegue passar da fotografia para o modelo e voltar à galeria.

### Devo carregar um ficheiro GLB ou USDZ?

A Shopify aceita ambos os formatos. Escolha o ficheiro cuja orientação e materiais verificou num visualizador e guarde o original para poder corrigi-lo mais tarde. Depois do processamento, compare o modelo na loja com o ficheiro original e verifique o tempo de carregamento num telemóvel.

### Devo pôr o modelo na primeira posição da galeria?

Deixe uma fotografia nítida em primeiro lugar e coloque o modelo numa posição fácil de encontrar. Abra-o num telemóvel, rode a peça e confirme que os controlos do visualizador funcionam. Depois volte às fotografias e veja se as consegue consultar sem recarregar a ficha.
