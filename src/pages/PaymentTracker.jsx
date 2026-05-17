// PaymentTracker.jsx — VP Honda Payment & Due Tracking
import { useState, useEffect } from 'react';
import { DollarSign, AlertCircle, X } from 'lucide-react';
import { sendWhatsApp, buildCustomWA, showInAppToast } from '../utils/smartUtils';
import { api } from '../utils/apiConfig';

const PAYMENT_TYPES = ['EMI','Advance','Balance','Insurance','Accessory','Other'];
const SC = { pending:'#ea580c', paid:'#16a34a', overdue:'#dc2626' };
const loadP = () => JSON.parse(localStorage.getItem('vp_payments')||'[]');
const saveP = (p) => localStorage.setItem('vp_payments', JSON.stringify(p));

export default function PaymentTracker() {
  const [payments, setPayments] = useState(loadP());
  const [filter, setFilter] = useState('pending');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({customerName:'',customerPhone:'',amount:'',type:'EMI',dueDate:'',notes:'',financeCompany:''});

  const now = new Date();
  const processed = payments.map(p =>
    p.status==='pending' && p.dueDate && new Date(p.dueDate)<now ? {...p,status:'overdue'} : p
  );

  const totalPending = processed.filter(p=>p.status!=='paid').reduce((s,p)=>s+Number(p.amount),0);
  const totalOverdue = processed.filter(p=>p.status==='overdue').reduce((s,p)=>s+Number(p.amount),0);
  const totalPaid = processed.filter(p=>p.status==='paid').reduce((s,p)=>s+Number(p.amount),0);
  const overdueCount = processed.filter(p=>p.status==='overdue').length;

  const filtered = processed.filter(p => {
    if(filter==='pending') return p.status==='pending'||p.status==='overdue';
    if(filter==='overdue') return p.status==='overdue';
    if(filter==='paid') return p.status==='paid';
    return true;
  });

  const addPayment = () => {
    if(!form.customerName||!form.amount){alert('Customer name और amount जरूरी');return;}
    const p={id:`pay_${Date.now()}`,...form,amount:Number(form.amount),status:'pending',createdAt:new Date().toISOString()};
    const u=[p,...payments]; saveP(u); setPayments(u);
    setShowForm(false);
    setForm({customerName:'',customerPhone:'',amount:'',type:'EMI',dueDate:'',notes:'',financeCompany:''});
    showInAppToast('💰 Payment added','','success');
  };

  const markPaid = (id) => {
    const u=payments.map(p=>p.id===id?{...p,status:'paid',paidAt:new Date().toISOString()}:p);
    saveP(u); setPayments(u); showInAppToast('✅ Marked paid','','success');
  };

  const remind = (p) => {
    if(!p.customerPhone){alert('Phone नहीं');return;}
    sendWhatsApp(p.customerPhone, buildCustomWA(`नमस्ते ${p.customerName} जी 🙏`,
      `VP Honda payment due है:\n💰 ₹${Number(p.amount).toLocaleString('en-IN')}\n📋 ${p.type}\n📅 Due: ${p.dueDate?new Date(p.dueDate).toLocaleDateString('en-IN'):'ASAP'}\n${p.financeCompany?`🏦 ${p.financeCompany}\n`:''}\nसंपर्क: 📞 9713394738`
    ));
    showInAppToast('📱 Reminder भेजा','','success');
  };

  return (
    <div style={{padding:14,background:'#020617',minHeight:'100vh',color:'#fff'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:8}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:800,margin:0}}>💰 Payment Tracker</h1>
          <p style={{color:'#94a3b8',fontSize:12,margin:'4px 0 0'}}>Pending dues, EMI, Finance — सब track करें</p>
        </div>
        <button onClick={()=>setShowForm(true)} style={{background:'linear-gradient(135deg,#DC0000,#B91C1C)',color:'#fff',border:'none',padding:'10px 16px',borderRadius:10,fontWeight:700,fontSize:13,cursor:'pointer'}}>➕ Add Payment</button>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:8,marginBottom:14}}>
        {[
          {icon:'⚠️',label:'Total Pending',val:`₹${(totalPending/1000).toFixed(1)}k`,color:'#ea580c',big:true},
          {icon:'🚨',label:`Overdue (${overdueCount})`,val:`₹${(totalOverdue/1000).toFixed(1)}k`,color:'#dc2626'},
          {icon:'✅',label:'Collected',val:`₹${(totalPaid/1000).toFixed(1)}k`,color:'#16a34a'},
          {icon:'📋',label:'Records',val:payments.length,color:'#3b82f6'},
        ].map((s,i)=>(
          <div key={i} style={{background:`linear-gradient(135deg,${s.color}22,${s.color}08)`,border:`1px solid ${s.color}40`,borderRadius:10,padding:'10px 12px'}}>
            <div style={{fontSize:18}}>{s.icon}</div>
            <p style={{color:'#94a3b8',fontSize:10,fontWeight:700,margin:'4px 0 2px',textTransform:'uppercase'}}>{s.label}</p>
            <p style={{color:'#fff',fontSize:s.big?22:18,fontWeight:900,margin:0}}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Overdue Banner */}
      {overdueCount>0&&(
        <div style={{background:'#7f1d1d55',border:'1px solid #dc2626',borderRadius:10,padding:'10px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
          <AlertCircle size={18} color="#fca5a5"/>
          <div style={{flex:1}}>
            <p style={{color:'#fca5a5',fontWeight:700,fontSize:13,margin:0}}>{overdueCount} Overdue! ₹{totalOverdue.toLocaleString('en-IN')}</p>
          </div>
          <button onClick={()=>{
            const ov=processed.filter(p=>p.status==='overdue'&&p.customerPhone);
            if(!ov.length){alert('Overdue payments में phone नहीं');return;}
            if(!window.confirm(`${ov.length} customers को reminder?`))return;
            ov.slice(0,5).forEach((p,i)=>setTimeout(()=>remind(p),i*1500));
          }} style={{background:'#dc2626',color:'#fff',border:'none',padding:'6px 12px',borderRadius:6,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>📱 Bulk Remind</button>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
        {[
          {id:'pending',label:`⏰ Pending (${processed.filter(p=>p.status!=='paid').length})`},
          {id:'overdue',label:`🚨 Overdue (${overdueCount})`},
          {id:'paid',label:`✅ Paid (${processed.filter(p=>p.status==='paid').length})`},
          {id:'all',label:`📋 All (${payments.length})`},
        ].map(t=>(
          <button key={t.id} onClick={()=>setFilter(t.id)}
            style={{background:filter===t.id?'#DC0000':'#1e293b',color:'#fff',border:'none',padding:'6px 12px',borderRadius:6,fontSize:11,fontWeight:700,cursor:'pointer'}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{display:'grid',gap:8}}>
        {filtered.length===0
          ? <div style={{background:'#0f172a',border:'1px solid #1e293b',borderRadius:12,padding:30,textAlign:'center',color:'#64748b'}}>कोई record नहीं</div>
          : filtered.map(p=>(
          <div key={p.id} style={{background:'#0f172a',border:`1px solid ${SC[p.status]||'#1e293b'}55`,borderRadius:10,padding:'12px 14px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:8}}>
              <div style={{flex:1,minWidth:200}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                  <span style={{fontWeight:700,fontSize:14}}>{p.customerName}</span>
                  <span style={{background:SC[p.status],color:'#fff',padding:'2px 7px',borderRadius:4,fontSize:9,fontWeight:700,textTransform:'uppercase'}}>{p.status}</span>
                  <span style={{background:'#1e293b',color:'#cbd5e1',padding:'2px 6px',borderRadius:4,fontSize:9,fontWeight:600}}>{p.type}</span>
                </div>
                <p style={{color:'#94a3b8',fontSize:12,margin:0}}>
                  💰 <span style={{color:'#fff',fontWeight:800,fontSize:16}}>₹{Number(p.amount).toLocaleString('en-IN')}</span>
                  {p.customerPhone&&<span> · 📞 {p.customerPhone}</span>}
                </p>
                {p.dueDate&&<p style={{color:p.status==='overdue'?'#fca5a5':'#94a3b8',fontSize:11,margin:'4px 0 0'}}>📅 Due: {new Date(p.dueDate).toLocaleDateString('en-IN')}</p>}
                {p.financeCompany&&<p style={{color:'#94a3b8',fontSize:11,margin:'2px 0 0'}}>🏦 {p.financeCompany}</p>}
                {p.notes&&<p style={{color:'#cbd5e1',fontSize:11,fontStyle:'italic',margin:'2px 0 0'}}>"{p.notes}"</p>}
              </div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {p.status!=='paid'&&<button onClick={()=>markPaid(p.id)} style={{background:'#16a34a',color:'#fff',border:'none',padding:'6px 10px',borderRadius:6,fontSize:11,fontWeight:700,cursor:'pointer'}}>✅ Paid</button>}
                {p.customerPhone&&<button onClick={()=>remind(p)} style={{background:'#25D366',color:'#fff',border:'none',padding:'6px 10px',borderRadius:6,fontSize:11,fontWeight:700,cursor:'pointer'}}>📱</button>}
                {p.customerPhone&&<button onClick={()=>window.location.href=`tel:${p.customerPhone}`} style={{background:'#0891b2',color:'#fff',border:'none',padding:'6px 10px',borderRadius:6,fontSize:11,fontWeight:700,cursor:'pointer'}}>📞</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showForm&&(
        <div onClick={()=>setShowForm(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,zIndex:50}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#0f172a',border:'1px solid #334155',borderRadius:14,width:'100%',maxWidth:480,padding:20,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
              <h2 style={{fontSize:16,fontWeight:800,margin:0}}>💰 Add Payment Record</h2>
              <button onClick={()=>setShowForm(false)} style={{background:'none',border:'none',color:'#94a3b8',cursor:'pointer'}}><X size={18}/></button>
            </div>
            <div style={{display:'grid',gap:10}}>
              {[
                {l:'Customer Name *',k:'customerName'},
                {l:'Phone',k:'customerPhone',max:10},
                {l:'Amount (₹) *',k:'amount',type:'number'},
                {l:'Finance Company',k:'financeCompany',ph:'e.g., Hero FinCorp'},
                {l:'Due Date',k:'dueDate',type:'date'},
                {l:'Notes',k:'notes'},
              ].map(({l,k,ph,max,type})=>(
                <div key={k}>
                  <label style={{color:'#94a3b8',fontSize:11,fontWeight:700,marginBottom:4,display:'block'}}>{l}</label>
                  <input value={form[k]||''} onChange={e=>setForm({...form,[k]:k==='customerPhone'?e.target.value.replace(/\D/g,''):e.target.value})}
                    placeholder={ph||''} maxLength={max} type={type||'text'}
                    style={{background:'#1e293b',color:'#fff',border:'1px solid #475569',borderRadius:8,padding:'10px 12px',fontSize:13,width:'100%',outline:'none'}}/>
                </div>
              ))}
              <div>
                <label style={{color:'#94a3b8',fontSize:11,fontWeight:700,marginBottom:4,display:'block'}}>Type</label>
                <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} style={{background:'#1e293b',color:'#fff',border:'1px solid #475569',borderRadius:8,padding:'10px 12px',fontSize:13,width:'100%',outline:'none'}}>
                  {PAYMENT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:14}}>
              <button onClick={addPayment} style={{flex:1,background:'#DC0000',color:'#fff',border:'none',padding:12,borderRadius:10,fontWeight:800,cursor:'pointer'}}>💾 Save</button>
              <button onClick={()=>setShowForm(false)} style={{background:'#475569',color:'#fff',border:'none',padding:'12px 16px',borderRadius:10,fontWeight:700,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
