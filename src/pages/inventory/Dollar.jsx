import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'

const PAY_METHODS = ['bKash', 'Nagad', 'Rocket', 'Bank', 'USDT', 'Cash', 'Other']

export function Dollar({ session, role }) {
  const [rate, setRate] = useState(null)
  const [txns, setTxns] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeF, setTypeF] = useState('all')
  const [payF, setPayF] = useState('all')
  const [dateF, setDateF] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [txnType, setTxnType] = useState('buy')
  const [txnForm, setTxnForm] = useState({ usd_amount: '', reference: '', customer_name: '', notes: '', payment_method: 'bKash' })
  const [rateForm, setRateForm] = useState({ buy_rate: '', sell_rate: '' })
  const [showRateModal, setShowRateModal] = useState(false)
  const [detail, setDetail] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({ usd_amount: '', reference: '', customer_name: '', notes: '', payment_method: 'bKash' })
  const [busy, setBusy] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [r, t] = await Promise.all([
        manageApi(session, 'dollar.rate_current'),
        manageApi(session, 'dollar.txn_list', { limit: 500, offset: 0 }),
      ])
      setRate(r.rate)
      setTxns(t.items || [])
    } catch (e) { alert('❌ ' + e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Helpers ──
  const payOf = (t) => {
    const m = (t.notes || '').match(/^\[Payment:\s*([^\]]+)\]/)
    return m ? m[1] : '—'
  }
  const notesOf = (t) => (t.notes || '').replace(/^\[Payment:\s*[^\]]+\]\s*/, '')
  const completed = txns.filter(t => t.status === 'completed')
  const buyTxns = completed.filter(t => t.txn_type === 'buy')
  const sellTxns = completed.filter(t => t.txn_type === 'sell')
  const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const monthBuy = buyTxns.filter(t => new Date(t.created_at) >= thisMonth).reduce((s, t) => s + Number(t.usd_amount || 0), 0)
  const monthSell = sellTxns.filter(t => new Date(t.created_at) >= thisMonth).reduce((s, t) => s + Number(t.usd_amount || 0), 0)
  const totalBuyUsd = buyTxns.reduce((s, t) => s + Number(t.usd_amount || 0), 0)
  const totalSellUsd = sellTxns.reduce((s, t) => s + Number(t.usd_amount || 0), 0)
  const stock = totalBuyUsd - totalSellUsd
  const todayTxns = txns.filter(t => new Date(t.created_at) >= today)
  const todayBuy = todayTxns.filter(t => t.txn_type === 'buy').length
  const todaySell = todayTxns.filter(t => t.txn_type === 'sell').length

  // ── Filters ──
  let list = txns
  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter(t => (t.reference || '').toLowerCase().includes(q) || (t.customer_name || '').toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q) || new Date(t.created_at).toLocaleDateString('en-GB').includes(q))
  }
  if (typeF !== 'all') list = list.filter(t => t.txn_type === typeF)
  if (payF !== 'all') list = list.filter(t => payOf(t) === payF)
  if (dateF !== 'all') {
    const days = dateF === 'today' ? 1 : dateF === 'week' ? 7 : 30
    const cutoff = new Date(Date.now() - days * 864e5)
    list = list.filter(t => new Date(t.created_at) >= cutoff)
  }

  const clearFilters = () => { setSearch(''); setTypeF('all'); setPayF('all'); setDateF('all'); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const pageItems = list.slice((curPage - 1) * pageSize, curPage * pageSize)

  const currentRate = txnType === 'buy' ? Number(rate?.buy_rate || 0) : Number(rate?.sell_rate || 0)
  const usdAmt = Number(txnForm.usd_amount) || 0
  const totalBdt = usdAmt * currentRate

  const createTxn = async (e) => {
    e.preventDefault()
    if (!rate) return alert('আগে exchange rate সেট করুন')
    if (!usdAmt || usdAmt <= 0) return alert('সঠিক USD পরিমাণ দিন')
    if (txnType === 'sell' && usdAmt > stock) return alert(`Stock-এ পর্যাপ্ত USD নেই। Available: $${stock.toFixed(2)}`)
    if (!confirm(`${txnType === 'buy' ? 'ক্রয়' : 'বিক্রয়'} — $${usdAmt.toFixed(2)} @ ৳${currentRate.toFixed(2)} = ৳${totalBdt.toLocaleString('en-IN')}?\n\nConfirm করবেন?`)) return
    setBusy('create')
    try {
      await manageApi(session, 'dollar.txn_create', {
        txn_type: txnType, usd_amount: usdAmt, reference: txnForm.reference.trim(),
        customer_name: txnForm.customer_name.trim(),
        notes: `[Payment: ${txnForm.payment_method}] ${txnForm.notes.trim()}`.trim(),
      })
      setTxnForm({ usd_amount: '', reference: '', customer_name: '', notes: '', payment_method: 'bKash' })
      load()
      alert('✅ লেনদেন যোগ হয়েছে (Pending — approve করতে status change করুন)')
    } catch (ex) { alert('❌ ' + ex.message) }
    setBusy(null)
  }

  const updateRate = async () => {
    const buy = Number(rateForm.buy_rate), sell = Number(rateForm.sell_rate)
    if (!buy || !sell || buy <= 0 || sell <= 0) return alert('সঠিক rate দিন')
    if (!confirm(`Rate update করবেন?\n\nBuy: ৳${buy.toFixed(2)}\nSell: ৳${sell.toFixed(2)}`)) return
    setBusy('rate')
    try {
      await manageApi(session, 'dollar.rate_set', { buy_rate: buy, sell_rate: sell })
      setShowRateModal(false)
      load()
      alert('✅ Rate updated')
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const setStatus = async (t, status) => {
    if (!confirm(`Transaction-এর status "${status}" করবেন?`)) return
    setBusy(t.id)
    try {
      await manageApi(session, 'dollar.txn_set_status', { id: t.id, status })
      load()
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const del = async (t) => {
    if (t.status === 'completed') return alert('Completed transaction delete করা যাবে না — Refund করুন।')
    if (!confirm(`Transaction #${t.id} delete করবেন?`)) return
    setBusy(t.id)
    try {
      await manageApi(session, 'dollar.txn_delete', { id: t.id })
      load()
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!editing) return
    if (editing.status !== 'pending') return alert('শুধু Pending transaction edit করা যাবে')
    const usd = Number(editForm.usd_amount)
    if (!usd || usd <= 0) return alert('সঠিক USD পরিমাণ দিন')
    setBusy(editing.id)
    try {
      await manageApi(session, 'dollar.txn_update', {
        id: editing.id, usd_amount: usd, reference: editForm.reference.trim(),
        customer_name: editForm.customer_name.trim(),
        notes: `[Payment: ${editForm.payment_method}] ${editForm.notes.trim()}`.trim(),
      })
      setEditing(null)
      load()
    } catch (ex) { alert('❌ ' + ex.message) }
    setBusy(null)
  }

  const exportCSV = () => {
    const header = 'Date,Type,USD Amount,Rate,BDT Amount,Payment Method,Reference,Notes,Status\n'
    const rows = list.map(t => `${new Date(t.created_at).toLocaleString('en-GB')},${t.txn_type},${t.usd_amount},${t.rate_snapshot},${t.bdt_amount},${payOf(t)},${t.reference || ''},"${notesOf(t).replace(/"/g, '""')}",${t.status}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'dollar-transactions.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const inp = {
    width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 9, color: '#fff', fontSize: '.9rem', outline: 'none', boxSizing: 'border-box',
  }
  const lbl = { display: 'block', fontSize: '.82rem', color: 'var(--silver)', marginBottom: 5, fontWeight: 500 }
  const selStyle = {
    padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 8, color: '#fff', fontSize: '.82rem', outline: 'none', cursor: 'pointer',
  }

  const stats = [
    { label: 'মোট ডলার ক্রয়', value: `$${totalBuyUsd.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, desc: `এই মাসে মোট ক্রয়: $${monthBuy.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '$' },
    { label: 'মোট ডলার বিক্রয়', value: `$${totalSellUsd.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, desc: `এই মাসে মোট বিক্রয়: $${monthSell.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '↗' },
    { label: 'বর্তমান স্টক', value: `$${stock.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, desc: 'অবশিষ্ট ডলার ব্যালেন্স', color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '💰' },
    { label: 'আজকের লেনদেন', value: todayTxns.length.toLocaleString(), desc: `মোট ক্রয় ${todayBuy} | মোট বিক্রয় ${todaySell}`, color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '📊' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>💲</div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Dollar ক্রয় / বিক্রয়</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>ডলার ক্রয় ও বিক্রয়ের রেট ম্যানেজ করুন, নতুন লেনদেন যোগ করুন এবং সকল লেনদেনের ইতিহাস দেখুন।</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: 200, background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: `1px solid ${s.color}55`, borderRadius: 14, padding: 18, display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: s.bg, display: 'grid', placeItems: 'center', fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{s.label}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>{s.desc}</div>
            </div>
            <span style={{ position: 'absolute', top: 14, right: 14, color: s.color, fontSize: 16 }}>→</span>
          </div>
        ))}
      </div>

      {/* Rate + New Transaction */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 20, alignItems: 'start' }}>

        {/* Current Rate */}
        <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <b style={{ color: '#fff' }}>বর্তমান রেট</b>
            <button onClick={() => { setRateForm({ buy_rate: rate?.buy_rate || '', sell_rate: rate?.sell_rate || '' }); setShowRateModal(true) }} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.82rem' }}>রেট রিফ্রেশ</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div style={{ padding: 16, borderRadius: 12, background: 'rgba(46,204,113,.08)', border: '1px solid rgba(46,204,113,.3)', textAlign: 'center' }}>
              <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 6 }}>ক্রয় রেট (USD)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>৳ {rate ? Number(rate.buy_rate).toFixed(2) : '—'}</div>
              <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>(1 USD)</div>
            </div>
            <div style={{ padding: 16, borderRadius: 12, background: 'rgba(232,35,42,.08)', border: '1px solid rgba(232,35,42,.3)', textAlign: 'center' }}>
              <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 6 }}>বিক্রয় রেট (USD)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>৳ {rate ? Number(rate.sell_rate).toFixed(2) : '—'}</div>
              <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>(1 USD)</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.78rem', color: 'var(--muted)' }}>
            <span>সর্বশেষ আপডেট: {rate ? new Date(rate.effective_from).toLocaleString('en-GB') : '—'}</span>
            <button onClick={() => { setRateForm({ buy_rate: rate?.buy_rate || '', sell_rate: rate?.sell_rate || '' }); setShowRateModal(true) }} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontSize: '.82rem', fontWeight: 600 }}>রেট আপডেট করুন</button>
          </div>
        </div>

        {/* New Transaction */}
        <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <b style={{ color: '#fff' }}>নতুন লেনদেন যোগ করুন</b>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.04)', borderRadius: 9, padding: 3 }}>
              <button onClick={() => setTxnType('buy')} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '.82rem', background: txnType === 'buy' ? '#e8232a' : 'transparent', color: '#fff' }}>ডলার ক্রয়</button>
              <button onClick={() => setTxnType('sell')} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '.82rem', background: txnType === 'sell' ? 'rgba(255,255,255,.1)' : 'transparent', color: '#fff' }}>ডলার বিক্রয়</button>
            </div>
          </div>
          <form onSubmit={createTxn} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>USD পরিমাণ *</label>
                <input type="number" step="0.01" min="0" value={txnForm.usd_amount} onChange={e => setTxnForm({ ...txnForm, usd_amount: e.target.value })} style={inp} placeholder="যেমন: 100" />
              </div>
              <div>
                <label style={lbl}>রেট (৳) — বর্তমান রেট থেকে</label>
                <input value={currentRate ? currentRate.toFixed(2) : '—'} disabled style={{ ...inp, opacity: 0.6 }} />
              </div>
            </div>
            <div>
              <label style={lbl}>মোট টাকা (৳)</label>
              <input value={totalBdt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} disabled style={{ ...inp, opacity: 0.6, fontWeight: 700 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>পেমেন্ট মাধ্যম *</label>
                <select value={txnForm.payment_method} onChange={e => setTxnForm({ ...txnForm, payment_method: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  {PAY_METHODS.map(m => <option key={m} value={m} style={{ background: '#1a0d0e' }}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>কাস্টমার নাম</label>
                <input value={txnForm.customer_name} onChange={e => setTxnForm({ ...txnForm, customer_name: e.target.value })} style={inp} placeholder="কাস্টমার নাম" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>রেফারেন্স / ট্রানজেকশন আইডি</label>
                <input value={txnForm.reference} onChange={e => setTxnForm({ ...txnForm, reference: e.target.value })} style={inp} placeholder="TrxID / রেফারেন্স নম্বর" />
              </div>
              <div>
                <label style={lbl}>নোট (ঐচ্ছিক)</label>
                <input value={txnForm.notes} onChange={e => setTxnForm({ ...txnForm, notes: e.target.value })} style={inp} placeholder="নোট লিখুন…" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={busy === 'create'} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {busy === 'create' ? 'Adding…' : 'লেনদেন যোগ করুন'}
              </button>
              <button type="button" onClick={() => setTxnForm({ usd_amount: '', reference: '', customer_name: '', notes: '', payment_method: 'bKash' })} style={{ padding: '11px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>রিসেট</button>
            </div>
          </form>
        </div>
      </div>

      {/* History */}
      <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', flexWrap: 'wrap', gap: 10 }}>
          <b style={{ color: '#fff', fontSize: '1.02rem' }}>লেনদেনের ইতিহাস</b>
          <button onClick={exportCSV} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>↓ Export</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 18px 14px', alignItems: 'center' }}>
          <input placeholder="তারিখ, রেফারেন্স, নোট দিয়ে খুঁজুন…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ flex: 1, minWidth: 200, padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
          <select value={typeF} onChange={e => { setTypeF(e.target.value); setPage(1) }} style={selStyle}>
            <option value="all" style={{ background: '#1a0d0e' }}>সব ধরন</option>
            <option value="buy" style={{ background: '#1a0d0e' }}>ক্রয়</option>
            <option value="sell" style={{ background: '#1a0d0e' }}>বিক্রয়</option>
          </select>
          <select value={payF} onChange={e => { setPayF(e.target.value); setPage(1) }} style={selStyle}>
            <option value="all" style={{ background: '#1a0d0e' }}>সব পেমেন্ট মাধ্যম</option>
            {PAY_METHODS.map(m => <option key={m} value={m} style={{ background: '#1a0d0e' }}>{m}</option>)}
          </select>
          <select value={dateF} onChange={e => { setDateF(e.target.value); setPage(1) }} style={selStyle}>
            <option value="all" style={{ background: '#1a0d0e' }}>তারিখ অনুযায়ী ফিল্টার</option>
            <option value="today" style={{ background: '#1a0d0e' }}>আজকে</option>
            <option value="week" style={{ background: '#1a0d0e' }}>গত ৭ দিন</option>
            <option value="month" style={{ background: '#1a0d0e' }}>গত ৩০ দিন</option>
          </select>
          <button onClick={clearFilters} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontSize: '.85rem', fontWeight: 600 }}>ফিল্টার</button>
          <button onClick={load} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>রিসেট</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                {['#', 'তারিখ ও সময়', 'ধরন', 'USD পরিমাণ', 'রেট (৳)', 'মোট টাকা (৳)', 'পেমেন্ট মাধ্যম', 'রেফারেন্স', 'নোট', 'স্ট্যাটাস', 'অ্যাকশন'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '.85rem' }}>{(curPage - 1) * pageSize + i + 1}</td>
                  <td style={{ padding: '12px 14px', fontSize: '.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}<br />
                    <span style={{ fontSize: '.72rem' }}>{new Date(t.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {t.txn_type === 'buy' ? (
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)' }}>↓ ক্রয়</span>
                    ) : (
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: 'rgba(232,35,42,.15)', color: '#ff6b6b', border: '1px solid rgba(232,35,42,.4)' }}>↑ বিক্রয়</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#fff', fontSize: '.88rem', fontWeight: 600 }}>{Number(t.usd_amount).toFixed(2)}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--silver)', fontSize: '.85rem' }}>৳ {Number(t.rate_snapshot).toFixed(2)}</td>
                  <td style={{ padding: '12px 14px', color: '#fff', fontSize: '.88rem', fontWeight: 600 }}>৳ {Number(t.bdt_amount).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '12px 14px', fontSize: '.85rem', color: 'var(--silver)' }}>{payOf(t)}</td>
                  <td style={{ padding: '12px 14px', fontSize: '.82rem', color: 'var(--silver)', fontFamily: 'monospace' }}>{t.reference || '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: '.82rem', color: 'var(--muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notesOf(t) || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    {t.status === 'completed' ? (
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)' }}>✓ সম্পন্ন</span>
                    ) : t.status === 'pending' ? (
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: 'rgba(245,185,66,.15)', color: '#f5b942', border: '1px solid rgba(245,185,66,.4)' }}>⏳ পেন্ডিং</span>
                    ) : t.status === 'cancelled' ? (
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: 'rgba(255,255,255,.06)', color: 'var(--muted)', border: '1px solid rgba(255,255,255,.15)' }}>✕ বাতিল</span>
                    ) : (
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: 'rgba(232,35,42,.15)', color: '#ff6b6b', border: '1px solid rgba(232,35,42,.4)' }}>↩ রিফান্ড</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                    <button title="View" onClick={() => setDetail(t)} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', marginRight: 3 }}>👁</button>
                    {t.status === 'pending' && (
                      <>
                        <button title="Complete" onClick={() => setStatus(t, 'completed')} disabled={busy === t.id} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(46,204,113,.4)', background: 'rgba(46,204,113,.1)', color: '#2ecc71', cursor: 'pointer', marginRight: 3 }}>✓</button>
                        <button title="Edit" onClick={() => { setEditing(t); setEditForm({ usd_amount: t.usd_amount, reference: t.reference || '', customer_name: t.customer_name || '', notes: notesOf(t), payment_method: payOf(t) === '—' ? 'bKash' : payOf(t) }) }} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(245,185,66,.4)', background: 'rgba(245,185,66,.1)', color: '#f5b942', cursor: 'pointer', marginRight: 3 }}>✏️</button>
                      </>
                    )}
                    {t.status === 'completed' && (
                      <button title="Refund" onClick={() => setStatus(t, 'refunded')} disabled={busy === t.id} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(245,185,66,.4)', background: 'rgba(245,185,66,.1)', color: '#f5b942', cursor: 'pointer', marginRight: 3 }}>↩</button>
                    )}
                    {t.status === 'pending' && (
                      <button title="Delete" onClick={() => del(t)} disabled={busy === t.id} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer' }}>🗑</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>কোনো লেনদেন নেই</div>
            <div style={{ fontSize: '.85rem' }}>এখনো কোনো ডলার লেনদেন হয়নি।</div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Showing {list.length === 0 ? 0 : (curPage - 1) * pageSize + 1} to {Math.min(curPage * pageSize, list.length)} of {list.length.toLocaleString()} transactions</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button onClick={() => setPage(1)} disabled={curPage <= 1} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: 'pointer', opacity: curPage <= 1 ? 0.4 : 1 }}>«</button>
            <button onClick={() => setPage(Math.max(1, curPage - 1))} disabled={curPage <= 1} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: 'pointer', opacity: curPage <= 1 ? 0.4 : 1 }}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - curPage) <= 1).map((p, idx, arr) => (
              <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {idx > 0 && p - arr[idx - 1] > 1 && <span style={{ color: 'var(--muted)', padding: '0 2px' }}>…</span>}
                <button onClick={() => setPage(p)} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: p === curPage ? '#e8232a' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: p === curPage ? 700 : 400, fontSize: '.85rem' }}>{p}</button>
              </span>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, curPage + 1))} disabled={curPage >= totalPages} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: 'pointer', opacity: curPage >= totalPages ? 0.4 : 1 }}>›</button>
            <button onClick={() => setPage(totalPages)} disabled={curPage >= totalPages} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: 'pointer', opacity: curPage >= totalPages ? 0.4 : 1 }}>»</button>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} style={{ marginLeft: 8, padding: '6px 8px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 7, color: '#fff', fontSize: '.82rem', cursor: 'pointer' }}>
              {[5, 10, 20, 50].map(n => <option key={n} value={n} style={{ background: '#1a0d0e' }}>{n} / page</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Rate Modal */}
      {showRateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setShowRateModal(false)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>রেট আপডেট করুন</h3>
              <button onClick={() => setShowRateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={lbl}>ক্রয় রেট (৳ per 1 USD)</label><input type="number" step="0.01" min="0" value={rateForm.buy_rate} onChange={e => setRateForm({ ...rateForm, buy_rate: e.target.value })} style={inp} /></div>
              <div><label style={lbl}>বিক্রয় রেট (৳ per 1 USD)</label><input type="number" step="0.01" min="0" value={rateForm.sell_rate} onChange={e => setRateForm({ ...rateForm, sell_rate: e.target.value })} style={inp} /></div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={updateRate} disabled={busy === 'rate'} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  {busy === 'rate' ? 'Saving…' : 'Save Rate'}
                </button>
                <button onClick={() => setShowRateModal(false)} style={{ padding: '11px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setDetail(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Transaction Details</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '.9rem' }}>
              <div><span style={{ color: 'var(--muted)' }}>Type: </span><b style={{ color: '#fff' }}>{detail.txn_type === 'buy' ? 'ক্রয় (Buy)' : 'বিক্রয় (Sell)'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>USD: </span><b style={{ color: '#fff' }}>${Number(detail.usd_amount).toFixed(2)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Rate: </span><b style={{ color: '#fff' }}>৳{Number(detail.rate_snapshot).toFixed(2)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>BDT: </span><b style={{ color: '#fff' }}>৳{Number(detail.bdt_amount).toLocaleString('en-IN')}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Payment: </span><b style={{ color: '#fff' }}>{payOf(detail)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Customer: </span><b style={{ color: '#fff' }}>{detail.customer_name || '—'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Reference: </span><b style={{ color: '#fff' }}>{detail.reference || '—'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Notes: </span><span style={{ color: 'var(--silver)' }}>{notesOf(detail) || '—'}</span></div>
              <div><span style={{ color: 'var(--muted)' }}>Status: </span><b style={{ color: '#fff' }}>{detail.status}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Date: </span>{new Date(detail.created_at).toLocaleString('en-GB')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setEditing(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Edit Transaction (Pending)</h3>
              <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={lbl}>USD Amount</label><input type="number" step="0.01" min="0" value={editForm.usd_amount} onChange={e => setEditForm({ ...editForm, usd_amount: e.target.value })} style={inp} /></div>
              <div><label style={lbl}>Payment Method</label>
                <select value={editForm.payment_method} onChange={e => setEditForm({ ...editForm, payment_method: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  {PAY_METHODS.map(m => <option key={m} value={m} style={{ background: '#1a0d0e' }}>{m}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Customer Name</label><input value={editForm.customer_name} onChange={e => setEditForm({ ...editForm, customer_name: e.target.value })} style={inp} /></div>
              <div><label style={lbl}>Reference</label><input value={editForm.reference} onChange={e => setEditForm({ ...editForm, reference: e.target.value })} style={inp} /></div>
              <div><label style={lbl}>Notes</label><input value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} style={inp} /></div>
              <button type="submit" disabled={busy === editing.id} style={{ padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {busy === editing.id ? 'Saving…' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
