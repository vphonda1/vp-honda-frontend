// ════════════════════════════════════════════════════════════════════════════
// SalaryManagementPage.jsx — VP Honda Salary & Rent Ledger
// ════════════════════════════════════════════════════════════════════════════
// All staff + rent expenses in one place:
// • 8 staff entities (5 original + 3 replacements)
// • 5 rent entities (3 original + 2 replacements)
// • Seeded with 277 payment records from Excel (Sallery.xlsx)
// • Per-entity: total paid, months active, expected, pending balance
// • Staff replacements visualized with chain
// • Add Payment to any entity (saves to MongoDB for cross-device sync)
// • First-time seed button uploads all historical data
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area,
} from 'recharts';
import {
  Users, Home as HomeIcon, Plus, Calendar, DollarSign, Clock,
  ArrowRightCircle, CheckCircle, XCircle, AlertTriangle, RefreshCw,
  Download, Upload, UserPlus, Edit2, Trash2, Eye, ChevronDown,
  TrendingUp, TrendingDown, Activity, Award, Filter, ArrowLeft,
} from 'lucide-react';
import { api } from '../utils/apiConfig';
import { visibleInterval } from '../utils/pollControl';
import { SEED_PAYMENTS, SEED_ENTITIES } from './salarySeedData';

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmtINR = (n) => '₹' + Math.round(n||0).toLocaleString('en-IN');
const fmtShort = (n) => {
  n = Math.round(Math.abs(n||0));
  const sign = n < 0 ? '-' : '';
  if (n >= 10000000) return sign + '₹' + (n/10000000).toFixed(2) + 'Cr';
  if (n >= 100000)   return sign + '₹' + (n/100000).toFixed(2) + 'L';
  if (n >= 1000)     return sign + '₹' + (n/1000).toFixed(1) + 'K';
  return sign + '₹' + n;
};
const fmtDate = (d) => { if(!d) return '—'; const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }); };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Calculate months active (full months from start → end or today)
function calcMonthsActive(startDate, endDate) {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  if (isNaN(start) || isNaN(end)) return 0;
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  // Add 1 if we've crossed the monthly anniversary
  const extraDay = end.getDate() >= start.getDate() ? 1 : 0;
  return Math.max(0, months + extraDay);
}

// ════════════════════════════════════════════════════════════════════════════
export default function SalaryManagementPage() {
  const navigate = useNavigate();
  const [entities, setEntities] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');       // 'all' | entity name
  const [filterType, setFilterType] = useState('all');     // 'all' | 'staff' | 'rent'
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showAddEntity, setShowAddEntity] = useState(false);
  const [editingEntity, setEditingEntity] = useState(null);         // ⭐ entity being edited
  const [editingPayment, setEditingPayment] = useState(null);       // ⭐ payment being edited
  const [seedingInProgress, setSeedingInProgress] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => { loadAll(); }, []);

  // ⭐ Auto-refresh every 5 minutes (पहले 30s था — form edit में interrupt होता था)
  useEffect(() => {
  // ⏱️ Render का कोटा: tab पीछे जाते ही polling रुक जाती है, सामने आते ही
  // एक बार तुरंत चलती है. यही सबसे बड़ी बचत है — service सो पाती है.
    const stopPoll = visibleInterval(() => { loadAll(true); }, 600000); // 5 → 10 मिनट
    return stopPoll;
  }, []);

  // ⭐ NEW: Also load attendance + shop settings for penalty calculation
  const [attendance, setAttendance] = useState([]);
  const [shopSettings, setShopSettings] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [entRes, payRes, attRes, settRes] = await Promise.all([
        fetch(api('/api/salary-entities')),
        fetch(api('/api/salaries')),
        fetch(api('/api/attendance')).catch(() => null),
        fetch(api('/api/attendance/shop/settings')).catch(() => null),
      ]);
      const ents = entRes.ok ? await entRes.json() : [];
      const pays = payRes.ok ? await payRes.json() : [];
      setEntities(ents);
      setPayments(pays);
      if (attRes && attRes.ok) {
        const raw = await attRes.json();
        const byStaff = {};
        (Array.isArray(raw) ? raw : []).forEach(a => {
          const key = String(a.staffName || a.staffId || '').toLowerCase().trim();
          if (!byStaff[key]) byStaff[key] = [];
          byStaff[key].push(a);
        });
        setAttendance(byStaff);
      }
      if (settRes && settRes.ok) {
        const s = await settRes.json();
        setShopSettings(Array.isArray(s) ? s[0] : s);
      }
    } catch (err) {
      console.error('Load error:', err);
    }
    setLastRefresh(new Date());
    setLoading(false);
  };

  // ── First-time seed from Excel data ──────────────────────────────────
  const handleSeedFromExcel = async () => {
    if (!window.confirm(`⚠️ Seed Confirmation\n\nExcel से 277 payments और 13 entities import करें?\n\n(पहले से मौजूद data unaffected रहेगा)`)) return;
    setSeedingInProgress(true);
    try {
      const paymentsPayload = SEED_PAYMENTS.map(p => ({
        staffName: p.person,
        staffId: p.person.toLowerCase().replace(/\s/g, '_'),
        type: SEED_ENTITIES.find(e => e.name === p.person)?.type === 'rent' ? 'salary' : 'salary',  // treat rent as "salary" type for simplicity
        amount: p.amount,
        paymentDate: p.date,
        forMonth: parseInt(p.date.split('-')[1]),
        forYear: parseInt(p.date.split('-')[0]),
        notes: 'Imported from Sallery.xlsx',
      }));

      const res = await fetch(api('/api/salary-entities/seed'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entities: SEED_ENTITIES,
          payments: paymentsPayload,
          overwrite: false,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ Import Complete!\n\nEntities: ${data.entitiesCreated} new\nPayments: ${data.paymentsInserted} new\n\nTotal in database:\n• Entities: ${data.totalEntities}\n• Payments: ${data.totalPayments}`);
        await loadAll();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Seed failed: ${err.message}`);
    }
    setSeedingInProgress(false);
  };

  // ── Full reset — nuclear option to clear and re-seed ──────────────────
  const handleReset = async () => {
    const msg = `⚠️ DANGER ZONE ⚠️\n\nयह सब कुछ हटा देगा:\n• सभी entities (staff + rent)\n• सभी seeded payments (Excel से imported)\n\nManual add की गई payments safe रहेंगी।\n\nक्या continue करना है?`;
    if (!window.confirm(msg)) return;
    if (!window.confirm('आखिरी chance — सच में सब कुछ हटा दें?')) return;

    try {
      const res = await fetch(api('/api/salary-entities/reset'), { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ Reset complete\n\n• Entities deleted: ${data.entitiesDeleted}\n• Seeded payments deleted: ${data.paymentsDeleted}\n\nअब "Import from Excel" button से fresh data load करें।`);
        await loadAll();
        setActiveTab('all');
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (err) { alert(err.message); }
  };

  // ── Delete entity ─────────────────────────────────────────────────────
  const handleDeleteEntity = async (entity) => {
    if (!window.confirm(`⚠️ ${entity.name} को delete करें?\n\nइनके सभी payments भी delete हो जाएंगे।`)) return;
    try {
      const res = await fetch(api(`/api/salary-entities/${entity._id}`), { method: 'DELETE' });
      if (res.ok) {
        alert(`✅ ${entity.name} deleted`);
        setActiveTab('all');
        await loadAll();
      } else {
        const data = await res.json();
        alert(`❌ ${data.error}`);
      }
    } catch (err) { alert(err.message); }
  };

  // ── Delete single payment ─────────────────────────────────────────────
  const handleDeletePayment = async (payment) => {
    if (!window.confirm(`Payment delete करें?\n\n${fmtINR(payment.amount)} · ${payment.paymentDate}`)) return;
    try {
      const res = await fetch(api(`/api/salaries/${payment._id}`), { method: 'DELETE' });
      if (res.ok) {
        await loadAll();
      } else {
        alert('Delete failed');
      }
    } catch (err) { alert(err.message); }
  };
  const calcs = useMemo(() => {
    const countSundays = (y, m) => {
      let c=0; const d=new Date(y,m,1);
      while(d.getMonth()===m){if(d.getDay()===0)c++;d.setDate(d.getDate()+1);}
      return c;
    };
    const now=new Date(); const curY=now.getFullYear(), curM=now.getMonth();

    // Per-entity stats
    const perEntity = entities.map(e => {
      const pays = payments.filter(p => !p.cancelled && p.staffName === e.name);
      const totalPaid = pays.reduce((s, p) => s + (p.amount || 0), 0);
      const monthsActive = calcMonthsActive(e.startDate, e.endDate);
      const expectedTotal = (e.monthlyAmount || 0) * monthsActive;
      const balance = expectedTotal - totalPaid;

      // ✅ Absent deduction — staff only
      let absentDeduction=0, absentDays=0, presentDays=0, deductionNote='', netPayable=e.monthlyAmount||0;
      if(e.type==='staff' && e.active && e.monthlyAmount>0) {
        const attKey = Object.keys(attendance||{}).find(k=>k===String(e.name||'').toLowerCase().trim());
        const attList = attKey?(attendance[attKey]||[]):[];
        const daysInMonth=new Date(curY,curM+1,0).getDate();
        const sundays=countSundays(curY,curM);
        const workingDays=daysInMonth-sundays;
        let elapsed=0;
        for(let d=1;d<=now.getDate();d++){if(new Date(curY,curM,d).getDay()!==0)elapsed++;}
        presentDays=attList.filter(a=>{const d=new Date(a.date);return d.getMonth()===curM&&d.getFullYear()===curY;}).length;
        absentDays=Math.max(0,elapsed-presentDays);
        const rulesStart=shopSettings?.attendanceRulesStartDate;
        const rulesActive=rulesStart?new Date(curY,curM,1)>=new Date(new Date(rulesStart).getFullYear(),new Date(rulesStart).getMonth(),1):false;
        if(rulesActive&&absentDays>0){
          const perDay=workingDays>0?e.monthlyAmount/workingDays:0;
          const lateDays=attList.filter(a=>{const d=new Date(a.date);if(d.getMonth()!==curM||d.getFullYear()!==curY)return false;const[h]=(a.checkInTime||'').split(':').map(Number);return h>10;}).length;
          absentDeduction=Math.round(absentDays*perDay)+lateDays*(shopSettings?.latePenalty||50);
          deductionNote=`🚫 ${absentDays}d absent${lateDays>0?` · ${lateDays}d late`:''}`;
        } else if(!rulesActive){deductionNote='🕊️ Grace period';}
        else{deductionNote=`✅ ${presentDays} दिन उपस्थित`;}
        netPayable=Math.max(0,(e.monthlyAmount||0)-absentDeduction);
      }
      return { ...e, payments:pays, totalPaid, monthsActive, expectedTotal, balance, absentDeduction, absentDays, presentDays, deductionNote, netPayable };
    });

    // Filter by type
    const filtered = filterType === 'all' ? perEntity : perEntity.filter(e => e.type === filterType);

    // Aggregate totals
    const totals = {
      staff: perEntity.filter(e => e.type === 'staff' && e.active).length,
      rentActive: perEntity.filter(e => e.type === 'rent' && e.active).length,
      totalPaidStaff: perEntity.filter(e => e.type === 'staff').reduce((s, e) => s + e.totalPaid, 0),
      totalPaidRent: perEntity.filter(e => e.type === 'rent').reduce((s, e) => s + e.totalPaid, 0),
      totalPending: perEntity.filter(e => e.active).reduce((s, e) => s + Math.max(0, e.balance), 0),
      totalMonthlyDue: perEntity.filter(e => e.active).reduce((s, e) => s + (e.monthlyAmount || 0), 0),
    };

    // Monthly payment trend (last 12 months)
    const monthlyTrend = {};
    payments.filter(p => !p.cancelled).forEach(p => {
      const d = new Date(p.paymentDate);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!monthlyTrend[key]) monthlyTrend[key] = { month: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, staff: 0, rent: 0, total: 0 };
      const ent = entities.find(e => e.name === p.staffName);
      const type = ent?.type || 'staff';
      monthlyTrend[key][type] += p.amount || 0;
      monthlyTrend[key].total += p.amount || 0;
    });
    const trendArr = Object.entries(monthlyTrend).sort((a,b) => a[0].localeCompare(b[0])).map(([_, v]) => v).slice(-12);

    return { perEntity, filtered, totals, trendArr };
  }, [entities, payments, filterType, attendance, shopSettings]);

  const activeEntity = activeTab !== 'all' ? calcs.perEntity.find(e => e.name === activeTab) : null;

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
      <div style={{ textAlign:'center' }}>
        <Activity size={48} className="animate-spin mx-auto mb-3" color="#22c55e"/>
        <p style={{ color:'#94a3b8' }}>Salary data loading...</p>
      </div>
    </div>
  );

  const isEmpty = entities.length === 0;

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(180deg, #0f172a, #020617)', color:'#f8fafc', padding:'20px' }}>
      <div style={{ maxWidth:'1400px', margin:'0 auto' }}>

        {/* HEADER */}
        <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'space-between', alignItems:'center', gap:16, marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={() => navigate('/dashboard')}
              style={{ background:'#1e293b', border:'1px solid #334155', color:'#f8fafc', padding:'8px 14px', borderRadius:10, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
              <ArrowLeft size={14}/> Back
            </button>
            <div>
              <h1 style={{ fontSize:26, fontWeight:900, background:'linear-gradient(90deg, #22c55e, #3b82f6)', WebkitBackgroundClip:'text', color:'transparent', margin:0 }}>
                💰 Salary & Rent Ledger
              </h1>
              <p style={{ color:'#94a3b8', fontSize:12, margin:'4px 0 0', display:'flex', alignItems:'center', gap:6 }}>
                <Activity size={11} className="text-green-400 animate-pulse"/>
                {entities.length} entities · {payments.length} payments · Updated {lastRefresh.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
              </p>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {isEmpty && (
              <button onClick={handleSeedFromExcel} disabled={seedingInProgress}
                style={{ background:'linear-gradient(135deg, #22c55e, #10b981)', color:'#fff', padding:'10px 16px', borderRadius:10, fontWeight:700, fontSize:13, border:'none', cursor: seedingInProgress ? 'wait' : 'pointer', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 14px rgba(34,197,94,0.4)' }}>
                {seedingInProgress ? <RefreshCw size={14} className="animate-spin"/> : <Upload size={14}/>}
                {seedingInProgress ? 'Importing...' : '📥 Import Excel Data'}
              </button>
            )}
            <button onClick={() => setShowAddEntity(true)}
              style={{ background:'linear-gradient(135deg, #3b82f6, #6366f1)', color:'#fff', padding:'10px 16px', borderRadius:10, fontWeight:700, fontSize:13, border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
              <UserPlus size={14}/> Add New
            </button>
            <button onClick={() => navigate('/staff-management')}
              style={{ background:'linear-gradient(135deg, #a855f7, #7e22ce)', color:'#fff', padding:'10px 16px', borderRadius:10, fontWeight:700, fontSize:13, border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
              title="Open Staff Management for attendance & payslips">
              👔 Staff & Attendance →
            </button>
            <button onClick={loadAll}
              style={{ background:'#1e293b', color:'#f8fafc', padding:'10px 14px', borderRadius:10, border:'1px solid #334155', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
              <RefreshCw size={14}/>
            </button>
            {!isEmpty && (
              <button onClick={handleReset}
                style={{ background:'#7f1d1d22', color:'#fca5a5', padding:'10px 14px', borderRadius:10, border:'1px solid #ef444455', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:11, fontWeight:700 }}
                title="Clear all and re-seed">
                <Trash2 size={12}/> Reset
              </button>
            )}
          </div>
        </div>

        {/* 🔗 LINK INFO BANNER */}
        <div style={{ background:'linear-gradient(90deg, #16a34a22, #3b82f622)', border:'1px solid #16a34a55', borderRadius:12, padding:'12px 16px', marginBottom:20, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <span style={{ fontSize:24 }}>🔗</span>
          <div style={{ flex:1, minWidth:200 }}>
            <p style={{ color:'#86efac', fontSize:13, fontWeight:700, margin:0 }}>
              यह page Staff Management के साथ Auto-Linked है
            </p>
            <p style={{ color:'#94a3b8', fontSize:11, margin:'4px 0 0' }}>
              यहां जोड़ी गई payment Staff Mgmt में दिखेगी • वहां attendance + late penalty से कटौती होगी • दोनों जगह same entity name match होना जरूरी है
            </p>
          </div>
          <button onClick={() => navigate('/staff-management')}
            style={{ background:'#a855f7', color:'#fff', padding:'6px 12px', borderRadius:8, border:'none', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
            👔 Open Staff Mgmt
          </button>
        </div>

        {/* FIRST-TIME EMPTY STATE */}
        {isEmpty && (
          <div style={{ background:'linear-gradient(135deg, #1e293b, #0f172a)', border:'1px solid #334155', borderRadius:16, padding:32, textAlign:'center', marginBottom:20 }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📊</div>
            <h2 style={{ color:'#f8fafc', fontSize:20, fontWeight:800, margin:0 }}>अभी कोई entity नहीं है</h2>
            <p style={{ color:'#94a3b8', fontSize:13, marginTop:8, marginBottom:20 }}>
              Excel data import करें — सभी staff, rent entries, और 277 payment records एक click में।<br/>
              <span style={{ fontSize:11, color:'#64748b' }}>
                (Azzam, Durgesh, Gajender, Raju, Sagar, Premmla, Rent, Home + replacements: Sunil, Priya, Farhan, Vishnu, New House)
              </span>
            </p>
            <button onClick={handleSeedFromExcel} disabled={seedingInProgress}
              style={{ background:'linear-gradient(135deg, #22c55e, #10b981)', color:'#fff', padding:'12px 28px', borderRadius:12, fontWeight:800, fontSize:14, border:'none', cursor: seedingInProgress ? 'wait' : 'pointer', boxShadow:'0 6px 20px rgba(34,197,94,0.4)' }}>
              {seedingInProgress ? '⏳ Importing...' : '📥 Import from Excel Now'}
            </button>
          </div>
        )}

        {/* ═══ SHOW ONLY IF DATA EXISTS ═══ */}
        {!isEmpty && (
          <>
            {/* KPI Row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12, marginBottom:18 }}>
              <KPI icon={Users}       label="Active Staff"    value={calcs.totals.staff}                     sub={`${entities.filter(e=>e.type==='staff').length} total`} color="#3b82f6" onClick={() => setFilterType('staff')}/>
              <KPI icon={HomeIcon}    label="Active Rentals"  value={calcs.totals.rentActive}                sub={`${entities.filter(e=>e.type==='rent').length} total`}  color="#a855f7" onClick={() => setFilterType('rent')}/>
              <KPI icon={DollarSign}  label="Monthly Due"     value={fmtShort(calcs.totals.totalMonthlyDue)} sub="recurring" color="#06b6d4"/>
              <KPI icon={TrendingUp}  label="Paid (All-Time)" value={fmtShort(calcs.totals.totalPaidStaff + calcs.totals.totalPaidRent)} sub="cumulative"      color="#22c55e"/>
              <KPI icon={AlertTriangle} label="Pending Balance" value={fmtShort(calcs.totals.totalPending)}  sub="due now"  color="#ef4444"/>
            </div>

            {/* FILTER TABS */}
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
              <Filter size={14} color="#94a3b8"/>
              {[
                { id:'all',   label:'सभी',     icon:'📋' },
                { id:'staff', label:'कर्मचारी', icon:'👥' },
                { id:'rent',  label:'किराया',  icon:'🏠' },
              ].map(f => (
                <button key={f.id} onClick={() => { setFilterType(f.id); setActiveTab('all'); }}
                  style={{
                    background: filterType === f.id ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : '#1e293b',
                    border:`1px solid ${filterType === f.id ? '#93c5fd' : '#334155'}`,
                    color: filterType === f.id ? '#fff' : '#94a3b8',
                    padding:'8px 14px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer',
                  }}>
                  {f.icon} {f.label}
                </button>
              ))}
            </div>

            {/* ENTITY TABS ROW */}
            <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
              <button onClick={() => setActiveTab('all')}
                style={{
                  background: activeTab === 'all' ? '#8b5cf6' : '#1e293b',
                  border: `1px solid ${activeTab === 'all' ? '#c4b5fd' : '#334155'}`,
                  color: activeTab === 'all' ? '#fff' : '#94a3b8',
                  padding:'8px 12px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer',
                }}>
                📊 All ({calcs.filtered.length})
              </button>
              {calcs.filtered.map(e => {
                const active = activeTab === e.name;
                const icon = e.type === 'staff' ? '👤' : '🏠';
                const pendAlert = e.active && e.balance > 0;
                return (
                  <button key={e.name} onClick={() => setActiveTab(e.name)}
                    style={{
                      background: active ? 'linear-gradient(135deg, #f97316, #ea580c)' : '#1e293b',
                      border: `1px solid ${active ? '#fdba74' : (pendAlert ? '#ef444455' : '#334155')}`,
                      color: active ? '#fff' : e.active ? '#e2e8f0' : '#64748b',
                      padding:'8px 12px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer',
                      position:'relative',
                      opacity: e.active ? 1 : 0.7,
                    }}>
                    {icon} {e.name}
                    {pendAlert && (
                      <span style={{ position:'absolute', top:-4, right:-4, width:10, height:10, borderRadius:'50%', background:'#ef4444', border:'2px solid #0f172a' }}/>
                    )}
                    {!e.active && <span style={{ fontSize:9, marginLeft:4, opacity:0.7 }}>(ended)</span>}
                  </button>
                );
              })}
            </div>

            {/* ═══ ALL VIEW ═══ */}
            {activeTab === 'all' && (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:12, marginBottom:16 }}>
                  {calcs.filtered.map(e => <EntityCard key={e.name} entity={e} onClick={() => setActiveTab(e.name)}/>)}
                </div>

                {/* Monthly trend */}
                {calcs.trendArr.length > 0 && (
                  <Panel title="📈 Monthly Payout Trend" subtitle={`Last ${calcs.trendArr.length} months`}>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={calcs.trendArr}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                        <XAxis dataKey="month" tick={{ fill:'#94a3b8', fontSize:10 }}/>
                        <YAxis tick={{ fill:'#94a3b8', fontSize:10 }} tickFormatter={fmtShort}/>
                        <Tooltip contentStyle={{ background:'#0f172a', border:'1px solid #334155', borderRadius:10 }} formatter={(v,n) => [fmtINR(v), n]}/>
                        <Legend wrapperStyle={{ fontSize:11 }}/>
                        <Bar dataKey="staff" fill="#3b82f6" name="Staff Salary" stackId="a"/>
                        <Bar dataKey="rent"  fill="#a855f7" name="Rent"          stackId="a"/>
                      </BarChart>
                    </ResponsiveContainer>
                  </Panel>
                )}
              </>
            )}

            {/* ═══ SINGLE ENTITY VIEW ═══ */}
            {activeEntity && <EntityDetails
              entity={activeEntity}
              onAddPayment={() => setShowAddPayment(true)}
              onEdit={() => setEditingEntity(activeEntity)}
              onDelete={() => handleDeleteEntity(activeEntity)}
              onDeletePayment={handleDeletePayment}
              onEditPayment={(p) => setEditingPayment(p)}
              generateSalarySlip={(e) => {
                const now = new Date();
                const month = now.toLocaleString('en-IN', { month:'long', year:'numeric' });
                const pays = e.payments.filter(p => {
                  const d = new Date(p.paymentDate);
                  return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear() && !p.cancelled;
                });
                const salary    = pays.filter(p=>!p.type||p.type==='salary').reduce((s,p)=>s+(p.amount||0),0);
                const advance   = pays.filter(p=>p.type==='advance').reduce((s,p)=>s+(p.amount||0),0);
                const bonus     = pays.filter(p=>p.type==='bonus').reduce((s,p)=>s+(p.amount||0),0);
                const incentive = pays.filter(p=>p.type==='incentive').reduce((s,p)=>s+(p.amount||0),0);
                const deduction = pays.filter(p=>p.type==='deduction').reduce((s,p)=>s+(p.amount||0),0);
                const net = salary + bonus + incentive + advance - deduction;
                const fmtR = (n) => '₹' + Number(n||0).toLocaleString('en-IN');
                const row = (label, val, color='#000') => val > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #ddd;font-size:13px"><span>${label}</span><span style="color:${color};font-weight:bold">${fmtR(val)}</span></div>` : '';
                const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Salary Slip</title>
                <style>body{font-family:Arial,sans-serif;padding:24px;color:#000;max-width:480px;margin:0 auto}
                h1{color:#DC0000;margin:0;font-size:22px;text-align:center}
                .sub{text-align:center;font-size:11px;color:#555;margin:2px 0}
                .badge{background:#DC0000;color:#fff;padding:3px 14px;border-radius:12px;font-size:11px;display:inline-block;margin:8px 0}
                .hdr{display:flex;justify-content:space-between;padding:8px;background:#f5f5f5;font-weight:bold;font-size:13px}
                .total{display:flex;justify-content:space-between;padding:10px;border-top:2px solid #DC0000;border-bottom:2px solid #DC0000;font-weight:bold;font-size:16px;color:#DC0000;margin-top:6px}
                .sig{display:flex;justify-content:space-between;margin-top:40px;font-size:11px}
                </style></head><body>
                <h1>🏍️ VP Honda</h1>
                <p class="sub">Parwaliya Sadak, Bhopal (M.P.) · 📞 9713394738</p>
                <p class="sub">GSTIN: 23BCYPD9538B1ZG</p>
                <hr style="border-color:#DC0000;border-width:2px">
                <div style="text-align:center"><span class="badge">SALARY SLIP — ${month}</span></div>
                <div class="hdr"><span>Employee</span><span>${e.name}</span></div>
                <div class="hdr" style="background:#fff"><span>Monthly CTC</span><span>${fmtR(e.monthlyAmount)}</span></div>
                ${row('Basic Salary', salary, '#16a34a')}
                ${row('Bonus', bonus, '#2563eb')}
                ${row('Incentive/Commission', incentive, '#7c3aed')}
                ${row('Advance', advance, '#ea580c')}
                ${deduction>0?`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #ddd;font-size:13px"><span>Deductions</span><span style="color:#dc2626;font-weight:bold">- ${fmtR(deduction)}</span></div>`:''}
                <div class="total"><span>Net Payable</span><span>${fmtR(net)}</span></div>
                <div class="sig">
                  <div>Employee Signature<br/><br/>______________</div>
                  <div style="text-align:right">For: VP Honda<br/><br/>______________<br/>Authorised Sign</div>
                </div>
                </body></html>`;
                const win = window.open('', '_blank', 'width=560,height=720');
                if (win) { win.document.write(html); win.document.close(); setTimeout(()=>win.print(), 500); }
              }}
            />}
          </>
        )}

        {/* MODAL: Add Payment */}
        {showAddPayment && activeEntity && (
          <AddPaymentModal entity={activeEntity} onClose={() => setShowAddPayment(false)} onSuccess={() => { setShowAddPayment(false); loadAll(); }}/>
        )}

        {/* MODAL: Add Entity */}
        {showAddEntity && (
          <AddEntityModal onClose={() => setShowAddEntity(false)} onSuccess={() => { setShowAddEntity(false); loadAll(); }} existing={entities}/>
        )}

        {/* MODAL: Edit Entity */}
        {editingEntity && (
          <EditEntityModal entity={editingEntity} onClose={() => setEditingEntity(null)} onSuccess={() => { setEditingEntity(null); loadAll(); }}/>
        )}

        {/* MODAL: Edit Payment */}
        {editingPayment && (
          <EditPaymentModal payment={editingPayment} onClose={() => setEditingPayment(null)} onSuccess={() => { setEditingPayment(null); loadAll(); }}/>
        )}

      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ══════════════════════════════════════════════════════════════════════════

function KPI({ icon: Icon, label, value, sub, color, onClick }) {
  return (
    <div onClick={onClick}
      style={{ background:`linear-gradient(135deg, ${color}22, ${color}08)`, border:`1px solid ${color}40`, borderRadius:14, padding:'14px 16px', cursor: onClick?'pointer':'default', transition:'all 0.25s' }}
      className={onClick ? 'hover:scale-[1.02]' : ''}>
      <div style={{ display:'flex', justifyContent:'space-between' }}>
        <div style={{ width:34, height:34, borderRadius:10, background:color, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 4px 14px ${color}55` }}>
          <Icon size={16} color="#fff"/>
        </div>
      </div>
      <p style={{ color:'#94a3b8', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, margin:'10px 0 2px' }}>{label}</p>
      <p style={{ color:'#f8fafc', fontSize:22, fontWeight:900, margin:0 }}>{value}</p>
      {sub && <p style={{ color:'#64748b', fontSize:10 }}>{sub}</p>}
    </div>
  );
}

function Panel({ title, subtitle, action, children }) {
  return (
    <div style={{ background:'linear-gradient(135deg, #1e293b, #0f172a)', border:'1px solid #334155', borderRadius:16, padding:18, marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:14 }}>
        <div>
          <h3 style={{ color:'#f8fafc', fontSize:14, fontWeight:800, margin:0 }}>{title}</h3>
          {subtitle && <p style={{ color:'#94a3b8', fontSize:11, margin:'2px 0 0' }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── Entity Card (in All view) ───────────────────────────────────────────────
function EntityCard({ entity: e, onClick }) {
  const isOverdue = e.active && e.balance > 0;
  const isSurplus = e.balance < 0;
  const typeColor = e.type === 'staff' ? '#3b82f6' : '#a855f7';
  const statusColor = !e.active ? '#64748b' : isOverdue ? '#ef4444' : isSurplus ? '#22c55e' : '#eab308';

  return (
    <div onClick={onClick}
      style={{
        background:'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
        border:`1px solid ${statusColor}40`, borderRadius:14, padding:16,
        cursor:'pointer', transition:'all 0.25s',
        opacity: e.active ? 1 : 0.75,
      }}
      className="hover:scale-[1.01] hover:shadow-xl">
      {/* Header with photo */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:10, gap:10 }}>
        <div style={{ display:'flex', gap:10, flex:1, minWidth:0 }}>
          <div style={{
            width:44, height:44, borderRadius:'50%', flexShrink:0,
            background: e.photo ? `url(${e.photo}) center/cover` : `linear-gradient(135deg, ${typeColor}, ${typeColor}aa)`,
            display:'flex', alignItems:'center', justifyContent:'center',
            border:`2px solid ${statusColor}66`,
          }}>
            {!e.photo && <span style={{ fontSize:20 }}>{e.type === 'staff' ? '👤' : '🏠'}</span>}
          </div>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
              <h3 style={{ color:'#f8fafc', fontSize:15, fontWeight:800, margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{e.name}</h3>
              {!e.active && <span style={{ background:'#64748b22', color:'#94a3b8', fontSize:9, padding:'2px 6px', borderRadius:4, flexShrink:0 }}>ENDED</span>}
            </div>
            <p style={{ color:'#64748b', fontSize:10, margin:0 }}>
              {e.type === 'staff' ? 'Staff' : 'Rental'} · {fmtINR(e.monthlyAmount)}/mo
            </p>
          </div>
        </div>
        {isOverdue && (
          <div style={{ background:'#ef444422', border:'1px solid #ef444466', borderRadius:8, padding:'2px 8px', flexShrink:0 }}>
            <span style={{ color:'#fca5a5', fontSize:10, fontWeight:700 }}>⚠ DUE</span>
          </div>
        )}
      </div>

      {/* Dates */}
      <div style={{ display:'flex', gap:8, fontSize:10, marginBottom:10 }}>
        <span style={{ color:'#94a3b8' }}>📅 {fmtDate(e.startDate)}</span>
        {e.endDate && <span style={{ color:'#fca5a5' }}>→ {fmtDate(e.endDate)}</span>}
      </div>

      {/* Replacement chain */}
      {(e.replaces || e.replacedBy) && (
        <div style={{ background:'#1e293b', borderRadius:8, padding:'6px 10px', marginBottom:10, fontSize:10 }}>
          {e.replaces && <span style={{ color:'#86efac' }}>← Replaces <b>{e.replaces}</b> </span>}
          {e.replacedBy && <span style={{ color:'#fca5a5' }}>→ Replaced by <b>{e.replacedBy}</b></span>}
        </div>
      )}

      {/* Metrics */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
        <Metric label="Paid"     value={fmtShort(e.totalPaid)}    color="#22c55e"/>
        <Metric label="Expected" value={fmtShort(e.expectedTotal)} color="#3b82f6"/>
        <Metric
          label={e.balance > 0 ? 'Pending' : (e.balance < 0 ? 'Overpaid' : 'Cleared')}
          value={fmtShort(Math.abs(e.balance))}
          color={e.balance > 0 ? '#ef4444' : e.balance < 0 ? '#22c55e' : '#64748b'}
        />
      </div>

      {/* ✅ Absent deduction badge — staff only */}
      {e.type === 'staff' && (
        <div style={{ marginTop:8, background: e.absentDeduction>0?'#7f1d1d22':'#14532d22', border:`1px solid ${e.absentDeduction>0?'#ef444455':'#22c55e55'}`, borderRadius:8, padding:'6px 10px' }}>
          {e.absentDeduction > 0 ? (
            <>
              <p style={{ color:'#fca5a5', fontSize:10, fontWeight:700, margin:0 }}>✂️ कटौती: {fmtShort(e.absentDeduction)} · {e.deductionNote}</p>
              <p style={{ color:'#fbbf24', fontSize:11, fontWeight:800, margin:'3px 0 0' }}>💰 Net Payable: {fmtShort(e.netPayable)}</p>
            </>
          ) : (
            <p style={{ color:'#86efac', fontSize:10, margin:0 }}>{e.deductionNote || `💰 Net: ${fmtShort(e.netPayable)}`}</p>
          )}
        </div>
      )}

      <p style={{ color:'#64748b', fontSize:9, textAlign:'center', marginTop:8 }}>
        {e.monthsActive} महीने · {e.payments.length} payments
      </p>
    </div>
  );
}

function Metric({ label, value, color }) {
  return (
    <div style={{ background:'#0f172a', borderRadius:8, padding:6, textAlign:'center' }}>
      <p style={{ color:'#64748b', fontSize:9, margin:0 }}>{label}</p>
      <p style={{ color, fontSize:13, fontWeight:800, margin:'2px 0 0' }}>{value}</p>
    </div>
  );
}

// ── Single Entity Details View ──────────────────────────────────────────────
function EntityDetails({ entity: e, onAddPayment, onEdit, onDelete, onDeletePayment, onEditPayment, generateSalarySlip = ()=>{} }) {
  const [showHistory, setShowHistory] = useState(true);
  const [processingMonth, setProcessingMonth] = useState(null);

  // Group payments by month
  const byMonth = {};
  e.payments.forEach(p => {
    const d = new Date(p.paymentDate);
    if (isNaN(d)) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!byMonth[key]) byMonth[key] = { label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, total: 0, count: 0, list: [] };
    byMonth[key].total += p.amount || 0;
    byMonth[key].count += 1;
    byMonth[key].list.push(p);
  });
  const monthChart = Object.entries(byMonth).sort((a,b) => a[0].localeCompare(b[0])).map(([k, v]) => ({
    month: v.label.slice(0, 3) + ' ' + v.label.slice(-2),
    paid: v.total,
    expected: e.monthlyAmount,
  }));

  return (
    <div style={{ display:'grid', gap:14 }}>
      {/* Header with photo + actions */}
      <div style={{ background:'linear-gradient(135deg, #1e293b, #0f172a)', border:'1px solid #334155', borderRadius:16, padding:20 }}>
        <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'space-between', alignItems:'start', gap:14 }}>
          <div style={{ display:'flex', gap:14, alignItems:'start', flex:1, minWidth:280 }}>
            {/* Profile Photo */}
            <div style={{
              width:72, height:72, borderRadius:'50%',
              background: e.photo ? `url(${e.photo}) center/cover` : `linear-gradient(135deg, ${e.type==='staff'?'#3b82f6':'#a855f7'}, ${e.type==='staff'?'#1e40af':'#7e22ce'})`,
              display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink:0, border:'3px solid #334155',
            }}>
              {!e.photo && <span style={{ fontSize:28 }}>{e.type === 'staff' ? '👤' : '🏠'}</span>}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, flexWrap:'wrap' }}>
                <h2 style={{ color:'#f8fafc', fontSize:22, fontWeight:900, margin:0 }}>{e.name}</h2>
                {e.active ? (
                  <span style={{ background:'#22c55e22', color:'#86efac', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6 }}>ACTIVE</span>
                ) : (
                  <span style={{ background:'#64748b33', color:'#94a3b8', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6 }}>ENDED</span>
                )}
                <span style={{ background: e.type==='staff'?'#3b82f622':'#a855f722', color: e.type==='staff'?'#93c5fd':'#d8b4fe', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6 }}>
                  {e.type === 'staff' ? '👤 STAFF' : '🏠 RENT'}
                </span>
              </div>
              <p style={{ color:'#94a3b8', fontSize:12, lineHeight:1.5 }}>
                Monthly: <b style={{ color:'#f8fafc' }}>{fmtINR(e.monthlyAmount)}</b>
                <br/>
                Start: <b style={{ color:'#f8fafc' }}>{fmtDate(e.startDate)}</b>
                {e.endDate && <> · End: <b style={{ color:'#fca5a5' }}>{fmtDate(e.endDate)}</b></>}
              </p>
              {e.notes && <p style={{ color:'#64748b', fontSize:11, marginTop:4 }}>📝 {e.notes}</p>}
              {(e.replaces || e.replacedBy) && (
                <div style={{ marginTop:8, display:'flex', gap:8, flexWrap:'wrap' }}>
                  {e.replaces && <span style={{ background:'#22c55e22', color:'#86efac', fontSize:10, padding:'4px 10px', borderRadius:8 }}>← Replaces <b>{e.replaces}</b></span>}
                  {e.replacedBy && <span style={{ background:'#ef444422', color:'#fca5a5', fontSize:10, padding:'4px 10px', borderRadius:8 }}>Replaced by <b>{e.replacedBy}</b> →</span>}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display:'flex', flexDirection:'column', gap:6, minWidth:140 }}>
            {e.active && (
              <button onClick={onAddPayment}
                style={{ background:'linear-gradient(135deg, #22c55e, #10b981)', color:'#fff', padding:'10px 14px', borderRadius:10, fontWeight:700, fontSize:12, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, boxShadow:'0 4px 14px rgba(34,197,94,0.4)' }}>
                <Plus size={13}/> Add Payment
              </button>
            )}
            <button onClick={onEdit}
              style={{ background:'#3b82f622', border:'1px solid #3b82f666', color:'#93c5fd', padding:'8px 14px', borderRadius:10, fontWeight:700, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <Edit2 size={12}/> Edit
            </button>
            <button onClick={onDelete}
              style={{ background:'#ef444422', border:'1px solid #ef444466', color:'#fca5a5', padding:'8px 14px', borderRadius:10, fontWeight:700, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <Trash2 size={12}/> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10 }}>
        <BigMetric label="Total Paid"     value={fmtINR(e.totalPaid)}       sub={`${e.payments.length} payments`} color="#22c55e"/>
        <BigMetric label="Months Active"  value={e.monthsActive}            sub="from hire date" color="#3b82f6"/>
        <BigMetric label="Expected Total" value={fmtINR(e.expectedTotal)}   sub="monthly × months" color="#a855f7"/>
        <BigMetric
          label={e.balance > 0 ? 'Pending Balance' : e.balance < 0 ? 'Overpaid' : 'Cleared'}
          value={fmtINR(Math.abs(e.balance))}
          sub={e.balance > 0 ? 'due now' : e.balance < 0 ? 'paid extra' : 'all good'}
          color={e.balance > 0 ? '#ef4444' : e.balance < 0 ? '#22c55e' : '#64748b'}
        />
      </div>

      {/* Monthly payout chart */}
      {monthChart.length > 0 && (
        <Panel title="📊 Monthly Payout" subtitle="Paid vs Expected per month">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
              <XAxis dataKey="month" tick={{ fill:'#94a3b8', fontSize:10 }}/>
              <YAxis tick={{ fill:'#94a3b8', fontSize:10 }} tickFormatter={fmtShort}/>
              <Tooltip contentStyle={{ background:'#0f172a', border:'1px solid #334155', borderRadius:10 }} formatter={(v) => fmtINR(v)}/>
              <Legend wrapperStyle={{ fontSize:11 }}/>
              <Bar dataKey="paid" fill="#22c55e" name="Paid" radius={[4,4,0,0]}/>
              <Bar dataKey="expected" fill="#64748b44" name="Monthly Target" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {/* Monthly Salary Breakdown — staff only */}
      {e.type === 'staff' && (
        <Panel title="📅 Monthly Salary Processing" subtitle="हर महीने की salary process करें — click करें">
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', fontSize:11, borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ color:'#94a3b8', fontSize:10, textTransform:'uppercase', borderBottom:'1px solid #334155' }}>
                  <th style={{ padding:'8px 6px', textAlign:'left' }}>Month</th>
                  <th style={{ padding:'8px 6px', textAlign:'right' }}>Monthly</th>
                  <th style={{ padding:'8px 6px', textAlign:'right' }}>Salary</th>
                  <th style={{ padding:'8px 6px', textAlign:'right' }}>Extras</th>
                  <th style={{ padding:'8px 6px', textAlign:'right' }}>Deduction</th>
                  <th style={{ padding:'8px 6px', textAlign:'right' }}>Net</th>
                  <th style={{ padding:'8px 6px', textAlign:'center' }}>Status</th>
                  <th style={{ padding:'8px 6px', textAlign:'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const MONTHS_L = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                  const rows = [];
                  const start = new Date(e.startDate); start.setDate(1);
                  const endD  = e.endDate ? new Date(e.endDate) : new Date();
                  const cur   = new Date(start.getFullYear(), start.getMonth(), 1);
                  const last  = new Date(endD.getFullYear(), endD.getMonth(), 1);
                  while (cur <= last) {
                    const y = cur.getFullYear(), m = cur.getMonth();
                    const label = `${MONTHS_L[m]} ${y}`;
                    const mp = e.payments.filter(p => {
                      const d = new Date(p.paymentDate);
                      return d.getMonth()===m && d.getFullYear()===y && !p.cancelled;
                    });
                    const salary    = mp.filter(p=>!p.type||p.type==='salary').reduce((s,p)=>s+(p.amount||0),0);
                    const advance   = mp.filter(p=>p.type==='advance').reduce((s,p)=>s+(p.amount||0),0);
                    const bonus     = mp.filter(p=>p.type==='bonus').reduce((s,p)=>s+(p.amount||0),0);
                    const incentive = mp.filter(p=>p.type==='incentive').reduce((s,p)=>s+(p.amount||0),0);
                    const deduction = mp.filter(p=>p.type==='deduction').reduce((s,p)=>s+(p.amount||0),0);
                    const extras    = advance + bonus + incentive;
                    const net       = salary + extras - deduction;
                    const monthly   = e.monthlyAmount || 0;
                    const isCur     = y===new Date().getFullYear() && m===new Date().getMonth();
                    const hasPay    = mp.length > 0;
                    const statusColor = salary>0?'#86efac':isCur?'#fbbf24':'#64748b';
                    const statusText  = salary>0?'✅ Done':isCur?'🔵 Current':'⏳ Pending';
                    rows.push(
                      <tr key={`${y}-${m}`} style={{ borderBottom:'1px solid #1e293b', background:isCur?'#fbbf2408':'transparent' }}>
                        <td style={{ padding:'7px 6px', color:isCur?'#fbbf24':'#e2e8f0', fontWeight:isCur?700:400 }}>{label}</td>
                        <td style={{ padding:'7px 6px', textAlign:'right', color:'#94a3b8' }}>{fmtINR(monthly)}</td>
                        <td style={{ padding:'7px 6px', textAlign:'right', color:'#86efac' }}>{salary>0?fmtINR(salary):'—'}</td>
                        <td style={{ padding:'7px 6px', textAlign:'right', color:'#fdba74' }}>{extras>0?`+${fmtINR(extras)}`:'—'}</td>
                        <td style={{ padding:'7px 6px', textAlign:'right', color:'#fca5a5' }}>{deduction>0?`-${fmtINR(deduction)}`:'—'}</td>
                        <td style={{ padding:'7px 6px', textAlign:'right', color:'#fff', fontWeight:700 }}>{hasPay?fmtINR(net):'—'}</td>
                        <td style={{ padding:'7px 6px', textAlign:'center', color:statusColor, fontSize:10 }}>{statusText}</td>
                        <td style={{ padding:'7px 6px', textAlign:'center' }}>
                          <button
                            onClick={() => setProcessingMonth({ y, m, label, entity: e, existing: mp })}
                            style={{ background: salary>0?'#1e293b':'#DC000022', border:`1px solid ${salary>0?'#334155':'#DC000066'}`, color: salary>0?'#94a3b8':'#fca5a5', padding:'4px 10px', borderRadius:6, fontSize:10, cursor:'pointer', fontWeight:700 }}>
                            {salary>0?'✏️ Edit':'⚡ Process'}
                          </button>
                        </td>
                      </tr>
                    );
                    cur.setMonth(cur.getMonth()+1);
                  }
                  return rows;
                })()}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Payment History */}
      <Panel title={`💰 Payment History (${e.payments.length})`} subtitle="All transactions — tap edit/delete"
        action={
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => generateSalarySlip(e)} title="Salary Slip PDF"
              style={{ background:'#DC000022', border:'1px solid #DC000066', color:'#fca5a5', padding:'6px 12px', borderRadius:8, fontSize:11, cursor:'pointer' }}>
              🧾 Slip
            </button>
            <button onClick={() => setShowHistory(!showHistory)}
              style={{ background:'#3b82f622', border:'1px solid #3b82f655', color:'#93c5fd', padding:'6px 12px', borderRadius:8, fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
              {showHistory ? 'Hide' : 'Show'} <ChevronDown size={11} style={{ transform: showHistory ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}/>
            </button>
          </div>
        }>
        {showHistory && (
          e.payments.length === 0 ? (
            <p style={{ color:'#64748b', textAlign:'center', padding:20 }}>No payments yet</p>
          ) : (
            <div style={{ overflowX:'auto', maxHeight:400, overflowY:'auto' }}>
              <table style={{ width:'100%', fontSize:12 }}>
                <thead style={{ position:'sticky', top:0, background:'#0f172a' }}>
                  <tr style={{ color:'#94a3b8', fontSize:10, textTransform:'uppercase', borderBottom:'1px solid #334155' }}>
                    <th style={{ padding:8, textAlign:'left' }}>Date</th>
                    <th style={{ padding:8, textAlign:'right' }}>Amount</th>
                    <th style={{ padding:8, textAlign:'left' }}>Type</th>
                    <th style={{ padding:8, textAlign:'left' }}>Method</th>
                    <th style={{ padding:8, textAlign:'left' }}>Notes</th>
                    <th style={{ padding:8, textAlign:'center', width:70 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[...e.payments].sort((a,b) => new Date(b.paymentDate) - new Date(a.paymentDate)).map((p,i) => (
                    <tr key={i} style={{ borderBottom:'1px solid #1e293b' }}>
                      <td style={{ padding:'8px', color:'#e2e8f0' }}>{fmtDate(p.paymentDate)}</td>
                      <td style={{ padding:'8px', fontWeight:700, textAlign:'right', color: p.type==='deduction'?'#f87171':'#86efac' }}>{p.type==='deduction'?'-':''}{fmtINR(p.amount)}</td>
                      <td style={{ padding:'8px' }}>
                        <span style={{ background:
                          p.type==='advance'?'#f9731622':p.type==='bonus'?'#3b82f622':
                          p.type==='incentive'?'#a855f722':p.type==='deduction'?'#ef444422':'#22c55e22',
                          color:
                          p.type==='advance'?'#fdba74':p.type==='bonus'?'#93c5fd':
                          p.type==='incentive'?'#d8b4fe':p.type==='deduction'?'#fca5a5':'#86efac',
                          fontSize:9, padding:'2px 8px', borderRadius:6, fontWeight:700 }}>
                          {(p.type || 'salary').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding:'8px', color:'#94a3b8', fontSize:11 }}>
                        {p.paymentMethod ? (
                          <span style={{ background:'#1e293b', padding:'2px 6px', borderRadius:4 }}>
                            {p.paymentMethod==='upi'?'📱 UPI':p.paymentMethod==='bank-transfer'?'🏦 Bank':p.paymentMethod==='cheque'?'📝 Cheque':'💵 Cash'}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding:'8px', color:'#64748b' }}>{p.notes || '—'}</td>
                      <td style={{ padding:'8px', textAlign:'center' }}>
                        <button onClick={() => onEditPayment(p)} title="Edit"
                          style={{ background:'transparent', border:'none', color:'#60a5fa', cursor:'pointer', marginRight:4, padding:4 }}>
                          <Edit2 size={12}/>
                        </button>
                        <button onClick={() => onDeletePayment(p)} title="Delete"
                          style={{ background:'transparent', border:'none', color:'#f87171', cursor:'pointer', padding:4 }}>
                          <Trash2 size={12}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </Panel>
      {processingMonth && (
        <MonthlyPayModal
          data={processingMonth}
          onClose={() => setProcessingMonth(null)}
          onSuccess={() => { setProcessingMonth(null); onAddPayment(); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MonthlyPayModal — सब fields एक जगह
// ═══════════════════════════════════════════════════════════
function MonthlyPayModal({ data, onClose, onSuccess }) {
  const { y, m, label, entity: e } = data;
  const monthly   = e.monthlyAmount || 0;
  const perDay    = Math.round(monthly / 26);

  const [absentDays,    setAbsentDays]    = useState(0);
  const [lateDays,      setLateDays]      = useState(0);
  const [latePenalty,   setLatePenalty]   = useState(50);
  const [mobilePenalty, setMobilePenalty] = useState(0);
  const [otherPenalty,  setOtherPenalty]  = useState(0);
  const [otherNote,     setOtherNote]     = useState('');
  const [incentive,     setIncentive]     = useState(0);
  const [bonus,         setBonus]         = useState(0);
  const [advance,       setAdvance]       = useState(0);
  const [payMethod,     setPayMethod]     = useState('cash');
  const [txnId,         setTxnId]         = useState('');
  const [payDate,       setPayDate]       = useState(`${y}-${String(m+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`);
  const [saving,        setSaving]        = useState(false);

  // ── Live calculations ──────────────────────────────────────────────────────
  const absentDed   = Math.round(absentDays * perDay);
  const lateDed     = Math.round(lateDays * latePenalty);
  const totalDed    = absentDed + lateDed + Number(mobilePenalty||0) + Number(otherPenalty||0);
  const netSalary   = Math.max(0, monthly - totalDed);
  const totalPayable= netSalary + Number(incentive||0) + Number(bonus||0) + Number(advance||0);

  const fmtR = (n) => '₹' + Number(n||0).toLocaleString('en-IN');

  const save = async () => {
    setSaving(true);
    const baseBody = { staffName:e.name, staffId:e.name.toLowerCase().replace(/\s/g,'_'), paymentDate:payDate, forMonth:m+1, forYear:y, paymentMethod:payMethod, transactionId:txnId||'' };
    const saves = [];
    // 1. Salary (with deductions baked in)
    if (netSalary > 0) saves.push({ ...baseBody, type:'salary', amount:netSalary, notes:`Salary ${label}${absentDays>0?` | ${absentDays}d absent (-${fmtR(absentDed)})` : ''}${lateDays>0?` | ${lateDays}d late (-${fmtR(lateDed)})` : ''}${mobilePenalty>0?` | Mobile penalty (-${fmtR(mobilePenalty)})` : ''}${otherPenalty>0?` | ${otherNote||'Other'} (-${fmtR(otherPenalty)})` : ''}` });
    // 2. Deduction entries if any
    if (absentDed + lateDed + Number(mobilePenalty||0) + Number(otherPenalty||0) > 0) {
      saves.push({ ...baseBody, type:'deduction', amount:totalDed, notes:`${absentDays>0?`${absentDays}d absent `:'' }${lateDays>0?`${lateDays}d late `:''}${mobilePenalty>0?`Mobile penalty `:''}${otherPenalty>0?`${otherNote||'Other'} `:''}कटौती` });
    }
    if (incentive > 0) saves.push({ ...baseBody, type:'incentive', amount:Number(incentive), notes:`Incentive ${label}` });
    if (bonus > 0)     saves.push({ ...baseBody, type:'bonus',     amount:Number(bonus),     notes:`Bonus ${label}` });
    if (advance > 0)   saves.push({ ...baseBody, type:'advance',   amount:Number(advance),   notes:`Advance ${label}` });

    try {
      for (const body of saves) {
        await fetch(api('/api/salaries'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      }
      onSuccess();
    } catch(err) { alert('Save failed: ' + err.message); }
    setSaving(false);
  };

  const inSt = { width:'100%', background:'#020617', border:'1px solid #334155', color:'#fff', borderRadius:8, padding:'8px 10px', fontSize:12, outline:'none', boxSizing:'border-box' };
  const lbSt = { display:'block', fontSize:10, color:'#94a3b8', fontWeight:600, marginBottom:3 };
  const secSt= { background:'#020617', border:'1px solid #1e293b', borderRadius:10, padding:12, marginBottom:10 };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:200, overflowY:'auto', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:14, padding:20, width:'100%', maxWidth:500, marginTop:20 }} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ marginBottom:14 }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:900, color:'#DC0000' }}>⚡ Salary Process — {label}</h2>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#94a3b8' }}>{e.name} · Monthly: {fmtR(monthly)} · Per day: {fmtR(perDay)}</p>
        </div>

        {/* 1. DEDUCTIONS */}
        <div style={secSt}>
          <p style={{ margin:'0 0 8px', fontWeight:700, color:'#fca5a5', fontSize:12 }}>✂️ कटौती (Deductions)</p>

          {/* Absent days */}
          <label style={lbSt}>🚫 Absent Days (0–26) → प्रति दिन {fmtR(perDay)}</label>
          <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
            {[0,1,2,3,5,7,10,15,20,26].map(d=>(
              <button key={d} type="button" onClick={()=>setAbsentDays(d)}
                style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${absentDays===d?'#ef4444':'#334155'}`, background:absentDays===d?'#7f1d1d33':'transparent', color:absentDays===d?'#fca5a5':'#94a3b8', fontSize:11, cursor:'pointer', fontWeight:700 }}>
                {d}d{d>0?` = -${fmtR(Math.round(d*perDay))}`:''}
              </button>
            ))}
          </div>
          <input type="number" min={0} max={26} value={absentDays} onChange={e=>setAbsentDays(+e.target.value)} style={{ ...inSt, marginBottom:8 }} placeholder="या manual दिन डालें"/>

          {/* Late days */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <div>
              <label style={lbSt}>⏰ Late Days</label>
              <input type="number" min={0} value={lateDays} onChange={e=>setLateDays(+e.target.value)} style={inSt}/>
            </div>
            <div>
              <label style={lbSt}>💸 Late Penalty ₹/day</label>
              <input type="number" min={0} value={latePenalty} onChange={e=>setLatePenalty(+e.target.value)} style={inSt}/>
            </div>
          </div>

          {/* Mobile penalty */}
          <label style={lbSt}>📱 Mobile Penalty ₹</label>
          <input type="number" min={0} value={mobilePenalty} onChange={e=>setMobilePenalty(+e.target.value)} style={{ ...inSt, marginBottom:8 }}/>

          {/* Other penalty */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div>
              <label style={lbSt}>⚠️ Other Penalty ₹</label>
              <input type="number" min={0} value={otherPenalty} onChange={e=>setOtherPenalty(+e.target.value)} style={inSt}/>
            </div>
            <div>
              <label style={lbSt}>📝 Reason</label>
              <input type="text" value={otherNote} onChange={e=>setOtherNote(e.target.value)} placeholder="reason..." style={inSt}/>
            </div>
          </div>
        </div>

        {/* 2. EXTRAS */}
        <div style={secSt}>
          <p style={{ margin:'0 0 8px', fontWeight:700, color:'#86efac', fontSize:12 }}>➕ Extras (जोड़े जाएंगे)</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            <div><label style={lbSt}>🏆 Incentive ₹</label><input type="number" min={0} value={incentive} onChange={e=>setIncentive(+e.target.value)} style={inSt}/></div>
            <div><label style={lbSt}>🎁 Bonus ₹</label><input type="number" min={0} value={bonus} onChange={e=>setBonus(+e.target.value)} style={inSt}/></div>
            <div><label style={lbSt}>💵 Advance ₹</label><input type="number" min={0} value={advance} onChange={e=>setAdvance(+e.target.value)} style={inSt}/></div>
          </div>
        </div>

        {/* 3. LIVE SUMMARY */}
        <div style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:10, padding:12, marginBottom:12 }}>
          <p style={{ margin:'0 0 8px', fontWeight:700, color:'#fff', fontSize:12 }}>📊 Live Calculation</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:12 }}>
            <span style={{ color:'#94a3b8' }}>Monthly Salary:</span><span style={{ textAlign:'right' }}>{fmtR(monthly)}</span>
            {absentDed>0&&<><span style={{ color:'#fca5a5' }}>- Absent ({absentDays}d):</span><span style={{ color:'#fca5a5', textAlign:'right' }}>-{fmtR(absentDed)}</span></>}
            {lateDed>0&&<><span style={{ color:'#fca5a5' }}>- Late ({lateDays}d):</span><span style={{ color:'#fca5a5', textAlign:'right' }}>-{fmtR(lateDed)}</span></>}
            {Number(mobilePenalty)>0&&<><span style={{ color:'#fca5a5' }}>- Mobile:</span><span style={{ color:'#fca5a5', textAlign:'right' }}>-{fmtR(mobilePenalty)}</span></>}
            {Number(otherPenalty)>0&&<><span style={{ color:'#fca5a5' }}>- {otherNote||'Other'}:</span><span style={{ color:'#fca5a5', textAlign:'right' }}>-{fmtR(otherPenalty)}</span></>}
            <span style={{ color:'#93c5fd', fontWeight:700 }}>Net Salary:</span><span style={{ color:'#93c5fd', fontWeight:700, textAlign:'right' }}>{fmtR(netSalary)}</span>
            {Number(incentive)>0&&<><span style={{ color:'#86efac' }}>+ Incentive:</span><span style={{ color:'#86efac', textAlign:'right' }}>+{fmtR(incentive)}</span></>}
            {Number(bonus)>0&&<><span style={{ color:'#86efac' }}>+ Bonus:</span><span style={{ color:'#86efac', textAlign:'right' }}>+{fmtR(bonus)}</span></>}
            {Number(advance)>0&&<><span style={{ color:'#fdba74' }}>+ Advance:</span><span style={{ color:'#fdba74', textAlign:'right' }}>+{fmtR(advance)}</span></>}
          </div>
          <div style={{ borderTop:'2px solid #DC0000', marginTop:8, paddingTop:8, display:'flex', justifyContent:'space-between', fontWeight:900, fontSize:16 }}>
            <span>💰 Total Payable:</span><span style={{ color:'#DC0000' }}>{fmtR(totalPayable)}</span>
          </div>
        </div>

        {/* 4. PAYMENT METHOD */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
          <div>
            <label style={lbSt}>📆 Payment Date</label>
            <input type="date" value={payDate} onChange={e=>setPayDate(e.target.value)} style={inSt}/>
          </div>
          <div>
            <label style={lbSt}>💳 Method</label>
            <select value={payMethod} onChange={e=>setPayMethod(e.target.value)} style={inSt}>
              <option value="cash">💵 Cash</option>
              <option value="upi">📱 UPI</option>
              <option value="bank-transfer">🏦 Bank Transfer</option>
              <option value="cheque">📝 Cheque</option>
            </select>
          </div>
        </div>
        {(payMethod==='upi'||payMethod==='bank-transfer') && (
          <div style={{ marginBottom:12 }}>
            <label style={lbSt}>🔢 Transaction ID / UTR</label>
            <input type="text" value={txnId} onChange={e=>setTxnId(e.target.value)} placeholder="UPI Ref / UTR..." style={inSt}/>
          </div>
        )}

        {/* 5. BUTTONS */}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onClose} style={{ flex:1, background:'#334155', border:'none', color:'#fff', padding:'10px', borderRadius:10, cursor:'pointer', fontWeight:700 }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex:2, background:saving?'#374151':'linear-gradient(135deg,#DC0000,#991b1b)', border:'none', color:'#fff', padding:'10px', borderRadius:10, cursor:'pointer', fontWeight:900, fontSize:14 }}>
            {saving?'⏳ Saving...':'✅ Save & Process Salary'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── BigMetric ───────────────────────────────────────────────────────────────
function BigMetric({ label, value, sub, color }) {
  return (
    <div style={{ background:`linear-gradient(135deg, ${color}22, ${color}08)`, border:`1px solid ${color}40`, borderRadius:12, padding:14 }}>
      <p style={{ color:'#94a3b8', fontSize:10, fontWeight:700, textTransform:'uppercase' }}>{label}</p>
      <p style={{ color:'#f8fafc', fontSize:20, fontWeight:900, margin:'4px 0 2px' }}>{value}</p>
      <p style={{ color:'#64748b', fontSize:10 }}>{sub}</p>
    </div>
  );
}

// ── Add Payment Modal ───────────────────────────────────────────────────────
function AddPaymentModal({ entity, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState(entity.type === 'staff' ? 'salary' : 'salary');
  const [notes, setNotes] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [txnId, setTxnId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const save = async () => {
    if (!amount || parseFloat(amount) <= 0) { alert('Valid amount डालें'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(api('/api/salaries'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffName: entity.name,
          staffId: entity.name.toLowerCase().replace(/\s/g, '_'),
          type,
          amount: parseFloat(amount),
          paymentDate: date,
          forMonth: parseInt(date.split('-')[1]),
          forYear: parseInt(date.split('-')[0]),
          paymentMethod: payMethod,
          transactionId: txnId || '',
          notes: [notes, txnId ? `TXN: ${txnId}` : ''].filter(Boolean).join(' | '),
        }),
      });
      if (res.ok) {
        alert(`✅ ${fmtINR(parseFloat(amount))} added for ${entity.name}`);
        onSuccess();
      } else {
        const data = await res.json();
        alert(`❌ Error: ${data.error || 'Save failed'}`);
      }
    } catch (err) {
      alert(`❌ ${err.message}`);
    }
    setSubmitting(false);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }} onClick={onClose}>
      <div style={{ background:'#1e293b', borderRadius:16, padding:24, maxWidth:420, width:'100%', border:'1px solid #334155' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color:'#f8fafc', fontSize:18, fontWeight:800, margin:0 }}>💰 Add Payment</h3>
        <p style={{ color:'#94a3b8', fontSize:12, margin:'4px 0 16px' }}>For <b style={{ color:'#f8fafc' }}>{entity.name}</b></p>

        <FormField label="Amount (₹)">
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
            style={inputStyle}/>
        </FormField>

        <FormField label="Payment Date">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle}/>
        </FormField>

        <FormField label="Type">
          <select value={type} onChange={e => setType(e.target.value)} style={inputStyle}>
            <option value="salary">{entity.type === 'staff' ? 'Salary' : 'Rent'}</option>
            <option value="advance">Advance</option>
            <option value="bonus">Bonus</option>
            <option value="incentive">Incentive</option>
            <option value="deduction">Deduction (कटौती)</option>
          </select>
        </FormField>

        {/* ✅ NEW: Deduction days selector */}
        {type === 'deduction' && (
          <FormField label="कटौती — कितने दिन? (0 = manual amount डालें)">
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              {[1,2,3,5,7,10,15,30].map(d => (
                <button key={d} type="button"
                  style={{ padding:'5px 10px', borderRadius:6, border:`1px solid ${amount === String(Math.round((entity.monthlyAmount||0)/26*d))?'#ef4444':'#334155'}`, background: amount === String(Math.round((entity.monthlyAmount||0)/26*d))?'#7f1d1d22':'transparent', color:'#fca5a5', fontSize:11, cursor:'pointer', fontWeight:700 }}
                  onClick={() => setAmount(String(Math.round((entity.monthlyAmount||0)/26*d)))}>
                  {d}d = ₹{Math.round((entity.monthlyAmount||0)/26*d).toLocaleString('en-IN')}
                </button>
              ))}
            </div>
            <p style={{ fontSize:10, color:'#64748b', margin:'4px 0 0' }}>Monthly ₹{(entity.monthlyAmount||0).toLocaleString('en-IN')} ÷ 26 working days = ₹{Math.round((entity.monthlyAmount||0)/26)}/day</p>
          </FormField>
        )}

        {/* ✅ NEW: Payment method */}
        <FormField label="भुगतान विधि">
          <select value={payMethod} onChange={e => setPayMethod(e.target.value)} style={inputStyle}>
            <option value="cash">💵 Cash</option>
            <option value="upi">📱 UPI</option>
            <option value="bank-transfer">🏦 Bank Transfer / NEFT</option>
            <option value="cheque">📝 Cheque</option>
          </select>
        </FormField>

        {/* ✅ NEW: Transaction ID (for UPI/bank) */}
        {(payMethod === 'upi' || payMethod === 'bank-transfer') && (
          <FormField label="Transaction ID / UTR">
            <input type="text" value={txnId} onChange={e => setTxnId(e.target.value)}
              placeholder="UPI ref / UTR number" style={inputStyle}/>
          </FormField>
        )}

        <FormField label="Notes (optional)">
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="UPI reference, remark..." style={inputStyle}/>
        </FormField>

        <div style={{ display:'flex', gap:8, marginTop:16 }}>
          <button onClick={onClose} disabled={submitting}
            style={{ flex:1, background:'#334155', color:'#fff', padding:10, borderRadius:10, border:'none', cursor:'pointer', fontSize:13, fontWeight:700 }}>
            Cancel
          </button>
          <button onClick={save} disabled={submitting}
            style={{ flex:1, background:'linear-gradient(135deg, #22c55e, #10b981)', color:'#fff', padding:10, borderRadius:10, border:'none', cursor: submitting?'wait':'pointer', fontSize:13, fontWeight:700 }}>
            {submitting ? '⏳ Saving...' : '✅ Save Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}


function AddEntityModal({ onClose, onSuccess, existing }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('staff');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [replaces, setReplaces] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('⚠️ Photo 2MB से छोटी होनी चाहिए'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 300;
        let { width, height } = img;
        if (width > height) { if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; } }
        else { if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; } }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        setPhoto(canvas.toDataURL('image/jpeg', 0.75));
        setUploading(false);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!name || !startDate) { alert('Name और start date जरूरी है'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(api('/api/salary-entities'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, type, monthlyAmount: parseFloat(monthlyAmount) || 0,
          startDate, replaces: replaces || null, photo, notes,
        }),
      });
      if (res.ok) {
        alert(`✅ ${name} added successfully`);
        onSuccess();
      } else {
        const data = await res.json();
        alert(`❌ ${data.error}`);
      }
    } catch (err) { alert(err.message); }
    setSubmitting(false);
  };

  const replaceableOptions = existing.filter(e => e.type === type && e.active);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }} onClick={onClose}>
      <div style={{ background:'#1e293b', borderRadius:16, padding:24, maxWidth:480, width:'100%', border:'1px solid #334155', maxHeight:'90vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color:'#f8fafc', fontSize:18, fontWeight:800, margin:0 }}>➕ Add New Entity</h3>
        <p style={{ color:'#94a3b8', fontSize:12, margin:'4px 0 16px' }}>Staff member या rental house add करें</p>

        <FormField label="📸 Photo (optional)">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{
              width:72, height:72, borderRadius:'50%',
              background: photo ? `url(${photo}) center/cover` : `linear-gradient(135deg, ${type==='staff'?'#3b82f6':'#a855f7'}, ${type==='staff'?'#1e40af':'#7e22ce'})`,
              display:'flex', alignItems:'center', justifyContent:'center', border:'3px solid #334155', flexShrink:0,
            }}>
              {!photo && <span style={{ fontSize:28 }}>{type === 'staff' ? '👤' : '🏠'}</span>}
            </div>
            <label style={{ display:'inline-block', background:'#3b82f6', color:'#fff', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>
              {uploading ? '⏳ Uploading...' : photo ? '🔄 Change' : '📤 Upload from Gallery'}
              <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} style={{ display:'none' }}/>
            </label>
          </div>
        </FormField>

        <FormField label="Type">
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setType('staff')} style={{ ...inputStyle, flex:1, background: type==='staff' ? '#3b82f6' : '#0f172a', border: type==='staff' ? '1px solid #93c5fd' : '1px solid #334155', cursor:'pointer' }}>👤 Staff</button>
            <button onClick={() => setType('rent')} style={{ ...inputStyle, flex:1, background: type==='rent' ? '#a855f7' : '#0f172a', border: type==='rent' ? '1px solid #c4b5fd' : '1px solid #334155', cursor:'pointer' }}>🏠 Rent/House</button>
          </div>
        </FormField>

        <FormField label="Name">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full name or label" style={inputStyle}/>
        </FormField>

        <FormField label="Monthly Amount (₹)">
          <input type="number" value={monthlyAmount} onChange={e => setMonthlyAmount(e.target.value)} placeholder="12000" style={inputStyle}/>
        </FormField>

        <FormField label="Start Date (महीना इसी से count होगा)">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle}/>
        </FormField>

        {replaceableOptions.length > 0 && (
          <FormField label="Replaces (optional)">
            <select value={replaces} onChange={e => setReplaces(e.target.value)} style={inputStyle}>
              <option value="">— Not replacing anyone —</option>
              {replaceableOptions.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
            </select>
            {replaces && <p style={{ color:'#fbbf24', fontSize:10, marginTop:4 }}>⚠️ {replaces} को {startDate} से ended mark किया जाएगा</p>}
          </FormField>
        )}

        <FormField label="Notes">
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle}/>
        </FormField>

        <div style={{ display:'flex', gap:8, marginTop:16 }}>
          <button onClick={onClose} disabled={submitting} style={{ flex:1, background:'#334155', color:'#fff', padding:10, borderRadius:10, border:'none', cursor:'pointer', fontSize:13, fontWeight:700 }}>Cancel</button>
          <button onClick={save} disabled={submitting || uploading} style={{ flex:1, background:'linear-gradient(135deg, #3b82f6, #6366f1)', color:'#fff', padding:10, borderRadius:10, border:'none', cursor: (submitting||uploading)?'wait':'pointer', fontSize:13, fontWeight:700 }}>
            {submitting ? 'Saving...' : '✅ Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ display:'block', color:'#94a3b8', fontSize:11, fontWeight:700, marginBottom:5 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width:'100%', padding:'9px 12px', background:'#0f172a', border:'1px solid #334155',
  borderRadius:8, color:'#f8fafc', fontSize:13,
};

// ════════════════════════════════════════════════════════════════════════════
// EDIT ENTITY MODAL — with photo upload from mobile gallery
// ════════════════════════════════════════════════════════════════════════════
function EditEntityModal({ entity, onClose, onSuccess }) {
  const [name, setName] = useState(entity.name);
  const [type, setType] = useState(entity.type);
  const [monthlyAmount, setMonthlyAmount] = useState(entity.monthlyAmount || 0);
  const [startDate, setStartDate] = useState(entity.startDate || '');
  const [endDate, setEndDate] = useState(entity.endDate || '');
  const [notes, setNotes] = useState(entity.notes || '');
  const [photo, setPhoto] = useState(entity.photo || '');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ── Photo upload from mobile gallery ──────────────────────────────
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check size (max 2MB to keep MongoDB docs small)
    if (file.size > 2 * 1024 * 1024) {
      alert('⚠️ Photo 2MB से छोटी होनी चाहिए। कृपया resize करें।');
      return;
    }

    setUploading(true);
    try {
      // Convert to base64 + resize using canvas
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          // Resize to max 300px (for profile pic)
          const canvas = document.createElement('canvas');
          const maxSize = 300;
          let { width, height } = img;
          if (width > height) {
            if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
          } else {
            if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const resized = canvas.toDataURL('image/jpeg', 0.75);   // 75% quality JPEG
          setPhoto(resized);
          setUploading(false);
        };
        img.onerror = () => { alert('Image load error'); setUploading(false); };
        img.src = ev.target.result;
      };
      reader.onerror = () => { alert('File read error'); setUploading(false); };
      reader.readAsDataURL(file);
    } catch (err) {
      alert(`Upload error: ${err.message}`);
      setUploading(false);
    }
  };

  const save = async () => {
    if (!name || !startDate) { alert('Name और start date जरूरी है'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(api(`/api/salary-entities/${entity._id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, type,
          monthlyAmount: parseFloat(monthlyAmount) || 0,
          startDate,
          endDate: endDate || null,
          active: !endDate,
          photo, notes,
        }),
      });
      if (res.ok) {
        alert(`✅ ${name} updated`);
        onSuccess();
      } else {
        const data = await res.json();
        alert(`❌ ${data.error || 'Update failed'}`);
      }
    } catch (err) { alert(err.message); }
    setSubmitting(false);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }} onClick={onClose}>
      <div style={{ background:'#1e293b', borderRadius:16, padding:24, maxWidth:480, width:'100%', border:'1px solid #334155', maxHeight:'90vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color:'#f8fafc', fontSize:18, fontWeight:800, margin:0 }}>✏️ Edit Entity</h3>
        <p style={{ color:'#94a3b8', fontSize:12, margin:'4px 0 16px' }}>Editing: <b style={{ color:'#f8fafc' }}>{entity.name}</b></p>

        {/* PHOTO UPLOAD */}
        <FormField label="📸 Photo (mobile gallery से select करें)">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{
              width:80, height:80, borderRadius:'50%',
              background: photo ? `url(${photo}) center/cover` : `linear-gradient(135deg, ${type==='staff'?'#3b82f6':'#a855f7'}, ${type==='staff'?'#1e40af':'#7e22ce'})`,
              display:'flex', alignItems:'center', justifyContent:'center', border:'3px solid #334155', flexShrink:0,
            }}>
              {!photo && <span style={{ fontSize:32 }}>{type === 'staff' ? '👤' : '🏠'}</span>}
            </div>
            <div style={{ flex:1 }}>
              <label style={{ display:'inline-block', background:'#3b82f6', color:'#fff', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>
                {uploading ? '⏳ Uploading...' : photo ? '🔄 Change Photo' : '📤 Upload from Gallery'}
                <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} style={{ display:'none' }}/>
              </label>
              {photo && (
                <button onClick={() => setPhoto('')} style={{ display:'block', marginTop:6, background:'transparent', border:'none', color:'#f87171', fontSize:11, cursor:'pointer' }}>
                  🗑️ Remove photo
                </button>
              )}
              <p style={{ color:'#64748b', fontSize:10, marginTop:4 }}>Max 2MB · Auto-resized to 300px</p>
            </div>
          </div>
        </FormField>

        <FormField label="Type">
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setType('staff')}
              style={{ ...inputStyle, flex:1, background: type==='staff' ? '#3b82f6' : '#0f172a', border: type==='staff' ? '1px solid #93c5fd' : '1px solid #334155', cursor:'pointer' }}>👤 Staff</button>
            <button onClick={() => setType('rent')}
              style={{ ...inputStyle, flex:1, background: type==='rent' ? '#a855f7' : '#0f172a', border: type==='rent' ? '1px solid #c4b5fd' : '1px solid #334155', cursor:'pointer' }}>🏠 Rent/House</button>
          </div>
        </FormField>

        <FormField label="Name">
          <input type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle}/>
        </FormField>

        <FormField label="Monthly Amount (₹)">
          <input type="number" value={monthlyAmount} onChange={e => setMonthlyAmount(e.target.value)} style={inputStyle}/>
        </FormField>

        <FormField label="Start Date">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle}/>
        </FormField>

        <FormField label="End Date (blank = अभी active)">
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle}/>
          {endDate && <p style={{ color:'#fbbf24', fontSize:10, marginTop:4 }}>⚠️ End date set करने पर "ENDED" mark होगा</p>}
        </FormField>

        <FormField label="Notes">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize:'vertical' }}/>
        </FormField>

        <div style={{ display:'flex', gap:8, marginTop:16 }}>
          <button onClick={onClose} disabled={submitting}
            style={{ flex:1, background:'#334155', color:'#fff', padding:10, borderRadius:10, border:'none', cursor:'pointer', fontSize:13, fontWeight:700 }}>
            Cancel
          </button>
          <button onClick={save} disabled={submitting || uploading}
            style={{ flex:1, background:'linear-gradient(135deg, #3b82f6, #6366f1)', color:'#fff', padding:10, borderRadius:10, border:'none', cursor: (submitting||uploading)?'wait':'pointer', fontSize:13, fontWeight:700 }}>
            {submitting ? '⏳ Saving...' : '✅ Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// EDIT PAYMENT MODAL
// ════════════════════════════════════════════════════════════════════════════
function EditPaymentModal({ payment, onClose, onSuccess }) {
  const [amount, setAmount] = useState(payment.amount || 0);
  const [date, setDate] = useState(payment.paymentDate || '');
  const [type, setType] = useState(payment.type || 'salary');
  const [notes, setNotes] = useState(payment.notes || '');
  const [submitting, setSubmitting] = useState(false);

  const save = async () => {
    if (!amount || parseFloat(amount) <= 0) { alert('Valid amount डालें'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(api(`/api/salaries/${payment._id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          paymentDate: date,
          forMonth: parseInt(date.split('-')[1]),
          forYear: parseInt(date.split('-')[0]),
          type, notes,
        }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        alert(`❌ ${data.error || 'Update failed'}`);
      }
    } catch (err) { alert(err.message); }
    setSubmitting(false);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }} onClick={onClose}>
      <div style={{ background:'#1e293b', borderRadius:16, padding:24, maxWidth:420, width:'100%', border:'1px solid #334155' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color:'#f8fafc', fontSize:18, fontWeight:800, margin:0 }}>✏️ Edit Payment</h3>
        <p style={{ color:'#94a3b8', fontSize:12, margin:'4px 0 16px' }}>For <b style={{ color:'#f8fafc' }}>{payment.staffName}</b></p>

        <FormField label="Amount (₹)">
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle}/>
        </FormField>

        <FormField label="Payment Date">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle}/>
        </FormField>

        <FormField label="Type">
          <select value={type} onChange={e => setType(e.target.value)} style={inputStyle}>
            <option value="salary">Salary / Rent</option>
            <option value="advance">Advance</option>
            <option value="bonus">Bonus</option>
            <option value="incentive">Incentive</option>
            <option value="deduction">Deduction</option>
          </select>
        </FormField>

        <FormField label="Notes">
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle}/>
        </FormField>

        <div style={{ display:'flex', gap:8, marginTop:16 }}>
          <button onClick={onClose} disabled={submitting}
            style={{ flex:1, background:'#334155', color:'#fff', padding:10, borderRadius:10, border:'none', cursor:'pointer', fontSize:13, fontWeight:700 }}>
            Cancel
          </button>
          <button onClick={save} disabled={submitting}
            style={{ flex:1, background:'linear-gradient(135deg, #3b82f6, #6366f1)', color:'#fff', padding:10, borderRadius:10, border:'none', cursor: submitting?'wait':'pointer', fontSize:13, fontWeight:700 }}>
            {submitting ? '⏳ Saving...' : '✅ Save'}
          </button>
        </div>
      </div>
    </div>
  );
}