// ════════════════════════════════════════════════════════════════════════════
// src/components/BottomNav.jsx — 📱 Mobile app जैसी नीचे की पट्टी
// ════════════════════════════════════════════════════════════════════════════
// सिर्फ़ mobile / छोटी screen पर (computer पर ऊपर का पूरा menu ही काफ़ी है).
// रोज़ के सबसे ज़रूरी 5 पन्ने एक tap पर — बाक़ी सब ऊपर ☰ menu में वैसे ही.
//
// • Chat और Meeting पर नहीं दिखती (वहाँ नीचे message लिखने की जगह है)
// • कुछ लिखते समय (keyboard खुला हो) अपने आप छिप जाती है
// • नीचे वाले बटन (Smart बटन, Update/Install संदेश) इसके ऊपर खिसक जाते हैं —
//   इसके लिए `--vp-bottom-nav` CSS variable सेट होता है
//
// बटन बदलने हों तो सिर्फ़ नीचे ITEMS की सूची बदलें.
// ════════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Tag, Bell, Ticket } from 'lucide-react';

const ITEMS = [
  { path: '/dashboard',  label: 'होम',       Icon: Home,   match: ['/dashboard'] },
  { path: '/customers',  label: 'ग्राहक',     Icon: Users,  match: ['/customers', '/customer-', '/new-customers', '/service-customers'] },
  { path: '/price-list', label: 'Price List', Icon: Tag,    match: ['/price-list'] },
  { path: '/reminders',  label: 'रिमाइंडर',   Icon: Bell,   match: ['/reminders'] },
  { path: '/job-cards',  label: 'जॉब कार्ड',  Icon: Ticket, match: ['/job-cards'] },
];

const HIDE_ON = ['/chat', '/meeting'];
const BAR_H = 60;                       // पट्टी की ऊँचाई (px)
const MOBILE_MAX = 1023;                // Navbar भी 1024 (lg) से नीचे mobile menu दिखाता है

export default function BottomNav() {
  const { pathname } = useLocation();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= MOBILE_MAX);
  const [typing, setTyping] = useState(false);

  // screen का आकार
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_MAX);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // keyboard खुला हो (कोई input भर रहे हों) तो पट्टी छिपाओ — वरना वह input ढक देती है
  useEffect(() => {
    const isField = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
      && !['checkbox', 'radio', 'button', 'submit', 'file', 'range', 'color'].includes(el.type);
    const onIn  = (e) => { if (isField(e.target)) setTyping(true); };
    const onOut = () => setTimeout(() => setTyping(isField(document.activeElement)), 50);
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);

  const hiddenHere = HIDE_ON.some(p => pathname === p || pathname.startsWith(p + '/'));
  const visible = isMobile && !hiddenHere && !typing;
  const reserve = isMobile && !hiddenHere;   // keyboard के समय भी जगह रहने दो (page उछले नहीं)

  // नीचे वाले दूसरे बटनों को बताओ कि कितना ऊपर रहना है
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--vp-bottom-nav', visible ? `calc(${BAR_H}px + env(safe-area-inset-bottom, 0px))` : '0px');
    return () => root.style.setProperty('--vp-bottom-nav', '0px');
  }, [visible]);

  if (!reserve) return null;

  const isActive = (it) => it.match.some(m => pathname === m || pathname.startsWith(m));

  return (
    <>
      {/* page का आख़िरी हिस्सा पट्टी के नीचे न दबे — उतनी ही ख़ाली जगह */}
      <div aria-hidden="true" style={{ height: `calc(${BAR_H}px + env(safe-area-inset-bottom, 0px))` }} />

      {visible && (
        <nav
          aria-label="मुख्य पन्ने"
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 140,
            background: '#0f172a', borderTop: '1px solid #1e293b',
            boxShadow: '0 -6px 24px rgba(0,0,0,.35)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <div style={{ display: 'flex', height: BAR_H, maxWidth: 640, margin: '0 auto' }}>
            {ITEMS.map((it) => {
              const active = isActive(it);
              const { Icon } = it;
              return (
                <Link
                  key={it.path}
                  to={it.path}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 3,
                    textDecoration: 'none', color: active ? '#fff' : '#94a3b8',
                    position: 'relative', WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {/* ऊपर लाल लकीर — कौन सा पन्ना खुला है */}
                  <span style={{
                    position: 'absolute', top: 0, left: '22%', right: '22%', height: 3,
                    borderRadius: '0 0 3px 3px', background: active ? '#DC0000' : 'transparent',
                  }} />
                  <span style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 40, height: 28, borderRadius: 14,
                    background: active ? 'rgba(220,0,0,.22)' : 'transparent',
                  }}>
                    <Icon size={20} strokeWidth={active ? 2.6 : 2} color={active ? '#ff4d4d' : '#94a3b8'} />
                  </span>
                  <span style={{
                    fontSize: 10.5, fontWeight: active ? 800 : 600, lineHeight: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                  }}>
                    {it.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
