// NotifBanner.jsx — VP Honda Notification Manager (Single-Device Subscription)
// Fix: एक device = एक subscription हमेशा। Test button + Status visible.
import { useState, useEffect } from 'react';

const VAPID   = 'BKwecIw_aOdebFYVONRm-ZF3au68bNWU1uHPSXkwr1LvV7dIS-b-v614SMT6UgjHbcqigskmSAhFBWHxV9a__TM';
const BACKEND = 'https://vp-honda-backend.onrender.com';
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

export default function NotifBanner() {
  const [enabled,  setEnabled]  = useState(false);
  const [status,   setStatus]   = useState('');
  const [working,  setWorking]  = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) return;
    setEnabled(Notification.permission === 'granted');
    // Auto re-subscribe silently if already granted (refresh subscription)
    if (Notification.permission === 'granted') {
      enable(true).catch(() => {});
    }
  }, []);

  const enable = async (silent = false) => {
    if (working) return;
    setWorking(true);
    if (!silent) setStatus('⏳ Setup हो रहा है...');

    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatus('❌ Browser support नहीं');
        setWorking(false); return;
      }

      let perm = Notification.permission;
      if (perm !== 'granted') {
        perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          setStatus('❌ Permission denied');
          setWorking(false); return;
        }
      }

      const reg = await navigator.serviceWorker.ready;
      // ✅ FIX: Reuse existing subscription (NO unsubscribe — prevents duplicate endpoints)
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toUint8(VAPID),
        });
      }

      // ✅ Send subscription with deviceId so backend can dedupe per device
      const deviceId = getDeviceId();
      const payload  = { ...sub.toJSON(), deviceId, userAgent: navigator.userAgent.slice(0, 100) };

      const res = await fetch(`${BACKEND}/api/push/save-push-subscription`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setEnabled(true);
        if (!silent) {
          setStatus(`✅ Setup complete! Devices: ${data.total}`);
          setTimeout(() => setStatus(''), 4000);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setStatus(`❌ Save failed: ${err.error || res.status}`);
      }
    } catch (e) {
      setStatus(`❌ ${e.message}`);
    }
    setWorking(false);
  };

  const testNotif = async () => {
    setStatus('⏳ Test भेज रहे हैं...');
    setWorking(true);
    try {
      const res  = await fetch(`${BACKEND}/api/push/test-push-notification`, { method: 'POST' });
      const data = await res.json();
      setStatus(res.ok ? `✅ ${data.message}` : `❌ ${data.error}`);
      setTimeout(() => setStatus(''), 5000);
    } catch (e) {
      setStatus(`❌ ${e.message}`);
    }
    setWorking(false);
  };

  // ✅ Always show banner — green when ON, red when OFF
  return (
    <div style={{
      position:'sticky', top:0, zIndex:100,
      background: enabled ? 'linear-gradient(90deg,#16a34a,#15803d)' : 'linear-gradient(90deg,#DC0000,#B91C1C)',
      color:'#fff', padding:'8px 12px', display:'flex', alignItems:'center', gap:8,
      fontSize:11, fontWeight:700, minHeight:36,
    }}>
      <span style={{ fontSize:16 }}>{enabled ? '🔔' : '🔕'}</span>
      <div style={{ flex:1, lineHeight:1.3 }}>
        {status || (enabled ? 'Notifications चालू ✓' : 'Notifications बंद — चालू करें')}
      </div>
      {!enabled && (
        <button onClick={() => enable(false)} disabled={working} style={{
          background:'#fff', color:'#DC0000', border:'none',
          padding:'6px 12px', borderRadius:6, fontWeight:800, fontSize:11, cursor:'pointer',
          opacity: working ? 0.6 : 1,
        }}>चालू करें</button>
      )}
      {enabled && (
        <button onClick={testNotif} disabled={working} style={{
          background:'rgba(255,255,255,0.25)', color:'#fff', border:'1px solid rgba(255,255,255,0.4)',
          padding:'5px 10px', borderRadius:6, fontWeight:700, fontSize:10, cursor:'pointer',
          opacity: working ? 0.6 : 1,
        }}>🔔 Test</button>
      )}
    </div>
  );
}
