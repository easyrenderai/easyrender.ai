---

group: compare-photogrammetry-software
title: "Software di fotogrammetria o IA da una foto: quale usare"
description: "Software di fotogrammetria e IA da una foto a confronto: RealityScan, Metashape, Meshroom, Polycam e Zephyr, foto richieste, prezzi e quando usarli."
date: 2026-11-15
keyword: software di fotogrammetria
author: Jorge Rodríguez
authorType: person
cta: Se del pezzo hai solo una foto di catalogo, guardalo gratis da ogni angolazione prima di decidere se serve davvero una scansione.
---

Un software di fotogrammetria costruisce un modello 3D da molte foto sovrapposte di un oggetto che hai davanti. Le scelte più comuni sono RealityScan, Agisoft Metashape, Meshroom, Polycam e 3DF Zephyr. Se hai una sola foto, come lo scatto di catalogo di un fornitore, non puoi usare la fotogrammetria, e la strada è uno strumento da immagine a 3D.

![Illustrazione di un busto in marmo incrinato, metà nella sua pietra reale e metà in argilla grigia opaca coperta da un reticolo bianco, con sottili piramidi di ripresa bianche intorno, su fondo scuro](/compare/illustrations/photogrammetry-software/hero.webp "Illustrazione, non un risultato di easyrender: un busto in marmo disegnato metà come pietra scolpita, metà come superficie in argilla con reticolo, con le piramidi di ripresa delle fotocamere intorno.")

## Ti serve davvero un software di fotogrammetria?

Per prima cosa, verifica di poter girare intorno all'oggetto. La fotogrammetria misura solo ciò che la fotocamera ha visto, quindi devi avere il pezzo a disposizione, tempo per fotografarlo e uno spazio sgombro. La guida di RealityScan di Epic lo dice chiaramente: ciò che non è visibile in più immagini non comparirà nel modello.

Se il pezzo è nel magazzino di un fornitore, o hai un catalogo intero di foto prodotto, potresti avere una sola foto per articolo. È il caso per cui esiste l'IA da una foto. Il procedimento passo per passo, dalla scelta della foto al controllo dei file, è in [come creare un modello 3D da una foto](/it/guide/creare-un-modello-3d-da-foto).

## Come funziona un software di fotogrammetria?

Il software trova gli stessi punti in foto che si sovrappongono, ricostruisce dove stava ogni fotocamera, poi crea una mesh, una struttura di poligoni, e la riveste con una texture ricavata dalle foto. Ogni strumento segue le stesse regole di ripresa, perché tutti fanno corrispondere punti tra immagini.

1. Scegli un oggetto fermo. La [guida di Apple a Object Capture](https://developer.apple.com/documentation/realitykit/capturing-photographs-for-realitykit-object-capture) sconsiglia i pezzi morbidi o flessibili che cambiano forma quando li sposti, e gli oggetti molto sottili, riflettenti, trasparenti o di un solo colore uniforme.
2. Usa una luce morbida. Apple indica come problemi il flash della fotocamera, il sole diretto e le lampadine nude; il manuale di Meshroom dice di non usare mai il flash. Una giornata coperta va bene.
3. Mantieni fisse le impostazioni della fotocamera. Tieni fissi zoom, diaframma, tempo di scatto e ISO. Su iPhone, tieni premuta l'anteprima finché compare «Blocco AE/AF».
4. Scatta con molta sovrapposizione. Apple chiede il 70% o più tra scatti vicini e avverte che sotto il 50% l'elaborazione può fallire. Il manuale di Meshroom chiede almeno il 60% di sovrapposizione laterale e l'80% frontale.
5. Gira intorno all'oggetto a più altezze. RealityScan chiede giri e archi a più altezze, con l'oggetto che riempie almeno metà di ogni immagine.
6. Riprendi anche la base. Apple suggerisce una base rotante e di appoggiare l'oggetto su lati diversi, così il modello non ha buchi sotto.
7. Maschera lo sfondo, poi elabora. L'app mobile di RealityScan inizia l'analisi dopo 20 immagini e si ferma a 300.

Prendi un tavolino in teak: tre giri con luce morbida, poi una serie del sotto con il tavolino sul fianco. La venatura dà al software molti punti da far corrispondere, ed è per questo che il legno si scansiona bene.

## Quale software di fotogrammetria scegliere?

Le differenze principali tra gli strumenti riguardano i dispositivi su cui funzionano e le condizioni di licenza. I prezzi qui sotto sono quelli indicati a novembre 2026.

| Strumento              | Dove funziona                           | Prezzo e licenza                                                                                                             | Limiti di foto e note                                                                    |
| ---------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| RealityScan (Epic)     | App desktop, più un'app mobile gratuita | Gratis sotto 1 milione di dollari di fatturato negli ultimi 12 mesi; 1.250 dollari a postazione all'anno oltre quella soglia | L'app mobile analizza dopo 20 immagini, limite 300                                       |
| Agisoft Metashape      | Windows, macOS, Linux                   | Standard 179 dollari, Professional 3.499 dollari, licenza perpetua; prova gratuita di 30 giorni                              | La Standard copre generazione del modello e texture                                      |
| Meshroom (AliceVision) | Windows, Linux                          | Open source, MPL-2.0                                                                                                         | Accelerato da GPU; il manuale chiede il 60% di sovrapposizione laterale e l'80% frontale |
| Polycam                | App per iPhone e Android                | Gratis con 10 acquisizioni in fotogrammetria; Basic 150 dollari all'anno o 30 al mese                                        | 150 immagini per acquisizione nel piano gratuito, 300 nel Basic                          |
| 3DF Zephyr             | Desktop                                 | Gratis fino a 50 foto; Lite 199 € + IVA, perpetua; versione completa 250 € + IVA al mese o 4.200 € + IVA perpetua            | La versione gratuita esporta mesh con texture solo in JPG                                |

Fonti: [licenza RealityScan](https://www.realityscan.com/en-US/license), [sito di RealityScan](https://www.realityscan.com/en-US), [guida mobile di RealityScan](https://dev.epicgames.com/documentation/realityscan-mobile/realityscan-step-by-step-guide), [negozio Metashape](https://www.agisoft.com/buy/online-store/) e [installer](https://www.agisoft.com/downloads/installer/), [AliceVision](https://alicevision.org/) e il [manuale di ripresa di Meshroom](https://meshroom-manual.readthedocs.io/en/latest/capturing/capturing.html), [prezzi di Polycam](https://poly.cam/pricing), [3DF Zephyr](https://www.3dflow.net/3df-zephyr-photogrammetry-software/). Tutte consultate l'11 novembre 2026; RealityScan, Metashape, Polycam e Zephyr ricontrollate il 15 novembre 2026.

Meshroom non costa nulla ed è adatto a chi vuole imparare a usare un'app desktop con un'interfaccia a nodi, cioè blocchi collegati che rappresentano le fasi di elaborazione, su Windows o Linux con GPU.

RealityScan è gratuito per chi rientra nella soglia di fatturato indicata e copre sia il telefono sia il desktop. Metashape funziona su Windows, macOS e Linux, con 30 giorni di prova sui tuoi pezzi.

Polycam è un'opzione per cominciare se vuoi scansionare dal telefono, e i suoi piani a pagamento esportano GLTF, OBJ, FBX, DAE e USDZ. Zephyr Free è un buon modo per provare con un oggetto piccolo, purché ti bastino 50 foto.

## In cosa è diversa l'IA da una foto?

Il metodo da immagine a 3D parte da una sola foto e stima i lati che la fotocamera non ha visto. Non fa corrispondere punti tra foto, quindi non gli servono sovrapposizione, giri o base rotante. Gli serve uno scatto nitido e ben illuminato dell'oggetto intero su sfondo semplice.

easyrender lavora così, in due fasi. Prima disegna una tavola delle angolazioni gratuita: nove viste dell'oggetto, otto intorno a passi di 45 gradi e una dall'alto. Controlli la tavola, e spendi crediti solo quando ti convince.

Poi il sistema usa quelle nove viste e crea un unico modello con texture, da scaricare in GLB e USDZ. Un modello costa {{renderCredits}} crediti ({{renderPrice}}), e la [pagina dei prezzi](/it/prezzi) elenca i pacchetti. [Carica una foto](/it#try) per vedere gratis la tavola delle angolazioni.

## Cosa vuoi ottenere, e come lo misuri?

Fissa l'obiettivo prima di scegliere lo strumento. Ogni obiettivo qui sotto ha un controllo che puoi fare da solo.

- Una copia fedele di una superficie, come una pelle consumata o la venatura del rovere. Ingrandisci la texture a tutto schermo accanto al pezzo vero. La fotogrammetria copia la superficie dalle foto, ed è qui che ripaga il tempo di preparazione.
- Un modello completo, senza buchi. Gira il modello e fermati sulla base, sul retro delle gambe e su ogni incavo profondo. Ogni buco corrisponde a una parte non ripresa nelle foto.
- Un modello per ogni prodotto di un catalogo. Cronometra un pezzo dalla preparazione al file finito, poi moltiplica il tempo per il numero di articoli del catalogo prima di scegliere un metodo.
- Un modello di un prodotto che non puoi toccare. La fotogrammetria non può partire. Giudica un risultato da immagine a 3D contando gambe, ante e maniglie in ogni vista.
- Un costo per modello prevedibile. Per una licenza, dividi il prezzo per i modelli che farai nel periodo. Per i crediti, leggi il prezzo a modello nella pagina dei prezzi.

## Cosa va storto con la fotogrammetria, e come si rimedia?

Quasi tutte le scansioni venute male risalgono alla ripresa, non al software. Questo è l'elenco con cui controllare un risultato sbagliato, dal sintomo al rimedio.

| Sintomo                                            | Causa                                                            | Rimedio                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| Buchi in un piano bianco liscio                    | Un colore uniforme non dà al software nulla da far corrispondere | Scatta con luce radente, o usa un altro metodo per quel pezzo         |
| L'elaborazione fallisce o il modello è un disastro | Meno del 50% di sovrapposizione tra scatti vicini                | Rifai gli scatti con il 70% o più, a passi più piccoli                |
| La base manca o è fusa con il pavimento            | Il sotto non è mai stato fotografato                             | Fai una seconda serie con il pezzo sul fianco, o usa una base rotante |
| Maniglie cromate o uno specchio escono bitorzoluti | I riflessi cambiano da una foto all'altra                        | Evita i pezzi riflettenti, oppure modella quelle parti separatamente  |
| Zone sfocate e texture disallineata                | Zoom, esposizione o messa a fuoco cambiati durante la ripresa    | Blocca AE/AF, tieni una sola focale e scarta gli scatti mossi         |
| Macchie scure impresse nella texture               | Ombre dure da flash o sole diretto                               | Diffondi la luce, o scatta in una giornata coperta                    |
| Pezzi della stanza attaccati all'oggetto           | Uno sfondo pieno di cose nell'inquadratura                       | Usa uno sfondo semplice e maschera lo sfondo in ogni immagine         |
| La versione gratuita smette di importare foto      | 3DF Zephyr Free limita un progetto a 50 foto                     | Tieni le 50 migliori, o passa a una versione senza limite di foto     |

## Cosa useremmo noi, caso per caso

Ecco come sceglieremmo, con il nostro prodotto tra le opzioni.

Per un pezzo in magazzino con una superficie ricca di dettagli, come una cassapanca in rovere intagliato, sceglieremmo la fotogrammetria. Registra la superficie com'è, e provare RealityScan o Meshroom non costa nulla.

La foto del fornitore di una madia che non hai mai visto dal vivo: IA da una foto. Non c'è nulla da scansionare, e puoi giudicare la tavola delle angolazioni gratuita prima di spendere qualcosa.

Un intero catalogo di foto prodotto e nessuno studio: IA da una foto, con caricamenti in blocco dalla tua libreria o tramite un agente software. Una scansione per prodotto vuol dire una sessione di scatti per prodotto.

Un vaso di vetro o una lampada in acciaio lucido: nessuno dei due metodi gestisce bene le superfici a specchio. La documentazione della fotogrammetria dice di evitarle, quindi per quel pezzo metti in conto un artista 3D.

## FAQ

### Quale software di fotogrammetria gratuito scegliere?

Meshroom è open source con licenza MPL-2.0 e funziona su Windows e Linux. RealityScan è gratis per privati e aziende sotto 1 milione di dollari di fatturato negli ultimi 12 mesi. Polycam gratis include 10 acquisizioni in fotogrammetria, 3DF Zephyr Free fino a 50 foto. Quello giusto dipende dal tuo computer e dal dispositivo con cui scatti.

### Quante foto servono per la fotogrammetria?

Gli strumenti fissano la soglia con la sovrapposizione più che con un numero prestabilito. Apple chiede il 70% tra scatti vicini, Meshroom il 60% laterale e l'80% frontale. L'app mobile di RealityScan inizia l'analisi dopo 20 immagini e ne accetta fino a 300. Gli oggetti complessi, con incavi, ne richiedono di più, perché ogni incavo deve comparire in più foto.

### La fotogrammetria è meglio dell'IA da immagine a 3D?

Risolvono problemi diversi. La fotogrammetria ricostruisce l'oggetto da molte foto reali, quindi devi averlo a disposizione. Il metodo da immagine a 3D lavora da una sola foto di un pezzo che forse non toccherai mai. Se puoi scansionarlo e la superficie conta, scansionalo. Se hai solo una foto, l'altro metodo è l'unico che può partire.

### La fotogrammetria può scansionare vetro, specchi o cromo?

Non in modo affidabile. La guida di Apple dice di evitare gli oggetti molto riflettenti, trasparenti o traslucidi, e il manuale di Meshroom lo stesso. Apple suggerisce di disegnare o dipingere sulla superficie per darle una trama, cosa che non faresti su merce da vendere. Per quei pezzi è più sicuro un artista 3D che lavora dalle foto.
