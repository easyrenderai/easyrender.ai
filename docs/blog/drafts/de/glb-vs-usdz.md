---

group: "glb-vs-usdz"
title: "GLB oder USDZ für Web und Apple Quick Look"
description: "Wende GLB für den Browser und USDZ für Apple Quick Look an und überprüfe beide Ansichten mit dem gleichen Produkt."
date: 2026-12-10
updated: 2026-12-10
keyword: "GLB vs USDZ"
cta: "Prüfe deine Produktansichten in der kostenlosen Vorschau."
---

Nutze GLB als Ausgangspunkt für ein interaktives Browser-Modell und USDZ, wenn Apple Quick Look erforderlich ist. Versende beide Dateien, wenn ein Produktlisting beide Erfahrungen anbietet. Teste die Dateien separat auf den Zielgeräten und vergleiche die Orientierung, die Materialien sowie den Weg zurück zum Listing.

![Darstellung: facettierter Übertopf, halb mit Oberfläche, halb als Drahtgitter](../covers/glb-vs-usdz.webp "Redaktionelle Illustration aus Blender.")

## Welche Datei benötigt jeder Teil der Seite?

| Ziel                      | Typische Datei   | Prüfung                              |
| ------------------------- | ---------------- | ------------------------------------ |
| Produktviewer im Browser  | GLB              | Lädt und dreht mit Texturen          |
| Apple Quick Look          | USDZ             | Öffnet auf einem unterstützten Gerät |
| Nicht unterstütztes Gerät | Foto oder Poster | Produktinformation bleibt nutzbar    |

## Wie überprüfst du die Kombination?

Nenne die beiden Dateien für die gleiche SKU und Revision. Öffne den GLB im Web-Viewer und nutze die Aktion des Listings, um den USDZ auf einem Apple-Gerät zu öffnen. Vergleiche die Oberfläche unter neutraler Beleuchtung und stelle sicher, dass du zur gleichen Variante zurückkehrst.

## Was solltest du vor der Veröffentlichung prüfen?

| Problem                                   | Prüfung                                    |
| ----------------------------------------- | ------------------------------------------ |
| Web-Viewer funktioniert, Quick Look fehlt | USDZ-Download-URL und Gerät                |
| Farbe sieht anders aus                    | Material und Umgebungsbeleuchtung          |
| Falsche Variante wird angezeigt           | Beide Asset-Referenzen auf dem aktiven SKU |

<!-- IMAGE PENDING: Photograph or capture the example described in the brief. -->

**Quelle** [Khronos · glTF 2.0 Spezifikation](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [OpenUSD · USDZ Spezifikation](https://openusd.org/release/spec_usdz.html), [Apple · Quick Look](https://developer.apple.com/quick-look-gallery/), [model-viewer · Dokumentation](https://modelviewer.dev/docs/).

[Verwandte Anleitung](/de/ratgeber/usdz-datei)

[So erstellt man ein 3D-Modell](/de/ratgeber/3d-modell-erstellen)

## Häufige Fragen

### Kann eine Seite beide Formate verwenden?

Du kannst beide Formate GLB und USDZ auf einer Seite verwenden, indem du jeweils das Format dem entsprechenden Ziel bereitstellst und visuelle Steuerungselemente überprüfst. Halte eine statische Abbildung für Benutzer bereit, die den Viewer nicht nutzen können. Prüfe die Dateigrößen und Ladezeiten in Web- und Apple-AR-Umgebungen.

### Ist GLB ein Format für alle AR-Viewer?

GLB wird nicht von allen AR-Viewern unterstützt. Überprüfe stets Geräte- und Browserkompatibilität. Prüfe die offiziellen Dokumentationen hinsichtlich GLB- und USDZ-Unterstützung in deinem spezifischen Web- und Apple-AR-Anwendungsszenario. Danach stelle sicher, dass dein AR-Viewer native Übergänge unterstützt, bevor du die Bereitstellung startest.

### Sollte ich die Dateien nur nach Größe vergleichen?

Notiere die Größe und überprüfe den Erscheinungsbild und die Interaktion. Eine kleinere Datei ist nützlich nur dann, wenn der Zielgerät das Format öffnen kann und das Modell den Produktvorgang noch erfüllt. Notiere die Größe beider Dateien und vergleiche sie im Web- und Apple-AR-Viewer unter gleichen Bedingungen.
