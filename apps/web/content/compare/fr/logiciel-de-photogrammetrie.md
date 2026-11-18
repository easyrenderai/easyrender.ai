---

group: compare-photogrammetry-software
title: "Logiciel de photogrammétrie ou IA : que choisir ?"
description: "Logiciels de photogrammétrie face à l’IA sur une photo : RealityScan, Metashape, Meshroom, Polycam et Zephyr, photos requises, prix et cas d’usage."
keyword: logiciel de photogrammétrie
date: 2026-11-11
updated: 2026-11-11
author: Jorge Rodríguez
authorType: person
cta: "Si tu n’as qu’une photo de catalogue du meuble, regarde-le gratuitement sous tous les angles avant de décider s’il mérite vraiment un scan."
---

Un logiciel de photogrammétrie construit un modèle 3D à partir de nombreuses photos d’un objet que tu as devant toi, avec un recouvrement entre les vues. RealityScan, Agisoft Metashape, Meshroom, Polycam et 3DF Zephyr sont les choix courants. Avec une seule photo, comme le cliché de catalogue d’un fournisseur, il faut plutôt un outil d’image vers 3D.

![Illustration d’un buste en marbre fissuré, une moitié en pierre et l’autre en argile grise mate sous un maillage filaire blanc, entouré de fines pyramides de caméras blanches sur fond sombre](/compare/illustrations/photogrammetry-software/hero.webp "Illustration, pas un résultat easyrender : un buste en marbre dessiné moitié en pierre sculptée, moitié en argile avec un maillage filaire, entouré de positions de caméra.")

## As-tu vraiment besoin d’un logiciel de photogrammétrie ?

Pose-toi d’abord une question : peux-tu faire le tour de l’objet ? La photogrammétrie ne mesure que ce que l’appareil a vu : il lui faut la pièce entre tes mains, un après-midi libre et un espace dégagé. Le guide RealityScan d’Epic le dit sans détour : ce qui n’est pas visible sur plusieurs images n’apparaîtra pas dans le modèle.

Si le meuble est dans l’entrepôt d’un fournisseur, ou si tu as tout un catalogue de photos produit, tu n’auras qu’une photo par pièce. C’est le cas pour lequel existe l’IA à partir d’une photo, décrite pas à pas dans [comment créer un modèle 3D à partir d’une photo](/fr/guides/creer-un-modele-3d-a-partir-de-photos).

## Comment fonctionne un logiciel de photogrammétrie ?

Le logiciel repère les mêmes points sur des photos qui se chevauchent, calcule la position de chaque prise de vue, puis construit un maillage, c’est-à-dire la structure du modèle, auquel il applique une texture tirée des photos. Tous les outils suivent les mêmes règles de prise de vue, puisqu’ils associent tous des points d’une image à l’autre.

1. Choisis un objet immobile. Le [guide Object Capture d’Apple](https://developer.apple.com/documentation/realitykit/capturing-photographs-for-realitykit-object-capture) déconseille les objets mous ou souples qui se déforment quand on les déplace, et ceux qui sont très fins, réfléchissants, transparents ou d’une seule couleur unie.
2. Éclaire en lumière douce. Apple cite le flash de l’appareil, le soleil direct et les ampoules nues parmi les problèmes ; le manuel de Meshroom dit de ne pas utiliser de flash du tout. Un jour couvert convient.
3. Verrouille l’appareil. Garde zoom, ouverture, vitesse et ISO fixes. Sur iPhone, maintiens le doigt sur l’aperçu jusqu’à l’apparition de « Verrouillage AE/AF ».
4. Photographie avec un fort recouvrement. Apple demande 70 % de recouvrement ou plus entre deux prises voisines et prévient qu’en dessous de 50 %, le calcul peut échouer. Le manuel de Meshroom demande au moins 60 % de recouvrement latéral et 80 % de recouvrement frontal.
5. Tourne autour de l’objet à plusieurs hauteurs. RealityScan demande des cercles et des arcs à plusieurs hauteurs, l’objet occupant au moins la moitié de chaque image.
6. Photographie le dessous. Apple suggère un plateau tournant et de poser l’objet sur différentes faces, pour que le modèle n’ait pas de trou en dessous.
7. Masque l’arrière-plan, puis lance le calcul. L’application mobile RealityScan commence l’analyse après 20 images et s’arrête à 300.

Prends une table d’appoint en teck : trois cercles en lumière douce, puis une série du dessous, la table couchée sur le côté. Le fil du bois fournit au logiciel des points à faire correspondre, et c’est pour cela que le bois se scanne bien.

## Quel logiciel de photogrammétrie choisir ?

Les outils diffèrent moins par la méthode que par l’endroit où ils tournent et leur licence. Prix relevés en novembre 2026.

| Outil                  | Fonctionne sur                                              | Prix et licence                                                                                                        | Limites de photos et remarques                                                    |
| ---------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| RealityScan (Epic)     | Application de bureau, plus une application mobile gratuite | Gratuit sous 1 million de dollars de chiffre d’affaires sur les 12 derniers mois ; 1 250 $ par poste et par an au-delà | L’application mobile analyse après 20 images, limite à 300                        |
| Agisoft Metashape      | Windows, macOS, Linux                                       | Standard 179 $, Professional 3 499 $, licences perpétuelles ; essai gratuit de 30 jours                                | La Standard couvre la génération du modèle et la texture                          |
| Meshroom (AliceVision) | Windows, Linux                                              | Libre, licence MPL-2.0                                                                                                 | Accéléré par GPU ; le manuel demande 60 % de recouvrement latéral et 80 % frontal |
| Polycam                | Application iPhone et Android                               | Gratuit avec 10 captures en photogrammétrie ; Basic à 150 $ par an ou 30 $ par mois                                    | 150 images par capture en gratuit, 300 en Basic                                   |
| 3DF Zephyr             | Bureau                                                      | Gratuit jusqu’à 50 photos ; Lite 199 € HT perpétuelle ; version complète 250 € HT par mois ou 4 200 € HT perpétuelle   | La version gratuite exporte des maillages texturés en JPG uniquement              |

Sources : [licence RealityScan](https://www.realityscan.com/en-US/license), [accueil RealityScan](https://www.realityscan.com/en-US), [guide mobile RealityScan](https://dev.epicgames.com/documentation/realityscan-mobile/realityscan-step-by-step-guide), [boutique Metashape](https://www.agisoft.com/buy/online-store/) et [installateurs](https://www.agisoft.com/downloads/installer/), [AliceVision](https://alicevision.org/) et le [manuel de prise de vue de Meshroom](https://meshroom-manual.readthedocs.io/en/latest/capturing/capturing.html), [tarifs Polycam](https://poly.cam/pricing), [3DF Zephyr](https://www.3dflow.net/3df-zephyr-photogrammetry-software/). Toutes consultées le 11 novembre 2026.

Meshroom ne coûte rien et convient à qui veut apprendre une application de bureau à nœuds, sur Windows ou Linux avec une carte graphique (GPU). RealityScan est gratuit pour la plupart des petites boutiques et couvre le téléphone comme l’ordinateur. Metashape existe pour Windows, macOS et Linux, avec un essai de 30 jours sur tes propres pièces.

Polycam est une option accessible pour commencer si tu veux scanner avec ton téléphone, et ses offres payantes exportent en GLTF, OBJ, FBX, DAE et USDZ. Zephyr Free est un bon moyen de tester un petit objet, tant qu’il tient en 50 photos.

## En quoi l’IA à partir d’une photo est-elle différente ?

L’image vers 3D part d’une seule photo et estime les faces que l’appareil n’a pas vues. Elle n’associe pas de points entre des photos : pas besoin de recouvrement, de cercles ni de plateau tournant. Il lui faut une seule photo nette et bien éclairée de l’objet entier sur un fond uni.

easyrender fonctionne ainsi, en deux temps. Il dessine d’abord une planche de vues gratuite : neuf vues de l’objet, huit autour par intervalles de 45 degrés et une de dessus. Tu contrôles cette planche, et tu ne dépenses des crédits que si elle est juste.

L’outil utilise ensuite ces neuf vues et produit un seul modèle texturé, téléchargé en GLB et en USDZ. Un modèle coûte {{renderCredits}} crédits, soit {{renderPrice}}, et la [page des tarifs](/fr/tarifs) liste les packs. [Envoie une photo](/fr#try) pour voir la planche de vues gratuitement.

## Que cherches-tu à obtenir, et comment le mesurer ?

Fixe l’objectif avant de choisir l’outil. Chaque objectif ci-dessous s’accompagne d’un contrôle que tu peux faire toi-même.

- Un relevé fidèle d’une surface, comme un cuir usé ou le fil d’un chêne. Affiche la texture en plein écran à côté de la vraie pièce. La photogrammétrie copie la surface à partir des photos : c’est ce qui justifie le temps de préparation.
- Un objet complet, sans trou. Fais tourner le modèle et arrête-toi sur la base, l’arrière des pieds et chaque creux profond. Chaque trou est une partie que les photos ont manquée.
- Un modèle pour chaque produit d’un catalogue. Chronométre une pièce, de l’installation au fichier fini, puis multiplie par le catalogue avant de t’engager sur une méthode.
- Le modèle d’un produit que tu ne peux pas toucher. La photogrammétrie ne peut pas démarrer. Juge un résultat d’image vers 3D en comptant les pieds, les portes et les poignées dans chaque vue.
- Un coût par modèle connu. Pour une licence, divise le prix par le nombre de modèles que tu feras pendant sa durée. Pour des crédits, lis le prix par modèle sur la page des tarifs.

## Quels problèmes peuvent survenir en photogrammétrie, et comment y remédier ?

La plupart des scans ratés viennent de la prise de vue, pas du logiciel. Voici les points à vérifier en cas de mauvais résultat, du symptôme à la solution.

| Symptôme                                               | Cause                                                                   | Solution                                                                             |
| ------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Des trous dans un plateau de table blanc uni           | Une surface unie ne fournit pas de points distinctifs au logiciel       | Éclaire en lumière rasante, ou passe par une autre méthode pour cette pièce          |
| Le calcul échoue ou le modèle est informe              | Moins de 50 % de recouvrement entre prises voisines                     | Refais la série avec 70 % ou plus, en plus petits pas                                |
| La base manque ou se soude au sol                      | Le dessous n’a jamais été photographié                                  | Fais une seconde série, la pièce couchée sur le côté, ou utilise un plateau tournant |
| Des poignées chromées ou un miroir ressortent bosselés | Les reflets changent d’une photo à l’autre                              | Évite les pièces réfléchissantes, ou accepte ces parties et modélise-les à part      |
| Des zones floues et une texture décalée                | Le zoom, l’exposition ou la mise au point ont changé en cours de séance | Verrouille AE/AF, garde une seule focale, et écarte les images bougées               |
| Des taches sombres incrustées dans la texture          | Des ombres dures dues au flash ou au soleil direct                      | Diffuse la lumière, ou photographie par temps couvert                                |
| Des morceaux du décor collés à l’objet                 | Un arrière-plan chargé dans le cadre                                    | Utilise un fond uni et masque l’arrière-plan sur chaque image                        |
| La version gratuite n’importe plus de photos           | 3DF Zephyr Free limite un projet à 50 photos                            | Garde les 50 meilleures, ou passe à une version sans limite de photos                |

## Ce que nous utiliserions, au cas par cas

Voici comment nous choisirions, notre propre produit compris.

Une pièce dans ta réserve, à la surface texturée, comme un coffre en chêne sculpté, et une heure devant toi : la photogrammétrie. Elle enregistre la surface telle qu’elle est, et RealityScan ou Meshroom ne coûtent rien à essayer.

La photo fournisseur d’une enfilade que tu n’as jamais vue en vrai : l’IA à partir d’une photo. Il n’y a rien à scanner, et tu peux juger la planche de vues gratuite avant de dépenser quoi que ce soit.

Tout un catalogue de photos produit et pas de studio : l’IA à partir d’une photo, par lots depuis ta bibliothèque ou par un agent. Un scan par produit, c’est une séance par produit.

Un vase en verre ou une lampe en acier poli : aucune des deux méthodes ne gère bien les surfaces miroir. Les documentations de photogrammétrie disent de les éviter : prévois un modeleur 3D pour celle-là.

## FAQ

### Quel est le meilleur logiciel de photogrammétrie gratuit ?

Meshroom est libre, sous licence MPL-2.0, et tourne sur Windows et Linux. RealityScan est gratuit pour les particuliers et les entreprises sous 1 million de dollars de chiffre d’affaires sur 12 mois. L’offre gratuite de Polycam inclut 10 captures en photogrammétrie, et 3DF Zephyr Free accepte 50 photos. Tout dépend de ton ordinateur et de ton téléphone.

### Combien de photos faut-il en photogrammétrie ?

Les outils fixent le plancher par le recouvrement plutôt que par un nombre. Apple demande 70 % de recouvrement entre prises voisines, Meshroom 60 % latéral et 80 % frontal. L’application mobile RealityScan commence l’analyse après 20 images et en accepte jusqu’à 300. Les objets complexes, avec des creux, en demandent davantage, car chaque creux doit apparaître sur plusieurs photos.

### La photogrammétrie est-elle meilleure que l’IA image vers 3D ?

Elles répondent à des problèmes différents. La photogrammétrie reconstruit l’objet à partir de nombreuses vraies photos : il lui faut l’objet sous la main. L’image vers 3D part d’une seule photo d’une pièce que tu ne toucheras peut-être jamais. Si tu peux scanner et que la surface compte, scanne. Si tu n’as qu’une photo, seule l’image vers 3D peut démarrer.

### La photogrammétrie peut-elle scanner le verre, les miroirs ou le chrome ?

Pas de façon fiable. Le guide d’Apple déconseille les objets réfléchissants, transparents ou translucides, et le manuel de Meshroom dit d’éviter les reflets et la transparence. Apple suggère de peindre la surface pour lui donner de la texture, ce qu’on ne fait pas sur un stock à vendre. Pour ces pièces, un modeleur 3D travaillant d’après photos est plus sûr.
