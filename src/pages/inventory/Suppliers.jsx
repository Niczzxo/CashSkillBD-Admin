import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'
import { err, isFinance, Tbl, Empty } from './common.jsx'
import { Purchases } from './Purchases.jsx'

export function Suppliers({ session, role }) {
  const fin = isFinance(role)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', contact: '', notes: '' })
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const j = await manageApi(session, 'supplier.list')
      setItems(j.items || [])
    } catch (e) { err(e) }
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return alert('সাপ্লায়ারের নাম দিন')
    setBusy(true)
    try {
      if (editing) {
        await manageApi(session, 'supplier.update', {
          id: editing.id, name: form.name.trim(),
          contact: form.contact.trim() || undefined, notes: form.notes.trim() || undefined,
        })
      } else {
        await manageApi(session, 'supplier.create', {
          name: form.name.trim(), contact: form.contact.trim() || undefined,
          notes: form.notes.trim() || undefined,
        })
      }
      setForm({ name: '', contact: '', notes: '' }); setEditing(null); load()
    } catch (e) { err(e) }
    setBusy(false)
  }

  const F = (k, v) => setForm({ ...form, [k]: v })

  return (
    <div>
      <h3 style={{ margin: '0 0 14px' }}>🏭 সাপ্লায়ার</h3>
      {fin && (
        <div className="card form-card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 14 }}>{editing ? '✏️ সাপ্লায়ার এডিট' : '➕ নতুন সাপ্লায়ার'}</h3>
          <form onSubmit={save}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <div>
                <label>নাম *</label>
                <input value={form.name} onChange={e => F('name', e.target.value)} placeholder="সাপ্লায়ারের নাম" />
              </div>
              <div>
                <label>যোগাযোগ</label>
                <input value={form.contact} onChange={e => F('contact', e.target.value)} placeholder="ফোন / ইমেইল" />
              </div>
            </div>
            <label>নোট</label>
            <input value={form.notes} onChange={e => F('notes', e.target.value)} placeholder="অতিরিক্ত তথ্য" />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" disabled={busy}>{busy ? 'সেভ হচ্ছে…' : editing ? 'আপডেট করুন' : 'যোগ করুন'}</button>
              {editing && <button type="button" className="btn btn-ghost" onClick={() => { setEditing(null); setForm({ name: '', contact: '', notes: '' }) }}>বাতিল</button>}
            </div>
          </form>
        </div>
      )}

      {loading ? <p style={{ color: 'var(--muted)' }}>লোড হচ্ছে…</p> : (
        <Tbl>
          <thead><tr><th>নাম</th><th>যোগাযোগ</th><th>নোট</th>{fin && <th></th>}</tr></thead>
          <tbody>
            {items.map(s => (
              <tr key={s.id}>
                <td><b>{s.name}</b></td>
                <td>{s.contact || '—'}</td>
                <td style={{ maxWidth: 320 }}>{s.notes || '—'}</td>
                {fin && (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="mini-btn" onClick={() => { setEditing(s); setForm({ name: s.name || '', contact: s.contact || '', notes: s.notes || '' }); window.scrollTo(0, 0) }}>✏️</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Tbl>
      )}
      {!loading && items.length === 0 && <Empty text="কোনো সাপ্লায়ার নেই।" />}

      <Purchases session={session} role={role} />
    </div>
  )
}
