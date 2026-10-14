import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { err, isFinance } from './common.jsx'

const FIELDS = [
  // ── Hero Section ──
  { key: 'hero_badge', label: 'হিরো ব্যাজ', group: '🦸 হিরো সেকশন' },
  { key: 'hero_title', label: 'হিরো টাইটেল', group: '🦸 হিরো সেকশন' },
  { key: 'hero_subtitle', label: 'হিরো সাবটাইটেল', group: '🦸 হিরো সেকশন' },
  // ── Course Section ──
  { key: 'course_name', label: 'কোর্সের নাম', group: '🎓 কোর্স সেকশন' },
  { key: 'course_price', label: 'কোর্স প্রাইস (৳)', group: '🎓 কোর্স সেকশন', type: 'number' },
  { key: 'course_old_price', label: 'পুরনো প্রাইস (৳)', group: '🎓 কোর্স সেকশন', type: 'number' },
  { key: 'course_badge', label: 'কোর্স ব্যাজ', group: '🎓 কোর্স সেকশন' },
  // ── Seminar Section ──
  { key: 'seminar_title', label: 'সেমিনার টাইটেল', group: '📅 সেমিনার সেকশন' },
  { key: 'seminar_day', label: 'সেমিনার বার', group: '📅 সেমিনার সেকশন' },
  { key: 'seminar_time', label: 'সেমিনার সময়', group: '📅 সেমিনার সেকশন' },
  { key: 'seminar_platform', label: 'প্ল্যাটফর্ম (Zoom)', group: '📅 সেমিনার সেকশন' },
  // ── Shop Section ──
  { key: 'shop_title', label: 'শপ টাইটেল', group: '🛒 শপ সেকশন' },
  { key: 'shop_subtitle', label: 'শপ সাবটাইটেল', group: '🛒 শপ সেকশন' },
  // ── Reviews Section ──
  { key: 'reviews_title', label: 'রিভিউ টাইটেল', group: '⭐ রিভিউ সেকশন' },
  { key: 'reviews_subtitle', label: 'রিভিউ সাবটাইটেল', group: '⭐ রিভিউ সেকশন' },
  // ── Payment Section ──
  { key: 'payment_title', label: 'পেমেন্ট টাইটেল', group: '💳 পেমেন্ট সেকশন' },
  { key: 'bkash_number', label: 'বিকাশ নাম্বার', group: '💳 পেমেন্ট সেকশন' },
  { key: 'bkash_qr', label: 'বিকাশ QR কোড', group: '💳 পেমেন্ট সেকশন', type: 'qr' },
  { key: 'nagad_number', label: 'নগদ নাম্বার', group: '💳 পেমেন্ট সেকশন' },
  { key: 'nagad_qr', label: 'নগদ QR কোড', group: '💳 পেমেন্ট সেকশন', type: 'qr' },
  { key: 'rocket_number', label: 'রকেট নাম্বার', group: '💳 পেমেন্ট সেকশন' },
  { key: 'rocket_qr', label: 'রকেট QR কোড', group: '💳 পেমেন্ট সেকশন', type: 'qr' },
  { key: 'binance_uid', label: 'বাইনান্স UID', group: '💳 পেমেন্ট সেকশন' },
  { key: 'binance_qr', label: 'বাইনান্স QR কোড', group: '💳 পেমেন্ট সেকশন', type: 'qr' },
  // ── FAQ Section ──
  { key: 'faq_title', label: 'FAQ টাইটেল', group: '❓ FAQ সেকশন' },
  // ── Footer Section ──
  { key: 'footer_about', label: 'ফুটার বর্ণনা', group: '🦶 ফুটার সেকশন' },
  { key: 'whatsapp_number', label: 'হোয়াটসঅ্যাপ নাম্বার', group: '🦶 ফুটার সেকশন' },
  { key: 'support_hours', label: 'সাপোর্ট সময়', group: '🦶 ফুটার সেকশন' },
  { key: 'facebook_url', label: 'ফেসবুক পেজ URL', group: '🦶 ফুটার সেকশন' },
]

export function SiteSettings({ session, role }) {
  const [vals, setVals] = useState({})
  const [saving, setSaving] = useState(false)
  const fin = isFinance(role)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('cashskillbd_site_settings').select('*')
      const o = {}
      ;(data || []).forEach(r => { o[r.key] = r.value })
      setVals(o)
    })()
  }, [])

  const uploadQR = async (key, file) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('ছবি 5MB-এর কম হতে হবে।'); return }
    setSaving(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `qr/${key}.${ext}`
      const { error: upErr } = await supabase.storage.from('cashskillbd').upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('cashskillbd').getPublicUrl(path)
      const url = `${publicUrl}?t=${Date.now()}`
      setVals(v => ({ ...v, [key]: url }))
      // save immediately
      await supabase.from('cashskillbd_site_settings').upsert({ key, value: url, updated_by: session.user.id }, { onConflict: 'key' })
    } catch (e) { err(e) }
    finally { setSaving(false) }
  }

  const save = async () => {
    setSaving(true)
    try {
      for (const f of FIELDS) {
        await supabase.from('cashskillbd_site_settings')
          .upsert({ key: f.key, value: vals[f.key] || '', updated_by: session.user.id }, { onConflict: 'key' })
      }
      alert('✅ সেভ হয়েছে!')
    } catch (e) { err(e) }
    finally { setSaving(false) }
  }

  let lastGroup = null
  return (
    <div>
      <div className="sec-head">
        <h3>⚙️ সাইট সেটিংস</h3>
        <div className="spacer" />
        {fin && <button className="btn btn-sm" onClick={save} disabled={saving}>{saving ? 'সেভ হচ্ছে…' : '💾 সেভ করো'}</button>}
      </div>
      <p style={{color:'var(--muted)', marginBottom:18}}>পাবলিক ওয়েবসাইটের সব তথ্য এখান থেকে এডিট করো — সেভ করলেই সাইটে আপডেট হবে।</p>
      {FIELDS.map(f => {
        const showGroup = f.group !== lastGroup
        lastGroup = f.group
        return (
          <div key={f.key}>
            {showGroup && <h4 style={{margin:'18px 0 10px', color:'var(--gold)'}}>{f.group}</h4>}
            <label className="f-label">{f.label}</label>
            {f.type === 'qr' ? (
              <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:12}}>
                {vals[f.key] ? (
                  <img src={vals[f.key]} alt="QR" style={{width:100, height:100, borderRadius:8, border:'1px solid var(--border)', objectFit:'contain', background:'#fff'}} />
                ) : (
                  <div style={{width:100, height:100, borderRadius:8, border:'1px dashed var(--border)', display:'grid', placeItems:'center', color:'var(--muted)', fontSize:'.8rem'}}>কোনো QR নেই</div>
                )}
                <div>
                  <input type="file" accept="image/*" id={`qr-${f.key}`} style={{display:'none'}}
                    onChange={e => uploadQR(f.key, e.target.files?.[0])} disabled={!fin} />
                  <label htmlFor={`qr-${f.key}`} className="btn btn-sm" style={{cursor:'pointer', display:'inline-block'}}>
                    📷 QR আপলোড
                  </label>
                  {vals[f.key] && fin && (
                    <button className="btn btn-sm btn-ghost" style={{marginLeft:8}}
                      onClick={() => setVals({ ...vals, [f.key]: '' })}>🗑️ সরান</button>
                  )}
                </div>
              </div>
            ) : (
              <input className="inp" type={f.type || 'text'} value={vals[f.key] || ''}
                onChange={e => setVals({ ...vals, [f.key]: e.target.value })} disabled={!fin} />
            )}
          </div>
        )
      })}
    </div>
  )
}
