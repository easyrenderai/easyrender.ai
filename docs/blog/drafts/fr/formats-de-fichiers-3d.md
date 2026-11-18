---

group: "3d-file-formats"
title: "Quel format 3D choisir pour le web, la RA ou l’édition ?"
description: "Choisissez GLB, USDZ, OBJ ou FBX en fonction de l'endroit où le modèle va et de ce qui doit survivre à la livraison."
date: 2026-11-22
updated: 2026-11-22
keyword: "formats de fichiers 3D"
cta: "Vérifiez les angles de votre produit dans l’aperçu gratuit."
---

Choisissez le format de fichier en ouvrant d'abord l'application cible. Pour un lecteur de produit en ligne, commencez par GLB. Pour Apple Quick Look, testez un USDZ. Quand la prochaine personne a besoin d’éditer l’asset, convenez d’un format importé par leur outil et listez les fonctionnalités qu’ils doivent conserver.

![Illustration : pièces cylindriques empilées, moitié en matériau, moitié en fil de fer](../covers/3d-file-formats.webp "Illustration éditoriale réalisée dans Blender.")

## Quel format devez-vous livrer pour chaque mission ?

| Mission                           | Format de départ                                  | Vérification à la livraison            |
| --------------------------------- | ------------------------------------------------- | -------------------------------------- |
| Lecteur de produit en ligne       | GLB                                               | Textures, extensions et première frame |
| Apple Quick Look                  | USDZ                                              | Ouvre sur un appareil compatible       |
| Transfert de géométrie statique   | OBJ avec MTL et fichiers de texture si nécessaire | Chemins relatifs, normales et unités   |
| Transfert de scène ou d’animation | FBX si supporté par les deux outils               | Rig, clips et mappage des matériaux    |

En rouvrant les exports dans Blender, nous avons vérifié les ressources récupérées. Le glTF sans WebP conservait sa géométrie et perdait sa texture. Sans le BIN, l’import échouait. L’export FBX de la table de chevet conservait son image, tandis que le fichier de matériaux OBJ ne référençait aucune texture.

## Comment rendre le transfert vérifiable ?

Demandez l’importeur et la version utilisée. Envoyez un asset réel avec son orientation attendue, une référence visuelle et tout ressource externe. Pour un rig, incluez le nom et la plage de cadre d’un clip connu.

Ouvrez le résultat dans l’application de réception sans accès à votre dossier de travail. Rotez et inspectez-le sous lumière neutre. Un fichier qui s’ouvre peut tout de même différer en matière de textures ou de mouvement.

## Qu’est-ce que vous devez vérifier avant la publication ?

| Symptôme                                                  | Quels points à vérifier                                                       |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Des surfaces grises                                       | Des chemins de textures manquants ou une carte de matière non prise en charge |
| L'objet tourné sur son côté                               | Les conventions d'axes dans l'exporteur et l'importeur                        |
| Le prévisualisation fonctionne uniquement sur un appareil | Le lecteur cible et ses extensions requises                                   |

<!-- IMAGE PENDING: Photograph or capture the example described in the brief. -->

**Source** [Khronos · spéciﬁcation glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [OpenUSD · spéciﬁcation USDZ](https://openusd.org/release/spec_usdz.html), [Apple · Quick Look](https://developer.apple.com/quick-look-gallery/), [Blender · Wavefront OBJ](https://docs.blender.org/manual/en/latest/files/import_export/obj.html), [Blender · FBX](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_fbx.html).

[Guide complémentaire](/fr/guides/fichier-glb)

[Comment créer un modèle 3D](/learn/how-to-make-a-3d-model)

## Questions fréquentes

### Le GLB inclut-t-il toujours des textures ?

Le GLB peut inclure des textures, mais pas toujours—vérifiez la liste des ressources et les actifs intégrés du fichier pour confirmer. Examinez les métadonnées pour les URLs de textures et les chemins de fichiers afin de s'assurer qu'ils sont valides et accessibles. Vérifiez les URLs et les chemins des textures dans les métadonnées du GLB avant utilisation.

### Peut-on animer un OBJ ?

Oui, on peut animer un OBJ si le logiciel de destination le supporte. Envoyez un fichier OBJ avec MTL et textures pour tester l’animation. Le fichier s’ouvre mais peut manquer de textures ou de mouvement en raison d’un mauvais mappage.

### Ai-je besoin du fichier projet d'origine ?

Conservez le projet comme source éditable. Livrez le format requis par la destination, accompagné d'un référentiel visuel, afin de pouvoir le régénérer ultérieurement sans reconstruire la scène. Vérifiez les URLs et chemins des textures dans les métadonnées du GLB avant d’envoyer l’asset.
