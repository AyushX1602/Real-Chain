/* RealChain — minimal stale-while-revalidate service worker.
 *
 * Caches:
 *   - The app shell (HTML, JS, CSS, icons) so the marketplace can render
 *     while the network is slow or offline.
 *   - The most recent /api/properties response so cold loads still show
 *     a list when the backend is down.
 *
 * No write-side caching: POSTs (like /api/transactions or /api/users/connect)
 * are passed straight through.
 */

const STATIC_CACHE = "rc-static-v1";
const RUNTIME_CACHE = "rc-runtime-v1";

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

  // App shell — cache-first.
  if (req.mode === "navigate" || url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // API GETs — stale-while-revalidate.
  if (url.pathname.startsWith("/api/") && url.pathname.startsWith("/api/properties")) {
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
