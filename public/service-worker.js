// ════════════════════════════════════════════════════════════════════════════
// VP Honda Service Worker v2.6.0
// All reminder types → phone notifications
// ════════════════════════════════════════════════════════════════════════════

const VERSION      = 'v2.6.0';
const STATIC_CACHE = `vp-honda-static-${VERSION}`;
const API_CACHE    = `vp-honda-api-${VERSION}`;
const PRECACHE     = ['/index.html', '/manifest.json',
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
// ⚠️ FIX v2.2.0: पहले HTML/navigation भी "cache first" था, इसलिए नया deploy होने पर भी
// phone पर पुराना ही page दिखता रहता था. अब navigation हमेशा NETWORK FIRST है.
self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // 1. Page navigation (HTML) → NETWORK FIRST, offline पर ही cache
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put('/index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/index.html').then(c => c || caches.match('/')))
    );
    return;
  }

  // 2. API → Network first, cache fallback
  if (url.pathname.startsWith('/api/') || url.hostname.includes('onrender.com')) {
    e.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(API_CACHE).then(c => c.put(request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(request).then(c => c ||
          new Response(JSON.stringify({ error:'Offline', message:'इंटरनेट नहीं है' }),
            { status:503, headers:{'Content-Type':'application/json'} })
        ))
    );
    return;
  }

  // 3. Same-origin static assets (hashed JS/CSS/icons) → Cache first
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then(c => c.put(request, copy)).catch(() => {});
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // 4. Cross-origin → सीधे network
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
  // ⚠️ सिर्फ़ इसी notification को बंद करें. बाक़ी tray में जस के तस रहें —
  // ताकि आप एक-एक करके सबको खोल सकें. (कहीं भी getNotifications().close()
  // नहीं है, और नीचे navigate करने के बाद हम schedule दोबारा नहीं चलाते.)
  e.notification.close();
  const { action } = e;
  if (action === 'dismiss') return;  // बाद में — कुछ न करें
  const data = e.notification.data || {};
  const url  = data.url || '/reminders';
  const fullUrl = new URL(url, self.location.origin).href;

  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(async list => {
      // existing window मिले तो उसे focus + navigate करें
      const found = list.find(c => c.url.includes(self.location.origin));
      if (found) {
        await found.focus();
        // ⚠️ FIX v2.5.0 — यहीं "Back दबाने पर पूरा app बंद हो जाता है" वाली
        // दिक़्क़त थी.
        //
        // पहले `client.navigate(fullUrl)` पहले चलता था. वह browser-स्तर की
        // navigation है — यानी पूरा app दोबारा load (5–10 सेकंड) और पिछली
        // history मिट जाती है. इसलिए Back दबाते ही app ही बंद हो जाता था.
        //
        // अब पहले postMessage जाता है — app उसे सुनकर React Router से turant
        // page बदलता है, कुछ reload नहीं होता और Back सही काम करता है.
        // client.navigate() सिर्फ़ तब, जब postMessage का रास्ता ही न हो.
        try {
          found.postMessage({ type:'NAVIGATE', url });
          return;
        } catch {}
        if ('navigate' in found) {
          try { await found.navigate(fullUrl); return; } catch {}
        }
        return;
      }
      // कोई window नहीं — नया खोलें उस specific URL पर
      return clients.openWindow(fullUrl);
    })
  );
});

// ── BACKGROUND SYNC — offline में लिखा हुआ काम internet आते ही भेजो ───────────
// App बंद हो तब भी browser यह चला देता है. IndexedDB की वही कतार जो
// src/utils/offlineQueue.js भरता है.
const Q_DB = 'vp-honda-offline', Q_STORE = 'writeQueue';

function qOpen() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(Q_DB, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(Q_STORE)) {
        r.result.createObjectStore(Q_STORE, { keyPath:'id', autoIncrement:true });
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror   = () => reject(r.error);
  });
}

function qTx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(Q_STORE, mode);
    const out = fn(t.objectStore(Q_STORE));
    t.oncomplete = () => resolve(out?.result);
    t.onerror    = () => reject(t.error);
  });
}

async function flushWriteQueue() {
  let db;
  try { db = await qOpen(); } catch { return; }
  let items = [];
  try { items = (await qTx(db, 'readonly', s => s.getAll())) || []; } catch { return; }

  for (const it of items.sort((a, b) => a.createdAt - b.createdAt)) {
    try {
      const res = await fetch(it.url, { method: it.method, headers: it.headers, body: it.body });
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        await qTx(db, 'readwrite', s => s.delete(it.id));
      } else {
        it.tries = (it.tries || 0) + 1;
        await qTx(db, 'readwrite', s => (it.tries > 8 ? s.delete(it.id) : s.put(it)));
      }
    } catch { return; }   // network फिर गया — अगली बार
  }

  // खुली हुई tab को बता दो ताकि "X बाक़ी" वाला बिल्ला अपडेट हो जाए
  const cs = await self.clients.matchAll({ type:'window' });
  cs.forEach(c => { try { c.postMessage({ type:'QUEUE_FLUSHED' }); } catch {} });
}

self.addEventListener('sync', e => {
  if (e.tag === 'vp-write-queue') e.waitUntil(flushWriteQueue());
});

self.addEventListener('periodicsync', e => {
  if (e.tag === 'vp-write-queue') e.waitUntil(flushWriteQueue());
});

// ── PUSH (server-sent, future) ────────────────────────────────────────────────
// ⚠️ FIX v2.2.0: पहले payload parse fail होने पर चुपचाप कुछ नहीं होता था —
// Chrome फिर खुद "site updated in background" जैसी fallback notification दिखाता था.
// अब हर हाल में एक notification दिखती है (Android इसी की demand करता है).
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let d = null;
    try { d = e.data ? e.data.json() : null; } catch {
      try { d = { title: 'VP Honda', body: e.data.text() }; } catch {}
    }
    if (!d || !d.title) d = { title: '🔔 VP Honda', body: 'नया reminder — खोलने के लिए tap करें', url: '/reminders' };
    try { await showNotif(d.title, d.body || '', d); }
    catch (err) {
      await self.registration.showNotification('🔔 VP Honda', {
        body: d.body || 'नया reminder', icon: '/icons/icon-192x192.png',
        data: { url: d.url || '/reminders' },
      });
    }
  })());
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
async function showNotif(title, body, data = {}) {
  // ⭐ अगर इसी tag की notification पहले से tray में है तो कुछ मत करो —
  // न replace, न दोबारा आवाज़. इससे "बाकी notifications गायब हो गए" वाली
  // दिक्क़त पूरी तरह ख़त्म होती है.
  try {
    const tagToCheck = data.tag || null;
    if (tagToCheck) {
      const existing = await self.registration.getNotifications({ tag: tagToCheck });
      if (existing && existing.length) return;
    }
  } catch {}

  const meta = TYPE_META[data.type] || { badge:'🔔', tag:'vp' };

  return self.registration.showNotification(title, {
    body,
    icon:               '/icons/icon-192x192.png',
    badge:              '/icons/icon-96x96.png',
    vibrate:            [200, 100, 200, 100, 300],
    tag:                data.tag || `vp-${meta.tag}`,
    // ⚠️ FIX v2.3.0: पहले renotify:true था. उसी tag की notification दोबारा भेजने
    // पर Android पुरानी को हटाकर नई दिखाता था और फिर से आवाज़/vibration करता था.
    // App खोलने पर schedule दोबारा चलता था, इसलिए notifications गायब-आते दिखते थे.
    renotify:           false,
    requireInteraction: data.requireInteraction || false,
    silent:             false,
    data:               { url: data.url || '/reminders', type: data.type, ...data },
    // ⚠️ Android/Chrome सिर्फ 2 actions दिखाता है (Notification.maxActions).
    // पहले 3 थे और 'whatsapp' का कोई handler भी नहीं था — इसलिए वह हटा दिया.
    actions: [
      { action: 'view',    title: '👁️ देखें'  },
      { action: 'dismiss', title: '✕ बाद में' },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SCHEDULE PROCESSING (from app message)
// ════════════════════════════════════════════════════════════════════════════
const scheduledTimers = new Map();

// इस SW के जीवनकाल में जो tag पहले ही दिखाए जा चुके हैं
const shownTags = new Set();

function processSchedule(items = []) {
  if (!Array.isArray(items)) return;

  // पुराने timers रद्द करो (पर दिखाई जा चुकी notifications को हाथ मत लगाओ)
  scheduledTimers.forEach(t => clearTimeout(t));
  scheduledTimers.clear();

  const now = Date.now();

  items.forEach(item => {
    // ⭐ FIX v2.3.0: App खोलने पर यह function दोबारा चलता था और बीत चुके समय
    // वाली सारी notifications फिर से fire हो जाती थीं. अब एक tag एक बार.
    if (item.tag && shownTags.has(item.tag)) return;
    const fireAt = new Date(item.fireAt).getTime();
    const delay  = fireAt - now;

    if (delay <= 500) {
      // Fire immediately
      if (item.tag) shownTags.add(item.tag);
      showNotif(item.title, item.body, {
        url:                item.url || '/reminders',
        tag:                item.tag,
        type:               item.type,
        requireInteraction: item.requireInteraction,
      });
    } else if (delay <= 5 * 60 * 1000) {
      // ⚠️ FIX v2.4.0 — "कभी notification आते हैं कभी नहीं" की असली वजह यही थी.
      //
      // पहले यहाँ 48 घंटे तक का setTimeout लगाया जाता था. पर Service Worker
      // ~30 सेकंड बेकार बैठने पर browser अपने आप बंद कर देता है, और बंद होते ही
      // सारे setTimeout मिट जाते हैं. यानी कल सुबह वाली notification कभी
      // चलती ही नहीं थी — और यह चुपचाप fail होता था, कोई error भी नहीं.
      //
      // अब यहाँ सिर्फ़ 5 मिनट तक का timer लगता है (app खुली हो तब भरोसेमंद).
      // App बंद होने पर की सारी notifications **server push** से आती हैं —
      // Vercel Cron → /api/send-reminders. वही एकमात्र भरोसेमंद रास्ता है.
      const timer = setTimeout(() => {
        if (item.tag) shownTags.add(item.tag);
        showNotif(item.title, item.body, {
          url:                item.url || '/reminders',
          tag:                item.tag,
          type:               item.type,
          requireInteraction: item.requireInteraction,
        });
      }, delay);
      scheduledTimers.set(item.id, timer);
    }
    // 5 मिनट से आगे की notifications जान-बूझकर छोड़ी जाती हैं —
    // वे server push की ज़िम्मेदारी हैं.
  });

  console.log(`[SW] ${items.length} reminders processed`);
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