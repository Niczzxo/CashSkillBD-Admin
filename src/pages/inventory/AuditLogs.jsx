import { useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'
import { dstr, err, isFinance, Tbl, Empty, LoadMore, inp, FinanceOnly } from './common.jsx'

const PAGE = 20
const ENTITIES = ['', 'product', 'supplier', 'purchase', 'sales_order', 'service', 'dollar_rate', 'dollar_txn', 'expense']
const ENT_L = {
  '': 'সব এনটিটি', product: 'প্রোডাক্ট', supplier: 'সাপ্লায়ার', purchase: 'ক্রয়',
  sales_order: 'বিক্রয় অর্ডার', service: 'সার্ভিস', dollar_rate: 'ডলার রেট',
  dollar_txn: 'ডলার লেনদেন', expense: 'খরচ',
}

export function AuditLogs({ session, role }) {
  const fin = isFinance(role)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [moreLoading, setMoreLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [entityF, setEntityF] = useState('')
  const [actionF, setActionF] = useState('')

  if (!fin) return <FinanceOnly />

  const load = async (reset = true, cur = null) => {
    const curItems = cur || items
    const off = reset ? 0 : curItems.length
    reset ? setLoading(true) : setMoreLoading(true)
    try {
      const j = await manageApi(session, 'audit.list', {
        entity_type: entityF || undefined, action: actionF.trim() || undefined,
        limit: PAGE, offset: off,
      })
      const list = j.items || []
      setItems(reset ? list : [...curItems, ...list])
      setHasMore(list.length === PAGE)
      setLoaded(true)
    } catch (e) { err(e) }
    setLoading(false); setMoreLoading(false)
  }

  const short = (v) => {
    if (v === null || v === undefined) return '—'
    const s = typeof v === 'string' ? v : JSON.stringify(v)
    return s.length > 120 ? s.slice(0, 120) + '…' : s
  }

  return (
    <div>
      <h3 style={{ margin: '0 0 14px' }}>📝 অডিট লগ</h3>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={entityF} onChange={e => setEntityF(e.target.value)} style={inp}>
          {ENTITIES.map(v => <option key={v} value={v}>{ENT_L[v]}</option>)}
        </select>
        <input placeholder="অ্যাকশন (যেমন: product.update)" value={actionF} onChange={e => setActionF(e.target.value)} style={{ ...inp, minWidth: 200 }} />
        <button className="btn btn-sm" disabled={loading} onClick={() => load(true, [])}>{loading ? 'লোড হচ্ছে…' : 'দেখুন'}</button>
      </div>
      {loaded && (
        <Tbl>
          <thead><tr><th>সময়</th><th>কার</th><th>অ্যাকশন</th><th>এনটিটি</th><th>ID</th><th>বিস্তারিত</th></tr></thead>
          <tbody>
            {items.map(a => (
              <tr key={a.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{dstr(a.created_at)}</td>
                <td><small>{a.cashskillbd_profiles?.email || a.actor_id?.slice(0, 8) || '—'}</small></td>
                <td><code>{a.action}</code></td>
                <td>{ENT_L[a.entity_type] || a.entity_type}</td>
                <td><code>{a.entity_id || '—'}</code></td>
                <td style={{ maxWidth: 340, fontSize: '.82rem', color: 'var(--muted)' }}>{short(a.new_values)}</td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      )}
      {loaded && items.length === 0 && <Empty text="কোনো লগ নেই।" />}
      <LoadMore hasMore={hasMore} loading={moreLoading} onMore={() => load(false)} />
      <p style={{ color: 'var(--muted)', fontSize: '.88rem', marginTop: 12 }}>💡 দাম পরিবর্তন, স্টক সমন্বয়, রিফান্ড ও আর্থিক লেনদেন — সব এখানে রেকর্ড থাকে।</p>
    </div>
  )
}
