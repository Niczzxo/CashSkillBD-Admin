import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { money, err } from './common.jsx'

export function Dashboard({ session }) {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const [p1, p2, p3, p4] = await Promise.all([
          supabase.from('cashskillbd_products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('cashskillbd_sales_orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('cashskillbd_sales_orders').select('total_amount').eq('status', 'confirmed').gte('created_at', new Date(Date.now() - 30*24*3600*1000).toISOString()),
          supabase.from('cashskillbd_products').select('id,name,stock_qty').eq('status', 'active').lte('stock_qty', 5).order('stock_qty').limit(5),
        ])
        const revenue = (p3.data || []).reduce((s, o) => s + Number(o.total_amount || 0), 0)
        setStats({
          products: p1.count || 0,
          pendingOrders: p2.count || 0,
          revenue30d: revenue,
        })
        setLowStock(p4.data || [])
        const { data: ords } = await supabase.from('cashskillbd_sales_orders')
          .select('id,customer_name,total_amount,status,created_at')
          .order('created_at', { ascending: false }).limit(5)
        setRecent(ords || [])
      } catch (e) { err(e) }
      finally { setLoading(false) }
    })()
  }, [])

  if (loading) return <p style={{color:'var(--muted)', padding:20}}>লোড হচ্ছে…</p>

  const cards = [
    { label: 'সক্রিয় প্রোডাক্ট', value: stats.products, icon: '📦', color: '#4da3ff' },
    { label: 'পেন্ডিং অর্ডার', value: stats.pendingOrders, icon: '⏳', color: '#ffb84d' },
    { label: '৩০ দিনের বিক্রয়', value: money(stats.revenue30d), icon: '💰', color: '#4dff88' },
    { label: 'লো স্টক', value: lowStock.length, icon: '⚠️', color: '#ff7d7d' },
  ]

  return (
    <div>
      <div className="dash-grid">
        {cards.map((c, i) => (
          <div key={i} className="card dash-card" style={{borderTop:`3px solid ${c.color}`}}>
            <div style={{fontSize:'1.8rem'}}>{c.icon}</div>
            <div className="dash-val">{c.value}</div>
            <div className="dash-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="dash-cols">
        <div className="card" style={{padding:18}}>
          <h3 style={{marginBottom:12}}>🕘 সাম্প্রতিক অর্ডার</h3>
          {recent.length === 0 ? <p style={{color:'var(--muted)'}}>কোনো অর্ডার নেই</p> : (
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>ক্রেতা</th><th>মোট</th><th>স্ট্যাটাস</th></tr></thead>
              <tbody>{recent.map(o => (
                <tr key={o.id}><td>{o.customer_name || '-'}</td><td>{money(o.total_amount)}</td><td>{o.status}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
        <div className="card" style={{padding:18}}>
          <h3 style={{marginBottom:12}}>⚠️ লো স্টক অ্যালার্ট</h3>
          {lowStock.length === 0 ? <p style={{color:'var(--muted)'}}>সব ঠিক আছে ✅</p> : (
            <ul style={{listStyle:'none', padding:0, margin:0}}>
              {lowStock.map(p => (
                <li key={p.id} style={{padding:'8px 0', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between'}}>
                  <span>{p.name}</span><b style={{color:'#ff7d7d'}}>{p.stock_qty} টি</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
