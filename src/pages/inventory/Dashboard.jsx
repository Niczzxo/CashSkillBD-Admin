import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { money, err } from './common.jsx'
import { IBox, IClock, IMoney, IWarn } from '../../components/icons.jsx'

export function Dashboard({ session }) {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [monthly, setMonthly] = useState([])
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
        // Monthly sales (last 6 months)
        const sixAgo = new Date(); sixAgo.setMonth(sixAgo.getMonth() - 5); sixAgo.setDate(1)
        const { data: mall } = await supabase.from('cashskillbd_sales_orders')
          .select('total_amount,created_at').eq('status', 'confirmed').gte('created_at', sixAgo.toISOString())
        const bn = ['জানু','ফেব্রু','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টে','অক্টো','নভে','ডিসে']
        const buckets = []
        for (let i = 5; i >= 0; i--) {
          const d = new Date(); d.setMonth(d.getMonth() - i)
          buckets.push({ label: bn[d.getMonth()], total: 0, key: `${d.getFullYear()}-${d.getMonth()}` })
        }
        ;(mall || []).forEach(o => {
          const d = new Date(o.created_at)
          const k = `${d.getFullYear()}-${d.getMonth()}`
          const b = buckets.find(x => x.key === k)
          if (b) b.total += Number(o.total_amount || 0)
        })
        setMonthly(buckets)
      } catch (e) { err(e) }
      finally { setLoading(false) }
    })()
  }, [])

  if (loading) return <p style={{color:'var(--muted)', padding:20}}>লোড হচ্ছে…</p>

  const cards = [
    { label: 'সক্রিয় প্রোডাক্ট', value: stats.products, icon: <IBox />, color: '#4da3ff' },
    { label: 'পেন্ডিং অর্ডার', value: stats.pendingOrders, icon: <IClock />, color: '#ffb84d' },
    { label: '৩০ দিনের বিক্রয়', value: money(stats.revenue30d), icon: <IMoney />, color: '#4dff88' },
    { label: 'লো স্টক', value: lowStock.length, icon: <IWarn />, color: '#ff7d7d' },
  ]

  return (
    <div>
      <div className="dash-grid">
        {cards.map((c, i) => (
          <div key={i} className="card dash-card" style={{borderTop:`3px solid ${c.color}`}}>
            <div style={{marginBottom:4}}>{c.icon}</div>
            <div className="dash-val">{c.value}</div>
            <div className="dash-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{padding:20, marginBottom:16}}>
        <h3 style={{marginBottom:14}}>📊 মাসিক বিক্রয় (শেষ ৬ মাস)</h3>
        {(() => {
          const max = Math.max(...monthly.map(m => m.total), 1)
          return (
            <div style={{display:'flex', alignItems:'flex-end', gap:10, height:170, paddingTop:8}}>
              {monthly.map((m, i) => (
                <div key={i} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', height:'100%', justifyContent:'flex-end'}}>
                  <div style={{fontSize:'.72rem', color:'var(--muted)', marginBottom:4}}>{m.total > 0 ? (m.total >= 1000 ? (m.total/1000).toFixed(1)+'k' : m.total) : ''}</div>
                  <div style={{
                    width:'100%', maxWidth:52, borderRadius:'8px 8px 4px 4px',
                    height: `${Math.max((m.total / max) * 110, 4)}px`,
                    background: m.total > 0 ? 'linear-gradient(180deg,#ff6b6b,#c1121f)' : 'rgba(255,255,255,.07)',
                    boxShadow: m.total > 0 ? '0 4px 18px rgba(232,35,42,.35)' : 'none',
                    transition: 'height .5s ease',
                  }} />
                  <div style={{fontSize:'.78rem', color:'var(--muted)', marginTop:6}}>{m.label}</div>
                </div>
              ))}
            </div>
          )
        })()}
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
