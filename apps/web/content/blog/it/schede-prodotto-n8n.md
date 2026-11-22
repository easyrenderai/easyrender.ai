---

group: "n8n-product-pages-images-3d"
title: "Schede prodotto con n8n: testi, immagini e 3D"
description: "Crea bozze di schede prodotto con n8n, unendo dati di catalogo verificati, immagini e un modello 3D. Approva separatamente spese e pubblicazione."
date: 2026-11-18
updated: 2026-11-22
author: Jorge Rodríguez
authorType: person
keyword: "schede prodotto con n8n"
cta: "Carica la foto di un prodotto e controlla l’anteprima gratuita prima di creare il modello 3D."
---

Per creare una scheda prodotto con n8n, prepara il testo a partire dai dati verificati del catalogo e affida le immagini e il modello 3D a un ramo separato. Riunisci i risultati per SKU e versione dei dati, poi salva la bozza nello shop. Approva separatamente le spese per immagini e 3D e la pubblicazione.

![Lampada da tavolo, metà in ceramica e metà con il reticolo 3D in vista](/blog/illustrations/n8n-product-pages-images-3d/hero.webp "Illustrazione editoriale realizzata in Blender.")

> **Prova con un solo prodotto.** Il testo, le immagini e il modello devono corrispondere alla stessa variante prima che la scheda venga sottoposta ad approvazione.

![Testo e immagini confluiscono nella bozza della scheda tramite SKU e versione dei dati](/blog/figures/n8n-product-pages-images-3d/workflow-it.webp "Schema di preparazione della scheda in n8n.")

## Quali dati servono per il flusso di lavoro?

Prendi come esempio una lampada da tavolo in ceramica. Usa la stessa riga del catalogo in entrambi i rami. Se un dato obbligatorio manca, segnalalo per un controllo e lascialo fuori dalla descrizione.

| Campo                            | Esempio                                                | A cosa serve                                              |
| -------------------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| `sku`                            | `LAMP-CERAMIC-01`                                      | Identifica la variante in entrambi i rami                 |
| `source_version`                 | `photo-v2`                                             | Distingue un aggiornamento dei dati da un nuovo tentativo |
| `name`, `material`, `dimensions` | Lampada, ceramica confermata, misure di scheda tecnica | Fornisce i dati da usare nel testo                        |
| `image_url`, `locale`            | Foto di riferimento, `it-IT`                           | Indica l’immagine di partenza e la lingua                 |

Il [modello di workflow n8n per Shopify](https://n8n.io/workflows/11695-generate-product-descriptions-from-images-and-publish-to-shopify-using-ai/) mostra come ottenere una descrizione da un’immagine. Per la tua scheda, passa anche i dati confermati dal fornitore e specifica i campi da restituire.

> Prepara una bozza nella lingua richiesta, usando solo i dati verificati. Restituisci `title`, `description`, `bullets`, `alt_text` e `missing_facts`. Elenca le informazioni mancanti in `missing_facts`. Non pubblicare nulla.

Controlla che siano presenti tutti e cinque i campi e che i due elenchi siano array. Conserva lo SKU e la versione della riga originale. Se n8n non riesce a interpretare la risposta o mancano dati obbligatori, invia la bozza a chi deve controllarla.

## Quali file vanno controllati?

Il vaso della galleria EasyRender mostra la foto originale, le viste generate e il modello esportato. Il modello interattivo è un file GLB, la versione binaria del [formato glTF di Khronos](https://www.khronos.org/gltf/). Aprilo a parte e confronta la sagoma e la resa della superficie con la foto.

![Foto originale del vaso, viste generate e immagine del modello 3D](/blog/figures/n8n-product-pages-images-3d/photo-angles-model.jpg "Esempio EasyRender. Al centro ci sono le viste generate, a destra un’immagine statica del modello.")

| File                 | Esempio                                                 |
| -------------------- | ------------------------------------------------------- |
| Foto di partenza     | [Apri la foto](/showcase/vase.jpg)                      |
| Viste da controllare | [Apri la tavola delle viste](/showcase/vase-angles.jpg) |
| Modello interattivo  | [Scarica il GLB](/showcase/vase.glb)                    |

Con n8n 2.48.5 abbiamo cambiato l’ordine di arrivo dei file di tre articoli di prova. Il flusso ha associato correttamente due GLB pubblici approvati e ha verificato l’intestazione binaria e la dimensione dichiarata. Ha messo in attesa la poltrona perché il modello apparteneva a una versione precedente.

| SKU             | Versione                | Risultato                     |
| --------------- | ----------------------- | ----------------------------- |
| `VASE-DEMO-01`  | `v2`                    | Bozza con GLB da 400.792 byte |
| `TABLE-DEMO-01` | `v3`                    | Bozza con GLB da 326.872 byte |
| `CHAIR-DEMO-01` | Dati `v3`, modello `v2` | Da controllare                |

Il test locale usa file esistenti. Per la generazione delle immagini, la creazione a pagamento del modello e la pubblicazione sullo shop servono prove separate. Puoi [importare il flusso di esempio](/blog/figures/n8n-product-pages-images-3d/n8n-local-draft-workflow.json) e [consultare il risultato](/blog/figures/n8n-product-pages-images-3d/n8n-local-draft-result.json).

## Come generi e recuperi immagini e modello?

Usa il nodo integrato [HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/). Aggiungi alle credenziali l’intestazione `Authorization` con valore `Bearer YOUR_API_KEY` e sostituisci lì il segnaposto. Tieni la chiave fuori dagli export condivisi.

1. Verifica saldo e costo corrente del set di viste con `GET https://easyrender.ai/api/credits`. Fai approvare la spesa. Per controllare un singolo prodotto con un’anteprima gratuita, usa `POST /api/renders`.
2. Dopo l’approvazione, invia `POST /api/product-views` con `image_url`, `name` e un eventuale `prompt`. Salva l’`id` restituito nel tuo record come `view_set_id`.
3. Ripeti `GET /api/product-views/{id}` finché `status` è `ready`. Se ricevi `failed`, interrompi il flusso. Rispetta i limiti di frequenza, controlla ogni vista e scarica quelle approvate con `GET /api/product-views/{id}/views/{view}`, usando l’identificativo restituito per ciascuna vista.
4. Dopo il controllo visivo, chiama `POST /api/product-views/{id}/render` e salva il campo `renderId`. Questa operazione crea o riutilizza la bozza del render.
5. Usa il `renderId` come `{id}` in `GET /api/renders/{id}`. Fai approvare il costo residuo, corrispondente a `max(0, renderCredits - credits)`. Invia a `POST /api/renders/{id}/render` il numero intero approvato in `maxCredits`.
6. Quando `status` è `ready` e `hasModel` è `true`, scarica il file con una richiesta autenticata a `GET /api/renders/{id}/model?download=1`.

Lo [schema dell’API](https://easyrender.ai/api/openapi.json) elenca campi e stati. La creazione del set di viste non ha un campo `maxCredits`. Controlla l’autorizzazione alla spesa nel flusso e usa una chiave dedicata con un limite di crediti.

## Come porti la bozza nello shop?

Riunisci il testo e i file tramite `sku` e `source_version`. Salva nello stesso record gli identificativi del set di viste, del render e dei media dello shop. Se una chiamata a pagamento non risponde, verifica se l’operazione è già partita prima di ripeterla.

Per ogni SKU e versione, registra separatamente il costo approvato per le viste, quello per il modello 3D e il via libera alla pubblicazione.

La [guida Shopify per i media](https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections/manage-media) descrive il caricamento, l’elaborazione del file e l’associazione al prodotto. Scarica il GLB privato con la chiave EasyRender e usa le credenziali dello shop per il caricamento. Aspetta che Shopify completi l’elaborazione prima di controllare il risultato nel tema.

| Situazione                                      | Azione                                                 |
| ----------------------------------------------- | ------------------------------------------------------ |
| Testo e modello appartengono a versioni diverse | Metti in attesa la bozza e correggi l’associazione     |
| Il file è ancora in elaborazione                | Controlla lo stato tramite l’identificativo del media  |
| Variante, testo e file corrispondono            | Invia la bozza a chi deve autorizzare la pubblicazione |

Per scegliere la foto di partenza, consulta la [guida ai modelli 3D da foto](/it/guide/creare-un-modello-3d-da-foto). Per capire se conviene estendere il flusso a più SKU, misura sul primo articolo il tempo di revisione, le correzioni manuali e i crediti consumati.

## FAQ

### Basta una foto per creare una scheda prodotto con n8n?

n8n può collegare i servizi che preparano il testo, le immagini e il modello e salvare una scheda in bozza. Passa al flusso anche i dati verificati del catalogo. Misure, materiali e certificazioni devono basarsi sui dati del fornitore o su altra documentazione verificata prima della pubblicazione.

### Le immagini e il modello 3D sono gratuiti?

L’anteprima da una foto è gratuita. La generazione di un set di viste consuma crediti, e la successiva creazione del modello 3D ha un costo separato. Controlla il costo prima di approvare ciascun passaggio e considera anche eventuali costi del servizio di scrittura e dell’hosting di n8n.

### Serve un nodo EasyRender dedicato in n8n?

Per questo flusso è sufficiente il nodo HTTP Request già disponibile in n8n. Configura le credenziali EasyRender e riutilizzale per avviare l’operazione, controllare lo stato e scaricare il file. Salva gli identificativi delle operazioni per riprendere i controlli se l’esecuzione raggiunge il limite di tempo previsto.

### Il flusso pubblica automaticamente le schede?

Questo flusso salva una bozza da controllare nel tema dello shop. Se vuoi automatizzare la pubblicazione, aggiungi un passaggio separato che si attivi solo dopo l’approvazione. Prima di pubblicare, controlla la variante, il testo, l’ordine delle immagini e l’apertura del modello nel visualizzatore della scheda.
