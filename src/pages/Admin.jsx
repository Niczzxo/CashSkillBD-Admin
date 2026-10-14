import { useEffect, useState } from 'react'
import { useLang } from '../i18n/LanguageContext.jsx'
import { LanguageSelector } from '../components/LanguageSelector.jsx'
import { tr } from '../i18n/translations.js'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { navigate, link } from '../lib/router.js'
import { fmt } from '../config.js'
import { ADMIN_LOGO } from '../lib/adminLogo.js'

// Strip leading emoji from translation labels (sidebar uses SVG icons instead)
const stripEmoji = (s) => String(s || '').replace(/^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{FE0F}\u{200D}\u{2640}\u{2642}\u{2690}-\u{269B}\u{2700}-\u{27BF}]+\s*/u, '').trim()
import { IDash, IGear, IOrders, ILessons, IMembers, ITeam, IReviews, ITickets, IInquiries, ISeminar, IProducts, IVps, IPayments, ISupport, IBox, IClock, IChart, IMoney, IWarn, IUsers, IArrowR } from '../components/icons.jsx'

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
import { VpsPlans } from './inventory/VpsPlans.jsx'
import { Suppliers } from './inventory/Suppliers.jsx'
import { SalesOrders } from './inventory/SalesOrders.jsx'
import { AdminManagement, RolesPermissions, ActivityLogs } from './inventory/AdminManagement.jsx'
import { CourseCustomers } from './inventory/CourseCustomers.jsx'
import { Services } from './inventory/Services.jsx'
import { Dollar } from './inventory/Dollar.jsx'
import { Reports } from './inventory/Reports.jsx'
import { PriceHistory } from './inventory/PriceHistory.jsx'
import { AuditLogs } from './inventory/AuditLogs.jsx'
import { Inventory } from './inventory/Inventory.jsx'
import { Dashboard } from './inventory/Dashboard.jsx'
import { SiteSettings } from './inventory/SiteSettings.jsx'
import { Tickets, Inquiries, SeminarRegs } from './inventory/Support.jsx'

const GROUPS = [
  {
    title: null,
    items: [
      { id: 'dashboard', key: 'dashboard', icon: <IDash /> },
      { id: 'site-settings', key: 'site_settings', icon: <IGear /> },
      { id: 'orders', key: 'orders', icon: <IOrders /> },
      { id: 'lessons', key: 'lessons', icon: <ILessons /> },
      { id: 'members', key: 'members', icon: <IMembers /> },
      { id: 'reviews', key: 'reviews', icon: <IReviews /> },
      { id: 'seminar-regs', key: 'seminar_regs', icon: <ISeminar /> },
    ],
  },
  {
    titleKey: 'products_mgmt',
    items: [
      { id: 'products', key: 'products', icon: <IProducts /> },
      { id: 'ip', key: 'services_ip', icon: <IProducts /> },
      { id: 'vps', key: 'services_vps', icon: <IVps /> },
      { id: 'vps-plans', key: 'vps_plans', icon: <IVps /> },
      { id: 'course-customers', key: 'course_customers', icon: <ILessons /> },
      { id: 'number', key: 'services_number', icon: <IProducts /> },
      { id: 'dollar', key: 'dollar', icon: <IPayments /> },
      { id: 'sales-orders', key: 'sales_orders', icon: <IOrders /> },
      { id: 'inventory', key: 'inventory', icon: <IBox /> },
      { id: 'suppliers', key: 'suppliers', icon: <IMembers /> },
      { id: 'reports', key: 'reports', icon: <IChart /> },
      { id: 'price-history', key: 'price_history', icon: <IClock /> },
      { id: 'audit-logs', key: 'audit_logs', icon: <IOrders /> },
    ],
  },
  {
    titleKey: 'admin_mgmt',
    items: [
      { id: 'admins', key: 'admins', icon: <IMembers /> },
      { id: 'roles', key: 'roles_permissions', icon: <IGear /> },
      { id: 'activity-logs', key: 'activity_logs', icon: <IOrders /> },
    ],
  },
]

const SEC_TITLES = {
  dashboard: 'dashboard', 'site-settings': 'site_settings', orders: 'orders', lessons: 'lessons', members: 'members', admins: 'admins', roles: 'roles_permissions', 'activity-logs': 'activity_logs', 'course-customers': 'course_customers',
  team: 'team', reviews: 'reviews', tickets: 'tickets', inquiries: 'inquiries', 'seminar-regs': 'seminar_regs', products: 'products_mgmt',
  ip: 'services_ip', vps: 'services_vps', number: 'services_number',
  dollar: 'dollar', 'sales-orders': 'sales_orders',
  inventory: 'inventory', suppliers: 'suppliers',
  reports: 'reports', 'price-history': 'price_history', 'audit-logs': 'audit_logs',
}

export function Admin() {
  const { session, isStaff, role, signOut } = useAuth()
  const { lang } = useLang()
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
      case 'dashboard': return <Dashboard session={session} goSec={goSec} />
      case 'site-settings': return <SiteSettings session={session} role={role} />
      case 'orders': return <OrdersTab session={session} />
      case 'lessons': return <LessonsTab />
      case 'members': return <MembersTab session={session} />
      case 'team': return <TeamTab session={session} role={role} />
      case 'reviews': return <ReviewsTab />
      case 'tickets': return <Tickets session={session} />
      case 'inquiries': return <Inquiries session={session} />
      case 'seminar-regs': return <SeminarRegs session={session} />
      case 'products': return <Products session={session} role={role} />
      case 'vps-plans': return <VpsPlans session={session} role={role} />
      case 'course-customers': return <CourseCustomers />
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
      case 'admins': return <AdminManagement session={session} role={role} />
      case 'roles': return <RolesPermissions />
      case 'activity-logs': return <ActivityLogs />
      default: return null
    }
  }

  return (
    <>
      <nav className="admin-nav">
        <div className="wrap admin-nav-inner">
          <div className="admin-brand">
            <img src={ADMIN_LOGO} alt="CashSkillBD Admin" style={{width:44, height:44, objectFit:'contain', borderRadius:10}} onError={(e)=>{e.target.style.display='none'}} />
            <div>
              <div className="admin-brand-name">CashSkillBD <span>Admin</span></div>
              <div className="admin-brand-tag">MANAGEMENT PANEL</div>
            </div>
          </div>
          <div className="admin-nav-right">
            <span className="role-badge">{role}</span>
            <LanguageSelector />
            <button className="btn btn-sm btn-ghost hide-m" onClick={signOut}>{tr(lang, 'logout')}</button>
            <button className={`hamburger ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(!menuOpen)} aria-label={tr(lang, 'menu')}>
              <span /><span /><span />
            </button>
          </div>
        </div>
      </nav>
      <div className={`mnav-overlay ${menuOpen ? 'show' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`mnav ${menuOpen ? 'show' : ''}`}>
        <div className="mnav-head">
          <img src={ADMIN_LOGO} alt="CashSkillBD Admin" style={{height:40, objectFit:'contain'}} onError={(e)=>{e.target.style.display='none'}} />
          <button className="mnav-x" onClick={() => setMenuOpen(false)}>×</button>
        </div>
        <div className="mnav-links">
          {GROUPS.flatMap(g => g.items).map((it, i) => (
            <a key={it.id} onClick={() => goSec(it.id)}  className={sec === it.id ? 'active' : ''}>
              <span>{tr(lang, it.key)}</span>
              <span className="mnav-arrow">→</span>
            </a>
          ))}
        </div>
        <div className="mnav-foot">
          <LanguageSelector onSelect={() => setMenuOpen(false)} />
          <div style={{height:8}} />
          <button className="btn btn-block btn-ghost" onClick={signOut}>{tr(lang, 'logout')}</button>
        </div>
      </aside>
      <section className="admin-sec" style={{minHeight:'90svh'}}>
        <div className="wrap">
          <div className="admin-layout">
            <aside className="admin-side">
              {GROUPS.map((g, gi) => (
                <div key={gi}>
                  {gi > 0 && <div className="grp-div" />}
                  {g.titleKey && <div className="grp-title">{tr(lang, g.titleKey)}</div>}
                  {g.items.map(it => (
                    <button key={it.id} className={`admin-item ${sec === it.id ? 'active' : ''}`} onClick={() => goSec(it.id)}>
                      <span className="admin-item-icon">{it.icon}</span>
                      <span>{stripEmoji(tr(lang, it.key))}</span>
                    </button>
                  ))}
                </div>
              ))}
            </aside>
            <div className="admin-main">
              {sec !== 'dashboard' && <h3 className="sec-title admin-sec-title">{stripEmoji(tr(lang, SEC_TITLES[sec]))}</h3>}
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
  const [search, setSearch] = useState('')
  const [payMethod, setPayMethod] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(null)
  const [detail, setDetail] = useState(null)
  const PAGE_SIZE = 8

  const load = async () => {
    const { data } = await supabase.from('cashskillbd_orders').select('*').order('created_at', { ascending: false }).limit(200)
    setOrders(data || [])
  }
  useEffect(() => { load() }, [])

  const act = async (id, action, extra = {}) => {
    setBusy(id)
    try {
      if (action === 'reject_order') {
        const reason = prompt('রিজেক্ট করার কারণ লিখুন (optional):') || ''
        extra = { reason }
      }
      await adminApi(session, action, { order_id: id, ...extra })
      await load()
      setDetail(null)
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  // ── Stats ──
  const total = orders.length
  const pending = orders.filter(o => o.status === 'pending').length
  const confirmed = orders.filter(o => o.status === 'confirmed').length
  const revenue = orders.filter(o => o.status === 'confirmed').reduce((s, o) => s + Number(o.price || 0), 0)

  // ── Filtered list ──
  let list = orders.filter(o => filter === 'all' || o.status === filter)
  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter(o =>
      String(o.id).includes(q) || String(o.name || '').toLowerCase().includes(q) ||
      String(o.mobile || '').includes(q) || String(o.trx_id || '').toLowerCase().includes(q) ||
      String(o.item_name || '').toLowerCase().includes(q)
    )
  }
  if (payMethod !== 'all') list = list.filter(o => o.pay_method === payMethod)
  if (statusF !== 'all') list = list.filter(o => o.status === statusF)
  if (dateRange !== 'all') {
    const now = new Date()
    const days = dateRange === 'today' ? 1 : dateRange === 'week' ? 7 : 30
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    list = list.filter(o => new Date(o.created_at) >= cutoff)
  }

  const clearFilters = () => { setSearch(''); setPayMethod('all'); setStatusF('all'); setDateRange('all'); setPage(1) }

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const curPage = Math.min(page, totalPages)
  const pageItems = list.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE)
  const startIdx = list.length === 0 ? 0 : (curPage - 1) * PAGE_SIZE + 1
  const endIdx = Math.min(curPage * PAGE_SIZE, list.length)

  const payMethods = [...new Set(orders.map(o => o.pay_method).filter(Boolean))]

  const initials = (name) => {
    if (!name) return '?'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  const avatarColors = ['#e8232a', '#4da3ff', '#2ecc71', '#f5b942', '#e84393', '#8e44ad', '#00cec9']
  const avatarColor = (name) => {
    let h = 0
    for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) % 997
    return avatarColors[h % avatarColors.length]
  }

  const statusBadge = (s) => {
    const styles = {
      pending: { bg: 'rgba(245,185,66,.15)', color: '#f5b942', border: '1px solid rgba(245,185,66,.4)', label: 'Pending' },
      confirmed: { bg: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)', label: 'Confirmed' },
      rejected: { bg: 'rgba(232,35,42,.15)', color: '#ff6b6b', border: '1px solid rgba(232,35,42,.4)', label: 'Rejected' },
      cancelled: { bg: 'rgba(232,35,42,.15)', color: '#ff6b6b', border: '1px solid rgba(232,35,42,.4)', label: 'Cancelled' },
    }
    const st = styles[s] || styles.pending
    return <span style={{ padding: '4px 12px', borderRadius: 7, fontSize: '.78rem', fontWeight: 600, background: st.bg, color: st.color, border: st.border, whiteSpace: 'nowrap' }}>{st.label}</span>
  }

  const cardStyle = (border) => ({
    flex: 1, minWidth: 200, background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))',
    border: `1px solid ${border}`, borderRadius: 14, padding: 20,
    display: 'flex', alignItems: 'flex-start', gap: 14, position: 'relative',
  })

  const selStyle = {
    padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 8, color: '#fff', fontSize: '.85rem', outline: 'none', cursor: 'pointer', minWidth: 150,
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><IOrders size={24} /></div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Orders</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>Manage customer orders, verify payments and track order status.</p>
          </div>
        </div>
        <button onClick={load} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>
          Refresh Orders
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={cardStyle('rgba(232,35,42,.4)')}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><IOrders size={26} /></div>
          <div>
            <div style={{ fontSize: '.85rem', color: 'var(--muted)' }}>Total Orders</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{total}</div>
            <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>All time orders</div>
          </div>
          <span style={{ position: 'absolute', top: 16, right: 16, color: '#e8232a', fontSize: 18 }}>→</span>
        </div>
        <div style={cardStyle('rgba(245,185,66,.4)')}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245,185,66,.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><IClock size={26} /></div>
          <div>
            <div style={{ fontSize: '.85rem', color: 'var(--muted)' }}>Pending Orders</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{pending}</div>
            <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Awaiting verification</div>
          </div>
          <span style={{ position: 'absolute', top: 16, right: 16, color: '#f5b942', fontSize: 18 }}>→</span>
        </div>
        <div style={cardStyle('rgba(46,204,113,.4)')}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(46,204,113,.15)', display: 'grid', placeItems: 'center', flexShrink: 0, color: '#2ecc71' }}>✓</div>
          <div>
            <div style={{ fontSize: '.85rem', color: 'var(--muted)' }}>Confirmed Orders</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{confirmed}</div>
            <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Successfully completed</div>
          </div>
          <span style={{ position: 'absolute', top: 16, right: 16, color: '#2ecc71', fontSize: 18 }}>→</span>
        </div>
        <div style={cardStyle('rgba(0,206,201,.4)')}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(0,206,201,.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><IMoney size={26} /></div>
          <div>
            <div style={{ fontSize: '.85rem', color: 'var(--muted)' }}>Total Revenue</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{fmt(revenue)}</div>
            <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>From confirmed orders</div>
          </div>
          <span style={{ position: 'absolute', top: 16, right: 16, color: '#00cec9', fontSize: 18 }}>→</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          { id: 'pending', label: 'Pending', count: pending },
          { id: 'confirmed', label: 'Confirmed', count: confirmed },
          { id: 'all', label: 'All Orders', count: total },
        ].map(t => (
          <button key={t.id} onClick={() => { setFilter(t.id); setPage(1) }}
            style={{
              padding: '9px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: '.88rem', fontWeight: 600,
              background: filter === t.id ? 'linear-gradient(135deg, #e8232a, #b01020)' : 'rgba(255,255,255,.05)',
              color: '#fff', display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: filter === t.id ? '0 4px 16px rgba(232,35,42,.35)' : 'none',
            }}>
            {t.label}
            <span style={{ background: filter === t.id ? 'rgba(0,0,0,.3)' : 'rgba(255,255,255,.1)', padding: '2px 8px', borderRadius: 10, fontSize: '.78rem' }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
        <input placeholder="Search by Order ID, customer name or transaction ID…"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 240, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.88rem', outline: 'none' }} />
        <select value={payMethod} onChange={e => { setPayMethod(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Payment Methods</option>
          {payMethods.map(m => <option key={m} value={m} style={{ background: '#1a0d0e' }}>{m}</option>)}
        </select>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Statuses</option>
          <option value="pending" style={{ background: '#1a0d0e' }}>Pending</option>
          <option value="confirmed" style={{ background: '#1a0d0e' }}>Confirmed</option>
          <option value="rejected" style={{ background: '#1a0d0e' }}>Rejected</option>
        </select>
        <select value={dateRange} onChange={e => { setDateRange(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>📅 All Time</option>
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
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                {['Order ID', 'Customer', 'Product / Item', 'Amount', 'Payment Method', 'Transaction ID', 'Order Date', 'Payment Status', 'Order Status', 'Action'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '14px 16px', fontSize: '.8rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <td style={{ padding: '14px 16px', fontSize: '.85rem', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>#CSK-{String(o.id).padStart(5, '0')}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(o.name), display: 'grid', placeItems: 'center', color: '#fff', fontSize: '.78rem', fontWeight: 700, flexShrink: 0 }}>{initials(o.name)}</div>
                      <div>
                        <div style={{ fontSize: '.88rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>{o.name}</div>
                        <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{o.mobile}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '.88rem', color: '#fff', whiteSpace: 'nowrap' }}>{o.item_name}</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{o.course_id ? 'Course' : 'Product'}</div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '.88rem', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(o.price)}</td>
                  <td style={{ padding: '14px 16px', fontSize: '.85rem', color: '#fff', whiteSpace: 'nowrap' }}>{o.pay_method}</td>
                  <td style={{ padding: '14px 16px', fontSize: '.82rem', color: 'var(--muted)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{o.trx_id || '—'}</td>
                  <td style={{ padding: '14px 16px', fontSize: '.82rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}<br />
                    <span style={{ fontSize: '.75rem' }}>{new Date(o.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>{statusBadge(o.status)}</td>
                  <td style={{ padding: '14px 16px' }}>{statusBadge(o.status === 'rejected' ? 'cancelled' : o.status)}</td>
                  <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setDetail(o)} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(232,35,42,.5)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontSize: '.8rem', marginRight: 6 }}>View</button>
                    <button onClick={() => setDetail(o)} style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '.8rem' }}>⋮</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ marginBottom: 8 }}><IBox size={48} /></div>
            <div style={{ fontSize: '1rem', color: '#fff' }}>No orders found</div>
            <div style={{ fontSize: '.85rem' }}>Orders will appear here once customers make a purchase.</div>
          </div>
        )}
        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Showing {startIdx} to {endIdx} of {list.length} orders</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button onClick={() => setPage(Math.max(1, curPage - 1))} disabled={curPage <= 1} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: curPage <= 1 ? 'not-allowed' : 'pointer', opacity: curPage <= 1 ? 0.4 : 1 }}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, curPage - 2), curPage + 1).map(p => (
              <button key={p} onClick={() => setPage(p)} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: p === curPage ? '#e8232a' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: p === curPage ? 700 : 400, fontSize: '.85rem' }}>{p}</button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, curPage + 1))} disabled={curPage >= totalPages} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: curPage >= totalPages ? 'not-allowed' : 'pointer', opacity: curPage >= totalPages ? 0.4 : 1 }}>›</button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setDetail(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Order Details</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '.9rem' }}>
              <div><span style={{ color: 'var(--muted)' }}>Order ID: </span><b style={{ color: '#fff' }}>#CSK-{String(detail.id).padStart(5, '0')}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Customer: </span><b style={{ color: '#fff' }}>{detail.name}</b> ({detail.mobile})</div>
              <div><span style={{ color: 'var(--muted)' }}>Item: </span><b style={{ color: '#fff' }}>{detail.item_name}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Amount: </span><b style={{ color: '#fff' }}>{fmt(detail.price)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Payment: </span><b style={{ color: '#fff' }}>{detail.pay_method}</b> — <code>{detail.trx_id}</code></div>
              <div><span style={{ color: 'var(--muted)' }}>Status: </span>{statusBadge(detail.status)}</div>
              <div><span style={{ color: 'var(--muted)' }}>Date: </span>{new Date(detail.created_at).toLocaleString('en-GB')}</div>
              {detail.reject_reason && <div><span style={{ color: 'var(--muted)' }}>Reject Reason: </span><span style={{ color: '#ff7b7b' }}>{detail.reject_reason}</span></div>}
            </div>
            {detail.status === 'pending' && (
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={() => act(detail.id, 'verify_order')} disabled={busy === detail.id} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#2ecc71', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  {busy === detail.id ? 'Processing…' : 'Verify & Approve'}
                </button>
                <button onClick={() => act(detail.id, 'reject_order')} disabled={busy === detail.id} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#e8232a', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Lessons: video URL upload from admin panel ── */
function LessonsTab() {
  const [courses, setCourses] = useState([])
  const [courseId, setCourseId] = useState('')
  const [allLessons, setAllLessons] = useState([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ title: '', description: '', video_url: '', duration_min: '', is_free_preview: false })
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('cashskillbd_courses').select('*').then(({ data }) => {
      setCourses(data || [])
      if (data?.length && !courseId) setCourseId(String(data[0].id))
    })
    loadAll()
  }, [])

  const loadAll = async () => {
    const { data } = await supabase.from('cashskillbd_lessons').select('*, cashskillbd_courses(title)').order('sort_order')
    setAllLessons(data || [])
  }

  const reset = () => { setForm({ title: '', description: '', video_url: '', duration_min: '', is_free_preview: false }); setEditing(null) }

  const save = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return alert('লেসনের টাইটেল দিন')
    if (!form.video_url.trim()) return alert('ভিডিও URL দিন')
    if (!courseId) return alert('কোর্স নির্বাচন করুন')
    const dur = Number(form.duration_min)
    if (form.duration_min !== '' && (isNaN(dur) || dur < 0)) return alert('সঠিক duration দিন')
    setBusy(true)
    const row = {
      course_id: Number(courseId),
      title: form.title.trim(),
      description: form.description.trim(),
      video_url: form.video_url.trim(),
      duration_min: dur || 0,
      is_free_preview: form.is_free_preview,
      sort_order: editing ? editing.sort_order : allLessons.filter(l => String(l.course_id) === String(courseId)).length,
    }
    const { error } = editing
      ? await supabase.from('cashskillbd_lessons').update(row).eq('id', editing.id)
      : await supabase.from('cashskillbd_lessons').insert(row)
    if (error) alert('❌ ' + error.message)
    else { reset(); loadAll() }
    setBusy(false)
  }

  const del = async (l) => {
    if (!confirm(`"${l.title}" লেসনটি ডিলিট করবেন?\n\nএটি মেম্বারদের অ্যাক্সেস ও কোর্স প্রোগ্রেসে প্রভাব ফেলতে পারে।`)) return
    const { error } = await supabase.from('cashskillbd_lessons').delete().eq('id', l.id)
    if (error) alert('❌ ' + error.message)
    else loadAll()
  }

  const edit = (l) => {
    setEditing(l)
    setCourseId(String(l.course_id))
    setForm({ title: l.title, description: l.description || '', video_url: l.video_url || '', duration_min: l.duration_min || '', is_free_preview: l.is_free_preview })
    window.scrollTo(0, 0)
  }

  // Filter by selected course + search
  const lessons = allLessons.filter(l => {
    if (courseId && String(l.course_id) !== String(courseId)) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return l.title.toLowerCase().includes(q) || (l.cashskillbd_courses?.title || '').toLowerCase().includes(q)
    }
    return true
  })

  const courseOf = (cid) => courses.find(c => String(c.id) === String(cid))

  const inp = {
    width: '100%', height: 42, padding: '0 12px', background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, color: '#fff',
    fontSize: '.9rem', outline: 'none', boxSizing: 'border-box',
  }
  const lbl = { display: 'block', fontSize: '.85rem', color: 'var(--silver)', marginBottom: 6, fontWeight: 500 }
  const card = {
    background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))',
    border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, padding: 22,
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><ILessons size={24} /></div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Lessons</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>Create, organize, and manage your course lessons.</p>
          </div>
        </div>
        <div style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.03)', fontSize: '.85rem', color: 'var(--silver)', display: 'flex', alignItems: 'center', gap: 8 }}>
          Total Lessons <b style={{ color: '#fff' }}>{allLessons.length}</b>
        </div>
      </div>

      {/* Add New Lesson Form */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 18, color: '#ff6b6b' }}>+</div>
          <div>
            <div style={{ fontWeight: 700, color: '#fff', fontSize: '1.02rem' }}>{editing ? 'লেসন এডিট' : 'নতুন লেসন'}</div>
            <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>কোর্সের জন্য নতুন লেসন তৈরি করুন।</div>
          </div>
        </div>
        <form onSubmit={save}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={lbl}>কোর্স</label>
                <select value={courseId} onChange={e => setCourseId(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="" style={{ background: '#1a0d0e' }}>সঠিক কোর্স নির্বাচন করুন</option>
                  {courses.map(c => <option key={c.id} value={c.id} style={{ background: '#1a0d0e' }}>{c.title}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>ভিডিও URL * <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(YouTube / Facebook / Vimeo / mp4 লিংক পেস্ট করুন)</span></label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 16 }}>🔗</span>
                  <input style={{ ...inp, paddingLeft: 36 }} value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
                </div>
              </div>
              <div>
                <label style={lbl}>মিনিট:</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 16 }}>⏱</span>
                  <input style={{ ...inp, paddingLeft: 36 }} type="number" min="0" value={form.duration_min} onChange={e => setForm({ ...form, duration_min: e.target.value })} placeholder="যেমন: ৩০" />
                </div>
              </div>
              <div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: '.9rem', color: '#fff' }}>
                  <input type="checkbox" checked={form.is_free_preview} onChange={e => setForm({ ...form, is_free_preview: e.target.checked })} style={{ width: 18, height: 18, accentColor: '#e8232a', cursor: 'pointer' }} />
                  <span style={{ padding: '2px 8px', borderRadius: 5, background: '#3b82f6', color: '#fff', fontSize: '.7rem', fontWeight: 700 }}>FREE</span>
                  ফ্রি লেসন (সবার জন্য উন্মুক্ত)
                </label>
              </div>
            </div>
            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={lbl}>টাইটেল *</label>
                <input style={inp} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="যেমন: VPS সেটআপ — পার্ট ১" />
              </div>
              <div>
                <label style={lbl}>বর্ণনা</label>
                <textarea style={{ ...inp, height: 110, paddingTop: 10, resize: 'vertical', fontFamily: 'inherit' }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="লেসনে যা যা শেখানো হবে" />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="submit" disabled={busy} style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, fontSize: '.92rem', cursor: busy ? 'not-allowed' : 'pointer', boxShadow: '0 4px 16px rgba(232,35,42,.35)', opacity: busy ? 0.6 : 1 }}>
              + {busy ? 'সেভ হচ্ছে…' : editing ? 'আপডেট করুন' : 'লেসন যোগ করুন'}
            </button>
            {editing && <button type="button" onClick={reset} style={{ padding: '11px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>বাতিল</button>}
          </div>
        </form>
      </div>

      {/* Lessons Table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center' }}><IOrders size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>লেসন তালিকা</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>সকল লেসন এখানে দেখানো হচ্ছে।</div>
            </div>
          </div>
          <input placeholder="লেসন বা কোর্সের নাম দিয়ে খুঁজুন…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: '9px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, color: '#fff', fontSize: '.85rem', outline: 'none', minWidth: 240 }} />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.02)' }}>
                {['#', 'লেসন টাইটেল', 'কোর্স', 'ভিডিও', 'মিনিট', 'অ্যাক্সেস', 'অ্যাকশন'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '13px 18px', fontSize: '.8rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lessons.map((l, i) => (
                <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <td style={{ padding: '13px 18px', color: 'var(--muted)', fontSize: '.88rem' }}>{i + 1}</td>
                  <td style={{ padding: '13px 18px', fontWeight: 600, color: '#fff', fontSize: '.92rem' }}>{l.title}</td>
                  <td style={{ padding: '13px 18px', color: 'var(--silver)', fontSize: '.88rem' }}>{l.cashskillbd_courses?.title || courseOf(l.course_id)?.title || '—'}</td>
                  <td style={{ padding: '13px 18px' }}>
                    {l.video_url ? (
                      <a href={l.video_url} target="_blank" rel="noreferrer" style={{ display: 'inline-grid', placeItems: 'center', width: 30, height: 30, borderRadius: 7, background: 'rgba(232,35,42,.15)', color: '#ff6b6b', textDecoration: 'none', fontSize: 13 }}>▶</a>
                    ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '13px 18px', color: 'var(--silver)', fontSize: '.88rem' }}>{l.duration_min || 0}</td>
                  <td style={{ padding: '13px 18px' }}>
                    {l.is_free_preview ? (
                      <span style={{ padding: '4px 12px', borderRadius: 7, fontSize: '.78rem', fontWeight: 600, background: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)' }}>ফ্রি</span>
                    ) : (
                      <span style={{ padding: '4px 12px', borderRadius: 7, fontSize: '.78rem', fontWeight: 600, background: 'rgba(232,35,42,.15)', color: '#ff6b6b', border: '1px solid rgba(232,35,42,.4)' }}>পেইড</span>
                    )}
                  </td>
                  <td style={{ padding: '13px 18px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => edit(l)} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(255,184,77,.4)', background: 'rgba(255,184,77,.1)', color: '#f5b942', cursor: 'pointer', fontSize: '.8rem', marginRight: 6 }}><span style={{ fontSize: 14 }}>✎</span></button>
                    <button onClick={() => del(l)} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer', fontSize: '.8rem' }}><span style={{ fontSize: 14 }}>🗑</span></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lessons.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>কোনো লেসন নেই</div>
            <div style={{ fontSize: '.85rem' }}>এই কোর্সে এখনো লেসন যোগ করা হয়নি।</div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Members list ── */
function MembersTab({ session }) {
  const [members, setMembers] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activityF, setActivityF] = useState('all')
  const [purchaseF, setPurchaseF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [countryF, setCountryF] = useState('all')
  const [dateF, setDateF] = useState('all')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState(null)
  const [editM, setEditM] = useState(null)
  const [editForm, setEditForm] = useState({ full_name: '', phone: '' })
  const [busy, setBusy] = useState(null)
  const PAGE_SIZE = 10

  const load = async () => {
    setLoading(true)
    const [{ data: profs }, { data: ords }] = await Promise.all([
      supabase.from('cashskillbd_profiles').select('*').eq('role', 'member').order('created_at', { ascending: false }).limit(500),
      supabase.from('cashskillbd_orders').select('*').eq('status', 'confirmed').order('created_at', { ascending: false }).limit(1000),
    ])
    setMembers(profs || [])
    setOrders(ords || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Classify members by purchases ──
  const ordersOf = (m) => orders.filter(o => {
    const mobile = String(m.phone || '').replace(/\D/g, '').slice(-10)
    const oMobile = String(o.mobile || '').replace(/\D/g, '').slice(-10)
    return (mobile && oMobile && mobile === oMobile) || (m.full_name && o.name && m.full_name.trim().toLowerCase() === o.name.trim().toLowerCase())
  })
  const classify = (m) => {
    const o = ordersOf(m)
    const hasCourse = o.some(x => x.course_id)
    const hasService = o.some(x => !x.course_id)
    if (hasCourse && hasService) return 'both'
    if (hasCourse) return 'course'
    if (hasService) return 'service'
    return 'registered'
  }
  const totalSpent = (m) => ordersOf(m).reduce((s, o) => s + Number(o.price || 0), 0)
  const courseCount = (m) => ordersOf(m).filter(o => o.course_id).length
  const serviceCount = (m) => ordersOf(m).filter(o => !o.course_id).length

  const enriched = members.map(m => ({ ...m, _class: classify(m), _spent: totalSpent(m), _courses: courseCount(m), _services: serviceCount(m), _orders: ordersOf(m).length }))

  // ── Stats (exclude admins — query already filters role='member') ──
  const total = enriched.length
  const courseCustomers = enriched.filter(m => m._class === 'course' || m._class === 'both').length
  const serviceCustomers = enriched.filter(m => m._class === 'service' || m._class === 'both').length
  const registeredOnly = enriched.filter(m => m._class === 'registered').length

  // ── Filters ──
  let list = enriched
  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter(m => (m.member_id || '').toLowerCase().includes(q) || (m.full_name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q) || (m.phone || '').includes(q))
  }
  if (activityF !== 'all') list = list.filter(m => m._class === activityF)
  if (purchaseF !== 'all') {
    if (purchaseF === 'course') list = list.filter(m => m._courses > 0)
    else if (purchaseF === 'service') list = list.filter(m => m._services > 0)
    else if (purchaseF === 'none') list = list.filter(m => m._orders === 0)
  }
  if (statusF !== 'all') list = list.filter(m => (m.is_active === false ? 'suspended' : 'active') === statusF || (statusF === 'active' && m.is_active !== false))
  if (dateF !== 'all') {
    const days = dateF === 'today' ? 1 : dateF === 'week' ? 7 : 30
    const cutoff = new Date(Date.now() - days * 864e5)
    list = list.filter(m => new Date(m.created_at) >= cutoff)
  }

  const clearFilters = () => { setSearch(''); setActivityF('all'); setPurchaseF('all'); setStatusF('all'); setCountryF('all'); setDateF('all'); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const curPage = Math.min(page, totalPages)
  const pageItems = list.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE)

  const activityBadge = (cls) => {
    const map = {
      both: { bg: 'rgba(192,132,252,.12)', color: '#c084fc', border: 'rgba(192,132,252,.4)', label: 'Course & Service' },
      course: { bg: 'rgba(77,163,255,.12)', color: '#4da3ff', border: 'rgba(77,163,255,.4)', label: 'Course Customer' },
      service: { bg: 'rgba(46,204,113,.12)', color: '#2ecc71', border: 'rgba(46,204,113,.4)', label: 'Service Customer' },
      registered: { bg: 'rgba(245,185,66,.12)', color: '#f5b942', border: 'rgba(245,185,66,.4)', label: 'Registered Only' },
    }
    const s = map[cls] || map.registered
    return <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>{s.label}</span>
  }

  const del = async (m) => {
    if (!confirm(`"${m.full_name || m.email}" মেম্বারকে delete করবেন?\n\nএই action undo করা যাবে না।`)) return
    setBusy(m.id)
    const { error } = await supabase.from('cashskillbd_profiles').delete().eq('id', m.id)
    if (error) alert('❌ ' + error.message)
    else load()
    setBusy(null)
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    setBusy(editM.id)
    const { error } = await supabase.from('cashskillbd_profiles').update({ full_name: editForm.full_name.trim(), phone: editForm.phone.trim() }).eq('id', editM.id)
    if (error) alert('❌ ' + error.message)
    else { setEditM(null); load() }
    setBusy(null)
  }

  const selStyle = {
    padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 8, color: '#fff', fontSize: '.82rem', outline: 'none', cursor: 'pointer',
  }
  const actionBtn = (bg, border, color) => ({
    padding: '6px 8px', borderRadius: 7, border: `1px solid ${border}`, background: bg, color, cursor: 'pointer', fontSize: 13, marginRight: 4,
  })

  const stats = [
    { label: 'Total Members', value: total.toLocaleString(), desc: 'All registered members', color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '👥' },
    { label: 'Course Customers', value: courseCustomers.toLocaleString(), desc: 'Purchased at least one course', color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '🎓' },
    { label: 'Service Customers', value: serviceCustomers.toLocaleString(), desc: 'Purchased at least one service', color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '🛍' },
    { label: 'Registered Only', value: registeredOnly.toLocaleString(), desc: 'No purchases yet', color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '👤' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>👥</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Members</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>Manage your platform members. View their details, purchase history and activity.</p>
          </div>
        </div>
        <button onClick={() => alert('Members register via the public site. Use Team page to promote to admin.')} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>
          + Add Member
        </button>
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
        <input placeholder="Search by member ID, name, email or phone…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 220, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
        <select value={activityF} onChange={e => { setActivityF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Members</option>
          <option value="course" style={{ background: '#1a0d0e' }}>Course Customer</option>
          <option value="service" style={{ background: '#1a0d0e' }}>Service Customer</option>
          <option value="both" style={{ background: '#1a0d0e' }}>Course & Service</option>
          <option value="registered" style={{ background: '#1a0d0e' }}>Registered Only</option>
        </select>
        <select value={purchaseF} onChange={e => { setPurchaseF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Purchases</option>
          <option value="course" style={{ background: '#1a0d0e' }}>Has Course</option>
          <option value="service" style={{ background: '#1a0d0e' }}>Has Service</option>
          <option value="none" style={{ background: '#1a0d0e' }}>No Purchases</option>
        </select>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Statuses</option>
          <option value="active" style={{ background: '#1a0d0e' }}>Active</option>
          <option value="suspended" style={{ background: '#1a0d0e' }}>Suspended</option>
        </select>
        <select value={countryF} onChange={e => setCountryF(e.target.value)} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>All Countries</option>
          <option value="bd" style={{ background: '#1a0d0e' }}>Bangladesh</option>
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
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                {['#', 'Profile', 'Member ID', 'Name', 'Email', 'Phone', 'Membership Activity', 'Courses', 'Services', 'Total Orders', 'Total Spent', 'Status', 'Joined Date', 'Last Login', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((m, i) => (
                <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '.85rem' }}>{(curPage - 1) * PAGE_SIZE + i + 1}</td>
                  <td style={{ padding: '12px 14px' }}>
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(232,35,42,.2)', display: 'grid', placeItems: 'center', color: '#ff6b6b', fontSize: '.8rem', fontWeight: 700 }}>
                        {(m.full_name || '?').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '.82rem', color: '#fff', fontWeight: 600, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{m.member_id || '—'}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: '#fff', fontSize: '.88rem', whiteSpace: 'nowrap' }}>{m.full_name || '—'}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--silver)', fontSize: '.82rem' }}>{m.email}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--silver)', fontSize: '.82rem', whiteSpace: 'nowrap' }}>{m.phone || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>{activityBadge(m._class)}</td>
                  <td style={{ padding: '12px 14px', color: '#fff', fontSize: '.88rem', textAlign: 'center' }}>{m._courses}</td>
                  <td style={{ padding: '12px 14px', color: '#fff', fontSize: '.88rem', textAlign: 'center' }}>{m._services}</td>
                  <td style={{ padding: '12px 14px', color: '#fff', fontSize: '.88rem', textAlign: 'center' }}>{m._orders}</td>
                  <td style={{ padding: '12px 14px', color: '#fff', fontSize: '.88rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(m._spent)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    {m.is_active === false ? (
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: 'rgba(232,35,42,.15)', color: '#ff6b6b', border: '1px solid rgba(232,35,42,.4)' }}>● Suspended</span>
                    ) : (
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)' }}>● Active</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {new Date(m.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}<br />
                    <span style={{ fontSize: '.72rem' }}>{new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {m.last_login ? new Date(m.last_login).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                    <button title="View" onClick={() => setDetail(m)} style={actionBtn('transparent', 'rgba(255,255,255,.15)', '#fff')}>👁</button>
                    <button title="Orders" onClick={() => setDetail(m)} style={actionBtn('rgba(77,163,255,.1)', 'rgba(77,163,255,.4)', '#4da3ff')}>🧾</button>
                    <button title="Edit" onClick={() => { setEditM(m); setEditForm({ full_name: m.full_name || '', phone: m.phone || '' }) }} style={actionBtn('rgba(245,185,66,.1)', 'rgba(245,185,66,.4)', '#f5b942')}>✏️</button>
                    <button title="Delete" onClick={() => del(m)} disabled={busy === m.id} style={actionBtn('rgba(232,35,42,.1)', 'rgba(232,35,42,.4)', '#ff6b6b')}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>No members found</div>
            <div style={{ fontSize: '.85rem' }}>No members match your filters.</div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Showing {list.length === 0 ? 0 : (curPage - 1) * PAGE_SIZE + 1} to {Math.min(curPage * PAGE_SIZE, list.length)} of {list.length.toLocaleString()} members</span>
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
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Member Details</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              {detail.avatar_url ? <img src={detail.avatar_url} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(232,35,42,.2)', display: 'grid', placeItems: 'center', color: '#ff6b6b', fontSize: '1rem', fontWeight: 700 }}>{(detail.full_name || '?').slice(0, 2).toUpperCase()}</div>}
              <div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '1.05rem' }}>{detail.full_name || '—'}</div>
                <div style={{ color: 'var(--muted)', fontSize: '.82rem', fontFamily: 'monospace' }}>{detail.member_id || '—'}</div>
              </div>
              {activityBadge(detail._class)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '.9rem' }}>
              <div><span style={{ color: 'var(--muted)' }}>Email: </span><b style={{ color: '#fff' }}>{detail.email}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Phone: </span><b style={{ color: '#fff' }}>{detail.phone || '—'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Joined: </span>{new Date(detail.created_at).toLocaleString('en-GB')}</div>
              <div><span style={{ color: 'var(--muted)' }}>Courses: </span><b style={{ color: '#fff' }}>{detail._courses}</b> &nbsp; <span style={{ color: 'var(--muted)' }}>Services: </span><b style={{ color: '#fff' }}>{detail._services}</b> &nbsp; <span style={{ color: 'var(--muted)' }}>Orders: </span><b style={{ color: '#fff' }}>{detail._orders}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>Total Spent: </span><b style={{ color: '#fff' }}>{fmt(detail._spent)}</b></div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, color: '#fff', marginBottom: 8 }}>Purchase History</div>
              {ordersOf(detail).length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '.85rem', margin: 0 }}>No purchases yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ordersOf(detail).map(o => (
                    <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255,255,255,.03)', borderRadius: 8, fontSize: '.85rem' }}>
                      <span style={{ color: '#fff' }}>{o.item_name} {o.course_id ? '(Course)' : '(Service)'}</span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{fmt(o.price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editM && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setEditM(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Edit Member</h3>
              <button onClick={() => setEditM(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '.85rem', color: 'var(--silver)', marginBottom: 5 }}>Full Name</label>
                <input value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} style={{ width: '100%', height: 42, padding: '0 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, color: '#fff', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '.85rem', color: 'var(--silver)', marginBottom: 5 }}>Phone</label>
                <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} style={{ width: '100%', height: 42, padding: '0 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, color: '#fff', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <button type="submit" disabled={busy === editM.id} style={{ padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {busy === editM.id ? 'Saving…' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

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
                <td><button className="mini-btn no" onClick={() => del(r.id)}><span style={{ fontSize: 14 }}>🗑</span></button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {reviews.length === 0 && <p style={{padding:20, color:'var(--muted)'}}>কোনো রিভিউ নেই।</p>}
      </div>
    </div>
  )
}
