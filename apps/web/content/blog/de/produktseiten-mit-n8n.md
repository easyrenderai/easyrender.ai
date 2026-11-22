---

group: "n8n-product-pages-images-3d"
title: "Produktseiten mit n8n: Texte, Bilder und 3D"
description: "Erstelle Produktseiten als Shop-Entwurf. So verknüpfst du in n8n geprüfte Katalogdaten, Bilder und 3D-Modelle und gibst die Kosten separat frei."
date: 2026-11-18
updated: 2026-11-22
author: Jorge Rodríguez
authorType: person
keyword: "Produktseiten mit n8n"
cta: "Lade ein Produktfoto hoch und prüfe die kostenlose Vorschau, bevor du ein 3D-Modell erstellen lässt."
---

Mit n8n legst du eine Produktseite als Entwurf in deinem Shop an. Parallel zur Beschreibung aus geprüften Katalogdaten bereitest du die Bilder und das 3D-Modell vor. Führe beide Zweige über die Artikelnummer (SKU) und die Version der Quelldaten zusammen. Gib die Kosten für Bilder und 3D sowie die Veröffentlichung jeweils separat frei.

![Tischleuchte, halb mit Keramikoberfläche, halb als Drahtgitter](/blog/illustrations/n8n-product-pages-images-3d/hero.webp "Redaktionelle Illustration aus Blender.")

> **Prüfe zuerst einen einzigen Artikel.** Am Ende sollten der Text, die Bilddateien und das Modell dieselbe Variante zeigen und der Shop-Eintrag als Entwurf gespeichert sein.

![Text und Medien laufen über SKU und Version der Quelldaten im Shop-Entwurf zusammen](/blog/figures/n8n-product-pages-images-3d/workflow-de.webp "Schema für die Verknüpfung beider Zweige in n8n.")

## Welche Daten braucht der Workflow?

Beginne mit einem Datensatz für eine keramische Tischleuchte. Übergib ihn sowohl an den Knoten für den Text als auch an den Zweig für die Medien. Fehlende Angaben gehen zurück zur Prüfung und bleiben bis dahin aus der Beschreibung.

| Feld                             | Beispiel                                               | Wofür du es brauchst                                     |
| -------------------------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| `sku`                            | `LAMP-CERAMIC-01`                                      | Verknüpft alle Ergebnisse mit der richtigen Variante     |
| `source_version`                 | `photo-v2`                                             | Trennt eine neue Datenversion von einem erneuten Versuch |
| `name`, `material`, `dimensions` | Tischleuchte, bestätigte Keramik, Maße laut Datenblatt | Liefert geprüfte Angaben für den Text                    |
| `image_url`, `locale`            | Referenzfoto, `de-DE`                                  | Legt die Bildquelle und die Zielsprache fest             |

Die [n8n-Vorlage für Shopify](https://n8n.io/workflows/11695-generate-product-descriptions-from-images-and-publish-to-shopify-using-ai/) zeigt, wie aus einem Bild ein Textentwurf entsteht. Für technische Angaben solltest du zusätzlich die Lieferantendaten übergeben und einen festen Aufbau für die Antwort vorgeben.

> Schreibe eine Produktbeschreibung in der vorgegebenen Sprache. Verwende ausschließlich die geprüften Katalogdaten. Gib `title`, `description`, `bullets`, `alt_text` und `missing_facts` zurück. Führe fehlende Angaben unter `missing_facts` auf. Veröffentliche nichts.

Prüfe in n8n, ob alle Felder vorhanden sind und beide Listen als Arrays vorliegen. Behalte die ursprüngliche SKU und Quellversion aus dem Eingabedatensatz. Wenn n8n die Antwort nicht einlesen kann oder Pflichtangaben fehlen, leite den Datensatz zur manuellen Prüfung weiter.

## Was liegt am Ende zur Prüfung vor?

Das Vasenbeispiel zeigt, was du pro Artikel ablegen kannst: das Ausgangsfoto, die ausgewählten Ansichten und das Modell. Das interaktive Modell liegt als GLB-Datei vor, der binären Variante des [glTF-Formats](https://www.khronos.org/gltf/). Öffne sie separat und vergleiche die sichtbare Form und Oberfläche mit dem Foto.

![Ausgangsfoto der Vase, generierte Ansichten und ein Standbild des 3D-Modells](/blog/figures/n8n-product-pages-images-3d/photo-angles-model.jpg "EasyRender-Beispiel. In der Mitte stehen die generierten Ansichten, rechts ein Standbild des Modells.")

| Datei        | Beispiel                                      |
| ------------ | --------------------------------------------- |
| Referenzfoto | [Foto öffnen](/showcase/vase.jpg)             |
| Ansichten    | [Übersicht öffnen](/showcase/vase-angles.jpg) |
| Modell       | [GLB herunterladen](/showcase/vase.glb)       |

In n8n 2.48.5 haben wir die Medien für drei Testartikel absichtlich in anderer Reihenfolge übergeben. Der Workflow ordnete beide freigegebenen öffentlichen GLBs korrekt zu und prüfte Dateikopf und angegebene Dateilänge. Den Sessel hielt er wegen einer veralteten Modellversion zurück.

| SKU             | Quellversion            | Testergebnis                  |
| --------------- | ----------------------- | ----------------------------- |
| `VASE-DEMO-01`  | `v2`                    | Entwurf mit GLB, 400.792 Byte |
| `TABLE-DEMO-01` | `v3`                    | Entwurf mit GLB, 326.872 Byte |
| `CHAIR-DEMO-01` | Daten `v3`, Modell `v2` | Zur Prüfung zurückgestellt    |

Der lokale Test verwendet vorhandene Dateien. Bilderzeugung, kostenpflichtige 3D-Erstellung und Veröffentlichung im Shop brauchen eigene Tests. [Beispielworkflow importieren](/blog/figures/n8n-product-pages-images-3d/n8n-local-draft-workflow.json) oder [Testergebnis ansehen](/blog/figures/n8n-product-pages-images-3d/n8n-local-draft-result.json).

## Wie rufst du die Bilder und das Modell ab?

Nutze in n8n den Knoten [HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/) mit einem gespeicherten Zugangsdaten-Eintrag. Setze den Header `Authorization` auf `Bearer YOUR_API_KEY` und ersetze den Platzhalter dort. Den Schlüssel lässt du aus einem geteilten Export heraus.

1. Prüfe über `GET https://easyrender.ai/api/credits` den Kontostand und die aktuellen Kosten der Bildserie. Hole die Freigabe ein. Für einen ersten Blick auf das Produkt kannst du über `POST /api/renders` eine kostenlose Vorschau anlegen.
2. Sende nach Kostenfreigabe `POST /api/product-views` mit `image_url`, `name` und optional `prompt`. Speichere das zurückgegebene Feld `id` in deinem Datensatz als `view_set_id`.
3. Frage mit `GET /api/product-views/{id}` den Status ab. Halte bei `failed` an und berücksichtige das Anfragelimit. Lade akzeptierte Ansichten über `GET /api/product-views/{id}/views/{view}` mit der jeweiligen Ansichts-ID herunter.
4. Rufe nach Sichtprüfung `POST /api/product-views/{id}/render` auf und speichere `renderId`. Dieser Aufruf legt den Renderentwurf an oder verwendet einen vorhandenen Entwurf.
5. Setze die gespeicherte `renderId` als `{id}` in `GET /api/renders/{id}` ein, um den Status abzurufen. Hole die Freigabe für den Restbetrag `max(0, renderCredits - credits)` ein. Übergib die genehmigte ganze Zahl als `maxCredits` an `POST /api/renders/{id}/render`.
6. Sobald `status` den Wert `ready` und `hasModel` den Wert `true` hat, lade die Datei authentifiziert über `GET /api/renders/{id}/model?download=1` herunter.

Die [API-Referenz](https://easyrender.ai/api/openapi.json) enthält die Felder und Statuswerte. Die Erstellung einer Bildserie hat kein eigenes `maxCredits`. Prüfe ihre Kostenfreigabe im Workflow und nutze einen eigenen API-Schlüssel mit Credit-Limit.

## Wie bringst du die Dateien in den Shop?

Führe Text und Medien nach `sku` und `source_version` zusammen. Speichere Bildserien-ID, Render-ID, Textversion und Shop-Medien-IDs beim Datensatz. Wenn bei einem kostenpflichtigen Aufruf die Antwort ausbleibt, kläre zuerst, ob der Auftrag schon existiert.

[Der Leitfaden für 3D im Onlineshop erklärt](/de/ratgeber/3d-modelle-fuer-onlineshops), wie du die Medien im Shop prüfst. Die [Shopify-API-Dokumentation](https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections/manage-media) beschreibt Upload, Verarbeitung und Zuordnung zur Produktseite. Lade die private GLB-Datei mit dem EasyRender-Schlüssel herunter und verwende für den Upload die Zugangsdaten des Shops.

| Prüfergebnis                                                  | Nächste Aktion                                    |
| ------------------------------------------------------------- | ------------------------------------------------- |
| Text und Medien gehören zu verschiedenen Versionen            | Entwurf anhalten und den Datensatz berichtigen    |
| Modell ist hochgeladen und Shopify verarbeitet die Datei noch | Mit der gespeicherten Medien-ID den Status prüfen |
| Titel, Variante und Medien stimmen im Theme                   | Den Entwurf zur Veröffentlichung freigeben lassen |

Der [Leitfaden zur Erstellung von 3D-Modellen](/de/ratgeber/3d-modell-erstellen) hilft bei der Auswahl des Ausgangsfotos. Miss bei deinem ersten Artikel die Prüfzeit, die manuellen Korrekturen und den Credit-Verbrauch, bevor du mehrere SKUs automatisch verarbeitest.

## FAQ

### Kann n8n eine Produktseite aus einem Foto erstellen?

n8n kann die Dienste zur Text-, Bild- und Modellerstellung verbinden und den Shop-Entwurf anlegen. Liefere dazu die geprüften Produktdaten für die gewählte Variante. Maße, Materialien und Zertifizierungen gehören nur dann in den Text, wenn sie aus dem Katalog oder aus einem bestätigten Lieferantendatenblatt stammen.

### Welche Schritte kosten Credits?

Die Vorschau zu einem Produktfoto ist kostenlos. Für eine Bildserie aus der API und für den anschließenden 3D-Build fallen separat Credits an. Prüfe den Preis für die Bildserie und den Restbetrag für den konkreten Render vor der jeweiligen Freigabe. Plane Textdienst und n8n-Betrieb gesondert ein.

### Brauche ich einen eigenen EasyRender-Knoten für n8n?

Der mitgelieferte HTTP-Request-Knoten reicht für den beschriebenen Ablauf aus. Trage den EasyRender-Schlüssel einmal in den Zugangsdaten ein und verwende diesen Eintrag in den API-Knoten für Auftrag, Status und Download. Speichere die jeweiligen IDs, damit du die Statusabfrage später fortsetzen kannst, falls der Workflow seine Frist erreicht.

### Veröffentlicht der Workflow die Produktseite automatisch?

Dieser Ablauf endet mit einem Entwurf zur Prüfung. Du kannst einen separaten Veröffentlichungsschritt hinzufügen und ihn von einer ausdrücklichen Freigabe abhängig machen. Öffne zuerst den Entwurf im tatsächlichen Shop-Theme und prüfe die Variante, den Text, die Bildreihenfolge und ob sich das Modell im Produktviewer öffnen lässt.
