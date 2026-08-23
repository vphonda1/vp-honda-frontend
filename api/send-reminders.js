// api/send-reminders.js — Vercel Serverless Function
// ════════════════════════════════════════════════════════════════════════════
// VP Honda — Reminder Push Notifications (Vercel Cron)
//
// v2 में क्या ठीक हुआ:
//  1. ⏱️  पहले हर notification के बीच 400ms का blocking wait था और हर notification
//         के लिए subscriptions दोबारा DB से पढ़े जाते थे (6 बार!). इससे function
//         timeout हो जाता था और notifications बीच में ही रुक जाती थीं.
//         अब: subscriptions एक बार पढ़े जाते हैं, सारे push parallel में जाते हैं.
//  2. 🐞 पहले अगर आज के सारे reminders भेजे जा चुके होते थे, तो function गलती से
//         "आज कोई urgent reminder नहीं" वाली all-clear notification भेज देता था.
//         अब all-clear सिर्फ तभी जाती है जब सच में 0 urgent reminders हों.
//  3. 🔑 VAPID keys अब environment variables से आती हैं (code में hardcode fallback
//         रखा है ताकि कुछ टूटे नहीं — पर Vercel में env set करना बेहतर है).
//  4. 🧪 ?debug=1 (कुछ नहीं भेजता, सिर्फ diagnosis) और ?force=1 (आज का
//         already-sent log ignore करके दोबारा भेजता है — testing के लिए).
//  5. 🔒 CRON_SECRET env set हो तो बाहरी लोग endpoint नहीं चला सकते.
// ════════════════════════════════════════════════════════════════════════════

const VAPID_PUBLIC =
  process.env.VAPID_PUBLIC_KEY ||
  'BKwecIw_aOdebFYVONRm-ZF3au68bNWU1uHPSXkwr1LvV7dIS-b-v614SMT6UgjHbcqigskmSAhFBWHxV9a__TM';
const VAPID_PRIVATE =
  process.env.VAPID_PRIVATE_KEY || 'BphjFle5WwJGYAMWYMIF2bFT1BypFyCmT35JFXsGYYI';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@vphonda.com';

const SERVICE_MAP = [
  { done: 'firstServiceDate',  next: '2nd', label: '2nd Service', days: 120 },
  { done: 'secondServiceDate', next: '3rd', label: '3rd Service', days: 120 },
  { done: 'thirdServiceDate',  next: '4th', label: '4th Service', days: 120 },
  { done: 'fourthServiceDate', next: '5th', label: '5th Service', days: 120 },
  { done: 'fifthServiceDate',  next: '6th', label: '6th Service', days: 120 },
  { done: 'sixthServiceDate',  next: '7th', label: '7th Service', days: 120 },
];
const SERVICE_KEY_MAP = {
  '1st': 'firstService',  '2nd': 'secondService', '3rd': 'thirdService',
  '4th': 'fourthService', '5th': 'fifthService',  '6th': 'sixthService',
  '7th': 'seventhService',
};

const SUB_COLLECTIONS  = ['pushsubscriptions', 'pushsubs', 'subscriptions'];
const DATA_COLLECTIONS = ['servicedatas', 'servicedata', 'serviceData', 'service_data'];

// ── DB connection (warm invocations में reuse) ───────────────────────────────
let cachedClient = null;
async function getDb(MongoClient, uri) {
  if (cachedClient) {
    try { await cachedClient.db().admin().ping(); return cachedClient.db(); }
    catch { cachedClient = null; }
  }
  cachedClient = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await cachedClient.connect();
  return cachedClient.db();
}

async function getCol(db, names) {
  for (const name of names) {
    try {
      const c = await db.collection(name).find({}).toArray();
      if (c.length) return { name, data: c };
    } catch {}
  }
  return { name: null, data: [] };
}

// ── Subscription list normalise (एक बार) ────────────────────────────────────
function normaliseSubs(rawSubs) {
  const out = [];
  for (const raw of rawSubs) {
    const sub  = raw.subscription || raw;
    const ep   = sub.endpoint;
    const keys = sub.keys || { p256dh: sub.p256dh, auth: sub.auth };
    if (!ep || typeof ep !== 'string' || !keys?.p256dh || !keys?.auth) continue;
    out.push({ endpoint: ep, keys });
  }
  return out;
}

// ── एक notification सभी devices को — parallel, बिना blocking wait ───────────
async function sendOne(webpush, subs, { title, body, url, tag }) {
  if (!subs.length) return { sent: 0, dead: [] };
  const payload = JSON.stringify({
    title, body,
    url:   url || '/reminders',
    icon:  '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    tag:   tag || 'vph-reminder',   // unique tag → Android में stack बनती है
    renotify: false,
  });

  const results = await Promise.allSettled(
    subs.map(s => webpush.sendNotification(s, payload))
  );

  let sent = 0;
  const dead = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') { sent++; return; }
    const code = r.reason?.statusCode;
    if (code === 410 || code === 404) dead.push(subs[i].endpoint);
  });
  return { sent, dead };
}

// ── Build reminders (RemindersPage वाली ही logic) ────────────────────────────
function buildReminders(serviceData, typeFilter) {
  const all = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime(), DAY = 86400000;

  for (const data of serviceData) {
    const regNo = data.regNo || data.registrationNo;
    if (!regNo || regNo === 'no_reg_') continue;
    const nm = data.customerName || 'Unknown';
    const ph = data.phone || '';
    const vh = data.vehicle || data.vehicleModel || '';
    const id = String(data._id || data.regNo || nm).slice(-8);

    // Payment
    if (!typeFilter || typeFilter === 'payment') {
      const pend = parseFloat(data.pendingAmount || 0);
      if (pend > 0 && !data.paymentReceivedDate) {
        let dr = 999;
        if (data.paymentDueDate) {
          const dd = new Date(data.paymentDueDate); dd.setHours(0, 0, 0, 0);
          dr = Math.floor((dd - todayMs) / DAY);
        }
        all.push({ id, type: 'payment', customerName: nm, phone: ph, vehicleModel: vh, regNo, title: '💳 Payment Due', daysRemaining: dr, amount: pend });
      }
    }

    // RTO + Insurance renewal
    if (!typeFilter || typeFilter === 'insurance') {
      if (data.insuranceDate && !data.rtoDoneDate) {
        const ins = new Date(data.insuranceDate); ins.setHours(0, 0, 0, 0);
        const rto = new Date(ins.getTime() + 7 * DAY);
        const dr  = Math.floor((rto - todayMs) / DAY);
        if (dr >= 0 && dr <= 7) all.push({ id, type: 'insurance', customerName: nm, phone: ph, vehicleModel: vh, regNo, title: '🚗 RTO Pending', daysRemaining: dr });
      }
      const insStartRaw = data.insuranceStartDate || data.insuranceDate ||
        (data.purchaseDate ? new Date(new Date(data.purchaseDate).getTime() + 3 * DAY).toISOString().split('T')[0] : null);
      if (insStartRaw && !data.insuranceRenewed) {
        const insStart = new Date(insStartRaw); insStart.setHours(0, 0, 0, 0);
        const renewalDue = new Date(insStart.getTime() + 335 * DAY);
        const dr = Math.floor((renewalDue - todayMs) / DAY);
        if (dr >= -30 && dr <= 60) all.push({ id, type: 'insurance-renewal', customerName: nm, phone: ph, vehicleModel: vh, regNo, title: dr <= 0 ? '🛡️ Insurance Expired!' : '🛡️ Insurance Renewal Due', daysRemaining: dr });
      }
    }

    // Service
    if (!typeFilter || typeFilter === 'service') {
      if (data.purchaseDate && !data.firstServiceDate) {
        const pd = new Date(data.purchaseDate); pd.setHours(0, 0, 0, 0);
        const due = new Date(pd.getTime() + 30 * DAY);
        const dr  = Math.floor((due - todayMs) / DAY);
        if (dr >= -30) all.push({ id, type: 'service', customerName: nm, phone: ph, vehicleModel: vh, regNo, title: '🔧 1st Service Due', daysRemaining: dr });
      }
      for (const svc of SERVICE_MAP) {
        const doneDate = data[svc.done];
        const nextKey  = (SERVICE_KEY_MAP[svc.next] || '') + 'Date';
        if (doneDate && !data[nextKey]) {
          const prev = new Date(doneDate); prev.setHours(0, 0, 0, 0);
          const due  = new Date(prev.getTime() + svc.days * DAY);
          const dr   = Math.floor((due - todayMs) / DAY);
          if (dr >= -30) all.push({ id, type: 'service', customerName: nm, phone: ph, vehicleModel: vh, regNo, title: `🔧 ${svc.label} Due`, daysRemaining: dr });
          break;
        }
      }
    }
  }
  return all;
}

function shouldNotify(r, typeFilter) {
  const d = r.daysRemaining, t = r.type;
  if (typeFilter && t !== typeFilter && !(typeFilter === 'insurance' && t === 'insurance-renewal')) return false;
  if (t === 'payment')           return d < 0 || d <= 3;
  if (t === 'service')           return d >= -30 && d <= 5;
  if (t === 'insurance')         return d >= 0 && d <= 7;
  if (t === 'insurance-renewal') return d >= -30 && d <= 30;
  return d >= -30 && d <= 5;
}

// ── Expired / हटाए गए subscriptions साफ़ करें ───────────────────────────────
async function cleanupDead(db, endpoints) {
  if (!endpoints?.length) return;
  for (const col of SUB_COLLECTIONS) {
    try { await db.collection(col).deleteMany({ endpoint: { $in: endpoints } }); } catch {}
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // 🔒 अगर CRON_SECRET env set है तो सिर्फ Vercel Cron / सही token वाले को allow करें
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth   = req.headers?.authorization || '';
    const ua     = req.headers?.['user-agent'] || '';
    const okAuth = auth === `Bearer ${secret}` || req.query?.key === secret;
    const okCron = ua.includes('vercel-cron');
    if (!okAuth && !okCron) return res.status(401).json({ error: 'Unauthorized' });
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) return res.status(500).json({ error: 'MONGODB_URI not set' });

  const typeFilter = (req.query?.type || '').toLowerCase() || null;
  const isDebug    = !!req.query?.debug;
  const isForce    = !!req.query?.force;

  let MongoClient, webpush;
  try { ({ MongoClient } = await import('mongodb')); }
  catch (e) { return res.status(500).json({ error: 'mongodb not installed', detail: e.message }); }
  try { webpush = (await import('web-push')).default; }
  catch (e) { return res.status(500).json({ error: 'web-push not installed', detail: e.message }); }

  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    const db = await getDb(MongoClient, uri);

    // ✅ subscriptions सिर्फ एक बार पढ़ें (पहले हर notification पर पढ़े जाते थे)
    const { name: subCol, data: rawSubs } = await getCol(db, SUB_COLLECTIONS);
    const subs = normaliseSubs(rawSubs);

    const { data: serviceData } = await getCol(db, DATA_COLLECTIONS);
    const reminders = buildReminders(serviceData, typeFilter);
    const urgent    = reminders.filter(r => shouldNotify(r, typeFilter));

    // ── Debug mode: कुछ भेजता नहीं, सिर्फ हालत बताता है ─────────────────────
    if (isDebug) {
      const collNames = (await db.listCollections().toArray()).map(c => c.name);
      return res.status(200).json({
        ok: true, mode: 'debug', typeFilter: typeFilter || 'all',
        collections: collNames,
        subscriptionCollection: subCol,
        subscriptionsRaw: rawSubs.length,
        subscriptionsValid: subs.length,
        serviceDataCount: serviceData.length,
        totalReminders: reminders.length,
        urgentReminders: urgent.length,
        breakdown: {
          payment:          reminders.filter(r => r.type === 'payment').length,
          service:          reminders.filter(r => r.type === 'service').length,
          insurance:        reminders.filter(r => r.type === 'insurance').length,
          insuranceRenewal: reminders.filter(r => r.type === 'insurance-renewal').length,
        },
        sampleUrgent: urgent.slice(0, 3),
      });
    }

    if (!subs.length) {
      // ⚠️ यह error नहीं है — बस किसी phone ने notification allow नहीं किया है.
      return res.status(200).json({
        ok: true, mode: 'no-subscribers', typeFilter: typeFilter || 'all',
        hint: 'किसी phone पर app खोलकर notification permission दें',
      });
    }

    // ── आज इसी type के लिए क्या पहले ही भेजा जा चुका है? ────────────────────
    const todayStr = new Date().toISOString().slice(0, 10);
    const logKey   = `${todayStr}-${typeFilter || 'all'}`;
    let alreadySentToday = [];
    if (!isForce) {
      try {
        const logEntry = await db.collection('notificationlogs').findOne({ logKey });
        alreadySentToday = logEntry?.sentIds || [];
      } catch {}
    }
    const newUrgent = urgent.filter(r => !alreadySentToday.includes(`${r.type}-${r.id}`));

    // ── कुछ भी नया नहीं ─────────────────────────────────────────────────────
    if (newUrgent.length === 0) {
      // 🐞 FIX: पहले यहाँ "आज कोई urgent reminder नहीं" भेज दिया जाता था — भले ही
      // असल में reminders थे और बस पहले round में भेजे जा चुके थे. अब all-clear
      // सिर्फ तभी जाती है जब सच में 0 urgent reminders हों.
      if (urgent.length > 0) {
        return res.status(200).json({
          ok: true, mode: 'already-sent-today', typeFilter: typeFilter || 'all',
          urgent: urgent.length, sent: 0,
        });
      }
      let lastLog = null;
      try { lastLog = await db.collection('notificationlogs').findOne({ logKey }); } catch {}
      if (lastLog?.allClearSent) {
        return res.status(200).json({ ok: true, mode: 'skip-repeat-all-clear', typeFilter });
      }
      const r = await sendOne(webpush, subs, {
        title: '✅ VP Honda',
        body:  `${typeFilter || 'सब'} — आज कोई urgent reminder नहीं`,
        url:   '/reminders',
        tag:   `vph-allclear-${typeFilter || 'all'}`,
      });
      await cleanupDead(db, r.dead);
      try {
        await db.collection('notificationlogs').updateOne(
          { logKey },
          { $set: { logKey, allClearSent: true, sentAt: new Date() } },
          { upsert: true }
        );
      } catch {}
      return res.status(200).json({ ok: true, mode: 'all-clear', typeFilter, sent: r.sent, serviceDataCount: serviceData.length });
    }

    // ── Priority sort ───────────────────────────────────────────────────────
    const typePri = { payment: 3, 'insurance-renewal': 2, insurance: 2, service: 1 };
    newUrgent.sort((a, b) => {
      const aO = a.daysRemaining < 0, bO = b.daysRemaining < 0;
      if (aO !== bO) return aO ? -1 : 1;
      const aD = Math.abs(a.daysRemaining), bD = Math.abs(b.daysRemaining);
      if (aD !== bD) return bD - aD;
      return (typePri[b.type] || 0) - (typePri[a.type] || 0);
    });

    const top           = newUrgent.slice(0, 5);
    const overdueCount  = newUrgent.filter(r => r.daysRemaining < 0).length;
    const upcomingCount = newUrgent.length - overdueCount;

    const typeLabel = typeFilter === 'payment'   ? '💳 Payment'
                    : typeFilter === 'insurance' ? '🛡️ Insurance'
                    : typeFilter === 'service'   ? '🔧 Service'
                    : '📋 All';

    // ── 1 summary + top 5 — सब एक साथ (parallel), कोई blocking wait नहीं ────
    const jobs = [
      sendOne(webpush, subs, {
        title: `🔔 VP Honda — ${typeLabel} Reminders`,
        body:  `🚨 ${overdueCount} overdue · ⏰ ${upcomingCount} upcoming (${newUrgent.length} total)`,
        url:   '/reminders',
        tag:   `vph-summary-${typeFilter || 'all'}`,
      }),
    ];

    for (const r of top) {
      const days       = Math.abs(r.daysRemaining);
      const overdue    = r.daysRemaining < 0;
      const icon       = overdue ? '🚨' : '⏰';
      const regTxt     = r.regNo ? ` (${r.regNo})` : '';
      const phoneClean = (r.phone || '').replace(/[^0-9]/g, '').slice(-10);
      jobs.push(sendOne(webpush, subs, {
        title: `${icon} ${r.customerName} — ${r.title}`,
        body:  `${r.vehicleModel}${regTxt} — ${days}d ${overdue ? 'overdue' : 'remaining'}\n📞 ${r.phone}`,
        url:   `/reminders?focus=${encodeURIComponent(r.customerName)}&phone=${phoneClean}&type=${r.type}`,
        tag:   `vph-${r.type}-${r.id}`,   // unique tag → Android में अलग-अलग stack
      }));
    }

    const results   = await Promise.all(jobs);
    const pushCount = results.reduce((a, r) => a + r.sent, 0);
    const deadAll   = [...new Set(results.flatMap(r => r.dead))];
    await cleanupDead(db, deadAll);

    // ── भेजे गए IDs log करें → अगली cron में repeat नहीं होंगे ──────────────
    const newSentIds = top.map(r => `${r.type}-${r.id}`);
    try {
      await db.collection('notificationlogs').updateOne(
        { logKey },
        { $addToSet: { sentIds: { $each: newSentIds } }, $set: { updatedAt: new Date() } },
        { upsert: true }
      );
    } catch {}

    res.status(200).json({
      ok: true,
      typeFilter: typeFilter || 'all',
      devices: subs.length,
      notifications: jobs.length,
      pushesDelivered: pushCount,
      staleRemoved: deadAll.length,
      urgent: newUrgent.length,
      newSent: top.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: (err.stack || '').split('\n').slice(0, 3) });
  }
}
