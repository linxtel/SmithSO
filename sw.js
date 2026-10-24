/**
 * ThermoOlyMaster - Offline Competition Service Worker
 * Ensures full functionality in tournament gyms and offline competition tables.
 * Caches application shell, physics simulators, exam arena, and binder tools.
 */

const CACHE_NAME = 'thermo-oly-v1.1.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/physics.js',
  '/js/physics-lab.js',
  '/js/collector-lab.js',
  '/js/predictor-arena.js',
  '/js/exam-arena.js',
  '/js/score-calc.js',
  '/js/binder-hub.js',
  '/js/test-printer.js',
  '/js/test-scanner.js',
  '/js/auth-manager.js',
  '/js/admin-dashboard.js',
  '/js/lessons-hub.js',
  '/js/sheets-sync.js',
  '/js/theme-manager.js',
  '/js/kahoot-manager.js',
  '/js/kahoot-audio.js',
  '/js/qr-code.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline competition shell');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Some pre-cache assets could not be loaded:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Bypass API calls from cache - network only
  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'Offline mode: server API not reachable' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503
        });
      })
    );
    return;
  }

  // Stale-while-revalidate for static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback to offline index if navigation request fails
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });

      return cachedResponse || fetchPromise;
    })
  );
});
