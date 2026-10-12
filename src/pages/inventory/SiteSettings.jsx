import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { err, isFinance } from './common.jsx'

const FIELDS = [
  { key: 'hero_title', label: 'হিরো টাইটেল', group: '🏠 হোমপেজ' },
  { key: 'hero_subtitle', label: 'হিরো সাবটাইটেল', group: '🏠 হোমপেজ' },
  { key: 'course_price', label: 'কোর্স প্রাইস (৳)', group: '🎓 কোর্স', type: 'number' },
  { key: 'bkash_number', label: 'বিকাশ নাম্বার', group: '💳 পেমেন্ট' },
  { key: 'nagad_number', label: 'নগদ নাম্বার', group: '💳 পেমেন্ট' },
  { key: 'rocket_number', label: 'রকেট নাম্বার', group: '💳 পেমেন্ট' },
  { key: 'seminar_day', label: 'সেমিনার বার', group: '📅 সেমিনার' },
  { key: 'seminar_time', label: 'সেমিনার সময়', group: '📅 সেমিনার' },
  { key: 'facebook_url', label: 'ফেসবুক পেজ URL', group: '🔗 সোশ্যাল' },
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
            <input className="inp" type={f.type || 'text'} value={vals[f.key] || ''}
              onChange={e => setVals({ ...vals, [f.key]: e.target.value })} disabled={!fin} />
          </div>
        )
      })}
    </div>
  )
}
