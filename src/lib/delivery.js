// Shared delivery helpers for the admin panel.
// The SERVER (api/admin.js) is authoritative for validation + computation;
// this module mirrors the category/field spec for rendering the form.

export const DELIVERY_STATUS_META = {
  pending_payment: { label: 'Pending Payment', labelBn: 'পেমেন্ট বাকি', bg: 'rgba(245,185,66,.15)', color: '#f5b942', border: '1px solid rgba(245,185,66,.4)' },
  awaiting: { label: 'Awaiting Delivery', labelBn: 'ডেলিভারি অপেক্ষায়', bg: 'rgba(77,163,255,.15)', color: '#4da3ff', border: '1px solid rgba(77,163,255,.4)' },
  processing: { label: 'Processing', labelBn: 'প্রসেসিং', bg: 'rgba(192,132,252,.15)', color: '#c084fc', border: '1px solid rgba(192,132,252,.4)' },
  delivered: { label: 'Delivered', labelBn: 'ডেলিভার্ড', bg: 'rgba(46,204,113,.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,.4)' },
  failed: { label: 'Delivery Failed', labelBn: 'ডেলিভারি ব্যর্থ', bg: 'rgba(232,35,42,.15)', color: '#ff6b6b', border: '1px solid rgba(232,35,42,.4)' },
  cancelled: { label: 'Cancelled', labelBn: 'বাতিল', bg: 'rgba(255,255,255,.06)', color: 'var(--muted)', border: '1px solid rgba(255,255,255,.15)' },
}

// Effective fulfillment status for an order row. The DB column is null until
// the delivery migration runs — derive from the payment status meanwhile.
export function deliveryStatusOf(o) {
  if (o?.delivery_status) return o.delivery_status
  if (o?.status === 'confirmed') return 'awaiting'
  if (o?.status === 'rejected') return 'cancelled'
  return 'pending_payment'
}

// Mirror of the server-side category derivation (api/admin.js deriveCategory).
export function deriveCategory(order) {
  if (order?.course_id) return 'course'
  const n = String(order?.item_name || '').toLowerCase()
  if (/\b(buy|sell)\b/.test(n) || n.includes('dollar') || n.includes('usd') || n.includes('usdt')) return 'dollar'
  if (n.includes('vps') || n.includes('rdp') || n.includes('server')) return 'vps'
  if (n.includes('proxy') || /(^|[\s\-_])ip([\s\-_]|$)/.test(n)) return 'ip'
  if (n.includes('number') || n.includes('phone') || n.includes('virtual')) return 'number'
  return 'other'
}

export const CATEGORY_LABEL = {
  vps: 'VPS / RDP', ip: 'IP / Proxy', number: 'Virtual Number',
  dollar: 'Dollar Buy / Sell', course: 'Course', other: 'Other',
}

// Field spec for the delivery form: { label, labelBn, type, required, options? }.
// types: text | secret | number | port | date | datetime | select | textarea
// ADMIN_ONLY keys are never sent to the customer endpoint.
export const ADMIN_ONLY_FIELDS = new Set(['notes', 'admin_notes', 'inventory_ref', 'provider_ref'])
export const SECRET_FIELDS = new Set(['password', 'phone_number', 'payout_details'])

export const DELIVERY_FIELDS = {
  vps: {
    provider: { label: 'Provider / Datacenter', labelBn: 'প্রোভাইডার / ডাটাসেন্টার', type: 'text', required: true },
    ip: { label: 'IP Address / Hostname', labelBn: 'আইপি অ্যাড্রেস / হোস্টনেম', type: 'text', required: true },
    port: { label: 'Port', labelBn: 'পোর্ট', type: 'port', required: true },
    os: { label: 'Operating System', labelBn: 'অপারেটিং সিস্টেম', type: 'text', required: true },
    plan: { label: 'Plan / Specification', labelBn: 'প্ল্যান / স্পেসিফিকেশন', type: 'text', required: true },
    username: { label: 'Username', labelBn: 'ইউজারনেম', type: 'text', required: true },
    password: { label: 'Password', labelBn: 'পাসওয়ার্ড', type: 'secret', required: true },
    expiry_date: { label: 'Expiry Date', labelBn: 'মেয়াদ শেষের তারিখ', type: 'date', required: true },
    billing_period: { label: 'Billing Period', labelBn: 'বিলিং পিরিয়ড', type: 'select', required: true, options: ['1 Month', '3 Months', '6 Months', '1 Year'] },
    instructions: { label: 'Setup Instructions (customer-visible)', labelBn: 'সেটআপ নির্দেশনা (কাস্টমার দেখবে)', type: 'textarea', required: false },
    notes: { label: 'Delivery Notes (admin only)', labelBn: 'ডেলিভারি নোট (শুধু অ্যাডমিন)', type: 'textarea', required: false },
  },
  ip: {
    ip_type: { label: 'IP / Proxy Type', labelBn: 'আইপি / প্রক্সি টাইপ', type: 'select', required: true, options: ['Residential', 'Datacenter', 'Mobile'] },
    country: { label: 'Country', labelBn: 'দেশ', type: 'text', required: true },
    region: { label: 'Region', labelBn: 'অঞ্চল', type: 'text', required: false },
    isp: { label: 'ISP (only if verified)', labelBn: 'আইএসপি (যাচাই হলে তবেই)', type: 'text', required: false },
    host: { label: 'Host / IP Address', labelBn: 'হোস্ট / আইপি অ্যাড্রেস', type: 'text', required: true },
    port: { label: 'Port', labelBn: 'পোর্ট', type: 'port', required: true },
    protocol: { label: 'Protocol', labelBn: 'প্রোটোকল', type: 'select', required: true, options: ['HTTP(S)', 'SOCKS5', 'HTTP+SOCKS5'] },
    username: { label: 'Username', labelBn: 'ইউজারনেম', type: 'text', required: true },
    password: { label: 'Password', labelBn: 'পাসওয়ার্ড', type: 'secret', required: true },
    duration: { label: 'Service Duration', labelBn: 'সার্ভিসের মেয়াদ', type: 'text', required: true },
    expiry_date: { label: 'Expiry Date', labelBn: 'মেয়াদ শেষের তারিখ', type: 'date', required: true },
    instructions: { label: 'Connection Instructions (customer-visible)', labelBn: 'কানেকশন নির্দেশনা (কাস্টমার দেখবে)', type: 'textarea', required: false },
    inventory_ref: { label: 'Internal Inventory Reference (admin only)', labelBn: 'ইন্টারনাল ইনভেন্টরি রেফারেন্স (শুধু অ্যাডমিন)', type: 'text', required: false },
    notes: { label: 'Delivery Notes (admin only)', labelBn: 'ডেলিভারি নোট (শুধু অ্যাডমিন)', type: 'textarea', required: false },
  },
  number: {
    country: { label: 'Country', labelBn: 'দেশ', type: 'text', required: true },
    phone_number: { label: 'Phone Number', labelBn: 'ফোন নাম্বার', type: 'text', required: true },
    platform: { label: 'Platform / Service', labelBn: 'প্ল্যাটফর্ম / সার্ভিস', type: 'text', required: true },
    number_type: { label: 'Number Type', labelBn: 'নাম্বার টাইপ', type: 'select', required: true, options: ['Non-VoIP', 'VoIP', 'SIM'] },
    activation_status: { label: 'Activation Status', labelBn: 'অ্যাক্টিভেশন স্ট্যাটাস', type: 'select', required: true, options: ['Ready', 'Pending Activation'] },
    expiry_date: { label: 'Expiry Date', labelBn: 'মেয়াদ শেষের তারিখ', type: 'date', required: true },
    provider_ref: { label: 'Provider Reference (admin only)', labelBn: 'প্রোভাইডার রেফারেন্স (শুধু অ্যাডমিন)', type: 'text', required: false },
    instructions: { label: 'Customer Instructions (customer-visible)', labelBn: 'কাস্টমার নির্দেশনা (কাস্টমার দেখবে)', type: 'textarea', required: false },
    notes: { label: 'Delivery Notes (admin only)', labelBn: 'ডেলিভারি নোট (শুধু অ্যাডমিন)', type: 'textarea', required: false },
  },
  dollar: {
    txn_type: { label: 'Transaction Type', labelBn: 'লেনদেনের ধরন', type: 'select', required: true, options: ['Buy', 'Sell'] },
    currency: { label: 'Asset / Currency', labelBn: 'অ্যাসেট / কারেন্সি', type: 'select', required: true, options: ['USD', 'USDT', 'LTC'] },
    requested_amount: { label: 'Requested Amount', labelBn: 'রিকোয়েস্টেড অ্যামাউন্ট', type: 'number', required: true },
    exchange_rate: { label: 'Exchange Rate (BDT per unit)', labelBn: 'এক্সচেঞ্জ রেট (প্রতি ইউনিটে টাকা)', type: 'number', required: true },
    fee: { label: 'Fee (BDT)', labelBn: 'ফি (টাকা)', type: 'number', required: true },
    payout_details: { label: "Customer's Payout / Payment Details", labelBn: 'কাস্টমারের পেআউট / পেমেন্ট ডিটেইলস', type: 'text', required: true },
    txn_ref: { label: 'Transaction Reference', labelBn: 'লেনদেন রেফারেন্স', type: 'text', required: false },
    transfer_ref: { label: 'Verified Transfer Reference', labelBn: 'যাচাইকৃত ট্রান্সফার রেফারেন্স', type: 'text', required: false },
    transfer_status: { label: 'Transfer Status', labelBn: 'ট্রান্সফার স্ট্যাটাস', type: 'select', required: true, options: ['Pending', 'Completed', 'Verified'] },
    rate_timestamp: { label: 'Rate Timestamp', labelBn: 'রেটের সময়', type: 'datetime', required: false },
    notes: { label: 'Transaction Notes (admin only)', labelBn: 'লেনদেন নোট (শুধু অ্যাডমিন)', type: 'textarea', required: false },
  },
  course: {
    course_title: { label: 'Course Title', labelBn: 'কোর্সের নাম', type: 'text', required: true },
    enrollment_status: { label: 'Enrollment Status', labelBn: 'এনরোলমেন্ট স্ট্যাটাস', type: 'select', required: true, options: ['Active', 'Pending'] },
    access_start: { label: 'Access Start Date', labelBn: 'অ্যাক্সেস শুরুর তারিখ', type: 'date', required: true },
    access_expiry: { label: 'Access Expiry Date', labelBn: 'অ্যাক্সেস শেষের তারিখ', type: 'date', required: false },
    instructions: { label: 'Course Access Instructions (customer-visible)', labelBn: 'কোর্স অ্যাক্সেস নির্দেশনা (কাস্টমার দেখবে)', type: 'textarea', required: false },
    customer_notes: { label: 'Customer-Visible Notes', labelBn: 'কাস্টমার দেখবে এমন নোট', type: 'textarea', required: false },
    admin_notes: { label: 'Admin Notes (admin only)', labelBn: 'অ্যাডমিন নোট (শুধু অ্যাডমিন)', type: 'textarea', required: false },
  },
  other: {
    reference: { label: 'Delivery Reference', labelBn: 'ডেলিভারি রেফারেন্স', type: 'text', required: false },
    instructions: { label: 'Delivery Instructions (customer-visible)', labelBn: 'ডেলিভারি নির্দেশনা (কাস্টমার দেখবে)', type: 'textarea', required: false },
    notes: { label: 'Delivery Notes (admin only)', labelBn: 'ডেলিভারি নোট (শুধু অ্যাডমিন)', type: 'textarea', required: false },
  },
}

// Client-side mirror of server validation (UX only — the server re-validates).
export function validateFields(category, fields, enforceRequired) {
  const spec = DELIVERY_FIELDS[category] || {}
  const errors = []
  for (const [key, def] of Object.entries(spec)) {
    const v = fields[key]
    if (v === '' || v === undefined || v === null) {
      if (def.required && enforceRequired) errors.push(def.label + ' is required')
      continue
    }
    if (def.type === 'number' && !isFinite(Number(v))) errors.push(def.label + ' must be a number')
    if (def.type === 'port' && (!Number.isInteger(Number(v)) || Number(v) < 1 || Number(v) > 65535)) errors.push(def.label + ' must be a port 1–65535')
    if ((def.type === 'date' || def.type === 'datetime') && isNaN(Date.parse(String(v)))) errors.push(def.label + ' must be a valid date')
    if (def.type === 'select' && !def.options.includes(v)) errors.push(def.label + ' has an invalid value')
  }
  return errors
}

export function maskSecret(value) {
  const s = String(value ?? '')
  if (!s) return '—'
  if (s.length <= 4) return '••••'
  return '••••' + s.slice(-2)
}
