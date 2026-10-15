// Manual Delivery form — one form per service category, driven by the shared
// field spec in src/lib/delivery.js. Secrets are masked by default with a
// per-field reveal toggle. The server (api/admin.js) re-validates everything
// and, for Dollar, recomputes the final amount — the browser value is only
// a preview.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../i18n/LanguageContext.jsx'
import { tr } from '../i18n/translations.js'
import {
  DELIVERY_FIELDS, CATEGORY_LABEL, SECRET_FIELDS,
  deriveCategory, validateFields, maskSecret, deliveryStatusOf,
} from '../lib/delivery.js'

async function adminApi(session, action, payload = {}) {
  const r = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload }),
  })
  const text = await r.text()
  let j
  try { j = JSON.parse(text) } catch { throw new Error('API unavailable on static hosting — use Vercel version') }
  if (!r.ok) throw new Error(j.error || 'failed')
  return j
}

export function DeliveryForm({ session, order, onClose, onSaved }) {
  const { lang } = useLang()
  const bn = lang === 'bn' || lang === 'bn-BD'
  const category = deriveCategory(order)
  const spec = DELIVERY_FIELDS[category] || DELIVERY_FIELDS.other
  const [fields, setFields] = useState({})
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [correcting, setCorrecting] = useState(false)
  const [reason, setReason] = useState('')
  const [failReason, setFailReason] = useState('')
  const [showFailBox, setShowFailBox] = useState(false)
  const [revealed, setRevealed] = useState({})
  const [copied, setCopied] = useState('')

  const delivered = deliveries.find(d => d.status === 'delivered')
  const draft = deliveries.find(d => d.status === 'draft')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const j = await adminApi(session, 'delivery.get', { order_id: order.id })
        if (cancelled) return
        setDeliveries(j.deliveries || [])
        const active = (j.deliveries || []).find(d => d.status === 'delivered') || (j.deliveries || []).find(d => d.status === 'draft')
        if (active?.payload) setFields(active.payload)
        else setFields(prefill(order, category))
      } catch (e) {
        if (!cancelled) setErr(e.message)
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Escape closes the modal — placed BELOW all useState declarations:
  // the deps array is evaluated at the useEffect call, so it must never sit
  // above the consts its deps reference (TDZ ReferenceError → blank page).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (k, v) => setFields(f => ({ ...f, [k]: v }))

  const doSubmit = async (mode) => {
    const errors = validateFields(category, fields, mode === 'deliver')
    if (errors.length) { setErr(errors.join('; ')); return }
    if (mode === 'deliver' && !confirm(tr(lang, 'dly_submit_confirm'))) return
    setBusy(true); setErr(''); setMsg('')
    try {
      await adminApi(session, 'delivery.submit', { order_id: order.id, fields, mode })
      setMsg(mode === 'deliver' ? tr(lang, 'dly_submitted') : tr(lang, 'dly_draft_saved'))
      onSaved?.()
      setTimeout(onClose, 900)
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const doFail = async () => {
    if (!failReason.trim()) { setErr(tr(lang, 'dly_failure_reason_required')); return }
    setBusy(true); setErr('')
    try {
      await adminApi(session, 'delivery.fail', { order_id: order.id, reason: failReason.trim() })
      setMsg(tr(lang, 'dly_failed_saved'))
      onSaved?.()
      setTimeout(onClose, 900)
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const doCorrect = async () => {
    if (!reason.trim()) { setErr(tr(lang, 'dly_correction_reason_required')); return }
    const errors = validateFields(category, fields, true)
    if (errors.length) { setErr(errors.join('; ')); return }
    setBusy(true); setErr('')
    try {
      await adminApi(session, 'delivery.correct', { order_id: order.id, fields, reason: reason.trim() })
      setMsg(tr(lang, 'dly_corrected'))
      onSaved?.()
      setTimeout(onClose, 900)
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const copyVal = async (k, v) => {
    try { await navigator.clipboard.writeText(String(v)) } catch { /* clipboard unavailable */ }
    setCopied(k)
    setTimeout(() => setCopied(''), 1500)
  }

  const inp = {
    width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, color: '#fff',
    fontSize: '.9rem', outline: 'none', boxSizing: 'border-box',
  }
  const lbl = { display: 'block', fontSize: '.85rem', color: 'var(--silver)', marginBottom: 6, fontWeight: 500 }
  const btn = (bg, color = '#fff') => ({
    padding: '11px 16px', borderRadius: 10, border: 'none', background: bg,
    color, fontWeight: 600, cursor: 'pointer', fontSize: '.88rem',
  })

  const dollarPreview = category === 'dollar' && fields.requested_amount && fields.exchange_rate
    ? (Math.round((Number(fields.requested_amount) * Number(fields.exchange_rate) - Number(fields.fee || 0)) * 100) / 100)
    : null

  const body = (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 300, display: 'grid', placeItems: 'center', padding: 16, overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 620, width: '100%', margin: 'auto', maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <h3 style={{ margin: 0, color: '#fff' }}>{tr(lang, 'dly_title')} — {CATEGORY_LABEL[category]}</h3>
            <div style={{ fontSize: '.85rem', color: 'var(--muted)', marginTop: 4 }}>
              #CSK-{String(order.id).padStart(5, '0')} • {order.item_name} • {order.name}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {loading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>{tr(lang, 'loading')}</div>}
        {!loading && (<>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, fontSize: '.82rem' }}>
            <span style={{ padding: '4px 10px', borderRadius: 7, background: 'rgba(255,255,255,.06)', color: 'var(--silver)' }}>
              {tr(lang, 'dly_status')}: {deliveryStatusOf(order)}
            </span>
            {delivered && <span style={{ padding: '4px 10px', borderRadius: 7, background: 'rgba(46,204,113,.15)', color: '#2ecc71' }}>
              {tr(lang, 'dly_delivered_at')}: {new Date(delivered.delivered_at || delivered.created_at).toLocaleString('en-GB')}
            </span>}
            {draft && !delivered && <span style={{ padding: '4px 10px', borderRadius: 7, background: 'rgba(192,132,252,.15)', color: '#c084fc' }}>{tr(lang, 'dly_draft_exists')}</span>}
          </div>

          {err && <div style={{ padding: '10px 12px', borderRadius: 9, background: 'rgba(232,35,42,.12)', border: '1px solid rgba(232,35,42,.4)', color: '#ff8a8a', fontSize: '.85rem', marginBottom: 12 }}>{err}</div>}
          {msg && <div style={{ padding: '10px 12px', borderRadius: 9, background: 'rgba(46,204,113,.12)', border: '1px solid rgba(46,204,113,.4)', color: '#7dffa8', fontSize: '.85rem', marginBottom: 12 }}>{msg}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {Object.entries(spec).map(([key, def]) => {
              const label = bn ? def.labelBn : def.label
              const val = fields[key] ?? ''
              const isSecret = SECRET_FIELDS.has(key)
              return (
                <div key={key} style={{ gridColumn: def.type === 'textarea' ? '1 / -1' : 'auto' }}>
                  <label style={lbl}>{label}{def.required ? ' *' : ''}</label>
                  {def.type === 'select' ? (
                    <select value={val} onChange={e => set(key, e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                      <option value="" style={{ background: '#1a0d0e' }}>—</option>
                      {def.options.map(o => <option key={o} value={o} style={{ background: '#1a0d0e' }}>{o}</option>)}
                    </select>
                  ) : def.type === 'textarea' ? (
                    <textarea value={val} onChange={e => set(key, e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} />
                  ) : def.type === 'secret' ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type={revealed[key] ? 'text' : 'password'}
                        value={val} onChange={e => set(key, e.target.value)}
                        style={{ ...inp, flex: 1 }} autoComplete="off"
                      />
                      <button type="button" onClick={() => setRevealed(r => ({ ...r, [key]: !r[key] }))}
                        style={{ padding: '0 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.8rem', whiteSpace: 'nowrap' }}>
                        {revealed[key] ? tr(lang, 'dly_hide') : tr(lang, 'dly_show')}
                      </button>
                    </div>
                  ) : (
                    <input
                      type={def.type === 'number' || def.type === 'port' ? 'number' : def.type === 'date' ? 'date' : def.type === 'datetime' ? 'datetime-local' : 'text'}
                      value={val} onChange={e => set(key, e.target.value)} style={inp}
                    />
                  )}
                  {isSecret && val && !correcting && delivered && (
                    <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: 4 }}>
                      {tr(lang, 'dly_stored_masked')}: {maskSecret(val)}{' '}
                      <button type="button" onClick={() => copyVal(key, val)} style={{ background: 'none', border: 'none', color: '#4da3ff', cursor: 'pointer', padding: 0 }}>
                        {copied === key ? tr(lang, 'dly_copied') : tr(lang, 'dly_copy')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {category === 'dollar' && dollarPreview !== null && (
            <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 9, background: 'rgba(0,206,201,.08)', border: '1px solid rgba(0,206,201,.3)', fontSize: '.88rem', color: '#fff' }}>
              {tr(lang, 'dly_computed_final')}: <b>৳{dollarPreview.toLocaleString('en-IN')}</b>
              <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}> — {tr(lang, 'dly_computed_note')}</span>
            </div>
          )}

          {correcting && (
            <div style={{ marginTop: 14 }}>
              <label style={lbl}>{tr(lang, 'dly_correction_reason')} *</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder={tr(lang, 'dly_correction_reason_ph')} />
            </div>
          )}

          {showFailBox && (
            <div style={{ marginTop: 14 }}>
              <label style={lbl}>{tr(lang, 'dly_failure_reason')} *</label>
              <textarea value={failReason} onChange={e => setFailReason(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder={tr(lang, 'dly_failure_reason_ph')} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            {!delivered && !correcting && (<>
              <button onClick={() => doSubmit('draft')} disabled={busy} style={btn('rgba(255,255,255,.08)')}>{tr(lang, 'dly_save_draft')}</button>
              <button onClick={() => doSubmit('deliver')} disabled={busy} style={{ ...btn('#2ecc71'), flex: 1 }}>{busy ? tr(lang, 'adm_orders_processing') : tr(lang, 'dly_submit')}</button>
              <button onClick={() => { setShowFailBox(true) }} disabled={busy} style={btn('rgba(232,35,42,.15)', '#ff8a8a')}>{tr(lang, 'dly_record_failure')}</button>
            </>)}
            {showFailBox && !delivered && (
              <button onClick={doFail} disabled={busy} style={{ ...btn('#e8232a'), flex: 1 }}>{tr(lang, 'dly_confirm_failure')}</button>
            )}
            {delivered && !correcting && (
              <button onClick={() => { setCorrecting(true); setFields(delivered.payload || {}) }} style={{ ...btn('rgba(245,185,66,.15)', '#f5b942'), flex: 1 }}>{tr(lang, 'dly_correct')}</button>
            )}
            {correcting && (
              <button onClick={doCorrect} disabled={busy} style={{ ...btn('#f5b942', '#000'), flex: 1 }}>{busy ? tr(lang, 'adm_orders_processing') : tr(lang, 'dly_save_correction')}</button>
            )}
            <button onClick={onClose} style={btn('transparent')}>{tr(lang, 'dly_close')}</button>
          </div>

          {deliveries.length > 1 && (
            <div style={{ marginTop: 20, borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 14 }}>
              <div style={{ fontWeight: 700, color: '#fff', marginBottom: 8, fontSize: '.9rem' }}>{tr(lang, 'dly_history')}</div>
              {deliveries.map(d => (
                <div key={d.id} style={{ fontSize: '.82rem', color: 'var(--muted)', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  {d.status} • {new Date(d.created_at).toLocaleString('en-GB')}
                  {d.correction_of ? ` • ${tr(lang, 'dly_replaces')} #${d.correction_of}` : ''}
                  {d.correction_reason ? ` • ${d.correction_reason}` : ''}
                  {d.failure_reason ? ` • ${d.failure_reason}` : ''}
                </div>
              ))}
            </div>
          )}
        </>)}
      </div>
    </div>
  )
  return createPortal(body, document.body)
}

function prefill(order, category) {
  const today = new Date().toISOString().slice(0, 10)
  if (category === 'course') return { course_title: order.item_name || '', enrollment_status: 'Active', access_start: today }
  if (category === 'dollar') return { fee: 0, transfer_status: 'Pending', rate_timestamp: new Date().toISOString().slice(0, 16) }
  return {}
}
