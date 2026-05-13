import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EventBus, EVENTS } from '../utils/EventBus';
import { Plus, Printer, Eye, Download, Trash2, Search, Filter, X } from 'lucide-react';
import { api } from '../utils/apiConfig';

export default function JobCardPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [newCustomers, setNewCustomers] = useState([]);
  const [parts, setParts] = useState([]);
  const [selectedParts, setSelectedParts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showInvoiceHistory, setShowInvoiceHistory] = useState(false);
  const [invoiceHistory, setInvoiceHistory] = useState([]);
  const [customerType, setCustomerType] = useState('existing');

  const [currentPage, setCurrentPage] = useState(1);
  const INVOICES_PER_PAGE = 5;

  // Invoice History Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [formData, setFormData] = useState({
    invoiceNo: '001',
    customerId: '',
    service: '1st Service',
    serviceType: 'Paid Service',
    serviceKm: 0,
    amc: 'NO',
    labourCharges: 0,
    paymentMode: 'CASH',
    invoiceDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    console.log('🔄 Loading data on mount...');
    loadAllData();
  }, []);

  // ===== EVENT BUS SUBSCRIPTION =====
  useEffect(() => {
    const unsubscribe = EventBus.subscribe(EVENTS.DASHBOARD_REFRESH, () => {
      console.log('📢 JobCardPage: Refreshing...');
      loadAllData();
    });
    return () => unsubscribe();
  }, []);

  const normalizeCustomer = (customer) => ({
    ...customer,
    name:  customer.customerName || customer.name  || customer.mobileNo || customer.phone || '',
    phone: customer.mobileNo     || customer.phone || '',
    customerName: customer.customerName || customer.name  || '',
    mobileNo:     customer.mobileNo     || customer.phone || '',
    linkedVehicle: typeof customer.linkedVehicle === 'string'
      ? { name: customer.vehicleModel || '', regNo: customer.registrationNo || customer.regNo || '', engineNo: customer.engineNo || '', chassisNo: customer.chassisNo || '', color: customer.color || '', model: customer.vehicleModel || '', menuFactureDate: null, sellingDate: customer.purchaseDate || customer.invoiceDate || null }
      : customer.linkedVehicle
        ? { ...customer.linkedVehicle,
            name:     customer.linkedVehicle.name      || customer.linkedVehicle.model  || customer.vehicleModel || '',
            regNo:    customer.linkedVehicle.regNo     || customer.registrationNo        || customer.regNo        || '',
            engineNo: customer.linkedVehicle.engineNo  || customer.engineNo  || '',
            chassisNo:customer.linkedVehicle.chassisNo || customer.chassisNo || '',
            color:    customer.linkedVehicle.color     || customer.color     || '',
            model:    customer.linkedVehicle.model     || customer.vehicleModel || '',
          }
        : { name: customer.vehicleModel || '', regNo: customer.registrationNo || customer.regNo || '', engineNo: customer.engineNo || '', chassisNo: customer.chassisNo || '', color: customer.color || '', model: customer.vehicleModel || '', menuFactureDate: null, sellingDate: customer.purchaseDate || customer.invoiceDate || null },
  });

  const loadAllData = async () => {
    // ✅ Load from localStorage cache first (instant on mobile)
    try {
      const cached = localStorage.getItem('vpCustomers');
      if (cached) {
        const cachedData = JSON.parse(cached).map(normalizeCustomer);
        if (cachedData.length > 0) setCustomers(cachedData);
      }
    } catch {}

    console.log('📦 Starting to load all data...');
    
    try {
      // Load existing customers from API
      try {
        const custRes = await fetch(api('/api/customers'));
        if (custRes.ok) {
          let custData = await custRes.json();
          custData = custData.map(normalizeCustomer);
          setCustomers(custData || []);
          // ✅ Cache for mobile offline/slow connection
          try { localStorage.setItem('vpCustomers', JSON.stringify(custData)); } catch {}
        }
      } catch (e) {
        console.warn('⚠️ Error loading customers:', e);
      }

      // Load parts
      console.log('🔧 Loading parts...');
      try {
        const partRes = await fetch(api('/api/parts'));
        if (partRes.ok) {
          const partData = await partRes.json();
          setParts(partData || []);
          console.log('✅ Parts loaded:', partData.length);
        }
      } catch (e) {
        console.warn('⚠️ Error loading parts:', e);
      }

      // Load invoices from localStorage (PRIMARY SOURCE)
      console.log('💾 Loading invoices from localStorage...');
      const savedInvoices = JSON.parse(localStorage.getItem('invoices')) || [];
      console.log('✅ LocalStorage invoices loaded:', savedInvoices.length);
      setInvoiceHistory(savedInvoices);
      // ✅ ADD: Database connection for invoices
      const loadInvoicesFromDB = async () => {
        try {
         const response = await fetch(api('/api/invoices'));
         if (response.ok) {
           const dbInvoices = await response.json();
           setInvoiceHistory(dbInvoices);
           // Also save to localStorage as backup
           localStorage.setItem('invoices', JSON.stringify(dbInvoices));
          }
        } catch (error) {
          console.warn('Could not load from DB, using localStorage:', error);
        }
      };
      // Line 95 में ये call करो:
      loadInvoicesFromDB();

      // ✅ ADD: Auto-create reminder when invoice is saved
      const createReminder = async (invoiceId, customerId) => {
         try {
           const response = await fetch(api('/api/reminders'), {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               invoiceId,
               customerId,
               reminderType: 'tax-invoice'
             })
           });
    
           if (response.ok) {
             console.log('✅ Reminder created');
           }
         } catch (error) {
           console.warn('Could not create reminder:', error);
         }
       };
      // Calculate next invoice number
      const maxInvoiceNum = savedInvoices.length > 0 
        ? Math.max(...savedInvoices.map(inv => parseInt(inv.invoiceNumber) || 0))
        : 0;
      const nextNum = (maxInvoiceNum + 1).toString().padStart(3, '0');
      setFormData(prev => ({...prev, invoiceNo: nextNum}));

      // Load new customers
      const savedNewCustomers = JSON.parse(localStorage.getItem('newCustomers')) || [];
      setNewCustomers(savedNewCustomers);
      
    } catch (error) {
      console.error('❌ Error loading data:', error);
    }
  };

  const reloadInvoiceHistory = () => {
    console.log('🔄 Reloading invoice history...');
    const savedInvoices = JSON.parse(localStorage.getItem('invoices')) || [];
    setInvoiceHistory(savedInvoices);
  };

  // ✅ FILTER INVOICES
  const getFilteredInvoices = () => {
    let filtered = [...invoiceHistory];

    // Search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(inv =>
        inv.invoiceNumber.toLowerCase().includes(search) ||
        inv.customerName.toLowerCase().includes(search)
      );
    }

    // Date range filter
    if (fromDate) {
      const from = new Date(fromDate);
      filtered = filtered.filter(inv => new Date(inv.invoiceDate) >= from);
    }

    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(inv => new Date(inv.invoiceDate) <= to);
    }

    return filtered;
  };

  // ✅ CALCULATE STATISTICS
  const getStatistics = () => {
    const filtered = getFilteredInvoices();
    
    if (filtered.length === 0) {
      return {
        totalInvoices: 0,
        totalRevenue: 0,
        averageValue: 0
      };
    }

    const totalRevenue = filtered.reduce((sum, inv) => sum + (inv.totals?.totalAmount || 0), 0);
    
    return {
      totalInvoices: filtered.length,
      totalRevenue: totalRevenue,
      averageValue: totalRevenue / filtered.length
    };
  };

  const addPart = (partId) => {
    const part = parts.find(p => p._id === partId);
    if (!part || selectedParts.find(p => p._id === partId)) return;
    
    const hsnCode = part.hsnCode || 'NA';
    const defaultGstRate = (hsnCode === 'NA') ? 0 : (part.gstRate !== undefined ? part.gstRate : 18);
    setSelectedParts([...selectedParts, {
      _id: partId,
      partNo: part.partNo || '',
      description: part.description || '',
      hsnCode: hsnCode,
      mrp: part.mrp || 0,
      mrpDis: part.mrpDis || 0,
      unitPrice: part.unitPrice || part.price || 0,
      quantity: 1,
      discount: 5,
      gstRate: defaultGstRate
    }]);
  };

  const updatePart = (idx, field, value) => {
    const updated = [...selectedParts];
    updated[idx][field] = (field === 'quantity' || field === 'discount' || field === 'gstRate') 
      ? (parseInt(value) || 0) 
      : value;
    setSelectedParts(updated);
  };

  const removePart = (idx) => {
    setSelectedParts(selectedParts.filter((_, i) => i !== idx));
  };

  const calculateTaxableAmount = (part) => {
    const totalAmount = part.unitPrice * part.quantity;
    const discountAmount = totalAmount * (part.discount / 100);
    return totalAmount - discountAmount;
  };

  const calculateTotals = () => {
    let taxableTotal = 0;
    let taxTotal = 0;
    selectedParts.forEach(part => {
      const taxable = calculateTaxableAmount(part);
      const rate = (part.gstRate !== undefined ? part.gstRate : 18) / 100;
      taxableTotal += taxable;
      taxTotal += taxable * rate;
    });
    const partsTotal = taxableTotal + taxTotal;
    const labour = formData.labourCharges || 0;
    return {
      taxableTotal,
      taxTotal,
      partsTotal,
      labour,
      total: partsTotal + labour
    };
  };

  const amountToWords = (num) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    if (num === 0) return 'Zero';
    let result = '';
    const n = Math.floor(num);
    
    if (n >= 100000) result += amountToWords(Math.floor(n / 100000)) + ' Lakh ';
    let remainder = n % 100000;
    if (remainder >= 1000) result += amountToWords(Math.floor(remainder / 1000)) + ' Thousand ';
    remainder %= 1000;
    if (remainder >= 100) result += ones[Math.floor(remainder / 100)] + ' Hundred ';
    remainder %= 100;
    if (remainder >= 20) {
      result += tens[Math.floor(remainder / 10)];
      if (remainder % 10 > 0) result += ' ' + ones[remainder % 10];
    } else if (remainder >= 10) {
      result += teens[remainder - 10];
    } else if (remainder > 0) {
      result += ones[remainder];
    }
    
    return result.trim() + ' Only';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'NOT PROVIDED';
    try {
      return new Date(dateString).toLocaleDateString('en-IN');
    } catch {
      return 'NOT PROVIDED';
    }
  };

  // ✅ DELETE INVOICE
  const deleteInvoice = (invoiceId) => {
    if (window.confirm('❌ क्या आप इस invoice को delete करना चाहते हैं?')) {
      const updatedInvoices = invoiceHistory.filter(inv => inv._id !== invoiceId);
      setInvoiceHistory(updatedInvoices);
      localStorage.setItem('invoices', JSON.stringify(updatedInvoices));
      alert('✅ Invoice deleted!');
    }
  };

  // ✅ DOWNLOAD INVOICE (as PDF via print)
  const downloadInvoice = (invoice) => {
    // Rebuild HTML for this saved invoice and open print dialog
    const v = invoice.vehicleDetails || {};
    const s = invoice.serviceDetails || {};
    const parts = invoice.parts || [];
    const t = invoice.totals || {};

    const hsnRows = {};
    parts.forEach((part, idx) => {
      const hsn = part.hsnCode || 'NA';
      const taxable = part.taxableAmount || 0;
      const gstRate = part.gstRate !== undefined ? part.gstRate : 18;
      const halfRate = gstRate / 2;
      const sgst = taxable * halfRate / 100;
      const cgst = taxable * halfRate / 100;
      hsnRows[`${idx}_${hsn}`] = { srNo: idx + 1, hsn, taxable, sgstRate: halfRate, sgst, cgstRate: halfRate, cgst, totalAmount: taxable + sgst + cgst };
    });

    const invoiceTotal = Math.round(t.totalAmount || 0);
    const upiData = `upi://pay?pa=43679689022@sbi&pn=V+P+HONDA&am=${invoiceTotal}&cu=INR`;
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(upiData)}`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${invoice.invoiceNumber}</title>
    <style>* { margin: 0; padding: 0; } body { font-family: Arial; font-size: 9pt; }
    .page { width: 210mm; padding: 10mm; } table { width: 100%; border-collapse: collapse; margin-bottom: 1.5mm; }
    td, th { border: 1px solid #000; padding: 1.5mm; font-size: 8pt; line-height: 1.3; }
    th { background: #d0d0d0; font-weight: bold; } .right { text-align: right; } .center { text-align: center; }
    .total-row { background: #d0d0d0; font-weight: bold; }
    @media print { body { margin: 0; } }</style></head>
    <body><div class="page">
    <div style="text-align:center; border: 2px solid #000; padding: 4mm; margin-bottom: 2mm;">
      <img src="${qr}" style="width:80px;height:80px;"><div style="font-size:7pt;font-weight:bold;">SCAN AND PAY ANY UPI APP</div>
      <div style="font-size:16pt;font-weight:bold;color:#CC0000;">V P HONDA</div>
      <div style="font-size:7pt;">NARSINGHGARH ROAD, NEAR BRIDGE, PARWALIYA SADAK | GSTIN: 23BCYPD9538B1ZG | Mobile: 9713394738</div>
      <div style="font-size:11pt;font-weight:bold;background:#d0d0d0;padding:2mm;margin-top:2mm;">TAX INVOICE</div>
    </div>
    <table><tr>
      <td><b>Order number :</b> 89</td>
      <td><b>Invoice No :-</b> ${invoice.invoiceNumber}</td>
      <td><b>Invoice Date :</b> ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</td>
      <td><b>Veh Number :-</b> <b style="color:red;">${v.regNo || ''}</b></td>
    </tr><tr>
      <td colspan="2"><b>Document Type:-</b> Invoice</td>
      <td colspan="2"><b>Model No :</b> ${v.name || ''}</td>
    </tr></table>
    <table style="border:2px solid #000;"><tr>
      <td style="background:#d0d0d0;font-weight:bold;width:50%;"><b>Supplier Details (Ship Form) :</b></td>
      <td style="background:#d0d0d0;font-weight:bold;"><b>Ship To (Place of Delivery) :</b></td>
    </tr><tr>
      <td style="vertical-align:top;line-height:1.4;font-size:8pt;"><b>Dealer Name</b> V P HONDA<br><b>Address :</b> Narsinghgarh Road, Parwaliya Sadak<br><b>Dist :</b> Bhopal &nbsp;<b>PIN Code:</b> 462030<br><b>State:</b> M.P. &nbsp;<b>State Co:</b> 23<br><b>GSTIN No:</b> 23BCYPD9538B1ZG &nbsp;<b>Email :-</b> VPHONDA1@Gmail.com<br><b>PAN No:</b> BCYPD9538B</td>
      <td style="vertical-align:top;line-height:1.4;font-size:8pt;"><b>Leagal Name :</b> ${invoice.customerName || ''}<br><b>Address :</b> ${invoice.customerAddress || ''}<br><b>Phone (M) :</b> ${invoice.customerPhone || ''}<br><b>Customer / Account ID:</b> OWN</td>
    </tr><tr>
      <td style="background:#d0d0d0;font-weight:bold;"><b>Place Of Supply :</b></td>
      <td style="background:#d0d0d0;font-weight:bold;"><b>Bill To (Details of Recipient) :</b></td>
    </tr><tr>
      <td style="vertical-align:top;line-height:1.4;font-size:8pt;"><b>Dealer Name</b> V P HONDA<br><b>Address :</b> Narsinghgarh Road, Parwaliya Sadak<br><b>Dist :</b> Bhopal &nbsp;<b>PIN Cod</b> 462030<br><b>GSTIN No:</b> 23BCYPD9538B1ZG &nbsp;<b>Email :-</b> VPHONDA1@Gmail.com</td>
      <td style="vertical-align:top;line-height:1.4;font-size:8pt;"><b>Leagal Name</b> ${invoice.customerName || ''}<br><b>Phone (M) :</b> ${invoice.customerPhone || ''}<br><b>Customer / Account ID:</b> SMH/2 OWN &nbsp; ${s.service || ''}</td>
    </tr></table>
    <table><tr style="background:#d0d0d0;font-weight:bold;"><td colspan="4">⭐ VEHICLE DETAILS</td></tr>
    <tr><td><b>Frame No :</b> <b style="color:red;">${v.chassisNo || ''}</b></td><td><b>Model No :</b> <b style="color:red;">${v.name || ''}</b></td><td><b>Jobcard Closed</b> YES</td><td></td></tr>
    <tr><td><b>Engine No :</b> <b style="color:red;">${v.engineNo || ''}</b></td><td><b>Model Code</b> <b style="color:red;">${v.model || ''}</b></td><td><b>Service Type :</b> ${s.serviceType || ''}</td><td><b>Service KM :</b> ${s.serviceKm || ''} &nbsp;<b>AMC</b> ${s.amc || ''}</td></tr>
    <tr><td><b>Menu Fact :</b> <b style="color:red;">${v.menuFactureDate ? new Date(v.menuFactureDate).toLocaleDateString('en-IN') : ''}</b></td><td><b>Colour :</b> <b style="color:red;">${v.color || ''}</b></td><td colspan="2"><b>Sale Date :</b> ${v.sellingDate ? new Date(v.sellingDate).toLocaleDateString('en-IN') : ''} &nbsp;<b>Selling Dealer :</b> V P HONDA</td></tr>
    </table>
    <table>
    <tr><th class="center">Sr No</th><th>Part No</th><th>Description</th><th>HSN/SAC</th><th class="right">MRP</th><th class="right">MRP Dis%</th><th class="right">Unit Price</th><th class="center">Qty</th><th>UoM</th><th class="right">Total Amt</th><th class="right">Disc%</th><th class="right">Disc(Rs)</th><th class="right">Taxable Amt</th></tr>
    ${parts.map((p, i) => {
      const totalAmt = (p.unitPrice || 0) * (p.quantity || 1);
      const discAmt = totalAmt * ((p.discount || 0) / 100);
      return `<tr><td class="center">${i + 1}</td><td>${p.partNo || ''}</td><td>${p.description || ''}</td><td>${p.hsnCode || ''}</td><td class="right">${p.mrp || 0}</td><td class="right">${p.mrpDis || 0}</td><td class="right">₹ ${(p.unitPrice || 0).toFixed(2)}</td><td class="center">${p.quantity || 1}</td><td>No's</td><td class="right">₹ ${totalAmt.toFixed(2)}</td><td class="right">${p.discount || 0}</td><td class="right">₹ ${discAmt.toFixed(2)}</td><td class="right">₹ ${(p.taxableAmount || 0).toFixed(2)}</td></tr>`;
    }).join('')}
    <tr class="total-row"><td colspan="9" style="text-align:right;"><b>Total</b></td><td colspan="4" class="right">₹ ${(t.taxableTotal || t.partsTotal || 0).toFixed(2)}</td></tr>
    </table>
    <div style="text-align:center;font-weight:bold;font-size:9pt;border:1px solid #000;border-bottom:none;background:#f0f0f0;padding:1mm;">TAX SUMMARY</div>
    <table>
    <tr><th rowspan="2" class="center">S No</th><th rowspan="2">HSN/SAC Code</th><th rowspan="2" class="right">Taxable Amount</th><th colspan="2" class="center">SGST/UTGST</th><th colspan="2" class="center">CGST</th><th colspan="2" class="center">IGST</th><th rowspan="2" class="center">Cess</th><th rowspan="2" class="right">Total Amount</th></tr>
    <tr><th class="center">Rate</th><th class="right">Amount</th><th class="center">Rate</th><th class="right">Amount</th><th class="center">Rate</th><th class="right">Amount</th></tr>
    ${Object.values(hsnRows).map(r => `<tr><td class="center">${r.srNo}</td><td>${r.hsn}</td><td class="right">${r.taxable.toFixed(2)}</td><td class="center">${r.sgstRate}</td><td class="right">${r.sgst.toFixed(2)}</td><td class="center">${r.cgstRate}</td><td class="right">${r.cgst.toFixed(2)}</td><td class="center">0</td><td class="right">0.00</td><td class="center">0</td><td class="right">₹ ${r.totalAmount.toFixed(2)}</td></tr>`).join('')}
    <tr class="total-row"><td colspan="2"><b>Total Tax</b></td><td class="right"><b>${(t.taxableTotal || 0).toFixed(2)}</b></td><td></td><td class="right"><b>${((t.taxAmount || 0) / 2).toFixed(2)}</b></td><td></td><td class="right"><b>${((t.taxAmount || 0) / 2).toFixed(2)}</b></td><td></td><td class="right">0.00</td><td></td><td class="right"><b>₹ ${(t.totalAmount || 0).toFixed(2)}</b></td></tr>
    </table>
    <table><tr>
      <td style="width:55%;vertical-align:top;font-size:8pt;"><b>Terms and Conditions: -</b><br>1. All disputes are subject to BHOPAL Jurisdiction.<br>2. Our responsibility ceases after materials are delivered &amp; we are not responsible for any loss or damage.<br>3. Goods once sold will not be taken back.<br>4. Interest @ 18% will be charged on amount remaining unpaid after 45 days.<br>5. All replacements will be subject to our inspection &amp; approval. E. &amp; O. E.</td>
      <td style="vertical-align:top;font-size:8pt;"><table style="border:none;"><tr><td style="border:none;"><b>Total Invoice Value (In Figure)</b></td><td style="border:none;text-align:right;"><b>₹ ${invoiceTotal}.00</b></td></tr><tr><td style="border:none;">${t.amountInWords || ''}</td></tr><tr><td style="border:none;"><b>Payment Mode</b></td><td style="border:none;">${s.paymentMode || ''}</td></tr><tr><td style="border:none;"><b>Total Labour Amount :</b></td><td style="border:none;text-align:right;">₹ ${(t.labourCharges || 0).toFixed(2)}</td></tr><tr><td style="border:none;"><b>Total Parts Amount :</b></td><td style="border:none;text-align:right;">₹ ${(t.partsTotal || 0).toFixed(2)}</td></tr><tr><td style="border:none;"><b>Total Tax Amount :</b></td><td style="border:none;text-align:right;">₹ ${(t.taxAmount || 0).toFixed(2)}</td></tr></table><div style="text-align:right;margin-top:3mm;"><b>For V P HONDA</b></div></td>
    </tr></table>
    <div style="font-size:7pt;border:1px solid #000;padding:2mm;margin-top:2mm;">I hereby give consent that all personal or other information provided herein can be used for business purposes and shall not be disclosed to any third party except as required by law.</div>
    <table style="margin-top:4mm;"><tr>
      <td style="text-align:center;padding:8mm 4mm 2mm;width:50%;"><b>Customer Signature</b></td>
      <td style="text-align:center;padding:8mm 4mm 2mm;border-left:1px solid #000;"><b>Name of Signatory</b><br><b>Designation</b></td>
    </tr></table>
    </div></body></html>`;

    const pw = window.open('', '', 'height=800,width=900');
    if (pw) {
      pw.document.write(html);
      pw.document.close();
      setTimeout(() => { pw.focus(); pw.print(); }, 600);
    }
  };

  const handlePrintClick = async () => {
    console.log('🖨️ Print button clicked!');
    
    const allCustomers = customerType === 'existing' ? customers : newCustomers;
    const selectedCustomer = allCustomers.find(c => c._id === formData.customerId);
    
    if (!selectedCustomer) {
      alert('❌ Select a customer first!');
      return;
    }
    
    if (selectedParts.length === 0) {
      alert('❌ Add at least one part!');
      return;
    }

    const vehicle = selectedCustomer.linkedVehicle || {};
    // ✅ Fallback chain for all vehicle fields
    const vName    = vehicle.name     || vehicle.model  || selectedCustomer.vehicleModel  || '';
    const vRegNo   = vehicle.regNo    || selectedCustomer.registrationNo || selectedCustomer.regNo || '';
    const vChassis = vehicle.chassisNo || selectedCustomer.chassisNo || '';
    const vEngine  = vehicle.engineNo  || selectedCustomer.engineNo  || '';
    const vColor   = vehicle.color     || selectedCustomer.color     || '';
    const vModel   = vehicle.model     || selectedCustomer.vehicleModel || '';
    const vMfgDate = vehicle.menuFactureDate || null;
    const vSellDate= vehicle.sellingDate || selectedCustomer.purchaseDate || selectedCustomer.invoiceDate || null;

    const totals = calculateTotals();

    const invoiceData = {
      _id: Date.now().toString(),
      invoiceNumber: formData.invoiceNo,
      invoiceDate: new Date(formData.invoiceDate),
      customerId: selectedCustomer._id,
      customerName: selectedCustomer.customerName || selectedCustomer.name || '',
      customerPhone: selectedCustomer.mobileNo || selectedCustomer.phone || '',
      vehicleDetails: {
        name:            vName     || 'N/A',
        regNo:           vRegNo    || 'N/A',
        chassisNo:       vChassis  || 'N/A',
        engineNo:        vEngine   || 'N/A',
        color:           vColor    || 'N/A',
        model:           vModel    || 'N/A',
        menuFactureDate: vMfgDate,
        sellingDate:     vSellDate,
      },
      serviceDetails: {
        service: formData.service,
        serviceType: formData.serviceType,
        serviceKm: formData.serviceKm,
        amc: formData.amc,
        labourCharges: formData.labourCharges,
        paymentMode: formData.paymentMode
      },
      parts: selectedParts.map(part => ({
        partNo: part.partNo,
        description: part.description,
        hsnCode: part.hsnCode,
        unitPrice: part.unitPrice,
        quantity: part.quantity,
        discount: part.discount,
        taxableAmount: calculateTaxableAmount(part)
      })),
      totals: {
        taxableTotal: totals.taxableTotal,
        partsTotal: totals.partsTotal,
        labourCharges: totals.labour,
        taxAmount: totals.taxTotal,
        totalAmount: totals.total,
        amountInWords: amountToWords(totals.total)
      },
      createdAt: new Date().toISOString()
    };

    console.log('💾 Invoice object created:', invoiceData);

    try {
      console.log('📝 Saving to localStorage...');
      const existingInvoices = JSON.parse(localStorage.getItem('invoices')) || [];
      existingInvoices.push(invoiceData);
      localStorage.setItem('invoices', JSON.stringify(existingInvoices));
      console.log('✅ Invoice saved to localStorage successfully!');
    } catch (error) {
      console.error('❌ Error saving to localStorage:', error);
      alert('❌ Error saving invoice!');
      return;
    }

    try {
      console.log('🔄 Attempting to save to database...');
      const response = await fetch(api('/api/invoices'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      });
      let savedInvoice = null;
      if (response.ok) {
        savedInvoice = await response.json();
        console.log('✅ Invoice saved to database successfully!');

        // ⭐ DEDUCT PARTS STOCK from inventory (only if parts were used)
        if (selectedParts.length > 0) {
          try {
            const consumeRes = await fetch(api('/api/parts/consume'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                invoiceId: savedInvoice._id,
                invoiceNumber: invoiceData.invoiceNo || invoiceData.invoiceNumber || '',
                customerId: selectedCustomer._id,
                customerName: selectedCustomer.customerName || selectedCustomer.name || '',
                regNo: vRegNo || '',
                consumedBy: (JSON.parse(localStorage.getItem('vpSession') || '{}'))?.name || 'Staff',
                parts: selectedParts.map(p => ({
                  partId: p._id,
                  partNumber: p.partNo || p.partNumber,
                  partName: p.description || p.partName,
                  quantity: Number(p.quantity || 1),
                  unitPrice: Number(p.unitPrice || 0),
                })),
              })
            });
            if (consumeRes.ok) {
              const r = await consumeRes.json();
              console.log(`✅ Stock deducted: ${r.deducted?.length || 0} parts`);
              if (r.alerts && r.alerts.length > 0) {
                alert(`⚠️ Low Stock Alert:\n\n${r.alerts.map(a => `${a.partName}: ${a.currentStock} left (min ${a.minStock})`).join('\n')}`);
              }
            }
          } catch (e) {
            console.warn('⚠️ Stock deduction failed:', e.message);
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Database not available, using localStorage only');
    }

    // Print HTML
    const hsnBreakdown = {};
    selectedParts.forEach((part, idx) => {
      const hsn = part.hsnCode;
      const taxable = calculateTaxableAmount(part);
      const gstRate = part.gstRate !== undefined ? part.gstRate : 18;
      const halfRate = gstRate / 2;
      const sgst = taxable * halfRate / 100;
      const cgst = taxable * halfRate / 100;
      // Use part index as key so each part has its own row (even same HSN)
      const key = `${idx}_${hsn}`;
      hsnBreakdown[key] = {
        srNo: idx + 1,
        hsn,
        taxable,
        sgstRate: halfRate,
        sgst,
        cgstRate: halfRate,
        cgst,
        totalAmount: taxable + sgst + cgst
      };
    });

    const invoiceTotal = Math.round(totals.total);
    const upiData = `upi://pay?pa=43679689022@sbi&pn=V+P+HONDA&am=${invoiceTotal}&cu=INR`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(upiData)}`;

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice ${formData.invoiceNo}</title>
  <style>
    * { margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica; font-size: 9pt; background: white; }
    .page { width: 210mm; height: 297mm; padding: 10mm; }
    .header { text-align: center; border: 2px solid #000; padding: 4mm; margin-bottom: 2mm; }
    .barcode { text-align: center; margin-bottom: 2mm; }
    .barcode img { width: 60px; height: 60px; }
    .company-name { font-size: 16pt; font-weight: bold; color: #CC0000; margin: 2mm 0; }
    .company-info { font-size: 7pt; line-height: 1.2; }
    .title { font-size: 11pt; font-weight: bold; background: #d0d0d0; padding: 2mm; margin: 2mm 0 0 0; border: 1px solid #000; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1.5mm; }
    td, th { border: 1px solid #000; padding: 1.5mm; font-size: 8pt; line-height: 1.1; }
    th { background: #d0d0d0; font-weight: bold; }
    .right { text-align: right; }
    .center { text-align: center; }
    .header-bg { background: #d0d0d0; font-weight: bold; }
    .total-row { background: #d0d0d0; font-weight: bold; }
    @media print { body { margin: 0; padding: 0; } .page { margin: 0; } }
  </style>
</head>
<body>
<div class="page">

<div class="header">
  <div class="barcode">
    <img src="${qrUrl}" alt="QR Code">
    <div style="font-size: 7pt; font-weight: bold; margin-top: 1mm;">SCAN AND PAY ANY UPI APP</div>
  </div>
  <div class="company-name">V P HONDA</div>
  <div class="company-info">
    NARSINGHGARH ROAD, NEAR BRIDGE, PARWALIYA SADAK<br>
    GSTIN: 23BCYPD9538B1ZG | Mobile: 9713394738, 8103476883<br>
    Email: vphonda1@gmail.com
  </div>
  <div class="title">TAX INVOICE</div>
</div>

<table>
  <tr>
    <td style="width: 25%;"><b>Order number :</b> &nbsp; 89</td>
    <td style="width: 25%;"><b>Invoice No :-</b> &nbsp; ${formData.invoiceNo}</td>
    <td style="width: 25%;"><b>Invoice Date :</b> &nbsp; ${new Date(formData.invoiceDate).toLocaleDateString('en-IN')}</td>
    <td style="width: 25%;"><b>Veh Number :-</b> &nbsp; <b style="color: red;">${vehicle.regNo || 'NOT PROVIDED'}</b></td>
  </tr>
  <tr>
    <td colspan="2"><b>Document Type:-</b> &nbsp; Invoice</td>
    <td colspan="2"></td>
  </tr>
</table>

<table style="border: 2px solid #000; border-collapse: collapse; width: 100%; margin-bottom: 1mm;">
  <tr>
    <td style="border: 1px solid #000; background: #d0d0d0; font-weight: bold; padding: 1.5mm; width: 50%; font-size: 8pt;">Supplier Details (Ship Form) :</td>
    <td style="border: 1px solid #000; background: #d0d0d0; font-weight: bold; padding: 1.5mm; width: 50%; font-size: 8pt;">Ship To (Place of Delivery) :</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 1.5mm; font-size: 8pt; vertical-align: top; line-height: 1.4;">
      <b>Dealer Name</b> V P HONDA<br>
      <b>Address :</b> Narsinghgarh Road, Parwaliya Sadak<br>
      <b>Dist :</b> Bhopal &nbsp;&nbsp; <b>PIN Code:</b> 462030<br>
      <b>State:</b> M.P. &nbsp;&nbsp; <b>State Co:</b> 23<br>
      <b>Phone(O) :</b> 9713394738<br>
      <b>GSTIN No:</b> 23BCYPD9538B1ZG &nbsp; <b>Email :-</b> VPHONDA1@Gmail.com<br>
      <b>PAN No:</b> BCYPD9538B<br>
      <b>Customer Care No: -</b> 9340985435, 8103476883
    </td>
    <td style="border: 1px solid #000; padding: 1.5mm; font-size: 8pt; vertical-align: top; line-height: 1.4;">
      <b>Leagal Name :</b> ${selectedCustomer.name || ''}<br>
      <b>Address :</b> ${selectedCustomer.address || ''}<br>
      <b>Dist :</b> ${selectedCustomer.district || ''} &nbsp;&nbsp; <b>PIN Code</b> ${selectedCustomer.pinCode || ''}<br>
      <b>State:</b> ${selectedCustomer.state || 'M.P.'} &nbsp;&nbsp; <b>State Code</b> 23<br>
      <b>Phone (M) :</b> ${selectedCustomer.phone || ''}<br>
      <b>Aadhar No</b> ${selectedCustomer.aadhar || ''} &nbsp; <b>Email</b><br>
      <b>PAN No:</b> ${selectedCustomer.pan || ''}<br>
      <b>Customer / Account ID:</b> OWN
    </td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; background: #d0d0d0; font-weight: bold; padding: 1.5mm; font-size: 8pt;">Place Of Supply :</td>
    <td style="border: 1px solid #000; background: #d0d0d0; font-weight: bold; padding: 1.5mm; font-size: 8pt;">Bill To (Details of Recipient) :</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 1.5mm; font-size: 8pt; vertical-align: top; line-height: 1.4;">
      <b>Dealer Name</b> V P HONDA<br>
      <b>Address :</b> Narsinghgarh Road, Parwaliya Sadak<br>
      <b>City</b> Parwaliya Sadak<br>
      <b>Dist :</b> Bhopal &nbsp;&nbsp; <b>PIN Cod</b> 462030<br>
      <b>State:</b> M.P. &nbsp;&nbsp; <b>State Co</b> 23<br>
      <b>Phone(O) :</b> 9713394738<br>
      <b>GSTIN No:</b> 23BCYPD9538B1ZG &nbsp; <b>Email :-</b> VPHONDA1@Gmail.com<br>
      <b>PAN No:</b> BCYPD9538B<br>
      <b>Customer Care No: -</b> 9340985435, 8103476883
    </td>
    <td style="border: 1px solid #000; padding: 1.5mm; font-size: 8pt; vertical-align: top; line-height: 1.4;">
      <b>Leagal Name</b> ${selectedCustomer.name || ''}<br>
      <b>Father Name</b> ${selectedCustomer.fatherName || ''}<br>
      <b>Address :</b> ${selectedCustomer.address || ''}<br>
      <b>Dist :</b> ${selectedCustomer.district || ''} &nbsp;&nbsp; <b>PIN Cod</b> ${selectedCustomer.pinCode || ''}<br>
      <b>State:</b> ${selectedCustomer.state || 'M.P.'} &nbsp;&nbsp; <b>State Cod</b> 23<br>
      <b>Phone (M) :</b> ${selectedCustomer.phone || ''}<br>
      <b>Aadhar No</b> ${selectedCustomer.aadhar || ''} &nbsp; <b>Email</b><br>
      <b>PAN No:</b> ${selectedCustomer.pan || ''}<br>
      <b>Customer / Account ID:</b> SMH/2 OWN &nbsp; ${formData.service}
    </td>
  </tr>
</table>

<table>
  <tr class="header-bg">
    <td colspan="4"><b>⭐ VEHICLE DETAILS (Auto-linked from Database)</b></td>
  </tr>
  <tr>
    <td style="width: 25%;"><b>Veh Number:</b> <b style="color: red;">${vehicle.regNo && vehicle.regNo !== 'NOT PROVIDED' ? vehicle.regNo : 'NOT PROVIDED'}</b></td>
    <td style="width: 25%;"><b>Chassis No:</b> <b style="color: red;">${vehicle.chassisNo && vehicle.chassisNo !== 'NOT PROVIDED' ? vehicle.chassisNo : 'NOT PROVIDED'}</b></td>
    <td style="width: 25%;"><b>Engine No:</b> <b style="color: red;">${vehicle.engineNo && vehicle.engineNo !== 'NOT PROVIDED' ? vehicle.engineNo : 'NOT PROVIDED'}</b></td>
    <td style="width: 25%;"><b>Colour:</b> <b style="color: red;">${vehicle.color && vehicle.color !== 'NOT PROVIDED' ? vehicle.color : 'NOT PROVIDED'}</b></td>
  </tr>
  <tr>
    <td><b>Menu Fact :</b> <b style="color: red;">${vehicle.menuFactureDate ? new Date(vehicle.menuFactureDate).toLocaleDateString('en-IN') : 'NOT PROVIDED'}</b></td>
    <td><b>Selling Date:</b> <b style="color: red;">${vehicle.sellingDate ? new Date(vehicle.sellingDate).toLocaleDateString('en-IN') : 'NOT PROVIDED'}</b></td>
    <td><b>Model Code:</b> <b style="color: red;">${vehicle.model && vehicle.model !== 'NOT PROVIDED' ? vehicle.model : 'NOT PROVIDED'}</b></td>
    <td><b>Vehicle Name:</b> <b style="color: red;">${vehicle.name && vehicle.name !== 'NOT PROVIDED' ? vehicle.name : 'NOT PROVIDED'}</b></td>
  </tr>
</table>

<table>
  <tr class="header-bg">
    <td colspan="4"><b>Service Details</b></td>
  </tr>
  <tr>
    <td><b>Service:</b> ${formData.service}</td>
    <td><b>Service Type:</b> ${formData.serviceType}</td>
    <td><b>Service KM:</b> ${formData.serviceKm}</td>
    <td><b>AMC:</b> ${formData.amc}</td>
  </tr>
  <tr>
    <td><b>Jobcard Closed:</b> YES</td>
    <td><b>Pick &amp; Drop Availed:</b> NO</td>
    <td colspan="2"><b>Selling Dealer:</b> V P HONDA</td>
  </tr>
</table>

<table>
  <tr>
    <th style="width: 3%; text-align: center;">Sr No</th>
    <th style="width: 12%;">Part No/ Jobcard</th>
    <th style="width: 14%;">Description</th>
    <th style="width: 8%;">HSN/ SAC Code</th>
    <th style="width: 7%; text-align: right;">MRP</th>
    <th style="width: 7%; text-align: right;">MRP Dis %</th>
    <th style="width: 8%; text-align: right;">Unit Price (Rs)</th>
    <th style="width: 4%; text-align: center;">Qty</th>
    <th style="width: 4%;">UoM</th>
    <th style="width: 8%; text-align: right;">Total Amount</th>
    <th style="width: 6%; text-align: right;">Discount %</th>
    <th style="width: 7%; text-align: right;">Discount (Rs)</th>
    <th style="width: 10%; text-align: right;">Taxable Amount (Rs)</th>
  </tr>
  ${selectedParts.map((part, i) => {
    const totalAmt = part.unitPrice * part.quantity;
    const discountAmt = totalAmt * (part.discount / 100);
    const taxable = totalAmt - discountAmt;
    return `<tr>
      <td class="center">${i + 1}</td>
      <td>${part.partNo}</td>
      <td>${part.description}</td>
      <td>${part.hsnCode}</td>
      <td class="right">₹ ${parseFloat(part.mrp).toFixed(2)}</td>
      <td class="right">${part.mrpDis}</td>
      <td class="right">₹ ${parseFloat(part.unitPrice).toFixed(2)}</td>
      <td class="center">${part.quantity}</td>
      <td>No's</td>
      <td class="right">₹ ${totalAmt.toFixed(2)}</td>
      <td class="right">${part.discount}</td>
      <td class="right">₹ ${discountAmt.toFixed(2)}</td>
      <td class="right">₹ ${taxable.toFixed(2)}</td>
    </tr>`;
  }).join('')}
  <tr class="total-row">
    <td colspan="9" style="text-align: right;"><b>Total</b></td>
    <td colspan="4" class="right">₹ ${totals.taxableTotal.toFixed(2)}</td>
  </tr>
</table>

<div style="text-align: center; font-weight: bold; font-size: 9pt; border: 1px solid #000; border-bottom: none; background: #f0f0f0; padding: 1mm;">TAX SUMMARY</div>
<table style="margin-bottom: 0;">
  <tr>
    <th rowspan="2" style="text-align: center;">S No</th>
    <th rowspan="2">HSN/SAC Code</th>
    <th rowspan="2" class="right">Taxable Amount</th>
    <th colspan="2" class="center">SGST/UTGST</th>
    <th colspan="2" class="center">CGST</th>
    <th colspan="2" class="center">IGST</th>
    <th rowspan="2" class="center">Cess</th>
    <th rowspan="2" class="right">Total Amount</th>
  </tr>
  <tr>
    <th class="center">Rate</th>
    <th class="right">Amount</th>
    <th class="center">Rate</th>
    <th class="right">Amount</th>
    <th class="center">Rate</th>
    <th class="right">Amount</th>
  </tr>
  ${Object.values(hsnBreakdown).map(row => `
    <tr>
      <td class="center">${row.srNo}</td>
      <td>${row.hsn}</td>
      <td class="right">${row.taxable.toFixed(2)}</td>
      <td class="center">${row.sgstRate}</td>
      <td class="right">${row.sgst.toFixed(2)}</td>
      <td class="center">${row.cgstRate}</td>
      <td class="right">${row.cgst.toFixed(2)}</td>
      <td class="center">0</td>
      <td class="right">0.00</td>
      <td class="center">0</td>
      <td class="right">₹ ${row.totalAmount.toFixed(2)}</td>
    </tr>
  `).join('')}
  <tr class="total-row">
    <td colspan="2"><b>Total Tax</b></td>
    <td class="right"><b>${totals.taxableTotal.toFixed(2)}</b></td>
    <td></td>
    <td class="right"><b>${(totals.taxTotal / 2).toFixed(2)}</b></td>
    <td></td>
    <td class="right"><b>${(totals.taxTotal / 2).toFixed(2)}</b></td>
    <td></td>
    <td class="right">0.00</td>
    <td></td>
    <td class="right"><b>₹ ${totals.total.toFixed(2)}</b></td>
  </tr>
</table>

<table>
  <tr>
    <td colspan="2" style="vertical-align: top; width: 55%; font-size: 8pt;">
      <b>Terms and Conditions: -</b><br>
      1. All disputes are subject to BHOPAL Jurisdiction.<br>
      2. Our responsibility ceases after materials are delivered &amp; we are not responsible for any loss or any damage.<br>
      3. Goods once sold will not be taken back.<br>
      4. Interest @ 18% will be charged on amount remaining unpaid after 45 days of invoice date.<br>
      5. All replacements will be subject to our inspection &amp; approval. E. &amp; O. E.
    </td>
    <td colspan="2" style="vertical-align: top; font-size: 8pt;">
      <table style="width: 100%; border-collapse: collapse; font-size: 8pt;">
        <tr>
          <td style="padding: 1mm 0;"><b>Total Invoice Value (In Figure)</b></td>
          <td style="text-align: right;"><b>₹ ${invoiceTotal}.00</b></td>
        </tr>
        <tr>
          <td style="padding: 1mm 0;"><b>Invoice Value (In Words)</b></td>
          <td style="text-align: right;">${amountToWords(totals.total)}</td>
        </tr>
        <tr>
          <td style="padding: 1mm 0;"><b>Payment Mode</b></td>
          <td style="text-align: right;">${formData.paymentMode}</td>
        </tr>
        <tr>
          <td colspan="2"><hr style="border: 0.5px solid #000; margin: 1mm 0;"></td>
        </tr>
        <tr>
          <td style="padding: 1mm 0;"><b>Total Labour/Service Amount :</b></td>
          <td style="text-align: right;">₹ ${totals.labour.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 1mm 0;"><b>Total Parts Amount :</b></td>
          <td style="text-align: right;">₹ ${totals.partsTotal.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 1mm 0;"><b>Total Tax Amount :</b></td>
          <td style="text-align: right;">₹ ${totals.taxTotal.toFixed(2)}</td>
        </tr>
      </table>
      <div style="text-align: right; margin-top: 3mm; font-size: 8pt;"><b>For V P HONDA</b></div>
    </td>
  </tr>
</table>

<div style="font-size: 7pt; border: 1px solid #000; padding: 2mm; margin-top: 2mm; line-height: 1.4;">
  I hereby give consent that all personal or other information (information's) provided herein or otherwise can be used for the business purposes or for performance of agreement between us, if any and shall not be disclosed to any third party except to the extent its disclosure is essential as per the applicable laws or for any business requirement. The above said information may be shared or transferred with HMSI or its Dealers or group companies within or outside India for improvement of product, service quality, marketing promotion, development of our products, services, etc. However, the same shall be transmitted, handled &amp; destroyed as per the applicable law or in a manner that will reserve its confidentiality. Further, all or any of the information's provided herein or otherwise can be withdrawn/corrected by giving notice.
</div>

<table style="margin-top: 4mm;">
  <tr>
    <td style="text-align: center; padding: 8mm 4mm 2mm 4mm; font-size: 8pt; width: 50%;">
      <b>Customer Signature</b>
    </td>
    <td style="text-align: center; padding: 8mm 4mm 2mm 4mm; font-size: 8pt; width: 50%; border-left: 1px solid #000;">
      <b>Name of Signatory</b><br>
      <b>Designation</b>
    </td>
  </tr>
</table>

</div>
</body>
</html>`;

    try {
      const printWindow = window.open('', '', 'height=700,width=900');
      
      if (!printWindow) {
        alert('ERROR: Popup blocker enabled!');
        return;
      }
      
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        
        reloadInvoiceHistory();
        
        alert('✅ Invoice #' + formData.invoiceNo + ' saved and printed successfully!\n\nShare via WhatsApp: ' + selectedCustomer.phone);
        
        const nextNum = (parseInt(formData.invoiceNo) + 1).toString().padStart(3, '0');
        setFormData({
          invoiceNo: nextNum,
          customerId: '',
          service: '1st Service',
          serviceType: 'Paid Service',
          serviceKm: 0,
          amc: 'NO',
          labourCharges: 0,
          paymentMode: 'CASH',
          invoiceDate: new Date().toISOString().split('T')[0]
        });
        setSelectedParts([]);
        setShowForm(false);
      }, 800);
      
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const customer = (customerType === 'existing' ? customers : newCustomers).find(c => c._id === formData.customerId);
  const totals = calculateTotals();
  const stats = getStatistics();
  const filteredInvoices = getFilteredInvoices();

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-purple-600 mb-6">🚗 Tax Invoice Generator</h1>

        <div className="flex gap-2 mb-6 flex-wrap">
          <Button onClick={() => setShowForm(!showForm)} className="bg-green-600 text-white font-bold">
            <Plus className="mr-2" /> New Invoice
          </Button>
          <Button 
            onClick={() => navigate('/new-customers')} 
            className="bg-blue-600 text-white font-bold"
          >
            <Plus className="mr-2" /> Manage Customers ({newCustomers.length})
          </Button>
          <Button onClick={() => {
            reloadInvoiceHistory();
            setShowInvoiceHistory(!showInvoiceHistory);
          }} className="bg-purple-600 text-white font-bold">
            <Filter className="mr-2" /> Invoice History ({invoiceHistory.length})
          </Button>
        </div>

        {/* ADVANCED INVOICE HISTORY - WITH BACK BUTTON */}
        {showInvoiceHistory && (
          <Card className="shadow-xl mb-6">
            <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white flex justify-between items-center">
              <CardTitle className="text-2xl">📊 Advanced Invoice History & Analytics</CardTitle>
              <Button 
                onClick={() => setShowInvoiceHistory(false)}
                className="bg-red-600 text-white font-bold flex items-center gap-2 hover:bg-red-700"
                title="Close Invoice History"
              >
                <X size={20} /> Close
              </Button>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              
              {/* FILTERS SECTION */}
              <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                <h3 className="font-bold text-lg mb-4 text-blue-900">🔍 Filter Invoices</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Search */}
                  <div>
                    <label className="block font-bold mb-2 text-sm">Search (Invoice # या Customer)</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                      <Input
                        placeholder="Invoice या Customer name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 border-2"
                      />
                    </div>
                  </div>

                  {/* From Date */}
                  <div>
                    <label className="block font-bold mb-2 text-sm">From Date</label>
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="border-2"
                    />
                  </div>

                  {/* To Date */}
                  <div>
                    <label className="block font-bold mb-2 text-sm">To Date</label>
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="border-2"
                    />
                  </div>
                </div>

                {/* Reset Button */}
                <div className="mt-4">
                  <Button 
                    onClick={() => {
                      setSearchTerm('');
                      setFromDate('');
                      setToDate('');
                      setCurrentPage(1);
                    }}
                    className="bg-gray-600 text-white"
                  >
                    ↺ Reset Filters
                  </Button>
                </div>
              </div>

              {/* STATISTICS SECTION */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                  <CardContent className="pt-6">
                    <div className="text-4xl font-bold">{stats.totalInvoices}</div>
                    <p className="text-sm text-blue-100 mt-2">Total Invoices</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                  <CardContent className="pt-6">
                    <div className="text-4xl font-bold">₹{stats.totalRevenue.toLocaleString('en-IN', {maximumFractionDigits: 0})}</div>
                    <p className="text-sm text-green-100 mt-2">Total Revenue</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                  <CardContent className="pt-6">
                    <div className="text-4xl font-bold">₹{stats.averageValue.toLocaleString('en-IN', {maximumFractionDigits: 0})}</div>
                    <p className="text-sm text-orange-100 mt-2">Avg Invoice Value</p>
                  </CardContent>
                </Card>
              </div>

              {/* INVOICES TABLE WITH PAGINATION */}
              <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                {filteredInvoices.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 bg-gray-50">
                    <p className="text-lg">📭 No invoices found</p>
                    <p className="text-sm mt-2">Try adjusting your filters</p>
                  </div>
                ) : (
                  <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gradient-to-r from-purple-100 to-purple-50 border-b-2 border-gray-300">
                        <tr>
                          <th className="p-3 text-left font-bold text-purple-900">Invoice #</th>
                          <th className="p-3 text-left font-bold text-purple-900">Customer</th>
                          <th className="p-3 text-left font-bold text-purple-900">Vehicle Reg</th>
                          <th className="p-3 text-left font-bold text-purple-900">Date</th>
                          <th className="p-3 text-right font-bold text-purple-900">Amount</th>
                          <th className="p-3 text-center font-bold text-purple-900">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInvoices.slice().reverse()
                          .slice((currentPage - 1) * INVOICES_PER_PAGE, currentPage * INVOICES_PER_PAGE)
                          .map((inv, idx) => (
                          <tr key={inv._id} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50 transition`}>
                            <td className="p-3 font-bold text-green-600">#{inv.invoiceNumber}</td>
                            <td className="p-3 font-semibold">{inv.customerName}</td>
                            <td className="p-3">
                              <span className="bg-yellow-100 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold">
                                {inv.vehicleDetails?.regNo || 'N/A'}
                              </span>
                            </td>
                            <td className="p-3 text-gray-600">{new Date(inv.invoiceDate).toLocaleDateString('en-IN')}</td>
                            <td className="p-3 text-right font-bold text-green-600">₹{(inv.totals?.totalAmount || 0).toLocaleString('en-IN')}</td>
                            <td className="p-3 text-center">
                              <div className="flex gap-2 justify-center flex-wrap">
                                <button
                                  onClick={() => downloadInvoice(inv)}
                                  className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-bold hover:bg-blue-600 flex items-center gap-1"
                                  title="PDF Download"
                                >
                                  <Download size={14} /> PDF
                                </button>
                                <button
                                  onClick={() => deleteInvoice(inv._id)}
                                  className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold hover:bg-red-600 flex items-center gap-1"
                                  title="Delete"
                                >
                                  <Trash2 size={14} /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* PAGINATION */}
                  {filteredInvoices.length > INVOICES_PER_PAGE && (
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
                      <p className="text-sm text-gray-600">
                        Page <b>{currentPage}</b> of <b>{Math.ceil(filteredInvoices.length / INVOICES_PER_PAGE)}</b> &nbsp;|&nbsp; Total: {filteredInvoices.length} invoices
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-4 py-2 text-sm font-bold bg-purple-600 text-white rounded disabled:opacity-40 hover:bg-purple-700"
                        >
                          ◀ Previous
                        </button>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredInvoices.length / INVOICES_PER_PAGE), p + 1))}
                          disabled={currentPage === Math.ceil(filteredInvoices.length / INVOICES_PER_PAGE)}
                          className="px-4 py-2 text-sm font-bold bg-purple-600 text-white rounded disabled:opacity-40 hover:bg-purple-700"
                        >
                          Next ▶
                        </button>
                      </div>
                    </div>
                  )}
                  </>
                )}
              </div>

              {/* SUMMARY */}
              {filteredInvoices.length > 0 && (
                <div className="bg-gradient-to-r from-purple-100 to-blue-100 p-4 rounded-lg border-2 border-purple-200">
                  <p className="text-center font-bold text-gray-800">
                    📋 Showing <span className="text-purple-600">{filteredInvoices.length}</span> invoice(s) | Revenue: <span className="text-green-600">₹{stats.totalRevenue.toLocaleString('en-IN', {maximumFractionDigits: 0})}</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* MAIN INVOICE FORM */}
        {showForm && (
          <Card className="shadow-xl">
            <CardHeader className="bg-purple-600 text-white sticky top-0 z-10">
              <CardTitle className="text-xl">Create Tax Invoice</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 max-h-screen overflow-y-auto">
              
              {/* Invoice Number & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Invoice Number</label>
                  <Input value={formData.invoiceNo} onChange={(e) => setFormData({...formData, invoiceNo: e.target.value})} className="border-2" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Invoice Date</label>
                  <Input type="date" value={formData.invoiceDate} onChange={(e) => setFormData({...formData, invoiceDate: e.target.value})} className="border-2" />
                </div>
              </div>

              {/* Customer Type Selection */}
              <div className="flex gap-4">
                <button onClick={() => setCustomerType('existing')} className={`flex-1 p-3 font-bold rounded ${customerType === 'existing' ? 'bg-green-600 text-white' : 'bg-gray-300'}`}>
                  👥 Existing Customer
                </button>
                <button onClick={() => setCustomerType('new')} className={`flex-1 p-3 font-bold rounded ${customerType === 'new' ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                  ➕ New Customer
                </button>
              </div>

              {/* CUSTOMER SELECTION */}
              <div className="border-3 border-blue-500 p-4 rounded bg-blue-50">
                <label className="block text-lg font-bold mb-2 text-blue-900">⭐ SELECT CUSTOMER</label>
                <select 
                  value={formData.customerId} 
                  onChange={(e) => setFormData({...formData, customerId: e.target.value})} 
                  className="w-full border-2 p-2 font-bold text-base"
                >
                  <option value="">-- Choose Customer --</option>
                  {(customerType === 'existing' ? customers : newCustomers).map(c => 
                    <option key={c._id} value={c._id}>
                      {c.customerName || c.name || 'Unknown'} — {c.mobileNo || c.phone || ''}
                    </option>
                  )}
                </select>
              </div>

              {/* CUSTOMER DETAILS AUTO-FILLED */}
              {customer && (
                <div className="border-2 border-green-500 p-4 rounded bg-green-50 space-y-3">
                  <h3 className="font-bold text-lg text-green-900">✅ Customer Details (Auto-filled)</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm bg-white p-3 rounded">
                    <div><b>Name:</b> {customer.customerName || customer.name}</div>
                    <div><b>Father Name:</b> {customer.fatherName}</div>
                    <div><b>Phone:</b> {customer.mobileNo || customer.phone}</div>
                    <div><b>Aadhar:</b> {customer.aadhar}</div>
                    <div className="col-span-2"><b>Address:</b> {customer.address}</div>
                    <div><b>District:</b> {customer.district}</div>
                    <div><b>PIN Code:</b> {customer.pinCode}</div>
                  </div>

                  {customer.linkedVehicle && (
                    <div className="border-2 border-red-500 p-4 rounded bg-red-50 mt-4">
                      <h4 className="font-bold text-lg text-red-900 mb-3">🚗 Vehicle Details (Auto-linked)</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm bg-white p-3 rounded">
                        <div><b>Vehicle:</b> <span style={{color:'red'}}>{customer.linkedVehicle?.name || customer.linkedVehicle?.model || customer.vehicleModel || 'NOT PROVIDED'}</span></div>
                        <div><b>Reg No:</b> <span style={{color:'red'}}>{customer.linkedVehicle?.regNo || customer.registrationNo || customer.regNo || 'NOT PROVIDED'}</span></div>
                        <div><b>Chassis:</b> <span style={{color:'red'}}>{customer.linkedVehicle?.chassisNo || customer.chassisNo || 'NOT PROVIDED'}</span></div>
                        <div><b>Engine:</b> <span style={{color:'red'}}>{customer.linkedVehicle?.engineNo || customer.engineNo || 'NOT PROVIDED'}</span></div>
                        <div><b>Color:</b> <span style={{color:'red'}}>{customer.linkedVehicle?.color || customer.color || 'NOT PROVIDED'}</span></div>
                        <div><b>Model:</b> <span style={{color:'red'}}>{customer.linkedVehicle?.model || customer.vehicleModel || 'NOT PROVIDED'}</span></div>
                        <div><b>Manufacture:</b> <span style={{color:'red'}}>{formatDate(customer.linkedVehicle?.menuFactureDate)}</span></div>
                        <div><b>Selling Date:</b> <span style={{color:'red'}}>{formatDate(customer.linkedVehicle?.sellingDate || customer.purchaseDate || customer.invoiceDate)}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SERVICE DETAILS */}
              <div className="border-2 border-yellow-500 p-4 rounded bg-yellow-50">
                <h3 className="font-bold text-lg mb-3">Service Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold mb-1">Service Type</label>
                    <select value={formData.serviceType} onChange={(e) => setFormData({...formData, serviceType: e.target.value})} className="w-full border-2 p-2">
                      <option>Free Service</option>
                      <option>Paid Service</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Service</label>
                    <select value={formData.service} onChange={(e) => setFormData({...formData, service: e.target.value})} className="w-full border-2 p-2">
                      <option>1st Service</option>
                      <option>2nd Service</option>
                      <option>3rd Service</option>
                      <option>4th Service</option>
                      <option>5th Service</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Service KM</label>
                    <Input type="number" value={formData.serviceKm} onChange={(e) => setFormData({...formData, serviceKm: parseInt(e.target.value) || 0})} className="border-2" />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Labour Charges (₹)</label>
                    <Input type="number" value={formData.labourCharges} onChange={(e) => setFormData({...formData, labourCharges: parseFloat(e.target.value) || 0})} className="border-2" />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Payment Mode</label>
                    <select value={formData.paymentMode} onChange={(e) => setFormData({...formData, paymentMode: e.target.value})} className="w-full border-2 p-2">
                      <option>CASH</option>
                      <option>CHEQUE</option>
                      <option>UPI</option>
                      <option>CARD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold mb-1">AMC</label>
                    <select value={formData.amc} onChange={(e) => setFormData({...formData, amc: e.target.value})} className="w-full border-2 p-2">
                      <option>YES</option>
                      <option>NO</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ADD PARTS SECTION */}
              <div className="border-2 border-indigo-500 p-4 rounded bg-indigo-50">
                <h3 className="font-bold text-lg mb-3">Select Parts</h3>
                <div className="mb-4">
                  <select onChange={(e) => { addPart(e.target.value); e.target.value = ''; }} className="w-full border-2 p-2 font-bold">
                    <option value="">-- Add Part --</option>
                    {parts.map(p => <option key={p._id} value={p._id}>{p.description} ({p.partNo})</option>)}
                  </select>
                </div>

                {selectedParts.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full border-2 border-gray-400 text-sm">
                      <thead className="bg-indigo-200 font-bold">
                        <tr>
                          <th className="border p-2">Part No</th>
                          <th className="border p-2">Description</th>
                          <th className="border p-2">HSN</th>
                          <th className="border p-2">Unit Price</th>
                          <th className="border p-2">Qty</th>
                          <th className="border p-2">Discount %</th>
                          <th className="border p-2">GST %</th>
                          <th className="border p-2 text-right">Taxable</th>
                          <th className="border p-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedParts.map((part, i) => (
                          <tr key={i} className="border">
                            <td className="border p-2">{part.partNo}</td>
                            <td className="border p-2">{part.description}</td>
                            <td className="border p-2">{part.hsnCode}</td>
                            <td className="border p-2">₹{part.unitPrice.toFixed(2)}</td>
                            <td className="border p-2">
                              <input type="number" min="1" value={part.quantity} onChange={(e) => updatePart(i, 'quantity', e.target.value)} className="w-12 border p-1" />
                            </td>
                            <td className="border p-2">
                              <input type="number" min="0" max="100" value={part.discount} onChange={(e) => updatePart(i, 'discount', e.target.value)} className="w-12 border p-1" />
                            </td>
                            <td className="border p-2">
                              <select value={part.gstRate !== undefined ? part.gstRate : 18} onChange={(e) => updatePart(i, 'gstRate', parseInt(e.target.value))} className="w-14 border p-1 text-sm">
                                <option value={0}>0%</option>
                                <option value={5}>5%</option>
                                <option value={12}>12%</option>
                                <option value={18}>18%</option>
                                <option value={28}>28%</option>
                              </select>
                            </td>
                            <td className="border p-2 text-right">₹{calculateTaxableAmount(part).toFixed(2)}</td>
                            <td className="border p-2 text-center">
                              <button onClick={() => removePart(i)} className="text-red-600 font-bold">Remove</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* PRINT BUTTON */}
              <Button onClick={handlePrintClick} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 text-lg">
                <Printer className="mr-2" /> 🖨️ Save & Print Invoice
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}