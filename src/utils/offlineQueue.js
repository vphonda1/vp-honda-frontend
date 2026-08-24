// ════════════════════════════════════════════════════════════════════════════
// offlineQueue.js — internet न होने पर भी काम रुके नहीं
// ════════════════════════════════════════════════════════════════════════════
// दिक़्क़त जो यह हल करता है:
//
// Service worker में साफ़ लिखा था — `if (request.method !== 'GET') return`.
// यानी offline में सिर्फ़ पढ़ा जा सकता था. Job card भरते वक़्त network गया तो
// पूरा form चला जाता था, और कोई ठीक-ठीक बताता भी नहीं था कि क्यों.
// Showroom में मोबाइल data पर यह रोज़ होता है.
//
// अब हर POST/PUT/PATCH/DELETE पहले IndexedDB में सुरक्षित जाता है. Network
// हो तो तुरंत भेजा जाता है; न हो तो कतार में रुका रहता है और internet आते ही
// अपने आप चला जाता है — app बंद हो तब भी (Background Sync से).
//
// इस्तेमाल — सिर्फ़ `fetch` की जगह `apiWrite` लिखें:
//   await apiWrite(api('/api/visitors'), 'POST', formData);
// ════════════════════════════════════════════════════════════════════════════

const DB_NAME = 'vp-honda-offline';
const STORE   = 'writeQueue';
const DB_VER  = 1;

let dbPromise = null;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const st = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        st.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
  return dbPromise;
}

const tx = async (mode, fn) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let out;
    try { out = fn(store); } catch (e) { reject(e); return; }
    t.oncomplete = () => resolve(out?.result !== undefined ? out.result : out);
    t.onerror    = () => reject(t.error);
  });
};

const enqueue = (item) => tx('readwrite', s => s.add(item));
const allItems = () => tx('readonly', s => s.getAll());
const removeItem = (id) => tx('readwrite', s => s.delete(id));
const updateItem = (item) => tx('readwrite', s => s.put(item));

/** कतार में कितने काम बाक़ी हैं */
export async function pendingCount() {
  try { return (await allItems())?.length || 0; } catch { return 0; }
}

const notify = async () => {
  try {
    window.dispatchEvent(new CustomEvent('vp-queue-change', {
      detail: { pending: await pendingCount() },
    }));
  } catch {}
};

/**
 * हर लिखने वाला API call इसी से जाए.
 * Network हो → तुरंत भेजता है.
 * Network न हो → IndexedDB में रखकर `{ queued:true }` लौटाता है,
 *                और internet आते ही अपने आप भेज देता है.
 */
export async function apiWrite(url, method = 'POST', body = null, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const payload = body === null ? undefined : JSON.stringify(body);

  if (navigator.onLine) {
    try {
      const res = await fetch(url, { method, headers, body: payload });
      if (res.ok) return { ok: true, queued: false, data: await res.json().catch(() => null) };
      // 4xx = हमारी गलती, दोबारा भेजने से भी नहीं सुधरेगी — कतार में मत डालो
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, queued: false, status: res.status,
                 error: (await res.json().catch(() => ({}))).error || `HTTP ${res.status}` };
      }
    } catch { /* network बीच में गया — नीचे कतार में डालेंगे */ }
  }

  await enqueue({ url, method, headers, body: payload, createdAt: Date.now(), tries: 0 });
  await notify();
  await requestSync();
  return { ok: true, queued: true, data: null };
}

/** Background Sync माँगो — app बंद होने पर भी browser इसे चला देगा */
async function requestSync() {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg && 'sync' in reg) { await reg.sync.register('vp-write-queue'); return true; }
  } catch {}
  return false;
}

/** कतार खाली करो — internet आने पर, app खुलने पर, या हाथ से */
export async function flushQueue() {
  if (!navigator.onLine) return { sent: 0, left: await pendingCount() };
  let items = [];
  try { items = (await allItems()) || []; } catch { return { sent: 0, left: 0 }; }

  let sent = 0;
  for (const it of items.sort((a, b) => a.createdAt - b.createdAt)) {
    try {
      const res = await fetch(it.url, { method: it.method, headers: it.headers, body: it.body });
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        // ठीक गया, या ऐसी गलती जो दोबारा भेजने से नहीं सुधरेगी — हटा दो
        await removeItem(it.id); sent++;
      } else {
        it.tries = (it.tries || 0) + 1;
        // 8 बार कोशिश के बाद छोड़ दो, वरना कतार कभी खाली नहीं होगी
        if (it.tries > 8) await removeItem(it.id); else await updateItem(it);
      }
    } catch {
      break;   // network फिर चला गया — बाक़ी अगली बार
    }
  }
  await notify();
  return { sent, left: await pendingCount() };
}

/** app शुरू होते ही एक बार चलाएँ */
export function initOfflineQueue() {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => { flushQueue(); });
  // हर 2 मिनट में एक कोशिश (Background Sync जहाँ नहीं है, वहाँ के लिए)
  setInterval(() => { if (navigator.onLine) flushQueue(); }, 120000);
  if (navigator.onLine) setTimeout(flushQueue, 3000);
  notify();
}
