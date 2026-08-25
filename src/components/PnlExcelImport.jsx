// ════════════════════════════════════════════════════════════════════════════
// PnlExcelImport.jsx — Veh_Details.xlsm की "Summary" sheet सीधे app में
// ════════════════════════════════════════════════════════════════════════════
// क्यों बना:
//   Profit & Loss का पूरा डेटा Dashboard.jsx में hardcode पड़ा था. नया महीना
//   जोड़ने के लिए हर बार code बदलना पड़ता — app में कोई बटन ही नहीं था.
//
// अब: Excel file चुनिए → column अपने आप पहचाने जाते हैं → preview देखिए →
//     गलत लगे तो हाथ से column बदल लीजिए → "लागू करें" दबाइए.
//
// वही महीना दोबारा import हो तो नया record नहीं बनता, पुराना update होता है.
// इसलिए Excel में नया महीना भरकर पूरी file दोबारा import करना सुरक्षित है.
// ════════════════════════════════════════════════════════════════════════════

import { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { api } from '../utils/apiConfig';

// ── हमें किन-किन खानों की ज़रूरत है, और Excel में वे किन नामों से हो सकते हैं ──
// नाम मिलाते समय छोटे-बड़े अक्षर, space और spelling की मामूली गलतियाँ नज़रअंदाज़
// होती हैं (आपकी file में "Margine", "Accesory", "Sallery" जैसी spellings हैं).
const FIELDS = [
  { key:'month',    label:'महीना',            need:true,  match:['month','महीना','mnth'] },
  { key:'vehSale',  label:'गाड़ियाँ बिकीं',    need:false, match:['vehsale','vehiclesale','vehsold','vehsales'] },
  { key:'fin',      label:'Finance वाली',     need:false, match:['fin','finance','financed'] },
  { key:'cash',     label:'Cash वाली',        need:false, match:['cash','cashsale'] },
  { key:'access',   label:'Accessories आमदनी', need:false, match:['access','accessmargin','accessories','accessorymargin'] },
  { key:'rto',      label:'RTO margin',       need:false, match:['rto','rtomargine','rtomargin'] },
  { key:'ins',      label:'Insurance margin', need:false, match:['insurance','insurancemrgine','insurancemargin','insmargin'] },
  { key:'service',  label:'Service आमदनी',    need:false, match:['service','serviceprice','servicemargin','vehservic'] },
  { key:'ew',       label:'EW (warranty)',    need:false, match:['ew','extendedwarranty','ewmargin'] },
  { key:'gift',     label:'Gift ख़र्च',        need:false, match:['gift','gifts'] },
  { key:'accesory', label:'Accessory खरीद',   need:false, match:['accesorybuy','accessorybuy','acessories','accessorypurchase'] },
  { key:'rent',     label:'किराया + वेतन',     need:false, match:['rentsallery','rentsalary','rent','sallery','salary','rentsal'] },
  { key:'other',    label:'अन्य ख़र्च',        need:false, match:['otherexpense','other','otherexp','misc'] },
  { key:'parts',    label:'Parts खरीद',       need:false, match:['partspurcs','partspurchase','parts','partsbuy'] },
  { key:'pft',      label:'महीने का लाभ',      need:false, match:['monthwisepft','monthlypft','pft','netprofit','profit'] },
];

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const MONTHS = { jan:'Jan', feb:'Feb', mar:'Mar', apr:'Apr', may:'May', jun:'Jun',
                 jul:'Jul', aug:'Aug', sep:'Sep', oct:'Oct', nov:'Nov', dec:'Dec' };

/** "Sep-24" / "Oct-2024" / Excel की तारीख़ — तीनों से महीना+साल निकालो */
function parseMonth(v) {
  if (v === null || v === undefined || v === '') return null;

  // Excel कभी-कभी तारीख़ को संख्या में रखता है
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return { m: Object.values(MONTHS)[d.getUTCMonth()], y: d.getUTCFullYear() };
  }
  if (v instanceof Date && !isNaN(v)) {
    return { m: Object.values(MONTHS)[v.getMonth()], y: v.getFullYear() };
  }

  const s = String(v).trim();
  const mm = s.match(/([A-Za-z]{3,9})[\s\-/,]*(\d{2,4})/);
  if (!mm) return null;
  const m = MONTHS[mm[1].slice(0, 3).toLowerCase()];
  if (!m) return null;
  let y = parseInt(mm[2], 10);
  if (y < 100) y += 2000;                       // "24" → 2024
  if (y < 2000 || y > 2100) return null;
  return { m, y };
}

/** "02 (F)+00(C)= 02" / "30+11=41" / "14" — तीनों से गाड़ियों की गिनती */
function parseVehCount(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Math.round(v);
  const s = String(v);
  // "= 41" जैसा जोड़ लिखा हो तो वही लो
  const eq = s.match(/=\s*(\d+)\s*$/);
  if (eq) return parseInt(eq[1], 10);
  // वरना सारे अंक जोड़ दो
  const nums = s.match(/\d+/g);
  if (!nums) return 0;
  return nums.reduce((a, n) => a + parseInt(n, 10), 0);
}

/** "-₹ 24,243.24" / "(1,234)" / 1234.5 — तीनों से संख्या */
function parseMoney(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v).replace(/[₹,\s]/g, '');
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }   // (123) = -123
  if (s.startsWith('-')) { negative = true; s = s.slice(1); }
  const n = parseFloat(s);
  if (!isFinite(n)) return 0;
  return negative ? -n : n;
}

const fmtINR = n => {
  const a = Math.abs(n || 0), sg = (n || 0) < 0 ? '-' : '';
  if (a >= 1e5) return `${sg}₹${(a / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `${sg}₹${(a / 1e3).toFixed(1)}K`;
  return `${sg}₹${Math.round(a)}`;
};

const C = { border:'rgba(255,255,255,.1)', muted:'#94a3b8', dim:'#64748b' };
const fld = {
  background:'rgba(255,255,255,.05)', border:`1px solid ${C.border}`, borderRadius:9,
  padding:'7px 9px', color:'#fff', fontSize:12, outline:'none', width:'100%', boxSizing:'border-box',
};

export default function PnlExcelImport({ onDone, onClose }) {
  const [step,    setStep]    = useState('pick');   // pick | map | done
  const [sheets,  setSheets]  = useState([]);
  const [sheet,   setSheet]   = useState('');
  const [grid,    setGrid]    = useState([]);       // पूरी sheet, कच्ची
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState({});       // fieldKey → column index
  const [err,     setErr]     = useState('');
  const [busy,    setBusy]    = useState(false);
  const [result,  setResult]  = useState(null);
  const [fileName, setFileName] = useState('');
  const inputRef = useRef(null);

  // ── file पढ़ो ────────────────────────────────────────────────────────────
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr(''); setBusy(true); setFileName(f.name);
    try {
      const XLSX = await import('xlsx');
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type:'array', cellDates:true });
      setSheets(wb.SheetNames);

      // "Summary" नाम की sheet अपने आप चुन लो
      const pick = wb.SheetNames.find(n => norm(n).includes('summary')) || wb.SheetNames[0];
      loadSheet(wb, pick, XLSX);
      setStep('map');
    } catch (e2) {
      setErr('File नहीं पढ़ी जा सकी: ' + e2.message);
    }
    setBusy(false);
  };

  const loadSheet = (wb, name, XLSX) => {
    setSheet(name);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header:1, defval:'', raw:true });
    setGrid(rows);

    // header वाली पंक्ति खोजो — जिसमें "month" जैसा शब्द हो
    let hr = rows.findIndex(r => r.some(c => norm(c) === 'month'));
    if (hr < 0) hr = rows.findIndex(r => r.filter(c => String(c).trim()).length >= 5);
    if (hr < 0) hr = 0;
    setHeaderRow(hr);
    setMapping(autoMap(rows[hr] || []));
  };

  const changeSheet = async (name) => {
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const f = inputRef.current?.files?.[0];
      if (!f) return;
      const wb = XLSX.read(await f.arrayBuffer(), { type:'array', cellDates:true });
      loadSheet(wb, name, XLSX);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  /**
   * header के नामों से अपने आप column पहचानो.
   *
   * ⚠️ पहला तरीक़ा बहुत ढीला था — "Accesory Buy" वाला खाना "Access" column पकड़
   * लेता था और "Month Wise PFT" वाला "Month". इसलिए अब अंक (score) दिए जाते हैं
   * और सबसे ऊँचे अंक वाली जोड़ी पहले तय होती है:
   *    100 = बिल्कुल वही नाम        ("accesorybuy" = "Accesory Buy")
   *     80 = header के अंदर पूरा नाम ("partspurcs" ⊂ "Parts Purcs")
   *     40 = नाम के अंदर header, पर तभी जब header काफ़ी लंबा हो
   */
  const autoMap = (header) => {
    const score = (fieldMatches, h) => {
      const n = norm(h);
      if (!n) return 0;
      let best = 0;
      for (const mt of fieldMatches) {
        if (n === mt) best = Math.max(best, 100);
        else if (n.includes(mt)) best = Math.max(best, 80 - (n.length - mt.length));
        else if (mt.includes(n) && n.length >= 6) best = Math.max(best, 40);
      }
      return best;
    };

    // हर (खाना, column) जोड़ी के अंक निकालो
    const pairs = [];
    FIELDS.forEach(f => {
      header.forEach((h, i) => {
        const sc = score(f.match, h);
        if (sc > 0) pairs.push({ field: f.key, col: i, sc });
      });
    });

    // सबसे पक्की जोड़ी पहले — एक column एक ही खाने को मिलेगा
    pairs.sort((a, b) => b.sc - a.sc);
    const map = {}, usedCols = new Set();
    for (const p of pairs) {
      if (map[p.field] !== undefined || usedCols.has(p.col)) continue;
      map[p.field] = p.col;
      usedCols.add(p.col);
    }
    return map;
  };

  const reMapHeader = (hr) => { setHeaderRow(hr); setMapping(autoMap(grid[hr] || [])); };

  // ── preview बनाओ ────────────────────────────────────────────────────────
  const preview = (() => {
    if (mapping.month === undefined) return [];
    const out = [];
    for (let i = headerRow + 1; i < grid.length; i++) {
      const row = grid[i] || [];
      const mo = parseMonth(row[mapping.month]);
      if (!mo) continue;                                  // Grand Total जैसी पंक्तियाँ अपने आप छूट जाती हैं
      const g = k => mapping[k] !== undefined ? row[mapping[k]] : '';
      const r = {
        m: mo.m, y: mo.y,
        // गाड़ियों की गिनती: "Veh Sale" हो तो वही, वरना Fin + Cash
        veh: mapping.vehSale !== undefined
          ? parseVehCount(g('vehSale'))
          : parseVehCount(g('fin')) + parseVehCount(g('cash')),
        fin: parseVehCount(g('fin')), cash: parseVehCount(g('cash')),
        access: parseMoney(g('access')), rto: parseMoney(g('rto')), ins: parseMoney(g('ins')),
        service: parseMoney(g('service')), ew: parseMoney(g('ew')),
        gift: parseMoney(g('gift')), accesory: parseMoney(g('accesory')),
        rent: parseMoney(g('rent')), other: parseMoney(g('other')), parts: parseMoney(g('parts')),
        pft: mapping.pft !== undefined ? parseMoney(g('pft')) : '',
      };
      // pft न मिले तो खुद जोड़ लो (ख़र्च ऋणात्मक मानकर)
      if (r.pft === '' || r.pft === 0) {
        const neg = v => -Math.abs(v);
        r.pft = r.access + r.rto + r.ins + r.service + r.ew +
                neg(r.gift) + neg(r.accesory) + neg(r.rent) + neg(r.other) + neg(r.parts);
      }
      out.push(r);
    }
    return out;
  })();

  const apply = async () => {
    if (!preview.length) { setErr('कोई महीना नहीं मिला — column mapping जाँचें'); return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch(api('/api/pnl/import'), {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ rows: preview }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || 'import नहीं हुआ');
      setResult(out); setStep('done');
      onDone?.();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const header = grid[headerRow] || [];
  const missing = FIELDS.filter(f => f.need && mapping[f.key] === undefined);

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.9)', backdropFilter:'blur(8px)',
      zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', padding:14,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'linear-gradient(135deg,#1e293b,#0f172a)', border:`1px solid ${C.border}`,
        borderRadius:20, width:'100%', maxWidth:940, maxHeight:'92vh', overflowY:'auto', padding:20,
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <h3 style={{ margin:0, fontSize:17, fontWeight:800, display:'flex', alignItems:'center', gap:8 }}>
            <FileSpreadsheet size={18} color="#22c55e"/> Excel से Profit &amp; Loss
          </h3>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.06)', border:'none', borderRadius:'50%', width:30, height:30, color:C.muted, cursor:'pointer' }}>
            <X size={15}/>
          </button>
        </div>

        {/* ── 1. file चुनें ── */}
        {step === 'pick' && (
          <>
            <p style={{ color:C.dim, fontSize:12, margin:'0 0 16px' }}>
              अपनी <b style={{ color:'#cbd5e1' }}>Veh_Details_Jan_25.xlsm</b> चुनिए. उसकी
              <b style={{ color:'#cbd5e1' }}> Summary</b> sheet अपने आप पहचान ली जाएगी.
            </p>
            <button onClick={() => inputRef.current?.click()} style={{
              width:'100%', padding:'34px 20px', background:'rgba(34,197,94,.07)',
              border:'2px dashed rgba(34,197,94,.4)', borderRadius:16, color:'#86efac',
              fontSize:14, fontWeight:700, cursor:'pointer', display:'flex',
              flexDirection:'column', alignItems:'center', gap:10,
            }}>
              <Upload size={30}/>
              Excel file चुनें
              <span style={{ color:C.dim, fontSize:11, fontWeight:600 }}>.xlsm · .xlsx · .xls · .csv</span>
            </button>
            <p style={{ color:C.dim, fontSize:11, margin:'14px 0 0', lineHeight:1.6 }}>
              ℹ️ कुछ मिटेगा नहीं. जो महीने पहले से हैं वे <b style={{ color:'#cbd5e1' }}>update</b> होंगे,
              नए <b style={{ color:'#cbd5e1' }}>जुड़</b> जाएँगे. लगाने से पहले पूरा preview दिखेगा.
            </p>
          </>
        )}

        {/* ── 2. mapping + preview ── */}
        {step === 'map' && (
          <>
            <p style={{ color:C.dim, fontSize:11.5, margin:'0 0 12px' }}>
              📄 {fileName} · <b style={{ color:'#cbd5e1' }}>{preview.length} महीने</b> मिले
            </p>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:9, marginBottom:14 }}>
              <div>
                <label style={{ color:C.muted, fontSize:10.5, fontWeight:700, display:'block', marginBottom:4 }}>Sheet</label>
                <select value={sheet} onChange={e => changeSheet(e.target.value)} style={fld}>
                  {sheets.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color:C.muted, fontSize:10.5, fontWeight:700, display:'block', marginBottom:4 }}>
                  Header किस पंक्ति में है
                </label>
                <select value={headerRow} onChange={e => reMapHeader(Number(e.target.value))} style={fld}>
                  {grid.slice(0, 45).map((r, i) => (
                    <option key={i} value={i}>
                      पंक्ति {i + 1} — {r.filter(c => String(c).trim()).slice(0, 4).join(' | ').slice(0, 46) || '(खाली)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* column मिलान */}
            <div style={{ background:'rgba(255,255,255,.03)', border:`1px solid ${C.border}`, borderRadius:14, padding:13, marginBottom:14 }}>
              <p style={{ color:'#cbd5e1', fontSize:12, fontWeight:800, margin:'0 0 3px' }}>Column मिलान</p>
              <p style={{ color:C.dim, fontSize:10.5, margin:'0 0 11px' }}>
                अपने आप पहचाने गए हैं. कोई गलत लगे तो यहीं बदल दीजिए.
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(178px,1fr))', gap:8 }}>
                {FIELDS.map(f => (
                  <div key={f.key}>
                    <label style={{ color: mapping[f.key] === undefined ? '#64748b' : '#86efac', fontSize:10, fontWeight:700, display:'block', marginBottom:3 }}>
                      {f.label}{f.need ? ' *' : ''}
                    </label>
                    <select
                      value={mapping[f.key] ?? ''}
                      onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) }))}
                      style={{ ...fld, fontSize:11, padding:'6px 8px',
                        borderColor: f.need && mapping[f.key] === undefined ? '#ef4444' : C.border }}
                    >
                      <option value="">— नहीं है —</option>
                      {header.map((h, i) => (
                        <option key={i} value={i}>
                          {String.fromCharCode(65 + (i % 26))}: {String(h).slice(0, 22) || '(खाली)'}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {missing.length > 0 && (
              <p style={{ color:'#fca5a5', fontSize:11.5, background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.25)', borderRadius:10, padding:'9px 12px', margin:'0 0 12px' }}>
                <AlertTriangle size={12} style={{ verticalAlign:'-2px' }}/> ज़रूरी column नहीं मिला: {missing.map(f => f.label).join(', ')}
              </p>
            )}

            {/* preview */}
            {preview.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <p style={{ color:'#cbd5e1', fontSize:12, fontWeight:800, margin:'0 0 7px' }}>
                  Preview — यही सेव होगा
                </p>
                <div style={{ overflowX:'auto', maxHeight:270, overflowY:'auto', border:`1px solid ${C.border}`, borderRadius:12 }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11, minWidth:700 }}>
                    <thead style={{ position:'sticky', top:0, background:'#0f172a' }}>
                      <tr style={{ color:C.muted }}>
                        {['महीना','गाड़ी','Access','RTO','Ins','Service','Gift','Acc.खरीद','किराया','अन्य','Parts','लाभ'].map((h, i) => (
                          <th key={h} style={{ padding:'7px 8px', textAlign: i === 0 ? 'left' : 'right', borderBottom:`1px solid ${C.border}`, fontWeight:700, whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i} style={{ borderBottom:`1px solid rgba(255,255,255,.04)` }}>
                          <td style={{ padding:'5px 8px', fontWeight:700, whiteSpace:'nowrap' }}>{r.m} {r.y}</td>
                          <td style={{ padding:'5px 8px', textAlign:'right' }}>{r.veh}</td>
                          {['access','rto','ins','service'].map(k => (
                            <td key={k} style={{ padding:'5px 8px', textAlign:'right', color:'#4ade80' }}>{fmtINR(r[k])}</td>
                          ))}
                          {['gift','accesory','rent','other','parts'].map(k => (
                            <td key={k} style={{ padding:'5px 8px', textAlign:'right', color:'#fca5a5' }}>{fmtINR(-Math.abs(r[k]))}</td>
                          ))}
                          <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:900, color: r.pft > 0 ? '#22c55e' : '#ef4444' }}>{fmtINR(r.pft)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ color:C.dim, fontSize:10.5, margin:'7px 0 0' }}>
                  ℹ️ "Grand Total" जैसी पंक्तियाँ अपने आप छूट जाती हैं — जिनमें महीना नहीं लिखा, वे नहीं आतीं।
                </p>
              </div>
            )}

            {err && <p style={{ color:'#fca5a5', fontSize:12, margin:'0 0 10px' }}>⚠️ {err}</p>}

            <div style={{ display:'flex', gap:9 }}>
              <button onClick={() => { setStep('pick'); setGrid([]); }} style={{
                flex:1, background:'rgba(255,255,255,.04)', border:`1px solid ${C.border}`,
                borderRadius:12, padding:11, color:C.muted, fontSize:12, fontWeight:700, cursor:'pointer',
              }}>दूसरी file चुनें</button>
              <button onClick={apply} disabled={busy || !preview.length} style={{
                flex:2, background: preview.length ? 'linear-gradient(135deg,#059669,#047857)' : '#334155',
                border:'none', borderRadius:12, padding:11, color:'#fff', fontSize:12.5, fontWeight:800,
                cursor: preview.length ? 'pointer' : 'not-allowed', opacity: busy ? .6 : 1,
              }}>
                {busy ? '⏳ लग रहा है…' : `✅ ${preview.length} महीने लागू करें`}
              </button>
            </div>
          </>
        )}

        {/* ── 3. हो गया ── */}
        {step === 'done' && result && (
          <div style={{ textAlign:'center', padding:'26px 10px' }}>
            <CheckCircle size={44} color="#22c55e" style={{ marginBottom:12 }}/>
            <p style={{ fontSize:17, fontWeight:800, margin:'0 0 6px' }}>हो गया!</p>
            <p style={{ color:C.muted, fontSize:13, margin:'0 0 4px' }}>
              {result.added} नए महीने जुड़े · {result.updated} update हुए
            </p>
            {result.skipped?.length > 0 && (
              <p style={{ color:C.dim, fontSize:11 }}>{result.skipped.length} पंक्तियाँ छोड़ी गईं (महीना नहीं मिला)</p>
            )}
            <button onClick={onClose} style={{
              marginTop:18, background:'linear-gradient(135deg,#059669,#047857)', border:'none',
              borderRadius:12, padding:'11px 30px', color:'#fff', fontSize:12.5, fontWeight:800, cursor:'pointer',
            }}>बंद करें</button>
          </div>
        )}

        <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.xls,.csv" onChange={onFile} style={{ display:'none' }}/>
      </div>
    </div>
  );
}
