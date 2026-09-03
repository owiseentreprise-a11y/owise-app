'use client'

import { useEffect } from 'react'
import { initFbPixel, fbPurchase, fbLead, COOKIE_KEY } from '@/lib/pixel'
import { initGA, gtagConversion } from '@/lib/ga'

export default function PurchaseEvent({ amount }: { amount: number }) {
  useEffect(() => {
    if (amount <= 0) return
    // initFbPixel/initGA ici car useEffect enfant s'exécute avant CookieBanner
    const consent = localStorage.getItem(COOKIE_KEY)
    if (consent === 'accepted') {
      initFbPixel()
      initGA()
      fbPurchase(amount, 'EUR')
      fbLead({ value: amount, currency: 'EUR', content_category: 'VTC' })
      gtagConversion({ value: amount, currency: 'EUR' })
    }
  }, [amount])
  return null
}
