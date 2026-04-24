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
  const [seedingInProgress, setSeedingInProgress] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [entRes, payRes] = await Promise.all([
        fetch(api('/api/salary-entities')),
        fetch(api('/api/salaries')),
      ]);
      const ents = entRes.ok ? await entRes.json() : [];
      const pays = payRes.ok ? await payRes.json() : [];
      setEntities(ents);
      setPayments(pays);
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

  // ── Calculations ──────────────────────────────────────────────────────
  const calcs = useMemo(() => {
    // Per-entity stats
    const perEntity = entities.map(e => {
      const pays = payments.filter(p => !p.cancelled && p.staffName === e.name);
      const totalPaid = pays.reduce((s, p) => s + (p.amount || 0), 0);
      const monthsActive = calcMonthsActive(e.startDate, e.endDate);
      const expectedTotal = (e.monthlyAmount || 0) * monthsActive;
      const balance = expectedTotal - totalPaid;
      return { ...e, payments: pays, totalPaid, monthsActive, expectedTotal, balance };
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
  }, [entities, payments, filterType]);

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
            <button onClick={loadAll}
              style={{ background:'#1e293b', color:'#f8fafc', padding:'10px 14px', borderRadius:10, border:'1px solid #334155', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
              <RefreshCw size={14}/>
            </button>
          </div>
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
            {activeEntity && <EntityDetails entity={activeEntity} onAddPayment={() => setShowAddPayment(true)} onRefresh={loadAll}/>}
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
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:10 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
            <span style={{ fontSize:18 }}>{e.type === 'staff' ? '👤' : '🏠'}</span>
            <h3 style={{ color:'#f8fafc', fontSize:16, fontWeight:800, margin:0 }}>{e.name}</h3>
            {!e.active && <span style={{ background:'#64748b22', color:'#94a3b8', fontSize:9, padding:'2px 6px', borderRadius:4 }}>ENDED</span>}
          </div>
          <p style={{ color:'#64748b', fontSize:10 }}>
            {e.type === 'staff' ? 'Staff' : 'Rental'} · {fmtINR(e.monthlyAmount)}/month
          </p>
        </div>
        {isOverdue && (
          <div style={{ background:'#ef444422', border:'1px solid #ef444466', borderRadius:8, padding:'2px 8px' }}>
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
function EntityDetails({ entity: e, onAddPayment, onRefresh }) {
  const [showHistory, setShowHistory] = useState(true);

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
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg, #1e293b, #0f172a)', border:'1px solid #334155', borderRadius:16, padding:20 }}>
        <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'space-between', alignItems:'start', gap:14 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <span style={{ fontSize:28 }}>{e.type === 'staff' ? '👤' : '🏠'}</span>
              <h2 style={{ color:'#f8fafc', fontSize:24, fontWeight:900, margin:0 }}>{e.name}</h2>
              {e.active ? (
                <span style={{ background:'#22c55e22', color:'#86efac', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6 }}>ACTIVE</span>
              ) : (
                <span style={{ background:'#64748b33', color:'#94a3b8', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6 }}>ENDED</span>
              )}
            </div>
            <p style={{ color:'#94a3b8', fontSize:12 }}>
              {e.type === 'staff' ? 'Employee' : 'Rental House'} · Monthly: <b style={{ color:'#f8fafc' }}>{fmtINR(e.monthlyAmount)}</b>
              {' · '}Hired: <b style={{ color:'#f8fafc' }}>{fmtDate(e.startDate)}</b>
              {e.endDate && <> · Ended: <b style={{ color:'#fca5a5' }}>{fmtDate(e.endDate)}</b></>}
            </p>
            {e.notes && <p style={{ color:'#64748b', fontSize:11, marginTop:4 }}>📝 {e.notes}</p>}
            {(e.replaces || e.replacedBy) && (
              <div style={{ marginTop:8, display:'flex', gap:8, flexWrap:'wrap' }}>
                {e.replaces && <span style={{ background:'#22c55e22', color:'#86efac', fontSize:10, padding:'4px 10px', borderRadius:8 }}>← Replaces <b>{e.replaces}</b></span>}
                {e.replacedBy && <span style={{ background:'#ef444422', color:'#fca5a5', fontSize:10, padding:'4px 10px', borderRadius:8 }}>Replaced by <b>{e.replacedBy}</b> →</span>}
              </div>
            )}
          </div>
          {e.active && (
            <button onClick={onAddPayment}
              style={{ background:'linear-gradient(135deg, #22c55e, #10b981)', color:'#fff', padding:'10px 18px', borderRadius:10, fontWeight:700, fontSize:13, border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 14px rgba(34,197,94,0.4)' }}>
              <Plus size={14}/> Add Payment
            </button>
          )}
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

      {/* Payment History */}
      <Panel title={`💰 Payment History (${e.payments.length})`} subtitle="All transactions"
        action={
          <button onClick={() => setShowHistory(!showHistory)}
            style={{ background:'#3b82f622', border:'1px solid #3b82f655', color:'#93c5fd', padding:'6px 12px', borderRadius:8, fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
            {showHistory ? 'Hide' : 'Show'} <ChevronDown size={11} style={{ transform: showHistory ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}/>
          </button>
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
                    <th style={{ padding:8, textAlign:'left' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {[...e.payments].sort((a,b) => new Date(b.paymentDate) - new Date(a.paymentDate)).map((p,i) => (
                    <tr key={i} style={{ borderBottom:'1px solid #1e293b' }}>
                      <td style={{ padding:'8px', color:'#e2e8f0' }}>{fmtDate(p.paymentDate)}</td>
                      <td style={{ padding:'8px', color:'#86efac', fontWeight:700, textAlign:'right' }}>{fmtINR(p.amount)}</td>
                      <td style={{ padding:'8px' }}>
                        <span style={{ background: p.type==='advance'?'#f9731622':p.type==='bonus'?'#3b82f622':'#22c55e22', color: p.type==='advance'?'#fdba74':p.type==='bonus'?'#93c5fd':'#86efac', fontSize:9, padding:'2px 8px', borderRadius:6, fontWeight:700 }}>
                          {(p.type || 'salary').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding:'8px', color:'#64748b' }}>{p.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </Panel>
    </div>
  );
}

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
          notes,
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
            <option value="deduction">Deduction</option>
          </select>
        </FormField>

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

// ── Add Entity Modal ────────────────────────────────────────────────────────
function AddEntityModal({ onClose, onSuccess, existing }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('staff');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [replaces, setReplaces] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const save = async () => {
    if (!name || !startDate) { alert('Name और start date जरूरी है'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(api('/api/salary-entities'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, type, monthlyAmount: parseFloat(monthlyAmount) || 0,
          startDate, replaces: replaces || null, notes,
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

  // filter existing by type for "replaces"
  const replaceableOptions = existing.filter(e => e.type === type && e.active);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }} onClick={onClose}>
      <div style={{ background:'#1e293b', borderRadius:16, padding:24, maxWidth:480, width:'100%', border:'1px solid #334155', maxHeight:'90vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color:'#f8fafc', fontSize:18, fontWeight:800, margin:0 }}>➕ Add New Entity</h3>
        <p style={{ color:'#94a3b8', fontSize:12, margin:'4px 0 16px' }}>Staff member या rental house add करें</p>

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
          <button onClick={save} disabled={submitting} style={{ flex:1, background:'linear-gradient(135deg, #3b82f6, #6366f1)', color:'#fff', padding:10, borderRadius:10, border:'none', cursor: submitting?'wait':'pointer', fontSize:13, fontWeight:700 }}>
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