// ReminderPushButton.jsx — Top 5 urgent reminders individual push भेजें
// Each push: "🚨 Customer Name — Payment Due — Vehicle — 231d overdue / 📞 phone"
import { useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { api } from '../utils/apiConfig';

export default function ReminderPushButton({ style = {}, label = '🔔 Send Top 5 Reminders to All' }) {
  const [sending, setSending] = useState(false);
  const [result,  setResult]  = useState('');

  const sendPush = async () => {
    setSending(true);
    setResult('⏳ Reminders fetch कर रहे हैं...');

    try {
      // Step 1: Reminders fetch करें
      let reminders = [];
      try {
        const r = await fetch(api('/api/reminders'));
        if (r.ok) reminders = await r.json();
      } catch (e) { console.warn('reminders fetch:', e.message); }

      if (!Array.isArray(reminders) || reminders.length === 0) {
        // Fallback: generic summary push
        await fetch(api('/api/push/send-push'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '🔔 VP Honda Reminders',
            body:  'Open app to view today\'s reminders',
            url:   '/reminders',
          }),
        });
        setResult('✅ Generic push भेजा (reminders data नहीं मिला)');
        setSending(false);
        return;
      }

      // Step 2: Priority sort - overdue first (most days), then payment > service > insurance
      const typePri = { payment: 3, service: 2, 'insurance-renewal': 1, insurance: 1 };
      const sorted = [...reminders].sort((a, b) => {
        const aOver = (a.daysRemaining || 0) < 0;
        const bOver = (b.daysRemaining || 0) < 0;
        if (aOver !== bOver) return aOver ? -1 : 1;
        const aDays = Math.abs(a.daysRemaining || 0);
        const bDays = Math.abs(b.daysRemaining || 0);
        if (aDays !== bDays) return bDays - aDays;
        return (typePri[b.type] || 0) - (typePri[a.type] || 0);
      });

      const top = sorted.slice(0, 5);
      const overdueCount = reminders.filter(r => (r.daysRemaining || 0) < 0).length;

      // Step 3: 1 summary + 5 individual = 6 total pushes
      setResult(`⏳ Summary push भेज रहे हैं...`);

      await fetch(api('/api/push/send-push'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '🔔 VP Honda Reminders',
          body:  `🚨 ${overdueCount} overdue · 📋 ${reminders.length} total\nNext 5 reminders आ रही हैं...`,
          url:   '/reminders',
        }),
      });

      // Step 4: Send each top 5 as separate push with details
      for (let i = 0; i < top.length; i++) {
        const r       = top[i];
        const days    = Math.abs(r.daysRemaining || 0);
        const overdue = (r.daysRemaining || 0) < 0;
        const icon    = overdue ? '🚨' : '⏰';
        const vehicle = r.vehicleModel || r.vehicle || '';
        const regNo   = r.regNo ? ` (${r.regNo})` : '';
        const phone   = r.customerPhone || r.phone || '';

        setResult(`⏳ Push ${i + 1}/5: ${r.customerName}...`);

        await fetch(api('/api/push/send-push'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `${icon} ${r.customerName} — ${r.title || r.type}`,
            body:  `${vehicle}${regNo} — ${days}d ${overdue ? 'overdue' : 'remaining'}\n📞 ${phone}`,
            url:   '/reminders',
          }),
        });

        // 800ms gap between pushes
        await new Promise(res => setTimeout(res, 800));
      }

      setResult(`✅ 6 pushes भेजे (1 summary + 5 details)`);

      // Local foreground notification confirmation
      if (Notification.permission === 'granted') {
        try {
          new Notification('🔔 VP Honda', { body: `Sent: 1 summary + 5 reminders`, icon: '/icons/icon-192x192.png' });
        } catch {}
      }
    } catch (e) {
      setResult(`❌ ${e.message}`);
    }
    setSending(false);
    setTimeout(() => setResult(''), 10000);
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
      {result && <span style={{ fontSize: 11, color: result.startsWith('✅') ? '#16a34a' : result.startsWith('❌') ? '#ef4444' : '#94a3b8', fontWeight: 600 }}>{result}</span>}
    </div>
  );
}
