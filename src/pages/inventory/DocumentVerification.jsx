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

export function DocumentVerification({ session }) {
  const { lang } = useLang()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [detail, setDetail] = useState(null)
  const [signedUrls, setSignedUrls] = useState({})
  const [busy, setBusy] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [confirmApprove, setConfirmApprove] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const j = await adminApi(session, 'enrollment.list', {})
      setItems((j.items || []).filter(o => o.identity))
    } catch (e) { alert('❌ ' + e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const pending = items.filter(o => o.identity?.status === 'pending').length
  const verified = items.filter(o => o.identity?.status === 'approved').length
  const rejected = items.filter(o => o.identity?.status === 'rejected').length

  let list = items.filter(o => o.identity?.status === tab)
  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter(o => (o.name || '').toLowerCase().includes(q) || (o.mobile || '').includes(q) || String(o.id).includes(q) || (o.item_name || '').toLowerCase().includes(q))
  }

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const pageItems = list.slice((curPage - 1) * pageSize, curPage * pageSize)

  const openDetail = (o) => {
    setDetail(o); setSignedUrls({}); setRejectReason(''); setShowReject(false); setConfirmApprove(false)
  }

  const getSignedUrl = async (path) => {
    if (!path || signedUrls[path]) return
    try {
      const j = await adminApi(session, 'identity.signed_url', { path })
      setSignedUrls(s => ({ ...s, [path]: j.url }))
    } catch (e) { alert('❌ ' + e.message) }
  }

  const approve = async () => {
    setConfirmApprove(false); setBusy(detail.id)
    try {
      await adminApi(session, 'identity.approve', { order_id: detail.id })
      alert('✅ ' + tr(lang, 'dv_docs_approved'))
      load(); setDetail(null)
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }
  const reject = async () => {
    if (!rejectReason.trim()) return alert(tr(lang, 'dv_err_reason'))
    setBusy(detail.id)
    try {
      await adminApi(session, 'identity.reject', { order_id: detail.id, reason: rejectReason.trim() })
      alert(tr(lang, 'dv_docs_rejected'))
      load(); setDetail(null)
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const stats = [
    { label: tr(lang, 'dv_stat_pending'), value: pending, desc: tr(lang, 'dv_stat_pending_desc'), color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '🕐' },
    { label: tr(lang, 'dv_stat_verified'), value: verified, desc: tr(lang, 'dv_stat_verified_desc'), color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '✓' },
    { label: tr(lang, 'dv_stat_rejected'), value: rejected, desc: tr(lang, 'dv_stat_rejected_desc'), color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '✕' },
    { label: tr(lang, 'dv_stat_total'), value: items.length, desc: tr(lang, 'dv_stat_total_desc'), color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '📋' },
  ]

  const selStyle = {
    padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 8, color: '#fff', fontSize: '.82rem', outline: 'none', cursor: 'pointer',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>🪪</div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>{tr(lang, 'dv_title')}</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'dv_subtitle')}</p>
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
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: 4 }}>
          {[
            { id: 'pending', label: tr(lang, 'dv_tab_pending') + ' (' + pending + ')' },
            { id: 'approved', label: tr(lang, 'dv_tab_verified') + ' (' + verified + ')' },
            { id: 'rejected', label: tr(lang, 'dv_tab_rejected') + ' (' + rejected + ')' },
          ].map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setPage(1) }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: tab === t.id ? 'linear-gradient(135deg, #e8232a, #b01020)' : 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem', fontWeight: tab === t.id ? 700 : 400 }}>{t.label}</button>
          ))}
        </div>
        <input placeholder={tr(lang, 'dv_search_ph')} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 200, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
        <button onClick={load} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.85rem' }}>{tr(lang, 'dv_refresh')}</button>
      </div>

      <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                {['#', tr(lang, 'dv_th_order'), tr(lang, 'dv_th_customer'), tr(lang, 'dv_th_course'), tr(lang, 'dv_th_doc'), tr(lang, 'dv_th_submitted'), tr(lang, 'dv_th_status'), tr(lang, 'dv_th_actions')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((o, i) => (
                <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)', cursor: 'pointer' }} onClick={() => openDetail(o)}>
                  <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '.85rem' }}>{(curPage - 1) * pageSize + i + 1}</td>
                  <td style={{ padding: '12px 14px', color: '#fff', fontSize: '.85rem', fontWeight: 600 }}>#CSK-{String(o.id).padStart(5, '0')}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ color: '#fff', fontSize: '.88rem', fontWeight: 600 }}>{o.name}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '.74rem' }}>{o.mobile}</div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '.85rem', color: 'var(--silver)' }}>{o.item_name}</td>
                  <td style={{ padding: '12px 14px', fontSize: '.85rem', color: '#fff' }}>{o.identity.doc_type === 'nid' ? tr(lang, 'dv_doc_nid') : tr(lang, 'dv_doc_birth')}</td>
                  <td style={{ padding: '12px 14px', fontSize: '.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{new Date(o.identity.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.72rem', fontWeight: 600, background: o.identity.status === 'approved' ? 'rgba(46,204,113,.15)' : o.identity.status === 'rejected' ? 'rgba(232,35,42,.15)' : 'rgba(245,185,66,.15)', color: o.identity.status === 'approved' ? '#2ecc71' : o.identity.status === 'rejected' ? '#ff6b6b' : '#f5b942', border: `1px solid ${o.identity.status === 'approved' ? 'rgba(46,204,113,.4)' : o.identity.status === 'rejected' ? 'rgba(232,35,42,.4)' : 'rgba(245,185,66,.4)'}` }}>
                      {o.identity.status === 'approved' ? tr(lang, 'dv_status_verified') : o.identity.status === 'rejected' ? tr(lang, 'dv_status_rejected') : tr(lang, 'dv_status_review')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                    <button title={tr(lang, 'dv_tip_view')} onClick={() => openDetail(o)} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer', marginRight: 5 }}>👁</button>
                    {o.identity.status === 'pending' && (
                      <>
                        <button title={tr(lang, 'dv_tip_approve')} onClick={() => { openDetail(o); setConfirmApprove(true) }} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(46,204,113,.4)', background: 'rgba(46,204,113,.1)', color: '#2ecc71', cursor: 'pointer', marginRight: 5 }}>✓</button>
                        <button title={tr(lang, 'dv_tip_reject')} onClick={() => { openDetail(o); setShowReject(true) }} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer' }}>✕</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>{tr(lang, 'dv_empty_title')}</div>
            <div style={{ fontSize: '.85rem' }}>{tr(lang, 'dv_empty_sub')}</div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>{tr(lang, 'dv_loading')}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{tr(lang, 'dv_showing')} {list.length === 0 ? 0 : (curPage - 1) * pageSize + 1} {tr(lang, 'dv_to')} {Math.min(curPage * pageSize, list.length)} {tr(lang, 'dv_of')} {list.length.toLocaleString()} {tr(lang, 'dv_submissions_word')}</span>
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
              {[10, 25, 50, 100].map(n => <option key={n} value={n} style={{ background: '#1a0d0e' }}>{n} {tr(lang, 'dv_per_page')}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 200 }} onClick={() => setDetail(null)}>
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 'min(440px, 100vw)', background: '#140809', borderLeft: '1px solid rgba(232,35,42,.4)', overflowY: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{tr(lang, 'dv_drawer_title')}</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ fontSize: '.9rem', marginBottom: 14 }}>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'dv_customer')} </span><b style={{ color: '#fff' }}>{detail.name}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'dv_order')} </span><b style={{ color: '#fff' }}>#CSK-{String(detail.id).padStart(5, '0')}</b> · {detail.item_name} · {fmtPrice(detail.price)}</div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'dv_submitted')} </span>{new Date(detail.identity.created_at).toLocaleString('en-GB')}</div>
              {detail.identity.reviewed_at && <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'dv_reviewed')} </span>{new Date(detail.identity.reviewed_at).toLocaleString('en-GB')}</div>}
              {detail.identity.review_note && <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'dv_review_note')} </span>{detail.identity.review_note}</div>}
            </div>
            <div style={{ fontWeight: 700, color: '#fff', marginBottom: 10 }}>{detail.identity.doc_type === 'nid' ? tr(lang, 'dv_doc_nid_birth') : tr(lang, 'dv_doc_birth')}</div>
            {signedUrls[detail.identity.doc_path] ? (
              detail.identity.doc_path.endsWith('.pdf') ? (
                <a href={signedUrls[detail.identity.doc_path]} target="_blank" rel="noreferrer" style={{ color: '#4da3ff', fontSize: '.88rem' }}>{tr(lang, 'dv_open_pdf')}</a>
              ) : (
                <img src={signedUrls[detail.identity.doc_path]} alt="ID document" style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)', marginBottom: 10 }} />
              )
            ) : (
              <button onClick={() => getSignedUrl(detail.identity.doc_path)} style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', marginBottom: 10 }}>{tr(lang, 'dv_load_doc')}</button>
            )}
            {signedUrls[detail.identity.doc_path] && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <a href={signedUrls[detail.identity.doc_path]} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', padding: '9px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', textDecoration: 'none', fontSize: '.85rem', fontWeight: 600 }}>{tr(lang, 'dv_view_full')}</a>
                <a href={signedUrls[detail.identity.doc_path]} download style={{ flex: 1, textAlign: 'center', padding: '9px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', textDecoration: 'none', fontSize: '.85rem' }}>{tr(lang, 'dv_download')}</a>
              </div>
            )}
            <div style={{ fontWeight: 700, color: '#fff', marginBottom: 10, marginTop: 8 }}>{tr(lang, 'dv_selfie')}</div>
            {signedUrls[detail.identity.selfie_path] ? (
              <img src={signedUrls[detail.identity.selfie_path]} alt="Selfie" style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)', marginBottom: 10 }} />
            ) : (
              <button onClick={() => getSignedUrl(detail.identity.selfie_path)} style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', marginBottom: 10 }}>{tr(lang, 'dv_load_selfie')}</button>
            )}
            {signedUrls[detail.identity.selfie_path] && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <a href={signedUrls[detail.identity.selfie_path]} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', padding: '9px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', textDecoration: 'none', fontSize: '.85rem', fontWeight: 600 }}>{tr(lang, 'dv_view_full')}</a>
                <a href={signedUrls[detail.identity.selfie_path]} download style={{ flex: 1, textAlign: 'center', padding: '9px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', textDecoration: 'none', fontSize: '.85rem' }}>{tr(lang, 'dv_download')}</a>
              </div>
            )}
            {detail.identity.status === 'pending' && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button onClick={() => setConfirmApprove(true)} disabled={busy === detail.id} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #2ecc71, #1e8449)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{tr(lang, 'dv_approve_docs')}</button>
                  <button onClick={() => setShowReject(true)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', fontWeight: 600, cursor: 'pointer' }}>{tr(lang, 'dv_reject_docs')}</button>
                </div>
                {showReject && (
                  <div>
                    <label style={{ display: 'block', fontSize: '.85rem', color: 'var(--silver)', marginBottom: 6 }}>{tr(lang, 'dv_reject_label')}</label>
                    <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} placeholder={tr(lang, 'dv_reject_ph')} style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, color: '#fff', fontSize: '.88rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={reject} disabled={busy === detail.id} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: '#e8232a', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{tr(lang, 'dv_confirm_reject')}</button>
                      <button onClick={() => { setShowReject(false); setRejectReason('') }} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>{tr(lang, 'dv_cancel')}</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {confirmApprove && detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 300, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setConfirmApprove(false)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 440, width: '100%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 10px', color: '#fff' }}>{tr(lang, 'dv_confirm_title')}</h3>
            <p style={{ color: 'var(--muted)', fontSize: '.88rem', margin: '0 0 18px' }}>{tr(lang, 'dv_confirm_desc_a')}"{detail.name}"{tr(lang, 'dv_confirm_desc_b')}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={approve} disabled={busy === detail.id} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{tr(lang, 'dv_yes_approve')}</button>
              <button onClick={() => setConfirmApprove(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>{tr(lang, 'dv_cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
