// Prüft products.json (und die Texte in rezepte.json / geschichten.json), bevor die Seite veröffentlicht wird.
// Aufruf:  node scripts/check-products.js
// Findet das Skript einen Fehler, beendet es sich mit Code 1 –
// dann wird die Seite NICHT veröffentlicht und die alte Version bleibt online.

const fs = require("fs");
const path = require("path");

const ORDNER = path.join(__dirname, "..");
const DATEI = path.join(ORDNER, "products.json");

const KATEGORIEN = ["Gemüse", "Obst & Getränke", "Öle", "Milch & Eier", "Vorrat & Gläser"];
const PREIS_MIN = 0.1;
const PREIS_MAX = 100;
const NAME_MAX = 30;

const fehler = [];

// Alle Icon-Namen aus bilder/icons.svg (<symbol id="...">)
const ICONS = (() => {
  try {
    const svg = fs.readFileSync(path.join(ORDNER, "bilder", "icons.svg"), "utf8");
    return [...svg.matchAll(/<symbol\s+id="([^"]+)"/g)].map((m) => m[1]);
  } catch {
    return [];
  }
})();

function pruefeProdukt(p, nr) {
  const wer = p && typeof p.name === "string" && p.name.trim() ? `"${p.name}"` : `Produkt Nr. ${nr}`;
  const melde = (text) => fehler.push(`${wer}: ${text}`);

  if (!p || typeof p !== "object" || Array.isArray(p)) return melde("ist kein gültiger Eintrag { ... }.");

  // Name
  if (typeof p.name !== "string" || !p.name.trim()) melde('"name" fehlt oder ist leer.');
  else if (p.name.length > NAME_MAX) melde(`Name ist ${p.name.length} Zeichen lang, erlaubt sind höchstens ${NAME_MAX}.`);

  // Englischer Name / Info (optional)
  if (p.name_en !== undefined) {
    if (typeof p.name_en !== "string" || !p.name_en.trim()) melde('"name_en" ist leer – entweder einen englischen Namen eintragen oder die Zeile weglassen.');
    else if (p.name_en.length > NAME_MAX) melde(`Englischer Name ist ${p.name_en.length} Zeichen lang, erlaubt sind höchstens ${NAME_MAX}.`);
  }
  if (p.info_en !== undefined && typeof p.info_en !== "string") melde('"info_en" muss ein Text in Anführungszeichen sein.');

  // Kategorie
  if (!KATEGORIEN.includes(p.kategorie)) {
    melde(`Kategorie "${p.kategorie ?? ""}" gibt es nicht. Erlaubt: ${KATEGORIEN.join(", ")}.`);
  }

  // Größen und Preise
  const variabel = p.preis_variabel === true;
  if (p.groessen !== undefined && !Array.isArray(p.groessen)) {
    melde('"groessen" muss eine Liste [ ... ] sein.');
  } else {
    const groessen = p.groessen || [];
    if (groessen.length === 0 && !variabel) {
      melde('braucht mindestens eine Größe in "groessen" oder "preis_variabel": true.');
    }
    groessen.forEach((g, i) => {
      const welche = g && typeof g.einheit === "string" && g.einheit.trim() ? `Größe "${g.einheit}"` : `Größe Nr. ${i + 1}`;
      if (!g || typeof g !== "object") return melde(`${welche} ist kein gültiger Eintrag { ... }.`);
      if (typeof g.einheit !== "string" || !g.einheit.trim()) melde(`${welche}: "einheit" fehlt oder ist leer.`);
      if (typeof g.preis !== "number" || !Number.isFinite(g.preis)) {
        melde(`${welche}: Preis muss eine Zahl sein (mit Punkt, z. B. 2.50 – ohne Anführungszeichen und ohne €).`);
      } else {
        if (g.preis < PREIS_MIN || g.preis > PREIS_MAX) {
          melde(`${welche}: Preis ${g.preis} liegt nicht zwischen ${PREIS_MIN.toFixed(2)} und ${PREIS_MAX.toFixed(2)} €.`);
        }
        if (Math.abs(g.preis * 100 - Math.round(g.preis * 100)) > 1e-6) {
          melde(`${welche}: Preis ${g.preis} hat mehr als 2 Nachkommastellen.`);
        }
      }
    });
  }

  // Icon (optional) – muss es in bilder/icons.svg geben
  if (p.icon !== undefined && p.icon !== "") {
    if (typeof p.icon !== "string") melde('"icon" muss ein Name in Anführungszeichen sein, z. B. "apfel".');
    else if (!ICONS.includes(p.icon)) {
      melde(`Icon "${p.icon}" gibt es nicht. Vorhanden: ${ICONS.join(", ") || "(bilder/icons.svg nicht gefunden)"}.`);
    }
  }

  // Foto (optional) – die Datei muss wirklich existieren
  if (p.foto !== undefined && p.foto !== "") {
    if (typeof p.foto !== "string") melde('"foto" muss ein Dateipfad in Anführungszeichen sein.');
    else if (!fs.existsSync(path.join(ORDNER, p.foto)) || !fs.statSync(path.join(ORDNER, p.foto)).isFile()) {
      melde(`Foto "${p.foto}" nicht gefunden. Liegt die Datei wirklich dort (Groß-/Kleinschreibung beachten)?`);
    }
  }
}

function main() {
  let text;
  try {
    text = fs.readFileSync(DATEI, "utf8");
  } catch {
    console.error("✗ products.json wurde nicht gefunden.");
    process.exit(1);
  }

  let daten;
  try {
    daten = JSON.parse(text.replace(/^﻿/, ""));
  } catch (e) {
    console.error("✗ products.json ist kein gültiges JSON – vermutlich fehlt ein Komma, eine Klammer oder ein Anführungszeichen.");
    console.error("  Genauer Fehler: " + e.message);
    process.exit(1);
  }

  if (!daten || !Array.isArray(daten.produkte)) {
    console.error('✗ products.json muss so aufgebaut sein: { "produkte": [ ... ] }');
    process.exit(1);
  }

  daten.produkte.forEach((p, i) => pruefeProdukt(p, i + 1));
  const produktNamen = daten.produkte.filter((p) => p && typeof p.name === "string").map((p) => p.name);
  const anzahl = pruefeTexte(produktNamen);
  anzahl.saison = pruefeSaison();

  if (fehler.length) {
    console.error(`✗ ${fehler.length} Fehler gefunden:`);
    fehler.forEach((f) => console.error("  – " + f));
    console.error("Die Seite wird erst wieder veröffentlicht, wenn alle Fehler behoben sind.");
    process.exit(1);
  }
  console.log(`✓ products.json ist in Ordnung (${daten.produkte.length} Produkte geprüft).`);
  console.log(`✓ rezepte.json und geschichten.json sind in Ordnung (${anzahl.rezepte} Rezepte, ${anzahl.geschichten} Geschichten).`);
  console.log(`✓ saison.json ist in Ordnung (${anzahl.saison} Produkte im Saisonkalender).`);
}

// ===== saison.json (Saisonkalender) =====
function pruefeSaison() {
  const s = leseJson("saison.json");
  if (!s) return 0;
  if (!Array.isArray(s.produkte)) {
    fehler.push('saison.json muss so aufgebaut sein: { "produkte": [ ... ], "ganzjaehrig": [ ... ] }');
    return 0;
  }
  const monatsListe = (wer, feld, liste) => {
    if (liste === undefined) return [];
    if (!Array.isArray(liste)) {
      fehler.push(`${wer}: "${feld}" muss eine Liste von Monaten sein, z. B. [7,8,9].`);
      return [];
    }
    const falsch = liste.filter((m) => !Number.isInteger(m) || m < 1 || m > 12);
    if (falsch.length) fehler.push(`${wer}: "${feld}" enthält ${falsch.join(", ")} – erlaubt sind nur die Monate 1 bis 12 (1 = Jänner).`);
    return liste.filter((m) => Number.isInteger(m));
  };
  s.produkte.forEach((p, i) => {
    const wer = `saison.json, ${p && istText(p.name) ? `"${p.name}"` : `Produkt Nr. ${i + 1}`}`;
    if (!p || !istText(p.name)) fehler.push(`${wer}: "name" fehlt.`);
    if (!p) return;
    const frisch = monatsListe(wer, "frisch", p.frisch);
    const lager = monatsListe(wer, "lager", p.lager);
    const doppelt = frisch.filter((m) => lager.includes(m));
    if (doppelt.length) fehler.push(`${wer}: Monat ${[...new Set(doppelt)].join(", ")} steht bei "frisch" UND "lager" – bitte nur bei einem.`);
  });
  if (s.ganzjaehrig !== undefined && (!Array.isArray(s.ganzjaehrig) || !s.ganzjaehrig.every(istText))) {
    fehler.push('saison.json: "ganzjaehrig" muss eine Liste von Namen sein, z. B. ["Säfte", "Öle"].');
  }
  return s.produkte.length;
}

// ===== rezepte.json und geschichten.json (Texte für die Startseite) =====
function leseJson(datei) {
  let text;
  try {
    text = fs.readFileSync(path.join(ORDNER, datei), "utf8");
  } catch {
    fehler.push(`${datei} wurde nicht gefunden.`);
    return null;
  }
  try {
    return JSON.parse(text.replace(/^﻿/, ""));
  } catch (e) {
    fehler.push(`${datei} ist kein gültiges JSON – vermutlich fehlt ein Komma, eine Klammer oder ein Anführungszeichen. (${e.message})`);
    return null;
  }
}

const istText = (t) => typeof t === "string" && t.trim() !== "";
const istTextListe = (l) => Array.isArray(l) && l.length > 0 && l.every(istText);

function pruefeTexte(produktNamen) {
  const anzahl = { rezepte: 0, geschichten: 0 };

  const r = leseJson("rezepte.json");
  if (r && !Array.isArray(r.rezepte)) fehler.push('rezepte.json muss so aufgebaut sein: { "rezepte": [ ... ] }');
  else if (r) {
    anzahl.rezepte = r.rezepte.length;
    r.rezepte.forEach((rz, i) => {
      const wer = `rezepte.json, ${rz && istText(rz.titel) ? `"${rz.titel}"` : `Rezept Nr. ${i + 1}`}`;
      if (!rz || !istText(rz.titel)) fehler.push(`${wer}: "titel" fehlt.`);
      if (!rz || !Array.isArray(rz.zutaten) || rz.zutaten.length === 0) fehler.push(`${wer}: braucht eine Liste "zutaten".`);
      else rz.zutaten.forEach((z) => {
        if (!z || !istText(z.text)) fehler.push(`${wer}: eine Zutat hat keinen "text".`);
        else if (z.produkt !== undefined && z.produkt !== "" && !produktNamen.includes(z.produkt)) {
          fehler.push(`${wer}: Zutat "${z.text}" verweist auf das Produkt "${z.produkt}" – das gibt es in products.json nicht (genau gleich schreiben!).`);
        }
      });
      if (!rz || !istTextListe(rz.schritte)) fehler.push(`${wer}: braucht eine Liste "schritte" mit Text.`);
    });
  }

  const g = leseJson("geschichten.json");
  if (g) {
    if (!Array.isArray(g.neuigkeiten)) fehler.push('geschichten.json: "neuigkeiten" muss eine Liste [ ... ] sein.');
    else {
      anzahl.geschichten = g.neuigkeiten.length;
      g.neuigkeiten.forEach((n, i) => {
        const wer = `geschichten.json, ${n && istText(n.titel) ? `"${n.titel}"` : `Geschichte Nr. ${i + 1}`}`;
        if (!n || !istText(n.titel)) fehler.push(`${wer}: "titel" fehlt.`);
        if (!n || !istTextListe(n.text)) fehler.push(`${wer}: braucht eine Liste "text" mit mindestens einem Absatz.`);
        if (n && n.datum && !/^\d{4}-\d{2}-\d{2}$/.test(n.datum)) fehler.push(`${wer}: Datum bitte so schreiben: "2026-03-04" (oder leer lassen: "").`);
      });
    }
    if (g.ueber_uns !== undefined && (!g.ueber_uns || !istTextListe(g.ueber_uns.text))) {
      fehler.push('geschichten.json: "ueber_uns" braucht eine Liste "text" mit mindestens einem Absatz.');
    }
    for (const teil of ["impressum", "datenschutz"]) {
      if (g[teil] === undefined) continue;
      const b = g[teil];
      if (!b || !Array.isArray(b.abschnitte) || b.abschnitte.length === 0) {
        fehler.push(`geschichten.json: "${teil}" braucht eine Liste "abschnitte".`);
        continue;
      }
      b.abschnitte.forEach((a, i) => {
        if (!a || !istTextListe(a.text)) fehler.push(`geschichten.json, ${teil}, Abschnitt ${a && istText(a.titel) ? `"${a.titel}"` : i + 1}: braucht eine Liste "text".`);
      });
    }
  }
  return anzahl;
}

main();
