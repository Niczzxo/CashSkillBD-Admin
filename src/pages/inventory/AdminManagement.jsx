import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { tr } from '../../i18n/translations.js'
import { useLang } from '../../i18n/LanguageContext.jsx'

// ── Role definitions ──
const ROLES = [
  { id: 'admin', color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', border: 'rgba(232,35,42,.4)', icon: '🛡' },
  { id: 'manager', color: '#4da3ff', bg: 'rgba(77,163,255,.12)', border: 'rgba(77,163,255,.4)', icon: '👤' },
  { id: 'support', color: '#c084fc', bg: 'rgba(192,132,252,.12)', border: 'rgba(192,132,252,.4)', icon: '🎧' },
  { id: 'content', color: '#f5b942', bg: 'rgba(245,185,66,.12)', border: 'rgba(245,185,66,.4)', icon: '📖' },
  { id: 'payment', color: '#2ecc71', bg: 'rgba(46,204,113,.12)', border: 'rgba(46,204,113,.4)', icon: '💳' },
]
const ROLE_LABEL_KEY = { admin: 'am_role_admin', manager: 'am_role_manager', support: 'am_role_support', content: 'am_role_content', payment: 'am_role_payment' }
const ROLE_DESC_KEY = { admin: 'am_role_desc_admin', manager: 'am_role_desc_manager', support: 'am_role_desc_support', content: 'am_role_desc_content', payment: 'am_role_desc_payment' }

const PERMISSIONS = [
  'Dashboard', 'Site Settings', 'Orders Management', 'Members Management',
  'Lessons & Courses', 'Seminar Management', 'Products & VPS',
  'Payment Management', 'Reports & Analytics', 'Admin Management',
  'Activity Logs', 'Support & Tickets', 'Inventory & Suppliers', 'Price History',
]

const PERMISSION_META = {
  'Dashboard': { icon: '🏠', descKey: 'am_perm_desc_dashboard', actionKeys: ['am_pa_view_dashboard', 'am_pa_view_statistics', 'am_pa_quick_links', 'am_pa_system_notifications'], categoryKey: 'am_cat_core', sensitive: false },
  'Site Settings': { icon: '⚙️', descKey: 'am_perm_desc_site_settings', actionKeys: ['am_pa_view_settings', 'am_pa_edit_settings', 'am_pa_upload_images', 'am_pa_manage_seo'], categoryKey: 'am_cat_core', sensitive: true },
  'Orders Management': { icon: '🛒', descKey: 'am_perm_desc_orders', actionKeys: ['am_pa_view_orders', 'am_pa_verify_payments', 'am_pa_reject_orders', 'am_pa_view_order_details'], categoryKey: 'am_cat_operations', sensitive: true },
  'Members Management': { icon: '👥', descKey: 'am_perm_desc_members', actionKeys: ['am_pa_view_members', 'am_pa_edit_members', 'am_pa_view_enrollments', 'am_pa_suspend_members'], categoryKey: 'am_cat_operations', sensitive: true },
  'Lessons & Courses': { icon: '📚', descKey: 'am_perm_desc_lessons', actionKeys: ['am_pa_view_courses', 'am_pa_create_lessons', 'am_pa_edit_lessons', 'am_pa_delete_lessons'], categoryKey: 'am_cat_content', sensitive: false },
  'Seminar Management': { icon: '📅', descKey: 'am_perm_desc_seminar', actionKeys: ['am_pa_view_registrations', 'am_pa_add_registrations', 'am_pa_toggle_checkin', 'am_pa_export_list'], categoryKey: 'am_cat_content', sensitive: false },
  'Products & VPS': { icon: '📦', descKey: 'am_perm_desc_products', actionKeys: ['am_pa_view_products', 'am_pa_create_products', 'am_pa_edit_products', 'am_pa_delete_products'], categoryKey: 'am_cat_operations', sensitive: true },
  'Payment Management': { icon: '💳', descKey: 'am_perm_desc_payment', actionKeys: ['am_pa_view_transactions', 'am_pa_update_rates', 'am_pa_record_transactions', 'am_pa_process_refunds'], categoryKey: 'am_cat_sensitive', sensitive: true },
  'Reports & Analytics': { icon: '📊', descKey: 'am_perm_desc_reports', actionKeys: ['am_pa_view_reports', 'am_pa_export_reports', 'am_pa_view_charts', 'am_pa_filter_by_date'], categoryKey: 'am_cat_core', sensitive: false },
  'Admin Management': { icon: '👑', descKey: 'am_perm_desc_admin', actionKeys: ['am_pa_view_admins', 'am_pa_create_admins', 'am_pa_edit_roles', 'am_pa_deactivate_admins'], categoryKey: 'am_cat_sensitive', sensitive: true },
  'Activity Logs': { icon: '📋', descKey: 'am_perm_desc_activity', actionKeys: ['am_pa_view_logs', 'am_pa_filter_logs', 'am_pa_export_logs'], categoryKey: 'am_cat_sensitive', sensitive: true },
  'Support & Tickets': { icon: '🎧', descKey: 'am_perm_desc_support', actionKeys: ['am_pa_view_tickets', 'am_pa_reply_tickets', 'am_pa_update_status', 'am_pa_view_inquiries'], categoryKey: 'am_cat_operations', sensitive: false },
  'Inventory & Suppliers': { icon: '🏭', descKey: 'am_perm_desc_inventory', actionKeys: ['am_pa_view_inventory', 'am_pa_adjust_stock', 'am_pa_manage_suppliers', 'am_pa_record_purchases'], categoryKey: 'am_cat_operations', sensitive: true },
  'Price History': { icon: '🏷', descKey: 'am_perm_desc_price', actionKeys: ['am_pa_view_history', 'am_pa_filter_by_product', 'am_pa_export_history'], categoryKey: 'am_cat_operations', sensitive: false },
}
const PERM_KEY = {
  'Dashboard': 'am_perm_dashboard', 'Site Settings': 'am_perm_site_settings', 'Orders Management': 'am_perm_orders_management',
  'Members Management': 'am_perm_members_management', 'Lessons & Courses': 'am_perm_lessons_courses', 'Seminar Management': 'am_perm_seminar_management',
  'Products & VPS': 'am_perm_products_vps', 'Payment Management': 'am_perm_payment_management', 'Reports & Analytics': 'am_perm_reports_analytics',
  'Admin Management': 'am_perm_admin_management', 'Activity Logs': 'am_perm_activity_logs', 'Support & Tickets': 'am_perm_support_tickets',
  'Inventory & Suppliers': 'am_perm_inventory_suppliers', 'Price History': 'am_perm_price_history',
}
const permLabel = (p, lang) => PERM_KEY[p] ? tr(lang, PERM_KEY[p]) : p

const ROLE_PERMISSIONS = {
  admin: PERMISSIONS,
  manager: ['Dashboard', 'Site Settings', 'Orders Management', 'Members Management', 'Lessons & Courses', 'Seminar Management', 'Products & VPS', 'Reports & Analytics', 'Support & Tickets', 'Inventory & Suppliers', 'Price History'],
  support: ['Dashboard', 'Members Management', 'Support & Tickets', 'Activity Logs'],
  content: ['Dashboard', 'Lessons & Courses', 'Seminar Management'],
  payment: ['Dashboard', 'Orders Management', 'Payment Management', 'Reports & Analytics', 'Price History'],
}

const roleOf = (dbRole) => ROLES.find(r => r.id === dbRole) || ROLES[2]
const roleLabel = (dbRole, lang) => tr(lang, ROLE_LABEL_KEY[dbRole] || 'am_role_support')
const roleDesc = (dbRole, lang) => tr(lang, ROLE_DESC_KEY[dbRole] || 'am_role_desc_support')
const adminIdOf = (a) => a.member_id || `CSBD-${String(a.id).padStart(6, '0')}`

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
  const { lang } = useLang()
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleF, setRoleF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [dateF, setDateF] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [selected, setSelected] = useState(new Set())
  const [busy, setBusy] = useState(null)
  const [detail, setDetail] = useState(null)
  const [editAdmin, setEditAdmin] = useState(null)
  const [editRole, setEditRole] = useState('')
  const [selectedRole, setSelectedRole] = useState('admin')
  const [perms, setPerms] = useState(ROLE_PERMISSIONS.admin)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: '', status: 'Active', avatar_url: '' })
  const [showPass, setShowPass] = useState(false)
  const isSuperAdmin = role === 'admin'
  const myId = session?.user?.id

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
  const managers = admins.filter(a => a.role === 'manager').length
  const supportAdmins = admins.filter(a => a.role === 'support').length
  const contentAdmins = admins.filter(a => a.role === 'content').length

  // ── Filtered list ──
  let list = admins
  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter(a => (a.full_name || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q) || String(adminIdOf(a)).toLowerCase().includes(q))
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

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const pageItems = list.slice((curPage - 1) * pageSize, curPage * pageSize)

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

  const toggleSelect = (id) => {
    const s = new Set(selected)
    if (s.has(id)) s.delete(id); else s.add(id)
    setSelected(s)
  }
  const toggleSelectAll = () => {
    if (selected.size === pageItems.length) setSelected(new Set())
    else setSelected(new Set(pageItems.map(a => a.id)))
  }

  const changeRole = async (admin, newRole) => {
    if (!isSuperAdmin) return alert(tr(lang, 'am_err_only_super_change'))
    if (String(admin.id) === String(myId) && newRole !== 'admin') return alert('⚠️ ' + tr(lang, 'am_err_self_demote'))
    if (admin.role === 'admin' && superAdmins <= 1 && newRole !== 'admin') return alert('⚠️ ' + tr(lang, 'am_err_last_super_role'))
    if (!confirm(tr(lang, 'am_confirm_role_a') + '"' + (admin.full_name || admin.email) + '" ' + tr(lang, 'am_confirm_role_b') + ' "' + roleLabel(newRole, lang) + '"' + tr(lang, 'am_confirm_role_c'))) return
    setBusy(admin.id)
    try {
      await adminApi(session, 'set_role', { user_id: admin.id, role: newRole })
      load()
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const deactivate = async (admin) => {
    if (!isSuperAdmin) return alert(tr(lang, 'am_err_only_super_action'))
    if (String(admin.id) === String(myId)) return alert('⚠️ ' + tr(lang, 'am_err_self_deactivate'))
    if (admin.role === 'admin' && superAdmins <= 1) return alert('⚠️ ' + tr(lang, 'am_err_last_super_deactivate'))
    if (!confirm('"' + (admin.full_name || admin.email) + '"' + tr(lang, 'am_confirm_toggle_a') + ' ' + tr(lang, admin.is_active === false ? 'am_verb_activate' : 'am_verb_deactivate') + tr(lang, 'am_confirm_toggle_b'))) return
    setBusy(admin.id)
    try {
      const newRole = admin.is_active === false ? (admin.prev_role || 'support') : 'member'
      await adminApi(session, 'set_role', { user_id: admin.id, role: newRole })
      load()
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const remove = async (admin) => {
    if (!isSuperAdmin) return alert(tr(lang, 'am_err_only_super_delete'))
    if (String(admin.id) === String(myId)) return alert('⚠️ ' + tr(lang, 'am_err_self_delete'))
    if (admin.role === 'admin' && superAdmins <= 1) return alert('⚠️ ' + tr(lang, 'am_err_last_super_delete'))
    if (!confirm(tr(lang, 'am_confirm_remove_a') + '"' + (admin.full_name || admin.email) + '"' + tr(lang, 'am_confirm_remove_b') + '\n\n' + tr(lang, 'am_confirm_remove_c'))) return
    setBusy(admin.id)
    try {
      await adminApi(session, 'set_role', { user_id: admin.id, role: 'member' })
      load()
    } catch (e) { alert('❌ ' + e.message) }
    setBusy(null)
  }

  const createAdmin = async (e) => {
    e.preventDefault()
    if (!isSuperAdmin) return alert(tr(lang, 'am_err_only_super_create'))
    if (!form.name.trim()) return alert(tr(lang, 'am_err_name'))
    if (!form.email.trim()) return alert(tr(lang, 'am_err_email'))
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return alert(tr(lang, 'am_err_email_valid'))
    if (!form.role) return alert(tr(lang, 'am_err_role'))
    setBusy('create')
    try {
      const j = await adminApi(session, 'set_role_by_email', { email: form.email.trim(), role: form.role })
      alert(j.added ? '✅ ' + form.email + tr(lang, 'am_created_b') + roleLabel(form.role, lang) + tr(lang, 'am_created_c') + '\n\n' + tr(lang, 'am_created_note') : 'ℹ️ ' + (j.message || tr(lang, 'am_done')))
      setForm({ name: '', email: '', password: '', role: '', status: 'Active', avatar_url: '' })
      load()
    } catch (ex) { alert('❌ ' + ex.message) }
    setBusy(null)
  }

  const selectRoleCard = (roleId) => {
    setSelectedRole(roleId)
    setPerms(ROLE_PERMISSIONS[roleId] || [])
    setForm(f => ({ ...f, role: roleId }))
    document.getElementById('add-admin-form')?.scrollIntoView({ behavior: 'smooth' })
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
    return <div className="card"><p>🛡️ {tr(lang, 'am_only_super_admin')}</p></div>
  }

  const stats = [
    { label: tr(lang, 'am_stat_total'), value: total, desc: tr(lang, 'am_stat_total_desc'), color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '👥' },
    { label: tr(lang, 'am_stat_super'), value: superAdmins, desc: tr(lang, 'am_stat_super_desc'), color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '🛡' },
    { label: tr(lang, 'am_stat_managers'), value: managers, desc: tr(lang, 'am_stat_managers_desc'), color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '👤' },
    { label: tr(lang, 'am_stat_support'), value: supportAdmins, desc: tr(lang, 'am_stat_support_desc'), color: '#c084fc', bg: 'rgba(192,132,252,.15)', icon: '🎧' },
    { label: tr(lang, 'am_stat_content'), value: contentAdmins, desc: tr(lang, 'am_stat_content_desc'), color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '📖' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>👥</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>{tr(lang, 'am_title')}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'am_subtitle')}</p>
          </div>
        </div>
        <button onClick={() => document.getElementById('add-admin-form')?.scrollIntoView({ behavior: 'smooth' })}
          style={{ padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>
          + {tr(lang, 'am_add_admin')}
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
        <input placeholder={tr(lang, 'am_search_ph')} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 220, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.88rem', outline: 'none' }} />
        <select value={roleF} onChange={e => { setRoleF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'am_all_roles')}</option>
          {ROLES.map(r => <option key={r.id} value={r.id} style={{ background: '#1a0d0e' }}>{roleLabel(r.id, lang)}</option>)}
        </select>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'am_all_statuses')}</option>
          <option value="Active" style={{ background: '#1a0d0e' }}>{tr(lang, 'am_active')}</option>
          <option value="Inactive" style={{ background: '#1a0d0e' }}>{tr(lang, 'am_inactive')}</option>
        </select>
        <select value={dateF} onChange={e => { setDateF(e.target.value); setPage(1) }} style={selStyle}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'am_all_time')}</option>
          <option value="today" style={{ background: '#1a0d0e' }}>{tr(lang, 'am_today')}</option>
          <option value="week" style={{ background: '#1a0d0e' }}>{tr(lang, 'am_last_7')}</option>
          <option value="month" style={{ background: '#1a0d0e' }}>{tr(lang, 'am_last_30')}</option>
        </select>
        <button onClick={load} style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontSize: '.85rem', fontWeight: 600 }}>{tr(lang, 'am_filter')}</button>
        <button onClick={clearFilters} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>{tr(lang, 'am_reset')}</button>
        <button onClick={load} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>{tr(lang, 'am_refresh')}</button>
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                <th style={{ padding: '13px 16px', textAlign: 'left' }}><input type="checkbox" checked={pageItems.length > 0 && selected.size === pageItems.length} onChange={toggleSelectAll} style={{ accentColor: '#e8232a' }} /></th>
                {['#', tr(lang, 'am_th_admin_id'), tr(lang, 'am_th_name'), tr(lang, 'am_th_email'), tr(lang, 'am_th_role'), tr(lang, 'am_th_status'), tr(lang, 'am_th_last_login'), tr(lang, 'am_th_created'), tr(lang, 'am_th_actions')].map(h => (
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
                    <td style={{ padding: '13px 16px' }}><input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)} style={{ accentColor: '#e8232a' }} /></td>
                    <td style={{ padding: '13px 16px', color: 'var(--muted)', fontSize: '.88rem' }}>{(curPage - 1) * pageSize + i + 1}</td>
                    <td style={{ padding: '13px 16px', fontSize: '.85rem', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{adminIdOf(a)}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {a.avatar_url ? (
                          <img src={a.avatar_url} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: avatarColor(a.full_name), display: 'grid', placeItems: 'center', color: '#fff', fontSize: '.75rem', fontWeight: 700, flexShrink: 0 }}>{initials(a.full_name)}</div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, color: '#fff', fontSize: '.9rem', whiteSpace: 'nowrap' }}>{a.full_name || '—'}</div>
                          <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>{roleLabel(a.role, lang)}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '13px 16px', color: 'var(--silver)', fontSize: '.85rem' }}>{a.email}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ padding: '4px 11px', borderRadius: 7, fontSize: '.78rem', fontWeight: 600, background: r.bg, color: r.color, border: `1px solid ${r.border}`, whiteSpace: 'nowrap' }}>{roleLabel(a.role, lang)}</span>
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      {isActive ? (
                        <span style={{ padding: '4px 11px', borderRadius: 7, fontSize: '.78rem', fontWeight: 600, background: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)' }}>● {tr(lang, 'am_badge_active')}</span>
                      ) : (
                        <span style={{ padding: '4px 11px', borderRadius: 7, fontSize: '.78rem', fontWeight: 600, background: 'rgba(232,35,42,.15)', color: '#ff6b6b', border: '1px solid rgba(232,35,42,.4)' }}>● {tr(lang, 'am_badge_inactive')}</span>
                      )}
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: '.82rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {a.last_login ? new Date(a.last_login).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      {a.last_login && <><br /><span style={{ fontSize: '.75rem' }}>{new Date(a.last_login).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></>}
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: '.82rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}<br />
                      <span style={{ fontSize: '.75rem' }}>{new Date(a.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                      <button title={tr(lang, 'am_tip_view')} onClick={() => setDetail(a)} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer', marginRight: 5 }}>👁</button>
                      <button title={tr(lang, 'am_tip_edit')} onClick={() => { setEditAdmin(a); setEditRole(a.role) }} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(245,185,66,.4)', background: 'rgba(245,185,66,.1)', color: '#f5b942', cursor: 'pointer', marginRight: 5 }}>✏️</button>
                      <button title={tr(lang, 'am_tip_delete')} onClick={() => remove(a)} disabled={busy === a.id} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer' }}>🗑</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>{tr(lang, 'am_empty_title')}</div>
            <div style={{ fontSize: '.85rem' }}>{tr(lang, 'am_empty_sub')}</div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>{tr(lang, 'am_loading')}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{tr(lang, 'am_showing')} {list.length === 0 ? 0 : (curPage - 1) * pageSize + 1} {tr(lang, 'am_to')} {Math.min(curPage * pageSize, list.length)} {tr(lang, 'am_of')} {list.length} {tr(lang, 'am_admins_word')}{selected.size > 0 ? ' · ' + selected.size + ' ' + tr(lang, 'am_selected') : ''}</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button onClick={() => setPage(1)} disabled={curPage <= 1} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: 'pointer', opacity: curPage <= 1 ? 0.4 : 1 }}>«</button>
            <button onClick={() => setPage(Math.max(1, curPage - 1))} disabled={curPage <= 1} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: 'pointer', opacity: curPage <= 1 ? 0.4 : 1 }}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - curPage) <= 1).map((p, idx, arr) => (
              <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {idx > 0 && p - arr[idx - 1] > 1 && <span style={{ color: 'var(--muted)', padding: '0 2px' }}>…</span>}
                <button onClick={() => setPage(p)} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: p === curPage ? '#e8232a' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: p === curPage ? 700 : 400 }}>{p}</button>
              </span>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, curPage + 1))} disabled={curPage >= totalPages} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: 'pointer', opacity: curPage >= totalPages ? 0.4 : 1 }}>›</button>
            <button onClick={() => setPage(totalPages)} disabled={curPage >= totalPages} style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: 'pointer', opacity: curPage >= totalPages ? 0.4 : 1 }}>»</button>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} style={{ marginLeft: 8, padding: '6px 8px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 7, color: '#fff', fontSize: '.82rem', cursor: 'pointer' }}>
              {[5, 10, 25, 50].map(n => <option key={n} value={n} style={{ background: '#1a0d0e' }}>{n} {tr(lang, 'am_per_page')}</option>)}
            </select>
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
              <div style={{ fontWeight: 700, color: '#fff' }}>{tr(lang, 'am_add_new')}</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'am_add_new_sub')}</div>
            </div>
          </div>
          <form onSubmit={createAdmin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>{tr(lang, 'am_full_name')}</label>
                <input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={tr(lang, 'am_ph_full_name')} />
              </div>
              <div>
                <label style={lbl}>{tr(lang, 'am_email')}</label>
                <input style={inp} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="admin@example.com" />
              </div>
            </div>
            <div>
              <label style={lbl}>{tr(lang, 'am_password')}</label>
              <div style={{ position: 'relative' }}>
                <input style={{ ...inp, paddingRight: 40 }} type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={tr(lang, 'am_ph_password')} />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16 }}>👁</button>
              </div>
              <small style={{ color: 'var(--muted)', fontSize: '.72rem' }}>{tr(lang, 'am_password_note')}</small>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>{tr(lang, 'am_role_label')}</label>
                <select value={form.role} onChange={e => { setForm({ ...form, role: e.target.value }); setSelectedRole(e.target.value); setPerms(ROLE_PERMISSIONS[e.target.value] || []) }} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="" style={{ background: '#1a0d0e' }}>{tr(lang, 'am_select_role')}</option>
                  {ROLES.map(r => <option key={r.id} value={r.id} style={{ background: '#1a0d0e' }}>{roleLabel(r.id, lang)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{tr(lang, 'am_status')}</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="Active" style={{ background: '#1a0d0e' }}>{tr(lang, 'am_active')}</option>
                  <option value="Inactive" style={{ background: '#1a0d0e' }}>{tr(lang, 'am_inactive')}</option>
                </select>
              </div>
            </div>
            <div>
              <label style={lbl}>{tr(lang, 'am_avatar_label')}</label>
              <input style={inp} value={form.avatar_url} onChange={e => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://…" />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={busy === 'create'} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: busy === 'create' ? 'not-allowed' : 'pointer', boxShadow: '0 4px 16px rgba(232,35,42,.35)', opacity: busy === 'create' ? 0.6 : 1 }}>
                {busy === 'create' ? tr(lang, 'am_creating') : tr(lang, 'am_create_admin')}
              </button>
              <button type="button" onClick={() => setForm({ name: '', email: '', password: '', role: '', status: 'Active', avatar_url: '' })} style={{ padding: '11px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>{tr(lang, 'am_reset')}</button>
            </div>
          </form>
        </div>

        {/* Available Roles */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 18 }}>🛡</div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>{tr(lang, 'am_roles_title')}</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'am_roles_sub')}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ROLES.map(r => (
              <button key={r.id} onClick={() => selectRoleCard(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', background: selectedRole === r.id ? 'rgba(232,35,42,.12)' : 'rgba(255,255,255,.03)', borderRadius: 10, border: selectedRole === r.id ? '1px solid rgba(232,35,42,.5)' : '1px solid rgba(255,255,255,.06)', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: r.bg, display: 'grid', placeItems: 'center', fontSize: 15, flexShrink: 0 }}>{r.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: r.color, fontSize: '.88rem' }}>{roleLabel(r.id, lang)}</div>
                  <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{roleDesc(r.id, lang)}</div>
                </div>
                <span style={{ color: 'var(--muted)' }}>›</span>
              </button>
            ))}
          </div>
        </div>

        {/* Permissions */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 18 }}>⚙️</div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>{tr(lang, 'am_perms_title')}</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'am_perms_sub')} {roleLabel(selectedRole, lang)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {PERMISSIONS.map(p => (
              <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '.88rem', color: '#fff' }}>
                <input type="checkbox" checked={perms.includes(p)} onChange={e => setPerms(e.target.checked ? [...perms, p] : perms.filter(x => x !== p))} style={{ width: 17, height: 17, accentColor: '#e8232a', cursor: 'pointer' }} />
                {permLabel(p, lang)}
              </label>
            ))}
          </div>
          <p style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: 14, marginBottom: 0 }}>{tr(lang, 'am_perms_note_a')}{roleLabel(selectedRole, lang)}{tr(lang, 'am_perms_note_b')}</p>
        </div>
      </div>

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setDetail(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 480, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{tr(lang, 'am_detail_title')}</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              {detail.avatar_url ? (
                <img src={detail.avatar_url} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: avatarColor(detail.full_name), display: 'grid', placeItems: 'center', color: '#fff', fontSize: '1rem', fontWeight: 700 }}>{initials(detail.full_name)}</div>
              )}
              <div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '1.05rem' }}>{detail.full_name || '—'}</div>
                <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{roleLabel(detail.role, lang)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '.9rem' }}>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'am_detail_email')} </span><b style={{ color: '#fff' }}>{detail.email}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'am_detail_admin_id')} </span><b style={{ color: '#fff' }}>{adminIdOf(detail)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'am_detail_role')} </span><b style={{ color: '#fff' }}>{roleLabel(detail.role, lang)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'am_detail_status')} </span><b style={{ color: detail.is_active !== false ? '#2ecc71' : '#ff6b6b' }}>{detail.is_active !== false ? tr(lang, 'am_active') : tr(lang, 'am_inactive')}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'am_detail_perms')} </span><span style={{ color: 'var(--silver)' }}>{(ROLE_PERMISSIONS[detail.role] || []).map(p => permLabel(p, lang)).join(', ')}</span></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'am_detail_last_login')} </span>{detail.last_login ? new Date(detail.last_login).toLocaleString('en-GB') : '—'}</div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'am_detail_joined')} </span>{new Date(detail.created_at).toLocaleString('en-GB')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editAdmin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setEditAdmin(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 440, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{tr(lang, 'am_edit_title')}</h3>
              <button onClick={() => setEditAdmin(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lbl}>{tr(lang, 'am_edit_name')}</label>
                <input value={editAdmin.full_name || ''} disabled style={{ ...inp, opacity: 0.6 }} />
                <small style={{ color: 'var(--muted)', fontSize: '.72rem' }}>{tr(lang, 'am_edit_name_note')}</small>
              </div>
              <div>
                <label style={lbl}>{tr(lang, 'am_edit_email')}</label>
                <input value={editAdmin.email || ''} disabled style={{ ...inp, opacity: 0.6 }} />
              </div>
              <div>
                <label style={lbl}>{tr(lang, 'am_edit_role')}</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                  {ROLES.map(r => <option key={r.id} value={r.id} style={{ background: '#1a0d0e' }}>{roleLabel(r.id, lang)}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={async () => { await changeRole(editAdmin, editRole); setEditAdmin(null) }} disabled={busy === editAdmin.id} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{tr(lang, 'am_save_changes')}</button>
                <button onClick={async () => { await deactivate(editAdmin); setEditAdmin(null) }} style={{ padding: '11px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>{editAdmin.is_active === false ? tr(lang, 'am_activate') : tr(lang, 'am_deactivate')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Roles & Permissions page ── */
export function RolesPermissions({ session }) {
  const { lang } = useLang()
  const [customRoles, setCustomRoles] = useState([])
  const [matrix, setMatrix] = useState({ ...ROLE_PERMISSIONS })
  const [savedMatrix, setSavedMatrix] = useState({ ...ROLE_PERMISSIONS })
  const [selectedRole, setSelectedRole] = useState('admin')
  const [selectedPerm, setSelectedPerm] = useState('Dashboard')
  const [newRole, setNewRole] = useState({ name: '', desc: '', status: 'Active', perms: ['Dashboard'] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [confirmSave, setConfirmSave] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const j = await adminApi(session, 'role.list', {})
      if (Array.isArray(j.custom_roles)) setCustomRoles(j.custom_roles)
      if (j.role_permissions && typeof j.role_permissions === 'object') {
        const merged = { ...ROLE_PERMISSIONS, ...j.role_permissions }
        merged.admin = PERMISSIONS // Super Admin always keeps everything
        setMatrix(merged)
        setSavedMatrix(merged)
      }
    } catch (e) { /* use defaults */ }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const allRoles = [
    ...ROLES.map(r => ({ id: r.id, label: roleLabel(r.id, lang), desc: roleDesc(r.id, lang), color: r.color, bg: r.bg, border: r.border, icon: r.icon, active: true, custom: false })),
    ...customRoles.map(cr => ({ id: cr.id, label: cr.label, desc: cr.desc, color: cr.color || '#8e44ad', bg: 'rgba(142,68,173,.12)', border: 'rgba(142,68,173,.4)', icon: '🔑', active: cr.active !== false, custom: true })),
  ]

  const totalPerms = PERMISSIONS.length
  const activeRoles = allRoles.filter(r => r.active).length
  const restrictedAccess = PERMISSIONS.filter(p => PERMISSION_META[p]?.sensitive).length
  const dirty = JSON.stringify(matrix) !== JSON.stringify(savedMatrix)

  const togglePerm = (roleId, perm) => {
    if (roleId === 'admin') return // Super Admin locked
    setMatrix(m => {
      const cur = m[roleId] || []
      const next = cur.includes(perm) ? cur.filter(x => x !== perm) : [...cur, perm]
      return { ...m, [roleId]: next }
    })
  }

  const saveChanges = async () => {
    setConfirmSave(false)
    setSaving(true)
    try {
      await adminApi(session, 'role.save', { role_permissions: matrix })
      setSavedMatrix({ ...matrix })
      alert('✅ ' + tr(lang, 'am_rp_saved'))
    } catch (e) { alert('❌ ' + e.message) }
    setSaving(false)
  }

  const createRole = async (e) => {
    e.preventDefault()
    const name = newRole.name.trim()
    const desc = newRole.desc.trim()
    if (!name) return alert(tr(lang, 'am_err_role_name'))
    if (!desc) return alert(tr(lang, 'am_err_desc'))
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (allRoles.some(r => r.id === id || (r.custom ? r.label.toLowerCase() === name.toLowerCase() : tr('en', ROLE_LABEL_KEY[r.id]).toLowerCase() === name.toLowerCase()))) return alert(tr(lang, 'am_err_role_exists'))
    setCreating(true)
    try {
      const next = [...customRoles, { id, label: name, desc, color: '#8e44ad', active: newRole.status === 'Active' }]
      await adminApi(session, 'role.save', { custom_roles: next, role_permissions: { ...matrix, [id]: newRole.perms } })
      setCustomRoles(next)
      setMatrix(m => ({ ...m, [id]: newRole.perms }))
      setSavedMatrix(m => ({ ...m, [id]: newRole.perms }))
      setNewRole({ name: '', desc: '', status: 'Active', perms: ['Dashboard'] })
      alert('✅ ' + tr(lang, 'am_role_created_a') + '"' + name + '" ' + tr(lang, 'am_role_created_b'))
    } catch (err) { alert('❌ ' + err.message) }
    setCreating(false)
  }

  const stats = [
    { label: tr(lang, 'am_rp_stat_roles'), value: allRoles.length, desc: tr(lang, 'am_rp_stat_roles_desc'), color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '🛡' },
    { label: tr(lang, 'am_rp_stat_perms'), value: totalPerms, desc: tr(lang, 'am_rp_stat_perms_desc'), color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '👥' },
    { label: tr(lang, 'am_rp_stat_active'), value: activeRoles, desc: tr(lang, 'am_rp_stat_active_desc'), color: '#2ecc71', bg: 'rgba(46,204,113,.15)', icon: '👤' },
    { label: tr(lang, 'am_rp_stat_restricted'), value: restrictedAccess, desc: tr(lang, 'am_rp_stat_restricted_desc'), color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '🔒' },
  ]

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

  const selRole = allRoles.find(r => r.id === selectedRole) || allRoles[0]
  const selPermMeta = PERMISSION_META[selectedPerm] || {}

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>⚙️</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>{tr(lang, 'am_rp_title')}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'am_rp_subtitle')}</p>
          </div>
        </div>
        <button onClick={() => document.getElementById('create-role-form')?.scrollIntoView({ behavior: 'smooth' })}
          style={{ padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>
          + {tr(lang, 'am_rp_create_btn')}
        </button>
      </div>

      {/* Stats */}
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

      {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>{tr(lang, 'am_loading')}</div>}
      {!loading && (
        <>
          {/* Roles + Create Role */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', gap: 16, alignItems: 'start', marginBottom: 16 }}>
            {/* Available Roles */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 18 }}>👥</div>
                <div>
                  <div style={{ fontWeight: 700, color: '#fff' }}>{tr(lang, 'am_rp_roles_title')}</div>
                  <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'am_rp_roles_sub')}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {allRoles.map(r => {
                  const access = r.id === 'admin' ? tr(lang, 'am_rp_access_all') : r.id === 'support' ? tr(lang, 'am_rp_access_support') : tr(lang, 'am_rp_access_assigned')
                  const isSel = selectedRole === r.id
                  return (
                    <button key={r.id} onClick={() => setSelectedRole(r.id)} style={{ textAlign: 'left', background: isSel ? 'rgba(232,35,42,.12)' : 'rgba(255,255,255,.03)', border: isSel ? '1px solid rgba(232,35,42,.6)' : '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: 14, cursor: 'pointer', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: r.bg, display: 'grid', placeItems: 'center', fontSize: 16, flexShrink: 0 }}>{r.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: r.color, fontSize: '.92rem' }}>{r.label}</div>
                        </div>
                        <span style={{ padding: '3px 9px', borderRadius: 7, fontSize: '.7rem', fontWeight: 600, background: r.active ? 'rgba(46,204,113,.15)' : 'rgba(255,255,255,.08)', color: r.active ? '#2ecc71' : 'var(--muted)', border: `1px solid ${r.active ? 'rgba(46,204,113,.4)' : 'rgba(255,255,255,.15)'}` }}>{r.active ? tr(lang, 'am_active') : tr(lang, 'am_inactive')}</span>
                      </div>
                      <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: 8 }}>{r.desc}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '.74rem', color: 'var(--silver)' }}>🔑 {tr(lang, 'am_rp_access_label')} {access}</span>
                        <span style={{ color: 'var(--muted)' }}>›</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Create New Role */}
            <div id="create-role-form" style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 18 }}>+</div>
                <div>
                  <div style={{ fontWeight: 700, color: '#fff' }}>{tr(lang, 'am_rp_new_title')}</div>
                  <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'am_rp_new_sub')}</div>
                </div>
              </div>
              <form onSubmit={createRole} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={lbl}>{tr(lang, 'am_rp_name')}</label>
                  <input style={inp} value={newRole.name} onChange={e => setNewRole({ ...newRole, name: e.target.value })} placeholder={tr(lang, 'am_rp_name_ph')} />
                </div>
                <div>
                  <label style={lbl}>{tr(lang, 'am_rp_desc')}</label>
                  <textarea style={{ ...inp, height: 70, padding: '10px 12px', resize: 'vertical' }} value={newRole.desc} onChange={e => setNewRole({ ...newRole, desc: e.target.value })} placeholder={tr(lang, 'am_rp_desc_ph')} />
                </div>
                <div>
                  <label style={lbl}>{tr(lang, 'am_rp_status')}</label>
                  <select value={newRole.status} onChange={e => setNewRole({ ...newRole, status: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                    <option value="Active" style={{ background: '#1a0d0e' }}>{tr(lang, 'am_active')}</option>
                    <option value="Inactive" style={{ background: '#1a0d0e' }}>{tr(lang, 'am_inactive')}</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>{tr(lang, 'am_rp_perms')}</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
                    {PERMISSIONS.map(p => (
                      <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: '.84rem', color: '#fff' }}>
                        <input type="checkbox" checked={newRole.perms.includes(p)} onChange={e => setNewRole({ ...newRole, perms: e.target.checked ? [...newRole.perms, p] : newRole.perms.filter(x => x !== p) })} style={{ width: 16, height: 16, accentColor: '#e8232a', cursor: 'pointer' }} />
                        {permLabel(p, lang)}
                      </label>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={creating} style={{ padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.6 : 1 }}>
                  {creating ? tr(lang, 'am_rp_creating') : '+ ' + tr(lang, 'am_rp_create')}
                </button>
                <button type="button" onClick={() => setNewRole({ name: '', desc: '', status: 'Active', perms: ['Dashboard'] })} style={{ padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>{tr(lang, 'am_reset')}</button>
              </form>
            </div>
          </div>

          {/* Permissions Matrix + Details */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 16, alignItems: 'start' }}>
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 18 }}>🛡</div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#fff' }}>{tr(lang, 'am_rp_matrix')}</div>
                    <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'am_rp_matrix_sub')}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {dirty && <span style={{ fontSize: '.78rem', color: '#f5b942' }}>● {tr(lang, 'am_rp_unsaved')}</span>}
                  <button onClick={() => setConfirmSave(true)} disabled={saving || !dirty} style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: dirty ? 'linear-gradient(135deg, #e8232a, #b01020)' : 'rgba(255,255,255,.08)', color: '#fff', fontWeight: 600, cursor: dirty ? 'pointer' : 'not-allowed', fontSize: '.85rem', opacity: dirty ? 1 : 0.5 }}>
                    {saving ? tr(lang, 'am_rp_saving') : tr(lang, 'am_save_changes')}
                  </button>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                      <th style={{ textAlign: 'left', padding: '11px 12px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>#</th>
                      <th style={{ textAlign: 'left', padding: '11px 12px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{tr(lang, 'am_rp_perm_module')}</th>
                      {allRoles.map(r => (
                        <th key={r.id} style={{ textAlign: 'center', padding: '11px 8px', fontSize: '.74rem', fontWeight: 600, color: r.color, whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{r.icon} {r.label}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSIONS.map((p, pi) => (
                      <tr key={p} onClick={() => setSelectedPerm(p)} style={{ borderBottom: '1px solid rgba(255,255,255,.05)', cursor: 'pointer', background: selectedPerm === p ? 'rgba(232,35,42,.08)' : 'transparent' }}>
                        <td style={{ padding: '11px 12px', color: 'var(--muted)', fontSize: '.82rem' }}>{pi + 1}</td>
                        <td style={{ padding: '11px 12px', fontSize: '.86rem', color: '#fff', fontWeight: 500, whiteSpace: 'nowrap' }}>{PERMISSION_META[p]?.icon} {permLabel(p, lang)}</td>
                        {allRoles.map(r => {
                          const on = (matrix[r.id] || []).includes(p)
                          const locked = r.id === 'admin'
                          return (
                            <td key={r.id} style={{ padding: '11px 8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                              <button
                                title={locked ? tr(lang, 'am_rp_locked_tip') : (on ? tr(lang, 'am_tt_disable_a') : tr(lang, 'am_tt_enable_a')) + permLabel(p, lang) + (on ? tr(lang, 'am_tt_disable_b') : tr(lang, 'am_tt_enable_b')) + r.label}
                                onClick={() => togglePerm(r.id, p)}
                                disabled={locked}
                                style={{
                                  width: 40, height: 22, borderRadius: 11, border: 'none', cursor: locked ? 'not-allowed' : 'pointer',
                                  background: on ? r.color : 'rgba(255,255,255,.12)', position: 'relative', transition: 'background .15s', opacity: locked ? 0.85 : 1,
                                }}
                              >
                                <span style={{
                                  position: 'absolute', top: 3, left: on ? 20 : 3, width: 16, height: 16,
                                  borderRadius: '50%', background: '#fff', transition: 'left .15s',
                                }} />
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: '.75rem', color: 'var(--muted)', margin: '12px 0 0' }}>{tr(lang, 'am_rp_matrix_note')}</p>
            </div>

            {/* Permission Details */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 18 }}>ℹ️</div>
                <div>
                  <div style={{ fontWeight: 700, color: '#fff' }}>{tr(lang, 'am_rp_detail_title')}</div>
                  <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'am_rp_detail_sub')}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px', background: 'rgba(255,255,255,.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,.06)', marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>{selPermMeta.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: '.95rem' }}>{permLabel(selectedPerm, lang)}</div>
                  <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>{selPermMeta.descKey ? tr(lang, selPermMeta.descKey) : ''}</div>
                </div>
                <span style={{ padding: '4px 9px', borderRadius: 7, fontSize: '.68rem', fontWeight: 600, background: selPermMeta.sensitive ? 'rgba(245,185,66,.15)' : 'rgba(46,204,113,.15)', color: selPermMeta.sensitive ? '#f5b942' : '#2ecc71', border: `1px solid ${selPermMeta.sensitive ? 'rgba(245,185,66,.4)' : 'rgba(46,204,113,.4)'}` }}>{selPermMeta.categoryKey ? tr(lang, selPermMeta.categoryKey) : ''}</span>
              </div>
              <div style={{ fontSize: '.85rem', fontWeight: 600, color: '#fff', marginBottom: 8 }}>{tr(lang, 'am_rp_included')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
                {(selPermMeta.actionKeys || []).map(a => (
                  <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.85rem', color: 'var(--silver)' }}>
                    <span style={{ color: '#2ecc71' }}>✓</span> {tr(lang, a)}
                  </div>
                ))}
              </div>
              {selPermMeta.sensitive && (
                <div style={{ padding: '11px 12px', background: 'rgba(245,185,66,.08)', border: '1px solid rgba(245,185,66,.3)', borderRadius: 10, fontSize: '.8rem', color: '#f5b942' }}>
                  {tr(lang, 'am_rp_sensitive_warn')}
                </div>
              )}
              {!selPermMeta.sensitive && (
                <div style={{ padding: '11px 12px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, fontSize: '.8rem', color: 'var(--muted)' }}>
                  {tr(lang, 'am_rp_overview_a')}{permLabel(selectedPerm, lang).toLowerCase()}{tr(lang, 'am_rp_overview_b')}
                </div>
              )}
            </div>
          </div>

          {/* Save Confirmation */}
          {confirmSave && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setConfirmSave(false)}>
              <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 440, width: '100%' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 10px', color: '#fff' }}>{tr(lang, 'am_rp_confirm_title')}</h3>
                <p style={{ color: 'var(--muted)', fontSize: '.88rem', margin: '0 0 18px' }}>
                  {tr(lang, 'am_rp_confirm_desc')}
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={saveChanges} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{tr(lang, 'am_rp_yes_save')}</button>
                  <button onClick={() => setConfirmSave(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>{tr(lang, 'am_cancel')}</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
