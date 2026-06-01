// ═══════════════════════════════════════════════════════════════════════════
// 🏍️ Dashboard.jsx — VP Honda Dealership Dashboard (Redesigned)
// Desktop-optimized | Red Honda theme | Auto-refresh | Charts
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home, Users, Bike, FileText, MessageSquare, LayoutDashboard,
  Shield, Car, Wrench, IndianRupee, AlertCircle, Package,
  TrendingUp, Bell, Plus, RefreshCw, ChevronRight, Calendar,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../utils/apiConfig';
import ReminderPushButton from '../components/ReminderPushButton';

const COLORS = {
  primary:'#DC0000', accent:'#0ea5e9', warning:'#f59e0b', danger:'#ef4444',
  success:'#16a34a', purple:'#a855f7', cyan:'#06b6d4',
  bg:'#020617', surface:'#0f172a', border:'#1e293b', text:'#fff', muted:'#94a3b8',
};
const MODELS_COLORS = ['#DC0000', '#0ea5e9', '#a855f7', '#f59e0b', '#16a34a', '#06b6d4'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(new Date().getMonth());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [parts, setParts] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [reminders, setReminders] = useState([]);

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      // ✅ FIX: सिर्फ existing endpoints (404 वाले हटाए)
      const endpoints = ['customers', 'invoices', 'parts', 'salaries', 'reminders'];
      const results = await Promise.all(endpoints.map(e =>
        fetch(api(`/api/${e}`)).then(r => r.ok ? r.json() : []).catch(() => [])
      ));
      const [custs, invs, prts, sals, rems] = results;
      setCustomers(custs || []);
      setInvoices(invs || []);
      setParts(prts || []);
      setSalaries(sals || []);
      setReminders(rems || []);
      // Vehicles और Jobs को customer/invoice data से derive करते हैं
      // (VP Honda में अलग endpoint नहीं है)
      setVehicles(custs ? custs.filter(c => c.chassisNo) : []);
      setJobs(rems ? rems.filter(r => r.type === 'service' || r.type === 'job') : []);
    } catch {}
    setLoading(false); setRefreshing(false);
  };

  useEffect(() => {
    fetchAll();
    const id = setInterval(() => fetchAll(true), 30000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const inPeriod = (d) => d && new Date(d).getFullYear() === year && new Date(d).getMonth() === month;
    const periodInvoices = invoices.filter(i => inPeriod(i.invoiceDate || i.date));
    const totalRevenue = periodInvoices.reduce((s, i) => s + (i.price || i.amount || 0), 0);
    const periodSalaries = salaries.filter(s => inPeriod(s.month || s.paidDate));
    const totalSalary = periodSalaries.reduce((s, x) => s + (x.amount || 0), 0);
    const pendingRTO = customers.filter(c => !c.registrationNo || c.rtoStatus === 'pending').length;
    const pendingInsurance = customers.filter(c => {
      if (!c.insuranceDate) return true;
      return new Date(c.insuranceDate) < new Date();
    }).length;
    return {
      totalCustomers: customers.length,
      vehiclesSold: periodInvoices.length,
      // ✅ "In Stock" — vehicles जिनकी invoice नहीं है (बेची नहीं गई)
      inStock: vehicles.filter(v => !invoices.some(i => i.chassisNo === v.chassisNo)).length,
      totalRevenue, pendingRTO, pendingInsurance,
      pendingJobs: jobs.filter(j => j.status !== 'completed').length,
      lowStock: parts.filter(p => (p.stock || 0) < (p.minStock || 5)).length,
      salaryPaid: totalSalary,
    };
  }, [customers, vehicles, invoices, jobs, parts, salaries, year, month]);

  const monthlyRevenue = useMemo(() => MONTHS.map((m, idx) => {
    const monthInvoices = invoices.filter(i => {
      const d = new Date(i.invoiceDate || i.date || 0);
      return d.getFullYear() === year && d.getMonth() === idx;
    });
    const revenue = monthInvoices.reduce((s, i) => s + (i.price || i.amount || 0), 0);
    return { month: m, revenue: Math.round(revenue / 1000) };
  }), [invoices, year]);

  const topModels = useMemo(() => {
    const counts = {};
    invoices.filter(i => new Date(i.invoiceDate || i.date || 0).getFullYear() === year).forEach(i => {
      const model = i.vehicleModel || 'Unknown';
      counts[model] = (counts[model] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 6);
  }, [invoices, year]);

  const upcomingReminders = useMemo(() => {
    const today = new Date(); const week = new Date(); week.setDate(week.getDate() + 7);
    return reminders.filter(r => {
      if (!r.dueDate) return false;
      const d = new Date(r.dueDate);
      return d >= today && d <= week;
    }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 5);
  }, [reminders]);

  if (loading) return (
    <div style={{ padding:60, color:COLORS.text, background:COLORS.bg, minHeight:'100vh', textAlign:'center' }}>
      <Bike size={48} style={{ color:COLORS.primary, marginBottom:16 }}/>
      <div style={{ fontSize:18, fontWeight:600 }}>Loading VP Honda dashboard...</div>
    </div>
  );

  return (
    <div style={{ background:COLORS.bg, minHeight:'100vh', color:COLORS.text }}>
      <header style={{ background:COLORS.surface, borderBottom:`1px solid ${COLORS.border}`, padding:'14px 28px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:50, flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ background:`linear-gradient(135deg, ${COLORS.primary}, #991b1b)`, width:42, height:42, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>🏍️</div>
          <div>
            <div style={{ fontSize:18, fontWeight:800 }}>VP Honda</div>
            <div style={{ fontSize:11, color:COLORS.muted }}>
              {user?.name || 'Admin'}
              <span style={{ background:COLORS.primary, color:'#fff', padding:'2px 8px', borderRadius:4, marginLeft:6, fontSize:9, fontWeight:700 }}>
                {user?.role?.toUpperCase() || 'ADMIN'}
              </span>
            </div>
          </div>
        </div>
        <nav style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {[
            { icon:Home,            label:'Home',       path:'/' },
            { icon:Users,           label:'Customers',  path:'/customer-management' },
            { icon:Bike,            label:'Vehicles',   path:'/veh-dashboard' },
            { icon:FileText,        label:'Invoices',   path:'/invoice-management' },
            { icon:MessageSquare,   label:'Chat',       path:'/chat' },
            { icon:LayoutDashboard, label:'Dashboard',  path:'/dashboard', active:true },
          ].map(({ icon:Icon, label, path, active }) => (
            <button key={path} onClick={() => navigate(path)} style={{
              background: active ? COLORS.primary : 'transparent',
              color: active ? '#fff' : COLORS.muted,
              border:'none', padding:'8px 14px', borderRadius:8, cursor:'pointer',
              display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600,
            }}><Icon size={16}/>{label}</button>
          ))}
        </nav>
      </header>

      <main style={{ padding:'24px 28px', maxWidth:1400, margin:'0 auto' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ fontSize:24, fontWeight:800, margin:0 }}>Dashboard</h1>
            <p style={{ color:COLORS.muted, fontSize:12, margin:'4px 0 0', display:'flex', alignItems:'center', gap:6 }}>
              VP Honda, Bhopal • Auto-refresh every 30s
              {refreshing && <RefreshCw size={12} style={{ animation:'spin 1s linear infinite' }}/>}
            </p>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <select value={year} onChange={e => setYear(+e.target.value)} style={selectStyle}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={month} onChange={e => setMonth(+e.target.value)} style={selectStyle}>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <button onClick={() => fetchAll()} style={{ ...selectStyle, padding:'8px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
              <RefreshCw size={14}/>Refresh
            </button>
          </div>
        </div>

        <div style={{ background:`linear-gradient(90deg, ${COLORS.primary}22, #991b1b22)`, border:`1px solid ${COLORS.primary}55`, borderRadius:10, padding:'10px 16px', marginBottom:20, overflow:'hidden', whiteSpace:'nowrap' }}>
          <div style={{ display:'inline-block', animation:'marquee 30s linear infinite', fontSize:13, fontWeight:600 }}>
            🏍️ VP Honda — Trusted Honda Dealership!  •  🛡️ Authorized service & genuine parts  •  📋 RTO & Insurance support  •  🎁 5 Free Services included  •  📞 9713394738  •  
            🏍️ VP Honda — Trusted Honda Dealership!  •  🛡️ Authorized service & genuine parts  •  📋 RTO & Insurance support  •  🎁 5 Free Services included  •  📞 9713394738  •  
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:14, marginBottom:24 }}>
          <StatCard icon={Users}        label="Total Customers"   value={stats.totalCustomers}                              color={COLORS.primary}  onClick={() => navigate('/customer-management')}/>
          <StatCard icon={Bike}         label="Vehicles Sold"     value={stats.vehiclesSold}                                color={COLORS.accent}   onClick={() => navigate('/invoice-management')}/>
          <StatCard icon={Package}      label="In Stock"          value={stats.inStock}                                     color={COLORS.warning}  onClick={() => navigate('/veh-dashboard')}/>
          <StatCard icon={IndianRupee}  label="Total Revenue"     value={`₹${stats.totalRevenue.toLocaleString('en-IN')}`} color={COLORS.success}  onClick={() => navigate('/invoice-management')}/>
          <StatCard icon={Car}          label="Pending RTO"       value={stats.pendingRTO}                                  color={COLORS.warning}  onClick={() => navigate('/customer-management')}/>
          <StatCard icon={Shield}       label="Pending Insurance" value={stats.pendingInsurance}                            color={COLORS.cyan}     onClick={() => navigate('/customer-management')}/>
          <StatCard icon={Wrench}       label="Pending Jobs"      value={stats.pendingJobs}                                 color={COLORS.danger}   onClick={() => navigate('/jobcard')}/>
          <StatCard icon={AlertCircle}  label="Low Stock Parts"   value={stats.lowStock}                                    color={COLORS.purple}   onClick={() => navigate('/parts')}/>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:14, marginBottom:24 }}>
          <div style={cardStyle}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <h3 style={{ margin:0, fontSize:15, fontWeight:700 }}><TrendingUp size={16} style={{ marginRight:6, verticalAlign:'middle', color:COLORS.primary }}/>Monthly Revenue ({year})</h3>
              <span style={{ fontSize:11, color:COLORS.muted }}>in thousands ₹</span>
            </div>
            {monthlyRevenue.some(d => d.revenue > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border}/>
                  <XAxis dataKey="month" stroke={COLORS.muted} fontSize={11}/>
                  <YAxis stroke={COLORS.muted} fontSize={11}/>
                  <Tooltip contentStyle={{ background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:8 }}/>
                  <Bar dataKey="revenue" fill={COLORS.primary} radius={[6, 6, 0, 0]}/>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState text="No data yet"/>}
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin:'0 0 12px', fontSize:15, fontWeight:700 }}>🏍️ Top Selling Models</h3>
            {topModels.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={topModels} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name.slice(0, 8)}>
                    {topModels.map((_, i) => <Cell key={i} fill={MODELS_COLORS[i % MODELS_COLORS.length]}/>)}
                  </Pie>
                  <Tooltip contentStyle={{ background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:8 }}/>
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyState text="No data yet"/>}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:14 }}>
          <div style={cardStyle}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <h3 style={{ margin:0, fontSize:15, fontWeight:700 }}><Bell size={16} style={{ marginRight:6, verticalAlign:'middle', color:COLORS.warning }}/>Upcoming Reminders</h3>
              <button onClick={() => navigate('/reminders')} style={linkBtnStyle}>View all →</button>
            </div>
            {upcomingReminders.length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {upcomingReminders.map(r => (
                  <div key={r._id || r.id} style={{ background:COLORS.bg, padding:'10px 12px', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:13 }}>{r.title || r.type}</div>
                      <div style={{ fontSize:11, color:COLORS.muted }}>{r.customerName || ''}</div>
                    </div>
                    <div style={{ fontSize:11, color:COLORS.warning, fontWeight:600 }}>
                      <Calendar size={11} style={{ verticalAlign:'middle', marginRight:4 }}/>
                      {new Date(r.dueDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState text="No upcoming reminders"/>}
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin:'0 0 12px', fontSize:15, fontWeight:700 }}>⚡ Quick Actions</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <QuickBtn icon={Plus}          label="New Customer" onClick={() => navigate('/new-customer')}        color={COLORS.primary}/>
              <QuickBtn icon={FileText}      label="New Invoice"  onClick={() => navigate('/invoice-management')}  color={COLORS.accent}/>
              <QuickBtn icon={Wrench}        label="Job Card"     onClick={() => navigate('/jobcard')}             color={COLORS.warning}/>
              <QuickBtn icon={FileText}      label="Quotation"    onClick={() => navigate('/quotations')}          color={COLORS.purple}/>
              <QuickBtn icon={Bell}          label="Reminder"     onClick={() => navigate('/reminders')}           color={COLORS.cyan}/>
              <QuickBtn icon={MessageSquare} label="Team Chat"    onClick={() => navigate('/chat')}                color={COLORS.danger}/>
            </div>
          </div>
        </div>

        <div style={{ textAlign:'center', padding:'24px 0 12px', color:COLORS.muted, fontSize:11 }}>
          🏍️ VP Honda, Bhopal · GSTIN: 23BCYPD9538B1ZG · 📞 9713394738
        </div>

      </main>

      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes spin    { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function StatCard({ icon:Icon, label, value, color, onClick }) {
  return (
    <div onClick={onClick} style={{ background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:16, cursor:'pointer', transition:'all 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = color}
      onMouseLeave={e => e.currentTarget.style.borderColor = COLORS.border}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <div style={{ background:`${color}22`, padding:8, borderRadius:8 }}>
          <Icon size={18} style={{ color }}/>
        </div>
        <button style={{ background:'none', border:'none', color:COLORS.muted, fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:2 }}>
          View<ChevronRight size={12}/>
        </button>
      </div>
      <div style={{ fontSize:24, fontWeight:800, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:11, color:COLORS.muted, marginTop:6 }}>{label}</div>
    </div>
  );
}

function QuickBtn({ icon:Icon, label, onClick, color }) {
  return (
    <button onClick={onClick} style={{ background:COLORS.bg, border:`1px solid ${COLORS.border}`, color:COLORS.text, padding:'12px 10px', borderRadius:8, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:6, fontSize:11, fontWeight:600, transition:'all 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = `${color}11`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.background = COLORS.bg; }}>
      <Icon size={16} style={{ color }}/>{label}
    </button>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ padding:40, textAlign:'center', color:COLORS.muted, fontSize:12 }}>
      <div style={{ fontSize:32, marginBottom:8, opacity:0.3 }}>📊</div>
      {text}
    </div>
  );
}

const cardStyle = { background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:18 };
const selectStyle = { background:COLORS.surface, color:COLORS.text, border:`1px solid ${COLORS.border}`, borderRadius:8, padding:'8px 12px', fontSize:13, fontWeight:600, outline:'none' };
const linkBtnStyle = { background:'none', border:'none', color:COLORS.primary, fontSize:11, fontWeight:700, cursor:'pointer' };
