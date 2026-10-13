import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

async function adminApi(session, action, payload = {}) {
  const r = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || 'failed')
  return j
}

const STATUS = ['open', 'in_progress', 'resolved', 'closed']
const STATUS_C = { open: '#ffb020', in_progress: '#4da3ff', resolved: '#3ddc84', closed: 'var(--muted)' }

export function Tickets({ session }) {
  const [tickets, setTickets] = useState([])
  const [filter, setFilter] = useState('open')
  const [openId, setOpenId] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const j = await adminApi(session, 'list_tickets', { status: filter === 'all' ? null : filter })
    setTickets(j.tickets || [])
  }
  useEffect(() => { load() }, [filter])

  const openTicket = async (id) => {
    setOpenId(id)
    const j = await adminApi(session, 'ticket_messages', { ticket_id: id })
    setMsgs(j.messages || [])
  }

  const setStatus = async (id, status) => {
    setBusy(true)
    await adminApi(session, 'ticket_set_status', { ticket_id: id, status })
    setBusy(false); load()
    if (openId === id) openTicket(id)
  }

  const sendReply = async (e) => {
    e.preventDefault()
    if (!reply.trim()) return
    setBusy(true)
    await adminApi(session, 'ticket_reply', { ticket_id: openId, message: reply.trim().slice(0, 2000) })
    setReply(''); setBusy(false); openTicket(openId); load()
  }

  const cur = tickets.find(t => t.id === openId)

  if (openId && cur) {
    return (
      <div>
        <button className="btn btn-sm btn-ghost" onClick={() => setOpenId(null)} style={{marginBottom:12}}>← Back</button>
        <div className="card" style={{marginBottom:16}}>
          <h3>#{cur.id} — {cur.subject}</h3>
          <p style={{color:'var(--muted)', fontSize:'.9rem', margin:'6px 0 12px'}}>
            {cur.profiles?.email || cur.user_id} • {cur.category} • {cur.priority} • {new Date(cur.created_at).toLocaleString()}
          </p>
          <p style={{whiteSpace:'pre-line', marginBottom:14}}>{cur.description}</p>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            {STATUS.map(s => (
              <button key={s} className={`btn btn-sm ${cur.status === s ? '' : 'btn-ghost'}`}
                disabled={busy} onClick={() => setStatus(cur.id, s)}>{s}</button>
            ))}
          </div>
        </div>
        <div className="card">
          <h4 style={{marginBottom:12}}>Conversation</h4>
          <div style={{display:'flex', flexDirection:'column', gap:10, marginBottom:16, maxHeight:340, overflowY:'auto'}}>
            {msgs.map(m => (
              <div key={m.id} style={{background: m.is_staff ? 'rgba(77,163,255,.08)' : 'rgba(255,255,255,.04)',
                border:'1px solid var(--border)', borderRadius:12, padding:'10px 14px'}}>
                <div style={{fontSize:'.78rem', color:'var(--muted)', marginBottom:4}}>
                  {m.is_staff ? '🎧 Staff' : '👤 Member'} • {new Date(m.created_at).toLocaleString()}
                </div>
                <div style={{whiteSpace:'pre-line'}}>{m.message}</div>
              </div>
            ))}
          </div>
          <form onSubmit={sendReply} style={{display:'flex', gap:8}}>
            <input placeholder="Reply as support…" value={reply} onChange={e => setReply(e.target.value)} maxLength={2000} style={{flex:1}} />
            <button className="btn" disabled={busy}>Send</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="tabs" style={{justifyContent:'flex-start', marginBottom:18}}>
        {['open', 'in_progress', 'resolved', 'closed', 'all'].map(f => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <div className="tbl-wrap"><table className="data-table">
        <thead><tr><th>ID</th><th>Subject</th><th>Member</th><th>Category</th><th>Priority</th><th>Status</th><th>Updated</th></tr></thead>
        <tbody>
          {tickets.map(t => (
            <tr key={t.id} onClick={() => openTicket(t.id)} style={{cursor:'pointer'}}>
              <td>#{t.id}</td>
              <td>{t.subject}</td>
              <td style={{fontSize:'.85rem'}}>{t.profiles?.email || t.user_id.slice(0, 8)}</td>
              <td>{t.category}</td>
              <td>{t.priority}</td>
              <td><b style={{color: STATUS_C[t.status]}}>{t.status}</b></td>
              <td style={{fontSize:'.85rem'}}>{new Date(t.updated_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {tickets.length === 0 && <p style={{color:'var(--muted)', padding:20}}>No tickets.</p>}
    </div>
  )
}

export function Inquiries({ session }) {
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('new')

  const load = async () => {
    const j = await adminApi(session, 'list_inquiries', { status: filter === 'all' ? null : filter })
    setRows(j.inquiries || [])
  }
  useEffect(() => { load() }, [filter])

  const setStatus = async (id, status) => {
    await adminApi(session, 'inquiry_set_status', { id, status })
    load()
  }

  return (
    <div>
      <div className="tabs" style={{justifyContent:'flex-start', marginBottom:18}}>
        {['new', 'replied', 'closed', 'all'].map(f => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:10}}>
        {rows.map(r => (
          <div className="card" key={r.id}>
            <div style={{display:'flex', justifyContent:'space-between', gap:10, marginBottom:8}}>
              <b>{r.subject}</b>
              <span style={{fontSize:'.85rem', color:'var(--muted)'}}>{new Date(r.created_at).toLocaleString()}</span>
            </div>
            <p style={{fontSize:'.9rem', color:'var(--muted)', marginBottom:8}}>
              {r.name} • {r.contact} • {r.category}
            </p>
            <p style={{whiteSpace:'pre-line', marginBottom:12}}>{r.message}</p>
            <div style={{display:'flex', gap:8}}>
              {['new', 'replied', 'closed'].map(s => (
                <button key={s} className={`btn btn-sm ${r.status === s ? '' : 'btn-ghost'}`}
                  onClick={() => setStatus(r.id, s)}>{s}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {rows.length === 0 && <p style={{color:'var(--muted)', padding:20}}>No inquiries.</p>}
    </div>
  )
}
