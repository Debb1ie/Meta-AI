/* HydroSentinel service worker.
   - Next.js build assets (/_next/static/*) are content-hashed and immutable: cache-first.
   - Pages: network-first; the cached copy is only an offline fallback.
   - React Server Component payloads (?_rsc=, RSC header) are never cached: a stale payload
     from an older deployment references chunks that no longer exist and crashes the app.
   - API GETs: network-first with a cached fallback, so offline users still see the
     last data they loaded (the page shows an offline banner).
   - Map tiles: cache-first with a size cap.
   - POSTs (AI questions, uploads, sync) are never cached. */

const VERSION = "hs-v3";
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
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

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
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

async function cacheFirst(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    cache.put(request, response.clone());
    if (max) trim(cacheName, max);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, DATA));
    return;
  }
  if (url.hostname === "server.arcgisonline.com") {
    event.respondWith(cacheFirst(request, TILES, MAX_TILES));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Never touch RSC payloads or prefetches; let Next.js fetch them fresh.
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1" || request.headers.get("Next-Router-Prefetch")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL).then((c) => c.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match("/featured")),
    );
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC));
  } else if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest" || url.pathname === "/favicon.ico") {
    event.respondWith(cacheFirst(request, SHELL));
  }
  // Everything else goes straight to the network.
});
