---

group: "glb-vs-gltf"
title: "GLB o glTF per consegnare un modello 3D?"
description: "Confronta lo stesso modello in GLB e in glTF con file separati. Verifica peso complessivo, texture e apertura nel visualizzatore."
date: 2026-11-25
updated: 2026-11-25
author: Jorge Rodríguez
authorType: person
keyword: "GLB o glTF"
cta: "Prova gratis le anteprime da più angolazioni partendo da una foto del prodotto."
---

**Scegli GLB se vuoi consegnare un unico file.** L’esportazione glTF con file separati permette di gestire singolarmente il JSON, i dati binari e le immagini delle texture. Nella prova in Blender, la geometria si apriva anche senza l’immagine della texture. Senza il file BIN, l’importazione si interrompeva.

![Vaso rotondo con la superficie da un lato e la trama della mesh dall’altro](/blog/illustrations/glb-vs-gltf/hero.webp "Illustrazione editoriale realizzata in Blender.")

## Quanto pesano le due esportazioni dello stesso vaso?

Abbiamo esportato lo stesso vaso in entrambi i formati con Blender 5.2.3. Il GLB occupava **1.732.772 byte**. L’esportazione con file separati comprendeva un JSON da 2.124 byte, un BIN da 1.702.680 byte e un’immagine WebP da 28.466 byte.

Con queste impostazioni, il peso complessivo era quasi identico. Per il confronto somma tutti i file del glTF separato. Le impostazioni di esportazione e la codifica delle texture possono cambiare il risultato.

![Render del vaso dopo aver importato i file glTF separati in Blender](/blog/figures/glb-vs-gltf/vase-gltf-render.jpg "Esportazione glTF con file separati riaperta in Blender. I file BIN e WebP si trovano accanto al JSON.")

Abbiamo rimosso un file alla volta dalle copie dell’esportazione. Senza il WebP, Blender caricava la geometria, ma l’immagine risultava priva di pixel. Senza il BIN, Blender interrompeva l’importazione.

Ripeti le prove su copie in cartelle distinte. Prima della consegna, apri l’esportazione completa sul computer in cui verrà usata.

## Come verificare che i file siano pronti per la consegna?

Se consegni un file unico, copia solo il GLB in una cartella vuota e aprilo senza connessione. Per il glTF separato, sposta l’intera cartella di esportazione. Se manca una texture, confronta il suo URI nel JSON con il nome e il percorso del file nella cartella di destinazione.

## Quale esportazione conviene per ogni destinazione?

| Destinazione                             | File da consegnare                                          |
| ---------------------------------------- | ----------------------------------------------------------- |
| E-mail o catalogo online                 | GLB autonomo, verificato in una cartella vuota              |
| Verifica di un materiale                 | glTF con file separati, completo di immagine e BIN          |
| Server web con cache per singola risorsa | File separati, dopo aver verificato le richieste necessarie |

## Che cosa succede se manca un file?

| Copia aperta        | Risultato in Blender                                            |
| ------------------- | --------------------------------------------------------------- |
| Solo il GLB         | Geometria e texture caricate                                    |
| glTF con BIN e WebP | Geometria e texture caricate                                    |
| glTF senza il WebP  | La geometria si apre, ma manca la texture                       |
| glTF senza il BIN   | L’importazione si interrompe e Blender segnala il file mancante |

## Quali file vanno tenuti insieme?

| File                  | A cosa serve                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| File glTF con il JSON | Aprilo per caricare la scena                                                                                  |
| File BIN              | Conservalo nel percorso indicato nel JSON                                                                     |
| Immagini              | Mantieni i percorsi e rispetta maiuscole e minuscole nei nomi. Apri il file .gltf sul sistema di destinazione |

Consulta la [specifica glTF](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) per la struttura dei formati. Verifica i file con il [validatore glTF di Khronos](https://github.com/KhronosGroup/glTF-Validator). Trovi le opzioni di esportazione nel [manuale di Blender](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html).

[Come creare un modello 3D](/it/guide/come-creare-un-modello-3d)

## Domande frequenti

### Uno dei due formati è sempre più leggero?

Il peso dipende dai dati esportati e dalla codifica delle texture. Esporta lo stesso modello nei due formati con impostazioni comparabili. Per il glTF con file separati, somma il peso di JSON, BIN e immagini prima del confronto. Nella nostra prova, il peso totale dei tre file era di 1.733.270 byte.

### Un GLB può fare riferimento a risorse esterne?

Sì. Se ti serve un file autonomo, copia il solo GLB in una cartella vuota e aprilo senza connessione nel visualizzatore di destinazione. Controlla che siano visibili sia la geometria sia le texture. Cerca eventuali immagini che scompaiono solo dopo aver spostato il file.

### Perché lo stesso modello ha un aspetto diverso in due visualizzatori?

Possono cambiare l’illuminazione, la mappatura tonale e il supporto per materiali ed estensioni. Per confrontare i formati, aprili nello stesso visualizzatore con le stesse impostazioni. Se una texture sparisce quando sposti i file separati, controlla il suo URI e il percorso dell’immagine.
