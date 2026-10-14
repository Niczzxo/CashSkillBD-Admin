import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'

const newKey = () => 'ord-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

// Map DB status → reference status
const mapStatus = (s) => {
  if (s === 'pending') return 'pending'
  if (s === 'confirmed') return 'processing'
  if (s === 'delivered') return 'completed'
  if (s === 'cancelled' || s === 'refunded') return 'cancelled'
  return 'pending'
}
const STATUS_META = {
  pending: { label: 'Pending', color: '#f5b942', bg: 'rgba(245,185,66,.15)', border: 'rgba(245,185,66,.4)' },
  processing: { label: 'Processing', color: '#4da3ff', bg: 'rgba(77,163,255,.15)', border: 'rgba(77,163,255,.4)' },
  completed: { label: 'Completed', color: '#2ecc71', bg: 'rgba(46,204,113,.15)', border: 'rgba(46,204,113,.4)' },
  cancelled: { label: 'Cancelled', color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', border: 'rgba(232,35,42,.4)' },
}
const TYPE_META = {
  number: { label: 'Number', color: '#4da3ff', bg: 'rgba(77,163,255,.15)' },
  vps: { label: 'VPS', color: '#c084fc', bg: 'rgba(192,132,252,.15)' },
  ip: { label: 'IP Service', color: '#2ecc71', bg: 'rgba(46,204,113,.15)' },
  dollar: { label: 'Dollar', color: '#f5b942', bg: 'rgba(245,185,66,.15)' },
  course: { label: 'Course', color: '#ff6b6b', bg: 'rgba(232,35,42,.15)' },
  other: { label: 'Other', color: '#8e44ad', bg: 'rgba(142,68,173,.15)' },
}
const COUNTRY_CODES = {
  usa: 'us', us: 'us', germany: 'de', uk: 'gb', 'united kingdom': 'gb',
  netherlands: 'nl', singapore: 'sg', canada: 'ca', france: 'fr', japan: 'jp',
  australia: 'au', bangladesh: 'bd',
}
const flagUrl = (text) => {
  const t = (text || '').toLowerCase()
  for (const [k, code] of Object.entries(COUNTRY_CODES)) {
    if (t.includes(k)) return `https://flagcdn.com/w40/${code}.png`
  }
  return null
}

export function SalesOrders({ session, role }) {
  const [orders, setOrders] = useState([])
  const [itemsMap, setItemsMap] = useState({})
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusTab, setStatusTab] = useState('all')
  const [search, setSearch] = useState('')
  const [dateF, setDateF] = useState('all')
  const [productF, setProductF] = useState('all')
  const [typeF, setTypeF] = useState('all')
  const [payMethodF, setPayMethodF] = useState('all')
  const [payStatusF, setPayStatusF] = useState('all')
  const [orderStatusF, setOrderStatusF] = useState('all')
  const [sortF, setSortF] = useState('newest')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selected, setSelected] = useState(new Set())
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', currency: 'BDT', discount: '', notes: '' })
  const [rows, setRows] = useState([{ product_id: '', qty: '1' }])
  const [idemKey, setIdemKey] = useState(newKey)
  const [busy, setBusy] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [o, p] = await Promise.all([
        manageApi(session, 'order.list', { limit: 500, offset: 0 }),
        manageApi(session, 'product.list', { limit: 500, offset: 0 }).catch(() => ({ items: [] })),
      ])
      const list = o.items || []
      setOrders(list)
      setProducts(p.items || [])
      // Load items for all orders
      if (list.length > 0) {
        const ids = list.map(x => x.id)
        const ij = await manageApi(session, 'order.items_bulk', { order_ids: ids }).catch(() => ({ items: [] }))
        const map = {}
        ;(ij.items || []).forEach(it => {
          if (!map[it.order_id]) map[it.order_id] = []
          map[it.order_id].push(it)
        })
        setItemsMap(map)
      }
    } catch (e) { alert('❌ ' + e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Stats ──
  const byStatus = (s) => orders.filter(o => mapStatus(o.status) === s).length
  const stats = [
    { label: 'Total Orders', value: orders.length, desc: 'All time orders', color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '🛒' },
    { label: 'Pending Orders', value: byStatus('pending'), desc: 'Waiting for processing', color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '📦' },
    { label: 'Processing Orders', value: byStatus('processing'), desc: 'Being prepared', color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '🚚' },
    { label: 'Completed Orders', value: byStatus('completed'), desc: 'Successfully delivered', color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '✓' },
    { label: 'Cancelled Orders', value: byStatus('cancelled'), desc: 'Refunded / Cancelled', color: '#ff6b6b', bg: 'rgba(232,35,42,.2)', icon: '✕' },
  ]

  // ── Filters ──
  const productOf = (o) => {
    const items = itemsMap[o.id] || []
    if (items.length === 0) return null
    return items[0]
  }
  const typeOf = (o) => {
    const items = itemsMap[o.id] || []
    if (items.length === 0) return 'other'
    const prod = products.find(p => String(p.id) === String(items[0].product_id))
    const t = (prod?.product_type || prod?.category || items[0].cashskillbd_products?.name || '').toLowerCase()
    if (t.includes('number')) return 'number'
    if (t.includes('vps')) return 'vps'
    if (t.includes('ip') || t.includes('proxy')) return 'ip'
    if (t.includes('dollar')) return 'dollar'
    if (t.includes('course')) return 'course'
    return 'other'
  }

  let list = orders
  if (statusTab !== 'all') list = list.filter(o => mapStatus(o.status) === statusTab)
  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter(o => (o.order_no || '').toLowerCase().includes(q) || (o.customer_name || '').toLowerCase().includes(q) || (o.customer_phone || '').toLowerCase().includes(q) || JSON.stringify(itemsMap[o.id] || []).toLowerCase().includes(q))
  }
  if (dateF !== 'all') {
    const days = dateF === 'today' ? 1 : dateF === 'week' ? 7 : 30
    const cutoff = new Date(Date.now() - days * 864e5)
    list = list.filter(o => new Date(o.created_at) >= cutoff)
  }
  if (productF !== 'all') list = list.filter(o => (itemsMap[o.id] || []).some(it => String(it.product_id) === String(productF)))
  if (typeF !== 'all') list = list.filter(o => typeOf(o) === typeF)
  if (payMethodF !== 'all') list = list.filter(o => (o.payment_method || '—') === payMethodF)
  if (payStatusF !== 'all') list = list.filter(o => (o.payment_status || o.status) === payStatusF)
  if (orderStatusF !== 'all') list = list.filter(o => mapStatus(o.status) === orderStatusF)

  list = [...list].sort((a, b) => sortF === 'newest' ? new Date(b.created_at) - new Date(a.created_at) : new Date(a.created_at) - new Date(b.created_at))

  const clearFilters = () => { setSearch(''); setDateF('all'); setProductF('all'); setTypeF('all'); setPayMethodF('all'); setPayStatusF('all'); setOrderStatusF('all'); setStatusTab('all'); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const pageItems = list.slice((curPage - 1) * pageSize, curPage * pageSize)

  const toggleSelect = (id) => {
    const s = new Set(selected)
    if (s.has(id)) s.delete(id); else s.add(id)
    setSelected(s)
  }
  const toggleSelectAll = () => {
    if (selected.size === pageItems.length) setSelected(new Set())
    else setSelected(new Set(pageItems.map(o => o.id)))
  }

  const openDetail = async (o) => {
    setDetailLoading(true)
    try {
      const j = await manageApi(session, 'order.get', { id: o.id })
      setDetail({ order: j.order, items: j.items || [] })
    } catch (e) { alert('❌ ' + e.message) }
    setDetailLoading(false)
  }

  const setStatus = async (o, status) => {
    if (!confirm(`Order ${o.order_no || '#' + o.id} → ${status}?`)) return
    setBusy(o.id)
    try {
      await manageApi(session, 'order.set_status', { id: o.id, status })
      load()
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const openForm = () => {
    setForm({ customer_name: '', customer_phone: '', currency: 'BDT', discount: '', notes: '' })
    setRows([{ product_id: '', qty: '1' }])
    setIdemKey(newKey())
    setShowForm(true)
  }
  const curProducts = products.filter(p => p.currency === form.currency)
  const prodOf = (id) => products.find(p => String(p.id) === String(id))
  const estTotal = rows.reduce((a, r) => {
    const p = prodOf(r.product_id)
    return a + (p ? Number(p.selling_price) * Math.max(1, Number(r.qty) || 0) : 0)
  }, 0)

  const create = async (e) => {
    e.preventDefault()
    if (!form.customer_name.trim()) return alert('ক্রেতার নাম দিন')
    const clean = rows.filter(r => r.product_id).map(r => ({ product_id: Number(r.product_id), qty: Math.max(1, Number(r.qty) || 1) }))
    if (!clean.length) return alert('অন্তত একটি প্রোডাক্ট যোগ করুন')
    setBusy('create')
    try {
      await manageApi(session, 'order.create', {
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim() || undefined,
        currency: form.currency,
        items: clean,
        discount: form.discount === '' ? 0 : form.discount,
        notes: form.notes.trim() || undefined,
        idempotency_key: idemKey,
      })
      setShowForm(false)
      load()
      alert('✅ Order created')
    } catch (ex) { alert('❌ ' + ex.message) }
    setBusy(null)
  }

  const exportCSV = () => {
    const header = 'Order ID,Customer,Phone,Product,Type,Amount,Status,Date\n'
    const rowsCsv = list.map(o => {
      const items = itemsMap[o.id] || []
      const prodName = items.map(it => it.cashskillbd_products?.name || it.product_id).join('; ')
      return `"${o.order_no || '#' + o.id}",${o.customer_name || ''},${o.customer_phone || ''},"${prodName}",${typeOf(o)},${o.grand_total || 0},${o.status},${new Date(o.created_at).toLocaleString('en-GB')}`
    }).join('\n')
    const blob = new Blob([header + rowsCsv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'sales-orders.csv'; a.click()
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
  const avatarColors = ['#e8232a', '#4da3ff', '#2ecc71', '#f5b942', '#e84393', '#8e44ad', '#00cec9']
  const initials = (name) => (name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
  const avatarColor = (name) => avatarColors[(name || '').length % avatarColors.length]

  const payMethods = [...new Set(orders.map(o => o.payment_method).filter(Boolean))]

  const TABS = [
    { id: 'all', label: 'All Orders', count: orders.length },
    { id: 'pending', label: 'Pending', count: byStatus('pending') },
    { id: 'processing', label: 'Processing', count: byStatus('processing') },
    { id: 'completed', label: 'Completed', count: byStatus('completed') },
    { id: 'cancelled', label: 'Cancelled', count: byStatus('cancelled') },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>📋</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Sales Orders</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>Manage all customer orders, track status, and handle deliveries.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={exportCSV} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem' }}>↓ Export</button>
          <button onClick={openForm} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>+ New Order</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: 170, background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: `1px solid ${s.color}55`, borderRadius: 14, padding: 18, display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: s.bg, display: 'grid', placeItems: 'center', fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{s.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{s.value.toLocaleString()}</div>
              <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>{s.desc}</div>
            </div>
            <span style={{ position: 'absolute', top: 14, right: 14, color: s.color, fontSize: 16 }}>→</span>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setStatusTab(t.id); setPage(1) }} style={{ padding: '9px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: '.85rem', fontWeight: statusTab === t.id ? 600 : 400, background: statusTab === t.id ? '#e8232a' : 'rgba(255,255,255,.04)', color: '#fff' }}>
              {t.label} ({t.count})
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flex: 1, minWidth: 260, justifyContent: 'flex-end' }}>
          <input placeholder="Search by order ID, customer name, email, or product…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ flex: 1, maxWidth: 420, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
          <button onClick={load} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.85rem' }}>Filter</button>
          <button onClick={clearFilters} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>Reset</button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <select value={dateF} onChange={e => { setDateF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 130 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Time</option>
          <option value="today" style={{ background: '#1a0d0e' }}>Today</option>
          <option value="week" style={{ background: '#1a0d0e' }}>Last 7 Days</option>
          <option value="month" style={{ background: '#1a0d0e' }}>Last 30 Days</option>
        </select>
        <select value={productF} onChange={e => { setProductF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 140 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Products</option>
          {products.map(p => <option key={p.id} value={p.id} style={{ background: '#1a0d0e' }}>{p.name}</option>)}
        </select>
        <select value={typeF} onChange={e => { setTypeF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 130 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Order Types</option>
          {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k} style={{ background: '#1a0d0e' }}>{v.label}</option>)}
        </select>
        <select value={payMethodF} onChange={e => { setPayMethodF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 150 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Payment Methods</option>
          {payMethods.map(m => <option key={m} value={m} style={{ background: '#1a0d0e' }}>{m}</option>)}
        </select>
        <select value={payStatusF} onChange={e => { setPayStatusF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 130 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Statuses</option>
          <option value="pending" style={{ background: '#1a0d0e' }}>Pending</option>
          <option value="confirmed" style={{ background: '#1a0d0e' }}>Confirmed</option>
          <option value="delivered" style={{ background: '#1a0d0e' }}>Delivered</option>
          <option value="cancelled" style={{ background: '#1a0d0e' }}>Cancelled</option>
        </select>
        <select value={orderStatusF} onChange={e => { setOrderStatusF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 130 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Statuses</option>
          <option value="pending" style={{ background: '#1a0d0e' }}>Pending</option>
          <option value="processing" style={{ background: '#1a0d0e' }}>Processing</option>
          <option value="completed" style={{ background: '#1a0d0e' }}>Completed</option>
          <option value="cancelled" style={{ background: '#1a0d0e' }}>Cancelled</option>
        </select>
        <select value={sortF} onChange={e => setSortF(e.target.value)} style={{ ...selStyle, minWidth: 140 }}>
          <option value="newest" style={{ background: '#1a0d0e' }}>Sort Newest First</option>
          <option value="oldest" style={{ background: '#1a0d0e' }}>Sort Oldest First</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}><input type="checkbox" checked={pageItems.length > 0 && selected.size === pageItems.length} onChange={toggleSelectAll} style={{ accentColor: '#e8232a' }} /></th>
                {['#', 'Order ID', 'Customer', 'Product / Service', 'Type', 'Amount', 'Payment Method', 'Status', 'Order Date', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((o, i) => {
                const items = itemsMap[o.id] || []
                const firstItem = items[0]
                const prodName = firstItem?.cashskillbd_products?.name || (items.length > 0 ? `Product #${firstItem.product_id}` : '—')
                const prodLabel = items.length > 1 ? `${prodName} +${items.length - 1} more` : prodName
                const type = typeOf(o)
                const tm = TYPE_META[type]
                const sm = STATUS_META[mapStatus(o.status)]
                const flag = flagUrl(prodName)
                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <td style={{ padding: '12px 14px' }}><input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} style={{ accentColor: '#e8232a' }} /></td>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '.85rem' }}>{(curPage - 1) * pageSize + i + 1}</td>
                    <td style={{ padding: '12px 14px', color: '#fff', fontSize: '.88rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{o.order_no || `#CSB${o.id}`}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: avatarColor(o.customer_name), display: 'grid', placeItems: 'center', fontSize: '.75rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials(o.customer_name)}</div>
                        <div>
                          <div style={{ color: '#fff', fontSize: '.88rem', fontWeight: 600 }}>{o.customer_name || '—'}</div>
                          <div style={{ color: 'var(--muted)', fontSize: '.78rem' }}>{o.customer_phone || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {flag && <img src={flag} alt="" style={{ width: 24, height: 16, borderRadius: 2, objectFit: 'cover' }} />}
                        <span style={{ color: 'var(--silver)', fontSize: '.88rem' }}>{prodLabel}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.74rem', fontWeight: 600, background: tm.bg, color: tm.color }}>{tm.label}</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#fff', fontSize: '.88rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{o.currency === 'USD' ? '$' : '৳'} {Number(o.grand_total || 0).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px 14px', fontSize: '.85rem', color: 'var(--silver)' }}>{o.payment_method || '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.74rem', fontWeight: 600, background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>{sm.label}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {new Date(o.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}<br />
                      <span style={{ fontSize: '.72rem' }}>{new Date(o.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <button title="View" onClick={() => openDetail(o)} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer', marginRight: 3 }}>👁</button>
                      {mapStatus(o.status) === 'pending' && (
                        <button title="Confirm" onClick={() => setStatus(o, 'confirmed')} disabled={busy === o.id} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(46,204,113,.4)', background: 'rgba(46,204,113,.1)', color: '#2ecc71', cursor: 'pointer', marginRight: 3 }}>✓</button>
                      )}
                      {mapStatus(o.status) === 'processing' && (
                        <button title="Mark Delivered" onClick={() => setStatus(o, 'delivered')} disabled={busy === o.id} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(46,204,113,.4)', background: 'rgba(46,204,113,.1)', color: '#2ecc71', cursor: 'pointer', marginRight: 3 }}>🚚</button>
                      )}
                      {(mapStatus(o.status) === 'pending' || mapStatus(o.status) === 'processing') && (
                        <button title="Cancel" onClick={() => setStatus(o, 'cancelled')} disabled={busy === o.id} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer' }}>🗑</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>কোনো অর্ডার নেই</div>
            <div style={{ fontSize: '.85rem' }}>এই ফিল্টারে কোনো অর্ডার পাওয়া যায়নি।</div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Showing {list.length === 0 ? 0 : (curPage - 1) * pageSize + 1} to {Math.min(curPage * pageSize, list.length)} of {list.length.toLocaleString()} orders</span>
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
              <h3 style={{ margin: 0, color: '#fff' }}>Order Details</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '.9rem' }}>
              <div><span style={{ color: 'var(--muted)' }}>Order ID: </span><b style={{ color: '#fff' }}>{detail.order.order_no || `#CSB${detail.order.id}`}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Customer: </span><b style={{ color: '#fff' }}>{detail.order.customer_name}</b> ({detail.order.customer_phone || '—'})</div>
              <div><span style={{ color: 'var(--muted)' }}>Items: </span>{detail.items.map((it, i) => (
                <span key={i} style={{ color: 'var(--silver)' }}>{it.cashskillbd_products?.name || `Product #${it.product_id}`} × {it.qty}{i < detail.items.length - 1 ? ', ' : ''}</span>
              ))}</div>
              <div><span style={{ color: 'var(--muted)' }}>Amount: </span><b style={{ color: '#fff' }}>{detail.order.currency === 'USD' ? '$' : '৳'} {Number(detail.order.grand_total || 0).toLocaleString('en-IN')}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Payment Method: </span><b style={{ color: '#fff' }}>{detail.order.payment_method || '—'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Transaction Ref: </span><b style={{ color: '#fff' }}>{detail.order.payment_ref || detail.order.trx_id || '—'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Status: </span><b style={{ color: '#fff' }}>{STATUS_META[mapStatus(detail.order.status)].label}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Date: </span>{new Date(detail.order.created_at).toLocaleString('en-GB')}</div>
              {detail.order.notes && <div><span style={{ color: 'var(--muted)' }}>Notes: </span><span style={{ color: 'var(--silver)' }}>{detail.order.notes}</span></div>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {mapStatus(detail.order.status) === 'pending' && <button onClick={() => { setDetail(null); setStatus(detail.order, 'confirmed') }} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Confirm Order</button>}
              {mapStatus(detail.order.status) === 'processing' && <button onClick={() => { setDetail(null); setStatus(detail.order, 'delivered') }} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #2ecc71, #27ae60)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Mark Delivered</button>}
            </div>
          </div>
        </div>
      )}

      {/* New Order Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setShowForm(false)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>New Order</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <form onSubmit={create} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Customer Name *</label><input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} style={inp} placeholder="Customer name" /></div>
                <div><label style={lbl}>Customer Phone</label><input value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} style={inp} placeholder="Phone" /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Currency</label>
                  <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                    <option value="BDT" style={{ background: '#1a0d0e' }}>BDT (৳)</option>
                    <option value="USD" style={{ background: '#1a0d0e' }}>USD ($)</option>
                  </select>
                </div>
                <div><label style={lbl}>Discount</label><input type="number" min="0" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} style={inp} placeholder="0" /></div>
              </div>
              {rows.map((r, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8 }}>
                  <select value={r.product_id} onChange={e => { const arr = [...rows]; arr[idx].product_id = e.target.value; setRows(arr) }} style={{ ...inp, flex: 2, cursor: 'pointer' }}>
                    <option value="" style={{ background: '#1a0d0e' }}>Select Product</option>
                    {curProducts.map(p => <option key={p.id} value={p.id} style={{ background: '#1a0d0e' }}>{p.name} — {p.currency === 'USD' ? '$' : '৳'}{Number(p.selling_price).toLocaleString('en-IN')}</option>)}
                  </select>
                  <input type="number" min="1" value={r.qty} onChange={e => { const arr = [...rows]; arr[idx].qty = e.target.value; setRows(arr) }} style={{ ...inp, flex: 1 }} />
                  {rows.length > 1 && <button type="button" onClick={() => setRows(rows.filter((_, i) => i !== idx))} style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer' }}>×</button>}
                </div>
              ))}
              <button type="button" onClick={() => setRows([...rows, { product_id: '', qty: '1' }])} style={{ padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>+ Add Item</button>
              <div style={{ padding: '10px 12px', borderRadius: 9, background: 'rgba(255,255,255,.03)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Estimated Total:</span>
                <b style={{ color: '#fff' }}>{form.currency === 'USD' ? '$' : '৳'}{estTotal.toLocaleString('en-IN')}</b>
              </div>
              <div><label style={lbl}>Notes</label><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={inp} placeholder="Optional notes" /></div>
              <button type="submit" disabled={busy === 'create'} style={{ padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {busy === 'create' ? 'Creating…' : 'Create Order'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
