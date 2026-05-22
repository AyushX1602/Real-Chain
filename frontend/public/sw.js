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

const STATIC_CACHE = "rc-static-v3";
const RUNTIME_CACHE = "rc-runtime-v3";

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

  // Never intercept hashed Vite assets — they have content-hash filenames
  // and must be served with the correct MIME type by the CDN/server.
  // Caching them in the SW risks serving stale HTML (index.html) for
  // JS module requests, which triggers the strict MIME type error.
  if (url.pathname.startsWith("/assets/")) return;

  // App shell navigation — cache-first for HTML pages only.
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("/").then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put("/", copy));
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
