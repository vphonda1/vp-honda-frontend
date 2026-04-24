// ════════════════════════════════════════════════════════════════════════════
// ReportsAnalytics.jsx — VP Honda Intelligence Reports
// ════════════════════════════════════════════════════════════════════════════
// Comprehensive business reports with drill-down:
// • Sales report (vehicle vs service, monthly, yearly)
// • Parts consumption report (top used, revenue by part)
// • Customer report (new, retention, pending payments)
// • Staff report (payroll summary, attendance)
// • Service report (due/overdue, completion rate)
// • Profit & Loss snapshot
// • Export CSV for any report
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area,
} from 'recharts';
import {
  TrendingUp, TrendingDown, RefreshCw, Download, Users, FileText,
  Package, IndianRupee, Clock, AlertTriangle, CheckCircle, Calendar,
  Filter, Activity, ArrowLeft, BarChart3, PieChart as PieIcon,
  ChevronDown, Award, Target, DollarSign, Bike,
} from 'lucide-react';
import { api } from '../utils/apiConfig';

// ── Helpers ─────────────────────────────────────────────────────────────────
const getLS = (k, fb=[]) => { try { return JSON.parse(localStorage.getItem(k)) || fb; } catch { return fb; } };
const fmtINR = (n) => '₹' + Math.round(n||0).toLocaleString('en-IN');
const fmtShort = (n) => {
  n = Math.round(n||0);
  if (n >= 10000000) return '₹' + (n/10000000).toFixed(2) + 'Cr';
  if (n >= 100000)   return '₹' + (n/100000).toFixed(2) + 'L';
  if (n >= 1000)     return '₹' + (n/1000).toFixed(1) + 'K';
  return '₹' + n;
};
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const COLORS = ['#3b82f6','#a855f7','#ec4899','#f59e0b','#10b981','#06b6d4','#ef4444','#84cc16'];

// ── Export CSV Helper ──────────────────────────────────────────────────────
const exportCSV = (filename, rows) => {
  if (!rows || rows.length === 0) { alert('कोई data नहीं export करने को'); return; }
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => {
      const val = row[h];
      const str = val == null ? '' : String(val);
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g,'""')}"` : str;
    }).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ════════════════════════════════════════════════════════════════════════════
export default function ReportsAnalytics({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState('overview');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [monthFilter, setMonthFilter] = useState('all');
  const [raw, setRaw] = useState({ customers: [], invoices: [], parts: [], staff: [], salaries: [], partHistory: [], serviceData: {} });
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const f = async (url, fb=[]) => {
      try { const r = await fetch(api(url)); if (r.ok) return await r.json(); } catch {}
      return fb;
    };
    const [customers, invoices, parts, staff, salaries, partHistory, serviceDataArr] = await Promise.all([
      f('/api/customers'), f('/api/invoices'), f('/api/parts'), f('/api/staff'),
      f('/api/salaries'), f('/api/parts/history/all'), f('/api/service-data'),
    ]);
    const lsInv = [...getLS('invoices',[]), ...getLS('generatedInvoices',[])];
    const allInv = invoices.length > 0 ? invoices : lsInv;
    const sdMap = { ...getLS('customerServiceData', {}) };
    serviceDataArr.forEach(r => { sdMap[r.regNo || r._id] = r; });
    setRaw({ customers, invoices: allInv, parts, staff, salaries, partHistory, serviceData: sdMap });
    setLastRefresh(new Date());
    setLoading(false);
  };

  // ── Filter by year/month ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const filter = (items, dateKey = 'invoiceDate') => items.filter(i => {
      const d = i[dateKey] ? new Date(i[dateKey]) : null;
      if (!d || isNaN(d)) return false;
      if (d.getFullYear() !== yearFilter) return false;
      if (monthFilter !== 'all' && d.getMonth() + 1 !== parseInt(monthFilter)) return false;
      return true;
    });
    return {
      invoices: filter(raw.invoices),
      customers: raw.customers, // not filtered by date
      partHistory: filter(raw.partHistory, 'consumedAt'),
      salaries: filter(raw.salaries, 'paymentDate'),
    };
  }, [raw, yearFilter, monthFilter]);

  // ── Calculations ──────────────────────────────────────────────────────────
  const calc = useMemo(() => {
    // Sales
    const totalSales = filtered.invoices.reduce((s, i) => s + (i.totals?.totalAmount || i.total || i.grandTotal || 0), 0);
    const vehicleSales = filtered.invoices.filter(i => {
      const amt = i.totals?.totalAmount || i.total || 0;
      return i.invoiceType === 'vehicle' || amt >= 50000;
    });
    const serviceSales = filtered.invoices.filter(i => {
      const amt = i.totals?.totalAmount || i.total || 0;
      return i.invoiceType !== 'vehicle' && amt < 50000;
    });
    const vehicleRev = vehicleSales.reduce((s, i) => s + (i.totals?.totalAmount || i.total || 0), 0);
    const serviceRev = serviceSales.reduce((s, i) => s + (i.totals?.totalAmount || i.total || 0), 0);

    // Monthly breakdown
    const monthlyData = MONTHS.map((name, i) => ({ name, revenue: 0, invoices: 0, vehicles: 0, services: 0 }));
    filtered.invoices.forEach(inv => {
      const d = inv.invoiceDate ? new Date(inv.invoiceDate) : null;
      if (!d || isNaN(d)) return;
      const m = d.getMonth();
      const amt = inv.totals?.totalAmount || inv.total || 0;
      monthlyData[m].revenue += amt;
      monthlyData[m].invoices += 1;
      if (inv.invoiceType === 'vehicle' || amt >= 50000) monthlyData[m].vehicles += 1;
      else monthlyData[m].services += 1;
    });

    // Customer stats
    const totalCustomers = raw.customers.length;
    const newCustomers = raw.customers.filter(c => {
      const d = c.createdAt ? new Date(c.createdAt) : null;
      return d && d.getFullYear() === yearFilter;
    }).length;

    // Pending payments
    let pendingAmount = 0, pendingCount = 0;
    Object.values(raw.serviceData).forEach(d => {
      const amt = parseFloat(d.pendingAmount || 0);
      if (amt > 0 && !d.paymentReceivedDate) { pendingAmount += amt; pendingCount++; }
    });

    // Parts consumption
    const partUsage = {};
    filtered.partHistory.filter(p => !p.reverted).forEach(c => {
      const key = c.partName || c.partNumber || 'Unknown';
      if (!partUsage[key]) partUsage[key] = { name: key, qty: 0, value: 0, partNumber: c.partNumber };
      partUsage[key].qty += c.quantity || 1;
      partUsage[key].value += c.totalValue || 0;
    });
    const topParts = Object.values(partUsage).sort((a,b) => b.qty - a.qty).slice(0, 10);
    const totalPartsConsumed = Object.values(partUsage).reduce((s,p) => s + p.qty, 0);
    const totalPartsValue = Object.values(partUsage).reduce((s,p) => s + p.value, 0);

    // Parts stock status
    const outOfStock = raw.parts.filter(p => Number(p.stock || p.quantity || 0) <= 0);
    const lowStock = raw.parts.filter(p => {
      const s = Number(p.stock || p.quantity || 0);
      const m = Number(p.minStock || 0);
      return m > 0 && s > 0 && s <= m;
    });
    const stockValue = raw.parts.reduce((s,p) => s + ((p.mrp || p.unitPrice || 0) * (Number(p.stock||p.quantity)||0)), 0);

    // Salary stats
    const salaryPaid = filtered.salaries.filter(s => s.type === 'salary').reduce((sum, s) => sum + (s.amount || 0), 0);
    const advancePaid = filtered.salaries.filter(s => s.type === 'advance').reduce((sum, s) => sum + (s.amount || 0), 0);
    const bonusPaid = filtered.salaries.filter(s => s.type === 'bonus' || s.type === 'incentive').reduce((sum, s) => sum + (s.amount || 0), 0);
    const totalPayroll = salaryPaid + advancePaid + bonusPaid;

    // Profit/Loss
    const grossRevenue = totalSales;
    const grossExpense = totalPartsValue + totalPayroll; // simplified
    const netProfit = grossRevenue - grossExpense;

    // Vehicle model distribution
    const vehicleMap = {};
    raw.customers.forEach(c => {
      const m = (c.vehicleModel || c.linkedVehicle?.name || '').split(' ').slice(0, 2).join(' ');
      if (m) vehicleMap[m] = (vehicleMap[m] || 0) + 1;
    });
    const vehicleDistribution = Object.entries(vehicleMap).sort((a,b) => b[1]-a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));

    return {
      sales: { total: totalSales, vehicleRev, serviceRev, vehicleCount: vehicleSales.length, serviceCount: serviceSales.length, totalCount: filtered.invoices.length },
      monthly: monthlyData,
      customers: { total: totalCustomers, new: newCustomers, pendingAmount, pendingCount },
      parts: { topParts, totalConsumed: totalPartsConsumed, totalValue: totalPartsValue, outOfStock: outOfStock.length, lowStock: lowStock.length, stockValue, stockList: raw.parts.length },
      salary: { paid: salaryPaid, advance: advancePaid, bonus: bonusPaid, total: totalPayroll, staffCount: raw.staff.length },
      pnl: { revenue: grossRevenue, expense: grossExpense, profit: netProfit, margin: grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0 },
      vehicleDistribution,
    };
  }, [filtered, raw, yearFilter]);

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
      <div className="text-center">
        <Activity className="animate-spin mx-auto mb-3 text-cyan-400" size={48}/>
        <p className="text-slate-400">Reports loading...</p>
      </div>
    </div>
  );

  const REPORTS = [
    { id: 'overview',  label: '📊 Overview',      icon: BarChart3 },
    { id: 'sales',     label: '💰 Sales',         icon: DollarSign },
    { id: 'parts',     label: '📦 Parts',         icon: Package },
    { id: 'customers', label: '👥 Customers',     icon: Users },
    { id: 'salary',    label: '👔 Payroll',       icon: Award },
    { id: 'pnl',       label: '📈 Profit & Loss', icon: TrendingUp },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(180deg, #0f172a, #020617)', color:'#f8fafc', padding:'20px' }}>
      <div style={{ maxWidth:'1400px', margin:'0 auto' }}>

        {/* HEADER */}
        <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'space-between', alignItems:'center', gap:'16px', marginBottom:'20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <button onClick={() => navigate('/dashboard')}
              style={{ background:'#1e293b', border:'1px solid #334155', color:'#f8fafc', padding:'8px 14px', borderRadius:'10px', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', fontSize:'13px' }}>
              <ArrowLeft size={14}/> Back
            </button>
            <div>
              <h1 style={{ fontSize:'26px', fontWeight:900, background:'linear-gradient(90deg, #22c55e, #3b82f6)', WebkitBackgroundClip:'text', color:'transparent', margin:0 }}>
                📈 Reports & Analytics
              </h1>
              <p style={{ color:'#94a3b8', fontSize:'12px', margin:'4px 0 0', display:'flex', alignItems:'center', gap:'6px' }}>
                <Clock size={11}/> {lastRefresh.toLocaleTimeString('en-IN')}
              </p>
            </div>
          </div>

          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            <select value={yearFilter} onChange={e => setYearFilter(parseInt(e.target.value))}
              style={{ background:'#1e293b', border:'1px solid #334155', color:'#f8fafc', padding:'8px 12px', borderRadius:'10px', fontSize:'13px' }}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
              style={{ background:'#1e293b', border:'1px solid #334155', color:'#f8fafc', padding:'8px 12px', borderRadius:'10px', fontSize:'13px' }}>
              <option value="all">All Months</option>
              {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <button onClick={loadAll}
              style={{ background:'linear-gradient(135deg, #3b82f6, #6366f1)', color:'#fff', padding:'8px 14px', borderRadius:'10px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:700, display:'flex', alignItems:'center', gap:'6px' }}>
              <RefreshCw size={14}/> Refresh
            </button>
          </div>
        </div>

        {/* REPORT TABS */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'20px', flexWrap:'wrap' }}>
          {REPORTS.map(r => {
            const Icon = r.icon;
            const active = activeReport === r.id;
            return (
              <button key={r.id} onClick={() => setActiveReport(r.id)}
                style={{
                  background: active ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#1e293b',
                  border: `1px solid ${active ? '#a78bfa' : '#334155'}`,
                  color: active ? '#fff' : '#94a3b8',
                  padding:'10px 14px', borderRadius:'10px', cursor:'pointer',
                  fontSize:'12px', fontWeight:700, display:'flex', alignItems:'center', gap:'6px',
                  boxShadow: active ? '0 4px 14px rgba(139,92,246,0.4)' : 'none',
                }}>
                <Icon size={14}/> {r.label}
              </button>
            );
          })}
        </div>

        {/* ══════ OVERVIEW ══════ */}
        {activeReport === 'overview' && (
          <div style={{ display:'grid', gap:'14px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'14px' }}>
              <StatCard label="Total Revenue"     value={fmtShort(calc.sales.total)}           sub={`${calc.sales.totalCount} invoices`}  color="#22c55e" icon={DollarSign}/>
              <StatCard label="Vehicle Sales"     value={calc.sales.vehicleCount}              sub={fmtShort(calc.sales.vehicleRev)}      color="#3b82f6" icon={Bike}/>
              <StatCard label="Service Revenue"   value={fmtShort(calc.sales.serviceRev)}      sub={`${calc.sales.serviceCount} services`} color="#a855f7" icon={Package}/>
              <StatCard label="Net Profit"        value={fmtShort(calc.pnl.profit)}            sub={`${calc.pnl.margin.toFixed(1)}% margin`} color={calc.pnl.profit > 0 ? '#22c55e' : '#ef4444'} icon={TrendingUp}/>
              <StatCard label="Pending Payments"  value={fmtShort(calc.customers.pendingAmount)} sub={`${calc.customers.pendingCount} customers`} color="#f97316" icon={AlertTriangle}/>
              <StatCard label="Parts Consumed"    value={calc.parts.totalConsumed}             sub={fmtShort(calc.parts.totalValue)}      color="#06b6d4" icon={Package}/>
            </div>

            {/* Monthly trend */}
            <Panel title="📊 Monthly Performance" subtitle={`${yearFilter} revenue trend`}>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={calc.monthly}>
                  <defs>
                    <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5}/>
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                  <XAxis dataKey="name" tick={{ fill:'#94a3b8', fontSize:11 }}/>
                  <YAxis tick={{ fill:'#94a3b8', fontSize:11 }} tickFormatter={fmtShort}/>
                  <Tooltip contentStyle={{ background:'#0f172a', border:'1px solid #334155', borderRadius:'10px' }} formatter={(v,n)=>n==='revenue'?[fmtINR(v),'Revenue']:[v,n]}/>
                  <Legend/>
                  <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="url(#revGrad2)" strokeWidth={2}/>
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
          </div>
        )}

        {/* ══════ SALES ══════ */}
        {activeReport === 'sales' && (
          <div style={{ display:'grid', gap:'14px' }}>
            <Panel title="💰 Sales Breakdown" subtitle="Vehicle vs Service" action={
              <button onClick={() => exportCSV('sales_report', filtered.invoices.map(i => ({
                invoiceNo: i.invoiceNumber || i.invoiceNo, date: i.invoiceDate, customer: i.customerName,
                type: i.invoiceType || 'service', regNo: i.regNo, amount: i.totals?.totalAmount || i.total || 0,
              })))} style={btnStyle('#22c55e')}>
                <Download size={12}/> Export CSV
              </button>
            }>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'14px' }}>
                <div style={{ background:'#3b82f622', border:'1px solid #3b82f655', padding:'14px', borderRadius:'12px' }}>
                  <p style={{ color:'#93c5fd', fontSize:'11px', fontWeight:700 }}>🏍️ VEHICLE SALES</p>
                  <p style={{ color:'#fff', fontSize:'24px', fontWeight:900 }}>{calc.sales.vehicleCount}</p>
                  <p style={{ color:'#93c5fd', fontSize:'14px' }}>{fmtINR(calc.sales.vehicleRev)}</p>
                </div>
                <div style={{ background:'#a855f722', border:'1px solid #a855f755', padding:'14px', borderRadius:'12px' }}>
                  <p style={{ color:'#d8b4fe', fontSize:'11px', fontWeight:700 }}>🔧 SERVICE REVENUE</p>
                  <p style={{ color:'#fff', fontSize:'24px', fontWeight:900 }}>{calc.sales.serviceCount}</p>
                  <p style={{ color:'#d8b4fe', fontSize:'14px' }}>{fmtINR(calc.sales.serviceRev)}</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={calc.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                  <XAxis dataKey="name" tick={{ fill:'#94a3b8', fontSize:11 }}/>
                  <YAxis tick={{ fill:'#94a3b8', fontSize:11 }}/>
                  <Tooltip contentStyle={{ background:'#0f172a', border:'1px solid #334155', borderRadius:'10px' }}/>
                  <Legend/>
                  <Bar dataKey="vehicles" fill="#3b82f6" name="Vehicles"/>
                  <Bar dataKey="services" fill="#a855f7" name="Services"/>
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>
        )}

        {/* ══════ PARTS ══════ */}
        {activeReport === 'parts' && (
          <div style={{ display:'grid', gap:'14px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'12px' }}>
              <StatCard label="Total Parts"      value={calc.parts.stockList}     sub="in inventory"                 color="#3b82f6" icon={Package}/>
              <StatCard label="Stock Value"      value={fmtShort(calc.parts.stockValue)} sub="current stock"        color="#22c55e" icon={DollarSign}/>
              <StatCard label="Parts Consumed"   value={calc.parts.totalConsumed} sub={fmtShort(calc.parts.totalValue)} color="#06b6d4" icon={TrendingDown}/>
              <StatCard label="Out of Stock"     value={calc.parts.outOfStock}    sub="needs reorder"                color="#ef4444" icon={AlertTriangle}/>
              <StatCard label="Low Stock"        value={calc.parts.lowStock}      sub="below minimum"                color="#f97316" icon={AlertTriangle}/>
            </div>

            <Panel title="📦 Top 10 Most Used Parts" action={
              <button onClick={() => exportCSV('parts_consumption', calc.parts.topParts)} style={btnStyle('#a855f7')}>
                <Download size={12}/> Export
              </button>
            }>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={calc.parts.topParts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                  <XAxis type="number" tick={{ fill:'#94a3b8', fontSize:11 }}/>
                  <YAxis type="category" dataKey="name" width={140} tick={{ fill:'#94a3b8', fontSize:10 }}/>
                  <Tooltip contentStyle={{ background:'#0f172a', border:'1px solid #334155', borderRadius:'10px' }} formatter={(v,n) => n==='value'?fmtINR(v):v}/>
                  <Legend/>
                  <Bar dataKey="qty" fill="#a855f7" name="Quantity Used"/>
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>
        )}

        {/* ══════ CUSTOMERS ══════ */}
        {activeReport === 'customers' && (
          <div style={{ display:'grid', gap:'14px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'12px' }}>
              <StatCard label="Total Customers"    value={calc.customers.total} color="#3b82f6" icon={Users}/>
              <StatCard label="New This Year"      value={calc.customers.new}   color="#22c55e" icon={TrendingUp}/>
              <StatCard label="Pending Customers"  value={calc.customers.pendingCount} sub={fmtShort(calc.customers.pendingAmount)} color="#ef4444" icon={AlertTriangle}/>
            </div>
            <Panel title="🏍️ Vehicle Model Distribution">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={calc.vehicleDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({name,value})=>`${name}: ${value}`}>
                    {calc.vehicleDistribution.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                  </Pie>
                  <Tooltip contentStyle={{ background:'#0f172a', border:'1px solid #334155', borderRadius:'10px' }}/>
                </PieChart>
              </ResponsiveContainer>
            </Panel>
          </div>
        )}

        {/* ══════ PAYROLL ══════ */}
        {activeReport === 'salary' && (
          <div style={{ display:'grid', gap:'14px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'12px' }}>
              <StatCard label="Salary Paid"    value={fmtShort(calc.salary.paid)}    sub={`${yearFilter}`} color="#22c55e" icon={Award}/>
              <StatCard label="Advance Given"  value={fmtShort(calc.salary.advance)} sub={`${yearFilter}`} color="#f97316" icon={IndianRupee}/>
              <StatCard label="Bonus/Incentive" value={fmtShort(calc.salary.bonus)}  sub={`${yearFilter}`} color="#3b82f6" icon={TrendingUp}/>
              <StatCard label="Total Payroll"  value={fmtShort(calc.salary.total)}   sub={`${calc.salary.staffCount} staff`} color="#a855f7" icon={Users}/>
            </div>
            <Panel title="💰 Payment Log" action={
              <button onClick={() => exportCSV('salary_payments', filtered.salaries)} style={btnStyle('#a855f7')}>
                <Download size={12}/> Export
              </button>
            }>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', fontSize:'12px' }}>
                  <thead>
                    <tr style={{ color:'#94a3b8', fontSize:'10px', textTransform:'uppercase', borderBottom:'1px solid #334155' }}>
                      <th style={{ padding:'10px', textAlign:'left' }}>Date</th>
                      <th style={{ padding:'10px', textAlign:'left' }}>Staff</th>
                      <th style={{ padding:'10px', textAlign:'left' }}>Type</th>
                      <th style={{ padding:'10px', textAlign:'right' }}>Amount</th>
                      <th style={{ padding:'10px', textAlign:'left' }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.salaries.slice(0, 20).map((s,i) => (
                      <tr key={i} style={{ borderBottom:'1px solid #1e293b' }}>
                        <td style={{ padding:'8px 10px', color:'#94a3b8' }}>{s.paymentDate}</td>
                        <td style={{ padding:'8px 10px', color:'#e2e8f0' }}>{s.staffName}</td>
                        <td style={{ padding:'8px 10px' }}>
                          <span style={{ padding:'2px 8px', borderRadius:'8px', fontSize:'10px', fontWeight:700,
                            background: s.type==='advance'?'#f9731622':s.type==='bonus'?'#3b82f622':'#22c55e22',
                            color: s.type==='advance'?'#fdba74':s.type==='bonus'?'#93c5fd':'#86efac' }}>
                            {s.type?.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding:'8px 10px', color:'#86efac', fontWeight:700, textAlign:'right' }}>{fmtINR(s.amount)}</td>
                        <td style={{ padding:'8px 10px', color:'#64748b' }}>{s.notes || '—'}</td>
                      </tr>
                    ))}
                    {filtered.salaries.length === 0 && <tr><td colSpan="5" style={{ padding:'30px', textAlign:'center', color:'#64748b' }}>No payments</td></tr>}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )}

        {/* ══════ PROFIT & LOSS ══════ */}
        {activeReport === 'pnl' && (
          <div style={{ display:'grid', gap:'14px' }}>
            <Panel title="📈 Profit & Loss Summary">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px' }}>
                <div style={{ background:'#22c55e15', border:'1px solid #22c55e40', padding:'18px', borderRadius:'14px' }}>
                  <p style={{ color:'#86efac', fontSize:'11px', fontWeight:700 }}>💰 REVENUE</p>
                  <p style={{ color:'#fff', fontSize:'28px', fontWeight:900, margin:'4px 0' }}>{fmtShort(calc.pnl.revenue)}</p>
                  <p style={{ color:'#86efac', fontSize:'11px' }}>From {calc.sales.totalCount} invoices</p>
                </div>
                <div style={{ background:'#ef444415', border:'1px solid #ef444440', padding:'18px', borderRadius:'14px' }}>
                  <p style={{ color:'#fca5a5', fontSize:'11px', fontWeight:700 }}>📉 EXPENSES</p>
                  <p style={{ color:'#fff', fontSize:'28px', fontWeight:900, margin:'4px 0' }}>{fmtShort(calc.pnl.expense)}</p>
                  <p style={{ color:'#fca5a5', fontSize:'11px' }}>Parts + Payroll</p>
                </div>
                <div style={{ background: calc.pnl.profit > 0 ? '#22c55e22' : '#ef444422', border:`1px solid ${calc.pnl.profit > 0 ? '#22c55e66' : '#ef444466'}`, padding:'18px', borderRadius:'14px' }}>
                  <p style={{ color: calc.pnl.profit > 0 ? '#86efac' : '#fca5a5', fontSize:'11px', fontWeight:700 }}>
                    {calc.pnl.profit > 0 ? '🎯 NET PROFIT' : '⚠️ NET LOSS'}
                  </p>
                  <p style={{ color:'#fff', fontSize:'28px', fontWeight:900, margin:'4px 0' }}>{fmtShort(Math.abs(calc.pnl.profit))}</p>
                  <p style={{ color: calc.pnl.profit > 0 ? '#86efac' : '#fca5a5', fontSize:'11px' }}>{calc.pnl.margin.toFixed(1)}% margin</p>
                </div>
              </div>
              <div style={{ marginTop:'18px', background:'#0f172a', padding:'14px', borderRadius:'12px' }}>
                <p style={{ color:'#94a3b8', fontSize:'11px', marginBottom:'6px' }}>💡 Note: यह simplified P&L है। Parts + Salary expenses में से calculate होता है। Rent, utilities, taxes अभी include नहीं।</p>
              </div>
            </Panel>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Small helper components ─────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div style={{ background:`linear-gradient(135deg, ${color}22, ${color}0a)`, border:`1px solid ${color}40`, borderRadius:'14px', padding:'16px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
        <p style={{ color:'#94a3b8', fontSize:'10px', fontWeight:700, letterSpacing:'0.5px' }}>{label}</p>
        <Icon size={16} color={color}/>
      </div>
      <p style={{ color:'#f8fafc', fontSize:'22px', fontWeight:900, margin:'2px 0' }}>{value}</p>
      {sub && <p style={{ color:'#64748b', fontSize:'10px' }}>{sub}</p>}
    </div>
  );
}

function Panel({ title, subtitle, action, children }) {
  return (
    <div style={{ background:'linear-gradient(135deg, #1e293b, #0f172a)', border:'1px solid #334155', borderRadius:'16px', padding:'18px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:'14px' }}>
        <div>
          <h3 style={{ color:'#f8fafc', fontSize:'15px', fontWeight:800, margin:0 }}>{title}</h3>
          {subtitle && <p style={{ color:'#94a3b8', fontSize:'11px', margin:'2px 0 0' }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

const btnStyle = (color) => ({
  background:`${color}22`, border:`1px solid ${color}66`, color: color, padding:'6px 12px', borderRadius:'8px',
  cursor:'pointer', fontSize:'11px', fontWeight:700, display:'flex', alignItems:'center', gap:'4px',
});