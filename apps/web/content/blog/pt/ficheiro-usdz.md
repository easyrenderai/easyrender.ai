---

group: usdz-file
title: "O que é um ficheiro USDZ? O AR Quick Look no iPhone"
description: "Um ficheiro USDZ é o formato 3D que o iPhone e o iPad abrem em RA: o que tem dentro, como o abrir e criar, e porque pode surgir com o tamanho errado."
date: 2026-11-17
updated: 2026-11-15
keyword: ficheiro usdz
author: Jorge Rodríguez
authorType: person
cta: Escolha uma fotografia nítida de uma peça, uma mesa de apoio em carvalho ou um candeeiro de pé, e veja todos os ângulos antes de gastar um crédito.
---

Um ficheiro USDZ reúne um modelo 3D no formato Universal Scene Description (USD) da Pixar e as suas texturas num zip sem compressão. O iPhone e o iPad abrem-no no AR Quick Look, a partir do Safari, dos Ficheiros, do Mail ou das Mensagens, para ver o objeto em realidade aumentada (RA). O Android não o abre de forma nativa.

## O que há dentro de um ficheiro USDZ?

O USD é o formato de cena que a Pixar criou para a produção de cinema. A [especificação USDZ](https://openusd.org/release/spec_usdz.html) descreve um ficheiro zip sem qualquer compressão, com as camadas USD e as imagens que usam, organizado para que o aparelho as leia diretamente, sem extrair nada.

A Apple [apresentou o USDZ com o ARKit 2](https://www.apple.com/newsroom/2018/06/apple-unveils-arkit-2/) na WWDC de junho de 2018, para o iOS 12, juntamente com o AR Quick Look. Desde então, é o formato que os aparelhos Apple esperam para a realidade aumentada a partir de uma página web ou de uma mensagem.

## Como se abre um ficheiro USDZ?

Depende do aparelho:

- iPhone e iPad: toque no ficheiro no Safari, na aplicação Ficheiros, no Mail ou nas Mensagens. O Quick Look abre-o com uma vista de objeto e uma vista de RA.
- Mac: selecione-o no Finder e carregue na barra de espaços para uma pré-visualização Quick Look.
- Windows e Android: não há visualizador integrado. O [Blender 3.5 e versões posteriores](https://developer.blender.org/docs/release_notes/3.5/pipeline_assets_io/) importam USDZ, por isso pode abri-lo aí.

Se precisar do mesmo modelo no Android ou num navegador, use a versão GLB. [O que é um ficheiro GLB](/pt/guias/ficheiro-glb) trata desse lado.

<!-- IMAGE PENDING: uma captura real de iPhone com um USDZ do easyrender (por exemplo, a poltrona em bouclé) aberto na vista de objeto do Quick Look, sem retoques. Não a vista de RA enquanto a RA não for testada no aparelho (REQ-00). De preferência com o iPhone em português. -->

## Como funciona o AR Quick Look numa página web?

A página liga ao USDZ com `rel="ar"` à volta de uma imagem de pré-visualização, e o Safari junta a essa imagem um pequeno ícone de RA. O [guia do WebKit](https://webkit.org/blog/8421/viewing-augmented-reality-assets-in-safari-for-ios/) mostra o código. Ao tocar na imagem, o modelo abre-se na divisão, sem instalar nenhuma aplicação.

O componente open source [model-viewer](https://modelviewer.dev/), da Google, trata dos dois sistemas com um só excerto de código: mostra um GLB na página e entrega ao iPhone um USDZ para o Quick Look.

A visualização em RA serve para observar o aspeto da peça. Não substitui as medidas tiradas no objeto e indicadas na ficha do produto.

## Como se cria um ficheiro USDZ?

O Reality Converter da Apple, uma aplicação gratuita para Mac, [converte ficheiros como OBJ, glTF, FBX e USD](https://developer.apple.com/videos/play/wwdc2022/10141/) em USDZ e deixa verificar os materiais antes de exportar. O Blender 3.5 e versões posteriores exportam USDZ diretamente.

Se partir de uma fotografia, algumas ferramentas de image-to-3D exportam o USDZ juntamente com o GLB, dispensando a conversão. Os passos estão em [como criar um modelo 3D a partir de uma fotografia](/pt/guias/criar-um-modelo-3d-a-partir-de-fotografias).

O easyrender entrega os dois ficheiros em cada modelo pronto. A realidade aumentada está incluída: pode abrir a peça no telemóvel e vê-la na sua casa. O modelo mostra a forma e os materiais, não as dimensões reais.

## Um exemplo: uma mesa de apoio em carvalho num iPhone

Envie a si próprio, pelas Mensagens, o USDZ de uma mesa de apoio em carvalho e toque nele. O Quick Look abre primeiro a vista de objeto, onde o roda com um dedo. Passe para a RA, aponte a câmara para o chão, e a mesa aparece no sítio onde tocar.

Ande à volta dela e repare onde as pernas tocam no chão. Um modelo com a base ligeiramente desalinhada parece flutuar.

![Mesa redonda de madeira maciça como modelo 3D num visualizador, que pode ser rodada para conferir as pernas de todos os lados](/showcase/coffee-table.glb "Uma mesa redonda de madeira maciça que o easyrender modelou a partir de uma fotografia, mostrada aqui a partir do GLB. O easyrender cria o USDZ para descarregar a partir deste mesmo GLB, no seu navegador. Rode-a e veja onde as pernas tocam no chão.")

Depois confira o aspeto do veio da madeira sob a luz mais quente de um candeeiro, diferente da luz de estúdio da fotografia original.

## Do GLB ao USDZ: deve guardar os dois?

Os dois, se o modelo se destinar a uma ficha de produto. O GLB cobre a web e o Android, e o USDZ cobre a RA nos aparelhos Apple. A Shopify, por exemplo, aceita os dois como multimédia do produto.

O [guia sobre como criar um modelo 3D](/pt/guias/como-criar-um-modelo-3d) explica de onde vêm os dois ficheiros, seja qual for o método. Para uma loja, [modelos 3D para ecommerce](/pt/guias/modelos-3d-para-ecommerce) explica que produtos compensam.

## Perguntas frequentes

### Pode abrir um ficheiro USDZ no Android?

Não de forma nativa, porque a RA do Android usa o Scene Viewer da Google, que lê ficheiros glTF e GLB, não USDZ. Para mostrar o mesmo modelo no Android, use uma versão GLB. Se só tiver o ficheiro da Apple, o Blender 3.5 ou posterior importa o USDZ e exporta um GLB, mas convém conferir os materiais a seguir.

### Pode converter um USDZ em GLB?

Sim: importe o USDZ no Blender 3.5 ou posterior e exporte-o como glTF 2.0, no formato binário GLB. Confira o resultado num visualizador, porque o USD e o glTF descrevem as superfícies de forma diferente e algumas definições de material, como o verniz de uma madeira lacada, podem não passar exatamente iguais de um formato para o outro.

### A visualização em RA substitui as medidas da peça?

Não: use a RA para observar o aspeto de um objeto numa divisão. Um modelo gerado a partir de uma fotografia não permite obter as dimensões da peça. Consulte as medidas tiradas diretamente no objeto e indicadas na ficha do produto antes de decidir onde o colocar.

### O USDZ é o mesmo que o USD?

O USDZ reúne os ficheiros de uma cena USD num único pacote. Uma cena USD pode ser um ficheiro de texto (.usda), um ficheiro binário (.usdc) ou vários ficheiros interligados. O USDZ junta as camadas e as texturas num zip sem compressão, fácil de enviar por mensagem e de abrir num iPhone.

### O Blender exporta ficheiros USDZ?

Sim, desde o Blender 3.5. Use Ficheiro, Exportar, Universal Scene Description e dê ao ficheiro a extensão .usdz. Confira a exportação no Quick Look de um Mac ou de um iPhone, porque algumas configurações de material do Blender não passam para USD e podem ficar mais planas ou com outra cor do que na vista do programa.
