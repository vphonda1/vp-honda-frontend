import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Save } from 'lucide-react';
import { api } from '../utils/apiConfig';

export default function AddServiceCustomerPage() {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState({
    // Customer Details
    customerName: '',
    fatherName: '',
    dob: '',
    aadhar: '',
    pan: '',
    phone: '',
    email: '',
    address: '',
    district: '',
    pinCode: '',
    state: 'M.P.',

    // Vehicle Details
    vehicleName: '',
    vehicleColor: '',
    vehicleModel: '',
    engineNo: '',
    chassisNo: '',
    regNo: '',
    menuFactureDate: '',
    sellingDate: '',

    notes: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.customerName || !formData.phone || !formData.regNo) {
      alert('❌ कृपया Customer Name, Phone, और Registration Number अवश्य भरें!');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(api('/api/serviceCustomers'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        setSuccessMessage(`✅ Service Customer "${formData.customerName}" successfully added!`);
        
        // Reset form
        setFormData({
          customerName: '',
          fatherName: '',
          dob: '',
          aadhar: '',
          pan: '',
          phone: '',
          email: '',
          address: '',
          district: '',
          pinCode: '',
          state: 'M.P.',
          vehicleName: '',
          vehicleColor: '',
          vehicleModel: '',
          engineNo: '',
          chassisNo: '',
          regNo: '',
          menuFactureDate: '',
          sellingDate: '',
          notes: ''
        });

        // Close form after 2 seconds
        setTimeout(() => {
          setShowForm(false);
          setSuccessMessage('');
        }, 2000);
      } else {
        alert('❌ Error: ' + result.error);
      }
    } catch (error) {
      alert('❌ Error saving customer: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-purple-600 mb-6">➕ Add Service Customer</h1>

        {successMessage && (
          <div className="bg-green-100 border-2 border-green-600 text-green-800 px-4 py-3 rounded mb-4 font-bold">
            {successMessage}
          </div>
        )}

        <Button 
          onClick={() => setShowForm(!showForm)} 
          className="mb-6 bg-green-600 text-white font-bold"
        >
          <Plus className="mr-2" /> New Service Customer
        </Button>

        {showForm && (
          <Card className="shadow-xl">
            <CardHeader className="bg-purple-600 text-white">
              <CardTitle className="text-xl">📝 Service Customer & Vehicle Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">

                {/* ========== CUSTOMER DETAILS SECTION ========== */}
                <div className="border-2 border-blue-500 p-4 rounded bg-blue-50">
                  <h3 className="text-lg font-bold text-blue-900 mb-4">👤 Customer Details</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-1">Customer Name *</label>
                      <Input 
                        name="customerName"
                        value={formData.customerName}
                        onChange={handleInputChange}
                        placeholder="Enter customer name"
                        className="border-2"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">Father Name</label>
                      <Input 
                        name="fatherName"
                        value={formData.fatherName}
                        onChange={handleInputChange}
                        placeholder="Father's name"
                        className="border-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">Phone Number *</label>
                      <Input 
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="Mobile number"
                        className="border-2"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">Email</label>
                      <Input 
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="Email address"
                        className="border-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">Aadhar Number</label>
                      <Input 
                        name="aadhar"
                        value={formData.aadhar}
                        onChange={handleInputChange}
                        placeholder="Aadhar number"
                        className="border-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">PAN Number</label>
                      <Input 
                        name="pan"
                        value={formData.pan}
                        onChange={handleInputChange}
                        placeholder="PAN number"
                        className="border-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">Date of Birth</label>
                      <Input 
                        name="dob"
                        type="date"
                        value={formData.dob}
                        onChange={handleInputChange}
                        className="border-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">Address</label>
                      <Input 
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        placeholder="Address"
                        className="border-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">District</label>
                      <Input 
                        name="district"
                        value={formData.district}
                        onChange={handleInputChange}
                        placeholder="District"
                        className="border-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">PIN Code</label>
                      <Input 
                        name="pinCode"
                        value={formData.pinCode}
                        onChange={handleInputChange}
                        placeholder="PIN code"
                        className="border-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">State</label>
                      <Input 
                        name="state"
                        value={formData.state}
                        onChange={handleInputChange}
                        className="border-2"
                        disabled
                      />
                    </div>
                  </div>
                </div>

                {/* ========== VEHICLE DETAILS SECTION ========== */}
                <div className="border-2 border-red-500 p-4 rounded bg-red-50">
                  <h3 className="text-lg font-bold text-red-900 mb-4">🚗 Vehicle Details</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-1">Vehicle Name</label>
                      <Input 
                        name="vehicleName"
                        value={formData.vehicleName}
                        onChange={handleInputChange}
                        placeholder="e.g., Shine 125, SP125"
                        className="border-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">Registration Number *</label>
                      <Input 
                        name="regNo"
                        value={formData.regNo}
                        onChange={handleInputChange}
                        placeholder="e.g., MP04YC3487"
                        className="border-2"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">Chassis Number</label>
                      <Input 
                        name="chassisNo"
                        value={formData.chassisNo}
                        onChange={handleInputChange}
                        placeholder="Chassis number"
                        className="border-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">Engine Number</label>
                      <Input 
                        name="engineNo"
                        value={formData.engineNo}
                        onChange={handleInputChange}
                        placeholder="Engine number"
                        className="border-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">Color</label>
                      <Input 
                        name="vehicleColor"
                        value={formData.vehicleColor}
                        onChange={handleInputChange}
                        placeholder="e.g., Black, Red"
                        className="border-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">Model/Variant</label>
                      <Input 
                        name="vehicleModel"
                        value={formData.vehicleModel}
                        onChange={handleInputChange}
                        placeholder="e.g., 123.94 CC"
                        className="border-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">Manufacture Date</label>
                      <Input 
                        name="menuFactureDate"
                        type="date"
                        value={formData.menuFactureDate}
                        onChange={handleInputChange}
                        className="border-2"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-1">Selling Date</label>
                      <Input 
                        name="sellingDate"
                        type="date"
                        value={formData.sellingDate}
                        onChange={handleInputChange}
                        className="border-2"
                      />
                    </div>
                  </div>
                </div>

                {/* ========== NOTES SECTION ========== */}
                <div className="border-2 border-yellow-500 p-4 rounded bg-yellow-50">
                  <h3 className="text-lg font-bold text-yellow-900 mb-4">📝 Additional Notes</h3>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Any additional information..."
                    className="w-full border-2 p-3 rounded"
                    rows="3"
                  />
                </div>

                {/* ========== BUTTONS ========== */}
                <div className="flex gap-4">
                  <Button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3"
                  >
                    <Save className="mr-2" /> 
                    {loading ? 'Saving...' : 'Save Service Customer'}
                  </Button>
                  <Button 
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 bg-gray-600 text-white font-bold py-3"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}