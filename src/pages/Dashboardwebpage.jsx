import { useState, useEffect, useRef } from 'react';

const HONDA_RED = '#CC0000';
const DARK = '#1a1a2e';

const bikes = [
  { name:'Activa 6G', type:'Scooter', price:'₹76,457', tag:'Best Seller', img:'🛵', desc:'India\'s favourite scooter with Honda\'s trusted engine' },
  { name:'Activa 125', type:'Scooter', price:'₹80,668', tag:'Premium', img:'🛵', desc:'125cc power with disc brake & LED headlamp' },
  { name:'Dio 125', type:'Scooter', price:'₹73,797', tag:'Sporty', img:'🛵', desc:'Bold design, digital meter, H-Smart key' },
  { name:'SP 125', type:'Motorcycle', price:'₹86,017', tag:'Popular', img:'🏍️', desc:'125cc OBD2 engine, 5 speed, great mileage' },
  { name:'Shine 125', type:'Motorcycle', price:'₹82,279', tag:'Trusted', img:'🏍️', desc:'India\'s most trusted 125cc motorcycle' },
  { name:'Shine 100', type:'Motorcycle', price:'₹70,880', tag:'Value', img:'🏍️', desc:'100cc commuter, best-in-class mileage' },
  { name:'Unicorn', type:'Motorcycle', price:'₹1,12,715', tag:'Premium', img:'🏍️', desc:'160cc refined engine, smooth ride' },
  { name:'Hornet 2.0', type:'Motorcycle', price:'₹1,30,248', tag:'Sport', img:'🏍️', desc:'184cc, aggressive design, premium feel' },
  { name:'Livo', type:'Motorcycle', price:'₹78,799', tag:'Reliable', img:'🏍️', desc:'110cc reliable commuter bike' },
  { name:'Activa e:', type:'EV', price:'Coming Soon', tag:'Electric', img:'⚡', desc:'Honda\'s first electric scooter for India' },
  { name:'QC1', type:'EV', price:'Coming Soon', tag:'Electric', img:'⚡', desc:'Quick charge, smart connectivity' },
  { name:'CB200X', type:'Motorcycle', price:'₹1,47,342', tag:'Adventure', img:'🏍️', desc:'200cc adventure tourer' },
];

const services = [
  { icon:'🔧', title:'Free Service', desc:'1st, 2nd, 3rd free service with genuine parts' },
  { icon:'🛢️', title:'Engine Oil Change', desc:'Honda genuine oil for best performance' },
  { icon:'🔋', title:'Battery Check', desc:'Free battery health check & replacement' },
  { icon:'🎨', title:'Denting & Painting', desc:'Expert body repair & paint jobs' },
  { icon:'📋', title:'Periodic Maintenance', desc:'Complete vehicle checkup at regular intervals' },
  { icon:'🛞', title:'Tyre & Brake Service', desc:'Genuine Honda tyres & brake service' },
];

export default function CustomerDashboard() {
  const [activeSection, setActiveSection] = useState('home');
  const [filter, setFilter] = useState('All');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsgs, setChatMsgs] = useState([
    { from:'bot', text:'🏍️ VP Honda, Bhopal में आपका स्वागत है! मैं आपकी कैसे मदद कर सकता हूँ?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [enquiry, setEnquiry] = useState({ name:'', phone:'', vehicle:'', msg:'' });
  const chatEndRef = useRef(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const fn = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [chatMsgs]);

  const sendChat = () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatMsgs(p => [...p, { from:'user', text:msg }]);
    setChatInput('');
    setTimeout(() => {
      let reply = '🙏 धन्यवाद! हमारी टीम जल्द आपसे संपर्क करेगी। Call: 9713394738';
      const lo = msg.toLowerCase();
      if (lo.includes('price') || lo.includes('कीमत') || lo.includes('rate')) reply = '📋 Current price list के लिए showroom visit करें या call करें: 9713394738';
      else if (lo.includes('service') || lo.includes('सर्विस')) reply = '🔧 Service booking: 9340985435 | Timing: 9AM-6PM Mon-Sat';
      else if (lo.includes('offer') || lo.includes('ऑफर')) reply = '🎉 Current offers: Low down payment, easy EMI, exchange bonus! Visit showroom for details.';
      else if (lo.includes('address') || lo.includes('location') || lo.includes('पता')) reply = '📍 Narsinghgarh Road, Parwaliya Sadak, Bhopal MP 462030';
      else if (lo.includes('emi') || lo.includes('finance') || lo.includes('लोन')) reply = '🏦 Easy finance available: HDFC, Jana Small Finance, BOI | Low EMI from ₹1,999/month';
      else if (lo.includes('activa') || lo.includes('shine') || lo.includes('sp125')) reply = `🏍️ ${msg} available at VP Honda! Visit showroom for test ride. Call: 9713394738`;
      setChatMsgs(p => [...p, { from:'bot', text:reply }]);
    }, 800);
  };

  const submitEnquiry = () => {
    if (!enquiry.name || !enquiry.phone) { alert('Name और Phone भरें'); return; }
    const all = JSON.parse(localStorage.getItem('vpEnquiries')||'[]');
    all.push({ ...enquiry, date: new Date().toISOString() });
    localStorage.setItem('vpEnquiries', JSON.stringify(all));
    alert('✅ Thank you! हमारी टीम जल्द संपर्क करेगी।');
    setEnquiry({ name:'', phone:'', vehicle:'', msg:'' }); setEnquiryOpen(false);
  };

  const filtered = filter === 'All' ? bikes : bikes.filter(b => b.type === filter);

  return (
    <div style={{ fontFamily:"'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", background:'#fff', color:'#222', minHeight:'100vh' }}>
      
      {/* ═══ NAVBAR ═══ */}
      <nav style={{
        position:'fixed', top:0, left:0, right:0, zIndex:100,
        background: scrollY > 50 ? 'rgba(255,255,255,0.97)' : 'transparent',
        boxShadow: scrollY > 50 ? '0 2px 20px rgba(0,0,0,0.1)' : 'none',
        transition:'all 0.3s', padding:'0 24px',
      }}>
        <div style={{ maxWidth:1200, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:64 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ background:HONDA_RED, color:'#fff', fontWeight:900, fontSize:20, padding:'6px 14px', borderRadius:6 }}>VP</div>
            <div>
              <div style={{ fontWeight:800, fontSize:18, color: scrollY>50?'#1a1a2e':'#fff', lineHeight:1 }}>V P HONDA</div>
              <div style={{ fontSize:10, color: scrollY>50?'#888':'rgba(255,255,255,0.7)', letterSpacing:1 }}>AUTHORIZED DEALER · BHOPAL</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:24, alignItems:'center' }}>
            {['Home','Products','Services','About','Contact'].map(s => (
              <a key={s} href={`#${s.toLowerCase()}`} style={{ color: scrollY>50?'#333':'#fff', fontWeight:600, fontSize:13, textDecoration:'none', letterSpacing:0.5, cursor:'pointer' }}
                onMouseEnter={e=>e.target.style.color=HONDA_RED} onMouseLeave={e=>e.target.style.color=scrollY>50?'#333':'#fff'}>
                {s}
              </a>
            ))}
            <button onClick={()=>setEnquiryOpen(true)} style={{ background:HONDA_RED, color:'#fff', border:'none', padding:'8px 20px', borderRadius:6, fontWeight:700, fontSize:13, cursor:'pointer' }}>
              Book Test Ride
            </button>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section id="home" style={{
        background:`linear-gradient(135deg, ${DARK} 0%, #16213e 50%, ${HONDA_RED} 100%)`,
        minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden',
        padding:'100px 24px 60px',
      }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 30% 50%, rgba(204,0,0,0.15), transparent 60%)', pointerEvents:'none' }}/>
        <div style={{ maxWidth:1200, margin:'0 auto', display:'flex', alignItems:'center', gap:60, width:'100%', position:'relative', zIndex:1, flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:300 }}>
            <div style={{ display:'inline-block', background:'rgba(204,0,0,0.2)', border:'1px solid rgba(204,0,0,0.4)', borderRadius:20, padding:'4px 16px', marginBottom:16 }}>
              <span style={{ color:'#ff6b6b', fontSize:12, fontWeight:700, letterSpacing:1 }}>🏍️ HONDA AUTHORIZED DEALER</span>
            </div>
            <h1 style={{ color:'#fff', fontSize:'clamp(32px,5vw,56px)', fontWeight:900, lineHeight:1.1, margin:'0 0 16px' }}>
              V P Honda<br/>
              <span style={{ color:HONDA_RED }}>Bhopal</span>
            </h1>
            <p style={{ color:'rgba(255,255,255,0.7)', fontSize:16, lineHeight:1.6, maxWidth:500, margin:'0 0 32px' }}>
              Honda Motorcycle & Scooter India Pvt. Ltd. का authorized dealership। 
              Best price, genuine service, easy finance।
            </p>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <a href="#products" style={{ background:HONDA_RED, color:'#fff', padding:'14px 32px', borderRadius:8, fontWeight:700, fontSize:15, textDecoration:'none', display:'inline-block' }}>
                View Products →
              </a>
              <a href="tel:9713394738" style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', padding:'14px 32px', borderRadius:8, fontWeight:700, fontSize:15, textDecoration:'none' }}>
                📞 9713394738
              </a>
            </div>
            <div style={{ display:'flex', gap:32, marginTop:40 }}>
              {[['500+','Vehicles Sold'],['10+','Years Experience'],['4.5★','Google Rating']].map(([v,l],i)=>(
                <div key={i}><div style={{ color:'#fff', fontWeight:900, fontSize:28 }}>{v}</div><div style={{ color:'rgba(255,255,255,0.5)', fontSize:11 }}>{l}</div></div>
              ))}
            </div>
          </div>
          <div style={{ flex:1, minWidth:280, textAlign:'center' }}>
            <div style={{ fontSize:180, lineHeight:1, filter:'drop-shadow(0 20px 40px rgba(204,0,0,0.3))' }}>🏍️</div>
            <div style={{ color:'rgba(255,255,255,0.3)', fontSize:13, marginTop:8 }}>HONDA — The Power of Dreams</div>
          </div>
        </div>
      </section>

      {/* ═══ PRODUCTS ═══ */}
      <section id="products" style={{ padding:'80px 24px', background:'#f8f9fa' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:40 }}>
            <h2 style={{ fontSize:36, fontWeight:900, color:DARK }}>Our <span style={{ color:HONDA_RED }}>Products</span></h2>
            <p style={{ color:'#666', fontSize:15, marginTop:8 }}>Honda Two Wheeler — Latest Models Available</p>
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:32, flexWrap:'wrap' }}>
            {['All','Motorcycle','Scooter','EV'].map(f => (
              <button key={f} onClick={()=>setFilter(f)} style={{
                padding:'8px 24px', borderRadius:20, border:'2px solid', fontWeight:700, fontSize:13, cursor:'pointer',
                background: filter===f ? HONDA_RED : '#fff', color: filter===f ? '#fff' : '#666',
                borderColor: filter===f ? HONDA_RED : '#ddd',
              }}>{f}</button>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:20 }}>
            {filtered.map((b,i) => (
              <div key={i} style={{
                background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.08)',
                transition:'transform 0.3s, box-shadow 0.3s', cursor:'pointer',
              }} onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-6px)';e.currentTarget.style.boxShadow='0 12px 40px rgba(204,0,0,0.15)';}}
                 onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,0.08)';}}>
                <div style={{ background:'linear-gradient(135deg, #f0f0f0, #e8e8e8)', padding:'32px 20px', textAlign:'center', position:'relative' }}>
                  <span style={{ position:'absolute', top:12, left:12, background: b.tag==='Electric'?'#10b981':b.tag==='Best Seller'?HONDA_RED:'#f59e0b', color:'#fff', padding:'3px 10px', borderRadius:12, fontSize:10, fontWeight:700 }}>{b.tag}</span>
                  <div style={{ fontSize:64 }}>{b.img}</div>
                </div>
                <div style={{ padding:'16px 20px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <h3 style={{ fontWeight:800, fontSize:17, color:DARK, margin:0 }}>{b.name}</h3>
                    <span style={{ color: b.type==='EV'?'#10b981':HONDA_RED, fontWeight:800, fontSize:14 }}>{b.price}</span>
                  </div>
                  <p style={{ color:'#888', fontSize:12, marginTop:6, lineHeight:1.4 }}>{b.desc}</p>
                  <div style={{ display:'flex', gap:8, marginTop:12 }}>
                    <button onClick={()=>setEnquiryOpen(true)} style={{ flex:1, background:HONDA_RED, color:'#fff', border:'none', padding:'8px', borderRadius:6, fontWeight:700, fontSize:12, cursor:'pointer' }}>Enquire Now</button>
                    <a href="tel:9713394738" style={{ flex:1, background:'#f0f0f0', color:'#333', border:'none', padding:'8px', borderRadius:6, fontWeight:700, fontSize:12, textDecoration:'none', textAlign:'center', cursor:'pointer' }}>📞 Call</a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ OFFERS ═══ */}
      <section style={{ padding:'60px 24px', background:`linear-gradient(135deg, ${HONDA_RED}, #8b0000)` }}>
        <div style={{ maxWidth:1200, margin:'0 auto', textAlign:'center' }}>
          <h2 style={{ color:'#fff', fontSize:32, fontWeight:900 }}>🎉 Special Offers</h2>
          <p style={{ color:'rgba(255,255,255,0.8)', fontSize:15, marginTop:8 }}>Limited period offers — Visit VP Honda Bhopal today!</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:20, marginTop:32 }}>
            {[
              { icon:'💰', title:'Low Down Payment', desc:'Starting ₹4,999 only' },
              { icon:'📊', title:'Easy EMI', desc:'EMI from ₹1,999/month' },
              { icon:'🔄', title:'Exchange Bonus', desc:'Extra ₹5,000 on exchange' },
              { icon:'🎁', title:'Free Accessories', desc:'Helmet, lock & insurance' },
            ].map((o,i) => (
              <div key={i} style={{ background:'rgba(255,255,255,0.1)', backdropFilter:'blur(10px)', borderRadius:16, padding:24, border:'1px solid rgba(255,255,255,0.2)' }}>
                <div style={{ fontSize:40 }}>{o.icon}</div>
                <h3 style={{ color:'#fff', fontWeight:800, fontSize:16, marginTop:8 }}>{o.title}</h3>
                <p style={{ color:'rgba(255,255,255,0.7)', fontSize:13, marginTop:4 }}>{o.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SERVICES ═══ */}
      <section id="services" style={{ padding:'80px 24px', background:'#fff' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:40 }}>
            <h2 style={{ fontSize:36, fontWeight:900, color:DARK }}>Our <span style={{ color:HONDA_RED }}>Services</span></h2>
            <p style={{ color:'#666', fontSize:15, marginTop:8 }}>Genuine Honda service with trained technicians</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:20 }}>
            {services.map((s,i) => (
              <div key={i} style={{ display:'flex', gap:16, padding:20, borderRadius:12, border:'1px solid #eee', background:'#fafafa', alignItems:'flex-start' }}>
                <div style={{ fontSize:36, flexShrink:0 }}>{s.icon}</div>
                <div>
                  <h3 style={{ fontWeight:800, fontSize:16, color:DARK, margin:0 }}>{s.title}</h3>
                  <p style={{ color:'#888', fontSize:13, marginTop:4 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ABOUT ═══ */}
      <section id="about" style={{ padding:'80px 24px', background:'#f8f9fa' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', display:'flex', gap:48, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:300 }}>
            <h2 style={{ fontSize:36, fontWeight:900, color:DARK }}>About <span style={{ color:HONDA_RED }}>VP Honda</span></h2>
            <p style={{ color:'#555', fontSize:15, lineHeight:1.8, marginTop:16 }}>
              VP Honda, Bhopal — Honda Motorcycle & Scooter India Pvt. Ltd. का authorized dealership है। 
              हम 10+ सालों से Bhopal और आसपास के क्षेत्रों में Honda two-wheelers की sales और service कर रहे हैं।
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:24 }}>
              {[['🏆 Authorized','Honda HMSI Dealer'],['🔧 Expert Service','Trained Technicians'],['💯 Genuine Parts','100% Honda Original'],['🏍️ All Models','Complete Range']].map(([t,d],i)=>(
                <div key={i} style={{ padding:16, background:'#fff', borderRadius:10, borderLeft:`3px solid ${HONDA_RED}` }}>
                  <div style={{ fontWeight:800, fontSize:14, color:DARK }}>{t}</div>
                  <div style={{ color:'#888', fontSize:12, marginTop:2 }}>{d}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex:1, minWidth:280 }}>
            <div style={{ background:DARK, borderRadius:20, padding:40, color:'#fff', textAlign:'center' }}>
              <div style={{ fontSize:60, marginBottom:16 }}>🏢</div>
              <h3 style={{ fontWeight:800, fontSize:20 }}>V P HONDA</h3>
              <p style={{ color:'rgba(255,255,255,0.6)', fontSize:13, marginTop:8 }}>Narsinghgarh Road, Parwaliya Sadak</p>
              <p style={{ color:'rgba(255,255,255,0.6)', fontSize:13 }}>Bhopal, Madhya Pradesh 462030</p>
              <div style={{ marginTop:20, display:'flex', gap:12, justifyContent:'center' }}>
                <a href="tel:9713394738" style={{ background:HONDA_RED, color:'#fff', padding:'10px 24px', borderRadius:8, fontWeight:700, fontSize:13, textDecoration:'none' }}>📞 Call</a>
                <a href="https://wa.me/919713394738" style={{ background:'#25d366', color:'#fff', padding:'10px 24px', borderRadius:8, fontWeight:700, fontSize:13, textDecoration:'none' }}>💬 WhatsApp</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CONTACT ═══ */}
      <section id="contact" style={{ padding:'60px 24px', background:DARK }}>
        <div style={{ maxWidth:1200, margin:'0 auto', display:'flex', gap:40, justifyContent:'space-between', flexWrap:'wrap', color:'#fff' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <div style={{ background:HONDA_RED, color:'#fff', fontWeight:900, fontSize:18, padding:'5px 12px', borderRadius:6 }}>VP</div>
              <span style={{ fontWeight:800, fontSize:18 }}>V P HONDA</span>
            </div>
            <p style={{ color:'rgba(255,255,255,0.5)', fontSize:13, maxWidth:300 }}>Honda Authorized Dealer, Bhopal M.P.</p>
          </div>
          <div>
            <h4 style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Contact</h4>
            <p style={{ color:'rgba(255,255,255,0.6)', fontSize:13 }}>📞 9713394738 / 8103476883</p>
            <p style={{ color:'rgba(255,255,255,0.6)', fontSize:13 }}>📧 vphonda1@gmail.com</p>
            <p style={{ color:'rgba(255,255,255,0.6)', fontSize:13 }}>📍 Narsinghgarh Road, Parwaliya Sadak, Bhopal</p>
          </div>
          <div>
            <h4 style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Timing</h4>
            <p style={{ color:'rgba(255,255,255,0.6)', fontSize:13 }}>Mon-Sat: 9:00 AM - 7:00 PM</p>
            <p style={{ color:'rgba(255,255,255,0.6)', fontSize:13 }}>Sunday: 10:00 AM - 2:00 PM</p>
          </div>
          <div>
            <h4 style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>Quick Links</h4>
            {['Products','Services','About','Contact'].map(l=>(
              <a key={l} href={`#${l.toLowerCase()}`} style={{ display:'block', color:'rgba(255,255,255,0.6)', fontSize:13, marginBottom:6, textDecoration:'none' }}>{l}</a>
            ))}
          </div>
        </div>
        <div style={{ maxWidth:1200, margin:'32px auto 0', borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:20, textAlign:'center' }}>
          <p style={{ color:'rgba(255,255,255,0.3)', fontSize:12 }}>© 2025 VP Honda Bhopal. All Rights Reserved. | GSTIN: 23BCYPD9538B1ZG</p>
        </div>
      </section>

      {/* ═══ CHAT WIDGET ═══ */}
      <div style={{ position:'fixed', bottom:24, right:24, zIndex:200 }}>
        {chatOpen && (
          <div style={{ width:340, height:440, background:'#fff', borderRadius:16, boxShadow:'0 8px 40px rgba(0,0,0,0.2)', display:'flex', flexDirection:'column', overflow:'hidden', marginBottom:12 }}>
            <div style={{ background:HONDA_RED, padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ color:'#fff', fontWeight:800, fontSize:14 }}>💬 VP Honda Chat</div>
              <button onClick={()=>setChatOpen(false)} style={{ background:'none', border:'none', color:'#fff', fontSize:20, cursor:'pointer', fontWeight:700 }}>✕</button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:12, display:'flex', flexDirection:'column', gap:8, background:'#f5f5f5' }}>
              {chatMsgs.map((m,i) => (
                <div key={i} style={{
                  alignSelf: m.from==='user'?'flex-end':'flex-start', maxWidth:'80%',
                  background: m.from==='user'?HONDA_RED:'#fff', color: m.from==='user'?'#fff':'#333',
                  padding:'8px 12px', borderRadius:12, fontSize:13, lineHeight:1.4,
                  boxShadow:'0 1px 4px rgba(0,0,0,0.1)',
                }}>
                  {m.text}
                </div>
              ))}
              <div ref={chatEndRef}/>
            </div>
            <div style={{ padding:10, borderTop:'1px solid #eee', display:'flex', gap:8 }}>
              <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendChat();}}
                placeholder="Type message..." style={{ flex:1, border:'1px solid #ddd', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none' }}/>
              <button onClick={sendChat} style={{ background:HONDA_RED, color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', fontWeight:700, cursor:'pointer' }}>→</button>
            </div>
          </div>
        )}
        <button onClick={()=>setChatOpen(!chatOpen)} style={{
          width:56, height:56, borderRadius:'50%', background:HONDA_RED, color:'#fff', border:'none',
          fontSize:24, cursor:'pointer', boxShadow:'0 4px 20px rgba(204,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          {chatOpen ? '✕' : '💬'}
        </button>
      </div>

      {/* ═══ ENQUIRY MODAL ═══ */}
      {enquiryOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div style={{ background:'#fff', borderRadius:20, padding:32, width:'100%', maxWidth:420, position:'relative' }}>
            <button onClick={()=>setEnquiryOpen(false)} style={{ position:'absolute', top:16, right:16, background:'none', border:'none', fontSize:24, cursor:'pointer', color:'#999' }}>✕</button>
            <h3 style={{ fontWeight:900, fontSize:22, color:DARK, marginBottom:4 }}>📋 Enquiry / Test Ride</h3>
            <p style={{ color:'#888', fontSize:13, marginBottom:20 }}>Fill details, we'll call you back!</p>
            {[
              { k:'name', p:'Your Name *', t:'text' },
              { k:'phone', p:'Mobile Number *', t:'tel' },
              { k:'vehicle', p:'Interested Vehicle (Activa, Shine, SP125...)', t:'text' },
              { k:'msg', p:'Message (optional)', t:'text' },
            ].map(f => (
              <input key={f.k} type={f.t} placeholder={f.p} value={enquiry[f.k]}
                onChange={e=>setEnquiry({...enquiry,[f.k]:e.target.value})}
                style={{ width:'100%', border:'2px solid #eee', borderRadius:10, padding:'10px 14px', fontSize:14, marginBottom:10, outline:'none', boxSizing:'border-box' }}/>
            ))}
            <button onClick={submitEnquiry} style={{ width:'100%', background:HONDA_RED, color:'#fff', border:'none', padding:'14px', borderRadius:10, fontWeight:800, fontSize:15, cursor:'pointer', marginTop:8 }}>
              Submit Enquiry →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
