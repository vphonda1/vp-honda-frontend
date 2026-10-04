// src/registerSW.js — VP Honda PWA Service Worker Registration
// Handles: SW registration, update banner, install prompt, navigation from SW
//
// ════════════════════════════════════════════════════════════════════════════
// ⚠️ इस बार के सुधार (Install / Update संदेश वापस लाने के लिए)
// ════════════════════════════════════════════════════════════════════════════
// 1. Update संदेश — पहले नया Service Worker install होते ही खुद को चालू कर
//    लेता था (skipWaiting) और page अपने आप reload हो जाता था. इसलिए
//    "नया Update उपलब्ध है" वाला banner या तो दिखता ही नहीं था या आधे सेकंड
//    में गायब. अब नया version **रुककर इंतज़ार** करता है, banner दिखता है,
//    और "Update करें" दबाने पर ही लगता है. Banner हटा दिया हो तो अगली बार
//    app खोलने पर फिर दिखेगा (पहले नहीं दिखता था).
// 2. Update की जाँच — अब app पर वापस आते ही भी (हर 10 मिनट में ज़्यादा से
//    ज़्यादा एक बार), सिर्फ़ 30 मिनट वाले timer पर निर्भर नहीं.
// 3. Install संदेश — 30 सेकंड की जगह 8 सेकंड बाद; "×" दबाने पर 3 दिन चुप.
// 4. पहली बार install पर बेवजह होने वाला page reload बंद.
// 5. Notification से app खुला और login बाक़ी था → login के बाद वही पन्ना.
// ════════════════════════════════════════════════════════════════════════════

import { scheduleReminderNotifications } from './utils/notificationScheduler';

let swRegistration = null;
let userAskedUpdate = false;
let lastUpdateCheck = 0;
const UPDATE_CHECK_GAP_MS = 10 * 60 * 1000;   // 10 मिनट

function checkForUpdate() {
  if (!swRegistration) return;
  const now = Date.now();
  if (now - lastUpdateCheck < UPDATE_CHECK_GAP_MS) return;
  lastUpdateCheck = now;
  swRegistration.update().catch(() => {});
}

// ── Register Service Worker ──────────────────────────────────────────────────
export const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) return;

  // पहली बार खुलते समय page पर कोई SW नहीं था? तो बाद में आने वाला
  // controllerchange "update" नहीं है — reload की ज़रूरत नहीं.
  const hadController = !!navigator.serviceWorker.controller;

  const start = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        updateViaCache: 'none',   // हर बार असली नई file जाँचो, browser cache नहीं
      });
      swRegistration = registration;
      lastUpdateCheck = Date.now();
      console.log('✅ VP Honda SW registered:', registration.scope);

      // ⭐ पहले से कोई नया version इंतज़ार कर रहा है (पिछली बार banner हटा दिया था)
      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateBanner(registration);
      }

      // नया SW मिला → install पूरा होते ही banner
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(registration);
          }
        });
      });

      // ⏱️ 30 मिनट में एक बार जाँच — सिर्फ़ तब जब app सामने हो
      const swUpdateTimer = setInterval(() => {
        if (!document.hidden) checkForUpdate();
      }, 30 * 60 * 1000);
      window.addEventListener('pagehide', () => clearInterval(swUpdateTimer));

      // Schedule reminders after SW is ready
      setTimeout(() => scheduleRemindersNow(), 5000);

      // app पर वापस आते ही: update की जाँच + reminders (दोनों अपनी रोक के साथ)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkForUpdate();
          scheduleRemindersNow();
        }
      });
    } catch (err) {
      console.warn('SW registration failed:', err);
    }
  };

  // ⚠️ पहले सिर्फ़ window 'load' पर register होता था. अगर किसी वजह से
  // load पहले ही हो चुका हो तो register कभी होता ही नहीं था.
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });

  // नया SW चालू हुआ → page reload (ताकि नया code लगे)
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    if (!hadController && !userAskedUpdate) return;   // पहली बार install — reload नहीं
    if (!userAskedUpdate) {
      // किसी दूसरी tab में Update दबाया गया. यहाँ कोई form भरा जा रहा हो तो
      // reload मत करो — अगली बार खुलने पर नया version अपने आप लगेगा.
      const busy = document.querySelector('input:focus, textarea:focus, select:focus')
                || document.querySelector('[data-vp-modal-open]');
      if (busy) {
        console.log('[SW] नया version तैयार है — काम ख़त्म होने पर अपने आप लगेगा');
        return;
      }
    }
    refreshing = true;
    window.location.reload();
  });

  // ⭐ Service Worker ने app को "/#nav=/reminders?rid=…" पर खोला हो तो
  // वहीं ले जाओ. (SW हमेशा "/" खोलता है ताकि host का 404 कभी न आए —
  // असली जगह hash में आती है.)
  try {
    const h = window.location.hash || '';
    if (h.startsWith('#nav=')) {
      const target = decodeURIComponent(h.slice(5));
      // hash हटा दो, वरना refresh पर बार-बार वहीं जाता रहेगा
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
      if (target.startsWith('/')) {
        // login बाक़ी हो तो भी जगह याद रहे — App.jsx का NotificationNavigator
        // login के बाद इसे पढ़कर वहीं ले जाता है
        try { sessionStorage.setItem('vp_pending_nav', target); } catch {}
        // App.jsx का NotificationNavigator इसे सुनकर बिना reload page बदल देगा
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('vp-navigate', { detail: target }));
        }, 60);
      }
    }
  } catch {}

  // NAVIGATE message (app खुला हो तब notification click) — App.jsx का
  // NotificationNavigator संभालता है, React Router से बिना reload.
};

// ── Schedule Reminders from localStorage/API ─────────────────────────────────
// हर 4 घंटे में ज़्यादा से ज़्यादा एक बार चलता है.
const SCHEDULE_THROTTLE_MS = 4 * 60 * 60 * 1000;   // 4 घंटे
const SCHEDULE_KEY = 'vp_last_reminder_schedule';
let scheduleRunning = false;

export async function scheduleRemindersNow({ force = false } = {}) {
  // एक साथ दो बार न चले (app load + login दोनों एक साथ बुलाते हैं)
  if (scheduleRunning) return;
  try {
    // notification की अनुमति ही नहीं → server को जगाने का कोई फ़ायदा नहीं
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    if (!force) {
      const last = parseInt(localStorage.getItem(SCHEDULE_KEY) || '0', 10);
      if (last && Date.now() - last < SCHEDULE_THROTTLE_MS) return;
    }
    scheduleRunning = true;

    // सही source `/api/service-data` है (वही जो RemindersPage इस्तेमाल करता है).
    const base = localStorage.getItem('vpApiBase') || 'https://vp-honda-backend.onrender.com';
    let records = [];

    try {
      const res = await fetch(`${base}/api/service-data`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const fresh = await res.json();
        if (Array.isArray(fresh)) records = fresh;
      }
    } catch {}

    // Fallback 1: localStorage में RemindersPage का cached service data
    if (records.length === 0) {
      try {
        const sd = JSON.parse(localStorage.getItem('customerServiceData') || '{}');
        records = Object.values(sd || {});
      } catch {}
    }

    // Fallback 2: पुराना customers cache
    if (records.length === 0) {
      try {
        const cached = localStorage.getItem('vpCustomers') || localStorage.getItem('vp_customers');
        if (cached) records = JSON.parse(cached) || [];
      } catch {}
    }

    if (records.length > 0) {
      const result = await scheduleReminderNotifications(records);
      localStorage.setItem(SCHEDULE_KEY, String(Date.now()));
      console.log(`[SW] Reminders scheduled: ${result?.scheduled?.length || 0} (${records.length} records)`);
    }
  } catch (err) {
    console.warn('[SW] scheduleRemindersNow failed:', err);
  } finally {
    scheduleRunning = false;
  }
}

// ── Update Banner UI ──────────────────────────────────────────────────────────
function showUpdateBanner(registration) {
  if (document.getElementById('vp-update-banner')) return;
  // install वाला banner भी खुला हो तो उसे हटाओ — दोनों एक जगह आते हैं
  hideInstallHint();

  const banner = document.createElement('div');
  banner.id = 'vp-update-banner';
  banner.innerHTML = `
    <div style="
      position:fixed; bottom:calc(16px + var(--vp-bottom-nav, 0px)); left:16px; right:16px; max-width:400px;
      margin:0 auto; background:linear-gradient(135deg,#DC0000,#B91C1C);
      color:white; padding:14px 18px; border-radius:12px;
      box-shadow:0 10px 40px rgba(220,0,0,0.4); z-index:9999;
      display:flex; align-items:center; gap:12px;
      font-family:-apple-system,sans-serif; animation:vp-slide-up 0.3s ease;
    ">
      <div style="font-size:24px;">🔄</div>
      <div style="flex:1; min-width:0;">
        <div style="font-weight:700; font-size:14px;">नया Update उपलब्ध है!</div>
        <div style="font-size:12px; opacity:0.9; margin-top:2px;">नए सुधार लगाने के लिए Update दबाएँ</div>
      </div>
      <button id="vp-update-btn" style="
        background:white; color:#DC0000; border:none; padding:8px 14px;
        border-radius:8px; font-weight:700; cursor:pointer; font-size:13px; white-space:nowrap;">
        Update करें
      </button>
      <button id="vp-update-dismiss" aria-label="बंद करें" style="
        background:transparent; color:white; border:1px solid rgba(255,255,255,0.4);
        padding:8px 10px; border-radius:8px; cursor:pointer; font-size:13px;">×</button>
    </div>
    <style>
      @keyframes vp-slide-up { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
    </style>
  `;
  document.body.appendChild(banner);

  document.getElementById('vp-update-btn').addEventListener('click', () => {
    userAskedUpdate = true;
    const waiting = registration.waiting;
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' });
      // controllerchange पर reload होगा; किसी वजह से न हो तो 4 सेकंड बाद ख़ुद
      setTimeout(() => window.location.reload(), 4000);
    } else {
      // नया SW पहले ही चालू हो चुका — बस page ताज़ा कर दो
      window.location.reload();
    }
    banner.remove();
  });
  document.getElementById('vp-update-dismiss').addEventListener('click', () => banner.remove());
}

// ── Install Prompt ────────────────────────────────────────────────────────────
let deferredPrompt = null;
const INSTALL_DISMISS_KEY = 'vp_install_dismissed';
const INSTALL_DISMISS_MS  = 3 * 86400000;   // × दबाने पर 3 दिन चुप

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  setTimeout(showInstallHint, 8000);   // 8 सेकंड बाद
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  hideInstallHint();
});

function showInstallHint() {
  if (!deferredPrompt) return;
  if (document.getElementById('vp-install-hint')) return;
  if (document.getElementById('vp-update-banner')) return;   // update ज़्यादा ज़रूरी
  try {
    const dismissed = localStorage.getItem(INSTALL_DISMISS_KEY);
    if (dismissed && Date.now() - parseInt(dismissed, 10) < INSTALL_DISMISS_MS) return;
  } catch {}

  const hint = document.createElement('div');
  hint.id = 'vp-install-hint';
  hint.innerHTML = `
    <div style="
      position:fixed; bottom:calc(16px + var(--vp-bottom-nav, 0px)); left:16px; right:16px; max-width:360px;
      margin:0 auto; background:linear-gradient(135deg,#DC0000,#B91C1C);
      color:white; padding:14px; border-radius:14px;
      box-shadow:0 10px 40px rgba(220,0,0,0.4); z-index:9998;
      display:flex; align-items:center; gap:12px; font-family:-apple-system,sans-serif;
      animation:vp-slide-up 0.4s ease;
    ">
      <div style="font-size:32px;">📱</div>
      <div style="flex:1; min-width:0;">
        <div style="font-weight:800; font-size:14px;">VP Honda को Install करें</div>
        <div style="font-size:11px; opacity:0.9; margin-top:2px;">Phone पर असली App की तरह चलाएँ</div>
      </div>
      <button id="vp-install-yes" style="background:white;color:#DC0000;border:none;padding:8px 14px;border-radius:8px;font-weight:800;font-size:13px;cursor:pointer">Install</button>
      <button id="vp-install-no" aria-label="बंद करें" style="background:transparent;color:white;border:1px solid rgba(255,255,255,0.4);padding:8px 10px;border-radius:8px;cursor:pointer;font-size:13px">×</button>
    </div>
    <style>
      @keyframes vp-slide-up { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
    </style>
  `;
  document.body.appendChild(hint);

  document.getElementById('vp-install-yes').addEventListener('click', async () => {
    const p = deferredPrompt;
    deferredPrompt = null;
    hideInstallHint();
    if (p) {
      try { await p.prompt(); } catch {}
    }
  });
  document.getElementById('vp-install-no').addEventListener('click', () => {
    try { localStorage.setItem(INSTALL_DISMISS_KEY, Date.now().toString()); } catch {}
    hideInstallHint();
  });
}

function hideInstallHint() {
  document.getElementById('vp-install-hint')?.remove();
}
