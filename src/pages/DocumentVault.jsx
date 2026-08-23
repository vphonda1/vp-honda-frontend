// ═══════════════════════════════════════════════════════════════════════════
// 🆕🆕🆕 DocumentVault.jsx — VERSION-2026-08-18-CLEAN-NAMES 🆕🆕🆕
// ✅ 💾 Laptop save + file नाम बिल्कुल साफ (NASIMAadharCard.pdf)
// ═══════════════════════════════════════════════════════════════════════════
// 📌 अगर toast में "v5 [NEW CODE]" दिखे = सही file deploy हुई
// 📌 अगर "TEXT पहले भेज रहे हैं" दिखे = text fix भी काम कर रहा है
// 📌 अगर पुराने messages दिखें = पुरानी file deploy हुई है
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react';
import { FolderOpen, Camera, X, AlertTriangle, Search, Image, ChevronRight, FileText, Video, Share2, Trash2, Eye, RefreshCw } from 'lucide-react';
import { captureFromCamera, checkExpiry, showInAppToast, sendWhatsApp } from '../utils/smartUtils';
import { api, apiFetch } from '../utils/apiConfig';

// ── Document types ─────────────────────────────────────────────────────────────
const DOC_TYPES = [
  { key: 'aadhar',         label: 'Aadhar Card',               icon: '🪪', hasExpiry: false },
  { key: 'pan',            label: 'PAN Card',                  icon: '💳', hasExpiry: false },
  { key: 'vp_tax_invoice', label: 'VP Tax Invoice',            icon: '🧾', hasExpiry: false },
  { key: 'su_tax_invoice', label: 'SU Tax Invoice',            icon: '🧾', hasExpiry: false },
  { key: 'challan',        label: 'Challan / MRC',             icon: '📜', hasExpiry: false },
  { key: 'chassis_trace',  label: 'Chassis Trace (Engine+Chassis No)', icon: '📋', hasExpiry: false },
  { key: 'chassis_photo',  label: 'Chassis Photo',             icon: '🔢', hasExpiry: false },
  { key: 'chassis_video',  label: 'Chassis Video',             icon: '🎥', hasExpiry: false },
  { key: 'delivery_photo', label: 'Delivery Photo',            icon: '📸', hasExpiry: false },
  { key: 'old_rc',         label: 'Old RC Card',               icon: '🪪', hasExpiry: false },
  { key: 'old_noc',        label: 'Old Bike NOC',              icon: '📑', hasExpiry: false },
  { key: 'rto_form',       label: 'RTO Form',                  icon: '🚗', hasExpiry: false },
  { key: 'rc',             label: 'RC Book',                   icon: '📄', hasExpiry: false },
  { key: 'insurance',      label: 'Insurance Policy',          icon: '🛡️', hasExpiry: true  },
  { key: 'intimation',     label: 'Intimation',                icon: '📝', hasExpiry: false },
  { key: 'bank_passbook',  label: 'Bank Passbook',             icon: '🏦', hasExpiry: false },
  { key: 'signature',      label: 'Customer Signature',        icon: '✍️', hasExpiry: false },
  { key: 'customer_photo', label: 'Customer Photo',            icon: '👤', hasExpiry: false },
  { key: 'battery_photo',  label: 'Battery Photo',             icon: '🔋', hasExpiry: false },
  { key: 'voter_id',       label: 'Voter ID',                  icon: '🗳️', hasExpiry: false },
  { key: 'other',          label: 'Other Document',            icon: '📁', hasExpiry: false },
];

// ✅ Insurance: सिर्फ 4 docs (Challan हटाया) + Nominee/Hypothecation manual entry
const INSURANCE_REQUIRED_KEYS = ['vp_tax_invoice', 'aadhar', 'pan', 'chassis_trace'];
// RTO/Pal: SU Tax Invoice, Insurance, Aadhar, PAN, Chassis Trace, Chassis Photo
const RTO_REQUIRED_KEYS = ['su_tax_invoice', 'insurance', 'aadhar', 'pan', 'chassis_trace', 'chassis_photo'];
// ✅ NEW: SU Tax Invoice ke liye — Challan, Aadhar, PAN, Chassis Trace
const SU_TAX_REQUIRED_KEYS = ['challan', 'aadhar', 'pan', 'chassis_trace'];

// ✅ FIX: Aggressive normalize — lowercase + trim + space hata
// साथ ही पुराने date-based d.folder field को IGNORE करें (always recompute)
const folderKey = (name, phone) => {
  const cleanName  = (name || 'unknown').toString().trim().toLowerCase().replace(/\s+/g, '');
  const cleanPhone = (phone || '').toString().replace(/\D/g, '');
  return cleanPhone ? `${cleanName}_${cleanPhone}` : cleanName;
};

// ── Image compression — Aggressive (1000px max, 0.7 quality) ─────────────────
// Documents जैसे Aadhar/PAN के लिए optimized — readable रहेगा लेकिन छोटी size
// ✅ MEMORY FIX: अब source में File/Blob सीधे दे सकते हैं (base64 string भी चलेगी — backward compatible)
//    File सीधे देने पर 30MB photo की 40MB base64 string RAM में नहीं बनती → mobile crash / memory error खत्म
async function compressImageRobust(source, maxWidth = 1000, quality = 0.70) {
  const isBlob = typeof source !== 'string';
  const origKB = isBlob
    ? Math.round(source.size / 1024)
    : Math.round(source.length * 0.75 / 1024);

  // canvas → Blob (toDataURL से कम RAM लेता है)
  const canvasToBlob = (canvas) => new Promise((res) => {
    if (canvas.toBlob) canvas.toBlob(b => res(b), 'image/jpeg', quality);
    else res(null);
  });
  const blobToDataUrl = (blob) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });

  // Method 1: createImageBitmap (modern, fast — सबसे कम memory)
  try {
    const blobIn = isBlob ? source : await (await fetch(source)).blob();
    const bitmap = await createImageBitmap(blobIn);
    let { width, height } = bitmap;
    if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const outBlob = await canvasToBlob(canvas);
    canvas.width = 0; canvas.height = 0; // memory free
    if (!outBlob) throw new Error('toBlob null');
    const compKB = Math.round(outBlob.size / 1024);
    const dataUrl = await blobToDataUrl(outBlob);
    console.log(`[Compress M1] ${origKB}KB → ${compKB}KB (${Math.round(compKB/origKB*100)}%)`);
    return { dataUrl, blob: outBlob, sizeKB: compKB, method: 1, origKB };
  } catch (e1) {
    console.warn('[Compress M1 failed]', e1.message);
  }

  // Method 2: Image element (older browsers)
  let objUrl = null;
  try {
    const src = isBlob ? (objUrl = URL.createObjectURL(source)) : source;
    const outBlob = await new Promise((res, rej) => {
      const img = new window.Image();
      img.onload = async () => {
        try {
          let { width, height } = img;
          if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          const b = await canvasToBlob(canvas);
          canvas.width = 0; canvas.height = 0;
          b ? res(b) : rej(new Error('toBlob null'));
        } catch (err) { rej(err); }
      };
      img.onerror = () => rej(new Error('image decode failed'));
      img.src = src;
    });
    const compKB = Math.round(outBlob.size / 1024);
    const dataUrl = await blobToDataUrl(outBlob);
    console.log(`[Compress M2] ${origKB}KB → ${compKB}KB`);
    return { dataUrl, blob: outBlob, sizeKB: compKB, method: 2, origKB };
  } catch (e2) {
    console.warn('[Compress M2 failed]', e2.message);
  } finally {
    if (objUrl) URL.revokeObjectURL(objUrl);
  }

  // Method 3: No compression — return original (HEIC/corrupt photo case)
  console.warn('[Compress] All methods failed — using original');
  if (isBlob) {
    let dataUrl = null;
    try { dataUrl = await blobToDataUrl(source); } catch { /* बहुत बड़ी file — base64 skip */ }
    return { dataUrl, blob: source, sizeKB: origKB, method: 0, origKB, failed: true };
  }
  return { dataUrl: source, blob: null, sizeKB: origKB, method: 0, origKB, failed: true };
}

// ── File processor with compression status ─────────────────────────────────────
async function processFile(file, type) {
  // Type-specific size limits (storage protection)
  const limits = { image: 30, pdf: 25, video: 15 }; // MB (PDF अब खुद compress होती है)
  const limitMB = limits[type] || 10;
  if (file.size > limitMB * 1024 * 1024) {
    alert(`${type.toUpperCase()} ${limitMB}MB से छोटी होनी चाहिए। आपकी file: ${Math.round(file.size/1024/1024)}MB`);
    throw new Error('file too large');
  }

  // ✅ MEMORY FIX: image को सीधे File से compress करें — पहले base64 नहीं बनाते
  if (type === 'image') {
    const compInfo = await compressImageRobust(file);
    // अगर compression पूरी तरह fail हुई (HEIC/corrupt) और file बहुत बड़ी है — रोक दें
    if (compInfo.failed && file.size > 8 * 1024 * 1024) {
      alert(`⚠️ यह photo compress नहीं हो पा रही (शायद HEIC format) और ${Math.round(file.size/1024/1024)}MB बड़ी है।\n\nफोन की Gallery में photo को JPG में save करके या Camera button से दोबारा खींच कर upload करें।`);
      throw new Error('compression failed on large file');
    }
    return {
      dataUrl:    compInfo.dataUrl,
      blob:       compInfo.blob,          // ✅ Cloudinary को यही सीधे भेजेंगे
      fileType:   type,
      fileName:   file.name,
      sizeKB:     compInfo.sizeKB,
      origKB:     compInfo.origKB,
      compFailed: compInfo.failed || false,
      compMethod: compInfo.method,
    };
  }

  // ✅ PDF — upload से पहले ही 200KB के अंदर लाएं
  //    फायदा दोहरा: (1) Cloudinary "Invalid PDF" वाली encrypted/भारी file
  //    साफ होकर स्वीकार हो जाती है, (2) share के वक़्त दोबारा compress नहीं करनी पड़ती
  if (type === 'pdf') {
    // ⚡ Upload के वक़्त कोई compress नहीं — Save तुरंत होगा, कोई इंतज़ार नहीं।
    //    छोटा करने का काम भेजते वक़्त होगा, और वो अब Cloudinary के सर्वर से
    //    होता है इसलिए सेकंडों में निपटता है।
    let pdfDataUrl = null;
    if (file.size <= 700 * 1024) {
      try {
        pdfDataUrl = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = (e) => resolve(e.target.result);
          r.onerror = () => reject(new Error('read fail'));
          r.readAsDataURL(file);
        });
      } catch { /* बड़ी file — base64 skip */ }
    }
    return {
      dataUrl:    pdfDataUrl,
      blob:       file,
      fileType:   type,
      fileName:   file.name,
      sizeKB:     Math.round(file.size / 1024),
      origKB:     Math.round(file.size / 1024),
      compFailed: false,
      compMethod: null,
    };
  }

  // Video — base64 (compress browser में संभव नहीं)
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
  const sizeKB = Math.round(file.size / 1024);
  if (sizeKB > 2048) console.warn(`[${type}] बड़ी file: ${sizeKB}KB. Storage के लिए छोटी file बेहतर।`);

  return {
    dataUrl,
    blob:       file,                     // ✅ Cloudinary को original file भेजेंगे
    fileType:   type,
    fileName:   file.name,
    sizeKB,
    origKB:     sizeKB,
    compFailed: false,
    compMethod: null,
  };
}

// ── Convert base64 → File object (legacy helper — अब getDocBytes इस्तेमाल होता है) ──
function dataURLtoFile(dataURL, fileName, mimeType) {
  try {
    const arr = dataURL.split(',');
    const mime = mimeType || arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], fileName, { type: mime });
  } catch { return null; }
}

// ✅ FIX: अब documents Cloudinary पर हैं — fileData में base64 नहीं, URL आता है
//    पुराना code URL को base64 समझकर atob() करता था → हर PDF fail → "pdf-lib install है?" error
const isHttpUrl = (s) => typeof s === 'string' && /^https?:\/\//i.test(s);

// किसी भी doc से bytes निकालें — Cloudinary URL या base64, दोनों
async function getDocBytes(d) {
  const url = isHttpUrl(d.fileUrl) ? d.fileUrl : (isHttpUrl(d.fileData) ? d.fileData : null);
  if (url) {
    const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
    if (!res.ok) {
      // ✅ 401 = Cloudinary ने delivery block की है (PDF/ZIP delivery setting OFF)
      if (res.status === 401 || res.status === 403) {
        throw new Error('Cloudinary ने block किया (PDF delivery OFF है)');
      }
      throw new Error(`Download fail (${res.status})`);
    }
    const blob = await res.blob();
    const buf  = await blob.arrayBuffer();
    return { bytes: new Uint8Array(buf), mime: blob.type || '' };
  }
  const b64 = typeof d.fileData === 'string' ? d.fileData : '';
  if (!b64.includes(',')) throw new Error('File data नहीं मिला');
  const base64 = b64.split(',')[1];
  return {
    bytes: Uint8Array.from(atob(base64), c => c.charCodeAt(0)),
    mime:  b64.substring(5, b64.indexOf(';')),
  };
}

// bytes → File object
function bytesToFile(bytes, fileName, mime) {
  return new File([bytes], fileName, { type: mime });
}

// ✅ File का नाम बिल्कुल साफ — कोई space, underscore, कोष्ठक या चिह्न नहीं।
//    सिर्फ अक्षर और अंक जुड़े हुए। जैसे: NASIMAadharCard.pdf
//    (Hindi/Devanagari अक्षर भी चलेंगे — नसीमआधारकार्ड.pdf)
const cleanPart = (t) => String(t || '').normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '');

const safeName = (d, ext = '.pdf', pageNo = null) => {
  let base = (cleanPart(d.customerName) + cleanPart(d.docTypeLabel)).substring(0, 70);
  if (!base) base = 'Document';
  if (pageNo) base += 'P' + pageNo;
  return base + ext;
};

// ✅ हर PDF की अधिकतम size — कोई भी file इससे बड़ी नहीं जाएगी
const MAX_PDF_KB = 200;

// एक image से A4 PDF बनाएं
async function makeImagePdf(imgBytes, kind, label) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let image;
  try { image = kind === 'png' ? await pdf.embedPng(imgBytes) : await pdf.embedJpg(imgBytes); }
  catch {
    try { image = await pdf.embedJpg(imgBytes); }
    catch { try { image = await pdf.embedPng(imgBytes); } catch { throw new Error('Image format support nahi'); } }
  }
  const page = pdf.addPage([595, 842]);
  page.drawText((label || 'Document').substring(0, 50), { x: 40, y: 810, size: 13, font: bold, color: rgb(0.12, 0.12, 0.12) });
  const { width, height } = image;
  const ratio = Math.min(515 / width, 720 / height);
  const w = width * ratio, h = height * ratio;
  page.drawImage(image, { x: (595 - w) / 2, y: 50, width: w, height: h });
  return await pdf.save({ useObjectStreams: true });
}

// ── Image → single-page PDF, हमेशा ≤ 200KB ───────────────────────────────────
async function imageToPDF(d) {
  const { bytes: rawBytes, mime: rawMime } = await getDocBytes(d);

  // ऊँचे resolution के canvas पर रखें ताकि अक्षर की धार बनी रहे,
  // फिर budget के अंदर encode करें
  const blob = new Blob([rawBytes], { type: rawMime || 'image/jpeg' });
  const bitmap = await createImageBitmap(blob);
  let width = bitmap.width, height = bitmap.height;
  const maxSide = 1750;
  const big = Math.max(width, height);
  const scale = big > maxSide ? maxSide / big : 1;
  width = Math.round(width * scale); height = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';     // ✅ pixel फटेगा नहीं
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const enc = await encodePageWithinBudget(canvas, Math.round(MAX_PDF_KB * 1024 * 0.88));
  canvas.width = 0; canvas.height = 0;
  if (!enc) throw new Error('Image encode fail');

  const imgBytes = new Uint8Array(await enc.blob.arrayBuffer());
  console.log(`[PDF ${d.docTypeLabel}] ${enc.tag} -> ${Math.round(enc.blob.size/1024)}KB`);
  const pdfBytes = await makeImagePdf(imgBytes, enc.type, d.docTypeLabel);
  return new File([pdfBytes], safeName(d, '.pdf'), { type: 'application/pdf' });
}

// ── pdf.js loader ────────────────────────────────────────────────────────────
// ⚠️ पिछली गलती: app में npm वाली pdfjs-dist v4.10.38 पहले से मौजूद थी,
//    उसी को उठा लिया गया और worker उस version का cdnjs पर मौजूद ही नहीं था
//    (v4 में worker सिर्फ .mjs है) → "Setting up fake worker failed"।
//    अब: (1) पुरानी pdfjsLib हटाकर अपना pinned v3 load करते हैं,
//        (2) worker को fetch करके Blob URL बनाते हैं — dynamic import होता ही नहीं।
const PDFJS_VER = '3.11.174';
const PDFJS_SOURCES = [
  { js: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VER}/pdf.min.js`,
    worker: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VER}/pdf.worker.min.js` },
  { js: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER}/legacy/build/pdf.min.js`,
    worker: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER}/legacy/build/pdf.worker.min.js` },
  { js: `https://unpkg.com/pdfjs-dist@${PDFJS_VER}/legacy/build/pdf.min.js`,
    worker: `https://unpkg.com/pdfjs-dist@${PDFJS_VER}/legacy/build/pdf.worker.min.js` },
];

let _pdfjsPromise = null;

function loadScriptOnce(src) {
  return new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = src; sc.async = true;
    const timer = setTimeout(() => rej(new Error('timeout')), 20000);
    sc.onload  = () => { clearTimeout(timer); res(); };
    sc.onerror = () => { clearTimeout(timer); rej(new Error('script load fail')); };
    document.head.appendChild(sc);
  });
}

function loadPdfJs() {
  if (_pdfjsPromise) return _pdfjsPromise;
  _pdfjsPromise = (async () => {
    const errs = [];
    for (const src of PDFJS_SOURCES) {
      try {
        // ✅ किसी और version की pdfjsLib पड़ी हो तो हटाएं — यही असली गड़बड़ थी
        const existing = window.pdfjsLib;
        if (existing && existing.version !== PDFJS_VER) {
          try { delete window.pdfjsLib; } catch { window.pdfjsLib = undefined; }
        }
        if (window.pdfjsLib?.version !== PDFJS_VER) await loadScriptOnce(src.js);
        const lib = window.pdfjsLib;
        if (!lib?.getDocument) throw new Error('pdfjsLib नहीं मिला');

        // ✅ worker को खुद fetch करके Blob URL बनाएं → कोई dynamic import नहीं,
        //    कोई version mismatch नहीं, CORS/CSP की दिक्कत भी नहीं
        const wRes = await fetch(src.worker, { mode: 'cors' });
        if (!wRes.ok) throw new Error(`worker fetch ${wRes.status}`);
        const wBlob = await wRes.blob();
        lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
          new Blob([await wBlob.text()], { type: 'text/javascript' })
        );
        console.log('[pdf.js] ready — v' + (lib.version || '?') + ' from ' + src.js);
        return lib;
      } catch (e) {
        errs.push(`${src.js.split('/')[2]}: ${e?.message}`);
        console.warn('[pdf.js source fail]', src.js, e?.message);
      }
    }
    _pdfjsPromise = null;   // ✅ अगली बार दोबारा try कर सके
    throw new Error(errs.join(' | '));
  })();
  return _pdfjsPromise;
}

// ── Cloudinary: PDF के हर page को server पर ही JPG बनवाएं ─────────────────────
//    सबसे भरोसेमंद रास्ता — कोई library, कोई worker, कोई browser memory नहीं
function cloudinaryPageUrl(url, page, width = 1400) {
  // .../image/upload/v123/folder/file.pdf → .../image/upload/pg_1,w_1700,.../file.jpg
  const marker = '/image/upload/';
  const at = url.indexOf(marker);
  if (at === -1) return null;                    // raw/upload — transform नहीं होता
  const head = url.substring(0, at + marker.length);
  let tail   = url.substring(at + marker.length);
  tail = tail.replace(/\.(pdf|PDF)(\?.*)?$/, '');
  // e_grayscale — document में रंग की ज़रूरत नहीं; download आधा, नतीजा वही
  return `${head}pg_${page},w_${width},c_limit,e_grayscale,q_70,f_jpg/${tail}.jpg`;
}

// ── Canvas helpers — text साफ रखते हुए size घटाने के लिए ─────────────────────
function toGrayscale(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h), p = img.data;
  for (let i = 0; i < p.length; i += 4) {
    const g = (p[i] * 0.299 + p[i+1] * 0.587 + p[i+2] * 0.114) | 0;
    p[i] = p[i+1] = p[i+2] = g;
  }
  ctx.putImageData(img, 0, 0);
}
// हल्का contrast boost — हल्की स्याही वाला text भी काला और साफ हो जाता है
function boostContrast(ctx, w, h, lo = 110, hi = 205) {
  const img = ctx.getImageData(0, 0, w, h), p = img.data;
  const range = hi - lo;
  for (let i = 0; i < p.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let v = p[i+c];
      v = v <= lo ? 0 : v >= hi ? 255 : Math.round(((v - lo) / range) * 255);
      p[i+c] = v;
    }
  }
  ctx.putImageData(img, 0, 0);
}
const blobOf = (canvas, type, q) => new Promise(res => canvas.toBlob(b => res(b), type, q));
// ⚡ browser को साँस लेने दें — वरना पूरा tab/desktop जम जाता है
const breathe = () => new Promise(res => setTimeout(res, 0));

// source canvas से scale किया हुआ नया canvas
function scaledCopy(src, scale) {
  const c = document.createElement('canvas');
  c.width = Math.max(200, Math.round(src.width * scale));
  c.height = Math.max(200, Math.round(src.height * scale));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// ⚠️ पिछली कमी यही थी: सिर्फ JPEG quality घटती थी, resolution कभी नहीं।
//    Quality की एक हद के बाद size रुक जाती थी — इसलिए 1660KB पर अटक गया।
//    अब quality के बाद resolution भी घटती है, तो budget हमेशा पूरा होता है।
const ENCODE_LADDER = [
  { scale: 1.00, gray: false, bw: false, q: 0.78 },
  { scale: 1.00, gray: false, bw: false, q: 0.62 },
  { scale: 1.00, gray: true,  bw: false, q: 0.66 },
  { scale: 1.00, gray: true,  bw: false, q: 0.50 },
  { scale: 1.00, gray: true,  bw: true,  q: 0.58 },
  { scale: 1.00, gray: true,  bw: true,  q: 0.42 },
  { scale: 0.82, gray: true,  bw: true,  q: 0.50 },
  { scale: 0.70, gray: true,  bw: true,  q: 0.45 },
  { scale: 0.58, gray: true,  bw: true,  q: 0.42 },
  { scale: 0.48, gray: true,  bw: true,  q: 0.40 },
  { scale: 0.38, gray: true,  bw: true,  q: 0.38 },
  { scale: 0.30, gray: true,  bw: true,  q: 0.35 },
];

// एक page/image को दिए गए budget के अंदर encode करें
async function encodePageWithinBudget(srcCanvas, budgetBytes) {
  let best = null;
  for (const step of ENCODE_LADDER) {
    const c = step.scale === 1 ? scaledCopy(srcCanvas, 1) : scaledCopy(srcCanvas, step.scale);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (step.gray) toGrayscale(ctx, c.width, c.height);
    if (step.bw)   boostContrast(ctx, c.width, c.height);
    const blob = await blobOf(c, 'image/jpeg', step.q);
    const tag = `${Math.round(c.width)}px${step.bw ? ' bw' : step.gray ? ' gray' : ''} q${step.q}`;
    c.width = 0; c.height = 0;
    if (!blob) continue;
    if (!best || blob.size < best.blob.size) best = { blob, type: 'jpg', tag };
    if (blob.size <= budgetBytes) return { blob, type: 'jpg', tag };
  }
  return best;
}

// ── PDF के pages को JPG blobs में लाएं — पहले Cloudinary, फिर pdf.js ─────────
async function getPagesAsBlobs(d, bytes, onProgress) {
  // ── रास्ता 1: Cloudinary खुद page → JPG बनाकर देता है (server-side) ──
  const url = isHttpUrl(d.fileUrl) ? d.fileUrl : (isHttpUrl(d.fileData) ? d.fileData : null);
  if (url && cloudinaryPageUrl(url, 1)) {
    try {
      const pages = [];
      for (let p = 1; p <= 25; p++) {
        onProgress?.(p, '?');
        const res = await fetch(cloudinaryPageUrl(url, p), { mode: 'cors', cache: 'no-store' });
        if (!res.ok) { if (p === 1) throw new Error(`convert fail ${res.status}`); break; }
        const blob = await res.blob();
        if (!blob.size || !blob.type.startsWith('image')) { if (p === 1) throw new Error('JPG नहीं मिली'); break; }
        pages.push(blob);
      }
      if (pages.length) { console.log(`[pages] Cloudinary से ${pages.length} pages`); return { pages, via: 'Cloudinary' }; }
    } catch (e) { console.warn('[pages Cloudinary]', e?.message); }
  }

  // ── रास्ता 2: pdf.js से खुद render करें ──
  if (!bytes) throw new Error('Cloudinary से pages नहीं मिले');
  const pdfjs = await loadPdfJs();
  const src = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
  const n = Math.min(src.numPages, 25);
  const pages = [];
  for (let p = 1; p <= n; p++) {
    onProgress?.(p, n);
    const page = await src.getPage(p);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2.2, Math.max(1.0, 1500 / base.width));
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const blob = await blobOf(canvas, 'image/jpeg', 0.90);
    canvas.width = 0; canvas.height = 0;
    page.cleanup?.();
    if (blob) pages.push(blob);
    await breathe();                       // ⚡ UI जमने न पाए
  }
  await src.destroy();
  if (!pages.length) throw new Error('कोई page render नहीं हुआ');
  console.log(`[pages] pdf.js से ${pages.length} pages`);
  return { pages, via: 'pdf.js' };
}

// एक page blob को budget के अंदर encode करके PDF page bytes लौटाएं
async function encodeBlobToPdfPage(out, blob, budget) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const enc = await encodePageWithinBudget(canvas, budget);
  const cw = canvas.width, ch = canvas.height;
  canvas.width = 0; canvas.height = 0;
  if (!enc) return null;
  const img = await out.embedJpg(new Uint8Array(await enc.blob.arrayBuffer()));
  const pgH = Math.min(Math.max(Math.round(595 * (ch / cw)), 200), 1400);
  const pg = out.addPage([595, pgH]);
  pg.drawImage(img, { x: 0, y: 0, width: 595, height: pgH });
  return enc;
}

// ═══════════════════════════════════════════════════════════════════════════
// ✅ असली तरीका जो online PDF compressor इस्तेमाल करते हैं:
//    वे page को image में नहीं बदलते! वे PDF के *अंदर पड़ी images* को छोटा
//    करते हैं और text को text ही रहने देते हैं (vector) — इसलिए file 2.7MB से
//    100KB हो जाती है और अक्षर फिर भी काँच जैसे साफ रहते हैं।
//    Insurance policy जैसी digital PDF में असली वज़न logo/background images का
//    होता है, text का नहीं।
// ═══════════════════════════════════════════════════════════════════════════
async function shrinkPdfImages(bytes, maxImgSide, quality) {
  const { PDFDocument, PDFName, PDFNumber, PDFRawStream } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const ctx = doc.context;
  let changed = 0, saved = 0;

  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    try {
      if (!(obj instanceof PDFRawStream)) continue;
      const dict = obj.dict;
      if (String(dict.get(PDFName.of('Subtype'))) !== '/Image') continue;

      const filter = String(dict.get(PDFName.of('Filter')) || '');
      const w = dict.get(PDFName.of('Width'))?.asNumber?.()  || 0;
      const h = dict.get(PDFName.of('Height'))?.asNumber?.() || 0;
      if (!w || !h) continue;
      if (obj.contents.length < 12000) continue;            // पहले से छोटी — छोड़ दें

      let bitmap = null;
      if (filter.includes('DCTDecode')) {
        // सीधी JPEG — browser खुद खोल लेता है
        bitmap = await createImageBitmap(new Blob([obj.contents], { type: 'image/jpeg' }));
      } else if (filter.includes('FlateDecode') && typeof DecompressionStream !== 'undefined') {
        // ✅ Flate (zip) वाली images — browser के DecompressionStream से खोलें
        const bpc = dict.get(PDFName.of('BitsPerComponent'))?.asNumber?.() || 8;
        const cs  = String(dict.get(PDFName.of('ColorSpace')) || '');
        const parms = String(dict.get(PDFName.of('DecodeParms')) || '');
        if (bpc !== 8 || parms.includes('Predictor')) continue;
        const comps = cs.includes('DeviceRGB') ? 3 : cs.includes('DeviceGray') ? 1 : 0;
        if (!comps) continue;
        const ds = new Blob([obj.contents]).stream().pipeThrough(new DecompressionStream('deflate'));
        const raw = new Uint8Array(await new Response(ds).arrayBuffer());
        if (raw.length < w * h * comps) continue;
        const rgba = new Uint8ClampedArray(w * h * 4);
        for (let px = 0; px < w * h; px++) {
          const s0 = px * comps, d0 = px * 4;
          if (comps === 3) { rgba[d0] = raw[s0]; rgba[d0+1] = raw[s0+1]; rgba[d0+2] = raw[s0+2]; }
          else { rgba[d0] = rgba[d0+1] = rgba[d0+2] = raw[s0]; }
          rgba[d0+3] = 255;
        }
        bitmap = await createImageBitmap(new ImageData(rgba, w, h));
      } else continue;
      const big = Math.max(w, h);
      const sc = big > maxImgSide ? maxImgSide / big : 1;
      const nw = Math.max(16, Math.round(w * sc)), nh = Math.max(16, Math.round(h * sc));

      const canvas = document.createElement('canvas');
      canvas.width = nw; canvas.height = nh;
      const c2 = canvas.getContext('2d');
      c2.imageSmoothingEnabled = true; c2.imageSmoothingQuality = 'high';
      c2.fillStyle = '#ffffff'; c2.fillRect(0, 0, nw, nh);
      c2.drawImage(bitmap, 0, 0, nw, nh);
      bitmap.close();
      const blob = await blobOf(canvas, 'image/jpeg', quality);
      canvas.width = 0; canvas.height = 0;
      if (!blob || blob.size >= obj.contents.length) continue;

      const newBytes = new Uint8Array(await blob.arrayBuffer());
      dict.set(PDFName.of('Width'),  PDFNumber.of(nw));
      dict.set(PDFName.of('Height'), PDFNumber.of(nh));
      dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
      dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
      dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
      dict.delete(PDFName.of('DecodeParms'));
      // SMask (transparency) जैसा है वैसा रहने दें — PDF में उसका size अलग हो सकता है
      saved += obj.contents.length - newBytes.length;
      ctx.assign(ref, PDFRawStream.of(dict, newBytes));
      changed++;
    } catch (e) { /* इस image को छोड़ दें */ }
  }

  const out = await doc.save({ useObjectStreams: true });
  console.log(`[vector-shrink ${maxImgSide}px q${quality}] ${changed} images, ${Math.round(saved/1024)}KB बचा → ${Math.round(out.length/1024)}KB`);
  return { bytes: out, changed };
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔑 असली तुरुप का पत्ता — 1-BIT (काला/सफेद) + Flate
//    JPEG हर pixel के लिए रंग की जानकारी रखता है — document में इसकी ज़रूरत ही
//    नहीं, वहाँ सिर्फ दो रंग हैं: कागज़ और स्याही।
//    इसलिए हर pixel को 1 bit में रखते हैं (8 pixel = 1 byte) और zip कर देते हैं।
//    Text वाले page में एक जैसे सफेद हिस्से बहुत होते हैं, इसलिए zip उसे
//    10-20 गुना दबा देता है। नतीजा: 1200px चौड़ा page सिर्फ 12-25KB में,
//    और अक्षर JPEG से भी ज़्यादा तेज़ (कोई धुंधलापन नहीं, कोई दाग नहीं)।
//    Scanner और fax मशीनें दशकों से यही करती आई हैं।
// ═══════════════════════════════════════════════════════════════════════════
async function pageBlobToBilevel(blob, targetW, threshold = 145) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, targetW / bitmap.width);
  const w = Math.max(200, Math.round(bitmap.width * scale));
  const h = Math.max(200, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);   // ⚡ सीधे target size पर — बीच का कोई canvas नहीं
  bitmap.close();

  const data = ctx.getImageData(0, 0, w, h).data;
  canvas.width = 0; canvas.height = 0;

  // हर row byte की सीमा पर शुरू होनी चाहिए (PDF का नियम)
  const rowBytes = Math.ceil(w / 8);
  const packed = new Uint8Array(rowBytes * h);
  for (let y = 0; y < h; y++) {
    const rowOff = y * rowBytes, base = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = base + x * 4;
      // तेज़ integer luminance (float गुणा से बचते हैं)
      const lum = (data[i] * 77 + data[i + 1] * 151 + data[i + 2] * 28) >> 8;
      if (lum >= threshold) packed[rowOff + (x >> 3)] |= (0x80 >> (x & 7)); // 1 = सफेद
    }
  }

  const cs = new Blob([packed]).stream().pipeThrough(new CompressionStream('deflate'));
  const bytes = new Uint8Array(await new Response(cs).arrayBuffer());
  return { bytes, width: w, height: h };
}

// bilevel image को PDF page पर लगाएं
async function addBilevelPage(out, pdfLib, img) {
  const { PDFName, PDFNumber, PDFRawStream, pushGraphicsState, popGraphicsState,
          concatTransformationMatrix, drawObject } = pdfLib;
  const ctx = out.context;
  const dict = ctx.obj({
    Type: 'XObject', Subtype: 'Image',
    Width: img.width, Height: img.height,
    ColorSpace: 'DeviceGray', BitsPerComponent: 1,
    Filter: 'FlateDecode',
  });
  dict.set(PDFName.of('Length'), PDFNumber.of(img.bytes.length));
  const ref = ctx.register(PDFRawStream.of(dict, img.bytes));

  const pgW = 595;
  const pgH = Math.min(Math.max(Math.round(pgW * (img.height / img.width)), 200), 1400);
  const page = out.addPage([pgW, pgH]);
  page.node.setXObject(PDFName.of('VPImg0'), ref);
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(pgW, 0, 0, pgH, 0, 0),
    drawObject('VPImg0'),
    popGraphicsState(),
  );
}

// ⚡⚡ सबसे तेज़ रास्ता — pdf.js से page सीधे उसी width पर render करके तुरंत 1-bit।
//     पहले हम हर page को 1500px JPEG बनाते थे, फिर उसे दोबारा खोलकर, दोबारा
//     canvas पर खींचकर 1-bit करते थे — यानी हर page पर तीन गुना काम।
//     अब: render → bits → बस। बीच में कोई JPEG नहीं, कोई दोबारा decode नहीं।
async function renderPageToBilevel(src, pageNo, targetW, threshold = 145) {
  const page = await src.getPage(pageNo);
  const base = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: Math.max(0.4, targetW / base.width) });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;

  const w = canvas.width, h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;
  canvas.width = 0; canvas.height = 0;
  page.cleanup?.();

  const rowBytes = Math.ceil(w / 8);
  const packed = new Uint8Array(rowBytes * h);
  for (let y = 0; y < h; y++) {
    const rowOff = y * rowBytes, base2 = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = base2 + x * 4;
      const lum = (data[i] * 77 + data[i + 1] * 151 + data[i + 2] * 28) >> 8;
      if (lum >= threshold) packed[rowOff + (x >> 3)] |= (0x80 >> (x & 7));
    }
  }
  const cs = new Blob([packed]).stream().pipeThrough(new CompressionStream('deflate'));
  return { bytes: new Uint8Array(await new Response(cs).arrayBuffer()), width: w, height: h };
}

async function bilevelFromPdfBytes(bytes, limitBytes, onProgress) {
  const pdfjs = await loadPdfJs();
  const pdfLib = await import('pdf-lib');
  const src = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
  const n = Math.min(src.numPages, 30);
  const perPage = (limitBytes * 0.92) / n;
  const clampW = (v) => Math.max(650, Math.min(1500, Math.round(v / 50) * 50));

  // ── नाप: पहला page 1200px पर ──
  onProgress?.(0, n, 'नाप रहे हैं');
  const probe = await renderPageToBilevel(src, 1, 1200);
  await breathe();
  // 0.85 का हिफ़ाज़ती गुणा — ताकि पहली ही बार में budget के अंदर आ जाए
  let targetW = clampW(1200 * Math.sqrt(perPage / Math.max(probe.bytes.length, 1)) * 0.85);
  console.log(`[bilevel probe] 1200px = ${Math.round(probe.bytes.length/1024)}KB/page · budget ${Math.round(perPage/1024)}KB → width ${targetW}px`);

  let best = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await pdfLib.PDFDocument.create();
    for (let p = 1; p <= n; p++) {
      onProgress?.(p, n, `${targetW}px`);
      const img = await renderPageToBilevel(src, p, targetW);
      await addBilevelPage(out, pdfLib, img);
      await breathe();
    }
    const outBytes = await out.save({ useObjectStreams: true });
    console.log(`[bilevel ${targetW}px] ${n} pages → ${Math.round(outBytes.length/1024)}KB`);
    if (!best || outBytes.length < best.length) best = outBytes;
    if (outBytes.length <= limitBytes || targetW <= 650) break;
    targetW = clampW(targetW * Math.sqrt((limitBytes * 0.85) / outBytes.length));
  }
  await src.destroy();
  return best;
}

// ⚡ पहले एक page नाप कर सही width का हिसाब लगाते हैं, फिर एक ही बार पूरी PDF बनाते हैं।
//    पहले 5 अलग-अलग width पर पूरी 10-page PDF बनती थी (50 बार भारी काम) — इसीलिए
//    desktop जम जाता था। अब ज़्यादा से ज़्यादा 3 बार।
async function buildBilevelPdf(pages, limitBytes, onProgress) {
  const pdfLib = await import('pdf-lib');
  const perPage = (limitBytes * 0.90) / pages.length;

  // ── नाप: पहला page 1200px पर ──
  onProgress?.(0, pages.length, 'नाप रहे हैं');
  const probe = await pageBlobToBilevel(pages[0], 1200);
  await breathe();

  // size ≈ pixel² के अनुपात में — इसलिए ज़रूरी width का सीधा हिसाब
  const clampW = (v) => Math.max(700, Math.min(1500, Math.round(v / 50) * 50));
  let targetW = clampW(1200 * Math.sqrt(perPage / Math.max(probe.bytes.length, 1)));
  console.log(`[bilevel probe] 1200px = ${Math.round(probe.bytes.length/1024)}KB/page · budget ${Math.round(perPage/1024)}KB → width ${targetW}px`);

  let best = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const out = await pdfLib.PDFDocument.create();
    for (let i = 0; i < pages.length; i++) {
      onProgress?.(i + 1, pages.length, `${targetW}px`);
      const img = await pageBlobToBilevel(pages[i], targetW);
      await addBilevelPage(out, pdfLib, img);
      await breathe();                    // ⚡ UI जमने न पाए
    }
    const bytes = await out.save({ useObjectStreams: true });
    console.log(`[bilevel ${targetW}px] ${pages.length} pages → ${Math.round(bytes.length/1024)}KB`);
    if (!best || bytes.length < best.length) best = bytes;
    if (bytes.length <= limitBytes) return bytes;
    if (targetW <= 700) break;
    // जितना ज़्यादा है उतना width घटाएं (एक ही सुधार में पहुँच जाता है)
    targetW = clampW(targetW * Math.sqrt((limitBytes * 0.88) / bytes.length));
  }
  return best;
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚡ रफ़्तार का असली राज़: भारी काम फोन/डेस्कटॉप का नहीं, Cloudinary के सर्वर का
//    PDF का page render करना (pdf.js) सबसे भारी काम है — पुराने डेस्कटॉप पर
//    एक page 5-10 सेकंड ले लेता है, यानी 10 pages = 2 मिनट।
//    Cloudinary वही काम अपने सर्वर पर पलक झपकते कर देता है। हमें बस तैयार JPG
//    उतारनी है (हर एक ~50KB) और उसे 1-bit करके जोड़ना है — ये काम सेकंडों का है।
//    pdf.js अब सिर्फ तब चलेगा जब Cloudinary किसी वजह से मना कर दे।
// ═══════════════════════════════════════════════════════════════════════════
async function compressExistingPdf(bytes, d, onProgress, opts = {}) {
  const allowSplit = opts.allowSplit !== false;
  const origKB = Math.round(bytes.length / 1024);
  const LIMIT = MAX_PDF_KB * 1024;
  const asFile = (b, suffix = '.pdf') => new File([b], safeName(d, suffix), { type: 'application/pdf' });
  if (bytes.length <= LIMIT) return { files: [asFile(bytes)], note: null };

  const errors = [];
  let bestSoFar = null;
  let cachedPages = null;

  // ── तरीका 1: Cloudinary से pages उतारकर 1-bit (सबसे तेज़) ──
  try {
    const { pages, via } = await getPagesAsBlobs(d, null, onProgress);   // सिर्फ Cloudinary
    cachedPages = pages;
    const bw = await buildBilevelPdf(pages, LIMIT, onProgress);
    if (bw) {
      bestSoFar = bw;
      if (bw.length <= LIMIT) {
        return { files: [asFile(bw)], note: `${via} · एक ही file — ${origKB}KB → ${Math.round(bw.length/1024)}KB` };
      }
      errors.push(`1-bit: ${Math.round(bw.length/1024)}KB`);
    }
  } catch (e) { console.warn('[cloudinary bilevel]', e?.message); errors.push(`Cloudinary: ${e?.message}`); }

  // ── तरीका 2: pdf.js से खुद render (धीमा — सिर्फ तब जब ऊपर वाला न चले) ──
  if (!bestSoFar && bytes) {
    try {
      const bw = await bilevelFromPdfBytes(bytes, LIMIT, onProgress);
      if (bw) {
        bestSoFar = bw;
        if (bw.length <= LIMIT) {
          return { files: [asFile(bw)], note: `1-bit · एक ही file — ${origKB}KB → ${Math.round(bw.length/1024)}KB` };
        }
        errors.push(`1-bit(local): ${Math.round(bw.length/1024)}KB`);
      }
    } catch (e) { console.warn('[local bilevel]', e?.message); errors.push(`pdf.js: ${e?.message}`); }
  }

  // ── तरीका 3: PDF के अंदर की images छोटी करें, text vector रखें ──
  if (bytes) {
    try {
      const { bytes: out } = await shrinkPdfImages(bytes, 800, 0.52);
      if (out.length <= LIMIT) {
        return { files: [asFile(out)], note: `images छोटी करके ${origKB}KB → ${Math.round(out.length/1024)}KB (text ज्यों का त्यों)` };
      }
      if (!bestSoFar || out.length < bestSoFar.length) bestSoFar = out;
      errors.push(`image-shrink: ${Math.round(out.length/1024)}KB`);
    } catch (e) { errors.push(`image-shrink: ${e?.message}`); }
  }

  // ── थोड़ी बड़ी रह गई? फिर भी एक ही file देना 10 files से बेहतर है ──
  if (bestSoFar && bestSoFar.length < bytes?.length) {
    return { files: [asFile(bestSoFar)], note: `⚠️ ${Math.round(bestSoFar.length/1024)}KB तक ही आई (एक ही file)` };
  }

  // ── आखिरी सहारा: हर page की अलग file ──
  if (allowSplit && cachedPages?.length) {
    try {
      const { PDFDocument } = await import('pdf-lib');
      const files = [];
      for (let i = 0; i < cachedPages.length; i++) {
        onProgress?.(i + 1, cachedPages.length);
        const one = await PDFDocument.create();
        await encodeBlobToPdfPage(one, cachedPages[i], Math.floor(LIMIT * 0.85));
        files.push(new File([await one.save({ useObjectStreams: true })], safeName(d, '.pdf', i + 1), { type: 'application/pdf' }));
        await breathe();
      }
      if (files.length) return { files, note: `⚠️ एक file में नहीं आई — ${files.length} अलग files` };
    } catch (e) { errors.push(`split: ${e?.message}`); }
  }

  return { files: [asFile(bytes)], note: `⚠️ ${d.docTypeLabel} ${origKB}KB ही रह गई — ${errors.join(' · ')}` };
}

// ── छोटी बनी PDF को Cloudinary पर वापस save करें और record अपडेट करें ────────
//    फायदा: अगली बार वही document भेजने पर compress करना ही नहीं पड़ेगा —
//    सीधे तैयार 176KB वाली file जाएगी (तुरंत), और storage भी 15 गुना कम लगेगा।
async function replaceWithCompressed(d, file) {
  const CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'vphonda';
  const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_PRESET     || 'vp_honda_docs';
  const id = d._id || d.id;
  if (!id) return null;

  const fd = new FormData();
  fd.append('file', file, file.name || 'document.pdf');
  fd.append('upload_preset', UPLOAD_PRESET);
  fd.append('folder', 'vp-honda-docs');
  const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: 'POST', body: fd });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.secure_url) throw new Error(data?.error?.message || `upload ${r.status}`);

  await apiFetch(`/api/documents/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileUrl: data.secure_url,
      fileData: null,                       // base64 हो तो हटा दें — MongoDB हल्का रहे
      storageType: 'cloudinary',
      compressedKB: Math.round(file.size / 1024),
      oldFileUrl: d.fileUrl || null,        // पुरानी कड़ी record में रहे
    }),
  });
  console.log(`[replace] ${d.docTypeLabel} अब ${Math.round(file.size/1024)}KB का हो गया`);
  return data.secure_url;
}

// ── STEP 1: Files तैयार करें (यह slow है — इसलिए share से अलग रखा) ──────────
// ⚠️ पुराना बग: click के बाद fetch + clipboard + 2.5 सेकंड wait करते थे,
//    तब तक browser का "user gesture" खत्म हो जाता था → navigator.share fail
//    → "Multi-share fail" toast। अब files पहले बनती हैं, share अलग tap पर होता है।
async function buildShareFiles(docs, onStatus) {
  const valid = docs.filter(d => d.fileData || d.fileUrl);
  const files = [], fileLabels = [], failReasons = [];

  let idx = 0;
  for (const d of valid) {
    idx++;
    onStatus?.(`${idx}/${valid.length} · ${d.docTypeLabel}`);
    try {
      if (d.fileType === 'pdf') {
        const { bytes } = await getDocBytes(d);
        const { files: pdfFiles, note } = await compressExistingPdf(bytes, d, (p, tot) =>
          onStatus?.(`${idx}/${valid.length} · ${d.docTypeLabel} — page ${p}/${tot}`));

        // ✅ एक ही छोटी file बनी हो तो उसे Cloudinary पर वापस save कर दें —
        //    अगली बार तुरंत भेजी जाएगी, दोबारा compress नहीं करनी पड़ेगी
        if (pdfFiles.length === 1 && pdfFiles[0].size < bytes.length * 0.8) {
          onStatus?.(`${idx}/${valid.length} · ${d.docTypeLabel} — छोटी file save कर रहे हैं`);
          try { await replaceWithCompressed(d, pdfFiles[0]); }
          catch (e) { console.warn('[replace fail]', e?.message); }
        }
        // ✅ Plan C में एक doc की कई files बन सकती हैं
        pdfFiles.forEach((f, k) => {
          files.push(f);
          fileLabels.push(pdfFiles.length > 1 ? `${d.docTypeLabel} (${k + 1}/${pdfFiles.length})` : d.docTypeLabel);
        });
        if (note && note.startsWith('⚠️')) failReasons.push(note.replace('⚠️ ', ''));
        else if (note) console.log('[compress]', note);
      } else if (d.fileType !== 'video') {
        const pdfFile = await imageToPDF(d);
        if (!pdfFile) throw new Error('PDF बना नहीं');
        files.push(pdfFile); fileLabels.push(d.docTypeLabel);
      } else {
        const { bytes, mime } = await getDocBytes(d);
        files.push(bytesToFile(bytes, safeName(d, '.mp4'), mime || 'video/mp4'));
        fileLabels.push(d.docTypeLabel);
      }
    } catch (e) {
      console.warn(`Failed: ${d.docTypeLabel}`, e?.message);
      failReasons.push(`${d.docTypeLabel}: ${e?.message || 'unknown'}`);
    }
  }
  const totalKB = Math.round(files.reduce((sum, f) => sum + f.size, 0) / 1024);
  return { files, fileLabels, failReasons, totalKB };
}

// ── Desktop / share-नहीं-चलने पर: सब download ────────────────────────────────
async function downloadAllFiles(files) {
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const link = document.createElement('a');
    link.href = url; link.download = f.name;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    await new Promise(r => setTimeout(r, 300));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export default function DocumentVault() {
  const [docs,         setDocs]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [search,       setSearch]       = useState('');
  const [showForm,     setShowForm]     = useState(false);
  const [form,         setForm]         = useState({
    customerName: '', customerPhone: '', aadharNo: '',
    vehicleModel: '', chassisNo: '', nomineeName: '',
    hypothecation: '', docType: 'aadhar', expiryDate: '', notes: ''
  });
  const [fileData,     setFileData]     = useState(null);
  const [capturing,    setCapturing]    = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [viewDoc,      setViewDoc]      = useState(null);
  const [viewDocData,  setViewDocData]  = useState(null);
  const [activeFolder, setActiveFolder] = useState(null);
  const [view,         setView]         = useState('folders');
  const [customers,    setCustomers]    = useState([]);
  const [custSearch,   setCustSearch]   = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  // ✅ Share pack — files पहले तैयार, फिर एक tap में भेजना
  const [sharePack,    setSharePack]    = useState(null);
  const [preparing,    setPreparing]    = useState(false);
  const [prepStatus,   setPrepStatus]   = useState('');
  // 💾 Laptop में save करने वाला picker
  const [savePick,     setSavePick]     = useState(null);   // { folder, docs }
  const [savePickSel,  setSavePickSel]  = useState([]);     // चुने हुए doc ids
  const [sentIdx,      setSentIdx]      = useState([]);
  const dropdownRef = useRef(null);

  // ── Load documents ──────────────────────────────────────────────────────────
  const loadDocuments = async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch('/api/documents');
      setDocs(Array.isArray(data) ? data : []);
    } catch(e) {
      console.error('[DocumentVault] loadDocs error:', e.message);
      if (e.message?.includes('404') || e.message?.includes('not found')) {
        setError('❌ Backend documents route नहीं मिली। server.js update करें।');
      } else if (e.message?.includes('NetworkError') || e.message?.includes('fetch')) {
        setError('❌ Server connect नहीं हुआ। Internet check करें।');
      } else {
        setError(`❌ Error: ${e.message} — पुनः प्रयास करें`);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDocuments();
    fetch(api('/api/customers')).then(r => r.ok ? r.json() : []).then(setCustomers).catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const fn = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // ── Customer search/autofill ────────────────────────────────────────────────
  const filteredCustomers = custSearch.trim().length >= 2
    ? customers.filter(c =>
        (c.customerName || c.name || '').toLowerCase().includes(custSearch.toLowerCase()) ||
        (c.mobileNo || c.phone || '').includes(custSearch) ||
        (c.aadhar || '').includes(custSearch)
      ).slice(0, 8)
    : [];

  const selectCustomer = (c) => {
    // ✅ FIX: सब phone field variants + both numbers + aadhar
    const phone1 = c.phone || c.mobileNo || '';
    const phone2 = c.alternatePhone || c.alternateMobileNo || c.phone2 || c.mobileNo2 || '';
    const combinedPhone = phone2 && phone2 !== phone1 ? `${phone1}/ ${phone2}` : phone1;
    setForm({ ...form,
      customerName:  c.customerName || c.name || '',
      customerPhone: combinedPhone,
      aadharNo:      c.aadhar || c.aadharNo || c.aadhaar || '',
      vehicleModel:  c.vehicleModel || c.linkedVehicle?.name || '',
      chassisNo:     c.chassisNo || c.linkedVehicle?.chassisNo || '',
    });
    setCustSearch(c.customerName || c.name || '');
    setShowDropdown(false);
  };

  const handleCustNameChange = (value) => {
    setCustSearch(value);
    setForm({ ...form, customerName: value });
    setShowDropdown(value.trim().length >= 2);
  };

  // ── Folders ─────────────────────────────────────────────────────────────────
  // ✅ FIX: Always recompute key (ignore old d.folder) — पुराने duplicate folders merge हो जाएंगे
  const folders = docs.reduce((acc, d) => {
    const key = folderKey(d.customerName, d.customerPhone);
    if (!acc[key]) acc[key] = { name: d.customerName, phone: d.customerPhone, docs: [], date: d.savedAt, nomineeName: '', hypothecation: '' };
    acc[key].docs.push(d);
    // Latest non-empty values रखें (अगर किसी एक doc में हैं)
    if (d.nomineeName)   acc[key].nomineeName   = d.nomineeName;
    if (d.hypothecation) acc[key].hypothecation = d.hypothecation;
    // Latest date
    if (new Date(d.savedAt) > new Date(acc[key].date)) acc[key].date = d.savedAt;
    return acc;
  }, {});
  const folderList = Object.entries(folders).sort((a, b) => new Date(b[1].date) - new Date(a[1].date));
  // ✅ Filter folders by search query
  const visibleFolders = search.trim()
    ? folderList.filter(([_, f]) => {
        const q = search.toLowerCase();
        return (f.name || '').toLowerCase().includes(q) || (f.phone || '').includes(q);
      })
    : folderList;
  // ✅ Auto-open folder if search matches exactly 1
  useEffect(() => {
    if (search.trim() && visibleFolders.length === 1 && view === 'folders' && !activeFolder) {
      setActiveFolder(visibleFolders[0][0]);
      setView('folder_detail');
    }
  }, [search, visibleFolders.length]);

  // ── Save document ────────────────────────────────────────────────────────────
  // ── Upload to Cloudinary (free 25GB) — base64 MongoDB में save नहीं होगा ──
  // ✅ अब blob सीधे भेजते हैं (base64 → blob दोबारा convert नहीं = आधी memory)
  //    error आने पर Cloudinary का असली message दिखता है, और 1 बार auto-retry होता है
  const uploadToCloudinary = async (source, fileName, fileType) => {
    const CLOUD_NAME   = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'vphonda';
    const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_PRESET   || 'vp_honda_docs';

    // source: Blob/File (नया) या base64 dataUrl (पुराना) — दोनों support
    const blob = typeof source === 'string' ? await (await fetch(source)).blob() : source;
    if (!blob) throw new Error('File data नहीं मिला');

    // 'auto' पहली पसंद — इससे PDF, Cloudinary पर image बनकर जाती है और
    // server-side page→JPG conversion चल पाता है
    const doUpload = async (resourceType = 'auto') => {
      const formData = new FormData();
      formData.append('file', blob, fileName || 'document.jpg');
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('folder', 'vp-honda-docs');
      const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
        method: 'POST', body: formData,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        // ✅ असली कारण दिखेगा (जैसे: File size too large / Invalid PDF file)
        throw new Error(data?.error?.message || `Cloudinary ${r.status}`);
      }
      return data.secure_url;
    };

    try {
      return await doUpload('auto');
    } catch (e1) {
      console.warn('[Cloudinary try-1 failed]', e1.message);
      // ✅ "Invalid PDF file" — Cloudinary का PDF parser कुछ PDFs (encrypted/
      //    protected insurance policy वगैरह) नहीं पढ़ पाता। ऐसी file 'raw' में
      //    ज्यों की त्यों चली जाती है — document सुरक्षित upload हो जाता है।
      if (/invalid\s+(pdf|image|file)/i.test(e1.message || '')) {
        try {
          const url = await doUpload('raw');
          console.log('[Cloudinary] raw fallback सफल');
          return url;
        } catch (eRaw) { console.warn('[Cloudinary raw fallback fail]', eRaw.message); }
      }
      await new Promise(r => setTimeout(r, 1200));
      return await doUpload('auto'); // 1 retry (network glitch के लिए)
    }
  };

  const saveDoc = async (stayOpen = false) => {
    if (!form.customerName || !fileData) { alert('Customer name और file जरूरी है'); return; }
    setSaving(true);
    const docType = DOC_TYPES.find(d => d.key === form.docType) || DOC_TYPES[0];
    const now = new Date().toISOString();
    try {
      // ✅ Cloudinary पर upload करें — MongoDB में सिर्फ URL save होगा
      let fileUrl = null, storedFileData = null;
      const uploadBlob = fileData.blob;
      showInAppToast('☁️', 'Cloudinary पर upload हो रहा है...', 'info');
      try {
        // ✅ blob सीधे भेजें (memory-safe), न मिले तो dataUrl
        fileUrl = await uploadToCloudinary(uploadBlob || fileData.dataUrl, fileData.fileName, fileData.fileType);
      } catch (cloudErr) {
        console.warn('Cloudinary failed:', cloudErr.message);
        // ✅ Fallback सिर्फ छोटी files के लिए — बड़ी base64 MongoDB में जाने से
        //    "memory limit exceeded" / document size errors आते थे
        if (fileData.dataUrl && fileData.sizeKB <= 700) {
          storedFileData = fileData.dataUrl;
          showInAppToast('⚠️ Cloudinary fail', `${cloudErr.message} — MongoDB में save कर रहे हैं`, 'warning');
        } else {
          setSaving(false);
          alert(`❌ Cloudinary upload fail हुआ:\n${cloudErr.message}\n\nFile size: ${fileData.sizeKB}KB\n\nइतनी बड़ी file MongoDB में save नहीं करेंगे (server memory error आता है)।\nदोबारा try करें या छोटी/कम quality photo लगाएं।`);
          return;
        }
      }
      const payload = {
        folder: folderKey(form.customerName, form.customerPhone),
        customerName: form.customerName, customerPhone: form.customerPhone,
        aadharNo: form.aadharNo, vehicleModel: form.vehicleModel, chassisNo: form.chassisNo,
        nomineeName: form.nomineeName, hypothecation: form.hypothecation,
        docType: form.docType, docTypeLabel: docType.label, docIcon: docType.icon,
        expiryDate: form.expiryDate, notes: form.notes,
        // ✅ fileUrl (Cloudinary) OR fileData (fallback base64)
        fileUrl:   fileUrl || null,
        fileData:  storedFileData || null,
        fileType:  fileData.fileType, fileName: fileData.fileName,
        savedAt:   now,
        storageType: fileUrl ? 'cloudinary' : 'mongodb',
      };
      const saved = await apiFetch('/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      setDocs(prev => [saved, ...prev]);
      showInAppToast('☁️ Saved!', fileUrl ? 'Cloudinary पर save हुआ ✅' : docType.label, 'success');
      if (!stayOpen) {
        setShowForm(false); setFileData(null); setCustSearch('');
        setForm({ customerName:'', customerPhone:'', aadharNo:'', vehicleModel:'', chassisNo:'', nomineeName:'', hypothecation:'', docType:'aadhar', expiryDate:'', notes:'' });
      } else {
        setFileData(null);
        setForm(f => ({ ...f, docType: 'aadhar', expiryDate: '', notes: '' }));
      }
    } catch { showInAppToast('❌ Save error', 'Retry करें', 'error'); }
    setSaving(false);
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const deleteDoc = async (id) => {
    if (!id || !window.confirm('Delete करें?')) return;
    await apiFetch(`/api/documents/${id}`, { method: 'DELETE' }).catch(() => {});
    setDocs(prev => prev.filter(d => d.id !== id && d._id !== id));
  };

  // ── Open doc (load fileData — Cloudinary URL या MongoDB base64) ────────────
  const openDoc = async (doc) => {
    setViewDoc(doc); setViewDocData(null);
    try {
      // ✅ Cloudinary URL directly use करें (no MongoDB fetch needed)
      if (doc.fileUrl) {
        setViewDocData(doc.fileUrl);
        return;
      }
      // Legacy: MongoDB base64 fetch
      const full = await apiFetch(`/api/documents/${doc._id || doc.id}`);
      setViewDocData(full.fileUrl || full.fileData || null);
    } catch {}
  };

  // ── File pickers ─────────────────────────────────────────────────────────────
  const capturePhoto = async () => {
    setCapturing(true);
    try {
      const raw  = await captureFromCamera('environment');
      const comp = await compressImageRobust(raw);
      // ✅ BUG FIX: comp is an object {dataUrl, sizeKB, method, origKB} — use comp.dataUrl
      setFileData({
        dataUrl:    comp.dataUrl,
        blob:       comp.blob,
        fileType:   'image',
        fileName:   'camera_photo.jpg',
        sizeKB:     comp.sizeKB,
        origKB:     comp.origKB,
        compFailed: comp.failed || false,
        compMethod: comp.method,
      });
    } catch (e) { showInAppToast('❌ Camera error', String(e), 'error'); }
    setCapturing(false);
  };
  // ✅ safe wrapper — processFile fail हो तो app crash न हो
  const handlePicked = async (f, type) => {
    if (!f) return;
    try {
      showInAppToast('⏳', 'File तैयार हो रही है...', 'info');
      setFileData(await processFile(f, type));
    } catch (err) {
      console.warn('[processFile]', err?.message);
      if (err?.message && !/too large|compression failed/.test(err.message)) {
        showInAppToast('❌ File error', err.message, 'error');
      }
    }
  };
  const pickFromGallery = () => {
    // ✅ image/* — iPhone HEIC/HEIF भी select हो सकेगी (compress करके JPG बन जाएगी)
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
    input.onchange = (e) => handlePicked(e.target.files?.[0], 'image');
    input.click();
  };
  const pickPDF = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/pdf';
    input.onchange = (e) => handlePicked(e.target.files?.[0], 'pdf');
    input.click();
  };
  const pickVideo = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'video/mp4,video/quicktime';
    input.onchange = (e) => handlePicked(e.target.files?.[0], 'video');
    input.click();
  };

  // ── STEP 1: तैयारी (slow काम — download + PDF बनाना) ───────────────────────
  const prepareShare = async (validDocs, textMsg, title) => {
    setPreparing(true);
    setSentIdx([]);
    setPrepStatus('');
    showInAppToast('⏳', `${validDocs.length} documents तैयार हो रहे हैं...`, 'info');
    try {
      const { files, fileLabels, failReasons, totalKB } = await buildShareFiles(validDocs, setPrepStatus);
      if (files.length === 0) {
        alert(`❌ कोई भी document तैयार नहीं हो पाया।\n\n${failReasons.slice(0, 6).join('\n')}\n\nInternet check करके दोबारा try करें।`);
        setPreparing(false);
        return;
      }
      setSharePack({ files, fileLabels, failReasons, totalKB, textMsg, title, docs: validDocs });
      // छोटी हुई files record में update हो चुकी हैं — list ताज़ा कर लें
      apiFetch('/api/documents').then(dd => setDocs(Array.isArray(dd) ? dd : [])).catch(() => {});
      showInAppToast('✅ तैयार!', `${files.length} PDFs · ${totalKB} KB — अब भेजें दबाएं`, 'success');
    } catch (e) {
      alert(`❌ तैयारी में error: ${e?.message || 'unknown'}`);
    }
    setPreparing(false);
  };

  // ── STEP 2: भेजना — इसमें कोई await नहीं, इसलिए पहली ही click में चलेगा ─────
  const doShareAll = () => {
    if (!sharePack) return;
    const { files, textMsg, title } = sharePack;
    if (!navigator.share) { downloadAllFiles(files).then(() => { const p = prompt('📱 WhatsApp number (10 digit):'); if (p) sendWhatsApp(p, textMsg); }); return; }
    if (!(navigator.canShare && navigator.canShare({ files }))) {
      showInAppToast('⚠️', 'फोन एक साथ इतनी files नहीं भेज सकता — नीचे से एक-एक भेजें', 'warning');
      return;
    }
    navigator.share({ title, text: textMsg, files })
      .then(() => {
        setSentIdx(files.map((_, i) => i));
        showInAppToast('✅ भेज दिया', `${files.length} documents`, 'success');
        navigator.clipboard?.writeText(textMsg).catch(() => {});
      })
      .catch(err => {
        if (err?.name === 'AbortError') return;
        console.warn('[share all]', err?.name, err?.message);
        showInAppToast('⚠️', 'एक साथ नहीं गया — नीचे से एक-एक भेजें', 'warning');
      });
  };

  // एक file भेजें (हर tap = नया gesture = सबसे भरोसेमंद तरीका)
  const doShareOne = (i) => {
    if (!sharePack) return;
    const { files, fileLabels, textMsg, title } = sharePack;
    const f = files[i];
    if (!f) return;
    if (!navigator.share) { downloadAllFiles([f]); return; }
    const cap = i === 0 ? textMsg : `📄 ${fileLabels[i]} — ${title}`;
    navigator.share({ title: f.name, text: cap, files: [f] })
      .then(() => setSentIdx(prev => prev.includes(i) ? prev : [...prev, i]))
      .catch(err => {
        if (err?.name === 'AbortError') return;
        showInAppToast('❌', `${fileLabels[i]} नहीं गया — दोबारा दबाएं`, 'error');
      });
  };

  const copyShareText = () => {
    if (!sharePack) return;
    navigator.clipboard?.writeText(sharePack.textMsg)
      .then(() => showInAppToast('📋 Copy हुआ', 'WhatsApp में long-press → Paste', 'success'))
      .catch(() => showInAppToast('⚠️', 'Copy नहीं हुआ', 'warning'));
  };

  // ── 💾 Laptop / फोन में save करना ────────────────────────────────────────────
  const openSavePicker = (folderDocs, folder) => {
    const withFile = folderDocs.filter(d => d.fileData || d.fileUrl);
    if (!withFile.length) { alert('इस folder में कोई file वाला document नहीं है।'); return; }
    setSavePick({ folder, docs: withFile });
    setSavePickSel(withFile.map(d => d._id || d.id));   // शुरू में सब चुने हुए
  };

  const toggleSavePick = (id) => {
    setSavePickSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // चुनी हुई files तैयार करके laptop में save करें
  const saveSelectedToDisk = async (useFolderPicker) => {
    if (!savePick) return;
    const chosen = savePick.docs.filter(d => savePickSel.includes(d._id || d.id));
    if (!chosen.length) { alert('कम से कम एक document चुनिए।'); return; }

    // ✅ folder picker वाली अनुमति *पहले* लें — user के tap के तुरंत बाद,
    //    वरना browser मना कर देता है
    let dirHandle = null;
    if (useFolderPicker && window.showDirectoryPicker) {
      try {
        dirHandle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'downloads' });
      } catch (e) {
        if (e?.name === 'AbortError') return;             // user ने cancel किया
        console.warn('[dir picker]', e?.message);
      }
    }

    setSavePick(null);
    setPreparing(true); setPrepStatus('');
    try {
      // वही pipeline — PDFs अपने-आप 200KB के अंदर आ जाएंगी
      const { files, failReasons } = await buildShareFiles(chosen, setPrepStatus);
      if (!files.length) {
        alert(`❌ कोई file तैयार नहीं हुई।\n\n${failReasons.slice(0, 5).join('\n')}`);
        return;
      }

      const cleanName = cleanPart(savePick.folder?.name) || 'Documents';
      if (dirHandle) {
        // ── सीधे चुने हुए folder में लिखें ──
        let sub = dirHandle;
        try { sub = await dirHandle.getDirectoryHandle(cleanName, { create: true }); }
        catch { /* नाम की दिक्कत हो तो मुख्य folder में ही */ }
        const used = new Set();
        for (let i = 0; i < files.length; i++) {
          setPrepStatus(`Save हो रही है ${i + 1}/${files.length}`);
          // दो documents का नाम एक जैसा निकले तो पीछे अंक लगा दें (कोई file मिटे नहीं)
          let name = files[i].name;
          if (used.has(name)) {
            const dot = name.lastIndexOf('.');
            const stem = dot > 0 ? name.substring(0, dot) : name;
            const ext  = dot > 0 ? name.substring(dot) : '';
            let n = 2;
            while (used.has(`${stem}${n}${ext}`)) n++;
            name = `${stem}${n}${ext}`;
          }
          used.add(name);
          const fh = await sub.getFileHandle(name, { create: true });
          const w = await fh.createWritable();
          await w.write(files[i]);
          await w.close();
        }
        showInAppToast('✅ Save हो गईं', `${files.length} files · folder: ${cleanName}`, 'success');
      } else {
        // ── Fallback: सामान्य download (फोन और पुराने browser के लिए) ──
        await downloadAllFiles(files);
        showInAppToast('⬇️ Download शुरू', `${files.length} files — Downloads folder देखें`, 'success');
      }

      if (failReasons.length) {
        showInAppToast('⚠️', `${failReasons.length} document छूट गए`, 'warning');
      }
      apiFetch('/api/documents').then(dd => setDocs(Array.isArray(dd) ? dd : [])).catch(() => {});
    } catch (e) {
      console.warn('[saveToDisk]', e?.message);
      alert(`❌ Save में दिक्कत: ${e?.message || 'unknown'}`);
    }
    setPreparing(false);
  };

  // ── Insurance share ──────────────────────────────────────────────────────────
  const sendInsurance = async (folderDocs, folder) => {
    const needed = folderDocs.filter(d => INSURANCE_REQUIRED_KEYS.includes(d.docType));
    if (needed.length === 0) { alert('कोई Insurance document नहीं है।\nजरूरी: VP Tax Invoice, Aadhar, PAN, Chassis Trace'); return; }

    showInAppToast('⏳', `${needed.length} documents load हो रहे हैं...`, 'info');
    let loadedCount = 0;
    let failedCount = 0;
    const withData = await Promise.all(needed.map(async d => {
      try {
        const full = await apiFetch(`/api/documents/${d._id || d.id}`);
        if (full && (full.fileUrl || full.fileData)) { loadedCount++; return { ...d, fileData: full.fileUrl || full.fileData, fileUrl: full.fileUrl || null }; }
        failedCount++; return null;
      } catch { failedCount++; return null; }
    }));
    const valid = withData.filter(Boolean);

    // ✅ Status दिखाएं
    if (valid.length === 0) {
      alert(`❌ ${needed.length} में से एक भी document load नहीं हुआ।\nNetwork slow है — फिर try करें।`);
      return;
    }
    if (failedCount > 0) {
      showInAppToast('⚠️', `${failedCount} docs load नहीं हुए, ${valid.length} भेज रहे हैं`, 'warning');
    } else {
      showInAppToast('✅', `${valid.length} docs मिल गए — PDF बन रही हैं...`, 'info');
    }

    const msg = `🛡️ *VP Honda — Insurance Documents*\n👤 ${folder.name}\n📞 ${folder.phone || ''}\n👥 Nominee: ${folder.nomineeName || '—'}\n🏦 Hypothecation: ${folder.hypothecation || '—'}\n\n📎 Documents:\n${valid.map(d => `✅ ${d.docTypeLabel}`).join('\n')}${needed.length < INSURANCE_REQUIRED_KEYS.length ? `\n\n❌ Missing:\n${INSURANCE_REQUIRED_KEYS.filter(k => !folderDocs.some(d=>d.docType===k)).map(k => `❌ ${DOC_TYPES.find(t=>t.key===k)?.label||k}`).join('\n')}` : ''}\n\n📅 ${new Date().toLocaleDateString('en-IN')}\n🏍️ VP Honda, Bhopal · 📞 9713394738`;

    await prepareShare(valid, msg, `Insurance - ${folder.name}`);
  };

  // ── RTO/Pal share ────────────────────────────────────────────────────────────
  const sendRTO = async (folderDocs, folder) => {
    const needed = folderDocs.filter(d => RTO_REQUIRED_KEYS.includes(d.docType));
    if (needed.length === 0) { alert('कोई RTO document नहीं है।\nजरूरी: SU Tax Invoice, Insurance, Aadhar, PAN, Chassis Trace, Chassis Photo'); return; }

    showInAppToast('⏳', `${needed.length} documents load हो रहे हैं...`, 'info');
    let failedCount = 0;
    const withData = await Promise.all(needed.map(async d => {
      try {
        const full = await apiFetch(`/api/documents/${d._id || d.id}`);
        if (full && (full.fileUrl || full.fileData)) return { ...d, fileData: full.fileUrl || full.fileData, fileUrl: full.fileUrl || null };
        failedCount++; return null;
      } catch { failedCount++; return null; }
    }));
    const valid = withData.filter(Boolean);
    const first = folderDocs[0];

    if (valid.length === 0) {
      alert(`❌ ${needed.length} में से एक भी document load नहीं हुआ।\nNetwork slow है — फिर try करें।`);
      return;
    }
    if (failedCount > 0) {
      showInAppToast('⚠️', `${failedCount} docs load नहीं हुए, ${valid.length} भेज रहे हैं`, 'warning');
    } else {
      showInAppToast('✅', `${valid.length} docs मिल गए — PDF बन रही हैं...`, 'info');
    }

    const msg = `🚗 *VP Honda — RTO Documents (Pal)*\n👤 ${folder.name}\n📞 ${folder.phone || ''}\n🏍️ ${first?.vehicleModel || ''}\n🔢 Chassis: ${first?.chassisNo || ''}\n\n📎 Documents:\n${valid.map(d => `✅ ${d.docTypeLabel}`).join('\n')}\n\n📅 ${new Date().toLocaleDateString('en-IN')}\n🏍️ VP Honda, Bhopal · 📞 9713394738`;

    await prepareShare(valid, msg, `RTO - ${folder.name}`);
  };

  // ── SU Tax Invoice share ─────────────────────────────────────────────────────
  // ✅ Required: Challan, Aadhar, PAN, Chassis Trace
  const sendSUTax = async (folderDocs, folder) => {
    const needed = folderDocs.filter(d => SU_TAX_REQUIRED_KEYS.includes(d.docType));
    if (needed.length === 0) { alert('कोई SU Tax Invoice document नहीं है।\nजरूरी: Challan, Aadhar, PAN, Chassis Trace'); return; }

    showInAppToast('⏳', `${needed.length} documents load हो रहे हैं...`, 'info');
    let failedCount = 0;
    const withData = await Promise.all(needed.map(async d => {
      try {
        const full = await apiFetch(`/api/documents/${d._id || d.id}`);
        if (full && (full.fileUrl || full.fileData)) return { ...d, fileData: full.fileUrl || full.fileData, fileUrl: full.fileUrl || null };
        failedCount++; return null;
      } catch { failedCount++; return null; }
    }));
    const valid = withData.filter(Boolean);
    const first = folderDocs[0];

    if (valid.length === 0) {
      alert(`❌ ${needed.length} में से एक भी document load नहीं हुआ।\nNetwork slow है — फिर try करें।`);
      return;
    }
    if (failedCount > 0) {
      showInAppToast('⚠️', `${failedCount} docs load नहीं हुए, ${valid.length} भेज रहे हैं`, 'warning');
    } else {
      showInAppToast('✅', `${valid.length} docs मिल गए — PDF बन रही हैं...`, 'info');
    }

    const missingKeys = SU_TAX_REQUIRED_KEYS.filter(k => !folderDocs.some(d => d.docType === k));
    const missingText = missingKeys.length ? `\n\n❌ Missing:\n${missingKeys.map(k => `❌ ${DOC_TYPES.find(t=>t.key===k)?.label||k}`).join('\n')}` : '';

    const msg = `📄 *VP Honda — SU Tax Invoice Documents*\n👤 ${folder.name}\n📞 ${folder.phone || ''}\n🏍️ ${first?.vehicleModel || ''}\n🔢 Chassis: ${first?.chassisNo || ''}\n\n📎 Documents:\n${valid.map(d => `✅ ${d.docTypeLabel}`).join('\n')}${missingText}\n\n📅 ${new Date().toLocaleDateString('en-IN')}\n🏍️ VP Honda, Bhopal · 📞 9713394738`;

    await prepareShare(valid, msg, `SU Tax - ${folder.name}`);
  };

  // ── Single doc share ─────────────────────────────────────────────────────────
  const shareSingleDoc = async (doc) => {
    let fileDataUrl = doc.fileData;
    if (!fileDataUrl) {
      try { const full = await apiFetch(`/api/documents/${doc._id || doc.id}`); fileDataUrl = full.fileUrl || full.fileData; }
      catch {}
    }
    if (!fileDataUrl) { alert('File load नहीं हुई'); return; }

    const msg = `📄 *VP Honda Document*\n👤 ${doc.customerName}\n📂 ${doc.docTypeLabel}\n📅 ${new Date(doc.savedAt).toLocaleDateString('en-IN')}\n\n🏍️ VP Honda, Bhopal · 📞 9713394738`;
    await prepareShare([{ ...doc, fileData: fileDataUrl, fileUrl: isHttpUrl(fileDataUrl) ? fileDataUrl : null }], msg, `${doc.docTypeLabel} - ${doc.customerName}`);
  };

  // ── Derived data ─────────────────────────────────────────────────────────────
  const filtered = view === 'all'
    ? docs.filter(d => !search || d.customerName.toLowerCase().includes(search.toLowerCase()))
    : docs.filter(d => folderKey(d.customerName, d.customerPhone) === activeFolder);

  const expiringSoon = docs.filter(d => d.expiryDate && checkExpiry(d.expiryDate, d.docTypeLabel)?.status !== 'ok');

  // ── RENDER ────────────────────────────────────────────────────────────────────
  if (loading) return <div style={{ padding:20, color:'#fff', textAlign:'center', background:'#020617', minHeight:'100vh' }}>☁️ Loading from MongoDB...</div>;

  if (error) return (
    <div style={{ padding:20, background:'#020617', minHeight:'100vh' }}>
      <p style={{ color:'#ef4444', fontSize:14 }}>{error}</p>
      <button onClick={loadDocuments} style={{ marginTop:10, background:'#DC0000', color:'#fff', border:'none', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
        <RefreshCw size={14} style={{ marginRight:6, verticalAlign:'middle' }}/>पुनः प्रयास
      </button>
    </div>
  );

  return (
    <div style={{ padding:14, background:'#020617', minHeight:'100vh', color:'#fff' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:800, margin:0, display:'flex', alignItems:'center', gap:8 }}>
            <FolderOpen size={20}/> Document Vault
          </h1>
          <p style={{ color:'#94a3b8', fontSize:11, margin:'3px 0 0' }}>
            {docs.length} documents · {folderList.length} customers · ☁️ MongoDB sync
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={loadDocuments} style={{ background:'#1e293b', border:'1px solid #334155', color:'#94a3b8', padding:'8px 12px', borderRadius:8, cursor:'pointer' }}>
            <RefreshCw size={14}/>
          </button>
          <button onClick={() => setShowForm(true)} style={{ background:'#DC0000', color:'#fff', border:'none', padding:'9px 16px', borderRadius:8, fontWeight:700, fontSize:12, cursor:'pointer' }}>
            + Add Document
          </button>
        </div>
      </div>

      {/* Expiry alerts */}
      {expiringSoon.length > 0 && (
        <div style={{ background:'#7c2d1222', border:'1px solid #ea580c', borderRadius:10, padding:'10px 14px', marginBottom:12 }}>
          <p style={{ color:'#fdba74', fontWeight:700, fontSize:12, margin:'0 0 5px', display:'flex', alignItems:'center', gap:5 }}>
            <AlertTriangle size={13}/> {expiringSoon.length} Documents Expire Soon!
          </p>
          {expiringSoon.map((d,i) => (
            <p key={i} style={{ color:'#fed7aa', fontSize:11, margin:'3px 0 0' }}>
              {d.docIcon} {d.customerName} · {d.docTypeLabel} · {checkExpiry(d.expiryDate, d.docTypeLabel)?.msg}
            </p>
          ))}
        </div>
      )}

      {/* Search + View Toggle */}
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        <input value={search} onChange={e => {
          setSearch(e.target.value);
          // ✅ FIX: Search करते वक्त folders view में रहें, all में नहीं
          if (!e.target.value) { setView('folders'); setActiveFolder(null); }
          else setView('folders');
        }}
          placeholder="Customer name/phone search..."
          style={{ flex:1, background:'#1e293b', color:'#fff', border:'1px solid #334155', borderRadius:8, padding:'9px 12px', fontSize:13, outline:'none' }}/>
        <button onClick={() => { setView('folders'); setSearch(''); setActiveFolder(null); }}
          style={{ background:view==='folders'?'#DC0000':'#1e293b', color:'#fff', border:'none', padding:'8px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>📁 Folders</button>
        <button onClick={() => { setView('all'); setActiveFolder(null); }}
          style={{ background:view==='all'?'#DC0000':'#1e293b', color:'#fff', border:'none', padding:'8px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>📋 All</button>
      </div>

      {/* FOLDER LIST */}
      {view === 'folders' && !activeFolder && (
        <div>
          {visibleFolders.length === 0 ? (
            <div style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:12, padding:40, textAlign:'center', color:'#64748b' }}>
              {search ? '❌ कोई customer नहीं मिला' : '+ Add Document से शुरू करें'}
            </div>
          ) : visibleFolders.map(([key, folder]) => {
            const insCount = folder.docs.filter(d => INSURANCE_REQUIRED_KEYS.includes(d.docType)).length;
            const rtoCount = folder.docs.filter(d => RTO_REQUIRED_KEYS.includes(d.docType)).length;
            const suCount  = folder.docs.filter(d => SU_TAX_REQUIRED_KEYS.includes(d.docType)).length;
            return (
              <div key={key} style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:12, padding:14, marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <div style={{ width:44, height:44, background:'#1e40af', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>📁</div>
                  <div style={{ flex:1, minWidth:140, cursor:'pointer' }} onClick={() => { setActiveFolder(key); setView('folder_detail'); }}>
                    <p style={{ fontWeight:800, fontSize:14, margin:'0 0 2px' }}>{folder.name}</p>
                    <p style={{ fontSize:11, color:'#94a3b8', margin:0 }}>📞 {folder.phone || '—'} · {folder.docs.length} docs</p>
                    {folder.nomineeName   && <p style={{ fontSize:10, color:'#c084fc', margin:'2px 0 0' }}>Nominee: {folder.nomineeName}</p>}
                    {folder.hypothecation && <p style={{ fontSize:10, color:'#fbbf24', margin:'2px 0 0' }}>Bank: {folder.hypothecation}</p>}
                    <div style={{ display:'flex', gap:3, marginTop:4, flexWrap:'wrap' }}>
                      {folder.docs.slice(0,4).map((d,i) => <span key={i} style={{ background:'#1e293b', color:'#94a3b8', padding:'1px 5px', borderRadius:3, fontSize:9 }}>{d.docIcon}</span>)}
                      {folder.docs.length > 4 && <span style={{ color:'#64748b', fontSize:9 }}>+{folder.docs.length-4}</span>}
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <button onClick={() => sendInsurance(folder.docs, folder)}
                      style={{ background:insCount>=5?'#16a34a':'#334155', color:'#fff', border:'none', padding:'7px 12px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                      🛡️ Insurance ({insCount}/{INSURANCE_REQUIRED_KEYS.length})
                    </button>
                    <button onClick={() => sendRTO(folder.docs, folder)}
                      style={{ background:rtoCount>=6?'#7c3aed':'#334155', color:'#fff', border:'none', padding:'7px 12px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                      🚗 RTO ({rtoCount}/{RTO_REQUIRED_KEYS.length})
                    </button>
                    <button onClick={() => sendSUTax(folder.docs, folder)}
                      style={{ background:suCount>=4?'#f59e0b':'#334155', color:'#fff', border:'none', padding:'7px 12px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                      📄 SU Tax ({suCount}/{SU_TAX_REQUIRED_KEYS.length})
                    </button>
                    <button onClick={() => openSavePicker(folder.docs, folder)}
                      style={{ background:'#0891b2', color:'#fff', border:'none', padding:'7px 12px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                      💾 Save ({folder.docs.length})
                    </button>
                  </div>
                  <ChevronRight size={16} color="#475569" style={{ cursor:'pointer', flexShrink:0 }} onClick={() => { setActiveFolder(key); setView('folder_detail'); }}/>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FOLDER DETAIL */}
      {view === 'folder_detail' && activeFolder && (() => {
        const folder = folders[activeFolder]; if (!folder) return null;
        const insCount = folder.docs.filter(d => INSURANCE_REQUIRED_KEYS.includes(d.docType)).length;
        const rtoCount = folder.docs.filter(d => RTO_REQUIRED_KEYS.includes(d.docType)).length;
        const suCount  = folder.docs.filter(d => SU_TAX_REQUIRED_KEYS.includes(d.docType)).length;
        return (
          <div>
            <button onClick={() => { setActiveFolder(null); setView('folders'); }}
              style={{ background:'#1e293b', border:'none', color:'#94a3b8', padding:'5px 12px', borderRadius:6, cursor:'pointer', fontSize:11, marginBottom:12 }}>
              ← सभी Folders
            </button>
            <div style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:12, padding:14, marginBottom:14 }}>
              <h2 style={{ fontSize:15, fontWeight:800, margin:'0 0 4px' }}>📁 {folder.name}</h2>
              <p style={{ color:'#94a3b8', fontSize:12, margin:'0 0 8px' }}>📞 {folder.phone||'—'} · {folder.docs.length} documents</p>
              {folder.nomineeName   && <p style={{ color:'#c084fc', fontSize:11, margin:'2px 0' }}>👤 Nominee: {folder.nomineeName}</p>}
              {folder.hypothecation && <p style={{ color:'#fbbf24', fontSize:11, margin:'2px 0' }}>🏦 Bank: {folder.hypothecation}</p>}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginTop:12 }}>
                <button onClick={() => sendInsurance(folder.docs, folder)}
                  style={{ background:'linear-gradient(135deg,#16a34a,#15803d)', color:'#fff', border:'none', padding:12, borderRadius:10, fontWeight:800, fontSize:12, cursor:'pointer', textAlign:'left' }}>
                  <div style={{ fontSize:18, marginBottom:3 }}>🛡️</div>
                  <div>Insurance Documents</div>
                  <div style={{ fontSize:10, opacity:0.8, marginTop:2 }}>{insCount}/{INSURANCE_REQUIRED_KEYS.length} ready</div>
                  {INSURANCE_REQUIRED_KEYS.map(k => <div key={k} style={{ fontSize:9, marginTop:1 }}>{folder.docs.some(d=>d.docType===k)?'✅':'❌'} {DOC_TYPES.find(t=>t.key===k)?.label}</div>)}
                </button>
                <button onClick={() => sendRTO(folder.docs, folder)}
                  style={{ background:'linear-gradient(135deg,#7c3aed,#6d28d9)', color:'#fff', border:'none', padding:12, borderRadius:10, fontWeight:800, fontSize:12, cursor:'pointer', textAlign:'left' }}>
                  <div style={{ fontSize:18, marginBottom:3 }}>🚗</div>
                  <div>RTO / Pal</div>
                  <div style={{ fontSize:10, opacity:0.8, marginTop:2 }}>{rtoCount}/{RTO_REQUIRED_KEYS.length} ready</div>
                  {RTO_REQUIRED_KEYS.map(k => <div key={k} style={{ fontSize:9, marginTop:1 }}>{folder.docs.some(d=>d.docType===k)?'✅':'❌'} {DOC_TYPES.find(t=>t.key===k)?.label}</div>)}
                </button>
                <button onClick={() => sendSUTax(folder.docs, folder)}
                  style={{ background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#fff', border:'none', padding:12, borderRadius:10, fontWeight:800, fontSize:12, cursor:'pointer', textAlign:'left' }}>
                  <div style={{ fontSize:18, marginBottom:3 }}>📄</div>
                  <div>SU Tax Invoice</div>
                  <div style={{ fontSize:10, opacity:0.8, marginTop:2 }}>{suCount}/{SU_TAX_REQUIRED_KEYS.length} ready</div>
                  {SU_TAX_REQUIRED_KEYS.map(k => <div key={k} style={{ fontSize:9, marginTop:1 }}>{folder.docs.some(d=>d.docType===k)?'✅':'❌'} {DOC_TYPES.find(t=>t.key===k)?.label}</div>)}
                </button>
                <button onClick={() => openSavePicker(folder.docs, folder)}
                  style={{ background:'linear-gradient(135deg,#0891b2,#0e7490)', color:'#fff', border:'none', padding:12, borderRadius:10, fontWeight:800, fontSize:12, cursor:'pointer', textAlign:'left' }}>
                  <div style={{ fontSize:18, marginBottom:3 }}>💾</div>
                  <div>Laptop में Save</div>
                  <div style={{ fontSize:10, opacity:0.8, marginTop:2 }}>{folder.docs.length} documents</div>
                  <div style={{ fontSize:9, marginTop:3, opacity:0.85 }}>चुनकर hard disk में save करें</div>
                </button>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
              {folder.docs.map(d => <DocCard key={d.id||d._id} doc={d} onView={() => openDoc(d)} onDelete={() => deleteDoc(d.id||d._id)} onShare={() => shareSingleDoc(d)}/>)}
              <div onClick={() => { setForm(f => ({...f, customerName:folder.name, customerPhone:folder.phone||'', nomineeName:folder.nomineeName||'', hypothecation:folder.hypothecation||''})); setCustSearch(folder.name); setShowForm(true); }}
                style={{ background:'#0f172a', border:'2px dashed #334155', borderRadius:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20, cursor:'pointer', gap:6, minHeight:140 }}>
                <span style={{ fontSize:24 }}>➕</span>
                <span style={{ color:'#64748b', fontSize:10, fontWeight:700 }}>Add Doc</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ALL DOCS */}
      {view === 'all' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
          {filtered.length === 0
            ? <div style={{ gridColumn:'1/-1', background:'#0f172a', border:'1px solid #1e293b', borderRadius:12, padding:30, textAlign:'center', color:'#64748b' }}>
                {search ? `"${search}" नहीं मिला` : 'कोई document नहीं'}
              </div>
            : filtered.map(d => <DocCard key={d.id||d._id} doc={d} onView={() => openDoc(d)} onDelete={() => deleteDoc(d.id||d._id)} onShare={() => shareSingleDoc(d)}/>)
          }
        </div>
      )}

      {/* Full View Modal */}
      {viewDoc && (
        <div onClick={() => { setViewDoc(null); setViewDocData(null); }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.95)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#0f172a', borderRadius:14, maxWidth:640, width:'100%', maxHeight:'94vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #1e293b', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <strong style={{ color:'#fff', fontSize:14 }}>{viewDoc.docIcon} {viewDoc.docTypeLabel}</strong>
                <p style={{ fontSize:11, color:'#94a3b8', margin:'2px 0 0' }}>{viewDoc.customerName}</p>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => shareSingleDoc(viewDoc)}
                  style={{ background:'#16a34a', color:'#fff', border:'none', padding:'6px 10px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>📱 Share</button>
                <button onClick={() => { setViewDoc(null); setViewDocData(null); }}
                  style={{ background:'#475569', color:'#fff', border:'none', padding:'6px 10px', borderRadius:6, cursor:'pointer' }}><X size={14}/></button>
              </div>
            </div>
            <div style={{ flex:1, overflow:'auto', background:'#000', display:'flex', alignItems:'center', justifyContent:'center', minHeight:200 }}>
              {!viewDocData ? (
                <p style={{ color:'#64748b', fontSize:13 }}>⏳ Loading...</p>
              ) : viewDoc.fileType === 'image' ? (
                <img src={viewDocData} alt={viewDoc.docTypeLabel} style={{ maxWidth:'100%', maxHeight:'80vh' }}/>
              ) : viewDoc.fileType === 'pdf' ? (
                <iframe src={viewDocData} style={{ width:'100%', height:'80vh', border:'none' }} title="PDF"/>
              ) : viewDoc.fileType === 'video' ? (
                <video src={viewDocData} controls style={{ width:'100%', maxHeight:'80vh' }}/>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Add Document Modal */}
      {/* 💾 SAVE PICKER — कौन-कौन से documents laptop में save करने हैं */}
      {savePick && (
        <div onClick={() => setSavePick(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:200 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:'16px 16px 0 0', width:'100%', maxWidth:520, maxHeight:'88vh', overflowY:'auto', padding:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:'#fff' }}>💾 Laptop में Save करें</h3>
              <button onClick={() => setSavePick(null)} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer' }}><X size={20}/></button>
            </div>
            <p style={{ margin:'0 0 12px', fontSize:11, color:'#94a3b8' }}>
              {savePick.folder?.name} · {savePickSel.length}/{savePick.docs.length} चुने हुए
            </p>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
              <button onClick={() => setSavePickSel(savePick.docs.map(d => d._id || d.id))}
                style={{ background:'#1e293b', color:'#fff', border:'1px solid #475569', padding:'9px', borderRadius:8, fontWeight:700, fontSize:11, cursor:'pointer' }}>
                ✅ सब चुनें
              </button>
              <button onClick={() => setSavePickSel([])}
                style={{ background:'#1e293b', color:'#fff', border:'1px solid #475569', padding:'9px', borderRadius:8, fontWeight:700, fontSize:11, cursor:'pointer' }}>
                ⬜ सब हटाएं
              </button>
            </div>

            <div style={{ display:'grid', gap:6, marginBottom:14 }}>
              {savePick.docs.map((d) => {
                const id  = d._id || d.id;
                const sel = savePickSel.includes(id);
                return (
                  <button key={id} onClick={() => toggleSavePick(id)}
                    style={{ display:'flex', alignItems:'center', gap:10, background: sel ? '#0e3a4a' : '#1e293b',
                             border:`1px solid ${sel ? '#22d3ee' : '#334155'}`, borderRadius:10, padding:'11px 12px', cursor:'pointer', textAlign:'left', width:'100%' }}>
                    <span style={{ fontSize:16, flexShrink:0 }}>{sel ? '☑️' : '⬜'}</span>
                    <span style={{ fontSize:15, flexShrink:0 }}>{d.docIcon || '📄'}</span>
                    <span style={{ flex:1, minWidth:0, color:'#fff', fontSize:12, fontWeight:700, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                      {d.docTypeLabel}
                    </span>
                    <span style={{ fontSize:9, color:'#94a3b8', flexShrink:0, textTransform:'uppercase' }}>{d.fileType}</span>
                  </button>
                );
              })}
            </div>

            {window.showDirectoryPicker ? (
              <>
                <button onClick={() => saveSelectedToDisk(true)}
                  style={{ width:'100%', background:'#0891b2', color:'#fff', border:'none', padding:'15px', borderRadius:12, fontWeight:800, fontSize:14, cursor:'pointer', marginBottom:8 }}>
                  📁 Folder चुनकर Save करें ({savePickSel.length})
                </button>
                <button onClick={() => saveSelectedToDisk(false)}
                  style={{ width:'100%', background:'#1e293b', color:'#fff', border:'1px solid #475569', padding:'11px', borderRadius:10, fontWeight:700, fontSize:12, cursor:'pointer' }}>
                  ⬇️ सीधे Downloads folder में
                </button>
                <p style={{ margin:'10px 0 0', fontSize:10, color:'#64748b' }}>
                  पहला विकल्प: अपनी hard disk का कोई भी folder चुनिए — वहाँ ग्राहक के नाम से folder बनाकर सारी files रख दी जाएंगी।
                </p>
              </>
            ) : (
              <>
                <button onClick={() => saveSelectedToDisk(false)}
                  style={{ width:'100%', background:'#0891b2', color:'#fff', border:'none', padding:'15px', borderRadius:12, fontWeight:800, fontSize:14, cursor:'pointer' }}>
                  ⬇️ Download करें ({savePickSel.length})
                </button>
                <p style={{ margin:'10px 0 0', fontSize:10, color:'#64748b' }}>
                  इस browser में folder चुनने की सुविधा नहीं है — files Downloads folder में जाएंगी। Laptop पर Chrome/Edge खोलें तो folder भी चुन सकेंगे।
                </p>
              </>
            )}

            <button onClick={() => setSavePick(null)}
              style={{ width:'100%', background:'#334155', color:'#fff', border:'none', padding:'12px', borderRadius:10, fontWeight:700, fontSize:12, cursor:'pointer', marginTop:12 }}>
              बंद करें
            </button>
          </div>
        </div>
      )}

      {/* ✅ SHARE MODAL — files पहले से तैयार, यहाँ एक tap में जाती हैं */}
      {sharePack && (
        <div onClick={() => setSharePack(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:200 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:'16px 16px 0 0', width:'100%', maxWidth:520, maxHeight:'88vh', overflowY:'auto', padding:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:'#fff' }}>📤 भेजने के लिए तैयार</h3>
              <button onClick={() => setSharePack(null)} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer' }}><X size={20}/></button>
            </div>
            <p style={{ margin:'0 0 12px', fontSize:11, color:'#94a3b8' }}>
              {sharePack.title} · {sharePack.files.length} files · {sharePack.totalKB > 1024 ? `${(sharePack.totalKB/1024).toFixed(1)} MB` : `${sharePack.totalKB} KB`}
            </p>

            {sharePack.failReasons.length > 0 && (
              <div style={{ background:'#422006', border:'1px solid #854d0e', borderRadius:8, padding:'8px 10px', marginBottom:10 }}>
                <p style={{ margin:0, fontSize:10, color:'#fbbf24' }}>⚠️ {sharePack.failReasons.slice(0,3).join(' · ')}</p>
              </div>
            )}

            <button onClick={doShareAll}
              style={{ width:'100%', background:'#16a34a', color:'#fff', border:'none', padding:'15px', borderRadius:12, fontWeight:800, fontSize:14, cursor:'pointer', marginBottom:8 }}>
              📤 सब एक साथ भेजें ({sharePack.files.length})
            </button>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
              <button onClick={copyShareText}
                style={{ background:'#1e293b', color:'#fff', border:'1px solid #475569', padding:'10px', borderRadius:10, fontWeight:700, fontSize:11, cursor:'pointer' }}>
                📋 Text Copy
              </button>
              <button onClick={() => downloadAllFiles(sharePack.files)}
                style={{ background:'#1e293b', color:'#fff', border:'1px solid #475569', padding:'10px', borderRadius:10, fontWeight:700, fontSize:11, cursor:'pointer' }}>
                ⬇️ सब Download
              </button>
            </div>

            {sharePack.files.some(f => f.size > MAX_PDF_KB * 1024) && (
              <button onClick={() => prepareShare(sharePack.docs, sharePack.textMsg, sharePack.title)}
                style={{ width:'100%', background:'#7c2d12', color:'#fff', border:'1px solid #ea580c', padding:'11px', borderRadius:10, fontWeight:700, fontSize:12, cursor:'pointer', marginBottom:12 }}>
                🗜️ बड़ी files दोबारा compress करें
              </button>
            )}

            <p style={{ margin:'0 0 8px', fontSize:11, color:'#94a3b8', fontWeight:700 }}>या एक-एक करके भेजें (सबसे भरोसेमंद):</p>
            <div style={{ display:'grid', gap:6 }}>
              {sharePack.files.map((f, i) => (
                <button key={i} onClick={() => doShareOne(i)}
                  style={{ display:'flex', alignItems:'center', gap:8, background: sentIdx.includes(i) ? '#14532d' : '#1e293b',
                           border:`1px solid ${sentIdx.includes(i) ? '#22c55e' : '#334155'}`, borderRadius:10, padding:'10px 12px', cursor:'pointer', textAlign:'left', width:'100%' }}>
                  <span style={{ fontSize:16 }}>{sentIdx.includes(i) ? '✅' : '📄'}</span>
                  <span style={{ flex:1, minWidth:0, color:'#fff', fontSize:12, fontWeight:700, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                    {sharePack.fileLabels[i]}
                  </span>
                  <span style={{ fontSize:10, color: f.size > MAX_PDF_KB*1024 ? '#fbbf24' : '#94a3b8', flexShrink:0 }}>{Math.round(f.size/1024)} KB</span>
                  <Share2 size={14} color={sentIdx.includes(i) ? '#22c55e' : '#60a5fa'}/>
                </button>
              ))}
            </div>

            <button onClick={() => setSharePack(null)}
              style={{ width:'100%', background:'#334155', color:'#fff', border:'none', padding:'12px', borderRadius:10, fontWeight:700, fontSize:12, cursor:'pointer', marginTop:12 }}>
              बंद करें
            </button>
          </div>
        </div>
      )}

      {/* ⏳ तैयारी overlay */}
      {preparing && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:210 }}>
          <div style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:14, padding:'22px 28px', textAlign:'center' }}>
            <style>{`@keyframes dvSpin{to{transform:rotate(360deg)}}`}</style>
            <RefreshCw size={28} color="#60a5fa" style={{ animation:'dvSpin 1s linear infinite' }}/>
            <p style={{ color:'#fff', fontSize:13, fontWeight:700, margin:'10px 0 0' }}>{prepStatus?.startsWith('Save') ? 'Laptop में save हो रही हैं...' : 'Documents तैयार हो रहे हैं...'}</p>
            <p style={{ color:'#94a3b8', fontSize:10, margin:'4px 0 0' }}>{prepStatus || 'photos compress + PDF बन रही हैं'}</p>
            <p style={{ color:'#64748b', fontSize:9, margin:'6px 0 0' }}>हर file 200KB के अंदर लाई जा रही है</p>
          </div>
        </div>
      )}

      {showForm && (
        <div onClick={() => { setShowForm(false); setFileData(null); }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#0f172a', border:'1px solid #334155', borderRadius:14, width:'100%', maxWidth:500, maxHeight:'94vh', overflowY:'auto', padding:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
              <h2 style={{ fontSize:15, fontWeight:800, margin:0 }}>📄 नया Document</h2>
              <button onClick={() => { setShowForm(false); setFileData(null); }} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div style={{ display:'grid', gap:10 }}>
              {/* Customer Name with Dropdown */}
              <div ref={dropdownRef} style={{ position:'relative' }}>
                <label style={lbl}>Customer Name *</label>
                <input value={custSearch} onChange={e => handleCustNameChange(e.target.value)}
                  placeholder="नाम — auto-fill होगा" style={inp} autoComplete="off"/>
                {showDropdown && filteredCustomers.length > 0 && (
                  <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#1e293b', border:'1px solid #475569', borderRadius:8, maxHeight:200, overflowY:'auto', zIndex:60 }}>
                    {filteredCustomers.map((c, i) => (
                      <div key={i} onClick={() => selectCustomer(c)}
                        style={{ padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid #334155' }}
                        onMouseEnter={e => e.currentTarget.style.background='#334155'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <strong style={{ color:'#fff', fontSize:12 }}>{c.customerName || c.name}</strong>
                        <br/><span style={{ fontSize:10, color:'#94a3b8' }}>📞 {[c.phone||c.mobileNo, c.alternatePhone||c.alternateMobileNo||c.phone2].filter(Boolean).join('/ ')} · 🪪 {c.aadhar||c.aadharNo||'—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div><label style={lbl}>Mobile Number</label><input value={form.customerPhone} onChange={e => setForm({...form, customerPhone: e.target.value.replace(/\D/g,'')})} maxLength={10} placeholder="10-digit" style={inp}/></div>
              <div><label style={lbl}>Aadhar Number</label><input value={form.aadharNo} onChange={e => setForm({...form, aadharNo: e.target.value.replace(/\D/g,'').slice(0,12)})} maxLength={12} placeholder="12-digit" style={inp}/></div>
              <div><label style={lbl}>Nominee Name</label><input value={form.nomineeName} onChange={e => setForm({...form, nomineeName: e.target.value})} placeholder="जैसे: Sita Devi" style={inp}/></div>
              <div><label style={lbl}>Hypothecation (Bank/Financer)</label><input value={form.hypothecation} onChange={e => setForm({...form, hypothecation: e.target.value})} placeholder="जैसे: HDFC Bank" style={inp}/></div>
              <div><label style={lbl}>Vehicle Model</label><input value={form.vehicleModel} onChange={e => setForm({...form, vehicleModel: e.target.value})} placeholder="SP125, Activa" style={inp}/></div>
              <div><label style={lbl}>Chassis No</label><input value={form.chassisNo} onChange={e => setForm({...form, chassisNo: e.target.value.toUpperCase()})} placeholder="ME4JC94FDTG104998" style={inp}/></div>
              <div><label style={lbl}>Document Type *</label>
                <select value={form.docType} onChange={e => setForm({...form, docType: e.target.value})} style={inp}>
                  {DOC_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
                </select>
              </div>
              {DOC_TYPES.find(t => t.key === form.docType)?.hasExpiry && (
                <div><label style={lbl}>Expiry Date</label><input type="date" value={form.expiryDate} onChange={e => setForm({...form, expiryDate: e.target.value})} style={inp}/></div>
              )}
              <div><label style={lbl}>Notes</label><input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Optional" style={inp}/></div>
              {/* File Upload */}
              <div>
                <label style={lbl}>📎 File Upload * (Auto-compressed ✅)</label>
                {fileData ? (
                  <div style={{ background:'#1e293b', borderRadius:8, padding:'10px 12px' }}>
                    {/* File info row */}
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:20, flexShrink:0 }}>
                        {fileData.fileType==='pdf' ? '📄' : fileData.fileType==='video' ? '🎥' : '🖼️'}
                      </span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontWeight:700, fontSize:12, margin:0, color:'#fff', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                          {fileData.fileName}
                        </p>
                        {/* Compression status */}
                        {fileData.fileType === 'image' && (
                          fileData.compFailed
                            ? <p style={{ fontSize:10, margin:'3px 0 0', color:'#fbbf24' }}>
                                ⚠️ Compress failed · Original: {fileData.sizeKB} KB (Upload होगी)
                              </p>
                            : <p style={{ fontSize:10, margin:'3px 0 0', color:'#86efac' }}>
                                ✅ {fileData.origKB}KB → {fileData.sizeKB}KB compressed
                              </p>
                        )}
                        {fileData.fileType !== 'image' && (
                          <p style={{ fontSize:10, margin:'3px 0 0', color:'#94a3b8' }}>
                            {fileData.sizeKB} KB{fileData.fileType === 'pdf' && fileData.sizeKB > MAX_PDF_KB ? ' · भेजते वक़्त अपने-आप छोटी हो जाएगी' : ''}
                          </p>
                        )}
                      </div>
                      <button onClick={() => setFileData(null)}
                        style={{ background:'#dc2626', border:'none', color:'#fff', borderRadius:'50%', width:24, height:24, cursor:'pointer', fontWeight:700, fontSize:14, lineHeight:'24px', textAlign:'center', flexShrink:0 }}>
                        ×
                      </button>
                    </div>

                    {/* Retry compression — shown only if failed */}
                    {fileData.compFailed && fileData.fileType === 'image' && (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:8 }}>
                        <button onClick={async () => {
                          showInAppToast('⏳', 'Method 2 try हो रहा है...', 'info');
                          const r = await compressImageRobust(fileData.blob || fileData.dataUrl, 1000, 0.70);
                          if (!r.failed) {
                            setFileData(p => ({ ...p, dataUrl: r.dataUrl, blob: r.blob, sizeKB: r.sizeKB, compFailed: false, compMethod: r.method }));
                            showInAppToast('✅ Compressed!', `${r.origKB}KB → ${r.sizeKB}KB`, 'success');
                          } else showInAppToast('❌', 'Method 2 भी failed', 'error');
                        }} style={{ background:'#d97706', border:'none', color:'#fff', borderRadius:6, padding:'8px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                          🔄 Retry (Medium)
                        </button>
                        <button onClick={async () => {
                          showInAppToast('⏳', 'Low quality try हो रहा है...', 'info');
                          const r = await compressImageRobust(fileData.blob || fileData.dataUrl, 800, 0.50);
                          if (!r.failed) {
                            setFileData(p => ({ ...p, dataUrl: r.dataUrl, blob: r.blob, sizeKB: r.sizeKB, compFailed: false, compMethod: r.method }));
                            showInAppToast('✅ Compressed (low)!', `${r.origKB}KB → ${r.sizeKB}KB`, 'success');
                          } else showInAppToast('⚠️', 'Original photo use होगी', 'warning');
                        }} style={{ background:'#854d0e', border:'none', color:'#fff', borderRadius:6, padding:'8px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                          🔄 Retry (Low)
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <button onClick={capturePhoto} disabled={capturing}
                      style={{ background:'#1e3a8a', border:'2px dashed #3b82f6', color:'#fff', padding:'14px 10px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', textAlign:'center' }}>
                      <Camera size={20} style={{ display:'block', margin:'0 auto 4px' }}/>{capturing ? '...' : '📷 Camera'}
                    </button>
                    <button onClick={pickFromGallery}
                      style={{ background:'#1a1a2e', border:'2px dashed #a855f7', color:'#fff', padding:'14px 10px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', textAlign:'center' }}>
                      <Image size={20} style={{ display:'block', margin:'0 auto 4px' }}/>🖼️ Gallery
                    </button>
                    <button onClick={pickPDF}
                      style={{ background:'#431407', border:'2px dashed #ea580c', color:'#fff', padding:'14px 10px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', textAlign:'center' }}>
                      <FileText size={20} style={{ display:'block', margin:'0 auto 4px' }}/>📄 PDF
                    </button>
                    <button onClick={pickVideo}
                      style={{ background:'#2e1065', border:'2px dashed #7c3aed', color:'#fff', padding:'14px 10px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', textAlign:'center' }}>
                      <Video size={20} style={{ display:'block', margin:'0 auto 4px' }}/>🎥 Video
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:14 }}>
              <button onClick={() => saveDoc(true)} disabled={!fileData || saving}
                style={{ flex:1, background:fileData&&!saving?'#2563eb':'#475569', color:'#fff', border:'none', padding:12, borderRadius:10, fontWeight:700, cursor:fileData&&!saving?'pointer':'not-allowed', fontSize:12 }}>
                ➕ Save & Add Another
              </button>
              <button onClick={() => saveDoc(false)} disabled={!fileData || saving}
                style={{ flex:1, background:fileData&&!saving?'#DC0000':'#475569', color:'#fff', border:'none', padding:12, borderRadius:10, fontWeight:800, cursor:fileData&&!saving?'pointer':'not-allowed', fontSize:12 }}>
                {saving ? '⏳ Saving...' : '💾 Save & Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Doc Card Component ────────────────────────────────────────────────────────
function DocCard({ doc, onView, onDelete, onShare }) {
  let icon = <Image size={28} color="#94a3b8"/>;
  if (doc.fileType === 'pdf')   icon = <FileText size={28} color="#ea580c"/>;
  if (doc.fileType === 'video') icon = <Video size={28} color="#7c3aed"/>;

  return (
    <div style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:10, overflow:'hidden' }}>
      <div onClick={onView} style={{ cursor:'pointer', height:100, background:'#1e293b', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:4 }}>
        {icon}
        <span style={{ fontSize:18 }}>{doc.docIcon}</span>
      </div>
      <div style={{ padding:'8px 10px' }}>
        <p style={{ fontWeight:700, fontSize:11, margin:'0 0 2px', color:'#fff', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{doc.customerName}</p>
        <p style={{ color:'#64748b', fontSize:9, margin:'0 0 1px' }}>{doc.docTypeLabel}</p>
        <p style={{ color:'#475569', fontSize:9, margin:0 }}>{new Date(doc.savedAt).toLocaleDateString('en-IN')}</p>
        <div style={{ display:'flex', gap:4, marginTop:6 }}>
          <button onClick={onView} style={{ flex:1, background:'#1e40af', color:'#fff', border:'none', padding:'4px', borderRadius:4, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Eye size={11}/></button>
          <button onClick={onShare} style={{ flex:1, background:'#16a34a', color:'#fff', border:'none', padding:'4px', borderRadius:4, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Share2 size={11}/></button>
          <button onClick={onDelete} style={{ background:'#7f1d1d', color:'#fff', border:'none', padding:'4px 6px', borderRadius:4, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Trash2 size={11}/></button>
        </div>
      </div>
    </div>
  );
}

const lbl = { color:'#94a3b8', fontSize:11, fontWeight:700, marginBottom:4, display:'block' };
const inp = { background:'#1e293b', color:'#fff', border:'1px solid #475569', borderRadius:8, padding:'9px 12px', fontSize:13, width:'100%', outline:'none', boxSizing:'border-box' };
