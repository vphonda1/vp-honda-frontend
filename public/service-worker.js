// v2.8.0 – safe clone + push notifications
const VERSION = 'v2.8.0';
const STATIC_CACHE = `vp-honda-static-${VERSION}`;
const API_CACHE = `vp-honda-api-${VERSION}`;
const PRECACHE = ['/', '/index.html', '/manifest.json', '/icons/icon-192x192.png', '/icons/icon-512x512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(STATIC_CACHE).then(c => c.addAll(PRECACHE).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== API_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || url.hostname.includes('onrender.com')) {
    e.respondWith(fetch(request).then(res => {
      if (!res.bodyUsed && res.type !== 'opaque') {
        try { const clone = res.clone(); caches.open(API_CACHE).then(c => c.put(request, clone)).catch(() => {}); } catch(e) {}
      }
      return res;
    }).catch(() => caches.match(request).then(c => c || new Response(JSON.stringify({ error: 'Offline' }), { status: 503 }))));
    return;
  }
  e.respondWith(caches.match(request).then(cached => cached || fetch(request).then(res => {
    if (res.status === 200 && !res.bodyUsed && res.type !== 'opaque') {
      try { const clone = res.clone(); caches.open(STATIC_CACHE).then(c => c.put(request, clone)).catch(() => {}); } catch(e) {}
    }
    return res;
  }).catch(() => request.mode === 'navigate' ? caches.match('/index.html') : null)));
});

self.addEventListener('push', event => {
  let data = { title: 'VP Honda', body: 'New update', url: '/reminders', icon: '/icons/icon-192x192.png' };
  if (event.data) {
    try { data = event.data.json(); } catch(e) { data.body = event.data.text(); }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge || '/icons/icon-96x96.png',
      vibrate: [200, 100, 200],
      tag: 'vp-honda-push',
      renotify: true,
      requireInteraction: true,
      data: { url: data.url || '/reminders' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsList => {
    for (const client of clientsList) if (client.url === targetUrl && 'focus' in client) return client.focus();
    if (clients.openWindow) return clients.openWindow(targetUrl);
  }));
});