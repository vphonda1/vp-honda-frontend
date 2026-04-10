import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { api } from '../utils/apiConfig';

export default function CustomerServiceProfile() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [serviceData, setServiceData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadCustomerData();
  }, [customerId]);

  // ✅ FIXED: Multiple source check
  const loadCustomerData = async () => {
    try {
      let foundCustomer = null;

      // ✅ TRY 1: Backend से fetch करो
      try {
        const custRes = await fetch(api(`/api/customers/${customerId}`));
        if (custRes.ok) {
          const custData = await custRes.json();
          foundCustomer = custData;
          console.log('✅ Customer found in backend');
        }
      } catch (err) {
        console.warn('⚠️ Backend fetch failed, checking localStorage...');
      }

      // ✅ TRY 2: अगर backend में नहीं मिला तो localStorage में check करो
      if (!foundCustomer) {
        console.log('🔍 Checking localStorage for imported customers...');
        
        // Check in newCustomers (imported)
        const newCustomers = JSON.parse(localStorage.getItem('newCustomers')) || [];
        foundCustomer = newCustomers.find(c => c._id === customerId);
        
        if (foundCustomer) {
          console.log('✅ Found in newCustomers (imported)');
        }
      }

      // ✅ TRY 3: अगर अभी भी नहीं मिला तो सभी customers में search करो
      if (!foundCustomer) {
        const allCustomers = JSON.parse(localStorage.getItem('customers')) || [];
        foundCustomer = allCustomers.find(c => c._id === customerId);
      }

      // ✅ TRY 4: sharedCustomerData में check करो
      if (!foundCustomer) {
        const shared = JSON.parse(localStorage.getItem('sharedCustomerData')) || [];
        foundCustomer = shared.find(c => c._id === customerId);
      }

      // ✅ TRY 5: Imported invoices से customer build करो
      if (!foundCustomer) {
        const allInvoices = [...(JSON.parse(localStorage.getItem('invoices'))||[]), ...(JSON.parse(localStorage.getItem('generatedInvoices'))||[])];
        const inv = allInvoices.find(i => i.customerId === customerId);
        if (inv) {
          foundCustomer = {
            _id: customerId,
            name: inv.customerName || 'Unknown',
            phone: inv.customerPhone || '',
            linkedVehicle: { name: inv.vehicle || '', regNo: inv.regNo || '', frameNo: inv.frameNo || '', engineNo: inv.engineNo || '' },
            address: '', district: '',
          };
        }
      }

      // ✅ TRY 6: customerServiceData से build करो
      if (!foundCustomer) {
        const svcData = JSON.parse(localStorage.getItem('customerServiceData')) || {};
        const svc = svcData[customerId];
        if (svc) {
          foundCustomer = {
            _id: customerId,
            name: svc.customerName || 'Unknown',
            phone: svc.phone || '',
            linkedVehicle: { name: svc.vehicle || '', regNo: svc.regNo || '' },
          };
        }
      }

      // ✅ अगर अभी भी नहीं मिला तो error दिखाओ
      if (foundCustomer) {
        setCustomer(foundCustomer);
      } else {
        console.error('❌ Customer not found anywhere:', customerId);
        setCustomer(null);
      }

      // Load service data from localStorage
      const allServiceData = JSON.parse(localStorage.getItem('customerServiceData')) || {};
      const custServiceData = allServiceData[customerId] || {};
      setServiceData(custServiceData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading customer:', error);
      setLoading(false);
    }
  };

  const updateServiceData = (field, value) => {
    setServiceData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveData = async () => {
    setSaving(true);
    try {
      // Save to localStorage
      const allServiceData = JSON.parse(localStorage.getItem('customerServiceData')) || {};
      allServiceData[customerId] = serviceData;
      localStorage.setItem('customerServiceData', JSON.stringify(allServiceData));

      // Try to save to backend
      try {
        await fetch(api(`/api/customers/${customerId}/service-data`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serviceData)
        });
      } catch (e) {
        console.warn('Backend save failed, using localStorage');
      }

      setMessage('✅ Data saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('❌ Error saving data!');
      console.error('Error saving:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>;
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <Button 
            onClick={() => navigate('/reminders')}
            className="mb-6 bg-red-600 text-white font-bold"
          >
            <ArrowLeft size={20} className="mr-2" /> Back to Reminders
          </Button>

          <Card className="bg-red-900/20 border border-red-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <AlertCircle className="w-12 h-12 text-red-400" />
                <div>
                  <h3 className="text-lg font-bold text-red-300">Customer Not Found</h3>
                  <p className="text-red-200">{customerId}</p>
                  <p className="text-slate-400 text-sm mt-2">Please check if this customer exists.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <Button 
            onClick={() => navigate('/reminders')}
            className="bg-red-600 text-white font-bold flex items-center gap-2"
          >
            <ArrowLeft size={20} /> Back to Reminders
          </Button>
          <h1 className="text-3xl font-bold text-white">👤 {customer.name}</h1>
          <div className="w-20"></div>
        </div>

        {/* SUCCESS MESSAGE */}
        {message && (
          <Card className="bg-green-900/20 border border-green-500">
            <CardContent className="pt-4">
              <p className="text-green-400 font-bold">{message}</p>
            </CardContent>
          </Card>
        )}

        {/* CUSTOMER BASIC INFO */}
        <Card className="bg-slate-800 border-slate-700 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <CardTitle>📱 Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-slate-300 text-sm font-bold">Customer Name</label>
                <p className="text-white text-lg mt-1">{customer.name}</p>
              </div>
              <div>
                <label className="text-slate-300 text-sm font-bold">Phone</label>
                <p className="text-white text-lg mt-1">{customer.phone || 'N/A'}</p>
              </div>
              <div>
                <label className="text-slate-300 text-sm font-bold">Address</label>
                <p className="text-white text-lg mt-1">{customer.address || 'N/A'}</p>
              </div>
              <div>
                <label className="text-slate-300 text-sm font-bold">Vehicle Reg No</label>
                <p className="text-white text-lg mt-1">{customer.linkedVehicle?.regNo || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* INSURANCE & RTO SECTION */}
        <Card className="bg-slate-800 border-slate-700 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
            <CardTitle>🚗 Insurance & RTO Details</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            
            {/* Insurance Date */}
            <div>
              <label className="text-slate-300 text-sm font-bold block mb-2">
                Insurance Date (यह date select करें जब customer को insurance दे दिया हो)
              </label>
              <Input
                type="date"
                value={serviceData.insuranceDate || ''}
                onChange={(e) => updateServiceData('insuranceDate', e.target.value)}
                className="border-2 border-slate-600 bg-slate-700 text-white"
              />
              <p className="text-slate-400 text-xs mt-2">
                ✓ इसके 7 दिन बाद RTO करना अनिवार्य है
                <br/>
                ✓ 4 दिन पहले से reminder आएगा
              </p>
            </div>

            {/* RTO Status */}
            {serviceData.insuranceDate && (
              <div className="bg-yellow-900/20 border border-yellow-500 p-4 rounded">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-yellow-500 flex-shrink-0 mt-1" size={20} />
                  <div>
                    <p className="text-yellow-400 font-bold">RTO Deadline</p>
                    <p className="text-yellow-300 text-sm mt-1">
                      Insurance: {new Date(serviceData.insuranceDate).toLocaleDateString('en-IN')}
                    </p>
                    <p className="text-yellow-300 text-sm">
                      RTO करना है तक: {new Date(new Date(serviceData.insuranceDate).getTime() + 7*24*60*60*1000).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* RTO Done Date */}
            <div>
              <label className="text-slate-300 text-sm font-bold block mb-2">
                RTO Completion Date (जब RTO complete हो गई हो)
              </label>
              <Input
                type="date"
                value={serviceData.rtoDoneDate || ''}
                onChange={(e) => updateServiceData('rtoDoneDate', e.target.value)}
                className="border-2 border-slate-600 bg-slate-700 text-white"
              />
            </div>
          </CardContent>
        </Card>

        {/* PAYMENT SECTION */}
        <Card className="bg-slate-800 border-slate-700 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white">
            <CardTitle>💳 Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            
            {/* Pending Amount */}
            <div>
              <label className="text-slate-300 text-sm font-bold block mb-2">
                Outstanding Amount (₹) - बकाया पैसा अगर कोई है
              </label>
              <Input
                type="number"
                placeholder="0"
                value={serviceData.pendingAmount || ''}
                onChange={(e) => updateServiceData('pendingAmount', parseFloat(e.target.value) || 0)}
                className="border-2 border-slate-600 bg-slate-700 text-white"
              />
            </div>

            {/* Payment Due Date */}
            <div>
              <label className="text-slate-300 text-sm font-bold block mb-2">
                Payment Due Date (जब तक payment देना है)
              </label>
              <Input
                type="date"
                value={serviceData.paymentDueDate || ''}
                onChange={(e) => updateServiceData('paymentDueDate', e.target.value)}
                className="border-2 border-slate-600 bg-slate-700 text-white"
              />
              <p className="text-slate-400 text-xs mt-2">
                ✓ Due date से 2 दिन पहले reminder आएगा
              </p>
            </div>

            {/* Payment Notes */}
            <div>
              <label className="text-slate-300 text-sm font-bold block mb-2">
                Notes (कोई notes या reason)
              </label>
              <textarea
                placeholder="e.g., Customer will pay after salary..."
                value={serviceData.paymentNotes || ''}
                onChange={(e) => updateServiceData('paymentNotes', e.target.value)}
                className="w-full border-2 border-slate-600 bg-slate-700 text-white p-3 rounded h-20"
              />
            </div>

            {/* Payment Received Date */}
            <div>
              <label className="text-slate-300 text-sm font-bold block mb-2">
                Payment Received Date (payment receive हो गई तो यह date fill करें)
              </label>
              <Input
                type="date"
                value={serviceData.paymentReceivedDate || ''}
                onChange={(e) => updateServiceData('paymentReceivedDate', e.target.value)}
                className="border-2 border-slate-600 bg-slate-700 text-white"
              />
            </div>
          </CardContent>
        </Card>

        {/* SERVICE SCHEDULE SECTION */}
        <Card className="bg-slate-800 border-slate-700 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-orange-600 to-orange-700 text-white">
            <CardTitle>🔧 Service Schedule</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            
            {/* 1st Service */}
            <div className="bg-slate-700 p-4 rounded border border-slate-600">
              <h3 className="text-white font-bold mb-4">1st Service</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-slate-300 text-sm font-bold block mb-2">
                    1st Service Done Date (जब 1st service हो गई हो)
                  </label>
                  <Input
                    type="date"
                    value={serviceData.firstServiceDate || ''}
                    onChange={(e) => updateServiceData('firstServiceDate', e.target.value)}
                    className="border-2 border-slate-600 bg-slate-600 text-white"
                  />
                  <p className="text-slate-400 text-xs mt-2">
                    ✓ Vehicle purchase के 30 दिन के अंदर करना अनिवार्य है
                  </p>
                </div>
                {serviceData.firstServiceDate && (
                  <div className="bg-yellow-900/20 border border-yellow-500 p-3 rounded">
                    <p className="text-yellow-400 text-sm font-bold">Next Service Due:</p>
                    <p className="text-yellow-300 text-sm">
                      {new Date(new Date(serviceData.firstServiceDate).getTime() + 150*24*60*60*1000).toLocaleDateString('en-IN')} (5 months later)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 2nd Service */}
            <div className="bg-slate-700 p-4 rounded border border-slate-600">
              <h3 className="text-white font-bold mb-4">2nd Service</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-slate-300 text-sm font-bold block mb-2">
                    2nd Service Done Date (जब 2nd service हो गई हो)
                  </label>
                  <Input
                    type="date"
                    value={serviceData.secondServiceDate || ''}
                    onChange={(e) => updateServiceData('secondServiceDate', e.target.value)}
                    className="border-2 border-slate-600 bg-slate-600 text-white"
                  />
                  <p className="text-slate-400 text-xs mt-2">
                    ✓ 1st Service के 5 महीने बाद करना है
                  </p>
                </div>
                {serviceData.secondServiceDate && (
                  <div className="bg-yellow-900/20 border border-yellow-500 p-3 rounded">
                    <p className="text-yellow-400 text-sm font-bold">Next Service Due:</p>
                    <p className="text-yellow-300 text-sm">
                      {new Date(new Date(serviceData.secondServiceDate).getTime() + 150*24*60*60*1000).toLocaleDateString('en-IN')} (5 months later)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 3rd Service */}
            <div className="bg-slate-700 p-4 rounded border border-slate-600">
              <h3 className="text-white font-bold mb-4">3rd Service</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-slate-300 text-sm font-bold block mb-2">
                    3rd Service Done Date (जब 3rd service हो गई हो)
                  </label>
                  <Input
                    type="date"
                    value={serviceData.thirdServiceDate || ''}
                    onChange={(e) => updateServiceData('thirdServiceDate', e.target.value)}
                    className="border-2 border-slate-600 bg-slate-600 text-white"
                  />
                  <p className="text-slate-400 text-xs mt-2">
                    ✓ 2nd Service के 5 महीने बाद करना है
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SAVE BUTTON */}
        <div className="sticky bottom-6 flex gap-4">
          <Button 
            onClick={saveData}
            disabled={saving}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-4 text-lg flex items-center justify-center gap-2"
          >
            <Save size={24} /> {saving ? 'Saving...' : 'Save All Changes'}
          </Button>
          <Button 
            onClick={() => navigate('/reminders')}
            className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 px-8"
          >
            Cancel
          </Button>
        </div>

      </div>
    </div>
  );
}