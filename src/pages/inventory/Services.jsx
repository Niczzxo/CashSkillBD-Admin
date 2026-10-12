import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'
import { dstr, dstrD, err, Tbl, Empty, LoadMore, inp, SVC_STATUS_BN } from './common.jsx'

const PAGE = 20
const TITLES = { ip: '🌐 IP ম্যানেজমেন্ট', vps: '🖥️ VPS ম্যানেজমেন্ট', number: '🔢 নাম্বার ম্যানেজমেন্ট' }
const SECRET_RE = /password|otp|secret|token|private_?key/i

export function Services({ session, role, serviceType }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [moreLoading, setMoreLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [statusF, setStatusF] = useState('')
  const [search, setSearch] = useState('')
  const [expOn, setExpOn] = useState(false)
  const [expDays, setExpDays] = useState('7')
  const [products, setProducts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', country: '', provider: '',
    product_id: '', duration_days: '', expires_at: '', login_username: '',
  })
  const [specs, setSpecs] = useState([{ k: '', v: '' }])
  const [busy, setBusy] = useState(false)
  const [renew, setRenew] = useState(null)
  const [renewDays, setRenewDays] = useState('30')
  const [hist, setHist] = useState(null) // {svc, events}

  const load = async (reset = true, cur = null) => {
    const curItems = cur || items
    const off = reset ? 0 : curItems.length
    reset ? setLoading(true) : setMoreLoading(true)
    try {
      const j = await manageApi(session, 'service.list', {
        service_type: serviceType,
        status: statusF || undefined,
        search: search.trim() || undefined,
        expiring_days: expOn ? (Number(expDays) || 7) : undefined,
        limit: PAGE, offset: off,
      })
      const list = j.items || []
      setItems(reset ? list : [...curItems, ...list])
      setHasMore(list.length === PAGE)
    } catch (e) { err(e) }
    setLoading(false); setMoreLoading(false)
  }

  const reloadAll = () => {
    setItems([]); setHist(null)
    load(true, [])
    manageApi(session, 'product.list', { product_type: serviceType, limit: 100 })
      .then(j => setProducts(j.items || [])).catch(() => {})
  }

  useEffect(() => { reloadAll() }, [serviceType]) // eslint-disable-line react-hooks/exhaustive-deps

  const checkSecrets = (obj) => {
    for (const [k, v] of Object.entries(obj)) {
      if (SECRET_RE.test(k) || SECRET_RE.test(String(v)))
        return `"${k}" — পাসওয়ার্ড / OTP / সিক্রেট রাখা যাবে না`
    }
    return null
  }

  const create = async (e) => {
    e.preventDefault()
    if (!form.customer_name.trim()) return alert('ক্রেতার নাম দিন')
    const specObj = {}
    for (const r of specs) {
      if (!r.k.trim() && !r.v.trim()) continue
      if (!r.k.trim()) return alert('স্পেসিফিকেশনের নাম (key) দিন')
      specObj[r.k.trim()] = r.v.trim()
    }
    const badField = checkSecrets(specObj)
    if (badField) return alert('❌ ' + badField + ' — সার্ভারও এটা ব্লক করবে।')
    setBusy(true)
    try {
      await manageApi(session, 'service.create', {
        service_type: serviceType,
        product_id: form.product_id || undefined,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim() || undefined,
        country: form.country.trim() || undefined,
        provider: form.provider.trim() || undefined,
        specs: specObj,
        login_username: form.login_username.trim() || undefined,
        duration_days: form.duration_days || undefined,
        expires_at: form.duration_days ? undefined : (form.expires_at || undefined),
      })
      setShowForm(false)
      setForm({ customer_name: '', customer_phone: '', country: '', provider: '', product_id: '', duration_days: '', expires_at: '', login_username: '' })
      setSpecs([{ k: '', v: '' }])
      load(true, [])
    } catch (e) { err(e) }
    setBusy(false)
  }

  const doRenew = async (e) => {
    e.preventDefault()
    if (!Number(renewDays)) return alert('দিন সংখ্যা দিন')
    try {
      await manageApi(session, 'service.renew', { id: renew.id, duration_days: Number(renewDays) })
      setRenew(null); setRenewDays('30'); load(true, items)
    } catch (e) { err(e) }
  }

  const setStatus = async (s, status, notes) => {
    const bn = { active: 'চালু', suspended: 'সাসপেন্ড', cancelled: 'বাতিল', expired: 'মেয়াদোত্তীর্ণ' }[status]
    if (!confirm(`"${s.customer_name}" → ${bn} করবেন?`)) return
    try {
      await manageApi(session, 'service.set_status', { id: s.id, status, notes: notes || undefined })
      load(true, items)
    } catch (e) { err(e) }
  }

  const openHist = async (s) => {
    try {
      const j = await manageApi(session, 'service.events', { service_id: s.id })
      setHist({ svc: s, events: j.items || [] })
      window.scrollTo(0, 0)
    } catch (e) { err(e) }
  }

  const F = (k, v) => setForm({ ...form, [k]: v })

  return (
    <div>
      <h3 style={{ margin: '0 0 14px' }}>{TITLES[serviceType]}</h3>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
        <input placeholder="🔍 ক্রেতা / ফোন" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, minWidth: 170 }} />
        <select value={statusF} onChange={e => setStatusF(e.target.value)} style={inp}>
          <option value="">সব স্ট্যাটাস</option>
          {Object.entries(SVC_STATUS_BN).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', color: 'var(--muted)' }}>
          <input type="checkbox" checked={expOn} onChange={e => setExpOn(e.target.checked)} style={{ width: 'auto' }} />
          শীঘ্রই মেয়াদ শেষ
        </label>
        {expOn && <input type="number" min="1" max="365" value={expDays} onChange={e => setExpDays(e.target.value)} style={{ ...inp, width: 80 }} />}
        {expOn && <span style={{ color: 'var(--muted)' }}>দিনের মধ্যে</span>}
        <button className="tab" onClick={() => load(true, [])}>প্রয়োগ</button>
        <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setShowForm(true); setHist(null); window.scrollTo(0, 0) }}>➕ নতুন সার্ভিস</button>
      </div>

      {hist && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3>📜 সার্ভিস হিস্ট্রি — {hist.svc.customer_name}</h3>
            <button className="mini-btn" onClick={() => setHist(null)}>✕ বন্ধ</button>
          </div>
          {hist.events.length === 0 ? <p style={{ color: 'var(--muted)' }}>কোনো ইভেন্ট নেই।</p> : (
            <div className="tbl-wrap"><table className="data-table">
              <thead><tr><th>সময়</th><th>ইভেন্ট</th><th>নোট</th></tr></thead>
              <tbody>
                {hist.events.map(ev => (
                  <tr key={ev.id}><td>{dstr(ev.created_at)}</td><td><b>{ev.event}</b></td><td>{ev.notes || '—'}</td></tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      )}

      {showForm && (
        <div className="card form-card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 14 }}>➕ নতুন {serviceType.toUpperCase()} সার্ভিস</h3>
          <form onSubmit={create}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <div>
                <label>ক্রেতার নাম *</label>
                <input value={form.customer_name} onChange={e => F('customer_name', e.target.value)} />
              </div>
              <div>
                <label>ফোন</label>
                <input value={form.customer_phone} onChange={e => F('customer_phone', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
              <div>
                <label>প্রোডাক্ট</label>
                <select value={form.product_id} onChange={e => F('product_id', e.target.value)}>
                  <option value="">— নেই —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>
              <div>
                <label>প্রোভাইডার</label>
                <input value={form.provider} onChange={e => F('provider', e.target.value)} />
              </div>
              <div>
                <label>দেশ</label>
                <input value={form.country} onChange={e => F('country', e.target.value)} placeholder="যেমন: USA" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
              <div>
                <label>মেয়াদ (দিন)</label>
                <input type="number" min="1" value={form.duration_days} onChange={e => F('duration_days', e.target.value)} placeholder="যেমন: 30" />
              </div>
              <div>
                <label>অথবা মেয়াদ শেষ তারিখ</label>
                <input type="date" value={form.expires_at} onChange={e => F('expires_at', e.target.value)} />
              </div>
              <div>
                <label>লগইন ইউজারনেম</label>
                <input value={form.login_username} onChange={e => F('login_username', e.target.value)} placeholder="শুধু ইউজারনেম — পাসওয়ার্ড নয়" />
              </div>
            </div>
            <label>স্পেসিফিকেশন <small style={{ color: 'var(--muted)' }}>(key : value — পাসওয়ার্ড/OTP/সিক্রেট রাখা যাবে না)</small></label>
            {specs.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <input value={r.k} onChange={e => setSpecs(specs.map((x, j) => j === i ? { ...x, k: e.target.value } : x))} placeholder="যেমন: ram" style={{ margin: 0 }} />
                <input value={r.v} onChange={e => setSpecs(specs.map((x, j) => j === i ? { ...x, v: e.target.value } : x))} placeholder="যেমন: 8GB" style={{ margin: 0 }} />
                <button type="button" className="mini-btn no" onClick={() => setSpecs(specs.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button type="button" className="mini-btn" onClick={() => setSpecs([...specs, { k: '', v: '' }])}>＋ স্পেসিফিকেশন</button>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button className="btn" disabled={busy}>{busy ? 'সেভ হচ্ছে…' : 'সার্ভিস তৈরি করুন'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>বাতিল</button>
            </div>
          </form>
        </div>
      )}

      {renew && (
        <div className="card form-card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 14 }}>🔄 রিনিউ — {renew.customer_name}</h3>
          <form onSubmit={doRenew} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div>
              <label>আরো কত দিন</label>
              <input type="number" min="1" value={renewDays} onChange={e => setRenewDays(e.target.value)} style={{ width: 120, margin: 0 }} />
            </div>
            <button className="btn">রিনিউ করুন</button>
            <button type="button" className="btn btn-ghost" onClick={() => setRenew(null)}>বাতিল</button>
          </form>
        </div>
      )}

      {loading ? <p style={{ color: 'var(--muted)' }}>লোড হচ্ছে…</p> : (
        <Tbl>
          <thead><tr><th>ক্রেতা</th><th>প্রোডাক্ট / প্রোভাইডার</th><th>ইউজারনেম</th><th>মেয়াদ শেষ</th><th>স্ট্যাটাস</th><th></th></tr></thead>
          <tbody>
            {items.map(s => (
              <tr key={s.id}>
                <td><b>{s.customer_name}</b><br /><small style={{ color: 'var(--muted)' }}>{s.customer_phone || ''}{s.country ? ' · ' + s.country : ''}</small></td>
                <td>{s.cashskillbd_products ? <><b>{s.cashskillbd_products.name}</b><br /></> : null}<small style={{ color: 'var(--muted)' }}>{s.provider || '—'}</small></td>
                <td><code>{s.login_username || '—'}</code></td>
                <td>{s.expires_at ? dstrD(s.expires_at) : '—'}</td>
                <td>{SVC_STATUS_BN[s.status] || s.status}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="mini-btn" onClick={() => openHist(s)}>📜</button>{' '}
                  <button className="mini-btn ok" onClick={() => setRenew(s)}>🔄</button>{' '}
                  {s.status === 'active' && <button className="mini-btn" onClick={() => setStatus(s, 'suspended')}>⏸️</button>}{' '}
                  {s.status === 'suspended' && <button className="mini-btn ok" onClick={() => setStatus(s, 'active')}>▶️</button>}{' '}
                  {['active', 'suspended'].includes(s.status) && <button className="mini-btn no" onClick={() => setStatus(s, 'cancelled')}>✕</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      )}
      {!loading && items.length === 0 && <Empty text="কোনো সার্ভিস নেই।" />}
      <LoadMore hasMore={hasMore} loading={moreLoading} onMore={() => load(false)} />
    </div>
  )
}
