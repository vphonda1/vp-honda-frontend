// src/registerSW.js — VP Honda PWA Service Worker Registration
// Handles: SW registration, auto-update, install prompt, navigation from SW

import { scheduleReminderNotifications } from './utils/notificationScheduler';

// ── Register Service Worker ──────────────────────────────────────────────────
export const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('✅ VP Honda SW registered:', registration.scope);

      // Check for updates every 60 seconds while app is open
      setInterval(() => registration.update().catch(() => {}), 60000);

      // When new SW found → show update banner
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(registration);
          }
        });
      });

      // Schedule reminders after SW is ready
      // Wait 5 seconds for app to fully load and fetch customers
      setTimeout(() => scheduleRemindersNow(), 5000);

      // Also schedule again when page becomes visible (user returns to app)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          scheduleRemindersNow();
        }
      });

    } catch (err) {
      console.warn('SW registration failed:', err);
    }

    // ⚠️ FIX: नया Service Worker आते ही यह तुरंत `location.reload()` कर देता था.
    // Deploy के बाद पहली बार page खोलते ही अचानक पूरा reload हो जाता था —
    // भरा हुआ form, खुला modal, सब चला जाता था.
    //
    // अब reload सिर्फ़ तब जब user कुछ लिख/भर नहीं रहा हो; वरना अगली बार
    // page खुलने पर नया SW अपने आप चालू हो जाएगा (कोई नुक़सान नहीं).
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      const busy = document.querySelector('input:focus, textarea:focus, select:focus')
                || document.querySelector('[data-vp-modal-open]');
      if (busy) {
        console.log('[SW] नया version तैयार है — काम ख़त्म होने पर अपने आप लगेगा');
        return;
      }
      refreshing = true;
      window.location.reload();
    });
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
        // app.jsx का NotificationNavigator इसे सुनकर बिना reload page बदल देगा
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('vp-navigate', { detail: target }));
        }, 60);
      }
    }
  } catch {}

  // ⚠️ FIX: यहाँ पहले NAVIGATE message का दूसरा listener था जो
  // `window.location.href = url` करता था — यानी एक ही notification click पर
  // दो listener चलते थे और एक पूरा page reload करा देता था.
  //
  // अब NAVIGATE सिर्फ़ app.jsx का `NotificationNavigator` संभालता है, जो
  // React Router से बिना reload page बदलता है. यहाँ कुछ नहीं चाहिए.
};

// ── Schedule Reminders from localStorage/API ─────────────────────────────────
// ⚠️ FIX: पहले यह हर visibilitychange पर चलता था — यानी जब भी आप app पर वापस आएँ,
// 3 सेकंड बाद summary + 6 सेकंड बाद 5 overdue notifications का burst आ जाता था.
// अब हर 4 घंटे में ज़्यादा से ज़्यादा एक बार चलता है.
const SCHEDULE_THROTTLE_MS = 4 * 60 * 60 * 1000;   // 4 घंटे
const SCHEDULE_KEY = 'vp_last_reminder_schedule';

export async function scheduleRemindersNow({ force = false } = {}) {
  try {
    if (!force) {
      const last = parseInt(localStorage.getItem(SCHEDULE_KEY) || '0', 10);
      if (last && Date.now() - last < SCHEDULE_THROTTLE_MS) return;
    }

    // ⚠️ FIX: पहले यहाँ `/api/customers` था — reminder की dates उसमें होती ही नहीं.
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
  }
}

// ── Update Banner UI ──────────────────────────────────────────────────────────
function showUpdateBanner(registration) {
  if (document.getElementById('vp-update-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'vp-update-banner';
  banner.innerHTML = `
    <div style="
      position:fixed; bottom:16px; left:16px; right:16px; max-width:400px;
      margin:0 auto; background:linear-gradient(135deg,#DC0000,#B91C1C);
      color:white; padding:14px 18px; border-radius:12px;
      box-shadow:0 10px 40px rgba(220,0,0,0.4); z-index:9999;
      display:flex; align-items:center; gap:12px;
      font-family:-apple-system,sans-serif; animation:vp-slide-up 0.3s ease;
    ">
      <div style="font-size:24px;">🔄</div>
      <div style="flex:1; min-width:0;">
        <div style="font-weight:700; font-size:14px;">नया Update उपलब्ध है!</div>
        <div style="font-size:12px; opacity:0.9; margin-top:2px;">Latest features के लिए reload करें</div>
      </div>
      <button id="vp-update-btn" style="
        background:white; color:#DC0000; border:none; padding:8px 14px;
        border-radius:8px; font-weight:700; cursor:pointer; font-size:13px; white-space:nowrap;">
        Update करें
      </button>
      <button id="vp-update-dismiss" style="
        background:transparent; color:white; border:1px solid rgba(255,255,255,0.4);
        padding:8px 10px; border-radius:8px; cursor:pointer; font-size:13px;">×</button>
    </div>
    <style>
      @keyframes vp-slide-up { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
    </style>
  `;
  document.body.appendChild(banner);

  document.getElementById('vp-update-btn').addEventListener('click', () => {
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    banner.remove();
  });
  document.getElementById('vp-update-dismiss').addEventListener('click', () => banner.remove());
}

// ── Install Prompt ────────────────────────────────────────────────────────────
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  setTimeout(showInstallHint, 30000);   // Show after 30s
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  hideInstallHint();
});

function showInstallHint() {
  if (!deferredPrompt) return;
  if (document.getElementById('vp-install-hint')) return;
  const dismissed = localStorage.getItem('vp_install_dismissed');
  if (dismissed && Date.now() - parseInt(dismissed) < 7 * 86400000) return;

  const hint = document.createElement('div');
  hint.id = 'vp-install-hint';
  hint.innerHTML = `
    <div style="
      position:fixed; bottom:16px; left:16px; right:16px; max-width:360px;
      margin:0 auto; background:linear-gradient(135deg,#DC0000,#B91C1C);
      color:white; padding:14px; border-radius:14px;
      box-shadow:0 10px 40px rgba(220,0,0,0.4); z-index:9998;
      display:flex; align-items:center; gap:12px; font-family:-apple-system,sans-serif;
      animation:vp-slide-up 0.4s ease;
    ">
      <div style="font-size:32px;">📱</div>
      <div style="flex:1; min-width:0;">
        <div style="font-weight:800; font-size:14px;">VP Honda को Install करें</div>
        <div style="font-size:11px; opacity:0.9; margin-top:2px;">Phone पर Real App की तरह use करें</div>
      </div>
      <button id="vp-install-yes" style="background:white;color:#DC0000;border:none;padding:8px 14px;border-radius:8px;font-weight:800;font-size:13px;cursor:pointer">Install</button>
      <button id="vp-install-no" style="background:transparent;color:white;border:1px solid rgba(255,255,255,0.4);padding:8px 10px;border-radius:8px;cursor:pointer;font-size:13px">×</button>
    </div>
  `;
  document.body.appendChild(hint);

  document.getElementById('vp-install-yes').addEventListener('click', async () => {
    if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; }
    hideInstallHint();
  });
  document.getElementById('vp-install-no').addEventListener('click', () => {
    localStorage.setItem('vp_install_dismissed', Date.now().toString());
    hideInstallHint();
  });
}

function hideInstallHint() {
  document.getElementById('vp-install-hint')?.remove();
}