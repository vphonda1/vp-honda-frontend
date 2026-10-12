// ════════════════════════════════════════════════════════════════════════════
//  scanTrim.js — VP Honda Document Vault
//  फ़ोटो में से "कोरा काग़ज़" (खाली जगह) हटाने का engine
// ────────────────────────────────────────────────────────────────────────────
//  क्यों बना:
//  आधार कार्ड की फ़ोटोकॉपी A4 पेज पर छपती है — ऊपर आगे वाला कार्ड,
//  नीचे पीछे वाला कार्ड, और दोनों के बीच बहुत बड़ी खाली जगह।
//  Print करते वक़्त वही खाली जगह भी छपती है और कार्ड दूर-दूर दिखते हैं।
//
//  यह file उस खाली जगह को पहचानकर काट देती है, जिससे दोनों कार्ड
//  एक-दूसरे से सटकर आ जाते हैं।
//
//  ⚠️ सबसे ज़रूरी बात — कार्ड के अन्दर कुछ भी नहीं बदलता:
//    • कोई resize नहीं    → drawImage हमेशा 1:1 (sw→sw, sh→sh)
//    • कोई rotate नहीं
//    • कोई colour/brightness/contrast बदलाव नहीं
//    • कोई sharpen/filter नहीं
//    • imageSmoothingEnabled = false (एक भी pixel interpolate नहीं होता)
//    नाम, पता, DOB, फ़ोटो, QR, Aadhaar number — सब hubहू वैसा ही copy होता है।
//    सिर्फ़ कार्ड के *बाहर* की कोरी जगह कटती है।
//
//  पहचान कैसे होती है (shadow-proof):
//    साधारण "सफ़ेद pixel" जाँच यहाँ फेल होती है, क्योंकि मोबाइल से खींची
//    फ़ोटो में परछाईं (shadow) होती है — वह सफ़ेद नहीं होती, पर है तो खाली ही।
//    इसलिए हम local-mean (आस-पास का औसत) से तुलना करते हैं:
//      ink = (आस-पास का औसत − यह pixel) > delta
//    परछाईं धीरे-धीरे बदलती है इसलिए औसत भी उसी के साथ गिरता है → ink नहीं बनती।
//    अक्षर/लकीर तेज़ी से बदलते हैं → ink बनती है। यही असली तरीका है।
//
//  Location: src/utils/scanTrim.js
// ════════════════════════════════════════════════════════════════════════════

export const TRIM_DEFAULTS = {
  analyzeWidth: 800,   // जाँच इतनी चौड़ाई पर होती है (तेज़ी के लिए) — काटना full-res पर
  sensitivity:  1.0,   // 0.6 = कम पकड़े … 1.8 = ज़्यादा पकड़े
  gap:          0,     // दो हिस्सों के बीच कितने px छोड़ें (0 = बिल्कुल सटे हुए)
  margin:       10,    // हर हिस्से के चारों ओर कितनी कोरी जगह बची रहे
  sideTrim:     true,  // दाएँ-बाएँ की खाली जगह भी काटें?
  quality:      0.95,  // JPEG quality (सिर्फ़ दोबारा save करते वक़्त)
  lossless:     false, // true = PNG (एक भी pixel का फ़र्क़ नहीं, पर file भारी)
};

// ── 1. कोई भी source → bitmap ───────────────────────────────────────────────
//    File / Blob / dataURL / http URL — सब चलेगा.
export async function loadSource(src) {
  if (!src) throw new Error('कोई file नहीं मिली');

  // पहले से bitmap/canvas/image है?
  if (typeof HTMLCanvasElement !== 'undefined' && src instanceof HTMLCanvasElement) return src;
  if (typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap) return src;
  if (typeof HTMLImageElement !== 'undefined' && src instanceof HTMLImageElement && src.complete) return src;

  const isBlob = (typeof Blob !== 'undefined') && (src instanceof Blob);

  // ✅ createImageBitmap — EXIF rotation खुद सँभाल लेता है
  if (isBlob && typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(src, { imageOrientation: 'from-image' });
    } catch { /* नीचे <img> वाला रास्ता */ }
  }

  const url = isBlob ? URL.createObjectURL(src) : String(src);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new window.Image();
      if (!isBlob && /^https?:/i.test(url)) el.crossOrigin = 'anonymous';
      el.onload  = () => resolve(el);
      el.onerror = () => reject(new Error('photo खुल नहीं पाई'));
      el.src = url;
    });
    // decode() से सुनिश्चित होता है कि pixel सचमुच तैयार हैं
    if (img.decode) { try { await img.decode(); } catch {} }
    return img;
  } finally {
    if (isBlob) setTimeout(() => URL.revokeObjectURL(url), 15000);
  }
}

export const sizeOf = (img) => ({
  width:  img.naturalWidth  || img.width,
  height: img.naturalHeight || img.height,
});

// ── 2. ink mask — कहाँ कुछ छपा है और कहाँ कोरा काग़ज़ है ────────────────────
function buildMask(img, analyzeWidth, sensitivity) {
  const { width: W0, height: H0 } = sizeOf(img);
  const scale = Math.min(1, analyzeWidth / W0);
  const aw = Math.max(8, Math.round(W0 * scale));
  const ah = Math.max(8, Math.round(H0 * scale));

  const cv  = document.createElement('canvas');
  cv.width  = aw; cv.height = ah;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, aw, ah);

  let data;
  try {
    data = ctx.getImageData(0, 0, aw, ah).data;
  } catch (e) {
    cv.width = 0; cv.height = 0;
    throw new Error('यह photo पढ़ी नहीं जा सकी (दूसरी website की image हो सकती है)');
  }

  const n   = aw * ah;
  const lum = new Float32Array(n);
  const sat = new Uint8Array(n);
  let bgR = 0, bgG = 0, bgB = 0, bgN = 0;

  for (let q = 0, p = 0; q < n; q++, p += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    lum[q] = 0.299 * r + 0.587 * g + 0.114 * b;
    const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
    const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
    sat[q] = mx - mn;
  }

  // summed-area table → किसी भी खिड़की का औसत O(1) में
  const IW = aw + 1;
  const I  = new Float64Array(IW * (ah + 1));
  for (let y = 0; y < ah; y++) {
    let rowSum = 0;
    const o0 = y * IW, o1 = (y + 1) * IW, ro = y * aw;
    for (let x = 0; x < aw; x++) {
      rowSum += lum[ro + x];
      I[o1 + x + 1] = I[o0 + x + 1] + rowSum;
    }
  }

  const rad   = Math.max(8, Math.round(aw / 20));
  const delta = 14 / Math.max(0.3, sensitivity);
  const mask  = new Uint8Array(n);

  for (let y = 0; y < ah; y++) {
    const y0 = y - rad < 0 ? 0 : y - rad;
    const y1 = y + rad + 1 > ah ? ah : y + rad + 1;
    const r0 = y0 * IW, r1 = y1 * IW, ro = y * aw;
    for (let x = 0; x < aw; x++) {
      const x0 = x - rad < 0 ? 0 : x - rad;
      const x1 = x + rad + 1 > aw ? aw : x + rad + 1;
      const sum  = I[r1 + x1] - I[r0 + x1] - I[r1 + x0] + I[r0 + x0];
      const mean = sum / ((y1 - y0) * (x1 - x0));
      const q    = ro + x;
      if ((mean - lum[q]) > delta || sat[q] > 55) {
        mask[q] = 1;
      } else if (bgN < 40000) {       // कोरे हिस्से का असली रंग याद रखें
        const p = q * 4;
        bgR += data[p]; bgG += data[p + 1]; bgB += data[p + 2]; bgN++;
      }
    }
  }

  cv.width = 0; cv.height = 0;   // memory free

  const bgColor = bgN > 200
    ? `rgb(${Math.round(bgR / bgN)},${Math.round(bgG / bgN)},${Math.round(bgB / bgN)})`
    : '#ffffff';

  return { mask, aw, ah, scale, bgColor, W0, H0 };
}

// ── 3. profile → bands (hysteresis) ─────────────────────────────────────────
//    hi  = यहाँ पक्का कुछ छपा है (seed)
//    lo  = इतना भी चले तो हिस्से को थोड़ा बढ़ा दो (पर extMax से ज़्यादा नहीं)
function bandsFromProfile(prof, n, { hi, lo, extMax, merge, minLen }) {
  const seeds = [];
  for (let i = 0; i < n; i++) {
    if (prof[i] >= hi) {
      let j = i;
      while (j + 1 < n && prof[j + 1] >= hi) j++;
      seeds.push([i, j]);
      i = j;
    }
  }
  const grown = seeds.map(([a0, b0]) => {
    let a = a0, b = b0, k = 0;
    while (a > 0 && prof[a - 1] >= lo && k < extMax) { a--; k++; }
    k = 0;
    while (b < n - 1 && prof[b + 1] >= lo && k < extMax) { b++; k++; }
    return [a, b];
  });
  const merged = [];
  for (const b of grown) {
    const last = merged[merged.length - 1];
    if (last && b[0] - last[1] <= merge) last[1] = Math.max(last[1], b[1]);
    else merged.push([b[0], b[1]]);
  }
  return merged.filter(b => (b[1] - b[0] + 1) >= minLen);
}

// ── 4. detect — पूरी योजना बनाओ ─────────────────────────────────────────────
//    लौटाता है: bands (असली image के pixel में), side crop, और bgColor
export function detect(img, opts = {}) {
  const o = { ...TRIM_DEFAULTS, ...opts };
  const { mask, aw, ah, scale, bgColor, W0, H0 } = buildMask(img, o.analyzeWidth, o.sensitivity);

  // किनारे का 3% छोड़ दें — फ़ोटो के किनारे की परछाईं/vignette को ink न समझें
  const ey = Math.round(ah * 0.03);
  const ex = Math.round(aw * 0.03);
  const inside = (x, y) => (x >= ex && x < aw - ex && y >= ey && y < ah - ey);

  // ROW profile — बीच के 88% हिस्से से (दाएँ-बाएँ पड़ी चीज़ों से बचने के लिए)
  const sx0 = Math.round(aw * 0.06), sx1 = aw - sx0;
  const sw  = Math.max(1, sx1 - sx0);
  const rowP = new Float32Array(ah);
  for (let y = 0; y < ah; y++) {
    let c = 0;
    const ro = y * aw;
    for (let x = sx0; x < sx1; x++) if (mask[ro + x] && inside(x, y)) c++;
    rowP[y] = c;
  }

  let bandsA = bandsFromProfile(rowP, ah, {
    hi:     Math.max(8, 0.040 * sw),
    lo:     Math.max(3, 0.006 * sw),
    extMax: Math.max(6, Math.round(0.015 * ah)),
    merge:  Math.max(4, Math.round(0.020 * ah)),
    minLen: Math.max(6, Math.round(0.020 * ah)),
  });

  // कुछ नहीं मिला → पूरी image एक ही हिस्सा
  if (!bandsA.length) bandsA = [[0, ah - 1]];

  // हर band का "ink वज़न" — कमज़ोर band (उँगली, परछाईं) बाद में अपने-आप बन्द
  const weights = bandsA.map(([a, b]) => {
    let s = 0;
    for (let y = a; y <= b; y++) s += rowP[y];
    return s;
  });
  const maxW = Math.max(...weights, 1);

  // COLUMN profile — सिर्फ़ चुने हुए rows में से
  let cropL = 0, cropR = aw - 1;
  if (o.sideTrim) {
    const rowsOn = new Uint8Array(ah);
    bandsA.forEach(([a, b], i) => { if (weights[i] >= 0.10 * maxW) for (let y = a; y <= b; y++) rowsOn[y] = 1; });
    let kh = 0; for (let y = 0; y < ah; y++) if (rowsOn[y]) kh++;
    if (kh > 0) {
      const colP = new Float32Array(aw);
      for (let y = 0; y < ah; y++) {
        if (!rowsOn[y]) continue;
        const ro = y * aw;
        for (let x = 0; x < aw; x++) if (mask[ro + x] && inside(x, y)) colP[x]++;
      }
      const cb = bandsFromProfile(colP, aw, {
        hi:     Math.max(8, 0.040 * kh),
        lo:     Math.max(3, 0.006 * kh),
        extMax: Math.max(6, Math.round(0.015 * aw)),
        merge:  Math.max(4, Math.round(0.040 * aw)),
        minLen: Math.max(6, Math.round(0.020 * aw)),
      });
      if (cb.length) {
        // सबसे भारी column-band चुनें, फिर उसके 4% पास वाले साथ जोड़ लें
        const cw = cb.map(([a, b]) => { let s = 0; for (let x = a; x <= b; x++) s += colP[x]; return s; });
        let bi = 0; for (let i = 1; i < cw.length; i++) if (cw[i] > cw[bi]) bi = i;
        let L = cb[bi][0], R = cb[bi][1];
        const near = Math.round(aw * 0.04);
        for (let i = 0; i < cb.length; i++) {
          if (i === bi) continue;
          if (cb[i][1] < L && L - cb[i][1] <= near) L = cb[i][0];
          if (cb[i][0] > R && cb[i][0] - R <= near) R = cb[i][1];
        }
        cropL = L; cropR = R;
      }
    }
  }

  // analysis pixel → असली pixel (बाहर की तरफ़ round करें, कुछ कटे नहीं)
  const up   = (v) => Math.round(v / scale);
  const bands = bandsA.map(([a, b], i) => ({
    id:     `b${i}`,
    top:    Math.max(0,      up(a) - 1),
    bottom: Math.min(H0 - 1, up(b + 1) - 1 + 1),
    keep:   weights[i] >= 0.10 * maxW,   // कमज़ोर हिस्सा (उँगली/परछाईं) डिफ़ॉल्ट बन्द
    weight: Math.round((weights[i] / maxW) * 100),
  }));

  return {
    bands,
    crop:    { left: Math.max(0, up(cropL) - 1), right: Math.min(W0 - 1, up(cropR + 1)) },
    bgColor,
    width:   W0,
    height:  H0,
  };
}

// ── 5. compose — योजना के हिसाब से नया canvas बनाओ ──────────────────────────
//    यही वह जगह है जहाँ "कुछ नहीं बदलता" की गारंटी निभती है.
export function compose(img, plan, opts = {}) {
  const o = { ...TRIM_DEFAULTS, ...opts };
  const { width: W0, height: H0 } = sizeOf(img);

  const kept = plan.bands
    .filter(b => b.keep)
    .map(b => ({ top: b.top, bottom: b.bottom }))
    .sort((a, b) => a.top - b.top);

  if (!kept.length) throw new Error('कोई हिस्सा चुना नहीं गया');

  // margin इतना ही लें कि दो हिस्से आपस में overlap न करें
  const pieces = kept.map((b, i) => {
    const prev = kept[i - 1], next = kept[i + 1];
    const upRoom   = prev ? Math.floor((b.top - prev.bottom - 1) / 2) : b.top;
    const downRoom = next ? Math.floor((next.top - b.bottom - 1) / 2) : (H0 - 1 - b.bottom);
    const mTop  = Math.max(0, Math.min(o.margin, upRoom));
    const mBot  = Math.max(0, Math.min(o.margin, downRoom));
    const sy = Math.max(0, b.top - mTop);
    const sh = Math.min(H0, b.bottom + mBot + 1) - sy;
    return { sy, sh };
  }).filter(p => p.sh > 0);

  const sideM = o.sideTrim ? o.margin : 0;
  const sx = Math.max(0, (plan.crop?.left ?? 0) - sideM);
  const sw = Math.min(W0, (plan.crop?.right ?? W0 - 1) + sideM + 1) - sx;

  const gap = Math.max(0, o.gap | 0);
  const outW = Math.max(1, sw);
  const outH = Math.max(1, pieces.reduce((s, p) => s + p.sh, 0) + gap * (pieces.length - 1));

  const cv = document.createElement('canvas');
  cv.width = outW; cv.height = outH;
  const ctx = cv.getContext('2d');

  // 🔒 कोई interpolation नहीं — pixel जैसा है वैसा ही उतरेगा
  ctx.imageSmoothingEnabled = false;
  if ('webkitImageSmoothingEnabled' in ctx) ctx.webkitImageSmoothingEnabled = false;
  if ('mozImageSmoothingEnabled'    in ctx) ctx.mozImageSmoothingEnabled    = false;

  ctx.fillStyle = plan.bgColor || '#ffffff';
  ctx.fillRect(0, 0, outW, outH);

  let dy = 0;
  for (const p of pieces) {
    // 🔒 sw→sw, sh→sh — scale 1:1. यही "बिल्कुल same" की गारंटी है.
    ctx.drawImage(img, sx, p.sy, sw, p.sh, 0, dy, sw, p.sh);
    dy += p.sh + gap;
  }

  return cv;
}

// ── 6. canvas → Blob / dataURL ──────────────────────────────────────────────
const canvasToBlob = (cv, type, q) => new Promise((res) => {
  if (cv.toBlob) cv.toBlob(b => res(b), type, q);
  else {
    try {
      const b64 = cv.toDataURL(type, q).split(',')[1];
      const bin = atob(b64); const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      res(new Blob([u8], { type }));
    } catch { res(null); }
  }
});

export async function exportCanvas(cv, opts = {}) {
  const o = { ...TRIM_DEFAULTS, ...opts };
  const type = o.lossless ? 'image/png' : 'image/jpeg';
  const q    = o.lossless ? undefined : o.quality;
  const blob = await canvasToBlob(cv, type, q);
  if (!blob) throw new Error('image save नहीं हो पाई');
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = e => res(e.target.result);
    r.onerror = () => rej(new Error('read fail'));
    r.readAsDataURL(blob);
  });
  return { blob, dataUrl, type, width: cv.width, height: cv.height, sizeKB: Math.round(blob.size / 1024) };
}

// ── 7. एक ही call में पूरा काम (बिना UI के) ─────────────────────────────────
export async function autoTrim(src, opts = {}) {
  const o    = { ...TRIM_DEFAULTS, ...opts };
  const img  = await loadSource(src);
  const plan = detect(img, o);
  const cv   = compose(img, plan, o);
  const out  = await exportCanvas(cv, o);
  cv.width = 0; cv.height = 0;
  if (img.close) { try { img.close(); } catch {} }
  return { ...out, plan };
}

// ── 8. Blob → File (DocumentVault के processFile को File चाहिए) ─────────────
export function blobToFile(blob, name, type) {
  const base = String(name || 'scan').replace(/\.[^.]+$/, '');
  const ext  = (type || blob.type) === 'image/png' ? '.png' : '.jpg';
  try {
    return new File([blob], base + '-trim' + ext, { type: type || blob.type, lastModified: Date.now() });
  } catch {
    // बहुत पुराने browser — Blob को ही File की तरह इस्तेमाल कर लेंगे
    blob.name = base + '-trim' + ext;
    return blob;
  }
}

// ── 9. दो अलग-अलग photo (आगे + पीछे) को जोड़कर एक बनाना ────────────────────
//    अगर कभी front और back अलग-अलग खींची गई हों.
export async function joinImages(srcA, srcB, opts = {}) {
  const o = { ...TRIM_DEFAULTS, ...opts };
  const a = await loadSource(srcA);
  const b = await loadSource(srcB);
  const A = sizeOf(a), B = sizeOf(b);

  // चौड़ाई बराबर करने के लिए scale नहीं करते — छोटी वाली को बीच में रखते हैं
  const W = Math.max(A.width, B.width);
  const gap = Math.max(0, o.gap | 0);
  const H = A.height + B.height + gap;

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(a, Math.round((W - A.width) / 2), 0,                 A.width, A.height);
  ctx.drawImage(b, Math.round((W - B.width) / 2), A.height + gap,    B.width, B.height);

  const out = await exportCanvas(cv, o);
  cv.width = 0; cv.height = 0;
  return out;
}
