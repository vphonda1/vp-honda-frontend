// ════════════════════════════════════════════════════════════════════════════
// VPHondaDashboard.jsx — VP Honda Command Center (Smart Redesign)
// ════════════════════════════════════════════════════════════════════════════
// ✅ Live data from MongoDB (customers, vehicles, parts, service, salaries)
// ✅ Historical P&L from Excel Summary sheet (preserved)
// ✅ Auto-refresh every 30 seconds
// ✅ Year / Month / Day filter
// ✅ Smart alerts, modern dark UI
// ✅ Integrated with new parts consumption & salary modules
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Legend, ReferenceLine,
} from "recharts";
import { api, API_BASE } from "../utils/apiConfig";
import {
  RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Activity,
  DollarSign, Users, Package, Bike, Bell, Zap, ArrowUpRight,
  CreditCard, Shield, Wrench, Award, Eye, Calendar, Clock,
  CheckCircle, XCircle, ChevronRight, Filter, Download,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════════════════
// HISTORICAL P&L DATA — from Excel Summary sheet (preserved)
// Update here manually when Excel data changes.
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

const INS_DATA   = { totalEntries:233, collected:1454262, payout:395658,  profit:1058604 };
const RTO_DATA   = { totalEntries:228, collected:2441859, deposit:564343, profit:1877516 };
const PARTS_DATA = { entries:218, mrpTotal:57219, saleTotal:48798, taxableTotal:45567 };

// ── Expense overrides (localStorage) ────────────────────────────────────────
const LS_KEY = "vph_expense_overrides";
const loadOverrides = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } };
const saveOverrides = (obj) => { try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch {} };
const buildSummaryPL = (overrides) => BASE_SUMMARY_PL.map(row => {
  const key = row.y + "-" + row.m;
  const ov = overrides[key] || {};
  const gift = ov.gift !== undefined ? -Math.abs(Number(ov.gift)) : row.gift;
  const accesory = ov.accesory !== undefined ? -Math.abs(Number(ov.accesory)) : row.accesory;
  const rent  = ov.rent  !== undefined ? -Math.abs(Number(ov.rent))  : row.rent;
  const other = ov.other !== undefined ? -Math.abs(Number(ov.other)) : row.other;
  const parts = ov.parts !== undefined ? -Math.abs(Number(ov.parts)) : row.parts;
  const pft = row.access + row.rto + row.ins + row.service + gift + accesory + rent + other + parts;
  return { ...row, gift, accesory, rent, other, parts, pft };
});

// ── Helpers ─────────────────────────────────────────────────────────────────
const getLS = (k, fb=[]) => { try { return JSON.parse(localStorage.getItem(k)||'null') || fb; } catch { return fb; } };
const MONTH_NUM = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
const MONTHS = ["All","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const YEARS  = ["All", 2024, 2025, 2026, 2027];
const DAYS   = ["All", ...Array.from({length:31}, (_,i)=>i+1)];
const PC = ["#f97316","#3b82f6","#10b981","#8b5cf6","#ef4444","#06b6d4","#f59e0b","#84cc16","#64748b","#e879f9"];

const fmtINR = n => {
  const abs = Math.abs(n||0), sg = (n||0) < 0 ? "-" : "";
  if (abs >= 1e7) return `${sg}₹${(abs/1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sg}₹${(abs/1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${sg}₹${(abs/1e3).toFixed(1)}K`;
  return `${sg}₹${Math.round(abs).toLocaleString('en-IN')}`;
};

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#0c1220", border:"1px solid #1e293b", borderRadius:10, padding:"10px 14px", fontSize:12 }}>
      <p style={{ color:"#94a3b8", margin:"0 0 5px", fontWeight:700 }}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{ color: p.color||"#f1f5f9", margin:"2px 0" }}>
          {p.name}: <b>{typeof p.value === "number" && Math.abs(p.value)>999 ? fmtINR(p.value) : p.value}</b>
        </p>
      ))}
    </div>
  );
};

// ────────── Small reusable UI components ──────────
const Card = ({ children, style={}, onClick }) => (
  <div onClick={onClick} style={{ background:"linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))", border:"1px solid rgba(255,255,255,0.08)", borderRadius:18, padding:20, cursor: onClick?'pointer':'default', transition:'all 0.25s', ...style }}
    className={onClick ? 'hover:scale-[1.01] hover:shadow-xl' : ''}>{children}</div>
);

const SH = ({ title, sub, action }) => (
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:14 }}>
    <div>
      <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:800, margin:0 }}>{title}</h3>
      {sub && <p style={{ color:"#475569", fontSize:11, margin:"3px 0 0" }}>{sub}</p>}
    </div>
    {action}
  </div>
);

// KPI Card with trend
const K = ({ icon: Icon, label, value, sub, color, trend, onClick, alert }) => {
  const isNeg = typeof value === "number" && value < 0;
  const col = isNeg ? "#ef4444" : color;
  return (
    <div onClick={onClick}
      style={{ background:`linear-gradient(135deg, ${col}22, ${col}08)`, border:`1px solid ${col}40`, borderRadius:16, padding:"16px 18px", position:"relative", overflow:"hidden", cursor: onClick ? 'pointer' : 'default', transition:'all 0.25s' }}
      className={onClick ? "hover:scale-[1.02]" : ""}>
      <div style={{ display:"flex", alignItems:"start", justifyContent:"space-between", marginBottom:9 }}>
        <div style={{ width:38, height:38, borderRadius:12, background: col, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 4px 14px ${col}66` }}>
          {Icon ? <Icon size={18} color="#fff"/> : <span style={{ fontSize:18 }}>📊</span>}
        </div>
        {alert && (
          <div style={{ background:'#ef444422', border:'1px solid #ef444466', borderRadius:10, padding:'2px 8px' }}>
            <span style={{ color:'#fca5a5', fontSize:10, fontWeight:700 }}>⚠ {alert}</span>
          </div>
        )}
      </div>
      <p style={{ color:"#94a3b8", fontSize:10, fontWeight:700, letterSpacing:0.8, textTransform:"uppercase", margin:0 }}>{label}</p>
      <p style={{ color: isNeg ? "#fca5a5" : "#f8fafc", fontSize:22, fontWeight:900, letterSpacing:-0.5, margin:"4px 0 2px" }}>
        {typeof value === "number" ? fmtINR(value) : value}
      </p>
      {sub && <p style={{ color:"#64748b", fontSize:10 }}>{sub}</p>}
      {trend !== undefined && (
        <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, marginTop:4 }}>
          {trend > 0 ? <TrendingUp size={11} color="#22c55e"/> : <TrendingDown size={11} color="#ef4444"/>}
          <span style={{ color: trend > 0 ? '#86efac' : '#fca5a5', fontWeight:700 }}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id:"overview",   icon:"📊", label:"Overview" },
  { id:"profit",     icon:"💹", label:"Profit & Loss" },
  { id:"vehicles",   icon:"🏍", label:"Vehicles" },
  { id:"customers",  icon:"👥", label:"Customers" },
  { id:"parts",      icon:"🔧", label:"Parts & Service" },
  { id:"insurance",  icon:"🛡", label:"Insurance & RTO" },
  { id:"salary",     icon:"👔", label:"Payroll" },
];

// ════════════════════════════════════════════════════════════════════════════
export default function VPHondaDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [yr, setYr] = useState("All");
  const [mo, setMo] = useState("All");
  const [dy, setDy] = useState("All");
  const [loading, setLoading] = useState(true);
  const [lastUpd, setLastUpd] = useState(new Date());

  // Data stores
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [parts, setParts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [partHistory, setPartHistory] = useState([]);
  const [serviceData, setServiceData] = useState({});
  const [overrides, setOverrides] = useState(loadOverrides());

  // ── Load all data from MongoDB + localStorage fallback ─────────────────
  const loadAll = useCallback(async () => {
    const f = async (url, lsKey, fb=[]) => {
      try {
        const r = await fetch(api(url));
        if (r.ok) {
          const d = await r.json();
          if (d && (Array.isArray(d) ? d.length > 0 : true)) {
            if (lsKey) localStorage.setItem(lsKey, JSON.stringify(d));
            return d;
          }
        }
      } catch {}
      return getLS(lsKey, fb);
    };

    const [cust, inv, prts, stf, sal, pHist, sdArr] = await Promise.all([
      f('/api/customers','sharedCustomerData'),
      f('/api/invoices','invoices'),
      f('/api/parts','partsInventory'),
      f('/api/staff','staffData'),
      f('/api/salaries',null, []),
      f('/api/parts/history/all', null, []),
      f('/api/service-data', null, []),
    ]);

    setCustomers(cust);
    const lsGenInv = getLS('generatedInvoices', []);
    setInvoices([...inv, ...lsGenInv]);
    setParts(prts);
    setStaff(stf);
    setSalaries(sal);
    setPartHistory(pHist);

    // Merge serviceData (array from MongoDB + object from localStorage)
    const sdMap = { ...getLS('customerServiceData', {}) };
    sdArr.forEach(r => { sdMap[r.regNo || r._id] = r; });
    setServiceData(sdMap);

    setLastUpd(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
    const t = setInterval(loadAll, 30000);
    const onSync = () => loadAll();
    window.addEventListener('storage', onSync);
    return () => { clearInterval(t); window.removeEventListener('storage', onSync); };
  }, [loadAll]);

  // ── Universal Date Filter ────────────────────────────────────────────────
  const matchDate = useCallback((dateStr) => {
    if (!dateStr) return yr === "All" && mo === "All" && dy === "All";
    try {
      const dt = new Date(dateStr);
      if (isNaN(dt.getTime())) return false;
      if (yr !== "All" && dt.getFullYear() !== Number(yr)) return false;
      if (mo !== "All" && MONTH_NUM[mo] && (dt.getMonth() + 1) !== MONTH_NUM[mo]) return false;
      if (dy !== "All" && dt.getDate() !== Number(dy)) return false;
      return true;
    } catch { return false; }
  }, [yr, mo, dy]);

  // ── Derived data ─────────────────────────────────────────────────────────
  const filtInvoices = useMemo(() => {
    if (yr === "All" && mo === "All" && dy === "All") return invoices;
    return invoices.filter(i => matchDate(i.invoiceDate || i.date || i.importedAt));
  }, [invoices, matchDate, yr, mo, dy]);

  const filtCustomers = useMemo(() => {
    if (yr === "All" && mo === "All" && dy === "All") return customers;
    return customers.filter(c => matchDate(c.invoiceDate || c.purchaseDate || c.createdAt));
  }, [customers, matchDate, yr, mo, dy]);

  const vehInvoices = useMemo(() => filtInvoices.filter(i => i.invoiceType === 'vehicle' || (i.totals?.totalAmount || i.amount || 0) >= 50000), [filtInvoices]);
  const svcInvoices = useMemo(() => filtInvoices.filter(i => i.invoiceType !== 'vehicle' && (i.totals?.totalAmount || i.amount || 0) < 50000), [filtInvoices]);
  const vehInvTotal = useMemo(() => vehInvoices.reduce((s, i) => s + (i.totals?.totalAmount || i.amount || 0), 0), [vehInvoices]);
  const svcInvTotal = useMemo(() => svcInvoices.reduce((s, i) => s + (i.totals?.totalAmount || i.amount || 0), 0), [svcInvoices]);

  // P&L rollup
  const plData = useMemo(() => buildSummaryPL(overrides).filter(r => {
    if (yr !== "All" && r.y !== Number(yr)) return false;
    if (mo !== "All" && r.m !== mo) return false;
    return true;
  }), [overrides, yr, mo]);

  const totalPft = plData.reduce((s, r) => s + r.pft, 0);
  const totalRev = plData.reduce((s, r) => s + r.access + r.rto + r.ins + r.service, 0);
  const totalExp = plData.reduce((s, r) => s + Math.abs(r.rent) + Math.abs(r.other) + Math.abs(r.parts) + Math.abs(r.gift) + Math.abs(r.accesory), 0);

  // Vehicle models
  const vehModels = useMemo(() => {
    const map = {};
    filtCustomers.forEach(c => {
      const m = (c.vehicleModel || c.linkedVehicle?.name || '').split(' ').slice(0, 2).join(' ');
      if (m) map[m] = (map[m] || 0) + 1;
    });
    return Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
  }, [filtCustomers]);

  // Parts consumption stats
  const partStats = useMemo(() => {
    const filt = partHistory.filter(p => !p.reverted && matchDate(p.consumedAt || p.createdAt));
    const byName = {};
    filt.forEach(c => {
      const k = c.partName || c.partNumber || 'Unknown';
      if (!byName[k]) byName[k] = { name: k, qty: 0, value: 0 };
      byName[k].qty += c.quantity || 1;
      byName[k].value += c.totalValue || 0;
    });
    return {
      top: Object.values(byName).sort((a,b) => b.qty-a.qty).slice(0, 8),
      totalQty: Object.values(byName).reduce((s,p) => s+p.qty, 0),
      totalValue: Object.values(byName).reduce((s,p) => s+p.value, 0),
      entries: filt.length,
    };
  }, [partHistory, matchDate]);

  // Parts inventory status
  const partsInv = useMemo(() => {
    const out = parts.filter(p => Number(p.stock||p.quantity||0) <= 0);
    const low = parts.filter(p => {
      const s = Number(p.stock||p.quantity||0);
      const m = Number(p.minStock||0);
      return m > 0 && s > 0 && s <= m;
    });
    const stockValue = parts.reduce((s,p) => s + ((p.mrp||p.unitPrice||0) * (Number(p.stock||p.quantity)||0)), 0);
    return { out, low, stockValue, total: parts.length };
  }, [parts]);

  // Salary stats
  const salStats = useMemo(() => {
    const filt = salaries.filter(s => !s.cancelled && matchDate(s.paymentDate));
    const salary   = filt.filter(s => s.type === 'salary').reduce((sum, s) => sum + (s.amount||0), 0);
    const advance  = filt.filter(s => s.type === 'advance').reduce((sum, s) => sum + (s.amount||0), 0);
    const bonus    = filt.filter(s => s.type === 'bonus' || s.type === 'incentive').reduce((sum, s) => sum + (s.amount||0), 0);
    const deduct   = filt.filter(s => s.type === 'deduction').reduce((sum, s) => sum + (s.amount||0), 0);
    const totalDue = staff.reduce((s, x) => s + Number(x.monthlySalary||0), 0);
    return { salary, advance, bonus, deduct, totalDue, total: salary + advance + bonus };
  }, [salaries, staff, matchDate]);

  // Pending payments
  const pendStats = useMemo(() => {
    let amt = 0, count = 0, overdue = 0;
    const today = new Date(); today.setHours(0,0,0,0);
    Object.values(serviceData).forEach(d => {
      const a = parseFloat(d.pendingAmount || 0);
      if (a > 0 && !d.paymentReceivedDate) {
        amt += a;
        count++;
        if (d.paymentDueDate && new Date(d.paymentDueDate) < today) overdue++;
      }
    });
    return { amt, count, overdue };
  }, [serviceData]);

  // Smart alerts
  const alerts = {
    outStock: partsInv.out.length,
    lowStock: partsInv.low.length,
    pendingPay: pendStats.overdue,
    loss: totalPft < 0 ? 1 : 0,
  };
  const alertTotal = Object.values(alerts).reduce((s,v) => s+v, 0);

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
      <div style={{ textAlign:'center' }}>
        <Activity size={48} className="animate-spin mx-auto mb-3" color="#06b6d4"/>
        <p style={{ color:'#94a3b8' }}>VP Command Center loading...</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(180deg, #0f172a 0%, #020617 100%)', color:'#f8fafc', padding:'20px' }}>
      <div style={{ maxWidth:'1400px', margin:'0 auto' }}>

        {/* ─── HEADER ─── */}
        <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'space-between', alignItems:'center', gap:16, marginBottom:18 }}>
          <div>
            <h1 style={{ fontSize:28, fontWeight:900, background:'linear-gradient(90deg, #f97316, #ef4444, #a855f7)', WebkitBackgroundClip:'text', color:'transparent', margin:0 }}>
              🏍️ VP Honda Command Center
            </h1>
            <p style={{ color:'#94a3b8', fontSize:12, marginTop:4, display:'flex', alignItems:'center', gap:6 }}>
              <Activity size={11} className="text-green-400 animate-pulse"/>
              Live Command Center • Last sync: {lastUpd.toLocaleTimeString('en-IN')}
            </p>
          </div>
          <button onClick={loadAll}
            style={{ background:'linear-gradient(135deg, #f97316, #ef4444)', color:'#fff', padding:'10px 20px', borderRadius:12, fontWeight:700, fontSize:13, border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 14px rgba(239,68,68,0.4)' }}>
            <RefreshCw size={15}/> Refresh
          </button>
        </div>

        {/* ─── FILTERS ─── */}
        <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
          <Filter size={14} color="#94a3b8"/>
          <select value={yr} onChange={e=>setYr(e.target.value==="All"?"All":parseInt(e.target.value))}
            style={{ background:'#1e293b', border:'1px solid #334155', color:'#f8fafc', padding:'8px 12px', borderRadius:10, fontSize:12 }}>
            {YEARS.map(y => <option key={y} value={y}>{y === "All" ? "All Years" : y}</option>)}
          </select>
          <select value={mo} onChange={e=>setMo(e.target.value)}
            style={{ background:'#1e293b', border:'1px solid #334155', color:'#f8fafc', padding:'8px 12px', borderRadius:10, fontSize:12 }}>
            {MONTHS.map(m => <option key={m} value={m}>{m === "All" ? "All Months" : m}</option>)}
          </select>
          <select value={dy} onChange={e=>setDy(e.target.value)}
            style={{ background:'#1e293b', border:'1px solid #334155', color:'#f8fafc', padding:'8px 12px', borderRadius:10, fontSize:12 }}>
            {DAYS.map(d => <option key={d} value={d}>{d === "All" ? "All Days" : d}</option>)}
          </select>
          {(yr!=="All" || mo!=="All" || dy!=="All") && (
            <button onClick={() => { setYr("All"); setMo("All"); setDy("All"); }}
              style={{ background:'#ef444422', border:'1px solid #ef444466', color:'#fca5a5', padding:'6px 10px', borderRadius:8, fontSize:11, cursor:'pointer' }}>
              Clear Filters
            </button>
          )}
        </div>

        {/* ─── ALERT STRIP ─── */}
        {alertTotal > 0 && (
          <div style={{ background:'linear-gradient(90deg, #7f1d1d22, #78350f22)', border:'1px solid #ef444440', borderRadius:14, padding:'12px 16px', marginBottom:18, display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ background:'#ef4444', borderRadius:10, padding:6 }}>
              <AlertTriangle size={16} color="#fff"/>
            </div>
            <span style={{ color:'#fecaca', fontSize:11, fontWeight:700 }}>ALERTS:</span>
            {alerts.outStock > 0 && <AlertChip color="#ef4444" label={`${alerts.outStock} Out of Stock`} onClick={()=>navigate('/parts')}/>}
            {alerts.lowStock > 0 && <AlertChip color="#f97316" label={`${alerts.lowStock} Low Stock`}    onClick={()=>navigate('/parts')}/>}
            {alerts.pendingPay > 0 && <AlertChip color="#eab308" label={`${alerts.pendingPay} Overdue Payments`} onClick={()=>navigate('/reminders')}/>}
            {alerts.loss > 0 && <AlertChip color="#dc2626" label={`Loss: ${fmtINR(totalPft)}`} onClick={()=>setTab('profit')}/>}
          </div>
        )}

        {/* ─── TABS ─── */}
        <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{
                  background: active ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? '#fdba74' : 'rgba(255,255,255,0.08)'}`,
                  color: active ? '#fff' : '#94a3b8', padding:'9px 14px', borderRadius:10,
                  fontSize:12, fontWeight:700, cursor:'pointer',
                  boxShadow: active ? '0 4px 14px rgba(249,115,22,0.4)' : 'none',
                }}>
                {t.icon} {t.label}
              </button>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ══ TAB: OVERVIEW ══ */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {tab === 'overview' && (
          <div style={{ display:'grid', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>
              <K icon={DollarSign} label="Net Profit/Loss" value={totalPft} sub={`${plData.length} months`} color="#22c55e"/>
              <K icon={TrendingUp} label="Revenue" value={totalRev} sub="from sales" color="#3b82f6"/>
              <K icon={TrendingDown} label="Expenses" value={-totalExp} sub="rent, parts, etc" color="#ef4444"/>
              <K icon={Users} label="Customers" value={filtCustomers.length} sub={`${customers.length} total`} color="#a855f7" onClick={() => navigate('/customers')}/>
              <K icon={Bike} label="Vehicles Sold" value={vehInvoices.length} sub={fmtINR(vehInvTotal)} color="#f97316" onClick={() => navigate('/veh-dashboard')}/>
              <K icon={Wrench} label="Service Revenue" value={svcInvTotal} sub={`${svcInvoices.length} invoices`} color="#06b6d4"/>
              <K icon={Package} label="Parts Inventory" value={partsInv.total} sub={fmtINR(partsInv.stockValue)} color="#8b5cf6" alert={partsInv.out.length > 0 ? `${partsInv.out.length} out` : null} onClick={() => navigate('/parts')}/>
              <K icon={CreditCard} label="Pending Amount" value={pendStats.amt} sub={`${pendStats.count} customers`} color="#f59e0b" alert={pendStats.overdue > 0 ? `${pendStats.overdue} overdue` : null} onClick={() => navigate('/reminders')}/>
            </div>

            {/* Main charts */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(400px, 1fr))', gap:14 }}>
              <Card>
                <SH title="💹 P&L Trend" sub="Monthly profit/loss"/>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={plData}>
                    <defs>
                      <linearGradient id="pft" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5}/>
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                    <XAxis dataKey="m" tick={{ fill:'#94a3b8', fontSize:10 }}/>
                    <YAxis tick={{ fill:'#94a3b8', fontSize:10 }} tickFormatter={fmtINR}/>
                    <Tooltip content={<Tip/>}/>
                    <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3"/>
                    <Area type="monotone" dataKey="pft" stroke="#22c55e" fill="url(#pft)" strokeWidth={2} name="Profit/Loss"/>
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <SH title="🏍️ Vehicle Models" sub="Sales distribution"/>
                {vehModels.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={vehModels} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} label={({value}) => value}>
                        {vehModels.map((_,i) => <Cell key={i} fill={PC[i % PC.length]}/>)}
                      </Pie>
                      <Tooltip content={<Tip/>}/>
                      <Legend wrapperStyle={{ fontSize: 10, color:'#94a3b8' }}/>
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p style={{ color:'#64748b', textAlign:'center', padding:'50px 0' }}>No data</p>}
              </Card>
            </div>

            {/* Quick navigation */}
            <Card>
              <SH title="⚡ Quick Navigation"/>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:8 }}>
                {[
                  { l:'🔔 Reminders',     p:'/reminders',              g:'linear-gradient(135deg,#dc2626,#991b1b)' },
                  { l:'📄 Invoices',      p:'/invoice-management',     g:'linear-gradient(135deg,#ea580c,#9a3412)' },
                  { l:'🎫 Job Cards',     p:'/job-cards',              g:'linear-gradient(135deg,#0284c7,#075985)' },
                  { l:'👥 Customers',     p:'/customers',              g:'linear-gradient(135deg,#2563eb,#1e40af)' },
                  { l:'📦 Parts',         p:'/parts',                  g:'linear-gradient(135deg,#a855f7,#7e22ce)' },
                  { l:'👔 Staff',         p:'/staff-management',       g:'linear-gradient(135deg,#059669,#065f46)' },
                  { l:'🔍 Diagnostic',    p:'/diagnostic',             g:'linear-gradient(135deg,#0891b2,#155e75)' },
                  { l:'📈 Reports',       p:'/reports',                g:'linear-gradient(135deg,#7c3aed,#5b21b6)' },
                ].map((x,i) => (
                  <button key={i} onClick={() => navigate(x.p)}
                    style={{ background:x.g, padding:'11px 12px', borderRadius:10, color:'#fff', fontSize:12, fontWeight:700, border:'none', cursor:'pointer', transition:'all 0.2s' }}
                    className="hover:scale-105">
                    {x.l}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ══ TAB: PROFIT & LOSS ══ */}
        {tab === 'profit' && (
          <div style={{ display:'grid', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>
              <K icon={TrendingUp} label="Total Revenue" value={totalRev} sub="from all sources" color="#22c55e"/>
              <K icon={TrendingDown} label="Total Expenses" value={-totalExp} sub="all outflows" color="#ef4444"/>
              <K icon={DollarSign} label="Net Profit" value={totalPft} sub={totalPft>0 ? 'PROFIT' : 'LOSS'} color={totalPft > 0 ? '#22c55e' : '#ef4444'}/>
              <K icon={Award} label="Months in Profit" value={plData.filter(r => r.pft > 0).length + '/' + plData.length} color="#3b82f6"/>
            </div>
            <Card>
              <SH title="📊 Monthly Profit/Loss" sub="Revenue vs Expenses"/>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={plData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                  <XAxis dataKey="m" tick={{ fill:'#94a3b8', fontSize:10 }}/>
                  <YAxis tick={{ fill:'#94a3b8', fontSize:10 }} tickFormatter={fmtINR}/>
                  <Tooltip content={<Tip/>}/>
                  <Legend wrapperStyle={{ fontSize:11 }}/>
                  <ReferenceLine y={0} stroke="#64748b"/>
                  <Bar dataKey="pft" name="Profit/Loss" radius={[6,6,0,0]}>
                    {plData.map((e,i) => <Cell key={i} fill={e.pft > 0 ? '#22c55e' : '#ef4444'}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <SH title="💰 Revenue Streams"/>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={plData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                  <XAxis dataKey="m" tick={{ fill:'#94a3b8', fontSize:10 }}/>
                  <YAxis tick={{ fill:'#94a3b8', fontSize:10 }} tickFormatter={fmtINR}/>
                  <Tooltip content={<Tip/>}/>
                  <Legend wrapperStyle={{ fontSize:11 }}/>
                  <Bar dataKey="access"  name="Accessories" stackId="rev" fill="#3b82f6"/>
                  <Bar dataKey="rto"     name="RTO"         stackId="rev" fill="#a855f7"/>
                  <Bar dataKey="ins"     name="Insurance"   stackId="rev" fill="#f59e0b"/>
                  <Bar dataKey="service" name="Service"     stackId="rev" fill="#10b981"/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* ══ TAB: VEHICLES ══ */}
        {tab === 'vehicles' && (
          <div style={{ display:'grid', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>
              <K icon={Bike} label="Vehicles Sold" value={vehInvoices.length} sub={fmtINR(vehInvTotal)} color="#3b82f6"/>
              <K icon={Users} label="Customers" value={filtCustomers.length} color="#10b981"/>
              <K icon={DollarSign} label="Avg Vehicle Value" value={vehInvoices.length > 0 ? vehInvTotal / vehInvoices.length : 0} color="#f59e0b"/>
              <K icon={Award} label="Top Model" value={vehModels[0]?.name || '—'} sub={vehModels[0]?.value + ' units'} color="#a855f7"/>
            </div>
            <Card>
              <SH title="🏍️ Vehicle Models Distribution"/>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={vehModels} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                  <XAxis type="number" tick={{ fill:'#94a3b8', fontSize:10 }}/>
                  <YAxis type="category" dataKey="name" width={150} tick={{ fill:'#94a3b8', fontSize:10 }}/>
                  <Tooltip content={<Tip/>}/>
                  <Bar dataKey="value" fill="#3b82f6" radius={[0,4,4,0]} name="Units Sold"/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* ══ TAB: CUSTOMERS ══ */}
        {tab === 'customers' && (
          <div style={{ display:'grid', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>
              <K icon={Users} label="Total Customers" value={customers.length} color="#3b82f6"/>
              <K icon={TrendingUp} label="New (filtered period)" value={filtCustomers.length} color="#22c55e"/>
              <K icon={CreditCard} label="Pending Amount" value={pendStats.amt} sub={`${pendStats.count} customers`} color="#ef4444" onClick={() => navigate('/reminders')}/>
              <K icon={AlertTriangle} label="Overdue Payments" value={pendStats.overdue} color="#f59e0b" onClick={() => navigate('/reminders')}/>
            </div>
            <Card>
              <SH title="📊 Customer Insights" action={
                <button onClick={() => navigate('/customers')} style={{ background:'#3b82f622', border:'1px solid #3b82f655', color:'#93c5fd', padding:'6px 12px', borderRadius:8, fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                  View All <ArrowUpRight size={11}/>
                </button>
              }/>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div>
                  <p style={{ color:'#94a3b8', fontSize:11, marginBottom:8 }}>Top Vehicle Models Bought</p>
                  {vehModels.slice(0, 5).map((m,i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                      <div style={{ width:24, height:24, borderRadius:6, background:PC[i], color:'#fff', fontSize:11, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center' }}>{i+1}</div>
                      <span style={{ color:'#e2e8f0', fontSize:12, flex:1 }}>{m.name}</span>
                      <span style={{ color:'#94a3b8', fontSize:12, fontWeight:700 }}>{m.value}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p style={{ color:'#94a3b8', fontSize:11, marginBottom:8 }}>Activity Summary</p>
                  <div style={{ background:'#1e293b', padding:12, borderRadius:10, marginBottom:8 }}>
                    <p style={{ color:'#94a3b8', fontSize:10 }}>AVERAGE PAYMENT</p>
                    <p style={{ color:'#f8fafc', fontSize:20, fontWeight:900 }}>{fmtINR(vehInvoices.length > 0 ? vehInvTotal / vehInvoices.length : 0)}</p>
                  </div>
                  <div style={{ background:'#1e293b', padding:12, borderRadius:10 }}>
                    <p style={{ color:'#94a3b8', fontSize:10 }}>SERVICE REPEAT RATE</p>
                    <p style={{ color:'#f8fafc', fontSize:20, fontWeight:900 }}>
                      {customers.length > 0 ? Math.round((svcInvoices.length / customers.length) * 100) : 0}%
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ══ TAB: PARTS & SERVICE ══ */}
        {tab === 'parts' && (
          <div style={{ display:'grid', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>
              <K icon={Package} label="Total Parts"       value={partsInv.total}         sub="in inventory" color="#3b82f6" onClick={() => navigate('/parts')}/>
              <K icon={DollarSign} label="Stock Value"    value={partsInv.stockValue}    sub="current stock" color="#22c55e"/>
              <K icon={AlertTriangle} label="Out of Stock" value={partsInv.out.length}   sub="reorder!" color="#ef4444" onClick={() => navigate('/parts')}/>
              <K icon={AlertTriangle} label="Low Stock"   value={partsInv.low.length}    sub="below min" color="#f97316" onClick={() => navigate('/parts')}/>
              <K icon={Activity} label="Parts Consumed"   value={partStats.totalQty}     sub={fmtINR(partStats.totalValue)} color="#06b6d4"/>
              <K icon={Wrench} label="Service Invoices"   value={svcInvoices.length}     sub={fmtINR(svcInvTotal)} color="#a855f7"/>
            </div>
            <Card>
              <SH title="📦 Top 8 Most Used Parts" sub={`${partStats.entries} consumption entries`}/>
              {partStats.top.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={partStats.top} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                    <XAxis type="number" tick={{ fill:'#94a3b8', fontSize:10 }}/>
                    <YAxis type="category" dataKey="name" width={160} tick={{ fill:'#94a3b8', fontSize:10 }}/>
                    <Tooltip content={<Tip/>}/>
                    <Bar dataKey="qty" fill="#a855f7" radius={[0,4,4,0]} name="Qty Used"/>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p style={{ color:'#64748b', textAlign:'center', padding:'40px 0', fontSize:13 }}>
                  अभी तक parts का use नहीं हुआ<br/>
                  <span style={{ fontSize:10 }}>Job Card से invoice generate होने पर यहाँ दिखेगा</span>
                </p>
              )}
            </Card>
          </div>
        )}

        {/* ══ TAB: INSURANCE & RTO ══ */}
        {tab === 'insurance' && (
          <div style={{ display:'grid', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>
              <K icon={Shield} label="Insurance Entries" value={INS_DATA.totalEntries} sub={fmtINR(INS_DATA.collected)} color="#3b82f6"/>
              <K icon={DollarSign} label="Insurance Profit" value={INS_DATA.profit} sub={`${Math.round((INS_DATA.profit/INS_DATA.collected)*100)}% margin`} color="#22c55e"/>
              <K icon={Award} label="RTO Entries" value={RTO_DATA.totalEntries} sub={fmtINR(RTO_DATA.collected)} color="#a855f7"/>
              <K icon={TrendingUp} label="RTO Profit" value={RTO_DATA.profit} sub={`${Math.round((RTO_DATA.profit/RTO_DATA.collected)*100)}% margin`} color="#10b981"/>
            </div>
            <Card>
              <SH title="📊 Insurance vs RTO"/>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={[
                  { name:'Collected', Insurance: INS_DATA.collected, RTO: RTO_DATA.collected },
                  { name:'Expense',   Insurance: INS_DATA.payout, RTO: RTO_DATA.deposit },
                  { name:'Profit',    Insurance: INS_DATA.profit, RTO: RTO_DATA.profit },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                  <XAxis dataKey="name" tick={{ fill:'#94a3b8', fontSize:11 }}/>
                  <YAxis tick={{ fill:'#94a3b8', fontSize:10 }} tickFormatter={fmtINR}/>
                  <Tooltip content={<Tip/>}/>
                  <Legend/>
                  <Bar dataKey="Insurance" fill="#3b82f6" radius={[4,4,0,0]}/>
                  <Bar dataKey="RTO" fill="#a855f7" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* ══ TAB: PAYROLL ══ */}
        {tab === 'salary' && (
          <div style={{ display:'grid', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>
              <K icon={Award} label="Salary Paid" value={salStats.salary} sub="this period" color="#22c55e"/>
              <K icon={DollarSign} label="Advance Given" value={salStats.advance} color="#f97316"/>
              <K icon={TrendingUp} label="Bonus/Incentive" value={salStats.bonus} color="#3b82f6"/>
              <K icon={Users} label="Staff Count" value={staff.length} sub={fmtINR(salStats.totalDue) + ' monthly'} color="#a855f7" onClick={() => navigate('/staff-management')}/>
            </div>
            <Card>
              <SH title="💰 Payroll Summary" action={
                <button onClick={() => navigate('/staff-management')} style={{ background:'#a855f722', border:'1px solid #a855f755', color:'#d8b4fe', padding:'6px 12px', borderRadius:8, fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                  Manage <ArrowUpRight size={11}/>
                </button>
              }/>
              {staff.length === 0 ? (
                <p style={{ color:'#64748b', textAlign:'center', padding:40 }}>No staff added yet</p>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', fontSize:12 }}>
                    <thead>
                      <tr style={{ color:'#94a3b8', fontSize:10, textTransform:'uppercase', borderBottom:'1px solid #334155' }}>
                        <th style={{ padding:10, textAlign:'left' }}>Staff</th>
                        <th style={{ padding:10, textAlign:'left' }}>Position</th>
                        <th style={{ padding:10, textAlign:'right' }}>Monthly</th>
                        <th style={{ padding:10, textAlign:'right' }}>Paid</th>
                        <th style={{ padding:10, textAlign:'right' }}>Advance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.map((s,i) => {
                        const paid = salaries.filter(p => String(p.staffId) === String(s.id) && p.type === 'salary').reduce((sum, p) => sum + (p.amount||0), 0);
                        const adv  = salaries.filter(p => String(p.staffId) === String(s.id) && p.type === 'advance').reduce((sum, p) => sum + (p.amount||0), 0);
                        return (
                          <tr key={i} style={{ borderBottom:'1px solid #1e293b' }}>
                            <td style={{ padding:'8px 10px', color:'#e2e8f0', fontWeight:700 }}>{s.name}</td>
                            <td style={{ padding:'8px 10px', color:'#94a3b8' }}>{s.position || '—'}</td>
                            <td style={{ padding:'8px 10px', color:'#93c5fd', textAlign:'right', fontWeight:700 }}>{fmtINR(s.monthlySalary || 0)}</td>
                            <td style={{ padding:'8px 10px', color:'#86efac', textAlign:'right', fontWeight:700 }}>{fmtINR(paid)}</td>
                            <td style={{ padding:'8px 10px', color:'#fdba74', textAlign:'right', fontWeight:700 }}>{fmtINR(adv)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Small helper component: Alert Chip ─────────────────────────────────────
function AlertChip({ color, label, onClick }) {
  return (
    <div onClick={onClick}
      style={{ background:`${color}22`, border:`1px solid ${color}66`, borderRadius:10, padding:'4px 10px', display:'flex', alignItems:'center', gap:4, cursor:'pointer' }}
      className="hover:scale-105">
      <span style={{ color, fontSize:11, fontWeight:700 }}>{label}</span>
      <ChevronRight size={12} color={color}/>
    </div>
  );
}