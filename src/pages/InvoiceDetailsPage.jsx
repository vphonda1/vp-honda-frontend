import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Download, Printer, AlertCircle, Package, User, FileText, Calendar, IndianRupee, Plus, Trash2, Save, Edit3, X } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { api } from '../utils/apiConfig';

// ── Safe helpers ──────────────────────────────────────────────────────────────
const getLS = (key, fb = []) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const setLS = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); window.dispatchEvent(new Event('storage')); } catch {} };

const fmtINR = (n) => '₹' + (parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const safeDate = (d) => {
  if (!d) return '—';
  try { const dt = new Date(d); return isNaN(dt) ? String(d) : dt.toLocaleDateString('en-IN'); } catch { return String(d); }
};

// ── Normalize invoice from ANY source format ──────────────────────────────────
const normalizeInvoice = (raw) => {
  if (!raw) return null;
  const items = (() => {
    const arr = raw.items || raw.parts || raw.lineItems || raw.services || [];
    return Array.isArray(arr) ? arr.map((item, idx) => ({
      _id:         item._id || `item-${idx}-${Date.now()}`,
      partNo:      item.partNo      || item.part_no || item.code || item.id || '',
      description: item.description || item.name   || item.partName || item.item || '',
      hsn:         item.hsn || item.hsnCode || item.sacCode || '',
      mrp:         parseFloat(item.mrp || 0),
      quantity:    parseFloat(item.quantity || item.qty || item.count || 1),
      unitPrice:   parseFloat(item.unitPrice || item.price || item.rate || item.amount || 0),
      total:       parseFloat(item.total || item.amount || ((item.unitPrice||item.price||0) * (item.quantity||item.qty||1)) || 0),
      gstRate:     item.gstRate !== undefined ? parseFloat(item.gstRate) : undefined, // per-item GST
      gstAmount:   item.gstAmount !== undefined ? parseFloat(item.gstAmount) : undefined,
    })) : [];
  })();
  
  const t = raw.totals || raw.billing || {};
  const itemsTotal = items.reduce((s,i) => s + (i.total || i.unitPrice * i.quantity || 0), 0);
  const subtotal = parseFloat(t.subtotal || t.subTotal || t.beforeTax || raw.subtotal || itemsTotal || 0);
  const gstRate  = parseFloat(t.gstRate || raw.gstRate || 18);
  const gstAmt   = parseFloat(t.gstAmount || t.gst || t.tax || raw.gst || 0);
  const total    = parseFloat(t.totalAmount || t.total || t.grandTotal || raw.totalAmount || raw.amount || raw.grandTotal || 0);
  
  return {
    invoiceNumber:  raw.invoiceNumber || raw.id || raw._id || raw.invoiceNo || '—',
    customerName:   raw.customerName  || raw.name || raw.customer?.name || '—',
    customerPhone:  raw.customerPhone || raw.phone || raw.customer?.phone || '',
    customerId:     raw.customerId    || raw.customer?._id || raw.customer?.id || '',
    invoiceDate:    raw.invoiceDate   || raw.date || raw.createdAt || new Date().toISOString().split('T')[0],
    vehicle:        raw.vehicle       || raw.model || raw.vehicleModel || raw.linkedVehicle?.model || '',
    regNo:          raw.regNo         || raw.registrationNo || raw.linkedVehicle?.regNo || '',
    frameNo:        raw.frameNo       || '',
    engineNo:       raw.engineNo      || '',
    paymentMode:    raw.paymentMode   || 'CASH',
    status:         raw.status        || 'Active',
    importedFrom:   raw.importedFrom  || null,
    importError:    raw.importError   || null,
    invoiceType:    raw.invoiceType   || 'service',
    items,
    totals: { subtotal, gstRate, gstAmount: gstAmt, totalAmount: total },
    rawText: raw.rawText || null,
  };
};

// ── Recalculate totals — per-item GST (some items 0%, some 18%) ───────────────
const recalcTotals = (items, defaultGstRate = 18) => {
  const subtotal = items.reduce((s, i) => s + (parseFloat(i.total) || parseFloat(i.unitPrice) * parseFloat(i.quantity) || 0), 0);
  // Per-item GST: use item.gstRate if set, otherwise defaultGstRate
  const gstAmount = items.reduce((s, i) => {
    const itemTotal = parseFloat(i.total) || parseFloat(i.unitPrice) * parseFloat(i.quantity) || 0;
    const rate = i.gstRate !== undefined && i.gstRate !== null ? parseFloat(i.gstRate) : defaultGstRate;
    return s + Math.round(itemTotal * rate / 100 * 100) / 100;
  }, 0);
  const effectiveRate = subtotal > 0 ? Math.round(gstAmount / subtotal * 100) : 0;
  return { subtotal, gstRate: effectiveRate, gstAmount, totalAmount: Math.round((subtotal + gstAmount) * 100) / 100 };
};

export default function InvoiceDetailsPage() {
  const params = useParams();
  // Handle both :invoiceId and :invoiceid route param names
  const invoiceId = params.invoiceId || params.invoiceid || params.id;
  const navigate      = useNavigate();
  const [invoice,  setInvoice]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [editing,  setEditing]  = useState(false);
  const [editItems, setEditItems] = useState([]);
  const [editGstRate, setEditGstRate] = useState(18);
  const [editCustomer, setEditCustomer] = useState({});
  const [saveMsg, setSaveMsg]  = useState('');

  useEffect(() => { 
    if (invoiceId && !invoiceId.startsWith(':')) {
      loadInvoiceDetails(); 
    } else {
      setLoading(false);
      setError('Invalid invoice ID। कृपया Invoice list से View बटन दबाएं।');
    }
  }, [invoiceId]);

  const loadInvoiceDetails = async () => {
    setLoading(true);
    setError('');
    try {
      let raw = null;
      const sources = [
        ...getLS('invoices'),
        ...getLS('generatedInvoices'),
        ...getLS('jobCards'),
      ];
      raw = sources.find(i =>
        String(i.invoiceNumber || i.id || i._id) === String(invoiceId)
      );
      // Only call backend if invoiceId looks valid (not :param literal, not too short)
      if (!raw && invoiceId && invoiceId.length > 2 && /^[a-zA-Z0-9\-_]+$/.test(invoiceId)) {
        try { const res = await fetch(api(`/api/invoices/${invoiceId}`)); if (res.ok) raw = await res.json(); } catch {}
      }
      if (!raw && invoiceId && invoiceId.length > 2 && /^[a-zA-Z0-9\-_]+$/.test(invoiceId)) {
        try { const res = await fetch(api(`/api/reminders/${invoiceId}`)); if (res.ok) raw = await res.json(); } catch {}
      }
      if (raw) {
        const inv = normalizeInvoice(raw);
        setInvoice(inv);
        setEditItems(JSON.parse(JSON.stringify(inv.items)));
        setEditGstRate(inv.totals.gstRate);
        setEditCustomer({
          customerName: inv.customerName,
          customerPhone: inv.customerPhone,
          vehicle: inv.vehicle,
          regNo: inv.regNo,
        });
      } else {
        setError(`Invoice #${invoiceId} नहीं मिला।`);
      }
    } catch (err) {
      console.error('Error loading invoice:', err);
      setError('Invoice load करने में error: ' + err.message);
    }
    setLoading(false);
  };

  // ── Edit functions ──────────────────────────────────────────────────────────
  const startEdit = () => {
    setEditItems(JSON.parse(JSON.stringify(invoice.items)));
    setEditGstRate(invoice.totals.gstRate);
    setEditCustomer({
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone,
      vehicle: invoice.vehicle,
      regNo: invoice.regNo,
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditItems(JSON.parse(JSON.stringify(invoice.items)));
  };

  const updateItem = (idx, field, value) => {
    const updated = [...editItems];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'unitPrice' || field === 'quantity') {
      const price = parseFloat(field === 'unitPrice' ? value : updated[idx].unitPrice) || 0;
      const qty   = parseFloat(field === 'quantity'  ? value : updated[idx].quantity)  || 1;
      updated[idx].total = Math.round(price * qty * 100) / 100;
    }
    setEditItems(updated);
  };

  const addNewItem = () => {
    setEditItems([...editItems, {
      _id: `new-${Date.now()}`,
      partNo: '', description: '', hsn: '', mrp: 0,
      quantity: 1, unitPrice: 0, total: 0,
    }]);
  };

  const removeItem = (idx) => {
    if (editItems.length <= 1 && !window.confirm('सभी items delete करें?')) return;
    setEditItems(editItems.filter((_, i) => i !== idx));
  };

  const saveChanges = () => {
    const pwd = prompt('Admin password डालें (save करने के लिए):');
    if (pwd !== 'vphonda@123') { alert('❌ गलत password!'); return; }

    const newTotals = recalcTotals(editItems, parseFloat(editGstRate) || 18);
    const updatedInvoice = {
      ...invoice,
      customerName: editCustomer.customerName,
      customerPhone: editCustomer.customerPhone,
      vehicle: editCustomer.vehicle,
      regNo: editCustomer.regNo,
      items: editItems,
      parts: editItems,
      totals: newTotals,
      totalAmount: newTotals.totalAmount,
      amount: newTotals.totalAmount,
      lastEditedAt: new Date().toISOString(),
    };

    // Save to localStorage — update in 'invoices' key
    const allInvoices = getLS('invoices', []);
    const idx = allInvoices.findIndex(i => String(i.invoiceNumber || i.id) === String(invoiceId));
    if (idx >= 0) {
      allInvoices[idx] = { ...allInvoices[idx], ...updatedInvoice };
    } else {
      allInvoices.push(updatedInvoice);
    }
    setLS('invoices', allInvoices);

    setInvoice(updatedInvoice);
    setEditing(false);
    setSaveMsg('✅ Invoice saved! Items, amounts, customer info updated.');
    setTimeout(() => setSaveMsg(''), 4000);
  };

  // ── Download PDF — VP Honda Tax Invoice format ───────────────────────────────
  const downloadPDF = () => {
    if (!invoice) return;
    const inv = editing ? { ...invoice, items: editItems, totals: recalcTotals(editItems, editGstRate) } : invoice;
    const totals = inv.totals;
    const items = inv.items || [];
    
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tax Invoice #${inv.invoiceNumber}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:10px;margin:15px;color:#000}
  h2{text-align:center;margin:5px 0;font-size:16px}
  table{width:100%;border-collapse:collapse;margin:5px 0}
  th,td{border:1px solid #333;padding:4px 6px;text-align:left;font-size:9px}
  th{background:#e8e8e8;font-weight:bold}
  .center{text-align:center} .right{text-align:right} .bold{font-weight:bold}
  .header-row td{background:#f5f5f5;font-weight:bold}
  .no-border{border:none} .total-row{background:#f0f0f0;font-weight:bold}
</style></head><body>
<h2>TAX INVOICE</h2>
<table>
  <tr><td width="50%"><b>Invoice No:</b> ${inv.invoiceNumber}</td>
      <td><b>Invoice Date:</b> ${new Date(inv.invoiceDate).toLocaleDateString('en-IN')}</td></tr>
  <tr><td><b>Veh Number:</b> ${inv.regNo || '—'}</td>
      <td><b>Payment Mode:</b> ${inv.paymentMode || 'CASH'}</td></tr>
</table>

<table>
  <tr class="header-row"><td colspan="2" class="center"><b>Supplier Details</b></td>
      <td colspan="2" class="center"><b>Bill To (Customer)</b></td></tr>
  <tr><td><b>Dealer:</b></td><td>V P HONDA</td>
      <td><b>Name:</b></td><td>${inv.customerName}</td></tr>
  <tr><td><b>Address:</b></td><td>Narsinghgarh Road, Parwaliya Sadak, Bhopal</td>
      <td><b>Phone:</b></td><td>${inv.customerPhone || '—'}</td></tr>
  <tr><td><b>GSTIN:</b></td><td>23BCYPD9538B1ZG</td>
      <td><b>Vehicle:</b></td><td>${inv.vehicle || '—'}</td></tr>
  <tr><td><b>Phone:</b></td><td>9713394738</td>
      <td><b>Reg No:</b></td><td>${inv.regNo || '—'}</td></tr>
</table>

<table>
  <tr><th class="center">#</th><th>Part No</th><th>Description</th><th class="center">Qty</th>
      <th class="right">MRP (₹)</th><th class="right">Taxable Amt (₹)</th></tr>
  ${items.map((item, i) => `<tr>
    <td class="center">${i+1}</td><td>${item.partNo||'—'}</td><td>${item.description||'—'}</td>
    <td class="center">${item.quantity||1}</td>
    <td class="right">${(parseFloat(item.mrp)||parseFloat(item.unitPrice)||0).toFixed(2)}</td>
    <td class="right bold">${(parseFloat(item.total)||0).toFixed(2)}</td>
  </tr>`).join('')}
  <tr class="total-row">
    <td colspan="5" class="right">Subtotal:</td>
    <td class="right">₹${(totals.subtotal||0).toFixed(2)}</td></tr>
  <tr class="total-row">
    <td colspan="5" class="right">GST (${totals.gstRate||18}%):</td>
    <td class="right">₹${(totals.gstAmount||0).toFixed(2)}</td></tr>
  <tr class="total-row" style="font-size:12px">
    <td colspan="5" class="right"><b>Total:</b></td>
    <td class="right"><b>₹${(totals.totalAmount||0).toFixed(2)}</b></td></tr>
</table>

<table style="margin-top:10px">
  <tr><td class="no-border" width="60%"><b>Terms and Conditions:</b><br>
    1. All disputes subject to BHOPAL Jurisdiction.<br>
    2. Interest @ 18% on unpaid amount after 45 days.<br>
    3. Goods once sold will not be taken back.</td>
    <td class="no-border" style="text-align:right;vertical-align:bottom">
      <b>For V P HONDA</b><br><br><br>Authorized Signatory</td></tr>
</table>
<p style="text-align:center;font-size:8px;color:#888;margin-top:15px">
  V P Honda, Narsinghgarh Road, Parwaliya Sadak, Bhopal 462030 | GSTIN: 23BCYPD9538B1ZG | Ph: 9340985435, 8103476883
</p></body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  };

  const printInvoice = () => window.print();

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="text-center text-white">
        <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="font-bold">Invoice load हो रहा है...</p>
      </div>
    </div>
  );

  if (error || !invoice) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <Button onClick={() => navigate('/invoice-management')} className="bg-red-700 hover:bg-red-600 text-white flex items-center gap-2">
          <ArrowLeft size={18}/> Back
        </Button>
        <Card className="bg-red-900/20 border-red-500">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle size={24} className="text-red-400"/>
            <div>
              <p className="text-red-300 font-bold">❌ {error || 'Invoice नहीं मिला'}</p>
              <p className="text-slate-400 text-sm mt-1">Invoice #{invoiceId} — localStorage या backend में नहीं है।</p>
            </div>
          </CardContent>
        </Card>
        <Button onClick={loadInvoiceDetails} className="bg-blue-600 hover:bg-blue-700 text-white">🔄 दोबारा try करें</Button>
      </div>
    </div>
  );

  const editTotals = editing ? recalcTotals(editItems, editGstRate) : invoice.totals;
  const displayItems = editing ? editItems : invoice.items;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-5xl mx-auto space-y-4">

        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button onClick={() => navigate('/invoice-management')} className="bg-red-700 hover:bg-red-600 text-white font-bold flex items-center gap-2">
            <ArrowLeft size={18}/> Back
          </Button>
          <h1 className="text-xl font-black text-white">Invoice #{invoice.invoiceNumber}</h1>
          <div className="flex gap-2">
            {!editing && (
              <Button onClick={startEdit} className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold flex items-center gap-2">
                <Edit3 size={16}/> Edit
              </Button>
            )}
            <Button onClick={downloadPDF} className="bg-green-600 hover:bg-green-700 text-white font-bold flex items-center gap-2">
              <Download size={16}/> Download PDF
            </Button>
            <Button onClick={printInvoice} className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2">
              <Printer size={16}/> Print
            </Button>
          </div>
        </div>

        {/* Save message */}
        {saveMsg && (
          <Card className="bg-green-900/20 border-green-500">
            <CardContent className="py-3 px-4">
              <p className="text-green-300 font-bold text-sm">{saveMsg}</p>
            </CardContent>
          </Card>
        )}

        {/* Edit mode bar */}
        {editing && (
          <Card className="bg-yellow-900/30 border-yellow-500">
            <CardContent className="py-3 px-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-yellow-300 font-bold text-sm">✏️ Edit Mode — Parts add/edit/delete करें, Customer info update करें, फिर Save करें</p>
              <div className="flex gap-2">
                <Button onClick={saveChanges} className="bg-green-600 hover:bg-green-700 text-white font-bold flex items-center gap-2 h-8">
                  <Save size={14}/> Save Changes
                </Button>
                <Button onClick={cancelEdit} className="bg-slate-600 hover:bg-slate-700 text-white font-bold flex items-center gap-2 h-8">
                  <X size={14}/> Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PRINTABLE AREA */}
        <div id="invoice-print-area" className="space-y-4">

          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-slate-800 border-slate-600">
              <CardContent className="p-4">
                <p className="text-slate-400 text-xs flex items-center gap-1"><Calendar size={12}/> Invoice Date</p>
                <p className="text-white font-black text-lg mt-1">{safeDate(invoice.invoiceDate)}</p>
              </CardContent>
            </Card>
            <Card className="bg-green-900/30 border-green-600">
              <CardContent className="p-4">
                <p className="text-green-300 text-xs flex items-center gap-1"><IndianRupee size={12}/> Total Amount</p>
                <p className="text-green-400 font-black text-lg mt-1">{fmtINR(editTotals.totalAmount)}</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-900/30 border-blue-600">
              <CardContent className="p-4">
                <p className="text-blue-300 text-xs flex items-center gap-1"><Package size={12}/> Total Items</p>
                <p className="text-blue-400 font-black text-lg mt-1">{displayItems.length}</p>
              </CardContent>
            </Card>
            <Card className={`${invoice.status === 'Active' ? 'bg-yellow-900/30 border-yellow-600' : 'bg-slate-800 border-slate-600'}`}>
              <CardContent className="p-4">
                <p className="text-slate-300 text-xs">Status</p>
                <p className={`font-black text-lg mt-1 ${invoice.status === 'Active' ? 'text-yellow-400' : 'text-slate-300'}`}>
                  {invoice.status}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* PDF Source / Error indicator */}
          {invoice.importedFrom && (
            <Card className={`${invoice.importError ? 'bg-red-900/20 border-red-600' : 'bg-yellow-900/20 border-yellow-600'}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <FileText size={16} className={invoice.importError ? 'text-red-400' : 'text-yellow-400'}/>
                  <div>
                    <p className={`text-sm ${invoice.importError ? 'text-red-300' : 'text-yellow-300'}`}>
                      📄 PDF से import: <span className="font-bold">{invoice.importedFrom}</span>
                    </p>
                    {invoice.importError && (
                      <p className="text-red-400 text-xs mt-1">⚠️ PDF parse error: {invoice.importError} — Edit बटन से manually add करें</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer Information */}
          <Card className="bg-slate-800 border-slate-600">
            <CardHeader className="bg-gradient-to-r from-blue-700 to-blue-800 py-3 px-4">
              <CardTitle className="text-white text-sm flex items-center gap-2"><User size={16}/> Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {editing ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  {[
                    { l:'Name',    k:'customerName',  v:editCustomer.customerName },
                    { l:'Phone',   k:'customerPhone', v:editCustomer.customerPhone },
                    { l:'Vehicle', k:'vehicle',       v:editCustomer.vehicle },
                    { l:'Reg No.', k:'regNo',         v:editCustomer.regNo },
                  ].map((f,i) => (
                    <div key={i}>
                      <p className="text-slate-500 text-xs mb-1">{f.l}</p>
                      <Input value={f.v || ''} onChange={e => setEditCustomer({...editCustomer, [f.k]: e.target.value})}
                        className="bg-slate-700 border-slate-500 text-white text-sm h-8"/>
                    </div>
                  ))}
                  <div>
                    <p className="text-slate-500 text-xs">Customer ID</p>
                    <p className="text-slate-400 font-mono text-xs mt-2">{String(invoice.customerId).slice(0,25)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Invoice #</p>
                    <p className="text-white font-semibold mt-2">{invoice.invoiceNumber}</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  {[
                    { l:'Name',       v:invoice.customerName   },
                    { l:'Phone',      v:invoice.customerPhone || '—' },
                    { l:'Customer ID',v:String(invoice.customerId).slice(0,20)+(String(invoice.customerId).length>20?'...':'') },
                    { l:'Vehicle',    v:invoice.vehicle || '—' },
                    { l:'Reg No.',    v:invoice.regNo || '—'   },
                    { l:'Invoice #',  v:invoice.invoiceNumber  },
                  ].map((f,i) => (
                    <div key={i}>
                      <p className="text-slate-500 text-xs">{f.l}</p>
                      <p className="text-white font-semibold">{f.v || '—'}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parts / Items */}
          <Card className="bg-slate-800 border-slate-600">
            <CardHeader className="bg-gradient-to-r from-purple-700 to-purple-800 py-3 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-white text-sm flex items-center gap-2"><Package size={16}/> Parts / Items Details</CardTitle>
              {editing && (
                <Button onClick={addNewItem} className="bg-green-600 hover:bg-green-700 text-white h-7 px-3 text-xs flex items-center gap-1">
                  <Plus size={12}/> Add Item
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {displayItems.length === 0 ? (
                <div className="py-8 text-center">
                  <Package size={32} className="text-slate-600 mx-auto mb-2"/>
                  <p className="text-slate-400 text-sm">कोई parts/items नहीं मिले।</p>
                  {invoice.importedFrom && (
                    <p className="text-slate-500 text-xs mt-1">PDF से auto-extract नहीं हो पाया — Edit बटन दबाकर manually add करें।</p>
                  )}
                  {!editing && (
                    <Button onClick={startEdit} className="bg-yellow-600 hover:bg-yellow-700 text-white mt-3 flex items-center gap-2 mx-auto">
                      <Plus size={14}/> Manually Add Parts
                    </Button>
                  )}
                </div>
              ) : editing ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-700 border-b border-slate-600">
                      <tr>
                        {['#','Part No','Description','Qty','Unit Price (₹)','Total (₹)',''].map(h => (
                          <th key={h} className="px-2 py-2 text-left text-xs font-bold text-slate-300">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {editItems.map((item, i) => (
                        <tr key={item._id || i} className="border-b border-slate-700">
                          <td className="px-2 py-1.5 text-slate-500 text-xs">{i+1}</td>
                          <td className="px-1 py-1.5">
                            <Input value={item.partNo} onChange={e => updateItem(i,'partNo',e.target.value)}
                              className="bg-slate-700 border-slate-500 text-white text-xs h-7 w-36" placeholder="Part No"/>
                          </td>
                          <td className="px-1 py-1.5">
                            <Input value={item.description} onChange={e => updateItem(i,'description',e.target.value)}
                              className="bg-slate-700 border-slate-500 text-white text-xs h-7 w-48" placeholder="Description"/>
                          </td>
                          <td className="px-1 py-1.5">
                            <Input type="number" value={item.quantity} onChange={e => updateItem(i,'quantity',e.target.value)}
                              className="bg-slate-700 border-slate-500 text-white text-xs h-7 w-16 text-center" min="1"/>
                          </td>
                          <td className="px-1 py-1.5">
                            <Input type="number" value={item.unitPrice} onChange={e => updateItem(i,'unitPrice',e.target.value)}
                              className="bg-slate-700 border-slate-500 text-white text-xs h-7 w-24 text-right" step="0.01"/>
                          </td>
                          <td className="px-2 py-1.5 text-green-400 font-bold text-xs text-right">
                            {fmtINR(parseFloat(item.total) || parseFloat(item.unitPrice) * parseFloat(item.quantity) || 0)}
                          </td>
                          <td className="px-1 py-1.5">
                            <Button onClick={() => removeItem(i)} className="bg-red-700 hover:bg-red-600 text-white h-7 w-7 p-0">
                              <Trash2 size={12}/>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-700 border-b border-slate-600">
                      <tr>
                        {['#','Part No','Description','Qty','MRP (₹)','Taxable (₹)','GST%'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-bold text-slate-300">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item, i) => (
                        <tr key={i} className={`border-b border-slate-700 ${i%2===0?'bg-slate-800':'bg-slate-800/60'}`}>
                          <td className="px-4 py-2.5 text-slate-500 text-xs">{i+1}</td>
                          <td className="px-4 py-2.5 text-slate-300 text-xs font-mono">{item.partNo || '—'}</td>
                          <td className="px-4 py-2.5 text-white font-medium">{item.description || '—'}</td>
                          <td className="px-4 py-2.5 text-center text-blue-300 font-bold">{item.quantity}</td>
                          <td className="px-4 py-2.5 text-right text-slate-300">{fmtINR(item.mrp || item.unitPrice)}</td>
                          <td className="px-4 py-2.5 text-right text-green-400 font-bold">{fmtINR(item.total)}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${item.gstRate > 0 ? 'bg-yellow-900 text-yellow-300' : 'bg-slate-700 text-slate-400'}`}>
                              {item.gstRate !== undefined ? item.gstRate : 18}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Totals */}
          <Card className="bg-slate-800 border-slate-600">
            <CardContent className="pt-4">
              <div className="max-w-sm ml-auto space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Subtotal:</span>
                  <span className="text-slate-300">{fmtINR(editTotals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm items-center gap-2">
                  <span className="text-slate-400 flex items-center gap-1">
                    GST
                    {editing ? (
                      <span className="flex items-center gap-1">
                        (<Input type="number" value={editGstRate} onChange={e => setEditGstRate(e.target.value)}
                          className="bg-slate-700 border-slate-500 text-white text-xs h-6 w-14 text-center inline-block" min="0" max="28" step="1"/>%)
                      </span>
                    ) : (
                      ` (${editTotals.gstRate}%${editTotals.gstRate !== 18 && editTotals.gstRate !== 0 ? ' mixed' : ''})`
                    )}:
                  </span>
                  <span className="text-yellow-400">{fmtINR(editTotals.gstAmount)}</span>
                </div>
                <div className="border-t border-slate-600 pt-2 flex justify-between font-black text-lg">
                  <span className="text-white">Total:</span>
                  <span className="text-green-400">{fmtINR(editTotals.totalAmount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit mode bottom save bar */}
          {editing && (
            <div className="flex justify-end gap-3">
              <Button onClick={cancelEdit} className="bg-slate-600 hover:bg-slate-700 text-white font-bold flex items-center gap-2">
                <X size={16}/> Cancel
              </Button>
              <Button onClick={saveChanges} className="bg-green-600 hover:bg-green-700 text-white font-bold flex items-center gap-2 px-6">
                <Save size={16}/> Save All Changes
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}