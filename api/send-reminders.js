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

// ════════════════════════════════════════════════════════════════════════════
// ⚙️ NOTIFICATION की सीढ़ी — बदलना हो तो सिर्फ़ यही array बदलें
// (frontend के src/utils/reminderEngine.js में भी यही array है — दोनों एक रखें)
// due से 7 दिन पहले → 3 दिन पहले → 1 दिन पहले → due के दिन → overdue
// हर पड़ाव पर सिर्फ़ **एक** notification. दोबारा नहीं.
// ════════════════════════════════════════════════════════════════════════════
const NOTIFY_LADDER = [7, 3, 1, 0, -1];
const ladderRung = (dr) => {
  if (dr === null || dr === undefined) return null;
  if (dr < 0) return -1;
  return NOTIFY_LADDER.includes(dr) ? dr : null;
};
const RUNG_LABEL = {
  7: '7 दिन बाक़ी', 3: '3 दिन बाक़ी', 1: 'कल due है', 0: 'आज due है', '-1': 'due निकल चुका',
};

const SUB_COLLECTIONS  = ['pushsubscriptions', 'pushsubs', 'subscriptions'];
const DATA_COLLECTIONS = ['servicedatas', 'servicedata', 'serviceData', 'service_data'];


// ── गाड़ी की पहचान (frontend के src/utils/vehicleIdentity.js जैसा ही नियम) ──
// `servicedatas` में एक ही गाड़ी के कई record हैं — असली reg no, "imported-…",
// MongoDB ObjectId, और वही key बड़े-छोटे अक्षरों में. इसीलिए एक ही ग्राहक की
// एक ही सर्विस के 3 notification चले जाते थे. यहाँ भेजने से पहले जोड़ देते हैं.
const normKey     = k => String(k || '').trim().toUpperCase();
const REG_RE      = /^[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{0,3}[\s-]?\d{1,4}$/;
const OBJECTID_RE = /^[0-9A-F]{24}$/;
const isRealRegNo = (k) => {
  const s = normKey(k);
  if (!s || s === '—' || s === '-' || s === 'N/A' || s === 'NA') return false;
  if (s.startsWith('IMPORTED-') || s.startsWith('NO_REG_') || s.startsWith('TEMP-') || s.startsWith('AUTO-')) return false;
  if (OBJECTID_RE.test(s) || /^\d+$/.test(s)) return false;
  return REG_RE.test(s);
};
const phoneKey = p => String(p || '').replace(/\D/g, '').slice(-10);
const nameKey  = n => String(n || '').replace(/^\d+\s*/, '').toLowerCase().replace(/[^a-z\u0900-\u097F]/g, '');

/** एक ही गाड़ी की एक ही चीज़ के कई reminder → एक */
function dedupeReminders(list) {
  const seen = new Map();
  for (const r of list) {
    const who = phoneKey(r.phone) || nameKey(r.customerName);
    const fp  = `${who}|${r.type}|${r.serviceLabel || ''}|${r.daysRemaining}`;
    const prev = seen.get(fp);
    if (!prev) { seen.set(fp, r); continue; }
    // असली reg no वाला जीते
    if (isRealRegNo(r.regNo) && !isRealRegNo(prev.regNo)) seen.set(fp, r);
  }
  return [...seen.values()];
}

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

    // ⭐ RemindersPage में "पूरा हुआ" / "बाद में" / "गलत है" दबाने पर यही state
    // MongoDB में सेव होती है. यहाँ उसे respect करना ही वह fix है जिससे बंद किया
    // हुआ reminder दोबारा notification नहीं भेजता.
    const state = data.reminderState || {};
    const isParked = (rid) => {
      const st = state[rid];
      if (!st) return false;
      if (st.closedAt) return true;
      if (st.snoozeUntil && new Date(st.snoozeUntil).getTime() > todayMs) return true;
      return false;
    };

    // Payment
    if (!typeFilter || typeFilter === 'payment') {
      const pend = parseFloat(data.pendingAmount || 0);
      const payRid = `pay-${regNo}`;
      // ⚠️ बिना paymentDueDate वाला payment अब notify नहीं होता — पहले dr=999
      // डालकर हमेशा भेज दिया जाता था, यही बहुत सारे "नक़ली" reminder बनाता था.
      if (pend > 0 && !data.paymentReceivedDate && data.paymentDueDate && !isParked(payRid)) {
        const dd = new Date(data.paymentDueDate); dd.setHours(0, 0, 0, 0);
        const dr = Math.floor((dd - todayMs) / DAY);
        all.push({ id, rid: payRid, type: 'payment', customerName: nm, phone: ph, vehicleModel: vh, regNo, title: '💳 Payment Due', daysRemaining: dr, amount: pend });
      }
    }

    // RTO + Insurance renewal
    if (!typeFilter || typeFilter === 'insurance') {
      const rtoRid = `ins-${regNo}`;
      if (data.insuranceDate && !data.rtoDoneDate && !isParked(rtoRid)) {
        const ins = new Date(data.insuranceDate); ins.setHours(0, 0, 0, 0);
        const rto = new Date(ins.getTime() + 7 * DAY);
        const dr  = Math.floor((rto - todayMs) / DAY);
        if (dr >= 0 && dr <= 7) all.push({ id, rid: rtoRid, type: 'insurance', customerName: nm, phone: ph, vehicleModel: vh, regNo, title: '🚗 RTO Pending', daysRemaining: dr });
      }
      // ⚠️ सबसे बड़ा नक़ली-reminder वाला हिस्सा: पहले insurance की कोई entry न होने
      // पर भी `purchaseDate + 3 दिन` का अंदाज़ा लगाकर हर ग्राहक को "Insurance
      // Renewal Due" भेज दिया जाता था. अब सिर्फ़ असली insurance date पर notify
      // होता है — अनुमानित वाले सिर्फ़ Reminders page पर दिखते हैं जहाँ तारीख़
      // confirm की जा सकती है.
      const insrRid = `insr-${regNo}`;
      const realInsStart = data.insuranceStartDate || data.insuranceDate;
      if (realInsStart && !data.insuranceRenewed && !isParked(insrRid)) {
        const insStart = new Date(realInsStart); insStart.setHours(0, 0, 0, 0);
        const renewalDue = new Date(insStart.getTime() + 335 * DAY);
        const dr = Math.floor((renewalDue - todayMs) / DAY);
        if (dr >= -30 && dr <= 60) all.push({ id, rid: insrRid, type: 'insurance-renewal', customerName: nm, phone: ph, vehicleModel: vh, regNo, title: dr <= 0 ? '🛡️ Insurance Expired!' : '🛡️ Insurance Renewal Due', daysRemaining: dr });
      }
    }

    // Service
    if (!typeFilter || typeFilter === 'service') {
      // ⚠️ पहले `if (1st due)` और नीचे का loop दोनों चल सकते थे — एक ही ग्राहक के
      // लिए दो service reminder. अब else-if है, यानी एक ग्राहक = एक service.
      if (data.purchaseDate && !data.firstServiceDate) {
        const svcRid = `svc-1st-${regNo}`;
        if (!isParked(svcRid)) {
          const pd = new Date(data.purchaseDate); pd.setHours(0, 0, 0, 0);
          const due = new Date(pd.getTime() + 30 * DAY);
          const dr  = Math.floor((due - todayMs) / DAY);
          if (dr >= -30) all.push({ id, rid: svcRid, type: 'service', customerName: nm, phone: ph, vehicleModel: vh, regNo, title: '🔧 1st Service Due', serviceLabel: '1st', daysRemaining: dr });
        }
      } else {
        for (const svc of SERVICE_MAP) {
          const doneDate = data[svc.done];
          const nextKey  = (SERVICE_KEY_MAP[svc.next] || '') + 'Date';
          if (doneDate && !data[nextKey]) {
            const svcRid = `svc-${svc.next}-${regNo}`;
            if (!isParked(svcRid)) {
              const prev = new Date(doneDate); prev.setHours(0, 0, 0, 0);
              const due  = new Date(prev.getTime() + svc.days * DAY);
              const dr   = Math.floor((due - todayMs) / DAY);
              if (dr >= -30) all.push({ id, rid: svcRid, type: 'service', customerName: nm, phone: ph, vehicleModel: vh, regNo, title: `🔧 ${svc.label} Due`, serviceLabel: svc.next, daysRemaining: dr });
            }
            break;
          }
        }
      }
    }
  }
  // ⭐ भेजने से पहले डुप्लिकेट हटाओ
  return dedupeReminders(all);
}

function shouldNotify(r, typeFilter) {
  if (typeFilter && r.type !== typeFilter &&
      !(typeFilter === 'insurance' && r.type === 'insurance-renewal')) return false;
  // ⚙️ अब "कितने दिन के अंदर" नहीं — सीढ़ी के पड़ाव पर ही notification
  return ladderRung(r.daysRemaining) !== null;
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
        junkRegNoRecords: serviceData.filter(d => !isRealRegNo(d.regNo)).length,
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
    const logKey   = `${todayStr}-${typeFilter || 'all'}`;   // रोज़ नया log
    let alreadySentToday = [];
    if (!isForce) {
      try {
        const logEntry = await db.collection('notificationlogs').findOne({ logKey });
        alreadySentToday = logEntry?.sentIds || [];
      } catch {}
    }
    // ⭐ अब key में पड़ाव भी है: "svc-2nd-MP04XX1234@3" — यानी "3 दिन बाक़ी"
    //    वाली notification एक ही बार जाएगी, पर "1 दिन बाक़ी" वाली अलग से जाएगी.
    const newUrgent = urgent.filter(r => !alreadySentToday.includes(`${r.rid}@${ladderRung(r.daysRemaining)}`));

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

    // ⭐ एक ग्राहक = एक notification.
    // पहले सीधे top-5 reminders लिए जाते थे, इसलिए जिस ग्राहक के 3 reminder होते
    // थे उसी के नाम से 3 notification चली जाती थीं. अब हर ग्राहक का सिर्फ़ सबसे
    // ज़रूरी reminder लिया जाता है, और बाक़ी की गिनती उसी notification में जुड़
    // जाती है ("+2 और").
    const byCustomer = new Map();
    for (const r of newUrgent) {
      const key = (r.phone || '').replace(/\D/g, '').slice(-10) || `${r.customerName}|${r.regNo}`;
      if (!byCustomer.has(key)) byCustomer.set(key, { head: r, extra: 0 });
      else byCustomer.get(key).extra++;
    }
    const top           = [...byCustomer.values()].slice(0, 5);
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

    for (const { head: r, extra } of top) {
      const days       = Math.abs(r.daysRemaining);
      const overdue    = r.daysRemaining < 0;
      const icon       = overdue ? '🚨' : '⏰';
      const regTxt     = r.regNo ? ` (${r.regNo})` : '';
      const phoneClean = (r.phone || '').replace(/[^0-9]/g, '').slice(-10);
      const extraTxt   = extra > 0 ? `\n➕ इनके ${extra} और reminder बाक़ी हैं` : '';
      const rung       = ladderRung(r.daysRemaining);
      const whenTxt    = overdue ? `${days} दिन ऊपर हो गए` : (RUNG_LABEL[String(rung)] || `${days} दिन बाक़ी`);
      jobs.push(sendOne(webpush, subs, {
        title: `${icon} ${r.customerName} — ${r.title}`,
        body:  `${whenTxt}\n🏍 ${r.vehicleModel}${regTxt}${phoneClean ? ` · 📞 ${phoneClean}` : ''}${extraTxt}`,
        // ⭐ rid = reminder की पक्की id. इसी से click करने पर Reminders page
        // ठीक वही reminder खोलता है (पहले सिर्फ़ नाम जाता था और 3 reminder वाले
        // ग्राहक में पता ही नहीं चलता था कौन सा).
        url:   `/reminders?rid=${encodeURIComponent(r.rid)}&focus=${encodeURIComponent(r.customerName)}&phone=${phoneClean}&type=${r.type}`,
        tag:   `vph-${r.rid}`,   // unique tag → Android में अलग-अलग stack
      }));
    }

    const results   = await Promise.all(jobs);
    const pushCount = results.reduce((a, r) => a + r.sent, 0);
    const deadAll   = [...new Set(results.flatMap(r => r.dead))];
    await cleanupDead(db, deadAll);

    // ── भेजे गए IDs log करें → अगली cron में repeat नहीं होंगे ──────────────
    const newSentIds = top.map(({ head }) => `${head.rid}@${ladderRung(head.daysRemaining)}`);
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
      distinctCustomers: byCustomer.size,
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: (err.stack || '').split('\n').slice(0, 3) });
  }
}
