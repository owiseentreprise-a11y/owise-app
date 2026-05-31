import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const raw = process.env.STRIPE_SECRET_KEY ?? ''
    const key = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw
    _stripe = new Stripe(key, {
      apiVersion: '2025-01-27.acacia' as any,
    })
  }
  return _stripe
}

// Proxy pour garder la syntaxe `stripe.xxx` dans les fichiers existants
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe]
  },
})
