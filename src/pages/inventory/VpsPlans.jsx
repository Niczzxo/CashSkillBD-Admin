// VPS Plans Management — CashSkillBD Admin (full CRUD + edit drawer)
import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'
import { supabase } from '../../lib/supabase.js'

const COUNTRY_CODES = {
  usa: 'us', us: 'us', germany: 'de', uk: 'gb', 'united kingdom': 'gb',
  netherlands: 'nl', singapore: 'sg', canada: 'ca', france: 'fr',
  india: 'in', japan: 'jp', australia: 'au', brazil: 'br',
}
const COUNTRY_TABS = ['All', 'USA', 'Germany', 'UK', 'Netherlands', 'Singapore', 'Canada', 'France', 'Others']

const DEFAULT_CYCLES = {
  monthly: { enabled: true, discount: 0 },
  '3months': { enabled: true, discount: 5 },
  '6months': { enabled: true, discount: 10 },
  yearly: { enabled: true, discount: 15 },
}
const CYCLE_META = {
  monthly: { label: 'Monthly', months: 1, suffix: '/mo' },
  '3months': { label: '3 Months', months: 3, suffix: '/3mo' },
  '6months': { label: '6 Months', months: 6, suffix: '/6mo' },
  yearly: { label: 'Annual', months: 12, suffix: '/yr' },
}

function specsOf(p) {
  try { return typeof p.specs === 'string' ? JSON.parse(p.specs) : (p.specs || {}) } catch { return {} }
}
function countryOf(p) {
  const s = specsOf(p)
  const text = `${p.name || ''} ${s.country || ''} ${s.location || ''}`.toLowerCase()
  if (text.includes('usa') || text.includes('america')) return 'USA'
  if (text.includes('germany') || text.includes('german')) return 'Germany'
  if (text.includes('uk') || text.includes('united kingdom') || text.includes('britain')) return 'UK'
  if (text.includes('netherlands') || text.includes('dutch')) return 'Netherlands'
  if (text.includes('singapore')) return 'Singapore'
  if (text.includes('canada')) return 'Canada'
  if (text.includes('france') || text.includes('french')) return 'France'
  return 'Others'
}
const flagUrl = (country) => {
  const code = COUNTRY_CODES[(country || '').toLowerCase()]
  return code ? `https://flagcdn.com/w40/${code}.png` : null
}
const cyclePrice = (base, cycle) => base * cycle.months * (1 - cycle.discount / 100)

const blankForm = {
  name: '', description: '', country: '', location: '', isp: '', product_url: '',
  selling_price: '', original_price: '', currency: 'USD',
  billing_cycles: JSON.parse(JSON.stringify(DEFAULT_CYCLES)),
  specs: [
    { k: 'CPU', v: '' }, { k: 'RAM', v: '' }, { k: 'Storage', v: '' },
    { k: 'OS', v: 'Windows' }, { k: 'Admin Access', v: 'Full Admin Access' },
    { k: 'DDoS Protection', v: 'Included' }, { k: 'Bandwidth', v: '' },
    { k: 'Port Speed', v: '1 Gbps' }, { k: 'Dedicated IP', v: '1x IPv4' },
  ],
  image_url: '', image_alt: '', is_popular: false, stock_qty: '0',
  status: 'active', sort_order: '0', features: [''],
}

export function VpsPlans({ session, role }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [countryF, setCountryF] = useState('all')
  const [tabF, setTabF] = useState('All')
  const [ispF, setIspF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [drawer, setDrawer] = useState(null) // null | { mode: 'create'|'edit', plan }
  const [tab, setTab] = useState('basic')
  const [form, setForm] = useState(blankForm)
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(null)
  const [dirty, setDirty] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const j = await manageApi(session, 'product.list', { product_type: 'vps', limit: 500, offset: 0 })
      const list = (j.items || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      setPlans(list)
    } catch (e) { alert('❌ ' + e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Stats ──
  const total = plans.length
  const active = plans.filter(p => p.status === 'active').length
  const totalStock = plans.reduce((s, p) => s + Number(p.stock_qty || 0), 0)
  const outOfStock = plans.filter(p => Number(p.stock_qty || 0) <= 0).length
  const countryCounts = {}
  plans.forEach(p => { const c = countryOf(p); countryCounts[c] = (countryCounts[c] || 0) + 1 })

  // ── Filters ──
  let list = plans
  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter(p => (p.name || '').toLowerCase().includes(q) || countryOf(p).toLowerCase().includes(q) || (specsOf(p).isp || '').toLowerCase().includes(q) || JSON.stringify(specsOf(p)).toLowerCase().includes(q))
  }
  if (tabF !== 'All') list = list.filter(p => countryOf(p) === tabF)
  if (countryF !== 'all') list = list.filter(p => countryOf(p) === countryF)
  if (ispF !== 'all') list = list.filter(p => (specsOf(p).isp || '') === ispF)
  if (statusF !== 'all') list = list.filter(p => p.status === statusF)

  const clearFilters = () => { setSearch(''); setCountryF('all'); setTabF('All'); setIspF('all'); setStatusF('all'); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const pageItems = list.slice((curPage - 1) * pageSize, curPage * pageSize)
  const isps = [...new Set(plans.map(p => specsOf(p).isp).filter(Boolean))]

  const setF = (patch) => { setForm(f => ({ ...f, ...patch })); setDirty(true) }

  const openCreate = () => {
    setForm(JSON.parse(JSON.stringify(blankForm)))
    setDrawer({ mode: 'create' }); setTab('basic'); setDirty(false)
  }
  const openEdit = (p) => {
    const s = specsOf(p)
    const specArr = Array.isArray(s.spec_list) ? s.spec_list : [
      { k: 'CPU', v: s.cpu || '' }, { k: 'RAM', v: s.ram || '' }, { k: 'Storage', v: s.storage || '' },
      { k: 'OS', v: s.os || 'Windows' }, { k: 'Admin Access', v: s.admin_access || 'Full Admin Access' },
      { k: 'DDoS Protection', v: s.ddos_protection || 'Included' }, { k: 'Bandwidth', v: s.bandwidth || '' },
      { k: 'Port Speed', v: s.port_speed || '1 Gbps' }, { k: 'Dedicated IP', v: s.dedicated_ip || '1x IPv4' },
    ]
    setForm({
      name: p.name || '', description: p.description || '',
      country: s.country || '', location: s.location || '', isp: s.isp || '', product_url: s.product_url || '',
      selling_price: p.selling_price ?? '', original_price: s.original_price || '', currency: p.currency || 'USD',
      billing_cycles: { ...JSON.parse(JSON.stringify(DEFAULT_CYCLES)), ...(s.billing_cycles || {}) },
      specs: specArr,
      image_url: p.image_url || '', image_alt: s.image_alt || '',
      is_popular: !!p.is_popular, stock_qty: p.stock_qty ?? 0,
      status: p.status || 'active', sort_order: p.sort_order ?? 0,
      features: Array.isArray(p.features) && p.features.length ? p.features : (p.features || ['']),
    })
    setDrawer({ mode: 'edit', plan: p }); setTab('basic'); setDirty(false)
  }

  const closeDrawer = () => {
    if (dirty && !confirm('Unsaved changes will be lost. Close anyway?')) return
    setDrawer(null); setDirty(false)
  }

  const buildPayload = () => {
    const base = Number(form.selling_price) || 0
    if (base < 0) throw new Error('Price cannot be negative')
    for (const [k, c] of Object.entries(form.billing_cycles)) {
      if (c.discount < 0 || c.discount > 100) throw new Error(`${CYCLE_META[k].label} discount must be 0–100`)
    }
    const specs = {
      country: form.country, location: form.location, isp: form.isp, product_url: form.product_url,
      original_price: form.original_price || undefined, image_alt: form.image_alt || undefined,
      billing_cycles: form.billing_cycles,
      spec_list: form.specs.filter(s => s.k.trim()),
    }
    // Also keep flat keys for backward compat with public Shop.jsx
    const specMap = {}
    form.specs.forEach(s => { if (s.k.trim()) specMap[s.k.toLowerCase().replace(/\s+/g, '_')] = s.v })
    Object.assign(specs, specMap)
    return {
      name: form.name.trim(), description: form.description.trim(),
      selling_price: base, currency: form.currency,
      stock_qty: Number(form.stock_qty) || 0, status: form.status,
      is_popular: form.is_popular, sort_order: Number(form.sort_order) || 0,
      image_url: form.image_url.trim() || null, specs,
      features: form.features.filter(f => f.trim()),
    }
  }

  const save = async () => {
    if (!form.name.trim()) return alert('Plan name দিন')
    if (!form.selling_price) return alert('Monthly price দিন')
    setBusy('save')
    try {
      const payload = buildPayload()
      if (drawer.mode === 'edit') {
        await manageApi(session, 'product.update', { id: drawer.plan.id, ...payload, category: 'VPS', product_type: 'vps' })
      } else {
        await manageApi(session, 'product.create', { ...payload, category: 'VPS', product_type: 'vps', sku: `VPS-${Date.now().toString(36).toUpperCase()}` })
      }
      setDrawer(null); setDirty(false)
      load()
      alert('✅ VPS plan saved')
    } catch (ex) { alert('❌ ' + ex.message) }
    setBusy(null)
  }

  const del = async (p) => {
    if (!confirm(`"${p.name}" VPS plan delete করবেন?`)) return
    setBusy(p.id)
    try { await manageApi(session, 'product.delete', { id: p.id }); load() }
    catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const duplicate = async (p) => {
    setBusy(p.id)
    try {
      await manageApi(session, 'product.create', {
        sku: (p.sku || '') + '-COPY', name: p.name + ' (Copy)', description: p.description,
        category: 'VPS', product_type: 'vps', selling_price: p.selling_price,
        currency: p.currency, stock_qty: p.stock_qty, specs: p.specs, is_popular: false,
        sort_order: (p.sort_order || 0) + 1, features: p.features,
      })
      load()
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const togglePopular = async (p) => {
    setBusy(p.id)
    try { await manageApi(session, 'product.update', { id: p.id, is_popular: !p.is_popular }); load() }
    catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const toggleStatus = async (p) => {
    setBusy(p.id)
    try { await manageApi(session, 'product.set_status', { id: p.id, status: p.status === 'active' ? 'inactive' : 'active' }); load() }
    catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const moveOrder = async (p, dir) => {
    const idx = plans.findIndex(x => x.id === p.id)
    const swapWith = plans[idx + dir]
    if (!swapWith) return
    setBusy(p.id)
    try {
      await manageApi(session, 'product.update', { id: p.id, sort_order: swapWith.sort_order ?? idx + dir })
      await manageApi(session, 'product.update', { id: swapWith.id, sort_order: p.sort_order ?? idx })
      load()
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const uploadImage = async (file) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return alert('Image must be under 5MB')
    setBusy('upload')
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `vps/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('cashskillbd').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('cashskillbd').getPublicUrl(path)
      setF({ image_url: data.publicUrl })
    } catch (e) { alert('❌ Upload failed: ' + e.message) }
    setBusy(null)
  }

  const exportCSV = () => {
    const header = 'Name,Country,ISP,Monthly Price,Stock,Status\n'
    const rows = list.map(p => `"${p.name || ''}",${countryOf(p)},${specsOf(p).isp || ''},${p.selling_price || 0},${p.stock_qty || 0},${p.status || ''}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'vps-plans.csv'; a.click()
    URL.revokeObjectURL(url)
    setExportOpen(false)
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
    { label: 'Total Plans', value: total.toLocaleString(), desc: 'All VPS plans', color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '🗄' },
    { label: 'Active Plans', value: active.toLocaleString(), desc: 'Currently active', color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '▶' },
    { label: 'Total In Stock', value: totalStock.toLocaleString(), desc: 'Ready to deploy', color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '📦' },
    { label: 'Out of Stock', value: outOfStock.toLocaleString(), desc: 'Temporarily unavailable', color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '📁' },
  ]

  const TABS = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'pricing', label: 'Pricing & Billing' },
    { id: 'specs', label: 'Specifications' },
    { id: 'config', label: 'Configuration' },
    { id: 'media', label: 'Media & Status' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>🗄</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>VPS Plans Management</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>Manage VPS plans, pricing, billing cycles and server configurations.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
          <button onClick={() => setExportOpen(!exportOpen)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem' }}>↓ Export ▾</button>
          {exportOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 160, marginTop: 6, background: '#1a0d0e', border: '1px solid rgba(232,35,42,.4)', borderRadius: 10, padding: 6, zIndex: 10, minWidth: 150 }}>
              <button onClick={exportCSV} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>Export as CSV</button>
            </div>
          )}
          <button onClick={openCreate} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>+ Add VPS Plan</button>
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
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <input placeholder="Search by plan name, location, ISP or specifications…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 220, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
        <select value={countryF} onChange={e => { setCountryF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Countries</option>
          {COUNTRY_TABS.filter(t => t !== 'All').map(t => <option key={t} value={t} style={{ background: '#1a0d0e' }}>{t}</option>)}
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

      {/* Country Tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {COUNTRY_TABS.map(t => {
          const count = t === 'All' ? total : (countryCounts[t] || 0)
          const active = tabF === t
          const flag = t !== 'All' && t !== 'Others' ? flagUrl(t) : null
          return (
            <button key={t} onClick={() => { setTabF(t); setPage(1) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, cursor: 'pointer', border: active ? '1px solid rgba(232,35,42,.6)' : '1px solid rgba(255,255,255,.1)', background: active ? 'rgba(232,35,42,.15)' : 'rgba(255,255,255,.03)', color: active ? '#fff' : 'var(--silver)', fontSize: '.85rem', fontWeight: active ? 600 : 400 }}>
              {flag && <img src={flag} alt="" style={{ width: 20, height: 14, borderRadius: 2, objectFit: 'cover' }} />}
              {t === 'Others' && <span style={{ fontSize: 14 }}>🌐</span>}
              {t} ({count})
            </button>
          )
        })}
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
      ) : pageItems.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', background: 'rgba(255,255,255,.02)', borderRadius: 14, border: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>No VPS plans found</div>
          <div style={{ fontSize: '.85rem' }}>No plans match your filters. Add a new VPS plan to get started.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {pageItems.map(p => {
            const s = specsOf(p)
            const country = countryOf(p)
            const flag = flagUrl(country)
            const stock = Number(p.stock_qty || 0)
            const base = Number(p.selling_price || 0)
            const cycles = s.billing_cycles || DEFAULT_CYCLES
            const annual = cycles.yearly?.enabled ? cyclePrice(base, { months: 12, discount: cycles.yearly.discount || 0 }) : base * 12
            const origMonthly = s.original_price ? Number(s.original_price) : null
            const discountPct = origMonthly && origMonthly > base ? Math.round((1 - base / origMonthly) * 100) : 0
            const specList = Array.isArray(s.spec_list) ? s.spec_list.filter(x => x.k.trim()) : [
              s.cpu && { k: 'CPU', v: s.cpu }, s.ram && { k: 'RAM', v: s.ram }, s.storage && { k: 'Storage', v: s.storage },
              s.os && { k: 'OS', v: s.os }, s.admin_access && s.admin_access !== 'No' && { k: 'Admin', v: s.admin_access },
              s.ddos_protection && s.ddos_protection !== 'No' && { k: 'DDoS', v: s.ddos_protection },
              s.bandwidth && { k: 'Bandwidth', v: `${s.bandwidth} @ ${s.port_speed || ''}` },
              s.dedicated_ip && { k: 'Dedicated IP', v: `${s.dedicated_ip} (${s.isp || '—'})` },
            ].filter(Boolean)
            return (
              <div key={p.id} style={{ background: 'linear-gradient(180deg, #0b0b10, #080405)', border: p.is_popular ? '1px solid rgba(192,132,252,.5)' : '1px solid rgba(232,35,42,.25)', borderRadius: 14, padding: 18, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {p.is_popular && (
                  <div style={{ position: 'absolute', top: 0, left: 0, background: 'linear-gradient(135deg, #c084fc, #8b5cf6)', color: '#fff', fontSize: '.72rem', fontWeight: 700, padding: '5px 14px', borderBottomRightRadius: 12 }}>Most Popular</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, marginTop: p.is_popular ? 14 : 0 }}>
                  {p.image_url ? (
                    <img src={p.image_url} alt={s.image_alt || p.name} style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 8 }} />
                  ) : (
                    <div style={{ width: 64, height: 64, display: 'grid', placeItems: 'center', fontSize: 38, color: '#4da3ff' }}>🗄</div>
                  )}
                  {flag && <img src={flag} alt={country} style={{ width: 28, height: 19, borderRadius: 3, objectFit: 'cover' }} />}
                </div>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: '.72rem', fontWeight: 600, background: stock <= 0 ? 'rgba(232,35,42,.15)' : 'rgba(46,204,113,.15)', color: stock <= 0 ? '#ff6b6b' : '#2ecc71', border: `1px solid ${stock <= 0 ? 'rgba(232,35,42,.4)' : 'rgba(46,204,113,.4)'}` }}>
                    ● {stock} in stock
                  </span>
                </div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '1rem', marginBottom: 2 }}>{p.name}</div>
                <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: 12 }}>{p.description || `${country} VPS Server`}</div>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>{p.currency === 'USD' ? '$' : '৳'}{base.toFixed(2)}</span>
                  <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}> /mo</span>
                </div>
                <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: 2 }}>
                  billed ${(annual).toFixed(2)}/yr
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  {origMonthly && <span style={{ fontSize: '.82rem', color: 'var(--muted)', textDecoration: 'line-through' }}>${origMonthly.toFixed(2)}</span>}
                  {discountPct > 0 && <span style={{ fontSize: '.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(46,204,113,.15)', color: '#2ecc71' }}>Save {discountPct}%</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14, flex: 1 }}>
                  {specList.slice(0, 8).map((line, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: '.8rem', color: 'var(--silver)' }}>
                      <span style={{ color: '#2ecc71', fontWeight: 700 }}>✓</span>{line.v ? `${line.k}: ${line.v}` : line.k}
                    </div>
                  ))}
                  {specList.length === 0 && <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>No specs configured</div>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setDetail(p)} style={{ flex: 1, padding: '9px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '.85rem' }}>View Details</button>
                  <button onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)} style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 16 }}>⋯</button>
                </div>
                {menuOpen === p.id && (
                  <div style={{ position: 'absolute', bottom: 60, right: 18, background: '#1a0d0e', border: '1px solid rgba(232,35,42,.4)', borderRadius: 10, padding: 6, zIndex: 20, minWidth: 170, boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
                    <button onClick={() => { setMenuOpen(null); openEdit(p) }} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>Edit Plan</button>
                    <button onClick={() => { setMenuOpen(null); duplicate(p) }} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>Duplicate</button>
                    <button onClick={() => { setMenuOpen(null); togglePopular(p) }} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>{p.is_popular ? 'Remove Most Popular' : 'Mark Most Popular'}</button>
                    <button onClick={() => { setMenuOpen(null); toggleStatus(p) }} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>{p.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                    <button onClick={() => { setMenuOpen(null); moveOrder(p, -1) }} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>Move Up</button>
                    <button onClick={() => { setMenuOpen(null); moveOrder(p, 1) }} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>Move Down</button>
                    <button onClick={() => { setMenuOpen(null); del(p) }} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>Delete</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Showing {list.length === 0 ? 0 : (curPage - 1) * pageSize + 1} to {Math.min(curPage * pageSize, list.length)} of {list.length.toLocaleString()} VPS plans</span>
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
            {[5, 10, 20, 50].map(n => <option key={n} value={n} style={{ background: '#1a0d0e' }}>{n} / page</option>)}
          </select>
        </div>
      </div>

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setDetail(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 500, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>VPS Plan Details</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '.9rem' }}>
              <div><span style={{ color: 'var(--muted)' }}>Name: </span><b style={{ color: '#fff' }}>{detail.name}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Description: </span><span style={{ color: 'var(--silver)' }}>{detail.description || '—'}</span></div>
              <div><span style={{ color: 'var(--muted)' }}>Country: </span><b style={{ color: '#fff' }}>{countryOf(detail)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>ISP: </span><b style={{ color: '#fff' }}>{specsOf(detail).isp || '—'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Price: </span><b style={{ color: '#fff' }}>{detail.currency === 'USD' ? '$' : '৳'}{Number(detail.selling_price || 0).toFixed(2)} /mo</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Stock: </span><b style={{ color: '#fff' }}>{detail.stock_qty ?? 0}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Status: </span><b style={{ color: '#fff' }}>{detail.status}</b></div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Drawer */}
      {drawer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)' }} onClick={closeDrawer} />
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(560px, 100vw)', background: '#140809', borderLeft: '1px solid rgba(232,35,42,.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem' }}>{drawer.mode === 'edit' ? 'Edit VPS Plan' : 'Add VPS Plan'}</h3>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.82rem' }}>Update plan details, pricing, specifications and server information.</p>
                </div>
                <button onClick={closeDrawer} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 22 }}>×</button>
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 16, flexWrap: 'wrap' }}>
                {TABS.map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '.82rem', fontWeight: tab === t.id ? 600 : 400, background: tab === t.id ? '#e8232a' : 'rgba(255,255,255,.05)', color: '#fff' }}>{t.label}</button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {tab === 'basic' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Plan Name *</label><input value={form.name} onChange={e => setF({ name: e.target.value })} style={inp} placeholder="e.g. USA ADMIN RDP #3" /></div>
                  </div>
                  <div><label style={lbl}>Short Description *</label><textarea value={form.description} onChange={e => setF({ description: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Performance-focused Windows Remote Desktop" /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div><label style={lbl}>Country *</label><input value={form.country} onChange={e => setF({ country: e.target.value })} style={inp} placeholder="United States" /></div>
                    <div><label style={lbl}>Server Location *</label><input value={form.location} onChange={e => setF({ location: e.target.value })} style={inp} placeholder="New York, NY" /></div>
                  </div>
                  <div><label style={lbl}>ISP / Provider *</label><input value={form.isp} onChange={e => setF({ isp: e.target.value })} style={inp} placeholder="e.g. Comcast" /></div>
                  <div><label style={lbl}>Product URL (Optional)</label><input value={form.product_url} onChange={e => setF({ product_url: e.target.value })} style={inp} placeholder="https://…" /></div>
                </>
              )}

              {tab === 'pricing' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b style={{ color: '#fff' }}>Pricing & Billing</b>
                    <select value={form.currency} onChange={e => setF({ currency: e.target.value })} style={{ ...inp, width: 'auto', cursor: 'pointer' }}>
                      <option value="USD" style={{ background: '#1a0d0e' }}>USD ($)</option>
                      <option value="BDT" style={{ background: '#1a0d0e' }}>BDT (৳)</option>
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div><label style={lbl}>Monthly Price *</label><input type="number" step="0.01" min="0" value={form.selling_price} onChange={e => setF({ selling_price: e.target.value })} style={inp} /></div>
                    <div><label style={lbl}>Original Price (Optional)</label><input type="number" step="0.01" min="0" value={form.original_price} onChange={e => setF({ original_price: e.target.value })} style={inp} placeholder="Strike-through price" /></div>
                  </div>
                  <div><label style={lbl}>Billing Cycle Discounts</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {Object.entries(CYCLE_META).map(([key, meta]) => {
                        const c = form.billing_cycles[key] || { enabled: true, discount: 0 }
                        const base = Number(form.selling_price) || 0
                        const discPrice = cyclePrice(base, { months: meta.months, discount: c.discount })
                        return (
                          <div key={key} style={{ padding: 12, borderRadius: 10, border: c.enabled ? '1px solid rgba(232,35,42,.5)' : '1px solid rgba(255,255,255,.1)', background: c.enabled ? 'rgba(232,35,42,.08)' : 'rgba(255,255,255,.02)' }}>
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: 8 }}>
                              <span style={{ fontSize: '.85rem', fontWeight: 600, color: '#fff' }}>{meta.label}</span>
                              <input type="checkbox" checked={c.enabled} onChange={e => setF({ billing_cycles: { ...form.billing_cycles, [key]: { ...c, enabled: e.target.checked } } })} style={{ accentColor: '#e8232a', width: 16, height: 16 }} />
                            </label>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <input type="number" min="0" max="100" value={c.discount} onChange={e => setF({ billing_cycles: { ...form.billing_cycles, [key]: { ...c, discount: Number(e.target.value) } } })} style={{ ...inp, padding: '6px 8px', fontSize: '.85rem' }} />
                              <span style={{ fontSize: '.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>% off</span>
                            </div>
                            <div style={{ marginTop: 6, fontSize: '.85rem', color: '#fff', fontWeight: 600 }}>
                              {form.currency === 'USD' ? '$' : '৳'}{discPrice.toFixed(2)}{meta.suffix}
                            </div>
                            <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>Total: {form.currency === 'USD' ? '$' : '৳'}{discPrice.toFixed(2)} for {meta.months} mo</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}

              {tab === 'specs' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b style={{ color: '#fff' }}>Specifications</b>
                    <button onClick={() => setF({ specs: [...form.specs, { k: '', v: '' }] })} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontSize: '.82rem' }}>+ Add Spec</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {form.specs.map((s, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input value={s.k} onChange={e => { const arr = [...form.specs]; arr[idx].k = e.target.value; setF({ specs: arr }) }} style={{ ...inp, flex: 1 }} placeholder="Label (e.g. CPU)" />
                        <input value={s.v} onChange={e => { const arr = [...form.specs]; arr[idx].v = e.target.value; setF({ specs: arr }) }} style={{ ...inp, flex: 1 }} placeholder="Value (e.g. 4 vCores)" />
                        <button onClick={() => { const arr = form.specs.filter((_, i) => i !== idx); setF({ specs: arr }) }} style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer' }}>×</button>
                      </div>
                    ))}
                  </div>
                  <div>
                    <label style={lbl}>Customer-Facing Features (one per line)</label>
                    {form.features.map((f, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                        <input value={f} onChange={e => { const arr = [...form.features]; arr[idx] = e.target.value; setF({ features: arr }) }} style={{ ...inp, flex: 1 }} placeholder="Feature" />
                        <button onClick={() => setF({ features: form.features.filter((_, i) => i !== idx) })} style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer' }}>×</button>
                      </div>
                    ))}
                    <button onClick={() => setF({ features: [...form.features, ''] })} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.82rem' }}>+ Add Feature</button>
                  </div>
                </>
              )}

              {tab === 'config' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div><label style={lbl}>Stock Quantity</label><input type="number" min="0" value={form.stock_qty} onChange={e => setF({ stock_qty: e.target.value })} style={inp} /></div>
                    <div><label style={lbl}>Sort Order</label><input type="number" value={form.sort_order} onChange={e => setF({ sort_order: e.target.value })} style={inp} /></div>
                  </div>
                  <div>
                    <label style={lbl}>Status</label>
                    <select value={form.status} onChange={e => setF({ status: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                      <option value="active" style={{ background: '#1a0d0e' }}>Active</option>
                      <option value="inactive" style={{ background: '#1a0d0e' }}>Inactive</option>
                    </select>
                    <small style={{ color: 'var(--muted)', fontSize: '.75rem' }}>Inactive plans will not be shown to customers.</small>
                  </div>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,.03)', borderRadius: 10, cursor: 'pointer' }}>
                    <span>
                      <span style={{ display: 'block', fontWeight: 600, color: '#fff', fontSize: '.9rem' }}>Mark as Most Popular</span>
                      <span style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Show "Most Popular" badge on this plan</span>
                    </span>
                    <input type="checkbox" checked={form.is_popular} onChange={e => setF({ is_popular: e.target.checked })} style={{ accentColor: '#e8232a', width: 20, height: 20 }} />
                  </label>
                </>
              )}

              {tab === 'media' && (
                <>
                  <div><label style={lbl}>Plan Image</label>
                    {form.image_url ? (
                      <div style={{ position: 'relative', marginBottom: 10 }}>
                        <img src={form.image_url} alt={form.image_alt || 'Plan image'} style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 10, background: 'rgba(255,255,255,.03)' }} />
                        <button onClick={() => setF({ image_url: '' })} style={{ position: 'absolute', top: 8, right: 8, padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(0,0,0,.6)', color: '#ff6b6b', cursor: 'pointer' }}>Remove</button>
                      </div>
                    ) : (
                      <div style={{ padding: 30, textAlign: 'center', border: '1px dashed rgba(255,255,255,.2)', borderRadius: 10, color: 'var(--muted)', fontSize: '.85rem', marginBottom: 10 }}>No image uploaded</div>
                    )}
                    <label style={{ display: 'block', padding: '10px', textAlign: 'center', borderRadius: 9, border: '1px solid rgba(232,35,42,.4)', color: '#ff6b6b', cursor: 'pointer', fontSize: '.88rem', fontWeight: 600 }}>
                      {busy === 'upload' ? 'Uploading…' : 'Change Image (Upload)'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadImage(e.target.files[0])} />
                    </label>
                    <small style={{ color: 'var(--muted)', fontSize: '.72rem' }}>Recommended: 800×600 (PNG, JPG, WebP), max 5MB</small>
                  </div>
                  <div><label style={lbl}>Image URL (or paste URL)</label><input value={form.image_url} onChange={e => setF({ image_url: e.target.value })} style={inp} placeholder="https://…" /></div>
                  <div><label style={lbl}>Image Alt Text</label><input value={form.image_alt} onChange={e => setF({ image_alt: e.target.value })} style={inp} placeholder="Alt text for accessibility" /></div>
                </>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={closeDrawer} style={{ padding: '11px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={save} disabled={busy === 'save'} style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>
                {busy === 'save' ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
