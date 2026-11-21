# Einkaufshelfer – Bachl's Feldgemüse

Rechner für den Selbstbedienungs-Hofladen: Kundinnen und Kunden tippen ihre Produkte an
und sehen, wie viel sie in die Kassa legen müssen. Läuft auf dem Tablet im Laden und
auf dem eigenen Handy (auch offline).

**Online:** https://BENUTZERNAME.github.io/einkaufshelfer/

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
müssen als Datei vorhanden sein.

*Kein „Edit file“ in der App?* Dann dieselben Schritte auf **github.com** im
Handy-Browser: Datei öffnen → Stift-Symbol ✏️.
