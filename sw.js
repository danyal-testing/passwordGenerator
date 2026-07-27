/*
 * sw.js — Service worker for the Password Generator PWA.
 * -------------------------------------------------------------------------
 * Strategy:
 *   - Precache the full app shell on install so the app works fully offline.
 *   - Navigation requests: network-first with an offline fallback.
 *   - Other GET requests: cache-first, then network (and cache the result).
 * -------------------------------------------------------------------------
 */
const CACHE = "password-generator-classic-v1";

const ASSETS = [
  "./",
  "./index.html",
  "./404.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./css/base/reset.css",
  "./css/base/variables.css",
  "./css/base/typography.css",
  "./css/base/base.css",
  "./css/layout/container.css",
  "./css/layout/header.css",
  "./css/layout/footer.css",
  "./css/components/card.css",
  "./css/components/slider.css",
  "./css/components/checkbox.css",
  "./css/components/strength-meter.css",
  "./css/components/button.css",
  "./css/components/form.css",
  "./css/components/notfound.css",
  "./css/utilities/helpers.css",
  "./css/utilities/animations.css",
  "./css/utilities/responsive.css",
  "./js/config.js",
  "./js/random.js",
  "./js/generator.js",
  "./js/theme.js",
  "./js/clipboard.js",
  "./js/main.js",
  "./js/pwa.js",
  "./images/favicon.ico",
  "./images/favicon-16.png",
  "./images/favicon-32.png",
  "./images/favicon-48.png",
  "./images/apple-touch-icon.png",
  "./images/logo-rounded.svg",
  "./images/icons/app/icon-192.png",
  "./images/icons/app/icon-512.png",
  "./images/icons/app/maskable-192.png",
  "./images/icons/app/maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
          )
        ),
      "navigationPreload" in self.registration
        ? self.registration.navigationPreload.enable()
        : Promise.resolve(),
    ]).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.headers.has("range")) return;

  const cacheIfSuccessful = (response) => {
    if (response && response.ok && response.type === "basic") {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
    }
    return response;
  };

  if (request.mode === "navigate") {
    event.respondWith(
      event.preloadResponse
        .then((preloaded) => preloaded || fetch(request))
        .then(cacheIfSuccessful)
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then(cacheIfSuccessful))
  );
});
