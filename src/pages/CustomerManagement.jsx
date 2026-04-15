import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Search, FileText, Download, FileSpreadsheet, CheckCircle, AlertCircle, Eye, EyeOff, Users, Car, MapPin, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';
import { api } from '../utils/apiConfig';

const COLORS = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];

export default function CustomerManagement({ user }) {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const CUSTOMERS_PER_PAGE = 10;
  const [activeTab, setActiveTab] = useState('dashboard');
  const [oldBikes, setOldBikes] = useState([]);
  const [showOldBikeForm, setShowOldBikeForm] = useState(false);
  const [editingOldBike, setEditingOldBike] = useState(null);
  const [obForm, setObForm] = useState({
    exchangeCustName:'', exchangeFathName:'', exchangeCustMob:'', exchangeCustAadhar:'', exchangeCustAddress:'', exchangeDate:'',
    regOwnerName:'', regFatherName:'', regOwnerMob:'',
    veh:'', mdl:'', regNo:'', engineNo:'', chassisNo:'', color:'', year:'',
    psPrice:'', exchangeNotes:'',
    status:'Available',
    buyerName:'', buyerFather:'', buyerMob:'', buyerAadhar:'', buyerAddress:'', slPrice:'', sellDate:'', sellNotes:''
  });
  const [invoiceData, setInvoiceData] = useState({
    invoiceDate: new Date().toISOString().split('T')[0],
    vehicleModel: '', color: '', variant: '', engineNo: '', chassisNo: '', keyNo: '', batteryNo: '', financerName: '', price: 0
  });
  const [formData, setFormData] = useState({
    name: '', fatherName: '', phone: '', aadhar: '', pan: '', address: '', district: '', pinCode: '', state: 'M.P.', financerName: '',
    linkedVehicle: { name: '', regNo: '', frameNo: '', engineNo: '', color: '', model: '', keyNo: '', purchaseDate: '', warranty: 'YES' }
  });
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [clearing, setClearing] = useState(false);
  const fileInputRef = useRef(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const oldBikeFileRef = useRef(null);
  const [obImporting, setObImporting] = useState(false);
  const [obImportResult, setObImportResult] = useState(null);

  // ── Helper: Sync to MongoDB ────────────────────────────────────────────────
  const syncCustomersToMongo = async (custList) => {
    try {
      const syncData = custList.map(c => ({
        customerName: c.name || c.customerName,
        fatherName: c.fatherName,
        phone: c.phone,
        aadhar: c.aadhar,
        pan: c.pan,
        address: c.address,
        district: c.district,
        pinCode: c.pinCode,
        dob: c.dob,
        vehicleModel: c.linkedVehicle?.model || c.vehicleModel,
        variant: c.variant,
        vehicleColor: c.linkedVehicle?.color,
        engineNo: c.linkedVehicle?.engineNo,
        chassisNo: c.linkedVehicle?.frameNo || c.linkedVehicle?.chassisNo,
        registrationNo: c.linkedVehicle?.regNo,
        keyNo: c.linkedVehicle?.keyNo,
        batteryNo: c.linkedVehicle?.batteryNo,
        invoiceDate: c.linkedVehicle?.purchaseDate,
        financeCompany: c.financerName,
        price: c.vehiclePrice || c.linkedVehicle?.price || 0,
        insurance: 0,
        rto: 0,
      }));
      const res = await fetch(api('/api/customers/sync'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customers: syncData }),
      });
      if (!res.ok) console.error('MongoDB sync failed');
    } catch (err) { console.error('Sync error:', err); }
  };

  // ── Load customers ────────────────────────────────────────────────────────
  const loadCustomers = async () => {
    try {
      const shared = localStorage.getItem('sharedCustomerData');
      if (shared) {
        try {
          const parsed = JSON.parse(shared);
         if (parsed.length > 0) {
           // ✅ सबसे नया सबसे ऊपर (createdAt के हिसाब से reverse)
           const sorted = [...parsed].sort((a, b) => {
             const dateA = a.createdAt || a._id?.toString().substring(0,8) || 0;
             const dateB = b.createdAt || b._id?.toString().substring(0,8) || 0;
             return dateB - dateA;
           });
           setCustomers(sorted);
           setLoading(false);
           return;
         }
        } catch(e) {}
      }
      const response = await fetch(api('/api/customers'));
      const data = await response.json();
      if (data && data.length > 0) {
        const valid = data.filter(c => (c.customerName || c.name || '').trim());
        if (valid.length) {
           const sorted = [...valid].sort((a, b) => {
              const dateA = a.createdAt || a._id?.toString().substring(0,8) || 0;
              const dateB = b.createdAt || b._id?.toString().substring(0,8) || 0;
              return dateB - dateA;
           });
            setCustomers(sorted);
            localStorage.setItem('sharedCustomerData', JSON.stringify(sorted));
        }
      }
    } catch (error) {
      console.log('Customer load failed:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
    const loadOldBikes = async () => {
      try {
        const res = await fetch(api('/api/oldbikes'));
        if (res.ok) {
          const db = await res.json();
          if (db.length) { setOldBikes(db); localStorage.setItem('oldBikeData', JSON.stringify(db)); return; }
        }
      } catch(e) {}
      try { const ls = JSON.parse(localStorage.getItem('oldBikeData')||'[]'); if (ls.length) setOldBikes(ls); } catch{}
    };
    loadOldBikes();
  }, []);

  useEffect(() => {
    const handleSync = () => { loadCustomers(); try { setOldBikes(JSON.parse(localStorage.getItem('oldBikeData')||'[]')); } catch{} };
    window.addEventListener('dataSync', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('dataSync', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // ── Excel Import (cost_detl) ──────────────────────────────────────────────
  const handleExcelImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames.find(
        name => name.toLowerCase().replace(/[_\s]/g, '') === 'costdetl' ||
                name.toLowerCase().includes('cost') ||
                name.toLowerCase().includes('customer')
      );
      if (!sheetName) throw new Error(`"cost_detl" sheet not found. Available: ${workbook.SheetNames.join(', ')}`);
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', cellDates: true });
      if (!rows.length) throw new Error('No data in sheet');

      const get = (row, keys) => {
        for (const k of keys) {
          const found = Object.keys(row).find(rk => rk.trim().toLowerCase().replace(/\s+/g,' ') === k.trim().toLowerCase().replace(/\s+/g,' '));
          if (found && row[found] !== '' && row[found] !== null && row[found] !== undefined) return row[found];
        }
        return '';
      };

      const parseUTCDate = (val) => {
        if (!val || val === '') return '';
        try {
          let d;
          if (val instanceof Date) d = val;
          else if (typeof val === 'number') d = new Date((val - 25569) * 86400000);
          else d = new Date(val);
          if (isNaN(d.getTime())) return '';
          const yr = d.getUTCFullYear();
          if (yr < 1900 || yr > 2100) return '';
          return `${yr}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
        } catch { return ''; }
      };

      let added = 0;
      const newCustomers = [];
      for (const row of rows) {
        const name = String(get(row, ['Cost Name', 'name', 'customer name', 'cust name'])).trim().toUpperCase();
        if (!name || name === 'COST NAME' || name === 'NAME') continue;
        const phone = String(get(row, ['Mob No', 'mob no', 'Mobile No', 'phone', 'mobile', 'contact'])).trim();
        const aadhar = String(get(row, ['Aadhar No', 'aadhar no', 'aadhar', 'aadhaar'])).trim();
        const regNo = String(get(row, ['Veh Reg No', 'veh reg no', 'reg no', 'regno'])).trim().toUpperCase();
        const purchaseDate = parseUTCDate(get(row, ['Date', 'date', 'sale date', 'selling date']));
        const dobStr = parseUTCDate(get(row, ['DOB', 'dob', 'date of birth']));
        const vehiclePrice = parseFloat(get(row, ['Price', 'price'])) || 0;
        const vehName = String(get(row, ['Veh ', 'Veh', 'veh', 'Vehicle', 'vehicle name'])).trim();
        const batteryNo = String(get(row, ['Bty No', 'Bty No ', 'bty no', 'BtyNo', 'Battery No', 'battery no', 'battery'])).trim();

        const customerData = {
          name,
          fatherName: String(get(row, ['Father', 'father', 'father name', 's/o', 'w/o'])).trim().toUpperCase(),
          phone,
          aadhar,
          pan: String(get(row, ['PAN No', 'pan no', 'pan'])).trim().toUpperCase(),
          address: String(get(row, ['Add', 'add', 'address', 'addr'])).trim(),
          district: String(get(row, ['Dist', 'dist', 'district', 'city'])).trim().toUpperCase(),
          pinCode: String(get(row, ['Pin Code', 'pin code', 'pincode', 'pin'])).trim(),
          state: 'M.P.',
          dob: dobStr || null,
          financerName: String(get(row, ['Fin/ Cash', 'Fin/Cash', 'bank'])).trim().replace(/^0$/, ''),
          vehiclePrice,
          linkedVehicle: {
            name: vehName || 'N/A',
            regNo,
            chassisNo: String(get(row, ['Chassis No', 'chassis no', 'chassisno', 'frame no'])).trim().toUpperCase(),
            frameNo: String(get(row, ['Chassis No', 'chassis no', 'chassisno', 'frame no'])).trim().toUpperCase(),
            engineNo: String(get(row, ['Ingine No', 'ingine no', 'engine no', 'engineno'])).trim().toUpperCase(),
            color: String(get(row, ['Colour', 'colour', 'color'])).trim().toUpperCase(),
            model: String(get(row, ['Varit ', 'Varit', 'varit', 'variant', 'cc'])).trim(),
            keyNo: String(get(row, ['Key No', 'key no', 'keyno'])).trim(),
            batteryNo,
            price: vehiclePrice,
            purchaseDate,
            warranty: 'YES'
          }
        };
        newCustomers.push(customerData);
        added++;
      }

      const sortedNew = [...newCustomers].sort((a, b) => {
           const dateA = a.createdAt || a._id?.toString().substring(0,8) || 0;
           const dateB = b.createdAt || b._id?.toString().substring(0,8) || 0;
           return dateB - dateA;
         });
      setCustomers(sortedNew);
      localStorage.setItem('sharedCustomerData', JSON.stringify(sortedNew));
      await syncCustomersToMongo(newCustomers);
      setImportResult({ sheetName, added, skipped: 0, errors: 0 });
    } catch (err) {
      alert('Import failed: ' + err.message);
      setImportResult({ error: err.message });
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetForm = () => {
    setFormData({
      name: '', fatherName: '', phone: '', aadhar: '', pan: '', address: '',
      district: '', pinCode: '', state: 'M.P.', financerName: '',
      linkedVehicle: { name: '', regNo: '', frameNo: '', engineNo: '', color: '', model: '', keyNo: '', purchaseDate: '', warranty: 'YES' }
    });
  };

  const handleAddCustomer = async () => {
    if (!formData.name || !formData.phone) {
      alert('Please fill all required fields');
      return;
    }
    try {
      let updatedList;
      if (editingId && editingId !== 'view') {
        const response = await fetch(api(`/api/customers/${editingId}`), {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
        });
        if (response.ok) alert('Customer updated!');
        updatedList = customers.map(c => c._id === editingId ? formData : c);
      } else {
        const response = await fetch(api('/api/customers'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
        });
        if (response.ok) alert('Customer added!');
        updatedList = [formData, ...customers];
      }
      setCustomers(updatedList);
      localStorage.setItem('sharedCustomerData', JSON.stringify(updatedList));
      await syncCustomersToMongo(updatedList);
      setShowForm(false);
      setEditingId(null);
      resetForm();
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Error saving customer');
    }
  };

  const handleEditCustomer = (customer) => {
    setFormData(customer);
    setEditingId('view');
    setShowForm(true);
  };

  const handleDeleteCustomer = async (customerId) => {
    if (window.confirm('Delete this customer?')) {
      try {
        await fetch(api(`/api/customers/${customerId}`), { method: 'DELETE' });
        const updatedList = customers.filter(c => c._id !== customerId);
        setCustomers(updatedList);
        localStorage.setItem('sharedCustomerData', JSON.stringify(updatedList));
        await syncCustomersToMongo(updatedList);
        alert('Customer deleted!');
      } catch (error) {
        console.error('Error deleting customer:', error);
      }
    }
  };

  const handleClearAll = async () => {
    if (!isAdmin) { alert('❌ Admin login required!'); return; }
    if (!window.confirm(`⚠️ सभी ${customers.length} customers delete होंगे! क्या आप sure हैं?`)) return;
    setClearing(true);
    let deleted = 0;
    for (const c of customers) {
      try {
        await fetch(api(`/api/customers/${c._id}`), { method: 'DELETE' });
        deleted++;
      } catch {}
    }
    setCustomers([]);
    localStorage.removeItem('sharedCustomerData');
    await syncCustomersToMongo([]);
    setClearing(false);
    alert(`✅ ${deleted} customers cleared!`);
  };

  const handleTaxInvoice = (customer) => {
    setSelectedCustomer(customer);
    const veh = customer.linkedVehicle || {};
    setInvoiceData({
      invoiceDate: new Date().toISOString().split('T')[0],
      vehicleModel: veh.name || '',
      color: veh.color || '',
      variant: veh.model || '',
      engineNo: veh.engineNo || '',
      chassisNo: veh.chassisNo || veh.frameNo || '',
      keyNo: veh.keyNo || '',
      batteryNo: veh.batteryNo || '',
      financerName: customer.financerName || '',
      price: customer.vehiclePrice || veh.price || 0
    });
    setShowInvoiceModal(true);
  };

  const amountToWords = (num) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
                   'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
                   'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    if (num === 0) return 'Zero';
    const n = Math.floor(num);
    const b100 = (x) => x < 20 ? ones[x] : tens[Math.floor(x/10)] + (x%10 ? ' '+ones[x%10] : '');
    const b1000 = (x) => x < 100 ? b100(x) : ones[Math.floor(x/100)] + ' Hundred' + (x%100 ? ' '+b100(x%100) : '');
    let w = '';
    const lk = Math.floor(n/100000);
    if (lk > 0) w += b100(lk) + ' Lakh ';
    const th = Math.floor((n%100000)/1000);
    if (th > 0) w += b100(th) + ' Thousand ';
    const r = n%1000;
    if (r > 0) w += b1000(r);
    return w.trim() + ' Only';
  };

  const generateInvoicePDF = () => {
    if (!selectedCustomer || invoiceData.price === 0) {
      alert('Please fill all required fields');
      return;
    }
    const invoiceNo = `SMH/${new Date(invoiceData.invoiceDate).getFullYear()}-${String(new Date(invoiceData.invoiceDate).getMonth() + 1).padStart(2, '0')} ${Math.floor(Math.random() * 999)}`;
    const invoiceDate = invoiceData.invoiceDate;
    const enteredAmount = parseFloat(invoiceData.price) || 0;
    const taxablePrice = Math.round((enteredAmount / 1.18) * 100) / 100;
    const sgst = Math.round((taxablePrice * 0.09) * 100) / 100;
    const cgst = Math.round((taxablePrice * 0.09) * 100) / 100;
    const invoiceSubTotal = taxablePrice + sgst + cgst;
    const invoiceTotal = Math.round(invoiceSubTotal);
    const roundOff = Math.round((invoiceTotal - invoiceSubTotal) * 100) / 100;
    const fmt = (v) => v.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});

    const invoiceHTML = `
      <div style="font-family: Arial, sans-serif; padding: 12px 15px; max-width: 950px; margin: 0 auto; background: white; color: #000; font-size: 11px; line-height: 1.4;">
        <div style="margin-bottom: 6px; border-bottom: 2px solid #000; padding-bottom: 5px;">
          <div style="font-weight: bold; font-size: 13px;">V P HONDA</div>
          <div>NARSINGHGARH ROAD, NEAR BRIDGE, PARWALIYA SADAK</div>
          <div>BHOPAL MADHYA PRADESH , 462030</div>
          <div>9713394738</div>
          <div>Email :- vphonda1@gmail.com</div>
          <div>GSTIN No : 23BCYPD9538B1ZG</div>
          <div>PAN No: BCYPD9538B</div>
        </div>
        <div style="text-align: center; margin-bottom: 6px;">
          <span style="font-weight: bold; font-size: 14px; text-decoration: underline;">TAX INVOICE</span>
        </div>
        <hr style="border: 1px solid #000; margin-bottom: 6px;">
        <table style="width: 100%; margin-bottom: 6px; font-size: 11px; border: none;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width: 58%; vertical-align: top; padding: 0; border: none;">
              <div style="font-weight: bold; text-decoration: underline; margin-bottom: 4px;">CUSTOMER NAME &amp; ADDRESS</div>
              <table style="width: 100%; border: none; font-size: 12px;" cellpadding="2" cellspacing="0">
                <tr><td style="border:none; width:120px; font-weight:bold;">Sold To</td><td style="border:none; width:10px;">:</td><td style="border:none;">${selectedCustomer.name} &nbsp;&nbsp; <strong>S/O</strong> ${selectedCustomer.fatherName || ''}</td></tr>
                <tr><td style="border:none; font-weight:bold;">Mobile</td><td style="border:none;">:</td><td style="border:none;">${selectedCustomer.phone}</td></tr>
                <tr><td style="border:none; font-weight:bold;">Address</td><td style="border:none;">:</td><td style="border:none;">${selectedCustomer.address}</td></tr>
                <tr><td style="border:none; font-weight:bold;">Dist</td><td style="border:none;">:</td><td style="border:none;">${selectedCustomer.district} &nbsp;&nbsp;&nbsp; ${selectedCustomer.pinCode || ''}</td></tr>
                <tr><td style="border:none; font-weight:bold;">State</td><td style="border:none;">:</td><td style="border:none;">MADHYA PRADESH (State Code: 23)</td></tr>
                <tr><td style="border:none; font-weight:bold;">DOB</td><td style="border:none;">:</td><td style="border:none;">${(() => {
                  if (!selectedCustomer.dob) return '';
                  const d = new Date(selectedCustomer.dob);
                  if (isNaN(d.getTime())) return '';
                  const yr = d.getUTCFullYear();
                  if (yr < 1900 || yr > 2100) return '';
                  const day = String(d.getUTCDate()).padStart(2,'0');
                  const mon = String(d.getUTCMonth()+1).padStart(2,'0');
                  return `${day}-${mon}-${yr}`;
                })()}</td></tr>
                <tr><td style="border:none; font-weight:bold;">Financer Name</td><td style="border:none;">:</td><td style="border:none;">${(() => { const f = invoiceData.financerName || selectedCustomer.financerName || ''; return f === '0' ? '' : f; })()}</td></tr>
              </table>
            </td>
            <td style="width: 42%; vertical-align: top; padding: 0 0 0 15px; border: none;">
              <div><strong>Invoice No</strong> &nbsp;: &nbsp;${invoiceNo}</div>
              <div><strong>Invoice Date</strong> &nbsp;: &nbsp;${invoiceDate}</div>
              <div><strong>IRN</strong> &nbsp;:</div>
              <div style="margin-top: 15px;"><strong>Bill book No</strong></div>
            </td>
          </tr>
        </table>
        <table style="width: 100%; margin-bottom: 5px; font-size: 11px; border-collapse: collapse;">
          <tr style="font-weight: bold;">
            <td style="padding: 5px; border: 1px solid #000; width: 5%; text-align: center;">S No</td>
            <td style="padding: 5px; border: 1px solid #000; width: 16%;">Model</td>
            <td style="padding: 5px; border: 1px solid #000; width: 10%;">Variant</td>
            <td style="padding: 5px; border: 1px solid #000; width: 10%;">Color</td>
            <td style="padding: 5px; border: 1px solid #000; width: 12%;">HSN Number</td>
            <td style="padding: 5px; border: 1px solid #000; width: 17%;">Chassis No</td>
            <td style="padding: 5px; border: 1px solid #000; width: 14%;">Engine No</td>
            <td style="padding: 5px; border: 1px solid #000; width: 16%; text-align: right;">Amount</td>
          </tr>
          <tr>
            <td style="padding: 5px; border: 1px solid #000; text-align: center;">1</td>
            <td style="padding: 5px; border: 1px solid #000;">${invoiceData.vehicleModel}</td>
            <td style="padding: 5px; border: 1px solid #000;">${invoiceData.variant}</td>
            <td style="padding: 5px; border: 1px solid #000;">${invoiceData.color}</td>
            <td style="padding: 5px; border: 1px solid #000;">87112029</td>
            <td style="padding: 5px; border: 1px solid #000;">${invoiceData.chassisNo}</td>
            <td style="padding: 5px; border: 1px solid #000;">${invoiceData.engineNo}</td>
            <td style="padding: 5px; border: 1px solid #000; text-align: right;">₹ ${fmt(taxablePrice)}</td>
          </tr>
        </table>
        <table style="width: 100%; margin-bottom: 5px; font-size: 12px; border-collapse: collapse;">
          <tr><td style="padding: 4px; border: 1px solid #000; font-weight: bold; width: 70%;">Taxable Price</td><td style="padding: 4px; border: 1px solid #000; text-align: right; width: 30%;">₹ ${fmt(taxablePrice)}</td></tr>
          <tr><td style="padding: 4px; border: 1px solid #000;">SGST @ 9%</td><td style="padding: 4px; border: 1px solid #000; text-align: right;">₹ ${fmt(sgst)}</td></tr>
          <tr><td style="padding: 4px; border: 1px solid #000;">CGST @ 9%</td><td style="padding: 4px; border: 1px solid #000; text-align: right;">₹ ${fmt(cgst)}</td></tr>
          <tr><td style="padding: 4px; border: 1px solid #000; font-weight: bold;">Invoice Sub Total</td><td style="padding: 4px; border: 1px solid #000; text-align: right;">₹ ${fmt(invoiceSubTotal)}</td></tr>
          <tr><td style="padding: 4px; border: 1px solid #000;">(Round Off)</td><td style="padding: 4px; border: 1px solid #000; text-align: right;">₹ ${fmt(roundOff)}</td></tr>
          <tr><td style="padding: 4px; border: 1px solid #000; font-weight: bold;">Invoice Total</td><td style="padding: 4px; border: 1px solid #000; text-align: right; font-weight: bold;">₹ ${fmt(invoiceTotal)}</td></tr>
        </table>
        <table style="width: 100%; margin-bottom: 5px; font-size: 12px; border-collapse: collapse;">
          <tr><td style="padding: 4px; border: 1px solid #000; font-weight: bold; width: 22%;">Amount in Words</td><td style="padding: 4px; border: 1px solid #000;">: ${amountToWords(invoiceTotal)}</td></tr>
          <tr><td style="padding: 4px; border: 1px solid #000; font-weight: bold;">Remarks</td><td style="padding: 4px; border: 1px solid #000;">:</td></tr>
        </table>
        <table style="width: 100%; margin-bottom: 8px; font-size: 12px; border-collapse: collapse;">
          <tr style="font-weight: bold;">
            <td style="padding: 4px; border: 1px solid #000; width: 20%;">Battery No. #</td>
            <td style="padding: 4px; border: 1px solid #000; width: 20%;">Book No.#</td>
            <td style="padding: 4px; border: 1px solid #000; width: 20%;">Key No.#</td>
            <td style="padding: 4px; border: 1px solid #000; width: 20%;">CC #</td>
            <td style="padding: 4px; border: 1px solid #000; width: 20%;">Year #</td>
          </tr>
          <tr>
            <td style="padding: 4px; border: 1px solid #000;">${invoiceData.batteryNo || 'NA'}</td>
            <td style="padding: 4px; border: 1px solid #000;">NA</td>
            <td style="padding: 4px; border: 1px solid #000;">${invoiceData.keyNo || ''}</td>
            <td style="padding: 4px; border: 1px solid #000;">${invoiceData.variant || '123.94 CC'}</td>
            <td style="padding: 4px; border: 1px solid #000;">${new Date(invoiceDate).getFullYear()}</td>
          </tr>
        </table>
        <div style="font-size: 9.5px; margin-bottom: 6px; line-height: 1.5; page-break-inside: avoid;">
          <div style="font-weight: bold; margin-bottom: 3px;">Terms &amp; conditions-</div>
          <div>1. E &amp; O.E.</div>
          <div>2. Goods once sold will not be returned or exchanged under any circumstances.</div>
          <div>3. The vehicle/documents has been thoroughly inspected, tested and is free of any kind of defect and is upto my satisfaction.</div>
          <div>4. I have also read the warranty terms and conditions as explained in the owner's manual &amp; understand that my warranty claims if any, will be considered by the manufacturer only in accordance with the scope and limit of warranty as laid down in the warranty certificate.</div>
          <div>5. All disputes are subjected to the jurisdiction of courts of law at BHOPAL.</div>
          <div>6. I have checked my particulars and are correct to best of my knowledge.</div>
          <div>7. I have received the vehicle in good condition along with tool and first aid kit and other compulsory accessories.</div>
          <div>8. Registration and insurance will be done at the owner's risk and liability.</div>
          <div>9. I have understood all the conditions about Colour, Model and Manufacturing Date.</div>
        </div>
        <table style="width: 100%; margin-top: 12px; font-size: 11px; border: none; page-break-inside: avoid;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width: 50%; vertical-align: bottom; padding-top: 25px; border: none;"><strong>Customer Signature</strong></td>
            <td style="width: 50%; text-align: right; vertical-align: bottom; border: none;">
              <div>For V P HONDA</div>
              <div style="margin-top: 25px;"><strong>Authorized Signature</strong></div>
            </td>
          </tr>
        </table>
        <div style="text-align: center; margin-top: 8px; font-weight: bold; font-size: 12px;">THANKS. VISIT AGAIN</div>
      </div>
    `;

    const opt = {
      margin: [5, 6, 5, 6],
      filename: 'Invoice_' + selectedCustomer.name + '_' + invoiceDate + '.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    };
    html2pdf().set(opt).from(invoiceHTML).save();
    setShowInvoiceModal(false);
  };

  // ── Old Bike handlers ─────────────────────────────────────────────────────
  const resetObForm = () => {
    setObForm({
      exchangeCustName:'', exchangeFathName:'', exchangeCustMob:'', exchangeCustAadhar:'', exchangeCustAddress:'', exchangeDate:'',
      regOwnerName:'', regFatherName:'', regOwnerMob:'',
      veh:'', mdl:'', regNo:'', engineNo:'', chassisNo:'', color:'', year:'',
      psPrice:'', exchangeNotes:'',
      status:'Available',
      buyerName:'', buyerFather:'', buyerMob:'', buyerAadhar:'', buyerAddress:'', slPrice:'', sellDate:'', sellNotes:''
    });
    setEditingOldBike(null);
  };
  const saveOldBike = () => {
    if (!obForm.exchangeCustName||!obForm.veh) { alert('Exchange Customer Name और Vehicle भरना ज़रूरी है!'); return; }
    let updated;
    if (editingOldBike !== null) {
      updated = [...oldBikes]; updated[editingOldBike] = {...obForm, updatedAt: new Date().toISOString()};
    } else {
      updated = [...oldBikes, {...obForm, id: Date.now(), createdAt: new Date().toISOString()}];
    }
    setOldBikes(updated);
    localStorage.setItem('oldBikeData', JSON.stringify(updated));
    fetch(api('/api/oldbikes/sync'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({bikes:updated}) }).catch(()=>{});
    window.dispatchEvent(new Event('storage'));
    setShowOldBikeForm(false);
    resetObForm();
  };
  const editOldBike = (idx) => { setObForm({...oldBikes[idx]}); setEditingOldBike(idx); setShowOldBikeForm(true); };
  const deleteOldBike = (idx) => {
    if (!window.confirm('Delete करें?')) return;
    const updated = oldBikes.filter((_,i)=>i!==idx);
    setOldBikes(updated);
    localStorage.setItem('oldBikeData', JSON.stringify(updated));
    fetch(api('/api/oldbikes/sync'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bikes:updated})}).catch(()=>{});
    window.dispatchEvent(new Event('storage'));
  };
  const handleOldBikeImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setObImporting(true);
    setObImportResult(null);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { cellDates: true });
      const sheetName = wb.SheetNames.find(n => n.toUpperCase().includes('OLD') && n.toUpperCase().includes('BIKE')) || wb.SheetNames.find(n => n.toUpperCase().includes('OLD')) || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rows.length) throw new Error('No data in sheet: ' + sheetName);
      const cols = Object.keys(rows[0]);
      const exact = (name) => cols.find(c => c === name) || '';
      const fuzzy = (key) => cols.find(c => c.toUpperCase().replace(/[^A-Z0-9_]/g,'').includes(key)) || '';
      const str = v => { if (v == null || v === '') return ''; if (v instanceof Date) return v.toISOString().split('T')[0]; return String(v).trim(); };
      const num = v => { if (v == null || v === '') return ''; const n = parseFloat(String(v).replace(/[^0-9.-]/g,'')); return isNaN(n) ? '' : n; };
      const cName = exact('CUST NAME') || fuzzy('CUSTNAME');
      const cFather = exact('FATHER') || fuzzy('FATHER');
      const cAddr = exact('ADD') || fuzzy('ADD');
      const cMob = exact('MOB NO') || fuzzy('MOBNO');
      const cOwner = exact('OWNER') || fuzzy('OWNER');
      const cOwnerF = exact('FATHER_1') || '';
      const cVeh = exact('VEH') || fuzzy('VEH');
      const cMdl = exact('MDL') || fuzzy('MDL');
      const cRegNo = exact('REG NO') || fuzzy('REGNO');
      const cPsPrice = exact('PS PRICE') || fuzzy('PSPRICE');
      const cDate = exact('DATE') || fuzzy('DATE');
      const cBuyer = exact('CUST NAME_1') || '';
      const cBuyerF = exact('FATHER_2') || '';
      const cBuyerA = exact('ADD_1') || '';
      const cBuyerM = exact('MOB NO_1') || '';
      const cAadhar = exact('AADHAR NO') || fuzzy('AADHAR');
      const cSlPrice = exact('SL PRICE') || fuzzy('SLPRICE');
      const cSlDate = exact('SL DATE') || fuzzy('SLDATE');
      let imported = 0;
      const newBikes = rows.map(r => {
        const name = str(r[cName]);
        if (!name) return null;
        imported++;
        const ps = num(r[cPsPrice]);
        const sl = num(r[cSlPrice]);
        const buyer = str(r[cBuyer]);
        return {
          id: Date.now() + imported,
          exchangeCustName: name,
          exchangeFathName: str(r[cFather]),
          exchangeCustMob: str(r[cMob]),
          exchangeCustAadhar: '',
          exchangeCustAddress: str(r[cAddr]),
          exchangeDate: str(r[cDate]),
          regOwnerName: str(r[cOwner]),
          regFatherName: str(r[cOwnerF]),
          regOwnerMob: '',
          veh: str(r[cVeh]),
          mdl: str(r[cMdl]),
          regNo: str(r[cRegNo]),
          engineNo: '', chassisNo: '',
          color: '', year: '',
          psPrice: ps,
          exchangeNotes: '',
          status: (sl || buyer) ? 'Sold' : 'Available',
          buyerName: buyer,
          buyerFather: str(r[cBuyerF]),
          buyerMob: str(r[cBuyerM]),
          buyerAadhar: str(r[cAadhar]),
          buyerAddress: str(r[cBuyerA]),
          slPrice: sl,
          sellDate: str(r[cSlDate]),
          sellNotes: '',
          createdAt: new Date().toISOString(),
          custName: name, custMob: str(r[cMob]),
        };
      }).filter(Boolean);
      setOldBikes(newBikes);
      localStorage.setItem('oldBikeData', JSON.stringify(newBikes));
      await fetch(api('/api/oldbikes/sync'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({bikes:newBikes}) });
      window.dispatchEvent(new Event('storage'));
      setObImportResult({ success: imported, sheet: sheetName, columns: cols.join(', ') });
    } catch (err) {
      setObImportResult({ success: 0, error: err.message });
    }
    setObImporting(false);
    if (oldBikeFileRef.current) oldBikeFileRef.current.value = '';
  };

  const filteredCustomers = [...customers].filter(cust => {
    if (activeTab === 'finance') {
      const f = String(cust.financerName || '').trim();
      if (!f || f === '0' || f === 'NA' || f === 'N/A' || /^cash$/i.test(f)) return false;
    }
    if (activeTab === 'cash') {
      const f = String(cust.financerName || '').trim();
      if (f && f !== '0' && f !== '' && f !== 'NA' && f !== 'N/A' && !/^cash$/i.test(f)) return false;
    }
    return cust.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cust.phone?.includes(searchTerm) ||
      (cust.linkedVehicle?.regNo||'').toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalPages = Math.ceil(filteredCustomers.length / CUSTOMERS_PER_PAGE);
  const paginatedCustomers = filteredCustomers.slice((currentPage-1)*CUSTOMERS_PER_PAGE, currentPage*CUSTOMERS_PER_PAGE);

  const stats = useMemo(() => {
    const total = customers.length;
    const withVehicle = customers.filter(c => c.linkedVehicle?.name && c.linkedVehicle.name !== 'N/A').length;
    const financeCustomers = customers.filter(c => {
      const f = String(c.financerName || '').trim();
      return f && f !== '0' && f !== '' && f !== 'NA' && f !== 'N/A' && !/^cash$/i.test(f);
    });
    const cashCustomers = customers.filter(c => {
      const f = String(c.financerName || '').trim();
      return !f || f === '0' || f === '' || f === 'NA' || f === 'N/A' || /^cash$/i.test(f);
    });
    const vehMap = {};
    customers.forEach(c => { const v = (c.linkedVehicle?.name || 'Unknown').toUpperCase().split(' ').slice(0,2).join(' '); vehMap[v] = (vehMap[v] || 0) + 1; });
    const vehicleData = Object.entries(vehMap).sort((a,b) => b[1]-a[1]).slice(0,8).map(([name,value]) => ({name,value}));
    const distMap = {};
    customers.forEach(c => { const d = (c.district || 'Unknown').toUpperCase(); distMap[d] = (distMap[d]||0)+1; });
    const districtData = Object.entries(distMap).sort((a,b) => b[1]-a[1]).slice(0,8).map(([name,value]) => ({name,value}));
    const monthMap = {};
    customers.forEach(c => { const pd = c.linkedVehicle?.purchaseDate; if (pd) { const m = pd.slice(0,7); monthMap[m] = (monthMap[m]||0)+1; } });
    const monthlyData = Object.entries(monthMap).sort().slice(-12).map(([name,value]) => ({name: name.slice(5), value}));
    const finMap = {};
    financeCustomers.forEach(c => { const f = String(c.financerName || '').trim().toUpperCase(); if (f) finMap[f] = (finMap[f]||0)+1; });
    const financeCompanyData = Object.entries(finMap).sort((a,b) => b[1]-a[1]).slice(0,10).map(([name,value]) => ({name: name.slice(0,18), value}));
    const totalRevenue = customers.reduce((s,c) => s + (c.vehiclePrice || c.linkedVehicle?.price || 0), 0);
    return { total, withVehicle, financeCustomers, cashCustomers, financeCount: financeCustomers.length, cashCount: cashCustomers.length, vehicleData, districtData, monthlyData, financeCompanyData, totalRevenue };
  }, [customers]);

  if (loading) return <div className="max-w-7xl mx-auto p-6 text-center text-gray-500">Loading customers...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-80">
            <h3 className="font-bold text-lg mb-4 text-gray-800">🔒 Admin Login</h3>
            <div className="relative mb-4">
              <input type={showPass?'text':'password'} placeholder="Admin Password" value={adminPass}
                onChange={e=>setAdminPass(e.target.value)} onKeyDown={e=>{if(e.key==='Enter' && adminPass==='vphonda@123'){setIsAdmin(true);setShowAdminModal(false);setAdminPass('');}else if(e.key==='Enter') alert('❌ Wrong password!');}}
                className="w-full border-2 border-gray-300 rounded px-3 py-2 pr-10 text-sm focus:border-red-500 outline-none" autoFocus/>
              <button onClick={()=>setShowPass(!showPass)} className="absolute right-2 top-2.5 text-gray-500 hover:text-gray-700">{showPass?<EyeOff size={18}/>:<Eye size={18}/>}</button>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>{if(adminPass==='vphonda@123'){setIsAdmin(true);setShowAdminModal(false);setAdminPass('');}else alert('❌ Wrong password!');}} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded font-bold">Login</button>
              <button onClick={()=>{setShowAdminModal(false);setAdminPass('');}} className="flex-1 bg-gray-400 hover:bg-gray-500 text-white py-2 rounded font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-gray-800">👥 Customer Management</h1>
        <div className="flex gap-3">
          {!isAdmin ? (
            <button onClick={() => setShowAdminModal(true)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-bold">🔒 Admin Login</button>
          ) : (
            <span className="bg-green-700 text-white px-4 py-2 rounded font-bold cursor-pointer" onClick={() => setIsAdmin(false)}>✅ Admin ✕</span>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b-2 border-gray-200 pb-3 flex-wrap">
        {[
          { id:'dashboard', label:'📊 Dashboard' },
          { id:'customers', label:`👥 All (${customers.length})` },
          { id:'finance',   label:`🏦 Finance (${stats.financeCount})` },
          { id:'cash',      label:`💵 Cash (${stats.cashCount})` },
          { id:'oldBikes',  label:`🚲 Old Bikes (${oldBikes.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setCurrentPage(1); }}
            className={`px-5 py-2 rounded-t-lg text-sm font-bold border-2 transition ${
              activeTab === t.id ? 'bg-purple-600 border-purple-600 text-white' : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
            }`}>{t.label}</button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label:'Total Customers', val:stats.total, icon:<Users size={20}/>, bg:'bg-blue-50 hover:bg-blue-100 cursor-pointer', col:'text-blue-700', tab:'customers' },
              { label:'With Vehicle', val:stats.withVehicle, icon:<Car size={20}/>, bg:'bg-green-50', col:'text-green-700' },
              { label:'🏦 Finance', val:stats.financeCount, icon:<TrendingUp size={20}/>, bg:'bg-orange-50 hover:bg-orange-100 cursor-pointer', col:'text-orange-700', tab:'finance' },
              { label:'💵 Cash', val:stats.cashCount, icon:<MapPin size={20}/>, bg:'bg-purple-50 hover:bg-purple-100 cursor-pointer', col:'text-purple-700', tab:'cash' },
            ].map((kpi,i) => (
              <Card key={i} className={`${kpi.bg} border-2 transition`} onClick={() => kpi.tab && setActiveTab(kpi.tab)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`${kpi.col}`}>{kpi.icon}</div>
                  <div><p className="text-gray-500 text-xs font-bold">{kpi.label}</p><p className={`${kpi.col} font-black text-2xl`}>{kpi.val}</p></div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300">
            <CardContent className="p-4">
              <p className="text-green-600 text-sm font-bold">💰 Total Vehicle Sales Revenue</p>
              <p className="text-green-800 font-black text-3xl mt-1">₹{stats.totalRevenue.toLocaleString('en-IN')}</p>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-2"><CardHeader className="py-3 bg-blue-50"><CardTitle className="text-base">🏍️ Vehicle Distribution</CardTitle></CardHeader><CardContent>{stats.vehicleData.length?<ResponsiveContainer width="100%" height={250}><PieChart><Pie data={stats.vehicleData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({name,value})=>`${name}: ${value}`}><Cell fill="#3b82f6"/><Cell fill="#ef4444"/><Cell fill="#10b981"/><Cell fill="#f59e0b"/></Pie><Tooltip/></PieChart></ResponsiveContainer>:<p className="text-gray-400 text-center py-10">No data</p>}</CardContent></Card>
            <Card className="border-2"><CardHeader className="py-3 bg-orange-50"><CardTitle className="text-base">🏦 Finance Company — सबसे ज्यादा किसने Finance किया</CardTitle></CardHeader><CardContent>{stats.financeCompanyData.length?<ResponsiveContainer width="100%" height={250}><BarChart data={stats.financeCompanyData} layout="vertical"><CartesianGrid strokeDasharray="3 3"/><XAxis type="number"/><YAxis dataKey="name" type="category" width={120} tick={{fontSize:9}}/><Tooltip/><Bar dataKey="value" fill="#f59e0b" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer>:<p className="text-gray-400 text-center py-10">No finance data</p>}</CardContent></Card>
            <Card className="border-2"><CardHeader className="py-3 bg-purple-50"><CardTitle className="text-base">📍 District Distribution</CardTitle></CardHeader><CardContent>{stats.districtData.length?<ResponsiveContainer width="100%" height={250}><BarChart data={stats.districtData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name" tick={{fontSize:9}}/><YAxis/><Tooltip/><Bar dataKey="value" fill="#8b5cf6" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>:<p className="text-gray-400 text-center py-10">No data</p>}</CardContent></Card>
            <Card className="border-2"><CardHeader className="py-3 bg-green-50"><CardTitle className="text-base">📈 Monthly Vehicle Sales</CardTitle></CardHeader><CardContent>{stats.monthlyData.length?<ResponsiveContainer width="100%" height={250}><BarChart data={stats.monthlyData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis/><Tooltip/><Bar dataKey="value" fill="#10b981" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>:<p className="text-gray-400 text-center py-10">No data</p>}</CardContent></Card>
          </div>
          <Card className="border-2"><CardHeader className="py-3 bg-gray-50"><CardTitle className="text-base">🆕 Recent Customers</CardTitle></CardHeader><CardContent className="p-0"><table className="w-full text-sm"><thead className="bg-gray-100"><tr>{['Name','Phone','Vehicle','Reg No','Finance','District'].map(h=><th key={h} className="px-4 py-2 text-left font-bold">{h}</th>)}</tr></thead><tbody>{customers.slice(0,8).map((c,i)=><tr key={i} className="border-b hover:bg-gray-50"><td className="px-4 py-2 font-bold">{c.name}</td><td className="px-4 py-2">{c.phone}</td><td className="px-4 py-2 text-blue-600">{c.linkedVehicle?.name||'—'}</td><td className="px-4 py-2 font-mono text-sm">{c.linkedVehicle?.regNo||'—'}</td><td className="px-4 py-2">{(()=>{const f=String(c.financerName||'').trim();return (f&&f!=='0'&&f!=='NA')?<span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-bold">{f}</span>:<span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">CASH</span>;})()}</td><td className="px-4 py-2">{c.district||'—'}</td></tr>)}</tbody></table></CardContent></Card>
        </div>
      )}

      {(activeTab === 'customers' || activeTab === 'finance' || activeTab === 'cash') && (
        <>
          <div className="flex gap-3 mb-6 flex-wrap">
            <Button onClick={() => { setShowForm(!showForm); setEditingId(null); resetForm(); }} className="bg-purple-600 hover:bg-purple-700 text-white"><Plus className="mr-2" /> Add Customer</Button>
            <Button onClick={() => fileInputRef.current.click()} disabled={importing} className="bg-blue-600 hover:bg-blue-700 text-white font-bold"><FileSpreadsheet className="mr-2" size={18} />{importing ? '⏳ Importing...' : '📥 Import from Excel (cost_detl)'}</Button>
            {isAdmin && <Button onClick={handleClearAll} disabled={clearing || customers.length===0} className="bg-red-700 hover:bg-red-800 text-white font-bold"><Trash2 className="mr-2" size={16} />{clearing ? '⏳ Clearing...' : `🗑 Clear All (${customers.length})`}</Button>}
            <input ref={fileInputRef} type="file" accept=".xlsx,.xlsm,.xls" onChange={handleExcelImport} style={{ display: 'none' }} />
          </div>
          {importResult && (
            <div className={`mb-4 p-4 rounded-lg border-2 ${importResult.error?'bg-red-50 border-red-400':'bg-green-50 border-green-400'}`}>
              {importResult.error ? <AlertCircle className="text-red-600 inline mr-2"/> : <CheckCircle className="text-green-600 inline mr-2"/>}
              <span>{importResult.error ? `❌ ${importResult.error}` : `✅ ${importResult.added} customers imported from "${importResult.sheetName}"`}</span>
            </div>
          )}
          {showForm && (
            <Card className="mb-6"><CardHeader className="bg-purple-600 text-white"><CardTitle>{editingId === 'view' ? '👁 View Customer' : 'Add New Customer'}</CardTitle></CardHeader><CardContent className="pt-6 space-y-6">
              <div><h3 className="font-bold mb-3">Customer Details</h3><div className="grid grid-cols-2 gap-4">
                <Input placeholder="Name *" value={formData.name} onChange={e=>setFormData({...formData,name:e.target.value})} className="border-2" disabled={editingId==='view'}/>
                <Input placeholder="Father Name" value={formData.fatherName} onChange={e=>setFormData({...formData,fatherName:e.target.value})} className="border-2" disabled={editingId==='view'}/>
                <Input placeholder="Phone *" value={formData.phone} onChange={e=>setFormData({...formData,phone:e.target.value})} className="border-2" disabled={editingId==='view'}/>
                <Input placeholder="Aadhar" value={formData.aadhar} onChange={e=>setFormData({...formData,aadhar:e.target.value})} className="border-2" disabled={editingId==='view'}/>
                <Input placeholder="PAN" value={formData.pan} onChange={e=>setFormData({...formData,pan:e.target.value})} className="border-2" disabled={editingId==='view'}/>
                <Input placeholder="Address" value={formData.address} onChange={e=>setFormData({...formData,address:e.target.value})} className="border-2" disabled={editingId==='view'}/>
                <Input placeholder="District" value={formData.district} onChange={e=>setFormData({...formData,district:e.target.value})} className="border-2" disabled={editingId==='view'}/>
                <Input placeholder="PIN Code" value={formData.pinCode} onChange={e=>setFormData({...formData,pinCode:e.target.value})} className="border-2" disabled={editingId==='view'}/>
              </div></div>
              <div><h3 className="font-bold mb-3">Vehicle Details</h3><div className="grid grid-cols-2 gap-4">
                <Input placeholder="Vehicle Name" value={formData.linkedVehicle.name} onChange={e=>setFormData({...formData,linkedVehicle:{...formData.linkedVehicle,name:e.target.value}})} className="border-2" disabled={editingId==='view'}/>
                <Input placeholder="Reg No" value={formData.linkedVehicle.regNo} onChange={e=>setFormData({...formData,linkedVehicle:{...formData.linkedVehicle,regNo:e.target.value}})} className="border-2" disabled={editingId==='view'}/>
                <Input placeholder="Chassis No" value={formData.linkedVehicle.frameNo} onChange={e=>setFormData({...formData,linkedVehicle:{...formData.linkedVehicle,frameNo:e.target.value}})} className="border-2" disabled={editingId==='view'}/>
                <Input placeholder="Engine No" value={formData.linkedVehicle.engineNo} onChange={e=>setFormData({...formData,linkedVehicle:{...formData.linkedVehicle,engineNo:e.target.value}})} className="border-2" disabled={editingId==='view'}/>
                <Input placeholder="Color" value={formData.linkedVehicle.color} onChange={e=>setFormData({...formData,linkedVehicle:{...formData.linkedVehicle,color:e.target.value}})} className="border-2" disabled={editingId==='view'}/>
                <Input placeholder="Model" value={formData.linkedVehicle.model} onChange={e=>setFormData({...formData,linkedVehicle:{...formData.linkedVehicle,model:e.target.value}})} className="border-2" disabled={editingId==='view'}/>
                <Input placeholder="Key No" value={formData.linkedVehicle.keyNo} onChange={e=>setFormData({...formData,linkedVehicle:{...formData.linkedVehicle,keyNo:e.target.value}})} className="border-2" disabled={editingId==='view'}/>
                <Input placeholder="Financer Name" value={formData.financerName} onChange={e=>setFormData({...formData,financerName:e.target.value})} className="border-2" disabled={editingId==='view'}/>
                <Input type="date" value={formData.linkedVehicle.purchaseDate} onChange={e=>setFormData({...formData,linkedVehicle:{...formData.linkedVehicle,purchaseDate:e.target.value}})} className="border-2" disabled={editingId==='view'}/>
                <select value={formData.linkedVehicle.warranty} onChange={e=>setFormData({...formData,linkedVehicle:{...formData.linkedVehicle,warranty:e.target.value}})} className="border-2 p-2 rounded" disabled={editingId==='view'}><option>YES</option><option>NO</option></select>
              </div></div>
              <div className="flex gap-4">{editingId !== 'view' && <Button onClick={handleAddCustomer} className="bg-purple-600 hover:bg-purple-700 text-white">Save</Button>}<Button onClick={()=>{setShowForm(false);setEditingId(null);resetForm();}} className="bg-gray-500 hover:bg-gray-600 text-white">{editingId==='view'?'Close':'Cancel'}</Button></div>
            </CardContent></Card>
          )}
          <div className="mb-6"><div className="relative"><Search className="absolute left-3 top-3 text-gray-400" size={20}/><Input placeholder="Search by name or phone..." value={searchTerm} onChange={e=>{setSearchTerm(e.target.value);setCurrentPage(1);}} className="pl-10 border-2"/></div></div>
          <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-100 border-b-2"><tr><th className="px-4 py-3 text-left font-bold">#</th><th className="px-4 py-3 text-left font-bold">Name</th><th className="px-4 py-3 text-left font-bold">Phone</th><th className="px-4 py-3 text-left font-bold">Aadhar</th><th className="px-4 py-3 text-left font-bold">Vehicle</th><th className="px-4 py-3 text-left font-bold">Reg No</th><th className="px-4 py-3 text-left font-bold">Finance</th><th className="px-4 py-3 text-left font-bold">Action</th></tr></thead><tbody>{paginatedCustomers.length===0?<tr><td colSpan="8" className="px-6 py-6 text-center text-gray-500">No customers found</td></tr>:paginatedCustomers.map((cust,idx)=><tr key={cust._id} className="border-b hover:bg-gray-50"><td className="px-4 py-3 text-gray-400 text-sm">{(currentPage-1)*CUSTOMERS_PER_PAGE+idx+1}</td><td className="px-4 py-3 font-bold">{cust.name}</td><td className="px-4 py-3">{cust.phone}</td><td className="px-4 py-3">{cust.aadhar}</td><td className="px-4 py-3">{cust.linkedVehicle?.name||'-'}</td><td className="px-4 py-3">{cust.linkedVehicle?.regNo||'-'}</td><td className="px-4 py-3">{(()=>{const f=String(cust.financerName||'').trim();return (f&&f!=='0'&&f!=='NA'&&!/^cash$/i.test(f))?<span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-bold">{f.slice(0,15)}</span>:<span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">CASH</span>;})()}</td><td className="px-4 py-3 flex gap-2">{isAdmin&&<button onClick={()=>handleTaxInvoice(cust)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"><FileText size={16}/></button>}<button onClick={()=>handleEditCustomer(cust)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"><Search size={16}/></button><button onClick={()=>{setFormData(cust);setEditingId(cust._id);setShowForm(true);}} className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm">✏️</button>{isAdmin?<button onClick={()=>handleDeleteCustomer(cust._id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"><Trash2 size={16}/></button>:<button disabled className="bg-gray-300 text-gray-400 px-3 py-1 rounded text-sm cursor-not-allowed">🔒</button>}</td></tr>)}</tbody></table></div>{filteredCustomers.length>CUSTOMERS_PER_PAGE&&(<div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t"><p className="text-sm text-gray-600">Page <b>{currentPage}</b> of <b>{totalPages}</b> &nbsp;|&nbsp; Total: <b>{filteredCustomers.length}</b> customers</p><div className="flex gap-2"><button onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1} className="px-4 py-2 text-sm font-bold bg-purple-600 text-white rounded disabled:opacity-40 hover:bg-purple-700">◀ Previous</button><button onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages} className="px-4 py-2 text-sm font-bold bg-purple-600 text-white rounded disabled:opacity-40 hover:bg-purple-700">Next ▶</button></div></div>)}</CardContent></Card>
          {showInvoiceModal && selectedCustomer && (<Card className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"><Card className="bg-white w-full max-w-2xl max-h-96 overflow-y-auto"><CardHeader className="bg-green-600 text-white sticky top-0"><CardTitle className="flex items-center gap-2"><FileText size={20}/> Tax Invoice - {selectedCustomer.name}</CardTitle></CardHeader><CardContent className="pt-6"><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"><Input type="date" value={invoiceData.invoiceDate} onChange={e=>setInvoiceData({...invoiceData,invoiceDate:e.target.value})} className="border-2"/><Input placeholder="Vehicle Model" value={invoiceData.vehicleModel} onChange={e=>setInvoiceData({...invoiceData,vehicleModel:e.target.value})} className="border-2"/><Input placeholder="Color" value={invoiceData.color} onChange={e=>setInvoiceData({...invoiceData,color:e.target.value})} className="border-2"/><Input placeholder="Variant" value={invoiceData.variant} onChange={e=>setInvoiceData({...invoiceData,variant:e.target.value})} className="border-2"/><Input placeholder="Chassis No" value={invoiceData.chassisNo} onChange={e=>setInvoiceData({...invoiceData,chassisNo:e.target.value})} className="border-2"/><Input placeholder="Engine No" value={invoiceData.engineNo} onChange={e=>setInvoiceData({...invoiceData,engineNo:e.target.value})} className="border-2"/><Input placeholder="Key No" value={invoiceData.keyNo} onChange={e=>setInvoiceData({...invoiceData,keyNo:e.target.value})} className="border-2"/><Input placeholder="Battery No" value={invoiceData.batteryNo} onChange={e=>setInvoiceData({...invoiceData,batteryNo:e.target.value})} className="border-2"/><Input placeholder="Price" type="number" value={invoiceData.price} onChange={e=>setInvoiceData({...invoiceData,price:parseFloat(e.target.value)||0})} className="border-2"/><Input placeholder="Financer Name" value={invoiceData.financerName} onChange={e=>setInvoiceData({...invoiceData,financerName:e.target.value})} className="border-2"/></div><div className="flex gap-4"><Button onClick={generateInvoicePDF} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"><Download size={18} className="mr-2"/> Generate & Download PDF</Button><Button onClick={()=>setShowInvoiceModal(false)} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold">Cancel</Button></div></CardContent></Card></Card>)}
          <div className="mt-6 p-4 bg-purple-50 border-2 border-purple-300 rounded"><p className="text-sm text-purple-700"><b>Total Customers:</b> {customers.length}</p></div>
        </>
      )}

      {activeTab === 'oldBikes' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2"><h2 className="text-lg font-black text-gray-800">🚲 Old Bikes — Exchange Tracking</h2><div className="flex gap-2"><button onClick={()=>oldBikeFileRef.current?.click()} disabled={obImporting} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm">{obImporting?'⏳ Importing...':'📥 Import Excel (OLD BIKE)'}</button><input ref={oldBikeFileRef} type="file" accept=".xlsx,.xlsm,.xls" onChange={handleOldBikeImport} style={{display:'none'}}/><button onClick={()=>{resetObForm();setShowOldBikeForm(true);}} className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2 rounded-lg font-bold text-sm hover:opacity-90">➕ Add Old Bike</button></div></div>
          {obImportResult && (<div className={`p-3 rounded-lg text-sm font-bold ${obImportResult.error?'bg-red-50 border-2 border-red-300 text-red-700':'bg-green-50 border-2 border-green-300 text-green-700'}`}>{obImportResult.error?`❌ ${obImportResult.error}`:`✅ ${obImportResult.success} bikes imported from sheet "${obImportResult.sheet}"`}</div>)}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3"><Card className="bg-blue-50 border-2"><CardContent className="p-3"><p className="text-gray-500 text-xs font-bold">🚲 Total</p><p className="text-blue-700 font-black text-2xl">{oldBikes.length}</p></CardContent></Card><Card className="bg-green-50 border-2"><CardContent className="p-3"><p className="text-gray-500 text-xs font-bold">✅ Available</p><p className="text-green-700 font-black text-2xl">{oldBikes.filter(b=>b.status!=='Sold').length}</p></CardContent></Card><Card className="bg-red-50 border-2"><CardContent className="p-3"><p className="text-gray-500 text-xs font-bold">🏷️ Sold</p><p className="text-red-700 font-black text-2xl">{oldBikes.filter(b=>b.status==='Sold').length}</p></CardContent></Card><Card className="bg-yellow-50 border-2"><CardContent className="p-3"><p className="text-gray-500 text-xs font-bold">💰 Purchase Total</p><p className="text-yellow-700 font-black text-lg">₹{oldBikes.reduce((s,b)=>s+(parseFloat(b.psPrice)||0),0).toLocaleString('en-IN')}</p></CardContent></Card><Card className="bg-emerald-50 border-2"><CardContent className="p-3"><p className="text-gray-500 text-xs font-bold">💵 Sell Total</p><p className="text-emerald-700 font-black text-lg">₹{oldBikes.reduce((s,b)=>s+(parseFloat(b.slPrice)||0),0).toLocaleString('en-IN')}</p></CardContent></Card></div>
          <Card className="border-2"><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-100"><tr><th className="px-3 py-2 text-left font-bold text-xs">#</th><th className="px-3 py-2 text-left font-bold text-xs">Exchange Customer</th><th className="px-3 py-2 text-left font-bold text-xs">Address</th><th className="px-3 py-2 text-left font-bold text-xs">Reg. Owner</th><th className="px-3 py-2 text-left font-bold text-xs">Father</th><th className="px-3 py-2 text-left font-bold text-xs">Vehicle</th><th className="px-3 py-2 text-left font-bold text-xs">Reg No</th><th className="px-3 py-2 text-left font-bold text-xs">Exchange ₹</th><th className="px-3 py-2 text-left font-bold text-xs">Buyer</th><th className="px-3 py-2 text-left font-bold text-xs">Father</th><th className="px-3 py-2 text-left font-bold text-xs">Aadhar No</th><th className="px-3 py-2 text-left font-bold text-xs">Address</th><th className="px-3 py-2 text-left font-bold text-xs">Sell ₹</th><th className="px-3 py-2 text-left font-bold text-xs">P/L</th><th className="px-3 py-2 text-left font-bold text-xs">Status</th><th className="px-3 py-2 text-left font-bold text-xs">Action</th></tr></thead><tbody>{oldBikes.length===0?<tr><td colSpan="16" className="px-6 py-8 text-center text-gray-400">➕ Add Old Bike बटन से नई entry करें या 📥 Excel import करें</td></tr>:oldBikes.slice((currentPage-1)*CUSTOMERS_PER_PAGE, currentPage*CUSTOMERS_PER_PAGE).map((b,i)=>{const idx=(currentPage-1)*CUSTOMERS_PER_PAGE+i;const pl=(parseFloat(b.slPrice)||0)-(parseFloat(b.psPrice)||0);return(<tr key={idx} className="border-b hover:bg-gray-50"><td className="px-3 py-2 text-gray-400 text-xs">{idx+1}</td><td className="px-3 py-2 text-xs"><span className="font-bold">{b.exchangeCustName||b.custName||'—'}</span><br/><span className="text-blue-500">{b.exchangeCustMob||b.custMob||''}</span></td><td className="px-3 py-2 text-xs text-gray-500 max-w-[120px] truncate">{b.exchangeCustAddress||'—'}</td><td className="px-3 py-2 text-xs">{b.regOwnerName||b.regNo||'—'}</td><td className="px-3 py-2 text-xs text-gray-500">{b.exchangeFathName||b.regFatherName||'—'}</td><td className="px-3 py-2 text-blue-600 text-xs font-bold">{b.veh} {b.mdl}<br/><span className="text-gray-400 font-normal">{b.color||''} {b.year||''}</span></td><td className="px-3 py-2 font-mono text-xs">{b.regNo||'—'}</td><td className="px-3 py-2 text-yellow-600 font-bold text-xs">₹{(parseFloat(b.psPrice)||0).toLocaleString('en-IN')}</td><td className="px-3 py-2 text-xs">{b.buyerName||'—'}<br/><span className="text-green-500">{b.buyerMob||''}</span></td><td className="px-3 py-2 text-xs text-gray-500">{b.buyerFather||'—'}</td><td className="px-3 py-2 text-xs text-gray-500">{b.buyerAadhar||'—'}</td><td className="px-3 py-2 text-xs text-gray-500">{b.buyerAddress||'—'}</td><td className="px-3 py-2 text-green-700 font-bold text-xs">{b.slPrice?'₹'+parseFloat(b.slPrice).toLocaleString('en-IN'):'—'}</td><td className={`px-3 py-2 font-bold text-xs ${pl>=0?'text-green-600':'text-red-600'}`}>{b.slPrice?(pl>=0?'+':'')+'₹'+pl.toLocaleString('en-IN'):'—'}</td><td className="px-3 py-2"><span className={`text-xs font-bold px-2 py-0.5 rounded ${b.status==='Sold'?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>{b.status||'Available'}</span></td><td className="px-3 py-2"><div className="flex gap-1"><button onClick={()=>editOldBike(idx)} className="text-blue-500 hover:bg-blue-50 px-2 py-1 rounded text-xs font-bold">✏️</button>{isAdmin&&<button onClick={()=>deleteOldBike(idx)} className="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-xs font-bold">🗑️</button>}</div></td></tr>);})}</tbody></table></div>{oldBikes.length>CUSTOMERS_PER_PAGE&&(<div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t"><p className="text-sm text-gray-600">Page <b>{currentPage}</b> / <b>{Math.ceil(oldBikes.length/CUSTOMERS_PER_PAGE)}</b> — {oldBikes.length} bikes</p><div className="flex gap-2"><button onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1} className="px-4 py-2 text-sm font-bold bg-purple-600 text-white rounded disabled:opacity-40">◀ Previous</button><button onClick={()=>setCurrentPage(p=>Math.min(Math.ceil(oldBikes.length/CUSTOMERS_PER_PAGE),p+1))} disabled={currentPage>=Math.ceil(oldBikes.length/CUSTOMERS_PER_PAGE)} className="px-4 py-2 text-sm font-bold bg-purple-600 text-white rounded disabled:opacity-40">Next ▶</button></div></div>)}</CardContent></Card>

          {showOldBikeForm && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={()=>{setShowOldBikeForm(false);resetObForm();}}><div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}><div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 rounded-t-2xl flex justify-between items-center"><h2 className="text-white font-black text-lg">{editingOldBike!==null?'✏️ Edit Old Bike':'➕ New Old Bike Entry'}</h2><button onClick={()=>{setShowOldBikeForm(false);resetObForm();}} className="text-white/80 hover:text-white text-xl font-bold">✕</button></div><div className="p-6 space-y-5">
              <div><h3 className="text-sm font-black text-purple-700 mb-2 border-b-2 border-purple-200 pb-1">👤 EXCHANGE CUSTOMER (जिसने bike दी)</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><div><label className="text-xs font-bold text-gray-600">Customer Name *</label><input value={obForm.exchangeCustName} onChange={e=>setObForm(f=>({...f,exchangeCustName:e.target.value}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none"/></div><div><label className="text-xs font-bold text-gray-600">Father Name</label><input value={obForm.exchangeFathName} onChange={e=>setObForm(f=>({...f,exchangeFathName:e.target.value}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none"/></div><div><label className="text-xs font-bold text-gray-600">Mobile No.</label><input value={obForm.exchangeCustMob} onChange={e=>setObForm(f=>({...f,exchangeCustMob:e.target.value.replace(/\D/g,'').slice(0,10)}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none"/></div><div><label className="text-xs font-bold text-gray-600">Address</label><input value={obForm.exchangeCustAddress} onChange={e=>setObForm(f=>({...f,exchangeCustAddress:e.target.value}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none"/></div><div><label className="text-xs font-bold text-gray-600">Exchange Date</label><input type="date" value={obForm.exchangeDate} onChange={e=>setObForm(f=>({...f,exchangeDate:e.target.value}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none"/></div></div></div>
              <div><h3 className="text-sm font-black text-blue-700 mb-2 border-b-2 border-blue-200 pb-1">📋 REGISTERED OWNER (RC में जिसका नाम है)</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><div><label className="text-xs font-bold text-gray-600">Owner Name (RC)</label><input value={obForm.regOwnerName} onChange={e=>setObForm(f=>({...f,regOwnerName:e.target.value}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"/></div><div><label className="text-xs font-bold text-gray-600">Father Name (RC)</label><input value={obForm.regFatherName} onChange={e=>setObForm(f=>({...f,regFatherName:e.target.value}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"/></div><div><label className="text-xs font-bold text-gray-600">Owner Mobile</label><input value={obForm.regOwnerMob} onChange={e=>setObForm(f=>({...f,regOwnerMob:e.target.value.replace(/\D/g,'').slice(0,10)}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"/></div></div></div>
              <div><h3 className="text-sm font-black text-orange-700 mb-2 border-b-2 border-orange-200 pb-1">🏍️ VEHICLE DETAILS</h3><div className="grid grid-cols-2 md:grid-cols-4 gap-3"><div><label className="text-xs font-bold text-gray-600">Vehicle *</label><input value={obForm.veh} onChange={e=>setObForm(f=>({...f,veh:e.target.value}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none"/></div><div><label className="text-xs font-bold text-gray-600">Model</label><input value={obForm.mdl} onChange={e=>setObForm(f=>({...f,mdl:e.target.value}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none"/></div><div><label className="text-xs font-bold text-gray-600">Reg. No.</label><input value={obForm.regNo} onChange={e=>setObForm(f=>({...f,regNo:e.target.value.toUpperCase()}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm font-mono focus:border-orange-500 outline-none"/></div><div><label className="text-xs font-bold text-gray-600">Year</label><input value={obForm.year} onChange={e=>setObForm(f=>({...f,year:e.target.value}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none"/></div><div><label className="text-xs font-bold text-gray-600">Color</label><input value={obForm.color} onChange={e=>setObForm(f=>({...f,color:e.target.value}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none"/></div><div><label className="text-xs font-bold text-gray-600">Engine No.</label><input value={obForm.engineNo} onChange={e=>setObForm(f=>({...f,engineNo:e.target.value.toUpperCase()}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm font-mono focus:border-orange-500 outline-none"/></div><div><label className="text-xs font-bold text-gray-600">Chassis No.</label><input value={obForm.chassisNo} onChange={e=>setObForm(f=>({...f,chassisNo:e.target.value.toUpperCase()}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm font-mono focus:border-orange-500 outline-none"/></div><div><label className="text-xs font-bold text-gray-600">Exchange Price (₹)</label><input type="number" value={obForm.psPrice} onChange={e=>setObForm(f=>({...f,psPrice:e.target.value}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-yellow-500 outline-none"/></div></div><div><label className="text-xs font-bold text-gray-600">Exchange Notes</label><input value={obForm.exchangeNotes} onChange={e=>setObForm(f=>({...f,exchangeNotes:e.target.value}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none"/></div></div>
              <div><h3 className="text-sm font-black text-green-700 mb-2 border-b-2 border-green-200 pb-1">💰 SELLING DETAILS (जिसको बेची)</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><div><label className="text-xs font-bold text-gray-600">Buyer Name</label><input value={obForm.buyerName} onChange={e=>setObForm(f=>({...f,buyerName:e.target.value}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-green-500 outline-none"/></div><div><label className="text-xs font-bold text-gray-600">Buyer Father</label><input value={obForm.buyerFather} onChange={e=>setObForm(f=>({...f,buyerFather:e.target.value}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-green-500 outline-none"/></div><div><label className="text-xs font-bold text-gray-600">Buyer Mobile</label><input value={obForm.buyerMob} onChange={e=>setObForm(f=>({...f,buyerMob:e.target.value.replace(/\D/g,'').slice(0,10)}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-green-500 outline-none"/></div><div><label className="text-xs font-bold text-gray-600">Buyer Aadhar</label><input value={obForm.buyerAadhar} onChange={e=>setObForm(f=>({...f,buyerAadhar:e.target.value.replace(/\D/g,'').slice(0,12)}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-green-500 outline-none"/></div><div className="md:col-span-2"><label className="text-xs font-bold text-gray-600">Buyer Address</label><input value={obForm.buyerAddress} onChange={e=>setObForm(f=>({...f,buyerAddress:e.target.value}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-green-500 outline-none"/></div><div><label className="text-xs font-bold text-gray-600">Status</label><select value={obForm.status} onChange={e=>setObForm(f=>({...f,status:e.target.value}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-green-500 outline-none bg-white"><option value="Available">🟢 Available (अभी पड़ी है)</option><option value="Sold">🔴 Sold (बेच दी)</option></select></div><div><label className="text-xs font-bold text-gray-600">Sell Price (₹)</label><input type="number" value={obForm.slPrice} onChange={e=>setObForm(f=>({...f,slPrice:e.target.value}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-green-500 outline-none"/></div><div><label className="text-xs font-bold text-gray-600">Sell Date</label><input type="date" value={obForm.sellDate} onChange={e=>setObForm(f=>({...f,sellDate:e.target.value}))} className="w-full border-2 rounded-lg px-3 py-2 text-sm focus:border-green-500 outline-none"/></div></div>{obForm.psPrice&&obForm.slPrice&&(<div className={`mt-3 p-3 rounded-lg font-bold text-center ${(parseFloat(obForm.slPrice)-parseFloat(obForm.psPrice))>=0?'bg-green-50 text-green-700 border-2 border-green-300':'bg-red-50 text-red-700 border-2 border-red-300'}`}>{(parseFloat(obForm.slPrice)-parseFloat(obForm.psPrice))>=0?'✅ Profit':'❌ Loss'}: ₹{Math.abs(parseFloat(obForm.slPrice)-parseFloat(obForm.psPrice)).toLocaleString('en-IN')}</div>)}</div>
              <div className="flex gap-3 justify-end pt-2 border-t"><button onClick={()=>{setShowOldBikeForm(false);resetObForm();}} className="px-5 py-2 border-2 rounded-lg text-gray-600 font-bold text-sm hover:bg-gray-50">Cancel</button><button onClick={saveOldBike} className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-bold text-sm hover:opacity-90">✅ {editingOldBike!==null?'Update':'Save'} Old Bike</button></div>
            </div></div></div>
          )}
        </div>
      )}
    </div>
  );
}
