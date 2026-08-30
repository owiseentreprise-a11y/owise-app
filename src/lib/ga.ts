declare global {
  interface Window {
    gtag: (...args: unknown[]) => void
    dataLayer: unknown[]
  }
}

export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? 'G-4396NMMFQM'

export function initGA() {
  if (!GA_ID || typeof window === 'undefined' || !window.gtag) return
  window.gtag('config', GA_ID, { anonymize_ip: true })
}

export function gtagEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', name, params)
}

export function gtagConversion(params: { value?: number; currency?: string; transaction_id?: string }) {
  gtagEvent('purchase', {
    currency: params.currency ?? 'EUR',
    value: params.value ?? 0,
    transaction_id: params.transaction_id,
  })
}
