// CalendarView.jsx — VP Honda Appointment Calendar
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { sendWhatsApp, buildCustomWA, showInAppToast } from '../utils/smartUtils';

const TYPE_COLORS = {
  'Service':    { bg: '#0891b2', light: '#0891b222' },
  'Delivery':   { bg: '#16a34a', light: '#16a34a22' },
  'Test Drive': { bg: '#a855f7', light: '#a855f722' },
  'Follow-up':  { bg: '#fbbf24', light: '#fbbf2422' },
  'Other':      { bg: '#64748b', light: '#64748b22' },
};
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const loadA = () => JSON.parse(localStorage.getItem('vp_appointments') || '[]');
const saveA = (a) => localStorage.setItem('vp_appointments', JSON.stringify(a));

export default function CalendarView() {
  const today = new Date();
  const [cur, setCur] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [appts, setAppts] = useState(loadA());
  const [selDay, setSelDay] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:'', customerName:'', customerPhone:'', type:'Service', time:'10:00', notes:'' });
  const [tab, setTab] = useState('month');

  const firstDay = new Date(cur.year, cur.month, 1).getDay();
  const daysInMonth = new Date(cur.year, cur.month+1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({length: daysInMonth}, (_,i) => i+1)];
  const dk = (d) => `${cur.year}-${String(cur.month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const dayAppts = (d) => d ? appts.filter(a => a.date === dk(d)) : [];
  const isToday = (d) => d && today.getDate()===d && today.getMonth()===cur.month && today.getFullYear()===cur.year;

  const addAppt = () => {
    if (!form.title.trim()) return;
    const a = { id:`apt_${Date.now()}`, ...form, date: dk(selDay || today.getDate()), createdAt: new Date().toISOString() };
    const updated = [a, ...appts];
    saveA(updated); setAppts(updated);
    if (form.customerPhone) {
      if (window.confirm('Customer को WhatsApp confirmation भेजना है?')) {
        sendWhatsApp(form.customerPhone, buildCustomWA(
          `नमस्ते ${form.customerName||'Customer'} जी 🙏`,
          `आपका VP Honda appointment confirm:\n📋 ${form.title}\n📅 ${new Date(a.date).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}\n⏰ ${form.time}\nकृपया समय पर आएं। 📞 9713394738`
        ));
      }
    }
    showInAppToast('📅 Appointment saved','','success');
    setShowForm(false);
    setForm({ title:'', customerName:'', customerPhone:'', type:'Service', time:'10:00', notes:'' });
  };

  const delAppt = (id) => { if(!window.confirm('Delete?'))return; const u=appts.filter(a=>a.id!==id); saveA(u); setAppts(u); };
  const remind = (a) => {
    if (!a.customerPhone){alert('Phone नहीं');return;}
    sendWhatsApp(a.customerPhone, buildCustomWA(`नमस्ते ${a.customerName||'Customer'} जी 🙏`,
      `Reminder: कल VP Honda appointment:\n📋 ${a.title}\n📅 ${new Date(a.date).toLocaleDateString('en-IN')}\n⏰ ${a.time}\n📞 9713394738`));
    showInAppToast('📱 Reminder भेजा','','success');
  };

  const upcoming = [...appts].filter(a => new Date(a.date) >= new Date(today.toDateString())).sort((a,b)=>new Date(a.date)-new Date(b.date));

  return (
    <div style={{padding:14, background:'#020617', minHeight:'100vh', color:'#fff'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8}}>
        <h1 style={{fontSize:20, fontWeight:800, margin:0}}>📅 Calendar & Appointments</h1>
        <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
          {['month','list'].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{background:tab===t?'#DC0000':'#1e293b', color:'#fff', border:'none', padding:'6px 12px', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer'}}>
              {t==='month'?'📆 Month':'📋 List'}
            </button>
          ))}
          <button onClick={()=>setShowForm(true)} style={{background:'#16a34a', color:'#fff', border:'none', padding:'6px 12px', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer'}}>➕ Add</button>
        </div>
      </div>

      {tab==='month' && <>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
          <button onClick={()=>setCur(c=>c.month===0?{year:c.year-1,month:11}:{...c,month:c.month-1})} style={{background:'#1e293b', border:'none', color:'#fff', borderRadius:6, padding:'6px 10px', cursor:'pointer'}}><ChevronLeft size={16}/></button>
          <span style={{fontWeight:800, fontSize:16}}>{MONTHS[cur.month]} {cur.year}</span>
          <button onClick={()=>setCur(c=>c.month===11?{year:c.year+1,month:0}:{...c,month:c.month+1})} style={{background:'#1e293b', border:'none', color:'#fff', borderRadius:6, padding:'6px 10px', cursor:'pointer'}}><ChevronRight size={16}/></button>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:2}}>
          {DAYS.map(d=><div key={d} style={{textAlign:'center', color:d==='Sun'?'#DC0000':'#94a3b8', fontSize:10, fontWeight:700, padding:'4px 0'}}>{d}</div>)}
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:14}}>
          {cells.map((day,i)=>{
            const da=dayAppts(day); const sel=selDay===day;
            return (
              <div key={i} onClick={()=>day&&setSelDay(day===selDay?null:day)} style={{
                minHeight:56, background:sel?'#DC000022':day?'#0f172a':'transparent',
                border:sel?'1px solid #DC0000':isToday(day)?'1px solid #3b82f6':'1px solid #1e293b',
                borderRadius:6, padding:4, cursor:day?'pointer':'default',
              }}>
                {day && <>
                  <div style={{fontSize:11, fontWeight:isToday(day)?900:600, color:isToday(day)?'#3b82f6':'#cbd5e1', marginBottom:2}}>{day}</div>
                  {da.slice(0,2).map((a,j)=>(
                    <div key={j} style={{background:TYPE_COLORS[a.type]?.bg||'#DC0000', borderRadius:2, padding:'1px 3px', fontSize:8, fontWeight:700, marginBottom:1, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis'}}>{a.title}</div>
                  ))}
                  {da.length>2&&<div style={{fontSize:8, color:'#94a3b8'}}>+{da.length-2}</div>}
                </>}
              </div>
            );
          })}
        </div>
        {selDay && (
          <div style={{background:'#0f172a', border:'1px solid #DC000055', borderRadius:12, padding:14}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
              <h3 style={{fontSize:14, fontWeight:700, margin:0}}>📅 {selDay} {MONTHS[cur.month]} — {dayAppts(selDay).length} appointments</h3>
              <button onClick={()=>setShowForm(true)} style={{background:'#16a34a', color:'#fff', border:'none', padding:'6px 10px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer'}}>➕ Add</button>
            </div>
            {dayAppts(selDay).length===0 ? <p style={{color:'#64748b', fontSize:12, margin:0}}>कोई appointment नहीं</p>
              : dayAppts(selDay).map(a=><ApptCard key={a.id} appt={a} onDel={delAppt} onRemind={remind}/>)}
          </div>
        )}
      </>}

      {tab==='list' && (
        <div>
          <p style={{color:'#94a3b8', fontSize:11, fontWeight:700, marginBottom:8, textTransform:'uppercase'}}>📋 Upcoming ({upcoming.length})</p>
          {upcoming.length===0
            ? <div style={{background:'#0f172a', border:'1px solid #1e293b', borderRadius:12, padding:30, textAlign:'center', color:'#64748b'}}>कोई upcoming appointment नहीं</div>
            : upcoming.map(a=><ApptCard key={a.id} appt={a} onDel={delAppt} onRemind={remind}/>)
          }
        </div>
      )}

      {showForm && (
        <div onClick={()=>setShowForm(false)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:16, zIndex:50}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#0f172a', border:'1px solid #334155', borderRadius:14, width:'100%', maxWidth:460, padding:20, maxHeight:'90vh', overflowY:'auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:14}}>
              <h2 style={{fontSize:16, fontWeight:800, margin:0}}>📅 New Appointment</h2>
              <button onClick={()=>setShowForm(false)} style={{background:'none', border:'none', color:'#94a3b8', cursor:'pointer'}}><X size={18}/></button>
            </div>
            {selDay && <p style={{color:'#fbbf24', fontSize:12, marginBottom:10}}>📅 {selDay} {MONTHS[cur.month]} {cur.year}</p>}
            <div style={{display:'grid', gap:10}}>
              {[
                {l:'Title *', k:'title', ph:'e.g., 3rd Free Service'},
                {l:'Customer Name', k:'customerName'},
                {l:'Phone', k:'customerPhone', max:10},
                {l:'Time', k:'time', type:'time'},
                {l:'Notes', k:'notes'},
              ].map(({l,k,ph,max,type})=>(
                <div key={k}>
                  <label style={{color:'#94a3b8', fontSize:11, fontWeight:700, marginBottom:4, display:'block'}}>{l}</label>
                  <input value={form[k]||''} onChange={e=>setForm({...form,[k]:k==='customerPhone'?e.target.value.replace(/\D/g,''):e.target.value})}
                    placeholder={ph||''} maxLength={max} type={type||'text'}
                    style={{background:'#1e293b', color:'#fff', border:'1px solid #475569', borderRadius:8, padding:'10px 12px', fontSize:13, width:'100%', outline:'none'}}/>
                </div>
              ))}
              <div>
                <label style={{color:'#94a3b8', fontSize:11, fontWeight:700, marginBottom:4, display:'block'}}>Type</label>
                <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}
                  style={{background:'#1e293b', color:'#fff', border:'1px solid #475569', borderRadius:8, padding:'10px 12px', fontSize:13, width:'100%', outline:'none'}}>
                  {Object.keys(TYPE_COLORS).map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'flex', gap:8, marginTop:14}}>
              <button onClick={addAppt} style={{flex:1, background:'#DC0000', color:'#fff', border:'none', padding:12, borderRadius:10, fontWeight:800, cursor:'pointer'}}>💾 Save + Notify</button>
              <button onClick={()=>setShowForm(false)} style={{background:'#475569', color:'#fff', border:'none', padding:'12px 16px', borderRadius:10, fontWeight:700, cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApptCard({appt, onDel, onRemind}) {
  const tc = TYPE_COLORS[appt.type]||TYPE_COLORS.Other;
  return (
    <div style={{background:tc.light, border:`1px solid ${tc.bg}55`, borderRadius:8, padding:'10px 12px', marginBottom:6}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, flexWrap:'wrap'}}>
        <div style={{flex:1, minWidth:180}}>
          <div style={{display:'flex', alignItems:'center', gap:6, flexWrap:'wrap'}}>
            <span style={{fontWeight:700, fontSize:13}}>{appt.title}</span>
            <span style={{background:tc.bg, color:'#fff', padding:'1px 6px', borderRadius:3, fontSize:9, fontWeight:700}}>{appt.type}</span>
          </div>
          <p style={{color:'#94a3b8', fontSize:11, margin:'3px 0 0'}}>
            {appt.customerName&&`👤 ${appt.customerName} · `}
            {appt.customerPhone&&`📞 ${appt.customerPhone} · `}
            ⏰ {appt.time}
            {appt.date&&` · 📅 ${new Date(appt.date).toLocaleDateString('en-IN')}`}
          </p>
          {appt.notes&&<p style={{color:'#cbd5e1', fontSize:11, fontStyle:'italic', margin:'3px 0 0'}}>"{appt.notes}"</p>}
        </div>
        <div style={{display:'flex', gap:4}}>
          {appt.customerPhone&&<button onClick={()=>onRemind(appt)} style={{background:'#25D366', color:'#fff', border:'none', padding:'4px 8px', borderRadius:4, fontSize:10, fontWeight:700, cursor:'pointer'}}>📱</button>}
          <button onClick={()=>onDel(appt.id)} style={{background:'#dc2626', color:'#fff', border:'none', padding:'4px 8px', borderRadius:4, fontSize:10, fontWeight:700, cursor:'pointer'}}>✕</button>
        </div>
      </div>
    </div>
  );
}