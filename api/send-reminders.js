// api/send-reminders.js — Vercel Serverless Function
// 6 cron jobs: payment/insurance/service × सुबह + दोपहर
// Unique tag per customer → Android में stack (replace नहीं होती)
// notificationlogs से already-sent-today check → repeat नहीं
const VAPID_PUBLIC  = 'BKwecIw_aOdebFYVONRm-ZF3au68bNWU1uHPSXkwr1LvV7dIS-b-v614SMT6UgjHbcqigskmSAhFBWHxV9a__TM';
const VAPID_PRIVATE = 'BphjFle5WwJGYAMWYMIF2bFT1BypFyCmT35JFXsGYYI';

const SERVICE_MAP = [
  { done:'firstServiceDate',  next:'2nd', label:'2nd Service', days:120 },
  { done:'secondServiceDate', next:'3rd', label:'3rd Service', days:120 },
  { done:'thirdServiceDate',  next:'4th', label:'4th Service', days:120 },
  { done:'fourthServiceDate', next:'5th', label:'5th Service', days:120 },
  { done:'fifthServiceDate',  next:'6th', label:'6th Service', days:120 },
  { done:'sixthServiceDate',  next:'7th', label:'7th Service', days:120 },
];
const SERVICE_KEY_MAP = { '1st':'firstService','2nd':'secondService','3rd':'thirdService','4th':'fourthService','5th':'fifthService','6th':'sixthService','7th':'seventhService' };

let cachedClient = null;
async function getDb(MongoClient, uri) {
  if (cachedClient) { try { await cachedClient.db().admin().ping(); return cachedClient.db(); } catch { cachedClient = null; } }
  cachedClient = new MongoClient(uri);
  await cachedClient.connect();
  return cachedClient.db();
}

async function getCol(db, names) {
  for (const name of names) {
    try { const c = await db.collection(name).find({}).toArray(); if (c.length) return { name, data: c }; } catch {}
  }
  return { name: null, data: [] };
}

// ✅ Unique tag per customer+type → Android में stack बनेगी (replace नहीं होगी)
// payload में tag field है → SW इसे use करेगा
async function sendOne(webpush, db, { title, body, url, tag }) {
  const { data: subs } = await getCol(db, ['pushsubscriptions', 'pushsubs', 'subscriptions']);
  if (!subs.length) return 0;
  const payload = JSON.stringify({
    title, body,
    url:   url || '/reminders',
    icon:  '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    tag:   tag || 'vph-reminder',       // ✅ unique tag → stack
    renotify: false,                    // same tag → stack में add, dismiss नहीं
  });
  let sent = 0;
  for (const raw of subs) {
    const sub  = raw.subscription || raw;
    const ep   = sub.endpoint;
    const keys = sub.keys || { p256dh: sub.p256dh, auth: sub.auth };
    if (!ep || typeof ep !== 'string' || !keys?.p256dh || !keys?.auth) continue;
    try { await webpush.sendNotification({ endpoint: ep, keys }, payload); sent++; }
    catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        try { await db.collection('pushsubscriptions').deleteOne({ endpoint: ep }); } catch {}
      }
    }
  }
  return sent;
}

// ── Build reminders (same as RemindersPage logic) ────────────────────────────
function buildReminders(serviceData, typeFilter) {
  const all = [];
  const today = new Date(); today.setHours(0,0,0,0);
  const todayMs = today.getTime(), DAY = 86400000;

  for (const data of serviceData) {
    const regNo = data.regNo || data.registrationNo;
    if (!regNo || regNo === 'no_reg_') continue;
    const nm = data.customerName || 'Unknown';
    const ph = data.phone || '';
    const vh = data.vehicle || data.vehicleModel || '';
    const id = String(data._id || data.regNo || nm).slice(-8); // short ID for tag

    // Payment
    if (!typeFilter || typeFilter === 'payment') {
      const pend = parseFloat(data.pendingAmount || 0);
      if (pend > 0 && !data.paymentReceivedDate) {
        let dr = 999;
        if (data.paymentDueDate) {
          const dd = new Date(data.paymentDueDate); dd.setHours(0,0,0,0);
          dr = Math.floor((dd - todayMs) / DAY);
        }
        all.push({ id, type:'payment', customerName:nm, phone:ph, vehicleModel:vh, regNo, title:'💳 Payment Due', daysRemaining:dr, amount:pend });
      }
    }

    // RTO
    if (!typeFilter || typeFilter === 'insurance') {
      if (data.insuranceDate && !data.rtoDoneDate) {
        const ins = new Date(data.insuranceDate); ins.setHours(0,0,0,0);
        const rto = new Date(ins.getTime() + 7*DAY);
        const dr  = Math.floor((rto - todayMs) / DAY);
        if (dr >= 0 && dr <= 7) all.push({ id, type:'insurance', customerName:nm, phone:ph, vehicleModel:vh, regNo, title:'🚗 RTO Pending', daysRemaining:dr });
      }
      // Insurance Renewal
      const insStartRaw = data.insuranceStartDate || data.insuranceDate || (data.purchaseDate ? new Date(new Date(data.purchaseDate).getTime() + 3*DAY).toISOString().split('T')[0] : null);
      if (insStartRaw && !data.insuranceRenewed) {
        const insStart  = new Date(insStartRaw); insStart.setHours(0,0,0,0);
        const renewalDue = new Date(insStart.getTime() + 335*DAY);
        const dr = Math.floor((renewalDue - todayMs) / DAY);
        if (dr >= -30 && dr <= 60) all.push({ id, type:'insurance-renewal', customerName:nm, phone:ph, vehicleModel:vh, regNo, title: dr<=0?'🛡️ Insurance Expired!':'🛡️ Insurance Renewal Due', daysRemaining:dr });
      }
    }

    // Service
    if (!typeFilter || typeFilter === 'service') {
      if (data.purchaseDate && !data.firstServiceDate) {
        const pd = new Date(data.purchaseDate); pd.setHours(0,0,0,0);
        const due = new Date(pd.getTime() + 30*DAY);
        const dr  = Math.floor((due - todayMs) / DAY);
        if (dr >= -30) all.push({ id, type:'service', customerName:nm, phone:ph, vehicleModel:vh, regNo, title:'🔧 1st Service Due', daysRemaining:dr });
      }
      for (const svc of SERVICE_MAP) {
        const doneDate = data[svc.done];
        const nextKey  = (SERVICE_KEY_MAP[svc.next]||'') + 'Date';
        if (doneDate && !data[nextKey]) {
          const prev = new Date(doneDate); prev.setHours(0,0,0,0);
          const due  = new Date(prev.getTime() + svc.days*DAY);
          const dr   = Math.floor((due - todayMs) / DAY);
          if (dr >= -30) all.push({ id, type:'service', customerName:nm, phone:ph, vehicleModel:vh, regNo, title:`🔧 ${svc.label} Due`, daysRemaining:dr });
          break;
        }
      }
    }
  }
  return all;
}

function shouldNotify(r, typeFilter) {
  const d = r.daysRemaining, t = r.type;
  if (typeFilter && t !== typeFilter && !(typeFilter==='insurance' && t==='insurance-renewal')) return false;
  if (t === 'payment')           return d < 0 || d <= 3;
  if (t === 'service')           return d >= -30 && d <= 5;
  if (t === 'insurance')         return d >= 0 && d <= 7;
  if (t === 'insurance-renewal') return d >= -30 && d <= 30;
  return d >= -30 && d <= 5;
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const uri  = process.env.MONGODB_URI;
  if (!uri) return res.status(500).json({ error: 'MONGODB_URI not set' });

  // ✅ Type filter from cron URL query param
  const typeFilter = (req.query?.type || '').toLowerCase() || null;

  let MongoClient, webpush;
  try { ({ MongoClient } = await import('mongodb')); } catch (e) { return res.status(500).json({ error: 'mongodb not installed', detail: e.message }); }
  try { webpush = (await import('web-push')).default; }  catch (e) { return res.status(500).json({ error: 'web-push not installed', detail: e.message }); }

  try {
    webpush.setVapidDetails('mailto:admin@vphonda.com', VAPID_PUBLIC, VAPID_PRIVATE);
    const db = await getDb(MongoClient, uri);
    const collNames = (await db.listCollections().toArray()).map(c => c.name);

    const { data: serviceData } = await getCol(db, ['servicedatas', 'servicedata', 'serviceData', 'service_data']);
    const reminders  = buildReminders(serviceData, typeFilter);
    const urgent     = reminders.filter(r => shouldNotify(r, typeFilter));

    // ── Debug mode ──────────────────────────────────────────────────────────
    const isDebug = req.query?.debug;
    if (isDebug) {
      const { data: subs } = await getCol(db, ['pushsubscriptions', 'pushsubs', 'subscriptions']);
      return res.status(200).json({
        ok: true, mode: 'debug', typeFilter: typeFilter||'all', collections: collNames,
        serviceDataCount: serviceData.length, totalReminders: reminders.length,
        urgentReminders: urgent.length, subscriptions: subs.length,
        breakdown: {
          payment: reminders.filter(r=>r.type==='payment').length,
          service: reminders.filter(r=>r.type==='service').length,
          insurance: reminders.filter(r=>r.type==='insurance').length,
          insuranceRenewal: reminders.filter(r=>r.type==='insurance-renewal').length,
        },
        sampleUrgent: urgent.slice(0,3),
      });
    }

    // ── Check already-sent-today (avoid "all-clear" spam) ──────────────────
    const todayStr  = new Date().toISOString().slice(0,10);
    const logKey    = `${todayStr}-${typeFilter||'all'}`;
    let alreadySentToday = [];
    try {
      const logEntry = await db.collection('notificationlogs').findOne({ logKey });
      alreadySentToday = logEntry?.sentIds || [];
    } catch {}

    // Filter out already-sent customers for same type+day
    const newUrgent = urgent.filter(r => !alreadySentToday.includes(`${r.type}-${r.id}`));

    if (newUrgent.length === 0) {
      // ✅ "all-clear" सिर्फ एक बार — अगर पहले भी all-clear था तो skip (spam नहीं)
      const lastLog = await db.collection('notificationlogs').findOne({ logKey });
      if (lastLog?.allClearSent) {
        return res.status(200).json({ ok: true, mode:'skip-repeat-all-clear', typeFilter });
      }
      // पहली बार all-clear send करें
      await sendOne(webpush, db, {
        title: '✅ VP Honda',
        body:  `${typeFilter||'सब'} — आज कोई urgent reminder नहीं`,
        url:   '/reminders',
        tag:   `vph-allclear-${typeFilter||'all'}`,
      });
      await db.collection('notificationlogs').updateOne({ logKey }, { $set: { logKey, allClearSent: true, sentAt: new Date() } }, { upsert: true });
      return res.status(200).json({ ok: true, mode:'all-clear', typeFilter, serviceDataCount: serviceData.length });
    }

    // ── Priority sort ───────────────────────────────────────────────────────
    const typePri = { payment: 3, 'insurance-renewal': 2, insurance: 2, service: 1 };
    newUrgent.sort((a, b) => {
      const aO = a.daysRemaining < 0, bO = b.daysRemaining < 0;
      if (aO !== bO) return aO ? -1 : 1;
      const aD = Math.abs(a.daysRemaining), bD = Math.abs(b.daysRemaining);
      if (aD !== bD) return bD - aD;
      return (typePri[b.type]||0) - (typePri[a.type]||0);
    });

    const top = newUrgent.slice(0, 5);
    const overdueCount  = newUrgent.filter(r => r.daysRemaining < 0).length;
    const upcomingCount = newUrgent.length - overdueCount;
    let pushCount = 0;

    // ── 1. Summary (group header) ────────────────────────────────────────────
    const typeLabel = typeFilter==='payment'?'💳 Payment':typeFilter==='insurance'?'🛡️ Insurance':typeFilter==='service'?'🔧 Service':'📋 All';
    await sendOne(webpush, db, {
      title: `🔔 VP Honda — ${typeLabel} Reminders`,
      body:  `🚨 ${overdueCount} overdue · ⏰ ${upcomingCount} upcoming (${newUrgent.length} total)`,
      url:   '/reminders',
      tag:   `vph-summary-${typeFilter||'all'}`,  // summary tag unique per type
    });
    pushCount++;

    // ── 2. Top 5 — हर एक को UNIQUE tag ─────────────────────────────────────
    // Unique tag = type + customer short ID → Android में अलग-अलग stack
    for (const r of top) {
      const days    = Math.abs(r.daysRemaining);
      const overdue = r.daysRemaining < 0;
      const icon    = overdue ? '🚨' : '⏰';
      const regTxt  = r.regNo ? ` (${r.regNo})` : '';
      const phoneClean = (r.phone||'').replace(/[^0-9]/g,'').slice(-10);
      await sendOne(webpush, db, {
        title: `${icon} ${r.customerName} — ${r.title}`,
        body:  `${r.vehicleModel}${regTxt} — ${days}d ${overdue?'overdue':'remaining'}\n📞 ${r.phone}`,
        url:   `/reminders?focus=${encodeURIComponent(r.customerName)}&phone=${phoneClean}&type=${r.type}`,
        tag:   `vph-${r.type}-${r.id}`,  // ✅ UNIQUE per customer+type → stack में अलग रहेगा
      });
      await new Promise(rs => setTimeout(rs, 400));
      pushCount++;
    }

    // ── Log sent IDs → repeat नहीं होंगे ───────────────────────────────────
    const newSentIds = top.map(r => `${r.type}-${r.id}`);
    try {
      await db.collection('notificationlogs').updateOne(
        { logKey },
        { $addToSet: { sentIds: { $each: newSentIds } }, $set: { updatedAt: new Date() } },
        { upsert: true }
      );
    } catch {}

    res.status(200).json({ ok: true, typeFilter: typeFilter||'all', sent: pushCount, urgent: newUrgent.length, newSent: top.length });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: (err.stack||'').split('\n').slice(0,3) });
  }
}
