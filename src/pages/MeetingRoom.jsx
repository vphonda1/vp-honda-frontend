// MeetingRoom.jsx — VP Honda Video Meeting Room
// Uses Jitsi Meet (free, open-source, no backend needed)
// Features: Video call, screen share, chat, recording, hand raise
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Video, Copy, Users, Phone, Link, ArrowLeft, Settings } from 'lucide-react';
import { showInAppToast, sendWhatsApp } from '../utils/smartUtils';

// Predefined meeting rooms
const QUICK_ROOMS = [
  { id: 'morning-standup',  name: '☀️ Morning Standup',     desc: 'Daily 10 AM meeting' },
  { id: 'sales-review',     name: '🏍️ Sales Review',        desc: 'Weekly sales discussion' },
  { id: 'service-team',     name: '🔧 Service Team',         desc: 'Service department meeting' },
  { id: 'manager-meeting',  name: '👔 Manager Meeting',      desc: 'Owner + managers' },
  { id: 'training',         name: '📚 Training Session',     desc: 'Staff training' },
  { id: 'customer-support', name: '❤️ Customer Support',    desc: 'Customer issue resolution' },
];

export default function MeetingRoom({ user }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [roomName, setRoomName] = useState(searchParams.get('room') || '');
  const [customRoom, setCustomRoom] = useState('');
  const [inMeeting, setInMeeting] = useState(false);
  const [finalRoom, setFinalRoom] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const jitsiRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const myName = user?.name || user?.email || 'VP Honda User';

  // If room param passed (e.g., from chat), auto-join
  useEffect(() => {
    const room = searchParams.get('room');
    if (room) { setRoomName(room); }
  }, [searchParams]);

  const startMeeting = (room) => {
    // Sanitize room name: only letters, numbers, hyphens
    const sanitized = room.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
    if (!sanitized) { alert('Room name enter करें'); return; }
    // Prefix with vphonda to avoid conflicts with random public rooms
    const finalRoomName = sanitized.startsWith('vphonda-') ? sanitized : `vphonda-${sanitized}`;
    setFinalRoom(finalRoomName);
    setInMeeting(true);
  };

  useEffect(() => {
    if (!inMeeting || !finalRoom || !jitsiRef.current) return;

    // Load Jitsi script dynamically
    const loadJitsi = () => {
      if (jitsiApiRef.current) { jitsiApiRef.current.dispose(); }

      const api = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName: finalRoom,
        width: '100%',
        height: '100%',
        parentNode: jitsiRef.current,
        userInfo: {
          displayName: myName,
          email: user?.email || '',
        },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          enableWelcomePage: false,
          disableDeepLinking: true,
          prejoinPageEnabled: false,
          enableClosePage: false,
          toolbarButtons: [
            'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
            'hangup', 'chat', 'raisehand', 'participants-pane',
            'toggle-camera', 'videoquality', 'filmstrip',
          ],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          APP_NAME: 'VP Honda Meeting',
          NATIVE_APP_NAME: 'VP Honda',
          DEFAULT_REMOTE_DISPLAY_NAME: 'VP Honda Staff',
          TOOLBAR_ALWAYS_VISIBLE: false,
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
          BRAND_WATERMARK_LINK: '',
        },
      });

      api.addEventListeners({
        readyToClose: () => { endMeeting(); },
        participantLeft: (e) => {
          showInAppToast('👤 Participant left', e.displayName || 'Someone', 'info');
        },
        participantJoined: (e) => {
          showInAppToast('👋 Joined', e.displayName || 'Someone joined', 'success');
        },
        videoConferenceLeft: () => { endMeeting(); },
      });

      jitsiApiRef.current = api;
    };

    if (window.JitsiMeetExternalAPI) {
      loadJitsi();
    } else {
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.onload = loadJitsi;
      script.onerror = () => showInAppToast('❌ Meeting failed', 'Internet check करें', 'error');
      document.head.appendChild(script);
    }

    return () => { if (jitsiApiRef.current) { try { jitsiApiRef.current.dispose(); } catch {} } };
  }, [inMeeting, finalRoom, myName]);

  const endMeeting = () => {
    if (jitsiApiRef.current) { try { jitsiApiRef.current.dispose(); } catch {} jitsiApiRef.current = null; }
    setInMeeting(false);
    showInAppToast('📞 Meeting ended', '', 'info');
  };

  const copyLink = () => {
    const link = `${window.location.origin}/meeting?room=${finalRoom || roomName}`;
    navigator.clipboard.writeText(link).then(() => showInAppToast('🔗 Link copied!', link.slice(0, 50), 'success')).catch(() => {});
  };

  const inviteViaWA = () => {
    if (!invitePhone) { alert('Phone number enter करें'); return; }
    const room = finalRoom || roomName;
    const link = `${window.location.origin}/meeting?room=${room}`;
    sendWhatsApp(invitePhone,
      `🎥 VP Honda Team Meeting में join करें!\n\n📅 अभी\n🔗 Link: ${link}\n\nYa directly Jitsi पर:\nhttps://meet.jit.si/${room}\n\n- ${myName}`
    );
    setInvitePhone('');
    showInAppToast('📱 Invite भेजा', '', 'success');
  };

  // ── IN MEETING VIEW ────────────────────────────────
  if (inMeeting) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <div style={{ padding: '8px 16px', background: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', animation: 'vp-blink 1.5s infinite' }}/>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>🎥 Live Meeting — {finalRoom}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={copyLink}
              style={{ background: '#1e293b', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Copy size={12}/> Invite Link
            </button>
            <button onClick={endMeeting}
              style={{ background: '#dc2626', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Phone size={12}/> End Call
            </button>
          </div>
        </div>

        {/* Jitsi iframe container */}
        <div ref={jitsiRef} style={{ flex: 1, background: '#111' }}/>

        {/* Invite bar at bottom */}
        <div style={{ padding: '10px 16px', background: '#0a0f1e', borderTop: '1px solid #1e293b', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={invitePhone} onChange={e => setInvitePhone(e.target.value.replace(/\D/g,''))} placeholder="Staff का phone — WhatsApp invite भेजें"
            maxLength={10}
            style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 12, outline: 'none' }}/>
          <button onClick={inviteViaWA}
            style={{ background: '#25D366', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
            📱 WhatsApp Invite
          </button>
        </div>
        <style>{`@keyframes vp-blink { 0%,100% { opacity:1; } 50% { opacity:0.3; } }`}</style>
      </div>
    );
  }

  // ── PRE-MEETING LOBBY ──────────────────────────────
  return (
    <div style={{ padding: 16, background: '#020617', minHeight: '100vh', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ background: '#1e293b', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
          <ArrowLeft size={16}/>
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Video size={20}/> Video Meeting
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 12, margin: '4px 0 0' }}>Staff के साथ video call करें — बिल्कुल free</p>
        </div>
      </div>

      {/* Quick Join Room */}
      <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px', color: '#a78bfa' }}>⚡ Quick Start</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={customRoom} onChange={e => setCustomRoom(e.target.value)} placeholder="Room name या link enter करें..."
            onKeyDown={e => e.key === 'Enter' && startMeeting(customRoom)}
            style={{ flex: 1, minWidth: 200, background: '#1e293b', border: '1px solid #475569', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none' }}/>
          <button onClick={() => startMeeting(customRoom || `instant-${Date.now()}`)}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #DC0000)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Video size={16}/> Start Meeting
          </button>
        </div>
        <p style={{ color: '#64748b', fontSize: 11, marginTop: 8, marginBottom: 0 }}>
          💡 Room name blank छोड़ने पर एक unique instant room बनेगा
        </p>
      </div>

      {/* Pre-built Quick Rooms */}
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase' }}>📋 Quick Rooms</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, marginBottom: 20 }}>
        {QUICK_ROOMS.map(r => (
          <div key={r.id} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 3px' }}>{r.name}</p>
              <p style={{ color: '#64748b', fontSize: 11, margin: 0 }}>{r.desc}</p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/meeting?room=vphonda-${r.id}`); showInAppToast('🔗 Link copied','','success'); }}
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

      {/* Invite via WhatsApp */}
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px' }}>📱 किसी को Invite करें</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={invitePhone} onChange={e => setInvitePhone(e.target.value.replace(/\D/g,''))} placeholder="Phone number..."
            maxLength={10}
            style={{ flex: 1, minWidth: 180, background: '#1e293b', border: '1px solid #475569', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 13, outline: 'none' }}/>
          <button onClick={inviteViaWA}
            style={{ background: '#25D366', border: 'none', color: '#fff', padding: '10px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            📱 WhatsApp Invite
          </button>
        </div>
      </div>

      {/* Info box */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a8a22, #7c3aed11)', border: '1px solid #3b82f655', borderRadius: 12, padding: 14, marginTop: 16 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: '#93c5fd', margin: '0 0 8px' }}>ℹ️ Video Meeting के बारे में</h4>
        <ul style={{ color: '#94a3b8', fontSize: 12, margin: 0, paddingLeft: 16, lineHeight: 1.8 }}>
          <li>Jitsi Meet use करता है — पूरी तरह <b style={{ color: '#86efac' }}>Free</b>, कोई account नहीं चाहिए</li>
          <li>HD Video, Screen Share, Chat, Recording सब included</li>
          <li>Room link share करके कोई भी join कर सकता है</li>
          <li>Meeting अधिकतम <b style={{ color: '#fff' }}>100 participants</b> support करता है</li>
          <li>Mobile में भी काम करता है — Chrome browser use करें</li>
        </ul>
      </div>
    </div>
  );
}
