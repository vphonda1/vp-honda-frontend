// NotifBanner.jsx — Self-contained push notification setup
// सब logic यहीं है — smartUtils की जरूरत नहीं
import { useState, useEffect } from 'react';

const VAPID = 'BKwecIw_aOdebFYVONRm-ZF3au68bNWU1uHPSXkwr1LvV7dIS-b-v614SMT6UgjHbcqigskmSAhFBWHxV9a__TM';
const BACKEND = 'https://vp-honda-backend.onrender.com';

function toUint8(b) {
  const p = '='.repeat((4 - b.length % 4) % 4);
  const d = atob((b + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...d].map(c => c.charCodeAt(0)));
}

export default function NotifBanner() {
  const [enabled, setEnabled] = useState(true);
  const [status,  setStatus]  = useState('');

  useEffect(() => {
    if (!('Notification' in window)) { setEnabled(true); return; }
    // Check if already enabled AND subscribed
    setEnabled(Notification.permission === 'granted');
    // Auto-subscribe if granted but not subscribed
    if (Notification.permission === 'granted') {
      enable(true);
    }
  }, []);

  const enable = async (silent = false) => {
    if (!silent) setStatus('⏳ Permission माँग रहे हैं...');

    if (!('Notification' in window)) {
      setStatus('❌ Browser में notifications नहीं हैं');
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('❌ Service Worker नहीं है');
      return;
    }

    // Permission
    let perm = Notification.permission;
    if (perm !== 'granted') {
      perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setStatus('❌ Permission denied. Browser Settings में Allow करें');
        return;
      }
    }
    if (!silent) setStatus('✅ Permission OK. Subscribe हो रहे हैं...');

    // Subscribe to push
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toUint8(VAPID),
      });

      // Save to backend
      const res = await fetch(`${BACKEND}/api/push/save-push-subscription`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(sub.toJSON()),
      });

      if (res.ok) {
        const data = await res.json();
        setEnabled(true);
        setStatus(`✅ Done! Total devices: ${data.total}. अब messages आने पर notification आएगी।`);
        setTimeout(() => setStatus(''), 6000);
      } else {
        setStatus(`❌ Backend save failed (${res.status})`);
      }
    } catch (e) {
      setStatus(`❌ ${e.message}`);
    }
  };

  if (enabled && !status) return null;

  return (
    <div style={{
      position:'sticky', top:0, zIndex:100,
      background: enabled ? 'linear-gradient(90deg,#16a34a,#15803d)' : 'linear-gradient(90deg,#DC0000,#B91C1C)',
      color:'#fff', padding:'10px 14px', display:'flex', alignItems:'center', gap:10,
      fontSize:11, fontWeight:700,
    }}>
      <span style={{ fontSize:18 }}>🔔</span>
      <div style={{ flex:1, lineHeight:1.4 }}>
        {status || 'Notifications बंद हैं — Messages के लिए चालू करें'}
      </div>
      {!enabled && (
        <button onClick={() => enable(false)} style={{
          background:'#fff', color:'#DC0000', border:'none',
          padding:'7px 14px', borderRadius:8, fontWeight:800, fontSize:12, cursor:'pointer',
        }}>
          चालू करें
        </button>
      )}
      {status && (
        <button onClick={() => setStatus('')} style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', fontSize:18 }}>×</button>
      )}
    </div>
  );
}
