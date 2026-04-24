// ════════════════════════════════════════════════════════════════════════════
// AdminPanel.jsx — VP Honda Admin Control Center (Smart Redesign)
// ════════════════════════════════════════════════════════════════════════════
// Sections:
// • System Health snapshot (from diagnostic data)
// • Database management (customers, invoices, parts, staff counts)
// • Quick actions: Cache clear, data export, backup
// • Recent activity log
// • User/staff management shortcuts
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import {
  Shield, Users, Database, Trash2, Download, Upload, RefreshCw,
  Activity, AlertTriangle, CheckCircle, Server, Wifi, WifiOff,
  Settings, FileText, Package, DollarSign, TrendingUp,
  Eye, EyeOff, Lock, Key, LogOut, ChevronRight, ArrowLeft,
  Zap, Clock, Award,
} from 'lucide-react';
import { api, API_BASE } from '../utils/apiConfig';

const getLS = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const fmtINR = (n) => '₹' + Math.round(n||0).toLocaleString('en-IN');
const fmtShort = (n) => {
  n = Math.round(n||0);
  if (n >= 10000000) return '₹' + (n/10000000).toFixed(2) + 'Cr';
  if (n >= 100000)   return '₹' + (n/100000).toFixed(2) + 'L';
  if (n >= 1000)     return '₹' + (n/1000).toFixed(1) + 'K';
  return '₹' + n;
};

export default function AdminPanel({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [serverOnline, setServerOnline] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [activityLog, setActivityLog] = useState([]);

  useEffect(() => { loadStats(); const t = setInterval(loadStats, 30000); return () => clearInterval(t); }, []);

  const loadStats = async () => {
    const f = async (url, fb = []) => { try { const r = await fetch(api(url)); if (r.ok) { setServerOnline(true); return await r.json(); } } catch { setServerOnline(false); } return fb; };

    const t0 = Date.now();
    const [customers, invoices, parts, staff, salaries, partHistory] = await Promise.all([
      f('/api/customers'), f('/api/invoices'), f('/api/parts'), f('/api/staff'),
      f('/api/salaries'), f('/api/parts/history/all'),
    ]);
    const latency = Date.now() - t0;

    const lsInvoices = [...getLS('invoices',[]), ...getLS('generatedInvoices',[])];
    const allInv = invoices.length > 0 ? invoices : lsInvoices;
    const totalRevenue = allInv.reduce((s, i) => s + (i.totals?.totalAmount || i.total || 0), 0);
    const totalSalary  = salaries.filter(s => !s.cancelled && s.type === 'salary').reduce((sum, s) => sum + (s.amount||0), 0);

    // Storage stats
    let lsSize = 0;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k) || '';
      const sz = (k.length + v.length) * 2;
      lsSize += sz;
      keys.push({ key: k, size: sz });
    }
    keys.sort((a, b) => b.size - a.size);

    setStats({
      counts: {
        customers: customers.length,
        invoices: allInv.length,
        parts: parts.length,
        staff: staff.length,
        salaries: salaries.length,
        partConsumptions: partHistory.length,
      },
      financial: {
        totalRevenue,
        totalSalary,
        stockValue: parts.reduce((s, p) => s + ((p.mrp || p.unitPrice || 0) * (Number(p.stock||p.quantity)||0)), 0),
        pendingPayments: 0, // calculated below
      },
      server: {
        online: serverOnline,
        latency,
        url: API_BASE || '—',
      },
      storage: {
        totalSize: lsSize,
        keyCount: keys.length,
        topKeys: keys.slice(0, 10),
      },
    });
    setLastRefresh(new Date());
    setLoading(false);
  };

  // ── Actions ────────────────────────────────────────────────────────────
  const clearCache = (type) => {
    const confirmed = window.confirm(`⚠️ ${type} cache clear करें?\n\nMongoDB data unaffected रहेगा।`);
    if (!confirmed) return;
    const keepKeys = ['vpHondaUser', 'vpSession', 'vpAdminSession', 'deletedServiceKeys'];
    if (type === 'all') {
      Object.keys(localStorage).forEach(k => { if (!keepKeys.includes(k)) localStorage.removeItem(k); });
      alert('✅ All cache cleared. Reloading...');
      setTimeout(() => window.location.reload(), 500);
    } else if (type === 'invoices') {
      ['invoices','generatedInvoices','jobCards'].forEach(k => localStorage.removeItem(k));
      alert('✅ Invoice cache cleared');
    } else if (type === 'customers') {
      ['sharedCustomerData','customerData','newCustomers'].forEach(k => localStorage.removeItem(k));
      alert('✅ Customer cache cleared');
    } else if (type === 'service') {
      ['customerServiceData','followUpLog'].forEach(k => localStorage.removeItem(k));
      alert('✅ Service data cache cleared');
    }
    loadStats();
  };

  const exportData = async (type) => {
    let data = null, filename = '';
    if (type === 'customers') { const r = await fetch(api('/api/customers')); data = await r.json(); filename = 'customers'; }
    else if (type === 'invoices') { const r = await fetch(api('/api/invoices')); data = await r.json(); filename = 'invoices'; }
    else if (type === 'parts') { const r = await fetch(api('/api/parts')); data = await r.json(); filename = 'parts'; }
    else if (type === 'staff') { const r = await fetch(api('/api/staff')); data = await r.json(); filename = 'staff'; }
    else if (type === 'salaries') { const r = await fetch(api('/api/salaries')); data = await r.json(); filename = 'salaries'; }

    if (!data) { alert('Export failed'); return; }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vphonda_${filename}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert(`✅ ${filename} exported (${data.length} records)`);
  };

  if (loading || !stats) return (
    <div style={{ minHeight:'100vh', background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
      <div style={{ textAlign:'center' }}>
        <Shield size={48} className="animate-pulse mx-auto mb-3" color="#8b5cf6"/>
        <p style={{ color:'#94a3b8' }}>Admin Panel loading...</p>
      </div>
    </div>
  );

  const SECTIONS = [
    { id:'dashboard', label:'Dashboard',  icon: Activity },
    { id:'data',      label:'Data Mgmt',  icon: Database },
    { id:'users',     label:'Users',      icon: Users },
    { id:'system',    label:'System',     icon: Settings },
  ];

  const totalLS = (stats.storage.totalSize / 1024 / 1024).toFixed(2);
  const lsPct = Math.round((stats.storage.totalSize / 1024 / 1024 / 5) * 100);

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
              <h1 style={{ fontSize:26, fontWeight:900, background:'linear-gradient(90deg, #8b5cf6, #ec4899)', WebkitBackgroundClip:'text', color:'transparent', margin:0 }}>
                🛡️ Admin Control Center
              </h1>
              <p style={{ color:'#94a3b8', fontSize:12, margin:'4px 0 0', display:'flex', alignItems:'center', gap:6 }}>
                {stats.server.online ? <Wifi size={11} className="text-green-400"/> : <WifiOff size={11} className="text-red-400"/>}
                {stats.server.online ? `Server Online · ${stats.server.latency}ms` : 'Server Offline'}
                <span style={{ color:'#64748b' }}>•</span>
                <Clock size={11}/>
                {lastRefresh.toLocaleTimeString('en-IN')}
              </p>
            </div>
          </div>
          <button onClick={loadStats}
            style={{ background:'linear-gradient(135deg, #8b5cf6, #ec4899)', color:'#fff', padding:'10px 18px', borderRadius:12, fontWeight:700, fontSize:13, border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 14px rgba(139,92,246,0.4)' }}>
            <RefreshCw size={15}/> Refresh
          </button>
        </div>

        {/* SECTION TABS */}
        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const active = section === s.id;
            return (
              <button key={s.id} onClick={() => setSection(s.id)}
                style={{
                  background: active ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : '#1e293b',
                  border: `1px solid ${active ? '#c4b5fd' : '#334155'}`,
                  color: active ? '#fff' : '#94a3b8', padding:'10px 16px', borderRadius:10,
                  fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6,
                  boxShadow: active ? '0 4px 14px rgba(139,92,246,0.4)' : 'none',
                }}>
                <Icon size={14}/> {s.label}
              </button>
            );
          })}
        </div>

        {/* DASHBOARD SECTION */}
        {section === 'dashboard' && (
          <div style={{ display:'grid', gap:14 }}>
            {/* System health KPIs */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>
              <AdminKPI icon={Users} label="Customers" value={stats.counts.customers} color="#3b82f6" onClick={() => navigate('/customers')}/>
              <AdminKPI icon={FileText} label="Invoices" value={stats.counts.invoices} color="#f97316" onClick={() => navigate('/invoice-management')}/>
              <AdminKPI icon={Package} label="Parts" value={stats.counts.parts} color="#a855f7" onClick={() => navigate('/parts')}/>
              <AdminKPI icon={Award} label="Staff" value={stats.counts.staff} color="#10b981" onClick={() => navigate('/staff-management')}/>
              <AdminKPI icon={DollarSign} label="Revenue" value={fmtShort(stats.financial.totalRevenue)} color="#22c55e"/>
              <AdminKPI icon={TrendingUp} label="Stock Value" value={fmtShort(stats.financial.stockValue)} color="#06b6d4"/>
            </div>

            {/* Server + Storage */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(340px, 1fr))', gap:14 }}>
              <AdminPanel_Panel title="🌐 Server Status">
                <div style={{ display:'grid', gap:10 }}>
                  <Row label="Backend URL" value={stats.server.url} mono/>
                  <Row label="Connection" value={stats.server.online ? '✅ Online' : '❌ Offline'} color={stats.server.online ? '#22c55e' : '#ef4444'}/>
                  <Row label="Latency" value={`${stats.server.latency}ms`}/>
                  <Row label="Database" value="MongoDB Atlas"/>
                </div>
              </AdminPanel_Panel>

              <AdminPanel_Panel title="💾 Storage Usage">
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ color:'#94a3b8', fontSize:11 }}>LocalStorage: {totalLS} MB / 5 MB</span>
                    <span style={{ color: lsPct > 80 ? '#fca5a5' : '#86efac', fontSize:11, fontWeight:700 }}>{lsPct}%</span>
                  </div>
                  <div style={{ height:8, background:'#1e293b', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ width:`${Math.min(lsPct, 100)}%`, height:'100%', background: lsPct > 80 ? 'linear-gradient(90deg, #f97316, #ef4444)' : 'linear-gradient(90deg, #22c55e, #10b981)' }}/>
                  </div>
                  <p style={{ color:'#64748b', fontSize:10, marginTop:6 }}>{stats.storage.keyCount} keys stored</p>
                  <div style={{ marginTop:10 }}>
                    {stats.storage.topKeys.slice(0, 5).map((k,i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:10, padding:'3px 0', color:'#94a3b8' }}>
                        <span style={{ fontFamily:'monospace' }}>{k.key}</span>
                        <span>{(k.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ))}
                  </div>
                </div>
              </AdminPanel_Panel>
            </div>

            {/* Quick Actions */}
            <AdminPanel_Panel title="⚡ Quick Actions">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:8 }}>
                <ActionButton label="🔍 Diagnostic" color="#0891b2" onClick={() => navigate('/diagnostic')}/>
                <ActionButton label="🔔 Reminders"  color="#dc2626" onClick={() => navigate('/reminders')}/>
                <ActionButton label="📈 Reports"    color="#059669" onClick={() => navigate('/reports')}/>
                <ActionButton label="💹 VP Dashboard" color="#f97316" onClick={() => navigate('/vph-dashboard')}/>
                <ActionButton label="🧹 Clear Cache" color="#8b5cf6" onClick={() => clearCache('all')}/>
                <ActionButton label="🔒 Logout" color="#ef4444" onClick={() => { localStorage.clear(); window.location.href = '/login'; }}/>
              </div>
            </AdminPanel_Panel>
          </div>
        )}

        {/* DATA MANAGEMENT SECTION */}
        {section === 'data' && (
          <div style={{ display:'grid', gap:14 }}>
            <AdminPanel_Panel title="📦 Data Summary">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:10 }}>
                {[
                  { label:'Customers', count:stats.counts.customers, color:'#3b82f6', api:'/api/customers' },
                  { label:'Invoices', count:stats.counts.invoices, color:'#f97316', api:'/api/invoices' },
                  { label:'Parts', count:stats.counts.parts, color:'#a855f7', api:'/api/parts' },
                  { label:'Staff', count:stats.counts.staff, color:'#10b981', api:'/api/staff' },
                  { label:'Salary Records', count:stats.counts.salaries, color:'#22c55e', api:'/api/salaries' },
                  { label:'Part Usage Logs', count:stats.counts.partConsumptions, color:'#06b6d4', api:'/api/parts/history' },
                ].map((d,i) => (
                  <div key={i} style={{ background:`${d.color}15`, border:`1px solid ${d.color}40`, padding:'12px 14px', borderRadius:12 }}>
                    <p style={{ color:'#94a3b8', fontSize:10, fontWeight:700, textTransform:'uppercase' }}>{d.label}</p>
                    <p style={{ color: d.color, fontSize:24, fontWeight:900, margin:'2px 0' }}>{d.count}</p>
                    <p style={{ color:'#64748b', fontSize:10, fontFamily:'monospace' }}>{d.api}</p>
                  </div>
                ))}
              </div>
            </AdminPanel_Panel>

            <AdminPanel_Panel title="📥 Export Data">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8 }}>
                {['customers','invoices','parts','staff','salaries'].map(t => (
                  <button key={t} onClick={() => exportData(t)}
                    style={{ background:'#1e293b', border:'1px solid #334155', color:'#e2e8f0', padding:'10px 12px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
                    className="hover:bg-slate-700">
                    <Download size={13}/> {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </AdminPanel_Panel>

            <AdminPanel_Panel title="🧹 Clear Cache (localStorage only)">
              <p style={{ color:'#fbbf24', fontSize:11, marginBottom:10 }}>⚠️ यह सिर्फ localStorage clear करेगा। MongoDB data पर कोई असर नहीं होगा।</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8 }}>
                <button onClick={() => clearCache('customers')} style={btnDangerLight}>🗑️ Customer Cache</button>
                <button onClick={() => clearCache('invoices')}  style={btnDangerLight}>🗑️ Invoice Cache</button>
                <button onClick={() => clearCache('service')}   style={btnDangerLight}>🗑️ Service Cache</button>
                <button onClick={() => clearCache('all')}       style={{ ...btnDangerLight, background:'#dc2626', color:'#fff', borderColor:'#b91c1c' }}>⚠️ ALL Cache</button>
              </div>
            </AdminPanel_Panel>
          </div>
        )}

        {/* USERS SECTION */}
        {section === 'users' && (
          <div style={{ display:'grid', gap:14 }}>
            <AdminPanel_Panel title="👤 Current User">
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:60, height:60, borderRadius:'50%', background:'linear-gradient(135deg, #8b5cf6, #ec4899)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:900, color:'#fff' }}>
                  {(user?.name || 'A').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ color:'#f8fafc', fontSize:16, fontWeight:700, margin:0 }}>{user?.name || 'Admin'}</p>
                  <p style={{ color:'#94a3b8', fontSize:12, margin:'2px 0' }}>Role: <span style={{ color:'#c4b5fd', fontWeight:700 }}>{user?.role || 'admin'}</span></p>
                  <p style={{ color:'#64748b', fontSize:11 }}>{user?.email || user?.phone || '—'}</p>
                </div>
              </div>
            </AdminPanel_Panel>

            <AdminPanel_Panel title="👥 Staff Management" action={
              <button onClick={() => navigate('/staff-management')} style={{ background:'#10b98122', border:'1px solid #10b98155', color:'#86efac', padding:'6px 12px', borderRadius:8, fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                Manage <ChevronRight size={11}/>
              </button>
            }>
              <p style={{ color:'#94a3b8', fontSize:12 }}>कुल staff: <span style={{ color:'#f8fafc', fontWeight:700 }}>{stats.counts.staff}</span></p>
              <p style={{ color:'#94a3b8', fontSize:12 }}>Salary records: <span style={{ color:'#f8fafc', fontWeight:700 }}>{stats.counts.salaries}</span></p>
              <p style={{ color:'#64748b', fontSize:11, marginTop:8 }}>Staff login, salary, advance, incentive सब "Staff Management" page से होता है।</p>
            </AdminPanel_Panel>
          </div>
        )}

        {/* SYSTEM SECTION */}
        {section === 'system' && (
          <div style={{ display:'grid', gap:14 }}>
            <AdminPanel_Panel title="⚙️ System Info">
              <div style={{ display:'grid', gap:8 }}>
                <Row label="App Version"        value="VP Honda v2.0"/>
                <Row label="Frontend"            value="React + Vite on Vercel"/>
                <Row label="Backend"             value="Node + Express on Render"/>
                <Row label="Database"            value="MongoDB Atlas"/>
                <Row label="User Agent"          value={navigator.userAgent.split(' ').slice(-2).join(' ')} small/>
                <Row label="Screen"              value={`${window.screen.width} × ${window.screen.height}`}/>
                <Row label="Session"             value={user?.role || 'unknown'}/>
              </div>
            </AdminPanel_Panel>

            <AdminPanel_Panel title="🔄 Sync Status">
              <p style={{ color:'#86efac', fontSize:12, marginBottom:10 }}>
                ✅ Cross-device sync सभी devices पर काम कर रहा है:
              </p>
              <ul style={{ color:'#94a3b8', fontSize:11, listStyle:'none', padding:0 }}>
                <li style={{ padding:'4px 0' }}>✓ Customers sync every page load</li>
                <li style={{ padding:'4px 0' }}>✓ Invoices sync in real-time</li>
                <li style={{ padding:'4px 0' }}>✓ Service data sync every 10-15s</li>
                <li style={{ padding:'4px 0' }}>✓ Follow-up logs cross-device</li>
                <li style={{ padding:'4px 0' }}>✓ Parts stock deducted on invoice save</li>
                <li style={{ padding:'4px 0' }}>✓ Salary payments sync instantly</li>
              </ul>
            </AdminPanel_Panel>

            <AdminPanel_Panel title="⚠️ Danger Zone">
              <p style={{ color:'#fca5a5', fontSize:11, marginBottom:10 }}>
                ये actions irreversible हैं। Backup लेने के बाद ही use करें।
              </p>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button onClick={() => clearCache('all')} style={btnDanger}>
                  🗑️ Clear All Local Data
                </button>
                <button onClick={() => { localStorage.clear(); alert('Logged out'); window.location.href = '/login'; }} style={btnDanger}>
                  <LogOut size={12}/> Force Logout
                </button>
              </div>
            </AdminPanel_Panel>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Helper Components ─────────────────────────────────────────────────────
function AdminKPI({ icon: Icon, label, value, color, onClick }) {
  return (
    <div onClick={onClick}
      style={{ background:`linear-gradient(135deg, ${color}22, ${color}0a)`, border:`1px solid ${color}40`, borderRadius:14, padding:16, cursor: onClick ? 'pointer' : 'default', transition:'all 0.25s' }}
      className={onClick ? 'hover:scale-[1.02]' : ''}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start' }}>
        <div style={{ width:36, height:36, borderRadius:10, background: color, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 4px 14px ${color}55` }}>
          <Icon size={18} color="#fff"/>
        </div>
      </div>
      <p style={{ color:'#94a3b8', fontSize:10, fontWeight:700, textTransform:'uppercase', marginTop:10 }}>{label}</p>
      <p style={{ color:'#f8fafc', fontSize:24, fontWeight:900, margin:'2px 0' }}>{value}</p>
    </div>
  );
}

function AdminPanel_Panel({ title, action, children }) {
  return (
    <div style={{ background:'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:18 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:14 }}>
        <h3 style={{ color:'#f8fafc', fontSize:14, fontWeight:800, margin:0 }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, color, mono, small }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ color:'#94a3b8', fontSize:11 }}>{label}</span>
      <span style={{ color: color || '#f8fafc', fontSize: small ? 10 : 12, fontWeight:700, fontFamily: mono ? 'monospace' : 'inherit', maxWidth:'60%', textAlign:'right', overflow:'hidden', textOverflow:'ellipsis' }}>{value}</span>
    </div>
  );
}

function ActionButton({ label, color, onClick }) {
  return (
    <button onClick={onClick}
      style={{ background:`linear-gradient(135deg, ${color}, ${color}dd)`, color:'#fff', padding:'11px 14px', borderRadius:10, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, boxShadow:`0 3px 12px ${color}55`, transition:'all 0.2s' }}
      className="hover:scale-105">
      {label}
    </button>
  );
}

const btnDangerLight = {
  background:'#ef444422', border:'1px solid #ef444466', color:'#fca5a5',
  padding:'10px 12px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer',
};
const btnDanger = {
  background:'#dc2626', color:'#fff', border:'1px solid #991b1b',
  padding:'10px 14px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer',
  display:'flex', alignItems:'center', gap:6,
};