// VP Honda PWA Service Worker v2.0.0
// Features: Caching + Auto-update + 🔔 Background Reminder Notifications

const VERSION = 'v2.0.0';
const STATIC_CACHE = `vp-honda-static-${VERSION}`;
const API_CACHE    = `vp-honda-api-${VERSION}`;
const PRECACHE_URLS = ['/', '/index.html', '/manifest.json', '/icons/icon-192x192.png', '/icons/icon-512x512.png'];

// ── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STATIC_CACHE).then(c => c.addAll(PRECACHE_URLS).catch(() => {})));
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== API_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/') || url.hostname.includes('onrender.com')) {
    e.respondWith(
      fetch(request).then(res => {
        caches.open(API_CACHE).then(c => c.put(request, res.clone()));
        return res;
      }).catch(() => caches.match(request).then(c => c ||
        new Response(JSON.stringify({ error: 'Offline', message: 'Internet नहीं है' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
      ))
    );
    return;
  }

  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        if (res.status === 200) caches.open(STATIC_CACHE).then(c => c.put(request, res.clone()));
        return res;
      }).catch(() => request.mode === 'navigate' ? caches.match('/index.html') : null);
    })
  );
});

// ── MESSAGES FROM APP ─────────────────────────────────────────────────────────
self.addEventListener('message', (e) => {
  const { type, payload } = e.data || {};
  if (type === 'SKIP_WAITING')       self.skipWaiting();
  if (type === 'SCHEDULE_REMINDERS') scheduleReminders(payload);
  if (type === 'SHOW_NOTIFICATION')  showNotif(payload.title, payload.body, payload.data);
  if (type === 'PING')               e.source?.postMessage({ type: 'PONG', version: VERSION });
});

// ── NOTIFICATION CLICK ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/reminders';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const found = list.find(c => c.url.includes(self.location.origin));
      if (found) { found.focus(); found.postMessage({ type: 'NAVIGATE', url }); return; }
      return clients.openWindow(url);
    })
  );
});

// ── PUSH (server-sent, future) ────────────────────────────────────────────────
self.addEventListener('push', (e) => {
  if (!e.data) return;
  try { const d = e.data.json(); e.waitUntil(showNotif(d.title, d.body, d)); } catch {}
});

// ── PERIODIC BACKGROUND SYNC (Chrome Android) ────────────────────────────────
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'vp-reminder-check') e.waitUntil(bgReminderCheck());
});

// ── BACKGROUND SYNC ───────────────────────────────────────────────────────────
self.addEventListener('sync', (e) => {
  if (e.tag === 'vp-reminder-sync') e.waitUntil(bgReminderCheck());
});

// ════════════════════════════════════════════════════════════════════════════════
// NOTIFICATION HELPER
// ════════════════════════════════════════════════════════════════════════════════
function showNotif(title, body, data = {}) {
  return self.registration.showNotification(title, {
    body,
    icon:             '/icons/icon-192x192.png',
    badge:            '/icons/icon-96x96.png',
    vibrate:          [200, 100, 200, 100, 300],
    tag:              data.tag  || 'vp-honda',
    renotify:         true,
    requireInteraction: data.requireInteraction || false,
    data:             { url: data.url || '/reminders', ...data },
    actions: [
      { action: 'view',    title: '👁️ देखें'    },
      { action: 'whatsapp', title: '📱 WA भेजें' },
      { action: 'dismiss', title: '✕ बाद में'   },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// SCHEDULE REMINDERS (called from app with reminder list)
// ════════════════════════════════════════════════════════════════════════════════
function scheduleReminders(reminders = []) {
  if (!Array.isArray(reminders)) return;
  const now = Date.now();
  reminders.forEach(r => {
    const fireAt = new Date(r.fireAt).getTime();
    const delay  = fireAt - now;
    if (delay <= 0) {
      // Already due — show immediately
      showNotif(r.title, r.body, { tag: r.id, url: '/reminders', requireInteraction: true });
    } else if (delay <= 48 * 60 * 60 * 1000) {
      // Due within 48 hours — schedule with setTimeout
      setTimeout(() => {
        showNotif(r.title, r.body, { tag: r.id, url: '/reminders', requireInteraction: delay < 3600000 });
      }, Math.min(delay, 2147483647));
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// BACKGROUND REMINDER CHECK (from IndexedDB — works even when app is closed)
// ════════════════════════════════════════════════════════════════════════════════
async function bgReminderCheck() {
  try {
    const db = await openDB();
    const reminders = await getAll(db);
    const today    = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    for (const r of reminders) {
      if (r.dueDate === today && !r.notifiedToday) {
        await showNotif(
          `🚨 आज Service Due है!`,
          `${r.customerName} — ${r.serviceLabel}\n🏍️ ${r.vehicleModel || ''}\n📞 ${r.phone || ''}`,
          { tag: `today-${r.id}`, url: '/reminders', requireInteraction: true }
        );
        await update(db, r.id, { notifiedToday: true });
      }
      if (r.dueDate === tomorrow && !r.notifiedTomorrow) {
        await showNotif(
          `⏰ कल Service Due है`,
          `${r.customerName} — ${r.serviceLabel}\n🏍️ ${r.vehicleModel || ''}\n📞 ${r.phone || ''}`,
          { tag: `tmrw-${r.id}`, url: '/reminders' }
        );
        await update(db, r.id, { notifiedTomorrow: true });
      }
    }
  } catch (err) {
    console.log('[SW BG] Reminder check error:', err);
  }
}

// ── IndexedDB helpers ─────────────────────────────────────────────────────────
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('vp-reminders', 1);
    req.onupgradeneeded = e => {
      if (!e.target.result.objectStoreNames.contains('reminders'))
        e.target.result.createObjectStore('reminders', { keyPath: 'id' });
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = () => rej(req.error);
  });
}
function getAll(db) {
  return new Promise((res, rej) => {
    const req = db.transaction('reminders', 'readonly').objectStore('reminders').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => rej(req.error);
  });
}
function update(db, id, changes) {
  return new Promise((res) => {
    const tx    = db.transaction('reminders', 'readwrite');
    const store = tx.objectStore('reminders');
    const get   = store.get(id);
    get.onsuccess = () => {
      if (get.result) store.put({ ...get.result, ...changes });
      res();
    };
    get.onerror = () => res();
  });
}