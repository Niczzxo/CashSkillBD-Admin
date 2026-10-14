// CashSkillBD Admin translations — English (default) & Bangla
import { en as en_a, bn as bn_a } from './keys_a.js'
import { en as en_b, bn as bn_b } from './keys_b.js'
import { en as en_c, bn as bn_c } from './keys_c.js'
import { en as en_d, bn as bn_d } from './keys_d.js'
import { en as en_e, bn as bn_e } from './keys_e.js'
import { en as en_f, bn as bn_f } from './keys_f.js'
import { en as en_g, bn as bn_g } from './keys_g.js'
import { en as en_h, bn as bn_h } from './keys_h.js'

const coreEn = {
  admin_panel: 'ADMIN PANEL',
  management: 'Management',
  logout: 'Logout',
  dashboard: '📊 Dashboard',
  site_settings: '⚙️ Site Settings',
  orders: '🧾 Orders',
  lessons: '🎓 Lessons',
  members: '👥 Members',
  team: '👔 Team',
  reviews: '⭐ Reviews',
  tickets: '🎫 Tickets',
  inquiries: '✉️ Inquiries',
  products: '📦 Products',
  services_ip: '🌐 IP Services',
  services_vps: '🖥️ VPS',
  vps_plans: '📋 VPS Plans',
  services_number: '📱 Numbers',
  dollar: '💵 Dollar',
  sales_orders: '💰 Sales Orders',
  inventory: '📋 Inventory',
  suppliers: '🏭 Suppliers',
  reports: '📈 Reports',
  price_history: '📉 Price History',
  audit_logs: '📝 Audit Logs',
  seminar_regs: '🎟️ Seminar Regs',
  products_mgmt: '📦 Product Management',
  admin_mgmt: '🛡️ Admin Management',
  admins: '👥 Admins',
  roles_permissions: '🔐 Roles & Permissions',
  activity_logs: '📋 Activity Logs',
  course_customers: '🎓 Course Customers',
  course_enrollments: 'Course Enrollments',
  document_verification: 'Document Verification',
  service_customers: '🛍 Service Customers',
  menu: 'Menu',
}

const coreBn = {
  admin_panel: 'অ্যাডমিন প্যানেল',
  management: 'ম্যানেজমেন্ট',
  logout: 'লগআউট',
  dashboard: '📊 ড্যাশবোর্ড',
  site_settings: '⚙️ সাইট সেটিংস',
  orders: '🧾 অর্ডার',
  lessons: '🎓 লেসন',
  members: '👥 মেম্বার',
  team: '👔 টিম',
  reviews: '⭐ রিভিউ',
  tickets: '🎫 টিকেট',
  inquiries: '✉️ ইনকোয়ারি',
  products: '📦 প্রোডাক্ট',
  services_ip: '🌐 IP সার্ভিস',
  services_vps: '🖥️ VPS',
  vps_plans: '📋 VPS Plans',
  services_number: '📱 নাম্বার',
  dollar: '💵 ডলার',
  sales_orders: '💰 সেলস অর্ডার',
  inventory: '📋 ইনভেন্টরি',
  suppliers: '🏭 সাপ্লায়ার',
  reports: '📈 রিপোর্ট',
  price_history: '📉 প্রাইস হিস্ট্রি',
  audit_logs: '📝 অডিট লগ',
  seminar_regs: '🎟️ সেমিনার রেজিস্ট্রেশন',
  products_mgmt: '📦 প্রোডাক্ট ম্যানেজমেন্ট',
  admin_mgmt: '🛡️ অ্যাডমিন ম্যানেজমেন্ট',
  admins: '👥 অ্যাডমিনস',
  roles_permissions: '🔐 রোলস ও পারমিশন',
  activity_logs: '📋 অ্যাক্টিভিটি লগ',
  course_customers: '🎓 কোর্স কাস্টমারস',
  course_enrollments: 'কোর্স এনরোলমেন্ট',
  document_verification: 'ডকুমেন্ট যাচাই',
  service_customers: '🛍 সার্ভিস কাস্টমারস',
  menu: 'মেনু',
}

export const t = {
  en: { ...coreEn, ...en_a, ...en_b, ...en_c, ...en_d, ...en_e, ...en_f, ...en_g, ...en_h },
  bn: { ...coreBn, ...bn_a, ...bn_b, ...bn_c, ...bn_d, ...bn_e, ...bn_f, ...bn_g, ...bn_h },
}

// Accepts full locale codes ('bn-BD', 'en-US', …); admin labels exist in en/bn only,
// everything else falls back to English (never claim a fuller translation than exists).
export const tr = (lang, key) => {
  const l = (lang === 'bn' || lang === 'bn-BD') ? 'bn' : 'en'
  return t[l]?.[key] || t.en[key] || key
}
