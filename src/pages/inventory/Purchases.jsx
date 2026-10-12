import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'
import { money, dstr, err, isFinance, Tbl, Empty, LoadMore } from './common.jsx'

const PAGE = 20

export function Purchases({ session, role }) {
  const fin = isFinance(role)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [moreLoading, setMoreLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [form, setForm] = useState({ product_id: '', supplier_id: '', qty: '', unit_cost: '', currency: 'BDT' })
  const [busy, setBusy] = useState(false)

  const load = async (reset = true, cur = null) => {
    const curItems = cur || items
    const off = reset ? 0 : curItems.length
    reset ? setLoading(true) : setMoreLoading(true)
    try {
      const j = await manageApi(session, 'purchase.list', { limit: PAGE, offset: off })
      const list = j.items || []
      setItems(reset ? list : [...curItems, ...list])
      setHasMore(list.length === PAGE)
    } catch (e) { err(e) }
    setLoading(false); setMoreLoading(false)
  }

  useEffect(() => {
    load(true, [])
    manageApi(session, 'product.list', { limit: 100 }).then(j => setProducts(j.items || [])).catch(() => {})
    manageApi(session, 'supplier.list').then(j => setSuppliers(j.items || [])).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async (e) => {
    e.preventDefault()
    if (!form.product_id || !form.qty) return alert('প্রোডাক্ট ও পরিমাণ দিন')
    setBusy(true)
    try {
      await manageApi(session, 'purchase.record', {
        product_id: Number(form.product_id),
        supplier_id: form.supplier_id || undefined,
        qty: Number(form.qty),
        unit_cost: form.unit_cost === '' ? 0 : form.unit_cost,
        currency: form.currency,
      })
      setForm({ product_id: '', supplier_id: '', qty: '', unit_cost: '', currency: 'BDT' })
      load(true, [])
    } catch (e) { err(e) }
    setBusy(false)
  }

  const F = (k, v) => setForm({ ...form, [k]: v })

  return (
    <div>
      <h3 style={{ margin: '26px 0 14px' }}>📥 ক্রয় রেকর্ড (স্টক ইন)</h3>
      {fin ? (
        <div className="card form-card" style={{ marginBottom: 24 }}>
          <form onSubmit={save}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <div>
                <label>প্রোডাক্ট *</label>
                <select value={form.product_id} onChange={e => F('product_id', e.target.value)}>
                  <option value="">— বেছে নিন —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku}) — {p.currency}</option>)}
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
                <label>পরিমাণ *</label>
                <input type="number" min="1" value={form.qty} onChange={e => F('qty', e.target.value)} />
              </div>
              <div>
                <label>একক ক্রয়মূল্য</label>
                <input type="number" min="0" step="0.01" value={form.unit_cost} onChange={e => F('unit_cost', e.target.value)} />
              </div>
              <div>
                <label>কারেন্সি</label>
                <select value={form.currency} onChange={e => F('currency', e.target.value)}>
                  <option value="BDT">BDT (৳)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>
            <button className="btn" disabled={busy}>{busy ? 'সেভ হচ্ছে…' : 'ক্রয় রেকর্ড করুন'}</button>
          </form>
          <p style={{ color: 'var(--muted)', fontSize: '.88rem', marginTop: 10 }}>💡 ক্রয় রেকর্ড করলে স্টক অটো বাড়বে (ডাটাবেজ ট্রানজাকশনে)।</p>
        </div>
      ) : (
        <p style={{ color: 'var(--muted)', marginBottom: 16 }}>🔒 ক্রয় রেকর্ড শুধু ফাইন্যান্স / অ্যাডমিন করতে পারে।</p>
      )}

      <h3 style={{ margin: '0 0 14px' }}>🧾 ক্রয় হিস্ট্রি</h3>
      {loading ? <p style={{ color: 'var(--muted)' }}>লোড হচ্ছে…</p> : (
        <Tbl>
          <thead><tr><th>তারিখ</th><th>প্রোডাক্ট</th><th>সাপ্লায়ার</th><th>পরিমাণ</th><th>একক মূল্য</th><th>মোট</th></tr></thead>
          <tbody>
            {items.map(pu => (
              <tr key={pu.id}>
                <td>{dstr(pu.purchased_at)}</td>
                <td><b>{pu.cashskillbd_products?.name || '—'}</b><br /><small style={{ color: 'var(--muted)' }}><code>{pu.cashskillbd_products?.sku}</code></small></td>
                <td>{pu.cashskillbd_suppliers?.name || '—'}</td>
                <td>{pu.qty}</td>
                <td>{money(pu.unit_cost, pu.currency)}</td>
                <td><b>{money(pu.total_cost, pu.currency)}</b></td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      )}
      {!loading && items.length === 0 && <Empty text="কোনো ক্রয় রেকর্ড নেই।" />}
      <LoadMore hasMore={hasMore} loading={moreLoading} onMore={() => load(false)} />
    </div>
  )
}
