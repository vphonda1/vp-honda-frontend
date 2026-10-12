// ════════════════════════════════════════════════════════════════════════════
//  ScanTrimModal.jsx — VP Honda Document Vault
//  "खाली जगह हटाएँ" वाली screen
// ────────────────────────────────────────────────────────────────────────────
//  क्या दिखता है:
//    बाईं तरफ़  → असली photo, उस पर हरे डिब्बे (जो हिस्से रखे जाएँगे)
//    दाईं तरफ़  → नतीजा कैसा बनेगा उसकी झलक
//
//  क्या किया जा सकता है:
//    • डिब्बे के ऊपर/नीचे वाली पट्टी को उँगली से खींचकर हिस्सा छोटा-बड़ा करना
//    • किसी डिब्बे पर tap करके उसे हटाना/वापस लाना (उँगली, परछाईं वग़ैरह)
//    • बीच की जगह (gap) और किनारा (margin) slider से तय करना
//    • पहचान ठीक न लगे तो "सहनशीलता" slider घुमाकर दोबारा पहचान
//
//  ⚠️ कार्ड के अन्दर कुछ नहीं बदलता — पूरी गारंटी scanTrim.js में लिखी है.
//
//  Location: src/components/ScanTrimModal.jsx
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  TRIM_DEFAULTS, loadSource, sizeOf, detect, compose, exportCanvas, blobToFile,
} from '../utils/scanTrim';

const PREVIEW_W = 300;   // बाईं झलक की चौड़ाई (px)

export default function ScanTrimModal({
  src,                 // File / Blob / dataURL — जिस photo को काटना है
  fileName = 'scan.jpg',
  title = '✂️ खाली जगह हटाएँ',
  onApply,             // (File, info) => void   — "लगाएँ" दबाने पर
  onSkip,              // (File|null) => void    — "मूल रखें" दबाने पर
  onClose,             // () => void             — बन्द करने पर (onSkip न हो तो)
}) {
  const [img,    setImg]    = useState(null);
  const [plan,   setPlan]   = useState(null);
  const [busy,   setBusy]   = useState(true);
  const [err,    setErr]    = useState('');
  const [saving, setSaving] = useState(false);

  const [sens,     setSens]     = useState(TRIM_DEFAULTS.sensitivity);
  const [gap,      setGap]      = useState(TRIM_DEFAULTS.gap);
  const [margin,   setMargin]   = useState(TRIM_DEFAULTS.margin);
  const [sideTrim, setSideTrim] = useState(TRIM_DEFAULTS.sideTrim);
  const [lossless, setLossless] = useState(false);
  const [outInfo,  setOutInfo]  = useState(null);
  const [srcUrl,   setSrcUrl]   = useState('');

  const outRef  = useRef(null);   // नतीजे वाला <canvas>
  const dragRef = useRef(null);   // चल रही drag की जानकारी

  // ── बाईं झलक के लिए एक preview URL (बन्द होते ही छोड़ दिया जाता है) ───────
  useEffect(() => {
    if (!src) return;
    if (typeof src === 'string') { setSrcUrl(src); return; }
    let url = '';
    try { url = URL.createObjectURL(src); setSrcUrl(url); } catch {}
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [src]);

  // ── photo लोड + पहली पहचान ────────────────────────────────────────────────
  useEffect(() => {
    let dead = false;
    (async () => {
      setBusy(true); setErr('');
      try {
        const im = await loadSource(src);
        if (dead) return;
        const p = detect(im, { sensitivity: TRIM_DEFAULTS.sensitivity, sideTrim: TRIM_DEFAULTS.sideTrim });
        if (dead) return;
        setImg(im); setPlan(p);
      } catch (e) {
        if (!dead) setErr(e?.message || 'photo पढ़ी नहीं जा सकी');
      } finally {
        if (!dead) setBusy(false);
      }
    })();
    return () => { dead = true; };
  }, [src]);

  // ── दोबारा पहचान (सहनशीलता बदलने पर) ──────────────────────────────────────
  const redetect = useCallback((s = sens, st = sideTrim) => {
    if (!img) return;
    setBusy(true);
    // paint होने दें, फिर भारी काम
    setTimeout(() => {
      try { setPlan(detect(img, { sensitivity: s, sideTrim: st })); }
      catch (e) { setErr(e?.message || 'पहचान नहीं हो पाई'); }
      setBusy(false);
    }, 20);
  }, [img, sens, sideTrim]);

  // ── नतीजे की झलक बनाओ ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!img || !plan) return;
    const t = setTimeout(() => {
      try {
        const cv = compose(img, plan, { gap, margin, sideTrim });
        setOutInfo({ w: cv.width, h: cv.height });
        const dst = outRef.current;
        if (dst) {
          const sc = Math.min(PREVIEW_W / cv.width, 520 / cv.height, 1);
          dst.width  = Math.max(1, Math.round(cv.width  * sc));
          dst.height = Math.max(1, Math.round(cv.height * sc));
          const c = dst.getContext('2d');
          c.fillStyle = plan.bgColor || '#fff';
          c.fillRect(0, 0, dst.width, dst.height);
          c.drawImage(cv, 0, 0, dst.width, dst.height);
        }
        cv.width = 0; cv.height = 0;
      } catch (e) {
        setOutInfo(null);
      }
    }, 60);
    return () => clearTimeout(t);
  }, [img, plan, gap, margin, sideTrim]);

  // ── drag (उँगली/माउस दोनों) ───────────────────────────────────────────────
  const previewScale = plan ? PREVIEW_W / plan.width : 1;

  const onHandleDown = (e, bandId, edge) => {
    e.preventDefault(); e.stopPropagation();
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const b = plan.bands.find(x => x.id === bandId);
    dragRef.current = { bandId, edge, startY: y, startTop: b.top, startBottom: b.bottom };
  };

  useEffect(() => {
    if (!plan) return;
    const move = (e) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      const y  = e.touches ? e.touches[0].clientY : e.clientY;
      const dy = Math.round((y - d.startY) / previewScale);
      setPlan(p => ({
        ...p,
        bands: p.bands.map(b => {
          if (b.id !== d.bandId) return b;
          if (d.edge === 'top') {
            const nt = Math.max(0, Math.min(d.startBottom - 20, d.startTop + dy));
            return { ...b, top: nt, keep: true };
          }
          const nb = Math.min(p.height - 1, Math.max(d.startTop + 20, d.startBottom + dy));
          return { ...b, bottom: nb, keep: true };
        }),
      }));
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
    };
  }, [plan, previewScale]);

  const toggleBand = (id) =>
    setPlan(p => ({ ...p, bands: p.bands.map(b => b.id === id ? { ...b, keep: !b.keep } : b) }));

  // ── लगाएँ ────────────────────────────────────────────────────────────────
  const apply = async () => {
    if (!img || !plan) return;
    setSaving(true);
    try {
      const cv  = compose(img, plan, { gap, margin, sideTrim });
      const out = await exportCanvas(cv, { lossless, quality: TRIM_DEFAULTS.quality });
      cv.width = 0; cv.height = 0;
      const file = blobToFile(out.blob, fileName, out.type);
      onApply?.(file, {
        width: out.width, height: out.height, sizeKB: out.sizeKB,
        beforeH: plan.height, afterH: out.height,
        removedPx: Math.max(0, plan.height - out.height),
      });
    } catch (e) {
      setErr(e?.message || 'नहीं हो पाया');
      setSaving(false);
    }
  };

  const skip = () => { (onSkip || onClose)?.(null); };

  const keptCount = plan ? plan.bands.filter(b => b.keep).length : 0;
  const saved = plan && outInfo ? Math.round((1 - outInfo.h / plan.height) * 100) : 0;

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <div style={S.backdrop} onClick={(e) => { if (e.target === e.currentTarget) skip(); }}>
      <div style={S.sheet}>

        <div style={S.head}>
          <span style={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>{title}</span>
          <button onClick={skip} style={S.x} aria-label="बन्द करें">×</button>
        </div>

        <p style={S.note}>
          🔒 कार्ड के अन्दर कुछ नहीं बदलता — नाम, पता, फ़ोटो, QR, नंबर सब वैसे ही रहते हैं।
          सिर्फ़ कार्ड के बाहर की कोरी जगह कटती है।
        </p>

        {err && <div style={S.err}>⚠️ {err}</div>}

        {busy && !plan && <div style={S.loading}>⏳ photo जाँची जा रही है…</div>}

        {plan && (
          <>
            <div style={S.panes}>
              {/* ── बाईं तरफ़: असली photo + डिब्बे ───────────────────────── */}
              <div style={{ flex: '0 0 auto' }}>
                <p style={S.paneTitle}>असली photo</p>
                <div style={{ ...S.stage, width: PREVIEW_W, height: Math.round(plan.height * previewScale) }}>
                  {srcUrl && (
                    <img src={srcUrl} alt="" draggable={false}
                      style={{ width: '100%', display: 'block', userSelect: 'none' }}/>
                  )}
                  {plan.bands.map((b, i) => {
                    const top = b.top * previewScale;
                    const h   = (b.bottom - b.top + 1) * previewScale;
                    return (
                      <div key={b.id}
                        style={{
                          position: 'absolute', left: 0, right: 0, top, height: h,
                          border: b.keep ? '2px solid #22c55e' : '2px dashed #64748b',
                          background: b.keep ? 'rgba(34,197,94,0.10)' : 'rgba(2,6,23,0.55)',
                          boxSizing: 'border-box',
                        }}>
                        <button
                          onClick={() => toggleBand(b.id)}
                          style={{
                            position: 'absolute', left: 4, top: 4, zIndex: 2,
                            background: b.keep ? '#16a34a' : '#475569', color: '#fff',
                            border: 'none', borderRadius: 5, fontSize: 10, fontWeight: 800,
                            padding: '3px 7px', cursor: 'pointer',
                          }}>
                          {b.keep ? `✓ हिस्सा ${i + 1}` : `✕ छोड़ा`}
                        </button>
                        {b.keep && (
                          <>
                            <div
                              onMouseDown={(e) => onHandleDown(e, b.id, 'top')}
                              onTouchStart={(e) => onHandleDown(e, b.id, 'top')}
                              style={{ ...S.handle, top: -11 }}
                              title="ऊपर की लकीर खींचें"
                            />
                            <div
                              onMouseDown={(e) => onHandleDown(e, b.id, 'bottom')}
                              onTouchStart={(e) => onHandleDown(e, b.id, 'bottom')}
                              style={{ ...S.handle, bottom: -11 }}
                              title="नीचे की लकीर खींचें"
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p style={S.hint}>पट्टी को उँगली से खींचकर हिस्सा छोटा-बड़ा करें</p>
              </div>

              {/* ── दाईं तरफ़: नतीजा ──────────────────────────────────────── */}
              <div style={{ flex: '0 0 auto' }}>
                <p style={S.paneTitle}>
                  ✅ नतीजा {outInfo ? `· ${outInfo.w}×${outInfo.h}` : ''}
                  {saved > 0 && <span style={{ color: '#4ade80' }}> · {saved}% छोटा</span>}
                </p>
                <div style={{ ...S.stage, width: PREVIEW_W, padding: 0, background: '#0b1220' }}>
                  <canvas ref={outRef} style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }} />
                </div>
                <p style={S.hint}>यही photo save होगी</p>
              </div>
            </div>

            {/* ── Controls ──────────────────────────────────────────────── */}
            <div style={S.controls}>
              <Row label={`बीच की जगह · ${gap}px`}>
                <input type="range" min={0} max={60} step={2} value={gap}
                  onChange={e => setGap(+e.target.value)} style={S.range}/>
              </Row>
              <Row label={`किनारा · ${margin}px`}>
                <input type="range" min={0} max={40} step={2} value={margin}
                  onChange={e => setMargin(+e.target.value)} style={S.range}/>
              </Row>
              <Row label={`सहनशीलता · ${sens.toFixed(1)}`}>
                <input type="range" min={0.6} max={1.8} step={0.1} value={sens}
                  onChange={e => setSens(+e.target.value)}
                  onMouseUp={e => redetect(+e.target.value, sideTrim)}
                  onTouchEnd={e => redetect(+e.target.value, sideTrim)}
                  style={S.range}/>
              </Row>

              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 2 }}>
                <label style={S.check}>
                  <input type="checkbox" checked={sideTrim}
                    onChange={e => { setSideTrim(e.target.checked); redetect(sens, e.target.checked); }}/>
                  दाएँ-बाएँ भी काटें
                </label>
                <label style={S.check}>
                  <input type="checkbox" checked={lossless} onChange={e => setLossless(e.target.checked)}/>
                  बिल्कुल lossless (PNG · भारी file)
                </label>
              </div>

              <div style={S.bandRow}>
                {plan.bands.map((b, i) => (
                  <button key={b.id} onClick={() => toggleBand(b.id)}
                    style={{
                      ...S.chip,
                      background: b.keep ? '#166534' : '#1e293b',
                      color:      b.keep ? '#dcfce7' : '#64748b',
                      border:     `1px solid ${b.keep ? '#22c55e' : '#334155'}`,
                    }}>
                    {b.keep ? '✓' : '✕'} हिस्सा {i + 1} · {b.bottom - b.top + 1}px
                  </button>
                ))}
              </div>
            </div>

            {/* ── Buttons ───────────────────────────────────────────────── */}
            <div style={S.actions}>
              <button onClick={skip} disabled={saving} style={S.btnGhost}>
                मूल रखें
              </button>
              <button onClick={() => { setSens(1); setSideTrim(true); setGap(0); setMargin(10); redetect(1, true); }}
                disabled={saving || busy} style={S.btnMid}>
                ↺ दोबारा
              </button>
              <button onClick={apply} disabled={saving || busy || keptCount === 0} style={{
                ...S.btnMain,
                background: (saving || busy || keptCount === 0) ? '#475569' : '#16a34a',
                cursor:     (saving || busy || keptCount === 0) ? 'not-allowed' : 'pointer',
              }}>
                {saving ? '⏳ बन रही है…' : '✅ लगाएँ'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 11, color: '#94a3b8', width: 128, flexShrink: 0, fontWeight: 700 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

const S = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.88)', zIndex: 9000,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: 12, overflowY: 'auto',
  },
  sheet: {
    background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14,
    padding: 14, width: '100%', maxWidth: 680, margin: 'auto',
  },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  x: {
    background: '#1e293b', color: '#94a3b8', border: 'none', borderRadius: '50%',
    width: 28, height: 28, fontSize: 18, lineHeight: '28px', cursor: 'pointer',
  },
  note: {
    fontSize: 10.5, color: '#86efac', background: '#052e16', border: '1px solid #166534',
    borderRadius: 8, padding: '7px 10px', margin: '0 0 10px', lineHeight: 1.5,
  },
  err: {
    fontSize: 11, color: '#fecaca', background: '#450a0a', border: '1px solid #7f1d1d',
    borderRadius: 8, padding: '7px 10px', marginBottom: 10,
  },
  loading: { color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '28px 0' },
  panes: { display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  paneTitle: { fontSize: 11, fontWeight: 800, color: '#cbd5e1', margin: '0 0 5px' },
  stage: {
    position: 'relative', background: '#1e293b', borderRadius: 8,
    overflow: 'hidden', border: '1px solid #334155',
  },
  handle: {
    position: 'absolute', left: '28%', right: '28%', height: 22,
    background: '#22c55e', borderRadius: 11, cursor: 'ns-resize',
    boxShadow: '0 1px 6px rgba(0,0,0,.6)', touchAction: 'none', zIndex: 3,
  },
  hint: { fontSize: 9.5, color: '#64748b', margin: '4px 0 0', textAlign: 'center' },
  controls: {
    display: 'flex', flexDirection: 'column', gap: 9, marginTop: 12,
    background: '#0b1220', border: '1px solid #1e293b', borderRadius: 10, padding: 11,
  },
  range: { width: '100%', accentColor: '#22c55e' },
  check: { fontSize: 11, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' },
  bandRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  chip: { borderRadius: 6, fontSize: 10, fontWeight: 700, padding: '5px 9px', cursor: 'pointer' },
  actions: { display: 'flex', gap: 8, marginTop: 12 },
  btnGhost: {
    flex: '0 0 auto', background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155',
    borderRadius: 9, padding: '11px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  btnMid: {
    flex: '0 0 auto', background: '#1e3a8a', color: '#fff', border: 'none',
    borderRadius: 9, padding: '11px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  btnMain: {
    flex: 1, color: '#fff', border: 'none', borderRadius: 9,
    padding: '11px 14px', fontSize: 13, fontWeight: 800,
  },
};
