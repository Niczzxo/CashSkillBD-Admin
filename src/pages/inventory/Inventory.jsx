import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'
import { useLang } from '../../i18n/LanguageContext.jsx'
import { tr } from '../../i18n/translations.js'


const catMeta = (c, lang) => {
  const meta = {
    vps: { label: tr(lang, 'inv_cat_vps'), color: '#c084fc', bg: 'rgba(192,132,252,.15)' },
    ip: { label: tr(lang, 'inv_cat_ip'), color: '#4da3ff', bg: 'rgba(77,163,255,.15)' },
    number: { label: tr(lang, 'inv_cat_number'), color: '#ff6b6b', bg: 'rgba(232,35,42,.15)' },
    course: { label: tr(lang, 'inv_cat_course'), color: '#2ecc71', bg: 'rgba(46,204,113,.15)' },
    dollar: { label: tr(lang, 'inv_cat_dollar'), color: '#f5b942', bg: 'rgba(245,185,66,.15)' },
    service: { label: tr(lang, 'inv_cat_service'), color: '#00cec9', bg: 'rgba(0,206,201,.15)' },
    account: { label: tr(lang, 'inv_cat_account'), color: '#e84393', bg: 'rgba(232,67,147,.15)' },
  }
  return meta[(c || '').toLowerCase()] || { label: c || tr(lang, 'inv_cat_other'), color: '#8e44ad', bg: 'rgba(142,68,173,.15)' }
}
const stockStatus = (p) => {
  const stock = Number(p.stock_qty || 0)
  const min = Number(p.low_stock_at ?? 5)
  if (stock <= 0) return 'out'
  if (stock <= min) return 'low'
  return 'in'
}
const statusMeta = (lang) => ({
  in: { label: tr(lang, 'inv_status_in'), color: '#2ecc71', bg: 'rgba(46,204,113,.15)', border: 'rgba(46,204,113,.4)' },
  low: { label: tr(lang, 'inv_status_low'), color: '#f5b942', bg: 'rgba(245,185,66,.15)', border: 'rgba(245,185,66,.4)' },
  out: { label: tr(lang, 'inv_status_out'), color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', border: 'rgba(232,35,42,.4)' },
})

export function Inventory({ session }) {
  const { lang } = useLang()
  const [products, setProducts] = useState([])
  const [moves, setMoves] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catF, setCatF] = useState('all')
  const [stockF, setStockF] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selected, setSelected] = useState(new Set())
  const [detail, setDetail] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', sku: '', description: '', category: 'VPS', selling_price: '', purchase_cost: '', currency: 'BDT', stock_qty: '', low_stock_at: '5', image_url: '' })
  const [showStock, setShowStock] = useState(null) // { products: [], direction }
  const [stockQty, setStockQty] = useState('')
  const [stockNotes, setStockNotes] = useState('')
  const [showMoves, setShowMoves] = useState(false)
  const [busy, setBusy] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [p, m] = await Promise.all([
        manageApi(session, 'product.list', { limit: 500, offset: 0 }),
        manageApi(session, 'stock.movements', { limit: 50, offset: 0 }).catch(() => ({ items: [] })),
      ])
      setProducts(p.items || [])
      setMoves(m.items || [])
    } catch (e) { alert(e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Stats ──
  const totalProducts = products.length
  const inStock = products.filter(p => stockStatus(p) === 'in').length
  const lowStock = products.filter(p => stockStatus(p) === 'low').length
  const outStock = products.filter(p => stockStatus(p) === 'out').length
  const totalValue = products.reduce((s, p) => s + Number(p.stock_qty || 0) * Number(p.purchase_cost || p.selling_price || 0), 0)

  // ── Filters ──
  let list = products
  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter(p => (p.sku || '').toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))
  }
  if (catF !== 'all') list = list.filter(p => (p.category || '').toLowerCase() === catF)
  if (stockF !== 'all') list = list.filter(p => stockStatus(p) === stockF)

  const clearFilters = () => { setSearch(''); setCatF('all'); setStockF('all'); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const pageItems = list.slice((curPage - 1) * pageSize, curPage * pageSize)

  const categories = [...new Set(products.map(p => (p.category || 'Other').toLowerCase()))]

  const toggleSelect = (id) => {
    const s = new Set(selected)
    if (s.has(id)) s.delete(id); else s.add(id)
    setSelected(s)
  }
  const toggleSelectAll = () => {
    if (selected.size === pageItems.length) setSelected(new Set())
    else setSelected(new Set(pageItems.map(p => p.id)))
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', sku: '', description: '', category: 'VPS', selling_price: '', purchase_cost: '', currency: 'BDT', stock_qty: '', low_stock_at: '5', image_url: '' })
    setShowForm(true)
  }
  const openEdit = (p) => {
    setEditing(p)
    setForm({
      name: p.name || '', sku: p.sku || '', description: p.description || '', category: p.category || 'VPS',
      selling_price: p.selling_price ?? '', purchase_cost: p.purchase_cost ?? '', currency: p.currency || 'BDT',
      stock_qty: p.stock_qty ?? '', low_stock_at: p.low_stock_at ?? 5, image_url: p.image_url || '',
    })
    setShowForm(true)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return alert(tr(lang, 'inv_product_name_required'))
    if (!form.sku.trim()) return alert(tr(lang, 'inv_sku_required'))
    setBusy('save')
    try {
      const payload = {
        name: form.name.trim(), sku: form.sku.trim(), description: form.description.trim(),
        category: form.category, selling_price: Number(form.selling_price) || 0,
        purchase_cost: Number(form.purchase_cost) || 0, currency: form.currency,
        stock_qty: Number(form.stock_qty) || 0, low_stock_at: Number(form.low_stock_at) || 0,
        image_url: form.image_url.trim() || null,
      }
      if (editing) await manageApi(session, 'product.update', { id: editing.id, ...payload })
      else await manageApi(session, 'product.create', { ...payload, product_type: form.category.toLowerCase() })
      setShowForm(false); setEditing(null)
      load()
      alert(tr(lang, 'inv_product_saved'))
    } catch (ex) { alert(ex.message) }
    setBusy(null)
  }

  const del = async (p) => {
    if (!confirm(`"${p.name}" ` + tr(lang, 'inv_delete_confirm'))) return
    setBusy(p.id)
    try { await manageApi(session, 'product.delete', { id: p.id }); load() }
    catch (e) { alert(e.message) }
    setBusy(null)
  }

  const adjustStock = async (e) => {
    e.preventDefault()
    if (!showStock) return
    const qty = Number(stockQty)
    if (!qty || qty <= 0) return alert(tr(lang, 'inv_valid_quantity'))
    if (showStock.direction === 'out') {
      const short = showStock.products.find(p => qty > Number(p.stock_qty || 0))
      if (short) return alert(`${tr(lang, 'inv_insufficient_stock')} ${short.name}: ${short.stock_qty}`)
    }
    setBusy('stock')
    try {
      const failed = []
      for (const p of showStock.products) {
        try {
          await manageApi(session, 'product.adjust_stock', {
            id: p.id, qty_change: qty, direction: showStock.direction,
            reason: 'adjustment', notes: stockNotes.trim() || undefined,
          })
        } catch (ex) { failed.push(`${p.name}: ${ex.message}`) }
      }
      setShowStock(null); setStockQty(''); setStockNotes('')
      load()
      if (failed.length) alert(failed.join('\n'))
      else alert(tr(lang, 'inv_stock_updated'))
    } catch (ex) { alert(ex.message) }
    setBusy(null)
  }

  const exportCSV = () => {
    const header = tr(lang, 'inv_col_sku') + ',' + tr(lang, 'inv_col_product') + ',' + tr(lang, 'inv_col_category') + ',' + tr(lang, 'inv_col_stock') + ',' + tr(lang, 'inv_csv_min_stock') + ',' + tr(lang, 'inv_col_status') + ',' + tr(lang, 'inv_col_unit_price') + ',' + tr(lang, 'inv_col_total_value') + ',' + tr(lang, 'inv_col_last_updated') + '\n'
    const rowsCsv = list.map(p => {
      const total = Number(p.stock_qty || 0) * Number(p.purchase_cost || p.selling_price || 0)
      return `"${p.sku || ''}","${p.name || ''}",${p.category || ''},${p.stock_qty || 0},${p.low_stock_at ?? 5},${statusMeta(lang)[stockStatus(p)].label},${p.selling_price || 0},${total},${new Date(p.updated_at || p.created_at).toLocaleString('en-GB')}`
    }).join('\n')
    const blob = new Blob([header + rowsCsv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'inventory.csv'; document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 500)
  }

  const inp = {
    width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 9, color: '#fff', fontSize: '.9rem', outline: 'none', boxSizing: 'border-box',
  }
  const lbl = { display: 'block', fontSize: '.82rem', color: 'var(--silver)', marginBottom: 5, fontWeight: 500 }
  const selStyle = {
    padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 8, color: '#fff', fontSize: '.82rem', outline: 'none', cursor: 'pointer',
  }

  const stats = [
    { label: tr(lang, 'inv_total_products'), value: totalProducts.toLocaleString(), desc: tr(lang, 'inv_total_products_desc'), color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '📦' },
    { label: tr(lang, 'inv_status_in'), value: inStock.toLocaleString(), desc: tr(lang, 'inv_in_stock_desc'), color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '📚' },
    { label: tr(lang, 'inv_status_low'), value: lowStock.toLocaleString(), desc: tr(lang, 'inv_low_stock_desc'), color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '⚠️' },
    { label: tr(lang, 'inv_status_out'), value: outStock.toLocaleString(), desc: tr(lang, 'inv_out_stock_desc'), color: '#ff6b6b', bg: 'rgba(232,35,42,.2)', icon: '📦' },
    { label: tr(lang, 'inv_total_value'), value: `৳ ${totalValue.toLocaleString('en-IN')}`, desc: tr(lang, 'inv_total_value_desc'), color: '#c084fc', bg: 'rgba(192,132,252,.15)', icon: '⇄' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>📦</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>{tr(lang, 'inv_title')}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'inv_subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={exportCSV} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem' }}>↓ {tr(lang, 'inv_export')}</button>
          <button onClick={() => { if (!selected.size) return alert(tr(lang, 'inv_select_product')); const ps = products.filter(x => selected.has(x.id)); setShowStock({ products: ps, direction: 'in' }) }} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(46,204,113,.4)', background: 'rgba(46,204,113,.1)', color: '#2ecc71', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem' }}>+ {tr(lang, 'inv_stock_in')}</button>
          <button onClick={() => { if (!selected.size) return alert(tr(lang, 'inv_select_product')); const ps = products.filter(x => selected.has(x.id)); setShowStock({ products: ps, direction: 'out' }) }} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(245,185,66,.4)', background: 'rgba(245,185,66,.1)', color: '#f5b942', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem' }}>← {tr(lang, 'inv_stock_out')}</button>
          <button onClick={openCreate} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>+ {tr(lang, 'inv_add_product')}</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: 170, background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: `1px solid ${s.color}55`, borderRadius: 14, padding: 18, display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
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
        <input placeholder={tr(lang, 'inv_search_placeholder')} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 220, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
        <select value={catF} onChange={e => { setCatF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 150 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'inv_all_categories')}</option>
          {categories.map(c => <option key={c} value={c} style={{ background: '#1a0d0e' }}>{catMeta(c, lang).label}</option>)}
        </select>
        <select value={stockF} onChange={e => { setStockF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 150 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'inv_all_statuses')}</option>
          <option value="in" style={{ background: '#1a0d0e' }}>{tr(lang, 'inv_status_in')}</option>
          <option value="low" style={{ background: '#1a0d0e' }}>{tr(lang, 'inv_status_low')}</option>
          <option value="out" style={{ background: '#1a0d0e' }}>{tr(lang, 'inv_status_out')}</option>
        </select>
        <button onClick={load} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.85rem' }}>{tr(lang, 'inv_filter')}</button>
        <button onClick={clearFilters} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>{tr(lang, 'inv_reset')}</button>
        <button onClick={load} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>{tr(lang, 'inv_refresh')}</button>
        <button onClick={() => setShowMoves(!showMoves)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>{showMoves ? tr(lang, 'inv_hide') : tr(lang, 'inv_show')} {tr(lang, 'inv_movements')}</button>
      </div>

      {/* Table */}
      <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}><input type="checkbox" checked={pageItems.length > 0 && selected.size === pageItems.length} onChange={toggleSelectAll} style={{ accentColor: '#e8232a' }} /></th>
                {['#', tr(lang, 'inv_col_sku'), tr(lang, 'inv_col_product'), tr(lang, 'inv_col_category'), tr(lang, 'inv_col_stock'), tr(lang, 'inv_col_min_stock'), tr(lang, 'inv_col_status'), tr(lang, 'inv_col_unit_price'), tr(lang, 'inv_col_total_value'), tr(lang, 'inv_col_last_updated'), tr(lang, 'inv_col_actions')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p, i) => {
                const st = stockStatus(p)
                const sm = statusMeta(lang)[st]
                const cm = catMeta(p.category, lang)
                const total = Number(p.stock_qty || 0) * Number(p.purchase_cost || p.selling_price || 0)
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <td style={{ padding: '12px 14px' }}><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} style={{ accentColor: '#e8232a' }} /></td>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '.85rem' }}>{(curPage - 1) * pageSize + i + 1}</td>
                    <td style={{ padding: '12px 14px' }}><span style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,.05)', fontSize: '.78rem', color: 'var(--silver)', fontFamily: 'monospace' }}>{p.sku || '—'}</span></td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {p.image_url ? (
                          <img src={p.image_url} alt="" style={{ width: 34, height: 34, borderRadius: 7, objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 34, height: 34, borderRadius: 7, background: cm.bg, display: 'grid', placeItems: 'center', fontSize: 16, flexShrink: 0 }}>{p.category?.toLowerCase() === 'vps' ? '🗄' : p.category?.toLowerCase() === 'ip' ? 'IP' : p.category?.toLowerCase() === 'number' ? '📞' : p.category?.toLowerCase() === 'course' ? '📖' : p.category?.toLowerCase() === 'dollar' ? '$' : '📦'}</div>
                        )}
                        <span style={{ color: '#fff', fontSize: '.88rem', fontWeight: 600 }}>{p.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}><span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.74rem', fontWeight: 600, background: cm.bg, color: cm.color }}>{cm.label}</span></td>
                    <td style={{ padding: '12px 14px', color: '#fff', fontSize: '.88rem', fontWeight: 600 }}>{p.stock_qty ?? 0}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--silver)', fontSize: '.85rem' }}>{p.low_stock_at ?? 5}</td>
                    <td style={{ padding: '12px 14px' }}><span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.74rem', fontWeight: 600, background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>{sm.label}</span></td>
                    <td style={{ padding: '12px 14px', color: '#fff', fontSize: '.88rem', whiteSpace: 'nowrap' }}>{p.currency === 'USD' ? '$' : '৳'} {Number(p.selling_price || 0).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px 14px', color: '#fff', fontSize: '.88rem', whiteSpace: 'nowrap' }}>৳ {total.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px 14px', fontSize: '.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {new Date(p.updated_at || p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}<br />
                      <span style={{ fontSize: '.72rem' }}>{new Date(p.updated_at || p.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <button title={tr(lang, 'inv_view')} onClick={() => setDetail(p)} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer', marginRight: 3 }}>👁</button>
                      <button title={tr(lang, 'inv_edit')} onClick={() => openEdit(p)} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(245,185,66,.4)', background: 'rgba(245,185,66,.1)', color: '#f5b942', cursor: 'pointer', marginRight: 3 }}>✏️</button>
                      <button title={tr(lang, 'inv_delete')} onClick={() => del(p)} disabled={busy === p.id} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer' }}>🗑</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>{search || catF !== 'all' || stockF !== 'all' ? tr(lang, 'inv_no_products_filtered') : tr(lang, 'inv_empty')}</div>
            <div style={{ fontSize: '.85rem' }}>{search || catF !== 'all' || stockF !== 'all' ? tr(lang, 'inv_no_products_filtered_hint') : tr(lang, 'inv_empty_hint')}</div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>{tr(lang, 'inv_loading')}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{tr(lang, 'inv_showing')} {list.length === 0 ? 0 : (curPage - 1) * pageSize + 1} {tr(lang, 'inv_to')} {Math.min(curPage * pageSize, list.length)} {tr(lang, 'inv_of')} {list.length.toLocaleString()} {tr(lang, 'inv_products_unit')}</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button onClick={() => setPage(Math.max(1, curPage - 1))} disabled={curPage <= 1} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: 'pointer', opacity: curPage <= 1 ? 0.4 : 1 }}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - curPage) <= 1).map((p, idx, arr) => (
              <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {idx > 0 && p - arr[idx - 1] > 1 && <span style={{ color: 'var(--muted)', padding: '0 2px' }}>…</span>}
                <button onClick={() => setPage(p)} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: p === curPage ? '#e8232a' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: p === curPage ? 700 : 400, fontSize: '.85rem' }}>{p}</button>
              </span>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, curPage + 1))} disabled={curPage >= totalPages} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: 'pointer', opacity: curPage >= totalPages ? 0.4 : 1 }}>›</button>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} style={{ marginLeft: 8, padding: '6px 8px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 7, color: '#fff', fontSize: '.82rem', cursor: 'pointer' }}>
              {[10, 25, 50].map(n => <option key={n} value={n} style={{ background: '#1a0d0e' }}>{n} {tr(lang, 'inv_per_page')}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Stock Movements */}
      {showMoves && (
        <div style={{ marginTop: 16, background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,.06)' }}><b style={{ color: '#fff' }}>{tr(lang, 'inv_movement_history')}</b></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                  {[tr(lang, 'inv_col_product'), tr(lang, 'inv_mov_col_type'), tr(lang, 'inv_mov_col_quantity'), tr(lang, 'inv_mov_col_before'), tr(lang, 'inv_mov_col_after'), tr(lang, 'inv_mov_col_reason'), tr(lang, 'inv_mov_col_date')].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '11px 14px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {moves.map((m, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <td style={{ padding: '11px 14px', fontSize: '.85rem', color: '#fff' }}>{m.cashskillbd_products?.name || m.product_id} <span style={{ color: 'var(--muted)' }}>({m.cashskillbd_products?.sku || ''})</span></td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: '.74rem', fontWeight: 600, background: Number(m.qty_change) >= 0 ? 'rgba(46,204,113,.15)' : 'rgba(232,35,42,.15)', color: Number(m.qty_change) >= 0 ? '#2ecc71' : '#ff6b6b' }}>{Number(m.qty_change) >= 0 ? tr(lang, 'inv_stock_in') : tr(lang, 'inv_stock_out')}</span>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '.85rem', color: '#fff' }}>{Number(m.qty_change) >= 0 ? '+' : ''}{m.qty_change}</td>
                    <td style={{ padding: '11px 14px', fontSize: '.85rem', color: 'var(--silver)' }}>{m.qty_before ?? '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: '.85rem', color: 'var(--silver)' }}>{m.qty_after ?? '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: '.85rem', color: 'var(--muted)' }}>{m.reason || ''} {m.notes || ''}</td>
                    <td style={{ padding: '11px 14px', fontSize: '.8rem', color: 'var(--muted)' }}>{new Date(m.created_at).toLocaleString('en-GB')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {moves.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'inv_no_movements')}</div>}
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setDetail(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{tr(lang, 'inv_product_details')}</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '.9rem' }}>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'inv_name_label')}</span><b style={{ color: '#fff' }}>{detail.name}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'inv_sku_label')}</span><b style={{ color: '#fff' }}>{detail.sku || '—'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'inv_category_label')}</span><b style={{ color: '#fff' }}>{detail.category}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'inv_description_label')}</span><span style={{ color: 'var(--silver)' }}>{detail.description || '—'}</span></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'inv_stock_label')}</span><b style={{ color: '#fff' }}>{detail.stock_qty ?? 0}</b> ({tr(lang, 'inv_min_label')} {detail.low_stock_at ?? 5})</div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'inv_selling_price_label')}</span><b style={{ color: '#fff' }}>{detail.currency === 'USD' ? '$' : '৳'}{Number(detail.selling_price || 0).toLocaleString('en-IN')}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'inv_purchase_cost_label')}</span><b style={{ color: '#fff' }}>{detail.currency === 'USD' ? '$' : '৳'}{Number(detail.purchase_cost || 0).toLocaleString('en-IN')}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'inv_status_label')}</span><b style={{ color: '#fff' }}>{statusMeta(lang)[stockStatus(detail)].label}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'inv_last_updated_label')}</span>{new Date(detail.updated_at || detail.created_at).toLocaleString('en-GB')}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => { setDetail(null); openEdit(detail) }} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{tr(lang, 'inv_edit_product')}</button>
              <button onClick={() => { setDetail(null); setShowStock({ products: [detail], direction: 'in' }) }} style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid rgba(46,204,113,.4)', background: 'transparent', color: '#2ecc71', cursor: 'pointer' }}>{tr(lang, 'inv_stock_in')}</button>
              <button onClick={() => { setDetail(null); setShowStock({ products: [detail], direction: 'out' }) }} style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid rgba(245,185,66,.4)', background: 'transparent', color: '#f5b942', cursor: 'pointer' }}>{tr(lang, 'inv_stock_out')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setShowForm(false)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{editing ? tr(lang, 'inv_edit_product') : tr(lang, 'inv_add_product')}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>{tr(lang, 'inv_product_name')}</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp} placeholder={tr(lang, 'inv_product_name_placeholder')} /></div>
                <div><label style={lbl}>{tr(lang, 'inv_sku')}</label><input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} style={inp} placeholder="SKU-XXX001" /></div>
              </div>
              <div><label style={lbl}>{tr(lang, 'inv_description')}</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>{tr(lang, 'inv_category')}</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                    {['VPS', 'IP', 'Number', 'Course', 'Dollar', 'Service', 'Account'].map(c => <option key={c} value={c} style={{ background: '#1a0d0e' }}>{catMeta(c, lang).label}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>{tr(lang, 'inv_currency')}</label>
                  <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                    <option value="BDT" style={{ background: '#1a0d0e' }}>BDT (৳)</option>
                    <option value="USD" style={{ background: '#1a0d0e' }}>USD ($)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>{tr(lang, 'inv_selling_price')}</label><input type="number" step="0.01" min="0" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} style={inp} /></div>
                <div><label style={lbl}>{tr(lang, 'inv_purchase_cost')}</label><input type="number" step="0.01" min="0" value={form.purchase_cost} onChange={e => setForm({ ...form, purchase_cost: e.target.value })} style={inp} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>{tr(lang, 'inv_stock_quantity')}</label><input type="number" min="0" value={form.stock_qty} onChange={e => setForm({ ...form, stock_qty: e.target.value })} style={inp} /></div>
                <div><label style={lbl}>{tr(lang, 'inv_min_stock_alert')}</label><input type="number" min="0" value={form.low_stock_at} onChange={e => setForm({ ...form, low_stock_at: e.target.value })} style={inp} /></div>
              </div>
              <div><label style={lbl}>{tr(lang, 'inv_image_url')}</label><input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} style={inp} placeholder={tr(lang, 'inv_image_url_placeholder')} /></div>
              <button type="submit" disabled={busy === 'save'} style={{ padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {busy === 'save' ? tr(lang, 'inv_saving') : editing ? tr(lang, 'inv_update_product') : tr(lang, 'inv_add_product')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Stock In/Out Modal */}
      {showStock && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setShowStock(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{showStock.direction === 'in' ? tr(lang, 'inv_stock_in') : tr(lang, 'inv_stock_out')} — {showStock.products.length > 1 ? `${showStock.products.length} × ${tr(lang, 'inv_col_product')}` : showStock.products[0].name}</h3>
              <button onClick={() => setShowStock(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <form onSubmit={adjustStock} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: '.88rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {showStock.products.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span><span>{tr(lang, 'inv_current_stock')} <b style={{ color: '#fff' }}>{p.stock_qty ?? 0}</b></span></div>
              ))}
              {showStock.products.length > 1 && <div style={{ color: '#8D7B7F', fontSize: '.8rem' }}>{tr(lang, 'inv_qty_applies_all')}</div>}
            </div>
              <div><label style={lbl}>{tr(lang, 'inv_quantity')}</label><input type="number" min="1" value={stockQty} onChange={e => setStockQty(e.target.value)} style={inp} placeholder={tr(lang, 'inv_quantity_placeholder')} /></div>
              <div><label style={lbl}>{tr(lang, 'inv_reason_note')}</label><input value={stockNotes} onChange={e => setStockNotes(e.target.value)} style={inp} placeholder={tr(lang, 'inv_reason_placeholder')} /></div>
              <button type="submit" disabled={busy === 'stock'} style={{ padding: '11px', borderRadius: 10, border: 'none', background: showStock.direction === 'in' ? 'linear-gradient(135deg, #2ecc71, #27ae60)' : 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {busy === 'stock' ? tr(lang, 'inv_saving') : showStock.direction === 'in' ? tr(lang, 'inv_add_stock') : tr(lang, 'inv_remove_stock')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
