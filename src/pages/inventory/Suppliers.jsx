import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'
import { useLang } from '../../i18n/LanguageContext.jsx'
import { tr } from '../../i18n/translations.js'

// Supplier extra fields are stored in the `contact` column as JSON:
// { contact_person, phone, email, address, status }
// Backward compat: if contact is not JSON, treat it as the contact person name.
function parseContact(s) {
  if (!s) return { contact_person: '', phone: '', email: '', address: '', status: 'active' }
  try {
    const j = JSON.parse(s)
    if (typeof j === 'object' && j !== null) return { contact_person: j.contact_person || '', phone: j.phone || '', email: j.email || '', address: j.address || '', status: j.status || 'active' }
  } catch { /* not JSON */ }
  return { contact_person: s, phone: '', email: '', address: '', status: 'active' }
}
const packContact = (f) => JSON.stringify({ contact_person: f.contact_person, phone: f.phone, email: f.email, address: f.address, status: f.status })

const initials = (name) => (name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
const avatarColors = ['#e8232a', '#4da3ff', '#2ecc71', '#f5b942', '#e84393', '#8e44ad', '#00cec9']
const avatarColor = (name) => avatarColors[(name || '').length % avatarColors.length]

export function Suppliers({ session, role }) {
  const { lang } = useLang()
  const [suppliers, setSuppliers] = useState([])
  const [purchases, setPurchases] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState('all')
  const [sortF, setSortF] = useState('newest')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [selected, setSelected] = useState(new Set())
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '', notes: '', status: 'active' })
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(null)
  const [detail, setDetail] = useState(null)
  const [purchaseForm, setPurchaseForm] = useState({ supplier_id: '', product_id: '', qty: '', unit_cost: '' })
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [s, p, pr] = await Promise.all([
        manageApi(session, 'supplier.list'),
        manageApi(session, 'purchase.list', { limit: 500, offset: 0 }).catch(() => ({ items: [] })),
        manageApi(session, 'product.list', { limit: 500, offset: 0 }).catch(() => ({ items: [] })),
      ])
      setSuppliers(s.items || [])
      setPurchases(p.items || [])
      setProducts(pr.items || [])
    } catch (e) { alert(e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Enriched supplier data ──
  const enriched = suppliers.map(s => {
    const c = parseContact(s.contact)
    const supPurchases = purchases.filter(p => String(p.supplier_id) === String(s.id))
    const totalAmount = supPurchases.reduce((sum, p) => sum + Number(p.qty || 0) * Number(p.unit_cost || 0), 0)
    const lastPurchase = supPurchases.length > 0 ? supPurchases.sort((a, b) => new Date(b.purchased_at || b.created_at) - new Date(a.purchased_at || a.created_at))[0] : null
    return { ...s, ...c, purchaseCount: supPurchases.length, totalAmount, lastPurchase, supPurchases }
  })

  // ── Stats ──
  const totalSuppliers = enriched.length
  const activeSuppliers = enriched.filter(s => s.status === 'active').length
  const totalPurchases = purchases.length
  const totalPurchaseValue = purchases.reduce((sum, p) => sum + Number(p.qty || 0) * Number(p.unit_cost || 0), 0)

  // ── Filters ──
  let list = enriched
  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter(s => s.name.toLowerCase().includes(q) || s.contact_person.toLowerCase().includes(q) || s.phone.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || (s.address || '').toLowerCase().includes(q))
  }
  if (statusF !== 'all') list = list.filter(s => s.status === statusF)

  if (sortF === 'newest') list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  else if (sortF === 'oldest') list = [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  else if (sortF === 'az') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
  else if (sortF === 'za') list = [...list].sort((a, b) => b.name.localeCompare(a.name))

  const clearFilters = () => { setSearch(''); setStatusF('all'); setSortF('newest'); setPage(1) }

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
    else setSelected(new Set(pageItems.map(s => s.id)))
  }

  const saveSupplier = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return alert(tr(lang, 'sup_alert_name'))
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return alert(tr(lang, 'sup_alert_email'))
    setBusy('supplier')
    try {
      const payload = { name: form.name.trim(), contact: packContact(form), notes: form.notes.trim() || undefined }
      if (editing) {
        await manageApi(session, 'supplier.update', { id: editing.id, ...payload })
      } else {
        await manageApi(session, 'supplier.create', payload)
      }
      setForm({ name: '', contact_person: '', phone: '', email: '', address: '', notes: '', status: 'active' })
      setEditing(null)
      load()
      alert(tr(lang, 'sup_alert_saved'))
    } catch (ex) { alert(ex.message) }
    setBusy(null)
  }

  const startEdit = (s) => {
    setEditing(s)
    setForm({ name: s.name, contact_person: s.contact_person, phone: s.phone, email: s.email, address: s.address, notes: s.notes || '', status: s.status })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const del = async (s) => {
    if (!confirm('"' + s.name + '" ' + tr(lang, 'sup_confirm_deactivate') + '\n\n' + tr(lang, 'sup_confirm_deactivate_note'))) return
    setBusy(s.id)
    try {
      await manageApi(session, 'supplier.update', { id: s.id, contact: packContact({ ...s, status: 'inactive' }) })
      load()
    } catch (e) { alert(e.message) }
    setBusy(null)
  }

  const reactivate = async (s) => {
    setBusy(s.id)
    try {
      await manageApi(session, 'supplier.update', { id: s.id, contact: packContact({ ...s, status: 'active' }) })
      load()
    } catch (e) { alert(e.message) }
    setBusy(null)
  }

  const savePurchase = async (e) => {
    e.preventDefault()
    if (!purchaseForm.supplier_id) return alert(tr(lang, 'sup_alert_supplier'))
    if (!purchaseForm.product_id) return alert(tr(lang, 'sup_alert_product'))
    const qty = Number(purchaseForm.qty), unit = Number(purchaseForm.unit_cost)
    if (!qty || qty <= 0) return alert(tr(lang, 'sup_alert_qty'))
    if (!unit || unit < 0) return alert(tr(lang, 'sup_alert_unit'))
    const total = qty * unit
    if (!confirm(tr(lang, 'sup_confirm_purchase') + '\n\n' + tr(lang, 'sup_confirm_purchase_product') + ' ' + products.find(p => String(p.id) === String(purchaseForm.product_id))?.name + '\n' + tr(lang, 'sup_confirm_purchase_qty') + ' ' + qty + ' × ৳' + unit.toFixed(2) + ' = ৳' + total.toLocaleString('en-IN') + '\n\n' + tr(lang, 'sup_confirm_purchase_stock'))) return
    setBusy('purchase')
    try {
      await manageApi(session, 'purchase.record', {
        supplier_id: Number(purchaseForm.supplier_id), product_id: Number(purchaseForm.product_id),
        qty, unit_cost: unit, currency: 'BDT',
      })
      setPurchaseForm({ supplier_id: '', product_id: '', qty: '', unit_cost: '' })
      load()
      alert(tr(lang, 'sup_alert_purchase_saved'))
    } catch (ex) { alert(ex.message) }
    setBusy(null)
  }

  const exportCSV = () => {
    const header = tr(lang, 'sup_csv_header') + '\n'
    const rowsCsv = list.map(s => `"${s.name}","${s.contact_person}","${s.phone}","${s.email}",${s.purchaseCount},${s.totalAmount},${s.status},${s.lastPurchase ? new Date(s.lastPurchase.purchased_at || s.lastPurchase.created_at).toLocaleDateString('en-GB') : ''}`).join('\n')
    const blob = new Blob([header + rowsCsv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'suppliers.csv'; document.body.appendChild(a); a.click(); a.remove()
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
    { label: tr(lang, 'sup_stat_total'), value: totalSuppliers.toLocaleString(), desc: tr(lang, 'sup_stat_total_desc'), color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '👥' },
    { label: tr(lang, 'sup_stat_active'), value: activeSuppliers.toLocaleString(), desc: tr(lang, 'sup_stat_active_desc'), color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '📦' },
    { label: tr(lang, 'sup_stat_purchases'), value: totalPurchases.toLocaleString(), desc: tr(lang, 'sup_stat_purchases_desc'), color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '🚚' },
    { label: tr(lang, 'sup_stat_value'), value: `৳ ${totalPurchaseValue.toLocaleString('en-IN')}`, desc: tr(lang, 'sup_stat_value_desc'), color: '#c084fc', bg: 'rgba(192,132,252,.15)', icon: '💰' },
  ]

  const purchaseTotal = (Number(purchaseForm.qty) || 0) * (Number(purchaseForm.unit_cost) || 0)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>👥</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>{tr(lang, 'sup_title')}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'sup_subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={exportCSV} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem' }}>↓ {tr(lang, 'sup_export')}</button>
          <button onClick={() => { setEditing(null); setForm({ name: '', contact_person: '', phone: '', email: '', address: '', notes: '', status: 'active' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>+ {tr(lang, 'sup_add_supplier')}</button>
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

      {/* Two Form Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 20, alignItems: 'start' }}>
        {/* Add New Supplier */}
        <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, padding: 20 }}>
          <b style={{ color: '#fff', display: 'block', marginBottom: 14 }}>{editing ? tr(lang, 'sup_edit_supplier') : tr(lang, 'sup_add_new_supplier')}</b>
          <form onSubmit={saveSupplier} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>{tr(lang, 'sup_f_name')}</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp} placeholder={tr(lang, 'sup_ph_name')} /></div>
              <div><label style={lbl}>{tr(lang, 'sup_f_contact')}</label><input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} style={inp} placeholder={tr(lang, 'sup_ph_contact')} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>{tr(lang, 'sup_f_phone')}</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inp} placeholder={tr(lang, 'sup_ph_phone')} /></div>
              <div><label style={lbl}>{tr(lang, 'sup_f_email')}</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inp} placeholder="supplier@example.com" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>{tr(lang, 'sup_f_address')}</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} style={inp} placeholder={tr(lang, 'sup_ph_address')} /></div>
              <div><label style={lbl}>{tr(lang, 'sup_f_notes')}</label><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={inp} placeholder={tr(lang, 'sup_ph_notes')} /></div>
            </div>
            <div>
              <label style={lbl}>{tr(lang, 'sup_f_status')}</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                <option value="active" style={{ background: '#1a0d0e' }}>{tr(lang, 'sup_opt_active')}</option>
                <option value="inactive" style={{ background: '#1a0d0e' }}>{tr(lang, 'sup_opt_inactive')}</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={busy === 'supplier'} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {busy === 'supplier' ? tr(lang, 'sup_saving') : editing ? tr(lang, 'sup_update_supplier') : tr(lang, 'sup_add_supplier_plus')}
              </button>
              <button type="button" onClick={() => { setForm({ name: '', contact_person: '', phone: '', email: '', address: '', notes: '', status: 'active' }); setEditing(null) }} style={{ padding: '11px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>{tr(lang, 'sup_reset')}</button>
            </div>
          </form>
        </div>

        {/* Purchase Record */}
        <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, padding: 20 }}>
          <b style={{ color: '#fff', display: 'block', marginBottom: 14 }}>{tr(lang, 'sup_purchase_title')}</b>
          <form onSubmit={savePurchase} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>{tr(lang, 'sup_pf_supplier')}</label>
                <select value={purchaseForm.supplier_id} onChange={e => setPurchaseForm({ ...purchaseForm, supplier_id: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="" style={{ background: '#1a0d0e' }}>{tr(lang, 'sup_ph_select_supplier')}</option>
                  {enriched.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id} style={{ background: '#1a0d0e' }}>{s.name}</option>)}
                </select>
              </div>
              <div><label style={lbl}>{tr(lang, 'sup_pf_product')}</label>
                <select value={purchaseForm.product_id} onChange={e => setPurchaseForm({ ...purchaseForm, product_id: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="" style={{ background: '#1a0d0e' }}>{tr(lang, 'sup_ph_select_product')}</option>
                  {products.map(p => <option key={p.id} value={p.id} style={{ background: '#1a0d0e' }}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>{tr(lang, 'sup_pf_qty')}</label><input type="number" min="1" value={purchaseForm.qty} onChange={e => setPurchaseForm({ ...purchaseForm, qty: e.target.value })} style={inp} placeholder="0" /></div>
              <div><label style={lbl}>{tr(lang, 'sup_pf_unit')}</label><input type="number" step="0.01" min="0" value={purchaseForm.unit_cost} onChange={e => setPurchaseForm({ ...purchaseForm, unit_cost: e.target.value })} style={inp} placeholder="0.00" /></div>
              <div><label style={lbl}>{tr(lang, 'sup_pf_total')}</label><input value={`৳ ${purchaseTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} disabled style={{ ...inp, opacity: 0.6, fontWeight: 700 }} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={busy === 'purchase'} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {busy === 'purchase' ? tr(lang, 'sup_saving') : tr(lang, 'sup_add_purchase')}
              </button>
              <button type="button" onClick={() => setPurchaseForm({ supplier_id: '', product_id: '', qty: '', unit_cost: '' })} style={{ padding: '11px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>{tr(lang, 'sup_reset')}</button>
            </div>
          </form>
        </div>
      </div>

      {/* All Suppliers */}
      <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,.06)' }}><b style={{ color: '#fff', fontSize: '1.02rem' }}>{tr(lang, 'sup_all_suppliers')}</b></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '14px 18px', alignItems: 'center' }}>
          <input placeholder={tr(lang, 'sup_search_ph')} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ flex: 1, minWidth: 200, padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
          <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 130 }}>
            <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'sup_all_statuses')}</option>
            <option value="active" style={{ background: '#1a0d0e' }}>{tr(lang, 'sup_opt_active')}</option>
            <option value="inactive" style={{ background: '#1a0d0e' }}>{tr(lang, 'sup_opt_inactive')}</option>
          </select>
          <select value={sortF} onChange={e => setSortF(e.target.value)} style={{ ...selStyle, minWidth: 140 }}>
            <option value="newest" style={{ background: '#1a0d0e' }}>{tr(lang, 'sup_sort_newest')}</option>
            <option value="oldest" style={{ background: '#1a0d0e' }}>{tr(lang, 'sup_sort_oldest')}</option>
            <option value="az" style={{ background: '#1a0d0e' }}>{tr(lang, 'sup_sort_az')}</option>
            <option value="za" style={{ background: '#1a0d0e' }}>{tr(lang, 'sup_sort_za')}</option>
          </select>
          <button onClick={load} style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontSize: '.85rem', fontWeight: 600 }}>{tr(lang, 'sup_filter')}</button>
          <button onClick={clearFilters} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>{tr(lang, 'sup_reset')}</button>
          <button onClick={load} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>{tr(lang, 'sup_refresh')}</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}><input type="checkbox" checked={pageItems.length > 0 && selected.size === pageItems.length} onChange={toggleSelectAll} style={{ accentColor: '#e8232a' }} /></th>
                {['#', tr(lang, 'sup_th_name'), tr(lang, 'sup_th_contact'), tr(lang, 'sup_th_phone'), tr(lang, 'sup_th_email'), tr(lang, 'sup_th_purchases'), tr(lang, 'sup_th_amount'), tr(lang, 'sup_th_status'), tr(lang, 'sup_th_last'), tr(lang, 'sup_th_actions')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <td style={{ padding: '12px 14px' }}><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} style={{ accentColor: '#e8232a' }} /></td>
                  <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '.85rem' }}>{(curPage - 1) * pageSize + i + 1}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: avatarColor(s.name), display: 'grid', placeItems: 'center', fontSize: '.75rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials(s.name)}</div>
                      <span style={{ color: '#fff', fontSize: '.88rem', fontWeight: 600 }}>{s.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '.85rem', color: 'var(--silver)' }}>{s.contact_person || '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: '.85rem', color: 'var(--silver)' }}>{s.phone || '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: '.85rem', color: 'var(--silver)' }}>{s.email || '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: '.85rem', color: '#fff', fontWeight: 600 }}>{s.purchaseCount}</td>
                  <td style={{ padding: '12px 14px', fontSize: '.85rem', color: '#fff', fontWeight: 600 }}>৳ {s.totalAmount.toLocaleString('en-IN')}</td>
                  <td style={{ padding: '12px 14px' }}>
                    {s.status === 'active' ? (
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.74rem', fontWeight: 600, background: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)' }}>{tr(lang, 'sup_opt_active')}</span>
                    ) : (
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.74rem', fontWeight: 600, background: 'rgba(245,185,66,.15)', color: '#f5b942', border: '1px solid rgba(245,185,66,.4)' }}>{tr(lang, 'sup_opt_inactive')}</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '.82rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{s.lastPurchase ? new Date(s.lastPurchase.purchased_at || s.lastPurchase.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                    <button title={tr(lang, 'sup_view')} onClick={() => setDetail(s)} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer', marginRight: 3 }}>👁</button>
                    <button title={tr(lang, 'sup_edit')} onClick={() => startEdit(s)} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(245,185,66,.4)', background: 'rgba(245,185,66,.1)', color: '#f5b942', cursor: 'pointer', marginRight: 3 }}>✏️</button>
                    {s.status === 'active' ? (
                      <button title={tr(lang, 'sup_deactivate')} onClick={() => del(s)} disabled={busy === s.id} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer' }}>🗑</button>
                    ) : (
                      <button title={tr(lang, 'sup_reactivate')} onClick={() => reactivate(s)} disabled={busy === s.id} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(46,204,113,.4)', background: 'rgba(46,204,113,.1)', color: '#2ecc71', cursor: 'pointer' }}>✓</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>{tr(lang, 'sup_empty_title')}</div>
            <div style={{ fontSize: '.85rem' }}>{tr(lang, 'sup_empty_sub')}</div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>{tr(lang, 'sup_loading')}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{tr(lang, 'sup_showing')} {list.length === 0 ? 0 : (curPage - 1) * pageSize + 1} {tr(lang, 'sup_showing_to')} {Math.min(curPage * pageSize, list.length)} {tr(lang, 'sup_showing_of')} {list.length.toLocaleString()} {tr(lang, 'sup_showing_suppliers')}</span>
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
              {[5, 10, 25, 50].map(n => <option key={n} value={n} style={{ background: '#1a0d0e' }}>{n} {tr(lang, 'sup_per_page')}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setDetail(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{tr(lang, 'sup_detail_title')}</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '.9rem', marginBottom: 16 }}>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'sup_d_name')}{' '}</span><b style={{ color: '#fff' }}>{detail.name}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'sup_d_contact')}{' '}</span><b style={{ color: '#fff' }}>{detail.contact_person || '—'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'sup_d_phone')}{' '}</span><b style={{ color: '#fff' }}>{detail.phone || '—'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'sup_d_email')}{' '}</span><b style={{ color: '#fff' }}>{detail.email || '—'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'sup_d_address')}{' '}</span><span style={{ color: 'var(--silver)' }}>{detail.address || '—'}</span></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'sup_d_status')}{' '}</span><b style={{ color: '#fff' }}>{detail.status}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'sup_d_purchases')}{' '}</span><b style={{ color: '#fff' }}>{detail.purchaseCount}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'sup_d_amount')}{' '}</span><b style={{ color: '#fff' }}>৳{detail.totalAmount.toLocaleString('en-IN')}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'sup_d_notes')}{' '}</span><span style={{ color: 'var(--silver)' }}>{detail.notes || '—'}</span></div>
            </div>
            <b style={{ color: '#fff', display: 'block', marginBottom: 10 }}>{tr(lang, 'sup_detail_history')}</b>
            {detail.supPurchases.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'sup_no_purchases')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detail.supPurchases.map((p, i) => (
                  <div key={i} style={{ padding: '10px 12px', borderRadius: 9, background: 'rgba(255,255,255,.03)', fontSize: '.85rem', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: '#fff' }}>{p.cashskillbd_products?.name || (tr(lang, 'sup_product_hash') + p.product_id)} × {p.qty}</span>
                    <span style={{ color: 'var(--muted)' }}>৳{(Number(p.qty) * Number(p.unit_cost)).toLocaleString('en-IN')} · {new Date(p.purchased_at || p.created_at).toLocaleDateString('en-GB')}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => { setDetail(null); startEdit(detail) }} style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{tr(lang, 'sup_edit_supplier')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
