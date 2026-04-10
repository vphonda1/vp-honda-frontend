import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area, RadialBarChart, RadialBar
} from 'recharts';
import {
  TrendingUp, TrendingDown, RefreshCw, Download, Users,
  FileText, Package, ShoppingCart, IndianRupee, Clock,
  AlertTriangle, CheckCircle, Calendar, Filter, Activity
} from 'lucide-react';

// ─── Color palette ──────────────────────────────────────────────────────────
const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#06b6d4','#f97316'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtINR = (n) => '₹' + (Math.round(n)||0).toLocaleString('en-IN');
const fmtL   = (n) => {
  n = Math.round(n||0);
  if (n >= 100000) return '₹'+(n/100000).toFixed(2)+'L';
  if (n >= 1000)   return '₹'+(n/1000).toFixed(1)+'K';
  return '₹'+n;
};
const getLS = (key, fallback = []) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const countSundays = (year, month) => {
  let c=0, d=new Date(year,month,1);
  while(d.getMonth()===month){if(d.getDay()===0)c++;d.setDate(d.getDate()+1);}
  return c;
};
const isLate = (t) => {
  if(!t) return false;
  const low=t.toLowerCase();
  const parts=low.replace(/[apm\s]/g,'').split(':');
  let h=parseInt(parts[0]||0),m=parseInt(parts[1]||0);
  if(low.includes('pm')&&h!==12) h+=12;
  if(low.includes('am')&&h===12) h=0;
  return h>9||(h===9&&m>30);
};

// ─── Custom tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, prefix = '₹' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 shadow-xl rounded-xl p-3 text-sm">
      <p className="font-bold text-gray-800 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {prefix === '₹' && typeof p.value === 'number' ? fmtINR(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
export default function ReportsAnalytics({ user }) {
  const [data, setData]             = useState({});
  const [loading, setLoading]       = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [filterYear, setFilterYear]   = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(-1); // -1 = all months
  const [activeTab, setActiveTab]     = useState('overview');
  const intervalRef = useRef(null);

  // ── Core data loader — reads ALL localStorage sources ────────────────────
  const loadAllData = useCallback(() => {
    // 1. Invoices / Job Cards
    const invoices = [
      ...getLS('generatedInvoices'),
      ...getLS('jobCards'),
      ...getLS('invoices'),
    ].filter(Boolean);

    // 2. Parts
    const parts = getLS('partsData', getLS('parts', []));

    // 3. Customers
    const customers = [
      ...getLS('sharedCustomerData'),
      ...getLS('customerData'),
      ...getLS('customers'),
    ].filter(Boolean);

    // 4. Vehicles
    const vehicles = [
      ...getLS('sharedVehicleData'),
      ...getLS('vehDashboardData'),
      ...getLS('vehicles'),
    ].filter(Boolean);

    // 5. Quotations
    const quotations = getLS('quotations');

    // 6. Staff
    const staffList       = getLS('staffData');
    const attendance      = getLS('staffAttendance', {});
    const payments        = getLS('staffPayments', {});
    const incentives      = getLS('staffIncentives', {});

    // ── Invoice Analytics ──────────────────────────────────────────────────
    const monthlyRevenue = Array(12).fill(0).map((_, i) => ({ month: MONTHS_SHORT[i], revenue: 0, count: 0, label: i }));
    let totalRevenue = 0, totalInvoices = invoices.length;

    invoices.forEach(inv => {
      const d = new Date(inv.date || inv.createdAt || inv.invoiceDate || 0);
      if (d.getFullYear() === filterYear) {
        const m = d.getMonth();
        const amt = parseFloat(inv.totalAmount || inv.amount || inv.grandTotal || inv.total || 0);
        monthlyRevenue[m].revenue += amt;
        monthlyRevenue[m].count   += 1;
        totalRevenue += amt;
      }
    });

    const filteredMonthly = filterMonth === -1
      ? monthlyRevenue.filter(m => m.revenue > 0 || m.count > 0)
      : [monthlyRevenue[filterMonth]];

    // Best month
    const bestMonth = [...monthlyRevenue].sort((a,b)=>b.revenue-a.revenue)[0];

    // ── Quotation Analytics ────────────────────────────────────────────────
    const quotByStatus = { Hot:0, Warm:0, Cold:0 };
    const quotByModel  = {};
    const quotByType   = { CASH:0, FINANCE:0, DD:0 };
    quotations.forEach(q => {
      quotByStatus[q.status] = (quotByStatus[q.status]||0) + 1;
      quotByModel[q.model]   = (quotByModel[q.model]||0) + 1;
      const t = q.selectedPaymentType || 'CASH';
      quotByType[t] = (quotByType[t]||0) + 1;
    });
    const quotModelChart = Object.entries(quotByModel).map(([name,val])=>({name,value:val})).sort((a,b)=>b.value-a.value).slice(0,6);
    const quotStatusChart = Object.entries(quotByStatus).map(([name,value])=>({name,value}));
    const quotTypeChart   = Object.entries(quotByType).map(([name,value])=>({name,value}));

    // ── Parts Analytics ────────────────────────────────────────────────────
    let totalPartsValue=0, lowStockCount=0, totalPartsStock=0;
    parts.forEach(p => {
      const stock = parseInt(p.stock||p.quantity||0);
      const price = parseFloat(p.unitPrice||p.price||p.mrp||0);
      totalPartsValue  += stock * price;
      totalPartsStock  += stock;
      if (stock < 10) lowStockCount++;
    });
    const topParts = [...parts]
      .map(p => ({ name:(p.description||p.partNo||p.name||'').slice(0,15), stock:parseInt(p.stock||p.quantity||0), value:parseFloat(p.unitPrice||p.price||0)*(parseInt(p.stock||p.quantity||0)) }))
      .sort((a,b)=>b.value-a.value).slice(0,8);

    // ── Customer Analytics ─────────────────────────────────────────────────
    const custByMonth = Array(12).fill(0).map((_, i) => ({ month: MONTHS_SHORT[i], count: 0 }));
    customers.forEach(c => {
      const d = new Date(c.date||c.createdAt||c.regDate||0);
      if(d.getFullYear()===filterYear) custByMonth[d.getMonth()].count++;
    });

    // ── Vehicle Analytics ──────────────────────────────────────────────────
    const vehByModel  = {};
    const vehByStatus = {};
    vehicles.forEach(v => {
      const model  = v.model||v.vehicleModel||v.variantName||'Unknown';
      const status = v.saleStatus||v.status||'Unknown';
      vehByModel[model]   = (vehByModel[model]||0)+1;
      vehByStatus[status] = (vehByStatus[status]||0)+1;
    });
    const vehModelChart  = Object.entries(vehByModel).map(([n,v])=>({name:n.slice(0,18),value:v})).sort((a,b)=>b.value-a.value).slice(0,6);
    const vehStatusChart = Object.entries(vehByStatus).map(([n,v])=>({name:n,value:v}));

    // ── Staff Analytics ────────────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0];
    const curMonth = new Date().getMonth();
    const curYear  = new Date().getFullYear();
    let totalSalaryBill=0, totalPaid=0, todayPresent=0, todayLate=0;

    const staffStats = staffList.map(s => {
      const att   = (attendance[s.id]||[]);
      const pays  = (payments[s.id]||[]);
      const todayRec = att.find(a=>a.date===today);
      if(todayRec) { todayPresent++; if(todayRec.checkInTime&&isLate(todayRec.checkInTime)) todayLate++; }
      const monthAtt = att.filter(a=>{ const d=new Date(a.date); return d.getMonth()===curMonth&&d.getFullYear()===curYear; });
      const suns  = countSundays(curYear,curMonth);
      const wDays = new Date(curYear,curMonth+1,0).getDate()-suns;
      const present = monthAtt.length;
      const absent  = Math.max(0, wDays-present);
      const perDay  = s.monthlySalary/26;
      let ded=0;
      if(absent===0) ded=0;
      else if(absent>=8&&absent<=10) ded=15*perDay;
      else if(absent>4) ded=(absent+suns)*perDay;
      else ded=absent*perDay;
      const late = monthAtt.filter(a=>a.checkInTime&&isLate(a.checkInTime)).length;
      ded += late*50;
      const net   = Math.max(0, s.monthlySalary-ded);
      const paid  = pays.filter(p=>{const d=new Date(p.date);return d.getMonth()===curMonth&&d.getFullYear()===curYear;}).reduce((s,p)=>s+p.amount,0);
      totalSalaryBill += s.monthlySalary;
      totalPaid       += paid;
      return { name:s.name, position:s.position, present, absent, late, net, paid, balance:net-paid };
    });

    const staffPayChart = staffStats.map(s=>({ name:s.name.split(' ')[0], 'Net Salary':Math.round(s.net), 'Paid':Math.round(s.paid), 'Balance':Math.round(Math.abs(s.balance)) }));

    setData({
      // Invoice
      monthlyRevenue: filteredMonthly, totalRevenue, totalInvoices,
      bestMonth, avgInvoice: totalInvoices > 0 ? totalRevenue/totalInvoices : 0,
      // Quotation
      quotations, quotByStatus, quotModelChart, quotStatusChart, quotTypeChart,
      totalQuotations: quotations.length,
      // Parts
      topParts, totalPartsValue, lowStockCount, totalPartsStock, totalParts: parts.length,
      // Customer
      customers, custByMonth, totalCustomers: customers.length,
      // Vehicle
      vehicles, vehModelChart, vehStatusChart, totalVehicles: vehicles.length,
      // Staff
      staffList, staffStats, staffPayChart,
      totalSalaryBill, totalPaid, staffBalance: totalSalaryBill-totalPaid,
      todayPresent, todayAbsent: staffList.length-todayPresent, todayLate,
    });
    setLastRefresh(new Date());
    setLoading(false);
  }, [filterYear, filterMonth]);

  // ── Auto-refresh: storage event + interval ────────────────────────────────
  useEffect(() => {
    loadAllData();

    // Listen for any localStorage change (from other tabs or same tab)
    const onStorage = () => loadAllData();
    window.addEventListener('storage', onStorage);

    // Also poll every 30 seconds for same-tab changes
    intervalRef.current = setInterval(() => loadAllData(), 30000);

    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(intervalRef.current);
    };
  }, [loadAllData]);

  // Re-load when filters change
  useEffect(() => { loadAllData(); }, [filterYear, filterMonth]);

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    let csv = `VP Honda Reports — ${filterYear}\n\n`;
    csv += 'Month,Revenue,Invoices,Avg Invoice\n';
    (data.monthlyRevenue||[]).forEach(m => {
      csv += `${m.month},${m.revenue},${m.count},${m.count ? Math.round(m.revenue/m.count) : 0}\n`;
    });
    csv += '\nStaff Salary Report\n';
    csv += 'Name,Position,Present,Absent,Late,Net Salary,Paid,Balance\n';
    (data.staffStats||[]).forEach(s => {
      csv += `"${s.name}","${s.position}",${s.present},${s.absent},${s.late},${Math.round(s.net)},${Math.round(s.paid)},${Math.round(s.balance)}\n`;
    });
    const blob = new Blob([csv],{type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `VPHonda_Report_${filterYear}.csv`;
    a.click();
  };

  // ────────────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 font-semibold">Loading Reports...</p>
      </div>
    </div>
  );

  const tabs = [
    { id:'overview',   label:'Overview',   icon:'📊' },
    { id:'invoices',   label:'Invoices',   icon:'🧾' },
    { id:'quotations', label:'Quotations', icon:'📋' },
    { id:'inventory',  label:'Inventory',  icon:'📦' },
    { id:'customers',  label:'Customers',  icon:'👥' },
    { id:'vehicles',   label:'Vehicles',   icon:'🏍️' },
    { id:'staff',      label:'Staff',      icon:'👔' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-r from-indigo-700 to-purple-700 shadow-xl sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-white flex items-center gap-2">
                <Activity size={24}/> Reports & Analytics
              </h1>
              <p className="text-indigo-200 text-xs mt-0.5 flex items-center gap-1">
                <Clock size={12}/> Auto-refresh · Last updated: {lastRefresh.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
              </p>
            </div>
            <div className="flex gap-3 flex-wrap items-center">
              {/* Year filter */}
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-indigo-300"/>
                <select value={filterYear} onChange={e=>setFilterYear(parseInt(e.target.value))}
                  className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none">
                  {[2026,2025,2024,2023].map(y=><option key={y} value={y} className="text-gray-800">{y}</option>)}
                </select>
              </div>
              {/* Month filter */}
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-indigo-300"/>
                <select value={filterMonth} onChange={e=>setFilterMonth(parseInt(e.target.value))}
                  className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none">
                  <option value={-1} className="text-gray-800">All Months</option>
                  {MONTHS_SHORT.map((m,i)=><option key={i} value={i} className="text-gray-800">{m}</option>)}
                </select>
              </div>
              <button onClick={loadAllData} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-bold px-3 py-1.5 rounded-lg transition-colors">
                <RefreshCw size={14}/> Refresh
              </button>
              <button onClick={exportCSV} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-3 py-1.5 rounded-lg transition-colors">
                <Download size={14}/> Export CSV
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex overflow-x-auto gap-1 mt-3 pb-0">
            {tabs.map(t=>(
              <button key={t.id} onClick={()=>setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all border-b-2 ${
                  activeTab===t.id ? 'border-white text-white bg-white/10' : 'border-transparent text-indigo-300 hover:text-white'
                }`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ════════════════════════════════════════════════════════════════
            OVERVIEW TAB
        ════════════════════════════════════════════════════════════════ */}
        {activeTab==='overview' && (
          <div className="space-y-6">
            {/* Top KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label:'Total Revenue',    val:fmtL(data.totalRevenue),    icon:<IndianRupee size={20}/>,  col:'indigo',  sub:'All Invoices' },
                { label:'Total Invoices',   val:data.totalInvoices,          icon:<FileText size={20}/>,    col:'blue',    sub:'Job Cards' },
                { label:'Total Quotations', val:data.totalQuotations,        icon:<ShoppingCart size={20}/>,col:'purple',  sub:'Enquiries' },
                { label:'Total Customers',  val:data.totalCustomers,         icon:<Users size={20}/>,       col:'green',   sub:'Database' },
              ].map((k,i)=>(
                <Card key={i} className={`border-l-4 border-${k.col}-500 bg-white shadow-sm`}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`text-${k.col}-600`}>{k.icon}</div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-${k.col}-100 text-${k.col}-700`}>{k.sub}</span>
                    </div>
                    <div className={`text-2xl font-black text-${k.col}-700`}>{k.val}</div>
                    <div className="text-xs text-gray-500 mt-1">{k.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Second KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label:'आज Present',    val:data.todayPresent,    col:'green',  icon:'✅' },
                { label:'आज Absent',     val:data.todayAbsent,     col:'red',    icon:'❌' },
                { label:'Low Stock Parts',val:data.lowStockCount,   col:'orange', icon:'⚠️' },
                { label:'Total Vehicles', val:data.totalVehicles,   col:'blue',   icon:'🏍️' },
              ].map((k,i)=>(
                <Card key={i} className={`bg-${k.col}-50 border border-${k.col}-200`}>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl mb-1">{k.icon}</div>
                    <div className={`text-2xl font-black text-${k.col}-700`}>{k.val}</div>
                    <div className="text-xs text-gray-500">{k.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Revenue trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp size={16}/> Revenue Trend ({filterYear})</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={data.monthlyRevenue||[]}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis dataKey="month" tick={{fontSize:11}}/>
                      <YAxis tick={{fontSize:11}} tickFormatter={v=>fmtL(v).replace('₹','')}/>
                      <Tooltip content={<CustomTooltip/>}/>
                      <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" fill="url(#revGrad)" strokeWidth={2.5}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-base">📋 Quotation Status</CardTitle></CardHeader>
                <CardContent className="flex items-center">
                  <ResponsiveContainer width="60%" height={220}>
                    <PieChart>
                      <Pie data={data.quotStatusChart||[]} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                        {(data.quotStatusChart||[]).map((_,i)=><Cell key={i} fill={['#ef4444','#f59e0b','#10b981'][i%3]}/>)}
                      </Pie>
                      <Tooltip formatter={(v,n)=>[v+' quotations',n]}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3 flex-1">
                    {[{l:'🔴 Hot',v:data.quotByStatus?.Hot||0,c:'red'},{l:'🟡 Warm',v:data.quotByStatus?.Warm||0,c:'yellow'},{l:'🟢 Cold',v:data.quotByStatus?.Cold||0,c:'green'}].map((s,i)=>(
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1"><span className="font-semibold">{s.l}</span><span className="font-bold">{s.v}</span></div>
                        <div className="h-2 bg-gray-100 rounded-full"><div className={`h-2 bg-${s.c}-500 rounded-full`} style={{width:`${data.totalQuotations?Math.round(s.v/data.totalQuotations*100):0}%`}}/></div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Staff salary overview */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">💰 Staff Salary Overview (इस माह)</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {[{l:'कुल Salary Bill',v:fmtL(data.totalSalaryBill),c:'blue'},{l:'दिया गया',v:fmtL(data.totalPaid),c:'green'},{l:'बकाया',v:fmtL(Math.max(0,data.staffBalance)),c:'orange'}].map((k,i)=>(
                    <div key={i} className={`bg-${k.c}-50 rounded-xl p-3 text-center`}>
                      <div className={`text-xl font-black text-${k.c}-700`}>{k.v}</div>
                      <div className="text-xs text-gray-500">{k.l}</div>
                    </div>
                  ))}
                </div>
                {(data.staffPayChart||[]).length > 0 && (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.staffPayChart} barSize={16}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis dataKey="name" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}} tickFormatter={v=>fmtL(v).replace('₹','')}/>
                      <Tooltip content={<CustomTooltip/>}/><Legend/>
                      <Bar dataKey="Net Salary" fill="#6366f1" radius={[3,3,0,0]}/>
                      <Bar dataKey="Paid"        fill="#10b981" radius={[3,3,0,0]}/>
                      <Bar dataKey="Balance"     fill="#f59e0b" radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            INVOICES TAB
        ════════════════════════════════════════════════════════════════ */}
        {activeTab==='invoices' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { l:'Total Revenue',   v:fmtL(data.totalRevenue),  c:'indigo' },
                { l:'Total Invoices',  v:data.totalInvoices,        c:'blue'   },
                { l:'Avg Invoice',     v:fmtL(data.avgInvoice),     c:'green'  },
                { l:'Best Month',      v:data.bestMonth?.month||'—',c:'purple' },
              ].map((k,i)=>(
                <Card key={i} className={`border-l-4 border-${k.c}-500`}>
                  <CardContent className="p-5">
                    <div className={`text-2xl font-black text-${k.c}-700 mt-1`}>{k.v}</div>
                    <div className="text-xs text-gray-500 mt-1">{k.l}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-base">📈 Monthly Revenue</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={data.monthlyRevenue||[]}>
                      <defs><linearGradient id="rG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis dataKey="month" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}} tickFormatter={v=>fmtL(v).replace('₹','')}/>
                      <Tooltip content={<CustomTooltip/>}/><Legend/>
                      <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" fill="url(#rG)" strokeWidth={2.5}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-base">📊 Invoice Count by Month</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.monthlyRevenue||[]} barSize={22}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis dataKey="month" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}} allowDecimals={false}/>
                      <Tooltip content={<CustomTooltip prefix=""/>}/><Legend/>
                      <Bar dataKey="count" name="Invoices" fill="#3b82f6" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Monthly Table */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">📋 Month-wise Summary</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-indigo-900 text-white">
                    <tr>{['Month','Revenue','Invoices','Avg Invoice','MoM Growth'].map(h=><th key={h} className="px-4 py-3 text-left font-bold text-xs">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {(data.monthlyRevenue||[]).map((m,i,arr)=>{
                      const prev = arr[i-1];
                      const growth = prev?.revenue ? ((m.revenue-prev.revenue)/prev.revenue*100).toFixed(1) : null;
                      return (
                        <tr key={i} className={`border-b hover:bg-indigo-50 ${i%2===0?'bg-white':'bg-gray-50/50'}`}>
                          <td className="px-4 py-3 font-bold">{m.month}</td>
                          <td className="px-4 py-3 font-bold text-indigo-700">{fmtINR(m.revenue)}</td>
                          <td className="px-4 py-3 text-center">{m.count}</td>
                          <td className="px-4 py-3">{m.count ? fmtINR(m.revenue/m.count) : '—'}</td>
                          <td className="px-4 py-3">
                            {growth!==null ? (
                              <span className={`flex items-center gap-1 font-bold text-xs ${parseFloat(growth)>=0?'text-green-600':'text-red-500'}`}>
                                {parseFloat(growth)>=0?<TrendingUp size={13}/>:<TrendingDown size={13}/>} {growth}%
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                    {(data.monthlyRevenue||[]).length===0 && <tr><td colSpan="5" className="text-center py-8 text-gray-400">इस साल कोई invoice नहीं</td></tr>}
                  </tbody>
                  {(data.monthlyRevenue||[]).length>0 && (
                    <tfoot className="bg-indigo-800 text-white">
                      <tr>
                        <td className="px-4 py-3 font-black">TOTAL</td>
                        <td className="px-4 py-3 font-black">{fmtINR(data.totalRevenue)}</td>
                        <td className="px-4 py-3 text-center font-black">{data.totalInvoices}</td>
                        <td className="px-4 py-3 font-black">{fmtL(data.avgInvoice)}</td>
                        <td className="px-4 py-3"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            QUOTATIONS TAB
        ════════════════════════════════════════════════════════════════ */}
        {activeTab==='quotations' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {[
                { l:'🔴 Hot',   v:data.quotByStatus?.Hot||0,    c:'red'    },
                { l:'🟡 Warm',  v:data.quotByStatus?.Warm||0,   c:'yellow' },
                { l:'🟢 Cold',  v:data.quotByStatus?.Cold||0,   c:'green'  },
              ].map((k,i)=>(
                <Card key={i} className={`bg-${k.c}-50 border border-${k.c}-200`}>
                  <CardContent className="p-5 text-center">
                    <div className={`text-3xl font-black text-${k.c}-700`}>{k.v}</div>
                    <div className="text-sm font-bold text-gray-600 mt-1">{k.l}</div>
                    <div className="text-xs text-gray-400">{data.totalQuotations ? Math.round(k.v/data.totalQuotations*100) : 0}%</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-base">🏍️ Model-wise Enquiries</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.quotModelChart||[]} layout="vertical" barSize={18}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis type="number" tick={{fontSize:11}} allowDecimals={false}/>
                      <YAxis dataKey="name" type="category" tick={{fontSize:10}} width={130}/>
                      <Tooltip content={<CustomTooltip prefix=""/>}/>
                      <Bar dataKey="value" name="Enquiries" fill="#6366f1" radius={[0,4,4,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-base">💳 Payment Type Distribution</CardTitle></CardHeader>
                <CardContent className="flex items-center">
                  <ResponsiveContainer width="60%" height={240}>
                    <PieChart>
                      <Pie data={data.quotTypeChart||[]} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                        {(data.quotTypeChart||[]).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      </Pie>
                      <Tooltip formatter={(v,n)=>[v+' quotations',n]}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3 flex-1">
                    {(data.quotTypeChart||[]).map((t,i)=>(
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-bold" style={{color:COLORS[i%COLORS.length]}}>💳 {t.name}</span>
                          <span className="font-bold">{t.value}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full">
                          <div className="h-2 rounded-full" style={{background:COLORS[i%COLORS.length],width:`${data.totalQuotations?Math.round(t.value/data.totalQuotations*100):0}%`}}/>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quotation table */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">📋 Recent Quotations</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b-2">
                    <tr>{['Quotation No','Customer','Model','Type','Price','Status','Salesman'].map(h=><th key={h} className="px-4 py-3 text-left font-bold text-xs text-gray-700">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {(data.quotations||[]).slice(0,20).map((q,i)=>{
                      const total = (()=>{
                        const t=(q.selectedPaymentType||'CASH').toLowerCase();
                        const p=q[t]||q.cash||{};
                        return [(p.exShowroomPrice||0),(p.registrationAmount||0),(p.insurance||0),(p.hypothecation||0),(p.accessoriesAmount||0)].reduce((s,v)=>s+parseInt(v||0),0);
                      })();
                      return (
                        <tr key={i} className={`border-b hover:bg-indigo-50 ${i%2===0?'bg-white':'bg-gray-50/50'}`}>
                          <td className="px-4 py-2.5 font-bold text-indigo-700 text-xs">{q.quotationNo}</td>
                          <td className="px-4 py-2.5 font-semibold">{q.customerName}</td>
                          <td className="px-4 py-2.5 text-xs">{q.model}</td>
                          <td className="px-4 py-2.5"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{q.selectedPaymentType||'CASH'}</span></td>
                          <td className="px-4 py-2.5 font-bold text-green-700">{fmtINR(total)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${q.status==='Hot'?'bg-red-100 text-red-700':q.status==='Warm'?'bg-yellow-100 text-yellow-700':'bg-green-100 text-green-700'}`}>{q.status}</span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-600">{q.salesmanName||'—'}</td>
                        </tr>
                      );
                    })}
                    {(data.quotations||[]).length===0 && <tr><td colSpan="7" className="text-center py-8 text-gray-400">कोई quotation नहीं</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            INVENTORY TAB
        ════════════════════════════════════════════════════════════════ */}
        {activeTab==='inventory' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {[
                { l:'Total Parts',    v:data.totalParts,             c:'blue',   icon:'📦' },
                { l:'Stock Value',    v:fmtL(data.totalPartsValue),  c:'green',  icon:'💰' },
                { l:'Low Stock (<10)',v:data.lowStockCount,           c:'red',    icon:'⚠️' },
              ].map((k,i)=>(
                <Card key={i} className={`border-l-4 border-${k.c}-500`}>
                  <CardContent className="p-5">
                    <div className="text-2xl mb-1">{k.icon}</div>
                    <div className={`text-2xl font-black text-${k.c}-700`}>{k.v}</div>
                    <div className="text-xs text-gray-500 mt-1">{k.l}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-base">📦 Top Parts by Stock Value</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.topParts||[]} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis dataKey="name" tick={{fontSize:10}} angle={-20} textAnchor="end" height={60}/>
                      <YAxis tick={{fontSize:11}} tickFormatter={v=>fmtL(v).replace('₹','')}/>
                      <Tooltip content={<CustomTooltip/>}/>
                      <Bar dataKey="value" name="Stock Value" fill="#10b981" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-base">📊 Stock Quantity Distribution</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={data.topParts||[]} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="stock" nameKey="name">
                        {(data.topParts||[]).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      </Pie>
                      <Tooltip formatter={(v,n)=>[v+' units',n]}/><Legend wrapperStyle={{fontSize:11}}/>
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            CUSTOMERS TAB
        ════════════════════════════════════════════════════════════════ */}
        {activeTab==='customers' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-l-4 border-blue-500">
                <CardContent className="p-5">
                  <div className="text-2xl font-black text-blue-700">{data.totalCustomers}</div>
                  <div className="text-xs text-gray-500 mt-1">Total Customers</div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-green-500">
                <CardContent className="p-5">
                  <div className="text-2xl font-black text-green-700">{(data.custByMonth||[]).reduce((s,m)=>s+m.count,0)}</div>
                  <div className="text-xs text-gray-500 mt-1">New in {filterYear}</div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">📈 New Customers by Month ({filterYear})</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.custByMonth||[]} barSize={22}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="month" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}} allowDecimals={false}/>
                    <Tooltip content={<CustomTooltip prefix=""/>}/><Legend/>
                    <Bar dataKey="count" name="New Customers" fill="#3b82f6" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            VEHICLES TAB
        ════════════════════════════════════════════════════════════════ */}
        {activeTab==='vehicles' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-l-4 border-blue-500">
                <CardContent className="p-5">
                  <div className="text-2xl font-black text-blue-700">{data.totalVehicles}</div>
                  <div className="text-xs text-gray-500 mt-1">Total Vehicles</div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-purple-500">
                <CardContent className="p-5">
                  <div className="text-2xl font-black text-purple-700">{(data.vehModelChart||[]).length}</div>
                  <div className="text-xs text-gray-500 mt-1">Vehicle Models</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-base">🏍️ Model-wise Count</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.vehModelChart||[]} layout="vertical" barSize={18}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis type="number" tick={{fontSize:11}} allowDecimals={false}/>
                      <YAxis dataKey="name" type="category" tick={{fontSize:10}} width={140}/>
                      <Tooltip content={<CustomTooltip prefix=""/>}/>
                      <Bar dataKey="value" name="Vehicles" fill="#6366f1" radius={[0,4,4,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-base">📊 Sale Status</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={data.vehStatusChart||[]} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" nameKey="name">
                        {(data.vehStatusChart||[]).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      </Pie>
                      <Tooltip formatter={(v,n)=>[v+' vehicles',n]}/><Legend wrapperStyle={{fontSize:11}}/>
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            STAFF TAB
        ════════════════════════════════════════════════════════════════ */}
        {activeTab==='staff' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { l:'Total Staff',     v:data.staffList?.length||0,       c:'blue',   icon:'👥' },
                { l:'आज Present',      v:data.todayPresent,                c:'green',  icon:'✅' },
                { l:'आज Late',         v:data.todayLate,                   c:'orange', icon:'⚡' },
                { l:'Salary Baki',     v:fmtL(Math.max(0,data.staffBalance)), c:'red', icon:'💰' },
              ].map((k,i)=>(
                <Card key={i} className={`bg-${k.c}-50 border border-${k.c}-200`}>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl mb-1">{k.icon}</div>
                    <div className={`text-2xl font-black text-${k.c}-700`}>{k.v}</div>
                    <div className="text-xs text-gray-500">{k.l}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">💰 Staff Salary Chart (इस माह)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.staffPayChart||[]} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="name" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}} tickFormatter={v=>fmtL(v).replace('₹','')}/>
                    <Tooltip content={<CustomTooltip/>}/><Legend/>
                    <Bar dataKey="Net Salary" fill="#6366f1" radius={[4,4,0,0]}/>
                    <Bar dataKey="Paid"        fill="#10b981" radius={[4,4,0,0]}/>
                    <Bar dataKey="Balance"     fill="#f59e0b" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">📋 Staff Detail Report (इस माह)</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-indigo-900 text-white">
                    <tr>{['नाम','पद','Present','Absent','Late','Net Salary','Paid','Balance','Status'].map(h=><th key={h} className="px-3 py-3 text-left text-xs font-bold">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {(data.staffStats||[]).map((s,i)=>(
                      <tr key={i} className={`border-b hover:bg-indigo-50 ${i%2===0?'bg-white':'bg-gray-50/50'}`}>
                        <td className="px-3 py-2.5 font-bold">{s.name}</td>
                        <td className="px-3 py-2.5 text-xs"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{s.position}</span></td>
                        <td className="px-3 py-2.5 text-center text-green-600 font-bold">{s.present}</td>
                        <td className="px-3 py-2.5 text-center text-red-500 font-bold">{s.absent}</td>
                        <td className="px-3 py-2.5 text-center text-orange-500 font-bold">{s.late}</td>
                        <td className="px-3 py-2.5 font-bold text-indigo-700">{fmtINR(s.net)}</td>
                        <td className="px-3 py-2.5 text-green-600">{fmtINR(s.paid)}</td>
                        <td className="px-3 py-2.5 font-bold">{fmtINR(Math.abs(s.balance))}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.balance<=0?'bg-green-100 text-green-700':'bg-orange-100 text-orange-700'}`}>
                            {s.balance<=0?'✅ Clear':'⏳ बकाया'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(data.staffStats||[]).length===0 && <tr><td colSpan="9" className="text-center py-8 text-gray-400">कोई staff नहीं</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="text-center text-gray-400 text-xs py-6 border-t border-gray-200 mt-6">
        VP Honda Reports & Analytics · Auto-refresh every 30s · {lastRefresh.toLocaleString('en-IN')}
      </div>
    </div>
  );
}