// Einkaufshelfer – Bachl's Feldgemüse
// Alle Beträge werden intern in CENT gerechnet (ganze Zahlen), damit keine Rundungsfehler entstehen.

// ===== Einstellungen =====
const MAX_BETRAG_CENT = 10000;          // "Anderer Preis": höchstens 100,00 €
const INAKTIV_MS = 2 * 60 * 1000;       // nach 2 Minuten ohne Eingabe zurücksetzen
const WARNUNG_MS = 15 * 1000;           // 15 Sekunden vorher warnen
const START_TAB = "beliebt";            // Reiter beim Start und nach jedem Zurücksetzen
const DANKE_SEKUNDEN = 20;              // "Danke"-Seite: danach automatisch neuer Einkauf
const FEEDBACK_AKTIV = true;            // Bewertung (Smileys) auf der "Danke"-Seite anzeigen (Laden-Tablet: Wochenbericht per E-Mail)

// "Etwas gefehlt? Hier melden" schickt eine E-Mail an den Hof (über den Dienst Web3Forms).
// Schlüssel von https://web3forms.com hier eintragen. Leer = Knopf wird nicht angezeigt.
// Der Schlüssel darf öffentlich sein: Er schickt Meldungen nur an UNSERE E-Mail-Adresse.
const MELDEN_SCHLUESSEL = "";

// ===== Zustand =====
let produkte = [];      // aus products.json (nur verfügbare)
let alleProduktNamen = []; // alle Namen, auch ausverkaufte (für "Was hat gefehlt?")
let produktIcons = {};  // Name → Icon, auch für ausverkaufte (für die Rezepte)
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
    alleProduktNamen = (daten.produkte || []).filter((p) => p && p.name).map((p) => p.name);
    produktIcons = Object.fromEntries((daten.produkte || []).filter((p) => p && p.name).map((p) => [p.name, p.icon || ""]));
    produkte = (daten.produkte || [])
      .filter((p) => p && p.name && p.verfuegbar !== false)   // ausverkaufte ausblenden
      .map((p) => ({
        name: p.name,
        kategorie: p.kategorie || "",
        beliebt: p.beliebt === true,
        info: p.info || "",
        foto: p.foto || "",
        icon: p.icon || "",
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

// Bild oben auf der Kachel: Foto (falls eingetragen) → sonst Icon aus bilder/icons.svg
// → sonst der Anfangsbuchstabe + "Foto folgt"
const ICON_DATEI = "bilder/icons.svg";

// Ein Icon aus bilder/icons.svg als <svg>-Element
function iconSvg(icon, klasse) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", klasse);
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `${ICON_DATEI}#${icon}`);
  svg.append(use);
  return svg;
}

function fotoStreifen(p) {
  const streifen = neu("div", "foto");
  const ohneFoto = () => {
    if (p.icon) {
      streifen.replaceChildren(iconSvg(p.icon, "produkt-icon"));
    } else {
      streifen.replaceChildren(neu("span", "foto-buchstabe", p.name.charAt(0)), neu("span", "foto-text", "Foto folgt"));
    }
  };
  if (p.foto) {
    const bild = neu("img");
    bild.src = p.foto;
    bild.alt = "";
    bild.loading = "lazy";
    bild.addEventListener("error", ohneFoto);
    streifen.append(bild);
  } else {
    ohneFoto();
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
  meldenZuruecksetzen();

  el.danke.hidden = false;
  el.danke.scrollTop = 0;
  starteDankeCountdown();
}

// Countdown bis zum automatischen Neustart (startet immer wieder bei 20 Sekunden)
function starteDankeCountdown() {
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
// Zeigt, welcher Smiley gewählt wurde, und bedankt sich. Das Laden-Tablet zählt mit
// und schickt einmal pro Woche eine Zusammenfassung (siehe "Wochenbericht" weiter unten).
const smileys = document.querySelectorAll(".smiley");
const feedbackTitel = $("feedback-titel");

function bewertungZuruecksetzen() {
  smileys.forEach((s) => s.setAttribute("aria-pressed", "false"));
  feedbackTitel.textContent = "Wie war Ihr Einkauf?";
  gezaehlteBewertung = null;
}

smileys.forEach((s) =>
  s.addEventListener("click", () => {
    if (s.getAttribute("aria-pressed") === "true") return; // derselbe Smiley nochmal: nichts tun
    smileys.forEach((andere) => andere.setAttribute("aria-pressed", String(andere === s)));
    feedbackTitel.textContent = "Danke für Ihre Bewertung!";
    zaehleBewertung(s.dataset.bewertung);
  })
);

// ===== "Etwas gefehlt? Hier melden" → E-Mail an den Hof =====
// Ablauf: Kunde tippt an, was gefehlt hat → "Senden" → Meldung wird zuerst auf dem Gerät
// gespeichert und dann an Web3Forms geschickt, das uns eine E-Mail sendet.
// Ohne Internet bleibt sie gespeichert und wird später automatisch nachgeschickt.
const MELDEN_AKTIV = MELDEN_SCHLUESSEL.trim() !== "";
const MELDEN_ADRESSE = "https://api.web3forms.com/submit";
const WARTESCHLANGE = "einkaufshelfer-meldungen";  // Speicherplatz auf dem Gerät
const WARTESCHLANGE_MAX = 20;                       // höchstens so viele ungesendete Meldungen aufheben

const melden = {
  knopf: $("melden"), danke: $("melden-danke"), dialog: $("melden-dialog"),
  produkte: $("melden-produkte"), text: $("melden-text"), fehler: $("melden-fehler"),
  abbrechen: $("melden-abbrechen"), senden: $("melden-senden"),
};

// Bei jeder neuen "Danke"-Seite: Knopf wieder zeigen (eine Meldung pro Einkauf)
function meldenZuruecksetzen() {
  schliesseMelden();
  melden.knopf.hidden = !MELDEN_AKTIV;
  melden.danke.hidden = true;
}

function oeffneMelden() {
  clearInterval(dankeTimer);   // "Danke"-Seite schließt sich nicht, solange man meldet
  dankeTimer = null;
  melden.produkte.replaceChildren(
    ...alleProduktNamen.map((name) => {
      const b = neu("button", "melden-produkt", name);
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => {
        b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"));
        melden.fehler.textContent = "";
      });
      return b;
    })
  );
  melden.text.value = "";
  melden.fehler.textContent = "";
  melden.dialog.hidden = false;
  melden.dialog.querySelector(".dialog").scrollTop = 0;
  aktivitaet();
}

function schliesseMelden() {
  melden.dialog.hidden = true;
}

function meldenAbbrechen() {
  schliesseMelden();
  starteDankeCountdown();
}

function meldenAbschicken() {
  const gewaehlt = [...melden.produkte.querySelectorAll('[aria-pressed="true"]')].map((b) => b.textContent);
  const text = melden.text.value.trim();
  if (gewaehlt.length === 0 && text === "") {
    melden.fehler.textContent = "Bitte ein Produkt antippen oder etwas schreiben.";
    return;
  }
  // Zuerst auf dem Gerät speichern – so geht ohne Internet nichts verloren
  const liste = leseWarteschlange();
  liste.push({ id: Date.now() + "-" + Math.random().toString(36).slice(2, 8), zeit: new Date().toISOString(), produkte: gewaehlt, text });
  schreibeWarteschlange(liste);

  schliesseMelden();
  melden.knopf.hidden = true;
  melden.danke.hidden = false;
  starteDankeCountdown();
  sendeWarteschlange(); // im Hintergrund
}

melden.knopf.addEventListener("click", oeffneMelden);
melden.abbrechen.addEventListener("click", meldenAbbrechen);
melden.senden.addEventListener("click", meldenAbschicken);

// --- Warteschlange (localStorage: bleibt auch nach Neustart des Tablets erhalten) ---
function leseWarteschlange() {
  try {
    const liste = JSON.parse(localStorage.getItem(WARTESCHLANGE) || "[]");
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

function schreibeWarteschlange(liste) {
  try {
    localStorage.setItem(WARTESCHLANGE, JSON.stringify(liste.slice(-WARTESCHLANGE_MAX)));
  } catch { /* Speicher voll oder gesperrt – dann eben nicht */ }
}

let sendetGerade = false;
async function sendeWarteschlange() {
  if (!MELDEN_AKTIV || sendetGerade) return;
  sendetGerade = true;
  try {
    for (const meldung of leseWarteschlange()) {
      if (!(await sendeMeldung(meldung))) break;          // kein Internet → später nochmal
      schreibeWarteschlange(leseWarteschlange().filter((m) => m.id !== meldung.id));
    }
  } finally {
    sendetGerade = false;
  }
}

async function sendeMeldung(m) {
  const zeit = new Date(m.zeit).toLocaleString("de-AT", { timeZone: "Europe/Vienna", dateStyle: "medium", timeStyle: "short" });
  const teile = [`Gemeldet am ${zeit} im Einkaufshelfer.`];
  if (m.produkte.length) teile.push("Gefehlt hat:\n" + m.produkte.map((p) => "• " + p).join("\n"));
  if (m.text) teile.push("Nachricht:\n" + m.text);
  const betreff = m.produkte.length ? `Hofladen: ${m.produkte.join(", ")} fehlt` : "Hofladen: Meldung";
  return sendeEmail(betreff, teile.join("\n\n"));
}

// Schickt eine E-Mail an den Hof (über Web3Forms). Ergebnis: true = angekommen.
async function sendeEmail(betreff, nachricht) {
  try {
    const antwort = await fetch(MELDEN_ADRESSE, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: MELDEN_SCHLUESSEL,
        subject: betreff.length > 120 ? betreff.slice(0, 117) + "…" : betreff,
        from_name: "Einkaufshelfer Hofladen",
        message: nachricht,
      }),
    });
    const daten = await antwort.json().catch(() => ({}));
    return antwort.ok && daten.success !== false;
  } catch {
    return false; // offline o. ä.
  }
}

// ===== Wochenbericht der Bewertungen (nur das Tablet im Laden) =====
// Das Laden-Tablet wird einmalig erkannt, wenn es die Seite mit "?laden" am Ende öffnet
// (Start-Adresse in Fully Kiosk: https://bachiii03.github.io/einkaufshelfer/?laden).
// Es zählt die Smileys und schickt alle 7 Tage eine Zusammenfassung per E-Mail.
// Handys der Kunden zählen nicht mit (sonst käme von jedem Handy ein eigener Bericht).
const LADEN_MERKER = "einkaufshelfer-laden";
const BEWERTUNGEN = "einkaufshelfer-bewertungen";
const BERICHT_TAGE = 7;

try {
  if (new URLSearchParams(location.search).has("laden")) localStorage.setItem(LADEN_MERKER, "1");
} catch { /* ohne Speicher kein Wochenbericht */ }
const IST_LADEN = (() => {
  try { return localStorage.getItem(LADEN_MERKER) === "1"; } catch { return false; }
})();

function leseBewertungen() {
  try {
    const b = JSON.parse(localStorage.getItem(BEWERTUNGEN) || "null");
    if (b && b.seit) return { seit: b.seit, gut: b.gut || 0, okay: b.okay || 0, schlecht: b.schlecht || 0 };
  } catch { /* kaputt → neu anfangen */ }
  return { seit: new Date().toISOString(), gut: 0, okay: 0, schlecht: 0 };
}

function schreibeBewertungen(b) {
  try { localStorage.setItem(BEWERTUNGEN, JSON.stringify(b)); } catch { /* egal */ }
}

// Smiley gezählt; wer auf derselben "Danke"-Seite umentscheidet, wird nicht doppelt gezählt
let gezaehlteBewertung = null;
function zaehleBewertung(bewertung) {
  if (!IST_LADEN) return;
  const b = leseBewertungen();
  if (gezaehlteBewertung) b[gezaehlteBewertung] = Math.max(0, b[gezaehlteBewertung] - 1);
  b[bewertung] += 1;
  gezaehlteBewertung = bewertung;
  schreibeBewertungen(b);
}

let berichtLaeuft = false;
async function wochenbericht() {
  if (!IST_LADEN || !MELDEN_AKTIV || berichtLaeuft) return;
  const b = leseBewertungen();
  const seit = new Date(b.seit);
  if (Date.now() - seit.getTime() < BERICHT_TAGE * 24 * 60 * 60 * 1000) return;

  berichtLaeuft = true;
  try {
    const bis = new Date();
    const datum = (d) => d.toLocaleDateString("de-AT", { timeZone: "Europe/Vienna", day: "numeric", month: "numeric", year: "numeric" });
    const summe = b.gut + b.okay + b.schlecht;
    const nachricht = [
      `Bewertungen am Hofladen-Tablet vom ${datum(seit)} bis ${datum(bis)}:`,
      `😊 Gut: ${b.gut}\n😐 Okay: ${b.okay}\n☹️ Schlecht: ${b.schlecht}`,
      summe ? `Insgesamt ${summe} Bewertungen, davon ${Math.round((b.gut / summe) * 100)} % „Gut“.` : "In dieser Woche gab es keine Bewertungen.",
      "Dieser Bericht kommt jede Woche automatisch vom Einkaufshelfer.",
    ].join("\n\n");
    if (await sendeEmail(`Hofladen: Wochenbericht – ${summe} Bewertungen`, nachricht)) {
      // Neue Woche beginnt jetzt. Was während des Sendens dazukam, bleibt erhalten.
      const jetzt = leseBewertungen();
      schreibeBewertungen({
        seit: bis.toISOString(),
        gut: Math.max(0, jetzt.gut - b.gut),
        okay: Math.max(0, jetzt.okay - b.okay),
        schlecht: Math.max(0, jetzt.schlecht - b.schlecht),
      });
    }
  } finally {
    berichtLaeuft = false;
  }
}

// Beim ersten Start auf dem Laden-Tablet: Beginn der ersten Woche merken
try {
  if (IST_LADEN && !localStorage.getItem(BEWERTUNGEN)) schreibeBewertungen(leseBewertungen());
} catch { /* egal */ }

// Im Hintergrund: ungesendete Meldungen nachschicken und ggf. den Wochenbericht senden –
// beim Start, wenn das Internet zurückkommt, und alle 5 Minuten
function hintergrundSenden() {
  sendeWarteschlange();
  wochenbericht();
}
window.addEventListener("online", hintergrundSenden);
setInterval(hintergrundSenden, 5 * 60 * 1000);

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
  schliesseMelden();
  schliesseDanke();
  el.warnung.hidden = true;
  neuKnopfNormal();
  waehleTab(START_TAB);
  window.scrollTo(0, 0);
  zeigeStartseite();
  ladeProdukte(); // Preise im Hintergrund auffrischen, falls sie geändert wurden
  ladeInhalte();
  ladeSeiten();
}

// ===== Startseite & "Kommt bald" =====
const startseite = $("start");
const bald = $("bald");

function zeigeStartseite() {
  schliesseTastatur();
  bald.hidden = true;
  seite.hidden = true;
  startseite.hidden = false;
  startseite.scrollTop = 0;
}

function zeigeRechner() {
  startseite.hidden = true;
  bald.hidden = true;
  seite.hidden = true;
  waehleTab(START_TAB);
  aktivitaet();
}

function zeigeBald(titel) {
  $("bald-titel").textContent = titel;
  startseite.hidden = true;
  seite.hidden = true;
  bald.hidden = false;
}

$("start-rechner").addEventListener("click", zeigeRechner);
$("zur-startseite").addEventListener("click", zeigeStartseite); // Warenkorb bleibt erhalten
$("bald-zurueck").addEventListener("click", zeigeStartseite);
document.querySelectorAll("[data-bald]").forEach((k) =>
  k.addEventListener("click", () => zeigeBald(k.dataset.bald))
);

// ===== Inhaltsseiten: Rezepte, Neuigkeiten & Presse, Über uns =====
// Die Texte stehen in rezepte.json und geschichten.json (ohne Programmieren änderbar).
const seite = $("seite");
const seiteTitel = $("seite-titel");
const seiteKoerper = $("seite-koerper");
const seiteZurueck = $("seite-zurueck");
const SEITEN_TITEL = { rezepte: "Rezepte", neuigkeiten: "Neuigkeiten & Presse", ueber: "Über uns", impressum: "Impressum & Datenschutz" };
let rezepte = [];
let geschichten = { sichtbar: false, neuigkeiten: [], ueber_uns: null, impressum: null, datenschutz: null };
let rezeptDerWoche = "";   // aus inhalte.json – dieses Rezept bekommt ein Abzeichen
let aktuelleSeite = "";

async function ladeSeiten() {
  try {
    const antwort = await fetch("rezepte.json", { cache: "no-store" });
    if (!antwort.ok) throw new Error("HTTP " + antwort.status);
    rezepte = ((await antwort.json()).rezepte || []).filter((r) => r && r.titel);
  } catch (fehler) {
    console.warn("rezepte.json konnte nicht geladen werden:", fehler);
  }
  try {
    const antwort = await fetch("geschichten.json", { cache: "no-store" });
    if (!antwort.ok) throw new Error("HTTP " + antwort.status);
    const daten = await antwort.json();
    geschichten = {
      sichtbar: daten.neuigkeiten_sichtbar === true,   // false → "Neuigkeiten & Presse" zeigt "Kommt bald"
      neuigkeiten: (daten.neuigkeiten || []).filter((g) => g && g.titel),
      ueber_uns: daten.ueber_uns || null,
      impressum: daten.impressum || null,
      datenschutz: daten.datenschutz || null,
    };
  } catch (fehler) {
    console.warn("geschichten.json konnte nicht geladen werden:", fehler);
  }
}

function zeigeSeite(art) {
  // Neuigkeiten vorerst ausgeblendet? (Schalter "neuigkeiten_sichtbar" in geschichten.json)
  if (art === "neuigkeiten" && !geschichten.sichtbar) return zeigeBald(SEITEN_TITEL.neuigkeiten);
  aktuelleSeite = art;
  startseite.hidden = true;
  bald.hidden = true;
  seite.hidden = false;
  if (art === "ueber") zeigeUeberUns();
  else if (art === "impressum") zeigeImpressum();
  else zeichneUebersicht();
  aktivitaet();
}

function seiteAnfang(titel, mitZurueck) {
  seiteTitel.textContent = titel;
  seiteZurueck.hidden = !mitZurueck;
  seiteKoerper.replaceChildren();
  seite.scrollTop = 0;
}

function leerHinweis() {
  seiteKoerper.append(neu("p", "seite-leer", "Hier gibt es gerade nichts zu sehen. Schauen Sie bald wieder vorbei!"));
}

// "2026-03-04" → "4. März 2026"
function datumText(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return isNaN(d) ? "" : d.toLocaleDateString("de-AT", { day: "numeric", month: "long", year: "numeric" });
}

function absaetze(ziel, texte) {
  (texte || []).forEach((t) => ziel.append(neu("p", "absatz", t)));
}

function zitatBlock(zitat) {
  const block = neu("figure", "zitat");
  block.append(neu("blockquote", "", `„${zitat.text}“`));
  if (zitat.von) block.append(neu("figcaption", "", "– " + zitat.von));
  return block;
}

// --- Übersicht (Karten) ---
function zeichneUebersicht() {
  seiteAnfang(SEITEN_TITEL[aktuelleSeite], false);
  const liste = aktuelleSeite === "rezepte" ? rezepte : geschichten.neuigkeiten;
  if (!liste.length) return leerHinweis();

  const karten = neu("div", "karten");
  liste.forEach((eintrag) => {
    const karte = neu("button", "karte");
    karte.type = "button";
    if (aktuelleSeite === "rezepte") {
      const icons = neu("div", "karte-icons");
      (eintrag.zutaten || [])
        .map((z) => produktIcons[z.produkt])
        .filter((icon, i, alle) => icon && alle.indexOf(icon) === i)
        .slice(0, 4)
        .forEach((icon) => icons.append(iconSvg(icon, "karte-icon")));
      karte.append(icons);
      if (rezeptDerWoche && eintrag.titel.trim() === rezeptDerWoche.trim()) karte.append(neu("span", "abzeichen", "Rezept der Woche"));
      karte.append(neu("h2", "karte-titel", eintrag.titel), neu("p", "karte-text", eintrag.kurz || ""));
      karte.append(neu("p", "karte-meta", [eintrag.dauer, eintrag.portionen].filter(Boolean).join(" · ")));
      karte.addEventListener("click", () => zeigeRezept(eintrag));
    } else {
      const meta = [eintrag.art, datumText(eintrag.datum)].filter(Boolean).join(" · ");
      if (meta) karte.append(neu("p", "karte-meta karte-meta-oben", meta));
      karte.append(neu("h2", "karte-titel", eintrag.titel), neu("p", "karte-text", eintrag.kurz || ""));
      karte.append(neu("span", "karte-weiter", "Weiterlesen →"));
      karte.addEventListener("click", () => zeigeGeschichte(eintrag));
    }
    karten.append(karte);
  });
  seiteKoerper.append(karten);
}

// --- Ein Rezept ---
function zeigeRezept(r) {
  seiteAnfang(SEITEN_TITEL.rezepte, true);
  const artikel = neu("article", "artikel");
  const meta = [r.dauer, r.portionen].filter(Boolean).join(" · ");
  if (meta) artikel.append(neu("p", "artikel-meta", meta));
  artikel.append(neu("h2", "artikel-titel", r.titel));
  if (r.kurz) artikel.append(neu("p", "artikel-kurz", r.kurz));

  const spalten = neu("div", "rezept-spalten");
  const zutaten = neu("section", "zutaten");
  zutaten.append(neu("h3", "", "Zutaten"));
  const ul = neu("ul", "zutaten-liste");
  (r.zutaten || []).forEach((z) => {
    const li = neu("li");
    const icon = produktIcons[z.produkt];
    li.append(icon ? iconSvg(icon, "zutat-icon") : neu("span", "zutat-punkt"));
    const text = neu("span", "zutat-text");
    if (z.menge) text.append(neu("strong", "", z.menge + " "));
    text.append(document.createTextNode(z.text || ""));
    li.append(text);
    if (produkte.some((p) => p.name === z.produkt)) li.append(neu("span", "im-laden", "im Laden"));
    ul.append(li);
  });
  zutaten.append(ul);

  const zubereitung = neu("section", "zubereitung");
  zubereitung.append(neu("h3", "", "Zubereitung"));
  const ol = neu("ol", "schritte");
  (r.schritte || []).forEach((s) => ol.append(neu("li", "", s)));
  zubereitung.append(ol);
  if (r.tipp) {
    const tipp = neu("p", "tipp");
    tipp.append(neu("strong", "", "Tipp: "), document.createTextNode(r.tipp));
    zubereitung.append(tipp);
  }
  spalten.append(zutaten, zubereitung);
  artikel.append(spalten);
  seiteKoerper.append(artikel);
}

// --- Eine Geschichte (Neuigkeit oder Presse) ---
function zeigeGeschichte(g) {
  seiteAnfang(SEITEN_TITEL.neuigkeiten, true);
  const artikel = neu("article", "artikel artikel-text");
  const meta = [g.art, datumText(g.datum)].filter(Boolean).join(" · ");
  if (meta) artikel.append(neu("p", "artikel-meta", meta));
  artikel.append(neu("h2", "artikel-titel", g.titel));
  if (g.kurz) artikel.append(neu("p", "artikel-kurz", g.kurz));
  const text = g.text || [];
  absaetze(artikel, text.slice(0, 2));
  if (g.zitat && g.zitat.text) artikel.append(zitatBlock(g.zitat));
  absaetze(artikel, text.slice(2));
  if (g.quelle) artikel.append(neu("p", "quelle", "Quelle: " + g.quelle));
  seiteKoerper.append(artikel);
}

// --- Über uns ---
function zeigeUeberUns() {
  seiteAnfang(SEITEN_TITEL.ueber, false);
  const u = geschichten.ueber_uns;
  if (!u) return leerHinweis();
  const artikel = neu("article", "artikel artikel-text");
  artikel.append(neu("h2", "artikel-titel", u.titel || "Über uns"));
  if (u.untertitel) artikel.append(neu("p", "artikel-kurz", u.untertitel));
  absaetze(artikel, u.text);
  if (u.zitat && u.zitat.text) artikel.append(zitatBlock(u.zitat));

  if (u.fakten && u.fakten.length) {
    const fakten = neu("dl", "fakten");
    u.fakten.forEach((f) => {
      const box = neu("div", "fakt");
      box.append(neu("dt", "", f.titel), neu("dd", "", f.text));
      fakten.append(box);
    });
    artikel.append(fakten);
  }
  if (u.partner && u.partner.length) {
    artikel.append(neu("h3", "partner-titel", "Unsere Partner aus der Region"));
    const partner = neu("ul", "partner");
    u.partner.forEach((p) => {
      const li = neu("li");
      li.append(neu("strong", "", p.produkt), neu("span", "", [p.betrieb, p.ort].filter(Boolean).join(", ")));
      partner.append(li);
    });
    artikel.append(partner);
  }
  seiteKoerper.append(artikel);
}

// --- Impressum & Datenschutz ---
function zeigeImpressum() {
  seiteAnfang(SEITEN_TITEL.impressum, false);
  const bloecke = [geschichten.impressum, geschichten.datenschutz].filter((b) => b && Array.isArray(b.abschnitte));
  if (!bloecke.length) return leerHinweis();
  const artikel = neu("article", "artikel artikel-text rechtliches");
  bloecke.forEach((block) => {
    artikel.append(neu("h2", "artikel-titel", block.titel || ""));
    block.abschnitte.forEach((a) => {
      if (a.titel) artikel.append(neu("h3", "", a.titel));
      (a.text || []).forEach((t) => artikel.append(neu("p", "", t)));
    });
  });
  seiteKoerper.append(artikel);
}

document.querySelectorAll("[data-seite]").forEach((k) =>
  k.addEventListener("click", () => zeigeSeite(k.dataset.seite))
);
$("seite-start").addEventListener("click", zeigeStartseite);
seiteZurueck.addEventListener("click", zeichneUebersicht);

// Texte für die Startseite aus inhalte.json (kann man ohne Programmieren ändern)
async function ladeInhalte() {
  try {
    const antwort = await fetch("inhalte.json", { cache: "no-store" });
    if (!antwort.ok) throw new Error("HTTP " + antwort.status);
    const inhalte = await antwort.json();
    rezeptDerWoche = typeof inhalte.rezept_der_woche === "string" ? inhalte.rezept_der_woche : "";
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
  // "Was hat gefehlt?" offen, aber niemand tippt mehr: nach 2 Minuten neu starten
  if (!melden.dialog.hidden) {
    el.warnung.hidden = true;
    if (Date.now() - letzteAktivitaet >= INAKTIV_MS) zuruecksetzen();
    return;
  }
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
ladeSeiten();
hintergrundSenden(); // falls vom letzten Mal noch Meldungen warten oder der Wochenbericht fällig ist

// Offline-Funktion (Service Worker) aktivieren
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Service Worker:", e));
  });
}
