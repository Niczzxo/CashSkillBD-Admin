import { useEffect, useState } from 'react'

// Tiny hash router.
// App routes: #/ , #/login , #/register , #/dashboard , #/course/:id , #/admin
// Plain anchors (#course, #shop, ...) scroll to landing sections.
export const SECTIONS = ['course', 'seminar', 'shop', 'reviews', 'payment', 'faq']

export function parseRoute() {
  const h = window.location.hash.replace(/^#/, '') || '/'
  const parts = h.split('/').filter(Boolean)
  return { path: h, parts }
}

export function navigate(to) {
  window.location.hash = to
}

export function useRoute() {
  const [route, setRoute] = useState(parseRoute)
  useEffect(() => {
    const fn = () => {
      const r = parseRoute()
      setRoute(r)
      // scroll to top for app routes; anchors handled by scrollToSection
      if (r.path.startsWith('/')) window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', fn)
    return () => window.removeEventListener('hashchange', fn)
  }, [])
  return route
}

export function useScrollToSection(route) {
  useEffect(() => {
    const [first, second] = route.parts
    if (first && SECTIONS.includes(first) && !second) {
      // wait a tick for Landing to render
      const t = setTimeout(() => {
        document.getElementById(first)?.scrollIntoView({ behavior: 'smooth' })
      }, 80)
      return () => clearTimeout(t)
    }
  }, [route.path])
}

export function link(to) {
  return { href: '#' + to, onClick: (e) => { e.preventDefault(); navigate(to) } }
}
