import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { err, isFinance } from './common.jsx'
import { IGear, IBox, IClock, IMoney, IWarn, IChart, IUsers, IOrders, IMembers } from '../../components/icons.jsx'
import { useLang } from '../../i18n/LanguageContext.jsx'
import { tr } from '../../i18n/translations.js'

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
  const { lang } = useLang()
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {value ? (
          <img src={value} alt={label} style={{ width: 64, height: 64, borderRadius: 8, border: '1px solid var(--border)', objectFit: 'contain', background: '#fff' }} />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: 8, border: '1px dashed var(--border)', display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: '.7rem' }}>{tr(lang, 'ss_no_image')}</div>
        )}
        <div>
          <div style={{ fontSize: '.82rem', color: 'var(--silver)' }}>{tr(lang, 'ss_current')} {label}</div>
          <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>{recommended}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <input type="file" accept="image/*" id={`img-${label}`} style={{ display: 'none' }}
            onChange={e => onUpload(e.target.files?.[0])} disabled={disabled} />
          <label htmlFor={`img-${label}`} className="btn btn-sm" style={{ cursor: 'pointer', display: 'inline-block', fontSize: '.78rem', padding: '5px 10px', borderRadius: 7, border: '1px solid var(--red-bright)', color: 'var(--red-bright)', background: 'transparent' }}>
            {tr(lang, 'ss_change')}
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
  const { lang } = useLang()
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
    if (file.size > 5 * 1024 * 1024) { alert(tr(lang, 'ss_alert_image_size')); return }
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
      alert(tr(lang, 'ss_alert_saved'))
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
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>{tr(lang, 'ss_title')}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>{tr(lang, 'ss_subtitle')}</p>
          </div>
        </div>
        {fin && (
          <button onClick={save} disabled={saving} style={{
            padding: '10px 20px', borderRadius: 10, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            background: 'linear-gradient(135deg, #e8232a, #b01020)', color: '#fff', fontWeight: 600, fontSize: '.9rem',
            boxShadow: '0 4px 16px rgba(232,35,42,.35)', opacity: saving ? 0.6 : 1,
          }}>
            {saving ? tr(lang, 'ss_saving') : tr(lang, 'ss_save_changes')}
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
              <div style={{ fontWeight: 700, color: '#fff' }}>{tr(lang, 'ss_basic_title')}</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'ss_basic_desc')}</div>
            </div>
          </div>
          <Field label={tr(lang, 'ss_f_site_name')} value={vals.site_name} onChange={v => set('site_name', v)} disabled={!fin} placeholder="CashSkillBD" />
          <Field label={tr(lang, 'ss_f_tagline')} value={vals.site_tagline} onChange={v => set('site_tagline', v)} disabled={!fin} placeholder="Learn • Grow • Succeed" />
          <Field label={tr(lang, 'ss_f_short_desc')} type="textarea" value={vals.short_description} onChange={v => set('short_description', v)} disabled={!fin} placeholder={tr(lang, 'ss_ph_short_desc')} />
          <ImageField label={tr(lang, 'ss_f_logo')} value={vals.logo_url} onUpload={f => uploadImage('logo_url', f)} onRemove={() => set('logo_url', '')} disabled={!fin} recommended={tr(lang, 'ss_rec_logo')} />
          <ImageField label={tr(lang, 'ss_f_favicon')} value={vals.favicon_url} onUpload={f => uploadImage('favicon_url', f)} onRemove={() => set('favicon_url', '')} disabled={!fin} recommended={tr(lang, 'ss_rec_favicon')} />
        </div>

        {/* ── Contact Information ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(232,35,42,.15)')}><IMembers size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>{tr(lang, 'ss_contact_title')}</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'ss_contact_desc')}</div>
            </div>
          </div>
          <Field label={tr(lang, 'ss_f_email')} type="email" value={vals.email} onChange={v => set('email', v)} disabled={!fin} placeholder="support@cashskillbd.com" />
          <Field label={tr(lang, 'ss_f_phone')} type="tel" value={vals.phone} onChange={v => set('phone', v)} disabled={!fin} placeholder="+880 1234 567890" />
          <Field label={tr(lang, 'ss_f_address')} value={vals.address} onChange={v => set('address', v)} disabled={!fin} placeholder={tr(lang, 'ss_ph_address')} />
          <Field label={tr(lang, 'ss_f_support_hours')} value={vals.support_hours} onChange={v => set('support_hours', v)} disabled={!fin} placeholder={tr(lang, 'ss_ph_support_hours')} />
          <Field label={tr(lang, 'ss_f_map')} type="url" value={vals.google_map_link} onChange={v => set('google_map_link', v)} disabled={!fin} placeholder="https://maps.google.com/..." />
        </div>

        {/* ── Social Media Links ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(232,35,42,.15)')}><IOrders size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>{tr(lang, 'ss_social_title')}</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'ss_social_desc')}</div>
            </div>
          </div>
          <Field label={tr(lang, 'ss_f_facebook')} type="url" value={vals.facebook_url} onChange={v => set('facebook_url', v)} disabled={!fin} placeholder="https://facebook.com/Cashskill" />
          <Field label={tr(lang, 'ss_f_youtube')} type="url" value={vals.youtube_url} onChange={v => set('youtube_url', v)} disabled={!fin} placeholder="https://youtube.com/@cashskillbd" />
          <Field label={tr(lang, 'ss_f_instagram')} type="url" value={vals.instagram_url} onChange={v => set('instagram_url', v)} disabled={!fin} placeholder="https://instagram.com/cashskillbd" />
          <Field label={tr(lang, 'ss_f_linkedin')} type="url" value={vals.linkedin_url} onChange={v => set('linkedin_url', v)} disabled={!fin} placeholder="https://linkedin.com/company/cashskillbd" />
          <Field label={tr(lang, 'ss_f_twitter')} type="url" value={vals.twitter_url} onChange={v => set('twitter_url', v)} disabled={!fin} placeholder="https://twitter.com/cashskillbd" />
        </div>

        {/* ── SEO Settings ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(232,35,42,.15)')}><IChart size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>{tr(lang, 'ss_seo_title')}</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'ss_seo_desc')}</div>
            </div>
          </div>
          <Field label={tr(lang, 'ss_f_meta_title')} value={vals.meta_title} onChange={v => set('meta_title', v)} disabled={!fin} placeholder="CashSkillBD - Learn • Grow • Succeed" />
          <Field label={tr(lang, 'ss_f_meta_desc')} type="textarea" value={vals.meta_description} onChange={v => set('meta_description', v)} disabled={!fin} placeholder={tr(lang, 'ss_ph_meta_desc')} />
          <Field label={tr(lang, 'ss_f_meta_keywords')} value={vals.meta_keywords} onChange={v => set('meta_keywords', v)} disabled={!fin} placeholder={tr(lang, 'ss_ph_meta_keywords')} />
          <ImageField label={tr(lang, 'ss_f_og')} value={vals.og_image} onUpload={f => uploadImage('og_image', f)} onRemove={() => set('og_image', '')} disabled={!fin} recommended={tr(lang, 'ss_rec_og')} />
        </div>

        {/* ── Hero Section ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(255,184,77,.15)')}><IBox size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>{tr(lang, 'ss_hero_title')}</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'ss_hero_desc')}</div>
            </div>
          </div>
          <Field label={tr(lang, 'ss_f_hero_badge')} value={vals.hero_badge} onChange={v => set('hero_badge', v)} disabled={!fin} />
          <Field label={tr(lang, 'ss_f_hero_title')} value={vals.hero_title} onChange={v => set('hero_title', v)} disabled={!fin} />
          <Field label={tr(lang, 'ss_f_hero_subtitle')} type="textarea" value={vals.hero_subtitle} onChange={v => set('hero_subtitle', v)} disabled={!fin} />
        </div>

        {/* ── Course Section ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(77,163,255,.15)')}><IUsers size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>{tr(lang, 'ss_course_title')}</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'ss_course_desc')}</div>
            </div>
          </div>
          <Field label={tr(lang, 'ss_f_course_name')} value={vals.course_name} onChange={v => set('course_name', v)} disabled={!fin} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={tr(lang, 'ss_f_course_price')} type="number" value={vals.course_price} onChange={v => set('course_price', v)} disabled={!fin} />
            <Field label={tr(lang, 'ss_f_old_price')} type="number" value={vals.course_old_price} onChange={v => set('course_old_price', v)} disabled={!fin} />
          </div>
          <Field label={tr(lang, 'ss_f_course_badge')} value={vals.course_badge} onChange={v => set('course_badge', v)} disabled={!fin} />
        </div>

        {/* ── Seminar Section ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(46,204,113,.15)')}><IClock size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>{tr(lang, 'ss_seminar_title')}</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'ss_seminar_desc')}</div>
            </div>
          </div>
          <Field label={tr(lang, 'ss_f_seminar_title')} value={vals.seminar_title} onChange={v => set('seminar_title', v)} disabled={!fin} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={tr(lang, 'ss_f_seminar_day')} value={vals.seminar_day} onChange={v => set('seminar_day', v)} disabled={!fin} placeholder={tr(lang, 'ss_ph_friday')} />
            <Field label={tr(lang, 'ss_f_seminar_time')} value={vals.seminar_time} onChange={v => set('seminar_time', v)} disabled={!fin} placeholder={tr(lang, 'ss_ph_seminar_time')} />
          </div>
          <Field label={tr(lang, 'ss_f_platform')} value={vals.seminar_platform} onChange={v => set('seminar_platform', v)} disabled={!fin} placeholder="Zoom / Google Meet" />
        </div>

        {/* ── Shop / Reviews / FAQ ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(255,107,214,.15)')}><IBox size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>{tr(lang, 'ss_shop_title')}</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'ss_shop_desc')}</div>
            </div>
          </div>
          <Field label={tr(lang, 'ss_f_shop_title')} value={vals.shop_title} onChange={v => set('shop_title', v)} disabled={!fin} />
          <Field label={tr(lang, 'ss_f_shop_subtitle')} value={vals.shop_subtitle} onChange={v => set('shop_subtitle', v)} disabled={!fin} />
          <Field label={tr(lang, 'ss_f_reviews_title')} value={vals.reviews_title} onChange={v => set('reviews_title', v)} disabled={!fin} />
          <Field label={tr(lang, 'ss_f_reviews_subtitle')} value={vals.reviews_subtitle} onChange={v => set('reviews_subtitle', v)} disabled={!fin} />
          <Field label={tr(lang, 'ss_f_faq_title')} value={vals.faq_title} onChange={v => set('faq_title', v)} disabled={!fin} />
        </div>

        {/* ── Payment Settings ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(245,185,66,.15)')}><IMoney size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>{tr(lang, 'ss_payment_title')}</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'ss_payment_desc')}</div>
            </div>
          </div>
          <Field label={tr(lang, 'ss_f_payment_title')} value={vals.payment_title} onChange={v => set('payment_title', v)} disabled={!fin} />
          <Field label={tr(lang, 'ss_f_bkash')} type="tel" value={vals.bkash_number} onChange={v => set('bkash_number', v)} disabled={!fin} />
          <ImageField label={tr(lang, 'ss_f_bkash_qr')} value={vals.bkash_qr} onUpload={f => uploadImage('bkash_qr', f)} onRemove={() => set('bkash_qr', '')} disabled={!fin} recommended={tr(lang, 'ss_rec_qr')} />
          <Field label={tr(lang, 'ss_f_nagad')} type="tel" value={vals.nagad_number} onChange={v => set('nagad_number', v)} disabled={!fin} />
          <ImageField label={tr(lang, 'ss_f_nagad_qr')} value={vals.nagad_qr} onUpload={f => uploadImage('nagad_qr', f)} onRemove={() => set('nagad_qr', '')} disabled={!fin} recommended={tr(lang, 'ss_rec_qr')} />
          <Field label={tr(lang, 'ss_f_rocket')} type="tel" value={vals.rocket_number} onChange={v => set('rocket_number', v)} disabled={!fin} />
          <ImageField label={tr(lang, 'ss_f_rocket_qr')} value={vals.rocket_qr} onUpload={f => uploadImage('rocket_qr', f)} onRemove={() => set('rocket_qr', '')} disabled={!fin} recommended={tr(lang, 'ss_rec_qr')} />
          <Field label={tr(lang, 'ss_f_binance')} value={vals.binance_uid} onChange={v => set('binance_uid', v)} disabled={!fin} />
          <ImageField label={tr(lang, 'ss_f_binance_qr')} value={vals.binance_qr} onUpload={f => uploadImage('binance_qr', f)} onRemove={() => set('binance_qr', '')} disabled={!fin} recommended={tr(lang, 'ss_rec_qr')} />
        </div>

        {/* ── Footer Settings ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(232,35,42,.15)')}><IOrders size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>{tr(lang, 'ss_footer_title')}</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'ss_footer_desc')}</div>
            </div>
          </div>
          <Field label={tr(lang, 'ss_f_footer_desc')} type="textarea" value={vals.footer_about} onChange={v => set('footer_about', v)} disabled={!fin} placeholder="© 2025 CashSkillBD. All rights reserved." />
          <Field label={tr(lang, 'ss_f_whatsapp')} type="tel" value={vals.whatsapp_number} onChange={v => set('whatsapp_number', v)} disabled={!fin} />
          <Field label={tr(lang, 'ss_f_privacy')} type="url" value={vals.privacy_policy_url} onChange={v => set('privacy_policy_url', v)} disabled={!fin} placeholder="https://cashskillbd.com/privacy-policy" />
          <Field label={tr(lang, 'ss_f_terms')} type="url" value={vals.terms_url} onChange={v => set('terms_url', v)} disabled={!fin} placeholder="https://cashskillbd.com/terms-of-service" />
          <Field label={tr(lang, 'ss_f_about')} type="url" value={vals.about_url} onChange={v => set('about_url', v)} disabled={!fin} placeholder="https://cashskillbd.com/about" />
        </div>

        {/* ── Additional Settings ── */}
        <div style={cardStyle}>
          <div style={cardHeadStyle}>
            <div style={iconBoxStyle('rgba(232,35,42,.15)')}><IGear size={20} /></div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff' }}>{tr(lang, 'ss_additional_title')}</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{tr(lang, 'ss_additional_desc')}</div>
            </div>
          </div>
          <Toggle label={tr(lang, 'ss_t_maintenance')} desc={tr(lang, 'ss_t_maintenance_desc')} checked={isOn('maintenance_mode')} onChange={v => set('maintenance_mode', String(v))} disabled={!fin} />
          <Toggle label={tr(lang, 'ss_t_allow_reg')} desc={tr(lang, 'ss_t_allow_reg_desc')} checked={vals.allow_registration !== 'false'} onChange={v => set('allow_registration', String(v))} disabled={!fin} />
          <Toggle label={tr(lang, 'ss_t_email')} desc={tr(lang, 'ss_t_email_desc')} checked={vals.email_notifications !== 'false'} onChange={v => set('email_notifications', String(v))} disabled={!fin} />
          <div>
            <label style={labelStyle}>{tr(lang, 'ss_f_default_lang')}</label>
            <select
              value={vals.default_language || 'en'}
              onChange={e => set('default_language', e.target.value)}
              disabled={!fin}
              style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
            >
              <option value="bn">{tr(lang, 'ss_lang_bn')}</option>
              <option value="en">{tr(lang, 'ss_lang_en')}</option>
              <option value="en-GB">{tr(lang, 'ss_lang_en_gb')}</option>
              <option value="ar">{tr(lang, 'ss_lang_ar')}</option>
              <option value="zh">{tr(lang, 'ss_lang_zh')}</option>
              <option value="hi">{tr(lang, 'ss_lang_hi')}</option>
              <option value="ur">{tr(lang, 'ss_lang_ur')}</option>
            </select>
          </div>
        </div>

      </div>
    </div>
  )
}
