// ════════════════════════════════════════════════════════════════════════════
// VP Honda Service Worker v2.1.0
// All reminder types → phone notifications
// ════════════════════════════════════════════════════════════════════════════

const VERSION      = 'v2.1.0';
const STATIC_CACHE = `vp-honda-static-${VERSION}`;
const API_CACHE    = `vp-honda-api-${VERSION}`;
const PRECACHE     = ['/', '/index.html', '/manifest.json',
  '/icons/icon-192x192.png', '/icons/icon-512x512.png'];

// ── Notification icons per type ─────────────────────────────────────────────
const TYPE_META = {
  'service':          { badge: '🔧', color: '#ea580c', tag: 'svc' },
  'payment':          { badge: '💰', color: '#16a34a', tag: 'pay' },
  'insurance':        { badge: '🚗', color: '#7c3aed', tag: 'rto' },
  'insurance-renewal':{ badge: '🛡️', color: '#DC0000', tag: 'ins' },
};

// ── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(caches.open(STATIC_CACHE).then(c => c.addAll(PRECACHE).catch(() => {})));
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== STATIC_CACHE && k !== API_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH (Caching strategy) ─────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // API → Network first, cache fallback
  if (url.pathname.startsWith('/api/') || url.hostname.includes('onrender.com')) {
    e.respondWith(
      fetch(request)
        .then(res => { caches.open(API_CACHE).then(c => c.put(request, res.clone())); return res; })
        .catch(() => caches.match(request).then(c => c ||
          new Response(JSON.stringify({ error:'Offline', message:'इंटरनेट नहीं है' }),
            { status:503, headers:{'Content-Type':'application/json'} })
        ))
    );
    return;
  }

  // Static → Cache first, network fallback
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
self.addEventListener('message', e => {
  const { type, payload } = e.data || {};
  if (type === 'SKIP_WAITING')       self.skipWaiting();
  if (type === 'SCHEDULE_REMINDERS') processSchedule(payload);
  if (type === 'SHOW_NOTIFICATION')  showNotif(payload.title, payload.body, payload.data || {});
  if (type === 'PING')               e.source?.postMessage({ type:'PONG', version:VERSION });
});

// ── NOTIFICATION CLICK ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const { action } = e;
  const data = e.notification.data || {};
  const url  = data.url || '/';

  // dismiss action — just close, no navigate
  if (action === 'dismiss') return;

  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      const found = list.find(c => c.url.includes(self.location.origin));
      if (found) {
        found.focus();
        found.postMessage({ type:'NAVIGATE', url });
        return;
      }
      return clients.openWindow(url);
    })
  );
});

// ── PUSH (server-sent, future) ────────────────────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return;
  try {
    const d = e.data.json();
    // d = { title, body, url, icon, badge } from web-push
    e.waitUntil(
      self.registration.showNotification(d.title || 'VP Honda', {
        body:               d.body || '',
        icon:               d.icon  || '/icons/icon-192x192.png',
        badge:              d.badge || '/icons/icon-96x96.png',
        vibrate:            [200, 100, 200],
        tag:                d.tag || 'vp-chat',
        renotify:           true,
        requireInteraction: false,
        data:               { url: d.url || '/chat', type: d.type || 'chat' },
        actions: [
          { action: 'open',    title: '💬 खोलें'    },
          { action: 'dismiss', title: '✕ बंद करें'  },
        ],
      })
    );
  } catch (err) {
    console.error('[SW Push]', err);
  }
});

// ── PERIODIC BACKGROUND SYNC ──────────────────────────────────────────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'vp-reminder-check') e.waitUntil(bgCheck());
});

self.addEventListener('sync', e => {
  if (e.tag === 'vp-reminder-sync') e.waitUntil(bgCheck());
});

// ════════════════════════════════════════════════════════════════════════════
// NOTIFICATION DISPLAY
// ════════════════════════════════════════════════════════════════════════════
function showNotif(title, body, data = {}) {
  const meta = TYPE_META[data.type] || { badge:'🔔', tag:'vp' };

  return self.registration.showNotification(title, {
    body,
    icon:               '/icons/icon-192x192.png',
    badge:              '/icons/icon-96x96.png',
    vibrate:            [200, 100, 200, 100, 300],
    tag:                data.tag || `vp-${meta.tag}`,
    renotify:           true,
    requireInteraction: data.requireInteraction || false,
    silent:             false,
    data:               { url: data.url || '/reminders', type: data.type, ...data },
    actions: [
      { action: 'view',    title: '👁️ देखें'    },
      { action: 'whatsapp', title: '📱 WA भेजें' },
      { action: 'dismiss', title: '✕ बाद में'   },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SCHEDULE PROCESSING (from app message)
// ════════════════════════════════════════════════════════════════════════════
const scheduledTimers = new Map();

function processSchedule(items = []) {
  if (!Array.isArray(items)) return;

  // Cancel old timers
  scheduledTimers.forEach(t => clearTimeout(t));
  scheduledTimers.clear();

  const now = Date.now();

  // Show overdue/today immediately (with small stagger to avoid spam)
  const immediate = items.filter(i => new Date(i.fireAt).getTime() <= now + 5000);
  const scheduled_items = items.filter(i => new Date(i.fireAt).getTime() > now + 5000);

  // Show immediate notifications with stagger
  immediate.forEach((item, idx) => {
    setTimeout(() => {
      showNotif(item.title, item.body, {
        url:                item.url || '/reminders',
        tag:                item.tag || `vp-${idx}`,
        type:               item.type,
        requireInteraction: item.requireInteraction,
      });
    }, idx * 1500);  // 1.5 sec stagger
  });

  // Schedule future ones
  scheduled_items.forEach(item => {
    const fireAt = new Date(item.fireAt).getTime();
    const delay  = fireAt - now;
    if (delay <= 48 * 3600 * 1000) {
      const timer = setTimeout(() => {
        showNotif(item.title, item.body, {
          url:                item.url || '/reminders',
          tag:                item.tag,
          type:               item.type,
          requireInteraction: item.requireInteraction,
        });
      }, Math.min(delay, 2147483647));
      scheduledTimers.set(item.id, timer);
    }
  });

  console.log(`[SW] ${immediate.length} immediate + ${scheduled_items.length} scheduled reminders`);
}

// ════════════════════════════════════════════════════════════════════════════
// BACKGROUND CHECK (from periodic sync / IDB)
// ════════════════════════════════════════════════════════════════════════════
async function bgCheck() {
  try {
    const db        = await openDB();
    const reminders = await getAll(db);
    if (!reminders.length) return;

    const now      = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const tmrwStr  = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

    for (const r of reminders) {
      const meta = TYPE_META[r.type] || TYPE_META['service'];

      // Today due
      if (r.dueDate === todayStr && !r.notifiedToday) {
        await showNotif(
          buildBgTitle(r, 'today'),
          buildBgBody(r),
          { tag:`td-${r.id}`, url:'/reminders', type:r.type, requireInteraction:true }
        );
        await markField(db, r.id, 'notifiedToday', true);
      }

      // Tomorrow due
      if (r.dueDate === tmrwStr && !r.notifiedTomorrow) {
        await showNotif(
          buildBgTitle(r, 'tomorrow'),
          buildBgBody(r),
          { tag:`tm-${r.id}`, url:'/reminders', type:r.type }
        );
        await markField(db, r.id, 'notifiedTomorrow', true);
      }

      // Overdue (notify once per day)
      if (r.daysRemaining < 0 && !r.notifiedOverdue) {
        await showNotif(
          buildBgTitle(r, 'overdue'),
          buildBgBody(r),
          { tag:`ov-${r.id}`, url:'/reminders', type:r.type, requireInteraction:true }
        );
        await markField(db, r.id, 'notifiedOverdue', true);
      }
    }
  } catch(err) {
    console.log('[SW BG] Check failed:', err);
  }
}

// ── Background notification text builders ────────────────────────────────────
function buildBgTitle(r, when) {
  const name = r.customerName || 'Customer';
  const map = {
    service: {
      today:    `🔧 Service Due Today — ${name}`,
      tomorrow: `🔧 Service Due कल — ${name}`,
      overdue:  `⚠️ Service Overdue! — ${name}`,
    },
    payment: {
      today:    `💰 Payment Due Today — ${name}`,
      tomorrow: `💰 Payment Due कल — ${name}`,
      overdue:  `🚨 Payment Overdue! — ${name}`,
    },
    insurance: {
      today:    `🚗 RTO Deadline Today — ${name}`,
      tomorrow: `🚗 RTO Deadline कल — ${name}`,
      overdue:  `🚗 RTO Overdue! — ${name}`,
    },
    'insurance-renewal': {
      today:    `🛡️ Insurance Expires Today — ${name}`,
      tomorrow: `🛡️ Insurance कल Expire — ${name}`,
      overdue:  `🛡️ Insurance Expired! — ${name}`,
    },
  };
  return map[r.type]?.[when] || `🔔 Reminder — ${name}`;
}

function buildBgBody(r) {
  const parts = [r.serviceLabel];
  if (r.vehicleModel) parts.push(`🏍️ ${r.vehicleModel}`);
  if (r.regNo)        parts.push(r.regNo);
  if (r.phone)        parts.push(`📞 ${r.phone}`);
  if (r.amount > 0)   parts.push(`₹${Number(r.amount).toLocaleString('en-IN')}`);
  if (r.daysRemaining < 0) parts.push(`⚠️ ${Math.abs(r.daysRemaining)} दिन overdue`);
  return parts.join('\n');
}

// ── IndexedDB helpers ─────────────────────────────────────────────────────────
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('vp-reminders', 1);
    req.onupgradeneeded = e => {
      if (!e.target.result.objectStoreNames.contains('reminders'))
        e.target.result.createObjectStore('reminders', { keyPath:'id' });
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = () => rej(req.error);
  });
}
function getAll(db) {
  return new Promise((res, rej) => {
    const req = db.transaction('reminders','readonly').objectStore('reminders').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => rej(req.error);
  });
}
function markField(db, id, field, value) {
  return new Promise(res => {
    const tx  = db.transaction('reminders','readwrite');
    const s   = tx.objectStore('reminders');
    const get = s.get(id);
    get.onsuccess = () => {
      if (get.result) s.put({ ...get.result, [field]: value });
      res();
    };
    get.onerror = () => res();
  });
}