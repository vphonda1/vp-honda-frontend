import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Trash2, Download, ArrowLeft, Eye, FileText, FolderOpen, RefreshCw, Clock } from 'lucide-react';
import { api } from '../utils/apiConfig';

const getLS = (k, fb=[]) => { try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch{return fb;} };

const extractPDFText = async (file) => {
  const formData = new FormData(); formData.append('pdf', file);
  const res = await fetch(api('/api/parse-pdf'), { method: 'POST', body: formData });
  if (!res.ok) throw new Error(await res.json().then(d=>d.error).catch(()=>'Server error'));
  const data = await res.json();
  if (!data.text) throw new Error('No text extracted');
  return data.text;
};

// ================== VP HONDA INVOICE PARSER (FIXED FOR VEHICLE & SERVICE) ==================
const parseVPHondaInvoice = (text, filename) => {
  const flat = text.replace(/\n/g,' ').replace(/\s+/g,' ');
  const find = (patterns, fb='') => { for (const p of patterns) { const m = flat.match(p) || text.match(p); if (m) return (m[1]||m[0]).trim(); } return fb; };
  
  // --- Basic fields ---
  const invoiceNumber = find([/Invoice\s*No[:\-]*\s*(\d+)/i, /Invoice\s*#\s*(\d+)/i], String(Math.floor(Math.random()*900000+100000)));
  let rawDate = find([/Invoice\s*Date[:\-]*\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i, /Date\s*[:-]\s*(\d{2}-\d{2}-\d{4})/i]);
  let invoiceDate = new Date().toISOString().split('T')[0];
  if (rawDate) {
    try { const pts = rawDate.split(/[-\/]/); if(pts.length===3){ let y=pts[2].length===2?'20'+pts[2]:pts[2]; let d=new Date(`${y}-${pts[1].padStart(2,'0')}-${pts[0].padStart(2,'0')}`); if(!isNaN(d)) invoiceDate=d.toISOString().split('T')[0]; } } catch(e){}
  }
  
  // --- RegNo (primary key) ---
  let regNo = find([
    /Veh\s*Number[:\-]*\s*([A-Z]{2}\s*\d{2}\s*[A-Z]{1,3}\s*\d{4})/i,
    /Reg\s*No[:\-]*\s*([A-Z]{2}\d{2}[A-Z]{1,3}\d{4})/i,
    /MP\d{2}[A-Z]{1,3}\d{4}/,
    /Registration\s*No[:\-]*\s*([A-Z0-9]{9,})/i,
  ]);
  if (!regNo) {
    const mpMatch = flat.match(/(MP\d{2}[A-Z]{1,3}\d{4})/);
    if (mpMatch) regNo = mpMatch[1];
  }
  regNo = (regNo || '').toUpperCase().replace(/\s/g, '');
  
  // --- Customer name from filename or PDF ---
  let customerName = filename.replace(/\.pdf$/i,'').replace(/^[_\d]+/,'').replace(/[_]+/g,' ').trim();
  if (!customerName || customerName.length<3) customerName = find([/Customer\s*Name[:\-]*\s*([A-Z][A-Z ]{2,30})/i]) || 'Unknown';
  const customerPhone = find([/Phone[:\-]*\s*([6-9]\d{9})/i, /Mobile[:\-]*\s*([6-9]\d{9})/i]);
  const vehicle = find([
    /Model\s*No[:\-]*\s*([A-Z][A-Z0-9 ]{3,40})/i,
    /(?:Activa|Shine|Hornet|SP\s*125|CB\d|NXR|Dio|Grazia|Unicorn|Livo|Dream)\s*[A-Z0-9 ]{0,30}/i,
  ]);
  const frameNo = find([/Frame\s*No[:\-]*\s*([A-Z0-9]{10,})/i]);
  const engineNo = find([/Engine\s*No[:\-]*\s*([A-Z0-9]{10,})/i]);
  const paymentMode = find([/Payment\s*Mode[:\-]*\s*(CASH|FINANCE|CHEQUE|UPI)/i], 'CASH');
  
  // --- Service specific ---
  const serviceKm = find([/Service\s*KM[:\-]*\s*(\d{1,6})/i]);
  let serviceNumber = 0;
  const svcMatch = flat.match(/(\d+)(?:st|nd|rd|th)\s+Service/i);
  if(svcMatch) serviceNumber = parseInt(svcMatch[1]);
  else { const smh = flat.match(/SMH\s*\/\s*(\d+)/i); if(smh) serviceNumber = parseInt(smh[1]); }
  const serviceType = find([/Service\s*Type[:\-]*\s*(FREE|PAID)/i]);
  
  // --- Totals from PDF ---
  const rawTotal = find([/Total\s*Invoice\s*Value[^₹]*₹\s*([\d,]+\.\d{2})/i, /Grand\s*Total[^₹]*₹\s*([\d,]+\.\d{2})/i]);
  const pdfTotal = parseFloat((rawTotal||'0').replace(/,/g,'')) || 0;
  const rawGST = find([/Total\s*GST\s*Amount[^₹]*₹\s*([\d,]+\.\d{2})/i, /GST[^₹]*₹\s*([\d,]+\.\d{2})/i]);
  const pdfGST = parseFloat((rawGST||'0').replace(/,/g,'')) || 0;
  
  // --- Detect Invoice Type (Vehicle vs Service) ---
  const hasPartTable = /Part\s*No|Description|Qty|MRP|Taxable\s*Amt/i.test(flat);
  const hasSaleKeywords = /Sale\s*Date|Selling\s*Dealer|HMSI|Ex-Showroom|RTO|Registration/i.test(flat);
  const highAmount = pdfTotal > 50000;
  let invoiceType = 'service';
  if (hasSaleKeywords || (highAmount && !hasPartTable)) invoiceType = 'vehicle';
  if (/VEHICLE|TAX\s*INVOICE|SALE/i.test(filename)) invoiceType = 'vehicle';
  
  // --- Parts extraction (only for service invoices) ---
  let items = [];
  if (invoiceType === 'service') {
    const rowPattern = /(\d{5,}[\w\-]+|\d{3,}[\w\-]+)\s+([A-Z][A-Z\s\/\-\.]+?)\s+(\d+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})(?:\s+([\d,]+\.\d{2}))?/g;
    let match;
    while ((match = rowPattern.exec(flat)) !== null) {
      const partNo = match[1].trim();
      const description = match[2].trim();
      const qty = parseInt(match[3]) || 1;
      const mrp = parseFloat(match[4].replace(/,/g,'')) || 0;
      const taxableAmt = parseFloat(match[5].replace(/,/g,'')) || 0;
      let gstAmount = match[6] ? parseFloat(match[6].replace(/,/g,'')) : 0;
      let gstRate = 0;
      if (taxableAmt > 0 && gstAmount > 0) gstRate = Math.round((gstAmount / taxableAmt) * 100);
      else if (/CONSUM|OIL|WASHER/i.test(description)) gstRate = 0;
      else gstRate = 18;
      items.push({ partNo, description, qty, mrp, taxableAmt, gstAmount, gstRate, total: taxableAmt });
    }
    if (items.length === 0) {
      const simple = /([A-Z0-9]{5,}[\-]?[A-Z0-9]+)\s+([A-Z][A-Z\s\/]+?)\s+(\d+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/g;
      let m; while((m=simple.exec(flat))) items.push({ partNo:m[1], description:m[2].trim(), qty:parseInt(m[3])||1, mrp:parseFloat(m[4].replace(/,/g,''))||0, taxableAmt:parseFloat(m[5].replace(/,/g,''))||0, gstRate:18, gstAmount:0, total:parseFloat(m[5].replace(/,/g,''))||0 });
    }
  }
  
  // Calculate totals
  let subtotal = items.reduce((s,i)=>s+(i.taxableAmt||0),0);
  let gstAmount = items.reduce((s,i)=>s+(i.gstAmount||0),0);
  let finalTotal = subtotal + gstAmount;
  if (pdfTotal > 0) finalTotal = pdfTotal;
  if (pdfGST > 0) gstAmount = pdfGST;
  if (finalTotal > 0 && gstAmount > 0) subtotal = finalTotal - gstAmount;
  const gstRate = subtotal > 0 ? Math.round((gstAmount/subtotal)*100) : 0;
  
  return {
    invoiceNumber, invoiceDate, customerName: customerName.slice(0,60), customerPhone, vehicle,
    regNo, frameNo, engineNo, paymentMode, serviceKm: serviceKm?parseInt(serviceKm):null,
    serviceNumber: serviceNumber||null, serviceType: serviceType||'', items, parts: items,
    totals: { subtotal, gstRate, gstAmount, totalAmount: finalTotal },
    invoiceType, importedFrom: filename, importedAt: new Date().toISOString(), status: 'Active'
  };
};

const exportInvoicesAsPDF = (invoices) => {
  const total = invoices.reduce((s,i)=>s+(i.totals?.totalAmount||i.amount||0),0);
  const html = `<!DOCTYPE html><html><head><title>VP Honda Invoices</title><style>body{font-family:Arial;font-size:11px;margin:20px}h2{color:#1a3a8a}table{width:100%;border-collapse:collapse;margin-top:8px}th{background:#1a3a8a;color:white;padding:5px 7px;text-align:left;font-size:10px}td{border-bottom:1px solid #e5e7eb;padding:4px 7px}tr:nth-child(even){background:#f9fafb}.total{background:#1a3a8a;color:white;font-weight:bold}.footer{margin-top:12px;font-size:9px;color:#6b7280;text-align:center}</style></head><body><h2>🏍️ VP Honda — Invoice Report</h2><p style="color:#6b7280;font-size:10px">Generated: ${new Date().toLocaleString('en-IN')} | ${invoices.length} invoices | ₹${total.toLocaleString('en-IN')}</p><table><tr><th>#</th><th>Invoice No</th><th>Customer</th><th>Phone</th><th>Vehicle</th><th>Reg No</th><th>Date</th><th>Amount</th><th>Parts</th><th>Source</th></tr>${invoices.map((inv,i)=>`<tr><td>${i+1}</td><td><b>#${inv.invoiceNumber||inv.id}</b></td><td>${inv.customerName||'—'}</td><td>${inv.customerPhone||'—'}</td><td>${inv.vehicle||'—'}</td><td>${inv.regNo||'—'}</td><td>${new Date(inv.invoiceDate||Date.now()).toLocaleDateString('en-IN')}</td><td><b>₹${(inv.totals?.totalAmount||inv.amount||0).toLocaleString('en-IN')}</b></td><td>${(inv.items||inv.parts||[]).length}</td><td>${inv.importedFrom?'PDF':'Manual'}</td></tr>`).join('')}<tr class="total"><td colspan="7">TOTAL</td><td>₹${total.toLocaleString('en-IN')}</td><td colspan="2"></td></tr></td><div class="footer">VP Honda Dealership, Bhopal</div></body></html>`;
  const w = window.open('','_blank'); w.document.write(html); w.document.close(); setTimeout(()=>w.print(), 500);
};

export default function InvoiceManagementDashboard() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current:0, total:0 });
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const INVOICES_PER_PAGE = 5;
  const intervalRef = useRef(null);

  useEffect(() => {
    loadInvoices();
    const fn = () => loadInvoices();
    window.addEventListener('storage', fn);
    intervalRef.current = setInterval(fn, 30000);
    return () => { window.removeEventListener('storage', fn); clearInterval(intervalRef.current); };
  }, []);

  const loadInvoices = async () => {
    let dbInv = [];
    try { const res = await fetch(api('/api/invoices')); if (res.ok) dbInv = await res.json(); } catch(e) {}
    const lsInv = getLS('invoices');
    const all = [...dbInv, ...lsInv];
    const seen = new Set();
    const unique = all.filter(i => { const k = i.invoiceNumber||i.id||i._id; if(seen.has(k)) return false; seen.add(k); return true; })
      .sort((a,b)=>new Date(b.importedAt||b.invoiceDate||b.date||0) - new Date(a.importedAt||a.invoiceDate||a.date||0));
    setInvoices(unique);
    setLastRefresh(new Date());
    setLoading(false);
  };

  const processPDFFiles = async (files, expectedType = 'both') => {
    if (!files.length) return;
    setImporting(true);
    setProgress({ current:0, total:files.length });
    const existing = getLS('invoices', []);
    const added = [], errors = [];
    for (let i=0; i<files.length; i++) {
      const file = files[i];
      setProgress({ current:i+1, total:files.length });
      if (file.type !== 'application/pdf') continue;
      try {
        const text = await extractPDFText(file);
        const parsed = parseVPHondaInvoice(text, file.name);
        if (expectedType !== 'both' && parsed.invoiceType !== expectedType) {
          console.log(`Skipping ${file.name} (type ${parsed.invoiceType}) not ${expectedType}`);
          continue;
        }
        added.push(parsed);
      } catch (err) {
        console.error(`❌ ${file.name} Error:`, err);
        errors.push(file.name + ': ' + err.message);
      }
    }
    const newInvoices = [...added, ...existing];
    localStorage.setItem('invoices', JSON.stringify(newInvoices));
    // Update serviceData (based on regNo)
    const svcData = getLS('customerServiceData', {});
    for (const inv of added) {
      const reg = inv.regNo;
      if (!reg) continue;
      if (!svcData[reg]) svcData[reg] = {};
      const s = svcData[reg];
      s.customerName = inv.customerName;
      s.phone = inv.customerPhone;
      s.vehicle = inv.vehicle;
      s.regNo = reg;
      if (inv.invoiceType === 'vehicle') {
        s.purchaseDate = inv.invoiceDate;
        s.purchaseInvoice = inv.invoiceNumber;
      } else {
        const sn = inv.serviceNumber;
        if (sn === 1) { s.firstServiceDate = inv.invoiceDate; s.firstServiceKm = inv.serviceKm; }
        if (sn === 2) { s.secondServiceDate = inv.invoiceDate; s.secondServiceKm = inv.serviceKm; }
        if (sn === 3) { s.thirdServiceDate = inv.invoiceDate; s.thirdServiceKm = inv.serviceKm; }
        if (sn === 4) { s.fourthServiceDate = inv.invoiceDate; s.fourthServiceKm = inv.serviceKm; }
        if (sn === 5) { s.fifthServiceDate = inv.invoiceDate; s.fifthServiceKm = inv.serviceKm; }
        if (sn) { s.lastServiceDate = inv.invoiceDate; s.lastServiceKm = inv.serviceKm; s.lastServiceNumber = sn; }
        if (!s.serviceHistory) s.serviceHistory = [];
        s.serviceHistory.push({ number: sn, date: inv.invoiceDate, km: inv.serviceKm, type: inv.serviceType, invoiceNo: inv.invoiceNumber, parts: inv.items.length, total: inv.totals.totalAmount });
      }
    }
    localStorage.setItem('customerServiceData', JSON.stringify(svcData));
    // Save to MongoDB
    for (const inv of added) {
      try { await fetch(api('/api/invoices'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inv) }); } catch(e) {}
    }
    window.dispatchEvent(new Event('storage'));
    setImporting(false); setProgress({ current:0, total:0 });
    loadInvoices();
    setMessage(errors.length ? `✅ ${added.length-errors.length} imported | ⚠️ ${errors.length} errors` : `✅ ${added.length} PDFs imported!`);
    setTimeout(()=>setMessage(''), 6000);
  };

  const handleVehicleFile = () => { const i=document.createElement('input'); i.type='file'; i.accept='.pdf'; i.multiple=true; i.onchange=e=>processPDFFiles(Array.from(e.target.files), 'vehicle'); i.click(); };
  const handleServiceFile = () => { const i=document.createElement('input'); i.type='file'; i.accept='.pdf'; i.multiple=true; i.onchange=e=>processPDFFiles(Array.from(e.target.files), 'service'); i.click(); };
  
  // ----- Clear only Vehicle Invoices -----
  const clearVehicleInvoices = async () => {
    const pwd = prompt('Admin password:');
    if (pwd !== 'vphonda@123') { alert('❌ गलत password!'); return; }
    const vehicleCount = invoices.filter(i => i.invoiceType === 'vehicle').length;
    if (!window.confirm(`⚠️ ${vehicleCount} Vehicle Invoices DELETE होंगे (localStorage + MongoDB)!`)) return;
    const remaining = invoices.filter(i => i.invoiceType !== 'vehicle');
    localStorage.setItem('invoices', JSON.stringify(remaining));
    // Also update serviceData: remove vehicle-related entries? Keep as is (serviceData may still have purchaseDate etc, but it's okay)
    await syncInvoicesToMongo(remaining);
    loadInvoices();
    setMessage(`✅ ${vehicleCount} Vehicle invoices cleared!`);
    setTimeout(()=>setMessage(''), 4000);
  };
  
  // ----- Clear only Service Invoices -----
  const clearServiceInvoices = async () => {
    const pwd = prompt('Admin password:');
    if (pwd !== 'vphonda@123') { alert('❌ गलत password!'); return; }
    const serviceCount = invoices.filter(i => i.invoiceType === 'service').length;
    if (!window.confirm(`⚠️ ${serviceCount} Service Invoices DELETE होंगे (localStorage + MongoDB)!`)) return;
    const remaining = invoices.filter(i => i.invoiceType !== 'service');
    localStorage.setItem('invoices', JSON.stringify(remaining));
    await syncInvoicesToMongo(remaining);
    loadInvoices();
    setMessage(`✅ ${serviceCount} Service invoices cleared!`);
    setTimeout(()=>setMessage(''), 4000);
  };
  
  // Helper to sync invoices array to MongoDB (bulk replace)
  const syncInvoicesToMongo = async (invList) => {
    try {
      const res = await fetch(api('/api/invoices/sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoices: invList })
      });
      if (!res.ok) console.error('MongoDB sync failed');
    } catch(e) { console.error(e); }
  };
  
  const handleDelete = async (no) => {
    if (!window.confirm('Delete this invoice?')) return;
    const invToDelete = invoices.find(i=>String(i.invoiceNumber||i.id)===String(no));
    if (invToDelete && invToDelete._id) {
      try { await fetch(api(`/api/invoices/${invToDelete._id}`), { method: 'DELETE' }); } catch(e) {}
    }
    const upd = invoices.filter(i=>String(i.invoiceNumber||i.id)!==String(no));
    localStorage.setItem('invoices', JSON.stringify(upd));
    loadInvoices(); setMessage('✅ Deleted!'); setTimeout(()=>setMessage(''),2000);
  };

  const filtered = invoices.filter(inv => {
    if (activeTab === 'vehicle' && inv.invoiceType !== 'vehicle') return false;
    if (activeTab === 'service' && inv.invoiceType !== 'service') return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (inv.invoiceNumber+'').includes(s) || (inv.customerName||'').toLowerCase().includes(s) ||
             (inv.customerPhone||'').includes(s) || (inv.vehicle||'').toLowerCase().includes(s) ||
             (inv.regNo||'').includes(s);
    }
    return true;
  });
  const vehicleInvoices = invoices.filter(i => i.invoiceType === 'vehicle');
  const serviceInvoices = invoices.filter(i => i.invoiceType === 'service');
  const totalRev = invoices.reduce((s,i)=>s+(i.totals?.totalAmount||i.amount||0),0);
  const vehicleRev = vehicleInvoices.reduce((s,i)=>s+(i.totals?.totalAmount||i.amount||0),0);
  const serviceRev = serviceInvoices.reduce((s,i)=>s+(i.totals?.totalAmount||i.amount||0),0);
  const totalPages = Math.ceil(filtered.length / INVOICES_PER_PAGE);
  const paginated = filtered.slice((currentPage-1)*INVOICES_PER_PAGE, currentPage*INVOICES_PER_PAGE);

  if (loading) return <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center"><div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto"/></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <Button onClick={()=>navigate('/reminders')} className="bg-red-700 hover:bg-red-600 text-white font-bold flex items-center gap-2"><ArrowLeft size={18}/> Back</Button>
          <div className="text-center"><h1 className="text-2xl font-bold text-white">📋 Invoice Management Dashboard</h1><p className="text-slate-400 text-xs flex items-center justify-center gap-1 mt-1"><Clock size={11}/> {lastRefresh.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</p></div>
          <Button onClick={loadInvoices} className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2"><RefreshCw size={16}/> Refresh</Button>
        </div>
        {message && <Card className={`${message.includes('✅')?'bg-green-900/20 border-green-500':'bg-red-900/20 border-red-500'}`}><CardContent className="pt-4 pb-4"><p className={`font-bold text-sm ${message.includes('✅')?'text-green-300':'text-red-400'}`}>{message}</p></CardContent></Card>}
        {importing && <Card className="bg-blue-900/30 border-blue-500"><CardContent className="pt-4 pb-4"><div className="flex items-center gap-3"><div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0"/><div className="flex-1"><p className="text-blue-300 font-bold text-sm">PDF import: {progress.current}/{progress.total}</p><p className="text-blue-500 text-xs">PDF → text → VP Honda parse → save</p><div className="h-2 bg-slate-700 rounded-full mt-2"><div className="h-2 bg-blue-500 rounded-full transition-all" style={{width:`${progress.total?progress.current/progress.total*100:0}%`}}/></div></div></div></CardContent></Card>}
        
        {/* Navigation Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button onClick={()=>navigate('/reminders')} className="bg-gradient-to-r from-orange-600 to-orange-700 text-white font-bold py-3">🔔 Reminders</Button>
          <Button onClick={()=>navigate('/customer-data-manager')} className="bg-gradient-to-r from-purple-600 to-purple-700 text-white font-bold py-3">📊 Data Manager</Button>
          <Button onClick={()=>navigate('/diagnostic')} className="bg-gradient-to-r from-cyan-600 to-cyan-700 text-white font-bold py-3">🔍 Diagnostic</Button>
          <Button onClick={()=>navigate('/job-cards')} className="bg-gradient-to-r from-green-600 to-green-700 text-white font-bold py-3">🎫 Job Cards</Button>
        </div>
        
        {/* Import Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-900/20 border-blue-500"><CardContent className="pt-5 pb-5"><Button onClick={handleVehicleFile} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 flex items-center justify-center gap-2 text-base"><FileText size={22}/> Import Vehicle PDF</Button><p className="text-blue-400 text-xs mt-2 text-center">Vehicle Tax Invoice (purchase date)</p></CardContent></Card>
          <Card className="bg-green-900/20 border-green-500"><CardContent className="pt-5 pb-5"><Button onClick={handleServiceFile} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 flex items-center justify-center gap-2 text-base"><FolderOpen size={22}/> Import Service PDF</Button><p className="text-green-400 text-xs mt-2 text-center">Service/Parts Invoice (service number)</p></CardContent></Card>
          <Card className="bg-purple-900/20 border-purple-500"><CardContent className="pt-5 pb-5"><Button onClick={()=>exportInvoicesAsPDF(filtered)} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 flex items-center justify-center gap-2 text-base"><Download size={22}/> Export as PDF</Button><p className="text-purple-400 text-xs mt-2 text-center">Invoice list PDF print/download</p></CardContent></Card>
        </div>
        
        {/* Two Clear Buttons */}
        <div className="flex gap-3 flex-wrap">
          <Button onClick={clearVehicleInvoices} className="bg-orange-800 hover:bg-orange-700 text-white font-bold flex items-center gap-2">
            <Trash2 size={16}/> Clear Vehicle Invoices ({vehicleInvoices.length})
          </Button>
          <Button onClick={clearServiceInvoices} className="bg-green-800 hover:bg-green-700 text-white font-bold flex items-center gap-2">
            <Trash2 size={16}/> Clear Service Invoices ({serviceInvoices.length})
          </Button>
        </div>
        
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="bg-blue-900/20 border-blue-500"><CardContent className="pt-4 pb-4"><p className="text-xs text-slate-400">📋 Total Invoices</p><h3 className="text-3xl font-black text-blue-400 mt-1">{invoices.length}</h3><p className="text-xs text-slate-500 mt-1">₹{totalRev.toLocaleString('en-IN')}</p></CardContent></Card>
          <Card className="bg-orange-900/20 border-orange-500"><CardContent className="pt-4 pb-4"><p className="text-xs text-slate-400">🏍️ Vehicle Tax Invoices</p><h3 className="text-3xl font-black text-orange-400 mt-1">{vehicleInvoices.length}</h3><p className="text-xs text-slate-500 mt-1">₹{vehicleRev.toLocaleString('en-IN')}</p></CardContent></Card>
          <Card className="bg-green-900/20 border-green-500"><CardContent className="pt-4 pb-4"><p className="text-xs text-slate-400">🔧 Service/Parts Invoices</p><h3 className="text-3xl font-black text-green-400 mt-1">{serviceInvoices.length}</h3><p className="text-xs text-slate-500 mt-1">₹{serviceRev.toLocaleString('en-IN')}</p></CardContent></Card>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id:'all', label:`📋 सभी (${invoices.length})`, col:'blue'},
            { id:'vehicle', label:`🏍️ Vehicle Tax Invoice (${vehicleInvoices.length})`, col:'orange'},
            { id:'service', label:`🔧 Service/Parts Invoice (${serviceInvoices.length})`, col:'green'}
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${activeTab===t.id ? `bg-${t.col}-600 border-${t.col}-400 text-white shadow-lg` : `bg-slate-800 border-slate-600 text-slate-300 hover:border-${t.col}-500`}`}>{t.label}</button>
          ))}
        </div>
        
        {/* Search */}
        <div><div className="relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><Input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Invoice #, Customer, Phone, Vehicle, Reg No..." className="pl-10 bg-slate-800 border-slate-600 text-white placeholder-slate-500"/></div><p className="text-slate-500 text-xs mt-1">{filtered.length} invoices</p></div>
        
        {/* Invoice Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 py-3"><CardTitle className="text-white text-base">{activeTab === 'vehicle' ? '🏍️ Vehicle Tax Invoices' : activeTab === 'service' ? '🔧 Service/Parts Invoices' : '📋 Invoice List'} ({filtered.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="text-center py-12"><p className="text-slate-400">कोई invoice नहीं।</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-700 border-b border-slate-600">
                    <tr>
                      {['#','Invoice No','Type','Customer','Phone','Vehicle','Reg No','Date','Amount','Parts','Source','Actions'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-bold text-slate-300">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((inv, idx) => {
                      const rowIdx = (currentPage-1)*INVOICES_PER_PAGE + idx;
                      return (
                        <tr key={inv._id || inv.id || idx} className="border-b border-slate-700 hover:bg-slate-700/50">
                          <td className="px-3 py-2 text-slate-500 text-xs">{rowIdx+1}</td>
                          <td className="px-3 py-2 text-white font-bold text-xs">#{inv.invoiceNumber||inv.id}</td>
                          <td className="px-3 py-2 text-xs">
                            {inv.invoiceType === 'vehicle' 
                              ? <span className="bg-orange-900 text-orange-300 px-1.5 py-0.5 rounded font-bold">🏍️ Vehicle</span>
                              : <span className="bg-green-900 text-green-300 px-1.5 py-0.5 rounded font-bold">🔧 Service</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-200 text-xs font-medium">{inv.customerName||'—'}</td>
                          <td className="px-3 py-2 text-slate-400 text-xs">{inv.customerPhone||'—'}</td>
                          <td className="px-3 py-2 text-blue-300 text-xs">{inv.vehicle||'—'}</td>
                          <td className="px-3 py-2 text-slate-400 text-xs font-mono">{inv.regNo||'—'}</td>
                          <td className="px-3 py-2 text-slate-400 text-xs">{new Date(inv.invoiceDate||Date.now()).toLocaleDateString('en-IN')}</td>
                          <td className="px-3 py-2 text-green-400 font-bold text-xs">₹{(inv.totals?.totalAmount||inv.amount||0).toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-center"><span className={`text-xs font-bold px-1.5 py-0.5 rounded ${(inv.items||inv.parts||[]).length>0?'bg-blue-900 text-blue-300':'bg-slate-700 text-slate-500'}`}>{(inv.items||inv.parts||[]).length}</span></td>
                          <td className="px-3 py-2 text-xs">{inv.importedFrom?<span className="bg-yellow-900 text-yellow-300 px-1.5 py-0.5 rounded">📄 PDF</span>:<span className="bg-blue-900 text-blue-300 px-1.5 py-0.5 rounded">📋 Manual</span>}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1.5">
                              <Button onClick={()=>navigate(`/invoice/${inv.invoiceNumber||inv.id}`)} className="bg-blue-600 hover:bg-blue-700 text-white h-7 px-2 text-xs flex items-center gap-1"><Eye size={12}/> View</Button>
                              <Button onClick={()=>handleDelete(inv.invoiceNumber||inv.id)} className="bg-red-700 hover:bg-red-600 text-white h-7 px-2 text-xs"><Trash2 size={12}/></Button>
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
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-slate-700/50 border-t border-slate-600">
                <p className="text-xs text-slate-400">Page <b className="text-white">{currentPage}</b> of <b className="text-white">{totalPages}</b> — {filtered.length} invoices</p>
                <div className="flex gap-2">
                  <Button onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1} className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-4 text-xs disabled:opacity-40">◀ Previous</Button>
                  <Button onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages} className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-4 text-xs disabled:opacity-40">Next ▶</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}