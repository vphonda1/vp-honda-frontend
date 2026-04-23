import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, RefreshCw, Clock, Phone, PhoneCall, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, MessageSquare, Calendar, X, TrendingUp } from 'lucide-react';
import { api } from '../utils/apiConfig';

const getLS = (k, fb=[]) => { try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch{return fb;} };
const setLS = (k, v) => { try{localStorage.setItem(k, JSON.stringify(v));}catch{} };
const greet = () => { const h=new Date().getHours(); return h<12?'🌅 Good Morning':h<17?'☀️ Good Afternoon':'🌙 Good Evening'; };
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '';

const SERVICE_MAP = [
  { done:'firstServiceDate',  next:'2nd', label:'2nd Service', days:120 },
  { done:'secondServiceDate', next:'3rd', label:'3rd Service', days:120 },
  { done:'thirdServiceDate',  next:'4th', label:'4th Service', days:120 },
  { done:'fourthServiceDate', next:'5th', label:'5th Service', days:120 },
  { done:'fifthServiceDate',  next:'6th', label:'6th Service', days:120 },
  { done:'sixthServiceDate',  next:'7th', label:'7th Service', days:120 },
];
const SERVICE_KEY_MAP = {
  '1st':'firstService','2nd':'secondService','3rd':'thirdService',
  '4th':'fourthService','5th':'fifthService','6th':'sixthService','7th':'seventhService',
};

const CALL_STATUS = [
  { value:'called',    label:'✅ Baat Hui',      color:'bg-green-700'  },
  { value:'promised',  label:'🤝 Kal Aayenge',   color:'bg-blue-700'   },
  { value:'no_answer', label:'📵 Nahi Uthaya',    color:'bg-yellow-700' },
  { value:'busy',      label:'🔴 Busy Tha',       color:'bg-orange-700' },
  { value:'later',     label:'⏰ Baad Mein',      color:'bg-purple-700' },
  { value:'not_int',   label:'❌ Interest Nahi',  color:'bg-red-700'    },
];

const getWAMessage = (r) => {
  const name = (r.customerName||'Ji').split(' ').pop();
  const due  = r.dueDate instanceof Date ? fmtDate(r.dueDate) : (r.dueDate||'');
  return encodeURIComponent(
    `Namaste ${name} Ji! 🙏\n\nVP Honda ki taraf se aapko yaad dilana chahte hain ki *${r.vehicle||'aapki gaadi'}* (${r.regNo}) ki *${r.serviceType||''} service* due ho chuki hai.\n\n📅 Due Date: ${due}\n\nKripaya service karwane ke liye showroom par padharen.\n\n🏍️ VP Honda, Bhopal\n📞 9713394738`
  );
};

const buildServiceData = (invoices) => {
  const sd = getLS('customerServiceData',{});
  invoices.forEach(inv => {
    const regNo = (inv.regNo||'').trim().toUpperCase();
    if (!regNo||regNo==='—'||regNo==='-') return;
    if (!sd[regNo]) sd[regNo]={};
    const e=sd[regNo];
    if(inv.customerName) e.customerName=inv.customerName;
    if(inv.customerPhone) e.phone=inv.customerPhone;
    if(inv.vehicle) e.vehicle=inv.vehicle;
    e.regNo=regNo;
    const d=inv.invoiceDate||'', sn=inv.serviceNumber;
    if(inv.invoiceType==='vehicle'&&d&&!e.purchaseDate) e.purchaseDate=d;
    if(inv.invoiceType==='service'&&d&&sn) {
      const km={1:'firstServiceDate',2:'secondServiceDate',3:'thirdServiceDate',4:'fourthServiceDate',5:'fifthServiceDate',6:'sixthServiceDate',7:'seventhServiceDate'};
      const k=km[sn];
      if(k&&!e[k]){e[k]=d;if(inv.serviceKm)e[k.replace('Date','Km')]=inv.serviceKm;}
    }
  });
  setLS('customerServiceData',sd);
  return sd;
};

export default function RemindersPage() {
  const navigate = useNavigate();
  const [reminders,    setReminders]   = useState([]);
  const [filterType,   setFilterType]  = useState('all');
  const [searchTerm,   setSearchTerm]  = useState('');
  const [loading,      setLoading]     = useState(true);
  const [debugInfo,    setDebugInfo]   = useState({});
  const [invoices,     setInvoices]    = useState([]);
  const [lastRefresh,  setLastRefresh] = useState(new Date());
  const [currentPage,  setCurrentPage] = useState(1);
  const PER_PAGE = 8;
  const [followUps,    setFollowUps]   = useState(getLS('followUpLog',{}));
  const [expandedId,   setExpandedId]  = useState(null);
  const [tickerPause,  setTickerPause] = useState(false);
  const [syncMsg,      setSyncMsg]     = useState('');
  const [showFU,       setShowFU]      = useState(false);
  const [showDone,     setShowDone]    = useState(false);
  const [activeR,      setActiveR]     = useState(null);
  const [fuForm,       setFuForm]      = useState({status:'called',note:'',nextCallDate:''});
  const [doneForm,     setDoneForm]    = useState({km:'',date:new Date().toISOString().split('T')[0],remarks:''});
  const intervalRef = useRef(null);

  useEffect(()=>{
    loadAll();
    window.addEventListener('storage',loadAll);
    intervalRef.current=setInterval(loadAll,30000);
    return()=>{window.removeEventListener('storage',loadAll);clearInterval(intervalRef.current);};
  },[]);

  const loadAll = async () => {
    try {
      let dbInv=[];
      try{const r=await fetch(api('/api/invoices'));if(r.ok)dbInv=await r.json();}catch{}
      const lsInv=getLS('invoices',[]);
      const seen=new Set();
      const all=[...dbInv,...lsInv].filter(inv=>{
        const k=String(inv.invoiceNumber||inv._id||Math.random());
        if(seen.has(k))return false;seen.add(k);return true;
      }).sort((a,b)=>new Date(b.invoiceDate||0)-new Date(a.invoiceDate||0));
      setInvoices(all);
      buildServiceData(all);
      await buildReminders();
    }catch(e){console.error(e);setLoading(false);}
  };

  const buildReminders = async () => {
    try {
      let custs=[];
      try{const r=await fetch(api('/api/customers'));if(r.ok)custs=await r.json();}catch{}
      const sd=getLS('customerServiceData',{});
      const fu=getLS('followUpLog',{});
      const all=[];
      let dbg={totalCustomers:custs.length,payment:0,insurance:0,service:0};
      const getC=(reg)=>custs.find(c=>(c.registrationNo||c.regNo||'').toUpperCase()===reg.toUpperCase());
      const today=new Date();today.setHours(0,0,0,0);

      Object.entries(sd).forEach(([regNo,data])=>{
        if(!regNo||regNo==='no_reg_') return;
        const cust=getC(regNo);
        const nm=data.customerName||cust?.customerName||cust?.name||'Unknown';
        const ph=data.phone||cust?.phone||'';
        const vh=data.vehicle||cust?.vehicleModel||'';
        const lastCS=fu[`pay-${regNo}`]?.slice(-1)[0]?.status||null;

        const pend=parseFloat(data.pendingAmount||0);
        if(pend>0&&!data.paymentReceivedDate){
          let dr=999,dd=new Date();
          if(data.paymentDueDate){dd=new Date(data.paymentDueDate);dd.setHours(0,0,0,0);dr=Math.floor((dd-today)/86400000);}
          dbg.payment++;
          all.push({id:`pay-${regNo}`,type:'payment',serviceType:null,customerId:regNo,customerName:nm,customerPhone:ph,vehicle:vh,regNo,
            title:'💳 Payment Due',description:`बकाया: ₹${pend.toLocaleString('en-IN')}`,
            daysRemaining:dr,status:dr<=3?'critical':'warning',dueDate:dd,amount:pend,
            lastCallStatus:fu[`pay-${regNo}`]?.slice(-1)[0]?.status||null,
            callCount:fu[`pay-${regNo}`]?.length||0});
        }

        if(data.insuranceDate&&!data.rtoDoneDate){
          const ins=new Date(data.insuranceDate);ins.setHours(0,0,0,0);
          const rto=new Date(ins.getTime()+7*864e5);const dr=Math.floor((rto-today)/864e5);
          if(dr>=0&&dr<=7){dbg.insurance++;
            all.push({id:`ins-${regNo}`,type:'insurance',serviceType:null,customerId:regNo,customerName:nm,customerPhone:ph,vehicle:vh,regNo,
              title:'🚗 RTO Pending',description:`Insurance: ${fmtDate(data.insuranceDate)} | Deadline: ${fmtDate(rto)}`,
              daysRemaining:dr,status:dr<=1?'critical':'warning',dueDate:rto,
              lastCallStatus:fu[`ins-${regNo}`]?.slice(-1)[0]?.status||null,callCount:0});}
        }

        if(data.purchaseDate&&!data.firstServiceDate){
          const pd=new Date(data.purchaseDate);pd.setHours(0,0,0,0);
          const due=new Date(pd.getTime()+30*864e5);const dr=Math.floor((due-today)/864e5);
          const rid=`svc-1st-${regNo}`;
          if(dr>=-30){dbg.service++;
            all.push({id:rid,type:'service',serviceType:'1st',customerId:regNo,customerName:nm,customerPhone:ph,vehicle:vh,regNo,
              title:'🔧 1st Service Due',description:`खरीद: ${fmtDate(data.purchaseDate)} | Due: ${fmtDate(due)}`,
              daysRemaining:dr,status:dr<=0?'critical':'warning',dueDate:due,
              lastCallStatus:fu[rid]?.slice(-1)[0]?.status||null,callCount:fu[rid]?.length||0});}
        }

        for(const svc of SERVICE_MAP){
          const doneDate=data[svc.done];
          const nextKey=(SERVICE_KEY_MAP[svc.next]||'')+'Date';
          if(doneDate&&!data[nextKey]){
            const prev=new Date(doneDate);prev.setHours(0,0,0,0);
            const due=new Date(prev.getTime()+svc.days*864e5);const dr=Math.floor((due-today)/864e5);
            const rid=`svc-${svc.next}-${regNo}`;
            if(dr>=-30){dbg.service++;
              all.push({id:rid,type:'service',serviceType:svc.next,customerId:regNo,customerName:nm,customerPhone:ph,vehicle:vh,regNo,
                title:`🔧 ${svc.label} Due`,description:`पिछली: ${fmtDate(doneDate)} | Due: ${fmtDate(due)}`,
                daysRemaining:dr,status:dr<=0?'critical':'warning',dueDate:due,
                lastCallStatus:fu[rid]?.slice(-1)[0]?.status||null,callCount:fu[rid]?.length||0});}
            break;
          }
        }
      });

      all.sort((a,b)=>{if(a.status!==b.status)return a.status==='critical'?-1:1;return a.daysRemaining-b.daysRemaining;});
      setReminders(all);setDebugInfo(dbg);setLastRefresh(new Date());setLoading(false);
    }catch(e){console.error(e);setLoading(false);}
  };

  const submitFollowUp = async () => {
    if(!activeR) return;
    const entry={date:new Date().toISOString(),status:fuForm.status,note:fuForm.note||'—',nextCallDate:fuForm.nextCallDate||null,by:'Admin'};
    const u={...followUps};if(!u[activeR.id])u[activeR.id]=[];u[activeR.id].push(entry);
    setFollowUps(u);setLS('followUpLog',u);
    try{await fetch(api('/api/follow-ups'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reminderId:activeR.id,customerName:activeR.customerName,phone:activeR.customerPhone,regNo:activeR.regNo,...entry})});}catch{}
    setShowFU(false);setFuForm({status:'called',note:'',nextCallDate:''});setActiveR(null);
    buildReminders();setSyncMsg('✅ Follow-up saved');setTimeout(()=>setSyncMsg(''),2000);
  };

  const submitDone = async () => {
    if(!activeR) return;
    const key=SERVICE_KEY_MAP[activeR.serviceType];
    const sd=getLS('customerServiceData',{});
    if(!sd[activeR.regNo])sd[activeR.regNo]={};
    if(key){sd[activeR.regNo][key+'Date']=doneForm.date;sd[activeR.regNo][key+'Km']=doneForm.km;}
    if(doneForm.remarks)sd[activeR.regNo].lastRemarks=doneForm.remarks;
    setLS('customerServiceData',sd);
    const u={...followUps};if(!u[activeR.id])u[activeR.id]=[];
    u[activeR.id].push({date:new Date().toISOString(),status:'done',note:`Service Done. KM:${doneForm.km}. ${doneForm.remarks}`,by:'Admin'});
    setFollowUps(u);setLS('followUpLog',u);
    try{
      await fetch(api('/api/service-records'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({regNo:activeR.regNo,customerName:activeR.customerName,serviceType:activeR.serviceType,serviceDate:doneForm.date,km:doneForm.km,remarks:doneForm.remarks})});
      setSyncMsg('✅ MongoDB में save हुआ');
    }catch{setSyncMsg('⚠️ Local save');}
    setTimeout(()=>setSyncMsg(''),3000);
    setShowDone(false);setActiveR(null);setDoneForm({km:'',date:new Date().toISOString().split('T')[0],remarks:''});
    window.dispatchEvent(new Event('storage'));loadAll();
  };

  const cnt=(fn)=>reminders.filter(fn).length;
  const FILTERS=[
    {t:'all',   l:`📋 All ${reminders.length}`,                    bg:'bg-blue-600'  },
    {t:'pay',   l:`💳 Payment ${cnt(r=>r.type==='payment')}`,       bg:'bg-green-600' },
    {t:'ins',   l:`🚗 RTO ${cnt(r=>r.type==='insurance')}`,        bg:'bg-purple-600'},
    {t:'svc',   l:`🔧 Service ${cnt(r=>r.type==='service')}`,      bg:'bg-orange-600'},
    {t:'s1',l:`1st ${cnt(r=>r.serviceType==='1st')}`,bg:'bg-cyan-700'   },
    {t:'s2',l:`2nd ${cnt(r=>r.serviceType==='2nd')}`,bg:'bg-yellow-700' },
    {t:'s3',l:`3rd ${cnt(r=>r.serviceType==='3rd')}`,bg:'bg-red-700'    },
    {t:'s4',l:`4th ${cnt(r=>r.serviceType==='4th')}`,bg:'bg-pink-700'   },
    {t:'s5',l:`5th ${cnt(r=>r.serviceType==='5th')}`,bg:'bg-indigo-700' },
    {t:'s6',l:`6th ${cnt(r=>r.serviceType==='6th')}`,bg:'bg-teal-700'   },
    {t:'s7',l:`7th ${cnt(r=>r.serviceType==='7th')}`,bg:'bg-lime-700'   },
  ];
  const svcMap={s1:'1st',s2:'2nd',s3:'3rd',s4:'4th',s5:'5th',s6:'6th',s7:'7th'};
  const filtered=reminders.filter(r=>{
    if(filterType==='pay'&&r.type!=='payment')   return false;
    if(filterType==='ins'&&r.type!=='insurance') return false;
    if(filterType==='svc'&&r.type!=='service')   return false;
    if(svcMap[filterType]&&r.serviceType!==svcMap[filterType]) return false;
    if(searchTerm){const s=searchTerm.toLowerCase();return[r.customerName,r.customerPhone,r.vehicle,r.regNo].some(v=>(v||'').toLowerCase().includes(s));}
    return true;
  });
  const pages=Math.ceil(filtered.length/PER_PAGE);
  const paginated=filtered.slice((currentPage-1)*PER_PAGE,currentPage*PER_PAGE);
  const todayCrit=reminders.filter(r=>r.status==='critical'&&r.daysRemaining<=0);
  const upcoming3=reminders.filter(r=>r.daysRemaining>0&&r.daysRemaining<=3);
  const csColor=(s)=>({called:'text-green-400',promised:'text-blue-400',no_answer:'text-yellow-400',busy:'text-orange-400',later:'text-purple-400',not_int:'text-red-400',done:'text-emerald-400'}[s]||'text-slate-400');
  const csLabel=(s)=>CALL_STATUS.find(c=>c.value===s)?.label||s||'';

  if(loading) return(<div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"/></div>);

  return(
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {todayCrit.length>0&&(
        <div className="bg-gradient-to-r from-red-700 to-red-600 text-white overflow-hidden" onMouseEnter={()=>setTickerPause(true)} onMouseLeave={()=>setTickerPause(false)}>
          <div className="flex items-center h-9">
            <span className="bg-red-900 px-3 py-1 text-xs font-black flex-shrink-0 flex items-center gap-1"><AlertTriangle size={12}/> URGENT</span>
            <div className="overflow-hidden flex-1">
              <div className="flex gap-8 whitespace-nowrap" style={{animation:tickerPause?'none':'marquee 35s linear infinite'}}>
                {todayCrit.map((r,i)=>(<span key={i} className="text-xs font-medium inline-flex items-center gap-2">🚨 {r.customerName} — {r.title} — {r.vehicle} ({r.regNo}) — {Math.abs(r.daysRemaining)}d overdue{r.customerPhone&&<span className="opacity-60">📞{r.customerPhone}</span>}<span className="text-red-300">|</span></span>))}
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes marquee{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}`}</style>

      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div><h1 className="text-2xl font-black text-white flex items-center gap-2"><Bell size={22}/> Service Reminders</h1><p className="text-slate-400 text-xs mt-0.5">{greet()} · <Clock size={10} className="inline"/> {fmtTime(lastRefresh)}</p></div>
          <div className="flex items-center gap-2">
            {syncMsg&&<span className="text-xs text-green-400 font-bold bg-green-900/30 px-2 py-1 rounded">{syncMsg}</span>}
            <Button onClick={()=>{setLoading(true);setTimeout(loadAll,200);}} className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-3 text-xs"><RefreshCw size={13} className="mr-1"/> Refresh</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
          {[
            {l:'🚨 Overdue',   v:todayCrit.length,                              c:'bg-red-600/30 border-red-500/40',    t:'text-red-300'   },
            {l:'⚡ 3 Days',    v:upcoming3.length,                              c:'bg-yellow-600/30 border-yellow-500/40',t:'text-yellow-300'},
            {l:'🔧 1st Svc',   v:cnt(r=>r.serviceType==='1st'),                 c:'bg-cyan-600/30 border-cyan-500/40',  t:'text-cyan-300'  },
            {l:'🔧 2nd Svc',   v:cnt(r=>r.serviceType==='2nd'),                 c:'bg-blue-600/30 border-blue-500/40',  t:'text-blue-300'  },
            {l:'🔧 3rd Svc',   v:cnt(r=>r.serviceType==='3rd'),                 c:'bg-purple-600/30 border-purple-500/40',t:'text-purple-300'},
            {l:'🔧 4-7th',     v:cnt(r=>['4th','5th','6th','7th'].includes(r.serviceType)), c:'bg-teal-600/30 border-teal-500/40', t:'text-teal-300'},
            {l:'💳 Payment',   v:debugInfo.payment||0,                          c:'bg-green-600/30 border-green-500/40',t:'text-green-300' },
            {l:'📋 Total',     v:reminders.length,                              c:'bg-slate-600/30 border-slate-500/40',t:'text-slate-300' },
          ].map((c,i)=>(<div key={i} className={`rounded-xl border p-3 text-center ${c.c}`}><p className={`text-2xl font-black ${c.t}`}>{c.v}</p><p className="text-slate-400 text-[10px] mt-0.5">{c.l}</p></div>))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f=>(<button key={f.t} onClick={()=>{setFilterType(f.t);setCurrentPage(1);}} className={`px-3 py-1 rounded-full text-[11px] font-bold transition ${filterType===f.t?`${f.bg} text-white shadow-lg`:'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{f.l}</button>))}
        </div>

        <Input value={searchTerm} onChange={e=>{setSearchTerm(e.target.value);setCurrentPage(1);}} placeholder="🔍 Customer, phone, vehicle, reg no..." className="bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 h-8 text-xs rounded-lg"/>

        {filtered.length===0?(
          <div className="text-center py-16"><CheckCircle size={48} className="text-green-500 mx-auto mb-3"/><p className="text-slate-400 font-bold">सब clear! कोई pending reminder नहीं।</p><p className="text-slate-600 text-xs mt-1">जब service due होगी, automatically यहाँ दिखेगी।</p></div>
        ):(<>
          <p className="text-slate-600 text-[10px]">{filtered.length} reminders · Page {currentPage}/{pages||1}</p>
          <div className="space-y-2.5">
            {paginated.map(r=>{
              const fups=followUps[r.id]||[];
              const isExp=expandedId===r.id;
              const isCrit=r.status==='critical';
              const lastFup=fups[fups.length-1];
              return(
                <div key={r.id} className={`rounded-xl overflow-hidden transition-all ${isCrit?'bg-gradient-to-r from-red-950/80 to-slate-800 ring-1 ring-red-500/30':'bg-gradient-to-r from-yellow-950/50 to-slate-800 ring-1 ring-yellow-500/20'}`}>
                  <div className="p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${isCrit?'bg-red-600 text-white':'bg-yellow-600 text-white'}`}>{isCrit?'OVERDUE':'UPCOMING'}</span>
                        {r.serviceType&&<span className="text-[9px] bg-blue-600/60 text-blue-200 px-2 py-0.5 rounded-full font-bold">{r.serviceType} Service</span>}
                        {r.type==='payment'&&<span className="text-[9px] bg-green-600/60 text-green-200 px-2 py-0.5 rounded-full font-bold">Payment</span>}
                        {r.type==='insurance'&&<span className="text-[9px] bg-purple-600/60 text-purple-200 px-2 py-0.5 rounded-full font-bold">RTO</span>}
                        {lastFup&&<span className={`text-[9px] px-2 py-0.5 rounded-full font-bold bg-slate-700 ${csColor(lastFup.status)}`}>{csLabel(lastFup.status)}</span>}
                        {lastFup?.nextCallDate&&<span className="text-[9px] bg-orange-900/60 text-orange-300 px-2 py-0.5 rounded-full font-bold">📅 Call: {fmtDate(lastFup.nextCallDate)}</span>}
                      </div>
                      <span className={`text-xs font-black ${r.daysRemaining<0?'text-red-400':r.daysRemaining===0?'text-red-300 animate-pulse':'text-yellow-400'}`}>{r.daysRemaining<0?`${Math.abs(r.daysRemaining)}d OVERDUE`:r.daysRemaining===0?'⚡ TODAY':`${r.daysRemaining}d left`}</span>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-sm">{r.title}</h3>
                        <p className="text-slate-400 text-[11px] mt-0.5">{r.description}</p>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span className="text-cyan-300 text-xs font-bold">👤 {r.customerName}</span>
                          {r.customerPhone&&<span className="text-slate-400 text-xs">📞 {r.customerPhone}</span>}
                          {r.vehicle&&<span className="text-blue-300 text-xs">🏍️ {r.vehicle}</span>}
                          {r.regNo&&<span className="text-slate-500 text-[10px] font-mono">{r.regNo}</span>}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-500">📅 Due: {r.dueDate instanceof Date?fmtDate(r.dueDate):r.dueDate}{r.amount>0&&<span className="ml-2 text-green-400 font-bold">₹{r.amount.toLocaleString('en-IN')}</span>}{fups.length>0&&<span className="ml-2 text-purple-400">📞 {fups.length} calls</span>}</div>
                        {lastFup?.note&&lastFup.note!=='—'&&(<div className="mt-1 text-[10px] text-slate-500 italic bg-slate-800/60 px-2 py-0.5 rounded">💬 "{lastFup.note}" — {fmtDate(lastFup.date)}</div>)}
                        {fups.length>0&&(<button onClick={()=>setExpandedId(isExp?null:r.id)} className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-green-400 hover:text-green-300 bg-green-900/30 px-2 py-0.5 rounded-full"><TrendingUp size={10}/> {fups.length} call history {isExp?<ChevronUp size={10}/>:<ChevronDown size={10}/>}</button>)}
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        {r.customerPhone&&(<a href={`tel:${r.customerPhone}`} className="bg-green-600 hover:bg-green-500 text-white text-[10px] px-2.5 py-1.5 rounded-lg font-bold text-center flex items-center gap-1"><Phone size={10}/> Call</a>)}
                        {r.customerPhone&&(<a href={`https://wa.me/91${r.customerPhone}?text=${getWAMessage(r)}`} target="_blank" rel="noreferrer" className="bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] px-2.5 py-1.5 rounded-lg font-bold text-center flex items-center gap-1"><MessageSquare size={10}/> WA</a>)}
                        <button onClick={()=>{setActiveR(r);setShowFU(true);}} className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1"><PhoneCall size={10}/> Log</button>
                        {r.type==='service'&&(<button onClick={()=>{setActiveR(r);setDoneForm({km:'',date:new Date().toISOString().split('T')[0],remarks:''});setShowDone(true);}} className="bg-orange-600 hover:bg-orange-500 text-white text-[10px] px-2.5 py-1.5 rounded-lg font-bold">✅ Done</button>)}
                        <button onClick={()=>navigate(`/customer-profile/${r.customerId}`)} className="bg-slate-600 hover:bg-slate-500 text-white text-[10px] px-2.5 py-1.5 rounded-lg font-bold">👁 View</button>
                      </div>
                    </div>
                    {isExp&&fups.length>0&&(
                      <div className="mt-3 bg-slate-900/70 rounded-lg p-3 border border-slate-700/50">
                        <p className="text-[10px] text-green-400 font-bold mb-2 flex items-center gap-1"><TrendingUp size={10}/> Call History</p>
                        {fups.map((f,i)=>(<div key={i} className="flex gap-2 text-[10px] py-1.5 border-b border-slate-800 last:border-0"><div className="flex-shrink-0 text-center w-20"><div className="text-slate-400">{fmtDate(f.date)}</div><div className="text-slate-600">{fmtTime(f.date)}</div></div><div className="flex-1"><span className={`font-bold ${csColor(f.status)}`}>{csLabel(f.status)}</span>{f.note&&f.note!=='—'&&<div className="text-slate-400 mt-0.5">💬 {f.note}</div>}{f.nextCallDate&&<div className="text-orange-400 mt-0.5">📅 Next: {fmtDate(f.nextCallDate)}</div>}<div className="text-slate-600">by {f.by||'Admin'}</div></div></div>))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {pages>1&&(<div className="flex items-center justify-between pt-2"><span className="text-[10px] text-slate-600">{currentPage}/{pages}</span><div className="flex gap-1.5"><button onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1} className="bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-lg disabled:opacity-30 hover:bg-slate-700 font-bold">◀ Prev</button><button onClick={()=>setCurrentPage(p=>Math.min(pages,p+1))} disabled={currentPage===pages} className="bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-lg disabled:opacity-30 hover:bg-slate-700 font-bold">Next ▶</button></div></div>)}
        </>)}

        <Card className="bg-slate-800/50 border-slate-700/50 rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-4 py-2.5 flex justify-between items-center">
            <span className="text-white text-sm font-bold">📄 Recent Invoices ({invoices.length})</span>
            <button onClick={()=>navigate('/invoice-management')} className="text-white/80 hover:text-white text-xs font-bold">सभी →</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]"><thead><tr className="border-b border-slate-700 bg-slate-800/50">{['#','Invoice','Customer','Vehicle','Amount','Date',''].map(h=>(<th key={h} className="text-left text-slate-400 py-2 px-2 font-bold">{h}</th>))}</tr></thead>
            <tbody>{invoices.slice(0,6).map((inv,i)=>(<tr key={i} className="border-b border-slate-800 hover:bg-slate-700/30 cursor-pointer" onClick={()=>navigate(`/invoice/${inv.invoiceNumber||inv.id}`)}><td className="py-1.5 px-2 text-slate-600">{i+1}</td><td className="py-1.5 px-2 text-white font-bold">#{inv.invoiceNumber||inv.id}</td><td className="py-1.5 px-2 text-slate-300">{inv.customerName||'—'}</td><td className="py-1.5 px-2 text-blue-300">{inv.vehicle||'—'}</td><td className="py-1.5 px-2 text-green-400 font-bold">₹{(inv.totals?.totalAmount||inv.amount||0).toLocaleString('en-IN')}</td><td className="py-1.5 px-2 text-slate-500">{fmtDate(inv.invoiceDate)}</td><td className="py-1.5 px-2"><span className="text-blue-400 text-[9px] font-bold">View →</span></td></tr>))}</tbody></table>
          </div>
        </Card>

        <p className="text-[9px] text-slate-700 text-center">Customers:{debugInfo.totalCustomers} | Invoices:{invoices.length} | Reminders:{reminders.length}</p>
      </div>

      {/* FOLLOW-UP MODAL */}
      {showFU&&activeR&&(
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={()=>setShowFU(false)}>
          <div className="bg-slate-800 rounded-2xl w-full max-w-md p-5 border border-slate-600 shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4"><h3 className="text-white font-black text-base flex items-center gap-2"><PhoneCall size={16}/> Follow-up Log</h3><button onClick={()=>setShowFU(false)} className="text-slate-400 hover:text-white"><X size={18}/></button></div>
            <div className="bg-slate-700/50 rounded-lg p-3 mb-4 text-sm">
              <p className="text-cyan-300 font-bold">{activeR.customerName}</p>
              <p className="text-slate-400 text-xs">{activeR.customerPhone} · {activeR.vehicle} · {activeR.regNo}</p>
              <p className="text-orange-300 text-xs mt-1">{activeR.title} · {activeR.daysRemaining<0?`${Math.abs(activeR.daysRemaining)} दिन overdue`:`${activeR.daysRemaining} दिन बाकी`}</p>
            </div>
            <div className="mb-4">
              <p className="text-slate-400 text-xs font-bold mb-2">📞 Call Status:</p>
              <div className="grid grid-cols-2 gap-2">
                {CALL_STATUS.map(s=>(<button key={s.value} onClick={()=>setFuForm(f=>({...f,status:s.value}))} className={`text-xs py-2 px-3 rounded-lg font-bold transition ${fuForm.status===s.value?s.color+' text-white ring-2 ring-white/30':'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>{s.label}</button>))}
              </div>
            </div>
            <div className="mb-4">
              <p className="text-slate-400 text-xs font-bold mb-2">💬 Remarks:</p>
              <textarea value={fuForm.note} onChange={e=>setFuForm(f=>({...f,note:e.target.value}))} placeholder="बात किसके साथ हुई, क्या बोले, कब आएंगे..." className="w-full bg-slate-700 border border-slate-600 text-white text-xs rounded-lg p-3 h-20 resize-none placeholder-slate-500 focus:outline-none focus:border-blue-500"/>
            </div>
            <div className="mb-5">
              <p className="text-slate-400 text-xs font-bold mb-2 flex items-center gap-1"><Calendar size={11}/> Next Follow-up Date:</p>
              <input type="date" value={fuForm.nextCallDate} onChange={e=>setFuForm(f=>({...f,nextCallDate:e.target.value}))} className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg p-2 focus:outline-none focus:border-blue-500"/>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setShowFU(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm py-2.5 rounded-xl font-bold">Cancel</button>
              <button onClick={submitFollowUp} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-sm py-2.5 rounded-xl font-bold">✅ Save Log</button>
            </div>
          </div>
        </div>
      )}

      {/* SERVICE DONE MODAL */}
      {showDone&&activeR&&(
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={()=>setShowDone(false)}>
          <div className="bg-slate-800 rounded-2xl w-full max-w-md p-5 border border-slate-600 shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4"><h3 className="text-white font-black text-base">✅ Service Done</h3><button onClick={()=>setShowDone(false)} className="text-slate-400 hover:text-white"><X size={18}/></button></div>
            <div className="bg-emerald-900/30 rounded-lg p-3 mb-4 border border-emerald-700/40">
              <p className="text-emerald-300 font-bold">{activeR.customerName}</p>
              <p className="text-slate-400 text-xs">{activeR.vehicle} · {activeR.regNo}</p>
              <p className="text-emerald-400 text-xs font-bold mt-1">{activeR.serviceType} Service complete करें</p>
            </div>
            <div className="space-y-3 mb-4">
              <div><p className="text-slate-400 text-xs font-bold mb-1">📅 Service Date:</p><input type="date" value={doneForm.date} onChange={e=>setDoneForm(f=>({...f,date:e.target.value}))} className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg p-2 focus:outline-none focus:border-emerald-500"/></div>
              <div><p className="text-slate-400 text-xs font-bold mb-1">🔢 Current KM:</p><input type="number" value={doneForm.km} onChange={e=>setDoneForm(f=>({...f,km:e.target.value}))} placeholder="जैसे: 12450" className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg p-2 focus:outline-none focus:border-emerald-500 placeholder-slate-500"/></div>
              <div><p className="text-slate-400 text-xs font-bold mb-1">💬 Remarks:</p><textarea value={doneForm.remarks} onChange={e=>setDoneForm(f=>({...f,remarks:e.target.value}))} placeholder="कौन से parts लगे, कोई note..." className="w-full bg-slate-700 border border-slate-600 text-white text-xs rounded-lg p-3 h-16 resize-none placeholder-slate-500 focus:outline-none focus:border-emerald-500"/></div>
            </div>
            <p className="text-slate-500 text-[10px] mb-3 bg-slate-700/50 rounded p-2">ℹ️ यह reminder automatically हट जाएगा। अगली service 120 दिन बाद automatically remind होगी।</p>
            <div className="flex gap-2">
              <button onClick={()=>setShowDone(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm py-2.5 rounded-xl font-bold">Cancel</button>
              <button onClick={submitDone} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm py-2.5 rounded-xl font-bold">✅ Mark Done & Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}