import { createContext, useContext, useState, useEffect } from 'react'

const LangCtx = createContext(null)

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('csbd-admin-lang') || 'en')
  
  useEffect(() => {
    localStorage.setItem('csbd-admin-lang', lang)
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en'
  }, [lang])
  
  const toggle = () => setLang(l => l === 'bn' ? 'en' : 'bn')
  
  return <LangCtx.Provider value={{ lang, setLang, toggle }}>{children}</LangCtx.Provider>
}

export const useLang = () => useContext(LangCtx)
