// ════════════════════════════════════════════════════════════════════════════
// Dashboard.jsx — VP Honda Command Center (एकमात्र Dashboard)
// ════════════════════════════════════════════════════════════════════════════
// यह file इन 5 पुराने dashboards की जगह लेती है:
//   • Dashboard.jsx              (पुराना — KPI cards, charts, quick actions)
//   • VPHondaDashboard.jsx       (P&L, वर्ष/माह/दिन filter, alerts, payroll)
//   • ComprehensiveDashboard.jsx (invoice + parts inventory analytics)
//   • ManagerView.jsx            (आज का snapshot, mobile view)
//   • BusinessIntelligence.jsx   (predictions, targets, staff performance)
//
// सारी functionality यहीं tabs में है — कुछ भी हटाया नहीं गया.
// एक बार data fetch → सभी tabs उसी को use करते हैं (पहले 5 pages अलग-अलग
// fetch करते थे, यानी हर page पर 7–10 duplicate API calls).
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Users, Package, Bike,
  Bell, Zap, CreditCard, Shield, Wrench, Award, Calendar, Clock, CheckCircle,
  XCircle, ChevronRight, IndianRupee, Car, FileText, MessageSquare, Plus,
  Target, Brain, Phone, Activity, UserCheck,
} from 'lucide-react';
import { api } from '../utils/apiConfig';
import { visibleInterval } from '../utils/pollControl';
import { sendWhatsApp, getServiceSchedule, showInAppToast } from '../utils/smartUtils';
import PnlExcelImport from '../components/PnlExcelImport';

// ════════════════════════════════════════════════════════════════════════════
// HISTORICAL P&L — Excel Summary sheet से (VPHondaDashboard से preserve किया)
// Excel बदले तो यहीं update करें. App के अंदर से भी edit हो सकता है — वह
// localStorage में override के रूप में सेव होता है.
// ════════════════════════════════════════════════════════════════════════════
const BASE_SUMMARY_PL = [
  {m:"Sep",y:2024,veh:2,  access:11765,  rto:4958,   ins:2717, gift:0, accesory:0, rent:-8500,   other:0,       parts:0,      service:0,     pft:10940   },
  {m:"Oct",y:2024,veh:41, access:147794, rto:98345,  ins:68194, gift:-43559, accesory:-63118,rent:-90700,  other:-107675, parts:0,      service:0,     pft:9281    },
  {m:"Nov",y:2024,veh:9,  access:33270,  rto:24314,  ins:15704, gift:0, accesory:-26281, rent:-75180,  other:-2150,   parts:0,      service:0,     pft:-30323  },
  {m:"Dec",y:2024,veh:6,  access:23270,  rto:4334,   ins:9371, gift:-1400, accesory:-3153,  rent:-41500,  other:-79152,  parts:-20389, service:0,     pft:-108620 },
  {m:"Jan",y:2025,veh:10, access:39978,  rto:12657,  ins:16838, gift:-5029, accesory:-813, rent:-114150, other:-82375,  parts:-21569, service:4144,  pft:-150319 },
  {m:"Feb",y:2025,veh:6,  access:14576,  rto:16578,  ins:10730, gift:-19490, accesory:-20321, rent:-39173,  other:-90188,  parts:-31912, service:18799, pft:-140402 },
  {m:"Mar",y:2025,veh:14, access:61318,  rto:22328,  ins:23011, gift:-21728, accesory:-9081, rent:-80200,  other:-22250,  parts:-3496,  service:31078, pft:979     },
  {m:"Apr",y:2025,veh:13, access:35029,  rto:33580,  ins:15963, gift:-1520, accesory:-11822, rent:-57550,  other:-7050,   parts:-46028, service:26403, pft:-12995  },
  {m:"May",y:2025,veh:6,  access:9619,   rto:16242,  ins:7349, gift:-1000, accesory:-7031,  rent:-47100,  other:-6030,   parts:-52912, service:39742, pft:-41121  },
  {m:"Jun",y:2025,veh:8,  access:1394,   rto:500,    ins:13819, gift:-1000, accesory:24489, rent:-48400,  other:0,       parts:-3500,  service:19070, pft:-42606  },
  {m:"Jul",y:2025,veh:7,  access:27137,  rto:14811,  ins:8763, gift:-1000, accesory:3604,  rent:-51250,  other:-10960,  parts:-40522, service:23716, pft:-32909  },
  {m:"Aug",y:2025,veh:6,  access:26838,  rto:15382,  ins:9396, gift:-1000, accesory:-137094,  rent:-48600,  other:-6300,   parts:-3604,  service:31875, pft:-113106 },
  {m:"Sep",y:2025,veh:8,  access:24686,  rto:23973,  ins:16125, gift:-40400, accesory:-26206, rent:-137450, other:-24442,  parts:-24063, service:35565, pft:-152212 },
  {m:"Oct",y:2025,veh:50, access:126330, rto:112864, ins:94103, gift:0, accesory:-55362, rent:-79600,  other:-5344,   parts:-13037, service:30133, pft:210087  },
  {m:"Nov",y:2025,veh:7,  access:14162,  rto:19968,  ins:7038, gift:0, accesory:0,  rent:-42219,  other:-58153,  parts:-54714, service:58251, pft:-55667  },
  {m:"Dec",y:2025,veh:6,  access:33869,  rto:17274,  ins:8884, gift:0, accesory:0, rent:-78300,  other:-1890,   parts:-31076, service:37080, pft:-14159  },
  {m:"Jan",y:2026,veh:14, access:81672,  rto:41064,  ins:24053, gift:0, accesory:-26206, rent:-56532,  other:-9500,   parts:-28893, service:25733, pft:51392   },
  {m:"Feb",y:2026,veh:11, access:52607,  rto:32888,  ins:17586, gift:0, accesory:0, rent:-41580,  other:-42250,  parts:-60459, service:48965, pft:51639   },
  {m:"Mar",y:2026,veh:12, access:57337,  rto:35323,  ins:4332, gift:0, accesory:0, rent:-66095,  other:-3800,   parts:-23437, service:18171, pft:30023   },
  {m:"Apr",y:2026,veh:3,  access:4813,   rto:0,      ins:2571, gift:0, accesory:0, rent:-15800,  other:-0,   parts:-3838, service:0, pft:-12254   },
];

// ── Constants ────────────────────────────────────────────────────────────────
const LS_PL_OVERRIDES = 'vph_expense_overrides';   // पुरानी key — edits सुरक्षित रहेंगी
const LS_TARGETS      = 'vp_targets';              // पुरानी key — targets सुरक्षित रहेंगे

const MONTH_NUM = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
const MONTHS = ['All','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEARS  = ['All', 2024, 2025, 2026, 2027];
const DAYS   = ['All', ...Array.from({ length:31 }, (_, i) => i + 1)];

const C = {
  bg:'#020617', surface:'#0b1220', border:'#1e293b',
  red:'#DC0000', blue:'#3b82f6', green:'#22c55e', amber:'#f59e0b',
  purple:'#a855f7', cyan:'#06b6d4', rose:'#ef4444', text:'#f1f5f9', muted:'#94a3b8',
};
const PIE = ['#DC0000','#3b82f6','#22c55e','#f59e0b','#a855f7','#06b6d4','#84cc16','#e879f9'];

const TABS = [
  { id:'overview',  icon:'📊', label:'Overview',        hi:'आज का हाल' },
  { id:'profit',    icon:'💹', label:'Profit & Loss',   hi:'नफ़ा-नुक़सान' },
  { id:'vehicles',  icon:'🏍', label:'Vehicles',        hi:'गाड़ियाँ' },
  { id:'customers', icon:'👥', label:'Customers',       hi:'ग्राहक' },
  { id:'parts',     icon:'🔧', label:'Parts & Service', hi:'पार्ट्स' },
  { id:'payroll',   icon:'👔', label:'Payroll & Staff', hi:'वेतन' },
  { id:'insights',  icon:'🔮', label:'Insights',        hi:'भविष्यवाणी' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const getLS = (k, fb = []) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || fb; } catch { return fb; } };
const setLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const fmtINR = n => {
  const abs = Math.abs(n || 0), sg = (n || 0) < 0 ? '-' : '';
  if (abs >= 1e7) return `${sg}₹${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sg}₹${(abs / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${sg}₹${(abs / 1e3).toFixed(1)}K`;
  return `${sg}₹${Math.round(abs).toLocaleString('en-IN')}`;
};

// server से रोws आई हों तो वही, वरना ऊपर वाला hardcode डेटा (कुछ टूटे नहीं)
const buildSummaryPL = (ov, serverRows) => (serverRows?.length ? serverRows : BASE_SUMMARY_PL).map(row => {
  const o = ov[row.y + '-' + row.m] || {};
  const num = (k, d) => (o[k] !== undefined ? -Math.abs(Number(o[k])) : d);
  const gift = num('gift', row.gift), accesory = num('accesory', row.accesory);
  const rent = num('rent', row.rent), other = num('other', row.other), parts = num('parts', row.parts);
  return { ...row, gift, accesory, rent, other, parts,
    pft: row.access + row.rto + row.ins + row.service + gift + accesory + rent + other + parts };
});

// ── UI atoms ─────────────────────────────────────────────────────────────────
const Panel = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{
    background:'linear-gradient(135deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))',
    border:'1px solid rgba(255,255,255,0.09)', borderRadius:18, padding:20,
    cursor:onClick ? 'pointer' : 'default', ...style,
  }}>{children}</div>
);

const SH = ({ title, sub, action }) => (
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, gap:10 }}>
    <div>
      <h3 style={{ color:C.text, fontSize:14, fontWeight:800, margin:0 }}>{title}</h3>
      {sub && <p style={{ color:'#64748b', fontSize:11, margin:'3px 0 0' }}>{sub}</p>}
    </div>
    {action}
  </div>
);

const K = ({ icon:Icon, label, value, sub, color = C.blue, onClick, alert }) => {
  const neg = typeof value === 'number' && value < 0;
  const col = neg ? C.rose : color;
  return (
    <button type="button" onClick={onClick} disabled={!onClick} style={{
      textAlign:'left', width:'100%', font:'inherit',
      background:`linear-gradient(135deg, ${col}22, ${col}08)`,
      border:`1px solid ${col}40`, borderRadius:16, padding:'15px 17px',
      cursor:onClick ? 'pointer' : 'default', color:C.text, transition:'transform .2s',
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:9 }}>
        <div style={{ width:36, height:36, borderRadius:11, background:col, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {Icon ? <Icon size={17} color="#fff"/> : <span style={{ fontSize:17 }}>📊</span>}
        </div>
        {alert ? <span style={{ background:'#ef444422', border:'1px solid #ef444466', borderRadius:10, padding:'2px 8px', color:'#fca5a5', fontSize:10, fontWeight:700 }}>⚠ {alert}</span> : null}
      </div>
      <div style={{ fontSize:22, fontWeight:900, color:col, lineHeight:1.15 }}>
        {typeof value === 'number' && Math.abs(value) > 999 ? fmtINR(value) : value}
      </div>
      <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginTop:3 }}>{label}</div>
      {sub && <div style={{ fontSize:10, color:'#64748b', marginTop:2 }}>{sub}</div>}
    </button>
  );
};

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#0c1220', border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 14px', fontSize:12 }}>
      <p style={{ color:C.muted, margin:'0 0 5px', fontWeight:700 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color:p.color || C.text, margin:'2px 0' }}>
          {p.name}: <b>{typeof p.value === 'number' && Math.abs(p.value) > 999 ? fmtINR(p.value) : p.value}</b>
        </p>
      ))}
    </div>
  );
};

const Empty = ({ text }) => (
  <div style={{ padding:'30px 12px', textAlign:'center', color:'#475569', fontSize:12 }}>{text}</div>
);

const selectStyle = {
  background:C.surface, border:`1px solid ${C.border}`, color:C.text,
  padding:'7px 11px', borderRadius:9, fontSize:12, fontWeight:600, outline:'none',
};

// ════════════════════════════════════════════════════════════════════════════
export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  // ?tab=profit जैसे URL से सीधे उस tab पर खुलता है (Navbar/AdminPanel इसी का
  // इस्तेमाल करते हैं — पहले ये अलग-अलग pages थे).
  const [params, setParams] = useSearchParams();
  const urlTab = params.get('tab');
  const [tab, setTabState] = useState(
    TABS.some(t => t.id === urlTab) ? urlTab : 'overview'
  );
  const setTab = (id) => {
    setTabState(id);
    const next = new URLSearchParams(params);
    if (id === 'overview') next.delete('tab'); else next.set('tab', id);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const t = params.get('tab');
    if (t && TABS.some(x => x.id === t) && t !== tab) setTabState(t);
    if (!t && tab !== 'overview') setTabState('overview');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const [yr, setYr]           = useState('All');
  const [mo, setMo]           = useState('All');
  const [dy, setDy]           = useState('All');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [lastUpd, setLastUpd] = useState(null);

  // ── Data stores (एक बार fetch, सभी tabs share करते हैं) ──────────────────
  const [customers, setCustomers]         = useState([]);
  const [invoices, setInvoices]           = useState([]);
  const [parts, setParts]                 = useState([]);
  const [partHistory, setPartHistory]     = useState([]);
  const [staff, setStaff]                 = useState([]);
  const [salaries, setSalaries]           = useState([]);
  const [salaryEntities, setSalaryEntities] = useState([]);
  const [attendance, setAttendance]       = useState([]);
  const [serviceData, setServiceData]     = useState({});
  const [oldBikes, setOldBikes]           = useState([]);
  const [overrides, setOverrides]         = useState(() => getLS(LS_PL_OVERRIDES, {}));
  const [pnlRows,   setPnlRows]           = useState(null);   // server से आया P&L (null = अभी नहीं आया)
  const [showImport, setShowImport]       = useState(false);
  const pulseRef                          = useRef(null);   // आख़िरी बार की "मुहर"
  const [targets, setTargets]             = useState(() => getLS(LS_TARGETS, {}));

  // ── Load ─────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async (silent = false) => {
    if (silent) setBusy(true);
    const f = async (url, lsKey, fb = []) => {
      try {
        const r = await fetch(api(url));
        if (r.ok) {
          const d = await r.json();
          if (d && (Array.isArray(d) ? d.length > 0 : true)) {
            if (lsKey) setLS(lsKey, d);
            return d;
          }
        }
      } catch {}
      return lsKey ? getLS(lsKey, fb) : fb;
    };

    const today = new Date().toISOString().split('T')[0];
    const [cust, inv, prts, pHist, stf, sal, salEnts, att, sdArr, obk] = await Promise.all([
      f('/api/customers', 'sharedCustomerData'),
      f('/api/invoices', 'invoices'),
      f('/api/parts', 'partsInventory'),
      f('/api/parts/history/all', null, []),
      f('/api/staff', 'staffData'),
      f('/api/salaries', null, []),
      f('/api/salary-entities', null, []),
      f(`/api/attendance?date=${today}`, null, []),
      f('/api/service-data', null, []),
      f('/api/oldbikes', null, []),
    ]);

    setCustomers(cust);
    setInvoices([...(inv || []), ...getLS('generatedInvoices', [])]);
    setParts(prts);
    setPartHistory(pHist);
    setStaff(stf);
    setSalaries(sal);
    setSalaryEntities(salEnts);
    setAttendance(att);
    setOldBikes(obk);

    const sdMap = { ...getLS('customerServiceData', {}) };
    (Array.isArray(sdArr) ? sdArr : []).forEach(r => { if (r.regNo || r._id) sdMap[r.regNo || r._id] = r; });
    setServiceData(sdMap);

    // ⭐ महीने-वार P&L — अब server से. पहले यह पूरा डेटा code में hardcode था
    // (BASE_SUMMARY_PL) और नया महीना जोड़ने के लिए code बदलना पड़ता था.
    try {
      const r = await fetch(api('/api/pnl'));
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d) && d.length) setPnlRows(d);
      }
    } catch {}

    setLastUpd(new Date());
    setLoading(false);
    setBusy(false);
  }, []);

  useEffect(() => {
    loadAll();

    // ⏱️ Render का कोटा बचाने वाले तीन बदलाव:
    //
    // 1. tab पीछे जाते ही polling पूरी तरह रुकती है (visibleInterval),
    //    सामने आते ही एक बार तुरंत चलती है. यही सबसे बड़ी बचत है.
    //
    // 2. 30 सेकंड → 2 मिनट.
    //
    // 3. ⭐ सबसे ज़रूरी: पहले हर चक्र में **11 अलग-अलग endpoints** से पूरा
    //    डेटा आता था. अब पहले `/api/pulse` से सिर्फ़ एक छोटी "मुहर" आती है
    //    (कुछ सौ bytes). वह पिछली बार जैसी ही हो — यानी कुछ बदला ही नहीं —
    //    तो पूरा डेटा माँगा ही नहीं जाता. ज़्यादातर बार यही होता है.
    const stopPoll = visibleInterval(async () => {
      try {
        const r = await fetch(api('/api/pulse'));
        if (r.ok) {
          const p = await r.json();
          if (p.stamp && p.stamp === pulseRef.current) return;   // कुछ नया नहीं — रुक जाओ
          pulseRef.current = p.stamp;
        }
      } catch { /* pulse न चले तो नीचे पूरा load हो ही जाएगा */ }
      loadAll(true);
    }, 120000);

    const onSync = () => loadAll(true);
    window.addEventListener('storage', onSync);
    return () => { stopPoll(); window.removeEventListener('storage', onSync); };
  }, [loadAll]);

  // ── Universal date filter ────────────────────────────────────────────────
  const noFilter = yr === 'All' && mo === 'All' && dy === 'All';
  const matchDate = useCallback((dateStr) => {
    if (!dateStr) return noFilter;
    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) return false;
    if (yr !== 'All' && dt.getFullYear() !== Number(yr)) return false;
    if (mo !== 'All' && MONTH_NUM[mo] && dt.getMonth() + 1 !== MONTH_NUM[mo]) return false;
    if (dy !== 'All' && dt.getDate() !== Number(dy)) return false;
    return true;
  }, [yr, mo, dy, noFilter]);

  const filtInvoices = useMemo(() =>
    noFilter ? invoices : invoices.filter(i => matchDate(i.invoiceDate || i.date || i.importedAt)),
  [invoices, matchDate, noFilter]);

  const filtCustomers = useMemo(() =>
    noFilter ? customers : customers.filter(c => matchDate(c.invoiceDate || c.purchaseDate || c.createdAt)),
  [customers, matchDate, noFilter]);

  const amountOf = i => i.totals?.totalAmount || i.amount || i.price || 0;
  const vehInvoices = useMemo(() => filtInvoices.filter(i => i.invoiceType === 'vehicle' || amountOf(i) >= 50000), [filtInvoices]);
  const svcInvoices = useMemo(() => filtInvoices.filter(i => i.invoiceType !== 'vehicle' && amountOf(i) < 50000), [filtInvoices]);
  const vehInvTotal = useMemo(() => vehInvoices.reduce((s, i) => s + amountOf(i), 0), [vehInvoices]);
  const svcInvTotal = useMemo(() => svcInvoices.reduce((s, i) => s + amountOf(i), 0), [svcInvoices]);

  // ── P&L ──────────────────────────────────────────────────────────────────
  const plData = useMemo(() => buildSummaryPL(overrides, pnlRows).filter(r => {
    if (yr !== 'All' && r.y !== Number(yr)) return false;
    if (mo !== 'All' && r.m !== mo) return false;
    return true;
  }), [overrides, pnlRows, yr, mo]);

  const totalPft = plData.reduce((s, r) => s + r.pft, 0);
  const totalRev = plData.reduce((s, r) => s + r.access + r.rto + r.ins + r.service, 0);
  const totalExp = plData.reduce((s, r) => s + Math.abs(r.rent) + Math.abs(r.other) + Math.abs(r.parts) + Math.abs(r.gift) + Math.abs(r.accesory), 0);

  const saveOverride = (row, field, value) => {
    const next = { ...overrides, [row.y + '-' + row.m]: { ...(overrides[row.y + '-' + row.m] || {}), [field]: value } };
    setOverrides(next); setLS(LS_PL_OVERRIDES, next);

    // ⭐ Excel से आया डेटा हो तो बदलाव server पर भी जाए — वरना सिर्फ़ इसी
    // phone पर दिखता और दूसरे device पर पुराना ही रहता.
    if (pnlRows?.length) {
      const key = `${row.y}-${row.m}`;
      const upd = { ...row, [field]: -Math.abs(Number(value) || 0) };
      upd.pft = upd.access + upd.rto + upd.ins + upd.service + (upd.ew || 0)
              + upd.gift + upd.accesory + upd.rent + upd.other + upd.parts;
      fetch(api(`/api/pnl/${encodeURIComponent(key)}`), {
        method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(upd),
      }).catch(() => {});
      setPnlRows(rs => rs.map(r => (r.y === row.y && r.m === row.m ? upd : r)));
    }
  };

  // ── Vehicle models ───────────────────────────────────────────────────────
  const vehModels = useMemo(() => {
    const map = {};
    filtCustomers.forEach(c => {
      const m = (c.vehicleModel || c.linkedVehicle?.name || '').split(' ').slice(0, 2).join(' ');
      if (m) map[m] = (map[m] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
  }, [filtCustomers]);

  // ── Parts ────────────────────────────────────────────────────────────────
  const partStats = useMemo(() => {
    const filt = partHistory.filter(p => !p.reverted && matchDate(p.consumedAt || p.createdAt));
    const byName = {};
    filt.forEach(c => {
      const k = c.partName || c.partNumber || 'Unknown';
      if (!byName[k]) byName[k] = { name:k, qty:0, value:0 };
      byName[k].qty += c.quantity || 1;
      byName[k].value += c.totalValue || 0;
    });
    const all = Object.values(byName);
    return {
      top: all.sort((a, b) => b.qty - a.qty).slice(0, 8),
      totalQty: all.reduce((s, p) => s + p.qty, 0),
      totalValue: all.reduce((s, p) => s + p.value, 0),
      entries: filt.length,
    };
  }, [partHistory, matchDate]);

  const partsInv = useMemo(() => {
    const stockOf = p => Number(p.stock ?? p.quantity ?? 0);
    const out = parts.filter(p => stockOf(p) <= 0);
    const low = parts.filter(p => { const s = stockOf(p), m = Number(p.minStock || 0); return m > 0 && s > 0 && s <= m; });
    const stockValue = parts.reduce((s, p) => s + ((p.mrp || p.unitPrice || 0) * stockOf(p)), 0);
    return { out, low, stockValue, total: parts.length };
  }, [parts]);

  // ── Payroll + attendance ─────────────────────────────────────────────────
  const salStats = useMemo(() => {
    const filt = salaries.filter(s => !s.cancelled && matchDate(s.paymentDate));
    const sum = t => filt.filter(s => s.type === t).reduce((a, s) => a + (s.amount || 0), 0);
    const salary = sum('salary'), advance = sum('advance'), deduct = sum('deduction');
    const bonus = filt.filter(s => s.type === 'bonus' || s.type === 'incentive').reduce((a, s) => a + (s.amount || 0), 0);

    let totalDue = 0, activeCount = 0, rentDue = 0, rentCount = 0;
    if (salaryEntities.length > 0) {
      salaryEntities.filter(e => e.active).forEach(e => {
        if (e.type === 'staff') { totalDue += Number(e.monthlyAmount || 0); activeCount++; }
        else if (e.type === 'rent') { rentDue += Number(e.monthlyAmount || 0); rentCount++; }
      });
    } else {
      totalDue = staff.reduce((s, x) => s + Number(x.monthlySalary || 0), 0);
      activeCount = staff.length;
    }

    let totalPending = 0;
    salaryEntities.filter(e => e.active).forEach(e => {
      const start = new Date(e.startDate), today = new Date();
      const months = Math.max(0, (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth()) + (today.getDate() >= start.getDate() ? 1 : 0));
      const expected = (e.monthlyAmount || 0) * months;
      const paid = salaries.filter(p => !p.cancelled && p.staffName === e.name).reduce((s, p) => s + (p.amount || 0), 0);
      totalPending += Math.max(0, expected - paid);
    });

    return { salary, advance, bonus, deduct, totalDue, rentDue, totalPending, activeCount, rentCount, total: salary + advance + bonus };
  }, [salaries, staff, salaryEntities, matchDate]);

  const attStats = useMemo(() => {
    const presentToday = attendance.filter(a => a.checkInTime).length;
    const checkedOut   = attendance.filter(a => a.checkOutTime).length;
    const lateToday    = attendance.filter(a => a.isLate).length;
    const expectedStaff = salaryEntities.filter(e => e.type === 'staff' && e.active).length || staff.length;
    return { presentToday, checkedOut, lateToday, expectedStaff, absentToday: Math.max(0, expectedStaff - presentToday) };
  }, [attendance, salaryEntities, staff]);

  // ── Pending payments (service data से) ───────────────────────────────────
  const pendStats = useMemo(() => {
    let amt = 0, count = 0, overdue = 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    Object.values(serviceData).forEach(d => {
      const a = parseFloat(d.pendingAmount || 0);
      if (a > 0 && !d.paymentReceivedDate) {
        amt += a; count++;
        if (d.paymentDueDate && new Date(d.paymentDueDate) < today) overdue++;
      }
    });
    return { amt, count, overdue };
  }, [serviceData]);

  // ── RTO / Insurance pending ──────────────────────────────────────────────
  const rtoIns = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let rtoPending = 0, insExpired = 0, insSoon = 0;
    Object.values(serviceData).forEach(d => {
      if (d.insuranceDate && !d.rtoDoneDate) rtoPending++;
      const startRaw = d.insuranceStartDate || d.insuranceDate;
      if (startRaw && !d.insuranceRenewed) {
        const due = new Date(new Date(startRaw).getTime() + 335 * 86400000);
        const days = Math.floor((due - today) / 86400000);
        if (days < 0) insExpired++; else if (days <= 60) insSoon++;
      }
    });
    return { rtoPending, insExpired, insSoon };
  }, [serviceData]);

  // ── आज का snapshot (ManagerView से) ──────────────────────────────────────
  const todayStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayInvoices = invoices.filter(i => String(i.invoiceDate || i.date || '').startsWith(today));
    const todayRevenue  = todayInvoices.reduce((s, i) => s + amountOf(i), 0);
    const sdList = Object.values(serviceData);
    const todayServices = sdList.filter(s => String(s.date || s.updatedAt || '').startsWith(today));

    let overdueServices = [];
    try {
      overdueServices = customers.flatMap(c => {
        const pd = c.linkedVehicle?.purchaseDate || c.purchaseDate;
        if (!pd) return [];
        return getServiceSchedule(pd).filter(s => s.status === 'overdue').map(s => ({ customer:c, service:s }));
      });
    } catch { overdueServices = []; }

    const visitors = getLS('vp_visitors', []);
    const pickups  = getLS('vp_pickup_drops', []);
    return {
      todayInvoices, todayRevenue, todayServices,
      overdueServices: overdueServices.slice(0, 20),
      todayVisitors: visitors.filter(v => String(v.visitTime || '').startsWith(today)),
      activePickups: pickups.filter(p => p.status === 'scheduled' || p.status === 'in-transit'),
    };
  }, [invoices, serviceData, customers]);

  // ── Insights / predictions (BusinessIntelligence से) ─────────────────────
  const insights = useMemo(() => {
    const now = new Date(), yNow = now.getFullYear(), mNow = now.getMonth();
    const revOf = list => list.reduce((s, i) => s + amountOf(i), 0);

    const inRange = (i, a, b) => { const d = new Date(i.invoiceDate || i.date); return d >= a && d <= b; };
    const thisMonth = invoices.filter(i => new Date(i.invoiceDate || i.date) >= new Date(yNow, mNow, 1));
    const lastMonth = invoices.filter(i => inRange(i, new Date(yNow, mNow - 1, 1), new Date(yNow, mNow, 0)));
    const thisRev = revOf(thisMonth), lastRev = revOf(lastMonth);
    const growth = lastRev > 0 ? ((thisRev - lastRev) / lastRev) * 100 : 0;

    const monthlySales = [];
    for (let i = 5; i >= 0; i--) {
      const s = new Date(yNow, mNow - i, 1), e = new Date(yNow, mNow - i + 1, 0);
      const list = invoices.filter(inv => inRange(inv, s, e));
      monthlySales.push({ month:s.toLocaleDateString('en-IN', { month:'short', year:'2-digit' }), revenue:revOf(list), count:list.length });
    }
    const avgGrowth = monthlySales.length >= 2
      ? monthlySales.slice(1).reduce((s, m, i) => s + (m.count - monthlySales[i].count), 0) / (monthlySales.length - 1) : 0;
    const predictedNextMonth = Math.max(0, Math.round((monthlySales.at(-1)?.count || 0) + avgGrowth));
    const predictedRevenue = monthlySales.length
      ? Math.round((monthlySales.reduce((s, m) => s + m.revenue, 0) / monthlySales.length) * (1 + growth / 100)) : 0;

    const recent = invoices.filter(i => (now - new Date(i.invoiceDate || i.date)) / 86400000 <= 60);
    const mc = {};
    recent.forEach(i => { const m = i.vehicleModel || 'Unknown'; mc[m] = (mc[m] || 0) + 1; });
    const trendingModels = Object.entries(mc).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([model, count]) => ({ model, count, pct: recent.length ? Math.round((count / recent.length) * 100) : 0 }));

    const modelStats = {};
    invoices.forEach(i => {
      const m = i.vehicleModel || 'Unknown';
      if (!modelStats[m]) modelStats[m] = { model:m, count:0, revenue:0 };
      modelStats[m].count++; modelStats[m].revenue += amountOf(i);
    });
    const topModels = Object.values(modelStats).sort((a, b) => b.revenue - a.revenue).slice(0, 8)
      .map(m => ({ ...m, avgPrice: Math.round(m.revenue / (m.count || 1)) }));

    const employeeStats = staff.map(s => {
      const sales = invoices.filter(i => i.handledBy === s.name || i.salesperson === s.name).length;
      const svcs  = Object.values(serviceData).filter(sv => sv.servicedBy === s.name || sv.handledBy === s.name).length;
      return { name:s.name, position:s.position, sales, services:svcs, total:sales + svcs };
    }).sort((a, b) => b.total - a.total);

    const key = `${yNow}-${mNow}`;
    const target = targets[key] || { sales:50, revenue:4000000 };
    const daysInMonth = new Date(yNow, mNow + 1, 0).getDate();
    const daysPassed = now.getDate();

    return {
      thisRev, lastRev, growth, monthlySales, predictedNextMonth, predictedRevenue,
      trendingModels, topModels, employeeStats,
      target, key,
      salesAchieved: thisMonth.length,
      salesPct: Math.round((thisMonth.length / (target.sales || 1)) * 100),
      revenuePct: Math.round((thisRev / (target.revenue || 1)) * 100),
      daysRemaining: daysInMonth - daysPassed,
      expectedPaceSales: Math.round((target.sales / daysInMonth) * daysPassed),
      expectedPaceRevenue: Math.round((target.revenue / daysInMonth) * daysPassed),
    };
  }, [invoices, staff, serviceData, targets]);

  const saveTarget = (field, value) => {
    const next = { ...targets, [insights.key]: { ...insights.target, [field]: Number(value) || 0 } };
    setTargets(next); setLS(LS_TARGETS, next);
    showInAppToast?.('🎯 Target सेव हुआ', 'इस महीने का लक्ष्य अपडेट कर दिया', 'success');
  };

  // ── Alerts ───────────────────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const a = [];
    if (partsInv.out.length)      a.push({ label:`${partsInv.out.length} पार्ट्स ख़त्म`,       color:C.rose,   go:() => setTab('parts') });
    if (partsInv.low.length)      a.push({ label:`${partsInv.low.length} पार्ट्स कम स्टॉक`,   color:C.amber,  go:() => setTab('parts') });
    if (pendStats.overdue)        a.push({ label:`${pendStats.overdue} payment overdue`,      color:C.rose,   go:() => navigate('/reminders') });
    if (rtoIns.insExpired)        a.push({ label:`${rtoIns.insExpired} insurance expired`,    color:C.rose,   go:() => navigate('/reminders') });
    if (rtoIns.rtoPending)        a.push({ label:`${rtoIns.rtoPending} RTO बाक़ी`,             color:C.purple, go:() => navigate('/reminders') });
    if (attStats.absentToday)     a.push({ label:`${attStats.absentToday} staff अनुपस्थित`,   color:C.amber,  go:() => navigate('/staff-management') });
    if (totalPft < 0)             a.push({ label:`घाटा: ${fmtINR(totalPft)}`,                 color:'#dc2626',go:() => setTab('profit') });
    return a;
  }, [partsInv, pendStats, rtoIns, attStats, totalPft, navigate]);

  // ── Quick actions ────────────────────────────────────────────────────────
  const quickActions = [
    { icon:Plus,          label:'नया ग्राहक',  path:'/new-customers',      color:C.red },
    { icon:FileText,      label:'नया Invoice', path:'/invoice-management', color:C.blue },
    { icon:Wrench,        label:'Job Card',    path:'/job-cards',          color:C.amber },
    { icon:FileText,      label:'Quotation',   path:'/quotation',          color:C.purple },
    { icon:Bell,          label:'Reminders',   path:'/reminders',          color:C.cyan },
    { icon:Bike,          label:'गाड़ियाँ',     path:'/veh-dashboard',      color:C.green, adminOnly:true },
    { icon:Package,       label:'Parts',       path:'/parts',              color:C.purple },
    { icon:Users,         label:'ग्राहक',       path:'/customers',          color:C.blue },
    { icon:UserCheck,     label:'Attendance',  path:'/staff-management',   color:C.green },
    { icon:CreditCard,    label:'वेतन',         path:'/salary-management',  color:C.amber, adminOnly:true },
    { icon:MessageSquare, label:'Team Chat',   path:'/chat',               color:C.rose },
    { icon:Calendar,      label:'Calendar',    path:'/calendar',           color:C.cyan },
  ].filter(a => !a.adminOnly || isAdmin);

  // ════════════════════════════════════════════════════════════════════════
  if (loading) return (
    <div style={{ background:C.bg, minHeight:'100vh', color:C.text, display:'grid', placeItems:'center', padding:40 }}>
      <div style={{ textAlign:'center' }}>
        <img src="/logo.png" alt="VP Honda" width={88} height={88}
             style={{ width:88, height:88, objectFit:'contain', marginBottom:16, animation:'vpPulse 1.4s ease-in-out infinite' }}/>
        <div style={{ fontSize:15, fontWeight:700 }}>Dashboard लोड हो रहा है…</div>
        <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>VP Honda, Bhopal</div>
      </div>
      <style>{`@keyframes vpPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.65;transform:scale(.94)}}`}</style>
    </div>
  );

  const visibleTabs = TABS.filter(t => isAdmin || !['profit', 'payroll', 'insights'].includes(t.id));

  return (
    <div style={{ background:C.bg, minHeight:'100vh', color:C.text }}>
      <style>{`
        @keyframes vpSpin { to { transform: rotate(360deg); } }
        .vp-spin { animation: vpSpin 1s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .vp-spin { animation: none; } }
        .vp-grid { display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); }
        .vp-row  { display:grid; gap:14px; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); }
        .vp-tab:focus-visible, .vp-qa:focus-visible { outline:2px solid ${C.red}; outline-offset:2px; }
      `}</style>

      {/* ═══ HEADER ═══ */}
      <header style={{
        position:'sticky', top:0, zIndex:40, background:'rgba(2,6,23,.92)',
        backdropFilter:'blur(10px)', borderBottom:`1px solid ${C.border}`, padding:'12px 18px',
      }}>
        <div style={{ maxWidth:1440, margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <img src="/logo.png" alt="VP Honda" width={40} height={40} style={{ width:40, height:40, objectFit:'contain' }}/>
            <div>
              <div style={{ fontSize:16, fontWeight:900, letterSpacing:.3 }}>VP Honda Command Center</div>
              <div style={{ fontSize:11, color:C.muted, display:'flex', alignItems:'center', gap:6 }}>
                {user?.name || 'User'}
                <span style={{ background:C.red, color:'#fff', padding:'1px 7px', borderRadius:4, fontSize:9, fontWeight:800 }}>
                  {(user?.role || 'staff').toUpperCase()}
                </span>
                {lastUpd && <span>• {lastUpd.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}</span>}
                {busy && <RefreshCw size={11} className="vp-spin"/>}
              </div>
            </div>
          </div>

          <div style={{ display:'flex', gap:7, alignItems:'center', flexWrap:'wrap' }}>
            <select value={yr} onChange={e => setYr(e.target.value)} style={selectStyle} aria-label="साल">
              {YEARS.map(y => <option key={y} value={y}>{y === 'All' ? 'सभी साल' : y}</option>)}
            </select>
            <select value={mo} onChange={e => setMo(e.target.value)} style={selectStyle} aria-label="महीना">
              {MONTHS.map(m => <option key={m} value={m}>{m === 'All' ? 'सभी महीने' : m}</option>)}
            </select>
            <select value={dy} onChange={e => setDy(e.target.value)} style={selectStyle} aria-label="दिन">
              {DAYS.map(d => <option key={d} value={d}>{d === 'All' ? 'सभी दिन' : d}</option>)}
            </select>
            <button onClick={() => loadAll()} style={{ ...selectStyle, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
              <RefreshCw size={13} className={busy ? 'vp-spin' : ''}/> Refresh
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth:1440, margin:'0 auto', padding:'18px 18px 56px' }}>

        {/* ═══ ALERT RAIL — signature element ═══ */}
        {alerts.length > 0 && (
          <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:6, marginBottom:16 }}>
            <span style={{ display:'flex', alignItems:'center', gap:6, color:C.muted, fontSize:11, fontWeight:800, whiteSpace:'nowrap', paddingRight:4 }}>
              <AlertTriangle size={13} color={C.amber}/> ध्यान दें
            </span>
            {alerts.map((a, i) => (
              <button key={i} onClick={a.go} style={{
                background:`${a.color}1f`, border:`1px solid ${a.color}55`, color:a.color,
                borderRadius:999, padding:'5px 13px', fontSize:11.5, fontWeight:800,
                whiteSpace:'nowrap', cursor:'pointer',
              }}>{a.label}</button>
            ))}
          </div>
        )}

        {/* ═══ TABS ═══ */}
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:8, marginBottom:18, borderBottom:`1px solid ${C.border}` }}>
          {visibleTabs.map(t => {
            const on = tab === t.id;
            return (
              <button key={t.id} className="vp-tab" onClick={() => setTab(t.id)} style={{
                background: on ? `linear-gradient(135deg, ${C.red}, #991b1b)` : 'transparent',
                color: on ? '#fff' : C.muted,
                border: on ? 'none' : `1px solid ${C.border}`,
                borderRadius:11, padding:'8px 15px', fontSize:12.5, fontWeight:800,
                cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:7,
              }}>
                <span>{t.icon}</span>{t.label}
                <span style={{ fontSize:10, opacity:.7, fontWeight:600 }}>{t.hi}</span>
              </button>
            );
          })}
        </div>

        {/* ══════════════════ TAB: OVERVIEW ══════════════════ */}
        {tab === 'overview' && (
          <div style={{ display:'grid', gap:16 }}>

            <div className="vp-grid">
              <K icon={IndianRupee} label="आज की बिक्री"   value={todayStats.todayRevenue} sub={`${todayStats.todayInvoices.length} invoices`} color={C.green}  onClick={() => navigate('/invoice-management')}/>
              <K icon={Bike}        label="गाड़ियाँ बिकीं"  value={vehInvoices.length}      sub={fmtINR(vehInvTotal)}                          color={C.blue}   onClick={() => navigate('/veh-dashboard')}/>
              <K icon={Users}       label="कुल ग्राहक"      value={filtCustomers.length}    sub={`${customers.length} अब तक`}                  color={C.red}    onClick={() => navigate('/customers')}/>
              <K icon={CreditCard}  label="बकाया payment"   value={pendStats.amt}           sub={`${pendStats.count} ग्राहक`} alert={pendStats.overdue ? `${pendStats.overdue} overdue` : null} color={C.amber} onClick={() => navigate('/reminders')}/>
              <K icon={Wrench}      label="Service invoices" value={svcInvoices.length}     sub={fmtINR(svcInvTotal)}                          color={C.cyan}   onClick={() => navigate('/job-cards')}/>
              <K icon={Package}     label="Parts स्टॉक"     value={partsInv.stockValue}     sub={`${partsInv.total} items`} alert={partsInv.out.length ? `${partsInv.out.length} ख़त्म` : null} color={C.purple} onClick={() => navigate('/parts')}/>
              <K icon={UserCheck}   label="आज हाज़िर"        value={`${attStats.presentToday}/${attStats.expectedStaff}`} sub={attStats.lateToday ? `${attStats.lateToday} लेट` : 'सब समय पर'} color={C.green} onClick={() => navigate('/staff-management')}/>
              <K icon={Shield}      label="Insurance/RTO"   value={rtoIns.rtoPending + rtoIns.insExpired} sub={`${rtoIns.rtoPending} RTO · ${rtoIns.insExpired} expired`} color={C.rose} onClick={() => navigate('/reminders')}/>
            </div>

            {/* Quick actions */}
            <Panel>
              <SH title="⚡ जल्दी शुरू करें" sub="सबसे ज़्यादा इस्तेमाल होने वाले काम"/>
              <div style={{ display:'grid', gap:9, gridTemplateColumns:'repeat(auto-fit, minmax(112px, 1fr))' }}>
                {quickActions.map(({ icon:Icon, label, path, color }) => (
                  <button key={path + label} className="vp-qa" onClick={() => navigate(path)} style={{
                    background:`${color}18`, border:`1px solid ${color}44`, color:C.text,
                    borderRadius:13, padding:'13px 8px', cursor:'pointer',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:7, fontSize:11.5, fontWeight:700,
                  }}>
                    <Icon size={19} color={color}/>{label}
                  </button>
                ))}
              </div>
            </Panel>

            <div className="vp-row">
              <Panel>
                <SH title="📈 पिछले 6 महीने" sub="Invoice revenue"/>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={insights.monthlySales}>
                    <defs>
                      <linearGradient id="vpRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.red} stopOpacity={0.55}/>
                        <stop offset="100%" stopColor={C.red} stopOpacity={0.03}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                    <XAxis dataKey="month" tick={{ fill:C.muted, fontSize:10 }}/>
                    <YAxis tick={{ fill:C.muted, fontSize:10 }} tickFormatter={fmtINR}/>
                    <Tooltip content={<Tip/>}/>
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke={C.red} fill="url(#vpRev)" strokeWidth={2}/>
                  </AreaChart>
                </ResponsiveContainer>
              </Panel>

              <Panel>
                <SH title="🏍 टॉप मॉडल" sub="चुनी हुई अवधि में"/>
                {vehModels.length ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={vehModels} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88} label={({ name, value }) => `${name} (${value})`} labelLine={false} fontSize={10}>
                        {vehModels.map((e, i) => <Cell key={i} fill={PIE[i % PIE.length]}/>)}
                      </Pie>
                      <Tooltip content={<Tip/>}/>
                    </PieChart>
                  </ResponsiveContainer>
                ) : <Empty text="इस अवधि में कोई गाड़ी दर्ज नहीं है"/>}
              </Panel>
            </div>

            <div className="vp-row">
              <Panel>
                <SH title="🚨 Service overdue" sub={`${todayStats.overdueServices.length} ग्राहक`}
                  action={<button onClick={() => navigate('/reminders')} style={{ ...selectStyle, cursor:'pointer', fontSize:11 }}>सब देखें <ChevronRight size={11} style={{ verticalAlign:'-1px' }}/></button>}/>
                {todayStats.overdueServices.length ? (
                  <div style={{ display:'grid', gap:7, maxHeight:250, overflowY:'auto' }}>
                    {todayStats.overdueServices.slice(0, 8).map((r, i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, background:'#ef444412', border:'1px solid #ef444433', borderRadius:11, padding:'9px 12px' }}>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:12.5, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {r.customer.customerName || r.customer.name || 'ग्राहक'}
                          </div>
                          <div style={{ fontSize:10.5, color:C.muted }}>{r.service.label || r.service.name} · {r.customer.vehicleModel || ''}</div>
                        </div>
                        {(r.customer.phone || r.customer.mobileNo) && (
                          <button onClick={() => sendWhatsApp?.(r.customer.phone || r.customer.mobileNo, `नमस्ते ${r.customer.customerName || r.customer.name || ''}, आपकी गाड़ी की ${r.service.label || 'service'} due है. VP Honda, Bhopal — 9713394738`)}
                            style={{ background:'#16a34a22', border:'1px solid #16a34a55', color:'#4ade80', borderRadius:9, padding:'5px 9px', fontSize:10.5, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap' }}>
                            <Phone size={10} style={{ verticalAlign:'-1px' }}/> WA
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : <Empty text="कोई service overdue नहीं — सब clear ✅"/>}
              </Panel>

              <Panel>
                <SH title="📋 आज की गतिविधि"/>
                <div style={{ display:'grid', gap:9 }}>
                  {[
                    { l:'आज के invoices',  v:todayStats.todayInvoices.length, c:C.blue,   go:'/invoice-management' },
                    { l:'आज की services',  v:todayStats.todayServices.length, c:C.cyan,   go:'/service-customers' },
                    { l:'आज के visitors',  v:todayStats.todayVisitors.length, c:C.purple, go:'/visitors' },
                    { l:'चालू pickup/drop', v:todayStats.activePickups.length, c:C.amber,  go:'/pickup-drop' },
                  ].map(r => (
                    <button key={r.l} onClick={() => navigate(r.go)} style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      background:'rgba(255,255,255,.03)', border:`1px solid ${C.border}`,
                      borderRadius:12, padding:'11px 14px', cursor:'pointer', color:C.text, font:'inherit',
                    }}>
                      <span style={{ fontSize:12.5, fontWeight:600 }}>{r.l}</span>
                      <span style={{ fontSize:17, fontWeight:900, color:r.c }}>{r.v}</span>
                    </button>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
        )}

        {/* ══════════════════ TAB: PROFIT & LOSS ══════════════════ */}
        {tab === 'profit' && isAdmin && (
          <div style={{ display:'grid', gap:16 }}>

            {/* ⭐ Excel import — पहले नया महीना जोड़ने का कोई रास्ता ही नहीं था */}
            <div style={{
              display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
              background: pnlRows ? 'rgba(34,197,94,.07)' : 'rgba(245,158,11,.08)',
              border:`1px solid ${pnlRows ? 'rgba(34,197,94,.28)' : 'rgba(245,158,11,.3)'}`,
              borderRadius:14, padding:'12px 15px',
            }}>
              <span style={{ fontSize:20 }}>📊</span>
              <div style={{ flex:1, minWidth:200 }}>
                <p style={{ margin:0, fontSize:12.5, fontWeight:800, color: pnlRows ? '#86efac' : '#fcd34d' }}>
                  {pnlRows
                    ? `${pnlRows.length} महीने Excel से आए हैं`
                    : 'अभी पुराना (code में लिखा) डेटा दिख रहा है'}
                </p>
                <p style={{ margin:'3px 0 0', fontSize:10.5, color:'#64748b' }}>
                  {pnlRows
                    ? 'नया महीना जोड़ना हो तो Excel में भरकर दोबारा import कर दें — पुराने महीने update हो जाएँगे, दो बार नहीं जुड़ेंगे।'
                    : 'Veh_Details.xlsm की Summary sheet import कीजिए — फिर हर नया महीना यहीं से जुड़ जाएगा।'}
                </p>
              </div>
              <button onClick={() => setShowImport(true)} style={{
                background:'linear-gradient(135deg,#059669,#047857)', border:'none', borderRadius:11,
                padding:'10px 16px', color:'#fff', fontSize:12.5, fontWeight:800, cursor:'pointer',
                display:'flex', alignItems:'center', gap:7, whiteSpace:'nowrap',
              }}>
                📥 Excel Import
              </button>
            </div>

            <div className="vp-grid">
              <K icon={TrendingUp}   label="कुल आमदनी"    value={totalRev}  sub="सभी स्रोत"                        color={C.green}/>
              <K icon={TrendingDown} label="कुल ख़र्च"     value={-totalExp} sub="सभी outflow"                     color={C.rose}/>
              <K icon={IndianRupee}  label="शुद्ध लाभ"     value={totalPft}  sub={totalPft > 0 ? 'फ़ायदा' : 'घाटा'} color={totalPft > 0 ? C.green : C.rose}/>
              <K icon={Award}        label="फ़ायदे के महीने" value={`${plData.filter(r => r.pft > 0).length}/${plData.length}`} color={C.blue}/>
            </div>

            <Panel>
              <SH title="📊 महीने-दर-महीने नफ़ा/नुक़सान" sub="हरा = फ़ायदा · लाल = घाटा"/>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={plData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                  <XAxis dataKey="m" tick={{ fill:C.muted, fontSize:10 }}/>
                  <YAxis tick={{ fill:C.muted, fontSize:10 }} tickFormatter={fmtINR}/>
                  <Tooltip content={<Tip/>}/>
                  <ReferenceLine y={0} stroke="#64748b"/>
                  <Bar dataKey="pft" name="नफ़ा/नुक़सान" radius={[6, 6, 0, 0]}>
                    {plData.map((e, i) => <Cell key={i} fill={e.pft > 0 ? C.green : C.rose}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel>
              <SH title="💰 आमदनी के स्रोत"/>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={plData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                  <XAxis dataKey="m" tick={{ fill:C.muted, fontSize:10 }}/>
                  <YAxis tick={{ fill:C.muted, fontSize:10 }} tickFormatter={fmtINR}/>
                  <Tooltip content={<Tip/>}/>
                  <Legend wrapperStyle={{ fontSize:11 }}/>
                  <Bar dataKey="access"  name="Accessories" stackId="r" fill={C.blue}/>
                  <Bar dataKey="rto"     name="RTO"         stackId="r" fill={C.purple}/>
                  <Bar dataKey="ins"     name="Insurance"   stackId="r" fill={C.amber}/>
                  <Bar dataKey="service" name="Service"     stackId="r" fill={C.green}/>
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel>
              <SH title="✏️ ख़र्च ठीक करें" sub="कोई भी box बदलें — तुरंत सेव हो जाता है (इसी device पर)"/>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11.5, minWidth:720 }}>
                  <thead>
                    <tr style={{ color:C.muted, textAlign:'right' }}>
                      {['महीना','गाड़ी','Access','RTO','Ins','Service','Gift','Accessory','किराया','अन्य','Parts','नफ़ा/नुक़सान'].map((h, i) => (
                        <th key={h} style={{ padding:'8px 7px', textAlign:i === 0 ? 'left' : 'right', borderBottom:`1px solid ${C.border}`, fontWeight:700, whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {plData.map(r => (
                      <tr key={r.y + r.m}>
                        <td style={{ padding:'6px 7px', fontWeight:700, whiteSpace:'nowrap' }}>{r.m} {r.y}</td>
                        <td style={{ padding:'6px 7px', textAlign:'right' }}>{r.veh}</td>
                        <td style={{ padding:'6px 7px', textAlign:'right', color:C.green }}>{fmtINR(r.access)}</td>
                        <td style={{ padding:'6px 7px', textAlign:'right', color:C.green }}>{fmtINR(r.rto)}</td>
                        <td style={{ padding:'6px 7px', textAlign:'right', color:C.green }}>{fmtINR(r.ins)}</td>
                        <td style={{ padding:'6px 7px', textAlign:'right', color:C.green }}>{fmtINR(r.service)}</td>
                        {['gift','accesory','rent','other','parts'].map(f => (
                          <td key={f} style={{ padding:'4px 5px', textAlign:'right' }}>
                            <input
                              type="number"
                              defaultValue={Math.abs(r[f])}
                              onBlur={e => saveOverride(r, f, e.target.value)}
                              aria-label={`${r.m} ${r.y} ${f}`}
                              style={{ width:78, background:'#0f172a', border:`1px solid ${C.border}`, color:'#fca5a5', borderRadius:7, padding:'4px 6px', fontSize:11, textAlign:'right' }}
                            />
                          </td>
                        ))}
                        <td style={{ padding:'6px 7px', textAlign:'right', fontWeight:900, color:r.pft > 0 ? C.green : C.rose, whiteSpace:'nowrap' }}>{fmtINR(r.pft)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )}

        {/* ══════════════════ TAB: VEHICLES ══════════════════ */}
        {tab === 'vehicles' && (
          <div style={{ display:'grid', gap:16 }}>
            <div className="vp-grid">
              <K icon={Bike}       label="गाड़ियाँ बिकीं"  value={vehInvoices.length} sub={fmtINR(vehInvTotal)} color={C.blue}  onClick={() => navigate('/veh-dashboard')}/>
              <K icon={IndianRupee} label="औसत क़ीमत"     value={vehInvoices.length ? Math.round(vehInvTotal / vehInvoices.length) : 0} color={C.green}/>
              <K icon={Car}        label="पुरानी गाड़ियाँ" value={oldBikes.length}    sub="Exchange/old bikes"  color={C.amber}/>
              <K icon={FileText}   label="कुल invoices"   value={filtInvoices.length} color={C.purple} onClick={() => navigate('/invoice-management')}/>
            </div>

            <Panel>
              <SH title="🏍 मॉडल-वार बिक्री"/>
              {vehModels.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={vehModels} layout="vertical" margin={{ left:60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                    <XAxis type="number" tick={{ fill:C.muted, fontSize:10 }}/>
                    <YAxis type="category" dataKey="name" tick={{ fill:C.muted, fontSize:10 }} width={90}/>
                    <Tooltip content={<Tip/>}/>
                    <Bar dataKey="value" name="गाड़ियाँ" radius={[0, 6, 6, 0]}>
                      {vehModels.map((e, i) => <Cell key={i} fill={PIE[i % PIE.length]}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty text="इस अवधि में कोई गाड़ी दर्ज नहीं है"/>}
            </Panel>

            <Panel>
              <SH title="💵 सबसे ज़्यादा कमाई वाले मॉडल" sub="कुल revenue के हिसाब से"/>
              {insights.topModels.length ? (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:420 }}>
                    <thead><tr style={{ color:C.muted }}>
                      {['मॉडल','कितनी बिकीं','कुल revenue','औसत क़ीमत'].map((h, i) => (
                        <th key={h} style={{ padding:'8px 7px', textAlign:i ? 'right' : 'left', borderBottom:`1px solid ${C.border}`, fontWeight:700 }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {insights.topModels.map(m => (
                        <tr key={m.model}>
                          <td style={{ padding:'7px', fontWeight:700 }}>{m.model}</td>
                          <td style={{ padding:'7px', textAlign:'right' }}>{m.count}</td>
                          <td style={{ padding:'7px', textAlign:'right', color:C.green, fontWeight:700 }}>{fmtINR(m.revenue)}</td>
                          <td style={{ padding:'7px', textAlign:'right', color:C.muted }}>{fmtINR(m.avgPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <Empty text="अभी कोई invoice नहीं है"/>}
            </Panel>
          </div>
        )}

        {/* ══════════════════ TAB: CUSTOMERS ══════════════════ */}
        {tab === 'customers' && (
          <div style={{ display:'grid', gap:16 }}>
            <div className="vp-grid">
              <K icon={Users}      label="ग्राहक (अवधि में)" value={filtCustomers.length} sub={`${customers.length} कुल`} color={C.red}  onClick={() => navigate('/customers')}/>
              <K icon={CreditCard} label="बकाया रक़म"        value={pendStats.amt} sub={`${pendStats.count} ग्राहक`} alert={pendStats.overdue ? `${pendStats.overdue} overdue` : null} color={C.amber} onClick={() => navigate('/reminders')}/>
              <K icon={Shield}     label="RTO बाक़ी"         value={rtoIns.rtoPending} color={C.purple} onClick={() => navigate('/reminders')}/>
              <K icon={AlertTriangle} label="Insurance expired" value={rtoIns.insExpired} sub={`${rtoIns.insSoon} जल्द due`} color={C.rose} onClick={() => navigate('/reminders')}/>
            </div>

            <Panel>
              <SH title="📈 ग्राहक बढ़ोतरी" sub="महीने-वार नए ग्राहक"/>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={(() => {
                  const map = {};
                  customers.forEach(c => {
                    const d = new Date(c.invoiceDate || c.purchaseDate || c.createdAt || 0);
                    if (isNaN(d.getTime()) || d.getFullYear() < 2024) return;
                    const k = `${d.toLocaleString('en-IN', { month:'short' })} ${String(d.getFullYear()).slice(2)}`;
                    map[k] = (map[k] || 0) + 1;
                  });
                  return Object.entries(map).map(([month, count]) => ({ month, count }));
                })()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                  <XAxis dataKey="month" tick={{ fill:C.muted, fontSize:10 }}/>
                  <YAxis tick={{ fill:C.muted, fontSize:10 }}/>
                  <Tooltip content={<Tip/>}/>
                  <Line type="monotone" dataKey="count" name="नए ग्राहक" stroke={C.red} strokeWidth={2} dot={{ r:3 }}/>
                </LineChart>
              </ResponsiveContainer>
            </Panel>

            <Panel>
              <SH title="💳 सबसे बड़े बकायेदार" sub="जिनका payment अभी आना है"
                action={<button onClick={() => navigate('/reminders')} style={{ ...selectStyle, cursor:'pointer', fontSize:11 }}>Reminders</button>}/>
              {(() => {
                const list = Object.values(serviceData)
                  .filter(d => parseFloat(d.pendingAmount || 0) > 0 && !d.paymentReceivedDate)
                  .sort((a, b) => parseFloat(b.pendingAmount) - parseFloat(a.pendingAmount)).slice(0, 10);
                if (!list.length) return <Empty text="कोई बकाया नहीं — सब clear ✅"/>;
                return (
                  <div style={{ display:'grid', gap:7 }}>
                    {list.map((d, i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, background:'rgba(255,255,255,.03)', border:`1px solid ${C.border}`, borderRadius:11, padding:'9px 13px' }}>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:12.5, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.customerName || 'ग्राहक'}</div>
                          <div style={{ fontSize:10.5, color:C.muted }}>{d.vehicle || ''} {d.regNo ? `· ${d.regNo}` : ''}</div>
                        </div>
                        <div style={{ fontSize:14, fontWeight:900, color:C.amber, whiteSpace:'nowrap' }}>{fmtINR(parseFloat(d.pendingAmount))}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </Panel>
          </div>
        )}

        {/* ══════════════════ TAB: PARTS & SERVICE ══════════════════ */}
        {tab === 'parts' && (
          <div style={{ display:'grid', gap:16 }}>
            <div className="vp-grid">
              <K icon={Package}   label="स्टॉक की क़ीमत"  value={partsInv.stockValue} sub={`${partsInv.total} items`} color={C.purple} onClick={() => navigate('/parts')}/>
              <K icon={XCircle}   label="स्टॉक ख़त्म"     value={partsInv.out.length} color={C.rose}  onClick={() => navigate('/parts')}/>
              <K icon={AlertTriangle} label="कम स्टॉक"   value={partsInv.low.length} color={C.amber} onClick={() => navigate('/parts')}/>
              <K icon={Wrench}    label="इस्तेमाल हुए parts" value={partStats.totalQty} sub={fmtINR(partStats.totalValue)} color={C.cyan}/>
            </div>

            <div className="vp-row">
              <Panel>
                <SH title="🔧 सबसे ज़्यादा इस्तेमाल" sub={`${partStats.entries} entries`}/>
                {partStats.top.length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={partStats.top} layout="vertical" margin={{ left:70 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                      <XAxis type="number" tick={{ fill:C.muted, fontSize:10 }}/>
                      <YAxis type="category" dataKey="name" tick={{ fill:C.muted, fontSize:9 }} width={100}/>
                      <Tooltip content={<Tip/>}/>
                      <Bar dataKey="qty" name="मात्रा" fill={C.cyan} radius={[0, 6, 6, 0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty text="इस अवधि में कोई part इस्तेमाल नहीं हुआ"/>}
              </Panel>

              <Panel>
                <SH title="⚠️ अभी मँगाने वाले parts" sub="ख़त्म + कम स्टॉक"
                  action={<button onClick={() => navigate('/parts')} style={{ ...selectStyle, cursor:'pointer', fontSize:11 }}>Parts खोलें</button>}/>
                {(partsInv.out.length + partsInv.low.length) ? (
                  <div style={{ display:'grid', gap:6, maxHeight:280, overflowY:'auto' }}>
                    {[...partsInv.out.map(p => ({ p, out:true })), ...partsInv.low.map(p => ({ p, out:false }))].slice(0, 25).map(({ p, out }, i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, background:out ? '#ef444412' : '#f59e0b12', border:`1px solid ${out ? '#ef444433' : '#f59e0b33'}`, borderRadius:10, padding:'8px 12px' }}>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.partName || p.name || p.partNumber}</div>
                          <div style={{ fontSize:10, color:C.muted }}>{p.partNumber || ''}</div>
                        </div>
                        <span style={{ fontSize:11, fontWeight:800, color:out ? C.rose : C.amber, whiteSpace:'nowrap' }}>
                          {out ? 'ख़त्म' : `${p.stock ?? p.quantity} बचे`}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : <Empty text="स्टॉक ठीक है ✅"/>}
              </Panel>
            </div>
          </div>
        )}

        {/* ══════════════════ TAB: PAYROLL & STAFF ══════════════════ */}
        {tab === 'payroll' && isAdmin && (
          <div style={{ display:'grid', gap:16 }}>
            <div className="vp-grid">
              <K icon={CreditCard} label="वेतन दिया"     value={salStats.salary}      sub="चुनी हुई अवधि"                    color={C.green} onClick={() => navigate('/salary-management')}/>
              <K icon={Zap}        label="Advance"       value={salStats.advance}     sub={`कटौती ${fmtINR(salStats.deduct)}`} color={C.amber}/>
              <K icon={Award}      label="Bonus/Incentive" value={salStats.bonus}     color={C.purple} onClick={() => navigate('/staff-management')}/>
              <K icon={Clock}      label="बक़ाया वेतन"    value={salStats.totalPending} sub={`${salStats.activeCount} staff`}  color={C.rose}  onClick={() => navigate('/salary-management')}/>
              <K icon={Users}      label="मासिक देनदारी" value={salStats.totalDue}    sub={`+ किराया ${fmtINR(salStats.rentDue)}`} color={C.blue}/>
              <K icon={UserCheck}  label="आज हाज़िर"      value={`${attStats.presentToday}/${attStats.expectedStaff}`} sub={`${attStats.checkedOut} ने check-out किया`} color={C.green} onClick={() => navigate('/staff-management')}/>
              <K icon={XCircle}    label="आज अनुपस्थित"  value={attStats.absentToday} color={C.rose}  onClick={() => navigate('/staff-management')}/>
              <K icon={AlertTriangle} label="आज लेट"     value={attStats.lateToday}   color={C.amber} onClick={() => navigate('/staff-management')}/>
            </div>

            <Panel>
              <SH title="🏆 Staff performance" sub="बिक्री + service, दोनों मिलाकर"/>
              {insights.employeeStats.length ? (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:420 }}>
                    <thead><tr style={{ color:C.muted }}>
                      {['#','नाम','पद','बिक्री','Service','कुल'].map((h, i) => (
                        <th key={h} style={{ padding:'8px 7px', textAlign:i > 2 ? 'right' : 'left', borderBottom:`1px solid ${C.border}`, fontWeight:700 }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {insights.employeeStats.map((s, i) => (
                        <tr key={s.name + i}>
                          <td style={{ padding:'7px', color:C.muted }}>{i + 1}</td>
                          <td style={{ padding:'7px', fontWeight:700 }}>{s.name}</td>
                          <td style={{ padding:'7px', color:C.muted, fontSize:11 }}>{s.position || '—'}</td>
                          <td style={{ padding:'7px', textAlign:'right' }}>{s.sales}</td>
                          <td style={{ padding:'7px', textAlign:'right' }}>{s.services}</td>
                          <td style={{ padding:'7px', textAlign:'right', fontWeight:900, color:C.green }}>{s.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <Empty text="अभी staff data नहीं है"/>}
            </Panel>
          </div>
        )}

        {/* ══════════════════ TAB: INSIGHTS ══════════════════ */}
        {tab === 'insights' && isAdmin && (
          <div style={{ display:'grid', gap:16 }}>
            <div className="vp-grid">
              <K icon={Brain}      label="अगले महीने का अनुमान" value={insights.predictedNextMonth} sub="गाड़ियाँ (6 महीने के trend से)" color={C.purple}/>
              <K icon={TrendingUp} label="अनुमानित revenue"    value={insights.predictedRevenue}   color={C.green}/>
              <K icon={Activity}   label="इस महीने की बिक्री"  value={insights.thisRev} sub={`पिछला: ${fmtINR(insights.lastRev)}`} color={C.blue}/>
              <K icon={insights.growth >= 0 ? TrendingUp : TrendingDown} label="बढ़ोतरी" value={`${insights.growth >= 0 ? '+' : ''}${insights.growth.toFixed(1)}%`} sub="पिछले महीने के मुक़ाबले" color={insights.growth >= 0 ? C.green : C.rose}/>
            </div>

            <div className="vp-row">
              <Panel>
                <SH title="🔥 अभी चल रहे मॉडल" sub="पिछले 60 दिन"/>
                {insights.trendingModels.length ? (
                  <div style={{ display:'grid', gap:9 }}>
                    {insights.trendingModels.map((m, i) => (
                      <div key={m.model}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:700, marginBottom:4 }}>
                          <span>{i + 1}. {m.model}</span><span style={{ color:C.muted }}>{m.count} ({m.pct}%)</span>
                        </div>
                        <div style={{ height:7, background:'#1e293b', borderRadius:99, overflow:'hidden' }}>
                          <div style={{ width:`${m.pct}%`, height:'100%', background:PIE[i % PIE.length], borderRadius:99 }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <Empty text="पिछले 60 दिन में कोई बिक्री दर्ज नहीं"/>}
              </Panel>

              <Panel>
                <SH title="🎯 इस महीने का लक्ष्य" sub={`${insights.daysRemaining} दिन बाक़ी`}/>
                <div style={{ display:'grid', gap:14 }}>
                  {[
                    { label:'गाड़ियाँ', field:'sales',   done:insights.salesAchieved, target:insights.target.sales,   pct:insights.salesPct,   pace:insights.expectedPaceSales,   fmt:v => v },
                    { label:'Revenue', field:'revenue', done:insights.thisRev,       target:insights.target.revenue, pct:insights.revenuePct, pace:insights.expectedPaceRevenue, fmt:fmtINR },
                  ].map(t => {
                    const onPace = t.done >= t.pace;
                    return (
                      <div key={t.field}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5, gap:8 }}>
                          <span style={{ fontSize:12, fontWeight:700 }}>{t.label}</span>
                          <span style={{ fontSize:11, color:onPace ? C.green : C.amber, fontWeight:800 }}>
                            {t.fmt(t.done)} / {t.fmt(t.target)} · {t.pct}%
                          </span>
                        </div>
                        <div style={{ height:9, background:'#1e293b', borderRadius:99, overflow:'hidden', position:'relative' }}>
                          <div style={{ width:`${Math.min(100, t.pct)}%`, height:'100%', background:onPace ? C.green : C.amber, borderRadius:99 }}/>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6, gap:8 }}>
                          <span style={{ fontSize:10, color:C.muted }}>
                            आज तक होना चाहिए: {t.fmt(t.pace)} · {onPace ? 'रफ़्तार ठीक है ✅' : 'पीछे चल रहे हैं'}
                          </span>
                          <input
                            type="number"
                            defaultValue={t.target}
                            onBlur={e => saveTarget(t.field, e.target.value)}
                            aria-label={`${t.label} target`}
                            style={{ width:110, background:'#0f172a', border:`1px solid ${C.border}`, color:C.text, borderRadius:7, padding:'4px 7px', fontSize:11, textAlign:'right' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>

            <Panel>
              <SH title="📉 6 महीने का trend" sub="गाड़ियाँ और revenue साथ-साथ"/>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={insights.monthlySales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                  <XAxis dataKey="month" tick={{ fill:C.muted, fontSize:10 }}/>
                  <YAxis yAxisId="l" tick={{ fill:C.muted, fontSize:10 }}/>
                  <YAxis yAxisId="r" orientation="right" tick={{ fill:C.muted, fontSize:10 }} tickFormatter={fmtINR}/>
                  <Tooltip content={<Tip/>}/>
                  <Legend wrapperStyle={{ fontSize:11 }}/>
                  <Line yAxisId="l" type="monotone" dataKey="count"   name="गाड़ियाँ" stroke={C.blue}  strokeWidth={2} dot={{ r:3 }}/>
                  <Line yAxisId="r" type="monotone" dataKey="revenue" name="Revenue" stroke={C.green} strokeWidth={2} dot={{ r:3 }}/>
                </LineChart>
              </ResponsiveContainer>
            </Panel>
          </div>
        )}

        {/* Staff ने admin-only tab खोलने की कोशिश की */}
        {!isAdmin && ['profit', 'payroll', 'insights'].includes(tab) && (
          <Panel><Empty text="यह हिस्सा सिर्फ़ admin के लिए है."/></Panel>
        )}

        {showImport && (
          <PnlExcelImport
            onClose={() => setShowImport(false)}
            onDone={() => loadAll(true)}
          />
        )}

        <footer style={{ textAlign:'center', color:'#334155', fontSize:11, marginTop:34 }}>
          VP Honda, Parwaliya Sadak, Bhopal · हर 30 सेकंड में अपने आप refresh
        </footer>
      </main>
    </div>
  );
}
