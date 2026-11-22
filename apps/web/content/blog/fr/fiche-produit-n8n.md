---

group: "n8n-product-pages-images-3d"
title: "Créer une fiche produit avec n8n : texte, images et 3D"
description: "Créez un brouillon de fiche produit dans n8n avec un texte vérifié, des visuels et un modèle 3D. Gardez la main sur les dépenses et la publication."
date: 2026-11-18
updated: 2026-11-22
author: Jorge Rodríguez
authorType: person
keyword: "fiche produit n8n"
cta: "Importez une photo de votre produit et vérifiez l’aperçu gratuit avant de créer le modèle 3D."
---

Pour créer une fiche produit avec n8n, partez d’un catalogue vérifié. Préparez le texte d’un côté, les visuels et le modèle 3D de l’autre, puis réunissez-les par référence produit et version des données. Enregistrez la fiche en brouillon et faites approuver séparément le coût des vues, le coût du modèle 3D et la mise en ligne.

![Lampe de table dont la moitié droite laisse apparaître le maillage 3D](/blog/illustrations/n8n-product-pages-images-3d/hero.webp "Illustration éditoriale réalisée dans Blender.")

> **Commencez avec un seul article.** À la fin, vérifiez que le texte, les images et le modèle correspondent à la même variante avant de transmettre le brouillon pour validation.

![Le texte et les visuels se rejoignent par SKU et version des données dans une fiche en brouillon](/blog/figures/n8n-product-pages-images-3d/workflow-fr.webp "Schéma de préparation de la fiche dans n8n.")

## Quelles données transmettre à n8n ?

Prenez une lampe de table en céramique et créez un enregistrement commun aux deux branches. Si une caractéristique manque dans le catalogue, signalez-la pour vérification et laissez-la de côté dans le texte.

| Champ                            | Exemple                                                               | Utilité                                                              |
| -------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `sku`                            | `LAMP-CERAMIC-01`                                                     | Identifie la variante dans les deux branches                         |
| `source_version`                 | `photo-v2`                                                            | Distingue une nouvelle version du catalogue d’une nouvelle tentative |
| `name`, `material`, `dimensions` | Lampe de table, céramique confirmée, dimensions de la fiche technique | Fournit les caractéristiques à utiliser dans le texte                |
| `image_url`, `locale`            | Photo de référence, `fr-FR`                                           | Indique le visuel de départ et la langue de la fiche                 |

Le [modèle de workflow n8n pour Shopify](https://n8n.io/workflows/11695-generate-product-descriptions-from-images-and-publish-to-shopify-using-ai/) montre comment produire une description à partir d’une image. Pour le texte de votre fiche, ajoutez les données du fournisseur et demandez une réponse structurée.

> Rédigez un brouillon dans la langue demandée à partir des seules données vérifiées. Renvoyez `title`, `description`, `bullets`, `alt_text` et `missing_facts`. Indiquez les caractéristiques inconnues dans `missing_facts`. Ne publiez rien.

Vérifiez que les cinq champs sont présents et que les deux listes sont bien des tableaux. Conservez la référence et la version de l’enregistrement d’origine. Si la réponse est illisible ou s’il manque une donnée obligatoire, envoyez le brouillon en révision.

## À quoi ressemble le dossier à valider ?

Ce vase de la galerie EasyRender permet de comparer la photo, la planche de vues et le modèle exporté. Ouvrez le [modèle du vase](/showcase/vase.glb) à part pour comparer sa silhouette et sa finition à celles de la photo. Le GLB est la variante binaire du [format glTF](https://www.khronos.org/gltf/).

![Photo d’origine du vase, vues générées et image fixe du modèle 3D](/blog/figures/n8n-product-pages-images-3d/photo-angles-model.jpg "Exemple EasyRender. Les vues générées sont au centre et l’image fixe du modèle se trouve à droite.")

| Fichier            | Exemple                                                |
| ------------------ | ------------------------------------------------------ |
| Photo de référence | [Ouvrir la photo](/showcase/vase.jpg)                  |
| Vues à vérifier    | [Ouvrir la planche de vues](/showcase/vase-angles.jpg) |
| Modèle interactif  | [Télécharger le GLB](/showcase/vase.glb)               |

Dans n8n 2.48.5, nous avons changé l’ordre de réception des fichiers pour trois références de test. Le workflow a associé les deux GLB publics validés aux bons articles et contrôlé leur en-tête binaire et leur taille déclarée. Le fauteuil est resté en attente à cause d’une version de modèle obsolète.

| Référence       | Version                   | Résultat                                |
| --------------- | ------------------------- | --------------------------------------- |
| `VASE-DEMO-01`  | `v2`                      | Brouillon avec un GLB de 400 792 octets |
| `TABLE-DEMO-01` | `v3`                      | Brouillon avec un GLB de 326 872 octets |
| `CHAIR-DEMO-01` | Données `v3`, modèle `v2` | À contrôler manuellement                |

Le test local utilise des fichiers existants. La génération d’images, la création payante du modèle et la mise en ligne restent à tester séparément. [Importer le workflow d’exemple](/blog/figures/n8n-product-pages-images-3d/n8n-local-draft-workflow.json) ou [consulter le résultat](/blog/figures/n8n-product-pages-images-3d/n8n-local-draft-result.json).

## Comment générer et récupérer les visuels ?

Dans n8n, utilisez le nœud intégré [HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/). Enregistrez l’en-tête `Authorization` avec la valeur `Bearer YOUR_API_KEY` dans les identifiants de connexion. Remplacez-y le texte d’exemple et excluez la clé de tout export partagé.

1. Consultez le solde et le coût actuel du lot de vues via `GET https://easyrender.ai/api/credits`, puis faites valider la dépense. Pour une première vérification gratuite avec une photo, utilisez `POST /api/renders`.
2. Après validation du coût, envoyez `POST /api/product-views` avec `image_url`, `name` et, éventuellement, `prompt`. Enregistrez l’`id` renvoyé sous le nom `view_set_id`.
3. Vérifiez l’état via `GET /api/product-views/{id}`. Arrêtez si l’état passe à `failed` et respectez les limites de requêtes. Téléchargez chaque vue retenue via `GET /api/product-views/{id}/views/{view}` en utilisant son identifiant.
4. Après validation visuelle, appelez `POST /api/product-views/{id}/render` pour créer ou retrouver le brouillon de rendu. Enregistrez le champ `renderId` renvoyé.
5. Utilisez `renderId` pour la valeur de `{id}` dans `GET /api/renders/{id}`. Faites valider le nombre de crédits restant à payer, calculé avec `max(0, renderCredits - credits)`. Envoyez l’entier approuvé dans `maxCredits` via `POST /api/renders/{id}/render`.
6. Quand `status` vaut `ready` et `hasModel` vaut `true`, téléchargez le fichier avec une requête authentifiée à `GET /api/renders/{id}/model?download=1`.

Consultez le [schéma de l’API](https://easyrender.ai/api/openapi.json) pour les champs et les états. La demande de création du lot de vues ne dispose pas de champ `maxCredits`. Contrôlez la validation de la dépense dans n8n et utilisez une clé dédiée assortie d’un plafond de crédits.

## Comment envoyer le brouillon à la boutique ?

Réunissez le texte et les visuels sur `sku` et `source_version`. Enregistrez aussi les identifiants du lot de vues, du rendu et des médias dans la boutique. Si une requête payante ne répond pas, vérifiez que le service n’a pas déjà créé la tâche avant de la relancer.

Le [guide des médias Shopify](https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections/manage-media) détaille l’importation, le traitement du fichier et son rattachement au produit. Téléchargez le GLB privé avec la clé EasyRender, puis utilisez les identifiants de la boutique pour l’importer. Vérifiez le traitement du média avant de contrôler la fiche dans le thème.

| Situation                                         | Action                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| Le texte et le modèle se réfèrent à deux versions | Mettez le brouillon en attente et corrigez l’association                  |
| Shopify traite encore le fichier                  | Vérifiez son état avec l’identifiant du média                             |
| La variante, le texte et les médias sont corrects | Soumettez le brouillon à la personne chargée d’autoriser la mise en ligne |

Le [guide des modèles 3D pour le e-commerce](/fr/guides/modeles-3d-e-commerce) détaille les points à vérifier dans la boutique. Sur votre premier article, mesurez le temps de révision, le nombre de corrections et les crédits consommés avant de traiter plusieurs références automatiquement.

## FAQ

### Peut-on créer toute une fiche produit à partir d’une photo ?

n8n peut relier la génération du texte et des visuels à la création d’un brouillon dans votre boutique. Ajoutez les données vérifiées du catalogue à la photo. Le matériau, les dimensions et les certifications doivent venir du fournisseur ou d’une autre source fiable, puis être vérifiés avant la mise en ligne.

### Les vues et le modèle 3D sont-ils gratuits ?

L’aperçu à partir d’une photo est gratuit. La création d’un lot de vues consomme des crédits et la génération du modèle 3D donne lieu à une autre dépense. Vérifiez le coût avant chacune de ces deux étapes et prévoyez les éventuels frais du service de rédaction et de l’hébergement n8n.

### Faut-il un nœud EasyRender spécifique dans n8n ?

Le nœud HTTP Request intégré suffit pour ce workflow. Configurez les identifiants EasyRender une fois, puis réutilisez-les pour créer la tâche, vérifier son état et télécharger le fichier. Conservez les identifiants des tâches pour pouvoir reprendre les vérifications si le workflow atteint son délai maximum.

### Le workflow met-il automatiquement les produits en ligne ?

Ce workflow prépare un brouillon que vous pouvez contrôler dans le thème de la boutique. Pour publier automatiquement, ajoutez une étape distincte qui s’exécute uniquement après validation. Vérifiez au préalable la variante, l’ordre des images et l’ouverture du modèle dans la visionneuse de la fiche.
