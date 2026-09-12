'use client'

import { logFunnelEvent } from '@/app/actions/funnel'
import { gtagEvent } from '@/lib/ga'

const SESSION_KEY = 'ow_fsid'

function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr'
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return 'no-storage'
  }
}

/**
 * Log un point du tunnel devis/réservation, en base (pour analyse fiable même
 * sans accès au dashboard GA4/Vercel) et en GA4 (pour recoupement rapide).
 * Ne bloque jamais l'UI : appel fire-and-forget, erreurs avalées.
 */
export function logFunnel(step: string, meta?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  const sessionId = getSessionId()
  const page = window.location.pathname
  gtagEvent(step, meta)
  logFunnelEvent({ sessionId, step, page, meta }).catch(() => {})
}
