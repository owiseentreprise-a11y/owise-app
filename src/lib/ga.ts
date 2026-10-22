import { analytiquesAutorisees } from './consentement'

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void
    dataLayer: unknown[]
  }
}

export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? 'G-4396NMMFQM'
export const AW_ID = process.env.NEXT_PUBLIC_AW_ID ?? 'AW-18274455264'
export const AW_CONVERSION_LABEL = process.env.NEXT_PUBLIC_AW_CONVERSION_LABEL ?? 'IAeICOOxgfIcEOCd-IlE'

/**
 * Dernière barrière avant tout envoi à Google.
 *
 * GoogleAnalytics.tsx ne pose déjà les balises qu'après un « accepted », donc
 * `window.gtag` n'existe normalement pas sans consentement. Ce contrôle est
 * là pour les cas où il existerait quand même : un consentement retiré en
 * cours de visite (gtag reste chargé dans la page), ou une extension, un
 * autre script, une régression future qui le définirait.
 *
 * L'absence de choix vaut refus : `analytiquesAutorisees()` rend false.
 */
function envoiAutorise(): boolean {
  return typeof window !== 'undefined' && !!window.gtag && analytiquesAutorisees()
}

export function initGA() {
  if (!GA_ID || !envoiAutorise()) return
  window.gtag('config', GA_ID, { anonymize_ip: true })
}

export function gtagEvent(name: string, params?: Record<string, unknown>) {
  if (!envoiAutorise()) return
  window.gtag('event', name, params)
}

export function gtagConversion(params: { value?: number; currency?: string; transaction_id?: string }) {
  // GA4 purchase event
  gtagEvent('purchase', {
    currency: params.currency ?? 'EUR',
    value: params.value ?? 0,
    transaction_id: params.transaction_id,
  })
  // Google Ads conversion
  if (envoiAutorise() && AW_ID && AW_CONVERSION_LABEL) {
    window.gtag('event', 'conversion', {
      send_to: `${AW_ID}/${AW_CONVERSION_LABEL}`,
      value: params.value ?? 0,
      currency: params.currency ?? 'EUR',
      transaction_id: params.transaction_id,
    })
  }
}
