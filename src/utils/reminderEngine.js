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
export function buildReminders(sdMap, custs = [], followUps = {}) {
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
        ...r, customerId:custId, customerName:nm, customerPhone:ph, vehicle:vh, regNo,
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

  // 2️⃣ आख़िरी सुरक्षा — एक ही ग्राहक की एक ही चीज़ दो बार न रहे
  const reminders = dedupeReminders(out);

  reminders.sort((a, b) => {
    const aN = a.daysRemaining === null, bN = b.daysRemaining === null;
    if (aN !== bN) return aN ? 1 : -1;
    if (aN && bN) return 0;
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
  const urgent = reminders.filter(r =>
    !r.closed && !r.snoozed && r.notifiable && r.daysRemaining !== null &&
    (r.type === 'payment'           ? r.daysRemaining <= 3
    : r.type === 'service'          ? r.daysRemaining <= 5  && r.daysRemaining >= -60
    : r.type === 'insurance'        ? r.daysRemaining <= 7  && r.daysRemaining >= 0
    : r.type === 'insurance-renewal'? r.daysRemaining <= 30 && r.daysRemaining >= -30
    : r.daysRemaining <= 5)
  );

  // एक ग्राहक = एक notification (उसका सबसे ज़रूरी reminder)
  const byCustomer = new Map();
  for (const r of urgent) {
    const key = String(r.customerPhone || '').replace(/\D/g, '').slice(-10) || `${r.customerName}|${r.regNo}`;
    const prev = byCustomer.get(key);
    if (!prev) { byCustomer.set(key, { head:r, extra:0 }); continue; }
    prev.extra++;
    if (r.daysRemaining < prev.head.daysRemaining) { const old = prev.head; prev.head = r; void old; }
  }

  return [...byCustomer.values()]
    .sort((a, b) => a.head.daysRemaining - b.head.daysRemaining)
    .slice(0, limit);
}
