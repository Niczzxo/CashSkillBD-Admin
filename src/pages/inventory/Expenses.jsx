import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'
import { money, err, isFinance, Tbl, Empty, LoadMore, FinanceOnly } from './common.jsx'

const PAGE = 20

export function Expenses({ session, role }) {
  const fin = isFinance(role)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [moreLoading, setMoreLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [form, setForm] = useState({ category: '', amount: '', currency: 'BDT', expense_date: new Date().toISOString().slice(0, 10), notes: '' })
  const [busy, setBusy] = useState(false)

  const load = async (reset = true, cur = null) => {
    const curItems = cur || items
    const off = reset ? 0 : curItems.length
    reset ? setLoading(true) : setMoreLoading(true)
    try {
      const j = await manageApi(session, 'expense.list', { limit: PAGE, offset: off })
      const list = j.items || []
      setItems(reset ? list : [...curItems, ...list])
      setHasMore(list.length === PAGE)
    } catch (e) { err(e) }
    setLoading(false); setMoreLoading(false)
  }

  useEffect(() => { if (fin) load(true, []) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!fin) return <FinanceOnly />

  const save = async (e) => {
    e.preventDefault()
    if (!form.category.trim() || !Number(form.amount)) return alert('খাত ও পরিমাণ দিন')
    setBusy(true)
    try {
      await manageApi(session, 'expense.create', {
        category: form.category.trim(),
        amount: form.amount,
        currency: form.currency,
        expense_date: form.expense_date,
        notes: form.notes.trim() || undefined,
      })
      setForm({ category: '', amount: '', currency: 'BDT', expense_date: new Date().toISOString().slice(0, 10), notes: '' })
      load(true, [])
    } catch (e) { err(e) }
    setBusy(false)
  }

  const F = (k, v) => setForm({ ...form, [k]: v })

  return (
    <div>
      <h3 style={{ margin: '0 0 14px' }}>💸 খরচ ব্যবস্থাপনা</h3>
      <div className="card form-card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 14 }}>➕ নতুন খরচ</h3>
        <form onSubmit={save}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
            <div>
              <label>খাত *</label>
              <input value={form.category} onChange={e => F('category', e.target.value)} placeholder="যেমন: বিজ্ঞাপন, সার্ভার" />
            </div>
            <div>
              <label>পরিমাণ *</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={e => F('amount', e.target.value)} />
            </div>
            <div>
              <label>কারেন্সি</label>
              <select value={form.currency} onChange={e => F('currency', e.target.value)}>
                <option value="BDT">BDT (৳)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div>
              <label>তারিখ</label>
              <input type="date" value={form.expense_date} onChange={e => F('expense_date', e.target.value)} />
            </div>
            <div>
              <label>নোট</label>
              <input value={form.notes} onChange={e => F('notes', e.target.value)} />
            </div>
          </div>
          <button className="btn" disabled={busy}>{busy ? 'সেভ হচ্ছে…' : 'খরচ যোগ করুন'}</button>
        </form>
      </div>

      {loading ? <p style={{ color: 'var(--muted)' }}>লোড হচ্ছে…</p> : (
        <Tbl>
          <thead><tr><th>তারিখ</th><th>খাত</th><th>পরিমাণ</th><th>নোট</th></tr></thead>
          <tbody>
            {items.map(x => (
              <tr key={x.id}>
                <td>{x.expense_date}</td>
                <td><b>{x.category}</b></td>
                <td><b>{money(x.amount, x.currency)}</b></td>
                <td style={{ maxWidth: 320 }}>{x.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      )}
      {!loading && items.length === 0 && <Empty text="কোনো খরচ রেকর্ড নেই।" />}
      <LoadMore hasMore={hasMore} loading={moreLoading} onMore={() => load(false)} />
    </div>
  )
}
