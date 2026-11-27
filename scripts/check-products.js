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
const EINSATZ_MIN = 0.05;
const EINSATZ_MAX = 5;
const EINSATZ_ARTEN = ["Flasche", "Glas"];

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

  // Einsatz (optional): Betrag 0.05–5 € mit höchstens 2 Nachkommastellen, dazu "einsatz_art"
  if (p.einsatz !== undefined) {
    if (typeof p.einsatz !== "number" || !Number.isFinite(p.einsatz)) {
      melde('"einsatz" muss eine Zahl sein (mit Punkt, z. B. 0.50 – ohne Anführungszeichen und ohne €).');
    } else {
      if (p.einsatz < EINSATZ_MIN || p.einsatz > EINSATZ_MAX) {
        melde(`Einsatz ${p.einsatz} liegt nicht zwischen ${EINSATZ_MIN.toFixed(2)} und ${EINSATZ_MAX.toFixed(2)} €.`);
      }
      if (Math.abs(p.einsatz * 100 - Math.round(p.einsatz * 100)) > 1e-6) {
        melde(`Einsatz ${p.einsatz} hat mehr als 2 Nachkommastellen.`);
      }
    }
    if (p.einsatz_art === undefined) melde(`hat "einsatz", aber kein "einsatz_art" – bitte ${EINSATZ_ARTEN.map((a) => `"${a}"`).join(" oder ")} dazuschreiben.`);
  }
  if (p.einsatz_art !== undefined) {
    if (!EINSATZ_ARTEN.includes(p.einsatz_art)) melde(`"einsatz_art" "${p.einsatz_art}" gibt es nicht. Erlaubt: ${EINSATZ_ARTEN.map((a) => `"${a}"`).join(" oder ")}.`);
    if (p.einsatz === undefined) melde('hat "einsatz_art", aber keinen Betrag "einsatz" (z. B. 0.50).');
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
  const schonerInfo = pruefeBildschirmschoner();

  if (fehler.length) {
    console.error(`✗ ${fehler.length} Fehler gefunden:`);
    fehler.forEach((f) => console.error("  – " + f));
    console.error("Die Seite wird erst wieder veröffentlicht, wenn alle Fehler behoben sind.");
    process.exit(1);
  }
  console.log(`✓ products.json ist in Ordnung (${daten.produkte.length} Produkte geprüft).`);
  console.log(`✓ rezepte.json und geschichten.json sind in Ordnung (${anzahl.rezepte} Rezepte, ${anzahl.geschichten} Geschichten).`);
  console.log(`✓ saison.json ist in Ordnung (${anzahl.saison} Produkte im Saisonkalender).`);
  console.log(`✓ inhalte.json ist in Ordnung (${schonerInfo}).`);
}

// ===== inhalte.json: Jahreszeiten-Look =====
const THEMEN_NAMEN = ["winter", "fruehling", "ostern", "sommer", "herbst", "kuerbis", "advent"];
const TAGE_IM_MONAT = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const istMonatTag = (text) => {
  const m = /^(\d{2})-(\d{2})$/.exec(typeof text === "string" ? text : "");
  return !!m && Number(m[1]) >= 1 && Number(m[1]) <= 12 && Number(m[2]) >= 1 && Number(m[2]) <= TAGE_IM_MONAT[Number(m[1]) - 1];
};
function pruefeJahreszeiten(j) {
  if (j === undefined) return;
  const wer = 'inhalte.json, "jahreszeiten"';
  if (!j || typeof j !== "object" || Array.isArray(j)) return fehler.push(`${wer}: muss ein Block { "aktiv": true, "themen": { ... } } sein.`);
  if (typeof j.aktiv !== "boolean") fehler.push(`${wer}: "aktiv" muss true oder false sein (ohne Anführungszeichen).`);
  if (!j.themen || typeof j.themen !== "object" || Array.isArray(j.themen)) return fehler.push(`${wer}: "themen" muss ein Block { ... } sein.`);
  for (const [name, th] of Object.entries(j.themen)) {
    const w = `${wer}, Thema "${name}"`;
    if (!THEMEN_NAMEN.includes(name)) { fehler.push(`${w}: gibt es nicht. Erlaubt: ${THEMEN_NAMEN.join(", ")}.`); continue; }
    if (!th || typeof th !== "object" || Array.isArray(th)) { fehler.push(`${w}: muss ein Block { ... } sein.`); continue; }
    if (th.aktiv !== undefined && typeof th.aktiv !== "boolean") fehler.push(`${w}: "aktiv" muss true oder false sein.`);
    const auto = th.automatisch === true;
    if (th.automatisch !== undefined && typeof th.automatisch !== "boolean") fehler.push(`${w}: "automatisch" muss true oder false sein.`);
    if (auto && name !== "ostern" && name !== "advent") fehler.push(`${w}: "automatisch" gibt es nur bei "ostern" und "advent".`);
    const felder = auto ? (name === "advent" ? ["bis"] : []) : ["von", "bis"];
    for (const f of felder) {
      if (!istMonatTag(th[f])) fehler.push(`${w}: "${f}" bitte als Monat-Tag schreiben, z. B. "03-01" (1. März).`);
    }
    for (const f of ["von", "bis"]) {
      if (!felder.includes(f) && th[f] !== undefined && !istMonatTag(th[f])) fehler.push(`${w}: "${f}" bitte als Monat-Tag schreiben, z. B. "03-01".`);
    }
  }
}

// ===== inhalte.json: Bildschirmschoner-Einstellungen =====
function pruefeBildschirmschoner() {
  const d = leseJson("inhalte.json");
  if (!d) return "nicht geprüft";
  if (d.einsatz_auszahlen !== undefined && typeof d.einsatz_auszahlen !== "boolean") {
    fehler.push('inhalte.json: "einsatz_auszahlen" muss true oder false sein (ohne Anführungszeichen).');
  }
  const g = d.google_bewertung;
  if (g !== undefined) {
    if (!g || typeof g !== "object" || Array.isArray(g)) {
      fehler.push('inhalte.json, "google_bewertung": muss so aussehen: { "aktiv": true, "url": "https://…" }');
    } else {
      if (typeof g.aktiv !== "boolean") fehler.push('inhalte.json, "google_bewertung": "aktiv" muss true oder false sein (ohne Anführungszeichen).');
      if (typeof g.url !== "string") fehler.push('inhalte.json, "google_bewertung": "url" muss ein Text in Anführungszeichen sein (leer lassen: "").');
      else if (g.url.trim() !== "" && !/^https:\/\/\S+$/.test(g.url.trim())) {
        fehler.push('inhalte.json, "google_bewertung": "url" muss mit https:// beginnen und darf keine Leerzeichen enthalten.');
      }
      if (g.nur_bei_gut !== undefined && typeof g.nur_bei_gut !== "boolean") {
        fehler.push('inhalte.json, "google_bewertung": "nur_bei_gut" muss true oder false sein (ohne Anführungszeichen).');
      }
    }
  }
  pruefeJahreszeiten(d.jahreszeiten);
  const k = d.kinderecke;
  if (k !== undefined) {
    if (!k || typeof k !== "object" || Array.isArray(k)) {
      fehler.push('inhalte.json, "kinderecke": muss so aussehen: { "aktiv": true, "kinder_minuten": 3 }');
    } else {
      if (typeof k.aktiv !== "boolean") fehler.push('inhalte.json, "kinderecke": "aktiv" muss true oder false sein (ohne Anführungszeichen).');
      if (typeof k.kinder_minuten !== "number" || !Number.isInteger(k.kinder_minuten) || k.kinder_minuten < 1 || k.kinder_minuten > 30) {
        fehler.push('inhalte.json, "kinderecke": "kinder_minuten" muss eine ganze Zahl zwischen 1 und 30 sein (ohne Anführungszeichen).');
      }
    }
  }
  const b = d.bildschirmschoner;
  if (b === undefined) return "kein Bildschirmschoner eingestellt";
  const wer = 'inhalte.json, "bildschirmschoner"';
  if (!b || typeof b !== "object" || Array.isArray(b)) {
    fehler.push(`${wer}: muss so aussehen: { "aktiv": true, "start_nach_sekunden": 90, "folie_sekunden": 12, "nacht_von": "22:00", "nacht_bis": "06:00", "nacht_helligkeit": 0.45 }`);
    return "";
  }
  if (typeof b.aktiv !== "boolean") fehler.push(`${wer}: "aktiv" muss true oder false sein (ohne Anführungszeichen).`);
  const ganzeZahl = (feld, min, max) => {
    const w = b[feld];
    if (typeof w !== "number" || !Number.isInteger(w) || w < min || w > max) {
      fehler.push(`${wer}: "${feld}" muss eine ganze Zahl zwischen ${min} und ${max} sein (ohne Anführungszeichen).`);
    }
  };
  ganzeZahl("start_nach_sekunden", 10, 3600);
  ganzeZahl("folie_sekunden", 5, 120);
  const zeit = /^([01]?\d|2[0-3]):[0-5]\d$/;
  for (const feld of ["nacht_von", "nacht_bis"]) {
    if (typeof b[feld] !== "string" || !zeit.test(b[feld].trim())) {
      fehler.push(`${wer}: "${feld}" bitte als Uhrzeit mit Doppelpunkt schreiben, z. B. "22:00".`);
    }
  }
  if (typeof b.nacht_von === "string" && typeof b.nacht_bis === "string" && b.nacht_von.trim() === b.nacht_bis.trim()) {
    fehler.push(`${wer}: "nacht_von" und "nacht_bis" sind gleich – dann wäre nie Nacht. Nicht abdunkeln? Dann "nacht_helligkeit": 1.`);
  }
  const h = b.nacht_helligkeit;
  if (typeof h !== "number" || h < 0.1 || h > 1) {
    fehler.push(`${wer}: "nacht_helligkeit" muss eine Zahl zwischen 0.1 (sehr dunkel) und 1 (gar nicht abgedunkelt) sein, mit Punkt: 0.45`);
  }
  return b.aktiv ? `Bildschirmschoner an, Nacht ${b.nacht_von}–${b.nacht_bis}` : "Bildschirmschoner ausgeschaltet";
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
    for (const teil of ["so_gehts", "so_gehts_en"]) {
      const sg = g[teil];
      if (sg === undefined) continue;
      const wer = `geschichten.json, "${teil}"`;
      if (!sg || typeof sg !== "object" || Array.isArray(sg)) { fehler.push(`${wer}: muss ein Block { ... } sein.`); continue; }
      if (!istText(sg.titel)) fehler.push(`${wer}: "titel" fehlt.`);
      if (!Array.isArray(sg.schritte) || sg.schritte.length === 0) fehler.push(`${wer}: braucht eine Liste "schritte".`);
      else sg.schritte.forEach((s, i) => {
        const w = `${wer}, Schritt ${i + 1}`;
        if (!s || !istText(s.titel)) fehler.push(`${w}: "titel" fehlt.`);
        if (s && s.text !== undefined && typeof s.text !== "string") fehler.push(`${w}: "text" muss ein Text in Anführungszeichen sein.`);
        if (s && !ICONS.includes(s.icon)) fehler.push(`${w}: Icon "${s && s.icon}" gibt es nicht in bilder/icons.svg (z. B. "schritt-ware", "schritt-tablet", "schritt-kassa", "schritt-leergut").`);
        if (s && s.nur_mit_leergut !== undefined && typeof s.nur_mit_leergut !== "boolean") fehler.push(`${w}: "nur_mit_leergut" muss true oder false sein.`);
      });
      if (sg.hinweise !== undefined && !(Array.isArray(sg.hinweise) && sg.hinweise.every((h) => typeof h === "string"))) fehler.push(`${wer}: "hinweise" muss eine Liste von Texten sein.`);
      if (sg.video_hinweis !== undefined && typeof sg.video_hinweis !== "string") fehler.push(`${wer}: "video_hinweis" muss ein Text in Anführungszeichen sein.`);
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
