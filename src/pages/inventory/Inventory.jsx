import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'
import { money, dstr, err, Tbl, Empty, LoadMore, inp, STATUS_BN } from './common.jsx'

const PAGE = 20

export function Inventory({ session }) {
  const [products, setProducts] = useState([])
  const [pLoading, setPLoading] = useState(true)
  const [moves, setMoves] = useState([])
  const [mLoading, setMLoading] = useState(false)
  const [moreLoading, setMoreLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [prodF, setProdF] = useState('')

  const loadProducts = async () => {
    setPLoading(true)
    try {
      const j = await manageApi(session, 'product.list', { limit: 100 })
      setProducts(j.items || [])
    } catch (e) { err(e) }
    setPLoading(false)
  }

  const loadMoves = async (reset = true, cur = null) => {
    const curItems = cur || moves
    const off = reset ? 0 : curItems.length
    reset ? setMLoading(true) : setMoreLoading(true)
    try {
      const j = await manageApi(session, 'stock.movements', {
        product_id: prodF || undefined, limit: PAGE, offset: off,
      })
      const list = j.items || []
      setMoves(reset ? list : [...curItems, ...list])
      setHasMore(list.length === PAGE)
    } catch (e) { err(e) }
    setMLoading(false); setMoreLoading(false)
  }

  useEffect(() => {
    loadProducts()
    loadMoves(true, [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <h3 style={{ margin: '0 0 14px' }}>📊 ইনভেন্টরি ও স্টক</h3>

      <h3 style={{ margin: '0 0 14px', fontSize: '1.05rem' }}>📦 স্টক ওভারভিউ</h3>
      {pLoading ? <p style={{ color: 'var(--muted)' }}>লোড হচ্ছে…</p> : (
        <div style={{ marginBottom: 26 }}>
          <Tbl>
            <thead><tr><th>SKU</th><th>প্রোডাক্ট</th><th>স্টক</th><th>লো-স্টক সীমা</th><th>স্ট্যাটাস</th></tr></thead>
            <tbody>
              {products.map(p => {
                const low = Number(p.stock_qty) <= Number(p.low_stock_at)
                return (
                  <tr key={p.id} style={low ? { background: 'rgba(232,35,42,.08)' } : {}}>
                    <td><code>{p.sku}</code></td>
                    <td><b>{p.name}</b></td>
                    <td style={low ? { color: '#ff9a9a', fontWeight: 700 } : { fontWeight: 700 }}>{p.stock_qty}{low ? ' ⚠️ লো' : ''}</td>
                    <td>{p.low_stock_at}</td>
                    <td>{STATUS_BN[p.status] || p.status}</td>
                  </tr>
                )
              })}
            </tbody>
          </Tbl>
          {products.length === 0 && <Empty text="কোনো প্রোডাক্ট নেই।" />}
        </div>
      )}

      <h3 style={{ margin: '0 0 14px', fontSize: '1.05rem' }}>🔄 স্টক মুভমেন্ট</h3>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={prodF} onChange={e => setProdF(e.target.value)} style={{ ...inp, minWidth: 240 }}>
          <option value="">সব প্রোডাক্ট</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
        </select>
        <button className="tab" onClick={() => loadMoves(true, [])}>প্রয়োগ</button>
      </div>
      {mLoading ? <p style={{ color: 'var(--muted)' }}>লোড হচ্ছে…</p> : (
        <Tbl>
          <thead><tr><th>সময়</th><th>প্রোডাক্ট</th><th>পরিবর্তন</th><th>কারণ</th><th>নোট</th></tr></thead>
          <tbody>
            {moves.map(m => (
              <tr key={m.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{dstr(m.created_at)}</td>
                <td><b>{m.cashskillbd_products?.name}</b><br /><small style={{ color: 'var(--muted)' }}><code>{m.cashskillbd_products?.sku}</code></small></td>
                <td style={{ fontWeight: 700, color: Number(m.qty_change) >= 0 ? '#7dffa8' : '#ff9a9a' }}>
                  {Number(m.qty_change) >= 0 ? '+' : ''}{m.qty_change}
                </td>
                <td>{m.reason}</td>
                <td style={{ maxWidth: 300 }}>{m.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      )}
      {!mLoading && moves.length === 0 && <Empty text="কোনো মুভমেন্ট নেই।" />}
      <LoadMore hasMore={hasMore} loading={moreLoading} onMore={() => loadMoves(false)} />
    </div>
  )
}
