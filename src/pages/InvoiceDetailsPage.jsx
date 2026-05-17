import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Edit2, Download, Printer, Trash2, Plus, AlertCircle } from 'lucide-react';
import { api } from '../utils/apiConfig';
import html2pdf from 'html2pdf.js';

const getLS = (k, fb=null) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : fb;
  } catch {
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

export default function InvoiceDetailsPage() {
  const { invoiceNo } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedItems, setEditedItems] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadInvoice();
  }, [invoiceNo]);

  const loadInvoice = async () => {
    // Try database first
    try {
      const res = await fetch(api(`/api/invoices/${invoiceNo}`));
      if (res.ok) {
        const inv = await res.json();
        setInvoice(inv);
        setEditedItems(inv.items || []);
        setLoading(false);
        return;
      }
    } catch(e) {}

    // Try localStorage
    const allInvoices = getLS('invoices', []);
    const inv = allInvoices.find(i => String(i.invoiceNumber) === String(invoiceNo));
    
    if (inv) {
      setInvoice(inv);
      setEditedItems(inv.items || []);
    }
    
    setLoading(false);
  };

  const handleAddPart = () => {
    const newPart = {
      partNo: '',
      description: '',
      qty: 1,
      mrp: 0,
      taxableAmount: 0,
      sgst: 0,
      cgst: 0,
      gstRate: 0,
      total: 0
    };
    setEditedItems([...editedItems, newPart]);
  };

  const handleUpdatePart = (idx, field, value) => {
    const updated = [...editedItems];
    const item = updated[idx];

    if (field === 'qty' || field === 'mrp' || field === 'taxableAmount') {
      item[field] = parseFloat(value) || 0;
    } else if (field === 'gstRate') {
      item.gstRate = parseInt(value) || 0;
      item.sgst = Math.round((item.taxableAmount * item.gstRate / 200) * 100) / 100;
      item.cgst = item.sgst;
    } else {
      item[field] = value;
    }

    // Recalculate totals
    item.total = item.taxableAmount + item.sgst + item.cgst;
    setEditedItems(updated);
  };

  const handleDeletePart = (idx) => {
    setEditedItems(editedItems.filter((_, i) => i !== idx));
  };

  const calculateTotals = () => {
    const subtotal = editedItems.reduce((s, item) => s + (item.taxableAmount || 0), 0);
    const totalGST = editedItems.reduce((s, item) => s + (item.sgst || 0) + (item.cgst || 0), 0);
    const grandTotal = subtotal + totalGST;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalGST: Math.round(totalGST * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100
    };
  };

  const handleSave = async () => {
    const totals = calculateTotals();
    const updated = {
      ...invoice,
      items: editedItems,
      subtotal: totals.subtotal,
      totalGST: totals.totalGST,
      grandTotal: totals.grandTotal,
      updatedAt: new Date().toISOString()
    };

    // Update localStorage
    const allInvoices = getLS('invoices', []);
    const idx = allInvoices.findIndex(i => String(i.invoiceNumber) === String(invoiceNo));
    if (idx >= 0) {
      allInvoices[idx] = updated;
      saveLS('invoices', allInvoices);
    }

    // Try to save to database
    try {
      await fetch(api(`/api/invoices/${invoiceNo}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch(e) {
      console.warn('DB update error:', e);
    }

    setInvoice(updated);
    setIsEditing(false);
    setMessage('✅ Invoice updated!');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('invoice-print');
    const opt = {
      margin: 10,
      filename: `invoice-${invoiceNo}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    };
    html2pdf().set(opt).from(element).save();
  };

  const handlePrint = () => {
    const element = document.getElementById('invoice-print');
    const win = window.open('', '_blank');
    win.document.write(element.innerHTML);
    win.document.close();
    setTimeout(() => win.print(), 250);
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <Button onClick={() => navigate('/management')} className="bg-red-700 hover:bg-red-600 text-white font-bold flex items-center gap-2 mb-6">
            <ArrowLeft size={18} /> Back
          </Button>
          <Card className="bg-red-900/20 border-red-500">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="text-red-400" size={24} />
                <p className="text-red-300 font-bold">Invoice नहीं मिला</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <Button 
            onClick={() => navigate('/management')}
            className="bg-red-700 hover:bg-red-600 text-white font-bold flex items-center gap-2"
          >
            <ArrowLeft size={18} /> Back
          </Button>
          <h1 className="text-2xl font-bold text-white">Invoice #{invoiceNo}</h1>
          <div className="flex gap-2">
            <Button 
              onClick={() => setIsEditing(!isEditing)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2"
            >
              <Edit2 size={16} /> {isEditing ? 'Cancel' : 'Edit'}
            </Button>
            {!isEditing && (
              <>
                <Button 
                  onClick={handleDownloadPDF}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold flex items-center gap-2"
                >
                  <Download size={16} /> PDF
                </Button>
                <Button 
                  onClick={handlePrint}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold flex items-center gap-2"
                >
                  <Printer size={16} /> Print
                </Button>
              </>
            )}
          </div>
        </div>

        {message && (
          <Card className="bg-green-900/20 border-green-500">
            <CardContent className="pt-3 pb-3">
              <p className="text-green-300 font-bold text-sm">{message}</p>
            </CardContent>
          </Card>
        )}

        {/* Invoice Details Card */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800">
            <CardTitle className="text-white">📄 Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 pb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-400">Invoice No.</p>
                <p className="text-lg font-bold text-white">#{invoice.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Date</p>
                <p className="text-lg font-bold text-white">{new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Type</p>
                <p className="text-lg font-bold">
                  {invoice.invoiceType === 'vehicle' 
                    ? <span className="text-orange-400">🏍️ Vehicle</span>
                    : <span className="text-green-400">🔧 Service</span>
                  }
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Status</p>
                <p className="text-lg font-bold text-yellow-400">{invoice.status || 'Active'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Info Card */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800">
            <CardTitle className="text-white">👤 Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-slate-400">Customer Name</p>
                <p className="text-lg font-bold text-slate-200">{invoice.customerName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Phone</p>
                <p className="text-lg font-bold text-slate-200">{invoice.customerPhone || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Vehicle</p>
                <p className="text-lg font-bold text-blue-300">{invoice.vehicle || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Registration No.</p>
                <p className="text-lg font-bold text-slate-200">{invoice.regNo || '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Parts/Items Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 flex justify-between items-center py-3">
            <CardTitle className="text-white">📦 Parts/Items Details</CardTitle>
            {isEditing && (
              <Button 
                onClick={handleAddPart}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1 h-8 px-3 text-xs"
              >
                <Plus size={14} /> Add Part
              </Button>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {editedItems.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <AlertCircle className="mx-auto mb-2" size={32} />
                <p>कोई parts नहीं।</p>
                {isEditing && (
                  <Button 
                    onClick={handleAddPart}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2"
                  >
                    <Plus size={14} className="mr-1" /> Add First Part
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-700 border-b border-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-bold text-slate-300">Part No</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-slate-300">Description</th>
                      <th className="px-3 py-2 text-center text-xs font-bold text-slate-300">Qty</th>
                      <th className="px-3 py-2 text-right text-xs font-bold text-slate-300">MRP</th>
                      <th className="px-3 py-2 text-right text-xs font-bold text-slate-300">Taxable</th>
                      <th className="px-3 py-2 text-center text-xs font-bold text-slate-300">GST %</th>
                      <th className="px-3 py-2 text-right text-xs font-bold text-slate-300">SGST</th>
                      <th className="px-3 py-2 text-right text-xs font-bold text-slate-300">CGST</th>
                      <th className="px-3 py-2 text-right text-xs font-bold text-slate-300">Total</th>
                      {isEditing && <th className="px-3 py-2 text-center text-xs font-bold text-slate-300">Action</th>}
                    </tr>
                  </thead>

                  <tbody>
                    {editedItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-700 hover:bg-slate-700/50">
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <Input
                              value={item.partNo}
                              onChange={e => handleUpdatePart(idx, 'partNo', e.target.value)}
                              className="h-7 text-xs bg-slate-700 border-slate-600 text-white"
                              placeholder="Part No"
                            />
                          ) : (
                            <span className="text-slate-200 font-mono font-bold">{item.partNo}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <Input
                              value={item.description}
                              onChange={e => handleUpdatePart(idx, 'description', e.target.value)}
                              className="h-7 text-xs bg-slate-700 border-slate-600 text-white"
                              placeholder="Description"
                            />
                          ) : (
                            <span className="text-slate-300">{item.description}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={item.qty}
                              onChange={e => handleUpdatePart(idx, 'qty', e.target.value)}
                              className="h-7 text-xs bg-slate-700 border-slate-600 text-white text-center"
                              min="0"
                            />
                          ) : (
                            <span className="text-slate-200 font-bold">{item.qty}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={item.mrp}
                              onChange={e => handleUpdatePart(idx, 'mrp', e.target.value)}
                              className="h-7 text-xs bg-slate-700 border-slate-600 text-white text-right"
                              step="0.01"
                            />
                          ) : (
                            <span className="text-slate-300">₹{item.mrp.toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={item.taxableAmount}
                              onChange={e => handleUpdatePart(idx, 'taxableAmount', e.target.value)}
                              className="h-7 text-xs bg-slate-700 border-slate-600 text-white text-right"
                              step="0.01"
                            />
                          ) : (
                            <span className="text-slate-300 font-bold">₹{item.taxableAmount.toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={item.gstRate}
                              onChange={e => handleUpdatePart(idx, 'gstRate', e.target.value)}
                              className="h-7 text-xs bg-slate-700 border-slate-600 text-white text-center"
                            />
                          ) : (
                            <span className="text-yellow-400 font-bold">{item.gstRate}%</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="text-yellow-300 font-bold">₹{item.sgst.toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="text-yellow-300 font-bold">₹{item.cgst.toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="text-green-400 font-black">₹{item.total.toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
                        </td>
                        {isEditing && (
                          <td className="px-3 py-2 text-center">
                            <Button 
                              onClick={() => handleDeletePart(idx)}
                              className="bg-red-700 hover:bg-red-600 text-white h-7 px-2 text-xs"
                            >
                              <Trash2 size={12} />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>

                  <tfoot className="bg-slate-700 border-t-2 border-slate-600">
                    <tr className="font-bold">
                      <td colSpan="4" className="px-3 py-3 text-slate-300">Subtotal</td>
                      <td className="px-3 py-3 text-right text-slate-200">₹{totals.subtotal.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
                      <td colSpan="3" className="px-3 py-3 text-right text-yellow-400">GST: ₹{totals.totalGST.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
                      <td className="px-3 py-3 text-right text-white">Grand Total</td>
                      <td colSpan="2" className="px-3 py-3 text-right text-green-400 text-lg">₹{totals.grandTotal.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-900/20 border-blue-500">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-400">Subtotal (Taxable)</p>
              <h3 className="text-2xl font-black text-blue-400 mt-1">₹{totals.subtotal.toLocaleString('en-IN')}</h3>
            </CardContent>
          </Card>

          <Card className="bg-yellow-900/20 border-yellow-500">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-400">Total GST (SGST + CGST)</p>
              <h3 className="text-2xl font-black text-yellow-400 mt-1">₹{totals.totalGST.toLocaleString('en-IN')}</h3>
            </CardContent>
          </Card>

          <Card className="bg-green-900/20 border-green-500">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-400">Grand Total</p>
              <h3 className="text-2xl font-black text-green-400 mt-1">₹{totals.grandTotal.toLocaleString('en-IN')}</h3>
            </CardContent>
          </Card>
        </div>

        {/* Save Button (when editing) */}
        {isEditing && (
          <Button 
            onClick={handleSave}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 text-lg"
          >
            ✅ Save Changes
          </Button>
        )}

        {/* Print Preview Area (hidden) */}
        <div id="invoice-print" className="hidden">
          <div style={{padding: '20px', fontFamily: 'Arial, sans-serif', fontSize: '12px'}}>
            <h1 style={{textAlign: 'center', marginBottom: '10px'}}>VP HONDA - Invoice</h1>
            <div style={{marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px'}}>
              <p><strong>Invoice No:</strong> {invoice.invoiceNumber}</p>
              <p><strong>Date:</strong> {new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</p>
              <p><strong>Customer:</strong> {invoice.customerName}</p>
              <p><strong>Phone:</strong> {invoice.customerPhone}</p>
              <p><strong>Vehicle:</strong> {invoice.vehicle} ({invoice.regNo})</p>
            </div>
            
            <table style={{width: '100%', borderCollapse: 'collapse', marginBottom: '20px'}}>
              <thead>
                <tr style={{backgroundColor: '#f0f0f0'}}>
                  <th style={{border: '1px solid #ccc', padding: '8px', textAlign: 'left'}}>Part No</th>
                  <th style={{border: '1px solid #ccc', padding: '8px', textAlign: 'left'}}>Description</th>
                  <th style={{border: '1px solid #ccc', padding: '8px', textAlign: 'center'}}>Qty</th>
                  <th style={{border: '1px solid #ccc', padding: '8px', textAlign: 'right'}}>Taxable Amount</th>
                  <th style={{border: '1px solid #ccc', padding: '8px', textAlign: 'center'}}>GST %</th>
                  <th style={{border: '1px solid #ccc', padding: '8px', textAlign: 'right'}}>GST Amount</th>
                  <th style={{border: '1px solid #ccc', padding: '8px', textAlign: 'right'}}>Total</th>
                </tr>
              </thead>
              <tbody>
                {editedItems.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{border: '1px solid #ccc', padding: '8px'}}>{item.partNo}</td>
                    <td style={{border: '1px solid #ccc', padding: '8px'}}>{item.description}</td>
                    <td style={{border: '1px solid #ccc', padding: '8px', textAlign: 'center'}}>{item.qty}</td>
                    <td style={{border: '1px solid #ccc', padding: '8px', textAlign: 'right'}}>₹{item.taxableAmount.toFixed(2)}</td>
                    <td style={{border: '1px solid #ccc', padding: '8px', textAlign: 'center'}}>{item.gstRate}%</td>
                    <td style={{border: '1px solid #ccc', padding: '8px', textAlign: 'right'}}>₹{(item.sgst + item.cgst).toFixed(2)}</td>
                    <td style={{border: '1px solid #ccc', padding: '8px', textAlign: 'right'}}>₹{item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{marginTop: '20px', textAlign: 'right'}}>
              <p><strong>Subtotal:</strong> ₹{totals.subtotal.toFixed(2)}</p>
              <p><strong>Total GST:</strong> ₹{totals.totalGST.toFixed(2)}</p>
              <p style={{fontSize: '16px'}}><strong>Grand Total: ₹{totals.grandTotal.toFixed(2)}</strong></p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
