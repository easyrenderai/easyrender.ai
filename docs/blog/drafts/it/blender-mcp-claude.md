---

group: "blender-mcp-product-workflow"
title: "Da una foto a una scena Blender con Claude e MCP"
description: "Porta un GLB di prodotto in una scena Blender e usa Claude con uno strumento MCP compatibile per modifiche limitate alla scena."
date: 2026-12-13
updated: 2026-12-13
keyword: "Blender MCP Claude"
cta: "Controlla le diverse viste del tuo prodotto nell’anteprima gratuita."
---

Inizia creando e verificando il modello del prodotto prima di importarlo in Blender. Usa un connettore Blender MCP per assegnare a Claude un compito specifico. Controlla le modifiche alla scena in Blender e salva una copia per mantenere la geometria del prodotto separata dalla camera, dal lighting e dall'assetto della scena.

![Illustrazione di lampada articolata, metà solida e metà a reticolo](../covers/blender-mcp-product-workflow.webp "Illustrazione editoriale realizzata in Blender.")

## Come si configura un piccolo test?

Apri una copia della scena e importa un GLB noto. Verifica il nome, i materiali e l'orientamento. Segui la configurazione del connettore scelto e conferma che Claude possa elencare gli oggetti della scena prima di chiedergli di modificarli.

## Che cosa deve dire la prima istruzione?

Chiedigli di mantenere intatto il mesh e i materiali, posizionare il prodotto indicato sulla piattaforma esistente e riprenderlo da tre quarti. Verifica l'oggetto, la camera e il lighting in Blender, poi salva una nuova versione del progetto.

## Che cosa bisogna controllare prima di pubblicare?

| Passo        | Evidenze da conservare                         |
| ------------ | ---------------------------------------------- |
| Verifica     | Oggetto indicato e riferimento noto            |
| Modifica     | Cambio di camera o posizionamento in una copia |
| Approvazione | Controllo viewport e render                    |

<!-- IMAGE PENDING: Photograph or capture the example described in the brief. -->

**Fonte** [BlenderMCP · documentazione progetto](https://github.com/ahujasid/mcp-for-blender), [Anthropic · Claude Code MCP](https://code.claude.com/docs/en/mcp), [Blender · importo e esporto glTF 2.0](https://docs.blender.org/manual/en/5.1/addons/import_export/scene_gltf2.html).

[Guida correlata](/mcp)

[Come creare un modello 3D](/it/guide/come-creare-un-modello-3d)

## Domande frequenti

### Quale server MCP genera il modello?

In questo flusso, easyrender crea il modello a partire dalla foto. Il connettore di Blender serve a modificare la scena dopo l’importazione. Alcuni connettori possono anche richiamare un generatore esterno. Prima di iniziare, controlla quali strumenti sono disponibili e quali servizi richiedono credenziali proprie.

### Posso fare una prova con un GLB esistente?

Sì. Importa un GLB che conosci in una scena di prova usando l’importatore glTF di Blender. Controlla l’aspetto dei materiali, l’orientamento e le dimensioni dell’oggetto. Chiedi poi a Claude di elencare gli oggetti presenti nella scena, così puoi verificare che abbia individuato il modello giusto.

### Conviene modificare la scena originale al primo tentativo?

Lavora su una copia del progetto con un modello dal nome riconoscibile. Chiedi a Claude una sola modifica, per esempio di inquadrare il prodotto con la telecamera attiva. Controlla la mesh, i materiali e la telecamera dopo il cambiamento, quindi salva il risultato con un nuovo nome.
