---

group: how-to-make-a-3d-model
title: "3D-Modell erstellen: fünf Wege, mit oder ohne Vorwissen"
description: "3D-Modell erstellen auf fünf Wegen, von Blender bis zum einzelnen Foto: was jede Methode braucht, wie lange sie dauert, wo sie scheitert, wie du wählst."
date: 2026-11-16
updated: 2026-11-15
author: Jorge Rodríguez
authorType: person
keyword: 3d modell erstellen
cta: Hast du ein scharfes Foto eines Stuhls, einer Lampe oder eines Sideboards, siehst du es von allen Seiten, bevor du entscheidest, ob sich ein Modell lohnt.
---

Ein 3D-Modell erstellen kannst du auf fünf Wegen: selbst in Software wie Blender bauen, das Objekt per Photogrammetrie scannen, es mit dem LiDAR-Sensor eines Handys scannen, es mit KI aus einem Foto erzeugen oder einen 3D-Artist beauftragen. Was passt, hängt davon ab, ob das Objekt existiert, ob du es vor dir hast und wie viel Zeit du hast.

![Illustration eines Springers aus Nussbaum, Kopf und Vorderseite aus echtem geschnitztem Holz, die Rückseite aus mattgrauem Ton mit weißem Drahtgitter, vor dunklem Hintergrund](/blog/illustrations/how-to-make-a-3d-model/hero.webp "Illustration, kein Ergebnis von easyrender: ein Schachspringer, halb als Nussbaum, halb als Ton- und Drahtgittermodell gezeichnet.")

## Welche Methode solltest du wählen?

Gibt es das Objekt noch nicht, modellierst du es in Software oder beauftragst einen Artist. Existiert es bereits und steht es vor dir, scannst du es. Hast du nur ein Foto davon, nimmst du Bild-zu-3D.

![Entscheidungsbaum: Gibt es das Objekt noch nicht, in Software modellieren oder einen Artist beauftragen. Existiert es bereits, aber du hast nur ein Foto, KI-Bild-zu-3D. Steht es vor dir, LiDAR für große, einfache Formen und Photogrammetrie für detailreiche Oberflächen](diagram:method-decision-tree "Die drei Fragen hinter der Tabelle unten. Ein 3D-Artist ist außerdem immer dann die Antwort, wenn das Modell exakt sein muss.")

Die Genauigkeit folgt grob dem Aufwand. Ein Artist, der nach Maßen arbeitet, liefert das exakteste Modell. Ein Modell aus einem Foto erfordert weniger eigene Arbeit, und die Seiten, die das Foto nicht gezeigt hat, werden aus diesem Bild abgeleitet.

| Methode                 | Was du brauchst                                  | Deine eigene Zeit                                               | Am besten für                                                  | Achte auf                                                              |
| ----------------------- | ------------------------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| In Software modellieren | Wochen Übung, Referenzfotos, Maße                | Einen Tag oder mehr pro Stück, wenn du die Software beherrschst | Objekte, die es noch nicht gibt                                | Proportionen, Texturen und UV-Mapping                                  |
| Photogrammetrie         | Das Objekt vor Ort, 20 bis über 100 Fotos        | Ein, zwei Stunden Aufnahme plus Verarbeitung                    | Echte Oberflächendetails                                       | Schlichte weiße Flächen, Glas, poliertes Metall                        |
| LiDAR am Handy          | Ein iPhone Pro oder iPad Pro, das Objekt vor Ort | Um das Objekt herumgehen und den Scan prüfen                    | Große, einfache Formen wie ein Sofa                            | Weniger Detail: gedrechselte Beine, geflochtene Sitze                  |
| KI aus einem Foto       | Ein scharfes Foto                                | Vorschau und Modell prüfen                                      | Ein Lieferantenfoto eines Stücks, das du nicht anfassen kannst | Das Foto zeigt nur eine Seite, und die Datei hat keine gemessene Größe |
| 3D-Artist beauftragen   | Fotos, Maße und ein Budget                       | Briefing schreiben und Entwürfe prüfen                          | Exakte Modelle oder ein Modell in mehreren Größen              | Zeit für Briefing und Auftrag                                          |

Für den 3D-Druck gelten andere Anforderungen. In diesem Ratgeber geht es um Modelle für Bildschirme, Produktseiten und AR. Ein Teil, das du drucken willst, braucht ein CAD-Modell nach echten Maßen, und das ist eine andere Aufgabe.

Unabhängig von der Methode gelten dieselben technischen Anforderungen. Für eine Produktseite oder AR am Handy empfiehlt Googles [Scene Viewer](https://developers.google.com/ar/develop/scene-viewer) höchstens 100.000 Dreiecke, ideal 30.000 bis 50.000, Texturen bis 2048 Pixel und eine Datei mit höchstens 10 MB.

## Methode 1: Selbst in Software modellieren

Blender ist kostenlos, quelloffen und exportiert GLB, FBX, OBJ und USD. SketchUp ist für Möbel und Gebäude zugänglicher, weil du [flache Formen zu Körpern ziehst](https://help.sketchup.com/de/sketchup/pushing-and-pulling-shapes-3d). [Tinkercad](https://www.tinkercad.com/help-center/what-is-tinkercad), eine kostenlose App im Browser, ist der einfachste Einstieg in Grundformen.

Rechne mit Wochen Übung, bevor ein selbst modellierter Stuhl stimmig aussieht. Für Einsteiger sind Proportionen und Texturen der schwierige Teil. Eine häufige Hürde ist das UV-Mapping: Dabei wird die Oberfläche flach abgewickelt, damit sich eine Bildtextur darauf zuordnen lässt.

Für ein einfaches Stück wie einen Beistelltisch sieht der Ablauf so aus:

1. Referenzen sammeln: ein Foto von vorn, eines von der Seite und die echten Maße.
2. Die Hauptformen mit Quadern und Zylindern anlegen: Platte, Beine, Zarge.
3. Die Kanten leicht brechen, damit Ecken das Licht fangen wie echtes Holz.
4. Die UVs abwickeln, dann Materialien zuweisen: eine Holztextur auf die Platte, eine Metalloberfläche an eventuelle Griffe.
5. Maßstab und Drehung des Objekts anwenden, damit die exportierte Datei die modellierte Größe behält.
6. Von allen Seiten prüfen, auch von unten, und dann als GLB exportieren.

![Ein Beistelltisch in drei Stufen modelliert: grobe Quader und Zylinder für Platte und Beine, dieselben Formen mit gebrochenen Kanten, dann mit Holztextur vor dem Export](diagram:blockout-side-table "Die Schritte 2 bis 6 an einem einfachen Tisch. Für diesen Ratgeber gezeichnet.")

Zwei Einstellungen helfen bei typischen Anfängerfehlern. In Blender verhindert Objekt, Anwenden, Alle Transformationen vor dem Export, dass ein Tisch im Viewer gedreht oder in falscher Größe ankommt. Und eine Schachbretttextur auf dem Modell, vor der echten, zeigt sofort, wo eine UV-Abwicklung verzerrt.

## Methode 2: Photogrammetrie

Die Photogrammetrie baut ein Modell aus vielen überlappenden Fotos. Die [Anleitung von Polycam](https://learn.poly.cam/hc/en-us/articles/27425185907348-How-to-Use-Object-Mode) verlangt mindestens 20, mit etwa 70 % Überlappung zwischen den Aufnahmen, in Ringen auf verschiedenen Höhen und bei weichem, gleichmäßigem Licht. Detailreiche Objekte brauchen 100 oder mehr.

![Eine Stehlampe, umringt von Kamerapositionen auf drei Höhen, unten, mittig und oben mit Blick nach unten, dazu zwei benachbarte Aufnahmen, deren Bildausschnitte sich überlappen](diagram:photogrammetry-rings "So wird für die Photogrammetrie fotografiert: Ringe auf mehreren Höhen, jedes Foto teilt etwa 70 % seines Ausschnitts mit dem nächsten, wie es die Anleitung von Polycam verlangt.")

Eine Aufnahme, die funktioniert, folgt jedes Mal denselben Regeln:

1. Weiches, gleichmäßiges Licht: draußen ein bedeckter Tag oder ein Raum ohne direkte Sonne.
2. Die Belichtung am Handy sperren, damit sich die Helligkeit zwischen den Aufnahmen nicht ändert.
3. Einen tiefen, einen mittleren und einen hohen Ring mit Blick nach unten fotografieren, Schritt für Schritt.
4. Das Objekt groß im Bild halten: [RealityScan](https://dev.epicgames.com/documentation/realityscan-mobile/realityscan-step-by-step-guide) will, dass es mindestens die Hälfte jedes Bildes füllt.
5. Das Objekt während einer Session nie bewegen. Beweg dich selbst.

RealityScan beginnt nach 20 Bildern mit der Verarbeitung und verarbeitet bis zu 300 Bilder. Die wichtigste Grenze nennt die Anleitung klar: Was nicht auf mehreren Bildern zu sehen ist, taucht im Modell nicht auf.

RealityScan und Polycam erledigen das am Handy, das quelloffene [Meshroom](https://alicevision.org/) am Rechner. Echte Oberflächendetails hält das Verfahren gut fest. Schlichte weiße Flächen, Glas und poliertes Metall sind dabei schwierig, weil es sichtbare Struktur braucht, um ein Foto dem nächsten zuzuordnen.

Wann sich dieser Aufwand lohnt, zeigt [Photogrammetrie-Software oder KI mit einem Foto](/de/vergleich/vergleich-photogrammetrie-software).

## Methode 3: LiDAR-Scan mit dem Handy

Pro-iPhones ab dem iPhone 12 Pro und aktuelle iPad-Pro-Modelle haben einen [LiDAR-Sensor](https://www.apple.com/de/newsroom/2020/03/apple-unveils-new-ipad-pro-with-lidar-scanner-and-trackpad-support-in-ipados/), der Tiefe direkt misst. Apps wie Polycam nutzen ihn, um ein Modell zu bauen, während du um das Objekt herumgehst.

LiDAR ist schnell und kommt mit großen, einfachen Formen wie einem Sofa gut zurecht. Es erfasst weniger Details als die Photogrammetrie, deshalb werden gedrechselte Beine und geflochtene Sitze klumpig.

Geh langsam, mit gleichbleibendem Abstand, und sorg für gutes Licht im Raum: Die Tiefe kommt vom Sensor, die Farben kommen von der Kamera. Ein Sofa an der Wand musst du zuerst vorziehen, sonst fehlt seine Rückseite einfach.

## Methode 4: Mit KI erzeugen

KI-Werkzeuge erzeugen ein Modell aus einem Foto, das heißt Bild-zu-3D, oder aus einer Textbeschreibung, das heißt Text-zu-3D. Bild-zu-3D orientiert sich am Aussehen eines echten Produkts. Text-zu-3D erzeugt einen Entwurf, der sich nicht als Abbild eines konkreten Verkaufsartikels eignet.

Das Grundprinzip ist bei diesen Werkzeugen ähnlich: ein scharfes Foto des ganzen Objekts vor schlichtem Hintergrund, dann die Prüfung der verdeckten Seiten, bevor du das Ergebnis behältst. Jeder Schritt steht in [3D-Modell aus Fotos erstellen](/de/ratgeber/3d-modell-aus-fotos-erstellen).

![Eine matte Steinzeugvase auf ihrem Katalogfoto, frontal vor weißem Hintergrund](/showcase/vase.jpg "Das eine Foto.")
![Das 3D-Modell, das easyrender aus diesem Foto gebaut hat, eine helle Steinzeugvase in einem Viewer, die sich drehen lässt](/showcase/vase.glb "Das Modell, das easyrender daraus gebaut hat, über ein kostenloses Ansichtsblatt, Texturen für diese Seite komprimiert: 16.708 Dreiecke. Dreh es und prüf die Rückseite, die das Foto nie gezeigt hat.")

easyrender ist eines dieser Werkzeuge. Es zeichnet zuerst kostenlos ein Blatt mit neun Ansichten, acht rund um das Objekt in 45-Grad-Schritten und eine von oben, und baut dann aus diesen Ansichten das Modell. Ein fertiges Modell kostet {{renderCredits}} Credits ({{renderPrice}}). [Foto hochladen](/de)

Es modelliert ein Objekt nach dem anderen, etwa Möbel, Deko und Gebäudefassaden. Meshy und Tripo machen aus Bildern ebenfalls 3D-Modelle und bieten dazu Text-zu-3D, jeweils mit eigenen Preisen. Genauer vorgestellt werden sie in [Alternative zu Meshy AI](/de/vergleich/vergleich-meshy) und [Alternative zu Tripo AI](/de/vergleich/vergleich-tripo).

Um Werkzeuge zu vergleichen, schick dasselbe Foto durch zwei davon und beurteile fünf Dinge nebeneinander:

1. Rückseite und Unterseite: plausibel oder offensichtlich erfunden?
2. Die Anzahl der Beine, Türen, Schubladen und Griffe.
3. Die Textur im Vollbild.
4. Die Datei: Dreiecke und Größe im Vergleich zum Budget oben.
5. Die Kosten pro fertigem Modell und ob du vor dem Bezahlen eine Vorschau siehst.

## Methode 5: Einen 3D-Artist beauftragen

Ein Artist modelliert das Objekt nach deinen Fotos und Maßen. Das ist die richtige Wahl, wenn das Modell exakt sein muss, etwa bei einem Sofa in drei Breiten, oder wenn du ein ausgefeiltes Modell für eine Werbekampagne brauchst.

Ein gutes Briefing erspart das meiste Hin und Her. Das gehört hinein:

- Fotos von allen Seiten, dazu Nahaufnahmen jedes Materials und jeder Oberfläche.
- Die Maße, mit dem Maßband genommen.
- Die Formate: GLB und USDZ für eine Produktseite.
- Das Budget: 30.000 bis 50.000 Dreiecke, Texturen bis 2048 Pixel und so wenige Materialien, wie das Stück zulässt.
- Die Quelldatei, etwa die .blend, damit du später Änderungen machen kannst.

Auf Freelance-Plattformen wie Fiverr und Upwork findest du Modellierer für Produkte. Lass dir ein Probemodell oder ein früheres Modell aus derselben Kategorie zeigen, bevor du einen ganzen Katalog vergibst. Kosten, Zeit und wann du beauftragst statt mit einem Foto zu starten, stehen in [3D-Modellierer oder KI](/de/vergleich/vergleich-3d-modellierer-oder-ki).

## Was kostet ein 3D-Modell?

Kostenlose Software kostet Zeit. Ein Artist macht pro Modell ein Angebot, je nach Komplexität. Scan-Apps und KI-Werkzeuge rechnen pro Modell oder per Abo ab, oft nach einem kostenlosen Kontingent oder einer kostenlosen Vorschau.

Bei easyrender kostet ein Credit {{creditPrice}}, du kaufst nach Bedarf ab {{paygMinCredits}} Credits. Das Pro-Abo kostet {{proPrice}} im Monat für {{proCredits}} Credits, und Credits verfallen nicht.

## Wie prüfst du ein fertiges Modell?

Egal welche Methode: Öffne das Modell in einem Viewer und schau darunter und dahinter, wo sich Fehler verstecken. Geh dann jedes Mal dieselbe kurze Liste durch:

1. Dreh es langsam im Vollbild und halt an Rückseite und Unterseite an.
2. Zähl die Teile und vergleich sie mit dem echten Stück.
3. Vergrößere die Texturen, denn ein Stoff, der als Vorschaubild gut aussieht, kann aus der Nähe unscharf sein.
4. Lies Dreieckszahl und Dateigröße ab und vergleich sie mit dem Budget oben.
5. Öffne es am Handy über mobile Daten und probier AR auf einem iPhone und einem Android-Handy aus.

Für Produktseiten brauchst du meist zwei Dateien: GLB für Web und Android, USDZ für AR auf Apple-Geräten. [Was ist eine GLB-Datei?](/de/ratgeber/glb-datei) erklärt Öffnen, Prüfen und Komprimieren, [Was ist eine USDZ-Datei?](/de/ratgeber/usdz-datei) die Apple-Seite.

## Ein Beispiel: eine Stehlampe, drei Wege

Nimm eine Stehlampe mit Leinenschirm und Messingschaft. In Blender legt ein Einsteiger Schaft und Schirm an einem Nachmittag grob an. Bis das Leinen wie Leinen aussieht, dauert es deutlich länger.

Der Photogrammetrie macht das polierte Messing zu schaffen, weil es den Raum spiegelt und die Zuordnung durcheinanderbringt. Profis mattieren glänzende Teile mit einem abwaschbaren Mattierungsspray, was du bei Verkaufsware nicht machen würdest.

Bild-zu-3D trifft aus einem sauberen Katalogfoto die Gesamtform und die Farbe des Schirms. Prüfen solltest du den dünnen Schaft, denn schlanke Teile kommen manchmal gebogen oder dicker heraus, als sie sind.

Unser Fazit für diese Lampe: Bild-zu-3D, wenn du nur das Lieferantenfoto hast, Photogrammetrie mit maskiertem Messing, wenn sie in deinem Lager steht, und ein Artist, wenn deine ganze Kampagne auf dieser Lampe aufbaut.

## Was geht bei welcher Methode schief?

Jede Methode scheitert auf ihre eigene Art, und jeder Fehler hat eine typische Ursache. Mit dieser Liste prüfst du ein schlechtes Ergebnis.

| Methode           | Was du siehst                                            | Ursache                                                     | Lösung                                                                                |
| ----------------- | -------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Software          | Das Modell kommt gedreht oder in falscher Größe an       | Maßstab und Drehung des Objekts wurden nie angewendet       | Alle Transformationen anwenden und neu exportieren                                    |
| Software          | Die Holzmaserung zieht sich verzerrt über eine Fläche    | Eine schlechte UV-Abwicklung                                | Mit einer Schachbretttextur prüfen und diese Fläche neu abwickeln                     |
| Photogrammetrie   | Löcher in einer schlichten weißen Tischplatte            | Nichts, was die Software zwischen den Fotos abgleichen kann | An einem bedeckten Tag fotografieren oder für dieses Stück eine andere Methode wählen |
| Photogrammetrie   | Die Unterseite fehlt oder ist mit dem Boden verschmolzen | Die Unterseite wurde nie fotografiert                       | Hinnehmen oder eine zweite Aufnahmeserie mit dem Stück auf der Seite machen           |
| LiDAR             | Dünne Beine sind klumpig oder fehlen                     | Die Teile sind feiner, als der Sensor auflöst               | Für dieses Stück Photogrammetrie nehmen                                               |
| KI aus einem Foto | Die Rückseite passt nicht zum Stück                      | Das Foto hat diese Seite nie gezeigt                        | Ein Foto schräg von vorn nehmen oder eine Notiz zur Rückseite ergänzen                |
| KI aus einem Foto | Ein Logo oder Etikett ist verschwommen                   | Feine Details aus einem Foto                                | Das Logo in deinen Fotos zeigen, nicht im Modell                                      |
| Artist            | Das Modell kommt zu spät oder falsch                     | Ein Briefing ohne Maße, Formate oder Budget                 | Fotos, Maße, Formate und ein Dreiecksbudget vorab schicken                            |

## Wo liegen die Grenzen jeder Methode?

Modelle aus einem Foto haben keine gemessene Größe. Scans lassen aus, was die Kamera nicht sehen konnte, etwa die Unterseite eines Sofas, das flach auf dem Boden steht. Wer selbst modelliert, muss die Software lernen. Bei einem Auftrag an einen 3D-Artist musst du Zeit für Briefing und Abstimmung einplanen.

Alle fünf Methoden erzeugen ein Objekt nach dem anderen. Ein komplett eingerichteter Raum ist eine andere Aufgabe als ein einzelner Stuhl. Für den Verkauf von Möbeln und Deko vergleicht [3D-Modell für den Onlineshop](/de/ratgeber/3d-modelle-fuer-onlineshops) die Wege für einen Katalog, und [Vintage-Möbel verkaufen](/de/ratgeber/vintage-moebel-verkaufen) behandelt Einzelstücke.

## FAQ

### Muss man Blender lernen, um ein 3D-Modell zu erstellen?

Nein, Scan-Apps und Bild-zu-3D erzeugen ein Modell ganz ohne Modellieren. Ein gutes Auge brauchst du trotzdem, denn die Prüfung von Rückseite, Texturen und dünnen Teilen trennt ein brauchbares Modell von einem seltsamen. Blender zu lernen lohnt sich, wenn du oft exakte, bearbeitbare Modelle von Dingen brauchst, die es noch nicht gibt.

### Wie lange dauert es, ein 3D-Modell zu erstellen?

Das hängt mehr von der Methode ab als vom Objekt: Bild-zu-3D und Handyscans erfordern meist den geringsten eigenen Zeitaufwand, die Photogrammetrie ein, zwei Stunden Aufnahme plus Verarbeitung. Einen Stuhl in Blender zu modellieren, kann einen Tag dauern, wenn du die Software nach Wochen des Lernens beherrschst. Artists nennen ihre eigene Lieferzeit.

### Kann man aus einem Foto ein 3D-Modell erstellen?

Ja, mit einem Bild-zu-3D-Werkzeug, das von einem Foto ausgeht. Die Seiten, die die Kamera nicht gesehen hat, werden aus diesem Bild abgeleitet. Prüf Rückseite und feine Details in der Vorschau, vor allem dort, wo das Foto sie nicht gezeigt hat. Am besten funktioniert ein scharfes Foto eines Objekts, schräg von vorn, vor schlichtem Hintergrund.

### Ist das dasselbe wie ein Modell für den 3D-Druck?

Nein. Modelle für Bildschirm und AR müssen richtig aussehen, Modelle für den Druck brauchen exakte Maße und eine geschlossene, druckbare Form. Bild-zu-3D und die meisten Scans liefern Modelle für die Bildschirmdarstellung. easyrender etwa exportiert GLB und USDZ für Web und AR, kein STL. Für ein gedrucktes Teil nimmst du CAD-Software und echte Maße.

### Wie viele Dreiecke sollte ein 3D-Modell haben?

Für eine Produktseite oder AR am Handy 30.000 bis 50.000, den Idealbereich von Googles Scene Viewer, und unter dessen empfohlener Grenze von 100.000. Unsere Showcase-Modelle reichen von 14.590 Dreiecken bei einer Vase bis zu 69.910 bei einem Nachttisch mit Schubladen. Scans sind meist dichter und müssen vereinfacht werden.
