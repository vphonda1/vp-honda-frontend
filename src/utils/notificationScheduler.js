// ════════════════════════════════════════════════════════════════════════════
// src/utils/notificationScheduler.js
// VP Honda — Complete Reminder Notification System
// ════════════════════════════════════════════════════════════════════════════
// सब reminder types handle करता है:
// ✅ Service reminders (1st–7th free service)
// ✅ RTO pending (insurance के 7 दिन)
// ✅ Payment due (pending amounts)
// ✅ First Party Insurance Renewal (11 months)
// ✅ Insurance/PUC expiry
// ════════════════════════════════════════════════════════════════════════════

const DB_NAME    = 'vp-reminders';
const DB_VERSION = 1;
const STORE_NAME = 'reminders';

// ── Notification config per type ────────────────────────────────────────────
const NOTIF_CONFIG = {
  'service': {
    icon: '🔧',
    color: '#ea580c',
    urgentTitle:   (r) => `🔧 ${r.serviceLabel} Due Today — ${r.customerName}`,
    urgentBody:    (r) => `🏍️ ${r.vehicleModel || 'Vehicle'} · ${r.regNo || ''}\n📞 ${r.phone || 'No phone'}\n📅 अभी service schedule करें!`,
    tomorrowTitle: (r) => `🔧 ${r.serviceLabel} कल Due — ${r.customerName}`,
    tomorrowBody:  (r) => `🏍️ ${r.vehicleModel || 'Vehicle'} · ${r.regNo || ''}\n📞 ${r.phone || 'No phone'}`,
    overdueTitle:  (r) => `⚠️ Service Overdue! — ${r.customerName}`,
    overdueBody:   (r) => `${r.serviceLabel} — ${Math.abs(r.daysRemaining)} दिन पहले due था\n🏍️ ${r.vehicleModel || ''} · 📞 ${r.phone || ''}`,
  },
  'payment': {
    icon: '💰',
    color: '#16a34a',
    urgentTitle:   (r) => `💰 Payment Due Today — ${r.customerName}`,
    urgentBody:    (r) => `₹${(r.amount || 0).toLocaleString('en-IN')} pending\n🏍️ ${r.vehicleModel || ''} · 📞 ${r.phone || ''}`,
    tomorrowTitle: (r) => `💰 Payment Due कल — ${r.customerName}`,
    tomorrowBody:  (r) => `₹${(r.amount || 0).toLocaleString('en-IN')} pending\n📞 ${r.phone || ''}`,
    overdueTitle:  (r) => `🚨 Payment Overdue! — ${r.customerName}`,
    overdueBody:   (r) => `₹${(r.amount || 0).toLocaleString('en-IN')} — ${Math.abs(r.daysRemaining)} दिन overdue\n📞 ${r.phone || ''}`,
  },
  'insurance': {
    icon: '🚗',
    color: '#7c3aed',
    urgentTitle:   (r) => `🚗 RTO Deadline Today — ${r.customerName}`,
    urgentBody:    (r) => `Insurance date: ${r.insuranceStartDate || ''}\nआज last chance for RTO!\n📞 ${r.phone || ''}`,
    tomorrowTitle: (r) => `🚗 RTO Deadline कल — ${r.customerName}`,
    tomorrowBody:  (r) => `Insurance के 7 दिन कल पूरे होते हैं\n📞 ${r.phone || ''}`,
    overdueTitle:  (r) => `🚗 RTO Overdue! — ${r.customerName}`,
    overdueBody:   (r) => `RTO deadline ${Math.abs(r.daysRemaining)} दिन पहले थी\n📞 ${r.phone || ''}`,
  },
  'insurance-renewal': {
    icon: '🛡️',
    color: '#DC0000',
    urgentTitle:   (r) => `🛡️ Insurance Expires Today — ${r.customerName}`,
    urgentBody:    (r) => `First Party Insurance आज expire!\n🏍️ ${r.vehicleModel || ''} · 📞 ${r.phone || ''}\n⚠️ अभी Renew करवाएं!`,
    tomorrowTitle: (r) => `🛡️ Insurance कल Expire — ${r.customerName}`,
    tomorrowBody:  (r) => `First Party Renewal कल तक करनी है\n🏍️ ${r.vehicleModel || ''} · 📞 ${r.phone || ''}`,
    overdueTitle:  (r) => `🛡️ Insurance Expired! — ${r.customerName}`,
    overdueBody:   (r) => `${Math.abs(r.daysRemaining)} दिन पहले expire हुआ\n🏍️ ${r.vehicleModel || ''} · 📞 ${r.phone || ''}\n🚨 Uninsured vehicle!`,
  },
};

import { buildReminders, notifiableReminders } from './reminderEngine';

// ── Honda Free Service schedule ──────────────────────────────────────────────
const FREE_SERVICES = [
  { num:1, label:'1st Free Service', months:1  },
  { num:2, label:'2nd Free Service', months:6  },
  { num:3, label:'3rd Free Service', months:12 },
  { num:4, label:'4th Free Service', months:18 },
  { num:5, label:'5th Free Service', months:24 },
];

const SERVICE_MAP = [
  { done:'firstServiceDate',  label:'2nd Service', days:120 },
  { done:'secondServiceDate', label:'3rd Service', days:120 },
  { done:'thirdServiceDate',  label:'4th Service', days:120 },
  { done:'fourthServiceDate', label:'5th Service', days:120 },
  { done:'fifthServiceDate',  label:'6th Service', days:120 },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate()+n); return r; };
const addMonths = (d, m) => { const r = new Date(d); r.setMonth(r.getMonth()+m); return r; };
const dateStr = (d) => new Date(d).toISOString().split('T')[0];
const diffDays = (d) => Math.ceil((new Date(d) - new Date()) / 86400000);

// ── Build ALL reminders from customer data ───────────────────────────────────
export function buildAllReminders(customers) {
  const reminders = [];

  customers.forEach(c => {
    const name    = c.customerName || c.name || 'Customer';
    const phone   = c.mobileNo || c.phone || '';
    const model   = c.vehicleModel || c.vehicle || c.linkedVehicle?.model || '';
    const regNo   = c.regNo || c.registrationNo || c.linkedVehicle?.regNo || c.registrationNumber || '';
    const id      = c._id || c.id || name;

    // ── 1. Honda Free Services (from purchaseDate) ────────────────────────
    const purchaseDate = c.purchaseDate || c.linkedVehicle?.purchaseDate;
    if (purchaseDate) {
      FREE_SERVICES.forEach(s => {
        const due  = addMonths(new Date(purchaseDate), s.months);
        const days = diffDays(due);
        if (days >= -30 && days <= 45) {
          reminders.push({
            id: `svc-free-${s.num}-${id}`,
            type: 'service', source: 'free-service',
            customerId: id, customerName: name, phone, vehicleModel: model, regNo,
            serviceLabel: s.label,
            dueDate: dateStr(due), daysRemaining: days,
            status: days <= 0 ? 'overdue' : days <= 3 ? 'today' : days <= 7 ? 'tomorrow' : 'upcoming',
            amount: 0,
          });
        }
      });
    }

    // ── 2. Done-Service Based Reminders ───────────────────────────────────
    SERVICE_MAP.forEach(({ done, label, days: interval }) => {
      const doneDate = c[done];
      if (doneDate) {
        const due  = addDays(new Date(doneDate), interval);
        const days = diffDays(due);
        if (days >= -30 && days <= 45) {
          reminders.push({
            id: `svc-done-${done}-${id}`,
            type: 'service', source: 'done-service',
            customerId: id, customerName: name, phone, vehicleModel: model, regNo,
            serviceLabel: label,
            dueDate: dateStr(due), daysRemaining: days,
            status: days <= 0 ? 'overdue' : days <= 3 ? 'today' : days <= 7 ? 'tomorrow' : 'upcoming',
            amount: 0,
          });
        }
      }
    });

    // ── 3. Payment Due ────────────────────────────────────────────────────
    const pending = parseFloat(c.pendingAmount || 0);
    if (pending > 0 && !c.paymentReceivedDate) {
      const dueDateRaw = c.paymentDueDate ? new Date(c.paymentDueDate) : addDays(new Date(), 7);
      const days = diffDays(dueDateRaw);
      if (days >= -30 && days <= 30) {
        reminders.push({
          id: `pay-${id}`,
          type: 'payment', source: 'payment',
          customerId: id, customerName: name, phone, vehicleModel: model, regNo,
          serviceLabel: `Payment ₹${pending.toLocaleString('en-IN')}`,
          dueDate: dateStr(dueDateRaw), daysRemaining: days,
          status: days <= 0 ? 'overdue' : days <= 1 ? 'today' : days <= 3 ? 'tomorrow' : 'upcoming',
          amount: pending,
        });
      }
    }

    // ── 4. RTO Pending (within 7 days of insurance date) ─────────────────
    const insDate = c.insuranceDate;
    if (insDate && !c.rtoDoneDate) {
      const rto  = addDays(new Date(insDate), 7);
      const days = diffDays(rto);
      if (days >= 0 && days <= 7) {
        reminders.push({
          id: `rto-${id}`,
          type: 'insurance', source: 'rto',
          customerId: id, customerName: name, phone, vehicleModel: model, regNo,
          serviceLabel: 'RTO Registration Pending',
          insuranceStartDate: insDate,
          dueDate: dateStr(rto), daysRemaining: days,
          status: days <= 0 ? 'overdue' : days <= 1 ? 'today' : days <= 3 ? 'tomorrow' : 'upcoming',
          amount: 0,
        });
      }
    }

    // ── 5. First Party Insurance Renewal (11 months / 335 days) ──────────
    const lsKey     = `vp_ins_${regNo || id}`;
    const lsRenewed = typeof localStorage !== 'undefined' ? localStorage.getItem(`vp_ins_renewed_${regNo || id}`) : null;
    const lsDate    = typeof localStorage !== 'undefined' ? localStorage.getItem(lsKey) : null;
    const insStart  = lsDate || c.insuranceStartDate || insDate
      || (purchaseDate ? dateStr(addDays(new Date(purchaseDate), 3)) : null);

    if (insStart && !lsRenewed && !c.insuranceRenewed) {
      const renewalDue = addDays(new Date(insStart), 335);
      const days       = diffDays(renewalDue);
      if (days >= -30 && days <= 60) {
        reminders.push({
          id: `insr-${id}`,
          type: 'insurance-renewal', source: 'insurance-renewal',
          customerId: id, customerName: name, phone, vehicleModel: model, regNo,
          serviceLabel: 'First Party Insurance Renewal',
          insuranceStartDate: insStart,
          insuranceExpiryDate: dateStr(addDays(new Date(insStart), 365)),
          isEstimated: !lsDate && !c.insuranceStartDate,
          dueDate: dateStr(renewalDue), daysRemaining: days,
          status: days <= 0 ? 'overdue' : days <= 3 ? 'today' : days <= 7 ? 'tomorrow' : 'upcoming',
          amount: 0,
        });
      }
    }
  });

  // Sort: overdue first, then by days remaining
  return reminders.sort((a, b) => {
    if (a.status === 'overdue' && b.status !== 'overdue') return -1;
    if (b.status === 'overdue' && a.status !== 'overdue') return 1;
    return a.daysRemaining - b.daysRemaining;
  });
}

// ── Build notification schedule from reminders (PRIORITY + LIMIT) ─────────────
// ✅ FIX: सब reminders एक साथ नहीं भेजेंगे — priority के हिसाब से max 11 notifications
// 1 summary + top 5 overdue + top 3 today + top 2 tomorrow = 11 max
function buildNotificationSchedule(reminders) {
  const scheduled = [];
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const live = reminders.filter(r => !r.closed && !r.snoozed);
  // एक ग्राहक = एक notification (अनुमानित और तारीख़-रहित वाले अपने आप बाहर)
  const picks = notifiableReminders(live, 5);

  // ── 1. SUMMARY (सिर्फ़ एक) ───────────────────────────────────────────────
  const overdue  = live.filter(r => r.daysRemaining !== null && r.daysRemaining < 0).length;
  const dueToday = live.filter(r => r.daysRemaining === 0).length;
  const dueTmrw  = live.filter(r => r.daysRemaining === 1).length;

  if (picks.length) {
    const parts = [];
    if (overdue)  parts.push(`\u{1F6A8} ${overdue} overdue`);
    if (dueToday) parts.push(`\u{1F4C5} ${dueToday} \u0906\u091C`);
    if (dueTmrw)  parts.push(`\u23F0 ${dueTmrw} \u0915\u0932`);
    scheduled.push({
      id:    `notif-summary-${todayStr}`,
      title: '\u{1F514} VP Honda \u2014 Reminders',
      body:  (parts.join(' \u00B7 ') || `${live.length} reminders`) + '\n\u{1F4CB} \u0916\u094B\u0932\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F tap \u0915\u0930\u0947\u0902',
      type:  'summary',
      fireAt: new Date(now.getTime() + 4000).toISOString(),
      tag:   `vp-summary-${todayStr}`,
      requireInteraction: false,
      url:   '/reminders',
    });
  }

  // ── 2. हर ग्राहक का सबसे ज़रूरी reminder ─────────────────────────────────
  // ⭐ url में `rid` जाता है — इसी से click करने पर Reminders page ठीक वही
  //    reminder खोलता है. पहले सिर्फ़ '/reminders' जाता था, इसलिए 3 reminder
  //    वाले ग्राहक में पता ही नहीं चलता था कौन सा notification था.
  picks.forEach(({ head: r, extra }, idx) => {
    const over  = r.daysRemaining < 0;
    const days  = Math.abs(r.daysRemaining);
    const when  = over
      ? `${days} \u0926\u093F\u0928 \u092A\u0939\u0932\u0947 due \u0925\u093E`
      : r.daysRemaining === 0
      ? '\u0906\u091C due \u0939\u0948'
      : `${days} \u0926\u093F\u0928 \u092E\u0947\u0902 due`;
    const extraTxt = extra > 0
      ? `\n\u2795 \u0907\u0928\u0915\u0947 ${extra} \u0914\u0930 reminder \u092C\u093E\u0915\u093C\u0940`
      : '';
    const phone = String(r.customerPhone || '').replace(/\D/g, '').slice(-10);

    scheduled.push({
      id:    `notif-${r.id}`,
      title: `${over ? '\u26A0\uFE0F' : '\u23F0'} ${r.customerName} \u2014 ${r.title}`,
      body:  `${when}\n\u{1F3CD} ${r.vehicle || '\u0917\u093E\u0921\u093C\u0940'}${phone ? ` \u00B7 \u{1F4DE} ${phone}` : ''}${extraTxt}`,
      type:  r.type,
      fireAt: new Date(now.getTime() + 8000 + idx * 2500).toISOString(),
      tag:   `vp-${r.id}`,          // हर reminder का अपना tag — आपस में replace नहीं होंगे
      requireInteraction: false,
      url:   `/reminders?rid=${encodeURIComponent(r.id)}`,
    });
  });

  return scheduled;
}

// ── IndexedDB helpers ────────────────────────────────────────────────────────
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      if (!e.target.result.objectStoreNames.contains(STORE_NAME))
        e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = () => rej(req.error);
  });
}

async function saveToIDB(reminders) {
  try {
    const db    = await openDB();
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    reminders.forEach(r => store.put(r));
  } catch(e) { console.warn('IDB save failed:', e); }
}

// ── Register periodic background sync ────────────────────────────────────────
async function registerPeriodicSync() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if ('periodicSync' in reg) {
      const perm = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (perm.state === 'granted') {
        await reg.periodicSync.register('vp-reminder-check', { minInterval: 8 * 3600 * 1000 });
      }
    }
  } catch {}
}

// ── MAIN: Schedule all reminders → SW → IDB ─────────────────────────────────
export async function scheduleReminderNotifications(records) {
  try {
    if (Notification.permission !== 'granted') return { reminders: [], scheduled: [] };
    const reg = await navigator.serviceWorker.ready;

    // ⚠️ पहले यह function अपने अलग नियमों से reminder बनाता था — Honda
    // "Free Service" (1/6/12/18/24 महीने) *और* 120-दिन वाला schedule, दोनों.
    // इसलिए एक ही ग्राहक की "2nd Service" और "2nd Free Service" दोनों की
    // notification चली जाती थी. अब वही engine जो Reminders page चलाता है.
    const API = import.meta.env.VITE_API_URL || 'https://vp-honda-backend.onrender.com';

    let sdMap = {};
    try {
      const res = await fetch(`${API}/api/service-data`);
      if (res.ok) {
        const arr = await res.json();
        if (Array.isArray(arr)) arr.forEach(r => { if (r.regNo) sdMap[String(r.regNo).toUpperCase()] = r; });
      }
    } catch {}
    if (Object.keys(sdMap).length === 0) {
      try { sdMap = JSON.parse(localStorage.getItem('customerServiceData') || '{}') || {}; } catch {}
    }
    if (Array.isArray(records) && records.length && Object.keys(sdMap).length === 0) {
      records.forEach(r => { const k = String(r.regNo || r.registrationNo || '').toUpperCase(); if (k) sdMap[k] = r; });
    }
    if (Object.keys(sdMap).length === 0) return { reminders: [], scheduled: [] };

    let custs = [];
    try { const r = await fetch(`${API}/api/customers`); if (r.ok) custs = await r.json(); } catch {}
    let fu = {};
    try { fu = JSON.parse(localStorage.getItem('followUpLog') || '{}') || {}; } catch {}

    const { reminders } = buildReminders(sdMap, Array.isArray(custs) ? custs : [], fu);
    const schedule = buildNotificationSchedule(reminders);

    reg.active?.postMessage({ type: 'SCHEDULE_REMINDERS', items: schedule });
    console.log(`[Notif] ${reminders.length} reminders → ${schedule.length} notifications`);
    return { reminders, scheduled: schedule };
  } catch (err) {
    console.warn('[Notif] schedule failed:', err.message);
    return { reminders: [], scheduled: [] };
  }
}

// ── Test notification ────────────────────────────────────────────────────────
export async function sendTestNotification() {
  if (Notification.permission !== 'granted') {
    const p = await Notification.requestPermission();
    if (p !== 'granted') return false;
  }
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({
      type: 'SHOW_NOTIFICATION',
      payload: {
        title: '🔔 VP Honda — Notifications Active!',
        body:  'Service, RTO, Payment, Insurance — सब reminders अब phone पर automatic आएंगे। App बंद हो तब भी।',
        data:  { url: '/reminders', tag: 'test' },
      },
    });
  }
  return true;
}

// ── Summary for UI display ───────────────────────────────────────────────────
export function getReminderSummary(customers) {
  const reminders = buildAllReminders(customers);
  return {
    total:          reminders.length,
    overdue:        reminders.filter(r => r.status === 'overdue').length,
    today:          reminders.filter(r => r.dueDate === dateStr(new Date())).length,
    tomorrow:       reminders.filter(r => r.dueDate === dateStr(addDays(new Date(), 1))).length,
    upcoming:       reminders.filter(r => r.status === 'upcoming').length,
    byType: {
      service:          reminders.filter(r => r.type === 'service').length,
      payment:          reminders.filter(r => r.type === 'payment').length,
      rto:              reminders.filter(r => r.type === 'insurance').length,
      insuranceRenewal: reminders.filter(r => r.type === 'insurance-renewal').length,
    },
    items: reminders,
  };
      }
          
