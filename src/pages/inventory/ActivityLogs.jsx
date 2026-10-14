import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'
import { tr } from '../../i18n/translations.js'
import { useLang } from '../../i18n/LanguageContext.jsx'

const MODULE_MAP = {
  product: 'Product', supplier: 'Supplier', purchase: 'Purchase', sales_order: 'Sales Order',
  service: 'Service', dollar_rate: 'Dollar Rate', dollar_txn: 'Dollar', expense: 'Expense',
  product_price: 'Product', member: 'Customer', course: 'Course', lesson: 'Course',
  site_settings: 'Settings', seminar: 'Seminar', order: 'Sales Order', user: 'Customer',
  admin: 'Admin', role: 'Settings', vps: 'VPS Plan', ip: 'Service', number: 'Service',
}
const moduleOf = (entityType) => MODULE_MAP[(entityType || '').toLowerCase()] || entityType || 'System'
const MODULE_KEY = {
  'Product': 'act_module_product', 'Supplier': 'act_module_supplier', 'Purchase': 'act_module_purchase',
  'Sales Order': 'act_module_sales_order', 'Service': 'act_module_service', 'Dollar Rate': 'act_module_dollar_rate',
  'Dollar': 'act_module_dollar', 'Expense': 'act_module_expense', 'Customer': 'act_module_customer',
  'Course': 'act_module_course', 'Settings': 'act_module_settings', 'Seminar': 'act_module_seminar',
  'Admin': 'act_module_admin', 'VPS Plan': 'act_module_vps', 'System': 'act_module_system',
}
const moduleLabel = (entityType, lang) => {
  const m = moduleOf(entityType)
  return MODULE_KEY[m] ? tr(lang, MODULE_KEY[m]) : m
}
const ACTION_KEY = {
  'Created': 'act_action_created', 'Deleted': 'act_action_deleted', 'Login': 'act_action_login',
  'Logout': 'act_action_logout', 'Order Updated': 'act_action_order_updated', 'Price Changed': 'act_action_price_changed',
  'Updated': 'act_action_updated', 'Changed': 'act_action_changed', 'Action': 'act_action_other',
}
const actionLabel = (label, lang) => ACTION_KEY[label] ? tr(lang, ACTION_KEY[label]) : label

function actionInfo(action) {
  const a = (action || '').toLowerCase()
  if (a.includes('.create') || a.endsWith('create') || a.includes('created')) return { label: 'Created', labelKey: 'act_action_created', color: '#2ecc71', bg: 'rgba(46,204,113,.15)', border: 'rgba(46,204,113,.4)' }
  if (a.includes('.delete') || a.includes('deleted') || a.includes('cancel')) return { label: 'Deleted', labelKey: 'act_action_deleted', color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', border: 'rgba(232,35,42,.4)' }
  if (a.includes('login')) return { label: 'Login', labelKey: 'act_action_login', color: '#f5b942', bg: 'rgba(245,185,66,.15)', border: 'rgba(245,185,66,.4)' }
  if (a.includes('logout')) return { label: 'Logout', labelKey: 'act_action_logout', color: '#f5b942', bg: 'rgba(245,185,66,.15)', border: 'rgba(245,185,66,.4)' }
  if (a.includes('status') || a.includes('order')) return { label: 'Order Updated', labelKey: 'act_action_order_updated', color: '#c084fc', bg: 'rgba(192,132,252,.15)', border: 'rgba(192,132,252,.4)' }
  if (a.includes('price') || a.includes('rate')) return { label: 'Price Changed', labelKey: 'act_action_price_changed', color: '#f5b942', bg: 'rgba(245,185,66,.15)', border: 'rgba(245,185,66,.4)' }
  if (a.includes('.update') || a.includes('updated') || a.includes('edit')) return { label: 'Updated', labelKey: 'act_action_updated', color: '#4da3ff', bg: 'rgba(77,163,255,.15)', border: 'rgba(77,163,255,.4)' }
  if (a.includes('changed') || a.includes('change')) return { label: 'Changed', labelKey: 'act_action_changed', color: '#f5b942', bg: 'rgba(245,185,66,.15)', border: 'rgba(245,185,66,.4)' }
  return { label: action || 'Action', labelKey: action ? null : 'act_action_other', color: '#c084fc', bg: 'rgba(192,132,252,.15)', border: 'rgba(192,132,252,.4)' }
}

function describe(log, lang) {
  const mod = moduleLabel(log.entity_type, lang)
  const act = actionInfo(log.action)
  const nv = log.new_values || {}
  const name = nv.name || nv.customer || nv.title || ''
  const idPart = log.entity_id ? ` #${log.entity_id}` : ''
  if (log.action?.toLowerCase().includes('login')) return tr(lang, 'act_desc_login')
  if (log.action?.toLowerCase().includes('logout')) return tr(lang, 'act_desc_logout')
  if (act.label === 'Created') return tr(lang, 'act_desc_created_a') + mod + (name ? ` "${name}"` : idPart) + tr(lang, 'act_desc_created_b')
  if (act.label === 'Deleted') return tr(lang, 'act_desc_deleted_a') + mod + (name ? ` "${name}"` : idPart) + tr(lang, 'act_desc_deleted_b')
  if (act.label === 'Updated') return tr(lang, 'act_desc_updated_a') + mod + (name ? ` "${name}"` : idPart) + tr(lang, 'act_desc_updated_b')
  if (act.label === 'Price Changed') return tr(lang, 'act_desc_price_a') + mod + tr(lang, 'act_desc_price_mid') + idPart + tr(lang, 'act_desc_price_b')
  if (act.label === 'Order Updated') return tr(lang, 'act_desc_order_a') + idPart + tr(lang, 'act_desc_order_b')
  return (act.labelKey ? tr(lang, act.labelKey) : act.label) + ' ' + mod + idPart
}

const CRITICAL_ACTIONS = ['delete', 'cancel', 'refund', 'price', 'rate_set', 'role', 'permission', 'admin']

export function ActivityLogs({ session, role }) {
  const { lang } = useLang()
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
    list = list.filter(l => (l.cashskillbd_profiles?.email || '').toLowerCase().includes(q) || (l.action || '').toLowerCase().includes(q) || moduleOf(l.entity_type).toLowerCase().includes(q) || describe(l, lang).toLowerCase().includes(q) || JSON.stringify(l.new_values || {}).toLowerCase().includes(q))
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
    if (data.length === 0) return alert(tr(lang, 'act_err_no_export'))
    const header = tr(lang, 'act_csv_header') + '\n'
    const rows = data.map(l => `${new Date(l.created_at).toLocaleString('en-GB')},"${l.cashskillbd_profiles?.email || ''}",${actionInfo(l.action).label},${moduleOf(l.entity_type)},"${describe(l, lang).replace(/"/g, '""')}",${l.entity_id || ''},${tr(lang, 'act_status_success')}`).join('\n')
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
    { label: tr(lang, 'act_stat_total'), value: totalActivities.toLocaleString(), desc: tr(lang, 'act_stat_total_desc'), color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '📋' },
    { label: tr(lang, 'act_stat_admins'), value: activeAdmins.toLocaleString(), desc: tr(lang, 'act_stat_admins_desc'), color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '👥' },
    { label: tr(lang, 'act_stat_critical'), value: criticalActivities.toLocaleString(), desc: tr(lang, 'act_stat_critical_desc'), color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '🛡' },
    { label: tr(lang, 'act_stat_today'), value: todayActivities.toLocaleString(), desc: tr(lang, 'act_stat_today_desc'), color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '🕐' },
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
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>{tr(lang, 'act_title')}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'act_subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => exportCSV(false)} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>↓ {tr(lang, 'act_export_logs')}</button>
          {selected.size > 0 && (
            <button onClick={() => exportCSV(true)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(46,204,113,.4)', background: 'rgba(46,204,113,.1)', color: '#2ecc71', cursor: 'pointer', fontSize: '.85rem', fontWeight: 600 }}>{tr(lang, 'act_export_selected')} ({selected.size})</button>
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
        <input placeholder={tr(lang, 'act_search_ph')} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 220, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
        <select value={moduleF} onChange={e => { setModuleF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 140 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'act_all_modules')}</option>
          {modules.map(m => <option key={m} value={m} style={{ background: '#1a0d0e' }}>{MODULE_KEY[m] ? tr(lang, MODULE_KEY[m]) : m}</option>)}
        </select>
        <select value={actionF} onChange={e => { setActionF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 140 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'act_all_actions')}</option>
          {actions.map(a => <option key={a} value={a} style={{ background: '#1a0d0e' }}>{actionLabel(a, lang)}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 9, padding: '6px 10px' }}>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '.85rem', colorScheme: 'dark' }} />
          <span style={{ color: 'var(--muted)', fontSize: '.82rem' }}>{tr(lang, 'act_to')}</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '.85rem', colorScheme: 'dark' }} />
        </div>
        <button onClick={load} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.85rem' }}>{tr(lang, 'act_filter')}</button>
        <button onClick={clearFilters} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>{tr(lang, 'act_reset')}</button>
      </div>

      {/* Table */}
      <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}><input type="checkbox" checked={pageItems.length > 0 && selected.size === pageItems.length} onChange={toggleSelectAll} style={{ accentColor: '#e8232a' }} /></th>
                {['#', tr(lang, 'act_th_date'), tr(lang, 'act_th_admin'), tr(lang, 'act_th_action'), tr(lang, 'act_th_module'), tr(lang, 'act_th_entity'), tr(lang, 'act_th_ip'), tr(lang, 'act_th_status'), tr(lang, 'act_th_actions')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((l, i) => {
                const ai = actionInfo(l.action)
                const email = l.cashskillbd_profiles?.email || tr(lang, 'act_admin') + ' ' + String(l.actor_id || '').slice(0, 8)
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
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.74rem', fontWeight: 600, background: ai.bg, color: ai.color, border: `1px solid ${ai.border}`, whiteSpace: 'nowrap' }}>{ai.labelKey ? tr(lang, ai.labelKey) : ai.label}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '.85rem', color: 'var(--silver)' }}>{moduleLabel(l.entity_type, lang)}</td>
                    <td style={{ padding: '12px 14px', fontSize: '.85rem', color: 'var(--silver)', maxWidth: 280 }}>{describe(l, lang)}</td>
                    <td style={{ padding: '12px 14px', fontSize: '.82rem', color: 'var(--muted)', fontFamily: 'monospace' }}>{l.ip_address || tr(lang, 'act_not_available')}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {isLogin ? (
                        <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.74rem', fontWeight: 600, background: 'rgba(77,163,255,.15)', color: '#4da3ff', border: '1px solid rgba(77,163,255,.4)' }}>● {tr(lang, 'act_status_info')}</span>
                      ) : (
                        <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.74rem', fontWeight: 600, background: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)' }}>● {tr(lang, 'act_status_success')}</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <button title={tr(lang, 'act_tip_view')} onClick={() => setDetail(l)} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer' }}>👁</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>{tr(lang, 'act_empty_title')}</div>
            <div style={{ fontSize: '.85rem' }}>{tr(lang, 'act_empty_sub')}</div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>{tr(lang, 'act_loading')}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{tr(lang, 'act_showing')} {list.length === 0 ? 0 : (curPage - 1) * pageSize + 1} {tr(lang, 'act_to')} {Math.min(curPage * pageSize, list.length)} {tr(lang, 'act_of')} {list.length.toLocaleString()} {tr(lang, 'act_activities_word')}</span>
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
              {[10, 25, 50, 100].map(n => <option key={n} value={n} style={{ background: '#1a0d0e' }}>{n} {tr(lang, 'act_per_page')}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setDetail(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{tr(lang, 'act_detail_title')}</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '.9rem' }}>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'act_detail_admin')} </span><b style={{ color: '#fff' }}>{detail.cashskillbd_profiles?.email || tr(lang, 'act_admin') + ' ' + String(detail.actor_id || '').slice(0, 8)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'act_detail_time')} </span>{new Date(detail.created_at).toLocaleString('en-GB')}</div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'act_detail_action')} </span><b style={{ color: '#fff' }}>{detail.action}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'act_detail_module')} </span><b style={{ color: '#fff' }}>{moduleLabel(detail.entity_type, lang)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'act_detail_entity')} </span><span style={{ color: 'var(--silver)' }}>{describe(detail, lang)}</span></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'act_detail_entity_id')} </span><b style={{ color: '#fff' }}>{detail.entity_id || tr(lang, 'act_not_available')}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'act_detail_ip')} </span><b style={{ color: '#fff' }}>{detail.ip_address || tr(lang, 'act_not_available')}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'act_detail_ua')} </span><span style={{ color: 'var(--silver)' }}>{detail.user_agent || tr(lang, 'act_not_available')}</span></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'act_detail_status')} </span><b style={{ color: '#2ecc71' }}>{tr(lang, 'act_status_success')}</b></div>
              {detail.old_values && (
                <div>
                  <span style={{ color: 'var(--muted)' }}>{tr(lang, 'act_detail_before')}</span>
                  <pre style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: 10, fontSize: '.78rem', color: 'var(--silver)', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(detail.old_values, null, 2)}</pre>
                </div>
              )}
              {detail.new_values && (
                <div>
                  <span style={{ color: 'var(--muted)' }}>{tr(lang, 'act_detail_after')}</span>
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
