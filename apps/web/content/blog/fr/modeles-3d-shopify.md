---

group: "shopify-3d-models"
title: "Ajouter des modèles 3D aux produits Shopify"
description: "Ajoutez un GLB ou un USDZ dans Shopify et vérifiez le rendu dans la galerie de votre thème, sur ordinateur et sur mobile."
date: 2026-11-20
updated: 2026-11-24
author: Jorge Rodríguez
authorType: person
keyword: "modèles 3D Shopify"
cta: "Importez une photo de votre produit pour vérifier gratuitement ses différents angles."
---

Pour ajouter un modèle 3D dans Shopify, importez un fichier GLB ou USDZ dans les médias de la fiche produit. Ouvrez ensuite l’aperçu du thème de votre boutique sur ordinateur et sur mobile. Laissez une photo claire en tête de la galerie pour que le produit reste visible pendant le chargement du modèle.

![Carton d’expédition ouvert dont une moitié laisse apparaître le maillage](/blog/illustrations/shopify-3d-models/hero.webp "Illustration éditoriale réalisée dans Blender.")

## Quel fichier préparer ?

Commencez par un produit dont vous avez déjà de bonnes photos. Ouvrez le modèle dans une visionneuse autonome et faites-le pivoter pour vérifier le dos et le dessous. Notez la taille du fichier et contrôlez l’orientation, les textures et les finitions.

Les [conditions de Shopify pour les médias de produits](https://help.shopify.com/fr/manual/products/product-media/product-media-types) prévoient les formats GLB et USDZ, jusqu’à 500 Mo par fichier. Shopify optimise automatiquement les modèles de plus de 15 Mo. La [spécification glTF](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) décrit la structure des fichiers GLB.

![Modèle GLB d’un fauteuil pivotant EasyRender ouvert dans Blender](/blog/figures/shopify-3d-models/chair-inspection.webp "Nous avons ouvert le fichier GLB d’origine dans Blender. Vérifiez séparément le traitement dans Shopify et la galerie dans l’aperçu de votre boutique.")

| Vérification                            | Où la faire                                              |
| --------------------------------------- | -------------------------------------------------------- |
| Orientation, textures et finitions      | Dans la visionneuse avant l’importation                  |
| Taille du fichier et état du traitement | Dans les propriétés du fichier et les médias de la fiche |
| Vignette et ordre des médias            | Dans l’aperçu de la fiche avec votre thème               |

## Comment importer le modèle ?

1. Dans l’administration Shopify, ouvrez **Produits**, puis choisissez une fiche en brouillon pour ce premier essai.
2. Ajoutez le fichier dans la section **Supports multimédias**. Le [guide d’importation Shopify](https://help.shopify.com/fr/manual/products/product-media/add-media) détaille les étapes dans le navigateur et l’application.
3. Une fois le traitement terminé, enregistrez la fiche et ouvrez son aperçu. Laissez la photo principale au premier emplacement, puis sélectionnez le modèle et vérifiez que vous pouvez le faire pivoter.

| Problème                                                                    | Vérification à faire en premier                                                          |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Shopify refuse le fichier                                                   | Contrôlez le format et la taille                                                         |
| Le modèle apparaît dans l’administration, la visionneuse manque en boutique | Vérifiez la prise en charge des médias 3D dans le modèle de fiche du thème               |
| Le modèle s’ouvre, mais la réalité augmentée ne démarre pas                 | Vérifiez l’appareil, le navigateur et le fichier de réalité augmentée traité par Shopify |
| Le modèle précède la photo principale                                       | Vérifiez l’ordre des éléments dans les supports multimédias                              |
| Le modèle se charge lentement                                               | Mesurez le temps de chargement sur un téléphone                                          |
| La finition change après le traitement                                      | Comparez les fichiers dans des conditions d’éclairage similaires                         |

## Comment vérifier la galerie comme un client ?

Dans l’administration Shopify, ouvrez [l’aperçu du brouillon](https://help.shopify.com/fr/manual/products/add-update-products#preview-a-product). Si vous disposez d’un lien d’aperçu pour les visiteurs, ouvrez-le aussi dans une fenêtre de navigation privée.

Si la visionneuse ne s’affiche pas, contrôlez la version du thème et le composant qui affiche les médias. Vérifiez que la sélection d’un modèle laisse toujours accès aux photos.

| Appareil                  | Résultat à vérifier                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinateur                | La photo principale apparaît et le modèle peut pivoter                                                                                        |
| Smartphone                | La visionneuse reste utilisable et les photos restent accessibles                                                                             |
| Appareil Apple compatible | Si la réalité augmentée est proposée, [Quick Look](https://developer.apple.com/quick-look-gallery/) s’ouvre et vous pouvez revenir à la fiche |

Le [guide des modèles 3D pour l’e-commerce](/fr/guides/modeles-3d-e-commerce) montre comment préparer le fichier et l’intégrer au reste de la fiche produit.

## FAQ

### Tous les thèmes Shopify affichent-ils les modèles 3D ?

Consultez la liste des thèmes compatibles avec les médias 3D et vérifiez la version utilisée par votre boutique. Un modèle de fiche personnalisé peut demander une modification. Testez une fiche en brouillon sur un téléphone et contrôlez le passage de la photo au modèle, puis le retour aux images.

### Quel format choisir entre GLB et USDZ ?

Shopify accepte les deux formats. Choisissez le fichier dont vous avez vérifié l’orientation et les matériaux dans une visionneuse, puis conservez cet original pour les retouches. Une fois le traitement terminé, comparez le modèle affiché en boutique au fichier d’origine et vérifiez qu’il se charge sur un téléphone.

### Faut-il mettre le modèle avant la photo principale ?

Gardez une photo claire en premier et placez le modèle à un endroit où le client peut le retrouver facilement dans la galerie. Sur un téléphone, ouvrez le modèle, faites-le pivoter et vérifiez que vous pouvez revenir aux photos sans recharger la fiche.
