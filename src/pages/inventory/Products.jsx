import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { manageApi } from '../../lib/manageApi.js'
import { useLang } from '../../i18n/LanguageContext.jsx'
import { tr } from '../../i18n/translations.js'

const blankForm = {
  sku: '', name: '', description: '', category: 'general', product_type: 'physical',
  supplier_id: '', purchase_cost: '', selling_price: '', currency: 'BDT',
  stock_qty: '0', low_stock_at: '5', image_url: '', service_duration_days: '',
}


export function Products({ session, role }) {
  const { lang } = useLang()
  const CATEGORY_STYLES = {
    vps: { bg: 'rgba(192,132,252,.12)', color: '#c084fc', border: 'rgba(192,132,252,.4)', label: tr(lang, 'prod_cat_vps') },
    ip: { bg: 'rgba(77,163,255,.12)', color: '#4da3ff', border: 'rgba(77,163,255,.4)', label: tr(lang, 'prod_cat_ip') },
    dollar: { bg: 'rgba(46,204,113,.12)', color: '#2ecc71', border: 'rgba(46,204,113,.4)', label: tr(lang, 'prod_cat_dollar') },
    number: { bg: 'rgba(245,185,66,.12)', color: '#f5b942', border: 'rgba(245,185,66,.4)', label: tr(lang, 'prod_cat_number') },
    course: { bg: 'rgba(192,132,252,.12)', color: '#c084fc', border: 'rgba(192,132,252,.4)', label: tr(lang, 'prod_cat_course') },
    account: { bg: 'rgba(232,35,42,.12)', color: '#ff6b6b', border: 'rgba(232,35,42,.4)', label: tr(lang, 'prod_cat_account') },
    service: { bg: 'rgba(0,206,201,.12)', color: '#00cec9', border: 'rgba(0,206,201,.4)', label: tr(lang, 'prod_cat_service') },
  }
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catF, setCatF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [stockF, setStockF] = useState('all')
  const [dateF, setDateF] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selected, setSelected] = useState(new Set())
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [detail, setDetail] = useState(null)

  // Escape closes the open modal (Detail / Add-Edit) — must sit BELOW the
  // useState declarations: the deps array [detail, showForm] is evaluated
  // at the useEffect call, so placing it above would throw a TDZ ReferenceError.
  useEffect(() => {
    if (!detail && !showForm) return
    const onKey = (e) => { if (e.key === 'Escape') { setDetail(null); setShowForm(false) } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [detail, showForm])
  const [busy, setBusy] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const j = await manageApi(session, 'product.list', { limit: 500, offset: 0 })
      setItems(j.items || [])
    } catch (e) { alert(tr(lang, 'prod_error_prefix') + e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Stats ──
  const total = items.length
  const active = items.filter(p => p.status === 'active').length
  const outOfStock = items.filter(p => Number(p.stock_qty || 0) <= 0).length
  const inactive = items.filter(p => p.status !== 'active').length

  // ── Filters ──
  let list = items
  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter(p => (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
  }
  if (catF !== 'all') list = list.filter(p => (p.category || 'general') === catF || (p.product_type || '') === catF)
  if (statusF !== 'all') list = list.filter(p => p.status === statusF)
  if (stockF !== 'all') {
    if (stockF === 'out') list = list.filter(p => Number(p.stock_qty || 0) <= 0)
    else if (stockF === 'low') list = list.filter(p => Number(p.stock_qty || 0) > 0 && Number(p.stock_qty || 0) <= Number(p.low_stock_at || 5))
    else if (stockF === 'in') list = list.filter(p => Number(p.stock_qty || 0) > Number(p.low_stock_at || 5))
  }
  if (dateF !== 'all') {
    const days = dateF === 'today' ? 1 : dateF === 'week' ? 7 : 30
    const cutoff = new Date(Date.now() - days * 864e5)
    list = list.filter(p => new Date(p.created_at) >= cutoff)
  }

  const clearFilters = () => { setSearch(''); setCatF('all'); setStatusF('all'); setStockF('all'); setDateF('all'); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const pageItems = list.slice((curPage - 1) * pageSize, curPage * pageSize)

  const categories = [...new Set(items.map(p => p.category || 'general'))]

  const fmt = (p) => `${p.currency === 'USD' ? '$' : '৳'}${Number(p.selling_price || 0).toLocaleString('en-IN')}`
  const catStyle = (cat) => CATEGORY_STYLES[(cat || '').toLowerCase()] || { bg: 'rgba(255,255,255,.06)', color: 'var(--silver)', border: 'rgba(255,255,255,.15)', label: cat || tr(lang, 'prod_cat_general') }

  const toggleStatus = async (p) => {
    setBusy(p.id)
    try {
      await manageApi(session, 'product.set_status', { id: p.id, status: p.status === 'active' ? 'inactive' : 'active' })
      load()
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const del = async (p) => {
    if (!confirm(tr(lang, 'prod_delete_confirm_start') + p.name + tr(lang, 'prod_delete_confirm_end'))) return
    setBusy(p.id)
    try {
      await manageApi(session, 'product.delete', { id: p.id })
      load()
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const duplicate = async (p) => {
    setBusy(p.id)
    try {
      await manageApi(session, 'product.create', {
        sku: (p.sku || '') + '-COPY', name: p.name + ' ' + tr(lang, 'prod_copy_suffix'), description: p.description,
        category: p.category, product_type: p.product_type, selling_price: p.selling_price,
        currency: p.currency, stock_qty: p.stock_qty, low_stock_at: p.low_stock_at,
        image_url: p.image_url, purchase_cost: p.purchase_cost,
      })
      load()
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return alert(tr(lang, 'prod_alert_name_required'))
    setBusy('save')
    try {
      if (editing) {
        await manageApi(session, 'product.update', { id: editing.id, ...form })
      } else {
        await manageApi(session, 'product.create', form)
      }
      setShowForm(false); setEditing(null); setForm(blankForm)
      load()
    } catch (ex) { alert(tr(lang, 'prod_error_prefix') + ex.message) }
    setBusy(null)
  }

  const openEdit = (p) => {
    setEditing(p)
    setForm({
      sku: p.sku || '', name: p.name || '', description: p.description || '',
      category: p.category || 'general', product_type: p.product_type || 'physical',
      supplier_id: p.supplier_id ? String(p.supplier_id) : '',
      purchase_cost: p.purchase_cost ?? '', selling_price: p.selling_price ?? '',
      currency: p.currency || 'BDT', stock_qty: p.stock_qty ?? 0,
      low_stock_at: p.low_stock_at ?? 5, image_url: p.image_url || '',
      service_duration_days: p.service_duration_days || '',
    })
    setShowForm(true)
  }

  const exportCSV = () => {
    const header = 'SKU,Name,Category,Price,Stock,Status,Created Date\n'
    const rows = list.map(p => `${p.sku || ''},"${(p.name || '').replace(/"/g, '""')}",${p.category || ''},${p.selling_price || 0},${p.stock_qty || 0},${p.status || ''},${new Date(p.created_at).toLocaleDateString('en-GB')}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'products.csv'; document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 500)
    setExportOpen(false)
  }

  const toggleSelect = (id) => {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }
  const toggleSelectAll = () => {
    if (selected.size === pageItems.length) setSelected(new Set())
    else setSelected(new Set(pageItems.map(p => p.id)))
  }

  const selStyle = {
    padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 8, color: '#fff', fontSize: '.82rem', outline: 'none', cursor: 'pointer',
  }
  const actionBtn = (bg, border, color) => ({
    padding: '6px 8px', borderRadius: 7, border: `1px solid ${border}`, background: bg, color, cursor: 'pointer', fontSize: 13, marginRight: 3,
  })
  const inp = {
    width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 9, color: '#fff', fontSize: '.9rem', outline: 'none', boxSizing: 'border-box',
  }
  const lbl = { display: 'block', fontSize: '.82rem', color: 'var(--silver)', marginBottom: 5, fontWeight: 500 }

  const stats = [
    { label: tr(lang, 'prod_total_products'), value: total.toLocaleString(), desc: tr(lang, 'prod_total_products_desc'), color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '📦' },
    { label: tr(lang, 'prod_active_products'), value: active.toLocaleString(), desc: tr(lang, 'prod_active_products_desc'), color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '🏷' },
    { label: tr(lang, 'prod_out_of_stock'), value: outOfStock.toLocaleString(), desc: tr(lang, 'prod_out_of_stock_desc'), color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '📦' },
    { label: tr(lang, 'prod_inactive_products'), value: inactive.toLocaleString(), desc: tr(lang, 'prod_inactive_products_desc'), color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '📁' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>📦</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>{tr(lang, 'prod_title')}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'prod_subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
          <button onClick={() => setExportOpen(!exportOpen)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem' }}>
            ↓ {tr(lang, 'prod_export')} ▾
          </button>
          {exportOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 140, marginTop: 6, background: '#1a0d0e', border: '1px solid rgba(232,35,42,.4)', borderRadius: 10, padding: 6, zIndex: 10, minWidth: 150 }}>
              <button onClick={exportCSV} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>{tr(lang, 'prod_export_csv')}</button>
            </div>
          )}
          <button onClick={() => { setEditing(null); setForm(blankForm); setShowForm(true) }} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>
            + {tr(lang, 'prod_add_product')}
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
        <input placeholder={tr(lang, 'prod_search_placeholder')} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 220, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
        <select value={catF} onChange={e => { setCatF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'prod_all_categories')}</option>
          {categories.map(c => <option key={c} value={c} style={{ background: '#1a0d0e' }}>{c}</option>)}
        </select>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'prod_all_statuses')}</option>
          <option value="active" style={{ background: '#1a0d0e' }}>{tr(lang, 'prod_active')}</option>
          <option value="inactive" style={{ background: '#1a0d0e' }}>{tr(lang, 'prod_inactive')}</option>
        </select>
        <select value={stockF} onChange={e => { setStockF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'prod_all_stock_status')}</option>
          <option value="in" style={{ background: '#1a0d0e' }}>{tr(lang, 'prod_in_stock')}</option>
          <option value="low" style={{ background: '#1a0d0e' }}>{tr(lang, 'prod_low_stock')}</option>
          <option value="out" style={{ background: '#1a0d0e' }}>{tr(lang, 'prod_out_of_stock')}</option>
        </select>
        <select value={dateF} onChange={e => { setDateF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'prod_all_time')}</option>
          <option value="today" style={{ background: '#1a0d0e' }}>{tr(lang, 'prod_today')}</option>
          <option value="week" style={{ background: '#1a0d0e' }}>{tr(lang, 'prod_last_7_days')}</option>
          <option value="month" style={{ background: '#1a0d0e' }}>{tr(lang, 'prod_last_30_days')}</option>
        </select>
        <button onClick={clearFilters} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontSize: '.85rem', fontWeight: 600 }}>{tr(lang, 'prod_clear_filters')}</button>
        <button onClick={load} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>{tr(lang, 'prod_refresh')}</button>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '10px 14px', background: 'rgba(232,35,42,.1)', border: '1px solid rgba(232,35,42,.3)', borderRadius: 10 }}>
          <span style={{ fontSize: '.85rem', color: '#fff' }}>{selected.size} {tr(lang, 'prod_selected')}</span>
          <button onClick={() => { setSelected(new Set()); }} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.82rem' }}>{tr(lang, 'prod_clear')}</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.3)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)' }}>#</th>
                <th style={{ padding: '12px 8px' }}><input type="checkbox" checked={pageItems.length > 0 && selected.size === pageItems.length} onChange={toggleSelectAll} style={{ accentColor: '#e8232a', cursor: 'pointer' }} /></th>
                {[tr(lang, 'prod_th_image'), tr(lang, 'prod_th_product_name'), tr(lang, 'prod_th_sku'), tr(lang, 'prod_th_category'), tr(lang, 'prod_th_price'), tr(lang, 'prod_th_stock'), tr(lang, 'prod_th_status'), tr(lang, 'prod_th_created_date'), tr(lang, 'prod_th_actions')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p, i) => {
                const stock = Number(p.stock_qty || 0)
                const lowAt = Number(p.low_stock_at || 5)
                const cs = catStyle(p.category)
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '.85rem' }}>{(curPage - 1) * pageSize + i + 1}</td>
                    <td style={{ padding: '12px 8px' }}><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} style={{ accentColor: '#e8232a', cursor: 'pointer' }} /></td>
                    <td style={{ padding: '12px 14px' }}>
                      {p.image_url ? (
                        <img src={p.image_url} alt="" style={{ width: 44, height: 44, borderRadius: 9, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: 9, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 20 }}>📦</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, color: '#fff', fontSize: '.9rem' }}>{p.name}</div>
                      <div style={{ fontSize: '.76rem', color: 'var(--muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description || '—'}</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.76rem', fontWeight: 600, background: 'rgba(255,255,255,.06)', color: 'var(--silver)', border: '1px solid rgba(255,255,255,.12)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{p.sku || '—'}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.76rem', fontWeight: 600, background: cs.bg, color: cs.color, border: `1px solid ${cs.border}`, whiteSpace: 'nowrap' }}>{cs.label}</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#fff', fontSize: '.9rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(p)}</td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      {stock <= 0 ? (
                        <span style={{ color: '#ff6b6b', fontSize: '.85rem', fontWeight: 600 }}>● 0 {tr(lang, 'prod_in_stock_suffix')}</span>
                      ) : stock <= lowAt ? (
                        <span style={{ color: '#f5b942', fontSize: '.85rem', fontWeight: 600 }}>● {stock} {tr(lang, 'prod_in_stock_suffix')}</span>
                      ) : (
                        <span style={{ color: '#2ecc71', fontSize: '.85rem', fontWeight: 600 }}>● {stock} in stock</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <button onClick={() => toggleStatus(p)} disabled={busy === p.id} title={p.status === 'active' ? tr(lang, 'prod_deactivate') : tr(lang, 'prod_activate')} style={{
                        width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                        background: p.status === 'active' ? '#2ecc71' : '#555',
                        position: 'relative', transition: 'background .2s',
                      }}>
                        <span style={{
                          position: 'absolute', top: 3, left: p.status === 'active' ? 24 : 3,
                          width: 20, height: 20, borderRadius: '50%', background: '#fff',
                          transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.3)',
                        }} />
                      </button>
                      <span style={{ marginLeft: 8, fontSize: '.8rem', color: p.status === 'active' ? '#2ecc71' : 'var(--muted)', fontWeight: 600 }}>{p.status === 'active' ? tr(lang, 'prod_active') : tr(lang, 'prod_inactive')}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {new Date(p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}<br />
                      <span style={{ fontSize: '.72rem' }}>{new Date(p.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <button title={tr(lang, 'prod_view')} onClick={() => setDetail(p)} style={actionBtn('transparent', 'rgba(255,255,255,.15)', '#fff')}>👁</button>
                      <button title={tr(lang, 'prod_edit')} onClick={() => openEdit(p)} style={actionBtn('rgba(245,185,66,.1)', 'rgba(245,185,66,.4)', '#f5b942')}>✏️</button>
                      <button title={tr(lang, 'prod_duplicate')} onClick={() => duplicate(p)} disabled={busy === p.id} style={actionBtn('rgba(77,163,255,.1)', 'rgba(77,163,255,.4)', '#4da3ff')}>⧉</button>
                      <button title={tr(lang, 'prod_delete')} onClick={() => del(p)} disabled={busy === p.id} style={actionBtn('rgba(232,35,42,.1)', 'rgba(232,35,42,.4)', '#ff6b6b')}>🗑</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>{tr(lang, 'prod_no_products')}</div>
            <div style={{ fontSize: '.85rem' }}>{tr(lang, 'prod_no_products_desc')}</div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>{tr(lang, 'prod_loading')}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{tr(lang, 'prod_showing')} {list.length === 0 ? 0 : (curPage - 1) * pageSize + 1} {tr(lang, 'prod_to')} {Math.min(curPage * pageSize, list.length)} {tr(lang, 'prod_of')} {list.length.toLocaleString()} {tr(lang, 'prod_products')}</span>
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
              {[10, 20, 50].map(n => <option key={n} value={n} style={{ background: '#1a0d0e' }}>{n} {tr(lang, 'prod_per_page')}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {detail && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setDetail(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 500, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{tr(lang, 'prod_detail_title')}</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            {detail.image_url && <img src={detail.image_url} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 12, marginBottom: 14 }} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '.9rem' }}>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'prod_name_label')}{' '}</span><b style={{ color: '#fff' }}>{detail.name}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'prod_description_label')}{' '}</span><span style={{ color: 'var(--silver)' }}>{detail.description || '—'}</span></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'prod_sku_label')}{' '}</span><b style={{ color: '#fff' }}>{detail.sku || '—'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'prod_category_label')}{' '}</span><b style={{ color: '#fff' }}>{detail.category}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'prod_price_label')}{' '}</span><b style={{ color: '#fff' }}>{fmt(detail)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'prod_stock_label')}{' '}</span><b style={{ color: '#fff' }}>{detail.stock_qty ?? 0}</b> &nbsp; <span style={{ color: 'var(--muted)' }}>{tr(lang, 'prod_low_at_label')}{' '}</span><b style={{ color: '#fff' }}>{detail.low_stock_at ?? 5}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'prod_status_label')}{' '}</span><b style={{ color: '#fff' }}>{detail.status}</b></div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Add/Edit Modal */}
      {showForm && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setShowForm(false)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{editing ? tr(lang, 'prod_edit_product') : tr(lang, 'prod_add_product')}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>{tr(lang, 'prod_form_name_label')}</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp} placeholder={tr(lang, 'prod_form_name_placeholder')} /></div>
                <div><label style={lbl}>{tr(lang, 'prod_form_sku_label')}</label><input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} style={inp} placeholder={tr(lang, 'prod_form_sku_placeholder')} /></div>
              </div>
              <div><label style={lbl}>{tr(lang, 'prod_form_description_label')}</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder={tr(lang, 'prod_form_description_placeholder')} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>{tr(lang, 'prod_form_category_label')}</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                    {['general', 'vps', 'ip', 'dollar', 'number', 'course', 'account', 'service'].map(c => <option key={c} value={c} style={{ background: '#1a0d0e' }}>{tr(lang, 'prod_cat_' + c)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>{tr(lang, 'prod_form_type_label')}</label>
                  <select value={form.product_type} onChange={e => setForm({ ...form, product_type: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                    {['physical', 'service', 'ip', 'vps', 'number', 'course'].map(t => <option key={t} value={t} style={{ background: '#1a0d0e' }}>{tr(lang, 'prod_type_' + t)}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>{tr(lang, 'prod_form_selling_price')}</label><input type="number" step="0.01" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} style={inp} /></div>
                <div><label style={lbl}>{tr(lang, 'prod_form_purchase_cost')}</label><input type="number" step="0.01" value={form.purchase_cost} onChange={e => setForm({ ...form, purchase_cost: e.target.value })} style={inp} /></div>
                <div>
                  <label style={lbl}>{tr(lang, 'prod_form_currency')}</label>
                  <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                    <option value="BDT" style={{ background: '#1a0d0e' }}>BDT</option>
                    <option value="USD" style={{ background: '#1a0d0e' }}>USD</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>{tr(lang, 'prod_form_stock_qty')}</label><input type="number" value={form.stock_qty} onChange={e => setForm({ ...form, stock_qty: e.target.value })} style={inp} /></div>
                <div><label style={lbl}>{tr(lang, 'prod_form_low_stock_alert')}</label><input type="number" value={form.low_stock_at} onChange={e => setForm({ ...form, low_stock_at: e.target.value })} style={inp} /></div>
              </div>
              <div><label style={lbl}>{tr(lang, 'prod_form_image_url')}</label><input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} style={inp} placeholder="https://…" /></div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={busy === 'save'} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  {busy === 'save' ? tr(lang, 'prod_saving') : editing ? tr(lang, 'prod_update_product') : tr(lang, 'prod_add_product')}
                </button>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '11px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>{tr(lang, 'prod_cancel')}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
