import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Settings, Users, Database, Edit2, Trash2, Shield, Plus,
  Download, Upload, Save, Bell, Clock, CheckCircle, XCircle,
  TrendingUp, Activity, Search, Eye, EyeOff, RefreshCw
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { api } from '../utils/apiConfig';

const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];

// ─── helpers ────────────────────────────────────────────────────────────────
const fmtINR = (n) => '₹' + (Math.round(n)||0).toLocaleString('en-IN');
const fmtL   = (n) => {
  n = Math.round(n||0);
  if (n >= 100000) return '₹'+(n/100000).toFixed(2)+'L';
  if (n >= 1000)   return '₹'+(n/1000).toFixed(1)+'K';
  return '₹'+n;
};

const parseTime24 = (s) => {
  if (!s) return { h:0, m:0 };
  const low = s.toLowerCase();
  const parts = low.replace(/[apm\s]/g,'').split(':');
  let h = parseInt(parts[0]||0), m = parseInt(parts[1]||0);
  if (low.includes('pm') && h!==12) h+=12;
  if (low.includes('am') && h===12) h=0;
  return { h, m };
};
const isLate = (t) => { const {h,m} = parseTime24(t); return h>9||(h===9&&m>30); };

const countSundays = (year, month) => {
  let c=0, d=new Date(year,month,1);
  while (d.getMonth()===month) { if(d.getDay()===0) c++; d.setDate(d.getDate()+1); }
  return c;
};

// ─── VP Honda salary rules ───────────────────────────────────────────────────
const calcNetSalary = (monthlySalary, absentDays, sundays, lateDays) => {
  const perDay = monthlySalary / 26;
  let ded = 0;
  if (absentDays === 0)                        ded = 0;
  else if (absentDays >= 8 && absentDays <= 10) ded = 15 * perDay;
  else if (absentDays > 4)                      ded = (absentDays + sundays) * perDay;
  else                                          ded = absentDays * perDay;
  const latePen = lateDays * 50;
  const extraLate = lateDays > 5 ? perDay : 0;
  return { deduction: ded + latePen + extraLate, net: Math.max(0, monthlySalary - ded - latePen - extraLate) };
};

// ════════════════════════════════════════════════════════════════════════════
export default function AdminPanel({ user }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  // ── data ────────────────────────────────────────────────────────────────
  const [staffList,        setStaffList]        = useState([]);
  const [attendanceRecords,setAttendanceRecords] = useState({});
  const [paymentHistory,   setPaymentHistory]   = useState({});
  const [incentiveData,    setIncentiveData]    = useState({});
  const [users,            setUsers]            = useState([
    { _id:'u1', name:'Admin User',   email:'admin@vphonda.com',  role:'admin',   createdAt:'2026-01-10' },
    { _id:'u2', name:'Staff Member', email:'staff@vphonda.com',  role:'staff',   createdAt:'2026-01-15' },
  ]);
  const [settings, setSettings] = useState({
    companyName:'VP HONDA', address:'Parwaliya Sadak, Bhopal (M.P.) - 462001',
    phone:'9713394738', email:'vphonda1@gmail.com', gstin:'23BCYPD9538B1ZG',
    headerText:'VP HONDA', footerText:'', invoicePrefix:'VPH-', logoUrl:'',
    emailInvoice:true, dailyReport:true, smsNotify:false,
    lateThreshold:'09:30', workEnd:'19:00',
  });
  const [backupList, setBackupList] = useState([
    { id:1, label:'Auto Backup', date:'2026-03-30 02:00 AM', size:'25.4 MB', type:'auto' },
    { id:2, label:'Manual',      date:'2026-03-29 11:45 AM', size:'24.8 MB', type:'manual' },
  ]);
  const [backupSchedule, setBackupSchedule] = useState('daily');

  // ── staff form ───────────────────────────────────────────────────────────
  const emptyStaff = {
    name:'', father:'', phone:'', email:'', aadharNo:'', panNo:'',
    position:'Mechanic', monthlySalary:0,
    joinDate:new Date().toISOString().split('T')[0],
    bankAccount:'', ifscCode:'', bankBranch:'', bankName:'', pin:'1234'
  };
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editStaffId,   setEditStaffId]   = useState(null);
  const [staffForm,     setStaffForm]     = useState(emptyStaff);
  const [staffSearch,   setStaffSearch]   = useState('');

  // ── user form ────────────────────────────────────────────────────────────
  const emptyUser = { name:'', email:'', role:'staff', password:'' };
  const [showUserForm, setShowUserForm] = useState(false);
  const [editUserId,   setEditUserId]   = useState(null);
  const [userForm,     setUserForm]     = useState(emptyUser);
  const [userSearch,   setUserSearch]   = useState('');
  const [showUserPw,   setShowUserPw]   = useState(false);

  // ── report filters ───────────────────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear,  setSelectedYear]  = useState(new Date().getFullYear());

  // ── load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = () => {
    try { const s=localStorage.getItem('staffData');       if(s) setStaffList(JSON.parse(s));        } catch {}
    try { const a=localStorage.getItem('staffAttendance'); if(a) setAttendanceRecords(JSON.parse(a)); } catch {}
    try { const p=localStorage.getItem('staffPayments');   if(p) setPaymentHistory(JSON.parse(p));   } catch {}
    try { const i=localStorage.getItem('staffIncentives'); if(i) setIncentiveData(JSON.parse(i));    } catch {}
    try { const u=localStorage.getItem('adminUsers');      if(u) setUsers(JSON.parse(u));            } catch {}
    try { const st=localStorage.getItem('adminSettings');  if(st) setSettings(JSON.parse(st));       } catch {}
    try { const bk=localStorage.getItem('adminBackups');   if(bk) setBackupList(JSON.parse(bk));     } catch {}
  };

  const saveStaffLS  = (l) => { try { localStorage.setItem('staffData',       JSON.stringify(l)); } catch {} };
  const saveUsersLS  = (l) => { try { localStorage.setItem('adminUsers',      JSON.stringify(l)); } catch {} };
  const saveSettingsLS=(s) => { try { localStorage.setItem('adminSettings',   JSON.stringify(s)); } catch {} };
  const saveBackupsLS= (b) => { try { localStorage.setItem('adminBackups',    JSON.stringify(b)); } catch {} };

  // ════════════════════════════════════════════════════════════════════════
  // SALARY CALCULATION (VP Honda rules)
  // ════════════════════════════════════════════════════════════════════════
  const getStaffStats = (staffId, month, year) => {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) return {};
    const att   = (attendanceRecords[staffId]||[]).filter(a => {
      const d = new Date(a.date);
      return d.getMonth()===month && d.getFullYear()===year;
    });
    const suns    = countSundays(year, month);
    const wDays   = new Date(year,month+1,0).getDate() - suns;
    const present = att.length;
    const absent  = Math.max(0, wDays - present);
    const late    = att.filter(a => a.checkInTime && isLate(a.checkInTime)).length;
    const { deduction, net } = calcNetSalary(staff.monthlySalary, absent, suns, late);
    const monthInc = (incentiveData[staffId]||[]).filter(i => i.month===month+1 && i.year===year);
    const incAmt   = monthInc.filter(i=>i.type!=='insurance').reduce((s,i)=>s+i.amount,0);
    const insAmt   = monthInc.filter(i=>i.type==='insurance').reduce((s,i)=>s+i.amount,0);
    const netFinal = Math.max(0, net + incAmt - insAmt);
    const paid = ((paymentHistory[staffId]||[]).filter(p => {
      const d=new Date(p.date); return d.getMonth()===month && d.getFullYear()===year;
    })).reduce((s,p)=>s+p.amount,0);
    return {
      name:staff.name, position:staff.position, monthlySalary:staff.monthlySalary,
      presentDays:present, absentDays:absent, lateDays:late,
      deduction, netSalary:netFinal, totalPaid:paid, balance:netFinal-paid
    };
  };

  const getMonthlyData = () => {
    const stats = staffList.map(s => getStaffStats(s.id, selectedMonth, selectedYear));
    return {
      staffStats:stats,
      totalSalaries:  stats.reduce((s,r)=>s+(r.monthlySalary||0),0),
      totalPaid:      stats.reduce((s,r)=>s+(r.totalPaid||0),0),
      totalDeductions:stats.reduce((s,r)=>s+(r.deduction||0),0),
      totalBalance:   stats.reduce((s,r)=>s+(r.balance||0),0),
      totalNet:       stats.reduce((s,r)=>s+(r.netSalary||0),0),
    };
  };

  const monthlyData = getMonthlyData();

  // ── today info ───────────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().split('T')[0];
  const todayPresent = staffList.filter(s => (attendanceRecords[s.id]||[]).find(a=>a.date===todayStr)).length;
  const todayAbsent  = staffList.length - todayPresent;

  // ── notifications ────────────────────────────────────────────────────────
  const notifications = staffList.flatMap(s => {
    const rec = (attendanceRecords[s.id]||[]).find(a=>a.date===todayStr);
    const bal = getStaffStats(s.id, new Date().getMonth(), new Date().getFullYear()).balance || 0;
    const evts = [];
    if (!rec) evts.push({ type:'absent', icon:'❌', msg:`${s.name} — आज absent`, color:'red' });
    else {
      if (rec.checkInTime && isLate(rec.checkInTime))
        evts.push({ type:'late', icon:'⚡', msg:`${s.name} — लेट Check-in: ${rec.checkInTime}`, color:'orange' });
      else if (rec.checkInTime)
        evts.push({ type:'ok', icon:'🟢', msg:`${s.name} — Check-in: ${rec.checkInTime}`, color:'green' });
      if (rec.checkOutTime)
        evts.push({ type:'out', icon:'🔴', msg:`${s.name} — Check-out: ${rec.checkOutTime}`, color:'gray' });
    }
    if (bal > 0) evts.push({ type:'salary', icon:'💰', msg:`${s.name} — बकाया: ${fmtINR(bal)}`, color:'yellow' });
    return evts;
  });

  // ── 7-day attendance ─────────────────────────────────────────────────────
  const last7 = Array.from({length:7}).map((_,i) => {
    const d = new Date(); d.setDate(d.getDate()-6+i);
    const k = d.toISOString().split('T')[0];
    let present=0, late=0;
    staffList.forEach(s => {
      const rec = (attendanceRecords[s.id]||[]).find(a=>a.date===k);
      if (rec) { present++; if(rec.checkInTime&&isLate(rec.checkInTime)) late++; }
    });
    return { date:d.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}), present, absent:staffList.length-present, late };
  });

  // ── position distribution ────────────────────────────────────────────────
  const positionPie = Object.entries(
    staffList.reduce((acc,s) => { acc[s.position]=(acc[s.position]||0)+1; return acc; }, {})
  ).map(([name,value])=>({name,value}));

  // ── chart data ───────────────────────────────────────────────────────────
  const salaryChart = monthlyData.staffStats.map(r => ({
    name: (r.name||'').split(' ')[0],
    'Basic': r.monthlySalary||0,
    'Net Salary': r.netSalary||0,
    'Paid': r.totalPaid||0,
  }));
  const attendanceChart = monthlyData.staffStats.map(r => ({
    name: (r.name||'').split(' ')[0],
    'उपस्थित': r.presentDays||0,
    'अनुपस्थित': r.absentDays||0,
    'लेट': r.lateDays||0,
  }));
  const balanceChart = monthlyData.staffStats.map(r => ({
    name: (r.name||'').split(' ')[0],
    'Net Salary': r.netSalary||0,
    'Deduction': r.deduction||0,
    'Balance': Math.abs(r.balance||0),
  }));

  // ════════════════════════════════════════════════════════════════════════
  // STAFF CRUD
  // ════════════════════════════════════════════════════════════════════════
  const openAddStaff  = () => { setStaffForm(emptyStaff); setEditStaffId(null); setShowStaffForm(true); };
  const openEditStaff = (s) => { setStaffForm({...s}); setEditStaffId(s.id); setShowStaffForm(true); };
  const saveStaffForm = () => {
    if (!staffForm.name || !staffForm.monthlySalary) { alert('नाम और वेतन जरूरी है'); return; }
    const updated = editStaffId
      ? staffList.map(s => s.id===editStaffId ? {...staffForm} : s)
      : [...staffList, { ...staffForm, id:Date.now(), createdAt:new Date().toISOString() }];
    setStaffList(updated); saveStaffLS(updated);
    setShowStaffForm(false); setEditStaffId(null);
    alert(editStaffId ? '✅ Update हो गया!' : '✅ कर्मचारी जोड़ा गया!');
  };
  const deleteStaff = (id) => {
    if (!window.confirm('हटाना है?')) return;
    const u = staffList.filter(s=>s.id!==id); setStaffList(u); saveStaffLS(u);
  };

  // ════════════════════════════════════════════════════════════════════════
  // USER CRUD
  // ════════════════════════════════════════════════════════════════════════
  const openAddUser  = () => { setUserForm(emptyUser); setEditUserId(null); setShowUserForm(true); };
  const openEditUser = (u) => { setUserForm({...u, password:''}); setEditUserId(u._id); setShowUserForm(true); };
  const saveUserForm = () => {
    if (!userForm.name || !userForm.email) { alert('नाम और ईमेल जरूरी है'); return; }
    let updated;
    if (editUserId) {
      updated = users.map(u => u._id===editUserId ? {...u, name:userForm.name, email:userForm.email, role:userForm.role} : u);
    } else {
      updated = [...users, { _id:'u'+Date.now(), name:userForm.name, email:userForm.email, role:userForm.role, createdAt:new Date().toISOString().split('T')[0] }];
    }
    setUsers(updated); saveUsersLS(updated);
    setShowUserForm(false); setEditUserId(null);
    alert(editUserId ? '✅ User update हो गया!' : '✅ User जोड़ा गया!');
  };
  const deleteUser = (id) => {
    if (users.find(u=>u._id===id)?.role==='admin') { alert('Admin को नहीं हटा सकते'); return; }
    if (!window.confirm('User हटाना है?')) return;
    const u = users.filter(u=>u._id!==id); setUsers(u); saveUsersLS(u);
  };

  // ════════════════════════════════════════════════════════════════════════
  // BACKUP
  // ════════════════════════════════════════════════════════════════════════
  const createBackup = () => {
    const data = { staffList, attendanceRecords, paymentHistory, incentiveData, users, settings };
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `VPHonda_Backup_${todayStr}.json`;
    a.click(); URL.revokeObjectURL(a.href);
    const nb = [{ id:Date.now(), label:'Manual Backup', date:new Date().toLocaleString('en-IN'), size:'~MB', type:'manual' }, ...backupList];
    setBackupList(nb); saveBackupsLS(nb);
    alert('✅ Backup download हो गया!');
  };
  const restoreBackup = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        if (d.staffList)        { setStaffList(d.staffList);               localStorage.setItem('staffData',       JSON.stringify(d.staffList)); }
        if (d.attendanceRecords){ setAttendanceRecords(d.attendanceRecords);localStorage.setItem('staffAttendance', JSON.stringify(d.attendanceRecords)); }
        if (d.paymentHistory)   { setPaymentHistory(d.paymentHistory);     localStorage.setItem('staffPayments',   JSON.stringify(d.paymentHistory)); }
        if (d.settings)         { setSettings(d.settings);                 saveSettingsLS(d.settings); }
        alert('✅ Restore सफल!');
      } catch { alert('❌ Invalid file'); }
    };
    r.readAsText(file);
    e.target.value = '';
  };

  // ════════════════════════════════════════════════════════════════════════
  // CSV EXPORT
  // ════════════════════════════════════════════════════════════════════════
  const exportToCSV = () => {
    let csv = `Staff Report — ${MONTHS_FULL[selectedMonth]} ${selectedYear}\n\n`;
    csv += 'Name,Position,Basic Salary,Present,Absent,Late,Deduction,Net Salary,Paid,Balance\n';
    monthlyData.staffStats.forEach(r => {
      csv += `"${r.name}","${r.position}",${r.monthlySalary},${r.presentDays},${r.absentDays},${r.lateDays},${(r.deduction||0).toFixed(0)},${(r.netSalary||0).toFixed(0)},${r.totalPaid},${(r.balance||0).toFixed(0)}\n`;
    });
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `StaffReport_${MONTHS_SHORT[selectedMonth]}_${selectedYear}.csv`;
    a.click();
  };

  // ════════════════════════════════════════════════════════════════════════
  // ACCESS GUARD
  // ════════════════════════════════════════════════════════════════════════
  if (user?.role !== 'admin') {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 border-2 border-red-500 rounded-xl p-10 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-black text-red-900 mb-3">Access Denied</h2>
          <p className="text-red-700 font-medium">यह panel सिर्फ Admin users के लिए है।</p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 shadow-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚙️</span>
            <div>
              <span className="text-white font-black text-lg tracking-wide">Admin Panel</span>
              <span className="text-slate-400 text-xs block">VP Honda Dealership · Bhopal</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-green-700 text-green-200 text-xs font-bold px-3 py-1 rounded-full">✅ Admin</span>
            <button onClick={loadAllData} className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-colors" title="Refresh">
              <RefreshCw size={16}/>
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto">
          {[
            { id:'dashboard', icon:'📊', label:'Dashboard'        },
            { id:'staff',     icon:'👥', label:'Staff Management' },
            { id:'reports',   icon:'📈', label:'Staff Reports'    },
            { id:'users',     icon:'👤', label:'Users'            },
            { id:'settings',  icon:'⚙️', label:'Settings'         },
            { id:'backup',    icon:'💾', label:'Backup'           },
          ].map(t => (
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              className={`px-5 py-3 text-sm font-bold whitespace-nowrap transition border-b-2 ${
                activeTab===t.id ? 'border-blue-400 text-blue-300 bg-white/5' : 'border-transparent text-slate-400 hover:text-white'
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">

        {/* ═══════════════════════════════════════════════════════════════════
            DASHBOARD TAB
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-gray-800">📊 Dashboard Overview</h2>

            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label:'Total Staff',    val:staffList.length,     icon:'👥', col:'blue'   },
                { label:'आज उपस्थित',    val:todayPresent,          icon:'✅', col:'green'  },
                { label:'आज Absent',      val:todayAbsent,           icon:'❌', col:'red'    },
                { label:'इस माह बकाया',   val:fmtL(Math.max(0,monthlyData.totalBalance)), icon:'⏳', col:'orange' },
              ].map((k,i)=>(
                <Card key={i} className={`border-l-4 border-${k.col}-500`}>
                  <CardContent className="pt-5 pb-4">
                    <div className="text-2xl mb-1">{k.icon}</div>
                    <div className={`text-2xl font-black text-${k.col}-600`}>{k.val}</div>
                    <div className="text-xs text-gray-500 mt-1">{k.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 3-col: system info | staff summary | salary summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Activity size={16}/> System Status</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {[['Frontend','Live',true],['localStorage','Connected',true],['Admin Session','Active',true],['Last Backup','2h ago',true]].map(([l,v,ok],i)=>(
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-gray-500">{l}</span>
                      <span className={`font-bold flex items-center gap-1 ${ok?'text-green-600':'text-red-500'}`}>
                        {ok?<CheckCircle size={13}/>:<XCircle size={13}/>} {v}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Users size={16}/> Staff Summary</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-bold">{staffList.length}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">आज Present</span><span className="font-bold text-green-600">{todayPresent}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">आज Absent</span><span className="font-bold text-red-500">{todayAbsent}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">आज Late</span>
                    <span className="font-bold text-orange-500">
                      {staffList.filter(s=>{const r=(attendanceRecords[s.id]||[]).find(a=>a.date===todayStr);return r?.checkInTime&&isLate(r.checkInTime);}).length}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp size={16}/> Salary (इस माह)</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    ['कुल Basic',   fmtL(monthlyData.totalSalaries),'text-gray-800'],
                    ['Net Payable', fmtL(monthlyData.totalNet),     'text-blue-600'],
                    ['दिया गया',    fmtL(monthlyData.totalPaid),    'text-green-600'],
                    ['बकाया',       fmtL(Math.max(0,monthlyData.totalBalance)),'text-orange-600'],
                  ].map(([l,v,c],i)=>(
                    <div key={i} className="flex justify-between">
                      <span className="text-gray-500">{l}</span>
                      <span className={'font-bold '+c}>{v}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* 7-day attendance chart */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">📅 पिछले 7 दिनों की Attendance</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={last7} barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="date" tick={{fontSize:11}}/>
                    <YAxis tick={{fontSize:11}} allowDecimals={false}/>
                    <Tooltip/>
                    <Legend/>
                    <Bar dataKey="present" name="उपस्थित"   fill="#10b981" radius={[3,3,0,0]}/>
                    <Bar dataKey="absent"  name="अनुपस्थित" fill="#ef4444" radius={[3,3,0,0]}/>
                    <Bar dataKey="late"    name="लेट"       fill="#f59e0b" radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Bell size={16}/> 🔔 आज की Notifications ({notifications.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {notifications.length===0 ? (
                  <p className="text-center text-gray-400 py-4">कोई notification नहीं।</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {notifications.map((n,i)=>(
                      <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm border-l-4 ${
                        n.type==='absent'?'bg-red-50 border-red-400':n.type==='late'?'bg-orange-50 border-orange-400':n.type==='salary'?'bg-yellow-50 border-yellow-400':'bg-green-50 border-green-400'}`}>
                        <span className="text-base">{n.icon}</span>
                        <span className="text-gray-700 font-medium">{n.msg}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STAFF MANAGEMENT TAB
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <h2 className="text-2xl font-black text-gray-800">👥 Staff Management</h2>
              <Button onClick={openAddStaff} className="bg-green-600 hover:bg-green-700 text-white font-bold">
                <Plus size={18} className="mr-2"/> नया कर्मचारी
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <Input value={staffSearch} onChange={e=>setStaffSearch(e.target.value)} placeholder="नाम, पद या फोन खोजें..." className="pl-9 border-2"/>
            </div>

            {/* Staff Form */}
            {showStaffForm && (
              <Card className="border-2 border-blue-400 bg-blue-50/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{editStaffId ? '✏️ कर्मचारी संपादित करें' : '➕ नया कर्मचारी जोड़ें'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Basic fields */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[['नाम *','name','text'],['पिता का नाम','father','text'],['फोन','phone','text'],
                      ['ईमेल','email','email'],['आधार नंबर','aadharNo','text'],['PAN','panNo','text']].map(([l,f,t])=>(
                      <div key={f}>
                        <label className="text-gray-600 text-xs font-semibold mb-1 block">{l}</label>
                        <Input type={t} value={staffForm[f]||''} placeholder={l}
                          onChange={e=>setStaffForm({...staffForm,[f]:f==='panNo'?e.target.value.toUpperCase():e.target.value})}
                          className="border-2"/>
                      </div>
                    ))}
                    <div>
                      <label className="text-gray-600 text-xs font-semibold mb-1 block">पद</label>
                      <select value={staffForm.position} onChange={e=>setStaffForm({...staffForm,position:e.target.value})}
                        className="w-full border-2 rounded-md px-3 py-2 text-sm bg-white">
                        <option>Mechanic</option><option>Sales Executive</option><option>Helper</option>
                        <option>Manager</option><option>Receptionist</option><option>Accountant</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-600 text-xs font-semibold mb-1 block">मासिक वेतन (₹) *</label>
                      <Input type="number" value={staffForm.monthlySalary||''} onChange={e=>setStaffForm({...staffForm,monthlySalary:parseFloat(e.target.value)||0})} className="border-2"/>
                    </div>
                    <div>
                      <label className="text-gray-600 text-xs font-semibold mb-1 block">Join Date</label>
                      <Input type="date" value={staffForm.joinDate||''} onChange={e=>setStaffForm({...staffForm,joinDate:e.target.value})} className="border-2"/>
                    </div>
                  </div>

                  {/* Bank Details */}
                  <div className="pt-2 border-t border-blue-200">
                    <p className="text-blue-700 text-xs font-bold mb-3">🏦 Bank Details</p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {[['Account No.','bankAccount','खाता नंबर'],['IFSC Code','ifscCode','SBIN0001234'],
                        ['Bank Name','bankName','State Bank of India'],['Branch','bankBranch','Branch Name']].map(([l,f,ph])=>(
                        <div key={f}>
                          <label className="text-gray-600 text-xs font-semibold mb-1 block">{l}</label>
                          <Input value={staffForm[f]||''} placeholder={ph}
                            onChange={e=>setStaffForm({...staffForm,[f]:f==='ifscCode'?e.target.value.toUpperCase():e.target.value})}
                            className="border-2"/>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Login PIN */}
                  <div className="pt-2 border-t border-blue-200">
                    <p className="text-purple-700 text-xs font-bold mb-3">🔐 Staff Login PIN</p>
                    <div className="max-w-xs">
                      <label className="text-gray-600 text-xs font-semibold mb-1 block">PIN (4-6 अंक) — Default: 1234</label>
                      <Input type="text" value={staffForm.pin||'1234'} maxLength="6"
                        onChange={e=>setStaffForm({...staffForm,pin:e.target.value.replace(/\D/g,'').slice(0,6)})}
                        className="border-2 tracking-widest font-mono" placeholder="1234"/>
                      <p className="text-gray-400 text-xs mt-1">Staff Management में login के लिए PIN।</p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button onClick={saveStaffForm} className="bg-green-600 hover:bg-green-700 text-white font-bold">
                      {editStaffId ? '💾 Update' : '✅ जोड़ें'}
                    </Button>
                    <Button onClick={()=>{setShowStaffForm(false);setEditStaffId(null);}} className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold">
                      ✖ रद्द
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Staff Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">कर्मचारी सूची ({staffList.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b-2">
                      <tr>
                        {['नाम','पद','फोन','मासिक वेतन','Join Date','PIN','Actions'].map(h=>(
                          <th key={h} className="px-4 py-3 text-left font-bold text-gray-700">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {staffList
                        .filter(s => !staffSearch || s.name.toLowerCase().includes(staffSearch.toLowerCase()) || (s.position||'').toLowerCase().includes(staffSearch.toLowerCase()) || (s.phone||'').includes(staffSearch))
                        .map((s,i)=>(
                        <tr key={s.id} className={`border-b hover:bg-blue-50 ${i%2===0?'bg-white':'bg-gray-50/50'}`}>
                          <td className="px-4 py-3 font-bold text-gray-800">{s.name}</td>
                          <td className="px-4 py-3"><span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{s.position}</span></td>
                          <td className="px-4 py-3 text-gray-600">{s.phone||'—'}</td>
                          <td className="px-4 py-3 font-bold text-green-700">{fmtINR(s.monthlySalary)}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{s.joinDate?new Date(s.joinDate).toLocaleDateString('en-IN'):'—'}</td>
                          <td className="px-4 py-3 font-mono text-purple-600 text-xs">{s.pin||'1234'}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button onClick={()=>openEditStaff(s)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1">
                                <Edit2 size={14}/> Edit
                              </button>
                              <button onClick={()=>deleteStaff(s.id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1">
                                <Trash2 size={14}/> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {staffList.length===0 && <div className="text-center py-10 text-gray-400">कोई कर्मचारी नहीं। ऊपर "नया कर्मचारी" दबाएं।</div>}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STAFF REPORTS TAB
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <h2 className="text-2xl font-black text-gray-800">📊 Staff Reports & Analytics</h2>
              <Button onClick={exportToCSV} className="bg-green-600 hover:bg-green-700 text-white font-bold">
                <Download size={18} className="mr-2"/> Export CSV
              </Button>
            </div>

            {/* Month/Year Filter */}
            <Card>
              <CardContent className="pt-4 pb-4 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <label className="text-gray-700 font-bold text-sm">महीना</label>
                  <select value={selectedMonth} onChange={e=>setSelectedMonth(parseInt(e.target.value))}
                    className="border-2 rounded-md px-3 py-1.5 text-sm">
                    {MONTHS_FULL.map((m,i)=><option key={i} value={i}>{m}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-gray-700 font-bold text-sm">साल</label>
                  <select value={selectedYear} onChange={e=>setSelectedYear(parseInt(e.target.value))}
                    className="border-2 rounded-md px-3 py-1.5 text-sm">
                    {[2026,2025,2024,2023].map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <span className="text-blue-600 font-semibold text-sm">{MONTHS_FULL[selectedMonth]} {selectedYear}</span>
              </CardContent>
            </Card>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { l:'कुल वेतन',    v:fmtL(monthlyData.totalSalaries),  c:'blue',   bg:'from-blue-50 to-blue-100'  },
                { l:'कुल भुगतान',  v:fmtL(monthlyData.totalPaid),      c:'green',  bg:'from-green-50 to-green-100'},
                { l:'कुल कटौती',   v:fmtL(monthlyData.totalDeductions), c:'red',    bg:'from-red-50 to-red-100'   },
                { l:'कुल शेष',     v:fmtL(monthlyData.totalBalance),    c:'purple', bg:'from-purple-50 to-purple-100'},
              ].map((k,i)=>(
                <Card key={i} className={`bg-gradient-to-br ${k.bg}`}>
                  <CardContent className="pt-5 pb-4">
                    <p className="text-gray-600 text-xs mb-1">{k.l}</p>
                    <h3 className={`text-2xl font-black text-${k.c}-600`}>{k.v}</h3>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Chart 1: Salary */}
            {salaryChart.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">💰 Salary विश्लेषण</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={salaryChart} barSize={18}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis dataKey="name" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}}/>
                      <Tooltip formatter={v=>fmtINR(v)}/><Legend/>
                      <Bar dataKey="Basic"      fill="#3b82f6" radius={[3,3,0,0]}/>
                      <Bar dataKey="Net Salary" fill="#10b981" radius={[3,3,0,0]}/>
                      <Bar dataKey="Paid"       fill="#f59e0b" radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Chart 2: Attendance */}
              {attendanceChart.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">📅 Attendance Overview</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={attendanceChart} barSize={14}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                        <XAxis dataKey="name" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}} allowDecimals={false}/>
                        <Tooltip/><Legend/>
                        <Bar dataKey="उपस्थित"   fill="#10b981" radius={[3,3,0,0]}/>
                        <Bar dataKey="अनुपस्थित" fill="#ef4444" radius={[3,3,0,0]}/>
                        <Bar dataKey="लेट"       fill="#f59e0b" radius={[3,3,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Chart 3: Position Pie */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">👔 Position Distribution</CardTitle></CardHeader>
                <CardContent>
                  {positionPie.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={positionPie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                          {positionPie.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                        </Pie>
                        <Tooltip formatter={(v,n)=>[v+' लोग',n]}/><Legend/>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div className="h-48 flex items-center justify-center text-gray-400">Data नहीं</div>}
                </CardContent>
              </Card>
            </div>

            {/* Chart 4: Balance Line */}
            {balanceChart.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">📉 Net vs Deduction vs Balance</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={balanceChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis dataKey="name" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}}/>
                      <Tooltip formatter={v=>fmtINR(v)}/><Legend/>
                      <Line type="monotone" dataKey="Net Salary" stroke="#3b82f6" strokeWidth={2} dot={{r:4}}/>
                      <Line type="monotone" dataKey="Deduction"  stroke="#ef4444" strokeWidth={2} dot={{r:4}}/>
                      <Line type="monotone" dataKey="Balance"    stroke="#f59e0b" strokeWidth={2} dot={{r:4}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Notifications Panel */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Bell size={16}/> 🔔 Attendance Notifications ({notifications.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {notifications.length===0 ? <p className="text-center text-gray-400 py-4">कोई notification नहीं।</p> :
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {notifications.map((n,i)=>(
                      <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm border-l-4 ${
                        n.type==='absent'?'bg-red-50 border-red-400':n.type==='late'?'bg-orange-50 border-orange-400':n.type==='salary'?'bg-yellow-50 border-yellow-400':'bg-green-50 border-green-400'}`}>
                        <span>{n.icon}</span>
                        <span className="text-gray-700 font-medium">{n.msg}</span>
                      </div>
                    ))}
                  </div>
                }
              </CardContent>
            </Card>

            {/* Detailed Table */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">📋 विस्तृत रिपोर्ट — {MONTHS_FULL[selectedMonth]} {selectedYear}</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-blue-900 text-white">
                    <tr>
                      {['नाम','पद','Basic','उपस्थित','अनुपस्थित','लेट','कटौती','Net Salary','दिया गया','बकाया','Status'].map(h=>(
                        <th key={h} className="px-3 py-3 text-left text-xs font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.staffStats.map((r,i)=>(
                      <tr key={i} className={`border-b hover:bg-blue-50 ${i%2===0?'bg-white':'bg-gray-50/50'}`}>
                        <td className="px-3 py-3 font-bold">{r.name}</td>
                        <td className="px-3 py-3 text-xs"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{r.position}</span></td>
                        <td className="px-3 py-3 font-semibold">{fmtINR(r.monthlySalary)}</td>
                        <td className="px-3 py-3 text-center text-green-600 font-bold">{r.presentDays}</td>
                        <td className="px-3 py-3 text-center text-red-500 font-bold">{r.absentDays}</td>
                        <td className="px-3 py-3 text-center text-orange-500 font-bold">{r.lateDays}</td>
                        <td className="px-3 py-3 text-red-600">{fmtINR(r.deduction)}</td>
                        <td className="px-3 py-3 font-bold text-blue-700">{fmtINR(r.netSalary)}</td>
                        <td className="px-3 py-3 text-green-600">{fmtINR(r.totalPaid)}</td>
                        <td className="px-3 py-3 font-bold">{fmtINR(Math.abs(r.balance||0))}</td>
                        <td className="px-3 py-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${(r.balance||0)<=0?'bg-green-100 text-green-700':'bg-orange-100 text-orange-700'}`}>
                            {(r.balance||0)<=0?'✅ Clear':'⏳ बकाया'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {monthlyData.staffStats.length > 0 && (
                    <tfoot className="bg-slate-800 text-white">
                      <tr>
                        <td colSpan="2" className="px-3 py-3 font-black text-sm">TOTAL</td>
                        <td className="px-3 py-3 font-bold">{fmtL(monthlyData.totalSalaries)}</td>
                        <td colSpan="3" className="px-3 py-3"></td>
                        <td className="px-3 py-3 font-bold">{fmtL(monthlyData.totalDeductions)}</td>
                        <td className="px-3 py-3 font-bold">{fmtL(monthlyData.totalNet)}</td>
                        <td className="px-3 py-3 font-bold">{fmtL(monthlyData.totalPaid)}</td>
                        <td className="px-3 py-3 font-bold">{fmtL(Math.abs(monthlyData.totalBalance))}</td>
                        <td className="px-3 py-3"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
                {monthlyData.staffStats.length===0 && <div className="text-center py-10 text-gray-400">कोई data नहीं।</div>}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            USERS TAB
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <h2 className="text-2xl font-black text-gray-800">👤 User Management</h2>
              <Button onClick={openAddUser} className="bg-green-600 hover:bg-green-700 text-white font-bold">
                <Plus size={18} className="mr-2"/> Add New User
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <Input value={userSearch} onChange={e=>setUserSearch(e.target.value)} placeholder="नाम या ईमेल खोजें..." className="pl-9 border-2"/>
            </div>

            {/* User Form */}
            {showUserForm && (
              <Card className="border-2 border-purple-400 bg-purple-50/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{editUserId ? '✏️ User संपादित करें' : '➕ नया User जोड़ें'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-gray-600 text-xs font-semibold mb-1 block">नाम *</label>
                      <Input value={userForm.name} onChange={e=>setUserForm({...userForm,name:e.target.value})} placeholder="Full Name" className="border-2"/>
                    </div>
                    <div>
                      <label className="text-gray-600 text-xs font-semibold mb-1 block">Email *</label>
                      <Input type="email" value={userForm.email} onChange={e=>setUserForm({...userForm,email:e.target.value})} placeholder="user@vphonda.com" className="border-2"/>
                    </div>
                    <div>
                      <label className="text-gray-600 text-xs font-semibold mb-1 block">Role</label>
                      <select value={userForm.role} onChange={e=>setUserForm({...userForm,role:e.target.value})}
                        className="w-full border-2 rounded-md px-3 py-2 text-sm bg-white">
                        <option value="admin">Admin</option>
                        <option value="staff">Staff</option>
                        <option value="viewer">Viewer (Read Only)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-600 text-xs font-semibold mb-1 block">Password {editUserId?'(खाली = no change)':''}</label>
                      <div className="relative">
                        <Input type={showUserPw?'text':'password'} value={userForm.password} onChange={e=>setUserForm({...userForm,password:e.target.value})}
                          placeholder="Password" className="border-2 pr-10"/>
                        <button onClick={()=>setShowUserPw(!showUserPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                          {showUserPw?<EyeOff size={16}/>:<Eye size={16}/>}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <Button onClick={saveUserForm} className="bg-purple-600 hover:bg-purple-700 text-white font-bold">
                      {editUserId ? '💾 Update' : '✅ जोड़ें'}
                    </Button>
                    <Button onClick={()=>{setShowUserForm(false);setEditUserId(null);}} className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold">
                      ✖ रद्द
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Users Table */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">User Management ({users.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b-2">
                      <tr>
                        {['Name','Email','Role','Created','Actions'].map(h=>(
                          <th key={h} className="px-6 py-3 text-left font-bold text-gray-700">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users
                        .filter(u => !userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()))
                        .map((u,i)=>(
                        <tr key={u._id} className={`border-b hover:bg-purple-50 ${i%2===0?'bg-white':'bg-gray-50/50'}`}>
                          <td className="px-6 py-3 font-bold text-gray-800">{u.name}</td>
                          <td className="px-6 py-3 text-gray-600">{u.email}</td>
                          <td className="px-6 py-3">
                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                              u.role==='admin'?'bg-red-100 text-red-700':u.role==='staff'?'bg-blue-100 text-blue-700':'bg-gray-100 text-gray-600'
                            }`}>{u.role}</span>
                          </td>
                          <td className="px-6 py-3 text-gray-500 text-xs">{u.createdAt}</td>
                          <td className="px-6 py-3">
                            <div className="flex gap-2">
                              <button onClick={()=>openEditUser(u)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1">
                                <Edit2 size={14}/> Edit
                              </button>
                              {u.role!=='admin' && (
                                <button onClick={()=>deleteUser(u._id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1">
                                  <Trash2 size={14}/> Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SETTINGS TAB
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-gray-800">⚙️ Settings</h2>

            {/* Company Info */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Shield size={16}/> Company Information</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    ['Company Name','companyName'],['Phone','phone'],
                    ['Email','email'],['GSTIN','gstin'],['Invoice Prefix','invoicePrefix'],
                  ].map(([l,f])=>(
                    <div key={f}>
                      <label className="text-gray-600 text-sm font-bold mb-1 block">{l}</label>
                      <Input value={settings[f]||''} onChange={e=>setSettings({...settings,[f]:e.target.value})} className="border-2"/>
                    </div>
                  ))}
                  <div className="md:col-span-2">
                    <label className="text-gray-600 text-sm font-bold mb-1 block">Address</label>
                    <Input value={settings.address||''} onChange={e=>setSettings({...settings,address:e.target.value})} className="border-2"/>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* PDF Settings */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">📄 PDF Customization</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block font-bold text-sm mb-1">Company Logo URL</label>
                  <Input value={settings.logoUrl||''} onChange={e=>setSettings({...settings,logoUrl:e.target.value})} placeholder="https://..." className="border-2"/>
                </div>
                <div>
                  <label className="block font-bold text-sm mb-1">Header Text</label>
                  <Input value={settings.headerText||''} onChange={e=>setSettings({...settings,headerText:e.target.value})} className="border-2"/>
                </div>
                <div>
                  <label className="block font-bold text-sm mb-1">Footer Text</label>
                  <Input value={settings.footerText||''} onChange={e=>setSettings({...settings,footerText:e.target.value})} placeholder="Custom footer message" className="border-2"/>
                </div>
              </CardContent>
            </Card>

            {/* Attendance Rules */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Clock size={16}/> Attendance Rules</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-sm mb-1">Late Threshold (Office Start)</label>
                    <Input type="time" value={settings.lateThreshold||'09:30'} onChange={e=>setSettings({...settings,lateThreshold:e.target.value})} className="border-2"/>
                    <p className="text-gray-400 text-xs mt-1">इस समय के बाद आना = Late (₹50 penalty)</p>
                  </div>
                  <div>
                    <label className="block font-bold text-sm mb-1">Office End Time</label>
                    <Input type="time" value={settings.workEnd||'19:00'} onChange={e=>setSettings({...settings,workEnd:e.target.value})} className="border-2"/>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Bell size={16}/> Notification Preferences</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  ['emailInvoice','Email — Invoice confirmation to customer','Send when invoice is created'],
                  ['dailyReport', 'Email — Daily sales report','Auto-send daily report'],
                  ['smsNotify',   'SMS Notifications','Salary & attendance reminders via SMS'],
                ].map(([f,label,desc])=>(
                  <div key={f} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-sm text-gray-800">{label}</p>
                      <p className="text-gray-500 text-xs">{desc}</p>
                    </div>
                    <button
                      onClick={()=>setSettings({...settings,[f]:!settings[f]})}
                      className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${settings[f]?'bg-blue-600':'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings[f]?'translate-x-6':'translate-x-0.5'}`}/>
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button onClick={()=>{saveSettingsLS(settings);alert('✅ Settings save हो गई!');}} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
              <Save size={16} className="mr-2"/> Save All Settings
            </Button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            BACKUP TAB
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'backup' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-gray-800">💾 Database Backup & Restore</h2>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Download size={16}/> Create Backup</CardTitle></CardHeader>
              <CardContent>
                <p className="text-gray-500 text-sm mb-4">सभी data (staff, attendance, payments, settings) का JSON file backup।</p>
                <Button onClick={createBackup} className="bg-green-600 hover:bg-green-700 text-white font-bold">
                  <Database size={18} className="mr-2"/> Create Full Backup Now
                </Button>
                {backupList.length > 0 && <p className="text-sm text-gray-500 mt-2">Last backup: {backupList[0]?.date}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Upload size={16}/> Restore from Backup</CardTitle></CardHeader>
              <CardContent>
                <p className="text-gray-500 text-sm mb-4">Downloaded JSON backup file से data restore करें।</p>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
                  <Upload size={32} className="text-gray-400 mx-auto mb-3"/>
                  <p className="text-gray-600 font-semibold mb-3">Backup file choose करें</p>
                  <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-lg text-sm inline-block">
                    📂 File Browse करें
                    <input type="file" accept=".json" onChange={restoreBackup} className="hidden"/>
                  </label>
                  <p className="text-gray-400 text-xs mt-2">Only .json backup files</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">📋 Backup History</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {backupList.map((b,i)=>(
                    <div key={b.id||i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${b.type==='auto'?'bg-blue-500':'bg-green-500'}`}/>
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{b.label}</p>
                          <p className="text-gray-500 text-xs">{b.date} · {b.size}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${b.type==='auto'?'bg-blue-100 text-blue-700':'bg-green-100 text-green-700'}`}>{b.type}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Clock size={16}/> Auto Backup Schedule</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  ['daily',   'Daily at 2:00 AM',      'हर रात 2 बजे auto backup'],
                  ['weekly',  'Weekly (Sunday 2 AM)',   'हर रविवार को backup'],
                  ['monthly', 'Monthly (1st at 2 AM)', 'हर महीने पहली तारीख को'],
                  ['manual',  'Manual Only',            'सिर्फ manually backup करें'],
                ].map(([v,l,d])=>(
                  <label key={v} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border-2 transition-colors ${backupSchedule===v?'border-blue-500 bg-blue-50':'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" value={v} checked={backupSchedule===v} onChange={e=>setBackupSchedule(e.target.value)} className="text-blue-600"/>
                    <div>
                      <p className="font-semibold text-sm text-gray-800">{l}</p>
                      <p className="text-gray-500 text-xs">{d}</p>
                    </div>
                  </label>
                ))}
                <Button onClick={()=>alert('✅ Schedule saved!')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold mt-2">
                  <Save size={16} className="mr-2"/> Save Schedule
                </Button>
              </CardContent>
            </Card>

            {/* Activity Logs */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">📜 Activity Logs</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { col:'blue',   msg:'Invoice #001 created by Staff', time:'2026-03-31 11:20' },
                    { col:'green',  msg:'New customer added',             time:'2026-03-31 10:45' },
                    { col:'orange', msg:'Database backup completed',      time:'2026-03-31 10:30' },
                    { col:'blue',   msg:'Part inventory updated',         time:'2026-03-31 09:15' },
                    { col:'purple', msg:'Admin Panel login',              time:'2026-03-31 09:00' },
                  ].map((log,i)=>(
                    <div key={i} className={`p-3 bg-gray-50 rounded border-l-4 border-${log.col}-500`}>
                      <p className="text-sm"><b>{log.time}:</b> {log.msg}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}