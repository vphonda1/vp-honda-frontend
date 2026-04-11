import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Trash2, Download, ArrowLeft, Eye, FileText, FolderOpen, RefreshCw, Clock } from 'lucide-react';
import { api } from '../utils/apiConfig';

// ── NO pdfjs-dist needed! PDF parsing happens on backend (Node.js) ──────────
// Backend route: POST /api/parse-pdf (see pdfRoutes.js)

const getLS = (k, fb=[]) => { try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch{return fb;} };

// Extract PDF text via backend API — zero browser worker issues
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

  // Total — "Total Invoice Value(In Figure) ₹ 746.00"
  const rawTotal = find([
    /Total\s*Invoice\s*Value\s*\([Ii]n\s*[Ff]igure\)\s*[₹Rs.\s]*([\d,]+\.\d{2})/i,
    /Total\s*Invoice\s*Value[^₹]*[₹]\s*([\d,]+\.\d{2})/i,
    /Grand\s*Total[^₹]*[₹]\s*([\d,]+\.\d{2})/i,
    /₹\s*([\d,]+\.\d{2})\s*Total\s*Labour/i, // ₹746.18 before "Total Labour"
  ]);
  const pdfTotal = parseFloat((rawTotal||'0').replace(/,/g,'')) || 0;

  // Fallback: find largest currency amount in text (likely the total)
  let fallbackTotal = 0;
  if (pdfTotal === 0) {
    const allAmounts = [];
    const amtRe = /[₹Rs.\s]*([\d,]+\.\d{2})/g;
    let amtM;
    while ((amtM = amtRe.exec(flat)) !== null) {
      const v = parseFloat(amtM[1].replace(/,/g,''));
      if (v > 100 && v < 10000000) allAmounts.push(v);
    }
    if (allAmounts.length > 0) fallbackTotal = Math.max(...allAmounts);
  }

  const rawTax = find([
    /Total\s*Tax\s*Amount\s*[:-]?\s*[₹Rs.\s]*([\d,]+\.\d{2})/i,
    /Total\s*Tax\s*[₹Rs.\s]*([\d,]+\.\d{2})/i,
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
    'CONSUM':          'CONSUMABLE CHARGES',
  };

  // Try to find descriptions from text for unknown parts
  const findDescription = (partNo) => {
    // Check known parts first
    const upper = partNo.toUpperCase().trim();
    for (const [key, desc] of Object.entries(DESC_MAP)) {
      if (upper.includes(key.toUpperCase()) || key.toUpperCase().includes(upper)) return desc;
    }
    // Try to find description near part number in text
    const idx = flat.indexOf(partNo);
    if (idx >= 0) {
      const before = flat.slice(Math.max(0, idx - 100), idx);
      const descMatch = before.match(/([A-Z][A-Z \/\-\.]{3,40})\s*$/);
      if (descMatch && !NOISE.test(descMatch[1])) return descMatch[1].trim();
    }
    return partNo; // fallback to part number
  };

  // PRIMARY STRATEGY: Match VP Honda table rows (browser pdfjs-dist format)
  const rowPat = /\b(\d{1,2})\s+([\w\-()]{3,25})\s+(\d{4,10}|NA)\s+(\d{1,6})\s+(\d{1,3})\s+[₹Rs.\s]*([\d,]+\.\d{2})\s+(\d+)\s+(?:No|Nos|Pc|Pcs|Set)[,]?\w*\s+[₹Rs.\s]*([\d,]+\.\d{2})\s+(\d{1,3})\s+[₹Rs.\s]*([\d,]+\.\d{2})\s+[₹Rs.\s]*([\d,]+\.\d{2})/g;
  
  // STRATEGY B: pdf-parse format (backend) — text is compressed, no column spacing
  // Example: 108233-2MA-F1LG12710197348352₹ 431.321No,s₹ 431.325₹ 3.04₹ 489.75
  if (items.length === 0) {
    const partLineRe = /(\d{5,6}-[A-Z0-9\-]{3,20})/g;
    let pm;
    const foundParts = new Set();
    while ((pm = partLineRe.exec(flat)) !== null) {
      const partNo = pm[1];
      if (foundParts.has(partNo)) continue;
      foundParts.add(partNo);
      // Find all ₹ amounts after this part number
      const afterPart = flat.slice(pm.index, pm.index + 200);
      const amounts = [];
      const amRe = /₹\s*([\d,]+\.\d{2})/g;
      let am;
      while ((am = amRe.exec(afterPart)) !== null) {
        amounts.push(parseFloat(am[1].replace(/,/g,'')));
      }
      if (amounts.length >= 2) {
        const unitPrice = amounts[0];
        const taxableAmt = amounts[amounts.length - 1];
        // Find qty — look for 1No or 2Nos pattern
        const qtyM = afterPart.match(/(\d+)\s*(?:No|Nos|Pc|Pcs|Set)/i);
        const qty = qtyM ? parseInt(qtyM[1]) : 1;
        const desc = findDescription(partNo);
        items.push({
          srNo: items.length + 1, partNo, hsn: '', description: desc,
          mrp: unitPrice, unitPrice, quantity: qty,
          total: taxableAmt, gstRate: 18, gstAmount: +(taxableAmt * 0.18).toFixed(2),
        });
      }
    }
    if (items.length > 0) console.log('📦 Parts extracted via pdf-parse format:', items.length);
  }
  
  let m;
  while ((m = rowPat.exec(flat)) !== null) {
    const partNo = m[2].trim();
    if (NOISE.test(partNo)) continue;
    
    const mrp         = parseFloat(m[4]) || 0;
    const mrpDisc     = parseFloat(m[5]) || 0;
    const unitPrice   = parseFloat(m[6].replace(/,/g,'')) || 0;
    const qty         = parseInt(m[7]) || 1;
    const totalAmt    = parseFloat(m[8].replace(/,/g,'')) || 0;
    const discPct     = parseFloat(m[9]) || 0;
    const discAmt     = parseFloat(m[10].replace(/,/g,'')) || 0;
    const taxableAmt  = parseFloat(m[11].replace(/,/g,'')) || 0;
    
    items.push({
      partNo,
      description:  findDescription(partNo),
      hsn:          m[3],  // keep 'NA' as-is for GST rate detection
      mrp,
      mrpDisc,
      unitPrice,
      quantity:     qty,
      total:        taxableAmt,    // ← Taxable Amount as total
      taxableAmt,
      discPct,
      discAmt,
    });
  }

  // FALLBACK: Simpler pattern if above missed some rows (e.g., CONSUM with NA HSN)
  if (items.length === 0) {
    const simpleRowPat = /\b(\d{1,2})\s+([\w\-() ]{3,25}?)\s+(?:\d{4,10}|NA)\s+(\d{1,6})\s+\d{1,3}\s+[₹Rs.\s]*([\d,]+\.\d{2})\s+(\d+)\s+\w+/g;
    let sm;
    while ((sm = simpleRowPat.exec(flat)) !== null) {
      const partNo = sm[2].trim();
      if (NOISE.test(partNo)) continue;
      const allAmts = [];
      const ctx = flat.slice(sm.index, sm.index + 200);
      const amtRe = /[₹]\s*([\d,]+\.\d{2})/g;
      let am;
      while ((am = amtRe.exec(ctx)) !== null) allAmts.push(parseFloat(am[1].replace(/,/g,'')));
      
      items.push({
        partNo,
        description: findDescription(partNo),
        mrp:         parseFloat(sm[3]) || 0,
        unitPrice:   parseFloat(sm[4].replace(/,/g,'')) || 0,
        quantity:    parseInt(sm[5]) || 1,
        total:       allAmts.length > 0 ? allAmts[allAmts.length - 1] : parseFloat(sm[4].replace(/,/g,'')) || 0,
      });
    }
  }

  // Deduplicate by partNo
  const seen = new Set();
  const uniqueItems = [];
  for (const item of items) {
    const key = item.partNo.replace(/\s+/g,'').toUpperCase();
    if (!seen.has(key)) { seen.add(key); uniqueItems.push(item); }
  }
  items.length = 0;
  items.push(...uniqueItems);

  console.log('📦 Parts extracted:', items.length, items.map(i => `${i.partNo}: MRP=${i.mrp}, Taxable=${i.total}`));

  // ── Per-item GST: HSN=NA or CONSUM/P05 → 0% GST, others → 18% ────────────
  // VP Honda rule: items with HSN "NA" or discount ≥20% have 0% GST
  for (const item of items) {
    const hsnVal = String(item.hsn || '').trim().toUpperCase();
    const pn = String(item.partNo || '').toUpperCase();
    if (hsnVal === 'NA' || hsnVal === '' || pn === 'CONSUM' || pn.startsWith('P05')) {
      item.gstRate = 0;
      item.gstAmount = 0;
    } else {
      item.gstRate = 18;
      item.gstAmount = Math.round(item.total * 18 / 100 * 100) / 100;
    }
  }

  const itemsTotal = items.reduce((s,i) => s + (i.total||0), 0);
  const itemsGst   = items.reduce((s,i) => s + (i.gstAmount||0), 0);
  
  // ── Use PDF's Total Invoice Value & Total Tax Amount (most accurate) ───────
  let subtotal, gstRate, gstAmount, finalTotal;
  
  const effectiveTotal = pdfTotal || fallbackTotal;
  if (effectiveTotal > 0 && taxAmount > 0) {
    // PDF has both — use directly
    finalTotal = pdfTotal;
    gstAmount  = taxAmount;
    subtotal   = finalTotal - gstAmount;
  } else if (effectiveTotal > 0) {
    // PDF has total but no tax line — back-calculate from per-item GST
    finalTotal = pdfTotal;
    gstAmount  = itemsGst;
    subtotal   = itemsTotal;
  } else if (taxAmount > 0) {
    subtotal   = itemsTotal;
    gstAmount  = taxAmount;
    finalTotal = subtotal + gstAmount;
  } else {
    // No PDF totals — calculate from items
    subtotal   = itemsTotal;
    gstAmount  = itemsGst;
    finalTotal = Math.round((subtotal + gstAmount) * 100) / 100;
  }
  
  gstRate = subtotal > 0 ? Math.round(gstAmount / subtotal * 100) : 0;

  console.log('📊 Totals:', { itemsTotal, pdfTotal, taxAmount, itemsGst, subtotal, gstRate: gstRate+'%', gstAmount, finalTotal });

  // Invoice type — compute before return (no IIFE)
  const _isService = /Service\s*Type|Jobcard|1st\s*Service|2nd\s*Service|3rd\s*Service|SMH\/|AMC\s*NO|Service\s*KM|FREE\s*SERVICE/i.test(flat);
  const _isVehicle = /Sale\s*Date|Selling\s*Dealer|HMSI/i.test(flat) || (finalTotal > 50000 && !_isService);
  const invoiceType = _isService ? 'service' : _isVehicle ? 'vehicle' : finalTotal > 50000 ? 'vehicle' : 'service';

  return {
    invoiceNumber,
    invoiceDate,
    customerName:  customerName.replace(/\s+/g,' ').slice(0,60),
    customerPhone,
    vehicle:       vehicle ? vehicle.trim() : '',
    regNo,
    frameNo,
    engineNo,
    paymentMode,
    serviceKm: serviceKm ? parseInt(serviceKm) : null,
    serviceType: serviceType || '',
    serviceNumber: serviceNumber ? parseInt(serviceNumber) : null,
    items,
    parts: items,
    totals: {
      subtotal,
      gstRate,
      gstAmount,
      totalAmount: finalTotal,
    },
    invoiceType,
    importedFrom:  filename,
    importedAt:    new Date().toISOString(),
    customerId:    'imported-'+Date.now(),
    status:        'Active',
    rawText:       null, // not stored — saves localStorage space
  };
};

// Export PDF
const exportInvoicesAsPDF = (invoices) => {
  const total = invoices.reduce((s,i)=>s+(i.totals?.totalAmount||i.amount||0),0);
  const html = `<!DOCTYPE html><html><head><title>VP Honda Invoices</title>
  <style>body{font-family:Arial;font-size:11px;margin:20px}h2{color:#1a3a8a}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{background:#1a3a8a;color:white;padding:5px 7px;text-align:left;font-size:10px}
  td{border-bottom:1px solid #e5e7eb;padding:4px 7px}
  tr:nth-child(even){background:#f9fafb}
  .total{background:#1a3a8a;color:white;font-weight:bold}
  .footer{margin-top:12px;font-size:9px;color:#6b7280;text-align:center}</style>
  </head><body>
  <h2>🏍️ VP Honda — Invoice Report</h2>
  <p style="color:#6b7280;font-size:10px">Generated: ${new Date().toLocaleString('en-IN')} | ${invoices.length} invoices | ₹${total.toLocaleString('en-IN')}</p>
  <table><tr><th>#</th><th>Invoice No</th><th>Customer</th><th>Phone</th><th>Vehicle</th><th>Reg No</th><th>Date</th><th>Amount</th><th>Parts</th><th>Source</th></tr>
  ${invoices.map((inv,i)=>`<tr><td>${i+1}</td><td><b>#${inv.invoiceNumber||inv.id}</b></td>
  <td>${inv.customerName||'—'}</td><td>${inv.customerPhone||'—'}</td>
  <td>${inv.vehicle||'—'}</td><td>${inv.regNo||'—'}</td>
  <td>${new Date(inv.invoiceDate||Date.now()).toLocaleDateString('en-IN')}</td>
  <td><b>₹${(inv.totals?.totalAmount||inv.amount||0).toLocaleString('en-IN')}</b></td>
  <td>${(inv.items||inv.parts||[]).length}</td>
  <td>${inv.importedFrom?'PDF':'Manual'}</td></tr>`).join('')}
  <tr class="total"><td colspan="7">TOTAL</td><td>₹${total.toLocaleString('en-IN')}</td><td colspan="2"></td></tr>
  </table><div class="footer">VP Honda Dealership, Bhopal</div></body></html>`;
  const w = window.open('','_blank');
  w.document.write(html); w.document.close();
  setTimeout(()=>w.print(), 500);
};

// Detect type of already-saved invoices (generatedInvoices = vehicle, imported service = service)
const getInvoiceType = (inv) => {
  if (inv.invoiceType) return inv.invoiceType;
  if (inv._src === 'g' || inv.source === 'generated') return 'vehicle';
  const amt = inv.totals?.totalAmount || inv.totalAmount || inv.amount || 0;
  if (amt > 50000) return 'vehicle';
  if (inv.serviceType || inv.jobCardNo || inv.serviceKm) return 'service';
  return 'service';
};

// ═══════════════════════════════════════════════════════════════════════════
export default function InvoiceManagementDashboard() {
  const navigate = useNavigate();
  const [invoices,       setInvoices]       = useState([]);
  const [searchTerm,     setSearchTerm]     = useState('');
  const [message,        setMessage]        = useState('');
  const [loading,        setLoading]        = useState(true);
  const [importing,      setImporting]      = useState(false);
  const [progress,       setProgress]       = useState({ current:0, total:0 });
  const [lastRefresh,    setLastRefresh]    = useState(new Date());
  const [activeTab,      setActiveTab]      = useState('all'); // 'all' | 'vehicle' | 'service'
  const [currentPage,   setCurrentPage]   = useState(1);
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
    // Load from localStorage
    const lsInv = [...getLS('invoices'), ...getLS('generatedInvoices').map(i=>({...i,_s:'g'}))];
    
    // Also load from MongoDB backend
    let dbInv = [];
    try {
      const res = await fetch(api('/api/invoices'));
      if (res.ok) dbInv = await res.json();
    } catch(e) { console.log('DB offline, using localStorage only'); }

    // Merge: combine both sources, remove duplicates by invoiceNumber
    const all = [...lsInv, ...dbInv.map(i=>({...i, _s:'db'}))];
    const seen = new Set();
    const unique = all.filter(i => {
      const k = String(i.invoiceNumber||i.id||i._id||Math.random());
      if (seen.has(k)) return false; seen.add(k); return true;
    }).sort((a,b)=>new Date(b.importedAt||b.invoiceDate||b.date||0)-new Date(a.importedAt||a.invoiceDate||a.date||0));
    setInvoices(unique);
    setLastRefresh(new Date());
    setLoading(false);
  };

  const processPDFFiles = async (files) => {
    if (!files.length) return;
    setImporting(true);
    setProgress({ current:0, total:files.length });
    const existing = getLS('invoices',[]);
    const added = [], errors = [];

    for (let i=0; i<files.length; i++) {
      const file = files[i];
      setProgress({ current:i+1, total:files.length });
      if (file.type !== 'application/pdf') continue;
      try {
        const text = await extractPDFText(file);
        console.log(`📄 ${file.name} — Extracted text (first 500):`, text.slice(0,500));
        const parsed = parseVPHondaInvoice(text, file.name);
        console.log(`✅ ${file.name} — Parsed:`, { 
          invoiceNo: parsed.invoiceNumber, 
          customer: parsed.customerName, 
          items: parsed.items.length, 
          total: parsed.totals.totalAmount 
        });
        added.push(parsed);
      } catch (err) {
        console.error(`❌ ${file.name} Error:`, err);
        errors.push(file.name + ': ' + err.message);
        added.push({
          invoiceNumber: Math.floor(Math.random()*900000+100000),
          customerName: file.name.replace(/[_\-\d]+/g,' ').replace(/\.pdf$/i,'').trim().slice(0,40)||'Unknown',
          customerPhone:'', vehicle:'', regNo:'', items:[], parts:[],
          invoiceDate:new Date().toISOString().split('T')[0],
          totals:{subtotal:0,gstRate:18,gstAmount:0,totalAmount:0},
          importedFrom:file.name, importedAt:new Date().toISOString(),
          customerId:'imported-'+Date.now(), status:'Active',
          importError: err.message,
        });
      }
    }

    localStorage.setItem('invoices', JSON.stringify([...added, ...existing]));

    // ── Also save to MongoDB backend (so data syncs across devices) ──────────
    for (const inv of added) {
      try {
        await fetch(api('/api/invoices'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inv),
        });
      } catch(e) { console.log('DB save failed for', inv.invoiceNumber, e.message); }
    }
    
    // ── Sync service data for Reminders ──────────────────────────────────────
    const svcData = getLS('customerServiceData', {});
    for (const inv of added) {
      const cid = inv.customerId;
      if (!svcData[cid]) svcData[cid] = {};
      const s = svcData[cid];
      s.customerName = inv.customerName; s.phone = inv.customerPhone;
      s.vehicle = inv.vehicle; s.regNo = inv.regNo;
      const sn = inv.serviceNumber;
      if (sn === 1) { s.firstServiceDate = inv.invoiceDate; s.firstServiceKm = inv.serviceKm; }
      if (sn === 2) { s.secondServiceDate = inv.invoiceDate; s.secondServiceKm = inv.serviceKm; }
      if (sn === 3) { s.thirdServiceDate = inv.invoiceDate; s.thirdServiceKm = inv.serviceKm; }
      if (sn === 4) { s.fourthServiceDate = inv.invoiceDate; s.fourthServiceKm = inv.serviceKm; }
      if (sn === 5) { s.fifthServiceDate = inv.invoiceDate; s.fifthServiceKm = inv.serviceKm; }
      if (sn) { s.lastServiceDate = inv.invoiceDate; s.lastServiceKm = inv.serviceKm; s.lastServiceNumber = sn; }
      if (!s.serviceHistory) s.serviceHistory = [];
      s.serviceHistory.push({ number: sn, date: inv.invoiceDate, km: inv.serviceKm, type: inv.serviceType, invoiceNo: inv.invoiceNumber, parts: (inv.items||[]).length, total: inv.totals?.totalAmount||0 });
    }
    localStorage.setItem('customerServiceData', JSON.stringify(svcData));
    
    // ── Sync parts to inventory (partsInventory localStorage key) ────────────
    const partsInv = getLS('partsInventory', []);
    for (const inv of added) {
      for (const item of (inv.items || [])) {
        const existIdx = partsInv.findIndex(p => p.partNo === item.partNo);
        if (existIdx >= 0) {
          // Update existing — increment usage count
          partsInv[existIdx].usedCount = (partsInv[existIdx].usedCount || 0) + (item.quantity || 1);
          partsInv[existIdx].lastUsedInvoice = inv.invoiceNumber;
          partsInv[existIdx].lastUsedDate = inv.invoiceDate;
          if (item.mrp > 0) partsInv[existIdx].mrp = item.mrp;
        } else {
          // Add new part to inventory
          partsInv.push({
            partNo:      item.partNo,
            description: item.description || item.partNo,
            hsn:         item.hsn || '',
            mrp:         item.mrp || 0,
            unitPrice:   item.unitPrice || 0,
            category:    '', // will be auto-detected in PartsManagement
            stock:       0,  // unknown — user updates manually
            usedCount:   item.quantity || 1,
            lastUsedInvoice: inv.invoiceNumber,
            lastUsedDate:    inv.invoiceDate,
            addedAt:     new Date().toISOString(),
          });
        }
      }
    }
    localStorage.setItem('partsInventory', JSON.stringify(partsInv));
    
    window.dispatchEvent(new Event('storage'));
    setImporting(false); setProgress({ current:0, total:0 });
    loadInvoices();
    setMessage(errors.length
      ? `✅ ${added.length-errors.length} import हुए | ⚠️ ${errors.length} errors`
      : `✅ ${added.length} PDFs import! Customer, Parts, Amount, Vehicle सब extract हो गया।`);
    setTimeout(()=>setMessage(''), 6000);
  };

  const handleSingleFile  = () => { const i=document.createElement('input'); i.type='file'; i.accept='.pdf'; i.onchange=e=>processPDFFiles(Array.from(e.target.files)); i.click(); };
  const handleMultiFile   = () => { const i=document.createElement('input'); i.type='file'; i.accept='.pdf'; i.multiple=true; i.onchange=e=>processPDFFiles(Array.from(e.target.files)); i.click(); };
  const handleDelete = (no) => {
    if (!window.confirm('Delete?')) return;
    const upd = invoices.filter(i=>String(i.invoiceNumber||i.id)!==String(no));
    localStorage.setItem('invoices', JSON.stringify(upd.filter(i=>!i._s)));
    loadInvoices(); setMessage('✅ Deleted!'); setTimeout(()=>setMessage(''),2000);
  };
  const handleClearAll = () => {
    const pwd = prompt('Admin password:');
    if (pwd !== 'vphonda@123') { alert('❌ गलत password!'); return; }
    if (!window.confirm(`⚠️ सभी ${invoices.length} invoices delete होंगे!`)) return;
    localStorage.setItem('invoices', JSON.stringify([]));
    loadInvoices(); setMessage('✅ सभी clear!'); setTimeout(()=>setMessage(''),3000);
  };

  const filtered = invoices.filter(inv => {
    // Type tab filter
    const type = getInvoiceType(inv);
    if (activeTab === 'vehicle' && type !== 'vehicle') return false;
    if (activeTab === 'service' && type !== 'service') return false;
    // Search filter
    return !searchTerm ||
      String(inv.invoiceNumber||inv.id||'').includes(searchTerm) ||
      (inv.customerName||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.customerPhone||'').includes(searchTerm) ||
      (inv.vehicle||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.regNo||'').includes(searchTerm);
  });

  const vehicleInvoices = invoices.filter(i => getInvoiceType(i) === 'vehicle');
  const serviceInvoices = invoices.filter(i => getInvoiceType(i) === 'service');
  const totalRev        = invoices.reduce((s,i)=>s+(i.totals?.totalAmount||i.totalAmount||i.amount||0),0);
  const vehicleRev      = vehicleInvoices.reduce((s,i)=>s+(i.totals?.totalAmount||i.totalAmount||i.amount||0),0);
  const serviceRev      = serviceInvoices.reduce((s,i)=>s+(i.totals?.totalAmount||i.totalAmount||i.amount||0),0);
  
  // Pagination
  const totalPages      = Math.ceil(filtered.length / INVOICES_PER_PAGE);
  const paginatedInvs   = filtered.slice((currentPage-1)*INVOICES_PER_PAGE, currentPage*INVOICES_PER_PAGE);

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="text-center text-white">
        <div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
        <p className="font-bold">Loading...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <Button onClick={()=>navigate('/reminders')} className="bg-red-700 hover:bg-red-600 text-white font-bold flex items-center gap-2">
            <ArrowLeft size={18}/> Back
          </Button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">📋 Invoice Management Dashboard</h1>
            <p className="text-slate-400 text-xs flex items-center justify-center gap-1 mt-1">
              <Clock size={11}/> {lastRefresh.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
            </p>
          </div>
          <Button onClick={loadInvoices} className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2">
            <RefreshCw size={16}/> Refresh
          </Button>
        </div>

        {message && (
          <Card className={`${message.includes('✅')?'bg-green-900/20 border-green-500':'bg-red-900/20 border-red-500'}`}>
            <CardContent className="pt-4 pb-4">
              <p className={`font-bold text-sm ${message.includes('✅')?'text-green-300':'text-red-400'}`}>{message}</p>
            </CardContent>
          </Card>
        )}

        {/* IMPORT PROGRESS */}
        {importing && (
          <Card className="bg-blue-900/30 border-blue-500">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0"/>
                <div className="flex-1">
                  <p className="text-blue-300 font-bold text-sm">PDF import: {progress.current}/{progress.total}</p>
                  <p className="text-blue-500 text-xs">PDF.js → text extract → VP Honda parse → save</p>
                  <div className="h-2 bg-slate-700 rounded-full mt-2">
                    <div className="h-2 bg-blue-500 rounded-full transition-all"
                      style={{width:`${progress.total?progress.current/progress.total*100:0}%`}}/>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* QUICK LINKS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button onClick={()=>navigate('/reminders')} className="bg-gradient-to-r from-orange-600 to-orange-700 text-white font-bold py-3">🔔 Reminders</Button>
          <Button onClick={()=>navigate('/customer-data-manager')} className="bg-gradient-to-r from-purple-600 to-purple-700 text-white font-bold py-3">📊 Data Manager</Button>
          <Button onClick={()=>navigate('/diagnostic')} className="bg-gradient-to-r from-cyan-600 to-cyan-700 text-white font-bold py-3">🔍 Diagnostic</Button>
          <Button onClick={()=>navigate('/job-cards')} className="bg-gradient-to-r from-green-600 to-green-700 text-white font-bold py-3">🎫 Job Cards</Button>
        </div>

        {/* IMPORT/EXPORT */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-900/20 border-blue-500">
            <CardContent className="pt-5 pb-5">
              <Button onClick={handleSingleFile} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 flex items-center justify-center gap-2 text-base">
                <FileText size={22}/> Import Single PDF
              </Button>
              <p className="text-blue-400 text-xs mt-2 text-center">एक PDF — सभी data extract होगा</p>
            </CardContent>
          </Card>
          <Card className="bg-green-900/20 border-green-500">
            <CardContent className="pt-5 pb-5">
              <Button onClick={handleMultiFile} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 flex items-center justify-center gap-2 text-base">
                <FolderOpen size={22}/> Import Multiple PDFs
              </Button>
              <p className="text-green-400 text-xs mt-2 text-center">314+ VP Honda invoices एक साथ</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-900/20 border-purple-500">
            <CardContent className="pt-5 pb-5">
              <Button onClick={()=>exportInvoicesAsPDF(filtered)} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 flex items-center justify-center gap-2 text-base">
                <Download size={22}/> Export as PDF
              </Button>
              <p className="text-purple-400 text-xs mt-2 text-center">Invoice list PDF print/download</p>
            </CardContent>
          </Card>
        </div>

        {invoices.length > 0 && (
          <Button onClick={handleClearAll} className="bg-red-900 hover:bg-red-800 text-white font-bold flex items-center gap-2">
            <Trash2 size={16}/> Clear All ({invoices.length})
          </Button>
        )}

        {/* KPIs — Vehicle vs Service Split */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="bg-blue-900/20 border-blue-500">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-400">📋 Total Invoices</p>
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