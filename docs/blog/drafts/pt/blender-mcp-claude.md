---

group: "blender-mcp-product-workflow"
title: "Da fotografia à cena no Blender com Claude e MCP"
description: "Introduza um GLB de produto numa cena do Blender e utilize o Claude com uma ferramenta MCP compatível para edições limitadas na cena."
date: 2026-12-13
updated: 2026-12-13
keyword: "Blender MCP Claude"
cta: "Reveja os ângulos do seu produto numa pré-visualização gratuita."
---

Começa por criar e revisar o modelo do produto antes da sua importação para o Blender. Utiliza um conector MCP do Blender para atribuir uma tarefa específica ao Claude. Verifica alterações na cena no Blender e guarda uma cópia para manter a geometria do produto separada da câmera, iluminação e configuração da cena.

![Ilustração de candeeiro articulado, metade sólida e metade em malha](../covers/blender-mcp-product-workflow.webp "Ilustração editorial criada no Blender.")

## Como configurar um teste simples?

Abre uma cópia da cena e importa um GLB conhecido. Verifica o nome, os materiais e a orientação. Segue a configuração do conector seleccionado e confirma que o Claude consiga listar os objectos da cena antes de ser solicitado a realizar alterações.

## Qual deveria ser o primeiro comando?

Pede que mantenha a malha e os materiais inalterados, coloque o produto nomeado sobre a plataforma existente e o enquadramento em três quartos. Revisa o objecto, a câmera e a iluminação no Blender, depois guarda uma nova versão do projeto.

## O que deve ser verificado antes da publicação?

| Passo       | Evidence a manter                           |
| ----------- | ------------------------------------------- |
| Inspecionar | Objecto nomeado e referência conhecida      |
| Editar      | Alteração na câmera ou colocação numa cópia |
| Aprovar     | Verificação no viewport e no render         |

<!-- IMAGE PENDING: Photograph or capture the example described in the brief. -->

**Fonte** [BlenderMCP · documentação do projeto](https://github.com/ahujasid/mcp-for-blender), [Anthropic · Claude Code MCP](https://code.claude.com/docs/en/mcp), [Blender · importação e exportação de glTF 2.0](https://docs.blender.org/manual/en/5.1/addons/import_export/scene_gltf2.html).

[Guia relacionado](/mcp)

[Como criar um modelo 3D](/pt/guias/como-criar-um-modelo-3d)

## Perguntas frequentes

### Que servidor MCP gera o modelo?

Neste fluxo, o easyrender cria o modelo a partir da fotografia. O conector do Blender ajuda a editar a cena após a importação. Alguns conectores também podem chamar um gerador externo. Antes de começar, confirma que ferramentas tens disponíveis e que serviços exigem credenciais próprias.

### Posso experimentar com um GLB que já tenho?

Sim. Importa um GLB conhecido para uma cena de teste com o importador glTF do Blender. Verifica o aspeto dos materiais, a orientação e as dimensões do objeto. Pede depois ao Claude para listar os objetos da cena e confirma que identificou o modelo certo.

### Devo editar a cena original na primeira tentativa?

Trabalha numa cópia do projeto com um modelo cujo nome consigas identificar. Pede ao Claude uma única alteração, como enquadrar o produto com a câmara ativa. Depois de reveres a malha, os materiais e a câmara, guarda o resultado com um nome de ficheiro diferente.
