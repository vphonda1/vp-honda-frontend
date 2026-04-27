// ════════════════════════════════════════════════════════════════════════════
// src/utils/notificationScheduler.js
// VP Honda — Reminder Notification System
// ════════════════════════════════════════════════════════════════════════════
// कैसे काम करता है:
// 1. App खुलने पर सब customers की service dates check करता है
// 2. आज/कल due reminders निकालता है
// 3. Service Worker को schedule देता है
// 4. IndexedDB में save करता है (background check के लिए)
// 5. आज/कल के due reminders → तुरंत notification
// ════════════════════════════════════════════════════════════════════════════

const DB_NAME    = 'vp-reminders';
const DB_VERSION = 1;
const STORE_NAME = 'reminders';

// ─── IndexedDB open ────────────────────────────────────────────────────────
function openReminderDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = () => reject(req.error);
  });
}

async function saveRemindersToIDB(reminders) {
  try {
    const db = await openReminderDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    // Clear old reminders first
    store.clear();
    reminders.forEach(r => store.put(r));
  } catch (err) {
    console.warn('IDB save failed:', err);
  }
}

// ─── Honda Free Service Schedule ──────────────────────────────────────────
const FREE_SERVICES = [
  { num: 1, label: '1st Free Service', months: 1  },
  { num: 2, label: '2nd Free Service', months: 6  },
  { num: 3, label: '3rd Free Service', months: 12 },
  { num: 4, label: '4th Free Service', months: 18 },
  { num: 5, label: '5th Free Service', months: 24 },
];

// Also map from RemindersPage SERVICE_MAP fields
const REMINDER_FIELDS = [
  { doneField: 'firstServiceDate',  label: '2nd Service', days: 120 },
  { doneField: 'secondServiceDate', label: '3rd Service', days: 120 },
  { doneField: 'thirdServiceDate',  label: '4th Service', days: 120 },
  { doneField: 'fourthServiceDate', label: '5th Service', days: 120 },
  { doneField: 'fifthServiceDate',  label: '6th Service', days: 120 },
];

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dateStr(date) {
  return date.toISOString().split('T')[0];
}

function diffDays(date) {
  return Math.ceil((new Date(date) - new Date()) / 86400000);
}

// ─── Build reminder list from customers ────────────────────────────────────
function buildReminders(customers) {
  const reminders = [];

  customers.forEach(c => {
    const name  = c.customerName || c.name || 'Customer';
    const phone = c.mobileNo || c.phone || '';
    const model = c.vehicleModel || c.linkedVehicle?.model || '';

    // Method 1: From purchaseDate (Honda free services)
    const purchaseDate = c.purchaseDate || c.linkedVehicle?.purchaseDate;
    if (purchaseDate) {
      FREE_SERVICES.forEach(s => {
        const dueDate = addMonths(new Date(purchaseDate), s.months);
        const days    = diffDays(dueDate);
        if (days >= -7 && days <= 30) {  // -7 (overdue) to 30 days future
          reminders.push({
            id:           `${c._id || c.id || name}-free-${s.num}`,
            customerId:   c._id || c.id,
            customerName: name,
            phone,
            vehicleModel: model,
            serviceLabel: s.label,
            dueDate:      dateStr(dueDate),
            daysRemaining: days,
            status:       days < 0 ? 'overdue' : days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'upcoming',
            source:       'free-service',
          });
        }
      });
    }

    // Method 2: From done service dates (RemindersPage style)
    REMINDER_FIELDS.forEach(({ doneField, label, days }) => {
      const doneDate = c[doneField];
      if (doneDate) {
        const dueDate   = addDays(new Date(doneDate), days);
        const remaining = diffDays(dueDate);
        if (remaining >= -7 && remaining <= 30) {
          reminders.push({
            id:           `${c._id || c.id || name}-done-${doneField}`,
            customerId:   c._id || c.id,
            customerName: name,
            phone,
            vehicleModel: model,
            serviceLabel: label,
            dueDate:      dateStr(dueDate),
            daysRemaining: remaining,
            status:       remaining < 0 ? 'overdue' : remaining === 0 ? 'today' : remaining === 1 ? 'tomorrow' : 'upcoming',
            source:       'done-service',
          });
        }
      }
    });

    // Method 3: Insurance/PUC expiry
    const insuranceExp = c.linkedVehicle?.insuranceExpiry || c.insuranceExpiry;
    if (insuranceExp) {
      const days = diffDays(insuranceExp);
      if (days >= -7 && days <= 30) {
        reminders.push({
          id:           `${c._id || c.id || name}-insurance`,
          customerId:   c._id || c.id,
          customerName: name,
          phone,
          vehicleModel: model,
          serviceLabel: 'Insurance Expiry',
          dueDate:      dateStr(new Date(insuranceExp)),
          daysRemaining: days,
          status:       days < 0 ? 'overdue' : days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'upcoming',
          source:       'insurance',
        });
      }
    }
  });

  return reminders;
}

// ─── Build notification schedule ───────────────────────────────────────────
function buildNotificationSchedule(reminders) {
  const scheduled = [];
  const today     = dateStr(new Date());
  const tomorrow  = dateStr(addDays(new Date(), 1));
  // Notification times: 10:00 AM today and tomorrow
  const todayAt10    = new Date(); todayAt10.setHours(10, 0, 0, 0);
  const tomorrowAt10 = new Date(); tomorrowAt10.setDate(tomorrowAt10.getDate() + 1); tomorrowAt10.setHours(10, 0, 0, 0);

  reminders.forEach(r => {
    if (r.status === 'overdue') {
      scheduled.push({
        id:    `notif-overdue-${r.id}`,
        title: `🚨 ${r.customerName} — Service Overdue!`,
        body:  `${r.serviceLabel}\n🏍️ ${r.vehicleModel || 'Vehicle'}\n📅 ${Math.abs(r.daysRemaining)} दिन पहले due था`,
        fireAt: new Date().toISOString(),   // Immediately
        data:   { url: '/reminders', tag: `overdue-${r.id}`, requireInteraction: true },
      });
    } else if (r.dueDate === today) {
      scheduled.push({
        id:    `notif-today-${r.id}`,
        title: `⏰ आज Service Due — ${r.customerName}`,
        body:  `${r.serviceLabel}\n🏍️ ${r.vehicleModel || 'Vehicle'}\n📞 ${r.phone || 'No phone'}`,
        fireAt: todayAt10 > new Date() ? todayAt10.toISOString() : new Date().toISOString(),
        data:   { url: '/reminders', tag: `today-${r.id}`, requireInteraction: true },
      });
    } else if (r.dueDate === tomorrow) {
      scheduled.push({
        id:    `notif-tomorrow-${r.id}`,
        title: `📅 कल Service Due — ${r.customerName}`,
        body:  `${r.serviceLabel}\n🏍️ ${r.vehicleModel || 'Vehicle'}\n📞 ${r.phone || 'No phone'}`,
        fireAt: tomorrowAt10.toISOString(),
        data:   { url: '/reminders', tag: `tomorrow-${r.id}` },
      });
    }
  });

  return scheduled;
}

// ─── Register Periodic Sync ─────────────────────────────────────────────────
async function registerPeriodicSync() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if ('periodicSync' in reg) {
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (status.state === 'granted') {
        await reg.periodicSync.register('vp-reminder-check', {
          minInterval: 8 * 60 * 60 * 1000,   // Check every 8 hours
        });
        console.log('[Notif] Periodic sync registered');
      }
    }
  } catch (err) {
    console.log('[Notif] Periodic sync not available:', err);
  }
}

// ─── MAIN EXPORT: Schedule all reminders ───────────────────────────────────
export async function scheduleReminderNotifications(customers) {
  try {
    // 1. Check permission
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    // 2. Build reminders
    const reminders  = buildReminders(customers);
    const scheduled  = buildNotificationSchedule(reminders);

    // 3. Save to IndexedDB (for background checks)
    await saveRemindersToIDB(reminders);

    // 4. Send to Service Worker to schedule
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active) {
        reg.active.postMessage({
          type:    'SCHEDULE_REMINDERS',
          payload: scheduled,
        });
      }
    }

    // 5. Register periodic sync
    await registerPeriodicSync();

    console.log(`[Notif] Scheduled ${scheduled.length} notifications from ${reminders.length} reminders`);
    return { reminders, scheduled };
  } catch (err) {
    console.warn('[Notif] Schedule failed:', err);
    return { reminders: [], scheduled: [] };
  }
}

// ─── Send immediate test notification ──────────────────────────────────────
export async function sendTestNotification() {
  if (Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;
  }
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({
      type:    'SHOW_NOTIFICATION',
      payload: {
        title: '🔔 VP Honda Notifications Active!',
        body:  'Service due reminders अब automatically आएंगे। आज और कल के reminders phone पर दिखेंगे।',
        data:  { url: '/reminders', tag: 'test', requireInteraction: false },
      },
    });
  }
  return true;
}

// ─── Get reminder summary ───────────────────────────────────────────────────
export function getReminderSummary(customers) {
  const reminders = buildReminders(customers);
  return {
    total:    reminders.length,
    overdue:  reminders.filter(r => r.status === 'overdue').length,
    today:    reminders.filter(r => r.status === 'today').length,
    tomorrow: reminders.filter(r => r.status === 'tomorrow').length,
    upcoming: reminders.filter(r => r.status === 'upcoming').length,
    items:    reminders.sort((a, b) => a.daysRemaining - b.daysRemaining),
  };
}