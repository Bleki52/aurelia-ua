/**
 * ============================================================================
 * AURELIA UA — Network-First Auto-Updating Service Worker
 * Guarantees online users always receive the newest deployment immediately,
 * while preserving 100% offline QR wallet functionality at checkout.
 * ============================================================================
 */

const CACHE_NAME = 'aurelia-ua-v1794677429615';

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
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests (mutations like POST/PUT/DELETE must never be cached)
  if (request.method !== 'GET') {
    return;
  }

  // Skip non-HTTP(S) protocols and browser-internal only-if-cached cross-origin requests
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') ||
      (request.cache === 'only-if-cached' && request.mode !== 'same-origin')) {
    return;
  }

  // 1. API GET Requests -> Network-First (cache ONLY public unauthenticated catalog/health endpoints)
  if (url.pathname.includes('/api/')) {
    const isPublicCatalog = url.pathname.includes('/api/products') || url.pathname.includes('/api/health');
    const hasAuth = request.headers && request.headers.has('Authorization');

    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((response) => {
          if (isPublicCatalog && !hasAuth && response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          if (isPublicCatalog && !hasAuth) {
            const cached = await caches.match(request);
            if (cached) return cached;
          }
          return new Response(JSON.stringify({ error: 'Офлайн-режим. Дані недоступні без мережі.', offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
          });
        })
    );
    return;
  }

  // 2. HTML Navigation & All Static Assets (CSS, JS, SVG, Images) -> Network-First with Cache Fallback
  event.respondWith(
    fetch(request, { cache: 'no-cache' })
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        if (request.mode === 'navigate') {
          return (await caches.match('./404.html')) || (await caches.match('404.html')) || Response.error();
        }
        if (request.destination === 'image') {
          return (await caches.match('./assets/favicon.svg')) || Response.error();
        }
        return Response.error();
      })
  );
});
