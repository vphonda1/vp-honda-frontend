import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit2, Trash2, Search, FileSpreadsheet, CheckCircle, AlertCircle, RefreshCw, Eye, ArrowLeft, Package, TrendingUp, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import { api } from '../utils/apiConfig';

// ── Helpers ──────────────────────────────────────────────────────────────────
const getLS = (k, fb = []) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const fmtINR = (n) => '₹' + (parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const CAT_COLORS = ['#ef4444','#f59e0b','#3b82f6','#10b981','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1','#14b8a6','#64748b'];

// ✅ AUTO CATEGORY - HSN code और description से category detect करो (ORIGINAL)
const autoDetectCategory = (hsnCode, description) => {
  const hsn = String(hsnCode || '').trim();
  const desc = String(description || '').toLowerCase();
  if (['27101973', '27101980', '27101990'].includes(hsn)) return 'Consumables';
  if (hsn.startsWith('8421')) return 'Filters';
  if (hsn.startsWith('4016')) return 'Engine';
  if (hsn.startsWith('8799') || hsn.startsWith('8714')) return 'Brakes';
  if (hsn.startsWith('8482')) return 'Bearings';
  if (hsn.startsWith('8536') || hsn.startsWith('8544')) return 'Electrical';
  if (hsn.startsWith('4011') || hsn.startsWith('4013')) return 'Tyres';
  if (hsn.startsWith('8301') || hsn.startsWith('8302')) return 'Body Parts';
  if (hsn.startsWith('8483') || hsn.startsWith('8484')) return 'Engine';
  if (hsn.startsWith('7318') || hsn.startsWith('8791')) return 'Hardware';
  if (hsn.startsWith('8512')) return 'Electrical';
  if (hsn.startsWith('4009') || hsn.startsWith('4005')) return 'Suspension';
  if (desc.includes('oil') || desc.includes('grease') || desc.includes('lubric')) return 'Consumables';
  if (desc.includes('filter')) return 'Filters';
  if (desc.includes('brake') || desc.includes('pad') || desc.includes('shoe')) return 'Brakes';
  if (desc.includes('bearing')) return 'Bearings';
  if (desc.includes('wire') || desc.includes('bulb') || desc.includes('switch') || desc.includes('electric')) return 'Electrical';
  if (desc.includes('tyre') || desc.includes('tube')) return 'Tyres';
  if (desc.includes('gasket') || desc.includes('o-ring') || desc.includes('seal') || desc.includes('washer')) return 'Engine';
  if (desc.includes('spring') || desc.includes('shock') || desc.includes('fork')) return 'Suspension';
  if (desc.includes('cover') || desc.includes('panel') || desc.includes('guard') || desc.includes('plate')) return 'Body Parts';
  if (desc.includes('bolt') || desc.includes('nut') || desc.includes('screw') || desc.includes('clip')) return 'Hardware';
  if (desc.includes('chain') || desc.includes('sprocket')) return 'Transmission';
  if (desc.includes('carbur') || desc.includes('piston') || desc.includes('valve') || desc.includes('cylinder')) return 'Engine';
  return 'Other';
};

// ═════════════════════════════════════════════════════════════════════════════
export default function PartsManagement({ user }) {
  const navigate = useNavigate();
  const [parts, setParts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const PARTS_PER_PAGE = 10;

  // Import states
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const handleAdminLogin = () => {
    const pass = prompt('Admin Password:');
    if (pass === 'vphonda@123') { setIsAdmin(true); alert('✅ Admin access granted!'); }
    else alert('❌ Wrong password!');
  };

  const [formData, setFormData] = useState({
    partNo: '', description: '', hsnCode: '', category: '',
    mrp: 0, unitPrice: 0, stock: 0
  });

  const categories = ['Engine', 'Electrical', 'Filters', 'Consumables', 'Brakes',
    'Suspension', 'Bearings', 'Tyres', 'Body Parts', 'Hardware', 'Transmission', 'Other'];

  // ── NEW: Tab state & invoice usage data ────────────────────────────────────
  const [activeTab, setActiveTab] = useState('parts'); // 'dashboard' | 'parts' | 'usage'
  const [invoiceUsage, setInvoiceUsage] = useState([]); // Parts used in invoices

  useEffect(() => { loadParts(); }, []);

  // Auto-fill category when HSN or description changes in form (ORIGINAL)
  useEffect(() => {
    if (formData.hsnCode || formData.description) {
      const cat = autoDetectCategory(formData.hsnCode, formData.description);
      if (cat !== 'Other' || !formData.category) {
        setFormData(prev => ({ ...prev, category: cat }));
      }
    }
  }, [formData.hsnCode, formData.description]);

  // ── ENHANCED: Load parts + consumption history from MongoDB ────────────────
  const loadParts = async () => {
    try {
      const response = await fetch(api('/api/parts'));
      const data = await response.json();
      setParts(data);
    } catch (error) {
      const lsParts = getLS('partsInventory', [
        { _id: '1', partNo: '08233-2MB-F0LG1', description: 'Engine Oil 600ML', hsnCode: '27101973', category: 'Consumables', mrp: 347, unitPrice: 287, stock: 45 },
        { _id: '2', partNo: '91307-KRM-840', description: 'O-Ring 18x31', hsnCode: '40169320', category: 'Engine', mrp: 11, unitPrice: 9.10, stock: 120 },
        { _id: '3', partNo: '94109-12000', description: 'Washer 12mm', hsnCode: '8791090', category: 'Hardware', mrp: 12, unitPrice: 9.93, stock: 200 }
      ]);
      setParts(lsParts);
    }

    // ⭐ Load consumption history from MongoDB (new endpoint)
    try {
      const histRes = await fetch(api('/api/parts/history/all'));
      if (histRes.ok) {
        const dbHistory = await histRes.json();
        // Convert to invoiceUsage format expected by stats UI
        const usage = dbHistory.map(c => ({
          partNo: c.partNumber || '',               // for grouping
          partNumber: c.partNumber || '',
          partName: c.partName || '',
          description: c.partName || '',            // stats UI uses this
          hsn: '',
          quantity: c.quantity || 1,
          total: c.totalValue || 0,                 // stats UI uses this
          totalValue: c.totalValue || 0,
          invoiceNo: c.invoiceNumber || '',         // stats UI uses this
          invoiceNumber: c.invoiceNumber || '',
          invoiceDate: c.consumedAt || c.createdAt || '',
          date: c.consumedAt || c.createdAt || '',
          customer: c.customerName || '—',
          customerName: c.customerName || '',
          regNo: c.regNo || '—',
          vehicle: c.regNo || '—',                  // stats UI uses this for grouping
        }));
        setInvoiceUsage(usage);
        setLoading(false);
        return;
      }
    } catch {}

    // Fallback: scan localStorage invoices
    loadInvoiceUsage();
    setLoading(false);
  };

  // ── NEW: Scan all invoices for parts usage ─────────────────────────────────
  const loadInvoiceUsage = () => {
    const allInvoices = [...getLS('invoices', []), ...getLS('generatedInvoices', [])];
    const usage = [];
    allInvoices.forEach(inv => {
      (inv.items || inv.parts || []).forEach(item => {
        if (!item.partNo) return;
        usage.push({
          partNo:      item.partNo,
          description: item.description || item.partNo,
          mrp:         item.mrp || 0,
          unitPrice:   item.unitPrice || 0,
          hsn:         item.hsn || '',
          quantity:    item.quantity || 1,
          total:       item.total || 0,
          vehicle:     inv.vehicle || '—',
          regNo:       inv.regNo || '—',
          customer:    inv.customerName || '—',
          invoiceNo:   inv.invoiceNumber || '',
          invoiceDate: inv.invoiceDate || '',
        });
      });
    });
    setInvoiceUsage(usage);
  };

  // ── ORIGINAL: Excel Import ─────────────────────────────────────────────────
  const handleExcelImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      const sheetName = workbook.SheetNames.find(
        name => name.toLowerCase().replace(/[_\s]/g, '') === 'jobcard' ||
                name.toLowerCase() === 'job_card' || name.toLowerCase() === 'parts'
      );

      if (!sheetName) {
        alert(`❌ "Job_card" sheet नहीं मिली!\nAvailable: ${workbook.SheetNames.join(', ')}`);
        setImporting(false);
        fileInputRef.current.value = '';
        return;
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (rows.length === 0) { alert('❌ Sheet में data नहीं!'); setImporting(false); fileInputRef.current.value = ''; return; }

      const get = (row, keys) => {
        for (const k of keys) {
          const found = Object.keys(row).find(rk => rk.toLowerCase().trim() === k.toLowerCase());
          if (found && row[found] !== '') return row[found];
        }
        return '';
      };

      let added = 0, skipped = 0, errors = 0;
      const existingPartNos = parts.map(p => p.partNo?.toLowerCase());

      for (const row of rows) {
        const partNo = String(get(row, ['partno', 'part no', 'part_no', 'b'])).trim();
        const description = String(get(row, ['description', 'decription', 'desc', 'c'])).trim();
        if (!partNo || !description || partNo === 'PartNo') continue;
        if (existingPartNos.includes(partNo.toLowerCase())) { skipped++; continue; }

        const hsnCode = String(get(row, ['hsn code', 'hsncode', 'hsn', 'd'])).trim();
        const mrp = parseFloat(get(row, ['mrp', 'e'])) || 0;
        const mrpDis = parseFloat(get(row, ['mrp discount', 'mrpdiscount', 'f'])) || 0;
        const unitPrice = parseFloat(get(row, ['unit price', 'unitprice', 'g'])) || 0;
        const discount = parseFloat(get(row, ['discount %', 'discount%', 'h'])) || 5;
        const sgstRate = parseFloat(get(row, ['sgs t/ut', 'sgst', 'n'])) || 9;

        const category = autoDetectCategory(hsnCode, description);
        const partData = { partNo, description, hsnCode, category, mrp, mrpDis, unitPrice, discount, gstRate: sgstRate * 2, stock: 0 };

        try {
          const res = await fetch(api('/api/parts'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(partData)
          });
          if (res.ok) { added++; existingPartNos.push(partNo.toLowerCase()); }
          else errors++;
        } catch {
          setParts(prev => [...prev, { ...partData, _id: Date.now().toString() + added }]);
          added++; existingPartNos.push(partNo.toLowerCase());
        }
      }

      setImportResult({ sheetName, added, skipped, errors });
      loadParts();
    } catch (err) {
      alert('❌ Import failed: ' + err.message);
    }
    setImporting(false);
    fileInputRef.current.value = '';
  };

  // ── ORIGINAL: CRUD operations ──────────────────────────────────────────────
  const handleAddPart = async () => {
    if (!formData.partNo || !formData.description) { alert('Part No और Description भरें'); return; }
    try {
      if (editingId) {
        await fetch(api(`/api/parts/${editingId}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
        alert('✅ Part updated!');
      } else {
        await fetch(api('/api/parts'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
        alert('✅ Part added!');
      }
      loadParts(); setShowForm(false); setEditingId(null);
      setFormData({ partNo: '', description: '', hsnCode: '', category: '', mrp: 0, unitPrice: 0, stock: 0 });
    } catch (error) { alert('Error saving part'); }
  };

  const handleEditPart = (part) => { setFormData(part); setEditingId(part._id); setShowForm(true); };

  const handleDeletePart = async (partId) => {
    if (!isAdmin) { alert('❌ सिर्फ Admin ही parts delete कर सकता है!'); return; }
    if (window.confirm('क्या आप इस part को delete करना चाहते हैं?')) {
      try {
        await fetch(api(`/api/parts/${partId}`), { method: 'DELETE' });
        loadParts(); alert('✅ Part deleted!');
      } catch (error) { console.error(error); }
    }
  };

  // ── Filter & Paginate (ORIGINAL) ───────────────────────────────────────────
  const filteredParts = parts.filter(part => {
    const matchesSearch = part.partNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          part.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || part.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.ceil(filteredParts.length / PARTS_PER_PAGE);
  const paginatedParts = filteredParts.slice((currentPage - 1) * PARTS_PER_PAGE, currentPage * PARTS_PER_PAGE);

  // ── NEW: Dashboard Stats ───────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalParts = parts.length;
    const totalUsed = invoiceUsage.reduce((s, u) => s + (u.quantity || 1), 0);
    const totalRevenue = invoiceUsage.reduce((s, u) => s + (u.total || 0), 0);
    const stockValue = parts.reduce((s, p) => s + ((p.mrp || p.unitPrice || 0) * (p.stock || 0)), 0);

    // Parts usage count map
    const usageMap = {};
    invoiceUsage.forEach(u => {
      if (!usageMap[u.partNo]) usageMap[u.partNo] = { ...u, usedCount: 0, vehicles: [] };
      usageMap[u.partNo].usedCount += (u.quantity || 1);
      if (u.vehicle !== '—') usageMap[u.partNo].vehicles.push({ vehicle: u.vehicle, regNo: u.regNo, customer: u.customer, invoiceNo: u.invoiceNo, date: u.invoiceDate, qty: u.quantity });
    });
    const topUsed = Object.values(usageMap).sort((a, b) => b.usedCount - a.usedCount).slice(0, 10);

    // Category distribution
    const catMap = {};
    parts.forEach(p => { catMap[p.category || 'Other'] = (catMap[p.category || 'Other'] || 0) + 1; });
    const categoryData = Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // Revenue by category from invoices
    const revByCat = {};
    invoiceUsage.forEach(u => {
      const part = parts.find(p => p.partNo === u.partNo);
      const cat = part?.category || autoDetectCategory(u.hsn, u.description);
      revByCat[cat] = (revByCat[cat] || 0) + (u.total || 0);
    });
    const revenueData = Object.entries(revByCat).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);

    const topUsedChart = topUsed.map(p => ({ name: (p.description || p.partNo).slice(0, 15), used: p.usedCount }));

    return { totalParts, totalUsed, totalRevenue, stockValue, topUsed, categoryData, revenueData, topUsedChart };
  }, [parts, invoiceUsage]);

  if (loading) return <div className="max-w-7xl mx-auto p-6"><p>Loading...</p></div>;

  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">📦 Parts Inventory Management</h1>
        <div className="flex gap-2">
          {!isAdmin ? (
            <button onClick={handleAdminLogin} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-bold">🔒 Admin Login</button>
          ) : (
            <span className="bg-green-700 text-white px-4 py-2 rounded font-bold">✅ Admin</span>
          )}
          <button onClick={() => { loadParts(); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold">🔄 Refresh</button>
        </div>
      </div>

      {/* ── NEW: TABS ── */}
      <div className="flex gap-2 mb-6 border-b-2 border-gray-200 pb-3">
        {[
          { id:'dashboard', label:'📊 Dashboard' },
          { id:'parts',     label:'📦 Parts List' },
          { id:'usage',     label:'🔧 Invoice Usage' },
        ].map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setCurrentPage(1); }}
            className={`px-5 py-2 rounded-t-lg text-sm font-bold transition-all border-2 ${
              activeTab === t.id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* ════════════════════════ DASHBOARD TAB (NEW) ════════════════════════ */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label:'Total Parts',      val:stats.totalParts,            icon:'📦', bg:'bg-blue-50',  col:'text-blue-700' },
              { label:'Parts Used (Invoices)', val:stats.totalUsed + '×',  icon:'🔧', bg:'bg-green-50', col:'text-green-700' },
              { label:'Revenue (Taxable)', val:fmtINR(stats.totalRevenue), icon:'💰', bg:'bg-emerald-50', col:'text-emerald-700' },
              { label:'Stock Value',       val:fmtINR(stats.stockValue),   icon:'📊', bg:'bg-purple-50', col:'text-purple-700' },
            ].map((kpi, i) => (
              <Card key={i} className={`${kpi.bg} border-2`}>
                <CardContent className="p-4">
                  <p className="text-gray-500 text-xs font-bold">{kpi.icon} {kpi.label}</p>
                  <p className={`${kpi.col} font-black text-2xl mt-1`}>{kpi.val}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-2">
              <CardHeader className="py-3"><CardTitle className="text-base">📊 Category Distribution</CardTitle></CardHeader>
              <CardContent>
                {stats.categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                      <Pie data={stats.categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85}
                        label={({ name, value }) => `${name}: ${value}`} labelLine={{ strokeWidth: 1 }}>
                        {stats.categoryData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]}/>)}
                      </Pie>
                      <Tooltip/>
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-gray-400 text-center py-10">No data</p>}
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader className="py-3"><CardTitle className="text-base">🔥 Top Used Parts (from Invoices)</CardTitle></CardHeader>
              <CardContent>
                {stats.topUsedChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={stats.topUsedChart} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
                      <XAxis type="number" tick={{ fontSize: 10 }}/>
                      <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 9 }}/>
                      <Tooltip/>
                      <Bar dataKey="used" fill="#3b82f6" radius={[0, 4, 4, 0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-gray-400 text-center py-10">PDF invoices import करें — usage data यहां दिखेगा</p>}
              </CardContent>
            </Card>
          </div>

          {/* Top Used Table with Vehicle Info */}
          <Card className="border-2">
            <CardHeader className="py-3 bg-gray-50"><CardTitle className="text-base">🏆 Most Used Parts — Vehicle Details</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b-2">
                  <tr>{['#','Part No','Description','MRP','Used','Vehicles','Last Invoice'].map(h => <th key={h} className="px-4 py-2 text-left font-bold text-gray-600">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {stats.topUsed.length === 0 ? (
                    <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-400">PDF invoices import करें — parts usage यहां दिखेगा</td></tr>
                  ) : stats.topUsed.slice(0, 8).map((p, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2 text-blue-700 font-bold font-mono">{p.partNo}</td>
                      <td className="px-4 py-2">{p.description}</td>
                      <td className="px-4 py-2">{fmtINR(p.mrp)}</td>
                      <td className="px-4 py-2 text-green-700 font-bold">{p.usedCount}×</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">
                        {(p.vehicles || []).slice(0, 2).map((v, j) => <span key={j} className="block">{v.vehicle} ({v.regNo}) — {v.customer}</span>)}
                        {(p.vehicles || []).length > 2 && <span className="text-gray-400">+{p.vehicles.length - 2} more</span>}
                      </td>
                      <td className="px-4 py-2 text-orange-600 font-bold">#{p.invoiceNo || (p.vehicles?.[0]?.invoiceNo) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Revenue by Category */}
          {stats.revenueData.length > 0 && (
            <Card className="border-2">
              <CardHeader className="py-3"><CardTitle className="text-base">💰 Revenue by Category (Taxable Amount)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats.revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }}/>
                    <YAxis tick={{ fontSize: 10 }}/>
                    <Tooltip formatter={(v) => fmtINR(v)}/>
                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ════════════════════════ PARTS LIST TAB (ORIGINAL) ════════════════════════ */}
      {activeTab === 'parts' && (<>
        {/* ACTION BUTTONS (ORIGINAL) */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData({ partNo: '', description: '', hsnCode: '', category: '', mrp: 0, unitPrice: 0, stock: 0 }); }} className="bg-green-600 hover:bg-green-700 text-white">
            <Plus className="mr-2" /> Add Part
          </Button>
          <Button onClick={() => fileInputRef.current.click()} disabled={importing} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
            <FileSpreadsheet className="mr-2" size={18} />
            {importing ? '⏳ Importing...' : '📥 Import from Excel (Job_card)'}
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xlsm,.xls" onChange={handleExcelImport} style={{ display: 'none' }} />
        </div>

        {/* IMPORT RESULT (ORIGINAL) */}
        {importResult && (
          <div className={`mb-4 p-4 rounded-lg border-2 flex items-start gap-3 ${importResult.errors === 0 ? 'bg-green-50 border-green-400' : 'bg-yellow-50 border-yellow-400'}`}>
            {importResult.errors === 0 ? <CheckCircle className="text-green-600 flex-shrink-0" size={22} /> : <AlertCircle className="text-yellow-600 flex-shrink-0" size={22} />}
            <div>
              <p className="font-bold">✅ Import Complete — Sheet: <span className="text-blue-700">{importResult.sheetName}</span></p>
              <p className="text-sm mt-1">
                <span className="text-green-700 font-bold">✅ {importResult.added} added</span> &nbsp;|&nbsp;
                <span className="text-orange-600 font-bold">⏭ {importResult.skipped} skipped</span>
                {importResult.errors > 0 && <span className="text-red-600 font-bold"> | ❌ {importResult.errors} errors</span>}
              </p>
            </div>
            <button onClick={() => setImportResult(null)} className="ml-auto text-gray-400 hover:text-gray-600 font-bold">✕</button>
          </div>
        )}

        {/* ADD/EDIT FORM (ORIGINAL) */}
        {showForm && (
          <Card className="mb-6">
            <CardHeader className="bg-green-600 text-white">
              <CardTitle>{editingId ? 'Edit Part' : 'Add New Part'}</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input placeholder="Part No *" value={formData.partNo} onChange={(e) => setFormData({...formData, partNo: e.target.value})} className="border-2" />
                <Input placeholder="Description *" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="border-2" />
                <Input placeholder="HSN Code" value={formData.hsnCode} onChange={(e) => setFormData({...formData, hsnCode: e.target.value})} className="border-2" />
                <div>
                  <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="border-2 p-2 rounded w-full">
                    <option value="">Select Category</option>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  {formData.category && <p className="text-xs text-green-600 mt-1">✅ Auto-detected: {formData.category}</p>}
                </div>
                <Input type="number" placeholder="MRP" value={formData.mrp} onChange={(e) => setFormData({...formData, mrp: parseFloat(e.target.value)})} className="border-2" />
                <Input type="number" placeholder="Unit Price" value={formData.unitPrice} onChange={(e) => setFormData({...formData, unitPrice: parseFloat(e.target.value)})} className="border-2" />
                <Input type="number" placeholder="Stock" value={formData.stock} onChange={(e) => setFormData({...formData, stock: parseInt(e.target.value)})} className="border-2" />
              </div>
              <div className="flex gap-4">
                <Button onClick={handleAddPart} className="bg-green-600 hover:bg-green-700 text-white">{editingId ? 'Update Part' : 'Save Part'}</Button>
                <Button onClick={() => { setShowForm(false); setEditingId(null); }} className="bg-gray-500 text-white">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SEARCH & FILTER (ORIGINAL) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <Input placeholder="Search part no or description..." value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="pl-10 border-2" />
          </div>
          <select value={selectedCategory}
            onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
            className="border-2 p-2 rounded">
            <option value="All">All Categories</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

        {/* PARTS TABLE (ORIGINAL) */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b-2">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold">#</th>
                    <th className="px-4 py-3 text-left font-bold">Part No</th>
                    <th className="px-4 py-3 text-left font-bold">Description</th>
                    <th className="px-4 py-3 text-left font-bold">Category</th>
                    <th className="px-4 py-3 text-left font-bold">HSN</th>
                    <th className="px-4 py-3 text-left font-bold">MRP</th>
                    <th className="px-4 py-3 text-left font-bold">Unit Price</th>
                    <th className="px-4 py-3 text-left font-bold">GST%</th>
                    <th className="px-4 py-3 text-left font-bold">Stock</th>
                    <th className="px-4 py-3 text-left font-bold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedParts.length === 0 ? (
                    <tr><td colSpan="10" className="px-6 py-6 text-center text-gray-500">No parts found</td></tr>
                  ) : (
                    paginatedParts.map((part, idx) => (
                      <tr key={part._id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400 text-sm">{(currentPage - 1) * PARTS_PER_PAGE + idx + 1}</td>
                        <td className="px-4 py-3 font-bold text-blue-700 text-sm">{part.partNo}</td>
                        <td className="px-4 py-3 text-sm">{part.description}</td>
                        <td className="px-4 py-3">
                          <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs font-bold">
                            {part.category || 'Other'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{part.hsnCode}</td>
                        <td className="px-4 py-3 text-sm">₹{part.mrp?.toFixed(2)}</td>
                        <td className="px-4 py-3 font-bold text-green-700 text-sm">₹{part.unitPrice?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm">{part.gstRate || 18}%</td>
                        <td className="px-4 py-3 text-sm">{part.stock}</td>
                        <td className="px-4 py-3 flex gap-2">
                          <button onClick={() => handleEditPart(part)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm" title="Edit">
                            <Edit2 size={14} />
                          </button>
                          {isAdmin ? (
                            <button onClick={() => handleDeletePart(part._id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm" title="Delete (Admin Only)">
                              <Trash2 size={14} />
                            </button>
                          ) : (
                            <button disabled className="bg-gray-300 text-gray-400 px-3 py-1 rounded text-sm cursor-not-allowed" title="Only Admin can delete">
                              🔒
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION (ORIGINAL) */}
            {filteredParts.length > PARTS_PER_PAGE && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
                <p className="text-sm text-gray-600">
                  Page <b>{currentPage}</b> of <b>{totalPages}</b> &nbsp;|&nbsp; Total: <b>{filteredParts.length}</b> parts
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded disabled:opacity-40 hover:bg-blue-700">◀ Previous</button>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded disabled:opacity-40 hover:bg-blue-700">Next ▶</button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-300 rounded">
          <p className="text-sm text-blue-700">
            <b>Total Parts:</b> {parts.length} &nbsp;|&nbsp;
            <b>Filtered:</b> {filteredParts.length} &nbsp;|&nbsp;
            <b>Stock Value:</b> ₹{parts.reduce((sum, p) => sum + ((p.unitPrice || 0) * (p.stock || 0)), 0).toFixed(2)}
          </p>
        </div>
      </>)}

      {/* ════════════════════════ USAGE TAB (NEW) ════════════════════════ */}
      {activeTab === 'usage' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="bg-gray-50 py-3">
              <CardTitle className="text-base">🔧 Parts Usage — कौन सा Part किस Vehicle में गया</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b-2">
                    <tr>{['Part No','Description','MRP','Customer','Vehicle','Reg No','Invoice #','Date','Qty'].map(h =>
                      <th key={h} className="px-4 py-2 text-left font-bold text-gray-600">{h}</th>
                    )}</tr>
                  </thead>
                  <tbody>
                    {invoiceUsage.length === 0 ? (
                      <tr><td colSpan="9" className="px-6 py-8 text-center text-gray-400">
                        PDF invoices import करें — parts usage data यहां automatically दिखेगा
                      </td></tr>
                    ) : invoiceUsage.map((u, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2 text-blue-700 font-mono font-bold">{u.partNo}</td>
                        <td className="px-4 py-2">{u.description}</td>
                        <td className="px-4 py-2">{fmtINR(u.mrp)}</td>
                        <td className="px-4 py-2 font-medium">{u.customer}</td>
                        <td className="px-4 py-2 text-blue-600">{u.vehicle}</td>
                        <td className="px-4 py-2 text-gray-500 font-mono">{u.regNo}</td>
                        <td className="px-4 py-2">
                          <button onClick={() => navigate(`/invoice/${u.invoiceNo}`)} className="text-orange-600 hover:underline font-bold">#{u.invoiceNo}</button>
                        </td>
                        <td className="px-4 py-2 text-gray-400">{u.invoiceDate ? new Date(u.invoiceDate).toLocaleDateString('en-IN') : '—'}</td>
                        <td className="px-4 py-2 text-green-700 font-bold">{u.quantity}×</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Revenue by Category */}
          {stats.revenueData.length > 0 && (
            <Card className="border-2">
              <CardHeader className="py-3"><CardTitle className="text-base">💰 Category-wise Revenue (Taxable Amount)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats.revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }}/>
                    <YAxis tick={{ fontSize: 10 }}/>
                    <Tooltip formatter={(v) => fmtINR(v)}/>
                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

    </div>
  );
}