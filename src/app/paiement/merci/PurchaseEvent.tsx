'use client'

import { useEffect } from 'react'
import { fbPurchase, fbLead } from '@/lib/pixel'
import { gtagConversion } from '@/lib/ga'

export default function PurchaseEvent({ amount }: { amount: number }) {
  useEffect(() => {
    if (amount > 0) {
      fbPurchase(amount, 'EUR')
      fbLead({ value: amount, currency: 'EUR', content_category: 'VTC' })
      gtagConversion({ value: amount, currency: 'EUR' })
    }
  }, [amount])
  return null
}
