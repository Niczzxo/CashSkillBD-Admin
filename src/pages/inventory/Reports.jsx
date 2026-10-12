import { useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'
import { money, dstrD, err, isFinance, Tbl, Empty, inp, FinanceOnly } from './common.jsx'
import { Expenses } from './Expenses.jsx'

const todayStr = () => new Date().toISOString().slice(0, 10)
const monthAgo = () => new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)

function Stat({ icon, label, value, cur, accent }) {
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <small style={{ color: 'var(--muted)' }}>{icon} {label}</small>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: accent || '#fff', marginTop: 4 }}>{money(value, cur)}</div>
    </div>
  )
}

export function Reports({ session, role }) {
  const fin = isFinance(role)
  const [from, setFrom] = useState(monthAgo)
  const [to, setTo] = useState(todayStr)
  const [cur, setCur] = useState('BDT')
  const [sum, setSum] = useState(null)
  const [prodSales, setProdSales] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [expDays, setExpDays] = useState('14')
  const [expiring, setExpiring] = useState([])
  const [loading, setLoading] = useState(false)

  if (!fin) return <FinanceOnly />

  const run = async () => {
    setLoading(true)
    try {
      const [s, ps, ls] = await Promise.all([
        manageApi(session, 'report.summary', { from, to, currency: cur }),
        manageApi(session, 'report.product_sales', { from, to }),
        manageApi(session, 'report.low_stock'),
      ])
      setSum(s); setProdSales(ps.items || []); setLowStock(ls.items || [])
    } catch (e) { err(e) }
    setLoading(false)
  }

  const runExpiring = async () => {
    try {
      const j = await manageApi(session, 'report.expiring', { days: Number(expDays) || 14 })
      setExpiring(j.items || [])
    } catch (e) { err(e) }
  }

  return (
    <div>
      <h3 style={{ margin: '0 0 14px' }}>📈 লাভ-ক্ষতি রিপোর্ট</h3>
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ color: 'var(--muted)', fontSize: '.85rem' }}>থেকে</label><br />
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={{ color: 'var(--muted)', fontSize: '.85rem' }}>পর্যন্ত</label><br />
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inp} />
          </div>
          <div className="tabs" style={{ justifyContent: 'flex-start', marginBottom: 0 }}>
            {['BDT', 'USD'].map(c => (
              <button key={c} className={`tab ${cur === c ? 'active' : ''}`} onClick={() => setCur(c)}>{c === 'BDT' ? '৳ BDT' : '$ USD'}</button>
            ))}
          </div>
          <button className="btn btn-sm" disabled={loading} onClick={run}>{loading ? 'লোড হচ্ছে…' : '📊 রিপোর্ট দেখুন'}</button>
        </div>
      </div>

      {sum && (
        <>
          <div className="grid grid-4" style={{ marginBottom: 8 }}>
            <Stat icon="💰" label="বিক্রয় (Revenue)" value={sum.revenue} cur={cur} accent="#7dffa8" />
            <Stat icon="📦" label="পণ্য খরচ (COGS)" value={sum.cogs} cur={cur} />
            <Stat icon="📊" label="গ্রস মার্জিন" value={sum.gross_margin} cur={cur} accent="#7dffa8" />
            <Stat icon="💸" label="খরচ (Expenses)" value={sum.expenses} cur={cur} accent="#ff9a9a" />
          </div>
          <div className="grid grid-4" style={{ marginBottom: 8 }}>
            <Stat icon="✅" label="নিট লাভ" value={sum.net_profit} cur={cur} accent={Number(sum.net_profit) >= 0 ? '#7dffa8' : '#ff9a9a'} />
            <Stat icon="💵" label="ডলার মার্জিন" value={sum.dollar.gross_margin} cur={cur} />
            <Stat icon="💵" label="ডলার নিট" value={sum.dollar.net_profit} cur={cur} />
            <Stat icon="🏚️" label="স্টক মূল্যায়ন" value={sum.stock_valuation} cur={cur} />
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '.88rem', marginBottom: 26, background: 'rgba(232,35,42,.07)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
            💡 <b>বিক্রয় (Revenue)</b> = মোট বিক্রি · <b>গ্রস মার্জিন</b> = বিক্রয় − পণ্য খরচ · <b>নিট লাভ</b> = গ্রস মার্জিন − খরচ। নিট লাভ মানেই হাতে নগদ নয় — ক্যাশ ফ্লো আলাদা হিসাব।
          </p>

          <h3 style={{ margin: '0 0 14px' }}>🏆 প্রোডাক্ট অনুযায়ী বিক্রয়</h3>
          <div style={{ marginBottom: 26 }}>
            <Tbl>
              <thead><tr><th>প্রোডাক্ট</th><th>SKU</th><th>বিক্রীত সংখ্যা</th><th>বিক্রয়</th></tr></thead>
              <tbody>
                {prodSales.map(p => (
                  <tr key={p.product_id}>
                    <td><b>{p.name || '—'}</b></td>
                    <td><code>{p.sku || ''}</code></td>
                    <td>{p.qty}</td>
                    <td><b>{money(p.revenue, cur)}</b></td>
                  </tr>
                ))}
              </tbody>
            </Tbl>
            {prodSales.length === 0 && <Empty text="এই সময়ে বিক্রয় নেই।" />}
          </div>
        </>
      )}

      <h3 style={{ margin: '0 0 14px' }}>⚠️ লো-স্টক অ্যালার্ট</h3>
      <div style={{ marginBottom: 26 }}>
        <Tbl>
          <thead><tr><th>প্রোডাক্ট</th><th>SKU</th><th>স্টক</th><th>সীমা</th><th>স্ট্যাটাস</th></tr></thead>
          <tbody>
            {lowStock.map(p => (
              <tr key={p.id}>
                <td><b>{p.name}</b></td>
                <td><code>{p.sku}</code></td>
                <td style={{ color: '#ff9a9a', fontWeight: 700 }}>{p.stock_qty} ⚠️</td>
                <td>{p.low_stock_at}</td>
                <td>{p.status}</td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        {lowStock.length === 0 && <Empty text="সব স্টক ঠিক আছে। ✅" />}
      </div>

      <h3 style={{ margin: '0 0 14px' }}>⌛ মেয়াদোত্তীর্ণ হতে যাওয়া সার্ভিস</h3>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--muted)' }}>আগামী</span>
          <input type="number" min="1" max="365" value={expDays} onChange={e => setExpDays(e.target.value)} style={{ ...inp, width: 90 }} />
          <span style={{ color: 'var(--muted)' }}>দিনের মধ্যে</span>
          <button className="btn btn-sm" onClick={runExpiring}>দেখুন</button>
        </div>
      </div>
      <div style={{ marginBottom: 26 }}>
        <Tbl>
          <thead><tr><th>ক্রেতা</th><th>ধরন</th><th>প্রোডাক্ট</th><th>মেয়াদ শেষ</th><th>ফোন</th></tr></thead>
          <tbody>
            {expiring.map(s => (
              <tr key={s.id}>
                <td><b>{s.customer_name}</b></td>
                <td>{s.service_type.toUpperCase()}</td>
                <td>{s.cashskillbd_products?.name || '—'}</td>
                <td style={{ color: '#f5c86e', fontWeight: 700 }}>{dstrD(s.expires_at)}</td>
                <td>{s.customer_phone || '—'}</td>
              </tr>
            ))}
          </tbody>
        </Tbl>
        {expiring.length === 0 && <Empty text="দেখতে উপরের বাটন চাপুন।" />}
      </div>

      <Expenses session={session} role={role} />
    </div>
  )
}
