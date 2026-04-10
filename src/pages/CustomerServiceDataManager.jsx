import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Save, ChevronDown, ChevronUp, ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, Clock } from 'lucide-react';
import { api } from '../utils/apiConfig';

const getLS = (key, fb) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const PAGE_SIZE = 5;

export default function CustomerServiceDataManager() {
  const navigate = useNavigate();
  const [customers,          setCustomers]          = useState([]);
  const [expandedCustomers,  setExpandedCustomers]  = useState({});
  const [serviceData,        setServiceData]        = useState({});
  const [message,            setMessage]            = useState('');
  const [filterView,         setFilterView]         = useState('all');
  const [searchTerm,         setSearchTerm]         = useState('');
  const [currentPage,        setCurrentPage]        = useState(0);
  const [lastRefresh,        setLastRefresh]        = useState(new Date());
  const [invoiceCount,       setInvoiceCount]       = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    loadAllData();
    const onStorage = () => loadAllData();
    window.addEventListener('storage', onStorage);
    intervalRef.current = setInterval(() => loadAllData(), 30000);
    return () => { window.removeEventListener('storage', onStorage); clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => { setCurrentPage(0); }, [filterView, searchTerm]);

  const loadAllData = async () => {
    let custData = [];
    try {
      const res = await fetch(api('/api/customers'));
      if (res.ok) custData = await res.json();
    } catch {}
    // Merge localStorage customers
    const lsC = [...getLS('sharedCustomerData',[]), ...getLS('customerData',[])];
    const seen = new Set(custData.map(c => c._id));
    lsC.forEach(c => { if (!seen.has(c._id)) { custData.push(c); seen.add(c._id); } });
    custData.sort((a, b) => new Date(b.createdAt || b._id || 0) - new Date(a.createdAt || a._id || 0));
    setCustomers(custData);

    const savedServiceData = getLS('customerServiceData', {});
    setServiceData(savedServiceData);

    // Invoice count from ALL sources
    const allInv = [...getLS('invoices',[]), ...getLS('generatedInvoices',[]), ...getLS('jobCards',[])];
    setInvoiceCount(allInv.length);
    setLastRefresh(new Date());
  };

  const toggleCustomer = (id) => setExpandedCustomers(prev => ({ ...prev, [id]: !prev[id] }));

  const updateServiceData = (custId, field, value) => {
    setServiceData(prev => ({ ...prev, [custId]: { ...(prev[custId]||{}), [field]: value } }));
  };

  const saveCustomerData = (custId) => {
    try {
      const all = getLS('customerServiceData', {});
      all[custId] = serviceData[custId];
      localStorage.setItem('customerServiceData', JSON.stringify(all));
      window.dispatchEvent(new Event('storage'));
      setMessage('✅ Data saved!');
      setTimeout(() => setMessage(''), 3000);
    } catch { setMessage('❌ Error saving!'); }
  };

  const getDisplayCustomers = () => {
    let result = customers;
    if (filterView === 'with-data')    result = result.filter(c => Object.keys(serviceData).includes(c._id));
    if (filterView === 'without-data') result = result.filter(c => !Object.keys(serviceData).includes(c._id));
    if (filterView === 'with-invoices') {
      const allInv = [...getLS('invoices',[]), ...getLS('generatedInvoices',[]), ...getLS('jobCards',[])];
      const custIds = new Set(allInv.map(i => i.customerId));
      result = result.filter(c => custIds.has(c._id));
    }
    if (searchTerm) result = result.filter(c =>
      (c.name||'').toLowerCase().includes(searchTerm.toLowerCase()) || (c.phone||'').includes(searchTerm)
    );
    return result;
  };

  const allDisplayCustomers = getDisplayCustomers();
  const totalPages = Math.ceil(allDisplayCustomers.length / PAGE_SIZE);
  const pageCustomers = allDisplayCustomers.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const stats = {
    total:       customers.length,
    withData:    Object.keys(serviceData).length,
    withoutData: customers.length - Object.keys(serviceData).length,
    invoices:    invoiceCount,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <Button onClick={() => navigate('/reminders')} className="bg-red-700 hover:bg-red-600 text-white font-bold flex items-center gap-2">
            <ArrowLeft size={18}/> Back
          </Button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">🎯 Customer Service Data Manager</h1>
            <p className="text-slate-400 text-xs flex items-center justify-center gap-1 mt-1">
              <Clock size={11}/> {lastRefresh.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
            </p>
          </div>
          <Button onClick={loadAllData} className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2">
            <RefreshCw size={16}/> Refresh
          </Button>
        </div>

        {message && (
          <Card className={`${message.includes('✅') ? 'bg-green-900/20 border-green-500' : 'bg-red-900/20 border-red-500'}`}>
            <CardContent className="pt-4 pb-4"><p className={message.includes('✅') ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{message}</p></CardContent>
          </Card>
        )}

        {/* FILTER CARDS — सभी clickable */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { view:'all',           label:'Total Customers',     val:stats.total,       col:'blue',   desc:'सभी customers' },
            { view:'with-data',     label:'✅ With Data',         val:stats.withData,    col:'green',  desc:'Service data filled' },
            { view:'without-data',  label:'⏳ Without Data',      val:stats.withoutData, col:'red',    desc:'Data pending' },
            { view:'with-invoices', label:'📄 Total Invoices',    val:stats.invoices,    col:'purple', desc:'Click to filter' },
          ].map(f => (
            <Card key={f.view} onClick={() => { setFilterView(f.view); setCurrentPage(0); }}
              className={`cursor-pointer transition-all hover:scale-105 ${
                filterView===f.view
                  ? `bg-${f.col}-600 border-${f.col}-400 text-white ring-2 ring-white`
                  : `bg-${f.col}-900/20 border-${f.col}-500 text-${f.col}-300 hover:bg-${f.col}-900/40`
              }`}>
              <CardContent className="pt-5 pb-4">
                <p className="text-sm opacity-75">{f.label}</p>
                <h3 className="text-4xl font-black mt-1">{f.val}</h3>
                <p className="text-xs opacity-50 mt-1">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ACTIVE FILTER */}
        {filterView !== 'all' && (
          <div className="bg-slate-700/60 border border-slate-600 p-3 rounded-xl flex items-center justify-between text-sm text-slate-300">
            <span>
              {filterView==='with-data'     && `✅ Data वाले customers: ${stats.withData}`}
              {filterView==='without-data'  && `⏳ बिना data customers: ${stats.withoutData}`}
              {filterView==='with-invoices' && `📄 Invoice customers: दिखाए जा रहे हैं`}
            </span>
            <Button onClick={() => { setFilterView('all'); setCurrentPage(0); }} className="bg-slate-600 hover:bg-slate-500 text-white py-1 px-3 text-xs">Clear</Button>
          </div>
        )}

        {/* SEARCH */}
        <div>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="नाम या फोन से खोजें..."
              className="pl-10 bg-slate-800 border-slate-600 text-white placeholder-slate-500"/>
          </div>
          <p className="text-slate-400 text-xs mt-2">
            {allDisplayCustomers.length} customers · Page {currentPage+1}/{Math.max(1,totalPages)} · प्रत्येक page पर {PAGE_SIZE}
          </p>
        </div>

        {/* CUSTOMER CARDS */}
        <div className="space-y-3">
          {pageCustomers.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6 text-center py-10">
                <p className="text-slate-400">कोई customer नहीं मिला</p>
              </CardContent>
            </Card>
          ) : (
            pageCustomers.map(customer => {
              const custData = serviceData[customer._id] || {};
              const isExpanded = expandedCustomers[customer._id];
              const hasData = Object.keys(custData).length > 0;
              const hasPending = parseFloat(custData.pendingAmount||0) > 0;

              return (
                <Card key={customer._id} className="bg-slate-800 border-slate-700 shadow-lg overflow-hidden">
                  <div className="p-4 cursor-pointer flex items-center justify-between bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 transition"
                    onClick={() => toggleCustomer(customer._id)}>
                    <div className="flex items-center gap-3 flex-1">
                      <div className={isExpanded ? 'text-blue-400' : 'text-slate-400'}>
                        {isExpanded ? <ChevronUp size={22}/> : <ChevronDown size={22}/>}
                      </div>
                      <div>
                        <h3 className="text-white font-bold">{customer.name}</h3>
                        <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-slate-400">
                          <span>📞 {customer.phone}</span>
                          <span>🚗 {customer.linkedVehicle?.regNo || 'N/A'}</span>
                          {hasPending && <span className="text-yellow-400 font-bold">💳 ₹{parseFloat(custData.pendingAmount).toLocaleString('en-IN')} बकाया</span>}
                        </div>
                      </div>
                    </div>
                    <div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${hasData ? 'bg-green-700 text-green-200' : 'bg-orange-800 text-orange-200'}`}>
                        {hasData ? '✅ Filled' : '⏳ Pending'}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <CardContent className="pt-4 space-y-4 bg-slate-800">
                      {/* Customer Info */}
                      <div className="bg-slate-700/50 p-3 rounded-xl">
                        <h4 className="text-white font-bold text-sm mb-2">📱 Customer Details</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                          <div><span className="text-slate-500">Name:</span> {customer.name}</div>
                          <div><span className="text-slate-500">Phone:</span> {customer.phone}</div>
                          <div><span className="text-slate-500">Address:</span> {customer.address || 'N/A'}</div>
                          <div><span className="text-slate-500">Vehicle:</span> {customer.linkedVehicle?.regNo || 'N/A'}</div>
                        </div>
                      </div>

                      {/* Payment */}
                      <div className="bg-green-900/20 border border-green-700 p-4 rounded-xl">
                        <h4 className="text-white font-bold text-sm mb-3">💳 Payment</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-slate-400 text-xs mb-1 block">Outstanding Amount (₹)</label>
                            <Input type="number" value={custData.pendingAmount||''} placeholder="0"
                              onChange={e => updateServiceData(customer._id,'pendingAmount',parseFloat(e.target.value)||0)}
                              className="bg-slate-700 border-slate-600 text-white h-9 text-sm"/>
                          </div>
                          <div>
                            <label className="text-slate-400 text-xs mb-1 block">Payment Due Date</label>
                            <Input type="date" value={custData.paymentDueDate||''}
                              onChange={e => updateServiceData(customer._id,'paymentDueDate',e.target.value)}
                              className="bg-slate-700 border-slate-600 text-white h-9 text-sm"/>
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-slate-400 text-xs mb-1 block">Payment Received Date (भर देने पर reminder बंद होगा)</label>
                            <Input type="date" value={custData.paymentReceivedDate||''}
                              onChange={e => updateServiceData(customer._id,'paymentReceivedDate',e.target.value)}
                              className="bg-slate-700 border-slate-600 text-white h-9 text-sm"/>
                          </div>
                        </div>
                      </div>

                      {/* Insurance */}
                      <div className="bg-purple-900/20 border border-purple-700 p-4 rounded-xl">
                        <h4 className="text-white font-bold text-sm mb-3">🚗 Insurance & RTO</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {[['insuranceDate','Insurance Date'],['rtoDoneDate','RTO Done Date']].map(([f,l]) => (
                            <div key={f}>
                              <label className="text-slate-400 text-xs mb-1 block">{l}</label>
                              <Input type="date" value={custData[f]||''}
                                onChange={e => updateServiceData(customer._id,f,e.target.value)}
                                className="bg-slate-700 border-slate-600 text-white h-9 text-sm"/>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Service */}
                      <div className="bg-orange-900/20 border border-orange-700 p-4 rounded-xl">
                        <h4 className="text-white font-bold text-sm mb-3">🔧 Service Schedule</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {[['firstServiceDate','1st Service'],['secondServiceDate','2nd Service'],['thirdServiceDate','3rd Service']].map(([f,l]) => (
                            <div key={f}>
                              <label className="text-slate-400 text-xs mb-1 block">{l}</label>
                              <Input type="date" value={custData[f]||''}
                                onChange={e => updateServiceData(customer._id,f,e.target.value)}
                                className="bg-slate-700 border-slate-600 text-white h-9 text-sm"/>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Button onClick={() => saveCustomerData(customer._id)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 flex items-center justify-center gap-2">
                        <Save size={18}/> Save Data
                      </Button>
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <Button onClick={() => setCurrentPage(p => Math.max(0,p-1))} disabled={currentPage===0}
                  className="bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-40 flex items-center gap-1 text-sm">
                  <ChevronLeft size={16}/> Previous
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-sm">
                    Page <span className="text-white font-bold">{currentPage+1}</span> of <span className="text-white font-bold">{totalPages}</span>
                  </span>
                  <span className="text-slate-500 text-xs">({allDisplayCustomers.length} total)</span>
                </div>
                <Button onClick={() => setCurrentPage(p => Math.min(totalPages-1,p+1))} disabled={currentPage>=totalPages-1}
                  className="bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-40 flex items-center gap-1 text-sm">
                  Next <ChevronRight size={16}/>
                </Button>
              </div>
              {/* Page numbers */}
              <div className="flex justify-center gap-1 mt-2">
                {Array.from({length: Math.min(7, totalPages)}).map((_, i) => {
                  const page = Math.max(0, Math.min(totalPages-7, currentPage-3)) + i;
                  return (
                    <button key={page} onClick={() => setCurrentPage(page)}
                      className={`w-8 h-7 rounded text-xs font-bold transition-all ${page===currentPage ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                      {page+1}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}