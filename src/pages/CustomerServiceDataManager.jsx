import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Save, ChevronDown, ChevronUp, ArrowLeft, RefreshCw, Clock, X } from 'lucide-react';
import { api } from '../utils/apiConfig';

const getLS = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const PAGE_SIZE = 5;

// Helpers — get name/regNo/vehicle from any field variant
const getName    = (c) => c?.name || c?.customerName || c?.fullName || '';
const getRegNo   = (c) => c?.linkedVehicle?.regNo || c?.regNo || c?.vehicleNo || '';
const getVehicle = (c) => c?.linkedVehicle?.name || c?.vehicleModel || c?.vehicle || '';

// Look up service data by multiple keys
const findServiceData = (customer, serviceData) => {
  const reg   = getRegNo(customer).toUpperCase();
  const phone = customer.phone || '';
  return serviceData[customer._id]
      || (reg ? serviceData[reg] : null)
      || (phone ? Object.values(serviceData).find(d => d.phone === phone) : null)
      || {};
};

export default function CustomerServiceDataManager() {
  const navigate = useNavigate();
  const [customers,         setCustomers]         = useState([]);
  const [expandedId,        setExpandedId]        = useState(null); // single expand at a time
  const [serviceData,       setServiceData]       = useState({});
  const [editForm,          setEditForm]          = useState({});   // local edit before save
  const [message,           setMessage]           = useState('');
  const [filterView,        setFilterView]        = useState('all');
  const [searchTerm,        setSearchTerm]        = useState('');
  const [currentPage,       setCurrentPage]       = useState(0);
  const [lastRefresh,       setLastRefresh]       = useState(new Date());
  const [invoiceCount,      setInvoiceCount]      = useState(0);
  const [savingId,          setSavingId]          = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    loadAllData();
    const onStorage = () => loadAllData();
    window.addEventListener('storage', onStorage);
    intervalRef.current = setInterval(loadAllData, 15000); // 15s sync
    return () => { window.removeEventListener('storage', onStorage); clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => { setCurrentPage(0); }, [filterView, searchTerm]);

  // ── Load: customers + service data (MongoDB + localStorage merge) ──────────
  const loadAllData = async () => {
    let custData = [];
    try {
      const res = await fetch(api('/api/customers'));
      if (res.ok) custData = await res.json();
    } catch {}
    const lsC = [...getLS('sharedCustomerData',[]), ...getLS('customerData',[])];
    const seen = new Set(custData.map(c => c._id));
    lsC.forEach(c => { if (!seen.has(c._id)) { custData.push(c); seen.add(c._id); } });

    // Sort latest first (createdAt desc, fallback to _id timestamp)
    custData.sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      if (tb !== ta) return tb - ta;
      // ObjectId timestamp (first 8 hex chars = unix seconds)
      const ida = parseInt((a._id||'').substring(0,8), 16) || 0;
      const idb = parseInt((b._id||'').substring(0,8), 16) || 0;
      return idb - ida;
    });
    setCustomers(custData);

    // ── Service data: MongoDB first, merge with localStorage ─────────
    let merged = getLS('customerServiceData', {});
    try {
      const sdRes = await fetch(api('/api/service-data'));
      if (sdRes.ok) {
        const dbSD = await sdRes.json();
        dbSD.forEach(rec => {
          const key = rec.regNo || rec.customerId || rec._id;
          if (!key) return;
          if (!merged[key]) merged[key] = {};
          ['pendingAmount','paymentDueDate','paymentReceivedDate','insuranceDate','rtoDoneDate',
           'firstServiceDate','firstServiceKm','secondServiceDate','secondServiceKm',
           'thirdServiceDate','thirdServiceKm','fourthServiceDate','fifthServiceDate',
           'sixthServiceDate','seventhServiceDate','purchaseDate','customerName','phone','vehicle','regNo'
          ].forEach(f => { if (rec[f] !== undefined && rec[f] !== null && rec[f] !== '') merged[key][f] = rec[f]; });
        });
        localStorage.setItem('customerServiceData', JSON.stringify(merged));
      }
    } catch {}
    setServiceData(merged);

    const allInv = [...getLS('invoices',[]), ...getLS('generatedInvoices',[]), ...getLS('jobCards',[])];
    setInvoiceCount(allInv.length);
    setLastRefresh(new Date());
  };

  // ── Toggle expand + load form data ─────────────────────────────────────────
  const toggleExpand = (customer) => {
    if (expandedId === customer._id) {
      setExpandedId(null);
      setEditForm({});
    } else {
      setExpandedId(customer._id);
      const sd = findServiceData(customer, serviceData);
      setEditForm({ ...sd });
    }
  };

  const updateField = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  // ── Save (localStorage + MongoDB sync) ─────────────────────────────────────
  const saveCustomerData = async (customer) => {
    setSavingId(customer._id);
    try {
      const all  = getLS('customerServiceData', {});
      const reg  = getRegNo(customer).toUpperCase();
      const data = {
        ...editForm,
        regNo: reg,
        customerName: getName(customer),
        phone: customer.phone || '',
        vehicle: getVehicle(customer),
      };

      // Save by both _id and regNo (so RemindersPage can find by regNo)
      all[customer._id] = data;
      if (reg && reg !== '—' && reg !== '-') all[reg] = data;
      localStorage.setItem('customerServiceData', JSON.stringify(all));
      setServiceData(all);
      window.dispatchEvent(new Event('storage'));

      // MongoDB sync — use regNo as primary key
      const syncKey = reg || customer._id;
      try {
        const res = await fetch(api(`/api/service-data/${syncKey}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, customerId: customer._id }),
        });
        if (res.ok) setMessage(`✅ ${getName(customer)} का data save & MongoDB synced! सभी devices पर दिखेगा।`);
        else throw new Error('not ok');
      } catch {
        setMessage(`✅ ${getName(customer)} का data local save (offline)`);
      }
      setTimeout(() => setMessage(''), 4000);
      setSavingId(null);
    } catch (e) {
      setMessage('❌ Error: '+e.message);
      setSavingId(null);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  // ── Stats: count customers WITH actual service data ────────────────────────
  const customersWithData    = customers.filter(c => Object.keys(findServiceData(c, serviceData)).length > 0);
  const customersWithoutData = customers.filter(c => Object.keys(findServiceData(c, serviceData)).length === 0);

  // ── Filtered display ───────────────────────────────────────────────────────
  const getDisplayCustomers = () => {
    let result = customers;
    if (filterView === 'with-data')    result = customersWithData;
    if (filterView === 'without-data') result = customersWithoutData;
    if (filterView === 'with-invoices') {
      // Combine localStorage + state invoices for accurate count
      const allInv = [...getLS('invoices',[]), ...getLS('generatedInvoices',[]), ...getLS('jobCards',[])];
      const custIds = new Set(allInv.map(i => i.customerId).filter(Boolean));
      const phones  = new Set();
      const regs    = new Set();
      const names   = new Set();
      allInv.forEach(i => {
        if (i.customerPhone) phones.add(String(i.customerPhone).replace(/\D/g,''));
        if (i.phone)         phones.add(String(i.phone).replace(/\D/g,''));
        if (i.regNo)         regs.add(String(i.regNo).toUpperCase().trim());
        if (i.customerName)  names.add(i.customerName.toLowerCase().trim());
      });
      result = result.filter(c => {
        if (custIds.has(c._id)) return true;
        const cphone = String(c.phone||'').replace(/\D/g,'');
        if (cphone && phones.has(cphone)) return true;
        const creg = getRegNo(c).toUpperCase().trim();
        if (creg && regs.has(creg)) return true;
        const cname = getName(c).toLowerCase().trim();
        if (cname && names.has(cname)) return true;
        return false;
      });
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(c =>
        getName(c).toLowerCase().includes(s) ||
        (c.phone||'').includes(searchTerm) ||
        getRegNo(c).toLowerCase().includes(s)
      );
    }
    return result;
  };

  const displayed   = getDisplayCustomers();
  const totalPages  = Math.ceil(displayed.length / PAGE_SIZE);
  const pageItems   = displayed.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const stats = {
    total:       customers.length,
    withData:    customersWithData.length,
    withoutData: customersWithoutData.length,
    invoices:    invoiceCount,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <Button onClick={() => navigate('/reminders')} className="bg-red-700 hover:bg-red-600 text-white font-bold flex items-center gap-2">
            <ArrowLeft size={18}/> Back
          </Button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">🎯 Customer Service Data Manager</h1>
            <p className="text-slate-400 text-xs flex items-center justify-center gap-1 mt-1">
              <Clock size={11}/> {lastRefresh.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
              · Auto-sync हर 15 sec
            </p>
          </div>
          <Button onClick={loadAllData} className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2">
            <RefreshCw size={16}/> Refresh
          </Button>
        </div>

        {message && (
          <div className={`rounded-xl p-3 font-bold animate-pulse ${
            message.includes('✅') ? 'bg-green-600/20 border border-green-500 text-green-300' : 'bg-red-600/20 border border-red-500 text-red-300'
          }`}>{message}</div>
        )}

        {/* STAT CARDS — clickable filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { view:'all',           label:'Total Customers', val:stats.total,       color:'#3b82f6', desc:'सभी customers' },
            { view:'with-data',     label:'✅ With Data',     val:stats.withData,    color:'#22c55e', desc:'Service data filled' },
            { view:'without-data',  label:'⏳ Without Data',  val:stats.withoutData, color:'#ef4444', desc:'Data pending' },
            { view:'with-invoices', label:'📄 With Invoices', val:stats.invoices,    color:'#a855f7', desc:'Invoice वाले' },
          ].map(f => {
            const active = filterView === f.view;
            return (
              <div key={f.view}
                onClick={() => setFilterView(f.view)}
                style={{
                  cursor: 'pointer',
                  background: active ? `linear-gradient(135deg, ${f.color}, ${f.color}cc)` : `${f.color}15`,
                  border: `2px solid ${active ? '#fff' : f.color + '60'}`,
                  borderRadius: '16px',
                  padding: '18px',
                  transition: 'all 0.2s',
                  boxShadow: active ? `0 4px 20px ${f.color}66` : 'none',
                }}>
                <p style={{ color: active?'#fff':'#e2e8f0', fontSize:'13px', fontWeight:'600', opacity:active?0.95:0.75 }}>{f.label}</p>
                <h3 style={{ color: active?'#fff':f.color, fontSize:'40px', fontWeight:'900', margin:'4px 0', lineHeight:'1' }}>{f.val}</h3>
                <p style={{ color: active?'#fff':'#94a3b8', fontSize:'11px', opacity:active?0.85:0.6 }}>{f.desc}</p>
              </div>
            );
          })}
        </div>

        {/* ACTIVE FILTER badge */}
        {filterView !== 'all' && (
          <div className="bg-slate-700/60 border border-slate-600 p-3 rounded-xl flex items-center justify-between text-sm text-slate-300">
            <span>
              {filterView==='with-data'     && `✅ Data वाले customers: ${stats.withData}`}
              {filterView==='without-data'  && `⏳ बिना data customers: ${stats.withoutData}`}
              {filterView==='with-invoices' && `📄 Invoice वाले customers दिखाए जा रहे हैं`}
            </span>
            <Button onClick={() => setFilterView('all')} className="bg-slate-600 hover:bg-slate-500 text-white py-1 px-3 text-xs">Clear</Button>
          </div>
        )}

        {/* SEARCH */}
        <div>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="नाम, फोन या reg no से खोजें..."
              className="pl-10 bg-slate-800 border-slate-600 text-white placeholder-slate-500"/>
          </div>
          <p className="text-slate-400 text-xs mt-2">
            {displayed.length} customers · Page {currentPage+1}/{Math.max(1,totalPages)} · प्रत्येक page पर {PAGE_SIZE}
          </p>
        </div>

        {/* CUSTOMER LIST */}
        <div className="space-y-3">
          {pageItems.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6 text-center py-10">
                <p className="text-slate-400">कोई customer नहीं मिला</p>
              </CardContent>
            </Card>
          ) : (
            pageItems.map(customer => {
              const sd         = findServiceData(customer, serviceData);
              const isExpanded = expandedId === customer._id;
              const hasData    = !!(sd.pendingAmount || sd.insuranceDate || sd.firstServiceDate || sd.purchaseDate);
              const hasPending = parseFloat(sd.pendingAmount||0) > 0;
              const name       = getName(customer) || '— No Name —';
              const reg        = getRegNo(customer);
              const veh        = getVehicle(customer);

              return (
                <div key={customer._id}
                  style={{
                    background: isExpanded ? 'linear-gradient(135deg, #1e293b, #0f172a)' : 'linear-gradient(135deg, #334155, #1e293b)',
                    border: isExpanded ? '2px solid #3b82f6' : '1px solid #475569',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: isExpanded ? '0 8px 28px rgba(59,130,246,0.25)' : '0 2px 8px rgba(0,0,0,0.2)',
                    transition: 'all 0.25s'
                  }}>
                  {/* Header — click to expand */}
                  <div onClick={() => toggleExpand(customer)}
                    style={{
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px', flex:1, minWidth:0 }}>
                      <div style={{ color: isExpanded ? '#60a5fa' : '#94a3b8', flexShrink:0 }}>
                        {isExpanded ? <ChevronUp size={22}/> : <ChevronDown size={22}/>}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <h3 style={{ color:'#fff', fontWeight:'700', fontSize:'15px', margin:'0 0 4px' }}>{name}</h3>
                        <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', fontSize:'11px', color:'#94a3b8' }}>
                          <span>📞 {customer.phone || '—'}</span>
                          {reg && <span style={{ fontFamily:'monospace', color:'#7dd3fc' }}>🚗 {reg}</span>}
                          {veh && <span>🏍️ {veh}</span>}
                          {hasPending && <span style={{ color:'#fbbf24', fontWeight:'700' }}>💳 ₹{parseFloat(sd.pendingAmount).toLocaleString('en-IN')} बकाया</span>}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize:'11px', fontWeight:'700', padding:'4px 12px', borderRadius:'20px', flexShrink:0,
                      background: hasData ? 'rgba(34,197,94,0.18)' : 'rgba(249,115,22,0.18)',
                      color: hasData ? '#86efac' : '#fdba74',
                      border: `1px solid ${hasData ? 'rgba(34,197,94,0.3)' : 'rgba(249,115,22,0.3)'}`
                    }}>{hasData ? '✅ Filled' : '⏳ Pending'}</span>
                  </div>

                  {/* EXPANDED FORM */}
                  {isExpanded && (
                    <div style={{ background:'rgba(0,0,0,0.25)', padding:'18px', borderTop:'1px solid rgba(255,255,255,0.08)' }}>

                      {/* Customer Info */}
                      <div style={{ background:'rgba(255,255,255,0.04)', padding:'12px', borderRadius:'10px', marginBottom:'14px' }}>
                        <p style={{ color:'#fff', fontWeight:'700', fontSize:'13px', marginBottom:'8px' }}>📱 Customer Details</p>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', fontSize:'12px', color:'#cbd5e1' }}>
                          <div><span style={{ color:'#64748b' }}>Name:</span> {name}</div>
                          <div><span style={{ color:'#64748b' }}>Phone:</span> {customer.phone || '—'}</div>
                          <div><span style={{ color:'#64748b' }}>Address:</span> {customer.address || 'N/A'}</div>
                          <div><span style={{ color:'#64748b' }}>Reg No:</span> <span style={{ fontFamily:'monospace' }}>{reg || 'N/A'}</span></div>
                          {veh && <div><span style={{ color:'#64748b' }}>Vehicle:</span> {veh}</div>}
                        </div>
                      </div>

                      {/* PAYMENT */}
                      <div style={{ background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.25)', padding:'14px', borderRadius:'12px', marginBottom:'12px' }}>
                        <p style={{ color:'#fff', fontWeight:'700', fontSize:'13px', marginBottom:'10px' }}>💳 Payment</p>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                          <div>
                            <label style={{ color:'#94a3b8', fontSize:'11px', display:'block', marginBottom:'4px' }}>Outstanding Amount (₹)</label>
                            <Input type="number" value={editForm.pendingAmount||''} placeholder="0"
                              onChange={e => updateField('pendingAmount', parseFloat(e.target.value)||0)}
                              className="bg-slate-700 border-slate-600 text-white"/>
                          </div>
                          <div>
                            <label style={{ color:'#94a3b8', fontSize:'11px', display:'block', marginBottom:'4px' }}>Payment Due Date</label>
                            <Input type="date" value={editForm.paymentDueDate||''}
                              onChange={e => updateField('paymentDueDate', e.target.value)}
                              className="bg-slate-700 border-slate-600 text-white"/>
                          </div>
                          <div style={{ gridColumn:'span 2' }}>
                            <label style={{ color:'#94a3b8', fontSize:'11px', display:'block', marginBottom:'4px' }}>Payment Received Date <span style={{ color:'#fbbf24' }}>(भर देने पर reminder बंद होगा)</span></label>
                            <Input type="date" value={editForm.paymentReceivedDate||''}
                              onChange={e => updateField('paymentReceivedDate', e.target.value)}
                              className="bg-slate-700 border-slate-600 text-white"/>
                          </div>
                        </div>
                      </div>

                      {/* INSURANCE & RTO */}
                      <div style={{ background:'rgba(168,85,247,0.08)', border:'1px solid rgba(168,85,247,0.25)', padding:'14px', borderRadius:'12px', marginBottom:'12px' }}>
                        <p style={{ color:'#fff', fontWeight:'700', fontSize:'13px', marginBottom:'10px' }}>🚗 Insurance & RTO</p>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                          <div>
                            <label style={{ color:'#94a3b8', fontSize:'11px', display:'block', marginBottom:'4px' }}>Insurance Date</label>
                            <Input type="date" value={editForm.insuranceDate||''}
                              onChange={e => updateField('insuranceDate', e.target.value)}
                              className="bg-slate-700 border-slate-600 text-white"/>
                          </div>
                          <div>
                            <label style={{ color:'#94a3b8', fontSize:'11px', display:'block', marginBottom:'4px' }}>RTO Done Date</label>
                            <Input type="date" value={editForm.rtoDoneDate||''}
                              onChange={e => updateField('rtoDoneDate', e.target.value)}
                              className="bg-slate-700 border-slate-600 text-white"/>
                          </div>
                        </div>
                      </div>

                      {/* SERVICE SCHEDULE */}
                      <div style={{ background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.25)', padding:'14px', borderRadius:'12px', marginBottom:'14px' }}>
                        <p style={{ color:'#fff', fontWeight:'700', fontSize:'13px', marginBottom:'10px' }}>🔧 Service Schedule</p>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
                          {[
                            ['firstServiceDate','1st Service'],
                            ['secondServiceDate','2nd Service'],
                            ['thirdServiceDate','3rd Service'],
                            ['fourthServiceDate','4th Service'],
                            ['fifthServiceDate','5th Service'],
                            ['sixthServiceDate','6th Service'],
                            ['seventhServiceDate','7th Service'],
                          ].map(([f, l]) => (
                            <div key={f}>
                              <label style={{ color:'#94a3b8', fontSize:'11px', display:'block', marginBottom:'4px' }}>{l}</label>
                              <Input type="date" value={editForm[f]||''}
                                onChange={e => updateField(f, e.target.value)}
                                className="bg-slate-700 border-slate-600 text-white"/>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* SAVE / CANCEL */}
                      <div style={{ display:'flex', gap:'10px' }}>
                        <Button onClick={() => { setExpandedId(null); setEditForm({}); }}
                          className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-3">
                          <X size={16} className="mr-2"/> Cancel
                        </Button>
                        <Button onClick={() => saveCustomerData(customer)}
                          disabled={savingId === customer._id}
                          className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-3 disabled:opacity-50">
                          <Save size={18} className="mr-2"/> {savingId === customer._id ? 'Saving...' : 'Save & Sync to All Devices'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center pt-4">
            <Button onClick={() => setCurrentPage(p => Math.max(0, p-1))} disabled={currentPage===0}
              className="bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-30">‹ Previous</Button>
            <div className="flex gap-1 flex-wrap">
              {Array.from({length: Math.min(7, totalPages)}).map((_, i) => {
                const start = Math.max(0, Math.min(totalPages-7, currentPage-3));
                const p = start + i;
                if (p >= totalPages) return null;
                return (
                  <button key={p} onClick={() => setCurrentPage(p)}
                    className={`w-9 h-9 rounded-lg text-sm font-bold transition ${
                      p === currentPage ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}>{p+1}</button>
                );
              })}
            </div>
            <Button onClick={() => setCurrentPage(p => Math.min(totalPages-1, p+1))} disabled={currentPage>=totalPages-1}
              className="bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-30">Next ›</Button>
          </div>
        )}

      </div>
    </div>
  );
}