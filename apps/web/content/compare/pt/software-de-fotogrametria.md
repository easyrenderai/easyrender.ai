---

group: compare-photogrammetry-software
title: "Software de fotogrametria ou IA com uma fotografia?"
description: "Software de fotogrametria ou IA com uma fotografia: RealityScan, Metashape, Meshroom, Polycam e Zephyr, fotos que pedem, preços e quando usar cada um."
date: 2026-11-11
updated: 2026-11-15
keyword: software de fotogrametria
author: Jorge Rodríguez
authorType: person
cta: Se só tens uma fotografia do produto, revê gratuitamente as vistas geradas. Para obteres medidas verificáveis, considera um processo de captura com várias fotografias.
---

<!-- NOTA PARA QUEM CARREGA: rota de destino /pt/comparacoes/software-de-fotogrametria (equivalencias-hreflang.csv). Confirmar o formato de conteúdo das comparativas e o nome do grupo hreflang («compare-photogrammetry-software» é provisório). -->

O software de fotogrametria reconstrói um objeto em 3D a partir de muitas fotografias sobrepostas. Pode usar o RealityScan, o Agisoft Metashape, o Meshroom, a Polycam ou o 3DF Zephyr, desde que tenha acesso à peça. Se só dispõe de uma fotografia de catálogo, precisa de uma ferramenta de IA que deduza os lados escondidos, o chamado image-to-3D.

## Precisa mesmo de software de fotogrametria?

Faça primeiro uma pergunta: consegue andar à volta do objeto? A fotogrametria só mede o que a câmara viu, por isso precisa da peça à mão, de uma tarde livre e de espaço desimpedido. O guia do RealityScan, da Epic, di-lo sem rodeios: o que não aparece em várias imagens não aparece no modelo.

Se a peça está no armazém do fornecedor, ou se tem um catálogo inteiro de fotografias de produto, pode dispor de apenas uma fotografia por peça. É para esse caso que existe a IA a partir de uma fotografia.

O caminho passo a passo, da escolha da fotografia à verificação dos ficheiros, está em [como criar um modelo 3D a partir de uma fotografia](/pt/guias/criar-um-modelo-3d-a-partir-de-fotografias).

## Como funciona o software de fotogrametria?

O programa encontra os mesmos pontos em fotografias sobrepostas, calcula onde estava a câmara em cada uma e depois constrói uma malha, a estrutura geométrica do modelo, e aplica-lhe as texturas obtidas das fotografias. Todas as ferramentas seguem as mesmas regras de captura, porque todas emparelham pontos entre imagens.

1. Escolha um objeto imóvel. O [guia do Object Capture da Apple](https://developer.apple.com/documentation/realitykit/capturing-photographs-for-realitykit-object-capture) desaconselha peças moles ou flexíveis, que mudam de forma quando se mexem, e objetos muito finos, refletores, transparentes ou de uma só cor lisa.
2. Ilumine-o com luz suave. A Apple aponta o flash da câmara, o sol direto e as lâmpadas à vista como problemas; o manual do Meshroom diz para não usar flash. Um dia encoberto resulta.
3. Fixe as definições da câmara. Mantenha fixos o zoom, a abertura, a velocidade e o ISO. Num iPhone, mantenha o dedo premido na imagem até aparecer «Bloqueio AE/AF».
4. Fotografe com muita sobreposição. A Apple pede 70 % ou mais entre disparos vizinhos e avisa que abaixo de 50 % pode falhar. O manual do Meshroom pede pelo menos 60 % de sobreposição lateral e 80 % frontal.
5. Dê a volta ao objeto a várias alturas. O RealityScan pede círculos e arcos a várias alturas, com o objeto a ocupar pelo menos metade de cada imagem.
6. Fotografe a base. A Apple sugere um prato giratório e pousar o objeto sobre lados diferentes, para o modelo não ficar com buracos por baixo.
7. Aplique uma máscara ao fundo e processe as imagens. A aplicação móvel do RealityScan começa a analisar a partir de 20 imagens e para nas 300.

Pegue numa mesa de apoio em teca: três anéis com luz suave e depois uma série da parte de baixo, com a mesa deitada de lado. O veio dá ao programa muitos pontos de referência para emparelhar, e é por isso que a madeira se digitaliza bem.

## Que software de fotogrametria escolher?

As ferramentas diferem menos no método do que no sítio onde correm e na licença. Os preços abaixo são os publicados em novembro de 2026.

| Ferramenta             | Onde corre                                                   | Preço e licença                                                                                                          | Limites de fotografias e notas                                               |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| RealityScan (Epic)     | Aplicação para computador, mais uma aplicação móvel gratuita | Gratuito abaixo de 1 milhão de dólares de faturação nos últimos 12 meses; acima disso, 1.250 dólares por posto e por ano | A aplicação móvel analisa a partir de 20 imagens, com limite de 300          |
| Agisoft Metashape      | Windows, macOS, Linux                                        | Standard 179 dólares, Professional 3.499 dólares, licença perpétua; 30 dias de teste grátis                              | A Standard inclui a geração do modelo e a texturização                       |
| Meshroom (AliceVision) | Windows, Linux                                               | Open source, MPL-2.0                                                                                                     | Acelerado por GPU; o manual pede 60 % de sobreposição lateral e 80 % frontal |
| Polycam                | Aplicação para iPhone e Android                              | Grátis com 10 capturas de fotogrametria; Basic a 150 dólares por ano ou 30 dólares por mês                               | 150 imagens por captura no Free, 300 no Basic                                |
| 3DF Zephyr             | Computador                                                   | Grátis até 50 fotografias; Lite a 199 € + IVA, perpétua; versão completa a 250 € + IVA por mês ou 4.200 € + IVA perpétua | A versão Free exporta malhas com textura apenas em JPG                       |

Fontes, em inglês: [licença do RealityScan](https://www.realityscan.com/en-US/license), [página do RealityScan](https://www.realityscan.com/en-US), [guia móvel do RealityScan](https://dev.epicgames.com/documentation/realityscan-mobile/realityscan-step-by-step-guide), [loja do Metashape](https://www.agisoft.com/buy/online-store/) e [instaladores](https://www.agisoft.com/downloads/installer/), [AliceVision](https://alicevision.org/) e o [manual de captura do Meshroom](https://meshroom-manual.readthedocs.io/en/latest/capturing/capturing.html), [preços da Polycam](https://poly.cam/pricing), [3DF Zephyr](https://www.3dflow.net/3df-zephyr-photogrammetry-software/). Tudo lido a 11 de novembro de 2026.

O Meshroom não custa nada e serve a quem não se importa de aprender uma aplicação para computador organizada em nós de processamento, num computador Windows ou Linux com placa gráfica (GPU). O RealityScan é gratuito para a maioria das lojas pequenas e cobre telemóvel e computador.

O Metashape tem instaladores para Windows, macOS e Linux, e 30 dias de teste para o experimentar nas suas peças.

A Polycam é uma opção acessível para começar se quiser digitalizar com o telemóvel, e os planos pagos exportam GLTF, OBJ, FBX, DAE e USDZ. O Zephyr Free é uma boa forma de testar um objeto pequeno, desde que consiga cobri-lo com 50 fotografias.

## Em que é diferente a IA com uma fotografia?

O image-to-3D parte de uma única fotografia e deduz os lados que a câmara não viu. Não emparelha pontos entre fotografias, por isso não precisa de sobreposição, anéis nem prato giratório. Precisa de um disparo nítido, com luz uniforme, do objeto inteiro sobre fundo simples.

O easyrender trabalha assim, em duas fases. Primeiro desenha uma folha de ângulos grátis: nove vistas do objeto, oito à volta em passos de 45 graus e uma de cima. Confere essa folha e só gasta créditos quando estiver certa.

A geração lê depois essas nove vistas e cria um modelo com textura, que se descarrega em GLB e USDZ. Um modelo custa {{renderCredits}} créditos, ou seja {{renderPrice}}, e a [página de preços](/pt/precos) mostra os pacotes. [Carregar uma fotografia](/pt#try) para ver a folha de ângulos grátis.

## O que quer obter, e como o mede?

Defina o objetivo antes de escolher a ferramenta. Cada objetivo abaixo traz uma verificação que pode fazer sozinho.

- Um registo fiel de uma superfície, como pele gasta ou veio de carvalho. Amplie a textura em ecrã inteiro ao lado da peça real. A fotogrametria copia a superfície das fotografias, e é aqui que compensa o tempo de preparação.
- Um objeto completo, sem buracos. Rode o modelo e pare na base, nas costas das pernas e em qualquer reentrância funda. Cada buraco é uma parte que as fotografias falharam.
- Um modelo para cada produto de um catálogo. Cronometre uma peça, da preparação ao ficheiro final, e multiplique pelo catálogo antes de se comprometer com um método.
- O modelo de um produto em que não pode tocar. A fotogrametria não consegue começar. Avalie um resultado de image-to-3D pelo número de pernas, portas e puxadores em cada vista.
- Um custo por modelo conhecido. Numa licença, divida o preço pelos modelos que vai fazer durante a sua vigência. Em créditos, veja o preço por modelo na página de preços.

## O que corre mal na fotogrametria, e como se resolve?

Quase todas as digitalizações falhadas vêm da recolha das imagens, não do programa. Esta é a lista para conferir um mau resultado, do sintoma à solução.

| Sintoma                                                        | Causa                                                   | Solução                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Buracos num tampo branco liso                                  | Uma só cor lisa não dá ao programa nada para emparelhar | Fotografe com luz rasante, ou use outro método para essa peça                  |
| O processamento falha ou o modelo fica deformado               | Menos de 50 % de sobreposição entre disparos vizinhos   | Fotografe de novo com 70 % ou mais, com passos mais pequenos entre fotografias |
| A base falta ou está colada ao chão                            | A parte de baixo nunca foi fotografada                  | Faça uma segunda série com a peça deitada de lado, ou use um prato giratório   |
| Puxadores cromados ou um espelho saem cheios de altos e baixos | Os reflexos mudam de fotografia para fotografia         | Evite peças refletoras, ou aceite essas partes e modele-as à parte             |
| Zonas desfocadas e textura desalinhada                         | O zoom, a exposição ou o foco mudaram a meio            | Bloqueie AE/AF, mantenha uma só distância focal e elimine os disparos tremidos |
| Manchas escuras gravadas na textura                            | Sombras duras do flash ou do sol direto                 | Difunda a luz, ou fotografe num dia encoberto                                  |
| Partes da divisão coladas ao objeto                            | Um fundo carregado no enquadramento                     | Use um fundo liso e aplique uma máscara ao fundo em cada imagem                |
| A versão gratuita deixa de importar fotografias                | O 3DF Zephyr Free limita cada projeto a 50 fotografias  | Fique com as 50 melhores, ou passe para uma versão sem limite                  |

## O que usaríamos, caso a caso

É assim que escolheríamos, com o nosso próprio produto na lista.

Uma peça no seu armazém com uma superfície com textura, como uma arca de carvalho entalhado, e uma hora livre: fotogrametria. Regista a superfície tal como é, e o RealityScan ou o Meshroom não custam nada a experimentar.

A fotografia de fornecedor de um aparador que nunca viu ao vivo: IA a partir de uma fotografia. Não há nada para digitalizar, e pode avaliar a folha de ângulos grátis antes de gastar alguma coisa.

Um catálogo inteiro de fotografias de produto e nenhum estúdio: IA a partir de uma fotografia, em lote a partir da sua biblioteca ou através de um agente. Uma digitalização por produto significa uma sessão por produto.

Um jarro de vidro ou um candeeiro de aço polido: nenhum dos métodos lida bem com superfícies espelhadas. A documentação de fotogrametria manda evitá-las, por isso conte com um artista 3D para essa peça.

## Perguntas frequentes

### Qual é o melhor software de fotogrametria gratuito?

O Meshroom é open source (MPL-2.0) e corre em Windows e Linux. O RealityScan é gratuito abaixo de 1 milhão de dólares de faturação anual, a Polycam gratuita inclui 10 capturas de fotogrametria e o 3DF Zephyr Free aceita até 50 fotografias. A escolha depende do seu computador e de fotografar com o telemóvel.

### De quantas fotografias precisa a fotogrametria?

As ferramentas definem o mínimo pela sobreposição, não por um número fixo: a Apple pede 70 % entre disparos vizinhos, e o Meshroom 60 % lateral e 80 % frontal. A aplicação móvel do RealityScan analisa a partir de 20 imagens e aceita até 300. Objetos com reentrâncias precisam de mais, porque cada uma tem de aparecer em várias fotografias.

### A fotogrametria é melhor do que o image-to-3D com IA?

Resolvem problemas diferentes: a fotogrametria reconstrói o objeto a partir de muitas fotografias reais, por isso precisa dele à mão. O image-to-3D trabalha a partir de uma fotografia de uma peça em que talvez nunca toque. Se pode digitalizar e a superfície importa, digitalize; se só tem uma fotografia, o image-to-3D permite partir dessa imagem.

### A fotogrametria consegue digitalizar vidro, espelhos ou cromados?

Não de forma fiável: o guia da Apple manda evitar objetos muito refletores, transparentes ou translúcidos, e o manual do Meshroom diz o mesmo. A Apple sugere desenhar ou pintar a superfície para lhe dar textura, o que não faria a um artigo que vende. Para essas peças, um artista 3D é o caminho mais seguro.
