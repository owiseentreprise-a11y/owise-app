declare global {
  interface Window {
    gtag: (...args: unknown[]) => void
    dataLayer: unknown[]
  }
}

export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? 'G-4396NMMFQM'
export const AW_ID = process.env.NEXT_PUBLIC_AW_ID ?? 'AW-18274455264'
export const AW_CONVERSION_LABEL = process.env.NEXT_PUBLIC_AW_CONVERSION_LABEL ?? 'IAeICOOxgfIcEOCd-IlE'

export function initGA() {
  if (!GA_ID || typeof window === 'undefined' || !window.gtag) return
  window.gtag('config', GA_ID, { anonymize_ip: true })
}

export function gtagEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.gtag) return
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
  if (typeof window !== 'undefined' && window.gtag && AW_ID && AW_CONVERSION_LABEL) {
    window.gtag('event', 'conversion', {
      send_to: `${AW_ID}/${AW_CONVERSION_LABEL}`,
      value: params.value ?? 0,
      currency: params.currency ?? 'EUR',
      transaction_id: params.transaction_id,
    })
  }
}
