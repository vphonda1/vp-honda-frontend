// ════════════════════════════════════════════════════════════════════════════
// src/utils/notificationScheduler.js
// VP Honda — Professional Aggressive Reminder Notification System
// Pure Web Push + VAPID Compatible
// ════════════════════════════════════════════════════════════════════════════

const DB_NAME = 'vp-reminders';
const DB_VERSION = 1;
const STORE_NAME = 'reminders';


// ── Aggressive + Professional Notification Config ───────────────────────
const NOTIF_CONFIG = {
  'service': {
    icon: '🔧',
    color: '#ea580c',

    urgentTitle:   (r) => `🔴 ${r.serviceLabel} आज DUE है - तुरंत बुक करें!`,
    urgentBody:    (r) => `${r.customerName} • ${r.vehicleModel || 'Bike'} • ${r.regNo || ''}\n⚠️ देर होने पर फ्री सर्विस ख़त्म`,

    tomorrowTitle: (r) => `⚠️ ${r.serviceLabel} कल DUE है`,
    tomorrowBody:  (r) => `${r.customerName} • ${r.vehicleModel || 'Bike'}\nकल बुकिंग कर लें`,

    overdueTitle:  (r) => `🚨 ${r.serviceLabel} OVERDUE!`,
    overdueBody:   (r) => `${r.customerName} • ${Math.abs(r.daysRemaining)} दिन देर\nतुरंत संपर्क करें`,
  },

  'payment': {
    icon: '💰',
    color: '#16a34a',

    urgentTitle:   (r) => `🔴 ₹${(r.amount || 0).toLocaleString('en-IN')} आज जमा करें - Last Day`,
    urgentBody:    (r) => `${r.customerName} • ${r.vehicleModel || ''} • ${r.regNo || ''}\nदेर होने पर ब्याज लग सकता है`,

    tomorrowTitle: (r) => `⚠️ ₹${(r.amount || 0).toLocaleString('en-IN')} कल Pending`,
    tomorrowBody:  (r) => `${r.customerName} • तैयारी रखें`,

    overdueTitle:  (r) => `🚨 PAYMENT OVERDUE - ₹${(r.amount || 0).toLocaleString('en-IN')}`,
    overdueBody:   (r) => `${r.customerName} • ${Math.abs(r.daysRemaining)} दिन बकाया\nतुरंत भुगतान करें`,
  },

  'insurance': {
    icon: '🚗',
    color: '#7c3aed',

    urgentTitle:   (r) => `🚨 RTO DEADLINE आज खत्म!`,
    urgentBody:    (r) => `${r.customerName} • Insurance के 7 दिन पूरे\nतुरंत RTO करवाएं`,

    tomorrowTitle: (r) => `⚠️ RTO DEADLINE कल आखिरी दिन`,
    tomorrowBody:  (r) => `${r.customerName} • कल तक जरूर पूरा करें`,

    overdueTitle:  (r) => `🚨 RTO OVERDUE`,
    overdueBody:   (r) => `${r.customerName} • ${Math.abs(r.daysRemaining)} दिन बीत गए\nजल्दी संपर्क करें`,
  },

  'insurance-renewal': {
    icon: '🛡️',
    color: '#DC0000',

    urgentTitle:   (r) => `🔴 INSURANCE आज EXPIRE हो रहा है!`,
    urgentBody:    (r) => `${r.customerName} • ${r.vehicleModel || 'Bike'}\n🚨 बिना Insurance गाड़ी चलाना Illegal & Dangerous`,

    tomorrowTitle: (r) => `⚠️ Insurance कल EXPIRE`,
    tomorrowBody:  (r) => `${r.customerName} • ${r.vehicleModel || 'Bike'}\nकल Renew करवाएं`,

    overdueTitle:  (r) => `🚨 INSURANCE EXPIRED - Uninsured Vehicle!`,
    overdueBody:   (r) => `${r.customerName} • ${Math.abs(r.daysRemaining)} दिन पहले expire\nतुरंत Renew करें • Claim नहीं मिलेगा`,
  },
};


// ── Honda Free Service Schedule ─────────────────────────────────────
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

// ── Helpers ─────────────────────────────────────────────────────────
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const addMonths = (d, m) => { const r = new Date(d); r.setMonth(r.getMonth() + m); return r; };
const dateStr = (d) => new Date(d).toISOString().split('T')[0];
const diffDays = (d) => Math.ceil((new Date(d) - new Date()) / 86400000);

// ── Build All Reminders ─────────────────────────────────────────────
export function buildAllReminders(customers) {
  const reminders = [];

  customers.forEach(c => {
    const name    = c.customerName || c.name || 'Customer';
    const phone   = c.mobileNo || c.phone || '';
    const model   = c.vehicleModel || c.linkedVehicle?.model || '';
    const regNo   = c.registrationNo || c.regNo || c.linkedVehicle?.regNo || c.registrationNumber || '';
    const id      = c._id || c.id || name;

    const purchaseDate = c.purchaseDate || c.invoiceDate || c.linkedVehicle?.purchaseDate;

    // 1. Free Services
    if (purchaseDate) {
      FREE_SERVICES.forEach(s => {
        const due = addMonths(new Date(purchaseDate), s.months);
        const days = diffDays(due);
        if (days >= -30 && days <= 45) {
          reminders.push({
            id: `svc-free-\( {s.num}- \){id}`,
            type: 'service',
            customerId: id,
            customerName: name,
            phone,
            vehicleModel: model,
            regNo,
            serviceLabel: s.label,
            dueDate: dateStr(due),
            daysRemaining: days,
            status: days <= 0 ? 'overdue' : days <= 3 ? 'today' : days <= 7 ? 'tomorrow' : 'upcoming',
          });
        }
      });
    }

    // 2. Done Service Based
    SERVICE_MAP.forEach(({ done, label, days: interval }) => {
      const doneDate = c[done];
      if (doneDate) {
        const due = addDays(new Date(doneDate), interval);
        const days = diffDays(due);
        if (days >= -30 && days <= 45) {
          reminders.push({
            id: `svc-done-\( {done}- \){id}`,
            type: 'service',
            customerId: id,
            customerName: name,
            phone,
            vehicleModel: model,
            regNo,
            serviceLabel: label,
            dueDate: dateStr(due),
            daysRemaining: days,
            status: days <= 0 ? 'overdue' : days <= 3 ? 'today' : days <= 7 ? 'tomorrow' : 'upcoming',
          });
        }
      }
    });

    // 3. Payment Due
    const pending = parseFloat(c.pendingAmount || 0);
    if (pending > 0) {
      const dueDateRaw = c.paymentDueDate ? new Date(c.paymentDueDate) : addDays(new Date(), 7);
      const days = diffDays(dueDateRaw);
      if (days >= -30 && days <= 30) {
        reminders.push({
          id: `pay-${id}`,
          type: 'payment',
          customerId: id,
          customerName: name,
          phone,
          vehicleModel: model,
          regNo,
          amount: pending,
          dueDate: dateStr(dueDateRaw),
          daysRemaining: days,
          status: days <= 0 ? 'overdue' : days <= 1 ? 'today' : days <= 3 ? 'tomorrow' : 'upcoming',
        });
      }
    }

    // 4. RTO Pending
    const insDate = c.insuranceDate || c.insuranceStartDate;
    if (insDate) {
      const rto = addDays(new Date(insDate), 7);
      const days = diffDays(rto);
      if (days >= 0 && days <= 7) {
        reminders.push({
          id: `rto-${id}`,
          type: 'insurance',
          customerId: id,
          customerName: name,
          phone,
          vehicleModel: model,
          regNo,
          dueDate: dateStr(rto),
          daysRemaining: days,
          status: days <= 0 ? 'overdue' : days <= 1 ? 'today' : days <= 3 ? 'tomorrow' : 'upcoming',
        });
      }
    }

    // 5. Insurance Renewal
    const insStart = c.insuranceStartDate || c.insuranceDate || (purchaseDate ? dateStr(addDays(new Date(purchaseDate), 3)) : null);
    if (insStart) {
      const renewalDue = addDays(new Date(insStart), 335);
      const days = diffDays(renewalDue);
      if (days >= -30 && days <= 60) {
        reminders.push({
          id: `insr-${id}`,
          type: 'insurance-renewal',
          customerId: id,
          customerName: name,
          phone,
          vehicleModel: model,
          regNo,
          dueDate: dateStr(renewalDue),
          daysRemaining: days,
          status: days <= 0 ? 'overdue' : days <= 3 ? 'today' : days <= 7 ? 'tomorrow' : 'upcoming',
        });
      }
    }
  });

  return reminders.sort((a, b) => {
    if (a.status === 'overdue' && b.status !== 'overdue') return -1;
    if (b.status === 'overdue' && a.status !== 'overdue') return 1;
    return a.daysRemaining - b.daysRemaining;
  });
}

// ── Single Daily Notification Scheduler (10:00 AM) ─────────────────────
function buildDailyNotificationSchedule(reminders) {
  const scheduled = [];
  const now = new Date();
  const todayStr = dateStr(now);
  const tomorrowStr = dateStr(addDays(now, 1));

  const sentKey = `vp_notif_sent_${todayStr}`;
  let sentToday = new Set();
  try { sentToday = new Set(JSON.parse(localStorage.getItem(sentKey) || '[]')); } catch {}

  // Clean old entries
  try {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('vp_notif_sent_') && !k.includes(todayStr)) localStorage.removeItem(k);
    });
  } catch {}

  // 10:00 AM Today or Tomorrow
  let fireTime = new Date(now);
  fireTime.setHours(10, 0, 0, 0);
  if (fireTime < now) fireTime = addDays(fireTime, 1);

  reminders.forEach(r => {
    if (isReminderDone(r.id)) return;

    const cfg = NOTIF_CONFIG[r.type] || NOTIF_CONFIG['service'];
    let title, body, notifId;

    if (r.status === 'overdue') {
      notifId = `ov-${r.id}`;
      if (sentToday.has(notifId)) return;
      title = cfg.overdueTitle(r);
      body = cfg.overdueBody(r);
    } else if (r.dueDate === todayStr) {
      notifId = `td-${r.id}`;
      if (sentToday.has(notifId)) return;
      title = cfg.urgentTitle(r);
      body = cfg.urgentBody(r);
    } else if (r.dueDate === tomorrowStr) {
      notifId = `tm-${r.id}`;
      if (sentToday.has(notifId)) return;
      title = cfg.tomorrowTitle(r);
      body = cfg.tomorrowBody(r);
    } else return;

    scheduled.push({
      id: notifId,
      title,
      body,
      type: r.type,
      fireAt: fireTime.toISOString(),
      tag: notifId,
      requireInteraction: true,
      url: '/reminders',
    });

    sentToday.add(notifId);
  });

  // Save sent status
  try {
    localStorage.setItem(sentKey, JSON.stringify([...sentToday]));
  } catch {}

  return scheduled;
}

// ── Main Export ─────────────────────────────────────────────────────
export async function scheduleReminderNotifications(customers) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const reminders = buildAllReminders(customers);
    const scheduled = buildDailyNotificationSchedule(reminders);

    await saveToIDB(reminders);

    // Send to Service Worker (Web Push + VAPID)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active) {
        reg.active.postMessage({
          type: 'SCHEDULE_REMINDERS',
          payload: scheduled
        });
      }
    }

    console.log(`[VP Notif] ${scheduled.length} notifications scheduled for 10:00 AM`);
    return { reminders, scheduled };
  } catch (e) {
    console.warn('[VP Notif] Error:', e);
    return { reminders: [], scheduled: [] };
  }
}

// ── IndexedDB Save ──────────────────────────────────────────────────
async function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      if (!e.target.result.objectStoreNames.contains(STORE_NAME))
        e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror = () => rej(req.error);
  });
}

async function saveToIDB(reminders) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    reminders.forEach(r => store.put(r));
  } catch (e) {
    console.warn('IDB save failed:', e);
  }
}

// ── Done / Dismiss System ───────────────────────────────────────────
const DONE_KEY = 'vp_notif_done';

export function markReminderDone(reminderId, reason = 'done') {
  try {
    const done = JSON.parse(localStorage.getItem(DONE_KEY) || '{}');
    done[reminderId] = { reason, doneAt: new Date().toISOString() };
    localStorage.setItem(DONE_KEY, JSON.stringify(done));
  } catch {}
}

export function isReminderDone(reminderId) {
  try {
    const done = JSON.parse(localStorage.getItem(DONE_KEY) || '{}');
    return !!done[reminderId];
  } catch { return false; }
}

export function filterActivReminders(reminders) {
  return reminders.filter(r => !isReminderDone(r.id));
}

// ── Summary ─────────────────────────────────────────────────────────
export function getReminderSummary(customers) {
  const reminders = buildAllReminders(customers);
  return {
    total: reminders.length,
    overdue: reminders.filter(r => r.status === 'overdue').length,
    today: reminders.filter(r => r.dueDate === dateStr(new Date())).length,
    tomorrow: reminders.filter(r => r.dueDate === dateStr(addDays(new Date(), 1))).length,
    items: reminders,
  };
}

// Test Notification
export async function sendTestNotification() {
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({
      type: 'SHOW_NOTIFICATION',
      payload: {
        title: '🔔 VP Honda Test Notification',
        body: 'Notifications working correctly at 10:00 AM schedule.',
        tag: 'test-notification'
      }
    });
  }
}