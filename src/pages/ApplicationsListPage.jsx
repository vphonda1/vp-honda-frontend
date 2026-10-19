// ═══════════════════════════════════════════════════════════════
// src/pages/ApplicationsListPage.jsx  —  Phase 8 (नई file)
// ───────────────────────────────────────────────────────────────
// यह पन्ना अब तक था ही नहीं — इसीलिए आवेदन approve करने का कोई
// रास्ता नहीं दिख रहा था।
//
// अब:  सभी · मेरे · लंबित · स्वीकृत · अस्वीकृत
//      और लंबित आवेदनों पर सीधे ✅ Approve / ❌ Reject के बटन
//      (password दोबारा माँगकर, जैसा नियम है)
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPatch } from '../utils/apiConfig'
import { can } from '../utils/permissions'
import { NoPermission } from '../components/Common/Can'
import { useReAuth } from '../components/Common/ReAuthModal'
import { useRealtimeRefresh } from '../hooks/useRealtime'

const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const fmt = (d) => d ? new Date(d).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'

const STATUS = {
  draft:     { bg: '#f1f5f9', fg: '#475569', label: 'ड्राफ्ट' },
  pending:   { bg: '#fef3c7', fg: '#92400e', label: 'स्वीकृति बाकी' },
  approved:  { bg: '#dcfce7', fg: '#166534', label: 'स्वीकृत' },
  rejected:  { bg: '#fee2e2', fg: '#991b1b', label: 'अस्वीकृत' },
  disbursed: { bg: '#dbeafe', fg: '#1e40af', label: 'वितरित' }
}

const S = {
  page:  { padding: '1rem', maxWidth: 900, margin: '0 auto' },
  h1:    { fontSize: '1.3rem', margin: '0 0 0.2rem', color: '#0f172a' },
  sub:   { fontSize: '0.82rem', color: '#64748b', margin: '0 0 1rem' },
  card:  { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.8rem', padding: '0.85rem', marginBottom: '0.6rem' },
  input: { width: '100%', padding: '0.62rem', border: '1.5px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.92rem', boxSizing: 'border-box' },
  btn:   (bg) => ({ padding: '0.55rem 0.85rem', border: 'none', borderRadius: '0.5rem', background: bg, color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }),
  ghost: { padding: '0.45rem 0.7rem', border: '1px solid #cbd5e1', borderRadius: '0.45rem', background: '#fff', color: '#475569', fontSize: '0.78rem', cursor: 'pointer' },
  chip:  (st) => ({ display: 'inline-block', padding: '0.12rem 0.5rem', borderRadius: '999px', background: st.bg, color: st.fg, fontSize: '0.7rem', fontWeight: 700 }),
  tabs:  { display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '0.85rem' },
  tab:   (on) => ({
    padding: '0.5rem 0.85rem', borderRadius: '0.55rem', whiteSpace: 'nowrap',
    border: on ? 'none' : '1px solid #e2e8f0', background: on ? '#1e40af' : '#fff',
    color: on ? '#fff' : '#475569', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer'
  }),
  banner:(ok) => ({ padding: '0.72rem 0.9rem', borderRadius: '0.55rem', marginBottom: '0.85rem', fontSize: '0.84rem', background: ok ? '#dcfce7' : '#fee2e2', color: ok ? '#166534' : '#991b1b' })
}

export default function ApplicationsListPage({ user }) {
  const [tab, setTab] = useState('pending')
  const [apps, setApps] = useState([])
  const [counts, setCounts] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  // Phase 19: हर आवेदन का "कौन-सा काम हो चुका, क्या बाकी" — एक ही call में
  const [progress, setProgress] = useState({})
  const navigate = useNavigate()
  const { ReAuthDialog, requireConfirm } = useReAuth()

  const notify = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 8000) }

  const canApprove = can(user, 'applications:approve')
  const canReject = can(user, 'applications:reject')

  const load = useCallback(async () => {
    if (!can(user, 'applications:view')) return
    setLoading(true)
    try {
      let url
      if (tab === 'mine') url = '/applications/mine?limit=100'
      else if (tab === 'all') url = '/applications?limit=100'
      else url = `/applications?status=${tab}&limit=100`

      const [r, s] = await Promise.all([
        apiGet(url),
        apiGet('/applications/stats').catch(() => null)
      ])

      let list = r.applications || []
      if (search) {
        const q = search.toLowerCase()
        list = list.filter(a =>
          String(a.fullName || '').toLowerCase().includes(q) ||
          String(a.mobile || '').includes(q) ||
          String(a.applicationId || '').toLowerCase().includes(q)
        )
      }
      setApps(list)
      if (s) setCounts(s.stats)

      // लोन खाता / Video KYC / दस्तावेज़ की स्थिति
      const ids = list.map(a => a._id).filter(Boolean).slice(0, 200)
      if (ids.length) {
        apiGet(`/applications/progress?ids=${ids.join(',')}`)
          .then(p => setProgress(p.progress || {}))
          .catch(() => {})
      } else setProgress({})
    } catch (e) { notify(e.message, false) }
    setLoading(false)
  }, [tab, search, user])

  useEffect(() => { load() }, [load])
  useRealtimeRefresh('applications', load)

  if (!can(user, 'applications:view')) {
    return <div style={S.page}><NoPermission permission="applications:view" /></div>
  }

  // ═══════════════════════════════════════════════════════════
  const approve = async (a) => {
    const ok = await requireConfirm(
      `${a.fullName} का ${inr(a.loanAmount)} का आवेदन स्वीकृत करना है?`,
      'आवेदन स्वीकृति'
    )
    if (!ok) return

    try {
      await apiPatch(`/applications/${a._id}/status`, { status: 'approved' })
      notify(`✅ ${a.fullName} का आवेदन स्वीकृत — अब लोन खाता बना सकते हैं`)
      load()
    } catch (e) {
      if (e.reAuthRequired) return notify('password की पुष्टि दोबारा करें', false)
      notify(e.message, false)
    }
  }

  const reject = async (a) => {
    const reason = window.prompt(`${a.fullName} का आवेदन अस्वीकार करने का कारण लिखें:`)
    if (!reason || reason.trim().length < 3) {
      return notify('कारण लिखना ज़रूरी है', false)
    }
    const ok = await requireConfirm(`आवेदन अस्वीकार करना है?\nकारण: ${reason}`, 'आवेदन अस्वीकृति')
    if (!ok) return

    try {
      await apiPatch(`/applications/${a._id}/status`, { status: 'rejected', rejectionReason: reason })
      notify(`आवेदन अस्वीकृत कर दिया गया`)
      load()
    } catch (e) {
      if (e.reAuthRequired) return notify('password की पुष्टि दोबारा करें', false)
      notify(e.message, false)
    }
  }

  const createLoan = async (a) => {
    const ok = await requireConfirm(`${a.fullName} का लोन खाता बनाना है?`)
    if (!ok) return
    try {
      const r = await import('../utils/apiConfig').then(m => m.apiPost(`/loans/from-application/${a._id}`, {}))
      notify(r.existing ? 'इस आवेदन का लोन खाता पहले से है' : 'लोन खाता बन गया')
      navigate(`/loans/${r.loan._id}`)
    } catch (e) { notify(e.message, false) }
  }

  const TABS = [
    ['pending', `स्वीकृति बाकी${counts?.pending ? ` (${counts.pending})` : ''}`],
    ['mine', 'मेरे'],
    ['approved', 'स्वीकृत'],
    ['rejected', 'अस्वीकृत'],
    ['draft', 'ड्राफ्ट'],
    ['all', 'सभी']
  ]

  return (
    <div style={S.page}>
      <h1 style={S.h1}>📋 फाइनेंस आवेदन</h1>
      <p style={S.sub}>यहाँ से आवेदन देखें, स्वीकृत या अस्वीकार करें</p>

      {msg && <div style={S.banner(msg.ok)}>{msg.ok ? '✅' : '⚠️'} {msg.text}</div>}

      {counts && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '0.45rem', marginBottom: '0.85rem' }}>
          {[
            ['कुल', counts.total, '#1e40af'],
            ['बाकी', counts.pending, '#f59e0b'],
            ['स्वीकृत', counts.approved, '#059669'],
            ['अस्वीकृत', counts.rejected, '#dc2626'],
            ['ड्राफ्ट', counts.drafts, '#64748b']
          ].map(([label, val, color]) => (
            <div key={label} style={{ ...S.card, marginBottom: 0, padding: '0.55rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.66rem', color: '#64748b' }}>{label}</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color }}>{val ?? '—'}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.7rem' }}>
        <input style={S.input} placeholder="नाम, मोबाइल या आवेदन संख्या…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <button style={S.btn('#1e40af')} onClick={load}>खोजें</button>
      </div>

      <div style={S.tabs}>
        {TABS.map(([k, label]) => (
          <button key={k} style={S.tab(tab === k)} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {loading && <p style={S.sub}>लोड हो रहा है…</p>}

      {!loading && apps.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', color: '#94a3b8' }}>
          {tab === 'pending' ? 'स्वीकृति के लिए कुछ बाकी नहीं 🎉' : 'कोई आवेदन नहीं मिला'}
          <div style={{ marginTop: '0.6rem' }}>
            <button style={S.btn('#059669')} onClick={() => navigate('/apply')}>+ नया आवेदन</button>
          </div>
        </div>
      )}

      {apps.map(a => {
        const st = STATUS[a.status] || STATUS.draft
        const isPending = a.status === 'pending'
        const isApproved = a.status === 'approved'

        // ── Phase 19: इस आवेदन का कौन-सा काम पूरा है ──
        const pr = progress[a._id] || {}
        const loanDone = !!pr.loan
        const vk = pr.videoKyc
        const vkDone = vk && (vk.status === 'verified' || vk.status === 'completed')
        const vkChip = !vk ? { bg: '#fef3c7', fg: '#92400e', label: '🎥 वीडियो KYC बाकी' }
          : vk.status === 'verified' ? { bg: '#dcfce7', fg: '#166534', label: '🎥 वीडियो KYC सत्यापित' }
          : vk.status === 'completed' ? { bg: '#ede9fe', fg: '#5b21b6', label: '🎥 वीडियो KYC जमा — जाँच बाकी' }
          : vk.status === 'rejected' ? { bg: '#fee2e2', fg: '#991b1b', label: '🎥 वीडियो KYC अस्वीकृत' }
          : ['pending', 'in_progress'].includes(vk.status) ? { bg: '#e0f2fe', fg: '#075985', label: vk.redo ? '🎥 वीडियो KYC — दोबारा link भेजा' : '🎥 वीडियो KYC — link भेजा' }
          : ['expired', 'revoked'].includes(vk.status) ? { bg: '#fef3c7', fg: '#92400e', label: '🎥 वीडियो KYC बाकी — link की अवधि ख़त्म' }
          : { bg: '#fef3c7', fg: '#92400e', label: '🎥 वीडियो KYC बाकी' }

        // ⭐ बटन का रंग/निशान काम की स्थिति बताए:
        //    हरा = अभी करना बाकी | ✅ = पूरी | 🟣 = जाँच बाकी | लाल = दोबारा करनी है | नीला = ग्राहक की बारी
        const vkBtn = (!vk || ['expired', 'revoked'].includes(vk.status))
          ? { color: '#128c4b', label: '🎥 वीडियो KYC करें' }
          : vk.status === 'verified'
            ? { color: '#475569', label: '✅ वीडियो KYC पूरी — देखें' }
            : vk.status === 'completed'
              ? { color: '#6d28d9', label: '✅ जमा हुई — जाँच बाकी, देखें' }
              : vk.status === 'rejected'
                ? { color: '#dc2626', label: '🔁 वीडियो KYC दोबारा करें' }
                : { color: '#0369a1', label: '⏳ ग्राहक की वीडियो KYC बाकी — देखें' }

        // ⭐ "पात्र नहीं" / सावधानी का कारण — पात्रता जाँच में जो शर्तें फ़ेल हुईं
        const el = a.eligibilityResult
        const elList = (!el || el.verdict === 'eligible') ? [] : (
          (Array.isArray(el.reasons?.fail) && el.reasons.fail.length ? el.reasons.fail
            : Array.isArray(el.reasons?.caution) ? el.reasons.caution : [])
        ).map(x => String(x)).slice(0, 3)

        return (
          <div key={a._id} style={{
            ...S.card,
            borderLeft: `4px solid ${loanDone ? '#059669' : st.fg}`,
            ...(loanDone ? { background: '#f2fbf5', borderColor: '#bbf7d0' } : {})
          }}>
            <div
              onClick={() => navigate(`/applications/${a._id}`)}
              style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}
            >
              <div style={{ minWidth: 175 }}>
                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{a.fullName || 'नाम दर्ज नहीं'}</div>
                <div style={{ fontSize: '0.73rem', color: '#64748b' }}>
                  {a.applicationId} · {a.mobile || '—'}
                </div>
                <div style={{ fontSize: '0.73rem', color: '#64748b' }}>
                  {[a.brand, a.vehicleModel].filter(Boolean).join(' ') || '—'}
                </div>
                <div style={{ marginTop: '0.32rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  <span style={S.chip(st)}>{st.label}</span>
                  {loanDone && (
                    <span style={S.chip({ bg: '#dcfce7', fg: '#166534' })}>
                      🏦 लोन खाता बना{pr.loan.loanAccountNo ? ` · ${pr.loan.loanAccountNo}` : ''}
                    </span>
                  )}
                  {isApproved && !loanDone && (
                    <span style={S.chip({ bg: '#fef3c7', fg: '#92400e' })}>🏦 लोन खाता बाकी</span>
                  )}
                  {(isApproved || a.status === 'disbursed') && (
                    <span style={S.chip(vkChip)}>{vkChip.label}</span>
                  )}
                  {pr.documents > 0 && (
                    <span style={S.chip({ bg: '#e0e7ff', fg: '#3730a3' })}>📁 {pr.documents} दस्तावेज़</span>
                  )}
                  {a.fraudFlags?.length > 0 && (
                    <span style={S.chip({ bg: '#fee2e2', fg: '#991b1b' })}>🚩 {a.fraudFlags.length}</span>
                  )}
                  {a.eligibilityResult?.verdict && (
                    <span style={S.chip(
                      a.eligibilityResult.verdict === 'eligible'
                        ? { bg: '#dcfce7', fg: '#166534' }
                        : a.eligibilityResult.verdict === 'not-eligible'
                          ? { bg: '#fee2e2', fg: '#991b1b' }
                          : { bg: '#fef3c7', fg: '#92400e' }
                    )}>{a.eligibilityResult.verdictHi}</span>
                  )}
                </div>
                {elList.length > 0 && (
                  <div style={{ fontSize: '0.72rem', marginTop: '0.3rem', lineHeight: 1.45,
                    color: el.verdict === 'not-eligible' ? '#991b1b' : '#92400e' }}>
                    {el.verdict === 'not-eligible' ? '❌ पात्र नहीं क्योंकि: ' : '⚠️ सावधानी: '}{elList.join(' · ')}
                  </div>
                )}
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                  बनाया: {a.createdByName || '—'} · {fmt(a.createdAt)}
                  {a.approvedByName ? ` · स्वीकृत: ${a.approvedByName}` : ''}
                  {a.rejectedByName ? ` · अस्वीकृत: ${a.rejectedByName}` : ''}
                </div>
                {a.rejectionReason && (
                  <div style={{ fontSize: '0.73rem', color: '#991b1b', marginTop: '0.2rem' }}>
                    कारण: {a.rejectionReason}
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e40af' }}>{inr(a.loanAmount)}</div>
                {a.emiAmount > 0 && (
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {inr(a.emiAmount)} × {a.tenure || '?'}
                  </div>
                )}
              </div>
            </div>

            {/* ── कार्रवाई ── */}
            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
              <button style={S.ghost} onClick={() => navigate(`/applications/${a._id}`)}>पूरा देखें</button>

              {a.status === 'draft' && (
                <button style={S.btn('#4f46e5')} onClick={() => navigate(`/apply?draftId=${a._id}`)}>
                  ▶️ आगे बढ़ाएँ
                </button>
              )}

              {isPending && canApprove && (
                <button style={S.btn('#059669')} onClick={() => approve(a)}>✅ स्वीकृत करें</button>
              )}
              {isPending && canReject && (
                <button style={S.btn('#dc2626')} onClick={() => reject(a)}>❌ अस्वीकार</button>
              )}
              {isPending && !canApprove && !canReject && (
                <span style={{ fontSize: '0.74rem', color: '#94a3b8', alignSelf: 'center' }}>
                  🔒 स्वीकृति का अधिकार Finance Manager / Admin के पास है
                </span>
              )}

              {isApproved && !loanDone && can(user, 'loans:create') && (
                <button style={S.btn('#1e40af')} onClick={() => createLoan(a)}>🏦 लोन खाता बनाएँ</button>
              )}

              {isApproved && (
                <>
                  <button style={S.ghost} onClick={() => navigate(`/delivery-order?appId=${a._id}`)}>📋 Delivery Order</button>
                  <button style={S.ghost} onClick={() => navigate(`/agreement?appId=${a._id}`)}>📜 Agreement</button>
                  {/* Phase 19: Agreement के बाद का अगला कदम */}
                  <button style={S.btn(vkBtn.color)}
                    onClick={() => navigate(`/applications/${a._id}?tab=videokyc`)}>
                    {vkBtn.label}
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })}

      <ReAuthDialog />
      <div style={{ height: '1.5rem' }} />
    </div>
  )
}
