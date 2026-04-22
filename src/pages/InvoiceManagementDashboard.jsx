import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Trash2, Download, ArrowLeft, Eye, FileText, FolderOpen, RefreshCw, Clock } from 'lucide-react';
import { api } from '../utils/apiConfig';

// ── NO pdfjs-dist needed! PDF parsing happens on backend (Node.js) ──────────
// Backend route: POST /api/invoices/parse-pdf

const getLS = (k, fb=[]) => { try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch{return fb;} };

// Extract PDF text via backend API — zero browser worker issues
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
  if (!data.text) throw new Error(data.error || 'No text extracted');

  console.log('📄 PDF extracted via backend, length:', data.text.length);
  return data.text;
};

// ═══════════════════════════════════════════════════════════════════════════
// VP HONDA INVOICE PARSER
// ═══════════════════════════════════════════════════════════════════════════
const parseVPHondaInvoice = (text, filename) => {
  // Normalize split part numbers across lines (e.g. "32213850-\n764007020" → "32213850-764007020")
  const textNorm = text.replace(/(\d{6,10})-\s*\n\s*(\d{5,10})/g, '$1-$2');
  const flat = textNorm.replace(/\n/g,' ').replace(/(\d{6,10})-\s+(\d{5,10})/g,'$1-$2').replace(/\s+/g,' ');
  const lines = textNorm.split('\n').map(l=>l.trim()).filter(Boolean);

  const find = (patterns, fb='') => {
    for (const p of patterns) {
      const m = flat.match(p) || text.match(p);
      if (m) return (m[1]||m[0]).trim();
    }
    return fb;
  };

  // Invoice No
  // Vehicle format: "Invoice No : SMH/25-26 152" (last number = invoice no)
  // Service format: "Invoice No :- 550"
  const invoiceNumber = find([
    /Invoice\s*No\s*[:-]+\s*(?:\S+\s+)?(\d+)/i,  // handles both formats + garbled chars
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

  // Total — "Total Invoice Value(In Figure) ₹ 861.00" (service) | "₹ 84,291.00" (vehicle)
  const rawTotal = find([
    /Total\s*Invoice\s*Value\s*\([Ii]n\s*[Ff]igure\)\s*[₹Rs.\s]*([\d,]+\.\d{2})/i,
    /Total\s*Invoice\s*Value[^₹]*[₹]\s*([\d,]+\.\d{2})/i,
    /Invoice\s*Value\(?[Ii]n\s*[Ff]igure\)?[₹Rs.\s]*([\d,]+\.\d{2})/i,
    /Invoice\s*Total\s*[₹Rs.\s]*([\d,]+\.\d{2})/i,
    /Grand\s*Total[^₹]*[₹]\s*([\d,]+\.\d{2})/i,
    /Total\s*Parts\s*Amount[^₹]*[₹]\s*([\d,]+\.\d{2})/i,
    /₹\s*([\d,]+\.\d{2})\s*Total\s*Labour/i,
    // Vehicle invoice: last ₹ amount before "Key No" or "Amount in Words"
    /[₹]\s*([\d,]+\.\d{2})\s*(?:-[₹][\d,.]+\s*)?[₹]\s*[\d,]+\.\d{2}\s*(?:Key\s*No|Amount\s*in\s*Words|Eighty|Seventy|Sixty|Fifty|Forty|Thirty|Twenty|Ten|Nine|Eight|Seven|Six|Five|Four|Three|Two|One)/i,
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
    '06455-KYJ-940':   'PAD SET FR',
    '06455-K0N-D01':   'PAD SET FR',
    '06435-KYJ-930':   'SHOE SET RR BRAKE',
    '06435-K0N-D01':   'SHOE SET RR BRAKE',
    '42711-K0N-D01':   'TIRE RR',
    '42711-KYJ-901':   'TIRE RR',
    '22401-K0N-D01':   'CLUTCH CABLE',
    '23100-K0N-D01':   'CHAIN DRIVE',
    '32213850-784007020': 'HONDA CHAIN CLEANER & LUBE 400ML',
    '06430-KWP-900879': 'BRAKE SHOE SET',
    '06410-K67-900401': 'PAD SET FR BRAKE',
    '91306-KYJ-840':   'O-RING',
    '18291-K0N-D00':   'GASKET EX PIPE',
    '17210-K0N-D00':   'ELEMENT AIR CLEANER',
    '30410-K0N-D01':   'SPARK PLUG',
    'P05':             'NO. PLATE COVER',
    'P05 (B)':         'NO. PLATE COVER',
    'CONSUM':          'CONSUMABLE CHARGES',
    'LABOUR':          'LABOUR CHARGES',
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
  // Part number group allows optional space+digits for split parts like "32213850- 764007020"
  const rowPat = /\b(\d{1,2})\s+([\w\-()]{3,19}(?:\s+\d{5,10})?)\s+(\d{4,10}|NA)\s+(\d{1,6})\s+(\d{1,3})\s+[₹Rs.\s]*([\d,]+\.\d{2})\s+(\d+)\s+(?:No|Nos|Pc|Pcs|Set)[,'\.s]?\w*\s+[₹Rs.\s]*([\d,]+\.\d{2})\s+(\d{1,3})\s+[₹Rs.\s]*([\d,]+\.\d{2})\s+[₹Rs.\s]*([\d,]+\.\d{2})/g;

  // ── Run rowPat FIRST — gives exact taxable amounts from PDF columns ──────
  let m;
  while ((m = rowPat.exec(flat)) !== null) {
    const partNo = m[2].replace(/\s+/g,'').trim(); // normalize split part nos
    if (NOISE.test(partNo)) continue;
    const mrp        = parseFloat(m[4]) || 0;
    const mrpDisc    = parseFloat(m[5]) || 0;
    const unitPrice  = parseFloat(m[6].replace(/,/g,'')) || 0;
    const qty        = parseInt(m[7]) || 1;
    const discPct    = parseFloat(m[9]) || 0;
    const discAmt    = parseFloat(m[10].replace(/,/g,'')) || 0;
    const taxableAmt = parseFloat(m[11].replace(/,/g,'')) || 0; // column 11 = Taxable Amount
    items.push({
      partNo, description: findDescription(partNo), hsn: m[3],
      mrp, mrpDisc, unitPrice, quantity: qty,
      total: taxableAmt, taxableAmt, discPct, discAmt,
    });
  }
  if (items.length > 0) console.log('📦 rowPat:', items.length, 'parts →', items.map(i=>i.partNo+':₹'+i.total));

  // STRATEGY B: fallback — only if rowPat found nothing (garbled/no ₹ symbol)
  // Example compressed line: "108233-2MA-F1LG12710197348352₹431.321No,s₹431.325₹3.04₹409.75"
  if (items.length === 0) {
    // Known Honda part numbers (add more as needed)
    const KNOWN_PARTS = [
      '08233-2MA-F1LG1','08233-2MB-F0LG1','15412-K0N-D01','17220-K0N-D00',
      '94109-12000','91307-KRM-840','06455-KYJ-930','06435-KYJ-930',
      '15412-K0N-D00','17210-K0N-D00','15410-KYJ-901','91302-KRM-840',
      '06455-KYJ-940','42711-K0N-D01','42711-KYJ-901','42711-K44-D01',
      '15412-KRM-840','17220-KRM-840','06455-K44-D01','06435-K44-D01',
      '91307-KRM-841','94109-14000','22401-K0N-D01','23100-K0N-D01',
      '32213850-784007020','32213850-764007020',
      '06410-K67-900','06430-KWP-900',   // FIXED — no extra digits
      '17220-K0N-D00','91306-KYJ-840','18291-K0N-D00','18392-K0N-D00',
      '22870-K0N-D00','43150-K0N-D01','06455-K0N-D01','06435-K0N-D01',
      '45126-K0N-D01','45351-K0N-D01','45451-K0N-D01','51400-K0N-D01',
      '51500-K0N-D01','50713-K0N-D00','53100-K0N-D01','53205-K0N-D01',
      '35110-K0N-D01','35120-K0N-D01','40510-K0N-D01','40530-K0N-D01',
      '06401-K0N-D01','04711-K0N-D00','04711-KYJ-900','30410-K0N-D01',
      '31120-K0N-D01','91301-K0N-D00','91302-K0N-D00','91305-K0N-D00',
      '16010-KYJ-901','16211-K0N-D00','22100-K0N-D01','50530-K0N-D01',
      '08232-99907','08232-99904','08C35-K0020','08C35-K0010',
    ];
    
    const allLines = text.split('\n').map(l => l.trim()).filter(Boolean);
    
    for (const line of allLines) {
      // Skip non-parts lines
      if (/^(Total|HSN|SAC|GSTIN|SGST|CGST|IGST|Rate|Amount|Cess|Narsin|Phone|Email|Address|Dealer|State|PIN|Dist|City|PAN|Frame|Engine|Model|Colour|Jobcard|Service|Menu|Pick|Sale|Selling|Invoice|Order|Document|Customer|Leagal|Father|Aadhar|Bill|Place)/i.test(line)) continue;
      
      // Count ₹ amounts in line
      const amounts = [];
      const amRe = /₹\s*([\d,]+\.\d{2})/g;
      let am;
      while ((am = amRe.exec(line)) !== null) {
        amounts.push(parseFloat(am[1].replace(/,/g, '')));
      }
      if (amounts.length < 2) continue; // Need at least 2 ₹ values for a parts row
      
      // Normalize split part numbers (e.g. "32213850- 764007020" → "32213850-764007020")
      const lineNorm = line.replace(/(\d{6,10})-\s+(\d{5,10})/g, '$1-$2');
      const beforeFirstRupee = lineNorm.split('₹')[0].trim();
      let partNo = '';
      
      // Method 1: Match against known parts (search in full normalized line)
      const lineUpper = lineNorm.toUpperCase();
      for (const known of KNOWN_PARTS) {
        if (lineUpper.includes(known.toUpperCase())) {
          partNo = known;
          break;
        }
      }
      
      // Method 2: Smart extraction — Honda parts: various lengths
      if (!partNo) {
        let cleaned = beforeFirstRupee;
        const dashIdx = cleaned.indexOf('-');
        if (dashIdx >= 4) {
          const digitsBeforeDash = cleaned.slice(0, dashIdx);
          if (/^\d+$/.test(digitsBeforeDash)) {
            // Strip SrNo: 1-digit if 6 chars (1+5), 2-digit if 7 chars (2+5), etc.
            const partStartLen = 5; // Honda parts start with 5 digits typically
            const srNoLen = digitsBeforeDash.length - partStartLen;
            if (srNoLen >= 1 && srNoLen <= 2) {
              cleaned = cleaned.slice(srNoLen);
            } else if (digitsBeforeDash.length >= 9) {
              // 8-digit part (like 32213850): SrNo = total - 8
              const srNo8 = digitsBeforeDash.length - 8;
              if (srNo8 >= 1 && srNo8 <= 2) cleaned = cleaned.slice(srNo8);
              else cleaned = cleaned.slice(1); // default: strip 1 digit SrNo
            }
          }
          // Match Honda part patterns:
          // A: 5dig-3alphanum-4to6alphanum (08233-2MA-F1LG1)
          // B: 5dig-5to6dig (94109-12000)
          // C: 8dig-9dig (32213850-784007020)
          const partMatch = cleaned.match(/^(\d{4,8}-[A-Z0-9]{1,4}-[A-Z0-9]{1,6}|\d{4,8}-\d{4,9})/);
          if (partMatch) {
            partNo = partMatch[1];
          }
        }
      }
      
      // Method 3: CONSUM / Labour / P05
      if (!partNo) {
        if (/CONSUM/i.test(line)) partNo = 'CONSUM';
        else if (/P05/i.test(beforeFirstRupee)) partNo = 'P05';
        else if (/Labour|Labor/i.test(line)) partNo = 'LABOUR';
      }
      
      // Method 4: Any alphanumeric with dash pattern not yet matched
      if (!partNo && beforeFirstRupee.match(/[A-Z]/i)) {
        const genMatch = beforeFirstRupee.match(/\d*([A-Z0-9]{2,5}-[A-Z0-9]{2,10}(?:-[A-Z0-9]{2,8})?)/i);
        if (genMatch && genMatch[1].length >= 5) partNo = genMatch[1];
      }
      
      if (!partNo) continue;
      if (items.find(i => i.partNo === partNo)) continue; // Skip duplicates
      
      // amounts: [unitPrice, totalAmt, discAmt, taxableAmt] — last one is taxable
      const taxableAmt = amounts[amounts.length - 1]; // Last ₹ = Taxable Amount
      const unitPrice = amounts[0]; // First ₹ = Unit Price
      
      // Extract MRP from text between part number and first ₹
      let mrp = unitPrice; // default fallback
      if (partNo && beforeFirstRupee.length > partNo.length + 5) {
        // After partNo, text has: HSN(7-8 digits) + MRP(2-6 digits) + Disc%(1-3 digits)
        const afterPart = beforeFirstRupee.slice(beforeFirstRupee.indexOf(partNo) + partNo.length);
        const nums = afterPart.match(/\d+/g);
        if (nums && nums.length >= 2) {
          // First number = HSN (7-8 digits), second = MRP, third = disc%
          const possibleMRP = nums.find((n, i) => i > 0 && n.length >= 2 && n.length <= 6 && parseInt(n) > 5);
          if (possibleMRP) mrp = parseFloat(possibleMRP);
        }
      }
      
      // Detect quantity from line
      let qty = 1;
      const qtyMatch = line.match(/(\d+)\s*(?:No|Nos|Pc|Pcs|Set)[,]?/i);
      if (qtyMatch) qty = parseInt(qtyMatch[1]) || 1;
      
      // Determine GST: CONSUM has 20% disc = 0% GST, others have 5% disc = 18% GST (9+9)
      // From TAX SUMMARY: items with HSN "NA" have 0% GST rate
      const isZeroGST = partNo === 'CONSUM';
      const gstRate = isZeroGST ? 0 : 18;
      
      const desc = findDescription(partNo);
      items.push({
        srNo: items.length + 1, partNo, hsn: '', description: desc,
        mrp, unitPrice, quantity: qty,
        total: taxableAmt, gstRate, gstAmount: isZeroGST ? 0 : +(taxableAmt * 0.18).toFixed(2),
      });
    }
    
    if (items.length > 0) console.log('📦 Parts extracted:', items.length, items.map(i => i.partNo + ': ₹' + i.total));
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
    if (hsnVal === 'NA' || pn === 'CONSUM' || pn.startsWith('P05')) {
      // CONSUM and NA HSN items = 0% GST
      item.gstRate = 0;
      item.gstAmount = 0;
    } else {
      // Standard parts = 18% GST (9% SGST + 9% CGST)
      item.gstRate = 18;
      item.gstAmount = Math.round(item.total * 18 / 100 * 100) / 100;
    }
  }

  const itemsTotal = items.reduce((s,i) => s + (i.total||0), 0);
  const itemsGst   = items.reduce((s,i) => s + (i.gstAmount||0), 0);
  
  // ── Use PDF's Total Invoice Value & Total Tax Amount (most accurate) ───────
  let subtotal, gstRate, gstAmount, finalTotal;
  
  const effectiveTotal = pdfTotal;
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

  // If finalTotal still 0 but items exist, calculate correctly
  if (finalTotal === 0 && itemsTotal > 0) {
    subtotal = itemsTotal;
    // Calculate GST from individual items (some 18%, some 0%)
    gstAmount = items.reduce((sum, item) => sum + (item.gstAmount || 0), 0);
    gstAmount = +gstAmount.toFixed(2);
    finalTotal = +(subtotal + gstAmount).toFixed(2);
    gstRate = subtotal > 0 ? Math.round(gstAmount / subtotal * 100) : 0;
  }

  console.log('📊 Totals:', { itemsTotal, pdfTotal, taxAmount, itemsGst, subtotal, gstRate: gstRate+'%', gstAmount, finalTotal });

  // Invoice type detection
  // SMH = Sale booking (vehicle), not service. Jobcard/Service KM = service
  const _isVehicle = /Sale\s*Date|Selling\s*Dealer|HMSI|Chassis\s*No|Bill\s*book|IRN\s*:|Key\s*No/i.test(flat)
                     || (pdfTotal > 50000);
  const _isService = !_isVehicle && /Service\s*Type|Jobcard|1st\s*Service|2nd\s*Service|3rd\s*Service|AMC\s*NO|Service\s*KM|FREE\s*SERVICE/i.test(flat);
  const invoiceType = _isVehicle ? 'vehicle' : 'service';

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
  const [selectedInvoice, setSelectedInvoice] = useState(null);
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
    // MongoDB PRIMARY — fetch fresh data first
    let dbInv = [];
    try {
      const res = await fetch(api('/api/invoices'));
      if (res.ok) dbInv = await res.json();
    } catch(e) { console.log('DB offline, using localStorage only'); }
    
    // Merge with localStorage (generated invoices may only be local)
    const lsInv = [...getLS('invoices'), ...getLS('generatedInvoices').map(i=>({...i,_s:'g'}))];
    const all = [...dbInv.map(i=>({...i, _s:'db'})), ...lsInv];
    const seen = new Set();
    const unique = all.filter(i => {
      const k = String(i.invoiceNumber||i.id||i._id||Math.random());
      if (seen.has(k)) return false; seen.add(k); return true;
    }).sort((a,b)=>new Date(b.importedAt||b.invoiceDate||b.date||0)-new Date(a.importedAt||a.invoiceDate||a.date||0));
    setInvoices(unique);
    setLastRefresh(new Date());
    setLoading(false);
  };

  const processPDFFiles = async (files, forcedType = null) => {
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
        // forcedType: Vehicle button='vehicle', Service button='service'
        if (forcedType) parsed.invoiceType = forcedType;
        console.log(`✅ ${file.name} — Parsed:`, { 
          invoiceNo: parsed.invoiceNumber, 
          customer: parsed.customerName, 
          items: parsed.items.length, 
          total: parsed.totals.totalAmount,
          type: parsed.invoiceType,
        });
        added.push(parsed);
      } catch (err) {
        console.error(`❌ ${file.name} Error:`, err);
        errors.push(file.name + ': ' + err.message);
        added.push({
          invoiceNumber: Math.floor(Math.random()*900000+100000),
          customerName: file.name.replace(/^[_\s]*\d[\d\-]*[_\s]+/,'').replace(/_\d+$/,'').replace(/_/g,' ').replace(/\.pdf$/i,'').trim().toUpperCase().slice(0,40)||'Unknown',
          customerPhone:'', vehicle:'', regNo:'', items:[], parts:[],
          invoiceDate:new Date().toISOString().split('T')[0],
          totals:{subtotal:0,gstRate:18,gstAmount:0,totalAmount:0},
          invoiceType: forcedType || 'service',
          importedFrom:file.name, importedAt:new Date().toISOString(),
          customerId:'imported-'+Date.now(), status:'Active',
          importError: err.message,
        });
      }
    }

    localStorage.setItem('invoices', JSON.stringify([...added, ...existing]));

    // ── Save to MongoDB backend (cross-device sync) ──────────────────────────
    let dbSaved = 0;
    for (const inv of added) {
      try {
        const r = await fetch(api('/api/invoices'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({...inv, customerId: undefined, _id: undefined}),
        });
        if (r.ok) dbSaved++;
        else console.log('DB save error:', r.status, await r.text().catch(()=>''));
      } catch(e) { console.log('DB offline for', inv.invoiceNumber); }
    }
    console.log(`✅ ${dbSaved}/${added.length} invoices saved to MongoDB`);
    
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

  const handleSingleFile  = () => { const i=document.createElement('input'); i.type='file'; i.accept='.pdf'; i.onchange=e=>processPDFFiles(Array.from(e.target.files),'vehicle'); i.click(); };
  const handleMultiFile   = () => { const i=document.createElement('input'); i.type='file'; i.accept='.pdf'; i.multiple=true; i.onchange=e=>processPDFFiles(Array.from(e.target.files),'service'); i.click(); };
  const handleDelete = async (no) => {
    if (!window.confirm('Delete?')) return;
    try { await fetch(api(`/api/invoices/${no}`), { method:'DELETE' }); } catch(e) { console.log('DB delete failed'); }
    const upd = invoices.filter(i=>String(i.invoiceNumber||i.id)!==String(no));
    localStorage.setItem('invoices', JSON.stringify(upd.filter(i=>!i._s)));
    loadInvoices(); setMessage('✅ Deleted!'); setTimeout(()=>setMessage(''),2000);
  };
  const handleClearAll = async () => {
    const pwd = prompt('Admin password:');
    if (pwd !== 'vphonda@123') { alert('❌ गलत password!'); return; }
    if (!window.confirm(`⚠️ सभी ${invoices.length} invoices delete होंगे!`)) return;
    try { await fetch(api('/api/invoices/clear'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type:'all'}) }); } catch(e) {}
    localStorage.setItem('invoices', JSON.stringify([]));
    localStorage.setItem('generatedInvoices', JSON.stringify([]));
    loadInvoices(); setMessage('✅ सभी clear!'); setTimeout(()=>setMessage(''),3000);
  };

  const vehicleInvoices = invoices.filter(i => getInvoiceType(i) === 'vehicle');
  const serviceInvoices = invoices.filter(i => getInvoiceType(i) === 'service');

  const handleClearVehicle = async () => {
    const pwd = prompt('Admin password:');
    if (pwd !== 'vphonda@123') { alert('❌ गलत password!'); return; }
    const vCount = vehicleInvoices.length;
    if (!window.confirm(`⚠️ ${vCount} Vehicle Tax Invoices delete होंगे!`)) return;
    try { await fetch(api('/api/invoices/clear'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type:'vehicle'}) }); } catch(e) {}
    const remaining = invoices.filter(i => getInvoiceType(i) !== 'vehicle');
    localStorage.setItem('invoices', JSON.stringify(remaining.filter(i=>!i._s)));
    loadInvoices(); setMessage(`✅ ${vCount} Vehicle invoices deleted!`); setTimeout(()=>setMessage(''),3000);
  };

  const handleClearService = async () => {
    const pwd = prompt('Admin password:');
    if (pwd !== 'vphonda@123') { alert('❌ गलत password!'); return; }
    const sCount = serviceInvoices.length;
    if (!window.confirm(`⚠️ ${sCount} Service/Parts Invoices delete होंगे!`)) return;
    try { await fetch(api('/api/invoices/clear'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type:'service'}) }); } catch(e) {}
    const remaining = invoices.filter(i => getInvoiceType(i) !== 'service');
    localStorage.setItem('invoices', JSON.stringify(remaining.filter(i=>!i._s)));
    loadInvoices(); setMessage(`✅ ${sCount} Service invoices deleted!`); setTimeout(()=>setMessage(''),3000);
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
                <FileText size={22}/> Import Vehicle Tax Invoice
              </Button>
              <p className="text-blue-400 text-xs mt-2 text-center">Vehicle Tax Invoice PDF import</p>
            </CardContent>
          </Card>
          <Card className="bg-green-900/20 border-green-500">
            <CardContent className="pt-5 pb-5">
              <Button onClick={handleMultiFile} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 flex items-center justify-center gap-2 text-base">
                <FolderOpen size={22}/> Import Service PDFs
              </Button>
              <p className="text-green-400 text-xs mt-2 text-center">Service/Parts invoices एक साथ</p>
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
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleClearAll} className="bg-red-900 hover:bg-red-800 text-white font-bold flex items-center gap-2">
              <Trash2 size={16}/> Clear All ({invoices.length})
            </Button>
            {vehicleInvoices.length > 0 && (
              <Button onClick={handleClearVehicle} className="bg-orange-900 hover:bg-orange-800 text-white font-bold flex items-center gap-2">
                <Trash2 size={16}/> Clear Vehicle ({vehicleInvoices.length})
              </Button>
            )}
            {serviceInvoices.length > 0 && (
              <Button onClick={handleClearService} className="bg-green-900 hover:bg-green-800 text-white font-bold flex items-center gap-2">
                <Trash2 size={16}/> Clear Service ({serviceInvoices.length})
              </Button>
            )}
          </div>
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
                            <Button onClick={()=>setSelectedInvoice(inv)}
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

      {/* ═══ INVOICE DETAIL MODAL ═══ */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={()=>setSelectedInvoice(null)}>
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 border border-slate-600" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">📋 Invoice #{selectedInvoice.invoiceNumber||selectedInvoice.id}</h2>
              <Button onClick={()=>setSelectedInvoice(null)} className="bg-red-600 hover:bg-red-700 text-white h-8 px-3">✕ Close</Button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div className="bg-slate-700/50 rounded p-3">
                <p className="text-slate-400 text-xs">Customer</p>
                <p className="text-white font-bold">{selectedInvoice.customerName||'—'}</p>
              </div>
              <div className="bg-slate-700/50 rounded p-3">
                <p className="text-slate-400 text-xs">Phone</p>
                <p className="text-white">{selectedInvoice.customerPhone||'—'}</p>
              </div>
              <div className="bg-slate-700/50 rounded p-3">
                <p className="text-slate-400 text-xs">Vehicle</p>
                <p className="text-blue-300">{selectedInvoice.vehicle||'—'}</p>
              </div>
              <div className="bg-slate-700/50 rounded p-3">
                <p className="text-slate-400 text-xs">Reg No</p>
                <p className="text-white font-mono">{selectedInvoice.regNo||'—'}</p>
              </div>
              <div className="bg-slate-700/50 rounded p-3">
                <p className="text-slate-400 text-xs">Date</p>
                <p className="text-white">{selectedInvoice.invoiceDate||'—'}</p>
              </div>
              <div className="bg-slate-700/50 rounded p-3">
                <p className="text-slate-400 text-xs">Type</p>
                <p className="text-white">{getInvoiceType(selectedInvoice) === 'vehicle' ? '🏍️ Vehicle' : '🔧 Service'}</p>
              </div>
            </div>

            {/* Parts Table */}
            {(selectedInvoice.items||selectedInvoice.parts||[]).length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-300 mb-2">🔧 Parts / Items</h3>
                <table className="w-full text-xs">
                  <thead className="bg-slate-700">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-slate-400">Part No</th>
                      <th className="px-2 py-1.5 text-left text-slate-400">Description</th>
                      <th className="px-2 py-1.5 text-right text-slate-400">Qty</th>
                      <th className="px-2 py-1.5 text-right text-slate-400">MRP (₹)</th>
                      <th className="px-2 py-1.5 text-right text-slate-400">Taxable (₹)</th>
                      <th className="px-2 py-1.5 text-right text-slate-400">GST%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedInvoice.items||selectedInvoice.parts||[]).map((item,idx) => (
                      <tr key={idx} className="border-b border-slate-700">
                        <td className="px-2 py-1.5 text-blue-300 font-mono">{item.partNo||'—'}</td>
                        <td className="px-2 py-1.5 text-white">{item.description||'—'}</td>
                        <td className="px-2 py-1.5 text-right text-slate-300">{item.quantity||1}</td>
                        <td className="px-2 py-1.5 text-right text-slate-300">₹{(item.mrp||0).toLocaleString('en-IN')}</td>
                        <td className="px-2 py-1.5 text-right text-green-400 font-bold">₹{(item.total||item.taxableAmount||0).toLocaleString('en-IN')}</td>
                        <td className="px-2 py-1.5 text-right text-slate-400">{item.gstRate||0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals */}
            <div className="bg-slate-700/50 rounded p-4 text-sm">
              <div className="flex justify-between mb-1"><span className="text-slate-400">Subtotal:</span><span className="text-white">₹{(selectedInvoice.totals?.subtotal||0).toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between mb-1"><span className="text-slate-400">GST ({selectedInvoice.totals?.gstRate||0}%):</span><span className="text-white">₹{(selectedInvoice.totals?.gstAmount||0).toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between border-t border-slate-600 pt-2 mt-2"><span className="text-white font-bold text-base">Total:</span><span className="text-green-400 font-black text-lg">₹{(selectedInvoice.totals?.totalAmount||selectedInvoice.totalAmount||0).toLocaleString('en-IN')}</span></div>
            </div>

            {selectedInvoice.importedFrom && (
              <p className="text-xs text-slate-500 mt-3">📄 Source: {selectedInvoice.importedFrom}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}