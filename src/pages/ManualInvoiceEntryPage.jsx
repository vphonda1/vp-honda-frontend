import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Save, X } from 'lucide-react';
import { EventBus, EVENTS } from '../utils/EventBus';
import { syncInvoiceWithInventory } from '../utils/InventorySyncManager';
import { api } from '../utils/apiConfig';

export default function ManualInvoiceEntryPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  
  // Customer Details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceType, setServiceType] = useState('General Service');
  
  // Parts
  const [parts, setParts] = useState([]);
  const [partNo, setPartNo] = useState('');
  const [partDesc, setPartDesc] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);

  // Add Part
  const handleAddPart = () => {
    if (!partNo.trim() || quantity <= 0 || price <= 0) {
      setMessage('❌ Please fill all part details');
      return;
    }

    const newPart = {
      partNo: partNo.trim(),
      description: partDesc.trim() || partNo.trim(),
      quantity: parseInt(quantity),
      price: parseFloat(price),
      total: parseInt(quantity) * parseFloat(price)
    };

    setParts([...parts, newPart]);
    setPartNo('');
    setPartDesc('');
    setQuantity(1);
    setPrice(0);
    setMessage('✅ Part added!');
    setTimeout(() => setMessage(''), 2000);
  };

  // Remove Part
  const handleRemovePart = (index) => {
    setParts(parts.filter((_, i) => i !== index));
  };

  // Calculate Total
  const calculateTotal = () => {
    return parts.reduce((sum, p) => sum + p.total, 0);
  };

  // Save Invoice
  const handleSaveInvoice = () => {
    // Validation
    if (!customerName.trim()) {
      setMessage('❌ Please enter customer name');
      return;
    }
    if (parts.length === 0) {
      setMessage('❌ Please add at least one part');
      return;
    }

    try {
      // Generate invoice number
      const invoiceNumber = Math.floor(Math.random() * 100000) + Date.now() % 1000;
      const totalAmount = calculateTotal();
      const taxAmount = Math.round(totalAmount * 0.18);

      // Create invoice object
      const invoice = {
        invoiceNumber,
        customerName,
        customerPhone,
        vehicleName,
        regNo,
        invoiceDate,
        serviceType,
        customerId: `manual-${Date.now()}`,
        totals: {
          totalAmount: totalAmount,
          taxAmount: taxAmount,
          netAmount: totalAmount
        },
        items: parts,
        importedFrom: 'Manual Entry',
        importTimestamp: new Date().toISOString(),
        isManualEntry: true
      };

      // Save to localStorage
      const invoices = JSON.parse(localStorage.getItem('invoices')) || [];
      invoices.push(invoice);
      localStorage.setItem('invoices', JSON.stringify(invoices));
    // Sync to MongoDB
    fetch(api('/api/invoices'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(newInvoice) }).catch(()=>{});

      // Sync inventory
      syncInvoiceWithInventory(invoice);

      // Emit event for real-time updates
      EventBus.emit(EVENTS.INVOICE_CREATED, invoice);
      EventBus.emit(EVENTS.DASHBOARD_REFRESH, {});

      setMessage(`✅ Invoice #${invoiceNumber} created successfully!`);
      
      // Reset form
      setTimeout(() => {
        setCustomerName('');
        setCustomerPhone('');
        setVehicleName('');
        setRegNo('');
        setParts([]);
        setInvoiceDate(new Date().toISOString().split('T')[0]);
        setServiceType('General Service');
      }, 2000);

    } catch (error) {
      console.error('Error saving invoice:', error);
      setMessage('❌ Error saving invoice');
    }
  };

  const totalAmount = calculateTotal();
  const taxAmount = Math.round(totalAmount * 0.18);
  const grandTotal = totalAmount + taxAmount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">📝 Manual Invoice Entry</h1>
            <p className="text-slate-400">Create invoices manually with complete details</p>
          </div>
          <Button
            onClick={() => navigate('/invoice-management')}
            className="bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-2"
          >
            <X size={20} /> Close
          </Button>
        </div>

        {/* MESSAGE */}
        {message && (
          <Card className={`${message.includes('✅') ? 'bg-green-900/20 border-green-500' : 'bg-red-900/20 border-red-500'}`}>
            <CardContent className="pt-4">
              <p className={message.includes('✅') ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{message}</p>
            </CardContent>
          </Card>
        )}

        {/* CUSTOMER DETAILS */}
        <Card className="bg-slate-800 border-slate-700 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <CardTitle>👤 Customer & Vehicle Details</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 text-sm font-bold">Customer Name *</label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  className="mt-2 bg-slate-700 border-slate-600 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 text-sm font-bold">Phone Number</label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Enter phone number"
                  className="mt-2 bg-slate-700 border-slate-600 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 text-sm font-bold">Vehicle Name</label>
                <Input
                  value={vehicleName}
                  onChange={(e) => setVehicleName(e.target.value)}
                  placeholder="Enter vehicle name (e.g., Honda City)"
                  className="mt-2 bg-slate-700 border-slate-600 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 text-sm font-bold">Registration No</label>
                <Input
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value)}
                  placeholder="Enter registration number"
                  className="mt-2 bg-slate-700 border-slate-600 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 text-sm font-bold">Invoice Date</label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="mt-2 bg-slate-700 border-slate-600 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 text-sm font-bold">Service Type</label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="mt-2 w-full bg-slate-700 border border-slate-600 text-white p-2 rounded"
                >
                  <option>General Service</option>
                  <option>First Service</option>
                  <option>Second Service</option>
                  <option>Maintenance</option>
                  <option>Repair</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ADD PARTS */}
        <Card className="bg-slate-800 border-slate-700 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white">
            <CardTitle>📦 Add Parts/Items</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="text-slate-300 text-sm font-bold">Part No *</label>
                <Input
                  value={partNo}
                  onChange={(e) => setPartNo(e.target.value)}
                  placeholder="e.g., Brake Pad"
                  className="mt-2 bg-slate-700 border-slate-600 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 text-sm font-bold">Description</label>
                <Input
                  value={partDesc}
                  onChange={(e) => setPartDesc(e.target.value)}
                  placeholder="Description"
                  className="mt-2 bg-slate-700 border-slate-600 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 text-sm font-bold">Qty *</label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  min="1"
                  className="mt-2 bg-slate-700 border-slate-600 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 text-sm font-bold">Price *</label>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  min="0"
                  placeholder="₹"
                  className="mt-2 bg-slate-700 border-slate-600 text-white"
                />
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handleAddPart}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold flex items-center justify-center gap-2"
                >
                  <Plus size={20} /> Add
                </Button>
              </div>
            </div>

            {/* PARTS TABLE */}
            {parts.length > 0 && (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-600">
                      <th className="text-left text-slate-300 py-3">Part No</th>
                      <th className="text-center text-slate-300 py-3">Qty</th>
                      <th className="text-right text-slate-300 py-3">Price</th>
                      <th className="text-right text-slate-300 py-3">Total</th>
                      <th className="text-center text-slate-300 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map((part, idx) => (
                      <tr key={idx} className="border-b border-slate-700 hover:bg-slate-700/50">
                        <td className="py-3 text-white">{part.partNo}</td>
                        <td className="py-3 text-center text-white">{part.quantity}</td>
                        <td className="py-3 text-right text-green-400 font-bold">₹{part.price.toLocaleString('en-IN')}</td>
                        <td className="py-3 text-right text-blue-400 font-bold">₹{part.total.toLocaleString('en-IN')}</td>
                        <td className="py-3 text-center">
                          <Button
                            onClick={() => handleRemovePart(idx)}
                            className="bg-red-600 hover:bg-red-700 text-white py-1 px-2 text-xs"
                          >
                            <Trash2 size={14} />
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

        {/* SUMMARY */}
        {parts.length > 0 && (
          <Card className="bg-slate-800 border-slate-700 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
              <CardTitle>💰 Amount Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-semibold">Subtotal:</span>
                <span className="text-white font-bold">₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-semibold">GST (18%):</span>
                <span className="text-white font-bold">₹{taxAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="border-t border-slate-600 pt-3 flex justify-between items-center">
                <span className="text-white font-bold text-lg">Grand Total:</span>
                <span className="text-green-400 font-bold text-2xl">₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ACTION BUTTONS */}
        <div className="flex gap-4">
          <Button
            onClick={handleSaveInvoice}
            disabled={parts.length === 0 || !customerName}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-4 text-lg flex items-center justify-center gap-2"
          >
            <Save size={24} /> Save Invoice
          </Button>
          <Button
            onClick={() => navigate('/invoice-management')}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 text-lg"
          >
            Cancel
          </Button>
        </div>

      </div>
    </div>
  );
}