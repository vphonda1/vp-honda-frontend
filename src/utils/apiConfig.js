// ════════════════════════════════════════════════════════════════════════════
// src/utils/apiConfig.js — VP Honda Dealership app का API पता (एक ही जगह)
// ════════════════════════════════════════════════════════════════════════════
// ⚠️ यह file पहले गलती से **Vishesh Finance ERP** वाली आ गई थी. वह दूसरे
// backend (vphonda-backend.onrender.com — Finance) से बात करती थी, उसमें
// `API_BASE` export था ही नहीं, और 401 आते ही सीधे /login पर फेंक देती थी.
// इसी वजह से Reminders, Documents, Payments, Admin समेत लगभग हर पन्ने की
// API call गलत server पर जा रही थी और notification/reminder का पूरा काम
// रुक गया था.
//
// अब यह फिर से VP Honda backend (vp-honda-backend.onrender.com) से बात करती है.
// पन्नों में कुछ नहीं बदला — वे पहले की तरह ही इस्तेमाल करते हैं:
//
//   fetch(api('/api/customers'))              → URL string
//   const docs = await apiFetch('/api/documents')   → JSON (गड़बड़ी पर Error)
//   await apiPost('/api/documents', {...})
//   API_BASE                                  → backend का पता (AdminPanel में दिखता है)
// ════════════════════════════════════════════════════════════════════════════

const DEFAULT_BACKEND = 'https://vp-honda-backend.onrender.com';

/** backend का साफ़ पता — आख़िर का "/" और गलती से लिखा "/api" हटा कर */
function cleanBase(raw) {
  let b = String(raw || '').trim();
  if (!b) return '';
  b = b.replace(/\/+$/, '');          // आख़िरी slash हटाओ
  b = b.replace(/\/api$/i, '');       // ".../api" लिखा हो तो हटाओ (हम खुद जोड़ते हैं)
  return b;
}

export const API_BASE =
  cleanBase(import.meta.env.VITE_API_URL) ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : DEFAULT_BACKEND);

/**
 * पूरा URL बनाओ.
 *   api('/api/customers')  → https://vp-honda-backend.onrender.com/api/customers
 *   api('customers')       → https://vp-honda-backend.onrender.com/api/customers
 *   api('https://…')       → जैसा है वैसा
 *   api()                  → सिर्फ़ backend का पता
 */
export function api(path = '') {
  const p = String(path || '');
  if (!p) return API_BASE;
  if (/^https?:\/\//i.test(p)) return p;
  const clean = p.startsWith('/') ? p : `/${p}`;
  return API_BASE + (clean.startsWith('/api/') || clean === '/api' ? clean : `/api${clean}`);
}

// पुराने कुछ pages object की तरह भी इस्तेमाल करते थे — वह भी चलता रहे
api.url = API_BASE;
api.getHeaders = () => ({ 'Content-Type': 'application/json' });
api.opts = (options = {}) => ({ ...options, headers: { ...api.getHeaders(), ...(options.headers || {}) } });

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

/** छोटे रूप — apiPost('/api/documents', { … }) */
export function apiGet(path, options = {}) {
  return apiFetch(path, { ...options, method: 'GET' });
}

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

// पुराने import के लिए — `import { BASE_URL } …` भी चले
export const BASE_URL = API_BASE;

export default apiFetch;
