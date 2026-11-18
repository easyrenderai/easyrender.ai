---

group: how-to-make-a-3d-model-from-photos
title: Come creare un modello 3D da una foto
description: "Come creare un modello 3D da una foto: quale scatto usare, come controllare i lati che la fotocamera non ha visto, quali file ottieni e i limiti."
date: 2026-11-15
keyword: modello 3d da foto
author: Jorge Rodríguez
authorType: person
cta: Scegli uno scatto nitido del tuo catalogo, una sedia o una madia fotografate a tre quarti, e guardalo da ogni angolazione prima di spendere un credito.
---

Per creare un modello 3D da una foto, carica uno scatto nitido e ben illuminato di un solo oggetto in uno strumento di IA: ricostruirà anche i lati non inquadrati, stimandoli. La fotogrammetria richiede invece almeno 20 foto sovrapposte scattate tutto intorno. In entrambi i casi la qualità delle foto incide sul risultato.

![Illustrazione di un annaffiatoio in metallo zincato, metà nel suo metallo reale e metà in argilla grigia opaca coperta da un reticolo bianco, su fondo scuro](/blog/illustrations/how-to-make-a-3d-model-from-photos/hero.webp "Illustrazione, non un risultato di easyrender: un annaffiatoio disegnato metà in metallo zincato, metà come superficie in argilla con reticolo.")

## Modello 3D da foto: basta una foto o ne servono molte?

Il numero di foto dipende da una domanda: hai l'oggetto davanti? Per la fotogrammetria e la scansione LiDAR devi averlo a disposizione. Il metodo da immagine a 3D (image-to-3D) richiede solo un'immagine, ed è per questo che funziona con lo scatto del fornitore di una madia che non puoi fotografare di persona.

La fotogrammetria unisce foto sovrapposte in un modello. [Polycam](https://learn.poly.cam/hc/en-us/articles/27425185907348-How-to-Use-Object-Mode) ne chiede almeno 20, con circa il 70% di sovrapposizione, e per gli oggetti ricchi di dettagli ne servono 100 o più. [RealityScan](https://dev.epicgames.com/documentation/realityscan-mobile/realityscan-step-by-step-guide) inizia l'analisi dopo 20 immagini, ne accetta fino a 300 e chiede giri e archi a più altezze.

Il LiDAR, su iPhone Pro o iPad Pro, misura la profondità mentre giri intorno al pezzo. È rapido sulle forme grandi e semplici e perde i dettagli fini, come i montanti torniti di una sedia.

![Due strade affiancate: la fotogrammetria prende da 20 a oltre 100 foto sovrapposte di un oggetto che hai davanti e vede ogni superficie; da immagine a 3D parte da una foto e stima i lati che non vede](diagram:photo-vs-photogrammetry "La fotogrammetria misura ciò che la fotocamera ha visto. Da immagine a 3D lavora con una foto, e i lati non visibili si deducono da quell’immagine. Numero di foto secondo la guida di Polycam alla modalità oggetto.")

Ecco come sceglieremmo noi, caso per caso:

- Hai solo la foto del fornitore e il pezzo è in un magazzino all'estero: IA da una foto, perché non puoi scansionarlo.
- Il pezzo è nel tuo magazzino, ha una superficie con trama come rovere o lino e hai un'ora libera: fotogrammetria. Registra la superficie vera invece di stimarla.
- Un pezzo grande e semplice, come un divano a tre posti, e un iPhone Pro a portata di mano: LiDAR. È veloce, e qui conta più la forma della trama del tessuto.
- Vetro, specchio o cromo lucido: nessuno dei tre funziona bene, perché ognuno legge i riflessi come se fossero superficie.

I pro e i contro di molte foto rispetto a una sola sono in [software di fotogrammetria o IA da una foto](/it/confronti/software-di-fotogrammetria).

## Come funziona il passaggio da immagine a 3D?

Gli strumenti possono seguire due metodi. Alcuni passano direttamente dalla foto al modello. Altri prima disegnano l'oggetto da più angolazioni e poi costruiscono il modello da quelle viste, così la ricostruzione dispone di più riferimenti per i lati nascosti.

easyrender combina più modelli e segue la seconda strada. L'abbiamo scelta dopo un test A/B su schede prodotto reali. In quel test la tavola era disegnata da un modello di immagine più grande; oggi la disegna un modello più economico, che non abbiamo ancora provato allo stesso modo.

La prima fase è la tavola delle angolazioni: un'immagine quadrata divisa in una griglia 3 per 3.

Otto riquadri mostrano l'oggetto da angolazioni distanziate di 45 gradi, partendo dal fronte; il nono lo mostra dall'alto. Ogni riquadro è su bianco, con luce morbida e l'oggetto intero al centro. La seconda fase legge la tua foto e quelle nove viste e costruisce un'unica mesh, cioè una struttura di poligoni, rivestita da texture.

![Cinque passi da immagine a 3D in due fasi: una foto, una tavola delle angolazioni, il tuo controllo di retro e lati, poi la costruzione del modello e i file GLB e USDZ. Un’anteprima sbagliata ti riporta a una foto nuova](diagram:image-to-3d-pipeline "Il percorso in due fasi che seguono i passi sotto. Su easyrender la tavola delle angolazioni è un’anteprima gratuita, e i crediti si spendono solo al passo 4, se decidi di costruire il modello.")

La stima riproduce meglio la forma generale e il colore, ma fatica con ciò che una sola foto non può mostrare, come le parti dietro un intreccio aperto. Si appoggia anche alla simmetria. Le nostre istruzioni di base chiedono di dedurre un lato nascosto con prudenza, partendo dalla costruzione visibile, e di non inventare mai loghi, scritte o decorazioni.

Per i mobili aggiungiamo regole nostre, scritte dopo i test: tenere esatto il numero di gambe, braccioli, cuscini e cassetti, e rispettare la direzione della venatura e delle cuciture. Le altre strade per arrivare a un modello sono a confronto in [come creare un modello 3D](/it/guide/come-creare-un-modello-3d).

## Passo 1: scegli la foto giusta

La foto migliore mostra l'oggetto intero, nitido, con luce morbida e uniforme, su uno sfondo semplice. Niente deve coprirlo: nessun cuscino sul bracciolo, nessuna pianta davanti a una gamba.

Per i mobili, un'inquadratura a tre quarti funziona meglio di quella frontale. Di fronte, la foto di una poltrona nasconde la profondità della seduta. A tre quarti si vedono insieme il fronte e un fianco, quindi lo strumento deve stimare meno parti.

![Una poltrona lounge in bouclé con struttura in tubolare d'acciaio, fotografata a tre quarti su fondo bianco](/showcase/armchair.jpg "Una buona foto di partenza: la poltrona intera, a tre quarti, su sfondo semplice.")

Il file deve essere un JPEG, un PNG o un WebP sotto i 4 MB.

Anche la risoluzione ha una soglia. Il nostro controllo al caricamento rifiuta una foto con il lato corto sotto i 400 pixel e avvisa sotto gli 800. Rifiuta anche una foto con una larghezza superiore a quattro volte l'altezza, e un'immagine dal colore così uniforme da sembrare vuota.

Sopra quella soglia la nitidezza conta più dei pixel, quindi su una copia ridotta di ogni foto facciamo anche un controllo della sfocatura. Puoi fare lo stesso a occhio: ingrandisci al 100% il bordo di una gamba. Se lì non vedi la venatura o la trama, anche il modello faticherà a riprodurla.

Prima di caricare, controlla la foto con questo elenco:

- Il pezzo è tutto nell'inquadratura, con un margine su ogni lato e niente tagliato ai piedi.
- La fotocamera era più o meno a metà altezza del pezzo, non puntata dall'alto mentre eri in piedi.
- I bordi sono nitidi a piena risoluzione, non solo sullo schermo del telefono.
- La luce è uniforme, senza un'ombra dura che taglia l'oggetto.
- Lo sfondo è semplice: un muro, un fondale di carta o un pavimento pulito.
- Nella foto c'è un solo oggetto, non una stanza allestita.

## Passo 2: togli ciò che non è l'oggetto

Uno sfondo pieno di cose è il modo più rapido per ottenere un modello sbagliato. Lo strumento può leggere il disegno di un tappeto come parte della base di un tavolo, o fondere una lampada da terra con la tenda dietro.

Se hai solo uno scatto ambientato, ritaglialo stretto sul pezzo, con un piccolo margine su ogni lato. La foto di una madia lunga può mantenere un formato largo, fino a quattro volte l'altezza dell'immagine. Oltre, il nostro controllo chiede una foto che mostri il prodotto intero.

I ritagli aiutano, con un'avvertenza. Uno strumento per togliere lo sfondo può lasciare un alone chiaro lungo i bordi, e il modello può leggerlo come parte dell'oggetto. Controlla il bordo a piena risoluzione prima di caricare.

Anche le ombre sono sfondo. Un'ombra dura sotto un tavolino può diventare una lastra scura attaccata alle gambe, quindi una luce morbida da giornata coperta vale l'attesa.

## Passo 3: controlla l'anteprima da ogni angolazione

I buoni strumenti da immagine a 3D mostrano l'oggetto da più lati prima di costruire il modello finale. Guarda con attenzione il retro e i fianchi, perché è lì che la foto non mostrava l'oggetto.

Esamina la tavola come una serie di scatti affiancati. Conta le gambe, le ante e i cassetti in ogni riquadro, non solo in quello frontale. Poi confronta i riquadri opposti, per esempio fronte-destra con retro-sinistra: una sedia con i braccioli che cambiano forma tra i due rischia di risultare deformata.

Il riquadro dall'alto rivela ciò che gli altri nascondono. Un paralume rotondo che dall'alto diventa ovale, o un piano di tavolo più largo da un lato, si vedono lì per primi.

![Nove viste della stessa poltrona in bouclé, fronte, fianchi, retro e alto, disegnate dalla sola foto qui sopra](/showcase/armchair-angles.jpg "La tavola delle angolazioni gratuita che easyrender ha disegnato da quella sola foto, senza ritocchi. Il retro e la vista dall'alto sono stime.")

Alcuni errori vengono fermati prima che tu li veda. I nostri controlli scartano una tavola più piccola di 768 pixel, una in cui l'oggetto manca da più di due riquadri e una in cui più di tre delle otto viste intorno all'oggetto sono quasi copie.

L'ultimo controllo viene dai test. Su copie piccole in scala di grigi, due viste davvero diverse di un oggetto differiscono del 3% o più, due viste ripetute di meno dell'1%. Una tavola che ripete la stessa foto in ogni riquadro non fornisce riferimenti utili alla ricostruzione.

Il numero delle parti va verificato da una persona. Conta ante, cassetti e gambe in ogni riquadro e confrontali con il pezzo vero prima di costruire. Se l'anteprima è sbagliata, cambia foto o aggiungi una nota, invece di riprovare con la stessa immagine.

easyrender accetta una breve nota con ogni foto, per ciò che la foto nasconde: «quattro ante», «schienale aperto», «maniglie in ottone». La tavola qui sopra è un risultato reale di easyrender dalla foto del passo 1. L'anteprima è gratis, due al giorno senza crediti, e spendi crediti solo se costruisci il modello.

La tavola qui sopra è un esempio finale. L’anteprima gratuita ha una filigrana. [Carica una foto](/it#try)

## Passo 4: costruisci il modello e scarica i file

Quando la forma ti convince, lo strumento costruisce un modello 3D con texture. Quasi tutti esportano il GLB, il formato standard per il web e Android. Molti danno anche lo USDZ, il formato che iPhone e iPad aprono in AR Quick Look.

Per la generazione richiediamo una texture da 2048 pixel. Il risultato è un'unica mesh con un solo materiale, il cui colore è definito da un'immagine di base. Una mesh e un materiale costituiscono una struttura semplice da gestire per un visualizzatore. Il numero di materiali resta ben sotto il massimo di 10 indicato da Scene Viewer.

I sei modelli della nostra vetrina vanno dai 14.590 triangoli di un vaso in terracotta ai 69.910 di un comodino con cassetti. Tutti e sei restano sotto i 100.000 triangoli che [Scene Viewer di Google](https://developers.google.com/ar/develop/scene-viewer) raccomanda come massimo.

![La poltrona lounge in bouclé come modello 3D con texture, costruito dalla foto del passo 1 e mostrato in un visualizzatore 3D](/showcase/armchair.glb "Il modello che easyrender ha costruito da quella foto e dalla sua tavola: tessuto e acciaio ripresi dalla foto originale, texture compresse per questa pagina, 25.879 triangoli, 608 KB. Trascinalo per girarlo e controllare il retro, poi guarda il tessuto in luce neutra prima di pubblicare.")

Un GLB si apre in Blender (File, Importa, glTF 2.0) e in visualizzatori gratuiti nel browser come la [Babylon.js Sandbox](https://sandbox.babylonjs.com/). In Blender, attiva Statistiche nelle sovrapposizioni della vista per leggere il numero di triangoli. Apri il file una volta prima di usarlo su una piattaforma, e giralo piano.

easyrender ti dà entrambi i file per ogni modello finito. Lo USDZ viene convertito dal GLB nel tuo browser al momento del download, quindi i due derivano dallo stesso modello. La realtà aumentata arriverà presto. Le dimensioni del prodotto vanno indicate separatamente nel testo della scheda.

Cosa c'è dentro ciascun file è spiegato in [cos'è un file GLB](/it/guide/file-glb) e [cos'è un file USDZ](/it/guide/file-usdz).

## Cosa va storto, e come si rimedia?

Quasi tutti i modelli venuti male risalgono alla foto. Questo è l'elenco che seguiamo, dal sintomo al rimedio.

| Sintomo                                                       | Causa                                                                                                                                                                         | Rimedio                                                                                               |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Caricamento rifiutato: foto troppo piccola                    | Il lato corto è sotto i 400 pixel, di solito una miniatura o uno screenshot                                                                                                   | Usa il file originale della fotocamera o del fornitore, se sta sotto i 4 MB                           |
| Caricamento rifiutato: foto troppo larga rispetto all'altezza | L'immagine è più di quattro volte larga quanto è alta, come un banner                                                                                                         | Ritaglia sull'oggetto, con un margine su ogni lato                                                    |
| Due gambe della sedia diventano una                           | Di fronte, le gambe posteriori si nascondono dietro quelle anteriori                                                                                                          | Usa una foto a tre quarti in cui le quattro gambe sono separate                                       |
| Quattro ante diventano tre                                    | Fughe poco contrastate tra le ante                                                                                                                                            | Scatta con luce radente sul fronte, o scrivi «quattro ante» nella nota                                |
| Il retro sembra uguale al fronte                              | La foto mostrava solo il fronte, quindi il retro segue quella vista                                                                                                           | Scrivi «schienale aperto» o «retro liscio» nella nota, o usa una foto che mostri un angolo posteriore |
| Rattan o paglia di Vienna diventano un motivo stampato        | Una sola foto non mostra le parti dietro l'intreccio                                                                                                                          | Accettalo per un visualizzatore piccolo, o scansiona il pezzo con la fotogrammetria                   |
| Il tessuto sembra più giallo o più scuro che in foto          | La luce del visualizzatore è diversa da quella della foto, oppure il materiale non imposta Metallic e vale il predefinito glTF, del tutto metallico                           | Controlla in luce neutra e imposta Metallic a 0 in Blender prima di pubblicare                        |
| Le superfici sembrano a faccette con luce laterale            | Un file senza normali ai vertici, per cui i visualizzatori ne calcolano di piatte, come chiede la [specifica glTF](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) | In Blender usa Shade Smooth ed esporta di nuovo                                                       |

## Come capisci se il modello è pronto da pubblicare?

Definisci i criteri di qualità prima di valutare il risultato, altrimenti ogni modello ti sembrerà a posto. Questi sono i controlli che usiamo, e ognuno ha una risposta sì o no.

1. I conti tornano con il prodotto: gambe, ante, cassetti, maniglie.
2. Il retro e la parte inferiore corrispondono a quelli reali a chi possiede il pezzo.
3. La texture regge a tutto schermo, non solo in miniatura.
4. Il file si apre in un visualizzatore nel browser, su un iPhone e su un telefono Android.
5. Il file rispetta i limiti della piattaforma di destinazione. [Shopify](https://help.shopify.com/en/manual/products/product-media/product-media-types) accetta modelli 3D fino a 500 MB, mentre Scene Viewer raccomanda 10 MB e 100.000 triangoli.

Un modello che non passa il controllo 1 o 2 torna al passo 1, con una foto nuova o una nota. Per uno che non passa il controllo 5 occorre ridurre il peso, come spiega la guida sul GLB.

## Cosa non può fare un modello da una sola foto

Non permette di ricavare le dimensioni dell'oggetto: riportale nel testo della scheda prodotto.

I dettagli più minuti risultano poco nitidi. Un logo piccolo sullo schienale, maniglie sottili in ottone o un testo stampato su una scatola spesso perdono definizione. Il rattan aperto tende a diventare un motivo stampato su una superficie piena, perché una foto non mostra cosa c'è dietro ogni vuoto.

Vetro, specchi e cromature lucide confondono ogni metodo, fotogrammetria compresa, perché la superficie mostra l'ambiente invece di sé stessa. E questi strumenti modellano un oggetto alla volta, non una stanza arredata.

## FAQ

### Quante foto servono per un modello 3D?

Una, per il metodo da immagine a 3D con l'IA, che stima i lati che non vede. La fotogrammetria invece ricostruisce i lati fotografati e richiede almeno 20 foto sovrapposte e spesso 100 o più per un pezzo ricco di dettagli. Più foto danno superfici più fedeli, ma solo se hai l'oggetto davanti e lo spazio per girarci intorno.

### Che risoluzione deve avere la foto?

Almeno 800 pixel sul lato corto, e di più se li hai. easyrender rifiuta le foto sotto i 400 pixel, avvisa sotto gli 800 e controlla la sfocatura di ogni caricamento. Oltre quella soglia conta più la nitidezza: ingrandisci un bordo al 100%, e se lì non si vede la venatura o la trama, il modello non la mostrerà.

### Il metodo da immagine a 3D è la stessa cosa della fotogrammetria?

No. La fotogrammetria ricostruisce l'oggetto da molte foto reali, quindi ogni superficie che mostra è stata vista dalla fotocamera. Il metodo da immagine a 3D parte da una sola foto, quindi i lati non inquadrati vengono stimati da quell'immagine. Per la fotogrammetria devi avere l'oggetto a disposizione; l'IA può lavorare sullo scatto di catalogo del fornitore.

### Trasformare una foto in un modello 3D è gratis?

Provare di solito sì, il file finale di solito no. Quasi tutti gli strumenti hanno un piano gratuito o un'anteprima gratis, poi fanno pagare a modello o in abbonamento. Su easyrender la tavola delle angolazioni è gratis, due al giorno senza crediti, e un modello finito costa {{renderCredits}} crediti, cioè {{renderPrice}} a {{creditPrice}} per credito.

### Quanto sono fedeli i lati non visibili nella foto?

Sono stime ricavate dalla forma e dai materiali visibili. Controlla retro, fianchi e base confrontandoli con il prodotto: conta gambe, ante e maniglie e verifica gli intrecci. Una nota può chiarire ciò che la foto nasconde, ma il modello va comunque controllato prima di usarlo.
