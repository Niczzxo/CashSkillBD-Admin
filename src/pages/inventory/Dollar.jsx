import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'
import { money, money4, dstr, err, isFinance, Tbl, Empty, LoadMore, inp, FinanceOnly } from './common.jsx'

const PAGE = 20
const TXN_BN = { buy: '💵 ক্রয়', sell: '💰 বিক্রয়' }
const ST_BN = { pending: '⏳ পেন্ডিং', completed: '✅ সম্পন্ন', cancelled: '✕ বাতিল', refunded: '↩️ রিফান্ড' }

export function Dollar({ session, role }) {
  const fin = isFinance(role)
  const [rate, setRate] = useState(null)
  const [history, setHistory] = useState([])
  const [rateForm, setRateForm] = useState({ buy_rate: '', sell_rate: '' })
  const [txns, setTxns] = useState([])
  const [tLoading, setTLoading] = useState(false)
  const [moreLoading, setMoreLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [stF, setStF] = useState('')
  const [typeF, setTypeF] = useState('')
  const [txnForm, setTxnForm] = useState({ txn_type: 'sell', usd_amount: '', fees: '', reference: '', customer_name: '', notes: '' })
  const [busy, setBusy] = useState(false)

  const loadRate = async () => {
    try {
      const j = await manageApi(session, 'dollar.rate_current')
      setRate(j.rate)
      const h = await manageApi(session, 'dollar.rate_history')
      setHistory(h.items || [])
    } catch (e) { err(e) }
  }

  const loadTxns = async (reset = true, cur = null) => {
    const curItems = cur || txns
    const off = reset ? 0 : curItems.length
    reset ? setTLoading(true) : setMoreLoading(true)
    try {
      const j = await manageApi(session, 'dollar.txn_list', {
        status: stF || undefined, txn_type: typeF || undefined, limit: PAGE, offset: off,
      })
      const list = j.items || []
      setTxns(reset ? list : [...curItems, ...list])
      setHasMore(list.length === PAGE)
    } catch (e) { err(e) }
    setTLoading(false); setMoreLoading(false)
  }

  useEffect(() => {
    loadRate()
    if (fin) loadTxns(true, [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setRateSubmit = async (e) => {
    e.preventDefault()
    if (!Number(rateForm.buy_rate) || !Number(rateForm.sell_rate)) return alert('ক্রয় ও বিক্রয় রেট দিন')
    setBusy(true)
    try {
      await manageApi(session, 'dollar.rate_set', { buy_rate: rateForm.buy_rate, sell_rate: rateForm.sell_rate })
      setRateForm({ buy_rate: '', sell_rate: '' })
      loadRate()
    } catch (e) { err(e) }
    setBusy(false)
  }

  const createTxn = async (e) => {
    e.preventDefault()
    if (!Number(txnForm.usd_amount)) return alert('USD পরিমাণ দিন')
    setBusy(true)
    try {
      const j = await manageApi(session, 'dollar.txn_create', {
        txn_type: txnForm.txn_type,
        usd_amount: txnForm.usd_amount,
        fees: txnForm.fees === '' ? 0 : txnForm.fees,
        reference: txnForm.reference.trim() || undefined,
        customer_name: txnForm.customer_name.trim() || undefined,
        notes: txnForm.notes.trim() || undefined,
      })
      alert(`✅ লেনদেন তৈরি! ৳${Number(j.item.bdt_amount).toLocaleString('en-IN')} (রেট স্ন্যাপশট: ${j.item.rate_snapshot})`)
      setTxnForm({ txn_type: 'sell', usd_amount: '', fees: '', reference: '', customer_name: '', notes: '' })
      loadTxns(true, [])
    } catch (e) { err(e) }
    setBusy(false)
  }

  const setTxnStatus = async (t, status) => {
    const bn = { completed: 'সম্পন্ন', cancelled: 'বাতিল', refunded: 'রিফান্ড' }[status]
    if (!confirm(`লেনদেন → ${bn} করবেন?`)) return
    try { await manageApi(session, 'dollar.txn_set_status', { id: t.id, status }); loadTxns(true, txns) }
    catch (e) { err(e) }
  }

  const previewRate = txnForm.txn_type === 'sell' ? rate?.sell_rate : rate?.buy_rate
  const previewBdt = previewRate && Number(txnForm.usd_amount) ? Number(txnForm.usd_amount) * Number(previewRate) : 0
  const TF = (k, v) => setTxnForm({ ...txnForm, [k]: v })

  return (
    <div>
      <h3 style={{ margin: '0 0 14px' }}>💵 ডলার ক্রয় / বিক্রয়</h3>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 10 }}>📊 বর্তমান রেট</h3>
        {rate ? (
          <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'center' }}>
            <div><small style={{ color: 'var(--muted)' }}>ক্রয় রেট</small><div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#7dffa8' }}>{money4(rate.buy_rate)}</div></div>
            <div><small style={{ color: 'var(--muted)' }}>বিক্রয় রেট</small><div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--red-bright)' }}>{money4(rate.sell_rate)}</div></div>
            <small style={{ color: 'var(--muted)' }}>কার্যকর: {dstr(rate.effective_from)}</small>
          </div>
        ) : <p style={{ color: 'var(--muted)' }}>এখনো কোনো রেট সেট করা হয়নি।</p>}
      </div>

      {!fin && <FinanceOnly text="ডলার রেট ও লেনদেন ব্যবস্থাপনা শুধু ফাইন্যান্স / অ্যাডমিনের জন্য।" />}
      {fin && (
        <>
          <div className="card form-card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 14 }}>⚙️ নতুন রেট সেট করুন</h3>
            <form onSubmit={setRateSubmit} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label>ক্রয় রেট (৳)</label>
                <input type="number" min="0" step="0.0001" value={rateForm.buy_rate} onChange={e => setRateForm({ ...rateForm, buy_rate: e.target.value })} style={{ margin: 0, width: 150 }} />
              </div>
              <div>
                <label>বিক্রয় রেট (৳)</label>
                <input type="number" min="0" step="0.0001" value={rateForm.sell_rate} onChange={e => setRateForm({ ...rateForm, sell_rate: e.target.value })} style={{ margin: 0, width: 150 }} />
              </div>
              <button className="btn" disabled={busy}>{busy ? '…' : 'রেট সেট করুন'}</button>
            </form>
            <p style={{ color: 'var(--muted)', fontSize: '.88rem', marginTop: 10 }}>💡 পুরনো রেট অটো বন্ধ হয়ে যাবে; সম্পন্ন লেনদেনের রেট স্ন্যাপশট অপরিবর্তিত থাকবে।</p>
          </div>

          <h3 style={{ margin: '0 0 14px' }}>🕘 রেট হিস্ট্রি</h3>
          <div style={{ marginBottom: 26 }}>
            <Tbl>
              <thead><tr><th>কার্যকর থেকে</th><th>কার্যকর পর্যন্ত</th><th>ক্রয়</th><th>বিক্রয়</th></tr></thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td>{dstr(h.effective_from)}</td>
                    <td>{h.effective_to ? dstr(h.effective_to) : <b style={{ color: '#7dffa8' }}>চলমান</b>}</td>
                    <td>{money4(h.buy_rate)}</td>
                    <td>{money4(h.sell_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </Tbl>
            {history.length === 0 && <Empty />}
          </div>

          <div className="card form-card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 14 }}>➕ নতুন লেনদেন</h3>
            <form onSubmit={createTxn}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
                <div>
                  <label>ধরন</label>
                  <select value={txnForm.txn_type} onChange={e => TF('txn_type', e.target.value)}>
                    <option value="sell">💰 বিক্রয় (কাস্টমারকে ডলার)</option>
                    <option value="buy">💵 ক্রয় (কাস্টমারের ডলার)</option>
                  </select>
                </div>
                <div>
                  <label>USD পরিমাণ *</label>
                  <input type="number" min="0" step="0.01" value={txnForm.usd_amount} onChange={e => TF('usd_amount', e.target.value)} />
                </div>
                <div>
                  <label>ফি / চার্জ (৳)</label>
                  <input type="number" min="0" step="0.01" value={txnForm.fees} onChange={e => TF('fees', e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <div>
                  <label>রেফারেন্স</label>
                  <input value={txnForm.reference} onChange={e => TF('reference', e.target.value)} placeholder="TrxID / রেফারেন্স" />
                </div>
                <div>
                  <label>কাস্টমার</label>
                  <input value={txnForm.customer_name} onChange={e => TF('customer_name', e.target.value)} />
                </div>
              </div>
              <label>নোট</label>
              <input value={txnForm.notes} onChange={e => TF('notes', e.target.value)} />
              {previewBdt > 0 && <p style={{ color: 'var(--muted)' }}>আনুমানিক: <b style={{ color: '#fff' }}>৳{previewBdt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</b> <small>(বর্তমান রেটে)</small></p>}
              <button className="btn" disabled={busy}>{busy ? 'সেভ হচ্ছে…' : 'লেনদেন তৈরি করুন'}</button>
            </form>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>🧾 লেনদেন তালিকা</h3>
            <select value={stF} onChange={e => setStF(e.target.value)} style={inp}>
              <option value="">সব স্ট্যাটাস</option>
              {Object.entries(ST_BN).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={typeF} onChange={e => setTypeF(e.target.value)} style={inp}>
              <option value="">ক্রয়+বিক্রয়</option>
              <option value="buy">ক্রয়</option>
              <option value="sell">বিক্রয়</option>
            </select>
            <button className="tab" onClick={() => loadTxns(true, [])}>প্রয়োগ</button>
          </div>
          {tLoading ? <p style={{ color: 'var(--muted)' }}>লোড হচ্ছে…</p> : (
            <Tbl>
              <thead><tr><th>তারিখ</th><th>ধরন</th><th>USD</th><th>রেট</th><th>BDT</th><th>ফি</th><th>মার্জিন</th><th>নিট</th><th>রেফারেন্স</th><th>স্ট্যাটাস</th><th></th></tr></thead>
              <tbody>
                {txns.map(t => (
                  <tr key={t.id}>
                    <td>{dstr(t.created_at)}</td>
                    <td>{TXN_BN[t.txn_type]}</td>
                    <td>${Number(t.usd_amount).toLocaleString('en-US')}</td>
                    <td>{money4(t.rate_snapshot)}</td>
                    <td><b>{money(t.bdt_amount, 'BDT')}</b></td>
                    <td>{money(t.fees, 'BDT')}</td>
                    <td style={{ color: '#7dffa8' }}>{money(t.gross_margin, 'BDT')}</td>
                    <td style={{ color: '#7dffa8', fontWeight: 700 }}>{money(t.net_profit, 'BDT')}</td>
                    <td><small>{t.reference || '—'}</small><br /><small style={{ color: 'var(--muted)' }}>{t.customer_name || ''}</small></td>
                    <td>{ST_BN[t.status] || t.status}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {t.status === 'pending' && (
                        <>
                          <button className="mini-btn ok" onClick={() => setTxnStatus(t, 'completed')}>✓ সম্পন্ন</button>{' '}
                          <button className="mini-btn no" onClick={() => setTxnStatus(t, 'cancelled')}>✕</button>
                        </>
                      )}
                      {t.status === 'completed' && (
                        <button className="mini-btn no" onClick={() => setTxnStatus(t, 'refunded')}>↩️ রিফান্ড</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tbl>
          )}
          {!tLoading && txns.length === 0 && <Empty text="কোনো লেনদেন নেই।" />}
          <LoadMore hasMore={hasMore} loading={moreLoading} onMore={() => loadTxns(false)} />
        </>
      )}
    </div>
  )
}
