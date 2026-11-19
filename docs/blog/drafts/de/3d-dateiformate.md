---

group: "3d-file-formats"
title: "Welches 3D-Dateiformat passt zu deinem Projekt?"
description: "Wählen Sie GLB, USDZ, OBJ oder FBX basierend auf dem Ziel und dem, was bei der Übergabe überleben muss."
date: 2026-11-22
updated: 2026-11-22
keyword: "3D-Dateiformate"
cta: "Prüfe deine Produktansichten in der kostenlosen Vorschau."
---

Wähle die Dateiformat durch das Öffnen der Ziel-App zuerst. Für einen Web-Produkt-Viewer beginne mit GLB. Für Apple Quick Look teste einen USDZ. Wenn die nächste Person das Asset bearbeiten soll, vereinbaren, welches Format von ihrer Werkzeugkette importiert wird und nenne die benötigten Funktionen auf.

![Darstellung: gestapelte Zylinder, halb mit Oberfläche, halb als Drahtgitter](../covers/3d-file-formats.webp "Redaktionelle Illustration aus Blender.")

## Was sollst du für jede Aufgabe liefern?

| Aufgabe                         | Ausgangsformat                             | Prüfung bei Abgabe                      |
| ------------------------------- | ------------------------------------------ | --------------------------------------- |
| Produkt-Viewer im Web           | GLB                                        | Texturen, Erweiterungen und erste Frame |
| Apple Quick Look                | USDZ                                       | Öffnet auf einem kompatiblen Gerät      |
| Statische Geometrie-Übergabe    | OBJ plus MTL und Maps, wenn nötig          | Relative Pfade, Normale und Einheiten   |
| Szenen- oder Animation-Übergabe | FBX, falls beide Werkzeuge es unterstützen | Rig, Clips und Materialzuweisung        |

Beim erneuten Öffnen der Exporte in Blender haben wir die einzelnen Ressourcen geprüft. Ohne WebP blieb die Geometrie der glTF-Datei sichtbar. Ohne BIN schlug der Import fehl. Der FBX-Export des Nachttischs enthielt das Bild, während die Materialdatei des OBJ-Exports keine Textur referenzierte.

## Wie machst du eine Übergabe prüfbar?

Frage nach dem zu verwendenden Importer und der Version. Sende eine echte Asset mit der erwarteten Ausrichtung, visuellen Referenz und allen externen Ressourcen. Für einen Rig inkludiere den Namen und den Frame-Raum eines bekannten Clips.

Öffne das Ergebnis in der empfangenden App ohne Zugriff auf deinen Arbeitsordner. Dreh und prüfe es in neutraler Beleuchtung. Eine Datei, die sich öffnet, kann dennoch Unterschiede in Materialien oder Bewegungen aufweisen.

## Was solltest du vor der Veröffentlichung prüfen?

| Symptom                                   | Was zu überprüfen                                             |
| ----------------------------------------- | ------------------------------------------------------------- |
| Graue Flächen                             | Fehlende Texturen oder nicht unterstützte Materialzuweisungen |
| Gegenstand auf der Seite liegend          | Achsenkonventionen im Exporter und Importer                   |
| Vorschau funktioniert nur auf einem Gerät | Ziel-Viewer und seine erforderlichen Erweiterungen            |

<!-- IMAGE PENDING: Photograph or capture the example described in the brief. -->

**Quellen** [Khronos · glTF 2.0 Spezifikation](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [OpenUSD · USDZ Spezifikation](https://openusd.org/release/spec_usdz.html), [Apple · Quick Look](https://developer.apple.com/quick-look-gallery/), [Blender · Wavefront OBJ](https://docs.blender.org/manual/en/latest/files/import_export/obj.html), [Blender · FBX](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_fbx.html).

[Verwandte Anleitung](/learn/glb-file)

[So erstellst du ein 3D-Modell](/de/ratgeber/3d-modell-erstellen)

## Häufige Fragen

### Enthält GLB immer Texturen?

GLB kann Texturen enthalten, aber nicht immer – überprüfe die Ressourcenliste und die eingebetteten Assets, um zu bestätigen. Prüfe die Metadaten auf Texturen-URLs und Dateipfade, um sicherzustellen, dass diese gültig und erreichbar sind. Überprüfe Texturen-URLs und Dateipfade in den GLB-Metadaten vor der Verwendung.

### Kann OBJ Animationen übertragen?

Für einen typischen Austausch betrachte OBJ als statische Geometrie. Vereinbaren Sie separat ein Format für Rigs und Clips, und testen Sie, ob der Empfänger-Importer diese Funktionen unterstützt. Sende das OBJ-Datei mit der visuellen Referenz und der richtigen Ausrichtung, um sicherzustellen, dass die Animation korrekt importiert wird.

### Brauchst du die ursprüngliche Projektdatei?

Halte das Projekt als deiner bearbeitbaren Quelle. Leite das erforderliche Format an den Empfänger weiter, inklusive eines visuellen Beispiels, damit du es später erneuern kannst, ohne die Szene neu aufzubauen. Überprüfe die Texturen-URLs und Dateipfade in den GLB-Metadaten vor der Verwendung.
