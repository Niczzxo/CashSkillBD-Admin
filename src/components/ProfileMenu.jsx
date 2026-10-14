import { useEffect, useRef, useState } from 'react'
import { useLang } from '../i18n/LanguageContext.jsx'
import { tr } from '../i18n/translations.js'
import { supabase } from '../lib/supabase.js'

// Profile dropdown with the authenticated admin's REAL profile data.
// My Profile opens a modal with the actual record — no fabricated ID or identity.
export function ProfileMenu({ session, role, goSec, signOut }) {
  const { lang } = useLang()
  const [open, setOpen] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [profile, setProfile] = useState(null)
  const boxRef = useRef(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      if (!session?.user?.id) return
      const { data } = await supabase.from('cashskillbd_profiles').select('full_name, email, avatar_url, member_id, role, created_at').eq('id', session.user.id).single()
      if (alive) setProfile(data || null)
    }
    load()
    return () => { alive = false }
  }, [session])

  useEffect(() => {
    if (!open && !showProfile) return
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); setShowProfile(false) } }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open, showProfile])

  const name = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Admin'
  const email = profile?.email || session?.user?.email || '—'
  const avatar = profile?.avatar_url || session?.user?.user_metadata?.avatar_url || ''
  const memberId = profile?.member_id || '—'
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'A'
  const joined = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  const menuItem = (label, onClick, danger = false) => (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,.04)', color: danger ? '#FF303A' : '#fff', cursor: 'pointer', fontSize: '.88rem', textAlign: 'left' }}>{label}</button>
  )

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} aria-label={tr(lang, 'nav_my_profile')} style={{ display: 'flex', alignItems: 'center', gap: 9, background: open ? 'rgba(255,48,58,.14)' : 'transparent', border: '1px solid transparent', borderRadius: 11, padding: '3px 8px 3px 3px', cursor: 'pointer' }}>
        {avatar
          ? <img src={avatar} alt={name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,48,58,.5)' }} />
          : <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#FF303A,#A80F20)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '.8rem' }}>{initials}</span>}
        <span style={{ textAlign: 'left', lineHeight: 1.25 }} className="hide-m">
          <span style={{ display: 'block', color: '#fff', fontSize: '.86rem', fontWeight: 700, maxWidth: 130, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
          <span style={{ display: 'block', color: '#C6B2B5', fontSize: '.72rem', textTransform: 'capitalize' }}>{role || 'admin'}</span>
        </span>
        <span style={{ color: '#8D7B7F', fontSize: '.7rem' }}>▼</span>
      </button>

      {open && (
        <div style={{ position: 'fixed', top: 74, right: 12, width: 'min(300px, calc(100vw - 24px))', background: '#160B0D', border: '1px solid #3A171B', borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,.6)', zIndex: 130, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '15px 14px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            {avatar
              ? <img src={avatar} alt={name} style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,48,58,.5)' }} />
              : <span style={{ width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(135deg,#FF303A,#A80F20)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{initials}</span>}
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', color: '#fff', fontWeight: 700, fontSize: '.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
              <span style={{ display: 'block', color: '#2ecc71', fontSize: '.75rem', marginTop: 2, textTransform: 'capitalize' }}>● {role || 'admin'}</span>
              <span style={{ display: 'block', color: '#8D7B7F', fontSize: '.72rem', marginTop: 1 }}>{tr(lang, 'nav_profile_id')}: {memberId}</span>
            </span>
          </div>
          {menuItem(tr(lang, 'nav_my_profile'), () => { setOpen(false); setShowProfile(true) })}
          {menuItem(tr(lang, 'nav_settings'), () => { setOpen(false); goSec('site-settings') })}
          {menuItem(tr(lang, 'nav_admin_panel'), () => { setOpen(false); goSec('dashboard') })}
          {menuItem(tr(lang, 'logout'), () => { setOpen(false); signOut() }, true)}
        </div>
      )}

      {showProfile && (
        <div onClick={() => setShowProfile(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={tr(lang, 'nav_profile_title')} style={{ width: 'min(440px, 100%)', background: '#160B0D', border: '1px solid #3A171B', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>{tr(lang, 'nav_profile_title')}</span>
              <button onClick={() => setShowProfile(false)} aria-label={tr(lang, 'nav_close')} style={{ background: 'none', border: 'none', color: '#8D7B7F', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: 20, textAlign: 'center' }}>
              {avatar
                ? <img src={avatar} alt={name} style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,48,58,.5)' }} />
                : <span style={{ width: 84, height: 84, borderRadius: '50%', background: 'linear-gradient(135deg,#FF303A,#A80F20)', color: '#fff', display: 'inline-grid', placeItems: 'center', fontWeight: 800, fontSize: '1.4rem' }}>{initials}</span>}
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', marginTop: 12 }}>{name}</div>
              <div style={{ color: '#8D7B7F', fontSize: '.85rem', marginTop: 2 }}>{email}</div>
            </div>
            <div style={{ padding: '0 18px 18px', display: 'grid', gap: 8 }}>
              {[
                [tr(lang, 'nav_profile_id'), memberId],
                [tr(lang, 'nav_profile_email'), email],
                [tr(lang, 'nav_profile_role'), role || 'admin'],
                [tr(lang, 'nav_profile_joined'), joined],
                [tr(lang, 'nav_profile_user_id'), session?.user?.id ? String(session.user.id).slice(0, 8) + '…' : '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 9, padding: '10px 12px', fontSize: '.86rem' }}>
                  <span style={{ color: '#8D7B7F' }}>{k}</span>
                  <span style={{ color: '#fff', fontWeight: 600, wordBreak: 'break-all', textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
