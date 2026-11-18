---

group: how-to-make-a-3d-model-from-photos
title: Como criar um modelo 3D a partir de uma fotografia
description: Que fotografia usar, como verificar os lados que a câmara não viu, que ficheiros obtém e os limites de um modelo 3D feito a partir de uma fotografia.
date: 2026-11-11
updated: 2026-11-15
keyword: modelo 3d a partir de foto
author: Jorge Rodríguez
authorType: person
cta: Escolhe uma fotografia nítida do teu catálogo e verifica gratuitamente as vistas do produto antes de criares o modelo 3D.
---

Para criar um modelo 3D a partir de uma fotografia, basta um disparo nítido de um único objeto e uma ferramenta de image-to-3D, que deduz os lados que a câmara não viu. A alternativa é a fotogrametria, que pede pelo menos 20 fotografias sobrepostas, tiradas à volta da peça. Em ambos os casos, a fotografia decide quase tudo.

## Uma fotografia ou muitas?

O número de fotografias depende de uma pergunta: tem o objeto à sua frente? A fotogrametria e a digitalização LiDAR precisam dele ali. O image-to-3D só precisa de uma imagem, e por isso é o caminho quando só tem a fotografia que o fornecedor enviou de um aparador em que nunca tocou.

A fotogrametria junta fotografias sobrepostas num modelo. A [Polycam](https://learn.poly.cam/hc/en-us/articles/27425185907348-How-to-Use-Object-Mode) pede pelo menos 20, com cerca de 70 % de sobreposição, e os objetos com muito pormenor precisam de 100 ou mais. O [RealityScan](https://dev.epicgames.com/documentation/realityscan-mobile/realityscan-step-by-step-guide) começa a analisar a partir de 20 imagens, aceita até 300 e pede círculos e arcos a várias alturas.

O LiDAR, num iPhone Pro ou num iPad Pro, mede a profundidade enquanto anda à volta da peça. É rápido em formas grandes e simples, mas perde pormenores finos, como os balaústres torneados de uma cadeira.

<!-- IMAGE PENDING: versão pt-PT do diagrama «Fotogrametria / Image-to-3D» que a página EN mostra aqui (componente do site, não markdown). Textos: «Precisa de: o objeto à sua frente · 20 a 100+ fotografias sobrepostas» / «Precisa de: uma fotografia, mesmo a do fornecedor · verifique as costas na pré-visualização». Pie: «Contagens de fotografias segundo o guia do modo objeto da Polycam.» -->

A escolha depende do que tem disponível:

- Só tem a fotografia do fornecedor e a peça está num armazém no estrangeiro: image-to-3D, porque é o único método que consegue começar.
- A peça está no seu armazém, tem uma superfície com textura, como carvalho ou linho, e há uma hora livre: fotogrametria. Regista a superfície real em vez de a deduzir.
- Uma peça grande e lisa, como um sofá de três lugares, com um iPhone Pro à mão: LiDAR. É rápido, e aqui a forma conta mais do que o tecido.
- Vidro, espelho ou cromado polido: nenhum funciona bem, porque todos leem os reflexos como se fossem superfície.

As vantagens e desvantagens de muitas fotografias face a uma só estão em [software de fotogrametria ou IA a partir de uma fotografia](/pt/comparacoes/software-de-fotogrametria).

## Como funciona o image-to-3D?

As ferramentas seguem um de dois caminhos. Algumas passam diretamente da fotografia ao modelo. Outras desenham primeiro o objeto de vários ângulos e só depois constroem o modelo a partir dessas vistas, o que dá mais informação sobre os lados escondidos.

O easyrender segue o segundo caminho. Escolhemo-lo depois de um teste A/B com anúncios reais. Esse teste usou um modelo de imagem maior para a folha de ângulos; hoje a folha é desenhada por um modelo mais barato, que ainda não testámos da mesma forma.

A primeira fase é a folha de ângulos: uma imagem quadrada, dividida numa grelha de 3 por 3.

Oito células mostram o objeto de vários lados, em intervalos de 45 graus, da frente até à frente-esquerda. A nona mostra uma vista de cima. Todas têm fundo branco, luz suave e o objeto inteiro ao centro.

A segunda fase lê a sua fotografia e essas nove vistas e constrói uma única malha, a estrutura geométrica do modelo, com textura.

<!-- IMAGE PENDING: versão pt-PT do esquema de 5 passos (componente do site). 1 Uma fotografia · 2 Folha de ângulos · 3 Verifica-a (costas, lados e topo) · 4 Gerar o modelo · 5 GLB e USDZ. Pie: «No easyrender, a folha de ângulos é uma pré-visualização grátis, e os créditos só se gastam no passo 4, se decidir gerar o modelo.» -->

A previsão acerta na forma geral e na cor e falha no que uma fotografia não mostra, como as partes escondidas por uma trama aberta. Também se apoia muito na simetria.

As nossas instruções por predefinição pedem ao modelo que deduza um lado escondido com prudência, a partir da construção visível, e que nunca invente logótipos, texto ou decoração.

Para mobiliário juntamos regras próprias, escritas a partir dos testes: manter o número exato de pernas, braços, almofadas e gavetas, e manter o sentido do veio da madeira e das costuras. Os outros caminhos até um modelo comparam-se em [como criar um modelo 3D](/pt/guias/como-criar-um-modelo-3d).

## Passo 1: escolha a fotografia certa

A melhor fotografia mostra o objeto inteiro, nítido, com luz suave e uniforme, sobre um fundo simples. Nada o deve tapar: nem uma almofada no braço, nem uma planta à frente de uma perna.

Para mobiliário, um enquadramento a três quartos mostra mais informação do que uma fotografia de frente. De frente, a fotografia de uma poltrona esconde a profundidade do assento. A três quartos vê-se a frente e um lado ao mesmo tempo, pelo que a ferramenta tem menos informação para deduzir.

![Poltrona em bouclé com estrutura de tubo de aço, fotografada a três quartos sobre fundo branco](/showcase/armchair.jpg "Uma boa fotografia de partida: a poltrona inteira, a três quartos, sobre fundo simples.")

O ficheiro tem de ser JPEG, PNG ou WebP, com menos de 4 MB.

A resolução também tem um mínimo. A nossa verificação no carregamento rejeita uma fotografia cujo lado mais curto tenha menos de 400 píxeis e avisa abaixo de 800. Rejeita ainda imagens mais de quatro vezes mais largas do que altas e imagens com tons tão uniformes que provavelmente estão em branco.

Acima desse mínimo, a nitidez conta mais do que o número de píxeis, por isso fazemos também uma verificação de desfocagem numa cópia pequena de cada imagem. Pode testar a sua fotografia a olho: amplie a 100 % no rebordo de uma perna. Se aí não se vir o veio ou a trama, o modelo também não os terá.

Antes de carregar, confira a fotografia com esta lista:

- A peça está inteira no enquadramento, com margem em todos os lados e nada cortado nos pés.
- A câmara estava a meia altura da peça, não a olhar de cima, à altura de quem está de pé.
- Os contornos estão nítidos à resolução original, não só no ecrã do telemóvel.
- A luz é uniforme, sem uma sombra dura a cortar o objeto.
- O fundo é simples: uma parede, um fundo de papel ou um chão limpo.
- Há um só objeto na fotografia, não uma divisão decorada.

## Passo 2: retire o que não faz parte do objeto

Um fundo carregado é a forma mais fácil de obter um modelo errado. A ferramenta pode ler o padrão de um tapete como parte da base de uma mesa, ou fundir um candeeiro de pé com a cortina que está atrás.

Se a única fotografia for de ambiente, recorte-a rente à peça, com uma pequena margem em todos os lados. Um aparador comprido pode ficar largo, até quatro vezes mais largo do que alto. Acima disso, a nossa verificação pede uma fotografia que mostre o produto inteiro.

Os recortes ajudam, com um senão. Uma ferramenta de remoção de fundo pode deixar um halo claro nos contornos, que pode ser interpretado como parte do objeto. Confira o contorno à resolução original antes de carregar.

As sombras também contam como fundo. Uma sombra dura debaixo de uma mesa de centro pode transformar-se numa placa escura colada às pernas, por isso vale a pena esperar por uma luz suave, de dia nublado.

## Passo 3: veja a pré-visualização de todos os ângulos

As boas ferramentas de image-to-3D mostram o objeto de vários lados antes de construírem o modelo final. Olhe com atenção para as costas e para os lados que não aparecem na fotografia.

Leia a folha como uma prova de contacto. Conte as pernas, as portas e as gavetas em todas as células, não só na da frente. Depois compare células opostas, como a frente-direita com a traseira-esquerda: uma cadeira cujos braços mudam de forma entre elas pode ficar deformada.

A vista de cima permite detetar falhas que as outras vistas escondem. Uma cúpula redonda que de cima fica oval, ou um tampo mais largo numa ponta, são mais fáceis de identificar nessa vista.

![Nove vistas da mesma poltrona em bouclé, de frente, de lado, de trás e de cima, desenhadas a partir da fotografia anterior](/showcase/armchair-angles.jpg "A folha de ângulos grátis que o easyrender desenhou a partir dessa fotografia, sem retoques. As costas e a vista de cima são previsões.")

Algumas falhas são detetadas automaticamente. As nossas verificações rejeitam uma folha com menos de 768 píxeis, uma folha em que o objeto falta em mais de duas células e outra em que mais de três das oito vistas à volta são quase cópias umas das outras.

Esta última verificação nasceu dos testes. Em cópias pequenas a preto e branco, duas vistas realmente diferentes de um objeto diferem 3 % ou mais, e uma vista repetida menos de 1 %. Uma folha que cola a fotografia em todas as células não fornece informação adicional para reconstruir o objeto.

A contagem dos elementos precisa de uma verificação humana. Conte as portas, as gavetas e as pernas em cada célula e compare com a peça real antes de gerar o modelo. Se a pré-visualização estiver errada, mude de fotografia ou acrescente uma nota, em vez de repetir com a mesma imagem.

O easyrender aceita uma nota curta com cada fotografia, para o que a imagem esconde: «quatro portas», «costas abertas», «puxadores em latão». A folha acima é um resultado real do easyrender a partir da fotografia do passo 1. A pré-visualização é grátis, duas por dia sem créditos, e só gasta créditos se gerar o modelo.

A imagem acima é um exemplo final. A pré-visualização gratuita tem uma marca de água. [Carregar uma fotografia](/pt#try)

## Passo 4: gere o modelo e descarregue os ficheiros

Quando a forma lhe parecer correta, a ferramenta constrói um modelo 3D com texturas. Quase todas exportam GLB, o formato padrão para a web e para Android. Muitas dão também USDZ, o formato que o iPhone e o iPad abrem no AR Quick Look.

O nosso processo pede uma textura de 2048 píxeis e devolve uma só malha com um só material, colorido por uma imagem de cor base. Uma malha e um material são o caso mais simples para qualquer visualizador, e ficam muito abaixo dos 10 materiais que o Scene Viewer recomenda como máximo.

Os seis modelos da nossa montra vão de 14.590 triângulos, num vaso de barro, a 69.910, numa mesa de cabeceira com gavetas. Todos ficam abaixo dos 100.000 triângulos que o [Scene Viewer da Google](https://developers.google.com/ar/develop/scene-viewer) recomenda como máximo.

![A poltrona em bouclé como modelo 3D com textura, construída a partir da fotografia do passo 1 e mostrada num visualizador 3D](/showcase/armchair.glb "O modelo que o easyrender construiu a partir dessa fotografia e da folha de ângulos, com o estofo e o aço ajustados à fotografia original e as texturas comprimidas para esta página: 25.879 triângulos, 608 KB. Arraste para o rodar e verificar as costas, e veja o tecido com luz neutra antes de publicar.")

Um GLB abre-se no Blender (Ficheiro, Importar, glTF 2.0) e em visualizadores gratuitos no navegador, como a [Babylon.js Sandbox](https://sandbox.babylonjs.com/). No Blender, ative as Estatísticas nas sobreposições da vista para ler o número de triângulos. Abra o ficheiro uma vez antes de o usar e rode-o devagar.

O easyrender entrega os dois ficheiros em cada modelo pronto. O USDZ é convertido a partir do GLB no seu navegador, ao descarregar, por isso os dois representam o mesmo modelo.

A realidade aumentada chega em breve. Use-a para observar o aspeto da peça e mantenha as medidas tiradas no objeto na ficha do produto.

O que há dentro de cada ficheiro explica-se em [o que é um ficheiro GLB](/pt/guias/ficheiro-glb) e [o que é um ficheiro USDZ](/pt/guias/ficheiro-usdz).

## O que pode correr mal, e como se resolve?

Quase todos os modelos maus vêm da fotografia. Esta é a lista que seguimos, do sintoma à solução.

| Sintoma                                                          | Causa                                                                                                                                                                            | Solução                                                                                               |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Imagem rejeitada por ser pequena                                 | O lado mais curto tem menos de 400 píxeis, em geral uma miniatura ou uma captura de ecrã                                                                                         | Use o ficheiro original da câmara ou do fornecedor, se tiver menos de 4 MB                            |
| Imagem rejeitada por ser estreita                                | É mais de quatro vezes mais larga do que alta, como um recorte de banner                                                                                                         | Recorte rente ao objeto, com margem em todos os lados                                                 |
| Duas pernas da cadeira fundem-se numa só                         | De frente, as pernas de trás escondem-se atrás das da frente                                                                                                                     | Use uma fotografia a três quartos em que as quatro pernas se vejam separadas                          |
| Quatro portas voltam como três                                   | As juntas entre as portas têm pouco contraste                                                                                                                                    | Fotografe com luz rasante na frente, ou escreva «quatro portas» na nota                               |
| As costas parecem iguais à frente                                | A fotografia só mostrava a frente, e as costas seguem essa vista                                                                                                                 | Escreva «costas abertas» ou «costas lisas» na nota, ou use uma fotografia que mostre um canto de trás |
| O rotim ou a palhinha passam a padrão impresso                   | Uma fotografia não consegue ver através dos vazios                                                                                                                               | Aceite-o num visualizador pequeno, ou digitalize a peça com fotogrametria                             |
| O tecido parece mais amarelo ou mais escuro do que na fotografia | A luz do visualizador é diferente da da fotografia, ou o material não define Metallic e aplica-se o valor por predefinição do glTF, totalmente metálico                          | Confira com luz neutra e ponha Metallic a 0 no Blender antes de publicar                              |
| As superfícies parecem facetadas com luz lateral                 | O ficheiro não tem normais de vértice, e os visualizadores calculam normais planas, como exige a [especificação glTF](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) | No Blender, use Shade Smooth e exporte de novo                                                        |

## Como saber se o modelo está pronto a publicar?

Defina os critérios de aceitação antes de avaliar o modelo. Estas são as verificações que usamos, e cada uma tem resposta de sim ou não.

1. As contagens batem certo com o produto: pernas, portas, gavetas, puxadores.
2. As costas e a parte de baixo correspondem à peça real, segundo alguém que a possa observar.
3. A textura aguenta o ecrã inteiro, não só a miniatura.
4. O ficheiro abre num visualizador no navegador, num iPhone e num telemóvel Android.
5. O ficheiro respeita os limites da plataforma onde vai ser usado. A [Shopify](https://help.shopify.com/en/manual/products/product-media/product-media-types) aceita modelos 3D até 500 MB, e o Scene Viewer recomenda 10 MB e 100.000 triângulos.

Um modelo que falhe a verificação 1 ou 2 volta ao passo 1, com outra fotografia ou uma nota. Um modelo que falhe a 5 só precisa de ser comprimido, como explica o guia do GLB.

## O que um modelo feito a partir de uma fotografia não consegue

Não permite obter as dimensões do objeto. Indique na ficha as medidas tiradas diretamente na peça.

Os pormenores finos podem ficar pouco nítidos. Um logótipo pequeno no encosto, puxadores finos em latão ou texto impresso numa caixa raramente sobrevivem. O rotim aberto tende a transformar-se num padrão impresso numa superfície fechada, porque uma fotografia não mostra o que está atrás de cada vazio.

Vidro, espelhos e cromados polidos confundem todos os métodos, fotogrametria incluída, porque a superfície mostra o que a rodeia em vez de si própria. E estas ferramentas modelam um objeto de cada vez, não uma divisão mobilada.

## Perguntas frequentes

### Quantas fotografias são precisas para um modelo 3D?

Uma, para o image-to-3D com inteligência artificial, que deduz os lados que não vê. A fotogrametria mede cada lado, por isso precisa de pelo menos 20 fotografias sobrepostas e, muitas vezes, de 100 ou mais numa peça com pormenor. Mais fotografias dão superfícies mais fiéis, mas só se tiver o objeto à frente e espaço para andar à volta.

### Que resolução deve ter a fotografia?

Pelo menos 800 píxeis no lado mais curto, e mais se os tiver. O easyrender rejeita fotografias com menos de 400 píxeis, avisa abaixo de 800 e verifica a desfocagem. Daí para cima, a nitidez conta mais: amplie a 100 % num rebordo e, se não vir o veio ou a trama, o modelo também não os terá.

### O image-to-3D é o mesmo que a fotogrametria?

Não: a fotogrametria mede o objeto a partir de muitas fotografias reais, por isso cada superfície que mostra foi vista pela câmara. O image-to-3D parte de uma só fotografia, e os lados escondidos são deduzidos dessa imagem. A fotogrametria precisa da peça à mão; o image-to-3D funciona com a fotografia de catálogo de uma peça em que nunca tocou.

### A pré-visualização de uma fotografia em 3D é grátis?

Algumas ferramentas permitem experimentar sem pagar e cobram depois por modelo ou por subscrição. A pré-visualização serve para avaliar a forma antes de gerar o ficheiro final. No easyrender a pré-visualização dos ângulos é grátis, duas por dia sem créditos, e um modelo pronto custa {{renderCredits}} créditos, ou seja {{renderPrice}} a {{creditPrice}} por crédito.

### Pode imprimir em 3D um modelo feito a partir de uma fotografia?

Trate-o como um modelo para ecrãs, não para impressão: a fotografia não mostrou todos os lados e o modelo não guarda medidas, por isso a impressão não corresponderia à peça real. O easyrender exporta GLB e USDZ para a web e para RA, não STL. Para uma peça impressa, modele-a em CAD a partir de medidas reais.
