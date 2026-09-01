// ════════════════════════════════════════════════════════════════════════════
// VisitorCounter.jsx — Showroom Leads (Lead CRM)
// ════════════════════════════════════════════════════════════════════════════
// पहले यह सिर्फ़ "कितने लोग आए" गिनने वाला page था — नाम, phone, purpose और
// एक "Convert" बटन. जो आया उसका आगे क्या हुआ, किसने बात की, कब दोबारा call
// करनी है — कुछ दर्ज नहीं होता था. इसलिए ज़्यादातर आए हुए ग्राहक भूल जाते थे.
//
// अब पूरा pipeline है:
//   नया → बात हुई → Quotation दिया → भाव-ताव → बिक गई / छूट गई
//
// हर चरण पर: कौन देख रहा है, क्या बात हुई, अगली call कब.
// "अगली call" की तारीख़ निकल जाए तो lead अपने आप ऊपर लाल में आ जाता है.
//
// पूरा डेटा MongoDB में (`visitors` collection) — पहले सिर्फ़ localStorage था.
// Internet न हो तो offline queue में रुकता है, आते ही चला जाता है.
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Phone, X, Search,
  MessageSquare, CheckCircle, Clock, ChevronDown, ChevronRight,
} from 'lucide-react';
import { api } from '../utils/apiConfig';
import { visibleInterval } from '../utils/pollControl';
import { loadAll, saveOne, updateOne, deleteOne } from '../utils/trackingStore';
import { recordVisitor, sendWhatsApp, buildCustomWA } from '../utils/smartUtils';

// ── Lead का सफ़र ─────────────────────────────────────────────────────────────
// क्रम बदलना हो तो सिर्फ़ यही array बदलें — बाक़ी पूरा page अपने आप ढल जाएगा
const STAGES = [
  { id:'new',         label:'नया',          icon:'🆕', color:'#3b82f6' },
  { id:'contacted',   label:'बात हुई',       icon:'📞', color:'#06b6d4' },
  { id:'quoted',      label:'Quotation',    icon:'📄', color:'#a855f7' },
  { id:'negotiating', label:'भाव-ताव',       icon:'🤝', color:'#f59e0b' },
  { id:'won',         label:'बिक गई',        icon:'✅', color:'#22c55e' },
  { id:'lost',        label:'छूट गई',        icon:'❌', color:'#ef4444' },
];
const stageOf = id => STAGES.find(s => s.id === id) || STAGES[0];
const OPEN_STAGES = ['new', 'contacted', 'quoted', 'negotiating'];

const LOST_REASONS = [
  'दाम ज़्यादा लगा', 'दूसरी company ली', 'दूसरे dealer से ली',
  'Finance नहीं हुआ', 'अभी टाल दिया', 'संपर्क नहीं हो रहा', 'अन्य',
];

const PURPOSES = ['Purchase', 'Service', 'General Inquiry', 'Spare Parts', 'Insurance'];

const todayISO = () => new Date().toISOString().split('T')[0];
const daysAgo = iso => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
const fmt = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' }) : '—';

const C = { bg:'#020617', border:'rgba(255,255,255,.09)', muted:'#94a3b8', dim:'#64748b' };

const box = {
  background:'linear-gradient(135deg, rgba(255,255,255,.045), rgba(255,255,255,.015))',
  border:`1px solid ${C.border}`, borderRadius:16, padding:16,
};
const fld = {
  background:'rgba(255,255,255,.05)', border:`1px solid ${C.border}`, borderRadius:10,
  padding:'10px 12px', color:'#fff', fontSize:13, width:'100%', outline:'none', boxSizing:'border-box',
};
const btn = (bg) => ({
  background:bg, border:'none', borderRadius:10, padding:'7px 11px', fontSize:11,
  fontWeight:700, color:'#fff', cursor:'pointer', display:'inline-flex',
  alignItems:'center', gap:5, whiteSpace:'nowrap', textDecoration:'none',
});

export default function VisitorCounter() {
  const navigate = useNavigate();

  const [leads,    setLeads]    = useState([]);
  const [staff,    setStaff]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [stageF,   setStageF]   = useState('open');   // open | all | <stage id>
  const [dateF,    setDateF]    = useState('month');  // today | week | month | all
  const [ownerF,   setOwnerF]   = useState('all');
  const [search,   setSearch]   = useState('');
  const [expanded, setExpanded] = useState(null);
  const [showAdd,  setShowAdd]  = useState(false);
  const [showFU,   setShowFU]   = useState(false);
  const [showLost, setShowLost] = useState(false);
  const [active,   setActive]   = useState(null);
  const [msg,      setMsg]      = useState('');

  const [form, setForm] = useState({
    name:'', phone:'', purpose:'Purchase', interestedModel:'',
    notes:'', handledBy:'', budget:'', source:'Walk-in',
  });
  const [fuForm, setFuForm] = useState({ note:'', outcome:'contacted', nextFollowUp:'' });
  const [lostForm, setLostForm] = useState({ reason:LOST_REASONS[0], note:'' });

  const me = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('vpSession') || localStorage.getItem('vpHondaUser') || '{}') || {}; }
    catch { return {}; }
  }, []);

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3000); };

  // ── Load ────────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const rows = await loadAll('visitors');
    setLeads(Array.isArray(rows) ? rows : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    (async () => {
      try { const r = await fetch(api('/api/staff')); if (r.ok) { const d = await r.json(); if (Array.isArray(d)) setStaff(d); } } catch {}
    })();
  // ⏱️ Render का कोटा: tab पीछे जाते ही polling रुक जाती है, सामने आते ही
  // एक बार तुरंत चलती है. यही सबसे बड़ी बचत है — service सो पाती है.
    const stopPoll = visibleInterval(refresh, 180000);   // 60s → 3 मिनट
    return stopPoll;
  }, [refresh]);

  // ── नया lead ────────────────────────────────────────────────────────────
  const addLead = async () => {
    if (!form.name.trim()) { window.alert('नाम लिखना ज़रूरी है'); return; }
    await recordVisitor({ ...form, stage:'new', handledBy: form.handledBy || me.name || '' });
    setForm({ name:'', phone:'', purpose:'Purchase', interestedModel:'', notes:'', handledBy:'', budget:'', source:'Walk-in' });
    setShowAdd(false);
    flash('✅ Lead जुड़ गया');
    refresh();
  };

  const quickAdd = async (purpose) => {
    await recordVisitor({ name:'Quick Entry', purpose, stage:'new', handledBy: me.name || '' });
    flash(`✅ ${purpose} — दर्ज हुआ`);
    refresh();
  };

  const idOf = l => l.localId || l.id || l._id;

  // ── चरण बदलो ────────────────────────────────────────────────────────────
  const moveStage = async (lead, stage) => {
    if (stage === 'lost') { setActive(lead); setLostForm({ reason:LOST_REASONS[0], note:'' }); setShowLost(true); return; }
    const patch = { stage };
    if (stage === 'won') { patch.converted = true; patch.convertedAt = new Date().toISOString(); }
    await updateOne('visitors', idOf(lead), patch);
    flash(`${stageOf(stage).icon} ${stageOf(stage).label}`);
    refresh();
  };

  const markLost = async () => {
    await updateOne('visitors', idOf(active), {
      stage:'lost', lostReason: lostForm.reason,
      followUps: [...(active.followUps || []), {
        date:new Date().toISOString(), note: lostForm.note || lostForm.reason,
        by: me.name || '', outcome:'lost',
      }],
    });
    setShowLost(false); setActive(null);
    flash('❌ छूट गई — कारण दर्ज हुआ');
    refresh();
  };

  // ── Follow-up दर्ज करो ───────────────────────────────────────────────────
  const saveFollowUp = async () => {
    const entry = {
      date:new Date().toISOString(), note: fuForm.note || '—',
      by: me.name || '', outcome: fuForm.outcome,
    };
    const patch = {
      followUps: [...(active.followUps || []), entry],
      nextFollowUp: fuForm.nextFollowUp || '',
    };
    // outcome से चरण अपने आप आगे बढ़े — हाथ से बदलना न पड़े
    if (fuForm.outcome === 'quoted')      patch.stage = 'quoted';
    else if (fuForm.outcome === 'negotiating') patch.stage = 'negotiating';
    else if (active.stage === 'new')      patch.stage = 'contacted';

    await updateOne('visitors', idOf(active), patch);
    setShowFU(false); setActive(null);
    setFuForm({ note:'', outcome:'contacted', nextFollowUp:'' });
    flash('✅ Follow-up दर्ज हुआ');
    refresh();
  };

  const assign = async (lead, name) => {
    await updateOne('visitors', idOf(lead), { handledBy: name });
    flash(name ? `👤 ${name} को सौंपा` : 'सौंपना हटाया');
    refresh();
  };

  const removeLead = async (lead) => {
    if (!window.confirm(`${lead.name} का record मिटाएँ?`)) return;
    await deleteOne('visitors', idOf(lead));
    flash('🗑️ मिटा दिया');
    refresh();
  };

  const waFollowUp = (lead) => {
    if (!lead.phone) { window.alert('Phone नहीं है'); return; }
    sendWhatsApp(lead.phone, buildCustomWA(
      `नमस्ते ${lead.name} जी 🙏`,
      `आप VP Honda showroom आए थे। आपकी ${lead.interestedModel || 'गाड़ी'} में रुचि के बारे में जानना चाहते थे।\n\n` +
      `कोई भी सवाल हो तो बेझिझक call करें: 📞 9713394738\n\nहम आपकी सेवा में हाज़िर हैं।`
    ));
  };

  // ── छाँटो ───────────────────────────────────────────────────────────────
  const overdueFU = l =>
    l.nextFollowUp && OPEN_STAGES.includes(l.stage || 'new') &&
    new Date(l.nextFollowUp) < new Date(todayISO());

  const filtered = useMemo(() => {
    const t = todayISO();
    return leads.filter(l => {
      const st = l.stage || (l.converted ? 'won' : 'new');
      if (stageF === 'open' && !OPEN_STAGES.includes(st)) return false;
      if (stageF !== 'open' && stageF !== 'all' && st !== stageF) return false;

      if (dateF !== 'all' && l.visitTime) {
        const d = daysAgo(l.visitTime);
        if (dateF === 'today' && !String(l.visitTime).startsWith(t)) return false;
        if (dateF === 'week'  && d > 7)  return false;
        if (dateF === 'month' && d > 30) return false;
      }
      if (ownerF === 'me'   && (l.handledBy || '') !== (me.name || '')) return false;
      if (ownerF === 'none' && l.handledBy) return false;
      if (ownerF !== 'all' && ownerF !== 'me' && ownerF !== 'none' && l.handledBy !== ownerF) return false;

      if (search) {
        const s = search.toLowerCase();
        if (![l.name, l.phone, l.interestedModel, l.notes, l.handledBy]
              .some(v => (v || '').toLowerCase().includes(s))) return false;
      }
      return true;
    }).sort((a, b) => {
      // जिनकी call की तारीख़ निकल चुकी — सबसे ऊपर
      const ao = overdueFU(a) ? 0 : 1, bo = overdueFU(b) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return new Date(b.visitTime || 0) - new Date(a.visitTime || 0);
    });
  }, [leads, stageF, dateF, ownerF, search, me]);

  // ── आँकड़े ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const t = todayISO();
    const in30 = leads.filter(l => l.visitTime && daysAgo(l.visitTime) <= 30);
    const won30 = in30.filter(l => (l.stage === 'won') || l.converted).length;
    const byStage = {};
    STAGES.forEach(s => { byStage[s.id] = leads.filter(l => (l.stage || (l.converted ? 'won' : 'new')) === s.id).length; });
    return {
      today: leads.filter(l => String(l.visitTime || '').startsWith(t)).length,
      open: leads.filter(l => OPEN_STAGES.includes(l.stage || 'new')).length,
      overdue: leads.filter(overdueFU).length,
      won30, in30: in30.length,
      rate: in30.length ? Math.round((won30 / in30.length) * 100) : 0,
      byStage,
    };
  }, [leads]);

  if (loading) return (
    <div style={{ background:C.bg, minHeight:'100vh', display:'grid', placeItems:'center' }}>
      <div style={{ textAlign:'center' }}>
        <img src="/logo.png" alt="VP Honda" width={70} height={70}
          style={{ width:70, height:70, objectFit:'contain', animation:'lp 1.3s ease-in-out infinite' }}/>
        <p style={{ color:C.dim, fontSize:12, fontWeight:700, marginTop:12 }}>Leads लोड हो रहे हैं…</p>
      </div>
      <style>{`@keyframes lp{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.92)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding:16, background:C.bg, minHeight:'100vh', color:'#fff' }}>
      <style>{`
        .lg { display:grid; gap:10px; grid-template-columns:repeat(auto-fit,minmax(104px,1fr)); }
        @media (prefers-reduced-motion: reduce){*{animation:none!important}}
      `}</style>

      {/* HEADER */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontSize:21, fontWeight:800, margin:0, display:'flex', alignItems:'center', gap:8 }}>
            <Users size={21}/> Showroom Leads
          </h1>
          <p style={{ color:C.dim, fontSize:11.5, margin:'3px 0 0' }}>
            जो आया उसका आगे क्या हुआ — पूरा हिसाब
          </p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {msg && <span style={{ fontSize:11, fontWeight:700, color:'#4ade80', background:'rgba(74,222,128,.1)', border:'1px solid rgba(74,222,128,.25)', padding:'4px 10px', borderRadius:20 }}>{msg}</span>}
          <button onClick={() => setShowAdd(true)} style={{ ...btn('linear-gradient(135deg,#DC0000,#991b1b)'), padding:'9px 14px', fontSize:12 }}>
            <UserPlus size={14}/> नया Lead
          </button>
        </div>
      </div>

      {/* एक-tap entry */}
      <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:14 }}>
        <span style={{ color:C.dim, fontSize:11, fontWeight:700, alignSelf:'center' }}>तुरंत दर्ज:</span>
        {PURPOSES.slice(0, 3).map(p => (
          <button key={p} onClick={() => quickAdd(p)} style={btn('rgba(255,255,255,.06)')}>+ {p}</button>
        ))}
      </div>

      {/* ═══ आँकड़े ═══ */}
      <div className="lg" style={{ marginBottom:12 }}>
        {[
          { l:'आज आए',       v:stats.today,   c:'#3b82f6', go:() => { setDateF('today'); setStageF('all'); } },
          { l:'चालू leads',   v:stats.open,    c:'#f59e0b', go:() => { setStageF('open'); setDateF('all'); } },
          { l:'call बाक़ी',   v:stats.overdue, c:'#ef4444', go:() => { setStageF('open'); setDateF('all'); } },
          { l:'बिकीं (30द)',  v:stats.won30,   c:'#22c55e', go:() => { setStageF('won'); setDateF('month'); } },
          { l:'सफलता दर',     v:`${stats.rate}%`, c:'#a855f7', go:() => {} },
        ].map(s => (
          <button key={s.l} onClick={s.go} style={{
            background:`linear-gradient(135deg,${s.c}18,${s.c}06)`, border:`1px solid ${s.c}30`,
            borderRadius:14, padding:'11px 9px', textAlign:'center', cursor:'pointer', color:'#fff', font:'inherit',
          }}>
            <div style={{ fontSize:20, fontWeight:900, color:s.c, lineHeight:1 }}>{s.v}</div>
            <div style={{ fontSize:10, color:C.muted, fontWeight:700, marginTop:3 }}>{s.l}</div>
          </button>
        ))}
      </div>

      {/* ═══ Pipeline — हर चरण में कितने ═══ */}
      <div style={{ ...box, padding:12, marginBottom:12 }}>
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>
          <button onClick={() => setStageF('open')} style={{
            ...btn(stageF === 'open' ? '#334155' : 'rgba(255,255,255,.05)'), padding:'7px 12px', fontSize:11.5,
          }}>सब चालू ({stats.open})</button>
          {STAGES.map(s => (
            <button key={s.id} onClick={() => setStageF(s.id)} style={{
              ...btn(stageF === s.id ? s.color : 'rgba(255,255,255,.05)'),
              padding:'7px 12px', fontSize:11.5,
              border:`1px solid ${stageF === s.id ? s.color : 'rgba(255,255,255,.08)'}`,
            }}>
              {s.icon} {s.label}
              <span style={{ background:'rgba(0,0,0,.3)', borderRadius:9, padding:'1px 6px', fontSize:10, fontWeight:900 }}>
                {stats.byStage[s.id] || 0}
              </span>
            </button>
          ))}
          <button onClick={() => setStageF('all')} style={{
            ...btn(stageF === 'all' ? '#334155' : 'rgba(255,255,255,.05)'), padding:'7px 12px', fontSize:11.5,
          }}>सभी ({leads.length})</button>
        </div>
      </div>

      {/* ═══ खोज + छँटाई ═══ */}
      <div style={{ display:'grid', gap:8, gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', marginBottom:14 }}>
        <div style={{ position:'relative', gridColumn:'1 / -1' }}>
          <Search size={14} color={C.dim} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="नाम, phone, मॉडल या नोट खोजें…" style={{ ...fld, paddingLeft:34 }}/>
        </div>
        <select value={dateF} onChange={e => setDateF(e.target.value)} style={fld} aria-label="कब आए">
          <option value="today">आज</option>
          <option value="week">इस हफ़्ते</option>
          <option value="month">इस महीने</option>
          <option value="all">सभी</option>
        </select>
        <select value={ownerF} onChange={e => setOwnerF(e.target.value)} style={fld} aria-label="किसके पास">
          <option value="all">सभी staff</option>
          <option value="me">सिर्फ़ मेरे</option>
          <option value="none">किसी को नहीं सौंपे</option>
          {staff.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
        </select>
      </div>

      {/* ═══ Lead cards ═══ */}
      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'56px 20px' }}>
          <Users size={38} color="#334155" style={{ marginBottom:12 }}/>
          <p style={{ color:'#f1f5f9', fontWeight:800, fontSize:16, margin:'0 0 5px' }}>कोई lead नहीं मिला</p>
          <p style={{ color:C.dim, fontSize:12.5, margin:0 }}>छँटाई बदलकर देखें, या ऊपर से नया lead जोड़ें।</p>
        </div>
      ) : (
        <>
          <p style={{ color:'#334155', fontSize:11, marginBottom:9, fontWeight:600 }}>
            {filtered.length} leads{stats.overdue > 0 && stageF === 'open' ? ` · ${stats.overdue} की call बाक़ी है` : ''}
          </p>
          <div style={{ display:'grid', gap:10 }}>
            {filtered.map(l => {
              const st  = stageOf(l.stage || (l.converted ? 'won' : 'new'));
              const od  = overdueFU(l);
              const opn = expanded === idOf(l);
              const fus = l.followUps || [];
              return (
                <div key={idOf(l)} style={{
                  ...box, padding:0, overflow:'hidden',
                  border:`1px solid ${od ? 'rgba(239,68,68,.42)' : C.border}`,
                  background: od ? 'linear-gradient(135deg,rgba(127,29,29,.18),rgba(10,16,30,.97))' : box.background,
                }}>
                  {/* सिर */}
                  <div onClick={() => setExpanded(opn ? null : idOf(l))}
                    style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:11, cursor:'pointer' }}>
                    <div style={{ width:34, height:34, borderRadius:'50%', background:`${st.color}28`, border:`1px solid ${st.color}66`, display:'grid', placeItems:'center', fontSize:15, flexShrink:0 }}>
                      {st.icon}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:800, fontSize:14 }}>{l.name || 'बिना नाम'}</span>
                        <span style={{ background:`${st.color}1c`, border:`1px solid ${st.color}55`, color:st.color, fontSize:9.5, fontWeight:800, padding:'1px 8px', borderRadius:20 }}>
                          {st.label}
                        </span>
                        {od && <span style={{ background:'rgba(239,68,68,.16)', border:'1px solid rgba(239,68,68,.42)', color:'#fca5a5', fontSize:9.5, fontWeight:800, padding:'1px 8px', borderRadius:20 }}>
                          🔴 call {fmt(l.nextFollowUp)} को थी
                        </span>}
                        {fus.length > 0 && <span style={{ color:C.dim, fontSize:9.5, fontWeight:700 }}>📞 {fus.length}</span>}
                      </div>
                      <div style={{ color:C.dim, fontSize:10.5, marginTop:2 }}>
                        {l.phone ? `📞 ${l.phone}` : 'phone नहीं'}
                        {l.interestedModel ? ` · 🏍 ${l.interestedModel}` : ''}
                        {l.handledBy ? ` · 👤 ${l.handledBy}` : ' · किसी को नहीं सौंपा'}
                        {l.visitTime ? ` · ${daysAgo(l.visitTime)} दिन पहले` : ''}
                      </div>
                    </div>
                    {opn ? <ChevronDown size={16} color={C.dim}/> : <ChevronRight size={16} color={C.dim}/>}
                  </div>

                  {opn && (
                    <div style={{ padding:'0 14px 14px', borderTop:`1px solid ${C.border}` }}>
                      {(l.notes || l.budget || l.purpose) && (
                        <p style={{ color:C.muted, fontSize:11.5, margin:'11px 0 0' }}>
                          {l.purpose ? `उद्देश्य: ${l.purpose}` : ''}
                          {l.budget ? ` · बजट: ₹${Number(l.budget).toLocaleString('en-IN')}` : ''}
                          {l.notes ? ` · ${l.notes}` : ''}
                        </p>
                      )}
                      {l.lostReason && (
                        <p style={{ color:'#fca5a5', fontSize:11.5, margin:'8px 0 0' }}>❌ कारण: {l.lostReason}</p>
                      )}

                      {/* चरण बदलो */}
                      <div style={{ marginTop:12 }}>
                        <div style={{ color:C.dim, fontSize:10, fontWeight:700, marginBottom:5 }}>चरण बदलें</div>
                        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                          {STAGES.map(s => (
                            <button key={s.id} onClick={() => moveStage(l, s.id)} disabled={s.id === st.id}
                              style={{
                                ...btn(s.id === st.id ? s.color : 'rgba(255,255,255,.05)'),
                                opacity: s.id === st.id ? 1 : .85,
                                cursor: s.id === st.id ? 'default' : 'pointer',
                                border:`1px solid ${s.id === st.id ? s.color : 'rgba(255,255,255,.09)'}`,
                              }}>
                              {s.icon} {s.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* काम */}
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:12 }}>
                        {l.phone && <a href={`tel:${l.phone}`} style={btn('linear-gradient(135deg,#16a34a,#15803d)')}><Phone size={11}/> Call</a>}
                        {l.phone && <button onClick={() => waFollowUp(l)} style={btn('linear-gradient(135deg,#059669,#047857)')}><MessageSquare size={11}/> WhatsApp</button>}
                        <button onClick={() => { setActive(l); setFuForm({ note:'', outcome: l.stage === 'new' ? 'contacted' : (l.stage || 'contacted'), nextFollowUp:'' }); setShowFU(true); }}
                          style={btn('linear-gradient(135deg,#7c3aed,#6d28d9)')}>
                          <Clock size={11}/> Follow-up दर्ज करें
                        </button>
                        {st.id === 'won' && (
                          <button onClick={() => navigate('/new-customers')} style={btn('linear-gradient(135deg,#0284c7,#0369a1)')}>
                            <CheckCircle size={11}/> ग्राहक बनाएँ
                          </button>
                        )}
                        <select value={l.handledBy || ''} onChange={e => assign(l, e.target.value)}
                          style={{ ...fld, width:'auto', padding:'6px 9px', fontSize:11 }} aria-label="किसे सौंपें">
                          <option value="">किसे सौंपें…</option>
                          <option value={me.name || ''}>मुझे — {me.name || 'मैं'}</option>
                          {staff.filter(s => s.name !== me.name).map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
                        </select>
                        <button onClick={() => removeLead(l)} style={btn('linear-gradient(135deg,#7f1d1d,#991b1b)')}>
                          <X size={11}/> मिटाएँ
                        </button>
                      </div>

                      {/* बातचीत का इतिहास */}
                      {fus.length > 0 && (
                        <div style={{ marginTop:12, background:'rgba(0,0,0,.28)', borderRadius:12, padding:11, border:`1px solid ${C.border}` }}>
                          <div style={{ color:C.dim, fontSize:10, fontWeight:700, marginBottom:7 }}>बातचीत का इतिहास</div>
                          {fus.slice().reverse().map((f, i) => (
                            <div key={i} style={{ display:'flex', gap:9, padding:'5px 0', borderBottom: i < fus.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                              <span style={{ color:'#334155', fontSize:9.5, minWidth:56, flexShrink:0 }}>{fmt(f.date)}</span>
                              <div style={{ flex:1 }}>
                                <span style={{ color:stageOf(f.outcome).color, fontSize:10, fontWeight:800 }}>
                                  {stageOf(f.outcome).icon} {stageOf(f.outcome).label}
                                </span>
                                {f.note && f.note !== '—' && <div style={{ color:C.muted, fontSize:10.5, marginTop:1 }}>💬 {f.note}</div>}
                                {f.by && <div style={{ color:'#334155', fontSize:9 }}>— {f.by}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {l.nextFollowUp && !od && (
                        <p style={{ color:'#fdba74', fontSize:10.5, margin:'9px 0 0' }}>📅 अगली call: {fmt(l.nextFollowUp)}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ══ नया Lead ══ */}
      {showAdd && (
        <Modal title="👤 नया Lead" onClose={() => setShowAdd(false)}>
          <div style={{ display:'grid', gap:10 }}>
            <Field label="नाम *"><input value={form.name} onChange={e => setForm(f => ({ ...f, name:e.target.value }))} placeholder="ग्राहक का नाम" style={fld}/></Field>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
              <Field label="Phone"><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone:e.target.value }))} placeholder="10 अंक" style={fld}/></Field>
              <Field label="उद्देश्य">
                <select value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose:e.target.value }))} style={fld}>
                  {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
              <Field label="कौन सी गाड़ी"><input value={form.interestedModel} onChange={e => setForm(f => ({ ...f, interestedModel:e.target.value }))} placeholder="जैसे Shine 100" style={fld}/></Field>
              <Field label="बजट (₹)"><input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget:e.target.value }))} placeholder="वैकल्पिक" style={fld}/></Field>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
              <Field label="कहाँ से आया">
                <select value={form.source} onChange={e => setForm(f => ({ ...f, source:e.target.value }))} style={fld}>
                  {['Walk-in','Phone','WhatsApp','जान-पहचान','Facebook','अन्य'].map(x => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="किसे सौंपें">
                <select value={form.handledBy} onChange={e => setForm(f => ({ ...f, handledBy:e.target.value }))} style={fld}>
                  <option value="">किसी को नहीं</option>
                  <option value={me.name || ''}>मुझे — {me.name || 'मैं'}</option>
                  {staff.filter(s => s.name !== me.name).map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="टिप्पणी"><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes:e.target.value }))} rows={2} placeholder="क्या बात हुई…" style={{ ...fld, resize:'vertical' }}/></Field>
          </div>
          <Actions onCancel={() => setShowAdd(false)} onOk={addLead} okLabel="जोड़ें"/>
        </Modal>
      )}

      {/* ══ Follow-up ══ */}
      {showFU && active && (
        <Modal title="📞 Follow-up दर्ज करें" sub={`${active.name}${active.phone ? ` · ${active.phone}` : ''}`} onClose={() => setShowFU(false)}>
          <Field label="क्या हुआ?">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(112px,1fr))', gap:7 }}>
              {STAGES.filter(s => s.id !== 'lost').map(s => (
                <button key={s.id} onClick={() => setFuForm(f => ({ ...f, outcome:s.id }))} style={{
                  background: fuForm.outcome === s.id ? s.color : 'rgba(255,255,255,.05)',
                  border:`1px solid ${fuForm.outcome === s.id ? s.color : C.border}`,
                  color:'#fff', borderRadius:10, padding:'9px 7px', fontSize:11, fontWeight:700, cursor:'pointer',
                }}>{s.icon} {s.label}</button>
              ))}
            </div>
          </Field>
          <Field label="क्या बात हुई">
            <textarea value={fuForm.note} onChange={e => setFuForm(f => ({ ...f, note:e.target.value }))} rows={2}
              placeholder="ग्राहक ने क्या कहा…" style={{ ...fld, resize:'vertical' }}/>
          </Field>
          <Field label="अगली call कब? (वैकल्पिक)">
            <input type="date" value={fuForm.nextFollowUp} onChange={e => setFuForm(f => ({ ...f, nextFollowUp:e.target.value }))} style={fld}/>
          </Field>
          <p style={{ color:C.dim, fontSize:10.5, margin:'6px 0 0' }}>
            तारीख़ डालेंगे तो वह दिन निकलते ही यह lead अपने आप ऊपर लाल में आ जाएगा।
          </p>
          <Actions onCancel={() => setShowFU(false)} onOk={saveFollowUp} okLabel="सेव करें" okBg="linear-gradient(135deg,#7c3aed,#6d28d9)"/>
        </Modal>
      )}

      {/* ══ छूट गई ══ */}
      {showLost && active && (
        <Modal title="❌ छूट गई" sub={active.name} onClose={() => setShowLost(false)}>
          <Field label="क्यों छूटी?">
            <select value={lostForm.reason} onChange={e => setLostForm(f => ({ ...f, reason:e.target.value }))} style={fld}>
              {LOST_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="और कुछ">
            <textarea value={lostForm.note} onChange={e => setLostForm(f => ({ ...f, note:e.target.value }))} rows={2} style={{ ...fld, resize:'vertical' }}/>
          </Field>
          <p style={{ color:C.dim, fontSize:10.5, margin:'6px 0 0' }}>
            कारण दर्ज होने से पता चलता रहेगा कि सबसे ज़्यादा ग्राहक किस वजह से छूट रहे हैं।
          </p>
          <Actions onCancel={() => setShowLost(false)} onOk={markLost} okLabel="दर्ज करें" okBg="linear-gradient(135deg,#b91c1c,#991b1b)"/>
        </Modal>
      )}
    </div>
  );
}

// ── छोटे साझा टुकड़े ─────────────────────────────────────────────────────────
function Modal({ title, sub, onClose, children }) {
  useEffect(() => {
    // Back बटन modal बंद करे, पूरा page नहीं
    window.history.pushState({ vpOverlay:true }, '');
    const onPop = () => onClose();
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (window.history.state?.vpOverlay) window.history.back();
    };
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.88)', backdropFilter:'blur(8px)',
      zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'linear-gradient(135deg,#1e293b,#0f172a)', border:`1px solid ${C.border}`,
        borderRadius:20, width:'100%', maxWidth:470, padding:20, maxHeight:'90vh', overflowY:'auto',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:sub ? 4 : 14 }}>
          <h3 style={{ color:'#f1f5f9', fontWeight:800, fontSize:16, margin:0 }}>{title}</h3>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.06)', border:'none', borderRadius:'50%', width:30, height:30, color:C.muted, cursor:'pointer' }}>
            <X size={15}/>
          </button>
        </div>
        {sub && <p style={{ color:C.dim, fontSize:11.5, margin:'0 0 14px' }}>{sub}</p>}
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:2 }}>
      <label style={{ color:C.muted, fontSize:11, fontWeight:700, display:'block', marginBottom:5 }}>{label}</label>
      {children}
    </div>
  );
}

function Actions({ onCancel, onOk, okLabel, okBg = 'linear-gradient(135deg,#059669,#047857)' }) {
  return (
    <div style={{ display:'flex', gap:9, marginTop:16 }}>
      <button onClick={onCancel} style={{ flex:1, background:'rgba(255,255,255,.04)', border:`1px solid ${C.border}`, borderRadius:12, padding:11, color:C.muted, fontSize:12, fontWeight:700, cursor:'pointer' }}>
        रद्द करें
      </button>
      <button onClick={onOk} style={{ flex:1, background:okBg, border:'none', borderRadius:12, padding:11, color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer' }}>
        {okLabel}
      </button>
    </div>
  );
}
