import { useEffect, useRef, useState } from 'react'
import { useLang } from '../i18n/LanguageContext.jsx'
import { tr } from '../i18n/translations.js'
import { supabase } from '../lib/supabase.js'

// Global search: real records from members, orders, courses, payments, products.
// Clicking a result navigates to the section that owns that record.
const maskPhone = (p) => {
  const s = String(p || '')
  if (s.length >= 8) return s.slice(0, 5) + 'XXXX' + s.slice(-2)
  return s || '—'
}
const fmtPrice = (n) => '৳' + Number(n || 0).toLocaleString('en-IN')

const TABS = [
  { id: 'all', labelKey: 'nav_search_all', sec: null },
  { id: 'members', labelKey: 'nav_search_members', sec: 'members' },
  { id: 'orders', labelKey: 'nav_search_orders', sec: 'orders' },
  { id: 'courses', labelKey: 'nav_search_courses', sec: 'lessons' },
  { id: 'payments', labelKey: 'nav_search_payments', sec: 'orders' },
  { id: 'products', labelKey: 'nav_search_products', sec: 'products' },
]

export function GlobalSearch({ open, onOpenChange, goSec, autoFocusKey = 0 }) {
  const { lang } = useLang()
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef(null)
  const boxRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (open && inputRef.current) {
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open, autoFocusKey])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) onOpenChange(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onOpenChange])

  const runSearch = async (query) => {
    const term = query.trim()
    if (term.length < 2) { setResults([]); setSearched(false); setLoading(false); return }
    setLoading(true)
    setSearched(true)
    const like = `%${term.replace(/[%_]/g, '')}%`
    try {
      const [members, orders, courses, products] = await Promise.all([
        supabase.from('cashskillbd_profiles').select('id, full_name, email, phone, member_id, role').eq('role', 'member').or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like},member_id.ilike.${like}`).order('created_at', { ascending: false }).limit(10),
        supabase.from('cashskillbd_orders').select('id, name, mobile, item_name, price, pay_method, trx_id, status, created_at').or(`name.ilike.${like},mobile.ilike.${like},trx_id.ilike.${like},item_name.ilike.${like}`).order('created_at', { ascending: false }).limit(10),
        supabase.from('cashskillbd_courses').select('id, title, price, created_at').ilike('title', like).order('created_at', { ascending: false }).limit(10),
        supabase.from('cashskillbd_products').select('id, name, sku, category, selling_price, currency, stock_qty, status, created_at').or(`name.ilike.${like},sku.ilike.${like},category.ilike.${like}`).order('created_at', { ascending: false }).limit(10),
      ])
      const out = []
      ;(members.data || []).forEach(m => out.push({ kind: 'members', id: `member-${m.id}`, title: m.full_name || '—', sub: `${tr(lang, 'nav_search_member')} • ID: ${m.member_id || '—'}`, meta: maskPhone(m.phone), sec: 'members', created_at: null }))
      ;(orders.data || []).forEach(o => {
        out.push({ kind: 'orders', id: `order-${o.id}`, title: `#CSK-${String(o.id).padStart(5, '0')}`, sub: `${o.name || '—'} • ${o.item_name || ''}`, meta: fmtPrice(o.price), sec: 'orders', created_at: o.created_at })
        if (o.trx_id) out.push({ kind: 'payments', id: `pay-${o.id}`, title: `${o.pay_method || 'Payment'} • ${o.trx_id}`, sub: `${o.name || '—'} • ${o.item_name || ''}`, meta: fmtPrice(o.price), sec: 'orders', created_at: o.created_at })
      })
      ;(courses.data || []).forEach(c => out.push({ kind: 'courses', id: `course-${c.id}`, title: c.title || '—', sub: tr(lang, 'nav_search_course'), meta: c.price != null ? fmtPrice(c.price) : '', sec: 'lessons', created_at: c.created_at }))
      ;(products.data || []).forEach(p => out.push({ kind: 'products', id: `product-${p.id}`, title: p.name || '—', sub: `${p.category || ''} • SKU: ${p.sku || '—'}`, meta: `${p.currency === 'USD' ? '$' : '৳'}${Number(p.selling_price || 0).toLocaleString('en-IN')}`, sec: 'products', created_at: p.created_at }))
      setResults(out)
    } catch {
      setResults([])
    }
    setLoading(false)
    setActiveIdx(-1)
  }

  const onChange = (v) => {
    setQ(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(v), 300)
  }

  const filtered = tab === 'all' ? results : results.filter(r => r.kind === tab)
  const counts = {}
  results.forEach(r => { counts[r.kind] = (counts[r.kind] || 0) + 1 })
  counts.all = results.length

  const pick = (r) => {
    if (!r) return
    onOpenChange(false)
    setQ('')
    setResults([])
    goSec(r.sec)
  }

  const viewAll = () => {
    onOpenChange(false)
    setQ('')
    setResults([])
    const target = tab === 'all'
      ? (filtered[0]?.sec || (results.find(r => r)?.sec) || 'dashboard')
      : (TABS.find(t => t.id === tab)?.sec || 'dashboard')
    goSec(target)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { onOpenChange(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(filtered.length - 1, i + 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)); return }
    if (e.key === 'Enter' && activeIdx >= 0 && filtered[activeIdx]) { pick(filtered[activeIdx]); return }
    if (e.key === 'Enter' && filtered.length > 0 && q.trim()) { pick(filtered[0]); return }
  }

  const kindIcon = (kind) => {
    const colors = { members: '#4da3ff', orders: '#f5b942', courses: '#e84393', payments: '#2ecc71', products: '#8e44ad' }
    const letters = { members: 'M', orders: 'O', courses: 'C', payments: '৳', products: 'P' }
    return <span style={{ width: 34, height: 34, borderRadius: 9, background: `${colors[kind]}22`, color: colors[kind], display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '.82rem', flexShrink: 0 }}>{letters[kind] || '•'}</span>
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,.04)', border: open ? '1px solid rgba(255,48,58,.55)' : '1px solid rgba(58,23,27,.9)', borderRadius: 12, padding: '0 12px', height: 42, boxShadow: open ? '0 0 0 3px rgba(255,48,58,.12)' : 'none' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#C6B2B5" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input
          ref={inputRef}
          value={q}
          onChange={e => onChange(e.target.value)}
          onFocus={() => onOpenChange(true)}
          onKeyDown={onKeyDown}
          placeholder={tr(lang, 'nav_search_ph')}
          aria-label={tr(lang, 'nav_search_ph')}
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '.9rem' }}
        />
        {q && (
          <button onClick={() => { setQ(''); setResults([]); setSearched(false); inputRef.current?.focus() }} aria-label={tr(lang, 'nav_close')} style={{ background: 'none', border: 'none', color: '#8D7B7F', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        )}
        <span style={{ display: 'flex', gap: 3, alignItems: 'center', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, padding: '2px 7px', fontSize: '.68rem', color: '#C6B2B5', flexShrink: 0 }}>
          <span>Ctrl</span><span style={{ color: '#8D7B7F' }}>K</span>
        </span>
      </div>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: '#160B0D', border: '1px solid #3A171B', borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,.6)', zIndex: 120, overflow: 'hidden', maxHeight: 'min(480px, 70vh)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 2, padding: '10px 10px 6px', overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setActiveIdx(-1) }} style={{ padding: '6px 12px', borderRadius: 20, border: 'none', background: tab === t.id ? 'linear-gradient(135deg,#FF303A,#A80F20)' : 'transparent', color: tab === t.id ? '#fff' : '#C6B2B5', cursor: 'pointer', fontSize: '.8rem', fontWeight: tab === t.id ? 700 : 400, whiteSpace: 'nowrap' }}>
                {tr(lang, t.labelKey)} ({counts[t.id] || 0})
              </button>
            ))}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && <div style={{ padding: 22, textAlign: 'center', color: '#8D7B7F', fontSize: '.88rem' }}>{tr(lang, 'nav_search_loading')}</div>}
            {!loading && !searched && <div style={{ padding: 22, textAlign: 'center', color: '#8D7B7F', fontSize: '.88rem' }}>{tr(lang, 'nav_search_min_chars')}</div>}
            {!loading && searched && filtered.length === 0 && <div style={{ padding: 22, textAlign: 'center', color: '#8D7B7F', fontSize: '.88rem' }}>{tr(lang, 'nav_search_no_results')}</div>}
            {!loading && filtered.map((r, i) => (
              <button key={r.id} onClick={() => pick(r)} onMouseEnter={() => setActiveIdx(i)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', background: activeIdx === i ? 'rgba(255,48,58,.08)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,.04)', cursor: 'pointer', textAlign: 'left' }}>
                {kindIcon(r.kind)}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', color: '#fff', fontSize: '.88rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>
                  <span style={{ display: 'block', color: '#8D7B7F', fontSize: '.76rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</span>
                </span>
                <span style={{ color: '#C6B2B5', fontSize: '.8rem', fontWeight: 600, flexShrink: 0 }}>{r.meta}</span>
                <span style={{ color: '#8D7B7F', fontSize: '.7rem', flexShrink: 0 }}>{tr(lang, `nav_search_${r.kind === 'payments' ? 'payment' : r.kind === 'members' ? 'member' : r.kind === 'orders' ? 'order' : r.kind === 'courses' ? 'course' : 'product'}`)}</span>
                <span style={{ color: '#8D7B7F', flexShrink: 0 }}>›</span>
              </button>
            ))}
          </div>
          {searched && filtered.length > 0 && (
            <button onClick={viewAll} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '13px 14px', background: 'transparent', border: 'none', borderTop: '1px solid rgba(255,255,255,.06)', color: '#fff', cursor: 'pointer', fontSize: '.88rem', fontWeight: 600 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              {tr(lang, 'nav_search_view_all')} “{q}”
              <span style={{ marginLeft: 'auto', color: '#8D7B7F' }}>›</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
