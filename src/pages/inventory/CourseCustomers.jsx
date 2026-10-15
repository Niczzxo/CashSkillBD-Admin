import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useLang } from '../../i18n/LanguageContext.jsx'
import { tr } from '../../i18n/translations.js'

export function CourseCustomers({ goSec }) {
  const { lang } = useLang()
  const [members, setMembers] = useState([])
  const [orders, setOrders] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [courseF, setCourseF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [countryF, setCountryF] = useState('all')
  const [dateF, setDateF] = useState('all')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)
  const PAGE_SIZE = 10

  const load = async () => {
    setLoading(true)
    const [{ data: profs }, { data: ords }, { data: crs }] = await Promise.all([
      supabase.from('cashskillbd_profiles').select('*').eq('role', 'member').order('created_at', { ascending: false }).limit(500),
      supabase.from('cashskillbd_orders').select('*').eq('status', 'confirmed').not('course_id', 'is', null).order('created_at', { ascending: false }).limit(2000),
      supabase.from('cashskillbd_courses').select('*'),
    ])
    setMembers(profs || [])
    setOrders(ords || [])
    setCourses(crs || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Match orders to members (by mobile or name) ──
  const ordersOf = (m) => orders.filter(o => {
    const mobile = String(m.phone || '').replace(/\D/g, '').slice(-10)
    const oMobile = String(o.mobile || '').replace(/\D/g, '').slice(-10)
    return (mobile && oMobile && mobile === oMobile) || (m.full_name && o.name && m.full_name.trim().toLowerCase() === o.name.trim().toLowerCase())
  })

  // ── Only members with ≥1 verified course purchase ──
  const customers = members
    .map(m => {
      const co = ordersOf(m)
      if (co.length === 0) return null
      const sorted = [...co].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      return {
        ...m,
        _courseOrders: co,
        _count: co.length,
        _spent: co.reduce((s, o) => s + Number(o.price || 0), 0),
        _last: sorted[0],
      }
    })
    .filter(Boolean)

  // ── Stats ──
  const totalCustomers = customers.length
  const totalPurchases = orders.length
  const totalRevenue = customers.reduce((s, c) => s + c._spent, 0)
  const avgSpending = totalCustomers > 0 ? Math.round(totalRevenue / totalCustomers) : 0

  // ── Filters ──
  let list = customers
  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter(c => (c.member_id || '').toLowerCase().includes(q) || (c.full_name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.phone || '').includes(q))
  }
  if (courseF !== 'all') list = list.filter(c => c._courseOrders.some(o => String(o.course_id) === String(courseF)))
  if (statusF !== 'all') list = list.filter(c => (c.is_active === false ? 'suspended' : 'active') === statusF)
  if (dateF !== 'all') {
    const days = dateF === 'today' ? 1 : dateF === 'week' ? 7 : 30
    const cutoff = new Date(Date.now() - days * 864e5)
    list = list.filter(c => new Date(c.created_at) >= cutoff)
  }

  const clearFilters = () => { setSearch(''); setCourseF('all'); setStatusF('all'); setCountryF('all'); setDateF('all'); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const curPage = Math.min(page, totalPages)
  const pageItems = list.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE)

  const fmt = (n) => '৳' + Number(n || 0).toLocaleString('en-IN')
  const courseName = (cid) => courses.find(c => String(c.id) === String(cid))?.title || `${tr(lang, 'cc_course_hash')}${cid}`

  const exportCSV = () => {
    const header = 'Member ID,Name,Email,Phone,Courses Purchased,Total Spent,Joined Date\n'
    const rows = list.map(c => `${c.member_id || ''},"${c.full_name || ''}",${c.email || ''},${c.phone || ''},${c._count},${c._spent},${new Date(c.created_at).toLocaleDateString('en-GB')}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'course-customers.csv'; document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 500)
    setExportOpen(false)
  }

  const selStyle = {
    padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 8, color: '#fff', fontSize: '.82rem', outline: 'none', cursor: 'pointer',
  }
  const actionBtn = (bg, border, color) => ({
    padding: '6px 8px', borderRadius: 7, border: `1px solid ${border}`, background: bg, color, cursor: 'pointer', fontSize: 13, marginRight: 4,
  })

  const stats = [
    { label: tr(lang, 'cc_total_customers'), value: totalCustomers.toLocaleString(), desc: tr(lang, 'cc_total_customers_desc'), color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '👥' },
    { label: tr(lang, 'cc_total_purchases'), value: totalPurchases.toLocaleString(), desc: tr(lang, 'cc_total_purchases_desc'), color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '📖' },
    { label: tr(lang, 'cc_total_revenue'), value: fmt(totalRevenue), desc: tr(lang, 'cc_total_revenue_desc'), color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '💰' },
    { label: tr(lang, 'cc_avg_spending'), value: fmt(avgSpending), desc: tr(lang, 'cc_avg_spending_desc'), color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '🏆' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>🎓</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>{tr(lang, 'cc_title')}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'cc_subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
          <button onClick={() => setExportOpen(!exportOpen)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem' }}>
            ↓ {tr(lang, 'cc_export')} ▾
          </button>
          {exportOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 130, marginTop: 6, background: '#1a0d0e', border: '1px solid rgba(232,35,42,.4)', borderRadius: 10, padding: 6, zIndex: 10, minWidth: 150 }}>
              <button onClick={exportCSV} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>{tr(lang, 'cc_export_csv')}</button>
            </div>
          )}
          <button onClick={() => goSec ? goSec('lessons') : alert(tr(lang, 'cc_alert_courses_managed'))} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>
            {tr(lang, 'cc_view_all_courses')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: 200, background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: `1px solid ${s.color}55`, borderRadius: 14, padding: 18, display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: s.bg, display: 'grid', placeItems: 'center', fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{s.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>{s.desc}</div>
            </div>
            <span style={{ position: 'absolute', top: 14, right: 14, color: s.color, fontSize: 16 }}>→</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
        <input placeholder={tr(lang, 'cc_search_placeholder')} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 220, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
        <select value={courseF} onChange={e => { setCourseF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'cc_all_courses')}</option>
          {courses.map(c => <option key={c.id} value={c.id} style={{ background: '#1a0d0e' }}>{c.title}</option>)}
        </select>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'cc_all_statuses')}</option>
          <option value="active" style={{ background: '#1a0d0e' }}>{tr(lang, 'cc_active')}</option>
          <option value="suspended" style={{ background: '#1a0d0e' }}>{tr(lang, 'cc_suspended')}</option>
        </select>
        <select value={countryF} onChange={e => setCountryF(e.target.value)} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'cc_all_countries')}</option>
          <option value="bd" style={{ background: '#1a0d0e' }}>{tr(lang, 'cc_bangladesh')}</option>
        </select>
        <select value={dateF} onChange={e => { setDateF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'cc_all_time')}</option>
          <option value="today" style={{ background: '#1a0d0e' }}>{tr(lang, 'cc_today')}</option>
          <option value="week" style={{ background: '#1a0d0e' }}>{tr(lang, 'cc_last_7_days')}</option>
          <option value="month" style={{ background: '#1a0d0e' }}>{tr(lang, 'cc_last_30_days')}</option>
        </select>
        <button onClick={clearFilters} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontSize: '.85rem', fontWeight: 600 }}>{tr(lang, 'cc_clear_filters')}</button>
        <button onClick={load} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>{tr(lang, 'cc_refresh')}</button>
      </div>

      {/* Table */}
      <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.3)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                {[tr(lang, 'cc_th_hash'), tr(lang, 'cc_th_profile'), tr(lang, 'cc_th_member_id'), tr(lang, 'cc_th_name'), tr(lang, 'cc_th_email'), tr(lang, 'cc_th_phone'), tr(lang, 'cc_th_courses_purchased'), tr(lang, 'cc_th_last_course'), tr(lang, 'cc_th_total_spent'), tr(lang, 'cc_th_status'), tr(lang, 'cc_th_joined_date'), tr(lang, 'cc_th_actions')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '.85rem' }}>{(curPage - 1) * PAGE_SIZE + i + 1}</td>
                  <td style={{ padding: '12px 14px' }}>
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(232,35,42,.2)', display: 'grid', placeItems: 'center', color: '#ff6b6b', fontSize: '.8rem', fontWeight: 700 }}>
                        {(c.full_name || '?').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '.82rem', color: '#fff', fontWeight: 600, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{c.member_id || '—'}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: '#fff', fontSize: '.88rem', whiteSpace: 'nowrap' }}>{c.full_name || '—'}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--silver)', fontSize: '.82rem' }}>{c.email}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--silver)', fontSize: '.82rem', whiteSpace: 'nowrap' }}>{c.phone || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.78rem', fontWeight: 600, background: 'rgba(192,132,252,.12)', color: '#c084fc', border: '1px solid rgba(192,132,252,.4)', whiteSpace: 'nowrap' }}>
                      {c._count} {c._count > 1 ? tr(lang, 'cc_courses') : tr(lang, 'cc_course')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: '.85rem', color: '#fff', whiteSpace: 'nowrap' }}>{courseName(c._last.course_id)}</div>
                    <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>{new Date(c._last.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#fff', fontSize: '.88rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(c._spent)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    {c.is_active === false ? (
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: 'rgba(232,35,42,.15)', color: '#ff6b6b', border: '1px solid rgba(232,35,42,.4)' }}>● {tr(lang, 'cc_suspended')}</span>
                    ) : (
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)' }}>● {tr(lang, 'cc_active')}</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {new Date(c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}<br />
                    <span style={{ fontSize: '.72rem' }}>{new Date(c.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                    <button title={tr(lang, 'cc_view_details')} onClick={() => setDetail(c)} style={actionBtn('transparent', 'rgba(255,255,255,.15)', '#fff')}>👁</button>
                    <button title={tr(lang, 'cc_purchased_courses')} onClick={() => setDetail(c)} style={actionBtn('rgba(77,163,255,.1)', 'rgba(77,163,255,.4)', '#4da3ff')}>📖</button>
                    <button title={tr(lang, 'cc_purchase_history')} onClick={() => setDetail(c)} style={actionBtn('rgba(46,204,113,.1)', 'rgba(46,204,113,.4)', '#2ecc71')}>🧾</button>
                    <button title={tr(lang, 'cc_edit')} onClick={() => goSec ? goSec('members') : alert(tr(lang, 'cc_edit_via_members'))} style={actionBtn('rgba(245,185,66,.1)', 'rgba(245,185,66,.4)', '#f5b942')}>✏️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>{tr(lang, 'cc_no_customers')}</div>
            <div style={{ fontSize: '.85rem' }}>{tr(lang, 'cc_no_customers_desc')}</div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>{tr(lang, 'cc_loading')}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{tr(lang, 'cc_showing')} {list.length === 0 ? 0 : (curPage - 1) * PAGE_SIZE + 1} {tr(lang, 'cc_to')} {Math.min(curPage * PAGE_SIZE, list.length)} {tr(lang, 'cc_of')} {list.length.toLocaleString()} {tr(lang, 'cc_course_customers')}</span>
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
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setDetail(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{tr(lang, 'cc_detail_title')}</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '.9rem' }}>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'cc_name_label')}{' '}</span><b style={{ color: '#fff' }}>{detail.full_name || '—'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'cc_email_label')}{' '}</span><b style={{ color: '#fff' }}>{detail.email}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'cc_member_id_label')}{' '}</span><b style={{ color: '#fff' }}>{detail.member_id || '—'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'cc_courses_label')}{' '}</span><b style={{ color: '#fff' }}>{detail._count}</b> &nbsp; <span style={{ color: 'var(--muted)' }}>{tr(lang, 'cc_total_spent_label')}{' '}</span><b style={{ color: '#fff' }}>{fmt(detail._spent)}</b></div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, color: '#fff', marginBottom: 8 }}>{tr(lang, 'cc_purchased_courses')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {detail._courseOrders.map(o => (
                  <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255,255,255,.03)', borderRadius: 8, fontSize: '.85rem' }}>
                    <span style={{ color: '#fff' }}>{courseName(o.course_id)} — {o.item_name}</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{fmt(o.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
