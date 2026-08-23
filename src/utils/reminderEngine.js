// ════════════════════════════════════════════════════════════════════════════
// reminderEngine.js — reminder बनाने का एकमात्र नियम-सेट
// ════════════════════════════════════════════════════════════════════════════
// पहले app में reminder बनाने के **तीन अलग-अलग** engine चल रहे थे और तीनों के
// नियम अलग थे:
//
//   1. RemindersPage.jsx          — 1st/2nd…7th Service, 120 दिन के अंतर पर
//   2. notificationScheduler.js   — Honda "Free Service" (1,6,12,18,24 महीने)
//                                    *और साथ में* 120-दिन वाला schedule भी
//   3. api/send-reminders.js      — अपना तीसरा version
//
// इसीलिए phone पर एक ही ग्राहक की "2nd Service" और "2nd Free Service" दोनों
// की notification आ जाती थी, और page पर दिखने वाली गिनती notification से
// मेल नहीं खाती थी.
//
// अब तीनों यही एक file इस्तेमाल करते हैं. नियम बदलना हो तो सिर्फ़ यहाँ बदलें.
// ════════════════════════════════════════════════════════════════════════════

import { consolidateServiceData, dedupeReminders, normKey } from './vehicleIdentity';

const DAY = 86400000;

// ════════════════════════════════════════════════════════════════════════════
// ⚙️ NOTIFICATION का सीढ़ी-नियम — बदलना हो तो सिर्फ़ यही array बदलें
// ════════════════════════════════════════════════════════════════════════════
// हर reminder पर इन पड़ावों पर एक-एक notification जाती है:
//   due से 7 दिन पहले → 3 दिन पहले → 1 दिन पहले → due के दिन → overdue
// हर पड़ाव की notification सिर्फ़ **एक बार** जाती है (दोबारा नहीं).
//
// जोड़ना/हटाना हो तो बस संख्या बदल दें, जैसे [15, 7, 3, 1, 0, -1, -7]
// (धनात्मक = कितने दिन पहले, 0 = due के दिन, ऋणात्मक = कितने दिन बाद)
export const NOTIFY_LADDER = [7, 3, 1, 0, -1];

/** यह reminder अभी सीढ़ी के किस पड़ाव पर है? नहीं है तो null */
export function ladderRung(daysRemaining) {
  if (daysRemaining === null || daysRemaining === undefined) return null;
  if (daysRemaining < 0) return -1;                       // overdue — रोज़ एक बार
  const exact = NOTIFY_LADDER.find(d => d === daysRemaining);
  return exact !== undefined ? exact : null;
}

// ── Priority ────────────────────────────────────────────────────────────────
export const PRIORITY = {
  critical: { label:'🔴 अति ज़रूरी', rank:0, color:'#ef4444' },
  high:     { label:'🟠 ज़रूरी',     rank:1, color:'#f97316' },
  normal:   { label:'🟡 सामान्य',    rank:2, color:'#eab308' },
  low:      { label:'⚪ कम',         rank:3, color:'#64748b' },
};

/** due-date + तरह के हिसाब से अपने आप priority तय करो */
export function autoPriority(type, daysRemaining, amount = 0) {
  if (daysRemaining === null) return 'low';
  if (daysRemaining < -7) return 'critical';
  if (daysRemaining < 0)  return type === 'payment' && amount > 10000 ? 'critical' : 'high';
  if (daysRemaining === 0) return 'critical';
  if (daysRemaining <= 3) return 'high';
  if (daysRemaining <= 7) return 'normal';
  return 'low';
}

export const SERVICE_STEPS = [
  { done:'firstServiceDate',  next:'2nd', label:'2nd Service', days:120 },
  { done:'secondServiceDate', next:'3rd', label:'3rd Service', days:120 },
  { done:'thirdServiceDate',  next:'4th', label:'4th Service', days:120 },
  { done:'fourthServiceDate', next:'5th', label:'5th Service', days:120 },
  { done:'fifthServiceDate',  next:'6th', label:'6th Service', days:120 },
  { done:'sixthServiceDate',  next:'7th', label:'7th Service', days:120 },
];

export const SERVICE_KEY_MAP = {
  '1st':'firstService', '2nd':'secondService', '3rd':'thirdService',
  '4th':'fourthService', '5th':'fifthService', '6th':'sixthService', '7th':'seventhService',
};

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';

/**
 * एक ग्राहक record से उसके सारे pending reminders बनाओ.
 *
 * @param sdMap    customerServiceData जैसा object { REGNO: {...} }
 * @param custs    /api/customers की list (नाम/phone भरने के लिए)
 * @param followUps  { reminderId: [entries] }
 * @returns { reminders, mergeInfo }
 */
export function buildReminders(sdMap, custs = [], followUps = {}, manual = []) {
  // 1️⃣ पहले डुप्लिकेट records जोड़ो — imported-…, ObjectId, case वाले
  const { clean, merges } = consolidateServiceData(sdMap || {});

  const out = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const findCust = reg => custs.find(c => normKey(c.registrationNo || c.regNo) === normKey(reg));

  for (const [regNo, data] of Object.entries(clean)) {
    if (!regNo || regNo === 'NO_REG_') continue;

    const cust   = findCust(regNo);
    const nm     = data.customerName || cust?.customerName || cust?.name || 'Unknown';
    const ph     = data.phone || cust?.phone || '';
    const vh     = data.vehicle || cust?.vehicleModel || '';
    const custId = cust?._id || regNo;
    const state  = data.reminderState || {};

    // "पूरा हुआ" / "बाद में" / "गलत है" — तीनों यहीं से respect होते हैं
    const stateOf = (rid) => {
      const st = state[rid];
      if (!st) return { closed:false, snoozed:false, st:null };
      if (st.closedAt) return { closed:true, snoozed:false, st };
      if (st.snoozeUntil && new Date(st.snoozeUntil).getTime() > todayMs) return { closed:false, snoozed:true, st };
      return { closed:false, snoozed:false, st };
    };

    const add = (r) => {
      const s = stateOf(r.id);
      out.push({
        ...r,
        source:'auto',
        priority: r.priority || autoPriority(r.type, r.daysRemaining, r.amount || 0),
        customerId:custId, customerName:nm, customerPhone:ph, vehicle:vh, regNo,
        closed:s.closed, snoozed:s.snoozed, stateInfo:s.st,
        lastCallStatus: followUps[r.id]?.slice(-1)[0]?.status || null,
        callCount: followUps[r.id]?.length || 0,
      });
    };

    // ── 1. PAYMENT ──────────────────────────────────────────────────────
    const pend = parseFloat(data.pendingAmount || 0);
    if (pend > 0 && !data.paymentReceivedDate) {
      const hasDue = !!data.paymentDueDate;
      let dr = null, dd = null;
      if (hasDue) { dd = new Date(data.paymentDueDate); dd.setHours(0,0,0,0); dr = Math.floor((dd - todayMs) / DAY); }
      add({
        id:`pay-${regNo}`, type:'payment', serviceType:null,
        title:'💳 Payment बाक़ी',
        description:`बकाया: ₹${pend.toLocaleString('en-IN')}${hasDue ? ` | Due: ${fmtDate(dd)}` : ' | तारीख़ तय नहीं'}`,
        daysRemaining: hasDue ? dr : null,
        status: hasDue ? (dr <= 3 ? 'critical' : 'warning') : 'info',
        dueDate: dd, amount: pend,
        notifiable: hasDue, needsDate: !hasDue,
      });
    }

    // ── 2. RTO ──────────────────────────────────────────────────────────
    if (data.insuranceDate && !data.rtoDoneDate) {
      const ins = new Date(data.insuranceDate); ins.setHours(0,0,0,0);
      const rto = new Date(ins.getTime() + 7 * DAY);
      const dr  = Math.floor((rto - todayMs) / DAY);
      if (dr >= -30 && dr <= 7) add({
        id:`ins-${regNo}`, type:'insurance', serviceType:null,
        title:'🚗 RTO बाक़ी',
        description:`Insurance: ${fmtDate(data.insuranceDate)} | Deadline: ${fmtDate(rto)}`,
        daysRemaining:dr, status: dr <= 1 ? 'critical' : 'warning', dueDate:rto, notifiable:true,
      });
    }

    // ── 3. FIRST PARTY INSURANCE RENEWAL ────────────────────────────────
    let lsInsDate = null, lsRenewed = null;
    try {
      lsInsDate = localStorage.getItem(`vp_ins_${regNo}`);
      lsRenewed = localStorage.getItem(`vp_ins_renewed_${regNo}`);
    } catch {}
    const realStart  = lsInsDate || data.insuranceStartDate || data.insuranceDate;
    // ⚠️ असली insurance date न हो तो purchaseDate + 3 दिन का अंदाज़ा —
    //    ये सिर्फ़ page पर दिखते हैं, notification में कभी नहीं जाते.
    const guessStart = !realStart && data.purchaseDate
      ? new Date(new Date(data.purchaseDate).getTime() + 3 * DAY).toISOString().split('T')[0] : null;
    const insStartRaw = realStart || guessStart;

    if (insStartRaw && !data.insuranceRenewed && !lsRenewed) {
      const insStart   = new Date(insStartRaw); insStart.setHours(0,0,0,0);
      const renewalDue = new Date(insStart.getTime() + 335 * DAY);
      const insExpiry  = new Date(insStart.getTime() + 365 * DAY);
      const dr = Math.floor((renewalDue - todayMs) / DAY);
      if (dr >= -30 && dr <= 60) {
        const isEstimated = !realStart;
        add({
          id:`insr-${regNo}`, type:'insurance-renewal', serviceType:null,
          title: dr <= 0 ? '🛡️ Insurance Expired!' : '🛡️ Insurance Renewal',
          description:`Start: ${fmtDate(insStart)} | Expiry: ${fmtDate(insExpiry)} | Renewal: ${fmtDate(renewalDue)}${isEstimated ? ' — अनुमानित' : ''}`,
          daysRemaining:dr, status: dr <= 15 ? 'critical' : 'warning', dueDate:renewalDue,
          insuranceStartDate:insStartRaw,
          insuranceExpiryDate:insExpiry.toISOString().split('T')[0],
          isEstimated, notifiable: !isEstimated, needsDate: isEstimated,
        });
      }
    }

    // ── 3b. CUSTOMER FOLLOW-UP — call log में "अगली call" की तारीख़ डाली हो
    //    तो उसका भी reminder बने. (spec में माँगा गया था, पहले नहीं था —
    //    तारीख़ डाल तो देते थे पर कभी याद नहीं आती थी.)
    for (const [rid, entries] of Object.entries(followUps || {})) {
      if (!rid.endsWith(regNo)) continue;
      const last = entries?.[entries.length - 1];
      if (!last?.nextCallDate || last.status === 'done') continue;
      const fid = `fu-${regNo}`;
      const due = new Date(last.nextCallDate); due.setHours(0,0,0,0);
      const dr  = Math.floor((due - todayMs) / DAY);
      if (dr > 30 || dr < -30) continue;
      add({
        id:fid, type:'followup', serviceType:null,
        title:'📞 Follow-up call',
        description:`${last.note && last.note !== '—' ? `"${last.note}" — ` : ''}call करनी है ${fmtDate(due)}`,
        daysRemaining:dr, status: dr <= 0 ? 'critical' : 'warning', dueDate:due, notifiable:true,
      });
      break;
    }

    // ── 4. SERVICE — एक गाड़ी का सिर्फ़ एक (सबसे अगला) service reminder ──
    //    ⚠️ पहले notificationScheduler अलग से "Free Service" वाले reminder भी
    //    बनाता था, इसलिए एक ही ग्राहक को "2nd Service" और "2nd Free Service"
    //    दोनों की notification चली जाती थी. अब सिर्फ़ यही एक नियम है.
    if (data.purchaseDate && !data.firstServiceDate) {
      const pd  = new Date(data.purchaseDate); pd.setHours(0,0,0,0);
      const due = new Date(pd.getTime() + 30 * DAY);
      const dr  = Math.floor((due - todayMs) / DAY);
      if (dr >= -60) add({
        id:`svc-1st-${regNo}`, type:'service', serviceType:'1st',
        title:'🔧 1st Service',
        description:`खरीद: ${fmtDate(data.purchaseDate)} | Due: ${fmtDate(due)}`,
        daysRemaining:dr, status: dr <= 0 ? 'critical' : 'warning', dueDate:due, notifiable:true,
      });
    } else {
      for (const svc of SERVICE_STEPS) {
        const doneDate = data[svc.done];
        const nextKey  = (SERVICE_KEY_MAP[svc.next] || '') + 'Date';
        if (doneDate && !data[nextKey]) {
          const prev = new Date(doneDate); prev.setHours(0,0,0,0);
          const due  = new Date(prev.getTime() + svc.days * DAY);
          const dr   = Math.floor((due - todayMs) / DAY);
          if (dr >= -60) add({
            id:`svc-${svc.next}-${regNo}`, type:'service', serviceType:svc.next,
            title:`🔧 ${svc.label}`,
            description:`पिछली: ${fmtDate(doneDate)} | Due: ${fmtDate(due)}`,
            daysRemaining:dr, status: dr <= 0 ? 'critical' : 'warning', dueDate:due, notifiable:true,
          });
          break;
        }
      }
    }
  }

  // ── 5. हाथ से जोड़े गए reminders (MongoDB के `reminders` collection से) ──
  const today0 = todayMs;
  (Array.isArray(manual) ? manual : []).forEach(m => {
    if (!m || m.status === 'cancelled') return;
    const due = m.dueDate ? new Date(m.dueDate) : null;
    if (due) due.setHours(0, 0, 0, 0);
    const dr = due && !isNaN(due) ? Math.floor((due - today0) / DAY) : null;
    const snoozed = m.snoozeUntil && new Date(m.snoozeUntil).getTime() > today0;
    out.push({
      id: `man-${m._id}`,
      mongoId: m._id,
      source: 'manual',
      type: m.type && m.type !== 'manual' ? m.type : 'manual',
      serviceType: null,
      title: m.title || '📌 Reminder',
      description: m.notes || (m.customerName ? `${m.customerName}${m.vehicle ? ` · ${m.vehicle}` : ''}` : 'हाथ से जोड़ा गया'),
      daysRemaining: dr,
      status: dr === null ? 'info' : dr <= 0 ? 'critical' : dr <= 3 ? 'critical' : 'warning',
      dueDate: due,
      priority: m.priority || autoPriority('manual', dr),
      notifiable: dr !== null,
      needsDate: dr === null,
      customerId: m.customerId || '',
      customerName: m.customerName || m.title || '—',
      customerPhone: m.phone || '',
      vehicle: m.vehicle || '',
      regNo: m.regNo || '',
      assignedTo: m.assignedTo || '',
      assignedToName: m.assignedToName || '',
      notifiedRungs: m.notifiedRungs || [],
      closed: m.status === 'completed',
      snoozed: !!snoozed,
      stateInfo: m.status === 'completed'
        ? { closedAt: m.completedAt, reason: 'पूरा हुआ' }
        : snoozed ? { snoozeUntil: m.snoozeUntil, reason: 'टाला हुआ' } : null,
      completedAt: m.completedAt || null,
      lastCallStatus: null,
      callCount: 0,
    });
  });

  // 2️⃣ आख़िरी सुरक्षा — एक ही ग्राहक की एक ही चीज़ दो बार न रहे
  const reminders = dedupeReminders(out);

  // क्रम: पहले priority (अति ज़रूरी सबसे ऊपर), फिर सबसे कम दिन बचे हुए,
  // तारीख़-रहित सबसे नीचे
  reminders.sort((a, b) => {
    const aN = a.daysRemaining === null, bN = b.daysRemaining === null;
    if (aN !== bN) return aN ? 1 : -1;
    if (aN && bN) return 0;
    const pa = PRIORITY[a.priority]?.rank ?? 2, pb = PRIORITY[b.priority]?.rank ?? 2;
    if (pa !== pb) return pa - pb;
    return a.daysRemaining - b.daysRemaining;
  });

  return { reminders, mergeInfo: merges };
}

/**
 * notification भेजने लायक reminders — ये सारे filter एक ही जगह हों इसलिए यहाँ.
 * नियम: बंद/टाला हुआ नहीं, अनुमानित नहीं, तारीख़-रहित नहीं, और
 * एक ग्राहक का सिर्फ़ सबसे ज़रूरी एक reminder.
 */
export function notifiableReminders(reminders, limit = 5) {
  // ⚙️ अब "कितने दिन के अंदर" नहीं — **सीढ़ी** के हिसाब से. एक reminder पर
  // 7 / 3 / 1 / 0 / overdue — पाँच पड़ाव, हर पड़ाव पर एक ही notification.
  const urgent = reminders.filter(r =>
    !r.closed && !r.snoozed && r.notifiable && ladderRung(r.daysRemaining) !== null
  );

  // एक ग्राहक = एक notification (उसका सबसे ज़रूरी reminder)
  const byCustomer = new Map();
  for (const r of urgent) {
    const key = String(r.customerPhone || '').replace(/\D/g, '').slice(-10)
             || `${r.customerName}|${r.regNo}`;
    const prev = byCustomer.get(key);
    if (!prev) { byCustomer.set(key, { head:r, extra:0 }); continue; }
    prev.extra++;
    const pr = PRIORITY[r.priority]?.rank ?? 2, pp = PRIORITY[prev.head.priority]?.rank ?? 2;
    if (pr < pp || (pr === pp && r.daysRemaining < prev.head.daysRemaining)) prev.head = r;
  }

  return [...byCustomer.values()]
    .sort((a, b) => {
      const pa = PRIORITY[a.head.priority]?.rank ?? 2, pb = PRIORITY[b.head.priority]?.rank ?? 2;
      if (pa !== pb) return pa - pb;
      return a.head.daysRemaining - b.head.daysRemaining;
    })
    .slice(0, limit);
}

/** ऊपर के dashboard के आँकड़े — Total | Today | Upcoming | Overdue | Completed */
export function reminderStats(reminders) {
  const live = reminders.filter(r => !r.closed);
  return {
    total:     live.length,
    today:     live.filter(r => r.daysRemaining === 0).length,
    upcoming:  live.filter(r => r.daysRemaining !== null && r.daysRemaining > 0).length,
    overdue:   live.filter(r => r.daysRemaining !== null && r.daysRemaining < 0).length,
    completed: reminders.filter(r => r.closed).length,
    snoozed:   reminders.filter(r => r.snoozed && !r.closed).length,
    needsDate: live.filter(r => r.needsDate).length,
    critical:  live.filter(r => r.priority === 'critical').length,
  };
}

