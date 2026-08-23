// ════════════════════════════════════════════════════════════════════════════
// RemindersPage.jsx — VP Honda Reminders (v3)
// ════════════════════════════════════════════════════════════════════════════
// इस version में जो ठीक हुआ:
//
// 1. 🔁 एक ही नाम से 3-3 reminder
//    एक ग्राहक से एक साथ payment + RTO + insurance + service — चार reminder बन
//    सकते थे और चारों अलग-अलग notification जाते थे. अब list ग्राहक-वार grouped
//    है: एक कार्ड = एक ग्राहक, अंदर उसके सारे reminders. Notification भी अब
//    5 अलग-अलग *ग्राहकों* को जाती है, एक ही ग्राहक के 5 reminders को नहीं.
//
// 2. 👻 नक़ली reminders
//    "Insurance Renewal" हर उस ग्राहक के लिए बन जाता था जिसकी purchaseDate थी —
//    चाहे insurance की कोई entry हो ही नहीं (purchaseDate + 3 दिन का अंदाज़ा).
//    अब ऐसे अनुमानित reminder "⚠️ अनुमान" tag के साथ अलग दिखते हैं और
//    phone notification में जाते ही नहीं — पहले तारीख़ confirm करनी पड़ेगी.
//    इसी तरह बिना due-date वाला payment reminder भी अब notify नहीं होता.
//
// 3. 🎯 Notification पर click → वही reminder
//    पहले URL में सिर्फ़ नाम जाता था और page सिर्फ़ search box भर देता था —
//    3 reminders वाले ग्राहक में पता ही नहीं चलता था कौन सा. अब notification
//    URL में reminder की पक्की id (?rid=svc-2nd-MP04XX1234) जाती है, page सीधे
//    उसी reminder को खोलकर, highlight करके, ऊपर action bar दिखाता है.
//    (पुराना bug: card का DOM id phone के पहले 10 अंक से बनता था जबकि
//     notification आख़िरी 10 भेजता था — highlight कभी मिलता ही नहीं था.)
//
// 4. ✅ "पूरा हुआ" बटन — हर तरह के reminder पर
//    पहले सिर्फ़ service पर था. अब payment, RTO, insurance renewal — सब पर है,
//    और status **MongoDB में** सेव होता है (पहले सिर्फ़ localStorage में था,
//    इसलिए Vercel cron को पता ही नहीं चलता था और notification आती रहती थी).
//    "बाद में" (snooze 7/15/30 दिन) और "यह गलत है — बंद करो" भी है.
//
// 5. 🐞 `loadReminders is not defined`
//    "Edit Date" और "Renewed" बटन एक ऐसा function बुलाते थे जो मौजूद ही नहीं था
//    — click करते ही crash. अब ठीक है.
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bell, RefreshCw, Phone, PhoneCall, AlertTriangle, CheckCircle,
  MessageSquare, X, TrendingUp, Clock, Eye, ChevronDown, ChevronRight,
  Shield, Wrench, CreditCard, Car, Search, RotateCcw,
} from 'lucide-react';
import { api } from '../utils/apiConfig';
import { showInAppToast, requestNotificationPermission } from '../utils/smartUtils';
import {
  normKey, isRealRegNo, consolidateServiceData, dedupeReminders, displayRegNo,
} from '../utils/vehicleIdentity';
import ReminderPushButton from '../components/ReminderPushButton';

// ── Small helpers ────────────────────────────────────────────────────────────
const getLS = (k, fb = []) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const setLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const greet = () => { const h = new Date().getHours(); return h < 12 ? '🌅 सुप्रभात' : h < 17 ? '☀️ नमस्कार' : '🌙 शुभ संध्या'; };
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const fmtTime = d => d ? new Date(d).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : '';
const todayISO = () => new Date().toISOString().split('T')[0];
const DAY = 86400000;

const SERVICE_MAP = [
  { done:'firstServiceDate',  next:'2nd', label:'2nd Service', days:120 },
  { done:'secondServiceDate', next:'3rd', label:'3rd Service', days:120 },
  { done:'thirdServiceDate',  next:'4th', label:'4th Service', days:120 },
  { done:'fourthServiceDate', next:'5th', label:'5th Service', days:120 },
  { done:'fifthServiceDate',  next:'6th', label:'6th Service', days:120 },
  { done:'sixthServiceDate',  next:'7th', label:'7th Service', days:120 },
];
const SERVICE_KEY_MAP = {
  '1st':'firstService', '2nd':'secondService', '3rd':'thirdService',
  '4th':'fourthService', '5th':'fifthService', '6th':'sixthService', '7th':'seventhService',
};

const CALL_STATUS = [
  { value:'called',    label:'✅ बात हुई',        color:'#22c55e' },
  { value:'promised',  label:'🤝 कल आएँगे',       color:'#3b82f6' },
  { value:'no_answer', label:'📵 नहीं उठाया',      color:'#eab308' },
  { value:'busy',      label:'🔴 व्यस्त थे',       color:'#f97316' },
  { value:'later',     label:'⏰ बाद में',         color:'#a855f7' },
  { value:'not_int',   label:'❌ रुचि नहीं',       color:'#ef4444' },
];

const TYPE_META = {
  payment:              { icon:CreditCard, label:'💳 Payment',    color:'#22c55e' },
  insurance:            { icon:Car,        label:'🚗 RTO',        color:'#a855f7' },
  'insurance-renewal':  { icon:Shield,     label:'🛡️ Insurance',  color:'#DC0000' },
  service:              { icon:Wrench,     label:'🔧 सर्विस',      color:'#ea580c' },
};

// ── WhatsApp message ─────────────────────────────────────────────────────────
const getWAMessage = (r) => {
  const name = (r.customerName || '').replace(/^\d+\s*/, '').split(' ')[0] || 'महोदय/महोदया';
  const due  = r.dueDate instanceof Date ? fmtDate(r.dueDate) : (r.dueDate || '');

  if (r.type === 'insurance-renewal') {
    const expiry = r.insuranceExpiryDate ? fmtDate(new Date(r.insuranceExpiryDate)) : 'जल्दी';
    return encodeURIComponent(
      `नमस्ते ${name} जी! 🙏\n\n*वी.पी. होंडा* की तरफ से महत्वपूर्ण सूचना:\n\n🛡️ आपकी *${r.vehicle||'गाड़ी'}* (${r.regNo||''}) का *First Party Insurance* जल्दी Expire होने वाला है।\n\n📅 Insurance Expiry: *${expiry}*\n📋 Renewal की Last Date: *${due}*\n\nसमय पर Renewal न करने पर:\n❌ आपकी गाड़ी Uninsured हो जाएगी\n❌ दुर्घटना में Coverage नहीं मिलेगी\n\n✅ अभी Renewal करवाएं!\n\n🏍️ वी.पी. होंडा, भोपाल\n📞 9713394738`
    );
  }
  if (r.type === 'payment') {
    return encodeURIComponent(
      `नमस्ते ${name} जी! 🙏\n\n*वी.पी. होंडा* की तरफ से याद दिलाना चाहते हैं कि आपकी *${r.vehicle||'गाड़ी'}* (${r.regNo||''}) पर *₹${(r.amount||0).toLocaleString('en-IN')}* बकाया है।\n\n📅 भुगतान की तारीख़: ${due}\n\nकृपया जल्द भुगतान करें।\n\n🏍️ वी.पी. होंडा\nपरवलिया सड़क, भोपाल\n📞 9713394738`
    );
  }
  if (r.type === 'insurance') {
    return encodeURIComponent(
      `नमस्ते ${name} जी! 🙏\n\nआपकी *${r.vehicle||'गाड़ी'}* का *RTO Registration* अभी बाक़ी है।\n\n📅 Deadline: ${due}\n\nकृपया ज़रूरी कागज़ात लेकर शोरूम पधारें।\n\n🏍️ वी.पी. होंडा, भोपाल\n📞 9713394738`
    );
  }
  const svcLabel = r.serviceType ? `${r.serviceType} सर्विस` : 'सर्विस';
  return encodeURIComponent(
    `नमस्ते ${name} जी! 🙏\n\nवी.पी. होंडा की तरफ से याद दिलाना चाहते हैं कि आपकी *${r.vehicle||'गाड़ी'}* (${r.regNo}) की *${svcLabel}* की तारीख आ चुकी है।\n\n📅 सर्विस की तारीख: ${due}\n\nकृपया सर्विस कराने के लिए शोरूम पधारें।\n\n🏍️ वी.पी. होंडा\nपरवलिया सड़क, भोपाल\n📞 9713394738`
  );
};

// ── Invoice → service data ───────────────────────────────────────────────────
const detectServiceNumber = (inv) => {
  if (inv.serviceNumber && inv.serviceNumber >= 1 && inv.serviceNumber <= 7) return inv.serviceNumber;
  const txt = JSON.stringify({
    desc: inv.description || '', items: inv.items || inv.particulars || [],
    notes: inv.notes || '', type: inv.serviceType || inv.type || '',
  }).toLowerCase();
  if (/\b(1st|first|i\s*st)\s*(free\s*)?service\b/.test(txt)) return 1;
  if (/\b(2nd|second|ii\s*nd)\s*(free\s*)?service\b/.test(txt)) return 2;
  if (/\b(3rd|third|iii\s*rd)\s*(free\s*)?service\b/.test(txt)) return 3;
  if (/\b(4th|fourth|iv\s*th)\s*service\b/.test(txt)) return 4;
  if (/\b(5th|fifth|v\s*th)\s*service\b/.test(txt)) return 5;
  if (/\b(6th|sixth|vi\s*th)\s*service\b/.test(txt)) return 6;
  if (/\b(7th|seventh|vii\s*th)\s*service\b/.test(txt)) return 7;
  return null;
};

const isVehiclePurchase = (inv) => {
  if (inv.invoiceType === 'vehicle') return true;
  const txt = JSON.stringify({ desc: inv.description||'', items: inv.items||inv.particulars||[], type: inv.invoiceType||inv.type||'' }).toLowerCase();
  if (/\b(new\s*vehicle|vehicle\s*sale|chassis|engine\s*no|frame\s*no)\b/.test(txt)) return true;
  const total = parseFloat(inv.totalAmount || inv.total || inv.grandTotal || inv.totals?.totalAmount || 0);
  return total >= 50000 && !/service/i.test(txt);
};

const buildServiceData = (invoices) => {
  const sd = getLS('customerServiceData', {});
  const deletedKeys = new Set(getLS('deletedServiceKeys', []));
  invoices.forEach(inv => {
    const regNo = normKey(inv.regNo);
    if (!regNo || regNo === '—' || regNo === '-' || deletedKeys.has(regNo)) return;
    if (!sd[regNo]) sd[regNo] = {};
    const e = sd[regNo];
    if (inv.customerName)  e.customerName = inv.customerName;
    if (inv.customerPhone) e.phone = inv.customerPhone;
    if (inv.vehicle)       e.vehicle = inv.vehicle;
    e.regNo = regNo;
    const d = inv.invoiceDate || '';
    if (!d) return;
    if (isVehiclePurchase(inv) && (!e.purchaseDate || new Date(d) < new Date(e.purchaseDate))) e.purchaseDate = d;
    const sn = detectServiceNumber(inv);
    if (sn) {
      const km = {1:'firstServiceDate',2:'secondServiceDate',3:'thirdServiceDate',4:'fourthServiceDate',5:'fifthServiceDate',6:'sixthServiceDate',7:'seventhServiceDate'};
      const k = km[sn];
      if (k && (!e[k] || new Date(d) > new Date(e[k]))) {
        e[k] = d;
        if (inv.serviceKm || inv.km) e[k.replace('Date','Km')] = inv.serviceKm || inv.km;
      }
    }
  });
  setLS('customerServiceData', sd);
  return sd;
};

// ════════════════════════════════════════════════════════════════════════════
export default function RemindersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ⭐ Notification deep-link — अब पक्की reminder id आती है
  const focusRid   = searchParams.get('rid');
  const focusName  = searchParams.get('focus');

  const [reminders,   setReminders]   = useState([]);
  const [customers,   setCustomers]   = useState([]);
  const [filterType,  setFilterType]  = useState('all');
  const [searchTerm,  setSearchTerm]  = useState('');
  const [loading,     setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [followUps,   setFollowUps]   = useState(() => getLS('followUpLog', {}));
  const [openGroup,   setOpenGroup]   = useState(null);
  const [expandedLog, setExpandedLog] = useState(null);
  const [syncMsg,     setSyncMsg]     = useState('');
  const [showFU,      setShowFU]      = useState(false);
  const [showDone,    setShowDone]    = useState(false);
  const [showClosed,  setShowClosed]  = useState(false);
  const [activeR,     setActiveR]     = useState(null);
  const [fuForm,      setFuForm]      = useState({ status:'called', note:'', nextCallDate:'' });
  const [doneForm,    setDoneForm]    = useState({ km:'', date:todayISO(), amount:'', remarks:'' });
  const [notifStatus, setNotifStatus] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default');
  const [dupInfo,     setDupInfo]     = useState([]);   // कौन-कौन से duplicate जोड़े गए
  const [cleaning,    setCleaning]    = useState(false);
  const intervalRef = useRef(null);
  const GROUPS_PER_PAGE = 8;

  // ══════════════════════════════════════════════════════════════════════════
  // BUILD REMINDERS
  // ══════════════════════════════════════════════════════════════════════════
  const buildReminders = useCallback(async () => {
    try {
      let custs = [];
      try { const r = await fetch(api('/api/customers')); if (r.ok) custs = await r.json(); } catch {}
      setCustomers(custs);

      const sd = getLS('customerServiceData', {});
      const fu = getLS('followUpLog', {});
      const all = [];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayMs = today.getTime();
      const getC = reg => custs.find(c => (c.registrationNo || c.regNo || '').toUpperCase() === reg.toUpperCase());

      Object.entries(sd).forEach(([regNo, data]) => {
        if (!regNo || regNo === 'no_reg_') return;
        const cust   = getC(regNo);
        const nm     = data.customerName || cust?.customerName || cust?.name || 'Unknown';
        const ph     = data.phone || cust?.phone || '';
        const vh     = data.vehicle || cust?.vehicleModel || '';
        const custId = cust?._id || regNo;
        const state  = data.reminderState || {};

        // एक reminder बंद है या snooze पर? — यही MongoDB में भी सेव है, इसलिए
        // Vercel cron भी इसे respect करता है और notification नहीं भेजता.
        const stateOf = (rid) => {
          const st = state[rid];
          if (!st) return { closed:false, snoozed:false, st:null };
          if (st.closedAt) return { closed:true, snoozed:false, st };
          if (st.snoozeUntil && new Date(st.snoozeUntil).getTime() > todayMs) return { closed:false, snoozed:true, st };
          return { closed:false, snoozed:false, st };
        };

        const push = (r) => {
          const s = stateOf(r.id);
          all.push({
            ...r, customerId:custId, customerName:nm, customerPhone:ph, vehicle:vh, regNo,
            closed:s.closed, snoozed:s.snoozed, stateInfo:s.st,
            lastCallStatus: fu[r.id]?.slice(-1)[0]?.status || null,
            callCount: fu[r.id]?.length || 0,
          });
        };

        // ── 1. PAYMENT ────────────────────────────────────────────────────
        const pend = parseFloat(data.pendingAmount || 0);
        if (pend > 0 && !data.paymentReceivedDate) {
          const rid = `pay-${regNo}`;
          const hasDue = !!data.paymentDueDate;
          let dr = null, dd = null;
          if (hasDue) { dd = new Date(data.paymentDueDate); dd.setHours(0,0,0,0); dr = Math.floor((dd - todayMs) / DAY); }
          push({
            id:rid, type:'payment', serviceType:null,
            title:'💳 Payment बाक़ी',
            description:`बकाया: ₹${pend.toLocaleString('en-IN')}${hasDue ? ` | Due: ${fmtDate(dd)}` : ' | तारीख़ तय नहीं'}`,
            daysRemaining: hasDue ? dr : null,
            status: hasDue ? (dr <= 3 ? 'critical' : 'warning') : 'info',
            dueDate: dd, amount: pend,
            // ⚠️ बिना due-date वाला payment phone notification में नहीं जाएगा
            notifiable: hasDue,
            needsDate: !hasDue,
          });
        }

        // ── 2. RTO ────────────────────────────────────────────────────────
        if (data.insuranceDate && !data.rtoDoneDate) {
          const ins = new Date(data.insuranceDate); ins.setHours(0,0,0,0);
          const rto = new Date(ins.getTime() + 7 * DAY);
          const dr  = Math.floor((rto - todayMs) / DAY);
          if (dr >= -30 && dr <= 7) {
            push({
              id:`ins-${regNo}`, type:'insurance', serviceType:null,
              title:'🚗 RTO बाक़ी',
              description:`Insurance: ${fmtDate(data.insuranceDate)} | Deadline: ${fmtDate(rto)}`,
              daysRemaining:dr, status: dr <= 1 ? 'critical' : 'warning', dueDate:rto, notifiable:true,
            });
          }
        }

        // ── 3. FIRST PARTY INSURANCE RENEWAL ──────────────────────────────
        const lsInsDate = localStorage.getItem(`vp_ins_${regNo}`);
        const lsRenewed = localStorage.getItem(`vp_ins_renewed_${regNo}`);
        const realStart = lsInsDate || data.insuranceStartDate || data.insuranceDate;
        // ⚠️ अनुमान: कोई insurance date है ही नहीं तो purchaseDate + 3 दिन.
        // यही सबसे बड़ी नक़ली-reminder की वजह थी. अब ये notify नहीं होते.
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
            push({
              id:`insr-${regNo}`, type:'insurance-renewal', serviceType:null,
              title: dr <= 0 ? '🛡️ Insurance Expired!' : '🛡️ Insurance Renewal',
              description:`Start: ${fmtDate(insStart)} | Expiry: ${fmtDate(insExpiry)} | Renewal: ${fmtDate(renewalDue)}${isEstimated ? ' — अनुमानित' : ''}`,
              daysRemaining:dr, status: dr <= 15 ? 'critical' : 'warning', dueDate:renewalDue,
              insuranceStartDate:insStartRaw,
              insuranceExpiryDate:insExpiry.toISOString().split('T')[0],
              isEstimated,
              notifiable: !isEstimated,   // ⭐ अनुमान वाले notification में नहीं जाते
              needsDate: isEstimated,
            });
          }
        }

        // ── 4. SERVICE — एक ग्राहक का सिर्फ़ एक (सबसे अगला) service reminder ──
        if (data.purchaseDate && !data.firstServiceDate) {
          const pd  = new Date(data.purchaseDate); pd.setHours(0,0,0,0);
          const due = new Date(pd.getTime() + 30 * DAY);
          const dr  = Math.floor((due - todayMs) / DAY);
          if (dr >= -60) push({
            id:`svc-1st-${regNo}`, type:'service', serviceType:'1st',
            title:'🔧 1st Service',
            description:`खरीद: ${fmtDate(data.purchaseDate)} | Due: ${fmtDate(due)}`,
            daysRemaining:dr, status: dr <= 0 ? 'critical' : 'warning', dueDate:due, notifiable:true,
          });
        } else {
          for (const svc of SERVICE_MAP) {
            const doneDate = data[svc.done];
            const nextKey  = (SERVICE_KEY_MAP[svc.next] || '') + 'Date';
            if (doneDate && !data[nextKey]) {
              const prev = new Date(doneDate); prev.setHours(0,0,0,0);
              const due  = new Date(prev.getTime() + svc.days * DAY);
              const dr   = Math.floor((due - todayMs) / DAY);
              if (dr >= -60) push({
                id:`svc-${svc.next}-${regNo}`, type:'service', serviceType:svc.next,
                title:`🔧 ${svc.label}`,
                description:`पिछली: ${fmtDate(doneDate)} | Due: ${fmtDate(due)}`,
                daysRemaining:dr, status: dr <= 0 ? 'critical' : 'warning', dueDate:due, notifiable:true,
              });
              break;
            }
          }
        }
      });

      // ⭐ आख़िरी सुरक्षा: अगर फिर भी एक ही ग्राहक की एक ही सर्विस के दो reminder
      // बन गए हों (एक ही तारीख़, एक ही type) तो सिर्फ़ एक रखो.
      const deduped = dedupeReminders(all);
      all.length = 0; all.push(...deduped);

      // सबसे ज़रूरी पहले — overdue, फिर कम दिन बचे हुए, तारीख़-रहित सबसे नीचे
      all.sort((a, b) => {
        const aN = a.daysRemaining === null, bN = b.daysRemaining === null;
        if (aN !== bN) return aN ? 1 : -1;
        if (aN && bN) return 0;
        return a.daysRemaining - b.daysRemaining;
      });

      setReminders(all);
      setLastRefresh(new Date());
      setLoading(false);
    } catch (e) { console.error(e); setLoading(false); }
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // LOAD
  // ══════════════════════════════════════════════════════════════════════════
  const loadAll = useCallback(async () => {
    try {
      // 1. Invoices
      let dbInv = [];
      try { const r = await fetch(api('/api/invoices')); if (r.ok) dbInv = await r.json(); } catch {}
      const seen = new Set();
      const all = [...dbInv, ...getLS('invoices', [])].filter(inv => {
        const k = String(inv.invoiceNumber || inv._id || Math.random());
        if (seen.has(k)) return false; seen.add(k); return true;
      });

      // 2. Service data — MongoDB source of truth, localStorage में merge
      try {
        const sdRes = await fetch(api('/api/service-data'));
        if (sdRes.ok) {
          const dbSD = await sdRes.json();
          const merged = { ...getLS('customerServiceData', {}) };
          const FIELDS = ['purchaseDate','firstServiceDate','firstServiceKm','secondServiceDate','secondServiceKm',
            'thirdServiceDate','thirdServiceKm','fourthServiceDate','fourthServiceKm','fifthServiceDate','fifthServiceKm',
            'sixthServiceDate','sixthServiceKm','seventhServiceDate','seventhServiceKm','pendingAmount','paymentDueDate',
            'paymentReceivedDate','insuranceDate','rtoDoneDate','insuranceStartDate','insuranceRenewalDate','insuranceRenewed'];
          (Array.isArray(dbSD) ? dbSD : []).forEach(rec => {
            // ⚠️ यहीं वह bug था: MongoDB से आई key बिना uppercase किए इस्तेमाल
            // होती थी, जबकि invoices वाली key uppercase होती थी. इसलिए
            // "69ec60df…" और "69EC60DF…" दो अलग गाड़ियाँ बन जाती थीं.
            const reg = normKey(rec.regNo); if (!reg) return;
            if (!merged[reg]) merged[reg] = {};
            FIELDS.forEach(f => { if (rec[f] !== undefined && rec[f] !== null && rec[f] !== '') merged[reg][f] = rec[f]; });
            // ⭐ reminderState हमेशा server से — यही "बंद किया हुआ" reminder याद रखता है
            merged[reg].reminderState = rec.reminderState || {};
            if (rec.customerName) merged[reg].customerName = rec.customerName;
            if (rec.phone)        merged[reg].phone = rec.phone;
            if (rec.vehicle)      merged[reg].vehicle = rec.vehicle;
            merged[reg].regNo = reg;
          });
          setLS('customerServiceData', merged);
        }
      } catch (e) { console.log('service-data fetch failed:', e.message); }

      // 3. Invoices से बचे-खुचे fields भरें
      buildServiceData(all);

      // 3b. ⭐ डुप्लिकेट records जोड़ो — एक गाड़ी = एक record
      //     (imported-…, ObjectId और case वाले duplicates यहीं ख़त्म होते हैं)
      try {
        const { clean, merges } = consolidateServiceData(getLS('customerServiceData', {}));
        setLS('customerServiceData', clean);
        setDupInfo(merges);
      } catch (e) { console.warn('consolidate failed:', e.message); }

      // 4. वापस MongoDB में sync (reminderState छोड़कर — वह server का है)
      try {
        const sdToSync = { ...getLS('customerServiceData', {}) };
        Object.keys(sdToSync).forEach(k => { const c = { ...sdToSync[k] }; delete c.reminderState; sdToSync[k] = c; });
        if (Object.keys(sdToSync).length) {
          fetch(api('/api/service-data/sync'), {
            method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(sdToSync),
          }).catch(() => {});
        }
      } catch {}

      // 5. Follow-up logs
      try {
        const fuRes = await fetch(api('/api/follow-ups'));
        if (fuRes.ok) {
          const dbFU = await fuRes.json();
          const merged = { ...getLS('followUpLog', {}) };
          (Array.isArray(dbFU) ? dbFU : []).forEach(entry => {
            const rid = entry.reminderId; if (!rid) return;
            if (!merged[rid]) merged[rid] = [];
            if (!merged[rid].some(e => e.date === entry.date)) {
              merged[rid].push({ date:entry.date, status:entry.status, note:entry.note, nextCallDate:entry.nextCallDate, by:entry.by || 'Admin' });
            }
          });
          Object.keys(merged).forEach(k => merged[k].sort((a, b) => new Date(a.date) - new Date(b.date)));
          setFollowUps(merged); setLS('followUpLog', merged);
        }
      } catch {}

      await buildReminders();
    } catch (e) { console.error(e); setLoading(false); }
  }, [buildReminders]);

  useEffect(() => {
    loadAll();
    window.addEventListener('storage', loadAll);
    intervalRef.current = setInterval(loadAll, 60000);   // 10s → 60s (10s बहुत आक्रामक था)
    return () => { window.removeEventListener('storage', loadAll); clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // REMINDER STATE — पूरा हुआ / बाद में / बंद करो
  // ══════════════════════════════════════════════════════════════════════════
  const patchState = async (r, payload) => {
    // localStorage तुरंत (UI तेज़ लगे)
    const sd = getLS('customerServiceData', {});
    if (!sd[r.regNo]) sd[r.regNo] = {};
    if (!sd[r.regNo].reminderState) sd[r.regNo].reminderState = {};
    sd[r.regNo].reminderState[r.id] = { ...payload, updatedAt:new Date().toISOString() };
    setLS('customerServiceData', sd);
    // फिर MongoDB — ताकि दूसरे devices और Vercel cron दोनों को पता चले
    try {
      const res = await fetch(api(`/api/service-data/${encodeURIComponent(r.regNo)}/reminder-state`), {
        method:'PATCH', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ rid:r.id, ...payload }),
      });
      if (!res.ok) throw new Error('save failed');
      return true;
    } catch {
      setSyncMsg('⚠️ सिर्फ़ इस phone पर सेव हुआ — internet आने पर दोबारा दबाएँ');
      setTimeout(() => setSyncMsg(''), 4000);
      return false;
    }
  };

  const snooze = async (r, days) => {
    const until = new Date(Date.now() + days * DAY).toISOString();
    const ok = await patchState(r, { snoozeUntil:until, reason:`${days} दिन के लिए टाला` });
    if (ok) { setSyncMsg(`⏰ ${days} दिन के लिए टाल दिया — तब तक notification नहीं आएगी`); setTimeout(() => setSyncMsg(''), 3500); }
    loadAll();
  };

  const closeReminder = async (r, reason) => {
    const ok = await patchState(r, { closedAt:new Date().toISOString(), reason: reason || 'बंद किया' });
    if (ok) { setSyncMsg('🚫 बंद कर दिया — यह reminder दोबारा नहीं आएगा'); setTimeout(() => setSyncMsg(''), 3500); }
    loadAll();
  };

  const reopenReminder = async (r) => {
    const sd = getLS('customerServiceData', {});
    if (sd[r.regNo]?.reminderState) { delete sd[r.regNo].reminderState[r.id]; setLS('customerServiceData', sd); }
    try {
      await fetch(api(`/api/service-data/${encodeURIComponent(r.regNo)}/reminder-state/${encodeURIComponent(r.id)}`), { method:'DELETE' });
    } catch {}
    setSyncMsg('↩️ वापस चालू कर दिया'); setTimeout(() => setSyncMsg(''), 2500);
    loadAll();
  };

  // ── "पूरा हुआ" — हर type के लिए सही field सेट करता है ────────────────────
  const submitDone = async () => {
    if (!activeR) return;
    const r  = activeR;
    const sd = getLS('customerServiceData', {});
    if (!sd[r.regNo]) sd[r.regNo] = {};
    const rec = sd[r.regNo];
    let note = '';

    if (r.type === 'service') {
      const key = SERVICE_KEY_MAP[r.serviceType];
      if (key) { rec[key + 'Date'] = doneForm.date; if (doneForm.km) rec[key + 'Km'] = doneForm.km; }
      note = `सर्विस हुई. KM: ${doneForm.km || '—'}. ${doneForm.remarks || ''}`;
    } else if (r.type === 'payment') {
      rec.paymentReceivedDate = doneForm.date;
      const recvd = parseFloat(doneForm.amount || 0);
      // आंशिक भुगतान — बाक़ी रक़म बची रहेगी और reminder भी
      rec.pendingAmount = recvd > 0 ? Math.max(0, (parseFloat(rec.pendingAmount || 0) - recvd)) : 0;
      if (rec.pendingAmount > 0) delete rec.paymentReceivedDate;
      note = `भुगतान मिला ₹${(recvd || r.amount || 0).toLocaleString('en-IN')}. बाक़ी ₹${(rec.pendingAmount||0).toLocaleString('en-IN')}. ${doneForm.remarks || ''}`;
    } else if (r.type === 'insurance') {
      rec.rtoDoneDate = doneForm.date;
      note = `RTO पूरा हुआ ${fmtDate(doneForm.date)}. ${doneForm.remarks || ''}`;
    } else if (r.type === 'insurance-renewal') {
      // नया insurance शुरू — अगले साल का cycle यहीं से गिना जाएगा
      rec.insuranceStartDate = doneForm.date;
      rec.insuranceRenewed = false;
      localStorage.removeItem(`vp_ins_renewed_${r.regNo}`);
      localStorage.setItem(`vp_ins_${r.regNo}`, doneForm.date);
      note = `Insurance renew हुआ, नई start date ${fmtDate(doneForm.date)}. ${doneForm.remarks || ''}`;
    }
    if (doneForm.remarks) rec.lastRemarks = doneForm.remarks;
    setLS('customerServiceData', sd);

    // follow-up log
    const u = { ...followUps };
    if (!u[r.id]) u[r.id] = [];
    u[r.id].push({ date:new Date().toISOString(), status:'done', note, by:'Admin' });
    setFollowUps(u); setLS('followUpLog', u);

    try {
      const clean = { ...rec }; delete clean.reminderState;
      await fetch(api(`/api/service-data/${encodeURIComponent(r.regNo)}`), {
        method:'PUT', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(clean),
      });
      await patchState(r, { closedAt:new Date().toISOString(), reason:'पूरा हुआ' });
      await fetch(api('/api/follow-ups'), {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ reminderId:r.id, customerName:r.customerName, phone:r.customerPhone, regNo:r.regNo, date:new Date().toISOString(), status:'done', note, by:'Admin' }),
      });
      setSyncMsg('✅ सेव हुआ — सभी devices पर दिखेगा, notification बंद');
    } catch { setSyncMsg('⚠️ सिर्फ़ इस phone पर सेव हुआ'); }
    setTimeout(() => setSyncMsg(''), 4000);

    setShowDone(false); setActiveR(null);
    setDoneForm({ km:'', date:todayISO(), amount:'', remarks:'' });
    window.dispatchEvent(new Event('storage'));
    loadAll();
  };

  const submitFollowUp = async () => {
    if (!activeR) return;
    const entry = { date:new Date().toISOString(), status:fuForm.status, note:fuForm.note || '—', nextCallDate:fuForm.nextCallDate || null, by:'Admin' };
    const u = { ...followUps }; if (!u[activeR.id]) u[activeR.id] = [];
    u[activeR.id].push(entry);
    setFollowUps(u); setLS('followUpLog', u);
    try {
      await fetch(api('/api/follow-ups'), {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ reminderId:activeR.id, customerName:activeR.customerName, phone:activeR.customerPhone, regNo:activeR.regNo, ...entry }),
      });
    } catch {}
    // "बाद में" चुना तो अगली call तक notification रोक दें
    if (fuForm.nextCallDate) {
      await patchState(activeR, { snoozeUntil:new Date(fuForm.nextCallDate).toISOString(), reason:'अगली call की तारीख़ तय' });
    }
    setShowFU(false); setFuForm({ status:'called', note:'', nextCallDate:'' }); setActiveR(null);
    setSyncMsg('✅ Follow-up सेव हुआ'); setTimeout(() => setSyncMsg(''), 2500);
    loadAll();
  };

  // ── Insurance date ठीक करें (⚠️ पुराने code में यहाँ loadReminders() था जो
  //    मौजूद ही नहीं था — click करते ही crash होता था) ──────────────────────
  const editInsuranceDate = async (r) => {
    const newDate = window.prompt(
      `📅 Insurance की असली शुरुआत तारीख़ (YYYY-MM-DD):\n\nअभी: ${r.insuranceStartDate || 'तय नहीं'}${r.isEstimated ? '  (यह सिर्फ़ अनुमान है)' : ''}\n\nआम तौर पर गाड़ी खरीदने के 2–3 दिन बाद की तारीख़`,
      r.isEstimated ? '' : (r.insuranceStartDate || '')
    );
    if (!newDate) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) { window.alert('गलत format.\nसही: YYYY-MM-DD\nजैसे: 2025-04-15'); return; }
    localStorage.setItem(`vp_ins_${r.regNo}`, newDate);
    const sd = getLS('customerServiceData', {});
    if (!sd[r.regNo]) sd[r.regNo] = {};
    sd[r.regNo].insuranceStartDate = newDate;
    setLS('customerServiceData', sd);
    try {
      const clean = { ...sd[r.regNo] }; delete clean.reminderState;
      await fetch(api(`/api/service-data/${encodeURIComponent(r.regNo)}`), {
        method:'PUT', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(clean),
      });
      setSyncMsg('✅ तारीख़ सेव हुई — अब यह reminder पक्का है');
    } catch { setSyncMsg('⚠️ सिर्फ़ इस phone पर सेव हुई'); }
    setTimeout(() => setSyncMsg(''), 3500);
    loadAll();
  };

  const editPaymentDueDate = async (r) => {
    const d = window.prompt('📅 भुगतान की तारीख़ (YYYY-MM-DD):', todayISO());
    if (!d) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { window.alert('सही format: YYYY-MM-DD'); return; }
    const sd = getLS('customerServiceData', {});
    if (!sd[r.regNo]) sd[r.regNo] = {};
    sd[r.regNo].paymentDueDate = d;
    setLS('customerServiceData', sd);
    try {
      const clean = { ...sd[r.regNo] }; delete clean.reminderState;
      await fetch(api(`/api/service-data/${encodeURIComponent(r.regNo)}`), {
        method:'PUT', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(clean),
      });
      setSyncMsg('✅ तारीख़ सेव हुई');
    } catch { setSyncMsg('⚠️ सिर्फ़ इस phone पर'); }
    setTimeout(() => setSyncMsg(''), 3000);
    loadAll();
  };

  // ── MongoDB में duplicate हमेशा के लिए साफ़ करें ─────────────────────────
  const runCleanup = async () => {
    setCleaning(true);
    try {
      const pv = await fetch(api('/api/service-data/duplicates'));
      if (!pv.ok) throw new Error('preview failed');
      const d = await pv.json();
      if (!d.duplicateGroups) {
        window.alert('✅ MongoDB में कोई duplicate record नहीं मिला.');
        setCleaning(false); return;
      }
      const sample = (d.groups || []).slice(0, 6)
        .map(g => `  • ${g.customerName} → रखेंगे ${g.keep}${g.keepIsRealReg ? '' : ' (नंबर दर्ज नहीं)'}\n     हटेंगे: ${g.dropKeys.join(', ')}`)
        .join('\n');
      const okGo = window.confirm(
        `🧹 डुप्लिकेट साफ़ करें?\n\n` +
        `कुल records: ${d.totalRecords}\n` +
        `बिना असली नंबर वाले: ${d.junkKeyRecords}\n` +
        `डुप्लिकेट गाड़ियाँ: ${d.duplicateGroups}\n` +
        `हटने वाले records: ${d.recordsToRemove}\n\n` +
        `${sample}${d.duplicateGroups > 6 ? `\n  …और ${d.duplicateGroups - 6} और` : ''}\n\n` +
        `⚠️ कोई जानकारी मिटेगी नहीं — सारे records की जानकारी एक में जोड़ दी जाएगी ` +
        `और तारीख़ों में हमेशा नई तारीख़ रखी जाएगी.\n\nआगे बढ़ें?`
      );
      if (!okGo) { setCleaning(false); return; }
      const res = await fetch(api('/api/service-data/dedupe'), { method:'POST' });
      const out = await res.json();
      window.alert(out.ok ? `✅ ${out.message}` : `⚠️ ${out.error || 'नहीं हो पाया'}`);
      localStorage.removeItem('customerServiceData');
    } catch (e) {
      window.alert('⚠️ नहीं हो पाया: ' + e.message + '\n\nBackend जागा हुआ है? कुछ देर बाद फिर कोशिश करें.');
    }
    setCleaning(false);
    setLoading(true); loadAll();
  };

  // ══════════════════════════════════════════════════════════════════════════
  // FILTER + GROUP BY CUSTOMER
  // ══════════════════════════════════════════════════════════════════════════
  const active = useMemo(() => reminders.filter(r => !r.closed && !r.snoozed), [reminders]);
  const parked = useMemo(() => reminders.filter(r => r.closed || r.snoozed), [reminders]);

  const cnt = fn => active.filter(fn).length;
  const FILTERS = [
    { t:'all',  l:'सभी',          n:active.length,                               c:'#2563eb' },
    { t:'over', l:'🚨 Overdue',   n:cnt(r => r.daysRemaining !== null && r.daysRemaining < 0), c:'#dc2626' },
    { t:'pay',  l:'💳 Payment',   n:cnt(r => r.type === 'payment'),              c:'#059669' },
    { t:'ins',  l:'🚗 RTO',       n:cnt(r => r.type === 'insurance'),            c:'#7c3aed' },
    { t:'insr', l:'🛡️ Insurance', n:cnt(r => r.type === 'insurance-renewal'),    c:'#DC0000' },
    { t:'svc',  l:'🔧 सर्विस',     n:cnt(r => r.type === 'service'),              c:'#ea580c' },
    { t:'fix',  l:'⚠️ तारीख़ चाहिए', n:cnt(r => r.needsDate),                     c:'#d97706' },
  ];

  const filtered = useMemo(() => active.filter(r => {
    if (filterType === 'over' && !(r.daysRemaining !== null && r.daysRemaining < 0)) return false;
    if (filterType === 'pay'  && r.type !== 'payment') return false;
    if (filterType === 'ins'  && r.type !== 'insurance') return false;
    if (filterType === 'insr' && r.type !== 'insurance-renewal') return false;
    if (filterType === 'svc'  && r.type !== 'service') return false;
    if (filterType === 'fix'  && !r.needsDate) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return [r.customerName, r.customerPhone, r.vehicle, r.regNo].some(v => (v || '').toLowerCase().includes(s));
    }
    return true;
  }), [active, filterType, searchTerm]);

  // ⭐ ग्राहक-वार grouping — एक कार्ड = एक ग्राहक (यही "3-3 reminder" का हल है)
  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach(r => {
      const key = `${(r.customerPhone || '').replace(/\D/g, '').slice(-10)}|${r.customerName}`;
      if (!map.has(key)) map.set(key, { key, name:r.customerName, phone:r.customerPhone, items:[] });
      map.get(key).items.push(r);
    });
    const arr = [...map.values()];
    arr.forEach(g => {
      g.items.sort((a, b) => {
        const aN = a.daysRemaining === null, bN = b.daysRemaining === null;
        if (aN !== bN) return aN ? 1 : -1;
        if (aN && bN) return 0;
        return a.daysRemaining - b.daysRemaining;
      });
      g.head = g.items[0];
      g.worst = Math.min(...g.items.map(i => i.daysRemaining === null ? 9999 : i.daysRemaining));
      // header में सिर्फ़ असली गाड़ी नंबर दिखाओ
      g.vehicles = [...new Set(g.items.map(i => i.regNo).filter(isRealRegNo).map(normKey))];
      g.noRegCount = g.items.filter(i => !isRealRegNo(i.regNo)).length;
    });
    return arr.sort((a, b) => a.worst - b.worst);
  }, [filtered]);

  const pages = Math.ceil(groups.length / GROUPS_PER_PAGE) || 1;
  const pageGroups = groups.slice((currentPage - 1) * GROUPS_PER_PAGE, currentPage * GROUPS_PER_PAGE);
  const ticker = active.filter(r => r.daysRemaining !== null && r.daysRemaining <= 0);

  // ══════════════════════════════════════════════════════════════════════════
  // NOTIFICATION DEEP LINK — ?rid=... से सीधे उसी reminder पर
  // ══════════════════════════════════════════════════════════════════════════
  const focusTarget = useMemo(() => {
    if (!focusRid) return null;
    return reminders.find(r => r.id === focusRid) || null;
  }, [focusRid, reminders]);

  useEffect(() => {
    if (!focusRid || !reminders.length) return;
    const target = reminders.find(r => r.id === focusRid);
    if (!target) return;
    const gkey = `${(target.customerPhone || '').replace(/\D/g, '').slice(-10)}|${target.customerName}`;
    setSearchTerm(''); setFilterType('all'); setOpenGroup(gkey);
    const idx = groups.findIndex(g => g.key === gkey);
    if (idx >= 0) setCurrentPage(Math.floor(idx / GROUPS_PER_PAGE) + 1);
    const t = setTimeout(() => {
      const el = document.getElementById(`rem-${focusRid}`);   // ⭐ अब id पक्की और अनोखी है
      if (el) {
        el.scrollIntoView({ behavior:'smooth', block:'center' });
        el.style.boxShadow = '0 0 0 3px #fbbf24, 0 0 30px rgba(251,191,36,.5)';
        setTimeout(() => { el.style.boxShadow = ''; }, 5000);
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRid, reminders.length]);

  // पुराने notification (सिर्फ़ ?focus=नाम) के लिए fallback
  useEffect(() => {
    if (focusRid || !focusName) return;
    setSearchTerm(focusName); setFilterType('all'); setCurrentPage(1);
  }, [focusRid, focusName]);

  const clearFocus = () => {
    const n = new URLSearchParams(searchParams);
    n.delete('rid'); n.delete('focus'); n.delete('phone'); n.delete('type');
    setSearchParams(n, { replace:true });
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const S = {
    page:{ minHeight:'100vh', background:'linear-gradient(135deg,#050d1a 0%,#0a1628 50%,#0d1f35 100%)', fontFamily:"system-ui,'Segoe UI',sans-serif" },
    hdr:{ background:'rgba(5,13,26,.92)', backdropFilter:'blur(16px)', borderBottom:'1px solid rgba(255,255,255,.06)', padding:'13px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12, position:'sticky', top:0, zIndex:20 },
    card:c => ({ background:c ? 'linear-gradient(135deg,rgba(127,29,29,.2),rgba(10,16,30,.97))' : 'linear-gradient(135deg,rgba(30,41,59,.65),rgba(10,16,30,.97))', border:`1px solid ${c ? 'rgba(239,68,68,.22)' : 'rgba(255,255,255,.06)'}`, borderRadius:18, overflow:'hidden', marginBottom:11, transition:'box-shadow .3s' }),
    btn:(bg, sh) => ({ background:bg, border:'none', borderRadius:10, padding:'7px 11px', fontSize:11, fontWeight:700, color:'#fff', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5, boxShadow:sh || 'none', textDecoration:'none', whiteSpace:'nowrap' }),
    inp:{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)', borderRadius:14, padding:'10px 16px 10px 40px', color:'#fff', fontSize:13, width:'100%', outline:'none', boxSizing:'border-box' },
    modal:{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', backdropFilter:'blur(8px)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 },
    mbox:{ background:'linear-gradient(135deg,#1e293b,#0f172a)', border:'1px solid rgba(255,255,255,.1)', borderRadius:22, width:'100%', maxWidth:460, padding:22, maxHeight:'90vh', overflowY:'auto' },
    fld:{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:11, padding:'10px 12px', color:'#fff', fontSize:13, width:'100%', outline:'none', boxSizing:'border-box' },
  };

  if (loading) return (
    <div style={{ ...S.page, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14 }}>
      <img src="/logo.png" alt="VP Honda" width={80} height={80} style={{ width:80, height:80, objectFit:'contain', animation:'pl 1.4s ease-in-out infinite' }}/>
      <p style={{ color:'#63b3ed', fontSize:13, fontWeight:700, letterSpacing:1 }}>Reminders लोड हो रहे हैं…</p>
      <style>{`@keyframes pl{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(.93)}}`}</style>
    </div>
  );

  // ── एक reminder row ───────────────────────────────────────────────────────
  const ReminderRow = ({ r, solo }) => {
    const meta  = TYPE_META[r.type] || { color:'#64748b', label:r.type };
    const fups  = followUps[r.id] || [];
    const last  = fups[fups.length - 1];
    const isLog = expandedLog === r.id;
    const over  = r.daysRemaining !== null && r.daysRemaining < 0;
    const isFocus = focusRid === r.id;

    return (
      <div id={`rem-${r.id}`} style={{
        background: isFocus ? 'rgba(251,191,36,.07)' : 'rgba(255,255,255,.025)',
        border:`1px solid ${isFocus ? 'rgba(251,191,36,.45)' : `${meta.color}33`}`,
        borderLeft:`3px solid ${meta.color}`, borderRadius:13, padding:'11px 13px',
        marginTop: solo ? 0 : 8, transition:'box-shadow .3s',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, flexWrap:'wrap' }}>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', marginBottom:3 }}>
              <span style={{ color:'#f1f5f9', fontWeight:800, fontSize:13 }}>{r.title}</span>
              {/* ⚠️ पहले यहाँ सीधा r.regNo छपता था — इसलिए screen पर
                  "imported-1781592279008" और "69df9c0e…" जैसे कचरा दिखते थे.
                  अब असली नंबर हो तो वही, वरना गाड़ी का नाम. */}
              {isRealRegNo(r.regNo)
                ? <span style={{ color:'#94a3b8', fontSize:10, fontFamily:'monospace', letterSpacing:.4 }}>{normKey(r.regNo)}</span>
                : <span style={{ background:'rgba(148,163,184,.1)', border:'1px solid rgba(148,163,184,.25)', color:'#94a3b8', fontSize:9, fontWeight:600, padding:'1px 7px', borderRadius:20 }}>
                    ⚠️ नंबर दर्ज नहीं
                  </span>}
              {r.mergedFrom?.length > 0 && (
                <span title={`${r.mergedFrom.length} डुप्लिकेट record जोड़े गए`}
                  style={{ background:'rgba(56,189,248,.1)', border:'1px solid rgba(56,189,248,.28)', color:'#7dd3fc', fontSize:9, fontWeight:700, padding:'1px 7px', borderRadius:20 }}>
                  🔗 {r.mergedFrom.length + 1} records जुड़े
                </span>
              )}
              {r.isEstimated && <span style={{ background:'rgba(251,191,36,.12)', border:'1px solid rgba(251,191,36,.32)', color:'#fbbf24', fontSize:9, fontWeight:700, padding:'1px 7px', borderRadius:20 }}>⚠️ अनुमान — notify नहीं</span>}
              {r.needsDate && !r.isEstimated && <span style={{ background:'rgba(251,191,36,.12)', border:'1px solid rgba(251,191,36,.32)', color:'#fbbf24', fontSize:9, fontWeight:700, padding:'1px 7px', borderRadius:20 }}>⚠️ तारीख़ नहीं</span>}
              {r.callCount > 0 && <span style={{ background:'rgba(255,255,255,.05)', color:'#94a3b8', fontSize:9, fontWeight:700, padding:'1px 7px', borderRadius:20 }}>📞 {r.callCount}</span>}
            </div>
            <p style={{ color:'#64748b', fontSize:11, margin:0 }}>{r.description}</p>
            {last?.note && last.note !== '—' && (
              <p style={{ color:'#94a3b8', fontSize:10, fontStyle:'italic', margin:'5px 0 0', paddingLeft:8, borderLeft:'2px solid rgba(139,92,246,.35)' }}>
                💬 “{last.note}” <span style={{ color:'#334155' }}>— {fmtDate(last.date)}</span>
              </p>
            )}
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            {r.daysRemaining === null ? (
              <span style={{ fontSize:11, fontWeight:800, color:'#fbbf24' }}>तारीख़ तय नहीं</span>
            ) : (
              <>
                <span style={{ fontSize:21, fontWeight:900, lineHeight:1, display:'block', color: over ? '#ef4444' : r.daysRemaining === 0 ? '#ef4444' : '#facc15' }}>
                  {Math.abs(r.daysRemaining)}
                </span>
                <span style={{ fontSize:8, fontWeight:700, color:'#475569', textTransform:'uppercase' }}>
                  {over ? 'दिन ऊपर' : r.daysRemaining === 0 ? 'आज!' : 'दिन बाक़ी'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:10 }}>
          {r.customerPhone && <a href={`tel:${r.customerPhone}`} style={S.btn('linear-gradient(135deg,#16a34a,#15803d)')}><Phone size={10}/> Call</a>}
          {r.customerPhone && <a href={`https://wa.me/91${(r.customerPhone||'').replace(/\D/g,'').slice(-10)}?text=${getWAMessage(r)}`} target="_blank" rel="noreferrer" style={S.btn('linear-gradient(135deg,#059669,#047857)')}><MessageSquare size={10}/> WhatsApp</a>}

          {/* ⭐ हर type पर "पूरा हुआ" */}
          <button onClick={() => { setActiveR(r); setDoneForm({ km:'', date:todayISO(), amount: r.type === 'payment' ? String(r.amount || '') : '', remarks:'' }); setShowDone(true); }}
            style={S.btn('linear-gradient(135deg,#ea580c,#c2410c)')}>
            <CheckCircle size={10}/> पूरा हुआ
          </button>

          <button onClick={() => { setActiveR(r); setShowFU(true); }} style={S.btn('linear-gradient(135deg,#7c3aed,#6d28d9)')}>
            <PhoneCall size={10}/> Log
          </button>

          {/* ⭐ बाद में — तब तक notification बंद */}
          <div style={{ display:'inline-flex', gap:3, alignItems:'center', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'3px 6px' }}>
            <Clock size={10} color="#94a3b8"/>
            <span style={{ color:'#64748b', fontSize:10, fontWeight:700 }}>बाद में</span>
            {[7, 15, 30].map(d => (
              <button key={d} onClick={() => snooze(r, d)} style={{ background:'rgba(255,255,255,.06)', border:'none', borderRadius:6, color:'#cbd5e1', fontSize:10, fontWeight:700, padding:'2px 6px', cursor:'pointer' }}>{d}d</button>
            ))}
          </div>

          {r.type === 'insurance-renewal' && (
            <button onClick={() => editInsuranceDate(r)} style={S.btn(r.isEstimated ? 'linear-gradient(135deg,#d97706,#b45309)' : 'linear-gradient(135deg,#0369a1,#0284c7)')}>
              ✏️ तारीख़ {r.isEstimated ? 'भरें' : 'बदलें'}
            </button>
          )}
          {r.type === 'payment' && r.needsDate && (
            <button onClick={() => editPaymentDueDate(r)} style={S.btn('linear-gradient(135deg,#d97706,#b45309)')}>✏️ तारीख़ भरें</button>
          )}

          {/* ⭐ गलत reminder — हमेशा के लिए बंद */}
          <button onClick={() => { if (window.confirm(`“${r.title}” को हमेशा के लिए बंद करें?\n\nयह reminder और इसकी notification दोबारा नहीं आएगी.\nबाद में "बंद किए हुए" list से वापस चालू कर सकते हैं.`)) closeReminder(r, 'गलत reminder'); }}
            style={S.btn('linear-gradient(135deg,#475569,#334155)')}>
            <X size={10}/> गलत है
          </button>

          <button onClick={() => navigate(`/customer-profile/${r.customerId}`)} style={S.btn('linear-gradient(135deg,#1e293b,#0f172a)')}>
            <Eye size={10}/> प्रोफ़ाइल
          </button>

          {fups.length > 0 && (
            <button onClick={() => setExpandedLog(isLog ? null : r.id)} style={{ background:'none', border:'1px solid rgba(34,197,94,.2)', borderRadius:10, padding:'6px 10px', color:'#4ade80', fontSize:10, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:4 }}>
              <TrendingUp size={10}/> {fups.length} call log {isLog ? '▲' : '▼'}
            </button>
          )}
        </div>

        {isLog && fups.length > 0 && (
          <div style={{ marginTop:10, background:'rgba(0,0,0,.3)', borderRadius:12, padding:12, border:'1px solid rgba(255,255,255,.05)' }}>
            {fups.slice().reverse().map((f, i) => (
              <div key={i} style={{ display:'flex', gap:10, padding:'6px 0', borderBottom: i < fups.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
                <div style={{ minWidth:60, flexShrink:0 }}>
                  <div style={{ color:'#64748b', fontSize:9 }}>{fmtDate(f.date)}</div>
                  <div style={{ color:'#334155', fontSize:8 }}>{fmtTime(f.date)}</div>
                </div>
                <div style={{ flex:1 }}>
                  <span style={{ fontWeight:700, fontSize:10, color:(CALL_STATUS.find(c => c.value === f.status)?.color) || '#10b981' }}>
                    {CALL_STATUS.find(c => c.value === f.status)?.label || (f.status === 'done' ? '✅ पूरा हुआ' : f.status)}
                  </span>
                  {f.note && f.note !== '—' && <div style={{ color:'#94a3b8', fontSize:10, marginTop:2 }}>💬 {f.note}</div>}
                  {f.nextCallDate && <div style={{ color:'#fdba74', fontSize:9, marginTop:2 }}>📅 अगली: {fmtDate(f.nextCallDate)}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={S.page}>
      <style>{`
        @keyframes tk{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}
        @keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @media (prefers-reduced-motion: reduce){*{animation:none!important}}
      `}</style>

      {/* URGENT TICKER */}
      {ticker.length > 0 && (
        <div style={{ background:'linear-gradient(90deg,#7f1d1d,#991b1b)', overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', height:32 }}>
            <span style={{ background:'rgba(0,0,0,.4)', padding:'0 12px', height:'100%', display:'flex', alignItems:'center', gap:5, fontSize:10, fontWeight:900, color:'#fca5a5', flexShrink:0 }}>
              <AlertTriangle size={10}/> ज़रूरी {ticker.length}
            </span>
            <div style={{ overflow:'hidden', flex:1 }}>
              <div style={{ display:'flex', gap:26, whiteSpace:'nowrap', animation:'tk 45s linear infinite' }}>
                {ticker.map((r, i) => (
                  <span key={i} style={{ fontSize:11, color:'#fecaca', fontWeight:600 }}>
                    🚨 {r.customerName} — {r.title} — {Math.abs(r.daysRemaining)}d ऊपर •
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={S.hdr}>
        <div style={{ display:'flex', alignItems:'center', gap:11 }}>
          <img src="/logo.png" alt="VP Honda" width={36} height={36} style={{ width:36, height:36, objectFit:'contain' }}/>
          <div>
            <h1 style={{ color:'#f1f5f9', fontSize:18, fontWeight:800, margin:0 }}>Reminders</h1>
            <p style={{ color:'#475569', fontSize:11, margin:'2px 0 0' }}>{greet()} · {fmtTime(lastRefresh)} पर अपडेट</p>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:9, flexWrap:'wrap' }}>
          {syncMsg && <span style={{ fontSize:11, fontWeight:700, color:'#4ade80', background:'rgba(74,222,128,.1)', border:'1px solid rgba(74,222,128,.2)', padding:'4px 10px', borderRadius:20 }}>{syncMsg}</span>}
          <button onClick={() => { setLoading(true); loadAll(); }} style={S.btn('linear-gradient(135deg,#3b82f6,#1d4ed8)')}><RefreshCw size={12}/> Refresh</button>
        </div>
      </div>

      <div style={{ padding:'16px 18px 50px', maxWidth:1100, margin:'0 auto' }}>

        {/* ⭐ NOTIFICATION से आया — सीधा उसी reminder पर */}
        {focusRid && (
          <div style={{ background: focusTarget ? 'linear-gradient(135deg,rgba(251,191,36,.14),rgba(251,191,36,.04))' : 'rgba(100,116,139,.12)', border:`1px solid ${focusTarget ? 'rgba(251,191,36,.4)' : 'rgba(100,116,139,.3)'}`, borderRadius:14, padding:'12px 15px', marginBottom:14, display:'flex', alignItems:'center', gap:11, flexWrap:'wrap', animation:'fi .3s ease' }}>
            <Bell size={18} color={focusTarget ? '#fbbf24' : '#94a3b8'}/>
            <div style={{ flex:1, minWidth:180 }}>
              {focusTarget ? (
                <>
                  <p style={{ color:'#fde68a', fontWeight:800, fontSize:13, margin:0 }}>
                    Notification से खुला — {focusTarget.customerName}
                  </p>
                  <p style={{ color:'#94a3b8', fontSize:11, margin:'2px 0 0' }}>
                    {focusTarget.title}
                    {focusTarget.closed && ' · यह पहले ही पूरा किया जा चुका है'}
                    {focusTarget.snoozed && ' · यह अभी टाला हुआ है'}
                  </p>
                </>
              ) : (
                <p style={{ color:'#cbd5e1', fontWeight:700, fontSize:12, margin:0 }}>
                  यह reminder अब list में नहीं है — शायद पूरा हो चुका है या तारीख़ बदल गई.
                </p>
              )}
            </div>
            <button onClick={clearFocus} style={S.btn('rgba(255,255,255,.08)')}>सब reminders दिखाएँ</button>
          </div>
        )}

        {/* ⭐ डुप्लिकेट चेतावनी + सफ़ाई */}
        {dupInfo.length > 0 && (
          <div style={{ background:'linear-gradient(135deg,rgba(56,189,248,.13),rgba(56,189,248,.04))', border:'1px solid rgba(56,189,248,.35)', borderRadius:14, padding:'12px 15px', marginBottom:14, display:'flex', alignItems:'center', gap:11, flexWrap:'wrap' }}>
            <span style={{ fontSize:20 }}>🔗</span>
            <div style={{ flex:1, minWidth:190 }}>
              <p style={{ color:'#7dd3fc', fontWeight:800, fontSize:12.5, margin:0 }}>
                {dupInfo.length} गाड़ियों के डुप्लिकेट record मिले — यहाँ जोड़ दिए
              </p>
              <p style={{ color:'#64748b', fontSize:10.5, margin:'3px 0 0' }}>
                एक ही गाड़ी के कई record थे (imported-…, ObjectId, बड़े-छोटे अक्षर). इसीलिए एक ही reminder 2-3 बार दिख रहा था.
                यह सफ़ाई अभी सिर्फ़ इस phone पर है — MongoDB में पक्का करने के लिए नीचे का बटन दबाएँ.
              </p>
            </div>
            <button onClick={runCleanup} disabled={cleaning} style={{ ...S.btn('linear-gradient(135deg,#0284c7,#0369a1)'), opacity:cleaning ? .6 : 1, padding:'9px 14px', fontSize:12 }}>
              {cleaning ? '⏳ हो रहा है…' : '🧹 MongoDB में पक्का करें'}
            </button>
          </div>
        )}

        {/* NOTIFICATION PERMISSION */}
        {notifStatus !== 'granted' && (
          <div style={{ background:'linear-gradient(135deg,#1e3a8a22,#1e3a8a08)', border:'1px solid #3b82f655', borderRadius:12, padding:'11px 15px', marginBottom:14, display:'flex', alignItems:'center', gap:11, flexWrap:'wrap' }}>
            <span style={{ fontSize:22 }}>🔔</span>
            <div style={{ flex:1, minWidth:180 }}>
              <p style={{ color:'#bfdbfe', fontWeight:700, fontSize:12.5, margin:0 }}>
                {notifStatus === 'denied' ? 'Phone notifications बंद हैं' : 'Phone पर reminder पाना चाहते हैं?'}
              </p>
              <p style={{ color:'#64748b', fontSize:10.5, margin:'2px 0 0' }}>
                {notifStatus === 'denied' ? 'Chrome → Settings → Site settings → Notifications से चालू करें' : 'App बंद होने पर भी reminder मिलेंगे'}
              </p>
            </div>
            {notifStatus !== 'denied' && (
              <button onClick={async () => { const ok = await requestNotificationPermission(); setNotifStatus(ok ? 'granted' : Notification.permission); }}
                style={S.btn('linear-gradient(135deg,#3b82f6,#1d4ed8)')}>चालू करें</button>
            )}
          </div>
        )}

        {/* STATS */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:9, marginBottom:14 }}>
          {[
            { l:'कुल',        v:active.length,                                                  c:'#3b82f6' },
            { l:'ग्राहक',      v:groups.length,                                                  c:'#a855f7' },
            { l:'Overdue',    v:active.filter(r => r.daysRemaining !== null && r.daysRemaining < 0).length, c:'#ef4444' },
            { l:'तारीख़ चाहिए', v:active.filter(r => r.needsDate).length,                        c:'#f59e0b' },
            { l:'टाले हुए',    v:reminders.filter(r => r.snoozed).length,                        c:'#64748b' },
            { l:'बंद किए',     v:reminders.filter(r => r.closed).length,                         c:'#334155' },
          ].map(s => (
            <div key={s.l} style={{ background:`linear-gradient(135deg,${s.c}18,${s.c}06)`, border:`1px solid ${s.c}28`, borderRadius:14, padding:'11px 10px', textAlign:'center' }}>
              <div style={{ fontSize:21, fontWeight:900, color:s.c, lineHeight:1 }}>{s.v}</div>
              <div style={{ fontSize:10, color:'#64748b', fontWeight:700, marginTop:3 }}>{s.l}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom:14 }}><ReminderPushButton reminders={active.filter(r => r.notifiable)} /></div>

        {/* FILTERS */}
        <div style={{ display:'flex', gap:7, overflowX:'auto', paddingBottom:8, marginBottom:12 }}>
          {FILTERS.map(f => {
            const on = filterType === f.t;
            return (
              <button key={f.t} onClick={() => { setFilterType(f.t); setCurrentPage(1); }} style={{
                background: on ? f.c : 'rgba(255,255,255,.04)', border:`1px solid ${on ? f.c : 'rgba(255,255,255,.1)'}`,
                color:'#fff', borderRadius:11, padding:'7px 13px', fontSize:11.5, fontWeight:700,
                cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:6, opacity: on || f.n ? 1 : .45,
              }}>
                {f.l}<span style={{ background:'rgba(0,0,0,.25)', borderRadius:10, padding:'1px 6px', fontSize:10, fontWeight:900 }}>{f.n}</span>
              </button>
            );
          })}
        </div>

        {/* SEARCH */}
        <div style={{ position:'relative', marginBottom:14 }}>
          <Search size={14} color="#475569" style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
          <input value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="ग्राहक का नाम, phone, गाड़ी या नंबर खोजें…" style={S.inp}/>
        </div>

        {/* ── LIST — एक कार्ड = एक ग्राहक ── */}
        {groups.length === 0 ? (
          <div style={{ textAlign:'center', padding:'64px 20px' }}>
            <CheckCircle size={40} color="#22c55e" style={{ marginBottom:12 }}/>
            <p style={{ color:'#f1f5f9', fontWeight:800, fontSize:17, margin:'0 0 6px' }}>सब Clear! 🎉</p>
            <p style={{ color:'#475569', fontSize:13, margin:0 }}>इस filter में कोई pending reminder नहीं है।</p>
          </div>
        ) : (
          <>
            <p style={{ color:'#334155', fontSize:11, marginBottom:10, fontWeight:600 }}>
              {groups.length} ग्राहक · {filtered.length} reminders · पेज {currentPage}/{pages}
            </p>

            {pageGroups.map(g => {
              const open  = openGroup === g.key || g.items.length === 1;
              const multi = g.items.length > 1;
              const crit  = g.worst <= 0;
              return (
                <div key={g.key} style={S.card(crit)}>
                  {/* ग्राहक हेडर */}
                  <div onClick={() => multi && setOpenGroup(open && openGroup === g.key ? null : g.key)}
                    style={{ padding:'12px 15px', display:'flex', alignItems:'center', gap:11, cursor: multi ? 'pointer' : 'default', borderBottom: open ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
                    <div style={{ width:34, height:34, borderRadius:'50%', background:'linear-gradient(135deg,#3b82f6,#1d4ed8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>👤</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ color:'#f1f5f9', fontWeight:800, fontSize:14, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{g.name}</p>
                      <p style={{ color:'#64748b', fontSize:10.5, margin:'2px 0 0' }}>
                        {g.phone ? `📞 ${g.phone}` : 'phone नहीं'}
                        {g.vehicles.length > 0 && ` · ${g.vehicles.join(', ')}`}
                        {g.noRegCount > 0 && ` · ${g.noRegCount} बिना नंबर`}
                      </p>
                    </div>
                    {multi && (
                      <span style={{ background:'rgba(239,68,68,.14)', border:'1px solid rgba(239,68,68,.32)', color:'#fca5a5', fontSize:10.5, fontWeight:800, padding:'3px 9px', borderRadius:20, whiteSpace:'nowrap' }}>
                        {g.items.length} reminders
                      </span>
                    )}
                    {multi && (open ? <ChevronDown size={16} color="#64748b"/> : <ChevronRight size={16} color="#64748b"/>)}
                  </div>

                  {open ? (
                    <div style={{ padding:'10px 13px 13px' }}>
                      {g.items.map((r, i) => <ReminderRow key={r.id} r={r} solo={i === 0}/>)}
                    </div>
                  ) : (
                    <div style={{ padding:'0 15px 12px', display:'flex', gap:7, flexWrap:'wrap' }}>
                      {g.items.map(r => (
                        <span key={r.id} style={{ background:`${(TYPE_META[r.type]||{}).color}1c`, border:`1px solid ${(TYPE_META[r.type]||{}).color}44`, color:'#e2e8f0', fontSize:10.5, fontWeight:700, padding:'3px 9px', borderRadius:20 }}>
                          {r.title}
                          {isRealRegNo(r.regNo) ? ` · ${normKey(r.regNo)}` : ''}
                          {' · '}{r.daysRemaining === null ? 'तारीख़ नहीं' : r.daysRemaining < 0 ? `${Math.abs(r.daysRemaining)}d ऊपर` : `${r.daysRemaining}d`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {pages > 1 && (
              <div style={{ display:'flex', justifyContent:'center', gap:7, marginTop:16, flexWrap:'wrap' }}>
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={{ ...S.btn('rgba(255,255,255,.06)'), opacity: currentPage === 1 ? .4 : 1 }}>← पिछला</button>
                <span style={{ color:'#64748b', fontSize:12, alignSelf:'center', fontWeight:700 }}>{currentPage} / {pages}</span>
                <button disabled={currentPage === pages} onClick={() => setCurrentPage(p => p + 1)} style={{ ...S.btn('rgba(255,255,255,.06)'), opacity: currentPage === pages ? .4 : 1 }}>अगला →</button>
              </div>
            )}
          </>
        )}

        {/* ── बंद किए / टाले हुए ── */}
        {parked.length > 0 && (
          <div style={{ marginTop:26 }}>
            <button onClick={() => setShowClosed(v => !v)} style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)', borderRadius:12, padding:'10px 15px', color:'#94a3b8', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:8, width:'100%' }}>
              {showClosed ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
              बंद किए / टाले हुए reminders ({parked.length})
              <span style={{ color:'#475569', fontSize:10, fontWeight:600, marginLeft:'auto' }}>वापस चालू कर सकते हैं</span>
            </button>
            {showClosed && (
              <div style={{ marginTop:10, display:'grid', gap:7 }}>
                {parked.map(r => (
                  <div key={r.id} style={{ background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.06)', borderRadius:12, padding:'10px 13px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:170 }}>
                      <p style={{ color:'#cbd5e1', fontSize:12, fontWeight:700, margin:0 }}>{r.customerName} — {r.title}</p>
                      <p style={{ color:'#475569', fontSize:10, margin:'2px 0 0' }}>
                        {r.closed ? '🚫 बंद' : `⏰ ${fmtDate(r.stateInfo?.snoozeUntil)} तक टाला`}
                        {r.stateInfo?.reason ? ` · ${r.stateInfo.reason}` : ''}
                        {` · ${displayRegNo(r.regNo, r.vehicle)}`}
                      </p>
                    </div>
                    <button onClick={() => reopenReminder(r)} style={S.btn('linear-gradient(135deg,#0369a1,#0284c7)')}><RotateCcw size={10}/> वापस चालू</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ MODAL: पूरा हुआ ══ */}
      {showDone && activeR && (
        <div style={S.modal} onClick={() => setShowDone(false)}>
          <div style={S.mbox} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <h3 style={{ color:'#f1f5f9', fontWeight:800, fontSize:16, margin:0 }}>✅ पूरा हुआ</h3>
              <button onClick={() => setShowDone(false)} style={{ background:'rgba(255,255,255,.06)', border:'none', borderRadius:'50%', width:30, height:30, color:'#94a3b8', cursor:'pointer' }}><X size={15}/></button>
            </div>
            <p style={{ color:'#64748b', fontSize:12, margin:'0 0 16px' }}>
              {activeR.customerName} — {activeR.title}
              {` · ${displayRegNo(activeR.regNo, activeR.vehicle)}`}
            </p>

            <div style={{ display:'grid', gap:11 }}>
              <div>
                <label style={{ color:'#94a3b8', fontSize:11, fontWeight:700, display:'block', marginBottom:5 }}>
                  {activeR.type === 'insurance-renewal' ? 'नई Insurance शुरू होने की तारीख़' : activeR.type === 'payment' ? 'भुगतान मिलने की तारीख़' : activeR.type === 'insurance' ? 'RTO पूरा होने की तारीख़' : 'सर्विस की तारीख़'}
                </label>
                <input type="date" value={doneForm.date} onChange={e => setDoneForm(f => ({ ...f, date:e.target.value }))} style={S.fld}/>
              </div>

              {activeR.type === 'service' && (
                <div>
                  <label style={{ color:'#94a3b8', fontSize:11, fontWeight:700, display:'block', marginBottom:5 }}>KM Reading</label>
                  <input type="number" value={doneForm.km} onChange={e => setDoneForm(f => ({ ...f, km:e.target.value }))} placeholder="जैसे 4200" style={S.fld}/>
                </div>
              )}

              {activeR.type === 'payment' && (
                <div>
                  <label style={{ color:'#94a3b8', fontSize:11, fontWeight:700, display:'block', marginBottom:5 }}>
                    कितना मिला? (बकाया ₹{(activeR.amount || 0).toLocaleString('en-IN')})
                  </label>
                  <input type="number" value={doneForm.amount} onChange={e => setDoneForm(f => ({ ...f, amount:e.target.value }))} style={S.fld}/>
                  <p style={{ color:'#475569', fontSize:10, margin:'5px 0 0' }}>
                    पूरा मिल गया तो पूरी रक़म डालें. कम डालेंगे तो बाक़ी रक़म का reminder चलता रहेगा.
                  </p>
                </div>
              )}

              {activeR.type === 'insurance-renewal' && (
                <p style={{ color:'#fbbf24', fontSize:10.5, background:'rgba(251,191,36,.08)', border:'1px solid rgba(251,191,36,.2)', borderRadius:10, padding:'8px 11px', margin:0 }}>
                  ℹ️ नई तारीख़ से अगले साल का renewal reminder अपने आप बन जाएगा (11 महीने बाद).
                </p>
              )}

              <div>
                <label style={{ color:'#94a3b8', fontSize:11, fontWeight:700, display:'block', marginBottom:5 }}>टिप्पणी (वैकल्पिक)</label>
                <textarea value={doneForm.remarks} onChange={e => setDoneForm(f => ({ ...f, remarks:e.target.value }))} placeholder="कौन से parts लगे, कोई ख़ास बात…" rows={2} style={{ ...S.fld, resize:'vertical' }}/>
              </div>
            </div>

            <p style={{ color:'#4ade80', fontSize:10.5, background:'rgba(34,197,94,.07)', border:'1px solid rgba(34,197,94,.18)', borderRadius:10, padding:'8px 11px', margin:'14px 0 0' }}>
              ✅ सेव करते ही यह reminder बंद हो जाएगा और इसकी phone notification भी दोबारा नहीं आएगी.
            </p>

            <div style={{ display:'flex', gap:9, marginTop:14 }}>
              <button onClick={() => setShowDone(false)} style={{ flex:1, background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.09)', borderRadius:13, padding:11, color:'#94a3b8', fontSize:12, fontWeight:700, cursor:'pointer' }}>रद्द करें</button>
              <button onClick={submitDone} style={{ flex:1, background:'linear-gradient(135deg,#059669,#047857)', border:'none', borderRadius:13, padding:11, color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer' }}>✅ सेव करें</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Call log ══ */}
      {showFU && activeR && (
        <div style={S.modal} onClick={() => setShowFU(false)}>
          <div style={S.mbox} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <h3 style={{ color:'#f1f5f9', fontWeight:800, fontSize:16, margin:0 }}>📞 Call Log</h3>
              <button onClick={() => setShowFU(false)} style={{ background:'rgba(255,255,255,.06)', border:'none', borderRadius:'50%', width:30, height:30, color:'#94a3b8', cursor:'pointer' }}><X size={15}/></button>
            </div>
            <p style={{ color:'#64748b', fontSize:12, margin:'0 0 16px' }}>{activeR.customerName} — {activeR.title}</p>

            <label style={{ color:'#94a3b8', fontSize:11, fontWeight:700, display:'block', marginBottom:7 }}>क्या हुआ?</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:7, marginBottom:13 }}>
              {CALL_STATUS.map(c => (
                <button key={c.value} onClick={() => setFuForm(f => ({ ...f, status:c.value }))} style={{
                  background: fuForm.status === c.value ? c.color : 'rgba(255,255,255,.04)',
                  border:`1px solid ${fuForm.status === c.value ? c.color : 'rgba(255,255,255,.1)'}`,
                  color:'#fff', borderRadius:11, padding:'9px 8px', fontSize:11, fontWeight:700, cursor:'pointer',
                }}>{c.label}</button>
              ))}
            </div>

            <label style={{ color:'#94a3b8', fontSize:11, fontWeight:700, display:'block', marginBottom:5 }}>नोट</label>
            <textarea value={fuForm.note} onChange={e => setFuForm(f => ({ ...f, note:e.target.value }))} rows={2} placeholder="ग्राहक ने क्या कहा…" style={{ ...S.fld, resize:'vertical', marginBottom:11 }}/>

            <label style={{ color:'#94a3b8', fontSize:11, fontWeight:700, display:'block', marginBottom:5 }}>अगली call कब? (वैकल्पिक)</label>
            <input type="date" value={fuForm.nextCallDate} onChange={e => setFuForm(f => ({ ...f, nextCallDate:e.target.value }))} style={S.fld}/>
            <p style={{ color:'#475569', fontSize:10, margin:'5px 0 0' }}>
              तारीख़ डालेंगे तो तब तक इस reminder की notification नहीं आएगी.
            </p>

            <div style={{ display:'flex', gap:9, marginTop:14 }}>
              <button onClick={() => setShowFU(false)} style={{ flex:1, background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.09)', borderRadius:13, padding:11, color:'#94a3b8', fontSize:12, fontWeight:700, cursor:'pointer' }}>रद्द करें</button>
              <button onClick={submitFollowUp} style={{ flex:1, background:'linear-gradient(135deg,#7c3aed,#6d28d9)', border:'none', borderRadius:13, padding:11, color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer' }}>सेव करें</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
