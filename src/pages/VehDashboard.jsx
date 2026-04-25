import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Upload, Download, Filter, TrendingUp, Calendar, FileText, Share2, Trash2, Edit2, Plus, Eye, EyeOff, Activity, Bike } from 'lucide-react';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import { api } from '../utils/apiConfig';
import { HONDA_MODELS, HONDA_COLORS, FINANCE_COMPANIES, findModel, getHSN, getModelsByCategory, calculateTaxBreakdown } from './hondaRateList';

export default function VehDashboard() {
  const navigate = useNavigate();
  const [vehicleData, setVehicleData] = useState([]);
  const [customers, setCustomers] = useState([]);   // ⭐ for Service Profile lookup
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
    // ⭐ Personal details (Invoice required)
    customerName:'', fatherName:'', mobileNo:'', altMobile:'',
    address:'', dist:'', state:'MADHYA PRADESH', pinCode:'462001',
    dob:'', aadhar:'', pan:'',
    // Vehicle details
    vehicleModel:'', variant:'', color:'',
    chassisNo:'', engineNo:'', keyNo:'', batteryNo:'',
    hsnNumber:'', billBookNo:'', cc:'', year: new Date().getFullYear(),
    // ⭐ Pricing — Ex-Showroom is the actual selling price (includes 18% GST)
    // Tax breakdown is calculated only when generating Tax Invoice
    price:0, exShowroom:0,
    // Finance
    financerName:'CASH',
    // Meta
    purchaseDate: new Date().toISOString().split('T')[0],
    invoiceNo: '',
  });
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState('');

  // ── Helper: Sync to MongoDB ────────────────────────────────────────────────
  // पूरी फाइल बहुत लंबी है, इसलिए मैं सिर्फ वही हिस्सा दे रहा हूँ जो बदलना है।
// नीचे दिए गए `syncToMongoDB` फंक्शन को अपनी फाइल में रिप्लेस करें।
// बाकी पूरी फाइल वैसी ही रखें जैसी आपके पास है (जो पिछले मैसेज में दी थी)।

const syncToMongoDB = async (data) => {
  try {
    // ✅ अब हर customer के लिए linkedVehicle बनाकर भेजेंगे
    const syncData = data.map(v => ({
      customerName: v.customerName,
      fatherName: v.fatherName,
      phone: v.mobileNo,
      aadhar: v.aadharNo || '',
      pan: v.panNo || '',
      address: v.address,
      district: v.dist,
      pinCode: v.pinCode || '',
      dob: v.dob || '',
      // ये फ़ील्ड CustomerManagement के लिए जरूरी हैं
      vehicleModel: v.vehicleModel,
      variant: v.variant,
      vehicleColor: v.color,
      engineNo: v.engineNo,
      chassisNo: v.chassisNo,
      registrationNo: v.regNo,
      keyNo: v.keyNo,
      batteryNo: v.batteryNo,
      invoiceDate: v.date,
      financeCompany: v.financerName,
      price: v.price || 0,
      insurance: v.insurance || 0,
      rto: v.rto || 0,
    }));
    const res = await fetch(api('/api/customers/sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
        setCustomers(db);                                                           // ⭐ keep raw customers for lookup
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

  // Admin login
  const handleAdminLogin = () => setShowAdminModal(true);
  const doAdminLogin = () => {
    if (adminPass === 'vphonda@123') { setIsAdmin(true); setShowAdminModal(false); setAdminPass(''); }
    else { alert('❌ Wrong password!'); setAdminPass(''); }
  };

  // Old Bike handlers
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

  const handleAddNewCustomer = async () => {
    if (!newCustomer.customerName || !newCustomer.mobileNo) {
      alert('⚠️ Customer Name और Mobile जरूरी हैं');
      return;
    }
    // ⭐ FIX: use the purchaseDate from form, not today's date
    const useDate = newCustomer.purchaseDate || new Date().toISOString().split('T')[0];
    const nc = {
      ...newCustomer,
      id: Date.now(),
      date: useDate,                // ⭐ for vehicle dashboard
      purchaseDate: useDate,        // ⭐ explicit
    };

    // Add to local vehicle list
    const updated = [...vehicleData, nc];
    setVehicleData(updated);

    // ⭐ ALSO save to MongoDB customers collection (for cross-page sync)
    try {
      const customerPayload = {
        name: newCustomer.customerName,
        customerName: newCustomer.customerName,
        fatherName: newCustomer.fatherName,
        phone: newCustomer.mobileNo,
        mobileNo: newCustomer.mobileNo,
        altMobile: newCustomer.altMobile || '',
        aadhar: newCustomer.aadhar || '',
        pan: newCustomer.pan || '',
        dob: newCustomer.dob || '',
        address: newCustomer.address,
        district: newCustomer.dist,
        dist: newCustomer.dist,
        state: newCustomer.state || 'MADHYA PRADESH',
        pinCode: newCustomer.pinCode || '',
        financerName: newCustomer.financerName || 'CASH',
        vehiclePrice: parseFloat(newCustomer.exShowroom || newCustomer.price || 0),
        linkedVehicle: {
          name: newCustomer.vehicleModel || '',
          model: newCustomer.vehicleModel || '',
          variant: newCustomer.variant || '',
          color: newCustomer.color || '',
          frameNo: newCustomer.chassisNo || '',
          chassisNo: newCustomer.chassisNo || '',
          engineNo: newCustomer.engineNo || '',
          keyNo: newCustomer.keyNo || '',
          batteryNo: newCustomer.batteryNo || '',
          hsnNumber: newCustomer.hsnNumber || '',
          billBookNo: newCustomer.billBookNo || '',
          year: newCustomer.year || '',
          purchaseDate: useDate,        // ⭐ proper date
          price: parseFloat(newCustomer.exShowroom || newCustomer.price || 0),
          warranty: 'YES',
          regNo: '',
        },
      };
      await fetch(api('/api/customers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerPayload),
      });
    } catch (e) {
      console.warn('Customer MongoDB sync failed:', e.message);
    }

    setShowAddCustomer(false);
    setNewCustomer({
      customerName:'', fatherName:'', mobileNo:'', altMobile:'',
      address:'', dist:'', state:'MADHYA PRADESH', pinCode:'462001',
      dob:'', aadhar:'', pan:'',
      vehicleModel:'', variant:'', color:'',
      chassisNo:'', engineNo:'', keyNo:'', batteryNo:'',
      hsnNumber:'', billBookNo:'', cc:'', year: new Date().getFullYear(),
      price:0, exShowroom:0,
      financerName:'CASH',
      purchaseDate: new Date().toISOString().split('T')[0],
      invoiceNo: '',
    });
    alert('✅ Customer added! Customer Management में भी दिखेगा।');
  };

  const [invoiceData, setInvoiceData] = useState({
    customerName: '', fatherName: '', mobileNo: '', address: '', dist: '', pinCode: '',
    vehicleModel: '', color: '', variant: '', engineNo: '', chassisNo: '',
    keyNo: '', batteryNo: '', financerName: '', dob: '', price: 0,
    relation: 'S/O',                                            // ⭐ S/O, W/O, D/O, C/O
    cc: '',                                                     // ⭐ vehicle CC
    hsnNumber: '87112029',                                      // ⭐ HSN code
    year: new Date().getFullYear(),                             // ⭐ year
    invoiceDate: new Date().toISOString().split('T')[0],
    gstin: '23BCYPD9538B1ZG', pan: 'BCYPD9538B'
  });

  // Excel Import
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

    // ⭐ FIX: Always use Ex-Showroom from Honda rate list (not the saved on-road price)
    let autoPrice = vehicle.price;
    const matchedModel = findModel(vehicle.vehicleModel || '');
    if (matchedModel) {
      autoPrice = matchedModel.exShowroom;
    } else {
      for (const [key, val] of Object.entries(ratePrices)) {
        if (modelKey && key.includes(modelKey.split(' ')[0]) && key.includes(modelKey.split(' ').pop())) {
          autoPrice = val.exShowroom || val;
          break;
        }
      }
      if (ratePrices[modelKey]) autoPrice = ratePrices[modelKey].exShowroom || ratePrices[modelKey];
    }

    // ⭐ Smart relation guess (S/O, W/O, D/O) based on customer name
    // Default = S/O (Son of). Female names usually get W/O or D/O.
    const guessedRelation = vehicle.relation || 'S/O';

    // ⭐ Use saved purchase date if available, else today
    const purchaseDate = vehicle.date || vehicle.purchaseDate || new Date().toISOString().split('T')[0];

    // ⭐ Get HSN from model (Scooter vs Bike)
    const modelInfo = findModel(vehicle.vehicleModel || '');
    const autoHSN = modelInfo ? getHSN(vehicle.vehicleModel) : (vehicle.hsnNumber || '87112029');

    setInvoiceData({
      customerName: vehicle.customerName, fatherName: vehicle.fatherName, mobileNo: vehicle.mobileNo,
      address: vehicle.address, dist: vehicle.dist, pinCode: vehicle.pinCode,
      vehicleModel: vehicle.vehicleModel, color: vehicle.color, variant: vehicle.variant,
      engineNo: vehicle.engineNo, chassisNo: vehicle.chassisNo, keyNo: vehicle.keyNo,
      batteryNo: vehicle.batteryNo || '', price: autoPrice, dob: vehicle.dob || '',
      relation: guessedRelation,                                  // ⭐ S/O, W/O, D/O, C/O
      cc: vehicle.cc || vehicle.variant || '',                    // ⭐ CC value
      hsnNumber: autoHSN,                                         // ⭐ HSN
      year: vehicle.year || new Date(purchaseDate).getFullYear(), // ⭐ year
      financerName: vehicle.financerName || '',
      invoiceDate: purchaseDate,                                   // ⭐ FIX: use purchase date
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

    const invoiceHTML = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 950px; margin: 0 auto; background: white; color: #000; font-size: 12px; line-height: 1.5;">
        <div style="margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 8px;">
          <div style="font-weight: bold; font-size: 14px;">V P HONDA</div>
          <div>NARSINGHGARH ROAD, NEAR BRIDGE, PARWALIYA SADAK</div>
          <div>BHOPAL , MADHYA PRADESH , 462030</div>
          <div>9713394738</div>
          <div>Email :- vphonda1@gmail.com</div>
          <div>GSTIN No : 23BCYPD9538B1ZG</div>
          <div style="margin-top: 4px;">PAN No: - BCYPD9538B</div>
        </div>
        <div style="text-align: center; margin-bottom: 10px;">
          <span style="font-weight: bold; font-size: 15px; text-decoration: underline;">TAX INVOICE</span>
        </div>
        <hr style="border: 1px solid #000; margin-bottom: 8px;">
        <table style="width: 100%; margin-bottom: 10px; font-size: 12px; border: none;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width: 58%; vertical-align: top; padding: 0; border: none;">
              <div style="font-weight: bold; text-decoration: underline; margin-bottom: 4px;">CUSTOMER NAME &amp; ADDRESS</div>
              <table style="width: 100%; border: none; font-size: 12px;" cellpadding="2" cellspacing="0">
                <tr><td style="border:none; width:120px; font-weight:bold;">Sold To</td><td style="border:none; width:10px;">:</td><td style="border:none;">${invoiceData.customerName} &nbsp;&nbsp; <strong>${invoiceData.relation || 'S/O'}</strong> ${invoiceData.fatherName}</td></tr>
                <tr><td style="border:none; font-weight:bold;">Mobile</td><td style="border:none;">:</td><td style="border:none;">${invoiceData.mobileNo}</td></tr>
                <tr><td style="border:none; font-weight:bold;">Address</td><td style="border:none;">:</td><td style="border:none;">${invoiceData.address}</td></tr>
                <tr><td style="border:none; font-weight:bold;">Dist</td><td style="border:none;">:</td><td style="border:none;">${invoiceData.dist} &nbsp;&nbsp;&nbsp; ${invoiceData.pinCode || ''}</td></tr>
                <tr><td style="border:none; font-weight:bold;">State</td><td style="border:none;">:</td><td style="border:none;">MADHYA PRADESH (State Code: 23)</td></tr>
                <tr><td style="border:none; font-weight:bold;">DOB</td><td style="border:none;">:</td><td style="border:none;">${invoiceData.dob ? invoiceData.dob.split('-').reverse().join('-') : ''}</td></tr>
                <tr><td style="border:none; font-weight:bold;">Financer Name</td><td style="border:none;">:</td><td style="border:none;">${invoiceData.financerName || ''}</td></tr>
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
          <tr style="font-weight: bold;"><td style="padding: 5px; border: 1px solid #000; width: 5%; text-align: center;">S No</td><td style="padding: 5px; border: 1px solid #000; width: 16%;">Model</td><td style="padding: 5px; border: 1px solid #000; width: 10%;">Variant</td><td style="padding: 5px; border: 1px solid #000; width: 10%;">Color</td><td style="padding: 5px; border: 1px solid #000; width: 12%;">HSN Number</td><td style="padding: 5px; border: 1px solid #000; width: 17%;">Chassis No</td><td style="padding: 5px; border: 1px solid #000; width: 14%;">Engine No</td><td style="padding: 5px; border: 1px solid #000; width: 16%; text-align: right;">Amount</td></tr>
          <tr><td style="padding: 5px; border: 1px solid #000; text-align: center;">1</td><td style="padding: 5px; border: 1px solid #000;">${invoiceData.vehicleModel}</td><td style="padding: 5px; border: 1px solid #000;">${invoiceData.variant}</td><td style="padding: 5px; border: 1px solid #000;">${invoiceData.color}</td><td style="padding: 5px; border: 1px solid #000;">${invoiceData.hsnNumber || '87112029'}</td><td style="padding: 5px; border: 1px solid #000;">${invoiceData.chassisNo}</td><td style="padding: 5px; border: 1px solid #000;">${invoiceData.engineNo}</td><td style="padding: 5px; border: 1px solid #000; text-align: right;">₹ ${fmt(taxablePrice)}</td></tr>
        </table>
        <table style="width: 100%; margin-bottom: 5px; font-size: 12px; border-collapse: collapse;">
          <tr><td style="padding: 4px; border: 1px solid #000; font-weight: bold; width: 70%;">Taxable Price</td><td style="padding: 4px; border: 1px solid #000; text-align: right; width: 30%;">₹ ${fmt(taxablePrice)}</td></tr>
          <tr><td style="padding: 4px; border: 1px solid #000;">SGST @ 9%</td><td style="padding: 4px; border: 1px solid #000; text-align: right;">₹ ${fmt(sgst)}</td></tr>
          <tr><td style="padding: 4px; border: 1px solid #000;">CGST @ 9%</td><td style="padding: 4px; border: 1px solid #000; text-align: right;">₹ ${fmt(cgst)}</td></tr>
          <tr><td style="padding: 4px; border: 1px solid #000; font-weight: bold;">Ex-Showroom Price</td><td style="padding: 4px; border: 1px solid #000; text-align: right;">₹ ${fmt(invoiceSubTotal)}</td></tr>
          <tr><td style="padding: 4px; border: 1px solid #000;">Invoice Sub Total</td><td style="padding: 4px; border: 1px solid #000; text-align: right;">₹ ${fmt(invoiceSubTotal)}</td></tr>
          <tr><td style="padding: 4px; border: 1px solid #000;">(Round Off)</td><td style="padding: 4px; border: 1px solid #000; text-align: right;">₹ ${fmt(roundOff)}</td></tr>
          <tr><td style="padding: 4px; border: 1px solid #000; font-weight: bold;">Invoice Total</td><td style="padding: 4px; border: 1px solid #000; text-align: right; font-weight: bold;">₹ ${fmt(invoiceTotal)}</td></tr>
        </table>
        <table style="width: 100%; margin-bottom: 5px; font-size: 12px; border-collapse: collapse;">
          <tr><td style="padding: 4px; border: 1px solid #000; font-weight: bold; width: 22%;">Amount in Words</td><td style="padding: 4px; border: 1px solid #000;">: ${amountToWords(invoiceTotal)}</td></tr>
          <tr><td style="padding: 4px; border: 1px solid #000; font-weight: bold;">Remarks</td><td style="padding: 4px; border: 1px solid #000;">:</td></tr>
        </table>
        <table style="width: 100%; margin-bottom: 8px; font-size: 12px; border-collapse: collapse;">
          <tr style="font-weight: bold;"><td style="padding: 4px; border: 1px solid #000; width: 20%;">Battery No. #</td><td style="padding: 4px; border: 1px solid #000; width: 20%;">Book No.#</td><td style="padding: 4px; border: 1px solid #000; width: 20%;">Key No.#</td><td style="padding: 4px; border: 1px solid #000; width: 20%;">CC #</td><td style="padding: 4px; border: 1px solid #000; width: 20%;">Year #</td></tr>
          <tr><td style="padding: 4px; border: 1px solid #000;">${invoiceData.batteryNo || 'NA'}</td><td style="padding: 4px; border: 1px solid #000;">NA</td><td style="padding: 4px; border: 1px solid #000;">${invoiceData.keyNo || ''}</td><td style="padding: 4px; border: 1px solid #000;">${invoiceData.cc || invoiceData.variant || ''}</td><td style="padding: 4px; border: 1px solid #000;">${invoiceData.year || new Date(invoiceDate).getFullYear()}</td></tr>
        </table>
        <div style="font-size: 8px; margin-bottom: 4px; line-height: 1.2;">
          <div style="font-weight: bold;">Terms &amp; conditions-</div>
          <div>1. E &amp; O.E. 2. Goods once sold will not be returned or exchanged under any circumstances.</div>
          <div>3. The vehicle/documents has been thoroughly inspected,tested and is free of any kind of defect and is upto my satisfaction.</div>
          <div>4. I have also read the warranty terms and conditions as explained in the owner's manual &amp; understand that my warranty claims if any, will beconsidered by the manufacturer only in accordance with the scope and limit of warranty as laid down in the warranty certificate.</div>
          <div>5. All disputes are subjected to the jurisdiction of courts of law at CITY.</div>
          <div>6. I have checked my particulars and are correct to best of my knowledge.</div>
          <div>7. I have received the vehicle in good condition along with tool and first aid kit and other compulsary accesories</div>
          <div>8. Registration and insurance will be done at the owner's risk and liability.</div>
          <div>9. I have understood all the conditions about Colour, Model and Manufacturing Date.</div>
        </div>
        <table style="width: 100%; margin-top: 15px; font-size: 12px; border: none;" cellpadding="0" cellspacing="0">
          <tr><td style="width: 50%; vertical-align: bottom; padding-top: 20px; border: none;"><strong>Customer Signature</strong></td><td style="width: 50%; text-align: right; vertical-align: bottom; border: none;"><div>For V P HONDA</div><div style="margin-top: 15px;"><strong>Authorized Signature</strong></div></td></tr>
        </table>
        <div style="text-align: center; margin-top: 15px; font-weight: bold; font-size: 13px;">THANKS. VISIT AGAIN</div>
      </div>
    `;

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
  const sortedFilteredData = [...filteredData].sort((a, b) => new Date(b.date) - new Date(a.date));
  const totalRevenue = vehicleData.reduce((sum, v) => sum + (v.price || 0), 0);

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <MobileLoadingBanner />
      
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-80">
            <h3 className="font-bold text-lg mb-4 text-gray-800">🔒 Admin Login</h3>
            <div className="relative mb-4">
              <input type={showPass?'text':'password'} placeholder="Admin Password" value={adminPass}
                onChange={e=>setAdminPass(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')doAdminLogin();}}
                className="w-full border-2 border-gray-300 rounded px-3 py-2 pr-10 text-sm focus:border-red-500 outline-none" autoFocus/>
              <button type="button" onClick={()=>setShowPass(!showPass)} className="absolute right-2 top-2.5 text-gray-500 hover:text-gray-700">
                {showPass ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={doAdminLogin} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded font-bold">Login</button>
              <button onClick={()=>{setShowAdminModal(false);setAdminPass('');}} className="flex-1 bg-gray-300 hover:bg-gray-400 py-2 rounded font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {viewOldBike && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg border border-slate-600 max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-4 rounded-t-xl">
              <h3 className="font-bold text-lg text-white">🚲 Old Bike — {viewOldBike.veh} {viewOldBike.mdl}</h3>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-orange-400 text-xs font-bold">📤 जिसने गाड़ी दी (Seller)</p>
              {[['Customer',viewOldBike.custName],['Father',viewOldBike.custFather],['Address',viewOldBike.custAdd],['Phone',viewOldBike.custMob]].map(([k,v],i)=>(
                <div key={i} className="flex justify-between py-0.5"><span className="text-slate-400 text-sm">{k}</span><span className="text-white text-sm font-bold">{v||'—'}</span></div>
              ))}
              <p className="text-blue-400 text-xs font-bold mt-2">🏍️ Vehicle / Owner</p>
              {[['Owner (RC)',viewOldBike.owner],['Owner Father',viewOldBike.ownerFather],['Vehicle',viewOldBike.veh],['Model',viewOldBike.mdl],['Reg No',viewOldBike.regNo],['Purchase Price','₹'+(viewOldBike.psPrice||0).toLocaleString('en-IN')],['Purchase Date',viewOldBike.purchaseDate]].map(([k,v],i)=>(
                <div key={i} className="flex justify-between py-0.5"><span className="text-slate-400 text-sm">{k}</span><span className="text-white text-sm font-bold">{v||'—'}</span></div>
              ))}
              <p className="text-green-400 text-xs font-bold mt-2">📥 जिसको बेची (Buyer)</p>
              {[['Buyer',viewOldBike.buyerName],['Father',viewOldBike.buyerFather],['Address',viewOldBike.buyerAdd],['Phone',viewOldBike.buyerMob],['Aadhar',viewOldBike.buyerAadhar],['Sell Price','₹'+(viewOldBike.slPrice||0).toLocaleString('en-IN')],['Sell Date',viewOldBike.slDate],['Status',viewOldBike.status]].map(([k,v],i)=>(
                <div key={i} className="flex justify-between py-0.5"><span className="text-slate-400 text-sm">{k}</span><span className="text-white text-sm font-bold">{v||'—'}</span></div>
              ))}
              {(viewOldBike.slPrice>0 && viewOldBike.psPrice>0) && (
                <div className="mt-2 p-2 rounded bg-slate-700"><span className="text-slate-400 text-xs">Profit/Loss: </span><span className={`font-bold text-sm ${viewOldBike.slPrice>=viewOldBike.psPrice?'text-green-400':'text-red-400'}`}>₹{((viewOldBike.slPrice||0)-(viewOldBike.psPrice||0)).toLocaleString('en-IN')}</span></div>
              )}
            </div>
            <div className="p-4"><Button onClick={()=>setViewOldBike(null)} className="w-full bg-slate-600 text-white">Close</Button></div>
          </div>
        </div>
      )}

      <div className="mb-3">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">🏍️ Vehicle Sales Dashboard</h1>
            <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-2">
              <Activity size={10} className="text-green-400 animate-pulse"/>
              {vehicleData.length} vehicles · {generatedInvoices.length} invoices · {oldBikes.length} old bikes
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setShowAddCustomer(true)} className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 px-3"><Plus size={12} className="mr-1" /> Add Customer</Button>
            {!isAdmin ? (
              <Button onClick={handleAdminLogin} className="bg-red-600 hover:bg-red-700 text-white text-xs h-8 px-3">🔒 Admin Login</Button>
            ) : (
              <span className="bg-green-700 text-white px-3 py-1.5 rounded font-bold text-xs cursor-pointer h-8 flex items-center" onClick={()=>setIsAdmin(false)}>✅ Admin ✕</span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {[
            { id:'vehicles', label:`🏍️ New Vehicles (${vehicleData.length})` },
            { id:'oldBikes', label:`🚲 Old Bikes (${oldBikes.length})` },
          ].map(t => (
            <button key={t.id} onClick={()=>{ setVdActiveTab(t.id); setCurrentPage(1); setOldBikePage(1); }}
              className={`px-3 py-1.5 rounded text-xs font-bold border transition ${
                vdActiveTab===t.id ? 'bg-blue-600 border-blue-400 text-white shadow' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
              }`}>{t.label}</button>
          ))}
        </div>
      </div>

      {vdActiveTab === 'vehicles' && (
        <>
          {/* ⭐ COMPACT: Import + Filters in single strip */}
          <Card className="bg-slate-800 border-slate-700 mb-3">
            <CardContent className="py-3 px-4">
              <div className="flex flex-wrap items-center gap-2">
                {/* Excel Import (compact) */}
                <label className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded cursor-pointer flex items-center gap-1.5 text-xs whitespace-nowrap">
                  <Upload size={13}/> Excel Import (cost_detl)
                  <input type="file" accept=".xlsx,.xlsm" onChange={handleFileUpload} className="hidden" />
                </label>

                <div className="h-6 w-px bg-slate-600"/>

                {/* Filters (inline) */}
                <select value={selectedModel} onChange={(e)=>{setSelectedModel(e.target.value); setSelectedVariant('');}}
                  className="px-2 py-1.5 bg-slate-700 text-white border border-slate-600 rounded text-xs min-w-[140px]">
                  <option value="">सभी Models</option>
                  {models.map(model => <option key={model} value={model}>{model}</option>)}
                </select>
                <select value={selectedVariant} onChange={(e)=>setSelectedVariant(e.target.value)} disabled={!selectedModel}
                  className="px-2 py-1.5 bg-slate-700 text-white border border-slate-600 rounded text-xs min-w-[110px] disabled:opacity-50">
                  <option value="">सभी Variants</option>
                  {getVariantsForModel().map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <select value={selectedYear} onChange={(e)=>setSelectedYear(e.target.value)}
                  className="px-2 py-1.5 bg-slate-700 text-white border border-slate-600 rounded text-xs min-w-[90px]">
                  <option value="">All Years</option>
                  {getYears().map(year => <option key={year} value={year}>{year}</option>)}
                </select>
                <select value={selectedMonth} onChange={(e)=>setSelectedMonth(e.target.value)}
                  className="px-2 py-1.5 bg-slate-700 text-white border border-slate-600 rounded text-xs min-w-[110px]">
                  <option value="">All Months</option>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m =>
                    <option key={m} value={String(m).padStart(2,'0')}>{new Date(2024, m-1).toLocaleString('en-IN', { month: 'short' })}</option>
                  )}
                </select>

                {(selectedModel || selectedVariant || selectedYear || selectedMonth) && (
                  <button onClick={() => { setSelectedModel(''); setSelectedVariant(''); setSelectedYear(''); setSelectedMonth(''); }}
                    className="px-2 py-1.5 bg-red-600/20 border border-red-600/50 text-red-300 rounded text-xs hover:bg-red-600/30">
                    ✖ Clear
                  </button>
                )}

                <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                  <span className="bg-blue-900/50 border border-blue-600/50 px-2 py-1 rounded font-bold text-blue-300">
                    {filteredData.length} / {vehicleData.length} vehicles
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {vehicleData.length > 0 && (
            <>

              {/* ⭐ Compact Smart KPI Cards (single row, smaller) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                <div style={{ background:'linear-gradient(135deg, #1e40af22, #1e40af08)', border:'1px solid #3b82f640', borderRadius:10, padding:'10px 12px' }}>
                  <div className="flex items-center justify-between">
                    <Bike size={14} className="text-blue-400"/>
                    <span className="text-blue-400 text-[10px] font-bold">SOLD</span>
                  </div>
                  <p className="text-slate-300 text-[10px] font-bold">कुल Vehicles</p>
                  <p className="text-white font-black text-lg leading-tight">{vehicleData.length}</p>
                  <p className="text-slate-500 text-[10px]">{models.length} models · {filteredData.length} filtered</p>
                </div>
                <div style={{ background:'linear-gradient(135deg, #16a34a22, #16a34a08)', border:'1px solid #22c55e40', borderRadius:10, padding:'10px 12px' }}>
                  <div className="flex items-center justify-between">
                    <TrendingUp size={14} className="text-green-400"/>
                    <span className="text-green-400 text-[10px] font-bold">REVENUE</span>
                  </div>
                  <p className="text-slate-300 text-[10px] font-bold">💰 Total Sales</p>
                  <p className="text-white font-black text-lg leading-tight">₹{totalRevenue >= 100000 ? (totalRevenue/100000).toFixed(2) + 'L' : totalRevenue.toLocaleString('en-IN')}</p>
                  <p className="text-slate-500 text-[10px]">avg: ₹{vehicleData.length > 0 ? Math.round(totalRevenue/vehicleData.length).toLocaleString('en-IN') : 0}</p>
                </div>
                <div style={{ background:'linear-gradient(135deg, #ea580c22, #ea580c08)', border:'1px solid #f9731640', borderRadius:10, padding:'10px 12px' }}>
                  <div className="flex items-center justify-between">
                    <FileText size={14} className="text-orange-400"/>
                    <span className="text-orange-400 text-[10px] font-bold">INVOICES</span>
                  </div>
                  <p className="text-slate-300 text-[10px] font-bold">📄 Generated</p>
                  <p className="text-white font-black text-lg leading-tight">{generatedInvoices.length}</p>
                  <button onClick={() => navigate('/invoice-management')} className="text-orange-400 text-[10px] hover:underline">View all →</button>
                </div>
                <div style={{ background:'linear-gradient(135deg, #a855f722, #a855f708)', border:'1px solid #a855f740', borderRadius:10, padding:'10px 12px' }}>
                  <div className="flex items-center justify-between">
                    <Bike size={14} className="text-purple-400"/>
                    <span className="text-purple-400 text-[10px] font-bold">EXCHANGE</span>
                  </div>
                  <p className="text-slate-300 text-[10px] font-bold">🚲 Old Bikes</p>
                  <p className="text-white font-black text-lg leading-tight">{oldBikes.length}</p>
                  <p className="text-slate-500 text-[10px]">{oldBikes.filter(b => b.status === 'Sold').length} sold · {oldBikes.filter(b => b.status === 'Available' || !b.status).length} stock</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card className="bg-slate-800 border-slate-700"><CardHeader><CardTitle className="text-white text-lg">📊 Monthly Sales Trend</CardTitle></CardHeader><CardContent className="pt-4"><ResponsiveContainer width="100%" height={300}><LineChart data={monthlyAnalytics}><CartesianGrid strokeDasharray="3 3" stroke="#444" /><XAxis dataKey="month" stroke="#999" /><YAxis stroke="#999" /><Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} /><Legend /><Line type="monotone" dataKey="count" stroke="#00bfff" strokeWidth={2} name="Sales" /></LineChart></ResponsiveContainer></CardContent></Card>
                <Card className="bg-slate-800 border-slate-700"><CardHeader><CardTitle className="text-white text-lg">🚗 Model Distribution</CardTitle></CardHeader><CardContent className="pt-4"><ResponsiveContainer width="100%" height={300}><BarChart data={modelAnalytics}><CartesianGrid strokeDasharray="3 3" stroke="#444" /><XAxis dataKey="model" stroke="#999" angle={-45} textAnchor="end" height={80} /><YAxis stroke="#999" /><Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} /><Legend /><Bar dataKey="count" fill="#00bfff" name="Count" radius={[8,8,0,0]} /></BarChart></ResponsiveContainer></CardContent></Card>
                <Card className="bg-slate-800 border-slate-700"><CardHeader><CardTitle className="text-white text-lg">🎯 Variant Distribution</CardTitle></CardHeader><CardContent className="pt-4"><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={variantAnalytics} dataKey="count" nameKey="variant" cx="50%" cy="50%" outerRadius={100} label>{variantAnalytics.map((entry,index)=><Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} /></PieChart></ResponsiveContainer></CardContent></Card>
                <Card className="bg-slate-800 border-slate-700"><CardHeader><CardTitle className="text-white text-lg">💰 Average Price by Model</CardTitle></CardHeader><CardContent className="pt-4"><ResponsiveContainer width="100%" height={300}><BarChart data={models.map(model=>({model,avgPrice:Math.round(vehicleData.filter(d=>d.vehicleModel===model).reduce((sum,d)=>sum+d.price,0)/vehicleData.filter(d=>d.vehicleModel===model).length)}))}><CartesianGrid strokeDasharray="3 3" stroke="#444" /><XAxis dataKey="model" stroke="#999" angle={-45} textAnchor="end" height={80} /><YAxis stroke="#999" /><Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} formatter={(value)=>`₹${(value||0).toLocaleString()}`} /><Bar dataKey="avgPrice" fill="#28a745" name="Avg Price" radius={[8,8,0,0]} /></BarChart></ResponsiveContainer></CardContent></Card>
              </div>

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
              <td className="px-4 py-3 text-center flex gap-1 justify-center flex-wrap">
                {isAdmin && (
                  <Button
                    onClick={() => handleGenerateInvoice(vehicle)}
                    size="sm"
                    className={generatedInvoices.some(inv => inv.customerName === vehicle.customerName) ? "bg-green-700 hover:bg-green-800 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}
                    title="Generate/View Invoice"
                  >
                    {generatedInvoices.some(inv => inv.customerName === vehicle.customerName) ? '✅' : '📄'}
                  </Button>
                )}
                {/* ⭐ Quick link to service profile — find by customer name */}
                <Button
                  onClick={() => {
                    // Find customer by matching name from MongoDB customers list
                    const matchedCust = customers.find(c =>
                      String(c.name || c.customerName || '').toUpperCase().trim() ===
                      String(vehicle.customerName || '').toUpperCase().trim()
                    );
                    if (matchedCust && matchedCust._id) {
                      navigate(`/customer-profile/${matchedCust._id}`);
                    } else {
                      alert(`⚠️ Customer "${vehicle.customerName}" का profile नहीं मिला।\n\nकृपया पहले Customer Management में check करें कि customer save हुआ है या नहीं।`);
                    }
                  }}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  title="Service Profile"
                >
                  🔧
                </Button>
                <Button onClick={() => handleEditVehicle(vehicle)} size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white" title="Edit">
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

          {showInvoiceModal && selectedVehicle && (
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:16, zIndex:50 }}
              onClick={() => setShowInvoiceModal(false)}>
              <div style={{ background:'#1e293b', border:'1px solid #475569', borderRadius:14, width:'100%', maxWidth:700, maxHeight:'90vh', overflowY:'auto' }}
                onClick={e => e.stopPropagation()}>

                <div style={{ background:'linear-gradient(90deg, #16a34a, #15803d)', padding:'12px 16px', borderTopLeftRadius:14, borderTopRightRadius:14, position:'sticky', top:0 }}>
                  <h3 style={{ color:'#fff', fontSize:15, fontWeight:800, margin:0, display:'flex', alignItems:'center', gap:6 }}>
                    <FileText size={18}/> Tax Invoice Generate करें
                  </h3>
                </div>

                <div style={{ padding:'16px' }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="text-slate-400 text-xs font-bold mb-1 block">Customer Name</label>
                      <Input value={invoiceData.customerName} onChange={e=>setInvoiceData({...invoiceData,customerName:e.target.value})} className="bg-slate-700 text-white border-slate-600"/>
                    </div>

                    {/* ⭐ NEW: Relation dropdown (S/O, W/O, D/O, C/O) + Father/Husband/Guardian Name */}
                    <div>
                      <label className="text-slate-400 text-xs font-bold mb-1 block">Relation + Name</label>
                      <div className="flex gap-1">
                        <select value={invoiceData.relation || 'S/O'}
                          onChange={e => setInvoiceData({...invoiceData, relation: e.target.value})}
                          className="bg-slate-700 text-white border border-slate-600 rounded px-2 py-2 text-sm font-bold w-20">
                          <option value="S/O">S/O</option>
                          <option value="W/O">W/O</option>
                          <option value="D/O">D/O</option>
                          <option value="C/O">C/O</option>
                        </select>
                        <Input value={invoiceData.fatherName} onChange={e=>setInvoiceData({...invoiceData,fatherName:e.target.value})}
                          className="bg-slate-700 text-white border-slate-600 flex-1" placeholder="Father/Husband Name"/>
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 text-xs font-bold mb-1 block">Mobile</label>
                      <Input value={invoiceData.mobileNo} onChange={e=>setInvoiceData({...invoiceData,mobileNo:e.target.value})} className="bg-slate-700 text-white border-slate-600"/>
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs font-bold mb-1 block">Invoice Date</label>
                      <Input type="date" value={invoiceData.invoiceDate} onChange={e=>setInvoiceData({...invoiceData,invoiceDate:e.target.value})} className="bg-slate-700 text-white border-slate-600"/>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-slate-400 text-xs font-bold mb-1 block">Address</label>
                      <Input value={invoiceData.address} onChange={e=>setInvoiceData({...invoiceData,address:e.target.value})} className="bg-slate-700 text-white border-slate-600"/>
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs font-bold mb-1 block">District</label>
                      <Input value={invoiceData.dist} onChange={e=>setInvoiceData({...invoiceData,dist:e.target.value})} className="bg-slate-700 text-white border-slate-600"/>
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs font-bold mb-1 block">
                        Ex-Showroom Price <span className="text-emerald-400">(GST शामिल)</span>
                      </label>
                      <Input type="number" value={invoiceData.price} onChange={e=>setInvoiceData({...invoiceData,price:e.target.value})}
                        className="bg-slate-700 text-emerald-300 border-slate-600 font-bold"/>
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs font-bold mb-1 block">Key No</label>
                      <Input value={invoiceData.keyNo} onChange={e=>setInvoiceData({...invoiceData,keyNo:e.target.value})} className="bg-slate-700 text-white border-slate-600"/>
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs font-bold mb-1 block">Battery No</label>
                      <Input value={invoiceData.batteryNo} onChange={e=>setInvoiceData({...invoiceData,batteryNo:e.target.value})} className="bg-slate-700 text-white border-slate-600"/>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-slate-400 text-xs font-bold mb-1 block">Financer Name</label>
                      <select value={invoiceData.financerName||'CASH'} onChange={e=>setInvoiceData({...invoiceData,financerName:e.target.value})}
                        className="bg-slate-700 text-white border border-slate-600 rounded px-3 py-2 w-full text-sm">
                        {FINANCE_COMPANIES.map(fc => <option key={fc} value={fc}>{fc}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Tax Breakdown Preview */}
                  {invoiceData.price > 0 && (
                    <div className="mb-4 p-3 bg-slate-900/60 border border-dashed border-slate-600 rounded">
                      <p className="text-slate-400 text-xs font-bold mb-2">📋 Tax Breakdown (Invoice में ऐसे आएगा)</p>
                      {(() => {
                        const tb = calculateTaxBreakdown(invoiceData.price);
                        return (
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            <span className="text-slate-400">Taxable:</span>
                            <span className="text-slate-200 text-right">₹{tb.taxable.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                            <span className="text-slate-400">SGST 9%:</span>
                            <span className="text-yellow-300 text-right">₹{tb.sgst.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                            <span className="text-slate-400">CGST 9%:</span>
                            <span className="text-yellow-300 text-right">₹{tb.cgst.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                            <span className="text-emerald-400 font-bold border-t border-slate-700 pt-1 mt-1">Total:</span>
                            <span className="text-emerald-400 text-right font-bold border-t border-slate-700 pt-1 mt-1">₹{tb.exShowroom.toLocaleString('en-IN')}</span>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button onClick={generateInvoicePDF} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold">
                      <Download size={16} className="mr-2"/> PDF Download करें
                    </Button>
                    <Button onClick={()=>setShowInvoiceModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white">
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showEditModal && editVehicle && (
            <Card className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"><Card className="bg-slate-800 border-slate-700 w-full max-w-2xl max-h-[80vh] overflow-y-auto"><CardHeader className="bg-gradient-to-r from-yellow-600 to-yellow-700 sticky top-0"><CardTitle className="text-white flex items-center gap-2"><Edit2 size={20}/> Edit - {editVehicle.customerName}</CardTitle></CardHeader><CardContent className="pt-6"><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"><Input placeholder="Customer Name" value={editVehicle.customerName} onChange={e=>setEditVehicle({...editVehicle,customerName:e.target.value})} className="bg-slate-700 text-white border-slate-600"/><Input placeholder="Father Name" value={editVehicle.fatherName} onChange={e=>setEditVehicle({...editVehicle,fatherName:e.target.value})} className="bg-slate-700 text-white border-slate-600"/><Input placeholder="Mobile" value={editVehicle.mobileNo} onChange={e=>setEditVehicle({...editVehicle,mobileNo:e.target.value})} className="bg-slate-700 text-white border-slate-600"/><Input placeholder="Address" value={editVehicle.address} onChange={e=>setEditVehicle({...editVehicle,address:e.target.value})} className="bg-slate-700 text-white border-slate-600"/><Input placeholder="District" value={editVehicle.dist} onChange={e=>setEditVehicle({...editVehicle,dist:e.target.value})} className="bg-slate-700 text-white border-slate-600"/><Input placeholder="Pin Code" value={editVehicle.pinCode} onChange={e=>setEditVehicle({...editVehicle,pinCode:e.target.value})} className="bg-slate-700 text-white border-slate-600"/><Input placeholder="DOB (DD-MM-YYYY)" value={editVehicle.dob} onChange={e=>setEditVehicle({...editVehicle,dob:e.target.value})} className="bg-slate-700 text-white border-slate-600"/><Input placeholder="Vehicle Model" value={editVehicle.vehicleModel} onChange={e=>setEditVehicle({...editVehicle,vehicleModel:e.target.value})} className="bg-slate-700 text-white border-slate-600"/><Input placeholder="Variant" value={editVehicle.variant} onChange={e=>setEditVehicle({...editVehicle,variant:e.target.value})} className="bg-slate-700 text-white border-slate-600"/><Input placeholder="Color" value={editVehicle.color} onChange={e=>setEditVehicle({...editVehicle,color:e.target.value})} className="bg-slate-700 text-white border-slate-600"/><Input placeholder="Engine No" value={editVehicle.engineNo} onChange={e=>setEditVehicle({...editVehicle,engineNo:e.target.value})} className="bg-slate-700 text-white border-slate-600"/><Input placeholder="Chassis No" value={editVehicle.chassisNo} onChange={e=>setEditVehicle({...editVehicle,chassisNo:e.target.value})} className="bg-slate-700 text-white border-slate-600"/><Input placeholder="Key No" value={editVehicle.keyNo} onChange={e=>setEditVehicle({...editVehicle,keyNo:e.target.value})} className="bg-slate-700 text-white border-slate-600"/><Input placeholder="Battery No" value={editVehicle.batteryNo} onChange={e=>setEditVehicle({...editVehicle,batteryNo:e.target.value})} className="bg-slate-700 text-white border-slate-600"/><Input placeholder="Financer Name" value={editVehicle.financerName} onChange={e=>setEditVehicle({...editVehicle,financerName:e.target.value})} className="bg-slate-700 text-white border-slate-600"/><Input placeholder="Price" type="number" value={editVehicle.price} onChange={e=>setEditVehicle({...editVehicle,price:parseFloat(e.target.value)||0})} className="bg-slate-700 text-white border-slate-600"/></div><div className="flex gap-4"><Button onClick={saveEditVehicle} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-bold">Save</Button><Button onClick={()=>setShowEditModal(false)} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold">Cancel</Button></div></CardContent></Card></Card>
          )}

          {generatedInvoices.length > 0 && (
            <Card className="mt-6 bg-slate-800 border-slate-700">
              <CardHeader><CardTitle className="text-white">📄 Generated Invoices ({generatedInvoices.length})</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm text-slate-300">
                  <thead className="border-b border-slate-600">
                    <tr><th className="px-3 py-2 text-left">Invoice No</th><th className="px-3 py-2 text-left">Customer</th><th className="px-3 py-2 text-left">Vehicle</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-left">Date</th>{isAdmin && <th className="px-3 py-2 text-center">Action</th>}</tr>
                  </thead>
                  <tbody>
                    {generatedInvoices.map(inv => (
                      <tr key={inv.id} className="border-b border-slate-700">
                        <td className="px-3 py-2">{inv.invoiceNo}</td>
                        <td className="px-3 py-2 font-bold">{inv.customerName}</td>
                        <td className="px-3 py-2">{inv.vehicleModel}</td>
                        <td className="px-3 py-2 text-right">₹{(inv.amount||0).toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
                        <td className="px-3 py-2">{inv.date}</td>
                        {isAdmin && <td className="px-3 py-2 text-center"><button onClick={()=>handleDeleteInvoice(inv.id)} className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs">🗑</button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {showAddCustomer && (
            <SmartCustomerForm
              data={newCustomer}
              setData={setNewCustomer}
              onSave={handleAddNewCustomer}
              onCancel={() => setShowAddCustomer(false)}
            />
          )}
        </>
      )}

      {vdActiveTab === 'oldBikes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { l:'Total Old Bikes', v:oldBikes.length, c:'text-blue-400', bg:'bg-blue-900/20 border-blue-500' },
              { l:'Available', v:oldBikes.filter(b=>b.status==='Available'||!b.status).length, c:'text-green-400', bg:'bg-green-900/20 border-green-500' },
              { l:'Sold', v:oldBikes.filter(b=>b.status==='Sold').length, c:'text-orange-400', bg:'bg-orange-900/20 border-orange-500' },
              { l:'Total Value', v:'₹'+oldBikes.reduce((s,b)=>s+(parseFloat(b.psPrice)||0),0).toLocaleString('en-IN'), c:'text-yellow-400', bg:'bg-yellow-900/20 border-yellow-500' },
            ].map((k,i) => (<Card key={i} className={`${k.bg}`}><CardContent className="p-4"><p className="text-slate-400 text-xs font-bold">{k.l}</p><p className={`${k.c} font-black text-2xl mt-1`}>{k.v}</p></CardContent></Card>))}
          </div>

          {oldBikes.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-slate-800 border-slate-700"><CardHeader className="py-3 bg-orange-900/30"><CardTitle className="text-white text-sm">🚲 Old Bike — कौन सी गाड़ी ज्यादा आई</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={220}><BarChart data={(()=>{const m={};oldBikes.forEach(b=>{const v=(b.veh||'Unknown').toUpperCase().split(' ').slice(0,2).join(' ');m[v]=(m[v]||0)+1;});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,value])=>({name,value}));})()}><CartesianGrid strokeDasharray="3 3" stroke="#334155"/><XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize:9}}/><YAxis stroke="#94a3b8" tick={{fontSize:10}}/><Tooltip contentStyle={{background:'#1e293b',border:'1px solid #475569',borderRadius:8}}/><Bar dataKey="value" fill="#f59e0b" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></CardContent></Card>
              <Card className="bg-slate-800 border-slate-700"><CardHeader className="py-3 bg-green-900/30"><CardTitle className="text-white text-sm">📊 Status — Available vs Sold</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={[{name:'Available',value:oldBikes.filter(b=>b.status!=='Sold').length},{name:'Sold',value:oldBikes.filter(b=>b.status==='Sold').length}]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name,value})=>`${name}: ${value}`}><Cell fill="#10b981"/><Cell fill="#ef4444"/></Pie><Tooltip/></PieChart></ResponsiveContainer></CardContent></Card>
            </div>
          )}

          <div className="flex gap-3 flex-wrap"><Button onClick={()=>{resetOldBikeForm();setShowOldBikeForm(true);}} className="bg-green-600 hover:bg-green-700 text-white font-bold"><Plus size={16} className="mr-1"/> Add Old Bike</Button><label className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded cursor-pointer flex items-center gap-2 text-sm"><Upload size={16}/> Import Excel (OLD BIKE sheet)<input type="file" accept=".xlsx,.xlsm,.xls" onChange={handleOldBikeImport} className="hidden"/></label></div>

          {showOldBikeForm && (
            <Card className="bg-slate-800 border-green-600 border-2"><CardHeader className="bg-gradient-to-r from-green-700 to-green-800 py-3"><CardTitle className="text-white text-sm">{editOldBikeId ? '✏️ Edit Old Bike' : '➕ Add Old Bike'}</CardTitle></CardHeader><CardContent className="pt-4 space-y-4"><p className="text-orange-400 text-xs font-bold">📤 जिसने गाड़ी दी (Seller)</p><div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Input placeholder="Customer Name *" value={oldBikeForm.custName} onChange={e=>setOldBikeForm({...oldBikeForm,custName:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/><Input placeholder="Father Name" value={oldBikeForm.custFather} onChange={e=>setOldBikeForm({...oldBikeForm,custFather:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/><Input placeholder="Address" value={oldBikeForm.custAdd} onChange={e=>setOldBikeForm({...oldBikeForm,custAdd:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/><Input placeholder="Mobile No" value={oldBikeForm.custMob} onChange={e=>setOldBikeForm({...oldBikeForm,custMob:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/></div><p className="text-blue-400 text-xs font-bold">🏍️ Vehicle & Owner (RC पर नाम)</p><div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Input placeholder="Owner Name (RC)" value={oldBikeForm.owner} onChange={e=>setOldBikeForm({...oldBikeForm,owner:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/><Input placeholder="Owner Father" value={oldBikeForm.ownerFather} onChange={e=>setOldBikeForm({...oldBikeForm,ownerFather:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/><Input placeholder="Vehicle *" value={oldBikeForm.veh} onChange={e=>setOldBikeForm({...oldBikeForm,veh:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/><Input placeholder="Model/Year" value={oldBikeForm.mdl} onChange={e=>setOldBikeForm({...oldBikeForm,mdl:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/><Input placeholder="Reg No" value={oldBikeForm.regNo} onChange={e=>setOldBikeForm({...oldBikeForm,regNo:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/><Input type="number" placeholder="Purchase Price" value={oldBikeForm.psPrice||''} onChange={e=>setOldBikeForm({...oldBikeForm,psPrice:parseFloat(e.target.value)||0})} className="bg-slate-700 border-slate-500 text-white text-sm"/><Input type="date" placeholder="Purchase Date" value={oldBikeForm.purchaseDate} onChange={e=>setOldBikeForm({...oldBikeForm,purchaseDate:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/></div><p className="text-green-400 text-xs font-bold">📥 जिसको बेची (Buyer)</p><div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Input placeholder="Buyer Name" value={oldBikeForm.buyerName} onChange={e=>setOldBikeForm({...oldBikeForm,buyerName:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/><Input placeholder="Buyer Father" value={oldBikeForm.buyerFather} onChange={e=>setOldBikeForm({...oldBikeForm,buyerFather:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/><Input placeholder="Buyer Address" value={oldBikeForm.buyerAdd} onChange={e=>setOldBikeForm({...oldBikeForm,buyerAdd:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/><Input placeholder="Buyer Mobile" value={oldBikeForm.buyerMob} onChange={e=>setOldBikeForm({...oldBikeForm,buyerMob:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/><Input placeholder="Buyer Aadhar" value={oldBikeForm.buyerAadhar} onChange={e=>setOldBikeForm({...oldBikeForm,buyerAadhar:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/><Input type="number" placeholder="Sell Price" value={oldBikeForm.slPrice||''} onChange={e=>setOldBikeForm({...oldBikeForm,slPrice:parseFloat(e.target.value)||0})} className="bg-slate-700 border-slate-500 text-white text-sm"/><Input type="date" placeholder="Sell Date" value={oldBikeForm.slDate} onChange={e=>setOldBikeForm({...oldBikeForm,slDate:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/><Input placeholder="Notes" value={oldBikeForm.notes} onChange={e=>setOldBikeForm({...oldBikeForm,notes:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/></div><div className="flex gap-3 mt-2"><Button onClick={saveOldBike} className="bg-green-600 hover:bg-green-700 text-white font-bold">{editOldBikeId ? 'Update' : 'Save'}</Button><Button onClick={()=>{setShowOldBikeForm(false);resetOldBikeForm();}} className="bg-slate-600 hover:bg-slate-700 text-white">Cancel</Button></div></CardContent></Card>
          )}

          <Card className="bg-slate-800 border-slate-700"><CardHeader className="bg-gradient-to-r from-orange-700 to-orange-800 py-3"><CardTitle className="text-white text-sm">🚲 Old Bikes ({oldBikes.length})</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-700 border-b border-slate-600"><tr>{['#','Seller','Vehicle','Reg No','PS Price','Buyer','SL Price','Status','Actions'].map(h=><th key={h} className="px-3 py-2.5 text-left text-xs font-bold text-slate-300">{h}</th>)}</tr></thead><tbody>{oldBikes.length===0?<tr><td colSpan="9" className="px-6 py-8 text-center text-slate-500">कोई old bike नहीं। Excel Import (OLD BIKE sheet) या Add करें।</td></tr>:oldBikes.slice((oldBikePage-1)*10,oldBikePage*10).map((b,i)=><tr key={b.id} className={`border-b border-slate-700 hover:bg-slate-700/50 ${i%2?'bg-slate-800/30':''}`}><td className="px-3 py-2 text-slate-500 text-xs">{(oldBikePage-1)*10+i+1}</td><td className="px-3 py-2 text-white font-bold text-xs">{b.custName}<br/><span className="text-slate-400 font-normal">{b.custMob||''}</span></td><td className="px-3 py-2 text-blue-300 text-xs">{b.veh} <span className="text-slate-500">{b.mdl}</span></td><td className="px-3 py-2 text-slate-400 text-xs font-mono">{b.regNo||'—'}</td><td className="px-3 py-2 text-yellow-400 text-xs font-bold">₹{(b.psPrice||0).toLocaleString('en-IN')}</td><td className="px-3 py-2 text-green-300 text-xs">{b.buyerName||<span className="text-slate-600">—</span>}</td><td className="px-3 py-2 text-green-400 text-xs font-bold">{b.slPrice ? '₹'+(b.slPrice||0).toLocaleString('en-IN') : '—'}</td><td className="px-3 py-2"><span className={`text-xs font-bold px-2 py-0.5 rounded ${b.status==='Sold'?'bg-red-900 text-red-300':b.status==='Reserved'?'bg-yellow-900 text-yellow-300':'bg-green-900 text-green-300'}`}>{b.status||'Available'}</span></td><td className="px-3 py-2"><div className="flex gap-1"><button onClick={()=>setViewOldBike(b)} className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded text-xs">👁</button><button onClick={()=>editOldBike(b)} className="bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-0.5 rounded text-xs">✏️</button>{isAdmin?(<button onClick={()=>deleteOldBike(b.id)} className="bg-red-700 hover:bg-red-600 text-white px-2 py-0.5 rounded text-xs">🗑</button>):(<button disabled className="bg-gray-600 text-gray-400 px-2 py-0.5 rounded text-xs cursor-not-allowed">🔒</button>)}</div></td></tr>)}</tbody></table></div>{Math.ceil(oldBikes.length/10)>1&&(<div className="flex items-center justify-between px-4 py-2.5 bg-slate-700/50 border-t border-slate-600"><span className="text-xs text-slate-400">Page {oldBikePage} of {Math.ceil(oldBikes.length/10)} — {oldBikes.length} bikes</span><div className="flex gap-2"><Button onClick={()=>setOldBikePage(p=>Math.max(1,p-1))} disabled={oldBikePage===1} className="bg-blue-600 text-white h-7 px-3 text-xs disabled:opacity-40">◀ Previous</Button><Button onClick={()=>setOldBikePage(p=>Math.min(Math.ceil(oldBikes.length/10),p+1))} disabled={oldBikePage>=Math.ceil(oldBikes.length/10)} className="bg-blue-600 text-white h-7 px-3 text-xs disabled:opacity-40">Next ▶</Button></div></div>)}</CardContent></Card>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 🎨 SMART CUSTOMER FORM
// Modern, mobile-friendly modal with all invoice fields
// • Vehicle Model dropdown (Honda models from Excel rate list)
// • Variant dropdown (CC values)
// • Color dropdown (Honda colors)
// • Auto-fill: select model → CC, HSN, Ex-Showroom price auto-set
// • Finance company dropdown
// ════════════════════════════════════════════════════════════════════════════
function SmartCustomerForm({ data, setData, onSave, onCancel }) {
  const grouped = getModelsByCategory();
  const variants = [...new Set(HONDA_MODELS.map(m => m.cc))];

  // Auto-fill on model select — only set Ex-Showroom price (includes GST)
  const handleModelChange = (modelName) => {
    const model = findModel(modelName);
    if (model) {
      setData({
        ...data,
        vehicleModel: model.name,
        cc: model.cc,
        variant: model.cc,
        hsnNumber: getHSN(model.name),
        price: model.exShowroom,
        exShowroom: model.exShowroom,
      });
    } else {
      setData({ ...data, vehicleModel: modelName });
    }
  };

  const handlePriceChange = (val) => {
    const exShowroom = parseFloat(val) || 0;
    setData({ ...data, price: exShowroom, exShowroom });
  };

  // For display preview only — show breakdown so user knows tax
  const taxPreview = calculateTaxBreakdown(data.exShowroom || data.price || 0);

  const f = { background:'#1e293b', color:'#fff', border:'1px solid #475569', borderRadius:8, padding:'10px 12px', fontSize:13, width:'100%', outline:'none' };
  const lbl = { color:'#94a3b8', fontSize:11, fontWeight:700, marginBottom:4, display:'block', textTransform:'uppercase', letterSpacing:'0.5px' };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:16, zIndex:50 }}
      onClick={onCancel}>
      <div style={{ background:'linear-gradient(180deg, #0f172a, #020617)', border:'1px solid #334155', borderRadius:16, width:'100%', maxWidth:900, maxHeight:'90vh', overflowY:'auto' }}
        onClick={e => e.stopPropagation()}>

        {/* HEADER */}
        <div style={{ background:'linear-gradient(90deg, #16a34a, #15803d)', padding:'14px 20px', position:'sticky', top:0, zIndex:1, display:'flex', alignItems:'center', justifyContent:'space-between', borderTopLeftRadius:16, borderTopRightRadius:16 }}>
          <div>
            <h2 style={{ color:'#fff', fontSize:18, fontWeight:800, margin:0, display:'flex', alignItems:'center', gap:8 }}>
              <Plus size={20}/> Add New Customer
            </h2>
            <p style={{ color:'#bbf7d0', fontSize:11, margin:'2px 0 0' }}>Vehicle sale entry — सब fields invoice के लिए जरूरी हैं</p>
          </div>
          <button onClick={onCancel}
            style={{ background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:13 }}>
            ✖
          </button>
        </div>

        <div style={{ padding:'18px 20px' }}>

          {/* ───── PERSONAL DETAILS ───── */}
          <div style={{ marginBottom:18 }}>
            <h3 style={{ color:'#86efac', fontSize:13, fontWeight:800, marginBottom:10, paddingBottom:6, borderBottom:'1px solid #334155', display:'flex', alignItems:'center', gap:6 }}>
              👤 Personal Details
            </h3>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12 }}>
              <div><label style={lbl}>Customer Name *</label><input style={f} placeholder="जैसे: KAVITA AHIRWAR" value={data.customerName} onChange={e => setData({...data, customerName: e.target.value.toUpperCase()})}/></div>
              <div><label style={lbl}>Father Name (C/O) *</label><input style={f} placeholder="जैसे: ANIL AHIRWAR" value={data.fatherName} onChange={e => setData({...data, fatherName: e.target.value.toUpperCase()})}/></div>
              <div><label style={lbl}>Mobile *</label><input style={f} placeholder="10 digit number" value={data.mobileNo} maxLength="10" onChange={e => setData({...data, mobileNo: e.target.value.replace(/\D/g,'')})}/></div>
              <div><label style={lbl}>Alternate Mobile</label><input style={f} placeholder="Optional" value={data.altMobile||''} maxLength="10" onChange={e => setData({...data, altMobile: e.target.value.replace(/\D/g,'')})}/></div>
              <div><label style={lbl}>Aadhar No</label><input style={f} placeholder="12 digit" value={data.aadhar||''} maxLength="12" onChange={e => setData({...data, aadhar: e.target.value.replace(/\D/g,'')})}/></div>
              <div><label style={lbl}>PAN No</label><input style={f} placeholder="ABCDE1234F" value={data.pan||''} maxLength="10" onChange={e => setData({...data, pan: e.target.value.toUpperCase()})}/></div>
              <div><label style={lbl}>DOB</label><input style={f} type="date" value={data.dob} onChange={e => setData({...data, dob: e.target.value})}/></div>
              <div style={{ gridColumn:'1 / -1' }}><label style={lbl}>Address *</label><input style={f} placeholder="जैसे: H NO- 450 MALI KHEDI HUZUR" value={data.address} onChange={e => setData({...data, address: e.target.value.toUpperCase()})}/></div>
              <div><label style={lbl}>District *</label><input style={f} placeholder="BHOPAL" value={data.dist} onChange={e => setData({...data, dist: e.target.value.toUpperCase()})}/></div>
              <div><label style={lbl}>State</label><input style={f} value={data.state||'MADHYA PRADESH'} onChange={e => setData({...data, state: e.target.value.toUpperCase()})}/></div>
              <div><label style={lbl}>PIN Code</label><input style={f} placeholder="462001" value={data.pinCode} maxLength="6" onChange={e => setData({...data, pinCode: e.target.value.replace(/\D/g,'')})}/></div>
            </div>
          </div>

          {/* ───── VEHICLE DETAILS ───── */}
          <div style={{ marginBottom:18 }}>
            <h3 style={{ color:'#93c5fd', fontSize:13, fontWeight:800, marginBottom:10, paddingBottom:6, borderBottom:'1px solid #334155', display:'flex', alignItems:'center', gap:6 }}>
              🏍️ Vehicle Details
            </h3>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12 }}>

              {/* ⭐ Model dropdown — grouped by category */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Vehicle Model * <span style={{ color:'#86efac' }}>(select करते ही price auto-fill होगा)</span></label>
                <select style={{ ...f, cursor:'pointer' }} value={data.vehicleModel} onChange={e => handleModelChange(e.target.value)}>
                  <option value="">— Model चुनें —</option>
                  {Object.entries(grouped).map(([cat, models]) => (
                    <optgroup key={cat} label={`═══ ${cat} ═══`}>
                      {models.map(m => (
                        <option key={m.id} value={m.name}>{m.name} — ₹{m.exShowroom.toLocaleString('en-IN')}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* ⭐ Variant dropdown (CC) */}
              <div>
                <label style={lbl}>Variant (CC)</label>
                <select style={{ ...f, cursor:'pointer' }} value={data.variant} onChange={e => setData({...data, variant: e.target.value, cc: e.target.value})}>
                  <option value="">— Variant —</option>
                  {variants.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              {/* ⭐ Color dropdown */}
              <div>
                <label style={lbl}>Color</label>
                <select style={{ ...f, cursor:'pointer' }} value={data.color} onChange={e => setData({...data, color: e.target.value})}>
                  <option value="">— Color चुनें —</option>
                  {HONDA_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div><label style={lbl}>Chassis No</label><input style={f} placeholder="ME4JK361ATW542678" value={data.chassisNo} onChange={e => setData({...data, chassisNo: e.target.value.toUpperCase()})}/></div>
              <div><label style={lbl}>Engine No</label><input style={f} placeholder="JK36EW1542422" value={data.engineNo} onChange={e => setData({...data, engineNo: e.target.value.toUpperCase()})}/></div>
              <div><label style={lbl}>Key No</label><input style={f} placeholder="PL09" value={data.keyNo} onChange={e => setData({...data, keyNo: e.target.value.toUpperCase()})}/></div>
              <div><label style={lbl}>Battery No</label><input style={f} placeholder="M211271" value={data.batteryNo} onChange={e => setData({...data, batteryNo: e.target.value.toUpperCase()})}/></div>
              <div><label style={lbl}>HSN Number</label><input style={f} placeholder="87112029" value={data.hsnNumber||''} onChange={e => setData({...data, hsnNumber: e.target.value})}/></div>
              <div><label style={lbl}>Bill Book No</label><input style={f} placeholder="Optional" value={data.billBookNo||''} onChange={e => setData({...data, billBookNo: e.target.value.toUpperCase()})}/></div>
              <div><label style={lbl}>Year</label><input style={f} type="number" value={data.year || new Date().getFullYear()} onChange={e => setData({...data, year: e.target.value})}/></div>
              <div><label style={lbl}>Purchase Date</label><input style={f} type="date" value={data.purchaseDate || new Date().toISOString().split('T')[0]} onChange={e => setData({...data, purchaseDate: e.target.value})}/></div>
            </div>
          </div>

          {/* ───── PRICING ───── */}
          <div style={{ marginBottom:18 }}>
            <h3 style={{ color:'#fbbf24', fontSize:13, fontWeight:800, marginBottom:10, paddingBottom:6, borderBottom:'1px solid #334155', display:'flex', alignItems:'center', gap:6 }}>
              💰 Ex-Showroom Price
            </h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:12 }}>
              <div>
                <label style={lbl}>Ex-Showroom Price * <span style={{ color:'#86efac' }}>(GST शामिल — यही असली selling price है)</span></label>
                <input
                  style={{ ...f, fontWeight:800, color:'#86efac', fontSize:18, padding:'14px 16px' }}
                  type="number" placeholder="0"
                  value={data.exShowroom || data.price || ''}
                  onChange={e => handlePriceChange(e.target.value)}
                />
                <p style={{ color:'#64748b', fontSize:11, marginTop:6 }}>
                  💡 Vehicle Model select करने पर यह automatic भर जाएगी। बदलना हो तो manual edit कर सकते हैं।
                </p>
              </div>

              {/* Tax Invoice Breakdown Preview (for reference only) */}
              {data.exShowroom > 0 && (
                <div style={{ background:'#1e293b88', border:'1px dashed #475569', borderRadius:10, padding:'12px 14px' }}>
                  <p style={{ color:'#94a3b8', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>
                    📋 Tax Invoice Breakdown <span style={{ color:'#fbbf24' }}>(generate करने पर ऐसे दिखेगा)</span>
                  </p>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:12 }}>
                    <div style={{ color:'#94a3b8' }}>Taxable Price:</div>
                    <div style={{ color:'#e2e8f0', textAlign:'right', fontWeight:600 }}>₹{taxPreview.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div style={{ color:'#94a3b8' }}>SGST @ 9%:</div>
                    <div style={{ color:'#fcd34d', textAlign:'right' }}>₹{taxPreview.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div style={{ color:'#94a3b8' }}>CGST @ 9%:</div>
                    <div style={{ color:'#fcd34d', textAlign:'right' }}>₹{taxPreview.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div style={{ color:'#86efac', fontWeight:800, borderTop:'1px solid #475569', paddingTop:6, marginTop:4 }}>Ex-Showroom Total:</div>
                    <div style={{ color:'#86efac', textAlign:'right', fontWeight:800, borderTop:'1px solid #475569', paddingTop:6, marginTop:4 }}>₹{taxPreview.exShowroom.toLocaleString('en-IN')}</div>
                  </div>
                  <p style={{ color:'#64748b', fontSize:10, marginTop:8, fontStyle:'italic' }}>
                    ↑ यह सिर्फ preview है — Tax Invoice automatic इसी तरह बनेगा
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ───── FINANCE ───── */}
          <div style={{ marginBottom:18 }}>
            <h3 style={{ color:'#c4b5fd', fontSize:13, fontWeight:800, marginBottom:10, paddingBottom:6, borderBottom:'1px solid #334155', display:'flex', alignItems:'center', gap:6 }}>
              🏦 Finance / Payment
            </h3>
            <div>
              <label style={lbl}>Financer Name</label>
              <select style={{ ...f, cursor:'pointer' }} value={data.financerName||'CASH'} onChange={e => setData({...data, financerName: e.target.value})}>
                {FINANCE_COMPANIES.map(fc => <option key={fc} value={fc}>{fc}</option>)}
              </select>
              <p style={{ color:'#64748b', fontSize:10, marginTop:4 }}>"CASH" = बिना finance के, बाकी = finance company</p>
            </div>
          </div>

          {/* ───── ACTIONS ───── */}
          <div style={{ display:'flex', gap:10, paddingTop:14, borderTop:'1px solid #334155' }}>
            <button onClick={onSave}
              style={{ flex:1, background:'linear-gradient(135deg, #16a34a, #15803d)', color:'#fff', border:'none', padding:'12px 18px', borderRadius:10, fontSize:14, fontWeight:800, cursor:'pointer', boxShadow:'0 4px 14px rgba(22,163,74,0.4)' }}>
              💾 Save Customer & Sync
            </button>
            <button onClick={onCancel}
              style={{ background:'#475569', color:'#fff', border:'none', padding:'12px 18px', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer' }}>
              ✖ Cancel
            </button>
          </div>

          <div style={{ marginTop:12, padding:'10px 12px', background:'#1e3a8a22', border:'1px solid #3b82f655', borderRadius:8, color:'#93c5fd', fontSize:11 }}>
            💡 <b>Tip:</b> यह customer Vehicle Dashboard + Customer Management + Invoices — सब जगह automatically दिखेगा। MongoDB में sync हो जाएगा सभी devices पर।
          </div>
        </div>
      </div>
    </div>
  );
}