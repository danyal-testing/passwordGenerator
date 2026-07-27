/**
 * pwa.js
 * -------------------------------------------------------------------------
 * Registers the service worker so the app is installable and works offline.
 *
 * Registration only runs over http/https (e.g. once deployed to Vercel or any static host). It is intentionally skipped on file://, where the
 * Service Worker API is unavailable — the app still works fully there.
 * -------------------------------------------------------------------------
 */
(function () {
  "use strict";

  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "http:" && location.protocol !== "https:") return;

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js").catch(function () {
      /* Service worker is a progressive enhancement; ignore failures. */
    });
  });
})();
