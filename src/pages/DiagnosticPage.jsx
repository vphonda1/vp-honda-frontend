// ════════════════════════════════════════════════════════════════════════════
// DiagnosticPage.jsx — VP Honda Smart System Diagnostic
// ════════════════════════════════════════════════════════════════════════════
// Real-time system health check covering:
// • Customer DB ↔ Service Data sync
// • Invoice ↔ Customer link integrity
// • Parts inventory (low stock, out of stock)
// • Pending payments overview
// • Pending insurance/RTO follow-ups
// • Reminder generation health
// • Cross-device sync status
// • Localstorage size and orphan keys
// • Auto-fix actions for each category
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RefreshCw, ArrowLeft, AlertTriangle, CheckCircle, XCircle, AlertCircle,
  Activity, Database, Package, CreditCard, FileWarning, Trash2, Zap,
  Search, Eye, Wrench, ChevronDown, ChevronUp, Server, Wifi, WifiOff
} from 'lucide-react';
import { api } from '../utils/apiConfig';

const getLS = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };

// ── HEALTH SECTIONS ─────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'sync',      label: '🔄 Cross-Device Sync',      color: '#3b82f6' },
  { id: 'data',      label: '📊 Customer Service Data',   color: '#a855f7' },
  { id: 'invoice',   label: '📁 Invoice Integrity',       color: '#ea580c' },
  { id: 'parts',     label: '📦 Parts Inventory',         color: '#0891b2' },
  { id: 'payment',   label: '💳 Pending Payments',        color: '#facc15' },
  { id: 'reminder',  label: '🔔 Reminder Generation',     color: '#22c55e' },
  { id: 'storage',   label: '💾 LocalStorage Health',     color: '#94a3b8' },
];

export default function DiagnosticPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [report, setReport] = useState(null);
  const [activeSection, setActiveSection] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [msg, setMsg] = useState('');
  const [serverOnline, setServerOnline] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const intervalRef = useRef(null);

  useEffect(() => {
    runDiagnostic();
    intervalRef.current = setInterval(runDiagnostic, 30000); // 30s refresh
    return () => clearInterval(intervalRef.current);
  }, []);

  // ── MAIN DIAGNOSTIC ────────────────────────────────────────────────────────
  const runDiagnostic = async () => {
    setRefreshing(true);
    const r = {
      timestamp: new Date(),
      sync:     { status: 'checking', items: [], score: 0, max: 100 },
      data:     { status: 'checking', items: [], score: 0, max: 100 },
      invoice:  { status: 'checking', items: [], score: 0, max: 100 },
      parts:    { status: 'checking', items: [], score: 0, max: 100 },
      payment:  { status: 'checking', items: [], score: 0, max: 100 },
      reminder: { status: 'checking', items: [], score: 0, max: 100 },
      storage:  { status: 'checking', items: [], score: 0, max: 100 },
    };

    // ── 1. CROSS-DEVICE SYNC ─────────────────────────────────────────────────
    let dbCustomers = [], dbInvoices = [], dbParts = [], dbServiceData = [], dbFollowUps = [];
    let online = false;
    try {
      const t0 = Date.now();
      const res = await fetch(api('/api/customers'));
      online = res.ok;
      setServerOnline(online);
      const latency = Date.now() - t0;
      r.sync.items.push({
        kind: online ? 'ok' : 'error',
        title: online ? `✅ Backend Online (${latency}ms)` : '❌ Backend Offline',
        detail: online ? 'MongoDB connected, sync working' : 'Backend reachable नहीं — सिर्फ localStorage मोड में चल रहा है',
        action: online ? null : { label: 'Retry', fn: runDiagnostic },
      });
      if (online) dbCustomers = await res.json();
    } catch {
      online = false;
      setServerOnline(false);
      r.sync.items.push({ kind: 'error', title: '❌ Backend Offline', detail: 'Cannot reach API server' });
    }

    if (online) {
      try { dbInvoices    = await (await fetch(api('/api/invoices'))).json(); } catch {}
      try { dbParts       = await (await fetch(api('/api/parts'))).json(); } catch {}
      try { dbServiceData = await (await fetch(api('/api/service-data'))).json(); } catch {}
      try { dbFollowUps   = await (await fetch(api('/api/follow-ups'))).json(); } catch {}

      // ⭐ NEW: Check salary system
      let dbSalaryEntities = [], dbSalaries = [], dbAttendance = [], shopSettings = null;
      try { dbSalaryEntities = await (await fetch(api('/api/salary-entities'))).json(); } catch {}
      try { dbSalaries       = await (await fetch(api('/api/salaries'))).json(); } catch {}
      try { dbAttendance     = await (await fetch(api('/api/attendance'))).json(); } catch {}
      try { shopSettings     = await (await fetch(api('/api/attendance/shop/settings'))).json(); } catch {}

      // Salary entities health
      const activeStaff = dbSalaryEntities.filter(e => e.type === 'staff' && e.active).length;
      const activeRent  = dbSalaryEntities.filter(e => e.type === 'rent' && e.active).length;
      r.sync.items.push({
        kind: dbSalaryEntities.length > 0 ? 'ok' : 'warning',
        title: dbSalaryEntities.length > 0
          ? `✅ Salary System: ${dbSalaryEntities.length} entities (${activeStaff} staff + ${activeRent} rent)`
          : '⚠️ Salary System Empty',
        detail: dbSalaryEntities.length > 0
          ? `${dbSalaries.length} payments recorded`
          : 'Salary Management में जा कर "Import from Excel" करें',
        action: dbSalaryEntities.length === 0 ? { label: 'Setup Salary', fn: () => window.location.href = '/salary-management' } : null,
      });

      // GPS Shop location
      r.sync.items.push({
        kind: shopSettings?.shopLat ? 'ok' : 'warning',
        title: shopSettings?.shopLat
          ? `✅ GPS Check-in Configured (${shopSettings.allowedRadius}m radius)`
          : '⚠️ Shop GPS Location Not Set',
        detail: shopSettings?.shopLat
          ? `Lat: ${shopSettings.shopLat?.toFixed(4)}, Lng: ${shopSettings.shopLng?.toFixed(4)}`
          : 'कर्मचारी GPS check-in नहीं कर पाएंगे — Staff Management में set करें',
        action: !shopSettings?.shopLat ? { label: 'Setup GPS', fn: () => window.location.href = '/staff-management' } : null,
      });

      // Attendance Rules
      r.sync.items.push({
        kind: shopSettings?.attendanceRulesStartDate ? 'ok' : 'info',
        title: shopSettings?.attendanceRulesStartDate
          ? `📋 Salary Rules Active from ${new Date(shopSettings.attendanceRulesStartDate).toLocaleDateString('en-IN', { month:'short', year:'numeric' })}`
          : '🕊️ Salary Rules in Grace Period',
        detail: shopSettings?.attendanceRulesStartDate
          ? `${dbAttendance.length} total attendance records`
          : 'पुराने महीनों में कोई कटौती नहीं — Staff Mgmt में activation date set करें',
      });
    }

    const lsCustomers   = [...getLS('sharedCustomerData',[]), ...getLS('customerData',[])];
    const lsInvoices    = [...getLS('invoices',[]), ...getLS('generatedInvoices',[])];
    const lsServiceData = getLS('customerServiceData', {});
    const lsFollowUps   = getLS('followUpLog', {});

    if (online) {
      // Compare counts
      if (lsCustomers.length !== dbCustomers.length) {
        r.sync.items.push({
          kind: 'warning',
          title: `⚠️ Customer count mismatch`,
          detail: `MongoDB: ${dbCustomers.length} | localStorage: ${lsCustomers.length} — ${Math.abs(dbCustomers.length - lsCustomers.length)} difference`,
        });
      } else {
        r.sync.items.push({ kind: 'ok', title: `✅ Customer sync OK`, detail: `${dbCustomers.length} customers in both stores` });
      }

      if (Math.abs(lsInvoices.length - dbInvoices.length) > 5) {
        r.sync.items.push({ kind: 'warning', title: `⚠️ Invoice count mismatch`, detail: `MongoDB: ${dbInvoices.length} | localStorage: ${lsInvoices.length}` });
      } else {
        r.sync.items.push({ kind: 'ok', title: `✅ Invoice sync OK`, detail: `${dbInvoices.length} invoices` });
      }

      const lsSDCount = Object.keys(lsServiceData).length;
      r.sync.items.push({
        kind: 'info',
        title: `🔄 Service Data: ${dbServiceData.length} (DB) | ${lsSDCount} (Local)`,
        detail: `Cross-device में change यहाँ reflect होगा`,
      });

      r.sync.score = r.sync.items.filter(i => i.kind === 'ok').length * 30 + 10;
    } else {
      r.sync.score = 0;
    }
    r.sync.status = online ? (r.sync.items.some(i => i.kind === 'warning') ? 'warning' : 'healthy') : 'critical';

    // ── 2. CUSTOMER SERVICE DATA HEALTH ──────────────────────────────────────
    const allCustomers = online ? dbCustomers : lsCustomers;
    const deletedKeys = new Set(getLS('deletedServiceKeys', []));

    let withData = 0, withoutData = 0, orphans = [];
    allCustomers.forEach(c => {
      const reg = (c.linkedVehicle?.regNo || c.regNo || c.registrationNo || '').toUpperCase();
      const sd = lsServiceData[c._id] || (reg && lsServiceData[reg]) || null;
      if (sd && Object.keys(sd).length > 0) withData++;
      else withoutData++;
    });

    // Find orphan service data entries (no matching customer)
    Object.entries(lsServiceData).forEach(([key, data]) => {
      if (deletedKeys.has(key)) return;
      const matchById  = allCustomers.find(c => c._id === key);
      const matchByReg = allCustomers.find(c => (c.linkedVehicle?.regNo || c.regNo || c.registrationNo || '').toUpperCase() === key.toUpperCase());
      const matchByPhone = data.phone && allCustomers.find(c => c.phone === data.phone);
      if (!matchById && !matchByReg && !matchByPhone) {
        orphans.push({ key, data, hasUseful: !!(data.purchaseDate || data.firstServiceDate || data.pendingAmount) });
      }
    });

    r.data.items.push({ kind: 'info', title: `Total Customers: ${allCustomers.length}`, detail: `With service data: ${withData} | Without: ${withoutData}` });
    if (orphans.length > 0) {
      r.data.items.push({
        kind: 'warning',
        title: `⚠️ ${orphans.length} orphan service entries`,
        detail: `Service data exists but कोई customer match नहीं — Auto-Fix से safely delete हो सकते हैं`,
        action: { label: '🔧 Auto-Fix Orphans', fn: () => autoFixOrphans(orphans, deletedKeys) },
        items: orphans.slice(0, 10).map(o => ({ name: o.data.customerName || o.key, detail: `${o.data.phone || '—'} ${o.hasUseful ? '⚠️ has data' : '(empty)'}` })),
      });
    } else {
      r.data.items.push({ kind: 'ok', title: '✅ No orphan service entries', detail: 'सभी service data customers से linked' });
    }

    if (deletedKeys.size > 0) {
      r.data.items.push({
        kind: 'info',
        title: `🚫 Blacklist: ${deletedKeys.size} entries`,
        detail: 'पहले delete किए गए entries — invoice import से वापस नहीं बनेंगे',
        action: { label: 'Reset Blacklist', fn: resetBlacklist },
      });
    }

    r.data.score = orphans.length === 0 ? 100 : Math.max(20, 100 - orphans.length * 2);
    r.data.status = orphans.length === 0 ? 'healthy' : (orphans.length > 50 ? 'critical' : 'warning');

    // ── 3. INVOICE INTEGRITY ─────────────────────────────────────────────────
    const allInvoices = online ? dbInvoices : lsInvoices;
    let invNoCustomer = 0, invNoRegNo = 0, invNoDate = 0, invDuplicates = [];
    const invByNumber = {};
    allInvoices.forEach(inv => {
      if (!inv.customerId && !inv.customerPhone && !inv.customerName) invNoCustomer++;
      if (!inv.regNo) invNoRegNo++;
      if (!inv.invoiceDate) invNoDate++;
      const key = inv.invoiceNumber || inv.invoiceNo;
      if (key) {
        if (invByNumber[key]) invDuplicates.push(key);
        invByNumber[key] = (invByNumber[key] || 0) + 1;
      }
    });

    r.invoice.items.push({ kind: 'info', title: `Total Invoices: ${allInvoices.length}`, detail: 'सभी sources combined' });
    if (invNoCustomer > 0) r.invoice.items.push({ kind: 'warning', title: `⚠️ ${invNoCustomer} invoices without customer info`, detail: 'न customerId, न phone, न name' });
    if (invNoRegNo > 0)    r.invoice.items.push({ kind: 'warning', title: `⚠️ ${invNoRegNo} invoices without regNo`, detail: 'Service reminders के लिए regNo जरूरी है' });
    if (invNoDate > 0)     r.invoice.items.push({ kind: 'warning', title: `⚠️ ${invNoDate} invoices without invoice date`, detail: 'Date के बिना service timeline detect नहीं होगा' });
    if (invDuplicates.length > 0) r.invoice.items.push({ kind: 'error', title: `❌ ${invDuplicates.length} duplicate invoice numbers`, detail: `Examples: ${invDuplicates.slice(0,3).join(', ')}` });
    if (invNoCustomer === 0 && invNoRegNo === 0 && invNoDate === 0 && invDuplicates.length === 0) {
      r.invoice.items.push({ kind: 'ok', title: '✅ All invoices have complete data' });
    }

    const invIssues = invNoCustomer + invNoRegNo + invNoDate + invDuplicates.length;
    r.invoice.score = invIssues === 0 ? 100 : Math.max(20, 100 - Math.min(80, invIssues));
    r.invoice.status = invIssues === 0 ? 'healthy' : (invDuplicates.length > 0 ? 'critical' : 'warning');

    // ── 4. PARTS INVENTORY ───────────────────────────────────────────────────
    const allParts = online ? dbParts : getLS('parts', []);
    const outOfStock = allParts.filter(p => Number(p.stock || p.quantity || 0) <= 0);
    const lowStock = allParts.filter(p => {
      const s = Number(p.stock || p.quantity || 0);
      const m = Number(p.minStock || 0);
      return m > 0 && s > 0 && s <= m;
    });

    r.parts.items.push({ kind: 'info', title: `Total Parts: ${allParts.length}`, detail: `Categories tracked` });
    if (outOfStock.length > 0) {
      r.parts.items.push({
        kind: 'error',
        title: `🚨 ${outOfStock.length} parts OUT OF STOCK`,
        detail: 'तुरंत reorder करें',
        items: outOfStock.slice(0, 10).map(p => ({ name: p.partName, detail: `${p.partNumber || ''} | Min: ${p.minStock || 0}` })),
        action: { label: 'View Parts', fn: () => navigate('/parts') },
      });
    }
    if (lowStock.length > 0) {
      r.parts.items.push({
        kind: 'warning',
        title: `⚠️ ${lowStock.length} parts running LOW`,
        detail: 'Min stock से कम बचा है',
        items: lowStock.slice(0, 10).map(p => ({ name: p.partName, detail: `Stock: ${p.stock || p.quantity || 0} (Min: ${p.minStock})` })),
      });
    }
    if (outOfStock.length === 0 && lowStock.length === 0) {
      r.parts.items.push({ kind: 'ok', title: '✅ All parts adequately stocked' });
    }

    r.parts.score = outOfStock.length === 0 && lowStock.length === 0 ? 100 :
                    outOfStock.length === 0 ? Math.max(50, 100 - lowStock.length * 5) :
                    Math.max(20, 50 - outOfStock.length * 5);
    r.parts.status = outOfStock.length > 0 ? 'critical' : (lowStock.length > 0 ? 'warning' : 'healthy');

    // ── 5. PENDING PAYMENTS ──────────────────────────────────────────────────
    const today = new Date(); today.setHours(0,0,0,0);
    let pendingPayments = [], overduePayments = [], totalPending = 0;
    Object.entries(lsServiceData).forEach(([reg, d]) => {
      const amt = parseFloat(d.pendingAmount || 0);
      if (amt > 0 && !d.paymentReceivedDate) {
        totalPending += amt;
        const dueDate = d.paymentDueDate ? new Date(d.paymentDueDate) : null;
        const isOverdue = dueDate && dueDate < today;
        const item = { name: d.customerName || reg, detail: `₹${amt.toLocaleString('en-IN')} | Due: ${d.paymentDueDate || '—'}`, regNo: reg };
        if (isOverdue) overduePayments.push(item);
        else pendingPayments.push(item);
      }
    });

    r.payment.items.push({ kind: 'info', title: `💰 Total Pending: ₹${totalPending.toLocaleString('en-IN')}`, detail: `${pendingPayments.length + overduePayments.length} customers` });
    if (overduePayments.length > 0) {
      r.payment.items.push({
        kind: 'error',
        title: `🚨 ${overduePayments.length} OVERDUE payments`,
        detail: 'तुरंत follow-up करें',
        items: overduePayments.slice(0, 10),
        action: { label: 'Open Reminders', fn: () => navigate('/reminders') },
      });
    }
    if (pendingPayments.length > 0) {
      r.payment.items.push({
        kind: 'warning',
        title: `⏳ ${pendingPayments.length} pending payments`,
        detail: 'Due date से पहले',
        items: pendingPayments.slice(0, 10),
      });
    }
    if (totalPending === 0) r.payment.items.push({ kind: 'ok', title: '✅ No pending payments' });

    r.payment.score = totalPending === 0 ? 100 : (overduePayments.length === 0 ? 70 : Math.max(20, 70 - overduePayments.length * 3));
    r.payment.status = overduePayments.length > 0 ? 'critical' : (pendingPayments.length > 0 ? 'warning' : 'healthy');

    // ── 6. REMINDER GENERATION ───────────────────────────────────────────────
    let purchaseDateMissing = 0, serviceDataMissing = 0, totalReminderable = 0;
    Object.entries(lsServiceData).forEach(([reg, d]) => {
      if (d.purchaseDate || d.firstServiceDate || d.pendingAmount > 0 || d.insuranceDate) totalReminderable++;
      if (!d.purchaseDate && !d.firstServiceDate) purchaseDateMissing++;
    });

    const totalCustWithoutData = allCustomers.length - withData;
    if (totalCustWithoutData > 0) {
      r.reminder.items.push({
        kind: 'warning',
        title: `⚠️ ${totalCustWithoutData} customers से कोई reminder नहीं बन सकता`,
        detail: 'Service data, purchase date, या pending amount नहीं भरा',
        action: { label: 'Open Data Manager', fn: () => navigate('/customer-data-manager') },
      });
    }
    r.reminder.items.push({ kind: 'info', title: `🔔 ${totalReminderable} customers से reminders बन सकते हैं`, detail: 'Service / Payment / Insurance combined' });

    r.reminder.score = allCustomers.length > 0 ? Math.round((withData / allCustomers.length) * 100) : 100;
    r.reminder.status = r.reminder.score > 80 ? 'healthy' : r.reminder.score > 50 ? 'warning' : 'critical';

    // ── 7. LOCALSTORAGE HEALTH ───────────────────────────────────────────────
    let totalSize = 0;
    const keyDetails = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k) || '';
      const sz = (k.length + v.length) * 2; // UTF-16
      totalSize += sz;
      keyDetails.push({ key: k, size: sz });
    }
    keyDetails.sort((a,b) => b.size - a.size);
    const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
    const limit = 5; // typical browser limit
    const usagePct = Math.round((totalSize / 1024 / 1024 / limit) * 100);

    r.storage.items.push({
      kind: usagePct > 80 ? 'error' : usagePct > 50 ? 'warning' : 'ok',
      title: `💾 LocalStorage: ${sizeMB} MB (${usagePct}% of ${limit}MB limit)`,
      detail: `${keyDetails.length} keys`,
      items: keyDetails.slice(0, 8).map(k => ({ name: k.key, detail: `${(k.size/1024).toFixed(1)} KB` })),
    });

    r.storage.score = Math.max(0, 100 - usagePct);
    r.storage.status = usagePct > 80 ? 'critical' : usagePct > 50 ? 'warning' : 'healthy';

    // ── OVERALL ──────────────────────────────────────────────────────────────
    const overall = Math.round((r.sync.score + r.data.score + r.invoice.score + r.parts.score + r.payment.score + r.reminder.score + r.storage.score) / 7);
    r.overall = overall;
    r.overallStatus = overall > 85 ? 'healthy' : overall > 60 ? 'warning' : 'critical';

    setReport(r);
    setLastRefresh(new Date());
    setLoading(false);
    setRefreshing(false);
  };

  // ── ACTIONS ──────────────────────────────────────────────────────────────
  const autoFixOrphans = async (orphans, deletedKeys) => {
    const empty = orphans.filter(o => !o.hasUseful);
    if (!window.confirm(`🔧 Auto-Fix:\n\n✅ DELETE: ${empty.length} empty orphan entries\n⚠️ KEEP: ${orphans.length - empty.length} entries with data\n\nContinue?`)) return;
    const svc = getLS('customerServiceData', {});
    const blacklist = new Set(deletedKeys);
    for (const o of empty) {
      delete svc[o.key];
      blacklist.add(o.key);
      try { await fetch(api(`/api/service-data/${o.key}`), { method: 'DELETE' }).catch(() => {}); } catch {}
    }
    localStorage.setItem('customerServiceData', JSON.stringify(svc));
    localStorage.setItem('deletedServiceKeys', JSON.stringify([...blacklist]));
    window.dispatchEvent(new Event('storage'));
    setMsg(`✅ ${empty.length} orphan entries deleted permanently`);
    setTimeout(() => setMsg(''), 4000);
    runDiagnostic();
  };

  const resetBlacklist = () => {
    if (!window.confirm('Blacklist reset करें?\nDeleted entries वापस आ सकते हैं invoices से।')) return;
    localStorage.removeItem('deletedServiceKeys');
    setMsg('✅ Blacklist reset');
    setTimeout(() => setMsg(''), 3000);
    runDiagnostic();
  };

  const fullCacheClear = () => {
    const pwd = prompt('Admin password:');
    if (pwd !== 'vphonda@123') { alert('❌ Wrong password!'); return; }
    if (!window.confirm('⚠️ पूरा localStorage cache clear होगा!\nMongoDB data unaffected रहेगा।\nContinue?')) return;
    const keepKeys = ['vpHondaUser', 'vpSession', 'vpAdminSession', 'deletedServiceKeys'];
    Object.keys(localStorage).forEach(k => { if (!keepKeys.includes(k)) localStorage.removeItem(k); });
    setMsg('✅ Cache cleared! Reloading...');
    setTimeout(() => window.location.reload(), 1500);
  };

  const toggleExpand = (id) => {
    const s = new Set(expandedItems);
    if (s.has(id)) s.delete(id); else s.add(id);
    setExpandedItems(s);
  };

  // ── RENDER HELPERS ──────────────────────────────────────────────────────
  const statusColor = (status) => ({
    healthy:  { bg: '#22c55e', text: 'Healthy',   icon: CheckCircle },
    warning:  { bg: '#facc15', text: 'Warning',   icon: AlertTriangle },
    critical: { bg: '#ef4444', text: 'Critical',  icon: XCircle },
    checking: { bg: '#94a3b8', text: 'Checking…', icon: Activity },
  }[status] || { bg: '#94a3b8', text: '—', icon: AlertCircle });

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
      <div className="text-center">
        <Activity className="animate-spin mx-auto mb-3" size={48} />
        <p>Running system diagnostic...</p>
      </div>
    </div>
  );

  const sectionsToShow = activeSection === 'all' ? SECTIONS : SECTIONS.filter(s => s.id === activeSection);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <Button onClick={() => navigate('/reminders')} className="bg-red-700 hover:bg-red-600 text-white">
            <ArrowLeft size={16} className="mr-1" /> Back
          </Button>
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center justify-center gap-2">
              <Activity size={28} className="text-cyan-400" /> System Diagnostic
            </h1>
            <p className="text-slate-400 text-xs flex items-center justify-center gap-1 mt-1">
              {serverOnline ? <Wifi size={11} className="text-green-400" /> : <WifiOff size={11} className="text-red-400" />}
              {serverOnline ? 'Backend Online' : 'Backend Offline'} · Last check: {lastRefresh.toLocaleTimeString('en-IN')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={runDiagnostic} disabled={refreshing} className="bg-blue-600 hover:bg-blue-700 text-white">
              <RefreshCw size={16} className={`mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {msg && (
          <div className="bg-green-600/20 border border-green-500 text-green-300 rounded-xl p-3 mb-4 font-bold text-sm">
            {msg}
          </div>
        )}

        {/* OVERALL HEALTH SCORE */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-5 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">System Health Score</p>
              <div className="flex items-baseline gap-2 mt-1">
                <h2 className="text-5xl font-black" style={{ color: statusColor(report?.overallStatus).bg }}>
                  {report?.overall || 0}%
                </h2>
                <span className="text-lg font-bold" style={{ color: statusColor(report?.overallStatus).bg }}>
                  {statusColor(report?.overallStatus).text}
                </span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={fullCacheClear} className="bg-orange-600 hover:bg-orange-500 text-white text-xs">
                🧹 Full Cache Clear
              </Button>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full transition-all duration-500" style={{
              width: `${report?.overall || 0}%`,
              background: `linear-gradient(90deg, #ef4444, #facc15, #22c55e)`,
            }} />
          </div>
        </div>

        {/* SECTION CARDS — clickable filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
          <button onClick={() => setActiveSection('all')}
            className={`p-3 rounded-xl border-2 text-xs font-bold transition ${
              activeSection === 'all' ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}>
            All Sections
          </button>
          {SECTIONS.map(s => {
            const sec = report?.[s.id];
            const sc = statusColor(sec?.status);
            return (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className={`p-2 rounded-xl border-2 text-xs font-bold transition ${
                  activeSection === s.id ? 'bg-slate-700 border-white text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}>
                <div className="text-[10px]">{s.label}</div>
                <div className="text-base mt-1" style={{ color: sc.bg }}>{sec?.score || 0}%</div>
              </button>
            );
          })}
        </div>

        {/* DETAIL SECTIONS */}
        <div className="space-y-4">
          {sectionsToShow.map(s => {
            const sec = report?.[s.id];
            if (!sec) return null;
            const sc = statusColor(sec.status);
            const SCIcon = sc.icon;
            return (
              <div key={s.id} style={{ background: 'rgba(0,0,0,0.3)', border: `2px solid ${s.color}40`, borderRadius: '16px', overflow: 'hidden' }}>
                <div style={{ background: `linear-gradient(135deg, ${s.color}33, ${s.color}11)`, padding: '14px 18px', borderBottom: `1px solid ${s.color}40` }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-base flex items-center gap-2">
                      {s.label}
                      <span className="text-xs font-normal" style={{ color: sc.bg }}>
                        ({sec.score}%) <SCIcon size={14} className="inline" />
                      </span>
                    </h3>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {sec.items.map((item, idx) => {
                    const itemId = `${s.id}-${idx}`;
                    const isExpanded = expandedItems.has(itemId);
                    const colors = {
                      ok:      { bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.3)',  text: '#86efac' },
                      warning: { bg: 'rgba(250,204,21,0.10)', border: 'rgba(250,204,21,0.3)', text: '#fde047' },
                      error:   { bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.3)',  text: '#fca5a5' },
                      info:    { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)', text: '#93c5fd' },
                    }[item.kind] || { bg: '#1e293b', border: '#334155', text: '#cbd5e1' };
                    return (
                      <div key={idx} style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '10px 12px' }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-sm" style={{ color: colors.text }}>{item.title}</p>
                              {item.items && item.items.length > 0 && (
                                <button onClick={() => toggleExpand(itemId)} className="text-xs text-slate-400 hover:text-white">
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {item.items.length} details
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-1">{item.detail}</p>
                            {isExpanded && item.items && (
                              <div className="mt-2 space-y-1 pl-3 border-l-2" style={{ borderColor: colors.border }}>
                                {item.items.map((sub, si) => (
                                  <div key={si} className="text-xs text-slate-300 flex justify-between gap-3">
                                    <span className="font-semibold">{sub.name}</span>
                                    <span className="text-slate-500">{sub.detail}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {item.action && (
                            <Button onClick={item.action.fn} className="bg-slate-700 hover:bg-slate-600 text-white text-xs whitespace-nowrap">
                              {item.action.label}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}