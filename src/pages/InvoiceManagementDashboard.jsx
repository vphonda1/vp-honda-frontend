import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Trash2, Download, ArrowLeft, Eye, FileText, FolderOpen, RefreshCw, Clock, X } from 'lucide-react';
import { api } from '../utils/apiConfig';

const getLS = (k, fb=[]) => { try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch{return fb;} };

const extractPDFText = async (file) => {
  const formData = new FormData();
  formData.append('pdf', file);

  const res = await fetch(api('/api/invoices/parse-pdf'), {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Server error' }));
    throw new Error(err.error || 'PDF parse failed');
  }

  const data = await res.json();
  if (!data.invoice) throw new Error(data.error || 'No invoice extracted');

  console.log('📄 PDF extracted via backend, invoice:', data.invoice.invoiceNumber);
  return data.invoice;
};

export default function InvoiceManagementDashboard() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [invoices, setInvoices] = useState(() => getLS('invoices'));
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const INVOICES_PER_PAGE = 5;
  const [message, setMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState({});
  
  // ✅ NEW: PDF Viewer Modal State
  const [pdfModal, setPdfModal] = useState({ open: false, data: null });

  useEffect(() => {
    localStorage.setItem('invoices', JSON.stringify(invoices));
  }, [invoices]);

  const getInvoiceType = (inv) => inv.invoiceType || (inv.serviceNumber || inv.serviceKm || inv.serviceType ? 'service' : 'vehicle');

  const vehicleInvoices = invoices.filter(inv => getInvoiceType(inv) === 'vehicle');
  const serviceInvoices = invoices.filter(inv => getInvoiceType(inv) === 'service');

  const tabInvoices = activeTab === 'vehicle' ? vehicleInvoices : activeTab === 'service' ? serviceInvoices : invoices;
  const filtered = tabInvoices.filter(inv => {
    const s = searchTerm.toLowerCase();
    return (
      (inv.invoiceNumber + '').includes(s) ||
      (inv.customerName || '').toLowerCase().includes(s) ||
      (inv.customerPhone || '').includes(s) ||
      (inv.vehicle || '').toLowerCase().includes(s) ||
      (inv.regNo || '').toLowerCase().includes(s)
    );
  });

  const totalPages = Math.ceil(filtered.length / INVOICES_PER_PAGE);
  const paginatedInvs = filtered.slice((currentPage-1)*INVOICES_PER_PAGE, currentPage*INVOICES_PER_PAGE);

  const totalRev = invoices.reduce((s,i) => s + (i.totals?.totalAmount || i.amount || 0), 0);
  const vehicleRev = vehicleInvoices.reduce((s,i) => s + (i.totals?.totalAmount || i.amount || 0), 0);
  const serviceRev = serviceInvoices.reduce((s,i) => s + (i.totals?.totalAmount || i.amount || 0), 0);

  // ✅ PDF Viewer Handler
  const handleViewPDF = (inv) => {
    setPdfModal({
      open: true,
      data: inv
    });
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setLoading(true);
    setMessage('');

    const newInvoices = [];
    const errors = [];

    for (const file of files) {
      try {
        setUploadProgress(prev => ({ ...prev, [file.name]: 'Uploading...' }));
        
        const parsedInvoice = await extractPDFText(file);
        
        newInvoices.push(parsedInvoice);
        setUploadProgress(prev => ({ ...prev, [file.name]: '✅ Done' }));
        
        console.log(`✅ Imported: ${parsedInvoice.invoiceNumber}`);
      } catch (err) {
        console.error(`❌ ${file.name}:`, err.message);
        errors.push({ file: file.name, error: err.message });
        setUploadProgress(prev => ({ ...prev, [file.name]: `❌ ${err.message}` }));
      }
    }

    if (newInvoices.length > 0) {
      const existing = new Set(invoices.map(i => i.invoiceNumber));
      const unique = newInvoices.filter(i => !existing.has(i.invoiceNumber));
      
      const merged = [...unique, ...invoices].sort((a,b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));
      setInvoices(merged);

      setMessage(`✅ Imported ${unique.length} invoices${errors.length > 0 ? ` (${errors.length} errors)` : ''}`);
    } else if (errors.length > 0) {
      setMessage(`❌ ${errors.length} invoices failed`);
    }

    setLoading(false);
    if (inputRef.current) inputRef.current.value = '';
    setTimeout(() => setMessage(''), 5000);
  };

  const handleClearAll = (type) => {
    if (!window.confirm(`Delete all ${type} invoices?`)) return;
    const filtered = invoices.filter(i => getInvoiceType(i) !== type);
    setInvoices(filtered);
    setMessage(`✅ Cleared ${type} invoices`);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this invoice?')) return;
    const updated = invoices.filter(i => (i.invoiceNumber || i.id) !== id);
    setInvoices(updated);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-black text-white">📋 Invoice Management</h1>
          <Button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2">
            <RefreshCw size={18} /> Refresh
          </Button>
        </div>

        {/* MESSAGE */}
        {message && (
          <Card className={message.includes('❌') ? 'bg-red-900/20 border-red-500' : 'bg-green-900/20 border-green-500'}>
            <CardContent className="pt-3 pb-3">
              <p className={message.includes('❌') ? 'text-red-300 font-bold' : 'text-green-300 font-bold'}>{message}</p>
            </CardContent>
          </Card>
        )}

        {/* IMPORT BUTTONS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-800 border-slate-700 hover:border-orange-500 transition cursor-pointer">
            <label className="cursor-pointer block h-full">
              <input ref={inputRef} type="file" accept=".pdf" multiple onChange={handleFileSelect} disabled={loading} className="hidden"/>
              <CardContent className="pt-6 pb-6">
                <div className="text-center">
                  <FileText className="mx-auto mb-3 text-orange-400" size={32}/>
                  <p className="text-white font-bold">Import Vehicle PDF</p>
                  <p className="text-xs text-slate-400 mt-1">Vehicle Tax Invoice</p>
                </div>
              </CardContent>
            </label>
          </Card>

          <Card className="bg-slate-800 border-slate-700 hover:border-green-500 transition cursor-pointer">
            <label className="cursor-pointer block h-full">
              <input type="file" accept=".pdf" multiple onChange={handleFileSelect} disabled={loading} className="hidden"/>
              <CardContent className="pt-6 pb-6">
                <div className="text-center">
                  <FileText className="mx-auto mb-3 text-green-400" size={32}/>
                  <p className="text-white font-bold">Import Service PDF</p>
                  <p className="text-xs text-slate-400 mt-1">Service/Parts Tax Invoice</p>
                </div>
              </CardContent>
            </label>
          </Card>

          <Card className="bg-slate-800 border-slate-700 opacity-50">
            <CardContent className="pt-6 pb-6">
              <div className="text-center">
                <Download className="mx-auto mb-3 text-blue-400" size={32}/>
                <p className="text-white font-bold">Export as PDF</p>
                <p className="text-xs text-slate-400 mt-1">Coming soon</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CLEAR BUTTONS */}
        <div className="flex gap-3">
          <Button onClick={() => handleClearAll('vehicle')} className="bg-red-700 hover:bg-red-600 text-white font-bold">
            🗑️ Clear Vehicle ({vehicleInvoices.length})
          </Button>
          <Button onClick={() => handleClearAll('service')} className="bg-red-700 hover:bg-red-600 text-white font-bold">
            🗑️ Clear Service ({serviceInvoices.length})
          </Button>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-900/20 border-blue-500">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-400">Total</p>
              <h3 className="text-3xl font-black text-blue-400 mt-1">{invoices.length}</h3>
              <p className="text-xs text-slate-500 mt-1">₹{totalRev.toLocaleString('en-IN')}</p>
            </CardContent>
          </Card>
          <Card className="bg-orange-900/20 border-orange-500">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-400">🏍️ Vehicle Tax Invoices</p>
              <h3 className="text-3xl font-black text-orange-400 mt-1">{vehicleInvoices.length}</h3>
              <p className="text-xs text-slate-500 mt-1">₹{vehicleRev.toLocaleString('en-IN')}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-900/20 border-green-500">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-400">🔧 Service/Parts Invoices</p>
              <h3 className="text-3xl font-black text-green-400 mt-1">{serviceInvoices.length}</h3>
              <p className="text-xs text-slate-500 mt-1">₹{serviceRev.toLocaleString('en-IN')}</p>
            </CardContent>
          </Card>
        </div>

        {/* TYPE TABS */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id:'all',     label:`📋 सभी (${invoices.length})`,                       col:'blue'   },
            { id:'vehicle', label:`🏍️ Vehicle Tax Invoice (${vehicleInvoices.length})`, col:'orange' },
            { id:'service', label:`🔧 Service/Parts Invoice (${serviceInvoices.length})`,col:'green'  },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                activeTab === t.id
                  ? `bg-${t.col}-600 border-${t.col}-400 text-white shadow-lg`
                  : `bg-slate-800 border-slate-600 text-slate-300 hover:border-${t.col}-500`
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Description */}
        <div className={`px-4 py-2 rounded-lg text-xs font-medium border ${
          activeTab === 'vehicle' ? 'bg-orange-900/20 border-orange-700 text-orange-300'
          : activeTab === 'service' ? 'bg-green-900/20 border-green-700 text-green-300'
          : 'bg-slate-800 border-slate-700 text-slate-400'
        }`}>
          {activeTab === 'vehicle' && '🏍️ Vehicle Tax Invoice — गाड़ी बिक्री के invoices'}
          {activeTab === 'service' && '🔧 Service/Parts Tax Invoice — service के invoices'}
          {activeTab === 'all'     && `📋 सभी invoices — ${vehicleInvoices.length} Vehicle + ${serviceInvoices.length} Service`}
        </div>

        {/* SEARCH */}
        <div>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <Input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
              placeholder="Invoice #, Customer, Phone, Vehicle, Reg No..."
              className="pl-10 bg-slate-800 border-slate-600 text-white placeholder-slate-500"/>
          </div>
          <p className="text-slate-500 text-xs mt-1">{filtered.length} invoices</p>
        </div>

          <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 py-3">
            <CardTitle className="text-white text-base">
              {activeTab === 'vehicle' ? '🏍️ Vehicle Tax Invoices' : activeTab === 'service' ? '🔧 Service/Parts Invoices' : '📋 Invoice List'} ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400">कोई invoice नहीं।</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-700 border-b border-slate-600">
                    <tr>{['#','Invoice No','Type','Customer','Phone','Vehicle','Reg No','Date','Amount','Parts','Source','Actions'].map(h=>(
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-bold text-slate-300">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {paginatedInvs.map((inv,i) => {
                      const itemCount = (inv.items||inv.parts||[]).length;
                      const itype     = getInvoiceType(inv);
                      const rowIdx    = (currentPage-1)*INVOICES_PER_PAGE + i;
                      return (
                      <tr key={i} className={`border-b border-slate-700 hover:bg-slate-700/50 ${i%2===0?'':'bg-slate-800/30'}`}>
                        <td className="px-3 py-2 text-slate-500 text-xs">{rowIdx+1}</td>
                        <td className="px-3 py-2 text-white font-bold text-xs">#{inv.invoiceNumber||inv.id}</td>
                        <td className="px-3 py-2 text-xs">
                          {itype === 'vehicle'
                            ? <span className="bg-orange-900 text-orange-300 px-1.5 py-0.5 rounded font-bold">🏍️ Vehicle</span>
                            : <span className="bg-green-900 text-green-300 px-1.5 py-0.5 rounded font-bold">🔧 Service</span>
                          }
                        </td>
                        <td className="px-3 py-2 text-slate-200 text-xs font-medium">{inv.customerName||'—'}</td>
                        <td className="px-3 py-2 text-slate-400 text-xs">{inv.customerPhone||'—'}</td>
                        <td className="px-3 py-2 text-blue-300 text-xs">{inv.vehicle||'—'}</td>
                        <td className="px-3 py-2 text-slate-400 text-xs font-mono">{inv.regNo||'—'}</td>
                        <td className="px-3 py-2 text-slate-400 text-xs">{new Date(inv.invoiceDate||Date.now()).toLocaleDateString('en-IN')}</td>
                        <td className="px-3 py-2 text-green-400 font-bold text-xs">₹{(inv.totals?.totalAmount||inv.totalAmount||inv.amount||0).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${itemCount>0?'bg-blue-900 text-blue-300':'bg-slate-700 text-slate-500'}`}>{itemCount}</span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {inv.importedFrom
                            ? <span className="bg-yellow-900 text-yellow-300 px-1.5 py-0.5 rounded">📄 PDF</span>
                            : <span className="bg-blue-900 text-blue-300 px-1.5 py-0.5 rounded">📋 Manual</span>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1.5">
                            {/* ✅ FIXED: View button now opens PDF modal */}
                            <Button onClick={() => handleViewPDF(inv)}
                              className="bg-blue-600 hover:bg-blue-700 text-white h-7 px-2 text-xs flex items-center gap-1">
                              <Eye size={12}/> View PDF
                            </Button>
                            <Button onClick={()=>navigate(`/invoice/${inv.invoiceNumber||inv.id}`)}
                              className="bg-green-600 hover:bg-green-700 text-white h-7 px-2 text-xs flex items-center gap-1">
                              <FileText size={12}/> Edit
                            </Button>
                            <Button onClick={()=>handleDelete(inv.invoiceNumber||inv.id)}
                              className="bg-red-700 hover:bg-red-600 text-white h-7 px-2 text-xs">
                              <Trash2 size={12}/>
                            </Button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-700 border-t-2 border-slate-600">
                    <tr>
                      <td colSpan="8" className="px-3 py-2 text-slate-300 font-bold text-sm">TOTAL ({filtered.length})</td>
                      <td className="px-3 py-2 text-green-300 font-black text-sm">₹{filtered.reduce((s,i)=>s+(i.totals?.totalAmount||i.amount||0),0).toLocaleString('en-IN')}</td>
                      <td colSpan="3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-slate-700/50 border-t border-slate-600">
                <p className="text-xs text-slate-400">
                  Page <b className="text-white">{currentPage}</b> of <b className="text-white">{totalPages}</b> — {filtered.length} invoices
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1}
                    className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-4 text-xs disabled:opacity-40">
                    ◀ Previous
                  </Button>
                  <Button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages}
                    className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-4 text-xs disabled:opacity-40">
                    Next ▶
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ✅ PDF VIEWER MODAL */}
      {pdfModal.open && pdfModal.data && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="bg-slate-800 border-slate-700 max-w-4xl w-full max-h-[90vh] flex flex-col">
            <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 flex justify-between items-center py-3">
              <CardTitle className="text-white">
                📄 {pdfModal.data.invoiceNumber} - {pdfModal.data.customerName}
              </CardTitle>
              <Button 
                onClick={() => setPdfModal({ open: false, data: null })}
                className="bg-red-700 hover:bg-red-600 text-white h-8 px-3"
              >
                <X size={16} />
              </Button>
            </CardHeader>
            
            <CardContent className="flex-1 overflow-auto p-4">
              <div className="bg-slate-700 p-6 rounded-lg text-white">
                <h3 className="text-xl font-bold mb-4">📋 Invoice Details:</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-slate-400">Invoice No:</span> <span className="font-bold">{pdfModal.data.invoiceNumber}</span></div>
                  <div><span className="text-slate-400">Date:</span> <span className="font-bold">{new Date(pdfModal.data.invoiceDate).toLocaleDateString('en-IN')}</span></div>
                  <div><span className="text-slate-400">Type:</span> <span className="font-bold">{pdfModal.data.invoiceType === 'vehicle' ? '🏍️ Vehicle' : '🔧 Service'}</span></div>
                  <div><span className="text-slate-400">Customer:</span> <span className="font-bold">{pdfModal.data.customerName}</span></div>
                  <div><span className="text-slate-400">Vehicle:</span> <span className="font-bold">{pdfModal.data.vehicle || '—'}</span></div>
                  <div><span className="text-slate-400">Reg No:</span> <span className="font-bold">{pdfModal.data.regNo || '—'}</span></div>
                  <div><span className="text-slate-400">Amount:</span> <span className="font-bold text-green-400">₹{(pdfModal.data.totals?.totalAmount||pdfModal.data.amount||0).toLocaleString('en-IN')}</span></div>
                  <div><span className="text-slate-400">Parts:</span> <span className="font-bold">{(pdfModal.data.items||[]).length}</span></div>
                </div>

                {pdfModal.data.items && pdfModal.data.items.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-lg font-bold mb-3">Parts List:</h4>
                    <div className="bg-slate-800 p-3 rounded max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-600">
                            <th className="text-left py-1">Part No</th>
                            <th className="text-left py-1">Description</th>
                            <th className="text-center py-1">Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pdfModal.data.items.map((item, idx) => (
                            <tr key={idx} className="border-b border-slate-700">
                              <td className="py-1 font-mono">{item.partNo}</td>
                              <td className="py-1">{item.description}</td>
                              <td className="text-center py-1">{item.qty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <Button 
                  onClick={() => navigate(`/invoice/${pdfModal.data.invoiceNumber}`)}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold flex-1"
                >
                  ✏️ Edit Details
                </Button>
                <Button 
                  onClick={() => setPdfModal({ open: false, data: null })}
                  className="bg-slate-600 hover:bg-slate-700 text-white font-bold flex-1"
                >
                  ❌ Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}