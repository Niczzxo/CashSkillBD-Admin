import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

// ── Role definitions (display mapping for existing DB roles) ──
const ROLES = [
  { id: 'admin', label: 'Super Admin', desc: 'Full access to all features and settings.', color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', border: 'rgba(232,35,42,.4)' },
  { id: 'support', label: 'Support Admin', desc: 'Can handle support, tickets and inquiries.', color: '#c084fc', bg: 'rgba(192,132,252,.12)', border: 'rgba(192,132,252,.4)' },
  { id: 'manager', label: 'Manager', desc: 'Can manage members, products, orders etc.', color: '#4da3ff', bg: 'rgba(77,163,255,.12)', border: 'rgba(77,163,255,.4)' },
  { id: 'payment', label: 'Payment Admin', desc: 'Can verify payments and manage transactions.', color: '#2ecc71', bg: 'rgba(46,204,113,.12)', border: 'rgba(46,204,113,.4)' },
  { id: 'content', label: 'Content Admin', desc: 'Can manage lessons, courses and seminars.', color: '#f5b942', bg: 'rgba(245,185,66,.12)', border: 'rgba(245,185,66,.4)' },
]

const PERMISSIONS = [
  'Dashboard', 'Site Settings', 'Orders Management', 'Members Management',
  'Lessons & Courses', 'Seminar Management', 'Products & VPS',
  'Reports & Analytics', 'Admin Management', 'Activity Logs',
]

const roleOf = (dbRole) => ROLES.find(r => r.id === dbRole) || ROLES[1]
const roleLabel = (dbRole) => dbRole === 'admin' ? 'Super Admin' : dbRole === 'support' ? 'Support Admin' : dbRole

async function adminApi(session, action, payload = {}) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j.error || 'Request failed')
  return j
}

export function AdminManagement({ session, role }) {
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleF, setRoleF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [dateF, setDateF] = useState('all')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(null)
  const [detail, setDetail] = useState(null)
  const [editAdmin, setEditAdmin] = useState(null)
  const [perms, setPerms] = useState(PERMISSIONS.slice(0, 6))
  const [form, setForm] = useState({ name: '', email: '', password: '', role: '', status: 'Active' })
  const [showPass, setShowPass] = useState(false)
  const PAGE_SIZE = 8
  const isSuperAdmin = role === 'admin'

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('cashskillbd_profiles').select('*').neq('role', 'member').order('created_at', { ascending: false })
    setAdmins(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Stats (real DB counts) ──
  const total = admins.length
  const superAdmins = admins.filter(a => a.role === 'admin').length
  const supportAdmins = admins.filter(a => a.role === 'support').length
  // Managers / Content Admins use extended roles if stored, else 0
  const managers = admins.filter(a => a.role === 'manager').length
  const contentAdmins = admins.filter(a => a.role === 'content').length

  // ── Filtered list ──
  let list = admins
  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter(a => (a.full_name || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q) || String(a.member_id || '').toLowerCase().includes(q))
  }
  if (roleF !== 'all') list = list.filter(a => a.role === roleF)
  if (statusF !== 'all') {
    const active = statusF === 'Active'
    list = list.filter(a => (a.is_active !== false) === active)
  }
  if (dateF !== 'all') {
    const days = dateF === 'today' ? 1 : dateF === 'week' ? 7 : 30
    const cutoff = new Date(Date.now() - days * 864e5)
    list = list.filter(a => new Date(a.created_at) >= cutoff)
  }

  const clearFilters = () => { setSearch(''); setRoleF('all'); setStatusF('all'); setDateF('all'); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const curPage = Math.min(page, totalPages)
  const pageItems = list.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE)

  const initials = (name) => {
    if (!name) return '?'
    const parts = name.trim().split(/\s+/)
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
  }
  const avatarColors = ['#e8232a', '#4da3ff', '#2ecc71', '#f5b942', '#e84393', '#8e44ad', '#00cec9']
  const avatarColor = (name) => {
    let h = 0
    for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) % 997
    return avatarColors[h % avatarColors.length]
  }

  const changeRole = async (admin, newRole) => {
    if (!isSuperAdmin) return alert('শুধু Super Admin রোল পরিবর্তন করতে পারে।')
    if (admin.role === 'admin' && superAdmins <= 1 && newRole !== 'admin') {
      return alert('⚠️ শেষ Super Admin-এর রোল পরিবর্তন করা যাবে না।')
    }
    if (!confirm(`"${admin.full_name || admin.email}"-এর রোল "${roleLabel(newRole)}" করবেন?`)) return
    setBusy(admin.id)
    try {
      await adminApi(session, 'set_role', { user_id: admin.id, role: newRole })
      load()
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const deactivate = async (admin) => {
    if (!isSuperAdmin) return alert('শুধু Super Admin এই কাজ করতে পারে।')
    if (admin.role === 'admin' && superAdmins <= 1) return alert('⚠️ শেষ Super Admin-কে deactivate করা যাবে না।')
    if (!confirm(`"${admin.full_name || admin.email}"-কে ${admin.is_active === false ? 'activate' : 'deactivate'} করবেন?`)) return
    setBusy(admin.id)
    try {
      const newRole = admin.is_active === false ? (admin.prev_role || 'support') : 'member'
      await adminApi(session, 'set_role', { user_id: admin.id, role: newRole })
      load()
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const remove = async (admin) => {
    if (!isSuperAdmin) return alert('শুধু Super Admin delete করতে পারে।')
    if (admin.role === 'admin' && superAdmins <= 1) return alert('⚠️ শেষ Super Admin-কে delete করা যাবে না।')
    if (!confirm(`"${admin.full_name || admin.email}"-কে admin থেকে সরাবেন?\n\nতার account member হিসেবে থাকবে, auth account delete হবে না।`)) return
    setBusy(admin.id)
    try {
      await adminApi(session, 'set_role', { user_id: admin.id, role: 'member' })
      load()
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const createAdmin = async (e) => {
    e.preventDefault()
    if (!isSuperAdmin) return alert('শুধু Super Admin নতুন admin তৈরি করতে পারে।')
    if (!form.name.trim()) return alert('Full Name দিন')
    if (!form.email.trim()) return alert('Email দিন')
    if (!form.role) return alert('Role নির্বাচন করুন')
    setBusy('create')
    try {
      const j = await adminApi(session, 'set_role_by_email', { email: form.email.trim(), role: form.role })
      alert(j.added ? `✅ ${form.email} কে ${roleLabel(form.role)} বানানো হয়েছে।\n\nনোট: ব্যবহারকারীকে প্রথমে সাইটে রেজিস্টার করতে হবে, তারপর এখানে promote করা যাবে।` : 'ℹ️ ' + (j.message || 'done'))
      setForm({ name: '', email: '', password: '', role: '', status: 'Active' })
      load()
    } catch (ex) { alert('❌ ' + ex.message) }
    setBusy(null)
  }

  const selStyle = {
    padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 8, color: '#fff', fontSize: '.85rem', outline: 'none', cursor: 'pointer', minWidth: 130,
  }
  const inp = {
    width: '100%', height: 42, padding: '0 12px', background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, color: '#fff',
    fontSize: '.9rem', outline: 'none', boxSizing: 'border-box',
  }
  const lbl = { display: 'block', fontSize: '.85rem', color: 'var(--silver)', marginBottom: 6, fontWeight: 500 }
  const card = {
    background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))',
    border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, padding: 20,
  }

  if (!isSuperAdmin) {
    return <div className="card"><p>🛡️ Admin Management শুধু Super Admin-এর জন্য।</p></div>
  }

  const stats = [
    { label: 'Total Admins', value: total, desc: 'All admin accounts', color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '👥' },
    { label: 'Super Admins', value: superAdmins, desc: 'Full access', color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '🛡' },
    { label: 'Managers', value: managers, desc: 'Management access', color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '👤' },
    { label: 'Support Admins', value: supportAdmins, desc: 'Support & communication', color: '#c084fc', bg: 'rgba(192,132,252,.15)', icon: '🎧' },
    { label: 'Content Admins', value: contentAdmins, desc: 'Content & courses', color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '📖' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>👥</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Admin Management</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>Manage admin accounts, assign roles and control their access to the admin panel.</p>
          </div>
        </div>
        <button onClick={() => document.getElementById('add-admin-form')?.scrollIntoView({ behavior: 'smooth' })}
          style={{ padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>
          + Add Admin
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: 180, background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: `1px solid ${s.color}55`, borderRadius: 14, padding: 18, display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
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
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
        <input placeholder="Search by name, email or admin ID…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 220, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.88rem', outline: 'none' }} />
        <select value={roleF} onChange={e => { setRoleF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Roles</option>
          {ROLES.map(r => <option key={r.id} value={r.id} style={{ background: '#1a0d0e' }}>{r.label}</option>)}
        </select>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Statuses</option>
          <option value="Active" style={{ background: '#1a0d0e' }}>Active</option>
          <option value="Inactive" style={{ background: '#1a0d0e' }}>Inactive</option>
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
      <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 850 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                {['#', 'Admin ID', 'Name', 'Email', 'Role', 'Status', 'Last Login', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '13px 16px', fontSize: '.8rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((a, i) => {
                const r = roleOf(a.role)
                const isActive = a.is_active !== false
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <td style={{ padding: '13px 16px', color: 'var(--muted)', fontSize: '.88rem' }}>{(curPage - 1) * PAGE_SIZE + i + 1}</td>
                    <td style={{ padding: '13px 16px', fontSize: '.85rem', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{a.member_id || `AD-${String(a.id).slice(0, 6).toUpperCase()}`}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: avatarColor(a.full_name), display: 'grid', placeItems: 'center', color: '#fff', fontSize: '.75rem', fontWeight: 700, flexShrink: 0 }}>{initials(a.full_name)}</div>
                        <span style={{ fontWeight: 600, color: '#fff', fontSize: '.9rem', whiteSpace: 'nowrap' }}>{a.full_name || '—'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '13px 16px', color: 'var(--silver)', fontSize: '.85rem' }}>{a.email}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ padding: '4px 11px', borderRadius: 7, fontSize: '.78rem', fontWeight: 600, background: r.bg, color: r.color, border: `1px solid ${r.border}`, whiteSpace: 'nowrap' }}>{r.label}</span>
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      {isActive ? (
                        <span style={{ padding: '4px 11px', borderRadius: 7, fontSize: '.78rem', fontWeight: 600, background: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)' }}>● Active</span>
                      ) : (
                        <span style={{ padding: '4px 11px', borderRadius: 7, fontSize: '.78rem', fontWeight: 600, background: 'rgba(232,35,42,.15)', color: '#ff6b6b', border: '1px solid rgba(232,35,42,.4)' }}>● Inactive</span>
                      )}
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: '.82rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {a.last_login ? new Date(a.last_login).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      {a.last_login && <><br /><span style={{ fontSize: '.75rem' }}>{new Date(a.last_login).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></>}
                    </td>
                    <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => setDetail(a)} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', marginRight: 5 }}>👁</button>
                      <button onClick={() => setEditAdmin(a)} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(245,185,66,.4)', background: 'rgba(245,185,66,.1)', color: '#f5b942', cursor: 'pointer', marginRight: 5 }}>✏️</button>
                      <button onClick={() => remove(a)} disabled={busy === a.id} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer' }}>🗑</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>No admins found</div>
            <div style={{ fontSize: '.85rem' }}>No admin accounts match your filters. Add a new admin below.</div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Showing {list.length === 0 ? 0 : (curPage - 1) * PAGE_SIZE + 1} to {Math.min(curPage * PAGE_SIZE, list.length)} of {list.length} admins</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setPage(Math.max(1, curPage - 1))} disabled={curPage <= 1} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: 'pointer', opacity: curPage <= 1 ? 0.4 : 1 }}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: p === curPage ? '#e8232a' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: p === curPage ? 700 : 400 }}>{p}</button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, curPage + 1))} disabled={curPage >= totalPages} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: 'pointer', opacity: curPage >= totalPages ? 0.4 : 1 }}>›</button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Add Admin | Roles | Permissions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>

        {/* Add New Admin */}
        <div id="add-admin-form" style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 18 }}>👥</div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>Add New Admin</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Create a new admin account and assign a role with specific permissions.</div>
            </div>
          </div>
          <form onSubmit={createAdmin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Full Name *</label>
                <input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Enter full name" />
              </div>
              <div>
                <label style={lbl}>Email Address *</label>
                <input style={inp} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="admin@example.com" />
              </div>
            </div>
            <div>
              <label style={lbl}>Password *</label>
              <div style={{ position: 'relative' }}>
                <input style={{ ...inp, paddingRight: 40 }} type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Enter password" />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16 }}>👁</button>
              </div>
              <small style={{ color: 'var(--muted)', fontSize: '.72rem' }}>User must register on the site first — this promotes their existing account. Password is not stored here.</small>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Role *</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="" style={{ background: '#1a0d0e' }}>Select a role</option>
                  <option value="admin" style={{ background: '#1a0d0e' }}>Super Admin</option>
                  <option value="support" style={{ background: '#1a0d0e' }}>Support Admin</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="Active" style={{ background: '#1a0d0e' }}>Active</option>
                  <option value="Inactive" style={{ background: '#1a0d0e' }}>Inactive</option>
                </select>
              </div>
            </div>
            <button type="submit" disabled={busy === 'create'} style={{ padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: busy === 'create' ? 'not-allowed' : 'pointer', boxShadow: '0 4px 16px rgba(232,35,42,.35)', opacity: busy === 'create' ? 0.6 : 1 }}>
              {busy === 'create' ? 'Creating…' : 'Create Admin'}
            </button>
          </form>
        </div>

        {/* Available Roles */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 18 }}>🛡</div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>Available Roles</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Predefined roles with different access levels.</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ROLES.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', background: 'rgba(255,255,255,.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,.06)' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: r.bg, display: 'grid', placeItems: 'center', fontSize: 15, flexShrink: 0 }}>{r.id === 'admin' ? '🛡' : r.id === 'support' ? '🎧' : r.id === 'manager' ? '👤' : r.id === 'payment' ? '💳' : '📖'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: r.color, fontSize: '.88rem' }}>{r.label}</div>
                  <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{r.desc}</div>
                </div>
                <span style={{ color: 'var(--muted)' }}>›</span>
              </div>
            ))}
          </div>
        </div>

        {/* Permissions */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 18 }}>⚙️</div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>Permissions</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Control what this admin can access.</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {PERMISSIONS.map(p => (
              <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '.88rem', color: '#fff' }}>
                <input type="checkbox" checked={perms.includes(p)} onChange={e => setPerms(e.target.checked ? [...perms, p] : perms.filter(x => x !== p))} style={{ width: 17, height: 17, accentColor: '#e8232a', cursor: 'pointer' }} />
                {p}
              </label>
            ))}
          </div>
          <p style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: 14, marginBottom: 0 }}>Permissions are enforced by role on the server. The selected items above reflect the current role's access.</p>
        </div>
      </div>

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setDetail(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Admin Details</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '.9rem' }}>
              <div><span style={{ color: 'var(--muted)' }}>Name: </span><b style={{ color: '#fff' }}>{detail.full_name || '—'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Email: </span><b style={{ color: '#fff' }}>{detail.email}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Admin ID: </span><b style={{ color: '#fff' }}>{detail.member_id || '—'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Role: </span><b style={{ color: '#fff' }}>{roleLabel(detail.role)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Joined: </span>{new Date(detail.created_at).toLocaleString('en-GB')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editAdmin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setEditAdmin(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Edit Admin Role</h3>
              <button onClick={() => setEditAdmin(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '.88rem' }}>{editAdmin.full_name || editAdmin.email}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <button onClick={() => { changeRole(editAdmin, 'admin'); setEditAdmin(null) }} style={{ padding: '10px', borderRadius: 9, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer', fontWeight: 600 }}>Make Super Admin</button>
              <button onClick={() => { changeRole(editAdmin, 'support'); setEditAdmin(null) }} style={{ padding: '10px', borderRadius: 9, border: '1px solid rgba(192,132,252,.4)', background: 'rgba(192,132,252,.08)', color: '#c084fc', cursor: 'pointer', fontWeight: 600 }}>Make Support Admin</button>
              <button onClick={() => { deactivate(editAdmin); setEditAdmin(null) }} style={{ padding: '10px', borderRadius: 9, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>{editAdmin.is_active === false ? 'Activate' : 'Deactivate (→ Member)'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Roles & Permissions page ── */
export function RolesPermissions() {
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22 }}>🛡</div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Roles & Permissions</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>Predefined roles and their access levels. Role changes are enforced by the server API.</p>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {ROLES.map(r => (
          <div key={r.id} style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: `1px solid ${r.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: r.bg, display: 'grid', placeItems: 'center', fontSize: 18 }}>{r.id === 'admin' ? '🛡' : r.id === 'support' ? '🎧' : r.id === 'manager' ? '👤' : r.id === 'payment' ? '💳' : '📖'}</div>
              <div style={{ fontWeight: 700, color: r.color, fontSize: '1.02rem' }}>{r.label}</div>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '.85rem', margin: '0 0 12px' }}>{r.desc}</p>
            <div style={{ fontSize: '.8rem', color: 'var(--silver)' }}>
              <b>Access:</b> {r.id === 'admin' ? 'All pages, all actions' : r.id === 'support' ? 'Tickets, Inquiries, Members (view)' : 'Assigned sections only'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Activity Logs page ── */
export function ActivityLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('cashskillbd_audit_logs').select('*').order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { setLogs(data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22 }}>📋</div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Activity Logs</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>Recent admin actions from the audit log.</p>
        </div>
      </div>
      <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
              {['Action', 'Entity', 'User', 'Time'].map(h => <th key={h} style={{ textAlign: 'left', padding: '13px 16px', fontSize: '.8rem', fontWeight: 600, color: 'var(--muted)' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <td style={{ padding: '13px 16px', color: '#fff', fontSize: '.88rem' }}>{l.action}</td>
                  <td style={{ padding: '13px 16px', color: 'var(--silver)', fontSize: '.85rem' }}>{l.entity_type || '—'} #{l.entity_id || '—'}</td>
                  <td style={{ padding: '13px 16px', color: 'var(--muted)', fontSize: '.82rem', fontFamily: 'monospace' }}>{String(l.user_id || '').slice(0, 8)}…</td>
                  <td style={{ padding: '13px 16px', color: 'var(--muted)', fontSize: '.82rem' }}>{new Date(l.created_at).toLocaleString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {logs.length === 0 && !loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No activity logs yet.</div>}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>}
      </div>
    </div>
  )
}
