import { useEffect, useState } from 'react'

async function adminApi(session, action, payload = {}) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j.error || 'Request failed')
  return j
}

const fmtPrice = (n) => '৳' + Number(n || 0).toLocaleString('en-IN')

export function CourseEnrollments({ session }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [detail, setDetail] = useState(null)
  const [signedUrls, setSignedUrls] = useState({})
  const [busy, setBusy] = useState(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null) // 'identity' | 'payment'

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
  const pendingPayment = items.filter(o => o.status === 'pending').length
  const approved = items.filter(o => o.status === 'confirmed').length
  const rejected = items.filter(o => o.status === 'rejected').length
  const identityPending = items.filter(o => (o.identity?.status || o.identity_status) === 'pending').length

  // ── Filters ──
  let list = items
  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter(o => (o.name || '').toLowerCase().includes(q) || (o.mobile || '').includes(q) || String(o.id).includes(q) || (o.item_name || '').toLowerCase().includes(q))
  }
  if (statusF !== 'all') {
    if (statusF === 'identity_pending') list = list.filter(o => (o.identity?.status || o.identity_status) === 'pending')
    else if (statusF === 'identity_rejected') list = list.filter(o => (o.identity?.status || o.identity_status) === 'rejected')
    else if (statusF === 'identity_approved') list = list.filter(o => (o.identity?.status || o.identity_status) === 'approved')
    else list = list.filter(o => o.status === statusF)
  }

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const pageItems = list.slice((curPage - 1) * pageSize, curPage * pageSize)

  const openDetail = (o) => {
    setDetail(o)
    setNotesDraft(o.admin_notes || '')
    setSignedUrls({})
    setRejectReason('')
    setRejectTarget(null)
  }

  const getSignedUrl = async (path) => {
    if (!path || signedUrls[path]) return
    try {
      const j = await adminApi(session, 'identity.signed_url', { path })
      setSignedUrls(s => ({ ...s, [path]: j.url }))
    } catch (e) { alert('❌ ' + e.message) }
  }

  const approveIdentity = async (o) => {
    if (!confirm(`"${o.name}"-এর identity verification approve করবেন?`)) return
    setBusy(o.id)
    try {
      await adminApi(session, 'identity.approve', { order_id: o.id })
      alert('✅ Identity approved.' + (o.status === 'confirmed' ? ' Course access activated.' : ' Payment approval still pending — course will activate when payment is confirmed.'))
      load(); setDetail(null)
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const rejectIdentity = async (o) => {
    if (!rejectReason.trim()) return alert('Rejection reason দিন')
    setBusy(o.id)
    try {
      await adminApi(session, 'identity.reject', { order_id: o.id, reason: rejectReason.trim() })
      alert('Identity rejected. Course will NOT be activated.')
      load(); setDetail(null)
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const verifyPayment = async (o) => {
    if (!confirm(`"${o.name}"-এর payment verify করবেন?\n\nIdentity approved না থাকলে course access চালু হবে না।`)) return
    setBusy(o.id)
    try {
      await adminApi(session, 'verify_order', { order_id: o.id })
      alert('✅ Payment verified.')
      load(); setDetail(null)
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const rejectPayment = async (o) => {
    if (!rejectReason.trim()) return alert('Rejection reason দিন')
    setBusy(o.id)
    try {
      await adminApi(session, 'reject_order', { order_id: o.id })
      alert('Payment rejected. Course will NOT be activated.')
      load(); setDetail(null)
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const saveNotes = async (o) => {
    try {
      await adminApi(session, 'order.notes', { order_id: o.id, notes: notesDraft })
      alert('✅ Notes saved.')
      load()
    } catch (e) { alert('❌ ' + e.message) }
  }

  const statusBadge = (s, kind) => {
    const map = {
      pending: { c: '#f5b942', bg: 'rgba(245,185,66,.15)', b: 'rgba(245,185,66,.4)', label: kind === 'payment' ? 'Pending' : 'Pending' },
      confirmed: { c: '#2ecc71', bg: 'rgba(46,204,113,.15)', b: 'rgba(46,204,113,.4)', label: 'Approved' },
      rejected: { c: '#ff6b6b', bg: 'rgba(232,35,42,.15)', b: 'rgba(232,35,42,.4)', label: 'Rejected' },
      approved: { c: '#2ecc71', bg: 'rgba(46,204,113,.15)', b: 'rgba(46,204,113,.4)', label: 'Approved' },
      not_required: { c: 'var(--muted)', bg: 'rgba(255,255,255,.06)', b: 'rgba(255,255,255,.15)', label: '—' },
    }
    const m = map[s] || map.pending
    return <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.74rem', fontWeight: 600, background: m.bg, color: m.c, border: `1px solid ${m.b}`, whiteSpace: 'nowrap' }}>{m.label}</span>
  }

  const stats = [
    { label: 'Total Enrollments', value: total, desc: 'All course orders', color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '📋' },
    { label: 'Pending Payment', value: pendingPayment, desc: 'Awaiting verification', color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '🕐' },
    { label: 'Identity Pending', value: identityPending, desc: 'Awaiting ID review', color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '🪪' },
    { label: 'Approved', value: approved, desc: 'Payment confirmed', color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '✓' },
    { label: 'Rejected', value: rejected, desc: 'Payment rejected', color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '✕' },
  ]

  const selStyle = {
    padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 8, color: '#fff', fontSize: '.82rem', outline: 'none', cursor: 'pointer',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>🎓</div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Course Enrollments</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>Review identity documents, verify payments and activate course access.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: 160, background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: `1px solid ${s.color}55`, borderRadius: 14, padding: 18, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
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
        <input placeholder="Search by name, mobile, order ID or course…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 220, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 180 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Enrollments</option>
          <option value="pending" style={{ background: '#1a0d0e' }}>Pending Payment</option>
          <option value="confirmed" style={{ background: '#1a0d0e' }}>Payment Approved</option>
          <option value="rejected" style={{ background: '#1a0d0e' }}>Payment Rejected</option>
          <option value="identity_pending" style={{ background: '#1a0d0e' }}>Identity Pending</option>
          <option value="identity_approved" style={{ background: '#1a0d0e' }}>Identity Approved</option>
          <option value="identity_rejected" style={{ background: '#1a0d0e' }}>Identity Rejected</option>
        </select>
        <button onClick={load} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.85rem' }}>Refresh</button>
      </div>

      <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                {['#', 'Order ID', 'Customer', 'Course', 'Price', 'Payment', 'TrxID', 'Identity', 'Payment Status', 'Date', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((o, i) => {
                const idStatus = o.identity?.status || o.identity_status || 'not_required'
                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '.85rem' }}>{(curPage - 1) * pageSize + i + 1}</td>
                    <td style={{ padding: '12px 14px', color: '#fff', fontSize: '.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>#CSK-{String(o.id).padStart(6, '0')}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ color: '#fff', fontSize: '.88rem', fontWeight: 600 }}>{o.name}</div>
                      <div style={{ color: 'var(--muted)', fontSize: '.74rem' }}>{o.mobile}</div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '.85rem', color: 'var(--silver)' }}>{o.item_name}</td>
                    <td style={{ padding: '12px 14px', color: '#fff', fontSize: '.88rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtPrice(o.price)}</td>
                    <td style={{ padding: '12px 14px', fontSize: '.85rem', color: 'var(--silver)' }}>{o.pay_method_label || o.pay_method}</td>
                    <td style={{ padding: '12px 14px', fontSize: '.82rem', color: 'var(--muted)', fontFamily: 'monospace' }}>{o.trx_id}</td>
                    <td style={{ padding: '12px 14px' }}>{statusBadge(idStatus, 'identity')}</td>
                    <td style={{ padding: '12px 14px' }}>{statusBadge(o.status, 'payment')}</td>
                    <td style={{ padding: '12px 14px', fontSize: '.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{new Date(o.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <button title="View" onClick={() => openDetail(o)} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer' }}>👁</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>কোনো enrollment নেই</div>
            <div style={{ fontSize: '.85rem' }}>কোর্স অর্ডার আসলে এখানে দেখা যাবে।</div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Showing {list.length === 0 ? 0 : (curPage - 1) * pageSize + 1} to {Math.min(curPage * pageSize, list.length)} of {list.length.toLocaleString()} enrollments</span>
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
              {[10, 25, 50, 100].map(n => <option key={n} value={n} style={{ background: '#1a0d0e' }}>{n} / page</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setDetail(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Enrollment Details</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '.9rem', marginBottom: 16 }}>
              <div><span style={{ color: 'var(--muted)' }}>Order ID: </span><b style={{ color: '#fff' }}>#CSK-{String(detail.id).padStart(6, '0')}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Customer: </span><b style={{ color: '#fff' }}>{detail.name}</b> · {detail.mobile} · {detail.email || '—'}</div>
              <div><span style={{ color: 'var(--muted)' }}>Course: </span><b style={{ color: '#fff' }}>{detail.item_name}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Price: </span><b style={{ color: '#fff' }}>{fmtPrice(detail.price)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Payment: </span><b style={{ color: '#fff' }}>{detail.pay_method_label || detail.pay_method}</b> · TrxID: <span style={{ fontFamily: 'monospace' }}>{detail.trx_id}</span></div>
              <div><span style={{ color: 'var(--muted)' }}>Payment Status: </span>{statusBadge(detail.status, 'payment')}</div>
              <div><span style={{ color: 'var(--muted)' }}>Identity Status: </span>{statusBadge(detail.identity?.status || detail.identity_status || 'not_required', 'identity')}</div>
              <div><span style={{ color: 'var(--muted)' }}>Submitted: </span>{new Date(detail.created_at).toLocaleString('en-GB')}</div>
            </div>

            {detail.identity && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: '#fff', marginBottom: 10 }}>Identity Documents ({detail.identity.doc_type === 'nid' ? 'NID Card' : 'Birth Certificate'})</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 6 }}>Document</div>
                    {signedUrls[detail.identity.doc_path] ? (
                      detail.identity.doc_path.endsWith('.pdf') ? (
                        <a href={signedUrls[detail.identity.doc_path]} target="_blank" rel="noreferrer" style={{ color: '#4da3ff', fontSize: '.85rem' }}>📄 Open PDF (10 min link)</a>
                      ) : (
                        <img src={signedUrls[detail.identity.doc_path]} alt="ID document" style={{ width: '100%', borderRadius: 9, border: '1px solid rgba(255,255,255,.1)' }} />
                      )
                    ) : (
                      <button onClick={() => getSignedUrl(detail.identity.doc_path)} style={{ padding: '9px 14px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>Load Document</button>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 6 }}>Selfie</div>
                    {signedUrls[detail.identity.selfie_path] ? (
                      <img src={signedUrls[detail.identity.selfie_path]} alt="Selfie" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: '50%', border: '1px solid rgba(255,255,255,.1)' }} />
                    ) : (
                      <button onClick={() => getSignedUrl(detail.identity.selfie_path)} style={{ padding: '9px 14px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>Load Selfie</button>
                    )}
                  </div>
                </div>
                {detail.identity.review_note && <div style={{ marginTop: 10, fontSize: '.85rem', color: 'var(--muted)' }}>Review note: {detail.identity.review_note}</div>}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '.85rem', color: 'var(--silver)', marginBottom: 6 }}>Internal Notes</label>
              <textarea value={notesDraft} onChange={e => setNotesDraft(e.target.value)} rows={2} style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, color: '#fff', fontSize: '.88rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
              <button onClick={() => saveNotes(detail)} style={{ marginTop: 8, padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>Save Notes</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {detail.identity?.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => approveIdentity(detail)} disabled={busy === detail.id} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #2ecc71, #1e8449)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>✓ Approve Identity</button>
                  <button onClick={() => setRejectTarget('identity')} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', fontWeight: 600, cursor: 'pointer' }}>✕ Reject Identity</button>
                </div>
              )}
              {detail.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => verifyPayment(detail)} disabled={busy === detail.id} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>✓ Verify Payment</button>
                  <button onClick={() => setRejectTarget('payment')} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', fontWeight: 600, cursor: 'pointer' }}>✕ Reject Payment</button>
                </div>
              )}
              {rejectTarget && (
                <div>
                  <label style={{ display: 'block', fontSize: '.85rem', color: 'var(--silver)', marginBottom: 6 }}>Rejection reason * (shown to customer)</label>
                  <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} placeholder="e.g. Document is blurry, please re-upload a clear photo." style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, color: '#fff', fontSize: '.88rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => rejectTarget === 'identity' ? rejectIdentity(detail) : rejectPayment(detail)} disabled={busy === detail.id} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: '#e8232a', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Confirm Rejection</button>
                    <button onClick={() => { setRejectTarget(null); setRejectReason('') }} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
