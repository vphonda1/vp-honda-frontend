import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, RefreshCw, Clock, Phone, PhoneCall, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '../utils/apiConfig';

const getLS = (key, fb = []) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const greet = () => { const h = new Date().getHours(); return h < 12 ? '🌅 Good Morning' : h < 17 ? '☀️ Good Afternoon' : '🌙 Good Evening'; };

export default function RemindersPage() {
  const navigate = useNavigate();
  const [reminders, setReminders]     = useState([]);
  const [filterType, setFilterType]   = useState('all');
  const [searchTerm, setSearchTerm]   = useState('');
  const [loading, setLoading]         = useState(true);
  const [debugInfo, setDebugInfo]     = useState({});
  const [invoices, setInvoices]       = useState([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 5;
  const [followUps, setFollowUps]     = useState(getLS('followUpLog', {}));
  const [expandedId, setExpandedId]   = useState(null);
  const [tickerPause, setTickerPause] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    loadReminders();
    const fn = () => loadReminders();
    window.addEventListener('storage', fn);
    intervalRef.current = setInterval(fn, 30000);
    return () => { window.removeEventListener('storage', fn); clearInterval(intervalRef.current); };
  }, []);

  const loadReminders = async () => {
    try {
      let allCustomers = [];
      try { const res = await fetch(api('/api/customers')); if (res.ok) allCustomers = await res.json(); } catch {}
      const invoicesData = getLS('invoices');
      let serviceData = getLS('customerServiceData', {});
      
      // Ensure serviceData uses regNo as key (convert if old format)
      const newServiceData = {};
      Object.entries(serviceData).forEach(([key, val]) => {
        const regKey = val.regNo || key;
        if (!newServiceData[regKey]) newServiceData[regKey] = val;
        else Object.assign(newServiceData[regKey], val);
        if (regKey !== key) newServiceData[regKey]._oldKey = key;
      });
      serviceData = newServiceData;

      const all = [];
      let dbg = { totalCustomers: allCustomers.length, totalInvoices: invoicesData.length, withData: Object.keys(serviceData).length, payment: 0, insurance: 0, service: 0 };

      // Helper: get customer details from allCustomers by regNo
      const getCustomerByReg = (reg) => allCustomers.find(c => (c.registrationNo || c.regNo || '').toUpperCase() === reg.toUpperCase());

      Object.entries(serviceData).forEach(([regNo, data]) => {
        if (!regNo || regNo === 'no_reg_') return;
        const cust = getCustomerByReg(regNo);
        const nm = data.customerName || cust?.customerName || cust?.name || 'Unknown';
        const ph = data.phone || cust?.phone || '';
        const vh = data.vehicle || cust?.vehicleModel || '';
        const rg = regNo;
        const today = new Date(); today.setHours(0,0,0,0);

        // ---- Payment reminder (if any pending amount) ----
        const pend = parseFloat(data.pendingAmount || 0);
        if (pend > 0 && !data.paymentReceivedDate) {
          let dr = 999, dd = new Date();
          if (data.paymentDueDate) { dd = new Date(data.paymentDueDate); dd.setHours(0,0,0,0); dr = Math.floor((dd-today)/86400000); }
          dbg.payment++;
          all.push({ id:`pay-${regNo}`, type:'payment', customerId:regNo, customerName:nm, customerPhone:ph, vehicle:vh, regNo:rg, title:'💳 Payment Due', description:`बकाया: ₹${pend.toLocaleString('en-IN')}`, daysRemaining:dr, status:dr<=3?'critical':'warning', dueDate:dd, amount:pend });
        }

        // ---- Insurance reminder (if insurance date present) ----
        if (data.insuranceDate && !data.rtoDoneDate) {
          const ins = new Date(data.insuranceDate); ins.setHours(0,0,0,0);
          const rto = new Date(ins.getTime()+7*864e5); const dr = Math.floor((rto-today)/864e5);
          if (dr >= 0 && dr <= 7) { dbg.insurance++; all.push({ id:`ins-${regNo}`, type:'insurance', customerId:regNo, customerName:nm, customerPhone:ph, vehicle:vh, regNo:rg, title:'🚗 RTO Pending', description:`Insurance: ${data.insuranceDate} | Deadline: ${rto.toLocaleDateString('en-IN')}`, daysRemaining:dr, status:dr<=1?'critical':'warning', dueDate:rto }); }
        }

        // ---- Service reminders based on purchaseDate or previous service dates ----
        // 1st service from purchase date (if no firstServiceDate)
        if (data.purchaseDate && !data.firstServiceDate) {
          const purchaseDate = new Date(data.purchaseDate); purchaseDate.setHours(0,0,0,0);
          const due30 = new Date(purchaseDate.getTime() + 30*864e5);
          const dr = Math.floor((due30 - today)/864e5);
          if (dr >= -30) {
            dbg.service++;
            all.push({ id:`svc-1st-${regNo}`, type:'service', serviceType:'1st', customerId:regNo, customerName:nm, customerPhone:ph, vehicle:vh, regNo:rg, title:'🔧 1st Service Due', description:`Purchase: ${purchaseDate.toLocaleDateString('en-IN')} | Due: ${due30.toLocaleDateString('en-IN')}`, daysRemaining:dr, status:dr<=0?'critical':'warning', dueDate:due30 });
          }
        }
        // Subsequent services
        const serviceMap = [
          { done:'firstServiceDate', next:'2nd', days:120 },
          { done:'secondServiceDate', next:'3rd', days:120 },
          { done:'thirdServiceDate', next:'4th', days:120 },
          { done:'fourthServiceDate', next:'5th', days:120 }
        ];
        for (let i=0; i<serviceMap.length; i++) {
          const svc = serviceMap[i];
          const doneDate = data[svc.done];
          if (doneDate && !data[svc.next.replace('th','')+'ServiceDate']) {
            const prevDate = new Date(doneDate); prevDate.setHours(0,0,0,0);
            const due = new Date(prevDate.getTime() + svc.days*864e5);
            const dr = Math.floor((due - today)/864e5);
            if (dr >= -30) {
              dbg.service++;
              all.push({ id:`svc-${svc.next}-${regNo}`, type:'service', serviceType:svc.next, customerId:regNo, customerName:nm, customerPhone:ph, vehicle:vh, regNo:rg, title:`🔧 ${svc.next} Service Due`, description:`Previous: ${prevDate.toLocaleDateString('en-IN')} | Due: ${due.toLocaleDateString('en-IN')}`, daysRemaining:dr, status:dr<=0?'critical':'warning', dueDate:due });
              break; // only next pending
            }
          }
        }
      });

      all.sort((a, b) => { if (a.status !== b.status) return a.status === 'critical' ? -1 : 1; return a.daysRemaining - b.daysRemaining; });
      setReminders(all); setDebugInfo(dbg); setLastRefresh(new Date()); setLoading(false);
    } catch (e) { console.error(e); setLoading(false); }
  };

  const logFollowUp = (id, name, phone) => {
    const note = prompt(`📞 ${name} (${phone})\n\nCall notes:`);
    if (note === null) return;
    const u = { ...followUps }; if (!u[id]) u[id] = [];
    u[id].push({ date: new Date().toISOString(), note: note || 'Called', by: 'Admin' });
    setFollowUps(u); localStorage.setItem('followUpLog', JSON.stringify(u));
  };

  const markDone = (r) => {
    const km = prompt(`${r.customerName} — ${r.serviceType} Service Done?\n\nKM भरें:`);
    if (km === null) return;
    const sd = getLS('customerServiceData', {});
    const key = r.regNo;
    if (!sd[key]) sd[key] = {};
    const d = new Date().toISOString().split('T')[0];
    const map = {'1st':'firstService','2nd':'secondService','3rd':'thirdService','4th':'fourthService','5th':'fifthService'};
    const mkey = map[r.serviceType];
    if (mkey) { sd[key][mkey+'Date'] = d; sd[key][mkey+'Km'] = km; }
    localStorage.setItem('customerServiceData', JSON.stringify(sd));
    window.dispatchEvent(new Event('storage'));
    alert(`✅ ${r.serviceType} Service done! KM: ${km}`);
    loadReminders();
  };

  const filtered = reminders.filter(r => {
    if (filterType === 'service-1' && r.serviceType !== '1st') return false;
    if (filterType === 'service-2' && r.serviceType !== '2nd') return false;
    if (filterType === 'service-3' && r.serviceType !== '3rd') return false;
    if (filterType === 'service' && r.type !== 'service') return false;
    if (filterType !== 'all' && !filterType.startsWith('service') && r.type !== filterType) return false;
    if (searchTerm) { const s = searchTerm.toLowerCase(); return [r.customerName,r.customerPhone,r.vehicle,r.regNo].some(v => (v||'').toLowerCase().includes(s)); }
    return true;
  });
  const pages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((currentPage-1)*PER_PAGE, currentPage*PER_PAGE);
  const todayCritical = reminders.filter(r => r.status === 'critical' && r.daysRemaining <= 0);
  const todayUpcoming = reminders.filter(r => r.daysRemaining > 0 && r.daysRemaining <= 3);

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto"/>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {todayCritical.length > 0 && (
        <div className="bg-gradient-to-r from-red-700 to-red-600 text-white overflow-hidden"
          onMouseEnter={() => setTickerPause(true)} onMouseLeave={() => setTickerPause(false)}>
          <div className="flex items-center h-9">
            <span className="bg-red-900 px-3 py-1 text-xs font-black flex-shrink-0 flex items-center gap-1"><AlertTriangle size={12}/> URGENT</span>
            <div className="overflow-hidden flex-1">
              <div className={`flex gap-8 whitespace-nowrap ${tickerPause ? '' : 'animate-marquee'}`} style={{ animation: tickerPause ? 'none' : 'marquee 30s linear infinite' }}>
                {todayCritical.map((r,i) => (
                  <span key={i} className="text-xs font-medium inline-flex items-center gap-2">
                    🚨 {r.customerName} — {r.title} — {r.vehicle} ({r.regNo}) — {Math.abs(r.daysRemaining)} दिन overdue
                    {r.customerPhone && <span className="opacity-60">📞 {r.customerPhone}</span>}
                    <span className="text-red-300">|</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }`}</style>
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div><h1 className="text-2xl font-black text-white flex items-center gap-2"><Bell size={22}/> Reminders</h1><p className="text-slate-400 text-xs mt-0.5">{greet()} · <Clock size={10} className="inline"/> {lastRefresh.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</p></div>
          <Button onClick={() => { setLoading(true); setTimeout(loadReminders, 200); }} className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-3 text-xs"><RefreshCw size={13} className="mr-1"/> Refresh</Button>
        </div>

        {/* Priority Cards */}
        <Card className="bg-gradient-to-r from-slate-800 to-slate-700 border-0 shadow-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3"><div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"/><span className="text-white text-sm font-bold">📋 Today's Priority — {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short',year:'numeric'})}</span></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-red-500/20 rounded-lg p-3 border border-red-500/30"><p className="text-red-300 text-[10px] font-bold uppercase tracking-wider">Overdue</p><p className="text-red-400 font-black text-3xl">{todayCritical.length}</p><p className="text-red-400/60 text-[10px]">तुरंत action लें</p></div>
              <div className="bg-yellow-500/20 rounded-lg p-3 border border-yellow-500/30"><p className="text-yellow-300 text-[10px] font-bold uppercase tracking-wider">Next 3 Days</p><p className="text-yellow-400 font-black text-3xl">{todayUpcoming.length}</p><p className="text-yellow-400/60 text-[10px]">जल्द due होंगे</p></div>
              <div className="bg-blue-500/20 rounded-lg p-3 border border-blue-500/30"><p className="text-blue-300 text-[10px] font-bold uppercase tracking-wider">Today's Calls</p><p className="text-blue-400 font-black text-3xl">{Object.values(followUps).reduce((s, arr) => s + arr.filter(f => f.date?.startsWith(new Date().toISOString().split('T')[0])).length, 0)}</p><p className="text-blue-400/60 text-[10px]">calls किए आज</p></div>
              <div className="bg-green-500/20 rounded-lg p-3 border border-green-500/30"><p className="text-green-300 text-[10px] font-bold uppercase tracking-wider">Total Active</p><p className="text-green-400 font-black text-3xl">{reminders.length}</p><p className="text-green-400/60 text-[10px]">pending reminders</p></div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <Button onClick={() => navigate('/customer-data-manager')} className="bg-purple-600/80 hover:bg-purple-600 text-white font-bold py-2.5 text-xs">📊 Data Manager</Button>
          <Button onClick={() => navigate('/diagnostic')} className="bg-cyan-600/80 hover:bg-cyan-600 text-white font-bold py-2.5 text-xs">🔍 Diagnostic</Button>
          <Button onClick={() => navigate('/invoice-management')} className="bg-orange-600/80 hover:bg-orange-600 text-white font-bold py-2.5 text-xs">📁 Invoices</Button>
        </div>

        {/* Stats Bar */}
        <div className="flex flex-wrap gap-3 text-[11px] text-slate-400 bg-slate-800/50 rounded-lg px-3 py-2">
          <span><b className="text-blue-400">{debugInfo.totalCustomers}</b> Customers</span>
          <span><b className="text-purple-400">{debugInfo.totalInvoices}</b> Invoices</span>
          <span><b className="text-green-400">{debugInfo.withData}</b> Service Data</span>
          <span><b className="text-yellow-400">{debugInfo.payment}</b> Payment</span>
          <span><b className="text-orange-400">{debugInfo.service}</b> Service</span>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 flex-wrap">
          {[
            { t:'all', l:`All ${reminders.length}`, bg:'bg-blue-600' },
            { t:'payment', l:`💳 ${reminders.filter(r=>r.type==='payment').length}`, bg:'bg-green-600' },
            { t:'insurance', l:`🚗 ${reminders.filter(r=>r.type==='insurance').length}`, bg:'bg-purple-600' },
            { t:'service', l:`🔧 ${reminders.filter(r=>r.type==='service').length}`, bg:'bg-orange-600' },
            { t:'service-1', l:`1st ${reminders.filter(r=>r.serviceType==='1st').length}`, bg:'bg-cyan-600' },
            { t:'service-2', l:`2nd ${reminders.filter(r=>r.serviceType==='2nd').length}`, bg:'bg-yellow-600' },
            { t:'service-3', l:`3rd ${reminders.filter(r=>r.serviceType==='3rd').length}`, bg:'bg-red-600' },
          ].map(f => (
            <button key={f.t} onClick={() => { setFilterType(f.t); setCurrentPage(1); }}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition ${
                filterType===f.t ? `${f.bg} text-white shadow-lg` : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}>{f.l}</button>
          ))}
        </div>

        {/* Search */}
        <Input value={searchTerm} onChange={e=>{setSearchTerm(e.target.value);setCurrentPage(1);}} placeholder="🔍 Search customer, phone, vehicle..." className="bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 h-8 text-xs rounded-lg"/>

        {/* Reminders List */}
        {filtered.length === 0 ? (
          <div className="text-center py-16"><CheckCircle size={48} className="text-green-500 mx-auto mb-3"/><p className="text-slate-400 font-bold">सब clear! कोई pending reminder नहीं।</p></div>
        ) : (<>
          <p className="text-slate-600 text-[10px]">{filtered.length} results · Page {currentPage}/{pages||1}</p>
          <div className="space-y-2.5">
            {paginated.map(r => {
              const fups = followUps[r.id] || [];
              const isExp = expandedId === r.id;
              const isCrit = r.status === 'critical';
              return (
                <div key={r.id} className={`rounded-xl overflow-hidden transition-all ${isCrit ? 'bg-gradient-to-r from-red-950/80 to-slate-800 ring-1 ring-red-500/30' : 'bg-gradient-to-r from-yellow-950/50 to-slate-800 ring-1 ring-yellow-500/20'}`}>
                  <div className="p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${isCrit?'bg-red-600 text-white':'bg-yellow-600 text-white'}`}>{isCrit ? 'CRITICAL' : 'WARNING'}</span>
                        {r.serviceType && <span className="text-[9px] bg-blue-600/60 text-blue-200 px-2 py-0.5 rounded-full font-bold">{r.serviceType}</span>}
                        {r.type === 'payment' && <span className="text-[9px] bg-green-600/60 text-green-200 px-2 py-0.5 rounded-full font-bold">Payment</span>}
                      </div>
                      <span className={`text-xs font-black ${r.daysRemaining<0?'text-red-400':r.daysRemaining===0?'text-red-300 animate-pulse':'text-yellow-400'}`}>{r.daysRemaining < 0 ? `${Math.abs(r.daysRemaining)}d OVERDUE` : r.daysRemaining === 0 ? '⚡ TODAY' : `${r.daysRemaining}d left`}</span>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-sm">{r.title}</h3>
                        <p className="text-slate-400 text-[11px] mt-0.5">{r.description}</p>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span className="text-cyan-300 text-xs font-bold">👤 {r.customerName}</span>
                          {r.customerPhone && <span className="text-slate-400 text-xs">📞 {r.customerPhone}</span>}
                          {r.vehicle && <span className="text-blue-300 text-xs">🏍️ {r.vehicle}</span>}
                          {r.regNo && <span className="text-slate-500 text-[10px] font-mono">{r.regNo}</span>}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-500">📅 {r.dueDate instanceof Date ? r.dueDate.toLocaleDateString('en-IN') : r.dueDate}{r.amount > 0 && <span className="ml-2 text-green-400 font-bold">₹{r.amount.toLocaleString('en-IN')}</span>}</div>
                        {fups.length > 0 && (
                          <button onClick={() => setExpandedId(isExp ? null : r.id)} className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-green-400 hover:text-green-300 bg-green-900/30 px-2 py-0.5 rounded-full">📞 {fups.length} calls {isExp ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}</button>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        {r.customerPhone && <a href={`tel:${r.customerPhone}`} className="bg-green-600 hover:bg-green-500 text-white text-[10px] px-2.5 py-1.5 rounded-lg font-bold text-center flex items-center gap-1"><Phone size={10}/> Call</a>}
                        <button onClick={() => logFollowUp(r.id, r.customerName, r.customerPhone)} className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1"><PhoneCall size={10}/> Log</button>
                        {r.type === 'service' && <button onClick={() => markDone(r)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] px-2.5 py-1.5 rounded-lg font-bold">✅ Done</button>}
                        <button onClick={() => navigate(`/customer-profile/${r.customerId}`)} className="bg-slate-600 hover:bg-slate-500 text-white text-[10px] px-2.5 py-1.5 rounded-lg font-bold">👁 View</button>
                      </div>
                    </div>
                    {isExp && fups.length > 0 && (
                      <div className="mt-3 bg-slate-900/70 rounded-lg p-3 border border-slate-700/50">
                        <p className="text-[10px] text-green-400 font-bold mb-2">📋 Call History</p>
                        {fups.map((f, i) => (
                          <div key={i} className="flex gap-2 text-[10px] py-1 border-b border-slate-800 last:border-0">
                            <span className="text-slate-500 w-16 flex-shrink-0">{new Date(f.date).toLocaleDateString('en-IN')}</span>
                            <span className="text-slate-500 w-12 flex-shrink-0">{new Date(f.date).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
                            <span className="text-slate-300 flex-1">{f.note}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-slate-600">{currentPage}/{pages}</span>
              <div className="flex gap-1.5">
                <button onClick={() => setCurrentPage(p => Math.max(1,p-1))} disabled={currentPage===1} className="bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-lg disabled:opacity-30 hover:bg-slate-700 font-bold">◀ Prev</button>
                <button onClick={() => setCurrentPage(p => Math.min(pages,p+1))} disabled={currentPage===pages} className="bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-lg disabled:opacity-30 hover:bg-slate-700 font-bold">Next ▶</button>
              </div>
            </div>
          )}
        </>)}

        {/* Recent Invoices */}
        <Card className="bg-slate-800/50 border-slate-700/50 rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-4 py-2.5 flex justify-between items-center">
            <span className="text-white text-sm font-bold">📄 Recent Invoices ({invoices.length})</span>
            <button onClick={() => navigate('/invoice-management')} className="text-white/80 hover:text-white text-xs font-bold">सभी →</button>
          </div>
          <div className="p-0"><table className="w-full text-[11px]"><thead><tr className="border-b border-slate-700 bg-slate-800/50"><th className="text-left text-slate-400 py-2 px-2 font-bold">#</th><th>Invoice</th><th>Customer</th><th>Vehicle</th><th>Amount</th><th>Date</th><th></th></tr></thead><tbody>{invoices.slice(0,6).map((inv,i) => (<tr key={i} className="border-b border-slate-800 hover:bg-slate-700/30 cursor-pointer" onClick={()=>navigate(`/invoice/${inv.invoiceNumber||inv.id}`)}><td className="py-1.5 px-2 text-slate-600">{i+1}</td><td className="py-1.5 px-2 text-white font-bold">#{inv.invoiceNumber||inv.id}</td><td className="py-1.5 px-2 text-slate-300">{inv.customerName||'—'}</td><td className="py-1.5 px-2 text-blue-300">{inv.vehicle||'—'}</td><td className="py-1.5 px-2 text-green-400 font-bold">₹{(inv.totals?.totalAmount||inv.amount||0).toLocaleString('en-IN')}</td><td className="py-1.5 px-2 text-slate-500">{new Date(inv.invoiceDate||Date.now()).toLocaleDateString('en-IN')}</td><td className="py-1.5 px-2"><span className="text-blue-400 text-[9px] font-bold">View →</span></td></tr>))}</tbody></table></div>
        </Card>
      </div>
    </div>
  );
}