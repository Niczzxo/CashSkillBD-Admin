import { useEffect, useState } from 'react'
import { tr } from '../../i18n/translations.js'
import { useLang } from '../../i18n/LanguageContext.jsx'

async function adminApi(session, action, payload = {}) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload }),
  })
  const text = await res.text()
  let j
  try { j = JSON.parse(text) } catch { throw new Error('API unavailable on static hosting — use Vercel version') }
  if (!res.ok) throw new Error(j.error || 'Request failed')
  return j
}

const fmtPrice = (n) => '৳' + Number(n || 0).toLocaleString('en-IN')
const maskPhone = (p) => {
  const s = String(p || '')
  if (s.length >= 8) return s.slice(0, 5) + 'XXXX' + s.slice(-2)
  return s ? s.slice(0, 3) + 'XXXX' : '—'
}
const memberIdOf = (o) => o.member_id || `CSBD-${String(o.user_id || o.id).slice(0, 6).toUpperCase()}`

export function CourseEnrollments({ session }) {
  const { lang } = useLang()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [courseF, setCourseF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [methodF, setMethodF] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [detail, setDetail] = useState(null)
  const [drawerTab, setDrawerTab] = useState('details')
  const [signedUrls, setSignedUrls] = useState({})
  const [busy, setBusy] = useState(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null) // {type, label, fn}

  const load = async () => {
    setLoading(true)
    try {
      const j = await adminApi(session, 'enrollment.list', {})
      setItems(j.items || [])
    } catch (e) { alert('❌ ' + e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Stats ──
  const total = items.length
  const pendingVerification = items.filter(o => (o.identity?.status || o.identity_status) === 'pending').length
  const paymentPending = items.filter(o => o.status === 'pending').length
  const verifiedApproved = items.filter(o => o.status === 'confirmed' && (o.identity?.status || o.identity_status) === 'approved').length
  const rejected = items.filter(o => o.status === 'rejected' || (o.identity?.status || o.identity_status) === 'rejected').length

  // ── Filters ──
  let list = items
  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter(o => (o.name || '').toLowerCase().includes(q) || (o.mobile || '').includes(q) || (o.email || '').toLowerCase().includes(q) || String(o.id).includes(q) || (o.item_name || '').toLowerCase().includes(q))
  }
  if (courseF !== 'all') list = list.filter(o => o.item_name === courseF)
  if (statusF !== 'all') {
    if (statusF === 'identity_pending') list = list.filter(o => (o.identity?.status || o.identity_status) === 'pending')
    else if (statusF === 'identity_rejected') list = list.filter(o => (o.identity?.status || o.identity_status) === 'rejected')
    else if (statusF === 'identity_approved') list = list.filter(o => (o.identity?.status || o.identity_status) === 'approved')
    else list = list.filter(o => o.status === statusF)
  }
  if (methodF !== 'all') list = list.filter(o => (o.pay_method || '').toLowerCase() === methodF.toLowerCase())
  if (from) list = list.filter(o => (o.created_at || '').slice(0, 10) >= from)
  if (to) list = list.filter(o => (o.created_at || '').slice(0, 10) <= to)

  const clearFilters = () => { setSearch(''); setCourseF('all'); setStatusF('all'); setMethodF('all'); setFrom(''); setTo(''); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const pageItems = list.slice((curPage - 1) * pageSize, curPage * pageSize)

  const courses = [...new Set(items.map(o => o.item_name).filter(Boolean))]
  const methods = [...new Set(items.map(o => o.pay_method).filter(Boolean))]

  const openDetail = (o) => {
    setDetail(o)
    setDrawerTab('details')
    setSignedUrls({})
    setNotesDraft('')
    setRejectReason('')
    setRejectTarget(null)
    setConfirmAction(null)
  }

  const getSignedUrl = async (path) => {
    if (!path || signedUrls[path]) return
    try {
      const j = await adminApi(session, 'identity.signed_url', { path })
      setSignedUrls(s => ({ ...s, [path]: j.url }))
    } catch (e) { alert('❌ ' + e.message) }
  }

  const doAction = async (fn) => {
    setConfirmAction(null)
    setBusy(detail.id)
    try { await fn(); load(); setDetail(null) } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const approveIdentity = () => setConfirmAction({ type: 'identity_approve', label: tr(lang, 'ce_approve_docs'), desc: tr(lang, 'ce_confirm_approve_docs_a') + '"' + detail.name + '"' + tr(lang, 'ce_confirm_approve_docs_b'), fn: async () => { await adminApi(session, 'identity.approve', { order_id: detail.id }); alert('✅ ' + tr(lang, 'ce_docs_approved')) } })
  const verifyPayment = () => setConfirmAction({ type: 'payment_approve', label: tr(lang, 'ce_approve_payment'), desc: tr(lang, 'ce_confirm_verify_pay_a') + '"' + detail.name + '"' + tr(lang, 'ce_confirm_verify_pay_b') + fmtPrice(detail.price) + tr(lang, 'ce_confirm_verify_pay_c') + detail.trx_id + tr(lang, 'ce_confirm_verify_pay_d'), fn: async () => { await adminApi(session, 'verify_order', { order_id: detail.id }); alert('✅ ' + tr(lang, 'ce_payment_verified')) } })
  const rejectIdentity = async () => {
    if (!rejectReason.trim()) return alert(tr(lang, 'ce_err_reason'))
    await doAction(async () => { await adminApi(session, 'identity.reject', { order_id: detail.id, reason: rejectReason.trim() }); alert(tr(lang, 'ce_docs_rejected')) })
  }
  const rejectPayment = async () => {
    if (!rejectReason.trim()) return alert(tr(lang, 'ce_err_reason'))
    await doAction(async () => { await adminApi(session, 'reject_order', { order_id: detail.id }); alert(tr(lang, 'ce_payment_rejected')) })
  }
  const saveNotes = async () => {
    if (!notesDraft.trim()) return
    try {
      await adminApi(session, 'order.notes', { order_id: detail.id, notes: notesDraft.trim() })
      setNotesDraft('')
      load()
      const j = await adminApi(session, 'enrollment.list', {})
      const updated = (j.items || []).find(x => x.id === detail.id)
      if (updated) setDetail(updated)
    } catch (e) { alert('❌ ' + e.message) }
  }

  const parseNotes = (raw) => {
    if (!raw) return []
    try {
      const p = JSON.parse(raw)
      if (Array.isArray(p)) return p
    } catch { /* plain text */ }
    return [{ text: raw, by: tr(lang, 'ce_admin'), at: null }]
  }

  const exportCSV = () => {
    if (list.length === 0) return alert(tr(lang, 'ce_err_no_export'))
    const header = tr(lang, 'ce_csv_header') + '\n'
    const rows = list.map(o => `CSB-${String(o.id).padStart(6, '0')},"${o.name}",${memberIdOf(o)},${maskPhone(o.mobile)},"${(o.item_name || '').replace(/"/g, '""')}",${o.price},${o.pay_method || ''},${o.trx_id || ''},${o.identity?.status || o.identity_status || ''},${o.status},${new Date(o.created_at).toLocaleString('en-GB')}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'course-enrollments.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const statusBadge = (s, kind) => {
    const map = {
      pending: { c: '#f5b942', bg: 'rgba(245,185,66,.15)', b: 'rgba(245,185,66,.4)', label: kind === 'payment' ? tr(lang, 'ce_badge_pay_pending') : tr(lang, 'ce_badge_id_pending') },
      confirmed: { c: '#2ecc71', bg: 'rgba(46,204,113,.15)', b: 'rgba(46,204,113,.4)', label: tr(lang, 'ce_badge_approved') },
      rejected: { c: '#ff6b6b', bg: 'rgba(232,35,42,.15)', b: 'rgba(232,35,42,.4)', label: kind === 'payment' ? tr(lang, 'ce_badge_rejected') : tr(lang, 'ce_badge_id_rejected') },
      approved: { c: '#2ecc71', bg: 'rgba(46,204,113,.15)', b: 'rgba(46,204,113,.4)', label: tr(lang, 'ce_badge_verified') },
      not_required: { c: 'var(--muted)', bg: 'rgba(255,255,255,.06)', b: 'rgba(255,255,255,.15)', label: '—' },
    }
    const m = map[s] || map.pending
    return <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.72rem', fontWeight: 600, background: m.bg, color: m.c, border: `1px solid ${m.b}`, whiteSpace: 'nowrap' }}>{m.label}</span>
  }

  const stats = [
    { label: tr(lang, 'ce_stat_total'), value: total, desc: tr(lang, 'ce_stat_total_desc'), color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '👥' },
    { label: tr(lang, 'ce_stat_pending'), value: pendingVerification, desc: tr(lang, 'ce_stat_pending_desc'), color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '🕐' },
    { label: tr(lang, 'ce_stat_pay_pending'), value: paymentPending, desc: tr(lang, 'ce_stat_pay_pending_desc'), color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '💳' },
    { label: tr(lang, 'ce_stat_verified'), value: verifiedApproved, desc: tr(lang, 'ce_stat_verified_desc'), color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '✓' },
    { label: tr(lang, 'ce_stat_rejected'), value: rejected, desc: tr(lang, 'ce_stat_rejected_desc'), color: '#c084fc', bg: 'rgba(192,132,252,.15)', icon: '✕' },
  ]

  const selStyle = {
    padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 8, color: '#fff', fontSize: '.82rem', outline: 'none', cursor: 'pointer',
  }
  const TAB_LABELS = { details: 'ce_tab_details', documents: 'ce_tab_documents', payment: 'ce_tab_payment', notes: 'ce_tab_notes' }
  const avatarColors = ['#e8232a', '#4da3ff', '#2ecc71', '#f5b942', '#e84393', '#8e44ad', '#00cec9']
  const initials = (name) => {
    if (!name) return '?'
    const parts = name.trim().split(/\s+/)
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>🎓</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>{tr(lang, 'ce_title')}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'ce_subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportCSV} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem' }}>↓ {tr(lang, 'ce_export')}</button>
          <button onClick={load} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>↻ {tr(lang, 'ce_refresh')}</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: 170, background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: `1px solid ${s.color}55`, borderRadius: 14, padding: 18, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: s.bg, display: 'grid', placeItems: 'center', fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{s.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <input placeholder={tr(lang, 'ce_search_ph')} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 220, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
        <select value={courseF} onChange={e => { setCourseF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 140 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'ce_all_courses')}</option>
          {courses.map(cn => <option key={cn} value={cn} style={{ background: '#1a0d0e' }}>{cn}</option>)}
        </select>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 160 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'ce_all_statuses')}</option>
          <option value="pending" style={{ background: '#1a0d0e' }}>{tr(lang, 'ce_opt_pay_pending')}</option>
          <option value="confirmed" style={{ background: '#1a0d0e' }}>{tr(lang, 'ce_opt_pay_approved')}</option>
          <option value="rejected" style={{ background: '#1a0d0e' }}>{tr(lang, 'ce_opt_pay_rejected')}</option>
          <option value="identity_pending" style={{ background: '#1a0d0e' }}>{tr(lang, 'ce_opt_id_pending')}</option>
          <option value="identity_approved" style={{ background: '#1a0d0e' }}>{tr(lang, 'ce_opt_id_verified')}</option>
          <option value="identity_rejected" style={{ background: '#1a0d0e' }}>{tr(lang, 'ce_opt_id_rejected')}</option>
        </select>
        <select value={methodF} onChange={e => { setMethodF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 140 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'ce_all_methods')}</option>
          {methods.map(m => <option key={m} value={m} style={{ background: '#1a0d0e' }}>{m}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 9, padding: '6px 10px' }}>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '.85rem', colorScheme: 'dark' }} />
          <span style={{ color: 'var(--muted)', fontSize: '.82rem' }}>{tr(lang, 'ce_to')}</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '.85rem', colorScheme: 'dark' }} />
        </div>
        <button onClick={load} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.85rem' }}>{tr(lang, 'ce_filter')}</button>
        <button onClick={clearFilters} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>{tr(lang, 'ce_reset')}</button>
      </div>

      <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1150 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                {['#', tr(lang, 'ce_th_order'), tr(lang, 'ce_th_student'), tr(lang, 'ce_th_course'), tr(lang, 'ce_th_docs'), tr(lang, 'ce_th_payment'), tr(lang, 'ce_th_status'), tr(lang, 'ce_th_enrolled'), tr(lang, 'ce_th_actions')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((o, i) => {
                const idStatus = o.identity?.status || o.identity_status || 'not_required'
                const hasDocs = !!o.identity
                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)', cursor: 'pointer' }} onClick={() => openDetail(o)}>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '.85rem' }}>{(curPage - 1) * pageSize + i + 1}</td>
                    <td style={{ padding: '12px 14px', color: '#fff', fontSize: '.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>CSB-{String(o.id).padStart(6, '0')}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: avatarColors[String(o.name || '').length % avatarColors.length], display: 'grid', placeItems: 'center', fontSize: '.72rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials(o.name)}</div>
                        <div>
                          <div style={{ color: '#fff', fontSize: '.88rem', fontWeight: 600 }}>{o.name}</div>
                          <div style={{ color: 'var(--muted)', fontSize: '.74rem' }}>{maskPhone(o.mobile)}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ color: '#fff', fontSize: '.88rem', fontWeight: 600 }}>{o.item_name}</div>
                      <div style={{ color: '#ff6b6b', fontSize: '.82rem', fontWeight: 600 }}>{fmtPrice(o.price)}</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {hasDocs ? (
                        <div style={{ display: 'flex', gap: 5 }}>
                          <span style={{ padding: '5px 9px', borderRadius: 7, fontSize: '.7rem', fontWeight: 600, background: 'rgba(77,163,255,.12)', color: '#4da3ff', border: '1px solid rgba(77,163,255,.3)' }}>{o.identity.doc_type === 'nid' ? tr(lang, 'ce_badge_nid') : tr(lang, 'ce_badge_birth')}</span>
                          <span style={{ padding: '5px 9px', borderRadius: 7, fontSize: '.7rem', fontWeight: 600, background: 'rgba(46,204,113,.12)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.3)' }}>{tr(lang, 'ce_badge_selfie')}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ color: '#fff', fontSize: '.85rem', fontWeight: 600 }}>{o.pay_method_label || o.pay_method}</div>
                      <div style={{ color: 'var(--muted)', fontSize: '.74rem', fontFamily: 'monospace' }}>TRX: {o.trx_id}</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                        {statusBadge(o.status, 'payment')}
                        {statusBadge(idStatus, 'identity')}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {new Date(o.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}<br />
                      <span style={{ fontSize: '.72rem' }}>{new Date(o.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                      <button title={tr(lang, 'ce_tip_view')} onClick={() => openDetail(o)} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', marginRight: 5 }}>👁</button>
                      {idStatus === 'pending' && (
                        <button title={tr(lang, 'ce_tip_approve_docs')} onClick={() => { openDetail(o); setTimeout(() => setConfirmAction({ type: 'identity_approve', label: tr(lang, 'ce_approve_docs'), desc: tr(lang, 'ce_quick_approve_a') + '"' + o.name + '"' + tr(lang, 'ce_quick_approve_b'), fn: async () => { await adminApi(session, 'identity.approve', { order_id: o.id }); alert('✅ ' + tr(lang, 'ce_docs_approved')) } }), 50) }} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(46,204,113,.4)', background: 'rgba(46,204,113,.1)', color: '#2ecc71', cursor: 'pointer', marginRight: 5 }}>✓</button>
                      )}
                      {idStatus === 'pending' && (
                        <button title={tr(lang, 'ce_tip_reject_docs')} onClick={() => { openDetail(o); setDrawerTab('documents'); setRejectTarget('identity') }} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer', marginRight: 5 }}>✕</button>
                      )}
                      <button title={tr(lang, 'ce_tip_more')} onClick={() => openDetail(o)} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>⋯</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>{tr(lang, 'ce_empty_title')}</div>
            <div style={{ fontSize: '.85rem' }}>{tr(lang, 'ce_empty_sub')}</div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>{tr(lang, 'ce_loading')}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{tr(lang, 'ce_showing')} {list.length === 0 ? 0 : (curPage - 1) * pageSize + 1} {tr(lang, 'ce_to')} {Math.min(curPage * pageSize, list.length)} {tr(lang, 'ce_of')} {list.length.toLocaleString()} {tr(lang, 'ce_enrollments_word')}</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button onClick={() => setPage(1)} disabled={curPage <= 1} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: 'pointer', opacity: curPage <= 1 ? 0.4 : 1 }}>«</button>
            <button onClick={() => setPage(Math.max(1, curPage - 1))} disabled={curPage <= 1} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: 'pointer', opacity: curPage <= 1 ? 0.4 : 1 }}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - curPage) <= 1).map((p, idx, arr) => (
              <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {idx > 0 && p - arr[idx - 1] > 1 && <span style={{ color: 'var(--muted)', padding: '0 2px' }}>…</span>}
                <button onClick={() => setPage(p)} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: p === curPage ? '#e8232a' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: p === curPage ? 700 : 400, fontSize: '.85rem' }}>{p}</button>
              </span>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, curPage + 1))} disabled={curPage >= totalPages} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: 'pointer', opacity: curPage >= totalPages ? 0.4 : 1 }}>›</button>
            <button onClick={() => setPage(totalPages)} disabled={curPage >= totalPages} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: 'pointer', opacity: curPage >= totalPages ? 0.4 : 1 }}>»</button>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} style={{ marginLeft: 8, padding: '6px 8px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 7, color: '#fff', fontSize: '.82rem', cursor: 'pointer' }}>
              {[10, 25, 50, 100].map(n => <option key={n} value={n} style={{ background: '#1a0d0e' }}>{n} {tr(lang, 'ce_per_page')}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Right-side Drawer ── */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 200 }} onClick={() => setDetail(null)}>
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 'min(440px, 100vw)', background: '#140809', borderLeft: '1px solid rgba(232,35,42,.4)', overflowY: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{tr(lang, 'ce_details_title')}</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: avatarColors[String(detail.name || '').length % avatarColors.length], display: 'grid', placeItems: 'center', fontSize: '1rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials(detail.name)}</div>
              <div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '1.05rem' }}>{detail.name}</div>
                <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'ce_order_id')} CSB-{String(detail.id).padStart(6, '0')}</div>
                <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'ce_enrolled')} {new Date(detail.created_at).toLocaleString('en-GB')}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
              {['details', 'documents', 'payment', 'notes'].map(t => (
                <button key={t} onClick={() => setDrawerTab(t)} style={{ flex: 1, padding: '9px 6px', border: 'none', borderBottom: drawerTab === t ? '2px solid #e8232a' : '2px solid transparent', background: 'transparent', color: drawerTab === t ? '#fff' : 'var(--muted)', cursor: 'pointer', fontSize: '.82rem', fontWeight: drawerTab === t ? 700 : 400, textTransform: 'capitalize' }}>{tr(lang, TAB_LABELS[t])}</button>
              ))}
            </div>

            {drawerTab === 'details' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '.9rem' }}>
                <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ce_member_id')} </span><b style={{ color: '#fff' }}>{memberIdOf(detail)}</b></div>
                <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ce_mobile')} </span><b style={{ color: '#fff' }}>{detail.mobile}</b> <span style={{ color: 'var(--muted)', fontSize: '.78rem' }}>{tr(lang, 'ce_masked_note')}</span></div>
                <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ce_email')} </span><b style={{ color: '#fff' }}>{detail.email || '—'}</b></div>
                <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ce_course')} </span><b style={{ color: '#fff' }}>{detail.item_name}</b></div>
                <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ce_price')} </span><b style={{ color: '#fff' }}>{fmtPrice(detail.price)}</b></div>
                <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ce_payment_status')} </span>{statusBadge(detail.status, 'payment')}</div>
                <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ce_identity_status')} </span>{statusBadge(detail.identity?.status || detail.identity_status || 'not_required', 'identity')}</div>
                <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ce_course_access')} </span><b style={{ color: detail.status === 'confirmed' && (detail.identity?.status || detail.identity_status) === 'approved' ? '#2ecc71' : '#f5b942' }}>{detail.status === 'confirmed' && (detail.identity?.status || detail.identity_status) === 'approved' ? tr(lang, 'ce_active') : tr(lang, 'ce_not_activated')}</b></div>
              </div>
            )}

            {drawerTab === 'documents' && (
              <div>
                {detail.identity ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <b style={{ color: '#fff' }}>{detail.identity.doc_type === 'nid' ? tr(lang, 'ce_doc_nid_birth') : tr(lang, 'ce_doc_birth')}</b>
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.72rem', fontWeight: 600, background: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)' }}>{tr(lang, 'ce_valid_format')}</span>
                    </div>
                    {signedUrls[detail.identity.doc_path] ? (
                      detail.identity.doc_path.endsWith('.pdf') ? (
                        <a href={signedUrls[detail.identity.doc_path]} target="_blank" rel="noreferrer" style={{ color: '#4da3ff', fontSize: '.88rem' }}>{tr(lang, 'ce_open_pdf')}</a>
                      ) : (
                        <img src={signedUrls[detail.identity.doc_path]} alt="ID document" style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)', marginBottom: 10 }} />
                      )
                    ) : (
                      <button onClick={() => getSignedUrl(detail.identity.doc_path)} style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', marginBottom: 10 }}>{tr(lang, 'ce_load_doc')}</button>
                    )}
                    {signedUrls[detail.identity.doc_path] && (
                      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        <a href={signedUrls[detail.identity.doc_path]} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', padding: '9px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', textDecoration: 'none', fontSize: '.85rem', fontWeight: 600 }}>{tr(lang, 'ce_view_full')}</a>
                        <a href={signedUrls[detail.identity.doc_path]} download style={{ flex: 1, textAlign: 'center', padding: '9px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', textDecoration: 'none', fontSize: '.85rem' }}>{tr(lang, 'ce_download')}</a>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 }}>
                      <b style={{ color: '#fff' }}>{tr(lang, 'ce_selfie_verification')}</b>
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.72rem', fontWeight: 600, background: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)' }}>{tr(lang, 'ce_valid_format')}</span>
                    </div>
                    {signedUrls[detail.identity.selfie_path] ? (
                      <img src={signedUrls[detail.identity.selfie_path]} alt="Selfie" style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)', marginBottom: 10 }} />
                    ) : (
                      <button onClick={() => getSignedUrl(detail.identity.selfie_path)} style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', marginBottom: 10 }}>{tr(lang, 'ce_load_selfie')}</button>
                    )}
                    {signedUrls[detail.identity.selfie_path] && (
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <a href={signedUrls[detail.identity.selfie_path]} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', padding: '9px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', textDecoration: 'none', fontSize: '.85rem', fontWeight: 600 }}>{tr(lang, 'ce_view_full')}</a>
                        <a href={signedUrls[detail.identity.selfie_path]} download style={{ flex: 1, textAlign: 'center', padding: '9px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', textDecoration: 'none', fontSize: '.85rem' }}>{tr(lang, 'ce_download')}</a>
                      </div>
                    )}
                    <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>
                      {tr(lang, 'ce_uploaded')} {new Date(detail.identity.created_at).toLocaleString('en-GB')}
                      {detail.identity.reviewed_at && <><br />{tr(lang, 'ce_reviewed')} {new Date(detail.identity.reviewed_at).toLocaleString('en-GB')}</>}
                      {detail.identity.review_note && <><br />{tr(lang, 'ce_review_note')} {detail.identity.review_note}</>}
                    </div>
                  </>
                ) : (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'ce_no_docs')}</div>
                )}
              </div>
            )}

            {drawerTab === 'payment' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '.9rem' }}>
                <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ce_method')} </span><b style={{ color: '#fff' }}>{detail.pay_method_label || detail.pay_method}</b></div>
                <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ce_amount_due')} </span><b style={{ color: '#fff' }}>{fmtPrice(detail.price)}</b></div>
                <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ce_amount_submitted')} </span><b style={{ color: '#fff' }}>{fmtPrice(detail.price)}</b></div>
                <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ce_trx_id')} </span><b style={{ color: '#fff', fontFamily: 'monospace' }}>{detail.trx_id}</b></div>
                <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ce_payment_status')} </span>{statusBadge(detail.status, 'payment')}</div>
                <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ce_submitted')} </span>{new Date(detail.created_at).toLocaleString('en-GB')}</div>
                {detail.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={verifyPayment} disabled={busy === detail.id} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{tr(lang, 'ce_approve_payment')}</button>
                    <button onClick={() => setRejectTarget('payment')} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', fontWeight: 600, cursor: 'pointer' }}>{tr(lang, 'ce_reject_payment')}</button>
                  </div>
                )}
              </div>
            )}

            {drawerTab === 'notes' && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                  {parseNotes(detail.admin_notes).length === 0 && <div style={{ color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'ce_no_notes')}</div>}
                  {parseNotes(detail.admin_notes).map((n, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: '.88rem', color: '#fff' }}>{n.text}</div>
                      <div style={{ fontSize: '.74rem', color: 'var(--muted)', marginTop: 4 }}>{n.by || tr(lang, 'ce_admin')}{n.at ? ` · ${new Date(n.at).toLocaleString('en-GB')}` : ''}</div>
                    </div>
                  ))}
                </div>
                <textarea value={notesDraft} onChange={e => setNotesDraft(e.target.value)} rows={3} placeholder={tr(lang, 'ce_add_note_ph')} style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, color: '#fff', fontSize: '.88rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
                <button onClick={saveNotes} style={{ marginTop: 8, width: '100%', padding: '10px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{tr(lang, 'ce_add_note')}</button>
              </div>
            )}

            {/* Admin Actions */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ fontWeight: 700, color: '#fff', marginBottom: 10 }}>{tr(lang, 'ce_admin_actions')}</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                {(detail.identity?.status || detail.identity_status) === 'pending' && (
                  <>
                    <button onClick={approveIdentity} disabled={busy === detail.id} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #2ecc71, #1e8449)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '.85rem' }}>{tr(lang, 'ce_approve_docs')}</button>
                    <button onClick={() => { setDrawerTab('documents'); setRejectTarget('identity') }} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', fontWeight: 600, cursor: 'pointer', fontSize: '.85rem' }}>{tr(lang, 'ce_reject_docs')}</button>
                  </>
                )}
              </div>
              {rejectTarget && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: '.85rem', color: 'var(--silver)', marginBottom: 6 }}>{tr(lang, 'ce_reject_label')}</label>
                  <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} placeholder={tr(lang, 'ce_reject_ph')} style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, color: '#fff', fontSize: '.88rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => rejectTarget === 'identity' ? rejectIdentity() : rejectPayment()} disabled={busy === detail.id} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: '#e8232a', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{tr(lang, 'ce_confirm_reject')}</button>
                    <button onClick={() => { setRejectTarget(null); setRejectReason('') }} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>{tr(lang, 'ce_cancel')}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmAction && detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 300, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setConfirmAction(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 440, width: '100%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 10px', color: '#fff' }}>{confirmAction.label}?</h3>
            <p style={{ color: 'var(--muted)', fontSize: '.88rem', margin: '0 0 18px' }}>{confirmAction.desc}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => doAction(confirmAction.fn)} disabled={busy === detail.id} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{tr(lang, 'ce_yes_confirm')}</button>
              <button onClick={() => setConfirmAction(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>{tr(lang, 'ce_cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
