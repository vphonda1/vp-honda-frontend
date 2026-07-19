// PaymentTracker.jsx — VP Honda Payment Tracker
// Red Honda theme | Customers linked | EMI + Balance + Udhaari
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IndianRupee, Plus, Search, Phone, MessageCircle, CheckCircle2,
  AlertTriangle, Clock, TrendingUp, ArrowRight, Wallet, X,
  CreditCard, Calendar, ChevronDown, ChevronUp, Trash2, Receipt,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../utils/apiConfig';

const C = {
  primary: '#DC0000', bg: '#020617', surface: '#0f172a', border: '#1e293b',
  text: '#fff', muted: '#94a3b8', success: '#22c55e', warning: '#f59e0b',
  danger: '#ef4444', accent: '#3b82f6', purple: '#a855f7',
};

const fmtINR = (n) => '₹' + Number(n||0).toLocaleString('en-IN');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' }) : '—';
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const sendWA = (phone, msg) => {
  const clean = String(phone||'').replace(/[^0-9]/g,'').slice(-10);
  if (!clean) { alert('Phone number नहीं है'); return; }
  window.open(`https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`, '_blank');
};

export default function PaymentTracker() {
  const navigate = useNavigate();
  const [trackers,   setTrackers]   = useState([]);
  const [customers,  setCustomers]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [view,       setView]       = useState('dashboard'); // dashboard | list | detail | add
  const [selected,   setSelected]   = useState(null);
  const [search,     setSearch]     = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStat, setFilterStat] = useState('all');
  const [form,       setForm]       = useState(null);
  const [payForm,    setPayForm]    = useState({ amount:'', mode:'cash', note:'', date:'' });
  const [toast,      setToast]      = useState('');
  const [saving,     setSaving]     = useState(false);
  const [custSearch, setCustSearch] = useState('');
  const [monthRange, setMonthRange] = useState(6);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, cRes] = await Promise.all([
        fetch(api('/api/payment-tracker')),
        fetch(api('/api/customers')),
      ]);
      if (tRes.ok) setTrackers(await tRes.json());
      if (cRes.ok) setCustomers(await cRes.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Summary stats ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date(); now.setHours(0,0,0,0);
    let totalDue=0, totalPaid=0, overdue=0, overdueAmt=0, completed=0, active=0;
    trackers.forEach(t => {
      const paid = (t.entries||[]).reduce((s,e) => s+(e.amount||0), 0);
      const due  = t.type==='emi' ? (t.emiAmount||0)*(t.totalEmis||0) : (t.pendingAmount||0);
      totalDue  += due; totalPaid += paid;
      if (t.status==='completed') completed++;
      else {
        active++;
        const remaining = due - paid;
        if (remaining > 0) { overdue++; overdueAmt += remaining; }
      }
    });
    return { totalDue, totalPaid, totalRemaining: totalDue-totalPaid, overdue, overdueAmt, completed, active };
  }, [trackers]);

  // ── Monthly collection trend ────────────────────────────────────────────────
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = monthRange-1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      months.push({ key:`${d.getFullYear()}-${d.getMonth()}`, label:`${MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, amount:0 });
    }
    trackers.forEach(t => {
      (t.entries||[]).forEach(e => {
        const d = new Date(e.date);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const m = months.find(x => x.key===key);
        if (m) m.amount += (e.amount||0);
      });
    });
    return months;
  }, [trackers, monthRange]);

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return trackers.filter(t => {
      const q = search.toLowerCase();
      const matchQ = !q || (t.customerName||'').toLowerCase().includes(q) || (t.customerPhone||'').includes(q) || (t.vehicleModel||'').toLowerCase().includes(q) || (t.regNo||'').toLowerCase().includes(q);
      const matchType = filterType==='all' || t.type===filterType;
      const matchStat = filterStat==='all' || t.status===filterStat;
      return matchQ && matchType && matchStat;
    });
  }, [trackers, search, filterType, filterStat]);

  // ── Add payment ─────────────────────────────────────────────────────────────
  const addPayment = async () => {
    if (!payForm.amount || +payForm.amount <= 0) { showToast('❌ Valid amount डालें'); return; }
    setSaving(true);
    try {
      const r = await fetch(api(`/api/payment-tracker/${selected._id}/payment`), {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...payForm, amount: +payForm.amount, date: payForm.date || new Date().toISOString() }),
      });
      if (r.ok) {
        const updated = await r.json();
        setTrackers(prev => prev.map(t => t._id===updated._id ? updated : t));
        setSelected(updated);
        setPayForm({ amount:'', mode:'cash', note:'', date:'' });
        showToast('✅ Payment saved!');
      }
    } catch { showToast('❌ Save failed'); }
    setSaving(false);
  };

  // ── Save new tracker ────────────────────────────────────────────────────────
  const saveTracker = async () => {
    if (!form.customerName) { showToast('❌ Customer name required'); return; }
    setSaving(true);
    try {
      const method = form._id ? 'PATCH' : 'POST';
      const url    = form._id ? api(`/api/payment-tracker/${form._id}`) : api('/api/payment-tracker');
      const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
      if (r.ok) {
        await loadAll();
        showToast(form._id ? '✅ Updated!' : '✅ Tracker created!');
        setView('list');
        setForm(null);
      }
    } catch { showToast('❌ Save failed'); }
    setSaving(false);
  };

  // ── Delete tracker ──────────────────────────────────────────────────────────
  const deleteTracker = async (id) => {
    if (!confirm('Delete this payment tracker?')) return;
    await fetch(api(`/api/payment-tracker/${id}`), { method:'DELETE' });
    setTrackers(prev => prev.filter(t => t._id !== id));
    setView('list');
    showToast('🗑️ Deleted');
  };

  // ── Customer select ─────────────────────────────────────────────────────────
  const selectCustomer = (c) => {
    const phone1 = c.phone || c.mobileNo || '';
    const phone2 = c.alternatePhone || c.alternateMobileNo || c.phone2 || '';
    setForm(prev => ({
      ...prev,
      customerId:    c._id || c.id || '',
      customerName:  c.name || c.customerName || '',
      customerPhone: phone2 ? `${phone1}/ ${phone2}` : phone1,
      altPhone:      phone2,
      aadharNo:      c.aadhar || c.aadharNo || '',
      vehicleModel:  c.vehicleModel || '',
      regNo:         c.regNo || '',
      chassisNo:     c.chassisNo || '',
    }));
    setCustSearch('');
  };

  const emptyForm = () => ({
    customerName:'', customerPhone:'', altPhone:'', aadharNo:'',
    vehicleModel:'', regNo:'', chassisNo:'', vehiclePrice:0,
    downPayment:0, financeAmount:0, financer:'', loanAccountNo:'',
    emiAmount:0, totalEmis:0, startDate:'', pendingAmount:0,
    type:'balance', status:'active', notes:'',
  });

  const typeLabel = (t) => t==='emi'?'🔄 EMI':t==='udhaari'?'📒 उधारी':'💳 Balance Due';
  const statusColor = (s) => s==='completed'?C.success:s==='defaulted'?C.danger:C.warning;

  if (loading) return <div style={{ padding:60, color:C.muted, textAlign:'center', background:C.bg, minHeight:'100vh' }}>⏳ Loading Payment Tracker...</div>;

  return (
    <div style={{ background:C.bg, minHeight:'100vh', color:C.text, paddingBottom:80 }}>

      {/* Toast */}
      {toast && <div style={{ position:'fixed', top:16, right:16, zIndex:999, background:'#1e293b', border:`1px solid ${C.success}`, color:C.success, padding:'10px 18px', borderRadius:10, fontWeight:700, fontSize:13 }}>{toast}</div>}

      {/* ── Header ── */}
      <header style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ background:`linear-gradient(135deg,${C.primary},#991b1b)`, width:38, height:38, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>💰</div>
          <div>
            <div style={{ fontSize:16, fontWeight:800 }}>Payment Tracker</div>
            <div style={{ fontSize:10, color:C.muted }}>VP Honda, Bhopal</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {['dashboard','list'].map(v => (
            <button key={v} onClick={()=>setView(v)} style={{ background:view===v?C.primary:'transparent', color:view===v?'#fff':C.muted, border:'none', padding:'6px 12px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>
              {v==='dashboard'?'📊 Dashboard':'📋 All'}
            </button>
          ))}
          <button onClick={()=>{ setForm(emptyForm()); setView('add'); }} style={{ background:C.success, color:'#fff', border:'none', padding:'6px 14px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
            <Plus size={14}/>New
          </button>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════
          DASHBOARD VIEW
      ════════════════════════════════════════════════════════════ */}
      {view==='dashboard' && (
        <div style={{ padding:'20px 20px', maxWidth:1200, margin:'0 auto' }}>

          {/* Summary Cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:20 }}>
            <SCard icon={<Wallet size={16}/>} label="Total Paid" value={fmtINR(stats.totalPaid)} color={C.success}/>
            <SCard icon={<Clock size={16}/>} label="Total Remaining" value={fmtINR(stats.totalRemaining)} color={C.warning}/>
            <SCard icon={<AlertTriangle size={16}/>} label="Pending Cases" value={stats.overdue} sub={fmtINR(stats.overdueAmt)} color={C.danger}/>
            <SCard icon={<CheckCircle2 size={16}/>} label="Completed" value={stats.completed} sub={`${stats.active} active`} color={C.accent}/>
            <SCard icon={<IndianRupee size={16}/>} label="Total Tracked" value={fmtINR(stats.totalDue)} color={C.purple}/>
          </div>

          {/* Monthly Chart */}
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:16, marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h3 style={{ margin:0, fontSize:14, fontWeight:700 }}>📈 Monthly Collection</h3>
              <select value={monthRange} onChange={e=>setMonthRange(+e.target.value)} style={{ background:C.bg, color:C.text, border:`1px solid ${C.border}`, borderRadius:6, padding:'4px 8px', fontSize:11 }}>
                <option value={3}>3 Months</option>
                <option value={6}>6 Months</option>
                <option value={12}>12 Months</option>
              </select>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                <XAxis dataKey="label" stroke={C.muted} fontSize={11}/>
                <YAxis stroke={C.muted} fontSize={11} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/>
                <Tooltip contentStyle={{ background:C.surface, border:`1px solid ${C.border}`, fontSize:12 }} formatter={v=>fmtINR(v)}/>
                <Bar dataKey="amount" name="Received" fill={C.primary} radius={[6,6,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pending list */}
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h3 style={{ margin:0, fontSize:14, fontWeight:700 }}>⚠️ Pending Payments</h3>
              <button onClick={()=>setView('list')} style={{ background:'none', border:'none', color:C.primary, fontSize:11, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                सब देखें <ArrowRight size={12}/>
              </button>
            </div>
            {trackers.filter(t=>t.status!=='completed').slice(0,8).map(t => {
              const paid = (t.entries||[]).reduce((s,e)=>s+(e.amount||0),0);
              const due  = t.type==='emi'?(t.emiAmount||0)*(t.totalEmis||0):(t.pendingAmount||0);
              return (
                <div key={t._id} onClick={()=>{ setSelected(t); setView('detail'); }} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${C.border}`, cursor:'pointer' }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13 }}>{t.customerName}</div>
                    <div style={{ fontSize:11, color:C.muted }}>🏍️ {t.vehicleModel||'—'} · {typeLabel(t.type)}</div>
                    <div style={{ fontSize:10, color:C.muted }}>📞 {t.customerPhone||'—'}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ color:C.danger, fontWeight:800, fontSize:14 }}>{fmtINR(due-paid)}</div>
                    <div style={{ fontSize:10, color:C.muted }}>of {fmtINR(due)}</div>
                    <div style={{ fontSize:9, background:`${statusColor(t.status)}22`, color:statusColor(t.status), padding:'2px 6px', borderRadius:4, marginTop:2 }}>{t.status}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          LIST VIEW
      ════════════════════════════════════════════════════════════ */}
      {view==='list' && (
        <div style={{ padding:'16px 20px', maxWidth:1200, margin:'0 auto' }}>
          {/* Filters */}
          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:200, display:'flex', alignItems:'center', gap:8, background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 12px' }}>
              <Search size={14} style={{ color:C.muted }}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="नाम, phone, vehicle..." style={{ background:'transparent', border:'none', outline:'none', color:C.text, fontSize:13, width:'100%' }}/>
            </div>
            <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{ background:C.surface, color:C.text, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 12px', fontSize:12 }}>
              <option value="all">सब Type</option>
              <option value="emi">🔄 EMI</option>
              <option value="balance">💳 Balance</option>
              <option value="udhaari">📒 उधारी</option>
            </select>
            <select value={filterStat} onChange={e=>setFilterStat(e.target.value)} style={{ background:C.surface, color:C.text, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 12px', fontSize:12 }}>
              <option value="all">सब Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="defaulted">Defaulted</option>
            </select>
          </div>

          <div style={{ fontSize:11, color:C.muted, marginBottom:10 }}>{filtered.length} records</div>

          {filtered.map(t => {
            const paid = (t.entries||[]).reduce((s,e)=>s+(e.amount||0),0);
            const due  = t.type==='emi'?(t.emiAmount||0)*(t.totalEmis||0):(t.pendingAmount||0);
            const pct  = due>0 ? Math.round(paid/due*100) : 0;
            return (
              <div key={t._id} onClick={()=>{ setSelected(t); setView('detail'); }} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:14, marginBottom:8, cursor:'pointer' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.primary}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:800, fontSize:14, marginBottom:2 }}>{t.customerName}</div>
                    <div style={{ fontSize:11, color:C.muted }}>🏍️ {t.vehicleModel||'—'} · 📋 {t.regNo||'—'} · {typeLabel(t.type)}</div>
                    <div style={{ fontSize:11, color:C.muted }}>📞 {t.customerPhone||'—'}</div>
                  </div>
                  <div style={{ textAlign:'right', minWidth:120 }}>
                    <div style={{ color:t.status==='completed'?C.success:C.danger, fontWeight:800, fontSize:15 }}>{fmtINR(due-paid)}</div>
                    <div style={{ fontSize:10, color:C.muted }}>Paid: {fmtINR(paid)} / {fmtINR(due)}</div>
                    <div style={{ fontSize:9, background:`${statusColor(t.status)}22`, color:statusColor(t.status), padding:'2px 8px', borderRadius:4, marginTop:4, display:'inline-block' }}>{t.status}</div>
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ marginTop:8, height:4, background:C.bg, borderRadius:2, overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`, height:'100%', background:pct>=100?C.success:pct>=50?C.warning:C.danger, borderRadius:2, transition:'width 0.3s' }}/>
                </div>
                <div style={{ fontSize:9, color:C.muted, marginTop:2, textAlign:'right' }}>{pct}% paid</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          DETAIL VIEW
      ════════════════════════════════════════════════════════════ */}
      {view==='detail' && selected && (() => {
        const t    = selected;
        const paid = (t.entries||[]).reduce((s,e)=>s+(e.amount||0),0);
        const due  = t.type==='emi'?(t.emiAmount||0)*(t.totalEmis||0):(t.pendingAmount||0);
        const rem  = Math.max(0, due-paid);
        const pct  = due>0 ? Math.round(paid/due*100) : 0;
        return (
          <div style={{ padding:'16px 20px', maxWidth:800, margin:'0 auto' }}>
            <button onClick={()=>setView('list')} style={{ background:C.surface, border:'none', color:C.muted, padding:'6px 12px', borderRadius:6, cursor:'pointer', fontSize:11, marginBottom:14 }}>← वापस</button>

            {/* Info Card */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:16, marginBottom:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <h2 style={{ margin:'0 0 4px', fontSize:18, fontWeight:800 }}>{t.customerName}</h2>
                  <div style={{ fontSize:12, color:C.muted }}>🏍️ {t.vehicleModel} · {t.regNo}</div>
                  <div style={{ display:'flex', gap:10, marginTop:6, flexWrap:'wrap' }}>
                    <a href={`tel:${(t.customerPhone||'').replace(/[^0-9]/g,'').slice(-10)}`} style={{ display:'flex', alignItems:'center', gap:4, color:C.success, fontSize:11, textDecoration:'none' }}><Phone size={12}/>{t.customerPhone||'—'}</a>
                    <button onClick={()=>sendWA(t.customerPhone, `नमस्ते ${t.customerName} जी 🙏\n\nVP Honda से आपको reminder है।\nकुल बकाया: ${fmtINR(rem)}\n\nकृपया जल्द payment करें।\n📞 9713394738`)}
                      style={{ display:'flex', alignItems:'center', gap:4, background:'#16a34a22', border:'1px solid #16a34a', color:C.success, padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:11 }}>
                      <MessageCircle size={12}/>WhatsApp
                    </button>
                    <button onClick={()=>{ setForm({...t}); setView('add'); }} style={{ display:'flex', alignItems:'center', gap:4, background:C.border, border:'none', color:C.muted, padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:11 }}>Edit</button>
                    <button onClick={()=>deleteTracker(t._id)} style={{ display:'flex', alignItems:'center', gap:4, background:'#7f1d1d22', border:`1px solid ${C.danger}`, color:C.danger, padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:11 }}><Trash2 size={11}/>Delete</button>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:10, color:C.muted }}>Type</div>
                  <div style={{ fontWeight:700, color:C.accent }}>{typeLabel(t.type)}</div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>Status</div>
                  <div style={{ fontSize:12, fontWeight:700, color:statusColor(t.status) }}>{t.status}</div>
                </div>
              </div>

              {/* Amount summary */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginTop:14 }}>
                <div style={{ background:C.bg, borderRadius:8, padding:10, textAlign:'center' }}>
                  <div style={{ fontSize:10, color:C.muted }}>Total Due</div>
                  <div style={{ fontSize:18, fontWeight:800, color:C.text }}>{fmtINR(due)}</div>
                </div>
                <div style={{ background:C.bg, borderRadius:8, padding:10, textAlign:'center' }}>
                  <div style={{ fontSize:10, color:C.muted }}>Total Paid</div>
                  <div style={{ fontSize:18, fontWeight:800, color:C.success }}>{fmtINR(paid)}</div>
                </div>
                <div style={{ background:C.bg, borderRadius:8, padding:10, textAlign:'center' }}>
                  <div style={{ fontSize:10, color:C.muted }}>Remaining</div>
                  <div style={{ fontSize:18, fontWeight:800, color:rem>0?C.danger:C.success }}>{fmtINR(rem)}</div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ marginTop:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:C.muted, marginBottom:4 }}>
                  <span>Payment Progress</span><span>{pct}%</span>
                </div>
                <div style={{ height:8, background:C.bg, borderRadius:4, overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`, height:'100%', background:pct>=100?C.success:pct>=50?C.warning:C.danger, borderRadius:4, transition:'width 0.5s' }}/>
                </div>
              </div>

              {/* EMI info */}
              {t.type==='emi' && (
                <div style={{ marginTop:10, fontSize:11, color:C.muted, display:'flex', gap:16, flexWrap:'wrap' }}>
                  <span>💳 EMI: {fmtINR(t.emiAmount)}/mo</span>
                  <span>📆 Tenure: {t.paidEmis||0}/{t.totalEmis} paid</span>
                  {t.financer && <span>🏦 {t.financer}</span>}
                  {t.loanAccountNo && <span>🔢 {t.loanAccountNo}</span>}
                  {t.startDate && <span>📅 Start: {fmtDate(t.startDate)}</span>}
                </div>
              )}
            </div>

            {/* Add Payment Form */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:16, marginBottom:14 }}>
              <h3 style={{ margin:'0 0 12px', fontSize:14, fontWeight:700 }}>💸 Payment Add करें</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <input type="number" placeholder="Amount ₹" value={payForm.amount} onChange={e=>setPayForm(p=>({...p,amount:e.target.value}))} style={inputSt}/>
                <input type="date" value={payForm.date} onChange={e=>setPayForm(p=>({...p,date:e.target.value}))} style={inputSt}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <select value={payForm.mode} onChange={e=>setPayForm(p=>({...p,mode:e.target.value}))} style={inputSt}>
                  <option value="cash">💵 Cash</option>
                  <option value="upi">📱 UPI</option>
                  <option value="cheque">📝 Cheque</option>
                  <option value="neft">🏦 NEFT/Transfer</option>
                  <option value="other">Other</option>
                </select>
                <input placeholder="Note (optional)" value={payForm.note} onChange={e=>setPayForm(p=>({...p,note:e.target.value}))} style={inputSt}/>
              </div>
              <button onClick={addPayment} disabled={saving} style={{ background:C.success, color:'#fff', border:'none', padding:'10px 20px', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer', opacity:saving?0.6:1 }}>
                {saving?'Saving...':'✅ Payment Save करें'}
              </button>
            </div>

            {/* Payment History */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:16 }}>
              <h3 style={{ margin:'0 0 12px', fontSize:14, fontWeight:700 }}>📋 Payment History ({(t.entries||[]).length})</h3>
              {(t.entries||[]).length===0 ? (
                <div style={{ color:C.muted, textAlign:'center', padding:20, fontSize:12 }}>अभी तक कोई payment नहीं</div>
              ) : (
                [...(t.entries||[])].reverse().map((e, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${C.border}` }}>
                    <div>
                      <div style={{ fontWeight:700, color:C.success, fontSize:14 }}>{fmtINR(e.amount)}</div>
                      <div style={{ fontSize:11, color:C.muted }}>{fmtDate(e.date)} · {e.mode?.toUpperCase()}</div>
                      {e.note && <div style={{ fontSize:10, color:C.muted }}>📝 {e.note}</div>}
                      {e.receivedBy && <div style={{ fontSize:10, color:C.muted }}>👤 {e.receivedBy}</div>}
                    </div>
                    <button onClick={async ()=>{ await fetch(api(`/api/payment-tracker/${t._id}/payment/${e._id}`),{method:'DELETE'}); loadAll(); setView('list'); }} style={{ background:'none', border:'none', color:C.danger, cursor:'pointer', padding:4 }}><Trash2 size={14}/></button>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })()}

      {/* ════════════════════════════════════════════════════════════
          ADD / EDIT VIEW
      ════════════════════════════════════════════════════════════ */}
      {view==='add' && form && (
        <div style={{ padding:'16px 20px', maxWidth:700, margin:'0 auto' }}>
          <button onClick={()=>{ setView('list'); setForm(null); }} style={{ background:C.surface, border:'none', color:C.muted, padding:'6px 12px', borderRadius:6, cursor:'pointer', fontSize:11, marginBottom:14 }}>← Cancel</button>
          <h2 style={{ margin:'0 0 14px', fontSize:16, fontWeight:800 }}>{form._id?'✏️ Edit':'➕ New'} Payment Tracker</h2>

          {/* Customer search */}
          {!form._id && (
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:14, marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>🔍 Customer से link करें (optional)</div>
              <input value={custSearch} onChange={e=>setCustSearch(e.target.value)} placeholder="Customer name / phone search..." style={inputSt}/>
              {custSearch.length>1 && (
                <div style={{ marginTop:6, maxHeight:160, overflowY:'auto', background:C.bg, borderRadius:8, border:`1px solid ${C.border}` }}>
                  {customers.filter(c=>(c.name||c.customerName||'').toLowerCase().includes(custSearch.toLowerCase())||(c.phone||c.mobileNo||'').includes(custSearch)).slice(0,8).map(c=>(
                    <div key={c._id||c.id} onClick={()=>selectCustomer(c)} style={{ padding:'8px 12px', cursor:'pointer', borderBottom:`1px solid ${C.border}`, fontSize:12 }}
                      onMouseEnter={e=>e.currentTarget.style.background=C.surface}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div style={{ fontWeight:700 }}>{c.name||c.customerName}</div>
                      <div style={{ fontSize:10, color:C.muted }}>📞 {c.phone||c.mobileNo} · {c.vehicleModel||'—'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Form fields */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div><label style={lblSt}>Customer Name *</label><input value={form.customerName} onChange={e=>setForm(p=>({...p,customerName:e.target.value}))} style={inputSt} placeholder="Full name"/></div>
            <div><label style={lblSt}>Phone</label><input value={form.customerPhone} onChange={e=>setForm(p=>({...p,customerPhone:e.target.value}))} style={inputSt} placeholder="Mobile"/></div>
            <div><label style={lblSt}>Vehicle Model</label><input value={form.vehicleModel} onChange={e=>setForm(p=>({...p,vehicleModel:e.target.value}))} style={inputSt} placeholder="e.g. Shine 125"/></div>
            <div><label style={lblSt}>Reg No</label><input value={form.regNo} onChange={e=>setForm(p=>({...p,regNo:e.target.value}))} style={inputSt} placeholder="MP04YX1234"/></div>
          </div>

          <div style={{ marginBottom:10 }}>
            <label style={lblSt}>Payment Type</label>
            <div style={{ display:'flex', gap:8 }}>
              {['balance','emi','udhaari'].map(t=>(
                <button key={t} onClick={()=>setForm(p=>({...p,type:t}))} style={{ flex:1, padding:'8px', borderRadius:8, border:`1px solid ${form.type===t?C.primary:C.border}`, background:form.type===t?`${C.primary}22`:'transparent', color:form.type===t?C.primary:C.muted, cursor:'pointer', fontSize:11, fontWeight:700 }}>
                  {typeLabel(t)}
                </button>
              ))}
            </div>
          </div>

          {form.type==='emi' ? (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div><label style={lblSt}>Vehicle Price ₹</label><input type="number" value={form.vehiclePrice} onChange={e=>setForm(p=>({...p,vehiclePrice:+e.target.value,financeAmount:(+e.target.value-(p.downPayment||0))}))} style={inputSt}/></div>
                <div><label style={lblSt}>Down Payment ₹</label><input type="number" value={form.downPayment} onChange={e=>setForm(p=>({...p,downPayment:+e.target.value,financeAmount:((p.vehiclePrice||0)-+e.target.value)}))} style={inputSt}/></div>
                <div><label style={lblSt}>Finance Amount ₹</label><input type="number" value={form.financeAmount} onChange={e=>setForm(p=>({...p,financeAmount:+e.target.value}))} style={inputSt}/></div>
                <div><label style={lblSt}>EMI Amount ₹/month</label><input type="number" value={form.emiAmount} onChange={e=>setForm(p=>({...p,emiAmount:+e.target.value}))} style={inputSt}/></div>
                <div><label style={lblSt}>Total EMIs (months)</label><input type="number" value={form.totalEmis} onChange={e=>setForm(p=>({...p,totalEmis:+e.target.value}))} style={inputSt}/></div>
                <div><label style={lblSt}>EMI Start Date</label><input type="date" value={form.startDate} onChange={e=>setForm(p=>({...p,startDate:e.target.value}))} style={inputSt}/></div>
                <div><label style={lblSt}>Financer (Bank)</label><input value={form.financer} onChange={e=>setForm(p=>({...p,financer:e.target.value}))} style={inputSt} placeholder="HDFC, Axis..."/></div>
                <div><label style={lblSt}>Loan Account No</label><input value={form.loanAccountNo} onChange={e=>setForm(p=>({...p,loanAccountNo:e.target.value}))} style={inputSt}/></div>
              </div>
            </>
          ) : (
            <div style={{ marginBottom:10 }}>
              <label style={lblSt}>Pending Amount ₹</label>
              <input type="number" value={form.pendingAmount} onChange={e=>setForm(p=>({...p,pendingAmount:+e.target.value}))} style={inputSt} placeholder="Total amount due"/>
            </div>
          )}

          <div style={{ marginBottom:14 }}>
            <label style={lblSt}>Notes</label>
            <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} style={{ ...inputSt, minHeight:60, resize:'vertical' }} placeholder="Extra details..."/>
          </div>

          <button onClick={saveTracker} disabled={saving} style={{ width:'100%', background:C.primary, color:'#fff', border:'none', padding:'12px', borderRadius:8, fontWeight:800, fontSize:14, cursor:'pointer', opacity:saving?0.6:1 }}>
            {saving?'Saving...':(form._id?'✅ Update करें':'✅ Tracker Create करें')}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SCard({ icon, label, value, sub, color }) {
  return (
    <div style={{ background:'#0f172a', border:`1px solid #1e293b`, borderLeft:`4px solid ${color}`, borderRadius:10, padding:14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color, marginBottom:4 }}>{icon} {label}</div>
      <div style={{ fontSize:20, fontWeight:800, color }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

const inputSt = { width:'100%', background:'#020617', border:'1px solid #1e293b', color:'#fff', borderRadius:8, padding:'9px 12px', fontSize:12, outline:'none', boxSizing:'border-box' };
const lblSt   = { display:'block', fontSize:10, color:'#94a3b8', marginBottom:4, fontWeight:600 };
