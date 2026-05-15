// MeetingRoom.jsx — VP Honda Video Meeting (Simple + Staff Search)
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X, Check, Video, Copy, Phone, ArrowLeft } from 'lucide-react';
import { sendWhatsApp, showInAppToast } from '../utils/smartUtils';
import { api } from '../utils/apiConfig';

const QUICK_ROOMS = [
  { id: 'daily-standup',  name: '☀️ Daily Standup'   },
  { id: 'sales-review',   name: '🏍️ Sales Review'    },
  { id: 'service-team',   name: '🔧 Service Team'    },
  { id: 'manager',        name: '👔 Manager Meeting' },
];

export default function MeetingRoom({ user }) {
  const navigate       = useNavigate();
  const [params]       = useSearchParams();
  const [inMeeting,    setInMeeting]    = useState(false);
  const [roomName,     setRoomName]     = useState(params.get('room') || '');
  const [finalRoom,    setFinalRoom]    = useState('');
  const [staff,        setStaff]        = useState([]);
  const [search,       setSearch]       = useState('');
  const [invited,      setInvited]      = useState(new Set());
  const [sending,      setSending]      = useState(false);
  const jitsiRef = useRef(null);
  const jitsiApi = useRef(null);
  const myName   = user?.name || 'VP Honda User';

  // Load staff
  useEffect(() => {
    fetch(api('/api/staff')).then(r => r.ok ? r.json() : []).then(setStaff).catch(() => {});
  }, []);

  // Auto-join if room in URL
  useEffect(() => {
    const r = params.get('room');
    if (r) startMeeting(r);
  }, []);

  // Load Jitsi
  useEffect(() => {
    if (!inMeeting || !finalRoom || !jitsiRef.current) return;
    let disposed = false;

    const initJitsi = () => {
      if (disposed || !jitsiRef.current) return;
      try {
        if (jitsiApi.current) { try { jitsiApi.current.dispose(); } catch {} }
        jitsiApi.current = new window.JitsiMeetExternalAPI('meet.jit.si', {
          roomName:   finalRoom,
          width:      '100%',
          height:     '100%',
          parentNode: jitsiRef.current,
          userInfo:   { displayName: myName },
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            prejoinPageEnabled:  false,
            enableNoisyMicDetection: false,
          },
          interfaceConfigOverwrite: {
            APP_NAME: 'VP Honda Meeting',
            SHOW_JITSI_WATERMARK: false,
            TOOLBAR_BUTTONS: ['microphone','camera','closedcaptions','desktop','fullscreen','fodeviceselection','hangup','chat','recording','livestreaming','etherpad','sharedvideo','settings','raisehand','videoquality','filmstrip','feedback','stats','shortcuts','tileview','select-background','help','mute-everyone'],
          },
        });
        jitsiApi.current.addEventListeners({
          readyToClose:        endMeeting,
          videoConferenceLeft: endMeeting,
          participantJoined:   (e) => showInAppToast('👋 Joined', e.displayName || 'Someone', 'success'),
        });
      } catch (err) {
        console.error('Jitsi init error:', err);
        showInAppToast('❌ Meeting load failed', 'Internet check करें', 'error');
      }
    };

    if (window.JitsiMeetExternalAPI) {
      initJitsi();
    } else {
      // Check if script already loading
      const existing = document.querySelector('script[src*="meet.jit.si/external_api"]');
      if (existing) {
        existing.addEventListener('load', initJitsi);
      } else {
        const s = document.createElement('script');
        s.src = 'https://meet.jit.si/external_api.js';
        s.async = true;
        s.onload  = initJitsi;
        s.onerror = () => showInAppToast('❌ Jitsi load failed', 'Internet check करें', 'error');
        document.head.appendChild(s);
      }
    }

    return () => {
      disposed = true;
      try { jitsiApi.current?.dispose?.(); } catch {}
    };
  }, [inMeeting, finalRoom]);

  const startMeeting = (room) => {
    const clean = (room || `instant-${Date.now()}`).replace(/[^a-zA-Z0-9\-_]/g, '').toLowerCase();
    const full  = clean.startsWith('vphonda-') ? clean : `vphonda-${clean}`;
    setFinalRoom(full);
    setInMeeting(true);
    setInvited(new Set());
  };

  const endMeeting = () => {
    try { jitsiApi.current?.dispose?.(); } catch {}
    jitsiApi.current = null;
    setInMeeting(false);
  };

  const copyLink = () => {
    const link = `${window.location.origin}/meeting?room=${finalRoom || `vphonda-${roomName}`}`;
    navigator.clipboard.writeText(link).then(() => showInAppToast('🔗 Link copied!', '', 'success')).catch(() => prompt('Copy करें:', link));
  };

  // Invite staff: WhatsApp + Push notification
  const inviteStaff = async (s) => {
    const phone = s.phone || s.mobileNo || '';
    if (invited.has(s._id || s.name)) { showInAppToast('⏩ Already invited', s.name, 'info'); return; }
    setSending(true);
    const room  = finalRoom || `vphonda-${roomName}`;
    const link  = `${window.location.origin}/meeting?room=${room}`;
    // WhatsApp
    if (phone) {
      sendWhatsApp(phone, `🎥 *VP Honda Meeting Invite*\n\n${myName} आपको meeting में बुला रहे हैं।\n\n👉 Join करें: ${link}\n\n🕐 अभी join करें!`);
    }
    // Push notification
    try {
      await fetch(api('/api/push/send-push'), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title: `📹 Meeting Invite — ${myName}`, body: 'VP Honda meeting शुरू हो गई है। Join करें!', url: '/meeting' }),
      });
    } catch {}
    setInvited(prev => new Set([...prev, s._id || s.name]));
    showInAppToast('✅ Invited', `${s.name} — WhatsApp + Notification`, 'success');
    setSending(false);
  };

  // Invite all
  const inviteAll = async () => {
    if (!window.confirm(`सब ${filteredStaff.length} staff को invite करना है?`)) return;
    for (const s of filteredStaff) {
      await inviteStaff(s);
      await new Promise(r => setTimeout(r, 1500));
    }
  };

  const filteredStaff = staff.filter(s =>
    s.name !== myName &&
    (!search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.phone||s.mobileNo||'').includes(search))
  );

  // ── IN-MEETING VIEW ────────────────────────────────────────────────────────
  if (inMeeting) {
    return (
      <div style={{ position:'fixed', inset:0, background:'#000', zIndex:200, display:'flex', flexDirection:'column' }}>
        {/* Top bar */}
        <div style={{ padding:'8px 14px', background:'#0a0f1e', borderBottom:'1px solid #1e293b', display:'flex', alignItems:'center', gap:10, flexShrink:0, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#16a34a' }}/>
            <span style={{ color:'#fff', fontWeight:700, fontSize:13 }}>🎥 Live — {finalRoom}</span>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button onClick={copyLink} style={{ background:'#1e293b', border:'none', color:'#94a3b8', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:11, fontWeight:700 }}>
              <Copy size={12} style={{ marginRight:4, verticalAlign:'middle' }}/>Link
            </button>
            <button onClick={endMeeting} style={{ background:'#dc2626', border:'none', color:'#fff', borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:12, fontWeight:700 }}>
              📵 End Call
            </button>
          </div>
        </div>

        {/* Jitsi */}
        <div ref={jitsiRef} style={{ flex:1, background:'#111' }}/>

        {/* Invite bar */}
        <div style={{ padding:'10px 14px', background:'#0a0f1e', borderTop:'1px solid #1e293b', flexShrink:0 }}>
          <StaffInvitePanel/>
        </div>
      </div>
    );
  }

  // ── Staff Invite Component ─────────────────────────────────────────────────
  const StaffInvitePanel = () => (
    <div>
      {/* Search */}
      <div style={{ position:'relative', marginBottom:8 }}>
        <Search size={13} style={{ position:'absolute', left:10, top:10, color:'#64748b' }}/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Staff name search करें..."
          style={{ width:'100%', background:'#1e293b', border:'1px solid #475569', borderRadius:8, padding:'10px 10px 10px 32px', color:'#fff', fontSize:12, outline:'none' }}/>
        {search && <button onClick={() => setSearch('')} style={{ position:'absolute', right:8, top:8, background:'none', border:'none', color:'#64748b', cursor:'pointer' }}><X size={14}/></button>}
      </div>

      {/* Staff list */}
      <div style={{ maxHeight: inMeeting ? 160 : 300, overflowY:'auto', border:'1px solid #1e293b', borderRadius:8 }}>
        {filteredStaff.length === 0 ? (
          <div style={{ padding:16, textAlign:'center', color:'#64748b', fontSize:12 }}>
            {staff.length === 0 ? 'Staff Management में staff add करें' : 'कोई नहीं मिला'}
          </div>
        ) : filteredStaff.map(s => {
          const phone     = s.phone || s.mobileNo || '';
          const isInvited = invited.has(s._id || s.name);
          return (
            <div key={s._id || s.name} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderBottom:'1px solid #1e293b', background:'transparent' }}>
              {/* Avatar */}
              <div style={{ width:36, height:36, borderRadius:'50%', background: isInvited ? '#16a34a' : '#1e40af', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14, flexShrink:0 }}>
                {isInvited ? <Check size={16}/> : s.name?.[0]?.toUpperCase()}
              </div>
              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontWeight:700, fontSize:13, margin:0, color:'#fff' }}>{s.name}</p>
                <p style={{ color:'#64748b', fontSize:10, margin:'2px 0 0' }}>
                  {s.position || 'Staff'}{phone && ` · 📞 ${phone}`}
                </p>
              </div>
              {/* Invite button */}
              <button onClick={() => inviteStaff(s)} disabled={isInvited || sending}
                style={{ background: isInvited ? '#16a34a' : '#7c3aed', border:'none', borderRadius:8, padding:'7px 14px', color:'#fff', fontWeight:700, fontSize:12, cursor: isInvited ? 'default' : 'pointer', whiteSpace:'nowrap' }}>
                {isInvited ? '✅ Invited' : '📱 Invite'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Invite all */}
      {filteredStaff.filter(s => !invited.has(s._id||s.name)).length > 1 && (
        <button onClick={inviteAll} style={{ width:'100%', marginTop:8, background:'#DC0000', border:'none', borderRadius:8, padding:'10px', color:'#fff', fontWeight:800, fontSize:12, cursor:'pointer' }}>
          📣 सब Staff को Invite करें ({filteredStaff.filter(s => !invited.has(s._id||s.name)).length})
        </button>
      )}
      {invited.size > 0 && (
        <p style={{ color:'#86efac', fontSize:11, margin:'8px 0 0', fontWeight:600 }}>
          ✅ {invited.size} staff invited — WhatsApp + Phone notification भेज दिया
        </p>
      )}
    </div>
  );

  // ── LOBBY VIEW ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding:16, background:'#020617', minHeight:'100vh', color:'#fff' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <button onClick={() => navigate(-1)} style={{ background:'#1e293b', border:'none', color:'#fff', borderRadius:8, padding:'7px 10px', cursor:'pointer' }}>
          <ArrowLeft size={16}/>
        </button>
        <div>
          <h1 style={{ fontSize:18, fontWeight:800, margin:0 }}>🎥 Video Meeting</h1>
          <p style={{ color:'#94a3b8', fontSize:12, margin:'3px 0 0' }}>Free · HD Video · Screen Share · {staff.length} staff loaded</p>
        </div>
      </div>

      {/* Start Meeting */}
      <div style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:14, padding:16, marginBottom:16 }}>
        <h3 style={{ fontSize:14, fontWeight:800, margin:'0 0 12px', color:'#a78bfa' }}>⚡ Meeting Start करें</h3>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input value={roomName} onChange={e => setRoomName(e.target.value)} onKeyDown={e => e.key==='Enter' && startMeeting(roomName)}
            placeholder="Room name (खाली = instant meeting)..."
            style={{ flex:1, minWidth:180, background:'#1e293b', border:'1px solid #475569', borderRadius:8, padding:'10px 14px', color:'#fff', fontSize:13, outline:'none' }}/>
          <button onClick={() => startMeeting(roomName || `instant-${Date.now()}`)}
            style={{ background:'linear-gradient(135deg,#7c3aed,#DC0000)', color:'#fff', border:'none', padding:'10px 20px', borderRadius:8, fontWeight:800, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            <Video size={16}/> Start
          </button>
        </div>
      </div>

      {/* Quick Rooms */}
      <h3 style={{ fontSize:12, fontWeight:700, color:'#94a3b8', marginBottom:8, textTransform:'uppercase' }}>📋 Quick Rooms</h3>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8, marginBottom:20 }}>
        {QUICK_ROOMS.map(r => (
          <div key={r.id} style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:10, padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontWeight:700, fontSize:13 }}>{r.name}</span>
            <button onClick={() => startMeeting(r.id)} style={{ background:'#7c3aed', border:'none', color:'#fff', padding:'6px 14px', borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:12 }}>
              Join
            </button>
          </div>
        ))}
      </div>

      {/* Staff Invite */}
      <div style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:14, padding:16 }}>
        <h3 style={{ fontSize:14, fontWeight:800, margin:'0 0 12px', display:'flex', alignItems:'center', gap:6 }}>
          👥 Staff को Invite करें
        </h3>
        <StaffInvitePanel/>
      </div>
    </div>
  );
}
