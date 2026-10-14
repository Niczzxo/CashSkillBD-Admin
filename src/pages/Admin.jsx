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
import { IDash, IGear, IOrders, ILessons, IMembers, IReviews, ISeminar, IProducts, IVps, IPayments, IBox, IClock, IChart, IMoney } from '../components/icons.jsx'
import { GlobalSearch } from '../components/GlobalSearch.jsx'
import { Notifications } from '../components/Notifications.jsx'
import { ProfileMenu } from '../components/ProfileMenu.jsx'

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
import { AdminManagement, RolesPermissions } from './inventory/AdminManagement.jsx'
import { ActivityLogs } from './inventory/ActivityLogs.jsx'
import { CourseEnrollments } from './inventory/CourseEnrollments.jsx'
import { DocumentVerification } from './inventory/DocumentVerification.jsx'
import { CourseCustomers } from './inventory/CourseCustomers.jsx'
import { ServiceCustomers } from './inventory/ServiceCustomers.jsx'
import { IpServices } from './inventory/IpServices.jsx'
import { VpsManagement } from './inventory/VpsManagement.jsx'
import { NumbersManagement } from './inventory/NumbersManagement.jsx'
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
  { items: [{ id: 'dashboard', key: 'dashboard', icon: <IDash /> }] },
  { items: [{ id: 'lessons', key: 'lessons', icon: <ILessons /> }] },
  { items: [{ id: 'course-enrollments', key: 'course_enrollments', icon: <ILessons /> }] },
  { items: [{ id: 'document-verification', key: 'document_verification', icon: <ILessons /> }] },
  {
    titleKey: 'grp_products_services', collapsible: true,
    items: [
      { id: 'products', key: 'products', icon: <IProducts /> },
      { id: 'vps-plans', key: 'vps_plans', icon: <IVps /> },
      { id: 'vps', key: 'services_vps', icon: <IVps /> },
      { id: 'ip', key: 'services_ip', icon: <IProducts /> },
      { id: 'number', key: 'services_number', icon: <IProducts /> },
      { id: 'inventory', key: 'inventory', icon: <IBox /> },
      { id: 'suppliers', key: 'suppliers', icon: <IMembers /> },
    ],
  },
  {
    titleKey: 'grp_orders_customers', collapsible: true,
    items: [
      { id: 'orders', key: 'orders', icon: <IOrders /> },
      { id: 'sales-orders', key: 'sales_orders', icon: <IOrders /> },
      { id: 'members', key: 'members', icon: <IMembers /> },
      { id: 'course-customers', key: 'course_customers', icon: <ILessons /> },
      { id: 'service-customers', key: 'service_customers', icon: <IProducts /> },
    ],
  },
  {
    titleKey: 'grp_finance_reports', collapsible: true,
    items: [
      { id: 'dollar', key: 'dollar', icon: <IPayments /> },
      { id: 'reports', key: 'reports', icon: <IChart /> },
      { id: 'price-history', key: 'price_history', icon: <IClock /> },
    ],
  },
  {
    titleKey: 'grp_support', collapsible: true,
    items: [
      { id: 'reviews', key: 'reviews', icon: <IReviews /> },
      { id: 'seminar-regs', key: 'seminar_regs', icon: <ISeminar /> },
    ],
  },
  {
    titleKey: 'grp_settings_admin', collapsible: true,
    items: [
      { id: 'site-settings', key: 'site_settings', icon: <IGear /> },
      { id: 'admins', key: 'admins', icon: <IMembers /> },
      { id: 'roles', key: 'roles_permissions', icon: <IGear /> },
      { id: 'activity-logs', key: 'activity_logs', icon: <IOrders /> },
      { id: 'audit-logs', key: 'audit_logs', icon: <IOrders /> },
    ],
  },
]

const SEC_TITLES = {
  dashboard: 'dashboard', 'site-settings': 'site_settings', orders: 'orders', lessons: 'lessons', members: 'members', admins: 'admins', roles: 'roles_permissions', 'activity-logs': 'activity_logs', 'course-customers': 'course_customers', 'service-customers': 'service_customers',
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
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchFocusKey, setSearchFocusKey] = useState(0)
  const [sideCollapsed, setSideCollapsed] = useState(false)
  const [mobileSearch, setMobileSearch] = useState(false)
  const [openGroups, setOpenGroups] = useState({})

  // Ctrl+K / Cmd+K opens global search; Escape closes it (handled in GlobalSearch)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        setSearchFocusKey(k => k + 1)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Keep the group containing the active section expanded
  useEffect(() => {
    const gi = GROUPS.findIndex(g => g.items.some(it => it.id === sec))
    if (gi >= 0 && GROUPS[gi].collapsible) setOpenGroups(prev => ({ ...prev, [gi]: true }))
  }, [sec])

  useEffect(() => {
    if (!session) { navigate('/login'); return }
  }, [session])

  if (!session) return null
  if (!isStaff) {
    return (
      <div className="wrap" style={{padding:'140px 0', textAlign:'center'}}>
        <h2 className="sec-title">{tr(lang, 'adm_access_denied')}</h2>
        <p style={{color:'var(--muted)'}}>{tr(lang, 'adm_access_denied_sub')}</p>
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
      case 'course-enrollments': return <CourseEnrollments session={session} />
      case 'document-verification': return <DocumentVerification session={session} />
      case 'service-customers': return <ServiceCustomers />
      case 'ip': return <IpServices session={session} />
      case 'vps': return <VpsManagement session={session} />
      case 'number': return <NumbersManagement session={session} />
      case 'dollar': return <Dollar session={session} role={role} />
      case 'sales-orders': return <SalesOrders session={session} role={role} />
      case 'inventory': return <Inventory session={session} />
      case 'suppliers': return <Suppliers session={session} role={role} />
      case 'reports': return <Reports session={session} role={role} />
      case 'price-history': return <PriceHistory session={session} />
      case 'audit-logs': return <AuditLogs session={session} role={role} />
      case 'admins': return <AdminManagement session={session} role={role} />
      case 'roles': return <RolesPermissions session={session} />
      case 'activity-logs': return <ActivityLogs session={session} role={role} />
      default: return null
    }
  }

  return (
    <>
      <nav className="admin-nav">
        <div className="wrap admin-nav-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button className={`hamburger ${menuOpen ? 'open' : ''}`} onClick={() => {
              if (window.innerWidth < 920) setMenuOpen(!menuOpen)
              else setSideCollapsed(c => !c)
            }} aria-label={tr(lang, 'menu')} style={{ display: 'inline-flex' }}>
              <span /><span /><span />
            </button>
            <button onClick={() => goSec('dashboard')} aria-label="CashSkillBD Admin" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0, minWidth: 0 }}>
              <img src={ADMIN_LOGO} alt="CashSkillBD Admin" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 10, flexShrink: 0 }} onError={(e) => { e.target.style.display = 'none' }} />
              <span style={{ textAlign: 'left', minWidth: 0 }} className="hide-m">
                <span className="admin-brand-name" style={{ display: 'block', whiteSpace: 'nowrap' }}>CashSkillBD <span>Admin</span></span>
                <span className="admin-brand-tag" style={{ display: 'block' }}>MANAGEMENT PANEL</span>
              </span>
            </button>
          </div>
          <div className="admin-search-desktop" style={{ flex: 1, maxWidth: 560, margin: '0 8px' }}>
            <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} goSec={goSec} autoFocusKey={searchFocusKey} />
          </div>
          <div className="admin-nav-right">
            <span className="role-badge hide-m" style={{ background: 'linear-gradient(135deg,#FF303A,#A80F20)', color: '#fff', borderColor: 'transparent' }}>{role === 'admin' ? tr(lang, 'nav_admin_badge') : (role || '').toUpperCase()}</span>
            <span className="hide-m"><LanguageSelector /></span>
            <button className="admin-search-mob-btn" onClick={() => setMobileSearch(true)} aria-label={tr(lang, 'nav_search_ph')} style={{ width: 42, height: 42, borderRadius: 11, border: '1px solid rgba(58,23,27,.9)', background: 'rgba(255,255,255,.04)', color: '#fff', cursor: 'pointer', placeItems: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            </button>
            <Notifications session={session} goSec={goSec} />
            <ProfileMenu session={session} role={role} goSec={goSec} signOut={signOut} />
          </div>
        </div>
      </nav>
      {mobileSearch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 150, padding: 12 }} onClick={() => setMobileSearch(false)}>
          <div style={{ background: '#100708', border: '1px solid #3A171B', borderRadius: 14, padding: 12 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}><GlobalSearch open={true} onOpenChange={(o) => { if (!o) setMobileSearch(false) }} goSec={(id) => { setMobileSearch(false); goSec(id) }} autoFocusKey={searchFocusKey} /></div>
              <button onClick={() => setMobileSearch(false)} aria-label={tr(lang, 'nav_close')} style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid rgba(58,23,27,.9)', background: 'rgba(255,255,255,.04)', color: '#fff', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
          </div>
        </div>
      )}
      <div className={`mnav-overlay ${menuOpen ? 'show' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`mnav ${menuOpen ? 'show' : ''}`}>
        <div className="mnav-head">
          <img src={ADMIN_LOGO} alt="CashSkillBD Admin" style={{height:40, objectFit:'contain'}} onError={(e)=>{e.target.style.display='none'}} />
          <button className="mnav-x" onClick={() => setMenuOpen(false)}>×</button>
        </div>
        <div className="mnav-links">
          {GROUPS.map((g, gi) => (
            <div key={gi}>
              {g.collapsible && (
                <button onClick={() => setOpenGroups(prev => ({ ...prev, [gi]: !prev[gi] }))} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'none', border: 'none', color: 'var(--muted)', fontSize: '.72rem', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer' }}>
                  {tr(lang, g.titleKey)}
                  <span style={{ fontSize: '.8rem', transform: openGroups[gi] ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
                </button>
              )}
              {(g.collapsible ? !!openGroups[gi] : true) && g.items.map(it => (
                <a key={it.id} onClick={() => goSec(it.id)} className={sec === it.id ? 'active' : ''}>
                  <span>{tr(lang, it.key)}</span>
                  <span className="mnav-arrow">→</span>
                </a>
              ))}
            </div>
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
          <div className={`admin-layout ${sideCollapsed ? 'side-collapsed' : ''}`}>
            <aside className="admin-side">
              {GROUPS.map((g, gi) => (
                <div key={gi}>
                  {g.collapsible ? (
                    <>
                      <button onClick={() => setOpenGroups(prev => ({ ...prev, [gi]: !prev[gi] }))} className="grp-head" aria-expanded={!!openGroups[gi]}>
                        <span>{tr(lang, g.titleKey)}</span>
                        <span className="grp-chev" style={{ transform: openGroups[gi] ? 'rotate(90deg)' : 'none' }}>›</span>
                      </button>
                      {openGroups[gi] && g.items.map(it => (
                        <button key={it.id} className={`admin-item ${sec === it.id ? 'active' : ''}`} onClick={() => goSec(it.id)}>
                          <span className="admin-item-icon">{it.icon}</span>
                          <span>{stripEmoji(tr(lang, it.key))}</span>
                        </button>
                      ))}
                    </>
                  ) : (
                    g.items.map(it => (
                      <button key={it.id} className={`admin-item ${sec === it.id ? 'active' : ''}`} onClick={() => goSec(it.id)}>
                        <span className="admin-item-icon">{it.icon}</span>
                        <span>{stripEmoji(tr(lang, it.key))}</span>
                      </button>
                    ))
                  )}
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
  const { lang } = useLang()
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
        const reason = prompt(tr(lang, 'adm_orders_reject_reason_prompt')) || ''
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
      pending: { bg: 'rgba(245,185,66,.15)', color: '#f5b942', border: '1px solid rgba(245,185,66,.4)', label: tr(lang, 'adm_orders_status_pending') },
      confirmed: { bg: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)', label: tr(lang, 'adm_orders_status_confirmed') },
      rejected: { bg: 'rgba(232,35,42,.15)', color: '#ff6b6b', border: '1px solid rgba(232,35,42,.4)', label: tr(lang, 'adm_orders_status_rejected') },
      cancelled: { bg: 'rgba(232,35,42,.15)', color: '#ff6b6b', border: '1px solid rgba(232,35,42,.4)', label: tr(lang, 'adm_orders_status_cancelled') },
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
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>{tr(lang, 'adm_orders_title')}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'adm_orders_subtitle')}</p>
          </div>
        </div>
        <button onClick={load} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>
          {tr(lang, 'adm_orders_refresh')}
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={cardStyle('rgba(232,35,42,.4)')}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><IOrders size={26} /></div>
          <div>
            <div style={{ fontSize: '.85rem', color: 'var(--muted)' }}>{tr(lang, 'adm_orders_total')}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{total}</div>
            <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'adm_orders_total_sub')}</div>
          </div>
          <span style={{ position: 'absolute', top: 16, right: 16, color: '#e8232a', fontSize: 18 }}>→</span>
        </div>
        <div style={cardStyle('rgba(245,185,66,.4)')}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245,185,66,.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><IClock size={26} /></div>
          <div>
            <div style={{ fontSize: '.85rem', color: 'var(--muted)' }}>{tr(lang, 'adm_orders_pending')}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{pending}</div>
            <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'adm_orders_pending_sub')}</div>
          </div>
          <span style={{ position: 'absolute', top: 16, right: 16, color: '#f5b942', fontSize: 18 }}>→</span>
        </div>
        <div style={cardStyle('rgba(46,204,113,.4)')}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(46,204,113,.15)', display: 'grid', placeItems: 'center', flexShrink: 0, color: '#2ecc71' }}>✓</div>
          <div>
            <div style={{ fontSize: '.85rem', color: 'var(--muted)' }}>{tr(lang, 'adm_orders_confirmed')}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{confirmed}</div>
            <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'adm_orders_confirmed_sub')}</div>
          </div>
          <span style={{ position: 'absolute', top: 16, right: 16, color: '#2ecc71', fontSize: 18 }}>→</span>
        </div>
        <div style={cardStyle('rgba(0,206,201,.4)')}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(0,206,201,.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><IMoney size={26} /></div>
          <div>
            <div style={{ fontSize: '.85rem', color: 'var(--muted)' }}>{tr(lang, 'adm_orders_revenue')}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{fmt(revenue)}</div>
            <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'adm_orders_revenue_sub')}</div>
          </div>
          <span style={{ position: 'absolute', top: 16, right: 16, color: '#00cec9', fontSize: 18 }}>→</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          { id: 'pending', label: tr(lang, 'adm_orders_tab_pending'), count: pending },
          { id: 'confirmed', label: tr(lang, 'adm_orders_tab_confirmed'), count: confirmed },
          { id: 'all', label: tr(lang, 'adm_orders_tab_all'), count: total },
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
        <input placeholder={tr(lang, 'adm_orders_search_ph')}
          value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 240, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.88rem', outline: 'none' }} />
        <select value={payMethod} onChange={e => { setPayMethod(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_orders_all_pay_methods')}</option>
          {payMethods.map(m => <option key={m} value={m} style={{ background: '#1a0d0e' }}>{m}</option>)}
        </select>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_orders_all_statuses')}</option>
          <option value="pending" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_orders_status_pending')}</option>
          <option value="confirmed" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_orders_status_confirmed')}</option>
          <option value="rejected" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_orders_status_rejected')}</option>
        </select>
        <select value={dateRange} onChange={e => { setDateRange(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_orders_all_time')}</option>
          <option value="today" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_orders_today')}</option>
          <option value="week" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_orders_last_7')}</option>
          <option value="month" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_orders_last_30')}</option>
        </select>
        <button onClick={clearFilters} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontSize: '.85rem', fontWeight: 600 }}>{tr(lang, 'adm_orders_clear_filters')}</button>
        <button onClick={load} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>{tr(lang, 'adm_orders_refresh_btn')}</button>
      </div>

      {/* Table */}
      <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.3)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                {[tr(lang, 'adm_orders_th_order_id'), tr(lang, 'adm_orders_th_customer'), tr(lang, 'adm_orders_th_product'), tr(lang, 'adm_orders_th_amount'), tr(lang, 'adm_orders_th_pay_method'), tr(lang, 'adm_orders_th_trx'), tr(lang, 'adm_orders_th_date'), tr(lang, 'adm_orders_th_pay_status'), tr(lang, 'adm_orders_th_order_status'), tr(lang, 'adm_orders_th_action')].map(h => (
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
                    <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{o.course_id ? tr(lang, 'adm_orders_course') : tr(lang, 'adm_orders_product')}</div>
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
                    <button onClick={() => setDetail(o)} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(232,35,42,.5)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontSize: '.8rem', marginRight: 6 }}>{tr(lang, 'adm_orders_view')}</button>
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
            <div style={{ fontSize: '1rem', color: '#fff' }}>{tr(lang, 'adm_orders_empty')}</div>
            <div style={{ fontSize: '.85rem' }}>{tr(lang, 'adm_orders_empty_sub')}</div>
          </div>
        )}
        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{tr(lang, 'adm_orders_showing')} {startIdx} {tr(lang, 'adm_orders_to')} {endIdx} {tr(lang, 'adm_orders_of')} {list.length} {tr(lang, 'adm_orders_orders_word')}</span>
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
              <h3 style={{ margin: 0, color: '#fff' }}>{tr(lang, 'adm_orders_detail_title')}</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '.9rem' }}>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'adm_orders_detail_id')} </span><b style={{ color: '#fff' }}>#CSK-{String(detail.id).padStart(5, '0')}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'adm_orders_detail_customer')} </span><b style={{ color: '#fff' }}>{detail.name}</b> ({detail.mobile})</div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'adm_orders_detail_item')} </span><b style={{ color: '#fff' }}>{detail.item_name}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'adm_orders_detail_amount')} </span><b style={{ color: '#fff' }}>{fmt(detail.price)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'adm_orders_detail_payment')} </span><b style={{ color: '#fff' }}>{detail.pay_method}</b> — <code>{detail.trx_id}</code></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'adm_orders_detail_status')} </span>{statusBadge(detail.status)}</div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'adm_orders_detail_date')} </span>{new Date(detail.created_at).toLocaleString('en-GB')}</div>
              {detail.reject_reason && <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'adm_orders_detail_reject_reason')} </span><span style={{ color: '#ff7b7b' }}>{detail.reject_reason}</span></div>}
            </div>
            {detail.status === 'pending' && (
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={() => act(detail.id, 'verify_order')} disabled={busy === detail.id} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#2ecc71', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  {busy === detail.id ? tr(lang, 'adm_orders_processing') : tr(lang, 'adm_orders_verify_approve')}
                </button>
                <button onClick={() => act(detail.id, 'reject_order')} disabled={busy === detail.id} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#e8232a', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  {tr(lang, 'adm_orders_reject')}
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
  const { lang } = useLang()
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
    if (!form.title.trim()) return alert(tr(lang, 'adm_lessons_err_title'))
    if (!form.video_url.trim()) return alert(tr(lang, 'adm_lessons_err_video'))
    if (!courseId) return alert(tr(lang, 'adm_lessons_err_course'))
    const dur = Number(form.duration_min)
    if (form.duration_min !== '' && (isNaN(dur) || dur < 0)) return alert(tr(lang, 'adm_lessons_err_duration'))
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
    if (!confirm('"' + l.title + '" ' + tr(lang, 'adm_lessons_delete_confirm'))) return
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
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>{tr(lang, 'adm_lessons_title')}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'adm_lessons_subtitle')}</p>
          </div>
        </div>
        <div style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.03)', fontSize: '.85rem', color: 'var(--silver)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {tr(lang, 'adm_lessons_total')} <b style={{ color: '#fff' }}>{allLessons.length}</b>
        </div>
      </div>

      {/* Add New Lesson Form */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 18, color: '#ff6b6b' }}>+</div>
          <div>
            <div style={{ fontWeight: 700, color: '#fff', fontSize: '1.02rem' }}>{editing ? tr(lang, 'adm_lessons_edit') : tr(lang, 'adm_lessons_new')}</div>
            <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>{tr(lang, 'adm_lessons_new_sub')}</div>
          </div>
        </div>
        <form onSubmit={save}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={lbl}>{tr(lang, 'adm_lessons_course')}</label>
                <select value={courseId} onChange={e => setCourseId(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_lessons_select_course')}</option>
                  {courses.map(c => <option key={c.id} value={c.id} style={{ background: '#1a0d0e' }}>{c.title}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{tr(lang, 'adm_lessons_video_url')} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{tr(lang, 'adm_lessons_video_hint')}</span></label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 16 }}>🔗</span>
                  <input style={{ ...inp, paddingLeft: 36 }} value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
                </div>
              </div>
              <div>
                <label style={lbl}>{tr(lang, 'adm_lessons_minutes')}</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 16 }}>⏱</span>
                  <input style={{ ...inp, paddingLeft: 36 }} type="number" min="0" value={form.duration_min} onChange={e => setForm({ ...form, duration_min: e.target.value })} placeholder={tr(lang, 'adm_lessons_minutes_ph')} />
                </div>
              </div>
              <div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: '.9rem', color: '#fff' }}>
                  <input type="checkbox" checked={form.is_free_preview} onChange={e => setForm({ ...form, is_free_preview: e.target.checked })} style={{ width: 18, height: 18, accentColor: '#e8232a', cursor: 'pointer' }} />
                  <span style={{ padding: '2px 8px', borderRadius: 5, background: '#3b82f6', color: '#fff', fontSize: '.7rem', fontWeight: 700 }}>FREE</span>
                  {tr(lang, 'adm_lessons_free_lesson')}
                </label>
              </div>
            </div>
            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={lbl}>{tr(lang, 'adm_lessons_title_label')}</label>
                <input style={inp} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={tr(lang, 'adm_lessons_title_ph')} />
              </div>
              <div>
                <label style={lbl}>{tr(lang, 'adm_lessons_desc')}</label>
                <textarea style={{ ...inp, height: 110, paddingTop: 10, resize: 'vertical', fontFamily: 'inherit' }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={tr(lang, 'adm_lessons_desc_ph')} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="submit" disabled={busy} style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, fontSize: '.92rem', cursor: busy ? 'not-allowed' : 'pointer', boxShadow: '0 4px 16px rgba(232,35,42,.35)', opacity: busy ? 0.6 : 1 }}>
              + {busy ? tr(lang, 'adm_lessons_saving') : editing ? tr(lang, 'adm_lessons_update') : tr(lang, 'adm_lessons_add')}
            </button>
            {editing && <button type="button" onClick={reset} style={{ padding: '11px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>{tr(lang, 'adm_lessons_cancel')}</button>}
          </div>
        </form>
      </div>

      {/* Lessons Table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center' }}><IOrders size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>{tr(lang, 'adm_lessons_list')}</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'adm_lessons_list_sub')}</div>
            </div>
          </div>
          <input placeholder={tr(lang, 'adm_lessons_search_ph')} value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: '9px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, color: '#fff', fontSize: '.85rem', outline: 'none', minWidth: 240 }} />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.02)' }}>
                {['#', tr(lang, 'adm_lessons_th_title'), tr(lang, 'adm_lessons_th_course'), tr(lang, 'adm_lessons_th_video'), tr(lang, 'adm_lessons_th_minutes'), tr(lang, 'adm_lessons_th_access'), tr(lang, 'adm_lessons_th_actions')].map(h => (
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
                      <span style={{ padding: '4px 12px', borderRadius: 7, fontSize: '.78rem', fontWeight: 600, background: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)' }}>{tr(lang, 'adm_lessons_free')}</span>
                    ) : (
                      <span style={{ padding: '4px 12px', borderRadius: 7, fontSize: '.78rem', fontWeight: 600, background: 'rgba(232,35,42,.15)', color: '#ff6b6b', border: '1px solid rgba(232,35,42,.4)' }}>{tr(lang, 'adm_lessons_paid')}</span>
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
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>{tr(lang, 'adm_lessons_empty')}</div>
            <div style={{ fontSize: '.85rem' }}>{tr(lang, 'adm_lessons_empty_sub')}</div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Members list ── */
function MembersTab({ session }) {
  const { lang } = useLang()
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
      both: { bg: 'rgba(192,132,252,.12)', color: '#c084fc', border: 'rgba(192,132,252,.4)', label: tr(lang, 'adm_members_badge_both') },
      course: { bg: 'rgba(77,163,255,.12)', color: '#4da3ff', border: 'rgba(77,163,255,.4)', label: tr(lang, 'adm_members_badge_course') },
      service: { bg: 'rgba(46,204,113,.12)', color: '#2ecc71', border: 'rgba(46,204,113,.4)', label: tr(lang, 'adm_members_badge_service') },
      registered: { bg: 'rgba(245,185,66,.12)', color: '#f5b942', border: 'rgba(245,185,66,.4)', label: tr(lang, 'adm_members_badge_registered') },
    }
    const s = map[cls] || map.registered
    return <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>{s.label}</span>
  }

  const del = async (m) => {
    if (!confirm('"' + (m.full_name || m.email) + '" ' + tr(lang, 'adm_members_delete_confirm'))) return
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
    { label: tr(lang, 'adm_members_total'), value: total.toLocaleString(), desc: tr(lang, 'adm_members_total_sub'), color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '👥' },
    { label: tr(lang, 'adm_members_course'), value: courseCustomers.toLocaleString(), desc: tr(lang, 'adm_members_course_sub'), color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '🎓' },
    { label: tr(lang, 'adm_members_service'), value: serviceCustomers.toLocaleString(), desc: tr(lang, 'adm_members_service_sub'), color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '🛍' },
    { label: tr(lang, 'adm_members_registered'), value: registeredOnly.toLocaleString(), desc: tr(lang, 'adm_members_registered_sub'), color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '👤' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>👥</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>{tr(lang, 'adm_members_title')}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'adm_members_subtitle')}</p>
          </div>
        </div>
        <button onClick={() => alert(tr(lang, 'adm_members_add_note'))} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>
          + {tr(lang, 'adm_members_add')}
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
        <input placeholder={tr(lang, 'adm_members_search_ph')} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 220, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
        <select value={activityF} onChange={e => { setActivityF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_members_all_members')}</option>
          <option value="course" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_members_badge_course')}</option>
          <option value="service" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_members_badge_service')}</option>
          <option value="both" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_members_badge_both')}</option>
          <option value="registered" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_members_badge_registered')}</option>
        </select>
        <select value={purchaseF} onChange={e => { setPurchaseF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_members_all_purchases')}</option>
          <option value="course" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_members_has_course')}</option>
          <option value="service" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_members_has_service')}</option>
          <option value="none" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_members_no_purchases')}</option>
        </select>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_members_all_statuses')}</option>
          <option value="active" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_members_active')}</option>
          <option value="suspended" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_members_suspended')}</option>
        </select>
        <select value={countryF} onChange={e => setCountryF(e.target.value)} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_members_all_countries')}</option>
          <option value="bd" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_members_bangladesh')}</option>
        </select>
        <select value={dateF} onChange={e => { setDateF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_members_all_time')}</option>
          <option value="today" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_members_today')}</option>
          <option value="week" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_members_last_7')}</option>
          <option value="month" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_members_last_30')}</option>
        </select>
        <button onClick={clearFilters} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontSize: '.85rem', fontWeight: 600 }}>{tr(lang, 'adm_members_clear_filters')}</button>
        <button onClick={load} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>{tr(lang, 'adm_members_refresh')}</button>
      </div>

      {/* Table */}
      <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.3)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                {['#', tr(lang, 'adm_members_th_profile'), tr(lang, 'adm_members_th_member_id'), tr(lang, 'adm_members_th_name'), tr(lang, 'adm_members_th_email'), tr(lang, 'adm_members_th_phone'), tr(lang, 'adm_members_th_activity'), tr(lang, 'adm_members_th_courses'), tr(lang, 'adm_members_th_services'), tr(lang, 'adm_members_th_orders'), tr(lang, 'adm_members_th_spent'), tr(lang, 'adm_members_th_status'), tr(lang, 'adm_members_th_joined'), tr(lang, 'adm_members_th_last_login'), tr(lang, 'adm_members_th_actions')].map(h => (
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
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: 'rgba(232,35,42,.15)', color: '#ff6b6b', border: '1px solid rgba(232,35,42,.4)' }}>● {tr(lang, 'adm_members_suspended')}</span>
                    ) : (
                      <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)' }}>● {tr(lang, 'adm_members_active')}</span>
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
                    <button title={tr(lang, 'adm_members_view')} onClick={() => setDetail(m)} style={actionBtn('transparent', 'rgba(255,255,255,.15)', '#fff')}>👁</button>
                    <button title={tr(lang, 'adm_members_orders')} onClick={() => setDetail(m)} style={actionBtn('rgba(77,163,255,.1)', 'rgba(77,163,255,.4)', '#4da3ff')}>🧾</button>
                    <button title={tr(lang, 'adm_members_edit')} onClick={() => { setEditM(m); setEditForm({ full_name: m.full_name || '', phone: m.phone || '' }) }} style={actionBtn('rgba(245,185,66,.1)', 'rgba(245,185,66,.4)', '#f5b942')}>✏️</button>
                    <button title={tr(lang, 'adm_members_delete')} onClick={() => del(m)} disabled={busy === m.id} style={actionBtn('rgba(232,35,42,.1)', 'rgba(232,35,42,.4)', '#ff6b6b')}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>{tr(lang, 'adm_members_empty')}</div>
            <div style={{ fontSize: '.85rem' }}>{tr(lang, 'adm_members_empty_sub')}</div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>{tr(lang, 'adm_members_loading')}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{tr(lang, 'adm_members_showing')} {list.length === 0 ? 0 : (curPage - 1) * PAGE_SIZE + 1} {tr(lang, 'adm_members_to')} {Math.min(curPage * PAGE_SIZE, list.length)} {tr(lang, 'adm_members_of')} {list.length.toLocaleString()} {tr(lang, 'adm_members_members_word')}</span>
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
              <h3 style={{ margin: 0, color: '#fff' }}>{tr(lang, 'adm_members_detail_title')}</h3>
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
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'adm_members_detail_email')} </span><b style={{ color: '#fff' }}>{detail.email}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'adm_members_detail_phone')} </span><b style={{ color: '#fff' }}>{detail.phone || '—'}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'adm_members_detail_joined')} </span>{new Date(detail.created_at).toLocaleString('en-GB')}</div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'adm_members_detail_courses')} </span><b style={{ color: '#fff' }}>{detail._courses}</b> &nbsp; <span style={{ color: 'var(--muted)' }}>{tr(lang, 'adm_members_detail_services')} </span><b style={{ color: '#fff' }}>{detail._services}</b> &nbsp; <span style={{ color: 'var(--muted)' }}>{tr(lang, 'adm_members_detail_orders')} </span><b style={{ color: '#fff' }}>{detail._orders}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'adm_members_detail_spent')} </span><b style={{ color: '#fff' }}>{fmt(detail._spent)}</b></div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, color: '#fff', marginBottom: 8 }}>{tr(lang, 'adm_members_purchase_history')}</div>
              {ordersOf(detail).length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '.85rem', margin: 0 }}>{tr(lang, 'adm_members_no_purchases_yet')}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ordersOf(detail).map(o => (
                    <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255,255,255,.03)', borderRadius: 8, fontSize: '.85rem' }}>
                      <span style={{ color: '#fff' }}>{o.item_name} {o.course_id ? '(' + tr(lang, 'adm_members_course_word') + ')' : '(' + tr(lang, 'adm_members_service_word') + ')'}</span>
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
              <h3 style={{ margin: 0, color: '#fff' }}>{tr(lang, 'adm_members_edit_title')}</h3>
              <button onClick={() => setEditM(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '.85rem', color: 'var(--silver)', marginBottom: 5 }}>{tr(lang, 'adm_members_full_name')}</label>
                <input value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} style={{ width: '100%', height: 42, padding: '0 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, color: '#fff', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '.85rem', color: 'var(--silver)', marginBottom: 5 }}>{tr(lang, 'adm_members_phone')}</label>
                <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} style={{ width: '100%', height: 42, padding: '0 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, color: '#fff', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <button type="submit" disabled={busy === editM.id} style={{ padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {busy === editM.id ? tr(lang, 'adm_members_saving') : tr(lang, 'adm_members_save_changes')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function TeamTab({ session, role }) {
  const { lang } = useLang()
  const [members, setMembers] = useState([])
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    supabase.from('cashskillbd_profiles').select('*').neq('role', 'member').order('created_at', { ascending: false })
      .then(({ data }) => setMembers(data || []))
  }
  useEffect(load, [])

  const setRole = async (id, newRole) => {
    if (!confirm(tr(lang, 'adm_team_role_confirm_a') + ' "' + newRole + '" ' + tr(lang, 'adm_team_role_confirm_b'))) return
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
      alert(j.added ? email + ' ' + tr(lang, 'adm_team_added') : 'ℹ️ ' + (j.message || tr(lang, 'adm_team_done')))
      setEmail('')
      load()
    } catch (ex) { alert('❌ ' + ex.message) }
    setBusy(false)
  }

  if (role !== 'admin') {
    return <div className="card"><p>{tr(lang, 'adm_team_admin_only')}</p></div>
  }

  return (
    <div>
      <div className="card form-card" style={{marginBottom:24}}>
        <h3 style={{marginBottom:10}}>{tr(lang, 'adm_team_add_title')}</h3>
        <p style={{color:'var(--muted)', fontSize:'.9rem', marginBottom:12}}>{tr(lang, 'adm_team_add_sub')}</p>
        <form onSubmit={addByEmail} style={{display:'flex', gap:10}}>
          <input type="email" placeholder={tr(lang, 'adm_team_email_ph')} value={email} onChange={e => setEmail(e.target.value)} style={{margin:0}} />
          <button className="btn" disabled={busy} style={{whiteSpace:'nowrap'}}>{busy ? '…' : tr(lang, 'adm_team_make_support')}</button>
        </form>
      </div>
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <div className="tbl-wrap"><table className="data-table">
            <thead><tr><th>{tr(lang, 'adm_team_th_name')}</th><th>{tr(lang, 'adm_team_th_email')}</th><th>{tr(lang, 'adm_team_th_role')}</th><th></th></tr></thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id}>
                  <td>{m.full_name || '—'}</td><td>{m.email}</td>
                  <td>{m.role === 'admin' ? tr(lang, 'adm_team_admin') : tr(lang, 'adm_team_support')}</td>
                  <td style={{whiteSpace:'nowrap'}}>
                    {m.role === 'support' && <>
                      <button className="mini-btn ok" disabled={busy} onClick={() => setRole(m.id, 'admin')}>{tr(lang, 'adm_team_admin')}</button>{' '}
                      <button className="mini-btn no" disabled={busy} onClick={() => setRole(m.id, 'member')}>{tr(lang, 'adm_team_make_member')}</button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {members.length === 0 && <p style={{padding:20, color:'var(--muted)'}}>{tr(lang, 'adm_team_empty')}</p>}
        </div>
      </div>
    </div>
  )
}

/* ── Reviews management ── */
function ReviewsTab() {
  const { lang } = useLang()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeF, setTypeF] = useState('all')
  const [ratingF, setRatingF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [dateF, setDateF] = useState('all')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState(null)
  const [reply, setReply] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [editR, setEditR] = useState(null)
  const [editText, setEditText] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ author: '', text: '', rating: 5 })
  const [busy, setBusy] = useState(null)
  const PAGE_SIZE = 10

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('cashskillbd_reviews').select('*').order('created_at', { ascending: false }).limit(500)
    setReviews(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Stats ──
  const total = reviews.length
  const rated = reviews.filter(r => r.rating != null)
  const avgRating = rated.length > 0 ? (rated.reduce((s, r) => s + Number(r.rating), 0) / rated.length).toFixed(1) : '—'
  const approved = reviews.filter(r => !r.status || r.status === 'approved').length
  const pending = reviews.filter(r => r.status === 'pending').length

  // ── Filters ──
  let list = reviews
  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter(r => (r.author || '').toLowerCase().includes(q) || (r.text || '').toLowerCase().includes(q) || (r.product || '').toLowerCase().includes(q) || (r.course || '').toLowerCase().includes(q))
  }
  if (typeF !== 'all') list = list.filter(r => (r.type || 'general') === typeF)
  if (ratingF !== 'all') list = list.filter(r => Number(r.rating) === Number(ratingF))
  if (statusF !== 'all') list = list.filter(r => (r.status || 'approved') === statusF)
  if (dateF !== 'all') {
    const days = dateF === 'today' ? 1 : dateF === 'week' ? 7 : 30
    const cutoff = new Date(Date.now() - days * 864e5)
    list = list.filter(r => new Date(r.created_at) >= cutoff)
  }

  const clearFilters = () => { setSearch(''); setTypeF('all'); setRatingF('all'); setStatusF('all'); setDateF('all'); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const curPage = Math.min(page, totalPages)
  const pageItems = list.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE)

  const del = async (r) => {
    if (!confirm('"' + r.author + '" ' + tr(lang, 'adm_reviews_delete_confirm'))) return
    setBusy(r.id)
    const { error } = await supabase.from('cashskillbd_reviews').delete().eq('id', r.id)
    if (error) alert('❌ ' + error.message)
    else load()
    setBusy(null)
  }

  const setStatus = async (r, status) => {
    setBusy(r.id)
    const { error } = await supabase.from('cashskillbd_reviews').update({ status }).eq('id', r.id)
    if (error) alert('❌ ' + tr(lang, 'adm_reviews_status_fail') + ' ' + error.message)
    else load()
    setBusy(null)
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    setBusy(editR.id)
    const { error } = await supabase.from('cashskillbd_reviews').update({ text: editText }).eq('id', editR.id)
    if (error) alert('❌ ' + error.message)
    else { setEditR(null); load() }
    setBusy(null)
  }

  const addReview = async (e) => {
    e.preventDefault()
    if (!addForm.author.trim() || !addForm.text.trim()) return alert(tr(lang, 'adm_reviews_err_author_text'))
    setBusy('add')
    const { error } = await supabase.from('cashskillbd_reviews').insert([{ author: addForm.author.trim(), text: addForm.text.trim(), rating: addForm.rating, status: 'pending' }])
    if (error) alert('❌ ' + error.message)
    else { setShowAdd(false); setAddForm({ author: '', text: '', rating: 5 }); load() }
    setBusy(null)
  }

  const typeBadge = (type) => {
    const map = {
      course: { bg: 'rgba(192,132,252,.12)', color: '#c084fc', border: 'rgba(192,132,252,.4)', label: tr(lang, 'adm_reviews_type_course') },
      vps: { bg: 'rgba(192,132,252,.12)', color: '#c084fc', border: 'rgba(192,132,252,.4)', label: tr(lang, 'adm_reviews_type_vps') },
      ip: { bg: 'rgba(77,163,255,.12)', color: '#4da3ff', border: 'rgba(77,163,255,.4)', label: tr(lang, 'adm_reviews_type_ip') },
      dollar: { bg: 'rgba(46,204,113,.12)', color: '#2ecc71', border: 'rgba(46,204,113,.4)', label: tr(lang, 'adm_reviews_type_dollar') },
      number: { bg: 'rgba(245,185,66,.12)', color: '#f5b942', border: 'rgba(245,185,66,.4)', label: tr(lang, 'adm_reviews_type_number') },
    }
    const s = map[(type || 'general').toLowerCase()] || { bg: 'rgba(255,255,255,.06)', color: 'var(--silver)', border: 'rgba(255,255,255,.15)', label: type || tr(lang, 'adm_reviews_type_general') }
    return <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>{s.label}</span>
  }

  const statusBadge = (status) => {
    const s = status || 'approved'
    const map = {
      approved: { bg: 'rgba(46,204,113,.15)', color: '#2ecc71', border: 'rgba(46,204,113,.4)', label: tr(lang, 'adm_reviews_status_approved') },
      pending: { bg: 'rgba(245,185,66,.15)', color: '#f5b942', border: 'rgba(245,185,66,.4)', label: tr(lang, 'adm_reviews_status_pending') },
      rejected: { bg: 'rgba(232,35,42,.15)', color: '#ff6b6b', border: 'rgba(232,35,42,.4)', label: tr(lang, 'adm_reviews_status_rejected') },
    }
    const b = map[s] || map.approved
    return <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.75rem', fontWeight: 600, background: b.bg, color: b.color, border: `1px solid ${b.border}`, whiteSpace: 'nowrap' }}>● {b.label}</span>
  }

  const stars = (rating) => {
    if (rating == null) return <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>—</span>
    return <span style={{ color: '#f5b942', fontSize: '.85rem', letterSpacing: 1, whiteSpace: 'nowrap' }}>{'★'.repeat(Math.round(Number(rating)))}{'☆'.repeat(5 - Math.round(Number(rating)))}</span>
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
    { label: tr(lang, 'adm_reviews_total'), value: total.toLocaleString(), desc: tr(lang, 'adm_reviews_total_sub'), color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '💬' },
    { label: tr(lang, 'adm_reviews_avg'), value: avgRating, desc: rated.length > 0 ? tr(lang, 'adm_reviews_avg_from_a') + ' ' + rated.length + ' ' + tr(lang, 'adm_reviews_avg_from_b') : tr(lang, 'adm_reviews_no_ratings'), color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '⭐' },
    { label: tr(lang, 'adm_reviews_approved'), value: approved.toLocaleString(), desc: tr(lang, 'adm_reviews_approved_sub'), color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '👍' },
    { label: tr(lang, 'adm_reviews_pending'), value: pending.toLocaleString(), desc: tr(lang, 'adm_reviews_pending_sub'), color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '🕐' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>⭐</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>{tr(lang, 'adm_reviews_title')}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'adm_reviews_subtitle')}</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>
          + {tr(lang, 'adm_reviews_add')}
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
        <input placeholder={tr(lang, 'adm_reviews_search_ph')} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 220, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
        <select value={typeF} onChange={e => { setTypeF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_reviews_all_types')}</option>
          <option value="course" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_reviews_type_course')}</option>
          <option value="vps" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_reviews_type_vps')}</option>
          <option value="ip" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_reviews_type_ip')}</option>
          <option value="dollar" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_reviews_type_dollar')}</option>
          <option value="number" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_reviews_type_number')}</option>
        </select>
        <select value={ratingF} onChange={e => { setRatingF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_reviews_all_ratings')}</option>
          {[5, 4, 3, 2, 1].map(n => <option key={n} value={n} style={{ background: '#1a0d0e' }}>{n} {n > 1 ? tr(lang, 'adm_reviews_stars') : tr(lang, 'adm_reviews_star')}</option>)}
        </select>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_reviews_all_statuses')}</option>
          <option value="approved" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_reviews_status_approved')}</option>
          <option value="pending" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_reviews_status_pending')}</option>
          <option value="rejected" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_reviews_status_rejected')}</option>
        </select>
        <select value={dateF} onChange={e => { setDateF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_reviews_all_time')}</option>
          <option value="today" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_reviews_today')}</option>
          <option value="week" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_reviews_last_7')}</option>
          <option value="month" style={{ background: '#1a0d0e' }}>{tr(lang, 'adm_reviews_last_30')}</option>
        </select>
        <button onClick={clearFilters} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(232,35,42,.4)', background: 'transparent', color: '#ff6b6b', cursor: 'pointer', fontSize: '.85rem', fontWeight: 600 }}>{tr(lang, 'adm_reviews_clear_filters')}</button>
        <button onClick={load} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>{tr(lang, 'adm_reviews_refresh')}</button>
      </div>

      {/* Table */}
      <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.3)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                {['#', tr(lang, 'adm_reviews_th_user'), tr(lang, 'adm_reviews_th_type'), tr(lang, 'adm_reviews_th_product'), tr(lang, 'adm_reviews_th_rating'), tr(lang, 'adm_reviews_th_review'), tr(lang, 'adm_reviews_th_status'), tr(lang, 'adm_reviews_th_date'), tr(lang, 'adm_reviews_th_helpful'), tr(lang, 'adm_reviews_th_actions')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '.85rem' }}>{(curPage - 1) * PAGE_SIZE + i + 1}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(232,35,42,.2)', display: 'grid', placeItems: 'center', color: '#ff6b6b', fontSize: '.75rem', fontWeight: 700, flexShrink: 0 }}>
                        {(r.author || '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#fff', fontSize: '.88rem', whiteSpace: 'nowrap' }}>{r.author || '—'}</div>
                        <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>{r.email || ''}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>{typeBadge(r.type)}</td>
                  <td style={{ padding: '12px 14px', fontSize: '.85rem', color: '#fff' }}>{r.product || r.course || (r.post_url ? <a href={r.post_url} target="_blank" rel="noreferrer" style={{ color: '#ff6b6b' }}>{tr(lang, 'adm_reviews_view_post')}</a> : '—')}</td>
                  <td style={{ padding: '12px 14px' }}>{stars(r.rating)}</td>
                  <td style={{ padding: '12px 14px', fontSize: '.85rem', color: 'var(--silver)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.text || tr(lang, 'adm_reviews_no_text')}</td>
                  <td style={{ padding: '12px 14px' }}>{statusBadge(r.status)}</td>
                  <td style={{ padding: '12px 14px', fontSize: '.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}<br />
                    <span style={{ fontSize: '.72rem' }}>{new Date(r.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '.85rem', color: '#fff', textAlign: 'center' }}>{r.helpful_count ?? 0}</td>
                  <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                    <button title={tr(lang, 'adm_reviews_view')} onClick={() => setDetail(r)} style={actionBtn('transparent', 'rgba(255,255,255,.15)', '#fff')}>👁</button>
                    <button title={tr(lang, 'adm_reviews_reply')} onClick={() => { setReply(r); setReplyText('') }} style={actionBtn('rgba(77,163,255,.1)', 'rgba(77,163,255,.4)', '#4da3ff')}>↩</button>
                    <button title={tr(lang, 'adm_reviews_edit')} onClick={() => { setEditR(r); setEditText(r.text || '') }} style={actionBtn('rgba(245,185,66,.1)', 'rgba(245,185,66,.4)', '#f5b942')}>✏️</button>
                    {(r.status === 'pending') && (
                      <button title={tr(lang, 'adm_reviews_approve')} onClick={() => setStatus(r, 'approved')} disabled={busy === r.id} style={actionBtn('rgba(46,204,113,.1)', 'rgba(46,204,113,.4)', '#2ecc71')}>✓</button>
                    )}
                    <button title={tr(lang, 'adm_reviews_delete')} onClick={() => del(r)} disabled={busy === r.id} style={actionBtn('rgba(232,35,42,.1)', 'rgba(232,35,42,.4)', '#ff6b6b')}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>{tr(lang, 'adm_reviews_empty')}</div>
            <div style={{ fontSize: '.85rem' }}>{tr(lang, 'adm_reviews_empty_sub')}</div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>{tr(lang, 'adm_reviews_loading')}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{tr(lang, 'adm_reviews_showing')} {list.length === 0 ? 0 : (curPage - 1) * PAGE_SIZE + 1} {tr(lang, 'adm_reviews_to')} {Math.min(curPage * PAGE_SIZE, list.length)} {tr(lang, 'adm_reviews_of')} {list.length.toLocaleString()} {tr(lang, 'adm_reviews_reviews_word')}</span>
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
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 520, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{tr(lang, 'adm_reviews_detail_title')}</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(232,35,42,.2)', display: 'grid', placeItems: 'center', color: '#ff6b6b', fontWeight: 700 }}>{(detail.author || '?').slice(0, 2).toUpperCase()}</div>
              <div><div style={{ fontWeight: 700, color: '#fff' }}>{detail.author}</div><div style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{new Date(detail.created_at).toLocaleString('en-GB')}</div></div>
              {statusBadge(detail.status)}
            </div>
            <div style={{ marginBottom: 10 }}>{stars(detail.rating)}</div>
            <p style={{ color: 'var(--silver)', fontSize: '.92rem', lineHeight: 1.6, margin: 0 }}>{detail.text || tr(lang, 'adm_reviews_no_text')}</p>
            {detail.post_url && <p style={{ marginTop: 12 }}><a href={detail.post_url} target="_blank" rel="noreferrer" style={{ color: '#ff6b6b', fontSize: '.85rem' }}>{tr(lang, 'adm_reviews_view_original')}</a></p>}
          </div>
        </div>
      )}

      {/* Reply Modal */}
      {reply && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setReply(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{tr(lang, 'adm_reviews_reply_to')} {reply.author}</h3>
              <button onClick={() => setReply(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '.85rem', margin: '0 0 12px' }}>{tr(lang, 'adm_reviews_reply_note')}</p>
            <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={4} placeholder={tr(lang, 'adm_reviews_reply_ph')} style={{ ...inp, resize: 'vertical' }} />
            <button onClick={() => { alert(tr(lang, 'adm_reviews_reply_noted') + ' ' + replyText.slice(0, 50)); setReply(null) }} style={{ marginTop: 12, padding: '11px', width: '100%', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{tr(lang, 'adm_reviews_send_reply')}</button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editR && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setEditR(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{tr(lang, 'adm_reviews_edit_title')}</h3>
              <button onClick={() => setEditR(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <form onSubmit={saveEdit}>
              <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={5} style={{ ...inp, resize: 'vertical' }} />
              <button type="submit" disabled={busy === editR.id} style={{ marginTop: 12, padding: '11px', width: '100%', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {busy === editR.id ? tr(lang, 'adm_reviews_saving') : tr(lang, 'adm_reviews_save_changes')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Review Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setShowAdd(false)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{tr(lang, 'adm_reviews_add_title')}</h3>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <form onSubmit={addReview} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input value={addForm.author} onChange={e => setAddForm({ ...addForm, author: e.target.value })} placeholder={tr(lang, 'adm_reviews_author_ph')} style={inp} />
              <textarea value={addForm.text} onChange={e => setAddForm({ ...addForm, text: e.target.value })} rows={4} placeholder={tr(lang, 'adm_reviews_text_ph')} style={{ ...inp, resize: 'vertical' }} />
              <select value={addForm.rating} onChange={e => setAddForm({ ...addForm, rating: Number(e.target.value) })} style={{ ...inp, cursor: 'pointer' }}>
                {[5, 4, 3, 2, 1].map(n => <option key={n} value={n} style={{ background: '#1a0d0e' }}>{n} {n > 1 ? tr(lang, 'adm_reviews_stars') : tr(lang, 'adm_reviews_star')}</option>)}
              </select>
              <button type="submit" disabled={busy === 'add'} style={{ padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {busy === 'add' ? tr(lang, 'adm_reviews_adding') : tr(lang, 'adm_reviews_add_title')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}


