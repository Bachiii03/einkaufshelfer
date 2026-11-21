// Prüft products.json, bevor die Seite veröffentlicht wird.
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

function pruefeProdukt(p, nr) {
  const wer = p && typeof p.name === "string" && p.name.trim() ? `"${p.name}"` : `Produkt Nr. ${nr}`;
  const melde = (text) => fehler.push(`${wer}: ${text}`);

  if (!p || typeof p !== "object" || Array.isArray(p)) return melde("ist kein gültiger Eintrag { ... }.");

  // Name
  if (typeof p.name !== "string" || !p.name.trim()) melde('"name" fehlt oder ist leer.');
  else if (p.name.length > NAME_MAX) melde(`Name ist ${p.name.length} Zeichen lang, erlaubt sind höchstens ${NAME_MAX}.`);

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

  if (fehler.length) {
    console.error(`✗ ${fehler.length} Fehler in products.json:`);
    fehler.forEach((f) => console.error("  – " + f));
    console.error("Die Seite wird erst wieder veröffentlicht, wenn alle Fehler behoben sind.");
    process.exit(1);
  }
  console.log(`✓ products.json ist in Ordnung (${daten.produkte.length} Produkte geprüft).`);
}

main();
