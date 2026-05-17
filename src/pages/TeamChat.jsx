// TeamChat.jsx — VP Honda v3.0 [BUILD 2026] - Video Voice Document Location
// Text, Photo, Video, Voice, Document, Location, Reply, Forward, Edit, Star, Search, Read receipts
import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Image, X, Search, Menu, Bell, BellOff, Settings, Phone, Video, Mic, MicOff, MapPin, FileText, Star, Forward, Edit2, Check, CheckCheck, Smile, Paperclip, ChevronRight, MoreVertical, Play, Pause, Download } from 'lucide-react';
import { captureFromCamera, sendWhatsApp, showInAppToast } from '../utils/smartUtils';
import { api } from '../utils/apiConfig';

const DEFAULT_GROUPS = [
  { id: 'general',  name: '🏢 General',     desc: 'सब staff',         color: '#DC0000' },
  { id: 'sales',    name: '🏍️ Sales',        desc: 'Vehicle sales',   color: '#2563eb' },
  { id: 'service',  name: '🔧 Service',      desc: 'Service & repair',color: '#16a34a' },
  { id: 'accounts', name: '💰 Accounts',     desc: 'Finance',         color: '#d97706' },
  { id: 'manager',  name: '👔 Manager',      desc: 'Admin',           color: '#7c3aed' },
];
const EMOJIS = ['👍','❤️','😂','😊','🎉','🔥','✅','🙏','💪','👏','🏍️','🔧','💰','📞','⚠️','🙌','😍','😎','🤔','💯','✨','🚀'];
const LS_MEMBERS = 'vp_group_members';
const LS_UNREAD  = 'vp_chat_unread';
const LS_DRAFTS  = 'vp_chat_drafts';

function getLS(k, def) { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(def)); } catch { return def; } }
function setLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

// Compress image
async function compressImage(dataUrl, maxW = 1000, q = 0.75) {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const bmp  = await createImageBitmap(blob);
    let { width: w, height: h } = bmp;
    if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return c.toDataURL('image/jpeg', q);
  } catch { return dataUrl; }
}

export default function TeamChat({ user }) {
  const [tab,          setTab]          = useState('groups');
  const [activeRoom,   setActiveRoom]   = useState('general');
  const [activeDM,     setActiveDM]     = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState('');
  const [staff,        setStaff]        = useState([]);
  const [search,       setSearch]       = useState('');
  const [msgSearch,    setMsgSearch]    = useState('');
  const [searchResults,setSearchResults]= useState([]);
  const [replyTo,      setReplyTo]      = useState(null);
  const [editingMsg,   setEditingMsg]   = useState(null);
  const [showEmoji,    setShowEmoji]    = useState(false);
  const [showAttach,   setShowAttach]   = useState(false);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [showSettings, setShowSettings] = useState(null);
  const [showStarred,  setShowStarred]  = useState(false);
  const [showSearch,   setShowSearch]   = useState(false);
  const [groupMembers, setGroupMembers] = useState(() => getLS(LS_MEMBERS, {}));
  const [unread,       setUnread]       = useState(() => getLS(LS_UNREAD, {}));
  const [recording,    setRecording]    = useState(false);
  const [recordTime,   setRecordTime]   = useState(0);
  const [playingAudio, setPlayingAudio] = useState(null);
  const [forwardMsg,   setForwardMsg]   = useState(null);
  const [showActions,  setShowActions]  = useState(null);
  const [imageView,    setImageView]    = useState(null);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const pollRef    = useRef(null);
  const sendingRef = useRef(false);
  const lastIdRef  = useRef(null);
  const recorderRef= useRef(null);
  const recordTimerRef = useRef(null);
  const audioRef   = useRef(null);

  const myName     = user?.name || user?.email || 'Me';
  const currentRoom = tab === 'groups' ? `group_${activeRoom}`
    : activeDM ? `dm_${[myName, activeDM.name].sort().join('_')}` : null;

  // ─── Load staff ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(api('/api/staff')).then(r => r.ok ? r.json() : []).then(setStaff).catch(() => {});
  }, []);

  // ─── Load messages (polling) ────────────────────────────────────────────────
  const loadMessages = useCallback(async (initial = false) => {
    if (!currentRoom) return;
    try {
      let url = api(`/api/messages/${currentRoom}`);
      if (!initial && lastIdRef.current) url += `?after=${lastIdRef.current}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (initial) {
        setMessages(data);
        if (data.length) lastIdRef.current = data[data.length - 1]._id;
        // Mark as read
        fetch(api(`/api/messages/${currentRoom}/read/${encodeURIComponent(myName)}`), { method:'PATCH' }).catch(()=>{});
      } else if (data.length) {
        setMessages(prev => {
          const existing = new Set(prev.map(m => m._id));
          const newMsgs  = data.filter(m => !existing.has(m._id));
          if (!newMsgs.length) return prev;
          lastIdRef.current = newMsgs[newMsgs.length - 1]._id;
          // Sound + unread
          const fromOthers = newMsgs.filter(m => m.sender !== myName);
          if (fromOthers.length > 0) {
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const osc = ctx.createOscillator();
              const g   = ctx.createGain();
              osc.connect(g); g.connect(ctx.destination);
              osc.frequency.value = 880;
              g.gain.setValueAtTime(0.15, ctx.currentTime);
              g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
              osc.start(); osc.stop(ctx.currentTime + 0.3);
            } catch {}
            setUnread(prev => { const u = { ...prev, [currentRoom]: (prev[currentRoom]||0) + fromOthers.length }; setLS(LS_UNREAD, u); return u; });
            // Auto mark read since user is on this chat
            fetch(api(`/api/messages/${currentRoom}/read/${encodeURIComponent(myName)}`), { method:'PATCH' }).catch(()=>{});
          }
          return [...prev, ...newMsgs];
        });
      }
    } catch {}
  }, [currentRoom, myName]);

  useEffect(() => {
    if (!currentRoom) return;
    setMessages([]); lastIdRef.current = null;
    loadMessages(true);
    setUnread(prev => { const u = { ...prev, [currentRoom]: 0 }; setLS(LS_UNREAD, u); return u; });
    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => loadMessages(false), 3000);
    return () => clearInterval(pollRef.current);
  }, [currentRoom]);

  useEffect(() => { setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 100); }, [messages]);

  // ─── Send message ──────────────────────────────────────────────────────────
  const sendMsg = async (extra = {}) => {
    if (sendingRef.current) return;
    const text = input.trim();
    if (!text && !extra.fileData && !extra.location) return;
    if (!currentRoom) return;
    sendingRef.current = true;

    // Edit existing
    if (editingMsg) {
      try {
        const res = await fetch(api(`/api/messages/${currentRoom}/${editingMsg._id}/edit`), {
          method: 'PATCH',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ text, sender: myName }),
        });
        if (res.ok) {
          const updated = await res.json();
          setMessages(prev => prev.map(m => m._id === updated._id ? updated : m));
        }
      } catch {}
      setEditingMsg(null); setInput('');
      sendingRef.current = false;
      return;
    }

    const data = {
      sender: myName, senderRole: user?.role || 'staff',
      text, room: currentRoom,
      fileType: extra.fileType || 'text',
      fileData: extra.fileData,
      fileName: extra.fileName,
      fileSize: extra.fileSize,
      duration: extra.duration,
      location: extra.location,
      replyTo: replyTo ? { id: replyTo._id, sender: replyTo.sender, text: replyTo.text?.slice(0, 60), fileType: replyTo.fileType } : null,
    };
    const tempId = `tmp_${Date.now()}`;
    const optimistic = { ...data, _id: tempId, createdAt: new Date().toISOString(), optimistic: true };
    setMessages(prev => [...prev, optimistic]);
    setInput(''); setReplyTo(null); inputRef.current?.focus();

    try {
      const res = await fetch(api(`/api/messages/${currentRoom}`), {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const saved = await res.json();
        setMessages(prev => prev.map(m => m._id === tempId ? saved : m));
        if (saved._id) lastIdRef.current = saved._id;
      } else {
        setMessages(prev => prev.filter(m => m._id !== tempId));
        showInAppToast('❌ Send failed', '', 'error');
      }
    } catch {
      setMessages(prev => prev.filter(m => m._id !== tempId));
    } finally {
      setTimeout(() => { sendingRef.current = false; }, 500);
    }
  };

  // ─── Photo: Camera ─────────────────────────────────────────────────────────
  const sendPhotoCamera = async () => {
    setShowAttach(false);
    try {
      const raw = await captureFromCamera('environment');
      const comp = await compressImage(raw);
      await sendMsg({ fileType:'image', fileData: comp, fileName:'photo.jpg' });
    } catch (e) { showInAppToast('❌ Camera', String(e), 'error'); }
  };

  // ─── Photo: Gallery ────────────────────────────────────────────────────────
  const sendPhotoGallery = () => {
    setShowAttach(false);
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      const r = new FileReader();
      r.onload = async () => {
        const comp = await compressImage(r.result);
        await sendMsg({ fileType:'image', fileData: comp, fileName: f.name });
      };
      r.readAsDataURL(f);
    };
    inp.click();
  };

  // ─── Video ─────────────────────────────────────────────────────────────────
  const sendVideo = () => {
    setShowAttach(false);
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'video/*';
    inp.onchange = (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      if (f.size > 20*1024*1024) { showInAppToast('❌', 'Video 20MB से छोटा होना चाहिए', 'error'); return; }
      const r = new FileReader();
      r.onload = () => sendMsg({ fileType:'video', fileData: r.result, fileName: f.name, fileSize: f.size });
      r.readAsDataURL(f);
    };
    inp.click();
  };

  // ─── Document ──────────────────────────────────────────────────────────────
  const sendDocument = () => {
    setShowAttach(false);
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.pdf,.doc,.docx,.xls,.xlsx,.txt';
    inp.onchange = (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      if (f.size > 10*1024*1024) { showInAppToast('❌', 'File 10MB से छोटी', 'error'); return; }
      const r = new FileReader();
      r.onload = () => sendMsg({ fileType:'document', fileData: r.result, fileName: f.name, fileSize: f.size });
      r.readAsDataURL(f);
    };
    inp.click();
  };

  // ─── Location ──────────────────────────────────────────────────────────────
  const sendLocation = () => {
    setShowAttach(false);
    if (!navigator.geolocation) { showInAppToast('❌', 'GPS not available', 'error'); return; }
    showInAppToast('📍', 'Location ले रहे हैं...', 'info');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        await sendMsg({ fileType:'location', location: { lat, lng, address } });
      },
      (e) => showInAppToast('❌ Location', e.message, 'error'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ─── Voice recording ───────────────────────────────────────────────────────
  const startRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const mr = new MediaRecorder(stream);
      recorderRef.current = mr;
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunks, { type:'audio/webm' });
        const r = new FileReader();
        r.onload = () => sendMsg({ fileType:'audio', fileData: r.result, fileName:'voice.webm', duration: recordTime });
        r.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setRecording(true);
      setRecordTime(0);
      recordTimerRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    } catch (e) {
      showInAppToast('❌ Mic', 'Microphone permission denied', 'error');
    }
  };

  const stopRecord = () => {
    if (recorderRef.current) { recorderRef.current.stop(); recorderRef.current = null; }
    clearInterval(recordTimerRef.current);
    setRecording(false);
  };

  const cancelRecord = () => {
    if (recorderRef.current) {
      const stream = recorderRef.current.stream;
      recorderRef.current.ondataavailable = null;
      recorderRef.current.stop();
      stream.getTracks().forEach(t => t.stop());
      recorderRef.current = null;
    }
    clearInterval(recordTimerRef.current);
    setRecording(false);
    setRecordTime(0);
  };

  // ─── Play audio ────────────────────────────────────────────────────────────
  const playAudio = (msg) => {
    if (playingAudio === msg._id) { audioRef.current?.pause(); setPlayingAudio(null); return; }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(msg.fileData);
    audioRef.current = audio;
    audio.onended = () => setPlayingAudio(null);
    audio.play();
    setPlayingAudio(msg._id);
  };

  // ─── Delete message ────────────────────────────────────────────────────────
  const deleteMsg = async (msg) => {
    if (msg.sender !== myName || !window.confirm('Delete?')) return;
    setMessages(prev => prev.filter(m => m._id !== msg._id));
    try { await fetch(api(`/api/messages/${currentRoom}/${msg._id}`), { method:'DELETE' }); } catch {}
    setShowActions(null);
  };

  // ─── Edit message ──────────────────────────────────────────────────────────
  const startEdit = (msg) => {
    setEditingMsg(msg);
    setInput(msg.text);
    setShowActions(null);
    inputRef.current?.focus();
  };

  // ─── Star message ──────────────────────────────────────────────────────────
  const toggleStar = async (msg) => {
    const isStarred = msg.starredBy?.includes(myName);
    setMessages(prev => prev.map(m => m._id === msg._id ? {...m, starredBy: isStarred ? m.starredBy.filter(n=>n!==myName) : [...(m.starredBy||[]), myName]} : m));
    try { await fetch(api(`/api/messages/${currentRoom}/${msg._id}/star`), { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ user: myName, star: !isStarred }) }); } catch {}
    setShowActions(null);
  };

  // ─── Forward message ───────────────────────────────────────────────────────
  const forwardToRoom = async (targetRoom) => {
    if (!forwardMsg) return;
    try {
      await fetch(api(`/api/messages/${targetRoom}`), {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          sender: myName, senderRole: user?.role || 'staff',
          text: forwardMsg.text,
          fileType: forwardMsg.fileType, fileData: forwardMsg.fileData, fileName: forwardMsg.fileName,
          fileSize: forwardMsg.fileSize, duration: forwardMsg.duration,
          location: forwardMsg.location,
          forwarded: true,
        }),
      });
      showInAppToast('✅ Forwarded', '', 'success');
    } catch {}
    setForwardMsg(null);
  };

  // ─── WhatsApp forward (external) ───────────────────────────────────────────
  const waForward = (msg) => {
    const ph = prompt('WhatsApp number:');
    if (!ph) return;
    let text = `*VP Honda — ${msg.sender}*\n`;
    if (msg.text) text += msg.text;
    else if (msg.fileType === 'image') text += '📷 Photo';
    else if (msg.fileType === 'video') text += '🎥 Video';
    else if (msg.fileType === 'audio') text += '🎤 Voice note';
    else if (msg.fileType === 'document') text += `📄 ${msg.fileName}`;
    else if (msg.fileType === 'location') text += `📍 https://maps.google.com/?q=${msg.location.lat},${msg.location.lng}`;
    sendWhatsApp(ph, text);
    setShowActions(null);
  };

  // ─── Download media ────────────────────────────────────────────────────────
  const downloadMedia = (msg) => {
    if (!msg.fileData) return;
    const a = document.createElement('a');
    a.href = msg.fileData;
    a.download = msg.fileName || `vp_${msg.fileType}_${msg._id}`;
    a.click();
    setShowActions(null);
  };

  // ─── Search messages ───────────────────────────────────────────────────────
  const searchMessages = async (q) => {
    setMsgSearch(q);
    if (!q || q.length < 2) { setSearchResults([]); return; }
    try {
      const res = await fetch(api(`/api/messages/search/${encodeURIComponent(myName)}?q=${encodeURIComponent(q)}`));
      if (res.ok) setSearchResults(await res.json());
    } catch {}
  };

  // ─── Show starred ──────────────────────────────────────────────────────────
  const loadStarred = async () => {
    try {
      const res = await fetch(api(`/api/messages/starred/${encodeURIComponent(myName)}`));
      if (res.ok) setMessages(await res.json());
    } catch {}
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } };

  // ─── Group members ─────────────────────────────────────────────────────────
  const toggleMember = (gid, name) => {
    const u = { ...groupMembers };
    if (!u[gid]) u[gid] = [];
    u[gid] = u[gid].includes(name) ? u[gid].filter(n=>n!==name) : [...u[gid], name];
    setGroupMembers(u); setLS(LS_MEMBERS, u);
  };

  // ─── Computed ──────────────────────────────────────────────────────────────
  const filteredStaff = staff.filter(s => s.name !== myName && (!search || s.name.toLowerCase().includes(search.toLowerCase())));
  const activeGroup = DEFAULT_GROUPS.find(g => g.id === activeRoom);
  const roomLabel = tab === 'groups' ? activeGroup?.name : `💬 ${activeDM?.name || ''}`;

  // ── GROUP SETTINGS MODAL ────────────────────────────────────────────────────
  const GroupSettingsModal = () => {
    const g = DEFAULT_GROUPS.find(x => x.id === showSettings);
    if (!g) return null;
    const members = groupMembers[g.id] || [];
    return (
      <div onClick={() => setShowSettings(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div onClick={e => e.stopPropagation()} style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:14, width:'90%', maxWidth:400, padding:20, maxHeight:'80vh', overflowY:'auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
            <h3 style={{ fontSize:15, fontWeight:800, margin:0 }}>⚙️ {g.name} — Members</h3>
            <button onClick={() => setShowSettings(null)} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer' }}><X size={18}/></button>
          </div>
          <p style={{ color:'#64748b', fontSize:12, marginBottom:12 }}>
            {members.length === 0 ? '✅ सब staff members इस group में हैं' : `${members.length} selected members`}
          </p>
          {/* Select all / clear */}
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <button onClick={() => { const updated = {...groupMembers, [g.id]: staff.map(s=>s.name)}; setGroupMembers(updated); saveGroupMembers(updated); }}
              style={{ flex:1, background:'#1e293b', color:'#94a3b8', border:'1px solid #334155', padding:'6px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>
              सब Select
            </button>
            <button onClick={() => { const updated = {...groupMembers, [g.id]: []}; setGroupMembers(updated); saveGroupMembers(updated); }}
              style={{ flex:1, background:'#1e293b', color:'#94a3b8', border:'1px solid #334155', padding:'6px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>
              सब Remove
            </button>
          </div>
          {staff.map(s => {
            const selected = members.length === 0 || members.includes(s.name);
            return (
              <div key={s._id || s.name} onClick={() => toggleMember(g.id, s.name)}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:8, marginBottom:4, cursor:'pointer', background: selected ? '#16a34a22' : '#1e293b', border: `1px solid ${selected ? '#16a34a55' : '#334155'}` }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background: selected ? '#16a34a' : '#475569', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13 }}>
                  {selected ? <Check size={16}/> : s.name?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontWeight:700, fontSize:12, margin:0 }}>{s.name}</p>
                  <p style={{ color:'#64748b', fontSize:10, margin:'2px 0 0' }}>{s.position || 'Staff'}</p>
                </div>
                <div style={{ color: selected ? '#86efac' : '#64748b', fontSize:11 }}>
                  {selected ? '✅ In Group' : '➕ Add'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', height:'calc(100dvh - 48px)', background:'#020617', color:'#fff', overflow:'hidden' }}>

      {showSettings && <GroupSettingsModal/>}

      {/* Mobile hamburger */}
      {!sidebarOpen && (
        <button onClick={() => setSidebarOpen(true)} className="lg:hidden"
          style={{ position:'fixed', bottom:72, left:12, zIndex:50, background:'#DC0000', border:'none', borderRadius:'50%', width:44, height:44, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 4px 20px rgba(220,0,0,0.4)' }}>
          <Menu size={20} color="white"/>
        </button>
      )}

      {/* Overlay */}
      {sidebarOpen && <div className="lg:hidden" onClick={() => setSidebarOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:30 }}/>}

      {/* ── SIDEBAR ──────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', inset: 0, right:'auto', zIndex:40, width:260,
        background:'#0a0f1e', borderRight:'1px solid #1e293b',
        display:'flex', flexDirection:'column', height:'100%',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.2s',
      }} className="lg:!translate-x-0 lg:!relative lg:!w-60">

        {/* Header */}
        <div style={{ padding:'12px 12px 8px', borderBottom:'1px solid #1e293b' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2 style={{ fontSize:15, fontWeight:800, margin:0, display:'flex', alignItems:'center', gap:6 }}>
              💬 Team Chat
            </h2>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              {/* Notification toggle */}
              <button onClick={notifEnabled ? null : enableNotifications} title={notifEnabled ? 'Notifications ON' : 'Enable Notifications'}
                style={{ background: notifEnabled ? '#16a34a' : '#334155', border:'none', borderRadius:6, padding:'5px 8px', cursor:'pointer', color:'#fff', display:'flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700 }}>
                {notifEnabled ? <><Bell size={12}/> ON</> : <><BellOff size={12}/> OFF</>}
              </button>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden" style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer' }}><X size={16}/></button>
            </div>
          </div>
          {/* Search */}
          <div style={{ position:'relative', marginTop:8 }}>
            <Search size={11} style={{ position:'absolute', left:9, top:9, color:'#64748b' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              style={{ width:'100%', background:'#1e293b', border:'1px solid #334155', borderRadius:6, padding:'7px 7px 7px 26px', color:'#fff', fontSize:11, outline:'none' }}/>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid #1e293b' }}>
          {[['groups','👥 Groups'],['direct','💬 Direct']].map(([id,label]) => (
            <button key={id} onClick={() => { setTab(id); setSidebarOpen(false); }}
              style={{ flex:1, background:tab===id?'#DC000022':'transparent', color:tab===id?'#DC0000':'#94a3b8', border:'none', padding:'8px 4px', fontSize:11, fontWeight:700, cursor:'pointer', borderBottom:tab===id?'2px solid #DC0000':'2px solid transparent' }}>
              {label}
            </button>
          ))}
        </div>

        {/* List */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {tab === 'groups' && DEFAULT_GROUPS.filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase())).map(g => {
            const active = tab==='groups' && activeRoom===g.id;
            const memberCount = groupMembers[g.id]?.length || 0;
            return (
              <div key={g.id} style={{ padding:'10px 12px', cursor:'pointer', background:active?'#DC000015':'transparent', borderLeft:active?`3px solid ${g.color}`:'3px solid transparent', display:'flex', alignItems:'center', gap:8 }}
                onClick={() => { setActiveRoom(g.id); setSidebarOpen(false); }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontWeight:700, fontSize:12, margin:0 }}>{g.name}</p>
                  <p style={{ color:'#64748b', fontSize:10, margin:'2px 0 0' }}>
                    {memberCount > 0 ? `${memberCount} members` : 'All staff'} · {g.desc}
                  </p>
                </div>
                {/* Settings button */}
                <button onClick={e => { e.stopPropagation(); setShowSettings(g.id); }}
                  style={{ background:'none', border:'none', color:'#475569', cursor:'pointer', padding:4 }} title="Group settings">
                  <Settings size={14}/>
                </button>
              </div>
            );
          })}

          {tab === 'direct' && <>
            <p style={{ color:'#64748b', fontSize:9, fontWeight:700, textTransform:'uppercase', padding:'8px 12px 4px' }}>Staff</p>
            {filteredStaff.length === 0 && <p style={{ color:'#64748b', fontSize:11, padding:'10px 12px' }}>Staff Management में staff add करें</p>}
            {filteredStaff.map(s => {
              const active = activeDM?.name === s.name;
              return (
                <div key={s._id || s.name} onClick={() => { setActiveDM(s); setTab('direct'); setSidebarOpen(false); }}
                  style={{ padding:'8px 12px', cursor:'pointer', background:active?'#DC000015':'transparent', borderLeft:active?'3px solid #DC0000':'3px solid transparent', display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ position:'relative' }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:'#1e40af', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13 }}>
                      {s.name?.[0]?.toUpperCase()}
                    </div>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:'#16a34a', position:'absolute', bottom:0, right:0, border:'1px solid #020617' }}/>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontWeight:700, fontSize:11, margin:0, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{s.name}</p>
                    <p style={{ color:'#64748b', fontSize:9, margin:0 }}>{s.position || 'Staff'}</p>
                  </div>
                </div>
              );
            })}
          </>}
        </div>

        {/* My status */}
        <div style={{ padding:'8px 12px', borderTop:'1px solid #1e293b', display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:'50%', background:'#DC0000', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:12, flexShrink:0 }}>
            {myName?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontWeight:700, fontSize:11, margin:0, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{myName}</p>
            <p style={{ color:'#16a34a', fontSize:9, margin:0 }}>● Online</p>
          </div>
        </div>
      </div>

      {/* ── CHAT AREA ─────────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'10px 14px', borderBottom:'1px solid #1e293b', background:'#0a0f1e', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <div style={{ flex:1 }}>
            <h3 style={{ fontSize:14, fontWeight:800, margin:0 }}>{roomLabel}</h3>
            <p style={{ color:'#94a3b8', fontSize:10, margin:'2px 0 0' }}>
              {tab==='groups' && activeGroup
                ? (groupMembers[activeRoom]?.length > 0
                  ? `${groupMembers[activeRoom].length} members`
                  : 'All staff')
                : activeDM?.position || 'Staff'
              } · Real-time sync
            </p>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {tab==='groups' && (
              <button onClick={() => setShowSettings(activeRoom)} title="Group settings"
                style={{ background:'#1e293b', border:'1px solid #334155', color:'#94a3b8', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                <Settings size={13}/> Members
              </button>
            )}
            {tab==='direct' && activeDM?.phone && (
              <a href={`tel:${activeDM.phone}`} style={{ background:'#16a34a', border:'none', color:'#fff', borderRadius:6, padding:'5px 10px', textDecoration:'none', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                <Phone size={12}/> Call
              </a>
            )}
            <button onClick={() => window.open(`/meeting?room=vphonda-chat-${currentRoom}`, '_blank')}
              style={{ background:'#7c3aed', border:'none', color:'#fff', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
              <Video size={12}/> Meet
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:4 }}>
          {!currentRoom && (
            <div style={{ textAlign:'center', color:'#475569', marginTop:80 }}>
              <p style={{ fontSize:32 }}>💬</p>
              <p style={{ fontSize:13 }}>Sidebar से room या person select करें</p>
            </div>
          )}
          {currentRoom && messages.length === 0 && (
            <div style={{ textAlign:'center', color:'#475569', marginTop:80 }}>
              <p style={{ fontSize:28 }}>👋</p>
              <p style={{ fontSize:13, fontWeight:700 }}>पहला message भेजें!</p>
            </div>
          )}
          {messages.map((msg, idx) => {
            const isMe     = msg.sender === myName;
            const prevSame = idx > 0 && messages[idx-1].sender === msg.sender;
            return (
              <div key={msg._id || idx} style={{ display:'flex', flexDirection:isMe?'row-reverse':'row', alignItems:'flex-end', gap:6 }}>
                {!isMe && !prevSame && (
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'#1e40af', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, flexShrink:0 }}>
                    {msg.sender?.[0]?.toUpperCase()}
                  </div>
                )}
                {!isMe && prevSame && <div style={{ width:28, flexShrink:0 }}/>}
                <div style={{ maxWidth:'72%', minWidth:60 }}>
                  {!isMe && !prevSame && <p style={{ fontSize:9, color:'#94a3b8', margin:'0 0 2px 2px', fontWeight:700 }}>{msg.sender}</p>}
                  {msg.replyTo && (
                    <div style={{ background:'rgba(255,255,255,0.05)', borderLeft:'3px solid #DC0000', borderRadius:'6px 6px 0 0', padding:'3px 8px', fontSize:10, color:'#94a3b8' }}>
                      <span style={{ color:'#fbbf24', fontWeight:700 }}>{msg.replyTo.sender}:</span> {msg.replyTo.text}
                    </div>
                  )}
                  <div
                    style={{
                      background: isMe ? 'linear-gradient(135deg,#DC0000,#B91C1C)' : '#1e293b',
                      borderRadius: msg.replyTo ? (isMe?'0 0 4px 14px':'0 0 14px 4px') : (isMe?'14px 4px 14px 14px':'4px 14px 14px 14px'),
                      padding: msg.photo ? '3px' : '8px 12px',
                      opacity: msg.optimistic ? 0.7 : 1,
                    }}
                    onDoubleClick={() => setReplyTo(msg)}
                  >
                    {msg.photo && <img src={msg.photo} alt="" style={{ width:'100%', maxWidth:220, borderRadius:8, display:'block', cursor:'zoom-in' }} onClick={() => window.open(msg.photo,'_blank')}/>}
                    {msg.text && <p style={{ fontSize:13, margin:msg.photo?'5px 8px 3px':0, lineHeight:1.5, wordBreak:'break-word' }}>{msg.text}</p>}
                    <p style={{ fontSize:9, color:isMe?'rgba(255,255,255,0.5)':'#64748b', margin:msg.photo?'0 8px 3px':'3px 0 0', textAlign:isMe?'right':'left' }}>
                      {new Date(msg.createdAt||Date.now()).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
                      {msg.optimistic && ' ⏳'}
                    </p>
                  </div>
                  <div style={{ display:'flex', gap:3, marginTop:2, justifyContent:isMe?'flex-end':'flex-start' }}>
                    <button onClick={() => setReplyTo(msg)} style={{ background:'transparent', border:'none', color:'#475569', fontSize:9, cursor:'pointer', padding:'1px 4px' }}>↩ Reply</button>
                    <button onClick={() => forwardWA(msg)} style={{ background:'transparent', border:'none', color:'#475569', fontSize:9, cursor:'pointer', padding:'1px 4px' }}>📱 WA</button>
                    {isMe && <button onClick={() => deleteMsg(msg)} style={{ background:'transparent', border:'none', color:'#475569', fontSize:9, cursor:'pointer', padding:'1px 4px' }}>🗑</button>}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef}/>
        </div>

        {/* Reply preview */}
        {replyTo && (
          <div style={{ padding:'7px 14px', background:'#0f172a', borderTop:'1px solid #1e293b', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            <div style={{ flex:1, borderLeft:'3px solid #DC0000', paddingLeft:8 }}>
              <p style={{ color:'#fbbf24', fontSize:10, fontWeight:700, margin:0 }}>↩ {replyTo.sender} को reply</p>
              <p style={{ color:'#94a3b8', fontSize:10, margin:'1px 0 0' }}>{replyTo.text?.slice(0,80)}</p>
            </div>
            <button onClick={() => setReplyTo(null)} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer' }}><X size={14}/></button>
          </div>
        )}

        {/* Input */}
        <div style={{ padding:'10px 14px', borderTop:'1px solid #1e293b', background:'#0a0f1e', display:'flex', gap:6, alignItems:'flex-end', flexShrink:0 }}>
          <div style={{ position:'relative' }}>
            <button onClick={() => setShowEmoji(e => !e)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', padding:4, lineHeight:1 }}>😊</button>
            {showEmoji && (
              <div style={{ position:'absolute', bottom:'100%', left:0, background:'#1e293b', border:'1px solid #334155', borderRadius:8, padding:6, display:'flex', flexWrap:'wrap', gap:4, width:200, zIndex:30, marginBottom:4 }}>
                {EMOJIS.map(e => <button key={e} onClick={() => { setInput(i => i+e); setShowEmoji(false); inputRef.current?.focus(); }} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', padding:2 }}>{e}</button>)}
              </div>
            )}
          </div>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
            placeholder="Message... (Enter भेजें)" rows={1} disabled={!currentRoom}
            style={{ flex:1, background:'#1e293b', border:'1px solid #334155', borderRadius:10, padding:'9px 12px', color:'#fff', fontSize:12, outline:'none', resize:'none', maxHeight:100, overflowY:'auto', lineHeight:1.5 }}/>
          <button onClick={sendPhoto} title="Camera" style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, padding:'8px', cursor:'pointer', color:'#94a3b8' }}>📷</button>
          <button onClick={pickPhoto} title="Gallery" style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, padding:'8px', cursor:'pointer', color:'#94a3b8' }}>
            <Image size={16}/>
          </button>
          <button onClick={() => sendMsg()} disabled={!input.trim()||!currentRoom}
            style={{ background:input.trim()?'linear-gradient(135deg,#DC0000,#B91C1C)':'#1e293b', border:'none', borderRadius:8, padding:'8px 14px', cursor:input.trim()?'pointer':'not-allowed', color:'#fff' }}>
            <Send size={16}/>
          </button>
        </div>
      </div>
    </div>
  );
}
