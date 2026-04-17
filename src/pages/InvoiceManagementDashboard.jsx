import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Trash2, Download, ArrowLeft, Eye, FileText, FolderOpen, RefreshCw, Clock, X, Edit3 } from 'lucide-react';
import { api } from '../utils/apiConfig';

const getLS = (k, fb=[]) => { try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch{return fb;} };

// Extract PDF text via backend API
const extractPDFText = async (file) => {
  const formData = new FormData();
  formData.append('pdf', file);

  const res = await fetch(api('/api/parse-pdf'), {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Server error' }));
    throw new Error(err.error || 'PDF parse failed');
  }

  const data = await res.json();
  if (!data.text) throw new Error(data.error || 'No text extracted');

  console.log('📄 PDF extracted via backend, length:', data.text.length);
  return data.text;
};

// ════════════════════════════════════════════════════════════════
// VP HONDA INVOICE PARSER - IMPROVED
// ════════════════════════════════════════════════════════════════
const parseVPHondaInvoice = (text, filename) => {
  const flat = text.replace(/\n/g,' ').replace(/\s+/g,' ');
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);

  const find = (patterns, fb='') => {
    for (const p of patterns) {
      const m = flat.match(p) || text.match(p);
      if (m) return (m[1]||m[0]).trim();
    }
    return fb;
  };

  // Invoice No
  const invoiceNumber = find([
    /Invoice\s*No\s*[:-]+\s*(\d+)/i,
    /Invoice\s*#\s*(\d+)/i,
    /INV[- ](\d+)/i,
  ], String(Math.floor(Math.random()*900000+100000)));

  // Date
  const rawDate = find([
    /Invoice\s*Date\s*[:-]*\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
    /Date\s*[:-]\s*(\d{2}-\d{2}-\d{4})/i,
    /(\d{2}-\d{2}-\d{4})/,
  ]);
  let invoiceDate = new Date().toISOString().split('T')[0];
  if (rawDate) {
    try {
      const pts = rawDate.split(/[-\/]/);
      if (pts.length===3) {
        const yr = pts[2].length===2 ? '20'+pts[2] : pts[2];
        const d = new Date(`${yr}-${pts[1].padStart(2,'0')}-${pts[0].padStart(2,'0')}`);
        if (!isNaN(d)) invoiceDate = d.toISOString().split('T')[0];
      }
    } catch {}
  }

  // Customer name from filename
  let customerName = filename.replace(/\.pdf$/i,'').replace(/^[_\-\d]+/,'').replace(/[_\-]+/g,' ').trim().toUpperCase();
  if (!customerName || customerName.length < 2) customerName = 'Unknown';

  // ✅ PHONE - Improved extraction
  let customerPhone = '';
  const phonePatterns = [
    /Phone\s*\(M\)\s*[:-]?\s*([6-9]\d{9}(?:[\/\s][6-9]\d{9})?)/i,
    /Phone\s*\([MO]\)\s*[:-]?\s*([6-9]\d{9}(?:[\/\s][6-9]\d{9})?)/i,
    /Customer\s*Care\s*No[:-]?\s*([6-9]\d{9})/i,
    /\b([6-9]\d{9})\b/,
  ];
  for (const p of phonePatterns) {
    const m = flat.match(p);
    if (m) {
      customerPhone = m[1].replace(/\s+/g, '/');
      break;
    }
  }

  // Vehicle model
  const vehicle = find([
    /Model\s*No\s*[:-]*\s*([A-Z][A-Z0-9 ]{3,30}?)(?=\s+(?:Colour|Color|Engine|Frame|Jobcard|Service|Sale|Model\s*Code|Variant))/i,
    /(?:SP125|SHINE|Activa|Hornet|CB350|XF3R)\s*[A-Z0-9\-]{0,20}/i,
  ]);

  // ✅ REG NO - Fixed extraction (NOT engine number!)
  let regNo = '';
  const regPatterns = [
    /Veh(?:icle)?\s*Number\s*[:-]?\s*([A-Z]{2}\d{2}[A-Z]{1,3}\d{4})/i,
    /Registration\s*[:-]?\s*([A-Z]{2}\d{2}[A-Z]{1,3}\d{4})/i,
    /\b([A-Z]{2}\d{2}[A-Z]{1,3}\d{4})\b/,
  ];
  for (const p of regPatterns) {
    const m = flat.match(p);
    if (m) {
      const candidate = m[1];
      // Make sure it's not the engine number (which comes after "Engine No")
      const engineIdx = flat.indexOf('Engine No');
      const regIdx = flat.indexOf(candidate);
      if (engineIdx === -1 || regIdx < engineIdx) {
        regNo = candidate;
        break;
      }
    }
  }

  // Amount
  const rawTotal = find([
    /Total\s*Invoice\s*Value\s*\([Ii]n\s*[Ff]igure\)\s*[₹Rs.\s]*([\d,]+\.\d{2})/i,
    /Invoice\s*Value\(?[Ii]n\s*[Ff]igure\)?[₹Rs.\s]*([\d,]+\.\d{2})/i,
    /Total\s*[₹Rs.\s]+([\d,]+\.\d{2})/i,
  ]);
  const pdfTotal = parseFloat((rawTotal||'0').replace(/,/g,'')) || 0;

  // Tax
  const rawTax = find([/Total\s*Tax\s*Amount\s*[:-]?\s*[₹Rs.\s]*([\d,]+\.\d{2})/i]);
  const taxAmount = parseFloat((rawTax||'0').replace(/,/g,'')) || 0;

  // Parts extraction
  const items = [];
  const NOISE = /^(GSTIN|BCYPD|VPHONDA|STATE|PHONE|EMAIL|TOTAL|HSN|SAC|SGST|CGST|IGST)/i;
  const DESC_MAP = {
    '08233-2MA-F1LG1': 'ENGINE OIL 900ML 5W30',
    '15412-K0N-D01': 'FILTER OIL',
    '94109-12000': 'WASHER 12MM',
    '91307-KRM-840': 'O-RING 18X31',
    'CONSUM': 'CONSUMR CH',
  };

  // Extract parts from lines
  const allLines = text.split('\n').filter(l => /^\d+\s+[A-Z0-9\-]/.test(l.trim()));
  for (const line of allLines) {
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length >= 2 && !NOISE.test(parts[1])) {
      items.push({
        partNo: parts[1]?.slice(0,20) || 'PART',
        description: (DESC_MAP[parts[1]] || parts[2] || 'Service Item').slice(0,50),
        qty: 1,
        price: 0,
      });
    }
  }

  // Invoice type detection
  const isVehicle = /Vehicle|Purchase|Sale|Showroom|SHINE|SP125|Activa|Hornet/i.test(flat);
  const invoiceType = isVehicle ? 'vehicle' : 'service';

  return {
    invoiceNumber,
    invoiceType,
    invoiceDate,
    customerName,
    customerPhone,
    vehicle,
    regNo,
    items,
    amount: pdfTotal,
    tax: taxAmount,
    totals: { totalAmount: pdfTotal + taxAmount },
    importedFrom: filename,
    timestamp: new Date().toISOString(),
  };
};

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════

export default function InvoiceManagementDashboard() {
  const navigate = useNavigate();
  const vehicleInputRef = useRef(null);
  const serviceInputRef = useRef(null);
  
  const [invoices, setInvoices] = useState(() => getLS('invoices'));
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const INVOICES_PER_PAGE = 5;
  const [message, setMessage] = useState('');
  
  // ✅ NEW: PDF Modal
  const [pdfModal, setPdfModal] = useState({ open: false, data: null });

  useEffect(() => {
    localStorage.setItem('invoices', JSON.stringify(invoices));
  }, [invoices]);

  const getInvoiceType = (inv) => inv.invoiceType || (inv.serviceNumber ? 'service' : 'vehicle');

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

  // ✅ PDF Modal Handler
  const handleViewPDF = (inv) => {
    setPdfModal({ open: true, data: inv });
  };

  const handleFileSelect = async (files, type) => {
    if (!files.length) return;
    setLoading(true);
    setMessage('');

    const newInvoices = [];
    const errors = [];

    for (const file of files) {
      try {
        const text = await extractPDFText(file);
        const parsed = parseVPHondaInvoice(text, file.name);
        
        // ✅ Force type
        parsed.invoiceType = type;
        newInvoices.push(parsed);
      } catch (err) {
        console.error(`❌ ${file.name}:`, err.message);
        errors.push({ file: file.name, error: err.message });
      }
    }

    if (newInvoices.length > 0) {
      const existing = new Set(invoices.map(i => i.invoiceNumber));
      const unique = newInvoices.filter(i => !existing.has(i.invoiceNumber));
      const merged = [...unique, ...invoices].sort((a,b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));
      setInvoices(merged);
      setMessage(`✅ Imported ${unique.length} ${type} invoices${errors.length > 0 ? ` (${errors.length} errors)` : ''}`);
    } else if (errors.length > 0) {
      setMessage(`❌ ${errors.length} invoices failed`);
    }

    setLoading(false);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleClearType = (type) => {
    if (!window.confirm(`Delete all ${type} invoices?`)) return;
    const updated = invoices.filter(i => getInvoiceType(i) !== type);
    setInvoices(updated);
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

        {/* ✅ TWO SEPARATE IMPORT BUTTONS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-slate-800 border-slate-700 hover:border-orange-500 transition cursor-pointer">
            <label className="cursor-pointer block h-full">
              <input 
                ref={vehicleInputRef} 
                type="file" 
                accept=".pdf" 
                multiple
                onChange={e=>handleFileSelect(Array.from(e.target.files || []), 'vehicle')} 
                disabled={loading} 
                className="hidden"
              />
              <CardContent className="pt-6 pb-6">
                <div className="text-center">
                  <FileText className="mx-auto mb-3 text-orange-400" size={32}/>
                  <p className="text-white font-bold">🏍️ Import Vehicle PDF</p>
                  <p className="text-xs text-slate-400 mt-1">Vehicle Tax Invoice</p>
                </div>
              </CardContent>
            </label>
          </Card>

          <Card className="bg-slate-800 border-slate-700 hover:border-green-500 transition cursor-pointer">
            <label className="cursor-pointer block h-full">
              <input 
                ref={serviceInputRef} 
                type="file" 
                accept=".pdf" 
                multiple
                onChange={e=>handleFileSelect(Array.from(e.target.files || []), 'service')} 
                disabled={loading} 
                className="hidden"
              />
              <CardContent className="pt-6 pb-6">
                <div className="text-center">
                  <FileText className="mx-auto mb-3 text-green-400" size={32}/>
                  <p className="text-white font-bold">🔧 Import Service PDF</p>
                  <p className="text-xs text-slate-400 mt-1">Service/Parts Tax Invoice</p>
                </div>
              </CardContent>
            </label>
          </Card>
        </div>

        {/* ✅ TWO SEPARATE CLEAR BUTTONS */}
        <div className="flex gap-3">
          <Button onClick={() => handleClearType('vehicle')} className="bg-red-700 hover:bg-red-600 text-white font-bold">
            🗑️ Clear Vehicle ({vehicleInvoices.length})
          </Button>
          <Button onClick={() => handleClearType('service')} className="bg-red-700 hover:bg-red-600 text-white font-bold">
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
              <p className="text-xs text-slate-400">🏍️ Vehicle</p>
              <h3 className="text-3xl font-black text-orange-400 mt-1">{vehicleInvoices.length}</h3>
              <p className="text-xs text-slate-500 mt-1">₹{vehicleRev.toLocaleString('en-IN')}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-900/20 border-green-500">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-400">🔧 Service</p>
              <h3 className="text-3xl font-black text-green-400 mt-1">{serviceInvoices.length}</h3>
              <p className="text-xs text-slate-500 mt-1">₹{serviceRev.toLocaleString('en-IN')}</p>
            </CardContent>
          </Card>
        </div>

        {/* ✅ FILTER TABS */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id:'all',     label:`📋 सभी (${invoices.length})`,           col:'blue'   },
            { id:'vehicle', label:`🏍️ Vehicle (${vehicleInvoices.length})`, col:'orange' },
            { id:'service', label:`🔧 Service (${serviceInvoices.length})`,  col:'green'  },
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

        {/* INVOICE TABLE */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 py-3">
            <CardTitle className="text-white text-base">
              📋 Invoice List ({filtered.length})
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
                    <tr>{['#','Invoice No','Type','Customer','Phone','Vehicle','Reg No','Date','Amount','Parts','Actions'].map(h=>(
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-bold text-slate-300">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {paginatedInvs.map((inv,i) => {
                      const itemCount = (inv.items||[]).length;
                      const itype     = getInvoiceType(inv);
                      const rowIdx    = (currentPage-1)*INVOICES_PER_PAGE + i;
                      return (
                      <tr key={i} className={`border-b border-slate-700 hover:bg-slate-700/50 ${i%2===0?'':'bg-slate-800/30'}`}>
                        <td className="px-3 py-2 text-slate-500 text-xs">{rowIdx+1}</td>
                        <td className="px-3 py-2 text-white font-bold text-xs">#{inv.invoiceNumber}</td>
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
                        <td className="px-3 py-2 text-green-400 font-bold text-xs">₹{(inv.totals?.totalAmount||inv.amount||0).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${itemCount>0?'bg-blue-900 text-blue-300':'bg-slate-700 text-slate-500'}`}>{itemCount}</span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1.5">
                            {/* ✅ View PDF Modal */}
                            <Button onClick={() => handleViewPDF(inv)}
                              className="bg-blue-600 hover:bg-blue-700 text-white h-7 px-2 text-xs flex items-center gap-1">
                              <Eye size={12}/> PDF
                            </Button>
                            {/* ✅ Edit Details */}
                            <Button onClick={() => navigate(`/invoice/${inv.invoiceNumber}`)}
                              className="bg-green-600 hover:bg-green-700 text-white h-7 px-2 text-xs flex items-center gap-1">
                              <Edit3 size={12}/> Edit
                            </Button>
                            {/* Delete */}
                            <Button onClick={() => handleDelete(inv.invoiceNumber)}
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
                      <td colSpan="2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-slate-700/50 border-t border-slate-600">
                <p className="text-xs text-slate-400">
                  Page <b className="text-white">{currentPage}</b> of <b className="text-white">{totalPages}</b>
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
          <Card className="bg-slate-800 border-slate-700 max-w-2xl w-full max-h-[85vh] flex flex-col">
            <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 flex justify-between items-center py-3">
              <CardTitle className="text-white text-lg">
                📄 Invoice #{pdfModal.data.invoiceNumber}
              </CardTitle>
              <Button 
                onClick={() => setPdfModal({ open: false, data: null })}
                className="bg-red-700 hover:bg-red-600 text-white h-8 px-3"
              >
                <X size={16} />
              </Button>
            </CardHeader>
            
            <CardContent className="flex-1 overflow-y-auto p-4">
              <div className="bg-slate-700 p-4 rounded-lg text-white space-y-3">
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-400">Invoice No:</span> <span className="font-bold">#{pdfModal.data.invoiceNumber}</span></div>
                  <div><span className="text-slate-400">Type:</span> <span className="font-bold">{getInvoiceType(pdfModal.data) === 'vehicle' ? '🏍️ Vehicle' : '🔧 Service'}</span></div>
                  <div><span className="text-slate-400">Customer:</span> <span className="font-bold">{pdfModal.data.customerName}</span></div>
                  <div><span className="text-slate-400">Phone:</span> <span className="font-bold text-green-300">{pdfModal.data.customerPhone || '—'}</span></div>
                  <div><span className="text-slate-400">Vehicle:</span> <span className="font-bold">{pdfModal.data.vehicle || '—'}</span></div>
                  <div><span className="text-slate-400">Reg No:</span> <span className="font-bold text-orange-300">{pdfModal.data.regNo || '—'}</span></div>
                  <div><span className="text-slate-400">Date:</span> <span className="font-bold">{new Date(pdfModal.data.invoiceDate).toLocaleDateString('en-IN')}</span></div>
                  <div><span className="text-slate-400">Amount:</span> <span className="font-bold text-green-400">₹{(pdfModal.data.totals?.totalAmount||pdfModal.data.amount||0).toLocaleString('en-IN')}</span></div>
                </div>

                {pdfModal.data.items && pdfModal.data.items.length > 0 && (
                  <div>
                    <h4 className="font-bold mb-2">Parts/Items ({pdfModal.data.items.length}):</h4>
                    <div className="bg-slate-800 p-3 rounded max-h-40 overflow-y-auto">
                      {pdfModal.data.items.map((item, idx) => (
                        <div key={idx} className="text-xs py-1 border-b border-slate-600">
                          <span className="text-slate-300">{idx+1}. </span>
                          <span className="font-mono text-yellow-300">{item.partNo}</span>
                          <span className="text-slate-400 ml-2">{item.description}</span>
                        </div>
                      ))}
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
