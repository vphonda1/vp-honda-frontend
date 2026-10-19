// ═══════════════════════════════════════════════════════════════
// src/pages/VideoKycPage.jsx  —  ग्राहक का Video KYC पेज (Phase 17.1)
// ───────────────────────────────────────────────────────────────
// रास्ता: /vkyc/:token   (बिना login — WhatsApp/SMS से भेजा link)
//
// • कोई app install नहीं — मोबाइल browser में ही
// • एक ही recording screen: ऊपर कैमरा, नीचे पूरा कथन लगातार
// • वीडियो + आवाज़ एक साथ, एक ही file में (sync नहीं बिगड़ता)
// • Start / Stop / दोबारा रिकॉर्ड / भेजें
// • record होते समय ही छोटा (480p, ~350kbps) → सीधे मोबाइल से Cloudinary
//   (6MB टुकड़ों में) → Cloudinary save से पहले दोबारा compress करता है
// • ग्राहक के बाद एक या अधिक गवाह — वही तरीका
// • अंत में "जमा करें" → lock, फिर कोई बदलाव नहीं
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { apiGet, apiPost, apiDelete } from '../utils/apiConfig'
import {
  recorderSupported, pickMimeType, recorderOptions, extFromMime, MEDIA_CONSTRAINTS,
  cameraErrorText, createUploadJob, fmtBytes, fmtDuration,
  buildCustomerStatement, buildWitnessStatement, statementFacts
} from '../utils/videoKycRecorder'
import './VideoKycPage.css'

// ═══════════════════════════════════════════════════════════════
// Recorder — एक ही screen: ऊपर कैमरा, नीचे कथन
// ═══════════════════════════════════════════════════════════════
function Recorder({ token, target, statement, limits, onClose, onDone }) {
  const liveRef = useRef(null)
  const streamRef = useRef(null)
  const recRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const startedAtRef = useRef(0)
  const recordedAtRef = useRef(null)
  const jobRef = useRef(null)
  const sigRef = useRef(null)
  const wakeRef = useRef(null)
  const interruptedRef = useRef(false)
  const facingRef = useRef('user')      // 'user' = सामने वाला, 'environment' = पीछे वाला कैमरा

  const [facing, setFacing] = useState('user')
  const [phase, setPhase] = useState('starting') // starting | ready | recording | review | uploading | error
  const [err, setErr] = useState('')
  const [secs, setSecs] = useState(0)
  const [blob, setBlob] = useState(null)
  const [blobUrl, setBlobUrl] = useState('')
  const [duration, setDuration] = useState(0)
  const [pct, setPct] = useState(0)
  const [uploadErr, setUploadErr] = useState('')
  const [note, setNote] = useState('')

  const mime = useMemo(() => pickMimeType(), [])
  const minS = limits?.minSeconds || 8
  const maxS = limits?.maxSeconds || 120
  const isWitness = target.role === 'witness'
  const text = isWitness ? buildWitnessStatement(statement, target) : buildCustomerStatement(statement)
  const facts = statementFacts(statement)

  // ── कैमरा ──────────────────────────────────────────────────
  const stopTracks = () => {
    streamRef.current?.getTracks().forEach(t => { try { t.stop() } catch { /* */ } })
    streamRef.current = null
  }

  const releaseWake = () => { try { wakeRef.current?.release() } catch { /* */ } wakeRef.current = null }

  const startCamera = useCallback(async () => {
    setPhase('starting'); setErr('')
    stopTracks()
    let stream = null
    // ⭐ सामने/पीछे का कैमरा चुनने का विकल्प (ऊपर 🔄 बटन) — 'ideal' ताकि जिस फ़ोन में एक ही कैमरा हो वह भी चले
    const wantFacing = facingRef.current
    const constraints = { ...MEDIA_CONSTRAINTS, video: { ...MEDIA_CONSTRAINTS.video, facingMode: { ideal: wantFacing } } }
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints)
    } catch (e1) {
      if (e1?.name === 'NotAllowedError' || e1?.name === 'SecurityError') {
        setErr(cameraErrorText(e1)); setPhase('error'); return
      }
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: wantFacing }, audio: true }) }
      catch (e2) { setErr(cameraErrorText(e2)); setPhase('error'); return }
    }
    if (!stream.getAudioTracks().length) {
      stream.getTracks().forEach(t => t.stop())
      setErr('माइक नहीं मिला — आवाज़ के बिना वीडियो मान्य नहीं होगा।'); setPhase('error'); return
    }
    streamRef.current = stream
    stream.getTracks().forEach(t => {
      t.onended = () => {
        if (recRef.current && recRef.current.state === 'recording') {
          interruptedRef.current = true
          try { recRef.current.stop() } catch { /* */ }
        }
      }
    })
    if (liveRef.current) {
      liveRef.current.srcObject = stream
      liveRef.current.muted = true
      liveRef.current.play().catch(() => {})
    }
    setPhase('ready')
  }, [])

  useEffect(() => {
    startCamera()
    return () => {
      clearInterval(timerRef.current)
      try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop() } catch { /* */ }
      stopTracks()
      releaseWake()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }, [blobUrl])

  // app बदलने/स्क्रीन बंद होने पर recording रोक दो
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && recRef.current?.state === 'recording') {
        interruptedRef.current = true
        stopRecording()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 🔄 कैमरा पलटें (सिर्फ़ रिकॉर्डिंग शुरू होने से पहले)
  const flipCamera = async () => {
    if (phase !== 'ready' && phase !== 'error') return
    const next = facingRef.current === 'user' ? 'environment' : 'user'
    facingRef.current = next
    setFacing(next)
    await startCamera()
  }

  // ── Recording ───────────────────────────────────────────────
  const finish = () => {
    clearInterval(timerRef.current)
    releaseWake()
    const d = (Date.now() - startedAtRef.current) / 1000
    const type = recRef.current?.mimeType || mime || 'video/webm'
    const b = new Blob(chunksRef.current, { type: type.split(';')[0] })
    chunksRef.current = []
    if (b.size < 2000) {
      setErr('वीडियो record नहीं हुआ — दोबारा कोशिश करें।'); setPhase('ready'); return
    }
    setBlob(b)
    setBlobUrl(URL.createObjectURL(b))
    setDuration(d)
    setNote(interruptedRef.current
      ? 'रिकॉर्डिंग बीच में रुक गई (स्क्रीन बंद हुई या app बदला)। पूरा वीडियो देख लें — अधूरा हो तो दोबारा रिकॉर्ड करें।'
      : d < minS ? `वीडियो बहुत छोटा है — कम से कम ${minS} सेकंड बोलें।` : '')
    setPhase('review')
  }

  const startRecording = async () => {
    const s = streamRef.current
    if (!s || s.getTracks().some(t => t.readyState !== 'live')) { await startCamera(); return }
    setErr(''); setNote(''); interruptedRef.current = false
    chunksRef.current = []
    let rec
    try { rec = new MediaRecorder(s, recorderOptions(mime)) }
    catch { try { rec = new MediaRecorder(s) } catch (e) { setErr('इस browser में recording नहीं हो सकती: ' + e.message); return } }
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data) }
    rec.onstop = finish
    rec.onerror = (e) => { setErr('Recording में गड़बड़ी: ' + (e?.error?.message || '')); }
    recRef.current = rec
    rec.start(1000)                       // हर सेकंड का टुकड़ा — बीच में कुछ हो तो भी बचा रहे
    startedAtRef.current = Date.now()
    recordedAtRef.current = new Date().toISOString()
    setSecs(0)
    setPhase('recording')
    timerRef.current = setInterval(() => {
      const el = (Date.now() - startedAtRef.current) / 1000
      setSecs(el)
      if (el >= maxS) stopRecording()
    }, 250)
    try { wakeRef.current = await navigator.wakeLock?.request('screen') } catch { /* वैकल्पिक */ }
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop() } catch { /* */ }
  }

  const retake = async () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl)
    setBlob(null); setBlobUrl(''); setDuration(0); setPct(0); setUploadErr(''); setNote('')
    jobRef.current = null; sigRef.current = null
    const s = streamRef.current
    if (!s || s.getTracks().some(t => t.readyState !== 'live')) await startCamera()
    else {
      if (liveRef.current && liveRef.current.srcObject !== s) liveRef.current.srcObject = s
      liveRef.current?.play().catch(() => {})
      setPhase('ready')
    }
  }

  // ── Upload ──────────────────────────────────────────────────
  const upload = async () => {
    if (!blob) return
    if (duration < minS) { setNote(`वीडियो बहुत छोटा है — कम से कम ${minS} सेकंड बोलें।`); return }
    setPhase('uploading'); setUploadErr('')
    try {
      if (!jobRef.current) {
        const r = await apiPost(`/video-kyc/public/${token}/upload-signature`, {
          role: target.role, witnessId: target.witnessId || ''
        })
        if (blob.size > (r.upload.maxBytes || Infinity)) throw new Error('वीडियो बहुत बड़ा है — थोड़ा छोटा record करें')
        sigRef.current = r.upload
        jobRef.current = createUploadJob(blob, r.upload, `${target.role}.${extFromMime(blob.type)}`)
      }
      const result = await jobRef.current.run(setPct)
      const saved = await apiPost(`/video-kyc/public/${token}/recording`, {
        role: target.role,
        witnessId: target.witnessId || '',
        publicId: sigRef.current.publicId,
        bytes: result?.bytes || blob.size,
        duration: typeof result?.duration === 'number' ? result.duration : duration,
        format: result?.format || extFromMime(blob.type),
        width: result?.width || 0,
        height: result?.height || 0,
        mimeType: blob.type,
        statementText: text,
        recordedAt: recordedAtRef.current
      })
      stopTracks()
      onDone(saved.session)
    } catch (e) {
      // signature पुराना हो गया / upload पहचाना नहीं गया → अगली बार नए सिरे से
      if (e.permanent || /stale|expired|पहचाना/i.test(e.message || '')) { jobRef.current = null; sigRef.current = null }
      setUploadErr(e.message || 'Upload नहीं हो पाया')
    }
  }

  const tooShort = phase === 'recording' && secs < minS
  const who = isWitness ? `गवाह: ${target.name}` : `ग्राहक: ${statement.customerName || ''}`

  return (
    <div className="vk-rec">
      <div className="vk-rec-bar">
        <button className="vk-icon-btn" onClick={() => { if (phase === 'recording') return; stopTracks(); onClose() }}
          disabled={phase === 'recording' || phase === 'uploading'} aria-label="बंद करें">✕</button>
        <span className="vk-rec-who">{who}</span>
        {phase === 'recording'
          ? <span className="vk-rec-time"><i className="vk-dot" />{fmtDuration(secs)} / {fmtDuration(maxS)}</span>
          : <span className="vk-rec-time vk-muted">अधिकतम {fmtDuration(maxS)}</span>}
      </div>

      <div className="vk-cam">
        <video ref={liveRef} className={`vk-live ${phase === 'review' || phase === 'uploading' ? 'vk-hide' : ''}`}
          style={{ transform: facing === 'user' ? 'scaleX(-1)' : 'none' }}
          playsInline muted autoPlay />
        {(phase === 'ready' || phase === 'error') && (
          <button type="button" onClick={flipCamera} aria-label="कैमरा पलटें"
            style={{
              position: 'absolute', top: 10, right: 10, zIndex: 6, border: 'none', cursor: 'pointer',
              background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: 999, padding: '8px 12px',
              fontSize: 13, fontWeight: 600
            }}>
            🔄 {facing === 'user' ? 'पीछे का कैमरा' : 'सामने का कैमरा'}
          </button>
        )}
        {blobUrl && (phase === 'review' || phase === 'uploading') && (
          <video key={blobUrl} className="vk-review" src={blobUrl} controls playsInline />
        )}

        {(phase === 'ready' || phase === 'recording') && <div className="vk-face-guide" aria-hidden="true" />}
        {phase === 'starting' && <div className="vk-cam-msg">कैमरा चालू हो रहा है…</div>}
        {phase === 'error' && (
          <div className="vk-cam-msg vk-cam-err">
            <p>{err}</p>
            <button className="vk-btn vk-btn-light" onClick={startCamera}>दोबारा कोशिश करें</button>
          </div>
        )}

        <div className="vk-cam-controls">
          {phase === 'ready' && (
            <button className="vk-shutter" onClick={startRecording} aria-label="रिकॉर्डिंग शुरू करें">
              <span className="vk-shutter-in" />
            </button>
          )}
          {phase === 'recording' && (
            <button className="vk-shutter vk-shutter-on" onClick={stopRecording} disabled={tooShort}
              aria-label="रिकॉर्डिंग रोकें">
              <span className="vk-shutter-stop" />
            </button>
          )}
        </div>
      </div>

      {/* ── नियंत्रण पट्टी ── */}
      <div className="vk-rec-actions">
        {phase === 'ready' && <p className="vk-hint">लाल बटन दबाकर बोलना शुरू करें। चेहरा घेरे के अंदर और रोशनी सामने रखें।</p>}
        {phase === 'recording' && (
          <p className="vk-hint">{tooShort ? `बोलते रहें… ${Math.ceil(minS - secs)} सेकंड बाद रोक सकेंगे` : 'बात पूरी होने पर बटन दबाकर रोकें'}</p>
        )}
        {err && phase !== 'error' && <p className="vk-alert">{err}</p>}

        {phase === 'review' && (
          <>
            {note && <p className="vk-alert">{note}</p>}
            <p className="vk-meta">वीडियो: {fmtDuration(duration)} · {fmtBytes(blob?.size)}</p>
            <div className="vk-row">
              <button className="vk-btn vk-btn-ghost" onClick={retake}>दोबारा रिकॉर्ड करें</button>
              <button className="vk-btn vk-btn-primary" onClick={upload} disabled={duration < minS}>यह वीडियो भेजें</button>
            </div>
          </>
        )}

        {phase === 'uploading' && (
          <>
            <div className="vk-progress"><div style={{ width: `${pct}%` }} /></div>
            {!uploadErr && (
              <p className="vk-meta">
                {pct >= 99 ? 'वीडियो छोटा (compress) करके सुरक्षित रखा जा रहा है… कुछ सेकंड' : `भेजा जा रहा है… ${pct}%`} — पेज बंद न करें
              </p>
            )}
            {uploadErr && (
              <>
                <p className="vk-alert">{uploadErr}</p>
                <div className="vk-row">
                  <button className="vk-btn vk-btn-ghost" onClick={retake}>दोबारा रिकॉर्ड करें</button>
                  <button className="vk-btn vk-btn-primary" onClick={upload}>फिर से भेजें</button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── पूरा कथन — recording के दौरान भी लगातार दिखता है ── */}
      <div className="vk-script">
        <p className="vk-script-hint">नीचे लिखी बातें देखकर <strong>अपने शब्दों में</strong> बोलें — शब्द-शब्द पढ़ना ज़रूरी नहीं।</p>
        <dl className="vk-facts">
          {facts.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        <p className="vk-script-text">“{text}”</p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// मुख्य पेज
// ═══════════════════════════════════════════════════════════════
export default function VideoKycPage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [fatal, setFatal] = useState(null)
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [wForm, setWForm] = useState({ name: '', mobile: '', relation: '' })
  const [showWForm, setShowWForm] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await apiGet(`/video-kyc/public/${token}`)
      setSession(r.session)
      if (r.storageReady === false) setMsg({ ok: false, text: 'वीडियो storage अभी चालू नहीं है — शोरूम को बताएँ।' })
    } catch (e) {
      setFatal({ code: e.code || e.response?.code, text: e.message })
    }
    setLoading(false)
  }, [token])

  useEffect(() => { load() }, [load])

  const call = async (fn, okText) => {
    setBusy(true); setMsg(null)
    try {
      const r = await fn()
      if (r?.session) setSession(r.session)
      if (okText) setMsg({ ok: true, text: okText })
      return r
    } catch (e) {
      if (e.status === 410) setFatal({ code: e.code, text: e.message })
      else if (e.code === 'VKYC_LOCKED') load()          // किसी और device से जमा हो चुकी
      else setMsg({ ok: false, text: e.message })
      return null
    } finally { setBusy(false) }
  }

  const addWitness = async (payload) => {
    const r = await call(() => apiPost(`/video-kyc/public/${token}/witness`, payload), 'गवाह जुड़ गया — अब उनका वीडियो रिकॉर्ड करें')
    if (r) { setWForm({ name: '', mobile: '', relation: '' }); setShowWForm(false) }
  }

  const removeWitness = (w) => {
    if (!window.confirm(`${w.name} को गवाह सूची से हटाएँ?`)) return
    call(() => apiDelete(`/video-kyc/public/${token}/witness/${w.id}`))
  }

  const submitAll = async () => {
    if (!window.confirm('जमा करने के बाद कोई वीडियो बदला नहीं जा सकेगा। जमा करें?')) return
    await call(() => apiPost(`/video-kyc/public/${token}/submit`, { confirm: true }))
    window.scrollTo(0, 0)
  }

  // ── स्थितियाँ ─────────────────────────────────────────────
  if (loading) {
    return <div className="vk-page"><div className="vk-center"><div className="vk-spinner" /><p>Link जाँचा जा रहा है…</p></div></div>
  }

  if (fatal || !session) {
    const expired = fatal?.code === 'VKYC_EXPIRED' || fatal?.code === 'VKYC_REVOKED'
    return (
      <div className="vk-page">
        <div className="vk-center vk-endcard">
          <div className="vk-end-icon vk-end-bad">{expired ? '⏱' : '!'}</div>
          <h1>{expired ? 'Link अब मान्य नहीं है' : 'Link नहीं खुल सका'}</h1>
          <p>{fatal?.text || 'कृपया दोबारा कोशिश करें।'}</p>
          {!expired && <button className="vk-btn vk-btn-primary" onClick={load}>दोबारा खोलें</button>}
        </div>
      </div>
    )
  }

  const st = session.statement || {}

  if (target) {
    return (
      <Recorder
        token={token}
        target={target}
        statement={st}
        limits={session.limits}
        onClose={() => setTarget(null)}
        onDone={(s) => {
          setSession(s); setTarget(null)
          setMsg({ ok: true, text: target.role === 'customer' ? 'ग्राहक का वीडियो जमा हो गया। अब गवाह का वीडियो रिकॉर्ड करें।' : `${target.name} का वीडियो जमा हो गया।` })
          window.scrollTo(0, 0)
        }}
      />
    )
  }

  const custDone = !!session.customerRecording
  const wRecs = session.witnessRecordings || {}
  const doneWitnesses = session.witnesses.filter(w => wRecs[w.id]).length
  const allWitnessDone = session.witnesses.every(w => wRecs[w.id])
  // ⭐ बहुत छोटा/ठीक न बना वीडियो — जमा करने से पहले ही रोककर दोबारा बनवाओ
  const minSec = session.limits?.minSeconds || 8
  const isBadRec = (r) => !!r && Number(r.duration) < minSec - 2
  const custBad = custDone && isBadRec(session.customerRecording)
  const badWitnessCount = session.witnesses.filter(w => isBadRec(wRecs[w.id])).length
  const canSubmit = custDone && allWitnessDone && session.witnesses.length >= session.minWitnesses &&
    !custBad && badWitnessCount === 0
  const usedSuggestions = new Set(session.witnesses.map(w => w.name.toLowerCase()))
  const suggestions = (st.suggestedWitnesses || []).map((s, i) => ({ ...s, i })).filter(s => !usedSuggestions.has(String(s.name).toLowerCase()))
  const supported = recorderSupported()

  // ── जमा हो चुकी ──
  if (session.locked) {
    const label = { completed: 'जाँच के लिए भेज दी गई है', verified: 'सत्यापित हो चुकी है', rejected: 'शोरूम ने दोबारा करवाने को कहा है' }[session.status] || ''
    return (
      <div className="vk-page">
        <div className="vk-center vk-endcard">
          <div className="vk-end-icon">✓</div>
          <h1>Video KYC जमा हो गई</h1>
          <p>धन्यवाद {st.customerName} जी। आपकी Video KYC {label}।</p>
          <ul className="vk-endlist">
            <li>ग्राहक का वीडियो — जमा</li>
            <li>गवाह के वीडियो — {session.witnesses.length}</li>
            {session.submittedAt && <li>जमा: {new Date(session.submittedAt).toLocaleString('hi-IN')}</li>}
          </ul>
          <p className="vk-muted">अब आप यह पेज बंद कर सकते हैं।</p>
        </div>
      </div>
    )
  }

  return (
    <div className="vk-page">
      <header className="vk-head">
        <div className="vk-mark">VF</div>
        <div>
          <div className="vk-head-title">Video KYC व सहमति</div>
          <div className="vk-head-sub">{st.financer}{st.applicationNo ? ` · आवेदन ${st.applicationNo}` : ''}</div>
        </div>
      </header>

      <main className="vk-main">
        <p className="vk-lead">
          नमस्ते <strong>{st.customerName}</strong> जी। अपना और अपने गवाह का छोटा-सा वीडियो रिकॉर्ड करें — हर वीडियो लगभग एक मिनट का।
        </p>
        <p className="vk-muted vk-small">
          Link की समय सीमा: {new Date(session.expiresAt).toLocaleString('hi-IN', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>

        {!supported && (
          <div className="vk-alert vk-block">
            यह browser वीडियो रिकॉर्ड नहीं कर सकता। कृपया यह link <strong>Chrome</strong> (Android) या <strong>Safari</strong> (iPhone) में खोलें।
          </div>
        )}
        {msg && <div className={`vk-block ${msg.ok ? 'vk-ok' : 'vk-alert'}`}>{msg.text}</div>}

        {/* ── 1. ग्राहक ── */}
        <section className={`vk-step ${custDone ? 'is-done' : 'is-active'}`}>
          <div className="vk-step-head">
            <span className="vk-step-num">{custDone ? '✓' : '1'}</span>
            <div>
              <h2>ग्राहक का वीडियो</h2>
              <p>{custDone
                ? (custBad
                  ? `⚠️ वीडियो ठीक नहीं बना (${fmtDuration(session.customerRecording.duration)}) — दोबारा रिकॉर्ड करें`
                  : `जमा · ${fmtDuration(session.customerRecording.duration)} · ${fmtBytes(session.customerRecording.bytes)}`)
                : 'अपना नाम, वाहन, कीमत और किश्त अपने शब्दों में बताएँ'}</p>
            </div>
          </div>
          <button className={`vk-btn ${custDone ? 'vk-btn-ghost' : 'vk-btn-primary'} vk-wide`} disabled={!supported || busy}
            onClick={() => setTarget({ role: 'customer' })}>
            {custDone ? 'दोबारा रिकॉर्ड करें' : 'वीडियो रिकॉर्ड करें'}
          </button>
        </section>

        {/* ── 2. गवाह ── */}
        <section className={`vk-step ${!custDone ? 'is-locked' : (allWitnessDone && session.witnesses.length >= session.minWitnesses) ? 'is-done' : 'is-active'}`}>
          <div className="vk-step-head">
            <span className="vk-step-num">{custDone && allWitnessDone && session.witnesses.length >= session.minWitnesses ? '✓' : '2'}</span>
            <div>
              <h2>गवाह का वीडियो</h2>
              <p>{!custDone ? 'पहले ग्राहक का वीडियो जमा करें'
                : `${doneWitnesses} / ${session.witnesses.length || session.minWitnesses} जमा${session.minWitnesses ? ` · कम से कम ${session.minWitnesses} ज़रूरी` : ''}`}</p>
            </div>
          </div>

          {session.witnesses.map(w => {
            const rec = wRecs[w.id]
            return (
              <div key={w.id} className="vk-witness">
                <div className="vk-witness-info">
                  <strong>{w.name}</strong>
                  <span>{[w.relation, w.mobileHint].filter(Boolean).join(' · ')}</span>
                  <span className={rec && !isBadRec(rec) ? 'vk-tag-ok' : 'vk-tag-wait'}>
                    {rec
                      ? (isBadRec(rec)
                        ? `⚠️ वीडियो ठीक नहीं बना (${fmtDuration(rec.duration)}) — दोबारा बनाएँ`
                        : `जमा · ${fmtDuration(rec.duration)} · ${fmtBytes(rec.bytes)}`)
                      : 'वीडियो बाकी'}
                  </span>
                </div>
                <div className="vk-witness-act">
                  <button className={`vk-btn ${rec ? 'vk-btn-ghost' : 'vk-btn-primary'}`} disabled={!custDone || !supported || busy}
                    onClick={() => setTarget({ role: 'witness', witnessId: w.id, name: w.name, relation: w.relation })}>
                    {rec ? 'दोबारा' : 'रिकॉर्ड करें'}
                  </button>
                  {!rec && <button className="vk-link-btn" disabled={busy} onClick={() => removeWitness(w)}>हटाएँ</button>}
                </div>
              </div>
            )
          })}

          {custDone && session.witnesses.length < session.maxWitnesses && (
            <div className="vk-add-witness">
              {suggestions.length > 0 && (
                <>
                  <p className="vk-small vk-muted">आवेदन में दर्ज गारंटर को गवाह बनाएँ:</p>
                  <div className="vk-chips">
                    {suggestions.map(s => (
                      <button key={s.i} className="vk-chip" disabled={busy}
                        onClick={() => addWitness({ suggestionIndex: s.i, relation: s.relation })}>
                        + {s.name}{s.relation ? ` (${s.relation})` : ''}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {!showWForm ? (
                <button className="vk-btn vk-btn-ghost vk-wide" onClick={() => setShowWForm(true)}>
                  {session.witnesses.length ? '+ एक और गवाह जोड़ें' : '+ नया गवाह जोड़ें'}
                </button>
              ) : (
                <div className="vk-form">
                  <label>गवाह का पूरा नाम
                    <input value={wForm.name} maxLength={80} onChange={e => setWForm({ ...wForm, name: e.target.value })} placeholder="जैसे: रमेश कुमार" />
                  </label>
                  <label>मोबाइल नंबर
                    <input value={wForm.mobile} inputMode="numeric" maxLength={10}
                      onChange={e => setWForm({ ...wForm, mobile: e.target.value.replace(/\D/g, '') })} placeholder="10 अंक" />
                  </label>
                  <label>ग्राहक से संबंध
                    <input value={wForm.relation} maxLength={40} onChange={e => setWForm({ ...wForm, relation: e.target.value })} placeholder="जैसे: भाई, मित्र, पड़ोसी" />
                  </label>
                  <div className="vk-row">
                    <button className="vk-btn vk-btn-ghost" onClick={() => setShowWForm(false)}>रद्द करें</button>
                    <button className="vk-btn vk-btn-primary" disabled={busy || wForm.name.trim().length < 2}
                      onClick={() => addWitness({ name: wForm.name.trim(), mobile: wForm.mobile, relation: wForm.relation.trim() })}>
                      गवाह जोड़ें
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── 3. जमा करें ── */}
        <section className={`vk-step ${canSubmit ? 'is-active' : 'is-locked'}`}>
          <div className="vk-step-head">
            <span className="vk-step-num">3</span>
            <div>
              <h2>जमा करें</h2>
              <p>{(custBad || badWitnessCount > 0)
                ? '⚠️ कोई वीडियो ठीक नहीं बना — पहले उसे दोबारा रिकॉर्ड करें, तब जमा होगी'
                : 'जमा करने के बाद कोई वीडियो बदला या हटाया नहीं जा सकेगा'}</p>
            </div>
          </div>
          <label className="vk-confirm">
            <input type="checkbox" checked={confirmed} disabled={!canSubmit} onChange={e => setConfirmed(e.target.checked)} />
            <span>मैं पुष्टि करता/करती हूँ कि ये वीडियो मैंने और मेरे गवाह ने अपनी इच्छा से, बिना किसी दबाव के रिकॉर्ड किए हैं।</span>
          </label>
          <button className="vk-btn vk-btn-primary vk-wide" disabled={!canSubmit || !confirmed || busy} onClick={submitAll}>
            {busy ? 'रुकें…' : 'Video KYC जमा करें'}
          </button>
        </section>
      </main>
    </div>
  )
}
