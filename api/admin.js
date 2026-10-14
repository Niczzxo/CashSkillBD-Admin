// Admin API — every action requires a valid Supabase access token belonging
// to a cashskillbd_profiles row with role admin (or support where noted).
const SUPABASE_URL = process.env.SUPABASE_URL
const SR_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const H = {
  apikey: SR_KEY,
  Authorization: `Bearer ${SR_KEY}`,
  'Content-Type': 'application/json',
}

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H })
  const t = await r.text()
  return { ok: r.ok, data: t ? JSON.parse(t) : null }
}

async function sbReq(path, method, body, prefer = 'return=representation') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method, headers: { ...H, Prefer: prefer },
    body: body ? JSON.stringify(body) : undefined,
  })
  const t = await r.text()
  return { ok: r.ok, status: r.status, data: t ? JSON.parse(t) : null }
}

async function caller(req) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return null
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SR_KEY, Authorization: `Bearer ${token}` },
  })
  if (!r.ok) return null
  const user = await r.json()
  const p = await sbGet(`cashskillbd_profiles?id=eq.${user.id}&select=id,role,email`)
  const profile = p.data?.[0]
  if (!profile || !['admin', 'finance', 'support'].includes(profile.role)) return null
  return { id: user.id, role: profile.role }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })
  const me = await caller(req)
  if (!me) return res.status(403).json({ error: 'forbidden' })

  const { action } = req.body || {}
  try {
    // ── verify a pending order: confirm payment + activate enrollment ──
    if (action === 'verify_order') {
      const { order_id } = req.body
      const o = await sbGet(`cashskillbd_orders?id=eq.${Number(order_id)}&select=*`)
      const order = o.data?.[0]
      if (!order) return res.status(404).json({ error: 'order not found' })
      await sbReq(`cashskillbd_orders?id=eq.${order.id}`, 'PATCH', { status: 'confirmed' })
      if (order.user_id && order.course_id) {
        // upsert enrollment -> active
        await sbReq('cashskillbd_enrollments?on_conflict=user_id,course_id', 'POST', {
          user_id: order.user_id, course_id: order.course_id,
          status: 'active', activated_at: new Date().toISOString(),
        }, 'resolution=merge-duplicates,return=representation')
      }
      return res.status(200).json({ ok: true })
    }

    // ── reject a pending order ──
    if (action === 'reject_order') {
      const { order_id } = req.body
      await sbReq(`cashskillbd_orders?id=eq.${Number(order_id)}`, 'PATCH', { status: 'rejected' })
      return res.status(200).json({ ok: true })
    }

    // ── set role (admin only) ──
    if (action === 'set_role') {
      if (me.role !== 'admin') return res.status(403).json({ error: 'admin only' })
      const { user_id, role } = req.body
      if (!['admin', 'finance', 'support', 'member'].includes(role)) return res.status(400).json({ error: 'bad role' })
      const u = await sbReq(`cashskillbd_profiles?id=eq.${user_id}`, 'PATCH', { role })
      if (!u.ok) return res.status(400).json({ error: 'profile not found' })
      return res.status(200).json({ ok: true })
    }

    // ── set role by email (admin only): teammate must have registered first ──
    if (action === 'set_role_by_email') {
      if (me.role !== 'admin') return res.status(403).json({ error: 'admin only' })
      const { email, role } = req.body
      if (!['admin', 'finance', 'support', 'member'].includes(role)) return res.status(400).json({ error: 'bad role' })
      const p = await sbGet(`cashskillbd_profiles?email=eq.${encodeURIComponent(email)}&select=id`)
      if (!p.data?.[0]) return res.status(404).json({ error: 'no account with this email — ask them to register first' })
      await sbReq(`cashskillbd_profiles?id=eq.${p.data[0].id}`, 'PATCH', { role })
      return res.status(200).json({ ok: true, added: true })
    }

    // ── roles & permissions (admin only) ──
    // Stored in cashskillbd_site_settings as JSON: custom_roles, role_permissions
    if (action === 'role.list') {
      if (me.role !== 'admin') return res.status(403).json({ error: 'admin only' })
      const r = await sbGet(`cashskillbd_site_settings?key=in.(custom_roles,role_permissions)&select=key,value`)
      const out = { custom_roles: [], role_permissions: {} }
      for (const row of (r.data || [])) {
        try {
          const parsed = JSON.parse(row.value)
          if (row.key === 'custom_roles' && Array.isArray(parsed)) out.custom_roles = parsed
          if (row.key === 'role_permissions' && parsed && typeof parsed === 'object') out.role_permissions = parsed
        } catch { /* ignore malformed */ }
      }
      return res.status(200).json(out)
    }
    if (action === 'role.save') {
      if (me.role !== 'admin') return res.status(403).json({ error: 'admin only' })
      const { custom_roles, role_permissions } = req.body || {}
      // Validate: custom_roles must be array of {id,label,desc,color,active}
      if (custom_roles !== undefined) {
        if (!Array.isArray(custom_roles)) return res.status(400).json({ error: 'custom_roles must be an array' })
        for (const cr of custom_roles) {
          if (!cr || typeof cr.id !== 'string' || !/^[a-z0-9_-]{2,30}$/.test(cr.id)) return res.status(400).json({ error: 'bad custom role id' })
          if (typeof cr.label !== 'string' || cr.label.trim().length < 2 || cr.label.trim().length > 40) return res.status(400).json({ error: 'bad custom role label' })
        }
        const ids = custom_roles.map(x => x.id)
        if (new Set(ids).size !== ids.length) return res.status(400).json({ error: 'duplicate role id' })
        if (ids.some(id => ['admin', 'manager', 'support', 'content', 'payment', 'finance', 'member'].includes(id))) return res.status(400).json({ error: 'role id conflicts with a built-in role' })
      }
      // Validate: role_permissions must be object roleId -> array of permission names
      if (role_permissions !== undefined) {
        if (!role_permissions || typeof role_permissions !== 'object' || Array.isArray(role_permissions)) return res.status(400).json({ error: 'role_permissions must be an object' })
        // Super Admin must keep all essential permissions
        const sa = role_permissions.admin
        if (sa !== undefined && (!Array.isArray(sa) || !sa.includes('Admin Management'))) return res.status(400).json({ error: 'Super Admin must keep Admin Management permission' })
        for (const [k, v] of Object.entries(role_permissions)) {
          if (!Array.isArray(v) || v.some(p => typeof p !== 'string' || p.length > 60)) return res.status(400).json({ error: 'bad permission list for ' + k })
        }
      }
      if (custom_roles !== undefined) {
        await sbReq('cashskillbd_site_settings?on_conflict=key', 'POST', { key: 'custom_roles', value: JSON.stringify(custom_roles), updated_by: me.id }, 'resolution=merge-duplicates,return=minimal')
      }
      if (role_permissions !== undefined) {
        await sbReq('cashskillbd_site_settings?on_conflict=key', 'POST', { key: 'role_permissions', value: JSON.stringify(role_permissions), updated_by: me.id }, 'resolution=merge-duplicates,return=minimal')
      }
      // Audit log
      await sbReq('cashskillbd_audit_logs', 'POST', { actor_id: me.id, action: 'role.save', entity_type: 'role', entity_id: null, old_values: null, new_values: { custom_roles: custom_roles || null, role_permissions: role_permissions || null } }, 'return=minimal')
      return res.status(200).json({ ok: true })
    }

    // ── support tickets ──
    if (action === 'list_tickets') {
      const { status } = req.body
      let q = `cashskillbd_support_tickets?select=*,profiles:cashskillbd_profiles!cashskillbd_support_tickets_user_id_fkey(email)&order=updated_at.desc`
      if (status) q += `&status=eq.${status}`
      const r = await sbGet(q)
      return res.status(200).json({ tickets: r.data || [] })
    }
    if (action === 'ticket_messages') {
      const { ticket_id } = req.body
      const r = await sbGet(`cashskillbd_ticket_messages?ticket_id=eq.${ticket_id}&order=created_at.asc`)
      return res.status(200).json({ messages: r.data || [] })
    }
    if (action === 'ticket_set_status') {
      const { ticket_id, status } = req.body
      if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) return res.status(400).json({ error: 'bad status' })
      await sbReq(`cashskillbd_support_tickets?id=eq.${ticket_id}`, 'PATCH', { status, updated_at: new Date().toISOString() })
      return res.status(200).json({ ok: true })
    }
    if (action === 'ticket_reply') {
      const { ticket_id, message } = req.body
      if (!message?.trim()) return res.status(400).json({ error: 'empty' })
      await sbReq('cashskillbd_ticket_messages', 'POST', {
        ticket_id, user_id: me.id, is_staff: true, message: message.slice(0, 2000),
      })
      await sbReq(`cashskillbd_support_tickets?id=eq.${ticket_id}`, 'PATCH', {
        status: 'in_progress', updated_at: new Date().toISOString(),
      })
      return res.status(200).json({ ok: true })
    }

    // ── contact inquiries ──
    if (action === 'list_inquiries') {
      const { status } = req.body
      let q = `cashskillbd_contact_inquiries?select=*&order=created_at.desc`
      if (status) q += `&status=eq.${status}`
      const r = await sbGet(q)
      return res.status(200).json({ inquiries: r.data || [] })
    }
    if (action === 'inquiry_set_status') {
      const { id, status } = req.body
      if (!['new', 'replied', 'closed'].includes(status)) return res.status(400).json({ error: 'bad status' })
      await sbReq(`cashskillbd_contact_inquiries?id=eq.${id}`, 'PATCH', { status })
      return res.status(200).json({ ok: true })
    }

    // ── seminar registrations (read-only) ──
    if (action === 'list_seminar_regs') {
      const r = await sbGet(`cashskillbd_seminar_regs?select=*&order=created_at.desc`)
      return res.status(200).json({ regs: r.data || [] })
    }

    if (action === 'add_seminar_reg') {
      const { name, mobile, email } = req.body || {}
      if (!name || !mobile) return res.status(400).json({ error: 'name and mobile required' })
      const r = await sbReq('cashskillbd_seminar_regs', 'POST', { name: name.trim(), mobile: mobile.trim(), email: (email || '').trim() || null })
      if (!r.ok) return res.status(500).json({ error: 'insert failed' })
      return res.status(200).json({ added: true })
    }

    if (action === 'delete_seminar_reg') {
      const { id } = req.body || {}
      if (!id) return res.status(400).json({ error: 'id required' })
      const r = await sbReq(`cashskillbd_seminar_regs?id=eq.${id}`, 'DELETE')
      if (!r.ok) return res.status(404).json({ error: 'not found' })
      return res.status(200).json({ deleted: true })
    }

    if (action === 'toggle_seminar_checkin') {
      const { id, checked_in } = req.body || {}
      if (!id) return res.status(400).json({ error: 'id required' })
      const r = await sbReq(`cashskillbd_seminar_regs?id=eq.${id}`, 'PATCH', { checked_in: !!checked_in })
      if (!r.ok) return res.status(400).json({ error: 'checked_in column may not exist' })
      return res.status(200).json({ updated: true })
    }

    return res.status(400).json({ error: 'unknown action' })
  } catch (e) {
    return res.status(500).json({ error: 'server error' })
  }
}
