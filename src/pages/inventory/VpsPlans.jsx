import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'
import { money, err, isFinance } from './common.jsx'

const BILLING_CYCLES = [
  { v: 'hourly', l: 'প্রতি ঘণ্টা (Hourly)' },
  { v: 'monthly', l: 'মাসিক (Monthly)' },
  { v: '3months', l: '৩ মাস (3 Months)' },
  { v: '6months', l: '৬ মাস (6 Months)' },
  { v: 'yearly', l: 'বার্ষিক (Yearly)' },
]
const CYCLE_L = Object.fromEntries(BILLING_CYCLES.map(c => [c.v, c.l]))

const SPEC_FIELDS = [
  { key: 'cpu', label: 'CPU Cores', ph: 'e.g. 4 vCPU' },
  { key: 'ram', label: 'RAM', ph: 'e.g. 8 GB' },
  { key: 'storage', label: 'SSD/NVMe Storage', ph: 'e.g. 160 GB NVMe' },
  { key: 'os', label: 'Operating System', ph: 'e.g. Ubuntu 22.04' },
  { key: 'bandwidth', label: 'Bandwidth', ph: 'e.g. 4 TB' },
  { key: 'port_speed', label: 'Network Port Speed', ph: 'e.g. 1 Gbps' },
  { key: 'dedicated_ip', label: 'Dedicated IP', ph: 'e.g. 1x IPv4' },
  { key: 'admin_access', label: 'Administrator Access', ph: 'e.g. Full Root Access' },
  { key: 'ddos_protection', label: 'DDoS Protection', ph: 'e.g. Included' },
]

const blankForm = {
  name: '', category: 'VPS', description: '',
  selling_price: '', currency: 'BDT', billing_cycle: 'monthly',
  specs: {}, features: [''],
  order_button_label: 'Order Now',
  is_popular: false, status: 'active',
}

export function VpsPlans({ session, role }) {
  const fin = isFinance(role)
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const j = await manageApi(session, 'product.list', {
        product_type: 'vps', limit: 100, offset: 0,
      })
      const list = (j.items || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      setPlans(list)
    } catch (e) { err(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...blankForm, specs: {}, features: [''] })
    setShowForm(true); window.scrollTo(0, 0)
  }

  const openEdit = (p) => {
    setEditing(p)
    setForm({
      name: p.name || '', category: p.category || 'VPS',
      description: p.description || '',
      selling_price: p.selling_price ?? '', currency: p.currency || 'BDT',
      billing_cycle: p.billing_cycle || 'monthly',
      specs: { ...(p.specs || {}) },
      features: p.specs?.features?.length ? [...p.specs.features] : [''],
      order_button_label: p.order_button_label || 'Order Now',
      is_popular: !!p.is_popular, status: p.status || 'active',
    })
    setShowForm(true); window.scrollTo(0, 0)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return alert('প্ল্যানের নাম দিন')
    if (!form.selling_price || isNaN(Number(form.selling_price))) return alert('সঠিক প্রাইস দিন')
    setBusy(true)
    try {
      const specs = { ...form.specs, features: form.features.filter(f => f.trim()) }
      const payload = {
        name: form.name.trim(), category: form.category.trim() || 'VPS',
        description: form.description.trim(), product_type: 'vps',
        selling_price: Number(form.selling_price), currency: form.currency,
        billing_cycle: form.billing_cycle, specs,
        order_button_label: form.order_button_label.trim() || 'Order Now',
        is_popular: form.is_popular, status: form.status,
        stock_qty: 999, // VPS = unlimited
      }
      if (editing) {
        await manageApi(session, 'product.update', { id: editing.id, ...payload })
        // If marked popular, unmark all others
        if (form.is_popular) {
          for (const p of plans) {
            if (p.id !== editing.id && p.is_popular) {
              await manageApi(session, 'product.update', { id: p.id, is_popular: false })
            }
          }
        }
      } else {
        // Set sort_order to end
        const maxOrder = Math.max(0, ...plans.map(p => p.sort_order || 0))
        const res = await manageApi(session, 'product.create', { ...payload, sort_order: maxOrder + 1 })
        if (form.is_popular && res?.item?.id) {
          for (const p of plans) {
            if (p.is_popular) {
              await manageApi(session, 'product.update', { id: p.id, is_popular: false })
            }
          }
        }
      }
      setShowForm(false)
      await load()
    } catch (e) { err(e) }
    setBusy(false)
  }

  const toggleStatus = async (p) => {
    if (!fin) return
    try {
      await manageApi(session, 'product.update', {
        id: p.id, status: p.status === 'active' ? 'inactive' : 'active'
      })
      await load()
    } catch (e) { err(e) }
  }

  const togglePopular = async (p) => {
    if (!fin) return
    try {
      if (!p.is_popular) {
        // Unmark all others first
        for (const other of plans) {
          if (other.id !== p.id && other.is_popular) {
            await manageApi(session, 'product.update', { id: other.id, is_popular: false })
          }
        }
      }
      await manageApi(session, 'product.update', { id: p.id, is_popular: !p.is_popular })
      await load()
    } catch (e) { err(e) }
  }

  const remove = async (p) => {
    if (!fin) return
    if (!confirm(`"${p.name}" প্ল্যানটি ডিলিট করবেন? এই কাজটি ফিরিয়ে আনা যাবে না।`)) return
    try {
      await manageApi(session, 'product.delete', { id: p.id })
      await load()
    } catch (e) { err(e) }
  }

  const move = async (p, dir) => {
    if (!fin) return
    const idx = plans.findIndex(x => x.id === p.id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= plans.length) return
    const other = plans[swapIdx]
    try {
      await manageApi(session, 'product.update', { id: p.id, sort_order: other.sort_order || 0 })
      await manageApi(session, 'product.update', { id: other.id, sort_order: p.sort_order || 0 })
      await load()
    } catch (e) { err(e) }
  }

  const setF = (k, v) => setForm({ ...form, [k]: v })
  const setSpec = (k, v) => setForm({ ...form, specs: { ...form.specs, [k]: v } })
  const setFeature = (i, v) => {
    const f = [...form.features]; f[i] = v; setForm({ ...form, features: f })
  }
  const addFeature = () => setForm({ ...form, features: [...form.features, ''] })
  const delFeature = (i) => setForm({ ...form, features: form.features.filter((_, j) => j !== i) })

  if (loading) return <p style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>লোড হচ্ছে…</p>

  return (
    <div>
      <div className="sec-head">
        <h3>🖥️ VPS Plans Management</h3>
        <div className="spacer" />
        {fin && <button className="btn btn-sm btn-primary" onClick={openCreate}>➕ Add New Plan</button>}
      </div>
      <p style={{ color: 'var(--muted)', marginBottom: 18 }}>
        পাবলিক ওয়েবসাইটের VPS প্রাইসিং প্ল্যান এখান থেকে ম্যানেজ করো — সেভ করলেই সাইটে আপডেট হবে।
      </p>

      {showForm ? (
        <form onSubmit={save} className="card" style={{ marginBottom: 20, maxWidth: 720 }}>
          <h4 style={{ marginTop: 0 }}>{editing ? '✏️ প্ল্যান এডিট করো' : '➕ নতুন প্ল্যান'}</h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="f-label">প্ল্যানের নাম *</label>
              <input className="inp" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="e.g. VPS Starter" />
            </div>
            <div>
              <label className="f-label">ক্যাটাগরি</label>
              <input className="inp" value={form.category} onChange={e => setF('category', e.target.value)} placeholder="VPS / RDP" />
            </div>
          </div>

          <label className="f-label">সংক্ষিপ্ত বর্ণনা</label>
          <textarea className="inp" rows={2} value={form.description} onChange={e => setF('description', e.target.value)} placeholder="Short description…" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label className="f-label">প্রাইস *</label>
              <input className="inp" type="number" step="0.01" value={form.selling_price} onChange={e => setF('selling_price', e.target.value)} />
            </div>
            <div>
              <label className="f-label">কারেন্সি</label>
              <select className="inp" value={form.currency} onChange={e => setF('currency', e.target.value)}>
                <option value="BDT">BDT (৳)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            <div>
              <label className="f-label">বিলিং সাইকেল</label>
              <select className="inp" value={form.billing_cycle} onChange={e => setF('billing_cycle', e.target.value)}>
                {BILLING_CYCLES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </div>
          </div>

          <h4 style={{ margin: '18px 0 10px' }}>⚙️ স্পেসিফিকেশন</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {SPEC_FIELDS.map(s => (
              <div key={s.key}>
                <label className="f-label">{s.label}</label>
                <input className="inp" value={form.specs[s.key] || ''} onChange={e => setSpec(s.key, e.target.value)} placeholder={s.ph} />
              </div>
            ))}
          </div>

          <h4 style={{ margin: '18px 0 10px' }}>✨ অতিরিক্ত ফিচার</h4>
          {form.features.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input className="inp" value={f} onChange={e => setFeature(i, e.target.value)} placeholder={`Feature ${i + 1}`} style={{ flex: 1 }} />
              {form.features.length > 1 && (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => delFeature(i)}>✕</button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-ghost" onClick={addFeature}>➕ ফিচার যোগ করো</button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
            <div>
              <label className="f-label">অর্ডার বাটন লেবেল</label>
              <input className="inp" value={form.order_button_label} onChange={e => setF('order_button_label', e.target.value)} />
            </div>
            <div>
              <label className="f-label">স্ট্যাটাস</label>
              <select className="inp" value={form.status} onChange={e => setF('status', e.target.value)}>
                <option value="active">✅ Active (সাইটে দেখাবে)</option>
                <option value="inactive">⏸️ Inactive (লুকানো)</option>
              </select>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, padding: 12, background: 'rgba(232,35,42,.08)', borderRadius: 8, border: '1px solid rgba(232,35,42,.3)', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_popular} onChange={e => setF('is_popular', e.target.checked)} style={{ width: 18, height: 18 }} />
            <span>⭐ <b>Most Popular</b> ব্যাজ দেখাও (শুধু একটি প্ল্যানে থাকবে)</span>
          </label>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'সেভ হচ্ছে…' : '💾 সেভ করো'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>বাতিল</button>
          </div>
        </form>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {plans.map((p, idx) => (
            <div key={p.id} className="card" style={{
              background: 'linear-gradient(145deg, #0f172a, #1a0d0e)',
              border: p.is_popular ? '2px solid var(--red-bright)' : '1px solid var(--border)',
              position: 'relative', opacity: p.status === 'active' ? 1 : 0.6,
            }}>
              {p.is_popular && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: 'linear-gradient(90deg, #e8232a, #ff6b6b)',
                  color: '#fff', padding: '4px 16px', borderRadius: 20,
                  fontSize: '.75rem', fontWeight: 700, whiteSpace: 'nowrap',
                  boxShadow: '0 2px 12px rgba(232,35,42,.5)',
                }}>⭐ Most Popular</div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8, marginTop: p.is_popular ? 8 : 0 }}>
                <div>
                  <h4 style={{ margin: 0 }}>{p.name}</h4>
                  <small style={{ color: 'var(--muted)' }}>{p.category} • {CYCLE_L[p.billing_cycle] || p.billing_cycle}</small>
                </div>
                <span style={{
                  fontSize: '.7rem', padding: '3px 10px', borderRadius: 12,
                  background: p.status === 'active' ? 'rgba(34,197,94,.15)' : 'rgba(156,163,175,.15)',
                  color: p.status === 'active' ? '#22c55e' : '#9ca3af',
                }}>{p.status === 'active' ? '● Active' : '○ Inactive'}</span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--red-bright)', marginBottom: 12 }}>
                {money(p.selling_price, p.currency)}
                <small style={{ fontSize: '.8rem', color: 'var(--muted)', fontWeight: 400 }}>/{p.billing_cycle}</small>
              </div>
              {p.description && <p style={{ fontSize: '.85rem', color: 'var(--muted)', marginBottom: 12 }}>{p.description}</p>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                <button className="btn btn-sm" onClick={() => openEdit(p)} disabled={!fin}>✏️ Edit</button>
                <button className="btn btn-sm btn-ghost" onClick={() => toggleStatus(p)} disabled={!fin}>
                  {p.status === 'active' ? '⏸️ Disable' : '▶️ Enable'}
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => togglePopular(p)} disabled={!fin}
                  style={p.is_popular ? { borderColor: 'var(--red-bright)', color: 'var(--red-bright)' } : {}}>
                  ⭐ {p.is_popular ? 'Unmark' : 'Popular'}
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => remove(p)} disabled={!fin} style={{ color: '#ff7d7d' }}>🗑️</button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm btn-ghost" onClick={() => move(p, 'up')} disabled={!fin || idx === 0}>↑</button>
                <button className="btn btn-sm btn-ghost" onClick={() => move(p, 'down')} disabled={!fin || idx === plans.length - 1}>↓</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !showForm && plans.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
          <p style={{ fontSize: '2rem' }}>🖥️</p>
          <p>কোনো VPS প্ল্যান নেই। "Add New Plan" দিয়ে শুরু করো।</p>
        </div>
      )}
    </div>
  )
}
