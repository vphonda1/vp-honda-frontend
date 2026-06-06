// api/send-reminders.js — Vercel Serverless Function (defensive)
// रोज Vercel Cron से चलेगा — Render पर depend नहीं, कभी sleep नहीं

const VAPID_PUBLIC  = 'BKwecIw_aOdebFYVONRm-ZF3au68bNWU1uHPSXkwr1LvV7dIS-b-v614SMT6UgjHbcqigskmSAhFBWHxV9a__TM';
const VAPID_PRIVATE = 'BphjFle5WwJGYAMWYMIF2bFT1BypFyCmT35JFXsGYYI';

let cachedClient = null;

async function getDb(MongoClient, uri) {
  if (cachedClient) {
    try { await cachedClient.db().admin().ping(); return cachedClient.db(); } catch { cachedClient = null; }
  }
  cachedClient = new MongoClient(uri);
  await cachedClient.connect();
  return cachedClient.db();
}

function shouldNotify(r) {
  const d = r.daysRemaining, t = r.type;
  if (t === 'payment')   return d < 0;
  if (t === 'service')   return d >= -7 && d <= 5;
  if (t === 'insurance') return d >= -60 && d <= 30;
  if (t === 'rto')       return d >= -30 && d <= 7;
  return d >= -7 && d <= 3;
}

async function sendToAll(webpush, db, title, body, url) {
  let subs = [];
  for (const name of ['pushsubscriptions', 'pushsubs', 'subscriptions']) {
    try { const c = await db.collection(name).find({}).toArray(); if (c.length) { subs = c; break; } } catch {}
  }
  if (!subs.length) return 0;
  const payload = JSON.stringify({ title, body, url: url || '/reminders', icon: '/icons/icon-192x192.png', badge: '/icons/icon-96x96.png' });
  let sent = 0;
  for (const raw of subs) {
    // ✅ Handle multiple storage structures: flat OR nested under .subscription
    const sub = raw.subscription || raw;
    const endpoint = sub.endpoint;
    const keys = sub.keys || { p256dh: sub.p256dh, auth: sub.auth };
    // Skip invalid subscriptions (avoid startsWith crash)
    if (!endpoint || typeof endpoint !== 'string' || !keys || !keys.p256dh || !keys.auth) continue;
    try {
      await webpush.sendNotification({ endpoint, keys }, payload);
      sent++;
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        try { await db.collection('pushsubscriptions').deleteOne({ endpoint }); } catch {}
      }
    }
  }
  return sent;
}

export default async function handler(req, res) {
  // ── Diagnostics: missing setup पर clear error (crash नहीं) ──
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return res.status(500).json({
      error: 'MONGODB_URI env variable not set',
      fix: 'Vercel → Settings → Environment Variables → add MONGODB_URI',
    });
  }

  let MongoClient, webpush;
  try { ({ MongoClient } = await import('mongodb')); }
  catch (e) { return res.status(500).json({ error: 'mongodb package not installed', fix: 'npm install mongodb', detail: e.message }); }
  try { webpush = (await import('web-push')).default; }
  catch (e) { return res.status(500).json({ error: 'web-push package not installed', fix: 'npm install web-push', detail: e.message }); }

  try {
    try { webpush.setVapidDetails('mailto:admin@vphonda.com', VAPID_PUBLIC, VAPID_PRIVATE); }
    catch (e) { return res.status(500).json({ error: 'VAPID setup failed', detail: e.message }); }
    const db = await getDb(MongoClient, uri);

    // List collections (diagnostic — helps verify names)
    const collNames = (await db.listCollections().toArray()).map(c => c.name);

    // Load customers
    let customers = [];
    for (const name of ['customers', 'customer']) {
      try { const c = await db.collection(name).find({}).toArray(); if (c.length) { customers = c; break; } } catch {}
    }

    // ?debug=1 → सिर्फ diagnostics, push नहीं भेजे
    const isDebug = (req.query && req.query.debug) || (req.url && req.url.includes('debug'));
    if (isDebug) {
      let subSample = null, subCount = 0, subCollName = null;
      for (const name of ['pushsubscriptions', 'pushsubs', 'subscriptions']) {
        try {
          const n = await db.collection(name).countDocuments();
          if (n) { subCount = n; subCollName = name; subSample = await db.collection(name).findOne({}); break; }
        } catch {}
      }
      return res.status(200).json({
        ok: true, mode: 'debug',
        collections: collNames,
        customers: customers.length,
        subscriptionCount: subCount,
        subscriptionCollection: subCollName,
        sampleSubscriptionKeys: subSample ? Object.keys(subSample) : null,
        sampleCustomerKeys: customers[0] ? Object.keys(customers[0]) : null,
      });
    }

    // Compute reminders
    const today = new Date(); today.setHours(0,0,0,0);
    const todayMs = today.getTime(), dayMs = 86400000;
    const reminders = [];

    for (const c of customers) {
      const name    = c.name || c.customerName || 'Customer';
      const phone   = c.phone || c.mobile || (c.linkedVehicle && c.linkedVehicle.phone) || '';
      const v       = c.linkedVehicle || c;
      const vehicle = v.vehicleModel || v.model || c.vehicleModel || '';
      const regNo   = v.regNo || v.registrationNo || c.regNo || '';

      const due = +(c.paymentDue || c.balanceAmount || c.balance || 0);
      if (due > 0) reminders.push({ customerName: name, phone, vehicleModel: vehicle, regNo, type: 'payment', title: '💳 Payment Due', daysRemaining: -30 });

      const insRaw = c.insuranceDate || v.insuranceDate;
      if (insRaw) {
        const ins = new Date(insRaw); ins.setHours(0,0,0,0);
        const days = Math.floor((ins.getTime() - todayMs) / dayMs);
        if (days >= -60 && days <= 30) reminders.push({ customerName: name, phone, vehicleModel: vehicle, regNo, type: 'insurance', title: days < 0 ? '🛡️ Insurance Expired' : '🛡️ Insurance Expiring', daysRemaining: days });
      }

      const purRaw = v.purchaseDate || c.purchaseDate;
      if (purRaw) {
        const pur = new Date(purRaw); pur.setHours(0,0,0,0);
        const svc = c.serviceData || c.services || {};
        const checks = [
          { key: 'service1DoneDate', label: '1st Service Due', d: 30 },
          { key: 'service2DoneDate', label: '2nd Service Due', d: 90 },
          { key: 'service3DoneDate', label: '3rd Service Due', d: 180 },
          { key: 'service4DoneDate', label: '4th Service Due', d: 270 },
        ];
        for (const ch of checks) {
          if (svc[ch.key]) continue;
          const days = Math.floor((pur.getTime() + ch.d * dayMs - todayMs) / dayMs);
          if (days >= -7 && days <= 5) { reminders.push({ customerName: name, phone, vehicleModel: vehicle, regNo, type: 'service', title: `🔧 ${ch.label}`, daysRemaining: days }); break; }
        }
      }
    }

    const urgent = reminders.filter(shouldNotify);

    if (urgent.length === 0) {
      const sent = await sendToAll(webpush, db, '✅ VP Honda', 'आज कोई urgent reminder नहीं — सब clear!', '/reminders');
      return res.status(200).json({ ok: true, sent, mode: 'all-clear', customers: customers.length, collections: collNames });
    }

    const typePri = { payment: 3, service: 2, insurance: 1, rto: 2 };
    urgent.sort((a, b) => {
      const aO = a.daysRemaining < 0, bO = b.daysRemaining < 0;
      if (aO !== bO) return aO ? -1 : 1;
      const aD = Math.abs(a.daysRemaining), bD = Math.abs(b.daysRemaining);
      if (aD !== bD) return bD - aD;
      return (typePri[b.type] || 0) - (typePri[a.type] || 0);
    });

    const top = urgent.slice(0, 5);
    const overdueCount = urgent.filter(r => r.daysRemaining < 0).length;
    const upcomingCount = urgent.length - overdueCount;
    let pushCount = 0;

    pushCount += await sendToAll(webpush, db, '🔔 VP Honda Reminders', `🚨 ${overdueCount} overdue · ⏰ ${upcomingCount} upcoming\n📋 ${urgent.length} urgent reminders`, '/reminders');

    for (const r of top) {
      const days = Math.abs(r.daysRemaining);
      const overdue = r.daysRemaining < 0;
      const icon = overdue ? '🚨' : '⏰';
      const regTxt = r.regNo ? ` (${r.regNo})` : '';
      const phoneClean = (r.phone || '').replace(/[^0-9]/g, '').slice(0, 10);
      const url = `/reminders?focus=${encodeURIComponent(r.customerName)}&phone=${phoneClean}&type=${r.type}`;
      pushCount += await sendToAll(webpush, db, `${icon} ${r.customerName} — ${r.title}`, `${r.vehicleModel || ''}${regTxt} — ${days}d ${overdue ? 'overdue' : 'remaining'}\n📞 ${r.phone || ''}`, url);
      await new Promise(rs => setTimeout(rs, 400));
    }

    res.status(200).json({ ok: true, sent: pushCount, customers: customers.length, urgent: urgent.length, top5: top.length, breakdown: { overdue: overdueCount, upcoming: upcomingCount } });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: (err.stack || '').split('\n').slice(0, 3) });
  }
}
