// Einkaufshelfer – Bachl's Feldgemüse
// Alle Beträge werden intern in CENT gerechnet (ganze Zahlen), damit keine Rundungsfehler entstehen.

// ===== Einstellungen =====
const MAX_BETRAG_CENT = 10000;          // "Anderer Preis": höchstens 100,00 €
const INAKTIV_MS = 2 * 60 * 1000;       // nach 2 Minuten ohne Eingabe zurücksetzen
const WARNUNG_MS = 15 * 1000;           // 15 Sekunden vorher warnen

// ===== Zustand =====
let produkte = [];      // aus products.json
let warenkorb = [];     // Zeilen: { schluessel, name, detail, cent, menge, anders }
let andersZaehler = 0;
let eingabe = "";       // Text im Ziffernfeld, z. B. "3,7"
let letzteAktivitaet = Date.now();
let neuTimer = null;

// ===== Elemente =====
const $ = (id) => document.getElementById(id);
const el = {
  kacheln: $("kacheln"), ladefehler: $("ladefehler"),
  liste: $("liste"), leer: $("leer"), neu: $("neu"), summentext: $("summentext"),
  tastatur: $("tastatur"), anzeige: $("anzeige"), fehler: $("fehler"), name: $("name"),
  abbrechen: $("abbrechen"), hinzufuegen: $("hinzufuegen"),
  warnung: $("warnung"), countdown: $("countdown"), weiter: $("weiter"),
};

// ===== Hilfsfunktionen =====
function euro(cent) {
  return (cent / 100).toFixed(2).replace(".", ",") + " €";
}

function summeCent() {
  return warenkorb.reduce((s, z) => s + z.cent * z.menge, 0);
}

// ===== Produkte laden =====
async function ladeProdukte() {
  try {
    const antwort = await fetch("products.json", { cache: "no-store" });
    if (!antwort.ok) throw new Error("HTTP " + antwort.status);
    const daten = await antwort.json();
    produkte = (daten.produkte || [])
      .filter((p) => p && p.name && typeof p.preis === "number" && p.preis > 0)
      .map((p) => ({
        schluessel: p.name + "|" + (p.einheit || ""),
        name: p.name,
        einheit: p.einheit || "",
        info: p.info || "",
        cent: Math.round(p.preis * 100),
      }));
    el.ladefehler.hidden = true;
    zeichneKacheln();
  } catch (fehler) {
    console.error("Preisliste konnte nicht geladen werden:", fehler);
    if (produkte.length === 0) el.ladefehler.hidden = false;
  }
}

// ===== Kacheln =====
function zeichneKacheln() {
  el.kacheln.innerHTML = "";

  produkte.forEach((p) => {
    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = "kachel";
    knopf.dataset.schluessel = p.schluessel;
    knopf.setAttribute("aria-label", `${p.name}, ${p.einheit}, ${euro(p.cent)}`);

    // Die ganze Kachel ist antippbar; der Preis sieht aus wie ein grüner Knopf
    knopf.append(span("name", p.name));
    if (p.einheit) knopf.append(span("einheit", p.einheit));
    if (p.info) knopf.append(span("info", p.info));
    knopf.append(span("preis", euro(p.cent)));
    const anzahl = span("anzahl", "");
    anzahl.hidden = true;
    knopf.append(anzahl);

    knopf.addEventListener("click", () => produktHinzufuegen(p));
    el.kacheln.append(knopf);
  });

  // Kachel "Anderer Preis"
  const anders = document.createElement("button");
  anders.type = "button";
  anders.className = "kachel kachel-anders";
  anders.append(span("name", "Anderer Preis"), span("einheit", "Preis steht am Produkt"), span("preis", "Betrag eingeben"));
  anders.addEventListener("click", oeffneTastatur);
  el.kacheln.append(anders);

  zeichneWarenkorb();
}

function span(klasse, text) {
  const s = document.createElement("span");
  s.className = klasse;
  s.textContent = text;
  return s;
}

// ===== Warenkorb =====
function produktHinzufuegen(p) {
  const zeile = warenkorb.find((z) => z.schluessel === p.schluessel);
  if (zeile) {
    zeile.menge++;
  } else {
    warenkorb.push({ schluessel: p.schluessel, name: p.name, detail: p.einheit, cent: p.cent, menge: 1, anders: false });
  }
  zeichneWarenkorb();
}

function mengeAendern(schluessel, aenderung) {
  const zeile = warenkorb.find((z) => z.schluessel === schluessel);
  if (!zeile) return;
  zeile.menge += aenderung;
  if (zeile.menge <= 0) entfernen(schluessel);
  else zeichneWarenkorb();
}

function entfernen(schluessel) {
  warenkorb = warenkorb.filter((z) => z.schluessel !== schluessel);
  zeichneWarenkorb();
}

function zeichneWarenkorb() {
  el.liste.innerHTML = "";

  warenkorb.forEach((z) => {
    const li = document.createElement("li");
    li.className = "zeile";

    const name = document.createElement("div");
    name.className = "zeile-name";
    name.textContent = z.name;
    if (z.detail) {
      const klein = document.createElement("small");
      klein.textContent = z.anders ? z.detail : `${z.detail} à ${euro(z.cent)}`;
      name.append(klein);
    }

    const betrag = document.createElement("div");
    betrag.className = "zeile-betrag";
    betrag.textContent = euro(z.cent * z.menge);

    const steuerung = document.createElement("div");
    steuerung.className = "zeile-steuerung";

    if (!z.anders) {
      const minus = rundKnopf("−", `${z.name}: eins weniger`, () => mengeAendern(z.schluessel, -1));
      const menge = span("menge", String(z.menge));
      const plus = rundKnopf("+", `${z.name}: eins mehr`, () => mengeAendern(z.schluessel, +1));
      steuerung.append(minus, menge, plus);
    }

    const loeschen = document.createElement("button");
    loeschen.type = "button";
    loeschen.className = "btn-loeschen";
    loeschen.textContent = "Entfernen";
    loeschen.addEventListener("click", () => entfernen(z.schluessel));
    steuerung.append(loeschen);

    li.append(name, betrag, steuerung);
    el.liste.append(li);
  });

  el.leer.hidden = warenkorb.length > 0;

  // Anzahl-Abzeichen auf den Kacheln aktualisieren
  el.kacheln.querySelectorAll(".kachel[data-schluessel]").forEach((k) => {
    const zeile = warenkorb.find((z) => z.schluessel === k.dataset.schluessel);
    const anzahl = k.querySelector(".anzahl");
    anzahl.hidden = !zeile;
    anzahl.textContent = zeile ? zeile.menge : "";
    k.classList.toggle("gewaehlt", !!zeile);
  });

  // Gesamtsumme
  // Betrag in eigenem <span>, damit er in der Preis-Schrift erscheint
  if (warenkorb.length) {
    el.summentext.replaceChildren("Bitte ", span("betrag", euro(summeCent())), " in die Kassa legen");
  } else {
    el.summentext.textContent = "Tippen Sie auf einen Preis, um zu beginnen";
  }
}

function rundKnopf(text, label, aktion) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn-rund";
  b.textContent = text;
  b.setAttribute("aria-label", label);
  b.addEventListener("click", aktion);
  return b;
}

// ===== Ziffernfeld "Anderer Preis" =====
function oeffneTastatur() {
  eingabe = "";
  el.name.value = "";
  zeigeFehler("");
  zeichneAnzeige();
  el.tastatur.hidden = false;
}

function schliesseTastatur() {
  el.tastatur.hidden = true;
  el.name.blur();
}

function eingabeInCent() {
  if (eingabe === "" || eingabe === ",") return 0;
  const [ganz, komma = ""] = eingabe.split(",");
  return parseInt(ganz || "0", 10) * 100 + parseInt((komma + "00").slice(0, 2), 10);
}

function zeichneAnzeige() {
  el.anzeige.textContent = (eingabe === "" ? "0" : eingabe) + " €";
}

function zeigeFehler(text) {
  el.fehler.textContent = text;
}

function taste(t) {
  zeigeFehler("");
  const [ganz, komma] = eingabe.split(",");
  const hatKomma = eingabe.includes(",");

  if (t === "zurueck") {
    eingabe = eingabe.slice(0, -1);
  } else if (t === ",") {
    if (!hatKomma) eingabe = (eingabe === "" ? "0" : eingabe) + ",";
  } else {
    // Ziffer
    if (hatKomma) {
      if (komma.length >= 2) {
        zeigeFehler("Höchstens 2 Stellen nach dem Komma.");
        return;
      }
      eingabe += t;
    } else if (eingabe === "0") {
      eingabe = t; // führende Null ersetzen
    } else if (ganz.length >= 3) {
      zeigeFehler(`Höchstens ${euro(MAX_BETRAG_CENT)} pro Eintrag.`);
      return;
    } else {
      eingabe += t;
    }
  }

  zeichneAnzeige();
  if (eingabeInCent() > MAX_BETRAG_CENT) {
    zeigeFehler(`Höchstens ${euro(MAX_BETRAG_CENT)} pro Eintrag.`);
  }
}

function andersHinzufuegen() {
  const cent = eingabeInCent();
  if (cent <= 0) {
    zeigeFehler("Bitte einen Betrag eingeben.");
    return;
  }
  if (cent > MAX_BETRAG_CENT) {
    zeigeFehler(`Höchstens ${euro(MAX_BETRAG_CENT)} pro Eintrag.`);
    return;
  }
  const name = el.name.value.trim();
  andersZaehler++;
  warenkorb.push({
    schluessel: "anders-" + andersZaehler,
    name: name || "Anderer Preis",
    detail: name ? "Anderer Preis" : "",
    cent,
    menge: 1,
    anders: true,
  });
  schliesseTastatur();
  zeichneWarenkorb();
}

el.tastatur.querySelectorAll("[data-taste]").forEach((b) => {
  b.addEventListener("click", () => taste(b.dataset.taste));
});
el.abbrechen.addEventListener("click", schliesseTastatur);
el.hinzufuegen.addEventListener("click", andersHinzufuegen);

// Tastatur am PC (praktisch zum Testen)
document.addEventListener("keydown", (e) => {
  if (el.tastatur.hidden) return;
  if (e.key === "Escape") return schliesseTastatur();
  if (e.key === "Enter") return andersHinzufuegen();
  if (e.target === el.name) return; // im Namensfeld normal tippen
  if (/^[0-9]$/.test(e.key)) taste(e.key);
  else if (e.key === "," || e.key === ".") taste(",");
  else if (e.key === "Backspace") taste("zurueck");
});

// ===== Neuer Einkauf (mit Bestätigung) =====
el.neu.addEventListener("click", () => {
  if (warenkorb.length === 0) return;
  if (el.neu.classList.contains("bestaetigen")) {
    zuruecksetzen();
    return;
  }
  el.neu.classList.add("bestaetigen");
  el.neu.textContent = "Wirklich alles löschen? Nochmal tippen";
  neuTimer = setTimeout(neuKnopfNormal, 4000);
});

function neuKnopfNormal() {
  clearTimeout(neuTimer);
  el.neu.classList.remove("bestaetigen");
  el.neu.textContent = "Neuer Einkauf";
}

function zuruecksetzen() {
  warenkorb = [];
  schliesseTastatur();
  el.warnung.hidden = true;
  neuKnopfNormal();
  zeichneWarenkorb();
  window.scrollTo(0, 0);
  ladeProdukte(); // Preise im Hintergrund auffrischen, falls sie geändert wurden
}

// ===== Automatisch zurücksetzen bei Inaktivität =====
function aktivitaet() {
  letzteAktivitaet = Date.now();
}
["pointerdown", "keydown", "input", "scroll"].forEach((ereignis) =>
  window.addEventListener(ereignis, aktivitaet, { capture: true, passive: true })
);
el.weiter.addEventListener("click", () => {
  aktivitaet();
  el.warnung.hidden = true;
});

setInterval(() => {
  const gibtEtwas = warenkorb.length > 0 || !el.tastatur.hidden;
  if (!gibtEtwas) {
    el.warnung.hidden = true;
    return;
  }
  const inaktiv = Date.now() - letzteAktivitaet;
  if (inaktiv >= INAKTIV_MS) {
    zuruecksetzen();
  } else if (inaktiv >= INAKTIV_MS - WARNUNG_MS) {
    el.countdown.textContent = Math.ceil((INAKTIV_MS - inaktiv) / 1000);
    el.warnung.hidden = false;
  } else {
    el.warnung.hidden = true;
  }
}, 500);

// ===== Start =====
ladeProdukte();

// Offline-Funktion (Service Worker) aktivieren
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Service Worker:", e));
  });
}
