// Minimal service worker: cache the app shell, always go to network for the API.
const CACHE = "aata-sf-assistant-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Never cache API calls — always fetch live Salesforce data.
  if (request.method !== "GET" || request.url.includes("/api/")) return;

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
