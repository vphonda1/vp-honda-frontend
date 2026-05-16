// SmartFAB.jsx — Smart Floating Action Button
// Features: Voice input, QR scan, Dark/Light theme toggle, Language switch
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mic, MicOff, QrCode, Sun, Moon, Globe, X, Zap } from 'lucide-react';
import { showInAppToast } from '../utils/smartUtils';

// ── THEME ──────────────────────────────────────────────
const applyTheme = (dark) => {
  const root = document.documentElement;
  if (dark) {
    // Dark mode: set CSS variables, but DON'T set body color globally
    // This prevents white text bleeding into light-background tables
    root.setAttribute('data-theme', 'dark');
    root.style.setProperty('--vp-bg', '#020617');
    root.style.setProperty('--vp-text', '#f1f5f9');
    root.style.setProperty('--vp-surface', '#0f172a');
    document.body.style.background = '#020617';
    // Only set color on dark-bg containers, NOT globally
    // Remove any previously set body color
    document.body.style.removeProperty('color');
  } else {
    // Light mode
    root.setAttribute('data-theme', 'light');
    root.style.setProperty('--vp-bg', '#f1f5f9');
    root.style.setProperty('--vp-text', '#0f172a');
    root.style.setProperty('--vp-surface', '#ffffff');
    document.body.style.background = '#f1f5f9';
    document.body.style.removeProperty('color');
  }
  localStorage.setItem('vp_theme', dark ? 'dark' : 'light');
};

// ── LANGUAGE ───────────────────────────────────────────
const TRANSLATIONS = {
  hi: {
    dashboard: 'डैशबोर्ड', vehicles: 'वाहन', customers: 'ग्राहक',
    staff: 'स्टाफ', salary: 'वेतन', parts: 'पार्ट्स',
    visitors: 'विज़िटर', pickup: 'पिकअप', calendar: 'कैलेंडर',
    payments: 'पेमेंट', documents: 'दस्तावेज़', reports: 'रिपोर्ट',
    intelligence: 'विश्लेषण', manager: 'मैनेजर',
  },
  en: {
    dashboard: 'Dashboard', vehicles: 'Vehicles', customers: 'Customers',
    staff: 'Staff', salary: 'Salary', parts: 'Parts',
    visitors: 'Visitors', pickup: 'Pickup', calendar: 'Calendar',
    payments: 'Payments', documents: 'Documents', reports: 'Reports',
    intelligence: 'Intelligence', manager: 'Manager',
  },
};
export const getLang = () => localStorage.getItem('vp_lang') || 'hi';
export const t = (key) => TRANSLATIONS[getLang()]?.[key] || key;

// ── VOICE COMMAND MAPPING ──────────────────────────────
const VOICE_ROUTES = [
  { keywords: ['डैशबोर्ड','dashboard','home','होम'],       route: '/dashboard' },
  { keywords: ['वाहन','vehicle','गाड़ी','bike'],            route: '/veh-dashboard' },
  { keywords: ['ग्राहक','customer','custumer','कस्टमर'],    route: '/customers' },
  { keywords: ['स्टाफ','staff','attendance','हाजिरी'],      route: '/staff-management' },
  { keywords: ['वेतन','salary','तनख्वाह','सैलरी'],          route: '/salary-management' },
  { keywords: ['पार्ट्स','parts','inventory','स्टॉक'],      route: '/parts' },
  { keywords: ['विज़िटर','visitor','showroom'],              route: '/visitors' },
  { keywords: ['पिकअप','pickup','drop','डेलीवरी','delivery'], route: '/pickup-drop' },
  { keywords: ['कैलेंडर','calendar','appointment'],          route: '/calendar' },
  { keywords: ['पेमेंट','payment','emi','ईएमआई','due'],      route: '/payments' },
  { keywords: ['दस्तावेज','document','aadhar','आधार'],       route: '/documents' },
  { keywords: ['रिपोर्ट','report','analytics'],              route: '/reports' },
  { keywords: ['मैनेजर','manager'],                          route: '/manager' },
  { keywords: ['job card','jobcard','जॉब'],                  route: '/job-cards' },
  { keywords: ['reminders','reminder','याद'],                route: '/reminders' },
];

const matchVoiceRoute = (transcript) => {
  const lower = transcript.toLowerCase();
  return VOICE_ROUTES.find(r => r.keywords.some(k => lower.includes(k)));
};

export default function SmartFAB({ user }) {
  const navigate   = useNavigate();
  const location   = useLocation();

  // ✅ Chat page पर FAB ऊपर — input area block नहीं होगा
  const isChat     = location.pathname === '/chat';
  const fabBottom  = isChat ? 130 : 20;
  const menuBottom = isChat ? 190 : 80;
  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('vp_theme') !== 'light');
  const [lang, setLang] = useState(getLang());
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [scanning, setScanning] = useState(false);
  const recognitionRef = useRef(null);

  if (!user) return null;

  // Apply theme on mount
  useEffect(() => { applyTheme(isDark); }, []);

  // ── VOICE INPUT ──────────────────────────────────────
  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      showInAppToast('❌ Voice नहीं', 'आपके browser में voice support नहीं है। Chrome use करें।', 'error');
      return;
    }
    const rec = new SR();
    rec.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onstart = () => { setListening(true); setTranscript('सुन रहा हूँ...'); };
    rec.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join(' ');
      setTranscript(t);
      if (e.results[e.results.length - 1].isFinal) {
        const match = matchVoiceRoute(t);
        if (match) {
          showInAppToast('🎤 Voice command', `"${t}" → ${match.route}`, 'success');
          setTimeout(() => { navigate(match.route); setOpen(false); setTranscript(''); }, 500);
        } else {
          setTranscript(`"${t}" — page नहीं मिला`);
          setTimeout(() => setTranscript(''), 2000);
        }
      }
    };
    rec.onerror = (e) => { setListening(false); setTranscript(''); };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setListening(false);
    setTranscript('');
  };

  // ── QR SCAN ──────────────────────────────────────────
  const startQRScan = async () => {
    if (!('BarcodeDetector' in window)) {
      showInAppToast('❌ QR Scan', 'Chrome 90+ पर काम करता है। Camera से manually try करें।', 'warning');
      return;
    }
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = document.createElement('video');
      video.srcObject = stream; video.play();
      const detector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
      let found = false;
      const scan = async () => {
        if (found) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) {
            found = true;
            stream.getTracks().forEach(t => t.stop());
            const value = codes[0].rawValue;
            showInAppToast('📷 QR Detected', value.substring(0, 60), 'success');
            // Try to navigate if it's a URL
            if (value.startsWith('http')) { window.open(value, '_blank'); }
            else { setTranscript(`QR: ${value}`); }
            setScanning(false);
          } else { requestAnimationFrame(scan); }
        } catch { requestAnimationFrame(scan); }
      };
      video.addEventListener('loadedmetadata', scan);
      setTimeout(() => { if (!found) { stream.getTracks().forEach(t => t.stop()); setScanning(false); showInAppToast('⏱️ QR Timeout', 'QR code नहीं मिला', 'warning'); } }, 10000);
    } catch(e) {
      setScanning(false);
      showInAppToast('❌ Camera Error', String(e), 'error');
    }
  };

  // ── THEME TOGGLE ─────────────────────────────────────
  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    applyTheme(newDark);
    showInAppToast(newDark ? '🌙 Dark Mode' : '☀️ Light Mode', '', 'info');
    setOpen(false);
  };

  // ── LANGUAGE TOGGLE ──────────────────────────────────
  const toggleLang = () => {
    const newLang = lang === 'hi' ? 'en' : 'hi';
    setLang(newLang);
    localStorage.setItem('vp_lang', newLang);
    showInAppToast(newLang === 'hi' ? '🌐 Hindi Mode' : '🌐 English Mode', 'Page reload करें changes के लिए', 'info');
    setOpen(false);
  };

  const actions = [
    {
      icon: listening ? <MicOff size={18}/> : <Mic size={18}/>,
      label: listening ? 'Stop' : `🎤 Voice (${lang==='hi'?'हिंदी':'English'})`,
      color: listening ? '#dc2626' : '#7c3aed',
      onClick: listening ? stopVoice : startVoice,
    },
    {
      icon: <QrCode size={18}/>,
      label: scanning ? '📷 Scanning...' : '📷 QR Scan',
      color: '#0891b2',
      onClick: startQRScan,
      disabled: scanning,
    },
    {
      icon: isDark ? <Sun size={18}/> : <Moon size={18}/>,
      label: isDark ? '☀️ Light Mode' : '🌙 Dark Mode',
      color: isDark ? '#fbbf24' : '#475569',
      onClick: toggleTheme,
    },
    {
      icon: <Globe size={18}/>,
      label: lang === 'hi' ? '🌐 Switch to English' : '🌐 हिंदी में',
      color: '#16a34a',
      onClick: toggleLang,
    },
  ];

  return (
    <>
      {/* Voice transcript overlay */}
      {(listening || transcript) && (
        <div style={{
          position: 'fixed', bottom: 140, left: '50%', transform: 'translateX(-50%)',
          background: '#0f172a', border: '1px solid #7c3aed', borderRadius: 12,
          padding: '10px 18px', zIndex: 200, maxWidth: 320, textAlign: 'center',
          boxShadow: '0 8px 30px rgba(124,58,237,0.4)',
        }}>
          <div style={{ color: '#a78bfa', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
            {listening ? '🎤 बोलिए... (Page का नाम)' : '✅ Command received'}
          </div>
          <div style={{ color: '#fff', fontSize: 14, fontStyle: transcript.startsWith('"') ? 'italic' : 'normal' }}>{transcript}</div>
          <div style={{ color: '#64748b', fontSize: 10, marginTop: 4 }}>
            {listening
              ? 'Try: "ग्राहक", "वाहन", "स्टाफ", "पेमेंट"...'
              : ''}
          </div>
        </div>
      )}

      {/* Action Menu */}
      {open && (
        <div style={{ position: 'fixed', bottom: menuBottom, right: 16, zIndex: 150, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          {actions.map((a, i) => (
            <button key={i} onClick={() => { if (!a.disabled) a.onClick(); }}
              disabled={a.disabled}
              style={{
                background: a.color, color: '#fff', border: 'none',
                borderRadius: 50, height: 44,
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '0 16px 0 12px',
                boxShadow: `0 4px 20px ${a.color}66`,
                cursor: a.disabled ? 'wait' : 'pointer',
                fontSize: 12, fontWeight: 700,
                animation: `vp-fab-in 0.2s ease ${i * 0.05}s both`,
                opacity: a.disabled ? 0.6 : 1,
              }}>
              {a.icon}
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main FAB Button */}
      <button
        onClick={() => { setOpen(o => !o); if (listening) stopVoice(); }}
        style={{
          position: 'fixed', bottom: fabBottom, right: 16, zIndex: 160,
          background: listening ? '#dc2626' : 'linear-gradient(135deg, #7c3aed, #DC0000)',
          color: '#fff', border: 'none',
          width: 52, height: 52, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 6px 24px ${listening ? '#dc2626' : '#7c3aed'}66`,
          cursor: 'pointer',
          transition: 'transform 0.2s',
          animation: listening ? 'vp-pulse-mic 1s ease infinite' : 'none',
        }}>
        {open ? <X size={22}/> : listening ? <MicOff size={22}/> : <Zap size={22}/>}
      </button>

      {/* Backdrop */}
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}/>
      )}

      <style>{`
        @keyframes vp-fab-in { from { opacity:0; transform: scale(0.7) translateY(10px); } to { opacity:1; transform: scale(1) translateY(0); } }
        @keyframes vp-pulse-mic { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.5); } 50% { box-shadow: 0 0 0 12px rgba(220,38,38,0); } }
      `}</style>
    </>
  );
}
