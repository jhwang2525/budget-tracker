// Caches the app shell for offline use and keeps the last transaction list available offline
const STATIC_CACHE = 'budget-static-v2';
const DATA_CACHE = 'budget-data-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/db.js',
  '/js/index.js',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== DATA_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // API: network first, fall back to the last cached response
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(DATA_CACHE).then((cache) => cache.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static files: cache first
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
