---

group: "blender-mcp-product-workflow"
title: "D’une photo à une scène Blender avec Claude et MCP"
description: "Intégrez un GLB de produit dans une scène Blender et utilisez Claude avec un outil MCP compatible pour des éditions limitées de la scène."
date: 2026-12-13
updated: 2026-12-13
keyword: "Blender MCP Claude"
cta: "Vérifiez les angles de votre produit dans l’aperçu gratuit."
---

Commencez par créer et vérifier le modèle de produit avant d’importer le fichier dans Blender. Utilisez un connecteur Blender MCP pour donner à Claude une tâche ciblée. Vérifiez les modifications de scène dans Blender et enregistrez une copie afin de garder la géométrie du produit séparée de la caméra, des lights et de la configuration de scène.

![Illustration : lampe articulée, moitié en matériau, moitié en fil de fer](../covers/blender-mcp-product-workflow.webp "Illustration éditoriale réalisée dans Blender.")

## Comment procédez-vous pour un test de petite envergure ?

Ouvrez une copie de la scène et importez un GLB connu. Vérifiez son nom, ses matériaux et son orientation. Suivez la configuration du connecteur choisi et confirmez que Claude peut lister les objets de scène avant de lui demander de modifier quoi que ce soit.

## Quelle instruction doit-on formuler en premier ?

Demandez-lui de conserver le maillage et les matériaux intacts, de placer le produit nommé sur la plateforme existante et de le cadre en trois quarts. Examinez l’objet, la caméra et la lumière dans Blender, puis enregistrez une nouvelle version du projet.

## Qu’est-ce que vous devez vérifier avant de publier ?

| Étape        | Preuves à conserver                                |
| ------------ | -------------------------------------------------- |
| Vérification | Objet nommé et référence connue                    |
| Édition      | Changement de caméra ou de position dans une copie |
| Approbation  | Vérification du viewport et du rendu               |

<!-- IMAGE PENDING: Photograph or capture the example described in the brief. -->

**Source** [BlenderMCP · documentation du projet](https://github.com/ahujasid/mcp-for-blender), [Anthropic · Claude Code MCP](https://code.claude.com/docs/en/mcp), [Blender · import et export glTF 2.0](https://docs.blender.org/manual/en/5.1/addons/import_export/scene_gltf2.html).

[Guide associé](/mcp)

[Comment créer un modèle 3D](/learn/how-to-make-a-3d-model)

## Questions fréquentes

### Quel serveur MCP génère le modèle ?

Dans ce workflow, easyrender crée le modèle à partir de la photo. Le connecteur Blender sert à modifier la scène après l’import. Certains connecteurs peuvent également faire appel à un générateur externe. Avant de commencer, vérifiez les outils disponibles et les services qui exigent leurs propres identifiants.

### Puis-je faire un essai avec un fichier GLB existant ?

Oui. Importez un GLB connu dans une scène de test à l’aide de l’importateur glTF de Blender. Vérifiez l’aspect des matériaux, l’orientation et les dimensions de l’objet. Demandez ensuite à Claude de lister les objets de la scène pour vous assurer qu’il a repéré le bon modèle.

### Dois-je modifier la scène d’origine au premier essai ?

Partez d’une copie du projet et donnez un nom précis au modèle. Demandez à Claude une modification bien définie, comme cadrer le produit avec la caméra active. Vérifiez ensuite le maillage, les matériaux et la caméra, puis enregistrez le résultat sous un nouveau nom.
