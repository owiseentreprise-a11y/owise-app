'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { GA_ID } from '@/lib/ga'
import { analytiquesAutorisees } from '@/lib/consentement'

function PageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    /* Sans consentement explicite, aucune vue de page n'est envoyée — même
       si gtag se trouve chargé (consentement retiré en cours de visite). */
    if (!GA_ID || typeof window === 'undefined' || !window.gtag) return
    if (!analytiquesAutorisees()) return
    const qs = searchParams.toString()
    const page_path = qs ? `${pathname}?${qs}` : pathname
    window.gtag('event', 'page_view', {
      page_path,
      page_location: window.location.href,
      page_title: document.title,
      send_to: GA_ID,
    })
  }, [pathname, searchParams])

  return null
}

// send_page_view est désactivé dans GoogleAnalytics.tsx : c'est ce composant
// qui envoie l'unique page_view par navigation (SSR + transitions client Next.js).
export default function GAPageView() {
  return (
    <Suspense fallback={null}>
      <PageViewTracker />
    </Suspense>
  )
}
