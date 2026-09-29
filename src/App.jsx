// ═══════════════════════════════════════════════════════════════════════
// src/App.jsx  —  Vishesh Finance ERP  (Phase 1–8)
// ───────────────────────────────────────────────────────────────────────
// यह पूरी file है। पुरानी App.jsx delete करके यही upload करें।
//
// पुराने सारे routes जस के तस हैं — एक भी नहीं हटाया।
// नया जुड़ा:
//   /users            — यूज़र प्रबंधन (Phase 1)
//   /loans            — लोन खाते (Phase 2)
//   /loans/:id        — पूरी खाता बही
//   /collection       — वसूली, भुगतान, रसीद
//   /document-center  — दस्तावेज़ केंद्र (Cloudinary)
//   /reports-center   — 16 रिपोर्ट, Excel/CSV export (Phase 5)
//   /branches         — शाखा प्रबंधन व बैकअप (Phase 5)
//   /application/:id  — Application 360 View (Phase 5)
//   Real-time जुड़ाव login पर अपने आप चालू
//   Token expire होने पर अपने आप refresh (पहले सीधे logout हो जाता था)
//   ऑफ़लाइन ड्राफ्ट इंटरनेट आते ही अपने आप sync होते हैं
//   /customers/:id    — Customer 360 View (Phase 7)
//   /verify-receipt   — रसीद सत्यापन, बिना login (Phase 7)
//
// Phase 8 सुधार:
//   /applications     — अब आवेदन की **सूची** (Approve/Reject बटन सहित)
//                       नया form पहले जैसा /apply पर ही है
//   /document-vault   — पुराना टूटा हुआ Vault हटाकर नया दस्तावेज़ केंद्र
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'

// CORE PAGES
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ApplicationFormPage from './pages/ApplicationFormPage'

// DOCUMENT PAGES
import DeliveryOrderPage from './pages/DeliveryOrderPage'
import LoanAgreementPage from './pages/LoanAgreementPage'
import NACHMandatePage from './pages/NACHMandatePage'
import BlankAgreementPage from './pages/BlankAgreementPage'
import PreSanctionLetterPage from './pages/PreSanctionLetterPage'
import OfferLetterPage from './pages/OfferLetterPage'

// BUSINESS TOOLS
import AnalyticsDashboard from './pages/AnalyticsDashboard'
import SMSTemplatesPage from './pages/SMSTemplatesPage'
import EMICalendarPage from './pages/EMICalendarPage'
import EMISchedulePage from './pages/EMISchedulePage'
import EMICalculatorPage from './pages/EMICalculatorPage'
import CustomerFollowupPage from './pages/CustomerFollowupPage'
import ExcelExportPage from './pages/ExcelExportPage'
import TargetTrackingPage from './pages/TargetTrackingPage'

// OTHER TOOLS
import CustomerSearchPage from './pages/CustomerSearchPage'
import BackupRestorePage from './pages/BackupRestorePage'
import HelpSupportPage from './pages/HelpSupportPage'
import ActivityLogPage from './pages/ActivityLogPage'
import VehicleCatalogPage from './pages/VehicleCatalogPage'
import DocumentUploadPage from './pages/DocumentUploadPage'
import DraftsListPage from './pages/DraftsListPage'
import SettingsPage from './pages/SettingsPage'
import NotificationsHub from './pages/NotificationsHub'
import NotificationsPage from './pages/NotificationsPage'

// SPECIAL PAGES
import CibilCheckPage from './pages/CibilCheckPage'
import BankStatementAnalyzer from './pages/BankStatementAnalyzer'
import FieldInvestigationPage from './pages/FieldInvestigationPage'
import RepossessionPage from './pages/RepossessionPage'
import PaymentPage from './pages/PaymentPage'
import ReportsPage from './pages/ReportsPage'
import ReportsExportPage from './pages/ReportsExportPage'
import AdminDashboard from './pages/AdminDashboard'
import ProfilePage from './pages/ProfilePage'
import EligibilityCheckPage from './pages/EligibilityCheckPage'
import LoanComparisonPage from './pages/LoanComparisonPage'
import FAQPage from './pages/FAQPage'
import TermsAndConditionsPage from './pages/TermsAndConditionsPage'

// CUSTOMER FACING
import CustomerPortalPage from './pages/CustomerPortalPage'
import CustomerVerifyPortal from './pages/CustomerVerifyPortal'
import SendVerificationLinkPage from './pages/SendVerificationLinkPage'
import RegisterPage from './pages/RegisterPage'

// ── नए pages (Phase 1–4) ──
import UserManagementPage from './pages/UserManagementPage'
import LoanLedgerPage from './pages/LoanLedgerPage'
import NOCPage from './pages/NOCPage'
import CollectionPage from './pages/CollectionPage'
import DocumentCenterPage from './pages/DocumentCenterPage'
import ReportsCenterPage from './pages/ReportsCenterPage'
import BranchManagementPage from './pages/BranchManagementPage'
import Application360Page from './pages/Application360Page'
import Customer360Page from './pages/Customer360Page'
import ReceiptVerifyPage from './pages/ReceiptVerifyPage'
// ⚠️ Phase 16: नई public page — ग्राहक SMS link से यहाँ पहुँचता है
import CibilScoreLinkPage from './pages/CibilScoreLinkPage'
import ApplicationsListPage from './pages/ApplicationsListPage'
// ── Phase 17: ग्राहक का Video KYC पेज (बिना login) ──
import VideoKycPage from './pages/VideoKycPage'
// ── Phase 18.1: Render जागते समय "सर्वर जाग रहा है" संदेश ──
import ServerWakeBanner from './components/Common/ServerWakeBanner'

// Header component
import Header from './components/Header'
// ⚠️ Phase 15: सुरक्षा-जाल — किसी भी page में गड़बड़ी हो तो पूरी screen
// सफ़ेद होने की जगह वहीं एक साफ़ संदेश दिखे
import ErrorBoundary from './components/Common/ErrorBoundary'

// ── नए utilities ──
import { session, BASE_URL } from './utils/apiConfig'
import { connectSocket, disconnectSocket } from './utils/socket'
import { startAutoSync, queueSize } from './utils/offlineQueue'

import './App.css'

function ProtectedRoute({ children, user }) {
  const location = useLocation()
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}

function Layout({ children, user, language, setLanguage, onLogout }) {
  return (
    <>
      <Header user={user} language={language} setLanguage={setLanguage} onLogout={onLogout} />
      <main className="main-content">{children}</main>
    </>
  )
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  try {
    const swResponse = await fetch('/service-worker.js', { method: 'HEAD', cache: 'no-cache' })
    if (!swResponse.ok) return

    const contentType = swResponse.headers.get('content-type') || ''
    if (!contentType.includes('javascript')) return

    await navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
    console.log('[App] ✅ Service Worker registered')
  } catch (err) {
    console.log('[App] SW skipped:', err.message)
  }
}

// ═══════════════════════════════════════════════════════════════
// Token refresh — 401 आने पर पहले refresh, तभी logout
// ═══════════════════════════════════════════════════════════════
let refreshPromise = null

async function tryRefreshToken() {
  if (refreshPromise) return refreshPromise

  const refreshToken = session.getRefreshToken()
  if (!refreshToken) return null

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      })
      if (!res.ok) return null
      const data = await res.json()
      if (data?.success && (data.accessToken || data.token)) {
        session.save(data)
        return data.accessToken || data.token
      }
      return null
    } catch {
      return null
    } finally {
      setTimeout(() => { refreshPromise = null }, 200)
    }
  })()

  return refreshPromise
}

function AppContent() {
  const [user, setUser] = useState(null)
  const [language, setLanguage] = useState('hi')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  // ── Global Axios interceptor ────────────────────────────────
  // पहले: 401 आया तो सीधे logout
  // अब:   पहले token refresh करके दोबारा कोशिश, तभी logout
  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      response => response,
      async error => {
        const status = error?.response?.status
        const original = error.config || {}

        if (status === 401 && !original.__retried) {
          const newToken = await tryRefreshToken()

          if (newToken) {
            original.__retried = true
            original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newToken}` }
            return axios(original)
          }

          console.warn('[Auth] Session समाप्त — logout')
          session.clear()
          setUser(null)
          disconnectSocket()

          const path = window.location.pathname
          if (!path.includes('/login') && !path.includes('/customer-portal') && !path.includes('/verify')) {
            window.location.href = '/login'
          }
        }

        return Promise.reject(error)
      }
    )
    return () => axios.interceptors.response.eject(interceptorId)
  }, [])

  // ── शुरू में session जाँचो ──────────────────────────────────
  useEffect(() => {
    const token = session.getToken()
    const savedUser = session.getUser()

    if (token && savedUser) {
      setUser(savedUser)

      // असली जाँच — /auth/me सबसे भरोसेमंद है
      fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(async res => {
          if (res.ok) {
            const data = await res.json()
            if (data?.user) {
              setUser(data.user)
              session.save({ user: data.user })
            }
            connectSocket()
            return
          }
          if (res.status === 401) {
            const newToken = await tryRefreshToken()
            if (newToken) { connectSocket(); return }
            console.warn('[Auth] शुरू में ही token अमान्य — logout')
            session.clear()
            setUser(null)
          }
        })
        .catch(() => {
          // नेटवर्क समस्या पर logout नहीं करते — Render जाग रहा हो सकता है
          console.log('[Auth] नेटवर्क जाँच असफल — session वैसे ही रखा')
        })
    }

    setLoading(false)
    registerServiceWorker()

    // ऑफ़लाइन ड्राफ्ट — इंटरनेट आते ही अपने आप server पर चले जाएँगे
    startAutoSync({
      onSynced: (r) => console.log(`[Offline] ${r.synced} ड्राफ्ट sync हो गए`)
    })
    if (queueSize() > 0) {
      console.log(`[Offline] ${queueSize()} ड्राफ्ट भेजने बाकी हैं`)
    }

    return () => disconnectSocket()
  }, [])

  // ============== UNIVERSAL LOGIN HANDLER ==============
  const handleLogin = (...args) => {
    console.log('🔑 [App] handleLogin called')

    let userData = null
    let token = null
    let refreshToken = null

    if (args.length === 2) {
      userData = args[0]
      token = args[1]
    } else if (args.length === 1 && args[0]) {
      const data = args[0]

      if (data.token || data.accessToken) {
        userData = data.user || data.userData || data
        token = data.accessToken || data.token || data.jwt
        refreshToken = data.refreshToken
      } else if (data.data) {
        userData = data.data.user || data.data
        token = data.data.accessToken || data.data.token
        refreshToken = data.data.refreshToken
      } else if (data.success !== undefined) {
        userData = data.user || data.userData
        token = data.accessToken || data.token
        refreshToken = data.refreshToken
      } else {
        userData = data
      }
    }

    if (!token) {
      console.error('[App] ❌ Token नहीं मिला')
      alert('❌ Login असफल: Token नहीं मिला')
      return false
    }

    if (!userData) {
      userData = { username: 'user', role: 'staff', name: 'User' }
    }

    session.save({ token, accessToken: token, refreshToken, user: userData })
    setUser(userData)

    // Real-time जोड़ो
    connectSocket()

    // Browser notification की अनुमति माँगो (एक बार)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }

    setTimeout(() => {
      navigate('/dashboard', { replace: true })
    }, 100)

    return true
  }

  const handleLogout = async () => {
    if (!confirm('क्या आप Logout करना चाहते हैं?')) return

    // server को भी बताओ ताकि session बंद हो जाए
    try {
      const token = session.getToken()
      if (token) {
        await fetch(`${BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: '{}'
        })
      }
    } catch { /* चुपचाप */ }

    disconnectSocket()
    session.clear()
    setUser(null)
    navigate('/login', { replace: true })
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: '#1e40af'
      }}>
        Loading Vishesh Finance Pvt Ltd...
      </div>
    )
  }

  // ⚠️ Phase 15 — सबसे ज़रूरी सुधार: हर page अब ErrorBoundary में लिपटा है।
  // पहले किसी भी page में एक भी गड़बड़ी (जैसे किसी record में कोई field
  // खाली होना) पूरी screen को सफ़ेद कर देती थी — यह सुधार सिर्फ़ Vehicle
  // Catalog के लिए नहीं, बल्कि पूरे app के हर page के लिए है।
  const Protected = (Component) => (
    <ProtectedRoute user={user}>
      <Layout user={user} language={language} setLanguage={setLanguage} onLogout={handleLogout}>
        <ErrorBoundary pageName={Component.displayName || Component.name || 'यह पन्ना'}>
          <Component user={user} language={language} onLogout={handleLogout} />
        </ErrorBoundary>
      </Layout>
    </ProtectedRoute>
  )

  return (
    <Routes>
      {/* LOGIN ROUTE - Multiple props for compatibility */}
      <Route
        path="/login"
        element={
          user ? <Navigate to="/dashboard" replace /> : (
            <LoginPage
              onLogin={handleLogin}
              onLoginSuccess={handleLogin}
              handleLogin={handleLogin}
              login={handleLogin}
              setUser={setUser}
              language={language}
            />
          )
        }
      />

      <Route path="/register" element={<RegisterPage language={language} />} />

      {/* HOME → Dashboard */}
      <Route path="/home" element={Protected(DashboardPage)} />

      {/* CUSTOMER PORTALS (Public - no auth) */}
      <Route path="/customer-portal/:token" element={<CustomerPortalPage language={language} />} />
      <Route path="/verify/:token" element={<CustomerVerifyPortal language={language} />} />

      {/* रसीद सत्यापन — बिना login (QR स्कैन करके ग्राहक जाँच सके) */}
      <Route path="/receipt/:receiptNo" element={<ReceiptVerifyPage />} />
      <Route path="/verify-receipt" element={<ReceiptVerifyPage />} />

      {/* ⚠️ Phase 16: ग्राहक अपना CIBIL score खुद check करे — बिना login */}
      <Route path="/cibil-check" element={<CibilScoreLinkPage />} />

      {/* ⚠️ Phase 17: Video KYC + गवाह सहमति — ग्राहक मोबाइल browser में, बिना login */}
      <Route path="/vkyc/:token" element={<ErrorBoundary pageName="Video KYC"><VideoKycPage /></ErrorBoundary>} />

      {/* ROOT REDIRECT */}
      <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />

      {/* ⭐ APPLICATION - Multiple paths */}
      {/* ⚠️ Phase 8: /applications अब सूची है (Approve/Reject यहीं से) */}
      <Route path="/applications" element={Protected(ApplicationsListPage)} />
      <Route path="/application-list" element={Protected(ApplicationsListPage)} />
      <Route path="/pending-applications" element={Protected(ApplicationsListPage)} />

      {/* नया form — पहले जैसा ही */}
      <Route path="/application" element={Protected(ApplicationFormPage)} />
      <Route path="/new-application" element={Protected(ApplicationFormPage)} />
      <Route path="/new-app" element={Protected(ApplicationFormPage)} />
      <Route path="/apply" element={Protected(ApplicationFormPage)} />
      <Route path="/application-form" element={Protected(ApplicationFormPage)} />
      <Route path="/loan-application" element={Protected(ApplicationFormPage)} />
      <Route path="/avedan" element={Protected(ApplicationFormPage)} />
      <Route path="/aavedan" element={Protected(ApplicationFormPage)} />

      {/* DASHBOARD */}
      <Route path="/dashboard" element={Protected(DashboardPage)} />
      <Route path="/admin-dashboard" element={Protected(AdminDashboard)} />
      <Route path="/admin" element={Protected(AdminDashboard)} />
      <Route path="/profile" element={Protected(ProfilePage)} />

      {/* ══ नया: यूज़र प्रबंधन (Phase 1) ══ */}
      <Route path="/users" element={Protected(UserManagementPage)} />
      <Route path="/user-management" element={Protected(UserManagementPage)} />
      <Route path="/staff" element={Protected(UserManagementPage)} />

      {/* ══ नया: लोन खाते व खाता बही (Phase 2) ══ */}
      <Route path="/loans" element={Protected(LoanLedgerPage)} />
      <Route path="/loans/:id" element={Protected(LoanLedgerPage)} />
      <Route path="/loan-ledger" element={Protected(LoanLedgerPage)} />
      <Route path="/ledger" element={Protected(LoanLedgerPage)} />
      <Route path="/noc" element={Protected(NOCPage)} />
      <Route path="/foreclosure" element={Protected(NOCPage)} />

      {/* ══ नया: वसूली (Phase 2) ══ */}
      <Route path="/collection" element={Protected(CollectionPage)} />
      <Route path="/collections" element={Protected(CollectionPage)} />
      <Route path="/vasooli" element={Protected(CollectionPage)} />

      {/* ══ नया: दस्तावेज़ केंद्र (Phase 3) ══ */}
      <Route path="/document-center" element={Protected(DocumentCenterPage)} />
      <Route path="/doc-center" element={Protected(DocumentCenterPage)} />

      {/* ══ नया: रिपोर्ट केंद्र (Phase 5) ══ */}
      <Route path="/reports-center" element={Protected(ReportsCenterPage)} />
      <Route path="/report-center" element={Protected(ReportsCenterPage)} />
      <Route path="/advanced-reports" element={Protected(ReportsCenterPage)} />

      {/* ══ नया: शाखा प्रबंधन व बैकअप (Phase 5) ══ */}
      <Route path="/branches" element={Protected(BranchManagementPage)} />
      <Route path="/branch-management" element={Protected(BranchManagementPage)} />
      <Route path="/shakha" element={Protected(BranchManagementPage)} />

      {/* ══ नया: Customer 360 View (Phase 7) ══ */}
      <Route path="/customers/:id" element={Protected(Customer360Page)} />
      <Route path="/customer/:id" element={Protected(Customer360Page)} />

      {/* ══ नया: Application 360 View (Phase 5) ══ */}
      <Route path="/application/:id" element={Protected(Application360Page)} />
      <Route path="/applications/:id" element={Protected(Application360Page)} />
      <Route path="/application-360/:id" element={Protected(Application360Page)} />

      {/* DOCUMENTS */}
      <Route path="/delivery-order" element={Protected(DeliveryOrderPage)} />
      <Route path="/delivery" element={Protected(DeliveryOrderPage)} />
      <Route path="/do" element={Protected(DeliveryOrderPage)} />

      <Route path="/loan-agreement" element={Protected(LoanAgreementPage)} />
      <Route path="/agreement" element={Protected(LoanAgreementPage)} />

      <Route path="/nach-mandate" element={Protected(NACHMandatePage)} />
      <Route path="/nach" element={Protected(NACHMandatePage)} />
      <Route path="/mandate" element={Protected(NACHMandatePage)} />

      <Route path="/blank-agreement" element={Protected(BlankAgreementPage)} />
      <Route path="/pre-sanction" element={Protected(PreSanctionLetterPage)} />
      <Route path="/offer-letter" element={Protected(OfferLetterPage)} />

      {/* BUSINESS TOOLS */}
      <Route path="/analytics" element={Protected(AnalyticsDashboard)} />
      <Route path="/sms-templates" element={Protected(SMSTemplatesPage)} />
      <Route path="/emi-calendar" element={Protected(EMICalendarPage)} />
      <Route path="/emi-schedule" element={Protected(EMISchedulePage)} />
      <Route path="/emi-calculator" element={Protected(EMICalculatorPage)} />
      <Route path="/followup" element={Protected(CustomerFollowupPage)} />
      <Route path="/follow-up" element={Protected(CustomerFollowupPage)} />
      <Route path="/excel-export" element={Protected(ExcelExportPage)} />
      <Route path="/targets" element={Protected(TargetTrackingPage)} />

      {/* OTHER TOOLS */}
      <Route path="/customer-search" element={Protected(CustomerSearchPage)} />
      <Route path="/search" element={Protected(CustomerSearchPage)} />
      <Route path="/backup" element={Protected(BackupRestorePage)} />
      <Route path="/help" element={Protected(HelpSupportPage)} />
      <Route path="/activity-log" element={Protected(ActivityLogPage)} />
      <Route path="/audit-logs" element={Protected(ActivityLogPage)} />
      <Route path="/vehicle-catalog" element={Protected(VehicleCatalogPage)} />
      <Route path="/vehicles" element={Protected(VehicleCatalogPage)} />
      {/* ⚠️ Phase 8: पुराना Vault खुलता ही नहीं था (api is not a function) —
          अब यही पते नए दस्तावेज़ केंद्र पर जाते हैं। पुरानी file हटाई नहीं गई। */}
      <Route path="/document-vault" element={Protected(DocumentCenterPage)} />
      <Route path="/documents" element={Protected(DocumentCenterPage)} />
      <Route path="/document-upload" element={Protected(DocumentUploadPage)} />
      <Route path="/drafts" element={Protected(DraftsListPage)} />
      <Route path="/settings" element={Protected(SettingsPage)} />
      <Route path="/notifications-hub" element={Protected(NotificationsHub)} />
      <Route path="/reminder-hub" element={Protected(NotificationsHub)} />
      <Route path="/reminders" element={Protected(NotificationsHub)} />
      <Route path="/notifications" element={Protected(NotificationsPage)} />

      {/* SPECIAL FEATURES */}
      <Route path="/cibil" element={Protected(CibilCheckPage)} />
      <Route path="/bank" element={Protected(BankStatementAnalyzer)} />
      <Route path="/fi" element={Protected(FieldInvestigationPage)} />
      <Route path="/repossession" element={Protected(RepossessionPage)} />
      <Route path="/payment" element={Protected(PaymentPage)} />
      <Route path="/payments" element={Protected(PaymentPage)} />
      <Route path="/reports" element={Protected(ReportsPage)} />
      <Route path="/reports-export" element={Protected(ReportsExportPage)} />
      <Route path="/eligibility" element={Protected(EligibilityCheckPage)} />
      <Route path="/loan-comparison" element={Protected(LoanComparisonPage)} />
      <Route path="/faq" element={Protected(FAQPage)} />
      <Route path="/terms" element={Protected(TermsAndConditionsPage)} />
      <Route path="/send-verification" element={Protected(SendVerificationLinkPage)} />
      <Route path="/customer-link" element={Protected(SendVerificationLinkPage)} />
      <Route path="/template" element={Protected(BlankAgreementPage)} />
      <Route path="/sms-send" element={Protected(SMSTemplatesPage)} />

      {/* CATCH ALL - Redirect to dashboard/login */}
      <Route
        path="*"
        element={
          user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
      <ServerWakeBanner />
    </BrowserRouter>
  )
}
