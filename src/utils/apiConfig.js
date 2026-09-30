// ═══════════════════════════════════════════════════════════════
// src/utils/apiConfig.js  —  API Helper v3 (Phase 1 + Phase 8 सुधार)
// ───────────────────────────────────────────────────────────────
// नया:  auto token refresh, device ID, re-auth token,
//       proper error objects, request de-duplication
// पुराना:  apiFetch / api / default export वैसे ही काम करते हैं
// ═══════════════════════════════════════════════════════════════

const BASE_URL = import.meta.env.VITE_API_URL || 'https://vphonda-backend.onrender.com/api'

// ── localStorage keys (पुराने वाले ही रखे हैं) ─────────────────
const TOKEN_KEY   = 'vpHondaToken'
const REFRESH_KEY = 'vpHondaRefreshToken'
const USER_KEY    = 'vpHondaUser'
const DEVICE_KEY  = 'vpHondaDeviceId'
const REAUTH_KEY  = 'vpHondaReAuthToken'

// ═══════════════════════════════════════════════════════════════
// DEVICE ID — हर device की अलग पहचान (My Devices के लिए)
// ═══════════════════════════════════════════════════════════════
export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = 'dev-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36)
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

export function getDeviceName() {
  const ua = navigator.userAgent
  let os = 'Unknown'
  if (/Android/i.test(ua)) os = 'Android'
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS'
  else if (/Windows/i.test(ua)) os = 'Windows'
  else if (/Mac OS/i.test(ua)) os = 'Mac'
  else if (/Linux/i.test(ua)) os = 'Linux'

  let browser = 'Browser'
  if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome'
  else if (/Firefox/i.test(ua)) browser = 'Firefox'
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari'

  return `${os} · ${browser}`
}

// ═══════════════════════════════════════════════════════════════
// SESSION STORAGE HELPERS
// ═══════════════════════════════════════════════════════════════
export const session = {
  getToken:        () => localStorage.getItem(TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
  getUser: () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') }
    catch { return null }
  },
  save({ token, accessToken, refreshToken, user }) {
    const t = accessToken || token
    if (t) localStorage.setItem(TOKEN_KEY, t)
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
    sessionStorage.removeItem(REAUTH_KEY)
  }
}

// ── Re-auth token (5 मिनट, sessionStorage में) ────────────────
export const reAuth = {
  set: (t) => sessionStorage.setItem(REAUTH_KEY, JSON.stringify({ token: t, at: Date.now() })),
  get() {
    try {
      const d = JSON.parse(sessionStorage.getItem(REAUTH_KEY) || 'null')
      if (!d) return null
      if (Date.now() - d.at > 4.5 * 60 * 1000) { sessionStorage.removeItem(REAUTH_KEY); return null }
      return d.token
    } catch { return null }
  },
  clear: () => sessionStorage.removeItem(REAUTH_KEY)
}

// ═══════════════════════════════════════════════════════════════
// ERROR OBJECT
// ═══════════════════════════════════════════════════════════════
export class ApiError extends Error {
  constructor(message, { status, code, details, requestId, reAuthRequired, response } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
    this.reAuthRequired = !!reAuthRequired
    this.response = response
  }
}

// ═══════════════════════════════════════════════════════════════
// TOKEN REFRESH — एक साथ कई requests आएं तो सिर्फ एक बार refresh
// ═══════════════════════════════════════════════════════════════
let refreshPromise = null

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise

  const refreshToken = session.getRefreshToken()
  if (!refreshToken) return null

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      })
      if (!res.ok) return null
      const data = await res.json()
      if (data?.success && (data.accessToken || data.token)) {
        session.save(data)
        return data.accessToken || data.token
      }
      return null
    } catch {
      return null
    } finally {
      setTimeout(() => { refreshPromise = null }, 100)
    }
  })()

  return refreshPromise
}

function forceLogout() {
  session.clear()
  const path = window.location.pathname
  const isPublic = path.includes('/login') || path.includes('/customer-portal') || path.includes('/verify')
  if (!isPublic) window.location.href = '/login'
}

// ═══════════════════════════════════════════════════════════════
// Phase 18.1: धीमी request का संकेत ("सर्वर जाग रहा है" संदेश के लिए)
// कोई अतिरिक्त call नहीं — बस चल रही request 5 सेकंड से ज़्यादा ले तो बताओ
// ═══════════════════════════════════════════════════════════════
let slowWaiting = 0
function signalSlow() {
  try { window.dispatchEvent(new CustomEvent('vf:server-slow', { detail: { waiting: slowWaiting } })) } catch { /* पुराना browser */ }
}

// ═══════════════════════════════════════════════════════════════
// CORE FETCH
// ═══════════════════════════════════════════════════════════════
export const apiFetch = async (url, options = {}, _isRetry = false) => {
  const token = session.getToken()

  const fullUrl = url.startsWith('http')
    ? url
    : `${BASE_URL}${url.startsWith('/api/') ? url.replace('/api', '') : url}`

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'X-Device-Id': getDeviceId(),
    'X-Device-Name': getDeviceName(),
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {})
  }

  // sensitive action के लिए re-auth token अपने आप जोड़ो
  const rt = reAuth.get()
  if (rt && !headers['X-ReAuth-Token']) headers['X-ReAuth-Token'] = rt

  let res
  let flaggedSlow = false
  // सिर्फ़ data लाने वाली request पर (बड़ी फ़ाइल भेजने में देर होना सामान्य है)
  const slowTimer = options.body ? null : setTimeout(() => { flaggedSlow = true; slowWaiting++; signalSlow() }, 5000)
  const clearSlow = () => {
    clearTimeout(slowTimer)
    if (flaggedSlow) { flaggedSlow = false; slowWaiting = Math.max(0, slowWaiting - 1); signalSlow() }
  }
  try {
    res = await fetch(fullUrl, { ...options, headers })
    clearSlow()
  } catch (err) {
    clearSlow()
    throw new ApiError(
      'Server से connection नहीं हो पा रहा। Internet जाँचें — Render server जाग रहा हो तो 30 सेकंड लग सकते हैं।',
      { status: 0, code: 'NETWORK_ERROR' }
    )
  }

  if (res.status === 204) return null

  let data = null
  const text = await res.text().catch(() => '')
  try { data = text ? JSON.parse(text) : null } catch { data = { error: text } }

  // ── 401: token expire → एक बार refresh करके retry ──
  if (res.status === 401 && !_isRetry) {
    const code = data?.code
    if (code === 'TOKEN_EXPIRED' || code === 'NO_TOKEN' || code === 'TOKEN_INVALID') {
      const newToken = await refreshAccessToken()
      if (newToken) return apiFetch(url, options, true)
    }
    if (code === 'REAUTH_REQUIRED' || code === 'REAUTH_INVALID' || code === 'INVALID_PASSWORD') {
      reAuth.clear()
      throw new ApiError(data?.error || 'Password confirm करें', {
        status: 401, code, reAuthRequired: true, requestId: data?.requestId, response: data
      })
    }
    forceLogout()
    throw new ApiError(data?.error || 'Session खत्म हो गया — दोबारा login करें', {
      status: 401, code, requestId: data?.requestId, response: data
    })
  }

  if (res.status === 401) { forceLogout(); throw new ApiError('Session खत्म हो गया', { status: 401 }) }

  if (!res.ok) {
    throw new ApiError(
      data?.error || data?.message || `Request असफल (${res.status})`,
      {
        status: res.status,
        code: data?.code,
        details: data?.details,
        requestId: data?.requestId,
        reAuthRequired: data?.reAuthRequired,
        response: data
      }
    )
  }

  return data
}

// ═══════════════════════════════════════════════════════════════
// शॉर्टकट methods
// ═══════════════════════════════════════════════════════════════
export const apiGet    = (url, opts = {}) => apiFetch(url, { ...opts, method: 'GET' })
export const apiPost   = (url, body, opts = {}) => apiFetch(url, { ...opts, method: 'POST', body: JSON.stringify(body) })
export const apiPatch  = (url, body, opts = {}) => apiFetch(url, { ...opts, method: 'PATCH', body: JSON.stringify(body) })
export const apiPut    = (url, body, opts = {}) => apiFetch(url, { ...opts, method: 'PUT', body: JSON.stringify(body) })
export const apiDelete = (url, opts = {}) => apiFetch(url, { ...opts, method: 'DELETE' })

// ═══════════════════════════════════════════════════════════════
// Phase 20: axios की जगह — पुराने pages के लिए adapter
// ───────────────────────────────────────────────────────────────
// कई pages सीधे axios से backend को call करते थे। उसमें दो दिक्कतें थीं:
//   • login token पुराना होने पर वे चुपचाप खाली/अटके रह जाते थे
//     (नया token अपने आप नहीं बनता था)
//   • backend का पता code में लिखा होता था — बदलने पर वे काम बंद कर देते
// अब उन pages में सिर्फ़ import की एक line बदलती है; बाकी सारा code वैसा ही
// रहता है, और सब कुछ apiFetch से होकर जाता है (token refresh, device जानकारी,
// gzip, "सर्वर जाग रहा है" संदेश — सब अपने आप)।
// ═══════════════════════════════════════════════════════════════
function toPath(url) {
  const u = String(url || '')
  if (!/^https?:/i.test(u)) return u.startsWith('/') ? u : '/' + u
  const i = u.indexOf('/api/')
  return i >= 0 ? u.slice(i + 4) : u        // https://host/api/loans → /loans
}

// axios जैसी गलती (err.response.data.message) ताकि पुराना catch वैसे ही चले
function asAxiosError(err) {
  if (err && !err.response) {
    err.response = { status: err.status, data: { message: err.message, error: err.message } }
  } else if (err && err.response && !err.response.data) {
    err.response = { status: err.status, data: err.response }
  }
  return err
}

const wrap = (fn) => async (...args) => {
  try { return { data: await fn(...args), status: 200 } }
  catch (err) { throw asAxiosError(err) }
}

export const axiosCompat = {
  get:    wrap((url) => apiGet(toPath(url))),
  post:   wrap((url, body) => apiPost(toPath(url), body)),
  put:    wrap((url, body) => apiPut(toPath(url), body)),
  patch:  wrap((url, body) => apiPatch(toPath(url), body)),
  delete: wrap((url) => apiDelete(toPath(url)))
}

// ═══════════════════════════════════════════════════════════════
// AUTH ACTIONS
// ═══════════════════════════════════════════════════════════════
export const auth = {
  async login(username, password) {
    const data = await apiPost('/auth/login', { username, password, deviceId: getDeviceId(), deviceName: getDeviceName() })
    session.save(data)
    return data
  },
  async logout() {
    try { await apiPost('/auth/logout', {}) } catch { /* चुपचाप */ }
    session.clear()
  },
  async logoutAll(keepCurrent = false) {
    const r = await apiPost('/auth/logout-all', { keepCurrent })
    if (!keepCurrent) session.clear()
    return r
  },
  me:            () => apiGet('/auth/me'),
  sessions:      () => apiGet('/auth/sessions'),
  revokeSession: (id) => apiDelete(`/auth/sessions/${id}`),
  changePassword: (currentPassword, newPassword) =>
    apiPost('/auth/change-password', { currentPassword, newPassword }),

  /** Sensitive action से पहले password confirm — token 5 मिनट valid */
  async confirmPassword(password) {
    const r = await apiPost('/auth/reauth', { password })
    if (r?.reAuthToken) reAuth.set(r.reAuthToken)
    return r
  }
}

// ═══════════════════════════════════════════════════════════════
// पुराना export (कुछ न टूटे)
// ───────────────────────────────────────────────────────────────
// ⚠️ Phase 8 सुधार:
// कुछ पुराने pages (जैसे DocumentVaultPage) इसे function की तरह
// इस्तेमाल करते हैं —  fetch(api('/api/customers'))
// और कुछ object की तरह —  api.url, api.getHeaders()
//
// पहले यह सिर्फ़ object था, इसलिए api(...) चलाते ही
// "api is not a function" आकर पूरा पेज खाली हो जाता था।
// अब यह function भी है और object भी — दोनों तरीक़े चलेंगे।
// ═══════════════════════════════════════════════════════════════
export function api(path = '') {
  if (!path) return BASE_URL
  if (path.startsWith('http')) return path
  return `${BASE_URL}${path.startsWith('/api/') ? path.replace('/api', '') : path}`
}

api.url = BASE_URL
api.getHeaders = () => {
  const token = session.getToken()
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'X-Device-Id': getDeviceId()
  }
}
/** पुराने pages के लिए: fetch(api('/api/x'), api.opts()) */
api.opts = (options = {}) => ({ ...options, headers: { ...api.getHeaders(), ...(options.headers || {}) } })

export { BASE_URL }
export default apiFetch
