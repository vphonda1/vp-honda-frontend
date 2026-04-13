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
  
  // Analytics data
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
    // Seller (जिसने गाड़ी दी)
    custName:'', custFather:'', custAdd:'', custMob:'',
    // Vehicle & Owner
    owner:'', ownerFather:'', veh:'', mdl:'', regNo:'', psPrice:0, purchaseDate:'',
    // Buyer (जिसको बेची)
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

  const handleAdminLogin = () => setShowAdminModal(true);
  const doAdminLogin = () => {
    if (adminPass === 'vphonda@123') { setIsAdmin(true); setShowAdminModal(false); setAdminPass(''); }
    else { alert('❌ Wrong password!'); setAdminPass(''); }
  };

  // ── Old Bike handlers ─────────────────────────────────────────────────────
  const resetOldBikeForm = () => { setOldBikeForm({...emptyOldBikeForm}); setEditOldBikeId(null); };
  const saveOldBike = () => {
    if (!oldBikeForm.custName || !oldBikeForm.veh) { alert('Customer Name और Vehicle भरें'); return; }
    // Auto status: if buyer exists → Sold
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

  // Excel import — exact OLD BIKE sheet columns
  const handleOldBikeImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const wb = XLSX.read(await file.arrayBuffer(), { type:'array', cellDates:true });
    const sn = wb.SheetNames.find(n => /old.?bike/i.test(n));
    if (!sn) { alert('❌ OLD BIKE sheet नहीं मिली! Available: ' + wb.SheetNames.join(', ')); e.target.value=''; return; }
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval:'', header:1 });
    // Skip header row
    let added = 0;
    const updated = [...oldBikes];
    const fmtDate = (v) => { if(!v) return ''; try { const d = v instanceof Date ? v : new Date(v); if(isNaN(d)) return ''; return d.toISOString().split('T')[0]; } catch{return '';} };

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0] && !r[1]) continue; // skip empty rows
      const custName = String(r[1]||'').trim();
      if (!custName) continue;

      updated.push({
        id: Date.now() + added,
        // A-E: जिसने गाड़ी दी (Seller/Customer)
        custName:     custName,
        custFather:   String(r[2]||'').trim(),
        custAdd:      String(r[3]||'').trim(),
        custMob:      String(r[4]||'').trim(),
        // F-G: Owner (RC पर जिसका नाम)
        owner:        String(r[5]||'').trim(),
        ownerFather:  String(r[6]||'').trim(),
        // H-L: Vehicle details
        veh:          String(r[7]||'').trim(),
        mdl:          String(r[8]||'').trim(),
        regNo:        String(r[9]||'').trim(),
        psPrice:      parseFloat(r[10]) || 0,
        purchaseDate: fmtDate(r[11]),
        // M-S: जिसको बेची (Buyer)
        buyerName:    String(r[12]||'').trim(),
        buyerFather:  String(r[13]||'').trim(),
        buyerAdd:     String(r[14]||'').trim(),
        buyerMob:     String(r[15]||'').trim(),
        buyerAadhar:  String(r[16]||'').trim(),
        slPrice:      parseFloat(r[17]) || 0,
        slDate:       fmtDate(r[18]),
        // Auto status
        status:       String(r[12]||'').trim() ? 'Sold' : 'Available',
        addedAt:      new Date().toISOString(),
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
    localStorage.setItem('vehDashboardData', JSON.stringify(updated));
  };

  const handleAddNewCustomer = () => {
    const nc = {...newCustomer, id: Date.now(), date: new Date().toISOString().split('T')[0]};
    const updated = [...vehicleData, nc];
    setVehicleData(updated);
    localStorage.setItem('vehDashboardData', JSON.stringify(updated));
    setShowAddCustomer(false);
    setNewCustomer({customerName:'',fatherName:'',mobileNo:'',address:'',dist:'',pinCode:'',dob:'',vehicleModel:'',variant:'',color:'',engineNo:'',chassisNo:'',keyNo:'',batteryNo:'',financerName:'',price:0});
    alert('✅ Customer added!');
  };
  const [invoiceData, setInvoiceData] = useState({
    customerName: '',
    fatherName: '',
    mobileNo: '',
    address: '',
    dist: '',
    pinCode: '',
    vehicleModel: '',
    color: '',
    variant: '',
    engineNo: '',
    chassisNo: '',
    keyNo: '',
    batteryNo: '',
    financerName: '',
    dob: '',
    price: 0,
    invoiceDate: new Date().toISOString().split('T')[0],
    gstin: '23BCYPD9538B1ZG',
    pan: 'BCYPD9538B'
  });

  // Load Excel file
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { cellDates: true });
        const worksheet = workbook.Sheets['cost_detl'];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // Read Rate_List sheet for prices
        const rateSheet = workbook.Sheets['Rate_List'];
        const priceMap = {};
        if (rateSheet) {
          const rateData = XLSX.utils.sheet_to_json(rateSheet, { header: 1 });
          for (let i = 0; i < rateData.length; i++) {
            const row = rateData[i];
            if (!row) continue;
            const model = row[1]; // Column B
            const exShowroom = parseFloat(row[4]); // Column E
            const taxRate = parseFloat(row[15]); // Column P
            if (model && typeof model === 'string' && model.length > 3 && exShowroom > 0) {
              priceMap[model.trim().toUpperCase()] = { exShowroom, taxRate: taxRate || 0 };
            }
          }
          setRatePrices(priceMap);
          localStorage.setItem('sharedRatePrices', JSON.stringify(priceMap));
        }
        
        // Excel date serial number to readable date
        const parseExcelDate = (val) => {
          if (!val) return '';
          let d;
          if (val instanceof Date) {
            d = val;
          } else if (typeof val === 'number') {
            d = new Date(Math.round((val - 25569) * 86400 * 1000) + 43200000);
          } else {
            const str = String(val).trim();
            const parts = str.split(/[\/\-\.]/);
            if (parts.length === 3) {
              const a = parseInt(parts[0]), b = parseInt(parts[1]), c = parseInt(parts[2]);
              if (c > 100) { d = new Date(c, b - 1, a); }
              else if (a > 100) { d = new Date(a, b - 1, c); }
              else { d = new Date(str); }
            } else { d = new Date(str); }
          }
          if (!d || isNaN(d.getTime())) return '';
          const dd = String(d.getUTCDate()).padStart(2,'0');
          const mm = String(d.getUTCMonth()+1).padStart(2,'0');
          const yyyy = d.getUTCFullYear();
          return `${yyyy}-${mm}-${dd}`;
        };

        // Transform data
        const transformedData = jsonData
          .filter(row => row['Cost Name']) // Filter empty rows
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
        
        // Extract unique models and variants
        const uniqueModels = [...new Set(transformedData.map(d => d.vehicleModel))].filter(Boolean);
        setModels(uniqueModels);
        
        // Show loading/error for mobile users
  const MobileLoadingBanner = () => {
    if (dbLoading) return <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 text-center mb-4"><div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"/><p className="text-yellow-700 font-bold">⏳ Server से data load हो रहा है...</p><p className="text-yellow-500 text-sm">पहली बार 30-50 sec लग सकते हैं</p></div>;
    if (dbError && vehicleData.length === 0) return <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 text-center mb-4"><p className="text-red-700 font-bold text-lg">⚠️ {dbError}</p><Button onClick={()=>window.location.reload()} className="mt-3 bg-red-600 text-white">🔄 Refresh</Button></div>;
    return null;
  };

  // Calculate analytics
        calculateAnalytics(transformedData);
        
        // Save to localStorage - shared keys for all pages
        localStorage.setItem('vehDashboardData', JSON.stringify(transformedData));
        localStorage.setItem('vehDashboardModels', JSON.stringify(uniqueModels));
        // Sync to shared customer data for other pages
        const customerSync = transformedData.map(v => ({
          _id: v.id,
          name: v.customerName,
          fatherName: v.fatherName,
          phone: v.mobileNo,
          aadhar: v.aadharNo || '',
          pan: v.panNo || '',
          address: v.address,
          district: v.dist,
          pinCode: v.pinCode,
          state: 'M.P.',
          dob: v.dob || '',
          financerName: v.financerName || '',
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
        localStorage.setItem('sharedVehicleData', JSON.stringify(transformedData));
        // Notify other pages
        window.dispatchEvent(new Event('dataSync'));
        
        // ── Save to MongoDB backend (sync across devices) ──────────
        (async () => {
          let saved = 0;
          for (const c of customerSync) {
            try {
              await fetch(api('/api/customers'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  customerName: c.name, fatherName: c.fatherName, phone: c.phone,
                  aadhar: c.aadhar, pan: c.pan, address: c.address, district: c.district,
                  dob: c.dob, vehicleModel: c.linkedVehicle?.model,
                  vehicleColor: c.linkedVehicle?.color, engineNo: c.linkedVehicle?.engineNo,
                  chassisNo: c.linkedVehicle?.frameNo, registrationNo: c.linkedVehicle?.regNo,
                  invoiceDate: c.linkedVehicle?.purchaseDate, financeCompany: c.financerName,
                }),
              });
              saved++;
            } catch(e) {}
          }
          console.log(`✅ ${saved}/${customerSync.length} customers saved to MongoDB`);
        })();

        alert('✅ डेटा सफलतापूर्वक लोड हो गया!\n💾 Data save हो गया - अगली बार auto-load होगा!');
      } catch (error) {
        alert('❌ फाइल लोड करने में त्रुटि: ' + error.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Load data from localStorage + MongoDB on component mount
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState('');

  useEffect(() => {
    const savedData = localStorage.getItem('vehDashboardData');
    const savedModels = localStorage.getItem('vehDashboardModels');
    
    // Always try MongoDB first (cross-device sync)
    setDbLoading(true);
    setDbError('');
    (async () => {
      try {
        const res = await fetch(api('/api/customers'));
        if (res.ok) {
          const dbCustomers = await res.json();
          if (dbCustomers.length > 0) {
            const transformed = dbCustomers.map((c, i) => ({
              id: c._id || i + 1,
              customerName: c.customerName || '',
              fatherName: c.fatherName || '',
              mobileNo: c.phone || '',
              address: c.address || '',
              dist: c.district || '',
              vehicleModel: c.vehicleModel || '',
              color: c.vehicleColor || '',
              engineNo: c.engineNo || '',
              chassisNo: c.chassisNo || '',
              regNo: c.registrationNo || '',
              date: c.invoiceDate || '',
              financerName: c.financeCompany || '',
              aadharNo: c.aadhar || '',
              panNo: c.pan || '',
              dob: c.dob || '',
            }));
            setVehicleData(transformed);
            setFilteredData(transformed);
            const uniqueModels = [...new Set(transformed.map(d => d.vehicleModel))].filter(Boolean);
            setModels(uniqueModels);
            calculateAnalytics(transformed);
            localStorage.setItem('vehDashboardData', JSON.stringify(transformed));
            localStorage.setItem('vehDashboardModels', JSON.stringify(uniqueModels));
          } else {
            setDbError('Database खाली है — Laptop से Excel import करें');
          }
        } else {
          setDbError('Server से data load नहीं हुआ — Refresh करें');
        }
      } catch(e) {
        console.log('MongoDB offline, trying localStorage cache');
        // Fallback to localStorage
        try {
          const sd = localStorage.getItem('vehDashboardData');
          const sm = localStorage.getItem('vehDashboardModels');
          if (sd && sm) {
            const pd = JSON.parse(sd), pm = JSON.parse(sm);
            if (pd.length > 0) { setVehicleData(pd); setFilteredData(pd); setModels(pm); calculateAnalytics(pd); setDbLoading(false); return; }
          }
        } catch{}
        setDbError('Server connecting... 30 sec wait करें फिर Refresh');
      }
      setDbLoading(false);
    })();
  }, []);

  // Show loading/error for mobile users
  const MobileLoadingBanner = () => {
    if (dbLoading) return <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 text-center mb-4"><div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"/><p className="text-yellow-700 font-bold">⏳ Server से data load हो रहा है...</p><p className="text-yellow-500 text-sm">पहली बार 30-50 sec लग सकते हैं</p></div>;
    if (dbError && vehicleData.length === 0) return <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 text-center mb-4"><p className="text-red-700 font-bold text-lg">⚠️ {dbError}</p><Button onClick={()=>window.location.reload()} className="mt-3 bg-red-600 text-white">🔄 Refresh</Button></div>;
    return null;
  };

  // Calculate analytics
  const calculateAnalytics = (data) => {
    if (!data || data.length === 0) return;
    // Monthly analytics
    const monthlyData = {};
    data.forEach(item => {
      if (item.date) {
        const dateObj = new Date(item.date);
        if (!dateObj || isNaN(dateObj.getTime())) return;
        const monthYear = `${dateObj.toLocaleString('en-IN', { month: 'short' })}-${dateObj.getFullYear()}`;
        monthlyData[monthYear] = (monthlyData[monthYear] || 0) + 1;
      }
    });
    
    const monthlyChart = Object.entries(monthlyData)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => new Date(a.month) - new Date(b.month));
    
    setMonthlyAnalytics(monthlyChart);

    // Model analytics
    const modelData = {};
    data.forEach(item => {
      if (item.vehicleModel) {
        modelData[item.vehicleModel] = (modelData[item.vehicleModel] || 0) + 1;
      }
    });
    
    const modelChart = Object.entries(modelData)
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count);
    
    setModelAnalytics(modelChart);

    // Variant analytics
    const variantData = {};
    data.forEach(item => {
      if (item.variant) {
        variantData[item.variant] = (variantData[item.variant] || 0) + 1;
      }
    });
    
    const variantChart = Object.entries(variantData)
      .map(([variant, count]) => ({ variant, count }))
      .sort((a, b) => b.count - a.count);
    
    setVariantAnalytics(variantChart);
  };

  // Apply filters
  useEffect(() => {
    let filtered = vehicleData;

    if (selectedModel) {
      filtered = filtered.filter(d => d.vehicleModel === selectedModel);
    }

    if (selectedVariant) {
      filtered = filtered.filter(d => d.variant === selectedVariant);
    }

    if (selectedYear) {
      filtered = filtered.filter(d => {
        if (d.date) {
          const year = new Date(d.date).getFullYear().toString();
          return year === selectedYear;
        }
        return false;
      });
    }

    if (selectedMonth) {
      filtered = filtered.filter(d => {
        if (d.date) {
          const month = (new Date(d.date).getMonth() + 1).toString().padStart(2, '0');
          return month === selectedMonth;
        }
        return false;
      });
    }

    setFilteredData(filtered);
    calculateAnalytics(filtered);
    setCurrentPage(1);
  }, [selectedModel, selectedVariant, selectedYear, selectedMonth, vehicleData]);

  // Get unique variants for selected model
  const getVariantsForModel = () => {
    if (!selectedModel) return [];
    return [...new Set(vehicleData.filter(d => d.vehicleModel === selectedModel).map(d => d.variant))];
  };

  // Get unique years
  const getYears = () => {
    const years = new Set();
    vehicleData.forEach(d => {
      if (d.date) {
        years.add(new Date(d.date).getFullYear().toString());
      }
    });
    return Array.from(years).sort().reverse();
  };

  const handleGenerateInvoice = (vehicle) => {
    setSelectedVehicle(vehicle);
    // Auto-lookup price from Rate_List
    const variantKey = (vehicle.variant || '').trim().toUpperCase();
    const modelKey = (vehicle.vehicleModel || '').trim().toUpperCase();
    let autoPrice = vehicle.price;
    // Try matching model name with Rate_List
    for (const [key, val] of Object.entries(ratePrices)) {
      if (modelKey && key.includes(modelKey.split(' ')[0]) && key.includes(modelKey.split(' ').pop())) {
        autoPrice = val.exShowroom || val;
        break;
      }
    }
    if (ratePrices[modelKey]) autoPrice = ratePrices[modelKey].exShowroom || ratePrices[modelKey];
    if (ratePrices[variantKey]) autoPrice = ratePrices[variantKey].exShowroom || ratePrices[variantKey];
    
    setInvoiceData({
      customerName: vehicle.customerName,
      fatherName: vehicle.fatherName,
      mobileNo: vehicle.mobileNo,
      address: vehicle.address,
      dist: vehicle.dist,
      pinCode: vehicle.pinCode,
      vehicleModel: vehicle.vehicleModel,
      color: vehicle.color,
      variant: vehicle.variant,
      engineNo: vehicle.engineNo,
      chassisNo: vehicle.chassisNo,
      keyNo: vehicle.keyNo,
      batteryNo: vehicle.batteryNo || '',
      price: autoPrice,
      dob: vehicle.dob || '',
      financerName: vehicle.financerName || '',
      invoiceDate: new Date().toISOString().split('T')[0],
      gstin: '23BCYPD9538B1ZG',
      pan: 'BCYPD9538B'
    });
    setShowInvoiceModal(true);
  };

  // Edit vehicle details
  const handleEditVehicle = (vehicle) => {
    setEditVehicle({...vehicle});
    setShowEditModal(true);
  };

  const saveEditVehicle = () => {
    const updated = vehicleData.map(v => v.id === editVehicle.id ? editVehicle : v);
    setVehicleData(updated);
    localStorage.setItem('vehDashboardData', JSON.stringify(updated));
    setShowEditModal(false);
    alert('✅ Updated!');
  };

  // Generate Invoice PDF with Professional Layout
  const generateInvoicePDF = () => {
    const nextNum = generatedInvoices.length + 1;
    const invoiceNo = `SMH/${new Date(invoiceData.invoiceDate).getFullYear()}-${String(new Date(invoiceData.invoiceDate).getMonth() + 1).padStart(2, '0')} ${String(nextNum).padStart(3, '0')}`;
    const invoiceDate = invoiceData.invoiceDate;
    
    // Convert amount to words
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

    // Correct calculations - ONLY TAX on Ex-Showroom Price
    // Amount entered = Ex-Showroom Price (including GST). Reverse calculate taxable.
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
        
        <!-- HEADER -->
        <div style="margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 8px;">
          <div style="font-weight: bold; font-size: 14px;">V P HONDA</div>
          <div>NARSINGHGARH ROAD, NEAR BRIDGE, PARWALIYA SADAK</div>
          <div>BHOPAL , MADHYA PRADESH , 462030</div>
          <div>9713394738</div>
          <div>Email :- vphonda1@gmail.com</div>
          <div>GSTIN No : 23BCYPD9538B1ZG</div>
          <div style="margin-top: 4px;">PAN No: - BCYPD9538B</div>
        </div>

        <!-- TAX INVOICE TITLE -->
        <div style="text-align: center; margin-bottom: 10px;">
          <span style="font-weight: bold; font-size: 15px; text-decoration: underline;">TAX INVOICE</span>
        </div>
        <hr style="border: 1px solid #000; margin-bottom: 8px;">

        <!-- TWO COLUMN: Customer LEFT, Invoice Info RIGHT -->
        <table style="width: 100%; margin-bottom: 10px; font-size: 12px; border: none;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width: 58%; vertical-align: top; padding: 0; border: none;">
              <div style="font-weight: bold; text-decoration: underline; margin-bottom: 4px;">CUSTOMER NAME &amp; ADDRESS</div>
              <table style="width: 100%; border: none; font-size: 12px;" cellpadding="2" cellspacing="0">
                <tr><td style="border:none; width:120px; font-weight:bold;">Sold To</td><td style="border:none; width:10px;">:</td><td style="border:none;">${invoiceData.customerName} &nbsp;&nbsp; <strong>S/O</strong> ${invoiceData.fatherName}</td></tr>
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

        <!-- VEHICLE TABLE -->
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

        <!-- PRICING TABLE -->
        <table style="width: 100%; margin-bottom: 5px; font-size: 12px; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px; border: 1px solid #000; font-weight: bold; width: 70%;">Taxable Price</td>
            <td style="padding: 4px; border: 1px solid #000; text-align: right; width: 30%;">₹ ${fmt(taxablePrice)}</td>
          </tr>
          <tr>
            <td style="padding: 4px; border: 1px solid #000;">SGST @ 9%</td>
            <td style="padding: 4px; border: 1px solid #000; text-align: right;">₹ ${fmt(sgst)}</td>
          </tr>
          <tr>
            <td style="padding: 4px; border: 1px solid #000;">CGST @ 9%</td>
            <td style="padding: 4px; border: 1px solid #000; text-align: right;">₹ ${fmt(cgst)}</td>
          </tr>
          <tr>
            <td style="padding: 4px; border: 1px solid #000; font-weight: bold;">Invoice Sub Total</td>
            <td style="padding: 4px; border: 1px solid #000; text-align: right;">₹ ${fmt(invoiceSubTotal)}</td>
          </tr>
          <tr>
            <td style="padding: 4px; border: 1px solid #000;">(Round Off)</td>
            <td style="padding: 4px; border: 1px solid #000; text-align: right;">₹ ${fmt(roundOff)}</td>
          </tr>
          <tr>
            <td style="padding: 4px; border: 1px solid #000; font-weight: bold;">Invoice Total</td>
            <td style="padding: 4px; border: 1px solid #000; text-align: right; font-weight: bold;">₹ ${fmt(invoiceTotal)}</td>
          </tr>
        </table>

        <!-- AMOUNT & REMARKS -->
        <table style="width: 100%; margin-bottom: 5px; font-size: 12px; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px; border: 1px solid #000; font-weight: bold; width: 22%;">Amount in Words</td>
            <td style="padding: 4px; border: 1px solid #000;">: ${amountToWords(invoiceTotal)}</td>
          </tr>
          <tr>
            <td style="padding: 4px; border: 1px solid #000; font-weight: bold;">Remarks</td>
            <td style="padding: 4px; border: 1px solid #000;">:</td>
          </tr>
        </table>

        <!-- BATTERY / BOOK / KEY / CC / YEAR -->
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
            <td style="padding: 4px; border: 1px solid #000;">123.94 CC</td>
            <td style="padding: 4px; border: 1px solid #000;">${new Date(invoiceDate).getFullYear()}</td>
          </tr>
        </table>

        <!-- TERMS -->
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

        <!-- SIGNATURES -->
        <table style="width: 100%; margin-top: 15px; font-size: 12px; border: none;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width: 50%; vertical-align: bottom; padding-top: 20px; border: none;"><strong>Customer Signature</strong></td>
            <td style="width: 50%; text-align: right; vertical-align: bottom; border: none;">
              <div>For V P HONDA</div>
              <div style="margin-top: 15px;"><strong>Authorized Signature</strong></div>
            </td>
          </tr>
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
    // Track generated invoice
    const newInvoice = {
      invoiceNo: invoiceNo,
      customerName: invoiceData.customerName,
      vehicleModel: invoiceData.vehicleModel,
      amount: invoiceTotal,
      date: invoiceDate,
      id: Date.now()
    };
    const updatedInvoices = [...generatedInvoices, newInvoice];
    setGeneratedInvoices(updatedInvoices);
    localStorage.setItem('generatedInvoices', JSON.stringify(updatedInvoices));
    setShowInvoiceModal(false);
  };

  const COLORS = ['#1e3c72', '#2a5298', '#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8'];

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <MobileLoadingBanner />
      {/* ── Admin Login Modal (password hidden) ── */}
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

      {/* ── View Old Bike Modal ── */}
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

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-4xl font-bold text-white">🏍️ Vehicle Dashboard</h1>
          <div className="flex gap-3">
            <Button onClick={() => setShowAddCustomer(true)} className="bg-green-600 hover:bg-green-700 text-white"><Plus size={16} className="mr-1" /> Add New Customer</Button>
            {!isAdmin ? (
              <Button onClick={handleAdminLogin} className="bg-red-600 hover:bg-red-700 text-white">🔒 Admin Login</Button>
            ) : (
              <span className="bg-green-700 text-white px-4 py-2 rounded font-bold cursor-pointer" onClick={()=>setIsAdmin(false)}>✅ Admin ✕</span>
            )}
          </div>
        </div>
        <p className="text-slate-300 mb-3">Advanced Analytics & Invoice Management</p>
        {/* TABS */}
        <div className="flex gap-2">
          {[
            { id:'vehicles', label:`🏍️ New Vehicles (${vehicleData.length})` },
            { id:'oldBikes', label:`🚲 Old Bikes (${oldBikes.length})` },
          ].map(t => (
            <button key={t.id} onClick={()=>{ setVdActiveTab(t.id); setCurrentPage(1); setOldBikePage(1); }}
              className={`px-5 py-2 rounded-lg text-sm font-bold border-2 transition ${
                vdActiveTab===t.id ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
              }`}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ═══ VEHICLES TAB (all existing content) ═══ */}
      {vdActiveTab === 'vehicles' && (<>

      {/* File Upload */}
      <Card className="bg-slate-800 border-slate-700 mb-6">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700">
          <CardTitle className="text-white flex items-center gap-2">
            <Upload size={20} /> डेटा Import करें
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <input
            type="file"
            accept=".xlsx,.xlsm"
            onChange={handleFileUpload}
            className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
          />
          <p className="text-slate-400 text-sm mt-2">वह फाइल Upload करें जिसमें 'cost_detl' sheet हो</p>
        </CardContent>
      </Card>

      {vehicleData.length > 0 && (
        <>
          {/* Filters */}
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700">
              <CardTitle className="text-white flex items-center gap-2">
                <Filter size={20} /> फ़िल्टर्स
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-slate-300 text-sm font-semibold mb-2 block">Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => {
                      setSelectedModel(e.target.value);
                      setSelectedVariant('');
                    }}
                    className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md"
                  >
                    <option value="">सभी Models</option>
                    {models.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 text-sm font-semibold mb-2 block">Variant</label>
                  <select
                    value={selectedVariant}
                    onChange={(e) => setSelectedVariant(e.target.value)}
                    disabled={!selectedModel}
                    className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md disabled:opacity-50"
                  >
                    <option value="">सभी Variants</option>
                    {getVariantsForModel().map(variant => (
                      <option key={variant} value={variant}>{variant}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 text-sm font-semibold mb-2 block">Year</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md"
                  >
                    <option value="">सभी Years</option>
                    {getYears().map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 text-sm font-semibold mb-2 block">Month</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md"
                  >
                    <option value="">सभी Months</option>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <option key={m} value={String(m).padStart(2, '0')}>
                        {new Date(2024, m-1).toLocaleString('en-IN', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-900 rounded-lg">
                <p className="text-blue-200 text-sm">
                  <strong>Total Results:</strong> {filteredData.length} vehicles found
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Analytics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-center">
                  <TrendingUp className="text-green-500 w-12 h-12 mx-auto mb-4" />
                  <p className="text-slate-400 text-sm">कुल Vehicles</p>
                  <p className="text-3xl font-bold text-white mt-2">{vehicleData.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Calendar className="text-blue-500 w-12 h-12 mx-auto mb-4" />
                  <p className="text-slate-400 text-sm">फ़िल्टर किए गए Results</p>
                  <p className="text-3xl font-bold text-white mt-2">{filteredData.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-center">
                  <FileText className="text-orange-500 w-12 h-12 mx-auto mb-4" />
                  <p className="text-slate-400 text-sm">कुल Models</p>
                  <p className="text-3xl font-bold text-white mt-2">{models.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Monthly Sales */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">📊 Monthly Sales Trend</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyAnalytics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="month" stroke="#999" />
                    <YAxis stroke="#999" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="#00bfff" strokeWidth={2} name="Sales" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Model Distribution */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">🚗 Model Distribution</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={modelAnalytics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="model" stroke="#999" angle={-45} textAnchor="end" height={80} />
                    <YAxis stroke="#999" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                    <Legend />
                    <Bar dataKey="count" fill="#00bfff" name="Count" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Variant Distribution */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">🎯 Variant Distribution</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={variantAnalytics}
                      dataKey="count"
                      nameKey="variant"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {variantAnalytics.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Revenue Analytics */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">💰 Average Price by Model</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={models.map(model => ({
                    model,
                    avgPrice: Math.round(vehicleData.filter(d => d.vehicleModel === model).reduce((sum, d) => sum + d.price, 0) / vehicleData.filter(d => d.vehicleModel === model).length)
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="model" stroke="#999" angle={-45} textAnchor="end" height={80} />
                    <YAxis stroke="#999" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} formatter={(value) => `₹${(value||0).toLocaleString()}`} />
                    <Bar dataKey="avgPrice" fill="#28a745" name="Avg Price" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Data Table */}
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
                    {filteredData.slice().reverse().slice((currentPage-1)*recordsPerPage, currentPage*recordsPerPage).map((vehicle) => (
                      <tr key={vehicle.id} className="border-t border-slate-700 hover:bg-slate-700/50">
                        <td className="px-4 py-3">{vehicle.customerName}</td>
                        <td className="px-4 py-3">{vehicle.vehicleModel}</td>
                        <td className="px-4 py-3">{vehicle.variant}</td>
                        <td className="px-4 py-3">{vehicle.date ? new Date(vehicle.date).toLocaleDateString('en-IN') : 'N/A'}</td>
                        <td className="px-4 py-3 text-right font-semibold">₹{(vehicle.price||0).toLocaleString()}</td>
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
                          <Button
                            onClick={() => handleEditVehicle(vehicle)}
                            size="sm"
                            className="bg-yellow-600 hover:bg-yellow-700 text-white"
                          >
                            <Edit2 size={14} />
                          </Button>
                          {isAdmin && (
                            <Button
                              onClick={() => handleDeleteVehicle(vehicle.id)}
                              size="sm"
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
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
                    <Button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="bg-slate-600 hover:bg-slate-500 text-white disabled:opacity-40">⬅ Previous</Button>
                    <span className="text-slate-300">Page {currentPage} / {Math.ceil(filteredData.length / recordsPerPage)} ({filteredData.length} records)</span>
                    <Button onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredData.length / recordsPerPage), p+1))} disabled={currentPage >= Math.ceil(filteredData.length / recordsPerPage)} className="bg-slate-600 hover:bg-slate-500 text-white disabled:opacity-40">Next ➡</Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && selectedVehicle && (
        <Card className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="bg-slate-800 border-slate-700 w-full max-w-2xl max-h-96 overflow-y-auto">
            <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 sticky top-0">
              <CardTitle className="text-white flex items-center gap-2">
                <FileText size={20} /> Tax Invoice Generate करें
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Input
                  placeholder="Customer Name"
                  value={invoiceData.customerName}
                  onChange={(e) => setInvoiceData({...invoiceData, customerName: e.target.value})}
                  className="bg-slate-700 text-white border-slate-600"
                />
                <Input
                  placeholder="Father's Name"
                  value={invoiceData.fatherName}
                  onChange={(e) => setInvoiceData({...invoiceData, fatherName: e.target.value})}
                  className="bg-slate-700 text-white border-slate-600"
                />
                <Input
                  placeholder="Mobile"
                  value={invoiceData.mobileNo}
                  onChange={(e) => setInvoiceData({...invoiceData, mobileNo: e.target.value})}
                  className="bg-slate-700 text-white border-slate-600"
                />
                <Input
                  type="date"
                  placeholder="Invoice Date"
                  value={invoiceData.invoiceDate}
                  onChange={(e) => setInvoiceData({...invoiceData, invoiceDate: e.target.value})}
                  className="bg-slate-700 text-white border-slate-600"
                />
                <Input
                  placeholder="Address"
                  value={invoiceData.address}
                  onChange={(e) => setInvoiceData({...invoiceData, address: e.target.value})}
                  className="bg-slate-700 text-white border-slate-600"
                />
                <Input
                  placeholder="District"
                  value={invoiceData.dist}
                  onChange={(e) => setInvoiceData({...invoiceData, dist: e.target.value})}
                  className="bg-slate-700 text-white border-slate-600"
                />
                <Input
                  placeholder="Price"
                  type="number"
                  value={invoiceData.price}
                  onChange={(e) => setInvoiceData({...invoiceData, price: e.target.value})}
                  className="bg-slate-700 text-white border-slate-600"
                />
                <Input
                  placeholder="Key No"
                  value={invoiceData.keyNo}
                  onChange={(e) => setInvoiceData({...invoiceData, keyNo: e.target.value})}
                  className="bg-slate-700 text-white border-slate-600"
                />
                <Input
                  placeholder="Battery No"
                  value={invoiceData.batteryNo}
                  onChange={(e) => setInvoiceData({...invoiceData, batteryNo: e.target.value})}
                  className="bg-slate-700 text-white border-slate-600"
                />
                <Input
                  placeholder="Financer Name"
                  value={invoiceData.financerName}
                  onChange={(e) => setInvoiceData({...invoiceData, financerName: e.target.value})}
                  className="bg-slate-700 text-white border-slate-600"
                />
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={generateInvoicePDF}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
                >
                  <Download size={18} className="mr-2" /> PDF Download करें
                </Button>
                <Button
                  onClick={() => setShowInvoiceModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </Card>
      )}

      {/* Edit Vehicle Modal */}
      {showEditModal && editVehicle && (
        <Card className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="bg-slate-800 border-slate-700 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader className="bg-gradient-to-r from-yellow-600 to-yellow-700 sticky top-0">
              <CardTitle className="text-white flex items-center gap-2">
                <Edit2 size={20} /> Edit - {editVehicle.customerName}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Input placeholder="Customer Name" value={editVehicle.customerName} onChange={(e) => setEditVehicle({...editVehicle, customerName: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Father Name" value={editVehicle.fatherName} onChange={(e) => setEditVehicle({...editVehicle, fatherName: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Mobile" value={editVehicle.mobileNo} onChange={(e) => setEditVehicle({...editVehicle, mobileNo: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Address" value={editVehicle.address} onChange={(e) => setEditVehicle({...editVehicle, address: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="District" value={editVehicle.dist} onChange={(e) => setEditVehicle({...editVehicle, dist: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Pin Code" value={editVehicle.pinCode} onChange={(e) => setEditVehicle({...editVehicle, pinCode: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="DOB (DD-MM-YYYY)" value={editVehicle.dob} onChange={(e) => setEditVehicle({...editVehicle, dob: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Vehicle Model" value={editVehicle.vehicleModel} onChange={(e) => setEditVehicle({...editVehicle, vehicleModel: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Variant" value={editVehicle.variant} onChange={(e) => setEditVehicle({...editVehicle, variant: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Color" value={editVehicle.color} onChange={(e) => setEditVehicle({...editVehicle, color: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Engine No" value={editVehicle.engineNo} onChange={(e) => setEditVehicle({...editVehicle, engineNo: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Chassis No" value={editVehicle.chassisNo} onChange={(e) => setEditVehicle({...editVehicle, chassisNo: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Key No" value={editVehicle.keyNo} onChange={(e) => setEditVehicle({...editVehicle, keyNo: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Battery No" value={editVehicle.batteryNo} onChange={(e) => setEditVehicle({...editVehicle, batteryNo: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Financer Name" value={editVehicle.financerName} onChange={(e) => setEditVehicle({...editVehicle, financerName: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Price" type="number" value={editVehicle.price} onChange={(e) => setEditVehicle({...editVehicle, price: parseFloat(e.target.value) || 0})} className="bg-slate-700 text-white border-slate-600" />
              </div>
              <div className="flex gap-4">
                <Button onClick={saveEditVehicle} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-bold">Save</Button>
                <Button onClick={() => setShowEditModal(false)} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </Card>
      )}

      {/* Generated Invoices Record */}
      {generatedInvoices.length > 0 && (
        <Card className="mt-6 bg-slate-800 border-slate-700">
          <CardHeader><CardTitle className="text-white">📄 Generated Invoices ({generatedInvoices.length})</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm text-slate-300">
              <thead className="border-b border-slate-600"><tr>
                <th className="px-3 py-2 text-left">Invoice No</th>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-left">Vehicle</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Date</th>
                {isAdmin && <th className="px-3 py-2 text-center">Action</th>}
              </tr></thead>
              <tbody>
                {generatedInvoices.map(inv => (
                  <tr key={inv.id} className="border-b border-slate-700">
                    <td className="px-3 py-2">{inv.invoiceNo}</td>
                    <td className="px-3 py-2 font-bold">{inv.customerName}</td>
                    <td className="px-3 py-2">{inv.vehicleModel}</td>
                    <td className="px-3 py-2 text-right">₹{(inv.amount||0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                    <td className="px-3 py-2">{inv.date}</td>
                    {isAdmin && <td className="px-3 py-2 text-center"><button onClick={() => handleDeleteInvoice(inv.id)} className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs">🗑</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Add New Customer Modal */}
      {showAddCustomer && (
        <Card className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="bg-slate-800 border-slate-700 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 sticky top-0">
              <CardTitle className="text-white flex items-center gap-2"><Plus size={20} /> Add New Customer</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Input placeholder="Customer Name *" value={newCustomer.customerName} onChange={(e) => setNewCustomer({...newCustomer, customerName: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Father Name" value={newCustomer.fatherName} onChange={(e) => setNewCustomer({...newCustomer, fatherName: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Mobile *" value={newCustomer.mobileNo} onChange={(e) => setNewCustomer({...newCustomer, mobileNo: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Address" value={newCustomer.address} onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="District" value={newCustomer.dist} onChange={(e) => setNewCustomer({...newCustomer, dist: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Pin Code" value={newCustomer.pinCode} onChange={(e) => setNewCustomer({...newCustomer, pinCode: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="DOB (DD-MM-YYYY)" value={newCustomer.dob} onChange={(e) => setNewCustomer({...newCustomer, dob: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Vehicle Model" value={newCustomer.vehicleModel} onChange={(e) => setNewCustomer({...newCustomer, vehicleModel: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Variant" value={newCustomer.variant} onChange={(e) => setNewCustomer({...newCustomer, variant: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Color" value={newCustomer.color} onChange={(e) => setNewCustomer({...newCustomer, color: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Engine No" value={newCustomer.engineNo} onChange={(e) => setNewCustomer({...newCustomer, engineNo: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Chassis No" value={newCustomer.chassisNo} onChange={(e) => setNewCustomer({...newCustomer, chassisNo: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Key No" value={newCustomer.keyNo} onChange={(e) => setNewCustomer({...newCustomer, keyNo: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Battery No" value={newCustomer.batteryNo} onChange={(e) => setNewCustomer({...newCustomer, batteryNo: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Financer Name" value={newCustomer.financerName} onChange={(e) => setNewCustomer({...newCustomer, financerName: e.target.value})} className="bg-slate-700 text-white border-slate-600" />
                <Input placeholder="Price" type="number" value={newCustomer.price} onChange={(e) => setNewCustomer({...newCustomer, price: parseFloat(e.target.value) || 0})} className="bg-slate-700 text-white border-slate-600" />
              </div>
              <div className="flex gap-4">
                <Button onClick={handleAddNewCustomer} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold">Save Customer</Button>
                <Button onClick={() => setShowAddCustomer(false)} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </Card>
      )}
      </>)}

      {/* ═══════════════ OLD BIKES TAB ═══════════════ */}
      {vdActiveTab === 'oldBikes' && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { l:'Total Old Bikes', v:oldBikes.length, c:'text-blue-400', bg:'bg-blue-900/20 border-blue-500' },
              { l:'Available', v:oldBikes.filter(b=>b.status==='Available'||!b.status).length, c:'text-green-400', bg:'bg-green-900/20 border-green-500' },
              { l:'Sold', v:oldBikes.filter(b=>b.status==='Sold').length, c:'text-orange-400', bg:'bg-orange-900/20 border-orange-500' },
              { l:'Total Value', v:'₹'+oldBikes.reduce((s,b)=>s+(parseFloat(b.psPrice)||0),0).toLocaleString('en-IN'), c:'text-yellow-400', bg:'bg-yellow-900/20 border-yellow-500' },
            ].map((k,i) => (
              <Card key={i} className={`${k.bg}`}>
                <CardContent className="p-4">
                  <p className="text-slate-400 text-xs font-bold">{k.l}</p>
                  <p className={`${k.c} font-black text-2xl mt-1`}>{k.v}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts */}
          {oldBikes.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="py-3 bg-orange-900/30"><CardTitle className="text-white text-sm">🚲 Old Bike — कौन सी गाड़ी ज्यादा आई</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={(() => { const m={}; oldBikes.forEach(b=>{const v=(b.veh||'Unknown').toUpperCase().split(' ').slice(0,2).join(' '); m[v]=(m[v]||0)+1;}); return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,value])=>({name,value})); })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                      <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize:9}}/>
                      <YAxis stroke="#94a3b8" tick={{fontSize:10}}/>
                      <Tooltip contentStyle={{background:'#1e293b',border:'1px solid #475569',borderRadius:8}}/>
                      <Bar dataKey="value" fill="#f59e0b" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="py-3 bg-green-900/30"><CardTitle className="text-white text-sm">📊 Status — Available vs Sold</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={[{name:'Available',value:oldBikes.filter(b=>b.status!=='Sold').length},{name:'Sold',value:oldBikes.filter(b=>b.status==='Sold').length}]}
                        dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name,value})=>`${name}: ${value}`}>
                        <Cell fill="#10b981"/><Cell fill="#ef4444"/>
                      </Pie>
                      <Tooltip/>
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            <Button onClick={()=>{resetOldBikeForm();setShowOldBikeForm(true);}} className="bg-green-600 hover:bg-green-700 text-white font-bold">
              <Plus size={16} className="mr-1"/> Add Old Bike
            </Button>
            <label className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded cursor-pointer flex items-center gap-2 text-sm">
              <Upload size={16}/> Import Excel (OLD BIKE sheet)
              <input type="file" accept=".xlsx,.xlsm,.xls" onChange={handleOldBikeImport} className="hidden"/>
            </label>
          </div>

          {/* Add/Edit Form */}
          {showOldBikeForm && (
            <Card className="bg-slate-800 border-green-600 border-2">
              <CardHeader className="bg-gradient-to-r from-green-700 to-green-800 py-3">
                <CardTitle className="text-white text-sm">{editOldBikeId ? '✏️ Edit Old Bike' : '➕ Add Old Bike'}</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <p className="text-orange-400 text-xs font-bold">📤 जिसने गाड़ी दी (Seller)</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Input placeholder="Customer Name *" value={oldBikeForm.custName} onChange={e=>setOldBikeForm({...oldBikeForm,custName:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/>
                  <Input placeholder="Father Name" value={oldBikeForm.custFather} onChange={e=>setOldBikeForm({...oldBikeForm,custFather:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/>
                  <Input placeholder="Address" value={oldBikeForm.custAdd} onChange={e=>setOldBikeForm({...oldBikeForm,custAdd:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/>
                  <Input placeholder="Mobile No" value={oldBikeForm.custMob} onChange={e=>setOldBikeForm({...oldBikeForm,custMob:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/>
                </div>
                <p className="text-blue-400 text-xs font-bold">🏍️ Vehicle & Owner (RC पर नाम)</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Input placeholder="Owner Name (RC)" value={oldBikeForm.owner} onChange={e=>setOldBikeForm({...oldBikeForm,owner:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/>
                  <Input placeholder="Owner Father" value={oldBikeForm.ownerFather} onChange={e=>setOldBikeForm({...oldBikeForm,ownerFather:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/>
                  <Input placeholder="Vehicle *" value={oldBikeForm.veh} onChange={e=>setOldBikeForm({...oldBikeForm,veh:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/>
                  <Input placeholder="Model/Year" value={oldBikeForm.mdl} onChange={e=>setOldBikeForm({...oldBikeForm,mdl:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/>
                  <Input placeholder="Reg No" value={oldBikeForm.regNo} onChange={e=>setOldBikeForm({...oldBikeForm,regNo:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/>
                  <Input type="number" placeholder="Purchase Price" value={oldBikeForm.psPrice||''} onChange={e=>setOldBikeForm({...oldBikeForm,psPrice:parseFloat(e.target.value)||0})} className="bg-slate-700 border-slate-500 text-white text-sm"/>
                  <Input type="date" placeholder="Purchase Date" value={oldBikeForm.purchaseDate} onChange={e=>setOldBikeForm({...oldBikeForm,purchaseDate:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/>
                </div>
                <p className="text-green-400 text-xs font-bold">📥 जिसको बेची (Buyer)</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Input placeholder="Buyer Name" value={oldBikeForm.buyerName} onChange={e=>setOldBikeForm({...oldBikeForm,buyerName:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/>
                  <Input placeholder="Buyer Father" value={oldBikeForm.buyerFather} onChange={e=>setOldBikeForm({...oldBikeForm,buyerFather:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/>
                  <Input placeholder="Buyer Address" value={oldBikeForm.buyerAdd} onChange={e=>setOldBikeForm({...oldBikeForm,buyerAdd:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/>
                  <Input placeholder="Buyer Mobile" value={oldBikeForm.buyerMob} onChange={e=>setOldBikeForm({...oldBikeForm,buyerMob:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/>
                  <Input placeholder="Buyer Aadhar" value={oldBikeForm.buyerAadhar} onChange={e=>setOldBikeForm({...oldBikeForm,buyerAadhar:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/>
                  <Input type="number" placeholder="Sell Price" value={oldBikeForm.slPrice||''} onChange={e=>setOldBikeForm({...oldBikeForm,slPrice:parseFloat(e.target.value)||0})} className="bg-slate-700 border-slate-500 text-white text-sm"/>
                  <Input type="date" placeholder="Sell Date" value={oldBikeForm.slDate} onChange={e=>setOldBikeForm({...oldBikeForm,slDate:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/>
                  <Input placeholder="Notes" value={oldBikeForm.notes} onChange={e=>setOldBikeForm({...oldBikeForm,notes:e.target.value})} className="bg-slate-700 border-slate-500 text-white text-sm"/>
                </div>
                <div className="flex gap-3 mt-2">
                  <Button onClick={saveOldBike} className="bg-green-600 hover:bg-green-700 text-white font-bold">{editOldBikeId ? 'Update' : 'Save'}</Button>
                  <Button onClick={()=>{setShowOldBikeForm(false);resetOldBikeForm();}} className="bg-slate-600 hover:bg-slate-700 text-white">Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Old Bikes Table */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="bg-gradient-to-r from-orange-700 to-orange-800 py-3">
              <CardTitle className="text-white text-sm">🚲 Old Bikes ({oldBikes.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-700 border-b border-slate-600">
                    <tr>{['#','Seller','Vehicle','Reg No','PS Price','Buyer','SL Price','Status','Actions'].map(h=>
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-bold text-slate-300">{h}</th>
                    )}</tr>
                  </thead>
                  <tbody>
                    {oldBikes.length === 0 ? (
                      <tr><td colSpan="9" className="px-6 py-8 text-center text-slate-500">कोई old bike नहीं। Excel Import (OLD BIKE sheet) या Add करें।</td></tr>
                    ) : oldBikes.slice((oldBikePage-1)*10,oldBikePage*10).map((b,i) => (
                      <tr key={b.id} className={`border-b border-slate-700 hover:bg-slate-700/50 ${i%2?'bg-slate-800/30':''}`}>
                        <td className="px-3 py-2 text-slate-500 text-xs">{(oldBikePage-1)*10+i+1}</td>
                        <td className="px-3 py-2 text-white font-bold text-xs">{b.custName}<br/><span className="text-slate-400 font-normal">{b.custMob||''}</span></td>
                        <td className="px-3 py-2 text-blue-300 text-xs">{b.veh} <span className="text-slate-500">{b.mdl}</span></td>
                        <td className="px-3 py-2 text-slate-400 text-xs font-mono">{b.regNo||'—'}</td>
                        <td className="px-3 py-2 text-yellow-400 text-xs font-bold">₹{(b.psPrice||0).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-green-300 text-xs">{b.buyerName||<span className="text-slate-600">—</span>}</td>
                        <td className="px-3 py-2 text-green-400 text-xs font-bold">{b.slPrice ? '₹'+(b.slPrice||0).toLocaleString('en-IN') : '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${b.status==='Sold'?'bg-red-900 text-red-300':b.status==='Reserved'?'bg-yellow-900 text-yellow-300':'bg-green-900 text-green-300'}`}>{b.status||'Available'}</span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={()=>setViewOldBike(b)} className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded text-xs">👁</button>
                            <button onClick={()=>editOldBike(b)} className="bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-0.5 rounded text-xs">✏️</button>
                            {isAdmin ? (
                              <button onClick={()=>deleteOldBike(b.id)} className="bg-red-700 hover:bg-red-600 text-white px-2 py-0.5 rounded text-xs">🗑</button>
                            ) : (
                              <button disabled className="bg-gray-600 text-gray-400 px-2 py-0.5 rounded text-xs cursor-not-allowed">🔒</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {Math.ceil(oldBikes.length/10) > 1 && (
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-700/50 border-t border-slate-600">
                  <span className="text-xs text-slate-400">Page {oldBikePage} of {Math.ceil(oldBikes.length/10)} — {oldBikes.length} bikes</span>
                  <div className="flex gap-2">
                    <Button onClick={()=>setOldBikePage(p=>Math.max(1,p-1))} disabled={oldBikePage===1}
                      className="bg-blue-600 text-white h-7 px-3 text-xs disabled:opacity-40">◀ Previous</Button>
                    <Button onClick={()=>setOldBikePage(p=>Math.min(Math.ceil(oldBikes.length/10),p+1))} disabled={oldBikePage>=Math.ceil(oldBikes.length/10)}
                      className="bg-blue-600 text-white h-7 px-3 text-xs disabled:opacity-40">Next ▶</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}