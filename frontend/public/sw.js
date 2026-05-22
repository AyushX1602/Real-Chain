/* RealChain — minimal service worker.
 *
 * Strategy:
 *   - Navigation (HTML):  network-first, fallback to cache.
 *   - /assets/*:          skip entirely — Vite hashes ensure correct caching.
 *   - /api/properties:    stale-while-revalidate.
 *   - Everything else:    passthrough (no SW intervention).
 */

const STATIC_CACHE = "rc-static-v4";
const RUNTIME_CACHE = "rc-runtime-v4";

const CORE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.svg",
  "/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never intercept hashed Vite assets — they have content-hash filenames.
  // The CDN/server serves them with correct MIME types and immutable caching.
  if (url.pathname.startsWith("/assets/")) return;

  // Navigation — network-first so the browser always gets the latest index.html
  // (which references the latest hashed JS bundle). Falls back to cache only
  // when offline. This prevents the stale-HTML-referencing-old-JS-hash problem.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put("/", copy));
          }
          return res;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // API GETs — stale-while-revalidate for properties list.
  if (url.pathname.startsWith("/api/properties")) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
