import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'

const COUNTRY_CODES = {
  usa: 'us', us: 'us', uk: 'gb', 'united kingdom': 'gb', canada: 'ca', germany: 'de',
  singapore: 'sg', australia: 'au', japan: 'jp', netherlands: 'nl', france: 'fr',
  india: 'in', brazil: 'br', italy: 'it', spain: 'es', korea: 'kr', china: 'cn',
  russia: 'ru', turkey: 'tr', poland: 'pl', sweden: 'se', norway: 'no',
}

const countryCodeOf = (name, specs) => {
  const text = `${name || ''} ${specs?.country || ''} ${specs?.location || ''}`.toLowerCase()
  for (const [key, code] of Object.entries(COUNTRY_CODES)) {
    if (text.includes(key)) return code
  }
  return null
}

const typeOf = (p) => {
  const text = `${p.name || ''} ${p.description || ''} ${JSON.stringify(p.specs || {})}`.toLowerCase()
  if (text.includes('residential')) return 'Residential'
  if (text.includes('datacenter') || text.includes('data center') || text.includes('datacentre')) return 'Datacenter'
  if (text.includes('static')) return 'Static'
  return 'Residential'
}

const TYPE_STYLES = {
  Residential: { bg: 'rgba(192,132,252,.12)', color: '#c084fc', border: 'rgba(192,132,252,.4)' },
  Datacenter: { bg: 'rgba(77,163,255,.12)', color: '#4da3ff', border: 'rgba(77,163,255,.4)' },
  Static: { bg: 'rgba(46,204,113,.12)', color: '#2ecc71', border: 'rgba(46,204,113,.4)' },
}

export function IpServices({ session }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [locF, setLocF] = useState('all')
  const [typeF, setTypeF] = useState('all')
  const [ispF, setIspF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selected, setSelected] = useState(new Set())
  const [detail, setDetail] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', selling_price: '', stock_qty: '0', location: '', isp: '', ip_type: 'Residential' })
  const [busy, setBusy] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const j = await manageApi(session, 'product.list', { limit: 500, offset: 0 })
      const all = j.items || []
      // IP products: product_type='ip' or category='ip'
      setItems(all.filter(p => (p.product_type || '').toLowerCase() === 'ip' || (p.category || '').toLowerCase() === 'ip'))
    } catch (e) { alert('❌ ' + e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const specsOf = (p) => {
    try { return typeof p.specs === 'string' ? JSON.parse(p.specs) : (p.specs || {}) } catch { return {} }
  }
  const locationOf = (p) => specsOf(p).location || specsOf(p).country || '—'
  const ispOf = (p) => specsOf(p).isp || specsOf(p).provider || '—'

  // ── Stats ──
  const total = items.length
  const active = items.filter(p => p.status === 'active').length
  const totalStock = items.reduce((s, p) => s + Number(p.stock_qty || 0), 0)
  const outOfStock = items.filter(p => Number(p.stock_qty || 0) <= 0).length

  // ── Filters ──
  let list = items
  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter(p => (p.name || '').toLowerCase().includes(q) || locationOf(p).toLowerCase().includes(q) || typeOf(p).toLowerCase().includes(q) || ispOf(p).toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
  }
  if (locF !== 'all') list = list.filter(p => locationOf(p) === locF)
  if (typeF !== 'all') list = list.filter(p => typeOf(p) === typeF)
  if (ispF !== 'all') list = list.filter(p => ispOf(p) === ispF)
  if (statusF !== 'all') list = list.filter(p => p.status === statusF)

  const clearFilters = () => { setSearch(''); setLocF('all'); setTypeF('all'); setIspF('all'); setStatusF('all'); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const pageItems = list.slice((curPage - 1) * pageSize, curPage * pageSize)

  const locations = [...new Set(items.map(locationOf))].filter(l => l !== '—')
  const isps = [...new Set(items.map(ispOf))].filter(i => i !== '—')

  const fmt = (p) => `৳${Number(p.selling_price || 0).toLocaleString('en-IN')}`

  const toggleStatus = async (p) => {
    setBusy(p.id)
    try {
      await manageApi(session, 'product.set_status', { id: p.id, status: p.status === 'active' ? 'inactive' : 'active' })
      load()
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const del = async (p) => {
    if (!confirm(`"${p.name}" IP service delete করবেন?`)) return
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
        sku: (p.sku || '') + '-COPY', name: p.name + ' (Copy)', description: p.description,
        category: 'ip', product_type: 'ip', selling_price: p.selling_price,
        currency: p.currency, stock_qty: p.stock_qty, low_stock_at: p.low_stock_at,
        image_url: p.image_url, purchase_cost: p.purchase_cost, specs: p.specs,
      })
      load()
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return alert('IP service name দিন')
    setBusy('save')
    try {
      const specs = { location: form.location, isp: form.isp, ip_type: form.ip_type }
      if (editing) {
        await manageApi(session, 'product.update', { id: editing.id, name: form.name, description: form.description, selling_price: form.selling_price, stock_qty: form.stock_qty, specs })
      } else {
        await manageApi(session, 'product.create', { name: form.name, description: form.description, category: 'ip', product_type: 'ip', selling_price: form.selling_price, stock_qty: form.stock_qty, currency: 'BDT', specs })
      }
      setShowForm(false); setEditing(null)
      load()
    } catch (ex) { alert('❌ ' + ex.message) }
    setBusy(null)
  }

  const openEdit = (p) => {
    const s = specsOf(p)
    setEditing(p)
    setForm({ name: p.name || '', description: p.description || '', selling_price: p.selling_price ?? '', stock_qty: p.stock_qty ?? 0, location: s.location || '', isp: s.isp || '', ip_type: s.ip_type || typeOf(p) })
    setShowForm(true)
  }

  const exportCSV = () => {
    const header = 'Name,Type,Location,ISP,Price,Stock,Status\n'
    const rows = list.map(p => `"${p.name || ''}",${typeOf(p)},${locationOf(p)},${ispOf(p)},${p.selling_price || 0},${p.stock_qty || 0},${p.status || ''}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'ip-services.csv'; a.click()
    URL.revokeObjectURL(url)
    setExportOpen(false)
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
    { label: 'Total IP Services', value: total.toLocaleString(), desc: 'All available IP services', color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '🌐' },
    { label: 'Active IP Services', value: active.toLocaleString(), desc: 'Currently active', color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '📶' },
    { label: 'Total IP In Stock', value: totalStock.toLocaleString(), desc: 'Available IP addresses', color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '🗄' },
    { label: 'Out of Stock', value: outOfStock.toLocaleString(), desc: 'No available IP addresses', color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '📦' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(8,189,245,.12)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0, border: '1px solid rgba(8,189,245,.3)' }}>🌐</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>IP Services</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>Manage all IP services, create new IP services, update stock, pricing and locations.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
          <button onClick={() => setExportOpen(!exportOpen)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem' }}>
            ↓ Export ▾
          </button>
          {exportOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 150, marginTop: 6, background: '#1a0d0e', border: '1px solid rgba(232,35,42,.4)', borderRadius: 10, padding: 6, zIndex: 10, minWidth: 150 }}>
              <button onClick={exportCSV} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>Export as CSV</button>
            </div>
          )}
          <button onClick={() => { setEditing(null); setForm({ name: '', description: '', selling_price: '', stock_qty: '0', location: '', isp: '', ip_type: 'Residential' }); setShowForm(true) }} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>
            + Add IP Service
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
        <input placeholder="Search by IP name, location, type, ISP or description…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 220, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
        <select value={locF} onChange={e => { setLocF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Locations</option>
          {locations.map(l => <option key={l} value={l} style={{ background: '#1a0d0e' }}>{l}</option>)}
        </select>
        <select value={typeF} onChange={e => { setTypeF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Types</option>
          {['Residential', 'Datacenter', 'Static'].map(t => <option key={t} value={t} style={{ background: '#1a0d0e' }}>{t}</option>)}
        </select>
        <select value={ispF} onChange={e => { setIspF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>All ISPs</option>
          {isps.map(i => <option key={i} value={i} style={{ background: '#1a0d0e' }}>{i}</option>)}
        </select>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Statuses</option>
          <option value="active" style={{ background: '#1a0d0e' }}>Active</option>
          <option value="inactive" style={{ background: '#1a0d0e' }}>Inactive</option>
        </select>
        <button onClick={clearFilters} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontSize: '.85rem', fontWeight: 600 }}>Clear Filters</button>
        <button onClick={load} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>Refresh</button>
      </div>

      {/* Table */}
      <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.3)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1050 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)' }}>#</th>
                <th style={{ padding: '12px 8px' }}><input type="checkbox" checked={pageItems.length > 0 && selected.size === pageItems.length} onChange={() => setSelected(selected.size === pageItems.length ? new Set() : new Set(pageItems.map(p => p.id)))} style={{ accentColor: '#e8232a', cursor: 'pointer' }} /></th>
                {['IP Details', 'Type', 'Location', 'ISP', 'Price', 'Stock', 'Status', 'Created Date', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p, i) => {
                const stock = Number(p.stock_qty || 0)
                const lowAt = Number(p.low_stock_at || 5)
                const t = typeOf(p)
                const ts = TYPE_STYLES[t] || TYPE_STYLES.Residential
                const cc = countryCodeOf(p.name, specsOf(p))
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '.85rem' }}>{(curPage - 1) * pageSize + i + 1}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => { const s = new Set(selected); s.has(p.id) ? s.delete(p.id) : s.add(p.id); setSelected(s) }} style={{ accentColor: '#e8232a', cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {cc ? (
                          <img src={`https://flagcdn.com/w40/${cc}.png`} alt="" style={{ width: 32, height: 22, borderRadius: 4, objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 32, height: 22, borderRadius: 4, background: 'rgba(255,255,255,.08)', display: 'grid', placeItems: 'center', fontSize: 10, color: 'var(--muted)' }}>—</div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, color: '#fff', fontSize: '.9rem', whiteSpace: 'nowrap' }}>{p.name}</div>
                          <div style={{ fontSize: '.76rem', color: 'var(--muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.76rem', fontWeight: 600, background: ts.bg, color: ts.color, border: `1px solid ${ts.border}`, whiteSpace: 'nowrap' }}>{t}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '.85rem', color: '#fff', whiteSpace: 'nowrap' }}>{locationOf(p)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.76rem', fontWeight: 600, background: 'rgba(255,255,255,.06)', color: 'var(--silver)', border: '1px solid rgba(255,255,255,.12)', whiteSpace: 'nowrap' }}>{ispOf(p)}</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#fff', fontSize: '.9rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(p)}</td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      {stock <= 0 ? <span style={{ color: '#ff6b6b', fontSize: '.85rem', fontWeight: 600 }}>● 0 in stock</span>
                        : stock <= lowAt ? <span style={{ color: '#f5b942', fontSize: '.85rem', fontWeight: 600 }}>● {stock} in stock</span>
                          : <span style={{ color: '#2ecc71', fontSize: '.85rem', fontWeight: 600 }}>● {stock} in stock</span>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <button onClick={() => toggleStatus(p)} disabled={busy === p.id} title={p.status === 'active' ? 'Deactivate' : 'Activate'} style={{ width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: p.status === 'active' ? '#2ecc71' : '#555', position: 'relative' }}>
                        <span style={{ position: 'absolute', top: 3, left: p.status === 'active' ? 24 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff' }} />
                      </button>
                      <span style={{ marginLeft: 8, fontSize: '.8rem', color: p.status === 'active' ? '#2ecc71' : 'var(--muted)', fontWeight: 600 }}>{p.status === 'active' ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {new Date(p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}<br />
                      <span style={{ fontSize: '.72rem' }}>{new Date(p.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <button title="View" onClick={() => setDetail(p)} style={actionBtn('transparent', 'rgba(255,255,255,.15)', '#fff')}>👁</button>
                      <button title="Edit" onClick={() => openEdit(p)} style={actionBtn('rgba(245,185,66,.1)', 'rgba(245,185,66,.4)', '#f5b942')}>✏️</button>
                      <button title="Duplicate" onClick={() => duplicate(p)} disabled={busy === p.id} style={actionBtn('rgba(77,163,255,.1)', 'rgba(77,163,255,.4)', '#4da3ff')}>⧉</button>
                      <button title="Delete" onClick={() => del(p)} disabled={busy === p.id} style={actionBtn('rgba(232,35,42,.1)', 'rgba(232,35,42,.4)', '#ff6b6b')}>🗑</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>No IP services found</div>
            <div style={{ fontSize: '.85rem' }}>No IP products in the catalog yet. Add one to get started.</div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Showing {list.length === 0 ? 0 : (curPage - 1) * pageSize + 1} to {Math.min(curPage * pageSize, list.length)} of {list.length.toLocaleString()} IP services</span>
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
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 500, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>IP Service Details</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '.9rem' }}>
              <div><span style={{ color: 'var(--muted)' }}>Name: </span><b style={{ color: '#fff' }}>{detail.name}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Description: </span><span style={{ color: 'var(--silver)' }}>{detail.description || '—'}</span></div>
              <div><span style={{ color: 'var(--muted)' }}>Type: </span><b style={{ color: '#fff' }}>{typeOf(detail)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Location: </span><b style={{ color: '#fff' }}>{locationOf(detail)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>ISP: </span><b style={{ color: '#fff' }}>{ispOf(detail)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Price: </span><b style={{ color: '#fff' }}>{fmt(detail)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Stock: </span><b style={{ color: '#fff' }}>{detail.stock_qty ?? 0}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Status: </span><b style={{ color: '#fff' }}>{detail.status}</b></div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setShowForm(false)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 520, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{editing ? 'Edit IP Service' : 'Add IP Service'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={lbl}>IP Service Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp} placeholder="e.g. USA Residential IP" /></div>
              <div><label style={lbl}>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Type</label>
                  <select value={form.ip_type} onChange={e => setForm({ ...form, ip_type: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                    {['Residential', 'Datacenter', 'Static'].map(t => <option key={t} value={t} style={{ background: '#1a0d0e' }}>{t}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Price (৳)</label><input type="number" step="0.01" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} style={inp} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Location</label><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} style={inp} placeholder="e.g. New York, NY" /></div>
                <div><label style={lbl}>ISP</label><input value={form.isp} onChange={e => setForm({ ...form, isp: e.target.value })} style={inp} placeholder="e.g. Comcast" /></div>
              </div>
              <div><label style={lbl}>Stock Qty</label><input type="number" value={form.stock_qty} onChange={e => setForm({ ...form, stock_qty: e.target.value })} style={inp} /></div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={busy === 'save'} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  {busy === 'save' ? 'Saving…' : editing ? 'Update IP Service' : 'Add IP Service'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '11px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
