import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EventBus, EVENTS } from '../utils/EventBus';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, Users, Package, ShoppingCart, IndianRupee, Zap, AlertCircle, Download, RefreshCw } from 'lucide-react';

// ✅ IMPORTS FROM UTILITY FILES
import { getTaxInvoiceStats, syncInvoiceWithInventory, getPartsWiseRevenue } from '../utils/InventorySyncManager';
import { getInventoryStats, getTopSoldParts, getLowStockAlerts } from '../utils/PartsInventoryManager';
import { api } from '../utils/apiConfig';

export default function ComprehensiveDashboard() {
  // ===== ALL STATE VARIABLES (TOP LEVEL) =====
  const [invoiceData, setInvoiceData] = useState([]);
  const [customerData, setCustomerData] = useState([]);
  const [partsData, setPartsData] = useState([]);
  const [newCustomerData, setNewCustomerData] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // NEW STATE VARIABLES FOR TAX INVOICES & INVENTORY
  const [taxInvoiceStats, setTaxInvoiceStats] = useState({
    totalTaxInvoices: 0,
    totalRevenue: 0,
    averageInvoiceValue: 0,
    totalPartsSold: 0
  });

  const [inventoryStats, setInventoryStats] = useState({
    totalParts: 0,
    totalStock: 0,
    lowStockCount: 0
  });

  const [topSoldParts, setTopSoldParts] = useState([]);

  // ===== LOAD ALL DATA =====
  useEffect(() => {
    loadAllData();
  }, []);

  // ===== EVENT BUS SUBSCRIPTION =====
  useEffect(() => {
    const unsubscribe = EventBus.subscribe(EVENTS.DASHBOARD_REFRESH, () => {
      console.log('📢 ComprehensiveDashboard: Refreshing...');
      loadAllData();
    });
    return () => unsubscribe();
  }, []);

  const loadAllData = async () => {
    try {
      // Load invoices
      let savedInvoices = JSON.parse(localStorage.getItem('invoices')) || [];
      // MongoDB fallback
      if (savedInvoices.length === 0) {
        try { const r=await fetch(api('/api/invoices')); if(r.ok) savedInvoices=await r.json(); } catch{}
      }
      setInvoiceData(savedInvoices);

      // Load customers
      try {
        const res = await fetch(api('/api/customers'));
        if (res.ok) {
          const data = await res.json();
          setCustomerData(data || []);
        }
      } catch (e) {
        console.warn('Error loading customers');
      }

      // Load parts
      try {
        const res = await fetch(api('/api/parts'));
        if (res.ok) {
          const data = await res.json();
          setPartsData(data || []);
        }
      } catch (e) {
        console.warn('Error loading parts');
      }

      // Load new customers
      let newCust = JSON.parse(localStorage.getItem('newCustomers')) || [];
      if (newCust.length === 0) {
        try { const r=await fetch(api('/api/customers')); if(r.ok) newCust=(await r.json()).filter(c=>c.isNew); } catch{}
      }
      setNewCustomerData(newCust);

      // ✅ LOAD FROM IMPORTED FUNCTIONS
      const stats = getTaxInvoiceStats();
      setTaxInvoiceStats(stats);

      const invStats = getInventoryStats();
      setInventoryStats(invStats);

      const topParts = getTopSoldParts(5);
      setTopSoldParts(topParts);

    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  // ===== CALCULATIONS =====

  // Revenue & Profit Calculations
  const totalRevenue = invoiceData.reduce((sum, inv) => sum + (inv.totals?.totalAmount || 0), 0);
  const totalExpense = invoiceData.reduce((sum, inv) => sum + (inv.totals?.taxAmount || 0), 0);
  const totalProfit = totalRevenue - totalExpense;
  const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0;

  // Monthly breakdown
  const monthlyData = {};
  invoiceData.forEach(inv => {
    const month = new Date(inv.invoiceDate).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    if (!monthlyData[month]) {
      monthlyData[month] = { month, revenue: 0, invoices: 0, profit: 0 };
    }
    monthlyData[month].revenue += inv.totals?.totalAmount || 0;
    monthlyData[month].invoices += 1;
    monthlyData[month].profit += (inv.totals?.totalAmount || 0) - (inv.totals?.taxAmount || 0);
  });
  const monthlyChartData = Object.values(monthlyData).slice(-12);

  // Customer metrics
  const totalCustomers = customerData.length + newCustomerData.length;
  const customersWithVehicles = customerData.filter(c => c.linkedVehicle?.regNo).length + 
                                 newCustomerData.filter(c => c.linkedVehicle?.regNo).length;
  const customerGrowthRate = totalCustomers > 0 ? ((newCustomerData.length / totalCustomers) * 100).toFixed(1) : 0;

  // Invoice metrics
  const totalInvoices = invoiceData.length;
  const averageInvoiceValue = totalInvoices > 0 ? (totalRevenue / totalInvoices).toFixed(2) : 0;
  const invoicesByMonth = monthlyChartData.map(m => m.invoices);
  const avgInvoicePerMonth = monthlyChartData.length > 0 ? (invoicesByMonth.reduce((a, b) => a + b) / monthlyChartData.length).toFixed(1) : 0;

  // Parts metrics
  const totalPartsUsed = invoiceData.reduce((sum, inv) => sum + (inv.parts?.length || 0), 0);
  const uniquePartsUsed = new Set(invoiceData.flatMap(inv => inv.parts?.map(p => p.partNo) || [])).size;

  // Service metrics (from invoices)
  const serviceTypes = {};
  invoiceData.forEach(inv => {
    const type = inv.serviceDetails?.serviceType || 'Unknown';
    serviceTypes[type] = (serviceTypes[type] || 0) + 1;
  });
  const serviceData = Object.entries(serviceTypes).map(([name, value]) => ({ name, value }));

  // Top customers by revenue
  const customerRevenue = {};
  invoiceData.forEach(inv => {
    if (!customerRevenue[inv.customerName]) {
      customerRevenue[inv.customerName] = 0;
    }
    customerRevenue[inv.customerName] += inv.totals?.totalAmount || 0;
  });
  const topCustomers = Object.entries(customerRevenue)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  // Vehicle type distribution
  const vehicleTypes = {};
  invoiceData.forEach(inv => {
    const vehName = inv.vehicleDetails?.name || 'Unknown';
    vehicleTypes[vehName] = (vehicleTypes[vehName] || 0) + 1;
  });
  const vehicleChartData = Object.entries(vehicleTypes)
    .map(([name, value]) => ({ name, value }))
    .slice(0, 5);

  // Payment mode distribution
  const paymentModes = {};
  invoiceData.forEach(inv => {
    const mode = inv.serviceDetails?.paymentMode || 'Unknown';
    paymentModes[mode] = (paymentModes[mode] || 0) + 1;
  });
  const paymentData = Object.entries(paymentModes).map(([name, value]) => ({ name, value }));

  // Colors
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">📊 VP Honda Dashboard</h1>
            <p className="text-slate-400">Complete Dealership Analytics & Insights</p>
          </div>
          <Button 
            onClick={handleRefresh}
            className="bg-blue-600 text-white font-bold flex items-center gap-2"
            disabled={refreshing}
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
         </div>

        {/* KEY METRICS - ROW 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Revenue */}
          <Card className="bg-gradient-to-br from-blue-600 to-blue-800 text-white border-0 shadow-2xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-semibold">Total Revenue</p>
                  <h3 className="text-3xl font-bold mt-2">₹{(totalRevenue / 100000).toFixed(2)}L</h3>
                  <p className="text-blue-200 text-xs mt-2">{invoiceData.length} invoices</p>
                </div>
                <div className="bg-blue-500 p-4 rounded-lg">
                  <IndianRupee size={32} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Profit */}
          <Card className={`bg-gradient-to-br ${totalProfit >= 0 ? 'from-green-600 to-green-800' : 'from-red-600 to-red-800'} text-white border-0 shadow-2xl`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-semibold">Total Profit</p>
                  <h3 className="text-3xl font-bold mt-2">₹{(totalProfit / 100000).toFixed(2)}L</h3>
                  <p className="text-green-200 text-xs mt-2">{profitMargin}% margin</p>
                </div>
                <div className={`${totalProfit >= 0 ? 'bg-green-500' : 'bg-red-500'} p-4 rounded-lg`}>
                  {totalProfit >= 0 ? <TrendingUp size={32} /> : <TrendingDown size={32} />}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Customers */}
          <Card className="bg-gradient-to-br from-purple-600 to-purple-800 text-white border-0 shadow-2xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-semibold">Total Customers</p>
                  <h3 className="text-3xl font-bold mt-2">{totalCustomers}</h3>
                  <p className="text-purple-200 text-xs mt-2">{customersWithVehicles} with vehicles</p>
                </div>
                <div className="bg-purple-500 p-4 rounded-lg">
                  <Users size={32} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Parts */}
          <Card className="bg-gradient-to-br from-orange-600 to-orange-800 text-white border-0 shadow-2xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-semibold">Inventory</p>
                  <h3 className="text-3xl font-bold mt-2">{partsData.length}</h3>
                  <p className="text-orange-200 text-xs mt-2">{uniquePartsUsed} used recently</p>
                </div>
                <div className="bg-orange-500 p-4 rounded-lg">
                  <Package size={32} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SECONDARY METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-800 border-slate-700 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
              <CardTitle className="text-lg">Average Invoice Value</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <h3 className="text-3xl font-bold text-white">₹{(averageInvoiceValue / 1000).toFixed(1)}K</h3>
              <p className="text-slate-400 text-sm mt-2">Per transaction</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-cyan-600 to-cyan-700 text-white">
              <CardTitle className="text-lg">New Customers</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <h3 className="text-3xl font-bold text-white">{newCustomerData.length}</h3>
              <p className="text-slate-400 text-sm mt-2">{customerGrowthRate}% growth</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-pink-600 to-pink-700 text-white">
              <CardTitle className="text-lg">Avg Monthly Invoices</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <h3 className="text-3xl font-bold text-white">{avgInvoicePerMonth}</h3>
              <p className="text-slate-400 text-sm mt-2">Last 12 months</p>
            </CardContent>
          </Card>
        </div>

        {/* CHARTS ROW 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Revenue Trend */}
          <Card className="bg-slate-800 border-slate-700 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp size={20} /> Monthly Revenue Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyChartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Invoice Distribution */}
          <Card className="bg-slate-800 border-slate-700 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart size={20} /> Invoices by Month
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                  <Bar dataKey="invoices" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* PARTS DISTRIBUTION CHART */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Parts Distribution Pie Chart */}
          <Card className="bg-slate-800 border-slate-700 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-pink-600 to-pink-700 text-white">
              <CardTitle className="flex items-center gap-2">
                <Package size={20} /> Parts Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={serviceData.length > 0 ? serviceData : [{ name: 'No Data', value: 1 }]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name} (${value})`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(serviceData.length > 0 ? serviceData : [{ name: 'No Data', value: 1 }]).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Vehicles Distribution */}
          <Card className="bg-slate-800 border-slate-700 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-cyan-600 to-cyan-700 text-white">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp size={20} /> Vehicle Types
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={vehicleChartData.length > 0 ? vehicleChartData : [{ name: 'No Data', value: 0 }]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                  <Bar dataKey="value" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* CHARTS ROW 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Service Type Distribution */}
          <Card className="bg-slate-800 border-slate-700 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Zap size={20} /> Service Types
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={serviceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {serviceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Payment Mode Distribution */}
          <Card className="bg-slate-800 border-slate-700 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-rose-600 to-rose-700 text-white">
              <CardTitle className="flex items-center gap-2 text-sm">
                💳 Payment Modes
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {paymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Vehicle Type Distribution */}
          <Card className="bg-slate-800 border-slate-700 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-amber-600 to-amber-700 text-white">
              <CardTitle className="flex items-center gap-2 text-sm">
                🚗 Popular Models
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  layout="vertical"
                  data={vehicleChartData}
                  margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis type="number" stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" width={140} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                  <Bar dataKey="value" fill="#f59e0b" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* TOP CUSTOMERS */}
        <Card className="bg-slate-800 border-slate-700 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
            <CardTitle className="flex items-center gap-2">
              👑 Top 5 Customers by Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {topCustomers.map((customer, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-slate-700 rounded-lg hover:bg-slate-600 transition">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{customer.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-bold">₹{(customer.value / 1000).toFixed(1)}K</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* DETAILED METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-slate-800 border-slate-700 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-300 font-semibold">Total Parts Used</h3>
                <Package className="text-orange-500" size={24} />
              </div>
              <p className="text-3xl font-bold text-white">{totalPartsUsed}</p>
              <p className="text-slate-400 text-sm mt-2">In all invoices</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-300 font-semibold">Unique Parts Used</h3>
                <ShoppingCart className="text-blue-500" size={24} />
              </div>
              <p className="text-3xl font-bold text-white">{uniquePartsUsed}</p>
              <p className="text-slate-400 text-sm mt-2">Different items</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-300 font-semibold">Vehicles Serviced</h3>
                <Zap className="text-yellow-500" size={24} />
              </div>
              <p className="text-3xl font-bold text-white">{customersWithVehicles}</p>
              <p className="text-slate-400 text-sm mt-2">With vehicles</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-300 font-semibold">Profit Margin</h3>
                <TrendingUp className="text-green-500" size={24} />
              </div>
              <p className="text-3xl font-bold text-white">{profitMargin}%</p>
              <p className="text-slate-400 text-sm mt-2">Overall margin</p>
            </CardContent>
          </Card>
        </div>

        {/* SUMMARY STATISTICS */}
        <Card className="bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700 shadow-2xl">
          <CardHeader className="bg-gradient-to-r from-slate-700 to-slate-800 text-white">
            <CardTitle>📈 System Summary & Insights</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="border-l-4 border-blue-500 pl-4 py-2">
                <p className="text-slate-400 text-sm">Total Transactions</p>
                <p className="text-2xl font-bold text-white">{invoiceData.length}</p>
                <p className="text-slate-500 text-xs mt-1">Generated invoices</p>
              </div>
              <div className="border-l-4 border-green-500 pl-4 py-2">
                <p className="text-slate-400 text-sm">Business Health</p>
                <p className="text-2xl font-bold text-green-400">Excellent</p>
                <p className="text-slate-500 text-xs mt-1">Positive cash flow</p>
              </div>
              <div className="border-l-4 border-purple-500 pl-4 py-2">
                <p className="text-slate-400 text-sm">Customer Retention</p>
                <p className="text-2xl font-bold text-white">{totalCustomers > 0 ? ((customersWithVehicles / totalCustomers) * 100).toFixed(1) : 0}%</p>
                <p className="text-slate-500 text-xs mt-1">Active customers</p>
              </div>
              <div className="border-l-4 border-orange-500 pl-4 py-2">
                <p className="text-slate-400 text-sm">Average Monthly Revenue</p>
                <p className="text-2xl font-bold text-white">₹{(monthlyChartData.length > 0 ? (monthlyChartData.reduce((sum, m) => sum + m.revenue, 0) / monthlyChartData.length) / 100000 : 0).toFixed(2)}L</p>
                <p className="text-slate-500 text-xs mt-1">Last 12 months</p>
              </div>
              <div className="border-l-4 border-cyan-500 pl-4 py-2">
                <p className="text-slate-400 text-sm">Parts Inventory</p>
                <p className="text-2xl font-bold text-white">{partsData.length}</p>
                <p className="text-slate-500 text-xs mt-1">Total items</p>
              </div>
              <div className="border-l-4 border-pink-500 pl-4 py-2">
                <p className="text-slate-400 text-sm">Last Updated</p>
                <p className="text-2xl font-bold text-white">Now</p>
                <p className="text-slate-500 text-xs mt-1">Real-time data</p>
              </div>
            </div>
          </CardContent>
        </Card>
       
        {/* TAX INVOICE STATISTICS SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
          <Card className="bg-purple-900/20 border-purple-500">
            <CardContent className="pt-6">
              <p className="text-purple-200 text-sm">Total Tax Invoices</p>
              <h3 className="text-4xl font-bold text-purple-400 mt-2">
                {taxInvoiceStats?.totalTaxInvoices || 0}
              </h3>
            </CardContent>
          </Card>

          <Card className="bg-green-900/20 border-green-500">
            <CardContent className="pt-6">
              <p className="text-green-200 text-sm">Tax Invoice Revenue</p>
              <h3 className="text-3xl font-bold text-green-400 mt-2">
                ₹{((taxInvoiceStats?.totalRevenue || 0) / 100000).toFixed(2)}L
              </h3>
            </CardContent>
          </Card>

          <Card className="bg-blue-900/20 border-blue-500">
            <CardContent className="pt-6">
              <p className="text-blue-200 text-sm">Avg Invoice Value</p>
              <h3 className="text-3xl font-bold text-blue-400 mt-2">
                ₹{Math.round(taxInvoiceStats?.averageInvoiceValue || 0).toLocaleString('en-IN')}
              </h3>
            </CardContent>
          </Card>

          <Card className="bg-orange-900/20 border-orange-500">
            <CardContent className="pt-6">
              <p className="text-orange-200 text-sm">Total Parts Sold</p>
              <h3 className="text-4xl font-bold text-orange-400 mt-2">
                {taxInvoiceStats?.totalPartsSold || 0}
              </h3>
            </CardContent>
          </Card>
        </div>

        {/* PARTS INVENTORY STATUS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <p className="text-slate-200 text-sm">Total Parts in Stock</p>
              <h3 className="text-4xl font-bold text-slate-300 mt-2">
                {inventoryStats?.totalStock || 0}
              </h3>
            </CardContent>
          </Card>

          <Card className="bg-yellow-900/20 border-yellow-500">
            <CardContent className="pt-6">
              <p className="text-yellow-200 text-sm">Low Stock Alert</p>
              <h3 className="text-4xl font-bold text-yellow-400 mt-2">
                {inventoryStats?.lowStockCount || 0}
              </h3>
              <p className="text-yellow-300 text-xs mt-2">Parts with stock &lt; 10</p>
            </CardContent>
          </Card>

          <Card className="bg-red-900/20 border-red-500">
            <CardContent className="pt-6">
              <p className="text-red-200 text-sm">Unique Parts</p>
              <h3 className="text-4xl font-bold text-red-400 mt-2">
                {inventoryStats?.totalParts || 0}
              </h3>
            </CardContent>
          </Card>
        </div>

        {/* TOP SOLD PARTS CHART */}
        {topSoldParts && topSoldParts.length > 0 && (
          <Card className="bg-slate-800 border-slate-700 mt-8">
            <CardHeader>
              <CardTitle className="text-white">🏆 Top 5 Sold Parts</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topSoldParts}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="partNo" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="soldCount" fill="#10b981" name="Sold Qty" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* FOOTER */}
        <div className="text-center text-slate-500 text-sm pt-8 border-t border-slate-700">
          <p>🔄 Dashboard updates automatically | Last refresh: {new Date().toLocaleString('en-IN')}</p>
          <p className="mt-2">VP Honda Dealership Management System © 2026</p>
        </div>
      </div>
    </div>
  );
}