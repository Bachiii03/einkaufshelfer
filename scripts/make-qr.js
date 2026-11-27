// Erzeugt QR-Codes als SVG-Dateien in bilder/ – ohne Internet, mit der Bibliothek
// scripts/vendor/qrcode-generator.js (Kazuhiko Arase, MIT-Lizenz).
// Läuft automatisch beim Veröffentlichen (GitHub Action), lokal: node scripts/make-qr.js
//
// - bilder/kinder-qr.svg: Kinderecke am Handy weiterspielen (…/einkaufshelfer/#kinder)
// - bilder/google-bewertung-qr.svg: Link aus inhalte.json → "google_bewertung" → "url"
//   (nur wenn "aktiv": true und eine https://-Adresse eingetragen ist, sonst wird die Datei entfernt)

const fs = require("fs");
const path = require("path");
const qrcode = require("./vendor/qrcode-generator.js");

const ORDNER = path.join(__dirname, "..");
const SEITE = "https://bachiii03.github.io/einkaufshelfer/";

// QR-Code als SVG: schwarze Quadrate auf weißem Grund, 4 Felder Rand (nötig zum Scannen)
function qrSvg(text, titel) {
  const qr = qrcode(0, "M");   // 0 = Größe automatisch, "M" = mittlere Fehlerkorrektur
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const rand = 4;
  const groesse = n + rand * 2;
  let pfad = "";
  for (let zeile = 0; zeile < n; zeile++) {
    for (let spalte = 0; spalte < n; spalte++) {
      if (qr.isDark(zeile, spalte)) pfad += `M${spalte + rand} ${zeile + rand}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${groesse} ${groesse}" shape-rendering="crispEdges">` +
    `<title>${titel}</title><rect width="${groesse}" height="${groesse}" fill="#fff"/>` +
    `<path d="${pfad}" fill="#000"/></svg>\n`;
}

function schreibe(datei, inhalt) {
  fs.writeFileSync(path.join(ORDNER, datei), inhalt, "utf8");
  console.log(`✓ ${datei} erzeugt`);
}

schreibe("bilder/kinder-qr.svg", qrSvg(SEITE + "#kinder", "QR-Code: Kinderecke am Handy"));

// Google-Bewertung: QR passt immer zur Adresse in inhalte.json
const GOOGLE_DATEI = "bilder/google-bewertung-qr.svg";
let google = null;
try {
  google = JSON.parse(fs.readFileSync(path.join(ORDNER, "inhalte.json"), "utf8").replace(/^\uFEFF/, "")).google_bewertung;
} catch (fehler) {
  console.log("inhalte.json konnte nicht gelesen werden – kein Google-QR: " + fehler.message);
}
const googleUrl = google && google.aktiv === true && typeof google.url === "string" ? google.url.trim() : "";
if (/^https:\/\/\S+$/.test(googleUrl)) {
  schreibe(GOOGLE_DATEI, qrSvg(googleUrl, "QR-Code: Google-Bewertung"));
} else {
  const alt = path.join(ORDNER, GOOGLE_DATEI);
  if (fs.existsSync(alt)) fs.unlinkSync(alt);
  console.log("– kein Google-QR (in inhalte.json ist keine https://-Adresse eingetragen oder aktiv ist false)");
}
