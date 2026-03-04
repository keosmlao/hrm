const CACHE_NAME = "hrm-pwa-v1";
const APP_SHELL_ASSETS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/pwa-icon?size=180",
  "/pwa-icon?size=192",
  "/pwa-icon?size=512",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || networkPromise;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return cache.match("/offline.html");
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "worker" ||
    request.destination === "image" ||
    request.destination === "font" ||
    request.destination === "manifest" ||
    url.pathname.startsWith("/_next/")
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
