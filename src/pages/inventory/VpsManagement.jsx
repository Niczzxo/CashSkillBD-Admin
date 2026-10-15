import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'
import { useLang } from '../../i18n/LanguageContext.jsx'
import { tr } from '../../i18n/translations.js'

const COUNTRY_CODES = {
  usa: 'us', us: 'us', germany: 'de', uk: 'gb', 'united kingdom': 'gb',
  netherlands: 'nl', singapore: 'sg', canada: 'ca', france: 'fr',
  india: 'in', japan: 'jp', australia: 'au', brazil: 'br',
}
const COUNTRY_TABS = ['All', 'USA', 'Germany', 'UK', 'Netherlands', 'Singapore', 'Canada', 'France', 'Others']



const countryOf = (p) => {
  const s = specsOf(p)
  const text = `${p.name || ''} ${s.country || ''} ${s.location || ''}`.toLowerCase()
  if (text.includes('usa') || text.includes('us ') || text.includes('america')) return 'USA'
  if (text.includes('germany') || text.includes('german')) return 'Germany'
  if (text.includes('uk') || text.includes('united kingdom') || text.includes('britain')) return 'UK'
  if (text.includes('netherlands') || text.includes('dutch')) return 'Netherlands'
  if (text.includes('singapore')) return 'Singapore'
  if (text.includes('canada')) return 'Canada'
  if (text.includes('france') || text.includes('french')) return 'France'
  return 'Others'
}

function specsOf(p) {
  try { return typeof p.specs === 'string' ? JSON.parse(p.specs) : (p.specs || {}) } catch { return {} }
}

export function VpsManagement({ session }) {
  const { lang } = useLang()
  const BILLING = [
    { v: 'monthly', label: tr(lang, 'vpsm_billing_monthly'), months: 1, discount: 0 },
    { v: '3months', label: tr(lang, 'vpsm_billing_3months'), months: 3, discount: 0.05 },
    { v: '6months', label: tr(lang, 'vpsm_billing_6months'), months: 6, discount: 0.10 },
    { v: 'yearly', label: tr(lang, 'vpsm_billing_yearly'), months: 12, discount: 0.15 },
  ]
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [countryF, setCountryF] = useState('all')
  const [tabF, setTabF] = useState('All')
  const [ispF, setIspF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [detail, setDetail] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', selling_price: '', original_price: '', stock_qty: '0', country: '', location: '', isp: '', cpu: '', ram: '', storage: '', os: 'Windows', bandwidth: '', port_speed: '1 Gbps', dedicated_ip: '1x IPv4', admin_access: true, ddos: true, is_popular: false, status: 'active', billing_cycle: 'yearly' })
  const [busy, setBusy] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const j = await manageApi(session, 'product.list', { product_type: 'vps', limit: 500, offset: 0 })
      const list = (j.items || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      setPlans(list)
    } catch (e) { alert(e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Stats ──
  const total = plans.length
  const active = plans.filter(p => p.status === 'active').length
  const totalStock = plans.reduce((s, p) => s + Number(p.stock_qty || 0), 0)
  const outOfStock = plans.filter(p => Number(p.stock_qty || 0) <= 0).length

  // ── Country counts ──
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

  const priceOf = (p, billing) => {
    const base = Number(p.selling_price || 0)
    const total = base * billing.months * (1 - billing.discount)
    return { monthly: base, total, original: Number(p.specs?.original_price || 0) || null }
  }
  const fmtPrice = (n, currency) => `${currency === 'USD' ? '$' : '৳'}${Number(n || 0).toFixed(2)}`

  const togglePopular = async (p) => {
    setBusy(p.id)
    try {
      await manageApi(session, 'product.update', { id: p.id, is_popular: !p.is_popular })
      load()
    } catch (e) { alert(e.message) }
    setBusy(null)
  }

  const toggleStatus = async (p) => {
    setBusy(p.id)
    try {
      await manageApi(session, 'product.set_status', { id: p.id, status: p.status === 'active' ? 'inactive' : 'active' })
      load()
    } catch (e) { alert(e.message) }
    setBusy(null)
  }

  const del = async (p) => {
    if (!confirm(`"${p.name}" ` + tr(lang, 'vpsm_delete_confirm'))) return
    setBusy(p.id)
    try {
      await manageApi(session, 'product.delete', { id: p.id })
      load()
    } catch (e) { alert(e.message) }
    setBusy(null)
  }

  const duplicate = async (p) => {
    setBusy(p.id)
    try {
      await manageApi(session, 'product.create', {
        sku: (p.sku || '') + '-COPY', name: p.name + ' ' + tr(lang, 'vpsm_copy_suffix'), description: p.description,
        category: 'VPS', product_type: 'vps', selling_price: p.selling_price,
        currency: p.currency, stock_qty: p.stock_qty, specs: p.specs, is_popular: false,
      })
      load()
    } catch (e) { alert(e.message) }
    setBusy(null)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return alert(tr(lang, 'vpsm_plan_name_required'))
    if (!form.selling_price) return alert(tr(lang, 'vpsm_price_required'))
    setBusy('save')
    try {
      const specs = {
        cpu: form.cpu, ram: form.ram, storage: form.storage, os: form.os,
        bandwidth: form.bandwidth, port_speed: form.port_speed, dedicated_ip: form.dedicated_ip,
        admin_access: form.admin_access ? 'Full Admin Access' : 'No',
        ddos_protection: form.ddos ? 'Included' : 'No',
        country: form.country, location: form.location, isp: form.isp,
        original_price: form.original_price || undefined,
      }
      if (editing) {
        await manageApi(session, 'product.update', { id: editing.id, name: form.name, description: form.description, selling_price: form.selling_price, stock_qty: form.stock_qty, status: form.status, is_popular: form.is_popular, billing_cycle: form.billing_cycle, specs })
      } else {
        await manageApi(session, 'product.create', { name: form.name, description: form.description, category: 'VPS', product_type: 'vps', selling_price: form.selling_price, currency: 'USD', stock_qty: form.stock_qty, status: form.status, is_popular: form.is_popular, billing_cycle: form.billing_cycle, specs })
      }
      setShowForm(false); setEditing(null)
      load()
    } catch (ex) { alert(ex.message) }
    setBusy(null)
  }

  const openEdit = (p) => {
    const s = specsOf(p)
    setEditing(p)
    setForm({
      name: p.name || '', description: p.description || '', selling_price: p.selling_price ?? '',
      original_price: s.original_price || '', stock_qty: p.stock_qty ?? 0,
      country: s.country || '', location: s.location || '', isp: s.isp || '',
      cpu: s.cpu || '', ram: s.ram || '', storage: s.storage || '', os: s.os || 'Windows',
      bandwidth: s.bandwidth || '', port_speed: s.port_speed || '1 Gbps',
      dedicated_ip: s.dedicated_ip || '1x IPv4',
      admin_access: s.admin_access !== 'No', ddos: s.ddos_protection !== 'No',
      is_popular: !!p.is_popular, status: p.status || 'active', billing_cycle: p.billing_cycle || 'yearly',
    })
    setShowForm(true)
  }

  const exportCSV = () => {
    const header = 'Name,Country,ISP,Monthly Price,Stock,Status\n'
    const rows = list.map(p => `"${p.name || ''}",${countryOf(p)},${specsOf(p).isp || ''},${p.selling_price || 0},${p.stock_qty || 0},${p.status || ''}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'vps-plans.csv'; document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 500)
    setExportOpen(false)
  }

  const selStyle = {
    padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 8, color: '#fff', fontSize: '.82rem', outline: 'none', cursor: 'pointer',
  }
  const inp = {
    width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 9, color: '#fff', fontSize: '.9rem', outline: 'none', boxSizing: 'border-box',
  }
  const lbl = { display: 'block', fontSize: '.82rem', color: 'var(--silver)', marginBottom: 5, fontWeight: 500 }

  const stats = [
    { label: tr(lang, 'vpsm_stat_total_label'), value: total.toLocaleString(), desc: tr(lang, 'vpsm_stat_total_desc'), color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '🗄' },
    { label: tr(lang, 'vpsm_stat_active_label'), value: active.toLocaleString(), desc: tr(lang, 'vpsm_stat_active_desc'), color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '🌐' },
    { label: tr(lang, 'vpsm_stat_stock_label'), value: totalStock.toLocaleString(), desc: tr(lang, 'vpsm_stat_stock_desc'), color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '🗄' },
    { label: tr(lang, 'vpsm_stat_oos_label'), value: outOfStock.toLocaleString(), desc: tr(lang, 'vpsm_stat_oos_desc'), color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '📦' },
  ]

  const flagUrl = (country) => {
    const code = COUNTRY_CODES[country.toLowerCase()] || null
    return code ? `https://flagcdn.com/w40/${code}.png` : null
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(8,189,245,.12)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0, border: '1px solid rgba(8,189,245,.3)' }}>🗄</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>{tr(lang, 'vpsm_title')}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'vpsm_subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
          <button onClick={() => setExportOpen(!exportOpen)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem' }}>
            ↓ {tr(lang, 'vpsm_export')} ▾
          </button>
          {exportOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 160, marginTop: 6, background: '#1a0d0e', border: '1px solid rgba(232,35,42,.4)', borderRadius: 10, padding: 6, zIndex: 10, minWidth: 150 }}>
              <button onClick={exportCSV} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>{tr(lang, 'vpsm_export_csv')}</button>
            </div>
          )}
          <button onClick={() => { setEditing(null); setForm({ name: '', description: '', selling_price: '', original_price: '', stock_qty: '0', country: '', location: '', isp: '', cpu: '', ram: '', storage: '', os: 'Windows', bandwidth: '', port_speed: '1 Gbps', dedicated_ip: '1x IPv4', admin_access: true, ddos: true, is_popular: false, status: 'active', billing_cycle: 'yearly' }); setShowForm(true) }} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>
            + {tr(lang, 'vpsm_add_plan')}
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
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <input placeholder={tr(lang, 'vpsm_search_placeholder')} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 220, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
        <select value={countryF} onChange={e => { setCountryF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'vpsm_all_countries')}</option>
          {COUNTRY_TABS.filter(t => t !== 'All').map(t => <option key={t} value={t} style={{ background: '#1a0d0e' }}>{t}</option>)}
        </select>
        <select value={ispF} onChange={e => { setIspF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'vpsm_all_isps')}</option>
          {isps.map(i => <option key={i} value={i} style={{ background: '#1a0d0e' }}>{i}</option>)}
        </select>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'vpsm_all_statuses')}</option>
          <option value="active" style={{ background: '#1a0d0e' }}>{tr(lang, 'vpsm_active')}</option>
          <option value="inactive" style={{ background: '#1a0d0e' }}>{tr(lang, 'vpsm_inactive')}</option>
        </select>
        <button onClick={clearFilters} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontSize: '.85rem', fontWeight: 600 }}>{tr(lang, 'vpsm_clear_filters')}</button>
        <button onClick={load} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>{tr(lang, 'vpsm_refresh')}</button>
      </div>

      {/* Country Tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {COUNTRY_TABS.map(t => {
          const count = t === 'All' ? total : (countryCounts[t] || 0)
          const active = tabF === t
          const flag = t !== 'All' && t !== 'Others' ? flagUrl(t) : null
          return (
            <button key={t} onClick={() => { setTabF(t); setPage(1) }} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, cursor: 'pointer',
              border: active ? '1px solid rgba(232,35,42,.6)' : '1px solid rgba(255,255,255,.1)',
              background: active ? 'rgba(232,35,42,.15)' : 'rgba(255,255,255,.03)',
              color: active ? '#fff' : 'var(--silver)', fontSize: '.85rem', fontWeight: active ? 600 : 400,
            }}>
              {flag && <img src={flag} alt="" style={{ width: 20, height: 14, borderRadius: 2, objectFit: 'cover' }} />}
              {t === 'Others' && <span style={{ fontSize: 14 }}>🌐</span>}
              {t === 'All' ? tr(lang, 'vpsm_tab_all') : t === 'Others' ? tr(lang, 'vpsm_tab_others') : t} ({count})
            </button>
          )
        })}
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>{tr(lang, 'vpsm_loading')}</div>
      ) : pageItems.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', background: 'rgba(255,255,255,.02)', borderRadius: 14, border: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>{tr(lang, 'vpsm_no_results_title')}</div>
          <div style={{ fontSize: '.85rem' }}>{tr(lang, 'vpsm_no_results_desc')}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {pageItems.map(p => {
            const s = specsOf(p)
            const country = countryOf(p)
            const flag = flagUrl(country)
            const stock = Number(p.stock_qty || 0)
            const billing = BILLING.find(b => b.v === (p.billing_cycle || 'yearly')) || BILLING[3]
            const pr = priceOf(p, billing)
            const currency = p.currency || 'USD'
            const origMonthly = s.original_price ? Number(s.original_price) : null
            const discountPct = origMonthly && origMonthly > pr.monthly ? Math.round((1 - pr.monthly / origMonthly) * 100) : (billing.discount > 0 ? Math.round(billing.discount * 100) : 0)
            const specLines = [
              s.cpu && `${s.cpu}`,
              s.ram && `${s.ram} RAM`,
              s.storage && `${s.storage}`,
              s.os && `${s.os} OS`,
              s.admin_access && s.admin_access !== 'No' && tr(lang, 'vpsm_full_admin_access'),
              s.ddos_protection && s.ddos_protection !== 'No' && tr(lang, 'vpsm_ddos_protection'),
              s.bandwidth && `${s.bandwidth} @ ${s.port_speed || ''} ${tr(lang, 'vpsm_port')}`.trim(),
              s.dedicated_ip && `${tr(lang, 'vpsm_dedicated_ip')} (${s.isp || '—'})`,
            ].filter(Boolean)
            return (
              <div key={p.id} style={{ background: 'linear-gradient(180deg, #0b0b10, #080405)', border: p.is_popular ? '1px solid rgba(192,132,252,.5)' : '1px solid rgba(232,35,42,.25)', borderRadius: 14, padding: 18, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {p.is_popular && (
                  <div style={{ position: 'absolute', top: 0, left: 0, background: 'linear-gradient(135deg, #c084fc, #8b5cf6)', color: '#fff', fontSize: '.72rem', fontWeight: 700, padding: '5px 14px', borderBottomRightRadius: 12 }}>{tr(lang, 'vpsm_most_popular')}</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, marginTop: p.is_popular ? 14 : 0 }}>
                  <div style={{ width: 64, height: 64, display: 'grid', placeItems: 'center', fontSize: 38, color: '#4da3ff' }}>🗄</div>
                  {flag && <img src={flag} alt={country} style={{ width: 28, height: 19, borderRadius: 3, objectFit: 'cover' }} />}
                </div>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: '.72rem', fontWeight: 600, background: stock <= 0 ? 'rgba(232,35,42,.15)' : 'rgba(46,204,113,.15)', color: stock <= 0 ? '#ff6b6b' : '#2ecc71', border: `1px solid ${stock <= 0 ? 'rgba(232,35,42,.4)' : 'rgba(46,204,113,.4)'}` }}>
                    ● {stock} {tr(lang, 'vpsm_in_stock')}
                  </span>
                </div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '1rem', marginBottom: 2 }}>{p.name}</div>
                <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: 12 }}>{p.description || `${country} ${tr(lang, 'vpsm_vps_server')}`}</div>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>{fmtPrice(pr.monthly, currency)}</span>
                  <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{tr(lang, 'vpsm_per_month')}</span>
                </div>
                <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: 2 }}>
                  {tr(lang, 'vpsm_billed')} {fmtPrice(pr.total, currency)}/{billing.v === 'yearly' ? tr(lang, 'vpsm_yr') : billing.v === 'monthly' ? tr(lang, 'vpsm_mo') : billing.label.toLowerCase()}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  {origMonthly && <span style={{ fontSize: '.82rem', color: 'var(--muted)', textDecoration: 'line-through' }}>{fmtPrice(origMonthly, currency)}</span>}
                  {discountPct > 0 && <span style={{ fontSize: '.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(46,204,113,.15)', color: '#2ecc71' }}>{tr(lang, 'vpsm_save')} {discountPct}%</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14, flex: 1 }}>
                  {specLines.map((line, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: '.8rem', color: 'var(--silver)' }}>
                      <span style={{ color: '#2ecc71', fontWeight: 700 }}>✓</span>{line}
                    </div>
                  ))}
                  {specLines.length === 0 && <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>{tr(lang, 'vpsm_no_specs')}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setDetail(p)} style={{ flex: 1, padding: '9px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '.85rem' }}>
                    {tr(lang, 'vpsm_view_details')}
                  </button>
                  <button onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)} style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 16, position: 'relative' }}>⋯</button>
                </div>
                {menuOpen === p.id && (
                  <div style={{ position: 'absolute', bottom: 60, right: 18, background: '#1a0d0e', border: '1px solid rgba(232,35,42,.4)', borderRadius: 10, padding: 6, zIndex: 20, minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
                    <button onClick={() => { setMenuOpen(null); openEdit(p) }} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>{tr(lang, 'vpsm_edit_plan')}</button>
                    <button onClick={() => { setMenuOpen(null); duplicate(p) }} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>{tr(lang, 'vpsm_duplicate')}</button>
                    <button onClick={() => { setMenuOpen(null); togglePopular(p) }} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>{p.is_popular ? tr(lang, 'vpsm_remove_popular') : tr(lang, 'vpsm_mark_popular')}</button>
                    <button onClick={() => { setMenuOpen(null); toggleStatus(p) }} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>{p.status === 'active' ? tr(lang, 'vpsm_deactivate') : tr(lang, 'vpsm_activate')}</button>
                    <button onClick={() => { setMenuOpen(null); del(p) }} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>{tr(lang, 'vpsm_delete')}</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{tr(lang, 'vpsm_showing')} {list.length === 0 ? 0 : (curPage - 1) * pageSize + 1} {tr(lang, 'vpsm_to')} {Math.min(curPage * pageSize, list.length)} {tr(lang, 'vpsm_of')} {list.length.toLocaleString()} {tr(lang, 'vpsm_plans_word')}</span>
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
            {[5, 10, 20, 50].map(n => <option key={n} value={n} style={{ background: '#1a0d0e' }}>{n} {tr(lang, 'vpsm_per_page')}</option>)}
          </select>
        </div>
      </div>

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setDetail(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 500, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{tr(lang, 'vpsm_detail_title')}</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '.9rem' }}>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'vpsm_detail_name')} </span><b style={{ color: '#fff' }}>{detail.name}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'vpsm_detail_desc')} </span><span style={{ color: 'var(--silver)' }}>{detail.description || '—'}</span></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'vpsm_detail_country')} </span><b style={{ color: '#fff' }}>{countryOf(detail)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'vpsm_detail_isp')} </span><b style={{ color: '#fff' }}>{specsOf(detail).isp || '—'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'vpsm_detail_price')} </span><b style={{ color: '#fff' }}>{fmtPrice(detail.selling_price, detail.currency)} {tr(lang, 'vpsm_per_month')}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'vpsm_detail_stock')} </span><b style={{ color: '#fff' }}>{detail.stock_qty ?? 0}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'vpsm_detail_status')} </span><b style={{ color: '#fff' }}>{detail.status === 'active' ? tr(lang, 'vpsm_active') : tr(lang, 'vpsm_inactive')}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'vpsm_detail_popular')} </span><b style={{ color: '#fff' }}>{detail.is_popular ? tr(lang, 'vpsm_yes') : tr(lang, 'vpsm_no')}</b></div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setShowForm(false)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{editing ? tr(lang, 'vpsm_form_edit_title') : tr(lang, 'vpsm_form_add_title')}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>{tr(lang, 'vpsm_form_plan_name')}</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp} placeholder={tr(lang, 'vpsm_form_plan_name_placeholder')} /></div>
                <div><label style={lbl}>{tr(lang, 'vpsm_form_monthly_price')}</label><input type="number" step="0.01" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} style={inp} /></div>
              </div>
              <div><label style={lbl}>{tr(lang, 'vpsm_form_description')}</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>{tr(lang, 'vpsm_form_country')}</label><input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} style={inp} placeholder={tr(lang, 'vpsm_form_country_placeholder')} /></div>
                <div><label style={lbl}>{tr(lang, 'vpsm_form_location')}</label><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} style={inp} placeholder={tr(lang, 'vpsm_form_location_placeholder')} /></div>
                <div><label style={lbl}>{tr(lang, 'vpsm_form_isp')}</label><input value={form.isp} onChange={e => setForm({ ...form, isp: e.target.value })} style={inp} placeholder={tr(lang, 'vpsm_form_isp_placeholder')} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>{tr(lang, 'vpsm_form_vcores')}</label><input value={form.cpu} onChange={e => setForm({ ...form, cpu: e.target.value })} style={inp} placeholder={tr(lang, 'vpsm_form_vcores_placeholder')} /></div>
                <div><label style={lbl}>{tr(lang, 'vpsm_form_ram')}</label><input value={form.ram} onChange={e => setForm({ ...form, ram: e.target.value })} style={inp} placeholder={tr(lang, 'vpsm_form_ram_placeholder')} /></div>
                <div><label style={lbl}>{tr(lang, 'vpsm_form_ssd_storage')}</label><input value={form.storage} onChange={e => setForm({ ...form, storage: e.target.value })} style={inp} placeholder={tr(lang, 'vpsm_form_storage_placeholder')} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>{tr(lang, 'vpsm_form_os')}</label><input value={form.os} onChange={e => setForm({ ...form, os: e.target.value })} style={inp} /></div>
                <div><label style={lbl}>{tr(lang, 'vpsm_form_bandwidth')}</label><input value={form.bandwidth} onChange={e => setForm({ ...form, bandwidth: e.target.value })} style={inp} placeholder={tr(lang, 'vpsm_form_bandwidth_placeholder')} /></div>
                <div><label style={lbl}>{tr(lang, 'vpsm_form_port_speed')}</label><input value={form.port_speed} onChange={e => setForm({ ...form, port_speed: e.target.value })} style={inp} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>{tr(lang, 'vpsm_form_dedicated_ip')}</label><input value={form.dedicated_ip} onChange={e => setForm({ ...form, dedicated_ip: e.target.value })} style={inp} /></div>
                <div><label style={lbl}>{tr(lang, 'vpsm_form_original_price')}</label><input type="number" step="0.01" value={form.original_price} onChange={e => setForm({ ...form, original_price: e.target.value })} style={inp} placeholder={tr(lang, 'vpsm_form_optional')} /></div>
                <div><label style={lbl}>{tr(lang, 'vpsm_form_stock_qty')}</label><input type="number" value={form.stock_qty} onChange={e => setForm({ ...form, stock_qty: e.target.value })} style={inp} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>{tr(lang, 'vpsm_form_billing_cycle')}</label>
                  <select value={form.billing_cycle} onChange={e => setForm({ ...form, billing_cycle: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                    {BILLING.map(b => <option key={b.v} value={b.v} style={{ background: '#1a0d0e' }}>{b.label} {b.discount > 0 ? `(-${Math.round(b.discount * 100)}%)` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>{tr(lang, 'vpsm_form_status')}</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                    <option value="active" style={{ background: '#1a0d0e' }}>{tr(lang, 'vpsm_active')}</option>
                    <option value="inactive" style={{ background: '#1a0d0e' }}>{tr(lang, 'vpsm_inactive')}</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: '.88rem', color: '#fff' }}>
                  <input type="checkbox" checked={form.admin_access} onChange={e => setForm({ ...form, admin_access: e.target.checked })} style={{ accentColor: '#e8232a' }} /> {tr(lang, 'vpsm_full_admin_access')}
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: '.88rem', color: '#fff' }}>
                  <input type="checkbox" checked={form.ddos} onChange={e => setForm({ ...form, ddos: e.target.checked })} style={{ accentColor: '#e8232a' }} /> {tr(lang, 'vpsm_ddos_protection')}
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: '.88rem', color: '#fff' }}>
                  <input type="checkbox" checked={form.is_popular} onChange={e => setForm({ ...form, is_popular: e.target.checked })} style={{ accentColor: '#e8232a' }} /> {tr(lang, 'vpsm_most_popular')}
                </label>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={busy === 'save'} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  {busy === 'save' ? tr(lang, 'vpsm_saving') : editing ? tr(lang, 'vpsm_update_plan') : tr(lang, 'vpsm_add_plan')}
                </button>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '11px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>{tr(lang, 'vpsm_cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
