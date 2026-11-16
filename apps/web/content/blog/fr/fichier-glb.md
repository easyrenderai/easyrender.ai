---

group: glb-file
title: "Fichier GLB : l’ouvrir, le vérifier, l’alléger"
description: "Un fichier GLB est un modèle 3D au format glTF 2.0 binaire : ce qu’il contient, comment l’ouvrir sur tout appareil, comment l’alléger et où il sert."
date: 2026-11-14
updated: 2026-11-14
author: Jorge Rodríguez
authorType: person
keyword: fichier glb
cta: "Si tu as une photo nette d’une lampe ou d’une chaise, tu peux la voir sous tous les angles avant qu’aucun GLB ne soit construit."
---

Un fichier GLB est un modèle 3D enregistré dans la version binaire de glTF 2.0, un format ouvert du Khronos Group. Un seul .glb contient la forme, les matériaux, les textures et une éventuelle animation, et se charge sur le web sans fichier annexe. C’est le format courant de la 3D sur les fiches produit et de l’AR sur Android.

![Illustration d’une théière céladon, la moitié gauche émaillée et la moitié droite en argile grise mate sous un maillage filaire blanc dont les panneaux UV se détachent du corps, sur fond sombre](/blog/illustrations/glb-file/hero.webp "Illustration, pas un résultat easyrender : une théière dessinée moitié en glaçure, moitié en maillage filaire dont les panneaux UV se détachent.")

## Que contient un fichier GLB ?

Un modèle glTF peut se présenter comme un fichier texte .gltf, accompagné d’images de texture séparées et d’un fichier .bin pour la géométrie. Le GLB réunit tout cela dans un seul fichier binaire, plus simple à importer, à envoyer par email et à héberger. La [spécification glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) définit les deux.

La structure est simple. Un en-tête de 12 octets contient le mot glTF, le numéro de version 2 et la longueur totale du fichier. Viennent ensuite deux blocs : un bloc JSON qui décrit la scène, et un bloc binaire avec la géométrie et les images.

Nous vérifions ces trois champs d’en-tête sur chaque modèle que nous livrons. Un fichier qui ne commence pas par glTF, qui n’est pas en version 2 ou dont la longueur annoncée diffère de la longueur réelle est refusé comme corrompu avant tout téléchargement, de même que tout fichier de moins de 20 000 octets.

![Le GLB du vase en terre cuite de cette page dessiné en proportion de ses octets : un bloc JSON de 1,4 Ko, puis un bloc binaire de 85 Ko d’indices de triangles, 164 Ko de positions de sommets et de coordonnées de texture et une texture WebP de 50 Ko, avec en dessous le même modèle en trois fichiers glTF séparés](diagram:glb-anatomy "L’intérieur du GLB du vase en terre cuite présenté plus bas, lu dans le fichier lui-même : 301 Ko au total. Avec une texture WebP de 1 024 pixels, la plupart des octets sont de la géométrie.")

Les chiffres de ce schéma se retrouvent à partir du nombre de triangles et de sommets. Le vase compte 14 590 triangles, et chacun désigne ses trois sommets avec 2 octets par sommet : 87 540 octets d’indices. Ses 8 406 sommets stockent chacun une position et une coordonnée de texture sur 20 octets : 168 120 octets.

## Quelle taille font de vrais fichiers GLB, et où passent les octets ?

Nous avons analysé de cette manière chaque modèle de notre vitrine. Les six ont un maillage, un matériau et une texture de couleur WebP de 1 024 pixels, compactés pour le web. Le fauteuil en bouclette, le fauteuil pivotant, le vase en grès et deux tables ont en plus des cartes de rugosité et de métal de 512 pixels pour leurs finitions.

| Modèle                | Poids du fichier (octets) | Triangles | Texture (octets) | Part de géométrie |
| --------------------- | ------------------------- | --------- | ---------------- | ----------------- |
| Vase en terre cuite   | 308 448                   | 14 590    | 51 354           | 83 %              |
| Vase en grès          | 400 792                   | 16 708    | 116 214          | 71 %              |
| Table basse ronde     | 326 872                   | 16 228    | 38 038           | 88 %              |
| Fauteuil pivotant     | 680 936                   | 24 268    | 218 394          | 68 %              |
| Fauteuil en bouclette | 622 804                   | 25 879    | 142 236          | 77 %              |
| Table de chevet       | 1 302 804                 | 69 910    | 55 770           | 96 %              |

On lit souvent que les textures sont la partie lourde d’un GLB. C’est vrai pour un fichier avec des PNG de 4 096 pixels. Dès que la texture est un WebP de 1 024 pixels, comme ici, la géométrie non compressée représente 68 % à 96 % de chaque fichier, et le poids dépend surtout du nombre de triangles.

## Que décrivent les matériaux d’un GLB ?

Les matériaux suivent le modèle PBR métal-rugosité. Le PBR, ou rendu physique réaliste, décrit une surface par sa couleur de base, son caractère métallique et sa rugosité. C’est pour cela qu’un même GLB a à peu près le même aspect dans toutes les visionneuses qui respectent le standard.

![L’unique image de texture du GLB du vase en terre cuite : la surface du vase découpée en morceaux et mise à plat, des anneaux de terre blanchie, le col et la base](/blog/figures/glb-file/clay-vase-texture.webp "La texture de couleur de base de ce GLB, extraite du fichier sans modification, 1024 sur 1024 pixels. Les coordonnées de texture indiquent à la visionneuse quel morceau va sur quelle partie du vase.")

Toute propriété absente d’un matériau prend une valeur par défaut définie par la spécification. L’une d’elles peut surprendre. Une valeur metallic non renseignée vaut 1, entièrement métallique : un matériau qui ne définit qu’une couleur de base s’affiche comme du métal brut. La terre, le bois et le tissu peuvent alors paraître plus sombres ou teintés.

Le contrôle tient en un réglage : Metallic à 0 sur le matériau dans Blender, puis un nouvel export. Nous ferions ce contrôle sur n’importe quel GLB avant de le mettre sur une fiche produit, quel que soit son auteur.

## Pourquoi un GLB peut-il paraître facetté ?

Les normales de sommets sont les directions, sommet par sommet, qu’utilise une visionneuse pour ombrer en douceur une surface courbe. Elles sont facultatives en glTF : un fichier peut ne contenir que des positions et des coordonnées de texture.

La spécification prévoit ce cas : sans normales, les visionneuses doivent en calculer des plates. Sur un maillage dense les facettes sont petites, mais sous une lumière latérale basse, une surface courbe peut laisser voir de légers pans plats.

Les normales coûtent 12 octets par sommet, trois nombres de 4 octets : un maillage de 8 000 sommets en représente environ 96 000 octets. Dans Blender, Lisser (Shade Smooth) puis un export avec Normales coché écrit des normales lisses. `gltf-transform inspect` indique si un fichier a un attribut NORMAL.

## Comment ouvrir un fichier GLB ?

Il te faut une visionneuse, pas un convertisseur. Celles-ci ouvrent les GLB sans configuration :

- Dans un navigateur : glisse le fichier dans le [Babylon.js Sandbox](https://sandbox.babylonjs.com/) ou dans l’[éditeur de model-viewer](https://modelviewer.dev/editor/).
- Dans Blender : [Fichier, Importer, glTF 2.0](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html) (.glb/.gltf).
- Dans du code : three.js et Babylon.js chargent directement le GLB, et Unity le lit avec le [paquet glTFast](https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.0/manual/index.html).
- Sur Android : [Scene Viewer](https://developers.google.com/ar/develop/scene-viewer) de Google ouvre un GLB lié depuis une page web, en 3D ou en réalité augmentée.

L’iPhone et l’iPad n’ouvrent pas les GLB dans AR Quick Look. La réalité augmentée d’Apple utilise l’USDZ : les boutiques qui veulent l’AR sur les deux systèmes gardent les deux fichiers.

![Un vase ancien en terre cuite sous forme de fichier GLB, ouvert dans model-viewer de Google et prêt à tourner](/showcase/clay-vase.glb "Un vrai GLB easyrender d’un vase ancien en terre cuite, ouvert dans model-viewer, le composant cité plus haut. Le fichier pèse 301 Ko : un maillage de 14 590 triangles et une texture WebP de 1 024 pixels, compactés avec glTF Transform.")

Une fois le fichier ouvert, fais-le tourner lentement. Regarde dessous, derrière, et de près les détails fins comme les poignées et les coutures.

Pour voir ce qu’il contient sans visionneuse, lance `gltf-transform inspect` de [glTF Transform](https://gltf-transform.dev/cli) sur le fichier. La commande liste chaque maillage, texture et extension, avec le nombre de sommets et les tailles : tu peux ainsi comparer un fichier au tableau ci-dessus.

## À quoi sert un fichier GLB ?

Sur les fiches produit, Shopify accepte les GLB comme médias produit. Sur un site que tu développes toi-même, le composant libre [model-viewer](https://modelviewer.dev/) de Google affiche un GLB avec quelques lignes de code, rotation et zoom compris.

Hors e-commerce, le GLB est courant dans la 3D web, le jeu vidéo et les applications de réalité augmentée, parce qu’il est compact, ouvert et lu par la plupart des logiciels 3D. Blender l’exporte, comme la plupart des outils de scan et d’IA.

Pour l’AR sur Android, le fichier doit respecter les limites de Scene Viewer : au maximum 10 Mo, 100 000 triangles et des textures de 2 048 pixels. Tous les fichiers du tableau ci-dessus respectent ces limites.

## Comment réduire le poids d’un fichier GLB ?

Pour voir l’effet de chaque commande, nous les avons lancées sur une copie de la table de chevet, le modèle qui a le plus de triangles dans le tableau ci-dessus, avec glTF Transform 4.5. Le nombre de triangles ne change pas, sauf si tu simplifies.

| Version de la table de chevet                                                | Poids (octets) | Triangles |
| ---------------------------------------------------------------------------- | -------------- | --------- |
| Telle qu’affichée sur ce site                                                | 1 287 432      | 69 910    |
| Géométrie compressée avec Meshopt (`gltf-transform meshopt`)                 | 422 480        | 69 910    |
| Géométrie compressée avec Draco (`gltf-transform draco`)                     | 235 776        | 69 910    |
| Simplifiée à la moitié des triangles (`gltf-transform simplify --ratio 0.5`) | 710 072        | 34 954    |

Draco a donné le plus petit fichier, 82 % plus léger. Meshopt a retiré 67 %, et sur le vase en terre cuite, il a fait passer le fichier de 308 448 à 135 740 octets. La simplification seule a moins réduit le poids que ces deux méthodes, parce que les triangles restants étaient toujours stockés sans compression.

La compression impose aussi des contraintes. La visionneuse doit gérer la compression : model-viewer et three.js savent décoder les deux, mais la documentation de Scene Viewer ne cite aucune de ces extensions. Contrôle un fichier compressé dans chaque visionneuse qu’il rencontrera avant de le mettre en ligne.

Notre verdict selon la destination :

- Ton propre site avec model-viewer : Meshopt ou Draco sur la géométrie et des textures WebP, puis vérifie que les arêtes ne s’arrondissent pas.
- L’AR sur Android avec Scene Viewer : un GLB simple avec des textures JPEG ou PNG de 2 048 pixels ou moins, simplifié seulement s’il dépasse 100 000 triangles.
- Shopify : importe le fichier non compressé, puisque Shopify optimise lui-même tout fichier de plus de 15 Mo.

## Comment obtenir un GLB depuis Blender, un scan ou une photo ?

Dans Blender, passe par Fichier, Exporter, glTF 2.0 et choisis le format glTF binaire (.glb), pour que les textures soient incluses dans le fichier. Coche Normales et UV dans la section Maillage, et choisis JPEG pour les images, sauf si le modèle a besoin de transparence. Les applications de scan et les outils d’IA proposent en général le GLB au téléchargement.

Les façons d’obtenir un modèle au départ, de la modélisation à une seule photo, sont comparées dans [comment faire un modèle 3D](/fr/guides/comment-faire-un-modele-3d). Pour un catalogue de boutique, [modèles 3D pour l’e-commerce](/fr/guides/modeles-3d-e-commerce) explique quelle voie convient à quel produit.

easyrender, par exemple, te remet un GLB et un USDZ pour chaque modèle terminé qu’il construit à partir d’une photo, selon les étapes de [comment créer un modèle 3D à partir d’une photo](/fr/guides/creer-un-modele-3d-a-partir-de-photos). Le modèle conserve la forme et les matières, pas les dimensions.

## Du GLB à l’USDZ : faut-il les deux ?

Pour la réalité augmentée sur iPhone et iPad, oui. Reality Converter, une application Mac gratuite d’Apple, transforme un GLB en USDZ, et les versions récentes de Blender exportent directement en USDZ. [Qu’est-ce qu’un fichier USDZ](/fr/guides/fichier-usdz) couvre le côté Apple, y compris pourquoi un USDZ peut peser plus que le GLB dont il est issu.

| Fichier | Contenu                                                                  | S’ouvre sur                                              | À utiliser pour                                    |
| ------- | ------------------------------------------------------------------------ | -------------------------------------------------------- | -------------------------------------------------- |
| GLB     | Un seul fichier binaire : géométrie, matériaux et textures               | Navigateurs, Blender, Scene Viewer sur Android           | Fiches produit, 3D web, AR sur Android             |
| glTF    | Un fichier JSON .gltf, un fichier .bin et des images de texture séparées | Les mêmes visionneuses, si les fichiers restent ensemble | Édition et inspection, puisque le JSON est lisible |
| USDZ    | Une archive zip non compressée de calques USD et de leurs images         | Quick Look sur iPhone, iPad et Mac                       | AR sur les appareils Apple                         |

## Quels problèmes peuvent survenir avec un GLB, et comment y remédier ?

La plupart des problèmes de GLB viennent de quelques causes. Voici la liste que nous suivons, de ce que tu vois à ce qu’il faut changer.

| Symptôme                                              | Cause                                                                             | Solution                                                             |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Le modèle est entièrement gris                        | Un .gltf enregistré sans ses fichiers de texture, ou un export sans images        | Exporte de nouveau en .glb binaire, pour intégrer les textures       |
| Le fichier pèse des dizaines de mégaoctets            | Des textures de 4 096 pixels, ou beaucoup de textures                             | Redimensionne les textures en 2048 ou 1024 et compresse la géométrie |
| Les surfaces courbes paraissent facettées             | Pas de normales de sommets : les visionneuses en dessinent des plates             | Lisser (Shade Smooth) dans Blender et export avec normales           |
| La terre ou le tissu paraissent sombres ou teintés    | Metallic non renseigné : la valeur par défaut, entièrement métallique, s’applique | Régle Metallic sur 0 et exporte de nouveau                           |
| Des zones noires, ou des parties vues de l’intérieur  | Des faces orientées dans le mauvais sens                                          | Dans Blender, recalcule les normales vers l’extérieur                |
| Il s’ouvre dans une visionneuse et pas dans une autre | Une extension glTF que la seconde ne gère pas, comme Draco ou les textures WebP   | Exporte une version simple pour cette visionneuse                    |
| Un import indique que le fichier n’est pas valide     | Un téléchargement interrompu : la longueur annoncée ne correspond pas             | Télécharge-le de nouveau et compare le poids du fichier              |

## Ce qu’un fichier GLB ne te dit pas

glTF mesure en mètres, mais un modèle n’a la bonne taille que si son auteur l’a réglée correctement. Un modèle généré à partir d’une photo n’a aucune dimension mesurée : garde les cotes dans le texte de la fiche.

Un GLB ne dit rien non plus de la qualité du modèle. Un fichier peut passer le [glTF Validator](https://github.khronos.org/glTF-Validator/) et avoir quand même un pied de chaise fondu ou une texture floue, ce que seul un coup d’œil dans une visionneuse révélera.

## FAQ

### GLB et glTF, c’est la même chose ?

Ce sont deux façons de stocker le même format. Le glTF peut être un fichier texte .gltf accompagné de fichiers de texture et de géométrie séparés. Le GLB est la version binaire qui réunit tout dans un seul fichier. Les deux suivent le standard glTF 2.0 du Khronos Group, et la plupart des outils qui lisent l’un lisent aussi l’autre.

### Peut-on ouvrir un fichier GLB sur un iPhone ?

Pas nativement dans AR Quick Look, qui utilise l’USDZ. Tu peux afficher un GLB dans le navigateur de l’iPhone avec une visionneuse web comme le Babylon.js Sandbox. Pour la réalité augmentée sur les appareils Apple, convertis le GLB en USDZ avec Reality Converter sur un Mac, ou demande les deux fichiers à ton outil.

### Comment convertir un GLB dans un autre format ?

Ouvre-le dans Blender, qui importe le GLB et exporte notamment en FBX, OBJ, USD et USDZ. Chaque conversion peut perdre des informations : l’OBJ, par exemple, ne connaît pas les matériaux métal-rugosité, et une poignée en laiton peut paraître terne après coup. Contrôle le fichier converti dans une visionneuse avant de l’utiliser là où un client le verra.

### Pourquoi mon fichier GLB est-il si lourd ?

Le plus souvent à cause de grandes textures, ou de la géométrie non compressée. Dans nos tests, Draco a fait passer un modèle de 69 910 triangles de 1 287 432 à 235 776 octets. Ramène les textures à 2 048 ou 1 024 pixels, compresse la géométrie avec glTF Transform, puis vérifie les surfaces dans une visionneuse.

### Pourquoi mon GLB est-il gris, sans texture ?

En général, les textures n’ont jamais été exportées : un modèle .gltf réempaqueté sans ses fichiers de texture, ou un outil qui n’exporte que la géométrie, donne une forme grise unie. Exporte de nouveau en .glb binaire pour intégrer les textures. S’il s’affiche bien dans le Babylon.js Sandbox mais pas dans une application, le problème vient de cette application.
