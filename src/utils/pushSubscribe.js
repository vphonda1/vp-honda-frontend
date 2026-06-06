// utils/pushSubscribe.js — हर device को silently push-subscribe रखता है
// app load पर चलता है ताकि TeamChat/Reminder notifications सब devices पर आएं
const VAPID   = 'BKwecIw_aOdebFYVONRm-ZF3au68bNWU1uHPSXkwr1LvV7dIS-b-v614SMT6UgjHbcqigskmSAhFBWHxV9a__TM';
const BACKEND = import.meta.env.VITE_API_URL || 'https://vp-honda-backend.onrender.com';
const DEVICE_ID_KEY = 'vp_device_id';

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function toUint8(b) {
  const p = '='.repeat((4 - b.length % 4) % 4);
  const d = atob((b + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...d].map(c => c.charCodeAt(0)));
}

// Silently ensure this device is subscribed (call on app load).
// अगर permission granted नहीं है तो कुछ नहीं करता (prompt नहीं देता)।
export async function ensurePushSubscription(forcePrompt = false) {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { ok: false, reason: 'unsupported' };
    }

    let perm = Notification.permission;
    if (perm !== 'granted') {
      if (!forcePrompt) return { ok: false, reason: 'not-granted' };
      perm = await Notification.requestPermission();
      if (perm !== 'granted') return { ok: false, reason: 'denied' };
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toUint8(VAPID),
      });
    }

    const deviceId = getDeviceId();
    const payload  = { ...sub.toJSON(), deviceId, userAgent: navigator.userAgent.slice(0, 100) };

    const res = await fetch(`${BACKEND}/api/push/save-push-subscription`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      console.log('[Push] ✅ Subscribed. Total devices:', data.total ?? '?');
      return { ok: true, total: data.total };
    }
    return { ok: false, reason: 'save-failed' };
  } catch (e) {
    console.warn('[Push] subscribe failed:', e.message);
    return { ok: false, reason: e.message };
  }
}
