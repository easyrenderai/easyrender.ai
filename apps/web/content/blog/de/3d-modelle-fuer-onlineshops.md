---

group: 3d-models-for-ecommerce
title: "3D-Modell für den Onlineshop: so kommen Shops an 3D"
description: "Was ein 3D-Produktmodell bringt, welche Dateien ein Shop braucht (GLB und USDZ), vier Wege zum Modell und die Grenzen, die du vorher kennen solltest."
date: 2026-11-15
updated: 2026-11-15
author: Jorge Rodríguez
authorType: person
keyword: 3d modell für onlineshop
cta: Nimm ein Stück mit Tiefe, einen Sessel oder ein Sideboard, und prüf jede Ansicht, bevor du entscheidest, ob sich 3D für deinen Shop lohnt.
---

Ein 3D-Modell für den Onlineshop ist eine Datei, meist GLB oder USDZ, mit der Käufer ein Produkt am Bildschirm drehen und es am Handy per AR in ihren Raum stellen können. Shops kommen auf vier Wegen an solche Modelle: über einen 3D-Artist, über die CAD-Daten des Herstellers, durch Scannen des Produkts oder mit KI aus einem einzigen Foto.

![Illustration eines braunen Leder-Loafers neben seinem Schuhkarton, die Spitze aus echtem Leder, die Ferse aus mattgrauem Ton mit weißem Drahtgitter, vor dunklem Hintergrund](/blog/illustrations/3d-models-for-ecommerce/hero.webp "Illustration, kein Ergebnis von easyrender: ein Loafer, halb aus Leder, halb als Ton- und Drahtgittermodell gezeichnet, neben seinem Karton.")

## Was bringt ein 3D-Modell auf der Produktseite?

Ein Foto zeigt die Ansicht, die du gewählt hast. Bei einem 3D-Modell wählt der Käufer: die Rückseite eines Bücherregals, die Unterseite eines Couchtischs, die Form des Polsters eines Loungesessels.

![Ein grau gepolsterter Drehsessel auf seinem Katalogfoto, schräg von hinten gesehen](/showcase/swivel-chair.jpg "Das Katalogfoto: eine Ansicht, von hinten, vom Fotografen gewählt.")
![Derselbe graue Drehsessel als 3D-Modell in einem Viewer, den der Käufer drehen kann, um Front und Sitzfläche zu sehen](/showcase/swivel-chair.glb "Das Modell, das easyrender aus diesem Foto gebaut hat: Der Käufer wählt die Ansicht. Die Front ist abgeleitet, denn das Foto zeigt nur die Rückseite.")

Auf iPhone und iPad öffnet sich eine USDZ-Datei in [AR Quick Look](https://developer.apple.com/augmented-reality/quick-look/) und stellt das Objekt über die Kamera in den Raum. Auf Android macht Googles [Scene Viewer](https://developers.google.com/ar/develop/scene-viewer) dasselbe mit einer GLB-Datei.

AR zeigt, wie ein Stück im Raum wirkt. Ein aus einem Foto erzeugtes Modell liefert keine verlässlichen Abmessungen. Die am echten Produkt gemessenen Maße gehören deshalb in deinen Produkttext.

## Wie misst du, ob sich 3D lohnt?

Leg fest, was 3D ändern soll, bevor du für ein Modell bezahlst. Für Möbelshops sind etwa Fragen zu Rückseite und Form sowie die Nutzung des Viewers interessant. Ob sich die Warenkorbrate verändert, musst du an deinem eigenen Katalog prüfen.

Wir veröffentlichen keine Zahlen zu Konversion oder Retouren durch 3D, weil wir keine gemessen haben, für die wir geradestehen können. Behandle jede Zahl, die du liest, als Behauptung, die du an deinem eigenen Katalog testest, etwa mit dieser Methode.

Wähl fünf bis zehn Produkte, die ein Modell bekommen, und eine passende Gruppe ähnlicher Produkte ohne Modell. Lass Preise, Fotos und Texte bei beiden vier bis sechs Wochen unverändert. Vergleich dann die Warenkorbrate pro Produktaufruf zwischen den beiden Gruppen und lies die Retourengründe.

Auf deiner eigenen Website löst [model-viewer](https://github.com/google/model-viewer/blob/master/packages/model-viewer/src/features/ar.ts) Ereignisse aus, die du an deine Webanalyse schicken kannst. Ein `camera-change`-Ereignis mit der Quelle `user-interaction` heißt, dass der Käufer das Modell gedreht hat. `ar-status` meldet, ob eine AR-Sitzung startet oder scheitert, und `quick-look-button-tapped` feuert, wenn ein iPhone an Quick Look übergibt.

## Welche Dateien braucht ein Shop für 3D?

GLB fürs Web und für Android, USDZ für AR auf Apple-Geräten. Die meisten Plattformen mit 3D-Unterstützung nehmen eines von beiden oder beide.

![Ein Produktmodell in zwei Dateien: Die GLB-Datei öffnet sich auf einer Produktseite in jedem Browser und per Scene Viewer in AR auf Android, die USDZ-Datei in AR Quick Look auf iPhone und iPad](diagram:store-files "Ein Modell, zwei Dateien, drei Orte, an denen Käufer es sehen. Eine selbst gebaute Website kann über model-viewer beide ausliefern.")

### 3D-Modelle in Shopify

[Shopify nimmt 3D-Modelle als Produktmedien an](https://help.shopify.com/de/manual/products/product-media/product-media-types), als GLB oder USDZ, bis 500 MB, an derselben Stelle, an der du Fotos hinzufügst. Bei Dateien über 15 MB werden Geometrie und Texturen beim Upload optimiert. Shopify wandelt jedes Modell so um, dass es eine GLB- und eine USDZ-Version gibt.

### WooCommerce und eigene Websites

WooCommerce-Shops ergänzen 3D über Erweiterungen, etwa den [Arty 3D Viewer](https://woocommerce.com/products/arty-3d-viewer/) im WooCommerce-Marktplatz. Auf einer selbst gebauten Website zeigt Googles quelloffene Komponente [model-viewer](https://modelviewer.dev/) eine GLB-Datei an, und `ar-modes="webxr scene-viewer quick-look"` gibt jedem Handy seinen eigenen AR-Viewer.

### Wie groß darf ein Produktmodell sein?

Shopify nimmt auch große Dateien an. Auf dem Handy des Käufers können sie jedoch langsam laden. Scene Viewer veröffentlicht die klarsten Vorgaben, die wir kennen, daran messen wir unsere eigenen Dateien.

| Vorgabe     | Empfehlung von Scene Viewer                      | Die sechs Modelle in unserem Showcase |
| ----------- | ------------------------------------------------ | ------------------------------------- |
| Dreiecke    | Bis 100.000, ideal 30.000 bis 50.000             | 14.590 bis 69.910                     |
| Textur      | Höchstens 2048 × 2048                            | Je eine Textur mit 1024 × 1024        |
| Materialien | Bis 10                                           | Je eines                              |
| Dateigröße  | 10 MB, größere Modelle laufen womöglich schlecht | 308.448 bis 1.287.432 Byte            |

Scene Viewer listet außerdem die glTF-Erweiterungen auf, die es unterstützt. Eine Datei, die auf eine Erweiterung außerhalb dieser Liste angewiesen ist, etwa WebP-Texturen, öffnet sich womöglich nicht. Eine GLB für Android-AR ist mit PNG- oder JPEG-Texturen am sichersten. Öffne sie auf einem echten Android-Handy, bevor du sie auf einer Produktseite verlinkst.

## Wie entstehen 3D-Produktmodelle?

Es gibt vier Wege. Wir bewerten sie nach vier Kriterien: ob du das Produkt vor Ort brauchst, wie viel eigene Zeit es kostet, wie genau die verdeckten Seiten wiedergegeben werden und woran es scheitert.

### Einen 3D-Artist beauftragen

Ein Artist baut das Modell aus deinen Fotos, Zeichnungen und Maßen. Das Produkt muss nicht vor Ort sein, Briefing und Wartezeit kosten aber am meisten Zeit. Dafür lassen sich auch Details gezielt ausarbeiten, die auf einem einzelnen Foto fehlen. Angebote auf Fiverr oder Upwork hängen von der Komplexität des Stücks ab.

Fazit: der richtige Weg, wenn das Modell exakt sein muss, etwa bei einem Sofa in drei Breiten, oder für ein Hauptprodukt einer Kampagne.

### Die CAD-Daten des Herstellers nutzen

Wenn du eigene Entwürfe verkaufst, hat die Fertigung vielleicht schon CAD- oder SketchUp-Dateien. Die Form ist exakt, webtauglich sind sie aber selten: Meist brauchen sie echte Texturen und deutlich weniger Dreiecke, bevor sie auf dem Handy gut laden.

Fazit: Frag zuerst danach, wenn dir die Entwürfe gehören. Plan die Nacharbeit ein, denn eine Fabrikdatei kann weit mehr Details enthalten als die 100.000 Dreiecke von Scene Viewer.

### Das Produkt scannen

Photogrammetrie-Apps wie Polycam und [RealityScan](https://dev.epicgames.com/documentation/realityscan-mobile/realityscan-step-by-step-guide) bauen ein Modell aus vielen überlappenden Fotos. RealityScan beginnt nach 20 Bildern mit der Verarbeitung und nimmt bis zu 300. Du brauchst das Stück vor Ort und Platz, um ganz darum herumzugehen.

Fazit: gut geeignet für Stücke mit Struktur, die in deinem Lager stehen, etwa ein Rattanstuhl oder ein Sideboard aus Eiche. An Glas, Spiegeln und poliertem Metall scheitert er.

### Mit KI aus einem Foto erzeugen

Bild-zu-3D-Werkzeuge wie Meshy, Tripo und easyrender starten mit einem einzigen Bild. Das ist der einzige Weg, wenn du ein Lieferantenfoto hast und nicht an das Stück herankommst. Das Foto zeigt nur eine Seite, deshalb prüfst du die Rückseite in der Vorschau, bevor du das Modell behältst.

![Neun Ansichten einer matten Steinzeugvase, gezeichnet aus einem Produktfoto](/showcase/vase-angles.jpg "Ein Ansichtsblatt, das easyrender aus einem Foto einer Steinzeugvase gezeichnet hat, unbearbeitet. Runde, matte Objekte wie dieses sind der einfache Fall.")

Fazit: der Weg für einen Katalog aus Lieferantenfotos. Feine Logos, offenes Geflecht und eine Seite, die das Foto nie gezeigt hat, lassen sich aus einem Bild schwerer ablesen. Jeden Weg mit seinen Voraussetzungen und Schwächen beschreibt [3D-Modell erstellen](/de/ratgeber/3d-modell-erstellen).

Ob du jemanden beauftragst oder mit einem Foto startest, vergleicht [3D-Modellierer oder KI](/de/vergleich/3d-modellierer-oder-ki). Zwei der Werkzeuge stellen [Meshy](/de/vergleich/meshy) und [Tripo](/de/vergleich/tripo) genauer vor.

## 3D-Modelle für Möbelshops: Wo fängst du an?

Leg fest, mit welchen Produkten du anfangen willst, bevor du Modelle erstellst. Bewerte jedes nach vier Fragen: Zählen Rückseite oder Tiefe? Ist der Preis so hoch, dass Käufer zögern? Fragen Leute nach mehr Ansichten? Nennen Retouren die Optik als Grund?

Fang mit den fünf an, die am besten abschneiden. Meist sind das ein Sessel, ein Sideboard oder eine Stehlampe mit geformtem Schirm. Flache Artikel wie ein gerahmter Druck oder ein Teppich gewinnen durch 3D wenig.

Teste die Wege, bevor du dich festlegst. Schick ein Produkt durch zwei davon, etwa einen Handyscan und ein Bild-zu-3D-Modell derselben Tischlampe, und vergleich beide auf dem Handy. Das sagt mehr als jede Funktionsliste.

Bei einem großen Katalog schaust du auf Sammel-Uploads und den Preis pro Modell. Bei easyrender legst du eine Reihe Katalogfotos in deiner Bibliothek ab, prüfst für jedes eine kostenlose Vorschau und lässt nur die Modelle bauen, die stimmen.

## Wie bringst du 3D Schritt für Schritt in den Shop?

So würden wir bei einer ersten Runde vorgehen:

1. Wähl fünf Produkte anhand der vier Fragen oben.
2. Erstell jedes Modell auf dem Weg, der zu ihm passt.
3. Prüf jedes Modell: Zahl der Beine und Türen, die Rückseite, die Textur im Vollbild.
4. Passe jede Datei an die technischen Vorgaben an: Texturen mit höchstens 2048 Pixeln, Geometrie komprimiert, wenn dein Viewer das unterstützt.
5. Lade sie mit den Werkzeugen der Plattform hoch, etwa über die Produktmedien in Shopify.
6. Öffne jede Seite über mobile Daten auf einem iPhone und einem Android-Handy und probier auf beiden AR aus.
7. Miss vier bis sechs Wochen lang wie oben beschrieben und entscheide dann über die nächste Runde.

## Ein Beispiel: ein Sideboard aus Nussbaum

Angenommen, ein Shop hat drei Lieferantenfotos eines Nussbaum-Sideboards: von vorn, schräg von vorn und eine Nahaufnahme der Messinggriffe. Für Bild-zu-3D nimmst du die Drei-Viertel-Aufnahme, weil sie Tiefe und eine Seitenwange zeigt.

![Drei Lieferantenfotos eines Sideboards als Rahmen gezeichnet: eine Frontansicht ohne Tiefe, eine Drei-Viertel-Ansicht mit Front und einer Seitenwange, als die richtige markiert, und eine Nahaufnahme eines Stangengriffs](diagram:sideboard-photo-pick "Von den drei Lieferantenfotos zeigt nur die Drei-Viertel-Aufnahme die Seitenwange, das Werkzeug muss also weniger Tiefe raten. Eine Zeichnung für dieses Beispiel, kein echtes Inserat.")

Türen, Beine und Holzmaserung lassen sich häufig gut wiedergeben. Prüf die Messinggriffe an der Nahaufnahme, denn kleine Beschläge verlieren bei jedem Verfahren zuerst an Detail. Und schau dir die Rückseite genau an, die das Werkzeug nie gesehen hat.

Lade die GLB-Datei dann mit den Werkzeugen deiner Plattform hoch und öffne die Seite vor dem Veröffentlichen auf einem iPhone und einem Android-Handy. Bei Shopify entsteht die USDZ-Datei fürs iPhone automatisch aus demselben Upload.

## Was geht schief, wenn ein Shop 3D einführt?

Die meisten Probleme zeigen sich erst auf einem echten Handy, deshalb gibt es Schritt 6. Auf diese solltest du achten, jeweils mit Lösung.

| Symptom                                           | Ursache                                                                            | Lösung                                                                                                                                                                        |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kein AR-Button auf einem Android-Handy            | Scene Viewer lädt Dateien nur über HTTPS, oder das Handy unterstützt es nicht      | Die GLB über HTTPS ausliefern und auf einem zweiten Handy testen                                                                                                              |
| Kein AR auf dem iPhone von deiner eigenen Website | Keine USDZ-Datei, oder sie wird mit falschem Content-Type ausgeliefert             | Die USDZ ergänzen und als `model/vnd.usdz+zip` ausliefern, den Typ, [nach dem Safari sucht](https://webkit.org/blog/8421/viewing-augmented-reality-assets-in-safari-for-ios/) |
| Das Stück erscheint in AR riesig oder winzig      | Ein Modell aus einem Foto liefert keine verlässlichen Abmessungen                  | Die Maße in den Text schreiben, Käufer können das Modell mit zwei Fingern skalieren                                                                                           |
| Das Stück schwebt über dem Boden                  | Die Unterseite des Modells liegt über seinem Ursprung                              | Den Ursprung in Blender vor dem Export an die Standfläche legen                                                                                                               |
| Die Seite lädt über mobile Daten langsam          | Texturen mit 4096 Pixeln oder unkomprimierte Geometrie                             | Texturen mit 2048 oder 1024 Pixeln, dazu Draco- oder Meshopt-Kompression, wo der Viewer sie unterstützt                                                                       |
| Das Modell wirkt in AR dunkel oder schmutzig      | In die Textur eingebackene Schatten, wovon Scene Viewer abrät                      | Eine Textur ohne eingebackene Schatten nehmen und Metallic auf 0 setzen, wenn das Material den Wert offen lässt                                                               |
| Die GLB öffnet sich nicht in Scene Viewer         | Sie nutzt eine glTF-Erweiterung, die Scene Viewer nicht listet, etwa WebP-Texturen | Eine einfache Version mit PNG- oder JPEG-Texturen exportieren                                                                                                                 |

## Wo liegen die Grenzen von 3D im Onlineshop?

Ein aus einem Foto erzeugtes Modell zeigt Form und Materialien. Verlässliche Abmessungen liefert es nicht. Die am Produkt gemessenen Maße gehören in den Produkttext.

Durchsichtige und spiegelnde Produkte wie eine Glasvase oder eine Chromlampe sind für jedes Verfahren schwierig. Kleine Schrift und kleine Logos werden oft unscharf.

3D ersetzt keine Fotos. Plattformen zeigen in Suchergebnissen, Anzeigen und Kategorierastern weiter Standbilder, deshalb gelten die Grundlagen aus [Produktfotografie für den Onlineshop](/de/ratgeber/produktfotografie-onlineshop) weiterhin.

## FAQ

### Brauche ich 3D-Modelle für meinen Onlineshop?

Nicht für jedes Produkt. 3D hilft vor allem dort, wo Käufer Tiefe und Rückseite sehen wollen: bei Stühlen, Sofas, Sideboards und Lampen. Bei flachen oder sehr einfachen Artikeln reichen gute Fotos. Fang mit ein paar Produkten an, zu denen Käufer nach mehr Ansichten fragen, und entscheide dann, statt den ganzen Katalog auf einmal umzustellen.

### Welches 3D-Dateiformat braucht ein Onlineshop?

In den meisten Fällen zwei: GLB fürs Web und für AR auf Android, dazu USDZ, das Format, das iPhone und iPad in AR Quick Look öffnen. Shopify nimmt beide an und wandelt jedes Modell so um, dass beide Versionen existieren. Liefert ein Werkzeug nur eines, erzeugen Apples Reality Converter auf dem Mac oder Blender das andere.

### Wie groß sollte die Datei eines 3D-Produktmodells sein?

Klein genug für ein Handy mit mobilen Daten. Googles Scene Viewer empfiehlt höchstens 10 MB, 100.000 Dreiecke und Texturen mit 2048 Pixeln, ideal sind 30.000 bis 50.000 Dreiecke. Shopify nimmt Dateien bis 500 MB an und optimiert alles über 15 MB, eine leichtere Datei lädt für den Käufer aber trotzdem schneller.

### Was kostet ein 3D-Modell für den Onlineshop?

Das hängt vom Weg ab. Artists rechnen pro Modell nach Komplexität ab, Scan-Apps meist per Abo, KI-Werkzeuge pro Modell oder pro Monat. Bei easyrender ist die Vorschau kostenlos, ein fertiges Modell kostet {{renderCredits}} Credits ({{renderPrice}}). Credits kaufst du nach Bedarf oder im Pro-Abo mit {{proCredits}} Credits im Monat für {{proPrice}}.

### Können Käufer ein 3D-Produkt in AR sehen, und stimmt dann die Größe?

In AR sehen können sie es auf den meisten aktuellen Handys: iPhone und iPad nutzen AR Quick Look mit USDZ, Android nutzt Scene Viewer mit GLB. Ein aus einem Foto erzeugtes Modell liefert jedoch keine verlässlichen Abmessungen. Maßgeblich sind die am echten Produkt gemessenen Angaben im Produkttext.
