import { useState, useRef, useEffect } from 'react'
import { useLang } from '../i18n/LanguageContext.jsx'
import { LOCALES, getLocale } from '../i18n/locales.js'

export function LanguageSelector({ className = '', onSelect = null }) {
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)
  const searchRef = useRef(null)
  const current = getLocale(lang)

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Focus search when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  }, [open])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? LOCALES.filter(l =>
        l.native.toLowerCase().includes(q) ||
        l.english.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
      )
    : LOCALES

  const select = (code) => {
    setLang(code)
    setOpen(false)
    if (onSelect) onSelect(code)
  }

  return (
    <div ref={ref} className={`lang-select ${className}`}>
      <button
        className="lang-select-btn"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select language"
      >
        <span className="lang-flag" aria-hidden="true">{current.flag}</span>
        <span className="lang-name">{current.native}</span>
        <span className={`lang-chev ${open ? 'open' : ''}`} aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="lang-dropdown" role="listbox" aria-label="Languages">
          <div className="lang-search">
            <span aria-hidden="true">🔍</span>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search language..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search language"
            />
          </div>
          <div className="lang-list">
            {filtered.length === 0 && (
              <div className="lang-empty">No languages found</div>
            )}
            {filtered.map((l) => {
              const active = l.code === lang
              return (
                <button
                  key={l.code}
                  role="option"
                  aria-selected={active}
                  className={`lang-option ${active ? 'active' : ''}`}
                  onClick={() => select(l.code)}
                >
                  <span className="lang-flag" aria-hidden="true">{l.flag}</span>
                  <span className="lang-name">{l.native}</span>
                  {active && <span className="lang-check" aria-hidden="true">✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
