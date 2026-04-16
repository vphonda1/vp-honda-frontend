import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Trash2, Download, ArrowLeft, Eye, FileText, FolderOpen, RefreshCw, Clock, AlertCircle } from 'lucide-react';
import { api } from '../utils/apiConfig';

const getLS = (k, fb=[]) => { 
  try{
    const v=localStorage.getItem(k);
    return v?JSON.parse(v):fb;
  }catch{
    return fb;
  } 
};

const saveLS = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch(e) {
    console.error('Storage error:', e);
  }
};

const importPDFs = async (files) => {
  const formData = new FormData();
  files.forEach(f => formData.append('pdfs', f));
  
  const res = await fetch(api('/api/parse-pdf-batch'), {
    method: 'POST',
    body: formData
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Import failed');
  }
  
  return res.json();
};

export default function InvoiceManagementDashboard() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  
  const INVOICES_PER_PAGE = 5;
  const intervalRef = useRef(null);

  useEffect(() => {
    loadInvoices();
    const fn = () => loadInvoices();
    window.addEventListener('storage', fn);
    intervalRef.current = setInterval(fn, 30000);
    return () => { 
      window.removeEventListener('storage', fn); 
      clearInterval(intervalRef.current); 
    };
  }, []);

  const loadInvoices = async () => {
    let dbInv = [];
    try { 
      const res = await fetch(api('/api/invoices')); 
      if (res.ok) dbInv = await res.json(); 
    } catch(e) {}

    const lsInv = getLS('invoices', []);
    const all = [...dbInv, ...lsInv];
    
    const seen = new Set();
    const unique = all
      .filter(i => { 
        const k = i.invoiceNumber || i.id || i._id; 
        if(seen.has(k)) return false; 
        seen.add(k); 
        return true; 
      })
      .sort((a,b) => new Date(b.importedAt || b.invoiceDate || 0) - new Date(a.importedAt || a.invoiceDate || 0));

    setInvoices(unique);
    setLastRefresh(new Date());
    setLoading(false);
  };

  const handleImportPDFs = async (files, type = 'both') => {
    if (!files.length) return;

    setImporting(true);
    setImportProgress({ current: 0, total: files.length });
    const errors = [];
    const added = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setImportProgress({ current: i + 1, total: files.length });

      if (file.type !== 'application/pdf') {
        errors.push(file.name + ': PDF नहीं है');
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('pdf', file);

        const res = await fetch(api('/api/parse-pdf'), {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error);
        }

        const data = await res.json();
        const invoice = data.invoice;

        // Type check करो
        if (type === 'vehicle' && invoice.invoiceType !== 'vehicle') {
          console.log(`⏭️ Skipping ${file.name} (vehicle invoice नहीं)`);
          continue;
        }
        if (type === 'service' && invoice.invoiceType !== 'service') {
          console.log(`⏭️ Skipping ${file.name} (service invoice नहीं)`);
          continue;
        }

        added.push(invoice);

        // Database में save करो
        try {
          await fetch(api('/api/invoices'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(invoice)
          });
        } catch(e) {
          console.warn('DB save error:', e);
        }

      } catch (err) {
        console.error(`❌ ${file.name}:`, err.message);
        errors.push(file.name + ': ' + err.message);
      }
    }

    // LocalStorage में save करो
    const existing = getLS('invoices', []);
    const updated = [...added, ...existing];
    const seen = new Set();
    const deduplicated = updated.filter(i => {
      const k = i.invoiceNumber;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    saveLS('invoices', deduplicated);

    // Service data update करो (service reminders के लिए)
    updateServiceData(added);

    setImporting(false);
    setImportProgress({ current: 0, total: 0 });
    loadInvoices();

    const successMsg = added.length > 0 ? `✅ ${added.length} imported` : '';
    const errorMsg = errors.length > 0 ? ` | ⚠️ ${errors.length} errors` : '';
    setMessage(successMsg + errorMsg);
    setTimeout(() => setMessage(''), 6000);
  };

  const updateServiceData = (invoices) => {
    const svcData = getLS('customerServiceData', {});

    for (const inv of invoices) {
      const reg = inv.regNo;
      if (!reg) continue;

      if (!svcData[reg]) svcData[reg] = {};
      const s = svcData[reg];

      s.customerName = inv.customerName;
      s.phone = inv.customerPhone;
      s.vehicle = inv.vehicle;
      s.regNo = reg;

      if (inv.invoiceType === 'vehicle') {
        // Vehicle purchase
        s.purchaseDate = inv.invoiceDate;
        s.purchaseInvoice = inv.invoiceNumber;
        // Service reminders बनाओ
        s.serviceReminders = {
          first: {
            dueDate: addDays(inv.invoiceDate, 180), // 6 months
            dueKm: 1000,
            status: 'pending'
          },
          second: {
            dueDate: addDays(inv.invoiceDate, 365),
            dueKm: 20000,
            status: 'pending'
          },
          third: {
            dueDate: addDays(inv.invoiceDate, 730),
            dueKm: 40000,
            status: 'pending'
          }
        };
      } else if (inv.invoiceType === 'service') {
        // Service invoice
        const sn = inv.serviceNumber;
        if (sn === 1) {
          s.firstServiceDate = inv.invoiceDate;
          s.firstServiceKm = 0;
          if (s.serviceReminders) s.serviceReminders.first.status = 'completed';
        }
        if (sn === 2) {
          s.secondServiceDate = inv.invoiceDate;
          s.secondServiceKm = 0;
          if (s.serviceReminders) s.serviceReminders.second.status = 'completed';
        }
        if (sn === 3) {
          s.thirdServiceDate = inv.invoiceDate;
          s.thirdServiceKm = 0;
          if (s.serviceReminders) s.serviceReminders.third.status = 'completed';
        }

        if (!s.serviceHistory) s.serviceHistory = [];
        s.serviceHistory.push({
          number: sn || 0,
          date: inv.invoiceDate,
          invoiceNo: inv.invoiceNumber,
          amount: inv.grandTotal,
          parts: inv.items.length
        });
      }
    }

    saveLS('customerServiceData', svcData);
  };

  const addDays = (dateStr, days) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const handleVehicleFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.multiple = true;
    input.onchange = e => handleImportPDFs(Array.from(e.target.files), 'vehicle');
    input.click();
  };

  const handleServiceFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.multiple = true;
    input.onchange = e => handleImportPDFs(Array.from(e.target.files), 'service');
    input.click();
  };

  const clearInvoices = async (type) => {
    const pwd = prompt('Admin password:');
    if (pwd !== 'vphonda@123') {
      alert('❌ गलत password!');
      return;
    }

    const remaining = invoices.filter(i => {
      if (type === 'vehicle') return i.invoiceType !== 'vehicle';
      if (type === 'service') return i.invoiceType !== 'service';
      return true;
    });

    saveLS('invoices', remaining);
    
    try {
      await fetch(api('/api/invoices/clear'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
    } catch(e) {}

    loadInvoices();
    setMessage(`✅ ${type} invoices cleared`);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleDelete = async (invoiceNo) => {
    if (!window.confirm('Delete this invoice?')) return;

    const inv = invoices.find(i => String(i.invoiceNumber) === String(invoiceNo));
    
    if (inv && inv._id) {
      try {
        await fetch(api(`/api/invoices/${inv._id}`), { method: 'DELETE' });
      } catch(e) {}
    }

    const updated = invoices.filter(i => String(i.invoiceNumber) !== String(invoiceNo));
    saveLS('invoices', updated);
    loadInvoices();
    setMessage('✅ Deleted!');
    setTimeout(() => setMessage(''), 2000);
  };

  const filtered = invoices.filter(inv => {
    if (activeTab === 'vehicle' && inv.invoiceType !== 'vehicle') return false;
    if (activeTab === 'service' && inv.invoiceType !== 'service') return false;

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (
        String(inv.invoiceNumber).includes(s) ||
        (inv.customerName || '').toLowerCase().includes(s) ||
        (inv.customerPhone || '').includes(s) ||
        (inv.vehicle || '').toLowerCase().includes(s) ||
        (inv.regNo || '').includes(s)
      );
    }
    return true;
  });

  const vehicleInv = invoices.filter(i => i.invoiceType === 'vehicle');
  const serviceInv = invoices.filter(i => i.invoiceType === 'service');
  const totalRev = invoices.reduce((s, i) => s + (i.grandTotal || 0), 0);
  const vehicleRev = vehicleInv.reduce((s, i) => s + (i.grandTotal || 0), 0);
  const serviceRev = serviceInv.reduce((s, i) => s + (i.grandTotal || 0), 0);

  const totalPages = Math.ceil(filtered.length / INVOICES_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * INVOICES_PER_PAGE, currentPage * INVOICES_PER_PAGE);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <Button 
            onClick={() => navigate('/reminders')} 
            className="bg-red-700 hover:bg-red-600 text-white font-bold flex items-center gap-2"
          >
            <ArrowLeft size={18} /> Back
          </Button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">📋 Invoice Management</h1>
            <p className="text-slate-400 text-xs flex items-center justify-center gap-1 mt-1">
              <Clock size={11} /> {lastRefresh.toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})}
            </p>
          </div>
          <Button 
            onClick={loadInvoices} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2"
          >
            <RefreshCw size={16} /> Refresh
          </Button>
        </div>

        {/* Messages */}
        {message && (
          <Card className={`${message.includes('✅') ? 'bg-green-900/20 border-green-500' : 'bg-red-900/20 border-red-500'}`}>
            <CardContent className="pt-4 pb-4">
              <p className={`font-bold text-sm ${message.includes('✅') ? 'text-green-300' : 'text-red-400'}`}>
                {message}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Import Progress */}
        {importing && (
          <Card className="bg-blue-900/30 border-blue-500">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-blue-300 font-bold text-sm">
                    Importing: {importProgress.current}/{importProgress.total}
                  </p>
                  <div className="h-2 bg-slate-700 rounded-full mt-2">
                    <div 
                      className="h-2 bg-blue-500 rounded-full transition-all" 
                      style={{width: `${importProgress.total ? (importProgress.current/importProgress.total*100) : 0}%`}}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Import Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-900/20 border-blue-500">
            <CardContent className="pt-5 pb-5">
              <Button 
                onClick={handleVehicleFile}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 flex items-center justify-center gap-2 text-base"
              >
                <FileText size={22} /> Import Vehicle PDF
              </Button>
              <p className="text-blue-400 text-xs mt-2 text-center">Vehicle Tax Invoice</p>
            </CardContent>
          </Card>

          <Card className="bg-green-900/20 border-green-500">
            <CardContent className="pt-5 pb-5">
              <Button 
                onClick={handleServiceFile}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 flex items-center justify-center gap-2 text-base"
              >
                <FolderOpen size={22} /> Import Service PDF
              </Button>
              <p className="text-green-400 text-xs mt-2 text-center">Service/Parts Invoice</p>
            </CardContent>
          </Card>

          <Card className="bg-purple-900/20 border-purple-500">
            <CardContent className="pt-5 pb-5">
              <Button 
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 flex items-center justify-center gap-2 text-base"
                disabled
              >
                <Download size={22} /> Export as PDF
              </Button>
              <p className="text-purple-400 text-xs mt-2 text-center">Coming soon</p>
            </CardContent>
          </Card>
        </div>

        {/* Clear Buttons */}
        <div className="flex gap-3 flex-wrap">
          <Button 
            onClick={() => clearInvoices('vehicle')}
            className="bg-orange-800 hover:bg-orange-700 text-white font-bold flex items-center gap-2"
          >
            <Trash2 size={16} /> Clear Vehicle ({vehicleInv.length})
          </Button>
          <Button 
            onClick={() => clearInvoices('service')}
            className="bg-green-800 hover:bg-green-700 text-white font-bold flex items-center gap-2"
          >
            <Trash2 size={16} /> Clear Service ({serviceInv.length})
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="bg-blue-900/20 border-blue-500">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-400">📋 Total</p>
              <h3 className="text-3xl font-black text-blue-400 mt-1">{invoices.length}</h3>
              <p className="text-xs text-slate-500 mt-1">₹{totalRev.toLocaleString('en-IN')}</p>
            </CardContent>
          </Card>

          <Card className="bg-orange-900/20 border-orange-500">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-400">🏍️ Vehicle</p>
              <h3 className="text-3xl font-black text-orange-400 mt-1">{vehicleInv.length}</h3>
              <p className="text-xs text-slate-500 mt-1">₹{vehicleRev.toLocaleString('en-IN')}</p>
            </CardContent>
          </Card>

          <Card className="bg-green-900/20 border-green-500">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-400">🔧 Service</p>
              <h3 className="text-3xl font-black text-green-400 mt-1">{serviceInv.length}</h3>
              <p className="text-xs text-slate-500 mt-1">₹{serviceRev.toLocaleString('en-IN')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'all', label: `📋 सभी (${invoices.length})`, col: 'blue' },
            { id: 'vehicle', label: `🏍️ Vehicle (${vehicleInv.length})`, col: 'orange' },
            { id: 'service', label: `🔧 Service (${serviceInv.length})`, col: 'green' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                activeTab === t.id
                  ? `bg-${t.col}-600 border-${t.col}-400 text-white shadow-lg`
                  : `bg-slate-800 border-slate-600 text-slate-300 hover:border-${t.col}-500`
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Invoice #, Customer, Phone, Vehicle, Reg No..."
              className="pl-10 bg-slate-800 border-slate-600 text-white placeholder-slate-500"
            />
          </div>
          <p className="text-slate-500 text-xs mt-1">{filtered.length} invoices found</p>
        </div>

        {/* Invoice List Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 py-3">
            <CardTitle className="text-white text-base">
              {activeTab === 'vehicle' ? '🏍️ Vehicle Invoices' : activeTab === 'service' ? '🔧 Service Invoices' : '📋 All Invoices'} ({filtered.length})
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="mx-auto text-slate-500 mb-2" size={32} />
                <p className="text-slate-400">कोई invoice नहीं।</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-700 border-b border-slate-600">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-300">#</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-300">Invoice</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-300">Type</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-300">Customer</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-300">Vehicle</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-300">Date</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-300">Amount</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-300">Parts</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-300">GST</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-300">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginated.map((inv, idx) => {
                      const rowIdx = (currentPage - 1) * INVOICES_PER_PAGE + idx;
                      return (
                        <tr key={inv._id || inv.invoiceNumber} className="border-b border-slate-700 hover:bg-slate-700/50">
                          <td className="px-3 py-2 text-slate-500 text-xs">{rowIdx + 1}</td>
                          <td className="px-3 py-2 text-white font-bold text-xs">#{inv.invoiceNumber}</td>
                          <td className="px-3 py-2 text-xs">
                            {inv.invoiceType === 'vehicle' 
                              ? <span className="bg-orange-900 text-orange-300 px-1.5 py-0.5 rounded font-bold">🏍️ Vehicle</span>
                              : <span className="bg-green-900 text-green-300 px-1.5 py-0.5 rounded font-bold">🔧 Service</span>
                            }
                          </td>
                          <td className="px-3 py-2 text-slate-200 text-xs">{inv.customerName || '—'}</td>
                          <td className="px-3 py-2 text-blue-300 text-xs">{inv.vehicle || '—'}</td>
                          <td className="px-3 py-2 text-slate-400 text-xs">
                            {new Date(inv.invoiceDate).toLocaleDateString('en-IN')}
                          </td>
                          <td className="px-3 py-2 text-green-400 font-bold text-xs">
                            ₹{(inv.grandTotal || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="bg-blue-900 text-blue-300 px-1.5 py-0.5 rounded font-bold text-xs">
                              {(inv.items || []).length}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-yellow-300 font-bold text-xs">
                            ₹{(inv.totalGST || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1.5">
                              <Button 
                                onClick={() => navigate(`/invoice/${inv.invoiceNumber}`)}
                                className="bg-blue-600 hover:bg-blue-700 text-white h-7 px-2 text-xs flex items-center gap-1"
                              >
                                <Eye size={12} /> View
                              </Button>
                              <Button 
                                onClick={() => handleDelete(inv.invoiceNumber)}
                                className="bg-red-700 hover:bg-red-600 text-white h-7 px-2 text-xs"
                              >
                                <Trash2 size={12} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot className="bg-slate-700 border-t-2 border-slate-600">
                    <tr>
                      <td colSpan="6" className="px-3 py-2 text-slate-300 font-bold text-sm">
                        TOTAL ({filtered.length})
                      </td>
                      <td className="px-3 py-2 text-green-300 font-black text-sm">
                        ₹{filtered.reduce((s, i) => s + (i.grandTotal || 0), 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-blue-300 font-black text-sm">
                        {filtered.reduce((s, i) => s + (i.items || []).length, 0)}
                      </td>
                      <td className="px-3 py-2 text-yellow-300 font-black text-sm">
                        ₹{filtered.reduce((s, i) => s + (i.totalGST || 0), 0).toLocaleString('en-IN')}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-slate-700/50 border-t border-slate-600">
                <p className="text-xs text-slate-400">
                  Page <b className="text-white">{currentPage}</b> of <b className="text-white">{totalPages}</b>
                </p>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-4 text-xs disabled:opacity-40"
                  >
                    ◀ Previous
                  </Button>
                  <Button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-4 text-xs disabled:opacity-40"
                  >
                    Next ▶
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
