import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Edit, Download, Send, Save, Phone } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { api } from '../utils/apiConfig';


export default function QuotationPage({ user }) {
  const [quotations, setQuotations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedPaymentType, setSelectedPaymentType] = useState('CASH');
  
  // ── Logged-in staff का नाम और फोन auto-detect ──────────────────────────
  const getCurrentUser = () => {
    try {
      // user prop direct pass हुआ हो तो उसे use करें
      if (user && user.role === 'staff' && user.staffId) {
        const staffData = JSON.parse(localStorage.getItem('staffData') || '[]');
        const staff = staffData.find(s => String(s.id) === String(user.staffId));
        if (staff) return { name: staff.name, phone: staff.phone || '9713394738' };
        return { name: user.name, phone: '9713394738' };
      }
      if (user && user.role === 'admin') {
        return { name: 'Propriter', phone: '9713394738' };
      }

      // vpSession से check करें (LoginPage saves this)
      const session = localStorage.getItem('vpSession');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed.role === 'staff' && parsed.staffId) {
          const staffData = JSON.parse(localStorage.getItem('staffData') || '[]');
          const staff = staffData.find(s => String(s.id) === String(parsed.staffId));
          if (staff) return { name: staff.name, phone: staff.phone || '9713394738' };
          return { name: parsed.name, phone: '9713394738' };
        }
        if (parsed.role === 'admin') {
          return { name: 'Propriter', phone: '9713394738' };
        }
      }
      // vpStaffSession fallback
      const staffSession = localStorage.getItem('vpStaffSession');
      if (staffSession) {
        const parsed = JSON.parse(staffSession);
        const staffData = JSON.parse(localStorage.getItem('staffData') || '[]');
        const staff = staffData.find(s => String(s.id) === String(parsed.id));
        if (staff) return { name: staff.name, phone: staff.phone || '9713394738' };
        return { name: parsed.name || 'Propriter', phone: '9713394738' };
      }
    } catch {}
    return {
      name: localStorage.getItem('salesmanName') || 'Propriter',
      phone: localStorage.getItem('salesmanPhone') || '9713394738'
    };
  };

  const [currentUser] = useState(() => getCurrentUser());

  const vehicleDatabase = {
    'Activa 110 STD OBD 2B': { exShowroomPrice: 76946, registrationAmount: 10130, insurance: 6155, hypothecation: 800 },
    'Activa 110 DLX OBD 2B': { exShowroomPrice: 87224, registrationAmount: 10952, insurance: 6270, hypothecation: 800 },
    'Activa 110 DLX -AE OBD 2B': { exShowroomPrice: 86452, registrationAmount: 10891, insurance: 6261, hypothecation: 800 },
    'Activa 110 DIO STD OBD 2B': { exShowroomPrice: 73076, registrationAmount: 9820, insurance: 6111, hypothecation: 800 },
    'Activa 110 DIO DLX OBD 2B': { exShowroomPrice: 85128, registrationAmount: 10785, insurance: 6247, hypothecation: 800 },
    'Activa 125 DISC OBD 2B': { exShowroomPrice: 92341, registrationAmount: 11362, insurance: 6328, hypothecation: 800 },
    'Activa 125 DISC-AE OBD 2B': { exShowroomPrice: 91570, registrationAmount: 11300, insurance: 6319, hypothecation: 800 },
    'Activa 125 SMART OBD 2B': { exShowroomPrice: 96785, registrationAmount: 11717, insurance: 6378, hypothecation: 800 },
    'SHINE 100 STD OBD 2B': { exShowroomPrice: 65390, registrationAmount: 9206, insurance: 6024, hypothecation: 800 },
    'SHINE 100 DX OBD 2B': { exShowroomPrice: 70196, registrationAmount: 9590, insurance: 6078, hypothecation: 800 },
    'LIVO 110 DRUM OBD 2B': { exShowroomPrice: 78243, registrationAmount: 10234, insurance: 6169, hypothecation: 800 },
    'LIVO 110 DISC OBD 2B': { exShowroomPrice: 80810, registrationAmount: 10439, insurance: 6198, hypothecation: 800 },
    'SHINE 125 DRUM OBD 2B': { exShowroomPrice: 80582, registrationAmount: 10421, insurance: 6196, hypothecation: 800 },
    'SHINE 125 DISC OBD 2B': { exShowroomPrice: 84942, registrationAmount: 10770, insurance: 6245, hypothecation: 800 },
    'SHINE 125 DISC-AE OBD 2B': { exShowroomPrice: 85942, registrationAmount: 10850, insurance: 6256, hypothecation: 800 },
    'SP 125 DRUM OBD 2B': { exShowroomPrice: 88867, registrationAmount: 11084, insurance: 6289, hypothecation: 800 },
    'SP 125 DISC OBD 2B': { exShowroomPrice: 96455, registrationAmount: 11691, insurance: 6374, hypothecation: 800 },
    'SP 125 DISC-AE OBD 2B': { exShowroomPrice: 94409, registrationAmount: 11527, insurance: 6210, hypothecation: 800 },
    'SP 160 1- DISC OBD 2B': { exShowroomPrice: 116648, registrationAmount: 13306, insurance: 10812, hypothecation: 800 },
    'SP 160 2- DISC OBD 2B': { exShowroomPrice: 122158, registrationAmount: 13747, insurance: 10877, hypothecation: 800 },
    'HORNET 125 DLX 2B': { exShowroomPrice: 115235, registrationAmount: 13193, insurance: 6586, hypothecation: 800 }
  };

  const accessoriesWithPrices = {
    'Seat Cover': 250, 'Matting': 350, 'Ladies Step': 980, 'Side Stand': 450,
    'Guards': 2500, 'Extended Warranty': 950, 'Helmet': 1500,
    'Sensor Side Stand': 1200, 'Zero Dep': 350, 'Affidavit': 250, 'Activa Guard': 4285
  };

  const [formData, setFormData] = useState({
    quotationNo: '', date: new Date().toISOString().split('T')[0],
    customerName: '', mobile: '', fatherName: '', email: '',
    model: '', type: '', option: '', colour: '',
    cash: { exShowroomPrice: 0, registrationAmount: 0, insurance: 0},
    finance: { exShowroomPrice: 0, registrationAmount: 0, insurance: 0, hypothecation: 0, accessoriesAmount: 0 },
    dd: { exShowroomPrice: 0, registrationAmount: 0, insurance: 0, hypothecation: 0, accessoriesAmount: 0 },
    accessories: [
      { name: 'Seat Cover', type: 'free', price: 0 },
      { name: 'Matting', type: 'free', price: 0 },
      { name: 'Ladies Step', type: 'free', price: 0 },
      { name: 'Side Stand', type: 'free', price: 0 },
      { name: 'Guards', type: 'free', price: 0 },
      { name: 'Extended Warranty', type: 'free', price: 0 },
      { name: 'Helmet', type: 'free', price: 0 },
      { name: 'Sensor Side Stand', type: 'free', price: 0 },
      { name: 'Zero Dep', type: 'free', price: 0 },
      { name: 'Affidavit', type: 'free', price: 0 },
      { name: 'Activa Guard', type: 'free', price: 0 }

    ],
    address: '', locality: '', "C/O, S/O, W/O": '', pin: '', expectedDate: '',
    dist: 'Bhopal', priceType: 'Retail', enquirySource: 'ShowRoom', testRide: 'No',
    status: 'Hot', bookingPeriod: '', remarks: '', followupDate: '', followUpDates: [],
    accountNo: '43679689022', accountName: 'V P HONDA', bankName: 'State Bank of India'
  });

  const vehicleModels = Object.keys(vehicleDatabase);

  useEffect(() => { loadQuotations(); }, []);

  const loadQuotations = async () => {
    try {
      const saved = localStorage.getItem('quotations');
      if (saved) {
        const parsed = JSON.parse(saved);
        const migrated = parsed.map(q => ({
          ...q,
          cash: q.cash || {},
          finance: q.finance || {},
          dd: q.dd || {},
          accessories: q.accessories || [],
          followUpDates: q.followUpDates || []
        }));
        setQuotations(migrated);
        localStorage.setItem('quotations', JSON.stringify(migrated));
      }
    } catch (e) { console.error('Error:', e); }
  };

  const saveQuotations = (data) => {
    try { localStorage.setItem('quotations', JSON.stringify(data)); } catch (e) { console.error('Error:', e); }
    // Sync to MongoDB
    fetch(api('/api/quotations/sync'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quotations: data }),
    }).catch(e => console.log('Quotation sync failed:', e.message));
  };

  const generateQuotationNo = () => 'ENQ-' + new Date().getFullYear() + '-' + String(quotations.length + 1).padStart(4, '0');

  const handleModelSelect = (model) => {
    
    const vehicleData = vehicleDatabase[model];
    if (vehicleData) {
      setFormData({
        ...formData, model: model,
        cash: { ...formData.cash, ...vehicleData },
        finance: { ...formData.finance, ...vehicleData },
        dd: { ...formData.dd, ...vehicleData }
      });
    }
  };

  const calculateTotalPrice = (quotation, paymentType) => {
    if (!quotation || !paymentType) return 0;
    const type = paymentType.toLowerCase();
    const pricing = quotation[type] || quotation.cash;
    if (!pricing) return 0;

    let total = (parseInt(pricing.exShowroomPrice) || 0) + (parseInt(pricing.registrationAmount) || 0) + 
           (parseInt(pricing.insurance) || 0);
    if (paymentType.toUpperCase() !== 'CASH') {
       total += (parseInt(pricing.hypothecation) || 0);
    }

    return total;
  };

  const calculateAccessoriesTotal = (accessories) => accessories.reduce((total, acc) => total + (acc.price || 0), 0);

  const handleAccessoryTypeChange = (idx, type) => {
    const updated = [...formData.accessories];
    updated[idx].type = type;
    updated[idx].price = type === 'paid' ? accessoriesWithPrices[updated[idx].name] : 0;
    setFormData({...formData, accessories: updated});
  };
  
  const handleFollowUpWithCall = (quotation) => {
    if (!quotation.mobile) {
       alert("Mobile number not found");
       return;
     }

     window.location.href = `tel:${quotation.mobile}`;

     const confirmSave = confirm("Call done? Save follow-up?");
     if (confirmSave) {
       handleFollowUp(quotation);
     }
   };

  const handleFollowUp = (quotation) => {
    const today = new Date().toISOString().split('T')[0];
    const updatedQuotations = quotations.map(q => {
      if (q.id === quotation.id) {
        const updatedFollowUpDates = [...(q.followUpDates || [])];
        if (!updatedFollowUpDates.includes(today)) {
          updatedFollowUpDates.push(today);
        }
        return { ...q, followUpDates: updatedFollowUpDates };
      }
      return q;
    });
    setQuotations(updatedQuotations);
    saveQuotations(updatedQuotations);
    alert(`✅ Follow-up recorded on ${today}`);
  };

  const handleSaveQuotation = () => {
    if (!formData.customerName || !formData.mobile || !formData.model) {
      alert('कृपया नाम, मोबाइल और मॉडल भरें'); return;
    }
    const accessoriesTotal = calculateAccessoriesTotal(formData.accessories);
    const updatedFormData = {
      ...formData,
      cash: { ...formData.cash, accessoriesAmount: accessoriesTotal },
      finance: { ...formData.finance, accessoriesAmount: accessoriesTotal },
      dd: { ...formData.dd, accessoriesAmount: accessoriesTotal }
    };
    const quotation = {
      id: editingId || Date.now(), ...updatedFormData,
      quotationNo: editingId ? formData.quotationNo : generateQuotationNo(),
      selectedPaymentType: selectedPaymentType,
      salesmanName: currentUser.name, salesmanPhone: currentUser.phone,
      createdAt: new Date().toISOString()
    };
    let updated = editingId ? quotations.map(q => q.id === editingId ? quotation : q) : [...quotations, quotation];
    setQuotations(updated);
    saveQuotations(updated);
    resetForm();
    setShowForm(false);
    alert('✅ Quotation save हो गया');
  };

  const resetForm = () => {
    setFormData({
      quotationNo: '', date: new Date().toISOString().split('T')[0],
      customerName: '', mobile: '', fatherName: '', email: '',
      model: '', type: '', option: '', colour: '',
      cash: { exShowroomPrice: 0, registrationAmount: 0, insurance: 0  },
      finance: { exShowroomPrice: 0, registrationAmount: 0, insurance: 0, hypothecation: 0  },
      dd: { exShowroomPrice: 0, registrationAmount: 0, insurance: 0, hypothecation: 0 },
      accessories: [
        { name: 'Seat Cover', type: 'free', price: 0 },
        { name: 'Matting', type: 'free', price: 0 },
        { name: 'Ladies Step', type: 'free', price: 0 },
        { name: 'Side Stand', type: 'free', price: 0 },
        { name: 'Guards', type: 'free', price: 0 },
        { name: 'Extended Warranty', type: 'free', price: 0 },
        { name: 'Helmet', type: 'free', price: 0 },
        { name: 'Sensor Side Stand', type: 'free', price: 0 },
        { name: 'Zero Dep', type: 'free', price: 0 },
        { name: 'Affidavit', type: 'free', price: 0 },
        { name: 'Activa Guard', type: 'free', price: 0 }
      ],
      address: '', locality:  '', pin: '', expectedDate: '',
      dist: 'Bhopal', priceType: 'Retail', enquirySource: 'ShowRoom', testRide: 'No',
      status: 'Hot', bookingPeriod: '', remarks: '', followupDate: '', followUpDates: [],
      accountNo: '43679689022', accountName: 'V P HONDA', bankName: 'State Bank of India'
    });
    setEditingId(null);
    setSelectedPaymentType('CASH');
  };

  const handleEditQuotation = (quotation) => {
    setFormData(quotation);
    setEditingId(quotation.id);
    setSelectedPaymentType(quotation.selectedPaymentType || 'CASH');
    setShowForm(true);
  };

  const handleDeleteQuotation = (id) => {
    if (window.confirm('क्या आप इस quotation को delete करना चाहते हैं?')) {
      const updated = quotations.filter(q => q.id !== id);
      setQuotations(updated);
      saveQuotations(updated);
    }
  };

  const generatePDF = (quotation, paymentType = 'CASH') => {
    const element = document.createElement('div');
    const totalPrice = calculateTotalPrice(quotation, paymentType);
    const accessoriesTotal = calculateAccessoriesTotal(quotation.accessories);
    
    const paidAccessories = quotation.accessories.filter(a => a.type === 'paid');
    const freeAccessories = quotation.accessories.filter(a => a.type === 'free');
    
    const maxAccessoriesRows = Math.max(paidAccessories.length, freeAccessories.length, 5);
    
    element.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 2px; font-size: 12px; line-height: 1.2;">
        
        <div style="text-align: center; margin-bottom: 2px;">
          <h2 style="margin: 0; font-size: 12px; font-weight: bold; font-family: Arial;">ENQUIRY/QUOTATION</h2>
        </div>
        <br>  </br>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2px; font-family: Arial; font-size: 12px;">
          <tr>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; width: 25%; vertical-align: middle; line-height : 2.1;">ENQUIRY/QUOTATION No.:</td>
            <td style="border: 0.2px solid #000; padding: 2px; width: 25%; vertical-align: middle; line-height : 2.1;">${quotation.quotationNo}</td>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; width: 25%; vertical-align: middle; line-height : 2.1;">Date:</td>
            <td style="border: 0.2px solid #000; padding: 2px; width: 25%; vertical-align: middle; line-height : 2.1;">${quotation.date}</td>
          </tr>
          
        </table>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2px; font-family: Arial; font-size: 12px;">
          <tr>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; width: 15%; vertical-align: middle; line-height : 2.1;">Name:</td>
            <td style="border: 0.2px solid #000; padding: 2px; width: 35%; vertical-align: middle; line-height : 2.1;">${quotation.customerName}</td>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; width: 15%; vertical-align: middle; line-height : 2.1;">Model:</td>
            <td style="border: 0.2px solid #000; padding: 2px; width: 35%; vertical-align: middle; line-height : 2.1;">${quotation.model}</td>
          </tr>
            <tr>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; vertical-align: middle; line-height : 2.1;">FatherName:</td>
            <td style="border: 0.2px solid #000; padding: 2px; vertical-align: middle; line-height : 2.1;">${quotation.fatherName}</td>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; vertical-align: middle; line-height : 2.1;">Colour:</td>
            <td style="border: 0.2px solid #000; padding: 2px; vertical-align: middle; line-height : 2.1;">${quotation.colour}</td>
          </tr>
          <tr>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; vertical-align: middle; line-height : 2.1;">Mobile:</td>
            <td style="border: 0.2px solid #000; padding: 2px; vertical-align: middle; line-height : 2.1;">${quotation.mobile}</td>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; vertical-align: middle; line-height : 2.1;">Type:</td>
            <td style="border: 0.2px solid #000; padding: 2px; vertical-align: middle; line-height : 2.1;">${quotation.type}</td>
          </tr>
          
        </table>
         <br> </br>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2px; font-family: Arial; font-size: 12px;">
          <tr style="background-color: #d9d9d9;">
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; width: 40%; vertical-align: middle; line-height : 2.1;">PARTICULARS</td>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; text-align: center; width: 20%; vertical-align: middle; line-height : 2.1;">CASH</td>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; text-align: center; width: 20%; vertical-align: middle; line-height : 2.1;">FINANCE</td>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; text-align: center; width: 20%; vertical-align: middle; line-height : 2.1;">DD</td>
          </tr>
          <tr>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; vertical-align: middle; line-height : 2.1;">Ex Showroom Price</td>
            <td style="border: 0.2px solid #000; padding: 2px; text-align: center; vertical-align: middle; line-height : 2.1;">${paymentType === 'CASH' ? quotation.cash.exShowroomPrice : ''}</td>
            <td style="border: 0.2px solid #000; padding: 2px; text-align: center; vertical-align: middle; line-height : 2.1;">${paymentType === 'FINANCE' ? quotation.finance.exShowroomPrice : ''}</td>
            <td style="border: 0.2px solid #000; padding: 2px; text-align: center; vertical-align: middle; line-height : 2.1;">${paymentType === 'DD' ? quotation.dd.exShowroomPrice : ''}</td>
          </tr>
          <tr>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; vertical-align: middle; line-height : 2.1;">Registration</td>
            <td style="border: 0.2px solid #000; padding: 2px; text-align: center; vertical-align: middle; line-height : 2.1;">${paymentType === 'CASH' ? quotation.cash.registrationAmount : ''}</td>
            <td style="border: 0.2px solid #000; padding: 2px; text-align: center; vertical-align: middle; line-height : 2.1;">${paymentType === 'FINANCE' ? quotation.finance.registrationAmount : ''}</td>
            <td style="border: 0.2px solid #000; padding: 2px; text-align: center; vertical-align: middle; line-height : 2.1;">${paymentType === 'DD' ? quotation.dd.registrationAmount : ''}</td>
          </tr>
          <tr>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; vertical-align: middle; line-height : 2.1;">Insurance</td>
            <td style="border: 0.2px solid #000; padding: 2px; text-align: center; vertical-align: middle; line-height : 2.1;">${paymentType === 'CASH' ? quotation.cash.insurance : ''}</td>
            <td style="border: 0.2px solid #000; padding: 2px; text-align: center; vertical-align: middle; line-height : 2.1;">${paymentType === 'FINANCE' ? quotation.finance.insurance : ''}</td>
            <td style="border: 0.2px solid #000; padding: 2px; text-align: center; vertical-align: middle; line-height : 2.1;">${paymentType === 'DD' ? quotation.dd.insurance : ''}</td>
          </tr>
          <tr>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; vertical-align: middle; line-height : 2.1;">Hypothecation</td>
            <td style="border: 0.2px solid #000; padding: 2px; text-align: center; vertical-align: middle; line-height : 2.1;">${paymentType === 'CASH' ? quotation.cash: ''}</td>
            <td style="border: 0.2px solid #000; padding: 2px; text-align: center; vertical-align: middle; line-height : 2.1;">${paymentType === 'FINANCE' ? quotation.finance.hypothecation : ''}</td>
            <td style="border: 0.2px solid #000; padding: 2px; text-align: center; vertical-align: middle; line-height : 2.1;">${paymentType === 'DD' ? quotation.dd.hypothecation : ''}</td>
          </tr>
          
          <tr style="background-color: #ffeb3b;">
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; vertical-align: middle; line-height : 2.1;">On Road Price</td>
            <td style="border: 0.2px solid #000; padding: 2px; text-align: center; font-weight: bold; vertical-align: middle; line-height : 2.1;">${paymentType === 'CASH' ? totalPrice : ''}</td>
            <td style="border: 0.2px solid #000; padding: 2px; text-align: center; font-weight: bold; vertical-align: middle; line-height : 2.1;">${paymentType === 'FINANCE' ? totalPrice : ''}</td>
            <td style="border: 0.2px solid #000; padding: 2px; text-align: center; font-weight: bold; vertical-align: middle; line-height : 2.1;">${paymentType === 'DD' ? totalPrice : ''}</td>
          </tr>
         </table>       
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 2px; font-family: Arial; font-size: 11px;">
          <tr style="background-color: #d0d0d0;">
            <td colspan="3" style="border: 0.2px solid #000; padding: 2px; font-weight: bold; text-align: center; vertical-align: middle; line-height : 2.1;">PAID ACCESSORIES</td>
            <td colspan="3" style="border: 0.2px solid #000; padding: 2px; font-weight: bold; text-align: center; vertical-align: middle; line-height : 2.1;">FREE ACCESSORIES</td>
          </tr>
          <tr style="background-color: #e8e8e8;">
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; vertical-align: middle; line-height : 2.1;">Item</td>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; text-align: center; width: 10%; vertical-align: middle; line-height : 2.1;">Qty</td>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; text-align: center; width: 12%; vertical-align: middle; line-height : 2.1;">Amount</td>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; vertical-align: middle; line-height : 2.1;">Item</td>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; text-align: center; width: 10%; vertical-align: middle; line-height : 2.1;">Qty</td>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; text-align: center; width: 12%; vertical-align: middle; line-height : 2.1;">Type</td>
          </tr>
          ${Array.from({length: maxAccessoriesRows}).map((_, idx) => `
          <tr>
            <td style="border: 0.2px solid #000; padding: 2px; vertical-align: middle; line-height : 2.1;">${paidAccessories[idx] ? paidAccessories[idx].name : ''}</td>
            <td style="border: 0.2px solid #000; padding: 2px; text-align: center; vertical-align: middle; line-height : 2.1;">${paidAccessories[idx] ? '1' : ''}</td>
            <td style="border: 0.2px solid #000; padding: 2px; text-align: center; vertical-align: middle; line-height : 2.1;">${paidAccessories[idx] ? '₹' + paidAccessories[idx].price : ''}</td>
            <td style="border: 0.2px solid #000; padding: 2px; vertical-align: middle; line-height : 2.1;">${freeAccessories[idx] ? freeAccessories[idx].name : ''}</td>
            <td style="border: 0.2px solid #000; padding: 2px; text-align: center; vertical-align: middle; line-height : 2.1;">${freeAccessories[idx] ? '1' : ''}</td>
            <td style="border: 0.2px solid #000; padding: 2px; text-align: center; color: green; font-weight: bold; vertical-align: middle; line-height : 2.1;">${freeAccessories[idx] ? 'FREE' : ''}</td>
          </tr>
          `).join('')}
          <tr style="background-color: #fffacd;">
            <td colspan="2" style="border: 0.2px solid #000; padding: 2px; font-weight: bold; text-align: right; vertical-align: middle; line-height : 2.1;">Accessories Total:</td>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; text-align: center; vertical-align: middle; line-height : 2.1;">₹${accessoriesTotal}</td>
            <td colspan="3" style="border: 0.2px solid #000; padding: 0;"></td>
          </tr>
          <br> </br>
          <tr style="background-color: #ffeb3b;">
            <td colspan="2" style="border: 0.2px solid #000; padding: 2px; font-weight: bold; text-align: right; vertical-align: middle; line-height : 2.1;">GRAND TOTAL:</td>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; text-align: center; vertical-align: middle; line-height : 2.1;">₹${totalPrice}+₹${accessoriesTotal}</td>
            <td colspan="3" style="border: 0.2px solid #000; padding: 0;"></td>
          </tr>
        </table>
         <br> </br>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2px; font-family: Arial; font-size: 11px;">
          <tr>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; width: 25%; vertical-align: middle; line-height : 2.1;">Booking: ${quotation.bookingPeriod} Days</td>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; width: 25%; vertical-align: middle; line-height : 2.1;">Expacted Date: ${quotation.expectedDate}</td>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; width: 25%; vertical-align: middle; line-height : 2.1;">Dist: ${quotation.dist}</td>
          </tr>
          <tr>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; width: 25%; vertical-align: middle; line-height : 2.1;">Address: ${quotation.address}</td>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; width: 25%; vertical-align: middle; line-height : 2.1;">Locality: ${quotation.locality}</td>
            
          </tr>
          <tr>
            <td colspan="4" style="border: 0.2px solid #000; padding: 2px; vertical-align: middle; line-height : 2.1;">Remarks: ${quotation.remarks}</td>
          </tr>
        </table>
         <br> </br>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2px; font-family: Arial; font-size: 11px;">
          <tr>
            <td style="width: 33%; border: 0.2px solid #000; padding: 2px; vertical-align: top;">
              <div style="background-color: #f5f5f5; padding: 2px; border-bottom: 0.2px solid #000; font-weight: bold; text-align: center; font-size: 11px; vertical-align: middle; line-height : 2.1;">RTO दस्तावेज</div>
              <div style="padding: 2px; line-height: 1.3; font-size: 10px;">
                ☐ PAN Card<br>☐ Voter ID<br>☐ Aadhar Card<br>☐ D.License
              </div>
            </td>
            <td style="width: 33%; border: 0.2px solid #000; padding: 2px; vertical-align: top;">
              <div style="background-color: #f5f5f5; padding: 2px; border-bottom: 0.2px solid #000; font-weight: bold; text-align: center; font-size: 11px; vertical-align: middle; line-height : 2.1;">Finance दस्तावेज</div>
              <div style="padding: 2px; line-height: 1.3; font-size: 10px;">
                ☐ Salary Slip<br>☐ Aadhar Card<br>☐ PAN Card<br>☐ Bank Stmt<br>☐ Pass Book
              </div>
            </td>
            <td style="width: 34%; border: 0.2px solid #000; padding: 2px; vertical-align: top; background-color: #fffacd; text-align: left;">
              <div style="font-weight: bold; font-size: 14px; margin-bottom: 2px;">V P HONDA ACCOUNT DETAILS </div>
              <div style="font-size: 10px; line-height: 1.3;">
                Branch : Parwaliya Sadak, Bhopal (M.P.) <br>Stat Bank Of India <br>Account No: 43679689022 <br>IFSC Code: SBIN0018080 <br>Mob No: 9713394738
              </div>
            </td>
          </tr>
        </table>
         <br> </br>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2px; font-family: Arial; font-size: 11px;">
          <tr style="background-color: #fff8dc;">
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; text-align: center; width: 50%; vertical-align: middle; line-height : 2.1;">Salesman:    ${quotation.salesmanName}</td>
            <td style="border: 0.2px solid #000; padding: 2px; font-weight: bold; text-align: center; width: 50%; vertical-align: middle; line-height : 2.1;">Phone:     ${quotation.salesmanPhone}</td>
          </tr>
        </table>
         
        <div style="padding: 2px; border: 0.2px solid #000; text-align: left; background-color: #ffe4e1; font-family: Arial; font-size: 11px; font-weight: bold; vertical-align: middle; line-height : 2.1;">
          NOTE: Bring this copy next time you visit
        </div>
                                                                                                                                    Thanks Visit Again
      </div>
    `;
     
    const options = {
      margin: [3, 3, 3, 3],
      filename: `quotation-${quotation.quotationNo}-${paymentType}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    };

    return new Promise((resolve) => {
      html2pdf().set(options).from(element).save().then(() => { resolve(); });
    });
  };

  const sendViaWhatsApp = async (quotation, paymentType) => {
    try {
      await generatePDF(quotation, paymentType);
      const message = `*V P HONDA - ${paymentType} Quotation*\n\n📋 Quotation No: ${quotation.quotationNo}\n👤 Customer: ${quotation.customerName}\n🏍️ Model: ${quotation.model}\n💵 Price: ₹${calculateTotalPrice(quotation, paymentType).toLocaleString('en-IN')}\n\nPlease find attached.\n\nThanks,\n${quotation.salesmanName}\n${quotation.salesmanPhone}`;
      const whatsappUrl = `https://wa.me/${quotation.mobile}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      alert('✅ PDF download हो गई है!\n\n📱 WhatsApp खुल गया है।');
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error हुई।');
    }
  };

  const filteredQuotations = filterStatus === 'all' ? quotations : quotations.filter(q => q.status === filterStatus);
  const [qSearch, setQSearch] = useState('');
  const [qPage, setQPage] = useState(0);
  const QPS = 5;
  const searchedQ = filteredQuotations.filter(q => !qSearch || [q.customerName,q.mobile,q.model,q.quotationNo].some(v=>(v||'').toLowerCase().includes(qSearch.toLowerCase())));
  const qPages = Math.ceil(searchedQ.length/QPS);
  const pageQ = searchedQ.slice(qPage*QPS,(qPage+1)*QPS);
  const totalValue = quotations.reduce((s,q) => s+calculateTotalPrice(q, q.selectedPaymentType||'CASH'), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* HEADER */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">📋 Quotation System</h1>
            <p className="text-slate-400 text-xs">CASH • FINANCE • DD</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-indigo-900/40 border border-indigo-600 rounded-lg px-3 py-1.5 text-xs">
              <p className="text-indigo-300 font-bold">👤 {currentUser.name}</p>
              <p className="text-indigo-500 text-[10px]">📞 {currentUser.phone}</p>
            </div>
            <Button onClick={() => { resetForm(); setShowForm(true); }} className="bg-green-600 hover:bg-green-500 text-white font-bold h-9 px-4 text-sm">
              <Plus size={16} className="mr-1"/> नया Quotation
            </Button>
          </div>
        </div>

        {/* KPIs */}
        {!showForm && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              {l:'Total',v:quotations.length,c:'text-blue-400',bg:'bg-blue-900/20 border-blue-700'},
              {l:'🔴 Hot',v:quotations.filter(q=>q.status==='Hot').length,c:'text-red-400',bg:'bg-red-900/20 border-red-700'},
              {l:'🟡 Warm',v:quotations.filter(q=>q.status==='Warm').length,c:'text-yellow-400',bg:'bg-yellow-900/20 border-yellow-700'},
              {l:'🟢 Cold',v:quotations.filter(q=>q.status==='Cold').length,c:'text-green-400',bg:'bg-green-900/20 border-green-700'},
              {l:'💰 Value',v:'₹'+totalValue.toLocaleString('en-IN'),c:'text-emerald-400',bg:'bg-emerald-900/20 border-emerald-700'},
            ].map((k,i) => (
              <div key={i} className={`${k.bg} border rounded-xl p-3`}>
                <p className="text-slate-400 text-[10px] font-bold">{k.l}</p>
                <p className={`${k.c} font-black text-xl mt-0.5`}>{k.v}</p>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <Card className="bg-slate-800 border-slate-700 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-indigo-600 to-indigo-700">
              <CardTitle className="text-white text-lg">{editingId ? '✏️ Edit' : '➕ नया'} Quotation</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <h3 className="font-bold text-white text-sm mb-3">📄 Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div><label className="text-[10px] font-bold text-slate-400">Quotation No.</label><Input value={formData.quotationNo || generateQuotationNo()} className="mt-1 bg-slate-700 border-slate-500 text-white text-sm" disabled/></div>
                  <div><label className="text-[10px] font-bold text-slate-400">Date</label><Input type="date" value={formData.date} onChange={e=>setFormData({...formData,date:e.target.value})} className="mt-1 bg-slate-700 border-slate-500 text-white text-sm"/></div>
                  <div><label className="text-[10px] font-bold text-slate-400">Expected Date</label><Input type="date" value={formData.expectedDate} onChange={e=>setFormData({...formData,expectedDate:e.target.value})} className="mt-1 bg-slate-700 border-slate-500 text-white text-sm"/></div>
                  <div><label className="text-[10px] font-bold text-slate-400">Status</label><select value={formData.status} onChange={e=>setFormData({...formData,status:e.target.value})} className="mt-1 w-full bg-slate-700 border border-slate-500 text-white text-sm rounded px-2 py-2"><option>Hot</option><option>Warm</option><option>Cold</option></select></div>
                </div>
              </div>
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <h3 className="font-bold text-white text-sm mb-3">👤 Customer</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div><label className="text-[10px] font-bold text-slate-400">Name *</label><Input value={formData.customerName} onChange={e=>setFormData({...formData,customerName:e.target.value})} className="mt-1 bg-slate-700 border-slate-500 text-white text-sm" placeholder="Name"/></div>
                  <div><label className="text-[10px] font-bold text-slate-400">Mobile *</label><Input value={formData.mobile} onChange={e=>setFormData({...formData,mobile:e.target.value})} className="mt-1 bg-slate-700 border-slate-500 text-white text-sm" placeholder="Mobile"/></div>
                  <div><label className="text-[10px] font-bold text-slate-400">Address</label><Input value={formData.address} onChange={e=>setFormData({...formData,address:e.target.value})} className="mt-1 bg-slate-700 border-slate-500 text-white text-sm" placeholder="Address"/></div>
                  <div><label className="text-[10px] font-bold text-slate-400">FatherName</label><Input value={formData.fatherName} onChange={e=>setFormData({...formData,fatherName:e.target.value})} className="mt-1 bg-slate-700 border-slate-500 text-white text-sm" placeholder="FatherName"/></div>
                  <div><label className="text-[10px] font-bold text-slate-400">District</label><select value={formData.district} onChange={(e)=>setFormData({...formData, district: e.target.value})} className="mt-1 w-full bg-slate-700 border border-slate-500 text-white text-sm rounded px-2 py-2"><option>Bhopal</option><option>Sehore</option><option>Raisen</option><option>Rajgarh</option></select></div>
                  <div><label className="text-[10px] font-bold text-slate-400">Enquiry Source</label><select value={formData.enquirySource} onChange={(e)=>setFormData({...formData, enquirySource: e.target.value})} className="mt-1 w-full bg-slate-700 border border-slate-500 text-white text-sm rounded px-2 py-2"><option>ShowRoom</option><option>Walking</option><option>Social Media</option><option>Village Activity</option><option>Road Activity</option><option>Hatt/Bazar Activity</option><option>Gajibo Activity</option><option>Web Site</option><option>Phone</option></select></div>
                  <div><label className="text-[10px] font-bold text-slate-400">Locality</label><Input value={formData.locality} onChange={e=>setFormData({...formData,locality:e.target.value})} className="mt-1 bg-slate-700 border-slate-500 text-white text-sm" placeholder="Locality"/></div>
                  <div><label className="text-[10px] font-bold text-slate-400">Colour</label><Input value={formData.colour} onChange={e=>setFormData({...formData,colour:e.target.value})} className="mt-1 bg-slate-700 border-slate-500 text-white text-sm" placeholder="Colour"/></div>
                  <div><label className="text-[10px] font-bold text-slate-400">Type</label><select value={formData.type} onChange={(e)=>setFormData({...formData, type: e.target.value})} className="mt-1 w-full bg-slate-700 border border-slate-500 text-white text-sm rounded px-2 py-2"><option>DISC</option><option>DRUM</option><option>LE</option><option>AE</option></select></div>
                  
                </div>
              </div>
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <h3 className="font-bold text-white text-sm mb-3">🏍️ Vehicle</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><label className="text-[10px] font-bold text-slate-400">Model *</label><select value={formData.model} onChange={e=>handleModelSelect(e.target.value)} className="mt-1 w-full bg-slate-700 border border-slate-500 text-white text-sm rounded px-2 py-2"><option value="">-- Select --</option>{Object.keys(vehicleDatabase).map(m=><option key={m} value={m}>{m}</option>)}</select></div>
                  <div><label className="text-[10px] font-bold text-slate-400">Payment Type</label><select value={selectedPaymentType} onChange={e=>setSelectedPaymentType(e.target.value)} className="mt-1 w-full bg-slate-700 border border-slate-500 text-white text-sm rounded px-2 py-2"><option>CASH</option><option>FINANCE</option><option>DD</option></select></div>
                  
                </div>
                {formData.model && (
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[{l:'Ex-Showroom',k:'exShowroomPrice'},{l:'Registration',k:'registrationAmount'},{l:'Insurance',k:'insurance'},{l:'Hypothecation',k:'hypothecation'}].map((p,i)=>(
                      <div key={i} className="bg-slate-800 rounded p-2"><p className="text-slate-500 text-[9px]">{p.l}</p><Input type="number" value={formData[selectedPaymentType.toLowerCase()]?.[p.k]||0} onChange={e=>setFormData({...formData,[selectedPaymentType.toLowerCase()]:{...formData[selectedPaymentType.toLowerCase()],[p.k]:parseInt(e.target.value)||0}})} className="bg-slate-700 border-slate-600 text-white text-xs h-7 mt-0.5"/></div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <h3 className="font-bold text-white text-sm mb-3">🎁 Accessories</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {formData.accessories.map((a,i)=>(
                    <label key={i} className="flex items-center gap-2 bg-slate-800 rounded p-2 cursor-pointer hover:bg-slate-700 text-xs text-slate-300"><input type="checkbox" checked={a.type=== 'paid'} onChange={()=>handleAccessoryTypeChange(i, a.type === 'free' ? 'paid' : 'free')} className="rounded"/><span>{a.name}</span><span className="ml-auto text-green-400 font-bold">₹{a.price}</span></label>
                  ))}
                </div>
              </div>
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <h3 className="font-bold text-white text-sm mb-3">📝 Other</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div><label className="text-[10px] font-bold text-slate-400">Booking (Days)</label><Input value={formData.bookingPeriod} onChange={e=>setFormData({...formData,bookingPeriod:e.target.value})} className="mt-1 bg-slate-700 border-slate-500 text-white text-sm"/></div>
                  <div><label className="text-[10px] font-bold text-slate-400">Remarks</label><Input value={formData.remarks} onChange={e=>setFormData({...formData,remarks:e.target.value})} className="mt-1 bg-slate-700 border-slate-500 text-white text-sm"/></div>
                  <div><label className="text-[10px] font-bold text-slate-400">Follow-up Date</label><Input type="date" value={formData.followupDate} onChange={e=>setFormData({...formData,followupDate:e.target.value})} className="mt-1 bg-slate-700 border-slate-500 text-white text-sm"/></div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleSaveQuotation} className="bg-green-600 hover:bg-green-500 text-white font-bold px-6"><Save size={16} className="mr-1"/> Save</Button>
                <Button onClick={()=>{setShowForm(false);resetForm();}} className="bg-slate-600 hover:bg-slate-500 text-white px-6">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* FILTERS + SEARCH + CARDS */}
        {!showForm && (<>
          <div className="flex gap-1.5 flex-wrap">
            {[{s:'all',l:`📊 All (${quotations.length})`,bg:'bg-blue-600'},{s:'Hot',l:`🔴 Hot (${quotations.filter(q=>q.status==='Hot').length})`,bg:'bg-red-600'},{s:'Warm',l:`🟡 Warm (${quotations.filter(q=>q.status==='Warm').length})`,bg:'bg-yellow-600'},{s:'Cold',l:`🟢 Cold (${quotations.filter(q=>q.status==='Cold').length})`,bg:'bg-green-600'}].map(f=>(
              <button key={f.s} onClick={()=>{setFilterStatus(f.s);setQPage(0);}} className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${filterStatus===f.s?`${f.bg} text-white shadow-lg`:'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{f.l}</button>
            ))}
          </div>
          <Input value={qSearch} onChange={e=>{setQSearch(e.target.value);setQPage(0);}} placeholder="🔍 Customer, model, phone..." className="bg-slate-800 border-slate-700 text-white placeholder-slate-500 h-8 text-xs"/>

          {searchedQ.length===0 ? (
            <div className="text-center py-12"><p className="text-slate-500 mb-3">कोई Quotation नहीं</p><Button onClick={()=>setShowForm(true)} className="bg-green-600 text-white"><Plus size={16} className="mr-1"/>नया</Button></div>
          ) : (<>
            <p className="text-slate-600 text-[10px]">{searchedQ.length} quotations · Page {qPage+1}/{qPages||1}</p>
            <div className="space-y-2.5">
              {pageQ.map(q => {
                const price = calculateTotalPrice(q, q.selectedPaymentType||'CASH');
                return (
                  <div key={q.id} className={`rounded-xl overflow-hidden border transition-all hover:shadow-lg ${q.status==='Hot'?'bg-gradient-to-r from-red-900/20 to-slate-800 border-red-700/50':q.status==='Warm'?'bg-gradient-to-r from-yellow-900/20 to-slate-800 border-yellow-700/50':'bg-gradient-to-r from-green-900/20 to-slate-800 border-green-700/50'}`}>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2"><span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${q.status==='Hot'?'bg-red-600 text-white':q.status==='Warm'?'bg-yellow-600 text-white':'bg-green-600 text-white'}`}>{q.status}</span><span className="text-white font-bold text-sm">{q.quotationNo}</span></div>
                        <span className="text-slate-500 text-[10px]">{q.date}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                        <div><p className="text-slate-500 text-[9px]">Customer</p><p className="text-cyan-300 font-bold text-sm">{q.customerName}</p></div>
                        <div><p className="text-slate-500 text-[9px]">Model</p><p className="text-blue-300 font-bold text-sm">{q.model}</p></div>
                        <div><p className="text-slate-500 text-[9px]">Price</p><p className="text-green-400 font-black text-sm">₹{price.toLocaleString('en-IN')}</p></div>
                        <div><p className="text-slate-500 text-[9px]">Type</p><p className="text-white font-bold text-sm">{q.selectedPaymentType||'CASH'}</p></div>
                        <div><p className="text-slate-500 text-[9px]">Enquiry</p><p className="text-white font-bold text-sm">{q.enquirySource}</p></div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 mb-3">{q.mobile&&<span>📞 {q.mobile}</span>}{q.dist&&<span>🏘️ {q.dist}</span>}</div>
                      <div className="flex gap-1.5 flex-wrap mb-2">
                        <button onClick={()=>generatePDF(q,q.selectedPaymentType||'CASH')} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1"><Download size={11}/>PDF</button>
                        <button onClick={()=>sendViaWhatsApp(q,q.selectedPaymentType||'CASH')} className="bg-green-600 hover:bg-green-500 text-white text-[10px] px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1"><Send size={11}/>WhatsApp</button>
                        <button onClick={()=>handleEditQuotation(q)} className="bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1"><Edit size={11}/>Edit</button>
                        {(()=>{try{return JSON.parse(localStorage.getItem('vpSession')||'{}').role==='admin';}catch{return false;}})()&&(<button onClick={()=>handleDeleteQuotation(q.id)} className="bg-red-700 hover:bg-red-600 text-white text-[10px] px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1"><Trash2 size={11}/>Delete</button>)}
                        <button onClick={()=>handleFollowUpWithCall(q)} className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1"><Phone size={11}/>Follow Up</button>
                        {q.mobile&&<a href={`tel:${q.mobile}`} className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] px-2.5 py-1.5 rounded-lg font-bold">📞 Call</a>}
                      </div>
                      {q.followUpDates&&q.followUpDates.length>0&&(
                        <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
                          <p className="text-[10px] text-purple-400 font-bold mb-1">📞 Follow-up ({q.followUpDates.length})</p>
                          <div className="flex flex-wrap gap-1.5">{q.followUpDates.map((d,i)=>(<span key={i} className="text-[9px] bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full border border-purple-700/50">{i+1}. {d}</span>))}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {qPages>1&&(<div className="flex items-center justify-between"><span className="text-[10px] text-slate-600">{qPage+1}/{qPages}</span><div className="flex gap-1.5"><button onClick={()=>setQPage(p=>Math.max(0,p-1))} disabled={qPage===0} className="bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded disabled:opacity-30 font-bold">◀</button><button onClick={()=>setQPage(p=>Math.min(qPages-1,p+1))} disabled={qPage>=qPages-1} className="bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded disabled:opacity-30 font-bold">▶</button></div></div>)}
          </>)}
        </>)}
        <p className="text-center text-slate-600 text-[10px]">V P Honda © 2026</p>
      </div>
    </div>
  );
}
