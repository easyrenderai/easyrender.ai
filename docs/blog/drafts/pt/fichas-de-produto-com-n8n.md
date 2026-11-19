---

group: "n8n-product-pages-images-3d"
title: "Fichas de produto com n8n, imagens e 3D"
description: "Aprenda a criar fichas de produto com n8n. Combine dados do catálogo, imagens e um modelo 3D e aprove os custos antes de guardar o rascunho no CMS."
date: 2026-11-18
updated: 2026-11-19
keyword: "fichas de produto com n8n"
cta: "Reveja os ângulos do seu produto numa pré-visualização gratuita."
---

Para criar uma ficha de produto com n8n, comece com dados verificados e prepare o texto, as imagens e o modelo 3D em ramos distintos. Junte os ficheiros pelo SKU e pela versão da origem, guarde a ficha como rascunho e registe separadamente a autorização de despesa e a aprovação de publicação.

![Ilustração de candeeiro de mesa, metade sólida e metade em malha](../covers/n8n-product-pages-images-3d.webp "Ilustração editorial criada no Blender.")

> **Uma lista final exige mais do que uma descrição.** Mantenha os dados do produto, ficheiros de imagem, modelo 3D e estado de publicação unificados. Um processo bem-sucedido representa um passo para uma página de produto aprovada.

![Diagrama do fluxo para fichas de produto com n8n](../assets/n8n-product-pages-images-3d-pt.svg "Diagrama arquitetural original, não uma captura de ecrã nem uma execução concluída.")

## O que este fluxo deve entregar?

Para uma candeeiro de secretária em cerâmica, o resultado é um pacote revisável: cópia precisa, vistas selecionadas, ficheiro GLB e o identificador de um rascunho do CMS. O GLB é um contêiner binário para o modelo 3D, descrito na [documentação do Khronos glTF](https://www.khronos.org/gltf/). Um vídeo de rotação é um entregável diferente.

| Entregável               | Fonte de verdade                           | Verificação de aceitação                                  |
| ------------------------ | ------------------------------------------ | --------------------------------------------------------- |
| Título e descrição       | Fatos do fornecedor mais regras editoriais | Sem materiais inventados, dimensões ou certificação       |
| Imagens do produto       | Conjunto visual aprovado                   | O mesmo produto, acabamento e variante em todo o processo |
| Ficheiro interativo 3D   | Construção aprovada                        | O ficheiro abre, roda e corresponde ao elemento aprovado  |
| Rascunho do CMS          | Mapeamento SKU-product                     | Produto e variante corretos, ainda não publicados         |
| Registo de processamento | IDs guardados e aprovação documentada      | Outra execução pode reativar o trabalho                   |

O [modelo n8n imagem para Shopify](https://n8n.io/workflows/11695-generate-product-descriptions-from-images-and-publish-to-shopify-using-ai/) ilustra a parte de cópia. A adição de 3D exige um próprio estado de tarefa, revisão e entrega de ficheiro. A receita aqui descreve essa arquitetura. Não é um relatório de implantação de loja executada.

## Qual deveria ser a estrutura do pacote de lista?

Comece por um objeto conhecido para poder verificar o tipo de ficheiro que cada etapa deveria entregar. Este vaso da galeria do easyrender mostra a imagem original, o folheto gerado e o modelo exportado. Utilize estes ficheiros como referência ao configurar o fluxo.

![Fotografia original do produto, folheto gerado de ângulos e uma vista do mesmo modelo de vaso](../evidence/n8n-ficha-foto-vistas-modelo.jpg "Ativos de exemplo do easyrender. No centro mostram as vistas geradas e à direita um quadro do modelo.")

| Campo para revisão       | Entrada de exemplo                                  |
| ------------------------ | --------------------------------------------------- |
| Identificador de exemplo | `VASE-DEMO-01`                                      |
| Imagem de referência     | [Abra a fotografia de origem](/showcase/vase.jpg)   |
| Vistas para revisão      | [Abra o folheto gerado](/showcase/vase-angles.jpg)  |
| Modelo para a galeria    | [Abra o exemplo no formato GLB](/showcase/vase.glb) |
| Estado da lista          | Rascunho de exemplo                                 |

**Verifique que todos os três ativos estejam atribuídos ao mesmo SKU.** Abra o modelo separadamente e mantenha a fotografia de origem disponível ao verificar forma e acabamento. Este exemplo utiliza ativos existentes para demonstrar o que deveria receber um revisor.

## O que verificámos no n8n?

No n8n 2.48.5, trocámos de propósito a ordem dos ficheiros de três SKU de exemplo. O fluxo associou os registos por SKU e versão de origem, descarregou os dois GLB públicos aprovados e verificou os cabeçalhos binários e os tamanhos declarados. O cadeirão ficou por rever porque o modelo era de uma versão anterior.

| SKU           | Versão de origem | Resultado                         |
| ------------- | ---------------- | --------------------------------- |
| VASE-DEMO-01  | v2               | Rascunho com GLB de 400 792 bytes |
| TABLE-DEMO-01 | v3               | Rascunho com GLB de 326 872 bytes |
| CHAIR-DEMO-01 | v3 com modelo v2 | Aguarda revisão                   |

O teste abrange a junção e validação de ficheiros existentes. A geração de imagens, a criação 3D paga e a publicação na loja precisam de um teste próprio. [Importa o fluxo de exemplo](../evidence/n8n-local-draft-workflow.json), [vê o resultado da execução](../evidence/n8n-local-draft-result.json).

## Quais informações devem vir do catálogo?

Crie um registo de entrada com o SKU, a versão dos dados de origem e as informações verificadas. Deixe em branco os campos desconhecidos. Registe em separado a aprovação das imagens, a autorização da despesa do modelo 3D e a autorização de publicação. Use estes campos: `sku`, `source_version`, `name`, `material`, `dimensions`, `image_url` e `locale`.

| Campo                | Valor de exemplo                    | Por que é relevante                                       |
| -------------------- | ----------------------------------- | --------------------------------------------------------- |
| `sku`                | `LAMP-CERAMIC-01`                   | Une cópia, imagens e modelo 3D                            |
| `source_version`     | `photo-v2`                          | Distingue uma nova foto de uma tentativa recorrente       |
| `material`           | Cerâmica confirmada pelo fornecedor | Evita que suposições visuais se transformem em afirmações |
| `dimensions`         | Registo verificado do fornecedor    | Mantém as medidas independentes do modelo gerado          |
| `publication_status` | `draft`                             | Separa a criação do ficheiro da publicação                |

Para a ramificação de texto, instrua o modelo linguístico escolhido a devolver título, descrição, bullets, texto alternativo da imagem e `missing_facts`. Deve utilizar apenas os campos factuais fornecidos para as especificações. Redirecione quaisquer factos obrigatórios ausentes para revisão, em vez de os preencher automaticamente.

### O que deverá conter o prompt e a saída do texto?

Passe o registo validado para o nó de geração de texto escolhido, com a instrução abaixo. Mantenha a credencial de API separada da credencial do serviço visual. Se a saída não for analisável ou não corresponder aos campos exigidos, redirecione para uma etapa de edição antes de atingir o CMS.

> Escreva um rascunho de ficha de produto no idioma pedido, com base apenas nos dados fornecidos. Devolva title, description, bullets, alt_text e missing_facts. Não deduza materiais, medidas, compatibilidades nem certificações a partir da fotografia. Omita do texto as informações desconhecidas e indique-as em missing_facts. Não publique nada.

| Campo de saída  | Tipo                     | Exemplo do registo do candeeiro                             |
| --------------- | ------------------------ | ----------------------------------------------------------- |
| `title`         | Texto                    | Candeeiro de cerâmica                                       |
| `description`   | Texto                    | Candeeiro de cerâmica para secretária ou mesa de apoio.     |
| `bullets`       | Lista de texto           | Corpo em cerâmica, apenas quando confirmado pelo fornecedor |
| `alt_text`      | Texto                    | Vista frontal da candeeiro de secretária em cerâmica        |
| `missing_facts` | Lista de nomes de campos | `dimensions`, `bulb_compatibility` se ausentes              |

Trate isto como um esquema para validação, não como uma garantia de que o modelo se cumprirá sempre. Para esta entrada ilustrativa, a compatibilidade com lâmpadas desconhecidas permanece fora do rascunho. Exija todos os cinco campos, arrays para as duas listas e o SKU de origem inalterado antes de juntar o ramo de texto com os resultados visuais.

## Como gerar imagens e 3D a partir do mesmo produto?

Utilize o nó [HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/) integrado do n8n para as chamadas à API. Armazene a chave numa credencial com nome de cabeçalho `Authorization` e valor `Bearer YOUR_API_KEY`. O placeholder é substituído dentro da credencial, nunca dentro de um exportação compartilhada ou registo de produto.

1. Leia `GET https://easyrender.ai/api/credits`. Exiba o custo actual do conjunto de imagens, saldo da conta e produto solicitado antes da aprovação. A criação do conjunto de imagens é paga. Separa-se do percurso de prévia gratuito.
2. Após aprovação, chame `POST /api/product-views` com JSON contendo `image_url`, `name` e um `prompt` opcional. Guarde o valor retornado `id` como `view_set_id` imediatamente.
3. Realize uma consulta a `GET /api/product-views/{id}` utilizando o identificador guardado. Uma configuração inicial é um intervalo de 15 segundos com um prazo fixo. Respeite as respostas de limite de taxa. Pare em `failed` e verifique as vistas individuais antes de aceitar o conjunto.
4. Descarregue as imagens aprovadas a partir de `GET /api/product-views/{id}/views/{view}`, utilizando cada identificador de vista retornada. Utilize a mesma credencial de API e guarde as respostas como ficheiros.
5. Chame `POST /api/product-views/{id}/render` apenas após o conjunto estar pronto e aprovado. Guarde o seu `renderId`. Este pedido cria ou reutiliza um rascunho. A geração paga do modelo 3D começa quando for autorizada e pedida no passo seguinte.
6. Consulte o estado do modelo e aprove o número de créditos que falta cobrar. O valor é calculado com `max(0, renderCredits - credits)`. Envie `POST /api/renders/{id}/render` com o valor inteiro autorizado em `maxCredits`.
7. Aguarde até que `status` seja `ready` e `hasModel` seja `true`, depois transfira `GET /api/renders/{id}/model?download=1` como ficheiro.

Os caminhos e campos estão descritos no [esquema da API](https://easyrender.ai/api/openapi.json). O pedido REST que cria a série de imagens não dispõe de um campo `maxCredits`. Valide a autorização da despesa no fluxo e use uma chave dedicada com um limite de créditos.

Para avaliar um produto sem pagar pela série de imagens, comece pela [API de pré-visualização gratuita](https://easyrender.ai/api/openapi.json). O fluxo chama `POST /api/renders`, aguarda a revisão e mantém a criação do modelo 3D numa etapa separada.

<!-- IMAGE PENDING: unique real screenshot of product-view review and generated files, captured without credentials or customer data. -->

## Como manter as ramificações de cópia e visual alinhadas?

Transmite o mesmo `sku` e `source_version` pelas duas ramificações. Guarda `view_set_id`, `render_id` e a revisão textual ao lado. Une as ramificações por esses identificadores, não por posição numa lista: uma requisição lenta de imagem não deve associar o modelo de uma lâmpada à descrição do próximo produto.

| Estado de cópia              | Estado visual                    | Ação seguinte                                 |
| ---------------------------- | -------------------------------- | --------------------------------------------- |
| Pronto                       | Ainda em processamento           | Guarda a cópia e aguarda o trabalho existente |
| Fatos do fornecedor ausentes | Pronto                           | Solicita os factos. Mantém os ficheiros       |
| Aprovado                     | Aprovado                         | Cria um rascunho para o CMS                   |
| Aprovado                     | Rejeitado                        | Mantém o texto. Revisa apenas a tarefa visual |
| Versão anterior da fonte     | Versão atual dos dados de origem | Revise o desalinhamento antes da combinação   |

Não descreva as vistas geradas como fotografias adicionais do candeeiro original. Mantenha a fotografia original disponível para a revisão e escreva legendas adequadas para cada ativo. Para a preparação da fotografia original, siga o guia [fotografia para 3D](/pt/guias/criar-um-modelo-3d-a-partir-de-fotografias).

## Como os ficheiros atingem o Shopify ou outro CMS?

Descarregue o modelo privado com um pedido autenticado no n8n. Use a credencial da loja para carregar o ficheiro na plataforma de destino e a credencial do easyrender apenas para descarregar o modelo.

O [guia de conteúdos multimédia da Shopify](https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections/manage-media) separa o carregamento, o processamento e a associação ao produto. Siga esta sequência na versão da API da sua loja. Guarde os identificadores do ficheiro e do produto e confirme que o processamento terminou antes de marcar o pacote como entregue.

Comece por um produto em rascunho ou por uma alteração não publicada. Verifique as imagens, carregamento do modelo e mapeamento de variantes no tema real. Uma plataforma que aceita um ficheiro não prova que a página do produto o apresente corretamente. O guia de e-commerce [3D](/pt/guias/modelos-3d-para-ecommerce) aborda essa verificação no storefront.

## O que geralmente rompe esta automação?

| Sintoma                                                       | Causa provável                                                    | Solução                                                                |
| ------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| A cópia inventa um material                                   | A saída da visão tratada como dados do fornecedor                 | Restrição das especificações aos campos verificados                    |
| O conjunto de imagens começa duas vezes                       | POST pago reenviado após resposta perdida                         | Confirme se o trabalho já existe antes de reenviar o pedido            |
| Modelo incorreto em um produto                                | Ramificações unidas pela posição na lista                         | União por SKU e versão dos dados de origem                             |
| Shopify não consegue recuperar o modelo                       | Ponteiro privado fornecido como conteúdos multimédia pública      | Descarregar com autenticação, em seguida carregar o ficheiro           |
| Construção nunca inicia                                       | Versão de visualização em rascunho confundida com build concluído | Aprovar e invocar a operação separada de construção                    |
| As consultas de estado terminam, mas o processamento continua | Prazo do workflow confundido com falha do job                     | Armazenar o ID e reanalisar o estado posteriormente                    |
| Imagem antiga sobrevive a um reprocessamento                  | Sem rastreamento de revisão de conteúdos multimédia               | Armazenar o ID da conteúdos multimédia de destino e a versão de origem |

## Como saber que o workflow merece ser expandido?

Teste todos os ramos do fluxo com um candeeiro de secretária e compare o rascunho final com os dados de origem. Registar o tempo dedicado à revisão, o número de correções manuais e os créditos líquidos utilizados. Em seguida processar um conjunto pequeno de produtos distintos antes de permitir que um feed programado alimente o workflow sem supervisão.

A nossa implementação separa o ID do view-set, o ID do render e a disponibilidade do modelo final. Isso proporciona este procedimento três pontos de verificação em vez de um sinal de sucesso genérico. O número de pacotes de produtos revistos e entregues constitui o resultado. Um nó HTTP verde é apenas um sinal intermediário.

Para um método de produção mais amplo, utilize o guia de criação [3D](/pt/guias/como-criar-um-modelo-3d). Num catálogo maior, guarde o identificador do trabalho e o valor aprovado por SKU para retomar a operação sem repetir a despesa.

## Perguntas frequentes

### Pode o n8n criar uma página de produto completa a partir de uma única foto?

Pode coordenar o trabalho, mas a imagem não é suficiente para verificar as especificações do produto. Forneça factos do catálogo de confiança, escolha os serviços de texto e visual, revise as saídas e crie um rascunho do CMS. Mantenha as medidas, materiais e aprovação de publicação separadas do que um modelo visual infere sobre o objeto.

### As imagens e o modelo 3D são gratuitos?

A pré-visualização é gratuita. A série de imagens consome créditos e a criação posterior do modelo 3D tem um custo próprio. Consulte o valor antes de aprovar cada operação e inclua no orçamento os custos do modelo de linguagem e do alojamento do n8n.

### É necessário um nó nativo EasyRender no n8n?

Não, não é necessário um nó nativo EasyRender no n8n. O nó HTTP Request utiliza funcionalidades integradas e o contrato REST publicado. Comece com o nó integrado, depois avalie um nó dedicado EasyRender para as operações exatas e disponibilidade atual na sua instalação.

### O fluxo publicará os produtos automaticamente?

Apenas se for adicionado e autorizado esse passo. Este receituário termina com um rascunho de CMS revisto e identificadores de conteúdos multimédia guardados. Manter a publicação separada permite verificar a variação do produto, o texto e os ficheiros juntos antes de alterar uma lista ativa, e permite reenviar a entrega sem gerar novamente o trabalho visual.
