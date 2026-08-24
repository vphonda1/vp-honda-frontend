import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LoginPage, { doLogout } from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import Navbar from './components/Navbar';
import UniversalSearch from './components/UniversalSearch';
import { ensurePushSubscription } from './utils/pushSubscribe';
import ErrorBoundary from './components/ErrorBoundary';
import SmartFAB from './components/SmartFAB';
import { requestNotificationPermission, showInAppToast } from './utils/smartUtils';


// ════════════════════════════════════════════════════════════════════════════
// ⚡ हर page अलग-अलग load होता है (code splitting)
// ════════════════════════════════════════════════════════════════════════════
// पहले सारे 32 pages एक ही bundle में थे — यानी सिर्फ़ Reminders खोलने पर भी
// recharts (charts), xlsx (Excel), html2pdf और jsPDF सब download होते थे.
// मोबाइल पर पहली बार खोलने में इसी से 5–10 सेकंड लगते थे.
//
// अब हर page अपनी अलग file में जाता है और सिर्फ़ तभी download होता है जब आप
// उसे खोलें. Login + Dashboard पहले से load रहते हैं (सबसे ज़्यादा खुलते हैं).
const AddServiceCustomerPage = lazy(() => import('./pages/AddServiceCustomerPage'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const AdvancedPDFImporter = lazy(() => import('./pages/AdvancedPDFImporter'));
const CalendarView = lazy(() => import('./pages/CalendarView'));
const CustomerManagement = lazy(() => import('./pages/CustomerManagement'));
const CustomerServiceDataManager = lazy(() => import('./pages/CustomerServiceDataManager'));
const CustomerServiceProfile = lazy(() => import('./pages/CustomerServiceProfile'));
const Dashboardwebpage = lazy(() => import('./pages/Dashboardwebpage'));
const DataManagement = lazy(() => import('./pages/DataManagement'));
const DiagnosticPage = lazy(() => import('./pages/DiagnosticPage'));
const DocumentVault = lazy(() => import('./pages/DocumentVault'));
const InvoiceDetailsPage = lazy(() => import('./pages/InvoiceDetailsPage'));
const InvoiceManagementDashboard = lazy(() => import('./pages/InvoiceManagementDashboard'));
const JobCardPage = lazy(() => import('./pages/JobCardPage'));
const ManualInvoiceEntryPage = lazy(() => import('./pages/ManualInvoiceEntryPage'));
const MeetingRoom = lazy(() => import('./pages/MeetingRoom'));
const NewCustomersPage = lazy(() => import('./pages/NewCustomersPage'));
const PartsManagement = lazy(() => import('./pages/PartsManagement'));
const PaymentTracker = lazy(() => import('./pages/PaymentTracker'));
const PickupDropTracker = lazy(() => import('./pages/PickupDropTracker'));
const QuotationPage = lazy(() => import('./pages/QuotationPage'));
const ReceivedPaymentPage = lazy(() => import('./pages/ReceivedPaymentPage'));
const RemindersPage = lazy(() => import('./pages/RemindersPage'));
const ReportsAnalytics = lazy(() => import('./pages/ReportsAnalytics'));
const SalaryManagementPage = lazy(() => import('./pages/SalaryManagementPage'));
const ServiceCustomerListPage = lazy(() => import('./pages/ServiceCustomerListPage'));
const SmartCustomerHub = lazy(() => import('./pages/SmartCustomerHub'));
const StaffManagementPage = lazy(() => import('./pages/StaffManagementPage'));
const TeamChat = lazy(() => import('./pages/TeamChat'));
const VehDashboard = lazy(() => import('./pages/VehDashboard'));
const VisitorCounter = lazy(() => import('./pages/VisitorCounter'));

/** page बदलते समय दिखने वाला हल्का loader */
function PageLoader() {
  return (
    <div style={{
      minHeight:'70vh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:14, background:'#020617',
    }}>
      <img src="/logo.png" alt="VP Honda" width={64} height={64}
        style={{ width:64, height:64, objectFit:'contain', animation:'vpLoad 1.3s ease-in-out infinite' }}/>
      <span style={{ color:'#64748b', fontSize:12, fontWeight:700 }}>खुल रहा है…</span>
      <style>{`@keyframes vpLoad{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.92)}}
        @media (prefers-reduced-motion: reduce){img{animation:none!important}}`}</style>
    </div>
  );
}

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

/**
 * Notification click → SPA navigation (कोई page reload नहीं).
 * यह Router के **अंदर** होना ज़रूरी है, तभी useNavigate काम करता है.
 */
function NotificationNavigator() {
  const navigate = useNavigate();
  useEffect(() => {
    const onNav = (e) => {
      const url = e.detail;
      if (typeof url === 'string' && url.startsWith('/')) navigate(url);
    };
    window.addEventListener('vp-navigate', onNav);
    return () => window.removeEventListener('vp-navigate', onNav);
  }, [navigate]);
  return null;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Auto-prompt notification on app load — user just sees one popup
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    // Wait 2 seconds then auto-show permission popup
    const timer = setTimeout(() => {
      if (Notification.permission === 'default' || Notification.permission === 'granted') {
        requestNotificationPermission().catch(() => {});
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // ⭐ Handle notification tap → navigate to correct page (specific reminder)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // हर device को silently push-subscribe रखें (TeamChat + Reminder notif सब devices पर आएं)
    ensurePushSubscription(false).catch(() => {});
    const handleMsg = (event) => {
      if (event.data?.type === 'NAVIGATE') {
        const url = event.data.url;
        if (!url) return;
        const current = window.location.pathname + window.location.search;
        if (current === url) return;
        // ⚠️ FIX: पहले यहाँ `window.location.href = url` था — यानी हर notification
        // click पर **पूरा app दोबारा load** होता था (5–10 सेकंड) और history भी
        // मिट जाती थी, इसलिए Back दबाने पर app ही बंद हो जाता था.
        //
        // अब React Router का history इस्तेमाल होता है — page तुरंत बदलता है,
        // कुछ reload नहीं होता, और Back सही जगह वापस ले जाता है.
        // (RemindersPage `useSearchParams` से ?rid= पढ़ता है, इसलिए reload की
        //  ज़रूरत ही नहीं थी.)
        window.dispatchEvent(new CustomEvent('vp-navigate', { detail: url }));
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMsg);
    return () => navigator.serviceWorker.removeEventListener('message', handleMsg);
  }, []);

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

  // ⭐ पहली बार login पर: phone में पड़ा पुराना visitors / pickup-drop /
  // appointments का डेटा एक बार में server पर चढ़ा दो — कुछ खोए नहीं.
  // एक बार हो जाने पर दोबारा नहीं चलता.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    import('./utils/trackingStore')
      .then(m => m.migrateAllOnce())
      .then(out => {
        if (cancelled || !out || !Object.keys(out).length) return;
        const total = Object.values(out).reduce((n, r) => n + (r.added || 0), 0);
        if (total > 0) console.log(`[Migrate] ${total} पुराने records server पर चढ़ाए:`, out);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  const handleLogin = (userData) => {
    setUser(userData);
    // ⚠️ localStorage private/incognito mode में या storage भर जाने पर
    // exception फेंकता है. बिना try/catch के login यहीं crash हो जाता था.
    try {
      localStorage.setItem('vpHondaUser', JSON.stringify(userData));
      localStorage.setItem('vpSession', JSON.stringify(userData));
      if (userData.role === 'admin') localStorage.setItem('vpAdminSession', 'true');
    } catch (e) {
      console.warn('session सेव नहीं हो पाई (storage भरा है?):', e.message);
    }
    // ⭐ Request notification permission on first login
    setTimeout(() => {
      requestNotificationPermission().then(granted => {
        if (granted) {
          showInAppToast('🔔 Notifications enabled', `नमस्ते ${userData.name || 'User'}! Reminders automatic आएंगे`, 'success');
          // Schedule reminders in background
          import('./utils/notificationScheduler').then(({ scheduleReminderNotifications }) => {
            const cached = localStorage.getItem('vpCustomers');
            if (cached) {
              try { scheduleReminderNotifications(JSON.parse(cached)).catch(() => {}); } catch {}
            }
          }).catch(() => {});
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
      <NotificationNavigator />
      <div className="min-h-screen bg-gray-50">
        {user && <Navbar user={user} onLogout={handleLogout} />}


        {/*
          ⚡ ErrorBoundary + Suspense — दोनों सारे routes के ऊपर.
          • Suspense: lazy page download होने तक loader दिखाता है
          • ErrorBoundary: पहले सिर्फ़ TeamChat पर था. किसी और page में error
            आने पर पूरा app सफ़ेद हो जाता था और कुछ पता नहीं चलता था.
            अब सिर्फ़ वही page रुकेगा, बाक़ी app चलता रहेगा.
        */}
        <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={!user ? <LoginPage onLogin={handleLogin} /> : <Navigate to="/dashboard" />} />

          {/* Protected Routes */}
          {/* ═══ एकमात्र Dashboard ═══
              पहले 5 अलग-अलग dashboard pages थे (Dashboard, VPHondaDashboard,
              ComprehensiveDashboard, ManagerView, BusinessIntelligence).
              अब सब कुछ एक ही Dashboard के tabs में है.
              पुराने URLs यहीं redirect हो जाते हैं ताकि किसी का bookmark,
              notification link या manifest shortcut न टूटे. */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute user={user}>
                <Dashboard user={user} />
              </ProtectedRoute>
            }
          />
          <Route path="/vph-dashboard"          element={<Navigate to="/dashboard" replace />} />
          <Route path="/comprehensivedashboard" element={<Navigate to="/dashboard" replace />} />
          <Route path="/comprehensive-dashboard" element={<Navigate to="/dashboard" replace />} />
          <Route path="/business-intelligence"  element={<Navigate to="/dashboard" replace />} />
          <Route path="/manager"                element={<Navigate to="/dashboard" replace />} />

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
          <Route path="/received-payments"
            element={
              <ProtectedRoute user={user}>
                <RoleRoute user={user} requiredRole="staff">
                  <ReceivedPaymentPage user={user}/>
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
          <Route path="/customer-hub"
            element={
              <ProtectedRoute user={user}>
                <RoleRoute user={user} requiredRole="staff">
                  <SmartCustomerHub user={user} />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route path="/calendar"
            element={
              <ProtectedRoute user={user}>
                <RoleRoute user={user} requiredRole="staff">
                  <CalendarView user={user} />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route path="/payments"
            element={
              <ProtectedRoute user={user}>
                <RoleRoute user={user} requiredRole="staff">
                  <PaymentTracker user={user} />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route path="/documents"
            element={
              <ProtectedRoute user={user}>
                <RoleRoute user={user} requiredRole="staff">
                  <DocumentVault user={user} />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route path="/chat"
            element={
              <ProtectedRoute user={user}>
                <RoleRoute user={user} requiredRole="staff">
                  <TeamChat user={user} />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route path="/meeting"
            element={
              <ProtectedRoute user={user}>
                <RoleRoute user={user} requiredRole="staff">
                  <MeetingRoom user={user} />
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Public */}
          <Route path="/showroom" element={<Dashboardwebpage />} />

          {/* Redirect to login */}
          <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>

        {/* ⭐ Universal Search — floating button on every page (when logged in) */}
        {user && <UniversalSearch />}
        {/* ⭐ Smart FAB — Voice, QR, Theme, Language */}
        {user && <SmartFAB user={user} />}
      </div>
    </Router>
  );
}
