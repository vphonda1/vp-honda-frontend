import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Download, AlertCircle, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../utils/apiConfig';

export default function DataManagement() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [importStats, setImportStats] = useState(null);

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

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.xls') || selectedFile.name.endsWith('.xlsm') || selectedFile.name.endsWith('.xlsx')) {
        setFile(selectedFile);
        setMessage('✓ File selected: ' + selectedFile.name);
        setMessageType('info');
      } else {
        setMessage('❌ Please select an Excel file (.xls .xlsm or .xlsx)');
        setMessageType('error');
        setFile(null);
      }
    }
  };

  const handleImport = async () => {
    if (!file) {
      setMessage('❌ Please select a file first');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('📊 Processing file...');
    setMessageType('info');

    try {
      // 1. Read Excel locally for localStorage sync
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { cellDates: true });
      
      // Parse cost_detl sheet
      const worksheet = workbook.Sheets['cost_detl'];
      if (!worksheet) {
        setMessage('❌ "cost_detl" sheet not found in Excel file!');
        setMessageType('error');
        setLoading(false);
        return;
      }
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Parse Rate_List sheet for prices (rows 35-46)
      const rateSheet = workbook.Sheets['Rate_List'];
      const ratePrices = {};
      if (rateSheet) {
        const rateData = XLSX.utils.sheet_to_json(rateSheet, { header: 1 });
        // Find rows with model data (rows 35-46 area, header at row 34)
        for (let i = 0; i < rateData.length; i++) {
          const row = rateData[i];
          if (!row) continue;
          const model = row[1]; // Column B = Model
          const exShowroom = parseFloat(row[4]); // Column E = EX-Shroom
          const taxRate = parseFloat(row[15]); // Column P = Tax Rate
          if (model && typeof model === 'string' && model.length > 3 && exShowroom > 0) {
            ratePrices[model.trim().toUpperCase()] = {
              exShowroom: exShowroom,
              taxRate: taxRate || 0
            };
          }
        }
      }

      // Transform vehicle data
      const vehicleData = jsonData
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
          financerName: row['Fin/ Cash'] || row['Fin/Cash'] || row['Financer'] || '',
          batteryNo: row['Bty No'] || row['Battery No'] || '',
          regNo: row['Veh Reg No'] || '',
          price: parseFloat(row['Price']) || 0,
          insurance: parseFloat(row['Insurance']) || 0,
          rto: parseFloat(row['RTO']) || 0
        }));

      // Transform to customer format
      const customerData = vehicleData.map(v => ({
        _id: String(v.id),
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
          name: (v.vehicleModel + ' ' + (v.variant || '')).trim(),
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

      const uniqueModels = [...new Set(vehicleData.map(d => d.vehicleModel))].filter(Boolean);

      // Save ALL to localStorage - shared across pages
      localStorage.setItem('vehDashboardData', JSON.stringify(vehicleData));
      localStorage.setItem('vehDashboardModels', JSON.stringify(uniqueModels));
      localStorage.setItem('sharedCustomerData', JSON.stringify(customerData));
      localStorage.setItem('sharedVehicleData', JSON.stringify(vehicleData));
      localStorage.setItem('sharedRatePrices', JSON.stringify(ratePrices));

      // Notify other open pages
      window.dispatchEvent(new Event('dataSync'));

      setImportStats({
        vehicles: vehicleData.length,
        customers: customerData.length,
        models: uniqueModels.length,
        rates: Object.keys(ratePrices).length
      });

      // 2. Also try API upload
      try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(api('/api/import-vehicle-data'), {
          method: 'POST',
          body: formData
        });
        if (response.ok) {
          const result = await response.json();
          setMessage(`✅ Import Complete!\n\n📊 ${vehicleData.length} Vehicle Records\n👥 ${customerData.length} Customers\n🏍️ ${uniqueModels.length} Models\n💰 ${Object.keys(ratePrices).length} Rate Prices\n\n✅ API: ${result.imported} records synced\n\n💾 All pages synced via localStorage!`);
        } else {
          setMessage(`✅ Import Complete!\n\n📊 ${vehicleData.length} Vehicle Records\n👥 ${customerData.length} Customers\n🏍️ ${uniqueModels.length} Models\n💰 ${Object.keys(ratePrices).length} Rate Prices\n\n⚠️ API sync failed, but localStorage synced!\n💾 All pages will auto-load data.`);
        }
      } catch (apiErr) {
        setMessage(`✅ Import Complete!\n\n📊 ${vehicleData.length} Vehicle Records\n👥 ${customerData.length} Customers\n🏍️ ${uniqueModels.length} Models\n💰 ${Object.keys(ratePrices).length} Rate Prices\n\n⚠️ Backend not running, but localStorage synced!\n💾 Veh Dashboard, Customers - all pages will auto-load.`);
      }

      setMessageType('success');
      setFile(null);
      document.getElementById('fileInput').value = '';

    } catch (error) {
      console.error('Import error:', error);
      setMessage(`❌ Error: ${error.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setMessage('📊 Preparing export...');
    setMessageType('info');

    try {
      // Try API first
      let exportDone = false;
      try {
        const response = await fetch(api('/api/export-customer-data'));
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `VP_Honda_Customer_Data_${new Date().toISOString().split('T')[0]}.xlsx`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          exportDone = true;
        }
      } catch (e) {}

      // Fallback: export from localStorage
      if (!exportDone) {
        const vehicleData = JSON.parse(localStorage.getItem('vehDashboardData') || '[]');
        const invoices = JSON.parse(localStorage.getItem('generatedInvoices') || '[]');
        
        if (vehicleData.length === 0) {
          setMessage('❌ No data to export! Import data first.');
          setMessageType('error');
          setLoading(false);
          return;
        }

        const wb = XLSX.utils.book_new();
        
        // Vehicle sheet
        const vehSheet = XLSX.utils.json_to_sheet(vehicleData.map(v => ({
          'Customer Name': v.customerName,
          'Father Name': v.fatherName,
          'Mobile': v.mobileNo,
          'Address': v.address,
          'District': v.dist,
          'Pin Code': v.pinCode,
          'DOB': v.dob,
          'Vehicle': v.vehicleModel,
          'Variant': v.variant,
          'Color': v.color,
          'Engine No': v.engineNo,
          'Chassis No': v.chassisNo,
          'Key No': v.keyNo,
          'Battery No': v.batteryNo,
          'Financer': v.financerName,
          'Reg No': v.regNo,
          'Price': v.price,
          'Date': v.date
        })));
        XLSX.utils.book_append_sheet(wb, vehSheet, 'Vehicle Data');

        // Invoices sheet
        if (invoices.length > 0) {
          const invSheet = XLSX.utils.json_to_sheet(invoices.map(inv => ({
            'Invoice No': inv.invoiceNo,
            'Customer': inv.customerName,
            'Vehicle': inv.vehicleModel,
            'Amount': inv.amount,
            'Date': inv.date
          })));
          XLSX.utils.book_append_sheet(wb, invSheet, 'Invoices');
        }

        XLSX.writeFile(wb, `VP_Honda_Data_${new Date().toISOString().split('T')[0]}.xlsx`);
      }

      setMessage('✅ Data exported successfully!');
      setMessageType('success');
    } catch (error) {
      console.error('Export error:', error);
      setMessage(`❌ Export failed: ${error.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  // Clear all data
  const handleClearData = () => {
    if (!window.confirm('⚠️ Are you sure? This will clear ALL data from all pages!')) return;
    const pass = prompt('Admin Password:');
    if (pass !== 'vphonda@123') { alert('❌ Wrong password!'); return; }
    localStorage.removeItem('vehDashboardData');
    localStorage.removeItem('vehDashboardModels');
    localStorage.removeItem('sharedCustomerData');
    localStorage.removeItem('sharedVehicleData');
    localStorage.removeItem('sharedRatePrices');
    localStorage.removeItem('generatedInvoices');
    setImportStats(null);
    setMessage('✅ All data cleared!');
    setMessageType('success');
    window.dispatchEvent(new Event('dataSync'));
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-purple-600 mb-8">📊 Data Management - Import/Export</h1>
        
        {/* SYNC STATUS */}
        {importStats && (
          <Card className="mb-6 border-2 border-green-400">
            <CardContent className="pt-4">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="bg-blue-50 p-3 rounded"><p className="text-2xl font-bold text-blue-700">{importStats.vehicles}</p><p className="text-xs text-blue-600">Vehicles</p></div>
                <div className="bg-purple-50 p-3 rounded"><p className="text-2xl font-bold text-purple-700">{importStats.customers}</p><p className="text-xs text-purple-600">Customers</p></div>
                <div className="bg-green-50 p-3 rounded"><p className="text-2xl font-bold text-green-700">{importStats.models}</p><p className="text-xs text-green-600">Models</p></div>
                <div className="bg-orange-50 p-3 rounded"><p className="text-2xl font-bold text-orange-700">{importStats.rates}</p><p className="text-xs text-orange-600">Rate Prices</p></div>
              </div>
              <p className="text-center text-green-700 font-bold mt-3 text-sm">✅ Synced to: Veh Dashboard, Customers, Reports</p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 
          {/* IMPORT SECTION */}
          <Card className="shadow-xl">
            <CardHeader className="bg-blue-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-6 h-6" /> Import Vehicle Data
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="bg-blue-50 border-2 border-blue-200 rounded p-4">
                <p className="text-sm text-blue-900 font-bold mb-2">📋 Steps:</p>
                <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
                  <li>Select Excel file (Veh_Details_Jan_25.xlsm)</li>
                  <li>Click "Import Data"</li>
                  <li>Data syncs to ALL pages automatically!</li>
                </ol>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-700">
                <p className="font-bold mb-1">📂 Reads these sheets:</p>
                <p>• <b>cost_detl</b> — Customer & Vehicle data</p>
                <p>• <b>Rate_List</b> — Vehicle prices (Tax Rate column)</p>
              </div>

              <div className="border-2 border-dashed border-blue-300 rounded p-6 text-center hover:border-blue-500 cursor-pointer transition bg-white">
                <input
                  id="fileInput"
                  type="file"
                  accept=".xls,.xlsm,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label htmlFor="fileInput" className="cursor-pointer block">
                  <p className="text-4xl mb-2">📁</p>
                  <p className="font-bold text-gray-700">Click to select Excel file</p>
                  <p className="text-sm text-gray-500">or drag and drop</p>
                </label>
              </div>

              {file && (
                <div className="bg-green-100 border-2 border-green-500 rounded p-3 text-center">
                  <p className="text-green-700 font-bold">✓ {file.name}</p>
                  <p className="text-green-600 text-sm">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
              )}

              <Button
                onClick={handleImport}
                disabled={!file || loading}
                className={`w-full font-bold py-3 text-base ${
                  loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {loading ? '⏳ Processing...' : '📤 Import Data'}
              </Button>
              
            </CardContent>
          </Card>

          {/* EXPORT SECTION */}
          <Card className="shadow-xl">
            <CardHeader className="bg-green-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Download className="w-6 h-6" /> Export Customer Data
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="bg-green-50 border-2 border-green-200 rounded p-4">
                <p className="text-sm text-green-900 font-bold mb-2">📋 Downloads:</p>
                <ul className="text-sm text-green-800 space-y-1 ml-4 list-disc">
                  <li>All customer details</li>
                  <li>Vehicle information</li>
                  <li>Generated invoices</li>
                  <li>Ready to share</li>
                </ul>
              </div>

              <div className="bg-green-100 border-2 border-green-400 rounded p-6 text-center">
                <p className="text-5xl mb-3">💾</p>
                <p className="font-bold text-gray-700 mb-2">Export All Data</p>
                <p className="text-sm text-gray-600">Download as Excel file</p>
              </div>

              <Button
                onClick={handleExport}
                disabled={loading}
                className={`w-full font-bold py-3 text-base ${
                  loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {loading ? '⏳ Processing...' : '📥 Export Data'}
              </Button>

              <Button
                onClick={handleClearData}
                className="w-full font-bold py-2 text-sm bg-red-600 hover:bg-red-700 text-white"
              >
                🗑 Clear All Data (Admin Only)
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* MESSAGE DISPLAY */}
        {message && (
          <Card className={`mt-6 ${
            messageType === 'success' ? 'border-green-500' : 
            messageType === 'error' ? 'border-red-500' : 
            'border-blue-500'
          }`}>
            <CardContent className="pt-6 flex gap-4">
              <div className="flex-shrink-0 mt-0.5">
                {messageType === 'success' && <CheckCircle className="w-6 h-6 text-green-600" />}
                {messageType === 'error' && <AlertCircle className="w-6 h-6 text-red-600" />}
                {messageType === 'info' && <AlertCircle className="w-6 h-6 text-blue-600" />}
              </div>
              <div className="flex-1">
                <p className={`whitespace-pre-wrap font-semibold text-sm ${
                  messageType === 'success' ? 'text-green-800' : 
                  messageType === 'error' ? 'text-red-800' : 
                  'text-blue-800'
                }`}>
                  {message}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SYNC INFO */}
        <Card className="mt-6 border-2 border-purple-200">
          <CardHeader className="bg-purple-100">
            <CardTitle>🔄 Data Sync Info</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 text-sm space-y-3">
            <div>
              <p className="font-bold text-gray-800 mb-1">📤 Import करने पर:</p>
              <p className="text-gray-700 ml-4">Excel file से data read होकर automatically sync होता है:</p>
              <ul className="ml-8 text-gray-600 list-disc mt-1">
                <li><b>Veh Dashboard</b> — Vehicle records, filters, charts</li>
                <li><b>Customers</b> — Customer list with vehicle details</li>
                <li><b>Reports</b> — Analytics & invoices</li>
                <li><b>Rate_List</b> — Auto price lookup for invoices</li>
              </ul>
            </div>
            <hr />
            <div>
              <p className="font-bold text-gray-800 mb-1">📥 Export करने पर:</p>
              <p className="text-gray-700 ml-4">Vehicle Data + Generated Invoices — दोनों sheets Excel में download होंगी।</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}