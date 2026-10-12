import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { navigate, link } from '../lib/router.js'
import { fmt } from '../config.js'

async function adminApi(session, action, payload = {}) {
  const r = await fetch('/api/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || 'failed')
  return j
}

import { Products } from './inventory/Products.jsx'
import { Suppliers } from './inventory/Suppliers.jsx'
import { SalesOrders } from './inventory/SalesOrders.jsx'
import { Services } from './inventory/Services.jsx'
import { Dollar } from './inventory/Dollar.jsx'
import { Reports } from './inventory/Reports.jsx'
import { PriceHistory } from './inventory/PriceHistory.jsx'
import { AuditLogs } from './inventory/AuditLogs.jsx'
import { Inventory } from './inventory/Inventory.jsx'
import { Dashboard } from './inventory/Dashboard.jsx'
import { SiteSettings } from './inventory/SiteSettings.jsx'

const GROUPS = [
  {
    title: null,
    items: [
      { id: 'dashboard', label: '📊 ড্যাশবোর্ড' },
      { id: 'site-settings', label: '⚙️ সাইট সেটিংস' },
      { id: 'orders', label: '🧾 অর্ডার' },
      { id: 'lessons', label: '🎬 লেসন' },
      { id: 'members', label: '👥 মেম্বার' },
      { id: 'team', label: '🛡️ টিম' },
      { id: 'reviews', label: '⭐ রিভিউ' },
    ],
  },
  {
    title: '📦 প্রোডাক্ট ম্যানেজমেন্ট',
    items: [
      { id: 'products', label: '📦 প্রোডাক্ট' },
      { id: 'ip', label: '🌐 IP' },
      { id: 'vps', label: '🖥️ VPS' },
      { id: 'number', label: '🔢 নাম্বার' },
      { id: 'dollar', label: '💵 ডলার' },
      { id: 'sales-orders', label: '🧾 বিক্রয় অর্ডার' },
      { id: 'inventory', label: '📊 ইনভেন্টরি' },
      { id: 'suppliers', label: '🏭 সাপ্লায়ার' },
      { id: 'reports', label: '📈 লাভ-ক্ষতি' },
      { id: 'price-history', label: '🕘 দামের ইতিহাস' },
      { id: 'audit-logs', label: '📝 অডিট লগ' },
    ],
  },
]

const SEC_TITLES = {
  dashboard: '📊 ড্যাশবোর্ড', 'site-settings': '⚙️ সাইট সেটিংস', orders: '🧾 অর্ডার', lessons: '🎬 লেসন', members: '👥 মেম্বার',
  team: '🛡️ টিম', reviews: '⭐ রিভিউ', products: '📦 প্রোডাক্ট ম্যানেজমেন্ট',
  ip: '🌐 IP ম্যানেজমেন্ট', vps: '🖥️ VPS ম্যানেজমেন্ট', number: '🔢 নাম্বার ম্যানেজমেন্ট',
  dollar: '💵 ডলার ক্রয় / বিক্রয়', 'sales-orders': '🧾 বিক্রয় অর্ডার',
  inventory: '📊 ইনভেন্টরি', suppliers: '🏭 সাপ্লায়ার ও ক্রয়',
  reports: '📈 লাভ-ক্ষতি রিপোর্ট', 'price-history': '🕘 দামের ইতিহাস', 'audit-logs': '📝 অডিট লগ',
}

export function Admin() {
  const { session, isStaff, role, signOut } = useAuth()
  const [sec, setSec] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!session) { navigate('/login'); return }
  }, [session])

  if (!session) return null
  if (!isStaff) {
    return (
      <div className="wrap" style={{padding:'140px 0', textAlign:'center'}}>
        <h2 className="sec-title">⛔ অ্যাক্সেস নেই</h2>
        <p style={{color:'var(--muted)'}}>এই পেজ শুধু অ্যাডমিন ও সাপোর্ট টিমের জন্য।</p>
      </div>
    )
  }

  const goSec = (id) => { setSec(id); setMenuOpen(false); window.scrollTo(0, 0) }

  const renderSec = () => {
    switch (sec) {
      case 'dashboard': return <Dashboard session={session} />
      case 'site-settings': return <SiteSettings session={session} role={role} />
      case 'orders': return <OrdersTab session={session} />
      case 'lessons': return <LessonsTab />
      case 'members': return <MembersTab session={session} />
      case 'team': return <TeamTab session={session} role={role} />
      case 'reviews': return <ReviewsTab />
      case 'products': return <Products session={session} role={role} />
      case 'ip': return <Services key="ip" session={session} role={role} serviceType="ip" />
      case 'vps': return <Services key="vps" session={session} role={role} serviceType="vps" />
      case 'number': return <Services key="number" session={session} role={role} serviceType="number" />
      case 'dollar': return <Dollar session={session} role={role} />
      case 'sales-orders': return <SalesOrders session={session} role={role} />
      case 'inventory': return <Inventory session={session} />
      case 'suppliers': return <Suppliers session={session} role={role} />
      case 'reports': return <Reports session={session} role={role} />
      case 'price-history': return <PriceHistory session={session} />
      case 'audit-logs': return <AuditLogs session={session} role={role} />
      default: return null
    }
  }

  return (
    <>
      <nav className="admin-nav">
        <div className="wrap admin-nav-inner">
          <div className="admin-brand">
            <span className="admin-brand-icon">🛠️</span>
            <div>
              <div className="admin-brand-name">CashSkillBD <span>Admin</span></div>
              <div className="admin-brand-tag">MANAGEMENT PANEL</div>
            </div>
          </div>
          <div className="admin-nav-right">
            <span className="role-badge">{role}</span>
            <button className="btn btn-sm btn-ghost hide-m" onClick={signOut}>লগআউট</button>
            <button className={`hamburger ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(!menuOpen)} aria-label="মেনু">
              <span /><span /><span />
            </button>
          </div>
        </div>
      </nav>
      <div className={`mnav-overlay ${menuOpen ? 'show' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`mnav ${menuOpen ? 'show' : ''}`}>
        <div className="mnav-head">
          <span className="brand-name">CashSkill<span>BD</span> Admin</span>
          <button className="mnav-x" onClick={() => setMenuOpen(false)}>✕</button>
        </div>
        <div className="mnav-links">
          {GROUPS.flatMap(g => g.items).map((it, i) => (
            <a key={it.id} onClick={() => goSec(it.id)} style={{animationDelay: `${i * 25}ms`}} className={sec === it.id ? 'active' : ''}>
              <span>{it.label}</span>
              <span className="mnav-arrow">→</span>
            </a>
          ))}
        </div>
        <div className="mnav-foot">
          <button className="btn btn-block btn-ghost" onClick={signOut}>লগআউট</button>
        </div>
      </aside>
      <section className="admin-sec" style={{minHeight:'90svh'}}>
        <div className="wrap">
          <div className="admin-layout">
            <aside className="admin-side">
              {GROUPS.map((g, gi) => (
                <div key={gi}>
                  {gi > 0 && <div className="grp-div" />}
                  {g.title && <div className="grp-title">{g.title}</div>}
                  {g.items.map(it => (
                    <button key={it.id} className={`admin-item ${sec === it.id ? 'active' : ''}`} onClick={() => goSec(it.id)}>
                      {it.label}
                    </button>
                  ))}
                </div>
              ))}
            </aside>
            <div className="admin-main">
              <h3 className="sec-title admin-sec-title">{SEC_TITLES[sec]}</h3>
              {renderSec()}
            </div>
        </div>
      </div>
    </section>
    </>
  )
}

/* ── Orders: verify payment -> activate enrollment ── */
function OrdersTab({ session }) {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('pending')
  const [busy, setBusy] = useState(null)

  const load = async () => {
    const { data } = await supabase.from('cashskillbd_orders').select('*').order('created_at', { ascending: false }).limit(50)
    setOrders(data || [])
  }
  useEffect(() => { load() }, [])

  const act = async (id, action) => {
    setBusy(id)
    try {
      await adminApi(session, action, { order_id: id })
      await load()
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const list = orders.filter(o => filter === 'all' || o.status === filter)

  return (
    <div>
      <div className="tabs" style={{justifyContent:'flex-start', marginBottom:18}}>
        {['pending', 'confirmed', 'all'].map(f => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'pending' ? '⏳ পেন্ডিং' : f === 'confirmed' ? '✅ কনফার্মড' : '📋 সব'}
          </button>
        ))}
      </div>
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <div className="tbl-wrap"><table className="data-table">
            <thead><tr><th>ক্রেতা</th><th>আইটেম</th><th>দাম</th><th>মেথড</th><th>TrxID</th><th>স্ট্যাটাস</th><th></th></tr></thead>
            <tbody>
              {list.map(o => (
                <tr key={o.id}>
                  <td><b>{o.name}</b><br/><small style={{color:'var(--muted)'}}>{o.mobile}</small></td>
                  <td>{o.item_name}</td>
                  <td>{fmt(o.price)}</td>
                  <td>{o.pay_method}</td>
                  <td><code>{o.trx_id}</code></td>
                  <td>{o.status === 'confirmed' ? <span style={{color:'#7dffa8'}}>✅</span> : <span style={{color:'#f5c86e'}}>⏳</span>}</td>
                  <td style={{whiteSpace:'nowrap'}}>
                    {o.status === 'pending' && (
                      <>
                        <button className="mini-btn ok" disabled={busy === o.id} onClick={() => act(o.id, 'verify_order')}>✓ ভেরিফাই</button>{' '}
                        <button className="mini-btn no" disabled={busy === o.id} onClick={() => act(o.id, 'reject_order')}>✕</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {list.length === 0 && <p style={{padding:20, color:'var(--muted)'}}>কোনো অর্ডার নেই।</p>}
        </div>
      </div>
      <p style={{color:'var(--muted)', fontSize:'.88rem', marginTop:12}}>💡 ভেরিফাই করলে পেমেন্ট কনফার্ম হবে + কোর্স থাকলে মেম্বারের এনরোলমেন্ট অটো-অ্যাক্টিভেট হবে।</p>
    </div>
  )
}

/* ── Lessons: video URL upload from admin panel ── */
function LessonsTab() {
  const [courses, setCourses] = useState([])
  const [courseId, setCourseId] = useState('')
  const [lessons, setLessons] = useState([])
  const [form, setForm] = useState({ title: '', description: '', video_url: '', duration_min: '', is_free_preview: false })
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('cashskillbd_courses').select('*').then(({ data }) => {
      setCourses(data || [])
      if (data?.length && !courseId) setCourseId(String(data[0].id))
    })
  }, [])

  const load = async (cid) => {
    const { data } = await supabase.from('cashskillbd_lessons').select('*').eq('course_id', cid).order('sort_order')
    setLessons(data || [])
  }
  useEffect(() => { if (courseId) load(courseId) }, [courseId])

  const reset = () => { setForm({ title: '', description: '', video_url: '', duration_min: '', is_free_preview: false }); setEditing(null) }

  const save = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return alert('লেসনের টাইটেল দিন')
    setBusy(true)
    const row = {
      course_id: Number(courseId),
      title: form.title.trim(),
      description: form.description.trim(),
      video_url: form.video_url.trim(),
      duration_min: Number(form.duration_min) || 0,
      is_free_preview: form.is_free_preview,
      sort_order: editing ? editing.sort_order : lessons.length,
    }
    const { error } = editing
      ? await supabase.from('cashskillbd_lessons').update(row).eq('id', editing.id)
      : await supabase.from('cashskillbd_lessons').insert(row)
    if (error) alert('❌ ' + error.message)
    else { reset(); load(courseId) }
    setBusy(false)
  }

  const del = async (id) => {
    if (!confirm('লেসনটি ডিলিট করবেন?')) return
    await supabase.from('cashskillbd_lessons').delete().eq('id', id)
    load(courseId)
  }

  const edit = (l) => {
    setEditing(l)
    setForm({ title: l.title, description: l.description || '', video_url: l.video_url || '', duration_min: l.duration_min || '', is_free_preview: l.is_free_preview })
    window.scrollTo(0, 0)
  }

  return (
    <div>
      <div className="card form-card" style={{marginBottom:24}}>
        <h3 style={{marginBottom:14}}>{editing ? '✏️ লেসন এডিট' : '➕ নতুন লেসন'}</h3>
        <label>কোর্স</label>
        <select value={courseId} onChange={e => setCourseId(e.target.value)}>
          {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <form onSubmit={save}>
          <label>টাইটেল *</label>
          <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="যেমন: VPS সেটআপ — পার্ট ১" />
          <label>ভিডিও URL * <small style={{color:'var(--muted)'}}>(YouTube / Facebook / Vimeo / mp4 লিংক পেস্ট করুন)</small></label>
          <input value={form.video_url} onChange={e => setForm({...form, video_url: e.target.value})} placeholder="https://youtube.com/watch?v=..." />
          <label>বর্ণনা</label>
          <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="লেসনে যা যা শেখানো হবে" />
          <div style={{display:'flex', gap:14, alignItems:'center', margin:'6px 0 14px', flexWrap:'wrap'}}>
            <label style={{margin:0}}>⏱️ মিনিট: <input type="number" min="0" value={form.duration_min} onChange={e => setForm({...form, duration_min: e.target.value})} style={{width:80, margin:0}} /></label>
            <label style={{margin:0, display:'flex', gap:8, alignItems:'center', cursor:'pointer'}}>
              <input type="checkbox" checked={form.is_free_preview} onChange={e => setForm({...form, is_free_preview: e.target.checked})} style={{width:'auto', margin:0}} /> 🆓 ফ্রি প্রিভিউ
            </label>
          </div>
          <div style={{display:'flex', gap:10}}>
            <button className="btn" disabled={busy}>{busy ? 'সেভ হচ্ছে…' : editing ? 'আপডেট করুন' : 'লেসন যোগ করুন'}</button>
            {editing && <button type="button" className="btn btn-ghost" onClick={reset}>বাতিল</button>}
          </div>
        </form>
      </div>

      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <div className="tbl-wrap"><table className="data-table">
            <thead><tr><th>#</th><th>টাইটেল</th><th>ভিডিও</th><th>ফ্রি</th><th></th></tr></thead>
            <tbody>
              {lessons.map((l, i) => (
                <tr key={l.id}>
                  <td>{i + 1}</td>
                  <td><b>{l.title}</b>{l.duration_min ? <small style={{color:'var(--muted)'}}> ({l.duration_min} মিনিট)</small> : null}</td>
                  <td>{l.video_url ? <a href={l.video_url} target="_blank" rel="noreferrer" style={{color:'#ff3b40'}}>🔗 দেখুন</a> : <span style={{color:'var(--muted)'}}>—</span>}</td>
                  <td>{l.is_free_preview ? '🆓' : '🔒'}</td>
                  <td style={{whiteSpace:'nowrap'}}>
                    <button className="mini-btn" onClick={() => edit(l)}>✏️</button>{' '}
                    <button className="mini-btn no" onClick={() => del(l.id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {lessons.length === 0 && <p style={{padding:20, color:'var(--muted)'}}>এই কোর্সে এখনো লেসন নেই।</p>}
        </div>
      </div>
    </div>
  )
}

/* ── Members list ── */
function MembersTab({ session }) {
  const [members, setMembers] = useState([])
  useEffect(() => {
    supabase.from('cashskillbd_profiles').select('*').order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setMembers(data || []))
  }, [])
  return (
    <div className="card" style={{padding:0, overflow:'hidden'}}>
      <div style={{overflowX:'auto'}}>
        <div className="tbl-wrap"><table className="data-table">
          <thead><tr><th>নাম</th><th>ইমেইল</th><th>রোল</th><th>জয়েন</th></tr></thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id}>
                <td>{m.full_name || '—'}</td><td>{m.email}</td>
                <td>{m.role === 'admin' ? '👑 অ্যাডমিন' : m.role === 'support' ? '🛡️ সাপোর্ট' : '👤 মেম্বার'}</td>
                <td>{new Date(m.created_at).toLocaleDateString('bn-BD')}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {members.length === 0 && <p style={{padding:20, color:'var(--muted)'}}>কোনো মেম্বার নেই।</p>}
      </div>
    </div>
  )
}

/* ── Team: role management (admin only) ── */
function TeamTab({ session, role }) {
  const [members, setMembers] = useState([])
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    supabase.from('cashskillbd_profiles').select('*').neq('role', 'member').order('created_at', { ascending: false })
      .then(({ data }) => setMembers(data || []))
  }
  useEffect(load, [])

  const setRole = async (id, newRole) => {
    if (!confirm(`রোল পরিবর্তন করে "${newRole}" করবেন?`)) return
    setBusy(true)
    try {
      await adminApi(session, 'set_role', { user_id: id, role: newRole })
      load()
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(false)
  }

  const addByEmail = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    try {
      const j = await adminApi(session, 'set_role_by_email', { email: email.trim(), role: 'support' })
      alert(j.added ? `✅ ${email} কে সাপোর্ট টিমে যোগ করা হয়েছে` : 'ℹ️ ' + (j.message || 'done'))
      setEmail('')
      load()
    } catch (ex) { alert('❌ ' + ex.message) }
    setBusy(false)
  }

  if (role !== 'admin') {
    return <div className="card"><p>🛡️ টিম ম্যানেজমেন্ট শুধু অ্যাডমিনের জন্য।</p></div>
  }

  return (
    <div>
      <div className="card form-card" style={{marginBottom:24}}>
        <h3 style={{marginBottom:10}}>➕ টিম মেম্বার যোগ করুন</h3>
        <p style={{color:'var(--muted)', fontSize:'.9rem', marginBottom:12}}>টিমমেট প্রথমে সাইটে রেজিস্টার করবে, তারপর এখানে তার ইমেইল দিয়ে সাপোর্ট রোল দিন।</p>
        <form onSubmit={addByEmail} style={{display:'flex', gap:10}}>
          <input type="email" placeholder="টিমমেটের ইমেইল" value={email} onChange={e => setEmail(e.target.value)} style={{margin:0}} />
          <button className="btn" disabled={busy} style={{whiteSpace:'nowrap'}}>{busy ? '…' : 'সাপোর্ট বানান'}</button>
        </form>
      </div>
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <div className="tbl-wrap"><table className="data-table">
            <thead><tr><th>নাম</th><th>ইমেইল</th><th>রোল</th><th></th></tr></thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id}>
                  <td>{m.full_name || '—'}</td><td>{m.email}</td>
                  <td>{m.role === 'admin' ? '👑 অ্যাডমিন' : '🛡️ সাপোর্ট'}</td>
                  <td style={{whiteSpace:'nowrap'}}>
                    {m.role === 'support' && <>
                      <button className="mini-btn ok" disabled={busy} onClick={() => setRole(m.id, 'admin')}>👑 অ্যাডমিন</button>{' '}
                      <button className="mini-btn no" disabled={busy} onClick={() => setRole(m.id, 'member')}>মেম্বার করুন</button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {members.length === 0 && <p style={{padding:20, color:'var(--muted)'}}>এখনো কোনো টিম মেম্বার নেই।</p>}
        </div>
      </div>
    </div>
  )
}

/* ── Reviews management ── */
function ReviewsTab() {
  const [reviews, setReviews] = useState([])
  const load = () => {
    supabase.from('cashskillbd_reviews').select('*').order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setReviews(data || []))
  }
  useEffect(load, [])

  const del = async (id) => {
    if (!confirm('রিভিউটি ডিলিট করবেন?')) return
    await supabase.from('cashskillbd_reviews').delete().eq('id', id)
    load()
  }

  return (
    <div className="card" style={{padding:0, overflow:'hidden'}}>
      <div style={{overflowX:'auto'}}>
        <div className="tbl-wrap"><table className="data-table">
          <thead><tr><th>লেখক</th><th>রিভিউ</th><th>লিংক</th><th></th></tr></thead>
          <tbody>
            {reviews.map(r => (
              <tr key={r.id}>
                <td><b>{r.author}</b></td>
                <td style={{maxWidth:340}}>{r.text || <span style={{color:'var(--muted)'}}>(টেক্সট নেই)</span>}</td>
                <td>{r.post_url ? <a href={r.post_url} target="_blank" rel="noreferrer" style={{color:'#ff3b40'}}>🔗</a> : '—'}</td>
                <td><button className="mini-btn no" onClick={() => del(r.id)}>🗑️</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {reviews.length === 0 && <p style={{padding:20, color:'var(--muted)'}}>কোনো রিভিউ নেই।</p>}
      </div>
    </div>
  )
}
