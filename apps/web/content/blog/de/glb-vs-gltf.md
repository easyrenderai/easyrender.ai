---

group: "glb-vs-gltf"
title: "GLB oder glTF: Welches Format passt zu deinem Modell?"
description: "Dasselbe 3D-Modell als GLB und als separate glTF-Dateien. Vergleiche Dateigröße, Texturen und die Übergabe an deinen Viewer."
date: 2026-11-25
updated: 2026-11-25
author: Jorge Rodríguez
authorType: person
keyword: "GLB vs glTF"
cta: "Teste die kostenlose Vorschau mehrerer Ansichten mit einem Produktfoto."
---

**Wähle GLB, wenn du eine einzelne Datei weitergeben willst.** Beim separaten glTF-Export kannst du JSON, Binärdaten und Texturen einzeln verwalten. Im Test lud Blender die Geometrie auch ohne die Texturdatei. Ohne die BIN-Datei brach der Import ab.

![Runde Vase mit Oberfläche auf der linken und Drahtgitter auf der rechten Seite](/blog/illustrations/glb-vs-gltf/hero.webp "Redaktionelle Illustration aus Blender.")

## Wie groß wurden die beiden Exporte derselben Vase?

Wir exportierten dieselbe Vase zweimal in Blender 5.2.3. Die GLB-Datei war **1.732.772 Byte** groß. Der separate Export bestand aus 2.124 Byte JSON, 1.702.680 Byte Binärdaten und einer WebP-Datei mit 28.466 Byte.

Mit diesen Einstellungen war die Gesamtgröße fast gleich. Vergleiche beim separaten Export die Summe aller Dateien mit dem GLB. Andere Exporteinstellungen oder Texturformate können das Ergebnis verändern.

![Gerenderte Vase nach dem Import der separaten glTF-Dateien in Blender](/blog/figures/glb-vs-gltf/vase-gltf-render.jpg "Separater glTF-Export beim erneuten Öffnen in Blender. Die BIN- und WebP-Datei liegen neben der JSON-Datei.")

Aus je einer Kopie des separaten Exports entfernten wir eine der beiden Zusatzdateien. Ohne WebP lud Blender die Geometrie, aber der Bildeintrag enthielt keine Pixeldaten. Ohne BIN brach der Import ab.

Wiederhole beide Prüfungen mit Kopien in eigenen Ordnern. Öffne vor der Übergabe den vollständigen Export auf dem Rechner, auf dem er verwendet wird.

## Wie überprüfst du die Übergabe?

Kopiere für die Übergabe als einzelne Datei nur das GLB in einen leeren Ordner und öffne es ohne Netzwerkzugriff. Kopiere bei separatem glTF den gesamten Exportordner. Fehlt eine Textur, vergleiche ihre URI im JSON mit dem Dateinamen und Pfad im Zielsystem.

## Welcher Export passt zum Ziel?

| Ziel                                        | Passende Übergabe                                                |
| ------------------------------------------- | ---------------------------------------------------------------- |
| E-Mail oder Produktkatalog                  | Eigenständige GLB-Datei, die du einzeln getestet hast            |
| Fehlersuche bei einem Material              | Separates glTF mit Bild- und BIN-Datei                           |
| Webserver mit separater Zwischenspeicherung | Auf dem Zielserver prüfen, ob der Viewer alle Dateien laden kann |

## Was passiert, wenn eine Datei fehlt?

| Geöffnete Kopie       | Ergebnis in Blender                               |
| --------------------- | ------------------------------------------------- |
| Nur die GLB-Datei     | Geometrie und Textur wurden geladen               |
| glTF mit BIN und WebP | Geometrie und Textur wurden geladen               |
| glTF ohne WebP        | Blender lud die Geometrie ohne Textur             |
| glTF ohne BIN         | Importabbruch. Blender meldete die fehlende Datei |

## Welche Dateien gehören zusammen?

| Datei               | Verwendung                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------- |
| glTF-Datei mit JSON | Öffne sie zum Laden der Szene                                                                |
| BIN-Datei           | Lege sie unter dem im JSON angegebenen Pfad ab                                               |
| Bilddateien         | Behalte Pfade und Groß- und Kleinschreibung bei. Öffne anschließend den Export im Zielsystem |

Die technischen Details stehen in der [glTF-Spezifikation](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html). Prüfe die Dateistruktur mit dem [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator). Die Exporteinstellungen findest du im [Blender-Handbuch](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html).

[So erstellst du ein 3D-Modell](/de/ratgeber/3d-modell-erstellen)

## Häufige Fragen

### Ist eines der Formate immer kleiner?

Die Größe hängt von den exportierten Daten und der Texturkomprimierung ab. Exportiere dasselbe Modell mit vergleichbaren Einstellungen in beide Formate und miss die Gesamtgröße. Zähle beim separaten glTF auch den BIN-Puffer und alle Bilddateien mit. In unserem Test ergaben die drei Dateien zusammen 1.733.270 Byte.

### Kann eine GLB-Datei auf externe Ressourcen verweisen?

Ja. Wenn du eine eigenständige Datei brauchst, verschiebe nur das GLB in einen leeren Ordner und öffne es im Ziel-Viewer ohne Netzwerkzugriff. Prüfe, ob sowohl die Geometrie als auch die Texturen zu sehen sind. Achte besonders auf Texturen, die nach dem Verschieben fehlen.

### Weshalb sieht dasselbe Modell in zwei Viewern anders aus?

Beleuchtung, Tonemapping und die Unterstützung von Materialien oder Erweiterungen können sich unterscheiden. Lade für einen Formatvergleich beide Exporte in denselben Viewer und verwende dieselben Einstellungen für Beleuchtung und Kamera. Fehlt nur beim separaten Paket eine Textur, überprüfe zuerst die URI und den Pfad der Bilddatei.
