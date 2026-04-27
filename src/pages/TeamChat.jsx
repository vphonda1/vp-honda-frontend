// TeamChat.jsx — VP Honda Internal Team Chat
// Features: Direct messages, Group chat, file/photo sharing, WhatsApp forward
import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Users, MessageCircle, Phone, Video, Image, X, Plus, Search, Circle, MoreVertical } from 'lucide-react';
import { captureFromCamera, sendWhatsApp, showInAppToast } from '../utils/smartUtils';
import { api } from '../utils/apiConfig';

const GROUPS = [
  { id: 'general',  name: '🏢 General',       desc: 'सब staff के लिए' },
  { id: 'sales',    name: '🏍️ Sales Team',     desc: 'Vehicle sales updates' },
  { id: 'service',  name: '🔧 Service Team',   desc: 'Service & repair updates' },
  { id: 'accounts', name: '💰 Accounts',       desc: 'Payment & finance updates' },
  { id: 'manager',  name: '👔 Manager Only',   desc: 'Admin restricted' },
];

const LOAD_KEY = (room) => `vp_chat_${room}`;
const loadMsgs = (room) => JSON.parse(localStorage.getItem(LOAD_KEY(room)) || '[]');
const saveMsgs = (room, msgs) => localStorage.setItem(LOAD_KEY(room), JSON.stringify(msgs.slice(-200)));

// Notification sound
const playNotif = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880; osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
  } catch {}
};

export default function TeamChat({ user }) {
  const [tab, setTab] = useState('groups');           // groups | direct
  const [activeRoom, setActiveRoom] = useState('general');
  const [activeDM, setActiveDM] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState('');
  const [onlineUsers] = useState(new Set([user?.name]));
  const [unread, setUnread] = useState({});
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const pollRef = useRef(null);

  const currentRoom = tab === 'groups' ? `group_${activeRoom}` : `dm_${[user?.name, activeDM?.name].sort().join('_')}`;
  const myName = user?.name || user?.email || 'Me';

  useEffect(() => {
    fetch(api('/api/staff')).then(r => r.ok ? r.json() : []).then(s => setStaff(s)).catch(() => {});
  }, []);

  // Load + Poll messages every 3s
  useEffect(() => {
    loadRoom();
    pollRef.current = setInterval(loadRoom, 3000);
    return () => clearInterval(pollRef.current);
  }, [currentRoom]);

  const loadRoom = useCallback(() => {
    const msgs = loadMsgs(currentRoom);
    setMessages(prev => {
      // Check for new messages from others
      if (msgs.length > prev.length) {
        const newMsgs = msgs.slice(prev.length);
        const fromOthers = newMsgs.filter(m => m.sender !== myName);
        if (fromOthers.length > 0 && document.visibilityState !== 'visible') {
          playNotif();
        }
      }
      return msgs;
    });
  }, [currentRoom, myName]);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [messages]);

  const sendMsg = async (extra = {}) => {
    const text = input.trim();
    if (!text && !extra.photo) return;
    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      sender: myName,
      senderRole: user?.role || 'staff',
      text,
      photo: extra.photo || null,
      replyTo: replyTo ? { id: replyTo.id, sender: replyTo.sender, text: replyTo.text?.slice(0, 60) } : null,
      timestamp: new Date().toISOString(),
      read: false,
    };
    const updated = [...loadMsgs(currentRoom), msg];
    saveMsgs(currentRoom, updated);
    setMessages(updated);
    setInput('');
    setReplyTo(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };

  const sendPhoto = async () => {
    try {
      const photo = await captureFromCamera('environment');
      await sendMsg({ photo });
      showInAppToast('📷 Photo sent', '', 'success');
    } catch (e) { showInAppToast('❌ Camera error', String(e), 'error'); }
  };

  const deleteMsg = (id) => {
    if (!window.confirm('Delete this message?')) return;
    const updated = loadMsgs(currentRoom).filter(m => m.id !== id);
    saveMsgs(currentRoom, updated);
    setMessages(updated);
  };

  const forwardToWA = (msg) => {
    const phone = prompt('किसे forward करना है? Phone number:');
    if (!phone) return;
    sendWhatsApp(phone, `*VP Honda Team Message*\n\n${msg.sender}: ${msg.text || '📷 Photo'}\n\n_VP Honda, Bhopal_`);
  };

  const EMOJIS = ['👍','❤️','✅','🔧','🏍️','💰','📞','⚠️','🎉','👏','🙏','💪'];

  const roomLabel = tab === 'groups'
    ? GROUPS.find(g => g.id === activeRoom)?.name || activeRoom
    : `💬 ${activeDM?.name || ''}`;

  const filteredStaff = staff.filter(s => s.name !== myName && (!search || s.name.toLowerCase().includes(search.toLowerCase())));
  const filteredGroups = GROUPS.filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', background: '#020617', color: '#fff', overflow: 'hidden' }}>

      {/* ── SIDEBAR ───────────────────────────────────── */}
      <div style={{ width: 260, borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', flexShrink: 0, background: '#0a0f1e' }}>
        {/* Header */}
        <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid #1e293b' }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageCircle size={18} color="#DC0000"/> Team Chat
          </h2>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: 10, color: '#64748b' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '8px 8px 8px 28px', color: '#fff', fontSize: 12, outline: 'none' }}/>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1e293b' }}>
          {[['groups', '👥 Groups'], ['direct', '💬 Direct']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ flex: 1, background: tab === id ? '#DC000022' : 'transparent', color: tab === id ? '#DC0000' : '#94a3b8', border: 'none', padding: '10px 6px', fontSize: 12, fontWeight: 700, cursor: 'pointer', borderBottom: tab === id ? '2px solid #DC0000' : '2px solid transparent' }}>
              {label}
            </button>
          ))}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tab === 'groups' && filteredGroups.map(g => {
            const msgs = loadMsgs(`group_${g.id}`);
            const lastMsg = msgs[msgs.length - 1];
            const isActive = activeRoom === g.id;
            return (
              <div key={g.id} onClick={() => { setActiveRoom(g.id); setSearch(''); }}
                style={{ padding: '10px 12px', cursor: 'pointer', background: isActive ? '#DC000015' : 'transparent', borderLeft: isActive ? '3px solid #DC0000' : '3px solid transparent', transition: 'all 0.15s' }}>
                <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 2px' }}>{g.name}</p>
                <p style={{ color: '#64748b', fontSize: 11, margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {lastMsg ? `${lastMsg.sender}: ${lastMsg.text || '📷'}` : g.desc}
                </p>
              </div>
            );
          })}

          {tab === 'direct' && (
            <>
              {/* Me */}
              <div style={{ padding: '8px 12px 4px', color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Staff</div>
              {filteredStaff.map(s => {
                const dmRoom = `dm_${[myName, s.name].sort().join('_')}`;
                const msgs = loadMsgs(dmRoom);
                const lastMsg = msgs[msgs.length - 1];
                const isActive = activeDM?.name === s.name;
                return (
                  <div key={s._id || s.name} onClick={() => { setActiveDM(s); setSearch(''); }}
                    style={{ padding: '10px 12px', cursor: 'pointer', background: isActive ? '#DC000015' : 'transparent', borderLeft: isActive ? '3px solid #DC0000' : '3px solid transparent', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>
                        {s.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <Circle size={8} fill="#16a34a" color="#16a34a" style={{ position: 'absolute', bottom: 0, right: 0 }}/>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 12, margin: '0 0 1px' }}>{s.name}</p>
                      <p style={{ color: '#64748b', fontSize: 10, margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {lastMsg ? `${lastMsg.sender === myName ? 'You' : lastMsg.sender}: ${lastMsg.text || '📷'}` : s.position || 'Staff'}
                      </p>
                    </div>
                  </div>
                );
              })}
              {filteredStaff.length === 0 && !search && (
                <p style={{ color: '#64748b', fontSize: 12, padding: '16px 12px' }}>Staff Management में staff add करें पहले</p>
              )}
            </>
          )}
        </div>

        {/* My Status */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#DC0000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
            {myName?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: 12, margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{myName}</p>
            <p style={{ color: '#16a34a', fontSize: 10, margin: 0 }}>● Online</p>
          </div>
        </div>
      </div>

      {/* ── CHAT AREA ─────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Chat Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 10, background: '#0a0f1e' }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>{roomLabel}</h3>
            <p style={{ color: '#94a3b8', fontSize: 11, margin: '2px 0 0' }}>
              {tab === 'groups'
                ? GROUPS.find(g => g.id === activeRoom)?.desc || ''
                : `${activeDM?.position || 'Staff Member'}`}
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {tab === 'direct' && activeDM && (
              <>
                <button onClick={() => window.location.href = `tel:${activeDM.phone}`}
                  style={{ background: '#16a34a', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
                  <Phone size={14}/> Call
                </button>
                <button onClick={() => window.open(`/meeting?room=vphonda-${activeDM.name.replace(/\s/g,'').toLowerCase()}`, '_blank')}
                  style={{ background: '#7c3aed', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
                  <Video size={14}/> Video
                </button>
              </>
            )}
            {tab === 'groups' && (
              <button onClick={() => window.open(`/meeting?room=vphonda-${activeRoom}`, '_blank')}
                style={{ background: '#7c3aed', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
                <Video size={14}/> Group Meeting
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#475569', marginTop: 60 }}>
              <p style={{ fontSize: 32 }}>💬</p>
              <p style={{ fontSize: 14, fontWeight: 700 }}>कोई message नहीं</p>
              <p style={{ fontSize: 12, margin: '4px 0 0' }}>पहला message भेजें!</p>
            </div>
          )}
          {messages.map((msg, i) => {
            const isMe = msg.sender === myName;
            const prevSame = i > 0 && messages[i-1].sender === msg.sender;
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 6 }}>
                {/* Avatar */}
                {!isMe && !prevSame && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                    {msg.sender?.[0]?.toUpperCase()}
                  </div>
                )}
                {!isMe && prevSame && <div style={{ width: 28, flexShrink: 0 }}/>}

                {/* Bubble */}
                <div style={{ maxWidth: '70%', minWidth: 80 }}>
                  {!isMe && !prevSame && (
                    <p style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3, marginLeft: 2 }}>{msg.sender}</p>
                  )}
                  {/* Reply quote */}
                  {msg.replyTo && (
                    <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', borderRadius: '8px 8px 0 0', padding: '4px 8px', fontSize: 10, color: '#94a3b8', borderLeft: '3px solid #DC0000' }}>
                      <span style={{ color: '#fbbf24', fontWeight: 700 }}>{msg.replyTo.sender}:</span> {msg.replyTo.text}
                    </div>
                  )}
                  <div
                    style={{
                      background: isMe ? 'linear-gradient(135deg, #DC0000, #B91C1C)' : '#1e293b',
                      borderRadius: msg.replyTo
                        ? isMe ? '0 0 4px 16px' : '0 0 16px 4px'
                        : isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                      padding: msg.photo ? '4px' : '10px 12px',
                      wordBreak: 'break-word',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      cursor: 'pointer',
                    }}
                    onDoubleClick={() => setReplyTo(msg)}
                    title="Double-click to reply"
                  >
                    {msg.photo && (
                      <img src={msg.photo} alt="photo" onClick={() => window.open(msg.photo, '_blank')}
                        style={{ width: '100%', maxWidth: 260, borderRadius: 10, display: 'block', cursor: 'zoom-in' }}/>
                    )}
                    {msg.text && <p style={{ fontSize: 13, margin: msg.photo ? '6px 8px 4px' : 0, lineHeight: 1.5 }}>{msg.text}</p>}
                    <p style={{ fontSize: 9, color: isMe ? 'rgba(255,255,255,0.6)' : '#64748b', margin: msg.photo ? '0 8px 4px' : '4px 0 0', textAlign: isMe ? 'right' : 'left' }}>
                      {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {/* Actions on hover */}
                  <div style={{ display: 'flex', gap: 4, marginTop: 3, justifyContent: isMe ? 'flex-end' : 'flex-start', flexWrap: 'wrap' }}>
                    <button onClick={() => setReplyTo(msg)}
                      style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 10, cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}>↩ Reply</button>
                    <button onClick={() => forwardToWA(msg)}
                      style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 10, cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}>📱 Forward</button>
                    {isMe && (
                      <button onClick={() => deleteMsg(msg.id)}
                        style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 10, cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}>🗑</button>
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
          <div style={{ padding: '8px 16px', background: '#0f172a', borderTop: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, borderLeft: '3px solid #DC0000', paddingLeft: 8 }}>
              <p style={{ color: '#fbbf24', fontSize: 11, fontWeight: 700, margin: 0 }}>{replyTo.sender} को reply</p>
              <p style={{ color: '#94a3b8', fontSize: 11, margin: '2px 0 0' }}>{replyTo.text?.slice(0, 80)}</p>
            </div>
            <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={16}/></button>
          </div>
        )}

        {/* Input */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #1e293b', background: '#0a0f1e', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          {/* Emoji */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowEmoji(e => !e)}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: '6px' }}>😊</button>
            {showEmoji && (
              <div style={{ position: 'absolute', bottom: '100%', left: 0, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 8, display: 'flex', flexWrap: 'wrap', gap: 4, width: 200, zIndex: 10, marginBottom: 6 }}>
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => { setInput(i => i + e); setShowEmoji(false); inputRef.current?.focus(); }}
                    style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: 2, borderRadius: 4 }}>{e}</button>
                ))}
              </div>
            )}
          </div>

          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Message type करें... (Enter to send, Shift+Enter for new line)"
            rows={1}
            style={{
              flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '10px 14px',
              color: '#fff', fontSize: 13, outline: 'none', resize: 'none', maxHeight: 120, overflowY: 'auto',
              lineHeight: 1.5,
            }}/>

          {/* Photo button */}
          <button onClick={sendPhoto} title="Photo भेजें"
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px', cursor: 'pointer', color: '#94a3b8' }}>
            <Image size={18}/>
          </button>

          {/* Send */}
          <button onClick={() => sendMsg()} disabled={!input.trim()}
            style={{ background: input.trim() ? 'linear-gradient(135deg, #DC0000, #B91C1C)' : '#1e293b', border: 'none', borderRadius: 10, padding: '10px 14px', cursor: input.trim() ? 'pointer' : 'not-allowed', color: '#fff' }}>
            <Send size={18}/>
          </button>
        </div>
      </div>
    </div>
  );
}
