import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { err, isFinance } from './common.jsx'
import { IGear, IBox, IClock, IMoney, IWarn, IChart, IUsers, IOrders, IMembers } from '../../components/icons.jsx'

// ── All settings keys (preserves existing DB schema) ──
const ALL_KEYS = [
  'site_name', 'site_tagline', 'short_description', 'logo_url', 'favicon_url',
  'email', 'phone', 'address', 'support_hours', 'google_map_link',
  'facebook_url', 'youtube_url', 'instagram_url', 'linkedin_url', 'twitter_url',
  'hero_badge', 'hero_title', 'hero_subtitle',
  'course_name', 'course_price', 'course_old_price', 'course_badge',
  'seminar_title', 'seminar_day', 'seminar_time', 'seminar_platform',
  'shop_title', 'shop_subtitle',
  'reviews_title', 'reviews_subtitle',
  'payment_title', 'bkash_number', 'bkash_qr', 'nagad_number', 'nagad_qr',
  'rocket_number', 'rocket_qr', 'binance_uid', 'binance_qr',
  'faq_title', 'footer_about', 'whatsapp_number',
  'privacy_policy_url', 'terms_url', 'about_url',
  'meta_title', 'meta_description', 'meta_keywords', 'og_image',
  'maintenance_mode', 'allow_registration', 'email_notifications', 'default_language',
]

const cardStyle = {
  background: 'linear-gradient(180deg, rgba(20,8,9,.9), rgba(10,4,5,.9))',
  border: '1px solid rgba(232,35,42,.35)',
  borderRadius: 14,
  padding: 22,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  breakInside: 'avoid',
  marginBottom: 18,
}

const cardHeadStyle = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }

const iconBoxStyle = (bg) => ({
  width: 36, height: 36, borderRadius: 10, background: bg,
  display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0,
})

const labelStyle = { display: 'block', fontSize: '.82rem', color: 'var(--silver)', marginBottom: 5, fontWeight: 500 }

const inputStyle = {
  width: '100%', height: 40, padding: '0 12px', background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(255,255,255,.12)', borderRadius: 8,
  color: '#fff', fontSize: '.88rem', outline: 'none', boxSizing: 'border-box',
}

function Field({ label, value, onChange, disabled, type = 'text', placeholder }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {type === 'textarea' ? (
        <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical', fontFamily: 'inherit' }}
          value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} />
      ) : (
        <input style={inputStyle} type={type} value={value || ''}
          onChange={e => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} />
      )}
    </div>
  )
}

function ImageField({ label, value, onUpload, onRemove, disabled, recommended }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {value ? (
          <img src={value} alt={label} style={{ width: 64, height: 64, borderRadius: 8, border: '1px solid var(--border)', objectFit: 'contain', background: '#fff' }} />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: 8, border: '1px dashed var(--border)', display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: '.7rem' }}>No Image</div>
        )}
        <div>
          <div style={{ fontSize: '.82rem', color: 'var(--silver)' }}>Current {label}</div>
          <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>{recommended}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <input type="file" accept="image/*" id={`img-${label}`} style={{ display: 'none' }}
            onChange={e => onUpload(e.target.files?.[0])} disabled={disabled} />
          <label htmlFor={`img-${label}`} className="btn btn-sm" style={{ cursor: 'pointer', display: 'inline-block', fontSize: '.78rem', padding: '5px 10px', borderRadius: 7, border: '1px solid var(--red-bright)', color: 'var(--red-bright)', background: 'transparent' }}>
            Change
          </label>
          {value && !disabled && (
            <button className="btn btn-sm btn-ghost" onClick={onRemove} style={{ fontSize: '.78rem' }}>×</button>
          )}
        </div>
      </div>
    </div>
  )
}

function Toggle({ label, desc, checked, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button onClick={() => !disabled && onChange(!checked)}
        style={{
          width: 42, height: 24, borderRadius: 12, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
          background: checked ? '#e8232a' : 'rgba(255,255,255,.15)', position: 'relative', flexShrink: 0,
          transition: 'background .2s',
        }}>
        <span style={{
          position: 'absolute', top: 3, left: checked ? 22 : 3, width: 18, height: 18,
          borderRadius: '50%', background: '#fff', transition: 'left .2s',
        }} />
      </button>
      <div>
        <div style={{ fontSize: '.85rem', color: '#fff' }}>{label}</div>
        {desc && <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{desc}</div>}
      </div>
    </div>
  )
}

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

  const set = (key, v) => setVals(prev => ({ ...prev, [key]: v }))

  const uploadImage = async (key, file) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('ছবি 5MB-এর কম হতে হবে।'); return }
    setSaving(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `site/${key}.${ext}`
      const { error: upErr } = await supabase.storage.from('cashskillbd').upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('cashskillbd').getPublicUrl(path)
      const url = `${publicUrl}?t=${Date.now()}`
      set(key, url)
      await supabase.from('cashskillbd_site_settings').upsert({ key, value: url, updated_by: session.user.id }, { onConflict: 'key' })
    } catch (e) { err(e) }
    finally { setSaving(false) }
  }

  const save = async () => {
    setSaving(true)
    try {
      for (const key of ALL_KEYS) {
        await supabase.from('cashskillbd_site_settings')
          .upsert({ key, value: vals[key] || '', updated_by: session.user.id }, { onConflict: 'key' })
      }
      alert('✅ সেভ হয়েছে!')
    } catch (e) { err(e) }
    finally { setSaving(false) }
  }

  const isOn = (key) => vals[key] === 'true' || vals[key] === true

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(232,35,42,.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><IGear size={24} /></div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Site Settings</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>Manage your platform information, configuration and preferences.</p>
          </div>
        </div>
        {fin && (
          <button onClick={save} disabled={saving} style={{
            padding: '10px 20px', borderRadius: 10, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, fontSize: '.9rem',
            boxShadow: '0 4px 16px rgba(232,35,42,.35)', opacity: saving ? 0.6 : 1,
          }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </div>

      {/* Settings Grid — 2 columns on desktop */}
      <div style={{ columns: '2 420px', columnGap: 18 }}>

        {/* ── Basic Information ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(232,35,42,.15)')}><IGear size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>Basic Information</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Set your website name, tagline and basic details.</div>
            </div>
          </div>
          <Field label="Website Name" value={vals.site_name} onChange={v => set('site_name', v)} disabled={!fin} placeholder="CashSkillBD" />
          <Field label="Website Tagline" value={vals.site_tagline} onChange={v => set('site_tagline', v)} disabled={!fin} placeholder="Learn • Grow • Succeed" />
          <Field label="Short Description" type="textarea" value={vals.short_description} onChange={v => set('short_description', v)} disabled={!fin} placeholder="CashSkillBD is a complete learning and earning platform." />
          <ImageField label="Logo" value={vals.logo_url} onUpload={f => uploadImage('logo_url', f)} onRemove={() => set('logo_url', '')} disabled={!fin} recommended="Recommended size: 512×512 (PNG)" />
          <ImageField label="Favicon" value={vals.favicon_url} onUpload={f => uploadImage('favicon_url', f)} onRemove={() => set('favicon_url', '')} disabled={!fin} recommended="Recommended size: 64×64 (PNG)" />
        </div>

        {/* ── Contact Information ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(232,35,42,.15)')}><IMembers size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>Contact Information</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Configure your contact details.</div>
            </div>
          </div>
          <Field label="Email Address" type="email" value={vals.email} onChange={v => set('email', v)} disabled={!fin} placeholder="support@cashskillbd.com" />
          <Field label="Phone Number" type="tel" value={vals.phone} onChange={v => set('phone', v)} disabled={!fin} placeholder="+880 1234 567890" />
          <Field label="Address" value={vals.address} onChange={v => set('address', v)} disabled={!fin} placeholder="Dhaka, Bangladesh" />
          <Field label="Support Hours" value={vals.support_hours} onChange={v => set('support_hours', v)} disabled={!fin} placeholder="Sun - Thu, 9:00 AM - 6:00 PM" />
          <Field label="Google Map Link" type="url" value={vals.google_map_link} onChange={v => set('google_map_link', v)} disabled={!fin} placeholder="https://maps.google.com/..." />
        </div>

        {/* ── Social Media Links ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(232,35,42,.15)')}><IOrders size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>Social Media Links</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Add your social media profiles.</div>
            </div>
          </div>
          <Field label="Facebook" type="url" value={vals.facebook_url} onChange={v => set('facebook_url', v)} disabled={!fin} placeholder="https://facebook.com/Cashskill" />
          <Field label="YouTube" type="url" value={vals.youtube_url} onChange={v => set('youtube_url', v)} disabled={!fin} placeholder="https://youtube.com/@cashskillbd" />
          <Field label="Instagram" type="url" value={vals.instagram_url} onChange={v => set('instagram_url', v)} disabled={!fin} placeholder="https://instagram.com/cashskillbd" />
          <Field label="LinkedIn" type="url" value={vals.linkedin_url} onChange={v => set('linkedin_url', v)} disabled={!fin} placeholder="https://linkedin.com/company/cashskillbd" />
          <Field label="Twitter/X" type="url" value={vals.twitter_url} onChange={v => set('twitter_url', v)} disabled={!fin} placeholder="https://twitter.com/cashskillbd" />
        </div>

        {/* ── SEO Settings ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(232,35,42,.15)')}><IChart size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>SEO Settings</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Configure your website SEO meta information.</div>
            </div>
          </div>
          <Field label="Meta Title" value={vals.meta_title} onChange={v => set('meta_title', v)} disabled={!fin} placeholder="CashSkillBD - Learn • Grow • Succeed" />
          <Field label="Meta Description" type="textarea" value={vals.meta_description} onChange={v => set('meta_description', v)} disabled={!fin} placeholder="CashSkillBD is a complete learning and earning platform..." />
          <Field label="Meta Keywords" value={vals.meta_keywords} onChange={v => set('meta_keywords', v)} disabled={!fin} placeholder="cashskillbd, online learning, earn money, skills, freelancing" />
          <ImageField label="OG Image" value={vals.og_image} onUpload={f => uploadImage('og_image', f)} onRemove={() => set('og_image', '')} disabled={!fin} recommended="Recommended size: 1200×630 (PNG)" />
        </div>

        {/* ── Hero Section ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(255,184,77,.15)')}><IBox size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>Hero Section</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Homepage hero banner settings.</div>
            </div>
          </div>
          <Field label="Hero Badge" value={vals.hero_badge} onChange={v => set('hero_badge', v)} disabled={!fin} />
          <Field label="Hero Title" value={vals.hero_title} onChange={v => set('hero_title', v)} disabled={!fin} />
          <Field label="Hero Subtitle" type="textarea" value={vals.hero_subtitle} onChange={v => set('hero_subtitle', v)} disabled={!fin} />
        </div>

        {/* ── Course Section ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(77,163,255,.15)')}><IUsers size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>Course Section</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Survey course configuration.</div>
            </div>
          </div>
          <Field label="Course Name" value={vals.course_name} onChange={v => set('course_name', v)} disabled={!fin} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Course Price (৳)" type="number" value={vals.course_price} onChange={v => set('course_price', v)} disabled={!fin} />
            <Field label="Old Price (৳)" type="number" value={vals.course_old_price} onChange={v => set('course_old_price', v)} disabled={!fin} />
          </div>
          <Field label="Course Badge" value={vals.course_badge} onChange={v => set('course_badge', v)} disabled={!fin} />
        </div>

        {/* ── Seminar Section ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(46,204,113,.15)')}><IClock size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>Seminar Section</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Weekly free seminar settings.</div>
            </div>
          </div>
          <Field label="Seminar Title" value={vals.seminar_title} onChange={v => set('seminar_title', v)} disabled={!fin} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Seminar Day" value={vals.seminar_day} onChange={v => set('seminar_day', v)} disabled={!fin} placeholder="Friday" />
            <Field label="Seminar Time" value={vals.seminar_time} onChange={v => set('seminar_time', v)} disabled={!fin} placeholder="9:00 PM" />
          </div>
          <Field label="Platform" value={vals.seminar_platform} onChange={v => set('seminar_platform', v)} disabled={!fin} placeholder="Zoom / Google Meet" />
        </div>

        {/* ── Shop / Reviews / FAQ ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(255,107,214,.15)')}><IBox size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>Shop, Reviews & FAQ</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Section titles and subtitles.</div>
            </div>
          </div>
          <Field label="Shop Title" value={vals.shop_title} onChange={v => set('shop_title', v)} disabled={!fin} />
          <Field label="Shop Subtitle" value={vals.shop_subtitle} onChange={v => set('shop_subtitle', v)} disabled={!fin} />
          <Field label="Reviews Title" value={vals.reviews_title} onChange={v => set('reviews_title', v)} disabled={!fin} />
          <Field label="Reviews Subtitle" value={vals.reviews_subtitle} onChange={v => set('reviews_subtitle', v)} disabled={!fin} />
          <Field label="FAQ Title" value={vals.faq_title} onChange={v => set('faq_title', v)} disabled={!fin} />
        </div>

        {/* ── Payment Settings ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(245,185,66,.15)')}><IMoney size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>Payment Settings</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Payment methods and QR codes.</div>
            </div>
          </div>
          <Field label="Payment Title" value={vals.payment_title} onChange={v => set('payment_title', v)} disabled={!fin} />
          <Field label="bKash Number" type="tel" value={vals.bkash_number} onChange={v => set('bkash_number', v)} disabled={!fin} />
          <ImageField label="bKash QR" value={vals.bkash_qr} onUpload={f => uploadImage('bkash_qr', f)} onRemove={() => set('bkash_qr', '')} disabled={!fin} recommended="QR code image" />
          <Field label="Nagad Number" type="tel" value={vals.nagad_number} onChange={v => set('nagad_number', v)} disabled={!fin} />
          <ImageField label="Nagad QR" value={vals.nagad_qr} onUpload={f => uploadImage('nagad_qr', f)} onRemove={() => set('nagad_qr', '')} disabled={!fin} recommended="QR code image" />
          <Field label="Rocket Number" type="tel" value={vals.rocket_number} onChange={v => set('rocket_number', v)} disabled={!fin} />
          <ImageField label="Rocket QR" value={vals.rocket_qr} onUpload={f => uploadImage('rocket_qr', f)} onRemove={() => set('rocket_qr', '')} disabled={!fin} recommended="QR code image" />
          <Field label="Binance UID" value={vals.binance_uid} onChange={v => set('binance_uid', v)} disabled={!fin} />
          <ImageField label="Binance QR" value={vals.binance_qr} onUpload={f => uploadImage('binance_qr', f)} onRemove={() => set('binance_qr', '')} disabled={!fin} recommended="QR code image" />
        </div>

        {/* ── Footer Settings ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(232,35,42,.15)')}><IOrders size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>Footer Settings</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Update your footer information.</div>
            </div>
          </div>
          <Field label="Footer Description" type="textarea" value={vals.footer_about} onChange={v => set('footer_about', v)} disabled={!fin} placeholder="© 2025 CashSkillBD. All rights reserved." />
          <Field label="WhatsApp Number" type="tel" value={vals.whatsapp_number} onChange={v => set('whatsapp_number', v)} disabled={!fin} />
          <Field label="Privacy Policy URL" type="url" value={vals.privacy_policy_url} onChange={v => set('privacy_policy_url', v)} disabled={!fin} placeholder="https://cashskillbd.com/privacy-policy" />
          <Field label="Terms of Service URL" type="url" value={vals.terms_url} onChange={v => set('terms_url', v)} disabled={!fin} placeholder="https://cashskillbd.com/terms-of-service" />
          <Field label="About Us URL" type="url" value={vals.about_url} onChange={v => set('about_url', v)} disabled={!fin} placeholder="https://cashskillbd.com/about" />
        </div>

        {/* ── Additional Settings ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(232,35,42,.15)')}><IGear size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>Additional Settings</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Manage other website settings.</div>
            </div>
          </div>
          <Toggle label="Maintenance Mode" desc="Enable to put the site in maintenance mode" checked={isOn('maintenance_mode')} onChange={v => set('maintenance_mode', String(v))} disabled={!fin} />
          <Toggle label="Allow Registration" desc="Allow new user registrations" checked={vals.allow_registration !== 'false'} onChange={v => set('allow_registration', String(v))} disabled={!fin} />
          <Toggle label="Email Notifications" desc="Send email notifications for important events" checked={vals.email_notifications !== 'false'} onChange={v => set('email_notifications', String(v))} disabled={!fin} />
          <div>
            <label style={labelStyle}>Default Language</label>
            <select
              value={vals.default_language || 'en'}
              onChange={e => set('default_language', e.target.value)}
              disabled={!fin}
              style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
            >
              <option value="bn">বাংলা (Bengali)</option>
              <option value="en">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="ar">العربية (Arabic)</option>
              <option value="zh">简体中文 (Chinese)</option>
              <option value="hi">हिन्दी (Hindi)</option>
              <option value="ur">اردو (Urdu)</option>
            </select>
          </div>
        </div>

      </div>
    </div>
  )
}
