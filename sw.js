// Service Worker: macht die Seite offline-fähig.
// Strategie: zuerst aus dem Internet laden (max. 3 Sekunden warten),
// sonst die gespeicherte Kopie verwenden. Jede erfolgreiche Antwort wird gespeichert.

const CACHE = "einkaufshelfer-v26";
const DATEIEN = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "products.json",
  "inhalte.json",
  "rezepte.json",
  "geschichten.json",
  "saison.json",
  "manifest.json",
  "manifest-laden.json",
  "icon.svg",
  "bilder/logo-400.webp",
  "bilder/logo-400.png",
  "bilder/icons.svg",
  "bilder/apple-touch-icon.png",
  "bilder/icon-512.png",
  "bilder/jahreszeiten/winter-ecke.svg",
  "bilder/jahreszeiten/winter-rand.svg",
  "bilder/jahreszeiten/fruehling-ecke.svg",
  "bilder/jahreszeiten/fruehling-rand.svg",
  "bilder/jahreszeiten/ostern-ecke.svg",
  "bilder/jahreszeiten/ostern-rand.svg",
  "bilder/jahreszeiten/sommer-ecke.svg",
  "bilder/jahreszeiten/sommer-rand.svg",
  "bilder/jahreszeiten/herbst-ecke.svg",
  "bilder/jahreszeiten/herbst-rand.svg",
  "bilder/jahreszeiten/kuerbis-ecke.svg",
  "bilder/jahreszeiten/kuerbis-rand.svg",
  "bilder/jahreszeiten/advent-ecke.svg",
  "bilder/jahreszeiten/advent-rand.svg",
  "fonts/SourceSans3-Variable.woff2",
  "fonts/ZillaSlab-SemiBold.woff2",
  "fonts/ZillaSlab-Bold.woff2",
];
const TIMEOUT_MS = 3000;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const anfrage = e.request;
  if (anfrage.method !== "GET" || new URL(anfrage.url).origin !== self.location.origin) return;
  e.respondWith(netzZuerst(anfrage));
});

async function netzZuerst(anfrage) {
  const cache = await caches.open(CACHE);
  const netz = fetch(anfrage).then((antwort) => {
    if (antwort.ok) cache.put(anfrage, antwort.clone());
    return antwort;
  });
  netz.catch(() => {}); // Fehler wird unten behandelt

  try {
    return await mitTimeout(netz, TIMEOUT_MS);
  } catch {
    // Internet zu langsam oder weg → gespeicherte Kopie verwenden
    const gespeichert = await cache.match(anfrage, { ignoreSearch: true });
    if (gespeichert) return gespeichert;
    // Noch keine Kopie da (erster Besuch)? Dann doch auf das Internet warten.
    try { return await netz; } catch { /* wirklich offline */ }
    if (anfrage.mode === "navigate") {
      const start = await cache.match("index.html");
      if (start) return start;
    }
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

function mitTimeout(promise, ms) {
  return new Promise((ok, fehler) => {
    const t = setTimeout(() => fehler(new Error("Timeout")), ms);
    promise.then((r) => { clearTimeout(t); ok(r); }, (err) => { clearTimeout(t); fehler(err); });
  });
}
