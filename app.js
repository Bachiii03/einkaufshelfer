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
const MELDEN_SCHLUESSEL = "72ec478f-0144-4ab8-ad59-2925969a1be4";

// ===== Zustand =====
let produkte = [];      // aus products.json (nur verfügbare)
let alleProduktNamen = []; // alle Namen, auch ausverkaufte (für "Was hat gefehlt?")
let produktIcons = {};  // Name → Icon, auch für ausverkaufte (für die Rezepte)
let warenkorb = [];     // Zeilen: { schluessel, produkt, name, detail, cent, menge, anders }
let aktiverTab = START_TAB;
let andersZaehler = 0;
let eingabe = "";       // Text im Ziffernfeld, z. B. "3,7"
let letzteAktivitaet = Date.now();
let leergutArten = [];       // Rückgabe-Arten aus products.json ("einsatz"), z. B. Saftflasche, Honigglas
let einsatzAuszahlen = false; // aus inhalte.json: darf bei mehr Leergut als Einkauf Geld aus der Kassa genommen werden?
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
  const text = (Math.abs(cent) / 100).toFixed(2).replace(".", ",") + " €";
  return cent < 0 ? "−" + text : text;
}

// Einkauf minus Leergut (Leergut-Zeilen haben einen negativen Betrag)
function summeCent() {
  return warenkorb.reduce((s, z) => s + z.cent * z.menge, 0);
}

// Was in die Kassa kommt. Mehr Leergut als Einkauf → 0,00 € ("verrechnet"),
// außer "einsatz_auszahlen" ist in inhalte.json eingeschaltet → Geld aus der Kassa nehmen ("auszahlen").
function zahlBetrag() {
  const netto = summeCent();
  if (netto >= 0) return { cent: netto, auszahlen: false, verrechnet: false };
  if (einsatzAuszahlen) return { cent: netto, auszahlen: true, verrechnet: false };
  return { cent: 0, auszahlen: false, verrechnet: true };
}

// Kleines Element mit Klasse und Text erzeugen
function neu(tag, klasse, text) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
}

// ===== Sprache: Deutsch / English =====
// Der deutsche Text ist das Stichwort. Fehlt eine Übersetzung, bleibt der deutsche Text stehen.
// Produktnamen kommen aus products.json ("name_en", "info_en").
// Rezepte, Über uns, Neuigkeiten und Impressum bleiben deutsch (mit Hinweis).
let sprache = "de";
const ENGLISCH = {
  // Kopf, Reiter, Warenkorb
  "Einkaufshelfer": "Shopping Helper",
  "Tippen Sie auf den Preis – wir rechnen für Sie zusammen.": "Tap a price – we add it up for you.",
  "← Startseite": "← Home",
  "Kategorien": "Categories",
  "★ Beliebt": "★ Popular",
  "Gemüse": "Vegetables",
  "Obst & Getränke": "Fruit & Drinks",
  "Öle": "Oils",
  "Milch & Eier": "Milk & Eggs",
  "Vorrat & Gläser": "Pantry & Jars",
  "Produkte": "Products",
  "Die Preisliste konnte nicht geladen werden. Bitte die Seite neu laden.": "The price list could not be loaded. Please reload the page.",
  "Warenkorb": "Basket",
  "Ihr Einkauf": "Your basket",
  "Noch nichts ausgewählt.": "Nothing selected yet.",
  "Summe": "Total",
  "Fertig – zur Kassa": "Done – pay at the cash box",
  "Neuer Einkauf": "New purchase",
  "Wirklich alles löschen? Nochmal tippen": "Really clear everything? Tap again",
  "Bei Abweichungen gelten die Preise, die direkt bei den Produkten angeschrieben sind.": "If prices differ, the price shown on the product applies.",
  "Tippen Sie auf ein Produkt": "Tap a product",
  "Bitte": "Please put",
  "in die Kassa legen": "into the cash box",
  "Tippen Sie auf einen Preis, um zu beginnen": "Tap a price to start",
  "{name} {detail}: eins weniger": "{name} {detail}: one less",
  "{name} {detail}: eins mehr": "{name} {detail}: one more",
  // Kacheln
  "Preis steht am Produkt": "Price is on the product",
  "Preis eingeben": "Enter price",
  "{name}: Preis eingeben": "{name}: enter price",
  "{name}, {einheit}, {preis} – in den Warenkorb": "{name}, {einheit}, {preis} – add to basket",
  "Foto folgt": "Photo coming soon",
  "Betrag eingeben": "Enter amount",
  "Anderer Preis": "Other price",
  "Preis am Produkt": "Price on product",
  // Ziffernfeld
  "Preis eingeben, der auf dem Produkt steht:": "Enter the price shown on the product:",
  "Letzte Ziffer löschen": "Delete last digit",
  "Name (optional)": "Name (optional)",
  "z. B. Paprika": "e.g. peppers",
  "Abbrechen": "Cancel",
  // Leergut
  "Flasche oder Glas": "Bottle or jar",
  "{betrag} je {art}": "{betrag} per {art}",
  "Flasche": "Bottle",
  "Glas": "Jar",
  "Leergut zurückgeben": "Return empties",
  "Was bringen Sie zurück?": "What are you returning?",
  "Der Einsatz wird von Ihrer Summe abgezogen.": "The deposit is deducted from your total.",
  "Fertig": "Done",
  "Leergut: {anzahl} × {name}": "Empties: {anzahl} × {name}",
  "je {betrag} Einsatz": "{betrag} deposit each",
  "{name}: eins weniger": "{name}: one less",
  "{name}: eins mehr": "{name}: one more",
  "Der Einsatz wird mit Ihrem Einkauf verrechnet. Bitte nehmen Sie kein Geld aus der Kassa.": "The deposit is deducted from your purchase. Please do not take any money from the cash box.",
  "Bitte nehmen Sie": "Please take",
  "aus der Kassa.": "from the cash box.",
  "Hinzufügen": "Add",
  "Höchstens 2 Stellen nach dem Komma.": "At most 2 decimal places.",
  "Höchstens {betrag} pro Eintrag.": "At most {betrag} per entry.",
  "Bitte einen Betrag eingeben.": "Please enter an amount.",
  // Warnung
  "Sind Sie noch da?": "Are you still there?",
  "Der Einkauf wird gelöscht in": "Your basket will be cleared in",
  "Sekunden.": "seconds.",
  "Weiter einkaufen": "Continue shopping",
  // Danke-Seite
  "Danke für Ihren Einkauf!": "Thank you for your purchase!",
  "Bitte legen Sie": "Please put",
  "in die Kassa.": "into the cash box.",
  "Sie zahlen mit einem Schein? Antippen:": "Paying with a banknote? Tap it:",
  "Ihr Wechselgeld:": "Your change:",
  "Zurück zum Einkauf": "Back to shopping",
  "Startet automatisch neu in": "Restarts automatically in",
  "Wie war Ihr Einkauf?": "How was your visit?",
  "Danke für Ihre Bewertung!": "Thank you for your rating!",
  "Gut": "Good",
  "Okay": "Okay",
  "Schlecht": "Bad",
  "Etwas gefehlt? Hier melden": "Something missing? Let us know",
  "✓ Danke für Ihre Meldung! Wir kümmern uns darum.": "✓ Thank you for letting us know! We'll take care of it.",
  // "Was hat gefehlt?"
  "Was hat gefehlt?": "What was missing?",
  "Tippen Sie an, was leer oder ausverkauft war. Wir bekommen Ihre Meldung per E-Mail.": "Tap what was empty or sold out. Your message reaches us by email.",
  "Sonst noch etwas? (optional)": "Anything else? (optional)",
  "z. B. Kürbiskernöl 500 ml war leer": "e.g. pumpkin seed oil 500 ml was empty",
  "Ohne Namen – bitte keine persönlichen Daten eintragen.": "Anonymous – please don't enter any personal data.",
  "Senden": "Send",
  "Bitte ein Produkt antippen oder etwas schreiben.": "Please tap a product or write something.",
  // Startseite
  "Willkommen in unserem Hofladen!": "Welcome to our farm shop!",
  "Selbstbedienung rund um die Uhr. Was möchten Sie tun?": "Self-service around the clock. What would you like to do?",
  "Einkauf zusammenrechnen": "Add up my shopping",
  "Produkte antippen, Summe sehen, in die Kassa legen.": "Tap products, see the total, put the money in the cash box.",
  "Los geht's": "Let's go",
  "Rezepte": "Recipes",
  "Was koche ich heute? Ideen mit unseren Produkten.": "What shall I cook today? Ideas with our products.",
  "Diese Woche:": "This week:",
  "Neuigkeiten & Presse": "News & Press",
  "Was gibt's Neues am Hof? Und was die Zeitung über uns schreibt.": "What's new at the farm? And what the press says about us.",
  "Neu im Laden:": "New in the shop:",
  "Über uns": "About us",
  "Wünsche & Feedback": "Wishes & Feedback",
  "Impressum & Datenschutz": "Legal notice & Privacy",
  "Kommt bald": "Coming soon",
  "Diese Seite ist noch in Arbeit. Schauen Sie bald wieder vorbei!": "This page is still being prepared. Please check back soon!",
  "Zurück zur Startseite": "Back to home",
  // Inhaltsseiten
  "← Übersicht": "← Overview",
  "Diese Seite gibt es nur auf Deutsch.": "This page is only available in German.",
  "Hier gibt es gerade nichts zu sehen. Schauen Sie bald wieder vorbei!": "Nothing here at the moment. Please check back soon!",
  "Rezept der Woche": "Recipe of the week",
  "Weiterlesen →": "Read more →",
  "Zutaten": "Ingredients",
  "Zubereitung": "Method",
  "im Laden": "in the shop",
  "Tipp: ": "Tip: ",
  "Quelle: ": "Source: ",
  "Unsere Partner aus der Region": "Our regional partners",
  // Wünsche & Feedback
  "Ihre Meinung ist uns wichtig": "Your opinion matters to us",
  "Fehlt Ihnen ein Produkt, haben Sie eine Idee oder ist etwas nicht in Ordnung? Schreiben Sie uns – die Nachricht kommt direkt per E-Mail zu uns.":
    "Missing a product, have an idea, or is something not right? Write to us – your message reaches us directly by email.",
  "Worum geht es?": "What is it about?",
  "Produktwunsch": "Product request",
  "Lob": "Praise",
  "Verbesserungsvorschlag": "Suggestion",
  "Problem im Laden": "Problem in the shop",
  "Sonstiges": "Other",
  "Ihre Nachricht": "Your message",
  "z. B. Es wäre toll, wenn es bei Ihnen auch … gäbe.": "e.g. It would be great if you also had …",
  "Möchten Sie eine Antwort? E-Mail oder Telefon (optional)": "Would you like a reply? Email or phone (optional)",
  "Ihre Kontaktdaten verwenden wir nur, um Ihnen zu antworten. Ohne Angabe bleibt Ihre Nachricht anonym.":
    "We only use your contact details to reply to you. Without them, your message stays anonymous.",
  "Bitte schreiben Sie uns kurz, worum es geht.": "Please tell us briefly what it is about.",
  "Heute wurden auf diesem Gerät schon viele Nachrichten gesendet. Bitte versuchen Sie es morgen wieder.":
    "Many messages have already been sent from this device today. Please try again tomorrow.",
  "Danke für Ihre Nachricht!": "Thank you for your message!",
  "Wir lesen jede Nachricht und kümmern uns darum.": "We read every message and take care of it.",
  // Saisonkalender
  "Saisonkalender": "Seasonal calendar",
  "Jetzt im {monat}:": "Now in {monat}:",
  "frisch": "fresh",
  "vom Lager": "from storage",
  "Ganzes Jahr ansehen ›": "See the whole year ›",
  "Was gibt's wann bei uns? Tippen Sie auf einen Monat.": "What's in season when? Tap a month.",
  "frisch geerntet": "freshly harvested",
  "Je nach Wetter und Ernte kann es sich verschieben.": "Depending on weather and harvest, this may shift.",
  "Im {monat}": "In {monat}",
  // Jahreszeiten-Grüße
  "Der Frühling ist da!": "Spring is here!",
  "Frohe Ostern!": "Happy Easter!",
  "Frisch vom Feld!": "Fresh from the field!",
  "Erntezeit!": "Harvest time!",
  "Kürbiszeit!": "Pumpkin time!",
  "Schöne Adventzeit!": "Happy Advent!",
  "Frohe Weihnachten!": "Merry Christmas!",
  "Prosit Neujahr!": "Happy New Year!",
  // Google-Bewertung
  "Gefällt Ihnen unser Hofladen? Erzählen Sie es weiter – mit einer Bewertung auf Google.": "Do you like our farm shop? Tell others – with a review on Google.",
  "Mit dem Handy scannen": "Scan with your phone",
  "Auf Google bewerten": "Review us on Google",
  "Was können wir besser machen?": "What can we do better?",
  // Kinderecke
  "Für Kinder": "For kids",
  "Kinderecke": "Kids' corner",
  "← Zurück": "← Back",
  "Zurück": "Back",
  "Zum Einkauf ({anzahl} Artikel)": "Back to shopping ({anzahl} items)",
  "Gemüse-Memory": "Veggie memory",
  "Finde die Paare!": "Find the pairs!",
  "Was ist das?": "What is it?",
  "Erkennst du es?": "Can you name it?",
  "Auf dem Handy weiterspielen": "Keep playing on your phone",
  "QR-Code mit dem Handy scannen – dann ist das Tablet frei zum Einkaufen.": "Scan the QR code with a phone – then the tablet is free for shopping.",
  "Karte umdrehen": "Turn card over",
  "Super! Alle gefunden!": "Great! You found them all!",
  "Nochmal": "Play again",
  "Frage {nr} von {gesamt}": "Question {nr} of {gesamt}",
  "Vorlesen: {wort}": "Read aloud: {wort}",
  "Richtig!": "Correct!",
  "Fast! Probier's nochmal.": "Almost! Try again.",
  "Toll gemacht!": "Well done!",
  "Super gespielt! Jetzt ist Pause.": "Great playing! Time for a break.",
  "Zur Startseite": "To the start screen",
  // Bildschirmschoner
  "Zum Einkaufen bitte antippen": "Tap to start shopping",
  "Willkommen bei Bachl's Feldgemüse": "Welcome to Bachl's Feldgemüse",
  "Selbstbedienung rund um die Uhr": "Self-service around the clock",
  "Jetzt frisch": "Fresh now",
  "Vom Lager": "From storage",
  "Saison im {monat}": "In season in {monat}",
  "Neu im Laden": "New in the shop",
  "Beliebt bei uns": "Customer favourites",
  "Das ganze Jahr": "All year round",
  "Zum Einkauf": "Go shopping",
  "In diesem Monat gibt es nichts aus der Saison-Liste.": "Nothing from the seasonal list this month.",
  "{name} im {monat}: {art}": "{name} in {monat}: {art}",
  // Namen im Saisonkalender, die es so nicht in products.json gibt
  "Zwiebel": "Onions",
  "Jungzwiebel": "Spring onions",
  "Chinakohl": "Napa cabbage",
  "Säfte": "Juices",
  "Milch & Joghurt": "Milk & yoghurt",
  "Eier": "Eggs",
};

// Text in der aktuellen Sprache. {platzhalter} werden mit "werte" ersetzt.
function t(deutsch, werte) {
  let text = sprache === "en" && ENGLISCH[deutsch] !== undefined ? ENGLISCH[deutsch] : deutsch;
  if (werte) text = text.replace(/\{(\w+)\}/g, (_, k) => (werte[k] !== undefined ? werte[k] : ""));
  return text;
}

// Produktname / Einheit / Info in der aktuellen Sprache
let produktNamenEn = {};
function pName(name) {
  return sprache === "en" && produktNamenEn[name] ? produktNamenEn[name] : name;
}
function einheitText(einheit) {
  if (sprache !== "en") return einheit;
  return einheit
    .replace(/^1 Stück$/, "1 piece")
    .replace(/(\d+) Stück/, "$1 pieces")
    .replace("Glas", "jar")
    .replace("Liter", "litre");
}

// Alle festen Texte der Seite (data-i18n …) in die aktuelle Sprache bringen
function uebersetzeSeite() {
  document.documentElement.lang = sprache;
  const tausche = (e, lesen, schreiben, merker) => {
    if (e.dataset[merker] === undefined) e.dataset[merker] = lesen(e);
    const deutsch = e.dataset[merker];
    schreiben(e, sprache === "de" ? deutsch : t(deutsch.replace(/­/g, "").trim()));
  };
  document.querySelectorAll("[data-i18n]").forEach((e) =>
    tausche(e, (x) => x.textContent, (x, v) => (x.textContent = v), "de"));
  document.querySelectorAll("[data-i18n-ph]").forEach((e) =>
    tausche(e, (x) => x.placeholder, (x, v) => (x.placeholder = v), "dePh"));
  document.querySelectorAll("[data-i18n-aria]").forEach((e) =>
    tausche(e, (x) => x.getAttribute("aria-label"), (x, v) => x.setAttribute("aria-label", v), "deAria"));
  document.querySelectorAll("[data-sprache-knopf]").forEach((b) => {
    b.textContent = sprache === "de" ? "English" : "Deutsch";
    b.lang = sprache === "de" ? "en" : "de";
  });
}

// ===== Produkte laden =====
async function ladeProdukte() {
  try {
    const antwort = await fetch("products.json", { cache: "no-store" });
    if (!antwort.ok) throw new Error("HTTP " + antwort.status);
    const daten = await antwort.json();
    alleProduktNamen = (daten.produkte || []).filter((p) => p && p.name).map((p) => p.name);
    produktIcons = Object.fromEntries((daten.produkte || []).filter((p) => p && p.name).map((p) => [p.name, p.icon || ""]));
    leergutArten = baueLeergutArten(daten.produkte || []);
    produktNamenEn = Object.fromEntries((daten.produkte || []).filter((p) => p && p.name && p.name_en).map((p) => [p.name, p.name_en]));
    produkte = (daten.produkte || [])
      .filter((p) => p && p.name && p.verfuegbar !== false)   // ausverkaufte ausblenden
      .map((p) => ({
        name: p.name,
        kategorie: p.kategorie || "",
        beliebt: p.beliebt === true,
        info: p.info || "",
        infoEn: p.info_en || "",
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

    kachel.append(fotoStreifen(p), neu("h3", "name", pName(p.name)));
    const info = sprache === "en" && p.infoEn ? p.infoEn : p.info;
    if (info) kachel.append(neu("p", "info", info));

    const groessen = neu("div", "groessen");
    if (p.variabel) {
      // Variabler Preis: ein Knopf "Preis eingeben" → Ziffernfeld mit dem Namen schon ausgefüllt
      kachel.append(neu("p", "info", t("Preis steht am Produkt")));
      const knopf = neu("button", "groesse groesse-mitte", t("Preis eingeben"));
      knopf.type = "button";
      knopf.setAttribute("aria-label", t("{name}: Preis eingeben", { name: pName(p.name) }));
      knopf.addEventListener("click", () => oeffneTastatur(p.name));
      groessen.append(knopf);
    }
    // Sonst: ein grüner Knopf pro Größe
    p.groessen.forEach((g) => {
      const knopf = neu("button", "groesse");
      knopf.type = "button";
      knopf.setAttribute("aria-label", t("{name}, {einheit}, {preis} – in den Warenkorb", { name: pName(p.name), einheit: einheitText(g.einheit), preis: euro(g.cent) }));
      knopf.append(neu("span", "g-einheit", einheitText(g.einheit)), neu("span", "g-preis", euro(g.cent)));
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
      streifen.replaceChildren(neu("span", "foto-buchstabe", pName(p.name).charAt(0)), neu("span", "foto-text", t("Foto folgt")));
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
  const knopf = neu("button", "groesse groesse-mitte", t("Betrag eingeben"));
  knopf.type = "button";
  knopf.addEventListener("click", () => oeffneTastatur(""));
  const groessen = neu("div", "groessen");
  groessen.append(knopf);
  kachel.append(streifen, neu("h3", "name", t("Anderer Preis")), neu("p", "info", t("Preis steht am Produkt")), groessen);
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

// Name und Detail einer Warenkorb-Zeile – immer in der aktuellen Sprache
function zeileName(z) {
  if (z.leergut) return t("Leergut: {anzahl} × {name}", { anzahl: z.menge, name: leergutName(z.leergut).kurz });
  if (!z.anders) return pName(z.produkt);
  if (z.eigenerName) return z.eigenerName;                 // selbst eingetippter Name
  return z.produkt ? pName(z.produkt) : t("Anderer Preis");
}
function zeileDetail(z) {
  if (z.leergut) return t("je {betrag} Einsatz", { betrag: euro(-z.cent) });
  if (!z.anders) return einheitText(z.detail);
  if (z.produkt) return `${t("Preis am Produkt")} · ${euro(z.cent)}`;
  if (z.eigenerName) return `${t("Anderer Preis")} · ${euro(z.cent)}`;
  return "";
}

// ===== Leergut zurückgeben (Einsatz) =====
// Alle Produkte mit gleichem "einsatz"-Betrag in products.json werden zu EINER Zeile zusammengefasst
// (z. B. "Flasche oder Glas – 0,50 €"), weil es beim Zurückgeben egal ist, was drin war.
// Gibt es einmal einen anderen Betrag (z. B. 1,00 €), kommt dafür automatisch eine zweite Zeile.
// Im Warenkorb wird Leergut eine eigene Zeile mit negativem Betrag.
const leergutDialog = $("leergut");
const leergutListe = $("leergut-liste");
let leergutEntwurf = {};   // im Dialog: Schlüssel → Anzahl (erst mit "Fertig" übernommen)

function baueLeergutArten(alle) {
  const arten = [];
  alle.forEach((p) => {
    if (!p || !p.name || typeof p.einsatz !== "number" || !(p.einsatz > 0)) return;
    const cent = Math.round(p.einsatz * 100);
    const schluessel = `leergut|${cent}`;
    let a = arten.find((x) => x.schluessel === schluessel);
    if (!a) {
      a = { schluessel, cent, flasche: false, glas: false, produkte: [] };
      arten.push(a);
    }
    if (p.einsatz_art === "Glas") a.glas = true; else a.flasche = true;
    a.produkte.push({ de: p.name.split(" ")[0], en: (p.name_en || "").split(",")[0].trim() });
  });
  return arten.sort((x, y) => x.cent - y.cent);
}

// ["Apfelsaft", "Vollmilch", "Honig"] → "Apfelsaft, Vollmilch oder Honig"
function aufzaehlen(teile, oder) {
  return teile.length < 2 ? teile.join("") : `${teile.slice(0, -1).join(", ")} ${oder} ${teile[teile.length - 1]}`;
}

// Name einer Rückgabe-Zeile in der aktuellen Sprache:
// { kurz: "Flasche oder Glas", zusatz: "Apfelsaft, Traubensaft, Vollmilch oder Honig" }
function leergutName(a) {
  const en = sprache === "en";
  const kurz = a.flasche && a.glas ? t("Flasche oder Glas") : a.glas ? t("Glas") : t("Flasche");
  const namen = a.produkte.map((p) => (en && p.en ? p.en : p.de));
  return { kurz, zusatz: aufzaehlen(namen, en ? "or" : "oder") };
}

function oeffneLeergut() {
  leergutEntwurf = {};
  warenkorb.filter((z) => z.leergut).forEach((z) => { leergutEntwurf[z.schluessel] = z.menge; });
  zeichneLeergutListe();
  leergutDialog.hidden = false;
  aktivitaet();
}

function zeichneLeergutListe() {
  leergutListe.replaceChildren(...leergutArten.map((a) => {
    const n = leergutName(a);
    const anzahl = leergutEntwurf[a.schluessel] || 0;
    const li = neu("li", "leergut-zeile");
    const text = neu("div", "leergut-name");
    text.append(neu("strong", "", `${n.kurz} – ${euro(a.cent)}`));
    if (n.zusatz) text.append(neu("small", "", n.zusatz));
    const minus = rundKnopf("−", t("{name}: eins weniger", { name: n.kurz }), () => leergutZaehlen(a, -1));
    minus.disabled = anzahl === 0;
    const steuerung = neu("div", "leergut-steuerung");
    steuerung.append(minus, neu("span", "menge", String(anzahl)),
      rundKnopf("+", t("{name}: eins mehr", { name: n.kurz }), () => leergutZaehlen(a, +1)));
    li.append(text, steuerung);
    return li;
  }));
}

function leergutZaehlen(a, aenderung) {
  leergutEntwurf[a.schluessel] = Math.max(0, Math.min(99, (leergutEntwurf[a.schluessel] || 0) + aenderung));
  zeichneLeergutListe();
}

function schliesseLeergut() {
  leergutDialog.hidden = true;
}

// "Fertig": Leergut-Zeilen im Warenkorb durch die neue Auswahl ersetzen
function leergutUebernehmen() {
  const einkauf = warenkorb.filter((z) => !z.leergut);
  const rueckgabe = leergutArten
    .filter((a) => (leergutEntwurf[a.schluessel] || 0) > 0)
    .map((a) => ({ schluessel: a.schluessel, produkt: "", detail: "", leergut: a, cent: -a.cent, menge: leergutEntwurf[a.schluessel], anders: false }));
  warenkorb = einkauf.concat(rueckgabe);
  schliesseLeergut();
  zeichneWarenkorb();
  el.liste.scrollTop = el.liste.scrollHeight;   // Leergut-Zeilen stehen unten → dorthin scrollen
}

// Eine Flasche/ein Glas direkt in den Warenkorb (wie ein Produkt antippen)
function leergutEinsDazu(a) {
  const zeile = warenkorb.find((z) => z.schluessel === a.schluessel);
  if (zeile) zeile.menge = Math.min(99, zeile.menge + 1);
  else warenkorb.push({ schluessel: a.schluessel, produkt: "", detail: "", leergut: a, cent: -a.cent, menge: 1, anders: false });
  zeichneWarenkorb();
  el.liste.scrollTop = el.liste.scrollHeight;   // Leergut-Zeilen stehen unten → dorthin scrollen
}

// Nur ein Einsatz-Betrag (z. B. alles 0,50 €) → jeder Tipp = eine Flasche/ein Glas.
// Mehrere Beträge → Dialog zum Auswählen.
$("leergut-knopf").addEventListener("click", () => {
  if (leergutArten.length === 1) leergutEinsDazu(leergutArten[0]);
  else oeffneLeergut();
});
$("leergut-abbrechen").addEventListener("click", schliesseLeergut);
$("leergut-fertig").addEventListener("click", leergutUebernehmen);

function zeichneWarenkorb() {
  el.liste.innerHTML = "";

  warenkorb.forEach((z) => {
    const li = neu("li", z.leergut ? "zeile zeile-leergut" : "zeile");

    const name = neu("div", "zeile-name", zeileName(z));
    const detail = z.leergut ? zeileDetail(z)
      : z.anders ? (zeileDetail(z) || euro(z.cent)) : `${zeileDetail(z)} · ${euro(z.cent)}`;
    name.append(neu("small", "", detail));

    const werte = { name: zeileName(z), detail: zeileDetail(z) };
    const steuerung = neu("div", "zeile-steuerung");
    steuerung.append(
      rundKnopf("−", t("{name} {detail}: eins weniger", werte), () => mengeAendern(z.schluessel, -1)),
      neu("span", "menge", String(z.menge)),
      rundKnopf("+", t("{name} {detail}: eins mehr", werte), () => mengeAendern(z.schluessel, +1))
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

  // Summe im Warenkorb; "Fertig" nur, wenn etwas drin ist (auch nur Leergut ist erlaubt)
  const zahl = zahlBetrag();
  $("leergut-knopf").hidden = leergutArten.length === 0;
  // Erklärzeile unter dem Knopf, bei nur einem Betrag: "−0,50 € je Flasche oder Glas"
  const einzige = leergutArten.length === 1 ? leergutArten[0] : null;
  const art = einzige ? leergutName(einzige).kurz : "";
  $("leergut-info").textContent = einzige
    ? t("{betrag} je {art}", { betrag: euro(-einzige.cent), art: sprache === "en" ? art.toLowerCase() : art })
    : "";
  $("einsatz-hinweis").hidden = !zahl.verrechnet;
  if (warenkorb.length) {
    el.summeBetrag.textContent = euro(zahl.cent);
    el.summeBetrag.classList.remove("summe-leer");
  } else {
    el.summeBetrag.textContent = t("Tippen Sie auf ein Produkt");
    el.summeBetrag.classList.add("summe-leer");
  }
  el.fertig.hidden = warenkorb.length === 0;

  // Leiste unten (Handy) – Betrag in eigenem <span>, damit er in der Preis-Schrift erscheint
  if (warenkorb.length && zahl.auszahlen) {
    el.summentext.replaceChildren(t("Bitte nehmen Sie") + " ", neu("span", "betrag", euro(-zahl.cent)), " " + t("aus der Kassa."));
  } else if (warenkorb.length) {
    el.summentext.replaceChildren(t("Bitte") + " ", neu("span", "betrag", euro(zahl.cent)), " " + t("in die Kassa legen"));
  } else {
    el.summentext.textContent = t("Tippen Sie auf einen Preis, um zu beginnen");
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
  el.name.value = produktName ? pName(produktName) : "";
  $("tastatur-titel").textContent = produktName ? pName(produktName) : t("Anderer Preis");
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
        zeigeFehler(t("Höchstens 2 Stellen nach dem Komma."));
        return;
      }
      eingabe += t;
    } else if (eingabe === "0") {
      eingabe = t; // führende Null ersetzen
    } else if (ganz.length >= 3) {
      zeigeFehler(t("Höchstens {betrag} pro Eintrag.", { betrag: euro(MAX_BETRAG_CENT) }));
      return;
    } else {
      eingabe += t;
    }
  }

  zeichneAnzeige();
  if (eingabeInCent() > MAX_BETRAG_CENT) {
    zeigeFehler(t("Höchstens {betrag} pro Eintrag.", { betrag: euro(MAX_BETRAG_CENT) }));
  }
}

function andersHinzufuegen() {
  const cent = eingabeInCent();
  if (cent <= 0) {
    zeigeFehler(t("Bitte einen Betrag eingeben."));
    return;
  }
  if (cent > MAX_BETRAG_CENT) {
    zeigeFehler(t("Höchstens {betrag} pro Eintrag.", { betrag: euro(MAX_BETRAG_CENT) }));
    return;
  }
  const name = el.name.value.trim();
  // Nur ein wirklich selbst eingetippter Name wird gespeichert – der vorausgefüllte Produktname nicht
  // (dann erscheint der Name später immer in der gerade gewählten Sprache).
  const eigenerName = name && name !== tastaturProdukt && name !== pName(tastaturProdukt) ? name : "";
  andersZaehler++;
  warenkorb.push({
    schluessel: "anders-" + andersZaehler,       // jede Eingabe ist eine eigene Zeile
    produkt: tastaturProdukt,                    // damit das Abzeichen auf "Speisekürbis" zählt
    eigenerName,
    detail: "",
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
    const li = neu("li", z.leergut ? "beleg-leergut" : "");
    const text = z.leergut ? zeileName(z)
      : `${z.menge} × ${z.anders ? zeileName(z) : `${zeileName(z)} ${zeileDetail(z)}`}`;
    li.append(
      neu("span", "beleg-name", text),
      neu("span", "beleg-punkte"),
      neu("span", "beleg-preis", euro(z.cent * z.menge))
    );
    el.belegListe.append(li);
  });
  // "Bitte legen Sie X in die Kassa." – oder bei Auszahlung "Bitte nehmen Sie X aus der Kassa."
  const zahl = zahlBetrag();
  el.belegSumme.textContent = euro(zahl.cent);
  $("danke-vor").textContent = t(zahl.auszahlen ? "Bitte nehmen Sie" : "Bitte legen Sie");
  el.dankeBetrag.textContent = euro(Math.abs(zahl.cent));
  $("danke-nach").textContent = t(zahl.auszahlen ? "aus der Kassa." : "in die Kassa.");
  el.dankeBetrag.classList.toggle("danke-auszahlen", zahl.auszahlen);
  $("danke-hinweis").hidden = !zahl.verrechnet;
  el.feedback.hidden = !FEEDBACK_AKTIV;
  dankeSekunden = DANKE_SEKUNDEN;
  bewertungZuruecksetzen();
  meldenZuruecksetzen();
  zeichneWechsel(zahl.cent);

  el.danke.hidden = false;
  el.danke.scrollTop = 0;
  starteDankeCountdown();
}

// ===== Wechselgeld-Hilfe =====
// Zeigt die nächsten 3 Scheine, die größer als die Summe sind. Antippen → Wechselgeld.
const SCHEINE_CENT = [500, 1000, 2000, 5000, 10000];

function zeichneWechsel(summe) {
  // Nichts zu zahlen (0,00 € oder Geld aus der Kassa) → keine Wechselgeld-Hilfe
  const passend = summe > 0 ? SCHEINE_CENT.filter((s) => s > summe).slice(0, 3) : [];
  const box = $("wechsel-scheine");
  const ergebnis = $("wechsel-ergebnis");
  $("wechsel").hidden = passend.length === 0;   // über 100 € → keine Wechselgeld-Hilfe
  ergebnis.hidden = true;
  box.replaceChildren(
    ...passend.map((schein) => {
      const b = neu("button", "wechsel-schein", euro(schein).replace(",00 €", " €"));
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => {
        box.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        $("wechsel-betrag").textContent = euro(schein - summe);
        ergebnis.hidden = false;
        starteDankeCountdown();   // genug Zeit zum Nehmen des Wechselgelds
      });
      return b;
    })
  );
}

// Countdown bis zum automatischen Neustart (startet immer wieder bei 20 Sekunden)
let dankeSekunden = DANKE_SEKUNDEN;   // 20 s, solange der Google-Kasten zu sehen ist 45 s
function starteDankeCountdown() {
  dankeEnde = Date.now() + dankeSekunden * 1000;
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
  feedbackTitel.textContent = t("Wie war Ihr Einkauf?");
  gezaehlteBewertung = null;
  $("nach-bewertung").hidden = true;
  $("besser-box").hidden = true;
  $("google-box").hidden = true;
}

// ===== Google-Bewertung (Einstellung in inhalte.json → "google_bewertung") =====
// Nach JEDEM Smiley dieselbe ruhige Einladung – keine Belohnung, kein Druck, kein "5 Sterne".
// Laden-Tablet: QR-Code zum Scannen (bilder/google-bewertung-qr.svg, entsteht beim Veröffentlichen).
// Handy: Knopf, der den Link öffnet. Bei "Schlecht" zusätzlich zuerst "Was können wir besser machen?".
const DANKE_SEKUNDEN_GOOGLE = 45;    // Zeit zum Scannen
let googleEinst = null;

function googleUrl() {
  const g = googleEinst;
  const url = g && g.aktiv === true && typeof g.url === "string" ? g.url.trim() : "";
  return /^https:\/\/\S+$/.test(url) ? url : "";
}

function zeigeNachBewertung(bewertung) {
  const url = googleUrl();
  const google = $("google-box");
  $("besser-box").hidden = bewertung !== "schlecht";
  google.hidden = !url;
  if (url) {
    const qr = $("google-qr"), bild = $("google-qr-bild"), link = $("google-link");
    qr.hidden = !IST_LADEN;
    link.hidden = IST_LADEN;          // am Laden-Tablet keine Links, die die Seite verlassen
    link.href = url;
    if (IST_LADEN) {
      bild.onerror = () => { google.hidden = true; aktualisiereNachBewertung(); };   // QR fehlt → Kasten weg
      bild.src = "bilder/google-bewertung-qr.svg";
    }
    dankeSekunden = DANKE_SEKUNDEN_GOOGLE;
    starteDankeCountdown();
  }
  aktualisiereNachBewertung();
  // ganz sichtbar machen (bei "Schlecht" sind es zwei Kästen – sonst läge der QR-Code unter dem Rand)
  const box = $("nach-bewertung");
  if (!box.hidden && box.scrollIntoView) box.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
function aktualisiereNachBewertung() {
  $("nach-bewertung").hidden = $("besser-box").hidden && $("google-box").hidden;
}

// "Wünsche & Feedback" aus der Danke-Seite: Einkauf abschließen, Sprache behalten
$("besser-knopf").addEventListener("click", () => {
  const bisher = sprache;
  zuruecksetzen();
  if (bisher !== "de") setzeSprache(bisher);
  zeigeSeite("wuensche");
});

smileys.forEach((s) =>
  s.addEventListener("click", () => {
    if (s.getAttribute("aria-pressed") === "true") return; // derselbe Smiley nochmal: nichts tun
    smileys.forEach((andere) => andere.setAttribute("aria-pressed", String(andere === s)));
    feedbackTitel.textContent = t("Danke für Ihre Bewertung!");
    zaehleBewertung(s.dataset.bewertung);
    zeigeNachBewertung(s.dataset.bewertung);
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
      const b = neu("button", "melden-produkt", pName(name));
      b.type = "button";
      b.dataset.name = name;   // für die E-Mail an den Hof immer der deutsche Name
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
  const gewaehlt = [...melden.produkte.querySelectorAll('[aria-pressed="true"]')].map((b) => b.dataset.name);
  const text = melden.text.value.trim();
  if (gewaehlt.length === 0 && text === "") {
    melden.fehler.textContent = t("Bitte ein Produkt antippen oder etwas schreiben.");
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
  if (m.art === "feedback") {
    // Nachricht aus "Wünsche & Feedback"
    const teile = [
      `Nachricht vom ${zeit} aus „Wünsche & Feedback“ im Einkaufshelfer.`,
      `Thema: ${m.thema}`,
      "Nachricht:\n" + m.text,
      m.kontakt ? `Kontakt für eine Antwort: ${m.kontakt}` : "Keine Kontaktangabe (anonym).",
    ];
    return sendeEmail(`Hofladen-Feedback: ${m.thema}`, teile.join("\n\n"));
  }
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

// iPad: "Zum Home-Bildschirm" nimmt die Start-Adresse aus dem Manifest. Auf dem Laden-Tablet
// eine Variante mit "?laden" verwenden – sonst wüsste die Home-Bildschirm-App nicht,
// dass sie das Laden-Tablet ist (sie hat einen eigenen Speicher, getrennt von Safari).
if (IST_LADEN || new URLSearchParams(location.search).has("laden")) {
  const manifest = document.querySelector('link[rel="manifest"]');
  if (manifest) manifest.href = "manifest-laden.json";
}

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
  el.neu.textContent = t("Wirklich alles löschen? Nochmal tippen");
  neuTimer = setTimeout(neuKnopfNormal, 4000);
});

function neuKnopfNormal() {
  clearTimeout(neuTimer);
  el.neu.classList.remove("bestaetigen");
  el.neu.textContent = t("Neuer Einkauf");
}

function zuruecksetzen() {
  warenkorb = [];
  // Nächster Kunde beginnt wieder auf Deutsch
  if (sprache !== "de") {
    sprache = "de";
    uebersetzeSeite();
  }
  schliesseTastatur();
  schliesseLeergut();
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
  ladeSaison();
}

// ===== Startseite & "Kommt bald" =====
const startseite = $("start");
const bald = $("bald");

function zeigeStartseite() {
  schliesseTastatur();
  bald.hidden = true;
  seite.hidden = true;
  saisonSeite.hidden = true;
  verlasseKinder();
  startseite.hidden = false;
  startseite.scrollTop = 0;
  zeichneSaisonLeiste();   // immer der aktuelle Monat
}

function zeigeRechner() {
  startseite.hidden = true;
  bald.hidden = true;
  seite.hidden = true;
  saisonSeite.hidden = true;
  verlasseKinder();
  waehleTab(START_TAB);
  aktivitaet();
}

let baldTitel = "";
function zeigeBald(titel) {
  baldTitel = titel;
  $("bald-titel").textContent = t(titel);
  startseite.hidden = true;
  seite.hidden = true;
  saisonSeite.hidden = true;
  verlasseKinder();
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
const SEITEN_TITEL = { rezepte: "Rezepte", neuigkeiten: "Neuigkeiten & Presse", ueber: "Über uns", impressum: "Impressum & Datenschutz", wuensche: "Wünsche & Feedback" };
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
  // Wünsche & Feedback braucht den Web3Forms-Schlüssel – ohne ihn "Kommt bald"
  if (art === "wuensche" && !MELDEN_AKTIV) return zeigeBald(SEITEN_TITEL.wuensche);
  aktuelleSeite = art;
  startseite.hidden = true;
  bald.hidden = true;
  saisonSeite.hidden = true;
  verlasseKinder();
  seite.hidden = false;
  if (art === "ueber") zeigeUeberUns();
  else if (art === "impressum") zeigeImpressum();
  else if (art === "wuensche") zeigeWuensche();
  else zeichneUebersicht();
  aktivitaet();
}

// nurDeutsch: Inhalt gibt es nur auf Deutsch → auf Englisch kommt oben ein Hinweis
function seiteAnfang(titel, mitZurueck, nurDeutsch = true) {
  seiteTitel.textContent = t(titel);
  seiteZurueck.hidden = !mitZurueck;
  seiteKoerper.replaceChildren();
  if (nurDeutsch && sprache === "en") seiteKoerper.append(neu("p", "nur-deutsch", t("Diese Seite gibt es nur auf Deutsch.")));
  seite.scrollTop = 0;
}

function leerHinweis() {
  seiteKoerper.append(neu("p", "seite-leer", t("Hier gibt es gerade nichts zu sehen. Schauen Sie bald wieder vorbei!")));
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
      if (rezeptDerWoche && eintrag.titel.trim() === rezeptDerWoche.trim()) karte.append(neu("span", "abzeichen", t("Rezept der Woche")));
      karte.append(neu("h2", "karte-titel", eintrag.titel), neu("p", "karte-text", eintrag.kurz || ""));
      karte.append(neu("p", "karte-meta", [eintrag.dauer, eintrag.portionen].filter(Boolean).join(" · ")));
      karte.addEventListener("click", () => zeigeRezept(eintrag));
    } else {
      const meta = [eintrag.art, datumText(eintrag.datum)].filter(Boolean).join(" · ");
      if (meta) karte.append(neu("p", "karte-meta karte-meta-oben", meta));
      karte.append(neu("h2", "karte-titel", eintrag.titel), neu("p", "karte-text", eintrag.kurz || ""));
      karte.append(neu("span", "karte-weiter", t("Weiterlesen →")));
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
  zutaten.append(neu("h3", "", t("Zutaten")));
  const ul = neu("ul", "zutaten-liste");
  (r.zutaten || []).forEach((z) => {
    const li = neu("li");
    const icon = produktIcons[z.produkt];
    li.append(icon ? iconSvg(icon, "zutat-icon") : neu("span", "zutat-punkt"));
    const text = neu("span", "zutat-text");
    if (z.menge) text.append(neu("strong", "", z.menge + " "));
    text.append(document.createTextNode(z.text || ""));
    li.append(text);
    if (produkte.some((p) => p.name === z.produkt)) li.append(neu("span", "im-laden", t("im Laden")));
    ul.append(li);
  });
  zutaten.append(ul);

  const zubereitung = neu("section", "zubereitung");
  zubereitung.append(neu("h3", "", t("Zubereitung")));
  const ol = neu("ol", "schritte");
  (r.schritte || []).forEach((s) => ol.append(neu("li", "", s)));
  zubereitung.append(ol);
  if (r.tipp) {
    const tipp = neu("p", "tipp");
    tipp.append(neu("strong", "", t("Tipp: ")), document.createTextNode(r.tipp));
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
  if (g.quelle) artikel.append(neu("p", "quelle", t("Quelle: ") + g.quelle));
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
    artikel.append(neu("h3", "partner-titel", t("Unsere Partner aus der Region")));
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

// --- Wünsche & Feedback (per E-Mail über Web3Forms, wie "Etwas gefehlt?") ---
const FEEDBACK_THEMEN = ["Produktwunsch", "Lob", "Verbesserungsvorschlag", "Problem im Laden", "Sonstiges"];
const FEEDBACK_PRO_TAG = 10;                         // höchstens so viele Nachrichten pro Gerät und Tag
const FEEDBACK_ZAEHLER = "einkaufshelfer-feedback-zaehler";

function feedbackHeute() {
  const heute = new Date().toISOString().slice(0, 10);
  try {
    const z = JSON.parse(localStorage.getItem(FEEDBACK_ZAEHLER) || "null");
    return z && z.tag === heute ? z.anzahl : 0;
  } catch {
    return 0;
  }
}

function feedbackZaehlen() {
  const heute = new Date().toISOString().slice(0, 10);
  try { localStorage.setItem(FEEDBACK_ZAEHLER, JSON.stringify({ tag: heute, anzahl: feedbackHeute() + 1 })); } catch { /* egal */ }
}

function zeigeWuensche() {
  seiteAnfang(SEITEN_TITEL.wuensche, false, false);   // komplett übersetzt → kein "nur Deutsch"-Hinweis
  const artikel = neu("article", "artikel artikel-text wunsch");
  artikel.append(
    neu("h2", "artikel-titel", t("Ihre Meinung ist uns wichtig")),
    neu("p", "artikel-kurz", t("Fehlt Ihnen ein Produkt, haben Sie eine Idee oder ist etwas nicht in Ordnung? Schreiben Sie uns – die Nachricht kommt direkt per E-Mail zu uns."))
  );

  artikel.append(neu("h3", "", t("Worum geht es?")));
  const themen = neu("div", "wunsch-themen");
  let thema = "";   // immer der deutsche Name (für die E-Mail an den Hof)
  FEEDBACK_THEMEN.forEach((th) => {
    const b = neu("button", "melden-produkt", t(th));
    b.type = "button";
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => {
      themen.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      thema = th;
      fehler.textContent = "";
    });
    themen.append(b);
  });
  artikel.append(themen);

  const textFeld = neu("label", "namensfeld", t("Ihre Nachricht"));
  const text = neu("textarea");
  text.id = "wunsch-text";
  text.rows = 4;
  text.maxLength = 600;
  text.placeholder = t("z. B. Es wäre toll, wenn es bei Ihnen auch … gäbe.");
  textFeld.append(text);

  const kontaktFeld = neu("label", "namensfeld", t("Möchten Sie eine Antwort? E-Mail oder Telefon (optional)"));
  const kontakt = neu("input");
  kontakt.id = "wunsch-kontakt";
  kontakt.type = "text";
  kontakt.maxLength = 100;
  kontakt.autocomplete = "off";
  kontaktFeld.append(kontakt);

  const hinweis = neu("p", "melden-hinweis", t("Ihre Kontaktdaten verwenden wir nur, um Ihnen zu antworten. Ohne Angabe bleibt Ihre Nachricht anonym."));
  const fehler = neu("p", "fehler");
  fehler.setAttribute("role", "alert");
  const senden = neu("button", "btn-haupt wunsch-senden", t("Senden"));
  senden.type = "button";
  artikel.append(textFeld, kontaktFeld, hinweis, fehler, senden);

  senden.addEventListener("click", () => {
    const nachricht = text.value.trim();
    if (nachricht.length < 3) {
      fehler.textContent = t("Bitte schreiben Sie uns kurz, worum es geht.");
      return;
    }
    if (feedbackHeute() >= FEEDBACK_PRO_TAG) {
      fehler.textContent = t("Heute wurden auf diesem Gerät schon viele Nachrichten gesendet. Bitte versuchen Sie es morgen wieder.");
      return;
    }
    // Wie bei "Etwas gefehlt?": erst auf dem Gerät speichern, dann senden
    const liste = leseWarteschlange();
    liste.push({
      id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      zeit: new Date().toISOString(),
      art: "feedback",
      thema: thema || "Sonstiges",
      text: nachricht,
      kontakt: kontakt.value.trim(),
    });
    schreibeWarteschlange(liste);
    feedbackZaehlen();
    sendeWarteschlange();

    // Danke-Ansicht
    artikel.replaceChildren(
      neu("h2", "artikel-titel", t("Danke für Ihre Nachricht!")),
      neu("p", "artikel-kurz", t("Wir lesen jede Nachricht und kümmern uns darum."))
    );
    const zurueck = neu("button", "btn-haupt wunsch-senden", t("Zurück zur Startseite"));
    zurueck.type = "button";
    zurueck.addEventListener("click", zeigeStartseite);
    artikel.append(zurueck);
    seite.scrollTop = 0;
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
    neuImLaden = typeof inhalte.neu_im_laden === "string" ? inhalte.neu_im_laden : "";
    einsatzAuszahlen = inhalte.einsatz_auszahlen === true;
    kinderEinstellen(inhalte.kinderecke);
    googleEinst = inhalte.google_bewertung && typeof inhalte.google_bewertung === "object" ? inhalte.google_bewertung : null;
    jahreszeitenEinst = inhalte.jahreszeiten && typeof inhalte.jahreszeiten === "object" ? inhalte.jahreszeiten : null;
    wendeJahreszeitAn();
    zeichneWarenkorb();   // Summe nach der Einsatz-Regel neu
    schonerEinst = inhalte.bildschirmschoner && typeof inhalte.bildschirmschoner === "object" ? inhalte.bildschirmschoner : null;
  } catch (fehler) {
    console.warn("inhalte.json konnte nicht geladen werden:", fehler); // Kästchen bleiben dann einfach weg
    kinderEinstellen(kinderEinst);
    wendeJahreszeitAn();
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
  const gibtEtwas = warenkorb.length > 0 || !el.tastatur.hidden || !leergutDialog.hidden;
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

// ===== Bildschirmschoner (nur Laden-Tablet) =====
// Einstellungen in inhalte.json: "bildschirmschoner": { "aktiv", "start_nach_sekunden", "folie_sekunden",
// "nacht_von", "nacht_bis", "nacht_helligkeit" }.
// Startet, wenn die Startseite unberührt dasteht (leerer Warenkorb, kein Ziffernfeld, keine Danke-Seite) –
// Tag und Nacht. Nachts liegt eine dunkle Schicht darüber. Das erste Antippen beendet ihn nur:
// Der Schoner liegt beim Ausblenden noch über allem und fängt den Tipp ab, darunter passiert nichts.
// Testen: "?schonertest" startet nach 5 Sekunden, "?nachttest" tut so, als wäre Nacht.
const TEST_PARAMETER = new URLSearchParams(location.search);
const SCHONER_TEST = TEST_PARAMETER.has("schonertest");
const NACHT_TEST = TEST_PARAMETER.has("nachttest");
const schoner = $("schoner");
const schonerBuehne = $("schoner-buehne");
const schonerFuss = $("schoner-fuss");
const schonerDimmer = $("schoner-dimmer");
let schonerEinst = null;    // aus inhalte.json
let neuImLaden = "";        // aus inhalte.json
let schonerAn = false;
let ruheSeit = null;        // seit wann die Startseite unberührt dasteht
let folienNr = -1;          // welche Folie gerade zu sehen ist
let produktSeite = 0;       // welche Gruppe beliebter Produkte als Nächstes kommt
let folienTimer = null;
let schonerAusTimer = null;

if (window.fully) {
  console.log("Fully Kiosk erkannt – der Bildschirmschoner läuft vorerst in der Seite (keine Fully-Funktionen).");
}

// Zahl aus den Einstellungen – ungültig oder außerhalb des Bereichs → Standardwert
function schonerZahl(name, standard, min, max) {
  const w = Number(schonerEinst && schonerEinst[name]);
  return Number.isFinite(w) && w >= min && w <= max ? w : standard;
}

// "22:00" → 1320 (Minuten seit Mitternacht); ungültig → null
function minutenAus(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(typeof text === "string" ? text.trim() : "");
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

// Liegt "jetzt" zwischen "von" und "bis"? Geht auch über Mitternacht (22:00 – 06:00).
function imZeitraum(jetzt, von, bis) {
  if (von === null || bis === null || von === bis) return false;
  return von < bis ? jetzt >= von && jetzt < bis : jetzt >= von || jetzt < bis;
}

function istNachtzeit() {
  if (NACHT_TEST) return true;
  if (!schonerEinst) return false;
  const d = new Date();
  return imZeitraum(d.getHours() * 60 + d.getMinutes(), minutenAus(schonerEinst.nacht_von), minutenAus(schonerEinst.nacht_bis));
}

function schonerErlaubt() {
  if (SCHONER_TEST) return true;
  return (IST_LADEN || NACHT_TEST) && !!schonerEinst && schonerEinst.aktiv === true;
}
const startNachMs = () => (SCHONER_TEST ? 5 : schonerZahl("start_nach_sekunden", 90, 10, 3600)) * 1000;
const folieMs = () => schonerZahl("folie_sekunden", 12, 5, 120) * 1000;

// Startseite steht unberührt da: nichts offen, nichts im Warenkorb
function startseiteRuhig() {
  return !startseite.hidden && warenkorb.length === 0 && el.tastatur.hidden && leergutDialog.hidden &&
    el.danke.hidden && melden.dialog.hidden && el.warnung.hidden;
}

// --- Die Folien (jede liefert ihren Inhalt oder null, wenn es nichts zu zeigen gibt) ---
function folienLogo(klasse) {
  const bild = neu("img", klasse);
  bild.src = "bilder/logo-400.png";
  bild.alt = "";
  return bild;
}

function folieWillkommen() {
  const inhalt = neu("div", "folie-inhalt");
  inhalt.append(
    folienLogo("folie-logo"),
    neu("h2", "folie-titel", t("Willkommen bei Bachl's Feldgemüse")),
    neu("p", "folie-text", t("Selbstbedienung rund um die Uhr"))
  );
  if (aktuellerGruss) inhalt.append(neu("p", "folie-gruss", t(aktuellerGruss)));
  return inhalt;
}

function folieSaison() {
  const m = aktuellerMonat();
  const gruppen = [
    ["frisch", "Jetzt frisch", "chip-frisch"],
    ["lager", "Vom Lager", "chip-lager"],
  ].map(([art, titel, klasse]) => {
    const namen = saison.produkte.filter((p) => saisonArt(p, m) === art).map((p) => p.name);
    if (!namen.length) return null;
    const gruppe = neu("div", "folie-gruppe");
    const chips = neu("div", "folie-chips");
    namen.forEach((n) => chips.append(neu("span", `chip chip-gross ${klasse}`, saisonName(n))));
    gruppe.append(neu("h3", "", t(titel)), chips);
    return gruppe;
  }).filter(Boolean);
  if (!gruppen.length) return null;
  const inhalt = neu("div", "folie-inhalt");
  const saisonBox = neu("div", "folie-saison");
  saisonBox.append(...gruppen);
  inhalt.append(neu("span", "folie-label", t("Saison im {monat}", { monat: monatName(m) })), saisonBox);
  return inhalt;
}

function folieRezept() {
  const titel = (rezeptDerWoche || "").trim();
  if (!titel) return null;
  const r = rezepte.find((x) => x.titel.trim() === titel);
  const inhalt = neu("div", "folie-inhalt");
  inhalt.append(neu("span", "folie-label", t("Rezept der Woche")));
  if (r && r.foto) {
    const bild = neu("img", "folie-foto");
    bild.src = r.foto;
    bild.alt = "";
    bild.addEventListener("error", () => bild.remove());
    inhalt.append(bild);
  } else if (r) {
    const icons = neu("div", "folie-icons");
    (r.zutaten || [])
      .map((z) => produktIcons[z.produkt])
      .filter((icon, i, alle) => icon && alle.indexOf(icon) === i)
      .slice(0, 5)
      .forEach((icon) => icons.append(iconSvg(icon, "folie-icon")));
    if (icons.children.length) inhalt.append(icons);
  }
  inhalt.append(neu("h2", "folie-titel", titel));
  if (r && r.kurz) inhalt.append(neu("p", "folie-text", r.kurz));
  const meta = r ? [r.dauer, r.portionen].filter(Boolean).join(" · ") : "";
  if (meta) inhalt.append(neu("p", "folie-meta", meta));
  return inhalt;
}

function folieNeu() {
  const text = (neuImLaden || "").trim();
  if (!text) return null;
  const inhalt = neu("div", "folie-inhalt");
  inhalt.append(neu("span", "folie-label", t("Neu im Laden")));
  // Kommt ein Produktname im Text vor (z. B. "Pak Choi aus eigenem Anbau")? Dann dessen Icon zeigen.
  const treffer = alleProduktNamen
    .filter((n) => produktIcons[n] && text.toLowerCase().includes(n.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0];
  if (treffer) {
    const icons = neu("div", "folie-icons");
    icons.append(iconSvg(produktIcons[treffer], "folie-icon"));
    inhalt.append(icons);
  }
  inhalt.append(neu("h2", "folie-titel", text));
  return inhalt;
}

function folieProdukte() {
  const beliebt = produkte.filter((p) => p.beliebt);   // "produkte" enthält nur verfügbare
  if (!beliebt.length) return null;
  // In Gruppen zu 3–4 aufteilen (5 → 3 + 2, 7 → 4 + 3, 8 → 4 + 4)
  const seiten = Math.ceil(beliebt.length / 4);
  const groesse = Math.ceil(beliebt.length / seiten);
  const nr = produktSeite % seiten;
  produktSeite++;
  const auswahl = beliebt.slice(nr * groesse, nr * groesse + groesse);

  const inhalt = neu("div", "folie-inhalt");
  const raster = neu("div", "folie-produkte");
  raster.style.gridTemplateColumns = `repeat(${auswahl.length}, minmax(0, 1fr))`;
  auswahl.forEach((p) => {
    const karte = neu("div", "folie-karte");
    const bildBox = neu("div", "folie-bild");
    const alsIcon = () => bildBox.replaceChildren(...(p.icon ? [iconSvg(p.icon, "")] : []));
    if (p.foto) {
      const bild = neu("img");
      bild.src = p.foto;
      bild.alt = "";
      bild.addEventListener("error", alsIcon);
      bildBox.append(bild);
    } else {
      alsIcon();
    }
    karte.append(bildBox, neu("h3", "", pName(p.name)));
    if (p.variabel) karte.append(neu("p", "folie-preis", t("Preis steht am Produkt")));
    p.groessen.slice(0, 2).forEach((g) => {
      const zeile = neu("p", "folie-preis");
      zeile.append(neu("span", "", einheitText(g.einheit) + " · "), document.createTextNode(euro(g.cent)));
      karte.append(zeile);
    });
    raster.append(karte);
  });
  inhalt.append(neu("span", "folie-label", t("Beliebt bei uns")), raster);
  return inhalt;
}

const FOLIEN = [folieWillkommen, folieSaison, folieRezept, folieNeu, folieProdukte];

const zufall = (min, max) => (min + Math.random() * (max - min)).toFixed(1);

// Nächste Folie mit Inhalt zeigen (leere werden übersprungen) und sanft überblenden
function naechsteFolie() {
  let inhalt = null;
  for (let i = 1; i <= FOLIEN.length && !inhalt; i++) {
    const nr = (folienNr + i) % FOLIEN.length;
    inhalt = FOLIEN[nr]();
    if (inhalt) folienNr = nr;
  }
  if (!inhalt) return;
  // Inhalt und Fußzeile jedes Mal ein Stück verschieben, damit nichts einbrennt
  inhalt.style.transform = `translate(${zufall(-3, 3)}vw, ${zufall(-2.5, 2.5)}vh)`;
  schonerFuss.style.transform = `translate(${zufall(-2, 2)}vw, ${zufall(-0.8, 0.8)}vh)`;

  const folie = neu("div", "folie");
  folie.append(inhalt);
  const alte = Array.from(schonerBuehne.children);
  schonerBuehne.append(folie);
  void folie.offsetWidth;            // erst unsichtbar zeichnen, dann einblenden
  folie.classList.add("sichtbar");
  alte.forEach((a) => {
    a.classList.remove("sichtbar");
    setTimeout(() => a.remove(), 1600);
  });
}

function aktualisiereDimmer() {
  schonerDimmer.style.opacity = istNachtzeit() ? String(1 - schonerZahl("nacht_helligkeit", 0.45, 0.1, 1)) : "0";
}

function schonerEin() {
  if (schonerAn) return;
  schonerAn = true;
  clearTimeout(schonerAusTimer);
  schonerBuehne.replaceChildren();
  folienNr = -1;
  aktualisiereDimmer();
  naechsteFolie();
  schoner.hidden = false;
  void schoner.offsetWidth;
  schoner.classList.add("an");
  clearInterval(folienTimer);
  folienTimer = setInterval(naechsteFolie, folieMs());
  aktualisiereSchnee();
}

function schonerAus() {
  if (!schonerAn) return;
  schonerAn = false;
  ruheSeit = Date.now();             // Zeit bis zum nächsten Start beginnt neu
  clearInterval(folienTimer);
  schoner.classList.remove("an");
  clearTimeout(schonerAusTimer);
  schonerAusTimer = setTimeout(() => {
    schoner.hidden = true;
    schonerBuehne.replaceChildren();
    aktualisiereSchnee();
  }, 1000);
}

// Antippen (oder Taste) beendet nur den Schoner – nichts darunter wird ausgelöst
schoner.addEventListener("pointerdown", (e) => { e.preventDefault(); schonerAus(); });
schoner.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); });
window.addEventListener("keydown", () => schonerAus());

setInterval(() => {
  if (!schonerErlaubt() || !startseiteRuhig()) {
    schonerAus();
    ruheSeit = null;
    return;
  }
  if (schonerAn) {
    aktualisiereDimmer();            // z. B. um 22:00 abdunkeln, um 06:00 wieder hell
    aktualisiereSchnee();            // nachts kein Schnee
    return;
  }
  if (ruheSeit === null) ruheSeit = Date.now();
  if (Date.now() - Math.max(ruheSeit, letzteAktivitaet) >= startNachMs()) schonerEin();
}, 1000);

// Bildschirm wachhalten (Screen Wake Lock), damit das Gerät nicht selbst sperrt.
// Nur am Laden-Tablet (und beim Testen). Ältere Browser kennen das nicht → einfach ignorieren.
let wachSperre = null;
async function holeWachSperre() {
  if ((!IST_LADEN && !SCHONER_TEST && !NACHT_TEST) || wachSperre || !("wakeLock" in navigator)) return;
  if (document.visibilityState !== "visible") return;
  try {
    wachSperre = await navigator.wakeLock.request("screen");
    wachSperre.addEventListener("release", () => { wachSperre = null; });
  } catch (fehler) {
    console.info("Bildschirm wachhalten nicht möglich:", fehler && fehler.message);
  }
}
document.addEventListener("visibilitychange", holeWachSperre);   // nach dem Zurückkommen neu anfordern
window.addEventListener("pointerdown", holeWachSperre, { passive: true }); // manche Browser wollen erst einen Tipp
holeWachSperre();

// ===== Jahreszeiten-Look =====
// Dekoration nach Datum (Einstellungen in inhalte.json → "jahreszeiten"). Nur Zierde in Ecken und am Rand,
// immer HINTER dem Inhalt (verdeckt nie Text oder Knöpfe). Ostern und der 1. Advent werden jedes Jahr berechnet.
// Testen: ?thema=ostern (oder ein anderer Name), ?thema=keins, ?datum=2026-12-24
const THEMEN = ["winter", "fruehling", "ostern", "sommer", "herbst", "kuerbis", "advent"];
const THEMEN_STANDARD = {
  winter: { aktiv: true, von: "01-07", bis: "02-28" },
  fruehling: { aktiv: true, von: "03-01", bis: "05-31" },
  ostern: { aktiv: true, automatisch: true },
  sommer: { aktiv: true, von: "06-01", bis: "08-31" },
  herbst: { aktiv: true, von: "09-01", bis: "10-14" },
  kuerbis: { aktiv: true, von: "10-15", bis: "11-02" },
  advent: { aktiv: true, automatisch: true, bis: "01-06" },
};
const SCHNEE_THEMEN = ["winter", "advent"];
const TEST_THEMA = TEST_PARAMETER.get("thema");
const TEST_DATUM = (() => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(TEST_PARAMETER.get("datum") || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null;
})();
let jahreszeitenEinst = null;   // aus inhalte.json
let aktuellesThema = "";
let aktuellerGruss = "";

const heute = () => (TEST_DATUM ? new Date(TEST_DATUM.getTime()) : new Date());
const mmtt = (d) => (d.getMonth() + 1) * 100 + d.getDate();          // 24. Dezember → 1224
const plusTage = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// "12-24" → 1224; ungültig → null
function mmttAus(text) {
  const m = /^(\d{2})-(\d{2})$/.exec(typeof text === "string" ? text.trim() : "");
  if (!m) return null;
  const monat = Number(m[1]), tag = Number(m[2]);
  return monat >= 1 && monat <= 12 && tag >= 1 && tag <= 31 ? monat * 100 + tag : null;
}
// Liegt der Tag im Bereich? Darf über Neujahr gehen ("12-01" bis "01-06").
function imJahresbereich(wert, von, bis) {
  if (von === null || bis === null) return false;
  return von <= bis ? wert >= von && wert <= bis : wert >= von || wert <= bis;
}

// Ostersonntag (gregorianischer Kalender, Gauß/Meeus)
function osterSonntag(jahr) {
  const a = jahr % 19, b = Math.floor(jahr / 100), c = jahr % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31), tag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(jahr, monat - 1, tag);
}
// 1. Advent = 4. Sonntag vor Weihnachten
function ersterAdvent(jahr) {
  const heiligabend = new Date(jahr, 11, 24);
  return new Date(jahr, 11, 24 - heiligabend.getDay() - 21);
}

// Welches Thema gilt an diesem Tag? Besondere gehen vor: Ostern > Frühling, Advent > Winter, Kürbis > Herbst.
function themaFuer(datum, einst) {
  const e = einst && typeof einst === "object" ? einst : { aktiv: true };
  if (e.aktiv === false) return "";
  const vorgaben = e.themen && typeof e.themen === "object" ? e.themen : THEMEN_STANDARD;
  const tag = new Date(datum.getFullYear(), datum.getMonth(), datum.getDate());
  const wert = mmtt(tag);
  const an = (n) => !!vorgaben[n] && typeof vorgaben[n] === "object" && vorgaben[n].aktiv !== false;
  const bereich = (n) => imJahresbereich(wert, mmttAus(vorgaben[n].von), mmttAus(vorgaben[n].bis));

  if (an("ostern")) {
    if (vorgaben.ostern.automatisch === true) {
      const ostern = osterSonntag(tag.getFullYear());
      if (tag >= plusTage(ostern, -7) && tag <= plusTage(ostern, 1)) return "ostern";   // Palmsonntag bis Ostermontag
    } else if (bereich("ostern")) return "ostern";
  }
  if (an("advent")) {
    const a = vorgaben.advent;
    if (a.automatisch === true) {
      const bis = mmttAus(a.bis) || 106;
      const start = ersterAdvent(tag.getFullYear());
      if (bis < 700 ? tag >= start || wert <= bis : tag >= start && wert <= bis) return "advent";
    } else if (bereich("advent")) return "advent";
  }
  for (const n of ["kuerbis", "winter", "fruehling", "sommer", "herbst"]) {
    if (an(n) && bereich(n)) return n;
  }
  return "";
}

function grussFuer(thema, datum) {
  if (thema === "advent") {
    const wert = mmtt(datum);
    if (wert >= 1231 || wert < 700) return "Prosit Neujahr!";
    if (wert >= 1224) return "Frohe Weihnachten!";
    return "Schöne Adventzeit!";
  }
  return { fruehling: "Der Frühling ist da!", ostern: "Frohe Ostern!", sommer: "Frisch vom Feld!",
    herbst: "Erntezeit!", kuerbis: "Kürbiszeit!" }[thema] || "";
}

function wendeJahreszeitAn() {
  const datum = heute();
  let thema = themaFuer(datum, jahreszeitenEinst);
  if (TEST_THEMA === "keins") thema = "";
  else if (THEMEN.includes(TEST_THEMA)) thema = TEST_THEMA;
  aktuellesThema = thema;
  aktuellerGruss = thema ? grussFuer(thema, datum) : "";
  if (thema) document.documentElement.setAttribute("data-thema", thema);
  else document.documentElement.removeAttribute("data-thema");
  const gruss = $("start-gruss");
  gruss.textContent = aktuellerGruss ? t(aktuellerGruss) : "";
  gruss.hidden = !aktuellerGruss;
  aktualisiereSchnee();
}
setInterval(wendeJahreszeitAn, 30 * 60 * 1000);   // um Mitternacht wechselt das Thema von selbst

// Sehr langsamer, spärlicher Schnee – nur im Bildschirmschoner, nur Winter/Advent, nicht nachts,
// nicht bei "Bewegung reduzieren"
function aktualisiereSchnee() {
  const box = $("schnee");
  const ruhig = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const soll = schonerAn && SCHNEE_THEMEN.includes(aktuellesThema) && !istNachtzeit() && !ruhig;
  if (soll && !box.childElementCount) {
    for (let i = 0; i < 16; i++) {
      const flocke = neu("span", "flocke");
      const groesse = 5 + Math.random() * 6;
      flocke.style.left = (Math.random() * 100).toFixed(1) + "%";
      flocke.style.width = flocke.style.height = groesse.toFixed(1) + "px";
      flocke.style.animationDuration = (24 + Math.random() * 16).toFixed(1) + "s";
      flocke.style.animationDelay = (-Math.random() * 40).toFixed(1) + "s";
      box.append(flocke);
    }
  } else if (!soll && box.childElementCount) {
    box.replaceChildren();
  }
}

// ===== Kinderecke =====
// Zwei einfache Spiele mit den Produkt-Icons aus bilder/icons.svg. Einstellungen in inhalte.json:
// "kinderecke": { "aktiv": true, "kinder_minuten": 3 }.
// - Der Warenkorb bleibt erhalten, während ein Kind spielt ("Zum Einkauf (X Artikel)").
// - Am Laden-Tablet (?laden) ist die Spielzeit pro Besuch begrenzt, am Handy nicht.
// - Nichts wird gespeichert oder verschickt. Direkt-Link: …/einkaufshelfer/#kinder
const kinderSeite = $("kinder");
const kinderBuehne = $("kinder-buehne");
const KINDER_FRAGEN = 6;
let kinderEinst = null;          // aus inhalte.json
let kinderAnsicht = "auswahl";   // auswahl | memory | quiz | pause
let kinderTimer = null;
let kinderPausenTimer = null;
let kinderLinkGeprueft = false;

// Kindgerechte Wörter für "Was ist das?" (nur Icons, die eindeutig erkennbar sind).
// Erscheint nur, wenn es das Produkt mit diesem Icon in products.json gibt.
const KINDER_WOERTER = {
  "erdaepfel": { de: "Erdäpfel", en: "Potatoes" },
  "zwiebel-gelb": { de: "Zwiebel", en: "Onion" },
  "knoblauch": { de: "Knoblauch", en: "Garlic" },
  "kuerbis": { de: "Kürbis", en: "Pumpkin" },
  "chinakohl-gruen": { de: "Chinakohl", en: "Cabbage" },
  "pak-choi": { de: "Pak Choi", en: "Pak choi" },
  "suesskartoffel": { de: "Süßkartoffel", en: "Sweet potato" },
  "apfel": { de: "Apfel", en: "Apple" },
  "milch": { de: "Milch", en: "Milk" },
  "eier": { de: "Eier", en: "Eggs" },
  "honig": { de: "Honig", en: "Honey" },
};
// Für das Memory: gut unterscheidbare Icons
const MEMORY_ICONS = ["erdaepfel", "zwiebel-gelb", "zwiebel-rot", "knoblauch", "kuerbis", "chinakohl-gruen", "pak-choi",
  "suesskartoffel", "apfel", "apfelsaft", "traubensaft", "milch", "eier", "honig", "muesli", "eingelegtes"];

const kinderAktiv = () => !kinderEinst || kinderEinst.aktiv !== false;
function kinderMinuten() {
  const m = Number(kinderEinst && kinderEinst.kinder_minuten);
  return Number.isFinite(m) && m >= 1 && m <= 30 ? m : 3;
}
// Icons, die es in products.json wirklich gibt (auch ausverkaufte)
const vorhandeneIcons = () => new Set(Object.values(produktIcons).filter(Boolean));

function mische(liste) {
  const a = liste.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function kinderKnopf(text, klasse, aktion) {
  const b = neu("button", klasse, text);
  b.type = "button";
  b.addEventListener("click", aktion);
  return b;
}

// Kopfzeile: "Zum Einkauf (X Artikel)" nur, wenn etwas im Warenkorb ist
function zeichneKinderKopf() {
  const anzahl = warenkorb.reduce((s, z) => s + z.menge, 0);
  const knopf = $("kinder-einkauf");
  knopf.hidden = warenkorb.length === 0;
  knopf.textContent = t("Zum Einkauf ({anzahl} Artikel)", { anzahl });
}

function zeigeKinder() {
  if (!kinderAktiv()) return;
  startseite.hidden = true;
  bald.hidden = true;
  seite.hidden = true;
  saisonSeite.hidden = true;
  kinderSeite.hidden = false;
  kinderSeite.scrollTop = 0;
  zeigeKinderAuswahl();
  clearTimeout(kinderTimer);
  kinderTimer = IST_LADEN ? setTimeout(zeigeKinderPause, kinderMinuten() * 60 * 1000) : null;
  aktivitaet();
}

function verlasseKinder() {
  clearTimeout(kinderTimer);
  clearTimeout(kinderPausenTimer);
  kinderTimer = null;
  kinderSeite.hidden = true;
  kinderAnsicht = "auswahl";
  if (KANN_VORLESEN) speechSynthesis.cancel();
}

// --- Auswahl der Spiele ---
function spielKarte(titel, text, icons, aktion) {
  const karte = kinderKnopf("", "kinder-spiel", aktion);
  const bilder = neu("span", "kinder-spiel-icons");
  icons.forEach((icon) => bilder.append(iconSvg(icon, "kinder-spiel-icon")));
  karte.append(bilder, neu("span", "kinder-spiel-titel", titel), neu("span", "kinder-spiel-text", text));
  return karte;
}

function zeigeKinderAuswahl() {
  kinderAnsicht = "auswahl";
  zeichneKinderKopf();
  const spiele = neu("div", "kinder-spiele");
  spiele.append(
    spielKarte(t("Gemüse-Memory"), t("Finde die Paare!"), ["kuerbis", "kuerbis", "apfel"], starteMemory),
    spielKarte(t("Was ist das?"), t("Erkennst du es?"), ["erdaepfel"], starteQuiz)
  );
  // QR-Code zum Weiterspielen am Handy (Datei entsteht beim Veröffentlichen; fehlt sie, Kasten weg)
  const qr = neu("div", "kinder-qr");
  const bild = neu("img");
  bild.src = "bilder/kinder-qr.svg";
  bild.alt = "";
  bild.width = 120;
  bild.height = 120;
  bild.addEventListener("error", () => qr.remove());
  const text = neu("div", "kinder-qr-text");
  text.append(neu("strong", "", t("Auf dem Handy weiterspielen")), neu("span", "", t("QR-Code mit dem Handy scannen – dann ist das Tablet frei zum Einkaufen.")));
  qr.append(bild, text);
  kinderBuehne.replaceChildren(spiele, qr);
}

// "Super!"-Kasten am Ende eines Spiels
function kinderFertig(titel, nochmal) {
  const box = neu("div", "kinder-fertig");
  const icons = neu("div", "kinder-fertig-icons");
  mische(Array.from(vorhandeneIcons()).filter((i) => MEMORY_ICONS.includes(i))).slice(0, 3)
    .forEach((icon) => icons.append(iconSvg(icon, "kinder-fertig-icon")));
  const knoepfe = neu("div", "kinder-fertig-knoepfe");
  knoepfe.append(kinderKnopf(t("Nochmal"), "btn-haupt", nochmal), kinderKnopf(t("Zurück"), "btn-zweit", zeigeKinderAuswahl));
  box.append(icons, neu("h2", "", titel), knoepfe);
  return box;
}

// --- Spiel 1: Gemüse-Memory (6 Paare, kein Zeitdruck, kein Verlieren) ---
let memoryOffen = [];
let memoryGesperrt = false;

function starteMemory() {
  kinderAnsicht = "memory";
  memoryOffen = [];
  memoryGesperrt = false;
  const icons = mische(MEMORY_ICONS.filter((i) => vorhandeneIcons().has(i))).slice(0, 6);
  const raster = neu("div", "memory");
  mische(icons.concat(icons)).forEach((icon) => {
    const karte = kinderKnopf("", "memory-karte", () => memoryTipp(karte));
    karte.dataset.icon = icon;
    karte.setAttribute("aria-label", t("Karte umdrehen"));
    const innen = neu("span", "mk-innen");
    const rueckseite = neu("span", "mk-hinten");
    rueckseite.append(folienLogo("mk-logo"));
    const vorderseite = neu("span", "mk-vorne");
    vorderseite.append(iconSvg(icon, "mk-icon"));
    innen.append(rueckseite, vorderseite);
    karte.append(innen);
    raster.append(karte);
  });
  kinderBuehne.replaceChildren(neu("p", "kinder-anleitung", t("Finde die Paare!")), raster);
  aktivitaet();
}

function memoryTipp(karte) {
  if (memoryGesperrt || karte.classList.contains("offen")) return;
  karte.classList.add("offen");
  memoryOffen.push(karte);
  if (memoryOffen.length < 2) return;
  const [a, b] = memoryOffen;
  memoryOffen = [];
  if (a.dataset.icon === b.dataset.icon) {
    a.classList.add("gefunden");
    b.classList.add("gefunden");
    const raster = a.parentNode;
    if (raster && !raster.querySelector(".memory-karte:not(.gefunden)")) {
      setTimeout(() => {
        if (kinderAnsicht === "memory" && raster.isConnected) {
          kinderBuehne.replaceChildren(kinderFertig(t("Super! Alle gefunden!"), starteMemory));
        }
      }, 800);
    }
  } else {
    memoryGesperrt = true;
    setTimeout(() => {
      a.classList.remove("offen");
      b.classList.remove("offen");
      memoryGesperrt = false;
    }, 1000);
  }
}

// --- Spiel 2: Was ist das? (ein Icon, drei Antworten, Vorlesen) ---
const KANN_VORLESEN = "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
let quiz = null;

function vorlesen(wort) {
  if (!KANN_VORLESEN) return;
  try {
    speechSynthesis.cancel();
    const satz = new SpeechSynthesisUtterance(wort);
    satz.lang = sprache === "en" ? "en-GB" : "de-AT";
    const stimme = speechSynthesis.getVoices().find((v) => (v.lang || "").toLowerCase().indexOf(sprache === "en" ? "en" : "de") === 0);
    if (stimme) satz.voice = stimme;
    satz.rate = 0.85;
    speechSynthesis.speak(satz);
  } catch (fehler) {
    console.info("Vorlesen nicht möglich:", fehler && fehler.message);
  }
}

function quizWort(eintrag) {
  return KINDER_WOERTER[eintrag][sprache === "en" ? "en" : "de"];
}

function starteQuiz() {
  const pool = Object.keys(KINDER_WOERTER).filter((i) => vorhandeneIcons().has(i));
  if (pool.length < 3) return;
  const reihenfolge = mische(pool);
  const fragen = [];
  for (let i = 0; i < KINDER_FRAGEN; i++) {
    const richtig = reihenfolge[i % reihenfolge.length];
    const andere = mische(pool.filter((x) => x !== richtig)).slice(0, 2);
    fragen.push({ richtig, optionen: mische([richtig].concat(andere)) });
  }
  quiz = { fragen, nr: 0 };
  kinderAnsicht = "quiz";
  zeigeFrage();
}

function zeigeFrage() {
  const frage = quiz.fragen[quiz.nr];
  const box = neu("div", "quiz");
  box.append(neu("p", "kinder-anleitung", t("Frage {nr} von {gesamt}", { nr: quiz.nr + 1, gesamt: quiz.fragen.length })));
  const bild = neu("div", "quiz-bild");
  bild.append(iconSvg(frage.richtig, "quiz-icon"));
  const antworten = neu("div", "quiz-antworten");
  const rueckmeldung = neu("p", "quiz-rueckmeldung");
  rueckmeldung.setAttribute("aria-live", "polite");
  frage.optionen.forEach((icon) => {
    const zeile = neu("div", "quiz-zeile");
    const knopf = kinderKnopf(quizWort(icon), "quiz-antwort", () => quizAntwort(knopf, icon, antworten, rueckmeldung));
    zeile.append(knopf);
    if (KANN_VORLESEN) {
      const vor = kinderKnopf("", "quiz-vorlesen", () => vorlesen(quizWort(icon)));
      vor.setAttribute("aria-label", t("Vorlesen: {wort}", { wort: quizWort(icon) }));
      vor.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 12h5l7-6v20l-7-6H5z"/><path d="M21 11q4 5 0 10M24 7q8 9 0 18"/></svg>';
      zeile.append(vor);
    }
    antworten.append(zeile);
  });
  box.append(bild, antworten, rueckmeldung);
  kinderBuehne.replaceChildren(box);
  aktivitaet();
}

function quizAntwort(knopf, icon, antworten, rueckmeldung) {
  const frage = quiz.fragen[quiz.nr];
  if (icon === frage.richtig) {
    knopf.classList.add("richtig");
    rueckmeldung.textContent = t("Richtig!");
    rueckmeldung.className = "quiz-rueckmeldung gut";
    antworten.querySelectorAll(".quiz-antwort").forEach((b) => { b.disabled = true; });
    setTimeout(() => {
      if (kinderAnsicht !== "quiz" || !antworten.isConnected) return;
      quiz.nr++;
      if (quiz.nr < quiz.fragen.length) zeigeFrage();
      else kinderBuehne.replaceChildren(kinderFertig(t("Toll gemacht!"), starteQuiz));
    }, 1300);
  } else {
    // Sanft: kurzes Wackeln in Orange, kein Rot, kein Ton
    knopf.classList.remove("fast");
    void knopf.offsetWidth;
    knopf.classList.add("fast");
    knopf.disabled = true;
    rueckmeldung.textContent = t("Fast! Probier's nochmal.");
    rueckmeldung.className = "quiz-rueckmeldung";
  }
}

// --- Zeitlimit am Laden-Tablet ---
function zeigeKinderPause() {
  if (kinderSeite.hidden) return;
  kinderAnsicht = "pause";
  if (KANN_VORLESEN) speechSynthesis.cancel();
  $("kinder-einkauf").hidden = true;
  const box = neu("div", "kinder-fertig kinder-pause");
  const gesicht = neu("div", "kinder-gesicht");
  gesicht.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true">' +
    '<path d="M60 14c-6 0-9 6-6 11-3-5-11-5-12 1 6 0 10 2 12 5" fill="#4E8B3A" stroke="#33261A" stroke-width="3" stroke-linejoin="round"/>' +
    '<ellipse cx="60" cy="70" rx="40" ry="38" fill="#D3A35F" stroke="#33261A" stroke-width="4"/>' +
    '<circle cx="45" cy="64" r="5" fill="#33261A"/><circle cx="75" cy="64" r="5" fill="#33261A"/>' +
    '<circle cx="36" cy="80" r="6" fill="#E8961E" opacity=".45"/><circle cx="84" cy="80" r="6" fill="#E8961E" opacity=".45"/>' +
    '<path d="M44 82q16 16 32 0" fill="none" stroke="#33261A" stroke-width="4" stroke-linecap="round"/></svg>';
  const zurStart = () => { verlasseKinder(); zeigeStartseite(); };
  box.append(gesicht, neu("h2", "", t("Super gespielt! Jetzt ist Pause.")), kinderKnopf(t("Zur Startseite"), "btn-haupt", zurStart));
  kinderBuehne.replaceChildren(box);
  clearTimeout(kinderPausenTimer);
  kinderPausenTimer = setTimeout(() => { if (kinderAnsicht === "pause" && !kinderSeite.hidden) zurStart(); }, 8000);
}

// "Zurück": aus einem Spiel zur Auswahl, sonst zur Startseite (Warenkorb bleibt)
$("kinder-zurueck").addEventListener("click", () => {
  if (kinderAnsicht === "memory" || kinderAnsicht === "quiz") return zeigeKinderAuswahl();
  verlasseKinder();
  zeigeStartseite();
});
$("kinder-einkauf").addEventListener("click", () => {
  verlasseKinder();
  zeigeRechner();
});
$("start-kinder").addEventListener("click", zeigeKinder);

// Einstellungen übernehmen (aus ladeInhalte) und Direkt-Link …/#kinder öffnen
function kinderEinstellen(einst) {
  kinderEinst = einst && typeof einst === "object" ? einst : null;
  $("start-kinder").hidden = !kinderAktiv();
  if (!kinderAktiv() && !kinderSeite.hidden) { verlasseKinder(); zeigeStartseite(); }
  if (!kinderLinkGeprueft) {
    kinderLinkGeprueft = true;
    if (location.hash === "#kinder") zeigeKinder();
  }
}
window.addEventListener("hashchange", () => { if (location.hash === "#kinder") zeigeKinder(); });

// ===== Saisonkalender (Daten aus saison.json) =====
// Monate: 1 = Jänner … 12 = Dezember. "frisch" = grün, "vom Lager" = orange.
const MONATE = {
  de: ["Jänner", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const MONATE_KURZ = {
  de: ["Jän", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const saisonSeite = $("saison");
let saison = { produkte: [], ganzjaehrig: [] };
let saisonMonat = aktuellerMonat();   // im Kalender gewählter Monat

function aktuellerMonat() {
  return new Date().getMonth() + 1;   // Datum des Geräts
}
function monatName(m) {
  return MONATE[sprache][m - 1];
}
// Name in der aktuellen Sprache: zuerst products.json (name_en), sonst Wörterbuch
function saisonName(name) {
  const p = pName(name);
  return p !== name ? p : t(name);
}
function saisonArt(p, m) {
  return p.frisch.includes(m) ? "frisch" : p.lager.includes(m) ? "lager" : "";
}

async function ladeSaison() {
  try {
    const antwort = await fetch("saison.json", { cache: "no-store" });
    if (!antwort.ok) throw new Error("HTTP " + antwort.status);
    const daten = await antwort.json();
    const monate = (l) => (Array.isArray(l) ? l.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12) : []);
    saison = {
      produkte: (daten.produkte || [])
        .filter((p) => p && typeof p.name === "string" && p.name.trim())
        .map((p) => ({ name: p.name, frisch: monate(p.frisch), lager: monate(p.lager) })),
      ganzjaehrig: (daten.ganzjaehrig || []).filter((x) => typeof x === "string" && x.trim()),
    };
  } catch (fehler) {
    console.warn("saison.json konnte nicht geladen werden:", fehler);
  }
  zeichneSaisonLeiste();
  if (!saisonSeite.hidden) zeichneSaisonkalender();
}

// --- Leiste auf der Startseite: was es JETZT gibt ---
function zeichneSaisonLeiste() {
  const leiste = $("saison-leiste");
  leiste.hidden = saison.produkte.length === 0;
  if (leiste.hidden) return;
  const m = aktuellerMonat();
  $("saison-jetzt").textContent = t("Jetzt im {monat}:", { monat: monatName(m) });
  for (const art of ["frisch", "lager"]) {
    const zeile = $(art === "frisch" ? "sl-frisch" : "sl-lager");
    const namen = saison.produkte.filter((p) => saisonArt(p, m) === art).map((p) => saisonName(p.name));
    zeile.hidden = namen.length === 0;   // leere Zeile ausblenden
    zeile.querySelector(".chips").replaceChildren(...namen.map((n) => neu("span", `chip chip-${art}`, n)));
  }
}

function zeigeSaison() {
  startseite.hidden = true;
  bald.hidden = true;
  seite.hidden = true;
  verlasseKinder();
  saisonMonat = aktuellerMonat();
  zeichneSaisonkalender();
  saisonSeite.hidden = false;
  saisonSeite.scrollTop = 0;
  // Schmaler Bildschirm (Tabelle wischt seitlich): gleich zum aktuellen Monat scrollen
  const rahmen = saisonSeite.querySelector(".saison-rahmen");
  const aktiv = rahmen.querySelector(".saison-monat.aktiv");
  rahmen.scrollLeft = aktiv ? Math.max(0, aktiv.offsetLeft - rahmen.clientWidth / 2) : 0;
  aktivitaet();
}

// --- Kalenderseite ---
function zeichneSaisonkalender() {
  const tabelle = $("saison-tabelle");
  tabelle.replaceChildren(neu("span", "saison-ecke"));

  // Kopfzeile: 12 Monatsknöpfe (stehen im selben Raster wie die Balken)
  for (let m = 1; m <= 12; m++) {
    const b = neu("button", "saison-monat" + (m === saisonMonat ? " aktiv" : ""), MONATE_KURZ[sprache][m - 1]);
    b.type = "button";
    b.setAttribute("aria-pressed", String(m === saisonMonat));
    b.setAttribute("aria-label", monatName(m));
    b.addEventListener("click", () => {
      saisonMonat = m;
      zeichneSaisonkalender();
      aktivitaet();
    });
    tabelle.append(b);
  }

  // Eine Zeile pro Produkt: Name + 12 Zellen mit Balken
  saison.produkte.forEach((p) => {
    const name = saisonName(p.name);
    tabelle.append(neu("span", "saison-name", name));
    for (let m = 1; m <= 12; m++) {
      const art = saisonArt(p, m);
      const zelle = neu("span", "saison-zelle" + (m === saisonMonat ? " aktiv" : ""));
      if (art) {
        // Balken laufen ohne Lücke durch, solange die Art gleich bleibt
        const links = m > 1 && saisonArt(p, m - 1) === art;
        const rechts = m < 12 && saisonArt(p, m + 1) === art;
        zelle.append(neu("span", `balken ${art}${links ? " offen-links" : ""}${rechts ? " offen-rechts" : ""}`));
        zelle.setAttribute("role", "img");
        zelle.setAttribute("aria-label", t("{name} im {monat}: {art}", {
          name, monat: monatName(m), art: t(art === "frisch" ? "frisch" : "vom Lager"),
        }));
      }
      tabelle.append(zelle);
    }
  });

  // Rechte Spalte: Produkte im gewählten Monat
  $("saison-monat-titel").textContent = t("Im {monat}", { monat: monatName(saisonMonat) });
  const liste = $("saison-monat-liste");
  liste.replaceChildren();
  const imMonat = ["frisch", "lager"].flatMap((art) =>
    saison.produkte.filter((p) => saisonArt(p, saisonMonat) === art).map((p) => ({ name: saisonName(p.name), art })));
  if (imMonat.length === 0) {
    liste.append(neu("li", "saison-leer", t("In diesem Monat gibt es nichts aus der Saison-Liste.")));
  }
  imMonat.forEach(({ name, art }) => {
    const li = neu("li");
    li.append(neu("span", "", name), neu("span", `chip chip-${art}`, t(art === "frisch" ? "frisch" : "vom Lager")));
    liste.append(li);
  });

  // Das ganze Jahr
  $("saison-jahr").replaceChildren(...saison.ganzjaehrig.map((n) => neu("span", "chip chip-jahr", saisonName(n))));
}

$("saison-leiste").addEventListener("click", zeigeSaison);
$("saison-start").addEventListener("click", zeigeStartseite);
$("saison-einkauf").addEventListener("click", zeigeRechner);

// ===== Sprachknopf "English" / "Deutsch" =====
function setzeSprache(neueSprache) {
  sprache = neueSprache;
  uebersetzeSeite();
  zeichneKacheln();                 // Kacheln + Warenkorb neu (mit übersetzten Namen)
  neuKnopfNormal();
  if (!el.tastatur.hidden) $("tastatur-titel").textContent = tastaturProdukt ? pName(tastaturProdukt) : t("Anderer Preis");
  if (!bald.hidden && baldTitel) $("bald-titel").textContent = t(baldTitel);
  if (!seite.hidden && aktuelleSeite) zeigeSeite(aktuelleSeite);   // offene Seite neu aufbauen
  zeichneSaisonLeiste();
  if (!saisonSeite.hidden) zeichneSaisonkalender();
  if (!kinderSeite.hidden && kinderAnsicht === "auswahl") zeigeKinderAuswahl();
  wendeJahreszeitAn();
  aktivitaet();
}
document.querySelectorAll("[data-sprache-knopf]").forEach((b) =>
  b.addEventListener("click", () => setzeSprache(sprache === "de" ? "en" : "de"))
);

// ===== Start =====
uebersetzeSeite();
ladeProdukte();
ladeInhalte();
ladeSeiten();
ladeSaison();
hintergrundSenden(); // falls vom letzten Mal noch Meldungen warten oder der Wochenbericht fällig ist

// Offline-Funktion (Service Worker) aktivieren
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Service Worker:", e));
  });
}
