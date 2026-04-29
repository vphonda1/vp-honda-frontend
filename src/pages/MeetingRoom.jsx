// MeetingRoom.jsx — VP Honda Video Meeting + Staff Invite + Push Notifications
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Video, Copy, Phone, ArrowLeft, Users, Bell, Search, X, Check } from 'lucide-react';
import { sendWhatsApp, showInAppToast } from '../utils/smartUtils';
import { api } from '../utils/apiConfig';

const QUICK_ROOMS = [
  { id: 'morning-standup',  name: '☀️ Morning Standup',   desc: 'Daily 10 AM meeting' },
  { id: 'sales-review',     name: '🏍️ Sales Review',       desc: 'Weekly sales discussion' },
  { id: 'service-team',     name: '🔧 Service Team',       desc: 'Service department' },
  { id: 'manager-meeting',  name: '👔 Manager Meeting',    desc: 'Owner + managers' },
  { id: 'training',         name: '📚 Training Session',   desc: 'Staff training' },
  { id: 'customer-support', name: '❤️ Customer Support',  desc: 'Customer resolution' },
];

// ── Send push notification via backend ────────────────────────────────────────
async function sendMeetingPush(apiBase, title, body, url) {
  try {
    await fetch(`${apiBase}/api/messages/send-push`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title, body, url }),
    });
  } catch (e) {
    console.warn('[Push]', e.message);
  }
}

export default function MeetingRoom({ user }) {
  const navigate        = useNavigate();
  const [params]        = useSearchParams();
  const [customRoom,    setCustomRoom]    = useState(params.get('room') || '');
  const [inMeeting,     setInMeeting]     = useState(false);
  const [finalRoom,     setFinalRoom]     = useState('');
  const [staff,         setStaff]         = useState([]);
  const [invitePhone,   setInvitePhone]   = useState('');
  const [inviteSearch,  setInviteSearch]  = useState('');
  const [showDropdown,  setShowDropdown]  = useState(false);
  const [invited,       setInvited]       = useState(new Set());
  const [sending,       setSending]       = useState(false);
  const jitsiRef   = useRef(null);
  const jitsiApi   = useRef(null);
  const dropRef    = useRef(null);
  const myName     = user?.name || user?.email || 'VP Honda User';
  const BASE_URL   = window.location.origin;

  // Load staff from backend
  useEffect(() => {
    fetch(api('/api/staff'))
      .then(r => r.ok ? r.json() : [])
      .then(data => setStaff(data || []))
      .catch(() => {});
  }, []);

  // Auto-join if room param provided
  useEffect(() => {
    const room = params.get('room');
    if (room) startMeeting(room);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Jitsi setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!inMeeting || !finalRoom || !jitsiRef.current) return;

    const loadJitsi = () => {
      if (jitsiApi.current) { try { jitsiApi.current.dispose(); } catch {} }
      const _api = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName:   finalRoom,
        width:      '100%',
        height:     '100%',
        parentNode: jitsiRef.current,
        userInfo:   { displayName: myName, email: user?.email || '' },
        configOverwrite: {
          startWithAudioMuted:  false,
          startWithVideoMuted:  false,
          enableWelcomePage:    false,
          disableDeepLinking:   true,
          prejoinPageEnabled:   false,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK:   false,
          APP_NAME:               'VP Honda Meeting',
          DEFAULT_REMOTE_DISPLAY_NAME: 'VP Honda Staff',
        },
      });
      _api.addEventListeners({
        readyToClose: endMeeting,
        videoConferenceLeft: endMeeting,
        participantJoined: (e) => showInAppToast('👋 Joined', e.displayName || 'Someone', 'success'),
        participantLeft:   (e) => showInAppToast('👤 Left',   e.displayName || 'Someone', 'info'),
      });
      jitsiApi.current = _api;
    };

    if (window.JitsiMeetExternalAPI) {
      loadJitsi();
    } else {
      const s = document.createElement('script');
      s.src     = 'https://meet.jit.si/external_api.js';
      s.onload  = loadJitsi;
      s.onerror = () => showInAppToast('❌ Jitsi load failed', 'Internet check करें', 'error');
      document.head.appendChild(s);
    }

    return () => { try { jitsiApi.current?.dispose(); } catch {} };
  }, [inMeeting, finalRoom, myName]);

  // ── Start meeting ──────────────────────────────────────────────────────────
  const startMeeting = (room) => {
    const sanitized = (room || '').replace(/[^a-zA-Z0-9\-_]/g, '').toLowerCase();
    if (!sanitized) { showInAppToast('⚠️', 'Room name enter करें', 'warning'); return; }
    const full = sanitized.startsWith('vphonda-') ? sanitized : `vphonda-${sanitized}`;
    setFinalRoom(full);
    setInMeeting(true);
    setInvited(new Set());
  };

  const endMeeting = () => {
    try { jitsiApi.current?.dispose(); } catch {}
    jitsiApi.current = null;
    setInMeeting(false);
    showInAppToast('📞 Meeting ended', '', 'info');
  };

  // ── Invite person (WhatsApp + Push Notification) ───────────────────────────
  const sendInvite = async (name, phone) => {
    if (!phone) { showInAppToast('❌ Phone नहीं है', name, 'error'); return; }
    if (invited.has(phone)) { showInAppToast('⏩ Already invited', name, 'info'); return; }

    setSending(true);
    const room    = finalRoom || `vphonda-${customRoom}`;
    const link    = `${BASE_URL}/meeting?room=${room}`;
    const jitLink = `https://meet.jit.si/${room}`;

    // 1. WhatsApp invite
    const waMsg = `🎥 *VP Honda Meeting Invite*\n\n📋 *${myName}* आपको meeting में invite कर रहे हैं।\n\n👉 App link: ${link}\n\nया directly Jitsi पर:\n${jitLink}\n\nअभी join करें! 🙏`;
    sendWhatsApp(phone, waMsg);

    // 2. Push notification (app notification)
    await sendMeetingPush(
      api(''),
      `📹 Meeting Invite — ${myName}`,
      `VP Honda meeting शुरू हो गई है। अभी join करें!`,
      '/meeting'
    );

    setInvited(prev => new Set([...prev, phone]));
    showInAppToast('✅ Invite भेजा', `${name} को WhatsApp + Notification`, 'success');
    setSending(false);
    setShowDropdown(false);
    setInviteSearch('');
  };

  // ── Copy link ──────────────────────────────────────────────────────────────
  const copyLink = () => {
    const room = finalRoom || `vphonda-${customRoom}`;
    const link = `${BASE_URL}/meeting?room=${room}`;
    navigator.clipboard.writeText(link)
      .then(() => showInAppToast('🔗 Link copied!', link.slice(0, 60), 'success'))
      .catch(() => {
        prompt('Link copy करें:', link);
      });
  };

  // ── Filtered staff for dropdown ────────────────────────────────────────────
  const filteredStaff = staff.filter(s =>
    s.name !== myName &&
    (!inviteSearch || s.name.toLowerCase().includes(inviteSearch.toLowerCase()) ||
     (s.phone || s.mobileNo || '').includes(inviteSearch))
  );

  // ── INVITE PANEL (used both in lobby and in-meeting) ──────────────────────
  const InvitePanel = ({ compact = false }) => (
    <div style={{ background: compact ? 'transparent' : '#0f172a', border: compact ? 'none' : '1px solid #1e293b', borderRadius: 14, padding: compact ? 0 : 16 }}>
      {!compact && <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Users size={16} color="#DC0000"/> Staff को Invite करें
      </h3>}

      <div ref={dropRef} style={{ position: 'relative' }}>
        {/* Search + dropdown */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: 11, color: '#64748b', pointerEvents: 'none' }}/>
            <input
              value={inviteSearch}
              onChange={e => { setInviteSearch(e.target.value); setShowDropdown(true); setInvitePhone(''); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Staff name search करें..."
              style={{
                width: '100%', background: '#1e293b', border: '1px solid #475569',
                borderRadius: 8, padding: '10px 10px 10px 32px',
                color: '#fff', fontSize: 12, outline: 'none',
              }}
            />
            {inviteSearch && (
              <button onClick={() => { setInviteSearch(''); setInvitePhone(''); setShowDropdown(false); }}
                style={{ position: 'absolute', right: 8, top: 10, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={14}/>
              </button>
            )}
          </div>

          {/* Manual phone input */}
          <input
            value={invitePhone}
            onChange={e => { setInvitePhone(e.target.value.replace(/\D/g, '')); setInviteSearch(''); }}
            placeholder="या phone number डालें"
            maxLength={10}
            style={{
              width: 160, background: '#1e293b', border: '1px solid #475569',
              borderRadius: 8, padding: '10px 12px',
              color: '#fff', fontSize: 12, outline: 'none',
            }}
          />

          <button
            onClick={() => {
              if (invitePhone.length === 10) sendInvite('Manual', invitePhone);
              else showInAppToast('⚠️', '10 digit phone number डालें', 'warning');
            }}
            disabled={sending}
            style={{
              background: 'linear-gradient(135deg,#25D366,#128C7E)',
              border: 'none', borderRadius: 8, padding: '10px 16px',
              color: '#fff', fontWeight: 700, fontSize: 12, cursor: sending ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            }}>
            📱 WhatsApp + 🔔 Notify
          </button>
        </div>

        {/* Staff Dropdown */}
        {showDropdown && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: '#0f172a', border: '1px solid #334155',
            borderRadius: 10, zIndex: 100, maxHeight: 280,
            overflowY: 'auto', marginTop: 4,
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          }}>
            {filteredStaff.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                {staff.length === 0 ? 'Staff Management में staff add करें' : 'कोई staff नहीं मिला'}
              </div>
            ) : (
              filteredStaff.map(s => {
                const phone = s.phone || s.mobileNo || '';
                const isInvited = invited.has(phone);
                return (
                  <div key={s._id || s.name}
                    style={{
                      padding: '10px 14px', display: 'flex',
                      alignItems: 'center', gap: 10,
                      borderBottom: '1px solid #1e293b',
                      background: 'transparent', cursor: 'pointer',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1e293b'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: isInvited ? '#16a34a' : '#DC0000',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 14, color: '#fff', flexShrink: 0,
                    }}>
                      {isInvited ? <Check size={16}/> : s.name?.[0]?.toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 13, margin: 0, color: '#fff' }}>{s.name}</p>
                      <p style={{ color: '#64748b', fontSize: 10, margin: '2px 0 0' }}>
                        {s.position || 'Staff'}
                        {phone && <span style={{ marginLeft: 6 }}>📞 {phone}</span>}
                      </p>
                    </div>

                    {/* Invite button */}
                    <button
                      onClick={() => sendInvite(s.name, phone)}
                      disabled={isInvited || sending || !phone}
                      style={{
                        background: isInvited ? '#16a34a' : phone ? '#7c3aed' : '#475569',
                        border: 'none', borderRadius: 6, padding: '6px 12px',
                        color: '#fff', fontWeight: 700, fontSize: 11,
                        cursor: isInvited || !phone ? 'default' : 'pointer',
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                      {isInvited ? '✅ Invited' : !phone ? '📵 No phone' : '📱 Invite'}
                    </button>
                  </div>
                );
              })
            )}

            {/* All invite at once */}
            {filteredStaff.filter(s => (s.phone || s.mobileNo) && !invited.has(s.phone || s.mobileNo)).length > 1 && (
              <button
                onClick={async () => {
                  const toInvite = filteredStaff.filter(s => s.phone || s.mobileNo).slice(0, 10);
                  if (!window.confirm(`${toInvite.length} सब staff को invite करना है?`)) return;
                  for (const s of toInvite) {
                    await sendInvite(s.name, s.phone || s.mobileNo);
                    await new Promise(r => setTimeout(r, 1500));
                  }
                }}
                style={{
                  width: '100%', background: '#DC0000', border: 'none',
                  padding: '10px', color: '#fff', fontWeight: 800,
                  fontSize: 12, cursor: 'pointer',
                  borderTop: '1px solid #334155',
                }}>
                📣 सब Staff को Invite करें ({filteredStaff.filter(s => s.phone || s.mobileNo).length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Invited count */}
      {invited.size > 0 && (
        <p style={{ color: '#86efac', fontSize: 11, margin: '8px 0 0', fontWeight: 600 }}>
          ✅ {invited.size} staff invited — WhatsApp + notification भेज दिया
        </p>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // IN-MEETING VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (inMeeting) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <div style={{ padding: '8px 16px', background: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', animation: 'vp-blink 1.5s infinite' }}/>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>🎥 Live — {finalRoom}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={copyLink}
              style={{ background: '#1e293b', border: 'none', color: '#94a3b8', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Copy size={12}/> Link Copy
            </button>
            <button onClick={endMeeting}
              style={{ background: '#dc2626', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Phone size={12}/> End Call
            </button>
          </div>
        </div>

        {/* Jitsi */}
        <div ref={jitsiRef} style={{ flex: 1, background: '#111' }}/>

        {/* Invite bar */}
        <div style={{ padding: '10px 16px', background: '#0a0f1e', borderTop: '1px solid #1e293b', flexShrink: 0 }}>
          <InvitePanel compact={true}/>
        </div>

        <style>{`@keyframes vp-blink { 0%,100%{opacity:1}50%{opacity:0.3} }`}</style>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LOBBY VIEW
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: 16, background: '#020617', minHeight: '100vh', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={() => navigate(-1)}
          style={{ background: '#1e293b', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
          <ArrowLeft size={16}/>
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Video size={20}/> Video Meeting
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 12, margin: '4px 0 0' }}>
            Staff के साथ video call — बिल्कुल free · {staff.length} staff loaded
          </p>
        </div>
      </div>

      {/* Quick Start */}
      <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px', color: '#a78bfa' }}>⚡ Meeting Start करें</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={customRoom}
            onChange={e => setCustomRoom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startMeeting(customRoom)}
            placeholder="Room name (खाली छोड़ें = instant room)..."
            style={{ flex: 1, minWidth: 200, background: '#1e293b', border: '1px solid #475569', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none' }}
          />
          <button onClick={() => startMeeting(customRoom || `instant-${Date.now()}`)}
            style={{ background: 'linear-gradient(135deg,#7c3aed,#DC0000)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Video size={16}/> Start Meeting
          </button>
        </div>
      </div>

      {/* Quick Rooms */}
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase' }}>📋 Quick Rooms</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 10, marginBottom: 20 }}>
        {QUICK_ROOMS.map(r => (
          <div key={r.id} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 3px' }}>{r.name}</p>
              <p style={{ color: '#64748b', fontSize: 11, margin: 0 }}>{r.desc}</p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { navigator.clipboard.writeText(`${BASE_URL}/meeting?room=vphonda-${r.id}`); showInAppToast('🔗 Copied', '', 'success'); }}
                style={{ background: '#1e293b', border: 'none', color: '#94a3b8', padding: '6px 8px', borderRadius: 6, cursor: 'pointer' }}>
                <Copy size={12}/>
              </button>
              <button onClick={() => startMeeting(r.id)}
                style={{ background: '#7c3aed', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Video size={12}/> Join
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Staff Invite Panel */}
      <InvitePanel/>

      {/* Info */}
      <div style={{ background: 'linear-gradient(135deg,#1e3a8a22,#7c3aed11)', border: '1px solid #3b82f655', borderRadius: 12, padding: 14, marginTop: 16 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: '#93c5fd', margin: '0 0 8px' }}>ℹ️ Meeting के बारे में</h4>
        <ul style={{ color: '#94a3b8', fontSize: 12, margin: 0, paddingLeft: 16, lineHeight: 1.9 }}>
          <li>Jitsi Meet — पूरी तरह <b style={{ color: '#86efac' }}>Free</b>, कोई account नहीं</li>
          <li>Staff invite = <b style={{ color: '#fff' }}>WhatsApp message + App notification</b> दोनों जाएंगे</li>
          <li>📱 Staff को notification मिलेगी अगर उनका notifications ON है</li>
          <li>HD Video, Screen Share, Chat, Recording included</li>
          <li>अधिकतम <b style={{ color: '#fff' }}>100 participants</b></li>
        </ul>
      </div>
    </div>
  );
}
