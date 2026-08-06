// Refrainly Progressive Web App (PWA) Service Worker
const CACHE_NAME = "refrainly-pwa-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass all network requests through smoothly
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request) as any;
    })
  );
});
