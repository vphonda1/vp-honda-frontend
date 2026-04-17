import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Trash2, Download, ArrowLeft, Eye, FileText, FolderOpen, RefreshCw, Clock } from 'lucide-react';
import { api } from '../utils/apiConfig';

// ── NO pdfjs-dist needed! PDF parsing happens on backend (Node.js) ──────────
// Backend route: POST /api/invoices/parse-pdf (see pdfRoutes.js)

const getLS = (k, fb=[]) => { try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch{return fb;} };

// Extract PDF text via backend API — zero browser worker issues
const extractPDFText = async (file) => {
  const formData = new FormData();
  formData.append('pdf', file);

  // ✅ FIXED: Changed endpoint from /api/parse-pdf to /api/invoices/parse-pdf
  const res = await fetch(api('/api/invoices/parse-pdf'), {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Server error' }));
    throw new Error(err.error || 'PDF parse failed');
  }

  const data = await res.json();
  
  // ✅ FIXED: Response now has structure { success: true, invoice: {...}, extractionMethod: '...' }
  if (!data.invoice) throw new Error(data.error || 'No invoice extracted');

  console.log('📄 PDF extracted via backend, invoice:', data.invoice.invoiceNumber);
  return data.invoice; // Return full invoice object, not just text
};

// ═══════════════════════════════════════════════════════════════════════════
// VP HONDA INVOICE PARSER
// ═══════════════════════════════════════════════════════════════════════════
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

  // Customer name — filename is most reliable (e.g. _522_SANJAY_JATAV.pdf)
  let customerName = '';
  // Step 1: Extract from filename (remove invoice number, underscores, .pdf)
  const fnClean = filename.replace(/\.pdf$/i,'').replace(/^[_\d]+/,'').replace(/[_]+/g,' ').trim();
  if (fnClean && fnClean.length > 2 && !/^unknown$/i.test(fnClean)) {
    customerName = fnClean.toUpperCase();
  }
  // Step 2: If filename didn't work, try Leagal Name from PDF (skip V P HONDA / Dealer Name)
  if (!customerName) {
    const allLN = [];
    const lnRe = /Leagal\s*Name\s*[:-]*\s*([A-Z][A-Z ]{2,50}?)(?=\s+(?:Address|Father|Phone|Dist|City|State|PIN|Email|Aadhar|PAN|GSTIN|Customer))/gi;
    let lnM;
    while ((lnM = lnRe.exec(flat)) !== null) allLN.push(lnM[1].trim());
    customerName = allLN.find(n => !/V\s*P\s*HONDA|DEALER|VPHONDA/i.test(n)) || '';
  }
  if (!customerName) customerName = 'Unknown';

  // Phone
  const customerPhone = find([
    /Phone\s*\(M\)\s*[:-]?\s*([6-9]\d{9})/i,
    /\b([6-9]\d{9})\b/,
  ]);

  // Vehicle model — "Model No : SP125 DLX DISK"
  const vehicle = find([
    /Model\s*No\s*[:-]*\s*([A-Z][A-Z0-9 ]{3,30}?)(?=\s+(?:Colour|Color|Engine|Frame|Jobcard|Service|Sale|Model\s*Code))/i,
    /(?:Activa|Shine|Hornet|SP\s*125|CB\d|NXR|Dio|Grazia|Unicorn|Livo|Dream)\s*[A-Z0-9 ]{0,20}/i,
  ]);

  // Reg No — "Veh Number :- MP04WA9535"
  const regNo = find([
    /Veh(?:icle)?\s*Number\s*[:-]+\s*([A-Z]{2}\s*\d{2}\s*[A-Z]{1,3}\s*\d{4})/i,
    /\b([A-Z]{2}\d{2}[A-Z]{1,3}\d{4})\b/,
  ]);

  const frameNo  = find([/Frame\s*No\s*[:-]*\s*([A-Z0-9]{10,})/i]);
  const engineNo = find([/Engine\s*No\s*[:-]*\s*([A-Z0-9]{10,})/i]);
  const paymentMode = find([/Payment\s*Mode\s*[:-]*\s*(CASH|FINANCE|CHEQUE|UPI|NEFT|DD)/i], 'CASH');
  
  // Service details
  const serviceKm = find([/Service\s*KM\s*[:-]*\s*(\d{1,6})/i]);
  const serviceType = find([/Service\s*Type\s*[:-]*\s*(FREE|PAID)/i]);
  let serviceNumber = '';
  const svcM = flat.match(/(\d+)\s*(?:st|nd|rd|th)\s*Service/i);
  if (svcM) serviceNumber = svcM[1];
  if (!serviceNumber) { const smh = flat.match(/SMH\s*\/\s*(\d+)/i); if (smh) serviceNumber = smh[1]; }

  // Total — "Total Invoice Value(In Figure) ₹ 861.00"
  const rawTotal = find([
    /Total\s*Invoice\s*Value\s*\([Ii]n\s*[Ff]igure\)\s*[₹Rs.\s]*([\d,]+\.\d{2})/i,
    /Total\s*Invoice\s*Value[^₹]*[₹]\s*([\d,]+\.\d{2})/i,
    /Invoice\s*Value\(?[Ii]n\s*[Ff]igure\)?[₹Rs.\s]*([\d,]+\.\d{2})/i,
    /Grand\s*Total[^₹]*[₹]\s*([\d,]+\.\d{2})/i,
    /Total\s*Parts\s*Amount[^₹]*[₹]\s*([\d,]+\.\d{2})/i,
    /₹\s*([\d,]+\.\d{2})\s*Total\s*Labour/i,
  ]);
  const pdfTotal = parseFloat((rawTotal||'0').replace(/,/g,'')) || 0;

  // fallbackTotal removed — unreliable

  const rawTax = find([
    /Total\s*Tax\s*Amount\s*[:-]?\s*[₹Rs.\s]*([\d,]+\.\d{2})/i,
    
  ]);
  const taxAmount = parseFloat((rawTax||'0').replace(/,/g,'')) || 0;

  // ── Parts extraction — VP Honda Invoice format ───────────────────────────────
  // PDF table: SrNo PartNo HSN MRP MRPdisc% ₹UnitPrice Qty UoM ₹TotalAmt Disc% ₹DiscAmt ₹TaxableAmt
  // Descriptions appear separately in PDF — use lookup
  const items = [];
  
  const NOISE = /^(GSTIN|BCYPD|VPHONDA|STATE|PHONE|EMAIL|ADDRES|NARSIN|PARWAL|BHOPAL|JHIRNI|CICPJ|PRINT|SCAN|Total|HSN|SAC|SGST|CGST|IGST|Cess|Rate|Amou)/i;

  // Honda part description lookup (common service parts)
  const DESC_MAP = {
    '08233-2MA-F1LG1': 'ENGINE OIL ILIN 900ML 5W30MA',
    '08233-2MB-F0LG1': 'ENGINE OIL 600ML 5W30MA', 
    '15412-K0N-D01':   'FILTER COMP ENGINE OIL',
    '17220-K0N-D00':   'ELEMENT COMP AIR CLEANER',
    '94109-12000':     'WASHER 12MM DRAIN',
    '91307-KRM-840':   'O-RING 18X31',
    '06455-KYJ-930':   'PAD SET FR',
    '06435-KYJ-930':   'SHOE SET RR BRAKE',
    'P05':             'NO. PLATE COVER',
    'P05 (B)':         'NO. PLATE COVER',
    'CONSUM':          'CONSUMR CH',
  };

  // Extract part numbers (PartNo appears after "Sr" column)
  const partNumPattern = /^([0-9]{5}-[A-Z0-9\-]+|[A-Z]+)\s+(.{0,30}?)\s+([\d,]{1,6}\.?\d{0,2})\s+/gm;
  const foundParts = [];
  let m;
  while ((m = partNumPattern.exec(flat)) !== null) {
    if (!NOISE.test(m[1])) {
      foundParts.push({
        partNo: m[1],
        desc: (DESC_MAP[m[1]] || m[2] || '').slice(0, 50),
      });
    }
  }

  // Build item list
  if (foundParts.length > 0) {
    foundParts.forEach((p, i) => {
      items.push({
        partNo: p.partNo,
        description: p.desc,
        qty: 1,
        price: 0,
        amount: 0,
      });
    });
  }

  const invoiceType = /Service|1st|2nd|3rd|Jobcard|SMH|Service KM|Free|Paid/i.test(flat) ? 'service' : 'vehicle';

  return {
    invoiceNumber,
    invoiceType,
    invoiceDate,
    customerName,
    customerPhone,
    vehicle,
    regNo,
    frameNo,
    engineNo,
    paymentMode,
    serviceKm,
    serviceType,
    serviceNumber,
    items,
    amount: pdfTotal,
    tax: taxAmount,
    totals: { totalAmount: pdfTotal + taxAmount },
    importedFrom: filename,
    timestamp: new Date().toISOString(),
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

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

  // Save to localStorage whenever invoices change
  useEffect(() => {
    localStorage.setItem('invoices', JSON.stringify(invoices));
  }, [invoices]);

  // Categorize invoices
  const getInvoiceType = (inv) => inv.invoiceType || (inv.serviceNumber || inv.serviceKm || inv.serviceType ? 'service' : 'vehicle');

  const vehicleInvoices = invoices.filter(inv => getInvoiceType(inv) === 'vehicle');
  const serviceInvoices = invoices.filter(inv => getInvoiceType(inv) === 'service');

  // Filter by tab and search
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

  // Totals
  const totalRev = invoices.reduce((s,i) => s + (i.totals?.totalAmount || i.amount || 0), 0);
  const vehicleRev = vehicleInvoices.reduce((s,i) => s + (i.totals?.totalAmount || i.amount || 0), 0);
  const serviceRev = serviceInvoices.reduce((s,i) => s + (i.totals?.totalAmount || i.amount || 0), 0);

  // ────────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ────────────────────────────────────────────────────────────────────────────

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
        
        // ✅ FIXED: Now receives full invoice from backend
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
      // Remove duplicates
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

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────

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
          {activeTab === 'vehicle' && '🏍️ Vehicle Tax Invoice — गाड़ी बिक्री के invoices (amount > ₹50,000 या Sale Date वाले)'}
          {activeTab === 'service' && '🔧 Service/Parts Tax Invoice — service, oil change, spare parts के invoices (Jobcard / 1st Service आदि)'}
          {activeTab === 'all'     && `📋 सभी invoices दिख रहे हैं — ${vehicleInvoices.length} Vehicle + ${serviceInvoices.length} Service`}
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
                            <Button onClick={()=>navigate(`/invoice/${inv.invoiceNumber||inv.id}`)}
                              className="bg-blue-600 hover:bg-blue-700 text-white h-7 px-2 text-xs flex items-center gap-1">
                              <Eye size={12}/> View
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
    </div>
  );
}