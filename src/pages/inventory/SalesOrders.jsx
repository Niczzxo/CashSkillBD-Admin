import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'
import { money, dstr, err, isFinance, Tbl, Empty, LoadMore, inp, ORDER_STATUS_BN } from './common.jsx'

const PAGE = 20
const FILTERS = ['', 'pending', 'confirmed', 'delivered', 'cancelled', 'refunded']
const FILTER_L = { '': '📋 সব', pending: '⏳ পেন্ডিং', confirmed: '✅ কনফার্মড', delivered: '🚚 ডেলিভার্ড', cancelled: '✕ বাতিল', refunded: '↩️ রিফান্ড' }

const newKey = () => 'ord-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export function SalesOrders({ session, role }) {
  const fin = isFinance(role)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [moreLoading, setMoreLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [statusF, setStatusF] = useState('pending')
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', currency: 'BDT', discount: '', notes: '' })
  const [rows, setRows] = useState([{ product_id: '', qty: '1' }])
  const [idemKey, setIdemKey] = useState(newKey)
  const [busy, setBusy] = useState(false)
  const [detail, setDetail] = useState(null) // {order, items}
  const [detailLoading, setDetailLoading] = useState(false)

  const load = async (reset = true, cur = null, statusOverride) => {
    const curItems = cur || orders
    const off = reset ? 0 : curItems.length
    const st = statusOverride !== undefined ? statusOverride : statusF
    reset ? setLoading(true) : setMoreLoading(true)
    try {
      const j = await manageApi(session, 'order.list', {
        status: st || undefined, search: search.trim() || undefined,
        limit: PAGE, offset: off,
      })
      const list = j.items || []
      setOrders(reset ? list : [...curItems, ...list])
      setHasMore(list.length === PAGE)
    } catch (e) { err(e) }
    setLoading(false); setMoreLoading(false)
  }

  useEffect(() => {
    load(true, [])
    manageApi(session, 'product.list', { status: 'active', limit: 100 })
      .then(j => setProducts(j.items || [])).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openForm = () => {
    setForm({ customer_name: '', customer_phone: '', currency: 'BDT', discount: '', notes: '' })
    setRows([{ product_id: '', qty: '1' }])
    setIdemKey(newKey())
    setShowForm(true); setDetail(null); window.scrollTo(0, 0)
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
    setBusy(true)
    try {
      const j = await manageApi(session, 'order.create', {
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim() || undefined,
        currency: form.currency,
        items: clean,
        discount: form.discount === '' ? 0 : form.discount,
        notes: form.notes.trim() || undefined,
        idempotency_key: idemKey,
      })
      alert('✅ অর্ডার তৈরি! ID: ' + j.order_id)
      setShowForm(false); setIdemKey(newKey()); load(true, [])
    } catch (e) { err(e) }
    setBusy(false)
  }

  const openDetail = async (id) => {
    setDetailLoading(true)
    try {
      const j = await manageApi(session, 'order.get', { id })
      setDetail(j); setShowForm(false); window.scrollTo(0, 0)
    } catch (e) { err(e) }
    setDetailLoading(false)
  }

  const setStatus = async (o, status) => {
    const labels = { confirmed: 'কনফার্ম', delivered: 'ডেলিভার্ড', cancelled: 'বাতিল (স্টক ফেরত আসবে)', refunded: 'রিফান্ড' }
    if (!confirm(`অর্ডার #${o.order_no} → ${labels[status]} করবেন?`)) return
    try {
      await manageApi(session, 'order.set_status', { id: o.id, status })
      setDetail(null); load(true, orders)
    } catch (e) { err(e) }
  }

  const F = (k, v) => setForm({ ...form, [k]: v })
  const setRow = (i, k, v) => setRows(rows.map((r, j) => j === i ? { ...r, [k]: v } : r))

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
        <div className="tabs" style={{ justifyContent: 'flex-start', marginBottom: 0 }}>
          {FILTERS.map(f => (
            <button key={f} className={`tab ${statusF === f ? 'active' : ''}`} onClick={() => { setStatusF(f); load(true, [], f) }}>{FILTER_L[f]}</button>
          ))}
        </div>
        <input placeholder="🔍 অর্ডার নং / নাম / ফোন" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, minWidth: 180 }} />
        <button className="tab" onClick={() => load(true, [])}>খুঁজুন</button>
        <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={openForm}>➕ নতুন অর্ডার</button>
      </div>

      {showForm && (
        <div className="card form-card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 14 }}>🧾 নতুন বিক্রয় অর্ডার</h3>
          <form onSubmit={create}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
              <div>
                <label>ক্রেতার নাম *</label>
                <input value={form.customer_name} onChange={e => F('customer_name', e.target.value)} />
              </div>
              <div>
                <label>ফোন</label>
                <input value={form.customer_phone} onChange={e => F('customer_phone', e.target.value)} />
              </div>
              <div>
                <label>কারেন্সি</label>
                <select value={form.currency} onChange={e => { F('currency', e.target.value); setRows([{ product_id: '', qty: '1' }]) }}>
                  <option value="BDT">BDT (৳)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>
            <label>আইটেম *</label>
            {rows.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <select value={r.product_id} onChange={e => setRow(i, 'product_id', e.target.value)} style={{ flex: 1, margin: 0 }}>
                  <option value="">— প্রোডাক্ট —</option>
                  {curProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {money(p.selling_price, p.currency)} (স্টক: {p.stock_qty})</option>
                  ))}
                </select>
                <input type="number" min="1" value={r.qty} onChange={e => setRow(i, 'qty', e.target.value)} style={{ width: 90, margin: 0 }} placeholder="পরিমাণ" />
                <button type="button" className="mini-btn no" onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button type="button" className="mini-btn" onClick={() => setRows([...rows, { product_id: '', qty: '1' }])}>＋ আইটেম যোগ করুন</button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px', marginTop: 10 }}>
              <div>
                <label>ডিসকাউন্ট</label>
                <input type="number" min="0" step="0.01" value={form.discount} onChange={e => F('discount', e.target.value)} />
              </div>
              <div>
                <label>নোট</label>
                <input value={form.notes} onChange={e => F('notes', e.target.value)} />
              </div>
            </div>
            <p style={{ color: 'var(--muted)' }}>আনুমানিক মোট: <b style={{ color: '#fff' }}>{money(estTotal, form.currency)}</b></p>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button className="btn" disabled={busy}>{busy ? 'তৈরি হচ্ছে…' : 'অর্ডার তৈরি করুন'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>বাতিল</button>
            </div>
          </form>
        </div>
      )}

      {detailLoading && <p style={{ color: 'var(--muted)' }}>লোড হচ্ছে…</p>}
      {detail && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <h3>🧾 রসিদ — <code>#{detail.order.order_no}</code> {ORDER_STATUS_BN[detail.order.status]}</h3>
            <button className="mini-btn" onClick={() => setDetail(null)}>✕ বন্ধ</button>
          </div>
          <p><b>{detail.order.customer_name}</b> <span style={{ color: 'var(--muted)' }}>{detail.order.customer_phone || ''}</span></p>
          <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>{dstr(detail.order.created_at)}{detail.order.notes ? ' · ' + detail.order.notes : ''}</p>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="data-table">
              <thead><tr><th>প্রোডাক্ট</th><th>পরিমাণ</th><th>একক মূল্য</th><th>লাইন মোট</th></tr></thead>
              <tbody>
                {(detail.items || []).map(it => (
                  <tr key={it.id}>
                    <td><b>{it.cashskillbd_products?.name}</b><br /><small style={{ color: 'var(--muted)' }}><code>{it.cashskillbd_products?.sku}</code></small></td>
                    <td>{it.qty}</td>
                    <td>{money(it.unit_price, detail.order.currency)}</td>
                    <td><b>{money(Number(it.unit_price) * Number(it.qty), detail.order.currency)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ textAlign: 'right', marginTop: 12 }}>
            {detail.order.discount > 0 && <p style={{ color: 'var(--muted)' }}>ডিসকাউন্ট: −{money(detail.order.discount, detail.order.currency)}</p>}
            <p style={{ fontSize: '1.3rem', fontWeight: 700 }}>সর্বমোট: <span style={{ color: 'var(--red-bright)' }}>{money(detail.order.grand_total, detail.order.currency)}</span></p>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            {detail.order.status === 'pending' && <button className="mini-btn ok" onClick={() => setStatus(detail.order, 'confirmed')}>✓ কনফার্ম</button>}
            {detail.order.status === 'confirmed' && (
              <>
                <button className="mini-btn ok" onClick={() => setStatus(detail.order, 'delivered')}>🚚 ডেলিভার্ড</button>
                {fin && <button className="mini-btn no" onClick={() => setStatus(detail.order, 'cancelled')}>✕ বাতিল</button>}
              </>
            )}
            {detail.order.status === 'delivered' && fin && (
              <button className="mini-btn no" onClick={() => setStatus(detail.order, 'refunded')}>↩️ রিফান্ড</button>
            )}
          </div>
        </div>
      )}

      {loading ? <p style={{ color: 'var(--muted)' }}>লোড হচ্ছে…</p> : (
        <Tbl>
          <thead><tr><th>অর্ডার</th><th>ক্রেতা</th><th>আইটেম</th><th>মোট</th><th>স্ট্যাটাস</th><th>তারিখ</th><th></th></tr></thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id}>
                <td><code>#{o.order_no}</code></td>
                <td><b>{o.customer_name}</b><br /><small style={{ color: 'var(--muted)' }}>{o.customer_phone || ''}</small></td>
                <td>{o.cashskillbd_sale_items?.[0]?.count ?? '—'}</td>
                <td><b>{money(o.grand_total, o.currency)}</b></td>
                <td>{ORDER_STATUS_BN[o.status] || o.status}</td>
                <td>{dstr(o.created_at)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="mini-btn" onClick={() => openDetail(o.id)}>👁️ দেখুন</button>{' '}
                  {o.status === 'pending' && <button className="mini-btn ok" onClick={() => setStatus(o, 'confirmed')}>✓</button>}{' '}
                  {o.status === 'confirmed' && <button className="mini-btn ok" onClick={() => setStatus(o, 'delivered')}>🚚</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      )}
      {!loading && orders.length === 0 && <Empty text="কোনো অর্ডার নেই।" />}
      <LoadMore hasMore={hasMore} loading={moreLoading} onMore={() => load(false)} />
    </div>
  )
}
