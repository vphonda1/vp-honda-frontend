// ═══════════════════════════════════════════════════════════════
// VP Honda — API Configuration (Central)
// Deploy करते समय .env में VITE_API_URL set करो
// ═══════════════════════════════════════════════════════════════
// ⚠️ Fallback अब Render backend है (पहले localhost:5000 था — Vercel पर VITE_API_URL
// set न होने पर पूरा app dead हो जाता था). Local dev के लिए .env में VITE_API_URL डालें.
export const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : 'https://vp-honda-backend.onrender.com');
export const api = (path) => `${API_BASE}${path}`;

// Helper: fetch with error handling
export const apiFetch = async (path, options = {}) => {
  try {
    const res = await fetch(api(path), {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`API fetch failed: ${path}`, err);
    throw err;
  }
};
