---

group: "blender-mcp-product-workflow"
title: "Vom Produktfoto zur Blender-Szene mit Claude und MCP"
description: "Bringe ein Produkt-GLB in eine Blender-Szene und verwende Claude mit einem kompatiblen MCP-Tool für begrenzte Szene-Editierungen."
date: 2026-12-13
updated: 2026-12-13
keyword: "Blender MCP Claude"
cta: "Prüfe deine Produktansichten in der kostenlosen Vorschau."
---

Beginne mit der Erstellung und der Überprüfung des Produktmodells, bevor du es in Blender importierst. Nutze einen Blender-MCP-Connector, um Claude eine konkrete Aufgabe zu geben. Prüfe Änderungen in der Szene und speichere eine Kopie, um die Produktgeometrie von Kamera, Beleuchtung und Szeneaufbau zu trennen.

![Darstellung: verstellbare Arbeitsleuchte, halb mit Oberfläche, halb als Drahtgitter](../covers/blender-mcp-product-workflow.webp "Redaktionelle Illustration aus Blender.")

## Wie stellst du eine kleine Testumgebung auf?

Öffne eine Kopie der Szene und importiere ein bekanntes GLB. Prüfe den Namen, die Materialien und die Ausrichtung. Folge der eingerichteten Konnektoren-Setup und stelle sicher, dass Claude die Szeneobjekte auflisten kann, bevor du eine Änderung anfängst.

## Was sollte die erste Anweisung enthalten?

Bitte es, die Mesh- und Materialien zu behalten, das benannte Produkt auf die bestehende Plattform zu platzieren und es von drei Vierteln einzuframen. Prüfe das Objekt, die Kamera und die Beleuchtung in Blender, dann speichere eine neue Projektversion.

## Was solltest du vor der Veröffentlichung überprüfen?

| Schritt   | Beweise, die aufzubewahren sind                                   |
| --------- | ----------------------------------------------------------------- |
| Prüfe     | Benanntes Objekt und bekanntes Referenzobjekt                     |
| Bearbeite | Änderung der Kamera oder des Plazierungsverhaltens in einer Kopie |
| Genehmige | Prüfung des Viewport und der Renderung                            |

<!-- IMAGE PENDING: Photograph or capture the example described in the brief. -->

**Quelle** [BlenderMCP · Projekt-Dokumentation](https://github.com/ahujasid/mcp-for-blender), [Anthropic · Claude Code MCP](https://code.claude.com/docs/en/mcp), [Blender · glTF 2.0 Import und Export](https://docs.blender.org/manual/en/5.1/addons/import_export/scene_gltf2.html).

[Verwandte Anleitung](/mcp)

[So erstellst du ein 3D-Modell](/de/ratgeber/3d-modell-erstellen)

## Häufige Fragen

### Welcher MCP erzeugt das Modell?

In diesem Ablauf erstellt easyrender das Modell aus dem Produktfoto. Der Blender-Connector hilft dir nach dem Import dabei, die Szene zu bearbeiten. Manche Connectors greifen auch auf externe 3D-Generatoren zu. Prüfe vor dem Start, welche Werkzeuge verfügbar sind und welche Anbieter eigene Zugangsdaten benötigen.

### Kann ich es mit einer vorhandenen GLB-Datei testen?

Ja. Importiere eine bekannte GLB-Datei mit dem glTF-Importer von Blender in eine Testszene. Prüfe die Materialien sowie die Ausrichtung und Abmessungen des Objekts im Ansichtsfenster. Lass Claude anschließend die Objekte in der Szene auflisten, damit du das richtige Modell eindeutig zuordnen kannst.

### Sollte ich beim ersten Durchlauf die Originalszene bearbeiten?

Arbeite in einer Projektkopie mit einem eindeutig benannten Modell. Bitte Claude um eine einzelne Änderung, etwa darum, das Produkt mit der aktiven Kamera einzurahmen. Prüfe danach das Mesh, die Materialien und die Kameraposition und speichere das Ergebnis unter einem neuen Dateinamen.
