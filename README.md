# Einkaufshelfer – Bachl's Feldgemüse

Rechner für den Selbstbedienungs-Hofladen: Kundinnen und Kunden tippen ihre Produkte an
und sehen, wie viel sie in die Kassa legen müssen. Läuft auf dem Tablet im Laden und
auf dem eigenen Handy (auch offline).

**Online:** https://bachiii03.github.io/einkaufshelfer/

## Preise ändern

Alle Produkte und Preise stehen in **`products.json`**. So änderst du sie mit der
GitHub-App am Handy:

1. **GitHub-App** öffnen (Android/iPhone) und das Repository **einkaufshelfer** antippen.
2. **Code** (bzw. „Browse code“) → **products.json** antippen.
3. Oben rechts auf **⋯** → **Edit file** tippen.
4. Ändern, was du brauchst, zum Beispiel:
   ```json
   { "einheit": "1 kg", "preis": 2.20 }
   ```
   - Preise mit **Punkt** schreiben, ohne € und ohne Anführungszeichen: `2.20`, nicht `"2,20 €"`.
   - Produkt ausverkauft? `"verfuegbar": false` – wieder da? `"verfuegbar": true`.
   - Im Reiter „★ Beliebt“ zeigen? `"beliebt": true`.
   - Neues Produkt: eine bestehende Zeile kopieren und anpassen. Komma zwischen den Produkten nicht vergessen!
   - Englisch: `"name_en": "Potatoes"` (und bei Bedarf `"info_en": "…"`) – wird angezeigt,
     wenn Kunden auf „English“ tippen. Fehlt es, steht dort der deutsche Name.
   - Bild auf der Kachel: `"icon": "apfel"` wählt eine Zeichnung aus `bilder/icons.svg`
     (Namen stehen dort bei `id="..."`). Ein echtes Foto mit `"foto": "bilder/…jpg"` hat Vorrang.
5. Oben rechts **Commit changes** tippen, kurz beschreiben (z. B. „Äpfel 2,20 €“) und
   direkt in **main** speichern.
6. Nach 1–2 Minuten ist die Änderung online. Das Tablet holt sich die neuen Preise
   beim nächsten „Neuer Einkauf“ bzw. wenn es zur Startseite zurückkehrt.

**Kontrolle:** Bei jeder Änderung prüft GitHub automatisch die Datei
(Reiter **Actions** im Repository):

- ✅ grün = alles in Ordnung, die Seite wurde veröffentlicht.
- ❌ rot = Fehler gefunden. Antippen → „Preise prüfen“ zeigt, welches Produkt und was
  genau falsch ist. **Die alte Version bleibt so lange online**, bis du den Fehler
  korrigierst.

Geprüft wird: gültiges JSON (Kommas, Klammern), jedes Produkt hat einen Namen
(höchstens 30 Zeichen) und eine dieser Kategorien: *Gemüse, Obst & Getränke, Öle,
Milch & Eier, Vorrat & Gläser*; mindestens eine Größe oder `"preis_variabel": true`;
Preise zwischen 0.10 und 100 € mit höchstens 2 Nachkommastellen; Fotos (`"foto"`)
müssen als Datei vorhanden sein; Icons (`"icon"`) müssen in `bilder/icons.svg` existieren.

*Kein „Edit file“ in der App?* Dann dieselben Schritte auf **github.com** im
Handy-Browser: Datei öffnen → Stift-Symbol ✏️.

## Leergut und Einsatz

Im Warenkorb gibt es den Knopf **„Leergut zurückgeben“**. Jedes Antippen = eine leere
Flasche bzw. ein Glas; der Einsatz wird von der Summe abgezogen (eigene grüne Zeile mit
Minus-Betrag, Anzahl mit −/+ änderbar).

In **`products.json`** bei jedem Produkt mit Einsatz:

```json
"einsatz": 0.50, "einsatz_art": "Flasche"
```

- `einsatz`: Betrag in Euro mit **Punkt**, zwischen 0.05 und 5.
- `einsatz_art`: `"Flasche"` oder `"Glas"` – Pflicht, sobald `einsatz` dasteht.
- Alle Produkte mit **gleichem Betrag** zählen gleich – unter dem Knopf steht klein
  „−0,50 € je Flasche oder Glas“.
- Hat ein Produkt einmal einen **anderen** Einsatz (z. B. 1.00), öffnet der Knopf automatisch
  einen Dialog „Was bringen Sie zurück?“ mit einer Zeile pro Betrag.
- Der Text bei `"info"` (z. B. „inkl. 0,50 € Einsatz“) bleibt, wie er ist – den bitte selbst
  mitändern, wenn sich der Einsatz ändert.
- Auch ausverkaufte Produkte (`"verfuegbar": false`) bleiben im Leergut-Dialog, damit man ihre
  Flaschen trotzdem zurückgeben kann.

In **`inhalte.json`**: `"einsatz_auszahlen": false`

- `false` (Standard): Ist das Leergut mehr wert als der Einkauf, steht die Summe auf 0,00 € und
  der Hinweis „Der Einsatz wird mit Ihrem Einkauf verrechnet. Bitte nehmen Sie kein Geld aus der
  Kassa.“ erscheint.
- `true`: Dann zeigt die Danke-Seite „Bitte nehmen Sie X € aus der Kassa.“ (ohne Wechselgeld-Hilfe).

Die automatische Prüfung kontrolliert `einsatz`, `einsatz_art` und `einsatz_auszahlen`.

## Rezepte, Neuigkeiten und „Über uns“ ändern

Die Texte der Startseiten-Bereiche stehen in zwei Dateien – genauso änderbar wie
`products.json` (auch in der GitHub-App):

- **`rezepte.json`** – jedes Rezept mit `titel`, `kurz`, `dauer`, `portionen`,
  `zutaten` und `schritte`. Steht bei einer Zutat `"produkt": "Erdäpfel"` (genau wie
  in `products.json` geschrieben), zeigt die Seite das Icon und „im Laden“.
- **`geschichten.json`** – `neuigkeiten` (Titel, Art, Datum wie `"2026-03-04"`,
  Absätze in `text`, optional `zitat` und `quelle`) und `ueber_uns`.
  Mit `"neuigkeiten_sichtbar": false` zeigt „Neuigkeiten & Presse“ nur „Kommt bald“ –
  die Geschichten bleiben gespeichert. `true` = Geschichten anzeigen.
- Das Abzeichen „Rezept der Woche“ bekommt das Rezept, dessen Titel genau so in
  `inhalte.json` bei `rezept_der_woche` steht.

Die automatische Prüfung kontrolliert auch diese beiden Dateien.

## Saisonkalender ändern

Der Saisonkalender (Leiste auf der Startseite und eigene Seite) kommt aus **`saison.json`**:

```json
{ "name": "Erdäpfel", "frisch": [7,8,9,10], "lager": [11,12,1,2,3,4] }
```

- Monate als Zahlen: **1 = Jänner … 12 = Dezember**.
- `frisch` = frisch geerntet (grün), `lager` = vom Lager (orange). Ein Monat darf nur bei
  einem von beiden stehen. Gibt es nichts vom Lager: `"lager": []`.
- `ganzjaehrig` = Liste, was es das ganze Jahr gibt, z. B. `["Säfte", "Öle", "Honig"]`.
- Die Startseiten-Leiste zeigt automatisch den aktuellen Monat (Datum des Geräts).

Die automatische Prüfung kontrolliert auch diese Datei (Monate 1–12, nichts doppelt).

## Bildschirmschoner (Laden-Tablet)

Wenn niemand einkauft, zeigt das Laden-Tablet wechselnde Folien im Packpapier-Stil – unten
immer groß „Zum Einkaufen bitte antippen“. Das erste Antippen beendet den Bildschirmschoner
nur (es wird dabei kein Knopf gedrückt). Einstellungen in **`inhalte.json`**:

```json
"bildschirmschoner": {
  "aktiv": true,
  "start_nach_sekunden": 90,
  "folie_sekunden": 12,
  "nacht_von": "22:00",
  "nacht_bis": "06:00",
  "nacht_helligkeit": 0.45
}
```

- `aktiv`: `true` = eingeschaltet, `false` = aus (ohne Anführungszeichen).
- `start_nach_sekunden`: so lange ohne Antippen, bis er startet (10 bis 3600) – Tag und Nacht.
- `folie_sekunden`: so lange bleibt jede Folie stehen (5 bis 120), dann langsame Überblendung.
- `nacht_von` / `nacht_bis`: in dieser Zeit wird er abgedunkelt (Uhrzeit des Tablets, darf über
  Mitternacht gehen).
- `nacht_helligkeit`: wie hell er nachts bleibt – `1` = gar nicht abgedunkelt, `0.45` = 45 %,
  `0.1` = sehr dunkel. Zahl mit **Punkt**.

Die Folien (leere werden übersprungen):

1. Logo und „Willkommen bei Bachl's Feldgemüse – Selbstbedienung rund um die Uhr“
2. „Jetzt frisch“ / „Vom Lager“ im aktuellen Monat (aus `saison.json`)
3. „Rezept der Woche“ (Titel aus `inhalte.json`, Text und Dauer aus `rezepte.json`;
   ein Foto erscheint, wenn beim Rezept `"foto": "bilder/…jpg"` steht)
4. „Neu im Laden“ (aus `inhalte.json`)
5. Beliebte Produkte mit Bild und Preis, 3–4 auf einmal (`"beliebt": true` und
   `"verfuegbar": true` in `products.json`)

Gut zu wissen:

- Er startet nur, wenn die Startseite unberührt dasteht – nie mit vollem Warenkorb, offenem
  Ziffernfeld oder auf der Danke-Seite.
- Die Inhalte verschieben sich mit jeder Folie ein Stück, damit nichts einbrennt.
- Gilt nur für das Laden-Tablet (Start-Adresse mit `?laden`). Dort hält die Seite den
  Bildschirm außerdem wach, damit sich das Gerät nicht selbst sperrt (wo der Browser das kann).
- **Testen:** `https://bachiii03.github.io/einkaufshelfer/?schonertest` startet nach 5 Sekunden;
  `?schonertest&nachttest` zeigt zusätzlich die abgedunkelte Nacht-Version.

Die automatische Prüfung kontrolliert auch diese Einstellungen (Zahlen, Uhrzeit-Format).

## Kinderecke

Auf der Startseite gibt es unten den Knopf **„Für Kinder“** mit zwei Spielen:
**Gemüse-Memory** (6 Paare, ohne Lesen) und **„Was ist das?“** (Icon erkennen, drei Antworten,
Vorlese-Knopf). Kein Zeitdruck, kein Verlieren, nichts wird gespeichert oder verschickt.

Einstellungen in **`inhalte.json`**:

```json
"kinderecke": { "aktiv": true, "kinder_minuten": 3 }
```

- `aktiv`: `false` = Knopf „Für Kinder“ ausblenden.
- `kinder_minuten`: so lange darf pro Besuch am **Laden-Tablet** gespielt werden (1 bis 30).
  Danach: „Super gespielt! Jetzt ist Pause.“ und zurück zur Startseite. Am Handy gibt es kein Limit.
- Ist schon etwas im Warenkorb, bleibt es erhalten; oben rechts führt „Zum Einkauf (X Artikel)“
  direkt zurück.
- **Am Handy weiterspielen:** Auf der Kinderecke steht ein QR-Code zu
  `https://bachiii03.github.io/einkaufshelfer/#kinder`. Das Bild (`bilder/kinder-qr.svg`) erzeugt
  GitHub beim Veröffentlichen automatisch mit `scripts/make-qr.js` – lokal fehlt es, dann wird der
  Kasten einfach ausgeblendet.
- Die Spiele verwenden die Icons aus `bilder/icons.svg`; „Was ist das?“ zeigt nur gut erkennbare
  (Erdäpfel, Zwiebel, Knoblauch, Kürbis, Chinakohl, Pak Choi, Süßkartoffel, Apfel, Milch, Eier, Honig).

Die automatische Prüfung kontrolliert auch diese Einstellungen.

## Google-Bewertung auf der Danke-Seite

Nach dem Antippen eines Smileys (egal ob Gut, Okay oder Schlecht – Google erlaubt nicht, nur
zufriedene Kunden zu fragen) erscheint eine ruhige Einladung: „Gefällt Ihnen unser Hofladen?
Erzählen Sie es weiter – mit einer Bewertung auf Google.“

- **Laden-Tablet:** QR-Code zum Scannen mit dem Handy („Mit dem Handy scannen“).
- **Handy:** Knopf „Auf Google bewerten“.
- Bei „Schlecht“ steht zusätzlich zuerst „Was können wir besser machen?“ mit einem Knopf zu
  „Wünsche & Feedback“.
- Solange die Einladung zu sehen ist, bleibt die Danke-Seite 45 statt 20 Sekunden offen.

Einstellung in **`inhalte.json`**:

```json
"google_bewertung": { "aktiv": true, "url": "https://g.page/r/…/review" }
```

- `url` leer (`""`) oder `"aktiv": false` → die Einladung wird gar nicht gezeigt.
- Die Adresse muss mit `https://` beginnen.
- **Wo finde ich den Link?** Im Google-Unternehmensprofil (business.google.com oder in Google
  Maps/Suche beim eigenen Profil) auf **„Bewertungen erhalten“** (englisch: *„Ask for reviews“*)
  tippen und den angezeigten Link kopieren.
- Den QR-Code (`bilder/google-bewertung-qr.svg`) erzeugt GitHub beim Veröffentlichen automatisch
  mit `scripts/make-qr.js` – er passt also immer zur Adresse in `inhalte.json`.

Die automatische Prüfung kontrolliert auch diese Einstellung.

## Jahreszeiten-Look

Je nach Datum bekommt die Seite eine kleine Dekoration (Zeichnungen in den Ecken der Startseite,
am unteren Rand, an der Danke-Karte und im Bildschirmschoner) und einen Gruß unter dem
Startseiten-Titel. Die Zierde liegt immer **hinter** dem Inhalt – Kacheln, Preise, Knöpfe,
Warenkorb und Ziffernfeld bleiben genau wie sie sind.

| Thema | Zeitraum | Gruß |
|---|---|---|
| `winter` | 7. Jänner – 28. Februar | – |
| `fruehling` | 1. März – 31. Mai | „Der Frühling ist da!“ |
| `ostern` | Palmsonntag – Ostermontag (wird jedes Jahr berechnet) | „Frohe Ostern!“ |
| `sommer` | 1. Juni – 31. August | „Frisch vom Feld!“ |
| `herbst` | 1. September – 14. Oktober | „Erntezeit!“ |
| `kuerbis` | 15. Oktober – 2. November | „Kürbiszeit!“ |
| `advent` | 1. Adventsonntag (berechnet) – 6. Jänner | „Schöne Adventzeit!“, ab 24.12. „Frohe Weihnachten!“, ab 31.12. „Prosit Neujahr!“ |

Zwischen 3. November und dem 1. Advent gibt es kein Thema. Überschneiden sich zwei, gewinnt das
besondere (Ostern vor Frühling, Kürbis vor Herbst, Advent vor Winter). Im Winter und Advent fällt
im Bildschirmschoner tagsüber ganz langsam ein wenig Schnee (nicht nachts und nicht, wenn am
Gerät „Bewegung reduzieren“ eingeschaltet ist).

Einstellungen in **`inhalte.json`** unter `"jahreszeiten"`:

- `"aktiv": false` schaltet die ganze Dekoration aus (**derzeit ausgeschaltet** – zum Einschalten
  `true`); bei einem einzelnen Thema `"aktiv": false` nur dieses.
- `"von"` / `"bis"` als **Monat-Tag**: `"03-01"` = 1. März. Ein Zeitraum darf über Neujahr gehen.
- `"automatisch": true` (nur bei `ostern` und `advent`): Beginn wird jedes Jahr berechnet.
  Beim Advent bestimmt `"bis"` das Ende (Standard `"01-06"`).
- Ein 29. Februar fällt mit `"bis": "02-28"` aus dem Winter – wer möchte, schreibt `"02-29"`.

**Testen:** `…/einkaufshelfer/?thema=ostern` (oder `winter`, `fruehling`, `sommer`, `herbst`,
`kuerbis`, `advent`) zeigt ein Thema sofort, `?thema=keins` gar keines,
`?datum=2026-12-24` tut so, als wäre dieser Tag. Die Zeichnungen liegen in `bilder/jahreszeiten/`.

Die automatische Prüfung kontrolliert die Themen-Namen und Datumsangaben.

## „So funktioniert unser Hofladen“

Erklärseite für Erstkunden: Knopf **„So funktioniert's“** unten auf der Startseite, eine eigene
Folie im Bildschirmschoner („Zum ersten Mal hier?“) und direkt erreichbar unter
`https://bachiii03.github.io/einkaufshelfer/#so-gehts` (z. B. als QR-Code auf einem Schild an der Tür).

Alle Texte stehen in **`geschichten.json`** unter `"so_gehts"` (Englisch: `"so_gehts_en"`):

- `titel`, `schritte` (je `titel`, `text`, `icon` aus `bilder/icons.svg`: `schritt-ware`,
  `schritt-tablet`, `schritt-kassa`, `schritt-leergut`, `schritt-danke`), `video_hinweis`.
  (`hinweise` wird derzeit nicht angezeigt.)
- Ein Schritt mit `"nur_mit_leergut": true` erscheint nur, wenn es Produkte mit `"einsatz"` gibt –
  sonst steht dort „Danke für Ihren Einkauf!“.
- **Videoüberwachung:** steht als eine lange Zeile unter den 4 Schritten (mit Link zum
  Datenschutz). Steht bei `video_hinweis` nur ein Platzhalter in eckigen Klammern `[…]`, wird
  die Zeile nicht angezeigt.

Die automatische Prüfung kontrolliert auch diesen Block (Titel, Schritte, Icons).

## Meldungen und Wochenbericht per E-Mail

- **„Etwas gefehlt? Hier melden“** (auf der Danke-Seite): Kunden tippen an, was leer
  war, und wir bekommen sofort eine E-Mail. Ohne Internet wird die Meldung auf dem
  Gerät gespeichert und später automatisch nachgeschickt.
- **Wochenbericht:** Das Tablet im Laden zählt die Smileys (Gut / Okay / Schlecht) und
  schickt alle 7 Tage eine Zusammenfassung – auch in Wochen ohne Bewertung
  (dann wissen wir, dass das Tablet läuft).

Einrichtung (einmalig):

1. Auf **web3forms.com** mit unserer E-Mail-Adresse einen kostenlosen *Access Key*
   holen (kommt per E-Mail).
2. Den Schlüssel in `app.js` oben bei `MELDEN_SCHLUESSEL = "..."` eintragen.
   Leer = Knopf „Hier melden“ wird nicht angezeigt.
3. In **Fully Kiosk** als Start-Adresse eintragen:
   `https://bachiii03.github.io/einkaufshelfer/?laden`
   Das `?laden` sagt der Seite: „Ich bin das Laden-Tablet“ – nur dieses Gerät zählt
   die Smileys und schickt den Wochenbericht.
