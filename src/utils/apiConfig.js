// ════════════════════════════════════════════════════════════════════════════
// src/utils/apiConfig.js — VP Honda Dealership का API helper
// ════════════════════════════════════════════════════════════════════════════
// ⚠️ यह file दोबारा बनाई गई है.
//    इस repo में गलती से **Vishesh Finance ERP** वाली apiConfig.js आ गई थी.
//    उसमें `API_BASE` नाम का export था ही नहीं और वह अलग backend से बात करती
//    थी — इसलिए AdminPanel, DocumentVault, PaymentTracker, RemindersPage जैसे
//    10+ पन्नों की सारी API calls चुपचाप बंद पड़ी थीं.
//
//    यहाँ सिर्फ़ वही 4 चीज़ें हैं जो इस app के पन्ने माँगते हैं:
//        api        → पूरा URL बनाता है
//        API_BASE   → backend का पता (AdminPanel में दिखाने के लिए)
//        apiFetch   → fetch + JSON, एक ही जगह error संभालना
//        apiPost    → apiFetch का छोटा रूप
// ════════════════════════════════════════════════════════════════════════════

// backend का पता — Vercel/env से आए तो वही, वरना Render वाला
const RAW_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  'https://vp-honda-backend.onrender.com';

/** आख़िर का '/' और '/api' हटाकर साफ़ base — ताकि '/api/api/...' कभी न बने */
export const API_BASE = String(RAW_BASE).replace(/\/+$/, '').replace(/\/api$/, '');

/**
 * पूरा URL बनाओ.
 *   api('/api/customers')  → https://vp-honda-backend.onrender.com/api/customers
 *   api('customers')       → https://vp-honda-backend.onrender.com/api/customers
 *   api('https://…')       → जैसा है वैसा
 */
export function api(path = '') {
  const p = String(path || '');
  if (!p) return API_BASE;
  if (/^https?:\/\//i.test(p)) return p;
  const clean = p.startsWith('/') ? p : `/${p}`;
  return API_BASE + (clean.startsWith('/api/') || clean === '/api' ? clean : `/api${clean}`);
}

/**
 * fetch + JSON — जवाब सीधे लौटता है (array हो या object).
 * गड़बड़ी पर Error फेंकता है ताकि पन्ने का catch पकड़ सके.
 *
 *   const docs = await apiFetch('/api/documents');
 *   await apiFetch('/api/documents/123', { method: 'DELETE' });
 */
export async function apiFetch(path, options = {}) {
  const url = api(path);

  const headers = { ...(options.headers || {}) };
  // body भेज रहे हैं और Content-Type नहीं दिया — तो JSON मान लो
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    // Render मुफ़्त plan पर सोता है — पहली बार 30–50 सेकंड लग सकते हैं
    throw new Error('Server से connection नहीं हुआ। Internet जाँचें — server जाग रहा हो तो थोड़ा समय लगता है।');
  }

  if (res.status === 204) return null;

  const text = await res.text().catch(() => '');
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `Request असफल (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/** छोटा रूप — apiPost('/api/documents', { … }) */
export function apiPost(path, body, options = {}) {
  return apiFetch(path, {
    ...options,
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
  });
}

export function apiPut(path, body, options = {}) {
  return apiFetch(path, { ...options, method: 'PUT', body: JSON.stringify(body ?? {}) });
}

export function apiPatch(path, body, options = {}) {
  return apiFetch(path, { ...options, method: 'PATCH', body: JSON.stringify(body ?? {}) });
}

export function apiDelete(path, options = {}) {
  return apiFetch(path, { ...options, method: 'DELETE' });
}

export default apiFetch;
