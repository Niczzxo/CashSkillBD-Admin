import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'

const COUNTRY_CODES = {
  usa: 'us', us: 'us', uk: 'gb', 'united kingdom': 'gb', germany: 'de',
  canada: 'ca', france: 'fr', netherlands: 'nl', singapore: 'sg',
  australia: 'au', bangladesh: 'bd', japan: 'jp', italy: 'it', spain: 'es',
  india: 'in', brazil: 'br', poland: 'pl', sweden: 'se', norway: 'no',
  'south korea': 'kr', korea: 'kr', china: 'cn', russia: 'ru', turkey: 'tr',
}
const SERVICE_TYPES = ['SMS Verification', 'Voice Calls', 'Toll-Free', 'Local', 'Mobile', 'Landline']

const flagUrl = (country) => {
  const code = COUNTRY_CODES[(country || '').toLowerCase().trim()]
  return code ? `https://flagcdn.com/w40/${code}.png` : null
}
function specsOf(p) {
  try { return typeof p.specs === 'string' ? JSON.parse(p.specs) : (p.specs || {}) } catch { return {} }
}
const countryOf = (p) => specsOf(p).country || p.name || 'Unknown'

export function NumbersManagement({ session }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [detail, setDetail] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ country: '', country_code: '', number_types: [], starting_price: '', previous_price: '', is_active: true, is_public: true, notes: '' })
  const [busy, setBusy] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const j = await manageApi(session, 'product.list', { limit: 500, offset: 0 })
      const all = j.items || []
      setProducts(all.filter(p => (p.product_type || '').toLowerCase() === 'number' || (p.category || '').toLowerCase() === 'number'))
    } catch (e) { alert('❌ ' + e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Group products by country ──
  const countries = {}
  products.forEach(p => {
    const c = countryOf(p)
    if (!countries[c]) countries[c] = { name: c, products: [], types: new Set(), minPrice: Infinity, prevPrice: null, active: false, notes: '' }
    const g = countries[c]
    g.products.push(p)
    const s = specsOf(p)
    if (Array.isArray(s.number_types)) s.number_types.forEach(t => g.types.add(t))
    else g.types.add(s.service_type || 'SMS Verification')
    const price = Number(p.selling_price || 0)
    if (price > 0 && price < g.minPrice) g.minPrice = price
    if (s.previous_price) g.prevPrice = Number(s.previous_price)
    if (p.status === 'active') g.active = true
    if (s.notes) g.notes = s.notes
  })
  const countryList = Object.values(countries).sort((a, b) => a.name.localeCompare(b.name)).map(g => ({
    ...g,
    typeCount: g.types.size,
    startPrice: g.minPrice === Infinity ? null : g.minPrice,
  }))

  // ── Stats ──
  const totalCountries = countryList.length
  const activeCountries = countryList.filter(c => c.active).length
  const totalTypes = countryList.reduce((s, c) => s + c.typeCount, 0)
  const available = activeCountries

  // ── Filters ──
  let list = countryList
  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter(c => c.name.toLowerCase().includes(q))
  }
  if (statusF !== 'all') list = list.filter(c => (c.active ? 'active' : 'inactive') === statusF)

  const clearFilters = () => { setSearch(''); setStatusF('all'); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const pageItems = list.slice((curPage - 1) * pageSize, curPage * pageSize)

  const openCreate = () => {
    setEditing(null)
    setForm({ country: '', country_code: '', number_types: [], starting_price: '', previous_price: '', is_active: true, is_public: true, notes: '' })
    setShowForm(true)
  }
  const openEdit = (c) => {
    const first = c.products[0] || {}
    const s = specsOf(first)
    setEditing(c)
    setForm({
      country: c.name, country_code: s.country_code || COUNTRY_CODES[c.name.toLowerCase()] || '',
      number_types: Array.from(c.types), starting_price: c.startPrice ?? '',
      previous_price: c.prevPrice ?? '', is_active: c.active, is_public: s.is_public !== false,
      notes: c.notes || '',
    })
    setShowForm(true)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.country.trim()) return alert('Country name দিন')
    if (!form.starting_price) return alert('Starting price দিন')
    // Duplicate check (create mode)
    if (!editing && countries[form.country.trim()]) return alert('এই country already আছে। Edit করুন।')
    setBusy('save')
    try {
      const specs = {
        country: form.country.trim(), country_code: form.country_code.trim() || undefined,
        number_types: form.number_types, previous_price: form.previous_price || undefined,
        is_public: form.is_public, notes: form.notes || undefined,
      }
      if (editing) {
        // Update all products in this country group
        for (const p of editing.products) {
          await manageApi(session, 'product.update', { id: p.id, name: form.country.trim(), selling_price: Number(form.starting_price), status: form.is_active ? 'active' : 'inactive', specs: { ...specsOf(p), ...specs } })
        }
        // If group had no products, create one
        if (editing.products.length === 0) {
          await manageApi(session, 'product.create', { name: form.country.trim(), category: 'number', product_type: 'number', selling_price: Number(form.starting_price), currency: 'BDT', stock_qty: 0, status: form.is_active ? 'active' : 'inactive', specs })
        }
      } else {
        await manageApi(session, 'product.create', { name: form.country.trim(), category: 'number', product_type: 'number', selling_price: Number(form.starting_price), currency: 'BDT', stock_qty: 0, status: form.is_active ? 'active' : 'inactive', specs })
      }
      setShowForm(false); setEditing(null)
      load()
      alert('✅ Country saved')
    } catch (ex) { alert('❌ ' + ex.message) }
    setBusy(null)
  }

  const del = async (c) => {
    if (!confirm(`"${c.name}" country delete করবেন?\\n\\nএই country's সব number products delete হবে।`)) return
    setBusy(c.name)
    try {
      for (const p of c.products) {
        await manageApi(session, 'product.delete', { id: p.id })
      }
      load()
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const toggleStatus = async (c) => {
    setBusy(c.name)
    try {
      for (const p of c.products) {
        await manageApi(session, 'product.set_status', { id: p.id, status: c.active ? 'inactive' : 'active' })
      }
      load()
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const exportCSV = () => {
    const header = 'Country,Number Types,Starting Price,Status\n'
    const rows = list.map(c => `"${c.name}",${c.typeCount},${c.startPrice ?? ''},${c.active ? 'Active' : 'Inactive'}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'number-countries.csv'; a.click()
    URL.revokeObjectURL(url)
    setExportOpen(false)
  }

  const discountPct = (start, prev) => {
    if (!prev || !start || Number(prev) <= Number(start)) return 0
    return Math.round((1 - Number(start) / Number(prev)) * 100)
  }

  const inp = {
    width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 9, color: '#fff', fontSize: '.9rem', outline: 'none', boxSizing: 'border-box',
  }
  const lbl = { display: 'block', fontSize: '.82rem', color: 'var(--silver)', marginBottom: 5, fontWeight: 500 }

  const stats = [
    { label: 'Total Countries', value: totalCountries.toLocaleString(), desc: 'Countries available', color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '🌐' },
    { label: 'Active Countries', value: activeCountries.toLocaleString(), desc: 'Currently active', color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '🗄' },
    { label: 'Total Number Types', value: totalTypes.toLocaleString(), desc: 'Available number types', color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '📦' },
    { label: 'Available for Purchase', value: available.toLocaleString(), desc: 'Customers can buy', color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '👥' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>📞</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Numbers Management</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>Manage available countries for virtual phone numbers. Customers can purchase numbers from these countries.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
          <button onClick={() => setExportOpen(!exportOpen)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem' }}>↓ Export ▾</button>
          {exportOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 140, marginTop: 6, background: '#1a0d0e', border: '1px solid rgba(232,35,42,.4)', borderRadius: 10, padding: 6, zIndex: 10, minWidth: 150 }}>
              <button onClick={exportCSV} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>Export as CSV</button>
            </div>
          )}
          <button onClick={openCreate} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>+ Add Country</button>
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
        <input placeholder="Search country by name…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 220, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }} style={{ padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.85rem', cursor: 'pointer', minWidth: 160 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Statuses</option>
          <option value="active" style={{ background: '#1a0d0e' }}>Active</option>
          <option value="inactive" style={{ background: '#1a0d0e' }}>Inactive</option>
        </select>
        <button onClick={clearFilters} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontSize: '.85rem', fontWeight: 600 }}>Clear Filters</button>
        <button onClick={load} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>Refresh</button>
      </div>

      {/* Country Cards */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
      ) : pageItems.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', background: 'rgba(255,255,255,.02)', borderRadius: 14, border: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ fontSize: '1.05rem', color: '#fff', marginBottom: 6 }}>No countries configured</div>
          <div style={{ fontSize: '.88rem', marginBottom: 16 }}>Add a country to make virtual numbers available for purchase.</div>
          <button onClick={openCreate} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>+ Add Country</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {pageItems.map(c => {
            const flag = flagUrl(c.name)
            const disc = discountPct(c.startPrice, c.prevPrice)
            return (
              <div key={c.name} style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.25)', borderRadius: 14, padding: 18, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {flag ? (
                      <img src={flag} alt={c.name} style={{ width: 44, height: 30, borderRadius: 4, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 44, height: 30, borderRadius: 4, background: 'rgba(255,255,255,.08)', display: 'grid', placeItems: 'center', fontSize: 11, color: 'var(--muted)' }}>{c.name.slice(0, 2).toUpperCase()}</div>
                    )}
                    <span style={{ fontWeight: 700, color: '#fff', fontSize: '1rem' }}>{c.name}</span>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: '.74rem', fontWeight: 600, background: c.active ? 'rgba(46,204,113,.15)' : 'rgba(255,255,255,.06)', color: c.active ? '#2ecc71' : 'var(--muted)', border: `1px solid ${c.active ? 'rgba(46,204,113,.4)' : 'rgba(255,255,255,.15)'}` }}>
                    ● {c.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>Number Types</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{c.typeCount}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>Starting Price</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{c.startPrice != null ? `৳${c.startPrice.toLocaleString('en-IN')}` : '—'}</div>
                    {disc > 0 && <div style={{ fontSize: '.7rem', color: '#2ecc71' }}>Save {disc}%</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setDetail(c)} style={{ flex: 1, padding: '9px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '.85rem' }}>View Details</button>
                  <button onClick={() => setMenuOpen(menuOpen === c.name ? null : c.name)} style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 16 }}>⋯</button>
                </div>
                {menuOpen === c.name && (
                  <div style={{ position: 'absolute', bottom: 60, right: 18, background: '#1a0d0e', border: '1px solid rgba(232,35,42,.4)', borderRadius: 10, padding: 6, zIndex: 20, minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
                    <button onClick={() => { setMenuOpen(null); openEdit(c) }} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>Edit Country</button>
                    <button onClick={() => { setMenuOpen(null); toggleStatus(c) }} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>{c.active ? 'Deactivate' : 'Activate'}</button>
                    <button onClick={() => { setMenuOpen(null); del(c) }} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>Delete</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Showing {list.length === 0 ? 0 : (curPage - 1) * pageSize + 1} to {Math.min(curPage * pageSize, list.length)} of {list.length.toLocaleString()} countries</span>
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
            {[20, 50, 100].map(n => <option key={n} value={n} style={{ background: '#1a0d0e' }}>{n} / page</option>)}
          </select>
        </div>
      </div>

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setDetail(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 480, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Country Details</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              {flagUrl(detail.name) && <img src={flagUrl(detail.name)} alt={detail.name} style={{ width: 52, height: 36, borderRadius: 4, objectFit: 'cover' }} />}
              <div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '1.05rem' }}>{detail.name}</div>
                <div style={{ fontSize: '.82rem', color: detail.active ? '#2ecc71' : 'var(--muted)' }}>{detail.active ? '● Active' : '● Inactive'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '.9rem' }}>
              <div><span style={{ color: 'var(--muted)' }}>Number Types: </span><b style={{ color: '#fff' }}>{Array.from(detail.types).join(', ') || '—'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Starting Price: </span><b style={{ color: '#fff' }}>{detail.startPrice != null ? `৳${detail.startPrice.toLocaleString('en-IN')}` : '—'}</b></div>
              {detail.prevPrice && <div><span style={{ color: 'var(--muted)' }}>Previous Price: </span><b style={{ color: '#fff' }}>৳{detail.prevPrice.toLocaleString('en-IN')}</b> <span style={{ color: '#2ecc71' }}>(Save {discountPct(detail.startPrice, detail.prevPrice)}%)</span></div>}
              {detail.notes && <div><span style={{ color: 'var(--muted)' }}>Notes: </span><span style={{ color: 'var(--silver)' }}>{detail.notes}</span></div>}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => { setDetail(null); openEdit(detail) }} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Edit Country</button>
              <button onClick={() => { setDetail(null); toggleStatus(detail) }} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>{detail.active ? 'Deactivate' : 'Activate'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setShowForm(false)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{editing ? 'Edit Country' : 'Add Country'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Country Name *</label><input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} style={inp} placeholder="e.g. USA" /></div>
                <div><label style={lbl}>Country Code</label><input value={form.country_code} onChange={e => setForm({ ...form, country_code: e.target.value.toUpperCase() })} style={inp} placeholder="US" maxLength={2} /></div>
              </div>
              <div>
                <label style={lbl}>Supported Service Types</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {SERVICE_TYPES.map(t => (
                    <label key={t} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '7px 12px', borderRadius: 8, border: form.number_types.includes(t) ? '1px solid rgba(232,35,42,.5)' : '1px solid rgba(255,255,255,.12)', background: form.number_types.includes(t) ? 'rgba(232,35,42,.12)' : 'transparent', cursor: 'pointer', fontSize: '.82rem', color: '#fff' }}>
                      <input type="checkbox" checked={form.number_types.includes(t)} onChange={e => setForm({ ...form, number_types: e.target.checked ? [...form.number_types, t] : form.number_types.filter(x => x !== t) })} style={{ accentColor: '#e8232a' }} />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Starting Price (৳) *</label><input type="number" min="0" value={form.starting_price} onChange={e => setForm({ ...form, starting_price: e.target.value })} style={inp} /></div>
                <div><label style={lbl}>Previous Price (৳) — optional</label><input type="number" min="0" value={form.previous_price} onChange={e => setForm({ ...form, previous_price: e.target.value })} style={inp} /></div>
              </div>
              {form.previous_price && form.starting_price && Number(form.previous_price) > Number(form.starting_price) && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(46,204,113,.1)', color: '#2ecc71', fontSize: '.85rem' }}>
                  Discount: Save {discountPct(form.starting_price, form.previous_price)}%
                </div>
              )}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: '.88rem', color: '#fff' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} style={{ accentColor: '#e8232a', width: 17, height: 17 }} /> Active
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: '.88rem', color: '#fff' }}>
                  <input type="checkbox" checked={form.is_public} onChange={e => setForm({ ...form, is_public: e.target.checked })} style={{ accentColor: '#e8232a', width: 17, height: 17 }} /> Visible on Public Site
                </label>
              </div>
              <div><label style={lbl}>Admin Notes (optional)</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Internal notes…" /></div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={busy === 'save'} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  {busy === 'save' ? 'Saving…' : editing ? 'Update Country' : 'Add Country'}
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
