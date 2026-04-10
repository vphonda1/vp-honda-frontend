import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Trash2, Eye, Edit2 } from 'lucide-react';
import { api } from '../utils/apiConfig';

export default function ServiceCustomerListPage() {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch(api('/api/serviceCustomers?limit=100'));
      const data = await res.json();
      
      if (data.success) {
        setCustomers(data.data);
        setFilteredCustomers(data.data);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    filterCustomers(query, dateFilter);
  };

  const handleDateFilter = (date) => {
    setDateFilter(date);
    filterCustomers(searchQuery, date);
  };

  const filterCustomers = (query, date) => {
    let filtered = customers;

    // Search filter
    if (query) {
      filtered = filtered.filter(cust => 
        cust.customerName.toLowerCase().includes(query.toLowerCase()) ||
        cust.phone.includes(query) ||
        cust.regNo.toLowerCase().includes(query.toLowerCase()) ||
        cust.aadhar?.includes(query)
      );
    }

    // Date filter
    if (date) {
      const filterDate = new Date(date);
      filtered = filtered.filter(cust => {
        const custDate = new Date(cust.createdAt);
        return custDate.toDateString() === filterDate.toDateString();
      });
    }

    setFilteredCustomers(filtered);
  };

  const handleViewCustomer = (customer) => {
    setSelectedCustomer(customer);
    setShowDetail(true);
  };

  const handleDeleteCustomer = async (id) => {
    if (!window.confirm('क्या आप यह service customer delete करना चाहते हैं?')) return;

    try {
      const res = await fetch(api(`/api/serviceCustomers/${id}`), {
        method: 'DELETE'
      });

      if (res.ok) {
        alert('✅ Service customer deleted successfully');
        loadCustomers();
      }
    } catch (error) {
      alert('❌ Error deleting customer: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-purple-600 mb-6">📋 Service Customers</h1>

        {/* Filters */}
        <Card className="mb-6 shadow-lg">
          <CardHeader className="bg-purple-600 text-white">
            <CardTitle>🔍 Search & Filter</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Search</label>
                <div className="flex">
                  <Input
                    placeholder="Name / Phone / Reg No / Aadhar"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="border-2"
                  />
                  <Button className="ml-2 bg-blue-600">
                    <Search size={20} />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Filter by Date</label>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => handleDateFilter(e.target.value)}
                  className="border-2"
                />
              </div>

              <div className="flex items-end">
                <Button
                  onClick={() => {
                    setSearchQuery('');
                    setDateFilter('');
                    setFilteredCustomers(customers);
                  }}
                  className="w-full bg-gray-600"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-gray-600 text-sm">Total Service Customers</p>
                <p className="text-3xl font-bold text-purple-600">{customers.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-gray-600 text-sm">Filtered Results</p>
                <p className="text-3xl font-bold text-blue-600">{filteredCustomers.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customers Table */}
        <Card className="shadow-xl">
          <CardHeader className="bg-blue-600 text-white">
            <CardTitle>📜 Service Customers List</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                कोई service customers नहीं मिले।
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-gray-300">
                      <th className="border p-3 text-left font-bold">Customer Name</th>
                      <th className="border p-3 text-left font-bold">Phone</th>
                      <th className="border p-3 text-left font-bold">Registration No</th>
                      <th className="border p-3 text-left font-bold">Vehicle Name</th>
                      <th className="border p-3 text-left font-bold">Added Date</th>
                      <th className="border p-3 text-center font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((customer) => (
                      <tr key={customer._id} className="border-b hover:bg-gray-50 transition">
                        <td className="border p-3 font-semibold">{customer.customerName}</td>
                        <td className="border p-3">
                          <a href={`tel:${customer.phone}`} className="text-blue-600 hover:underline">
                            {customer.phone}
                          </a>
                        </td>
                        <td className="border p-3">
                          <span className="bg-yellow-100 px-2 py-1 rounded font-bold">
                            {customer.regNo}
                          </span>
                        </td>
                        <td className="border p-3">{customer.vehicleName || 'N/A'}</td>
                        <td className="border p-3 text-sm">
                          {new Date(customer.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="border p-3 text-center space-x-2">
                          <Button
                            size="sm"
                            onClick={() => handleViewCustomer(customer)}
                            className="bg-blue-600 text-white"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleDeleteCustomer(customer._id)}
                            className="bg-red-600 text-white"
                            title="Delete"
                          >
                            <Trash2 size={16} />
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

        {/* Detail Modal */}
        {showDetail && selectedCustomer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-4xl max-h-96 overflow-y-auto">
              <CardHeader className="bg-purple-600 text-white flex justify-between items-center">
                <CardTitle>👤 {selectedCustomer.customerName}</CardTitle>
                <button
                  onClick={() => setShowDetail(false)}
                  className="text-2xl font-bold hover:bg-purple-700 px-3 py-1 rounded"
                >
                  ✕
                </button>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                
                {/* Customer Details */}
                <div className="border-2 border-blue-500 p-4 rounded bg-blue-50">
                  <h3 className="font-bold text-lg mb-3 text-blue-900">👤 Customer Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Name</p>
                      <p className="font-bold">{selectedCustomer.customerName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Father Name</p>
                      <p className="font-bold">{selectedCustomer.fatherName || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-bold">{selectedCustomer.phone}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-bold">{selectedCustomer.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Aadhar</p>
                      <p className="font-bold">{selectedCustomer.aadhar || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">PAN</p>
                      <p className="font-bold">{selectedCustomer.pan || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-gray-600">Address</p>
                      <p className="font-bold">{selectedCustomer.address || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Vehicle Details */}
                <div className="border-2 border-red-500 p-4 rounded bg-red-50">
                  <h3 className="font-bold text-lg mb-3 text-red-900">🚗 Vehicle Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Vehicle Name</p>
                      <p className="font-bold">{selectedCustomer.vehicleName || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Registration</p>
                      <p className="font-bold text-blue-600">{selectedCustomer.regNo}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Chassis No</p>
                      <p className="font-bold">{selectedCustomer.chassisNo || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Engine No</p>
                      <p className="font-bold">{selectedCustomer.engineNo || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Color</p>
                      <p className="font-bold">{selectedCustomer.vehicleColor || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Model</p>
                      <p className="font-bold">{selectedCustomer.vehicleModel || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => setShowDetail(false)}
                  className="w-full bg-gray-600 text-white py-2"
                >
                  Close
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}