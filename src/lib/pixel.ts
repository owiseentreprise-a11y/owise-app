export const FB_PIXEL_ID = '1688600002292509'
export const COOKIE_KEY  = 'owise_cookie_consent'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
    _fbq?: unknown
  }
}

export function initFbPixel() {
  if (typeof window === 'undefined' || window.fbq) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fbq: any = function (...args: unknown[]) {
    fbq.callMethod ? fbq.callMethod(...args) : fbq.queue.push(args)
  }
  if (!window._fbq) window._fbq = fbq
  fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = []
  window.fbq = fbq
  const s = document.createElement('script')
  s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(s)
  window.fbq!('init', FB_PIXEL_ID)
  window.fbq!('track', 'PageView')
}

export function fbEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq!('track', name, params ?? {})
  }
}

export const fbPageView     = () => fbEvent('PageView')
export const fbViewContent  = (params?: Record<string, unknown>) => fbEvent('ViewContent', params)
export const fbLead         = (params?: Record<string, unknown>) => fbEvent('Lead', params)
export const fbContact      = () => fbEvent('Contact')
export const fbInitCheckout = (params?: Record<string, unknown>) => fbEvent('InitiateCheckout', params)
export const fbPurchase     = (value: number, currency = 'EUR') => fbEvent('Purchase', { value, currency })
