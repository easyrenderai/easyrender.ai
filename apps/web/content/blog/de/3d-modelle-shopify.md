---

group: "shopify-3d-models"
title: "3D-Modelle zu Shopify-Produkten hinzufügen"
description: "Lade GLB oder USDZ in Shopify hoch. Prüfe das Modell vorab und teste die Produktgalerie deines Themes am Computer und auf dem Smartphone."
date: 2026-11-20
updated: 2026-11-24
author: Jorge Rodríguez
authorType: person
keyword: "Shopify 3D Modelle"
cta: "Lade ein Produktfoto hoch und prüfe die kostenlose Vorschau aus mehreren Blickwinkeln."
---

Für ein 3D-Modell auf einer Shopify-Produktseite lädst du eine GLB- oder USDZ-Datei in die Produktmedien hoch. Öffne danach die Vorschau im Theme deines Shops und teste den Viewer am Computer und auf dem Smartphone. Lass ein klares Produktfoto an erster Stelle, damit der Artikel auch während des Ladens zu sehen ist.

![Offener Versandkarton, halb mit Oberfläche und halb als Drahtgitter](/blog/illustrations/shopify-3d-models/hero.webp "Redaktionelle Illustration aus Blender.")

## Welche Datei solltest du vorbereiten?

Beginne mit einem Produkt, für das du gute Fotos hast. Drehe das Modell vor dem Upload im 3D-Viewer, bis du Rückseite und Unterseite siehst. Prüfe Form, Ausrichtung und Oberflächen und notiere die Dateigröße.

Die [Shopify-Anforderungen an Produktmedien](https://help.shopify.com/de/manual/products/product-media/product-media-types) nennen GLB und USDZ mit bis zu 500 MB pro Datei. Shopify optimiert Modelle über 15 MB automatisch. Die [glTF-Spezifikation](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) beschreibt den Aufbau von GLB.

![GLB eines EasyRender-Drehsessels in Blender](/blog/figures/shopify-3d-models/chair-inspection.webp "Wir haben die GLB-Quelldatei lokal in Blender geöffnet. Die Verarbeitung in Shopify und die Darstellung im Shop prüfst du separat in deiner Vorschau.")

| Was du prüfst                         | Wo du nachsiehst                           |
| ------------------------------------- | ------------------------------------------ |
| Ausrichtung, Texturen und Oberflächen | Im lokalen 3D-Viewer vor dem Upload        |
| Dateigröße und Verarbeitung           | In der Quelldatei und in den Produktmedien |
| Bildreihenfolge und Vorschaubild      | In der Vorschau deines Shopify-Themes      |

## Wie lädst du das Modell hoch?

1. Öffne im Shopify-Adminbereich **Produkte** und wähle für den ersten Test ein Produkt mit dem Status **Entwurf** aus.
2. Füge die Datei unter **Medien** hinzu. Die [Shopify-Anleitung zum Upload](https://help.shopify.com/de/manual/products/product-media/add-media) zeigt die Schritte im Browser und in der App.
3. Warte, bis Shopify die Datei verarbeitet hat, speichere die Änderungen und öffne die Produktvorschau. Lass das Produktfoto an erster Stelle und prüfe danach, ob sich das 3D-Modell auswählen und drehen lässt.

| Wenn du das siehst                                        | Prüfe zuerst                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------------ |
| Shopify lehnt den Upload ab                               | Dateiformat und Dateigröße                                               |
| Die Datei ist im Admin sichtbar, der Viewer fehlt im Shop | 3D-Unterstützung im Produktbereich des Themes                            |
| Der Viewer funktioniert, AR startet nicht                 | Gerät, Browser und die von Shopify verarbeitete AR-Datei                 |
| Das Modell erscheint vor dem Hauptfoto                    | Reihenfolge der Elemente unter **Medien**                                |
| Das Modell lädt langsam                                   | Dateigröße und Ladezeit auf einem Smartphone                             |
| Die Oberfläche sieht anders aus                           | Quellmodell und verarbeitete Datei bei ähnlicher Beleuchtung vergleichen |

## Wie prüfst du die Ansicht aus Kundensicht?

Öffne den Entwurf über [**Vorschau** im Shopify-Adminbereich](https://help.shopify.com/de/manual/products/add-update-products#preview-a-product). Wenn du einen Vorschaulink für Besucher hast, öffne ihn auch in einem privaten Browserfenster.

Wenn dein Theme nichts anzeigt, prüfe dessen Version und die Medienkomponente der Produktvorlage. Teste, ob du in der Galerie das Modell öffnen und danach zum Produktfoto zurückwechseln kannst.

| Gerät                   | Was funktionieren sollte                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Computer                | Das erste Produktfoto erscheint, das Modell lässt sich öffnen und drehen                                                         |
| Smartphone              | Modell und Bedienung bleiben nutzbar, die Produktfotos sind weiter erreichbar                                                    |
| Kompatibles Apple-Gerät | Falls AR angeboten wird, öffnet sich [Quick Look](https://developer.apple.com/quick-look-gallery/) und du kommst zurück zum Shop |

Wenn die Datei noch fehlt, erklärt unser [Leitfaden zur Erstellung von 3D-Modellen](/de/ratgeber/3d-modell-erstellen) den Einstieg. Für die restliche Produktseite findest du Beispiele im [Leitfaden zu 3D-Modellen für Onlineshops](/de/ratgeber/3d-modelle-fuer-onlineshops).

## Häufige Fragen

### Zeigt jedes Shopify-Theme 3D-Modelle an?

Das hängt vom Theme und seiner Version ab. Prüfe in der Shopify-Dokumentation, ob dein Theme 3D-Produktmedien unterstützt und ob deine angepasste Produktvorlage sie anzeigt. Öffne die Vorschau am Smartphone und teste, ob du vom ersten Produktfoto zum Modell und wieder zurückwechseln kannst.

### Soll ich GLB oder USDZ hochladen?

Shopify nimmt beide Formate an. Wähle die Datei, deren Ausrichtung, Texturen und Oberfläche du vor dem Upload geprüft hast, und bewahre sie als Original auf. Vergleiche nach der Verarbeitung das Modell im Shop mit der Quelldatei und teste die Ladezeit auf einem Smartphone.

### Soll das 3D-Modell das erste Produktfoto ersetzen?

Lass ein klares Produktfoto an erster Stelle. Zeige danach die Ansichten, die das Produkt erklären, und gib dem Modell einen erkennbaren Platz in der Galerie. Öffne es auf einem Smartphone und prüfe, dass du ohne Neuladen wieder zu den Fotos wechseln kannst.
