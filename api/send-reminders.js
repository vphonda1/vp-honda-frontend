// api/send-reminders.js — Vercel Serverless Function
// service-data collection से reminders compute करता है (RemindersPage जैसा exact logic)
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

// Smart filter — सिर्फ urgent
function shouldNotify(r) {
  const d = r.daysRemaining, t = r.type;
  if (t === 'payment')           return d < 0 || d <= 3;           // overdue या 3 din me
  if (t === 'service')           return d >= -30 && d <= 5;
  if (t === 'insurance')         return d >= 0 && d <= 7;          // RTO window
  if (t === 'insurance-renewal') return d >= -30 && d <= 30;
  return d >= -30 && d <= 5;
}

async function getCollection(db, names) {
  for (const name of names) {
    try { const c = await db.collection(name).find({}).toArray(); if (c.length) return { name, data: c }; } catch {}
  }
  return { name: null, data: [] };
}

async function sendToAll(webpush, db, title, body, url) {
  const { data: subs } = await getCollection(db, ['pushsubscriptions', 'pushsubs', 'subscriptions']);
  if (!subs.length) return 0;
  const payload = JSON.stringify({ title, body, url: url || '/reminders', icon: '/icons/icon-192x192.png', badge: '/icons/icon-96x96.png' });
  let sent = 0;
  for (const raw of subs) {
    const sub = raw.subscription || raw;
    const endpoint = sub.endpoint;
    const keys = sub.keys || { p256dh: sub.p256dh, auth: sub.auth };
    if (!endpoint || typeof endpoint !== 'string' || !keys || !keys.p256dh || !keys.auth) continue;
    try { await webpush.sendNotification({ endpoint, keys }, payload); sent++; }
    catch (err) { if (err.statusCode === 410 || err.statusCode === 404) { try { await db.collection('pushsubscriptions').deleteOne({ endpoint }); } catch {} } }
  }
  return sent;
}

// RemindersPage जैसा exact reminder builder
function buildReminders(serviceData) {
  const all = [];
  const today = new Date(); today.setHours(0,0,0,0);
  const DAY = 864e5;

  for (const data of serviceData) {
    const regNo = data.regNo || data.registrationNo;
    if (!regNo || regNo === 'no_reg_') continue;
    const nm = data.customerName || 'Unknown';
    const ph = data.phone || '';
    const vh = data.vehicle || data.vehicleModel || '';

    // 1. Payment
    const pend = parseFloat(data.pendingAmount || 0);
    if (pend > 0 && !data.paymentReceivedDate) {
      let dr = 999, dd = new Date();
      if (data.paymentDueDate) { dd = new Date(data.paymentDueDate); dd.setHours(0,0,0,0); dr = Math.floor((dd - today) / DAY); }
      all.push({ type:'payment', customerName:nm, phone:ph, vehicleModel:vh, regNo, title:'💳 Payment Due', daysRemaining:dr, amount:pend });
    }

    // 2. RTO (insurance)
    if (data.insuranceDate && !data.rtoDoneDate) {
      const ins = new Date(data.insuranceDate); ins.setHours(0,0,0,0);
      const rto = new Date(ins.getTime() + 7*DAY); const dr = Math.floor((rto - today)/DAY);
      if (dr >= 0 && dr <= 7) all.push({ type:'insurance', customerName:nm, phone:ph, vehicleModel:vh, regNo, title:'🚗 RTO Pending', daysRemaining:dr });
    }

    // 3. Insurance Renewal (335 days after start)
    const insStartRaw = data.insuranceStartDate || data.insuranceDate || (data.purchaseDate ? new Date(new Date(data.purchaseDate).getTime() + 3*DAY).toISOString().split('T')[0] : null);
    if (insStartRaw && !data.insuranceRenewed) {
      const insStart = new Date(insStartRaw); insStart.setHours(0,0,0,0);
      const renewalDue = new Date(insStart.getTime() + 335*DAY);
      const dr = Math.floor((renewalDue - today)/DAY);
      if (dr >= -30 && dr <= 60) all.push({ type:'insurance-renewal', customerName:nm, phone:ph, vehicleModel:vh, regNo, title: dr<=0?'🛡️ Insurance Expired!':'🛡️ Insurance Renewal Due', daysRemaining:dr });
    }

    // 4. 1st Service
    if (data.purchaseDate && !data.firstServiceDate) {
      const pd = new Date(data.purchaseDate); pd.setHours(0,0,0,0);
      const due = new Date(pd.getTime() + 30*DAY); const dr = Math.floor((due - today)/DAY);
      if (dr >= -30) all.push({ type:'service', customerName:nm, phone:ph, vehicleModel:vh, regNo, title:'🔧 1st Service Due', daysRemaining:dr });
    }

    // 5. Next services
    for (const svc of SERVICE_MAP) {
      const doneDate = data[svc.done];
      const nextKey = (SERVICE_KEY_MAP[svc.next] || '') + 'Date';
      if (doneDate && !data[nextKey]) {
        const prev = new Date(doneDate); prev.setHours(0,0,0,0);
        const due = new Date(prev.getTime() + svc.days*DAY); const dr = Math.floor((due - today)/DAY);
        if (dr >= -30) all.push({ type:'service', customerName:nm, phone:ph, vehicleModel:vh, regNo, title:`🔧 ${svc.label} Due`, daysRemaining:dr });
        break;
      }
    }
  }
  return all;
}

export default async function handler(req, res) {
  const uri = process.env.MONGODB_URI;
  if (!uri) return res.status(500).json({ error: 'MONGODB_URI env variable not set' });

  let MongoClient, webpush;
  try { ({ MongoClient } = await import('mongodb')); } catch (e) { return res.status(500).json({ error: 'mongodb not installed', detail: e.message }); }
  try { webpush = (await import('web-push')).default; } catch (e) { return res.status(500).json({ error: 'web-push not installed', detail: e.message }); }

  try {
    try { webpush.setVapidDetails('mailto:admin@vphonda.com', VAPID_PUBLIC, VAPID_PRIVATE); }
    catch (e) { return res.status(500).json({ error: 'VAPID setup failed', detail: e.message }); }

    const db = await getDb(MongoClient, uri);
    const collNames = (await db.listCollections().toArray()).map(c => c.name);

    // ✅ service-data collection से पढ़ें (RemindersPage का असली source)
    const { name: sdColl, data: serviceData } = await getCollection(db, ['servicedatas', 'servicedata', 'serviceData', 'service_data', 'customerservicedata']);

    const isDebug = (req.query && req.query.debug) || (req.url && req.url.includes('debug'));
    if (isDebug) {
      const { name: subColl, data: subs } = await getCollection(db, ['pushsubscriptions', 'pushsubs', 'subscriptions']);
      const reminders = buildReminders(serviceData);
      const urgent = reminders.filter(shouldNotify);
      return res.status(200).json({
        ok: true, mode: 'debug',
        collections: collNames,
        serviceDataCollection: sdColl,
        serviceDataCount: serviceData.length,
        sampleServiceDataKeys: serviceData[0] ? Object.keys(serviceData[0]) : null,
        subscriptionCollection: subColl,
        subscriptionCount: subs.length,
        totalReminders: reminders.length,
        urgentReminders: urgent.length,
        breakdown: {
          payment: reminders.filter(r=>r.type==='payment').length,
          service: reminders.filter(r=>r.type==='service').length,
          insurance: reminders.filter(r=>r.type==='insurance').length,
          insuranceRenewal: reminders.filter(r=>r.type==='insurance-renewal').length,
        },
        sampleUrgent: urgent.slice(0, 3),
      });
    }

    const reminders = buildReminders(serviceData);
    const urgent = reminders.filter(shouldNotify);

    if (urgent.length === 0) {
      const sent = await sendToAll(webpush, db, '✅ VP Honda', 'आज कोई urgent reminder नहीं — सब clear!', '/reminders');
      return res.status(200).json({ ok: true, sent, mode: 'all-clear', serviceDataCount: serviceData.length, totalReminders: reminders.length });
    }

    // Priority sort
    const typePri = { payment: 3, service: 2, 'insurance-renewal': 1, insurance: 2 };
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

    res.status(200).json({ ok: true, sent: pushCount, serviceDataCount: serviceData.length, urgent: urgent.length, top5: top.length, breakdown: { overdue: overdueCount, upcoming: upcomingCount } });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: (err.stack || '').split('\n').slice(0, 3) });
  }
}
