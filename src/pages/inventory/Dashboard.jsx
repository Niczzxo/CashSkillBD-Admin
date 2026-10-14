import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { money, err } from './common.jsx'
import { IBox, IClock, IMoney, IWarn, IUsers, IChart, IArrowR } from '../../components/icons.jsx'

export function Dashboard({ session, goSec }) {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [monthly, setMonthly] = useState([])
  const [range, setRange] = useState(6)
  const [quick, setQuick] = useState({ users: 0, members: 0, tickets: 0, approvals: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const safe = async (fn, fallback) => {
        try { return await fn() } catch (e) { console.warn('Dashboard query failed:', e.message); return fallback }
      }
      try {
        const [p1, p2, p3, p4, q1, q2, q3, q4] = await Promise.all([
          safe(() => supabase.from('cashskillbd_products').select('id', { count: 'exact', head: true }).eq('status', 'active'), { count: 0 }),
          safe(() => supabase.from('cashskillbd_sales_orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'), { count: 0 }),
          safe(() => supabase.from('cashskillbd_sales_orders').select('grand_total').eq('status', 'confirmed').gte('created_at', new Date(Date.now() - 30*24*3600*1000).toISOString()), { data: [] }),
          safe(() => supabase.from('cashskillbd_products').select('id,name,stock_qty').eq('status', 'active').lte('stock_qty', 5).order('stock_qty').limit(5), { data: [] }),
          safe(() => supabase.from('cashskillbd_profiles').select('id', { count: 'exact', head: true }), { count: 0 }),
          safe(() => supabase.from('cashskillbd_profiles').select('id', { count: 'exact', head: true }).eq('role', 'member'), { count: 0 }),
          safe(() => supabase.from('cashskillbd_tickets').select('id', { count: 'exact', head: true }), { count: 0 }),
          safe(() => supabase.from('cashskillbd_sales_orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'), { count: 0 }),
        ])
        const revenue = (p3.data || []).reduce((s, o) => s + Number(o.grand_total || 0), 0)
        setStats({
          products: p1.count || 0,
          pendingOrders: p2.count || 0,
          revenue30d: revenue,
        })
        setQuick({
          users: q1.count || 0,
          members: q2.count || 0,
          tickets: q3.count || 0,
          approvals: q4.count || 0,
        })
        setLowStock(p4.data || [])
        const { data: ords } = await safe(() => supabase.from('cashskillbd_sales_orders')
          .select('id,customer_name,product_name,grand_total,status,created_at')
          .order('created_at', { ascending: false }).limit(5), { data: [] })
        setRecent(ords || [])
        // Sales chart (dynamic range: 1, 3, 6, 12 months)
        const bn = ['জানু','ফেব্রু','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টে','অক্টো','নভে','ডিসে']
        const buckets = []
        let rangeAgo
        if (range === 1) {
          // Daily buckets for last 30 days
          rangeAgo = new Date(); rangeAgo.setDate(rangeAgo.getDate() - 29); rangeAgo.setHours(0,0,0,0)
          for (let i = 29; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i)
            buckets.push({ label: `${d.getDate()}`, total: 0, orders: 0, key: d.toISOString().slice(0,10) })
          }
        } else {
          const monthsBack = range === 12 ? 11 : range === 3 ? 2 : 5
          rangeAgo = new Date(); rangeAgo.setMonth(rangeAgo.getMonth() - monthsBack); rangeAgo.setDate(1)
          for (let i = monthsBack; i >= 0; i--) {
            const d = new Date(); d.setMonth(d.getMonth() - i)
            buckets.push({ label: bn[d.getMonth()], total: 0, orders: 0, key: `${d.getFullYear()}-${d.getMonth()}` })
          }
        }
        const { data: mall } = await safe(() => supabase.from('cashskillbd_sales_orders')
          .select('grand_total,created_at').eq('status', 'confirmed').gte('created_at', rangeAgo.toISOString()), { data: [] })
        ;(mall || []).forEach(o => {
          const d = new Date(o.created_at)
          const k = range === 1 ? d.toISOString().slice(0,10) : `${d.getFullYear()}-${d.getMonth()}`
          const b = buckets.find(x => x.key === k)
          if (b) { b.total += Number(o.grand_total || 0); b.orders += 1 }
        })
        setMonthly(buckets)
      } catch (e) { err(e) }
      finally { setLoading(false) }
    })()
  }, [range])

  if (loading) return <p style={{color:'var(--muted)', padding:20}}>লোড হচ্ছে…</p>

  const cards = [
    { label: 'Total Products', sub: 'সক্রিয় প্রোডাক্ট', value: stats.products, icon: <IBox size={22} />, color: '#ff6b6b', bg: 'rgba(255,107,107,.15)', border: '#ff6b6b' },
    { label: 'Total Orders', sub: 'পেন্ডিং অর্ডার', value: stats.pendingOrders, icon: <IClock size={22} />, color: '#f5b942', bg: 'rgba(245,185,66,.15)', border: '#f5b942' },
    { label: 'Total Revenue', sub: 'গত ৩০ দিনের বিক্রয়', value: money(stats.revenue30d), icon: <IMoney size={22} />, color: '#2ecc71', bg: 'rgba(46,204,113,.15)', border: '#2ecc71' },
    { label: 'Low Stock', sub: 'লো স্টক', value: lowStock.length, icon: <IWarn size={22} />, color: '#e84393', bg: 'rgba(232,67,147,.15)', border: '#e84393' },
  ]

  const quickStats = [
    { label: 'Total Users', value: quick.users, icon: <IUsers size={20} />, color: '#ff6b6b', bg: 'rgba(255,107,107,.15)' },
    { label: 'Active Members', value: quick.members, icon: <IUsers size={20} />, color: '#4da3ff', bg: 'rgba(77,163,255,.15)' },
    { label: 'Total Tickets', value: quick.tickets, icon: <IBox size={20} />, color: '#ff6b6b', bg: 'rgba(255,107,107,.15)' },
    { label: 'Pending Approvals', value: quick.approvals, icon: <IClock size={20} />, color: '#f5b942', bg: 'rgba(245,185,66,.15)' },
  ]

  // Line chart SVG
  const chartW = 600, chartH = 200, pad = 35
  const maxVal = Math.max(...monthly.map(m => m.total), 1)
  const pts = monthly.map((m, i) => {
    const x = pad + (i / Math.max(monthly.length - 1, 1)) * (chartW - pad * 2)
    const y = chartH - pad - (m.total / maxVal) * (chartH - pad * 2)
    return { x, y, ...m }
  })
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = linePath + ` L${pts[pts.length-1]?.x || 0},${chartH-pad} L${pts[0]?.x || 0},${chartH-pad} Z`

  return (
    <div>
      {/* Dashboard heading */}
      <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:22}}>
        <div style={{display:'flex', gap:4}}>
          <div style={{width:10, height:32, background:'#ff5b5b', borderRadius:3}} />
          <div style={{width:10, height:24, background:'#ffb84d', borderRadius:3, alignSelf:'flex-end'}} />
          <div style={{width:10, height:38, background:'#4da3ff', borderRadius:3}} />
        </div>
        <div>
          <h2 style={{margin:0, fontSize:'1.5rem', color:'#fff'}}>Dashboard</h2>
          <p style={{margin:0, color:'var(--muted)', fontSize:'.9rem'}}>Welcome back, Admin! Here's what's happening with your platform.</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="dash-grid">
        {cards.map((c, i) => (
          <div key={i} className="dash-card" style={{border:`1px solid ${c.border}`, position:'relative'}}>
            <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12}}>
              <div className="dash-icon" style={{background: c.bg, color: c.color}}>{c.icon}</div>
              <button style={{width:28, height:28, borderRadius:'50%', border:`1px solid ${c.border}`, background:'transparent', color:c.color, cursor:'pointer', display:'grid', placeItems:'center'}}><IArrowR /></button>
            </div>
            <div style={{fontSize:'.85rem', color:'var(--muted)', fontWeight:600}}>{c.label}</div>
            <div className="dash-val" style={{fontSize:'2rem'}}>{c.value}</div>
            <div className="dash-label">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Chart + Quick Stats */}
      <div style={{display:'grid', gridTemplateColumns:'1.6fr 1fr', gap:16, marginBottom:20}} className="dash-mid">
        <div className="panel" style={{border:'1px solid rgba(255,91,91,.25)'}}>
          <div className="panel-head">
            <h3 style={{display:'flex', alignItems:'center', gap:8}}><IChart size={20} /> Monthly Sales Overview</h3>
            <div className="chart-controls">
              <button className={`chart-btn ${range===1?'active':''}`} onClick={()=>setRange(1)}>১ মাস</button>
              <button className={`chart-btn ${range===3?'active':''}`} onClick={()=>setRange(3)}>৩ মাস</button>
              <button className={`chart-btn ${range===6?'active':''}`} onClick={()=>setRange(6)}>৬ মাস</button>
              <button className={`chart-btn ${range===12?'active':''}`} onClick={()=>setRange(12)}>১২ মাস</button>
            </div>
          </div>
          <div style={{display:'flex', gap:16, marginBottom:8, fontSize:'.8rem', color:'var(--muted)'}}>
            <span><span style={{display:'inline-block', width:8, height:8, borderRadius:'50%', background:'#ff5b5b', marginRight:6}} />Sales</span>
            <span><span style={{display:'inline-block', width:8, height:8, borderRadius:'50%', background:'#666', marginRight:6}} />Orders</span>
          </div>
          {monthly.every(m => m.total === 0) ? (
            <div style={{height:200, display:'grid', placeItems:'center', color:'var(--muted)'}}>
              <div style={{textAlign:'center'}}>
                <IChart size={40} />
                <p>No sales data yet</p>
              </div>
            </div>
          ) : (
            <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{width:'100%', height:200}}>
              {[0,25,50,75,100].map(v => {
                const y = chartH - pad - (v/100) * (chartH - pad*2)
                return <g key={v}>
                  <line x1={pad} y1={y} x2={chartW-pad} y2={y} stroke="rgba(255,255,255,.06)" />
                  <text x={pad-8} y={y+4} fill="var(--muted)" fontSize="10" textAnchor="end">{Math.round(maxVal*v/100)}</text>
                </g>
              })}
              <path d={areaPath} fill="rgba(255,91,91,.08)" />
              <path d={linePath} fill="none" stroke="#ff5b5b" strokeWidth="2" />
              {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#ff5b5b" />)}
              {pts.map((p, i) => i % Math.ceil(pts.length/8) === 0 && (
                <text key={'l'+i} x={p.x} y={chartH-10} fill="var(--muted)" fontSize="10" textAnchor="middle">{p.label}</text>
              ))}
            </svg>
          )}
        </div>

        <div className="panel" style={{border:'1px solid rgba(255,91,91,.25)'}}>
          <div className="panel-head">
            <h3 style={{display:'flex', alignItems:'center', gap:8}}><IChart size={20} /> Quick Stats</h3>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:10}}>
            {quickStats.map((q, i) => (
              <div key={i} style={{display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'rgba(255,255,255,.03)', borderRadius:12, border:'1px solid rgba(255,255,255,.06)'}}>
                <div style={{width:38, height:38, borderRadius:10, background:q.bg, color:q.color, display:'grid', placeItems:'center'}}>{q.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'.85rem', color:'var(--muted)'}}>{q.label}</div>
                </div>
                <div style={{fontSize:'1.2rem', fontWeight:700, color:'#fff'}}>{q.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders + Low Stock */}
      <div className="dash-panels">
        <div className="panel">
          <div className="panel-head">
            <h3>🕘 Recent Orders</h3>
            {goSec && <button className="btn btn-sm" onClick={()=>goSec('orders')} style={{border:'1px solid var(--red-bright)', color:'var(--red-bright)', background:'transparent', padding:'6px 14px', borderRadius:8, cursor:'pointer'}}>View All</button>}
          </div>
          {recent.length === 0 ? (
            <div style={{textAlign:'center', padding:'40px 20px', color:'var(--muted)'}}>
              <div style={{fontSize:'2rem', marginBottom:8, opacity:.4}}>📋</div>
              <p style={{fontWeight:600, color:'#fff'}}>No recent orders found</p>
              <p style={{fontSize:'.85rem'}}>Orders will appear here once customers make a purchase.</p>
            </div>
          ) : (
            <div style={{overflowX:'auto'}}>
              <table className="panel-table">
                <thead><tr><th>Order ID</th><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>{recent.map(o => (
                  <tr key={o.id}>
                    <td style={{fontFamily:'monospace', fontSize:'.78rem'}}>{String(o.id).slice(0,8)}</td>
                    <td>{o.customer_name || '-'}</td>
                    <td>{money(o.grand_total)}</td>
                    <td><span className={`status-badge status-${o.status}`}>{o.status}</span></td>
                    <td style={{fontSize:'.8rem', color:'var(--muted)'}}>{new Date(o.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
        <div className="panel">
          <div className="panel-head">
            <h3>⚠️ Low Stock Products</h3>
            {goSec && <button className="btn btn-sm" onClick={()=>goSec('products')} style={{border:'1px solid var(--red-bright)', color:'var(--red-bright)', background:'transparent', padding:'6px 14px', borderRadius:8, cursor:'pointer'}}>View All</button>}
          </div>
          {lowStock.length === 0 ? (
            <div style={{textAlign:'center', padding:'40px 20px', color:'var(--muted)'}}>
              <p>সব ঠিক আছে ✅</p>
            </div>
          ) : (
            <div style={{overflowX:'auto'}}>
              <table className="panel-table">
                <thead><tr><th>Product</th><th>Stock</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>{lowStock.map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><b style={{color: p.stock_qty === 0 ? '#ff5b5b' : '#ffb84d'}}>{p.stock_qty}</b></td>
                    <td><span className="status-badge" style={{background:'rgba(255,91,91,.12)', color:'#ff5b5b'}}>{p.stock_qty === 0 ? 'Out of Stock' : 'Low Stock'}</span></td>
                    <td>{goSec && <button onClick={()=>goSec('products')} style={{border:'1px solid var(--red-bright)', color:'var(--red-bright)', background:'transparent', padding:'4px 12px', borderRadius:8, cursor:'pointer', fontSize:'.8rem'}}>Restock</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
