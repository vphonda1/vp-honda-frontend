// ════════════════════════════════════════════════════════════════════════════
// VP Honda PWA Service Worker
// • Caches static assets for fast load
// • Network-first strategy for API calls (always fresh data)
// • Auto-update: When new version deployed, updates silently in background
// ════════════════════════════════════════════════════════════════════════════

// ⚠️ IMPORTANT: Bump this version when you deploy major updates
// This forces all users to get the new version on next app open
const VERSION = 'v1.0.0';
const STATIC_CACHE = `vp-honda-static-${VERSION}`;
const API_CACHE = `vp-honda-api-${VERSION}`;

// Files to cache on install (basic shell)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ────────── INSTALL ──────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version', VERSION);
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Pre-cache failed (continuing anyway):', err);
      });
    })
  );
  // Activate immediately, don't wait for old SW
  self.skipWaiting();
});

// ────────── ACTIVATE (clean up old caches) ──────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version', VERSION);
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
            .map((k) => {
              console.log('[SW] Deleting old cache:', k);
              return caches.delete(k);
            })
      );
    }).then(() => self.clients.claim())
  );
});

// ────────── FETCH STRATEGY ──────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't cache POST/PUT/DELETE
  if (request.method !== 'GET') return;

  // Strategy 1: API calls — Network first, fallback to cache
  // Why? Always show fresh data, but work offline if possible
  if (url.pathname.startsWith('/api/') || url.hostname.includes('onrender.com')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone response (it can only be consumed once)
          const responseClone = response.clone();
          caches.open(API_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Network failed - try cache
          return caches.match(request).then((cached) => {
            if (cached) {
              console.log('[SW] Serving cached API response (offline)');
              return cached;
            }
            // No cache either — return offline message
            return new Response(JSON.stringify({
              error: 'Offline',
              message: 'इंटरनेट नहीं है। कृपया फिर से कोशिश करें।'
            }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // Strategy 2: Static assets — Cache first, fallback to network
  // Why? Fast load, save bandwidth
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Offline + no cache: serve index.html for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ────────── MESSAGE (for manual update trigger) ──────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});