// TeamChat.jsx — VP Honda v3.5 [BUILD 2026] - WhatsApp Features ALL
// Video, Voice, Document, Location, Reply, Forward, Edit, Star, Search, Read-receipts
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

  // ✅ Admin special handling — Admin logged in तो name = "Admin"
  const isAdmin    = user?.role === 'admin' || user?.email === 'admin@vphonda.com';
  const myName     = isAdmin ? 'Admin' : (user?.name || user?.email || 'Me');
  const currentRoom = tab === 'groups' ? `group_${activeRoom}`
    : activeDM ? `dm_${[myName, activeDM.name].sort().join('_')}` : null;

  useEffect(() => {
    fetch(api('/api/staff')).then(r => r.ok ? r.json() : []).then(data => {
      // ✅ Always prepend Admin to staff list (so anyone can DM Admin)
      const hasAdmin = data.some(s => (s.name || '').toLowerCase() === 'admin');
      const list = hasAdmin ? data : [
        { _id: 'admin_system', name: 'Admin', position: '👑 Administrator', phone: '9713394738' },
        ...data
      ];
      setStaff(list);
    }).catch(() => {});
  }, []);

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

        fetch(api(`/api/messages/${currentRoom}/read/${encodeURIComponent(myName)}`), { method:'PATCH' }).catch(()=>{});
      } else if (data.length) {
        setMessages(prev => {
          const existing = new Set(prev.map(m => m._id));
          const newMsgs  = data.filter(m => !existing.has(m._id));
          if (!newMsgs.length) return prev;
          lastIdRef.current = newMsgs[newMsgs.length - 1]._id;

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

  const sendMsg = async (extra = {}) => {
    if (sendingRef.current) return;
    const text = input.trim();
    if (!text && !extra.fileData && !extra.location) return;
    if (!currentRoom) return;
    sendingRef.current = true;

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

  const sendPhotoCamera = async () => {
    setShowAttach(false);
    try {
      const raw = await captureFromCamera('environment');
      const comp = await compressImage(raw);
      await sendMsg({ fileType:'image', fileData: comp, fileName:'photo.jpg' });
    } catch (e) { showInAppToast('❌ Camera', String(e), 'error'); }
  };

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

  const playAudio = (msg) => {
    if (playingAudio === msg._id) { audioRef.current?.pause(); setPlayingAudio(null); return; }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(msg.fileData);
    audioRef.current = audio;
    audio.onended = () => setPlayingAudio(null);
    audio.play();
    setPlayingAudio(msg._id);
  };

  const deleteMsg = async (msg) => {
    if (msg.sender !== myName || !window.confirm('Delete?')) return;
    setMessages(prev => prev.filter(m => m._id !== msg._id));
    try { await fetch(api(`/api/messages/${currentRoom}/${msg._id}`), { method:'DELETE' }); } catch {}
    setShowActions(null);
  };

  const startEdit = (msg) => {
    setEditingMsg(msg);
    setInput(msg.text);
    setShowActions(null);
    inputRef.current?.focus();
  };

  const toggleStar = async (msg) => {
    const isStarred = msg.starredBy?.includes(myName);
    setMessages(prev => prev.map(m => m._id === msg._id ? {...m, starredBy: isStarred ? m.starredBy.filter(n=>n!==myName) : [...(m.starredBy||[]), myName]} : m));
    try { await fetch(api(`/api/messages/${currentRoom}/${msg._id}/star`), { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ user: myName, star: !isStarred }) }); } catch {}
    setShowActions(null);
  };

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

  const downloadMedia = (msg) => {
    if (!msg.fileData) return;
    const a = document.createElement('a');
    a.href = msg.fileData;
    a.download = msg.fileName || `vp_${msg.fileType}_${msg._id}`;
    a.click();
    setShowActions(null);
  };

  const searchMessages = async (q) => {
    setMsgSearch(q);
    if (!q || q.length < 2) { setSearchResults([]); return; }
    try {
      const res = await fetch(api(`/api/messages/search/${encodeURIComponent(myName)}?q=${encodeURIComponent(q)}`));
      if (res.ok) setSearchResults(await res.json());
    } catch {}
  };

  const loadStarred = async () => {
    try {
      const res = await fetch(api(`/api/messages/starred/${encodeURIComponent(myName)}`));
      if (res.ok) setMessages(await res.json());
    } catch {}
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } };

  const toggleMember = (gid, name) => {
    const u = { ...groupMembers };
    if (!u[gid]) u[gid] = [];
    u[gid] = u[gid].includes(name) ? u[gid].filter(n=>n!==name) : [...u[gid], name];
    setGroupMembers(u); setLS(LS_MEMBERS, u);
  };

  const filteredStaff = staff.filter(s => s.name !== myName && (!search || s.name.toLowerCase().includes(search.toLowerCase())));
  const activeGroup = DEFAULT_GROUPS.find(g => g.id === activeRoom);
  const roomLabel = tab === 'groups' ? activeGroup?.name : `💬 ${activeDM?.name || ''}`;

  const GroupSettingsModal = () => {
    const g = DEFAULT_GROUPS.find(x => x.id === showSettings);
    if (!g) return null;
    const members = groupMembers[g.id] || [];
    return (
      <div onClick={() => setShowSettings(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:14 }}>
        <div onClick={e => e.stopPropagation()} style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:14, width:'100%', maxWidth:400, padding:20, maxHeight:'80vh', overflowY:'auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
            <h3 style={{ fontSize:15, fontWeight:800, margin:0, color:'#fff' }}>⚙️ {g.name} Members</h3>
            <button onClick={() => setShowSettings(null)} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer' }}><X size={18}/></button>
          </div>
          <p style={{ color:'#64748b', fontSize:11, marginBottom:10 }}>
            {members.length === 0 ? '✅ सब staff' : `${members.length} selected`}
          </p>
          <div style={{ display:'flex', gap:6, marginBottom:10 }}>
            <button onClick={() => { const u = {...groupMembers, [g.id]: staff.map(s=>s.name)}; setGroupMembers(u); setLS(LS_MEMBERS, u); }} style={{ flex:1, background:'#1e293b', color:'#94a3b8', border:'1px solid #334155', padding:'6px', borderRadius:6, fontSize:10, fontWeight:700 }}>सब Select</button>
            <button onClick={() => { const u = {...groupMembers, [g.id]: []}; setGroupMembers(u); setLS(LS_MEMBERS, u); }} style={{ flex:1, background:'#1e293b', color:'#94a3b8', border:'1px solid #334155', padding:'6px', borderRadius:6, fontSize:10, fontWeight:700 }}>Clear</button>
          </div>
          {staff.map(s => {
            const sel = members.length === 0 || members.includes(s.name);
            return (
              <div key={s._id||s.name} onClick={() => toggleMember(g.id, s.name)} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:8, marginBottom:4, cursor:'pointer', background: sel ? '#16a34a22' : '#1e293b', border: `1px solid ${sel?'#16a34a55':'#334155'}` }}>
                <div style={{ width:30, height:30, borderRadius:'50%', background: sel?'#16a34a':'#475569', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:12, color:'#fff' }}>{sel ? <Check size={14}/> : s.name?.[0]?.toUpperCase()}</div>
                <div style={{ flex:1 }}>
                  <p style={{ fontWeight:700, fontSize:12, margin:0, color:'#fff' }}>{s.name}</p>
                  <p style={{ color:'#64748b', fontSize:9, margin:'2px 0 0' }}>{s.position || 'Staff'}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const ForwardModal = () => {
    if (!forwardMsg) return null;
    return (
      <div onClick={() => setForwardMsg(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:14 }}>
        <div onClick={e => e.stopPropagation()} style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:14, width:'100%', maxWidth:400, padding:18 }}>
          <h3 style={{ fontSize:14, fontWeight:800, margin:'0 0 12px', color:'#fff' }}>📤 Forward to:</h3>
          {DEFAULT_GROUPS.map(g => (
            <div key={g.id} onClick={() => forwardToRoom(`group_${g.id}`)} style={{ padding:'10px 12px', cursor:'pointer', borderBottom:'1px solid #1e293b', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ color:'#fff', fontWeight:700, fontSize:12 }}>{g.name}</span>
              <Send size={14} color="#94a3b8"/>
            </div>
          ))}
          <p style={{ color:'#64748b', fontSize:10, marginTop:10 }}>Or staff:</p>
          {staff.filter(s => s.name !== myName).slice(0, 5).map(s => (
            <div key={s._id} onClick={() => forwardToRoom(`dm_${[myName, s.name].sort().join('_')}`)} style={{ padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid #1e293b', display:'flex', justifyContent:'space-between' }}>
              <span style={{ color:'#fff', fontSize:12 }}>{s.name}</span>
              <Send size={14} color="#94a3b8"/>
            </div>
          ))}
          <button onClick={() => waForward(forwardMsg)} style={{ width:'100%', marginTop:10, background:'#16a34a', color:'#fff', border:'none', padding:10, borderRadius:8, fontWeight:700, fontSize:12 }}>📱 WhatsApp पर भेजें</button>
        </div>
      </div>
    );
  };

  const ActionMenu = ({ msg }) => {
    if (showActions !== msg._id) return null;
    return (
      <div onClick={() => setShowActions(null)} style={{ position:'fixed', inset:0, zIndex:150, background:'rgba(0,0,0,0.5)' }}>
        <div onClick={e => e.stopPropagation()} style={{ position:'absolute', bottom:80, left:'50%', transform:'translateX(-50%)', background:'#0f172a', border:'1px solid #334155', borderRadius:12, padding:6, minWidth:200 }}>
          {[
            { i:'↩️', t:'Reply', a:() => { setReplyTo(msg); setShowActions(null); } },
            { i:'📤', t:'Forward', a:() => { setForwardMsg(msg); setShowActions(null); } },
            ...(msg.sender === myName && msg.fileType === 'text' ? [{ i:'✏️', t:'Edit', a:() => startEdit(msg) }] : []),
            { i: msg.starredBy?.includes(myName) ? '⭐' : '☆', t: msg.starredBy?.includes(myName) ? 'Unstar' : 'Star', a:() => toggleStar(msg) },
            { i:'📱', t:'WhatsApp', a:() => waForward(msg) },
            ...(msg.fileData ? [{ i:'⬇️', t:'Download', a:() => downloadMedia(msg) }] : []),
            ...(msg.sender === myName ? [{ i:'🗑️', t:'Delete', a:() => deleteMsg(msg) }] : []),
          ].map((it, i) => (
            <button key={i} onClick={it.a} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', background:'transparent', border:'none', color:'#fff', padding:'10px 14px', cursor:'pointer', fontSize:12, textAlign:'left' }}>
              <span style={{ fontSize:16 }}>{it.i}</span> <span>{it.t}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const MessageBubble = ({ msg, idx }) => {
    const isMe     = msg.sender === myName;
    const prevSame = idx > 0 && messages[idx-1].sender === msg.sender;
    const readByOthers = (msg.readBy || []).filter(n => n !== myName).length;
    return (
      <div style={{ display:'flex', flexDirection:isMe?'row-reverse':'row', alignItems:'flex-end', gap:6 }}>
        {!isMe && !prevSame && <div style={{ width:28, height:28, borderRadius:'50%', background:'#1e40af', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#fff', flexShrink:0 }}>{msg.sender?.[0]?.toUpperCase()}</div>}
        {!isMe && prevSame && <div style={{ width:28, flexShrink:0 }}/>}
        <div style={{ maxWidth:'72%', minWidth:60 }}>
          {!isMe && !prevSame && <p style={{ fontSize:9, color:'#94a3b8', margin:'0 0 2px 2px', fontWeight:700 }}>{msg.sender}</p>}
          {msg.forwarded && <p style={{ fontSize:9, color:'#94a3b8', margin:'0 0 2px 2px', fontStyle:'italic' }}>↪ Forwarded</p>}
          {msg.replyTo && (
            <div style={{ background:'rgba(255,255,255,0.05)', borderLeft:'3px solid #DC0000', borderRadius:'6px 6px 0 0', padding:'3px 8px', fontSize:10, color:'#94a3b8' }}>
              <span style={{ color:'#fbbf24', fontWeight:700 }}>{msg.replyTo.sender}:</span> {msg.replyTo.text || msg.replyTo.fileType}
            </div>
          )}
          <div onContextMenu={(e) => { e.preventDefault(); setShowActions(msg._id); }}
            onClick={() => { if (msg.fileType === 'image') setImageView(msg.fileData); }}
            style={{
              background: isMe ? 'linear-gradient(135deg,#DC0000,#B91C1C)' : '#1e293b',
              borderRadius: msg.replyTo ? (isMe?'0 0 4px 14px':'0 0 14px 4px') : (isMe?'14px 4px 14px 14px':'4px 14px 14px 14px'),
              padding: ['image','video'].includes(msg.fileType) ? 3 : '8px 12px',
              opacity: msg.optimistic ? 0.7 : 1,
              cursor:'pointer',
            }}>

            {/* IMAGE */}
            {msg.fileType === 'image' && msg.fileData && (
              <img src={msg.fileData} alt="" style={{ width:'100%', maxWidth:240, borderRadius:8, display:'block' }}/>
            )}

            {/* VIDEO */}
            {msg.fileType === 'video' && msg.fileData && (
              <video src={msg.fileData} controls style={{ width:'100%', maxWidth:240, borderRadius:8, display:'block' }}/>
            )}

            {/* AUDIO (Voice note) */}
            {msg.fileType === 'audio' && msg.fileData && (
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 8px', minWidth:150 }}>
                <button onClick={(e) => { e.stopPropagation(); playAudio(msg); }} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                  {playingAudio === msg._id ? <Pause size={16}/> : <Play size={16}/>}
                </button>
                <div style={{ flex:1, color:'#fff' }}>
                  <div style={{ height:3, background:'rgba(255,255,255,0.3)', borderRadius:2, marginBottom:4 }}><div style={{ width: playingAudio === msg._id ? '50%' : '0%', height:'100%', background:'#fff', borderRadius:2, transition:'width 0.3s' }}/></div>
                  <span style={{ fontSize:10 }}>🎤 {msg.duration || '?'}s</span>
                </div>
              </div>
            )}

            {/* DOCUMENT */}
            {msg.fileType === 'document' && (
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:6, minWidth:200 }}>
                <FileText size={28} color="#ea580c"/>
                <div style={{ flex:1, color:'#fff' }}>
                  <p style={{ fontSize:11, fontWeight:700, margin:0, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', maxWidth:180 }}>{msg.fileName}</p>
                  <p style={{ fontSize:9, opacity:0.7, margin:'2px 0 0' }}>{msg.fileSize ? Math.round(msg.fileSize/1024) + ' KB' : ''}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); downloadMedia(msg); }} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:6, padding:6, cursor:'pointer', color:'#fff' }}><Download size={14}/></button>
              </div>
            )}

            {/* LOCATION */}
            {msg.fileType === 'location' && msg.location && (
              <a href={`https://maps.google.com/?q=${msg.location.lat},${msg.location.lng}`} target="_blank" rel="noreferrer" style={{ textDecoration:'none', display:'block' }}>
                <div style={{ background:'#1e3a8a', borderRadius:8, padding:10, minWidth:200, color:'#fff' }}>
                  <MapPin size={20} style={{ marginBottom:4 }}/>
                  <p style={{ fontSize:11, fontWeight:700, margin:0 }}>📍 Location shared</p>
                  <p style={{ fontSize:9, opacity:0.8, margin:'2px 0 0' }}>{msg.location.address}</p>
                  <p style={{ fontSize:9, color:'#86efac', margin:'4px 0 0' }}>Tap to open in Maps</p>
                </div>
              </a>
            )}

            {/* TEXT */}
            {msg.text && <p style={{ fontSize:13, margin: ['image','video'].includes(msg.fileType) && msg.text ? '5px 8px 3px' : 0, color:'#fff', lineHeight:1.5, wordBreak:'break-word' }}>{msg.text}</p>}

            {/* Time + ticks */}
            <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent: isMe?'flex-end':'flex-start', margin: ['image','video'].includes(msg.fileType) ? '0 8px 3px' : '3px 0 0' }}>
              {msg.starredBy?.includes(myName) && <Star size={9} color={isMe?'rgba(255,255,255,0.7)':'#fbbf24'} fill={isMe?'rgba(255,255,255,0.7)':'#fbbf24'}/>}
              {msg.edited && <span style={{ fontSize:9, color:isMe?'rgba(255,255,255,0.5)':'#64748b', fontStyle:'italic' }}>edited</span>}
              <span style={{ fontSize:9, color: isMe?'rgba(255,255,255,0.5)':'#64748b' }}>
                {new Date(msg.createdAt||Date.now()).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
              </span>
              {isMe && (msg.optimistic ? '⏳' : readByOthers > 0
                ? <CheckCheck size={11} color="#60a5fa"/>
                : <CheckCheck size={11} color="rgba(255,255,255,0.5)"/>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display:'flex', height:'calc(100dvh - 48px)', background:'#020617', color:'#fff', overflow:'hidden' }}>

      {showSettings && <GroupSettingsModal/>}
      {forwardMsg && <ForwardModal/>}
      {messages.map(m => showActions === m._id && <ActionMenu key={m._id} msg={m}/>)}

      {/* Image viewer */}
      {imageView && (
        <div onClick={() => setImageView(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.95)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <img src={imageView} alt="" style={{ maxWidth:'95%', maxHeight:'95%' }}/>
          <button onClick={() => setImageView(null)} style={{ position:'absolute', top:14, right:14, background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:40, height:40, color:'#fff', cursor:'pointer' }}><X size={18}/></button>
        </div>
      )}

      {!sidebarOpen && (
        <button onClick={() => setSidebarOpen(true)} className="lg:hidden" style={{ position:'fixed', bottom:72, left:12, zIndex:50, background:'#DC0000', border:'none', borderRadius:'50%', width:44, height:44, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 4px 20px rgba(220,0,0,0.4)' }}>
          <Menu size={20} color="white"/>
        </button>
      )}
      {sidebarOpen && <div className="lg:hidden" onClick={() => setSidebarOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:30 }}/>}

      {/* SIDEBAR */}
      <div style={{ position:'fixed', inset:0, right:'auto', zIndex:40, width:260, background:'#0a0f1e', borderRight:'1px solid #1e293b', display:'flex', flexDirection:'column', height:'100%', transform: sidebarOpen?'translateX(0)':'translateX(-100%)', transition:'transform 0.2s' }} className="lg:!translate-x-0 lg:!relative lg:!w-60">
        <div style={{ padding:'12px 12px 8px', borderBottom:'1px solid #1e293b' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2 style={{ fontSize:15, fontWeight:800, margin:0, color:'#fff' }}>💬 Team Chat</h2>
            <div style={{ display:'flex', gap:4 }}>
              <button onClick={() => { setShowStarred(s => !s); if (!showStarred) loadStarred(); else loadMessages(true); }} title="Starred"
                style={{ background:'none', border:'none', color: showStarred ? '#fbbf24' : '#94a3b8', cursor:'pointer', padding:4 }}>
                <Star size={14}/>
              </button>
              <button onClick={() => setShowSearch(s => !s)} title="Search" style={{ background:'none', border:'none', color: showSearch ? '#60a5fa' : '#94a3b8', cursor:'pointer', padding:4 }}>
                <Search size={14}/>
              </button>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden" style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer' }}><X size={16}/></button>
            </div>
          </div>
          <div style={{ position:'relative', marginTop:8 }}>
            <Search size={11} style={{ position:'absolute', left:9, top:9, color:'#64748b' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              style={{ width:'100%', background:'#1e293b', border:'1px solid #334155', borderRadius:6, padding:'7px 7px 7px 26px', color:'#fff', fontSize:11, outline:'none' }}/>
          </div>
        </div>

        <div style={{ display:'flex', borderBottom:'1px solid #1e293b' }}>
          {[['groups','👥 Groups'],['direct','💬 Direct']].map(([id, lab]) => (
            <button key={id} onClick={() => { setTab(id); setSidebarOpen(false); }} style={{ flex:1, background:tab===id?'#DC000022':'transparent', color:tab===id?'#DC0000':'#94a3b8', border:'none', padding:'8px 4px', fontSize:11, fontWeight:700, cursor:'pointer', borderBottom:tab===id?'2px solid #DC0000':'2px solid transparent' }}>{lab}</button>
          ))}
        </div>

        <div style={{ flex:1, overflowY:'auto' }}>
          {tab === 'groups' && DEFAULT_GROUPS.filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase())).map(g => {
            const active = activeRoom === g.id;
            const memberCount = groupMembers[g.id]?.length || 0;
            const unr = unread[`group_${g.id}`] || 0;
            return (
              <div key={g.id} style={{ padding:'10px 12px', cursor:'pointer', background:active?'#DC000015':'transparent', borderLeft:active?`3px solid ${g.color}`:'3px solid transparent', display:'flex', alignItems:'center', gap:8 }}
                onClick={() => { setActiveRoom(g.id); setSidebarOpen(false); }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <p style={{ fontWeight:700, fontSize:12, margin:0, color:'#fff' }}>{g.name}</p>
                    {unr > 0 && !active && <span style={{ background:'#16a34a', color:'#fff', borderRadius:'50%', minWidth:18, height:18, fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px' }}>{unr > 99 ? '99+' : unr}</span>}
                  </div>
                  <p style={{ color:'#64748b', fontSize:10, margin:'2px 0 0' }}>{memberCount > 0 ? `${memberCount} members` : 'All staff'}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); setShowSettings(g.id); }} style={{ background:'none', border:'none', color:'#475569', cursor:'pointer', padding:4 }}>
                  <Settings size={14}/>
                </button>
              </div>
            );
          })}
          {tab === 'direct' && (
            <>
              {filteredStaff.length === 0 && <p style={{ color:'#64748b', fontSize:11, padding:'10px 12px' }}>Staff Management में add करें</p>}
              {filteredStaff.map(s => {
                const room = `dm_${[myName, s.name].sort().join('_')}`;
                const unr  = unread[room] || 0;
                const active = activeDM?.name === s.name;
                return (
                  <div key={s._id||s.name} onClick={() => { setActiveDM(s); setSidebarOpen(false); }} style={{ padding:'8px 12px', cursor:'pointer', background:active?'#DC000015':'transparent', borderLeft:active?'3px solid #DC0000':'3px solid transparent', display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:'#1e40af', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13, color:'#fff' }}>{s.name?.[0]?.toUpperCase()}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <p style={{ fontWeight:700, fontSize:11, margin:0, color:'#fff', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{s.name}</p>
                        {unr > 0 && !active && <span style={{ background:'#16a34a', color:'#fff', borderRadius:'50%', minWidth:16, height:16, fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px' }}>{unr}</span>}
                      </div>
                      <p style={{ color:'#64748b', fontSize:9, margin:0 }}>{s.position||'Staff'}</p>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* CHAT AREA */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Search bar */}
        {showSearch && (
          <div style={{ padding:'10px 14px', background:'#0a0f1e', borderBottom:'1px solid #1e293b' }}>
            <input value={msgSearch} onChange={e => searchMessages(e.target.value)} placeholder="🔍 सब messages search..."
              style={{ width:'100%', background:'#1e293b', border:'1px solid #334155', borderRadius:8, padding:'8px 12px', color:'#fff', fontSize:12, outline:'none' }}/>
            {searchResults.length > 0 && (
              <div style={{ marginTop:8, maxHeight:200, overflowY:'auto', background:'#1e293b', borderRadius:8 }}>
                {searchResults.map(r => (
                  <div key={r._id} style={{ padding:'8px 12px', borderBottom:'1px solid #334155', fontSize:11 }}>
                    <p style={{ fontWeight:700, color:'#fbbf24', margin:0 }}>{r.sender} · {r.room}</p>
                    <p style={{ color:'#94a3b8', margin:'3px 0 0' }}>{r.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Header */}
        <div style={{ padding:'10px 14px', borderBottom:'1px solid #1e293b', background:'#0a0f1e', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1 }}>
            <h3 style={{ fontSize:14, fontWeight:800, margin:0, color:'#fff' }}>{showStarred ? '⭐ Starred Messages' : roomLabel}</h3>
            <p style={{ color:'#94a3b8', fontSize:10, margin:'2px 0 0' }}>
              {tab==='groups' && activeGroup ? (groupMembers[activeRoom]?.length > 0 ? `${groupMembers[activeRoom].length} members` : 'All staff') : activeDM?.position || 'Staff'}
            </p>
          </div>
          {tab==='direct' && activeDM?.phone && (
            <a href={`tel:${activeDM.phone}`} style={{ background:'#16a34a', color:'#fff', padding:'5px 10px', borderRadius:6, textDecoration:'none', fontSize:11, fontWeight:700 }}><Phone size={12}/></a>
          )}
          <button onClick={() => window.open(`/meeting?room=vphonda-${currentRoom}`, '_blank')} style={{ background:'#7c3aed', color:'#fff', border:'none', padding:'5px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700 }}><Video size={12}/></button>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:4 }}>
          {!currentRoom && <div style={{ textAlign:'center', color:'#475569', marginTop:80 }}><p style={{ fontSize:32 }}>💬</p><p>Room select करें</p></div>}
          {currentRoom && messages.length === 0 && <div style={{ textAlign:'center', color:'#475569', marginTop:80 }}><p style={{ fontSize:28 }}>👋</p><p>पहला message भेजें!</p></div>}
          {messages.map((msg, idx) => <MessageBubble key={msg._id || idx} msg={msg} idx={idx}/>)}
          <div ref={bottomRef}/>
        </div>

        {/* Reply / Edit preview */}
        {(replyTo || editingMsg) && (
          <div style={{ padding:'7px 14px', background:'#0f172a', borderTop:'1px solid #1e293b', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ flex:1, borderLeft:'3px solid #DC0000', paddingLeft:8 }}>
              <p style={{ color:'#fbbf24', fontSize:10, fontWeight:700, margin:0 }}>{editingMsg ? '✏️ Editing' : '↩ Reply to'}: {replyTo?.sender || editingMsg?.sender}</p>
              <p style={{ color:'#94a3b8', fontSize:10, margin:'1px 0 0' }}>{(replyTo?.text || editingMsg?.text)?.slice(0, 80)}</p>
            </div>
            <button onClick={() => { setReplyTo(null); setEditingMsg(null); setInput(''); }} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer' }}><X size={14}/></button>
          </div>
        )}

        {/* Recording UI */}
        {recording && (
          <div style={{ padding:'14px', background:'#7f1d1d', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:'#fff', animation:'pulse 1s infinite' }}/>
            <span style={{ color:'#fff', fontWeight:700, flex:1 }}>🎤 Recording... {recordTime}s</span>
            <button onClick={cancelRecord} style={{ background:'#fff', color:'#7f1d1d', border:'none', padding:'6px 12px', borderRadius:6, fontWeight:700, fontSize:11 }}>Cancel</button>
            <button onClick={stopRecord} style={{ background:'#16a34a', color:'#fff', border:'none', padding:'6px 12px', borderRadius:6, fontWeight:700, fontSize:11 }}>✓ Send</button>
          </div>
        )}

        {/* Attachment menu */}
        {showAttach && !recording && (
          <div style={{ padding:'10px 14px', background:'#0f172a', borderTop:'1px solid #1e293b', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
            <button onClick={sendPhotoCamera} style={{ background:'#1e3a8a', border:'none', borderRadius:8, padding:'10px 4px', color:'#fff', cursor:'pointer' }}><div style={{ fontSize:20 }}>📷</div><div style={{ fontSize:9, marginTop:3 }}>Camera</div></button>
            <button onClick={sendPhotoGallery} style={{ background:'#1a1a2e', border:'none', borderRadius:8, padding:'10px 4px', color:'#fff', cursor:'pointer' }}><div style={{ fontSize:20 }}>🖼️</div><div style={{ fontSize:9, marginTop:3 }}>Gallery</div></button>
            <button onClick={sendVideo} style={{ background:'#2e1065', border:'none', borderRadius:8, padding:'10px 4px', color:'#fff', cursor:'pointer' }}><div style={{ fontSize:20 }}>🎥</div><div style={{ fontSize:9, marginTop:3 }}>Video</div></button>
            <button onClick={sendDocument} style={{ background:'#431407', border:'none', borderRadius:8, padding:'10px 4px', color:'#fff', cursor:'pointer' }}><div style={{ fontSize:20 }}>📄</div><div style={{ fontSize:9, marginTop:3 }}>Doc</div></button>
            <button onClick={sendLocation} style={{ background:'#064e3b', border:'none', borderRadius:8, padding:'10px 4px', color:'#fff', cursor:'pointer' }}><div style={{ fontSize:20 }}>📍</div><div style={{ fontSize:9, marginTop:3 }}>Location</div></button>
          </div>
        )}

        {/* Input */}
        {!recording && (
          <div style={{ padding:'10px 14px', borderTop:'1px solid #1e293b', background:'#0a0f1e', display:'flex', gap:6, alignItems:'flex-end' }}>
            <div style={{ position:'relative' }}>
              <button onClick={() => setShowEmoji(e => !e)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', padding:4, lineHeight:1 }}>😊</button>
              {showEmoji && (
                <div style={{ position:'absolute', bottom:'100%', left:0, background:'#1e293b', border:'1px solid #334155', borderRadius:8, padding:6, display:'flex', flexWrap:'wrap', gap:4, width:240, zIndex:30, marginBottom:4 }}>
                  {EMOJIS.map(e => <button key={e} onClick={() => { setInput(i => i+e); setShowEmoji(false); inputRef.current?.focus(); }} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', padding:2 }}>{e}</button>)}
                </div>
              )}
            </div>
            <button onClick={() => setShowAttach(s => !s)} title="Attach" style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, padding:'8px', cursor:'pointer', color:'#94a3b8' }}>
              <Paperclip size={16}/>
            </button>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder={editingMsg ? 'Edit message...' : 'Message...'} rows={1} disabled={!currentRoom}
              style={{ flex:1, background:'#1e293b', border:'1px solid #334155', borderRadius:10, padding:'9px 12px', color:'#fff', fontSize:12, outline:'none', resize:'none', maxHeight:100, lineHeight:1.5 }}/>
            {input.trim() || editingMsg ? (
              <button onClick={() => sendMsg()} disabled={!input.trim()&&!editingMsg} style={{ background:'linear-gradient(135deg,#DC0000,#B91C1C)', border:'none', borderRadius:8, padding:'8px 14px', cursor:'pointer', color:'#fff' }}><Send size={16}/></button>
            ) : (
              <button onTouchStart={startRecord} onMouseDown={startRecord} onTouchEnd={stopRecord} onMouseUp={stopRecord} title="Press & hold to record"
                style={{ background:'#16a34a', border:'none', borderRadius:8, padding:'8px 14px', cursor:'pointer', color:'#fff' }}>
                <Mic size={16}/>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
