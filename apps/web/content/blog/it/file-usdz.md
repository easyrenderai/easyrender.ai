---

group: usdz-file
title: "Cos'è un file USDZ e come funziona AR Quick Look su iPhone"
description: "Un file USDZ è il formato 3D che iPhone e iPad aprono in AR: cosa contiene, come aprirlo e crearlo, e quali limiti considerare quando lo usi."
date: 2026-11-17
keyword: file usdz
author: Jorge Rodríguez
authorType: person
cta: Scegli una foto nitida di un solo pezzo, un tavolino in rovere o una lampada da terra, e controlla ogni angolazione prima di spendere un credito.
---

Un file USDZ raccoglie un modello 3D nel formato Universal Scene Description (USD) di Pixar e le sue risorse in un archivio zip non compresso. Su iPhone e iPad si apre da Safari, File, Mail o Messaggi con AR Quick Look, che mostra l'oggetto nella stanza attraverso la fotocamera. Android non lo apre in modo nativo.

## Cosa c'è dentro un file USDZ?

USD è il formato di scena che Pixar ha creato per la produzione cinematografica. La [specifica USDZ](https://openusd.org/release/spec_usdz.html) descrive un archivio zip senza compressione che contiene i livelli USD e le immagini a cui fanno riferimento, disposti in modo che un dispositivo possa leggerli senza estrarli.

Apple [ha presentato lo USDZ con ARKit 2](https://www.apple.com/newsroom/2018/06/apple-unveils-arkit-2/) alla WWDC di giugno 2018, per iOS 12, insieme ad AR Quick Look. Da allora è il formato usato dai dispositivi Apple per la realtà aumentata aperta da una pagina web o da un messaggio.

## Come si apre un file USDZ?

Dipende dal dispositivo:

- iPhone e iPad: tocca il file in Safari, File, Mail o Messaggi. Quick Look lo apre con una vista Oggetto e una vista AR.
- Mac: selezionalo nel Finder e premi la barra spaziatrice per l'anteprima di Quick Look.
- Windows e Android: non c'è un visualizzatore integrato. Su un computer puoi usare [Blender dalla versione 3.5](https://developer.blender.org/docs/release_notes/3.5/pipeline_assets_io/) per importare i file USDZ.

Se ti serve lo stesso modello su Android o in un browser, usa la sua versione GLB. [Cos'è un file GLB](/it/guide/file-glb) spiega come usare questo formato.

<!-- IMAGE PENDING: uno screenshot reale da iPhone di uno USDZ di easyrender (per esempio la poltrona in bouclé) aperto nella vista Oggetto di Quick Look, senza ritocchi. Non la vista AR finché l'AR non è provata su dispositivo (REQ-00). -->

## Come funziona AR Quick Look in una pagina web?

Una pagina usa un collegamento con l'attributo `rel="ar"`, contenente un'immagine di anteprima, per aprire lo USDZ, e Safari aggiunge a quell'immagine un piccolo simbolo AR. La [guida di WebKit](https://webkit.org/blog/8421/viewing-augmented-reality-assets-in-safari-for-ios/) mostra il codice. Toccando l'immagine il modello si apre nella stanza, senza app da installare.

Il componente open source [model-viewer](https://modelviewer.dev/) di Google gestisce entrambi i sistemi con un solo frammento di codice: mostra un GLB nella pagina e passa agli iPhone uno USDZ per Quick Look.

AR Quick Look permette di osservare l'aspetto dell'oggetto nella stanza. Se il modello deriva da una foto, le dimensioni del prodotto vanno consultate nel testo della scheda.

## Come si crea un file USDZ?

Reality Converter di Apple, un'app gratuita per Mac, [converte in USDZ file come OBJ, glTF, FBX e USD](https://developer.apple.com/videos/play/wwdc2022/10141/) e ti fa controllare i materiali prima di esportare. Blender dalla versione 3.5 esporta direttamente in USDZ.

Se parti da una foto, alcuni strumenti da immagine a 3D esportano lo USDZ accanto al GLB, così salti la conversione. I passi sono in [come creare un modello 3D da una foto](/it/guide/creare-un-modello-3d-da-foto).

easyrender ti dà entrambi i file per ogni modello finito. La realtà aumentata arriverà presto: potrai aprire il pezzo sul telefono e vederlo nella tua stanza. Il modello mostra forma e materiali. Le dimensioni del prodotto vanno riportate separatamente nella scheda.

## Un esempio: un tavolino in rovere su iPhone

Inviati con Messaggi lo USDZ di un tavolino in rovere e toccalo. Quick Look apre prima la vista Oggetto, dove lo giri con un dito. Passa ad AR, inquadra il pavimento, e il tavolino compare nel punto che tocchi.

Giraci intorno e guarda dove le gambe toccano il pavimento. Un modello con la base un po' fuori posto sembrerà sospeso.

![Un tavolino rotondo in legno massello come modello 3D in un visualizzatore, da girare per controllare le gambe da ogni lato](/showcase/coffee-table.glb "Un tavolino rotondo in legno massello che easyrender ha modellato da una sola foto, mostrato qui dal suo GLB. easyrender crea il download USDZ da questo stesso GLB, nel tuo browser. Giralo e guarda dove le gambe toccano terra.")

Poi controlla come appare la venatura sotto la luce della tua lampada, più calda di quella da studio della foto originale.

## Da GLB a USDZ: conviene tenerli tutti e due?

Sì, se il modello va in una scheda prodotto. Il GLB serve per il web e Android, lo USDZ per la realtà aumentata sui dispositivi Apple. Shopify, per esempio, accetta entrambi come contenuti multimediali del prodotto.

La [guida su come creare un modello 3D](/it/guide/come-creare-un-modello-3d) spiega da dove arrivano i due file, qualunque metodo tu usi. Per un negozio, [modelli 3D per l'ecommerce](/it/guide/modelli-3d-ecommerce) spiega per quali prodotti ne vale la pena.

## FAQ

### Si può aprire un file USDZ su Android?

Non in modo nativo, perché la realtà aumentata di Android usa Scene Viewer di Google, che legge file glTF e GLB e non USDZ. Per mostrare lo stesso modello su Android, usane una versione GLB. Se hai solo il file Apple, Blender dalla versione 3.5 può importare lo USDZ ed esportare un GLB, ma dopo conviene controllare i materiali.

### Si può convertire uno USDZ in GLB?

Sì. Importa lo USDZ in Blender 3.5 o successivo, poi esportalo come glTF 2.0 nel formato binario GLB. Controlla il risultato in un visualizzatore, perché USD e glTF descrivono le superfici in modo diverso e alcune impostazioni dei materiali, come la vernice trasparente di un legno laccato, potrebbero cambiare nel passaggio da un formato all'altro.

### Cosa puoi valutare con un modello USDZ in AR?

Puoi osservare la forma e l'aspetto dell'oggetto nella stanza. Se il modello è generato da una foto, confronta anche i lati ricostruiti con il prodotto originale. Per conoscere le dimensioni del mobile, consulta quelle riportate dal venditore nel testo della scheda.

### USDZ e USD sono la stessa cosa?

USDZ è un pacchetto di USD. Una scena USD può essere un file di testo (.usda), un file binario (.usdc) o più file che si richiamano a vicenda. USDZ riunisce quei livelli e le loro texture in un solo zip non compresso: per questo è facile da mandare in un messaggio e da aprire su iPhone.

### Blender può esportare un file USDZ?

Sì, dalla versione 3.5. Usa File, Esporta, Universal Scene Description e assegna al file l'estensione .usdz. Controlla l'esportazione in Quick Look su un Mac o su un iPhone, perché alcune impostazioni dei materiali di Blender non vengono trasferite in USD e possono produrre superfici meno definite o di un colore diverso rispetto alla vista di Blender.
