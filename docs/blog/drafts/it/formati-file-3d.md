---

group: "3d-file-formats"
title: "Quale formato 3D usare per web, AR e modifica"
description: "Scegli GLB, USDZ, OBJ o FBX in base al luogo finale del modello e a ciò che deve sopravvivere al trasferimento."
date: 2026-11-22
updated: 2026-11-22
keyword: "formati file 3D"
cta: "Controlla le diverse viste del tuo prodotto nell’anteprima gratuita."
---

Apri prima l'applicazione di destinazione per scegliere il formato. Per un viewer web, inizia con GLB. Per Apple Quick Look, prova con USDZ. Quando la persona successiva deve modificare l'asset, concorda su un formato che il loro strumento importa e elenca le funzionalità da mantenere.

![Illustrazione di pezzi cilindrici sovrapposti, metà solida e metà a reticolo](../covers/3d-file-formats.webp "Illustrazione editoriale realizzata in Blender.")

## Qual è il formato da consegnare per ciascun progetto?

| Progetto                        | Formato di partenza                            | Verifica all'invio                        |
| ------------------------------- | ---------------------------------------------- | ----------------------------------------- |
| Visualizzatore prodotto sul web | GLB                                            | Testi, estensioni e primo frame           |
| Apple Quick Look                | USDZ                                           | Deve aprire su un dispositivo compatibile |
| Handoff con geometria statica   | OBJ insieme a MTL e mappe quando necessario    | Percorsi relativi, normali e unità        |
| Handoff con scena o animazione  | FBX, se supportato da entrambe le applicazioni | Rig, clip e mappatura dei materiali       |

Riaprendo le esportazioni in Blender abbiamo verificato le risorse disponibili. Senza il WebP il glTF conservava la geometria e perdeva la texture. Senza il BIN l’importazione non riusciva. Il file FBX del comodino conservava l’immagine, mentre il file dei materiali dell’OBJ non indicava alcuna mappa.

## Come rendere il handoff controllabile?

Chiedi quale importer e versione verrà utilizzata. Invia un asset reale con l'orientamento previsto, riferimento visivo e qualsiasi risorsa esterna. Per un rig, includi il nome e l'intervallo di frame di una clip nota.

Apri il risultato nell'applicazione ricevente senza accesso al tuo cartella di lavoro. Ruota e ispeziona in luce neutra. Un file che si apre può comunque differire per materiali o movimento.

## Che cosa verificare prima di pubblicare?

| Sintomo                                    | Cosa verificare                                                   |
| ------------------------------------------ | ----------------------------------------------------------------- |
| Superfici grigie                           | Percorsi di texture mancanti o mappatura materiale non supportata |
| Oggetto appoggiato lateralmente            | Convenzioni degli assi nell'esportatore e nell'importatore        |
| La preview funziona su un solo dispositivo | Visualizzatore di destinazione e le sue estensioni richieste      |

<!-- IMAGE PENDING: Photograph or capture the example described in the brief. -->

**Fonte** [Khronos · specifica glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [OpenUSD · specifica USDZ](https://openusd.org/release/spec_usdz.html), [Apple · Quick Look](https://developer.apple.com/quick-look-gallery/), [Blender · Wavefront OBJ](https://docs.blender.org/manual/en/latest/files/import_export/obj.html), [Blender · FBX](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_fbx.html).

[Guida correlata](/learn/glb-file)

[Come creare un modello 3D](/it/guide/come-creare-un-modello-3d)

## Domande frequenti

### Il GLB include sempre le texture?

Il GLB può includere texture, ma non sempre—verifica l'elenco delle risorse e gli asset incorporati per confermarlo. Esamina i metadati per i percorsi delle texture e i nomi dei file per assicurarti che siano validi e raggiungibili. Verifica i percorsi e i nomi dei file delle texture nel metadati del GLB prima dell'uso.

### L'OBJ può trasmettere animazioni?

Per una trasmissione standard, considera l'OBJ come geometria statica. Accordati separatamente su un formato per i rig e i clip, e verifica che l'importatore del destinatario legga tali funzionalità. Verifica i percorsi delle texture nel metadati del GLB prima di inviare l'asset per garantire la corretta visualizzazione.

### Ho bisogno del file progetto originale?

Mantieni il progetto come fonte modificabile. Invia il formato richiesto dal destinatario insieme a un riferimento visivo, in modo da poter rigenerarlo in seguito senza dover ricostruire la scena. Verifica i percorsi delle texture nel metadati del GLB prima di inviarlo per garantire la corretta visualizzazione.
