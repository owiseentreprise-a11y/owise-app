'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { COOKIE_KEY, initFbPixel } from '@/lib/pixel'
import { initGA } from '@/lib/ga'

// Routes qui NE rendent PAS VitrineBody (lequel a sa propre bannière cookies,
// avec en plus un panneau de préférences détaillé). Sur toutes les autres
// routes — home "/" et pages de destination "/vtc-*" — VitrineBody gère déjà
// le consentement : afficher aussi celle-ci ferait doublon.
const ROUTES_SANS_VITRINE_BODY = new Set([
  '/admin', '/blog', '/chauffeur', '/client-login', '/desinscription',
  '/espace-client', '/faq', '/login', '/mentions-legales', '/paiement',
  '/reserver', '/sous-traitant', '/sous-traitant-login', '/auth',
])

function hasOwnCookieBanner(pathname: string): boolean {
  if (pathname === '/') return true
  const first = '/' + pathname.split('/')[1]
  if (ROUTES_SANS_VITRINE_BODY.has(first)) return false
  // Segment unique inconnu de la liste ci-dessus → page de destination [destination]/page.tsx
  return pathname.split('/').filter(Boolean).length === 1
}

export default function CookieBanner() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (hasOwnCookieBanner(pathname)) return
    try {
      const stored = localStorage.getItem(COOKIE_KEY)
      if (stored === 'accepted') {
        initFbPixel()
        initGA()
      } else if (!stored) {
        setVisible(true)
      }
    } catch {
      // localStorage inaccessible (WebView restrictif, mode incognito) — afficher la bannière
      setVisible(true)
    }
  }, [pathname])

  function accept() {
    try { localStorage.setItem(COOKIE_KEY, 'accepted') } catch { /* ignore */ }
    setVisible(false)
    initFbPixel()
    initGA()
  }

  function refuse() {
    try { localStorage.setItem(COOKIE_KEY, 'refused') } catch { /* ignore */ }
    setVisible(false)
  }

  // Le bandeau est en position fixe par-dessus la page : sans réserver sa
  // hauteur, il recouvre ce qui se trouve en bas. Mesuré le 2026-09-19 sur
  // /admin/courses/nouvelle en 1400×900 : le bouton « Créer la course »
  // occupait 823→868 px et le bandeau 825→900, soit 43 px sur 45 masqués — le
  // clic partait dans le bandeau et la création semblait ne rien faire.
  // On publie la hauteur réelle dans une variable CSS, que les conteneurs
  // défilants utilisent comme marge basse.
  useEffect(() => {
    const racine = document.documentElement
    if (!visible) { racine.style.setProperty('--bandeau-cookies', '0px'); return }
    const maj = () => {
      const h = ref.current?.getBoundingClientRect().height ?? 0
      racine.style.setProperty('--bandeau-cookies', `${Math.ceil(h)}px`)
    }
    maj()
    const ro = new ResizeObserver(maj)
    if (ref.current) ro.observe(ref.current)
    window.addEventListener('resize', maj)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', maj)
      racine.style.setProperty('--bandeau-cookies', '0px')
    }
  }, [visible])

  if (!visible) return null

  return (
    <div ref={ref} style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: '#09091A',
      borderTop: '1px solid rgba(201,168,76,.2)',
      padding: '16px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, flexWrap: 'wrap',
      boxShadow: '0 -4px 32px rgba(0,0,0,.3)',
    }}>
      <p style={{ fontSize: 13, color: 'rgba(237,232,223,.7)', margin: 0, maxWidth: 700, lineHeight: 1.6 }}>
        Nous utilisons des cookies pour mesurer l&apos;audience et améliorer nos services (Meta Pixel, Google Analytics).
        En continuant, vous acceptez leur utilisation.{' '}
        <a href="/mentions-legales" style={{ color: '#C9A84C', textDecoration: 'none' }}>
          En savoir plus
        </a>
      </p>
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        <button onClick={refuse} style={{
          padding: '9px 18px', borderRadius: 8, border: '1px solid rgba(237,232,223,.2)',
          background: 'transparent', color: 'rgba(237,232,223,.6)',
          fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Refuser
        </button>
        <button onClick={accept} style={{
          padding: '9px 18px', borderRadius: 8, border: 'none',
          background: '#C9A84C', color: '#09091A',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Accepter
        </button>
      </div>
    </div>
  )
}
