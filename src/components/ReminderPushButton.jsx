// ReminderPushButton.jsx — सब devices को reminders summary push भेजें
// Uses existing /api/push/send-push route (which Test button uses - confirmed working)
import { useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { api } from '../utils/apiConfig';

export default function ReminderPushButton({ style = {}, label = '🔔 Send Push to All Devices' }) {
  const [sending, setSending] = useState(false);
  const [result,  setResult]  = useState('');

  const sendPush = async () => {
    setSending(true);
    setResult('⏳ Reminders count कर रहे हैं...');

    try {
      // Step 1: Reminders fetch करके count करें
      let title = '🔔 VP Honda Reminders';
      let body  = 'Open app to view today\'s reminders';

      try {
        const rems = await fetch(api('/api/reminders')).then(r => r.ok ? r.json() : []);
        if (Array.isArray(rems) && rems.length) {
          const today = new Date(); today.setHours(0,0,0,0);
          const overdue   = rems.filter(r => r.dueDate && new Date(r.dueDate) < today).length;
          const todayDue  = rems.filter(r => r.dueDate && new Date(r.dueDate).toDateString() === today.toDateString()).length;
          const payment   = rems.filter(r => (r.type || '').toLowerCase().includes('payment')).length;
          const service   = rems.filter(r => (r.type || '').toLowerCase().includes('service')).length;
          const insurance = rems.filter(r => (r.type || '').toLowerCase().includes('insurance')).length;

          const parts = [];
          if (overdue)   parts.push(`🚨 ${overdue} overdue`);
          if (todayDue)  parts.push(`📅 ${todayDue} today`);
          if (payment)   parts.push(`💳 ${payment} payment`);
          if (service)   parts.push(`🔧 ${service} service`);
          if (insurance) parts.push(`🛡️ ${insurance} insurance`);
          body = parts.length ? parts.join(' · ') : `${rems.length} reminders pending`;
        }
      } catch (e) {
        console.warn('[ReminderPush] /api/reminders fetch failed:', e.message);
      }

      setResult('⏳ Push भेज रहे हैं...');

      // Step 2: Existing send-push route call करें (test button जो use करता है)
      const res = await fetch(api('/api/push/send-push'), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title, body, url: '/reminders' }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`✅ ${data.sent || 0} devices को push भेजा`);
        // Show a local notification too in case phone is on this device
        if (Notification.permission === 'granted') {
          try { new Notification(title, { body, icon: '/icons/icon-192x192.png' }); } catch {}
        }
      } else {
        setResult(`❌ ${data.error || 'Failed'}`);
      }
    } catch (e) {
      setResult(`❌ ${e.message}`);
    }
    setSending(false);
    setTimeout(() => setResult(''), 8000);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-start', ...style }}>
      <button onClick={sendPush} disabled={sending} style={{
        background: 'linear-gradient(135deg, #DC0000, #991b1b)',
        color: '#fff', border: 'none', padding: '10px 18px',
        borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8, opacity: sending ? 0.6 : 1,
      }}>
        {sending ? <Bell size={16}/> : <BellRing size={16}/>}
        {label}
      </button>
      {result && <span style={{ fontSize: 11, color: result.startsWith('✅') ? '#16a34a' : '#ef4444', fontWeight: 600 }}>{result}</span>}
    </div>
  );
}
