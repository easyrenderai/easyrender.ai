---

group: 3d-models-for-ecommerce
title: "Modelos 3D para ecommerce: como as lojas os obtêm"
description: "Modelos 3D para ecommerce: o que acrescentam à ficha, de que ficheiros a loja precisa (GLB e USDZ), quatro formas de os obter e os limites a conhecer."
date: 2026-11-13
updated: 2026-11-15
keyword: modelos 3d para ecommerce
author: Jorge Rodríguez
authorType: person
cta: Experimenta com uma poltrona ou um aparador. Revê as vistas geradas antes de decidires se o modelo 3D compensa para a tua loja.
---

Um modelo 3D para ecommerce é um ficheiro, em geral GLB ou USDZ, que o cliente roda no ecrã e, no telemóvel, coloca na sala com realidade aumentada. As lojas obtêm-no de quatro formas: com um artista 3D, com os ficheiros CAD do fabricante, com uma digitalização do produto ou com IA a partir de uma só fotografia.

## O que acrescenta um modelo 3D a uma ficha de produto?

Uma fotografia mostra a vista que alguém escolheu. Um modelo 3D deixa o cliente escolher: as costas de uma estante, a parte de baixo de uma mesa de centro, o volume da almofada de uma poltrona.

![Poltrona giratória estofada em cinzento, na fotografia de catálogo, vista de trás a três quartos](/showcase/swivel-chair.jpg "A fotografia de catálogo: uma só vista, de trás, escolhida pelo fotógrafo.")
![A mesma poltrona giratória cinzenta como modelo 3D num visualizador, que o cliente pode rodar para ver a frente e o assento](/showcase/swivel-chair.glb "O modelo que o easyrender construiu a partir dessa fotografia: é o cliente que escolhe a vista. A frente é uma previsão, porque a fotografia só mostra as costas.")

No iPhone e no iPad, um ficheiro USDZ abre-se no [AR Quick Look](https://developer.apple.com/augmented-reality/quick-look/) e coloca o objeto na divisão através da câmara. No Android, o [Scene Viewer](https://developers.google.com/ar/develop/scene-viewer) da Google faz o mesmo com um GLB.

A realidade aumentada mostra o aspeto de uma peça numa divisão. Um modelo gerado a partir de uma fotografia não permite obter as dimensões do objeto. Por isso, indique no texto do produto as medidas tiradas diretamente na peça.

## Como medir se o 3D compensa?

Decida o que quer que o 3D mude antes de pagar um modelo. Pode avaliar as perguntas antes da compra sobre as costas e a profundidade, a interação com o visualizador e as adições ao carrinho nas fichas com modelo.

Não publicamos resultados de conversão nem de devoluções associados ao 3D, porque não dispomos de medições que os sustentem. Trate qualquer número que leia como uma afirmação a testar no seu próprio catálogo, com um método como este.

Escolha cinco a dez produtos que vão ter modelo e um grupo equivalente de produtos parecidos que não vão ter. Mantenha preços, fotografias e textos iguais nos dois grupos durante quatro a seis semanas. Depois compare as adições ao carrinho por visualização de produto entre os dois grupos e analise a interação com o visualizador.

No seu próprio sítio, o [model-viewer](https://github.com/google/model-viewer/blob/master/packages/model-viewer/src/features/ar.ts) dispara eventos que pode enviar para a sua ferramenta de análise. Um evento `camera-change` com origem `user-interaction` quer dizer que o cliente rodou o modelo. O evento `ar-status` indica uma sessão de RA a começar ou a falhar, e `quick-look-button-tapped` dispara quando um iPhone passa para o Quick Look.

## De que ficheiros precisa uma loja para ter 3D?

GLB para a web e para Android, USDZ para realidade aumentada nos aparelhos Apple. Quase todas as plataformas com suporte para 3D aceitam um dos dois, ou ambos.

<!-- IMAGE PENDING: versão pt-PT do esquema «Um modelo de produto» (componente do site). GLB: ficha de produto em qualquer browser, num visualizador como o model-viewer; RA no Android, Scene Viewer da Google. USDZ: RA no iPhone e no iPad, AR Quick Look da Apple. A Shopify aceita os dois ficheiros como multimédia do produto. Pie: «Um modelo, dois ficheiros, três sítios onde o cliente o encontra. Num sítio feito por si, o model-viewer serve os dois.» -->

### Modelos 3D na Shopify

A [Shopify aceita modelos 3D como multimédia do produto](https://help.shopify.com/en/manual/products/product-media/product-media-types), em GLB ou USDZ, até 500 MB, no mesmo sítio onde se acrescentam as fotografias. Um ficheiro com mais de 15 MB tem a geometria e as texturas otimizadas no carregamento. A Shopify converte cada modelo para que existam sempre uma versão GLB e uma USDZ.

### WooCommerce e sítios à medida

As lojas WooCommerce acrescentam 3D através de extensões, como o [Arty 3D Viewer](https://woocommerce.com/products/arty-3d-viewer/) do marketplace do WooCommerce. Num sítio feito por si, o componente open source [model-viewer](https://modelviewer.dev/), da Google, mostra um GLB, e `ar-modes="webxr scene-viewer quick-look"` dá a cada telemóvel o seu próprio visualizador de RA.

### Que peso deve ter o modelo de um produto?

A Shopify aceita ficheiros grandes, mas ficheiros pesados podem dificultar a navegação no telemóvel. O Scene Viewer publica recomendações técnicas concretas, por isso comparamos com ele os nossos próprios ficheiros.

| Critério            | O Scene Viewer recomenda                        | Os seis modelos da nossa montra |
| ------------------- | ----------------------------------------------- | ------------------------------- |
| Triângulos          | Até 100.000, idealmente 30.000 a 50.000         | 14.590 a 69.910                 |
| Textura             | No máximo 2048 x 2048                           | Uma textura de 1024 x 1024 cada |
| Materiais           | Até 10                                          | Um cada                         |
| Tamanho do ficheiro | 10 MB; modelos maiores podem dar má experiência | 308.448 a 1.287.432 bytes       |

O Scene Viewer também lista as extensões glTF que suporta. Um ficheiro que dependa de uma fora dessa lista, como texturas WebP, pode não abrir, por isso um GLB para RA no Android fica mais seguro com texturas PNG ou JPEG. Abra-o num telemóvel Android real antes de o ligar a uma ficha de produto.

## Formas de criar modelos 3D de produto

São quatro. Avaliamo-las por quatro critérios: se precisa do produto à mão, quanto do seu tempo levam, até que ponto os lados escondidos são fiéis e onde falham.

### Contratar um artista 3D

Um artista constrói o modelo a partir das suas fotografias, desenhos e medidas. Não precisa do produto à mão, é o que mais tempo leva entre o briefing e a entrega e dá o resultado mais fiel, porque pode trabalhar com referências de todos os lados. Os orçamentos no Fiverr ou no Upwork variam com a complexidade da peça.

Veredicto: o caminho certo quando o modelo tem de ser exato, como um sofá vendido em três larguras, ou para o produto principal de uma campanha.

### Usar os ficheiros CAD do fabricante

Se vende peças desenhadas por si, a fábrica pode já ter ficheiros CAD ou SketchUp. A forma é exata, mas raramente estão prontos para a web: em geral precisam de texturas reais e de muito menos triângulos antes de carregarem bem num telemóvel.

Veredicto: vale a pena pedi-los primeiro se os desenhos forem seus. Conte com a limpeza, porque um ficheiro de fábrica pode ter muito mais pormenor do que os 100.000 triângulos do Scene Viewer.

### Digitalizar o produto

Aplicações de fotogrametria como a Polycam e o [RealityScan](https://dev.epicgames.com/documentation/realityscan-mobile/realityscan-step-by-step-guide) constroem um modelo a partir de muitas fotografias sobrepostas. O RealityScan começa a processar a partir de 20 imagens e aceita até 300. Precisa da peça à mão e de espaço para andar à volta dela.

Veredicto: uma opção adequada para peças com textura que tem no armazém, como uma cadeira de rotim ou um aparador de carvalho. Falha em vidro, espelhos e metal polido.

### Gerá-lo com IA a partir de uma fotografia

Ferramentas de image-to-3D como o Meshy, o Tripo e o easyrender partem de uma única imagem. É o único caminho quando tem a fotografia do fornecedor e não tem acesso à peça. A fotografia só mostra um lado, por isso confira as costas na pré-visualização antes de ficar com o modelo.

![Nove vistas de um vaso de grés mate, desenhadas a partir de uma fotografia de produto](/showcase/vase-angles.jpg "Uma folha de ângulos que o easyrender desenhou a partir de uma fotografia de um vaso de grés, sem retoques. Objetos redondos e mate como este são o caso fácil.")

Veredicto: o caminho para um catálogo feito de fotografias de fornecedores. Logótipos finos, tramas abertas e um lado que a fotografia nunca mostrou são mais difíceis de ler numa só imagem. Cada caminho, com o que precisa e onde falha, está em [como criar um modelo 3D](/pt/guias/como-criar-um-modelo-3d).

Contratar alguém ou partir de uma fotografia compara-se em [contratar um modelador 3D ou usar IA](/pt/comparacoes/modelador-3d-ou-ia). Duas das ferramentas são analisadas em [Meshy](/pt/comparacoes/meshy) e [Tripo](/pt/comparacoes/tripo).

## Modelos 3D para lojas de mobiliário: por onde começar

Ordene os seus produtos antes de fazer um único modelo. Avalie cada um com quatro perguntas: se as costas ou a profundidade importam, se o preço é alto o suficiente para o cliente hesitar, se lhe pedem mais ângulos e se as mensagens dos clientes revelam dúvidas sobre o aspeto.

Comece pelos cinco em que mais respostas forem afirmativas. Em geral são uma poltrona, um aparador ou um candeeiro de pé cuja cúpula tenha uma forma distinta. Os artigos planos, como uma gravura emoldurada ou um tapete, ganham pouco com o 3D.

Depois teste os caminhos antes de se comprometer. Passe um produto por dois deles, por exemplo uma digitalização com o telemóvel e um modelo de image-to-3D do mesmo candeeiro de mesa, e compare-os num telemóvel. Isso diz mais do que qualquer lista de funcionalidades.

Para um catálogo grande, veja as opções em lote e o preço por modelo. O easyrender permite carregar um conjunto de fotografias de catálogo na sua biblioteca, ver uma pré-visualização grátis de cada uma e gerar só as que estão certas.

## Como acrescentar 3D a uma loja, passo a passo?

Esta é a ordem que seguiríamos num primeiro lote:

1. Escolha cinco produtos com as quatro perguntas acima.
2. Faça cada modelo pelo caminho que lhe serve.
3. Confira cada modelo: o número de pernas e portas, as costas, a textura em ecrã inteiro.
4. Ajuste cada ficheiro aos limites recomendados: texturas de 2048 píxeis ou menos, geometria comprimida se o visualizador o suportar.
5. Carregue-o com as ferramentas da própria plataforma, como a multimédia de produto da Shopify.
6. Abra cada página num iPhone e num telemóvel Android com dados móveis e experimente a RA nos dois.
7. Meça durante quatro a seis semanas, como descrito acima, e depois decida o lote seguinte.

## Um exemplo: um aparador em nogueira

Considere uma loja com três fotografias de fornecedor de um aparador em nogueira: frente, três quartos e um pormenor dos puxadores em latão. A fotografia a três quartos é a que deve usar no image-to-3D, porque mostra a profundidade e um painel lateral.

<!-- IMAGE PENDING: versão pt-PT do desenho do exemplo (componente do site). Pie: «Das três fotografias do fornecedor, só a de três quartos mostra o painel lateral, por isso a ferramenta tem menos profundidade para adivinhar. Desenho para este exemplo, não um anúncio real.» -->

Verifique se as portas, as pernas e o veio da madeira foram bem reproduzidos. Confira os puxadores em latão com a fotografia de pormenor, porque as ferragens pequenas são o primeiro sítio onde qualquer método perde pormenor, e olhe de perto para as costas, que a ferramenta nunca viu.

Depois carregue o GLB com as ferramentas da sua plataforma e abra a página num iPhone e num telemóvel Android antes de publicar. Na Shopify, o USDZ para o iPhone é criado automaticamente a partir do mesmo carregamento.

## O que corre mal quando uma loja acrescenta 3D?

A maior parte dos problemas só aparece num telemóvel real, e é para isso que existe o passo 6. Estes são os que deve procurar, com a solução de cada um.

| Sintoma                                                 | Causa                                                                       | Solução                                                                                                                                                                |
| ------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Não aparece o botão de RA num telemóvel Android         | O Scene Viewer só carrega ficheiros por HTTPS, ou o telemóvel não o suporta | Sirva o GLB por HTTPS e teste num segundo telemóvel                                                                                                                    |
| Não há RA num iPhone a partir do seu sítio              | Falta o USDZ, ou é servido com o tipo de conteúdo errado                    | Acrescente o USDZ e sirva-o como `model/vnd.usdz+zip`, o tipo que o [Safari procura](https://webkit.org/blog/8421/viewing-augmented-reality-assets-in-safari-for-ios/) |
| A visualização em RA não permite confirmar as dimensões | O modelo foi gerado a partir de uma fotografia                              | Indique no texto as medidas tiradas diretamente na peça                                                                                                                |
| A peça flutua acima do chão                             | A base do modelo está acima da origem                                       | Mude a origem para a base no Blender antes de exportar                                                                                                                 |
| A página fica lenta com dados móveis                    | Texturas de 4096 píxeis ou geometria sem compressão                         | Texturas de 2048 ou 1024, e compressão Draco ou Meshopt onde o visualizador a suporte                                                                                  |
| O modelo parece escuro ou sujo em RA                    | Sombras pintadas na textura, que o Scene Viewer desaconselha                | Use uma textura sem sombras e ponha Metallic a 0 se o material não o definir                                                                                           |
| O GLB não abre no Scene Viewer                          | Usa uma extensão glTF que o Scene Viewer não lista, como texturas WebP      | Exporte uma versão simples com texturas PNG ou JPEG                                                                                                                    |

## Quais são os limites dos modelos 3D no ecommerce?

Um modelo gerado a partir de uma fotografia mostra a forma e os materiais, não as medidas. Mantenha as dimensões no texto do produto e use a RA apenas para observar o aspeto da peça.

Os produtos transparentes e refletores, como um jarro de vidro ou um candeeiro cromado, são difíceis para todos os métodos. Letras pequenas e logótipos miúdos podem ficar pouco nítidos.

O 3D não substitui as fotografias. As plataformas continuam a usar imagens fixas nos resultados de pesquisa, nos anúncios e nas grelhas de categoria, por isso as bases da [fotografia de produto para ecommerce](/pt/guias/fotografia-de-produto-para-ecommerce) continuam a valer.

## Perguntas frequentes

### Preciso de modelos 3D na minha loja online?

Não em todos os produtos: o 3D ajuda mais onde o cliente quer ver a profundidade e as costas, como cadeiras, sofás, aparadores e candeeiros. Para artigos planos ou muito simples, boas fotografias chegam. Comece por um punhado de produtos em que os clientes pedem mais ângulos e decida a partir daí, sem converter tudo de uma vez.

### De que formato de ficheiro 3D precisa uma loja online?

De dois, na maioria dos casos: GLB para a web e para RA no Android, e USDZ, o formato que o iPhone e o iPad abrem no AR Quick Look. A Shopify aceita qualquer um e converte cada modelo para que existam as duas versões. Se só tiver um, o Blender ou o Reality Converter da Apple fazem o outro.

### Que tamanho deve ter o ficheiro de um modelo 3D de produto?

O suficiente para um telemóvel com dados móveis. O Scene Viewer da Google recomenda no máximo 10 MB, 100.000 triângulos e texturas de 2048 píxeis, com 30.000 a 50.000 triângulos como ideal. A Shopify aceita ficheiros até 500 MB e otimiza os que passam de 15 MB, mas um ficheiro mais leve carrega sempre mais depressa.

### Quanto custa um modelo 3D para ecommerce?

Depende do caminho. Os artistas orçamentam por modelo, segundo a complexidade, as aplicações de digitalização costumam cobrar uma subscrição e as ferramentas de IA cobram por modelo ou por mês. No easyrender a pré-visualização é grátis e um modelo pronto custa {{renderCredits}} créditos ({{renderPrice}}); os créditos compram-se conforme as necessidades ou vêm no Pro, {{proCredits}} por mês por {{proPrice}}.

### O cliente pode ver um produto 3D em RA?

Pode vê-lo em RA na maioria dos telemóveis recentes: o iPhone e o iPad usam o AR Quick Look com USDZ, e o Android usa o Scene Viewer com GLB. A visualização permite observar o aspeto da peça, mas um modelo gerado a partir de uma fotografia não substitui as medidas tiradas no objeto e indicadas na ficha.
