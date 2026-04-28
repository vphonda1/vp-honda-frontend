// TeamChat.jsx — VP Honda Internal Team Chat (Cross-Device via Backend API)
import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageCircle, Phone, Video, Image, X, Search, Circle } from 'lucide-react';
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

// Play notification beep
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
  const [loading,    setLoading]    = useState(false);
  const [lastId,     setLastId]     = useState(null);
  const [unread,     setUnread]     = useState({});
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const pollRef   = useRef(null);

  const myName = user?.name || user?.email || 'Me';
  const currentRoom = tab === 'groups'
    ? `group_${activeRoom}`
    : activeDM ? `dm_${[myName, activeDM.name].sort().join('_')}` : null;

  // Load staff
  useEffect(() => {
    fetch(api('/api/staff')).then(r => r.ok ? r.json() : []).then(setStaff).catch(() => {});
  }, []);

  // Load messages + poll every 3 sec
  useEffect(() => {
    if (!currentRoom) return;
    setMessages([]); setLastId(null);
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
        ? `?since=${messages[messages.length - 1]?.createdAt || ''}`
        : '';
      const res = await fetch(api(`/api/messages/${currentRoom}${sinceParam}`));
      if (!res.ok) return;
      const data = await res.json();

      if (initial) {
        setMessages(data);
      } else if (data.length > 0) {
        // New messages from others → beep
        const fromOthers = data.filter(m => m.sender !== myName);
        if (fromOthers.length > 0) playBeep();
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m._id || m.id));
          const newMsgs = data.filter(m => !existingIds.has(m._id || m.id));
          return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
        });
      }
    } catch { /* offline */ }
  }, [currentRoom, messages, myName]);

  const sendMsg = async (extra = {}) => {
    const text = input.trim();
    if (!text && !extra.photo) return;
    if (!currentRoom) return;

    const msgData = {
      sender:     myName,
      senderRole: user?.role || 'staff',
      text,
      photo:      extra.photo || null,
      replyTo:    replyTo ? { id: replyTo._id, sender: replyTo.sender, text: replyTo.text?.slice(0, 60) } : null,
    };

    // Optimistic UI
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
        // Replace optimistic with real
        setMessages(prev => prev.map(m => m._id === optimistic._id ? saved : m));
      }
    } catch {
      // Keep optimistic message even if offline
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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };

  const filteredStaff  = staff.filter(s => s.name !== myName && (!search || s.name.toLowerCase().includes(search.toLowerCase())));
  const filteredGroups = GROUPS.filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()));
  const roomLabel = tab === 'groups'
    ? GROUPS.find(g => g.id === activeRoom)?.name
    : `💬 ${activeDM?.name || ''}`;

  return (
    <div style={{ display:'flex', height:'calc(100vh - 48px)', background:'#020617', color:'#fff', overflow:'hidden' }}>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <div style={{ width:240, borderRight:'1px solid #1e293b', display:'flex', flexDirection:'column', background:'#0a0f1e', flexShrink:0 }}>
        {/* Header */}
        <div style={{ padding:'12px 10px 8px', borderBottom:'1px solid #1e293b' }}>
          <h2 style={{ fontSize:15, fontWeight:800, margin:'0 0 8px', display:'flex', alignItems:'center', gap:6 }}>
            <MessageCircle size={16} color="#DC0000"/> Team Chat
          </h2>
          <div style={{ position:'relative' }}>
            <Search size={11} style={{ position:'absolute', left:9, top:9, color:'#64748b' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              style={{ width:'100%', background:'#1e293b', border:'1px solid #334155', borderRadius:6, padding:'7px 7px 7px 26px', color:'#fff', fontSize:11, outline:'none' }}/>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid #1e293b' }}>
          {[['groups','👥 Groups'],['direct','💬 Direct']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              flex:1, background:tab===id?'#DC000022':'transparent',
              color:tab===id?'#DC0000':'#94a3b8', border:'none',
              padding:'8px 4px', fontSize:11, fontWeight:700, cursor:'pointer',
              borderBottom:tab===id?'2px solid #DC0000':'2px solid transparent',
            }}>{label}</button>
          ))}
        </div>

        {/* List */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {tab === 'groups' && filteredGroups.map(g => {
            const isActive = activeRoom === g.id;
            return (
              <div key={g.id} onClick={() => { setActiveRoom(g.id); setSearch(''); }}
                style={{ padding:'9px 10px', cursor:'pointer',
                  background:isActive?'#DC000015':'transparent',
                  borderLeft:isActive?'3px solid #DC0000':'3px solid transparent' }}>
                <p style={{ fontWeight:700, fontSize:12, margin:'0 0 2px' }}>{g.name}</p>
                <p style={{ color:'#64748b', fontSize:10, margin:0 }}>{g.desc}</p>
              </div>
            );
          })}

          {tab === 'direct' && <>
            <p style={{ color:'#64748b', fontSize:9, fontWeight:700, textTransform:'uppercase', padding:'7px 10px 3px' }}>Staff</p>
            {filteredStaff.length === 0 && !search && (
              <p style={{ color:'#64748b', fontSize:11, padding:'10px 10px' }}>Staff Management में staff add करें</p>
            )}
            {filteredStaff.map(s => {
              const isActive = activeDM?.name === s.name;
              return (
                <div key={s._id || s.name} onClick={() => { setActiveDM(s); setSearch(''); }}
                  style={{ padding:'8px 10px', cursor:'pointer',
                    background:isActive?'#DC000015':'transparent',
                    borderLeft:isActive?'3px solid #DC0000':'3px solid transparent',
                    display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ position:'relative' }}>
                    <div style={{ width:30, height:30, borderRadius:'50%', background:'#1e40af',
                      display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13 }}>
                      {s.name?.[0]?.toUpperCase()}
                    </div>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:'#16a34a',
                      position:'absolute', bottom:0, right:0, border:'1px solid #020617' }}/>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontWeight:700, fontSize:11, margin:'0 0 1px', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{s.name}</p>
                    <p style={{ color:'#64748b', fontSize:9, margin:0 }}>{s.position || 'Staff'}</p>
                  </div>
                </div>
              );
            })}
          </>}
        </div>

        {/* My status */}
        <div style={{ padding:'8px 10px', borderTop:'1px solid #1e293b', display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:'50%', background:'#DC0000',
            display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:12, flexShrink:0 }}>
            {myName?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontWeight:700, fontSize:11, margin:0, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{myName}</p>
            <p style={{ color:'#16a34a', fontSize:9, margin:0 }}>● Online</p>
          </div>
        </div>
      </div>

      {/* ── CHAT AREA ─────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Chat header */}
        <div style={{ padding:'10px 14px', borderBottom:'1px solid #1e293b', display:'flex', alignItems:'center', gap:10, background:'#0a0f1e', flexShrink:0 }}>
          <div style={{ flex:1 }}>
            <h3 style={{ fontSize:14, fontWeight:800, margin:0 }}>{roomLabel}</h3>
            <p style={{ color:'#94a3b8', fontSize:10, margin:'2px 0 0' }}>
              {tab === 'groups' ? GROUPS.find(g => g.id === activeRoom)?.desc : activeDM?.position || 'Staff'}
              <span style={{ marginLeft:8, color:'#475569', fontSize:9 }}>• Synced across all devices</span>
            </p>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {tab === 'direct' && activeDM?.phone && (
              <button onClick={() => window.location.href=`tel:${activeDM.phone}`}
                style={{ background:'#16a34a', border:'none', color:'#fff', borderRadius:6, padding:'5px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700 }}>
                <Phone size={12}/> Call
              </button>
            )}
            <button onClick={() => window.open(`/meeting?room=vphonda-${currentRoom}`, '_blank')}
              style={{ background:'#7c3aed', border:'none', color:'#fff', borderRadius:6, padding:'5px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700 }}>
              <Video size={12}/> Meet
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:4 }}>
          {!currentRoom && (
            <div style={{ textAlign:'center', color:'#475569', marginTop:60 }}>
              <p style={{ fontSize:28 }}>💬</p>
              <p style={{ fontSize:13 }}>Left sidebar से room या person select करें</p>
            </div>
          )}
          {currentRoom && messages.length === 0 && (
            <div style={{ textAlign:'center', color:'#475569', marginTop:60 }}>
              <p style={{ fontSize:28 }}>💬</p>
              <p style={{ fontSize:13, fontWeight:700 }}>कोई message नहीं</p>
              <p style={{ fontSize:11 }}>पहला message भेजें!</p>
            </div>
          )}
          {messages.map((msg, i) => {
            const isMe      = msg.sender === myName;
            const prevSame  = i > 0 && messages[i-1].sender === msg.sender;
            const msgId     = msg._id || msg.id;
            return (
              <div key={msgId || i} style={{ display:'flex', flexDirection:isMe?'row-reverse':'row', alignItems:'flex-end', gap:6 }}>
                {!isMe && !prevSame && (
                  <div style={{ width:26, height:26, borderRadius:'50%', background:'#1e40af',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0 }}>
                    {msg.sender?.[0]?.toUpperCase()}
                  </div>
                )}
                {!isMe && prevSame && <div style={{ width:26, flexShrink:0 }}/>}

                <div style={{ maxWidth:'70%', minWidth:60 }}>
                  {!isMe && !prevSame && (
                    <p style={{ fontSize:9, color:'#94a3b8', margin:'0 0 2px 2px' }}>{msg.sender}</p>
                  )}
                  {msg.replyTo && (
                    <div style={{ background:'rgba(255,255,255,0.05)', borderLeft:'3px solid #DC0000',
                      borderRadius:'6px 6px 0 0', padding:'3px 8px', fontSize:10, color:'#94a3b8' }}>
                      <span style={{ color:'#fbbf24', fontWeight:700 }}>{msg.replyTo.sender}:</span> {msg.replyTo.text}
                    </div>
                  )}
                  <div
                    style={{
                      background: isMe ? 'linear-gradient(135deg,#DC0000,#B91C1C)' : '#1e293b',
                      borderRadius: msg.replyTo
                        ? isMe ? '0 0 4px 14px' : '0 0 14px 4px'
                        : isMe ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                      padding: msg.photo ? '3px' : '8px 12px',
                      opacity: msg.optimistic ? 0.7 : 1,
                    }}
                    onDoubleClick={() => setReplyTo(msg)}
                    title="Double-tap to reply"
                  >
                    {msg.photo && (
                      <img src={msg.photo} alt="photo" onClick={() => window.open(msg.photo,'_blank')}
                        style={{ width:'100%', maxWidth:220, borderRadius:8, display:'block', cursor:'zoom-in' }}/>
                    )}
                    {msg.text && <p style={{ fontSize:13, margin: msg.photo?'5px 8px 3px':0, lineHeight:1.5, wordBreak:'break-word' }}>{msg.text}</p>}
                    <p style={{ fontSize:9, color:isMe?'rgba(255,255,255,0.55)':'#64748b',
                      margin: msg.photo?'0 8px 3px':'3px 0 0', textAlign:isMe?'right':'left' }}>
                      {new Date(msg.createdAt || Date.now()).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
                      {msg.optimistic && ' ⏳'}
                    </p>
                  </div>

                  {/* Quick actions */}
                  <div style={{ display:'flex', gap:3, marginTop:2, justifyContent:isMe?'flex-end':'flex-start' }}>
                    <button onClick={() => setReplyTo(msg)}
                      style={{ background:'transparent', border:'none', color:'#475569', fontSize:9, cursor:'pointer', padding:'1px 4px', borderRadius:3 }}>↩ Reply</button>
                    <button onClick={() => forwardToWA(msg)}
                      style={{ background:'transparent', border:'none', color:'#475569', fontSize:9, cursor:'pointer', padding:'1px 4px', borderRadius:3 }}>📱 WA</button>
                    {isMe && (
                      <button onClick={() => deleteMsg(msg)}
                        style={{ background:'transparent', border:'none', color:'#475569', fontSize:9, cursor:'pointer', padding:'1px 4px', borderRadius:3 }}>🗑</button>
                    )}
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
              <p style={{ color:'#94a3b8', fontSize:10, margin:'1px 0 0' }}>{replyTo.text?.slice(0, 80)}</p>
            </div>
            <button onClick={() => setReplyTo(null)} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer' }}><X size={14}/></button>
          </div>
        )}

        {/* Input area */}
        <div style={{ padding:'10px 14px', borderTop:'1px solid #1e293b', background:'#0a0f1e', display:'flex', gap:6, alignItems:'flex-end', flexShrink:0 }}>
          {/* Emoji */}
          <div style={{ position:'relative' }}>
            <button onClick={() => setShowEmoji(e => !e)}
              style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', padding:4, lineHeight:1 }}>😊</button>
            {showEmoji && (
              <div style={{ position:'absolute', bottom:'100%', left:0, background:'#1e293b', border:'1px solid #334155',
                borderRadius:8, padding:6, display:'flex', flexWrap:'wrap', gap:3, width:180, zIndex:10, marginBottom:4 }}>
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => { setInput(i => i+e); setShowEmoji(false); inputRef.current?.focus(); }}
                    style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', padding:2, borderRadius:3 }}>{e}</button>
                ))}
              </div>
            )}
          </div>

          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Message... (Enter भेजें, Shift+Enter new line)"
            rows={1} disabled={!currentRoom}
            style={{ flex:1, background:'#1e293b', border:'1px solid #334155', borderRadius:10,
              padding:'9px 12px', color:'#fff', fontSize:12, outline:'none',
              resize:'none', maxHeight:100, overflowY:'auto', lineHeight:1.5 }}/>

          <button onClick={sendPhoto} title="Photo भेजें"
            style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, padding:'8px', cursor:'pointer', color:'#94a3b8' }}>
            <Image size={16}/>
          </button>

          <button onClick={() => sendMsg()} disabled={!input.trim() || !currentRoom}
            style={{ background:input.trim()?'linear-gradient(135deg,#DC0000,#B91C1C)':'#1e293b',
              border:'none', borderRadius:8, padding:'8px 12px', cursor:input.trim()?'pointer':'not-allowed', color:'#fff' }}>
            <Send size={16}/>
          </button>
        </div>
      </div>
    </div>
  );
}
