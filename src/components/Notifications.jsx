import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '../i18n/LanguageContext.jsx'
import { tr } from '../i18n/translations.js'
import { supabase } from '../lib/supabase.js'

// Real notifications derived from live tables — never fabricated.
// Sources: course orders (enrollments), orders (payments), identity verifications
// via /api/admin (documents), sales orders (product orders).
// Tickets are intentionally excluded: the Tickets section was removed from the
// sidebar by the user, so there is no destination for a ticket notification.
// Read state persists per-browser in localStorage (no notifications table exists).
const READ_KEY = 'csbd-admin-notif-read-v1'

async function adminApi(session, action, payload = {}) {
  const r = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload }),
  })
  const txt = await r.text()
  let j = null
  try { j = JSON.parse(txt) } catch { throw new Error('API unavailable') }
  if (!r.ok) throw new Error(j.error || 'failed')
  return j
}

function loadRead() {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')) } catch { return new Set() }
}
function saveRead(set) {
  try { localStorage.setItem(READ_KEY, JSON.stringify([...set])) } catch { /* storage unavailable */ }
}

export function Notifications({ session, goSec }) {
  const { lang } = useLang()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [read, setRead] = useState(loadRead)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [courseOrders, allOrders, salesOrders, enrollments] = await Promise.all([
        supabase.from('cashskillbd_orders').select('id, name, item_name, created_at').not('course_id', 'is', null).order('created_at', { ascending: false }).limit(5),
        supabase.from('cashskillbd_orders').select('id, name, item_name, trx_id, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('cashskillbd_sales_orders').select('id, order_no, customer_name, created_at').order('created_at', { ascending: false }).limit(5),
        adminApi(session, 'enrollment.list').catch(() => null),
      ])
      const out = []
      ;(courseOrders.data || []).forEach(o => out.push({
        id: `enroll-${o.id}`, type: 'enrollment', title: tr(lang, 'nav_notif_enrollment'),
        text: `${o.name || '—'} ${tr(lang, 'nav_notif_enrolled_in')} ${o.item_name || ''}`,
        created_at: o.created_at, sec: 'course-enrollments',
      }))
      ;(allOrders.data || []).forEach(o => out.push({
        id: `pay-${o.id}`, type: 'payment', title: tr(lang, 'nav_notif_payment'),
        text: `${tr(lang, 'nav_search_order')} #CSB-${String(o.id).padStart(6, '0')}${o.trx_id ? ` • ${o.trx_id}` : ''}`,
        created_at: o.created_at, sec: 'orders',
      }))
      const idents = (enrollments?.items || []).filter(e => e.identity && e.identity.status === 'pending')
      idents.slice(0, 5).forEach(e => out.push({
        id: `doc-${e.id}`, type: 'document', title: tr(lang, 'nav_notif_document'),
        text: `${e.name || '—'} ${tr(lang, 'nav_notif_uploaded')} ${e.identity.doc_type === 'birth' ? 'Birth Certificate' : 'NID'}`,
        created_at: e.identity.created_at || e.created_at, sec: 'document-verification',
      }))
      ;(salesOrders.data || []).forEach(o => out.push({
        id: `prod-${o.id}`, type: 'product', title: tr(lang, 'nav_notif_product_order'),
        text: `${tr(lang, 'nav_search_order')} ${o.order_no || ('#CSB' + o.id)} • ${o.customer_name || '—'}`,
        created_at: o.created_at, sec: 'sales-orders',
      }))
      out.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      setItems(out.slice(0, 8))
    } catch {
      // Keep whatever was already shown; never render fake notifications.
    }
    setLoading(false)
  }, [session, lang])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open ])

  const unread = items.filter(i => !read.has(i.id)).length

  const markOne = (id) => {
    setRead(prev => { const next = new Set(prev); next.add(id); saveRead(next); return next })
  }
  const markAll = () => {
    setRead(prev => { const next = new Set(prev); items.forEach(i => next.add(i.id)); saveRead(next); return next })
  }
  const clickItem = (it) => {
    markOne(it.id)
    setOpen(false)
    goSec(it.sec)
  }

  const relTime = (iso) => {
    if (!iso) return ''
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return tr(lang, 'nav_time_just')
    if (mins < 60) return `${mins} ${tr(lang, 'nav_time_min')}`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return hrs === 1 ? `1 ${tr(lang, 'nav_time_hour')}` : `${hrs} ${tr(lang, 'nav_time_hours')}`
    const days = Math.floor(hrs / 24)
    return days === 1 ? `1 ${tr(lang, 'nav_time_day')}` : `${days} ${tr(lang, 'nav_time_days')}`
  }

  const typeStyle = (type) => {
    const map = {
      enrollment: { bg: 'rgba(232,67,147,.16)', fg: '#e84393', letter: 'E' },
      payment: { bg: 'rgba(46,204,113,.16)', fg: '#2ecc71', letter: '₳' },
      document: { bg: 'rgba(77,163,255,.16)', fg: '#4da3ff', letter: '▣' },
      product: { bg: 'rgba(245,185,66,.16)', fg: '#f5b942', letter: '▦' },
    }
    return map[type] || map.product
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) load() }}
        aria-label={tr(lang, 'nav_notifications')}
        style={{ position: 'relative', width: 42, height: 42, borderRadius: 11, border: '1px solid rgba(58,23,27,.9)', background: open ? 'rgba(255,48,58,.14)' : 'rgba(255,255,255,.04)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 19, height: 19, padding: '0 4px', borderRadius: 10, background: '#FF303A', color: '#fff', fontSize: '.66rem', fontWeight: 800, display: 'grid', placeItems: 'center', border: '2px solid #080405' }}>{unread > 99 ? '99+' : unread}</span>
        )}
      </button>
      {open && (
        <div style={{ position: 'fixed', top: 74, right: 12, width: 'min(400px, calc(100vw - 24px))', background: '#160B0D', border: '1px solid #3A171B', borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,.6)', zIndex: 130, overflow: 'hidden', maxHeight: 'min(520px, 80vh)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '.98rem' }}>{tr(lang, 'nav_notifications')}</span>
            <button onClick={markAll} style={{ background: 'none', border: 'none', color: '#FF303A', cursor: 'pointer', fontSize: '.8rem', fontWeight: 600 }}>{tr(lang, 'nav_mark_read')}</button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && items.length === 0 && <div style={{ padding: 22, textAlign: 'center', color: '#8D7B7F', fontSize: '.88rem' }}>{tr(lang, 'nav_search_loading')}</div>}
            {!loading && items.length === 0 && <div style={{ padding: 22, textAlign: 'center', color: '#8D7B7F', fontSize: '.88rem' }}>{tr(lang, 'nav_no_notif')}</div>}
            {items.map(it => {
              const st = typeStyle(it.type)
              const isUnread = !read.has(it.id)
              return (
                <button key={it.id} onClick={() => clickItem(it)} style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 11, padding: '12px 16px', background: isUnread ? 'rgba(255,48,58,.05)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,.04)', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: st.bg, color: st.fg, display: 'grid', placeItems: 'center', fontSize: '.85rem', fontWeight: 800, flexShrink: 0 }}>{st.letter}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#fff', fontSize: '.88rem', fontWeight: 600 }}>{it.title}</span>
                      <span style={{ marginLeft: 'auto', color: '#8D7B7F', fontSize: '.72rem', whiteSpace: 'nowrap' }}>{relTime(it.created_at)}</span>
                    </span>
                    <span style={{ display: 'block', color: '#C6B2B5', fontSize: '.8rem', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.text}</span>
                  </span>
                  {isUnread && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF303A', marginTop: 6, flexShrink: 0 }} />}
                </button>
              )
            })}
          </div>
          <button onClick={() => { setOpen(false); goSec('activity-logs') }} style={{ padding: '13px 16px', background: 'transparent', border: 'none', borderTop: '1px solid rgba(255,255,255,.06)', color: '#fff', cursor: 'pointer', fontSize: '.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {tr(lang, 'nav_view_all_notif')} <span>›</span>
          </button>
        </div>
      )}
    </div>
  )
}
