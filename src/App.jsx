// ════════════════════════════════════════════════════════════════════════════
// src/App.jsx — VP Honda Dealership app का मुख्य Router
// ════════════════════════════════════════════════════════════════════════════
// ⚠️ यह file पहले गलती से **Vishesh Finance ERP** वाली आ गई थी (56 ऐसे पन्ने
// माँगती थी जो इस app में हैं ही नहीं — ApplicationFormPage, VideoKycPage…).
// साथ ही main.jsx `./app.jsx` (छोटा a) माँगता था जो repo में था ही नहीं.
// नतीजा: Vercel पर हर नया build fail हो रहा था — इसीलिए नया Update /
// Install वाला संदेश आना बंद था और reminder/notification का नया code
// कभी live ही नहीं हुआ.
//
// अब यह VP Honda की अपनी router file है. सारे पन्ने वही हैं जो
// src/pages में मौजूद हैं — कोई नया पन्ना नहीं जोड़ा, कोई पुराना नहीं हटाया.
//
// यहाँ क्या-क्या होता है:
//   • Login — LoginPage खुद पुराना session जाँचकर onLogin बुलाता है
//   • हर पन्ना lazy-load (पहली बार app जल्दी खुले)
//   • एक पन्ना crash हो तो सिर्फ़ वही रुके (ErrorBoundary)
//   • Notification पर click → बिना reload सही पन्ना (NotificationNavigator)
//   • Login के बाद यह device push-notification के लिए दर्ज (ensurePushSubscription)
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

import Navbar from './components/Navbar';
import SmartFAB from './components/SmartFAB';
import UniversalSearch from './components/UniversalSearch';
import BottomNav from './components/BottomNav';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage, { doLogout } from './pages/LoginPage';
import Dashboard from './pages/Dashboard';

import { ensurePushSubscription } from './utils/pushSubscribe';
import { scheduleRemindersNow } from './registerSW';

// ── बाक़ी सारे पन्ने — सिर्फ़ खोलने पर download होते हैं ─────────────────────
const VehDashboard               = lazy(() => import('./pages/VehDashboard'));
const CustomerManagement         = lazy(() => import('./pages/CustomerManagement'));
const SmartCustomerHub           = lazy(() => import('./pages/SmartCustomerHub'));
const NewCustomersPage           = lazy(() => import('./pages/NewCustomersPage'));
const ServiceCustomerListPage    = lazy(() => import('./pages/ServiceCustomerListPage'));
const AddServiceCustomerPage     = lazy(() => import('./pages/AddServiceCustomerPage'));
const CustomerServiceDataManager = lazy(() => import('./pages/CustomerServiceDataManager'));
const CustomerServiceProfile     = lazy(() => import('./pages/CustomerServiceProfile'));
const CustomerDashboard          = lazy(() => import('./pages/Dashboardwebpage'));
const RemindersPage              = lazy(() => import('./pages/RemindersPage'));
const JobCardPage                = lazy(() => import('./pages/JobCardPage'));
const PartsManagement            = lazy(() => import('./pages/PartsManagement'));
const PickupDropTracker          = lazy(() => import('./pages/PickupDropTracker'));
const CalendarView               = lazy(() => import('./pages/CalendarView'));
const VisitorCounter             = lazy(() => import('./pages/VisitorCounter'));
const PaymentTracker             = lazy(() => import('./pages/PaymentTracker'));
const ReceivedPaymentPage        = lazy(() => import('./pages/ReceivedPaymentPage'));
const InvoiceManagementDashboard = lazy(() => import('./pages/InvoiceManagementDashboard'));
const InvoiceDetailsPage         = lazy(() => import('./pages/InvoiceDetailsPage'));
const ManualInvoiceEntryPage     = lazy(() => import('./pages/ManualInvoiceEntryPage'));
const QuotationPage              = lazy(() => import('./pages/QuotationPage'));
const PriceListPage              = lazy(() => import('./pages/PriceListPage'));
const DocumentVault              = lazy(() => import('./pages/DocumentVault'));
const AdvancedPDFImporter        = lazy(() => import('./pages/AdvancedPDFImporter'));
const StaffManagementPage        = lazy(() => import('./pages/StaffManagementPage'));
const SalaryManagementPage       = lazy(() => import('./pages/SalaryManagementPage'));
const TeamChat                   = lazy(() => import('./pages/TeamChat'));
const MeetingRoom                = lazy(() => import('./pages/MeetingRoom'));
const ReportsAnalytics           = lazy(() => import('./pages/ReportsAnalytics'));
const DataManagement             = lazy(() => import('./pages/DataManagement'));
const AdminPanel                 = lazy(() => import('./pages/AdminPanel'));
const DiagnosticPage             = lazy(() => import('./pages/DiagnosticPage'));

// ── session पढ़ना (LoginPage वाले ही नियम) ──────────────────────────────────
// पहले ही पढ़ लेते हैं ताकि app खुलते ही एक झलक login पन्ने की न दिखे.
function readSavedUser() {
  try {
    const raw = localStorage.getItem('vpSession');
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (!u || !u.role) return null;
    if (u.role === 'admin') return u;
    if (u.role === 'staff') {
      // staff तभी, जब वह staff list में अब भी मौजूद हो (LoginPage भी यही जाँचता है)
      const list = JSON.parse(localStorage.getItem('staffData') || '[]');
      if (!Array.isArray(list) || !list.length) return u;   // list अभी आई ही नहीं — LoginPage फिर जाँच लेगा
      return list.some(s => String(s.id) === String(u.staffId)) ? u : null;
    }
    return null;
  } catch { return null; }
}

// ── पन्ना लोड होते समय छोटा सा इंतज़ार ───────────────────────────────────────
function PageLoader() {
  return (
    <div style={{
      minHeight: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14,
    }}>
      <img src="/logo.png" alt="VP Honda" width={60} height={60}
        style={{ width: 60, height: 60, objectFit: 'contain', animation: 'vpLoad 1.3s ease-in-out infinite' }} />
      <span style={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>खुल रहा है…</span>
      <style>{`@keyframes vpLoad{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.92)}}`}</style>
    </div>
  );
}

// ── सिर्फ़ admin के पन्ने ────────────────────────────────────────────────────
function AdminOnly({ user, children }) {
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

// ── पन्ना बदलते ही ErrorBoundary नया — एक पन्ने का crash दूसरे पर न दिखे ────
function PageBoundary({ children }) {
  const location = useLocation();
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>;
}

// ════════════════════════════════════════════════════════════════════════════
// 🔔 Notification click → सही पन्ना, बिना reload
// ════════════════════════════════════════════════════════════════════════════
// दो रास्ते हैं, दोनों यहीं संभलते हैं:
//   1. App खुला हो → Service Worker `postMessage({type:'NAVIGATE', url})` भेजता है
//   2. App बंद हो  → SW "/#nav=/reminders?rid=…" खोलता है, registerSW उसे
//      पढ़कर 'vp-navigate' event भेजता है (और sessionStorage में भी रख देता है,
//      ताकि login होने तक इंतज़ार करना पड़े तो भी जगह याद रहे)
// यह Router के **अंदर** होना ज़रूरी है, तभी useNavigate काम करता है.
function NotificationNavigator() {
  const navigate = useNavigate();

  useEffect(() => {
    const go = (url) => {
      if (typeof url !== 'string' || !url.startsWith('/')) return;
      try { sessionStorage.removeItem('vp_pending_nav'); } catch {}
      navigate(url);
    };

    // login से पहले notification से app खुला था — वह जगह अब खोलो
    try {
      const pending = sessionStorage.getItem('vp_pending_nav');
      if (pending) setTimeout(() => go(pending), 0);
    } catch {}

    const onNav = (e) => go(e.detail);
    const onSwMsg = (e) => {
      if (e.data?.type === 'NAVIGATE') go(e.data.url);
    };

    window.addEventListener('vp-navigate', onNav);
    navigator.serviceWorker?.addEventListener?.('message', onSwMsg);
    return () => {
      window.removeEventListener('vp-navigate', onNav);
      navigator.serviceWorker?.removeEventListener?.('message', onSwMsg);
    };
  }, [navigate]);

  return null;
}

// ════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [user, setUser] = useState(readSavedUser);

  const handleLogin = useCallback((userObj) => {
    if (!userObj) return;
    setUser(userObj);
  }, []);

  const handleLogout = useCallback(() => {
    try { doLogout(); } catch {}
    setUser(null);
  }, []);

  // ── login होते ही: यह device push-notification के लिए दर्ज करो ──────────
  // permission पहले से मिली हो तो चुपचाप दर्ज होता है, नहीं मिली हो तो कुछ
  // नहीं पूछता (permission का बटन Reminders पन्ने पर है). यह न हो तो
  // नया phone / नया install कभी server पर दर्ज नहीं होता और उस पर
  // app बंद होने पर एक भी reminder notification नहीं आती.
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => { ensurePushSubscription(false).catch(() => {}); }, 2500);
    return () => clearTimeout(t);
  }, [user]);

  // ── login होते ही reminder scheduling (registerSW खुद 4 घंटे की रोक रखता है) ─
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => { scheduleRemindersNow().catch(() => {}); }, 6000);
    return () => clearTimeout(t);
  }, [user]);

  // ── login नहीं है → सिर्फ़ login पन्ना (URL जस का तस रहता है, ताकि login के
  //    बाद notification वाला पन्ना ही खुले) ─────────────────────────────────
  if (!user) {
    return (
      <ErrorBoundary>
        <LoginPage onLogin={handleLogin} />
      </ErrorBoundary>
    );
  }

  return (
    <BrowserRouter>
      <NotificationNavigator />
      <div className="min-h-screen bg-gray-50">
        <Navbar user={user} onLogout={handleLogout} />
        <UniversalSearch />

        <PageBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* घर */}
              <Route path="/"              element={<Navigate to="/dashboard" replace />} />
              <Route path="/login"         element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"     element={<Dashboard user={user} />} />
              <Route path="/veh-dashboard" element={<VehDashboard />} />

              {/* पुराने dashboard के पते — अब सब एक ही Dashboard के tabs में हैं */}
              <Route path="/vph-dashboard"          element={<Navigate to="/dashboard" replace />} />
              <Route path="/comprehensivedashboard" element={<Navigate to="/dashboard" replace />} />
              <Route path="/business-intelligence"  element={<Navigate to="/dashboard?tab=insights" replace />} />
              <Route path="/manager"                element={<Navigate to="/dashboard" replace />} />

              {/* ग्राहक */}
              <Route path="/customers"                    element={<CustomerManagement user={user} />} />
              <Route path="/customer-hub"                 element={<SmartCustomerHub user={user} />} />
              <Route path="/new-customers"                element={<NewCustomersPage />} />
              <Route path="/service-customers"            element={<ServiceCustomerListPage />} />
              <Route path="/add-service-customer"         element={<AddServiceCustomerPage />} />
              <Route path="/customer-data-manager"        element={<CustomerServiceDataManager />} />
              <Route path="/customer-profile/:customerId" element={<CustomerServiceProfile />} />
              <Route path="/customer-service-profile/:customerId" element={<CustomerServiceProfile />} />
              <Route path="/customer-dashboard"           element={<CustomerDashboard />} />

              {/* रिमाइंडर व अलर्ट */}
              <Route path="/reminders" element={<RemindersPage />} />

              {/* सेवा व वर्कशॉप */}
              <Route path="/job-cards"   element={<JobCardPage />} />
              <Route path="/parts"       element={<PartsManagement user={user} />} />
              <Route path="/pickup-drop" element={<PickupDropTracker />} />
              <Route path="/calendar"    element={<CalendarView />} />
              <Route path="/visitors"    element={<VisitorCounter />} />

              {/* पैसा */}
              <Route path="/payments"           element={<PaymentTracker />} />
              <Route path="/received-payments"  element={<ReceivedPaymentPage />} />
              <Route path="/invoice-management" element={<InvoiceManagementDashboard />} />
              <Route path="/invoice/:invoiceNo" element={<InvoiceDetailsPage />} />
              <Route path="/invoice-entry"      element={<ManualInvoiceEntryPage />} />
              <Route path="/quotation"          element={<QuotationPage user={user} />} />
              {/* 🏷️ Honda Price List — Excel की Rate List sheet से import */}
              <Route path="/price-list"         element={<PriceListPage user={user} />} />
              <Route path="/rate-list"          element={<Navigate to="/price-list" replace />} />

              {/* दस्तावेज़ */}
              <Route path="/documents"  element={<DocumentVault />} />
              <Route path="/pdf-import" element={<AdvancedPDFImporter />} />

              {/* स्टाफ़ */}
              <Route path="/staff-management"  element={<StaffManagementPage />} />
              <Route path="/salary-management" element={<AdminOnly user={user}><SalaryManagementPage /></AdminOnly>} />

              {/* बातचीत */}
              <Route path="/chat"    element={<TeamChat user={user} />} />
              <Route path="/meeting" element={<MeetingRoom user={user} />} />

              {/* रिपोर्ट व प्रबंधन — सिर्फ़ admin */}
              <Route path="/reports"         element={<AdminOnly user={user}><ReportsAnalytics user={user} /></AdminOnly>} />
              <Route path="/data-management" element={<AdminOnly user={user}><DataManagement /></AdminOnly>} />
              <Route path="/admin"           element={<AdminOnly user={user}><AdminPanel user={user} /></AdminOnly>} />
              <Route path="/admin-panel"     element={<Navigate to="/admin" replace />} />
              <Route path="/diagnostic"      element={<AdminOnly user={user}><DiagnosticPage /></AdminOnly>} />

              {/* ग़लत पता → dashboard */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </PageBoundary>

        <SmartFAB user={user} />
        {/* 📱 mobile पर नीचे की पट्टी — होम, ग्राहक, Price List, रिमाइंडर, जॉब कार्ड */}
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}
