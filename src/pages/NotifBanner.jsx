// NotifBanner.jsx — Global notification enable banner
// Shows on every page until notifications are enabled
import { useState, useEffect } from 'react';
import { requestNotificationPermission } from '../utils/smartUtils';

export default function NotifBanner() {
  const [enabled, setEnabled] = useState(true);
  const [status,  setStatus]  = useState('');

  useEffect(() => {
    if (!('Notification' in window)) { setEnabled(true); return; }
    setEnabled(Notification.permission === 'granted');
  }, []);

  const enable = async () => {
    setStatus('⏳ Permission माँग रहे हैं...');
    try {
      const ok = await requestNotificationPermission();
      if (ok) {
        setEnabled(true);
        setStatus('✅ Notifications चालू! अब messages आने पर alert मिलेगा');
        setTimeout(() => setStatus(''), 5000);
      } else {
        setStatus('❌ Permission denied. Browser settings में Allow करें');
      }
    } catch (e) {
      setStatus('❌ Error: ' + e.message);
    }
  };

  if (enabled && !status) return null;

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: enabled ? 'linear-gradient(90deg,#16a34a,#15803d)' : 'linear-gradient(90deg,#DC0000,#B91C1C)',
      color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 12, fontWeight: 700,
    }}>
      <span style={{ fontSize: 18 }}>🔔</span>
      <div style={{ flex: 1 }}>
        {status || (enabled ? 'Notifications चालू हैं' : 'Notifications बंद हैं — Messages के लिए चालू करें')}
      </div>
      {!enabled && (
        <button onClick={enable} style={{
          background: '#fff', color: '#DC0000', border: 'none',
          padding: '7px 14px', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: 'pointer',
        }}>
          चालू करें
        </button>
      )}
      {status && (
        <button onClick={() => setStatus('')} style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', fontSize:16 }}>×</button>
      )}
    </div>
  );
}
