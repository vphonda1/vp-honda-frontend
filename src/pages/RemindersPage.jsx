import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, RefreshCw, Clock, Phone, PhoneCall, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, MessageSquare, Calendar, X, TrendingUp } from 'lucide-react';
import { api } from '../utils/apiConfig';
import { sendTestNotification, scheduleReminderNotifications, getReminderSummary } from '../utils/notificationScheduler';
import { requestNotificationPermission, showInAppToast } from '../utils/smartUtils';

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
  const name = (r.customerName||'').replace(/^\d+\s*/,'').split(' ')[0] || 'महोदय/महोदया';
  const due  = r.dueDate instanceof Date ? fmtDate(r.dueDate) : (r.dueDate||'');
  if (r.type === 'insurance-renewal') {
    const expiry = r.insuranceExpiryDate ? fmtDate(new Date(r.insuranceExpiryDate)) : 'जल्दी';
    return encodeURIComponent(`नमस्ते ${name} जी! 🙏\n\n*वी.पी. होंडा* की तरफ से महत्वपूर्ण सूचना:\n\n🛡️ आपकी *${r.vehicle||'गाड़ी'}* (${r.regNo||''}) का *First Party Insurance* जल्दी Expire होने वाला है।\n\n📅 Insurance Expiry: *${expiry}*\n📋 Renewal करने की Last Date: *${due}*\n\nसमय पर Renewal न करने पर:\n❌ आपकी गाड़ी Uninsured हो जाएगी\n❌ दुर्घटना में Coverage नहीं मिलेगी\n\n✅ अभी Renewal करवाएं!\n\n🏍️ वी.पी. होंडा, भोपाल\n📞 9713394738`);
  }
  const svcLabel = r.serviceType ? `${r.serviceType} सर्विस` : 'सर्विस';
  return encodeURIComponent(`नमस्ते ${name} जी! 🙏\n\nवी.पी. होंडा की तरफ से आपको याद दिलाना चाहते हैं कि आपकी *${r.vehicle||'गाड़ी'}* (${r.regNo}) की *${svcLabel}* की तारीख आ चुकी है।\n\n📅 सर्विस की तारीख: ${due}\n\nकृपया अपनी गाड़ी की सर्विस कराने के लिए हमारे शोरूम पर पधारें।\n\n🏍️ वी.पी. होंडा\nपरवलिया सड़क, भोपाल\n📞 9713394738`);
};

const detectServiceNumber = (inv) => {
  if (inv.serviceNumber && inv.serviceNumber >= 1 && inv.serviceNumber <= 7) return inv.serviceNumber;
  const txt = JSON.stringify({
    desc: inv.description || '',
    items: inv.items || inv.particulars || [],
    notes: inv.notes || '',
    type: inv.serviceType || inv.type || '',
  }).toLowerCase();
  if (/\b(1st|first|i\s*st)\s*(free\s*)?service\b/.test(txt)) return 1;
  if (/\b(2nd|second|ii\s*nd)\s*(free\s*)?service\b/.test(txt)) return 2;
  if (/\b(3rd|third|iii\s*rd)\s*(free\s*)?service\b/.test(txt)) return 3;
  if (/\b(4th|fourth|iv\s*th)\s*service\b/.test(txt)) return 4;
  if (/\b(5th|fifth|v\s*th)\s*service\b/.test(txt)) return 5;
  if (/\b(6th|sixth|vi\s*th)\s*service\b/.test(txt)) return 6;
  if (/\b(7th|seventh|vii\s*th)\s*service\b/.test(txt)) return 7;
  return null;
};

const isVehiclePurchase = (inv) => {
  if (inv.invoiceType === 'vehicle') return true;
  const txt = JSON.stringify({ desc: inv.description||'', items: inv.items||inv.particulars||[], type: inv.invoiceType||inv.type||'' }).toLowerCase();
  if (/\b(new\s*vehicle|vehicle\s*sale|chassis|engine\s*no|frame\s*no)\b/.test(txt)) return true;
  const total = parseFloat(inv.totalAmount || inv.total || inv.grandTotal || (inv.totals?.totalAmount) || 0);
  if (total >= 50000 && !/service/i.test(txt)) return true;
  return false;
};

const buildServiceData = (invoices) => {
  const sd = getLS('customerServiceData',{});
  const deletedKeys = new Set(getLS('deletedServiceKeys', []));
  invoices.forEach(inv => {
    const regNo = (inv.regNo||'').trim().toUpperCase();
    if (!regNo||regNo==='—'||regNo==='-') return;
    if (deletedKeys.has(regNo)) return;
    if (!sd[regNo]) sd[regNo]={};
    const e=sd[regNo];
    if(inv.customerName) e.customerName=inv.customerName;
    if(inv.customerPhone) e.phone=inv.customerPhone;
    if(inv.vehicle) e.vehicle=inv.vehicle;
    e.regNo=regNo;
    const d=inv.invoiceDate||'';
    if (!d) return;
    if (isVehiclePurchase(inv)) {
      if (!e.purchaseDate || new Date(d) < new Date(e.purchaseDate)) e.purchaseDate = d;
    }
    const sn = detectServiceNumber(inv);
    if (sn) {
      const km={1:'firstServiceDate',2:'secondServiceDate',3:'thirdServiceDate',4:'fourthServiceDate',5:'fifthServiceDate',6:'sixthServiceDate',7:'seventhServiceDate'};
      const k = km[sn];
      if (k && (!e[k] || new Date(d) > new Date(e[k]))) {
        e[k] = d;
        if (inv.serviceKm || inv.km) e[k.replace('Date','Km')] = inv.serviceKm || inv.km;
      }
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
  const [notifStatus,  setNotifStatus] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default');
  const [notifSummary, setNotifSummary] = useState(null);
  const [showDone,     setShowDone]    = useState(false);
  const [activeR,      setActiveR]     = useState(null);
  const [fuForm,       setFuForm]      = useState({status:'called',note:'',nextCallDate:''});
  const [doneForm,     setDoneForm]    = useState({km:'',date:new Date().toISOString().split('T')[0],remarks:''});
  const intervalRef = useRef(null);

  useEffect(()=>{
    loadAll();
    window.addEventListener('storage',loadAll);
    intervalRef.current=setInterval(loadAll,10000);
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
      try {
        const sdRes = await fetch(api('/api/service-data'));
        if (sdRes.ok) {
          const dbSD = await sdRes.json();
          const merged = { ...getLS('customerServiceData', {}) };
          dbSD.forEach(rec => {
            const reg = rec.regNo;
            if (!reg) return;
            if (!merged[reg]) merged[reg] = {};
            const fields = ['purchaseDate','firstServiceDate','firstServiceKm','secondServiceDate','secondServiceKm',
              'thirdServiceDate','thirdServiceKm','fourthServiceDate','fourthServiceKm',
              'fifthServiceDate','fifthServiceKm','sixthServiceDate','sixthServiceKm',
              'seventhServiceDate','seventhServiceKm','pendingAmount','paymentDueDate','insuranceDate',
              'insuranceStartDate','insuranceRenewalDate','insuranceRenewed'];
            fields.forEach(f => { if (rec[f]) merged[reg][f] = rec[f]; });
            if (rec.customerName) merged[reg].customerName = rec.customerName;
            if (rec.phone)        merged[reg].phone        = rec.phone;
            if (rec.vehicle)      merged[reg].vehicle      = rec.vehicle;
            merged[reg].regNo = reg;
          });
          setLS('customerServiceData', merged);
        }
      } catch(e) { console.log('service-data fetch failed:', e.message); }
      buildServiceData(all);
      try {
        const sdToSync = getLS('customerServiceData', {});
        if (Object.keys(sdToSync).length > 0) {
          fetch(api('/api/service-data/sync'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sdToSync),
          }).catch(() => {});
        }
      } catch {}
      try {
        const fuRes = await fetch(api('/api/follow-ups'));
        if (fuRes.ok) {
          const dbFU = await fuRes.json();
          const merged = { ...getLS('followUpLog', {}) };
          dbFU.forEach(entry => {
            const rid = entry.reminderId;
            if (!rid) return;
            if (!merged[rid]) merged[rid] = [];
            const exists = merged[rid].some(e => e.date === entry.date);
            if (!exists) merged[rid].push({ date:entry.date, status:entry.status, note:entry.note, nextCallDate:entry.nextCallDate, by:entry.by||'Admin' });
          });
          Object.keys(merged).forEach(k => merged[k].sort((a,b)=>new Date(a.date)-new Date(b.date)));
          setFollowUps(merged);
          setLS('followUpLog', merged);
        }
      } catch {}
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
      let dbg={totalCustomers:custs.length,payment:0,insurance:0,service:0,insuranceRenewal:0};
      const getC=(reg)=>custs.find(c=>(c.registrationNo||c.regNo||'').toUpperCase()===reg.toUpperCase());
      const today=new Date();today.setHours(0,0,0,0);
      Object.entries(sd).forEach(([regNo,data])=>{
        if(!regNo||regNo==='no_reg_') return;
        const cust=getC(regNo);
        const nm=data.customerName||cust?.customerName||cust?.name||'Unknown';
        const ph=data.phone||cust?.phone||'';
        const vh=data.vehicle||cust?.vehicleModel||'';
        const custId = cust?._id || regNo;
        const pend=parseFloat(data.pendingAmount||0);
        if(pend>0&&!data.paymentReceivedDate){
          let dr=999,dd=new Date();
          if(data.paymentDueDate){dd=new Date(data.paymentDueDate);dd.setHours(0,0,0,0);dr=Math.floor((dd-today)/86400000);}
          dbg.payment++;
          all.push({id:`pay-${regNo}`,type:'payment',serviceType:null,customerId:custId,customerName:nm,customerPhone:ph,vehicle:vh,regNo,
            title:'💳 Payment Due',description:`बकाया: ₹${pend.toLocaleString('en-IN')}`,
            daysRemaining:dr,status:dr<=3?'critical':'warning',dueDate:dd,amount:pend,
            lastCallStatus:fu[`pay-${regNo}`]?.slice(-1)[0]?.status||null,
            callCount:fu[`pay-${regNo}`]?.length||0});
        }
        if(data.insuranceDate&&!data.rtoDoneDate){
          const ins=new Date(data.insuranceDate);ins.setHours(0,0,0,0);
          const rto=new Date(ins.getTime()+7*864e5);const dr=Math.floor((rto-today)/864e5);
          if(dr>=0&&dr<=7){dbg.insurance++;
            all.push({id:`ins-${regNo}`,type:'insurance',serviceType:null,customerId:custId,customerName:nm,customerPhone:ph,vehicle:vh,regNo,
              title:'🚗 RTO Pending',description:`Insurance: ${fmtDate(data.insuranceDate)} | Deadline: ${fmtDate(rto)}`,
              daysRemaining:dr,status:dr<=1?'critical':'warning',dueDate:rto,
              lastCallStatus:fu[`ins-${regNo}`]?.slice(-1)[0]?.status||null,callCount:0});}
        }
        const lsInsKey   = `vp_ins_${regNo||custId}`;
        const lsRenewed  = localStorage.getItem(`vp_ins_renewed_${regNo||custId}`);
        const lsInsDate  = localStorage.getItem(lsInsKey);
        const insStartRaw = lsInsDate || data.insuranceStartDate || data.insuranceDate ||
          (data.purchaseDate ? new Date(new Date(data.purchaseDate).getTime() + 3*864e5).toISOString().split('T')[0] : null);
        if (insStartRaw && !data.insuranceRenewed && !lsRenewed) {
          const insStart = new Date(insStartRaw); insStart.setHours(0,0,0,0);
          const renewalDue = new Date(insStart.getTime() + 335*864e5);
          const dr = Math.floor((renewalDue - today) / 864e5);
          if (dr >= -30 && dr <= 60) {
            dbg.insuranceRenewal = (dbg.insuranceRenewal || 0) + 1;
            const insExpiry = new Date(insStart.getTime() + 365*864e5);
            all.push({ id: `insr-${regNo}`, type: 'insurance-renewal', serviceType: null, customerId: custId, customerName: nm, customerPhone: ph, vehicle: vh, regNo,
              title: dr <= 0 ? '🛡️ Insurance Expired!' : '🛡️ Insurance Renewal Due',
              description: `Insurance Start: ${fmtDate(insStart)} | Expiry: ${fmtDate(insExpiry)} | Renewal Due: ${fmtDate(renewalDue)}`,
              daysRemaining: dr, status: dr <= 0 ? 'critical' : dr <= 15 ? 'critical' : 'warning', dueDate: renewalDue,
              insuranceStartDate: insStartRaw, insuranceExpiryDate: insExpiry.toISOString().split('T')[0], isEstimated: !lsInsDate && !data.insuranceStartDate,
              lastCallStatus: fu[`insr-${regNo}`]?.slice(-1)[0]?.status || null, callCount: fu[`insr-${regNo}`]?.length || 0 });
          }
        }
        if(data.purchaseDate&&!data.firstServiceDate){
          const pd=new Date(data.purchaseDate);pd.setHours(0,0,0,0);
          const due=new Date(pd.getTime()+30*864e5);const dr=Math.floor((due-today)/864e5);
          const rid=`svc-1st-${regNo}`;
          if(dr>=-30){dbg.service++;
            all.push({id:rid,type:'service',serviceType:'1st',customerId:custId,customerName:nm,customerPhone:ph,vehicle:vh,regNo,
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
              all.push({id:rid,type:'service',serviceType:svc.next,customerId:custId,customerName:nm,customerPhone:ph,vehicle:vh,regNo,
                title:`🔧 ${svc.label} Due`,description:`पिछली: ${fmtDate(doneDate)} | Due: ${fmtDate(due)}`,
                daysRemaining:dr,status:dr<=0?'critical':'warning',dueDate:due,
                lastCallStatus:fu[rid]?.slice(-1)[0]?.status||null,callCount:fu[rid]?.length||0});}
            break;
          }
        }
      });
      all.sort((a,b)=>{if(a.status!==b.status)return a.status==='critical'?-1:1;return a.daysRemaining-b.daysRemaining;});
      setReminders(all);setDebugInfo(dbg);setLastRefresh(new Date());setLoading(false);
      // ✅ Summary for notification panel (from reminders array, not customers)
      const summary = {
        total: all.length,
        overdue: all.filter(r => r.daysRemaining < 0).length,
        today: all.filter(r => r.daysRemaining === 0).length,
        byType: {
          service: all.filter(r => r.type === 'service').length,
          payment: all.filter(r => r.type === 'payment').length,
          rto: all.filter(r => r.type === 'insurance').length,
          insuranceRenewal: all.filter(r => r.type === 'insurance-renewal').length,
        }
      };
      setNotifSummary(summary);
      // 🚀 IMMEDIATE PUSH FOR OVERDUE / TODAY REMINDERS
      if (notifStatus === 'granted') {
        const urgent = all.filter(r => r.daysRemaining <= 0);
        if (urgent.length > 0) {
          const payloadReminders = urgent.map(r => ({
            title: r.title,
            body: `${r.customerName} — ${r.description}`,
            url: '/reminders',
            tag: `reminder-${r.id}`
          }));
          try {
            const pushRes = await fetch('/api/send-immediate-reminders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reminders: payloadReminders })
            });
            if (pushRes.ok) console.log(`📱 Sent ${urgent.length} immediate pushes`);
            else console.error('Push send failed');
          } catch (err) {
            console.error('Push error:', err);
          }
        }
      }
    } catch(err) {
      console.error('buildReminders error:', err);
      setLoading(false);
    }
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
      await fetch(api(`/api/service-data/${activeR.regNo}`),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(sd[activeR.regNo])});
      await fetch(api('/api/follow-ups'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reminderId:activeR.id,customerName:activeR.customerName,phone:activeR.customerPhone,regNo:activeR.regNo,date:new Date().toISOString(),status:'done',note:`Service Done. KM:${doneForm.km}. ${doneForm.remarks}`,by:'Admin'})});
      setSyncMsg('✅ MongoDB sync हुआ — सभी devices पर दिखेगा');
    }catch{setSyncMsg('⚠️ Local save only');}
    setTimeout(()=>setSyncMsg(''),3000);
    setShowDone(false);setActiveR(null);setDoneForm({km:'',date:new Date().toISOString().split('T')[0],remarks:''});
    window.dispatchEvent(new Event('storage'));loadAll();
  };

  const cnt=(fn)=>reminders.filter(fn).length;
  const FILTERS=[
    {t:'all',l:'सभी',n:reminders.length,grad:'linear-gradient(135deg,#2563eb,#1d4ed8)'},
    {t:'pay',l:'💳 Payment',n:cnt(r=>r.type==='payment'),grad:'linear-gradient(135deg,#059669,#047857)'},
    {t:'ins',l:'🚗 RTO',n:cnt(r=>r.type==='insurance'),grad:'linear-gradient(135deg,#7c3aed,#6d28d9)'},
    {t:'insr',l:'🛡️ Insurance',n:cnt(r=>r.type==='insurance-renewal'),grad:'linear-gradient(135deg,#DC0000,#B91C1C)'},
    {t:'svc',l:'🔧 सर्विस',n:cnt(r=>r.type==='service'),grad:'linear-gradient(135deg,#ea580c,#c2410c)'},
    {t:'s1',l:'1st',n:cnt(r=>r.serviceType==='1st'),grad:'linear-gradient(135deg,#0284c7,#0369a1)'},
    {t:'s2',l:'2nd',n:cnt(r=>r.serviceType==='2nd'),grad:'linear-gradient(135deg,#d97706,#b45309)'},
    {t:'s3',l:'3rd',n:cnt(r=>r.serviceType==='3rd'),grad:'linear-gradient(135deg,#e11d48,#be123c)'},
    {t:'s4',l:'4th',n:cnt(r=>r.serviceType==='4th'),grad:'linear-gradient(135deg,#db2777,#be185d)'},
    {t:'s5',l:'5th',n:cnt(r=>r.serviceType==='5th'),grad:'linear-gradient(135deg,#4f46e5,#4338ca)'},
    {t:'s6',l:'6th',n:cnt(r=>r.serviceType==='6th'),grad:'linear-gradient(135deg,#0d9488,#0f766e)'},
    {t:'s7',l:'7th',n:cnt(r=>r.serviceType==='7th'),grad:'linear-gradient(135deg,#65a30d,#4d7c0f)'},
  ];
  const svcMap={s1:'1st',s2:'2nd',s3:'3rd',s4:'4th',s5:'5th',s6:'6th',s7:'7th'};
  const filtered=reminders.filter(r=>{
    if(filterType==='pay'&&r.type!=='payment') return false;
    if(filterType==='ins'&&r.type!=='insurance') return false;
    if(filterType==='insr'&&r.type!=='insurance-renewal') return false;
    if(filterType==='svc'&&r.type!=='service') return false;
    if(svcMap[filterType]&&r.serviceType!==svcMap[filterType]) return false;
    if(searchTerm){const s=searchTerm.toLowerCase();return[r.customerName,r.customerPhone,r.vehicle,r.regNo].some(v=>(v||'').toLowerCase().includes(s));}
    return true;
  });
  const pages=Math.ceil(filtered.length/PER_PAGE);
  const paginated=filtered.slice((currentPage-1)*PER_PAGE,currentPage*PER_PAGE);
  const todayCrit=reminders.filter(r=>r.status==='critical'&&r.daysRemaining<=0);
  const upcoming3=reminders.filter(r=>r.daysRemaining>0&&r.daysRemaining<=3);
  const csColor=(s)=>({called:'#22c55e',promised:'#3b82f6',no_answer:'#eab308',busy:'#f97316',later:'#a855f7',not_int:'#ef4444',done:'#10b981'}[s]||'#94a3b8');
  const csLabel=(s)=>CALL_STATUS.find(c=>c.value===s)?.label||s||'';
  const urgBar=(dr)=>dr<=0?{w:'100%',c:'#ef4444'}:dr<=3?{w:'75%',c:'#f97316'}:dr<=7?{w:'50%',c:'#eab308'}:{w:'20%',c:'#22c55e'};

  const S={
    page:{minHeight:'100vh',background:'linear-gradient(135deg,#050d1a 0%,#0a1628 50%,#0d1f35 100%)',fontFamily:"'Segoe UI',system-ui,sans-serif"},
    hdr:{background:'rgba(255,255,255,0.02)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'14px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'12px',position:'sticky',top:'0',zIndex:'20'},
    statC:(c)=>({background:`linear-gradient(135deg,${c}18,${c}06)`,border:`1px solid ${c}28`,borderRadius:'16px',padding:'14px 12px',textAlign:'center',transition:'transform 0.2s',cursor:'default',position:'relative',overflow:'hidden'}),
    card:(ic)=>({background:ic?'linear-gradient(135deg,rgba(127,29,29,0.22),rgba(10,16,30,0.97))':'linear-gradient(135deg,rgba(30,41,59,0.7),rgba(10,16,30,0.97))',border:ic?'1px solid rgba(239,68,68,0.22)':'1px solid rgba(255,255,255,0.06)',borderRadius:'18px',overflow:'hidden',transition:'all 0.2s',marginBottom:'10px'}),
    btn:(grad,shadow)=>({background:grad,border:'none',borderRadius:'10px',padding:'8px 11px',fontSize:'11px',fontWeight:'700',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',gap:'5px',boxShadow:shadow||'none',textDecoration:'none',transition:'opacity 0.15s',whiteSpace:'nowrap'}),
    inp:{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'14px',padding:'10px 16px 10px 42px',color:'#fff',fontSize:'13px',width:'100%',outline:'none',boxSizing:'border-box'},
    modal:{position:'fixed',inset:'0',background:'rgba(0,0,0,0.88)',backdropFilter:'blur(8px)',zIndex:'50',display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'},
    mbox:{background:'linear-gradient(135deg,#1e293b,#0f172a)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'22px',width:'100%',maxWidth:'460px',padding:'22px',boxShadow:'0 30px 80px rgba(0,0,0,0.7)'},
  };

  if(loading) return(
    <div style={{...S.page,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'14px'}}>
      <div style={{width:'52px',height:'52px',borderRadius:'50%',border:'3px solid rgba(99,179,237,0.12)',borderTop:'3px solid #63b3ed',animation:'sp 1s linear infinite'}}/>
      <p style={{color:'#63b3ed',fontSize:'13px',fontWeight:'700',letterSpacing:'2px'}}>LOADING...</p>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return(
    <div style={S.page}>
      {todayCrit.length>0&&(
        <div style={{background:'linear-gradient(90deg,#7f1d1d,#991b1b)',overflow:'hidden'}} onMouseEnter={()=>setTickerPause(true)} onMouseLeave={()=>setTickerPause(false)}>
          <div style={{display:'flex',alignItems:'center',height:'34px'}}>
            <span style={{background:'rgba(0,0,0,0.4)',padding:'0 12px',height:'100%',display:'flex',alignItems:'center',gap:'5px',fontSize:'10px',fontWeight:'900',color:'#fca5a5',flexShrink:'0',letterSpacing:'1px'}}>
              <AlertTriangle size={10}/> URGENT {todayCrit.length}
            </span>
            <div style={{overflow:'hidden',flex:'1'}}>
              <div style={{display:'flex',gap:'28px',whiteSpace:'nowrap',animation:tickerPause?'none':'tk 40s linear infinite'}}>
                {todayCrit.map((r,i)=>(<span key={i} style={{fontSize:'11px',color:'#fecaca',fontWeight:'600',display:'inline-flex',alignItems:'center',gap:'8px'}}>🚨 {r.customerName} — {r.title} — {r.vehicle} ({r.regNo}) — {Math.abs(r.daysRemaining)}d overdue {r.customerPhone&&<span style={{opacity:'.55'}}>📞{r.customerPhone}</span>} <span style={{color:'#fca5a5',margin:'0 6px'}}>•</span></span>))}
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes tk{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}} @keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}} .hov:hover{opacity:0.82} .sc:hover{transform:scale(1.04)} .rc:hover{transform:translateY(-1px);box-shadow:0 8px 28px rgba(0,0,0,0.35)!important}`}</style>

      <div style={S.hdr}>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <div style={{width:'40px',height:'40px',borderRadius:'12px',background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 18px rgba(59,130,246,0.35)'}}>
            <Bell size={19} color="#fff"/>
          </div>
          <div>
            <h1 style={{color:'#f1f5f9',fontSize:'19px',fontWeight:'800',margin:'0',letterSpacing:'-0.3px'}}>Service Reminders</h1>
            <p style={{color:'#475569',fontSize:'11px',margin:'2px 0 0'}}>{greet()} · {fmtTime(lastRefresh)} · {new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</p>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          {syncMsg&&<span style={{fontSize:'11px',fontWeight:'700',color:'#4ade80',background:'rgba(74,222,128,0.1)',border:'1px solid rgba(74,222,128,0.18)',padding:'4px 10px',borderRadius:'20px'}}>{syncMsg}</span>}
          <button onClick={()=>{setLoading(true);setTimeout(loadAll,200);}} className="hov" style={S.btn('linear-gradient(135deg,#3b82f6,#1d4ed8)','0 4px 14px rgba(59,130,246,0.28)')}>
            <RefreshCw size={13}/> Refresh
          </button>
        </div>
      </div>

      <div style={{padding:'18px 22px',maxWidth:'1200px',margin:'0 auto'}}>

        <div style={{
          background: notifStatus === 'granted' ? 'linear-gradient(135deg, #16a34a22, #16a34a08)' : 'linear-gradient(135deg, #1e3a8a22, #1e3a8a08)',
          border: `1px solid ${notifStatus === 'granted' ? '#16a34a55' : '#3b82f655'}`,
          borderRadius: 12, padding: '12px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{fontSize: 24}}>{notifStatus === 'granted' ? '🔔' : notifStatus === 'denied' ? '🔕' : '🔔'}</div>
          <div style={{flex: 1, minWidth: 200}}>
            {notifStatus === 'granted' ? (
              <>
                <p style={{color:'#86efac', fontWeight:700, fontSize:13, margin:0}}>✅ Phone Notifications चालू हैं</p>
                {notifSummary ? (
                  <div style={{marginTop:6, display:'flex', gap:10, flexWrap:'wrap'}}>
                    {[
                      { label:'🔧 Service',   val: notifSummary.byType?.service || 0, color:'#ea580c' },
                      { label:'💰 Payment',   val: notifSummary.byType?.payment || 0, color:'#16a34a' },
                      { label:'🚗 RTO',       val: notifSummary.byType?.rto || 0, color:'#7c3aed' },
                      { label:'🛡️ Insurance', val: notifSummary.byType?.insuranceRenewal || 0, color:'#DC0000' },
                    ].map((t,i) => (
                      <div key={i} style={{background:`${t.color}22`, border:`1px solid ${t.color}55`, borderRadius:6, padding:'3px 10px', display:'flex', gap:5, alignItems:'center'}}>
                        <span style={{color:t.color, fontWeight:800, fontSize:14}}>{t.val}</span>
                        <span style={{color:'#94a3b8', fontSize:10, fontWeight:600}}>{t.label}</span>
                      </div>
                    ))}
                    <div style={{background:'#fbbf2422', border:'1px solid #fbbf2455', borderRadius:6, padding:'3px 10px', display:'flex', gap:5, alignItems:'center'}}>
                      <span style={{color:'#fbbf24', fontWeight:800, fontSize:14}}>{notifSummary.overdue || 0}</span>
                      <span style={{color:'#94a3b8', fontSize:10, fontWeight:600}}>🚨 Overdue</span>
                    </div>
                    <div style={{background:'#3b82f622', border:'1px solid #3b82f655', borderRadius:6, padding:'3px 10px', display:'flex', gap:5, alignItems:'center'}}>
                      <span style={{color:'#60a5fa', fontWeight:800, fontSize:14}}>{notifSummary.today || 0}</span>
                      <span style={{color:'#94a3b8', fontSize:10, fontWeight:600}}>📅 आज</span>
                    </div>
                  </div>
                ) : (
                  <p style={{color:'#64748b', fontSize:11, margin:'3px 0 0'}}>Service, Payment, RTO, Insurance — सब reminders automatically phone पर आएंगे</p>
                )}
              </>
            ) : notifStatus === 'denied' ? (
              <>
                <p style={{color: '#fca5a5', fontWeight: 700, fontSize: 13, margin: 0}}>🔕 Notifications blocked हैं</p>
                <p style={{color: '#64748b', fontSize: 11, margin: '3px 0 0'}}>Browser settings में VP Honda को allow करें: Settings → Site Settings → Notifications</p>
              </>
            ) : (
              <>
                <p style={{color: '#93c5fd', fontWeight: 700, fontSize: 13, margin: 0}}>📱 Phone पर Reminder Notifications चालू करें</p>
                <p style={{color: '#64748b', fontSize: 11, margin: '3px 0 0'}}>एक बार allow करें — service due होने पर automatic notification आएगी, app बंद हो तब भी</p>
              </>
            )}
          </div>
          <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
            {notifStatus !== 'granted' && notifStatus !== 'denied' && (
              <button onClick={async () => {
                const granted = await requestNotificationPermission();
                setNotifStatus(Notification.permission);
                if (granted) showInAppToast('🔔 Notifications enabled!', 'अब reminders automatic आएंगे', 'success');
              }} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                🔔 Allow Notifications
              </button>
            )}
            {notifStatus === 'granted' && (
              <>
                <button onClick={async () => {
                  try {
                    const res = await fetch('/api/test-push-notification', { method: 'POST' });
                    const data = await res.json();
                    showInAppToast('📱 Test notification भेजी!', data.message || 'Check your phone', 'success');
                  } catch(err) { showInAppToast('❌ Failed', err.message, 'error'); }
                }} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', padding: '8px 12px', borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  🧪 Test करें
                </button>
                <button onClick={async () => {
                  await scheduleReminderNotifications([]);
                  showInAppToast('🔄 Reminders scheduled', 'Next check on next refresh', 'info');
                }} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  ↻ Re-schedule
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:'10px',marginBottom:'18px'}}>
          {[
            {l:'Overdue',v:todayCrit.length,c:'#ef4444',i:'🚨',s:'तत्काल'},
            {l:'3 दिन',v:upcoming3.length,c:'#f97316',i:'⚡',s:'आने वाले'},
            {l:'1st',v:cnt(r=>r.serviceType==='1st'),c:'#06b6d4',i:'🔧',s:'pending'},
            {l:'2nd',v:cnt(r=>r.serviceType==='2nd'),c:'#3b82f6',i:'🔧',s:'pending'},
            {l:'3rd',v:cnt(r=>r.serviceType==='3rd'),c:'#8b5cf6',i:'🔧',s:'pending'},
            {l:'4th–7th',v:cnt(r=>['4th','5th','6th','7th'].includes(r.serviceType)),c:'#14b8a6',i:'🔧',s:'pending'},
            {l:'Payment',v:debugInfo.payment||0,c:'#22c55e',i:'💳',s:'बकाया'},
            {l:'Total',v:reminders.length,c:'#94a3b8',i:'📋',s:'reminders'},
          ].map((s,i)=>(
            <div key={i} className="sc" style={S.statC(s.c)}>
              <div style={{position:'absolute',top:'8px',right:'9px',fontSize:'16px',opacity:'0.25'}}>{s.i}</div>
              <p style={{fontSize:'30px',fontWeight:'900',color:s.c,margin:'0',lineHeight:'1.1',letterSpacing:'-1px'}}>{s.v}</p>
              <p style={{fontSize:'11px',fontWeight:'700',color:'#94a3b8',margin:'4px 0 1px'}}>{s.l}</p>
              <p style={{fontSize:'9px',color:'#334155',textTransform:'uppercase',letterSpacing:'0.5px',margin:'0'}}>{s.s}</p>
            </div>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:'10px',marginBottom:'14px'}}>
          {[
            {label:'📊 Data Manager',  path:'/customer-data-manager', grad:'linear-gradient(135deg,#7c3aed,#6d28d9)', shadow:'rgba(124,58,237,0.3)'},
            {label:'🔍 Diagnostic',    path:'/diagnostic',             grad:'linear-gradient(135deg,#0284c7,#0369a1)', shadow:'rgba(2,132,199,0.3)'},
            {label:'📁 Invoices',      path:'/invoice-management',     grad:'linear-gradient(135deg,#ea580c,#c2410c)', shadow:'rgba(234,88,12,0.3)'},
            {label:'👥 Service List',  path:'/service-customers',  grad:'linear-gradient(135deg,#059669,#047857)', shadow:'rgba(5,150,105,0.3)'},
          ].map((btn,i)=>(
            <button key={i} onClick={()=>navigate(btn.path)} className="hov"
              style={{background:btn.grad,border:'none',borderRadius:'12px',padding:'11px 14px',color:'#fff',fontSize:'12px',fontWeight:'700',cursor:'pointer',boxShadow:`0 3px 14px ${btn.shadow}`,textAlign:'center',letterSpacing:'0.2px'}}>
              {btn.label}
            </button>
          ))}
        </div>

        <div style={{display:'flex',flexWrap:'wrap',gap:'7px',marginBottom:'14px'}}>
          {FILTERS.map(f=>(
            <button key={f.t} onClick={()=>{setFilterType(f.t);setCurrentPage(1);}}
              style={{background:filterType===f.t?f.grad:'rgba(255,255,255,0.04)',border:filterType===f.t?'none':'1px solid rgba(255,255,255,0.08)',borderRadius:'20px',padding:'5px 12px',color:filterType===f.t?'#fff':'#94a3b8',cursor:'pointer',transition:'all 0.2s',fontSize:'12px',fontWeight:'700',display:'flex',alignItems:'center',gap:'6px',boxShadow:filterType===f.t?'0 3px 14px rgba(0,0,0,0.3)':'none'}}>
              {f.l}
              <span style={{background:'rgba(0,0,0,0.22)',borderRadius:'10px',padding:'1px 7px',fontSize:'11px',fontWeight:'900'}}>{f.n}</span>
            </button>
          ))}
        </div>

        <div style={{position:'relative',marginBottom:'14px'}}>
          <span style={{position:'absolute',left:'13px',top:'50%',transform:'translateY(-50%)',fontSize:'14px',pointerEvents:'none'}}>🔍</span>
          <input value={searchTerm} onChange={e=>{setSearchTerm(e.target.value);setCurrentPage(1);}} placeholder="Customer name, phone, vehicle, reg no खोजें..."
            style={S.inp}
            onFocus={e=>{e.target.style.borderColor='rgba(59,130,246,0.45)';e.target.style.background='rgba(59,130,246,0.04)';}}
            onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,0.1)';e.target.style.background='rgba(255,255,255,0.04)';}}
          />
          {filtered.length>0&&<span style={{position:'absolute',right:'13px',top:'50%',transform:'translateY(-50%)',color:'#334155',fontSize:'11px',fontWeight:'600'}}>{filtered.length} results</span>}
        </div>

        {filtered.length===0?(
          <div style={{textAlign:'center',padding:'72px 20px',animation:'fi 0.4s ease'}}>
            <div style={{width:'68px',height:'68px',borderRadius:'50%',background:'rgba(34,197,94,0.08)',border:'2px solid rgba(34,197,94,0.18)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}>
              <CheckCircle size={34} color="#22c55e"/>
            </div>
            <p style={{color:'#f1f5f9',fontWeight:'800',fontSize:'17px',margin:'0 0 7px'}}>सब Clear! 🎉</p>
            <p style={{color:'#475569',fontSize:'13px',margin:'0'}}>कोई pending reminder नहीं है।</p>
          </div>
        ):(
          <div>
            <p style={{color:'#334155',fontSize:'11px',marginBottom:'10px',fontWeight:'600'}}>{filtered.length} reminders · Page {currentPage}/{pages||1}</p>
            {paginated.map((r,idx)=>{
              const fups=followUps[r.id]||[];
              const isExp=expandedId===r.id;
              const isCrit=r.status==='critical';
              const lastFup=fups[fups.length-1];
              const bar=urgBar(r.daysRemaining);
              return(
                <div key={r.id} className="rc" style={S.card(isCrit)}>
                  <div style={{height:'3px',background:`linear-gradient(90deg,${bar.c},transparent)`,width:bar.w,transition:'width 0.5s'}}/>
                  <div style={{padding:'14px 16px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px',flexWrap:'wrap',gap:'7px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'7px',flexWrap:'wrap'}}>
                        <span style={{background:isCrit?'rgba(239,68,68,0.14)':'rgba(234,179,8,0.1)',border:`1px solid ${isCrit?'rgba(239,68,68,0.35)':'rgba(234,179,8,0.28)'}`,color:isCrit?'#fca5a5':'#fde047',fontSize:'9px',fontWeight:'800',padding:'2px 8px',borderRadius:'20px',letterSpacing:'0.5px'}}>
                          {isCrit?'● OVERDUE':'◐ UPCOMING'}
                        </span>
                        {r.serviceType&&<span style={{background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.22)',color:'#93c5fd',fontSize:'9px',fontWeight:'700',padding:'2px 8px',borderRadius:'20px'}}>{r.serviceType} Service</span>}
                        {r.type==='payment'&&<span style={{background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.22)',color:'#86efac',fontSize:'9px',fontWeight:'700',padding:'2px 8px',borderRadius:'20px'}}>💳 Payment</span>}
                        {r.type==='insurance'&&<span style={{background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.22)',color:'#c4b5fd',fontSize:'9px',fontWeight:'700',padding:'2px 8px',borderRadius:'20px'}}>🚗 RTO</span>}
                        {r.type==='insurance-renewal'&&<span style={{background:'rgba(220,0,0,0.15)',border:'1px solid rgba(220,0,0,0.4)',color:'#fca5a5',fontSize:'9px',fontWeight:'700',padding:'2px 8px',borderRadius:'20px'}}>🛡️ 1st Party</span>}
                        {r.type==='insurance-renewal'&&r.isEstimated&&<span style={{background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.3)',color:'#fbbf24',fontSize:'9px',fontWeight:'600',padding:'2px 8px',borderRadius:'20px'}}>⚠️ Estimated</span>}
                        {lastFup&&<span style={{background:'rgba(255,255,255,0.05)',color:csColor(lastFup.status),fontSize:'9px',fontWeight:'700',padding:'2px 8px',borderRadius:'20px'}}>{csLabel(lastFup.status)}</span>}
                        {lastFup?.nextCallDate&&<span style={{background:'rgba(249,115,22,0.1)',border:'1px solid rgba(249,115,22,0.18)',color:'#fdba74',fontSize:'9px',fontWeight:'600',padding:'2px 8px',borderRadius:'20px'}}>📅 {fmtDate(lastFup.nextCallDate)}</span>}
                      </div>
                      <div style={{textAlign:'right',flexShrink:'0'}}>
                        <span style={{fontSize:'24px',fontWeight:'900',color:r.daysRemaining<0?'#ef4444':r.daysRemaining===0?'#ef4444':'#facc15',lineHeight:'1',display:'block'}}>{r.daysRemaining<0?Math.abs(r.daysRemaining):r.daysRemaining}</span>
                        <span style={{fontSize:'8px',fontWeight:'700',color:'#475569',textTransform:'uppercase',letterSpacing:'0.5px'}}>{r.daysRemaining<0?'दिन OVER':r.daysRemaining===0?'आज!':'दिन बाकी'}</span>
                      </div>
                    </div>

                    <div style={{display:'flex',gap:'14px',alignItems:'flex-start'}}>
                      <div style={{flex:'1',minWidth:'0'}}>
                        <h3 style={{color:'#f1f5f9',fontWeight:'800',fontSize:'14px',margin:'0 0 4px'}}>{r.title}</h3>
                        <p style={{color:'#64748b',fontSize:'11px',margin:'0 0 9px'}}>{r.description}</p>
                        <div style={{display:'flex',flexWrap:'wrap',gap:'10px',alignItems:'center',padding:'9px 13px',background:'rgba(255,255,255,0.03)',borderRadius:'11px',border:'1px solid rgba(255,255,255,0.05)'}}>
                          <div style={{display:'flex',alignItems:'center',gap:'7px'}}>
                            <div style={{width:'26px',height:'26px',borderRadius:'50%',background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',flexShrink:'0'}}>👤</div>
                            <div>
                              <p style={{color:'#e2e8f0',fontWeight:'700',fontSize:'12px',margin:'0'}}>{r.customerName}</p>
                              {r.regNo&&<p style={{color:'#475569',fontSize:'9px',margin:'0',fontFamily:'monospace'}}>{r.regNo}</p>}
                            </div>
                          </div>
                          {r.customerPhone&&<span style={{color:'#94a3b8',fontSize:'11px'}}><a href={`tel:${r.customerPhone}`} style={{color:'#94a3b8',textDecoration:'none'}}>📞 {r.customerPhone}</a></span>}
                          {r.vehicle&&<span style={{color:'#7dd3fc',fontSize:'11px'}}>🏍️ {r.vehicle}</span>}
                          {r.amount>0&&<span style={{color:'#4ade80',fontWeight:'700',fontSize:'11px'}}>₹{r.amount.toLocaleString('en-IN')}</span>}
                        </div>
                        {lastFup?.note&&lastFup.note!=='—'&&(
                          <div style={{marginTop:'7px',padding:'6px 11px',background:'rgba(255,255,255,0.02)',borderRadius:'8px',borderLeft:'2px solid rgba(139,92,246,0.35)'}}>
                            <span style={{color:'#94a3b8',fontSize:'10px',fontStyle:'italic'}}>💬 "{lastFup.note}"</span>
                            <span style={{color:'#1e293b',fontSize:'9px',marginLeft:'7px'}}>— {fmtDate(lastFup.date)}</span>
                          </div>
                        )}
                        {fups.length>0&&(
                          <button onClick={()=>setExpandedId(isExp?null:r.id)}
                            style={{marginTop:'7px',background:'none',border:'1px solid rgba(34,197,94,0.18)',borderRadius:'8px',padding:'4px 11px',color:'#4ade80',fontSize:'10px',fontWeight:'600',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'5px'}}>
                            <TrendingUp size={10}/> {fups.length} call logs {isExp?'▲':'▼'}
                          </button>
                        )}
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:'6px',flexShrink:'0'}}>
                        {r.customerPhone&&<a href={`tel:${r.customerPhone}`} className="hov" style={S.btn('linear-gradient(135deg,#16a34a,#15803d)','0 2px 10px rgba(22,163,74,0.25)')}><Phone size={10}/> Call</a>}
                        {r.customerPhone&&<a href={`https://wa.me/91${r.customerPhone}?text=${getWAMessage(r)}`} target="_blank" rel="noreferrer" className="hov" style={S.btn('linear-gradient(135deg,#059669,#047857)','0 2px 10px rgba(5,150,105,0.25)')}><MessageSquare size={10}/> WA</a>}
                        <button onClick={()=>{setActiveR(r);setShowFU(true);}} className="hov" style={S.btn('linear-gradient(135deg,#7c3aed,#6d28d9)','0 2px 10px rgba(124,58,237,0.25)')}><PhoneCall size={10}/> Log</button>
                        {r.type==='service'&&<button onClick={()=>{setActiveR(r);setDoneForm({km:'',date:new Date().toISOString().split('T')[0],remarks:''});setShowDone(true);}} className="hov" style={S.btn('linear-gradient(135deg,#ea580c,#c2410c)','0 2px 10px rgba(234,88,12,0.25)')}>✅ Done</button>}
                        {r.type==='insurance-renewal'&&<button onClick={()=>{
                          const newDate = prompt(`📅 Insurance Date enter करें (YYYY-MM-DD):\n\nCurrent: ${r.insuranceStartDate||'Not set'}\n\nखरीद के 2-3 दिन बाद की date डालें`);
                          if(!newDate) return;
                          if(!/^\d{4}-\d{2}-\d{2}$/.test(newDate)){alert('Format: YYYY-MM-DD\nExample: 2024-04-15');return;}
                          const key=`vp_ins_${r.regNo||r.customerId}`;
                          localStorage.setItem(key,newDate);
                          alert(`✅ Insurance date saved!\n\nPage refresh करें — नया reminder calculate होगा।`);
                          loadAll();
                        }} className="hov" style={S.btn('linear-gradient(135deg,#0369a1,#0284c7)','0 2px 10px rgba(3,105,161,0.25)')}>✏️ Edit Date</button>}
                        {r.type==='insurance-renewal'&&<button onClick={()=>{
                          if(!window.confirm(`${r.customerName} का Insurance Renewed mark करना है?`)) return;
                          const key=`vp_ins_renewed_${r.regNo||r.customerId}`;
                          localStorage.setItem(key,'true');
                          alert('✅ Marked as Renewed! अगले साल का reminder automatic set होगा।');
                          loadAll();
                        }} className="hov" style={S.btn('linear-gradient(135deg,#16a34a,#15803d)','0 2px 10px rgba(22,163,74,0.25)')}>🛡️ Renewed</button>}
                        <button onClick={()=>navigate(`/customer-profile/${r.customerId}`)} className="hov" style={S.btn('linear-gradient(135deg,#1e293b,#0f172a)','none')}>👁 View</button>
                      </div>
                    </div>

                    {isExp&&fups.length>0&&(
                      <div style={{marginTop:'12px',background:'rgba(0,0,0,0.28)',borderRadius:'13px',padding:'13px',border:'1px solid rgba(255,255,255,0.05)',animation:'fi 0.2s ease'}}>
                        <p style={{color:'#4ade80',fontSize:'10px',fontWeight:'700',margin:'0 0 9px',display:'flex',alignItems:'center',gap:'5px'}}><TrendingUp size={10}/> Call History ({fups.length})</p>
                        {fups.map((f,i)=>(
                          <div key={i} style={{display:'flex',gap:'11px',padding:'7px 0',borderBottom:i<fups.length-1?'1px solid rgba(255,255,255,0.04)':'none',alignItems:'flex-start'}}>
                            <div style={{flexShrink:'0',minWidth:'62px'}}>
                              <div style={{color:'#64748b',fontSize:'9px'}}>{fmtDate(f.date)}</div>
                              <div style={{color:'#1e293b',fontSize:'8px'}}>{fmtTime(f.date)}</div>
                            </div>
                            <div style={{flex:'1'}}>
                              <span style={{fontWeight:'700',fontSize:'10px',color:csColor(f.status)}}>{csLabel(f.status)}</span>
                              {f.note&&f.note!=='—'&&<div style={{color:'#94a3b8',fontSize:'10px',marginTop:'2px'}}>💬 {f.note}</div>}
                              {f.nextCallDate&&<div style={{color:'#fdba74',fontSize:'9px',marginTop:'2px'}}>📅 अगली: {fmtDate(f.nextCallDate)}</div>}
                            </div>
                            <span style={{color:'#1e293b',fontSize:'8px'}}>{f.by||'Admin'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {pages>1&&(
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'14px',padding:'11px 16px',background:'rgba(255,255,255,0.02)',borderRadius:'13px',border:'1px solid rgba(255,255,255,0.05)'}}>
                <span style={{color:'#334155',fontSize:'11px',fontWeight:'600'}}>Page {currentPage} / {pages}</span>
                <div style={{display:'flex',gap:'8px'}}>
                  <button onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1}
                    style={{background:currentPage===1?'rgba(255,255,255,0.02)':'rgba(59,130,246,0.12)',border:'1px solid rgba(59,130,246,0.18)',borderRadius:'9px',padding:'6px 15px',color:currentPage===1?'#1e293b':'#93c5fd',fontSize:'12px',fontWeight:'700',cursor:currentPage===1?'default':'pointer'}}>
                    ◀ Prev
                  </button>
                  <button onClick={()=>setCurrentPage(p=>Math.min(pages,p+1))} disabled={currentPage===pages}
                    style={{background:currentPage===pages?'rgba(255,255,255,0.02)':'rgba(59,130,246,0.12)',border:'1px solid rgba(59,130,246,0.18)',borderRadius:'9px',padding:'6px 15px',color:currentPage===pages?'#1e293b':'#93c5fd',fontSize:'12px',fontWeight:'700',cursor:currentPage===pages?'default':'pointer'}}>
                    Next ▶
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{marginTop:'18px',background:'rgba(255,255,255,0.02)',borderRadius:'18px',border:'1px solid rgba(255,255,255,0.05)',overflow:'hidden'}}>
          <div style={{background:'linear-gradient(135deg,#ea580c,#c2410c)',padding:'12px 18px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{color:'#fff',fontWeight:'800',fontSize:'13px'}}>📄 Recent Invoices ({invoices.length})</span>
            <button onClick={()=>navigate('/invoice-management')} style={{background:'rgba(255,255,255,0.14)',border:'none',borderRadius:'8px',padding:'4px 12px',color:'#fff',fontSize:'11px',fontWeight:'700',cursor:'pointer'}}>सभी →</button>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
              <thead><tr style={{borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                {['#','Invoice','Customer','Vehicle','Amount','Date',''].map(h=>(<th key={h} style={{textAlign:'left',color:'#334155',padding:'9px 13px',fontWeight:'700',fontSize:'10px',textTransform:'uppercase',letterSpacing:'0.5px'}}>{h}</th>))}
              \)</thead>
              <tbody>
                {invoices.slice(0,6).map((inv,i)=>(
                  <tr key={i} style={{borderBottom:'1px solid rgba(255,255,255,0.03)',cursor:'pointer',transition:'background 0.12s'}}
                    onClick={()=>navigate(`/invoice/${inv.invoiceNumber||inv.id}`)}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.025)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{padding:'9px 13px',color:'#1e293b'}}>{i+1}</td>
                    <td style={{padding:'9px 13px',color:'#e2e8f0',fontWeight:'700'}}>#{inv.invoiceNumber||inv.id}</td>
                    <td style={{padding:'9px 13px',color:'#cbd5e1'}}>{inv.customerName||'—'}</td>
                    <td style={{padding:'9px 13px',color:'#7dd3fc'}}>{inv.vehicle||'—'}</td>
                    <td style={{padding:'9px 13px',color:'#4ade80',fontWeight:'700'}}>₹{(inv.totals?.totalAmount||inv.amount||0).toLocaleString('en-IN')}</td>
                    <td style={{padding:'9px 13px',color:'#475569'}}>{fmtDate(inv.invoiceDate)}</td>
                    <td style={{padding:'9px 13px'}}><span style={{color:'#3b82f6',fontSize:'9px',fontWeight:'700'}}>View →</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p style={{textAlign:'center',color:'#1e293b',fontSize:'9px',marginTop:'10px'}}>VP Honda · Parwaliya Sadak, Bhopal · {reminders.length} reminders · {invoices.length} invoices</p>
      </div>

      {showFU&&activeR&&(
        <div style={S.modal} onClick={()=>setShowFU(false)}>
          <div style={S.mbox} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'18px'}}>
              <h3 style={{color:'#f1f5f9',fontWeight:'800',fontSize:'16px',margin:'0',display:'flex',alignItems:'center',gap:'8px'}}><PhoneCall size={16} color="#a78bfa"/> Follow-up Log</h3>
              <button onClick={()=>setShowFU(false)} style={{background:'rgba(255,255,255,0.06)',border:'none',borderRadius:'50%',width:'30px',height:'30px',color:'#94a3b8',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><X size={15}/></button>
            </div>
            <div style={{background:'rgba(255,255,255,0.04)',borderRadius:'13px',padding:'13px',marginBottom:'16px',border:'1px solid rgba(255,255,255,0.07)'}}>
              <p style={{color:'#93c5fd',fontWeight:'800',fontSize:'13px',margin:'0 0 3px'}}>{activeR.customerName}</p>
              <p style={{color:'#64748b',fontSize:'11px',margin:'0 0 5px'}}>{activeR.customerPhone} · {activeR.vehicle} · {activeR.regNo}</p>
              <span style={{background:activeR.daysRemaining<0?'rgba(239,68,68,0.1)':'rgba(234,179,8,0.1)',color:activeR.daysRemaining<0?'#fca5a5':'#fde047',fontSize:'10px',fontWeight:'700',padding:'2px 9px',borderRadius:'9px'}}>{activeR.title} · {activeR.daysRemaining<0?`${Math.abs(activeR.daysRemaining)} दिन overdue`:`${activeR.daysRemaining} दिन बाकी`}</span>
            </div>
            <p style={{color:'#334155',fontSize:'10px',fontWeight:'700',marginBottom:'9px',textTransform:'uppercase',letterSpacing:'0.5px'}}>📞 Call Status</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'7px',marginBottom:'14px'}}>
              {CALL_STATUS.map(s=>(
                <button key={s.value} onClick={()=>setFuForm(f=>({...f,status:s.value}))}
                  style={{background:fuForm.status===s.value?({'called':'linear-gradient(135deg,#16a34a,#15803d)','promised':'linear-gradient(135deg,#2563eb,#1d4ed8)','no_answer':'linear-gradient(135deg,#ca8a04,#a16207)','busy':'linear-gradient(135deg,#ea580c,#c2410c)','later':'linear-gradient(135deg,#7c3aed,#6d28d9)','not_int':'linear-gradient(135deg,#dc2626,#b91c1c)'}[s.value]):'rgba(255,255,255,0.04)',
                    border:fuForm.status===s.value?'none':'1px solid rgba(255,255,255,0.07)',
                    borderRadius:'10px',padding:'9px',color:'#fff',fontSize:'11px',fontWeight:'700',cursor:'pointer',transition:'all 0.18s'}}>
                  {s.label}
                </button>
              ))}
            </div>
            <p style={{color:'#334155',fontSize:'10px',fontWeight:'700',marginBottom:'7px',textTransform:'uppercase',letterSpacing:'0.5px'}}>💬 Remarks</p>
            <textarea value={fuForm.note} onChange={e=>setFuForm(f=>({...f,note:e.target.value}))} placeholder="बात किसके साथ हुई, क्या बोले, कब आएंगे..."
              style={{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:'11px',padding:'11px',color:'#f1f5f9',fontSize:'12px',height:'72px',resize:'none',outline:'none',boxSizing:'border-box',fontFamily:'inherit',marginBottom:'13px'}}/>
            <p style={{color:'#334155',fontSize:'10px',fontWeight:'700',marginBottom:'7px',textTransform:'uppercase',letterSpacing:'0.5px',display:'flex',alignItems:'center',gap:'5px'}}><Calendar size={10}/> Next Follow-up Date</p>
            <input type="date" value={fuForm.nextCallDate} onChange={e=>setFuForm(f=>({...f,nextCallDate:e.target.value}))}
              style={{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:'11px',padding:'9px 13px',color:'#f1f5f9',fontSize:'12px',outline:'none',boxSizing:'border-box',marginBottom:'18px'}}/>
            <div style={{display:'flex',gap:'9px'}}>
              <button onClick={()=>setShowFU(false)} style={{flex:'1',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:'13px',padding:'11px',color:'#94a3b8',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>Cancel</button>
              <button onClick={submitFollowUp} style={{flex:'1',background:'linear-gradient(135deg,#7c3aed,#6d28d9)',border:'none',borderRadius:'13px',padding:'11px',color:'#fff',fontSize:'12px',fontWeight:'800',cursor:'pointer',boxShadow:'0 4px 18px rgba(124,58,237,0.35)'}}>✅ Save Log</button>
            </div>
          </div>
        </div>
      )}

      {showDone&&activeR&&(
        <div style={S.modal} onClick={()=>setShowDone(false)}>
          <div style={S.mbox} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'18px'}}>
              <h3 style={{color:'#f1f5f9',fontWeight:'800',fontSize:'16px',margin:'0'}}>✅ Service Done</h3>
              <button onClick={()=>setShowDone(false)} style={{background:'rgba(255,255,255,0.06)',border:'none',borderRadius:'50%',width:'30px',height:'30px',color:'#94a3b8',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><X size={15}/></button>
            </div>
            <div style={{background:'rgba(16,185,129,0.07)',borderRadius:'13px',padding:'13px',marginBottom:'16px',border:'1px solid rgba(16,185,129,0.18)'}}>
              <p style={{color:'#6ee7b7',fontWeight:'800',fontSize:'13px',margin:'0 0 3px'}}>{activeR.customerName}</p>
              <p style={{color:'#64748b',fontSize:'11px',margin:'0 0 5px'}}>{activeR.vehicle} · {activeR.regNo}</p>
              <span style={{background:'rgba(16,185,129,0.12)',color:'#34d399',fontSize:'10px',fontWeight:'700',padding:'2px 9px',borderRadius:'9px'}}>{activeR.serviceType} Service complete</span>
            </div>
            {[{label:'📅 Service Date',type:'date',val:doneForm.date,k:'date'},{label:'🔢 Current KM',type:'number',val:doneForm.km,k:'km',ph:'जैसे: 12450'}].map(f=>(
              <div key={f.k} style={{marginBottom:'12px'}}>
                <p style={{color:'#334155',fontSize:'10px',fontWeight:'700',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.5px'}}>{f.label}</p>
                <input type={f.type} value={f.val} onChange={e=>setDoneForm(d=>({...d,[f.k]:e.target.value}))} placeholder={f.ph||''}
                  style={{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:'11px',padding:'9px 13px',color:'#f1f5f9',fontSize:'12px',outline:'none',boxSizing:'border-box'}}/>
              </div>
            ))}
            <div style={{marginBottom:'14px'}}>
              <p style={{color:'#334155',fontSize:'10px',fontWeight:'700',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.5px'}}>💬 Remarks</p>
              <textarea value={doneForm.remarks} onChange={e=>setDoneForm(f=>({...f,remarks:e.target.value}))} placeholder="कौन से parts लगे, कोई note..."
                style={{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:'11px',padding:'11px',color:'#f1f5f9',fontSize:'12px',height:'60px',resize:'none',outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <p style={{background:'rgba(255,255,255,0.03)',borderRadius:'9px',padding:'9px 12px',borderLeft:'3px solid rgba(16,185,129,0.35)',color:'#334155',fontSize:'10px',margin:'0 0 14px'}}>ℹ️ यह reminder हट जाएगा। अगली service 120 दिन बाद automatically remind होगी।</p>
            <div style={{display:'flex',gap:'9px'}}>
              <button onClick={()=>setShowDone(false)} style={{flex:'1',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:'13px',padding:'11px',color:'#94a3b8',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>Cancel</button>
              <button onClick={submitDone} style={{flex:'1',background:'linear-gradient(135deg,#059669,#047857)',border:'none',borderRadius:'13px',padding:'11px',color:'#fff',fontSize:'12px',fontWeight:'800',cursor:'pointer',boxShadow:'0 4px 18px rgba(5,150,105,0.35)'}}>✅ Mark Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
