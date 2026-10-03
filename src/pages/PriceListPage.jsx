// ════════════════════════════════════════════════════════════════════════════
// src/pages/PriceListPage.jsx — 🏷️ Honda Price List
// ════════════════════════════════════════════════════════════════════════════
// • Excel की "Rate List" sheet (A1:L31) जैसी ही सजी हुई — title, ON-ROAD PRICE /
//   OPTIONAL, सारे कॉलम, नीचे की लाइनें (Hypothecation, Temp. Registration …)
// • 📥 Excel से एक बार में पूरी list import (सिर्फ़ admin) — पहले preview,
//   फिर "सेव करें". वही .xlsm file चलती है जिससे बाक़ी data import होता है.
// • दाम बढ़ा/घटा तो हर model पर ▲/▼ दिखता है, नया model "नया" के साथ
// • पुरानी list भी देख सकते हैं (आख़िरी 12 imports)
// • Print — सिर्फ़ table छपती है
// ════════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { apiFetch, apiPost } from '../utils/apiConfig';
import { showInAppToast } from '../utils/smartUtils';
import {
  parsePriceWorkbook, comparePriceLists, mergeIntoSharedRatePrices, modelKey, fmt,
} from '../utils/priceListParser';

const CACHE_KEY = 'vp_price_list_cache';

const COLS = [
  { key: 'sNo',        label: 'S No',        w: 40,  align: 'center' },
  { key: 'model',      label: 'Model',       w: 200, align: 'left' },
  { key: 'cc',         label: 'CC',          w: 80,  align: 'center' },
  { key: 'exShowroom', label: 'EX-Shroom',   w: 100, align: 'right', money: true },
  { key: 'rto',        label: 'RTO',         w: 92,  align: 'right', money: true },
  { key: 'insurance',  label: 'Insur',       w: 92,  align: 'right', money: true },
  { key: 'offerPrice', label: 'Offer Price', w: 110, align: 'right', money: true, strong: true },
  { key: 'zeroDep',    label: '0% Dep',      w: 52,  align: 'center' },
  { key: 'warranty',   label: '3+3 Yr',      w: 52,  align: 'center' },
  { key: 'accessory',  label: 'Accessory',   w: 66,  align: 'center' },
  { key: 'grandTotal', label: 'Grand Total', w: 116, align: 'right', money: true, strong: true },
];

const C = {
  page: '#0f172a', ink: '#0f172a', grid: '#94a3b8', frame: '#1d4ed8',
  head: '#e2e8f0', group: '#f1f5f9', section: '#fee2e2', red: '#DC0000',
  up: '#c2410c', down: '#15803d',
};

const fmtDateTime = (d) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

// ════════════════════════════════════════════════════════════════════════════
// Excel जैसी table
// ════════════════════════════════════════════════════════════════════════════
function PriceTable({ data, changes = {}, query = '' }) {
  const headers = data?.headers || {};
  const q = query.trim().toLowerCase();
  const rows = (data?.rows || []).filter(r =>
    !q ? true : (r.type === 'model' && (`${r.model} ${r.cc}`).toLowerCase().includes(q))
  );

  const cell = (extra = {}) => ({
    border: `1px solid ${C.grid}`, padding: '6px 7px', fontSize: 12.5, color: C.ink,
    whiteSpace: 'nowrap', ...extra,
  });

  // mobile पर: title ऊपर अलग, और S No + Model कॉलम बाएँ चिपके रहें (बाक़ी scroll हो)
  const stick = (ci) => (ci === 0 ? 'vp-pl-s0' : ci === 1 ? 'vp-pl-s1' : undefined);

  return (
    <div>
      <style>{`
        .vp-pl-mtitle { display: none; }
        @media (max-width: 760px) {
          .vp-pl-mtitle { display: block; text-align: center; font-weight: 900; font-size: 16px; color: ${C.ink}; padding: 6px 4px 8px; }
          .vp-pl-trow { display: none; }
          .vp-pl-s0 { position: sticky; left: 0; z-index: 2; background: #fff; }
          .vp-pl-s1 { position: sticky; left: 40px; z-index: 2; background: #fff; box-shadow: 3px 0 4px -2px rgba(0,0,0,.18); }
          th.vp-pl-s0, th.vp-pl-s1 { background: ${C.head}; }
          .vp-pl-grp { text-align: left !important; }
        }
        @media print { .vp-pl-mtitle { display: none !important; } .vp-pl-trow { display: table-row !important; } }
      `}</style>
      <div className="vp-pl-mtitle">{data?.title || 'HONDA PRICE LIST'}</div>
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{
        borderCollapse: 'collapse', minWidth: 1100, width: '100%', background: '#fff',
        border: `2px solid ${C.frame}`, fontFamily: 'Arial, Helvetica, sans-serif',
      }}>
        <thead>
          <tr className="vp-pl-trow">
            <th colSpan={COLS.length} style={cell({
              fontSize: 22, fontWeight: 900, padding: '10px 8px', textAlign: 'center', letterSpacing: 0.5,
            })}>
              {data?.title || 'HONDA PRICE LIST'}
            </th>
          </tr>
          <tr>
            <th className="vp-pl-s0" style={cell({ background: C.group })} />
            <th colSpan={6} className="vp-pl-grp" style={cell({ background: C.group, fontWeight: 800, textAlign: 'center', fontSize: 15 })}>
              {data?.groups?.onRoad || 'ON-ROAD PRICE'}
            </th>
            <th colSpan={4} className="vp-pl-grp" style={cell({ background: C.group, fontWeight: 800, textAlign: 'center', fontSize: 15 })}>
              {data?.groups?.optional || 'OPTIONAL'}
            </th>
          </tr>
          <tr>
            {COLS.map((c, ci) => (
              <th key={c.key} className={stick(ci)} style={cell({
                background: C.head, fontWeight: 800, textAlign: 'center', minWidth: c.w,
                whiteSpace: 'normal', lineHeight: 1.2,
              })}>
                {/* Excel में "Acces ory" दो लाइन में टूटा है — यहाँ पूरा शब्द */}
                {String(headers[c.key] || c.label).replace(/acces\s+ory/i, 'Accessory')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            if (r.type === 'section') {
              return (
                <tr key={`s${i}`}>
                  <td colSpan={COLS.length} style={cell({
                    background: C.section, fontWeight: 900, color: C.red, letterSpacing: 1, fontSize: 13,
                  })}>{r.label}</td>
                </tr>
              );
            }
            const ch = changes[modelKey(r.model)] || {};
            return (
              <tr key={`m${i}`} style={{ background: i % 2 ? '#f8fafc' : '#fff' }}>
                {COLS.map((c, ci) => {
                  const v = r[c.key];
                  let shown;
                  if (c.money) shown = v === null || v === undefined || v === '' ? '' : `₹ ${fmt(v)}`;
                  else if (['zeroDep', 'warranty', 'accessory'].includes(c.key)) shown = v === null || v === undefined ? '' : fmt(v, 0);
                  else shown = v ?? '';
                  const d = ch[c.key];
                  return (
                    <td key={c.key} className={stick(ci)} style={cell({
                      textAlign: c.align, fontWeight: c.strong || c.key === 'model' ? 800 : 500,
                      fontVariantNumeric: 'tabular-nums',
                    })}>
                      {shown}
                      {c.key === 'model' && ch.isNew && (
                        <span style={{
                          marginLeft: 6, fontSize: 10, fontWeight: 900, color: '#fff',
                          background: '#2563eb', borderRadius: 4, padding: '1px 5px', verticalAlign: 'middle',
                        }}>नया</span>
                      )}
                      {typeof d === 'number' && (
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: d > 0 ? C.up : C.down, lineHeight: 1.1 }}>
                          {d > 0 ? '▲' : '▼'} ₹{fmt(Math.abs(d), Math.abs(d) % 1 ? 2 : 0)}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {!rows.length && (
            <tr><td colSpan={COLS.length} style={cell({ textAlign: 'center', color: '#64748b', padding: 18 })}>
              "{query}" से कोई model नहीं मिला
            </td></tr>
          )}
          {(data?.notes || []).length > 0 && !q && (
            <tr>
              <td colSpan={COLS.length} style={cell({ padding: '8px 10px', whiteSpace: 'normal' })}>
                {/* sticky — mobile पर table scroll करने पर भी ये लाइनें दिखती रहें */}
                <div style={{ position: 'sticky', left: 8, maxWidth: 'calc(100vw - 60px)', display: 'inline-block' }}>
                  {(data.notes || []).map((n, i) => (
                    <div key={i} style={{ fontWeight: 800, fontSize: 13.5, padding: '2px 0' }}>{n}</div>
                  ))}
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function PriceListPage({ user }) {
  const isAdmin = user?.role === 'admin';
  const fileRef = useRef(null);

  const [current, setCurrent]   = useState(() => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
  });
  const [history, setHistory]   = useState([]);
  const [prevDoc, setPrevDoc]   = useState(null);     // बदलाव दिखाने के लिए पिछली list
  const [viewing, setViewing]   = useState(null);     // कोई पुरानी list खुली हो
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [query, setQuery]       = useState('');
  const [preview, setPreview]   = useState(null);     // import के बाद, सेव से पहले
  const [busy, setBusy]         = useState(false);

  // ── सबसे नई list + इतिहास ──────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [latest, hist] = await Promise.all([
        apiFetch('/api/price-list'),
        apiFetch('/api/price-list/history').catch(() => []),
      ]);
      setCurrent(latest || null);
      setHistory(Array.isArray(hist) ? hist : []);
      try {
        if (latest) localStorage.setItem(CACHE_KEY, JSON.stringify(latest));
        else localStorage.removeItem(CACHE_KEY);
      } catch {}
      // पिछली list (बदलाव ▲▼ के लिए)
      if (Array.isArray(hist) && hist.length > 1) {
        apiFetch(`/api/price-list/${hist[1]._id}`).then(setPrevDoc).catch(() => setPrevDoc(null));
      } else setPrevDoc(null);
    } catch (e) {
      setError(e.message || 'Price list नहीं आ पाई');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = viewing || current;
  const changes = useMemo(() => {
    if (viewing || !current || !prevDoc) return {};
    return comparePriceLists(prevDoc.rows, current.rows).changes;
  }, [current, prevDoc, viewing]);
  const changeCount = Object.keys(changes).length;

  // ── 📥 Excel चुनो → पढ़ो → preview ──────────────────────────────────────
  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';                 // वही file दोबारा चुनी जा सके
    if (!file) return;
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const parsed = parsePriceWorkbook(XLSX, wb);
      const cmp = comparePriceLists(current?.rows || [], parsed.rows);
      setPreview({ ...parsed, sourceFile: file.name, compare: cmp });
    } catch (err) {
      alert('❌ Price List नहीं पढ़ी जा सकी\n\n' + (err.message || err));
    }
    setBusy(false);
  };

  // ── ✅ सेव करो ──────────────────────────────────────────────────────────
  const savePreview = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      await apiPost('/api/price-list', {
        title: preview.title, groups: preview.groups, headers: preview.headers,
        rows: preview.rows, notes: preview.notes,
        sheetName: preview.sheetName, sourceFile: preview.sourceFile,
        importedBy: user?.name || '',
      });
      mergeIntoSharedRatePrices(preview.rows);   // Vehicle Dashboard की auto-price भी नई
      showInAppToast('✅ Price List सेव हो गई', `${preview.modelCount} models — सब devices पर दिखेगी`, 'success');
      setPreview(null);
      setViewing(null);
      await load();
    } catch (err) {
      alert('❌ सेव नहीं हुई: ' + (err.message || err) + '\n\nInternet जाँचकर दोबारा "सेव करें" दबाएँ.');
    }
    setBusy(false);
  };

  // ── पुरानी list खोलो ────────────────────────────────────────────────────
  const openVersion = async (id) => {
    if (!id || id === current?._id) { setViewing(null); return; }
    setBusy(true);
    try { setViewing(await apiFetch(`/api/price-list/${id}`)); }
    catch (err) { alert('❌ ' + err.message); }
    setBusy(false);
  };

  // ── गलत import हटाओ (admin) ─────────────────────────────────────────────
  const deleteShown = async () => {
    if (!shown?._id) return;
    if (!confirm(`यह price list हटानी है?\n\n${shown.title || ''}\n${fmtDateTime(shown.createdAt)}`)) return;
    setBusy(true);
    try {
      await apiFetch(`/api/price-list/${shown._id}`, { method: 'DELETE' });
      setViewing(null);
      await load();
    } catch (err) { alert('❌ ' + err.message); }
    setBusy(false);
  };

  const btn = (bg, extra = {}) => ({
    background: bg, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 14px',
    fontWeight: 800, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', ...extra,
  });

  return (
    <div className="vp-pl-page" style={{ minHeight: '100vh', background: C.page, padding: '16px 12px 90px' }}>
      <style>{`
        @media print {
          .vp-pl-noprint, nav, .vp-pl-page ~ * { display: none !important; }
          .vp-pl-page { background: #fff !important; padding: 0 !important; min-height: 0 !important; }
          .vp-pl-sheet { box-shadow: none !important; padding: 0 !important; }
          body { background: #fff !important; }
          @page { size: A4 landscape; margin: 8mm; }
        }
      `}</style>

      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* ── ऊपर की पट्टी ── */}
        <div className="vp-pl-noprint" style={{
          display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
        }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: 0 }}>🏷️ Honda Price List</h1>
            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 3 }}>
              {current
                ? <>आख़िरी import: {fmtDateTime(current.createdAt)}{current.importedBy ? ` · ${current.importedBy}` : ''} · {current.modelCount} models</>
                : 'अभी कोई price list सेव नहीं है'}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <input
              value={query} onChange={e => setQuery(e.target.value)}
              placeholder="🔍 Model खोजें…"
              style={{
                background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: 9,
                padding: '9px 12px', fontSize: 13, width: 180,
              }}
            />
            {history.length > 1 && (
              <select
                value={viewing?._id || current?._id || ''}
                onChange={e => openVersion(e.target.value)}
                style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: 9, padding: '9px 10px', fontSize: 12.5 }}
                title="पुरानी price list देखें"
              >
                {history.map((h, i) => (
                  <option key={h._id} value={h._id}>
                    {i === 0 ? '✅ आज की — ' : '🕘 '}{(h.title || 'Price List').replace(/^HONDA PRICE LIST\s*/i, '')} ({fmtDateTime(h.createdAt)})
                  </option>
                ))}
              </select>
            )}
            {shown && <button onClick={() => window.print()} style={btn('#334155')}>🖨️ Print</button>}
            {isAdmin && (
              <>
                <button onClick={() => fileRef.current?.click()} disabled={busy} style={btn(C.red, { opacity: busy ? 0.6 : 1 })}>
                  {busy ? '⏳ पढ़ रहे हैं…' : '📥 Excel से Import'}
                </button>
                <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls" onChange={onPickFile} style={{ display: 'none' }} />
              </>
            )}
          </div>
        </div>

        {/* ── पुरानी list देख रहे हैं ── */}
        {viewing && (
          <div className="vp-pl-noprint" style={{
            background: '#fef3c7', color: '#78350f', borderRadius: 10, padding: '9px 12px', marginBottom: 10,
            display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', fontSize: 13, fontWeight: 700,
          }}>
            <span>🕘 पुरानी price list देख रहे हैं — {fmtDateTime(viewing.createdAt)}</span>
            <span style={{ display: 'flex', gap: 8 }}>
              {isAdmin && <button onClick={deleteShown} style={btn('#991b1b', { padding: '6px 10px', fontSize: 12 })}>🗑️ हटाएँ</button>}
              <button onClick={() => setViewing(null)} style={btn('#1d4ed8', { padding: '6px 10px', fontSize: 12 })}>आज की list देखें</button>
            </span>
          </div>
        )}

        {/* ── पिछली list से बदलाव ── */}
        {!viewing && changeCount > 0 && (
          <div className="vp-pl-noprint" style={{
            background: '#1e293b', color: '#e2e8f0', borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: 12.5,
          }}>
            📊 पिछली list ({fmtDateTime(prevDoc?.createdAt)}) से <b>{changeCount}</b> models में बदलाव —
            <span style={{ color: '#fdba74', fontWeight: 800 }}> ▲ बढ़ा</span> /
            <span style={{ color: '#86efac', fontWeight: 800 }}> ▼ घटा</span>
          </div>
        )}

        {error && !current && (
          <div className="vp-pl-noprint" style={{ background: '#7f1d1d', color: '#fff', borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 13 }}>
            ⚠️ {error}
            <button onClick={load} style={btn('#fff', { color: '#7f1d1d', marginLeft: 10, padding: '5px 10px', fontSize: 12 })}>दोबारा कोशिश</button>
          </div>
        )}

        {/* ── Table ── */}
        {shown ? (
          <div className="vp-pl-sheet" style={{ background: '#fff', borderRadius: 10, padding: 8, boxShadow: '0 12px 40px rgba(0,0,0,.35)' }}>
            <PriceTable data={shown} changes={changes} query={query} />
          </div>
        ) : loading ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: 60, fontWeight: 700 }}>⏳ Price list आ रही है…</div>
        ) : (
          <div style={{
            background: '#1e293b', borderRadius: 14, padding: '40px 20px', textAlign: 'center', color: '#cbd5e1',
          }}>
            <div style={{ fontSize: 44 }}>🏷️</div>
            <div style={{ fontWeight: 900, fontSize: 17, color: '#fff', marginTop: 6 }}>अभी कोई price list नहीं है</div>
            <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>
              {isAdmin
                ? <>ऊपर <b>📥 Excel से Import</b> दबाकर वही Excel file चुनें जिसमें <b>Rate List</b> sheet है.<br />A1 से L31 तक की पूरी list एक बार में आ जाएगी.</>
                : 'Admin से Excel import करवाएँ.'}
            </div>
          </div>
        )}
      </div>

      {/* ════════ Import का preview ════════ */}
      {preview && (
        <div className="vp-pl-noprint" data-vp-modal-open="1" style={{
          position: 'fixed', inset: 0, background: 'rgba(2,6,23,.78)', zIndex: 1000,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '20px 10px',
        }}>
          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 14, width: '100%', maxWidth: 1280, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 900, fontSize: 17 }}>📥 Import से पहले जाँच लें</div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                  {preview.sourceFile} → sheet "{preview.sheetName}" (A1:L31)
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setPreview(null)} disabled={busy} style={btn('#334155')}>रद्द करें</button>
                <button onClick={savePreview} disabled={busy} style={btn('#16a34a', { opacity: busy ? 0.6 : 1 })}>
                  {busy ? '⏳ सेव हो रहा है…' : `✅ सेव करें (${preview.modelCount} models)`}
                </button>
              </div>
            </div>

            {/* सार */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0' }}>
              {[
                ['🏍️ Models', preview.modelCount, '#334155'],
                ['▲ दाम बढ़ा', preview.compare.up, '#9a3412'],
                ['▼ दाम घटा', preview.compare.down, '#166534'],
                ['🆕 नए model', preview.compare.added, '#1d4ed8'],
                ['➖ हटे model', preview.compare.removed.length, '#475569'],
              ].map(([l, v, bg]) => (
                <div key={l} style={{ background: bg, color: '#fff', borderRadius: 9, padding: '7px 12px', fontSize: 12.5, fontWeight: 800 }}>
                  {l}: {v}
                </div>
              ))}
            </div>
            {preview.compare.removed.length > 0 && (
              <div style={{ color: '#cbd5e1', fontSize: 12, marginBottom: 8 }}>
                नई list में नहीं हैं: {preview.compare.removed.join(', ')}
              </div>
            )}
            {preview.warnings.length > 0 && (
              <div style={{ background: '#78350f', color: '#fef3c7', borderRadius: 9, padding: '8px 12px', marginBottom: 10, fontSize: 12.5 }}>
                <b>⚠️ Excel का जोड़ मेल नहीं खा रहा — जाँच लें (फिर भी सेव हो सकता है):</b>
                {preview.warnings.map((w, i) => <div key={i} style={{ marginTop: 3 }}>• {w}</div>)}
              </div>
            )}

            <div style={{ background: '#fff', borderRadius: 10, padding: 8 }}>
              <PriceTable data={preview} changes={preview.compare.changes} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
