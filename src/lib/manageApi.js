// CashSkillBD — Product & Service Management API helper
// POSTs to /api/inventory with the user's Supabase access token.
// Falls back to direct Supabase calls when API is unavailable (e.g. GitHub Pages static hosting).
import { supabase } from './supabase.js'

async function directFallback(action, payload) {
  // Direct Supabase fallback for read operations
  switch (action) {
    case 'product.list': {
      let q = supabase.from('cashskillbd_products').select('*,cashskillbd_suppliers(name)').order('updated_at', { ascending: false })
      if (payload.search) q = q.or(`name.ilike.*${payload.search}*,sku.ilike.*${payload.search}*`)
      if (payload.status) q = q.eq('status', payload.status)
      if (payload.category) q = q.eq('category', payload.category)
      if (payload.product_type) q = q.eq('product_type', payload.product_type)
      if (payload.limit) q = q.limit(payload.limit)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return { items: data || [] }
    }
    case 'product.get': {
      const { data, error } = await supabase.from('cashskillbd_products').select('*,cashskillbd_suppliers(name)').eq('id', payload.id).single()
      if (error) throw new Error(error.message)
      return { item: data }
    }
    case 'supplier.list': {
      const { data, error } = await supabase.from('cashskillbd_suppliers').select('*').order('name')
      if (error) throw new Error(error.message)
      return { items: data || [] }
    }
    case 'purchase.list': {
      const { data, error } = await supabase.from('cashskillbd_purchases').select('*').order('created_at', { ascending: false }).limit(payload.limit || 50)
      if (error) throw new Error(error.message)
      return { items: data || [] }
    }
    case 'order.list': {
      const { data, error } = await supabase.from('cashskillbd_sales_orders').select('*').order('created_at', { ascending: false }).limit(payload.limit || 50)
      if (error) throw new Error(error.message)
      return { items: data || [] }
    }
    case 'stock.movements': {
      const { data, error } = await supabase.from('cashskillbd_stock_movements').select('*').order('created_at', { ascending: false }).limit(payload.limit || 50)
      if (error) throw new Error(error.message)
      return { items: data || [] }
    }
    case 'price.history': {
      let q = supabase.from('cashskillbd_price_history').select('*').order('created_at', { ascending: false })
      if (payload.product_id) q = q.eq('product_id', payload.product_id)
      const { data, error } = await q.limit(payload.limit || 50)
      if (error) throw new Error(error.message)
      return { items: data || [] }
    }
    case 'service.list': {
      const { data, error } = await supabase.from('cashskillbd_services').select('*').order('created_at', { ascending: false }).limit(payload.limit || 50)
      if (error) throw new Error(error.message)
      return { items: data || [] }
    }
    default:
      throw new Error('API unavailable on static hosting — use Vercel version for write operations')
  }
}

export async function manageApi(session, action, payload = {}) {
  try {
    const r = await fetch('/api/inventory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, ...payload }),
    })
    // If API not available (404/405 on static hosting), fall back to direct Supabase
    if (r.status === 404 || r.status === 405) {
      console.warn('API unavailable, using direct Supabase fallback for:', action)
      return await directFallback(action, payload)
    }
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'failed')
    return j
  } catch (e) {
    // Network error or API unavailable — try direct fallback for reads
    if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
      console.warn('API fetch failed, using direct Supabase fallback for:', action)
      return await directFallback(action, payload)
    }
    throw e
  }
}
