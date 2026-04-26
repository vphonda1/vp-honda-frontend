import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage, { doLogout } from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import JobCardPage from './pages/JobCardPage';
import PartsManagement from './pages/PartsManagement';
import CustomerManagement from './pages/CustomerManagement';
import NewCustomersPage from './pages/NewCustomersPage';
import ComprehensiveDashboard from './pages/ComprehensiveDashboard';
import ReportsAnalytics from './pages/ReportsAnalytics';
import AdminPanel from './pages/AdminPanel';
import DataManagement from './pages/DataManagement';
import RemindersPage from './pages/RemindersPage';
import CustomerServiceProfile from './pages/CustomerServiceProfile';
import CustomerServiceDataManager from './pages/CustomerServiceDataManager';
import DiagnosticPage from './pages/DiagnosticPage';
import InvoiceManagementDashboard from './pages/InvoiceManagementDashboard';
import InvoiceDetailsPage from './pages/InvoiceDetailsPage';
import AdvancedPDFImporter from './pages/AdvancedPDFImporter';
import ManualInvoiceEntryPage from './pages/ManualInvoiceEntryPage';
import StaffManagementPage from './pages/StaffManagementPage';
import SalaryManagementPage from './pages/SalaryManagementPage';
import QuotationPage from './pages/QuotationPage';
import VehDashboard from './pages/VehDashboard';
import VPHondaDashboard from './pages/VPHondaDashboard';
import AddServiceCustomerPage from './pages/AddServiceCustomerPage';
import ServiceCustomerListPage from './pages/ServiceCustomerListPage';
import Dashboardwebpage from './pages/Dashboardwebpage';
import VisitorCounter from './pages/VisitorCounter';
import PickupDropTracker from './pages/PickupDropTracker';
import Navbar from './components/Navbar';
import UniversalSearch from './components/UniversalSearch';
import { requestNotificationPermission, showInAppToast } from './utils/smartUtils';

function ProtectedRoute({ children, user }) {
  return user ? children : <Navigate to="/login" />;
}

function RoleRoute({ children, user, requiredRole }) {
  if (!user) return <Navigate to="/login" />;
  if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
    return <Navigate to="/dashboard" />;
  }
  return children;
}

// ── Staff को admin-only routes पर redirect ─────────────────────────────────
function AdminRoute({ children, user }) {
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // LoginPage का vpSession check करें (नया system)
    try {
      const vpSession = localStorage.getItem('vpSession');
      if (vpSession) {
        const parsed = JSON.parse(vpSession);
        if (parsed && parsed.role) {
          setUser(parsed);
          // vpHondaUser भी sync करें (backward compat)
          localStorage.setItem('vpHondaUser', JSON.stringify(parsed));
          setLoading(false);
          return;
        }
      }
    } catch {}

    // Fallback: पुराना vpHondaUser check
    try {
      const savedUser = localStorage.getItem('vpHondaUser');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
      }
    } catch (error) {
      console.error('Error parsing user:', error);
      localStorage.removeItem('vpHondaUser');
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    // दोनों keys save करें
    localStorage.setItem('vpHondaUser', JSON.stringify(userData));
    localStorage.setItem('vpSession', JSON.stringify(userData));
    if (userData.role === 'admin') {
      localStorage.setItem('vpAdminSession', 'true');
    }
    // ⭐ Request notification permission on first login
    setTimeout(() => {
      requestNotificationPermission().then(granted => {
        if (granted) {
          showInAppToast('🔔 Notifications enabled', `नमस्ते ${userData.name || 'User'}! VP Honda की updates आपको अब सीधे मिलेंगी`, 'success');
        } else {
          showInAppToast(`👋 Welcome ${userData.name || 'User'}!`, 'VP Honda में आपका स्वागत है', 'info');
        }
      });
    }, 1500);
  };

  const handleLogout = () => {
    setUser(null);
    // सभी session keys clear करें — doLogout() तीनों हटाता है
    doLogout();
    localStorage.removeItem('vpHondaUser');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-purple-600 to-pink-600">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">VP HONDA</h1>
          <p className="text-xl text-white">Dealership Management System</p>
          <div className="mt-8 animate-spin">
            <div className="border-4 border-white border-t-transparent rounded-full w-12 h-12 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {user && <Navbar user={user} onLogout={handleLogout} />}
        
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={!user ? <LoginPage onLogin={handleLogin} /> : <Navigate to="/dashboard" />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute user={user}>
                <Dashboard user={user} />
              </ProtectedRoute>
            }
          />

          {/* ═══ ADMIN ONLY — Financial / Sensitive ═══ */}
          <Route
            path="/veh-dashboard"
            element={
              <ProtectedRoute user={user}>
                <AdminRoute user={user}>
                  <VehDashboard user={user} />
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/vph-dashboard"
            element={
              <ProtectedRoute user={user}>
                <AdminRoute user={user}>
                  <VPHondaDashboard user={user} />
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/comprehensivedashboard"
            element={
              <ProtectedRoute user={user}>
                <AdminRoute user={user}>
                  <ComprehensiveDashboard user={user} />
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pdf-importer"
            element={
              <ProtectedRoute user={user}>
                <AdminRoute user={user}>
                  <AdvancedPDFImporter user={user} />
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoice-management"
            element={
              <ProtectedRoute user={user}>
                <AdminRoute user={user}>
                  <InvoiceManagementDashboard user={user} />
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/manual-invoice"
            element={
              <ProtectedRoute user={user}>
                <AdminRoute user={user}>
                  <ManualInvoiceEntryPage user={user} />
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoice/:invoiceId"
            element={
              <ProtectedRoute user={user}>
                <AdminRoute user={user}>
                  <InvoiceDetailsPage user={user} />
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute user={user}>
                <AdminRoute user={user}>
                  <ReportsAnalytics user={user} />
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/diagnostic"
            element={
              <ProtectedRoute user={user}>
                <AdminRoute user={user}>
                  <DiagnosticPage user={user} />
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/data-management"
            element={
              <ProtectedRoute user={user}>
                <AdminRoute user={user}>
                  <DataManagement user={user} />
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute user={user}>
                <AdminRoute user={user}>
                  <AdminPanel user={user} />
                </AdminRoute>
              </ProtectedRoute>
            }
          />

          {/* ═══ STAFF + ADMIN — Daily Operations ═══ */}
          <Route
            path="/job-cards"
            element={
              <ProtectedRoute user={user}>
                <RoleRoute user={user} requiredRole="staff">
                  <JobCardPage user={user} />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/parts"
            element={
              <ProtectedRoute user={user}>
                <RoleRoute user={user} requiredRole="staff">
                  <PartsManagement user={user} />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute user={user}>
                <RoleRoute user={user} requiredRole="staff">
                  <CustomerManagement user={user} />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/new-customers"
            element={
              <ProtectedRoute user={user}>
                <RoleRoute user={user} requiredRole="staff">
                  <NewCustomersPage user={user} />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reminders"
            element={
              <ProtectedRoute user={user}>
                <RoleRoute user={user} requiredRole="staff">
                  <RemindersPage user={user} />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer-profile/:customerId"
            element={
              <ProtectedRoute user={user}>
                <RoleRoute user={user} requiredRole="staff">
                  <CustomerServiceProfile user={user} />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer-data-manager"
            element={
              <ProtectedRoute user={user}>
                <RoleRoute user={user} requiredRole="staff">
                  <CustomerServiceDataManager user={user} />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/quotation"
            element={
              <ProtectedRoute user={user}>
                <RoleRoute user={user} requiredRole="staff">
                  <QuotationPage user={user} />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff-management"
            element={
              <ProtectedRoute user={user}>
                <RoleRoute user={user} requiredRole="staff">
                  <StaffManagementPage user={user} />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/salary-management"
            element={
              <ProtectedRoute user={user}>
                <AdminRoute user={user}>
                  <SalaryManagementPage user={user} />
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/add-service-customer"
            element={
              <ProtectedRoute user={user}>
                <RoleRoute user={user} requiredRole="staff">
                  <AddServiceCustomerPage user={user} />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/service-customers"
            element={
              <ProtectedRoute user={user}>
                <RoleRoute user={user} requiredRole="staff">
                  <ServiceCustomerListPage user={user} />
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* ⭐ NEW: Smart Features */}
          <Route path="/visitors"
            element={
              <ProtectedRoute user={user}>
                <RoleRoute user={user} requiredRole="staff">
                  <VisitorCounter user={user} />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route path="/pickup-drop"
            element={
              <ProtectedRoute user={user}>
                <RoleRoute user={user} requiredRole="staff">
                  <PickupDropTracker user={user} />
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Public */}
          <Route path="/showroom" element={<Dashboardwebpage />} />

          {/* Redirect to login */}
          <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
        </Routes>

        {/* ⭐ Universal Search — floating button on every page (when logged in) */}
        {user && <UniversalSearch />}
      </div>
    </Router>
  );
}