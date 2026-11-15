---

group: usdz-file
title: "Was ist eine USDZ-Datei? AR Quick Look am iPhone erklärt"
description: "Eine USDZ-Datei ist das 3D-Format, das iPhone und iPad in AR öffnen: was drin steckt, wie du sie öffnest und erstellst, warum sie falsch groß wirken kann."
date: 2026-11-17
updated: 2026-11-15
author: Jorge Rodríguez
authorType: person
keyword: usdz datei
cta: Nimm ein scharfes Foto eines einzelnen Stücks, etwa eines Beistelltischs aus Eiche oder einer Stehlampe, und prüf jeden Blickwinkel, bevor du einen Credit ausgibst.
---

Eine USDZ-Datei ist ein 3D-Modell im Format Universal Scene Description (USD) von Pixar, verpackt in einem unkomprimierten ZIP-Archiv. Apple nutzt sie für AR Quick Look: iPhone und iPad öffnen eine USDZ aus Safari, Dateien, Mail oder Nachrichten und stellen das Objekt über die Kamera in den Raum. Android öffnet USDZ nicht.

![Illustration einer leuchtenden Pilz-Tischlampe neben einem flach liegenden Handy, die linke Hälfte der Lampe warm beleuchtet, die rechte aus mattgrauem Ton mit weißem Drahtgitter, vor dunklem Hintergrund](/blog/illustrations/usdz-file/hero.webp "Illustration, kein Ergebnis von easyrender: eine Lampe, halb beleuchtet, halb als Ton- und Drahtgittermodell gezeichnet, neben einem Handy.")

## Was steckt in einer USDZ-Datei?

USD ist das Szenenformat, das Pixar für die Filmproduktion entwickelt hat. Die [USDZ-Spezifikation](https://openusd.org/release/spec_usdz.html) beschreibt ein ZIP-Archiv ohne Komprimierung, das USD-Ebenen und die verwendeten Bilder enthält. Jede Datei darin beginnt an einem Vielfachen von 64 Byte, damit ein Gerät sie direkt lesen kann, ohne etwas zu entpacken.

![Eine USDZ-Datei als ZIP-Archiv ohne Komprimierung, mit einer USD-Ebene für Mesh und Materialien und den Texturbildern, auf die sie verweist](diagram:usdz-anatomy "Was die USDZ-Spezifikation beschreibt. Weil das Archiv unkomprimiert ist, liest ein iPhone jeden Teil direkt daraus.")

USD-Ebenen gibt es in zwei Kodierungen: .usda ist lesbarer Text, .usdc ist binär. Texturen sind meist PNG oder JPEG. Was eine USDZ enthält, entscheidet das Werkzeug, das sie schreibt, und diese Wahl bestimmt den Großteil der Dateigröße.

Apple hat [USDZ mit ARKit 2 vorgestellt](https://www.apple.com/de/newsroom/2018/06/apple-unveils-arkit-2/), auf der WWDC im Juni 2018 für iOS 12, zusammen mit AR Quick Look. Seitdem ist es das Format, das Apple-Geräte für AR aus einer Webseite oder einer Nachricht erwarten.

## Was bestimmt die Größe einer USDZ-Datei?

Zwei Entscheidungen des Werkzeugs, das sie schreibt. Geometrie als Text in .usda braucht ein Vielfaches der Bytes desselben Meshs im binären .usdc, weil jede Zahl in Ziffern ausgeschrieben wird. Der zweite Faktor sind die Texturen: Ein verlustfreies PNG einer fotoähnlichen Textur ist meist um ein Vielfaches größer als ein JPEG desselben Bildes.

Die Bildtypen in der Spezifikation umfassen PNG und JPEG, aber kein WebP. Eine GLB mit WebP-Texturen bekommt ihre Bilder also auf dem Weg zur USDZ umgewandelt, und das Zielformat des Konverters entscheidet, wie stark sie wachsen.

| Einstellung im Exporter | Kleinere Datei                                     | Größere Datei                     |
| ----------------------- | -------------------------------------------------- | --------------------------------- |
| Geometrie               | Binär, .usdc                                       | Text, .usda                       |
| Texturformat            | JPEG, außer das Modell braucht Transparenz         | PNG                               |
| Texturgröße             | 1024 oder 2048 Pixel                               | 4096 Pixel                        |
| Mesh                    | Vereinfacht auf das, was ein Handybildschirm zeigt | Jedes Dreieck eines dichten Scans |

Nichts davon ist ein Fehler, denn Quick Look liest beide Kodierungen und beide Bildformate. Die Größe zählt trotzdem, weil eine Datei mit mehreren Megabyte langsamer per Nachricht verschickt wird und über mobile Daten langsamer lädt.

## Wie prüfst du, was in einer USDZ steckt?

Eine USDZ ist ein ZIP-Archiv, also listet `unzip -l beistelltisch.usdz` jede enthaltene Datei mit ihrer Größe auf. Du siehst sofort, ob die Geometrie .usda oder .usdc ist und ob die Texturen PNG oder JPEG sind. Weil die Spezifikation keine Komprimierung erlaubt, sind die angezeigten Größen die echten.

Entpack dann eine Kopie und öffne die Hauptebene (.usda) in einem Texteditor. `metersPerUnit` und `upAxis` geben an, wie groß das Modell erscheint und wo oben ist. Eine Verankerungszeile legt fest, ob Quick Look es auf eine waagerechte Fläche wie den Boden stellt oder an eine senkrechte wie die Wand.

Was du von einem Exporter verlangen solltest: binäre .usdc-Geometrie, JPEG-Texturen, außer das Modell braucht Transparenz, und Texturen bis 2048 Pixel. Vergleich das Ergebnis mit der Größe der GLB und öffne es in Quick Look auf einem Mac, bevor es auf eine Seite kommt.

## USDZ-Viewer: Wie öffnest du eine USDZ-Datei?

Das hängt vom Gerät ab:

- iPhone und iPad: Tipp die Datei in Safari, Dateien, Mail oder Nachrichten an. Quick Look öffnet sie mit einer Objektansicht und einer AR-Ansicht.
- Mac: Markier sie im Finder und drück die Leertaste für eine Quick-Look-Vorschau.
- Windows und Android: Es gibt keinen eingebauten Viewer. [Blender ab Version 3.5](https://developer.blender.org/docs/release_notes/3.5/pipeline_assets_io/) importiert USDZ, dort kannst du sie öffnen.

[Apples Seite zu Quick Look](https://developer.apple.com/augmented-reality/quick-look/) nennt Safari, Nachrichten, Mail, News und Notizen unter den Apps, die USDZ öffnen, ab iOS 12 und iPadOS 12. Brauchst du dasselbe Modell auf Android oder im Browser, nimm seine GLB-Version. Diese Seite erklärt [Was ist eine GLB-Datei?](/de/ratgeber/glb-datei).

<!-- IMAGE PENDING: a real iPhone screenshot of an easyrender USDZ (for example the bouclé armchair) open in Quick Look's Object view, unretouched. Not the AR view until AR is tested on device (REQ-00). -->

## Wie funktioniert AR Quick Look auf einer Webseite?

Eine Seite verlinkt die USDZ mit `rel="ar"` um ein Vorschaubild, und Safari setzt ein kleines AR-Symbol auf dieses Bild. Die [Anleitung von WebKit](https://webkit.org/blog/8421/viewing-augmented-reality-assets-in-safari-for-ios/) zeigt das Markup. Ein Tipp auf das Bild öffnet das Modell im Raum, ohne App-Installation.

Für die Einrichtung sind vier Details entscheidend:

1. Die USDZ über HTTPS ausliefern, mit dem Content-Type `model/vnd.usdz+zip`, nach dem Safari sucht.
2. Ein Vorschaubild in einen Link auf die Datei packen: `<a rel="ar" href="beistelltisch.usdz"><img src="beistelltisch.jpg"></a>`.
3. Dem Link genau ein Kindelement geben, ein `img` oder ein `picture`, sonst nichts.
4. Die Unterstützung per Skript mit `a.relList.supports("ar")` prüfen und bei `false` einen normalen Download-Link anzeigen.

Googles quelloffene Komponente [model-viewer](https://modelviewer.dev/) unterstützt beide Systeme mit einem Codeausschnitt: Sie zeigt eine GLB auf der Seite und gibt iPhones eine USDZ für Quick Look.

![Zwei Wege in AR Quick Look am iPhone: eine Safari-Seite mit Vorschaubild samt AR-Symbol oder eine USDZ-Datei, angetippt in Nachrichten, Mail oder Dateien. Beide öffnen die Objektansicht und die AR-Ansicht](diagram:quick-look-path "Beide Wege enden in denselben zwei Ansichten. Ein Modell aus einem Foto liefert keine verlässlichen Abmessungen des echten Produkts.")

Die Darstellung in AR Quick Look ist kein Beleg für die tatsächlichen Abmessungen des Produkts. Gerade ein Modell aus einem Foto kann größer oder kleiner wirken als das echte Stück. Außerdem lässt sich die Darstellung mit zwei Fingern verändern.

## Wie erstellst du eine USDZ-Datei?

Es gibt vier gängige Wege. Sie unterscheiden sich darin, wo sie laufen und was sie gut können.

| Werkzeug                   | Läuft auf           | Gut für                                                                   | Achte auf                                        |
| -------------------------- | ------------------- | ------------------------------------------------------------------------- | ------------------------------------------------ |
| Apple Reality Converter    | Mac                 | Materialien vor dem Export prüfen                                         | Nur Mac                                          |
| Blender ab 3.5             | Mac, Windows, Linux | Das Modell vor dem Export bearbeiten                                      | Manche Blender-Materialien wirken in USD flacher |
| USDZ-Exporter von three.js | Jeder Browser       | Kein Server, und die USDZ stimmt immer mit ihrer GLB überein              | Größe und Materialien in Quick Look prüfen       |
| Shopify                    | Dein Shop-Admin     | Wandelt jedes hochgeladene Modell um, sodass GLB und USDZ beide vorliegen | Shopify bestimmt das Ergebnis, nicht du          |

Reality Converter [wandelt Dateien wie OBJ, glTF, FBX und USD](https://developer.apple.com/videos/play/wwdc2022/10141/) in USDZ um. In Blender gehst du auf Datei, Exportieren, Universal Scene Description und gibst der Datei die Endung .usdz.

Unser Fazit: Bearbeitest du Modelle, exportier aus Blender und prüf das Ergebnis in Quick Look auf einem Mac. Verkaufst du über Shopify, lad die GLB hoch und lass Shopify die USDZ erzeugen. Baust du deine eigene Website, kann ein Export im Browser auf derselben Quelldatei aufbauen. Vergleiche die Dateigröße der USDZ mit der GLB.

Startest du mit einem Foto, exportieren manche Bild-zu-3D-Werkzeuge die USDZ gleich neben der GLB, dann sparst du dir die Umwandlung. Die Schritte stehen in [3D-Modell aus Fotos erstellen](/de/ratgeber/3d-modell-aus-fotos-erstellen).

easyrender liefert zu jedem fertigen Modell beide Dateien. AR kommt bald, dann kannst du das Stück am Handy öffnen und in deinem Raum sehen. Schreib die am echten Produkt gemessenen Maße in den Produkttext. Ein Modell aus einem Foto liefert keine verlässlichen Abmessungen.

## Ein Beispiel: ein Beistelltisch aus Eiche am iPhone

Schick dir die USDZ eines Beistelltischs aus Eiche per Nachrichten und tipp sie an. Quick Look öffnet zuerst die Objektansicht, in der du ihn mit einem Finger drehst. Wechsel zu AR, richte die Kamera auf den Boden, und der Tisch erscheint an der Stelle, die du antippst.

Geh um ihn herum und schau dir an, wo die Beine den Boden berühren. Ein Modell, dessen Fuß leicht versetzt sitzt, scheint zu schweben.

![Ein runder Massivholztisch als 3D-Modell in einem Viewer, der sich drehen lässt, um die Beine von allen Seiten zu prüfen](/showcase/coffee-table.glb "Ein runder Massivholztisch, den easyrender aus einem Foto modelliert hat, hier aus seiner GLB: 16.228 Dreiecke. Seine USDZ entsteht aus derselben GLB, deshalb stimmen beide immer überein. Dreh ihn und schau, wo die Beine den Boden berühren.")

Prüf dann die Maserung unter deiner eigenen Lampe, die wärmer ist als das Studiolicht im Originalfoto.

## Was geht bei einer USDZ schief, und wie behebst du es?

Die meisten USDZ-Probleme liegen daran, wie die Datei ausgeliefert wird oder was der Konverter geschrieben hat. Diese Liste führt dich vom Symptom zur Änderung.

| Symptom                                                           | Ursache                                                                              | Lösung                                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Ein Tipp auf den Link lädt die Datei herunter, statt AR zu öffnen | Dem Link fehlt `rel="ar"`, oder die Datei hat den falschen Content-Type              | `rel="ar"` ergänzen und die Datei als `model/vnd.usdz+zip` ausliefern                      |
| Kein AR-Symbol auf dem Vorschaubild                               | Der Link hat mehr als ein Kindelement, oder auf dem Gerät läuft ein iOS älter als 12 | Dem Link ein einziges `img` oder `picture` geben und auf einem aktuellen iPhone testen     |
| Das Stück wirkt riesig oder winzig                                | Ein Modell aus einem Foto liefert keine verlässlichen Abmessungen                    | Die Maße in den Produkttext schreiben, Kunden können das Modell mit zwei Fingern skalieren |
| Das Stück schwebt über dem Boden                                  | Der Fuß des Modells liegt über seinem Ursprung                                       | Den Ursprung in Blender an den Fuß setzen und neu exportieren                              |
| Die Farben wirken flacher als in Blender                          | Ein Material-Aufbau, der sich nicht in USD übersetzen lässt                          | In Quick Look auf einem Mac prüfen und das Material vereinfachen                           |
| Rundungen wirken kantig                                           | Die Quell-GLB hatte keine Normalen                                                   | Der GLB vor der Umwandlung weiche Normalen geben                                           |
| Die Datei ist zu groß zum Verschicken                             | Geometrie als Text, Texturen als PNG                                                 | Mit binärer Geometrie und JPEG-Texturen exportieren und die Größen vergleichen             |

## GLB in USDZ: Solltest du beide behalten?

Ja, beide, wenn das Modell auf eine Produktseite kommt. GLB deckt Web und Android ab, USDZ deckt AR auf Apple-Geräten ab. Shopify zum Beispiel nimmt beide als Produktmedien an und erzeugt das fehlende Format selbst.

Woher beide Dateien kommen, egal mit welcher Methode, erklärt [3D-Modell erstellen](/de/ratgeber/3d-modell-erstellen). Für einen Shop zeigt [3D-Modell für den Onlineshop](/de/ratgeber/3d-modelle-fuer-onlineshops), bei welchen Produkten es sich lohnt.

## FAQ

### Kann man eine USDZ-Datei auf Android öffnen?

Nicht direkt, denn AR auf Android läuft über Googles Scene Viewer, und der liest glTF- und GLB-Dateien, keine USDZ. Um dasselbe Modell auf Android zu zeigen, nimm eine GLB-Version davon. Hast du nur die Apple-Datei, kann Blender ab 3.5 die USDZ importieren und als GLB exportieren. Die Materialien solltest du danach prüfen.

### Kann man eine USDZ in eine GLB umwandeln?

Ja. Importier die USDZ in Blender ab 3.5 und exportier sie als glTF 2.0 im binären GLB-Format. Prüf das Ergebnis in einem Viewer, denn USD und glTF beschreiben Oberflächen unterschiedlich. Manche Materialeinstellungen, etwa eine Klarlackschicht auf lackiertem Holz, werden zwischen den beiden Formaten nicht genau übernommen.

### Warum wirkt ein USDZ-Modell in AR falsch groß?

Ein Modell aus einem Foto oder ein Scan ohne Referenz kann in AR größer oder kleiner wirken als das echte Stück. Nutz AR, um dir das Aussehen des Stücks im Raum anzusehen. Für die Abmessungen zählen die am Produkt gemessenen Angaben im Produkttext.

### Warum ist eine USDZ größer als die GLB, aus der sie stammt?

Das liegt meist an den Export-Einstellungen des Konverters. Geometrie als Text braucht ein Vielfaches der Bytes der binären Form, und USDZ führt WebP nicht unter seinen Bildtypen, also wird eine kleine WebP-Textur umgewandelt, oft in ein viel größeres PNG. Mit binärer .usdc-Geometrie und JPEG-Texturen sinkt die Größe wieder.

### Ist USDZ dasselbe wie USD?

USDZ ist ein Paket aus USD. Eine USD-Szene kann eine Textdatei (.usda) sein, eine Binärdatei (.usdc) oder mehrere Dateien, die aufeinander verweisen. USDZ packt diese Ebenen und ihre Texturen in eine einzige unkomprimierte Datei. Deshalb lässt sie sich leicht per Nachricht verschicken und auf dem iPhone öffnen.
