---

group: how-to-make-a-3d-model
title: "Come creare un modello 3D: cinque metodi, anche da una foto"
description: "Come creare un modello 3D in cinque modi, da Blender a una sola foto: cosa serve a ciascun metodo, quanto tempo chiede, dove fallisce e come scegliere."
date: 2026-11-16
keyword: come creare un modello 3d
author: Jorge Rodríguez
authorType: person
cta: Se hai una foto nitida di una sedia, di una lampada o di una madia, puoi vederla da ogni angolazione prima di decidere se vale la pena farne un modello.
---

Puoi creare un modello 3D in cinque modi: costruirlo in un programma come Blender, scansionare l'oggetto con la fotogrammetria, scansionarlo con il sensore LiDAR del telefono, generarlo con l'IA da una foto oppure incaricare un artista 3D. Quale ti conviene dipende da tre cose: se l'oggetto esiste, se lo hai a disposizione e quanto tempo hai.

## Quale metodo scegliere?

Se l'oggetto non esiste ancora, modellalo in un programma o incarica un artista. Se esiste ed è davanti a te, scansionalo. Se di quell'oggetto hai solo una foto, usa il metodo da immagine a 3D.

Il metodo incide sulla fedeltà del risultato. Un artista lavora sui riferimenti che gli fornisci; l'IA da una foto richiede meno preparazione, ma deve stimare il retro dell'oggetto.

| Metodo                     | Cosa ti serve                                         | Ideale per                                             | Attenzione a                                      |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------- |
| Modellarlo in un programma | Pratica con il software e foto di riferimento         | Oggetti che non esistono ancora                        | Proporzioni, texture e mappatura UV               |
| Fotogrammetria             | L'oggetto a disposizione, da 20 a 100 foto o più      | Il dettaglio reale della superficie                    | Superfici bianche lisce, vetro, metallo lucidato  |
| LiDAR sul telefono         | Un iPhone Pro o un iPad Pro, l'oggetto a disposizione | Forme grandi e semplici, come un divano                | Meno dettaglio: gambe tornite, sedute intrecciate |
| IA da una foto             | Una foto nitida                                       | La foto del fornitore di un pezzo che non puoi toccare | Il retro è una stima da controllare               |
| Incaricare un artista 3D   | Foto di riferimento e un budget                       | Modelli curati nei dettagli o con più varianti         | Il tempo per il brief e per la realizzazione      |

Questa guida riguarda modelli da visualizzare sullo schermo, nelle schede prodotto e in realtà aumentata.

## Metodo 1: modellalo tu in un programma

Blender è gratuito, open source ed esporta GLB, FBX, OBJ e USD. SketchUp è più accessibile per mobili ed edifici, perché [spingi e tiri le forme piane](https://help.sketchup.com/en/sketchup/pushing-and-pulling-shapes-3d) fino a farle diventare solidi. [Tinkercad](https://www.tinkercad.com/help-center/what-is-tinkercad), un'app gratuita che gira nel browser, permette di esercitarsi con le forme di base.

Metti in conto settimane di pratica prima che una sedia modellata da te risulti convincente. Per chi comincia, le parti difficili sono le proporzioni e le texture. La mappatura UV, che distende una superficie in piano per poterci applicare un'immagine, è il punto in cui quasi tutti si bloccano.

Per un pezzo semplice come un tavolino, il flusso di lavoro è questo:

1. Raccogli i riferimenti: una foto frontale e una laterale.
2. Abbozza le forme principali con parallelepipedi e cilindri: piano, gambe, fascia sotto il piano.
3. Smussa appena gli spigoli, così gli angoli prendono la luce come il legno vero.
4. Aggiungi i materiali: una texture di legno sul piano, una finitura metallica sulle eventuali maniglie.
5. Controllalo da ogni lato, sotto compreso, poi esportalo in GLB.

## Metodo 2: la fotogrammetria

La fotogrammetria costruisce un modello da molte foto sovrapposte. [La guida di Polycam](https://learn.poly.cam/hc/en-us/articles/27425185907348-How-to-Use-Object-Mode) ne chiede almeno 20, con circa il 70% di sovrapposizione tra uno scatto e l'altro, scattate girando intorno all'oggetto ad altezze diverse con luce morbida e uniforme. Per gli oggetti ricchi di dettagli ne servono 100 o più.

Puoi usarla dal telefono con RealityScan e Polycam oppure dal computer con il programma open source [Meshroom](https://alicevision.org/). La fotogrammetria riproduce bene i dettagli della superficie. Fatica con superfici bianche lisce, vetro e metallo lucidato, perché ha bisogno di una trama visibile per far corrispondere una foto alla successiva.

## Metodo 3: scansione LiDAR con il telefono

Gli iPhone Pro dall'iPhone 12 Pro in poi, e i modelli recenti di iPad Pro, hanno un [sensore LiDAR](https://www.apple.com/newsroom/2020/03/apple-unveils-new-ipad-pro-with-lidar-scanner-and-trackpad-support-in-ipados/) che misura direttamente la profondità. App come Polycam lo usano per costruire un modello mentre giri intorno all'oggetto.

Il LiDAR è rapido e gestisce bene le forme grandi e semplici, come un divano. Registra meno dettaglio della fotogrammetria, quindi gambe tornite e sedute intrecciate possono risultare irregolari.

## Metodo 4: generalo con l'IA

Gli strumenti di IA creano un modello da una foto, il cosiddetto image-to-3D, o da una descrizione scritta, il text-to-3D. Il primo conserva l'aspetto di un prodotto reale. Il secondo inventa un oggetto: è utile per un concept, ma non per riprodurre un prodotto in vendita.

Il metodo è lo stesso in ogni strumento: una foto nitida dell'oggetto intero su uno sfondo semplice, poi il controllo dei lati nascosti prima di tenere il risultato. Ogni passo è in [come creare un modello 3D da una foto](/it/guide/creare-un-modello-3d-da-foto).

![Nove viste di una poltrona lounge in bouclé con struttura in acciaio: fronte, fianchi, retro e alto](/showcase/armchair-angles.jpg "Un'anteprima gratuita con più angolazioni che easyrender ha disegnato da una sola foto di catalogo di questa poltrona, senza ritocchi. Controlla il retro e la vista dall'alto prima di generare il modello.")

easyrender è uno di questi strumenti. Mostra un'anteprima gratis di ogni angolazione, e un modello finito costa {{renderCredits}} crediti ({{renderPrice}}). Modella oggetti singoli, come mobili, complementi d'arredo e facciate di edifici, non stanze intere, e i loghi piccoli risultano poco nitidi. [Carica una foto](/it)

Anche Meshy e Tripo trasformano immagini in modelli 3D e aggiungono il text-to-3D, ognuno con i suoi prezzi. Prova la stessa foto in due strumenti prima di sceglierne uno per un catalogo.

## Metodo 5: incarica un artista 3D

Un artista modella l'oggetto a partire dalle tue foto e dai riferimenti che gli fornisci. È la scelta giusta quando servono più varianti dello stesso prodotto o un modello molto curato per una campagna pubblicitaria.

Prepara un buon brief: foto da ogni lato, primi piani di ogni materiale, formato e limite di peso richiesti dalla piattaforma di destinazione. Per una scheda prodotto, chiedi sia il GLB sia lo USDZ. Su Fiverr e Upwork trovi modellatori di prodotto, e conviene chiedere una prova prima di affidare un catalogo intero.

## Quanto costa un modello 3D?

Anche con un software gratuito devi mettere in conto il tempo di lavoro. Un artista fa un preventivo a modello, in base alla complessità. App di scansione e strumenti di IA fanno pagare a modello o in abbonamento, spesso dopo un piano gratuito o un'anteprima gratis.

Su easyrender i crediti costano {{creditPrice}} l'uno e si comprano a consumo, da {{paygMinCredits}} crediti. Il piano Pro costa {{proPrice}} al mese per {{proCredits}} crediti, e i crediti non scadono.

## Come si controlla un modello finito?

Qualunque sia il metodo, apri il modello in un visualizzatore e guarda sotto e dietro, dove si nascondono gli errori. Ingrandisci le texture a tutto schermo, perché un tessuto che in miniatura sembra a posto può essere sfocato da vicino. Poi caricalo su un telefono in rete mobile, per capire se il file è troppo pesante.

Per le schede prodotto di solito servono due file: il GLB per il web e Android, lo USDZ per la realtà aumentata sui dispositivi Apple. [Cos'è un file GLB](/it/guide/file-glb) spiega come aprirne uno, controllarlo e comprimerlo, e [cos'è un file USDZ](/it/guide/file-usdz) spiega il formato usato da Apple.

## Un esempio: una lampada da terra, in tre modi

Prendi una lampada da terra con paralume in lino e stelo in ottone. In Blender, chi comincia può abbozzare stelo e paralume in un pomeriggio. Riprodurre in modo convincente la trama del lino richiede molto più tempo.

La fotogrammetria fatica con l'ottone lucidato, che riflette la stanza e confonde la corrispondenza tra le foto. Chi scansiona per mestiere opacizza le parti lucide con uno spray opacizzante temporaneo, cosa che su un pezzo da vendere non faresti.

Il metodo da immagine a 3D, partendo da uno scatto di catalogo pulito, coglie la forma generale e il colore del paralume. Lo stelo sottile è la parte da controllare, perché le parti sottili possono uscire piegate o più spesse di quanto sono.

## Quali sono i limiti di ciascun metodo?

I modelli da una sola foto non permettono di ricavare le dimensioni dell'oggetto. Le scansioni perdono ciò che la fotocamera non poteva vedere, come la parte inferiore di un divano appoggiato sul pavimento. Se costruisci i modelli da solo, devi imparare a usare il software; se incarichi un artista, devi considerare i tempi di realizzazione.

Qui ci occupiamo di oggetti singoli. Il modello 3D da una foto non ricostruisce stanze arredate per intero. Per vendere mobili e complementi d'arredo, [modelli 3D per l'ecommerce](/it/guide/modelli-3d-ecommerce) confronta le strade per un catalogo, e [vendere mobili vintage online](/it/guide/vendere-mobili-vintage) è dedicato ai pezzi unici.

## FAQ

### Bisogna imparare Blender per creare un modello 3D?

No: sia le app di scansione sia il metodo da immagine a 3D producono un modello senza alcuna modellazione.

Devi comunque saper valutare il risultato, perché controllare retro, texture e parti sottili è ciò che separa un modello utilizzabile da uno con errori evidenti. Imparare Blender conviene se ti servono spesso modelli dettagliati e modificabili di cose che non esistono ancora.

### Quanto tempo ci vuole per creare un modello 3D?

Dipende più dal metodo che dall'oggetto. Con l'IA da una foto devi soprattutto scegliere lo scatto e controllare il risultato. La fotogrammetria richiede una serie di scatti e la successiva elaborazione. Se modelli in Blender, contano la complessità del pezzo e la tua esperienza con il programma. Gli artisti indicano i propri tempi di consegna.

### Si può creare un modello 3D da una sola foto?

Sì, con uno strumento da immagine a 3D, che stima i lati che la fotocamera non ha visto. Il risultato conserva la forma generale e i materiali di un prodotto reale, mentre il retro e i dettagli fini sono stime da controllare. Funziona meglio con uno scatto nitido a tre quarti di un solo oggetto, su sfondo semplice.

### A cosa serve un modello creato da una foto?

Serve a mostrare l'aspetto di un oggetto sullo schermo: puoi ruotarlo, guardare i fianchi e controllare il retro. easyrender esporta GLB e USDZ per il web e la realtà aumentata. Le parti non visibili nella foto restano stime da confrontare con il prodotto.

### In che formato deve essere un modello 3D?

GLB per il web, Android e la maggior parte degli strumenti 3D, e USDZ per la realtà aumentata su iPhone e iPad. Per le schede prodotto tienili entrambi. Se una piattaforma o un'altra app chiede qualcos'altro, converti il GLB in Blender invece di rifare il modello da zero con un altro metodo.
