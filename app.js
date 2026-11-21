// Einkaufshelfer – Bachl's Feldgemüse
// Alle Beträge werden intern in CENT gerechnet (ganze Zahlen), damit keine Rundungsfehler entstehen.

// ===== Einstellungen =====
const MAX_BETRAG_CENT = 10000;          // "Anderer Preis": höchstens 100,00 €
const INAKTIV_MS = 2 * 60 * 1000;       // nach 2 Minuten ohne Eingabe zurücksetzen
const WARNUNG_MS = 15 * 1000;           // 15 Sekunden vorher warnen
const START_TAB = "beliebt";            // Reiter beim Start und nach jedem Zurücksetzen
const DANKE_SEKUNDEN = 20;              // "Danke"-Seite: danach automatisch neuer Einkauf
const FEEDBACK_AKTIV = true;            // Bewertung (Smileys) auf der "Danke"-Seite anzeigen (wird noch NICHT gespeichert)

// ===== Zustand =====
let produkte = [];      // aus products.json (nur verfügbare)
let warenkorb = [];     // Zeilen: { schluessel, produkt, name, detail, cent, menge, anders }
let aktiverTab = START_TAB;
let andersZaehler = 0;
let eingabe = "";       // Text im Ziffernfeld, z. B. "3,7"
let letzteAktivitaet = Date.now();
let neuTimer = null;
let dankeTimer = null;
let dankeEnde = 0;

// ===== Elemente =====
const $ = (id) => document.getElementById(id);
const el = {
  tabs: document.querySelectorAll(".tab"), produkte: $("produkte"),
  kacheln: $("kacheln"), ladefehler: $("ladefehler"),
  liste: $("liste"), leer: $("leer"), neu: $("neu"), summentext: $("summentext"),
  tastatur: $("tastatur"), anzeige: $("anzeige"), fehler: $("fehler"), name: $("name"),
  abbrechen: $("abbrechen"), hinzufuegen: $("hinzufuegen"),
  warnung: $("warnung"), countdown: $("countdown"), weiter: $("weiter"),
  summeBetrag: $("summe-betrag"), fertig: $("fertig"),
  danke: $("danke"), dankeBetrag: $("danke-betrag"), dankeSekunden: $("danke-sekunden"),
  dankeNeu: $("danke-neu"), dankeZurueck: $("danke-zurueck"),
  belegListe: $("beleg-liste"), belegSumme: $("beleg-summe"), feedback: $("feedback"),
};

// ===== Hilfsfunktionen =====
function euro(cent) {
  return (cent / 100).toFixed(2).replace(".", ",") + " €";
}

function summeCent() {
  return warenkorb.reduce((s, z) => s + z.cent * z.menge, 0);
}

// Kleines Element mit Klasse und Text erzeugen
function neu(tag, klasse, text) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
}

// ===== Produkte laden =====
async function ladeProdukte() {
  try {
    const antwort = await fetch("products.json", { cache: "no-store" });
    if (!antwort.ok) throw new Error("HTTP " + antwort.status);
    const daten = await antwort.json();
    produkte = (daten.produkte || [])
      .filter((p) => p && p.name && p.verfuegbar !== false)   // ausverkaufte ausblenden
      .map((p) => ({
        name: p.name,
        kategorie: p.kategorie || "",
        beliebt: p.beliebt === true,
        info: p.info || "",
        foto: p.foto || "",
        variabel: p.preis_variabel === true,   // Preis steht am Produkt → Ziffernfeld
        groessen: (p.groessen || [])
          .filter((g) => g && typeof g.preis === "number" && g.preis > 0)
          .map((g) => ({
            schluessel: p.name + "|" + (g.einheit || ""),
            einheit: g.einheit || "",
            cent: Math.round(g.preis * 100),
          })),
      }))
      .filter((p) => p.variabel || p.groessen.length > 0);
    el.ladefehler.hidden = true;
    zeichneKacheln();
  } catch (fehler) {
    console.error("Preisliste konnte nicht geladen werden:", fehler);
    if (produkte.length === 0) {
      el.ladefehler.hidden = false;
      setTimeout(ladeProdukte, 5000); // schwaches WLAN: in 5 Sekunden nochmal versuchen
    }
  }
}

// ===== Reiter (Tabs) =====
function waehleTab(tab) {
  aktiverTab = tab;
  el.tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === tab)));
  el.produkte.scrollTop = 0;
  zeichneKacheln();
}

el.tabs.forEach((t) => t.addEventListener("click", () => waehleTab(t.dataset.tab)));

// ===== Kacheln =====
function zeichneKacheln() {
  el.kacheln.innerHTML = "";

  const sichtbar = produkte.filter((p) =>
    aktiverTab === "beliebt" ? p.beliebt : p.kategorie === aktiverTab
  );

  sichtbar.forEach((p) => {
    const kachel = neu("div", "kachel");
    kachel.dataset.produkt = p.name;

    kachel.append(fotoStreifen(p), neu("h3", "name", p.name));
    if (p.info) kachel.append(neu("p", "info", p.info));

    const groessen = neu("div", "groessen");
    if (p.variabel) {
      // Variabler Preis: ein Knopf "Preis eingeben" → Ziffernfeld mit dem Namen schon ausgefüllt
      kachel.append(neu("p", "info", "Preis steht am Produkt"));
      const knopf = neu("button", "groesse groesse-mitte", "Preis eingeben");
      knopf.type = "button";
      knopf.setAttribute("aria-label", `${p.name}: Preis eingeben`);
      knopf.addEventListener("click", () => oeffneTastatur(p.name));
      groessen.append(knopf);
    }
    // Sonst: ein grüner Knopf pro Größe
    p.groessen.forEach((g) => {
      const knopf = neu("button", "groesse");
      knopf.type = "button";
      knopf.setAttribute("aria-label", `${p.name}, ${g.einheit}, ${euro(g.cent)} – in den Warenkorb`);
      knopf.append(neu("span", "g-einheit", g.einheit), neu("span", "g-preis", euro(g.cent)));
      knopf.addEventListener("click", () => groesseHinzufuegen(p, g));
      groessen.append(knopf);
    });
    kachel.append(groessen);

    const anzahl = neu("span", "anzahl");
    anzahl.hidden = true;
    kachel.append(anzahl);

    el.kacheln.append(kachel);
  });

  el.kacheln.append(andersKachel()); // immer die letzte Kachel
  zeichneWarenkorb();
}

// Foto – oder, solange es keins gibt, der Anfangsbuchstabe + "Foto folgt"
function fotoStreifen(p) {
  const streifen = neu("div", "foto");
  const platzhalter = () => {
    streifen.replaceChildren(neu("span", "foto-buchstabe", p.name.charAt(0)), neu("span", "foto-text", "Foto folgt"));
  };
  if (p.foto) {
    const bild = neu("img");
    bild.src = p.foto;
    bild.alt = "";
    bild.loading = "lazy";
    bild.addEventListener("error", platzhalter);
    streifen.append(bild);
  } else {
    platzhalter();
  }
  return streifen;
}

function andersKachel() {
  const kachel = neu("div", "kachel kachel-anders");
  const streifen = neu("div", "foto");
  streifen.innerHTML =
    '<svg class="etikett" viewBox="0 0 64 64" aria-hidden="true"><path d="M8 10h22l26 26-20 20L10 30V10z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="21" cy="21" r="5" fill="none" stroke="currentColor" stroke-width="4"/></svg>';
  const knopf = neu("button", "groesse groesse-mitte", "Betrag eingeben");
  knopf.type = "button";
  knopf.addEventListener("click", () => oeffneTastatur(""));
  const groessen = neu("div", "groessen");
  groessen.append(knopf);
  kachel.append(streifen, neu("h3", "name", "Anderer Preis"), neu("p", "info", "Preis steht am Produkt"), groessen);
  return kachel;
}

// ===== Warenkorb =====
function groesseHinzufuegen(p, g) {
  const zeile = warenkorb.find((z) => z.schluessel === g.schluessel);
  if (zeile) {
    zeile.menge++;
  } else {
    warenkorb.push({ schluessel: g.schluessel, produkt: p.name, name: p.name, detail: g.einheit, cent: g.cent, menge: 1, anders: false });
  }
  zeichneWarenkorb();
}

function mengeAendern(schluessel, aenderung) {
  const zeile = warenkorb.find((z) => z.schluessel === schluessel);
  if (!zeile) return;
  zeile.menge += aenderung;
  if (zeile.menge <= 0) warenkorb = warenkorb.filter((z) => z !== zeile); // bei 0 → Zeile weg
  zeichneWarenkorb();
}

function zeichneWarenkorb() {
  el.liste.innerHTML = "";

  warenkorb.forEach((z) => {
    const li = neu("li", "zeile");

    const name = neu("div", "zeile-name", z.name);
    const detail = z.anders ? (z.detail || euro(z.cent)) : `${z.detail} · ${euro(z.cent)}`;
    name.append(neu("small", "", detail));

    const steuerung = neu("div", "zeile-steuerung");
    steuerung.append(
      rundKnopf("−", `${z.name} ${z.detail}: eins weniger`, () => mengeAendern(z.schluessel, -1)),
      neu("span", "menge", String(z.menge)),
      rundKnopf("+", `${z.name} ${z.detail}: eins mehr`, () => mengeAendern(z.schluessel, +1))
    );

    li.append(name, neu("div", "zeile-betrag", euro(z.cent * z.menge)), steuerung);
    el.liste.append(li);
  });

  el.leer.hidden = warenkorb.length > 0;

  // Orange Abzeichen: wie viele Stück dieses Produkts (alle Größen zusammen) im Warenkorb sind
  el.kacheln.querySelectorAll(".kachel[data-produkt]").forEach((k) => {
    const stueck = warenkorb
      .filter((z) => z.produkt === k.dataset.produkt)
      .reduce((s, z) => s + z.menge, 0);
    const anzahl = k.querySelector(".anzahl");
    anzahl.hidden = stueck === 0;
    anzahl.textContent = stueck || "";
    k.classList.toggle("gewaehlt", stueck > 0);
  });

  // Summe im Warenkorb; "Fertig" nur, wenn etwas drin ist
  if (warenkorb.length) {
    el.summeBetrag.textContent = euro(summeCent());
    el.summeBetrag.classList.remove("summe-leer");
  } else {
    el.summeBetrag.textContent = "Tippen Sie auf ein Produkt";
    el.summeBetrag.classList.add("summe-leer");
  }
  el.fertig.hidden = warenkorb.length === 0;

  // Leiste unten (Handy) – Betrag in eigenem <span>, damit er in der Preis-Schrift erscheint
  if (warenkorb.length) {
    el.summentext.replaceChildren("Bitte ", neu("span", "betrag", euro(summeCent())), " in die Kassa legen");
  } else {
    el.summentext.textContent = "Tippen Sie auf einen Preis, um zu beginnen";
  }
}

function rundKnopf(text, label, aktion) {
  const b = neu("button", "btn-rund", text);
  b.type = "button";
  b.setAttribute("aria-label", label);
  b.addEventListener("click", aktion);
  return b;
}

// ===== Ziffernfeld "Anderer Preis" =====
// produktName: bei Produkten mit variablem Preis (z. B. "Speisekürbis") schon ausgefüllt,
// bei der Kachel "Anderer Preis" leer.
let tastaturProdukt = "";
function oeffneTastatur(produktName = "") {
  tastaturProdukt = produktName;
  eingabe = "";
  el.name.value = produktName;
  $("tastatur-titel").textContent = produktName || "Anderer Preis";
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
    schluessel: "anders-" + andersZaehler,       // jede Eingabe ist eine eigene Zeile
    produkt: tastaturProdukt,                    // damit das Abzeichen auf "Speisekürbis" zählt
    name: name || tastaturProdukt || "Anderer Preis",
    detail: tastaturProdukt ? `Preis am Produkt · ${euro(cent)}` : name ? `Anderer Preis · ${euro(cent)}` : "",
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

// ===== "Danke"-Seite =====
function zeigeDanke() {
  if (warenkorb.length === 0) return;
  neuKnopfNormal();

  // Beleg: "2 × Erdäpfel 2 kg ........ 6,00 €"
  el.belegListe.innerHTML = "";
  warenkorb.forEach((z) => {
    const li = neu("li");
    const text = z.anders ? z.name : `${z.name} ${z.detail}`;
    li.append(
      neu("span", "beleg-name", `${z.menge} × ${text}`),
      neu("span", "beleg-punkte"),
      neu("span", "beleg-preis", euro(z.cent * z.menge))
    );
    el.belegListe.append(li);
  });
  const summe = euro(summeCent());
  el.belegSumme.textContent = summe;
  el.dankeBetrag.textContent = summe;
  el.feedback.hidden = !FEEDBACK_AKTIV;
  bewertungZuruecksetzen();

  el.danke.hidden = false;
  el.danke.scrollTop = 0;

  // Countdown bis zum automatischen Neustart
  dankeEnde = Date.now() + DANKE_SEKUNDEN * 1000;
  clearInterval(dankeTimer);
  dankeTick();
  dankeTimer = setInterval(dankeTick, 250);
}

function dankeTick() {
  const rest = Math.ceil((dankeEnde - Date.now()) / 1000);
  if (rest <= 0) {
    zuruecksetzen();
    return;
  }
  el.dankeSekunden.textContent = rest;
}

function schliesseDanke() {
  clearInterval(dankeTimer);
  dankeTimer = null;
  el.danke.hidden = true;
}

el.fertig.addEventListener("click", zeigeDanke);
el.dankeNeu.addEventListener("click", zuruecksetzen);
el.dankeZurueck.addEventListener("click", () => {
  schliesseDanke();        // Warenkorb bleibt unverändert
  aktivitaet();
});
// ===== Bewertung (Smileys) =====
// Zeigt nur, welcher Smiley gewählt wurde, und bedankt sich. Es wird (noch) nichts gespeichert.
// "Etwas gefehlt? Hier melden" hat noch keine Funktion.
const smileys = document.querySelectorAll(".smiley");
const feedbackTitel = $("feedback-titel");

function bewertungZuruecksetzen() {
  smileys.forEach((s) => s.setAttribute("aria-pressed", "false"));
  feedbackTitel.textContent = "Wie war Ihr Einkauf?";
}

smileys.forEach((s) =>
  s.addEventListener("click", () => {
    smileys.forEach((andere) => andere.setAttribute("aria-pressed", String(andere === s)));
    feedbackTitel.textContent = "Danke für Ihre Bewertung!";
  })
);

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
  schliesseDanke();
  el.warnung.hidden = true;
  neuKnopfNormal();
  waehleTab(START_TAB);
  window.scrollTo(0, 0);
  zeigeStartseite();
  ladeProdukte(); // Preise im Hintergrund auffrischen, falls sie geändert wurden
  ladeInhalte();
}

// ===== Startseite & "Kommt bald" =====
const startseite = $("start");
const bald = $("bald");

function zeigeStartseite() {
  schliesseTastatur();
  bald.hidden = true;
  startseite.hidden = false;
  startseite.scrollTop = 0;
}

function zeigeRechner() {
  startseite.hidden = true;
  bald.hidden = true;
  waehleTab(START_TAB);
  aktivitaet();
}

function zeigeBald(titel) {
  $("bald-titel").textContent = titel;
  startseite.hidden = true;
  bald.hidden = false;
}

$("start-rechner").addEventListener("click", zeigeRechner);
$("zur-startseite").addEventListener("click", zeigeStartseite); // Warenkorb bleibt erhalten
$("bald-zurueck").addEventListener("click", zeigeStartseite);
document.querySelectorAll("[data-bald]").forEach((k) =>
  k.addEventListener("click", () => zeigeBald(k.dataset.bald))
);

// Texte für die Startseite aus inhalte.json (kann man ohne Programmieren ändern)
async function ladeInhalte() {
  try {
    const antwort = await fetch("inhalte.json", { cache: "no-store" });
    if (!antwort.ok) throw new Error("HTTP " + antwort.status);
    const inhalte = await antwort.json();
    setzeTeaser("teaser-rezept", inhalte.rezept_der_woche);
    setzeTeaser("teaser-neu", inhalte.neu_im_laden);
  } catch (fehler) {
    console.warn("inhalte.json konnte nicht geladen werden:", fehler); // Kästchen bleiben dann einfach weg
  }
}

function setzeTeaser(id, text) {
  const box = $(id);
  const leer = typeof text !== "string" || text.trim() === "";
  box.hidden = leer;
  if (!leer) box.querySelector("span").textContent = text.trim();
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
  // Auf der "Danke"-Seite läuft ein eigener Countdown
  if (!el.danke.hidden) {
    el.warnung.hidden = true;
    return;
  }
  const gibtEtwas = warenkorb.length > 0 || !el.tastatur.hidden;
  const inaktiv = Date.now() - letzteAktivitaet;

  // Nichts im Warenkorb: nach 2 Minuten still zurück zur Startseite (falls nicht schon dort)
  if (!gibtEtwas) {
    el.warnung.hidden = true;
    if (inaktiv >= INAKTIV_MS && (startseite.hidden || aktiverTab !== START_TAB)) zuruecksetzen();
    return;
  }
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
ladeInhalte();

// Offline-Funktion (Service Worker) aktivieren
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Service Worker:", e));
  });
}
