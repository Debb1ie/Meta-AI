/* HydroSentinel service worker.
   - App shell (pages, Next.js static chunks, icons): stale-while-revalidate, so the
     app opens instantly and offline.
   - API GETs: network-first with a cached fallback, so offline users still see the
     last data they loaded (the page shows an offline banner).
   - Map tiles: cache-first with a size cap.
   - POSTs (AI questions, uploads, sync) are never cached. */

const VERSION = "hs-v2";
const SHELL = `${VERSION}-shell`;
const DATA = `${VERSION}-data`;
const TILES = `${VERSION}-tiles`;
const PRECACHE = ["/featured", "/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];
const MAX_TILES = 400;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function networkFirst(request) {
  const cache = await caches.open(DATA);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

async function cacheFirst(request) {
  const cache = await caches.open(TILES);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    cache.put(request, response.clone());
    trim(TILES, MAX_TILES);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
  } else if (url.hostname === "server.arcgisonline.com") {
    event.respondWith(cacheFirst(request));
  } else if (url.origin === self.location.origin) {
    if (request.mode === "navigate") {
      // Pages: fresh when online, cached shell when offline.
      event.respondWith(
        fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(SHELL).then((c) => c.put(request, copy));
            return response;
          })
          .catch(async () => (await caches.match(request)) || caches.match("/featured")),
      );
    } else {
      event.respondWith(staleWhileRevalidate(request));
    }
  }
});
