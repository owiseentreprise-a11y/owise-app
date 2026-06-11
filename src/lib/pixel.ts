export const FB_PIXEL_ID = '1688600002292509'

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void
    _fbq: unknown
  }
}

export function fbEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', name, params ?? {})
  }
}

export const fbPageView     = () => fbEvent('PageView')
export const fbViewContent  = (params?: Record<string, unknown>) => fbEvent('ViewContent', params)
export const fbLead         = (params?: Record<string, unknown>) => fbEvent('Lead', params)
export const fbContact      = () => fbEvent('Contact')
export const fbInitCheckout = (params?: Record<string, unknown>) => fbEvent('InitiateCheckout', params)
export const fbPurchase     = (value: number, currency = 'EUR') => fbEvent('Purchase', { value, currency })
