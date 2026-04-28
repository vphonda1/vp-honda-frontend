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

    // Reload when new SW takes control (for clean state)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });

  // Listen for navigate messages from SW (when notification tapped)
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'NAVIGATE') {
      const url = event.data.url;
      if (url && window.location.pathname !== url) {
        window.location.href = url;
      }
    }
  });
};

// ── Schedule Reminders from localStorage/API ─────────────────────────────────
export async function scheduleRemindersNow() {
  try {
    // Get customers from localStorage (already cached by app)
    const cached = localStorage.getItem('vpCustomers') || localStorage.getItem('vp_customers');
    let customers = [];
    if (cached) {
      try { customers = JSON.parse(cached); } catch {}
    }

    // Also try to fetch fresh from API
    try {
      const base = localStorage.getItem('vpApiBase') || 'https://vp-honda-backend.onrender.com';
      const res = await fetch(`${base}/api/customers`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const fresh = await res.json();
        if (Array.isArray(fresh) && fresh.length > 0) customers = fresh;
      }
    } catch {}

    if (customers.length > 0) {
      const result = await scheduleReminderNotifications(customers);
      console.log(`[SW] Reminders scheduled: ${result?.scheduled?.length || 0}`);
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