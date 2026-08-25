// ════════════════════════════════════════════════════════════════════════════
// ErrorBoundary.jsx — कोई page crash हो तो पूरा app सफ़ेद न हो
// ════════════════════════════════════════════════════════════════════════════
// ⚠️ पहले यह error तो दिखाता था, पर उसे भेजने का कोई तरीक़ा नहीं था. इसलिए
// "page crash हो जाता है" की शिकायत तो आती थी, पर *क्यों* — यह कभी पता नहीं
// चलता था और हर बार अंदाज़ा लगाना पड़ता था.
//
// अब: पूरा ब्यौरा एक बटन से copy होता है और WhatsApp पर सीधे भेजा जा सकता है.
// आख़िरी 10 crash browser में सुरक्षित भी रहते हैं.
// ════════════════════════════════════════════════════════════════════════════
import { Component } from 'react';

const LOG_KEY = 'vp_crash_log';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
    this.setState({ info });
    // आख़िरी 10 crash सुरक्षित रखो — बाद में भी देखे जा सकें
    try {
      const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
      log.unshift({
        at: new Date().toISOString(),
        page: window.location.pathname + window.location.search,
        message: String(error?.message || error),
        stack: String(error?.stack || '').slice(0, 1500),
        component: String(info?.componentStack || '').slice(0, 800),
      });
      localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, 10)));
    } catch {}
  }

  report() {
    const { error, info } = this.state;
    return [
      '🐞 VP Honda — Crash Report',
      `समय: ${new Date().toLocaleString('en-IN')}`,
      `Page: ${window.location.pathname}${window.location.search}`,
      `Device: ${navigator.userAgent}`,
      '',
      `Error: ${String(error?.message || error)}`,
      '',
      'Stack:',
      String(error?.stack || '—').slice(0, 1200),
      '',
      'Component:',
      String(info?.componentStack || '—').slice(0, 700),
    ].join('\n');
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const txt = this.report();
    const box = {
      background:'#0f172a', border:'1px solid #334155', borderRadius:10,
      padding:11, fontSize:11, overflow:'auto', color:'#fbbf24',
      maxHeight:200, whiteSpace:'pre-wrap', wordBreak:'break-word',
    };
    const btn = (bg) => ({
      background:bg, color:'#fff', border:'none', padding:'11px 18px',
      borderRadius:10, fontWeight:800, cursor:'pointer', fontSize:12.5,
    });

    return (
      <div style={{ padding:20, color:'#fff', background:'#020617', minHeight:'100vh' }}>
        <img src="/logo.png" alt="VP Honda" width={54} height={54}
          style={{ width:54, height:54, objectFit:'contain', marginBottom:12 }}/>
        <h2 style={{ color:'#DC0000', margin:'0 0 6px', fontSize:19 }}>यह page नहीं खुल पाया</h2>
        <p style={{ fontSize:12.5, color:'#94a3b8', margin:'0 0 14px' }}>
          बाक़ी app ठीक चल रहा है. नीचे का ब्यौरा copy करके भेज दीजिए — इससे ठीक वजह पता चल जाएगी.
        </p>

        <p style={{ fontSize:13, fontWeight:700, margin:'0 0 8px', color:'#fca5a5' }}>
          {String(this.state.error?.message || this.state.error)}
        </p>

        <div style={{ display:'flex', gap:9, flexWrap:'wrap', margin:'0 0 14px' }}>
          <button onClick={async () => {
            try { await navigator.clipboard.writeText(txt); }
            catch {
              const ta = document.createElement('textarea');
              ta.value = txt; document.body.appendChild(ta); ta.select();
              try { document.execCommand('copy'); } catch {}
              document.body.removeChild(ta);
            }
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 2500);
          }} style={btn('linear-gradient(135deg,#0284c7,#0369a1)')}>
            {this.state.copied ? '✅ copy हो गया' : '📋 ब्यौरा copy करें'}
          </button>

          <a href={`https://wa.me/919713394738?text=${encodeURIComponent(txt.slice(0, 1200))}`}
            target="_blank" rel="noreferrer" style={{ ...btn('linear-gradient(135deg,#059669,#047857)'), textDecoration:'none', display:'inline-block' }}>
            📱 WhatsApp पर भेजें
          </a>

          <button onClick={() => window.location.reload()} style={btn('linear-gradient(135deg,#DC0000,#991b1b)')}>
            🔄 दोबारा खोलें
          </button>

          <button onClick={() => { window.location.href = '/dashboard'; }} style={btn('rgba(255,255,255,.08)')}>
            🏠 Dashboard
          </button>
        </div>

        <details>
          <summary style={{ color:'#64748b', fontSize:11.5, cursor:'pointer', marginBottom:8 }}>
            पूरा तकनीकी ब्यौरा देखें
          </summary>
          <pre style={box}>{txt}</pre>
        </details>
      </div>
    );
  }
}
