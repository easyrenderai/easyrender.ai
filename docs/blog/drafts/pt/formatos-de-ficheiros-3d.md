---

group: "3d-file-formats"
title: "Que formato 3D usar para web, RA e edição"
description: "Escolha GLB, USDZ, OBJ ou FBX com base no destino do modelo e no que deve sobreviver à transferência."
date: 2026-11-22
updated: 2026-11-22
keyword: "formatos de ficheiros 3D"
cta: "Reveja os ângulos do seu produto numa pré-visualização gratuita."
---

Use GLB para visualizadores de produto na web. Inicie com um ficheiro GLB e verifique se as texturas, extensões e primeiro quadro estão corretamente carregadas. Um ficheiro que se abre pode ainda falhar em materiais ou movimento, mesmo que o carregamento tenha sido bem-sucedido.

![Ilustração de peças cilíndricas empilhadas, metade sólida e metade em malha](../covers/3d-file-formats.webp "Ilustração editorial criada no Blender.")

## Que formato deve ser entregue para cada tarefa?

| Tarefa                         | Formato inicial                             | Verificação na entrega                 |
| ------------------------------ | ------------------------------------------- | -------------------------------------- |
| Visualizador de produto na web | GLB                                         | Texturas, extensões e primeiro quadro  |
| Apple Quick Look               | USDZ                                        | Abre num dispositivo compatível        |
| Entrega de geometria estática  | OBJ junto com MTL e mapas quando necessário | Caminhos relativos, normais e unidades |
| Entrega de cena ou animação    | FBX, se suportado pelas duas ferramentas    | Rig, clips e mapeamento de materiais   |

Ao reabrir as exportações no Blender, verificámos os recursos recuperados. Sem o WebP, o glTF manteve a geometria e perdeu a textura. Sem o BIN, a importação falhou. O FBX da mesa de cabeceira manteve a imagem, enquanto o ficheiro de materiais do OBJ ficou sem referência à textura.

## Como tornar a entrega verificável?

Pergunte qual importador e versão será utilizada. Envie um ativo real com a sua orientação esperada, referência visual e quaisquer recursos externos. Para um rig, inclua o nome e o intervalo de quadros de um clip conhecido.

Abra o resultado na aplicação de recepção sem acesso ao seu diretório de trabalho. Gire e inspeccione-o em iluminação neutra. Um ficheiro que se abre pode ainda diferir em materiais ou movimento.

## Que elementos devem ser verificados antes da publicação?

| Sintoma                                            | O que verificar                                                      |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| Superfícies cinzentas                              | Caminhos de textura ausentes ou mapeamento de material não suportado |
| Objeto situado de lado                             | Convenções de eixo no exportador e no importador                     |
| A pré-visualização funciona apenas num dispositivo | O visualizador alvo e as suas extensões necessárias                  |

<!-- IMAGE PENDING: Photograph or capture the example described in the brief. -->

**Fonte** [Khronos · especificação glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [OpenUSD · especificação USDZ](https://openusd.org/release/spec_usdz.html), [Apple · Quick Look](https://developer.apple.com/quick-look-gallery/), [Blender · Wavefront OBJ](https://docs.blender.org/manual/en/latest/files/import_export/obj.html), [Blender · FBX](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_fbx.html).

[Guia relacionado](/learn/glb-file)

[Como criar um modelo 3D](/pt/guias/como-criar-um-modelo-3d)

## Perguntas frequentes

### O GLB inclui sempre texturas?

O GLB pode incluir texturas, mas não sempre—verifique a lista de recursos e ativos embutidos do ficheiro para confirmar. Revise os metadados para URLs de texturas e caminhos de ficheiros para garantir que são válidos e acessíveis. Verifique as URLs e caminhos de texturas no metadados do GLB antes do uso.

### O OBJ pode transportar animação?

O formato OBJ não suporta animação e deve ser usado apenas para geometria estática. Envie o ficheiro OBJ com MTL e mapas para verificação no visualizador de destino. O ficheiro pode abrir mas falhar em rig ou clips, com erro comum de mapeamento incorreto.

### Preciso do ficheiro original?

Precisa do ficheiro original? Envie o ficheiro GLB com texturas, extensões e primeiro quadro. Abra-o no visualizador de produto na web sem acesso ao diretório de trabalho para verificar se as texturas e o primeiro quadro estão corretamente carregados, evitando erros comuns de malformação ou ausência de dados.
