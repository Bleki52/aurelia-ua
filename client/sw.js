/**
 * ============================================================================
 * AURELIA UA — Offline-First Service Worker (v5)
 * Instant offline supermarket checkout, local caching & robust PWA runtime
 * ============================================================================
 */

const CACHE_NAME = 'aurelia-ua-v5';
const RUNTIME_API_CACHE = 'aurelia-ua-api-v5';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './catalog.html',
  './basket.html',
  './admin.html',
  './404.html',
  './css/normalize.css',
  './css/styles.css',
  './js/api.js',
  './js/qr.js',
  './js/app.js',
  './js/admin.js',
  './assets/sprite.svg',
  './assets/favicon.svg',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME, RUNTIME_API_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (!currentCaches.includes(name)) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests (mutations like POST/PUT/DELETE must never be cached)
  if (request.method !== 'GET') {
    return;
  }

  // Skip non-HTTP(S) protocols
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // 1. API Requests -> Network-First with runtime cache fallback
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(RUNTIME_API_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(JSON.stringify({ error: 'Офлайн-режим. Дані недоступні без мережі.', offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
          });
        })
    );
    return;
  }

  // 2. Navigation Requests -> Cache-First / Stale-While-Revalidate with 404 fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => {
            return cached || caches.match('./404.html') || caches.match('404.html');
          });

        return cached || fetchPromise;
      })
    );
    return;
  }

  // 3. Static Assets (CSS, JS, SVG, Web Fonts, Images, Screenshots) -> Cache-First
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Asynchronously update in background for freshness (Stale-While-Revalidate)
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
          })
          .catch(() => { /* Offline fallback — quiet */ });
        return cached;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          if (request.destination === 'image') {
            return caches.match('./assets/favicon.svg');
          }
        });
    })
  );
});
