import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash2, Search, ArrowLeft } from 'lucide-react';
import { api } from '../utils/apiConfig';

export default function NewCustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    fatherName: '',
    phone: '',
    aadhar: '',
    pan: '',
    address: '',
    district: '',
    pinCode: '',
    state: 'M.P.',
    vehicleName: '',
    regNo: '',
    chassisNo: '',
    engineNo: '',
    color: '',
    model: '',
    menuFactureDate: '',
    sellingDate: ''
  });

  useEffect(() => {
    console.log('🔄 NewCustomersPage mounted - Loading customers...');
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      console.log('📦 Loading customers from localStorage...');
      
      // PRIMARY: Load from localStorage
      const saved = JSON.parse(localStorage.getItem('newCustomers')) || [];
      console.log('✅ Loaded from localStorage:', saved.length, 'customers');
      setCustomers(saved);

      // FALLBACK: Try to load from backend
      try {
        console.log('🔄 Also trying backend...');
        const res = await fetch(api('/api/serviceCustomers'));
        if (res.ok) {
          const data = await res.json();
          if (data.data && data.data.length > 0) {
            console.log('✅ Loaded from backend:', data.data.length);
            setCustomers(data.data);
          }
        }
      } catch (e) {
        console.log('⚠️ Backend not available, using localStorage');
      }
    } catch (error) {
      console.error('❌ Error loading customers:', error);
    }
  };

  const saveCustomer = async () => {
    // Validation
    if (!formData.name || !formData.phone || !formData.regNo) {
      alert('❌ कृपया Customer Name, Phone, और Vehicle Reg No भरें!');
      return;
    }

    const customerData = {
      _id: editingId || Date.now().toString(),
      ...formData,
      linkedVehicle: {
        name: formData.vehicleName,
        regNo: formData.regNo,
        chassisNo: formData.chassisNo,
        engineNo: formData.engineNo,
        color: formData.color,
        model: formData.model,
        menuFactureDate: formData.menuFactureDate,
        sellingDate: formData.sellingDate
      },
      createdAt: editingId ? new Date(customers.find(c => c._id === editingId)?.createdAt).toISOString() : new Date().toISOString()
    };

    console.log('💾 Saving customer:', customerData);

    let updatedCustomers;
    if (editingId) {
      // Update existing
      updatedCustomers = customers.map(c => c._id === editingId ? customerData : c);
      console.log('✅ Customer updated');
      alert('✅ Customer updated successfully!');
    } else {
      // Add new
      updatedCustomers = [...customers, customerData];
      console.log('✅ New customer added');
      alert('✅ New customer added successfully!');
    }

    // Save to localStorage (PRIMARY)
    try {
      localStorage.setItem('newCustomers', JSON.stringify(updatedCustomers));
      console.log('💾 Saved to localStorage:', updatedCustomers.length);
    } catch (error) {
      console.error('❌ Error saving to localStorage:', error);
    }

    // Save to backend (OPTIONAL)
    try {
      if (!editingId) {
        const res = await fetch(api('/api/serviceCustomers'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customerData)
        });
        if (!res.ok) throw new Error('Backend save failed');
        console.log('✅ Also saved to backend');
      }
    } catch (error) {
      console.log('⚠️ Backend save failed, but localStorage saved');
    }

    setCustomers(updatedCustomers);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      fatherName: '',
      phone: '',
      aadhar: '',
      pan: '',
      address: '',
      district: '',
      pinCode: '',
      state: 'M.P.',
      vehicleName: '',
      regNo: '',
      chassisNo: '',
      engineNo: '',
      color: '',
      model: '',
      menuFactureDate: '',
      sellingDate: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  const editCustomer = (customer) => {
    setFormData({
      name: customer.name,
      fatherName: customer.fatherName,
      phone: customer.phone,
      aadhar: customer.aadhar,
      pan: customer.pan,
      address: customer.address,
      district: customer.district,
      pinCode: customer.pinCode,
      state: customer.state,
      vehicleName: customer.linkedVehicle?.name || customer.vehicleName || '',
      regNo: customer.linkedVehicle?.regNo || customer.regNo || '',
      chassisNo: customer.linkedVehicle?.chassisNo || customer.chassisNo || '',
      engineNo: customer.linkedVehicle?.engineNo || customer.engineNo || '',
      color: customer.linkedVehicle?.color || customer.color || '',
      model: customer.linkedVehicle?.model || customer.model || '',
      menuFactureDate: customer.linkedVehicle?.menuFactureDate || customer.menuFactureDate || '',
      sellingDate: customer.linkedVehicle?.sellingDate || customer.sellingDate || ''
    });
    setEditingId(customer._id);
    setShowForm(true);
  };

  const deleteCustomer = (id) => {
    if (window.confirm('❌ क्या आप इस customer को delete करना चाहते हैं?')) {
      const updatedCustomers = customers.filter(c => c._id !== id);
      setCustomers(updatedCustomers);
      localStorage.setItem('newCustomers', JSON.stringify(updatedCustomers));
      console.log('✅ Customer deleted');
      alert('✅ Customer deleted successfully!');
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    (c.linkedVehicle?.regNo || c.regNo || '').includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* HEADER WITH BACK BUTTON */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            onClick={() => navigate('/job-cards')}
            className="bg-red-600 text-white font-bold flex items-center gap-2"
            title="Back to Job Cards"
          >
            <ArrowLeft size={20} /> Back to Job Cards
          </Button>
          <div>
            <h1 className="text-4xl font-bold text-blue-600">👥 New Customers Management</h1>
            <p className="text-gray-600">Manage all new service customers for VP Honda</p>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{customers.length}</div>
              <p className="text-sm text-blue-100">Total Customers</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{customers.filter(c => c.linkedVehicle?.regNo || c.regNo).length}</div>
              <p className="text-sm text-green-100">With Vehicles</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{customers.filter(c => c.aadhar).length}</div>
              <p className="text-sm text-purple-100">Verified (Aadhar)</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{customers.filter(c => c.pan).length}</div>
              <p className="text-sm text-orange-100">With PAN</p>
            </CardContent>
          </Card>
        </div>

        {/* ACTION BUTTONS & SEARCH */}
        <div className="flex gap-4 mb-6 flex-wrap items-center">
          <Button 
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }} 
            className="bg-green-600 text-white font-bold flex items-center gap-2"
          >
            <Plus size={20} /> Add New Customer
          </Button>

          <div className="flex-1 min-w-64 relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <Input
              placeholder="🔍 Search by Name, Phone, or Reg No..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-2 border-gray-300"
            />
          </div>
        </div>

        {/* ADD/EDIT FORM */}
        {showForm && (
          <Card className="shadow-xl mb-8">
            <CardHeader className="bg-blue-600 text-white">
              <CardTitle>{editingId ? '✏️ Edit Customer' : '➕ Add New Customer'}</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* Customer Details */}
                <div>
                  <label className="block text-sm font-bold mb-1 text-red-600">Customer Name *</label>
                  <Input 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})} 
                    className="border-2"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Father Name</label>
                  <Input 
                    value={formData.fatherName} 
                    onChange={(e) => setFormData({...formData, fatherName: e.target.value})} 
                    className="border-2"
                    placeholder="Father's name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 text-red-600">Phone *</label>
                  <Input 
                    value={formData.phone} 
                    onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                    className="border-2"
                    placeholder="Mobile number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Aadhar</label>
                  <Input 
                    value={formData.aadhar} 
                    onChange={(e) => setFormData({...formData, aadhar: e.target.value})} 
                    className="border-2"
                    placeholder="12-digit Aadhar"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">PAN</label>
                  <Input 
                    value={formData.pan} 
                    onChange={(e) => setFormData({...formData, pan: e.target.value})} 
                    className="border-2"
                    placeholder="PAN number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Address</label>
                  <Input 
                    value={formData.address} 
                    onChange={(e) => setFormData({...formData, address: e.target.value})} 
                    className="border-2"
                    placeholder="Full address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">District</label>
                  <Input 
                    value={formData.district} 
                    onChange={(e) => setFormData({...formData, district: e.target.value})} 
                    className="border-2"
                    placeholder="District"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">PIN Code</label>
                  <Input 
                    value={formData.pinCode} 
                    onChange={(e) => setFormData({...formData, pinCode: e.target.value})} 
                    className="border-2"
                    placeholder="6-digit PIN"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">State</label>
                  <select 
                    value={formData.state} 
                    onChange={(e) => setFormData({...formData, state: e.target.value})} 
                    className="w-full border-2 p-2 rounded"
                  >
                    <option>M.P.</option>
                    <option>Rajasthan</option>
                    <option>Gujarat</option>
                    <option>Uttar Pradesh</option>
                    <option>Other</option>
                  </select>
                </div>

                {/* Vehicle Details */}
                <div>
                  <label className="block text-sm font-bold mb-1">Vehicle Name</label>
                  <Input 
                    value={formData.vehicleName} 
                    onChange={(e) => setFormData({...formData, vehicleName: e.target.value})} 
                    className="border-2"
                    placeholder="e.g., SP-125 DLX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 text-red-600">Registration No *</label>
                  <Input 
                    value={formData.regNo} 
                    onChange={(e) => setFormData({...formData, regNo: e.target.value})} 
                    className="border-2"
                    placeholder="Vehicle registration"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Chassis No</label>
                  <Input 
                    value={formData.chassisNo} 
                    onChange={(e) => setFormData({...formData, chassisNo: e.target.value})} 
                    className="border-2"
                    placeholder="Chassis number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Engine No</label>
                  <Input 
                    value={formData.engineNo} 
                    onChange={(e) => setFormData({...formData, engineNo: e.target.value})} 
                    className="border-2"
                    placeholder="Engine number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Color</label>
                  <Input 
                    value={formData.color} 
                    onChange={(e) => setFormData({...formData, color: e.target.value})} 
                    className="border-2"
                    placeholder="Vehicle color"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Model</label>
                  <Input 
                    value={formData.model} 
                    onChange={(e) => setFormData({...formData, model: e.target.value})} 
                    className="border-2"
                    placeholder="Model code/name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Manufacture Date</label>
                  <Input 
                    type="date"
                    value={formData.menuFactureDate} 
                    onChange={(e) => setFormData({...formData, menuFactureDate: e.target.value})} 
                    className="border-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Selling Date</label>
                  <Input 
                    type="date"
                    value={formData.sellingDate} 
                    onChange={(e) => setFormData({...formData, sellingDate: e.target.value})} 
                    className="border-2"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button 
                  onClick={saveCustomer} 
                  className="flex-1 bg-green-600 text-white font-bold py-3"
                >
                  {editingId ? '✅ Update Customer' : '✅ Save Customer'}
                </Button>
                <Button 
                  onClick={resetForm} 
                  className="flex-1 bg-gray-600 text-white font-bold py-3"
                >
                  ❌ Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CUSTOMERS LIST */}
        <Card className="shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <CardTitle className="text-xl">📋 Customers List ({filteredCustomers.length})</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">📭 No customers found</p>
                <p className="text-sm mt-2">Click "Add New Customer" to create one</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-blue-100 to-blue-50 border-b-2 border-blue-300">
                    <tr>
                      <th className="p-3 text-left font-bold text-blue-900">Sr</th>
                      <th className="p-3 text-left font-bold text-blue-900">Customer Name</th>
                      <th className="p-3 text-left font-bold text-blue-900">Phone</th>
                      <th className="p-3 text-left font-bold text-blue-900">Vehicle Reg</th>
                      <th className="p-3 text-left font-bold text-blue-900">Vehicle Name</th>
                      <th className="p-3 text-left font-bold text-blue-900">District</th>
                      <th className="p-3 text-left font-bold text-blue-900">Aadhar</th>
                      <th className="p-3 text-center font-bold text-blue-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((customer, idx) => (
                      <tr 
                        key={customer._id} 
                        className="border-b hover:bg-blue-50 transition"
                      >
                        <td className="p-3 font-bold text-blue-600">{idx + 1}</td>
                        <td className="p-3 font-bold">{customer.name}</td>
                        <td className="p-3 text-green-600 font-bold">{customer.phone}</td>
                        <td className="p-3">
                          <span className="bg-yellow-100 text-yellow-900 px-3 py-1 rounded-full font-bold">
                            {customer.linkedVehicle?.regNo || customer.regNo || 'N/A'}
                          </span>
                        </td>
                        <td className="p-3 text-gray-700">{customer.linkedVehicle?.name || customer.vehicleName || 'N/A'}</td>
                        <td className="p-3">{customer.district || '-'}</td>
                        <td className="p-3">
                          {customer.aadhar ? (
                            <span className="bg-green-100 text-green-900 px-2 py-1 rounded text-xs font-bold">✅ {customer.aadhar.slice(-4)}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center flex gap-2 justify-center">
                          <Button
                            onClick={() => editCustomer(customer)}
                            className="bg-blue-500 text-white px-3 py-1 rounded flex items-center gap-1"
                          >
                            <Edit size={14} /> Edit
                          </Button>
                          <Button
                            onClick={() => deleteCustomer(customer._id)}
                            className="bg-red-500 text-white px-3 py-1 rounded flex items-center gap-1"
                          >
                            <Trash2 size={14} /> Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}