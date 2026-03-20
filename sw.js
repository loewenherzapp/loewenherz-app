// ============================================================
// Löwenherz PWA — Service Worker (Cache-First)
// ============================================================

const CACHE_NAME = 'loewenherz-v34';

const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/push.js',
  './js/db.js',
  './js/screens/landing.js',
  './js/screens/onboarding.js',
  './js/screens/dashboard.js',
  './js/screens/reflection.js',
  './js/screens/history.js',
  './js/screens/settings.js',
  './js/quatschi.js',
  './js/components/bottom-sheet.js',
  './js/components/week-dots.js',
  './js/components/balance-bar.js',
  './js/components/crisis-modal.js',
  './content/de.js',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/gundula/gundula-entspannt-112.png',
  './assets/gundula/gundula-ruhig-112.png',
  './assets/gundula/gundula-wachsam-112.png',
  './assets/gundula/gundula-tense-112.png'
];

// Install — cache all app files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch — cache first, network fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Only cache successful same-origin responses
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        // Offline fallback — return index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
