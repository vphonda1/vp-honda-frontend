// VPHondaDashboard.jsx
// ✅ Live data from MongoDB (customers, vehicles, parts, service, insurance, RTO)
// ✅ Profit/Loss from Excel Summary sheet (salary/rent expenses)
// ✅ Auto-refresh every 30 seconds
// ✅ Year / Month / Day filter

import { useState, useEffect, useCallback, useMemo } from "react";
import { API_BASE, api } from '../utils/apiConfig';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Legend, ReferenceLine
} from "recharts";

// PROFIT/LOSS --- from Excel Summary Sheet (Salary/Rent/Other expenses) ---
// These are NOT in MongoDB. Update here manually when Excel data changes.
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
  {m:"Mar",y:2026,veh:12,  access:57337,  rto:35323,   ins:4332, gift:0, accesory:0, rent:-66095,  other:-3800,   parts:-23437, service:18171, pft:30023   },
  {m:"Apr",y:2026,veh:3,  access:4813,  rto:0,   ins:2571, gift:0, accesory:0, rent:-15800,  other:-0,   parts:-3838, service:0, pft:-12254   },
];

// localStorage helpers
const LS_KEY = "vph_expense_overrides";
const loadOverrides = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch(e) { return {}; }
};
const saveOverrides = (obj) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch(e) {}
};
const buildSummaryPL = (overrides) => BASE_SUMMARY_PL.map(row => {
  const key = row.y + "-" + row.m;
  const ov = overrides[key] || {};
  const gift  = ov.gift  !== undefined ? -Math.abs(Number(ov.gift))  : row.gift;
  const accesory  = ov.accesory  !== undefined ? -Math.abs(Number(ov.accesory))  : row.accesory;
  const rent  = ov.rent  !== undefined ? -Math.abs(Number(ov.rent))  : row.rent;
  const other = ov.other !== undefined ? -Math.abs(Number(ov.other)) : row.other;
  const parts = ov.parts !== undefined ? -Math.abs(Number(ov.parts)) : row.parts;
  const pft = row.access + row.rto + row.ins + row.service + gift + accesory + rent + other + parts;
  return { ...row, gift, accesory, rent, other, parts, pft };
});


// Excel Insurance/RTO sheet data (historical --- from Excel)
const INS_DATA = { totalEntries:233, collected:1454262, payout:395658, profit:1058604 };
const RTO_DATA = { totalEntries:228, collected:2441859, deposit:564343, profit:1877516 };
const PARTS_DATA = { entries:218, mrpTotal:57219, saleTotal:48798, taxableTotal:45567 };

const API = API_BASE + "/api";
const PC = ["#f97316","#3b82f6","#10b981","#8b5cf6","#ef4444","#06b6d4","#f59e0b","#84cc16","#64748b","#e879f9","#fb7185","#a3e635"];
const TABS = [
  {id:"overview",  icon:"📊", label:"Overview"},
  {id:"profit",    icon:"💹", label:"Profit/Loss"},
  {id:"vehicles",  icon:"🏍", label:"Vehicles"},
  {id:"customers", icon:"👥", label:"Customers"},
  {id:"parts",     icon:"🔧", label:"Parts & Service"},
  {id:"insurance", icon:"🛡", label:"Insurance"},
  {id:"rto",       icon:"🏛", label:"RTO"},
  {id:"vehInvoice",       icon:"📊", label:"Veh Tax Invoice"},
  {id:"partsInvoice",       icon:"📊", label:"Parts Tax Invoice"},
  {id:"geography", icon:"📍", label:"Geography"},
];
const YEARS  = ["All", 2024, 2025, 2026];
const MONTHS = ["All","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_NUM = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
const DAYS = ["All",...Array.from({length:31},(_,i)=>i+1)];

const fmtINR = n => {
  const abs = Math.abs(n), sg = n < 0 ? "-" : "";
  if (abs >= 1e7) return `${sg}₹${(abs/1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sg}₹${(abs/1e5).toFixed(2)}L`;
  return `${sg}₹${Math.round(abs).toLocaleString('en-IN')}`;
};

// UI Components ---
const Tip = ({active,payload,label}) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:"#0c1220",border:"1px solid #1e293b",borderRadius:10,padding:"10px 14px",fontSize:12}}>
      <p style={{color:"#94a3b8",margin:"0 0 5px",fontWeight:700}}>{label}</p>
      {payload.map((p,i)=><p key={i} style={{color:p.color||"#f1f5f9",margin:"2px 0"}}>{p.name}: <b>{typeof p.value==="number"&&Math.abs(p.value)>999?fmtINR(p.value):p.value}</b></p>)}
    </div>
  );
};
const Card = ({children,style={}}) => (
  <div style={{background:"linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))",border:"1px solid rgba(255,255,255,0.07)",borderRadius:18,padding:22,...style}}>{children}</div>
);
const SH = ({title,sub}) => (
  <div style={{marginBottom:14}}>
    <h3 style={{color:"#f1f5f9",fontSize:14,fontWeight:800,margin:0}}>{title}</h3>
    {sub&&<p style={{color:"#475569",fontSize:11,margin:"3px 0 0"}}>{sub}</p>}
  </div>
);
const K = ({icon,label,value,sub,color}) => {
  const isNeg = typeof value==="number"&&value<0;
  const col = isNeg?"#ef4444":color;
  return (
    <div style={{background:`linear-gradient(135deg,${col}18,${col}08)`,border:`1px solid ${col}28`,borderRadius:16,padding:"15px 18px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-16,right:-16,width:65,height:65,borderRadius:"50%",background:col,opacity:0.1}}/>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}>
        <div style={{width:33,height:33,borderRadius:10,background:col,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>{icon}</div>
        <span style={{color:"#64748b",fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>{label}</span>
      </div>
      <div style={{fontSize:21,fontWeight:900,color:isNeg?"#ef4444":"#f1f5f9",letterSpacing:-0.5,lineHeight:1.1}}>
        {typeof value==="number"?fmtINR(value):value}
      </div>
      {sub&&<div style={{color:"#475569",fontSize:10,marginTop:4}}>{sub}</div>}
      {typeof value==="number"&&<div style={{fontSize:10,fontWeight:700,marginTop:3,color:isNeg?"#ef4444":"#10b981"}}>{isNeg?"❌ LOSS":"✅ PROFIT"}</div>}
    </div>
  );
};
const PBar = ({label,value,maxV,color}) => {
  const isNeg = typeof value==="number"&&value<0;
  return (
    <div style={{marginBottom:11}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{color:"#94a3b8",fontSize:11}}>{label}</span>
        <span style={{color:isNeg?"#ef4444":color,fontWeight:800,fontSize:11}}>{typeof value==="number"?fmtINR(value):value}</span>
      </div>
      <div style={{height:6,background:"rgba(255,255,255,0.07)",borderRadius:6}}>
        <div style={{height:"100%",borderRadius:6,background:isNeg?"#ef4444":color,width:`${Math.min(Math.abs(value/(maxV||1))*100,100)}%`,transition:"width 1s"}}/>
      </div>
    </div>
  );
};

// Auto-Update Status Box ---
const AutoUpdateInfo = () => (
  <div style={{background:"rgba(16,185,129,0.07)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:12,padding:"14px 18px",marginBottom:16}}>
    <div style={{color:"#10b981",fontWeight:800,fontSize:12,marginBottom:10}}>⚡ AUTO-UPDATE STATUS</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:8,fontSize:11}}>
      {[
        {icon:"✅",text:"नया Customer add → तुरंत दिखेगा"},
        {icon:"✅",text:"नया Vehicle add → तुरंत दिखेगा"},
        {icon:"✅",text:"Service Invoice (Job Card) → तुरंत"},
        {icon:"✅",text:"Parts Management में add → तुरंत"},
        {icon:"✅",text:"Insurance/RTO app में → तुरंत"},
        {icon:"⚠️",text:"Salary/Rent/Gift/Accesory/Other Expense → Manual update"},
      ].map((item,i)=>(
        <div key={i} style={{color:item.icon==="✅"?"#94a3b8":"#f59e0b"}}>{item.icon} {item.text}</div>
      ))}
    </div>
    <div style={{color:"#475569",fontSize:10,marginTop:8}}>🔄 हर 30 seconds में auto-refresh | ऊपर Refresh button से manual refresh</div>
  </div>
);

// MAIN DASHBOARD ---
export default function VPHondaDashboard() {
  const [tab,setTab]   = useState("overview");
  const [yr,setYr]     = useState("All");
  const [mo,setMo]     = useState("All");
  const [dy,setDy]     = useState("All");
  const [live,setLive] = useState(null);
  const [daily,setDaily] = useState([]);
  const [loading,setLoading] = useState(true);
  const [lastUpd,setLastUpd] = useState(null);
  const [error,setError] = useState(false);

  // ═══════════════════════════════════════════════════════════════════
  // localStorage — ALL data sources (auto-update on any page change)
  // ═══════════════════════════════════════════════════════════════════
  const getLS = (k, fb=[]) => { try { return JSON.parse(localStorage.getItem(k)||'null')||fb; } catch{ return fb; } };
  const [lsInvoices, setLsInvoices] = useState([]);
  const [lsGenInvoices, setLsGenInvoices] = useState([]);
  const [lsVehData, setLsVehData] = useState([]);
  const [lsCustomers, setLsCustomers] = useState([]);
  const [lsParts, setLsParts] = useState([]);
  const [lsStaff, setLsStaff] = useState([]);
  const [lsQuotations, setLsQuotations] = useState([]);
  const [lsOldBikes, setLsOldBikes] = useState([]);
  const [lsServiceData, setLsServiceData] = useState({});

  const loadLocalData = useCallback(async () => {
    // MongoDB PRIMARY — always fetch fresh data
    const doFetch = async (url, lsKey, fb=[]) => {
      try { const r=await fetch(api(url)); if(r.ok){const d=await r.json(); if(d.length>0){if(lsKey)localStorage.setItem(lsKey,JSON.stringify(d)); return d;}} } catch{}
      return getLS(lsKey, fb); // fallback to cache
    };
    let [cust, inv, parts, staff, quot, old] = await Promise.all([
      doFetch('/api/customers','sharedCustomerData'),
      doFetch('/api/invoices','invoices'),
      doFetch('/api/parts','partsInventory'),
      doFetch('/api/staff','staffData'),
      doFetch('/api/quotations','quotations'),
      doFetch('/api/oldbikes','oldBikeData'),
    ]);
    let genInv = getLS('generatedInvoices');
    let veh = cust.length>0 ? cust.map(c=>({vehicleModel:c.vehicleModel,regNo:c.registrationNo,date:c.invoiceDate,customerName:c.customerName})) : getLS('vehDashboardData');
    let svc={}; try { svc=JSON.parse(localStorage.getItem('customerServiceData')||'null')||{}; } catch{}

    setLsInvoices(inv); setLsGenInvoices(genInv); setLsVehData(veh);
    setLsCustomers(cust); setLsParts(parts); setLsStaff(staff);
    setLsQuotations(quot); setLsOldBikes(old); setLsServiceData(svc);
  }, []);

  useEffect(() => {
    loadLocalData();
    const h = () => loadLocalData();
    window.addEventListener('storage', h);
    window.addEventListener('dataSync', h);
    window.addEventListener('vpDataSync', h);
    return () => { window.removeEventListener('storage', h); window.removeEventListener('dataSync', h); window.removeEventListener('vpDataSync', h); };
  }, [loadLocalData]);

  // ═══════════════════════════════════════════════════════════════════
  // Universal Date Filter — Year / Month / Day
  // ═══════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════
  // Filtered Data — vehicles, invoices, customers (by yr/mo/dy)
  // ═══════════════════════════════════════════════════════════════════
  const filtVehData = useMemo(() => {
    if (yr === "All" && mo === "All" && dy === "All") return lsVehData;
    return lsVehData.filter(v => matchDate(v.invoiceDate || v.date || v.purchaseDate || v.createdAt));
  }, [lsVehData, matchDate, yr, mo, dy]);

  const allInvoices = useMemo(() => [...lsInvoices, ...lsGenInvoices], [lsInvoices, lsGenInvoices]);
  const filtInvoices = useMemo(() => {
    if (yr === "All" && mo === "All" && dy === "All") return allInvoices;
    return allInvoices.filter(i => matchDate(i.invoiceDate || i.date || i.importedAt));
  }, [allInvoices, matchDate, yr, mo, dy]);

  const vehInvoices = useMemo(() => filtInvoices.filter(i => i.invoiceType === 'vehicle' || (i.totals?.totalAmount || i.amount || 0) >= 50000), [filtInvoices]);
  const svcInvoices = useMemo(() => filtInvoices.filter(i => i.invoiceType === 'service' || (i.totals?.totalAmount || i.amount || 0) < 50000), [filtInvoices]);
  const vehInvTotal = useMemo(() => vehInvoices.reduce((s, i) => s + (i.totals?.totalAmount || i.amount || 0), 0), [vehInvoices]);
  const svcInvTotal = useMemo(() => svcInvoices.reduce((s, i) => s + (i.totals?.totalAmount || i.amount || 0), 0), [svcInvoices]);

  const filtCustomers = useMemo(() => {
    if (yr === "All" && mo === "All" && dy === "All") return lsCustomers;
    return lsCustomers.filter(c => matchDate(c.invoiceDate || c.purchaseDate || c.date || c.createdAt));
  }, [lsCustomers, matchDate, yr, mo, dy]);

  // Vehicle model breakdown from localStorage (with filter)
  const lsVehModels = useMemo(() => {
    const map = {};
    filtVehData.forEach(v => {
      const m = (v.vehicleModel || v.model || '?').split(' ').slice(0, 3).join(' ');
      map[m] = (map[m] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, short: name.length > 14 ? name.slice(0, 14) : name, value }));
  }, [filtVehData]);

  // Vehicle color breakdown from localStorage
  const lsVehColors = useMemo(() => {
    const map = {};
    filtVehData.forEach(v => {
      const c = v.color || v.vehicleColor || 'Unknown';
      map[c] = (map[c] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [filtVehData]);

  // Monthly invoice aggregation (ALL invoices, not filtered — for charts)
  const monthlyInvData = useMemo(() => {
    const source = (yr === "All" && mo === "All" && dy === "All") ? allInvoices : filtInvoices;
    const map = {};
    source.forEach(inv => {
      const d = inv.invoiceDate || inv.date;
      if (!d) return;
      const dt = new Date(d);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const label = `${MONTHS[dt.getMonth() + 1] || ''}'${String(dt.getFullYear()).slice(2)}`;
      if (!map[key]) map[key] = { key, label, vehCount: 0, vehAmt: 0, svcCount: 0, svcAmt: 0, totalCount: 0, totalAmt: 0 };
      const amt = inv.totals?.totalAmount || inv.amount || 0;
      const isVeh = inv.invoiceType === 'vehicle' || amt >= 50000;
      if (isVeh) { map[key].vehCount++; map[key].vehAmt += amt; }
      else { map[key].svcCount++; map[key].svcAmt += amt; }
      map[key].totalCount++; map[key].totalAmt += amt;
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [allInvoices, filtInvoices, yr, mo, dy]);

  // ═══════════════════════════════════════════════════════════════════
  // Manual Expense Update Modals
  // ═══════════════════════════════════════════════════════════════════
  const [overrides, setOverrides] = useState(() => loadOverrides());
  const [expModal, setExpModal]   = useState(null);
  const [expForm, setExpForm]     = useState({});
  const SUMMARY_PL = useMemo(() => buildSummaryPL(overrides), [overrides]);

  const openExpModal = (type) => {
    const form = {};
    SUMMARY_PL.forEach(r => {
      const key = r.y + "-" + r.m;
      const ov = overrides[key] || {};
      if (type === "salary") form[key] = ov.rent  !== undefined ? Math.abs(ov.rent)  : Math.abs(r.rent);
      if (type === "other")  form[key] = ov.other !== undefined ? Math.abs(ov.other) : Math.abs(r.other);
      if (type === "gift")  form[key] = ov.gift !== undefined ? Math.abs(ov.gift) : Math.abs(r.gift);
      if (type === "accesory")  form[key] = ov.accesory !== undefined ? Math.abs(ov.accesory) : Math.abs(r.accesory);
      if (type === "parts")  form[key] = ov.parts !== undefined ? Math.abs(ov.parts) : Math.abs(r.parts);
    });
    setExpForm(form);
    setExpModal(type);
  };

  const saveExpModal = () => {
    const newOv = { ...overrides };
    SUMMARY_PL.forEach(r => {
      const key = r.y + "-" + r.m;
      if (!newOv[key]) newOv[key] = {};
      if (expModal === "salary") newOv[key].rent  = Number(expForm[key] || 0);
      if (expModal === "other")  newOv[key].other = Number(expForm[key] || 0);
      if (expModal === "gift")  newOv[key].gift = Number(expForm[key] || 0);
      if (expModal === "accesory")  newOv[key].accesory = Number(expForm[key] || 0);
      if (expModal === "parts")  newOv[key].parts = Number(expForm[key] || 0);
    });
    saveOverrides(newOv);
    setOverrides(newOv);
    setExpModal(null);
  };

  const resetExpModal = () => {
    if (!window.confirm("Reset करें? सभी manual changes हट जाएंगे।")) return;
    const newOv = { ...overrides };
    SUMMARY_PL.forEach(r => {
      const key = r.y + "-" + r.m;
      if (newOv[key]) {
        if (expModal === "salary") delete newOv[key].rent;
        if (expModal === "other")  delete newOv[key].other;
        if (expModal === "gift")  delete newOv[key].gift;
        if (expModal === "accesory")  delete newOv[key].accesory;
        if (expModal === "parts")  delete newOv[key].parts;
      }
    });
    saveOverrides(newOv);
    setOverrides(newOv);
    setExpModal(null);
  };

  // ═══════════════════════════════════════════════════════════════════
  // Fetch from backend (MongoDB)
  // ═══════════════════════════════════════════════════════════════════
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const p = new URLSearchParams();
      if (yr!=="All") p.append("year",yr);
      if (mo!=="All") p.append("month",MONTH_NUM[mo]||mo);
      if (dy!=="All") p.append("day",dy);
      const [mainRes, dailyRes] = await Promise.all([
        fetch(`${API}/dashboard?${p}`),
        mo!=="All" ? fetch(`${API}/dashboard/daily?year=${yr}&month=${MONTH_NUM[mo]||mo}`) : Promise.resolve(null),
      ]);
      if (mainRes.ok) {
        setLive(await mainRes.json());
        setLastUpd(new Date());
      } else { setError(true); }
      if (dailyRes?.ok) {
        const dd = await dailyRes.json();
        setDaily(dd.dailyData || []);
      }
    } catch(e) { setError(true); }
    setLoading(false);
    loadLocalData(); // Also refresh localStorage data
  }, [yr,mo,dy,loadLocalData]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, [fetchData]);

  // ═══════════════════════════════════════════════════════════════════
  // Profit/Loss — from Summary sheet (monthly, no day filter)
  // ═══════════════════════════════════════════════════════════════════
  const filtPL = useMemo(() => (SUMMARY_PL||[]).filter(r => {
    if (yr!=="All" && r.y!==Number(yr)) return false;
    if (mo!=="All" && r.m!==mo) return false;
    return true;
  }), [yr,mo,SUMMARY_PL]);

  const tPFT   = filtPL.reduce((s,r)=>s+r.pft,0);
  const tAcc   = filtPL.reduce((s,r)=>s+r.access,0);
  const tRTO_s = filtPL.reduce((s,r)=>s+r.rto,0);
  const tIns_s = filtPL.reduce((s,r)=>s+r.ins,0);
  const tGift = filtPL.reduce((s,r)=>s+r.gift,0);
  const tAccesory = filtPL.reduce((s,r)=>s+r.accesory,0);
  const tRent  = filtPL.reduce((s,r)=>s+r.rent,0);
  const tOther = filtPL.reduce((s,r)=>s+r.other,0);
  const tParts = filtPL.reduce((s,r)=>s+r.parts,0);
  const tServ  = filtPL.reduce((s,r)=>s+r.service,0);
  const tVeh_s = filtPL.reduce((s,r)=>s+r.veh,0);
  const GRAND_PFT = SUMMARY_PL.reduce((s,r)=>s+r.pft,0);

  const plChart = filtPL.map(r=>({...r,label:`${r.m}'${String(r.y).slice(2)}`}));

  // Year summary
  const yrSum = [2024,2025,2026].map(y=>({
    year:y,
    veh:SUMMARY_PL.filter(r=>r.y===y).reduce((s,r)=>s+r.veh,0),
    pft:SUMMARY_PL.filter(r=>r.y===y).reduce((s,r)=>s+r.pft,0),
  }));

  // Chart to show in Overview
  const mainChart = dy!=="All" ? daily.filter(d=>d.day===Number(dy)) : mo!=="All" ? daily : (live?.monthlySales||plChart);

  // ═══════════════════════════════════════════════════════════════════
  // Live stats — merge MongoDB + localStorage (use best available)
  // ═══════════════════════════════════════════════════════════════════
  const totalCust  = live?.totalCustomers || Math.max(lsCustomers.length, filtCustomers.length);
  const filtCustN  = (yr==="All"&&mo==="All"&&dy==="All") ? totalCust : filtCustomers.length;
  const liveVeh    = (live?.vehicleModels?.length > 0 ? live.vehicleModels : lsVehModels) || [];
  const liveColor  = (live?.colorData?.length > 0 ? live.colorData : lsVehColors) || [];
  const liveDist   = live?.districtData   || [];
  const liveFin    = live?.financerData   || [];
  const liveMon    = live?.monthlySales   || [];
  const partsStats   = live?.partsStats   || {count: lsParts.length, stockValue: lsParts.reduce((s,p)=>(s+(p.unitPrice||0)*(p.stock||p.quantity||0)),0)};
  const serviceStats = live?.serviceStats || {total: Object.keys(lsServiceData).length, totalAmount:0};
  const insStats     = live?.insuranceStats || {total:0,totalCollected:0};

  // Filtered vehicle count (day-aware)
  const filtVehCount = filtVehData.length;
  const filtInvCount = filtInvoices.length;

  // Expense Update Modal config
  const modalConfig = {
    salary: { title:"💸 Salary & Rent --- Month-wise Update", label:"Salary + Rent (₹)", color:"#ef4444", hint:"Excel Summary col L --- हर महीने का Salary+Rent डालें (minus नहीं, सिर्फ number)" },
    other:  { title:"💸 Other Expenses --- Month-wise Update", label:"Other Expense (₹)",  color:"#f59e0b", hint:"Excel Summary col M --- हर महीने का Other Expense डालें" },
    gift:  { title:"💸 Gift --- Month-wise Update", label:"Gift (₹)",  color:"#f59e0b", hint:"Excel Summary col J --- हर महीने का Gift_Other डालें" },
    accesory:  { title:"💸 Accesory --- Month-wise Update", label:"Accesory (₹)",  color:"#f59e0b", hint:"Excel Summary col K --- हर महीने का Accesory डालें" },
    parts:  { title:"📦 Parts Cost --- Month-wise Update",     label:"Parts Cost (₹)",     color:"#64748b", hint:"Excel Summary col N --- हर महीने का Parts Cost डालें" },
  };

  return (
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse 80% 50% at 50% -10%,#140a2e 0%,#080d1e 45%,#050910 100%)",fontFamily:"'Nunito','Segoe UI',sans-serif",color:"#f1f5f9"}}>

      {/* --- HEADER --- */}
      <div style={{background:"rgba(0,0,0,0.55)",borderBottom:"1px solid rgba(255,255,255,0.07)",padding:"13px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",backdropFilter:"blur(20px)",position:"sticky",top:0,zIndex:200}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:44,height:44,borderRadius:13,background:"linear-gradient(135deg,#f97316,#dc2626)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,color:"white",boxShadow:"0 4px 20px #f9731640"}}>VP</div>
          <div>
            <div style={{fontSize:17,fontWeight:900,letterSpacing:-0.5}}>V P HONDA --- LIVE DASHBOARD</div>
            <div style={{fontSize:10,color:"#475569"}}>
              Parwaliya Sadak, Bhopal ·
              {loading?" ⏳ Loading..."
               :error?" ⚠️ DB Offline (Fallback mode)"
               :` ✅ ${totalCust} Customers · Updated ${lastUpd?.toLocaleTimeString('en-IN')}`}
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={fetchData} style={{background:"rgba(59,130,246,0.2)",color:"#3b82f6",border:"1px solid rgba(59,130,246,0.3)",borderRadius:20,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>🔄 Refresh</button>
          <div style={{background:GRAND_PFT<0?"rgba(239,68,68,0.15)":"rgba(16,185,129,0.15)",color:GRAND_PFT<0?"#ef4444":"#10b981",border:"1px solid rgba(239,68,68,0.3)",borderRadius:20,padding:"4px 14px",fontSize:12,fontWeight:800}}>
            Total P/L: {fmtINR(GRAND_PFT)}
          </div>
        </div>
      </div>

      <div style={{padding:"20px 24px 40px"}}>

        {/* --- FILTER BAR --- */}
        <div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,padding:"14px 16px",border:"1px solid rgba(255,255,255,0.07)",marginBottom:14}}>
          {/* Year + Month */}
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:10}}>
            <span style={{color:"#475569",fontSize:10,fontWeight:800}}>🔍 YEAR:</span>
            {YEARS.map(y=>(
              <button key={y} onClick={()=>{setYr(y);setDy("All");}} style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",border:String(yr)===String(y)?"none":"1px solid rgba(255,255,255,0.1)",background:String(yr)===String(y)?"linear-gradient(135deg,#f97316,#ef4444)":"rgba(255,255,255,0.05)",color:String(yr)===String(y)?"white":"#94a3b8",transition:"all 0.2s"}}>
                {y==="All"?"All Years":y}
              </button>
            ))}
            <div style={{width:1,height:20,background:"rgba(255,255,255,0.1)",margin:"0 4px"}}/>
            <span style={{color:"#475569",fontSize:10,fontWeight:800}}>MONTH:</span>
            {MONTHS.map(m=>(
              <button key={m} onClick={()=>{setMo(m);setDy("All");}} style={{padding:"5px 9px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",border:mo===m?"none":"1px solid rgba(255,255,255,0.08)",background:mo===m?"#3b82f6":"rgba(255,255,255,0.04)",color:mo===m?"white":"#64748b",transition:"all 0.15s"}}>
                {m}
              </button>
            ))}
          </div>
          {/* Day buttons */}
          <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
            <span style={{color:"#475569",fontSize:10,fontWeight:800,marginRight:2}}>DAY:</span>
            {DAYS.map(d=>(
              <button key={d} onClick={()=>setDy(d)} style={{
                padding:"4px 7px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",
                border:dy===d?"none":"1px solid rgba(255,255,255,0.06)",
                background:dy===d?"#8b5cf6":"rgba(255,255,255,0.03)",
                color:dy===d?"white":"#475569",
                minWidth:30,transition:"all 0.15s",
              }}>{d==="All"?"All":d}</button>
            ))}
          </div>
          {/* Status bar */}
          <div style={{marginTop:10,display:"flex",gap:16,flexWrap:"wrap",fontSize:11,color:"#475569"}}>
            <span>🏍 <b style={{color:"#f97316"}}>{filtVehCount>0?filtVehCount:tVeh_s} vehicles</b> (filter)</span>
            <span>👥 <b style={{color:"#3b82f6"}}>{filtCustN}</b> customers {dy!=="All"?`(${dy} ${mo})`:""}</span>
            <span>📄 <b style={{color:"#8b5cf6"}}>{filtInvCount}</b> invoices</span>
            <span>💹 P/L: <b style={{color:tPFT>=0?"#10b981":"#ef4444"}}>{fmtINR(tPFT)}</b></span>
            {dy!=="All"&&<span style={{color:"#f59e0b"}}>📅 Day {dy} selected — P/L is monthly (no day data)</span>}
            {!error&&live&&<span style={{color:"#10b981"}}>✅ Live DB connected</span>}
            {error&&<span style={{color:"#f59e0b"}}>⚠️ Showing offline data</span>}
          </div>
        </div>

        {/* --- YEAR STRIP --- */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
          {yrSum.map(ys=>(
            <div key={ys.year} onClick={()=>setYr(yr===ys.year?"All":ys.year)} style={{background:yr===ys.year?"linear-gradient(135deg,rgba(249,115,22,0.2),rgba(239,68,68,0.1))":"rgba(255,255,255,0.03)",border:yr===ys.year?"1px solid rgba(249,115,22,0.4)":"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"11px 15px",cursor:"pointer",transition:"all 0.2s"}}>
              <div style={{color:"#64748b",fontSize:10,fontWeight:700,marginBottom:3}}>{ys.year} {ys.year===2024?"(Sep---Dec)":ys.year===2026?"(Jan---Mar)":"(Full Year)"}</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                <span style={{color:"#f97316",fontSize:20,fontWeight:900}}>{ys.veh} veh</span>
                <span style={{color:ys.pft>=0?"#10b981":"#ef4444",fontSize:13,fontWeight:800}}>{fmtINR(ys.pft)}</span>
              </div>
              <div style={{color:"#475569",fontSize:10,marginTop:2}}>{ys.pft>=0?"✅ Profit":"❌ Loss"} this year</div>
            </div>
          ))}
        </div>

        {/* --- TABS --- */}
        <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 15px",borderRadius:12,fontSize:12,fontWeight:700,cursor:"pointer",border:tab===t.id?"none":"1px solid rgba(255,255,255,0.08)",background:tab===t.id?"linear-gradient(135deg,#f97316,#ef4444)":"rgba(255,255,255,0.04)",color:tab===t.id?"white":"#64748b",boxShadow:tab===t.id?"0 4px 20px rgba(249,115,22,0.35)":"none",transition:"all 0.2s"}}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* --- KPI STRIP --- */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:11,marginBottom:16}}>
          <K icon="👥" label="Customers"   value={filtCustN}  sub={dy!=="All"?`Day ${dy} filter`:"Live auto-update"} color="#f59e0b"/>
          <K icon="🏍" label="Vehicles (LS)" value={filtVehCount||tVeh_s}    sub={dy!=="All"?`Day ${dy} filter`:"Selected period"}  color="#f97316"/>
          <K icon="💹" label="Veh Margin"        value={tAcc}      sub="Excel Summary G"  color="#f59e0b"/>
          <K icon="🛡" label="Ins Margin"        value={tIns_s}    sub="Excel Summary I"  color="#3b82f6"/>
          <K icon="🏛" label="RTO Margin"        value={tRTO_s}    sub="Excel Summary H"  color="#8b5cf6"/>
          <K icon="📄" label="Invoices" value={filtInvCount} sub={dy!=="All"?`Day ${dy} filter`:"All invoices"} color="#06b6d4"/>
          <K icon="🟰" label="Total P/L"         value={tPFT}      sub="Excel Summary P"  color={tPFT>=0?"#10b981":"#ef4444"}/>
        </div>

        {/* ======== OVERVIEW ======== */}
        {tab==="overview" && (
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <Card>
              <SH title={dy!=="All"?`Day ${dy} --- Sales`:mo!=="All"?`${mo} ${yr} --- Daily Sales`:"Monthly Sales Trend"} sub="Live from database"/>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={mainChart.length?mainChart:plChart} margin={{top:5,right:20,bottom:mainChart.length>6?35:5,left:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                  <XAxis dataKey="label" tick={{fill:"#94a3b8",fontSize:10,angle:mainChart.length>8?-30:0,textAnchor:mainChart.length>8?"end":"middle"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:"#64748b",fontSize:11}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<Tip/>}/>
                  <Bar dataKey="sales" name="Vehicles" radius={[8,8,0,0]}>{(mainChart.length?mainChart:plChart).map((_,i)=><Cell key={i} fill={PC[i%PC.length]}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <SH title="Monthly Profit/Loss" sub="From Excel Summary Sheet"/>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={plChart} margin={{top:5,right:20,bottom:35,left:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                  <XAxis dataKey="label" tick={{fill:"#94a3b8",fontSize:10,angle:-30,textAnchor:"end"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:"#64748b",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>fmtINR(v)}/>
                  <Tooltip content={<Tip/>}/>
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4"/>
                  <Bar dataKey="pft" name="P/L" radius={[6,6,0,0]}>{plChart.map((e,i)=><Cell key={i} fill={e.pft>=0?"#10b981":"#ef4444"}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:16}}>
              <Card>
                <SH title="Top Models --- Live DB"/>
                {liveVeh.length>0 ? (
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={liveVeh.slice(0,7)} layout="vertical" margin={{left:5,right:35}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false}/>
                      <XAxis type="number" tick={{fill:"#64748b",fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis type="category" dataKey="short" tick={{fill:"#94a3b8",fontSize:10}} axisLine={false} tickLine={false} width={75}/>
                      <Tooltip content={<Tip/>}/>
                      <Bar dataKey="value" name="Units" radius={[0,8,8,0]}>{liveVeh.slice(0,7).map((_,i)=><Cell key={i} fill={PC[i]}/>)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{color:"#475569",textAlign:"center",padding:40,fontSize:12}}>⏳ Database connecting...</div>}
              </Card>
              <Card>
                <SH title="Color --- Live DB"/>
                {liveColor.length>0 ? (
                  <>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart><Pie data={liveColor} cx="50%" cy="50%" innerRadius={38} outerRadius={62} dataKey="value" paddingAngle={3}>{liveColor.map((_,i)=><Cell key={i} fill={PC[i]}/>)}</Pie><Tooltip content={<Tip/>}/></PieChart>
                  </ResponsiveContainer>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:6}}>
                    {liveColor.slice(0,6).map((c,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#94a3b8"}}><div style={{width:7,height:7,borderRadius:"50%",background:PC[i]}}/>{c.name}({c.value})</div>)}
                  </div>
                  </>
                ) : <div style={{color:"#475569",textAlign:"center",padding:40}}>⏳</div>}
              </Card>
            </div>
          </div>
        )}

        {/* ======== PROFIT/LOSS ======== */}
        {tab==="profit" && (
          <div style={{display:"flex",flexDirection:"column",gap:18}}>

            {/* --- 5 MANUAL UPDATE BUTTONS --- */}
            <div style={{background:"rgba(249,115,22,0.07)",border:"1px solid rgba(249,115,22,0.25)",borderRadius:14,padding:"16px 20px"}}>
              <div style={{color:"#f97316",fontWeight:800,fontSize:13,marginBottom:4}}>✏️ Manual Expense Update</div>
              <div style={{color:"#64748b",fontSize:11,marginBottom:14}}>नीचे 5 buttons से हर महीने का Salary/Rent, Other Expense, Gift, Accesory और Parts Cost अपडेट करें। Changes browser में save रहेंगे।</div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <button onClick={()=>openExpModal("salary")} style={{
                  background:"linear-gradient(135deg,rgba(239,68,68,0.2),rgba(239,68,68,0.1))",
                  border:"1px solid rgba(239,68,68,0.4)",color:"#ef4444",
                  borderRadius:12,padding:"12px 20px",cursor:"pointer",
                  fontSize:13,fontWeight:800,display:"flex",alignItems:"center",gap:8,
                  transition:"all 0.2s",
                }}>
                  💸 Salary &amp; Rent Update
                  <span style={{background:"rgba(239,68,68,0.2)",borderRadius:8,padding:"2px 8px",fontSize:10}}>col L</span>
                </button>
                <button onClick={()=>openExpModal("other")} style={{
                  background:"linear-gradient(135deg,rgba(245,158,11,0.2),rgba(245,158,11,0.1))",
                  border:"1px solid rgba(245,158,11,0.4)",color:"#f59e0b",
                  borderRadius:12,padding:"12px 20px",cursor:"pointer",
                  fontSize:13,fontWeight:800,display:"flex",alignItems:"center",gap:8,
                  transition:"all 0.2s",
                }}>
                  💸 Other Expense Update
                  <span style={{background:"rgba(245,158,11,0.2)",borderRadius:8,padding:"2px 8px",fontSize:10}}>col M</span>
                </button>
                <button onClick={()=>openExpModal("gift")} style={{
                  background:"linear-gradient(135deg,rgba(100,116,139,0.2),rgba(100,116,139,0.1))",
                  border:"1px solid rgba(100,116,139,0.4)",color:"#94a3b8",
                  borderRadius:12,padding:"12px 20px",cursor:"pointer",
                  fontSize:13,fontWeight:800,display:"flex",alignItems:"center",gap:8,
                  transition:"all 0.2s",
                }}>
                 💸 Gift_Other Update
                  <span style={{background:"rgba(239,68,68,0.2)",borderRadius:8,padding:"2px 8px",fontSize:10}}>col J</span>
                </button>
                <button onClick={()=>openExpModal("accesory")} style={{
                  background:"linear-gradient(135deg,rgba(245,158,11,0.2),rgba(245,158,11,0.1))",
                  border:"1px solid rgba(245,158,11,0.4)",color:"#f59e0b",
                  borderRadius:12,padding:"12px 20px",cursor:"pointer",
                  fontSize:13,fontWeight:800,display:"flex",alignItems:"center",gap:8,
                  transition:"all 0.2s",
                }}>
                  💸 Accesory Update
                  <span style={{background:"rgba(239,68,68,0.2)",borderRadius:8,padding:"2px 8px",fontSize:10}}>col K</span>
                </button>
                <button onClick={()=>openExpModal("parts")} style={{
                  background:"linear-gradient(135deg,rgba(245,158,11,0.2),rgba(245,158,11,0.1))",
                  border:"1px solid rgba(245,158,11,0.4)",color:"#f59e0b",
                  borderRadius:12,padding:"12px 20px",cursor:"pointer",
                  fontSize:13,fontWeight:800,display:"flex",alignItems:"center",gap:8,
                  transition:"all 0.2s",
                }}>
                  📦 Parts Cost Update
                  <span style={{background:"rgba(100,116,139,0.2)",borderRadius:8,padding:"2px 8px",fontSize:10}}>col N</span>
                </button>
              </div>
              {Object.keys(overrides).length > 0 && (
                <div style={{marginTop:10,color:"#10b981",fontSize:11}}>
                  ✅ {Object.keys(overrides).length} months में manual overrides saved हैं
                </div>
              )}
            </div>

            <AutoUpdateInfo/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(162px,1fr))",gap:12}}>
              <K icon="💹" label="Vehicle Margin"  value={tAcc}   sub="col G - Summary" color="#f97316"/>
              <K icon="🏛" label="RTO Margin"       value={tRTO_s} sub="col H - Summary" color="#8b5cf6"/>
              <K icon="🛡" label="Ins Margin"       value={tIns_s} sub="col I - Summary" color="#3b82f6"/>
              <K icon="🔧" label="Service Revenue"  value={tServ}  sub="col O - Summary" color="#10b981"/>
              <K icon="📦" label="Parts Net"        value={tParts} sub="col N - Summary" color="#f59e0b"/>
              <K icon="📦" label="Gift"        value={tGift} sub="col J - Summary" color="#f59e0b"/>
              <K icon="📦" label="Accesory"        value={tAccesory} sub="col k - Summary" color="#f59e0b"/>
              <K icon="💸" label="Salary/Rent"      value={tRent}  sub="col L - Summary" color="#ef4444"/>
              <K icon="💸" label="Other Expense"    value={tOther} sub="col M - Summary" color="#ef4444"/>
              <K icon="🟰" label="TOTAL P/L"        value={tPFT}   sub="col P (exact)"   color={tPFT>=0?"#10b981":"#ef4444"}/>
            </div>
            <Card>
              <SH title="Monthly P/L --- Excel Summary col P (EXACT)" sub="Green=Profit ✅ Red=Loss ❌"/>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={plChart} margin={{top:5,right:20,bottom:35,left:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                  <XAxis dataKey="label" tick={{fill:"#94a3b8",fontSize:10,angle:-30,textAnchor:"end"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:"#64748b",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>fmtINR(v)}/>
                  <Tooltip content={<Tip/>}/>
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" label={{value:"Break Even",fill:"#64748b",fontSize:10}}/>
                  <Bar dataKey="pft" name="Profit/Loss" radius={[6,6,0,0]}>{plChart.map((e,i)=><Cell key={i} fill={e.pft>=0?"#10b981":"#ef4444"}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <SH title="Income vs Expense Stacked"/>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={plChart} margin={{top:5,right:20,bottom:35,left:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                  <XAxis dataKey="label" tick={{fill:"#94a3b8",fontSize:10,angle:-30,textAnchor:"end"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:"#64748b",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>fmtINR(v)}/>
                  <Tooltip content={<Tip/>}/><Legend wrapperStyle={{color:"#94a3b8",fontSize:11}}/>
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4"/>
                  <Bar dataKey="access"  stackId="a" name="Veh Margin"  fill="#f97316"/>
                  <Bar dataKey="rto"     stackId="a" name="RTO"         fill="#8b5cf6"/>
                  <Bar dataKey="ins"     stackId="a" name="Insurance"   fill="#3b82f6"/>
                  <Bar dataKey="service" stackId="a" name="Service"     fill="#10b981"/>
                  <Bar dataKey="gift"    stackId="b" name="Gift" fill="#ef4444"/>
                  <Bar dataKey="accesory"    stackId="b" name="Accesory" fill="#ef4444"/>
                  <Bar dataKey="rent"    stackId="b" name="Salary/Rent" fill="#ef4444"/>
                  <Bar dataKey="other"   stackId="b" name="Other Exp"   fill="#f59e0b"/>
                  <Bar dataKey="parts"   stackId="b" name="Parts Cost"  fill="#64748b"/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <SH title="Month-wise Table" sub="Excel Summary Sheet exact data"/>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead><tr style={{background:"rgba(255,255,255,0.05)"}}>
                    {["Month","Veh","Veh Margin","RTO","Insurance","Salary","Gift","Accesory","Other","Parts","Service","TOTAL P/L"].map((h,i)=>(
                      <th key={i} style={{padding:"8px 9px",color:"#94a3b8",fontWeight:700,textAlign:"right",borderBottom:"1px solid rgba(255,255,255,0.07)",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filtPL.map((r,i)=>(
                      <tr key={i} style={{background:i%2===0?"rgba(255,255,255,0.02)":"transparent",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                        <td style={{padding:"7px 9px",color:"#f1f5f9",fontWeight:700,whiteSpace:"nowrap"}}>{r.m}'{String(r.y).slice(2)}</td>
                        <td style={{padding:"7px 9px",color:"#f97316",fontWeight:700,textAlign:"right"}}>{r.veh}</td>
                        <td style={{padding:"7px 9px",color:"#f59e0b",textAlign:"right"}}>{r.access.toLocaleString('en-IN')}</td>
                        <td style={{padding:"7px 9px",color:"#8b5cf6",textAlign:"right"}}>{r.rto.toLocaleString('en-IN')}</td>
                        <td style={{padding:"7px 9px",color:"#3b82f6",textAlign:"right"}}>{r.ins.toLocaleString('en-IN')}</td>
                        <td style={{padding:"7px 9px",color:"#ef4444",textAlign:"right"}}>{r.gift.toLocaleString('en-IN')}</td>
                        <td style={{padding:"7px 9px",color:"#ef4444",textAlign:"right"}}>{r.accesory.toLocaleString('en-IN')}</td>
                        <td style={{padding:"7px 9px",color:"#ef4444",textAlign:"right"}}>{r.rent.toLocaleString('en-IN')}</td>
                        <td style={{padding:"7px 9px",color:"#ef4444",textAlign:"right"}}>{r.other.toLocaleString('en-IN')}</td>
                        <td style={{padding:"7px 9px",color:r.parts<0?"#ef4444":"#10b981",textAlign:"right"}}>{Math.round(r.parts).toLocaleString('en-IN')}</td>
                        <td style={{padding:"7px 9px",color:"#10b981",textAlign:"right"}}>{Math.round(r.service).toLocaleString('en-IN')}</td>
                        <td style={{padding:"7px 9px",fontWeight:900,textAlign:"right",color:r.pft>=0?"#10b981":"#ef4444"}}>{fmtINR(r.pft)} {r.pft>=0?"✅":"❌"}</td>
                      </tr>
                    ))}
                    <tr style={{background:"rgba(249,115,22,0.08)",borderTop:"2px solid rgba(249,115,22,0.3)"}}>
                      <td style={{padding:"9px",color:"#f97316",fontWeight:900}}>TOTAL</td>
                      <td style={{padding:"9px",color:"#f97316",fontWeight:900,textAlign:"right"}}>{tVeh_s}</td>
                      <td style={{padding:"9px",color:"#f59e0b",fontWeight:900,textAlign:"right"}}>{tAcc.toLocaleString('en-IN')}</td>
                      <td style={{padding:"9px",color:"#8b5cf6",fontWeight:900,textAlign:"right"}}>{tRTO_s.toLocaleString('en-IN')}</td>
                      <td style={{padding:"9px",color:"#3b82f6",fontWeight:900,textAlign:"right"}}>{tIns_s.toLocaleString('en-IN')}</td>
                      <td style={{padding:"9px",color:"#ef4444",fontWeight:900,textAlign:"right"}}>{tGift.toLocaleString('en-IN')}</td>
                      <td style={{padding:"9px",color:"#ef4444",fontWeight:900,textAlign:"right"}}>{tAccesory.toLocaleString('en-IN')}</td>
                      <td style={{padding:"9px",color:"#ef4444",fontWeight:900,textAlign:"right"}}>{tRent.toLocaleString('en-IN')}</td>
                      <td style={{padding:"9px",color:"#ef4444",fontWeight:900,textAlign:"right"}}>{tOther.toLocaleString('en-IN')}</td>
                      <td style={{padding:"9px",color:tParts<0?"#ef4444":"#10b981",fontWeight:900,textAlign:"right"}}>{Math.round(tParts).toLocaleString('en-IN')}</td>
                      <td style={{padding:"9px",color:"#10b981",fontWeight:900,textAlign:"right"}}>{Math.round(tServ).toLocaleString('en-IN')}</td>
                      <td style={{padding:"9px",fontWeight:900,textAlign:"right",fontSize:13,color:tPFT>=0?"#10b981":"#ef4444"}}>{fmtINR(tPFT)} {tPFT>=0?"✅":"❌"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ======== VEHICLES ======== */}
        {tab==="vehicles" && (
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <Card>
              <SH title="Vehicle Models --- Live from Database" sub="Auto-updates when new vehicle added"/>
              {liveVeh.length>0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={liveVeh} margin={{top:5,right:20,bottom:65,left:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                    <XAxis dataKey="short" tick={{fill:"#94a3b8",fontSize:10,angle:-30,textAnchor:"end"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:"#64748b",fontSize:11}} axisLine={false} tickLine={false}/>
                    <Tooltip content={<Tip/>}/>
                    <Bar dataKey="value" name="Units" radius={[8,8,0,0]}>{liveVeh.map((_,i)=><Cell key={i} fill={PC[i%PC.length]}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{color:"#475569",textAlign:"center",padding:60}}>⏳ Loading live data...</div>}
            </Card>
            {liveVeh.length>0 && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                <Card><SH title="Market Share"/><ResponsiveContainer width="100%" height={200}><PieChart><Pie data={liveVeh} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="short" label={({short,percent})=>percent>0.06?`${short} ${(percent*100).toFixed(0)}%`:""} labelLine fontSize={9}>{liveVeh.map((_,i)=><Cell key={i} fill={PC[i%PC.length]}/>)}</Pie><Tooltip content={<Tip/>}/></PieChart></ResponsiveContainer></Card>
                <Card><SH title="Rankings"/>{liveVeh.map((v,i)=><PBar key={i} label={v.short} value={v.value} maxV={liveVeh[0]?.value||1} color={PC[i%PC.length]}/>)}</Card>
              </div>
            )}
          </div>
        )}

        {/* ======== CUSTOMERS ======== */}
        {tab==="customers" && (
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <AutoUpdateInfo/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:12}}>
              <K icon="👥" label="Total (DB)"      value={totalCust}           sub="✅ Live auto-update"   color="#f59e0b"/>
              <K icon="📅" label="2024"             value={yrSum[0]?.veh||0}   sub="Sep---Dec"              color="#3b82f6"/>
              <K icon="📅" label="2025"             value={yrSum[1]?.veh||0}   sub="Full year"            color="#10b981"/>
              <K icon="📅" label="2026"             value={yrSum[2]?.veh||0}   sub="Jan---Mar"              color="#8b5cf6"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <Card>
                <SH title="Finance Partners --- Live DB"/>
                {liveFin.length>0 ? (
                  <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={liveFin} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={4}>{liveFin.map((_,i)=><Cell key={i} fill={PC[i%PC.length]}/>)}</Pie><Tooltip content={<Tip/>}/></PieChart></ResponsiveContainer>
                ) : <div style={{color:"#475569",textAlign:"center",padding:60}}>⏳</div>}
              </Card>
              <Card><SH title="Financer Rankings"/>{liveFin.map((f,i)=><PBar key={i} label={f.name.slice(0,18)} value={f.value} maxV={liveFin[0]?.value||1} color={PC[i%PC.length]}/>)}</Card>
            </div>
          </div>
        )}

        {/* ======== PARTS & SERVICE ======== */}
        {tab==="parts" && (
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <AutoUpdateInfo/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
              {/* Live from DB */}
              <K icon="📦" label="Parts in Stock (DB)"  value={partsStats.count}       sub="✅ Live --- Parts Mgmt"   color="#f97316"/>
              <K icon="💰" label="Parts Stock Value"     value={partsStats.stockValue}  sub="unitPrice × stock"     color="#10b981"/>
              <K icon="🔧" label="Service Jobs (DB)"    value={serviceStats.total}     sub="✅ Live --- Job Cards"    color="#3b82f6"/>
              <K icon="💵" label="Service Revenue (DB)" value={serviceStats.totalAmount} sub="From job cards"       color="#8b5cf6"/>
            </div>
            {/* Historical from Excel */}
            <Card>
              <SH title="Parts Sales --- From Excel Job_card Sheet" sub="Historical data from Excel (218 parts entries)"/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginTop:8}}>
                {[
                  {icon:"📋",l:"Total Parts Entries",v:PARTS_DATA.entries,c:"#f97316"},
                  {icon:"🏷",l:"Total MRP",v:fmtINR(PARTS_DATA.mrpTotal),c:"#3b82f6"},
                  {icon:"💰",l:"Sale Price Total",v:fmtINR(PARTS_DATA.saleTotal),c:"#10b981"},
                  {icon:"📊",l:"Taxable Amount",v:fmtINR(PARTS_DATA.taxableTotal),c:"#8b5cf6"},
                ].map((k,i)=>(
                  <div key={i} style={{background:`${k.c}12`,border:`1px solid ${k.c}28`,borderRadius:12,padding:"14px 16px"}}>
                    <div style={{fontSize:20,marginBottom:6}}>{k.icon}</div>
                    <div style={{color:"#64748b",fontSize:11,marginBottom:3}}>{k.l}</div>
                    <div style={{color:k.c,fontSize:16,fontWeight:900}}>{typeof k.v==="number"?k.v.toLocaleString('en-IN'):k.v}</div>
                  </div>
                ))}
              </div>
            </Card>
            <div style={{background:"rgba(59,130,246,0.07)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:12,padding:"14px 18px",fontSize:12,color:"#94a3b8"}}>
              <b style={{color:"#3b82f6"}}>ℹ️ Parts auto-update कैसे होगा:</b><br/>
              Parts Management page पर जाएं → Parts add करें → यह dashboard automatically update हो जाएगा।<br/>
              Service Invoice (Job Card) generate करें → Service Revenue automatically यहाँ दिखेगा।
            </div>
          </div>
        )}

        {/* ======== INSURANCE ======== */}
        {tab==="insurance" && (
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <AutoUpdateInfo/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
              {/* Excel data */}
              <K icon="🛡" label="Total Collected"    value={INS_DATA.collected}  sub="Excel Insurence sheet"  color="#3b82f6"/>
              <K icon="💸" label="Paid Out (Payout)"  value={INS_DATA.payout}    sub="Depo column"            color="#ef4444"/>
              <K icon="💹" label="Total Ins Profit"   value={INS_DATA.profit}    sub="Collected - Payout"     color="#10b981"/>
              <K icon="📊" label="Avg per Vehicle"    value={Math.round(INS_DATA.collected/INS_DATA.totalEntries)} sub="233 vehicles" color="#f59e0b"/>
              <K icon="📋" label="Ins Margin (filter)" value={tIns_s}            sub="Summary col I"          color="#8b5cf6"/>
              <K icon="✅" label="Coverage Rate"      value="97.8%"              sub="Vehicles insured"        color="#f97316"/>
            </div>
            <Card>
              <SH title="Monthly Insurance Margin --- Summary Sheet col I"/>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={plChart} margin={{top:5,right:20,bottom:35,left:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                  <XAxis dataKey="label" tick={{fill:"#64748b",fontSize:10,angle:-30,textAnchor:"end"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:"#64748b",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>fmtINR(v)}/>
                  <Tooltip content={<Tip/>}/>
                  <Bar dataKey="ins" name="Ins Margin (₹)" fill="#3b82f6" radius={[6,6,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <SH title="Insurance Breakdown" sub="From Excel Insurence sheet"/>
              {[
                {l:"Total Ins Collected",     v:INS_DATA.collected, c:"#3b82f6"},
                {l:"Total Payout (Depo)",     v:INS_DATA.payout,    c:"#ef4444"},
                {l:"Net Profit",              v:INS_DATA.profit,    c:"#10b981"},
                {l:"Grand Total (Summary)",   v:SUMMARY_PL.reduce((s,r)=>s+r.ins,0), c:"#8b5cf6"},
              ].map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"9px 12px",background:`${r.c}10`,borderRadius:10,marginBottom:8}}>
                  <span style={{color:"#94a3b8",fontSize:12}}>{r.l}</span>
                  <span style={{color:r.c,fontWeight:900,fontSize:13}}>{fmtINR(r.v)}</span>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ======== RTO ======== */}
        {tab==="rto" && (
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <AutoUpdateInfo/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
              <K icon="🏛" label="Total RTO Collected" value={RTO_DATA.collected}  sub="Excel RTO sheet"       color="#8b5cf6"/>
              <K icon="💸" label="Deposited to Govt"   value={RTO_DATA.deposit}    sub="Govt payment"         color="#ef4444"/>
              <K icon="💹" label="RTO Profit (Access)" value={RTO_DATA.profit}     sub="Collected - Deposit"  color="#10b981"/>
              <K icon="📊" label="Avg per Vehicle"     value={Math.round(RTO_DATA.collected/RTO_DATA.totalEntries)} sub="228 registrations" color="#f59e0b"/>
              <K icon="📋" label="RTO Margin (filter)" value={tRTO_s}              sub="Summary col H"        color="#3b82f6"/>
              <K icon="🚗" label="Registrations"       value={RTO_DATA.totalEntries} sub="Vehicles registered" color="#f97316"/>
            </div>
            <Card>
              <SH title="Monthly RTO Margin --- Summary Sheet col H"/>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={plChart} margin={{top:5,right:20,bottom:35,left:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                  <XAxis dataKey="label" tick={{fill:"#64748b",fontSize:10,angle:-30,textAnchor:"end"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:"#64748b",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>fmtINR(v)}/>
                  <Tooltip content={<Tip/>}/>
                  <Bar dataKey="rto" name="RTO Margin (₹)" fill="#8b5cf6" radius={[6,6,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <SH title="RTO Breakdown" sub="From Excel RTO sheet"/>
              {[
                {l:"Total RTO Collected",  v:RTO_DATA.collected, c:"#8b5cf6"},
                {l:"Govt Deposit (Paid)",  v:RTO_DATA.deposit,   c:"#ef4444"},
                {l:"Net RTO Profit",       v:RTO_DATA.profit,    c:"#10b981"},
                {l:"Grand Total (Summary)",v:SUMMARY_PL.reduce((s,r)=>s+r.rto,0), c:"#3b82f6"},
              ].map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"9px 12px",background:`${r.c}10`,borderRadius:10,marginBottom:8}}>
                  <span style={{color:"#94a3b8",fontSize:12}}>{r.l}</span>
                  <span style={{color:r.c,fontWeight:900,fontSize:13}}>{fmtINR(r.v)}</span>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ======== VEH TAX INVOICE ======== */}
        {tab==="vehInvoice" && (
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <AutoUpdateInfo/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12}}>
              <K icon="🏍" label="Vehicle Invoices" value={vehInvoices.length} sub="Auto from Invoice Mgmt" color="#f97316"/>
              <K icon="💰" label="Total Amount" value={vehInvTotal} sub="Sum of all vehicle invoices" color="#10b981"/>
              <K icon="📊" label="Avg Invoice" value={vehInvoices.length ? Math.round(vehInvTotal/vehInvoices.length) : 0} sub="Average per invoice" color="#3b82f6"/>
              <K icon="📄" label="Total Invoices" value={allInvoices.length} sub="Vehicle + Service" color="#8b5cf6"/>
            </div>
            <Card>
              <SH title="Monthly Vehicle Tax Invoices" sub="Auto-update from Invoice Management"/>
              {monthlyInvData.length>0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyInvData} margin={{top:5,right:20,bottom:35,left:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                    <XAxis dataKey="label" tick={{fill:"#94a3b8",fontSize:10,angle:-30,textAnchor:"end"}} axisLine={false} tickLine={false}/>
                    <YAxis yAxisId="left" tick={{fill:"#64748b",fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis yAxisId="right" orientation="right" tick={{fill:"#64748b",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>fmtINR(v)}/>
                    <Tooltip content={<Tip/>}/>
                    <Legend wrapperStyle={{color:"#94a3b8",fontSize:11}}/>
                    <Bar yAxisId="left" dataKey="vehCount" name="Invoices" fill="#f97316" radius={[6,6,0,0]}/>
                    <Bar yAxisId="right" dataKey="vehAmt" name="Amount (₹)" fill="#10b981" radius={[6,6,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{color:"#475569",textAlign:"center",padding:60,fontSize:12}}>📄 No vehicle invoices yet — Import PDFs from Invoice Management</div>}
            </Card>
            {monthlyInvData.length>0 && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                <Card>
                  <SH title="Invoice Count by Month"/>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={monthlyInvData} margin={{top:5,right:20,bottom:5,left:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                      <XAxis dataKey="label" tick={{fill:"#94a3b8",fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:"#64748b",fontSize:10}} axisLine={false} tickLine={false}/>
                      <Tooltip content={<Tip/>}/>
                      <Area type="monotone" dataKey="vehCount" name="Vehicle" stroke="#f97316" fill="#f9731630" strokeWidth={2}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
                <Card>
                  <SH title="Revenue Trend"/>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={monthlyInvData} margin={{top:5,right:20,bottom:5,left:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                      <XAxis dataKey="label" tick={{fill:"#94a3b8",fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:"#64748b",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>fmtINR(v)}/>
                      <Tooltip content={<Tip/>}/>
                      <Line type="monotone" dataKey="vehAmt" name="Revenue" stroke="#10b981" strokeWidth={2} dot={{fill:"#10b981",r:4}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}
            {/* Recent Vehicle Invoices List */}
            <Card>
              <SH title="Recent Vehicle Tax Invoices" sub={`Total: ${vehInvoices.length} invoices`}/>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead><tr style={{background:"rgba(255,255,255,0.05)"}}>
                    {["#","Invoice No","Customer","Vehicle","Amount","Date"].map((h,i)=>(
                      <th key={i} style={{padding:"8px 10px",color:"#94a3b8",fontWeight:700,textAlign:i>=4?"right":"left",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {vehInvoices.length===0 ? (
                      <tr><td colSpan="6" style={{padding:"30px",textAlign:"center",color:"#475569"}}>कोई Vehicle Invoice नहीं — Invoice Management से PDF import करें</td></tr>
                    ) : [...vehInvoices].sort((a,b)=>new Date(b.invoiceDate||b.importedAt||0)-new Date(a.invoiceDate||a.importedAt||0)).slice(0,20).map((inv,i)=>(
                      <tr key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",background:i%2===0?"rgba(255,255,255,0.02)":"transparent"}}>
                        <td style={{padding:"7px 10px",color:"#64748b"}}>{i+1}</td>
                        <td style={{padding:"7px 10px",color:"#f97316",fontWeight:700}}>#{inv.invoiceNumber||inv.id||'—'}</td>
                        <td style={{padding:"7px 10px",color:"#f1f5f9"}}>{inv.customerName||'—'}</td>
                        <td style={{padding:"7px 10px",color:"#3b82f6"}}>{inv.vehicle||'—'}</td>
                        <td style={{padding:"7px 10px",color:"#10b981",fontWeight:800,textAlign:"right"}}>{fmtINR(inv.totals?.totalAmount||inv.amount||0)}</td>
                        <td style={{padding:"7px 10px",color:"#64748b",textAlign:"right"}}>{inv.invoiceDate?new Date(inv.invoiceDate).toLocaleDateString('en-IN'):'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ======== PARTS TAX INVOICE ======== */}
        {tab==="partsInvoice" && (
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <AutoUpdateInfo/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12}}>
              <K icon="🔧" label="Service/Parts Invoices" value={svcInvoices.length} sub="Auto from Invoice Mgmt" color="#3b82f6"/>
              <K icon="💰" label="Total Amount" value={svcInvTotal} sub="Sum of parts/service invoices" color="#10b981"/>
              <K icon="📊" label="Avg Invoice" value={svcInvoices.length ? Math.round(svcInvTotal/svcInvoices.length) : 0} sub="Average per invoice" color="#f59e0b"/>
              <K icon="📦" label="Parts in Stock" value={partsStats.count} sub="Live from Parts Mgmt" color="#8b5cf6"/>
            </div>
            <Card>
              <SH title="Monthly Parts/Service Invoices" sub="Auto-update from Invoice Management"/>
              {monthlyInvData.length>0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyInvData} margin={{top:5,right:20,bottom:35,left:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                    <XAxis dataKey="label" tick={{fill:"#94a3b8",fontSize:10,angle:-30,textAnchor:"end"}} axisLine={false} tickLine={false}/>
                    <YAxis yAxisId="left" tick={{fill:"#64748b",fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis yAxisId="right" orientation="right" tick={{fill:"#64748b",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>fmtINR(v)}/>
                    <Tooltip content={<Tip/>}/>
                    <Legend wrapperStyle={{color:"#94a3b8",fontSize:11}}/>
                    <Bar yAxisId="left" dataKey="svcCount" name="Invoices" fill="#3b82f6" radius={[6,6,0,0]}/>
                    <Bar yAxisId="right" dataKey="svcAmt" name="Amount (₹)" fill="#8b5cf6" radius={[6,6,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{color:"#475569",textAlign:"center",padding:60,fontSize:12}}>📄 No parts/service invoices yet — Import PDFs from Invoice Management</div>}
            </Card>
            {monthlyInvData.length>0 && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                <Card>
                  <SH title="Service Invoice Trend"/>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={monthlyInvData} margin={{top:5,right:20,bottom:5,left:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                      <XAxis dataKey="label" tick={{fill:"#94a3b8",fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:"#64748b",fontSize:10}} axisLine={false} tickLine={false}/>
                      <Tooltip content={<Tip/>}/>
                      <Area type="monotone" dataKey="svcCount" name="Service" stroke="#3b82f6" fill="#3b82f630" strokeWidth={2}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
                <Card>
                  <SH title="Parts/Service vs Vehicle"/>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={monthlyInvData} margin={{top:5,right:20,bottom:5,left:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                      <XAxis dataKey="label" tick={{fill:"#94a3b8",fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:"#64748b",fontSize:10}} axisLine={false} tickLine={false}/>
                      <Tooltip content={<Tip/>}/>
                      <Legend wrapperStyle={{color:"#94a3b8",fontSize:11}}/>
                      <Bar dataKey="vehCount" name="Vehicle" fill="#f97316" radius={[4,4,0,0]}/>
                      <Bar dataKey="svcCount" name="Service" fill="#3b82f6" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}
            {/* Recent Service Invoices List */}
            <Card>
              <SH title="Recent Parts/Service Tax Invoices" sub={`Total: ${svcInvoices.length} invoices`}/>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead><tr style={{background:"rgba(255,255,255,0.05)"}}>
                    {["#","Invoice No","Customer","Parts/Service","Amount","Date"].map((h,i)=>(
                      <th key={i} style={{padding:"8px 10px",color:"#94a3b8",fontWeight:700,textAlign:i>=4?"right":"left",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {svcInvoices.length===0 ? (
                      <tr><td colSpan="6" style={{padding:"30px",textAlign:"center",color:"#475569"}}>कोई Parts/Service Invoice नहीं — Invoice Management से PDF import करें</td></tr>
                    ) : [...svcInvoices].sort((a,b)=>new Date(b.invoiceDate||b.importedAt||0)-new Date(a.invoiceDate||a.importedAt||0)).slice(0,20).map((inv,i)=>(
                      <tr key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",background:i%2===0?"rgba(255,255,255,0.02)":"transparent"}}>
                        <td style={{padding:"7px 10px",color:"#64748b"}}>{i+1}</td>
                        <td style={{padding:"7px 10px",color:"#3b82f6",fontWeight:700}}>#{inv.invoiceNumber||inv.id||'—'}</td>
                        <td style={{padding:"7px 10px",color:"#f1f5f9"}}>{inv.customerName||'—'}</td>
                        <td style={{padding:"7px 10px",color:"#8b5cf6"}}>{inv.vehicle||inv.items?.[0]?.name||'Service'}</td>
                        <td style={{padding:"7px 10px",color:"#10b981",fontWeight:800,textAlign:"right"}}>{fmtINR(inv.totals?.totalAmount||inv.amount||0)}</td>
                        <td style={{padding:"7px 10px",color:"#64748b",textAlign:"right"}}>{inv.invoiceDate?new Date(inv.invoiceDate).toLocaleDateString('en-IN'):'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ======== GEOGRAPHY ======== */}
        {tab==="geography" && (
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <Card>
                <SH title="Sales by District --- Live DB"/>
                {liveDist.length>0 ? (
                  <ResponsiveContainer width="100%" height={260}><BarChart data={liveDist} margin={{top:5,right:20,bottom:5,left:0}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/><XAxis dataKey="name" tick={{fill:"#94a3b8",fontSize:10}} axisLine={false} tickLine={false}/><YAxis tick={{fill:"#64748b",fontSize:11}} axisLine={false} tickLine={false}/><Tooltip content={<Tip/>}/><Bar dataKey="value" name="Customers" radius={[8,8,0,0]}>{liveDist.map((_,i)=><Cell key={i} fill={PC[i]}/>)}</Bar></BarChart></ResponsiveContainer>
                ) : <div style={{color:"#475569",textAlign:"center",padding:60}}>⏳</div>}
              </Card>
              <Card>
                <SH title="District Share"/>
                {liveDist.length>0 ? (
                  <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={liveDist} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine fontSize={9}>{liveDist.map((_,i)=><Cell key={i} fill={PC[i]}/>)}</Pie><Tooltip content={<Tip/>}/></PieChart></ResponsiveContainer>
                ) : <div style={{color:"#475569",textAlign:"center",padding:60}}>⏳</div>}
              </Card>
            </div>
            {liveDist.length>0&&(
              <Card>
                <SH title="District Performance --- Live"/>
                {liveDist.map((d,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:12,marginBottom:13}}>
                    <div style={{width:30,height:30,borderRadius:8,background:PC[i],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:12,color:"white",flexShrink:0}}>#{i+1}</div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{color:"#f1f5f9",fontWeight:700}}>{d.name}</span>
                        <span style={{color:PC[i],fontWeight:800}}>{d.value} · {((d.value/Math.max(totalCust,1))*100).toFixed(1)}%</span>
                      </div>
                      <div style={{height:7,background:"rgba(255,255,255,0.07)",borderRadius:6}}>
                        <div style={{height:"100%",borderRadius:6,background:PC[i],width:`${(d.value/liveDist[0].value)*100}%`,transition:"width 1s"}}/>
                      </div>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}

        <div style={{marginTop:28,textAlign:"center",color:"#1e293b",fontSize:11,borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:14}}>
          V P HONDA · Parwaliya Sadak, Bhopal · GSTIN: 23BCYPD9538B1ZG · 🔄 Auto-refresh 30 sec
        </div>
      </div>

      {/* --- EXPENSE UPDATE MODAL --- */}
      {expModal && modalConfig[expModal] && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"#0f172a",border:"1px solid rgba(255,255,255,0.12)",borderRadius:20,padding:28,width:"100%",maxWidth:600,maxHeight:"85vh",overflowY:"auto"}}>
            {/* Modal Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div>
                <h2 style={{color:"#f1f5f9",fontSize:16,fontWeight:900,margin:0}}>{modalConfig[expModal].title}</h2>
                <p style={{color:"#64748b",fontSize:11,margin:"6px 0 0"}}>{modalConfig[expModal].hint}</p>
              </div>
              <button onClick={()=>setExpModal(null)} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:10,padding:"6px 12px",cursor:"pointer",fontSize:14}}>✕</button>
            </div>

            {/* Month rows */}
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
              {BASE_SUMMARY_PL.map(row => {
                const key = row.y + "-" + row.m;
                const mc = modalConfig[expModal];
                return (
                  <div key={key} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 14px"}}>
                    <span style={{color:"#94a3b8",fontSize:12,fontWeight:700,width:60,flexShrink:0}}>{row.m}'{String(row.y).slice(2)}</span>
                    <span style={{color:"#475569",fontSize:11,width:50,flexShrink:0}}>{row.veh} veh</span>
                    <div style={{flex:1,position:"relative"}}>
                      <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#64748b",fontSize:12}}>₹</span>
                      <input
                        type="number"
                        min="0"
                        value={expForm[key] ?? ""}
                        onChange={e => setExpForm(f => ({...f, [key]: e.target.value}))}
                        placeholder="0"
                        style={{
                          width:"100%", padding:"7px 10px 7px 26px",
                          background:"rgba(255,255,255,0.06)",
                          border:`1px solid ${mc.color}40`,
                          borderRadius:8, color:"#f1f5f9", fontSize:13,
                          outline:"none", boxSizing:"border-box",
                        }}
                      />
                    </div>
                    {/* Show current base value as hint */}
                    <span style={{color:"#334155",fontSize:10,width:80,textAlign:"right",flexShrink:0}}>
                      Base: ₹{Math.abs(
                        expModal==="salary"?row.rent:expModal==="other"?row.other:expModal==="gift"?row.gift:expModal==="accesory"?row.accesory:row.parts
                      ).toLocaleString('en-IN')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Buttons */}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={resetExpModal} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",color:"#ef4444",borderRadius:10,padding:"9px 18px",cursor:"pointer",fontSize:12,fontWeight:700}}>🔄 Reset to Excel</button>
              <button onClick={()=>setExpModal(null)} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:10,padding:"9px 18px",cursor:"pointer",fontSize:12}}>Cancel</button>
              <button onClick={saveExpModal} style={{background:"linear-gradient(135deg,#10b981,#059669)",border:"none",color:"white",borderRadius:10,padding:"9px 20px",cursor:"pointer",fontSize:12,fontWeight:800,boxShadow:"0 4px 16px rgba(16,185,129,0.4)"}}>✅ Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}