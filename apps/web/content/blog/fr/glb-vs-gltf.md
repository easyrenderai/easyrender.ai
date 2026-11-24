---

group: "glb-vs-gltf"
title: "GLB ou glTF pour livrer un modèle 3D ?"
description: "Comparez le même modèle en GLB et en glTF séparé. Taille totale, textures externes et test dans la visionneuse de destination."
date: 2026-11-25
updated: 2026-11-25
author: Jorge Rodríguez
authorType: person
keyword: "GLB ou glTF"
cta: "Explorez gratuitement plusieurs angles à partir d’une photo de produit."
---

**Choisissez le GLB pour transmettre un fichier unique.** L’export glTF en fichiers séparés vous permet d’examiner individuellement le JSON, le fichier binaire et les images de texture. Lors de notre essai, Blender chargeait encore la géométrie sans l’image de texture. L’import échouait en l’absence du fichier BIN.

![Vase rond avec sa surface d’un côté et son maillage de l’autre](/blog/illustrations/glb-vs-gltf/hero.webp "Illustration éditoriale réalisée dans Blender.")

## Quelle différence de poids pour le même vase ?

Nous avons exporté deux fois le même vase dans Blender 5.2.3. Le GLB pesait **1 732 772 octets**. L’export séparé contenait un JSON de 2 124 octets, un fichier BIN de 1 702 680 octets et une image WebP de 28 466 octets.

Avec ces réglages, le poids total était presque identique. Additionnez les fichiers de l’export séparé avant de le comparer au GLB. Les réglages d’export et l’encodage des textures peuvent modifier le résultat.

![Rendu du vase après réimportation de l’export glTF séparé dans Blender](/blog/figures/glb-vs-gltf/vase-gltf-render.jpg "Export glTF séparé rouvert dans Blender avec le BIN et le WebP à côté du JSON.")

Nous avons retiré un fichier à la fois de deux copies de l’export séparé. Sans le WebP, Blender chargeait la géométrie mais l’entrée d’image ne contenait aucun pixel. Sans le BIN, Blender interrompait l’importation.

Avant la livraison, répétez les deux essais sur des copies placées dans des dossiers distincts. Ouvrez ensuite l’export complet sur l’ordinateur du destinataire.

## Comment vérifier la livraison ?

Pour transmettre un fichier unique, copiez seulement le GLB dans un dossier vide et ouvrez-le hors connexion. Pour un glTF séparé, déplacez le dossier d’export complet. Si une texture manque, comparez son URI dans le JSON avec le nom et le chemin du fichier à destination.

## Quel export choisir selon la destination ?

| Destination                                  | Fichiers à livrer                                         |
| -------------------------------------------- | --------------------------------------------------------- |
| E-mail ou catalogue en ligne                 | GLB autonome, vérifié dans un dossier vide                |
| Diagnostic d’un matériau                     | glTF séparé, avec le fichier BIN et l’image               |
| Serveur web avec mise en cache par ressource | Fichiers distincts, en vérifiant les requêtes nécessaires |

## Que se passe-t-il lorsqu’un fichier manque ?

| Copie ouverte         | Résultat dans Blender                                       |
| --------------------- | ----------------------------------------------------------- |
| GLB seul              | La géométrie et la texture se chargent                      |
| glTF avec BIN et WebP | La géométrie et la texture se chargent                      |
| glTF sans le WebP     | La géométrie s’affiche sans la texture                      |
| glTF sans le BIN      | L’importation échoue et Blender signale le fichier manquant |

## Quels fichiers garder ensemble ?

| Fichier     | Rôle                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------ |
| JSON glTF   | Ouvrez ce fichier pour charger la scène                                                          |
| Fichier BIN | Conservez-le à l’emplacement indiqué dans le JSON                                                |
| Images      | Respectez les chemins et la casse. Ouvrez ensuite l’export dans son environnement de destination |

Pour la structure des deux formats, consultez la [spécification glTF](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html). Contrôlez les fichiers avec le [validateur glTF de Khronos](https://github.com/KhronosGroup/glTF-Validator). Les réglages d’export figurent dans le [manuel de Blender](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html).

[Qu’est-ce qu’un fichier GLB ?](/fr/guides/fichier-glb)

## Questions fréquentes

### Un format est-il toujours plus léger que l’autre ?

Le poids dépend des données exportées et de l’encodage des textures. Exportez le même modèle dans les deux formats avec des réglages comparables. Pour le glTF séparé, comptez le JSON, le BIN et chaque image avant de comparer. Dans notre essai, les trois fichiers réunis pesaient 1 733 270 octets.

### Un fichier GLB peut-il référencer des ressources externes ?

Oui. Si vous avez besoin d’un fichier autonome, placez uniquement le GLB dans un dossier vide et ouvrez-le hors connexion dans la visionneuse prévue. Vérifiez que la géométrie et les textures s’affichent. Recherchez en particulier celles qui disparaissent une fois le fichier déplacé.

### Pourquoi le même modèle change-t-il d’aspect selon la visionneuse ?

L’éclairage, le mappage des tons et la prise en charge des matériaux ou des extensions peuvent varier. Comparez les exports dans la même visionneuse avec les mêmes réglages. Si une texture disparaît quand vous déplacez l’export séparé, vérifiez son URI et le chemin de l’image.
