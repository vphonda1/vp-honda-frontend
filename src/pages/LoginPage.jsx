import { useState, useEffect } from 'react';
import { AlertCircle, Eye, EyeOff, Shield, Users, LogIn, Lock } from 'lucide-react';

// ════════════════════════════════════════════════════════════════════════════
// LOGOUT UTILITY — App.jsx में import करके use करें:
//   import { doLogout } from './LoginPage';
//   <button onClick={() => { doLogout(); setUser(null); }}>Logout</button>
// ════════════════════════════════════════════════════════════════════════════
export const doLogout = () => {
  localStorage.removeItem('vpSession');
  localStorage.removeItem('vpAdminSession');
  localStorage.removeItem('vpStaffSession');
};

// ── Role-wise permissions ───────────────────────────────────────────────────
export const ROLE_PERMISSIONS = {
  admin: {
    canViewAll:         true,
    canEditStaff:       true,
    canDeleteStaff:     true,
    canAddPayment:      true,
    canAddIncentive:    true,
    canAddNote:         true,
    canViewPaySlip:     true,
    canDownloadPaySlip: true,
    canViewAllStaff:    true,
    canAccessAdmin:     true,
    canEditSettings:    true,
    canManageUsers:     true,
    canViewReports:     true,
    canExportData:      true,
    canDeleteQuotation: true,   // Quotation delete — admin only
    canViewDataMgmt:    true,   // Data Management menu — admin only
    staffId:            null,
  },
  staff: {
    canViewAll:         false,
    canEditStaff:       false,
    canDeleteStaff:     false,
    canAddPayment:      false,
    canAddIncentive:    false,
    canAddNote:         false,
    canViewPaySlip:     true,
    canDownloadPaySlip: true,
    canViewAllStaff:    false,
    canAccessAdmin:     false,
    canEditSettings:    false,
    canManageUsers:     false,
    canViewReports:     false,
    canExportData:      false,
    canDeleteQuotation: false,  // Staff को delete नहीं
    canViewDataMgmt:    false,  // Data Management hidden
    staffId:            null,
  },
};

const ADMIN_EMAIL    = 'admin@vphonda.com';
const ADMIN_PASSWORD = 'vphonda@123';

// ════════════════════════════════════════════════════════════════════════════
export default function LoginPage({ onLogin }) {
  const [mode,      setMode]      = useState('landing');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [staffList, setStaffList] = useState([]);

  // Admin form
  const [adminEmail,  setAdminEmail]   = useState('');
  const [adminPw,     setAdminPw]      = useState('');
  const [showAdminPw, setShowAdminPw]  = useState(false);

  // Staff form
  const [staffSelId, setStaffSelId] = useState('');
  const [staffPin,   setStaffPin]   = useState('');
  const [showPin,    setShowPin]    = useState(false);

  // ── Load data + Auto-restore session ──────────────────────────────────────
  useEffect(() => {
    // Load staff list
    try {
      const s = localStorage.getItem('staffData');
      if (s) setStaffList(JSON.parse(s));
    } catch {}

    // Auto-restore session ONLY if session exists AND was not manually logged out
    // doLogout() removes 'vpSession', so if it's gone we stay on login page
    try {
      const raw = localStorage.getItem('vpSession');
      if (!raw) return; // No session — stay on login page ✅

      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.role) return;

      if (parsed.role === 'staff') {
        // Verify staff still exists in staffData
        const staffData = JSON.parse(localStorage.getItem('staffData') || '[]');
        const found = staffData.find(s => String(s.id) === String(parsed.staffId));
        if (found) {
          onLogin({ ...parsed });
        } else {
          // Staff deleted — clear invalid session
          doLogout();
        }
      } else if (parsed.role === 'admin') {
        onLogin(parsed);
      }
    } catch {
      doLogout(); // Corrupt session — clear it
    }
  }, []); // eslint-disable-line

  // ── Save session and call onLogin ─────────────────────────────────────────
  const persistLogin = (userObj) => {
    localStorage.setItem('vpSession', JSON.stringify(userObj));
    if (userObj.role === 'admin') {
      localStorage.setItem('vpAdminSession', 'true');
    } else {
      localStorage.removeItem('vpAdminSession');
      const staffSession = { id: userObj.staffId, name: userObj.name, position: userObj.position };
      localStorage.setItem('vpStaffSession', JSON.stringify(staffSession));
    }
    setLoading(false);
    onLogin(userObj);
  };

  // ── Admin Login ────────────────────────────────────────────────────────────
  const handleAdminLogin = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const emailOk    = adminEmail === ADMIN_EMAIL || adminEmail === 'admin';
    const passwordOk = adminPw    === ADMIN_PASSWORD;
    if (!emailOk || !passwordOk) {
      setError('❌ गलत Email या Password!');
      setLoading(false);
      return;
    }
    setTimeout(() => {
      persistLogin({
        id: 'admin-1', email: ADMIN_EMAIL, name: 'Admin User',
        role: 'admin', staffId: null,
        permissions: ROLE_PERMISSIONS.admin,
      });
    }, 500);
  };

  // ── Staff Login ────────────────────────────────────────────────────────────
  const handleStaffLogin = (e) => {
    e.preventDefault();
    setError('');
    if (!staffSelId) { setError('कृपया अपना नाम चुनें।'); return; }
    const staff = staffList.find(s => String(s.id) === String(staffSelId));
    if (!staff) { setError('कर्मचारी नहीं मिला।'); return; }
    const correctPin = staff.pin || '1234';
    if (staffPin !== correctPin) { setError('❌ गलत PIN! दोबारा कोशिश करें।'); return; }
    setLoading(true);
    setTimeout(() => {
      persistLogin({
        id:       `staff-${staff.id}`,
        email:    staff.email || '',
        name:     staff.name,
        role:     'staff',
        staffId:  staff.id,
        position: staff.position,
        phone:    staff.phone || '',
        permissions: { ...ROLE_PERMISSIONS.staff, staffId: staff.id },
      });
    }, 500);
  };

  // ── Quick Demo Admin ───────────────────────────────────────────────────────
  const quickAdmin = () => {
    setLoading(true);
    setTimeout(() => {
      persistLogin({
        id: 'admin-1', email: ADMIN_EMAIL, name: 'Admin User',
        role: 'admin', staffId: null,
        permissions: ROLE_PERMISSIONS.admin,
      });
    }, 400);
  };

  // ════════════════════════════════════════════════════════════════════════════
  // LANDING
  // ════════════════════════════════════════════════════════════════════════════
  if (mode === 'landing') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">

          {/* Branding */}
          <div className="text-white text-center md:text-left">
            <div className="text-6xl mb-4">🏍️</div>
            <h1 className="text-4xl md:text-5xl font-black tracking-widest mb-3">VP HONDA</h1>
            <p className="text-blue-300 text-lg mb-2 font-medium">Parwaliya Sadak, Bhopal (M.P.)</p>
            <div className="h-0.5 bg-gradient-to-r from-blue-500 to-transparent my-5 max-w-xs"></div>
            <p className="text-slate-300 text-sm mb-6">Dealership Management System</p>
            <ul className="space-y-2.5 text-sm text-slate-300">
              {['✅ Job Card & Invoice Management','✅ Staff Attendance & Salary',
                '✅ Customer Database','✅ Sales Reports & Analytics',
                '✅ Role-Based Access Control','✅ Pay Slip & Form 16 Generator'].map((f,i)=><li key={i}>{f}</li>)}
            </ul>
          </div>

          {/* Login options */}
          <div className="space-y-4">
            <div className="text-center text-white mb-6">
              <p className="text-slate-400 text-sm">अपना Role चुनें</p>
              <h2 className="text-xl font-bold mt-1">Login करें</h2>
            </div>

            <button onClick={() => { setMode('admin'); setError(''); }}
              className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white rounded-2xl p-5 flex items-center gap-4 shadow-xl transition-all group">
              <div className="bg-white/20 p-3 rounded-xl group-hover:bg-white/30 transition-all"><Shield size={28}/></div>
              <div className="text-left">
                <p className="font-black text-lg">Admin Login</p>
                <p className="text-yellow-200 text-sm">सभी features & records देखें</p>
              </div>
              <div className="ml-auto text-white/60">→</div>
            </button>

            <button onClick={() => { setMode('staff'); setError(''); setStaffPin(''); setStaffSelId(''); }}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-2xl p-5 flex items-center gap-4 shadow-xl transition-all group">
              <div className="bg-white/20 p-3 rounded-xl group-hover:bg-white/30 transition-all"><Users size={28}/></div>
              <div className="text-left">
                <p className="font-black text-lg">Staff Login</p>
                <p className="text-blue-200 text-sm">सिर्फ अपना account देखें</p>
              </div>
              <div className="ml-auto text-white/60">→</div>
            </button>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-slate-400 space-y-2">
              <p className="font-bold text-slate-300 mb-2">🔐 Access Control:</p>
              <div className="flex gap-2"><span className="text-yellow-400 font-bold flex-shrink-0">Admin:</span><span>सब कुछ — Dashboard, Reports, Staff Mgmt, Payments, Delete, Data Management</span></div>
              <div className="flex gap-2"><span className="text-blue-400 font-bold flex-shrink-0">Staff:</span><span>अपना Card, Check-in/out, Quotation बनाएं, Pay Slip। Delete/Data Mgmt नहीं।</span></div>
            </div>
            <p className="text-center text-slate-600 text-xs">© 2026 VP Honda Dealership, Bhopal</p>
          </div>
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // ADMIN LOGIN FORM
  // ════════════════════════════════════════════════════════════════════════════
  if (mode === 'admin') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-orange-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button onClick={() => setMode('landing')} className="text-slate-400 hover:text-white text-sm mb-6 flex items-center gap-2">← वापस जाएं</button>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-yellow-600 to-orange-600 px-8 py-6 text-white">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl"><Shield size={24}/></div>
              <div>
                <h2 className="text-xl font-black">Admin Login</h2>
                <p className="text-yellow-200 text-xs">VP Honda — Full Access</p>
              </div>
            </div>
          </div>

          <div className="px-8 py-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border-2 border-red-400 rounded-lg text-red-700 text-sm flex items-center gap-2">
                <AlertCircle size={16}/> {error}
              </div>
            )}
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-1">Email</label>
                <input type="text" value={adminEmail} onChange={e=>{setAdminEmail(e.target.value);setError('');}}
                  placeholder="admin@vphonda.com" autoFocus
                  className="w-full border-2 border-gray-300 focus:border-orange-500 rounded-lg px-4 py-3 text-gray-800 text-sm outline-none"/>
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-1">Password</label>
                <div className="relative">
                  <input type={showAdminPw?'text':'password'} value={adminPw} onChange={e=>{setAdminPw(e.target.value);setError('');}}
                    placeholder="Admin password"
                    className="w-full border-2 border-gray-300 focus:border-orange-500 rounded-lg px-4 py-3 pr-12 text-gray-800 text-sm outline-none"/>
                  <button type="button" onClick={()=>setShowAdminPw(!showAdminPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showAdminPw?<EyeOff size={18}/>:<Eye size={18}/>}
                  </button>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                <p className="font-bold mb-1">💡 Admin Credentials:</p>
                <p>Email: <code className="bg-amber-100 px-1 rounded">admin@vphonda.com</code></p>
                <p>Password: <code className="bg-amber-100 px-1 rounded">vphonda@123</code></p>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 disabled:opacity-50 text-white font-black py-3 rounded-xl text-base flex items-center justify-center gap-2">
                <LogIn size={18}/> {loading?'Logging in...':'Admin Login'}
              </button>
            </form>
            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <button onClick={quickAdmin} disabled={loading} className="text-orange-600 hover:text-orange-700 text-sm font-semibold">
                ⚡ Quick Demo Login (Admin)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // STAFF LOGIN FORM
  // ════════════════════════════════════════════════════════════════════════════
  if (mode === 'staff') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button onClick={() => setMode('landing')} className="text-slate-400 hover:text-white text-sm mb-6 flex items-center gap-2">← वापस जाएं</button>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-8 py-6 text-white">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl"><Users size={24}/></div>
              <div>
                <h2 className="text-xl font-black">Staff Login</h2>
                <p className="text-blue-200 text-xs">सिर्फ अपना account दिखेगा</p>
              </div>
            </div>
          </div>

          <div className="px-8 py-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border-2 border-red-400 rounded-lg text-red-700 text-sm flex items-center gap-2">
                <AlertCircle size={16}/> {error}
              </div>
            )}

            {staffList.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">👥</div>
                <p className="text-gray-600 font-semibold">कोई Staff नहीं मिला</p>
                <p className="text-gray-400 text-sm mt-2">Admin Login करके पहले staff add करें।</p>
                <button onClick={()=>setMode('landing')} className="mt-4 text-blue-600 text-sm font-bold">← वापस जाएं</button>
              </div>
            ) : (
              <form onSubmit={handleStaffLogin} className="space-y-4">
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-1">👤 अपना नाम चुनें *</label>
                  <select value={staffSelId} onChange={e=>{setStaffSelId(e.target.value);setError('');}} autoFocus
                    className="w-full border-2 border-gray-300 focus:border-blue-500 rounded-lg px-4 py-3 text-gray-800 text-sm outline-none bg-white">
                    <option value="">-- अपना नाम चुनें --</option>
                    {staffList.map(s=>(
                      <option key={s.id} value={s.id}>{s.name} ({s.position})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-1">🔐 PIN डालें</label>
                  <div className="relative">
                    <input type={showPin?'text':'password'} value={staffPin}
                      onChange={e=>{setStaffPin(e.target.value.replace(/\D/g,'').slice(0,6));setError('');}}
                      placeholder="4-6 अंक PIN" maxLength="6"
                      className="w-full border-2 border-gray-300 focus:border-blue-500 rounded-lg px-4 py-3 pr-12 text-gray-800 text-base tracking-widest font-mono outline-none"/>
                    <button type="button" onClick={()=>setShowPin(!showPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPin?<EyeOff size={18}/>:<Eye size={18}/>}
                    </button>
                  </div>
                  <p className="text-gray-400 text-xs mt-1.5 flex items-center gap-1"><Lock size={11}/> Default PIN: 1234</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
                  <p className="font-bold mb-1.5">ℹ️ Staff को मिलेगा:</p>
                  <p>✅ अपना attendance card · Check-in/out</p>
                  <p>✅ अपनी salary details · Pay Slip download</p>
                  <p>✅ Quotation बनाना (Edit भी)</p>
                  <p className="text-red-500 mt-1">❌ Quotation Delete नहीं · Data Management नहीं</p>
                  <p className="text-red-500">❌ दूसरे staff के records नहीं · Admin Panel नहीं</p>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-white font-black py-3 rounded-xl text-base flex items-center justify-center gap-2">
                  <LogIn size={18}/> {loading?'Logging in...':'Staff Login'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return null;
}