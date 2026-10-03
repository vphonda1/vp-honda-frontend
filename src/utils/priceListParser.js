// ════════════════════════════════════════════════════════════════════════════
// src/utils/priceListParser.js — Excel की "Rate List" sheet → Price List data
// ════════════════════════════════════════════════════════════════════════════
// सिर्फ़ A1:L31 पढ़ा जाता है (S No … Grand Total). M कॉलम (Diff) और 31 के
// नीचे वाली पुरानी price list (01-AUG-2026 वाली) जान-बूझकर नहीं ली जाती.
//
// कॉलम अक्षर से नहीं, **heading के नाम** से पहचाने जाते हैं (EX-Shroom, RTO,
// Insur …). इसलिए Excel में कोई कॉलम थोड़ा खिसक जाए (जैसे C और E के बीच
// वाला पतला D कॉलम) तब भी सही data आता है. heading न मिले तो Excel वाली
// तय जगह (A,B,C,E,F,G,H,I,J,K,L) से पढ़ता है.
// ════════════════════════════════════════════════════════════════════════════

export const PRICE_RANGE = 'A1:L31';

// field → heading पहचानने का नियम (क्रम ज़रूरी है — पहले ज़्यादा ख़ास वाले)
const FIELDS = [
  ['sNo',        (t) => /^s\.?\s*no\.?$/.test(t) || t === 'sno' || t === 'sr no' || t === 'sr.no'],
  ['model',      (t) => /model|vehicle/.test(t)],
  ['grandTotal', (t) => /grand|^total/.test(t)],
  ['offerPrice', (t) => /offer|on.?road/.test(t)],
  ['exShowroom', (t) => /^ex|show\s*room|shroom/.test(t)],
  ['rto',        (t) => /^rto|registration/.test(t)],
  ['insurance',  (t) => /^insur/.test(t)],
  ['zeroDep',    (t) => /0\s*%|zero|dep/.test(t)],
  ['warranty',   (t) => /3\s*\+\s*3|warrant|\byr\b/.test(t)],
  ['accessory',  (t) => /acces|acc\b/.test(t)],
  ['cc',         (t) => /^cc$/.test(t)],
];

// Excel में जहाँ ये कॉलम हैं (0 = A). heading न पहचानी जाए तब यही.
const DEFAULT_COLS = {
  sNo: 0, model: 1, cc: 2, exShowroom: 4, rto: 5, insurance: 6,
  offerPrice: 7, zeroDep: 8, warranty: 9, accessory: 10, grandTotal: 11,
};

const MONEY_FIELDS = ['exShowroom', 'rto', 'insurance', 'offerPrice', 'zeroDep', 'warranty', 'accessory', 'grandTotal'];

const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const lower = (v) => norm(v).toLowerCase();

/** "₹ 78,493.00" / 78493 / "78493" → 78493 ;  खाली / text → null */
export function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? Math.round(v * 100) / 100 : null;
  const s = String(v).replace(/[₹,\s]|rs\.?/gi, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100) / 100;
}

/** model का नाम मिलाने के लिए एक-जैसा रूप (space, - , _ हटाकर) */
export const modelKey = (name) => String(name || '').toUpperCase().replace(/[\s\-_.]+/g, '');

// ════════════════════════════════════════════════════════════════════════════
// workbook में "Rate List" sheet ढूँढो
// ════════════════════════════════════════════════════════════════════════════
export function findRateSheetName(XLSX, workbook) {
  const names = workbook.SheetNames || [];
  // 1. नाम से — Rate_List, Rate List, RATE LIST, रेट लिस्ट
  const byName = names.find(n => /rate[\s_\-.]*list/i.test(n) || /रेट\s*लिस्ट/.test(n));
  if (byName) return byName;
  // 2. अंदर "PRICE LIST" लिखा हो
  for (const n of names) {
    try {
      const top = XLSX.utils.sheet_to_json(workbook.Sheets[n], { header: 1, range: 'A1:L6', defval: '' });
      if (top.some(r => r.some(c => /price\s*list/i.test(String(c))))) return n;
    } catch { /* अगली sheet */ }
  }
  return null;
}

/** sheet का A1:L31 हिस्सा → 2D array (पहली row = Excel की row 1) */
export function sheetToGrid(XLSX, sheet) {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1, range: PRICE_RANGE, raw: true, defval: '', blankrows: true,
  });
}

// ════════════════════════════════════════════════════════════════════════════
// मुख्य काम: grid → { title, groups, headers, rows, notes, warnings }
// ════════════════════════════════════════════════════════════════════════════
export function parsePriceGrid(grid) {
  const rowsIn = Array.isArray(grid) ? grid : [];

  // ── heading वाली row (जिसमें "Model" लिखा है) ─────────────────────────────
  let hIdx = -1;
  for (let i = 0; i < Math.min(rowsIn.length, 10); i++) {
    if ((rowsIn[i] || []).some(c => /model/i.test(String(c)))) { hIdx = i; break; }
  }
  if (hIdx < 0) {
    throw new Error('Sheet में "Model" वाली heading नहीं मिली — क्या यह सही Rate List sheet है?');
  }

  // ── heading से कॉलम पहचानो ────────────────────────────────────────────────
  const hRow = rowsIn[hIdx] || [];
  const cols = {};
  const headers = {};
  hRow.forEach((cell, ci) => {
    const t = lower(cell);
    if (!t) return;
    for (const [field, test] of FIELDS) {
      if (cols[field] === undefined && test(t)) { cols[field] = ci; headers[field] = norm(cell); break; }
    }
  });
  for (const [field, ci] of Object.entries(DEFAULT_COLS)) {
    if (cols[field] === undefined) cols[field] = ci;
    if (!headers[field]) headers[field] = norm(hRow[ci]) || '';
  }

  // ── title (ऊपर "PRICE LIST" वाली लाइन) और group (ON-ROAD / OPTIONAL) ──────
  let title = '';
  const groups = { onRoad: '', optional: '' };
  for (let i = 0; i < hIdx; i++) {
    for (const c of rowsIn[i] || []) {
      const t = norm(c);
      if (!t) continue;
      if (!title && /price\s*list/i.test(t)) title = t;
      else if (!groups.onRoad && /on.?road/i.test(t)) groups.onRoad = t;
      else if (!groups.optional && /optional/i.test(t)) groups.optional = t;
    }
  }

  // ── data rows ─────────────────────────────────────────────────────────────
  const rows = [];
  const notes = [];
  const warnings = [];
  let seenModel = false;

  for (let i = hIdx + 1; i < rowsIn.length; i++) {
    const r = rowsIn[i] || [];
    const cells = r.map(norm);
    if (!cells.some(Boolean)) continue;                       // ख़ाली row

    const model  = cells[cols.model];
    const values = {};
    MONEY_FIELDS.forEach(f => { values[f] = toNumber(r[cols[f]]); });
    const hasNumbers = MONEY_FIELDS.some(f => values[f] !== null);

    // ⭐ असली model वाली row
    if (model && hasNumbers && !/extra|charge/i.test(model)) {
      seenModel = true;
      let cc = r[cols.cc];
      cc = typeof cc === 'number' ? `${cc} CC` : norm(cc);
      const item = {
        type: 'model',
        sNo: norm(r[cols.sNo]),
        model,
        cc,
        ...values,
      };
      rows.push(item);

      // जाँच — Excel का जोड़ ठीक है? (सिर्फ़ चेतावनी, import नहीं रुकता)
      const { exShowroom: ex, rto, insurance: ins, offerPrice: op, zeroDep: zd, warranty: w, accessory: ac, grandTotal: gt } = item;
      if ([ex, rto, ins, op].every(v => v !== null) && Math.abs(ex + rto + ins - op) > 1) {
        warnings.push(`${model}: Ex-Showroom + RTO + Insurance (₹${fmt(ex + rto + ins)}) ≠ Offer Price (₹${fmt(op)})`);
      }
      if ([op, zd, w, ac, gt].every(v => v !== null) && Math.abs(op + zd + w + ac - gt) > 1) {
        warnings.push(`${model}: Offer + Optional (₹${fmt(op + zd + w + ac)}) ≠ Grand Total (₹${fmt(gt)})`);
      }
      continue;
    }

    // बिना अंकों वाली row — या तो नीचे की note, या बीच की group heading (SCOOTER / BIKE)
    const texts = cells.filter(Boolean);
    const looksLikeNote = texts.some(t => /extra|rs\.?\s*\d|₹\s*\d|charge|registration|insurance|note/i.test(t));
    if (looksLikeNote || (seenModel && texts.join(' ').length > 40)) {
      texts.forEach(t => { if (!notes.includes(t)) notes.push(t); });
    } else if (!hasNumbers) {
      rows.push({ type: 'section', label: texts.join(' ') });
    }
  }

  // आख़िर में पड़ी ख़ाली section headings हटाओ
  while (rows.length && rows[rows.length - 1].type === 'section') rows.pop();

  const modelCount = rows.filter(x => x.type === 'model').length;
  if (!modelCount) {
    throw new Error('A1:L31 में एक भी model की कीमत नहीं मिली — Excel में Model और EX-Shroom कॉलम जाँचें.');
  }

  return { title, groups, headers, rows, notes, warnings, modelCount };
}

/** पूरा काम एक साथ: workbook → price list */
export function parsePriceWorkbook(XLSX, workbook) {
  const sheetName = findRateSheetName(XLSX, workbook);
  if (!sheetName) {
    throw new Error(
      `इस file में "Rate List" sheet नहीं मिली.\nमौजूद sheets: ${(workbook.SheetNames || []).join(', ') || '—'}`
    );
  }
  const grid = sheetToGrid(XLSX, workbook.Sheets[sheetName]);
  return { sheetName, ...parsePriceGrid(grid) };
}

// ════════════════════════════════════════════════════════════════════════════
// पुरानी और नई list की तुलना — किसका दाम बढ़ा / घटा / नया model
// ════════════════════════════════════════════════════════════════════════════
export function comparePriceLists(oldRows = [], newRows = []) {
  const oldMap = new Map();
  (oldRows || []).filter(r => r.type === 'model').forEach(r => oldMap.set(modelKey(r.model), r));

  const changes = {};          // modelKey → { grandTotal: diff, exShowroom: diff, … , isNew }
  let up = 0, down = 0, added = 0;
  const seen = new Set();

  (newRows || []).filter(r => r.type === 'model').forEach(r => {
    const k = modelKey(r.model);
    seen.add(k);
    const o = oldMap.get(k);
    if (!o) { changes[k] = { isNew: true }; added++; return; }
    const diff = {};
    MONEY_FIELDS.forEach(f => {
      if (r[f] !== null && o[f] !== null && r[f] !== undefined && o[f] !== undefined) {
        const d = Math.round((r[f] - o[f]) * 100) / 100;
        if (Math.abs(d) >= 0.5) diff[f] = d;
      }
    });
    if (Object.keys(diff).length) {
      changes[k] = diff;
      const main = diff.grandTotal ?? diff.offerPrice ?? diff.exShowroom ?? 0;
      if (main > 0) up++; else if (main < 0) down++;
    }
  });

  const removed = [...oldMap.keys()].filter(k => !seen.has(k)).map(k => oldMap.get(k).model);
  return { changes, up, down, added, removed };
}

/** Vehicle Dashboard की auto-price के लिए (localStorage 'sharedRatePrices') */
export function mergeIntoSharedRatePrices(rows) {
  try {
    const cur = JSON.parse(localStorage.getItem('sharedRatePrices') || '{}') || {};
    (rows || []).filter(r => r.type === 'model' && r.exShowroom > 0).forEach(r => {
      const k = String(r.model).trim().toUpperCase();
      cur[k] = { ...(typeof cur[k] === 'object' ? cur[k] : {}), exShowroom: r.exShowroom };
    });
    localStorage.setItem('sharedRatePrices', JSON.stringify(cur));
  } catch { /* storage भरा हो तो चुपचाप छोड़ दो */ }
}

/** ₹ वाला रूप — Excel जैसा: 78,493.00 */
export function fmt(n, decimals = 2) {
  if (n === null || n === undefined || n === '') return '';
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
