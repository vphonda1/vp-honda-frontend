// ════════════════════════════════════════════════════════════════════════════
// trackingStore.js — Visitors / Pickup-Drop / Appointments का साझा भंडार
// ════════════════════════════════════════════════════════════════════════════
// पहले इन तीनों का पूरा डेटा सिर्फ़ browser के localStorage में था:
//     vp_visitors · vp_pickup_drops · vp_appointments
// Cache साफ़ होते ही, phone बदलते ही, या Chrome में "Clear & reset" दबाते ही
// सब ख़त्म — और दूसरे phone पर तो दिखता ही नहीं था.
//
// अब:
//   • लिखना  → offline queue से होकर MongoDB में (internet न हो तो रुककर बाद में)
//   • पढ़ना   → पहले server, न मिले तो localStorage (जो हमेशा भरा रहता है)
//   • पुराना डेटा → पहली बार में अपने आप server पर चढ़ जाता है (migrate)
// ════════════════════════════════════════════════════════════════════════════

import { api } from './apiConfig';
import { apiWrite } from './offlineQueue';

const CFG = {
  visitors:     { path:'/api/visitors',      ls:'vp_visitors',      sort:'visitTime' },
  pickupDrops:  { path:'/api/pickup-drops',  ls:'vp_pickup_drops',  sort:'scheduled' },
  appointments: { path:'/api/appointments',  ls:'vp_appointments',  sort:'date' },
};

const readLS = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]') || []; } catch { return []; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v.slice(0, 1000))); } catch {} };

/** server से लाओ; न मिले तो phone वाली copy दे दो — screen कभी खाली न दिखे */
export async function loadAll(kind) {
  const c = CFG[kind];
  if (!c) throw new Error('अनजान kind: ' + kind);
  try {
    const res = await fetch(api(c.path));
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows)) {
        const norm = rows.map(r => ({ ...r, id: r.localId || r._id }));
        writeLS(c.ls, norm);      // offline के लिए copy रखो
        return norm;
      }
    }
  } catch { /* offline — नीचे local से */ }
  return readLS(c.ls);
}

/** नया record — offline में भी नहीं खोता */
export async function saveOne(kind, data) {
  const c = CFG[kind];
  const localId = data.localId || data.id || `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const row = { ...data, localId, id: localId };

  // पहले phone में — UI तुरंत दिखे, चाहे network हो या न हो
  const cur = readLS(c.ls);
  const at = cur.findIndex(x => (x.localId || x.id) === localId);
  if (at >= 0) cur[at] = { ...cur[at], ...row }; else cur.unshift(row);
  writeLS(c.ls, cur);

  const out = await apiWrite(api(c.path), 'POST', row);
  return { ...row, queued: out.queued, saved: out.ok };
}

/** किसी record को बदलो */
export async function updateOne(kind, id, patch) {
  const c = CFG[kind];
  const cur = readLS(c.ls);
  const at = cur.findIndex(x => (x.localId || x.id || x._id) === id);
  if (at >= 0) { cur[at] = { ...cur[at], ...patch }; writeLS(c.ls, cur); }
  const out = await apiWrite(api(`${c.path}/${encodeURIComponent(id)}`), 'PUT', { ...patch, localId: id });
  return { queued: out.queued, saved: out.ok };
}

/** मिटाओ */
export async function deleteOne(kind, id) {
  const c = CFG[kind];
  writeLS(c.ls, readLS(c.ls).filter(x => (x.localId || x.id || x._id) !== id));
  const out = await apiWrite(api(`${c.path}/${encodeURIComponent(id)}`), 'DELETE', null);
  return { queued: out.queued, saved: out.ok };
}

/**
 * ⭐ पहली बार: phone में पड़ा पुराना डेटा server पर चढ़ाओ.
 * एक बार हो जाने पर दोबारा नहीं चलता (एक निशान localStorage में रख देते हैं).
 * Server पर पहले से मौजूद records अपने आप छोड़ दिए जाते हैं (localId से पहचान).
 */
export async function migrateOnce(kind) {
  const c = CFG[kind];
  const flag = `vp_migrated_${kind}`;
  try { if (localStorage.getItem(flag)) return null; } catch { return null; }

  const rows = readLS(c.ls);
  if (!rows.length) { try { localStorage.setItem(flag, '1'); } catch {} return null; }

  try {
    const res = await fetch(api(`${c.path}/migrate`), {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(rows),
    });
    if (!res.ok) return null;              // backend सोया है — अगली बार कोशिश
    const out = await res.json();
    try { localStorage.setItem(flag, '1'); } catch {}
    return out;                            // { added, skipped, total }
  } catch { return null; }
}

/** तीनों का पुराना डेटा एक साथ चढ़ाओ — app खुलते ही एक बार */
export async function migrateAllOnce() {
  const results = {};
  for (const kind of Object.keys(CFG)) {
    const r = await migrateOnce(kind);
    if (r?.added) results[kind] = r;
  }
  return results;
}
