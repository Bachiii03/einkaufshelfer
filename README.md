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
