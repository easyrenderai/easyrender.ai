---

group: "import-furniture-models-into-sketchup"
title: "Importer un meuble 3D dans SketchUp"
description: "Importez un meuble au format GLB dans une version compatible de SketchUp et vérifiez les matériaux, la position et le composant."
date: 2026-12-15
updated: 2026-12-15
keyword: "importer des meubles 3D SketchUp"
cta: "Vérifiez les angles de votre produit dans l’aperçu gratuit."
---

Importez un modèle de meuble 3D 3D dans SketchUp en utilisant le menu Fichier > Importer. Vérifiez que votre édition de SketchUp supporte le format de fichier, puis vérifiez l'orientation, les faces et la mise en place des textures avant de le convertir en composant. Fixez les dimensions du projet selon les spécifications validées.

![Illustration : banc à dossier, moitié en matériau, moitié en fil de fer](../covers/import-furniture-models-into-sketchup.webp "Illustration éditoriale réalisée dans Blender.")

## Comment importer un GLB ?

Vérifiez les formats pris en charge par SketchUp selon votre édition. Si le GLB est disponible dans le menu Fichier > Importer, sélectionnez-le et examinez les options d’importation. Utilisez un fichier plus petit d’abord et enregistrez une copie avant de l’intégrer dans une scène client.

## Qu’est-ce que vous vérifiez après l’importation ?

Examinez-le dans un style neutre et observez le modèle de face avant et de haut. Vérifiez le contact avec le sol et les attributions de matériaux attendus. Groupez l’objet ou créez un composant, placez son origine où l’insertion est utile et réexaminez la scène.

## Qu’est-ce qu’il faut vérifier avant de publier ?

| Symptôme                                 | Où chercher                              |
| ---------------------------------------- | ---------------------------------------- |
| Type de fichier manquant                 | Version, plan et formats pris en charge  |
| Texture différente                       | Cartographie du matériau et style visuel |
| Difficulté à positionner des répétitions | Groupe et origine du composant           |

<!-- IMAGE PENDING: Photograph or capture the example described in the brief. -->

**Source** [SketchUp · travailler avec glTF](https://help.sketchup.com/en/sketchup/working-gltf-files), [SketchUp · importer des modèles](https://help.sketchup.com/en/sketchup-education/importing-models-components-and-images), [Khronos · spécification glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html).

[Bibliothèque de modèles (EN)](/models)

[Comment créer un modèle 3D](/learn/how-to-make-a-3d-model)

## Questions fréquentes

### Peut toute édition de SketchUp importer un GLB ?

Non, toutes les éditions de SketchUp ne supportent pas le format GLB. Utilisez le menu Fichier > Importer pour vérifier la compatibilité. Vérifiez la version de SketchUp et l’appareil avant d’importer, car un GLB peut manquer ou afficher une texture erronée.

### Peux-je utiliser un modèle de bibliothèque de meubles ?

Vous pouvez utiliser un modèle de meuble provenant d'une bibliothèque si celui-ci est autorisé pour l'usage commercial et s'il est compatible avec SketchUp. Importez le modèle seul en premier pour tester l'échelle, l'orientation et les performances avant de l'ajouter à un projet important. Vérifiez le format du fichier et la compatibilité avec la version de SketchUp.

### Qu'est-ce qui se passe si une texture change ?

Si une texture change, comparez-la avec le fichier source dans un lecteur séparé et vérifiez les paramètres de matière. Avant de copier le composant, assurez-vous que la matière est correctement attribuée dans SketchUp. Vérifiez l'alignement des UV et le chemin du fichier pour des incohérences.
