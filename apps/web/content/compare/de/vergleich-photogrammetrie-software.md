---

group: compare-photogrammetry-software
title: "Photogrammetrie-Software oder KI mit einem Foto?"
description: "Photogrammetrie-Software im Vergleich mit KI aus einem Foto: RealityScan, Metashape, Meshroom, Polycam und Zephyr, Fotobedarf, Preise und wann was passt."
keyword: photogrammetrie software
date: 2026-11-15
updated: 2026-11-15
author: Jorge Rodríguez
authorType: person
cta: Hast du nur ein Katalogfoto des Stücks, sieh es dir kostenlos von allen Seiten an, bevor du entscheidest, ob es überhaupt einen Scan braucht.
---

Photogrammetrie-Software baut ein 3D-Modell aus vielen überlappenden Fotos eines Objekts, das vor dir steht. Verbreitet sind RealityScan, Agisoft Metashape, Meshroom, Polycam und 3DF Zephyr. Hast du nur ein Foto, etwa das Katalogfoto eines Lieferanten, kann die Photogrammetrie nicht starten, und ein Bild-zu-3D-Werkzeug ist der Weg.

![Illustration einer gesprungenen Marmorbüste, zur Hälfte aus echtem Stein, zur anderen Hälfte aus mattgrauem Ton mit weißem Drahtgitter, umgeben von dünnen weißen Kamerakegeln vor dunklem Hintergrund](/compare/illustrations/photogrammetry-software/hero.webp "Illustration, kein Ergebnis von easyrender: eine Marmorbüste, halb als behauener Stein, halb als Ton- und Drahtgittermodell gezeichnet, mit Kamerakegeln darum.")

## Brauchst du überhaupt Photogrammetrie-Software?

Stell dir zuerst eine Frage: Kannst du um das Objekt herumgehen? Die Photogrammetrie misst nur, was die Kamera gesehen hat. Sie braucht also das Stück vor Ort, einen freien Nachmittag und Platz. Epics Anleitung zu RealityScan sagt es klar: Was nicht auf mehreren Bildern zu sehen ist, taucht im Modell nicht auf.

Steht das Stück im Lager eines Lieferanten oder hast du einen ganzen Katalog an Produktfotos, steht dir möglicherweise nur ein Foto pro Produkt zur Verfügung. Für diesen Fall gibt es KI mit einem Foto. Den Weg Schritt für Schritt, von der Fotowahl bis zur Prüfung der Dateien, beschreibt [3D-Modell aus Fotos erstellen](/de/ratgeber/3d-modell-aus-fotos-erstellen).

## Wie funktioniert Photogrammetrie-Software?

Die Software findet dieselben Punkte auf überlappenden Fotos, berechnet, wo jede Kamera stand, baut dann ein Mesh, also ein Gittermodell, und überträgt die Oberfläche aus den Fotos als Textur darauf. Alle Werkzeuge folgen denselben Aufnahmeregeln, weil alle Punkte zwischen Bildern abgleichen.

1. Wähl ein unbewegliches Objekt. Apples [Anleitung zu Object Capture](https://developer.apple.com/documentation/realitykit/capturing-photographs-for-realitykit-object-capture) warnt vor weichen oder biegsamen Stücken, die beim Bewegen ihre Form ändern, und vor sehr dünnen, spiegelnden, durchsichtigen oder einfarbig glatten Objekten.
2. Leuchte weich aus. Apple nennt Aufsteckblitz, direkte Sonne und nackte Glühbirnen als Probleme, das Handbuch von Meshroom rät ganz vom Blitz ab. Ein bedeckter Tag funktioniert.
3. Behalte die Kameraeinstellungen bei. Verändere Zoom, Blende, Verschlusszeit und ISO während der Serie nicht. Am iPhone hältst du den Finger auf die Vorschau, bis „AE/AF-Sperre“ erscheint.
4. Fotografiere mit viel Überlappung. Apple verlangt 70 % oder mehr zwischen benachbarten Aufnahmen und warnt, dass unter 50 % die Verarbeitung scheitern kann. Das Handbuch von Meshroom verlangt mindestens 60 % seitliche und 80 % frontale Überlappung.
5. Umkreise das Objekt in mehreren Höhen. RealityScan verlangt Kreise und Bögen in mehreren Höhen, das Objekt soll mindestens die Hälfte jedes Bildes füllen.
6. Nimm die Unterseite mit. Apple schlägt einen Drehteller vor und das Objekt auf verschiedene Seiten zu stellen, damit das Modell unten keine Lücken hat.
7. Maskier den Hintergrund und starte die Verarbeitung. Die Mobil-App von RealityScan beginnt nach 20 Bildern mit der Auswertung und verarbeitet höchstens 300 Bilder.

Nimm einen Beistelltisch aus Teak: drei Ringe bei weichem Licht, dann ein Satz von der Unterseite, mit dem Tisch auf der Seite liegend. Die Maserung gibt der Software viel zum Abgleichen, deshalb lässt sich Holz gut scannen.

## Welche Photogrammetrie-Software solltest du wählen?

Die Werkzeuge unterscheiden sich weniger in der Methode als darin, wo sie laufen und wie sie lizenziert sind. Preise mit Stand November 2026.

| Werkzeug               | Läuft auf                                   | Preis und Lizenz                                                                                                                        | Fotolimits und Hinweise                                                              |
| ---------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| RealityScan (Epic)     | Desktop-App, dazu eine kostenlose Mobil-App | Kostenlos unter 1 Million $ Umsatz in den letzten 12 Monaten, darüber 1.250 $ pro Platz und Jahr                                        | Die Mobil-App wertet ab 20 Bildern aus, Limit 300                                    |
| Agisoft Metashape      | Windows, macOS, Linux                       | Standard 179 $, Professional 3.499 $, unbefristet, 30 Tage kostenlos testen                                                             | Standard deckt Modellerstellung und Texturierung ab                                  |
| Meshroom (AliceVision) | Windows, Linux                              | Open Source, MPL-2.0                                                                                                                    | GPU-beschleunigt, das Handbuch verlangt 60 % seitliche und 80 % frontale Überlappung |
| Polycam                | App für iPhone und Android                  | Kostenlos mit 10 Photogrammetrie-Aufnahmen, Basic 150 $ im Jahr oder 30 $ im Monat                                                      | 150 Bilder pro Aufnahme bei Free, 300 bei Basic                                      |
| 3DF Zephyr             | Desktop                                     | Kostenlos bis 50 Fotos, Lite 199 € zzgl. MwSt. unbefristet, Vollversion 250 € zzgl. MwSt. im Monat oder 4.200 € zzgl. MwSt. unbefristet | Free exportiert texturierte Meshes nur mit JPG-Textur                                |

Quellen: [Lizenz von RealityScan](https://www.realityscan.com/en-US/license), [Startseite von RealityScan](https://www.realityscan.com/en-US), [Anleitung zur Mobil-App von RealityScan](https://dev.epicgames.com/documentation/realityscan-mobile/realityscan-step-by-step-guide), [Shop](https://www.agisoft.com/buy/online-store/) und [Installer](https://www.agisoft.com/downloads/installer/) von Metashape, [AliceVision](https://alicevision.org/) und das [Aufnahme-Handbuch von Meshroom](https://meshroom-manual.readthedocs.io/en/latest/capturing/capturing.html), [Preise von Polycam](https://poly.cam/pricing), [3DF Zephyr](https://www.3dflow.net/3df-zephyr-photogrammetry-software/). Alle gelesen am 11. November 2026.

Meshroom kostet nichts und passt zu dir, wenn du dich in eine knotenbasierte Desktop-App auf einem Windows- oder Linux-Rechner mit Grafikkarte einarbeiten willst. RealityScan ist für die meisten kleinen Shops kostenlos und deckt Handy und Desktop ab. Metashape hat Installer für Windows, macOS und Linux und eine Testphase von 30 Tagen, um es an deinen eigenen Stücken auszuprobieren.

Polycam ist ein einfacher Einstieg, wenn du mit dem Handy scannen willst, und die bezahlten Abos exportieren GLTF, OBJ, FBX, DAE und USDZ. Zephyr Free ist ein fairer Test für ein kleines Objekt, wenn du es mit höchstens 50 Fotos vollständig erfassen kannst.

## Was ist bei KI mit einem Foto anders?

Bild-zu-3D startet mit einem einzigen Foto und leitet die Seiten ab, die die Kamera nicht gesehen hat. Es gleicht keine Punkte zwischen Fotos ab und braucht deshalb keine Überlappung, keine Ringe und keinen Drehteller. Es braucht ein scharfes, gleichmäßig beleuchtetes Foto des ganzen Objekts vor schlichtem Hintergrund.

easyrender arbeitet so, in zwei Stufen. Zuerst zeichnet es ein kostenloses Ansichtsblatt: neun Ansichten des Objekts, acht in 45-Grad-Schritten rundherum und eine von oben. Du prüfst dieses Blatt und gibst Credits erst aus, wenn es stimmt.

Der Modellaufbau liest dann diese neun Ansichten und erstellt ein texturiertes Modell, das du als GLB und USDZ herunterlädst. Ein Modell kostet {{renderCredits}} Credits, also {{renderPrice}}, die [Preisseite](/de/preise) listet die Pakete. [Lade ein Foto hoch](/de#try) und sieh dir das Ansichtsblatt kostenlos an.

## Was willst du erreichen, und wie misst du es?

Leg das Ziel fest, bevor du das Werkzeug wählst. Zu jedem Ziel unten gibt es eine Prüfung, die du selbst machen kannst.

- Ein treues Abbild einer Oberfläche, etwa abgewetztes Leder oder Eichenmaserung. Sieh dir die Textur im Vollbild an und vergleiche sie mit dem echten Stück. Die Photogrammetrie übernimmt die Oberfläche aus den Fotos, hier lohnt sich ihr Aufwand.
- Ein vollständiges Objekt ohne Löcher. Dreh das Modell und halt an der Unterseite, an der Rückseite der Beine und an jeder tiefen Vertiefung an. Jedes Loch ist eine Stelle, die die Fotos verpasst haben.
- Ein Modell für jedes Produkt im Katalog. Miss für ein Stück die Zeit vom Aufbau bis zur fertigen Datei und rechne sie auf den Katalog hoch, bevor du dich für eine Methode entscheidest.
- Ein Modell eines Produkts, das du nicht anfassen kannst. Die Photogrammetrie kann nicht starten. Ein Bild-zu-3D-Ergebnis beurteilst du, indem du in jeder Ansicht Beine, Türen und Griffe zählst.
- Bekannte Kosten pro Modell. Bei einer Lizenz teilst du den Preis durch die Modelle, die du in der Laufzeit machst. Bei Credits liest du den Preis pro Modell auf der Preisseite ab.

## Was geht bei der Photogrammetrie schief, und wie behebst du es?

Die meisten misslungenen Scans gehen auf die Aufnahme zurück, nicht auf die Software. Mit dieser Liste prüfst du ein schlechtes Ergebnis, vom Symptom zur Lösung.

| Symptom                                                          | Ursache                                                              | Lösung                                                                                    |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Löcher in einer schlichten weißen Tischplatte                    | Eine einzige glatte Farbe gibt der Software nichts zum Abgleichen    | Mit Streiflicht fotografieren oder für dieses Stück eine andere Methode nehmen            |
| Die Verarbeitung scheitert oder das Modell ist ein Durcheinander | Unter 50 % Überlappung zwischen benachbarten Aufnahmen               | Mit 70 % oder mehr neu fotografieren, kleinere Schritte zwischen den Fotos                |
| Die Unterseite fehlt oder ist mit dem Boden verschmolzen         | Die Unterseite wurde nie fotografiert                                | Einen zweiten Satz mit dem Stück auf der Seite fotografieren oder einen Drehteller nutzen |
| Chromgriffe oder ein Spiegel werden klumpig                      | Spiegelungen ändern sich von Foto zu Foto                            | Spiegelnde Stücke meiden oder diese Teile hinnehmen und getrennt modellieren              |
| Unscharfe Stellen und verrutschte Textur                         | Zoom, Belichtung oder Fokus haben sich während der Aufnahme geändert | AE/AF sperren, eine Brennweite beibehalten und verwackelte Bilder aussortieren            |
| Dunkle Flecken in die Textur eingebacken                         | Harte Schatten von Blitz oder direkter Sonne                         | Das Licht streuen oder an einem bedeckten Tag fotografieren                               |
| Teile des Raums kleben am Objekt                                 | Ein unruhiger Hintergrund im Bild                                    | Einen schlichten Hintergrund nehmen und ihn in jedem Bild maskieren                       |
| Die kostenlose Version importiert keine Fotos mehr               | 3DF Zephyr Free begrenzt ein Projekt auf 50 Fotos                    | Auf die besten 50 kürzen oder auf eine Version ohne Fotolimit wechseln                    |

## Was wir im Einzelfall nehmen würden

So würden wir entscheiden, unser eigenes Produkt eingeschlossen.

Ein Stück in deinem Lager mit strukturierter Oberfläche, etwa eine geschnitzte Eichentruhe, und eine Stunde Zeit: Photogrammetrie. Sie hält die Oberfläche fest, wie sie ist, und RealityScan oder Meshroom kosten zum Ausprobieren nichts.

Ein Lieferantenfoto eines Sideboards, das du nie gesehen hast: KI mit einem Foto. Es gibt nichts zu scannen, und du beurteilst das kostenlose Ansichtsblatt, bevor du etwas ausgibst.

Ein ganzer Katalog an Produktfotos und kein Studio: KI mit einem Foto, gesammelt aus deiner Bibliothek oder über einen Agenten. Ein Scan pro Produkt heißt ein Shooting pro Produkt.

Eine Glasvase oder eine Lampe aus poliertem Stahl: Keine der beiden Methoden kommt mit spiegelnden Oberflächen gut zurecht. Die Dokumentationen zur Photogrammetrie raten davon ab, plan für dieses Stück also einen 3D-Artist ein.

## FAQ

### Welche Photogrammetrie-Software ist kostenlos am besten?

Meshroom ist Open Source unter MPL-2.0 und läuft auf Windows und Linux. RealityScan ist für Einzelpersonen und Unternehmen unter 1 Million $ Umsatz in den letzten 12 Monaten kostenlos. Das kostenlose Abo von Polycam enthält 10 Photogrammetrie-Aufnahmen, 3DF Zephyr Free verarbeitet bis zu 50 Fotos. Welche passt, hängt von deinem Rechner ab und davon, ob du mit dem Handy fotografierst.

### Wie viele Fotos braucht die Photogrammetrie?

Die Werkzeuge legen die Untergrenze über die Überlappung fest, nicht über eine feste Zahl. Apple verlangt 70 % Überlappung zwischen benachbarten Aufnahmen, Meshroom 60 % seitlich und 80 % frontal. Die Mobil-App von RealityScan beginnt nach 20 Bildern mit der Auswertung und nimmt bis zu 300.

Komplexe Objekte mit Vertiefungen brauchen mehr, weil jede Vertiefung auf mehreren Fotos zu sehen sein muss.

### Ist Photogrammetrie besser als KI-Bild-zu-3D?

Sie lösen verschiedene Probleme. Die Photogrammetrie rekonstruiert das Objekt aus vielen echten Fotos und braucht es deshalb vor Ort. Bild-zu-3D arbeitet mit einem Foto eines Stücks, das du vielleicht nie anfasst. Kannst du es scannen und zählt die Oberfläche, scann es. Hast du nur ein Foto, kann nur Bild-zu-3D starten.

### Kann die Photogrammetrie Glas, Spiegel oder Chrom scannen?

Nicht zuverlässig. Apples Anleitung rät von stark spiegelnden, durchsichtigen oder durchscheinenden Objekten ab, das Handbuch von Meshroom von Spiegelungen und durchsichtigen Objekten. Apple schlägt vor, eine Oberfläche zu bemalen oder mit Markierungen zu versehen, um ihr Struktur zu geben, was für Verkaufsware in der Regel nicht infrage kommt. Für solche Stücke ist ein 3D-Artist, der nach Fotos arbeitet, der sicherere Weg.
