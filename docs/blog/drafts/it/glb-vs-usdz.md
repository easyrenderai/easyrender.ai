---

group: "glb-vs-usdz"
title: "GLB o USDZ per il web e la realtà aumentata su Apple"
description: "Scegli GLB per il browser o USDZ per Apple Quick Look e verifica entrambe le visualizzazioni con lo stesso prodotto."
date: 2026-12-10
updated: 2026-12-10
keyword: "GLB vs USDZ"
cta: "Controlla le diverse viste del tuo prodotto nell’anteprima gratuita."
---

Usa GLB come punto di partenza per un modello interattivo nel browser e USDZ quando è necessario l'Apple Quick Look. Fornisci entrambi se lo stesso listing offre queste due esperienze. Testa i file separatamente sui dispositivi di destinazione e confronta l'orientamento, i materiali e il percorso di ritorno al listing.

![Illustrazione di vaso sfaccettato, metà solida e metà a reticolo](../covers/glb-vs-usdz.webp "Illustrazione editoriale realizzata in Blender.")

## Qual file serve a ogni parte della pagina?

| Destinazione                   | File tipico   | Verifica                                        |
| ------------------------------ | ------------- | ----------------------------------------------- |
| Visualizzatore di prodotto web | GLB           | Caricato e ruotato con texture                  |
| Apple Quick Look               | USDZ          | Aperto su dispositivo supportato                |
| Dispositivo non supportato     | Foto o poster | L'informazione sul prodotto rimane utilizzabile |

## Come verificare la corrispondenza?

Assegna i due file allo stesso SKU e revisione. Apri il GLB nel visualizzatore web e usa l'azione del listing per aprire il USDZ su un dispositivo Apple. Confronta il finish in luce neutra e conferma il ritorno alla stessa variante.

## Cosa verificare prima di pubblicare?

| Problema                                         | Verifica                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| Visualizzatore web funziona, Quick Look fallisce | URL del file USDZ e dispositivo                                      |
| Il colore appare diverso                         | Illuminazione materiale e ambientale                                 |
| La variante errata appare                        | Entrambe le riferimenti all'asset sono presenti sull'articolo attivo |

<!-- IMAGE PENDING: Photograph or capture the example described in the brief. -->

**Fonte** [Khronos · specifica glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [OpenUSD · specifica USDZ](https://openusd.org/release/spec_usdz.html), [Apple · Quick Look](https://developer.apple.com/quick-look-gallery/), [model-viewer · documentazione](https://modelviewer.dev/docs/).

[Guida correlata](/it/guide/file-usdz)

[Come creare un modello 3D](/it/guide/come-creare-un-modello-3d)

## Domande frequenti

### È possibile utilizzare entrambi i formati in una pagina?

Puoi utilizzare sia GLB che USDZ sulla pagina fornendo ciascun formato al suo destinatario e verificando i controlli visibili. Mantieni un'immagine statica per gli utenti che non possono utilizzare il viewer. Verifica i dimensioni dei file e i tempi di caricamento sia nel web che nell'ambiente AR di Apple.

### È il GLB un formato valido per ogni viewer AR?

Il GLB non è valido per ogni viewer AR. Assegna il GLB al visualizzatore web e il USDZ a Apple Quick Look. Verifica che entrambi i file siano associati allo stesso SKU e che il Quick Look si apra su dispositivo supportato, evitando il malinteso di un errore di variante.

### Dovrei confrontare i file solo per dimensione?

Registrare la dimensione e verificare l'aspetto e l'interazione. Un file più piccolo è utile solo se il dispositivo lo può aprire e il modello continua a rappresentare correttamente il prodotto. Controlla i tempi di caricamento sia sul web che nell'AR di Apple per garantire una esperienza fluida.
