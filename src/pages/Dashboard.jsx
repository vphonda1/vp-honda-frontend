// ════════════════════════════════════════════════════════════════════════════
// Dashboard.jsx — VP Honda Smart Mission Control
// ════════════════════════════════════════════════════════════════════════════
// Features:
// • Live KPI tiles with trend indicators (vs last month)
// • Smart alert strip (urgent items from across the app)
// • Revenue pulse chart (last 6 months) with predictions
// • Today's activity timeline
// • Parts low stock quick alerts
// • Service reminders summary
// • Pending payments summary
// • Staff activity (if admin)
// • Quick action grid
// • Recent invoices with click-to-view
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area, LineChart, Line,
} from 'recharts';
import {
  RefreshCw, Clock, TrendingUp, TrendingDown, AlertTriangle,
  Users, Bike, FileText, Package, DollarSign, Bell, ArrowUpRight,
  Zap, Activity, Calendar, CheckCircle, XCircle, AlertCircle,
  Wrench, ShieldAlert, CreditCard, Eye, ChevronRight,
} from 'lucide-react';
import { api } from '../utils/apiConfig';

// ── Helpers ─────────────────────────────────────────────────────────────────
const getLS = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const fmtINR = (n) => '₹' + Math.round(n||0).toLocaleString('en-IN');
const fmtShort = (n) => {
  n = Math.round(n||0);
  if (n >= 10000000) return '₹' + (n/10000000).toFixed(2) + 'Cr';
  if (n >= 100000)   return '₹' + (n/100000).toFixed(2) + 'L';
  if (n >= 1000)     return '₹' + (n/1000).toFixed(1) + 'K';
  return '₹' + n;
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) : '—';
const daysBetween = (d1, d2) => Math.floor((new Date(d2) - new Date(d1)) / 86400000);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── KPI Tile Component ──────────────────────────────────────────────────────
function KPITile({ icon: Icon, label, value, trend, trendLabel, color, onClick, alert }) {
  const trendUp = trend > 0;
  return (
    <div onClick={onClick}
      style={{
        background: `linear-gradient(135deg, ${color}22, ${color}0a)`,
        border: `1px solid ${color}40`,
        borderRadius: '18px',
        padding: '18px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.25s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      className="hover:scale-[1.02] hover:shadow-xl">
      <div style={{ display:'flex', alignItems:'start', justifyContent:'space-between', marginBottom:'10px' }}>
        <div style={{
          background: color, width: '44px', height: '44px', borderRadius: '12px',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow: `0 4px 14px ${color}55`,
        }}>
          <Icon size={22} color="#fff" />
        </div>
        {alert && (
          <div style={{ background:'#ef444422', border:'1px solid #ef444466', borderRadius:'10px', padding:'2px 8px' }}>
            <span style={{ color:'#fca5a5', fontSize:'10px', fontWeight:700 }}>⚠ {alert}</span>
          </div>
        )}
      </div>
      <p style={{ color:'#94a3b8', fontSize:'11px', fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase' }}>{label}</p>
      <p style={{ color:'#f8fafc', fontSize:'32px', fontWeight:900, lineHeight:1.1, margin:'4px 0' }}>{value}</p>
      {trend !== undefined && trend !== null && (
        <div style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11px' }}>
          {trendUp ? <TrendingUp size={12} color="#22c55e"/> : <TrendingDown size={12} color="#ef4444"/>}
          <span style={{ color: trendUp?'#86efac':'#fca5a5', fontWeight:700 }}>
            {trendUp ? '+' : ''}{trend}%
          </span>
          <span style={{ color:'#64748b' }}>{trendLabel}</span>
        </div>
      )}
    </div>
  );
}

// ── Alert Item Component ────────────────────────────────────────────────────
function AlertItem({ icon: Icon, label, count, color, onClick }) {
  if (count === 0) return null;
  return (
    <div onClick={onClick} className="hover:scale-[1.03] transition cursor-pointer"
      style={{
        background:`${color}15`, border:`1px solid ${color}40`, borderRadius:'12px',
        padding:'10px 14px', display:'flex', alignItems:'center', gap:'10px', minWidth:'140px',
      }}>
      <Icon size={18} color={color} />
      <div>
        <p style={{ color, fontSize:'16px', fontWeight:900, lineHeight:1 }}>{count}</p>
        <p style={{ color:'#94a3b8', fontSize:'10px', fontWeight:600 }}>{label}</p>
      </div>
      <ChevronRight size={14} color="#64748b" style={{ marginLeft:'auto' }} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    loadAll();
    const t = setInterval(loadAll, 30000);
    window.addEventListener('storage', loadAll);
    return () => { clearInterval(t); window.removeEventListener('storage', loadAll); };
  }, []);

  const loadAll = async () => {
    const fetchJson = async (url, fb = []) => {
      try { const r = await fetch(api(url)); if (r.ok) return await r.json(); } catch {}
      return fb;
    };

    const [customers, parts, invoices, oldbikes, staff, salaries, partHistory, serviceData] = await Promise.all([
      fetchJson('/api/customers'),
      fetchJson('/api/parts'),
      fetchJson('/api/invoices'),
      fetchJson('/api/oldbikes'),
      fetchJson('/api/staff'),
      fetchJson('/api/salaries'),
      fetchJson('/api/parts/history/all'),
      fetchJson('/api/service-data'),
    ]);

    const lsInvoices = [...getLS('invoices',[]), ...getLS('generatedInvoices',[])];
    const lsServiceData = getLS('customerServiceData', {});
    const allInvoices = invoices.length > 0 ? invoices : lsInvoices;

    // ── Revenue calculations ─────────────────────────────────────────────
    const totalRevenue = allInvoices.reduce((s, i) =>
      s + (i.totals?.totalAmount || i.total || i.grandTotal || 0), 0);

    // Monthly revenue for last 6 months
    const now = new Date();
    const monthlyRev = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      monthlyRev[key] = { name: MONTHS[d.getMonth()], revenue: 0, invoices: 0, vehicles: 0, service: 0 };
    }
    allInvoices.forEach(i => {
      const d = i.invoiceDate ? new Date(i.invoiceDate) : null;
      if (!d || isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (monthlyRev[key]) {
        const amt = i.totals?.totalAmount || i.total || i.grandTotal || 0;
        monthlyRev[key].revenue += amt;
        monthlyRev[key].invoices += 1;
        const isVehicle = i.invoiceType === 'vehicle' || amt >= 50000;
        if (isVehicle) monthlyRev[key].vehicles += 1;
        else monthlyRev[key].service += 1;
      }
    });
    const revenueChart = Object.values(monthlyRev);

    // Current vs previous month
    const curKey = Object.keys(monthlyRev)[5];
    const prevKey = Object.keys(monthlyRev)[4];
    const curRev = monthlyRev[curKey]?.revenue || 0;
    const prevRev = monthlyRev[prevKey]?.revenue || 0;
    const revTrend = prevRev > 0 ? Math.round(((curRev - prevRev) / prevRev) * 100) : 0;

    // ── Today's activity ─────────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0];
    const todayInvoices = allInvoices.filter(i => i.invoiceDate?.startsWith(today));
    const todayRevenue = todayInvoices.reduce((s, i) => s + (i.totals?.totalAmount || i.total || 0), 0);

    // ── Smart Alerts ──────────────────────────────────────────────────────
    const todayDate = new Date(); todayDate.setHours(0,0,0,0);
    const outOfStock = parts.filter(p => Number(p.stock || p.quantity || 0) <= 0).length;
    const lowStock = parts.filter(p => {
      const s = Number(p.stock || p.quantity || 0);
      const m = Number(p.minStock || 0);
      return m > 0 && s > 0 && s <= m;
    }).length;

    let overdueServices = 0, overduePayments = 0, pendingInsurance = 0;
    let totalPending = 0;
    const sdMap = { ...lsServiceData };
    serviceData.forEach(rec => { sdMap[rec.regNo || rec._id] = rec; });

    Object.values(sdMap).forEach(d => {
      // Service overdue
      if (d.purchaseDate && !d.firstServiceDate) {
        const due = new Date(d.purchaseDate); due.setDate(due.getDate() + 30);
        if (due < todayDate) overdueServices++;
      }
      // Payment pending
      const amt = parseFloat(d.pendingAmount || 0);
      if (amt > 0 && !d.paymentReceivedDate) {
        totalPending += amt;
        if (d.paymentDueDate && new Date(d.paymentDueDate) < todayDate) overduePayments++;
      }
      // Insurance/RTO
      if (d.insuranceDate && !d.rtoDoneDate) {
        const due = new Date(d.insuranceDate); due.setDate(due.getDate() + 7);
        if (due <= todayDate) pendingInsurance++;
      }
    });

    // ── Vehicle model distribution ────────────────────────────────────────
    const vehicleMap = {};
    customers.forEach(c => {
      const m = (c.vehicleModel || c.linkedVehicle?.name || '').split(' ').slice(0, 2).join(' ');
      if (m) vehicleMap[m] = (vehicleMap[m] || 0) + 1;
    });
    const vehicleChart = Object.entries(vehicleMap)
      .sort((a,b) => b[1] - a[1]).slice(0, 6)
      .map(([name, value]) => ({ name, value }));

    // ── Top parts by consumption ──────────────────────────────────────────
    const partUsage = {};
    partHistory.forEach(c => {
      if (c.reverted) return;
      const key = c.partName || c.partNumber;
      if (!partUsage[key]) partUsage[key] = { name: key, used: 0, value: 0 };
      partUsage[key].used += c.quantity || 1;
      partUsage[key].value += c.totalValue || 0;
    });
    const topParts = Object.values(partUsage).sort((a,b) => b.used - a.used).slice(0, 5);

    // ── Recent invoices ──────────────────────────────────────────────────
    const recent = [...allInvoices]
      .sort((a,b) => new Date(b.createdAt || b.invoiceDate || 0) - new Date(a.createdAt || a.invoiceDate || 0))
      .slice(0, 6);

    // ── Salary pending (current month) ────────────────────────────────────
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();
    let totalSalaryDue = 0, totalSalaryPaid = 0;
    staff.forEach(s => {
      totalSalaryDue += Number(s.monthlySalary || 0);
      const paid = salaries
        .filter(p => String(p.staffId) === String(s.id) && p.forMonth === curMonth && p.forYear === curYear && p.type === 'salary')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      totalSalaryPaid += paid;
    });

    setData({
      totals: {
        customers: customers.length,
        vehicles: customers.length,
        invoices: allInvoices.length,
        parts: parts.length,
        staff: staff.length,
        quotations: 0,
        oldBikes: oldbikes.length,
        serviceEntries: Object.keys(sdMap).length,
      },
      revenue: {
        total: totalRevenue,
        today: todayRevenue,
        todayCount: todayInvoices.length,
        trend: revTrend,
        chart: revenueChart,
      },
      alerts: {
        outOfStock,
        lowStock,
        overdueServices,
        overduePayments,
        pendingInsurance,
        totalPending,
      },
      charts: {
        vehicles: vehicleChart,
        topParts,
      },
      recent,
      salary: {
        due: totalSalaryDue,
        paid: totalSalaryPaid,
        pending: Math.max(0, totalSalaryDue - totalSalaryPaid),
      },
    });
    setLastRefresh(new Date());
    setLoading(false);
  };

  if (loading || !data) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
      <div className="text-center">
        <Activity className="animate-spin mx-auto mb-3 text-cyan-400" size={48} />
        <p className="text-slate-400">Mission Control loading...</p>
      </div>
    </div>
  );

  const alertTotal = data.alerts.outOfStock + data.alerts.lowStock + data.alerts.overdueServices +
                     data.alerts.overduePayments + data.alerts.pendingInsurance;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)', color: '#f8fafc', padding: '20px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* ─── HEADER ─── */}
        <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'space-between', alignItems:'center', gap:'16px', marginBottom:'20px' }}>
          <div>
            <h1 style={{ fontSize:'28px', fontWeight:900, background:'linear-gradient(90deg, #60a5fa, #a78bfa, #f472b6)', WebkitBackgroundClip:'text', color:'transparent', margin:0 }}>
              Welcome back, {user?.name || 'Admin'} 👋
            </h1>
            <p style={{ color:'#94a3b8', fontSize:'13px', marginTop:'4px', display:'flex', alignItems:'center', gap:'6px' }}>
              <Activity size={12} className="text-green-400 animate-pulse"/>
              Live • Last sync: {lastRefresh.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
              {user?.role === 'admin' && <span style={{ background:'#7c3aed', padding:'2px 10px', borderRadius:'10px', fontSize:'10px', fontWeight:700, color:'#fff' }}>ADMIN</span>}
            </p>
          </div>
          <button onClick={loadAll}
            style={{ background:'linear-gradient(135deg, #3b82f6, #6366f1)', color:'#fff', padding:'10px 18px', borderRadius:'12px', fontWeight:700, fontSize:'13px', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', boxShadow:'0 4px 14px rgba(59,130,246,0.4)' }}>
            <RefreshCw size={15}/> Refresh
          </button>
        </div>

        {/* ─── SMART ALERT STRIP ─── */}
        {alertTotal > 0 && (
          <div style={{ background:'linear-gradient(90deg, #7f1d1d22, #78350f22)', border:'1px solid #ef444440', borderRadius:'16px', padding:'14px', marginBottom:'20px', display:'flex', alignItems:'center', gap:'14px', flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>
              <div style={{ background:'#ef4444', borderRadius:'10px', padding:'8px', animation:'pulse 2s infinite' }}>
                <AlertTriangle size={18} color="#fff"/>
              </div>
              <div>
                <p style={{ color:'#fecaca', fontSize:'12px', fontWeight:700, margin:0 }}>{alertTotal} ACTIVE ALERTS</p>
                <p style={{ color:'#94a3b8', fontSize:'10px', margin:0 }}>Click to view</p>
              </div>
            </div>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', flex:1 }}>
              <AlertItem icon={Package}      label="Out of Stock"    count={data.alerts.outOfStock}      color="#ef4444" onClick={() => navigate('/parts')} />
              <AlertItem icon={AlertCircle}  label="Low Stock"       count={data.alerts.lowStock}        color="#f97316" onClick={() => navigate('/parts')} />
              <AlertItem icon={Wrench}       label="Overdue Service" count={data.alerts.overdueServices} color="#eab308" onClick={() => navigate('/reminders')} />
              <AlertItem icon={CreditCard}   label="Overdue Payment" count={data.alerts.overduePayments} color="#dc2626" onClick={() => navigate('/reminders')} />
              <AlertItem icon={ShieldAlert}  label="RTO Pending"     count={data.alerts.pendingInsurance} color="#a855f7" onClick={() => navigate('/reminders')} />
            </div>
          </div>
        )}

        {/* ─── KPI GRID ─── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'14px', marginBottom:'20px' }}>
          <KPITile icon={DollarSign} label="Total Revenue" value={fmtShort(data.revenue.total)}
            trend={data.revenue.trend} trendLabel="vs last month" color="#22c55e"
            onClick={() => navigate('/reports')} />
          <KPITile icon={Zap} label="Today's Sales" value={fmtShort(data.revenue.today)}
            trendLabel={`${data.revenue.todayCount} invoices`} color="#eab308"
            onClick={() => navigate('/invoice-management')} />
          <KPITile icon={Users} label="Customers" value={data.totals.customers}
            color="#3b82f6" onClick={() => navigate('/customers')} />
          <KPITile icon={FileText} label="Total Invoices" value={data.totals.invoices}
            color="#f97316" onClick={() => navigate('/invoice-management')} />
          <KPITile icon={Package} label="Parts Inventory" value={data.totals.parts}
            color="#a855f7" alert={data.alerts.outOfStock > 0 ? `${data.alerts.outOfStock} out` : null}
            onClick={() => navigate('/parts')} />
          <KPITile icon={Bell} label="Pending Amount" value={fmtShort(data.alerts.totalPending)}
            color="#ef4444" alert={data.alerts.overduePayments > 0 ? `${data.alerts.overduePayments} overdue` : null}
            onClick={() => navigate('/reminders')} />
        </div>

        {/* ─── REVENUE CHART + VEHICLES ─── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:'14px', marginBottom:'20px' }}>
          <div className="md:grid-cols-[2fr_1fr]" style={{ display:'grid', gridTemplateColumns:'1fr', gap:'14px' }}>

            {/* Revenue Pulse Chart */}
            <div style={{ background:'linear-gradient(135deg, #1e293b, #0f172a)', border:'1px solid #334155', borderRadius:'18px', padding:'18px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:'10px' }}>
                <div>
                  <p style={{ color:'#94a3b8', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px' }}>REVENUE PULSE</p>
                  <h3 style={{ color:'#f8fafc', fontSize:'20px', fontWeight:900, margin:'2px 0' }}>6 Month Trend</h3>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ color:'#22c55e', fontSize:'22px', fontWeight:900, margin:0 }}>{fmtShort(data.revenue.total)}</p>
                  <p style={{ color:'#94a3b8', fontSize:'10px' }}>total</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data.revenue.chart}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"  stopColor="#22c55e" stopOpacity={0.5}/>
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                  <XAxis dataKey="name" tick={{ fill:'#94a3b8', fontSize:11 }}/>
                  <YAxis tick={{ fill:'#94a3b8', fontSize:11 }} tickFormatter={fmtShort}/>
                  <Tooltip
                    contentStyle={{ background:'#0f172a', border:'1px solid #334155', borderRadius:'10px' }}
                    formatter={(v) => [fmtINR(v), 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} fill="url(#revGrad)"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Vehicle Distribution */}
            <div style={{ background:'linear-gradient(135deg, #1e293b, #0f172a)', border:'1px solid #334155', borderRadius:'18px', padding:'18px' }}>
              <p style={{ color:'#94a3b8', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px' }}>🏍️ TOP VEHICLE MODELS</p>
              {data.charts.vehicles.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={data.charts.vehicles} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      outerRadius={75} innerRadius={40}
                      label={({ name, value }) => `${value}`} labelLine={false}>
                      {data.charts.vehicles.map((_, i) => (
                        <Cell key={i} fill={['#3b82f6','#a855f7','#ec4899','#f59e0b','#10b981','#06b6d4'][i % 6]}/>
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background:'#0f172a', border:'1px solid #334155', borderRadius:'10px' }}/>
                  </PieChart>
                </ResponsiveContainer>
              ) : <p style={{ color:'#64748b', textAlign:'center', padding:'40px 0' }}>No data</p>}
            </div>
          </div>
        </div>

        {/* ─── TOP PARTS + SALARY + QUICK ACTIONS ─── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:'14px', marginBottom:'20px' }}>

          {/* Top Parts Consumed */}
          <div style={{ background:'linear-gradient(135deg, #1e293b, #0f172a)', border:'1px solid #334155', borderRadius:'18px', padding:'18px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'14px' }}>
              <p style={{ color:'#94a3b8', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px' }}>📦 MOST USED PARTS</p>
              <Link to="/parts" style={{ color:'#60a5fa', fontSize:'11px', display:'flex', alignItems:'center', gap:'2px' }}>
                View All <ArrowUpRight size={11}/>
              </Link>
            </div>
            {data.charts.topParts.length === 0 ? (
              <p style={{ color:'#64748b', textAlign:'center', padding:'40px 0', fontSize:'13px' }}>
                No parts consumed yet<br/><span style={{ fontSize:'10px' }}>Invoices generate होने पर यहाँ दिखेगा</span>
              </p>
            ) : data.charts.topParts.map((p, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
                <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:['#ef4444','#f97316','#eab308','#22c55e','#3b82f6'][i], color:'#fff', fontWeight:900, fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center' }}>{i+1}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ color:'#e2e8f0', fontSize:'12px', fontWeight:700, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</p>
                  <p style={{ color:'#64748b', fontSize:'10px', margin:0 }}>{p.used} units • {fmtShort(p.value)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Salary Summary */}
          {user?.role === 'admin' && (
            <div style={{ background:'linear-gradient(135deg, #1e293b, #0f172a)', border:'1px solid #334155', borderRadius:'18px', padding:'18px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'14px' }}>
                <p style={{ color:'#94a3b8', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px' }}>💰 SALARY STATUS (THIS MONTH)</p>
                <Link to="/staff-management" style={{ color:'#60a5fa', fontSize:'11px', display:'flex', alignItems:'center', gap:'2px' }}>
                  Manage <ArrowUpRight size={11}/>
                </Link>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
                <div style={{ background:'#10b98122', border:'1px solid #10b98144', borderRadius:'12px', padding:'12px' }}>
                  <p style={{ color:'#86efac', fontSize:'9px', fontWeight:700, letterSpacing:'0.5px' }}>PAID</p>
                  <p style={{ color:'#f8fafc', fontSize:'16px', fontWeight:900, margin:'2px 0' }}>{fmtShort(data.salary.paid)}</p>
                </div>
                <div style={{ background:'#ef444422', border:'1px solid #ef444444', borderRadius:'12px', padding:'12px' }}>
                  <p style={{ color:'#fca5a5', fontSize:'9px', fontWeight:700, letterSpacing:'0.5px' }}>PENDING</p>
                  <p style={{ color:'#f8fafc', fontSize:'16px', fontWeight:900, margin:'2px 0' }}>{fmtShort(data.salary.pending)}</p>
                </div>
                <div style={{ background:'#3b82f622', border:'1px solid #3b82f644', borderRadius:'12px', padding:'12px' }}>
                  <p style={{ color:'#93c5fd', fontSize:'9px', fontWeight:700, letterSpacing:'0.5px' }}>TOTAL DUE</p>
                  <p style={{ color:'#f8fafc', fontSize:'16px', fontWeight:900, margin:'2px 0' }}>{fmtShort(data.salary.due)}</p>
                </div>
              </div>
              <div style={{ marginTop:'10px', height:'6px', background:'#1e293b', borderRadius:'3px', overflow:'hidden' }}>
                <div style={{ width:`${data.salary.due > 0 ? (data.salary.paid / data.salary.due) * 100 : 0}%`, height:'100%', background:'linear-gradient(90deg, #22c55e, #10b981)', transition:'width 0.5s' }}/>
              </div>
              <p style={{ color:'#64748b', fontSize:'10px', marginTop:'4px' }}>
                {data.totals.staff} staff members • {data.salary.due > 0 ? Math.round((data.salary.paid/data.salary.due)*100) : 0}% paid
              </p>
            </div>
          )}

          {/* Quick Actions */}
          <div style={{ background:'linear-gradient(135deg, #1e293b, #0f172a)', border:'1px solid #334155', borderRadius:'18px', padding:'18px' }}>
            <p style={{ color:'#94a3b8', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px', marginBottom:'12px' }}>⚡ QUICK ACTIONS</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
              {[
                { l:'🔔 Reminders',    p:'/reminders',             g:'linear-gradient(135deg,#dc2626,#991b1b)' },
                { l:'🎫 New Job Card', p:'/job-cards',             g:'linear-gradient(135deg,#0284c7,#075985)' },
                { l:'📄 Invoices',     p:'/invoice-management',    g:'linear-gradient(135deg,#ea580c,#9a3412)', a:true },
                { l:'📦 Parts',        p:'/parts',                 g:'linear-gradient(135deg,#a855f7,#7e22ce)' },
                { l:'🔍 Diagnostic',   p:'/diagnostic',            g:'linear-gradient(135deg,#0891b2,#155e75)', a:true },
                { l:'📊 Reports',      p:'/reports',               g:'linear-gradient(135deg,#059669,#065f46)', a:true },
              ].filter(x => !x.a || user?.role === 'admin').map((x,i) => (
                <Link key={i} to={x.p}
                  style={{ background:x.g, padding:'10px', borderRadius:'10px', color:'#fff', fontSize:'11px', fontWeight:700, textAlign:'center', textDecoration:'none', transition:'all 0.2s' }}
                  className="hover:scale-105 block">
                  {x.l}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ─── RECENT INVOICES ─── */}
        <div style={{ background:'linear-gradient(135deg, #1e293b, #0f172a)', border:'1px solid #334155', borderRadius:'18px', padding:'18px', marginBottom:'20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'14px' }}>
            <p style={{ color:'#94a3b8', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px' }}>📄 RECENT INVOICES</p>
            <Link to="/invoice-management" style={{ color:'#60a5fa', fontSize:'11px', display:'flex', alignItems:'center', gap:'2px' }}>
              View All <ArrowUpRight size={11}/>
            </Link>
          </div>
          {data.recent.length === 0 ? (
            <p style={{ color:'#64748b', textAlign:'center', padding:'20px 0' }}>No invoices yet</p>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', fontSize:'12px' }}>
                <thead>
                  <tr style={{ color:'#94a3b8', fontSize:'10px', textTransform:'uppercase', borderBottom:'1px solid #334155' }}>
                    <th style={{ padding:'8px', textAlign:'left' }}>Invoice #</th>
                    <th style={{ padding:'8px', textAlign:'left' }}>Customer</th>
                    <th style={{ padding:'8px', textAlign:'left' }}>Vehicle</th>
                    <th style={{ padding:'8px', textAlign:'right' }}>Amount</th>
                    <th style={{ padding:'8px', textAlign:'right' }}>Date</th>
                    <th style={{ width:'30px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((inv, i) => (
                    <tr key={i} onClick={() => navigate(`/invoice/${inv._id || inv.invoiceNumber}`)}
                      style={{ borderBottom:'1px solid #1e293b', cursor:'pointer', transition:'background 0.15s' }}
                      className="hover:bg-slate-800">
                      <td style={{ padding:'10px 8px', color:'#60a5fa', fontWeight:700 }}>#{inv.invoiceNumber || inv.invoiceNo || inv._id?.slice(-6)}</td>
                      <td style={{ padding:'10px 8px', color:'#e2e8f0' }}>{inv.customerName || '—'}</td>
                      <td style={{ padding:'10px 8px', color:'#94a3b8' }}>{inv.vehicle || inv.regNo || '—'}</td>
                      <td style={{ padding:'10px 8px', color:'#86efac', fontWeight:700, textAlign:'right' }}>{fmtShort(inv.totals?.totalAmount || inv.total || 0)}</td>
                      <td style={{ padding:'10px 8px', color:'#64748b', textAlign:'right' }}>{fmtDate(inv.invoiceDate)}</td>
                      <td><Eye size={12} color="#64748b"/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}