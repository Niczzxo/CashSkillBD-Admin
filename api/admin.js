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
  let data = null
  try { data = t ? JSON.parse(t) : null } catch { data = t }
  return { ok: r.ok, data }
}

async function sbReq(path, method, body, prefer = 'return=representation') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method, headers: { ...H, Prefer: prefer },
    body: body ? JSON.stringify(body) : undefined,
  })
  const t = await r.text()
  let data = null
  try { data = t ? JSON.parse(t) : null } catch { data = t }
  return { ok: r.ok, status: r.status, data }
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

// PATCH an order, tolerating the delivery columns not existing yet
// (migration not run). Retries without the new columns instead of failing.
async function patchOrder(id, patch) {
  let r = await sbReq(`cashskillbd_orders?id=eq.${Number(id)}`, 'PATCH', patch)
  if (!r.ok) {
    const { delivery_status, assigned_to, delivery_updated_at, ...rest } = patch
    if (Object.keys(rest).length) r = await sbReq(`cashskillbd_orders?id=eq.${Number(id)}`, 'PATCH', rest)
  }
  return r
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
      await patchOrder(order.id, { status: 'confirmed', delivery_status: 'awaiting', delivery_updated_at: new Date().toISOString() })
      // Customer notification: order confirmed (best-effort — a missing
      // notifications table must never break the verify itself).
      if (order.user_id) {
        try {
          await sbReq('cashskillbd_notifications', 'POST', {
            user_id: order.user_id, order_id: order.id, type: 'order',
            title: 'Order confirmed',
            message: `Your order #CSK-${String(order.id).padStart(5, '0')} (${order.item_name || 'order'}) is confirmed. The admin will send the details to your account shortly.`,
          }, 'return=minimal')
        } catch { /* notifications table may not exist yet — ignore */ }
      }
      if (order.user_id && order.course_id) {
        // Activate course ONLY when identity verification is also approved
        let identityOk = true
        const v = await sbGet(`cashskillbd_identity_verifications?order_id=eq.${order.id}&select=status`)
        if (v.ok && v.data?.length) identityOk = v.data[0].status === 'approved'
        if (identityOk) {
          await sbReq('cashskillbd_enrollments?on_conflict=user_id,course_id', 'POST', {
            user_id: order.user_id, course_id: order.course_id,
            status: 'active', activated_at: new Date().toISOString(),
          }, 'resolution=merge-duplicates,return=representation')
        }
      }
      return res.status(200).json({ ok: true })
    }

    // ── reject a pending order ──
    if (action === 'reject_order') {
      const { order_id } = req.body
      await patchOrder(Number(order_id), { status: 'rejected', delivery_status: 'cancelled', delivery_updated_at: new Date().toISOString() })
      return res.status(200).json({ ok: true })
    }

    // ── send a message/details to the customer of an order ──
    // The message lands in the customer's account (public-site bell).
    if (action === 'notification.send') {
      if (!['admin', 'finance', 'support'].includes(me.role)) return res.status(403).json({ error: 'admin only' })
      const { order_id, message, title } = req.body || {}
      const msg = String(message || '').trim().slice(0, 1000)
      if (!msg) return res.status(400).json({ error: 'message required' })
      const o = await sbGet(`cashskillbd_orders?id=eq.${Number(order_id)}&select=id,user_id,item_name`)
      const order = o.data?.[0]
      if (!order) return res.status(404).json({ error: 'order not found' })
      if (!order.user_id) return res.status(400).json({ error: 'order has no account to notify (guest order)' })
      const r = await sbReq('cashskillbd_notifications', 'POST', {
        user_id: order.user_id, order_id: order.id, type: 'message',
        title: String(title || 'Message from CashSkillBD').slice(0, 120),
        message: msg,
      }, 'return=minimal')
      if (!r.ok) return res.status(500).json({ error: 'notification failed — run the notifications migration' })
      return res.status(200).json({ ok: true })
    }

    // ── course enrollments: list orders with identity verification ──
    if (action === 'enrollment.list') {
      if (!['admin', 'finance'].includes(me.role)) return res.status(403).json({ error: 'admin only' })
      const o = await sbGet(`cashskillbd_orders?course_id=not.is.null&order=created_at.desc&limit=200&select=*`)
      if (!o.ok) return res.status(500).json({ error: 'db error' })
      const orders = o.data || []
      const ids = orders.map(x => x.id).join(',')
      let verifications = []
      if (ids) {
        const v = await sbGet(`cashskillbd_identity_verifications?order_id=in.(${ids})&select=*`)
        if (v.ok) verifications = v.data || []
      }
      const vmap = {}
      for (const v of verifications) vmap[v.order_id] = v
      return res.status(200).json({ items: orders.map(o => ({ ...o, identity: vmap[o.id] || null })) })
    }

    // ── identity: signed URL for private document preview (admin only, 10 min) ──
    if (action === 'identity.signed_url') {
      if (!['admin', 'finance'].includes(me.role)) return res.status(403).json({ error: 'admin only' })
      const { path } = req.body || {}
      if (typeof path !== 'string' || !/^identity\/[0-9a-f-]{36}\/[0-9]+-(doc|selfie)\.[a-z0-9]{2,5}$/i.test(path)) return res.status(400).json({ error: 'bad path' })
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/cashskillbd-identity/${path}`, {
        method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 600 }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.signedURL) return res.status(500).json({ error: 'sign failed' })
      return res.status(200).json({ url: `${SUPABASE_URL}/storage/v1${j.signedURL}` })
    }

    // ── identity: approve — only activates course if payment already confirmed ──
    if (action === 'identity.approve') {
      if (!['admin', 'finance'].includes(me.role)) return res.status(403).json({ error: 'admin only' })
      const { order_id } = req.body || {}
      const v = await sbGet(`cashskillbd_identity_verifications?order_id=eq.${Number(order_id)}&select=*`)
      const ver = v.data?.[0]
      if (!ver) return res.status(404).json({ error: 'verification not found' })
      if (ver.status !== 'pending') return res.status(409).json({ error: 'already reviewed' })
      await sbReq(`cashskillbd_identity_verifications?id=eq.${ver.id}`, 'PATCH', { status: 'approved', reviewed_by: me.id, reviewed_at: new Date().toISOString() })
      await sbReq(`cashskillbd_orders?id=eq.${Number(order_id)}`, 'PATCH', { identity_status: 'approved' })
      // Activate course ONLY if payment confirmed
      const o = await sbGet(`cashskillbd_orders?id=eq.${Number(order_id)}&select=*`)
      const order = o.data?.[0]
      if (order && order.status === 'confirmed' && order.user_id && order.course_id) {
        await sbReq('cashskillbd_enrollments?on_conflict=user_id,course_id', 'POST', {
          user_id: order.user_id, course_id: order.course_id, status: 'active', activated_at: new Date().toISOString(),
        }, 'resolution=merge-duplicates,return=representation')
      }
      await sbReq('cashskillbd_audit_logs', 'POST', { actor_id: me.id, action: 'identity.approve', entity_type: 'order', entity_id: String(order_id), old_values: { status: 'pending' }, new_values: { status: 'approved' } }, 'return=minimal')
      return res.status(200).json({ ok: true })
    }

    // ── identity: reject — never activates course ──
    if (action === 'identity.reject') {
      if (!['admin', 'finance'].includes(me.role)) return res.status(403).json({ error: 'admin only' })
      const { order_id, reason } = req.body || {}
      if (!reason || !String(reason).trim()) return res.status(400).json({ error: 'rejection reason required' })
      const v = await sbGet(`cashskillbd_identity_verifications?order_id=eq.${Number(order_id)}&select=*`)
      const ver = v.data?.[0]
      if (!ver) return res.status(404).json({ error: 'verification not found' })
      if (ver.status !== 'pending') return res.status(409).json({ error: 'already reviewed' })
      await sbReq(`cashskillbd_identity_verifications?id=eq.${ver.id}`, 'PATCH', { status: 'rejected', reviewed_by: me.id, review_note: String(reason).slice(0, 500), reviewed_at: new Date().toISOString() })
      await sbReq(`cashskillbd_orders?id=eq.${Number(order_id)}`, 'PATCH', { identity_status: 'rejected' })
      await sbReq('cashskillbd_audit_logs', 'POST', { actor_id: me.id, action: 'identity.reject', entity_type: 'order', entity_id: String(order_id), old_values: { status: 'pending' }, new_values: { status: 'rejected', reason: String(reason).slice(0, 500) } }, 'return=minimal')
      return res.status(200).json({ ok: true })
    }

    // ── order: admin notes (append with author + timestamp, JSON array in admin_notes) ──
    if (action === 'order.notes') {
      if (!['admin', 'finance'].includes(me.role)) return res.status(403).json({ error: 'admin only' })
      const { order_id, notes } = req.body || {}
      const text = String(notes || '').trim().slice(0, 2000)
      if (!text) return res.status(400).json({ error: 'empty note' })
      const cur = await sbGet(`cashskillbd_orders?id=eq.${Number(order_id)}&select=admin_notes`)
      let arr = []
      const raw = cur.data?.[0]?.admin_notes
      if (raw) {
        try { const p = JSON.parse(raw); if (Array.isArray(p)) arr = p } catch { arr = [{ text: raw, by: 'Admin', at: null }] }
      }
      arr.push({ text, by: me.id, at: new Date().toISOString() })
      await sbReq(`cashskillbd_orders?id=eq.${Number(order_id)}`, 'PATCH', { admin_notes: JSON.stringify(arr) })
      await sbReq('cashskillbd_audit_logs', 'POST', { actor_id: me.id, action: 'order.note', entity_type: 'order', entity_id: String(order_id), old_values: null, new_values: { note: text } }, 'return=minimal')
      return res.status(200).json({ ok: true })
    }


    // ═══════════════════════════════════════════════════════════════════
    // Manual Delivery System (cashskillbd_deliveries). All delivery reads /
    // writes go through these actions with the service role — the table has
    // RLS with no public policies, so no client can read delivery payloads
    // (which may contain passwords) directly with the anon key.
    // Audit logs NEVER contain field values — only categories + field keys.
    // ═══════════════════════════════════════════════════════════════════
    const DELIVERY_CATEGORIES = ['vps', 'ip', 'number', 'dollar', 'course', 'other']
    const SECRET_FIELDS = new Set(['password', 'phone_number', 'payout_details'])

    // Canonical per-category field spec — server is authoritative; the admin
    // form mirrors this for UX validation, the server re-validates everything.
    const DELIVERY_FIELDS = {
      vps: {
        provider: { label: 'Provider / Datacenter', type: 'text', required: true },
        ip: { label: 'IP Address / Hostname', type: 'text', required: true },
        port: { label: 'Port', type: 'port', required: true },
        os: { label: 'Operating System', type: 'text', required: true },
        plan: { label: 'Plan / Specification', type: 'text', required: true },
        username: { label: 'Username', type: 'text', required: true },
        password: { label: 'Password', type: 'secret', required: true },
        expiry_date: { label: 'Expiry Date', type: 'date', required: true },
        billing_period: { label: 'Billing Period', type: 'select', required: true, options: ['1 Month', '3 Months', '6 Months', '1 Year'] },
        instructions: { label: 'Setup Instructions (customer-visible)', type: 'textarea', required: false },
        notes: { label: 'Delivery Notes (admin only)', type: 'textarea', required: false },
      },
      ip: {
        ip_type: { label: 'IP / Proxy Type', type: 'select', required: true, options: ['Residential', 'Datacenter', 'Mobile'] },
        country: { label: 'Country', type: 'text', required: true },
        region: { label: 'Region', type: 'text', required: false },
        isp: { label: 'ISP (only if verified)', type: 'text', required: false },
        host: { label: 'Host / IP Address', type: 'text', required: true },
        port: { label: 'Port', type: 'port', required: true },
        protocol: { label: 'Protocol', type: 'select', required: true, options: ['HTTP(S)', 'SOCKS5', 'HTTP+SOCKS5'] },
        username: { label: 'Username', type: 'text', required: true },
        password: { label: 'Password', type: 'secret', required: true },
        duration: { label: 'Service Duration', type: 'text', required: true },
        expiry_date: { label: 'Expiry Date', type: 'date', required: true },
        instructions: { label: 'Connection Instructions (customer-visible)', type: 'textarea', required: false },
        inventory_ref: { label: 'Internal Inventory Reference (admin only)', type: 'text', required: false },
        notes: { label: 'Delivery Notes (admin only)', type: 'textarea', required: false },
      },
      number: {
        country: { label: 'Country', type: 'text', required: true },
        phone_number: { label: 'Phone Number', type: 'text', required: true },
        platform: { label: 'Platform / Service', type: 'text', required: true },
        number_type: { label: 'Number Type', type: 'select', required: true, options: ['Non-VoIP', 'VoIP', 'SIM'] },
        activation_status: { label: 'Activation Status', type: 'select', required: true, options: ['Ready', 'Pending Activation'] },
        expiry_date: { label: 'Expiry Date', type: 'date', required: true },
        provider_ref: { label: 'Provider Reference (admin only)', type: 'text', required: false },
        instructions: { label: 'Customer Instructions (customer-visible)', type: 'textarea', required: false },
        notes: { label: 'Delivery Notes (admin only)', type: 'textarea', required: false },
      },
      dollar: {
        txn_type: { label: 'Transaction Type', type: 'select', required: true, options: ['Buy', 'Sell'] },
        currency: { label: 'Asset / Currency', type: 'select', required: true, options: ['USD', 'USDT', 'LTC'] },
        requested_amount: { label: 'Requested Amount', type: 'number', required: true, min: 0 },
        exchange_rate: { label: 'Exchange Rate (BDT per unit)', type: 'number', required: true, min: 0 },
        fee: { label: 'Fee (BDT)', type: 'number', required: true, min: 0 },
        payout_details: { label: "Customer's Payout / Payment Details", type: 'text', required: true },
        txn_ref: { label: 'Transaction Reference', type: 'text', required: false },
        transfer_ref: { label: 'Verified Transfer Reference', type: 'text', required: false },
        transfer_status: { label: 'Transfer Status', type: 'select', required: true, options: ['Pending', 'Completed', 'Verified'] },
        rate_timestamp: { label: 'Rate Timestamp', type: 'datetime', required: false },
        notes: { label: 'Transaction Notes (admin only)', type: 'textarea', required: false },
      },
      course: {
        course_title: { label: 'Course Title', type: 'text', required: true },
        enrollment_status: { label: 'Enrollment Status', type: 'select', required: true, options: ['Active', 'Pending'] },
        access_start: { label: 'Access Start Date', type: 'date', required: true },
        access_expiry: { label: 'Access Expiry Date', type: 'date', required: false },
        instructions: { label: 'Course Access Instructions (customer-visible)', type: 'textarea', required: false },
        customer_notes: { label: 'Customer-Visible Notes', type: 'textarea', required: false },
        admin_notes: { label: 'Admin Notes (admin only)', type: 'textarea', required: false },
      },
      other: {
        reference: { label: 'Delivery Reference', type: 'text', required: false },
        instructions: { label: 'Delivery Instructions (customer-visible)', type: 'textarea', required: false },
        notes: { label: 'Delivery Notes (admin only)', type: 'textarea', required: false },
      },
    }

    // Derive the delivery category from the order (server-side, never trust the client).
    const deriveCategory = (order) => {
      if (order.course_id) return 'course'
      const n = String(order.item_name || '').toLowerCase()
      if (/\b(buy|sell)\b/.test(n) || n.includes('dollar') || n.includes('usd') || n.includes('usdt')) return 'dollar'
      if (n.includes('vps') || n.includes('rdp') || n.includes('server')) return 'vps'
      if (n.includes('proxy') || /(^|[\s\-_])ip([\s\-_]|$)/.test(n)) return 'ip'
      if (n.includes('number') || n.includes('phone') || n.includes('virtual')) return 'number'
      return 'other'
    }

    // Validate + sanitize fields: only spec keys are stored, values are
    // trimmed and length-capped. Returns { payload, errors }.
    const validateDeliveryFields = (category, fields, enforceRequired) => {
      const spec = DELIVERY_FIELDS[category]
      const errors = []
      const payload = {}
      const input = (fields && typeof fields === 'object') ? fields : {}
      for (const [key, def] of Object.entries(spec)) {
        let v = input[key]
        if (typeof v === 'string') v = v.trim()
        if (v === '' || v === undefined || v === null) {
          if (def.required && enforceRequired) errors.push(`${def.label} is required`)
          continue
        }
        if (def.type === 'number') {
          const num = Number(v)
          if (!isFinite(num)) { errors.push(`${def.label} must be a number`); continue }
          if (def.min !== undefined && num < def.min) { errors.push(`${def.label} must be at least ${def.min}`); continue }
          payload[key] = num
        } else if (def.type === 'port') {
          const num = Number(v)
          if (!Number.isInteger(num) || num < 1 || num > 65535) { errors.push(`${def.label} must be a port 1–65535`); continue }
          payload[key] = num
        } else if (def.type === 'date' || def.type === 'datetime') {
          if (isNaN(Date.parse(String(v)))) { errors.push(`${def.label} must be a valid date`); continue }
          payload[key] = String(v).slice(0, 30)
        } else if (def.type === 'select') {
          if (!def.options.includes(v)) { errors.push(`${def.label} has an invalid value`); continue }
          payload[key] = String(v)
        } else {
          payload[key] = String(v).slice(0, def.type === 'textarea' ? 2000 : 500)
        }
      }
      return { payload, errors }
    }

    const auditDelivery = async (actionName, orderId, extra) =>
      sbReq('cashskillbd_audit_logs', 'POST', {
        actor_id: me.id, action: actionName, entity_type: 'order', entity_id: String(orderId),
        old_values: null, new_values: extra,
      }, 'return=minimal')

    const deliveryTableMissing = (r) => !r.ok
    const MIGRATION_ERR = 'delivery tables not installed — run supabase/migrations/2026-10-15-delivery-system.sql'

    // ── delivery: list (no payload — no secrets leave the server in a list) ──
    if (action === 'delivery.list') {
      const r = await sbGet('cashskillbd_deliveries?select=id,order_id,category,status,failure_reason,delivered_by,delivered_at,created_at,updated_at&order=created_at.desc&limit=500')
      if (deliveryTableMissing(r)) return res.status(500).json({ error: MIGRATION_ERR })
      return res.status(200).json({ items: r.data || [] })
    }

    // ── delivery: full record for one order (admin/finance only — payload may contain credentials) ──
    if (action === 'delivery.get') {
      if (!['admin', 'finance'].includes(me.role)) return res.status(403).json({ error: 'admin only' })
      const { order_id } = req.body || {}
      const o = await sbGet(`cashskillbd_orders?id=eq.${Number(order_id)}&select=*`)
      if (!o.data?.[0]) return res.status(404).json({ error: 'order not found' })
      const d = await sbGet(`cashskillbd_deliveries?order_id=eq.${Number(order_id)}&select=*&order=created_at.desc`)
      if (deliveryTableMissing(d)) return res.status(500).json({ error: MIGRATION_ERR })
      return res.status(200).json({ order: o.data[0], deliveries: d.data || [] })
    }

    // ── delivery: operator opens the order → processing + assignment ──
    if (action === 'delivery.start') {
      const { order_id } = req.body || {}
      const o = await sbGet(`cashskillbd_orders?id=eq.${Number(order_id)}&select=*`)
      const order = o.data?.[0]
      if (!order) return res.status(404).json({ error: 'order not found' })
      if (order.status !== 'confirmed') return res.status(409).json({ error: 'payment not verified yet' })
      if (order.delivery_status === 'delivered') return res.status(409).json({ error: 'order already delivered' })
      if (order.delivery_status === 'cancelled') return res.status(409).json({ error: 'order cancelled' })
      await patchOrder(order.id, { delivery_status: 'processing', assigned_to: me.id, delivery_updated_at: new Date().toISOString() })
      await auditDelivery('delivery.start', order.id, { delivery_status: 'processing', assigned_to: me.id })
      return res.status(200).json({ ok: true })
    }

    // ── delivery: save draft or submit delivery (admin/finance only) ──
    if (action === 'delivery.submit') {
      if (!['admin', 'finance'].includes(me.role)) return res.status(403).json({ error: 'admin only' })
      const { order_id, fields, mode } = req.body || {}
      if (mode !== 'draft' && mode !== 'deliver') return res.status(400).json({ error: 'mode must be draft or deliver' })
      const o = await sbGet(`cashskillbd_orders?id=eq.${Number(order_id)}&select=*`)
      const order = o.data?.[0]
      if (!order) return res.status(404).json({ error: 'order not found' })
      if (order.status !== 'confirmed') return res.status(409).json({ error: 'payment not verified yet — verify payment first' })
      if (order.delivery_status === 'cancelled') return res.status(409).json({ error: 'order cancelled' })
      const category = deriveCategory(order)
      const { payload, errors } = validateDeliveryFields(category, fields, mode === 'deliver')
      if (errors.length) return res.status(400).json({ error: errors.join('; ') })
      // Dollar: the server computes the final amount — never trust the browser.
      if (category === 'dollar' && mode === 'deliver') {
        payload.final_amount = Math.round((Number(payload.requested_amount || 0) * Number(payload.exchange_rate || 0) - Number(payload.fee || 0)) * 100) / 100
      }
      // Course: identity must be approved before access is granted.
      if (category === 'course' && mode === 'deliver') {
        const v = await sbGet(`cashskillbd_identity_verifications?order_id=eq.${order.id}&select=status`)
        if (v.ok && v.data?.length && v.data[0].status !== 'approved') {
          return res.status(409).json({ error: 'identity verification not approved yet' })
        }
      }
      const now = new Date().toISOString()
      const existing = await sbGet(`cashskillbd_deliveries?order_id=eq.${order.id}&select=*&order=created_at.desc`)
      if (deliveryTableMissing(existing)) return res.status(500).json({ error: MIGRATION_ERR })
      const delivered = (existing.data || []).find(d => d.status === 'delivered')
      if (delivered) {
        // Idempotent repair: delivery exists but the order row is stale.
        if (order.delivery_status !== 'delivered') {
          await patchOrder(order.id, { delivery_status: 'delivered', delivery_updated_at: now })
          return res.status(200).json({ ok: true, repaired: true })
        }
        return res.status(409).json({ error: 'order already delivered — use Correct Delivery to replace it' })
      }
      const draft = (existing.data || []).find(d => d.status === 'draft')
      const targetStatus = mode === 'deliver' ? 'delivered' : 'draft'
      if (draft) {
        const upd = await sbReq(`cashskillbd_deliveries?id=eq.${draft.id}`, 'PATCH', {
          payload, status: targetStatus, updated_at: now,
          delivered_by: mode === 'deliver' ? me.id : draft.delivered_by,
          delivered_at: mode === 'deliver' ? now : draft.delivered_at,
        })
        if (!upd.ok) return res.status(500).json({ error: 'delivery save failed' })
      } else {
        const ins = await sbReq('cashskillbd_deliveries', 'POST', {
          order_id: order.id, category, payload, status: targetStatus,
          delivered_by: mode === 'deliver' ? me.id : null,
          delivered_at: mode === 'deliver' ? now : null,
        })
        if (!ins.ok) return res.status(500).json({ error: 'delivery save failed' })
      }
      // Order row is updated ONLY after the delivery record is saved.
      await patchOrder(order.id, {
        delivery_status: mode === 'deliver' ? 'delivered' : 'processing',
        delivery_updated_at: now,
      })
      if (category === 'course' && mode === 'deliver' && payload.enrollment_status === 'Active' && order.user_id && order.course_id) {
        await sbReq('cashskillbd_enrollments?on_conflict=user_id,course_id', 'POST', {
          user_id: order.user_id, course_id: order.course_id, status: 'active', activated_at: now,
        }, 'resolution=merge-duplicates,return=representation')
      }
      await auditDelivery('delivery.submit', order.id, { category, mode, fields: Object.keys(payload) })
      return res.status(200).json({ ok: true, category })
    }

    // ── delivery: record a failure (admin/finance only) ──
    if (action === 'delivery.fail') {
      if (!['admin', 'finance'].includes(me.role)) return res.status(403).json({ error: 'admin only' })
      const { order_id, reason } = req.body || {}
      const text = String(reason || '').trim().slice(0, 500)
      if (!text) return res.status(400).json({ error: 'failure reason required' })
      const o = await sbGet(`cashskillbd_orders?id=eq.${Number(order_id)}&select=*`)
      const order = o.data?.[0]
      if (!order) return res.status(404).json({ error: 'order not found' })
      if (order.status !== 'confirmed') return res.status(409).json({ error: 'payment not verified yet' })
      if (order.delivery_status === 'delivered') return res.status(409).json({ error: 'order already delivered' })
      if (order.delivery_status === 'cancelled') return res.status(409).json({ error: 'order cancelled' })
      const cat = deriveCategory(order)
      const ins = await sbReq('cashskillbd_deliveries', 'POST', {
        order_id: order.id, category: cat, payload: {}, status: 'failed',
        failure_reason: text, delivered_by: me.id,
      })
      if (!ins.ok) return res.status(500).json({ error: MIGRATION_ERR })
      await patchOrder(order.id, { delivery_status: 'failed', delivery_updated_at: new Date().toISOString() })
      await auditDelivery('delivery.fail', order.id, { category: cat, reason: text })
      return res.status(200).json({ ok: true })
    }

    // ── delivery: correct/replace a delivered delivery (history preserved) ──
    if (action === 'delivery.correct') {
      if (!['admin', 'finance'].includes(me.role)) return res.status(403).json({ error: 'admin only' })
      const { order_id, fields, reason } = req.body || {}
      const text = String(reason || '').trim().slice(0, 500)
      if (!text) return res.status(400).json({ error: 'correction reason required' })
      const o = await sbGet(`cashskillbd_orders?id=eq.${Number(order_id)}&select=*`)
      const order = o.data?.[0]
      if (!order) return res.status(404).json({ error: 'order not found' })
      const category = deriveCategory(order)
      const { payload, errors } = validateDeliveryFields(category, fields, true)
      if (errors.length) return res.status(400).json({ error: errors.join('; ') })
      if (category === 'dollar') {
        payload.final_amount = Math.round((Number(payload.requested_amount || 0) * Number(payload.exchange_rate || 0) - Number(payload.fee || 0)) * 100) / 100
      }
      const existing = await sbGet(`cashskillbd_deliveries?order_id=eq.${order.id}&select=*&order=created_at.desc`)
      if (deliveryTableMissing(existing)) return res.status(500).json({ error: MIGRATION_ERR })
      const delivered = (existing.data || []).find(d => d.status === 'delivered')
      if (!delivered) return res.status(409).json({ error: 'nothing delivered to correct yet' })
      const now = new Date().toISOString()
      await sbReq(`cashskillbd_deliveries?id=eq.${delivered.id}`, 'PATCH', { status: 'superseded', updated_at: now })
      const ins = await sbReq('cashskillbd_deliveries', 'POST', {
        order_id: order.id, category, payload, status: 'delivered',
        correction_of: delivered.id, correction_reason: text,
        delivered_by: me.id, delivered_at: now,
      })
      if (!ins.ok) {
        // Roll back the supersede — never leave an order with no delivered record.
        await sbReq(`cashskillbd_deliveries?id=eq.${delivered.id}`, 'PATCH', { status: 'delivered', updated_at: now })
        return res.status(500).json({ error: 'correction save failed' })
      }
      await patchOrder(order.id, { delivery_status: 'delivered', delivery_updated_at: now })
      await auditDelivery('delivery.correct', order.id, { category, reason: text, fields: Object.keys(payload), replaces: delivered.id })
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
      const u = await sbReq(`cashskillbd_support_tickets?id=eq.${ticket_id}`, 'PATCH', { status, updated_at: new Date().toISOString() })
      if (!u.ok) return res.status(500).json({ error: 'ticket update failed' })
      return res.status(200).json({ ok: true })
    }
    if (action === 'ticket_reply') {
      const { ticket_id, message } = req.body
      if (!message?.trim()) return res.status(400).json({ error: 'empty' })
      const m = await sbReq('cashskillbd_ticket_messages', 'POST', {
        ticket_id, user_id: me.id, is_staff: true, message: message.slice(0, 2000),
      })
      if (!m.ok) return res.status(500).json({ error: 'reply failed' })
      const u = await sbReq(`cashskillbd_support_tickets?id=eq.${ticket_id}`, 'PATCH', {
        status: 'in_progress', updated_at: new Date().toISOString(),
      })
      if (!u.ok) return res.status(500).json({ error: 'ticket update failed' })
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
      const u = await sbReq(`cashskillbd_contact_inquiries?id=eq.${id}`, 'PATCH', { status })
      if (!u.ok) return res.status(500).json({ error: 'inquiry update failed' })
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
