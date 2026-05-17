import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Trash2, Users, AlertCircle, MapPin, LogIn, LogOut,
  Lightbulb, Bell, FileText, ChevronDown, ChevronUp,
  Edit, Lock, Unlock, Eye, EyeOff, Shield, Star
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { api } from '../utils/apiConfig';

const ADMIN_PASSWORD = 'vphonda@123';
const MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March'];

const StaffFormFields = ({ data, setData, showBank = true }) => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <div><label className="text-slate-400 text-xs mb-1 block">नाम *</label>
        <Input value={data.name || ''} onChange={e => setData({ ...data, name: e.target.value })} className="bg-slate-700 text-white border-slate-600" placeholder="पूरा नाम" /></div>
      <div><label className="text-slate-400 text-xs mb-1 block">पिता का नाम</label>
        <Input value={data.father || ''} onChange={e => setData({ ...data, father: e.target.value })} className="bg-slate-700 text-white border-slate-600" /></div>
      <div><label className="text-slate-400 text-xs mb-1 block">फोन</label>
        <Input value={data.phone || ''} onChange={e => setData({ ...data, phone: e.target.value })} className="bg-slate-700 text-white border-slate-600" /></div>
      <div><label className="text-slate-400 text-xs mb-1 block">ईमेल</label>
        <Input value={data.email || ''} onChange={e => setData({ ...data, email: e.target.value })} className="bg-slate-700 text-white border-slate-600" /></div>
      <div><label className="text-slate-400 text-xs mb-1 block">आधार नंबर</label>
        <Input value={data.aadharNo || ''} onChange={e => setData({ ...data, aadharNo: e.target.value })} className="bg-slate-700 text-white border-slate-600" /></div>
      <div><label className="text-slate-400 text-xs mb-1 block">PAN</label>
        <Input value={data.panNo || ''} onChange={e => setData({ ...data, panNo: e.target.value.toUpperCase() })} className="bg-slate-700 text-white border-slate-600" maxLength="10" /></div>
      <div><label className="text-slate-400 text-xs mb-1 block">पद</label>
        <select value={data.position || 'Mechanic'} onChange={e => setData({ ...data, position: e.target.value })} className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md text-sm">
          <option>Mechanic</option><option>Sales Executive</option><option>Helper</option>
          <option>Manager</option><option>Receptionist</option><option>Accountant</option>
        </select></div>
      <div><label className="text-slate-400 text-xs mb-1 block">मासिक वेतन (₹) *</label>
        <Input type="number" value={data.monthlySalary || ''} onChange={e => setData({ ...data, monthlySalary: parseFloat(e.target.value) })} className="bg-slate-700 text-white border-slate-600" /></div>
      <div><label className="text-slate-400 text-xs mb-1 block">Join Date</label>
        <Input type="date" value={data.joinDate || ''} onChange={e => setData({ ...data, joinDate: e.target.value })} className="bg-slate-700 text-white border-slate-600" /></div>
      {showBank && <>
        <div className="col-span-2 md:col-span-3 mt-1">
          <div className="h-px bg-slate-600 my-2" />
          <p className="text-cyan-400 text-xs font-bold mb-2">🏦 Bank Details</p>
        </div>
        <div><label className="text-slate-400 text-xs mb-1 block">Bank Account No.</label>
          <Input value={data.bankAccount || ''} onChange={e => setData({ ...data, bankAccount: e.target.value })} className="bg-slate-700 text-white border-slate-600" placeholder="खाता नंबर" /></div>
        <div><label className="text-slate-400 text-xs mb-1 block">IFSC Code</label>
          <Input value={data.ifscCode || ''} onChange={e => setData({ ...data, ifscCode: e.target.value.toUpperCase() })} className="bg-slate-700 text-white border-slate-600" placeholder="SBIN0001234" /></div>
        <div><label className="text-slate-400 text-xs mb-1 block">Bank Name</label>
          <Input value={data.bankName || ''} onChange={e => setData({ ...data, bankName: e.target.value })} className="bg-slate-700 text-white border-slate-600" placeholder="State Bank of India" /></div>
        <div><label className="text-slate-400 text-xs mb-1 block">Branch</label>
          <Input value={data.bankBranch || ''} onChange={e => setData({ ...data, bankBranch: e.target.value })} className="bg-slate-700 text-white border-slate-600" placeholder="Branch Name" /></div>
        <div><label className="text-slate-400 text-xs mb-1 block">🔐 Login PIN (4 अंक)</label>
          <Input type="text" value={data.pin || '1234'} onChange={e => setData({ ...data, pin: e.target.value.replace(/\D/g,'').slice(0,6) })} className="bg-slate-700 text-white border-slate-600" placeholder="1234" maxLength="6" />
          <p className="text-slate-500 text-xs mt-1">कर्मचारी इस PIN से login करेगा। Default: 1234</p></div>
      </>}
    </div>
  );

export default function StaffManagementPage() {
  const [staffList, setStaffList] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [paymentHistory, setPaymentHistory] = useState({});
  const [incentiveData, setIncentiveData] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showNotesForm, setShowNotesForm] = useState(false);
  const [showIncentiveForm, setShowIncentiveForm] = useState(false);
  const [showPaySlipModal, setShowPaySlipModal] = useState(false);
  const [selectedStaffPaySlip, setSelectedStaffPaySlip] = useState(null);
  const [selectedMonthPaySlip, setSelectedMonthPaySlip] = useState(new Date().getMonth() + 1);
  const [selectedYearPaySlip, setSelectedYearPaySlip] = useState(new Date().getFullYear());
  const [paySlipType, setPaySlipType] = useState('monthly');
  const [selectedStaffForPayment, setSelectedStaffForPayment] = useState(null);
  const [selectedStaffForNotes, setSelectedStaffForNotes] = useState(null);
  const [selectedStaffForIncentive, setSelectedStaffForIncentive] = useState(null);
  const [manualNotes, setManualNotes] = useState({});
  const [noteText, setNoteText] = useState('');
  const [highlightText, setHighlightText] = useState('');
  const [expandedStaff, setExpandedStaff] = useState(new Set());
  const [showRules, setShowRules] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [editingStaff, setEditingStaff] = useState(null);
  const [editForm, setEditForm] = useState({});

  // ===== STAFF LOGIN STATES =====
  const [loggedInStaff, setLoggedInStaff] = useState(null); // {id, name, position}
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  const [showLandingPage, setShowLandingPage] = useState(true); // landing shown first
  const [staffLoginSelectedId, setStaffLoginSelectedId] = useState('');
  const [staffLoginPin, setStaffLoginPin] = useState('');
  const [staffLoginError, setStaffLoginError] = useState('');
  const [showStaffPin, setShowStaffPin] = useState(false);

  const [currentDate] = useState(new Date());
  const [currentMonth] = useState(currentDate.getMonth());
  const [currentYear] = useState(currentDate.getFullYear());

  const [incentiveEntry, setIncentiveEntry] = useState({
    amount: '', reason: 'अच्छा प्रदर्शन', type: 'incentive',
    month: new Date().getMonth() + 1, year: new Date().getFullYear()
  });

  const emptyStaff = {
    name: '', father: '', phone: '', email: '',
    aadharNo: '', panNo: '', position: 'Mechanic',
    monthlySalary: 0, joinDate: new Date().toISOString().split('T')[0],
    bankAccount: '', ifscCode: '', bankBranch: '', bankName: '',
    pin: '1234'
  };
  const [newStaff, setNewStaff] = useState(emptyStaff);

  const [paymentEntry, setPaymentEntry] = useState({
    amount: 0, date: new Date().toISOString().split('T')[0], description: 'Salary Payment'
  });

  // Manual DA/HRA/PF/ESI/TDS for pay slip (admin can set per slip)
  const [paySlipExtras, setPaySlipExtras] = useState({
    da: 0, hra: 0, otherAllowance: 0, pf: 0, esi: 0, tds: 0, otherDeduction: 0
  });

  useEffect(() => { loadData(); }, []);

  // ⭐ Auto-refresh salary data every 30 seconds (cross-device sync)
  useEffect(() => {
    const interval = setInterval(() => { loadSalaryData(); }, 30000);
    return () => clearInterval(interval);
  }, [staffList]);

  // ⭐ NEW: Load salary data from MongoDB and convert to local format
  const loadSalaryData = async () => {
    try {
      // Fetch all payments from /api/salaries (shared with Salary Management)
      const res = await fetch(api('/api/salaries'));
      if (!res.ok) return;
      const allPayments = await res.json();

      // Group by staffId/staffName -> { staffId: [payments] }
      // Also separate incentive/bonus into incentiveData
      const paymentsByStaff = {};
      const incentivesByStaff = {};

      allPayments.forEach(p => {
        if (p.cancelled) return;

        // Find matching staff (by staffId or by name)
        const staff = staffList.find(s =>
          String(s.id) === String(p.staffId) ||
          s.name?.toLowerCase().trim() === String(p.staffName || '').toLowerCase().trim()
        );
        const sid = staff?.id || p.staffId;
        if (!sid) return;

        // Salary, advance, deduction → paymentHistory
        if (p.type === 'salary' || p.type === 'advance' || p.type === 'deduction') {
          if (!paymentsByStaff[sid]) paymentsByStaff[sid] = [];
          paymentsByStaff[sid].push({
            id: p._id,
            date: p.paymentDate,
            amount: Number(p.amount || 0),
            type: p.type,
            note: p.notes || '',
            forMonth: p.forMonth,
            forYear: p.forYear,
            mongoId: p._id,  // for delete/update later
          });
        }

        // Bonus, incentive, insurance → incentiveData
        if (p.type === 'bonus' || p.type === 'incentive' || p.type === 'insurance') {
          if (!incentivesByStaff[sid]) incentivesByStaff[sid] = [];
          incentivesByStaff[sid].push({
            id: p._id,
            month: p.forMonth,
            year: p.forYear,
            amount: Number(p.amount || 0),
            type: p.type === 'bonus' ? 'bonus' : (p.type === 'insurance' ? 'insurance' : 'incentive'),
            note: p.notes || '',
            mongoId: p._id,
          });
        }
      });

      setPaymentHistory(paymentsByStaff);
      setIncentiveData(incentivesByStaff);
      setSalaryPayments(allPayments);                                   // ⭐ raw payments for unified access
      // Cache locally for offline view
      try { localStorage.setItem('staffPayments', JSON.stringify(paymentsByStaff)); } catch {}
      try { localStorage.setItem('staffIncentives', JSON.stringify(incentivesByStaff)); } catch {}
    } catch (err) {
      console.log('Salary data sync failed:', err.message);
    }
  };

  // ⭐ NEW: Load attendance from MongoDB
  const loadAttendanceData = async () => {
    try {
      const res = await fetch(api('/api/attendance'));
      if (!res.ok) return;
      const all = await res.json();
      const byStaff = {};
      all.forEach(a => {
        if (!byStaff[a.staffId]) byStaff[a.staffId] = [];
        byStaff[a.staffId].push({
          date: a.date,
          checkInTime: a.checkInTime,
          checkOutTime: a.checkOutTime,
          status: a.status || 'Present',
          location: { lat: a.checkInLat, lng: a.checkInLng, distance: a.checkInDistance },
          isLate: a.isLate || false,
          mongoId: a._id,
        });
      });
      setAttendanceRecords(byStaff);
      try { localStorage.setItem('staffAttendance', JSON.stringify(byStaff)); } catch {}
    } catch (err) {
      console.log('Attendance sync failed:', err.message);
    }
  };

  // ⭐ NEW STATE: Linked salary entities (single source of truth for salaries)
  const [salaryEntities, setSalaryEntities] = useState([]);
  const [salaryPayments, setSalaryPayments] = useState([]);            // raw payments from /api/salaries

  const loadData = () => {
    // MongoDB PRIMARY — always fetch fresh staff data
    (async () => {
      try {
        const res = await fetch(api('/api/staff'));
        if (res.ok) { const db = await res.json(); if (db.length > 0) { setStaffList(db); localStorage.setItem('staffData', JSON.stringify(db)); } }
      } catch {}
      try { const s = localStorage.getItem('staffData'); if (s && staffList.length === 0) setStaffList(JSON.parse(s)); } catch {}

      // ⭐ Load salary-entities (UNIFIED with Salary Management page)
      try {
        const res = await fetch(api('/api/salary-entities'));
        if (res.ok) { const ents = await res.json(); setSalaryEntities(ents || []); }
      } catch (e) { console.log('Salary entities load failed:', e.message); }

      // ⭐ Now load salary + attendance from MongoDB (linked to Salary Management)
      await loadSalaryData();
      await loadAttendanceData();
    })();
    // Local-only data
    try { const n = localStorage.getItem('staffNotes'); if (n) setManualNotes(JSON.parse(n)); } catch {}
    try { if (localStorage.getItem('vpAdminSession') === 'true') { setIsAdmin(true); setShowLandingPage(false); } } catch {}
    try {
      const ls = localStorage.getItem('vpStaffSession');
      if (ls) { setLoggedInStaff(JSON.parse(ls)); setShowLandingPage(false); }
    } catch {}
    // Fallback: If MongoDB unreachable, load cached salary data
    try {
      const p = localStorage.getItem('staffPayments');
      if (p && Object.keys(paymentHistory).length === 0) setPaymentHistory(JSON.parse(p));
    } catch {}
    try {
      const i = localStorage.getItem('staffIncentives');
      if (i && Object.keys(incentiveData).length === 0) setIncentiveData(JSON.parse(i));
    } catch {}
  };

  // ⭐ NEW: Get authoritative monthly salary for a staff member
  // Priority: salary-entities (active staff entity matching name) > staff.monthlySalary
  const getEffectiveMonthlySalary = (staff) => {
    if (!staff) return 0;
    // Match salary entity by name (case-insensitive trim) and type='staff' and active
    const match = salaryEntities.find(e =>
      e.type === 'staff' &&
      e.active &&
      String(e.name || '').trim().toLowerCase() === String(staff.name || '').trim().toLowerCase()
    );
    if (match && match.monthlyAmount) return Number(match.monthlyAmount);
    return Number(staff.monthlySalary || 0);
  };

  // ⭐ Get linked salary entity for a staff member (or null)
  const getLinkedEntity = (staff) => {
    if (!staff) return null;
    return salaryEntities.find(e =>
      e.type === 'staff' &&
      e.active &&
      String(e.name || '').trim().toLowerCase() === String(staff.name || '').trim().toLowerCase()
    ) || null;
  };

  const saveData = (list) => {
    try { localStorage.setItem('staffData', JSON.stringify(list)); } catch {}
    // Sync to MongoDB (so staff can login from any device)
    fetch(api('/api/staff/sync'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffList: list }),
    }).catch(e => console.log('Staff sync failed:', e.message));
  };
  const saveAttendance = (rec) => { try { localStorage.setItem('staffAttendance', JSON.stringify(rec)); } catch {} };
  const savePayments = (pay) => { try { localStorage.setItem('staffPayments', JSON.stringify(pay)); } catch {} };
  const saveNotes = (n) => { try { localStorage.setItem('staffNotes', JSON.stringify(n)); } catch {} };
  const saveIncentives = (i) => { try { localStorage.setItem('staffIncentives', JSON.stringify(i)); } catch {} };

  const handleAdminLogin = () => {
    if (adminPasswordInput === ADMIN_PASSWORD) {
      setIsAdmin(true); localStorage.setItem('vpAdminSession', 'true');
      setShowAdminLogin(false); setAdminPasswordInput(''); setLoginError('');
      setShowLandingPage(false);
    } else { setLoginError('❌ गलत पासवर्ड! दोबारा कोशिश करें।'); }
  };
  const handleAdminLogout = () => {
    setIsAdmin(false); localStorage.removeItem('vpAdminSession');
    setShowLandingPage(true);
  };

  // ===== STAFF LOGIN/LOGOUT =====
  const handleStaffLogin = () => {
    if (!staffLoginSelectedId) { setStaffLoginError('कृपया अपना नाम चुनें।'); return; }
    const staff = staffList.find(s => String(s.id) === String(staffLoginSelectedId));
    if (!staff) { setStaffLoginError('कर्मचारी नहीं मिला।'); return; }
    const correctPin = staff.pin || '1234';
    if (staffLoginPin !== correctPin) { setStaffLoginError('❌ गलत PIN! दोबारा कोशिश करें।'); return; }
    const session = { id: staff.id, name: staff.name, position: staff.position };
    setLoggedInStaff(session);
    localStorage.setItem('vpStaffSession', JSON.stringify(session));
    setShowStaffLogin(false); setStaffLoginPin(''); setStaffLoginError('');
    setShowLandingPage(false);
    // Auto-expand their own card
    setExpandedStaff(new Set([staff.id]));
  };
  const handleStaffLogout = () => {
    setLoggedInStaff(null); localStorage.removeItem('vpStaffSession');
    setShowLandingPage(true);
  };

  const toggleExpand = (staffId) => {
    setExpandedStaff(prev => { const n = new Set(prev); n.has(staffId) ? n.delete(staffId) : n.add(staffId); return n; });
  };

  const countSundays = (year, month) => {
    let c = 0; const d = new Date(year, month, 1);
    while (d.getMonth() === month) { if (d.getDay() === 0) c++; d.setDate(d.getDate() + 1); }
    return c;
  };

  // Time parse helper - handles both "09:30:00" and "02:33:57 pm" formats
  const parseTime24 = (timeStr) => {
    if (!timeStr) return { h: 0, m: 0 };
    const lower = timeStr.toLowerCase();
    const parts = lower.replace(/[apm\s]/g, '').split(':');
    let h = parseInt(parts[0] || 0);
    const m = parseInt(parts[1] || 0);
    if (lower.includes('pm') && h !== 12) h += 12;
    if (lower.includes('am') && h === 12) h = 0;
    return { h, m };
  };

  const isLateTime = (timeStr) => {
    const { h, m } = parseTime24(timeStr);
    return h > 9 || (h === 9 && m > 30);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 💰 SALARY CALCULATION — Smart Rules
  // ═══════════════════════════════════════════════════════════════════════════
  // 📜 नियम (User defined):
  //   • हर महीने में सारे Sundays = PAID OFF (कोई कटौती नहीं, चाहे 4 हों या 5)
  //   • Sunday के अलावा कोई भी दिन छुट्टी = उस दिन की salary कटेगी
  //   • Per-day rate = monthlySalary ÷ (total days - sundays)
  //   • Late penalty only on rules-active months
  //
  // 🕊️ Grace Period:
  //   • Rules सिर्फ shopSettings.attendanceRulesStartDate से लागू होंगे
  //   • उस से पहले के महीनों में कोई कटौती नहीं (full salary)
  //   • यह इसलिए कि पुराने महीनों में attendance log नहीं है
  // ═══════════════════════════════════════════════════════════════════════════
  const calculateSalaryDetails = (staffId, forMonth = null, forYear = null) => {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) return {};

    const m = forMonth !== null ? forMonth : currentMonth;
    const y = forYear !== null ? forYear : currentYear;

    // ⭐ UNIFIED: Get monthly salary from salary-entities (or fallback to staff)
    const linkedEntity = getLinkedEntity(staff);
    const effectiveMonthlySalary = getEffectiveMonthlySalary(staff);

    const attendance = attendanceRecords[staffId] || [];
    const incList = incentiveData[staffId] || [];
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const sundays = countSundays(y, m);
    const workingDaysInMonth = daysInMonth - sundays;   // sundays are paid off

    // ⭐ UNIFIED: Get payments from BOTH paymentHistory (legacy) AND linked salary entity
    // paymentHistory[staffId] holds payments by staff.id (old system)
    // salaryPayments holds payments by staffName (new system from Salary Mgmt)
    const legacyPayments = paymentHistory[staffId] || [];
    const linkedPayments = (salaryPayments || []).filter(p =>
      !p.cancelled && (
        String(p.staffName || '').trim().toLowerCase() === String(staff.name || '').trim().toLowerCase() ||
        String(p.staffId) === String(staffId)
      )
    ).map(p => ({
      // Normalize to legacy shape
      date: p.paymentDate,
      amount: Number(p.amount || 0),
      type: p.type || 'salary',
      notes: p.notes || '',
      _id: p._id,
      _source: 'salary-mgmt',
    }));

    // Merge but de-dupe by (date+amount+type) - prefer salary-mgmt source
    const seen = new Set();
    const allPayments = [];
    [...linkedPayments, ...legacyPayments].forEach(p => {
      const key = `${p.date}|${p.amount}|${p.type || 'salary'}`;
      if (!seen.has(key)) { seen.add(key); allPayments.push(p); }
    });

    // 🕊️ Grace Period check: Are rules active for this month?
    const rulesStart = shopSettings?.attendanceRulesStartDate;  // YYYY-MM-DD
    const rulesActive = (() => {
      if (!rulesStart) return false;  // not configured yet
      const startDate = new Date(rulesStart);
      const thisMonthStart = new Date(y, m, 1);
      const startMonthFirst = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      return thisMonthStart >= startMonthFirst;
    })();

    const monthAtt = attendance.filter(a => {
      const d = new Date(a.date);
      return d.getMonth() === m && d.getFullYear() === y;
    });
    const presentDays = monthAtt.length;

    const today = new Date();
    const isCurrentMonth = (m === today.getMonth() && y === today.getFullYear());
    const isFutureMonth = new Date(y, m, 1) > today;

    let elapsedWorkingDays = workingDaysInMonth;
    if (isCurrentMonth) {
      let count = 0;
      for (let d = 1; d <= today.getDate(); d++) {
        const date = new Date(y, m, d);
        if (date.getDay() !== 0) count++;  // not Sunday
      }
      elapsedWorkingDays = count;
    } else if (isFutureMonth) {
      elapsedWorkingDays = 0;
    }

    const absentDays = Math.max(0, elapsedWorkingDays - presentDays);
    const lateDays = monthAtt.filter(a => a.checkInTime && isLateTime(a.checkInTime)).length;

    const perDayRate = workingDaysInMonth > 0 ? (effectiveMonthlySalary / workingDaysInMonth) : 0;

    let salaryDeduction = 0, deductionDays = 0, deductionReason = '', latePenalty = 0;

    if (!rulesActive) {
      const niceDate = rulesStart
        ? new Date(rulesStart).toLocaleDateString('en-IN', { month:'long', year:'numeric' })
        : 'अगले महीने';
      deductionReason = `🕊️ Grace Period — ${niceDate} से rules लागू होंगे। पुराने महीनों में कोई कटौती नहीं।`;
    } else if (isFutureMonth) {
      deductionReason = '🔮 भविष्य का महीना — अभी कोई data नहीं';
    } else if (presentDays >= elapsedWorkingDays) {
      deductionReason = `✅ पूरे ${elapsedWorkingDays} working days में उपस्थित — कोई कटौती नहीं`;
    } else {
      deductionDays = absentDays;
      salaryDeduction = absentDays * perDayRate;
      deductionReason = `${absentDays} दिन छुट्टी × ₹${perDayRate.toFixed(0)}/दिन (Sundays paid off)`;
      latePenalty = lateDays * (shopSettings?.latePenalty || 50);
    }

    const totalDeduction = salaryDeduction + latePenalty;

    const monthIncentives = incList.filter(i => i.month === m + 1 && i.year === y);
    const totalIncentive = monthIncentives.filter(i => i.type === 'incentive').reduce((s, i) => s + parseFloat(i.amount || 0), 0);
    const totalInsurance = monthIncentives.filter(i => i.type === 'insurance').reduce((s, i) => s + parseFloat(i.amount || 0), 0);
    const otherBonus = monthIncentives.filter(i => i.type === 'bonus').reduce((s, i) => s + parseFloat(i.amount || 0), 0);

    const netSalary = Math.max(0, effectiveMonthlySalary - totalDeduction + totalIncentive + otherBonus);

    const monthPayments = allPayments.filter(p => {
      const d = new Date(p.date);
      return d.getMonth() === m && d.getFullYear() === y;
    });
    const totalPayments = monthPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    return {
      monthlySalary: effectiveMonthlySalary,                  // ⭐ from salary-entities
      linkedEntityName: linkedEntity?.name || null,           // ⭐ which entity
      presentDays, absentDays, sundays,
      workingDaysInMonth, elapsedWorkingDays,
      deductionDays, deductionReason, perDayRate,
      salaryDeduction: salaryDeduction.toFixed(2), lateDays,
      latePenalty: latePenalty.toFixed(2), extraLateCut: '0.00',
      totalDeduction: totalDeduction.toFixed(2),
      totalIncentive, totalInsurance, otherBonus, monthIncentives,
      totalPayments, netSalary: netSalary.toFixed(2),
      balance: (netSalary - totalPayments).toFixed(2),
      payments: monthPayments,
      rulesActive, rulesStart,
      isCurrentMonth, isFutureMonth,
    };
  };

  // ===== ATTENDANCE (📍 GPS LOCATION-BASED) =====
  // Requires user to be within shop's allowed radius
  const [shopSettings, setShopSettings] = useState(null);
  const [checkInLoading, setCheckInLoading] = useState(null); // staffId being processed

  // Load shop settings on mount
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(api('/api/attendance/shop/settings'));
        if (r.ok) setShopSettings(await r.json());
      } catch {}
    })();
  }, []);

  const getLocation = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('आपका browser GPS support नहीं करता')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        const msgs = {
          1: '❌ Location permission denied। Browser settings में allow करें।',
          2: '❌ Location unavailable। GPS on करें और दोबारा try करें।',
          3: '❌ Location timeout। Signal check करें।',
        };
        reject(new Error(msgs[err.code] || err.message));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

  const handleMarkAttendance = async (staffId, type = 'check-in') => {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) return;

    // Check shop location is set
    if (!shopSettings?.shopLat || !shopSettings?.shopLng) {
      alert('⚠️ Admin ने अभी शोरूम location set नहीं की है।\n\nAdmin panel में जाकर "Set Shop Location" से set करें।');
      return;
    }

    setCheckInLoading(staffId);

    try {
      // Get user's current GPS location
      const loc = await getLocation();

      // Send to backend (backend verifies distance)
      const endpoint = type === 'check-in' ? '/api/attendance/check-in' : '/api/attendance/check-out';
      const res = await fetch(api(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, staffName: staff.name, lat: loc.lat, lng: loc.lng }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error + (data.distance ? `\n\n📍 Distance from shop: ${data.distance}m\n📏 Allowed: ${data.allowedRadius}m` : ''));
        setCheckInLoading(null);
        return;
      }

      alert(data.message + `\n\n📍 Distance from shop: ${data.distance || 0}m`);

      // Update local state to reflect new attendance
      const rec = { ...attendanceRecords };
      if (!rec[staffId]) rec[staffId] = [];
      const today = data.attendance.date;
      const exIdx = rec[staffId].findIndex(a => a.date === today);
      const newEntry = {
        date: today,
        checkInTime: data.attendance.checkInTime,
        checkOutTime: data.attendance.checkOutTime,
        status: data.attendance.status,
        location: { lat: data.attendance.checkInLat, lng: data.attendance.checkInLng, distance: data.attendance.checkInDistance },
      };
      if (exIdx >= 0) rec[staffId][exIdx] = { ...rec[staffId][exIdx], ...newEntry };
      else rec[staffId].push(newEntry);
      setAttendanceRecords(rec);
      saveAttendance(rec);
    } catch (err) {
      alert('⚠️ ' + err.message);
    }

    setCheckInLoading(null);
  };

  // ===== OLD TIME-BASED CHECK-IN (kept as backup function) =====
  const handleMarkAttendanceTimeOnly = (staffId, type = 'check-in') => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const rec = { ...attendanceRecords };
    if (!rec[staffId]) rec[staffId] = [];
    const ex = rec[staffId].find(a => a.date === today);

    if (type === 'check-in') {
      if (ex?.checkInTime) { alert('❌ आज की Check-in पहले से है'); return; }
      const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30);
      if (ex) { ex.checkInTime = time; ex.status = 'Present'; }
      else rec[staffId].push({ date: today, checkInTime: time, status: 'Present' });
      setAttendanceRecords(rec); saveAttendance(rec);
      alert(`✅ Check-in सफल!\n⏰ समय: ${time}${isLate ? '\n⚠️ लेट! ₹50 penalty लगेगी।' : '\n✅ समय पर!'}`);
    } else {
      if (!ex?.checkInTime) { alert('❌ पहले Check-in करें'); return; }
      if (ex.checkOutTime) { alert('❌ Check-out पहले से है'); return; }
      const inParsed = parseTime24(ex.checkInTime);
      const inTime = new Date(); inTime.setHours(inParsed.h, inParsed.m, 0);
      const hrs = Math.floor((now - inTime) / 3600000);
      const mins = Math.floor(((now - inTime) % 3600000) / 60000);
      ex.checkOutTime = time;
      setAttendanceRecords(rec); saveAttendance(rec);
      alert(`✅ Check-out सफल!\n⏰ समय: ${time}\n🕐 काम: ${hrs}घं ${mins}मि`);
    }
  };

  // ===== PAYSLIP PDF (Beautiful, Full Page, with optional DA/HRA/PF) =====
  const downloadPaySlipPDF = () => {
    if (!selectedStaffPaySlip) { alert('कृपया कर्मचारी चुनें'); return; }
    const staff = selectedStaffPaySlip;
    const m = selectedMonthPaySlip, y = selectedYearPaySlip;
    const mName = MONTHS[m - 1] + ' ' + y;
    const daysInM = new Date(y, m, 0).getDate();
    const suns = countSundays(y, m - 1);
    const wDays = daysInM - suns;
    const base = staff.monthlySalary;
    const perDay = base / wDays;    // ⭐ Per working day (not /26)
    const ex = paySlipExtras; // manual DA/HRA/PF/ESI

    const att = (attendanceRecords[staff.id] || []).filter(a => {
      const d = new Date(a.date); return d.getMonth() === m - 1 && d.getFullYear() === y;
    });
    const present = att.length;
    const absent = Math.max(0, wDays - present);
    const late = att.filter(a => a.checkInTime && isLateTime(a.checkInTime)).length;

    // ⭐ Check grace period for this month
    const rulesStart = shopSettings?.attendanceRulesStartDate;
    const thisMonthStart = new Date(y, m - 1, 1);
    const rulesActive = rulesStart && thisMonthStart >= new Date(rulesStart);

    let absDed = 0, deductDesc = '';
    if (!rulesActive) {
      absDed = 0;
      deductDesc = `🕊️ Grace Period — Rules ${rulesStart ? new Date(rulesStart).toLocaleDateString('en-IN', { month:'short', year:'numeric' }) : 'next month'} से लागू होंगे`;
    } else if (absent === 0) {
      absDed = 0;
      deductDesc = `पूरे ${wDays} working days उपस्थित — कोई कटौती नहीं`;
    } else {
      // NEW RULE: per-day deduction, Sundays free
      absDed = absent * perDay;
      deductDesc = `${absent} दिन absent × ₹${perDay.toFixed(0)}/दिन (Sundays छुट्टी)`;
    }

    const latePenalty = rulesActive ? late * (shopSettings?.latePenalty || 50) : 0;
    const extraLate = 0; // removed
    const manualDed = parseFloat(ex.pf||0) + parseFloat(ex.esi||0) + parseFloat(ex.tds||0) + parseFloat(ex.otherDeduction||0);
    const totalDed = absDed + latePenalty + extraLate + manualDed;
    const totalEarnings = base + parseFloat(ex.da||0) + parseFloat(ex.hra||0) + parseFloat(ex.otherAllowance||0);

    const incList = (incentiveData[staff.id] || []).filter(i => i.month === m && i.year === y);
    const incentive = incList.filter(i => i.type === 'incentive').reduce((s, i) => s + i.amount, 0);
    const insurance = incList.filter(i => i.type === 'insurance').reduce((s, i) => s + i.amount, 0);
    const bonus = incList.filter(i => i.type === 'bonus').reduce((s, i) => s + i.amount, 0);
    const netSalary = Math.max(0, totalEarnings - totalDed + incentive + bonus);

    const fmt = (n) => '&#8377;' + Math.round(n).toLocaleString('en-IN');

    // Pre-build incentive rows to avoid triple-nested templates (babel compat)
    const incRowsHtml = incList.map((inc, idx) => {
      const bg = idx % 2 === 0 ? '#fafafa' : 'white';
      const typeLabel = inc.type === 'incentive' ? 'Incentive' : inc.type === 'insurance' ? 'Insurance' : 'Bonus';
      const color = inc.type === 'insurance' ? '#dc2626' : '#16a34a';
      const sign = inc.type === 'insurance' ? '(-)' : '(+)';
      return '<tr style="background:' + bg + ';"><td style="padding:5px;border-bottom:1px solid #f0f0f0;">' + typeLabel + '</td>'
        + '<td style="padding:5px;border-bottom:1px solid #f0f0f0;">' + inc.reason + '</td>'
        + '<td style="padding:5px;text-align:right;font-weight:700;border-bottom:1px solid #f0f0f0;color:' + color + ';">' + sign + ' ' + fmt(inc.amount) + '</td></tr>';
    }).join('');

    const el = document.createElement('div');
    el.innerHTML = `
<div style="font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;margin:0;padding:0;">

  <!-- TOP HEADER BAND -->
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 60%,#2563eb 100%);padding:20px 30px 16px;position:relative;">
    <div style="position:absolute;top:0;right:0;width:200px;height:100%;background:rgba(255,255,255,0.04);clip-path:polygon(30% 0,100% 0,100% 100%,0% 100%);"></div>
    <table style="width:100%;">
      <tr>
        <td>
          <div style="color:white;font-size:24px;font-weight:900;letter-spacing:3px;margin-bottom:3px;">🏍️ VP HONDA</div>
          <div style="color:rgba(255,255,255,0.75);font-size:11px;">Parwaliya Sadak, Bhopal (M.P.) — 462001</div>
          <div style="color:rgba(255,255,255,0.65);font-size:10px;margin-top:2px;">📞 9713394738 &nbsp;|&nbsp; ✉ vphonda1@gmail.com &nbsp;|&nbsp; GSTIN: 23BCYPD9538B1ZG</div>
        </td>
        <td style="text-align:right;vertical-align:top;">
          <div style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:10px;padding:9px 16px;display:inline-block;">
            <div style="color:rgba(255,255,255,0.7);font-size:9px;letter-spacing:2px;text-transform:uppercase;">Salary Slip</div>
            <div style="color:white;font-size:15px;font-weight:800;margin-top:2px;">${mName.toUpperCase()}</div>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <!-- EMPLOYEE INFO -->
  <div style="margin:10px 18px 0;background:white;border-radius:10px;overflow:hidden;box-shadow:0 3px 12px rgba(0,0,0,0.07);">
    <div style="background:#eff6ff;padding:7px 14px;border-bottom:1px solid #dbeafe;">
      <span style="color:#1e40af;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">👤 Employee Details</span>
    </div>
    <div style="padding:10px 14px;">
      <table style="width:100%;font-size:11px;border-collapse:collapse;">
        <tr>
          <td style="padding:3px 8px 3px 0;color:#64748b;width:16%;">Name</td>
          <td style="padding:3px 8px 3px 0;font-weight:700;color:#0f172a;font-size:13px;width:34%;">${staff.name}</td>
          <td style="padding:3px 8px 3px 0;color:#64748b;width:16%;">Designation</td>
          <td style="padding:3px 0;font-weight:600;color:#1e3a8a;">${staff.position}</td>
        </tr>
        <tr>
          <td style="padding:3px 8px 3px 0;color:#64748b;">Mobile / PAN</td>
          <td style="padding:3px 8px 3px 0;">${staff.phone || '—'} &nbsp;|&nbsp; ${staff.panNo || '—'}</td>
          <td style="padding:3px 8px 3px 0;color:#64748b;">Aadhar / Join</td>
          <td style="padding:3px 0;">${staff.aadharNo || '—'} &nbsp;|&nbsp; ${staff.joinDate ? new Date(staff.joinDate).toLocaleDateString('en-IN') : '—'}</td>
        </tr>
        ${(staff.bankAccount||staff.bankName) ? `<tr style="background:#f8fafc;"><td style="padding:4px 8px 4px 0;color:#64748b;">Bank A/C</td><td style="padding:4px 8px 4px 0;font-weight:600;color:#0369a1;">${staff.bankAccount||'—'} &nbsp;(${staff.ifscCode||'—'})</td><td style="padding:4px 8px 4px 0;color:#64748b;">Bank / Branch</td><td style="padding:4px 0;">${staff.bankName||'—'} &nbsp;|&nbsp; ${staff.bankBranch||'—'}</td></tr>` : ''}
      </table>
    </div>
  </div>

  <!-- ATTENDANCE -->
  <div style="margin:8px 18px 0;background:white;border-radius:10px;overflow:hidden;box-shadow:0 3px 12px rgba(0,0,0,0.07);">
    <div style="background:#f0fdf4;padding:7px 14px;border-bottom:1px solid #dcfce7;">
      <span style="color:#15803d;font-size:10px;font-weight:700;text-transform:uppercase;">📅 Attendance — ${mName}</span>
    </div>
    <div style="padding:10px 14px;">
      <table style="width:100%;border-collapse:separate;border-spacing:5px 0;">
        <tr>
          <td style="text-align:center;background:#eff6ff;border-radius:8px;padding:8px 4px;"><div style="font-size:20px;font-weight:900;color:#2563eb;">${daysInM}</div><div style="font-size:9px;color:#64748b;font-weight:600;">कुल दिन</div></td>
          <td style="text-align:center;background:#f0fdf4;border-radius:8px;padding:8px 4px;"><div style="font-size:20px;font-weight:900;color:#16a34a;">${present}</div><div style="font-size:9px;color:#64748b;font-weight:600;">उपस्थित</div></td>
          <td style="text-align:center;background:#fef2f2;border-radius:8px;padding:8px 4px;"><div style="font-size:20px;font-weight:900;color:#dc2626;">${absent}</div><div style="font-size:9px;color:#64748b;font-weight:600;">अनुपस्थित</div></td>
          <td style="text-align:center;background:#fefce8;border-radius:8px;padding:8px 4px;"><div style="font-size:20px;font-weight:900;color:#ca8a04;">${suns}</div><div style="font-size:9px;color:#64748b;font-weight:600;">रविवार</div></td>
          <td style="text-align:center;background:#fff7ed;border-radius:8px;padding:8px 4px;"><div style="font-size:20px;font-weight:900;color:#ea580c;">${late}</div><div style="font-size:9px;color:#64748b;font-weight:600;">लेट (₹${late*50})</div></td>
          <td style="text-align:center;background:#fdf4ff;border-radius:8px;padding:8px 4px;"><div style="font-size:20px;font-weight:900;color:#9333ea;">${wDays}</div><div style="font-size:9px;color:#64748b;font-weight:600;">Working Days</div></td>
        </tr>
      </table>
    </div>
  </div>

  <!-- EARNINGS + DEDUCTIONS -->
  <div style="margin:6px 18px 0;display:flex;gap:10px;">
    <div style="flex:1;background:white;border-radius:10px;overflow:hidden;box-shadow:0 3px 12px rgba(0,0,0,0.07);">
      <div style="background:#f0fdf4;padding:7px 14px;border-bottom:2px solid #16a34a;"><span style="color:#15803d;font-size:10px;font-weight:700;text-transform:uppercase;">💰 Earnings</span></div>
      <div style="padding:8px 10px;">
        <table style="width:100%;font-size:11px;border-collapse:collapse;">
          <tr><td style="padding:6px 5px;background:#f9fafb;">Basic Salary</td><td style="padding:6px 5px;background:#f9fafb;text-align:right;font-weight:700;color:#1a3a6e;">${fmt(base)}</td></tr>
          ${parseFloat(ex.da)>0 ? `<tr><td style="padding:6px 5px;border-bottom:1px solid #f5f5f5;">Dearness Allowance (DA)</td><td style="padding:6px 5px;text-align:right;border-bottom:1px solid #f5f5f5;">${fmt(ex.da)}</td></tr>` : ''}
          ${parseFloat(ex.hra)>0 ? `<tr><td style="padding:6px 5px;background:#f9fafb;">House Rent Allowance (HRA)</td><td style="padding:6px 5px;background:#f9fafb;text-align:right;">${fmt(ex.hra)}</td></tr>` : ''}
          ${parseFloat(ex.otherAllowance)>0 ? `<tr><td style="padding:6px 5px;border-bottom:1px solid #f5f5f5;">Other Allowance</td><td style="padding:6px 5px;text-align:right;border-bottom:1px solid #f5f5f5;">${fmt(ex.otherAllowance)}</td></tr>` : ''}
          ${incentive>0 ? `<tr><td style="padding:6px 5px;color:#15803d;font-weight:600;">⭐ Incentive</td><td style="padding:6px 5px;text-align:right;font-weight:700;color:#16a34a;">+${fmt(incentive)}</td></tr>` : ''}
          ${bonus>0 ? `<tr><td style="padding:6px 5px;background:#f9fafb;color:#7c3aed;font-weight:600;">🎁 Bonus</td><td style="padding:6px 5px;background:#f9fafb;text-align:right;font-weight:700;color:#7c3aed;">+${fmt(bonus)}</td></tr>` : ''}
          <tr style="background:#dcfce7;"><td style="padding:8px 5px;font-weight:700;color:#15803d;font-size:12px;">GROSS TOTAL</td><td style="padding:8px 5px;text-align:right;font-weight:900;color:#15803d;font-size:12px;">${fmt(totalEarnings+incentive+bonus)}</td></tr>
        </table>
      </div>
    </div>
    <div style="flex:1;background:white;border-radius:10px;overflow:hidden;box-shadow:0 3px 12px rgba(0,0,0,0.07);">
      <div style="background:#fef2f2;padding:7px 14px;border-bottom:2px solid #dc2626;"><span style="color:#dc2626;font-size:10px;font-weight:700;text-transform:uppercase;">💸 Deductions</span></div>
      <div style="padding:8px 10px;">
        <table style="width:100%;font-size:11px;border-collapse:collapse;">
          <tr><td style="padding:6px 5px;background:#f9fafb;">Absent Deduction<div style="font-size:8.5px;color:#94a3b8;">${deductDesc}</div></td><td style="padding:6px 5px;background:#f9fafb;text-align:right;font-weight:600;color:#dc2626;">${fmt(absDed)}</td></tr>
          ${late>0 ? `<tr><td style="padding:6px 5px;border-bottom:1px solid #f5f5f5;">Late Penalty (${late}×₹50)</td><td style="padding:6px 5px;text-align:right;color:#dc2626;border-bottom:1px solid #f5f5f5;">${fmt(latePenalty)}</td></tr>` : ''}
          ${parseFloat(ex.pf)>0 ? `<tr><td style="padding:6px 5px;background:#f9fafb;">Provident Fund (PF)</td><td style="padding:6px 5px;background:#f9fafb;text-align:right;color:#dc2626;">${fmt(ex.pf)}</td></tr>` : ''}
          ${parseFloat(ex.esi)>0 ? `<tr><td style="padding:6px 5px;border-bottom:1px solid #f5f5f5;">ESI</td><td style="padding:6px 5px;text-align:right;color:#dc2626;border-bottom:1px solid #f5f5f5;">${fmt(ex.esi)}</td></tr>` : ''}
          ${parseFloat(ex.tds)>0 ? `<tr><td style="padding:6px 5px;background:#f9fafb;">TDS</td><td style="padding:6px 5px;background:#f9fafb;text-align:right;color:#dc2626;">${fmt(ex.tds)}</td></tr>` : ''}
          ${insurance>0 ? `<tr><td style="padding:6px 5px;color:#0369a1;font-weight:600;">🛡️ Insurance</td><td style="padding:6px 5px;text-align:right;font-weight:700;color:#0369a1;">${fmt(insurance)}</td></tr>` : ''}
          ${parseFloat(ex.otherDeduction)>0 ? `<tr><td style="padding:6px 5px;background:#f9fafb;">Other</td><td style="padding:6px 5px;background:#f9fafb;text-align:right;color:#dc2626;">${fmt(ex.otherDeduction)}</td></tr>` : ''}
          <tr style="background:#fee2e2;"><td style="padding:8px 5px;font-weight:700;color:#dc2626;font-size:12px;">TOTAL DEDUCTIONS</td><td style="padding:8px 5px;text-align:right;font-weight:900;color:#dc2626;font-size:12px;">${fmt(totalDed)}</td></tr>
        </table>
      </div>
    </div>
  </div>

  <!-- NET SALARY -->
  <div style="margin:6px 18px 0;background:linear-gradient(135deg,#064e3b,#065f46,#059669);border-radius:12px;padding:13px 22px;box-shadow:0 6px 20px rgba(5,150,105,0.3);position:relative;overflow:hidden;">
    <div style="position:absolute;top:-15px;right:-15px;width:90px;height:90px;background:rgba(255,255,255,0.06);border-radius:50%;"></div>
    <table style="width:100%;"><tr>
      <td><div style="color:rgba(255,255,255,0.75);font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">💵 Net Salary Payable</div>
        <div style="color:white;font-size:34px;font-weight:900;margin-top:2px;">${fmt(netSalary)}</div>
        ${incentive+bonus>0?`<div style="color:rgba(255,255,255,0.7);font-size:9px;margin-top:2px;">⭐ Incentive/Bonus: +₹${Math.round(incentive+bonus).toLocaleString('en-IN')}</div>`:''}
      </td>
      <td style="text-align:right;vertical-align:middle;">
        <div style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:8px 12px;display:inline-block;">
          <div style="color:rgba(255,255,255,0.7);font-size:9px;">Per Day</div>
          <div style="color:white;font-size:13px;font-weight:700;">${fmt(perDay)}</div>
        </div>
      </td>
    </tr></table>
  </div>

  ${incList.length>0?`
  <div style="margin:6px 18px 0;background:white;border-radius:10px;overflow:hidden;box-shadow:0 3px 12px rgba(0,0,0,0.07);">
    <div style="background:#fdf4ff;padding:7px 14px;border-bottom:2px solid #9333ea;"><span style="color:#7e22ce;font-size:10px;font-weight:700;text-transform:uppercase;">⭐ Incentive / Bonus / Insurance</span></div>
    <div style="padding:8px 14px;"><table style="width:100%;font-size:10px;border-collapse:collapse;">
      <tr style="background:#f3f4f6;"><td style="padding:5px;font-weight:700;">Type</td><td style="padding:5px;font-weight:700;">Reason</td><td style="padding:5px;text-align:right;font-weight:700;">Amount</td></tr>
      ${incRowsHtml}
    </table></div>
  </div>` : ''}

  <!-- RULES + SIGNATURE in one row -->
  <div style="margin:6px 18px 0;display:flex;gap:10px;align-items:stretch;">
    <div style="flex:1.8;background:white;border-radius:10px;padding:7px 12px;box-shadow:0 3px 12px rgba(0,0,0,0.07);border-left:4px solid #f59e0b;">
      <div style="font-size:10px;font-weight:700;color:#b45309;margin-bottom:4px;">📋 VP Honda — नियम याद दिलाएं</div>
      <table style="width:100%;font-size:8.5px;color:#555;border-collapse:collapse;">
        <tr><td style="padding:1.5px 5px;">⏰ कार्य समय: 10:30 AM – 7:00 PM</td><td style="padding:1.5px 5px;">⚡ लेट आने पर ₹50/दिन penalty</td></tr>
        <tr><td style="padding:1.5px 5px;">📵 मोबाइल वर्जित = ₹100 जुर्माना</td><td style="padding:1.5px 5px;">👔 Uniform/ID = ₹50 जुर्माना</td></tr>
        <tr><td style="padding:1.5px 5px;">🗓️ 5+ बार लेट = 1 दिन extra कट</td><td style="padding:1.5px 5px;">🤝 ग्राहक शिकायत = तत्काल कार्रवाई</td></tr>
      </table>
    </div>
    <div style="flex:1;background:white;border-radius:10px;padding:7px 12px;box-shadow:0 3px 12px rgba(0,0,0,0.07);">
      <table style="width:100%;">
        <tr>
          <td style="text-align:center;width:50%;vertical-align:bottom;">
            <div style="border-top:2px solid #e2e8f0;padding-top:4px;margin-top:18px;">
              <div style="font-size:10px;color:#374151;font-weight:600;">${staff.name}</div>
              <div style="font-size:8.5px;color:#94a3b8;">Employee Signature</div>
            </div>
          </td>
          <td style="text-align:center;width:50%;vertical-align:bottom;">
            <div style="border-top:2px solid #e2e8f0;padding-top:4px;margin-top:18px;">
              <div style="font-size:10px;color:#374151;font-weight:600;">Authorised Signatory</div>
              <div style="font-size:8.5px;color:#94a3b8;">VP Honda, Bhopal</div>
            </div>
          </td>
        </tr>
      </table>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="background:linear-gradient(90deg,#0f172a,#1e3a8a);color:rgba(255,255,255,0.6);padding:9px 18px;text-align:center;font-size:9px;">
    यह computer-generated salary slip है &nbsp;|&nbsp; VP Honda Dealership © ${y} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-IN')}
  </div>
</div>`;

    html2pdf().set({
      margin: 0, filename: `SalarySlip_${staff.name}_${mName}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    }).from(el).save();
  };

  // ===== FORM 16 PDF (Beautiful Full Page) =====
  const downloadForm16PDF = () => {
    if (!selectedStaffPaySlip) { alert('कृपया कर्मचारी चुनें'); return; }
    const staff = selectedStaffPaySlip;
    const yr = `${selectedYearPaySlip}-${selectedYearPaySlip + 1}`;

    // Calculate 12 months salary data
    let annualSalary = 0, annualIncentive = 0, annualInsurance = 0, annualBonus = 0, annualAbsDed = 0, annualLatePen = 0;
    const monthlyBreakdown = [];
    const rulesStart = shopSettings?.attendanceRulesStartDate;

    for (let mo = 1; mo <= 12; mo++) {
      const base = staff.monthlySalary;
      const dInM = new Date(selectedYearPaySlip, mo, 0).getDate();
      const suns = countSundays(selectedYearPaySlip, mo - 1);
      const wDays = dInM - suns;
      const att = (attendanceRecords[staff.id] || []).filter(a => {
        const d = new Date(a.date); return d.getMonth() === mo - 1 && d.getFullYear() === selectedYearPaySlip;
      });
      const present = att.length;
      const absent = Math.max(0, wDays - present);
      const late = att.filter(a => a.checkInTime && isLateTime(a.checkInTime)).length;
      const perDay = base / wDays;

      // ⭐ Grace period check per month
      const thisMonthStart = new Date(selectedYearPaySlip, mo - 1, 1);
      const rulesActive = rulesStart && thisMonthStart >= new Date(rulesStart);

      let absDed = 0, latePen = 0;
      if (rulesActive) {
        absDed = absent * perDay;  // simple per-day deduction
        latePen = late * (shopSettings?.latePenalty || 50);
      }
      const incMo = (incentiveData[staff.id] || []).filter(i => i.month === mo && i.year === selectedYearPaySlip);
      const inc = incMo.filter(i => i.type === 'incentive').reduce((s, i) => s + i.amount, 0);
      const ins = incMo.filter(i => i.type === 'insurance').reduce((s, i) => s + i.amount, 0);
      const bon = incMo.filter(i => i.type === 'bonus').reduce((s, i) => s + i.amount, 0);
      const net = Math.max(0, base - absDed - latePen + inc + bon - ins);
      annualSalary += base; annualIncentive += inc; annualInsurance += ins;
      annualBonus += bon; annualAbsDed += absDed; annualLatePen += latePen;
      monthlyBreakdown.push({ mo, present, absent, late, absDed, latePen, inc, bon, ins, net, rulesActive });
    }
    const totalNet = annualSalary - annualAbsDed - annualLatePen + annualIncentive + annualBonus - annualInsurance;
    const fmt = (n) => 'Rs.' + Math.round(n).toLocaleString('en-IN');

    // Pre-build monthly rows to avoid triple-nested templates
    const monthRowsHtml = monthlyBreakdown.map((row, idx) => {
      const bg = idx % 2 === 0 ? '#f9fafb' : 'white';
      const absentColor = row.absent > 0 ? '#dc2626' : '#64748b';
      const absentW = row.absent > 0 ? 'font-weight:600;' : '';
      const lateColor = row.late > 0 ? '#ea580c' : '#64748b';
      const dedAmt = (row.absDed + row.latePen) > 0 ? '- Rs.' + Math.round(row.absDed + row.latePen).toLocaleString('en-IN') : '&mdash;';
      const incAmt = (row.inc + row.bon) > 0 ? '+ Rs.' + Math.round(row.inc + row.bon).toLocaleString('en-IN') : '&mdash;';
      return '<tr style="background:' + bg + ';">'
        + '<td style="padding:8px 10px;font-weight:600;">' + MONTHS[row.mo - 1] + '</td>'
        + '<td style="padding:8px;text-align:center;color:#16a34a;font-weight:600;">' + row.present + '</td>'
        + '<td style="padding:8px;text-align:center;color:' + absentColor + ';' + absentW + '">' + row.absent + '</td>'
        + '<td style="padding:8px;text-align:center;color:' + lateColor + ';">' + row.late + '</td>'
        + '<td style="padding:8px;text-align:right;">Rs.' + Math.round(staff.monthlySalary).toLocaleString('en-IN') + '</td>'
        + '<td style="padding:8px;text-align:right;color:' + ((row.absDed+row.latePen)>0?'#dc2626':'#64748b') + ';">' + dedAmt + '</td>'
        + '<td style="padding:8px;text-align:right;color:' + ((row.inc+row.bon)>0?'#16a34a':'#64748b') + ';">' + incAmt + '</td>'
        + '<td style="padding:8px 10px;text-align:right;font-weight:700;color:#1e3a8a;">Rs.' + Math.round(row.net).toLocaleString('en-IN') + '</td>'
        + '</tr>';
    }).join('');

    const el = document.createElement('div');
    el.innerHTML = `
<div style="font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;margin:0;padding:0;">

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 60%,#2563eb 100%);padding:30px 40px 22px;">
    <table style="width:100%;">
      <tr>
        <td>
          <div style="color:white;font-size:28px;font-weight:900;letter-spacing:3px;">🏍️ VP HONDA</div>
          <div style="color:rgba(255,255,255,0.7);font-size:11px;margin-top:3px;">Parwaliya Sadak, Bhopal (M.P.) — 462001</div>
          <div style="color:rgba(255,255,255,0.6);font-size:10px;margin-top:2px;">GSTIN: 23BCYPD9538B1ZG &nbsp;|&nbsp; 📞 9713394738</div>
        </td>
        <td style="text-align:right;vertical-align:top;">
          <div style="background:rgba(255,255,255,0.13);border:1.5px solid rgba(255,255,255,0.25);border-radius:12px;padding:14px 22px;display:inline-block;">
            <div style="color:white;font-size:22px;font-weight:900;letter-spacing:2px;">FORM 16</div>
            <div style="color:rgba(255,255,255,0.7);font-size:10px;margin-top:3px;">Certificate of Salary Income</div>
            <div style="color:rgba(255,255,255,0.8);font-size:11px;font-weight:700;margin-top:4px;">Assessment Year: ${yr}</div>
          </div>
        </td>
      </tr>
    </table>
    <div style="margin-top:14px;height:1px;background:linear-gradient(90deg,rgba(255,255,255,0.3),rgba(255,255,255,0.05));"></div>
    <div style="margin-top:10px;font-size:10px;color:rgba(255,255,255,0.5);">u/s 203 of the Income Tax Act, 1961 &nbsp;|&nbsp; Financial Year: ${selectedYearPaySlip}-${selectedYearPaySlip + 1}</div>
  </div>

  <!-- EMPLOYER + EMPLOYEE INFO -->
  <div style="margin:20px 24px 0;display:flex;gap:16px;">
    <div style="flex:1;background:white;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
      <div style="background:#eff6ff;padding:9px 16px;border-bottom:2px solid #2563eb;">
        <span style="color:#1e40af;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">🏢 Employer Details</span>
      </div>
      <div style="padding:14px 16px;font-size:12px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:4px 0;color:#64748b;width:40%;">Name</td><td style="font-weight:700;color:#0f172a;">VP HONDA DEALERSHIP</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;">Address</td><td>Parwaliya Sadak, Bhopal (M.P.)</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;">GSTIN</td><td style="font-weight:600;color:#2563eb;">23BCYPD9538B1ZG</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;">Period</td><td style="font-weight:600;">FY ${yr}</td></tr>
        </table>
      </div>
    </div>
    <div style="flex:1;background:white;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
      <div style="background:#f0fdf4;padding:9px 16px;border-bottom:2px solid #16a34a;">
        <span style="color:#15803d;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">👤 Employee Details</span>
      </div>
      <div style="padding:14px 16px;font-size:12px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:4px 0;color:#64748b;width:40%;">Name</td><td style="font-weight:700;color:#0f172a;font-size:14px;">${staff.name}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;">Designation</td><td style="font-weight:600;">${staff.position}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;">PAN No.</td><td style="font-weight:600;color:#2563eb;">${staff.panNo || 'Not Provided'}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;">Aadhar</td><td>${staff.aadharNo || '—'}</td></tr>
        </table>
      </div>
    </div>
  </div>

  ${(staff.bankAccount || staff.bankName) ? `
  <!-- BANK DETAILS -->
  <div style="margin:16px 24px 0;background:white;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:#f0f9ff;padding:9px 16px;border-bottom:2px solid #0369a1;">
      <span style="color:#0369a1;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">🏦 Bank Account Details</span>
    </div>
    <div style="padding:14px 20px;font-size:12px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:5px;color:#64748b;width:20%;">Account No.</td>
          <td style="padding:5px;font-weight:700;color:#0369a1;width:30%;">${staff.bankAccount || '—'}</td>
          <td style="padding:5px;color:#64748b;width:20%;">IFSC Code</td>
          <td style="padding:5px;font-weight:700;color:#0369a1;">${staff.ifscCode || '—'}</td>
        </tr>
        <tr>
          <td style="padding:5px;color:#64748b;">Bank Name</td>
          <td style="padding:5px;">${staff.bankName || '—'}</td>
          <td style="padding:5px;color:#64748b;">Branch</td>
          <td style="padding:5px;">${staff.bankBranch || '—'}</td>
        </tr>
      </table>
    </div>
  </div>` : ''}

  <!-- ANNUAL SUMMARY -->
  <div style="margin:16px 24px 0;background:white;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:#fdf4ff;padding:9px 16px;border-bottom:2px solid #9333ea;">
      <span style="color:#7e22ce;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">📊 Annual Salary Statement — FY ${yr}</span>
    </div>
    <div style="padding:16px 20px;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <tr style="background:#f8fafc;">
          <td style="padding:10px;font-weight:700;border-bottom:2px solid #e2e8f0;">Description</td>
          <td style="padding:10px;text-align:right;font-weight:700;border-bottom:2px solid #e2e8f0;">Amount (₹)</td>
        </tr>
        <tr>
          <td style="padding:11px 10px;border-bottom:1px solid #f0f0f0;">
            Annual Basic Salary (12 months × ${fmt(staff.monthlySalary)})
          </td>
          <td style="padding:11px 10px;text-align:right;font-weight:600;border-bottom:1px solid #f0f0f0;">${fmt(annualSalary)}</td>
        </tr>
        ${annualIncentive + annualBonus > 0 ? `
        <tr style="background:#f0fdf4;">
          <td style="padding:11px 10px;border-bottom:1px solid #f0f0f0;color:#15803d;font-weight:600;">+ Total Incentive & Bonus</td>
          <td style="padding:11px 10px;text-align:right;font-weight:700;color:#16a34a;border-bottom:1px solid #f0f0f0;">+ ${fmt(annualIncentive + annualBonus)}</td>
        </tr>` : ''}
        <tr style="background:#fef2f2;">
          <td style="padding:11px 10px;border-bottom:1px solid #f0f0f0;color:#dc2626;font-weight:600;">
            − Total Deductions (Absent: ${fmt(annualAbsDed)} + Late: ${fmt(annualLatePen)}${annualInsurance > 0 ? ' + Insurance: ' + fmt(annualInsurance) : ''})
          </td>
          <td style="padding:11px 10px;text-align:right;font-weight:700;color:#dc2626;border-bottom:1px solid #f0f0f0;">− ${fmt(annualAbsDed + annualLatePen + annualInsurance)}</td>
        </tr>
        <tr style="background:linear-gradient(90deg,#dcfce7,#f0fdf4);">
          <td style="padding:14px 10px;font-weight:800;color:#15803d;font-size:15px;border-radius:0 0 0 8px;">
            ✅ NET ANNUAL SALARY RECEIVED
          </td>
          <td style="padding:14px 10px;text-align:right;font-weight:900;color:#15803d;font-size:18px;border-radius:0 0 8px 0;">${fmt(totalNet)}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- MONTH-WISE TABLE -->
  <div style="margin:16px 24px 0;background:white;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:#eff6ff;padding:9px 16px;border-bottom:2px solid #2563eb;">
      <span style="color:#1e40af;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">📅 Month-wise Salary Breakup</span>
    </div>
    <div style="padding:0;">
      <table style="width:100%;border-collapse:collapse;font-size:10px;">
        <tr style="background:#1e3a8a;color:white;">
          <td style="padding:9px 10px;font-weight:700;">Month</td>
          <td style="padding:9px 8px;text-align:center;font-weight:700;">Present</td>
          <td style="padding:9px 8px;text-align:center;font-weight:700;">Absent</td>
          <td style="padding:9px 8px;text-align:center;font-weight:700;">Late</td>
          <td style="padding:9px 8px;text-align:right;font-weight:700;">Basic</td>
          <td style="padding:9px 8px;text-align:right;font-weight:700;">Deduction</td>
          <td style="padding:9px 8px;text-align:right;font-weight:700;">Incentive</td>
          <td style="padding:9px 10px;text-align:right;font-weight:700;">Net</td>
        </tr>
        ${monthRowsHtml}
        <tr style="background:#1e3a8a;color:white;font-weight:700;">
          <td style="padding:10px;">ANNUAL TOTAL</td>
          <td colspan="3" style="text-align:center;">—</td>
          <td style="padding:10px;text-align:right;">${fmt(annualSalary)}</td>
          <td style="padding:10px;text-align:right;">- ${fmt(annualAbsDed + annualLatePen)}</td>
          <td style="padding:10px;text-align:right;">+ ${fmt(annualIncentive + annualBonus)}</td>
          <td style="padding:10px;text-align:right;font-size:13px;">${fmt(totalNet)}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- DECLARATION -->
  <div style="margin:16px 24px;background:white;border-radius:14px;padding:18px 24px;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="font-size:10px;color:#555;background:#fafafa;padding:12px 16px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:16px;line-height:1.8;">
      यह प्रमाण-पत्र VP Honda Dealership, Bhopal द्वारा जारी किया गया है। इसमें दी गई जानकारी कर्मचारी ${staff.name} के Financial Year ${yr} की वास्तविक salary records के अनुसार है।
      यह document income tax filing और अन्य सरकारी प्रयोजनों के लिए उपयोग किया जा सकता है।
    </div>
    <table style="width:100%;">
      <tr>
        <td style="text-align:center;width:50%;">
          <div style="margin-top:32px;border-top:2px solid #e2e8f0;padding-top:10px;">
            <div style="font-size:12px;font-weight:600;color:#374151;">${staff.name}</div>
            <div style="font-size:10px;color:#94a3b8;">Employee Signature</div>
          </div>
        </td>
        <td style="text-align:center;width:50%;">
          <div style="margin-top:32px;border-top:2px solid #e2e8f0;padding-top:10px;">
            <div style="font-size:12px;font-weight:600;color:#374151;">Authorised Signatory</div>
            <div style="font-size:10px;color:#94a3b8;">VP Honda, Bhopal</div>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <!-- FOOTER -->
  <div style="background:linear-gradient(90deg,#0f172a,#1e3a8a);color:rgba(255,255,255,0.55);padding:12px 24px;text-align:center;font-size:9.5px;">
    यह computer-generated Form 16 है &nbsp;|&nbsp; VP Honda Dealership © ${selectedYearPaySlip} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-IN')}
  </div>
</div>`;

    html2pdf().set({
      margin: 0, filename: `Form16_${staff.name}_${yr}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    }).from(el).save();
  };

  // ===== CRUD =====
  const handleAddStaff = () => {
    if (!newStaff.name || !newStaff.monthlySalary) { alert('नाम और वेतन जरूरी है'); return; }
    const s = { id: Date.now(), ...newStaff, createdAt: new Date().toISOString() };
    const u = [...staffList, s]; setStaffList(u); saveData(u);
    setNewStaff(emptyStaff); setShowAddForm(false); alert('✅ कर्मचारी जोड़ा गया');
  };
  const handleEditOpen = (staff) => { setEditingStaff(staff.id); setEditForm({ ...staff }); };
  const handleEditSave = () => {
    if (!editForm.name || !editForm.monthlySalary) { alert('नाम और वेतन जरूरी है'); return; }
    const u = staffList.map(s => s.id === editingStaff ? { ...editForm } : s);
    setStaffList(u); saveData(u); setEditingStaff(null); setEditForm({});
    alert('✅ अपडेट हो गया');
  };
  const handleDeleteStaff = (id) => {
    if (window.confirm('हटाना है?')) { const u = staffList.filter(s => s.id !== id); setStaffList(u); saveData(u); }
  };

  const handleResetPIN = async (staff) => {
    if (!window.confirm(`${staff.name} का PIN reset करें? नया PIN: 1234`)) return;
    // Update locally
    const updated = staffList.map(s => s.id === staff.id ? { ...s, pin: '1234' } : s);
    setStaffList(updated); saveData(updated);
    // Sync to backend
    try {
      await fetch(api('/api/staff/reset-pin'), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: staff.id, newPin: '1234' }),
      });
    } catch {}
    alert(`✅ ${staff.name} का PIN reset हो गया → 1234`);
  };

  const handleAddPayment = async () => {
    if (!selectedStaffForPayment || !paymentEntry.amount) { alert('कर्मचारी और राशि चुनें'); return; }
    const staff = staffList.find(s => s.id === selectedStaffForPayment);
    if (!staff) { alert('कर्मचारी नहीं मिला'); return; }

    // ⭐ Save to MongoDB /api/salaries (linked with Salary Management page)
    const dateObj = new Date(paymentEntry.date);
    const payload = {
      staffId: String(staff.id),
      staffName: staff.name,
      type: 'salary',
      amount: parseFloat(paymentEntry.amount),
      paymentDate: paymentEntry.date,
      forMonth: dateObj.getMonth() + 1,
      forYear: dateObj.getFullYear(),
      notes: paymentEntry.description || 'Salary Payment',
      method: 'Cash',
    };

    try {
      const res = await fetch(api('/api/salaries'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Server error');
      // Reload from MongoDB to get fresh data on both pages
      await loadSalaryData();
      setPaymentEntry({ amount: 0, date: new Date().toISOString().split('T')[0], description: 'Salary Payment' });
      setShowPaymentForm(false);
      alert('✅ पेमेंट जोड़ा गया\n\n💡 यह Salary Management page पर भी दिखेगा');
    } catch (err) {
      // Fallback: save locally
      const p = { ...paymentHistory };
      if (!p[selectedStaffForPayment]) p[selectedStaffForPayment] = [];
      p[selectedStaffForPayment].push({ date: paymentEntry.date, amount: parseFloat(paymentEntry.amount), note: paymentEntry.description, id: Date.now(), type: 'salary' });
      setPaymentHistory(p);
      try { localStorage.setItem('staffPayments', JSON.stringify(p)); } catch {}
      alert('⚠️ ऑफलाइन save हुआ। MongoDB connection check करें।');
      setShowPaymentForm(false);
    }
  };
  const handleAddNote = () => {
    if (!selectedStaffForNotes || !noteText) { alert('कर्मचारी और नोट भरें'); return; }
    const n = { ...manualNotes };
    if (!n[selectedStaffForNotes]) n[selectedStaffForNotes] = [];
    n[selectedStaffForNotes].push({ date: new Date().toISOString(), text: noteText, type: highlightText, id: Date.now() });
    setManualNotes(n); saveNotes(n);
    setNoteText(''); setHighlightText(''); setShowNotesForm(false); alert('✅ नोट जोड़ा गया');
  };
  const handleAddIncentive = async () => {
    if (!selectedStaffForIncentive || !incentiveEntry.amount) { alert('कर्मचारी और राशि भरें'); return; }
    const staff = staffList.find(s => s.id === selectedStaffForIncentive);
    if (!staff) { alert('कर्मचारी नहीं मिला'); return; }

    // ⭐ Save to MongoDB /api/salaries
    const today = new Date().toISOString().split('T')[0];
    const payload = {
      staffId: String(staff.id),
      staffName: staff.name,
      type: incentiveEntry.type,  // 'bonus' | 'incentive' | 'insurance'
      amount: parseFloat(incentiveEntry.amount),
      paymentDate: today,
      forMonth: incentiveEntry.month,
      forYear: incentiveEntry.year,
      notes: incentiveEntry.reason || '',
    };

    try {
      const res = await fetch(api('/api/salaries'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Server error');
      await loadSalaryData();
      setIncentiveEntry({ amount: '', reason: 'अच्छा प्रदर्शन', type: 'incentive', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
      setShowIncentiveForm(false);
      alert('✅ जोड़ा गया\n\n💡 यह Salary Management page पर भी दिखेगा');
    } catch (err) {
      // Fallback: save locally
      const inc = { ...incentiveData };
      if (!inc[selectedStaffForIncentive]) inc[selectedStaffForIncentive] = [];
      inc[selectedStaffForIncentive].push({ ...incentiveEntry, amount: parseFloat(incentiveEntry.amount), id: Date.now() });
      setIncentiveData(inc);
      try { localStorage.setItem('staffIncentives', JSON.stringify(inc)); } catch {}
      alert('⚠️ ऑफलाइन save हुआ');
      setShowIncentiveForm(false);
    }
  };

  const getReminders = () => {
    const today = new Date().toISOString().split('T')[0];
    return staffList.map(staff => {
      const att = (attendanceRecords[staff.id] || []).find(a => a.date === today);
      if (!att) return { type: 'absent', message: `${staff.name} आज नहीं आया है` };
      if (att.checkInTime && att.checkOutTime) return { type: 'completed', message: `${staff.name}: ${att.checkInTime} → ${att.checkOutTime}` };
      return { type: 'present', message: `${staff.name}: Check-in ${att.checkInTime}` };
    });
  };
  const reminders = getReminders();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* ===== LANDING PAGE (shown when no one is logged in) ===== */}
        {showLandingPage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
            <div className="w-full max-w-md mx-4">
              {/* Logo */}
              <div className="text-center mb-8">
                <div className="text-5xl mb-3">🏍️</div>
                <h1 className="text-3xl font-black text-white tracking-widest">VP HONDA</h1>
                <p className="text-blue-300 text-sm mt-1">Parwaliya Sadak, Bhopal</p>
                <div className="h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent mt-4"></div>
                <p className="text-slate-400 text-xs mt-3">Staff Management System</p>
              </div>

              {/* Login Options */}
              <div className="space-y-3">
                <button
                  onClick={() => { setShowAdminLogin(true); setShowLandingPage(false); }}
                  className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 text-base shadow-lg transition-all"
                >
                  <Shield size={22} /> Admin Login
                  <span className="text-yellow-200 text-xs ml-auto">सभी records देखें</span>
                </button>

                <button
                  onClick={() => setShowStaffLogin(true)}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 text-base shadow-lg transition-all"
                >
                  <Users size={22} /> Staff Login
                  <span className="text-blue-200 text-xs ml-auto">अपना account देखें</span>
                </button>
              </div>

              <p className="text-slate-600 text-xs text-center mt-6">© 2026 VP Honda Dealership</p>
            </div>
          </div>
        )}

        {/* ===== ADMIN LOGIN MODAL ===== */}
        {showAdminLogin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => { setShowAdminLogin(false); setAdminPasswordInput(''); setLoginError(''); setShowLandingPage(true); }}>
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-yellow-100 p-2 rounded-full"><Lock size={24} className="text-yellow-600" /></div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Admin Login</h2>
                  <p className="text-gray-500 text-xs">VP Honda — Full Access</p>
                </div>
              </div>
              <div className="relative mb-3">
                <input type={showPassword ? 'text' : 'password'} value={adminPasswordInput}
                  onChange={e => { setAdminPasswordInput(e.target.value); setLoginError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                  placeholder="Admin पासवर्ड डालें"
                  className="w-full border-2 border-red-300 rounded-lg px-4 py-3 pr-12 text-gray-800 focus:outline-none focus:border-red-500 text-base" autoFocus />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {loginError && <p className="text-red-500 text-sm mb-3 font-medium">{loginError}</p>}
              <div className="flex gap-3">
                <button onClick={handleAdminLogin} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg">Login</button>
                <button onClick={() => { setShowAdminLogin(false); setAdminPasswordInput(''); setLoginError(''); setShowLandingPage(true); }} className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-lg">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ===== STAFF LOGIN MODAL ===== */}
        {showStaffLogin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => { setShowStaffLogin(false); setStaffLoginPin(''); setStaffLoginError(''); }}>
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-blue-100 p-2 rounded-full"><Users size={24} className="text-blue-600" /></div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Staff Login</h2>
                  <p className="text-gray-500 text-xs">सिर्फ अपना account दिखेगा</p>
                </div>
              </div>

              {/* Name Selection */}
              <div className="mb-3">
                <label className="text-gray-600 text-sm font-semibold mb-1.5 block">👤 अपना नाम चुनें:</label>
                <select
                  value={staffLoginSelectedId}
                  onChange={e => { setStaffLoginSelectedId(e.target.value); setStaffLoginError(''); }}
                  className="w-full border-2 border-blue-200 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:border-blue-500 text-base bg-white"
                >
                  <option value="">-- नाम चुनें --</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.position})</option>)}
                </select>
              </div>

              {/* PIN */}
              <div className="mb-3">
                <label className="text-gray-600 text-sm font-semibold mb-1.5 block">🔐 PIN डालें:</label>
                <div className="relative">
                  <input
                    type={showStaffPin ? 'text' : 'password'}
                    value={staffLoginPin}
                    onChange={e => { setStaffLoginPin(e.target.value.replace(/\D/g,'').slice(0,6)); setStaffLoginError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleStaffLogin()}
                    placeholder="PIN (default: 1234)"
                    className="w-full border-2 border-blue-200 rounded-lg px-4 py-3 pr-12 text-gray-800 focus:outline-none focus:border-blue-500 text-base tracking-widest"
                    maxLength="6"
                  />
                  <button onClick={() => setShowStaffPin(!showStaffPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showStaffPin ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <p className="text-gray-400 text-xs mt-1">Default PIN: 1234 (Admin से बदलवाएं)</p>
              </div>

              {staffLoginError && <p className="text-red-500 text-sm mb-3 font-medium">{staffLoginError}</p>}

              <div className="flex gap-3">
                <button onClick={handleStaffLogin} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-lg">Login</button>
                <button onClick={() => { setShowStaffLogin(false); setStaffLoginPin(''); setStaffLoginError(''); }} className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-lg">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ===== TOP BAR ===== */}
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div>
            <h1 className="text-2xl font-bold text-white">👥 Staff Management</h1>
            <p className="text-slate-400 text-sm">VP Honda · Bhopal</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {/* Admin controls */}
            {isAdmin ? (
              <div className="flex items-center gap-2">
                <span className="bg-yellow-700 text-yellow-200 text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-1"><Shield size={14} /> Admin</span>
                <Button onClick={handleAdminLogout} className="bg-red-700 hover:bg-red-600 text-white text-sm px-3 py-2 flex items-center gap-1"><Unlock size={14} /> Logout</Button>
              </div>
            ) : loggedInStaff ? (
              <div className="flex items-center gap-2">
                <span className="bg-blue-700 text-blue-200 text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-1">
                  <Users size={14} /> {loggedInStaff.name}
                </span>
                <Button onClick={handleStaffLogout} className="bg-red-700 hover:bg-red-600 text-white text-sm px-3 py-2 flex items-center gap-1"><Unlock size={14} /> Logout</Button>
              </div>
            ) : null}

            {/* Admin action buttons */}
            {isAdmin && (
              <>
                <Button onClick={() => setShowAddForm(true)} className="bg-green-600 hover:bg-green-700 text-white font-bold text-sm px-3 py-2"><Plus size={16} className="mr-1" />कर्मचारी</Button>
                <Button onClick={() => setShowIncentiveForm(true)} className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm px-3 py-2"><Star size={16} className="mr-1" />Incentive</Button>
                <Button onClick={() => setShowNotesForm(true)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm px-3 py-2"><Lightbulb size={16} className="mr-1" />नोट</Button>
              </>
            )}
            <Button onClick={() => setShowPaySlipModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-3 py-2"><FileText size={16} className="mr-1" />Pay Slip</Button>
          </div>
        </div>

        {/* Status bar */}
        {loggedInStaff && !isAdmin && (
          <div className="bg-blue-900/40 border border-blue-600 rounded-lg px-4 py-2 flex items-center gap-2 text-blue-300 text-sm">
            <Users size={15} />
            <span>नमस्ते <b>{loggedInStaff.name}</b>! आप सिर्फ अपना account देख सकते हैं।</span>
          </div>
        )}
        {!isAdmin && !loggedInStaff && !showLandingPage && (
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg px-4 py-2 flex items-center gap-2 text-yellow-300 text-sm">
            <Lock size={15} /><span><b>View Only</b> — बदलाव के लिए Admin Login करें।</span>
          </div>
        )}

        {/* REMINDERS */}
        {reminders.length > 0 && (
          <Card className="bg-gradient-to-r from-blue-900 to-purple-900 border-blue-600">
            <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-blue-300 flex items-center gap-2 text-base"><Bell size={20} /> 🔔 आज की जानकारी</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {reminders.map((r, i) => (
                  <div key={i} className={`p-3 rounded-lg flex items-center gap-2 text-sm ${r.type === 'absent' ? 'bg-red-900/40 border border-red-500' : r.type === 'completed' ? 'bg-green-900/40 border border-green-500' : 'bg-blue-900/40 border border-blue-500'}`}>
                    <span>{r.type === 'absent' ? '❌' : r.type === 'completed' ? '✅' : '⏱️'}</span>
                    <p className="text-white font-semibold text-xs">{r.message}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* RULES */}
        <Card className="bg-gradient-to-r from-yellow-900 to-orange-900 border-2 border-yellow-500">
          <CardHeader className="pb-2 pt-3 px-4 cursor-pointer" onClick={() => setShowRules(!showRules)}>
            <div className="flex justify-between items-center">
              <CardTitle className="text-yellow-300 text-base flex items-center gap-2"><AlertCircle size={20} className="animate-pulse" /> ⚠️ Salary नियम</CardTitle>
              {showRules ? <ChevronUp size={18} className="text-yellow-300" /> : <ChevronDown size={18} className="text-yellow-300" />}
            </div>
          </CardHeader>
          {showRules && (
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {[['⏰','10:30–7:00 PM। लेट = ₹50/दिन।'],['📅','रविवार off। 5+ absent = रविवार भी कटेगा।'],['🗓️','8-10 दिन absent = 15 दिन fixed कटौती।'],['⚡','5+ बार लेट = 1 दिन extra।'],['🎯','Target miss = Incentive बंद।'],['📵','मोबाइल = ₹100 जुर्माना।'],['👔','Uniform/ID = ₹50 जुर्माना।'],['⚖️','दुर्व्यवहार = बर्खास्तगी।']].map(([icon, text], i) => (
                  <div key={i} className="bg-yellow-900/40 border border-yellow-700 rounded-lg p-2">
                    <span className="text-yellow-300">{icon} </span><span className="text-yellow-100">{text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        {/* 📍 SHOP LOCATION STATUS (GPS-based attendance) */}
        <ShopLocationBanner
          isAdmin={isAdmin}
          shopSettings={shopSettings}
          onUpdate={(newSettings) => setShopSettings(newSettings)}
        />

        {/* 🔗 SALARY SYSTEM LINK STATUS — Connects Staff Mgmt with Salary Mgmt */}
        {isAdmin && (
          <SalarySystemLinkBanner
            staffList={staffList}
            salaryEntities={salaryEntities}
            onAutoLink={async () => {
              // Auto-create salary entities for unlinked staff
              const unlinkedStaff = staffList.filter(s => !salaryEntities.find(e =>
                e.type === 'staff' && e.active &&
                String(e.name||'').trim().toLowerCase() === String(s.name||'').trim().toLowerCase()
              ));
              if (unlinkedStaff.length === 0) {
                alert('✅ सभी कर्मचारी पहले से Salary Management से linked हैं!');
                return;
              }
              if (!window.confirm(`${unlinkedStaff.length} कर्मचारी के लिए Salary Entity बनानी है?\n\n${unlinkedStaff.map(s => '• ' + s.name + ' (₹' + (s.monthlySalary||0).toLocaleString('en-IN') + ')').join('\n')}\n\nजारी रखें?`)) return;

              let created = 0, failed = 0;
              for (const s of unlinkedStaff) {
                try {
                  const r = await fetch(api('/api/salary-entities'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: s.name,
                      type: 'staff',
                      monthlyAmount: Number(s.monthlySalary || 0),
                      startDate: s.joinDate || new Date().toISOString().split('T')[0],
                      notes: `Auto-linked from Staff Management. Position: ${s.position || '-'}, Phone: ${s.phone || '-'}`,
                      photo: s.photo || '',
                    }),
                  });
                  if (r.ok) created++; else failed++;
                } catch { failed++; }
              }
              alert(`✅ ${created} entities बनाई गईं\n${failed > 0 ? '❌ ' + failed + ' fail हुईं\n' : ''}\nLinks update करने के लिए page reload करें।`);
              await loadData();
            }}
          />
        )}

        {/* ADD STAFF */}
        {showAddForm && isAdmin && (
          <Card className="bg-slate-800 border-green-600 border-2">
            <CardHeader className="bg-green-900/50 py-3 px-4"><CardTitle className="text-white text-base">➕ नया कर्मचारी</CardTitle></CardHeader>
            <CardContent className="pt-4">
              <StaffFormFields data={newStaff} setData={setNewStaff} />
              <div className="flex gap-3 mt-4">
                <Button onClick={handleAddStaff} className="bg-green-600 hover:bg-green-700 text-white font-bold">➕ जोड़ें</Button>
                <Button onClick={() => setShowAddForm(false)} className="bg-gray-600 hover:bg-gray-700 text-white">✖️ रद्द</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* EDIT STAFF */}
        {editingStaff && isAdmin && (
          <Card className="bg-slate-800 border-blue-500 border-2">
            <CardHeader className="bg-blue-900/50 py-3 px-4"><CardTitle className="text-white text-base">✏️ संपादित — {editForm.name}</CardTitle></CardHeader>
            <CardContent className="pt-4">
              <StaffFormFields data={editForm} setData={setEditForm} />
              <div className="flex gap-3 mt-4">
                <Button onClick={handleEditSave} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">💾 सहेजें</Button>
                <Button onClick={() => { setEditingStaff(null); setEditForm({}); }} className="bg-gray-600 hover:bg-gray-700 text-white">✖️ रद्द</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* INCENTIVE FORM */}
        {showIncentiveForm && isAdmin && (
          <Card className="bg-slate-800 border-amber-500 border-2">
            <CardHeader className="bg-amber-900/50 py-3 px-4"><CardTitle className="text-amber-300 text-base">⭐ Incentive / Insurance / Bonus</CardTitle></CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><label className="text-slate-400 text-xs mb-1 block">कर्मचारी</label>
                  <select value={selectedStaffForIncentive || ''} onChange={e => setSelectedStaffForIncentive(e.target.value)} className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md text-sm">
                    <option value="">-- चुनें --</option>{staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select></div>
                <div><label className="text-slate-400 text-xs mb-1 block">प्रकार</label>
                  <select value={incentiveEntry.type} onChange={e => setIncentiveEntry({ ...incentiveEntry, type: e.target.value })} className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md text-sm">
                    <option value="incentive">⭐ Incentive (जुड़ेगा)</option>
                    <option value="bonus">🎁 Bonus (जुड़ेगा)</option>
                    <option value="insurance">🛡️ Insurance (कटेगा)</option>
                  </select></div>
                <div><label className="text-slate-400 text-xs mb-1 block">राशि (₹)</label>
                  <Input type="number" placeholder="राशि" value={incentiveEntry.amount} onChange={e => setIncentiveEntry({ ...incentiveEntry, amount: e.target.value })} className="bg-slate-700 text-white border-slate-600" /></div>
                <div><label className="text-slate-400 text-xs mb-1 block">कारण</label>
                  <Input placeholder="कारण" value={incentiveEntry.reason} onChange={e => setIncentiveEntry({ ...incentiveEntry, reason: e.target.value })} className="bg-slate-700 text-white border-slate-600" /></div>
                <div><label className="text-slate-400 text-xs mb-1 block">महीना</label>
                  <select value={incentiveEntry.month} onChange={e => setIncentiveEntry({ ...incentiveEntry, month: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md text-sm">
                    {MONTHS.map((mo, i) => <option key={i} value={i + 1}>{mo}</option>)}
                  </select></div>
                <div><label className="text-slate-400 text-xs mb-1 block">साल</label>
                  <select value={incentiveEntry.year} onChange={e => setIncentiveEntry({ ...incentiveEntry, year: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md text-sm">
                    {[2026, 2025, 2024].map(y => <option key={y} value={y}>{y}</option>)}
                  </select></div>
              </div>
              <div className="flex gap-3 mt-4">
                <Button onClick={handleAddIncentive} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">✅ जोड़ें</Button>
                <Button onClick={() => setShowIncentiveForm(false)} className="bg-gray-600 hover:bg-gray-700 text-white">✖️ रद्द</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* NOTES FORM */}
        {showNotesForm && isAdmin && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="bg-slate-700 py-3 px-4"><CardTitle className="text-white text-base">📝 नोट जोड़ें</CardTitle></CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select value={selectedStaffForNotes || ''} onChange={e => setSelectedStaffForNotes(e.target.value)} className="px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md text-sm">
                  <option value="">कर्मचारी चुनें</option>{staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value={highlightText} onChange={e => setHighlightText(e.target.value)} className="px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md text-sm">
                  <option value="">प्रकार</option>
                  <option value="⭐ अच्छा प्रदर्शन">⭐ अच्छा प्रदर्शन</option>
                  <option value="⚠️ चेतावनी">⚠️ चेतावनी</option>
                  <option value="🎉 प्रशंसा">🎉 प्रशंसा</option>
                  <option value="🔴 गंभीर">🔴 गंभीर</option>
                  <option value="💬 नोट">💬 नोट</option>
                </select>
              </div>
              <textarea placeholder="नोट लिखें..." value={noteText} onChange={e => setNoteText(e.target.value)} className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md mt-3 text-sm" rows="2" />
              <div className="flex gap-3 mt-3">
                <Button onClick={handleAddNote} className="bg-purple-600 hover:bg-purple-700 text-white font-bold">✅ जोड़ें</Button>
                <Button onClick={() => { setShowNotesForm(false); setNoteText(''); setHighlightText(''); }} className="bg-gray-600 hover:bg-gray-700 text-white">✖️ रद्द</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STAFF CARDS */}
        {staffList.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="text-center py-12">
              <Users size={48} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">कोई कर्मचारी नहीं। Admin Login करके जोड़ें।</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {staffList
              // If staff is logged in, show ONLY their card; admin sees all
              .filter(s => isAdmin || !loggedInStaff || s.id === loggedInStaff.id)
              .map((staff) => {
              const details = calculateSalaryDetails(staff.id);
              const attendance = attendanceRecords[staff.id] || [];
              const todayStr = new Date().toISOString().split('T')[0];
              const todayAtt = attendance.find(a => a.date === todayStr);
              const staffNotes = manualNotes[staff.id] || [];
              const isExpanded = expandedStaff.has(staff.id);

              return (
                <Card key={staff.id} className="bg-slate-800 border-slate-700 shadow-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-700 to-blue-800 px-4 py-3 cursor-pointer select-none" onClick={() => toggleExpand(staff.id)}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-bold text-base">{staff.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${todayAtt ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                            {todayAtt ? '✓ उपस्थित' : '✗ absent'}
                          </span>
                          {details.lateDays > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500 text-white font-bold">⚡{details.lateDays}×लेट</span>}
                          {details.totalIncentive > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500 text-black font-bold">⭐₹{details.totalIncentive.toLocaleString('en-IN')}</span>}
                          {/* ⭐ Link status with Salary Management */}
                          {details.linkedEntityName ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500 text-white font-bold" title={`Linked to ${details.linkedEntityName} in Salary Mgmt`}>🔗 LINKED</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500 text-white font-bold" title="Not linked to Salary Management entity">⚠ UNLINKED</span>
                          )}
                        </div>
                        <p className="text-blue-200 text-xs mt-0.5">{staff.position} • {staff.phone}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="hidden sm:flex gap-4 text-xs text-center">
                          <div><p className="text-green-300 font-bold">{details.presentDays || 0}</p><p className="text-blue-300">उपस्थित</p></div>
                          <div><p className="text-red-300 font-bold">{details.absentDays || 0}</p><p className="text-blue-300">absent</p></div>
                          <div><p className="text-yellow-300 font-bold">₹{parseFloat(details.netSalary || 0).toLocaleString('en-IN')}</p><p className="text-blue-300">net salary</p></div>
                          <div><p className={`font-bold ${parseFloat(details.balance) > 0 ? 'text-orange-300' : 'text-green-300'}`}>₹{Math.abs(parseFloat(details.balance || 0)).toLocaleString('en-IN')}</p><p className="text-blue-300">{parseFloat(details.balance) > 0 ? 'बकाया' : 'क्लियर'}</p></div>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <Button onClick={() => handleResetPIN(staff)} className="bg-amber-600 hover:bg-amber-500 h-8 px-2 text-xs" title="PIN Reset">🔑</Button>
                            <Button onClick={() => handleEditOpen(staff)} className="bg-cyan-600 hover:bg-cyan-500 h-8 w-8 p-0"><Edit size={14} /></Button>
                            <Button onClick={() => handleDeleteStaff(staff.id)} className="bg-red-600 hover:bg-red-700 h-8 w-8 p-0"><Trash2 size={14} /></Button>
                          </div>
                        )}
                        {isExpanded ? <ChevronUp size={18} className="text-white" /> : <ChevronDown size={18} className="text-white" />}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <CardContent className="pt-4 pb-4">
                      {/* Info bar */}
                      <div className="bg-slate-700/50 rounded-lg p-3 mb-4 text-xs text-slate-300 grid grid-cols-2 md:grid-cols-4 gap-2">
                        {staff.father && <div><span className="text-slate-500">पिता: </span>{staff.father}</div>}
                        {staff.joinDate && <div><span className="text-slate-500">Join: </span>{new Date(staff.joinDate).toLocaleDateString('en-IN')}</div>}
                        {staff.aadharNo && <div><span className="text-slate-500">Aadhar: </span>{staff.aadharNo}</div>}
                        {staff.panNo && <div><span className="text-slate-500">PAN: </span>{staff.panNo}</div>}
                        {staff.bankAccount && <div><span className="text-slate-500">A/C: </span><span className="text-cyan-400">{staff.bankAccount}</span></div>}
                        {staff.ifscCode && <div><span className="text-slate-500">IFSC: </span><span className="text-cyan-400">{staff.ifscCode}</span></div>}
                        {staff.bankName && <div><span className="text-slate-500">Bank: </span>{staff.bankName}</div>}
                        {staff.bankBranch && <div><span className="text-slate-500">Branch: </span>{staff.bankBranch}</div>}
                      </div>

                      {staffNotes.length > 0 && (
                        <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-3 mb-4">
                          <p className="text-purple-300 font-bold text-sm mb-2">📌 नोट्स:</p>
                          {staffNotes.slice(-3).reverse().map(note => (
                            <div key={note.id} className="bg-slate-700 px-3 py-2 rounded text-sm mb-1">
                              <span className="font-bold text-white">{note.type} </span>
                              <span className="text-slate-300">{note.text}</span>
                              <span className="text-xs text-slate-500 ml-2">{new Date(note.date).toLocaleDateString('en-IN')}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-slate-700 p-4 rounded-lg">
                          <p className="text-slate-300 text-xs font-bold mb-3">📅 आज की स्थिति</p>
                          {todayAtt ? (
                            <div className="space-y-2">
                              <p className="text-green-400 font-bold">✅ उपस्थित</p>
                              <div className="flex items-center gap-2 bg-green-900/30 rounded px-3 py-2">
                                <LogIn size={14} className="text-green-400" />
                                <span className="text-green-300 text-sm font-bold">Check-in: {todayAtt.checkInTime}</span>
                                {todayAtt.location?.distance != null && (
                                  <span className="text-emerald-400 text-xs ml-auto">📍 {todayAtt.location.distance}m</span>
                                )}
                              </div>
                              {todayAtt.checkOutTime ? (
                                <div className="flex items-center gap-2 bg-red-900/30 rounded px-3 py-2">
                                  <LogOut size={14} className="text-red-400" />
                                  <span className="text-red-300 text-sm font-bold">Check-out: {todayAtt.checkOutTime}</span>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleMarkAttendance(staff.id, 'check-out')}
                                  disabled={checkInLoading === staff.id}
                                  className="w-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2"
                                >
                                  {checkInLoading === staff.id ? (
                                    <>⏳ GPS verify कर रहे हैं...</>
                                  ) : (
                                    <><LogOut size={16} className="mr-2" /> 🔴 Check-out करें <MapPin size={12} className="ml-1" /></>
                                  )}
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-red-400 font-bold mb-2">❌ Check-in नहीं हुई</p>
                              <Button
                                onClick={() => handleMarkAttendance(staff.id, 'check-in')}
                                disabled={checkInLoading === staff.id || !shopSettings?.shopLat}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 text-sm disabled:opacity-50"
                              >
                                {checkInLoading === staff.id ? (
                                  <>⏳ GPS verify कर रहे हैं...</>
                                ) : !shopSettings?.shopLat ? (
                                  <>⚠️ Admin को पहले shop location set करनी होगी</>
                                ) : (
                                  <><LogIn size={16} className="mr-2" /> 🟢 Check-in करें <MapPin size={12} className="ml-1" /></>
                                )}
                              </Button>
                              {shopSettings?.shopLat && (
                                <p className="text-emerald-400 text-xs text-center">
                                  📍 GPS verify होगा · {shopSettings.allowedRadius}m radius
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="bg-slate-700 p-4 rounded-lg">
                          <p className="text-slate-300 text-xs font-bold mb-3">📊 इस महीने</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="bg-green-900/30 rounded p-2 text-center"><p className="text-green-400 font-bold text-lg">{details.presentDays || 0}</p><p className="text-slate-400 text-xs">उपस्थित</p></div>
                            <div className="bg-red-900/30 rounded p-2 text-center"><p className="text-red-400 font-bold text-lg">{details.absentDays || 0}</p><p className="text-slate-400 text-xs">अनुपस्थित</p></div>
                            <div className="bg-yellow-900/30 rounded p-2 text-center"><p className="text-yellow-400 font-bold text-lg">{details.sundays || 0}</p><p className="text-slate-400 text-xs">रविवार</p></div>
                            <div className="bg-orange-900/30 rounded p-2 text-center"><p className="text-orange-400 font-bold text-lg">{details.lateDays || 0}</p><p className="text-slate-400 text-xs">लेट</p></div>
                          </div>
                        </div>
                      </div>

                      {/* Salary */}
                      <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 p-4 rounded-lg mb-4 border border-purple-700">
                        <p className="text-white text-sm font-bold mb-3">💰 वेतन विवरण</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-3">
                          <div className="bg-slate-700/50 p-2 rounded text-center"><p className="text-slate-400 text-xs">Basic Salary</p><p className="text-white font-bold">₹{details.monthlySalary?.toLocaleString('en-IN')}</p></div>
                          <div className="bg-red-900/30 p-2 rounded text-center"><p className="text-slate-400 text-xs">कटौती</p><p className="text-red-400 font-bold">₹{parseFloat(details.totalDeduction || 0).toLocaleString('en-IN')}</p></div>
                          <div className="bg-yellow-900/30 p-2 rounded text-center"><p className="text-slate-400 text-xs">Incentive</p><p className="text-yellow-400 font-bold">+₹{(details.totalIncentive || 0).toLocaleString('en-IN')}</p></div>
                          <div className="bg-green-900/30 p-2 rounded text-center"><p className="text-slate-400 text-xs">Net Salary</p><p className="text-green-400 font-bold text-base">₹{parseFloat(details.netSalary || 0).toLocaleString('en-IN')}</p></div>
                        </div>
                        <div className="text-xs bg-slate-800/50 p-2 rounded space-y-0.5">
                          <p className="text-slate-300">📋 {details.deductionReason}</p>
                          {details.lateDays > 0 && (
                            <p className="text-orange-400">⚡ लेट penalty: {details.lateDays} दिन × ₹50 = <span className="font-bold">₹{(details.lateDays * 50).toLocaleString('en-IN')}</span>{details.lateDays > 5 ? ` + 1 दिन extra = ₹${Math.round(parseFloat(details.extraLateCut)).toLocaleString('en-IN')}` : ''}</p>
                          )}
                        </div>
                        {details.monthIncentives?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {details.monthIncentives.map((inc, i) => (
                              <div key={i} className="flex justify-between text-xs bg-slate-700 px-3 py-1.5 rounded">
                                <span className="text-slate-300">{inc.type === 'incentive' ? '⭐' : inc.type === 'insurance' ? '🛡️' : '🎁'} {inc.reason}</span>
                                <span className={`font-bold ${inc.type === 'insurance' ? 'text-blue-400' : 'text-yellow-400'}`}>{inc.type === 'insurance' ? '-' : '+'}₹{parseFloat(inc.amount).toLocaleString('en-IN')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Payment — Admin only */}
                      {isAdmin && (
                      <div className="bg-slate-700 p-4 rounded-lg mb-4">
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-white font-bold text-sm">💳 भुगतान</p>
                          <Button size="sm" onClick={() => { setSelectedStaffForPayment(staff.id); setShowPaymentForm(true); }} className="bg-blue-600 hover:bg-blue-700 text-xs"><Plus size={14} className="mr-1" />भुगतान जोड़ें</Button>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div><p className="text-slate-400 text-xs">दिया गया</p><p className="text-green-400 font-bold">₹{details.totalPayments?.toLocaleString('en-IN')}</p></div>
                          <div><p className="text-slate-400 text-xs">शेष</p><p className={`font-bold ${parseFloat(details.balance) > 0 ? 'text-orange-400' : 'text-green-400'}`}>₹{Math.abs(parseFloat(details.balance || 0)).toLocaleString('en-IN')}</p></div>
                          <div><p className="text-slate-400 text-xs">Status</p><p className={`font-bold ${parseFloat(details.balance) > 0 ? 'text-orange-400' : 'text-green-400'}`}>{parseFloat(details.balance) > 0 ? '⏳ बकाया' : '✅ Clear'}</p></div>
                        </div>
                        {details.payments?.length > 0 && (
                          <div className="mt-3 space-y-1">
                            {details.payments.slice(-3).map((p, i) => (
                              <div key={i} className="flex justify-between text-xs bg-slate-600 px-3 py-1 rounded">
                                <span className="text-slate-300">{p.description}</span>
                                <span className="text-green-400 font-bold">₹{p.amount.toLocaleString('en-IN')}</span>
                                <span className="text-slate-400">{new Date(p.date).toLocaleDateString('en-IN')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      )}

                      {/* Attendance History */}
                      <div className="bg-slate-700 p-4 rounded-lg">
                        <p className="text-white font-bold text-sm mb-3">📅 इस महीने की attendance</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {attendance.filter(a => { const d = new Date(a.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; }).reverse().map((rec, i) => (
                            <div key={i} className="flex justify-between items-center px-3 py-1.5 bg-slate-600 rounded text-xs">
                              <span className="text-slate-300">{new Date(rec.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' })}</span>
                              <div className="flex gap-3">
                                {rec.checkInTime && <span className="text-green-400">🟢 {rec.checkInTime}</span>}
                                {rec.checkOutTime && <span className="text-red-400">🔴 {rec.checkOutTime}</span>}
                              </div>
                            </div>
                          ))}
                          {attendance.filter(a => { const d = new Date(a.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; }).length === 0 && (
                            <p className="text-slate-400 text-center py-3 text-xs">कोई रिकॉर्ड नहीं</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* PAYMENT MODAL */}
        {showPaymentForm && isAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowPaymentForm(false)}>
            <Card className="bg-slate-800 border-slate-700 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
              <CardHeader className="bg-slate-700 py-3 px-4">
                <div className="flex justify-between">
                  <CardTitle className="text-white text-base">💳 भुगतान</CardTitle>
                  <Button size="sm" onClick={() => setShowPaymentForm(false)} className="bg-red-600 h-7 w-7 p-0">✖</Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div><label className="text-slate-300 text-xs mb-1 block">कर्मचारी</label>
                  <select value={selectedStaffForPayment || ''} onChange={e => setSelectedStaffForPayment(e.target.value)} className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md text-sm">
                    <option value="">चुनें</option>{staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select></div>
                <div><label className="text-slate-300 text-xs mb-1 block">राशि (₹)</label>
                  <Input type="number" value={paymentEntry.amount || ''} onChange={e => setPaymentEntry({ ...paymentEntry, amount: e.target.value })} className="bg-slate-700 text-white border-slate-600" /></div>
                <div><label className="text-slate-300 text-xs mb-1 block">विवरण</label>
                  <Input value={paymentEntry.description} onChange={e => setPaymentEntry({ ...paymentEntry, description: e.target.value })} className="bg-slate-700 text-white border-slate-600" /></div>
                <div><label className="text-slate-300 text-xs mb-1 block">दिनांक</label>
                  <Input type="date" value={paymentEntry.date} onChange={e => setPaymentEntry({ ...paymentEntry, date: e.target.value })} className="bg-slate-700 text-white border-slate-600" /></div>
                <div className="flex gap-2">
                  <Button onClick={handleAddPayment} className="flex-1 bg-green-600 hover:bg-green-700 font-bold">✅ जोड़ें</Button>
                  <Button onClick={() => setShowPaymentForm(false)} className="flex-1 bg-gray-600">✖️ रद्द</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* PAY SLIP MODAL */}
        {showPaySlipModal && (
          <Card className="bg-slate-800 border-slate-700 mb-4">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 py-3 px-4">
              <div className="flex justify-between">
                <CardTitle className="text-white text-base">📋 Pay Slip / Form 16</CardTitle>
                <Button size="sm" onClick={() => setShowPaySlipModal(false)} className="bg-red-600 h-7 w-7 p-0">✖</Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex gap-2">
                <Button onClick={() => setPaySlipType('monthly')} className={`flex-1 text-sm font-bold ${paySlipType === 'monthly' ? 'bg-green-600' : 'bg-slate-700 text-slate-300'}`}>📄 Salary Slip</Button>
                <Button onClick={() => setPaySlipType('form16')} className={`flex-1 text-sm font-bold ${paySlipType === 'form16' ? 'bg-green-600' : 'bg-slate-700 text-slate-300'}`}>📋 Form 16</Button>
              </div>

              {/* Employee selection — Admin: dropdown; Staff: fixed to own name */}
              <div>
                <label className="text-white text-sm font-bold mb-2 block">👤 कर्मचारी:</label>
                {isAdmin ? (
                  <select
                    value={selectedStaffPaySlip?.id || ''}
                    onChange={e => setSelectedStaffPaySlip(staffList.find(s => s.id == e.target.value))}
                    className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md text-sm"
                  >
                    <option value="">-- चुनें --</option>
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.position})</option>)}
                  </select>
                ) : (
                  // Staff sees only their own name — locked
                  <div className="w-full px-3 py-2 bg-slate-600 text-white border border-slate-500 rounded-md text-sm flex items-center gap-2">
                    <Lock size={14} className="text-slate-400 flex-shrink-0" />
                    <span className="font-bold">
                      {loggedInStaff
                        ? (() => {
                            const s = staffList.find(st => st.id === loggedInStaff.id);
                            if (s && selectedStaffPaySlip?.id !== s.id) {
                              setTimeout(() => setSelectedStaffPaySlip(s), 0);
                            }
                            return s ? s.name + ' (' + s.position + ')' : loggedInStaff.name;
                          })()
                        : '-- Login करें --'
                      }
                    </span>
                  </div>
                )}
              </div>

              {paySlipType === 'monthly' && (
                <div className="bg-slate-700 p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-slate-300 text-xs font-bold mb-1 block">महीना:</label>
                      <select value={selectedMonthPaySlip} onChange={e => setSelectedMonthPaySlip(parseInt(e.target.value))} className="w-full px-3 py-2 bg-slate-600 text-white border border-slate-500 rounded-md text-sm">
                        {MONTHS.map((mo, i) => <option key={i} value={i + 1}>{mo}</option>)}
                      </select></div>
                    <div><label className="text-slate-300 text-xs font-bold mb-1 block">साल:</label>
                      <select value={selectedYearPaySlip} onChange={e => setSelectedYearPaySlip(parseInt(e.target.value))} className="w-full px-3 py-2 bg-slate-600 text-white border border-slate-500 rounded-md text-sm">
                        {[2026, 2025, 2024, 2023].map(y => <option key={y} value={y}>{y}</option>)}
                      </select></div>
                  </div>

                  {/* DA/HRA/PF fields — ADMIN ONLY */}
                  {isAdmin && (
                    <div className="bg-slate-600/50 rounded-lg p-3 space-y-2">
                      <p className="text-slate-300 text-xs font-bold">➕ Optional: DA / HRA / Allowances (0 रहने पर PDF में नहीं दिखेगा)</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div><label className="text-slate-400 text-xs">DA (₹)</label>
                          <Input type="number" value={paySlipExtras.da||''} onChange={e=>setPaySlipExtras({...paySlipExtras,da:e.target.value})} placeholder="0" className="bg-slate-700 text-white border-slate-600 h-8 text-sm"/></div>
                        <div><label className="text-slate-400 text-xs">HRA (₹)</label>
                          <Input type="number" value={paySlipExtras.hra||''} onChange={e=>setPaySlipExtras({...paySlipExtras,hra:e.target.value})} placeholder="0" className="bg-slate-700 text-white border-slate-600 h-8 text-sm"/></div>
                        <div><label className="text-slate-400 text-xs">Other Allow. (₹)</label>
                          <Input type="number" value={paySlipExtras.otherAllowance||''} onChange={e=>setPaySlipExtras({...paySlipExtras,otherAllowance:e.target.value})} placeholder="0" className="bg-slate-700 text-white border-slate-600 h-8 text-sm"/></div>
                      </div>
                      <p className="text-slate-300 text-xs font-bold pt-1">➖ Optional: PF / ESI / TDS Deductions</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div><label className="text-slate-400 text-xs">PF (₹)</label>
                          <Input type="number" value={paySlipExtras.pf||''} onChange={e=>setPaySlipExtras({...paySlipExtras,pf:e.target.value})} placeholder="0" className="bg-slate-700 text-white border-slate-600 h-8 text-sm"/></div>
                        <div><label className="text-slate-400 text-xs">ESI (₹)</label>
                          <Input type="number" value={paySlipExtras.esi||''} onChange={e=>setPaySlipExtras({...paySlipExtras,esi:e.target.value})} placeholder="0" className="bg-slate-700 text-white border-slate-600 h-8 text-sm"/></div>
                        <div><label className="text-slate-400 text-xs">TDS (₹)</label>
                          <Input type="number" value={paySlipExtras.tds||''} onChange={e=>setPaySlipExtras({...paySlipExtras,tds:e.target.value})} placeholder="0" className="bg-slate-700 text-white border-slate-600 h-8 text-sm"/></div>
                        <div><label className="text-slate-400 text-xs">Other Ded. (₹)</label>
                          <Input type="number" value={paySlipExtras.otherDeduction||''} onChange={e=>setPaySlipExtras({...paySlipExtras,otherDeduction:e.target.value})} placeholder="0" className="bg-slate-700 text-white border-slate-600 h-8 text-sm"/></div>
                      </div>
                    </div>
                  )}

                  <Button onClick={downloadPaySlipPDF} className="w-full bg-green-600 hover:bg-green-700 font-bold">✅ Download Salary Slip (PDF)</Button>
                </div>
              )}
              {paySlipType === 'form16' && (
                <div className="bg-slate-700 p-4 rounded-lg space-y-3">
                  {/* Financial Year — Admin: editable; Staff: current year only */}
                  <div>
                    <label className="text-slate-300 text-xs font-bold mb-1 block">वित्त वर्ष:</label>
                    {isAdmin ? (
                      <select value={selectedYearPaySlip} onChange={e => setSelectedYearPaySlip(parseInt(e.target.value))} className="w-full px-3 py-2 bg-slate-600 text-white border border-slate-500 rounded-md text-sm">
                        {[2026, 2025, 2024, 2023].map(y => <option key={y} value={y}>{y}-{y + 1}</option>)}
                      </select>
                    ) : (
                      <div className="w-full px-3 py-2 bg-slate-600 text-white border border-slate-500 rounded-md text-sm flex items-center gap-2">
                        <Lock size={14} className="text-slate-400" />
                        <span>{selectedYearPaySlip}-{selectedYearPaySlip + 1}</span>
                      </div>
                    )}
                  </div>
                  <Button onClick={downloadForm16PDF} className="w-full bg-blue-600 hover:bg-blue-700 font-bold">✅ Download Form 16 (PDF)</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="text-center text-slate-600 text-xs pt-4 border-t border-slate-700">
          VP Honda Staff System © 2026 · Bhopal
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 🔗 SALARY SYSTEM LINK BANNER
// Shows linkage status between Staff Management and Salary Management
// Allows admin to auto-create salary entities for unlinked staff
// ════════════════════════════════════════════════════════════════════════════
function SalarySystemLinkBanner({ staffList, salaryEntities, onAutoLink }) {
  const navigate = useNavigate();

  // Calculate linkage stats
  const totalStaff = staffList.length;
  const linkedCount = staffList.filter(s => salaryEntities.find(e =>
    e.type === 'staff' && e.active &&
    String(e.name||'').trim().toLowerCase() === String(s.name||'').trim().toLowerCase()
  )).length;
  const unlinkedCount = totalStaff - linkedCount;
  const allLinked = totalStaff > 0 && unlinkedCount === 0;
  const hasEntities = salaryEntities.filter(e => e.type === 'staff').length > 0;
  const totalRentEntities = salaryEntities.filter(e => e.type === 'rent' && e.active).length;

  return (
    <div className={`rounded-xl border-2 overflow-hidden transition-all ${allLinked ? 'bg-gradient-to-r from-emerald-900/40 to-teal-900/40 border-emerald-600' : unlinkedCount > 0 ? 'bg-gradient-to-r from-orange-900/40 to-amber-900/40 border-orange-500' : 'bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border-blue-500'}`}>
      <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${allLinked ? 'bg-emerald-600' : unlinkedCount > 0 ? 'bg-orange-600' : 'bg-blue-600'}`}>
            <span className="text-xl">🔗</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${allLinked ? 'text-emerald-300' : unlinkedCount > 0 ? 'text-orange-300' : 'text-blue-300'}`}>
              {allLinked
                ? `✅ Salary Management से सब Linked (${linkedCount}/${totalStaff})`
                : unlinkedCount > 0
                  ? `⚠️ ${unlinkedCount} कर्मचारी Unlinked हैं — Auto-Link करें`
                  : '🔗 कोई कर्मचारी नहीं है'}
            </p>
            <p className="text-slate-400 text-xs mt-0.5">
              {hasEntities
                ? `Salary Mgmt में ${salaryEntities.filter(e => e.type === 'staff').length} staff entities + ${totalRentEntities} rentals · पेमेंट दोनों जगह से sync होगी`
                : 'अभी Salary Management में कोई entity नहीं है — Auto-Link दबाने पर बन जाएंगी'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {unlinkedCount > 0 && (
            <button
              onClick={onAutoLink}
              className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded transition"
            >
              🔗 Auto-Link ({unlinkedCount})
            </button>
          )}
          <button
            onClick={() => navigate('/salary-management')}
            className={`${allLinked ? 'bg-emerald-700 hover:bg-emerald-600' : 'bg-blue-700 hover:bg-blue-600'} text-white text-xs font-bold px-3 py-1.5 rounded transition flex items-center gap-1`}
          >
            💰 Open Salary & Rent →
          </button>
        </div>
      </div>

      {/* Detailed link status (collapsible info) */}
      {totalStaff > 0 && (
        <div className="border-t border-slate-700 px-4 py-2 bg-slate-900/40">
          <div className="flex flex-wrap gap-2 text-xs">
            {staffList.map(s => {
              const linked = salaryEntities.find(e =>
                e.type === 'staff' && e.active &&
                String(e.name||'').trim().toLowerCase() === String(s.name||'').trim().toLowerCase()
              );
              return (
                <span
                  key={s.id}
                  className={`px-2 py-0.5 rounded-full font-semibold ${linked ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700' : 'bg-orange-900/60 text-orange-300 border border-orange-700'}`}
                  title={linked ? `₹${(linked.monthlyAmount||0).toLocaleString('en-IN')}/month from Salary Mgmt` : 'Not linked - click Auto-Link'}
                >
                  {linked ? '🔗' : '⚠'} {s.name}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 📍 SHOP LOCATION BANNER COMPONENT
// Shows location status + allows admin to set/update shop GPS coordinates
// ════════════════════════════════════════════════════════════════════════════
function ShopLocationBanner({ isAdmin, shopSettings, onUpdate }) {
  const [showSettings, setShowSettings] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [saving, setSaving] = useState(false);

  // Next month 1st date helper (for rules activation default)
  const nextMonth1st = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    return d.toISOString().split('T')[0];
  };

  const [form, setForm] = useState({
    shopLat: shopSettings?.shopLat || '',
    shopLng: shopSettings?.shopLng || '',
    allowedRadius: shopSettings?.allowedRadius || 100,
    workStartTime: shopSettings?.workStartTime || '09:00',
    lateAfter: shopSettings?.lateAfter || '09:30',
    workEndTime: shopSettings?.workEndTime || '19:00',
    latePenalty: shopSettings?.latePenalty || 50,
    attendanceRulesStartDate: shopSettings?.attendanceRulesStartDate || '',
  });

  useEffect(() => {
    if (shopSettings) {
      setForm({
        shopLat: shopSettings.shopLat || '',
        shopLng: shopSettings.shopLng || '',
        allowedRadius: shopSettings.allowedRadius || 100,
        workStartTime: shopSettings.workStartTime || '09:00',
        lateAfter: shopSettings.lateAfter || '09:30',
        workEndTime: shopSettings.workEndTime || '19:00',
        latePenalty: shopSettings.latePenalty || 50,
        attendanceRulesStartDate: shopSettings.attendanceRulesStartDate || '',
      });
    }
  }, [shopSettings]);

  const captureMyLocation = async () => {
    if (!navigator.geolocation) { alert('Browser GPS support नहीं करता'); return; }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(prev => ({ ...prev, shopLat: pos.coords.latitude.toFixed(6), shopLng: pos.coords.longitude.toFixed(6) }));
        alert(`✅ Current location captured!\n\nLat: ${pos.coords.latitude.toFixed(6)}\nLng: ${pos.coords.longitude.toFixed(6)}\nAccuracy: ±${Math.round(pos.coords.accuracy)}m\n\n(बिलकुल शोरूम पर खड़े हों तभी यह button दबाएं)`);
        setGettingLocation(false);
      },
      (err) => { alert('❌ Location error: ' + err.message); setGettingLocation(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const saveSettings = async () => {
    if (!form.shopLat || !form.shopLng) { alert('Lat/Lng जरूरी है'); return; }
    setSaving(true);
    try {
      const res = await fetch(api('/api/attendance/shop/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopLat: parseFloat(form.shopLat),
          shopLng: parseFloat(form.shopLng),
          allowedRadius: parseInt(form.allowedRadius) || 100,
          workStartTime: form.workStartTime,
          lateAfter: form.lateAfter,
          workEndTime: form.workEndTime,
          latePenalty: parseInt(form.latePenalty) || 50,
          attendanceRulesStartDate: form.attendanceRulesStartDate || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate(updated);
        alert('✅ Shop settings saved!');
        setShowSettings(false);
      } else { alert('❌ Save failed'); }
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  const isConfigured = shopSettings?.shopLat && shopSettings?.shopLng;
  const rulesActivated = !!shopSettings?.attendanceRulesStartDate;
  const rulesStartFormatted = shopSettings?.attendanceRulesStartDate
    ? new Date(shopSettings.attendanceRulesStartDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
    : null;

  return (
    <div className="space-y-3">
      {/* ═══ GPS Location Banner ═══ */}
      <div className={`rounded-xl border-2 overflow-hidden transition-all ${isConfigured ? 'bg-gradient-to-r from-emerald-900/40 to-green-900/40 border-emerald-600' : 'bg-gradient-to-r from-red-900/40 to-orange-900/40 border-orange-500'}`}>
        <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isConfigured ? 'bg-emerald-600' : 'bg-orange-600'}`}>
              <MapPin size={20} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-bold ${isConfigured ? 'text-emerald-300' : 'text-orange-300'}`}>
                {isConfigured ? '📍 GPS Check-in Active' : '⚠️ Shop Location Not Set'}
              </p>
              <p className="text-slate-400 text-xs mt-0.5">
                {isConfigured
                  ? `कर्मचारी सिर्फ ${shopSettings.allowedRadius}m के अंदर check-in कर सकते हैं · ${shopSettings.shopLat?.toFixed(5)}, ${shopSettings.shopLng?.toFixed(5)}`
                  : 'Admin को location set करनी होगी ताकि कर्मचारी check-in कर सकें'}
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button
              onClick={() => setShowSettings(!showSettings)}
              className={`${isConfigured ? 'bg-emerald-700 hover:bg-emerald-600' : 'bg-orange-600 hover:bg-orange-500'} text-white text-xs font-bold px-3 py-1.5 h-auto`}
            >
              {showSettings ? '✖️ Close' : isConfigured ? '⚙️ Edit' : '📍 Set Location'}
            </Button>
          )}
        </div>

        {showSettings && isAdmin && (
          <div className="border-t border-slate-700 p-4 bg-slate-900/60 space-y-4">
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 text-xs text-blue-200">
              💡 <b>टिप:</b> शोरूम पर खड़े होकर "📍 Current Location Capture करें" button दबाएं। यह आपकी exact GPS coordinates ले लेगा।
            </div>

            {/* Location Settings */}
            <div>
              <h4 className="text-white font-bold text-sm mb-3 flex items-center gap-2">📍 Shop Location</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <Button onClick={captureMyLocation} disabled={gettingLocation}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5">
                    {gettingLocation ? '⏳ GPS ले रहे हैं...' : '📍 Current Location Capture करें'}
                  </Button>
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Shop Latitude</label>
                  <Input type="number" step="any" value={form.shopLat} onChange={e => setForm({...form, shopLat: e.target.value})}
                    className="bg-slate-700 text-white border-slate-600" placeholder="23.2599" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Shop Longitude</label>
                  <Input type="number" step="any" value={form.shopLng} onChange={e => setForm({...form, shopLng: e.target.value})}
                    className="bg-slate-700 text-white border-slate-600" placeholder="77.4126" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Allowed Radius (meters)</label>
                  <Input type="number" value={form.allowedRadius} onChange={e => setForm({...form, allowedRadius: e.target.value})}
                    className="bg-slate-700 text-white border-slate-600" placeholder="100" />
                  <p className="text-slate-500 text-xs mt-1">कर्मचारी इतने meter के अंदर check-in कर सकते हैं</p>
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-700" />

            {/* Work Hours */}
            <div>
              <h4 className="text-white font-bold text-sm mb-3 flex items-center gap-2">⏰ Work Hours</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Work Start Time</label>
                  <Input type="time" value={form.workStartTime} onChange={e => setForm({...form, workStartTime: e.target.value})}
                    className="bg-slate-700 text-white border-slate-600" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Late After</label>
                  <Input type="time" value={form.lateAfter} onChange={e => setForm({...form, lateAfter: e.target.value})}
                    className="bg-slate-700 text-white border-slate-600" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Work End Time</label>
                  <Input type="time" value={form.workEndTime} onChange={e => setForm({...form, workEndTime: e.target.value})}
                    className="bg-slate-700 text-white border-slate-600" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Late Penalty (₹/day)</label>
                  <Input type="number" value={form.latePenalty} onChange={e => setForm({...form, latePenalty: e.target.value})}
                    className="bg-slate-700 text-white border-slate-600" />
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-700" />

            {/* ⭐ NEW: Attendance Rules Activation */}
            <div>
              <h4 className="text-white font-bold text-sm mb-2 flex items-center gap-2">📅 Salary Rules Activation Date</h4>
              <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 text-xs text-yellow-200 mb-3">
                <b>⚠️ जरूरी:</b> इस date से पहले के महीने <b>Grace Period</b> में होंगे — कोई salary deduction नहीं होगी।
                <br/>इस date से जो महीने शुरू होंगे उनमें पूरे नियम लागू होंगे।
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Rules लागू होने की date</label>
                  <Input type="date" value={form.attendanceRulesStartDate}
                    onChange={e => setForm({...form, attendanceRulesStartDate: e.target.value})}
                    className="bg-slate-700 text-white border-slate-600" />
                  <p className="text-slate-500 text-xs mt-1">Recommended: next month की 1 तारीख</p>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => setForm({...form, attendanceRulesStartDate: nextMonth1st()})}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                  >
                    📅 Next Month से लागू करें
                  </Button>
                </div>
              </div>
              {form.attendanceRulesStartDate && (
                <div className="mt-2 bg-emerald-900/30 border border-emerald-700 rounded p-2 text-xs text-emerald-300">
                  ✅ {new Date(form.attendanceRulesStartDate).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })} से rules लागू होंगे
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={saveSettings} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white font-bold flex-1">
                {saving ? '⏳ Saving...' : '💾 Save Settings'}
              </Button>
              <Button onClick={() => setShowSettings(false)} className="bg-gray-600 hover:bg-gray-700 text-white">
                Cancel
              </Button>
            </div>

            {form.shopLat && form.shopLng && (
              <div className="mt-2">
                <a
                  href={`https://www.google.com/maps?q=${form.shopLat},${form.shopLng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-block text-blue-400 text-xs underline"
                >
                  🗺️ Google Maps में देखें: {form.shopLat}, {form.shopLng}
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Salary Rules Status Banner ═══ */}
      <div className={`rounded-xl border-2 px-4 py-3 flex items-center justify-between flex-wrap gap-2 ${rulesActivated ? 'bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border-indigo-600' : 'bg-gradient-to-r from-slate-800 to-slate-900 border-slate-600'}`}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${rulesActivated ? 'bg-indigo-600' : 'bg-slate-600'}`}>
            <span className="text-xl">📅</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${rulesActivated ? 'text-indigo-300' : 'text-slate-300'}`}>
              {rulesActivated ? `📋 Salary Rules Active from ${rulesStartFormatted}` : '🕊️ Grace Period — No Rules Active Yet'}
            </p>
            <p className="text-slate-400 text-xs mt-0.5">
              {rulesActivated
                ? `इस date से पहले के महीने में कोई deduction नहीं। Sundays = paid off · Absent days = per-day deduction`
                : 'Admin को activation date set करनी होगी। तब तक किसी भी महीने में salary कटौती नहीं होगी।'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}