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
    const model   = c.vehicleModel || c.linkedVehicle?.model || '';
    const regNo   = c.regNo || c.linkedVehicle?.regNo || c.registrationNumber || '';
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

// ── Build notification schedule from reminders ───────────────────────────────
function buildNotificationSchedule(reminders) {
  const scheduled = [];
  const now       = new Date();
  const todayStr  = dateStr(now);
  const tmrwStr   = dateStr(addDays(now, 1));

  // Morning 10 AM fire times
  const at10Today = new Date(now); at10Today.setHours(10, 0, 0, 0);
  const at10Tmrw  = new Date(now); at10Tmrw.setDate(at10Tmrw.getDate()+1); at10Tmrw.setHours(10, 0, 0, 0);
  const fireToday = at10Today > now ? at10Today : new Date(now.getTime() + 2000);

  reminders.forEach(r => {
    const cfg = NOTIF_CONFIG[r.type] || NOTIF_CONFIG['service'];

    if (r.status === 'overdue') {
      scheduled.push({
        id:    `notif-ov-${r.id}`,
        title: cfg.overdueTitle(r),
        body:  cfg.overdueBody(r),
        type:  r.type,
        fireAt: new Date(now.getTime() + 3000).toISOString(),  // 3 sec delay
        tag:   `ov-${r.id}`,
        requireInteraction: true,
        url:   '/reminders',
      });
    } else if (r.dueDate === todayStr) {
      scheduled.push({
        id:    `notif-td-${r.id}`,
        title: cfg.urgentTitle(r),
        body:  cfg.urgentBody(r),
        type:  r.type,
        fireAt: fireToday.toISOString(),
        tag:   `td-${r.id}`,
        requireInteraction: true,
        url:   '/reminders',
      });
    } else if (r.dueDate === tmrwStr) {
      scheduled.push({
        id:    `notif-tm-${r.id}`,
        title: cfg.tomorrowTitle(r),
        body:  cfg.tomorrowBody(r),
        type:  r.type,
        fireAt: at10Tmrw.toISOString(),
        tag:   `tm-${r.id}`,
        requireInteraction: false,
        url:   '/reminders',
      });
    }
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
export async function scheduleReminderNotifications(customers) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const reminders = buildAllReminders(customers);
    const scheduled = buildNotificationSchedule(reminders);

    // Save to IDB for background SW checks
    await saveToIDB(reminders);

    // Send schedule to Service Worker
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active) {
        reg.active.postMessage({ type: 'SCHEDULE_REMINDERS', payload: scheduled });
      }
    }

    await registerPeriodicSync();
    console.log(`[Notif] ${scheduled.length} notifications scheduled from ${reminders.length} reminders`);
    return { reminders, scheduled };
  } catch(e) {
    console.warn('[Notif] Failed:', e);
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
  } 
}
          
