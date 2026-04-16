import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '../utils/apiConfig';

const getLS = (k, fb=null) => {
  try {
    return JSON.parse(localStorage.getItem(k)) || fb;
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

export default function InvoiceManagementDashboard() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState({});
  const [activeTab, setActiveTab] = useState('all'); // all, vehicle, service

  useEffect(() => {
    loadInvoices();
    const interval = setInterval(loadInvoices, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      // Try API first
      const res = await fetch(api('/api/invoices'));
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
        saveLS('invoices', data);
        setLoading(false);
        return;
      }
    } catch(e) {
      console.warn('API fetch failed, using localStorage');
    }

    // Fallback to localStorage
    const stored = getLS('invoices', []);
    setInvoices(stored);
    setLoading(false);
  };

  const handleImportPDF = async (e, type) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setImporting(true);
    setMessage('');
    const results = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(prev => ({ ...prev, [file.name]: 'Processing...' }));

      try {
        const formData = new FormData();
        formData.append('pdf', file);

        // ✅ CORRECT ENDPOINT PATH
        const endpoint = type === 'vehicle' 
          ? '/api/invoices/parse-pdf'
          : '/api/invoices/parse-pdf';

        console.log(`📄 Uploading to: ${endpoint}`);

        const res = await fetch(api(endpoint), {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error('Response:', errText);
          throw new Error(`HTTP ${res.status}`);
        }

        const parsed = await res.json();
        
        if (parsed.success && parsed.invoice) {
          const inv = parsed.invoice;
          
          // Ensure invoice type
          if (!inv.invoiceType) {
            inv.invoiceType = type === 'vehicle' ? 'vehicle' : 'service';
          }

          results.push(inv);
          setProgress(prev => ({ ...prev, [file.name]: '✅ Done' }));

          console.log(`✅ Parsed: ${inv.invoiceNumber} | ${inv.customerName} | ₹${inv.grandTotal}`);
        } else {
          throw new Error(parsed.error || 'Parse failed');
        }
      } catch(err) {
        console.error(`❌ ${file.name}:`, err.message);
        errors.push({ file: file.name, error: err.message });
        setProgress(prev => ({ ...prev, [file.name]: `❌ ${err.message}` }));
      }
    }

    // Save to localStorage
    if (results.length > 0) {
      const allInvoices = getLS('invoices', []);
      
      // Remove duplicates
      const invoiceNumbers = new Set(results.map(i => i.invoiceNumber));
      const filtered = allInvoices.filter(i => !invoiceNumbers.has(i.invoiceNumber));
      
      const merged = [...results, ...filtered].sort((a, b) => 
        new Date(b.invoiceDate) - new Date(a.invoiceDate)
      );
      
      saveLS('invoices', merged);
      setInvoices(merged);

      // Try to save to API
      try {
        for (const inv of results) {
          await fetch(api('/api/invoices'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inv),
          });
        }
      } catch(e) {
        console.warn('DB save warning:', e);
      }
    }

    setImporting(false);
    setMessage(`✅ Imported ${results.length} invoices${errors.length > 0 ? `, ${errors.length} errors` : ''}`);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleClearByType = async (type) => {
    if (!confirm(`Delete all ${type} invoices?`)) return;

    try {
      // Try API
      await fetch(api(`/api/invoices/clear`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      }).catch(() => {});

      // Clear from localStorage
      const all = getLS('invoices', []);
      const filtered = all.filter(i => i.invoiceType !== type);
      saveLS('invoices', filtered);
      setInvoices(filtered);

      setMessage(`✅ Cleared ${type} invoices`);
      setTimeout(() => setMessage(''), 3000);
    } catch(err) {
      setMessage(`❌ Error: ${err.message}`);
    }
  };

  const handleDeleteInvoice = async (id) => {
    if (!confirm('Delete this invoice?')) return;

    try {
      await fetch(api(`/api/invoices/${id}`), { method: 'DELETE' }).catch(() => {});

      const filtered = invoices.filter(i => i._id !== id);
      saveLS('invoices', filtered);
      setInvoices(filtered);
    } catch(err) {
      setMessage(`❌ Error: ${err.message}`);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    if (activeTab === 'all') return true;
    return inv.invoiceType === activeTab;
  });

  const stats = {
    total: invoices.length,
    vehicle: invoices.filter(i => i.invoiceType === 'vehicle').length,
    service: invoices.filter(i => i.invoiceType === 'service').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            📋 Invoice Management
          </h1>
          <Button 
            onClick={loadInvoices}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>

        {/* Message */}
        {message && (
          <Card className={message.includes('❌') ? 'bg-red-900/20 border-red-500' : 'bg-green-900/20 border-green-500'}>
            <CardContent className="pt-3 pb-3">
              <p className={message.includes('❌') ? 'text-red-300' : 'text-green-300'}>
                {message}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Import Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Vehicle Import */}
          <Card className="bg-slate-800 border-slate-700 hover:border-orange-500 transition">
            <CardContent className="pt-6 pb-6">
              <label className="cursor-pointer block">
                <input
                  type="file"
                  multiple
                  accept=".pdf"
                  onChange={(e) => handleImportPDF(e, 'vehicle')}
                  disabled={importing}
                  className="hidden"
                />
                <div className="text-center">
                  <Upload className="mx-auto mb-3 text-orange-400" size={32} />
                  <p className="text-white font-bold">Import Vehicle PDF</p>
                  <p className="text-xs text-slate-400 mt-1">Vehicle Tax Invoice</p>
                </div>
              </label>
            </CardContent>
          </Card>

          {/* Service Import */}
          <Card className="bg-slate-800 border-slate-700 hover:border-green-500 transition">
            <CardContent className="pt-6 pb-6">
              <label className="cursor-pointer block">
                <input
                  type="file"
                  multiple
                  accept=".pdf"
                  onChange={(e) => handleImportPDF(e, 'service')}
                  disabled={importing}
                  className="hidden"
                />
                <div className="text-center">
                  <Upload className="mx-auto mb-3 text-green-400" size={32} />
                  <p className="text-white font-bold">Import Service PDF</p>
                  <p className="text-xs text-slate-400 mt-1">Service/Parts Tax Invoice</p>
                </div>
              </label>
            </CardContent>
          </Card>

          {/* Export */}
          <Card className="bg-slate-800 border-slate-700 hover:border-blue-500 transition opacity-50">
            <CardContent className="pt-6 pb-6">
              <div className="text-center">
                <Upload className="mx-auto mb-3 text-blue-400" size={32} />
                <p className="text-white font-bold">Export as PDF</p>
                <p className="text-xs text-slate-400 mt-1">Coming soon</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clear Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={() => handleClearByType('vehicle')}
            className="bg-red-700 hover:bg-red-600 text-white font-bold flex items-center gap-2"
          >
            <Trash2 size={16} /> Clear Vehicle ({stats.vehicle})
          </Button>
          <Button
            onClick={() => handleClearByType('service')}
            className="bg-red-700 hover:bg-red-600 text-white font-bold flex items-center gap-2"
          >
            <Trash2 size={16} /> Clear Service ({stats.service})
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-900/20 border-blue-500">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-400">Total</p>
              <h3 className="text-4xl font-black text-blue-400 mt-2">{stats.total}</h3>
            </CardContent>
          </Card>

          <Card className="bg-orange-900/20 border-orange-500">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-400">🏍️ Vehicle</p>
              <h3 className="text-4xl font-black text-orange-400 mt-2">{stats.vehicle}</h3>
            </CardContent>
          </Card>

          <Card className="bg-green-900/20 border-green-500">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-400">🔧 Service</p>
              <h3 className="text-4xl font-black text-green-400 mt-2">{stats.service}</h3>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-700">
          {[
            { id: 'all', label: '📋 All Invoices', count: stats.total },
            { id: 'vehicle', label: '🏍️ Vehicle', count: stats.vehicle },
            { id: 'service', label: '🔧 Service', count: stats.service },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-bold transition ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Invoices List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-12 pb-12 text-center">
              <AlertCircle className="mx-auto mb-3 text-slate-500" size={32} />
              <p className="text-slate-400 font-bold">No invoices found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredInvoices.slice(0, 5).map((inv, idx) => (
              <Card 
                key={idx}
                className="bg-slate-800 border-slate-700 hover:border-blue-500 transition cursor-pointer"
                onClick={() => navigate(`/invoice/${inv.invoiceNumber}`)}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-bold">#{inv.invoiceNumber}</p>
                      <p className="text-sm text-slate-400">{inv.customerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-black">₹{inv.grandTotal?.toLocaleString('en-IN')}</p>
                      <p className="text-xs text-slate-400">
                        {inv.invoiceType === 'vehicle' ? '🏍️ Vehicle' : '🔧 Service'}
                      </p>
                    </div>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteInvoice(inv._id);
                      }}
                      className="bg-red-700 hover:bg-red-600 text-white h-8 px-3"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Progress Tracker */}
        {Object.keys(progress).length > 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800">
              <CardTitle className="text-white">📊 Import Progress</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 pb-4">
              <div className="space-y-2">
                {Object.entries(progress).map(([file, status]) => (
                  <div key={file} className="flex justify-between items-center text-sm">
                    <span className="text-slate-300">{file}</span>
                    <span className={status === '✅ Done' ? 'text-green-400' : status.includes('❌') ? 'text-red-400' : 'text-blue-400'}>
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
