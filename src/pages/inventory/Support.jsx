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

export function SeminarRegs({ session }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [search, setSearch] = useState('')
  const [seminarF, setSeminarF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [payF, setPayF] = useState('all')
  const [dateF, setDateF] = useState('all')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', mobile: '', email: '' })
  const [exportOpen, setExportOpen] = useState(false)
  const [busy, setBusy] = useState(null)
  const PAGE_SIZE = 10

  const load = async () => {
    setLoading(true)
    setErr(null)
    try {
      const j = await adminApi(session, 'list_seminar_regs')
      setRows(j.regs || [])
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  // ── Derive statuses from available fields ──
  const checkInOf = (r) => r.checked_in === true || r.status === 'checked_in'
  const cancelledOf = (r) => r.status === 'cancelled'
  const payStatusOf = (r) => r.payment_status || (r.paid ? 'paid' : '—')

  const total = rows.length
  const checkedIn = rows.filter(checkInOf).length
  const cancelled = rows.filter(cancelledOf).length
  const pending = total - checkedIn - cancelled

  // ── Filters ──
  let list = rows
  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter(r => (r.name || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q) || (r.mobile || '').includes(q) || (r.seminar_title || '').toLowerCase().includes(q))
  }
  if (seminarF !== 'all') list = list.filter(r => (r.seminar_title || 'Weekly Free Seminar') === seminarF)
  if (statusF !== 'all') {
    if (statusF === 'checked_in') list = list.filter(checkInOf)
    else if (statusF === 'pending') list = list.filter(r => !checkInOf(r) && !cancelledOf(r))
    else if (statusF === 'cancelled') list = list.filter(cancelledOf)
  }
  if (payF !== 'all') list = list.filter(r => payStatusOf(r) === payF)
  if (dateF !== 'all') {
    const days = dateF === 'today' ? 1 : dateF === 'week' ? 7 : 30
    const cutoff = new Date(Date.now() - days * 864e5)
    list = list.filter(r => new Date(r.created_at) >= cutoff)
  }

  const clearFilters = () => { setSearch(''); setSeminarF('all'); setStatusF('all'); setPayF('all'); setDateF('all'); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const curPage = Math.min(page, totalPages)
  const pageItems = list.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE)

  const seminars = [...new Set(rows.map(r => r.seminar_title || 'Weekly Free Seminar'))]

  const del = async (r) => {
    if (!confirm(`"${r.name}"-এর registration delete করবেন?`)) return
    setBusy(r.id)
    try {
      await adminApi(session, 'delete_seminar_reg', { id: r.id })
      load()
    } catch (e) {
      alert('❌ ' + e.message)
    }
    setBusy(null)
  }

  const toggleCheckIn = async (r) => {
    setBusy(r.id)
    try {
      await adminApi(session, 'toggle_seminar_checkin', { id: r.id, checked_in: !checkInOf(r) })
      load()
    } catch (e) {
      alert('❌ Check-in update failed: ' + e.message + '\n\nNote: check-in column may not exist in DB yet.')
    }
    setBusy(null)
  }

  const addReg = async (e) => {
    e.preventDefault()
    if (!addForm.name.trim() || !addForm.mobile.trim()) return alert('Name ও Mobile দিন')
    setBusy('add')
    try {
      await adminApi(session, 'add_seminar_reg', { name: addForm.name.trim(), mobile: addForm.mobile.trim(), email: addForm.email.trim() })
      setShowAdd(false)
      setAddForm({ name: '', mobile: '', email: '' })
      load()
    } catch (ex) {
      alert('❌ ' + ex.message)
    }
    setBusy(null)
  }

  const exportCSV = () => {
    const header = 'Registration ID,Name,Email,Mobile,Seminar,Registration Date,Payment Status,Check-in\n'
    const rows2 = list.map(r => `REG-${String(r.id).padStart(4, '0')},"${r.name || ''}",${r.email || ''},${r.mobile || ''},"${r.seminar_title || 'Weekly Free Seminar'}",${new Date(r.created_at).toLocaleDateString('en-GB')},${payStatusOf(r)},${checkInOf(r) ? 'Checked In' : 'Not Checked'}`).join('\n')
    const blob = new Blob([header + rows2], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'seminar-registrations.csv'; a.click()
    URL.revokeObjectURL(url)
    setExportOpen(false)
  }

  const selStyle = {
    padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 8, color: '#fff', fontSize: '.82rem', outline: 'none', cursor: 'pointer',
  }
  const actionBtn = (bg, border, color) => ({
    padding: '6px 8px', borderRadius: 7, border: `1px solid ${border}`, background: bg, color, cursor: 'pointer', fontSize: 13, marginRight: 4,
  })
  const inp = {
    width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 9, color: '#fff', fontSize: '.9rem', outline: 'none', boxSizing: 'border-box',
  }

  const stats = [
    { label: 'Total Registrations', value: total.toLocaleString(), desc: 'All seminar registrations', color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '👥' },
    { label: 'Checked In', value: checkedIn.toLocaleString(), desc: 'Attended the seminar', color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '✓' },
    { label: 'Pending', value: pending.toLocaleString(), desc: 'Not yet checked in', color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '🕐' },
    { label: 'Cancelled', value: cancelled.toLocaleString(), desc: 'Registration cancelled', color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '✕' },
  ]

  if (loading) return <p style={{ color: 'var(--muted)', padding: 20 }}>Loading…</p>
  if (err) return <p style={{ color: '#ff6b6e', padding: 20 }}>Error: {err}</p>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>📅</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Seminar Registrations</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>Manage all seminar registrations, check-in status, attendance and manage participants.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
          <button onClick={() => setExportOpen(!exportOpen)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem' }}>
            ↓ Export ▾
          </button>
          {exportOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 160, marginTop: 6, background: '#1a0d0e', border: '1px solid rgba(232,35,42,.4)', borderRadius: 10, padding: 6, zIndex: 10, minWidth: 150 }}>
              <button onClick={exportCSV} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '.85rem' }}>Export as CSV</button>
            </div>
          )}
          <button onClick={() => setShowAdd(true)} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>
            + Add Registration
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: 200, background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: `1px solid ${s.color}55`, borderRadius: 14, padding: 18, display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: s.bg, display: 'grid', placeItems: 'center', fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{s.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>{s.desc}</div>
            </div>
            <span style={{ position: 'absolute', top: 14, right: 14, color: s.color, fontSize: 16 }}>→</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
        <input placeholder="Search by name, email, phone or seminar title…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 220, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
        <select value={seminarF} onChange={e => { setSeminarF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Seminars</option>
          {seminars.map(s => <option key={s} value={s} style={{ background: '#1a0d0e' }}>{s}</option>)}
        </select>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Statuses</option>
          <option value="checked_in" style={{ background: '#1a0d0e' }}>Checked In</option>
          <option value="pending" style={{ background: '#1a0d0e' }}>Pending</option>
          <option value="cancelled" style={{ background: '#1a0d0e' }}>Cancelled</option>
        </select>
        <select value={payF} onChange={e => { setPayF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Payment Status</option>
          <option value="paid" style={{ background: '#1a0d0e' }}>Paid</option>
          <option value="pending" style={{ background: '#1a0d0e' }}>Pending</option>
          <option value="failed" style={{ background: '#1a0d0e' }}>Failed</option>
        </select>
        <select value={dateF} onChange={e => { setDateF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Time</option>
          <option value="today" style={{ background: '#1a0d0e' }}>Today</option>
          <option value="week" style={{ background: '#1a0d0e' }}>Last 7 Days</option>
          <option value="month" style={{ background: '#1a0d0e' }}>Last 30 Days</option>
        </select>
        <button onClick={clearFilters} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontSize: '.85rem', fontWeight: 600 }}>Clear Filters</button>
        <button onClick={load} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>Refresh</button>
      </div>

      {/* Table */}
      <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.3)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                {['#', 'User', 'Seminar', 'Registration ID', 'Contact Info', 'Registration Date', 'Payment Status', 'Check-in Status', 'Attended', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((r, i) => {
                const checked = checkInOf(r)
                const pay = payStatusOf(r)
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '.85rem' }}>{(curPage - 1) * PAGE_SIZE + i + 1}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(232,35,42,.2)', display: 'grid', placeItems: 'center', color: '#ff6b6b', fontSize: '.75rem', fontWeight: 700, flexShrink: 0 }}>
                          {(r.name || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#fff', fontSize: '.88rem', whiteSpace: 'nowrap' }}>{r.name || '—'}</div>
                          <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>{r.email || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: '.85rem', color: '#fff', whiteSpace: 'nowrap' }}>{r.seminar_title || 'Weekly Free Seminar'}</div>
                      <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>{r.seminar_date ? new Date(r.seminar_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Friday 9:00 PM'} • {r.location || 'Online'}</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.78rem', fontWeight: 600, background: 'rgba(232,35,42,.12)', color: '#ff6b6b', border: '1px solid rgba(232,35,42,.4)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {r.registration_id || `REG-${String(r.id).padStart(4, '0')}`}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--silver)', fontSize: '.82rem', whiteSpace: 'nowrap' }}>{r.mobile || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: '.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}<br />
                      <span style={{ fontSize: '.72rem' }}>{new Date(r.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {pay === 'paid' ? (
                        <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)' }}>● Paid</span>
                      ) : pay === 'pending' ? (
                        <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: 'rgba(245,185,66,.15)', color: '#f5b942', border: '1px solid rgba(245,185,66,.4)' }}>● Pending</span>
                      ) : pay === 'failed' ? (
                        <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: 'rgba(232,35,42,.15)', color: '#ff6b6b', border: '1px solid rgba(232,35,42,.4)' }}>● Failed</span>
                      ) : (
                        <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: 'rgba(255,255,255,.06)', color: 'var(--muted)', border: '1px solid rgba(255,255,255,.15)' }}>● Free</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {checked ? (
                        <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)' }}>● Checked In</span>
                      ) : (
                        <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: 'rgba(232,35,42,.15)', color: '#ff6b6b', border: '1px solid rgba(232,35,42,.4)' }}>● Not Checked</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {checked ? (
                        <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)' }}>● Yes</span>
                      ) : (
                        <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: 'rgba(232,35,42,.15)', color: '#ff6b6b', border: '1px solid rgba(232,35,42,.4)' }}>● No</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <button title="View" onClick={() => setDetail(r)} style={actionBtn('transparent', 'rgba(255,255,255,.15)', '#fff')}>👁</button>
                      <button title="Toggle Check-in" onClick={() => toggleCheckIn(r)} disabled={busy === r.id} style={actionBtn('rgba(46,204,113,.1)', 'rgba(46,204,113,.4)', '#2ecc71')}>✓</button>
                      <button title="Delete" onClick={() => del(r)} disabled={busy === r.id} style={actionBtn('rgba(232,35,42,.1)', 'rgba(232,35,42,.4)', '#ff6b6b')}>🗑</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>No registrations found</div>
            <div style={{ fontSize: '.85rem' }}>No seminar registrations match your filters.</div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Showing {list.length === 0 ? 0 : (curPage - 1) * PAGE_SIZE + 1} to {Math.min(curPage * PAGE_SIZE, list.length)} of {list.length.toLocaleString()} registrations</span>
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
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setDetail(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Registration Details</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '.9rem' }}>
              <div><span style={{ color: 'var(--muted)' }}>Name: </span><b style={{ color: '#fff' }}>{detail.name}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Email: </span><b style={{ color: '#fff' }}>{detail.email || '—'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Mobile: </span><b style={{ color: '#fff' }}>{detail.mobile}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Seminar: </span><b style={{ color: '#fff' }}>{detail.seminar_title || 'Weekly Free Seminar'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Registered: </span>{new Date(detail.created_at).toLocaleString('en-GB')}</div>
              <div><span style={{ color: 'var(--muted)' }}>Check-in: </span><b style={{ color: '#fff' }}>{checkInOf(detail) ? 'Checked In' : 'Not Checked'}</b></div>
            </div>
          </div>
        </div>
      )}

      {/* Add Registration Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setShowAdd(false)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Add Registration</h3>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <form onSubmit={addReg} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} placeholder="Full Name *" style={inp} />
              <input value={addForm.mobile} onChange={e => setAddForm({ ...addForm, mobile: e.target.value })} placeholder="Mobile Number *" style={inp} />
              <input value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} placeholder="Email Address" style={inp} />
              <button type="submit" disabled={busy === 'add'} style={{ padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {busy === 'add' ? 'Adding…' : 'Add Registration'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
