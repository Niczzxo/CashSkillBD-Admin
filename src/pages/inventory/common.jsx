// Shared helpers for the inventory / product-management admin sections.
import { fmt } from '../../config.js'
import { tr } from '../../i18n/translations.js'
import { useLang } from '../../i18n/LanguageContext.jsx'

export const isFinance = (role) => role === 'admin' || role === 'finance'

export const money = (n, cur = 'BDT') => {
  const v = Number(n) || 0
  if (cur === 'USD') return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return fmt(v)
}

// 4-decimal rates (dollar buy/sell)
export const money4 = (n) => '৳' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 4 })

export const dstr = (s) =>
  s ? new Date(s).toLocaleString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export const dstrD = (s) =>
  s ? new Date(s).toLocaleDateString('bn-BD') : '—'

export const err = (e, lang) => alert('❌ ' + (e?.message || e || (lang ? tr(lang, 'cmn_failed') : 'Failed')))

export function Tbl({ children }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <div className="tbl-wrap"><table className="data-table">{children}</table></div>
      </div>
    </div>
  )
}

export function Empty({ text }) {
  const { lang } = useLang()
  return <p style={{ padding: 20, color: 'var(--muted)' }}>{text ?? tr(lang, 'cmn_empty')}</p>
}

export function LoadMore({ hasMore, loading, onMore }) {
  const { lang } = useLang()
  if (!hasMore) return null
  return (
    <div style={{ textAlign: 'center', marginTop: 16 }}>
      <button className="btn btn-ghost btn-sm" disabled={loading} onClick={onMore}>
        {loading ? tr(lang, 'cmn_loading') : tr(lang, 'cmn_load_more')}
      </button>
    </div>
  )
}

export function FinanceOnly({ text }) {
  const { lang } = useLang()
  return <div className="card"><p>🔒 {text ?? tr(lang, 'cmn_finance_only')}</p></div>
}

// inline style for filter inputs/selects (outside .form-card)
export const inp = {
  padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'rgba(0,0,0,.35)', color: '#fff', fontFamily: 'var(--font)', fontSize: '.95rem',
}

export const STATUS_BN = {
  active: '✅ অ্যাক্টিভ', inactive: '⏸️ ইনঅ্যাক্টিভ',
  out_of_stock: '📭 স্টক শেষ', archived: '🗃️ আর্কাইভ',
}
export const ORDER_STATUS_BN = {
  pending: '⏳ পেন্ডিং', confirmed: '✅ কনফার্মড', delivered: '🚚 ডেলিভার্ড',
  cancelled: '✕ বাতিল', refunded: '↩️ রিফান্ড',
}
export const SVC_STATUS_BN = {
  active: '✅ অ্যাক্টিভ', suspended: '⏸️ সাসপেন্ডেড',
  cancelled: '✕ বাতিল', expired: '⌛ মেয়াদোত্তীর্ণ',
}
