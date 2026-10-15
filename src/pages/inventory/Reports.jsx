import { useEffect, useMemo, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'
import { useLang } from '../../i18n/LanguageContext.jsx'
import { tr } from '../../i18n/translations.js'
import { supabase } from '../../lib/supabase.js'

const todayStr = () => new Date().toISOString().slice(0, 10)
const monthAgo = () => new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)
const fmtMoney = (v, cur) => `${cur === 'USD' ? '$' : '৳'} ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`

export function Reports({ session, role, goSec: goSecProp }) {
  const { lang } = useLang()
  const [from, setFrom] = useState(monthAgo)
  const [to, setTo] = useState(todayStr)
  const [cur, setCur] = useState('BDT')
  const [period, setPeriod] = useState('daily')
  const [sum, setSum] = useState(null)
  const [orders, setOrders] = useState([])
  const [purchases, setPurchases] = useState([])
  const [prodSales, setProdSales] = useState([])
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [detail, setDetail] = useState(null)

  const run = async () => {
    setLoading(true)
    try {
      const [s, ps, o, pu, pr] = await Promise.all([
        manageApi(session, 'report.summary', { from, to, currency: cur }),
        manageApi(session, 'report.product_sales', { from, to }),
        manageApi(session, 'order.list', { limit: 500, offset: 0 }),
        manageApi(session, 'purchase.list', { limit: 500, offset: 0 }).catch(() => ({ items: [] })),
        manageApi(session, 'product.list', { limit: 500, offset: 0 }).catch(() => ({ items: [] })),
      ])
      setSum(s)
      setProdSales(ps.items || [])
      setOrders(o.items || [])
      setPurchases(pu.items || [])
      setProducts(pr.items || [])
      // Recent customers (members, newest first)
      const { data: profs } = await supabase.from('cashskillbd_profiles').select('id,full_name,email,avatar_url,created_at').eq('role', 'member').order('created_at', { ascending: false }).limit(5)
      setCustomers(profs || [])
    } catch (e) { alert(e.message) }
    setLoading(false)
  }
  useEffect(() => { run() }, [])

  // ── Filtered data ──
  const fromDate = new Date(from + 'T00:00:00')
  const toDate = new Date(to + 'T23:59:59')
  const inRange = (d) => { const t = new Date(d); return t >= fromDate && t <= toDate }
  const rangeOrders = useMemo(() => orders.filter(o => inRange(o.created_at) && (cur === 'BDT' ? (o.currency || 'BDT') === 'BDT' : (o.currency || 'BDT') === 'USD')), [orders, from, to, cur])
  const rangePurchases = useMemo(() => purchases.filter(p => inRange(p.purchased_at || p.created_at) && (cur === 'BDT' ? (p.currency || 'BDT') === 'BDT' : (p.currency || 'BDT') === 'USD')), [purchases, from, to, cur])

  // ── KPI ──
  const totalSales = sum?.revenue || 0
  const totalOrders = rangeOrders.length
  const newCustomers = customers.length
  const totalPurchaseAmt = sum?.purchase_costs || 0
  const totalProfit = sum?.net_profit || 0

  // ── Order status donut ──
  const statusCounts = { completed: 0, processing: 0, pending: 0, cancelled: 0 }
  rangeOrders.forEach(o => {
    if (o.status === 'delivered') statusCounts.completed++
    else if (o.status === 'confirmed') statusCounts.processing++
    else if (o.status === 'pending') statusCounts.pending++
    else statusCounts.cancelled++
  })
  const totalStatusOrders = rangeOrders.length

  // ── Chart series: daily / weekly (Monday-start) / monthly buckets ──
  const chartData = useMemo(() => {
    const start = new Date(fromDate)
    const end = new Date(toDate)
    const salesByDay = {}, purchByDay = {}
    rangeOrders.filter(o => ['confirmed', 'delivered'].includes(o.status)).forEach(o => {
      const d = o.created_at.slice(0, 10)
      salesByDay[d] = (salesByDay[d] || 0) + Number(o.grand_total || 0)
    })
    rangePurchases.forEach(p => {
      const d = (p.purchased_at || p.created_at).slice(0, 10)
      purchByDay[d] = (purchByDay[d] || 0) + Number(p.total_cost || 0)
    })
    const bucketKey = (iso) => {
      if (period === 'monthly') return iso.slice(0, 7)
      if (period === 'weekly') {
        const d = new Date(iso + 'T00:00:00')
        const monday = new Date(d)
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
        return monday.toISOString().slice(0, 10)
      }
      return iso
    }
    const bucketLabel = (key) => {
      if (period === 'monthly') return new Date(key + '-02T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
      return new Date(key + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    }
    const buckets = new Map()
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10)
      const key = bucketKey(iso)
      if (!buckets.has(key)) buckets.set(key, { date: key, label: bucketLabel(key), sales: 0, purchases: 0 })
      const b = buckets.get(key)
      b.sales += salesByDay[iso] || 0
      b.purchases += purchByDay[iso] || 0
    }
    return [...buckets.values()]
  }, [rangeOrders, rangePurchases, from, to, period])

  // ── Sales by payment method ──
  const payMethodTotals = {}
  rangeOrders.forEach(o => {
    const m = o.payment_method || '—'
    payMethodTotals[m] = (payMethodTotals[m] || 0) + Number(o.grand_total || 0)
  })
  const payMethods = Object.entries(payMethodTotals).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // ── Inventory overview ──
  const invIn = products.filter(p => Number(p.stock_qty || 0) > Number(p.low_stock_at ?? 5)).length
  const invLow = products.filter(p => Number(p.stock_qty || 0) > 0 && Number(p.stock_qty || 0) <= Number(p.low_stock_at ?? 5)).length
  const invOut = products.filter(p => Number(p.stock_qty || 0) <= 0).length

  // ── Recent transactions (sales + purchases) ──
  const transactions = [
    ...rangeOrders.map(o => ({ id: `ord-${o.id}`, date: o.created_at, type: 'sale', ref: o.order_no || `#CSB${o.id}`, desc: o.customer_name || tr(lang, 'reports_order_fallback'), amount: Number(o.grand_total || 0), pay: o.payment_method || '—', status: o.status, order: o })),
    ...rangePurchases.map(p => ({ id: `pur-${p.id}`, date: p.purchased_at || p.created_at, type: 'purchase', ref: `#PUR${p.id}`, desc: p.cashskillbd_products?.name || `Product #${p.product_id}`, amount: Number(p.total_cost || 0), pay: p.cashskillbd_suppliers?.name || '—', status: 'completed', purchase: p })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date))

  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const pageItems = transactions.slice((curPage - 1) * pageSize, curPage * pageSize)

  // ── Chart SVG ──
  const chartW = 640, chartH = 220
  const maxVal = Math.max(1, ...chartData.map(d => Math.max(d.sales, d.purchases)))
  const point = (idx, val) => {
    const x = chartData.length <= 1 ? 20 : 20 + (idx / (chartData.length - 1)) * (chartW - 40)
    const y = chartH - 30 - (val / maxVal) * (chartH - 50)
    return [x, y]
  }
  const salesPath = chartData.map((d, i) => point(i, d.sales).join(',')).join(' ')
  const purchPath = chartData.map((d, i) => point(i, d.purchases).join(',')).join(' ')
  const salesArea = chartData.length ? `20,${chartH - 30} ${salesPath} ${chartW - 20},${chartH - 30}` : ''
  const purchArea = chartData.length ? `20,${chartH - 30} ${purchPath} ${chartW - 20},${chartH - 30}` : ''

  // ── Donut SVG ──
  const donutColors = { completed: '#2ecc71', processing: '#4da3ff', pending: '#f5b942', cancelled: '#ff6b6b' }
  const donutLabels = { completed: tr(lang, 'reports_status_completed'), processing: tr(lang, 'reports_status_processing'), pending: tr(lang, 'reports_status_pending'), cancelled: tr(lang, 'reports_status_cancelled') }
  let donutAcc = 0
  const donutSegments = Object.entries(statusCounts).map(([k, v]) => {
    const pct = totalStatusOrders > 0 ? v / totalStatusOrders : 0
    const seg = { key: k, value: v, pct, start: donutAcc, end: donutAcc + pct }
    donutAcc += pct
    return seg
  })
  const polar = (frac) => {
    const angle = frac * 2 * Math.PI - Math.PI / 2
    return [60 + 48 * Math.cos(angle), 60 + 48 * Math.sin(angle)]
  }
  const donutPath = (seg) => {
    if (seg.pct === 0) return ''
    if (seg.pct >= 1) return `M 60 12 A 48 48 0 1 1 59.99 12 Z`
    const [x1, y1] = polar(seg.start)
    const [x2, y2] = polar(seg.end)
    return `M 60 60 L ${x1} ${y1} A 48 48 0 ${seg.pct > 0.5 ? 1 : 0} 1 ${x2} ${y2} Z`
  }

  const stats = [
    { label: tr(lang, 'reports_total_sales'), value: fmtMoney(totalSales, cur), desc: tr(lang, 'reports_vs_prev'), color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '🛒', trend: null },
    { label: tr(lang, 'reports_total_orders'), value: totalOrders.toLocaleString(), desc: tr(lang, 'reports_vs_prev'), color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '🧾', trend: null },
    { label: tr(lang, 'reports_new_customers'), value: newCustomers.toLocaleString(), desc: tr(lang, 'reports_vs_prev'), color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '👥', trend: null },
    { label: tr(lang, 'reports_total_purchases'), value: fmtMoney(totalPurchaseAmt, cur), desc: tr(lang, 'reports_vs_prev'), color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '📦', trend: null },
    { label: tr(lang, 'reports_total_profit'), value: fmtMoney(totalProfit, cur), desc: tr(lang, 'reports_vs_prev'), color: '#c084fc', bg: 'rgba(192,132,252,.15)', icon: '💰', trend: null },
  ]

  const avatarColors = ['#e8232a', '#4da3ff', '#2ecc71', '#f5b942', '#e84393', '#8e44ad', '#00cec9']
  const initials = (name) => (name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

  // Use Admin's state navigation; hash changes alone never switch sections.
  const goSec = goSecProp || ((sec) => { window.location.hash = `#/${sec}` })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>📊</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>{tr(lang, 'reports_title')}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'reports_subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 9, padding: '6px 10px' }}>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '.85rem', colorScheme: 'dark' }} />
            <span style={{ color: 'var(--muted)', fontSize: '.82rem' }}>{tr(lang, 'reports_to')}</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '.85rem', colorScheme: 'dark' }} />
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.03)', borderRadius: 9, padding: 3 }}>
            <button onClick={() => setCur('BDT')} style={{ padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '.82rem', background: cur === 'BDT' ? '#e8232a' : 'transparent', color: '#fff' }}>৳ BDT</button>
            <button onClick={() => setCur('USD')} style={{ padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '.82rem', background: cur === 'USD' ? 'rgba(255,255,255,.1)' : 'transparent', color: '#fff' }}>$ USD</button>
          </div>
          <button onClick={run} disabled={loading} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>
            {loading ? tr(lang, 'reports_generating') : tr(lang, 'reports_generate')}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: 170, background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: `1px solid ${s.color}55`, borderRadius: 14, padding: 18, display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: s.bg, display: 'grid', placeItems: 'center', fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{s.label}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 20, alignItems: 'start' }}>
        {/* Sales/Purchase Chart */}
        <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, padding: 20, gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
            <b style={{ color: '#fff' }}>{tr(lang, 'reports_chart_title')}</b>
            <select value={period} onChange={e => setPeriod(e.target.value)} style={{ padding: '6px 10px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, color: '#fff', fontSize: '.82rem', cursor: 'pointer' }}>
              <option value="daily" style={{ background: '#1a0d0e' }}>{tr(lang, 'reports_daily')}</option>
              <option value="weekly" style={{ background: '#1a0d0e' }}>{tr(lang, 'reports_weekly')}</option>
              <option value="monthly" style={{ background: '#1a0d0e' }}>{tr(lang, 'reports_monthly')}</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: '.82rem' }}>
            <span style={{ color: '#ff6b6b' }}>■ {tr(lang, 'reports_sales_legend')}</span>
            <span style={{ color: '#4da3ff' }}>■ {tr(lang, 'reports_purchase_legend')}</span>
          </div>
          {chartData.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>{tr(lang, 'reports_no_chart_data')}</div>
          ) : (
            <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
              {[0, 0.25, 0.5, 0.75, 1].map(f => (
                <line key={f} x1={20} x2={chartW - 20} y1={chartH - 30 - f * (chartH - 50)} y2={chartH - 30 - f * (chartH - 50)} stroke="rgba(255,255,255,.06)" strokeDasharray="3 3" />
              ))}
              <polygon points={salesArea} fill="rgba(232,35,42,.12)" />
              <polygon points={purchArea} fill="rgba(77,163,255,.08)" />
              <polyline points={salesPath} fill="none" stroke="#e8232a" strokeWidth="2" />
              <polyline points={purchPath} fill="none" stroke="#4da3ff" strokeWidth="2" />
              {chartData.map((d, i) => {
                if (i % Math.max(1, Math.floor(chartData.length / 8)) !== 0 && i !== chartData.length - 1) return null
                const [x] = point(i, 0)
                return <text key={i} x={x} y={chartH - 10} fill="#888" fontSize="10" textAnchor="middle">{d.label}</text>
              })}
            </svg>
          )}
        </div>

        {/* Donut */}
        <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, padding: 20 }}>
          <b style={{ color: '#fff', display: 'block', marginBottom: 14 }}>{tr(lang, 'reports_order_status')}</b>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
              <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%' }}>
                {donutSegments.map(seg => (
                  <path key={seg.key} d={donutPath(seg)} fill={donutColors[seg.key]} opacity={0.9} />
                ))}
                <circle cx="60" cy="60" r="32" fill="#120D0E" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>{totalStatusOrders}</div>
                  <div style={{ fontSize: '.68rem', color: 'var(--muted)' }}>{tr(lang, 'reports_total_orders')}</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {donutSegments.map(seg => (
                <div key={seg.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem' }}>
                  <span style={{ color: 'var(--silver)' }}><span style={{ color: donutColors[seg.key] }}>● </span>{donutLabels[seg.key]}</span>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{seg.value} ({Math.round(seg.pct * 100)}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Four Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
        {/* Top Products */}
        <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <b style={{ color: '#fff', fontSize: '.95rem' }}>{tr(lang, 'reports_top_products')}</b>
            <button onClick={() => goSec('products')} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.78rem' }}>{tr(lang, 'reports_view_all')}</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {prodSales.slice(0, 5).map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '.85rem' }}>
                <span style={{ color: 'var(--muted)', width: 16, textAlign: 'center' }}>{i + 1}</span>
                <span style={{ color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name || `${tr(lang, 'reports_product')} #${p.product_id}`}</span>
                <b style={{ color: '#fff' }}>{p.qty}</b>
              </div>
            ))}
            {prodSales.length === 0 && <div style={{ color: 'var(--muted)', fontSize: '.85rem' }}>{tr(lang, 'reports_no_sales')}</div>}
          </div>
        </div>

        {/* Sales by Payment Method */}
        <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <b style={{ color: '#fff', fontSize: '.95rem' }}>{tr(lang, 'reports_sales_by_payment')}</b>
            <button onClick={() => goSec('orders')} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.78rem' }}>{tr(lang, 'reports_view_all')}</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {payMethods.map(([m, amt], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '.85rem' }}>
                <span style={{ color: '#fff', flex: 1 }}>{m}</span>
                <b style={{ color: '#fff' }}>{fmtMoney(amt, cur)}</b>
              </div>
            ))}
            {payMethods.length === 0 && <div style={{ color: 'var(--muted)', fontSize: '.85rem' }}>{tr(lang, 'reports_no_payment_data')}</div>}
          </div>
        </div>

        {/* Inventory Overview */}
        <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <b style={{ color: '#fff', fontSize: '.95rem' }}>{tr(lang, 'reports_stock_status')}</b>
            <button onClick={() => goSec('inventory')} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.78rem' }}>{tr(lang, 'reports_view_all')}</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--silver)' }}>{tr(lang, 'reports_stock_in')}</span><b style={{ color: '#2ecc71' }}>{invIn}</b></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--silver)' }}>{tr(lang, 'reports_stock_low')}</span><b style={{ color: '#f5b942' }}>{invLow}</b></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--silver)' }}>{tr(lang, 'reports_stock_out')}</span><b style={{ color: '#ff6b6b' }}>{invOut}</b></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--silver)' }}>{tr(lang, 'reports_total_products')}</span><b style={{ color: '#fff' }}>{products.length}</b></div>
          </div>
        </div>

        {/* Recent Customers */}
        <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <b style={{ color: '#fff', fontSize: '.95rem' }}>{tr(lang, 'reports_new_customers_period')}</b>
            <button onClick={() => goSec('members')} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.78rem' }}>{tr(lang, 'reports_view_all')}</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {customers.slice(0, 5).map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '.85rem' }}>
                {c.avatar_url ? (
                  <img src={c.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: avatarColors[i % avatarColors.length], display: 'grid', placeItems: 'center', fontSize: '.68rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials(c.full_name)}</div>
                )}
                <span style={{ color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.full_name || c.email || '—'}</span>
                <span style={{ color: 'var(--muted)', fontSize: '.78rem' }}>{new Date(c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
            ))}
            {customers.length === 0 && <div style={{ color: 'var(--muted)', fontSize: '.85rem' }}>{tr(lang, 'reports_no_new_customers')}</div>}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b style={{ color: '#fff', fontSize: '1.02rem' }}>{tr(lang, 'reports_recent_txns')}</b>
          <button onClick={() => goSec('sales-orders')} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.82rem' }}>{tr(lang, 'reports_view_all')}</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                {['#', tr(lang, 'reports_th_date'), tr(lang, 'reports_th_type'), tr(lang, 'reports_th_reference'), tr(lang, 'reports_th_desc'), tr(lang, 'reports_th_amount'), tr(lang, 'reports_th_payment'), tr(lang, 'reports_th_status'), tr(lang, 'reports_th_actions')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '.85rem' }}>{(curPage - 1) * pageSize + i + 1}</td>
                  <td style={{ padding: '12px 14px', fontSize: '.82rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{new Date(t.date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={{ padding: '12px 14px' }}>
                    {t.type === 'sale' ? (
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.74rem', fontWeight: 600, background: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)' }}>{tr(lang, 'reports_sale')}</span>
                    ) : (
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.74rem', fontWeight: 600, background: 'rgba(232,35,42,.15)', color: '#ff6b6b', border: '1px solid rgba(232,35,42,.4)' }}>{tr(lang, 'reports_purchase')}</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '.82rem', color: 'var(--silver)', fontFamily: 'monospace' }}>{t.ref}</td>
                  <td style={{ padding: '12px 14px', fontSize: '.85rem', color: '#fff' }}>{t.desc}</td>
                  <td style={{ padding: '12px 14px', fontSize: '.85rem', color: '#fff', fontWeight: 600 }}>{fmtMoney(t.amount, cur)}</td>
                  <td style={{ padding: '12px 14px', fontSize: '.85rem', color: 'var(--silver)' }}>{t.pay}</td>
                  <td style={{ padding: '12px 14px' }}>
                    {t.status === 'delivered' || t.status === 'completed' ? (
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.74rem', fontWeight: 600, background: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)' }}>{tr(lang, 'reports_status_completed')}</span>
                    ) : t.status === 'confirmed' ? (
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.74rem', fontWeight: 600, background: 'rgba(77,163,255,.15)', color: '#4da3ff', border: '1px solid rgba(77,163,255,.4)' }}>{tr(lang, 'reports_status_processing')}</span>
                    ) : t.status === 'pending' ? (
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.74rem', fontWeight: 600, background: 'rgba(245,185,66,.15)', color: '#f5b942', border: '1px solid rgba(245,185,66,.4)' }}>{tr(lang, 'reports_status_pending')}</span>
                    ) : (
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.74rem', fontWeight: 600, background: 'rgba(232,35,42,.15)', color: '#ff6b6b', border: '1px solid rgba(232,35,42,.4)' }}>{tr(lang, 'reports_status_cancelled')}</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button title={tr(lang, 'reports_view')} onClick={() => setDetail(t)} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer' }}>👁</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>{tr(lang, 'reports_empty_title')}</div>
            <div style={{ fontSize: '.85rem' }}>{tr(lang, 'reports_empty_desc')}</div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>{tr(lang, 'reports_loading')}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{tr(lang, 'reports_showing')} {transactions.length === 0 ? 0 : (curPage - 1) * pageSize + 1} {tr(lang, 'reports_showing_to')} {Math.min(curPage * pageSize, transactions.length)} {tr(lang, 'reports_showing_of')} {transactions.length.toLocaleString()} {tr(lang, 'reports_transactions')}</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button onClick={() => setPage(Math.max(1, curPage - 1))} disabled={curPage <= 1} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: 'pointer', opacity: curPage <= 1 ? 0.4 : 1 }}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - curPage) <= 1).map((p, idx, arr) => (
              <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {idx > 0 && p - arr[idx - 1] > 1 && <span style={{ color: 'var(--muted)', padding: '0 2px' }}>…</span>}
                <button onClick={() => setPage(p)} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: p === curPage ? '#e8232a' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: p === curPage ? 700 : 400, fontSize: '.85rem' }}>{p}</button>
              </span>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, curPage + 1))} disabled={curPage >= totalPages} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: 'pointer', opacity: curPage >= totalPages ? 0.4 : 1 }}>›</button>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} style={{ marginLeft: 8, padding: '6px 8px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 7, color: '#fff', fontSize: '.82rem', cursor: 'pointer' }}>
              {[5, 10, 25, 50].map(n => <option key={n} value={n} style={{ background: '#1a0d0e' }}>{n} / {tr(lang, 'reports_per_page')}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setDetail(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{tr(lang, 'reports_detail_title')}</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '.9rem' }}>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'reports_detail_type')}</span><b style={{ color: '#fff' }}>{detail.type === 'sale' ? tr(lang, 'reports_detail_sale') : tr(lang, 'reports_detail_purchase')}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'reports_detail_reference')}</span><b style={{ color: '#fff' }}>{detail.ref}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'reports_detail_desc')}</span><b style={{ color: '#fff' }}>{detail.desc}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'reports_detail_amount')}</span><b style={{ color: '#fff' }}>{fmtMoney(detail.amount, cur)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'reports_detail_payment')}</span><b style={{ color: '#fff' }}>{detail.pay}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'reports_detail_status')}</span><b style={{ color: '#fff' }}>{detail.status}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'reports_detail_date')}</span>{new Date(detail.date).toLocaleString('en-GB')}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
