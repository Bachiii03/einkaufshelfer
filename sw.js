// Service Worker: macht die Seite offline-fähig.
// Strategie: zuerst aus dem Internet laden (max. 3 Sekunden warten),
// sonst die gespeicherte Kopie verwenden. Jede erfolgreiche Antwort wird gespeichert.

const CACHE = "einkaufshelfer-v1";
const DATEIEN = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "products.json",
  "manifest.json",
  "icon.svg",
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
  try {
    const antwort = await mitTimeout(fetch(anfrage), TIMEOUT_MS);
    if (antwort.ok) cache.put(anfrage, antwort.clone());
    return antwort;
  } catch {
    const gespeichert = await cache.match(anfrage, { ignoreSearch: true });
    if (gespeichert) return gespeichert;
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
