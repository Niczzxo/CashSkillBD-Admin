import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'
import { money, err, isFinance, Tbl, Empty, LoadMore, inp, STATUS_BN } from './common.jsx'

const PAGE = 20
const TYPES = [
  { v: '', l: 'সব টাইপ' }, { v: 'physical', l: 'ফিজিক্যাল' }, { v: 'service', l: 'সার্ভিস' },
  { v: 'ip', l: 'IP' }, { v: 'vps', l: 'VPS' }, { v: 'number', l: 'নাম্বার' }, { v: 'course', l: 'কোর্স' },
]
const TYPE_L = Object.fromEntries(TYPES.map(t => [t.v, t.l]))

const blankForm = {
  sku: '', name: '', description: '', category: 'general', product_type: 'physical',
  supplier_id: '', purchase_cost: '', selling_price: '', currency: 'BDT',
  stock_qty: '0', low_stock_at: '5', image_url: '', service_duration_days: '',
}

export function Products({ session, role }) {
  const fin = isFinance(role)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [moreLoading, setMoreLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState('')
  const [typeF, setTypeF] = useState('')
  const [suppliers, setSuppliers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [busy, setBusy] = useState(false)
  const [adjust, setAdjust] = useState(null)
  const [adjForm, setAdjForm] = useState({ qty: '', direction: 'in', reason: 'adjustment', notes: '' })

  const load = async (reset = true, cur = null) => {
    const curItems = cur || items
    const off = reset ? 0 : curItems.length
    reset ? setLoading(true) : setMoreLoading(true)
    try {
      const j = await manageApi(session, 'product.list', {
        search: search.trim() || undefined,
        status: statusF || undefined,
        product_type: typeF || undefined,
        limit: PAGE, offset: off,
      })
      const list = j.items || []
      setItems(reset ? list : [...curItems, ...list])
      setHasMore(list.length === PAGE)
    } catch (e) { err(e) }
    setLoading(false); setMoreLoading(false)
  }

  useEffect(() => {
    load(true, [])
    manageApi(session, 'supplier.list').then(j => setSuppliers(j.items || [])).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreate = () => { setEditing(null); setForm(blankForm); setShowForm(true); window.scrollTo(0, 0) }
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
    setShowForm(true); window.scrollTo(0, 0)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return alert('প্রোডাক্টের নাম দিন')
    setBusy(true)
    try {
      if (editing) {
        await manageApi(session, 'product.update', {
          id: editing.id,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          category: form.category.trim() || 'general',
          supplier_id: form.supplier_id || undefined,
          purchase_cost: form.purchase_cost === '' ? 0 : form.purchase_cost,
          selling_price: form.selling_price === '' ? 0 : form.selling_price,
          low_stock_at: form.low_stock_at === '' ? 5 : form.low_stock_at,
          image_url: form.image_url.trim() || undefined,
          service_duration_days: form.service_duration_days || undefined,
        })
      } else {
        await manageApi(session, 'product.create', {
          sku: form.sku.trim() || undefined,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          category: form.category.trim() || 'general',
          product_type: form.product_type,
          supplier_id: form.supplier_id || undefined,
          purchase_cost: form.purchase_cost === '' ? 0 : form.purchase_cost,
          selling_price: form.selling_price === '' ? 0 : form.selling_price,
          currency: form.currency,
          stock_qty: form.stock_qty === '' ? 0 : form.stock_qty,
          low_stock_at: form.low_stock_at === '' ? 5 : form.low_stock_at,
          image_url: form.image_url.trim() || undefined,
          service_duration_days: form.service_duration_days || undefined,
        })
      }
      setShowForm(false); setEditing(null); setForm(blankForm); load(true, [])
    } catch (e) { err(e) }
    setBusy(false)
  }

  const setStatus = async (p, status) => {
    if (!confirm(`"${p.name}" → ${STATUS_BN[status]} করবেন?`)) return
    try { await manageApi(session, 'product.set_status', { id: p.id, status }); load(true, items) }
    catch (e) { err(e) }
  }

  const doAdjust = async (e) => {
    e.preventDefault()
    const q = Math.abs(Number(adjForm.qty))
    if (!q || !Number.isInteger(q)) return alert('সঠিক পরিমাণ দিন')
    try {
      const j = await manageApi(session, 'product.adjust_stock', {
        id: adjust.id, qty_change: q, direction: adjForm.direction,
        reason: adjForm.reason, notes: adjForm.notes.trim() || undefined,
      })
      setItems(items.map(p => p.id === adjust.id ? { ...p, stock_qty: j.new_qty } : p))
      setAdjust(null); setAdjForm({ qty: '', direction: 'in', reason: 'adjustment', notes: '' })
    } catch (e) { err(e) }
  }

  const F = (k, v) => setForm({ ...form, [k]: v })

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
        <input placeholder="🔍 নাম / SKU খুঁজুন" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, minWidth: 200 }} />
        <select value={statusF} onChange={e => setStatusF(e.target.value)} style={inp}>
          {Object.entries(STATUS_BN).map(([v, l]) => v === '' ? <option key="all" value="">সব স্ট্যাটাস</option> : <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={typeF} onChange={e => setTypeF(e.target.value)} style={inp}>
          {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        <button className="tab" onClick={() => load(true, [])}>প্রয়োগ</button>
        {fin && <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={openCreate}>➕ নতুন প্রোডাক্ট</button>}
      </div>

      {showForm && fin && (
        <div className="card form-card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 14 }}>{editing ? '✏️ প্রোডাক্ট এডিট' : '➕ নতুন প্রোডাক্ট'}</h3>
          <form onSubmit={save}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <div>
                <label>SKU {editing ? <small style={{ color: 'var(--muted)' }}>(বদলানো যায় না)</small> : <small style={{ color: 'var(--muted)' }}>(খালি রাখলে অটো)</small>}</label>
                <input value={form.sku} onChange={e => F('sku', e.target.value)} disabled={!!editing} placeholder="SKU-..." />
              </div>
              <div>
                <label>নাম *</label>
                <input value={form.name} onChange={e => F('name', e.target.value)} placeholder="প্রোডাক্টের নাম" />
              </div>
            </div>
            <label>বর্ণনা</label>
            <input value={form.description} onChange={e => F('description', e.target.value)} placeholder="ছোট বর্ণনা" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
              <div>
                <label>ক্যাটাগরি</label>
                <input value={form.category} onChange={e => F('category', e.target.value)} />
              </div>
              <div>
                <label>টাইপ {editing && <small style={{ color: 'var(--muted)' }}>(বদলানো যায় না)</small>}</label>
                <select value={form.product_type} onChange={e => F('product_type', e.target.value)} disabled={!!editing}>
                  {TYPES.filter(t => t.v).map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
              <div>
                <label>সাপ্লায়ার</label>
                <select value={form.supplier_id} onChange={e => F('supplier_id', e.target.value)}>
                  <option value="">— নেই —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
              <div>
                <label>ক্রয়মূল্য</label>
                <input type="number" min="0" step="0.01" value={form.purchase_cost} onChange={e => F('purchase_cost', e.target.value)} />
              </div>
              <div>
                <label>বিক্রয়মূল্য</label>
                <input type="number" min="0" step="0.01" value={form.selling_price} onChange={e => F('selling_price', e.target.value)} />
              </div>
              <div>
                <label>কারেন্সি {editing && <small style={{ color: 'var(--muted)' }}>(বদলানো যায় না)</small>}</label>
                <select value={form.currency} onChange={e => F('currency', e.target.value)} disabled={!!editing}>
                  <option value="BDT">BDT (৳)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
              <div>
                <label>স্টক {editing && <small style={{ color: 'var(--muted)' }}>(স্টক অ্যাডজাস্ট দিয়ে বদলান)</small>}</label>
                <input type="number" min="0" value={form.stock_qty} onChange={e => F('stock_qty', e.target.value)} disabled={!!editing} />
              </div>
              <div>
                <label>লো-স্টক সীমা</label>
                <input type="number" min="0" value={form.low_stock_at} onChange={e => F('low_stock_at', e.target.value)} />
              </div>
              <div>
                <label>সার্ভিস মেয়াদ (দিন)</label>
                <input type="number" min="0" value={form.service_duration_days} onChange={e => F('service_duration_days', e.target.value)} placeholder="যেমন: 30" />
              </div>
            </div>
            <label>ছবির URL</label>
            <input value={form.image_url} onChange={e => F('image_url', e.target.value)} placeholder="https://..." />
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button className="btn" disabled={busy}>{busy ? 'সেভ হচ্ছে…' : editing ? 'আপডেট করুন' : 'প্রোডাক্ট যোগ করুন'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setEditing(null) }}>বাতিল</button>
            </div>
          </form>
        </div>
      )}

      {adjust && (
        <div className="card form-card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 14 }}>📦 স্টক অ্যাডজাস্ট — {adjust.name} <small style={{ color: 'var(--muted)' }}>(বর্তমান: {adjust.stock_qty})</small></h3>
          <form onSubmit={doAdjust}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
              <div>
                <label>পরিমাণ *</label>
                <input type="number" min="1" value={adjForm.qty} onChange={e => setAdjForm({ ...adjForm, qty: e.target.value })} />
              </div>
              <div>
                <label>দিক</label>
                <select value={adjForm.direction} onChange={e => setAdjForm({ ...adjForm, direction: e.target.value })}>
                  <option value="in">➕ স্টক ইন</option>
                  <option value="out">➖ স্টক আউট</option>
                </select>
              </div>
              <div>
                <label>কারণ</label>
                <select value={adjForm.reason} onChange={e => setAdjForm({ ...adjForm, reason: e.target.value })}>
                  <option value="adjustment">সমন্বয়</option>
                  <option value="return">রিটার্ন</option>
                </select>
              </div>
            </div>
            <label>নোট</label>
            <input value={adjForm.notes} onChange={e => setAdjForm({ ...adjForm, notes: e.target.value })} placeholder="কেন অ্যাডজাস্ট করছেন" />
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button className="btn">প্রয়োগ করুন</button>
              <button type="button" className="btn btn-ghost" onClick={() => setAdjust(null)}>বাতিল</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p style={{ color: 'var(--muted)' }}>লোড হচ্ছে…</p> : (
        <Tbl>
          <thead><tr><th>প্রোডাক্ট</th><th>টাইপ</th><th>সাপ্লায়ার</th><th>ক্রয়</th><th>বিক্রয়</th><th>স্টক</th><th>স্ট্যাটাস</th>{fin && <th></th>}</tr></thead>
          <tbody>
            {items.map(p => {
              const low = Number(p.stock_qty) <= Number(p.low_stock_at)
              return (
                <tr key={p.id}>
                  <td><b>{p.name}</b><br /><small style={{ color: 'var(--muted)' }}><code>{p.sku}</code> · {p.category}</small></td>
                  <td>{TYPE_L[p.product_type] || p.product_type}</td>
                  <td>{p.cashskillbd_suppliers?.name || '—'}</td>
                  <td>{money(p.purchase_cost, p.currency)}</td>
                  <td><b>{money(p.selling_price, p.currency)}</b></td>
                  <td style={low ? { color: '#ff9a9a', fontWeight: 700 } : {}}>{p.stock_qty}{low ? ' ⚠️' : ''}</td>
                  <td>{STATUS_BN[p.status] || p.status}</td>
                  {fin && (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="mini-btn" onClick={() => openEdit(p)}>✏️</button>{' '}
                      <button className="mini-btn" onClick={() => setAdjust(p)}>📦</button>{' '}
                      {p.status !== 'active' && <button className="mini-btn ok" onClick={() => setStatus(p, 'active')}>✅</button>}{' '}
                      {p.status === 'active' && <button className="mini-btn" onClick={() => setStatus(p, 'inactive')}>⏸️</button>}{' '}
                      {p.status !== 'archived' && <button className="mini-btn no" onClick={() => setStatus(p, 'archived')}>🗃️</button>}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </Tbl>
      )}
      {!loading && items.length === 0 && <Empty text="কোনো প্রোডাক্ট নেই।" />}
      <LoadMore hasMore={hasMore} loading={moreLoading} onMore={() => load(false)} />
      {!fin && <p style={{ color: 'var(--muted)', fontSize: '.88rem', marginTop: 12 }}>🔒 প্রোডাক্ট তৈরি/এডিট/স্ট্যাটাস শুধু ফাইন্যান্স ও অ্যাডমিন করতে পারে।</p>}
    </div>
  )
}
