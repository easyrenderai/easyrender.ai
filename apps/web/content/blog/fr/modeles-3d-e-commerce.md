---

group: 3d-models-for-ecommerce
title: "Modèles 3D pour l’e-commerce : comment les obtenir"
description: "La 3D en e-commerce : ce qu’un modèle 3D apporte à une fiche produit, les fichiers utiles (GLB et USDZ), quatre façons d’en obtenir un et les limites."
date: 2026-11-13
updated: 2026-11-13
author: Jorge Rodríguez
authorType: person
keyword: modèle 3d pour ecommerce
cta: "Choisis un meuble qui a du volume, un fauteuil ou une enfilade, et regarde-le sous tous les angles avant de décider si la 3D vaut le coup pour ta boutique."
---

Faire de la 3D en e-commerce, c’est donner à un produit un modèle 3D, en général un GLB ou un USDZ, que l’acheteur fait tourner à l’écran et, sur téléphone, place dans sa pièce en réalité augmentée. On l’obtient de quatre façons : un modeleur 3D, les fichiers CAO du fabricant, un scan, ou l’IA à partir d’une photo.

![Illustration d’un mocassin en cuir marron à côté de sa boîte, l’avant du mocassin en vrai cuir et le talon en argile grise mate sous un maillage filaire blanc, sur fond sombre](/blog/illustrations/3d-models-for-ecommerce/hero.webp "Illustration, pas un résultat easyrender : un mocassin dessiné moitié en cuir, moitié en argile avec un maillage filaire, à côté de sa boîte.")

## Qu’apporte un modèle 3D à une fiche produit ?

Une photo montre le point de vue que tu as choisi. Un modèle 3D laisse l’acheteur choisir : l’arrière d’une bibliothèque, le dessous d’une table basse, l’épaisseur du coussin d’un fauteuil bas.

![Un fauteuil pivotant gris capitonné sur sa photo de catalogue, vu de dos et de trois-quarts](/showcase/swivel-chair.jpg "La photo de catalogue : une seule vue, de dos, choisie par le photographe.")
![Le même fauteuil pivotant gris sous forme de modèle 3D dans une visionneuse, que l’acheteur peut faire tourner pour voir la face et l’assise](/showcase/swivel-chair.glb "Le modèle qu’easyrender a construit à partir de cette photo : c’est l’acheteur qui choisit la vue. La face est une estimation, car la photo ne montre que le dos.")

Sur iPhone et iPad, un fichier USDZ s’ouvre dans [AR Quick Look](https://developer.apple.com/augmented-reality/quick-look/) et place l’objet dans la pièce à travers la caméra. Sur Android, [Scene Viewer](https://developers.google.com/ar/develop/scene-viewer) de Google fait de même avec un GLB.

La réalité augmentée montre l’allure d’un meuble dans une pièce. Sa taille vient du fichier, pas d’une mesure : Scene Viewer lit une unité du fichier comme un mètre, et un modèle généré à partir d’une photo s’ouvre à la taille que son fichier indique, quelle qu’elle soit. Les dimensions ont donc leur place dans le texte de la fiche.

## Comment savoir si la 3D est rentable pour toi ?

Avant de payer un modèle, définis ce que tu souhaites évaluer : les questions des acheteurs sur l’arrière ou la profondeur du meuble, les interactions avec le modèle ou les ajouts au panier.

Nous ne disposons pas de chiffres vérifiés sur les effets de la 3D sur les conversions ou les retours. Pour évaluer son intérêt sur ton catalogue, tu peux procéder ainsi.

Choisis cinq à dix produits qui recevront un modèle et un groupe comparable de produits similaires qui n’en auront pas. Ne change ni les prix, ni les photos, ni les textes des deux groupes pendant quatre à six semaines. Compare ensuite les ajouts au panier par vue de fiche entre les deux groupes, et les interactions avec les modèles.

Sur ton propre site, [model-viewer](https://github.com/google/model-viewer/blob/master/packages/model-viewer/src/features/ar.ts) émet des événements que tu peux envoyer à ton outil d’analyse. Un événement `camera-change` dont la source est `user-interaction` signifie que l’acheteur a fait tourner le modèle. Un événement `ar-status` signale le lancement ou l’échec d’une session AR, et `quick-look-button-tapped` se déclenche quand un iPhone passe la main à Quick Look.

## De quels fichiers une boutique a-t-elle besoin pour la 3D ?

Un GLB pour le web et Android, un USDZ pour la réalité augmentée sur les appareils Apple. La plupart des plateformes compatibles 3D acceptent l’un ou les deux.

![Un modèle produit décliné en deux fichiers : le GLB s’ouvre sur une fiche produit dans n’importe quel navigateur et en réalité augmentée sur Android via Scene Viewer, l’USDZ s’ouvre dans AR Quick Look sur iPhone et iPad](diagram:store-files "Un modèle, deux fichiers, trois endroits où l’acheteur le rencontre. Un site que tu développes toi-même peut servir les deux avec model-viewer.")

### Les modèles 3D sur Shopify

[Shopify accepte les modèles 3D comme médias produit](https://help.shopify.com/fr/manual/products/product-media/product-media-types), en GLB ou en USDZ, jusqu’à 500 Mo, au même endroit que les photos. Au-delà de 15 Mo, la géométrie et les textures sont optimisées à l’import. Shopify convertit chaque modèle pour qu’il existe toujours une version GLB et une version USDZ.

### WooCommerce et sites sur mesure

Les boutiques WooCommerce ajoutent la 3D avec des extensions, comme [Arty 3D Viewer](https://woocommerce.com/products/arty-3d-viewer/) sur la place de marché WooCommerce. Sur un site développé par tes soins, le composant libre de Google [model-viewer](https://modelviewer.dev/) affiche un GLB, et `ar-modes="webxr scene-viewer quick-look"` donne à chaque téléphone sa propre visionneuse AR.

### Quel poids viser pour un modèle produit ?

Shopify accepte de gros fichiers, mais des fichiers lourds peuvent ralentir le chargement sur le téléphone de l’acheteur. Scene Viewer publie des limites précises : nous comparons nos propres fichiers à ces limites.

| Budget           | Recommandation de Scene Viewer                 | Les six modèles de notre vitrine  |
| ---------------- | ---------------------------------------------- | --------------------------------- |
| Triangles        | Jusqu’à 100 000, idéalement 30 000 à 50 000    | De 14 590 à 69 910                |
| Texture          | 2048 x 2048 au maximum                         | Une texture de 1024 x 1024 chacun |
| Matériaux        | Jusqu’à 10                                     | Un chacun                         |
| Poids du fichier | 10 Mo ; au-delà, l’expérience peut se dégrader | De 308 448 à 1 287 432 octets     |

Scene Viewer liste aussi les extensions glTF qu’il prend en charge. Un fichier qui dépend d’une extension absente de la liste, comme les textures WebP, risque de ne pas s’ouvrir : pour l’AR sur Android, un GLB aux textures PNG ou JPEG est le plus sûr. Teste-le sur un vrai téléphone Android avant de le lier.

## Comment obtenir des modèles 3D de tes produits ?

Il y a quatre voies. Nous les jugeons sur quatre critères : faut-il avoir le produit sous la main, combien de ton temps cela prend-il, les faces cachées sont-elles fidèles, et où la méthode échoue-t-elle.

### Faire appel à un modeleur 3D

Un modeleur construit le modèle à partir de tes photos, plans et cotes, sans avoir besoin du produit. Cette voie demande le plus de temps pour le brief et les échanges. Sa fidélité dépend de la précision des références fournies. Sur Malt, Fiverr ou Upwork, les devis varient selon la complexité de la pièce.

Verdict : la bonne voie quand le modèle doit être exact, par exemple un canapé vendu en trois largeurs, ou pour le produit phare d’une campagne.

### Utiliser les fichiers CAO du fabricant

Si tu vends tes propres créations, l’usine a peut-être déjà des fichiers CAO ou SketchUp. Leur forme est exacte, mais ils sont rarement prêts pour le web : il leur faut en général de vraies textures et beaucoup moins de triangles pour bien se charger sur un téléphone.

Verdict : à demander en premier si les modèles sont à toi. Prévois le nettoyage, car un fichier d’usine peut porter bien plus de détails que les 100 000 triangles de Scene Viewer.

### Scanner le produit

Les applications de photogrammétrie comme Polycam et [RealityScan](https://dev.epicgames.com/documentation/realityscan-mobile/realityscan-step-by-step-guide) construisent un modèle à partir de nombreuses photos qui se chevauchent. RealityScan lance le calcul après 20 images et en accepte jusqu’à 300. Il te faut le meuble sous la main et la place d’en faire le tour complet.

Verdict : la meilleure voie pour des pièces texturées qui sont dans ta réserve, comme un fauteuil en rotin ou un buffet en chêne. Elle échoue sur le verre, les miroirs et le métal poli.

### Le générer avec l’IA à partir d’une photo

Les outils d’image vers 3D comme Meshy, Tripo et easyrender partent d’une seule image. C’est la seule voie quand tu as une photo fournisseur et pas d’accès au produit. La photo ne montre qu’un côté : contrôle l’arrière dans l’aperçu avant de garder le modèle.

![Neuf vues d’un vase en grès mat, dessinées à partir d’une seule photo produit](/showcase/vase-angles.jpg "Une planche de vues qu’easyrender a dessinée à partir d’une photo d’un vase en grès, sans retouche. Les objets ronds et mats comme celui-ci sont le cas facile.")

Verdict : la voie pour un catalogue construit à partir de photos fournisseur. Les logos fins, les tressages ajourés et une face que la photo n’a jamais montrée se lisent plus difficilement sur une seule image. Chaque voie, avec ce qu’elle demande et là où elle échoue, est détaillée dans [comment faire un modèle 3D](/fr/guides/comment-faire-un-modele-3d).

Le choix entre faire appel à quelqu’un et partir d’une photo est traité dans [modeleur 3D ou IA](/fr/comparatifs/modeleur-3d-ou-ia). Deux de ces outils sont examinés de plus près dans [Meshy](/fr/comparatifs/meshy) et [Tripo](/fr/comparatifs/tripo).

## Modèles 3D pour une boutique de meubles : par où commencer

Classe tes produits avant de faire le moindre modèle. Évalue chaque produit à partir de quatre questions : l’arrière ou la profondeur comptent-ils, le prix est-il assez élevé pour que l’acheteur hésite, te demande-t-on d’autres angles, et les retours parlent-ils de l’aspect ?

Commence par les cinq qui obtiennent la meilleure note. En général, ce sont un fauteuil, une enfilade ou un lampadaire à l’abat-jour travaillé. Les produits plats, comme une affiche encadrée ou un tapis, gagnent peu à la 3D.

Teste ensuite les voies avant de t’engager. Fais passer un même produit par deux d’entre elles, par exemple un scan au téléphone et un modèle image vers 3D de la même lampe à poser, et compare-les sur un téléphone. Tu en apprendras plus qu’avec n’importe quel tableau de fonctionnalités.

Pour un grand catalogue, compare les options de traitement par lots et le prix par modèle. Commence par un produit dans Easy Render. L’aperçu est gratuit dans la limite de ton quota quotidien. Lance la création du modèle 3D si le résultat te convient.

## Comment ajouter la 3D à une boutique, étape par étape ?

Voici l’ordre que nous suivrions pour un premier lot :

1. Choisis cinq produits avec les quatre questions ci-dessus.
2. Faites chaque modèle par la voie qui lui convient.
3. Contrôle chaque modèle : le nombre de pieds et de portes, l’arrière, la texture en plein écran.
4. Adapte chaque fichier aux limites de la visionneuse : textures de 2 048 pixels ou moins, géométrie compressée si ta visionneuse le permet.
5. Importe avec les outils de la plateforme, comme les médias produit de Shopify.
6. Ouvre chaque fiche sur un iPhone et sur un téléphone Android en données mobiles, et teste la réalité augmentée sur les deux.
7. Mesure pendant quatre à six semaines comme décrit plus haut, puis décide du lot suivant.

## Un exemple : une enfilade en noyer

Imaginons une boutique qui a trois photos fournisseur d’une enfilade en noyer : une de face, une de trois-quarts et un gros plan des poignées en laiton. C’est la vue de trois-quarts qu’il faut donner à l’outil d’image vers 3D, parce qu’elle montre la profondeur et un côté.

![Trois photos fournisseur d’une enfilade dessinées sous forme de cadres : une vue de face sans profondeur, une vue de trois-quarts qui montre la façade et un côté, marquée comme celle à utiliser, et un gros plan d’une poignée barre](diagram:sideboard-photo-pick "Des trois photos du fournisseur, seule la vue de trois-quarts montre le côté : l’outil a moins de profondeur à deviner. Un dessin pour cet exemple, pas une vraie annonce.")

Attends-toi à ce que les portes, les pieds et le fil du bois ressortent bien. Compare les poignées en laiton avec le gros plan, car la petite quincaillerie est le premier détail que toute méthode perd, et regarde de près l’arrière, que l’outil n’a jamais vu.

Importe ensuite le GLB avec les outils de ta plateforme et ouvre la fiche sur un iPhone et sur un téléphone Android avant de publier. Sur Shopify, l’USDZ pour l’iPhone est créé pour toi à partir du même import.

## Quels problèmes peuvent survenir quand une boutique ajoute la 3D ?

La plupart des problèmes n’apparaissent que sur un vrai téléphone : c’est la raison d’être de l’étape 6. Voici ceux à surveiller, avec la solution pour chacun.

| Symptôme                                    | Cause                                                                                      | Solution                                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pas de bouton AR sur un téléphone Android   | Scene Viewer ne charge les fichiers qu’en HTTPS, ou le téléphone n’est pas compatible      | Sers le GLB en HTTPS et teste sur un second téléphone                                                                                                          |
| Pas d’AR sur iPhone depuis ton propre site  | Pas d’USDZ, ou un USDZ servi avec le mauvais type de contenu                               | Ajoute l’USDZ et sers-le en `model/vnd.usdz+zip`, le type [qu’attend Safari](https://webkit.org/blog/8421/viewing-augmented-reality-assets-in-safari-for-ios/) |
| Le meuble s’ouvre énorme ou minuscule en AR | L’AR utilise la taille enregistrée dans le fichier, qui n’a jamais été mesurée             | Indique les dimensions dans le texte ; l’acheteur peut pincer pour redimensionner                                                                              |
| Le meuble flotte au-dessus du sol           | Le bas du modèle se trouve au-dessus de son origine                                        | Place l’origine à la base dans Blender avant d’exporter                                                                                                        |
| La fiche est lente en données mobiles       | Textures de 4 096 pixels ou géométrie non compressée                                       | Textures en 2048 ou 1024, et compression Draco ou Meshopt si la visionneuse la gère                                                                            |
| Le modèle paraît sombre ou sale en AR       | Des ombres incrustées dans la texture, ce que Scene Viewer déconseille                     | Utilise une texture sans ombres incrustées, et régle Metallic sur 0 si le matériau ne le définit pas                                                           |
| Le GLB ne s’ouvre pas dans Scene Viewer     | Il utilise une extension glTF absente de la liste de Scene Viewer, comme les textures WebP | Exporte une version simple avec des textures PNG ou JPEG                                                                                                       |

## Quelles sont les limites de la 3D en e-commerce ?

Un modèle généré à partir d’une photo montre la forme et les matières, pas les dimensions. Garde les cotes dans le texte de la fiche, et ne déduis pas les dimensions du meuble de son affichage en réalité augmentée.

Les produits transparents ou réfléchissants, comme un vase en verre ou une lampe chromée, posent problème à toutes les méthodes. Les petits textes et les petits logos ressortent flous.

La 3D ne remplace pas les photos. Les plateformes utilisent toujours des images fixes dans les résultats de recherche, les publicités et les grilles de catégorie : les bases de la [photographie produit pour l’e-commerce](/fr/guides/photographie-produit-e-commerce) restent valables.

## FAQ

### Ma boutique en ligne a-t-elle besoin de modèles 3D ?

Pas pour tous les produits. La 3D aide surtout là où l’acheteur veut voir la profondeur et l’arrière : chaises, canapés, enfilades, lampes. Pour les objets plats ou très simples, de bonnes photos suffisent. Commence par quelques produits pour lesquels on te demande d’autres angles, et juge sur pièce plutôt que de convertir tout le catalogue d’un coup.

### Quel format de fichier 3D pour une boutique en ligne ?

Deux, le plus souvent : le GLB pour le web et la réalité augmentée sur Android, et l’USDZ, que l’iPhone et l’iPad ouvrent dans AR Quick Look. Shopify accepte l’un ou l’autre et convertit chaque modèle pour avoir les deux versions. Si un outil ne t’en donne qu’un, Reality Converter d’Apple ou Blender peut créer l’autre.

### Quel poids pour un fichier de modèle 3D produit ?

Assez léger pour un téléphone en données mobiles. Scene Viewer de Google recommande au maximum 10 Mo, 100 000 triangles et des textures de 2 048 pixels, idéalement 30 000 à 50 000 triangles. Shopify accepte jusqu’à 500 Mo et optimise tout fichier de plus de 15 Mo, mais un fichier léger se charge toujours plus vite.

### Combien coûte un modèle 3D pour l’e-commerce ?

Cela dépend de la voie. Les modeleurs facturent au modèle selon la complexité, les applications de scan fonctionnent le plus souvent par abonnement, et les outils d’IA facturent au modèle ou au mois. Chez easyrender, l’aperçu est gratuit et un modèle terminé coûte {{renderCredits}} crédits ({{renderPrice}}) ; les crédits s’achètent à l’unité, ou {{proCredits}} par mois avec Pro pour {{proPrice}}.

### Peut-on se fier aux dimensions du modèle en réalité augmentée ?

Non pour un modèle généré à partir d’une photo : ses dimensions ne sont pas mesurées. La réalité augmentée permet d’en voir l’allure chez soi avec AR Quick Look sur iPhone et iPad, ou Scene Viewer sur Android. Pour connaître les dimensions du meuble, consulte les mesures indiquées dans le texte de la fiche produit.
