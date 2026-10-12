import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'
import { money, dstr, err, Tbl, Empty, inp } from './common.jsx'

export function PriceHistory({ session }) {
  const [products, setProducts] = useState([])
  const [pid, setPid] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    manageApi(session, 'product.list', { limit: 100 }).then(j => setProducts(j.items || [])).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    if (!pid) return alert('একটি প্রোডাক্ট বেছে নিন')
    setLoading(true)
    try {
      const j = await manageApi(session, 'price.history', { product_id: Number(pid) })
      setItems(j.items || [])
      setLoaded(true)
    } catch (e) { err(e) }
    setLoading(false)
  }

  return (
    <div>
      <h3 style={{ margin: '0 0 14px' }}>🕘 দামের ইতিহাস</h3>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={pid} onChange={e => setPid(e.target.value)} style={{ ...inp, minWidth: 260 }}>
          <option value="">— প্রোডাক্ট বেছে নিন —</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
        </select>
        <button className="btn btn-sm" disabled={loading} onClick={load}>{loading ? 'লোড হচ্ছে…' : 'ইতিহাস দেখুন'}</button>
      </div>
      {loaded && (
        <Tbl>
          <thead><tr><th>সময়</th><th>পুরনো বিক্রয়মূল্য</th><th>নতুন বিক্রয়মূল্য</th><th>পুরনো ক্রয়মূল্য</th><th>নতুন ক্রয়মূল্য</th></tr></thead>
          <tbody>
            {items.map(h => (
              <tr key={h.id}>
                <td>{dstr(h.changed_at)}</td>
                <td>{money(h.old_price, h.currency)}</td>
                <td><b style={{ color: '#7dffa8' }}>{money(h.new_price, h.currency)}</b></td>
                <td>{money(h.old_cost, h.currency)}</td>
                <td><b>{money(h.new_cost, h.currency)}</b></td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      )}
      {loaded && items.length === 0 && <Empty text="এই প্রোডাক্টের দাম এখনো বদলানো হয়নি।" />}
    </div>
  )
}
