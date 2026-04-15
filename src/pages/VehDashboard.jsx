import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Upload, Download, Filter, TrendingUp, Calendar, FileText, Share2, Trash2, Edit2, Plus, Eye, EyeOff } from 'lucide-react';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import { api } from '../utils/apiConfig';

export default function VehDashboard() {
  const [vehicleData, setVehicleData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [models, setModels] = useState([]);
  const [variants, setVariants] = useState([]);
  
  // Filters
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  
  // Analytics
  const [monthlyAnalytics, setMonthlyAnalytics] = useState([]);
  const [modelAnalytics, setModelAnalytics] = useState([]);
  const [variantAnalytics, setVariantAnalytics] = useState([]);
  
  // Invoice state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [ratePrices, setRatePrices] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sharedRatePrices') || '{}'); } catch { return {}; }
  });
  const [generatedInvoices, setGeneratedInvoices] = useState(() => {
    try { return JSON.parse(localStorage.getItem('generatedInvoices') || '[]'); } catch { return []; }
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [oldBikes, setOldBikes] = useState(() => { try { return JSON.parse(localStorage.getItem('oldBikeData') || '[]'); } catch { return []; } });
  const [showOldBikeForm, setShowOldBikeForm] = useState(false);
  const [editOldBikeId, setEditOldBikeId] = useState(null);
  const [oldBikeForm, setOldBikeForm] = useState({
    custName:'', custFather:'', custAdd:'', custMob:'',
    owner:'', ownerFather:'', veh:'', mdl:'', regNo:'', psPrice:0, purchaseDate:'',
    buyerName:'', buyerFather:'', buyerAdd:'', buyerMob:'', buyerAadhar:'', slPrice:0, slDate:'',
    status:'Available', notes:''
  });
  const emptyOldBikeForm = { custName:'', custFather:'', custAdd:'', custMob:'', owner:'', ownerFather:'', veh:'', mdl:'', regNo:'', psPrice:0, purchaseDate:'', buyerName:'', buyerFather:'', buyerAdd:'', buyerMob:'', buyerAadhar:'', slPrice:0, slDate:'', status:'Available', notes:'' };
  const [vdActiveTab, setVdActiveTab] = useState('vehicles');
  const [oldBikePage, setOldBikePage] = useState(1);
  const [viewOldBike, setViewOldBike] = useState(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    customerName:'', fatherName:'', mobileNo:'', address:'', dist:'', pinCode:'',
    dob:'', vehicleModel:'', variant:'', color:'', engineNo:'', chassisNo:'',
    keyNo:'', batteryNo:'', financerName:'', price:0
  });
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState('');

  // ── Helper: Sync to MongoDB ────────────────────────────────────────────────
  const syncToMongoDB = async (data) => {
    try {
      const syncData = data.map(v => ({
        customerName: v.customerName, fatherName: v.fatherName, phone: v.mobileNo,
        aadhar: v.aadharNo || '', pan: v.panNo || '', address: v.address,
        district: v.dist, pinCode: v.pinCode || '', dob: v.dob || '',
        vehicleModel: v.vehicleModel, variant: v.variant || '',
        vehicleColor: v.color, engineNo: v.engineNo, chassisNo: v.chassisNo,
        registrationNo: v.regNo, keyNo: v.keyNo || '', batteryNo: v.batteryNo || '',
        invoiceDate: v.date, financeCompany: v.financerName,
        price: v.price || 0, insurance: v.insurance || 0, rto: v.rto || 0,
      }));
      const res = await fetch(api('/api/customers/sync'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customers: syncData }),
      });
      if (res.ok) console.log('✅ MongoDB sync OK');
      else console.error('❌ MongoDB sync failed', await res.text());
    } catch (err) { console.error('Sync error:', err); }
  };

  // ── Load data (localStorage + MongoDB fallback) ───────────────────────────
  useEffect(() => {
    const loadData = async () => {
      const savedData = localStorage.getItem('vehDashboardData');
      const savedModels = localStorage.getItem('vehDashboardModels');
      
      if (savedData) {
        try {
          const pd = JSON.parse(savedData);
          const pm = JSON.parse(savedModels || '[]');
          if (pd.length) {
            setVehicleData(pd);
            setFilteredData(pd);
            setModels(pm.length ? pm : [...new Set(pd.map(d => d.vehicleModel))].filter(Boolean));
            calculateAnalytics(pd);
            return;
          }
        } catch(e) {}
      }
      
      setDbLoading(true);
      try {
        const res = await fetch(api('/api/customers'));
        if (!res.ok) throw new Error('Server error');
        const db = await res.json();
        const valid = db.filter(c => (c.customerName || c.name || '').trim());
        if (valid.length) {
          const transformed = valid.map((c, i) => ({
            id: c._id || i+1,
            customerName: c.customerName || c.name || '',
            fatherName: c.fatherName || '',
            mobileNo: c.phone || c.mobileNo || '',
            address: c.address || '',
            dist: c.district || c.dist || '',
            pinCode: c.pinCode || '',
            vehicleModel: c.vehicleModel || '',
            variant: c.variant || '',
            color: c.vehicleColor || c.color || '',
            engineNo: c.engineNo || '',
            chassisNo: c.chassisNo || '',
            regNo: c.registrationNo || c.regNo || '',
            keyNo: c.keyNo || '',
            date: c.invoiceDate || c.date || '',
            financerName: c.financeCompany || c.financerName || '',
            aadharNo: c.aadhar || c.aadharNo || '',
            panNo: c.pan || c.panNo || '',
            dob: c.dob || '',
            price: parseFloat(c.price) || 0,
          }));
          setVehicleData(transformed);
          setFilteredData(transformed);
          const modelsArr = [...new Set(transformed.map(d => d.vehicleModel))].filter(Boolean);
          setModels(modelsArr);
          calculateAnalytics(transformed);
          localStorage.setItem('vehDashboardData', JSON.stringify(transformed));
          localStorage.setItem('vehDashboardModels', JSON.stringify(modelsArr));
        } else {
          setDbError('Data नहीं मिला — Laptop से Excel import करें');
        }
      } catch(e) {
        setDbError('Server connecting... 30 sec wait करें');
      }
      setDbLoading(false);
    };
    loadData();
  }, []);

  // ── Sync to localStorage & MongoDB whenever vehicleData changes ───────────
  useEffect(() => {
    if (vehicleData.length) {
      localStorage.setItem('vehDashboardData', JSON.stringify(vehicleData));
      syncToMongoDB(vehicleData);
      const customerSync = vehicleData.map(v => ({
        _id: v.id,
        name: v.customerName,
        fatherName: v.fatherName,
        phone: v.mobileNo,
        aadhar: v.aadharNo || '',
        pan: v.panNo || '',
        address: v.address,
        district: v.dist,
        pinCode: v.pinCode || '',
        state: 'M.P.',
        dob: v.dob || '',
        financerName: v.financerName || '',
        variant: v.variant || '',
        price: v.price || 0,
        insurance: v.insurance || 0,
        rto: v.rto || 0,
        keyNo: v.keyNo || '',
        batteryNo: v.batteryNo || '',
        linkedVehicle: {
          name: v.vehicleModel + ' ' + (v.variant || ''),
          regNo: v.regNo || '',
          frameNo: v.chassisNo || '',
          engineNo: v.engineNo || '',
          color: v.color || '',
          model: v.vehicleModel || '',
          keyNo: v.keyNo || '',
          purchaseDate: v.date || '',
          warranty: 'YES'
        }
      }));
      localStorage.setItem('sharedCustomerData', JSON.stringify(customerSync));
      window.dispatchEvent(new Event('dataSync'));
    }
  }, [vehicleData]);

  const handleAdminLogin = () => setShowAdminModal(true);
  const doAdminLogin = () => {
    if (adminPass === 'vphonda@123') { setIsAdmin(true); setShowAdminModal(false); setAdminPass(''); }
    else { alert('❌ Wrong password!'); setAdminPass(''); }
  };

  // ── Old Bike handlers ─────────────────────────────────────────────────────
  const resetOldBikeForm = () => { setOldBikeForm({...emptyOldBikeForm}); setEditOldBikeId(null); };
  const saveOldBike = () => {
    if (!oldBikeForm.custName || !oldBikeForm.veh) { alert('Customer Name और Vehicle भरें'); return; }
    const autoStatus = oldBikeForm.buyerName ? 'Sold' : (oldBikeForm.status || 'Available');
    let updated;
    if (editOldBikeId) {
      updated = oldBikes.map(b => b.id === editOldBikeId ? { ...oldBikeForm, id: editOldBikeId, status: autoStatus } : b);
    } else {
      updated = [{ ...oldBikeForm, id: Date.now(), status: autoStatus, addedAt: new Date().toISOString() }, ...oldBikes];
    }
    setOldBikes(updated); localStorage.setItem('oldBikeData', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
    setShowOldBikeForm(false); resetOldBikeForm(); alert(editOldBikeId ? '✅ Updated!' : '✅ Old Bike added!');
  };
  const editOldBike = (b) => { setOldBikeForm({...emptyOldBikeForm, ...b}); setEditOldBikeId(b.id); setShowOldBikeForm(true); };
  const deleteOldBike = (id) => {
    if (!isAdmin) { alert('❌ Admin only!'); return; }
    if (!window.confirm('Delete this old bike?')) return;
    const updated = oldBikes.filter(b => b.id !== id);
    setOldBikes(updated); localStorage.setItem('oldBikeData', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
  };

  const handleOldBikeImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const wb = XLSX.read(await file.arrayBuffer(), { type:'array', cellDates:true });
    const sn = wb.SheetNames.find(n => /old.?bike/i.test(n));
    if (!sn) { alert('❌ OLD BIKE sheet नहीं मिली! Available: ' + wb.SheetNames.join(', ')); e.target.value=''; return; }
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval:'', header:1 });
    let added = 0;
    const updated = [...oldBikes];
    const fmtDate = (v) => { if(!v) return ''; try { const d = v instanceof Date ? v : new Date(v); if(isNaN(d)) return ''; return d.toISOString().split('T')[0]; } catch{return '';} };
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0] && !r[1]) continue;
      const custName = String(r[1]||'').trim();
      if (!custName) continue;
      updated.push({
        id: Date.now() + added,
        custName, custFather: String(r[2]||'').trim(), custAdd: String(r[3]||'').trim(), custMob: String(r[4]||'').trim(),
        owner: String(r[5]||'').trim(), ownerFather: String(r[6]||'').trim(),
        veh: String(r[7]||'').trim(), mdl: String(r[8]||'').trim(), regNo: String(r[9]||'').trim(),
        psPrice: parseFloat(r[10]) || 0, purchaseDate: fmtDate(r[11]),
        buyerName: String(r[12]||'').trim(), buyerFather: String(r[13]||'').trim(),
        buyerAdd: String(r[14]||'').trim(), buyerMob: String(r[15]||'').trim(),
        buyerAadhar: String(r[16]||'').trim(), slPrice: parseFloat(r[17]) || 0, slDate: fmtDate(r[18]),
        status: String(r[12]||'').trim() ? 'Sold' : 'Available',
        addedAt: new Date().toISOString(),
      });
      added++;
    }
    setOldBikes(updated); localStorage.setItem('oldBikeData', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
    alert(`✅ ${added} old bikes imported from "${sn}" sheet!`);
    e.target.value = '';
  };

  const handleDeleteInvoice = (id) => {
    if (!isAdmin) { alert('❌ Admin only!'); return; }
    if (!window.confirm('Delete this invoice?')) return;
    const updated = generatedInvoices.filter(inv => inv.id !== id);
    setGeneratedInvoices(updated);
    localStorage.setItem('generatedInvoices', JSON.stringify(updated));
  };

  const handleDeleteVehicle = (vehicleId) => {
    if (!isAdmin) { alert('❌ Admin only!'); return; }
    if (!window.confirm('Delete this record?')) return;
    const updated = vehicleData.filter(v => v.id !== vehicleId);
    setVehicleData(updated);
  };

  const handleAddNewCustomer = () => {
    const nc = {...newCustomer, id: Date.now(), date: new Date().toISOString().split('T')[0]};
    const updated = [...vehicleData, nc];
    setVehicleData(updated);
    setShowAddCustomer(false);
    setNewCustomer({customerName:'',fatherName:'',mobileNo:'',address:'',dist:'',pinCode:'',dob:'',vehicleModel:'',variant:'',color:'',engineNo:'',chassisNo:'',keyNo:'',batteryNo:'',financerName:'',price:0});
    alert('✅ Customer added!');
  };

  const [invoiceData, setInvoiceData] = useState({
    customerName: '', fatherName: '', mobileNo: '', address: '', dist: '', pinCode: '',
    vehicleModel: '', color: '', variant: '', engineNo: '', chassisNo: '',
    keyNo: '', batteryNo: '', financerName: '', dob: '', price: 0,
    invoiceDate: new Date().toISOString().split('T')[0],
    gstin: '23BCYPD9538B1ZG', pan: 'BCYPD9538B'
  });

  // ── Excel Import (cost_detl) ──────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { cellDates: true });
        const worksheet = workbook.Sheets['cost_detl'];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        const rateSheet = workbook.Sheets['Rate_List'];
        const priceMap = {};
        if (rateSheet) {
          const rateData = XLSX.utils.sheet_to_json(rateSheet, { header: 1 });
          for (let i = 0; i < rateData.length; i++) {
            const row = rateData[i];
            if (!row) continue;
            const model = row[1];
            const exShowroom = parseFloat(row[4]);
            const taxRate = parseFloat(row[15]);
            if (model && typeof model === 'string' && model.length > 3 && exShowroom > 0) {
              priceMap[model.trim().toUpperCase()] = { exShowroom, taxRate: taxRate || 0 };
            }
          }
          setRatePrices(priceMap);
          localStorage.setItem('sharedRatePrices', JSON.stringify(priceMap));
        }
        
        const parseExcelDate = (val) => {
          if (!val) return '';
          let d;
          if (val instanceof Date) d = val;
          else if (typeof val === 'number') d = new Date(Math.round((val - 25569) * 86400 * 1000) + 43200000);
          else {
            const str = String(val).trim();
            const parts = str.split(/[\/\-\.]/);
            if (parts.length === 3) {
              let a = parseInt(parts[0]), b = parseInt(parts[1]), c = parseInt(parts[2]);
              if (c > 100) d = new Date(c, b-1, a);
              else if (a > 100) d = new Date(a, b-1, c);
              else d = new Date(str);
            } else d = new Date(str);
          }
          if (!d || isNaN(d.getTime())) return '';
          return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
        };

        const transformedData = jsonData
          .filter(row => row['Cost Name'])
          .map((row, idx) => ({
            id: idx,
            customerName: row['Cost Name'] || '',
            fatherName: row['Father'] || '',
            sNo: row['S No'] || '',
            date: parseExcelDate(row['Date']),
            vehicleModel: row['Veh '] || '',
            color: row['Colour'] || '',
            variant: row['Varit '] || '',
            dob: parseExcelDate(row['DOB']),
            aadharNo: row['Aadhar No'] || '',
            panNo: row['PAN No'] || '',
            mobileNo: row['Mob No'] || '',
            address: row['Add'] || '',
            dist: row['Dist'] || '',
            pinCode: row['Pin Code'] || '',
            engineNo: row['Ingine No'] || '',
            chassisNo: row['Chassis No'] || '',
            keyNo: row['Key No'] || '',
            financerName: row['Fin/ Cash'] || row['Fin/Cash'] || row['Financer'] || row['Finance'] || '',
            batteryNo: row['Bty No'] || row['Battery No'] || '',
            regNo: row['Veh Reg No'] || '',
            price: parseFloat(row['Price']) || 0,
            insurance: parseFloat(row['Insurance']) || 0,
            rto: parseFloat(row['RTO']) || 0
          }));
        
        setVehicleData(transformedData);
        setFilteredData(transformedData);
        const uniqueModels = [...new Set(transformedData.map(d => d.vehicleModel))].filter(Boolean);
        setModels(uniqueModels);
        calculateAnalytics(transformedData);
        
        localStorage.setItem('vehDashboardData', JSON.stringify(transformedData));
        localStorage.setItem('vehDashboardModels', JSON.stringify(uniqueModels));
        
        await syncToMongoDB(transformedData);
        
        alert('✅ डेटा सफलतापूर्वक लोड हो गया!\n💾 Data save हो गया - अगली बार auto-load होगा!');
      } catch (error) {
        alert('❌ फाइल लोड करने में त्रुटि: ' + error.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const calculateAnalytics = (data) => {
    if (!data || data.length === 0) return;
    const monthlyData = {};
    data.forEach(item => {
      if (item.date) {
        const dateObj = new Date(item.date);
        if (!dateObj || isNaN(dateObj.getTime())) return;
        const monthYear = `${dateObj.toLocaleString('en-IN', { month: 'short' })}-${dateObj.getFullYear()}`;
        monthlyData[monthYear] = (monthlyData[monthYear] || 0) + 1;
      }
    });
    const monthlyChart = Object.entries(monthlyData).map(([month, count]) => ({ month, count })).sort((a,b) => new Date(a.month) - new Date(b.month));
    setMonthlyAnalytics(monthlyChart);
    const modelData = {};
    data.forEach(item => { if (item.vehicleModel) modelData[item.vehicleModel] = (modelData[item.vehicleModel] || 0) + 1; });
    const modelChart = Object.entries(modelData).map(([model, count]) => ({ model, count })).sort((a,b) => b.count - a.count);
    setModelAnalytics(modelChart);
    const variantData = {};
    data.forEach(item => { if (item.variant) variantData[item.variant] = (variantData[item.variant] || 0) + 1; });
    const variantChart = Object.entries(variantData).map(([variant, count]) => ({ variant, count })).sort((a,b) => b.count - a.count);
    setVariantAnalytics(variantChart);
  };

  useEffect(() => {
    let filtered = vehicleData;
    if (selectedModel) filtered = filtered.filter(d => d.vehicleModel === selectedModel);
    if (selectedVariant) filtered = filtered.filter(d => d.variant === selectedVariant);
    if (selectedYear) filtered = filtered.filter(d => d.date && new Date(d.date).getFullYear().toString() === selectedYear);
    if (selectedMonth) filtered = filtered.filter(d => d.date && (new Date(d.date).getMonth()+1).toString().padStart(2,'0') === selectedMonth);
    setFilteredData(filtered);
    calculateAnalytics(filtered);
    setCurrentPage(1);
  }, [selectedModel, selectedVariant, selectedYear, selectedMonth, vehicleData]);

  const getVariantsForModel = () => {
    if (!selectedModel) return [];
    return [...new Set(vehicleData.filter(d => d.vehicleModel === selectedModel).map(d => d.variant))];
  };
  const getYears = () => {
    const years = new Set();
    vehicleData.forEach(d => { if (d.date) years.add(new Date(d.date).getFullYear().toString()); });
    return Array.from(years).sort().reverse();
  };

  const handleGenerateInvoice = (vehicle) => {
    setSelectedVehicle(vehicle);
    const modelKey = (vehicle.vehicleModel || '').trim().toUpperCase();
    let autoPrice = vehicle.price;
    for (const [key, val] of Object.entries(ratePrices)) {
      if (modelKey && key.includes(modelKey.split(' ')[0]) && key.includes(modelKey.split(' ').pop())) {
        autoPrice = val.exShowroom || val;
        break;
      }
    }
    if (ratePrices[modelKey]) autoPrice = ratePrices[modelKey].exShowroom || ratePrices[modelKey];
    setInvoiceData({
      customerName: vehicle.customerName, fatherName: vehicle.fatherName, mobileNo: vehicle.mobileNo,
      address: vehicle.address, dist: vehicle.dist, pinCode: vehicle.pinCode,
      vehicleModel: vehicle.vehicleModel, color: vehicle.color, variant: vehicle.variant,
      engineNo: vehicle.engineNo, chassisNo: vehicle.chassisNo, keyNo: vehicle.keyNo,
      batteryNo: vehicle.batteryNo || '', price: autoPrice, dob: vehicle.dob || '',
      financerName: vehicle.financerName || '', invoiceDate: new Date().toISOString().split('T')[0],
      gstin: '23BCYPD9538B1ZG', pan: 'BCYPD9538B'
    });
    setShowInvoiceModal(true);
  };

  const handleEditVehicle = (vehicle) => {
    setEditVehicle({...vehicle});
    setShowEditModal(true);
  };
  const saveEditVehicle = () => {
    const updated = vehicleData.map(v => v.id === editVehicle.id ? editVehicle : v);
    setVehicleData(updated);
    setShowEditModal(false);
    alert('✅ Updated!');
  };

  const amountToWords = (num) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
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
    const nextNum = generatedInvoices.length + 1;
    const invoiceNo = `SMH/${new Date(invoiceData.invoiceDate).getFullYear()}-${String(new Date(invoiceData.invoiceDate).getMonth() + 1).padStart(2, '0')} ${String(nextNum).padStart(3, '0')}`;
    const invoiceDate = invoiceData.invoiceDate;
    const enteredAmount = parseFloat(invoiceData.price) || 0;
    const taxablePrice = Math.round((enteredAmount / 1.18) * 100) / 100;
    const sgst = Math.round((taxablePrice * 0.09) * 100) / 100;
    const cgst = Math.round((taxablePrice * 0.09) * 100) / 100;
    const invoiceSubTotal = taxablePrice + sgst + cgst;
    const invoiceTotal = Math.round(invoiceSubTotal);
    const roundOff = Math.round((invoiceTotal - invoiceSubTotal) * 100) / 100;
    const fmt = (v) => (v||0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});

    const invoiceHTML = `...`; // (HTML template is long, keep your existing one – unchanged)
    // For brevity, I'm not repeating the whole HTML here. Use the same as in your working version.
    
    const opt = {
      margin: [8, 8, 8, 8],
      filename: 'Invoice_' + invoiceData.customerName + '_' + invoiceDate + '.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    };
    html2pdf().set(opt).from(invoiceHTML).save();
    const newInvoice = { invoiceNo, customerName: invoiceData.customerName, vehicleModel: invoiceData.vehicleModel, amount: invoiceTotal, date: invoiceDate, id: Date.now() };
    const updatedInvoices = [...generatedInvoices, newInvoice];
    setGeneratedInvoices(updatedInvoices);
    localStorage.setItem('generatedInvoices', JSON.stringify(updatedInvoices));
    setShowInvoiceModal(false);
  };

  const MobileLoadingBanner = () => {
    if (dbLoading) return <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 text-center mb-4"><div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"/><p className="text-yellow-700 font-bold">⏳ Server से data load हो रहा है...</p><p className="text-yellow-500 text-sm">पहली बार 30-50 sec लग सकते हैं</p></div>;
    if (dbError && vehicleData.length === 0) return <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 text-center mb-4"><p className="text-red-700 font-bold text-lg">⚠️ {dbError}</p><Button onClick={()=>window.location.reload()} className="mt-3 bg-red-600 text-white">🔄 Refresh</Button></div>;
    return null;
  };

  const COLORS = ['#1e3c72', '#2a5298', '#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8'];

  // Helper to sort filteredData by date (newest first)
  const sortedFilteredData = [...filteredData].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <MobileLoadingBanner />
      {/* Admin modal, viewOldBike modal, header, tabs - same as before (keep your existing code) */}
      {/* I'm skipping the repetitive JSX for brevity, but below is the important fixed table section */}
      
      {/* ========== VEHICLES TAB CONTENT (only the table part is fixed) ========== */}
      {vdActiveTab === 'vehicles' && (
        <>
          {/* ... all the filters, analytics cards remain exactly as you had ... */}
          
          {/* Data Table - FIXED VERSION with proper sorting and no syntax error */}
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardHeader className="bg-gradient-to-r from-indigo-600 to-indigo-700">
              <CardTitle className="text-white">📋 Vehicle Records ({filteredData.length})</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-slate-300">
                  <thead className="bg-slate-700 text-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-left">Model</th>
                      <th className="px-4 py-3 text-left">Variant</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-right">Price</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFilteredData.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage).map((vehicle) => (
                      <tr key={vehicle.id} className="border-t border-slate-700 hover:bg-slate-700/50">
                        <td className="px-4 py-3">{vehicle.customerName}</td>
                        <td className="px-4 py-3">{vehicle.vehicleModel}</td>
                        <td className="px-4 py-3">{vehicle.variant}</td>
                        <td className="px-4 py-3">{vehicle.date ? new Date(vehicle.date).toLocaleDateString('en-IN') : 'N/A'}</td>
                        <td className="px-4 py-3 text-right font-semibold">₹{(vehicle.price || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-center flex gap-1 justify-center">
                          {isAdmin && (
                            <Button
                              onClick={() => handleGenerateInvoice(vehicle)}
                              size="sm"
                              className={generatedInvoices.some(inv => inv.customerName === vehicle.customerName) ? "bg-green-700 hover:bg-green-800 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}
                            >
                              {generatedInvoices.some(inv => inv.customerName === vehicle.customerName) ? '✅' : 'Invoice'}
                            </Button>
                          )}
                          <Button onClick={() => handleEditVehicle(vehicle)} size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white">
                            <Edit2 size={14} />
                          </Button>
                          {isAdmin && (
                            <Button onClick={() => handleDeleteVehicle(vehicle.id)} size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredData.length > recordsPerPage && (
                  <div className="flex items-center justify-center gap-4 mt-4">
                    <Button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="bg-slate-600 hover:bg-slate-500 text-white disabled:opacity-40">⬅ Previous</Button>
                    <span className="text-slate-300">Page {currentPage} / {Math.ceil(filteredData.length / recordsPerPage)} ({filteredData.length} records)</span>
                    <Button onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredData.length / recordsPerPage), p + 1))} disabled={currentPage >= Math.ceil(filteredData.length / recordsPerPage)} className="bg-slate-600 hover:bg-slate-500 text-white disabled:opacity-40">Next ➡</Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
      
      {/* Rest of your component (Old Bikes tab, modals, etc.) remains exactly as before */}
    </div>
  );
}
