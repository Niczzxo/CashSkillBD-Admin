import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'
import { useLang } from '../../i18n/LanguageContext.jsx'
import { tr } from '../../i18n/translations.js'

const catMeta = (c, lang) => {
  const CATEGORY_META = {
    vps: { label: tr(lang, 'ph_cat_vps'), color: '#c084fc', bg: 'rgba(192,132,252,.15)' },
    ip: { label: tr(lang, 'ph_cat_ip'), color: '#4da3ff', bg: 'rgba(77,163,255,.15)' },
    number: { label: tr(lang, 'ph_cat_number'), color: '#ff6b6b', bg: 'rgba(232,35,42,.15)' },
    course: { label: tr(lang, 'ph_cat_course'), color: '#2ecc71', bg: 'rgba(46,204,113,.15)' },
    dollar: { label: tr(lang, 'ph_cat_dollar'), color: '#f5b942', bg: 'rgba(245,185,66,.15)' },
    service: { label: tr(lang, 'ph_cat_service'), color: '#00cec9', bg: 'rgba(0,206,201,.15)' },
    account: { label: tr(lang, 'ph_cat_account'), color: '#e84393', bg: 'rgba(232,67,147,.15)' },
  }
  return CATEGORY_META[(c || '').toLowerCase()] || { label: c || tr(lang, 'ph_cat_other'), color: '#8e44ad', bg: 'rgba(142,68,173,.15)' }
}

export function PriceHistory({ session }) {
  const { lang } = useLang()
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(() => new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10))
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [productF, setProductF] = useState('all')
  const [search, setSearch] = useState('')
  const [catF, setCatF] = useState('all')
  const [changeF, setChangeF] = useState('all')
  const [userF, setUserF] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [detail, setDetail] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [h, p] = await Promise.all([
        manageApi(session, 'price.history_all', { limit: 1000, offset: 0 }),
        manageApi(session, 'product.list', { limit: 500, offset: 0 }).catch(() => ({ items: [] })),
      ])
      setItems(h.items || [])
      setProducts(p.items || [])
    } catch (e) { alert(e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Enrich ──
  const enriched = items.map(h => {
    const prod = h.cashskillbd_products || products.find(p => String(p.id) === String(h.product_id)) || {}
    const oldPrice = Number(h.old_price || 0)
    const newPrice = Number(h.new_price || 0)
    const change = newPrice - oldPrice
    const changePct = oldPrice !== 0 ? (change / oldPrice) * 100 : (newPrice !== 0 ? 100 : 0)
    return {
      ...h, prodName: prod.name || (tr(lang, 'ph_product_hash') + h.product_id), sku: prod.sku || '—',
      category: prod.category || '—', oldPrice, newPrice, change, changePct,
      currency: h.currency || 'BDT',
    }
  })

  // ── Stats (on date-filtered data) ──
  const dateFiltered = enriched.filter(h => {
    const d = h.changed_at.slice(0, 10)
    return d >= from && d <= to
  })
  const totalChanges = dateFiltered.length
  const productsAffected = new Set(dateFiltered.map(h => h.product_id)).size
  const increases = dateFiltered.filter(h => h.change > 0)
  const decreases = dateFiltered.filter(h => h.change < 0)
  const avgIncrease = increases.length > 0 ? increases.reduce((s, h) => s + h.changePct, 0) / increases.length : 0
  const avgDecrease = decreases.length > 0 ? Math.abs(decreases.reduce((s, h) => s + h.changePct, 0) / decreases.length) : 0

  // ── Filters ──
  let list = dateFiltered
  if (productF !== 'all') list = list.filter(h => String(h.product_id) === String(productF))
  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter(h => h.prodName.toLowerCase().includes(q) || h.sku.toLowerCase().includes(q) || (h.notes || '').toLowerCase().includes(q))
  }
  if (catF !== 'all') list = list.filter(h => (h.category || '').toLowerCase() === catF)
  if (changeF !== 'all') list = list.filter(h => changeF === 'increased' ? h.change > 0 : h.change < 0)
  if (userF !== 'all') list = list.filter(h => String(h.changed_by) === String(userF))

  const clearFilters = () => { setSearch(''); setCatF('all'); setChangeF('all'); setUserF('all'); setProductF('all'); setPage(1) }

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const pageItems = list.slice((curPage - 1) * pageSize, curPage * pageSize)

  const categories = [...new Set(enriched.map(h => (h.category || 'Other').toLowerCase()))]
  const users = [...new Set(enriched.map(h => h.changed_by).filter(Boolean))]

  const avatarColors = ['#e8232a', '#4da3ff', '#2ecc71', '#f5b942', '#e84393', '#8e44ad', '#00cec9']
  const initials = (id) => `A${String(id || '').slice(-1)}`

  const stats = [
    { label: tr(lang, 'ph_stat_total'), value: totalChanges.toLocaleString(), desc: tr(lang, 'ph_stat_total_desc'), color: '#ff6b6b', bg: 'rgba(232,35,42,.15)', icon: '🏷' },
    { label: tr(lang, 'ph_stat_affected'), value: productsAffected.toLocaleString(), desc: tr(lang, 'ph_stat_affected_desc'), color: '#4da3ff', bg: 'rgba(77,163,255,.15)', icon: '📦' },
    { label: tr(lang, 'ph_stat_avg_inc'), value: `${avgIncrease.toFixed(1)}%`, desc: tr(lang, 'ph_stat_avg_inc_desc'), color: '#f5b942', bg: 'rgba(245,185,66,.15)', icon: '📈' },
    { label: tr(lang, 'ph_stat_avg_dec'), value: `${avgDecrease.toFixed(1)}%`, desc: tr(lang, 'ph_stat_avg_dec_desc'), color: '#c084fc', bg: 'rgba(192,132,252,.15)', icon: '📉' },
  ]

  const selStyle = {
    padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 8, color: '#fff', fontSize: '.82rem', outline: 'none', cursor: 'pointer',
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>🕘</div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>{tr(lang, 'ph_title')}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'ph_subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 9, padding: '6px 10px' }}>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '.85rem', colorScheme: 'dark' }} />
            <span style={{ color: 'var(--muted)', fontSize: '.82rem' }}>{tr(lang, 'ph_to')}</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '.85rem', colorScheme: 'dark' }} />
          </div>
          <select value={productF} onChange={e => { setProductF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 150 }}>
            <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'ph_all_products')}</option>
            {products.map(p => <option key={p.id} value={p.id} style={{ background: '#1a0d0e' }}>{p.name}</option>)}
          </select>
          <button onClick={load} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem', boxShadow: '0 4px 16px rgba(232,35,42,.35)' }}>{tr(lang, 'ph_view_history')}</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: 190, background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: `1px solid ${s.color}55`, borderRadius: 14, padding: 18, display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: s.bg, display: 'grid', placeItems: 'center', fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{s.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <input placeholder={tr(lang, 'ph_search_ph')} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 220, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: '.85rem', outline: 'none' }} />
        <select value={catF} onChange={e => { setCatF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 140 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'ph_all_categories')}</option>
          {categories.map(c => <option key={c} value={c} style={{ background: '#1a0d0e' }}>{catMeta(c, lang).label}</option>)}
        </select>
        <select value={changeF} onChange={e => { setChangeF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 140 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'ph_all_change_types')}</option>
          <option value="increased" style={{ background: '#1a0d0e' }}>{tr(lang, 'ph_increased')}</option>
          <option value="decreased" style={{ background: '#1a0d0e' }}>{tr(lang, 'ph_decreased')}</option>
        </select>
        <select value={userF} onChange={e => { setUserF(e.target.value); setPage(1) }} style={{ ...selStyle, minWidth: 130 }}>
          <option value="all" style={{ background: '#1a0d0e' }}>{tr(lang, 'ph_all_users')}</option>
          {users.map(u => <option key={u} value={u} style={{ background: '#1a0d0e' }}>{tr(lang, 'ph_admin')} {String(u).slice(0, 8)}</option>)}
        </select>
        <button onClick={load} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.85rem' }}>{tr(lang, 'ph_filter')}</button>
        <button onClick={clearFilters} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '.85rem' }}>{tr(lang, 'ph_reset')}</button>
      </div>

      {/* Table */}
      <div style={{ background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))', border: '1px solid rgba(232,35,42,.35)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                {['#', tr(lang, 'ph_th_date'), tr(lang, 'ph_th_product'), tr(lang, 'ph_th_category'), tr(lang, 'ph_th_prev'), tr(lang, 'ph_th_new'), tr(lang, 'ph_th_change'), tr(lang, 'ph_th_change_pct'), tr(lang, 'ph_th_changed_by'), tr(lang, 'ph_th_reason'), tr(lang, 'ph_th_actions')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((h, i) => {
                const cm = catMeta(h.category, lang)
                const up = h.change > 0
                const down = h.change < 0
                const curSymbol = h.currency === 'USD' ? '$' : '৳'
                return (
                  <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '.85rem' }}>{(curPage - 1) * pageSize + i + 1}</td>
                    <td style={{ padding: '12px 14px', fontSize: '.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {new Date(h.changed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}<br />
                      <span style={{ fontSize: '.72rem' }}>{new Date(h.changed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div>
                        <div style={{ color: '#fff', fontSize: '.88rem', fontWeight: 600 }}>{h.prodName}</div>
                        <div style={{ color: 'var(--muted)', fontSize: '.74rem' }}>{tr(lang, 'ph_sku')} {h.sku}</div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}><span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.74rem', fontWeight: 600, background: cm.bg, color: cm.color }}>{cm.label}</span></td>
                    <td style={{ padding: '12px 14px', color: 'var(--silver)', fontSize: '.88rem', whiteSpace: 'nowrap' }}>{curSymbol} {h.oldPrice.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px 14px', color: '#fff', fontSize: '.88rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{curSymbol} {h.newPrice.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {h.change === 0 ? (
                        <span style={{ color: 'var(--muted)', fontSize: '.85rem' }}>—</span>
                      ) : (
                        <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.78rem', fontWeight: 600, background: up ? 'rgba(46,204,113,.15)' : 'rgba(232,35,42,.15)', color: up ? '#2ecc71' : '#ff6b6b' }}>
                          {up ? '↑' : '↓'} {up ? '+' : ''}{curSymbol} {Math.abs(h.change).toLocaleString('en-IN')}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {h.change === 0 ? (
                        <span style={{ color: 'var(--muted)', fontSize: '.85rem' }}>—</span>
                      ) : (
                        <span style={{ padding: '4px 10px', borderRadius: 7, fontSize: '.78rem', fontWeight: 600, background: up ? 'rgba(46,204,113,.15)' : 'rgba(232,35,42,.15)', color: up ? '#2ecc71' : '#ff6b6b' }}>
                          {up ? '↑' : '↓'} {up ? '+' : ''}{h.changePct.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: avatarColors[String(h.changed_by || '').length % avatarColors.length], display: 'grid', placeItems: 'center', fontSize: '.68rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials(h.changed_by)}</div>
                        <span style={{ color: 'var(--silver)', fontSize: '.85rem' }}>{tr(lang, 'ph_admin')} {String(h.changed_by || '').slice(0, 8)}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '.82rem', color: 'var(--muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.notes || h.reason || tr(lang, 'ph_price_updated')}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <button title={tr(lang, 'ph_view')} onClick={() => setDetail(h)} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(232,35,42,.4)', background: 'rgba(232,35,42,.1)', color: '#ff6b6b', cursor: 'pointer' }}>👁</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pageItems.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '1rem', color: '#fff', marginBottom: 4 }}>{tr(lang, 'ph_empty_title')}</div>
            <div style={{ fontSize: '.85rem' }}>{tr(lang, 'ph_empty_sub')}</div>
          </div>
        )}
        {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>{tr(lang, 'ph_loading')}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{tr(lang, 'ph_showing')} {list.length === 0 ? 0 : (curPage - 1) * pageSize + 1} {tr(lang, 'ph_showing_to')} {Math.min(curPage * pageSize, list.length)} {tr(lang, 'ph_showing_of')} {list.length.toLocaleString()} {tr(lang, 'ph_showing_records')}</span>
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
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} style={{ marginLeft: 8, padding: '6px 8px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 7, color: '#fff', fontSize: '.82rem', cursor: 'pointer' }}>
              {[10, 25, 50, 100].map(n => <option key={n} value={n} style={{ background: '#1a0d0e' }}>{n} {tr(lang, 'ph_per_page')}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setDetail(null)}>
          <div style={{ background: '#140809', border: '1px solid rgba(232,35,42,.4)', borderRadius: 16, padding: 24, maxWidth: 480, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#fff' }}>{tr(lang, 'ph_detail_title')}</h3>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: '.9rem' }}>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ph_d_product')}{' '}</span><b style={{ color: '#fff' }}>{detail.prodName}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ph_d_sku')}{' '}</span><b style={{ color: '#fff' }}>{detail.sku}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ph_d_category')}{' '}</span><b style={{ color: '#fff' }}>{catMeta(detail.category, lang).label}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ph_d_prev')}{' '}</span><b style={{ color: '#fff' }}>{detail.currency === 'USD' ? '$' : '৳'}{detail.oldPrice.toLocaleString('en-IN')}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ph_d_new')}{' '}</span><b style={{ color: '#fff' }}>{detail.currency === 'USD' ? '$' : '৳'}{detail.newPrice.toLocaleString('en-IN')}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ph_d_change')}{' '}</span><b style={{ color: detail.change > 0 ? '#2ecc71' : detail.change < 0 ? '#ff6b6b' : '#fff' }}>{detail.change > 0 ? '+' : ''}{detail.currency === 'USD' ? '$' : '৳'}{detail.change.toLocaleString('en-IN')} ({detail.changePct.toFixed(1)}%)</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ph_d_changed_at')}{' '}</span>{new Date(detail.changed_at).toLocaleString('en-GB')}</div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ph_d_changed_by')}{' '}</span><b style={{ color: '#fff' }}>{tr(lang, 'ph_admin')} {String(detail.changed_by || '').slice(0, 8)}</b></div>
              <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ph_d_reason')}{' '}</span><span style={{ color: 'var(--silver)' }}>{detail.notes || detail.reason || tr(lang, 'ph_price_updated')}</span></div>
              {detail.old_cost != null && <div><span style={{ color: 'var(--muted)' }}>{tr(lang, 'ph_d_cost')}{' '}</span><b style={{ color: '#fff' }}>{detail.currency === 'USD' ? '$' : '৳'}{Number(detail.old_cost).toLocaleString('en-IN')} → {detail.currency === 'USD' ? '$' : '৳'}{Number(detail.new_cost || 0).toLocaleString('en-IN')}</b></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
