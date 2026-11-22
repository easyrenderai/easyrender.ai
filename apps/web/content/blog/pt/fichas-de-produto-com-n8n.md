---

group: "n8n-product-pages-images-3d"
title: "Fichas de produto com n8n: texto, imagens e 3D"
description: "Crie rascunhos de fichas de produto com n8n, dados de catálogo verificados, imagens e um modelo 3D. Aprove cada despesa e a publicação em separado."
date: 2026-11-18
updated: 2026-11-22
author: Jorge Rodríguez
authorType: person
keyword: "fichas de produto com n8n"
cta: "Carregue uma fotografia do produto e veja a pré-visualização gratuita antes de criar o modelo 3D."
---

Para criar uma ficha de produto com n8n, prepare o texto a partir de dados confirmados do catálogo e trate das imagens e do modelo 3D num ramo separado. Junte os resultados pela referência do artigo e pela versão dos dados e guarde um rascunho na loja. Aprove separadamente as vistas pagas, a criação do modelo 3D e a publicação.

![Candeeiro de mesa com metade da malha 3D visível](/blog/illustrations/n8n-product-pages-images-3d/hero.webp "Ilustração editorial criada no Blender.")

> **Comece por um único artigo.** Confirme que o texto, as imagens e o modelo correspondem à mesma variante antes de enviar o rascunho para aprovação.

![O texto e os ficheiros juntam-se num rascunho por referência e versão dos dados](/blog/figures/n8n-product-pages-images-3d/workflow-pt.webp "Esquema de preparação da ficha no n8n.")

## Que dados deve enviar para o n8n?

Use como exemplo um candeeiro de mesa em cerâmica. Envie o mesmo registo do catálogo para os dois ramos do fluxo. Quando faltar um dado obrigatório, encaminhe-o para verificação e deixe-o de fora da descrição.

| Campo                            | Exemplo                                                  | Para que serve                                            |
| -------------------------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| `sku`                            | `LAMP-CERAMIC-01`                                        | Identifica a variante nos dois ramos                      |
| `source_version`                 | `photo-v2`                                               | Distingue uma atualização dos dados de uma nova tentativa |
| `name`, `material`, `dimensions` | Candeeiro, cerâmica confirmada, medidas da ficha técnica | Fornece os dados a usar no texto                          |
| `image_url`, `locale`            | Fotografia de referência, `pt-PT`                        | Indica a imagem de partida e o idioma                     |

O [modelo de fluxo do n8n para Shopify](https://n8n.io/workflows/11695-generate-product-descriptions-from-images-and-publish-to-shopify-using-ai/) mostra como obter um texto a partir de uma imagem. Para redigir a ficha, inclua os dados confirmados pelo fornecedor e indique os campos que o modelo deve devolver.

> Redija um rascunho no idioma pedido, usando apenas os dados verificados. Devolva `title`, `description`, `bullets`, `alt_text` e `missing_facts`. Indique em `missing_facts` os dados em falta. Não publique nada.

Confirme que a resposta inclui os cinco campos e que `bullets` e `missing_facts` são listas de texto. Mantenha a referência e a versão do registo de origem. Se o n8n não conseguir interpretar a resposta ou faltarem dados obrigatórios, encaminhe o rascunho para revisão.

## Que ficheiros deve verificar?

Este vaso da galeria da EasyRender mostra a fotografia de origem, a folha de vistas e o modelo exportado. O modelo interativo está em GLB, a variante binária do [formato glTF da Khronos](https://www.khronos.org/gltf/). Abra o modelo à parte e compare a silhueta e o acabamento com a fotografia.

![Fotografia de origem do vaso, vistas geradas e imagem do modelo 3D](/blog/figures/n8n-product-pages-images-3d/photo-angles-model.jpg "Exemplo da EasyRender. As vistas geradas estão ao centro e a imagem do modelo à direita.")

| Ficheiro                 | Exemplo                                              |
| ------------------------ | ---------------------------------------------------- |
| Fotografia de referência | [Abrir a fotografia](/showcase/vase.jpg)             |
| Vistas a rever           | [Abrir a folha de vistas](/showcase/vase-angles.jpg) |
| Modelo interativo        | [Descarregar o GLB](/showcase/vase.glb)              |

No n8n 2.48.5, alterámos a ordem de chegada dos ficheiros de três artigos de teste. O fluxo associou dois GLB públicos aprovados aos artigos certos e verificou o cabeçalho binário e o tamanho indicado. O cadeirão ficou por rever porque o modelo pertencia a uma versão anterior.

| Referência      | Versão                  | Resultado                            |
| --------------- | ----------------------- | ------------------------------------ |
| `VASE-DEMO-01`  | `v2`                    | Rascunho com um GLB de 400 792 bytes |
| `TABLE-DEMO-01` | `v3`                    | Rascunho com um GLB de 326 872 bytes |
| `CHAIR-DEMO-01` | Dados `v3`, modelo `v2` | A aguardar revisão                   |

O teste local usa ficheiros existentes. A geração de imagens, a criação paga do modelo e a publicação na loja requerem testes próprios. Pode [importar o fluxo de exemplo](/blog/figures/n8n-product-pages-images-3d/n8n-local-draft-workflow.json) e [consultar o resultado](/blog/figures/n8n-product-pages-images-3d/n8n-local-draft-result.json).

## Como gerar e descarregar as imagens e o modelo?

Use o nó [HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/) incluído no n8n. Nas credenciais, configure o cabeçalho `Authorization` com o valor `Bearer YOUR_API_KEY` e substitua aí o valor de exemplo. Mantenha a chave fora dos fluxos exportados para partilha.

1. Verifique o saldo e o custo atual do conjunto de vistas através de `GET https://easyrender.ai/api/credits`. Peça aprovação para a despesa. Para fazer uma primeira verificação gratuita com uma fotografia, use `POST /api/renders`.
2. Depois de aprovar o custo, envie `POST /api/product-views` com `image_url`, `name` e, se precisar, `prompt`. Guarde o campo `id` devolvido no seu registo como `view_set_id`.
3. Consulte o estado em `GET /api/product-views/{id}` até receber `ready`. Pare se o estado for `failed` e respeite os limites de pedidos. Descarregue as vistas aceites em `GET /api/product-views/{id}/views/{view}`, com o identificador de cada vista.
4. Quando o estado for `ready` e as vistas tiverem sido aprovadas, envie `POST /api/product-views/{id}/render` e guarde o campo `renderId`. O pedido cria ou reutiliza um rascunho do modelo.
5. Use `renderId` como `{id}` em `GET /api/renders/{id}`. Peça aprovação para o número de créditos ainda a cobrar, dado por `max(0, renderCredits - credits)`. Envie o inteiro aprovado em `maxCredits` para `POST /api/renders/{id}/render`.
6. Quando `status` for `ready` e `hasModel` for `true`, descarregue o ficheiro com um pedido autenticado a `GET /api/renders/{id}/model?download=1`.

Consulte o [esquema da API](https://easyrender.ai/api/openapi.json) para ver os campos e estados. O pedido de criação do conjunto de vistas não tem o campo `maxCredits`. Confirme a autorização da despesa no fluxo e use uma chave dedicada com limite de créditos.

## Como enviar o rascunho para a loja?

Junte o texto e os ficheiros através de `sku` e `source_version`. Guarde no mesmo registo os identificadores do conjunto de vistas, do modelo e dos ficheiros na loja. Se um pedido pago ficar sem resposta, verifique se a tarefa foi criada antes de o repetir.

O [guia de ficheiros multimédia do Shopify](https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections/manage-media) descreve o carregamento, o processamento e a associação ao artigo. Descarregue o GLB privado com a chave da EasyRender e use as credenciais da loja para o carregar. Confirme que o ficheiro foi processado antes de verificar a ficha no tema. O [guia de modelos 3D para lojas online](/pt/guias/modelos-3d-para-ecommerce) explica o que verificar.

| Situação                                             | Ação                                                   |
| ---------------------------------------------------- | ------------------------------------------------------ |
| O texto e o modelo correspondem a versões diferentes | Suspenda o envio e corrija a associação                |
| Faltam dados do fornecedor                           | Peça os dados e guarde os ficheiros já aprovados       |
| As vistas foram rejeitadas                           | Conserve o texto e reveja apenas as imagens            |
| O ficheiro ainda está a ser processado               | Consulte o estado através do identificador do ficheiro |
| A variante, o texto e os ficheiros estão certos      | Envie o rascunho para aprovação da publicação          |

Para escolher a fotografia inicial, consulte o [guia para criar um modelo 3D a partir de fotografias](/pt/guias/criar-um-modelo-3d-a-partir-de-fotografias). O [guia de criação de modelos 3D](/pt/guias/como-criar-um-modelo-3d) explica o processo completo. No primeiro artigo, meça o tempo de revisão, o número de correções e os créditos gastos antes de processar vários artigos automaticamente.

## FAQ

### É possível criar uma ficha de produto a partir de uma fotografia?

O n8n consegue ligar os serviços que preparam o texto, as imagens e o modelo e guardar um rascunho na loja. Junte à fotografia os dados confirmados do catálogo. As medidas, os materiais e as certificações devem vir do fornecedor ou de outra fonte verificada antes da publicação.

### As imagens e o modelo 3D são gratuitos?

A pré-visualização a partir de uma fotografia é gratuita. Criar um conjunto de vistas consome créditos e a geração do modelo 3D tem um custo separado. Verifique o custo antes de aprovar cada operação e conte também com eventuais despesas do serviço de redação e do alojamento do n8n.

### Preciso de um nó EasyRender próprio no n8n?

O nó HTTP Request incluído no n8n é suficiente para este fluxo. Configure as credenciais da EasyRender e use-as para iniciar o pedido, consultar o estado e descarregar o ficheiro. Guarde os identificadores das tarefas para retomar a verificação se o fluxo atingir o tempo limite.

### O fluxo publica as fichas automaticamente?

O fluxo guarda um rascunho para rever no tema da loja. Se quiser automatizar a publicação, acrescente uma etapa independente que só corra após aprovação. Antes de publicar, verifique a variante, o texto, a ordem das imagens e se o modelo abre no visualizador da ficha.
