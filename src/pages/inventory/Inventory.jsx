import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'

const CATEGORY_META = {
  vps: { label: 'VPS', color: '#c084fc', bg: 'rgba(192,132,252,.15)' },
  ip: { label: 'IP Service', color: '#4da3ff', bg: 'rgba(77,163,255,.15)' },
  number: { label: 'Number', color: '#ff6b6b', bg: 'rgba(232,35,42,.15)' },
  course: { label: 'Course', color: '#2ecc71', bg: 'rgba(46,204,113,.15)' },
  dollar: { label: 'Dollar', color: '#f5b942', bg: 'rgba(245,185,66,.15)' },
  service: { label: 'Service', color: '#00cec9', bg: 'rgba(0,206,201,.15)' },
  account: { label: 'Account', color: '#e84393', bg: 'rgba(232,67,147,.15)' },
}
const catMeta = (c) => CATEGORY_META[(c || '').toLowerCase()] || { label: c || 'Other', color: '#8e44ad', bg: 'rgba(142,68,173,.15)' }
const stockStatus = (p) => {
  const stock = Number(p.stock_qty || 0)
  const min = Number(p.low_stock_at ?? 5)
  if (stock <= 0) return 'out'
  if (stock <= min) return 'low'
  return 'in'
}
const STATUS_META = {
  in: { label: 'In Stock', color: '#2ecc71', bg: 'rgba(46,204,113,.15)', border: 'rgba(46,204,113,.4)' },
  low: { label: 'Low Stock', color: '#f5b942', bg: 'rgba(245,185,66,.15)', border: 'rgba(245,185,66,.4)' },
  out: { label: 'Out of Stock', color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', border: 'rgba(232,35,42,.4)' },
}

export function Inventory({ session }) {
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
  const [showStock, setShowStock] = useState(null) // { product, direction }
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
    } catch (e) { alert('❌ ' + e.message) }
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
    if (!form.name.trim()) return alert('Product name দিন')
    if (!form.sku.trim()) return alert('SKU দিন')
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
      alert('✅ Product saved')
    } catch (ex) { alert('❌ ' + ex.message) }
    setBusy(null)
  }

  const del = async (p) => {
    if (!confirm(`"${p.name}" product delete করবেন?`)) return
    setBusy(p.id)
    try { await manageApi(session, 'product.delete', { id: p.id }); load() }
    catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const adjustStock = async (e) => {
    e.preventDefault()
    if (!showStock) return
    const qty = Number(stockQty)
    if (!qty || qty <= 0) return alert('সঠিক quantity দিন')
    if (showStock.direction === 'out' && qty > Number(showStock.product.stock_qty || 0)) {
      return alert(`Stock-এ পর্যাপ্ত quantity নেই। Available: ${showStock.product.stock_qty}`)
    }
    setBusy('stock')
    try {
      await manageApi(session, 'product.adjust_stock', {
        id: showStock.product.id, qty_change: qty, direction: showStock.direction,
        reason: 'adjustment', notes: stockNotes.trim() || undefined,
      })
      setShowStock(null); setStockQty(''); setStockNotes('')
      load()
      alert('✅ Stock updated')
    } catch (ex) { alert('❌ ' + ex.message) }
    setBusy(null)
  }

  const exportCSV = () => {
    const header = 'SKU,Product,Category,Stock,Min Stock,Status,Unit Price,Total Value,Last Updated\n'
    const rowsCsv = list.map(p => {
      const total = Number(p.stock_qty || 0) * Number(p.purchase_cost || p.selling_price || 0)
      return `"${p.sku || ''}","${p.name || ''}",${p.category || ''},${p.stock_qty || 0},${p.low_stock_at ?? 5},${STATUS_META[stockStatus(p)].label},${p.selling_price || 0},${total},${new Date(p.updated_at || p.created_at).toLocaleString('en-GB')}`
    }).join('\n')
    const blob = new Blob([header + rowsCsv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'inventory.csv'; a.click()
    URL.revokeObjectURL(url)
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
    { label: 'Total Products', value: totalProducts.toLocaleString(), desc: 'All products', color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '📦' },
    { label: 'In Stock', value: inStock.toLocaleString(), desc: 'Products available', color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '📚' },
    { label: 'Low Stock', value: lowStock.toLocaleString(), desc: 'Need to restock', color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '⚠️' },
    { label: 'Out of Stock', value: outStock.toLocaleString(), desc: 'Unavailable', color: '#ff6b6b', bg: 'rgba(232,35,42,.2)', icon: '📦' },
    { label: 'Total Stock Value', value: `৳ ${totalValue.toLocaleString('en-IN')}`, desc: 'Current inventory value', color: '#c084fc', bg: 'rgba(192,132,252,.15)', icon: '⇄' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>📦</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Inventory</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>Manage all products, stock levels and inventory movements.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={exportCSV} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem' }}>↓ Export</button>
          <button onClick={() => { if (!selected.size) return alert('একটা product select করুন'); const p = products.find(x => x.id === [...selected][0]); setShowStock({ product: p, direction: 'in' }) }} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(46,204,113,.4)', background: 'rgba(46,204,113,.1)', color: '#2ecc71', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem' }}>+ Stock In</button>
          <button onClick={() => { if (!selected.size) return alert('একটা product select করুন'); const p = products.find(x => x.id === [...selected][0]); setShowStock({ product: p, direction: 'out' }) }} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(245,185,66,.4)', background: 'rgba(245,185,66,.1)', color: '#f5b942', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem' }}>← Stock Out</button>
          <button onClick={openCreate} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>+ Add Product</button>
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
        <input placeholder="Search by SKU, product name or category…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 220, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
        <select value={catF} onChange={e => { setCatF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 150 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Categories</option>
          {categories.map(c => <option key={c} value={c} style={{ background: '#1a0d0e' }}>{catMeta(c).label}</option>)}
        </select>
        <select value={stockF} onChange={e => { setStockF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 150 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Statuses</option>
          <option value="in" style={{ background: '#1a0d0e' }}>In Stock</option>
          <option value="low" style={{ background: '#1a0d0e' }}>Low Stock</option>
          <option value="out" style={{ background: '#1a0d0e' }}>Out of Stock</option>
        </select>
        <button onClick={load} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.85rem' }}>Filter</button>
        <button onClick={clearFilters} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>Reset</button>
        <button onClick={load} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>Refresh</button>
        <button onClick={() => setShowMoves(!showMoves)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>{showMoves ? 'Hide' : 'Show'} Movements</button>
      </div>

      {/* Table */}
      <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}><input type="checkbox" checked={pageItems.length > 0 && selected.size === pageItems.length} onChange={toggleSelectAll} style={{ accentColor: '#e8232a' }} /></th>
                {['#', 'SKU', 'Product', 'Category', 'Stock', 'Min. Stock', 'Status', 'Unit Price', 'Total Value', 'Last Updated', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p, i) => {
                const st = stockStatus(p)
                const sm = STATUS_META[st]
                const cm = catMeta(p.category)
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
                      <button title="View" onClick={() => setDetail(p)} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer', marginRight: 3 }}>👁</button>
                      <button title="Edit" onClick={() => openEdit(p)} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(245,185,66,.4)', background: 'rgba(245,185,66,.1)', color: '#f5b942', cursor: 'pointer', marginRight: 3 }}>✏️</button>
                      <button title="Delete" onClick={() => del(p)} disabled={busy === p.id} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer' }}>🗑</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>{search || catF !== 'all' || stockF !== 'all' ? 'কোনো প্রোডাক্ট পাওয়া যায়নি' : 'Inventory খালি'}</div>
            <div style={{ fontSize: '.85rem' }}>{search || catF !== 'all' || stockF !== 'all' ? 'ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন।' : 'Add Product দিয়ে নতুন প্রোডাক্ট যোগ করুন।'}</div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Showing {list.length === 0 ? 0 : (curPage - 1) * pageSize + 1} to {Math.min(curPage * pageSize, list.length)} of {list.length.toLocaleString()} products</span>
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
              {[10, 25, 50].map(n => <option key={n} value={n} style={{ background: '#1a0d0e' }}>{n} / page</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Stock Movements */}
      {showMoves && (
        <div style={{ marginTop: 16, background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,.06)' }}><b style={{ color: '#fff' }}>Stock Movement History</b></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                  {['Product', 'Type', 'Quantity', 'Before', 'After', 'Reason', 'Date'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '11px 14px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {moves.map((m, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <td style={{ padding: '11px 14px', fontSize: '.85rem', color: '#fff' }}>{m.cashskillbd_products?.name || m.product_id} <span style={{ color: 'var(--muted)' }}>({m.cashskillbd_products?.sku || ''})</span></td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: '.74rem', fontWeight: 600, background: Number(m.qty_change) >= 0 ? 'rgba(46,204,113,.15)' : 'rgba(232,35,42,.15)', color: Number(m.qty_change) >= 0 ? '#2ecc71' : '#ff6b6b' }}>{Number(m.qty_change) >= 0 ? 'Stock In' : 'Stock Out'}</span>
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
          {moves.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: '.88rem' }}>No stock movements yet.</div>}
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setDetail(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Product Details</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '.9rem' }}>
              <div><span style={{ color: 'var(--muted)' }}>Name: </span><b style={{ color: '#fff' }}>{detail.name}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>SKU: </span><b style={{ color: '#fff' }}>{detail.sku || '—'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Category: </span><b style={{ color: '#fff' }}>{detail.category}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Description: </span><span style={{ color: 'var(--silver)' }}>{detail.description || '—'}</span></div>
              <div><span style={{ color: 'var(--muted)' }}>Stock: </span><b style={{ color: '#fff' }}>{detail.stock_qty ?? 0}</b> (Min: {detail.low_stock_at ?? 5})</div>
              <div><span style={{ color: 'var(--muted)' }}>Selling Price: </span><b style={{ color: '#fff' }}>{detail.currency === 'USD' ? '$' : '৳'}{Number(detail.selling_price || 0).toLocaleString('en-IN')}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Purchase Cost: </span><b style={{ color: '#fff' }}>{detail.currency === 'USD' ? '$' : '৳'}{Number(detail.purchase_cost || 0).toLocaleString('en-IN')}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Status: </span><b style={{ color: '#fff' }}>{STATUS_META[stockStatus(detail)].label}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Last Updated: </span>{new Date(detail.updated_at || detail.created_at).toLocaleString('en-GB')}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => { setDetail(null); openEdit(detail) }} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Edit Product</button>
              <button onClick={() => { setDetail(null); setShowStock({ product: detail, direction: 'in' }) }} style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid rgba(46,204,113,.4)', background: 'transparent', color: '#2ecc71', cursor: 'pointer' }}>Stock In</button>
              <button onClick={() => { setDetail(null); setShowStock({ product: detail, direction: 'out' }) }} style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid rgba(245,185,66,.4)', background: 'transparent', color: '#f5b942', cursor: 'pointer' }}>Stock Out</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setShowForm(false)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{editing ? 'Edit Product' : 'Add Product'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Product Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp} placeholder="Product name" /></div>
                <div><label style={lbl}>SKU *</label><input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} style={inp} placeholder="SKU-XXX001" /></div>
              </div>
              <div><label style={lbl}>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                    {['VPS', 'IP', 'Number', 'Course', 'Dollar', 'Service', 'Account'].map(c => <option key={c} value={c} style={{ background: '#1a0d0e' }}>{c}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Currency</label>
                  <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                    <option value="BDT" style={{ background: '#1a0d0e' }}>BDT (৳)</option>
                    <option value="USD" style={{ background: '#1a0d0e' }}>USD ($)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Selling Price</label><input type="number" step="0.01" min="0" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} style={inp} /></div>
                <div><label style={lbl}>Purchase Cost</label><input type="number" step="0.01" min="0" value={form.purchase_cost} onChange={e => setForm({ ...form, purchase_cost: e.target.value })} style={inp} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Stock Quantity</label><input type="number" min="0" value={form.stock_qty} onChange={e => setForm({ ...form, stock_qty: e.target.value })} style={inp} /></div>
                <div><label style={lbl}>Min. Stock Alert At</label><input type="number" min="0" value={form.low_stock_at} onChange={e => setForm({ ...form, low_stock_at: e.target.value })} style={inp} /></div>
              </div>
              <div><label style={lbl}>Image URL</label><input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} style={inp} placeholder="https://…" /></div>
              <button type="submit" disabled={busy === 'save'} style={{ padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {busy === 'save' ? 'Saving…' : editing ? 'Update Product' : 'Add Product'}
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
              <h3 style={{ margin: 0, color: '#fff' }}>{showStock.direction === 'in' ? 'Stock In' : 'Stock Out'} — {showStock.product.name}</h3>
              <button onClick={() => setShowStock(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <form onSubmit={adjustStock} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: '.88rem', color: 'var(--muted)' }}>Current Stock: <b style={{ color: '#fff' }}>{showStock.product.stock_qty ?? 0}</b></div>
              <div><label style={lbl}>Quantity *</label><input type="number" min="1" value={stockQty} onChange={e => setStockQty(e.target.value)} style={inp} placeholder="Quantity" /></div>
              <div><label style={lbl}>Reason / Note</label><input value={stockNotes} onChange={e => setStockNotes(e.target.value)} style={inp} placeholder="e.g. New purchase, return" /></div>
              <button type="submit" disabled={busy === 'stock'} style={{ padding: '11px', borderRadius: 10, border: 'none', background: showStock.direction === 'in' ? 'linear-gradient(135deg, #2ecc71, #27ae60)' : 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {busy === 'stock' ? 'Saving…' : showStock.direction === 'in' ? 'Add Stock' : 'Remove Stock'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
