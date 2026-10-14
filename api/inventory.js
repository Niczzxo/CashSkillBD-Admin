// ═══════════════════════════════════════════════════════════════════
// CashSkillBD — Product & Service Management API
// Every action requires a Supabase access token for a cashskillbd_profiles
// row. Role matrix:
//   admin   : everything
//   finance : products/prices, suppliers, purchases, stock, dollar, expenses,
//             reports, refunds — everything except team role management
//   support : read all; create sales orders; update delivery status;
//             manage service lifecycle (no prices, no dollar, no refunds)
// Service-role key stays server-side; never exposed to the browser.
// Money: NUMERIC in DB; integer minor-unit math in JS (no float drift).
// ═══════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL
const SR_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const H = {
  apikey: SR_KEY,
  Authorization: `Bearer ${SR_KEY}`,
  'Content-Type': 'application/json',
}

// ── Supabase REST helpers ─────────────────────────────────────────────
async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H })
  const t = await r.text()
  return { ok: r.ok, status: r.status, data: t ? JSON.parse(t) : null }
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
async function sbRpc(fn, args) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: H, body: JSON.stringify(args),
  })
  const t = await r.text()
  let data = null
  try { data = t ? JSON.parse(t) : null } catch { data = t }
  return { ok: r.ok, status: r.status, data, raw: t }
}

// ── Auth ──────────────────────────────────────────────────────────────
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
  return { id: user.id, role: profile.role, email: profile.email }
}
const canFinance = me => ['admin', 'finance'].includes(me.role)

// ── Money: integer minor-unit math (amounts: 2dp, rates: 4dp) ──────────
const C2 = n => Math.round(Number(n) * 100)            // → cents/poisha
const F2 = c => Number((c / 100).toFixed(2))           // cents → amount
const C4 = n => Math.round(Number(n) * 10000)         // → rate * 10000
const F4 = c => Number((c / 10000).toFixed(4))
const isMoney = n => Number.isFinite(Number(n)) && Number(n) >= 0

// ── Validation helpers ────────────────────────────────────────────────
const s = v => (typeof v === 'string' ? v.trim() : '')
const reqStr = (v, max = 500) => {
  const t = s(v)
  if (!t || t.length > max) throw new Error('invalid text field')
  return t
}
const optStr = (v, max = 2000) => {
  if (v === undefined || v === null || v === '') return null
  const t = s(v)
  if (t.length > max) throw new Error('text too long')
  return t || null
}
const reqInt = (v, min = 0, max = 1000000000) => {
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) throw new Error('invalid integer')
  return n
}
const oneOf = (v, list) => {
  if (!list.includes(v)) throw new Error('invalid value: ' + v)
  return v
}
const pg = b => {
  const limit = Math.min(Math.max(Number(b.limit) || 20, 1), 100)
  const offset = Math.max(Number(b.offset) || 0, 0)
  return { limit, offset }
}
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

// ── Audit ─────────────────────────────────────────────────────────────
async function audit(actorId, action, entityType, entityId, oldV, newV) {
  try {
    await sbReq('cashskillbd_audit_logs', 'POST', {
      actor_id: actorId, action, entity_type: entityType,
      entity_id: entityId != null ? String(entityId) : null,
      old_values: oldV || null, new_values: newV || null,
    }, 'return=minimal')
  } catch { /* audit must never break the operation */ }
}

const ok = (res, data) => res.status(200).json(data)
const bad = (res, code, msg) => res.status(code).json({ error: msg })

// ═══════════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return bad(res, 405, 'method not allowed')
    const me = await caller(req)
    if (!me) return bad(res, 403, 'forbidden')
    const b = req.body || {}
    const { action } = b
    const finance = canFinance(me)

  try {
    // ═══ PRODUCTS ═══════════════════════════════════════════════════
    if (action === 'product.list') {
      const { limit, offset } = pg(b)
      let q = `cashskillbd_products?select=*,cashskillbd_suppliers(name)&order=updated_at.desc&limit=${limit}&offset=${offset}`
      if (b.search) q += `&or=(name.ilike.*${encodeURIComponent(b.search)}*,sku.ilike.*${encodeURIComponent(b.search)}*)`
      if (b.status) q += `&status=eq.${oneOf(b.status, ['active','inactive','out_of_stock','archived'])}`
      if (b.category) q += `&category=eq.${encodeURIComponent(s(b.category))}`
      if (b.product_type) q += `&product_type=eq.${oneOf(b.product_type, ['physical','service','ip','vps','number','course'])}`
      const r = await sbGet(q)
      if (!r.ok) throw new Error('db error')
      return ok(res, { items: r.data })
    }

    if (action === 'product.get') {
      const r = await sbGet(`cashskillbd_products?id=eq.${reqInt(b.id, 1)}&select=*,cashskillbd_suppliers(name)`)
      if (!r.ok || !r.data?.[0]) return bad(res, 404, 'not found')
      return ok(res, { item: r.data[0] })
    }

    if (action === 'product.create') {
      if (!finance) return bad(res, 403, 'finance role required')
      const sku = s(b.sku) || ('SKU-' + Date.now().toString(36).toUpperCase())
      const row = {
        sku,
        name: reqStr(b.name, 200),
        description: optStr(b.description),
        category: s(b.category) || 'general',
        product_type: oneOf(b.product_type || 'physical', ['physical','service','ip','vps','number','course']),
        supplier_id: b.supplier_id ? reqInt(b.supplier_id, 1) : null,
        purchase_cost: F2(C2(b.purchase_cost || 0)),
        selling_price: F2(C2(b.selling_price || 0)),
        currency: oneOf(b.currency || 'BDT', ['BDT','USD']),
        stock_qty: reqInt(b.stock_qty || 0),
        low_stock_at: b.low_stock_at !== undefined ? reqInt(b.low_stock_at) : 5,
        image_url: optStr(b.image_url, 1000),
        service_duration_days: b.service_duration_days ? reqInt(b.service_duration_days, 1, 3650) : null,
        status: oneOf(b.status || 'active', ['active','inactive']),
        is_popular: b.is_popular === true,
        sort_order: b.sort_order !== undefined ? reqInt(b.sort_order, 0, 9999) : 0,
        specs: b.specs && typeof b.specs === 'object' ? b.specs : {},
        billing_cycle: oneOf(b.billing_cycle || 'monthly', ['hourly','monthly','3months','6months','yearly']),
        order_button_label: optStr(b.order_button_label, 100),
        created_by: me.id,
      }
      if (!isMoney(row.purchase_cost) || !isMoney(row.selling_price)) throw new Error('invalid money')
      const r = await sbReq('cashskillbd_products', 'POST', row)
      if (!r.ok) {
        const msg = JSON.stringify(r.data)
        if (msg.includes('duplicate') || msg.includes('unique')) return bad(res, 409, 'SKU already exists')
        throw new Error('db error')
      }
      const item = r.data[0]
      await audit(me.id, 'product.create', 'product', item.id, null, { sku, name: row.name, price: row.selling_price })
      return ok(res, { item })
    }

    if (action === 'product.update') {
      if (!finance) return bad(res, 403, 'finance role required')
      const id = reqInt(b.id, 1)
      const cur = await sbGet(`cashskillbd_products?id=eq.${id}&select=*`)
      if (!cur.ok || !cur.data?.[0]) return bad(res, 404, 'not found')
      const old = cur.data[0]
      const patch = {}
      if (b.name !== undefined) patch.name = reqStr(b.name, 200)
      if (b.description !== undefined) patch.description = optStr(b.description)
      if (b.category !== undefined) patch.category = s(b.category) || 'general'
      if (b.supplier_id !== undefined) patch.supplier_id = b.supplier_id ? reqInt(b.supplier_id, 1) : null
      if (b.purchase_cost !== undefined) {
        if (!isMoney(b.purchase_cost)) throw new Error('invalid money')
        patch.purchase_cost = F2(C2(b.purchase_cost))
      }
      if (b.selling_price !== undefined) {
        if (!isMoney(b.selling_price)) throw new Error('invalid money')
        patch.selling_price = F2(C2(b.selling_price))
      }
      if (b.low_stock_at !== undefined) patch.low_stock_at = reqInt(b.low_stock_at)
      if (b.image_url !== undefined) patch.image_url = optStr(b.image_url, 1000)
      if (b.service_duration_days !== undefined)
        patch.service_duration_days = b.service_duration_days ? reqInt(b.service_duration_days, 1, 3650) : null
      if (b.status !== undefined) patch.status = oneOf(b.status, ['active','inactive'])
      if (b.is_popular !== undefined) patch.is_popular = b.is_popular === true
      if (b.sort_order !== undefined) patch.sort_order = reqInt(b.sort_order, 0, 9999)
      if (b.specs !== undefined && typeof b.specs === 'object') patch.specs = b.specs
      if (b.billing_cycle !== undefined) patch.billing_cycle = oneOf(b.billing_cycle, ['hourly','monthly','3months','6months','yearly'])
      if (b.order_button_label !== undefined) patch.order_button_label = optStr(b.order_button_label, 100)
      if (b.currency !== undefined) patch.currency = oneOf(b.currency, ['BDT','USD'])
      if (Object.keys(patch).length === 0) return bad(res, 400, 'nothing to update')
      const r = await sbReq(`cashskillbd_products?id=eq.${id}`, 'PATCH', patch)
      if (!r.ok) throw new Error('db error')
      // price history (append-only log)
      if (patch.selling_price !== undefined || patch.purchase_cost !== undefined) {
        await sbReq('cashskillbd_price_history', 'POST', {
          product_id: id,
          old_price: old.selling_price, new_price: patch.selling_price ?? old.selling_price,
          old_cost: old.purchase_cost, new_cost: patch.purchase_cost ?? old.purchase_cost,
          currency: old.currency, changed_by: me.id,
        }, 'return=minimal')
      }
      await audit(me.id, 'product.update', 'product', id, old, patch)
      return ok(res, { item: r.data[0] })
    }

    if (action === 'product.delete') {
      if (!finance) return bad(res, 403, 'finance role required')
      const id = reqInt(b.id, 1)
      const r = await sbReq(`cashskillbd_products?id=eq.${id}`, 'DELETE')
      if (!r.ok) return bad(res, 404, 'not found')
      await audit(me.id, 'product.delete', 'product', id, null, {})
      return ok(res, { deleted: true })
    }

    if (action === 'product.set_status') {
      if (!finance) return bad(res, 403, 'finance role required')
      const id = reqInt(b.id, 1)
      const status = oneOf(b.status, ['active', 'inactive', 'archived'])
      const r = await sbReq(`cashskillbd_products?id=eq.${id}`, 'PATCH', { status })
      if (!r.ok || !r.data?.[0]) return bad(res, 404, 'not found')
      await audit(me.id, 'product.status', 'product', id, null, { status })
      return ok(res, { item: r.data[0] })
    }

    if (action === 'product.adjust_stock') {
      if (!finance) return bad(res, 403, 'finance role required')
      const id = reqInt(b.id, 1)
      const qtyChange = reqInt(Math.abs(b.qty_change || 0), 1)
      const dir = b.direction === 'out' ? -1 : 1
      const reason = oneOf(b.reason || 'adjustment', ['adjustment', 'return'])
      const r = await sbRpc('cashskillbd_adjust_stock', {
        p_product_id: id, p_qty_change: dir * qtyChange,
        p_reason: reason, p_notes: optStr(b.notes, 500), p_created_by: me.id,
      })
      if (!r.ok) return bad(res, 400, 'adjustment failed (would go negative?)')
      await audit(me.id, 'stock.adjust', 'product', id, null, { qty_change: dir * qtyChange, reason })
      return ok(res, { new_qty: r.data })
    }

    if (action === 'price.history') {
      const r = await sbGet(`cashskillbd_price_history?product_id=eq.${reqInt(b.product_id, 1)}&order=changed_at.desc&limit=50`)
      if (!r.ok) throw new Error('db error')
      return ok(res, { items: r.data })
    }

    if (action === 'price.history_all') {
      const { limit, offset } = pg(b)
      const r = await sbGet(`cashskillbd_price_history?select=*,cashskillbd_products(name,sku,category)&order=changed_at.desc&limit=${limit}&offset=${offset}`)
      if (!r.ok) throw new Error('db error')
      return ok(res, { items: r.data })
    }

    if (action === 'stock.movements') {
      const { limit, offset } = pg(b)
      let q = `cashskillbd_stock_movements?select=*,cashskillbd_products(name,sku)&order=created_at.desc&limit=${limit}&offset=${offset}`
      if (b.product_id) q += `&product_id=eq.${reqInt(b.product_id, 1)}`
      const r = await sbGet(q)
      if (!r.ok) throw new Error('db error')
      return ok(res, { items: r.data })
    }

    // ═══ SUPPLIERS ══════════════════════════════════════════════════
    if (action === 'supplier.list') {
      const r = await sbGet('cashskillbd_suppliers?select=*&order=name.asc')
      if (!r.ok) throw new Error('db error')
      return ok(res, { items: r.data })
    }
    if (action === 'supplier.create') {
      if (!finance) return bad(res, 403, 'finance role required')
      const r = await sbReq('cashskillbd_suppliers', 'POST', {
        name: reqStr(b.name, 200), contact: optStr(b.contact, 200),
        notes: optStr(b.notes), created_by: me.id,
      })
      if (!r.ok) throw new Error('db error')
      await audit(me.id, 'supplier.create', 'supplier', r.data[0].id, null, { name: b.name })
      return ok(res, { item: r.data[0] })
    }
    if (action === 'supplier.update') {
      if (!finance) return bad(res, 403, 'finance role required')
      const id = reqInt(b.id, 1)
      const patch = {}
      if (b.name !== undefined) patch.name = reqStr(b.name, 200)
      if (b.contact !== undefined) patch.contact = optStr(b.contact, 200)
      if (b.notes !== undefined) patch.notes = optStr(b.notes)
      const r = await sbReq(`cashskillbd_suppliers?id=eq.${id}`, 'PATCH', patch)
      if (!r.ok || !r.data?.[0]) return bad(res, 404, 'not found')
      return ok(res, { item: r.data[0] })
    }

    // ═══ PURCHASES (stock in, atomic) ═══════════════════════════════
    if (action === 'purchase.record') {
      if (!finance) return bad(res, 403, 'finance role required')
      const product_id = reqInt(b.product_id, 1)
      const qty = reqInt(b.qty, 1)
      if (!isMoney(b.unit_cost)) throw new Error('invalid money')
      const unit_cost = F2(C2(b.unit_cost))
      const currency = oneOf(b.currency || 'BDT', ['BDT', 'USD'])
      const supplier_id = b.supplier_id ? reqInt(b.supplier_id, 1) : null
      const r = await sbRpc('cashskillbd_record_purchase', {
        p_supplier_id: supplier_id, p_product_id: product_id, p_qty: qty,
        p_unit_cost: unit_cost, p_currency: currency, p_created_by: me.id,
      })
      if (!r.ok) return bad(res, 400, 'purchase failed')
      await audit(me.id, 'purchase.record', 'purchase', r.data, null,
        { product_id, qty, unit_cost, currency })
      return ok(res, { id: r.data })
    }
    if (action === 'purchase.list') {
      const { limit, offset } = pg(b)
      const r = await sbGet(`cashskillbd_purchases?select=*,cashskillbd_products(name,sku),cashskillbd_suppliers(name)&order=purchased_at.desc&limit=${limit}&offset=${offset}`)
      if (!r.ok) throw new Error('db error')
      return ok(res, { items: r.data })
    }

    // ═══ SALES ORDERS ═══════════════════════════════════════════════
    if (action === 'order.create') {
      // support may create orders; finance/admin full
      const items = b.items
      if (!Array.isArray(items) || items.length === 0 || items.length > 50)
        return bad(res, 400, 'items must be a non-empty array (max 50)')
      const cleanItems = items.map(it => ({
        product_id: reqInt(it.product_id, 1),
        qty: reqInt(it.qty, 1, 10000),
      }))
      const discount = b.discount ? F2(C2(b.discount)) : 0
      if (!isMoney(discount)) throw new Error('invalid discount')
      const r = await sbRpc('cashskillbd_create_sale_order', {
        p_customer_name: reqStr(b.customer_name, 200),
        p_customer_phone: optStr(b.customer_phone, 50),
        p_currency: oneOf(b.currency || 'BDT', ['BDT', 'USD']),
        p_items: cleanItems,
        p_idempotency_key: s(b.idempotency_key) || ('ord-' + uid()),
        p_created_by: me.id,
        p_discount: discount,
        p_notes: optStr(b.notes, 1000),
      })
      if (!r.ok) {
        const msg = String(r.raw || '')
        if (msg.includes('insufficient stock')) return bad(res, 409, 'insufficient stock for one or more items')
        if (msg.includes('not active')) return bad(res, 400, 'a product is not active')
        if (msg.includes('currency mismatch')) return bad(res, 400, 'currency mismatch in items')
        return bad(res, 400, 'order failed')
      }
      await audit(me.id, 'order.create', 'sales_order', r.data, null,
        { customer: b.customer_name, items: cleanItems.length })
      return ok(res, { order_id: r.data })
    }

    if (action === 'order.list') {
      const { limit, offset } = pg(b)
      let q = `cashskillbd_sales_orders?select=*,cashskillbd_sale_items(count)&order=created_at.desc&limit=${limit}&offset=${offset}`
      if (b.status) q += `&status=eq.${oneOf(b.status, ['pending','confirmed','delivered','cancelled','refunded'])}`
      if (b.search) q += `&or=(order_no.ilike.*${encodeURIComponent(b.search)}*,customer_name.ilike.*${encodeURIComponent(b.search)}*,customer_phone.ilike.*${encodeURIComponent(b.search)}*)`
      const r = await sbGet(q)
      if (!r.ok) throw new Error('db error')
      return ok(res, { items: r.data })
    }

    if (action === 'order.items_bulk') {
      const ids = Array.isArray(b.order_ids) ? b.order_ids.map(Number).filter(Boolean) : []
      if (ids.length === 0) return ok(res, { items: [] })
      const r = await sbGet(`cashskillbd_sale_items?order_id=in.(${ids.join(',')})&select=*,cashskillbd_products(name,sku)&limit=1000`)
      if (!r.ok) throw new Error('db error')
      return ok(res, { items: r.data })
    }

    if (action === 'order.get') {
      const id = reqInt(b.id, 1)
      const o = await sbGet(`cashskillbd_sales_orders?id=eq.${id}&select=*`)
      if (!o.ok || !o.data?.[0]) return bad(res, 404, 'not found')
      const items = await sbGet(`cashskillbd_sale_items?order_id=eq.${id}&select=*,cashskillbd_products(name,sku)`)
      return ok(res, { order: o.data[0], items: items.data || [] })
    }

    if (action === 'order.set_status') {
      const id = reqInt(b.id, 1)
      const status = oneOf(b.status, ['pending', 'confirmed', 'delivered', 'cancelled', 'refunded'])
      // support: only forward delivery flow; finance/admin: all incl. cancel/refund
      if (!finance && !['confirmed', 'delivered'].includes(status))
        return bad(res, 403, 'finance role required for this status')
      const cur = await sbGet(`cashskillbd_sales_orders?id=eq.${id}&select=status`)
      if (!cur.ok || !cur.data?.[0]) return bad(res, 404, 'not found')
      const oldStatus = cur.data[0].status
      if (status === 'cancelled' && ['pending', 'confirmed'].includes(oldStatus)) {
        if (!finance) return bad(res, 403, 'finance role required')
        const r = await sbRpc('cashskillbd_cancel_sale_order', { p_order_id: id, p_created_by: me.id })
        if (!r.ok) return bad(res, 400, 'cancel failed')
        await audit(me.id, 'order.cancel', 'sales_order', id, { status: oldStatus }, { status: 'cancelled' })
        return ok(res, { ok: true, restocked: true })
      }
      const r = await sbReq(`cashskillbd_sales_orders?id=eq.${id}`, 'PATCH', { status })
      if (!r.ok) throw new Error('db error')
      await audit(me.id, 'order.status', 'sales_order', id, { status: oldStatus }, { status })
      return ok(res, { ok: true })
    }

    // ═══ SERVICES (IP / VPS / Number) ═══════════════════════════════
    if (action === 'service.create') {
      const service_type = oneOf(b.service_type, ['ip', 'vps', 'number'])
      const product_id = b.product_id ? reqInt(b.product_id, 1) : null
      let expires_at = null
      if (b.duration_days) {
        const d = reqInt(b.duration_days, 1, 3650)
        expires_at = new Date(Date.now() + d * 86400000).toISOString()
      } else if (b.expires_at) {
        const t = new Date(b.expires_at).getTime()
        if (!Number.isFinite(t) || t <= Date.now()) throw new Error('invalid expires_at')
        expires_at = new Date(t).toISOString()
      }
      const row = {
        service_type, product_id,
        order_id: b.order_id ? reqInt(b.order_id, 1) : null,
        customer_name: reqStr(b.customer_name, 200),
        customer_phone: optStr(b.customer_phone, 50),
        country: optStr(b.country, 100),
        provider: optStr(b.provider, 200),
        specs: b.specs && typeof b.specs === 'object' ? b.specs : {},
        login_username: optStr(b.login_username, 200), // never passwords/OTPs
        expires_at, status: 'active', created_by: me.id,
      }
      // safety: refuse obvious secret fields
      const specStr = JSON.stringify(row.specs).toLowerCase()
      if (/password|otp|secret|token|private_?key/.test(specStr))
        return bad(res, 400, 'specs must not contain passwords, OTPs or secrets')
      const r = await sbReq('cashskillbd_services', 'POST', row)
      if (!r.ok) throw new Error('db error')
      const svc = r.data[0]
      await sbReq('cashskillbd_service_events', 'POST', {
        service_id: svc.id, event: 'created', created_by: me.id,
      }, 'return=minimal')
      await audit(me.id, 'service.create', 'service', svc.id, null, { service_type, customer: row.customer_name })
      return ok(res, { item: svc })
    }

    if (action === 'service.list') {
      const { limit, offset } = pg(b)
      let q = `cashskillbd_services?select=*,cashskillbd_products(name,sku)&order=created_at.desc&limit=${limit}&offset=${offset}`
      if (b.service_type) q += `&service_type=eq.${oneOf(b.service_type, ['ip','vps','number'])}`
      if (b.status) q += `&status=eq.${oneOf(b.status, ['active','expired','cancelled','suspended'])}`
      if (b.expiring_days) {
        const days = reqInt(b.expiring_days, 1, 365)
        const to = new Date(Date.now() + days * 86400000).toISOString()
        q += `&expires_at=lte.${to}&status=eq.active`
      }
      if (b.search) q += `&or=(customer_name.ilike.*${encodeURIComponent(b.search)}*,customer_phone.ilike.*${encodeURIComponent(b.search)}*)`
      const r = await sbGet(q)
      if (!r.ok) throw new Error('db error')
      return ok(res, { items: r.data })
    }

    if (action === 'service.renew') {
      const id = reqInt(b.id, 1)
      const days = reqInt(b.duration_days, 1, 3650)
      const cur = await sbGet(`cashskillbd_services?id=eq.${id}&select=expires_at,status`)
      if (!cur.ok || !cur.data?.[0]) return bad(res, 404, 'not found')
      const base = Math.max(new Date(cur.data[0].expires_at || Date.now()).getTime(), Date.now())
      const expires_at = new Date(base + days * 86400000).toISOString()
      const r = await sbReq(`cashskillbd_services?id=eq.${id}`, 'PATCH', { expires_at, status: 'active' })
      if (!r.ok) throw new Error('db error')
      await sbReq('cashskillbd_service_events', 'POST', {
        service_id: id, event: 'renewed', notes: `+${days} days`, created_by: me.id,
      }, 'return=minimal')
      await audit(me.id, 'service.renew', 'service', id, null, { days, expires_at })
      return ok(res, { item: r.data[0] })
    }

    if (action === 'service.set_status') {
      const id = reqInt(b.id, 1)
      const status = oneOf(b.status, ['active', 'suspended', 'cancelled', 'expired'])
      const r = await sbReq(`cashskillbd_services?id=eq.${id}`, 'PATCH', { status })
      if (!r.ok || !r.data?.[0]) return bad(res, 404, 'not found')
      const ev = { suspended: 'suspended', cancelled: 'cancelled', expired: 'expired', active: 'created' }[status]
      await sbReq('cashskillbd_service_events', 'POST', {
        service_id: id, event: ev, notes: optStr(b.notes, 500), created_by: me.id,
      }, 'return=minimal')
      await audit(me.id, 'service.status', 'service', id, null, { status })
      return ok(res, { item: r.data[0] })
    }

    if (action === 'service.events') {
      const r = await sbGet(`cashskillbd_service_events?service_id=eq.${reqInt(b.service_id, 1)}&order=created_at.desc&limit=50`)
      if (!r.ok) throw new Error('db error')
      return ok(res, { items: r.data })
    }

    // ═══ DOLLAR BUY/SELL ════════════════════════════════════════════
    if (action === 'dollar.rate_current') {
      const r = await sbGet('cashskillbd_dollar_rates?effective_to=is.null&order=effective_from.desc&limit=1')
      if (!r.ok) throw new Error('db error')
      return ok(res, { rate: r.data?.[0] || null })
    }
    if (action === 'dollar.rate_history') {
      const r = await sbGet('cashskillbd_dollar_rates?order=effective_from.desc&limit=50')
      if (!r.ok) throw new Error('db error')
      return ok(res, { items: r.data })
    }
    if (action === 'dollar.rate_set') {
      if (!finance) return bad(res, 403, 'finance role required')
      if (!isMoney(b.buy_rate) || !isMoney(b.sell_rate)) throw new Error('invalid rate')
      const buy = F4(C4(b.buy_rate)), sell = F4(C4(b.sell_rate))
      if (buy <= 0 || sell <= 0) throw new Error('rates must be positive')
      const now = new Date().toISOString()
      const ins = await sbReq('cashskillbd_dollar_rates', 'POST', {
        buy_rate: buy, sell_rate: sell, effective_from: now, created_by: me.id,
      })
      if (!ins.ok) throw new Error('db error')
      const newId = ins.data[0].id
      // close previous current rates (insert-first keeps it self-healing)
      await sbReq(`cashskillbd_dollar_rates?effective_to=is.null&id=neq.${newId}`, 'PATCH', { effective_to: now }, 'return=minimal')
      await audit(me.id, 'dollar.rate_set', 'dollar_rate', newId, null, { buy_rate: buy, sell_rate: sell })
      return ok(res, { item: ins.data[0] })
    }

    if (action === 'dollar.txn_create') {
      if (!finance) return bad(res, 403, 'finance role required')
      const txn_type = oneOf(b.txn_type, ['buy', 'sell'])
      if (!isMoney(b.usd_amount) || Number(b.usd_amount) <= 0) throw new Error('invalid usd_amount')
      const fees = b.fees ? F2(C2(b.fees)) : 0
      if (!isMoney(fees)) throw new Error('invalid fees')
      // snapshot current rate (immutable from here on)
      const rc = await sbGet('cashskillbd_dollar_rates?effective_to=is.null&order=effective_from.desc&limit=1')
      const rate = rc.data?.[0]
      if (!rate) return bad(res, 400, 'no active exchange rate — set rates first')
      const usdC = C2(b.usd_amount)
      const rateC = txn_type === 'sell' ? C4(rate.sell_rate) : C4(rate.buy_rate)
      // bdt = usd * rate → cents = round(usdC * rateC / 10000)
      const bdtC = Math.round((usdC * rateC) / 10000)
      // margin: sell → (sell-buy)*usd ; buy → 0 (inventory, unrealized)
      let marginC = 0
      if (txn_type === 'sell') {
        const buyC = C4(rate.buy_rate)
        marginC = Math.round((usdC * (rateC - buyC)) / 10000)
      }
      const netC = marginC - C2(fees)
      const row = {
        txn_type,
        usd_amount: F2(usdC),
        rate_snapshot: F4(rateC),
        bdt_amount: F2(bdtC),
        fees,
        reference: optStr(b.reference, 200),
        status: 'pending',
        gross_margin: F2(marginC),
        net_profit: F2(netC),
        customer_name: optStr(b.customer_name, 200),
        notes: optStr(b.notes, 1000),
        idempotency_key: s(b.idempotency_key) || ('dlr-' + uid()),
        created_by: me.id,
      }
      const r = await sbReq('cashskillbd_dollar_txns', 'POST', row)
      if (!r.ok) {
        if (JSON.stringify(r.data).includes('duplicate')) return bad(res, 409, 'duplicate transaction (idempotency key)')
        throw new Error('db error')
      }
      await audit(me.id, 'dollar.txn_create', 'dollar_txn', r.data[0].id, null,
        { txn_type, usd: row.usd_amount, bdt: row.bdt_amount })
      return ok(res, { item: r.data[0] })
    }

    if (action === 'dollar.txn_list') {
      if (!finance) return bad(res, 403, 'finance role required')
      const { limit, offset } = pg(b)
      let q = `cashskillbd_dollar_txns?order=created_at.desc&limit=${limit}&offset=${offset}`
      if (b.status) q += `&status=eq.${oneOf(b.status, ['pending','completed','cancelled','refunded'])}`
      if (b.txn_type) q += `&txn_type=eq.${oneOf(b.txn_type, ['buy','sell'])}`
      const r = await sbGet(q)
      if (!r.ok) throw new Error('db error')
      return ok(res, { items: r.data })
    }

    if (action === 'dollar.txn_update') {
      if (!finance) return bad(res, 403, 'finance role required')
      const id = reqInt(b.id, 1)
      const cur = await sbGet(`cashskillbd_dollar_txns?id=eq.${id}&select=*`)
      if (!cur.ok || !cur.data?.[0]) return bad(res, 404, 'not found')
      const old = cur.data[0]
      if (old.status !== 'pending') return bad(res, 400, 'only pending transactions can be edited')
      const usd = b.usd_amount != null ? Number(b.usd_amount) : Number(old.usd_amount)
      if (!isMoney(usd) || usd <= 0) throw new Error('invalid usd_amount')
      // Recalculate BDT from the ORIGINAL rate snapshot (rate is immutable)
      const rateC = C4(old.rate_snapshot)
      const usdC = C2(usd)
      const bdtC = Math.round((usdC * rateC) / 10000)
      const patch = {
        usd_amount: F2(usdC), bdt_amount: F2(bdtC),
        reference: b.reference != null ? optStr(b.reference, 200) : old.reference,
        customer_name: b.customer_name != null ? optStr(b.customer_name, 200) : old.customer_name,
        notes: b.notes != null ? optStr(b.notes, 1000) : old.notes,
      }
      const r = await sbReq(`cashskillbd_dollar_txns?id=eq.${id}`, 'PATCH', patch)
      if (!r.ok) throw new Error('db error')
      await audit(me.id, 'dollar.txn_update', 'dollar_txn', id, { usd: old.usd_amount, bdt: old.bdt_amount }, { usd: patch.usd_amount, bdt: patch.bdt_amount })
      return ok(res, { ok: true })
    }

    if (action === 'dollar.txn_delete') {
      if (!finance) return bad(res, 403, 'finance role required')
      const id = reqInt(b.id, 1)
      const cur = await sbGet(`cashskillbd_dollar_txns?id=eq.${id}&select=status`)
      if (!cur.ok || !cur.data?.[0]) return bad(res, 404, 'not found')
      if (cur.data[0].status === 'completed') return bad(res, 400, 'completed transactions cannot be deleted — use refund')
      const r = await sbReq(`cashskillbd_dollar_txns?id=eq.${id}`, 'DELETE')
      if (!r.ok) throw new Error('db error')
      await audit(me.id, 'dollar.txn_delete', 'dollar_txn', id, { status: cur.data[0].status }, {})
      return ok(res, { deleted: true })
    }

    if (action === 'dollar.txn_set_status') {
      if (!finance) return bad(res, 403, 'finance role required')
      const id = reqInt(b.id, 1)
      const status = oneOf(b.status, ['completed', 'cancelled', 'refunded'])
      const cur = await sbGet(`cashskillbd_dollar_txns?id=eq.${id}&select=status`)
      if (!cur.ok || !cur.data?.[0]) return bad(res, 404, 'not found')
      const old = cur.data[0].status
      if (old !== 'pending' && !(old === 'completed' && status === 'refunded'))
        return bad(res, 400, `cannot move ${old} → ${status}`)
      const r = await sbReq(`cashskillbd_dollar_txns?id=eq.${id}`, 'PATCH', { status })
      if (!r.ok) throw new Error('db error')
      await audit(me.id, 'dollar.txn_status', 'dollar_txn', id, { status: old }, { status })
      return ok(res, { ok: true })
    }

    // ═══ EXPENSES ═══════════════════════════════════════════════════
    if (action === 'expense.create') {
      if (!finance) return bad(res, 403, 'finance role required')
      if (!isMoney(b.amount) || Number(b.amount) <= 0) throw new Error('invalid amount')
      const r = await sbReq('cashskillbd_expenses', 'POST', {
        category: reqStr(b.category, 100),
        amount: F2(C2(b.amount)),
        currency: oneOf(b.currency || 'BDT', ['BDT', 'USD']),
        notes: optStr(b.notes, 1000),
        expense_date: /^\d{4}-\d{2}-\d{2}$/.test(s(b.expense_date)) ? s(b.expense_date) : new Date().toISOString().slice(0, 10),
        created_by: me.id,
      })
      if (!r.ok) throw new Error('db error')
      await audit(me.id, 'expense.create', 'expense', r.data[0].id, null, { category: b.category, amount: b.amount })
      return ok(res, { item: r.data[0] })
    }
    if (action === 'expense.list') {
      if (!finance) return bad(res, 403, 'finance role required')
      const { limit, offset } = pg(b)
      const r = await sbGet(`cashskillbd_expenses?order=expense_date.desc&limit=${limit}&offset=${offset}`)
      if (!r.ok) throw new Error('db error')
      return ok(res, { items: r.data })
    }

    // ═══ REPORTS ════════════════════════════════════════════════════
    if (action === 'report.summary') {
      if (!finance) return bad(res, 403, 'finance role required')
      const from = /^\d{4}-\d{2}-\d{2}$/.test(s(b.from)) ? s(b.from) : '2000-01-01'
      const to = /^\d{4}-\d{2}-\d{2}$/.test(s(b.to)) ? s(b.to) : '2100-01-01'
      const cur = oneOf(b.currency || 'BDT', ['BDT', 'USD'])
      const dr = `and=(created_at.gte.${from},created_at.lte.${to}T23:59:59)`
      const [sales, purch, exp, dlr] = await Promise.all([
        sbGet(`cashskillbd_sales_orders?select=grand_total&currency=eq.${cur}&status=in.(confirmed,delivered)&${dr}`),
        sbGet(`cashskillbd_purchases?select=total_cost&currency=eq.${cur}&${dr.replace('created_at', 'purchased_at')}`),
        sbGet(`cashskillbd_expenses?select=amount&currency=eq.${cur}&and=(expense_date.gte.${from},expense_date.lte.${to})`),
        sbGet(`cashskillbd_dollar_txns?select=gross_margin,net_profit,bdt_amount,txn_type&status=eq.completed&${dr}`),
      ])
      const sum = (rows, k) => (rows.data || []).reduce((a, r) => a + Number(r[k] || 0), 0)
      // gross margin on product sales: revenue − cost of goods sold
      const items = await sbGet(
        `cashskillbd_sale_items?select=qty,unit_price,order_id,cashskillbd_products(purchase_cost,currency)` +
        `&cashskillbd_sales_orders.status=in.(confirmed,delivered)` +
        `&cashskillbd_sales_orders.currency=eq.${cur}`
      )
      let cogs = 0
      for (const it of items.data || []) {
        const pc = it.cashskillbd_products
        if (pc && pc.currency === cur) cogs += Number(it.qty) * Number(pc.purchase_cost || 0)
      }
      const revenue = sum(sales, 'grand_total')
      const purchaseCosts = sum(purch, 'total_cost')
      const expenses = sum(exp, 'amount')
      const dlrRows = dlr.data || []
      const dlrMargin = dlrRows.reduce((a, r) => a + Number(r.gross_margin || 0), 0)
      const dlrNet = dlrRows.reduce((a, r) => a + Number(r.net_profit || 0), 0)
      const grossMargin = F2(C2(revenue) - C2(cogs)) + dlrMargin
      const netProfit = F2(C2(grossMargin) - C2(expenses))
      // stock valuation (current)
      const stk = await sbGet(`cashskillbd_products?select=stock_qty,purchase_cost&currency=eq.${cur}&status=neq.archived`)
      const stockVal = (stk.data || []).reduce((a, p) => a + Number(p.stock_qty) * Number(p.purchase_cost || 0), 0)
      return ok(res, {
        currency: cur, from, to,
        revenue: F2(C2(revenue)),
        cogs: F2(C2(cogs)),
        purchase_costs: F2(C2(purchaseCosts)),
        gross_margin: F2(C2(grossMargin)),
        expenses: F2(C2(expenses)),
        net_profit: F2(C2(netProfit)),
        dollar: {
          gross_margin: F2(C2(dlrMargin)), net_profit: F2(C2(dlrNet)),
          completed_count: dlrRows.length,
        },
        stock_valuation: F2(C2(stockVal)),
        note: 'Revenue = confirmed/delivered sales. Gross margin = revenue − cost of goods sold (+ dollar margin). Net profit = gross margin − recorded expenses. Cash flow not tracked — record all cash movements as expenses/purchases.',
      })
    }

    if (action === 'report.product_sales') {
      if (!finance) return bad(res, 403, 'finance role required')
      const from = /^\d{4}-\d{2}-\d{2}$/.test(s(b.from)) ? s(b.from) : '2000-01-01'
      const to = /^\d{4}-\d{2}-\d{2}$/.test(s(b.to)) ? s(b.to) : '2100-01-01'
      const items = await sbGet(
        `cashskillbd_sale_items?select=qty,unit_price,product_id,cashskillbd_products(name,sku)` +
        `&cashskillbd_sales_orders.status=in.(confirmed,delivered)` +
        `&cashskillbd_sales_orders.created_at=gte.${from}&cashskillbd_sales_orders.created_at=lte.${to}T23:59:59`
      )
      if (!items.ok) throw new Error('db error')
      const map = {}
      for (const it of items.data || []) {
        const k = it.product_id
        map[k] = map[k] || { product_id: k, name: it.cashskillbd_products?.name, sku: it.cashskillbd_products?.sku, qty: 0, revenue: 0 }
        map[k].qty += Number(it.qty)
        map[k].revenue = F2(C2(map[k].revenue) + C2(it.unit_price) * Number(it.qty))
      }
      return ok(res, { items: Object.values(map).sort((a, c) => c.revenue - a.revenue) })
    }

    if (action === 'report.low_stock') {
      const r = await sbGet('cashskillbd_products?select=id,sku,name,stock_qty,low_stock_at,status&status=neq.archived&order=stock_qty.asc&limit=100')
      if (!r.ok) throw new Error('db error')
      return ok(res, { items: (r.data || []).filter(p => p.stock_qty <= p.low_stock_at) })
    }

    if (action === 'report.expiring') {
      const days = b.days ? reqInt(b.days, 1, 365) : 14
      const to = new Date(Date.now() + days * 86400000).toISOString()
      const r = await sbGet(`cashskillbd_services?select=*,cashskillbd_products(name,sku)&status=eq.active&expires_at=lte.${to}&order=expires_at.asc&limit=100`)
      if (!r.ok) throw new Error('db error')
      return ok(res, { items: r.data })
    }

    // ═══ AUDIT LOGS ═════════════════════════════════════════════════
    if (action === 'audit.list') {
      if (!finance) return bad(res, 403, 'finance role required')
      const { limit, offset } = pg(b)
      let q = `cashskillbd_audit_logs?select=*,cashskillbd_profiles!cashskillbd_audit_logs_actor_id_fkey(email)&order=created_at.desc&limit=${limit}&offset=${offset}`
      if (b.entity_type) q += `&entity_type=eq.${encodeURIComponent(s(b.entity_type))}`
      if (b.action) q += `&action=eq.${encodeURIComponent(s(b.action))}`
      const r = await sbGet(q)
      if (!r.ok) throw new Error('db error')
      return ok(res, { items: r.data })
    }

    return bad(res, 400, 'unknown action')
  } catch (e) {
    if (e.message && /invalid|required|bad |too long|must be|duplicate/.test(e.message))
      return bad(res, 400, e.message)
    return bad(res, 500, 'server error')
  }
  } catch (e) {
    return bad(res, 500, 'server error')
  }
}
