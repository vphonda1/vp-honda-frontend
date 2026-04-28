// TeamChat.jsx — With fixed duplicate messages + WhatsApp-like notifications via SW
import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageCircle, Phone, Video, Image, X, Search, Menu } from 'lucide-react';
import { captureFromCamera, sendWhatsApp, showInAppToast } from '../utils/smartUtils';
import { api } from '../utils/apiConfig';

const GROUPS = [
  { id: 'general',  name: '🏢 General',     desc: 'सब staff के लिए' },
  { id: 'sales',    name: '🏍️ Sales',        desc: 'Vehicle sales updates' },
  { id: 'service',  name: '🔧 Service',      desc: 'Service & repair' },
  { id: 'accounts', name: '💰 Accounts',     desc: 'Payment & finance' },
  { id: 'manager',  name: '👔 Manager Only', desc: 'Admin restricted' },
];

const EMOJIS = ['👍','❤️','✅','🔧','🏍️','💰','📞','⚠️','🎉','👏','🙏','💪'];

const playBeep = () => {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 800; osc.type = 'sine';
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(); osc.stop(ctx.currentTime + 0.25);
  } catch {}
};

// Request notification permission
const requestNotifPermission = () => {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
};

// Send notification via Service Worker (works on mobile)
const sendChatNotification = (title, body, tag, url) => {
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_CHAT_NOTIFICATION',
      payload: { title, body, tag, url }
    });
  }
};

export default function TeamChat({ user }) {
  const [tab,        setTab]        = useState('groups');
  const [activeRoom, setActiveRoom] = useState('general');
  const [activeDM,   setActiveDM]   = useState(null);
  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState('');
  const [staff,      setStaff]      = useState([]);
  const [search,     setSearch]     = useState('');
  const [replyTo,    setReplyTo]    = useState(null);
  const [showEmoji,  setShowEmoji]  = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const pollRef   = useRef(null);
  const sendingRef = useRef(false); // prevent duplicate sends

  const myName = user?.name || user?.email || 'Me';
  const currentRoom = tab === 'groups'
    ? `group_${activeRoom}`
    : activeDM ? `dm_${[myName, activeDM.name].sort().join('_')}` : null;

  // Load staff
  useEffect(() => {
    fetch(api('/api/staff')).then(r => r.ok ? r.json() : []).then(setStaff).catch(() => {});
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    requestNotifPermission();
  }, []);

  // Load messages + poll every 3 sec
  useEffect(() => {
    if (!currentRoom) return;
    setMessages([]);
    loadMessages(true);
    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => loadMessages(false), 3000);
    return () => clearInterval(pollRef.current);
  }, [currentRoom]);

  // Auto scroll
  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [messages]);

  const loadMessages = useCallback(async (initial = false) => {
    if (!currentRoom) return;
    try {
      const sinceParam = !initial && messages.length > 0
        ? `?since=${messages[messages.length-1]?.createdAt || ''}`
        : '';
      const res = await fetch(api(`/api/messages/${currentRoom}${sinceParam}`));
      if (!res.ok) return;
      const data = await res.json();

      if (initial) {
        setMessages(data);
      } else if (data.length > 0) {
        const existingIds = new Set(messages.map(m => m._id || m.id));
        const newMsgs = data.filter(m => !existingIds.has(m._id || m.id));
        if (newMsgs.length > 0) {
          const fromOthers = newMsgs.filter(m => m.sender !== myName);
          if (fromOthers.length > 0) {
            playBeep();
            // If page is hidden, send notification via Service Worker
            if (document.hidden) {
              fromOthers.forEach(msg => {
                sendChatNotification(
                  msg.sender,
                  msg.text || '📷 Photo',
                  `chat-${currentRoom}`,
                  window.location.href
                );
              });
            }
          }
          setMessages(prev => [...prev, ...newMsgs]);
        }
      }
    } catch { /* offline */ }
  }, [currentRoom, messages, myName]);

  const sendMsg = async (extra = {}) => {
    if (sendingRef.current) return; // already sending
    const text = input.trim();
    if (!text && !extra.photo) return;
    if (!currentRoom) return;

    sendingRef.current = true;
    const msgData = {
      sender:     myName,
      senderRole: user?.role || 'staff',
      text,
      photo:      extra.photo || null,
      replyTo:    replyTo ? { id: replyTo._id, sender: replyTo.sender, text: replyTo.text?.slice(0,60) } : null,
    };

    const optimistic = { ...msgData, _id: `opt_${Date.now()}`, createdAt: new Date().toISOString(), optimistic: true };
    setMessages(prev => [...prev, optimistic]);
    setInput(''); setReplyTo(null); inputRef.current?.focus();

    try {
      const res = await fetch(api(`/api/messages/${currentRoom}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msgData),
      });
      if (res.ok) {
        const saved = await res.json();
        setMessages(prev => prev.map(m => m._id === optimistic._id ? saved : m));
      }
    } catch {
      // keep optimistic
    } finally {
      setTimeout(() => { sendingRef.current = false; }, 500);
    }
  };

  const deleteMsg = async (msg) => {
    if (msg.sender !== myName) return;
    if (!window.confirm('Delete?')) return;
    setMessages(prev => prev.filter(m => (m._id || m.id) !== (msg._id || msg.id)));
    try {
      await fetch(api(`/api/messages/${currentRoom}/${msg._id}`), { method: 'DELETE' });
    } catch {}
  };

  const forwardToWA = (msg) => {
    const phone = prompt('किसे forward करना है? Phone number:');
    if (!phone) return;
    sendWhatsApp(phone, `*VP Honda Team Message*\n\n${msg.sender}: ${msg.text || '📷 Photo'}\n\n_VP Honda, Bhopal_`);
  };

  const sendPhoto = async () => {
    try {
      const photo = await captureFromCamera('environment');
      await sendMsg({ photo });
    } catch (e) { showInAppToast('❌ Camera error', String(e), 'error'); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
    }
  };

  const filteredStaff  = staff.filter(s => s.name !== myName && (!search || s.name.toLowerCase().includes(search.toLowerCase())));
  const filteredGroups = GROUPS.filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()));
  const roomLabel = tab === 'groups'
    ? GROUPS.find(g => g.id === activeRoom)?.name
    : `💬 ${activeDM?.name || ''}`;

  return (
    <div style={{ display:'flex', height:'calc(100dvh - 48px)', background:'#020617', color:'#fff', overflow:'hidden' }}>

      {/* Mobile sidebar toggle */}
      <button onClick={() => setSidebarOpen(true)} className="lg:hidden fixed bottom-4 left-4 z-50 bg-red-600 p-2 rounded-full shadow-lg">
        <Menu size={20} color="white"/>
      </button>

      {/* Sidebar */}
      <div className={`fixed lg:relative inset-y-0 left-0 z-40 w-[260px] bg-[#0a0f1e] border-r border-[#1e293b] transform transition-transform duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:flex lg:flex-col flex flex-col`} style={{ height: '100%' }}>
        <div style={{ padding:'12px 10px 8px', borderBottom:'1px solid #1e293b' }}>
          <div className="flex justify-between items-center">
            <h2 style={{ fontSize:15, fontWeight:800, margin:0, display:'flex', alignItems:'center', gap:6 }}>
              <MessageCircle size={16} color="#DC0000"/> Team Chat
            </h2>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white"><X size={18}/></button>
          </div>
          <div style={{ position:'relative', marginTop:8 }}>
            <Search size={11} style={{ position:'absolute', left:9, top:9, color:'#64748b' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              style={{ width:'100%', background:'#1e293b', border:'1px solid #334155', borderRadius:6, padding:'7px 7px 7px 26px', color:'#fff', fontSize:11, outline:'none' }}/>
          </div>
        </div>

        <div style={{ display:'flex', borderBottom:'1px solid #1e293b' }}>
          {[['groups','👥 Groups'],['direct','💬 Direct']].map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); setSidebarOpen(false); }} style={{
              flex:1, background:tab===id?'#DC000022':'transparent',
              color:tab===id?'#DC0000':'#94a3b8', border:'none',
              padding:'8px 4px', fontSize:11, fontWeight:700, cursor:'pointer',
              borderBottom:tab===id?'2px solid #DC0000':'2px solid transparent',
            }}>{label}</button>
          ))}
        </div>

        <div style={{ flex:1, overflowY:'auto' }}>
          {tab === 'groups' && filteredGroups.map(g => (
            <div key={g.id} onClick={() => { setActiveRoom(g.id); setActiveDM(null); setSearch(''); setSidebarOpen(false); }}
              style={{ padding:'9px 10px', cursor:'pointer', background:activeRoom === g.id?'#DC000015':'transparent', borderLeft:activeRoom === g.id?'3px solid #DC0000':'3px solid transparent' }}>
              <p style={{ fontWeight:700, fontSize:12, margin:'0 0 2px' }}>{g.name}</p>
              <p style={{ color:'#64748b', fontSize:10, margin:0 }}>{g.desc}</p>
            </div>
          ))}
          {tab === 'direct' && <>
            <p style={{ color:'#64748b', fontSize:9, fontWeight:700, textTransform:'uppercase', padding:'7px 10px 3px' }}>Staff</p>
            {filteredStaff.map(s => (
              <div key={s._id || s.name} onClick={() => { setActiveDM(s); setActiveRoom(null); setSearch(''); setSidebarOpen(false); }}
                style={{ padding:'8px 10px', cursor:'pointer', background:activeDM?.name === s.name?'#DC000015':'transparent', borderLeft:activeDM?.name === s.name?'3px solid #DC0000':'3px solid transparent', display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ position:'relative' }}>
                  <div style={{ width:30, height:30, borderRadius:'50%', background:'#1e40af', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13 }}>
                    {s.name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#16a34a', position:'absolute', bottom:0, right:0, border:'1px solid #020617' }}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontWeight:700, fontSize:11, margin:'0 0 1px', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{s.name}</p>
                  <p style={{ color:'#64748b', fontSize:9, margin:0 }}>{s.position || 'Staff'}</p>
                </div>
              </div>
            ))}
          </>}
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'10px 14px', borderBottom:'1px solid #1e293b', display:'flex', alignItems:'center', gap:10, background:'#0a0f1e', flexShrink:0 }}>
          <div style={{ flex:1 }}>
            <h3 style={{ fontSize:14, fontWeight:800, margin:0 }}>{roomLabel}</h3>
            <p style={{ color:'#94a3b8', fontSize:10, margin:'2px 0 0' }}>Synced across all devices</p>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {tab === 'direct' && activeDM?.phone && (
              <button onClick={() => window.location.href=`tel:${activeDM.phone}`} style={{ background:'#16a34a', border:'none', color:'#fff', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700 }}><Phone size={12}/> Call</button>
            )}
            <button onClick={() => window.open(`/meeting?room=vphonda-${currentRoom}`, '_blank')} style={{ background:'#7c3aed', border:'none', color:'#fff', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700 }}><Video size={12}/> Meet</button>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:4 }}>
          {messages.map((msg, i) => {
            const isMe = msg.sender === myName;
            const prevSame = i > 0 && messages[i-1].sender === msg.sender;
            return (
              <div key={msg._id || i} style={{ display:'flex', flexDirection:isMe?'row-reverse':'row', alignItems:'flex-end', gap:6 }}>
                {!isMe && !prevSame && (
                  <div style={{ width:26, height:26, borderRadius:'50%', background:'#1e40af', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0 }}>
                    {msg.sender?.[0]?.toUpperCase()}
                  </div>
                )}
                {!isMe && prevSame && <div style={{ width:26, flexShrink:0 }}/>}
                <div style={{ maxWidth:'70%', minWidth:60 }}>
                  {!isMe && !prevSame && <p style={{ fontSize:9, color:'#94a3b8', margin:'0 0 2px 2px' }}>{msg.sender}</p>}
                  {msg.replyTo && (
                    <div style={{ background:'rgba(255,255,255,0.05)', borderLeft:'3px solid #DC0000', borderRadius:'6px 6px 0 0', padding:'3px 8px', fontSize:10, color:'#94a3b8' }}>
                      <span style={{ color:'#fbbf24', fontWeight:700 }}>{msg.replyTo.sender}:</span> {msg.replyTo.text}
                    </div>
                  )}
                  <div style={{ background: isMe ? 'linear-gradient(135deg,#DC0000,#B91C1C)' : '#1e293b', borderRadius: msg.replyTo ? (isMe ? '0 0 4px 14px' : '0 0 14px 4px') : (isMe ? '14px 4px 14px 14px' : '4px 14px 14px 14px'), padding: msg.photo ? '3px' : '8px 12px', opacity: msg.optimistic ? 0.7 : 1 }} onDoubleClick={() => setReplyTo(msg)}>
                    {msg.photo && <img src={msg.photo} alt="photo" onClick={() => window.open(msg.photo,'_blank')} style={{ width:'100%', maxWidth:220, borderRadius:8, cursor:'zoom-in' }}/>}
                    {msg.text && <p style={{ fontSize:13, margin: msg.photo?'5px 8px 3px':0, lineHeight:1.5, wordBreak:'break-word' }}>{msg.text}</p>}
                    <p style={{ fontSize:9, color:isMe?'rgba(255,255,255,0.55)':'#64748b', margin: msg.photo?'0 8px 3px':'3px 0 0', textAlign:isMe?'right':'left' }}>
                      {new Date(msg.createdAt || Date.now()).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
                      {msg.optimistic && ' ⏳'}
                    </p>
                  </div>
                  <div style={{ display:'flex', gap:3, marginTop:2, justifyContent:isMe?'flex-end':'flex-start' }}>
                    <button onClick={() => setReplyTo(msg)} style={{ background:'transparent', border:'none', color:'#475569', fontSize:9, cursor:'pointer', padding:'1px 4px' }}>↩ Reply</button>
                    <button onClick={() => forwardToWA(msg)} style={{ background:'transparent', border:'none', color:'#475569', fontSize:9, cursor:'pointer', padding:'1px 4px' }}>📱 WA</button>
                    {isMe && <button onClick={() => deleteMsg(msg)} style={{ background:'transparent', border:'none', color:'#475569', fontSize:9, cursor:'pointer', padding:'1px 4px' }}>🗑</button>}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef}/>
        </div>

        {replyTo && (
          <div style={{ padding:'7px 14px', background:'#0f172a', borderTop:'1px solid #1e293b', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            <div style={{ flex:1, borderLeft:'3px solid #DC0000', paddingLeft:8 }}>
              <p style={{ color:'#fbbf24', fontSize:10, fontWeight:700, margin:0 }}>↩ {replyTo.sender} को reply</p>
              <p style={{ color:'#94a3b8', fontSize:10, margin:'1px 0 0' }}>{replyTo.text?.slice(0, 80)}</p>
            </div>
            <button onClick={() => setReplyTo(null)} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer' }}><X size={14}/></button>
          </div>
        )}

        {/* Input Area */}
        <div style={{ padding:'10px 14px', borderTop:'1px solid #1e293b', background:'#0a0f1e', display:'flex', gap:6, alignItems:'flex-end', flexShrink:0, position:'relative', zIndex:20 }}>
          <div style={{ position:'relative' }}>
            <button onClick={() => setShowEmoji(e => !e)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', padding:4 }}>😊</button>
            {showEmoji && (
              <div style={{ position:'absolute', bottom:'100%', left:0, background:'#1e293b', border:'1px solid #334155', borderRadius:8, padding:6, display:'flex', flexWrap:'wrap', gap:3, width:180, zIndex:30, marginBottom:4 }}>
                {EMOJIS.map(e => <button key={e} onClick={() => { setInput(i => i+e); setShowEmoji(false); inputRef.current?.focus(); }} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', padding:2 }}>{e}</button>)}
              </div>
            )}
          </div>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Message... (Enter भेजें)"
            rows={1} disabled={!currentRoom}
            style={{ flex:1, background:'#1e293b', border:'1px solid #334155', borderRadius:10, padding:'9px 12px', color:'#fff', fontSize:12, outline:'none', resize:'none', maxHeight:100, overflowY:'auto', lineHeight:1.5, WebkitAppearance:'none', touchAction:'manipulation' }}/>
          <button onClick={sendPhoto} style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, padding:'8px', cursor:'pointer', color:'#94a3b8' }}><Image size={16}/></button>
          <button onClick={() => sendMsg()} disabled={!input.trim() || !currentRoom}
            style={{ background:input.trim()?'linear-gradient(135deg,#DC0000,#B91C1C)':'#1e293b', border:'none', borderRadius:8, padding:'8px 12px', cursor:input.trim()?'pointer':'not-allowed', color:'#fff' }}>
            <Send size={16}/>
          </button>
        </div>
      </div>
    </div>
  );
}