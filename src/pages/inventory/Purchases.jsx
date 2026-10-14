import { useEffect, useState } from 'react'
import { manageApi } from '../../lib/manageApi.js'
import { useLang } from '../../i18n/LanguageContext.jsx'
import { tr } from '../../i18n/translations.js'
import { money, dstr, err, isFinance, Tbl, Empty, LoadMore } from './common.jsx'

const PAGE = 20

export function Purchases({ session, role }) {
  const { lang } = useLang()
  const fin = isFinance(role)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [moreLoading, setMoreLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [form, setForm] = useState({ product_id: '', supplier_id: '', qty: '', unit_cost: '', currency: 'BDT' })
  const [busy, setBusy] = useState(false)

  const load = async (reset = true, cur = null) => {
    const curItems = cur || items
    const off = reset ? 0 : curItems.length
    reset ? setLoading(true) : setMoreLoading(true)
    try {
      const j = await manageApi(session, 'purchase.list', { limit: PAGE, offset: off })
      const list = j.items || []
      setItems(reset ? list : [...curItems, ...list])
      setHasMore(list.length === PAGE)
    } catch (e) { err(e) }
    setLoading(false); setMoreLoading(false)
  }

  useEffect(() => {
    load(true, [])
    manageApi(session, 'product.list', { limit: 100 }).then(j => setProducts(j.items || [])).catch(() => {})
    manageApi(session, 'supplier.list').then(j => setSuppliers(j.items || [])).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async (e) => {
    e.preventDefault()
    if (!form.product_id || !form.qty) return alert(tr(lang, 'purch_err_product_qty'))
    setBusy(true)
    try {
      await manageApi(session, 'purchase.record', {
        product_id: Number(form.product_id),
        supplier_id: form.supplier_id || undefined,
        qty: Number(form.qty),
        unit_cost: form.unit_cost === '' ? 0 : form.unit_cost,
        currency: form.currency,
      })
      setForm({ product_id: '', supplier_id: '', qty: '', unit_cost: '', currency: 'BDT' })
      load(true, [])
    } catch (e) { err(e) }
    setBusy(false)
  }

  const F = (k, v) => setForm({ ...form, [k]: v })

  return (
    <div>
      <h3 style={{ margin: '26px 0 14px' }}>{tr(lang, 'purch_title')}</h3>
      {fin ? (
        <div className="card form-card" style={{ marginBottom: 24 }}>
          <form onSubmit={save}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <div>
                <label>{tr(lang, 'purch_product')}</label>
                <select value={form.product_id} onChange={e => F('product_id', e.target.value)}>
                  <option value="">{tr(lang, 'purch_select')}</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku}) — {p.currency}</option>)}
                </select>
              </div>
              <div>
                <label>{tr(lang, 'purch_supplier')}</label>
                <select value={form.supplier_id} onChange={e => F('supplier_id', e.target.value)}>
                  <option value="">{tr(lang, 'purch_none')}</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
              <div>
                <label>{tr(lang, 'purch_qty')}</label>
                <input type="number" min="1" value={form.qty} onChange={e => F('qty', e.target.value)} />
              </div>
              <div>
                <label>{tr(lang, 'purch_unit_cost')}</label>
                <input type="number" min="0" step="0.01" value={form.unit_cost} onChange={e => F('unit_cost', e.target.value)} />
              </div>
              <div>
                <label>{tr(lang, 'purch_currency')}</label>
                <select value={form.currency} onChange={e => F('currency', e.target.value)}>
                  <option value="BDT">BDT (৳)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>
            <button className="btn" disabled={busy}>{busy ? tr(lang, 'purch_saving') : tr(lang, 'purch_record')}</button>
          </form>
          <p style={{ color: 'var(--muted)', fontSize: '.88rem', marginTop: 10 }}>{tr(lang, 'purch_note')}</p>
        </div>
      ) : (
        <p style={{ color: 'var(--muted)', marginBottom: 16 }}>{tr(lang, 'purch_finance_only')}</p>
      )}

      <h3 style={{ margin: '0 0 14px' }}>{tr(lang, 'purch_history')}</h3>
      {loading ? <p style={{ color: 'var(--muted)' }}>{tr(lang, 'purch_loading')}</p> : (
        <Tbl>
          <thead><tr><th>{tr(lang, 'purch_th_date')}</th><th>{tr(lang, 'purch_th_product')}</th><th>{tr(lang, 'purch_th_supplier')}</th><th>{tr(lang, 'purch_th_qty')}</th><th>{tr(lang, 'purch_th_unit')}</th><th>{tr(lang, 'purch_th_total')}</th></tr></thead>
          <tbody>
            {items.map(pu => (
              <tr key={pu.id}>
                <td>{dstr(pu.purchased_at)}</td>
                <td><b>{pu.cashskillbd_products?.name || '—'}</b><br /><small style={{ color: 'var(--muted)' }}><code>{pu.cashskillbd_products?.sku}</code></small></td>
                <td>{pu.cashskillbd_suppliers?.name || '—'}</td>
                <td>{pu.qty}</td>
                <td>{money(pu.unit_cost, pu.currency)}</td>
                <td><b>{money(pu.total_cost, pu.currency)}</b></td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      )}
      {!loading && items.length === 0 && <Empty text={tr(lang, 'purch_empty')} />}
      <LoadMore hasMore={hasMore} loading={moreLoading} onMore={() => load(false)} />
    </div>
  )
}
