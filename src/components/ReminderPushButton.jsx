// ReminderPushButton.jsx — सब devices को reminders summary push भेजें
// Usage: <ReminderPushButton/> — कहीं भी add कर दें (Reminders page, Dashboard, etc.)
import { useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { api } from '../utils/apiConfig';

export default function ReminderPushButton({ style = {}, label = '🔔 Send Push to All Devices' }) {
  const [sending, setSending] = useState(false);
  const [result,  setResult]  = useState('');

  const sendPush = async () => {
    setSending(true); setResult('⏳ Sending...');
    try {
      // Step 1: Reminders fetch करके count लें (अगर backend reminders route नहीं है तो skip)
      let summary = null;
      try {
        const rems = await fetch(api('/api/reminders')).then(r => r.ok ? r.json() : []);
        if (Array.isArray(rems) && rems.length) {
          const today = new Date(); today.setHours(0,0,0,0);
          const overdue   = rems.filter(r => r.dueDate && new Date(r.dueDate) < today).length;
          const todayDue  = rems.filter(r => r.dueDate && new Date(r.dueDate).toDateString() === today.toDateString()).length;
          const payment   = rems.filter(r => (r.type || '').toLowerCase().includes('payment')).length;
          const service   = rems.filter(r => (r.type || '').toLowerCase().includes('service')).length;
          const insurance = rems.filter(r => (r.type || '').toLowerCase().includes('insurance')).length;
          summary = { total: rems.length, overdue, todayDue, payment, service, insurance };
        }
      } catch {}

      // Step 2: Backend को push भेजने के लिए call करें
      const res  = await fetch(api('/api/push/send-reminder-summary'), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ summary }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`✅ ${data.sent} devices को push भेजा`);
      } else {
        setResult(`❌ ${data.error || 'Failed'}`);
      }
    } catch (e) {
      setResult(`❌ ${e.message}`);
    }
    setSending(false);
    setTimeout(() => setResult(''), 5000);
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
