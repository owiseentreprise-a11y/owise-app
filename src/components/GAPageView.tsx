'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { GA_ID } from '@/lib/ga'

function PageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!GA_ID || typeof window === 'undefined' || !window.gtag) return
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
