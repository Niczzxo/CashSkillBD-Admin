import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'

const MODULE_MAP = {
  product: 'Product', supplier: 'Supplier', purchase: 'Purchase', sales_order: 'Sales Order',
  service: 'Service', dollar_rate: 'Dollar Rate', dollar_txn: 'Dollar', expense: 'Expense',
  product_price: 'Product', member: 'Customer', course: 'Course', lesson: 'Course',
  site_settings: 'Settings', seminar: 'Seminar', order: 'Sales Order', user: 'Customer',
  admin: 'Admin', role: 'Settings', vps: 'VPS Plan', ip: 'Service', number: 'Service',
}
const moduleOf = (entityType) => MODULE_MAP[(entityType || '').toLowerCase()] || entityType || 'System'

function actionInfo(action) {
  const a = (action || '').toLowerCase()
  if (a.includes('.create') || a.endsWith('create') || a.includes('created')) return { label: 'Created', color: '#2ecc71', bg: 'rgba(46,204,113,.15)', border: 'rgba(46,204,113,.4)' }
  if (a.includes('.delete') || a.includes('deleted') || a.includes('cancel')) return { label: 'Deleted', color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', border: 'rgba(232,35,42,.4)' }
  if (a.includes('login')) return { label: 'Login', color: '#f5b942', bg: 'rgba(245,185,66,.15)', border: 'rgba(245,185,66,.4)' }
  if (a.includes('logout')) return { label: 'Logout', color: '#f5b942', bg: 'rgba(245,185,66,.15)', border: 'rgba(245,185,66,.4)' }
  if (a.includes('status') || a.includes('order')) return { label: 'Order Updated', color: '#c084fc', bg: 'rgba(192,132,252,.15)', border: 'rgba(192,132,252,.4)' }
  if (a.includes('price') || a.includes('rate')) return { label: 'Price Changed', color: '#f5b942', bg: 'rgba(245,185,66,.15)', border: 'rgba(245,185,66,.4)' }
  if (a.includes('.update') || a.includes('updated') || a.includes('edit')) return { label: 'Updated', color: '#4da3ff', bg: 'rgba(77,163,255,.15)', border: 'rgba(77,163,255,.4)' }
  if (a.includes('changed') || a.includes('change')) return { label: 'Changed', color: '#f5b942', bg: 'rgba(245,185,66,.15)', border: 'rgba(245,185,66,.4)' }
  return { label: action || 'Action', color: '#c084fc', bg: 'rgba(192,132,252,.15)', border: 'rgba(192,132,252,.4)' }
}

function describe(log) {
  const mod = moduleOf(log.entity_type)
  const act = actionInfo(log.action)
  const nv = log.new_values || {}
  const name = nv.name || nv.customer || nv.title || ''
  const idPart = log.entity_id ? ` #${log.entity_id}` : ''
  if (log.action?.toLowerCase().includes('login')) return 'Admin logged in to system'
  if (log.action?.toLowerCase().includes('logout')) return 'Admin logged out of system'
  if (act.label === 'Created') return `Created new ${mod.toLowerCase()}${name ? ` "${name}"` : idPart}`
  if (act.label === 'Deleted') return `Deleted ${mod.toLowerCase()}${name ? ` "${name}"` : idPart}`
  if (act.label === 'Updated') return `Updated ${mod.toLowerCase()}${name ? ` "${name}"` : idPart}`
  if (act.label === 'Price Changed') return `Updated ${mod.toLowerCase()} price${idPart}`
  if (act.label === 'Order Updated') return `Updated order status${idPart}`
  return `${act.label} ${mod.toLowerCase()}${idPart}`
}

const CRITICAL_ACTIONS = ['delete', 'cancel', 'refund', 'price', 'rate_set', 'role', 'permission', 'admin']

export function ActivityLogs({ session, role }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [moduleF, setModuleF] = useState('all')
  const [actionF, setActionF] = useState('all')
  const [from, setFrom] = useState(() => new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10))
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selected, setSelected] = useState(new Set())
  const [detail, setDetail] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const j = await manageApi(session, 'audit.list', { limit: 100, offset: 0 })
      setItems(j.items || [])
    } catch (e) { alert('❌ ' + e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Stats ──
  const totalActivities = items.length
  const activeAdmins = new Set(items.map(l => l.actor_id).filter(Boolean)).size
  const criticalActivities = items.filter(l => CRITICAL_ACTIONS.some(k => (l.action || '').toLowerCase().includes(k))).length
  const today = new Date().toISOString().slice(0, 10)
  const todayActivities = items.filter(l => (l.created_at || '').slice(0, 10) === today).length

  // ── Filters ──
  let list = items
  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter(l => (l.cashskillbd_profiles?.email || '').toLowerCase().includes(q) || (l.action || '').toLowerCase().includes(q) || moduleOf(l.entity_type).toLowerCase().includes(q) || describe(l).toLowerCase().includes(q) || JSON.stringify(l.new_values || {}).toLowerCase().includes(q))
  }
  if (moduleF !== 'all') list = list.filter(l => moduleOf(l.entity_type) === moduleF)
  if (actionF !== 'all') list = list.filter(l => actionInfo(l.action).label === actionF)
  list = list.filter(l => {
    const d = (l.created_at || '').slice(0, 10)
    return d >= from && d <= to
  })

  const clearFilters = () => { setSearch(''); setModuleF('all'); setActionF('all'); setFrom(new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)); setTo(new Date().toISOString().slice(0, 10)); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const pageItems = list.slice((curPage - 1) * pageSize, curPage * pageSize)

  const modules = [...new Set(items.map(l => moduleOf(l.entity_type)))]
  const actions = [...new Set(items.map(l => actionInfo(l.action).label))]

  const toggleSelect = (id) => {
    const s = new Set(selected)
    if (s.has(id)) s.delete(id); else s.add(id)
    setSelected(s)
  }
  const toggleSelectAll = () => {
    if (selected.size === pageItems.length) setSelected(new Set())
    else setSelected(new Set(pageItems.map(l => l.id)))
  }

  const exportCSV = (onlySelected = false) => {
    const data = onlySelected ? list.filter(l => selected.has(l.id)) : list
    if (data.length === 0) return alert('Export করার মতো কোনো record নেই')
    const header = 'Date,Admin,Action,Module,Entity / Details,Entity ID,Status\n'
    const rows = data.map(l => `${new Date(l.created_at).toLocaleString('en-GB')},"${l.cashskillbd_profiles?.email || ''}",${actionInfo(l.action).label},${moduleOf(l.entity_type)},"${describe(l).replace(/"/g, '""')}",${l.entity_id || ''},Success`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'activity-logs.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const avatarColors = ['#e8232a', '#4da3ff', '#2ecc71', '#f5b942', '#e84393', '#8e44ad', '#00cec9']
  const initials = (email) => {
    const name = (email || '').split('@')[0]
    return name.slice(0, 2).toUpperCase() || 'A'
  }

  const stats = [
    { label: 'Total Activities', value: totalActivities.toLocaleString(), desc: 'All recorded activities', color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '📋' },
    { label: 'Active Admins', value: activeAdmins.toLocaleString(), desc: 'Performed activities', color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '👥' },
    { label: 'Critical Activities', value: criticalActivities.toLocaleString(), desc: 'Important actions', color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '🛡' },
    { label: "Today's Activities", value: todayActivities.toLocaleString(), desc: 'Activities today', color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '🕐' },
  ]

  const selStyle = {
    padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 8, color: '#fff', fontSize: '.82rem', outline: 'none', cursor: 'pointer',
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>📋</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Activity Logs</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>Monitor and review recent admin activities across the system.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => exportCSV(false)} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>↓ Export Logs</button>
          {selected.size > 0 && (
            <button onClick={() => exportCSV(true)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(46,204,113,.4)', background: 'rgba(46,204,113,.1)', color: '#2ecc71', cursor: 'pointer', fontSize: '.85rem', fontWeight: 600 }}>Export Selected ({selected.size})</button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: 190, background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: `1px solid ${s.color}55`, borderRadius: 14, padding: 18, display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
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
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <input placeholder="Search by admin name, action, entity, or IP address…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 220, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
        <select value={moduleF} onChange={e => { setModuleF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 140 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Modules</option>
          {modules.map(m => <option key={m} value={m} style={{ background: '#1a0d0e' }}>{m}</option>)}
        </select>
        <select value={actionF} onChange={e => { setActionF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 140 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Actions</option>
          {actions.map(a => <option key={a} value={a} style={{ background: '#1a0d0e' }}>{a}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 9, padding: '6px 10px' }}>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '.85rem', colorScheme: 'dark' }} />
          <span style={{ color: 'var(--muted)', fontSize: '.82rem' }}>to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '.85rem', colorScheme: 'dark' }} />
        </div>
        <button onClick={load} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.85rem' }}>Filter</button>
        <button onClick={clearFilters} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>Reset</button>
      </div>

      {/* Table */}
      <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}><input type="checkbox" checked={pageItems.length > 0 && selected.size === pageItems.length} onChange={toggleSelectAll} style={{ accentColor: '#e8232a' }} /></th>
                {['#', 'Date & Time', 'Admin', 'Action', 'Module', 'Entity / Details', 'IP Address', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((l, i) => {
                const ai = actionInfo(l.action)
                const email = l.cashskillbd_profiles?.email || `Admin ${String(l.actor_id || '').slice(0, 8)}`
                const isLogin = (l.action || '').toLowerCase().includes('login')
                return (
                  <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <td style={{ padding: '12px 14px' }}><input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)} style={{ accentColor: '#e8232a' }} /></td>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '.85rem' }}>{(curPage - 1) * pageSize + i + 1}</td>
                    <td style={{ padding: '12px 14px', fontSize: '.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {new Date(l.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}<br />
                      <span style={{ fontSize: '.72rem' }}>{new Date(l.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarColors[String(l.actor_id || '').length % avatarColors.length], display: 'grid', placeItems: 'center', fontSize: '.7rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials(email)}</div>
                        <span style={{ color: '#fff', fontSize: '.85rem', fontWeight: 600 }}>{email}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.74rem', fontWeight: 600, background: ai.bg, color: ai.color, border: `1px solid ${ai.border}`, whiteSpace: 'nowrap' }}>{ai.label}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '.85rem', color: 'var(--silver)' }}>{moduleOf(l.entity_type)}</td>
                    <td style={{ padding: '12px 14px', fontSize: '.85rem', color: 'var(--silver)', maxWidth: 280 }}>{describe(l)}</td>
                    <td style={{ padding: '12px 14px', fontSize: '.82rem', color: 'var(--muted)', fontFamily: 'monospace' }}>{l.ip_address || 'Not available'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {isLogin ? (
                        <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.74rem', fontWeight: 600, background: 'rgba(77,163,255,.15)', color: '#4da3ff', border: '1px solid rgba(77,163,255,.4)' }}>● Info</span>
                      ) : (
                        <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.74rem', fontWeight: 600, background: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)' }}>● Success</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <button title="View" onClick={() => setDetail(l)} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer' }}>👁</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>কোনো activity log নেই</div>
            <div style={{ fontSize: '.85rem' }}>এই ফিল্টারে কোনো activity record পাওয়া যায়নি। Admin actions করলে এখানে log আসবে।</div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Showing {list.length === 0 ? 0 : (curPage - 1) * pageSize + 1} to {Math.min(curPage * pageSize, list.length)} of {list.length.toLocaleString()} activities</span>
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
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Activity Details</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '.9rem' }}>
              <div><span style={{ color: 'var(--muted)' }}>Admin: </span><b style={{ color: '#fff' }}>{detail.cashskillbd_profiles?.email || `Admin ${String(detail.actor_id || '').slice(0, 8)}`}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Timestamp: </span>{new Date(detail.created_at).toLocaleString('en-GB')}</div>
              <div><span style={{ color: 'var(--muted)' }}>Action: </span><b style={{ color: '#fff' }}>{detail.action}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Module: </span><b style={{ color: '#fff' }}>{moduleOf(detail.entity_type)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Entity / Details: </span><span style={{ color: 'var(--silver)' }}>{describe(detail)}</span></div>
              <div><span style={{ color: 'var(--muted)' }}>Entity ID: </span><b style={{ color: '#fff' }}>{detail.entity_id || 'Not available'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>IP Address: </span><b style={{ color: '#fff' }}>{detail.ip_address || 'Not available'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>User Agent: </span><span style={{ color: 'var(--silver)' }}>{detail.user_agent || 'Not available'}</span></div>
              <div><span style={{ color: 'var(--muted)' }}>Status: </span><b style={{ color: '#2ecc71' }}>Success</b></div>
              {detail.old_values && (
                <div>
                  <span style={{ color: 'var(--muted)' }}>Before Values:</span>
                  <pre style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: 10, fontSize: '.78rem', color: 'var(--silver)', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(detail.old_values, null, 2)}</pre>
                </div>
              )}
              {detail.new_values && (
                <div>
                  <span style={{ color: 'var(--muted)' }}>After Values:</span>
                  <pre style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: 10, fontSize: '.78rem', color: 'var(--silver)', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(detail.new_values, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
