// ReceivedPaymentPage.jsx — VP Honda Payment Receipt
// Red Honda theme | EMI + Down Payment | PDF + WhatsApp share
import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Plus, X, Receipt, Download, Share2, CheckCircle2, Trash2, Eye, Phone } from 'lucide-react';
import { api } from '../utils/apiConfig';

// ── VP Honda Brand ────────────────────────────────────────────────────────────
const BRAND = {
  name:    'VP HONDA',
  address: 'Parwaliya Sadak, Bhopal (M.P.) 462030',
  phones:  '9713394738',
  gstin:   '23BCYPD9538B1ZG',
  upi:     '43679689022@sbi',
};

const fmtINR  = (n) => '₹' + Number(n||0).toLocaleString('en-IN');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const toISODate = (d) => new Date(d).toISOString().split('T')[0];
const openWA  = (phone, msg) => {
  const clean = String(phone||'').replace(/[^0-9]/g,'').slice(-10);
  if (clean) window.open(`https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`, '_blank');
};

// ── Number to Words (simple) ──────────────────────────────────────────────────
function numToWords(n) {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  if (n === 0) return 'Zero';
  if (n < 0)   return 'Minus ' + numToWords(-n);
  let w = '';
  if (n >= 100000) { w += numToWords(Math.floor(n/100000)) + ' Lakh '; n %= 100000; }
  if (n >= 1000)   { w += numToWords(Math.floor(n/1000))   + ' Thousand '; n %= 1000; }
  if (n >= 100)    { w += ones[Math.floor(n/100)] + ' Hundred '; n %= 100; }
  if (n >= 20)     { w += tens[Math.floor(n/10)] + ' '; n %= 10; }
  if (n > 0)       { w += ones[n] + ' '; }
  return w.trim() + ' Rupees Only';
}

// ── PDF libs ──────────────────────────────────────────────────────────────────
const loadScript = (src) => new Promise((res, rej) => {
  if (document.querySelector(`script[src="${src}"]`)) return res();
  const s = document.createElement('script'); s.src = src;
  s.onload = res; s.onerror = () => rej(new Error('Failed: ' + src));
  document.head.appendChild(s);
});
const ensurePdfLibs = async () => {
  if (!window.html2canvas) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  if (!window.jspdf)       await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
};

// ── EMI Schedule helper ───────────────────────────────────────────────────────
function addMonthsSafe(dateInput, months) {
  const d = new Date(dateInput); const day = d.getDate();
  const a = new Date(d.getFullYear(), d.getMonth(), 1);
  a.setMonth(a.getMonth() + months);
  a.setDate(Math.min(day, new Date(a.getFullYear(), a.getMonth()+1, 0).getDate()));
  return a;
}
function computeSchedule(emi) {
  const tenure = Number(emi.totalEmis || emi.tenure || 12);
  const paid   = Number(emi.paidEmis || 0);
  const start  = emi.startDate ? new Date(emi.startDate) : new Date();
  return Array.from({ length: tenure }, (_, i) => {
    const due = addMonthsSafe(start, i);
    return { index: i, monthLabel: `${i+1}/${tenure} — ${due.toLocaleString('en-IN', { month:'long', year:'numeric' })}`, date: due, amount: Number(emi.emiAmount)||0, paid: i < paid };
  });
}

// ── Receipt counter (localStorage) ───────────────────────────────────────────
function nextReceiptNo() {
  const key = 'vph_receipt_counter';
  const n = (parseInt(localStorage.getItem(key)||'0') || 0) + 1;
  localStorage.setItem(key, String(n));
  return `VPH/REC/${new Date().getFullYear()}/${String(n).padStart(4,'0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function ReceivedPaymentPage() {
  const [receipts,  setReceipts]  = useState([]);
  const [customers, setCustomers] = useState([]);
  const [trackers,  setTrackers]  = useState([]);  // PaymentTracker EMI records
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [showForm,  setShowForm]  = useState(false);
  const [preview,   setPreview]   = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [rRes, cRes, tRes] = await Promise.all([
        fetch(api('/api/payment-receipts')).then(r=>r.ok?r.json():[]).catch(()=>[]),
        fetch(api('/api/customers')).then(r=>r.ok?r.json():[]).catch(()=>[]),
        fetch(api('/api/payment-tracker')).then(r=>r.ok?r.json():[]).catch(()=>[]),
      ]);
      setReceipts(Array.isArray(rRes)?rRes:(rRes?.receipts||[]));
      setCustomers(Array.isArray(cRes)?cRes:(cRes?.customers||[]));
      setTrackers(Array.isArray(tRes)?tRes:[]);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = receipts.filter(r =>
    !search || [r.receiptNumber, r.customerName, r.customerPhone, r.installmentLabel]
      .some(f => String(f||'').toLowerCase().includes(search.toLowerCase()))
  );

  const delReceipt = async (r) => {
    if (!confirm(`Receipt ${r.receiptNumber} delete करें?`)) return;
    await fetch(api(`/api/payment-receipts/${r._id}`), { method:'DELETE' });
    load();
  };

  const totalRec = receipts.reduce((s,r)=>s+(Number(r.amount)||0),0);
  const emiRec   = receipts.filter(r=>r.paymentType==='emi').reduce((s,r)=>s+(Number(r.amount)||0),0);
  const dpRec    = receipts.filter(r=>r.paymentType==='downpayment').reduce((s,r)=>s+(Number(r.amount)||0),0);

  return (
    <div style={{ padding:'16px 20px', maxWidth:900, margin:'0 auto', paddingBottom:100 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:'#DC0000' }}>🧾 Received Payments ({filtered.length})</h1>
        <button onClick={()=>setShowForm(true)} style={{ background:'#DC0000', color:'#fff', border:'none', padding:'9px 18px', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
          <Plus size={16}/> New Receipt
        </button>
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16 }}>
        <SCard label="Total Received" value={fmtINR(totalRec)} color="#22c55e"/>
        <SCard label="EMI Payments"   value={fmtINR(emiRec)}   color="#3b82f6"/>
        <SCard label="Down Payments"  value={fmtINR(dpRec)}    color="#f59e0b"/>
      </div>

      {/* Search */}
      <div style={{ display:'flex', alignItems:'center', gap:10, background:'#0f172a', border:'1px solid #1e293b', borderRadius:8, padding:'9px 14px', marginBottom:14 }}>
        <Search size={16} style={{ color:'#94a3b8' }}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, phone, receipt no से search..." style={{ background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:13, width:'100%' }}/>
        {search && <button onClick={()=>setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8' }}><X size={14}/></button>}
      </div>

      {loading ? <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>⏳ Loading...</div> :
       filtered.length===0 ? (
        <div style={{ textAlign:'center', padding:40, color:'#94a3b8', background:'#0f172a', border:'1px solid #1e293b', borderRadius:12 }}>
          <Receipt size={40} style={{ opacity:0.3, marginBottom:12 }}/>
          <p>अभी तक कोई receipt नहीं</p>
          <button onClick={()=>setShowForm(true)} style={{ background:'#DC0000', color:'#fff', border:'none', padding:'8px 16px', borderRadius:8, fontWeight:700, cursor:'pointer', marginTop:8 }}>
            <Plus size={14}/> पहली Receipt बनाएं
          </button>
        </div>
       ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map(r => (
            <div key={r._id} style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:10, padding:14, display:'flex', justifyContent:'space-between', alignItems:'flex-start', cursor:'pointer' }}
              onMouseEnter={e=>e.currentTarget.style.borderColor='#DC0000'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='#1e293b'}>
              <div style={{ flex:1 }} onClick={()=>setPreview(r)}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <Receipt size={14} style={{ color:'#DC0000' }}/>
                  <span style={{ fontWeight:700, color:'#DC0000', fontSize:13 }}>{r.receiptNumber}</span>
                  <span style={{ fontSize:10, padding:'2px 8px', borderRadius:4, background: r.paymentType==='emi'?'#1e3a8a': r.paymentType==='downpayment'?'#78350f':'#1e293b', color:'#fff' }}>
                    {r.paymentType==='emi'?'📅 EMI':r.paymentType==='downpayment'?'💵 Down Payment':'💰 Other'}
                  </span>
                </div>
                <div style={{ fontWeight:700, fontSize:14 }}>{r.customerName}</div>
                <div style={{ fontSize:11, color:'#94a3b8' }}>📞 {r.customerPhone} {r.vehicleModel && `· 🏍️ ${r.vehicleModel}`}</div>
                {r.installmentLabel && <div style={{ fontSize:11, color:'#fbbf24' }}>📅 {r.installmentLabel}</div>}
                <div style={{ fontSize:11, color:'#64748b' }}>📆 {fmtDate(r.receiptDate)} · {r.paymentMethod}</div>
                <div style={{ fontSize:15, fontWeight:800, color:'#22c55e', marginTop:4 }}>{fmtINR(r.amount)}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginLeft:10 }}>
                <button onClick={()=>setPreview(r)} style={{ background:'#1d4ed8', border:'none', color:'#fff', padding:'6px 8px', borderRadius:6, cursor:'pointer' }}><Eye size={12}/></button>
                <button onClick={()=>delReceipt(r)} style={{ background:'#7f1d1d', border:'none', color:'#fff', padding:'6px 8px', borderRadius:6, cursor:'pointer' }}><Trash2 size={12}/></button>
              </div>
            </div>
          ))}
        </div>
       )
      }

      {showForm && <ReceiptForm customers={customers} trackers={trackers} onClose={()=>{ setShowForm(false); load(); }} onSaved={(r)=>{ setShowForm(false); load(); setPreview(r); }}/>}
      {preview && <ReceiptPreview receipt={preview} onClose={()=>setPreview(null)}/>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIPT FORM
// ─────────────────────────────────────────────────────────────────────────────
function ReceiptForm({ customers, trackers, onClose, onSaved }) {
  const [custSearch,   setCustSearch]   = useState('');
  const [selCust,      setSelCust]      = useState(null);
  const [payType,      setPayType]      = useState('emi');
  const [selTracker,   setSelTracker]   = useState(null);  // PaymentTracker EMI
  const [selInst,      setSelInst]      = useState(null);  // which installment
  const [amount,       setAmount]       = useState('');
  const [date,         setDate]         = useState(toISODate(new Date()));
  const [method,       setMethod]       = useState('cash');
  const [notes,        setNotes]        = useState('');
  const [saving,       setSaving]       = useState(false);

  // Customer search results
  const custResults = useMemo(() => {
    const q = custSearch.toLowerCase().trim();
    if (!q || selCust) return [];
    return customers.filter(c =>
      (c.name||c.customerName||'').toLowerCase().includes(q) ||
      (c.phone||c.mobileNo||'').includes(q)
    ).slice(0, 8);
  }, [custSearch, customers, selCust]);

  // This customer's active EMI trackers
  const custTrackers = useMemo(() => {
    if (!selCust) return [];
    return trackers.filter(t => t.type==='emi' && t.status!=='completed' && (
      t.customerId === (selCust._id||selCust.id) ||
      (t.customerPhone||'').includes((selCust.phone||selCust.mobileNo||'').slice(-10)) ||
      (t.customerName||'').toLowerCase() === (selCust.name||selCust.customerName||'').toLowerCase()
    ));
  }, [selCust, trackers]);

  // Installment options for selected tracker
  const installments = useMemo(() => {
    if (!selTracker) return [];
    return computeSchedule({ ...selTracker, totalEmis: selTracker.totalEmis, paidEmis: selTracker.paidEmis, emiAmount: selTracker.emiAmount, startDate: selTracker.startDate }).filter(s => !s.paid);
  }, [selTracker]);

  const pickCust = (c) => {
    setSelCust(c);
    setCustSearch(c.name||c.customerName||'');
    setSelTracker(null); setSelInst(null);
    // Auto-select first tracker if only 1
    const ct = trackers.filter(t => t.type==='emi' && t.status!=='completed' && (
      t.customerId===(c._id||c.id) ||
      (t.customerPhone||'').includes((c.phone||c.mobileNo||'').slice(-10))
    ));
    if (ct.length===1) {
      setSelTracker(ct[0]);
      const pending = computeSchedule(ct[0]).find(s=>!s.paid);
      if (pending) { setSelInst(pending); setAmount(String(pending.amount)); }
    }
  };

  const pickTracker = (t) => {
    setSelTracker(t); setSelInst(null);
    const pending = computeSchedule(t).find(s=>!s.paid);
    if (pending) { setSelInst(pending); setAmount(String(pending.amount)); }
  };

  const save = async () => {
    if (!selCust)                           { alert('Customer select करें'); return; }
    if (!amount || Number(amount)<=0)       { alert('Amount ज़रूरी है'); return; }
    if (payType==='emi' && !selInst)        { alert('EMI installment select करें'); return; }
    setSaving(true);
    try {
      const receiptNumber = nextReceiptNo();
      const payload = {
        receiptNumber,
        receiptDate: date,
        customerId:    selCust._id || selCust.id || '',
        customerName:  selCust.name || selCust.customerName || '',
        customerPhone: selCust.phone || selCust.mobileNo || '',
        vehicleModel:  selTracker?.vehicleModel || selCust.vehicleModel || '',
        regNo:         selTracker?.regNo || selCust.regNo || '',
        paymentType:   payType,
        amount:        Number(amount),
        paymentMethod: method,
        notes,
        ...(payType==='emi' && selTracker ? {
          trackerId:         selTracker._id,
          installmentIndex:  selInst.index,
          installmentLabel:  selInst.monthLabel,
          installmentDueDate: toISODate(selInst.date),
          emiAmount:         selTracker.emiAmount,
          financer:          selTracker.financer||'',
          loanAccountNo:     selTracker.loanAccountNo||'',
        } : {}),
      };
      // Save receipt
      const res = await fetch(api('/api/payment-receipts'), {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Receipt save failed');
      const saved = await res.json();

      // Also update PaymentTracker entries if linked
      if (selTracker?._id) {
        await fetch(api(`/api/payment-tracker/${selTracker._id}/payment`), {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ amount: Number(amount), date, mode: method, note: notes||`Receipt ${receiptNumber}` }),
        }).catch(()=>{});
      }
      onSaved({ ...saved, ...payload });
    } catch (err) { alert('❌ Save failed: ' + err.message); setSaving(false); }
  };

  const inSt  = { width:'100%', background:'#020617', border:'1px solid #1e293b', color:'#fff', borderRadius:8, padding:'9px 12px', fontSize:12, outline:'none', boxSizing:'border-box' };
  const lblSt = { display:'block', fontSize:10, color:'#94a3b8', marginBottom:4, fontWeight:600 };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, background:'rgba(0,0,0,0.7)', overflowY:'auto' }} onClick={onClose}>
      <div style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:14, maxWidth:520, margin:'20px auto', padding:20 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:'#DC0000' }}>💰 नई Payment Receipt</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer' }}><X size={20}/></button>
        </div>

        {/* Customer search */}
        <label style={lblSt}>👤 Customer Search *</label>
        <input value={custSearch} onChange={e=>{ setCustSearch(e.target.value); setSelCust(null); setSelTracker(null); setSelInst(null); }} placeholder="नाम या mobile नंबर..." style={{ ...inSt, marginBottom:4 }}/>
        {custResults.length>0 && (
          <div style={{ background:'#020617', border:'1px solid #1e293b', borderRadius:8, maxHeight:160, overflowY:'auto', marginBottom:8 }}>
            {custResults.map(c=>(
              <div key={c._id||c.id} onClick={()=>pickCust(c)} style={{ padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid #1e293b', fontSize:12 }}
                onMouseEnter={e=>e.currentTarget.style.background='#1e293b'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div style={{ fontWeight:700 }}>{c.name||c.customerName}</div>
                <div style={{ fontSize:10, color:'#94a3b8' }}>📞 {c.phone||c.mobileNo} · {c.vehicleModel||'—'}</div>
              </div>
            ))}
          </div>
        )}
        {selCust && <div style={{ background:'#14532d22', border:'1px solid #22c55e', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:12, color:'#86efac' }}>✅ {selCust.name||selCust.customerName} — 📞 {selCust.phone||selCust.mobileNo}</div>}

        {selCust && (
          <>
            {/* Payment Type */}
            <label style={lblSt}>💳 Payment Type</label>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              {[['emi','📅 EMI'],['downpayment','💵 Down Payment'],['other','💰 Other']].map(([t,l])=>(
                <button key={t} onClick={()=>setPayType(t)} style={{ flex:1, padding:'8px', borderRadius:8, border:`1px solid ${payType===t?'#DC0000':'#1e293b'}`, background:payType===t?'#7f1d1d22':'transparent', color:payType===t?'#fca5a5':'#94a3b8', cursor:'pointer', fontSize:11, fontWeight:700 }}>{l}</button>
              ))}
            </div>

            {/* EMI tracker selection */}
            {payType==='emi' && (
              <>
                {custTrackers.length===0 ? (
                  <div style={{ fontSize:12, color:'#fbbf24', marginBottom:12, background:'#78350f22', border:'1px solid #fbbf2466', borderRadius:8, padding:10 }}>
                    ⚠️ इस customer का कोई active EMI tracker नहीं मिला।<br/>
                    <span style={{ fontSize:10, color:'#94a3b8' }}>पहले Payment Tracker में EMI add करें।</span>
                  </div>
                ) : (
                  <>
                    {custTrackers.length>1 && (
                      <>
                        <label style={lblSt}>🏍️ कौन-सी EMI (एक से ज़्यादा हैं)</label>
                        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
                          {custTrackers.map(t=>(
                            <div key={t._id} onClick={()=>pickTracker(t)} style={{ padding:'8px 12px', cursor:'pointer', borderRadius:8, border:`1px solid ${selTracker?._id===t._id?'#3b82f6':'#1e293b'}`, background:selTracker?._id===t._id?'#1e3a8a22':'transparent', fontSize:12 }}>
                              {t.vehicleModel} — {fmtINR(t.emiAmount)}/mo — {t.paidEmis||0}/{t.totalEmis} paid
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {selTracker && (
                      <>
                        <label style={lblSt}>📅 कौन-से महीने की EMI?</label>
                        {installments.length===0 ? (
                          <div style={{ fontSize:12, color:'#22c55e', marginBottom:10 }}>✅ सारी EMI installments paid हैं!</div>
                        ) : (
                          <select value={selInst?.index??''} onChange={e=>{const s=installments.find(x=>x.index===Number(e.target.value));setSelInst(s);setAmount(String(s?.amount||''));}} style={{ ...inSt, marginBottom:10 }}>
                            {installments.map(s=><option key={s.index} value={s.index}>{s.monthLabel} — {fmtINR(s.amount)}</option>)}
                          </select>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {/* Amount */}
            <label style={lblSt}>💰 Amount (₹) *</label>
            <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} style={{ ...inSt, marginBottom:12 }}/>

            {/* Date + Method */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div><label style={lblSt}>📆 Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inSt}/></div>
              <div><label style={lblSt}>💳 Method</label>
                <select value={method} onChange={e=>setMethod(e.target.value)} style={inSt}>
                  <option value="cash">💵 Cash</option>
                  <option value="upi">📱 UPI</option>
                  <option value="bank-transfer">🏦 Bank Transfer</option>
                  <option value="cheque">📝 Cheque</option>
                  <option value="neft">🏦 NEFT</option>
                </select>
              </div>
            </div>

            <label style={lblSt}>📝 Notes (optional)</label>
            <input value={notes} onChange={e=>setNotes(e.target.value)} style={{ ...inSt, marginBottom:16 }} placeholder="Extra details..."/>
          </>
        )}

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, background:'#1e293b', color:'#94a3b8', border:'none', padding:12, borderRadius:8, cursor:'pointer', fontWeight:700 }}>Cancel</button>
          <button onClick={save} disabled={saving||!selCust} style={{ flex:2, background:saving||!selCust?'#374151':'#DC0000', color:'#fff', border:'none', padding:12, borderRadius:8, cursor:'pointer', fontWeight:800, fontSize:14 }}>
            {saving?'⏳ Saving...':'💾 Receipt Save करें'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIPT PREVIEW + PDF + WhatsApp
// ─────────────────────────────────────────────────────────────────────────────
function ReceiptPreview({ receipt, onClose }) {
  const previewRef = useRef();
  const [busy, setBusy] = useState(false);
  const r = receipt;

  const genPDF = async () => {
    await ensurePdfLibs();
    const { jsPDF } = window.jspdf;
    const canvas = await window.html2canvas(previewRef.current, { scale:2, backgroundColor:'#ffffff', useCORS:true });
    const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a5' });
    const w = pdf.internal.pageSize.getWidth();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, w, (canvas.height*w)/canvas.width);
    return pdf.output('blob');
  };

  const downloadPDF = async () => {
    try { setBusy(true); const blob = await genPDF(); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`Receipt-${r.receiptNumber}.pdf`; a.click(); }
    catch(e){ alert('PDF failed: '+e.message); } finally { setBusy(false); }
  };

  const shareWA = async () => {
    try {
      setBusy(true);
      const blob = await genPDF();
      const file = new File([blob], `Receipt-${r.receiptNumber}.pdf`, { type:'application/pdf' });
      const text = `🧾 *VP Honda — Payment Receipt*\n\nReceipt: *${r.receiptNumber}*\nCustomer: ${r.customerName}\nAmount: *${fmtINR(r.amount)}*\n${r.installmentLabel?'EMI: '+r.installmentLabel:r.paymentType==='downpayment'?'Down Payment':''}\nDate: ${fmtDate(r.receiptDate)}\n\n🏍️ VP Honda, Bhopal\n📞 ${BRAND.phones}`;
      if (navigator.canShare?.({ files:[file] })) {
        try { await navigator.share({ files:[file], title:`Receipt ${r.receiptNumber}`, text }); return; }
        catch(e){ if(e.name!=='AbortError') console.warn(e); }
      }
      // Fallback: download + open WA
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=file.name; a.click();
      setTimeout(()=>openWA(r.customerPhone, text), 500);
    } catch(e){ alert('Share failed: '+e.message); } finally { setBusy(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:60, background:'rgba(0,0,0,0.85)', overflowY:'auto' }} onClick={onClose}>
      <div style={{ maxWidth:460, margin:'16px auto', padding:8 }} onClick={e=>e.stopPropagation()}>
        {/* Toolbar */}
        <div style={{ display:'flex', gap:8, marginBottom:10, position:'sticky', top:0, background:'#020617', padding:'8px 0', zIndex:10 }}>
          <button onClick={onClose} style={{ background:'#1e293b', border:'none', color:'#fff', padding:'8px 12px', borderRadius:6, cursor:'pointer' }}><X size={16}/></button>
          <div style={{ flex:1 }}/>
          <button onClick={downloadPDF} disabled={busy} style={{ background:'#1d4ed8', border:'none', color:'#fff', padding:'8px 14px', borderRadius:6, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontWeight:700 }}>
            <Download size={14}/> PDF
          </button>
          <button onClick={shareWA} disabled={busy} style={{ background:'#16a34a', border:'none', color:'#fff', padding:'8px 14px', borderRadius:6, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontWeight:700 }}>
            <Share2 size={14}/> WhatsApp
          </button>
        </div>

        {/* Receipt Design */}
        <div ref={previewRef} style={{ background:'#fff', color:'#000', padding:20, fontFamily:'Arial, sans-serif', fontSize:13, border:'2px solid #DC0000' }}>
          {/* Header */}
          <div style={{ textAlign:'center', borderBottom:'2px solid #DC0000', paddingBottom:10, marginBottom:10 }}>
            <div style={{ display:'inline-block', background:'#DC0000', color:'#fff', padding:'3px 18px', fontSize:11, fontWeight:'bold', borderRadius:4, marginBottom:8 }}>PAYMENT RECEIPT</div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:'bold', color:'#DC0000' }}>🏍️ VP HONDA</h1>
            <div style={{ fontSize:10, color:'#555' }}>{BRAND.address}</div>
            <div style={{ fontSize:10, color:'#555' }}>📞 {BRAND.phones} · GSTIN: {BRAND.gstin}</div>
          </div>

          {/* Receipt No + Date */}
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10, fontSize:12 }}>
            <div><b>Receipt No:</b> <span style={{ color:'#DC0000', fontWeight:'bold' }}>{r.receiptNumber}</span></div>
            <div><b>Date:</b> {fmtDate(r.receiptDate)}</div>
          </div>

          {/* Customer */}
          <div style={{ borderTop:'1px dashed #999', borderBottom:'1px dashed #999', padding:'8px 0', marginBottom:10 }}>
            <div><b>Received From:</b> {r.customerName}</div>
            <div><b>Mobile:</b> {r.customerPhone}</div>
            {r.vehicleModel && <div><b>Vehicle:</b> {r.vehicleModel}</div>}
            {r.regNo && <div><b>Reg No:</b> {r.regNo}</div>}
          </div>

          {/* Payment details */}
          <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:10, fontSize:12 }}>
            <tbody>
              <tr>
                <td style={{ padding:'4px 0', fontWeight:'bold' }}>Payment For:</td>
                <td style={{ textAlign:'right' }}>
                  {r.paymentType==='emi' ? `EMI (${r.installmentLabel||''})` : r.paymentType==='downpayment' ? 'Down Payment' : 'Other Payment'}
                </td>
              </tr>
              {r.financer && <tr><td style={{ padding:'4px 0', fontWeight:'bold' }}>Financer:</td><td style={{ textAlign:'right' }}>{r.financer}</td></tr>}
              {r.loanAccountNo && <tr><td style={{ padding:'4px 0', fontWeight:'bold' }}>Loan A/c:</td><td style={{ textAlign:'right' }}>{r.loanAccountNo}</td></tr>}
              <tr>
                <td style={{ padding:'4px 0', fontWeight:'bold' }}>Payment Method:</td>
                <td style={{ textAlign:'right', textTransform:'capitalize' }}>{r.paymentMethod}</td>
              </tr>
              {r.notes && <tr><td style={{ padding:'4px 0', fontWeight:'bold' }}>Notes:</td><td style={{ textAlign:'right' }}>{r.notes}</td></tr>}
            </tbody>
          </table>

          {/* Amount */}
          <div style={{ background:'#DC0000', color:'#fff', padding:12, borderRadius:8, textAlign:'center', marginBottom:10 }}>
            <div style={{ fontSize:11 }}>AMOUNT RECEIVED</div>
            <div style={{ fontSize:26, fontWeight:'bold' }}>{fmtINR(r.amount)}</div>
          </div>

          <div style={{ fontSize:10, marginBottom:16 }}><b>In Words:</b> {numToWords(r.amount)}</div>

          {/* Footer */}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:20, fontSize:10, color:'#555', borderTop:'1px solid #ddd', paddingTop:8 }}>
            <div>UPI: {BRAND.upi}</div>
            <div style={{ textAlign:'right', fontWeight:'bold' }}>
              <div style={{ borderTop:'1px solid #000', display:'inline-block', paddingTop:4, paddingLeft:20 }}>For: VP Honda</div>
            </div>
          </div>
        </div>
        {busy && <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:70 }}><div style={{ background:'#0f172a', padding:24, borderRadius:12, color:'#fff' }}>⏳ PDF generate हो रहा है...</div></div>}
      </div>
    </div>
  );
}

function SCard({ label, value, color }) {
  return (
    <div style={{ background:'#0f172a', border:`1px solid #1e293b`, borderLeft:`4px solid ${color}`, borderRadius:10, padding:14 }}>
      <div style={{ fontSize:11, color:'#94a3b8', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:800, color }}>{value}</div>
    </div>
  );
}
